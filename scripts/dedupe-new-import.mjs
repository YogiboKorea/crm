/**
 * 새로 올린 파일(배치) 안의 업체를 **이미 있던 업체와 대조해 중복을 걸러낸다** (1차 정리).
 *
 * 무엇을 같은 업체로 보는가 (앞선 dedup 스크립트들과 같은 기준, 느슨한 순서):
 *   1) 메일 주소가 같다            — 가장 확실
 *   2) 홈페이지 도메인이 같다      — 같은 회사의 다른 담당자
 *   3) 회사명 + 국가가 같다        — 이름만 같고 국가가 다르면 다른 업체로 본다
 * 같은 파일 안에서 두 번 들어온 것도 함께 걸러낸다(먼저 들어온 것을 남긴다).
 *
 * 지우지 않고 deleted 표시만 한다 — 되돌릴 수 있게 대상 목록을 backups/ 에 남긴다.
 * 이미 연락한 곳(발송 이력이 있는 곳)은 건드리지 않는다.
 *
 * 미리보기: node scripts/dedupe-new-import.mjs --batch=<배치명>
 * 적용:     node scripts/dedupe-new-import.mjs --batch=<배치명> --apply
 * 배치명을 모르면 그냥 실행하면 최근 배치 목록을 보여준다.
 */
import mongoose from 'mongoose';
import fs from 'fs';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const APPLY = process.argv.includes('--apply');
const batch = (process.argv.find((a) => a.startsWith('--batch=')) || '').split('=')[1];

await mongoose.connect(process.env.MONGODB_URI);
const L = mongoose.connection.db.collection('leads');

if (!batch) {
  const rows = await L.aggregate([
    { $match: { deleted: { $ne: true } } },
    { $group: { _id: { $ifNull: ['$importBatch', '(없음)'] }, n: { $sum: 1 }, last: { $max: '$createdAt' } } },
    { $sort: { last: -1 } }, { $limit: 10 },
  ]).toArray();
  console.log('최근 올린 파일(배치):');
  rows.forEach((r) => console.log(`  ${String(r._id).padEnd(34)} ${String(r.n).padStart(5)}곳 · ${new Date(r.last).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`));
  console.log('\n--batch=<배치명> 으로 다시 실행하세요.');
  await mongoose.disconnect();
  process.exit(0);
}

const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
const REAL_EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const emailKey = (l) => (REAL_EMAIL.test(String(l.Email || '').trim()) ? norm(l.Email) : '');
const domainKey = (l) => {
  const v = String(l.WebsiteContact || '').trim();
  if (!v) return '';
  try { return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).hostname.replace(/^www\./i, '').toLowerCase(); }
  catch { return ''; }
};
const nameKey = (l) => (norm(l.Company) && norm(l.Country) ? `${norm(l.Company)}::${norm(l.Country)}` : '');

const PROJ = { leadId: 1, Company: 1, Country: 1, Email: 1, WebsiteContact: 1, stage: 1, createdAt: 1, importBatch: 1, emailHistory: 1 };
const incoming = await L.find({ importBatch: batch, deleted: { $ne: true } }, { projection: PROJ }).sort({ createdAt: 1 }).toArray();
if (!incoming.length) { console.log(`배치 "${batch}" 에 업체가 없습니다.`); await mongoose.disconnect(); process.exit(1); }
const existing = await L.find({ importBatch: { $ne: batch }, deleted: { $ne: true } }, { projection: PROJ }).toArray();
console.log(`새로 올린 ${incoming.length}곳 · 이미 있던 ${existing.length}곳과 대조합니다`);

const byEmail = new Map(); const byDomain = new Map(); const byName = new Map();
for (const l of existing) {
  const e = emailKey(l); if (e && !byEmail.has(e)) byEmail.set(e, l);
  const d = domainKey(l); if (d && !byDomain.has(d)) byDomain.set(d, l);
  const n = nameKey(l); if (n && !byName.has(n)) byName.set(n, l);
}

const dups = [];
const keep = [];
for (const l of incoming) {
  if ((l.emailHistory || []).length) { keep.push(l); continue; }   // 이미 연락한 곳은 건드리지 않는다
  const e = emailKey(l); const d = domainKey(l); const n = nameKey(l);
  let hit = null; let by = '';
  if (e && byEmail.has(e)) { hit = byEmail.get(e); by = '메일 주소'; }
  else if (d && byDomain.has(d)) { hit = byDomain.get(d); by = '홈페이지 도메인'; }
  else if (n && byName.has(n)) { hit = byName.get(n); by = '회사명+국가'; }
  if (hit) { dups.push({ l, hit, by }); continue; }
  keep.push(l);
  // 같은 파일 안의 중복도 막는다 — 지금 남긴 것을 기준에 추가
  if (e) byEmail.set(e, l);
  if (d) byDomain.set(d, l);
  if (n) byName.set(n, l);
}

const byReason = dups.reduce((m, x) => ({ ...m, [x.by]: (m[x.by] || 0) + 1 }), {});
console.log(`\n중복 ${dups.length}곳 · 남길 곳 ${keep.length}곳 · 사유별 ${JSON.stringify(byReason)}`);
dups.slice(0, 15).forEach((x) => console.log(`  - [${x.by}] ${String(x.l.Company).slice(0, 34).padEnd(34)} ${String(x.l.Email || '').slice(0, 28).padEnd(28)} → 기존: ${String(x.hit.Company).slice(0, 28)} (${x.hit.stage})`));
if (dups.length > 15) console.log(`  … 외 ${dups.length - 15}곳`);

if (!APPLY) { console.log('\n(미리보기 — 적용하려면 --apply)'); await mongoose.disconnect(); process.exit(0); }

fs.mkdirSync('backups', { recursive: true });
const path = `backups/dedupe-${batch}-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(path, JSON.stringify(dups.map((x) => ({ leadId: x.l.leadId, company: x.l.Company, email: x.l.Email, by: x.by, keeper: x.hit.leadId, keeperCompany: x.hit.Company })), null, 1));
const now = new Date().toISOString();
const r = await L.bulkWrite(dups.map((x) => ({
  updateOne: {
    filter: { leadId: x.l.leadId },
    update: { $set: { deleted: true, deletedAt: now, deletedReason: `중복 — 기존 업체와 같음 (${x.by})`, dupKeeperLeadId: x.hit.leadId, dupMatchedBy: x.by } },
  },
})));
console.log(`\n중복 표시 ${r.modifiedCount}곳 · 되돌리기 목록 ${path}`);
console.log(`남은 새 업체 ${await L.countDocuments({ importBatch: batch, deleted: { $ne: true } })}곳`);
await mongoose.disconnect();
