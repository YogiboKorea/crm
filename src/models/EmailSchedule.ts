import mongoose, { Schema, Document } from 'mongoose';

/**
 * B2B 메일 예약 발송 큐.
 * 크론(GitHub Actions 또는 유사)이 주기적으로 due 항목을 처리.
 */
export interface IEmailSchedule extends Document {
  leadId: string;              // 대상 lead
  templateId: string;
  to: string;                  // 수신자 이메일
  scheduledFor: Date;          // 발송 예정 시각
  status: 'pending' | 'sent' | 'failed' | 'canceled';
  sentAt?: Date;
  attempts: number;
  lastError?: string;
  batchId?: string;            // 예약 배치 ID (한 번에 여러 대상 예약 시 그룹핑)
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmailScheduleSchema = new Schema<IEmailSchedule>({
  leadId: { type: String, required: true, index: true },
  templateId: { type: String, required: true },
  to: { type: String, required: true },
  scheduledFor: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'canceled'],
    default: 'pending',
    index: true,
  },
  sentAt: { type: Date },
  attempts: { type: Number, default: 0 },
  lastError: { type: String, default: '' },
  batchId: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

export const EmailSchedule =
  (mongoose.models.EmailSchedule as mongoose.Model<IEmailSchedule>) ||
  mongoose.model<IEmailSchedule>('EmailSchedule', EmailScheduleSchema);
