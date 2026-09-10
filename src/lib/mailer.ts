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

/* ═══════════════════════════════════════════════════════════════════
   🚫 전역 발송 차단 — 지금은 이 앱에서 메일이 한 통도 나가지 않는다.

   여기(가장 아래 계층)에 둔 이유:
   sendMail 을 부르는 곳이 6군데다 — 벌크 발송, 예약 발송(schedule-runner),
   답장(mail/reply), 브리핑, 크론, 테스트. 위쪽 한 곳만 막으면 예약이나
   크론으로 조용히 나갈 수 있다. 여기서 막으면 전부 걸린다.

   env(MAIL_DRY_RUN)만 쓰지 않은 이유:
   Next.js 는 .env.local 을 서버가 뜰 때 한 번만 읽는다. 파일만 고치면
   이미 떠 있는 서버에는 반영되지 않아 "껐다고 생각했는데 나가는" 일이
   생긴다. 코드 상수는 저장 즉시 hot reload 로 먹는다.

   ── 지금 상태: false (여기서는 막지 않는다) ──
   대량 발송은 lib/outbound-lock.ts 의 OUTBOUND_LOCKED 가 막고 있다.
   여기까지 켜면 받은 메일 답장(mail/reply)까지 막혀서, 진행 중인 거래처에
   답을 못 하게 된다. 막아야 할 것은 "먼저 보내는 콜드메일 400통"이지
   "상대가 보낸 메일에 답하는 것"이 아니다.

   ⚠️ 대량 발송을 다시 열 때(OUTBOUND_LOCKED=false) 반드시 먼저 할 것:
      하루 발송 상한과 발송 간격 넣기. 현재 발송 루프에는 둘 다 없어
      400통이 한 번에 나간다. yogico.kr 로 실거래 메일도 나가므로
      스팸 판정을 받으면 그 메일들까지 상대 스팸함으로 간다.

   전부 막아야 할 일이 생기면 아래를 true 로 (저장 즉시 먹는다).
   ═══════════════════════════════════════════════════════════════════ */
export const GLOBAL_SEND_BLOCKED = false;

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  if (GLOBAL_SEND_BLOCKED) {
    console.log('[mailer:BLOCKED] 발송 차단됨 →', input.to, '·', input.subject);
    return { ok: false, error: '메일 발송이 차단되어 있습니다 (mailer.ts · GLOBAL_SEND_BLOCKED)' };
  }
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
 * 템플릿 변수 치환.
 * - `{{Company}}` 스타일 (개발자용 · 기존 호환)
 * - `[회사명]` 한글 마커 (비개발자 친화 · 새 방식)
 * 재귀/조건문 없음 — 단순 문자열 치환.
 */
const KO_ALIAS_TO_KEY: Record<string, string> = {
  '회사명': 'Company',
  '상대회사': 'Company',
  '상대 회사명': 'Company',
  '받는사람': 'BuyerContact',
  '담당자': 'BuyerContact',
  '담당자 이름': 'BuyerContact',
  '담당자 직함': 'Title',
  '담당자 이메일': 'Email',
  '담당자 전화번호': 'Phone',
  '국가': 'Country',
};

export function renderTemplate(source: string, vars: Record<string, string | undefined>): string {
  // 1. {{Key}} 형식
  let out = source.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => {
    return vars[key] != null ? String(vars[key]) : `{{${key}}}`;
  });
  // 2. [한글마커] 형식
  out = out.replace(/\[([^\[\]\n]+?)\]/g, (m, label) => {
    const key = KO_ALIAS_TO_KEY[label.trim()];
    if (!key) return m;   // 정의 안 된 마커는 그대로 (일반 대괄호 텍스트 훼손 방지)
    return vars[key] != null ? String(vars[key]) : m;
  });
  return out;
}
