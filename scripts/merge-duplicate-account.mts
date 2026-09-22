/**
 * **같은 메일함을 두 번 등록한 것을 하나로 합친다** (2026-09-22, 대표님 결정 "본인 계정이 우선").
 *
 * 무엇이 문제였나:
 *   david@yogico.kr 가 두 번 등록돼 있었다 — 관리자(admin)가 먼저 한 번(9/9), 대표님 본인이 한 번(9/14).
 *   · 매일 도는 수집은 주소마다 **먼저 등록된 계정 하나로만** 모은다 (lib/mail/accounts.ts listMailAccounts('system'))
 *     → 관리자 쪽 계정이 메일을 다 모았고, 대표님 계정은 수집 위치가 50통 넘게 뒤처져 있었다.
 *   · 대표님이 로그인하면 본인 계정으로 새 메일을 가져오는데, 이미 저장된 옛 메일 50통을 다시 읽다 멈춰
 *     아침 이후 새 메일이 안 보였다.
 *   · 거래처 폴더 11개는 관리자 쪽 계정에만 설정돼 있어, 대표님 계정은 받은편지함만 모으고 있었다.
 *   · 관리자 쪽 계정이 살아 있는 한 관리자도 대표님 메일을 봤다.
 *
 * 하는 일 (--apply 일 때만):
 *   1) 없앨 쪽 계정의 메일을 남길 쪽 계정으로 옮긴다 (accountId 만 바꾼다 — 같은 메일함이라 폴더·번호가 그대로 맞다)
 *   2) 거래처 폴더 수집 설정을 합친다
 *   3) 폴더별 수집 위치를 둘 중 앞선 쪽(+DB 에 있는 마지막 번호)으로 맞춘다 — 다음 수집이 새 메일부터 가져온다
 *   4) 없앨 쪽은 **지우지 않고** 사용 중지 + "어디로 합쳐졌는지" 표시 → 목록·범위·발송 어디에도 안 잡힌다
 *   5) 없앨 쪽이 그 아이디의 대표 계정이었으면 그 아이디의 다른 계정을 대표로 올린다
 *
 * 되돌리기용 목록을 backups/ 에 남긴다 (비밀번호는 넣지 않는다).
 *
 * 미리보기: npx tsx scripts/merge-duplicate-account.mts --keep=<남길 id> --drop=<없앨 id>
 * 적용:     npx tsx scripts/merge-duplicate-account.mts --keep=<남길 id> --drop=<없앨 id> --apply
 */
import mongoose from 'mongoose';
import fs from 'fs';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k: string, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const APPLY = process.argv.includes('--apply');
const KEEP = arg('keep');
const DROP = arg('drop');
if (!/^[0-9a-f]{24}$/i.test(KEEP) || !/^[0-9a-f]{24}$/i.test(DROP) || KEEP === DROP) {
  console.error('--keep=<남길 계정 id> --drop=<없앨 계정 id> 가 필요합니다 (서로 달라야 함)');
  process.exit(1);
}

const { accountIdsForOwner } = await import('../src/lib/mail/scope.ts');

await mongoose.connect(process.env.MONGODB_URI!);
const db = mongoose.connection.db!;
const A = db.collection('mailaccounts');
const I = db.collection('inboundmails');
const S = db.collection('mailsyncstates');
const oid = (s: string) => new mongoose.Types.ObjectId(s);

const keep: any = await A.findOne({ _id: oid(KEEP) });
const drop: any = await A.findOne({ _id: oid(DROP) });
if (!keep || !drop) { console.error('계정을 찾지 못했습니다'); process.exit(1); }
const norm = (v: any) => String(v || '').trim().toLowerCase();
if (norm(keep.smtpUser) !== norm(drop.smtpUser) || norm(keep.smtpHost) !== norm(drop.smtpHost)) {
  // 다른 메일함을 합치면 폴더·번호가 안 맞아 엉뚱한 메일이 열린다 — 절대 하지 않는다
  console.error(`같은 메일함이 아닙니다: ${keep.smtpUser}@${keep.smtpHost} ≠ ${drop.smtpUser}@${drop.smtpHost}`);
  process.exit(1);
}
if (drop.mergedInto) { console.error(`이미 합쳐진 계정입니다 (→ ${drop.mergedInto})`); process.exit(1); }

console.log(`메일함 ${keep.smtpUser}`);
console.log(`  남길 것  [${keep.owner}] ${KEEP} · ${keep.accountName}`);
console.log(`  없앨 것  [${drop.owner}] ${DROP} · ${drop.accountName}${drop.isDefault ? ' (그 아이디의 대표 계정)' : ''}`);

// ── 누가 몇 통을 보는가 (합치기 전) ──
const visible = async (user: string) => {
  const ids = await accountIdsForOwner(user);
  return { total: await I.countDocuments({ accountId: { $in: ids } }), mailbox: await I.countDocuments({ accountId: { $in: ids.filter((x) => [KEEP, DROP].includes(x)) } }) };
};
const owners = [...new Set([keep.owner, drop.owner])];
const before: Record<string, any> = {};
for (const u of owners) before[u] = await visible(u);

// ── 옮길 것 ──
const moving = await I.countDocuments({ accountId: DROP });
const folders = [...new Set([...(keep.imapFolders || []), ...(drop.imapFolders || [])])];
const syncKeep = await S.find({ accountId: KEEP }).toArray();
const syncDrop = await S.find({ accountId: DROP }).toArray();
const syncFolders = [...new Set([...syncKeep, ...syncDrop].map((s: any) => s.folder))];
const plan: Array<{ folder: string; keep: number; drop: number; db: number; next: number }> = [];
for (const f of syncFolders) {
  const k = Number(syncKeep.find((s: any) => s.folder === f)?.lastUid || 0);
  const d = Number(syncDrop.find((s: any) => s.folder === f)?.lastUid || 0);
  const top: any[] = await I.find({ accountId: { $in: [KEEP, DROP] }, folder: f }, { projection: { uid: 1 } }).sort({ uid: -1 }).limit(1).toArray();
  const dbMax = Number(top[0]?.uid || 0);
  plan.push({ folder: f, keep: k, drop: d, db: dbMax, next: Math.max(k, d, dbMax) });
}

console.log(`\n옮길 메일 ${moving}통`);
console.log(`거래처 폴더 수집 설정: 남길 쪽 ${(keep.imapFolders || []).length}개 → 합친 뒤 ${folders.length}개`);
console.log('폴더별 수집 위치 (남길 쪽 / 없앨 쪽 / DB 마지막 → 합친 뒤):');
plan.forEach((p) => console.log(`  ${p.folder.padEnd(32)} ${String(p.keep).padStart(6)} / ${String(p.drop).padStart(6)} / ${String(p.db).padStart(6)} → ${p.next}`));
console.log('\n합치기 전 — 누가 이 메일함을 몇 통 보나:');
for (const u of owners) console.log(`  ${u.padEnd(8)} 이 메일함 ${before[u].mailbox}통 (전체 ${before[u].total}통)`);

if (!APPLY) {
  console.log('\n(미리보기입니다 — 실제로 합치려면 --apply)');
  await mongoose.disconnect();
  process.exit(0);
}

// ── 되돌리기 목록 ──
fs.mkdirSync('backups', { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const path = `backups/merge-account-${keep.smtpUser.replace(/[^a-z0-9]/gi, '_')}-${stamp}.json`;
const strip = (a: any) => { const { smtpPassEnc, ...rest } = a; return rest; };   // 비밀번호는 남기지 않는다
const movedIds = (await I.find({ accountId: DROP }, { projection: { _id: 1 } }).toArray()).map((d: any) => String(d._id));
fs.writeFileSync(path, JSON.stringify({ keep: strip(keep), drop: strip(drop), syncKeep, syncDrop, movedMailIds: movedIds }, null, 1));
console.log(`\n되돌리기 목록 ${path} (메일 ${movedIds.length}통 id 포함 · 비밀번호 제외)`);

// 1) 메일 옮기기
const r1 = await I.updateMany({ accountId: DROP }, { $set: { accountId: KEEP } });
console.log(`1) 메일 옮김 ${r1.modifiedCount}통`);

// 2) 거래처 폴더 수집 설정
await A.updateOne({ _id: oid(KEEP) }, { $set: { imapFolders: folders } });
console.log(`2) 거래처 폴더 ${folders.length}개를 남길 쪽 계정이 모으도록 설정`);

// 3) 수집 위치
for (const p of plan) {
  await S.updateOne({ accountId: KEEP, folder: p.folder }, { $set: { accountId: KEEP, folder: p.folder, lastUid: p.next } }, { upsert: true });
}
console.log(`3) 폴더 ${plan.length}개의 수집 위치를 맞춤 — 다음 수집은 새 메일부터`);

// 4) 없앨 쪽 — 지우지 않고 표시만
const now = new Date().toISOString();
await A.updateOne({ _id: oid(DROP) }, { $set: { isActive: false, isDefault: false, mergedInto: KEEP, mergedAt: now } });
console.log(`4) 없앨 쪽 계정 사용 중지 · 합쳐짐 표시 (지우지 않음)`);

// 5) 대표 계정 옮기기
if (drop.isDefault) {
  const stillDefault = await A.countDocuments({ owner: drop.owner, isDefault: true, isActive: { $ne: false }, mergedInto: { $in: [null, ''] } });
  if (!stillDefault) {
    const next: any = await A.find({ owner: drop.owner, isActive: { $ne: false }, mergedInto: { $in: [null, ''] } }).sort({ createdAt: 1 }).limit(1).next();
    if (next) {
      await A.updateOne({ _id: next._id }, { $set: { isDefault: true } });
      console.log(`5) [${drop.owner}] 의 대표 계정을 ${next.smtpUser} 로 바꿈`);
    } else {
      console.log(`5) [${drop.owner}] 에게 남은 계정이 없어 대표 계정이 비었습니다`);
    }
  }
}

// 남길 쪽은 이미 다 가져온 상태 — 첫 로그인 자동 2달 가져오기가 다시 돌지 않게
await A.updateOne({ _id: oid(KEEP) }, { $set: { backfillCursor: null, ...(keep.backfilledAt ? {} : { backfilledAt: new Date() }) } });

// ── 합친 뒤 ──
const after: Record<string, any> = {};
for (const u of owners) after[u] = await visible(u);
console.log('\n합친 뒤 — 누가 이 메일함을 몇 통 보나:');
for (const u of owners) console.log(`  ${u.padEnd(8)} 이 메일함 ${before[u].mailbox} → ${after[u].mailbox}통 (전체 ${before[u].total} → ${after[u].total})`);
console.log(`남은 참조: 없앨 쪽 계정에 붙은 메일 ${await I.countDocuments({ accountId: DROP })}통`);
await mongoose.disconnect();
