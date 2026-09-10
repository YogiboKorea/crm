import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const M = mongoose.connection.db.collection('inboundmails');
const A = mongoose.connection.db.collection('mailaccounts');
const accs = await A.find({}).toArray();
const own = new Set(accs.flatMap(a=>[a.smtpUser,a.fromAddress].map(x=>String(x||'').split('@')[1]).filter(Boolean)));
own.add('yogico.kr');
console.log('자사 도메인:', [...own].join(', '), '\n');

const un = await M.find({ $or:[{group:''},{group:null},{group:{$exists:false}}], trashedAt:null }).toArray();
const byCls = {};
for (const m of un) byCls[m.classification||'?'] = (byCls[m.classification||'?']||0)+1;
console.log('=== 미분류 44통의 분류 ===');
for (const [k,v] of Object.entries(byCls).sort((a,b)=>b[1]-a[1])) console.log('  ', k.padEnd(12), v);

console.log('\n=== 발신 도메인별 (자사/무료메일 표시) ===');
const FREE = new Set(['gmail.com','naver.com','daum.net','hanmail.net','nate.com','outlook.com','hotmail.com','yahoo.com','icloud.com']);
const byDom = {};
for (const m of un) {
  const d = String(m.from?.address||'').split('@')[1] || '(없음)';
  (byDom[d] ||= { n:0, cls:new Set(), subj:[] });
  byDom[d].n++; byDom[d].cls.add(m.classification);
  if (byDom[d].subj.length < 2) byDom[d].subj.push(String(m.subject||'').slice(0,52));
}
for (const [d,v] of Object.entries(byDom).sort((a,b)=>b[1].n-a[1].n)) {
  const tag = own.has(d) ? '[자사]' : FREE.has(d) ? '[무료메일]' : '';
  console.log(`  ${d.padEnd(34)} ${String(v.n).padStart(2)}통 ${tag} ${[...v.cls].join(',')}`);
  for (const s of v.subj) console.log(`       · ${s}`);
}
await mongoose.disconnect();
