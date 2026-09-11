/**
 * "RE: RE: Re: ..." 가 실제로 한 대화로 묶이는지 본다.
 *
 * 묶기 기준이 제목이라, 접두어를 벗기다 실패하거나 상대가 제목을 조금 바꾸면
 * 같은 대화가 여러 줄로 갈라진다. 갈라지면 "이 건이 어디까지 왔나" 를 못 본다.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const REPLY_PREFIX = /^\s*(re|ans|aw|sv|vs|vb|fw|fwd|rv|tr|답장|회신|전달|전송|참조)\s*(\[\d+\])?\s*[:：]\s*/i;
const norm = (s='') => {
  let x = String(s).trim();
  for (let i=0;i<30;i++){ const n=x.replace(REPLY_PREFIX,''); if(n===x) break; x=n.trim(); }
  return x.replace(/\s+/g,' ').replace(/[「」『』]/g,'').trim().toLowerCase();
};

await mongoose.connect(process.env.MONGODB_URI);
const M = mongoose.connection.collection('inboundmails');
const rows = await M.find({ trashedAt: null })
  .project({ subject:1, threadKey:1, group:1, date:1, direction:1, 'from.address':1 }).toArray();

console.log(`수신·발신 메일 ${rows.length}통\n`);

// 1) 접두어가 몇 겹까지 붙는가
const depth = (s='') => { let x=String(s).trim(), d=0;
  for(let i=0;i<30;i++){ const n=x.replace(REPLY_PREFIX,''); if(n===x) break; x=n.trim(); d++; } return d; };
const deep = rows.map(r=>({...r,d:depth(r.subject)})).filter(r=>r.d>=3).sort((a,b)=>b.d-a.d);
console.log(`접두어가 3겹 이상인 메일: ${deep.length}통`);
for (const r of deep.slice(0,5)) console.log(`  ${r.d}겹  ${String(r.subject).slice(0,66)}`);

// 2) threadKey 가 실제로 묶고 있나
const byKey = new Map();
for (const r of rows) {
  const k = r.threadKey || `(없음)${r._id}`;
  byKey.set(k, (byKey.get(k)||0)+1);
}
const multi = [...byKey.values()].filter(n=>n>1);
console.log(`\n스레드 ${byKey.size}개 · 2통 이상 묶인 스레드 ${multi.length}개`);
console.log(`  가장 긴 대화: ${Math.max(...byKey.values())}통`);
const noKey = rows.filter(r=>!r.threadKey).length;
console.log(`  threadKey 없는 메일: ${noKey}통 ${noKey?'← 각자 한 줄로 뜬다':''}`);

// 3) 같은 정규화 제목인데 threadKey 가 갈린 경우 = 묶기 실패
const bySubj = new Map();
for (const r of rows) {
  const n = norm(r.subject);
  if (!n) continue;
  if (!bySubj.has(n)) bySubj.set(n, new Set());
  bySubj.get(n).add(r.threadKey || 'none');
}
const split = [...bySubj.entries()].filter(([,keys])=>keys.size>1);
console.log(`\n제목은 같은데 스레드가 갈린 대화: ${split.length}건`);
for (const [subj,keys] of split.slice(0,6)) {
  console.log(`  "${subj.slice(0,52)}" → ${keys.size}조각`);
}

// 4) 가장 긴 대화 하나를 펼쳐 본다
const top = [...byKey.entries()].sort((a,b)=>b[1]-a[1])[0];
if (top && top[1] > 1) {
  console.log(`\n가장 긴 대화 (${top[1]}통):`);
  const conv = rows.filter(r=>r.threadKey===top[0]).sort((a,b)=>new Date(a.date)-new Date(b.date));
  for (const c of conv.slice(0,6)) {
    console.log(`  ${String(c.date).slice(0,10)} ${c.direction==='out'?'→':'←'} ${String(c.subject).slice(0,60)}`);
  }
  if (conv.length>6) console.log(`  … 외 ${conv.length-6}통`);
}
await mongoose.disconnect();
