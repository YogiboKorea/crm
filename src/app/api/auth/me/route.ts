import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isMasterUser } from '@/lib/masters';
import { canUseAiChat } from '@/lib/ai/chat-access';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const username = payload.user as string;
    const isMaster = isMasterUser(username);
    
    return NextResponse.json({
      authenticated: true,
      username,
      isMaster,
      // 🤖 AI 메일 비서 메뉴를 보여줄지 — 대표님 전용 (lib/ai/chat-access.ts)
      aiChat: canUseAiChat(username),
    });
  } catch (err) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
