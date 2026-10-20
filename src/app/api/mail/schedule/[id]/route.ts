import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/mongodb';
import { EmailSchedule } from '@/models/EmailSchedule';
import { processScheduleItem } from '@/lib/schedule-runner';

export const runtime = 'nodejs';
export const maxDuration = 60;

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

async function currentUser(): Promise<string | null> {
  const c = await cookies();
  const token = c.get('admin_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (payload as any).user as string;
  } catch { return null; }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  await dbConnect();
  // 아직 안 나간(pending) 것만 한 번에 취소한다 — 읽고 나서 저장하면 그 사이 발송 처리가 집어 간 것을
  // '취소'로 덮어써, 실제로는 나갔는데 화면에는 취소로 남았다 (2026-10-20 점검).
  const r = await EmailSchedule.updateOne(
    { _id: id, createdBy: user, status: 'pending' },
    { $set: { status: 'canceled', canceledReason: '발송함에서 직접 취소' } },
  );
  if (r.modifiedCount) return NextResponse.json({ success: true });
  const doc: any = await EmailSchedule.findOne({ _id: id, createdBy: user }, { status: 1 }).lean();
  if (!doc) return NextResponse.json({ success: false, error: '예약을 찾을 수 없습니다' }, { status: 404 });
  return NextResponse.json({ success: false, error: `${WHY_DONE[doc.status] || '이미 처리되어'} 취소할 수 없습니다` }, { status: 400 });
}

/** 이미 손을 떠난 예약 — 취소·지금 보내기를 막을 때 이유 */
const WHY_DONE: Record<string, string> = { sending: '지금 보내는 중이라', sent: '이미 나가서', failed: '이미 실패로 끝나서', canceled: '이미 취소되어' };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.action !== 'send-now') return NextResponse.json({ success: false, error: 'unknown action' }, { status: 400 });
  await dbConnect();
  const doc = await EmailSchedule.findOne({ _id: id, createdBy: user });
  if (!doc) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
  if (doc.status !== 'pending') return NextResponse.json({ success: false, error: `${WHY_DONE[doc.status] || '이미 처리되어'} 지금 보낼 수 없습니다` }, { status: 400 });
  const result = await processScheduleItem(doc);
  return NextResponse.json({ success: true, result });
}
