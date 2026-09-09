import mongoose from 'mongoose';
import 'dotenv/config';
const URI = process.env.MONGODB_URI;
if (!URI) { console.error('no URI'); process.exit(1); }

await mongoose.connect(URI);
const Lead = mongoose.connection.db.collection('leads');

// 1. Find dermaofficial and venuseurope by domain/company name
const searchQueries = [
  { WebsiteContact: /dermaofficial/i },
  { WebsiteContact: /venuseurope/i },
  { Company: /derma/i },
  { Company: /venus/i },
];

console.log('\n=== 두 업체 존재 여부 ===');
for (const q of searchQueries) {
  const docs = await Lead.find(q).project({ leadId: 1, Company: 1, Country: 1, WebsiteContact: 1, Email: 1, stage: 1 }).limit(5).toArray();
  console.log(`\nQuery: ${JSON.stringify(q)} → ${docs.length}건`);
  docs.forEach(d => console.log(`  [${d.stage||'none'}] ${d.Company} (${d.Country}) — ${d.WebsiteContact||'no-site'} — ${d.Email||'no-email'}`));
}

// 2. Total counts
const total = await Lead.countDocuments({});
const byStage = await Lead.aggregate([{ $group: { _id: '$stage', n: { $sum: 1 } } }]).toArray();
console.log(`\n=== 전체 리드 ${total}건 ===`);
byStage.forEach(s => console.log(`  ${s._id || 'none'}: ${s.n}`));

// 3. Duplicate detection — same Company+Country
console.log('\n=== 중복 (Company+Country 동일) TOP 20 ===');
const dups = await Lead.aggregate([
  { $group: {
      _id: { c: { $toLower: '$Company' }, co: { $toLower: '$Country' } },
      n: { $sum: 1 },
      ids: { $push: { leadId: '$leadId', stage: '$stage', createdAt: '$createdAt', Email: '$Email' } }
  } },
  { $match: { n: { $gt: 1 } } },
  { $sort: { n: -1 } },
  { $limit: 20 },
]).toArray();

console.log(`중복 그룹 수: ${dups.length}`);
let totalDupExtra = 0;
for (const d of dups) {
  totalDupExtra += d.n - 1;
  console.log(`\n  ${d._id.c} (${d._id.co}) × ${d.n}`);
  d.ids.slice(0, 5).forEach(i => console.log(`    - ${i.leadId} [${i.stage||'none'}] ${i.Email||'no-email'}`));
}

// 4. Total duplicate count (all groups, not just top 20)
const allDups = await Lead.aggregate([
  { $group: { _id: { c: { $toLower: '$Company' }, co: { $toLower: '$Country' } }, n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } },
  { $group: { _id: null, groups: { $sum: 1 }, extras: { $sum: { $subtract: ['$n', 1] } } } },
]).toArray();
console.log(`\n=== 전체 중복 통계 ===`);
console.log(`중복 그룹: ${allDups[0]?.groups || 0}개`);
console.log(`잉여 리드: ${allDups[0]?.extras || 0}건 (하나씩만 남기면 삭제 가능)`);

// 5. Countries breakdown for verified/contacted stage
const verifiedByCountry = await Lead.aggregate([
  { $match: { stage: { $in: ['verified', 'contacted'] } } },
  { $group: { _id: '$Country', n: { $sum: 1 } } },
  { $sort: { n: -1 } },
  { $limit: 15 },
]).toArray();
console.log('\n=== verified+contacted 국가 TOP 15 ===');
verifiedByCountry.forEach(c => console.log(`  ${c._id || 'none'}: ${c.n}`));

await mongoose.disconnect();
