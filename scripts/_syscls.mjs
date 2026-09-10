import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const M = mongoose.connection.db.collection('inboundmails');
console.log('=== 전체 분류 분포 ===');
for (const r of await M.aggregate([{$match:{trashedAt:null}},{$group:{_id:'$classification',n:{$sum:1}}},{$sort:{n:-1}}]).toArray())
  console.log('  ', String(r._id).padEnd(12), r.n);
console.log('\n=== 자동발송(system) 으로 분류된 실제 메일 ===');
for (const m of await M.find({classification:'system', trashedAt:null}).sort({date:-1}).limit(14).toArray())
  console.log('  ', String(m.from?.address||'').padEnd(38), '|', String(m.subject||'').slice(0,56));
console.log('\n=== 광고(ad) 와 비교 ===');
for (const m of await M.find({classification:'ad', trashedAt:null}).sort({date:-1}).limit(6).toArray())
  console.log('  ', String(m.from?.address||'').padEnd(38), '|', String(m.subject||'').slice(0,56));
await mongoose.disconnect();
