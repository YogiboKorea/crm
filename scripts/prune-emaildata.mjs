/**
 * **예전 메일 수집 프로그램(emailData)의 DB 에서 한 달 넘은 메일을 지운다** (2026-09-22, 대표님 결정).
 *
 * 왜:
 *   · `emaildata` DB 하나가 무료 한도 512MB 의 46% (236MB) 를 쓰고 있었다.
 *   · CRM 이 쓰는 DB(`test`) 가 아니다 — CRM 으로 옮기기 전의 예전 프로그램이 아직 매일 메일을 모으고 있고,
 *     그 메일을 **본문 통째로**(통당 평균 81KB) 저장한다. CRM 은 같은 메일을 미리보기 4KB 로만 저장한다.
 *   · 최근 메일 200통 중 197통이 CRM 에도 그대로 있다 — 사실상 중복이다.
 *   · 대표님 방침: "최대 한 달까지만 두고, 한 달 지난 것은 삭제".
 *
 * 무엇을 지우나: `mails` 컬렉션에서 메일 날짜(date)가 --days 일보다 오래된 것. 다른 컬렉션(설정·수집 위치)은 건드리지 않는다.
 * 지우기 전에 지울 메일의 목록(제목·보낸사람·날짜·Message-ID — 본문 제외)을 backups/ 에 남긴다.
 * CRM(`test`) DB 는 건드리지 않는다.
 *
 * 미리보기: node scripts/prune-emaildata.mjs --db=emaildata --days=30
 * 적용:     node scripts/prune-emaildata.mjs --db=emaildata --days=30 --apply
 * 자동 유지: node scripts/prune-emaildata.mjs --db=emaildata --days=30 --apply --auto
 *           (지금 지우고, 앞으로도 30일 지난 메일은 MongoDB 가 알아서 지운다)
 */
import mongoose from 'mongoose';
import fs from 'fs';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const APPLY = process.argv.includes('--apply');
const DB = arg('db', 'emaildata');
const DAYS = Number(arg('days', '30')) || 30;
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';

await mongoose.connect(process.env.MONGODB_URI);
const client = mongoose.connection.getClient();
const crmName = mongoose.connection.db.databaseName;
if (DB === crmName) {
  // CRM DB 는 이 도구로 지우지 않는다 — 업체 대화 이력이 끊긴다. CRM 정리는 scripts/prune-old-mail.mjs 로.
  console.error(`${DB} 는 CRM 이 쓰는 DB 입니다. 이 도구로는 지우지 않습니다.`);
  process.exit(1);
}
const edb = client.db(DB);
const M = edb.collection('mails');
const cut = new Date(Date.now() - DAYS * 86400000);

// date 가 문자열로 저장돼 있을 수도 있다 — 둘 다 잡는다
const sample = await M.findOne({}, { projection: { date: 1 } });
const isDate = sample?.date instanceof Date;
const oldFilter = isDate
  ? { date: { $lt: cut } }
  : { $expr: { $lt: [{ $toDate: '$date' }, cut] } };
const noDate = { $or: [{ date: null }, { date: { $exists: false } }] };

const size = async (filter) => {
  const [r] = await M.aggregate([{ $match: filter }, { $group: { _id: null, n: { $sum: 1 }, b: { $sum: { $bsonSize: '$$ROOT' } } } }]).toArray();
  return { n: r?.n || 0, b: r?.b || 0 };
};
const statsBefore = await edb.stats();
const all = await size({});
const old = await size(oldFilter);
const undated = await M.countDocuments(noDate);

console.log(`DB ${DB} — 데이터 ${mb(statsBefore.dataSize)} (디스크 ${mb(statsBefore.storageSize)})`);
console.log(`메일 ${all.n}통 · ${mb(all.b)}`);
console.log(`  ${DAYS}일(${cut.toLocaleDateString('ko-KR')}) 보다 오래된 것: ${old.n}통 · ${mb(old.b)}  ← 지울 것`);
console.log(`  남는 것: ${all.n - old.n}통 · ${mb(all.b - old.b)}`);
if (undated) console.log(`  날짜가 없는 메일 ${undated}통은 건드리지 않습니다`);

// CRM 에도 있는지 — 지워도 CRM 에서는 계속 볼 수 있는지 알려 준다
const oldSample = await M.find({ ...oldFilter, messageId: { $nin: ['', null] } }, { projection: { messageId: 1 } }).limit(500).toArray();
const inCrm = oldSample.length
  ? await mongoose.connection.db.collection('inboundmails').countDocuments({ messageId: { $in: oldSample.map((s) => s.messageId) } })
  : 0;
if (oldSample.length) console.log(`  지울 것 중 표본 ${oldSample.length}통 가운데 CRM 에도 있는 것: ${inCrm}통 (나머지는 CRM 수집 기간 밖의 옛 메일)`);

if (!APPLY) {
  console.log('\n(미리보기입니다 — 실제로 지우려면 --apply)');
  await mongoose.disconnect();
  process.exit(0);
}

// 지울 목록 — 본문은 넣지 않는다
if (old.n) {
  // 같은 날 두 번 돌려도 앞의 목록을 덮어쓰지 않게 시각까지 붙인다
  fs.mkdirSync('backups', { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const path = `backups/pruned-${DB}-${stamp}.json`;
  const list = await M.find(oldFilter, { projection: { messageId: 1, subject: 1, date: 1, 'from.address': 1, folder: 1, uid: 1, accountId: 1 } }).toArray();
  fs.writeFileSync(path, JSON.stringify(list, null, 1));
  const r = await M.deleteMany(oldFilter);
  const statsAfter = await edb.stats();
  console.log(`\n지움 ${r.deletedCount}통 · 목록 ${path} (본문 제외)`);
  console.log(`DB ${DB} 데이터 ${mb(statsBefore.dataSize)} → ${mb(statsAfter.dataSize)}`);
} else {
  console.log('\n지울 메일 없음');
}

// --auto: 앞으로도 --days 가 지난 메일은 MongoDB 가 알아서 지운다 (TTL 색인 · 1분 간격 점검).
// 예전 프로그램은 매일 아침 새 메일을 계속 넣으므로, 한 번 지우는 것만으로는 다시 찬다.
// 예전 프로그램 코드는 건드리지 않는다 — 그 프로그램은 lastUid 다음 메일만 받으므로 지운 메일을 다시 받아오지 않는다.
// 되돌리기: db.mails.dropIndex('auto_delete_old_mail')
if (process.argv.includes('--auto')) {
  if (!isDate) {
    console.log('date 가 날짜 형식이 아니라 자동 삭제를 걸 수 없습니다 (TTL 은 날짜 칸에만 동작)');
  } else {
    const secs = DAYS * 86400;
    const name = 'auto_delete_old_mail';
    const has = (await M.indexes()).find((i) => i.name === name);
    if (!has) await M.createIndex({ date: 1 }, { name, expireAfterSeconds: secs });
    else if (has.expireAfterSeconds !== secs) await edb.command({ collMod: 'mails', index: { name, expireAfterSeconds: secs } });
    console.log(`자동 삭제 켬 — 메일 날짜가 ${DAYS}일 지나면 MongoDB 가 알아서 지웁니다 (색인 ${name})`);
  }
}
await mongoose.disconnect();
