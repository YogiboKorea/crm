/**
 * 보내기 전 **AI 검토** — [✏ 메일 쓰기] 의 [🤖 AI 검토] (2026-10-20, 대표님 요청).
 *
 * 무엇을 보나:
 *   · 받는 사람·호칭·회사명이 서로 맞는지 ("Dear Annelene" 인데 받는 사람이 Lars 등)
 *   · 숫자·금액·수량·날짜·조건이 **최근 주고받은 메일**(DB 에서 꺼내 같이 넘긴다)과 어긋나는지
 *     — "데이터 검증". 단가 0.42 로 합의했는데 본문엔 0.45, 선적일이 10/25 로 바뀌었는데 예전 날짜 등
 *   · 상대가 최근 메일에서 물어본 것 중 빠뜨린 답
 *   · 오탈자·문법·어색한 표현 (영어·한국어), 톤
 *
 * 하지 않는 것: 내용을 새로 지어내지 않는다. 근거(주고받은 메일)가 없는 숫자는 "확인 필요"로만 표시한다.
 * 자동으로 고쳐 보내지 않는다 — 수정안은 사람이 [수정안으로 바꾸기] 를 눌러야 들어간다.
 *
 * 유료 호출이다 (기본 Haiku 4.5 — 한 번에 몇 원~수십 원). 버튼을 누를 때만 돈다.
 */
import { client, resolveModel, extractJson, truncateBody } from './client';

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['ok', 'check', 'fix'] },
    summaryKo: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'mid', 'low'] },
          category: { type: 'string', enum: ['recipient', 'attachment', 'data', 'language', 'missing', 'tone', 'other'] },
          quote: { type: 'string' },
          message: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['severity', 'category', 'quote', 'message', 'suggestion'],
        additionalProperties: false,
      },
    },
    revisedBody: { type: 'string' },
  },
  required: ['verdict', 'summaryKo', 'issues', 'revisedBody'],
  additionalProperties: false,
};

const SYSTEM = `당신은 한국 무역회사 요기코(요기보 빈백·K-뷰티 해외 유통)의 대표가 보내려는 비즈니스 메일을 **보내기 직전에 검토**합니다.
대표는 바쁘고, 잘못 나간 메일은 되돌릴 수 없습니다. 실제로 사고가 나는 것을 잡는 게 목적입니다.

## 볼 것 (중요한 순서)
1. 받는 사람: 인사말의 이름·회사명이 받는 사람/참조와 맞는지. 다른 업체 이름이 섞였는지.
2. 첨부: 본문에서 첨부를 언급했는데 첨부 목록에 없는지, 언급한 파일 이름과 실제 파일이 다른지.
3. 데이터: 숫자·금액·통화·수량·MOQ·단가·날짜·선적일·조건이 [최근 주고받은 메일]의 내용과 어긋나는지.
   어긋나면 무엇이 어떻게 다른지 근거(어느 메일, 날짜)를 message 에 적습니다.
   [최근 주고받은 메일]에 근거가 없으면 어긋남으로 단정하지 말고, 중요한 숫자라면 "확인 필요"(low)로만 둡니다.
4. 빠진 답: 최근 상대 메일에서 물어본 것·요청한 것 중 이 메일이 답하지 않은 것.
5. 언어: 오탈자, 문법, 어색한 표현. 영어 메일이면 영어 기준으로.
6. 톤: 거래처에 실례가 될 표현만. 취향 문제는 적지 않습니다.

## 원칙
- 사실을 지어내지 마세요. 근거 없는 지적은 하지 않습니다.
- 사소한 것을 많이 적기보다 중요한 것을 정확히 적습니다. 문제가 없으면 issues 를 비우고 verdict 를 "ok" 로 둡니다.
- verdict: ok = 그대로 보내도 됨 / check = 확인하고 보내면 됨 / fix = 고쳐야 함(받는 사람·데이터 오류 등).
- message·suggestion·summaryKo 는 한국어로, 짧고 분명하게. quote 는 문제가 된 본문 구절을 그대로(없으면 "").
- revisedBody: 본문의 오류(오탈자·문법·명백한 데이터 오류)만 고친 **전체 본문**. 원래 언어 그대로, 내용·구성·말투는 바꾸지 않습니다.
  서명은 넣지 마세요. 고칠 것이 없으면 "" 로 둡니다.`;

export interface ReviewContextMail {
  date: string;
  direction: 'in' | 'out';
  from: string;
  subject: string;
  summary: string;
  body: string;
}

export interface ReviewInput {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyText: string;
  attachmentNames: string[];
  companies: string[];          // 받는 주소가 등록 업체면 그 회사 이름
  recent: ReviewContextMail[];  // 이 상대들과 최근 주고받은 메일
}

export interface ReviewResult {
  verdict: 'ok' | 'check' | 'fix';
  summaryKo: string;
  issues: Array<{ severity: 'high' | 'mid' | 'low'; category: string; quote: string; message: string; suggestion: string }>;
  revisedBody: string;
  model: string;
  usage: Record<string, number>;
}

export async function reviewDraft(d: ReviewInput, settings: any = {}): Promise<ReviewResult> {
  const model = resolveModel(settings);
  const recent = d.recent.length
    ? d.recent.map((m, i) => `--- [${i + 1}] ${m.date} · ${m.direction === 'in' ? '받음' : '보냄'} · ${m.from}
제목: ${m.subject}
${m.summary ? `요약: ${m.summary}\n` : ''}본문 일부:
${m.body}`).join('\n\n')
    : '(이 상대들과 주고받은 메일이 DB 에 없습니다 — 데이터 대조는 하지 말고 본문 자체만 검토하세요)';

  const user = `아래 메일을 보내기 전에 검토하세요. 오늘은 ${new Date().toISOString().slice(0, 10)} 입니다.

[보내는 사람] ${d.from}
[받는 사람] ${d.to.join(', ')}
[참조] ${d.cc.join(', ') || '없음'}
[숨은참조] ${d.bcc.join(', ') || '없음'}
[등록 업체] ${d.companies.join(', ') || '없음'}
[첨부 파일] ${d.attachmentNames.join(', ') || '없음'}
[제목] ${d.subject}

===== 보낼 본문 (서명은 발송 때 자동으로 붙으므로 여기 없음) =====
${truncateBody(d.bodyText, 12000)}
===== 끝 =====

===== 최근 주고받은 메일 (데이터 대조용 · 최신순) =====
${recent}
===== 끝 =====`;

  const res: any = await client().messages.create({
    model,
    max_tokens: 6000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: user }],
  } as any);

  const r = extractJson(res);
  return {
    verdict: r.verdict,
    summaryKo: r.summaryKo || '',
    issues: Array.isArray(r.issues) ? r.issues : [],
    revisedBody: String(r.revisedBody || ''),
    model,
    usage: {
      inputTokens: res.usage?.input_tokens ?? 0,
      outputTokens: res.usage?.output_tokens ?? 0,
      cacheRead: res.usage?.cache_read_input_tokens ?? 0,
      cacheWrite: res.usage?.cache_creation_input_tokens ?? 0,
    },
  };
}
