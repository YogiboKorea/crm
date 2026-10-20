import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { InboundMail } from '@/models/InboundMail';
import { Lead } from '@/models/Lead';
import { getMailScope, mailFilter, UNAUTHORIZED } from '@/lib/mail/scope';
import { listMailAccounts } from '@/lib/mail/accounts';

export const runtime = 'nodejs';

/**
 * GET /api/mail/contacts?q=dang — [✏ 메일 쓰기] 받는 사람 자동 완성 (2026-10-20, 대표님 요청).
 *
 * "그동안 주고받은 업체 주소가 몇 글자만 쳐도 뜨게" — 주소 일부(lcl@, dangaard)나 이름·회사명으로 찾는다.
 *
 * 어디서 찾나:
 *   · 내 메일함에서 **주고받은 메일** — 받은 메일의 보낸 사람·참조, 보낸 메일의 받는 사람·참조
 *   · 등록된 업체(리드)의 대표 주소 — 아직 메일을 안 주고받은 곳도 업체 이름으로 찾을 수 있게
 * 순서: 자주·최근에 주고받은 주소가 위로.
 *
 * 남의 메일함은 뒤지지 않는다 (lib/mail/scope.ts) — 자동 완성으로 다른 사람의 거래처가 드러나면 안 된다.
 */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const scope = await getMailScope();
    if (!scope) return NextResponse.json(UNAUTHORIZED, { status: 401 });

    const q = String(new URL(req.url).searchParams.get('q') || '').trim().slice(0, 60);
    if (q.length < 2) return NextResponse.json({ success: true, contacts: [] });
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // 내 보내는 주소는 빼고 보여준다 — 나에게 보내려고 자동 완성을 쓰는 일은 없다
    const mine = new Set((await listMailAccounts(scope.user)).map((a: any) => String(a.smtpUser || a.fromAddress || '').toLowerCase()));

    // 주고받은 메일에서 — 칸마다 따로 찾아 한 줄로 모은다
    const pick = async (field: 'from' | 'to' | 'cc') => {
      const path = field === 'from' ? '$from' : `$${field}`;
      return InboundMail.aggregate([
        { $match: { ...mailFilter(scope), trashedAt: null, $or: [{ [`${field}.address`]: rx }, { [`${field}.name`]: rx }] } },
        { $sort: { date: -1 } },
        { $limit: 1500 },
        ...(field === 'from' ? [] : [{ $unwind: path }]),
        { $project: { address: { $toLower: `${path}.address` }, name: `${path}.name`, date: 1 } },
        { $match: { $or: [{ address: rx }, { name: rx }] } },
        { $group: { _id: '$address', name: { $first: '$name' }, count: { $sum: 1 }, last: { $max: '$date' } } },
      ]);
    };
    const groups = (await Promise.all([pick('from'), pick('to'), pick('cc')])).flat();

    const byAddr = new Map<string, { address: string; name: string; count: number; last: Date | null; company: string }>();
    for (const g of groups) {
      const address = String(g._id || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(address) || mine.has(address)) continue;
      const cur = byAddr.get(address);
      if (cur) {
        cur.count += g.count;
        if (g.last && (!cur.last || g.last > cur.last)) cur.last = g.last;
        if (!cur.name && g.name) cur.name = g.name;
      } else {
        byAddr.set(address, { address, name: String(g.name || '').trim(), count: g.count, last: g.last || null, company: '' });
      }
    }

    // 등록 업체 — 회사 이름으로 찾기 + 위 주소에 회사 이름 붙이기
    const leads: any[] = await Lead.find(
      { deleted: { $ne: true }, Email: { $regex: '@' }, $or: [{ Company: rx }, { Email: rx }] },
      { Company: 1, Email: 1 },
    ).limit(8).lean();
    for (const l of leads) {
      const address = String(l.Email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(address) || mine.has(address)) continue;
      const cur = byAddr.get(address);
      if (cur) cur.company = l.Company || '';
      else byAddr.set(address, { address, name: '', count: 0, last: null, company: l.Company || '' });
    }

    const contacts = Array.from(byAddr.values())
      .sort((a, b) => (b.count - a.count) || ((b.last?.getTime() || 0) - (a.last?.getTime() || 0)))
      .slice(0, 8)
      .map((c) => ({ ...c, last: c.last ? new Date(c.last).toISOString() : null }));

    return NextResponse.json({ success: true, contacts });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '주소를 찾지 못했습니다' }, { status: 500 });
  }
}
