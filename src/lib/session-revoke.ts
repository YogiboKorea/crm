import dbConnect from '@/lib/mongodb';
import { AdminUser } from '@/models/AdminUser';

/**
 * 강제 로그아웃 (2026-10-20).
 *
 * 왜: 로그인 출입증(JWT · 24시간)은 서버에 남지 않는다. 한 번 나가면 서버가 거둘 방법이 없어서,
 * 관리자 비밀번호를 다른 사람이 알고 들어와도 비밀번호를 바꾸는 것만으로는 그 사람을 내보낼 수 없었다.
 * 서명 열쇠(JWT_SECRET)를 바꾸면 전원이 나가지만, 같은 열쇠로 메일 계정 비밀번호를 암호화해 두어서
 * 메일 수집·발송까지 멈춘다 (lib/crypto.ts) — 그래서 쓸 수 없다.
 *
 * 그래서 아이디마다 "이 시각보다 먼저 받은 출입증은 무효" 를 적어 두고, 모든 요청이 지나는 proxy.ts 에서 본다.
 *   · 비밀번호를 바꾸면 그 시각으로 적힌다 — 예전 비밀번호로 로그인해 둔 다른 사람이 쫓겨난다
 *   · scripts/revoke-sessions.mts 로 특정 아이디·전체를 내보낼 수 있다
 * 매 요청 DB 를 보지 않게 30초 기억한다 — 내보낸 뒤 최대 30초는 버틸 수 있다.
 */
const MEMO_MS = 30_000;
const memo = new Map<string, { at: number; after: number }>();

/** 이 아이디의 출입증은 이 시각(ms) 이후에 받은 것만 유효 — 0 이면 제한 없음 */
export async function sessionsValidAfter(username: string): Promise<number> {
  if (!username) return 0;
  const hit = memo.get(username);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.after;
  await dbConnect();
  const u: any = await AdminUser.findOne({ username }, { sessionsValidAfter: 1 }).lean();
  const after = u?.sessionsValidAfter ? new Date(u.sessionsValidAfter).getTime() : 0;
  memo.set(username, { at: Date.now(), after });
  return after;
}

/**
 * 출입증 무효 시각 — **초 단위로 내린다**. 출입증의 발급 시각(iat)이 초 단위라,
 * 밀리초까지 적으면 같은 초에 새로 발급한 출입증(비밀번호를 바꾼 본인)까지 무효가 된다.
 */
export function revokeStamp(at = new Date()): Date {
  return new Date(Math.floor(at.getTime() / 1000) * 1000);
}

/** 아이디(들) 또는 전체의 지금까지 받은 출입증을 무효로 — 바뀐 아이디 수를 돌려준다 */
export async function revokeSessions(usernames: string[] | 'all', at = new Date()): Promise<number> {
  await dbConnect();
  const filter = usernames === 'all' ? {} : { username: { $in: usernames } };
  const r = await AdminUser.updateMany(filter, { $set: { sessionsValidAfter: revokeStamp(at) } });
  memo.clear();
  return r.modifiedCount || 0;
}
