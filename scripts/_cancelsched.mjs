import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const S = mongoose.connection.db.collection('emailschedules');
for (const d of await S.find({status:'pending'}).toArray())
  console.log('  대기 예약:', d.to, '|', new Date(d.scheduledFor).toLocaleString('ko-KR'), '| batch:', d.batchId||'-');
if (process.argv.includes('--apply')) {
  const r = await S.updateMany({status:'pending'}, {$set:{status:'canceled', canceledReason:'테스트 잔여물 정리 — 아웃바운드 잠금 중'}});
  console.log('취소 완료:', r.modifiedCount, '건');
}
await mongoose.disconnect();
