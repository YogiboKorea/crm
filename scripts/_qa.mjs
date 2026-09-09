import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const all = await L.find({stage:'verified'}).toArray();
console.log('발송대기', all.length, '건\n');

const len = (s)=>String(s||'').trim().length;
console.log('=== 근거(Evidence) 길이 ===');
const buckets = {'비어있음':0,'1~40자(부실)':0,'41~120자':0,'121자 이상':0};
for (const l of all) {
  const n = len(l.Evidence);
  if (!n) buckets['비어있음']++;
  else if (n<=40) buckets['1~40자(부실)']++;
  else if (n<=120) buckets['41~120자']++;
  else buckets['121자 이상']++;
}
for (const [k,v] of Object.entries(buckets)) console.log('  ', k.padEnd(16), v);

console.log('\n=== 출처(Sources) 종류 ===');
const src = {};
for (const l of all) { const s=String(l.Sources||'(비어있음)').trim(); src[s]=(src[s]||0)+1; }
const srcArr = Object.entries(src).sort((a,b)=>b[1]-a[1]);
console.log('  총', srcArr.length, '종류');
for (const [k,v] of srcArr.slice(0,6)) console.log('   ', String(k).slice(0,60).padEnd(62), v);
const withUrl = all.filter(l=>/https?:\/\//.test(String(l.Sources||''))).length;
console.log('  실제 URL 이 들어있는 건:', withUrl, `(${Math.round(withUrl/all.length*100)}%)`);

console.log('\n=== 신뢰도(Confidence) ===');
const cf={}; for (const l of all){const c=String(l.Confidence||'(없음)');cf[c]=(cf[c]||0)+1;}
for (const [k,v] of Object.entries(cf).sort((a,b)=>b[1]-a[1])) console.log('   ', k.padEnd(12), v);

console.log('\n=== 배치별 ===');
const b={}; for (const l of all){const x=String(l.importBatch||'-');b[x]=(b[x]||0)+1;}
for (const [k,v] of Object.entries(b)) console.log('   ', k.padEnd(24), v);

console.log('\n=== AI 검증(aiVerdict) 통과 여부 ===');
const av={}; for (const l of all){const x=String(l.verification?.aiVerdict||'(미실행)');av[x]=(av[x]||0)+1;}
for (const [k,v] of Object.entries(av)) console.log('   ', k.padEnd(14), v);

console.log('\n=== 웹사이트 URL 형태 ===');
console.log('  http(s) 정상 :', all.filter(l=>/^https?:\/\/.+\..+/.test(String(l.WebsiteContact||''))).length);
console.log('  비었거나 이상:', all.filter(l=>!/^https?:\/\/.+\..+/.test(String(l.WebsiteContact||''))).length);
await mongoose.disconnect();
