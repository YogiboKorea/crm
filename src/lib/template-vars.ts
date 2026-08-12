import type { ILead } from '@/models/Lead';

/**
 * 템플릿에서 사용 가능한 변수 정의.
 * key = {{key}} 로 템플릿에 삽입 · label = 에디터 UI 에 표시할 한글 라벨.
 * example = 미리보기용 폴백 값.
 */
export interface TemplateVar {
  key: string;
  label: string;
  example: string;
  fromLead: (lead: Partial<ILead>) => string;
}

export const TEMPLATE_VARS: TemplateVar[] = [
  {
    key: 'Company',
    label: '회사명',
    example: 'Acme Beauty Co.',
    fromLead: (l) => l.Company || '',
  },
  {
    key: 'Country',
    label: '국가',
    example: 'United States',
    fromLead: (l) => l.Country || '',
  },
  {
    key: 'BuyerContact',
    label: '담당자명',
    example: 'John Smith',
    fromLead: (l) => l.BuyerContact || 'Sir/Madam',
  },
  {
    key: 'Title',
    label: '담당자 직함',
    example: 'Head of Buying',
    fromLead: (l) => l.Title || '',
  },
  {
    key: 'BrandsChannels',
    label: '취급 브랜드/채널',
    example: 'Sephora, Ulta',
    fromLead: (l) => l.BrandsChannels || '',
  },
  {
    key: 'Type',
    label: '업종',
    example: 'Beauty Distributor',
    fromLead: (l) => l.Type || '',
  },
  {
    key: 'WebsiteContact',
    label: '회사 사이트',
    example: 'https://acmebeauty.com',
    fromLead: (l) => l.WebsiteContact || '',
  },
  {
    key: 'Email',
    label: '수신 이메일',
    example: 'partnerships@acmebeauty.com',
    fromLead: (l) => l.Email || '',
  },
  {
    key: 'Phone',
    label: '전화번호',
    example: '+1-555-0100',
    fromLead: (l) => l.Phone || '',
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
