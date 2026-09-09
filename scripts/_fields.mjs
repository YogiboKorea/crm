import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const q = { stage: 'verified' };
const total = await L.countDocuments(q);
const FIELDS = ['Company','Country','Email','WebsiteContact','Phone','Priority','Type',
  'BuyerContact','Title','LinkedInCompany','ContactLinkedIn','RoleMemo','BrandsChannels',
  'Evidence','Address','Approach','Sources','Confidence','notes','owner','lastContact','nextFollowUp'];
console.log(`발송대기 ${total}건 · 각 칸이 실제로 차 있는 비율\n`);
const rows = [];
for (const f of FIELDS) {
  const n = await L.countDocuments({ ...q, [f]: { $nin: ['', null] } });
  rows.push([f, n, Math.round(n/total*100)]);
}
rows.sort((a,b)=>b[1]-a[1]);
for (const [f,n,p] of rows) {
  const bar = '█'.repeat(Math.round(p/4)).padEnd(25);
  console.log(`${f.padEnd(18)} ${bar} ${String(p).padStart(3)}%  (${n})`);
}
console.log('\n=== 테스트로 보이는 리드 ===');
const bad = await L.find({ stage:'verified', $or:[
  {Company:/xyz|test|샘플|example|dummy/i},
  {Email:/xyzwidgets|example\.com|test@/i},
]}).project({leadId:1,Company:1,Email:1,importBatch:1}).toArray();
for (const b of bad) console.log(' ', b.leadId, '|', b.Company, '|', b.Email, '|', b.importBatch);
await mongoose.disconnect();
