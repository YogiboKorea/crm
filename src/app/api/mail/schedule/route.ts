import { NextResponse } from 'next/server';
import { resolveOutreachAccount } from '@/lib/mail/accounts';
import { getSessionUser, UNAUTHORIZED } from '@/lib/mail/scope';
import dbConnect from '@/lib/mongodb';
import { EmailSchedule } from '@/models/EmailSchedule';
import { EmailTemplate } from '@/models/EmailTemplate';
import { loadTemplateAttachments } from '@/lib/mail/template-attachments';
import { Lead } from '@/models/Lead';
import { MailAccount } from '@/models/MailAccount';
import { leadMailAddress } from '@/lib/mail/compose-new';
import { lastRunInfo } from '@/lib/run-lock';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET  /api/mail/schedule                 → 예약 큐 목록
 * POST /api/mail/schedule                 → 새 예약 등록
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending';
  const limit = Math.min(500, parseInt(searchParams.get('limit') || '100', 10));

  await dbConnect();
  let items: any[];
  if (status === 'all') {
    // 아직 안 나간 것(대기·보내는 중)은 전부, 끝난 것(보냄·실패·취소)은 최근 것부터 limit 만큼.
    // 예전에는 전체를 예약 시각 순으로 limit 만큼 잘라, 기록이 쌓이면 오래된 '보냄' 이 자리를 차지해
    // 정작 곧 나갈 예약이 목록에서 빠졌다 (2026-10-20 점검).
    const [open, done] = await Promise.all([
      EmailSchedule.find({ createdBy: user, status: { $in: ['pending', 'sending'] } }).sort({ scheduledFor: 1 }).limit(3000).lean(),
      EmailSchedule.find({ createdBy: user, status: { $in: ['sent', 'failed', 'canceled'] } }).sort({ updatedAt: -1 }).limit(limit).lean(),
    ]);
    items = [...open, ...done];
  } else {
    items = await EmailSchedule.find({ createdBy: user, status: status as any }).sort({ scheduledFor: 1 }).limit(limit).lean();
  }

  const leadIds = [...new Set(items.map((i: any) => i.leadId))];
  const [leads, lastRun] = await Promise.all([
    Lead.find({ leadId: { $in: leadIds } }, { leadId: 1, Company: 1, Country: 1, Email: 1 }).lean(),
    lastRunInfo('process-schedules'),
  ]);
  const leadMap = new Map<string, any>();
  for (const l of leads as any[]) leadMap.set(l.leadId, l);

  return NextResponse.json({
    success: true,
    // 예약을 실제로 내보내는 처리가 마지막으로 언제 돌았나 — 화면이 "자동 처리가 멈춰 있다" 를 알린다
    lastRun: lastRun ? { at: lastRun.at, source: lastRun.source, running: lastRun.running } : null,
    items: items.map((i: any) => ({
      _id: String(i._id),
      leadId: i.leadId,
      to: i.to,
      scheduledFor: i.scheduledFor,
      status: i.status,
      attempts: i.attempts,
      lastError: i.lastError,
      canceledReason: i.canceledReason || '',
      batchId: i.batchId,
      templateId: i.templateId,
      // 몇 번째 메일인가 (1 = 첫 메일, 2·3 = 자동 재발송) — 예약 목록이 "재발송" 을 구분해 보여 준다
      attemptNo: i.attemptNo || 1,
      edited: !!(i.subjectOverride || i.bodyOverride),
      sentAt: i.sentAt,
      createdAt: i.createdAt,
      lead: leadMap.get(i.leadId) || null,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json(UNAUTHORIZED, { status: 401 });

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
  // 첨부 주소가 깨져 있으면 예약 전에 알린다 (발송 시각에 실패로 떨어지기 전에)
  const att = await loadTemplateAttachments((tpl as any).attachments);
  if (!att.ok) return NextResponse.json({ success: false, error: att.error }, { status: 400 });

  // 고른 계정(없으면 대표 계정)을 예약에 적어 둔다 — 발송 시각에 그 계정으로 나간다.
  // 예약 실행(schedule-runner)은 id 만 믿고 보내므로, 여기서 자기 계정인지 반드시 걸러야 한다.
  const { account: outreach, error: accError } = await resolveOutreachAccount(mailAccountId, user);
  if (!outreach) return NextResponse.json({ success: false, error: accError }, { status: 400 });

  // 지운 업체·[검증 실패]·보관함은 빼고, 이미 예약(또는 보내는 중)이 걸린 곳도 뺀다 — 같은 곳에 두 통 나가지 않게
  const leads = await Lead.find(
    { leadId: { $in: leadIds }, deleted: { $ne: true }, stage: { $nin: ['failed', 'archived'] } },
    { leadId: 1, Email: 1 },
  ).lean();
  const busy = new Set((await EmailSchedule.find(
    { leadId: { $in: leadIds }, status: { $in: ['pending', 'sending'] } }, { leadId: 1 },
  ).lean()).map((s: any) => s.leadId));
  const validLeads = (leads as any[])
    .map((l) => ({ leadId: l.leadId, to: leadMailAddress(l.Email) }))
    .filter((l) => l.to && !busy.has(l.leadId));
  if (validLeads.length === 0) {
    return NextResponse.json({ success: false, error: busy.size ? '이미 예약이 걸려 있습니다 — [📅 예약 발송] 에서 확인하세요' : '이메일이 유효한 리드가 없습니다' }, { status: 400 });
  }

  const batchId = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const docs = validLeads.map((l) => ({
    leadId: l.leadId,
    templateId,
    mailAccountId: String(outreach._id),
    to: l.to,
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
