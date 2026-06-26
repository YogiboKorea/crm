import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude API 기반 K-beauty 바이어 정밀 검증.
 * 휴리스틱이 '의심'으로 분류한 케이스만 LLM으로 한 번 더 판단.
 *
 * 모델: claude-haiku-4-5 (가성비 — 분류 작업에 충분)
 * 비용: 약 $0.30~0.50 / 800건
 */

const client = new Anthropic();
const MODEL = 'claude-haiku-4-5';

export interface AIVerdict {
  verdict: 'beauty-buyer' | 'maybe' | 'not-buyer';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;          // 한국어 1~2문장
  signals: string[];          // 판단 근거 키워드/단서
}

export interface LeadContext {
  Company: string;
  Country?: string;
  Type?: string;
  BrandsChannels?: string;
  Evidence?: string;
  RoleMemo?: string;
  notes?: string;
  WebsiteContact?: string;
  // 휴리스틱이 추출한 사이트 메타
  siteTitle?: string;
  siteDescription?: string;
  matchedKeywords?: string[];
}

const SYSTEM_PROMPT = `너는 K-beauty(한국 화장품) 도매 바이어/디스트리뷰터를 식별하는 정밀 검증자다.

회사 정보를 받아 "이 업체가 한국 화장품을 수입·도매·유통할 가능성이 있는 진성 바이어인가"를 판단한다.

판단 기준:
- beauty-buyer: 명확하게 뷰티/화장품 도매·수입·유통·리테일 사업자
- maybe: 인접 산업이거나 정보가 부족하지만 가능성 있음 (예: 약국 체인, 라이프스타일 브랜드, 미용실)
- not-buyer: 명백히 무관 (자동차, 금융, 건설, IT 서비스 등)

confidence:
- high: 사이트 메타가 명확히 뷰티/화장품을 언급
- medium: 일부 시그널은 있으나 단정 불가
- low: 정보가 빈약, 추측에 가까움

reasoning은 한국어 1~2문장으로 핵심 근거를 압축해서 작성.
signals는 판단의 근거가 된 키워드/단서 2~5개 (영어 OK).`;

const TOOL_SCHEMA = {
  name: 'submit_verdict',
  description: '회사가 K-beauty 바이어인지 판단 결과를 제출',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdict: {
        type: 'string',
        enum: ['beauty-buyer', 'maybe', 'not-buyer'],
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
      },
      reasoning: {
        type: 'string',
        description: '한국어 1~2문장으로 핵심 근거 설명',
      },
      signals: {
        type: 'array',
        items: { type: 'string' },
        description: '판단 근거가 된 키워드 또는 단서 2~5개',
      },
    },
    required: ['verdict', 'confidence', 'reasoning', 'signals'],
    additionalProperties: false,
  },
  strict: true,
};

function buildUserPrompt(lead: LeadContext): string {
  const lines: string[] = [];
  lines.push(`회사명: ${lead.Company}`);
  if (lead.Country) lines.push(`국가: ${lead.Country}`);
  if (lead.Type) lines.push(`유형(메모): ${lead.Type}`);
  if (lead.WebsiteContact) lines.push(`웹사이트: ${lead.WebsiteContact}`);
  if (lead.siteTitle) lines.push(`사이트 타이틀: ${lead.siteTitle}`);
  if (lead.siteDescription) lines.push(`사이트 설명: ${lead.siteDescription}`);
  if (lead.matchedKeywords?.length) {
    lines.push(`자동 매칭 키워드: ${lead.matchedKeywords.slice(0, 10).join(', ')}`);
  }
  if (lead.BrandsChannels) lines.push(`취급 브랜드/채널: ${lead.BrandsChannels.slice(0, 400)}`);
  if (lead.Evidence) lines.push(`수집 메모: ${lead.Evidence.slice(0, 300)}`);
  if (lead.RoleMemo) lines.push(`담당자 메모: ${lead.RoleMemo.slice(0, 200)}`);
  if (lead.notes) lines.push(`기타 노트: ${lead.notes.slice(0, 200)}`);
  return lines.join('\n');
}

export async function verifyWithAI(lead: LeadContext): Promise<AIVerdict | null> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'submit_verdict' },
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(lead),
        },
      ],
    });

    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'submit_verdict') {
        const out = block.input as AIVerdict;
        return {
          verdict: out.verdict,
          confidence: out.confidence,
          reasoning: out.reasoning,
          signals: out.signals,
        };
      }
    }
    return null;
  } catch (e: any) {
    console.error('[verify-ai] API call failed:', e?.message || e);
    return null;
  }
}
