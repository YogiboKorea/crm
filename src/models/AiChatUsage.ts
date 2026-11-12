import mongoose, { Schema } from 'mongoose';

/**
 * 🤖 AI 메일 비서 사용 기록 — 질문 한 번에 한 줄 (2026-11-12).
 *
 * 한 달 사용액·한도(lib/ai/mail-chat.ts AI_CHAT_MONTHLY_KRW)는 **이것으로만** 센다.
 * 처음에는 대화(AiChat) 안에 적어 두었는데, 대화를 지우면 이미 나간 돈까지 사용액에서 빠졌다
 * (시험 대화를 지웠더니 ₩450 → ₩0). 돈은 이미 나갔으므로 대화를 지워도 이 기록은 남긴다.
 */
// Document 를 잇지 않는다 — 'model' 칸 이름이 Mongoose 문서의 model 과 겹친다 (사용 모델 이름은 그대로 둔다)
export interface IAiChatUsage {
  user: string;
  at: Date;
  model: string;
  conversationId: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  usd: number;
  failed: boolean;              // 답을 다 받기 전에 끊긴 질문 — 그때까지 쓴 만큼
}

const AiChatUsageSchema = new Schema<IAiChatUsage>({
  user: { type: String, required: true },
  at: { type: Date, default: Date.now },
  model: { type: String, default: '' },
  conversationId: { type: String, default: '' },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  cacheRead: { type: Number, default: 0 },
  cacheWrite: { type: Number, default: 0 },
  usd: { type: Number, default: 0 },
  failed: { type: Boolean, default: false },
});

AiChatUsageSchema.index({ at: -1 });

export const AiChatUsage =
  (mongoose.models.AiChatUsage as mongoose.Model<IAiChatUsage>) ||
  mongoose.model<IAiChatUsage>('AiChatUsage', AiChatUsageSchema);
