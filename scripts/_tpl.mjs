import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const db = mongoose.connection.db;
const names = (await db.listCollections().toArray()).map(c=>c.name);
console.log('컬렉션:', names.filter(n=>/templ|mail|account/i.test(n)).join(', '));
for (const cn of names.filter(n=>/templ/i.test(n))) {
  const docs = await db.collection(cn).find({}).limit(10).toArray();
  console.log(`\n=== ${cn} (${docs.length}건) ===`);
  for (const d of docs) {
    console.log('  이름 :', d.name || d.title || '(무제)');
    console.log('  제목 :', String(d.subject||'(비어있음)').slice(0,90));
    console.log('  본문 :', String(d.body||d.html||'(비어있음)').replace(/\s+/g,' ').slice(0,180));
    console.log('  기본값:', d.isDefault ?? '-', '| 수정:', d.updatedAt||'-');
    console.log('  ---');
  }
}
console.log('\n=== 발송 계정 ===');
for (const a of await db.collection('mailaccounts').find({}).toArray())
  console.log(' ', a.label, '|', a.address || a.user, '| 기본:', !!a.isDefault, '| 활성:', a.active !== false);
await mongoose.disconnect();
