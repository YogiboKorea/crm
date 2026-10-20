/**
 * **로그인한 사람 내보내기 (강제 로그아웃)** (2026-10-20).
 *
 * 지정한 아이디가 **지금까지** 받은 로그인을 모두 무효로 한다. 다음 화면 이동·새로고침 때 로그인 화면으로 간다.
 * 비밀번호를 아는 사람은 다시 들어올 수 있으므로, 남이 비밀번호를 알고 있으면 **비밀번호도 바꿔야** 한다
 * (CRM 계정 관리 → 비밀번호 변경 — 바꾸면 그 아이디의 다른 로그인도 저절로 끊긴다).
 *
 * 운영 서버(proxy.ts)가 이 검사를 하는 버전으로 배포된 뒤부터 효과가 난다. 서버마다 최대 30초 늦게 반영된다.
 *
 * 사용: npx tsx scripts/revoke-sessions.mts --users=yogico,admin      (그 아이디만)
 *       npx tsx scripts/revoke-sessions.mts --all                     (전원)
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k: string, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const ALL = process.argv.includes('--all');
const USERS = arg('users').split(',').map((s) => s.trim()).filter(Boolean);
if (!ALL && !USERS.length) { console.error('--users=아이디,아이디 또는 --all 을 주세요'); process.exit(1); }

const { revokeSessions } = await import('../src/lib/session-revoke.ts');
await mongoose.connect(process.env.MONGODB_URI!);
const U = mongoose.connection.db!.collection('adminusers');
const known = (await U.find({}, { projection: { username: 1 } }).toArray()).map((u: any) => u.username);
const missing = USERS.filter((u) => !known.includes(u));
if (missing.length) console.log(`없는 아이디는 건너뜁니다: ${missing.join(', ')}`);

const n = await revokeSessions(ALL ? 'all' : USERS.filter((u) => known.includes(u)));
const rows = await U.find(ALL ? {} : { username: { $in: USERS } }, { projection: { username: 1, sessionsValidAfter: 1 } }).toArray();
console.log(`${ALL ? '전원' : USERS.join(', ')} — ${n}개 아이디의 지금까지 로그인을 무효로 했습니다`);
for (const r of rows as any[]) console.log(`  ${r.username.padEnd(8)} ${r.sessionsValidAfter ? new Date(r.sessionsValidAfter).toLocaleString('ko-KR') : '-'} 이전 로그인 무효`);
await mongoose.disconnect();
process.exit(0);
