import mongoose, { Schema, Document } from 'mongoose';

/**
 * 클라이언트가 자신의 SMTP 계정을 등록하고 다계정으로 발송 관리.
 * SMTP 비밀번호는 서버에서 AES-256-GCM 으로 암호화 후 저장 (평문 절대 X).
 * 복호화는 오직 서버 내부 sendMail 시점에서만.
 */
export interface IMailAccount extends Document {
  owner: string;              // AdminUser.username
  accountName: string;        // 사용자 별칭 (예: "PR팀", "영업")

  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassEnc: string;        // AES-256-GCM: "iv:tag:ciphertext" (hex)

  fromName: string;
  fromAddress: string;

  // 발송자 서명 자동 부착에 사용
  senderTitle?: string;       // 예: "Head of Global Partnerships" (옵션)
  senderPhone?: string;       // 예: "+82 10 6747 9443"
  senderCompany?: string;     // 예: "Yogi Corporation Inc."
  senderAddress?: string;     // 예: "201, 125, Bongeunsa-ro, Gangnam-gu, Seoul, Korea"
  senderWebsite?: string;     // 예: "www.yogico.kr"

  isDefault: boolean;         // 기본 발송 계정
  isActive: boolean;

  lastVerifiedAt?: string;    // 마지막 성공적으로 SMTP 연결한 시각
  lastVerifyError?: string;   // 마지막 verify 실패 사유

  createdAt: Date;
  updatedAt: Date;
}

const MailAccountSchema = new Schema<IMailAccount>({
  owner: { type: String, required: true, index: true },
  accountName: { type: String, required: true },

  smtpHost: { type: String, required: true },
  smtpPort: { type: Number, default: 465 },
  smtpSecure: { type: Boolean, default: true },
  smtpUser: { type: String, required: true },
  smtpPassEnc: { type: String, required: true },

  fromName: { type: String, default: '' },
  fromAddress: { type: String, required: true },

  senderTitle: { type: String, default: '' },
  senderPhone: { type: String, default: '' },
  senderCompany: { type: String, default: '' },
  senderAddress: { type: String, default: '' },
  senderWebsite: { type: String, default: '' },

  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  lastVerifiedAt: { type: String, default: '' },
  lastVerifyError: { type: String, default: '' },
}, { timestamps: true });

// 소유자별로 accountName + smtpUser 조합은 unique (같은 계정 중복 등록 방지)
MailAccountSchema.index({ owner: 1, smtpUser: 1 }, { unique: true });

export const MailAccount =
  (mongoose.models.MailAccount as mongoose.Model<IMailAccount>) ||
  mongoose.model<IMailAccount>('MailAccount', MailAccountSchema);
