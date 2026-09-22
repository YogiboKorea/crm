/**
 * **지금 새 메일을 가져온다** — 서버 없이 바로 (2026-09-22).
 *
 * 매일 도는 수집(오전 7시 30분)과 로그인할 때의 수집 사이에 온 메일은 DB 에 없다.
 * "오늘까지 받은 메일 분석" 전에 이걸 먼저 돌려야 오늘 오전에 온 것까지 빠지지 않는다.
 *
 * scripts/ingest-mail.mjs 는 dev 서버에 관리자 비밀번호로 로그인해야 해서, 여기서는 수집 함수를 직접 부른다.
 * 메일을 **가져오기만** 한다 — 보내거나 지우지 않는다.
 *
 * 사용: npx tsx scripts/ingest-now.mts [--user=david]     (그 아이디가 등록한 계정만)
 *       npx tsx scripts/ingest-now.mts --all               (등록된 모든 계정)
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k: string, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const ALL = process.argv.includes('--all');
const USER = arg('user', 'david');

const { runIngest } = await import('../src/lib/mail/ingest.ts');

await mongoose.connect(process.env.MONGODB_URI!);
const I = mongoose.connection.db!.collection('inboundmails');
const before = await I.countDocuments({});
console.log(`새 메일 가져오기 — ${ALL ? '등록된 모든 계정' : `${USER} 아이디의 계정`}`);

const r = await runIngest({ accountId: 'all', user: ALL ? null : USER });
const after = await I.countDocuments({});

console.log(`  조회 ${r.fetched}통 · 새로 저장 ${r.inserted}통 · 이미 있던 것 ${r.duplicate}통`);
if (r.matched) console.log(`  업체와 연결된 답장 ${r.matched}통 · 답장 받음으로 옮긴 곳 ${r.movedToReplied}곳`);
for (const f of r.folders || []) {
  if (f.inserted || f.errors?.length) {
    console.log(`    ${String(f.accountLabel).padEnd(18)} ${String(f.folder).padEnd(28)} 새로 ${f.inserted}${f.errors?.length ? ` · 실패 ${f.errors.length}` : ''}`);
  }
}
// 실패를 반드시 보여 준다 — 새로 0통이 "새 메일이 없다" 인지 "전부 실패했다" 인지 구분해야 한다
if (r.errors?.length) {
  console.log(`  ⚠ 오류 ${r.errors.length}건:`);
  r.errors.slice(0, 5).forEach((e: string) => console.log(`    - ${String(e).slice(0, 120)}`));
}
console.log(`  DB 메일 ${before} → ${after}통 · ${Math.round((r.durationMs || 0) / 1000)}초`);
await mongoose.disconnect();
process.exit(0);
