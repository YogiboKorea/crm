import { EmailTemplate } from '@/models/EmailTemplate';
import { Lead } from '@/models/Lead';
import { MailAccount } from '@/models/MailAccount';
import { sendMail, renderTemplate } from './mailer';
import { buildVarsFromLead, buildSignatureBlock } from './template-vars';
import { decryptSecret } from './crypto';

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
      status: 'sent',
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
