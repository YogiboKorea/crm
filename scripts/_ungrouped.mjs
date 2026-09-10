import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const M = mongoose.connection.db.collection('inboundmails');

const un = await M.find({ $or:[{group:''},{group:null},{group:{$exists:false}}], trashedAt:null }).toArray();
console.log('미분류 메일', un.length, '통\n');

// 이 발신자들이 다른 곳에서는 어느 폴더에 들어가 있나
const learned = await M.aggregate([
  { $match:{ group:{$nin:[null,'']}, 'from.address':{$nin:[null,'']} } },
  { $group:{ _id:{a:'$from.address', g:'$group'}, n:{$sum:1} } },
]).toArray();
const byAddr = new Map();
for (const r of learned) {
  const a = String(r._id.a).toLowerCase();
  const cur = byAddr.get(a);
  if (!cur || r.n > cur.n) byAddr.set(a, { group:r._id.g, n:r.n });
}
console.log('학습된 발신자 주소:', byAddr.size, '개\n');

let matchAddr = 0, noHit = 0;
const noHitAddrs = {};
for (const m of un) {
  const a = String(m.from?.address||'').toLowerCase();
  if (byAddr.has(a)) matchAddr++;
  else { noHit++; noHitAddrs[a] = (noHitAddrs[a]||0)+1; }
}
console.log('=== 미분류 메일이 왜 분류가 안 됐나 ===');
console.log('  발신자 주소가 학습 목록에 있음 (분류 가능):', matchAddr);
console.log('  학습 목록에 없음 (처음 보는 발신자)     :', noHit);
console.log('\n처음 보는 발신자 상위:');
for (const [a,n] of Object.entries(noHitAddrs).sort((x,y)=>y[1]-x[1]).slice(0,12))
  console.log('   ', String(a).padEnd(40), n, '통');

console.log('\n=== 미분류 메일이 어느 IMAP 폴더에서 왔나 ===');
const byFolder = {};
for (const m of un) byFolder[m.folder||'(없음)'] = (byFolder[m.folder||'(없음)']||0)+1;
for (const [k,v] of Object.entries(byFolder).sort((a,b)=>b[1]-a[1])) console.log('   ', k.padEnd(30), v);
await mongoose.disconnect();
