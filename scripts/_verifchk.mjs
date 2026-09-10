import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
console.log('=== 실수로 승인이 풀린 건 ===');
const un = await L.find({stage:'verified', readyForOutreach:{$ne:true}})
  .project({leadId:1,Company:1,Country:1,preApprovedAt:1}).toArray();
console.log('  승인 안 된 발송대기:', un.length, '건');
for (const u of un) console.log('   ·', u.Company, '|', u.Country);

console.log('\n=== 검증(verification) 데이터가 얼마나 차 있나 ===');
const tot = await L.countDocuments({stage:'verified'});
for (const [label, f] of [
  ['emailValid 판정됨',   {'verification.emailValid':{$ne:null}}],
  ['  └ true',           {'verification.emailValid':true}],
  ['websiteAlive 판정됨', {'verification.websiteAlive':{$ne:null}}],
  ['  └ true',           {'verification.websiteAlive':true}],
  ['businessLevel 있음',  {'verification.businessLevel':{$nin:[null,'']}}],
  ['aiVerdict 있음',      {'verification.aiVerdict':{$nin:[null,'']}}],
  ['verifiedAt 있음',     {'verification.verifiedAt':{$nin:[null,'']}}],
]) console.log('  ', label.padEnd(22), await L.countDocuments({stage:'verified', ...f}), '/', tot);

const d = await L.findOne({stage:'verified'}, {projection:{Company:1,verification:1}});
console.log('\n샘플 verification:', JSON.stringify(d.verification).slice(0,300));
await mongoose.disconnect();
