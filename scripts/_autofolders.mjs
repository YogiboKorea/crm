import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const M = mongoose.connection.db.collection('inboundmails');
console.log('=== 자동 배치(groupBy: auto:*)로 생긴 폴더 ===');
for (const r of await M.aggregate([
  {$match:{ groupBy:/^auto:/, trashedAt:null }},
  {$group:{_id:{g:'$group', by:'$groupBy'}, n:{$sum:1}}},
  {$sort:{n:-1}},
]).toArray()) console.log('  ', String(r._id.g).padEnd(22), String(r._id.by).padEnd(20), r.n, '통');
console.log('\n=== 대표가 원래 나눠둔 폴더 (IMAP 폴더 기반) ===');
for (const r of await M.aggregate([
  {$match:{ groupBy:{$not:/^auto:/}, group:{$nin:['',null]}, trashedAt:null }},
  {$group:{_id:'$group', n:{$sum:1}}},{$sort:{n:-1}},
]).toArray()) console.log('  ', String(r._id).padEnd(28), r.n, '통');
await mongoose.disconnect();
