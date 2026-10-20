import mongoose, { Schema, Document } from 'mongoose';

/**
 * [✏ 메일 쓰기] 첨부파일 — **보내기 직전까지만** 잠깐 맡아 두는 조각 (2026-10-20, 대표님 요청).
 *
 * 왜 조각으로 나눠 DB 에 잠깐 두나:
 * Vercel 서버는 요청 하나를 4.5MB 에서 끊는다. 가격표·회사소개서 PDF 는 그보다 큰 경우가 많아
 * 메일 보내기 요청에 파일을 통째로 실어 보낼 수 없다. 그래서 화면이 파일을 3MB 조각으로 나눠
 * 먼저 올려 두고, [보내기] 때 서버가 조각을 이어 붙여 메일에 단다.
 *
 * DB 용량(무료 512MB)을 차지하지 않게:
 *   · 보내자마자 지운다 (api/mail/compose)
 *   · 안 보내고 창을 닫아도 2시간 뒤 MongoDB 가 알아서 지운다 (아래 TTL 색인)
 *   · 받은 메일처럼 본문을 남겨 두는 곳이 아니다 — 보낸 뒤에는 이카운트 보낸메일함에만 남는다
 */
export interface IMailUpload extends Document {
  uploadId: string;      // 화면이 파일마다 만드는 임의 번호 (같은 파일의 조각은 같은 번호)
  owner: string;         // 올린 아이디 — 남이 올린 파일은 붙일 수 없다
  filename: string;
  contentType: string;
  size: number;          // 파일 전체 크기 (조각 크기가 아니다)
  chunkIndex: number;
  chunkCount: number;
  data: Buffer;
  createdAt: Date;
}

const MailUploadSchema = new Schema<IMailUpload>({
  uploadId: { type: String, required: true },
  owner: { type: String, required: true },
  filename: { type: String, required: true },
  contentType: { type: String, default: 'application/octet-stream' },
  size: { type: Number, required: true },
  chunkIndex: { type: Number, required: true },
  chunkCount: { type: Number, required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

MailUploadSchema.index({ uploadId: 1, chunkIndex: 1 }, { unique: true });
// 2시간 지나면 MongoDB 가 지운다 — 보내지 않고 창을 닫은 파일이 DB 에 쌓이지 않게
MailUploadSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 60 * 60 });

export const MailUpload =
  (mongoose.models.MailUpload as mongoose.Model<IMailUpload>) ||
  mongoose.model<IMailUpload>('MailUpload', MailUploadSchema);
