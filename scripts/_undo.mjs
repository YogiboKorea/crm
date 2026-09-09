import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
await L.updateOne({leadId:'kbeauty-eu-2026-09-08T01-27-0161'}, {$set:{stage:'verified',readyForOutreach:false},
  $unset:{reviewedAt:'',reviewDecision:'',reviewPrevStage:''}});
console.log('테스트 되돌림 완료 · 발송대기', await L.countDocuments({stage:'verified'}),
            '· 승인', await L.countDocuments({stage:'verified',readyForOutreach:true}));
await mongoose.disconnect();
