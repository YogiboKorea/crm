import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const db = mongoose.connection.db;
console.log('=== 등록 계정 ===');
for (const a of await db.collection('mailaccounts').find({}).toArray())
  console.log('  ', String(a._id), '|', a.accountName, '|', a.fromAddress || a.smtpUser,
              '| 기본:', !!a.isDefault, '| 활성:', a.isActive !== false,
              '| 수집폴더:', (a.imapFolders||[]).length ? a.imapFolders.join(', ') : '(미지정)');
console.log('\n=== 메일이 어느 계정으로 저장돼 있나 ===');
for (const r of await db.collection('inboundmails').aggregate([
  {$group:{_id:'$accountId', n:{$sum:1}}},{$sort:{n:-1}}]).toArray())
  console.log('  ', String(r._id).padEnd(28), r.n, '통');
console.log('\n=== 수집 이력(MailSyncState) ===');
const st = await db.collection('mailsyncstates').find({}).toArray();
if (!st.length) console.log('  (없음)');
for (const s of st.slice(0,20)) console.log('  ', String(s.accountId).padEnd(28), s.folder, '| lastUid', s.lastUid);
await mongoose.disconnect();
