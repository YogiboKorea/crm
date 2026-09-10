import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const M = mongoose.connection.db.collection('inboundmails');

// 진짜 자동발송의 표지: 제목이 자동응답/읽음확인 패턴이거나, 본문이 아주 짧거나, noreply 주소
const AUTO_SUBJ = /^(read:|læst:|읽음:|out of (the )?office|automatic reply|auto[- ]?reply|수신\s?확인|delivered:)/i;
const NOREPLY = /(noreply|no-reply|donotreply|notification|notify|alert|mailer-daemon|postmaster|bounce|automated|jobs-noreply|messaging-digest)/i;

const rows = await M.find({classification:'system', trashedAt:null}).toArray();
console.log('자동발송으로 분류된', rows.length, '통 점검\n');
const suspect = [];
for (const d of rows) {
  const subj = String(d.subject||'');
  const addr = String(d.from?.address||'');
  const body = String(d.bodyStripped||d.raw?.text||'').replace(/\s+/g,' ').trim();
  const looksAuto = AUTO_SUBJ.test(subj) || NOREPLY.test(addr);
  if (!looksAuto && body.length > 60) suspect.push({d, body});
}
console.log('=== 자동발송 표지가 없는데 본문이 있는 것 (오분류 의심) ===');
for (const {d, body} of suspect) {
  console.log('  ·', String(d.from?.address).padEnd(32), '|', String(d.subject).slice(0,52));
  console.log('     본문:', body.slice(0,110));
}
console.log('\n의심 건수:', suspect.length, '/', rows.length);
await mongoose.disconnect();
