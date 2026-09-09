import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
console.log('=== verifying 안의 aiVerdict ===');
for (const r of await L.aggregate([{$match:{stage:'verifying'}},{$group:{_id:'$verification.aiVerdict',n:{$sum:1}}},{$sort:{n:-1}}]).toArray())
  console.log(String(r._id).padEnd(16), r.n);
console.log('\n=== verifying × importBatch (출처) ===');
for (const r of await L.aggregate([{$match:{stage:'verifying'}},{$group:{_id:'$importBatch',n:{$sum:1}}},{$sort:{n:-1}},{$limit:12}]).toArray())
  console.log(String(r._id).slice(0,40).padEnd(42), r.n);
console.log('\n=== beauty-buyer 이면서 이메일 보유 ===');
console.log(await L.countDocuments({stage:'verifying','verification.aiVerdict':'beauty-buyer',Email:{$nin:['',null]}}));
await mongoose.disconnect();
