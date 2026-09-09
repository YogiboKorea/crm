import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const db = mongoose.connection.db;

const isEn = (s) => {
  s = String(s||'').trim();
  if (s.length < 12) return false;
  const ko = (s.match(/[가-힣]/g)||[]).length;
  const la = (s.match(/[A-Za-z]/g)||[]).length;
  return la > 20 && ko/Math.max(1,ko+la) < 0.25;
};
// Haiku 4.5 · 입력 $1/MTok · 출력 $5/MTok · 1400원 기준. 한글은 토큰이 더 들어 출력을 1.5배로 본다.
const tok = (s) => Math.ceil(String(s||'').length / 3.5);
const won = (i,o) => (i/1e6*1 + o/1e6*5) * 1400;

let n=0, ti=0, to=0;
console.log('=== 리드 근거(Evidence) — 발송대기 ===');
for (const l of await db.collection('leads').find({stage:'verified'}).project({Evidence:1}).toArray()) {
  if (!isEn(l.Evidence)) continue;
  n++; const t = tok(l.Evidence); ti += t + 260; to += Math.ceil(t*1.5);
}
console.log(`  번역 대상 ${n}건 · 예상 ₩${Math.round(won(ti,to)).toLocaleString()}`);

let n2=0, ti2=0, to2=0;
console.log('\n=== 받은 메일 본문 (광고·자동발송 제외, 번역본 없는 것) ===');
for (const m of await db.collection('inboundmails').find({
  direction:{$ne:'out'}, trashedAt:null, classification:{$nin:['ad','system']},
}).project({bodyStripped:1, 'raw.text':1, translation:1}).toArray()) {
  if (m.translation?.body) continue;
  const body = (m.bodyStripped || m.raw?.text || '').slice(0, 2400);
  if (!isEn(body)) continue;
  n2++; const t = tok(body); ti2 += t + 260; to2 += Math.ceil(t*1.5);
}
console.log(`  번역 대상 ${n2}건 · 예상 ₩${Math.round(won(ti2,to2)).toLocaleString()}`);
console.log(`\n=== 합계 ${n+n2}건 · 약 ₩${Math.round(won(ti+ti2,to+to2)).toLocaleString()} ===`);
await mongoose.disconnect();
