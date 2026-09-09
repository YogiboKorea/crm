import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const all = await L.find({importBatch:{$not:/^ai-search-/}, Email:{$nin:['',null]}})
  .project({Email:1}).toArray();
const RX = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const bad = all.filter(l => !RX.test(String(l.Email||'').trim()));
console.log('기존 데이터 · Email 칸이 채워진 것:', all.length);
console.log('  실제 이메일 형식:', all.length - bad.length);
console.log('  형식 아님       :', bad.length);
const kinds = {};
for (const b of bad) { const k=String(b.Email).trim().slice(0,40); kinds[k]=(kinds[k]||0)+1; }
console.log('\n형식 아닌 값 상위:');
for (const [k,v] of Object.entries(kinds).sort((a,b)=>b[1]-a[1]).slice(0,10))
  console.log('   ', String(v).padStart(5), '×', JSON.stringify(k));
await mongoose.disconnect();
