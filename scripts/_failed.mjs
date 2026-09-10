import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const q = { stage:'failed' };
const tot = await L.countDocuments(q);
console.log('검증 실패', tot, '건\n');
const isEn = s => { s=String(s||'').trim(); if(s.length<12) return false;
  const ko=(s.match(/[가-힣]/g)||[]).length, la=(s.match(/[A-Za-z]/g)||[]).length;
  return la>20 && ko/Math.max(1,ko+la)<0.25; };
let ev=0, en=0, noEv=0, ko=0;
for (const l of await L.find(q).project({Evidence:1,EvidenceKo:1,verification:1}).toArray()) {
  if (l.EvidenceKo) ko++;
  else if (isEn(l.Evidence)) en++;
  else if (String(l.Evidence||'').trim()) ev++;
  else noEv++;
}
console.log('  한국어본 있음  :', ko);
console.log('  영문 근거      :', en, '← 번역 대상');
console.log('  한국어 근거     :', ev);
console.log('  근거 없음      :', noEv);
console.log('\n=== 왜 실패했는지 (aiVerdict) ===');
for (const r of await L.aggregate([{$match:q},{$group:{_id:'$verification.aiVerdict',n:{$sum:1}}},{$sort:{n:-1}}]).toArray())
  console.log('  ', String(r._id).padEnd(16), r.n);
console.log('\n=== 실패 사유 필드 ===');
for (const f of ['dedupReason','bulkMoveReason','junkReason','verification.aiReasoning','reviewDecision']) {
  const n = await L.countDocuments({...q, [f]:{$nin:[null,'']}});
  if (n) console.log('  ', f.padEnd(28), n);
}
console.log('\n샘플 3건:');
for (const d of await L.find(q).project({Company:1,Country:1,Evidence:1,Type:1,'verification.aiReasoning':1}).limit(3).toArray()) {
  console.log('  ·', d.Company, '|', d.Country);
  console.log('    Type:', String(d.Type||'-').slice(0,80));
  console.log('    근거:', String(d.Evidence||'(없음)').slice(0,110));
  console.log('    AI사유:', String(d.verification?.aiReasoning||'(없음)').slice(0,110));
}
await mongoose.disconnect();
