import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isMasterUser } from '@/lib/masters';
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
 * 이 사람이 볼 수 있는 계정 조건.
 *
 * 마스터는 등록된 계정을 전부 본다.
 * 예전에는 무조건 { owner: 본인 } 이라, admin 이 등록한 발송 계정 두 개가
 * yogico 로 로그인하면 하나도 안 보였다 — 대표가 쓰는 계정이 둘 다
 * 마스터인데 "보내는 계정" 칸이 통째로 비어 메일을 못 보내는 상태였다.
 * 계정 자체는 회사 자산이므로 마스터끼리는 같은 것을 보는 게 맞다.
 */
function visibleTo(user: string) {
  return isMasterUser(user) ? {} : { owner: user };
}

/**
 * GET  /api/mail-accounts             → 쓸 수 있는 계정 목록 (비번 제외)
 * POST /api/mail-accounts             → 새 계정 등록 (저장 전 SMTP verify 강제)
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  await dbConnect();
  const list = await MailAccount.find(visibleTo(user)).sort({ isDefault: -1, createdAt: 1 });
  return NextResponse.json({
    success: true,
    accounts: list.map(sanitizeMailAccount),
    master: isMasterUser(user),
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
    // 기본 계정은 하나뿐이어야 한다. 마스터는 남의 계정도 보므로
    // 자기 것만 내리면 기본이 두 개가 되어 어느 주소로 나가는지 알 수 없다.
    await MailAccount.updateMany({ ...visibleTo(user), isDefault: true }, { $set: { isDefault: false } });
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
