import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { sessionsValidAfter } from '@/lib/session-revoke';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

/** 로그인 화면으로 — 무효가 된 출입증은 지워서 다시 쓰이지 않게 한다 */
function toLogin(req: NextRequest, clearCookie = false) {
  const res = NextResponse.redirect(new URL('/login', req.url));
  if (clearCookie) res.cookies.delete('admin_session');
  return res;
}

export async function proxy(req: NextRequest) {
  // Protect all routes except /login, /api/auth, /api/cron (bearer-protected), and public assets
  if (
    req.nextUrl.pathname.startsWith('/login') ||
    req.nextUrl.pathname.startsWith('/api/auth') ||
    req.nextUrl.pathname.startsWith('/api/cron') ||
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.startsWith('/assets') ||
    req.nextUrl.pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('admin_session')?.value;

  if (!token) {
    return toLogin(req);
  }

  let payload: any;
  try {
    ({ payload } = await jwtVerify(token, JWT_SECRET));
  } catch (err) {
    return toLogin(req);
  }

  // 강제 로그아웃 — 비밀번호를 바꿨거나 내보낸 아이디의, 그 전에 받은 출입증은 막는다 (lib/session-revoke.ts).
  // DB 를 잠깐 못 보면 막지 않는다 — 출입증 자체는 진짜이고, 그것 때문에 모두가 로그인 화면으로 튕기면 안 된다.
  try {
    const after = await sessionsValidAfter(String(payload?.user || ''));
    if (after && Number(payload?.iat || 0) * 1000 < after) return toLogin(req, true);
  } catch (e) {
    console.warn('[proxy] 강제 로그아웃 확인 실패 — 통과시킵니다', e);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
