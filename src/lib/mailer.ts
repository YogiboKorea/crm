import nodemailer from 'nodemailer';

/**
 * B2B 아웃바운드 이메일 전송기.
 * emailData 프로젝트의 이카운트 SMTP 설정을 그대로 재사용.
 *
 * 필요 env (Vercel Settings → Environment Variables):
 *   SMTP_HOST=wsmtp.ecount.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=true
 *   SMTP_USER=david@yogico.kr
 *   SMTP_PASS=****
 *   MAIL_FROM_NAME=요기보
 *   MAIL_FROM_ADDRESS=david@yogico.kr        (SMTP_USER와 같아도 OK)
 *   MAIL_DRY_RUN=0                            (1이면 실제 발송 안 함 = 개발/테스트용)
 */

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE !== 'false';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP 환경변수 누락 — SMTP_HOST, SMTP_USER, SMTP_PASS 설정 필요. ' +
      '.env.local 또는 Vercel Settings → Environment Variables 확인.',
    );
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return cachedTransporter;
}

export interface SendMailInput {
  to: string;                 // 수신자
  subject: string;
  html?: string;              // HTML 본문 (bodyIsHtml=true일 때)
  text?: string;              // 텍스트 본문
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  dryRun?: boolean;
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const dryRun = process.env.MAIL_DRY_RUN === '1';
  if (dryRun) {
    console.log('[mailer:DRY_RUN]', input.to, '·', input.subject);
    return { ok: true, dryRun: true, messageId: `dryrun-${Date.now()}` };
  }

  const fromName = process.env.MAIL_FROM_NAME || 'Yogico';
  const fromAddress =
    process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER;
  if (!fromAddress) {
    return { ok: false, error: 'MAIL_FROM_ADDRESS/SMTP_USER 누락' };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      headers: input.headers,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'unknown SMTP error' };
  }
}

/**
 * 템플릿 변수 치환. {{Company}} 같은 플레이스홀더를 lead 값으로 교체.
 * 재귀/조건문 없음 — 단순 문자열 치환만.
 */
export function renderTemplate(source: string, vars: Record<string, string | undefined>): string {
  return source.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => {
    return vars[key] != null ? String(vars[key]) : `{{${key}}}`;
  });
}
