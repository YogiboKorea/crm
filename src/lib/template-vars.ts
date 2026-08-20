import type { ILead } from '@/models/Lead';

/**
 * 템플릿에서 사용 가능한 변수 정의.
 * key = {{key}} 로 템플릿에 삽입 · label = 에디터 UI 에 표시할 한글 라벨.
 * example = 미리보기용 폴백 값.
 */
export type TemplateVarGroup = 'recipient' | 'company';

export interface TemplateVar {
  key: string;
  label: string;                  // 사람 친화 한글 라벨
  example: string;                // 미리보기 폴백
  description: string;            // 비개발자 설명 (툴팁/카드 서브텍스트)
  group: TemplateVarGroup;        // 팔레트 그룹핑
  fromLead: (lead: Partial<ILead>) => string;
}

export const TEMPLATE_VAR_GROUPS: Array<{ key: TemplateVarGroup; label: string; icon: string; color: string }> = [
  { key: 'recipient', label: '받는 사람', icon: '👤', color: '#0ea5e9' },
  { key: 'company',   label: '상대 회사', icon: '🏢', color: '#8b5cf6' },
];

export const TEMPLATE_VARS: TemplateVar[] = [
  // ── 받는 사람 ─────────────────────────
  {
    key: 'BuyerContact',
    label: '받는사람 이름',
    example: 'John Smith',
    description: '메일 수신자 이름 · 각 리드마다 다름 (없으면 "Sir/Madam" 자동 대체)',
    group: 'recipient',
    fromLead: (l) => l.BuyerContact || 'Sir/Madam',
  },
  {
    key: 'Title',
    label: '받는사람 직함',
    example: 'Head of Buying',
    description: '수신자 직책 · 예: Buying Manager, Head of Sourcing',
    group: 'recipient',
    fromLead: (l) => l.Title || '',
  },
  {
    key: 'Email',
    label: '받는사람 이메일',
    example: 'buyer@sephora.com',
    description: '수신자 이메일 · 각 리드의 컨택 이메일. 발송할 때 실제 To 주소로 사용',
    group: 'recipient',
    fromLead: (l) => l.Email || '',
  },
  {
    key: 'Phone',
    label: '받는사람 전화번호',
    example: '+1-555-0100',
    description: '수신자 연락처 (알고 있는 경우에만)',
    group: 'recipient',
    fromLead: (l) => l.Phone || '',
  },
  // ── 상대 회사 (최소화) ─────────────────────────
  {
    key: 'Company',
    label: '상대 회사명',
    example: 'Acme Beauty Co.',
    description: '수신자 회사 이름 · 인사말에 자주 사용 (예: "Dear Acme Beauty Co. Team")',
    group: 'company',
    fromLead: (l) => l.Company || '',
  },
  // 발송자 정보 (내 이름/직함/전화/이메일/회사) 는 더 이상 본문 변수로 삽입하지 않음.
  // 발송 시 선택한 메일 계정의 "서명 블록" 이 자동으로 본문 끝에 붙음 (appendAccountSignature=true 기본).
];

/**
 * Lead 객체 → 변수 dict.
 * 발송자 정보(SenderName, SenderCompany 등)는 env 나 별도 옵션에서.
 */
export function buildVarsFromLead(
  lead: Partial<ILead>,
  extras?: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of TEMPLATE_VARS) {
    out[v.key] = v.fromLead(lead);
  }
  // 발송자 정보는 서명 블록으로 자동 처리되므로 여기서 안 넣음.
  // extras 는 유지 (기존 커스텀 변수 넣을 여지)
  Object.assign(out, extras || {});
  return out;
}

/**
 * 예시 변수 (템플릿 미리보기 - 리드 미지정 시).
 */
export function buildExampleVars(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of TEMPLATE_VARS) {
    out[v.key] = v.example;
  }
  return out;
}

/**
 * 발송자 서명 블록 (HTML/텍스트) — 선택한 메일 계정 정보로 자동 생성.
 * template.appendAccountSignature=true 일 때 본문 끝에 붙여서 발송.
 * 사용자는 본문에 발송자 정보를 쓸 필요 없음.
 */
export interface SenderProfile {
  fromName?: string;
  fromAddress?: string;
  senderTitle?: string;
  senderPhone?: string;
  senderCompany?: string;
  senderAddress?: string;
  senderWebsite?: string;
}

/**
 * 발송자 서명 블록 · Yogi Corporation 스타일
 *   [담당자 이름]
 *   [직함]
 *
 *   [회사명]
 *   A: [주소]
 *   M: [전화번호]
 *      [웹사이트]
 */
export function buildSignatureBlock(
  sender: SenderProfile,
  opts: { html: boolean } = { html: true },
): string {
  const name    = (sender.fromName || '').trim();
  const title   = (sender.senderTitle || '').trim();
  const company = (sender.senderCompany || '').trim();
  const email   = (sender.fromAddress || '').trim();
  const phone   = (sender.senderPhone || '').trim();
  const address = (sender.senderAddress || '').trim();
  const website = (sender.senderWebsite || '').trim();
  if (!name && !title && !company && !email && !phone && !address && !website) return '';

  const normalizeUrl = (u: string) => /^https?:\/\//i.test(u) ? u : `http://${u}`;

  if (opts.html) {
    const bits: string[] = [];
    if (name) bits.push(`<div style="margin:2px 0;font-weight:600">${escapeHtml(name)}</div>`);
    if (title) bits.push(`<div style="margin:2px 0;color:#4b5563">${escapeHtml(title)}</div>`);
    if (name || title) bits.push(`<div style="height:10px"></div>`);
    if (company) bits.push(`<div style="margin:2px 0;font-weight:700">${escapeHtml(company)}</div>`);
    if (address) bits.push(`<div style="margin:2px 0;color:#4b5563">A: ${escapeHtml(address)}</div>`);
    if (phone)   bits.push(`<div style="margin:2px 0;color:#4b5563">M: ${escapeHtml(phone)}</div>`);
    if (website) bits.push(`<div style="margin:2px 0;color:#4b5563">&nbsp;&nbsp;&nbsp;<a href="${escapeHtml(normalizeUrl(website))}" style="color:#2563eb;text-decoration:none">${escapeHtml(website)}</a></div>`);
    if (email && !address && !phone && !website) {
      bits.push(`<div style="margin:2px 0;color:#4b5563">E: <a href="mailto:${escapeHtml(email)}" style="color:#2563eb;text-decoration:none">${escapeHtml(email)}</a></div>`);
    }
    return `
<div style="margin-top:20px;padding-top:14px;border-top:1px solid #e5e7eb;font-family:inherit;font-size:13px;color:#111827">
  ${bits.join('\n  ')}
</div>`.trim();
  }
  // plain text
  const lines: string[] = [];
  if (name) lines.push(name);
  if (title) lines.push(title);
  if (name || title) lines.push('');
  if (company) lines.push(company);
  if (address) lines.push(`A: ${address}`);
  if (phone) lines.push(`M: ${phone}`);
  if (website) lines.push(`   ${website}`);
  if (email && !address && !phone && !website) lines.push(`E: ${email}`);
  return '\n\n---\n' + lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
