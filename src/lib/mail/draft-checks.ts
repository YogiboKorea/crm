/**
 * 보내기 전 **무료** 점검 — [🤖 AI 검토] 를 누르면 AI 보다 먼저 돈다 (2026-10-20).
 *
 * 규칙으로 확실히 잡히는 실수는 AI 에 맡기지 않는다. 비용이 없고, AI 키가 없어도 동작하고,
 * 매번 같은 기준으로 잡힌다. 실제로 사고가 나는 것들만 둔다:
 *   · "첨부 드립니다" 라고 쓰고 파일을 안 붙임
 *   · 양식에서 가져온 [회사명] 같은 빈칸이 그대로 남음
 *   · 서로 다른 회사 사람들을 받는 사람·참조에 같이 넣어 서로의 주소가 보임
 *   · 한국어로 쓴 본문을 해외 주소로 보냄
 */

export interface DraftIssue {
  severity: 'high' | 'mid' | 'low';
  category: 'recipient' | 'attachment' | 'data' | 'language' | 'missing' | 'tone' | 'other';
  message: string;
  suggestion?: string;
  quote?: string;
  source: 'rule' | 'ai';
}

export interface DraftCheckInput {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyText: string;
  attachmentNames: string[];
}

const ATTACH_WORDS = /(첨부|파일\s*(을|를)?\s*(보내|드립|전달)|attach(ed|ment|ing)?|enclosed|please\s+find|\bPFA\b)/i;
const PLACEHOLDER = /(\[(회사명|상대회사|상대 회사명|담당자|담당자 이름|받는사람|이름|국가)\]|\{\{\s*[A-Za-z0-9_]+\s*\}\}|○○|OOO|XXX|\bTBD\b)/;

const domainOf = (a: string) => String(a.split('@')[1] || '').toLowerCase();
/** 개인 메일 서비스는 '회사' 로 치지 않는다 — gmail 쓰는 바이어 둘이 같은 회사로 묶이면 안 되지만, 같은 회사라고 보지도 않는다 */
const FREE_MAIL = /^(gmail|googlemail|naver|daum|hanmail|outlook|hotmail|live|yahoo|icloud|me|nate|kakao)\./i;

export function checkDraft(d: DraftCheckInput): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const text = `${d.subject}\n${d.bodyText}`;

  // 1) 첨부를 말했는데 붙인 파일이 없다
  const m = text.match(ATTACH_WORDS);
  if (m && !d.attachmentNames.length) {
    issues.push({
      severity: 'high', category: 'attachment', source: 'rule', quote: m[0],
      message: `본문에 "${m[0]}" 라고 썼는데 붙인 파일이 없습니다.`,
      suggestion: '[📎 파일 첨부] 로 파일을 붙이거나, 첨부 언급을 지우세요.',
    });
  }

  // 2) 빈칸이 그대로 남았다
  const p = text.match(PLACEHOLDER);
  if (p) {
    issues.push({
      severity: 'high', category: 'data', source: 'rule', quote: p[0],
      message: `채우지 않은 빈칸 "${p[0]}" 가 남아 있습니다.`,
      suggestion: '실제 이름·값으로 바꾸세요. 그대로 나가면 받는 쪽에 그대로 보입니다.',
    });
  }

  // 3) 서로 다른 회사가 받는 사람·참조에 같이 있다 — 서로의 주소와 거래 사실이 보인다
  const mine = domainOf(d.from);
  const visible = [...d.to, ...d.cc];
  const companies = Array.from(new Set(visible.map(domainOf).filter((x) => x && x !== mine && !FREE_MAIL.test(x))));
  if (companies.length >= 2) {
    issues.push({
      severity: 'mid', category: 'recipient', source: 'rule',
      message: `받는 사람·참조에 서로 다른 회사 ${companies.length}곳(${companies.slice(0, 4).join(', ')})이 함께 있어 서로의 주소가 보입니다.`,
      suggestion: '같이 보는 게 맞는 사이(예: 브랜드–유통사 3자 협의)가 아니라면 숨은참조로 옮기거나 따로 보내세요.',
    });
  }

  // 4) 한국어 본문을 해외 주소로
  const hangul = (d.bodyText.match(/[가-힣]/g) || []).length;
  const letters = (d.bodyText.match(/[A-Za-z가-힣]/g) || []).length || 1;
  const foreign = [...d.to, ...d.cc].filter((a) => {
    const dom = domainOf(a);
    return dom && dom !== mine && !/\.kr$/i.test(dom) && !FREE_MAIL.test(dom);
  });
  if (hangul / letters > 0.4 && foreign.length) {
    issues.push({
      severity: 'mid', category: 'language', source: 'rule',
      message: `본문이 한국어인데 받는 사람에 해외 주소가 있습니다 (${foreign.slice(0, 3).join(', ')}).`,
      suggestion: '해외 바이어라면 영어로 보내야 합니다. AI 검토의 수정안을 참고하세요.',
    });
  }

  // 5) 본문이 너무 짧다 — 서명만 있거나 한두 단어
  if (d.bodyText.replace(/\s+/g, '').length < 15) {
    issues.push({ severity: 'low', category: 'other', source: 'rule', message: '본문이 아주 짧습니다. 빠진 내용이 없는지 확인하세요.' });
  }

  return issues;
}
