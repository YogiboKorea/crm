import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const M = mongoose.connection.db.collection('inboundmails');
for (const a of ['official@suelokorea.com','op@besko.kr','leshwann@naver.com']) {
  const docs = await M.find({'from.address':a, classification:'system'}).toArray();
  for (const d of docs) {
    console.log('---');
    console.log('발신:', d.from?.address, '| 이름:', d.from?.name);
    console.log('제목:', d.subject);
    console.log('분류:', d.classification, '| 근거(classifiedBy):', d.classifiedBy);
    console.log('leadId:', d.leadId || '(미연결)', '| inReplyTo:', d.inReplyTo ? 'O' : 'X');
    console.log('본문:', String(d.bodyStripped||d.raw?.text||'').replace(/\s+/g,' ').slice(0,180));
  }
}
console.log('\n=== 자동발송인데 우리 리드에 연결된 것 (답장일 가능성) ===');
for (const d of await M.find({classification:'system', leadId:{$nin:['',null]}}).toArray())
  console.log('  ', d.from?.address, '|', String(d.subject).slice(0,50), '| lead:', d.leadId);
console.log('\n=== 자동발송인데 In-Reply-To 가 있는 것 (우리 메일에 대한 답) ===');
for (const d of await M.find({classification:'system', inReplyTo:{$nin:['',null]}}).toArray())
  console.log('  ', d.from?.address, '|', String(d.subject).slice(0,50));
await mongoose.disconnect();
