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

/**
 * 받는 사람·참조·숨은참조를 합쳐 이만큼까지 (2026-10-20).
 * 이 창은 사람이 직접 쓰는 메일이라 하루 발송 한도(send-limits)를 거치지 않는다.
 * 한도 없이 두면 수백 명을 숨은참조로 넣어 사실상 대량 발송이 되고, 그러면 yogico.kr 이
 * 스팸으로 찍혀 실거래 메일까지 상대 스팸함으로 간다. 여러 곳에 같은 글을 보낼 때는 [발송 관리]를 쓴다.
 */
export const MAX_COMPOSE_RECIPIENTS = 20;

/**
 * 업체 메일 칸(Lead.Email)에서 보낼 주소 **하나**만 꺼낸다 — 묶음 발송·예약·자동 재발송이 같이 쓴다 (2026-10-20).
 * "Sales <a@b.com>" · "a@b.com; c@d.com" · "a@b.com (영업)" 처럼 적힌 값을 그대로 받는 사람에 넣으면
 * 메일 서버가 거절하거나 여러 곳에 한꺼번에 나간다. 첫 주소만 쓰고, 없으면 '' 이다.
 */
export function leadMailAddress(raw: unknown): string {
  const s = String(raw || '').trim();
  if (!s || /^Not found/i.test(s)) return '';
  const m = s.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : '';
}

/**
 * "a@x.com, b@y.com; 홍길동 <c@z.com>" 같은 입력을 주소 목록으로 바꾼다.
 * 쉼표·세미콜론·줄바꿈으로 나눈다. 아웃룩에서 복사해 온 "이름 <주소>" 도 받는다.
 */
export function parseAddressList(input: unknown): { list: string[]; bad: string[] } {
  const raw = Array.isArray(input) ? input.join(',') : String(input ?? '');
  const list: string[] = [];
  const bad: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const s = part.trim();
    if (!s) continue;
    const m = s.match(/<([^<>\s]+)>\s*$/);
    const addr = (m ? m[1] : s).trim().replace(/^mailto:/i, '');
    if (!EMAIL_RE.test(addr)) { bad.push(s); continue; }
    if (!list.some((x) => x.toLowerCase() === addr.toLowerCase())) list.push(addr);
  }
  return { list, bad };
}

/**
 * 받는 사람·참조·숨은참조를 한꺼번에 다듬는다 — [✏ 메일 쓰기] 와 [↩ 답장] 이 같은 규칙을 쓴다 (2026-10-20).
 *   · 틀린 주소가 하나라도 있으면 거절 (어느 주소인지 알려 준다)
 *   · 받는 사람에 있는 주소가 참조·숨은참조에 또 있으면 한 번만 — 받는 쪽에 같은 메일이 두 통 가지 않게
 *   · 합쳐 MAX_COMPOSE_RECIPIENTS 명까지
 */
export function normalizeRecipients(input: { to?: unknown; cc?: unknown; bcc?: unknown }):
  { ok: true; to: string[]; cc: string[]; bcc: string[] } | { ok: false; error: string } {
  const T = parseAddressList(input?.to);
  const C = parseAddressList(input?.cc);
  const B = parseAddressList(input?.bcc);
  const wrong = [...T.bad, ...C.bad, ...B.bad];
  if (wrong.length) return { ok: false, error: `주소가 올바르지 않습니다: ${wrong.slice(0, 3).join(', ')}` };
  if (!T.list.length) return { ok: false, error: '받는 사람을 입력하세요' };
  const seen = new Set(T.list.map((a) => a.toLowerCase()));
  const notYet = (list: string[]) => list.filter((a) => {
    const k = a.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const cc = notYet(C.list);
  const bcc = notYet(B.list);
  const count = T.list.length + cc.length + bcc.length;
  if (count > MAX_COMPOSE_RECIPIENTS) {
    return { ok: false, error: `받는 사람·참조·숨은참조를 합쳐 ${MAX_COMPOSE_RECIPIENTS}명까지 보낼 수 있습니다 (지금 ${count}명). 여러 업체에 같은 글을 보낼 때는 [발송 관리]를 쓰세요.` };
  }
  return { ok: true, to: T.list, cc, bcc };
}

export interface NewMailInput {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  body?: string;
  bodyIsHtml?: boolean;
  mailAccountId?: string;
  appendSignature?: boolean;
}

export interface ComposedNewMail {
  account: any;
  /** 받는 사람 첫 주소 (예전 호출자 호환 · 업체 찾기 기준) */
  to: string;
  toList: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  from: { name: string; address: string };
  html: string;
  text: string;
  /** 본문 원문 (업체 발송 이력에 남길 용도) */
  bodySource: string;
  signatureAppended: boolean;
  /** 받는 주소가 등록된 업체와 같으면 그 업체 — 보낸 뒤 대화 이력에 붙는다 (첫 번째 업체) */
  lead: { leadId: string; company: string; stage: string } | null;
  /** 받는 사람·참조 중 등록된 업체 전부 — 각 업체 대화 이력에 남긴다 */
  leads: Array<{ leadId: string; company: string; stage: string; email: string }>;
}

export type ComposeNewResult =
  | { ok: true; mail: ComposedNewMail }
  | { ok: false; status: number; payload: { success: false; error: string } };

const fail = (status: number, error: string): ComposeNewResult => ({ ok: false, status, payload: { success: false, error } });

export async function composeNewMail(scope: MailScope, input: NewMailInput): Promise<ComposeNewResult> {
  const subject = String(input?.subject || '').trim();
  const source = String(input?.body || '').trim();

  const R = normalizeRecipients(input);
  if (!R.ok) return fail(400, R.error);
  const T = { list: R.to };
  const { cc, bcc } = R;
  const to = T.list[0];
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

  // 받는 사람·참조 주소가 등록된 업체면 알려 준다 — 보낸 뒤 그 업체 대화 이력에 붙이고, 미리보기에도 이름을 보여준다.
  // 숨은참조는 넣지 않는다 — 그 업체 대화 이력에 "숨겨서 보낸 메일" 이 드러나면 안 된다.
  const leads: ComposedNewMail['leads'] = [];
  try {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const addrs = [...T.list, ...cc];
    const hits: any[] = await Lead.find(
      { Email: { $in: addrs.map((a) => new RegExp(`^${esc(a)}$`, 'i')) }, deleted: { $ne: true } },
      { leadId: 1, Company: 1, stage: 1, Email: 1 },
    ).limit(MAX_COMPOSE_RECIPIENTS).lean();
    for (const a of addrs) {
      const h = hits.find((x) => String(x.Email || '').toLowerCase() === a.toLowerCase());
      if (h && !leads.some((l) => l.leadId === h.leadId)) {
        leads.push({ leadId: h.leadId, company: h.Company || '', stage: h.stage || '', email: a });
      }
    }
  } catch { /* 업체를 못 찾아도 메일은 보낼 수 있다 */ }
  const lead = leads[0] ? { leadId: leads[0].leadId, company: leads[0].company, stage: leads[0].stage } : null;

  return {
    ok: true,
    mail: {
      account,
      to,
      toList: T.list,
      cc,
      bcc,
      subject,
      from: { name: account.fromName || '', address: account.fromAddress || account.smtpUser },
      html,
      text: sigText ? `${plain}\n\n${sigText}` : plain,
      bodySource: source,
      signatureAppended: Boolean(sigHtml),
      lead,
      leads,
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
