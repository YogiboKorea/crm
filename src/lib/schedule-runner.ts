import { OUTBOUND_LOCKED, OUTBOUND_LOCK_MESSAGE, canSendTo, TEST_RECIPIENTS } from './outbound-lock';
import { EmailTemplate } from '@/models/EmailTemplate';
import { Lead } from '@/models/Lead';
import { MailAccount } from '@/models/MailAccount';
import { sendMail, renderTemplate } from './mailer';
import { buildVarsFromLead, buildSignatureBlock } from './template-vars';
import { decryptSecret } from './crypto';
import { checkSendGuard } from './send-limits';

/**
 * 단일 예약 항목을 실제로 발송 · Lead.emailHistory 기록 · stage 전이 (verified→contacted)
 * cron 워커와 "즉시 발송" 액션에서 재사용.
 */
export async function processScheduleItem(doc: any) {
  const now = new Date();

  const tpl: any = await EmailTemplate.findById(doc.templateId).lean();
  if (!tpl) {
    doc.status = 'failed'; doc.lastError = 'template not found'; doc.attempts += 1;
    await doc.save();
    return { ok: false, error: 'template not found' };
  }

  const lead: any = await Lead.findOne({ leadId: doc.leadId }).lean();
  if (!lead) {
    doc.status = 'failed'; doc.lastError = 'lead not found'; doc.attempts += 1;
    await doc.save();
    return { ok: false, error: 'lead not found' };
  }

  // 발송 시점 재확인 — 예약 등록 후 시각까지 사이에 이미 여러 번 발송되었을 수 있음
  const guard = checkSendGuard({ emailHistory: lead.emailHistory, lastEmailSentAt: lead.lastEmailSentAt });
  if (!guard.ok) {
    doc.status = 'failed';
    doc.lastError = `발송 가드: ${guard.reason}`;
    doc.attempts += 1;
    await doc.save();
    return { ok: false, error: doc.lastError };
  }

  let smtpConfig: any = undefined;
  let fromOverride: any = undefined;
  let accProfile: any = null;
  if (doc.mailAccountId) {
    const acc = await MailAccount.findById(doc.mailAccountId);
    if (acc && acc.isActive) {
      try {
        smtpConfig = {
          host: acc.smtpHost, port: acc.smtpPort, secure: acc.smtpSecure,
          user: acc.smtpUser, pass: decryptSecret(acc.smtpPassEnc),
        };
        fromOverride = { name: acc.fromName || acc.smtpUser, address: acc.fromAddress };
        accProfile = acc.toObject();
      } catch (e: any) {
        doc.status = 'failed'; doc.lastError = `계정 복호화 실패: ${e?.message || 'unknown'}`; doc.attempts += 1;
        await doc.save();
        return { ok: false, error: doc.lastError };
      }
    }
  }

  const vars = buildVarsFromLead(lead);
  const renderedSubject = renderTemplate(tpl.subject, vars);
  let renderedBody = renderTemplate(tpl.body, vars);
  const appendSig = tpl.appendAccountSignature !== false;
  const sig = accProfile && appendSig ? buildSignatureBlock(accProfile, { html: !!tpl.bodyIsHtml }) : '';
  if (sig) renderedBody = renderedBody + sig;

  const fontFamily = 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif';
  const fontSize = 15;
  let htmlPayload: string | undefined;
  let textPayload: string | undefined;
  if (tpl.bodyIsHtml) {
    const bodyHtml = renderedBody.includes('<') ? renderedBody : renderedBody.replace(/\n/g, '<br>');
    htmlPayload = `<div style="font-family:${fontFamily};font-size:${fontSize}px;line-height:1.65;color:#111827">${bodyHtml}</div>`;
    textPayload = renderedBody.replace(/<[^>]+>/g, '');
  } else {
    textPayload = renderedBody;
  }

  // ⚠️ 예약 발송은 /api/mail/send 를 거치지 않는다. 그 라우트의 차단 스위치만
  //    믿으면 예약 시각이 됐을 때 그대로 나가버린다 (실제로 그런 구멍이 있었다).
  // 잠금 중에도 테스트 주소로는 나가게 둔다 — 예약 → 발송 → 수신까지
  // 실제로 돌려봐야 하기 때문이다. 그 외 주소는 그대로 막는다.
  if (!canSendTo(doc.to)) {
    console.log(`[schedule:LOCKED] 발송 차단 → to=${doc.to} subject=${renderedSubject.slice(0, 60)}`);
    return {
      ok: false,
      error: OUTBOUND_LOCKED
        ? `발송 잠금 중 — 지금은 ${TEST_RECIPIENTS.join(', ')} 로만 나갑니다`
        : OUTBOUND_LOCK_MESSAGE,
    };
  }

  const dryRun = process.env.MAIL_DRY_RUN === '1';
  let result: any;
  if (dryRun) {
    console.log(`[schedule:DRY_RUN] to=${doc.to} subject=${renderedSubject.slice(0, 60)}`);
    result = { ok: true, dryRun: true, messageId: `dryrun-sched-${Date.now()}` };
  } else {
    result = await sendMail({
      to: doc.to,
      subject: renderedSubject,
      html: htmlPayload,
      text: textPayload,
      smtpConfig,
      fromOverride,
    });
  }

  doc.attempts += 1;
  if (result.ok) {
    doc.status = 'sent';
    doc.sentAt = now;
    doc.lastError = '';
    await doc.save();

    const historyItem: any = {
      subject: renderedSubject,
      body: renderedBody.slice(0, 500),
      templateId: doc.templateId,
      to: doc.to,
      sentAt: now.toISOString(),
      scheduledFor: doc.scheduledFor.toISOString(),
      // DRY_RUN 은 실제로 나가지 않았다. 이걸 'sent' 로 남기면 발송 횟수
      // 3회 한도가 테스트만으로 소진되고, 화면에도 "보낸 곳"으로 뜬다.
      status: dryRun ? 'scheduled' : 'sent',
      // 답장 매칭 열쇠 — 상대 답장의 In-Reply-To 가 이 값을 가리킨다 (match-lead.ts)
      messageId: result.messageId || '',
    };
    const setUpdate: any = { lastEmailSentAt: now.toISOString() };
    if (!dryRun && lead.stage !== 'contacted' && lead.stage !== 'replied' && lead.stage !== 'negotiating' && lead.stage !== 'partner') {
      setUpdate.stage = 'contacted';
      setUpdate.stageChangedAt = now.toISOString();
    }
    await Lead.updateOne(
      { leadId: doc.leadId },
      { $push: { emailHistory: historyItem }, $set: setUpdate },
    );
    return { ok: true, messageId: result.messageId, dryRun: !!result.dryRun };
  } else {
    doc.status = 'failed';
    doc.lastError = result.error || 'unknown';
    await doc.save();
    await Lead.updateOne(
      { leadId: doc.leadId },
      {
        $push: {
          emailHistory: {
            subject: renderedSubject,
            templateId: doc.templateId,
            to: doc.to,
            sentAt: now.toISOString(),
            scheduledFor: doc.scheduledFor.toISOString(),
            status: 'failed',
            error: result.error || 'unknown',
          },
        },
      },
    );
    return { ok: false, error: result.error };
  }
}
