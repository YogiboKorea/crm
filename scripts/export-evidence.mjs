/** 영문 근거·업종을 뽑아 한국어본을 만들 입력 파일로 저장한다. */
import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const isEn = s => { s=String(s||'').trim(); if(s.length<12) return false;
  const ko=(s.match(/[가-힣]/g)||[]).length, la=(s.match(/[A-Za-z]/g)||[]).length;
  return la>20 && ko/Math.max(1,ko+la)<0.25; };

const rows = await L.find({ stage:{$in:['verified','contacted','replied','negotiating','partner','failed']} })
  .project({leadId:1,Company:1,Country:1,Category:1,Evidence:1,Type:1,EvidenceKo:1,TypeKo:1}).toArray();
const out = [];
for (const r of rows) {
  const needEv = isEn(r.Evidence) && !String(r.EvidenceKo||'').trim();
  const needTy = isEn(r.Type) && !String(r.TypeKo||'').trim();
  if (!needEv && !needTy) continue;
  const o = { leadId: r.leadId, company: r.Company, country: r.Country };
  if (needEv) o.evidence = r.Evidence;
  if (needTy) o.type = r.Type;
  out.push(o);
}
fs.mkdirSync('scripts/evidence-ko', { recursive: true });
const CHUNK = 60;
let n = 0;
for (let i=0;i<out.length;i+=CHUNK) {
  n++;
  fs.writeFileSync(`scripts/evidence-ko/batch-${String(n).padStart(2,'0')}.json`,
    JSON.stringify(out.slice(i,i+CHUNK), null, 1), 'utf8');
}
console.log(`번역 대상 ${out.length}건 → ${n}개 파일`);
await mongoose.disconnect();
