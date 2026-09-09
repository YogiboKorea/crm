import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
// 지우지 않고 보관함으로 — 되돌릴 수 있게 사유를 남긴다
const r = await L.updateMany(
  { leadId: 'lead-imptest-1787295961-3' },
  { $set: { stage:'archived', stageChangedAt:new Date().toISOString(),
            testLeadArchivedAt:new Date(), testLeadReason:'개발용 더미 데이터 — 발송대기에 있으면 안 됨' } },
);
console.log('테스트 리드 보관 처리:', r.modifiedCount, '건');
console.log('발송대기 잔여:', await L.countDocuments({stage:'verified'}));
await mongoose.disconnect();
