import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
console.log('=== 유통사 + 브랜드·제조사 150건의 국가 분포 ===');
const rows = await L.aggregate([
  {$match:{stage:'verified', Category:{$in:['Distributor','Brand/Manufacturer']}}},
  {$group:{_id:'$Country', n:{$sum:1}}}, {$sort:{n:-1}}
]).toArray();
for (const r of rows) console.log('  ', String(r._id).padEnd(18), r.n);
console.log('  ── 총', rows.reduce((a,b)=>a+b.n,0), '건 /', rows.length, '개국');
await mongoose.disconnect();
