import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/mongodb';
import { EmailSchedule } from '@/models/EmailSchedule';
import { EmailTemplate } from '@/models/EmailTemplate';
import { Lead } from '@/models/Lead';
import { MailAccount } from '@/models/MailAccount';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

/**
 * GET  /api/mail/schedule                 → 예약 큐 목록
 * POST /api/mail/schedule                 → 새 예약 등록
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending';
  const limit = Math.min(500, parseInt(searchParams.get('limit') || '100', 10));

  await dbConnect();
  const filter: any = { createdBy: user };
  if (status !== 'all') filter.status = status;

  const items = await EmailSchedule.find(filter).sort({ scheduledFor: 1 }).limit(limit).lean();

  const leadIds = [...new Set(items.map((i: any) => i.leadId))];
  const leads = await Lead.find({ leadId: { $in: leadIds } }, { leadId: 1, Company: 1, Country: 1, Email: 1 }).lean();
  const leadMap = new Map<string, any>();
  for (const l of leads as any[]) leadMap.set(l.leadId, l);

  return NextResponse.json({
    success: true,
    items: items.map((i: any) => ({
      _id: String(i._id),
      leadId: i.leadId,
      to: i.to,
      scheduledFor: i.scheduledFor,
      status: i.status,
      attempts: i.attempts,
      lastError: i.lastError,
      batchId: i.batchId,
      templateId: i.templateId,
      sentAt: i.sentAt,
      createdAt: i.createdAt,
      lead: leadMap.get(i.leadId) || null,
    })),
  });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const leadIds: string[] = Array.isArray(body.leadIds) ? body.leadIds : [];
  const templateId: string = body.templateId || '';
  const scheduledForStr: string = body.scheduledFor || '';
  const mailAccountId: string = body.mailAccountId || '';

  if (leadIds.length === 0) return NextResponse.json({ success: false, error: 'leadIds 필수' }, { status: 400 });
  if (!templateId) return NextResponse.json({ success: false, error: 'templateId 필수' }, { status: 400 });
  if (!scheduledForStr) return NextResponse.json({ success: false, error: 'scheduledFor 필수' }, { status: 400 });

  const scheduledFor = new Date(scheduledForStr);
  if (isNaN(scheduledFor.getTime())) return NextResponse.json({ success: false, error: 'scheduledFor 파싱 실패' }, { status: 400 });
  if (scheduledFor.getTime() < Date.now() - 60 * 1000) {
    return NextResponse.json({ success: false, error: '과거 시각으로 예약할 수 없습니다' }, { status: 400 });
  }

  await dbConnect();

  const tpl = await EmailTemplate.findById(templateId).lean();
  if (!tpl) return NextResponse.json({ success: false, error: '템플릿을 찾을 수 없음' }, { status: 404 });

  if (mailAccountId) {
    const acc = await MailAccount.findById(mailAccountId).lean();
    if (!acc) return NextResponse.json({ success: false, error: '메일 계정을 찾을 수 없음' }, { status: 404 });
  }

  const leads = await Lead.find({ leadId: { $in: leadIds } }, { leadId: 1, Email: 1 }).lean();
  const validLeads = (leads as any[]).filter((l) => {
    const e = (l.Email || '').trim();
    return e && !/^Not found/i.test(e) && /@/.test(e);
  });
  if (validLeads.length === 0) {
    return NextResponse.json({ success: false, error: '이메일이 유효한 리드가 없습니다' }, { status: 400 });
  }

  const batchId = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const docs = validLeads.map((l) => ({
    leadId: l.leadId,
    templateId,
    mailAccountId: mailAccountId || '',
    to: (l.Email as string).trim(),
    scheduledFor,
    status: 'pending' as const,
    attempts: 0,
    lastError: '',
    batchId,
    createdBy: user,
  }));

  const created = await EmailSchedule.insertMany(docs);

  return NextResponse.json({
    success: true,
    scheduled: created.length,
    skipped: leadIds.length - created.length,
    batchId,
    scheduledFor: scheduledFor.toISOString(),
  });
}
