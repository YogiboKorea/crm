import { EmailSchedule } from '@/models/EmailSchedule';

/**
 * 어디서 만든 예약인가 — batchId 머리글로 안다.
 *   campaign  발송 관리 [보낼 메일] 묶음 발송   (api/mail/campaign  → 'camp-')
 *   followup  답 없을 때 자동 재발송           (lib/mail/follow-up → 'followup-')
 *   manual    메일 쓰기 창에서 사람이 시각을 정한 예약 (api/mail/schedule → 'sched-', 옛 예약은 머리글 없음)
 *
 * 묶음 발송·자동 재발송은 사람이 한 곳씩 보지 않고 나가므로 업체 상태가 바뀌면 멈춘다.
 * manual 은 사람이 받는 곳을 직접 골랐으므로 [검증 실패]·보관함·삭제일 때만 멈춘다.
 */
export type ScheduleKind = 'campaign' | 'followup' | 'manual';

export function scheduleKind(doc: { batchId?: string | null }): ScheduleKind {
  const b = String(doc?.batchId || '');
  if (b.startsWith('camp-')) return 'campaign';
  if (b.startsWith('followup-')) return 'followup';
  return 'manual';
}

/** 묶음 발송·자동 재발송 예약만 고르는 조건 (manual 은 빼고) */
export const AUTOMATED_BATCH = /^(camp|followup)-/;

/**
 * 업체의 **아직 안 나간 예약**을 취소한다 (2026-10-20).
 *
 * 왜: 업체를 [검증 실패]·보관함으로 옮기거나 [↩ 발송 취소] 를 눌러도, 미리 깔린 예약 메일은 그대로 나갔다.
 * 상대가 답장해도 이미 잡힌 자동 재발송(광고 메일)이 나갔다 — 화면은 "나가지 않습니다" 라고 했는데.
 *
 * 보내는 순간에도 업체 상태를 다시 본다 (schedule-runner.ts) — 그래서 여기서 빠뜨려도 잘못 나가지는 않는다.
 * 여기서 미리 취소하는 이유는 [📅 예약] 목록에 "곧 나갈 것" 처럼 남아 있지 않게 하려는 것이다.
 *
 * 'sending'(지금 보내는 중)은 건드리지 않는다 — 이미 나가는 중이라 취소해도 소용없고, 결과를 덮어쓰면 안 된다.
 *   automatedOnly  묶음 발송·자동 재발송만 거두고, 사람이 직접 잡은 예약(manual)은 둔다.
 *   followupOnly   자동 재발송만.
 *   createdBefore  이 시각 전에 잡은 예약만 (답장이 온 뒤에 사람이 새로 잡은 예약은 둔다).
 */
export async function cancelPendingSchedules(
  leadIds: string | string[],
  reason: string,
  opts: { automatedOnly?: boolean; followupOnly?: boolean; createdBefore?: Date } = {},
): Promise<number> {
  const ids = (Array.isArray(leadIds) ? leadIds : [leadIds]).filter(Boolean);
  if (!ids.length) return 0;
  const filter: any = { leadId: { $in: ids }, status: 'pending' };
  if (opts.followupOnly) filter.batchId = { $regex: /^followup-/ };
  else if (opts.automatedOnly) filter.batchId = { $regex: AUTOMATED_BATCH };
  if (opts.createdBefore && !isNaN(opts.createdBefore.getTime())) filter.createdAt = { $lt: opts.createdBefore };
  const r = await EmailSchedule.updateMany(filter, { $set: { status: 'canceled', canceledReason: reason } });
  return r.modifiedCount || 0;
}
