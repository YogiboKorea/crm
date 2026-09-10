import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const moved = await L.find({ restoredAt: { $exists: true } }).toArray();
console.log('기존 데이터에서 옮긴 리드:', moved.length, '건');
console.log('발송대기 전체:', await L.countDocuments({stage:'verified'}));
console.log('  승인(readyForOutreach) :', await L.countDocuments({stage:'verified', readyForOutreach:true}));
console.log('  미승인                  :', await L.countDocuments({stage:'verified', readyForOutreach:{$ne:true}}));
if (moved.length) {
  console.log('\n옮긴 것 샘플 — 검토 화면에 필요한 칸이 차 있나:');
  for (const m of moved.slice(0,5)) {
    console.log('  ', m.Company, '|', m.Country, '| Category:', m.Category || '(없음)');
    console.log('     Evidence:', String(m.Evidence||'(비어있음)').slice(0,70));
    console.log('     Type:', m.Type || '(없음)', '| stage:', m.stage, '| 승인:', m.readyForOutreach);
  }
}
console.log('\n=== 기존 데이터(보관함)의 근거·분류 보유율 ===');
const notAi = { importBatch:{$not:/^ai-search-/}, Email:{$regex:/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/} };
const tot = await L.countDocuments(notAi);
console.log('  대상', tot);
console.log('  Evidence 있음 :', await L.countDocuments({...notAi, Evidence:{$nin:['',null]}}));
console.log('  Type 있음     :', await L.countDocuments({...notAi, Type:{$nin:['',null]}}));
console.log('  Category 있음 :', await L.countDocuments({...notAi, Category:{$nin:['',null]}}));
await mongoose.disconnect();
