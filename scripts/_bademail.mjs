import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const hasEmail = { Email:{$nin:['',null]} };
const realEmail = { Email:{ $regex:'^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$' } };
console.log('기존 데이터(비 AI서칭) 중');
const notAi = { importBatch:{$not:/^ai-search-/} };
console.log('  Email 칸이 비지 않음 :', await L.countDocuments({...notAi, ...hasEmail}));
console.log('  실제 이메일 형식     :', await L.countDocuments({...notAi, ...realEmail}));
console.log('  형식이 아닌 값       :', await L.countDocuments({...notAi, ...hasEmail, Email:{$nin:['',null], $not:new RegExp('^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$')}}));
console.log('\n형식이 아닌 값 예시:');
const bad = await L.find({...notAi, ...hasEmail, Email:{$nin:['',null], $not:new RegExp('^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$')}}).project({Email:1}).limit(10).toArray();
const seen = new Set();
for (const b of bad) { if(!seen.has(b.Email)){seen.add(b.Email); console.log('   ', b.Email);} }
console.log('\n발송대기 409건 중 실제 이메일 형식:', await L.countDocuments({stage:'verified', ...realEmail}), '/ 409');
await mongoose.disconnect();
