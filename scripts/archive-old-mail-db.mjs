/**
 * 예전 메일 프로그램 DB 를 **본문까지 통째로** 파일로 내보낸다 (되돌릴 수 있게).
 *
 * 왜: HTML 본문을 비우기 전에 원본을 남겨 둔다. 특히 `emaildata_jay` 는 CRM 에 사본이 없는
 * 메일이 527통 있어(2022~2026 거래처 메일), DB 안의 것이 마지막 사본인 경우가 있다.
 *
 * 어디에 저장하나: **저장소 밖**(기본값은 바탕화면). 이 저장소는 공개였던 이력이 있어
 * 거래처 메일 본문을 저장소 안에 두지 않는다. gzip 으로 줄여 저장한다.
 *
 * 사용: node scripts/archive-old-mail-db.mjs --db=emaildata_jay
 *       node scripts/archive-old-mail-db.mjs --db=emaildata --out="C:/어디/폴더"
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=');
const DB = arg('db');
const OUT = arg('out', path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Desktop', 'mail-archive-backup'));
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';
if (!DB) { console.error('--db=emaildata 처럼 DB 이름이 필요합니다'); process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI);
const client = mongoose.connection.getClient();
if (DB === mongoose.connection.db.databaseName) { console.error(`${DB} 는 CRM DB 입니다`); process.exit(1); }
const M = client.db(DB).collection('mails');

const total = await M.countDocuments();
fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `${DB}-${new Date().toISOString().slice(0, 10)}.jsonl.gz`);
const gz = zlib.createGzip({ level: 9 });
const sink = fs.createWriteStream(file);
gz.pipe(sink);

let n = 0;
const cursor = M.find({}, { sort: { _id: 1 } });
for await (const doc of cursor) {
  if (!gz.write(JSON.stringify(doc) + '\n')) await new Promise((r) => gz.once('drain', r));
  if (++n % 200 === 0) process.stdout.write(`\r  ${n}/${total}통`);
}
gz.end();
await new Promise((r) => sink.on('close', r));
const size = fs.statSync(file).size;
console.log(`\r내보냄 ${n}/${total}통 → ${file} (${mb(size)})`);

// 파일이 실제로 읽히는지, 통수가 맞는지 확인한다 — 확인 안 된 백업은 백업이 아니다
let back = 0; let withBody = 0;
await new Promise((res, rej) => {
  let buf = '';
  fs.createReadStream(file).pipe(zlib.createGunzip())
    .on('data', (c) => {
      buf += c.toString('utf8');
      const lines = buf.split('\n'); buf = lines.pop();
      for (const l of lines) { if (!l) continue; back++; const d = JSON.parse(l); if (d.raw?.html || d.raw?.text) withBody++; }
    })
    .on('end', () => { if (buf.trim()) { back++; if (JSON.parse(buf).raw) withBody++; } res(); })
    .on('error', rej);
});
console.log(`되읽기 확인 — ${back}통 (본문 있는 것 ${withBody}통) · DB 와 ${back === total ? '일치' : '불일치 ⚠'}`);
await mongoose.disconnect();
process.exit(back === total ? 0 : 1);
