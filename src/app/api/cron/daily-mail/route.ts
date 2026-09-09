import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { runIngest } from '@/lib/mail/ingest';
import { buildBriefing, renderBriefingHtml } from '@/lib/mail/briefing';
import { getMailSettings } from '@/lib/mail-settings';
import { MailAccount } from '@/models/MailAccount';
import { sendMail } from '@/lib/mailer';
import { decryptSecret } from '@/lib/crypto';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/cron/daily-mail — 매일 1회 도는 메일 파이프라인.
 *
 *   1. 수집    등록된 모든 계정 · 지정 폴더               무료
 *   2. 분류    광고·자동발송 규칙 필터                    무료
 *   3. 거래처  폴더 → 발신자 이력 → 제목                  무료
 *   4. 매칭    답장을 리드에 연결 · stage 자동 이동        무료
 *   5. 브리핑  회신 필요·기한을 대표 메일로               무료
 *
 * AI 분석(유료)은 여기서 돌리지 않는다 — 크론이 매일 자동 과금하면
 * 비용을 통제할 수 없다. 화면에서 금액을 보고 눌러야 나간다.
 *
 * ⚠️ 수집이 실패해도 브리핑은 계속한다 — 메일 서버가 잠깐 죽었다고
 *    이미 받아둔 건의 브리핑까지 걸러지면 안 된다 (emailData 설계).
 *
 * /api/cron 은 proxy.ts 인증 화이트리스트라 CRON_SECRET 으로 직접 막는다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (process.env.CRON_SECRET && key !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: '인증 실패' }, { status: 401 });
  }

  const report: any = { startedAt: new Date().toISOString(), steps: {} };

  await dbConnect();

  // ── 1~4. 수집 (실패해도 브리핑은 계속) ──
  try {
    const r = await runIngest({ accountId: 'all' });
    report.steps.ingest = {
      fetched: r.fetched, inserted: r.inserted, duplicate: r.duplicate,
      ruleFiltered: r.ruleFiltered, grouped: r.grouped,
      matched: r.matched, movedToReplied: r.movedToReplied,
      errors: r.errors,
    };
  } catch (e: any) {
    report.steps.ingest = { error: String(e?.message || e) };
  }

  // ── 5. 브리핑 ──
  try {
    const settings = await getMailSettings();
    const days = Number(settings.briefingDays) || 1;
    const briefing = await buildBriefing(days);
    const to = String(settings.briefingEmail || '').trim();

    const hasContent = briefing.needsReply.length || briefing.deadlinesSoon.length || briefing.newReplies.length;

    if (!to) {
      report.steps.briefing = { skipped: '받을 주소 미설정', counts: briefing.totals };
    } else if (!hasContent) {
      // 새 소식이 없는 날은 보내지 않는다 — 빈 메일이 매일 오면 열어보지 않게 된다
      report.steps.briefing = { skipped: '새 소식 없음', counts: briefing.totals };
    } else {
      const account: any = await MailAccount.findOne({ isDefault: true, isActive: true }).lean()
        || await MailAccount.findOne({ isActive: true }).lean();
      if (!account) {
        report.steps.briefing = { error: '발송 계정 없음' };
      } else {
        const dateLabel = new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
        const result = await sendMail({
          to,
          subject: `[Yogico] 오늘의 브리핑 ${dateLabel} · 회신필요 ${briefing.totals.needsReply}건`
            + (briefing.newReplies.length ? ` · 새 답장 ${briefing.newReplies.length}건` : ''),
          html: renderBriefingHtml(briefing, process.env.APP_BASE_URL || ''),
          smtpConfig: {
            host: account.smtpHost, port: account.smtpPort, secure: account.smtpSecure,
            user: account.smtpUser, pass: decryptSecret(account.smtpPassEnc),
          },
          fromOverride: { name: account.fromName || 'Yogico CRM', address: account.fromAddress || account.smtpUser },
        });
        report.steps.briefing = result.ok
          ? { sent: true, to, dryRun: Boolean(result.dryRun), counts: briefing.totals }
          : { error: result.error };
      }
    }
  } catch (e: any) {
    report.steps.briefing = { error: String(e?.message || e) };
  }

  report.finishedAt = new Date().toISOString();
  return NextResponse.json({ success: true, ...report });
}
