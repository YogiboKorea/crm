import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const q = { stage:'failed' };
const RX = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const all = await L.find(q).project({Company:1,Country:1,Email:1,WebsiteContact:1,'verification.aiVerdict':1,crawledAt:1,crawledEmails:1,stageChangedAt:1,importBatch:1}).toArray();
let real=0, bad=0;
const badKinds={};
for (const l of all) {
  const e=String(l.Email||'').trim();
  if (RX.test(e)) real++;
  else { bad++; badKinds[e.slice(0,32)||'(빈칸)']=(badKinds[e.slice(0,32)||'(빈칸)']||0)+1; }
}
console.log('검증 실패', all.length, '건');
console.log('  이메일이 실제 주소 :', real, '← AI는 진성 바이어라 했는데 실패로 가 있음');
console.log('  주소가 아님/없음   :', bad);
console.log('\n주소가 아닌 값 상위:');
for (const [k,v] of Object.entries(badKinds).sort((a,b)=>b[1]-a[1]).slice(0,6)) console.log('   ', String(v).padStart(4), '×', JSON.stringify(k));
console.log('\n=== 이메일도 있고 beauty-buyer 인데 실패인 건 ===');
const weird = all.filter(l => RX.test(String(l.Email||'').trim()) && l.verification?.aiVerdict==='beauty-buyer');
console.log('  ', weird.length, '건');
for (const w of weird.slice(0,6)) console.log('   ·', String(w.Company).slice(0,42).padEnd(44), w.Country, '|', w.Email);
console.log('\n=== 배치별 ===');
const b={}; for (const l of all) b[l.importBatch||'-']=(b[l.importBatch||'-']||0)+1;
for (const [k,v] of Object.entries(b).sort((a,b)=>b[1]-a[1])) console.log('  ', String(k).padEnd(24), v);
await mongoose.disconnect();
