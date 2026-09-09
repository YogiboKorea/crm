import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { InboundMail } from '@/models/InboundMail';

export const runtime = 'nodejs';

/**
 * GET /api/mail/inbox — 수신 메일함 목록 (스레드 단위로 접어서)
 *
 * 쿼리:
 *   classification=b2b,inquiry   분류 필터 (콤마 구분)
 *   status=new,reviewing         상태 필터
 *   needsReply=1                 답변 필요만
 *   linked=1 | 0                 리드 연결된 것만 / 연결 안 된 것만
 *   q=검색어                     제목·발신·요약 검색
 *   page=1&limit=50
 *   flat=1                       스레드로 접지 않고 낱개로
 *
 * 답장이 20번 오간 건이 20줄로 늘어나면 "이 건이 어디까지 왔나"를 볼 수 없다.
 * 기본은 대화당 한 줄 + 오간 통수 배지 (emailData 설계 그대로).
 */

// 목록에 본문(raw)을 실으면 문서당 평균 71KB — 200통이면 14MB 를 읽고 메모리 정렬한다.
// 실측으로 한 요청이 10~40초까지 걸렸던 부분이라 반드시 제외한다.
const LIST_PROJECTION = {
  raw: 0,
  bodyStripped: 0,
  drafts: 0,
  'analysis.usage': 0,
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;
    const flat = searchParams.get('flat') === '1';

    const classification = searchParams.get('classification');
    const status = searchParams.get('status');
    const needsReply = searchParams.get('needsReply');
    const linked = searchParams.get('linked');
    const leadId = searchParams.get('leadId');
    const q = searchParams.get('q');
    const accountId = searchParams.get('accountId');

    await dbConnect();

    const query: any = {};

    // 휴지통은 기본 목록에서 제외 (DB 에서 지우지 않으므로 언제든 되짚을 수 있다)
    query.trashedAt = searchParams.get('trashed') === '1' ? { $ne: null } : null;

    // 어느 메일함을 볼지. 'all' 이거나 미지정이면 전체.
    // 계정 개념이 생기기 전 메일은 accountId='main' 으로 저장돼 있다.
    if (accountId && accountId !== 'all') query.accountId = accountId;

    // 거래처(폴더) 필터 — '__none__' 은 아직 분류 안 된 것
    const group = searchParams.get('group');
    if (group === '__none__') query.group = { $in: [null, ''] };
    else if (group) query.group = group;

    if (classification) query.classification = { $in: classification.split(',') };
    if (status) query.status = { $in: status.split(',') };
    if (needsReply === '1') query['analysis.needsReply'] = true;
    if (leadId) query.leadId = leadId;
    else if (linked === '1') query.leadId = { $nin: ['', null] };
    else if (linked === '0') query.$or = [{ leadId: '' }, { leadId: { $exists: false } }];

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const search = [
        { subject: rx }, { 'from.address': rx }, { 'from.name': rx },
        { 'analysis.summary': rx }, { 'analysis.topic': rx },
      ];
      // linked=0 이 이미 $or 를 쓰고 있으면 $and 로 합친다
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: search }];
        delete query.$or;
      } else {
        query.$or = search;
      }
    }

    // ── 낱개 목록 ──
    if (flat || leadId) {
      const [items, total] = await Promise.all([
        InboundMail.find(query, LIST_PROJECTION).sort({ date: -1 }).skip(skip).limit(limit).lean(),
        InboundMail.countDocuments(query),
      ]);
      return NextResponse.json({ success: true, items, total, page, limit, mode: 'flat' });
    }

    // ── 스레드 단위 ──
    const pipeline: any[] = [
      { $match: query },
      // 본문을 먼저 걷어낸다. raw 를 안고 정렬하면 32MB 정렬 한도를 넘는다.
      { $project: { raw: 0, bodyStripped: 0, drafts: 0, 'analysis.usage': 0 } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: { $ifNull: ['$threadKey', { $toString: '$_id' }] },
          latest: { $first: '$$ROOT' },
          count: { $sum: 1 },
          firstDate: { $min: '$date' },
          // 아직 안 지난 기한 중 가장 이른 것.
          // 스레드 최소값을 그냥 쓰면 몇 달 전 끝난 기한이 계속 D-day 로 뜨고,
          // 최신 메일만 보면 두 통 전의 기한을 놓친다.
          nearestDeadline: {
            $min: {
              $cond: [{ $gte: ['$analysis.deadline', '$$NOW'] }, '$analysis.deadline', null],
            },
          },
        },
      },
      { $sort: { 'latest.date': -1 } },
      {
        $facet: {
          rows: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'n' }],
        },
      },
    ];

    const [res] = await InboundMail.aggregate(pipeline, { allowDiskUse: true });
    const rows = res?.rows || [];

    return NextResponse.json({
      success: true,
      mode: 'thread',
      items: rows.map((r: any) => ({
        ...r.latest,
        threadKey: r._id,
        threadCount: r.count,
        threadFirstDate: r.firstDate,
        threadDeadline: r.nearestDeadline || null,
      })),
      total: res?.total?.[0]?.n || 0,
      page,
      limit,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}
