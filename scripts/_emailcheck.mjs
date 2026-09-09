import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const all = await L.find({stage:'verified'}).project({Company:1,Email:1}).toArray();
const RX = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const bad = all.filter(l => !RX.test(String(l.Email||'').trim()));
console.log('발송대기', all.length, '건 · JS 로 직접 검사');
console.log('  정상 :', all.length - bad.length);
console.log('  이상 :', bad.length);
if (bad.length) {
  console.log('\n이상한 값 (최대 15개):');
  for (const b of bad.slice(0,15)) console.log('   ', JSON.stringify(b.Email), '|', String(b.Company).slice(0,40));
}
// 여러 주소가 콤마로 들어간 경우인지 확인
const multi = all.filter(l => /[,;]/.test(String(l.Email||'')));
console.log('\n콤마/세미콜론이 들어간 건:', multi.length);
for (const m of multi.slice(0,5)) console.log('   ', JSON.stringify(m.Email).slice(0,100));
await mongoose.disconnect();
