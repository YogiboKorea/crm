import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { EmailSchedule } from '@/models/EmailSchedule';
import { processScheduleItem } from '@/lib/schedule-runner';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/process-schedules
 *   Vercel Cron 이 호출. scheduledFor <= now && status=pending 항목을 배치 처리.
 *
 * 보안:
 *   - CRON_SECRET env 있으면 Authorization: Bearer <SECRET> 검증
 *   - 없으면 (dev/편의) 통과 (`x-vercel-cron: 1` 헤더는 Vercel 이 자동 붙임)
 */
export async function GET(req: Request) {
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }
  } else if (!isVercelCron) {
    console.log('[cron:process-schedules] warning: no CRON_SECRET set and not vercel-cron request');
  }

  try {
    await dbConnect();
    const now = new Date();
    const items = await EmailSchedule.find({
      status: 'pending',
      scheduledFor: { $lte: now },
    }).limit(50);

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const doc of items) {
      try {
        const r = await processScheduleItem(doc);
        results.push({ id: String(doc._id), ok: !!r.ok, error: r.error });
      } catch (e: any) {
        results.push({ id: String(doc._id), ok: false, error: e?.message || 'unknown' });
      }
    }
    console.log(`[cron:process-schedules] processed ${items.length} · ok=${results.filter(r => r.ok).length}`);
    return NextResponse.json({ success: true, processed: items.length, results });
  } catch (e: any) {
    console.error('[cron:process-schedules] error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'unknown' }, { status: 500 });
  }
}
