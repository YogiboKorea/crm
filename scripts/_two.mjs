import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
for (const rx of [/dermaofficial/i, /venuseurope/i]) {
  const d = await L.findOne({ WebsiteContact: rx });
  console.log('\n' + '='.repeat(70));
  for (const k of ['Company','Country','Type','Email','WebsiteContact','BrandsChannels','Evidence','importBatch']) {
    if (d[k]) console.log(k.padEnd(15) + ' ' + d[k]);
  }
}
console.log('\n\n=== Type 값의 상태 (발송대기 410건) ===');
const types = await L.aggregate([{$match:{stage:'verified'}},{$group:{_id:'$Type',n:{$sum:1}}}]).toArray();
const clean = types.filter(t => (t._id||'').length <= 24);
const messy = types.filter(t => (t._id||'').length > 24);
console.log('분류로 쓸 수 있는 짧은 값 :', clean.length, '종류 →', clean.reduce((a,b)=>a+b.n,0), '건');
console.log('문장으로 길게 적힌 값     :', messy.length, '종류 →', messy.reduce((a,b)=>a+b.n,0), '건  ← 필터 불가');
console.log('\n=== 제조사·브랜드형 (dermaofficial 류) 대략 ===');
console.log('Type 에 manufacturer/brand 포함:',
  await L.countDocuments({stage:'verified', Type:/manufactur|brand/i}));
console.log('Type 에 distributor 포함        :',
  await L.countDocuments({stage:'verified', Type:/distribut/i}));
await mongoose.disconnect();
