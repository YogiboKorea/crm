import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { buildBriefing, renderBriefingHtml } from '@/lib/mail/briefing';
import { getMailSettings } from '@/lib/mail-settings';
import { MailAccount } from '@/models/MailAccount';
import { sendMail } from '@/lib/mailer';
import { decryptSecret } from '@/lib/crypto';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** GET /api/mail/briefing — 화면에서 보는 브리핑 (발송 없음) */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const days = Math.min(7, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '1')));
    const briefing = await buildBriefing(days);
    return NextResponse.json({ success: true, briefing });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}

/**
 * POST /api/mail/briefing — 브리핑을 메일로 발송.
 *
 * 새 소식이 없는 날은 보내지 않는다 — 빈 메일이 매일 오면 열어보지 않게 된다.
 * Body: { days?: number, to?: string, force?: boolean }
 */
export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* 본문 없이도 동작 */ }

  try {
    await dbConnect();
    const settings = await getMailSettings();
    const days = Math.min(7, Math.max(1, Number(body?.days) || Number(settings.briefingDays) || 1));
    const to = String(body?.to || settings.briefingEmail || '').trim();

    if (!to) {
      return NextResponse.json({
        success: false,
        error: '브리핑 받을 주소가 없습니다. 메일 수신 설정에서 지정하세요.',
      }, { status: 400 });
    }

    const briefing = await buildBriefing(days);

    // 보낼 게 없으면 보내지 않는다 (force 로 강제 가능)
    const hasContent = briefing.needsReply.length || briefing.deadlinesSoon.length || briefing.newReplies.length;
    if (!hasContent && body?.force !== true) {
      return NextResponse.json({
        success: true, skipped: true,
        reason: '새 소식이 없어 발송하지 않았습니다.',
        briefing,
      });
    }

    const account: any = await MailAccount.findOne({ isDefault: true, isActive: true }).lean()
      || await MailAccount.findOne({ isActive: true }).lean();
    if (!account) {
      return NextResponse.json({ success: false, error: '발송할 메일 계정이 없습니다.' }, { status: 400 });
    }

    const html = renderBriefingHtml(briefing, process.env.APP_BASE_URL || '');
    const dateLabel = new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
    const subject = `[Yogico] 오늘의 브리핑 ${dateLabel} · 회신필요 ${briefing.totals.needsReply}건`
      + (briefing.newReplies.length ? ` · 새 답장 ${briefing.newReplies.length}건` : '');

    const result = await sendMail({
      to,
      subject,
      html,
      smtpConfig: {
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        user: account.smtpUser,
        pass: decryptSecret(account.smtpPassEnc),
      },
      fromOverride: { name: account.fromName || 'Yogico CRM', address: account.fromAddress || account.smtpUser },
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || '발송 실패' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      to, subject,
      dryRun: Boolean(result.dryRun),
      counts: {
        needsReply: briefing.needsReply.length,
        deadlines: briefing.deadlinesSoon.length,
        newReplies: briefing.newReplies.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '브리핑 실패' }, { status: 500 });
  }
}
