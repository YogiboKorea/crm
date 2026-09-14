/**
 * 누가 어떤 메일을 볼 수 있는가 — 한 곳에서 정한다 (2026-09-14, 아이디별 메일 분리).
 *
 * ── 규칙 ──
 * 사람마다 로그인 아이디가 있고(대표님 david · 전무님 hoon …), 각자 [메일 계정 관리]에서
 * 자기 메일을 등록한다. 등록한 계정(MailAccount.owner)이 곧 그 사람의 메일함이다.
 *
 *   - 일반 아이디 : 자기가 등록한 계정의 메일만 본다 / 그 계정으로만 보낸다
 *   - 마스터(admin·yogico, lib/masters.ts) : 마스터 아이디들이 등록한 계정만 본다
 *     마스터끼리는 같은 회사 계정을 함께 쓴다(대표 계정 david@ 등). 다른 사람 아이디의 계정은
 *     마스터 화면에도 띄우지 않는다 — "대표 계정" 표시가 사람마다 하나씩 겹쳐 보여 헷갈렸다.
 *
 * 계정 개념이 생기기 전에 모은 메일(accountId 'main')은 마스터 몫이다.
 *
 * ⚠️ 메일을 읽거나 보내는 API 는 반드시 여기를 거친다. 한 군데라도 빠지면
 *    그 경로로 남의 메일이 보인다.
 */
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { MailAccount } from '@/models/MailAccount';
import { isMasterUser, masterIds } from '@/lib/masters';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

/** 로그인한 아이디 (쿠키 admin_session). 없거나 위조면 null */
export async function getSessionUser(): Promise<string | null> {
  try {
    const c = await cookies();
    const token = c.get('admin_session')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = String((payload as any).user || '').trim();
    return user || null;
  } catch {
    return null;
  }
}

/** 이 아이디가 "자기 계정" 으로 보는 MailAccount 조건 */
export function ownerFilter(user: string): Record<string, any> {
  return isMasterUser(user) ? { owner: { $in: masterIds() } } : { owner: user };
}

export interface MailScope {
  user: string;
  isMaster: boolean;
  /** 볼 수 있는 계정 id (문자열). 마스터는 'main'(옛 메일) 포함 */
  accountIds: string[];
}

/** 로그인 안 했으면 null — 호출하는 쪽에서 401 */
export async function getMailScope(): Promise<MailScope | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const isMaster = isMasterUser(user);
  const accounts = await MailAccount.find(ownerFilter(user), { _id: 1 }).lean();
  const accountIds = accounts.map((a: any) => String(a._id));
  if (isMaster) accountIds.push('main');
  return { user, isMaster, accountIds };
}

/** InboundMail 조회에 붙이는 조건 — 볼 수 있는 계정의 메일만 */
export function mailFilter(scope: MailScope): Record<string, any> {
  return { accountId: { $in: scope.accountIds } };
}

/** 이 계정 id 를 쓸 수 있는가 */
export function canUseAccount(scope: MailScope, accountId?: string | null): boolean {
  return !!accountId && scope.accountIds.includes(String(accountId));
}

/**
 * 화면이 넘긴 accountId(없음·'all'·특정 id)를 범위 안으로 좁힌다.
 * 남의 계정 id 를 넘기면 denied — 호출하는 쪽에서 403/빈 결과로 처리.
 */
export function accountParamFilter(scope: MailScope, requested?: string | null): { filter: Record<string, any>; denied: boolean } {
  const id = String(requested || '').trim();
  if (!id || id === 'all' || id === 'default') return { filter: mailFilter(scope), denied: false };
  if (!canUseAccount(scope, id)) return { filter: { accountId: { $in: [] } }, denied: true };
  return { filter: { accountId: id }, denied: false };
}

export const UNAUTHORIZED = { success: false, error: '로그인이 필요합니다' };
export const NOT_YOURS = { success: false, error: '이 메일(계정)에 접근할 수 없습니다' };
