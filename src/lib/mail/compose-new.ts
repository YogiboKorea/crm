import { Lead } from '@/models/Lead';
import { resolveOutreachAccount } from './accounts';
import { buildSignatureBlock } from '@/lib/template-vars';
import type { MailScope } from './scope';

/**
 * **새 메일 한 통을 조립한다** — 받은 메일함 위 [✏ 새 메일 쓰기] (2026-09-17, 대표님 요청).
 *
 * ── 왜 필요한가 ──
 * 지금까지 이 앱에서 메일이 나가는 길은 둘뿐이었다: 업체 여러 곳에 양식으로 보내는 [발송 관리] 와,
 * 받은 메일에 대한 [답장]. 주소를 직접 적어 새로 한 통 쓰려면 아웃룩으로 나가야 했다.
 * 그런데 아웃룩에서 보내면 이카운트 보낸메일함에 사본이 안 남는 문제가 그대로 남는다
 * (대표님이 "보냈는데 보낸 메일함에 안 뜬다" 고 하신 바로 그 문제). 여기서 쓰면 사본이 반드시 남는다.
 *
 * ── 조립과 발송을 나눈 이유 ──
 * 미리보기(POST /api/mail/compose/preview)와 실제 발송(POST /api/mail/compose)이 **같은 함수**를 쓴다.
 * 따로 만들면 "미리보기엔 이렇게 보였는데 실제로는 다르게 나갔다" 가 된다 (답장도 같은 방식 — compose-reply.ts).
 *
 * 여기서는 메일을 보내지 않고 DB 에도 쓰지 않는다.
 */

/** 사람이 실제로 받을 수 있는 주소인가 — 화면·서버가 같은 기준을 쓴다 */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

export interface NewMailInput {
  to?: string;
  subject?: string;
  body?: string;
  bodyIsHtml?: boolean;
  mailAccountId?: string;
  appendSignature?: boolean;
}

export interface ComposedNewMail {
  account: any;
  to: string;
  subject: string;
  from: { name: string; address: string };
  html: string;
  text: string;
  /** 본문 원문 (업체 발송 이력에 남길 용도) */
  bodySource: string;
  signatureAppended: boolean;
  /** 받는 주소가 등록된 업체와 같으면 그 업체 — 보낸 뒤 대화 이력에 붙는다 */
  lead: { leadId: string; company: string; stage: string } | null;
}

export type ComposeNewResult =
  | { ok: true; mail: ComposedNewMail }
  | { ok: false; status: number; payload: { success: false; error: string } };

const fail = (status: number, error: string): ComposeNewResult => ({ ok: false, status, payload: { success: false, error } });

export async function composeNewMail(scope: MailScope, input: NewMailInput): Promise<ComposeNewResult> {
  const to = String(input?.to || '').trim();
  const subject = String(input?.subject || '').trim();
  const source = String(input?.body || '').trim();

  if (!to) return fail(400, '받는 사람을 입력하세요');
  if (!EMAIL_RE.test(to)) return fail(400, `받는 사람 주소가 올바르지 않습니다: ${to}`);
  if (!subject) return fail(400, '제목을 입력하세요');
  if (!source) return fail(400, '본문이 비어 있습니다');

  // 보내는 계정은 **내가 등록한 것만** — 남의 계정으로는 보낼 수 없다 (lib/mail/scope.ts 와 같은 규칙)
  const { account } = await resolveOutreachAccount(input?.mailAccountId ? String(input.mailAccountId) : undefined, scope.user);
  if (!account) {
    return fail(400, input?.mailAccountId
      ? '고른 보내는 계정을 쓸 수 없습니다'
      : '보낼 메일 계정이 없습니다. [📬 메일 계정 관리]에서 등록하세요.');
  }

  const appendSignature = input?.appendSignature !== false;
  const sigHtml = appendSignature ? buildSignatureBlock(account, { html: true }) : '';
  const sigText = appendSignature ? buildSignatureBlock(account, { html: false }) : '';

  // 서식 편집기로 쓴 본문은 이미 HTML 이다. 평문이면 줄바꿈이 살아 있도록 감싼다 (답장과 같은 규칙).
  const bodyIsHtml = input?.bodyIsHtml === true;
  const inner = bodyIsHtml ? source : `<div style="white-space:pre-wrap">${escapeHtml(source)}</div>`;
  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${inner}</div>${sigHtml}`;
  const plain = bodyIsHtml
    ? source.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, '').trim()
    : source;

  // 받는 주소가 등록된 업체면 알려 준다 — 보낸 뒤 그 업체 대화 이력에 붙이고, 미리보기에도 이름을 보여준다
  let lead: ComposedNewMail['lead'] = null;
  try {
    const hit: any = await Lead.findOne(
      { Email: new RegExp(`^${to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), deleted: { $ne: true } },
      { leadId: 1, Company: 1, stage: 1 },
    ).lean();
    if (hit) lead = { leadId: hit.leadId, company: hit.Company || '', stage: hit.stage || '' };
  } catch { /* 업체를 못 찾아도 메일은 보낼 수 있다 */ }

  return {
    ok: true,
    mail: {
      account,
      to,
      subject,
      from: { name: account.fromName || '', address: account.fromAddress || account.smtpUser },
      html,
      text: sigText ? `${plain}\n\n${sigText}` : plain,
      bodySource: source,
      signatureAppended: Boolean(sigHtml),
      lead,
    },
  };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
