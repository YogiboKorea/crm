/**
 * 예전 메일 프로그램 DB 에서 **메일의 HTML 본문만 비운다** (메일은 지우지 않는다).
 *
 * 왜 지우는 대신 이 방법인가 (2026-09-28 점검 결과):
 *   · 두 DB 용량의 90%가 `raw.html` 이다 — emaildata 76.3MB / 92.0MB, emaildata_jay 70.4MB / 95.7MB.
 *   · 30일 넘은 메일을 지우면 75MB 가 줄지만, `emaildata_jay` 는 CRM 에 사본이 없는 메일이 527통
 *     (2022~2026 거래처·선적 메일) 들어 있는 **아카이브**다. 지우면 되돌릴 수 없다.
 *   · HTML 만 비우면 메일은 한 통도 사라지지 않고 147MB 가 빈다. 제목·보낸사람·날짜·글자 본문
 *     (`raw.text`)·분석 결과는 그대로 남아 계속 읽고 검색할 수 있다. 잃는 것은 서식과 그림뿐이고,
 *     원본은 이카운트 메일 서버에 있다.
 *
 * 안전장치:
 *   · 글자 본문(`raw.text`)이 없는 메일은 건드리지 않는다 — 비우면 본문이 통째로 사라진다.
 *   · CRM DB 는 대상이 될 수 없다.
 *   · 돌리기 전에 scripts/archive-old-mail-db.mjs 로 본문까지 파일로 내보내 둘 것.
 *
 * 미리보기: node scripts/strip-mail-html.mjs --db=emaildata_jay
 * 적용:     node scripts/strip-mail-html.mjs --db=emaildata_jay --apply
 * 30일 지난 것만: --days=30
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=');
const APPLY = process.argv.includes('--apply');
const DB = arg('db');
const DAYS = Number(arg('days', '0')) || 0;
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';
if (!DB) { console.error('--db=emaildata 처럼 DB 이름이 필요합니다'); process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI);
const client = mongoose.connection.getClient();
if (DB === mongoose.connection.db.databaseName) { console.error(`${DB} 는 CRM 이 쓰는 DB 입니다`); process.exit(1); }
const db = client.db(DB);
const M = db.collection('mails');

// 글자 본문이 남아 있는 메일만 — 본문이 HTML 뿐인 메일은 그대로 둔다
const filter = {
  'raw.html': { $exists: true, $ne: '' },
  'raw.text': { $exists: true, $nin: ['', null] },
  ...(DAYS ? { date: { $lt: new Date(Date.now() - DAYS * 86400000) } } : {}),
};
const skipFilter = { 'raw.html': { $exists: true, $ne: '' }, $or: [{ 'raw.text': { $in: ['', null] } }, { 'raw.text': { $exists: false } }] };

const before = await db.stats();
const [sum] = await M.aggregate([
  { $match: filter },
  { $group: { _id: null, n: { $sum: 1 }, html: { $sum: { $strLenBytes: { $ifNull: ['$raw.html', ''] } } } } },
]).toArray();
const skip = await M.countDocuments(skipFilter);

console.log(`DB ${DB} — 데이터 ${mb(before.dataSize)} · 메일 ${await M.countDocuments()}통`);
console.log(`  HTML 을 비울 메일: ${sum?.n || 0}통 · 비는 용량 ${mb(sum?.html || 0)}${DAYS ? ` (${DAYS}일 지난 것만)` : ' (전체 기간)'}`);
console.log(`  건드리지 않는 것: 글자 본문이 없어 HTML 이 유일한 본문인 메일 ${skip}통`);

if (!APPLY) { console.log('\n(미리보기입니다 — 실제로 비우려면 --apply)'); await mongoose.disconnect(); process.exit(0); }

const r = await M.updateMany(filter, { $unset: { 'raw.html': '' }, $set: { htmlStrippedAt: new Date() } });
const after = await db.stats();
const leftText = await M.countDocuments({ 'raw.text': { $exists: true, $nin: ['', null] } });
console.log(`\n비움 ${r.modifiedCount}통 · 글자 본문이 남아 있는 메일 ${leftText}통`);
console.log(`DB ${DB} 데이터 ${mb(before.dataSize)} → ${mb(after.dataSize)}`);
await mongoose.disconnect();
