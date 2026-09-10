import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';

export const runtime = 'nodejs';

/**
 * 기존 데이터 — 클라이언트가 원래 가지고 있던 CSV 업로드분.
 *
 * 대부분 중복 정리·일괄 이동으로 보관함에 들어가 있다. 지운 게 아니므로
 * "이건 살려서 보내자" 싶은 걸 골라 발송대기로 되돌릴 수 있어야 한다.
 *
 * AI 서칭으로 새로 발굴한 건(importBatch = ai-search-*)은 여기서 제외한다.
 * 그건 [발송 대기]에서 보는 것이고, 여기는 '예전 것'을 뒤지는 자리다.
 */

const NOT_AI = { importBatch: { $not: /^ai-search-/ } };

/**
 * 지운 건은 빼고 센다.
 *
 * 이게 없던 동안에는 중복 정리로 deleted=true 를 붙인 건까지 폴더 숫자에 잡혀서,
 * 정리를 하고도 화면 숫자가 그대로였다. 지운 것이 다시 보이면 "정리가 안 됐나"
 * 하고 또 지우게 된다.
 */
const NOT_DELETED = { deleted: { $ne: true } };

/**
 * 기존 데이터의 Email 칸에는 주소가 아닌 말이 섞여 있다 —
 * "Contact form on site" 1243건, "Not found publicly" 550건, "DM via Instagram" 112건 …
 * 5068건 중 2497건이 이런 값이다. 크롤링 담당자가 '연락 방법'을 적어둔 것이라
 * 비어 있지 않다는 이유로 통과시키면 발송대기에 쌓였다가 전부 발송 실패한다.
 * 그래서 "칸이 비었나"가 아니라 "실제 주소 형태인가"로 거른다.
 */
const REAL_EMAIL = { Email: { $regex: /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/ } };

/**
 * 정리 과정에서 걸러낸 것들 (scripts/dedup-legacy.mjs).
 * 지운 게 아니라 표시만 해 둔 것이라, 필드를 지우면 다시 보인다.
 *
 *  dupHiddenAt — 같은 회사·같은 주소가 여러 건 (2571건이 실제로는 660곳이었다)
 *  badEmailAt  — 주소 하나가 서로 다른 회사 수십 곳에 붙어 있음.
 *                dev7561@gmail.com 이 이집트·키프로스·부르키나파소 회사에 동시에 달려 있었다.
 *                회사는 진짜지만 주소가 그 회사 것이 아니므로 보내면 엉뚱한 사람에게 간다.
 */
const NOT_HIDDEN = { dupHiddenAt: { $exists: false }, badEmailAt: { $exists: false } };

const LIST_PROJECTION = {
  leadId: 1, Company: 1, Country: 1, Email: 1, WebsiteContact: 1, Phone: 1,
  Type: 1, Category: 1, stage: 1, importBatch: 1, Evidence: 1,
  dedupReason: 1, bulkMoveReason: 1,
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const batch = searchParams.get('batch') || '';
    const q = (searchParams.get('q') || '').trim();
    const country = searchParams.get('country') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    await dbConnect();

    // 배치를 고르지 않았으면 배치 목록만 (어디에 뭐가 있는지 먼저 보여준다)
    if (!batch) {
      const batches = await Lead.aggregate([
        { $match: { ...NOT_AI, ...NOT_DELETED } },
        {
          $group: {
            _id: '$importBatch',
            total: { $sum: 1 },
            // 실제 주소 형태인 것만 센다 (위 REAL_EMAIL 주석 참고)
            // 실제로 보낼 수 있는 곳 = 주소 형태 + 중복/오염 제외
            withEmail: {
              $sum: { $cond: [{ $and: [
                { $regexMatch: { input: { $ifNull: ['$Email', ''] }, regex: /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/ } },
                { $eq: [{ $type: '$dupHiddenAt' }, 'missing'] },
                { $eq: [{ $type: '$badEmailAt' }, 'missing'] },
              ] }, 1, 0] },
            },
            archived: { $sum: { $cond: [{ $eq: ['$stage', 'archived'] }, 1, 0] } },
            live: {
              $sum: {
                $cond: [
                  { $in: ['$stage', ['verified', 'queued', 'contacted', 'replied', 'negotiating', 'partner']] },
                  1, 0,
                ],
              },
            },
          },
        },
        { $match: { total: { $gte: 3 } } },   // 테스트로 한두 건 들어간 배치는 잡음이다
        { $sort: { total: -1 } },
      ]);
      return NextResponse.json({ success: true, mode: 'batches', batches });
    }

    // 배치 안의 리드 목록. 이메일 없는 건은 보내지 못하므로 기본에서 뺀다.
    const query: any = { ...NOT_AI, ...NOT_DELETED, importBatch: batch, ...REAL_EMAIL, ...NOT_HIDDEN };
    if (country) query.Country = country;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ Company: rx }, { Email: rx }, { WebsiteContact: rx }];
    }

    const [items, total, countries] = await Promise.all([
      Lead.find(query, LIST_PROJECTION).sort({ Country: 1, Company: 1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      Lead.countDocuments(query),
      Lead.aggregate([
        { $match: { ...NOT_AI, ...NOT_DELETED, importBatch: batch, ...REAL_EMAIL, ...NOT_HIDDEN } },
        { $group: { _id: '$Country', n: { $sum: 1 } } },
        { $sort: { n: -1 } }, { $limit: 30 },
      ]),
    ]);

    return NextResponse.json({ success: true, mode: 'leads', items, total, page, limit, countries });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}

/**
 * POST /api/leads/legacy — 고른 리드를 발송대기로 되살린다.
 * Body: { leadIds: string[] }
 *
 * 사람이 직접 고른 것이므로 승인(readyForOutreach)까지 같이 준다.
 * 되돌릴 수 있게 이전 stage 를 남긴다.
 */
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 });
  }

  const ids: string[] = Array.isArray(body?.leadIds) ? body.leadIds : [];
  if (!ids.length) {
    return NextResponse.json({ success: false, error: 'leadIds 필요' }, { status: 400 });
  }

  try {
    await dbConnect();
    const now = new Date();

    // 주소가 아닌 값("Contact form on site" 등)이 섞여 들어오면
    // 발송대기에 보낼 수 없는 채로 쌓였다가 전부 발송 실패한다.
    const targets = await Lead.find(
      { leadId: { $in: ids }, ...REAL_EMAIL, ...NOT_HIDDEN },
      { leadId: 1, stage: 1 },
    ).lean();

    const ops = targets.map((t: any) => ({
      updateOne: {
        filter: { leadId: t.leadId },
        update: {
          $set: {
            stage: 'verified',
            stageChangedAt: now.toISOString(),
            readyForOutreach: true,     // 사람이 직접 고른 것 = 승인
            restoredFrom: t.stage,      // 되돌리기용
            restoredAt: now,
          },
        },
      },
    }));

    if (!ops.length) {
      return NextResponse.json(
        { success: false, error: '이동할 수 있는 리드가 없습니다 (실제 이메일 주소가 있는 건만 옮길 수 있습니다)' },
        { status: 400 },
      );
    }

    const r = await Lead.bulkWrite(ops);
    const verified = await Lead.countDocuments({ stage: 'verified' });

    return NextResponse.json({
      success: true,
      moved: r.modifiedCount,
      skipped: ids.length - ops.length,
      verified,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '이동 실패' }, { status: 500 });
  }
}
