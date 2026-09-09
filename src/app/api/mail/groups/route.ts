import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { listGroups, learnSenderGroups, suggestGroupBySender, suggestGroupByName } from '@/lib/mail/groups';
import { InboundMail } from '@/models/InboundMail';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET /api/mail/groups — 거래처 목록.
 *
 * 대표가 메일함에서 폴더로 나눠둔 분류가 그대로 거래처가 된다.
 * 숫자는 **최근 한 달** 기준 — 누적을 쓰면 큰 수가 떠서 "밀린 일이 산더미"로
 * 읽히고, 매일 늘어나는 몇 건이 그 안에 묻힌다.
 */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const accountId = new URL(req.url).searchParams.get('accountId') || undefined;
    const result = await listGroups(accountId);

    // 거래처가 안 붙은 메일 수 — 재분류 대상이 얼마나 되는지 보여준다
    const match: any = { group: { $in: [null, ''] }, direction: 'in', trashedAt: null };
    if (accountId && accountId !== 'all') match.accountId = accountId;
    const ungrouped = await InboundMail.countDocuments(match);

    return NextResponse.json({ success: true, ...result, ungrouped });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}

/**
 * POST /api/mail/groups — 거래처 재분류 (무과금).
 *
 * 폴더로 분류된 메일에서 "이 발신자는 이 거래처" 를 배워,
 * 아직 거래처가 안 붙은 메일에 소급 적용한다. AI 를 쓰지 않으므로 비용이 없다.
 *
 * 폴더를 새로 수집한 뒤 돌리면 분류율이 올라간다.
 */
export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* 본문 없이도 동작 */ }

  try {
    await dbConnect();

    const learned = await learnSenderGroups();
    const { groups } = await listGroups();
    const knownGroups = groups.map((g) => g.group).filter(Boolean);

    const match: any = {
      group: { $in: [null, ''] },
      direction: 'in',
      trashedAt: null,
    };
    if (body?.accountId && body.accountId !== 'all') match.accountId = body.accountId;

    const targets: any[] = await InboundMail.find(match, {
      _id: 1, subject: 1, from: 1,
    }).limit(Number(body?.limit) || 2000).lean();

    let bySender = 0;
    let byName = 0;
    const ops: any[] = [];

    for (const m of targets) {
      const s = suggestGroupBySender({ from: m.from }, learned);
      const n = s ? null : suggestGroupByName({ subject: m.subject }, knownGroups);
      const hit = s || n;
      if (!hit) continue;
      if (s) bySender++; else byName++;

      ops.push({
        updateOne: {
          filter: { _id: m._id },
          update: {
            $set: {
              group: hit.group,
              groupBy: (hit as any).by === 'name'
                ? `name:${(hit as any).matched}`
                : `sender:${(hit as any).by}`,
            },
          },
        },
      });
    }

    for (let i = 0; i < ops.length; i += 500) {
      await InboundMail.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }

    return NextResponse.json({
      success: true,
      scanned: targets.length,
      classified: ops.length,
      bySender,
      byName,
      learnedSenders: learned.size,
      knownGroups: knownGroups.length,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '재분류 실패' }, { status: 500 });
  }
}
