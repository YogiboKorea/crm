import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { AdminUser } from '@/models/AdminUser';
import crypto from 'crypto';
import { SignJWT } from 'jose';
import { revokeStamp } from '@/lib/session-revoke';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

export async function POST(req: Request) {
  try {
    const { username, currentPassword, newPassword } = await req.json();
    
    const currentPasswordHash = crypto.createHash('sha256').update(currentPassword).digest('hex');
    const newPasswordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    
    await dbConnect();
    const user = await AdminUser.findOne({ username, passwordHash: currentPasswordHash });
    
    if (user) {
      user.passwordHash = newPasswordHash;
      // 예전 비밀번호로 로그인해 있던 곳은 끊는다 (lib/session-revoke.ts) — 바꾼 사람은 새 출입증으로 계속 쓴다
      user.sessionsValidAfter = revokeStamp();
      await user.save();
      const fresh = await new SignJWT({ user: username, role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(JWT_SECRET);
      const res = NextResponse.json({ success: true, otherSessionsLoggedOut: true });
      res.cookies.set('admin_session', fresh, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24,
      });
      return res;
    }
    
    return NextResponse.json({ success: false, error: 'Invalid current password' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
