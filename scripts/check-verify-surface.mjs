/**
 * "AI 검증 시작" 버튼을 어디에 달아야 하는지 정하기 위한 실측.
 *
 * 묻는 것:
 *  1) 새로 올린 데이터는 어느 stage 로 들어가나 (버튼이 뜰 화면)
 *  2) AI 검증 대상이 실제로 몇 건인가 (버튼에 적을 숫자)
 *  3) 검증 완료 409곳은 왜 aiVerifiedAt 이 비어 있나
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local' });

await mongoose.connect(process.env.MONGODB_URI);
const L = mongoose.connection.collection('leads');

const NO_AI = {
  $or: [
    { 'verification.aiVerifiedAt': { $exists: false } },
    { 'verification.aiVerifiedAt': '' },
  ],
};
const NOT_KOREA = { Country: { $not: /korea|^kr$|대한민국|한국/i } };
const ALIVE = { deleted: { $ne: true } };

console.log('── 1. 단계별 현황 ──');
const rows = await L.aggregate([
  { $match: ALIVE },
  {
    $group: {
      _id: { $ifNull: ['$stage', 'imported'] },
      n: { $sum: 1 },
      noAi: { $sum: { $cond: [{ $in: ['$verification.aiVerifiedAt', [null, '', undefined]] }, 1, 0] } },
      hasEmail: { $sum: { $cond: [{ $regexMatch: { input: { $ifNull: ['$Email', ''] }, regex: /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/ } }, 1, 0] } },
    },
  },
  { $sort: { n: -1 } },
]).toArray();
console.log('   단계          전체   AI미검증  메일있음');
for (const r of rows) {
  console.log(`   ${String(r._id).padEnd(12)} ${String(r.n).padStart(5)} ${String(r.noAi).padStart(9)} ${String(r.hasEmail).padStart(9)}`);
}

console.log('\n── 2. AI 검증 대상 (scope 별) ──');
const scopes = {
  'verifying-stage (검증 대기)': { stage: 'verifying', ...NO_AI },
  'imported (가져오기)': { stage: 'imported', ...NO_AI },
  'all-unverified (전체 AI미검증)': { ...NO_AI },
  '  └ 한국 제외': { ...NO_AI, ...NOT_KOREA },
  '  └ 한국 제외 + 안 지운 것': { ...NO_AI, ...NOT_KOREA, ...ALIVE },
};
for (const [name, f] of Object.entries(scopes)) {
  console.log(`   ${name.padEnd(32)} ${String(await L.countDocuments(f)).padStart(6)}건`);
}

console.log('\n── 3. 검증 완료 409곳은 어떻게 검증됐나 ──');
const v = await L.find({ stage: 'verified', ...ALIVE, ...NO_AI })
  .limit(3)
  .project({ leadId: 1, Company: 1, verification: 1, recoScore: 1 })
  .toArray();
for (const l of v) {
  const ver = l.verification || {};
  console.log(`   ${l.Company}`);
  console.log(`      verifiedAt   ${ver.verifiedAt || '(없음)'}`);
  console.log(`      score        ${ver.score ?? '(없음)'}`);
  console.log(`      aiVerdict    ${ver.aiVerdict || '(없음)'}`);
  console.log(`      aiVerifiedAt ${ver.aiVerifiedAt || '(없음)'}`);
  console.log(`      recoScore    ${l.recoScore ?? '(없음)'}`);
}
const withRuleVerify = await L.countDocuments({
  stage: 'verified', ...ALIVE, 'verification.verifiedAt': { $exists: true, $ne: '' },
});
const withAiVerdict = await L.countDocuments({
  stage: 'verified', ...ALIVE, 'verification.aiVerdict': { $exists: true, $ne: '' },
});
console.log(`\n   검증 완료 중 규칙검증(verifiedAt) 있음 : ${withRuleVerify}`);
console.log(`   검증 완료 중 AI판정(aiVerdict) 있음    : ${withAiVerdict}`);

console.log('\n── 4. 최근 들어온 것 (import 가 어디로 가는지) ──');
const recent = await L.find(ALIVE)
  .sort({ createdAt: -1 }).limit(5)
  .project({ Company: 1, stage: 1, importBatch: 1, createdAt: 1 })
  .toArray();
for (const l of recent) {
  console.log(`   ${String(l.stage || 'imported').padEnd(11)} ${String(l.importBatch || '-').slice(0, 24).padEnd(26)} ${String(l.Company).slice(0, 34)}`);
}

await mongoose.disconnect();
