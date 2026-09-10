import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const isEn = s => { s=String(s||'').trim(); if(s.length<12) return false;
  const ko=(s.match(/[가-힣]/g)||[]).length, la=(s.match(/[A-Za-z]/g)||[]).length;
  return la>20 && ko/Math.max(1,ko+la)<0.25; };
const rows = await L.find({stage:'verified'}).project({Company:1,Evidence:1,Type:1,BrandsChannels:1}).toArray();
let ev=0, ty=0, chars=0;
for (const r of rows) {
  if (isEn(r.Evidence)) { ev++; chars += String(r.Evidence).length; }
  if (isEn(r.Type)) ty++;
}
console.log('발송대기', rows.length, '건');
console.log('  근거(Evidence)가 영문 :', ev, `· 총 ${chars.toLocaleString()}자 (평균 ${Math.round(chars/Math.max(1,ev))}자)`);
console.log('  업종(Type)이 영문     :', ty);
await mongoose.disconnect();
