import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');

// 한국 브랜드를 이미 취급하는가? = 기존 발굴의 판단 기준이었다
const KR = /cosrx|beauty of joseon|anua|medicube|skin1004|torriden|round lab|laneige|innisfree|tirtir|numbuz|axis-y|biodance|k-?beauty|korean/i;

console.log('=== 발송대기 410건: 한국 브랜드 취급 여부 ===');
const withKr = await L.countDocuments({ stage:'verified', $or:[{BrandsChannels:KR},{Evidence:KR}] });
console.log('  한국 브랜드 언급 있음:', withKr);
console.log('  없음 (dermaofficial 류):', 410 - withKr);

console.log('\n=== 분류별로 한국 브랜드 언급이 없는 건 ===');
for (const cat of ['Distributor','Brand/Manufacturer','Retail Chain','Online Store','Retailer','Clinic']) {
  const tot = await L.countDocuments({stage:'verified', Category:cat});
  const noKr = await L.countDocuments({stage:'verified', Category:cat, BrandsChannels:{$not:KR}, Evidence:{$not:KR}});
  console.log('  ', cat.padEnd(20), `${String(noKr).padStart(3)} / ${tot}`);
}

console.log('\n=== 기존 CSV 임포트분(구 데이터)은 어떤 기준이었나 ===');
for (const b of ['import-20260730-0044','import-20260811-0142']) {
  const tot = await L.countDocuments({importBatch:b});
  const kr  = await L.countDocuments({importBatch:b, $or:[{BrandsChannels:KR},{Evidence:KR}]});
  console.log('  ', b, `총 ${tot} · 한국브랜드 언급 ${kr} (${Math.round(kr/tot*100)}%)`);
}
await mongoose.disconnect();
