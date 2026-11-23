/**
 * 메일함을 언제까지 받아 왔는가 (2026-11-23).
 *
 * 이카운트가 로그인을 거절하면(웹메일 비밀번호 변경 · 외부연동설정의 "메일 클라이언트 사용"·"해외 로그인 차단")
 * 수집은 오류만 남기고 조용히 멈춘다. 전무님 메일함이 11/13 부터 열흘 넘게 멈춰 있었는데
 * 계정 카드는 "✅ 검증됨" 초록색이었고 받은 메일함에도 아무 표시가 없었다.
 *
 * 매일 아침 수집(크론)이 모든 계정을 돌고, 로그인할 때도 받아 오므로
 * 받은편지함을 하루 반 넘게 못 받아 왔으면 멈춘 것으로 본다.
 * 계정 카드(메일 계정 관리) · 받은 메일함 · AI 메일 비서가 같은 기준을 쓴다.
 */
import { MailSyncState } from '@/models/MailSyncState';

export const SYNC_STALE_MS = 36 * 3600_000;

/** 이 계정 id 들(같은 메일함 묶음) 중 받은편지함을 가장 최근에 받아 온 시각 — 한 번도 안 받았으면 null */
export async function lastInboxSync(ids: string[]): Promise<Date | null> {
  if (!ids.length) return null;
  const st: any = await MailSyncState.findOne({ accountId: { $in: ids }, folder: 'INBOX', lastSyncAt: { $ne: null } })
    .sort({ lastSyncAt: -1 }).select('lastSyncAt').lean();
  return st?.lastSyncAt ? new Date(st.lastSyncAt) : null;
}

/** 멈췄는가 — 아직 한 번도 안 받은 새 계정(null)은 멈춘 것으로 치지 않는다 */
export function isSyncStale(at: Date | string | null | undefined, now = Date.now()): boolean {
  return !!at && now - new Date(at).getTime() > SYNC_STALE_MS;
}
