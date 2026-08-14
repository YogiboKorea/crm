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
  // ── 특정 MailAccount 로 발송 시 아래 3개 전달 (없으면 env 기본) ──
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;               // 이미 복호화된 평문 (호출자가 복호화 책임)
  };
  fromOverride?: { name: string; address: string };
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  dryRun?: boolean;
}

/**
 * SMTP 연결/인증 만 확인 (실제 발송 없음, DRY_RUN 무시).
 * transporter.verify() 는 EHLO+AUTH 까지 수행하므로 비번 오류/포트 방화벽 즉시 검출.
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string; host?: string; port?: number; user?: string }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { ok: false, error: 'SMTP_HOST/SMTP_USER/SMTP_PASS 미설정' };
  }
  try {
    const t = getTransporter();
    await t.verify();
    return { ok: true, host, port, user };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'unknown SMTP error', host, port, user };
  }
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const dryRun = process.env.MAIL_DRY_RUN === '1';
  if (dryRun) {
    console.log('[mailer:DRY_RUN]', input.to, '·', input.subject, input.smtpConfig ? `(via ${input.smtpConfig.user})` : '');
    return { ok: true, dryRun: true, messageId: `dryrun-${Date.now()}` };
  }

  // 특정 계정 자격증명이 전달됐으면 그걸로 임시 transporter 생성
  // (캐시하지 않음 — 계정별 독립 · 매 발송마다 새로. 대량 발송이면 향후 계정별 캐시 검토)
  let transporterToUse;
  if (input.smtpConfig) {
    transporterToUse = nodemailer.createTransport({
      host: input.smtpConfig.host,
      port: input.smtpConfig.port,
      secure: input.smtpConfig.secure,
      auth: { user: input.smtpConfig.user, pass: input.smtpConfig.pass },
    });
  }

  const fromName = input.fromOverride?.name || process.env.MAIL_FROM_NAME || 'Yogico';
  const fromAddress =
    input.fromOverride?.address || process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER;
  if (!fromAddress) {
    return { ok: false, error: 'MAIL_FROM_ADDRESS/SMTP_USER 누락' };
  }

  try {
    const transporter = transporterToUse || getTransporter();
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
