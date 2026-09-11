/**
 * 올린 데이터 화면의 세 버튼이 실제로 몇 건을 다루는지 DB 로 확인한다.
 *
 * 버튼에 적히는 숫자가 틀리면 안 되는 이유가 둘이다.
 *  · [AI 검증 시작] 은 누르면 건당 요금이 나간다. 50건인 줄 알고 눌렀는데
 *    800건이면 요금이 16배가 된다.
 *  · [직접 검토 시작] 은 눌러서 들어갔는데 0건이면 "고장났나" 가 된다.
 *    예전에 418곳 중 9곳만 나오던 일이 실제로 있었다.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local' });

await mongoose.connect(process.env.MONGODB_URI);
const L = mongoose.connection.collection('leads');

const ALIVE = { deleted: { $ne: true } };
const NOT_AI_SEARCH = { importBatch: { $not: /^ai-search-/ } };
const NO_AI = {
  $or: [
    { 'verification.aiVerifiedAt': { $exists: false } },
    { 'verification.aiVerifiedAt': '' },
  ],
};
const NOT_KOREA = { Country: { $not: /korea|^kr$|대한민국|한국/i } };
const REAL_EMAIL = { Email: { $regex: /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/ } };

// ── 1. [🧠 AI 검증 시작] — /api/leads/verify-ai/count?scope=legacy
const aiFilter = { ...NOT_AI_SEARCH, ...NO_AI, ...NOT_KOREA, ...ALIVE };
const aiTarget = await L.countDocuments(aiFilter);
const aiKorea = await L.countDocuments({ ...NOT_AI_SEARCH, ...NO_AI, ...ALIVE, Country: /korea|^kr$|대한민국|한국/i });
const usd = aiTarget * 0.0005;

console.log('🧠 AI 검증 시작');
console.log(`   대상        ${aiTarget.toLocaleString()}곳`);
console.log(`   한국 제외   ${aiKorea.toLocaleString()}곳`);
console.log(`   예상 요금   약 $${(Math.round(usd * 100) / 100).toFixed(2)}  ≈ ₩${Math.round(usd * 1400).toLocaleString()}`);
console.log(`   청크        ${Math.ceil(aiTarget / 20)}회 (20건씩)`);

// ── 2. [🔎 직접 검토 시작] — /api/leads/review?source=legacy
const LEGACY_STAGES = ['imported', 'verifying', 'archived', 'ai-searched'];
const rvFilter = {
  ...NOT_AI_SEARCH,
  stage: { $in: LEGACY_STAGES },
  ...ALIVE,
  ...REAL_EMAIL,
  // AI 가 무관으로 본 것은 [검증 실패] 화면과 겹치므로 뺀다
  'verification.aiVerdict': { $ne: 'not-buyer' },
};
const rvTotal = await L.countDocuments(rvFilter);
console.log('\n🔎 직접 검토 시작 (올린 데이터)');
console.log(`   검토 대상   ${rvTotal.toLocaleString()}곳`);

const first = await L.find(rvFilter)
  .sort({ recoScore: -1, Country: 1, Company: 1 }).limit(5)
  .project({ Company: 1, Country: 1, Email: 1, stage: 1, recoScore: 1, 'verification.aiVerdict': 1 })
  .toArray();
console.log('   첫 화면:');
for (const l of first) {
  const v = l.verification?.aiVerdict || '판정없음';
  console.log(`     ${String(l.recoScore ?? '-').padStart(3)} ${String(l.stage).padEnd(11)} ${v.padEnd(13)} ${String(l.Company).slice(0, 30).padEnd(32)} ${l.Email}`);
}

// 검토 대상의 단계 분포 — 어디서 온 것들인지
const dist = await L.aggregate([
  { $match: rvFilter },
  { $group: { _id: { s: '$stage', v: { $ifNull: ['$verification.aiVerdict', '판정없음'] } }, n: { $sum: 1 } } },
  { $sort: { n: -1 } }, { $limit: 8 },
]).toArray();
console.log('   구성:');
for (const r of dist) console.log(`     ${String(r.n).padStart(5)}  ${String(r._id.s).padEnd(12)} ${r._id.v}`);

// ── 3. [✅ AI 검증 완료] 는 그대로인가
const verified = await L.countDocuments({ stage: 'verified', ...ALIVE, ...REAL_EMAIL });
console.log(`\n✅ AI 검증 완료          ${verified.toLocaleString()}곳 (직접 검토 기본 풀)`);

// ── 4. 두 풀이 겹치지 않는가 — 겹치면 같은 곳이 양쪽에 뜬다
const overlap = await L.countDocuments({ $and: [rvFilter, { stage: 'verified' }] });
console.log(`   두 풀의 겹침          ${overlap}곳 ${overlap === 0 ? '(OK)' : '(X — 같은 곳이 양쪽에 뜬다)'}`);

await mongoose.disconnect();
process.exit(overlap === 0 ? 0 : 1);
