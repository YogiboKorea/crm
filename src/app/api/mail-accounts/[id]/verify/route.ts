import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/mongodb';
import { MailAccount } from '@/models/MailAccount';
import { decryptSecret } from '@/lib/crypto';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const maxDuration = 30;

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

/**
 * POST /api/mail-accounts/:id/verify
 * 저장된 자격증명으로 다시 SMTP 연결 테스트 (비밀번호 만료 감지 등).
 * 성공/실패 결과와 시각을 lastVerifiedAt / lastVerifyError 에 기록.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await cookies();
  const token = c.get('admin_session')?.value;
  if (!token) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const user = (payload as any).user as string;

  const { id } = await params;
  await dbConnect();
  const acc = await MailAccount.findOne({ _id: id, owner: user });
  if (!acc) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });

  const now = new Date().toISOString();
  try {
    const pass = decryptSecret(acc.smtpPassEnc);
    const t = nodemailer.createTransport({
      host: acc.smtpHost, port: acc.smtpPort, secure: acc.smtpSecure,
      auth: { user: acc.smtpUser, pass },
    });
    await t.verify();
    acc.lastVerifiedAt = now;
    acc.lastVerifyError = '';
    await acc.save();
    return NextResponse.json({ success: true, verifiedAt: now });
  } catch (e: any) {
    acc.lastVerifyError = e?.message || 'unknown';
    await acc.save();
    return NextResponse.json({ success: false, error: e?.message || 'unknown', at: now });
  }
}
