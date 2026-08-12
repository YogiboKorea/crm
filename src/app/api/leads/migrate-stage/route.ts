import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/leads/migrate-stage
 * 기존 2500건에 stage 값 부여 (1회성).
 *
 * 매핑 규칙:
 *   favorite === true                                             → 'partner' (대표가 직접 파트너 등록)
 *   verification.aiVerdict === 'beauty-buyer'                     → 'verified'
 *   passed 로직 (사업관련성 + 사이트 alive + 컨택 1개+)          → 'verified'
 *   verifiedAt 있음 + 위 조건 안 됨                                → 'archived' (검증했으나 무효)
 *   verifiedAt 없음                                                → 'imported' (미검증)
 *
 * 이미 stage 값 있으면 덮어쓰지 않음 (idempotent). ?force=true 로 강제 재매핑 가능.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === 'true';
  const dryRun = url.searchParams.get('dryRun') === 'true';

  try {
    await dbConnect();
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: `DB 연결 실패: ${e?.message || 'unknown'}` },
      { status: 500 },
    );
  }

  try {
    const filter: any = force
      ? {}
      : { $or: [{ stage: { $exists: false } }, { stage: '' }, { stage: null }] };

    const total = await Lead.countDocuments(filter);
    const targets = await Lead.find(filter)
      .select('leadId Company favorite verification stageChangedAt becamePartnerAt')
      .lean();

    const now = new Date().toISOString();
    const tally = {
      partner: 0,
      verified: 0,
      archived: 0,
      imported: 0,
    };

    const ops: any[] = [];
    for (const l of targets as any[]) {
      let newStage: string = 'imported';
      const v = l.verification || {};

      if (l.favorite === true) {
        newStage = 'partner';
      } else if (v.aiVerdict === 'beauty-buyer') {
        newStage = 'verified';
      } else if (
        v.verifiedAt &&
        v.businessLevel === 'relevant' &&
        v.websiteAlive === true &&
        (v.emailValid === true || v.phoneMatch === true || v.linkedinValid === true)
      ) {
        newStage = 'verified';
      } else if (v.verifiedAt) {
        newStage = 'archived';
      } else {
        newStage = 'imported';
      }

      tally[newStage as keyof typeof tally]++;

      if (!dryRun) {
        const update: any = {
          stage: newStage,
          stageChangedAt: now,
        };
        if (newStage === 'partner') {
          update.becamePartnerAt = l.becamePartnerAt || now;
        }
        // registeredAt이 없으면 importedAt으로 대체, 없으면 now
        update.registeredAt = l.registeredAt || l.importedAt || now;
        update.updatedInfoAt = l.updatedInfoAt || now;

        ops.push({
          updateOne: {
            filter: { leadId: l.leadId },
            update: { $set: update },
          },
        });
      }
    }

    if (!dryRun && ops.length > 0) {
      await Lead.bulkWrite(ops, { ordered: false });
    }

    return NextResponse.json({
      success: true,
      total,
      dryRun,
      tally,
      updated: dryRun ? 0 : ops.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'unknown error' },
      { status: 500 },
    );
  }
}
