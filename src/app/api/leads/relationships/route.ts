import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { InboundMail } from '@/models/InboundMail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/leads/relationships?stage=partner|negotiating|replied
 *
 * 거래가 살아 있는 회사들을 카드로 보여주기 위한 요약.
 *
 * 왜 목록 API 를 그냥 쓰지 않는가:
 * 파트너십 화면에서 알고 싶은 것은 "이 회사와 어디까지 갔나" 다.
 * 그건 Lead 문서 안에 없다 — 주고받은 통수는 InboundMail 과 emailHistory 에
 * 흩어져 있고, 마지막으로 말이 오간 날도 둘 중 늦은 쪽이다.
 * 카드마다 따로 조회하면 5곳이면 15번을 부르게 되므로 여기서 한 번에 엮는다.
 */

/** 이 회사가 지금 우리 쪽 답을 기다리고 있나 */
const NEEDS_REPLY = {
  'analysis.needsReply': true,
  status: { $in: ['new', 'reviewing'] },
  trashedAt: null,
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get('stage') || 'partner';
    const q = (searchParams.get('q') || '').trim();

    await dbConnect();

    const filter: any = { stage, deleted: { $ne: true } };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ Company: rx }, { Country: rx }, { Email: rx }, { BuyerContact: rx }];
    }

    const leads: any[] = await Lead.find(filter, {
      leadId: 1, Company: 1, Country: 1, Email: 1, Phone: 1, WebsiteContact: 1,
      BuyerContact: 1, Title: 1, Type: 1, TypeKo: 1, Category: 1,
      BrandsChannels: 1, notes: 1, stage: 1, stageChangedAt: 1,
      lastContact: 1, nextFollowUp: 1, owner: 1,
      emailHistory: 1, addedManually: 1, createdAt: 1,
    }).lean();

    if (!leads.length) {
      return NextResponse.json({ success: true, items: [], stage });
    }

    const ids = leads.map((l) => l.leadId);

    // 받은 메일 — 회사별 통수 · 마지막 수신 · 답해야 할 건수를 한 번에
    const inAgg: any[] = await InboundMail.aggregate([
      { $match: { leadId: { $in: ids }, trashedAt: null } },
      {
        $group: {
          _id: '$leadId',
          inCount: { $sum: 1 },
          lastIn: { $max: '$date' },
          firstIn: { $min: '$date' },
          needsReply: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$analysis.needsReply', true] },
                  { $in: ['$status', ['new', 'reviewing']] },
                ] },
                1, 0,
              ],
            },
          },
        },
      },
    ]);
    const inBy = new Map(inAgg.map((r) => [r._id, r]));

    // 아직 답하지 않았고 기한이 남은 것 중 가장 이른 것
    const dlAgg: any[] = await InboundMail.aggregate([
      {
        $match: {
          leadId: { $in: ids },
          ...NEEDS_REPLY,
          'analysis.deadline': { $ne: null, $gte: new Date() },
        },
      },
      { $group: { _id: '$leadId', nearest: { $min: '$analysis.deadline' } } },
    ]);
    const dlBy = new Map(dlAgg.map((r) => [r._id, r.nearest]));

    const items = leads.map((l) => {
      const inb = inBy.get(l.leadId) || {};
      const sent = (l.emailHistory || []).filter((h: any) => h?.status === 'sent');
      const lastOut = sent.length ? sent[sent.length - 1].sentAt : null;

      // 마지막으로 말이 오간 날 — 보낸 것과 받은 것 중 늦은 쪽
      const times = [inb.lastIn, lastOut].filter(Boolean).map((d: any) => new Date(d).getTime());
      const lastTouch = times.length ? new Date(Math.max(...times)) : null;

      // 처음 연결된 날 — 받은 것 중 가장 이른 것, 없으면 등록일
      const firstTimes = [inb.firstIn, sent.length ? sent[0].sentAt : null]
        .filter(Boolean).map((d: any) => new Date(d).getTime());
      const firstTouch = firstTimes.length ? new Date(Math.min(...firstTimes)) : (l.createdAt || null);

      return {
        leadId: l.leadId,
        Company: l.Company || '',
        Country: l.Country || '',
        Email: l.Email || '',
        Phone: l.Phone || '',
        WebsiteContact: l.WebsiteContact || '',
        BuyerContact: l.BuyerContact || '',
        Title: l.Title || '',
        Type: l.TypeKo || l.Type || '',
        Category: l.Category || '',
        BrandsChannels: l.BrandsChannels || '',
        notes: l.notes || '',
        owner: l.owner || '',
        stage: l.stage,
        stageChangedAt: l.stageChangedAt || '',
        addedManually: !!l.addedManually,
        // 진행 상황
        inCount: inb.inCount || 0,
        outCount: sent.length,
        total: (inb.inCount || 0) + sent.length,
        needsReply: inb.needsReply || 0,
        lastTouch,
        firstTouch,
        nearestDeadline: dlBy.get(l.leadId) || null,
      };
    });

    // 답할 것이 있는 곳을 먼저, 그다음 최근에 말이 오간 순
    items.sort((a, b) =>
      (b.needsReply - a.needsReply)
      || (new Date(b.lastTouch || 0).getTime() - new Date(a.lastTouch || 0).getTime()));

    return NextResponse.json({
      success: true,
      stage,
      items,
      summary: {
        count: items.length,
        needsReply: items.filter((i) => i.needsReply > 0).length,
        totalMails: items.reduce((a, i) => a + i.total, 0),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}
