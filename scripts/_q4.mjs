import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const base = { stage:'verifying', Email:{$nin:['',null]} };
console.log('이메일 보유 :', await L.countDocuments(base));
console.log('\n=== 같은 주소를 여러 회사가 공유 (가짜/대표주소 의심) ===');
const dup = await L.aggregate([
  {$match: base},
  {$group:{_id:{$toLower:'$Email'}, n:{$sum:1}, companies:{$push:'$Company'}}},
  {$match:{n:{$gt:1}}}, {$sort:{n:-1}}
]).toArray();
let dupTotal = 0;
for (const d of dup) { dupTotal += d.n; }
console.log('공유 주소 종류:', dup.length, '· 걸린 리드:', dupTotal);
for (const d of dup.slice(0,12)) console.log('  ', String(d._id).padEnd(34), d.n, '→', d.companies.slice(0,3).join(', ').slice(0,60));
console.log('\n=== 명백한 무효 주소 패턴 ===');
for (const pat of [['no-mx/예시','^(info|contact|hello)@(example|test|domain)\.'],['이미지·자산','\.(png|jpg|jpeg|gif|svg|webp)$'],['플레이스홀더','(your|sample|dummy|placeholder|email@email)']]) {
  const n = await L.countDocuments({...base, Email:{$nin:['',null], $regex:pat[1], $options:'i'}});
  if (n) console.log('  ', pat[0].padEnd(12), n);
}
console.log('\n=== 유일 주소 = 발송 후보 ===');
const uniqueOk = await L.countDocuments(base) - dupTotal;
console.log('  ', uniqueOk);
await mongoose.disconnect();
