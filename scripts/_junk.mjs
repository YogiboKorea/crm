import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const d = await L.findOne({stage:'verified', Sources:/linkedin\.com\/in\//});
console.log('문제 레코드:');
for (const k of ['leadId','Company','Country','Type','Email','WebsiteContact','Evidence','Sources'])
  if (d && d[k]) console.log('  ', k.padEnd(15), String(d[k]).slice(0,110));
if (process.argv.includes('--apply') && d) {
  await L.updateOne({_id:d._id}, {$set:{stage:'archived', readyForOutreach:false,
    junkArchivedAt:new Date(), junkReason:'회사가 아니라 개인 LinkedIn 프로필 — 리드로 부적합'}});
  console.log('\n보관함으로 이동. 발송대기:', await L.countDocuments({stage:'verified'}));
}
await mongoose.disconnect();
