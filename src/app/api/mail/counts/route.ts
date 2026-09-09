import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { InboundMail } from '@/models/InboundMail';
import { countSince, COUNT_PERIOD_LABEL, COUNT_PERIOD_DAYS } from '@/lib/mail/period';

export const runtime = 'nodejs';

/**
 * GET /api/mail/counts — 사이드바 "메일함" 배지용 카운트.
 *
 * 목록 API 를 다시 호출하지 않고 숫자만 가볍게 가져온다.
 * 광고·자동발송은 배지에서 제외한다 — 사람이 볼 것만 세어야 숫자가 의미를 갖는다.
 */
export async function GET(req: Request) {
  try {
    await dbConnect();

    // as const 로 리터럴 고정 — string[] 로 추론되면 classification union 타입과 맞지 않는다
    const NOISE = ['ad', 'system', 'newsletter'] as const;

    // 메일함에서 계정을 고르면 배지도 그 계정 기준으로 센다
    const accountId = new URL(req.url).searchParams.get('accountId');
    const acc = accountId && accountId !== 'all' ? { accountId } : {};

    // 화면 숫자는 최근 2개월 기준. 기간을 두지 않으면 1년치가 전부 잡혀
    // "밀린 일이 산더미"로 읽히고, 매일 늘어나는 몇 건이 그 안에 묻힌다.
    const since = { date: { $gte: countSince() } };

    const [inbox, needsReply, unlinked, total, deadlines, trash] = await Promise.all([
      // 받은 메일함 배지 — 광고 제외한 수신 메일
      InboundMail.countDocuments({
        ...acc, ...since,
        trashedAt: null,
        direction: 'in',
        classification: { $nin: NOISE },
      }),
      // 회신 필요 — 상대가 질문·요청을 보냈고 아직 처리 안 된 것
      InboundMail.countDocuments({
        ...acc, ...since,
        trashedAt: null,
        direction: 'in',
        classification: { $nin: NOISE },
        'analysis.needsReply': true,
        status: { $in: ['new', 'reviewing'] },
      }),
      // 리드에 연결되지 않은 메일 (우리가 보낸 적 없는 곳에서 온 것)
      InboundMail.countDocuments({
        ...acc, ...since,
        trashedAt: null,
        direction: 'in',
        classification: { $nin: NOISE },
        $or: [{ leadId: '' }, { leadId: { $exists: false } }],
      }),
      InboundMail.countDocuments({ ...acc }),
      // 기한이 잡혔고 아직 답하지 않은 것 — 처리한 건이 D-day 로 남으면 안 된다
      InboundMail.countDocuments({
        ...acc, ...since,
        trashedAt: null,
        direction: 'in',
        classification: { $nin: NOISE },
        'analysis.deadline': { $ne: null },
        status: { $nin: ['replied', 'archived', 'ignored'] },
      }),
      // 휴지통 — 여기는 기간을 걸지 않는다. 배지는 "되돌릴 게 남아 있나"를
      // 알리는 용도라, 두 달 지났다고 숫자에서 사라지면 오분류를 영영 못 찾는다.
      InboundMail.countDocuments({ ...acc, trashedAt: { $ne: null } }),
    ]);

    return NextResponse.json({
      success: true,
      counts: { inbox, needsReply, unlinked, total, deadlines, trash },
      period: { days: COUNT_PERIOD_DAYS, label: COUNT_PERIOD_LABEL },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}
