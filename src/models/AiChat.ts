import mongoose, { Schema, Document } from 'mongoose';

/**
 * 🤖 AI 메일 비서 대화 (2026-11-12 대표님 요청) — lib/ai/mail-chat.ts.
 *
 * messages 는 Claude API 에 그대로 다시 보내는 대화 원본이다 (도구 호출·결과·생각 블록 포함).
 * 손대지 말고 뒤에 붙이기만 한다 — 앞쪽을 고치면 API 가 앞선 생각 블록을 버리고, 캐시도 깨진다.
 * 화면에는 display(질문·답·근거 메일)만 보여준다.
 */
export interface IAiChat extends Document {
  user: string;                 // 대화한 CRM 아이디 (사람마다 따로)
  mailbox: string;              // 읽은 메일함 주인 아이디 (지금은 david)
  title: string;
  messages: any[];
  display: Array<{
    role: 'user' | 'assistant';
    text: string;
    sources?: Array<{ id: string; date: string; from: string; subject: string }>;
    steps?: Array<{ kind: string; text: string }>;   // 메일을 찾고 읽은 단계 (화면에 접힌 한 줄로)
    files?: Array<{ name: string; kind: string; note?: string }>;   // 질문과 함께 올린 파일
    model?: string;                                   // 답한 모델
    at: Date;
  }>;
  /** 이 대화에서 Anthropic Files API 에 올린 파일 (첨부 읽기 · 올린 파일) — 대화를 지울 때 함께 지운다 */
  fileIds: string[];
  turns: Array<{
    at: Date;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheRead: number;
    cacheWrite: number;
    usd: number;
    lastInputTokens: number;    // 마지막 요청 한 번의 입력 크기 — 대화가 너무 길어졌는지 본다
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const AiChatSchema = new Schema<IAiChat>({
  user: { type: String, required: true, index: true },
  mailbox: { type: String, default: '' },
  title: { type: String, default: '' },
  // API 에 다시 보낼 원본이라 모양을 정하지 않는다 (배열 그대로 저장 · 항상 $set 으로 통째로 바꾼다)
  messages: { type: Schema.Types.Mixed, default: () => [] },
  display: {
    type: [{
      _id: false,
      role: { type: String, enum: ['user', 'assistant'], required: true },
      text: { type: String, default: '' },
      sources: { type: Schema.Types.Mixed, default: undefined },
      steps: { type: Schema.Types.Mixed, default: undefined },
      files: { type: Schema.Types.Mixed, default: undefined },
      model: { type: String, default: '' },
      at: { type: Date, default: Date.now },
    }],
    default: [],
  },
  fileIds: { type: [String], default: [] },
  turns: {
    type: [{
      _id: false,
      at: { type: Date, default: Date.now },
      model: { type: String, default: '' },
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
      cacheRead: { type: Number, default: 0 },
      cacheWrite: { type: Number, default: 0 },
      usd: { type: Number, default: 0 },
      lastInputTokens: { type: Number, default: 0 },
    }],
    default: [],
  },
}, { timestamps: true });

AiChatSchema.index({ user: 1, updatedAt: -1 });

// 개발 서버는 처음 만든 mongoose 모델을 계속 쓴다 — 새로 넣은 칸(steps·model·files·fileIds)이 조용히 버려지지 않게 예전 모델은 버린다
const stale = mongoose.models.AiChat as any;
if (stale && (!stale.schema.path('display')?.schema?.path('files') || !stale.schema.path('fileIds'))) {
  mongoose.deleteModel('AiChat');
}

export const AiChat =
  (mongoose.models.AiChat as mongoose.Model<IAiChat>) ||
  mongoose.model<IAiChat>('AiChat', AiChatSchema);
