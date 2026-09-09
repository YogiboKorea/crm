import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
for (const term of ['dermaofficial','derma official','venuseurope','venus europe','venus']) {
  const rx = new RegExp(term.replace(/\s/g,'\s*'), 'i');
  const hits = await L.find({ $or:[{Company:rx},{WebsiteContact:rx},{Email:rx}] })
    .project({leadId:1,Company:1,Country:1,Email:1,WebsiteContact:1,stage:1,Type:1}).limit(6).toArray();
  console.log(`\n[${term}] ${hits.length}건`);
  for (const h of hits) console.log('   ', h.stage.padEnd(9), h.Company, '|', h.Country, '|', h.WebsiteContact || '-');
}
console.log('\n=== 발송대기 410건의 업종(Type) 분포 ===');
for (const r of await L.aggregate([{$match:{stage:'verified'}},{$group:{_id:'$Type',n:{$sum:1}}},{$sort:{n:-1}}]).toArray())
  console.log('   ', String(r._id||'(없음)').padEnd(24), r.n);
console.log('\n=== 발송대기 국가 상위 12 ===');
for (const r of await L.aggregate([{$match:{stage:'verified'}},{$group:{_id:'$Country',n:{$sum:1}}},{$sort:{n:-1}},{$limit:12}]).toArray())
  console.log('   ', String(r._id).padEnd(18), r.n);
await mongoose.disconnect();
