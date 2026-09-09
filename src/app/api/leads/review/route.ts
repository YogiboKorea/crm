import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';

export const runtime = 'nodejs';

/**
 * 빠른 검토 전용 API.
 *
 * 발송대기 410건을 표에서 한 줄씩 열고 닫으며 판단하면 지친다.
 * 이 엔드포인트는 "아직 판단하지 않은 것"만 순서대로 내려주고,
 * 승인/제외 한 번에 다음 건으로 넘어가게 한다.
 *
 * 판단이 끝난 것 = readyForOutreach true(승인) 또는 stage archived(제외).
 * 둘 다 아닌 것만 대기열에 남는다.
 */

const REVIEW_PROJECTION = {
  leadId: 1, Company: 1, Country: 1, Email: 1, WebsiteContact: 1, Phone: 1,
  Type: 1, Category: 1, Priority: 1, Evidence: 1, Sources: 1, Confidence: 1,
  BrandsChannels: 1, notes: 1, importBatch: 1,
};

/**
 * GET /api/leads/review?limit=30&category=Distributor
 *
 * category 를 주면 그 분류만 내려준다. 클라이언트가 "디스트리뷰터부터
 * 꼼꼼히 보고 싶다"고 해서, 410건을 통째로 훑지 않고 축을 골라 볼 수 있게 한다.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')));
    const category = searchParams.get('category') || '';

    await dbConnect();

    const basePending = {
      stage: 'verified',
      readyForOutreach: { $ne: true },
      Email: { $nin: ['', null] as any },
    };
    const pending: any = category && category !== 'all'
      ? { ...basePending, Category: category }
      : basePending;

    const [items, remaining, approved, byCategory] = await Promise.all([
      // 나라별로 묶여서 나오면 판단 기준이 일정하게 유지된다 —
      // 스웨덴 20곳을 연달아 보는 편이, 매번 다른 나라로 튀는 것보다 덜 지친다.
      Lead.find(pending, REVIEW_PROJECTION).sort({ Country: 1, Company: 1 }).limit(limit).lean(),
      Lead.countDocuments(pending),
      Lead.countDocuments({ stage: 'verified', readyForOutreach: true }),
      // 분류 탭에 붙일 남은 건수
      Lead.aggregate([
        { $match: basePending },
        { $group: { _id: '$Category', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]),
    ]);

    return NextResponse.json({ success: true, items, remaining, approved, byCategory });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}

/**
 * POST /api/leads/review — 한 건 판단
 * Body: { leadId: string, decision: 'approve' | 'reject' }
 *
 * reject 는 지우지 않고 보관함으로 보낸다. 되돌릴 수 있어야
 * "잘못 눌렀다"가 자료 손실이 되지 않는다.
 */
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 });
  }

  const { leadId, decision } = body || {};
  if (!leadId || !['approve', 'reject'].includes(decision)) {
    return NextResponse.json(
      { success: false, error: "leadId 와 decision('approve'|'reject') 이 필요합니다" },
      { status: 400 },
    );
  }

  try {
    await dbConnect();
    const now = new Date();

    const set: any = decision === 'approve'
      ? { readyForOutreach: true, reviewedAt: now, reviewDecision: 'approve' }
      : {
          stage: 'archived',
          stageChangedAt: now.toISOString(),
          readyForOutreach: false,
          reviewedAt: now,
          reviewDecision: 'reject',
          // 되돌릴 때 어디로 보낼지 남긴다
          reviewPrevStage: 'verified',
        };

    const r = await Lead.updateOne({ leadId }, { $set: set });
    if (!r.matchedCount) {
      return NextResponse.json({ success: false, error: '리드를 찾을 수 없습니다' }, { status: 404 });
    }

    const remaining = await Lead.countDocuments({
      stage: 'verified', readyForOutreach: { $ne: true }, Email: { $nin: ['', null] },
    });

    return NextResponse.json({ success: true, decision, remaining });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '처리 실패' }, { status: 500 });
  }
}
