import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import dbConnect from '@/lib/mongodb';
import { AdminUser } from '@/models/AdminUser';
import crypto from 'crypto';
import { revokeStamp } from '@/lib/session-revoke';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

export async function PUT(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const username = payload.user as string;

    const { newPassword } = await req.json();
    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ success: false, error: 'Password must be at least 4 characters long' }, { status: 400 });
    }

    const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');

    await dbConnect();
    // 비밀번호를 바꾸면 이 아이디로 로그인해 있던 **다른** 곳은 끊는다 (2026-10-20) —
    // 예전 비밀번호를 아는 사람이 들어와 있었어도 여기서 나가게 된다 (lib/session-revoke.ts · proxy.ts)
    const stamp = revokeStamp();
    const result = await AdminUser.updateOne({ username }, { $set: { passwordHash, sessionsValidAfter: stamp } });

    // If the user doesn't exist in DB yet (e.g., master logging in purely via env fallback), create them
    if (result.matchedCount === 0) {
      await AdminUser.create({ username, passwordHash, sessionsValidAfter: stamp });
    }

    // 바꾼 본인은 새 출입증으로 그대로 쓴다
    const fresh = await new SignJWT({ user: username, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(JWT_SECRET);
    const res = NextResponse.json({ success: true, otherSessionsLoggedOut: true });
    res.cookies.set('admin_session', fresh, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
