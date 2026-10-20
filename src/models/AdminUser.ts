import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminUser extends Document {
  username: string;
  passwordHash: string;
  createdAt: Date;
  /**
   * 이 시각보다 먼저 받은 로그인(출입증)은 무효 — 강제 로그아웃 (2026-10-20).
   * 비밀번호를 바꾸거나 scripts/revoke-sessions.mts 로 내보낼 때 적힌다 (lib/session-revoke.ts · proxy.ts).
   */
  sessionsValidAfter?: Date | null;
}

const AdminUserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  sessionsValidAfter: { type: Date, default: null },
});

// 개발 서버는 고친 파일을 다시 읽어도 mongoose 모델은 처음 것을 계속 쓴다 — 새 칸이 조용히 버려지지 않게 새로 만든다
if (mongoose.models.AdminUser && !mongoose.models.AdminUser.schema.path('sessionsValidAfter')) {
  mongoose.deleteModel('AdminUser');
}

export const AdminUser = mongoose.models.AdminUser || mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);
