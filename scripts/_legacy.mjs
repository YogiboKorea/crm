import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
console.log('=== 기존(AI서칭 이전) 데이터 배치별 ===');
const rows = await L.aggregate([
  {$match:{ importBatch:{$not:/^ai-search-/} }},
  {$group:{_id:'$importBatch', total:{$sum:1},
    archived:{$sum:{$cond:[{$eq:['$stage','archived']},1,0]}},
    failed:{$sum:{$cond:[{$eq:['$stage','failed']},1,0]}},
    live:{$sum:{$cond:[{$in:['$stage',['verified','contacted','replied','negotiating','partner']]},1,0]}},
    withEmail:{$sum:{$cond:[{$and:[{$ne:['$Email','']},{$ne:['$Email',null]}]},1,0]}} }},
  {$sort:{total:-1}}
]).toArray();
let t=0;
for (const r of rows) {
  if (r.total < 3) continue;
  t += r.total;
  console.log('  ', String(r._id||'(없음)').padEnd(24),
    '총', String(r.total).padStart(5),
    '| 보관', String(r.archived).padStart(5),
    '| 실패', String(r.failed).padStart(4),
    '| 살아있음', String(r.live).padStart(3),
    '| 이메일보유', String(r.withEmail).padStart(5));
}
console.log('   합계 약', t, '건');
console.log('\n=== 보관함에 있는데 이메일이 있는 것 (되살릴 수 있는 후보) ===');
console.log(' ', await L.countDocuments({stage:'archived', importBatch:{$not:/^ai-search-/}, Email:{$nin:['',null]}}));
console.log('\n=== 그중 왜 보관됐는지 ===');
for (const f of ['dedupReason','bulkMoveReason','junkReason']) {
  const n = await L.countDocuments({stage:'archived', [f]:{$exists:true}});
  if (n) console.log('  ', f.padEnd(18), n);
}
await mongoose.disconnect();
