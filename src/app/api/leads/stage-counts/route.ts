import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';

export const runtime = 'nodejs';

/**
 * GET /api/leads/stage-counts
 * 사이드바 배지 + 서브필터 chip 카운트 + 폴더 뷰용 배치 breakdown.
 * 서버 사이드 aggregation → 클라이언트가 전체 리드를 fetch 하지 않고도 카운트 표시 가능.
 *
 * 반환:
 *   {
 *     success,
 *     stages: { imported, verifying, verified, contacted, replied, negotiating, partner, archived, failed },
 *     verifyingSub: { unverified, maybe, all },
 *     verifiedSub: { approved, pending, noEmail, all },
 *     batches: [ { batchId, dateLabel, breakdown: {...} } ]   // 검증대기 폴더용
 *   }
 */
export async function GET() {
  try {
    await dbConnect();

    // 1) stage 별 카운트 + failed 특수 처리
    const stageAgg = await Lead.aggregate([
      { $match: { deleted: { $ne: true } } },
      { $group: { _id: { stage: '$stage', aiVerdict: '$verification.aiVerdict' }, n: { $sum: 1 } } },
    ]);

    const stages: any = {
      imported: 0, verifying: 0, verified: 0,
      contacted: 0, replied: 0, negotiating: 0,
      partner: 0, archived: 0, failed: 0,
    };
    for (const row of stageAgg) {
      const s = row._id.stage || 'imported';
      const v = row._id.aiVerdict;
      if (s === 'archived' && v === 'not-buyer') {
        stages.failed += row.n;
      } else if (stages[s] !== undefined) {
        stages[s] += row.n;
      }
    }

    // 2) 검증대기 서브필터 카운트
    const verifyingSub = { unverified: 0, maybe: 0, all: stages.verifying };
    const [vUnverified, vMaybe] = await Promise.all([
      Lead.countDocuments({
        stage: 'verifying', deleted: { $ne: true },
        $or: [
          { 'verification.aiVerifiedAt': { $exists: false } },
          { 'verification.aiVerifiedAt': '' },
        ],
      }),
      Lead.countDocuments({
        stage: 'verifying', deleted: { $ne: true },
        'verification.aiVerdict': 'maybe',
      }),
    ]);
    verifyingSub.unverified = vUnverified;
    verifyingSub.maybe = vMaybe;

    // 3) 검증완료 서브필터 카운트
    const verifiedSub = { approved: 0, pending: 0, noEmail: 0, all: stages.verified };
    const [vApproved, vNoEmail] = await Promise.all([
      Lead.countDocuments({ stage: 'verified', readyForOutreach: true, deleted: { $ne: true } }),
      Lead.countDocuments({
        stage: 'verified', deleted: { $ne: true },
        $or: [{ Email: '' }, { Email: /^Not found/i }, { Email: { $exists: false } }],
      }),
    ]);
    verifiedSub.approved = vApproved;
    verifiedSub.noEmail = vNoEmail;
    verifiedSub.pending = stages.verified - vApproved - vNoEmail;
    if (verifiedSub.pending < 0) verifiedSub.pending = 0;

    // 4) 검증대기 폴더용 배치 breakdown
    // 전체 배치 목록 + 각 배치의 stage별 카운트
    const batchAgg = await Lead.aggregate([
      { $match: { deleted: { $ne: true } } },
      { $group: {
          _id: { batch: { $ifNull: ['$importBatch', '(수동/미배치)'] }, stage: '$stage', aiVerdict: '$verification.aiVerdict' },
          n: { $sum: 1 },
      }},
    ]);

    const batchMap = new Map();
    for (const row of batchAgg) {
      const b = row._id.batch;
      if (!batchMap.has(b)) {
        const m = String(b).match(/(\d{4})(\d{2})(\d{2})/);
        const dateLabel = m ? `${m[1]}-${m[2]}-${m[3]}` : (b === '(수동/미배치)' ? '수동 추가' : '미상');
        batchMap.set(b, {
          batchId: b, dateLabel,
          breakdown: { total: 0, verifying: 0, verified: 0, failed: 0, archivedOther: 0,
                       contacted: 0, replied: 0, negotiating: 0, partner: 0, imported: 0 },
        });
      }
      const g = batchMap.get(b);
      g.breakdown.total += row.n;
      const s = row._id.stage || 'imported';
      const v = row._id.aiVerdict;
      if (s === 'archived') {
        if (v === 'not-buyer') g.breakdown.failed += row.n;
        else g.breakdown.archivedOther += row.n;
      } else if (g.breakdown[s] !== undefined) {
        g.breakdown[s] += row.n;
      }
    }
    // 최신 배치 먼저
    const batches = Array.from(batchMap.values()).sort((a, b) => b.batchId.localeCompare(a.batchId));

    return NextResponse.json({
      success: true,
      stages,
      verifyingSub,
      verifiedSub,
      batches,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
