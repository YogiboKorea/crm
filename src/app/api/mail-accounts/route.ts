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
 * GET  /api/mail-accounts             → 내 계정 목록 (비번 제외)
 * POST /api/mail-accounts             → 새 계정 등록 (저장 전 SMTP verify 강제)
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  await dbConnect();
  const list = await MailAccount.find({ owner: user }).sort({ isDefault: -1, createdAt: 1 });
  return NextResponse.json({
    success: true,
    accounts: list.map(sanitizeMailAccount),
  });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const {
    accountName, smtpHost, smtpPort, smtpSecure,
    smtpUser, smtpPass, fromName, fromAddress, isDefault,
    senderTitle, senderPhone, senderCompany, senderAddress, senderWebsite,
  } = body;

  // 필수값 검증
  if (!accountName || !smtpHost || !smtpUser || !smtpPass || !fromAddress) {
    return NextResponse.json(
      { success: false, error: '필수값 누락: accountName / smtpHost / smtpUser / smtpPass / fromAddress' },
      { status: 400 },
    );
  }

  // 저장 전 반드시 연결 테스트 (잘못된 자격증명 저장 방지)
  const port = parseInt(String(smtpPort ?? 465), 10);
  const secure = smtpSecure !== false;
  try {
    const t = nodemailer.createTransport({
      host: smtpHost, port, secure,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await t.verify();
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: `SMTP 연결 실패: ${e?.message || 'unknown'}` },
      { status: 400 },
    );
  }

  await dbConnect();

  // 이 계정이 default 면 기존 default 해제
  if (isDefault === true) {
    await MailAccount.updateMany({ owner: user, isDefault: true }, { $set: { isDefault: false } });
  }
  // 사용자의 첫 계정이면 자동으로 default
  const count = await MailAccount.countDocuments({ owner: user });
  const shouldDefault = isDefault === true || count === 0;

  const now = new Date().toISOString();
  try {
    const doc = await MailAccount.create({
      owner: user,
      accountName: String(accountName).trim(),
      smtpHost: String(smtpHost).trim(),
      smtpPort: port,
      smtpSecure: secure,
      smtpUser: String(smtpUser).trim(),
      smtpPassEnc: encryptSecret(String(smtpPass)),
      fromName: String(fromName || '').trim(),
      fromAddress: String(fromAddress).trim(),
      senderTitle: String(senderTitle || '').trim(),
      senderPhone: String(senderPhone || '').trim(),
      senderCompany: String(senderCompany || '').trim(),
      senderAddress: String(senderAddress || '').trim(),
      senderWebsite: String(senderWebsite || '').trim(),
      isDefault: shouldDefault,
      isActive: true,
      lastVerifiedAt: now,
      lastVerifyError: '',
    });
    return NextResponse.json({ success: true, account: sanitizeMailAccount(doc) });
  } catch (e: any) {
    // duplicate key (같은 owner+smtpUser)
    if (e?.code === 11000) {
      return NextResponse.json(
        { success: false, error: '이미 등록된 계정입니다 (같은 smtpUser).' },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: false, error: e?.message || 'unknown' }, { status: 500 });
  }
}
