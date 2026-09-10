/** 한국어본을 Lead.EvidenceKo / TypeKo 에 기록한다 (원문은 그대로 둔다). */
import mongoose from 'mongoose';
import fs from 'fs';
const file = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!file) { console.error('결과 JSON 경로 필요'); process.exit(1); }
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
const rows = JSON.parse(fs.readFileSync(file,'utf8'));
const bad = rows.filter(r => !r.leadId || (!r.evidenceKo && !r.typeKo));
if (bad.length) { console.error('leadId 또는 번역문이 없는 항목:', bad.length); process.exit(1); }
console.log(`${rows.length}건 · 근거 ${rows.filter(r=>r.evidenceKo).length} · 업종 ${rows.filter(r=>r.typeKo).length}`);
if (!APPLY) { console.log('[미적용] --apply'); process.exit(0); }
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const ops = rows.map(r => ({ updateOne: { filter:{leadId:r.leadId}, update:{ $set: {
  ...(r.evidenceKo ? { EvidenceKo: r.evidenceKo } : {}),
  ...(r.typeKo ? { TypeKo: r.typeKo } : {}),
} } } }));
const res = await L.bulkWrite(ops);
console.log('기록 완료 — modified', res.modifiedCount);
await mongoose.disconnect();
