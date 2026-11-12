/**
 * 옛 메일 가져오기 — 한 메일함에만, 수집 창(2달)보다 오래된 기간을 넣는다 (2026-11-12).
 * 첫 사용: 대표님(david@) 메일함 6개월 치 — 2026-01-01 ~ 2026-07-16 (그 뒤는 이미 있다).
 *
 * 하는 일은 lib/mail/ingest.ts importOldMail — 평소 수집과 같은 분류·거래처 폴더·로컬 분석,
 * **업체(리드) 연결은 하지 않는다** (옛 메일이 진행 중인 업체의 단계·회신 필요·자동 재발송을 건드리지 않게).
 * 메일 서버에서는 읽기만 한다. 넣은 메일에는 표시(tags)를 달아 두어 나중에 골라 지울 수 있다.
 *
 * 사용: npx tsx scripts/import-old-mail.mts                          (세어 보기만 — 넣지 않는다)
 *       npx tsx scripts/import-old-mail.mts --apply                  (실제로 넣기)
 *       옵션: --owner=david --since=2026-01-01 --before=2026-07-17
 *       끊긴 자리부터 이어 받기: --folders=INBOX --after-uid=52999 --apply
 * 되돌리기: inboundmails 에서 tags 에 표시가 있는 것만 지우면 된다 (아래 TAG).
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k: string, d: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const APPLY = process.argv.includes('--apply');
const OWNER = arg('owner', 'david');
const SINCE_DAY = arg('since', '2026-01-01');
const BEFORE_DAY = arg('before', '2026-07-17');
const SINCE = new Date(`${SINCE_DAY}T00:00:00+09:00`);
const BEFORE = new Date(`${BEFORE_DAY}T00:00:00+09:00`);
const FOLDERS = arg('folders', '') ? arg('folders', '').split(',').map((s) => s.trim()).filter(Boolean) : undefined;
const AFTER_UID = Number(arg('after-uid', '0')) || 0;
const TAG = `old-mail-import-${new Date().toISOString().slice(0, 10)}`;
const MB = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;

const { toImapConfig } = await import('../src/lib/mail/accounts.ts');
const { withOpenAccount } = await import('../src/lib/mail/imap.ts');
const { importOldMail, importFolders } = await import('../src/lib/mail/ingest.ts');
const { accountIdsForOwner } = await import('../src/lib/mail/scope.ts');

await mongoose.connect(process.env.MONGODB_URI!);
const db = mongoose.connection.db!;
const acc: any = await db.collection('mailaccounts').findOne({ owner: OWNER, mergedInto: { $in: [null, ''] }, isActive: { $ne: false } });
if (!acc) { console.log(`${OWNER} 아이디의 메일 계정이 없습니다`); process.exit(1); }
console.log(`메일함 ${acc.smtpUser} (${OWNER}) · 기간 ${SINCE_DAY} 부터 ${BEFORE_DAY} 전까지`);

// 1) 세어 보기 — 폴더별 통수 · 내려받을 크기 (메일 서버에서 읽기만)
let total = 0, bytes = 0;
await withOpenAccount(toImapConfig(acc, 'INBOX'), async (sc: any) => {
  const client = sc.__client;
  const boxes = (await client.list()).filter((b: any) => !b.flags?.has?.('\\Noselect')).map((b: any) => b.path);
  const folders = FOLDERS || importFolders(boxes, acc.imapFolders || []);   // 넣을 때와 같은 폴더 (휴지통 등은 뺀다)
  for (const f of folders) {
    const lock = await client.getMailboxLock(f);
    try {
      const uids = (((await client.search({ since: SINCE, before: BEFORE }, { uid: true })) || []) as number[]).filter((u) => u > AFTER_UID);
      let size = 0;
      if (uids.length) for await (const m of client.fetch(uids.join(','), { uid: true, size: true }, { uid: true })) size += m.size || 0;
      total += uids.length; bytes += size;
      if (uids.length) console.log(`  ${f.padEnd(34)} ${String(uids.length).padStart(5)}통 · ${MB(size)}`);
    } finally { lock.release(); }
  }
});
const st0: any = await db.stats();
console.log(`합계 ${total}통 · 내려받을 크기 ${MB(bytes)} (첨부 포함 — DB 에는 본문 앞부분만 남는다, 통당 약 10KB)`);
console.log(`DB 지금 ${MB(st0.storageSize + st0.indexSize)} → 예상 약 ${MB(st0.storageSize + st0.indexSize + total * 10 * 1024)} (한도 512MB)`);
if (!APPLY) { console.log('\n(세어 보기만 했습니다 — 넣으려면 --apply)'); await mongoose.disconnect(); process.exit(0); }

// 2) 넣기
const started = new Date();
const t0 = Date.now();
let lastLog = 0;
const r = await importOldMail({
  accountId: String(acc._id), user: OWNER, since: SINCE, before: BEFORE,
  // 첨부까지 통째로 받아 오므로 한 번에 적게 — 큰 첨부가 몰린 묶음에서 메모리가 터지지 않게
  batchSize: 10,
  folders: FOLDERS,
  startAfterUid: FOLDERS && AFTER_UID ? Object.fromEntries(FOLDERS.map((f) => [f, AFTER_UID])) : undefined,
  onProgress: (line) => { if (Date.now() - lastLog > 15_000) { lastLog = Date.now(); console.log(`  … ${line} (${Math.round((Date.now() - t0) / 1000)}초)`); } },
});
console.log(`넣기 끝 — 폴더 ${r.folders.length}개 · 받은 ${r.fetched}통 · 새로 넣은 ${r.inserted}통 · 이미 있던 ${r.duplicate}통 · 오류 ${r.errors.length}건 · ${Math.round((Date.now() - t0) / 1000)}초`);
for (const e of r.errors.slice(0, 10)) console.log('  ! ' + e);
if (r.skipped.length) console.log(`받지 못해 건너뛴 메일 ${r.skipped.length}통: ${r.skipped.join(' · ')}`);

// 3) 표시 달기 — 이번에 넣은 것만 (나중에 골라 지울 수 있게)
const ids = await accountIdsForOwner(OWNER);
const tagged = await db.collection('inboundmails').updateMany(
  { accountId: { $in: ids }, createdAt: { $gte: started }, date: { $lt: BEFORE } },
  { $addToSet: { tags: TAG } },
);
console.log(`표시 '${TAG}' — ${tagged.modifiedCount}통`);
const months = await db.collection('inboundmails').aggregate([
  { $match: { accountId: { $in: ids }, tags: TAG } },
  { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: '+09:00' } }, n: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]).toArray();
console.log('달별:', months.map((m: any) => `${m._id} ${m.n}`).join(' · '));
const st1: any = await db.stats();
console.log(`DB ${MB(st0.storageSize + st0.indexSize)} → ${MB(st1.storageSize + st1.indexSize)}`);
await mongoose.disconnect();
process.exit(0);
