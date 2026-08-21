import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { EmailTemplate } from '@/models/EmailTemplate';
import { MailAccount } from '@/models/MailAccount';
import { sendMail, renderTemplate } from '@/lib/mailer';
import { buildVarsFromLead, buildSignatureBlock } from '@/lib/template-vars';
import { decryptSecret } from '@/lib/crypto';
import { checkSendGuard } from '@/lib/send-limits';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/mail/send
 * B2B 메일 벌크/개별 발송. 각 리드마다 템플릿 변수 치환 → SMTP 발송 → emailHistory 기록.
 *
 * Body:
 *   leadIds: string[]              (leadId 배열 — 1건 이상)
 *   templateId?: string            (템플릿 ID · body/subject 없을 때 필수)
 *   subject?: string               (템플릿 없이 커스텀 발송)
 *   body?: string                  (템플릿 없이 커스텀 발송)
 *   bodyIsHtml?: boolean           (기본 true — 폰트 적용 위해)
 *   fontFamily?: string            (예: 'Pretendard', 'Arial', ...)
 *   fontSize?: number              (px)
 *   dryRun?: boolean               (true면 서버 DRY_RUN 관계없이 무조건 로그만)
 *
 * 응답:
 *   { success, requested, sent, failed, dryRun, results: [{leadId, ok, messageId?, error?}] }
 */
export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}

  const leadIds: string[] = Array.isArray(body.leadIds) ? body.leadIds : [];
  if (!leadIds.length) {
    return NextResponse.json({ success: false, error: 'leadIds 필수' }, { status: 400 });
  }

  const templateId: string | undefined = body.templateId;
  const explicitSubject: string | undefined = body.subject;
  const explicitBody: string | undefined = body.body;
  const bodyIsHtml: boolean = body.bodyIsHtml !== false;   // default true
  const fontFamily: string = body.fontFamily || 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif';
  const fontSize: number = Math.min(24, Math.max(10, Number(body.fontSize) || 15));
  const forceDryRun: boolean = body.dryRun === true;
  const mailAccountId: string | undefined = body.mailAccountId;

  if (!templateId && (!explicitSubject || !explicitBody)) {
    return NextResponse.json({ success: false, error: 'templateId 또는 subject+body 필요' }, { status: 400 });
  }

  await dbConnect();

  // 템플릿 로드
  let tpl: any = null;
  if (templateId) {
    tpl = await EmailTemplate.findById(templateId).lean();
    if (!tpl) return NextResponse.json({ success: false, error: 'template not found' }, { status: 404 });
  }

  // ── 발송 계정 로드 (mailAccountId 지정 시) ──
  // 미지정 시 default 계정 또는 env fallback (하위 호환)
  let smtpConfig: any = undefined;
  let fromOverride: any = undefined;
  let usedAccount: any = null;
  if (mailAccountId) {
    const acc = await MailAccount.findById(mailAccountId);
    if (!acc || !acc.isActive) {
      return NextResponse.json({ success: false, error: '지정된 발송 계정이 없거나 비활성' }, { status: 400 });
    }
    try {
      smtpConfig = {
        host: acc.smtpHost, port: acc.smtpPort, secure: acc.smtpSecure,
        user: acc.smtpUser, pass: decryptSecret(acc.smtpPassEnc),
      };
      fromOverride = { name: acc.fromName || acc.smtpUser, address: acc.fromAddress };
      usedAccount = { id: String(acc._id), user: acc.smtpUser, from: acc.fromAddress };
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `계정 복호화 실패: ${e?.message}` }, { status: 500 });
    }
  }

  const subjectSrc = explicitSubject ?? tpl?.subject ?? '';
  const bodySrc = explicitBody ?? tpl?.body ?? '';

  // 대상 리드 로드
  const leads = await Lead.find({ leadId: { $in: leadIds } }).lean() as any[];

  // 선택된 메일 계정 프로필 로드 → 서명 블록 자동 생성용 (본문에 발송자 변수 불필요)
  const accProfile = usedAccount ? await MailAccount.findById(usedAccount.id).lean() as any : null;
  const appendSignature = tpl?.appendAccountSignature !== false;   // 템플릿 없으면 기본 true
  const sigHtml  = accProfile && appendSignature ? buildSignatureBlock(accProfile, { html: true })  : '';
  const sigText  = accProfile && appendSignature ? buildSignatureBlock(accProfile, { html: false }) : '';

  const now = new Date().toISOString();
  const results: any[] = [];
  let sent = 0;
  let failed = 0;
  const historyOps: any[] = [];

  for (const lead of leads) {
    // 이메일 없으면 스킵
    const to = (lead.Email || '').trim();
    if (!to || /^Not found/i.test(to) || !/@/.test(to)) {
      results.push({ leadId: lead.leadId, ok: false, error: 'no valid email' });
      failed++;
      continue;
    }

    // 과도 발송 방지 (리드당 MAX 회 · 최소 간격) · body.force=true 면 우회 (수동 override)
    if (body.force !== true) {
      const guard = checkSendGuard({
        emailHistory: lead.emailHistory,
        lastEmailSentAt: lead.lastEmailSentAt,
      });
      if (!guard.ok) {
        results.push({ leadId: lead.leadId, ok: false, error: guard.reason, sentCount: guard.sentCount });
        failed++;
        continue;
      }
    }

    // 변수 치환 (받는사람/회사명만 · 발송자는 서명으로)
    const vars = buildVarsFromLead(lead);
    const renderedSubject = renderTemplate(subjectSrc, vars);
    const renderedBody = renderTemplate(bodySrc, vars);

    // HTML 모드일 때 폰트 wrapping + 서명 블록 자동 추가
    let htmlPayload: string | undefined;
    let textPayload: string | undefined;
    if (bodyIsHtml) {
      const bodyHtml = renderedBody.includes('<') ? renderedBody : renderedBody.replace(/\n/g, '<br>');
      htmlPayload = `<div style="font-family:${fontFamily};font-size:${fontSize}px;line-height:1.65;color:#111827">${bodyHtml}${sigHtml}</div>`;
      textPayload = renderedBody.replace(/<[^>]+>/g, '') + sigText;
    } else {
      textPayload = renderedBody + sigText;
    }

    // 발송 (또는 DRY_RUN)
    const dryRunEnv = process.env.MAIL_DRY_RUN === '1';
    const dryRun = forceDryRun || dryRunEnv;

    let result;
    if (dryRun) {
      console.log(`[mail:send:DRY_RUN] to=${to} subject=${renderedSubject.slice(0, 60)}`);
      result = { ok: true, dryRun: true, messageId: `dryrun-${Date.now()}-${lead.leadId}` };
    } else {
      result = await sendMail({
        to,
        subject: renderedSubject,
        html: htmlPayload,
        text: textPayload,
        smtpConfig,
        fromOverride,
      });
    }

    if (result.ok) {
      sent++;
      results.push({ leadId: lead.leadId, ok: true, messageId: result.messageId, dryRun });
      // emailHistory 추가 + 성공 시 stage → 'contacted' 자동 이동
      // (DRY_RUN 은 실제 발송 아님 → stage 변경 안 함)
      const setUpdate: any = { lastEmailSentAt: now };
      if (!dryRun && lead.stage !== 'contacted' && lead.stage !== 'replied' && lead.stage !== 'negotiating' && lead.stage !== 'partner') {
        setUpdate.stage = 'contacted';
        setUpdate.stageChangedAt = now;
      }
      historyOps.push({
        updateOne: {
          filter: { leadId: lead.leadId },
          update: {
            $push: {
              emailHistory: {
                subject: renderedSubject,
                body: renderedBody.slice(0, 500),
                templateId: templateId || '',
                to,
                sentAt: now,
                status: 'sent',
              },
            },
            $set: setUpdate,
          },
        },
      });
    } else {
      failed++;
      results.push({ leadId: lead.leadId, ok: false, error: result.error });
      historyOps.push({
        updateOne: {
          filter: { leadId: lead.leadId },
          update: {
            $push: {
              emailHistory: {
                subject: renderedSubject,
                templateId: templateId || '',
                to,
                sentAt: now,
                status: 'failed',
                error: result.error || 'unknown',
              },
            },
          },
        },
      });
    }
  }

  if (historyOps.length > 0) {
    await Lead.bulkWrite(historyOps, { ordered: false });
  }

  return NextResponse.json({
    success: true,
    requested: leads.length,
    sent,
    failed,
    dryRun: forceDryRun || process.env.MAIL_DRY_RUN === '1',
    usedAccount,
    results,
  });
}
