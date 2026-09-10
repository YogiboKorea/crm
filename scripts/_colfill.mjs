import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const q = { stage:'verified' };
const tot = await L.countDocuments(q);
console.log('발송대기', tot, '건 · 표에 나가는 칸이 실제로 차 있는 비율\n');
for (const [label, filter] of [
  ['회사명 Company',   { Company:{$nin:['',null]} }],
  ['국가 Country',     { Country:{$nin:['',null]} }],
  ['업종 Type',        { Type:{$nin:['',null]} }],
  ['이메일 Email',     { Email:{$nin:['',null]} }],
  ['웹사이트',          { WebsiteContact:{$nin:['',null]} }],
  ['Priority',         { Priority:{$nin:['',null]} }],
  ['담당자 BuyerContact',{ BuyerContact:{$nin:['',null]} }],
  ['전화 Phone',       { Phone:{$nin:['',null]} }],
  ['발송승인 ready',    { readyForOutreach:true }],
]) {
  const n = await L.countDocuments({...q, ...filter});
  const p = Math.round(n/tot*100);
  console.log('  ', label.padEnd(22), '█'.repeat(Math.round(p/5)).padEnd(20), String(p).padStart(3)+'%');
}
console.log('\nstage 값 종류 (이 화면 안에서):');
for (const r of await L.aggregate([{$match:q},{$group:{_id:'$stage',n:{$sum:1}}}]).toArray())
  console.log('  ', r._id, r.n, '← 전부 같으면 열이 필요 없다');
await mongoose.disconnect();
