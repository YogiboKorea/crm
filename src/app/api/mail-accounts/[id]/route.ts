import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/mongodb';
import { MailAccount } from '@/models/MailAccount';
import { encryptSecret, sanitizeMailAccount } from '@/lib/crypto';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const maxDuration = 30;

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

async function currentUser() {
  const c = await cookies();
  const token = c.get('admin_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (payload as any).user as string;
  } catch { return null; }
}

/**
 * PUT    /api/mail-accounts/:id → 계정 정보 부분 업데이트 (비번 포함 시 재검증)
 * DELETE /api/mail-accounts/:id → 계정 삭제
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  await dbConnect();
  const acc = await MailAccount.findOne({ _id: id, owner: user });
  if (!acc) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });

  const update: any = {};
  const allowed = ['accountName', 'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'fromName', 'fromAddress', 'isActive'];
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) update[k] = body[k];
  }

  // 비번 변경 시 반드시 재검증
  if (body.smtpPass) {
    try {
      const t = nodemailer.createTransport({
        host: update.smtpHost || acc.smtpHost,
        port: update.smtpPort || acc.smtpPort,
        secure: update.smtpSecure ?? acc.smtpSecure,
        auth: {
          user: update.smtpUser || acc.smtpUser,
          pass: body.smtpPass,
        },
      });
      await t.verify();
      update.smtpPassEnc = encryptSecret(String(body.smtpPass));
      update.lastVerifiedAt = new Date().toISOString();
      update.lastVerifyError = '';
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `SMTP 재검증 실패: ${e?.message || 'unknown'}` },
        { status: 400 },
      );
    }
  }

  // isDefault=true 로 변경 시 다른 계정 해제
  if (body.isDefault === true) {
    await MailAccount.updateMany({ owner: user, isDefault: true, _id: { $ne: acc._id } }, { $set: { isDefault: false } });
    update.isDefault = true;
  }

  Object.assign(acc, update);
  await acc.save();
  return NextResponse.json({ success: true, account: sanitizeMailAccount(acc) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  await dbConnect();
  const acc = await MailAccount.findOneAndDelete({ _id: id, owner: user });
  if (!acc) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
  // default 계정 삭제하면 가장 오래된 것을 새 default 로
  if (acc.isDefault) {
    const next = await MailAccount.findOne({ owner: user }).sort({ createdAt: 1 });
    if (next) { next.isDefault = true; await next.save(); }
  }
  return NextResponse.json({ success: true });
}
