import type { ILead } from '@/models/Lead';

/**
 * 템플릿에서 사용 가능한 변수 정의.
 * key = {{key}} 로 템플릿에 삽입 · label = 에디터 UI 에 표시할 한글 라벨.
 * example = 미리보기용 폴백 값.
 */
export type TemplateVarGroup = 'recipient' | 'company' | 'sender';

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
  { key: 'sender',    label: '발송자 정보', icon: '✉',  color: '#059669' },
];

export const TEMPLATE_VARS: TemplateVar[] = [
  // ── 받는 사람 ─────────────────────────
  {
    key: 'BuyerContact',
    label: '담당자 이름',
    example: 'John Smith',
    description: '메일 받는 사람 이름 (없으면 "Sir/Madam" 자동 대체)',
    group: 'recipient',
    fromLead: (l) => l.BuyerContact || 'Sir/Madam',
  },
  {
    key: 'Title',
    label: '담당자 직함',
    example: 'Head of Buying',
    description: '담당자의 직책/직함 (예: Buying Manager, Head of Sourcing)',
    group: 'recipient',
    fromLead: (l) => l.Title || '',
  },
  {
    key: 'Email',
    label: '담당자 이메일',
    example: 'partnerships@acmebeauty.com',
    description: '받는 사람 이메일 주소 (본문 서명 등에 표시할 때 사용)',
    group: 'recipient',
    fromLead: (l) => l.Email || '',
  },
  {
    key: 'Phone',
    label: '담당자 전화번호',
    example: '+1-555-0100',
    description: '담당자 연락처 (알고 있는 경우에만)',
    group: 'recipient',
    fromLead: (l) => l.Phone || '',
  },
  // ── 상대 회사 ─────────────────────────
  {
    key: 'Company',
    label: '회사명',
    example: 'Acme Beauty Co.',
    description: '상대 회사 이름 · 인사말에 자주 사용 (예: "Dear Acme Beauty Co. Team")',
    group: 'company',
    fromLead: (l) => l.Company || '',
  },
  {
    key: 'Country',
    label: '회사 국가',
    example: 'United States',
    description: '상대 회사가 속한 국가',
    group: 'company',
    fromLead: (l) => l.Country || '',
  },
  {
    key: 'Type',
    label: '회사 업종',
    example: 'Beauty Distributor',
    description: '회사 유형 (예: Distributor, Retailer, Chain 등)',
    group: 'company',
    fromLead: (l) => l.Type || '',
  },
  {
    key: 'BrandsChannels',
    label: '취급 브랜드/채널',
    example: 'Sephora, Ulta',
    description: '이 회사가 취급하는 브랜드나 판매 채널',
    group: 'company',
    fromLead: (l) => l.BrandsChannels || '',
  },
  {
    key: 'WebsiteContact',
    label: '회사 웹사이트',
    example: 'https://acmebeauty.com',
    description: '상대 회사 홈페이지 URL',
    group: 'company',
    fromLead: (l) => l.WebsiteContact || '',
  },
  // ── 발송자 정보 (env / 계정 기반) ───────
  {
    key: 'SenderName',
    label: '내 이름',
    example: 'Yogico',
    description: '메일 서명에 들어갈 발송자 이름 (선택한 메일 계정 이름이 자동 사용됨)',
    group: 'sender',
    // sender 값은 buildVarsFromLead 의 extras 로 주입됨
    fromLead: () => '',
  },
  {
    key: 'SenderCompany',
    label: '내 회사',
    example: 'Yogico',
    description: '발송자의 회사명 (본문/서명에 사용)',
    group: 'sender',
    fromLead: () => '',
  },
  {
    key: 'SenderEmail',
    label: '내 이메일',
    example: 'partnerships@yogico.kr',
    description: '발송자의 이메일 (답장 안내 등에 사용)',
    group: 'sender',
    fromLead: () => '',
  },
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
  // 발송자 기본값 — env 우선
  out.SenderName = extras?.SenderName || process.env.MAIL_FROM_NAME || 'Yogico';
  out.SenderCompany = extras?.SenderCompany || 'Yogico';
  out.SenderEmail = extras?.SenderEmail || process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER || '';
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
  out.SenderName = process.env.MAIL_FROM_NAME || 'Yogico';
  out.SenderCompany = 'Yogico';
  out.SenderEmail = process.env.MAIL_FROM_ADDRESS || 'partnerships@yogico.kr';
  return out;
}
