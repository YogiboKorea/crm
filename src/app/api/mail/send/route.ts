import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { EmailTemplate } from '@/models/EmailTemplate';
import { sendMail, renderTemplate } from '@/lib/mailer';
import { buildVarsFromLead } from '@/lib/template-vars';

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

  const subjectSrc = explicitSubject ?? tpl?.subject ?? '';
  const bodySrc = explicitBody ?? tpl?.body ?? '';

  // 대상 리드 로드
  const leads = await Lead.find({ leadId: { $in: leadIds } }).lean() as any[];

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

    // 변수 치환
    const vars = buildVarsFromLead(lead);
    const renderedSubject = renderTemplate(subjectSrc, vars);
    const renderedBody = renderTemplate(bodySrc, vars);

    // HTML 모드일 때 폰트 wrapping — 인라인 스타일이 이메일 클라이언트에서 가장 안전
    let htmlPayload: string | undefined;
    let textPayload: string | undefined;
    if (bodyIsHtml) {
      // 개행 → <br> 자동 변환 (사용자가 순수 텍스트로 입력해도 HTML 출력)
      const bodyHtml = renderedBody.includes('<') ? renderedBody : renderedBody.replace(/\n/g, '<br>');
      htmlPayload = `<div style="font-family:${fontFamily};font-size:${fontSize}px;line-height:1.65;color:#111827">${bodyHtml}</div>`;
      // 텍스트 fallback (스팸 필터 회피)
      textPayload = renderedBody.replace(/<[^>]+>/g, '');
    } else {
      textPayload = renderedBody;
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
      });
    }

    if (result.ok) {
      sent++;
      results.push({ leadId: lead.leadId, ok: true, messageId: result.messageId, dryRun });
      // emailHistory 추가
      historyOps.push({
        updateOne: {
          filter: { leadId: lead.leadId },
          update: {
            $push: {
              emailHistory: {
                subject: renderedSubject,
                body: renderedBody.slice(0, 500),  // 요약
                templateId: templateId || '',
                to,
                sentAt: now,
                status: dryRun ? 'sent' : 'sent',
              },
            },
            $set: {
              lastEmailSentAt: now,
            },
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
    results,
  });
}
