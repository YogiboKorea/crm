import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const d = await L.findOne({stage:'verifying'});
console.log('=== verifying 샘플 1건의 키 ===');
console.log(Object.keys(d).join(' · '));
console.log('\nCompany:', d.Company, '| Email:', d.Email, '| Country:', d.Country);
for (const k of ['aiVerification','verification','verifyResult','aiVerify','verified','verifyStatus','tier','source','discoverySource','notes'])
  if (d[k] !== undefined) console.log(k, '=', JSON.stringify(d[k]).slice(0,300));
console.log('\n=== verifying 중 이메일 보유 ===');
console.log('이메일 있음:', await L.countDocuments({stage:'verifying', Email:{$nin:['',null]}}));
console.log('이메일 없음:', await L.countDocuments({stage:'verifying', $or:[{Email:''},{Email:null},{Email:{$exists:false}}]}));
await mongoose.disconnect();
