import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const all = await L.find({stage:'verified'}).toArray();
console.log('발송대기', all.length, '건\n');

// 1) 이메일 앞부분 — 어느 부서로 가는 주소인가
const pre = {};
for (const l of all) { const p = String(l.Email||'').split('@')[0].toLowerCase(); pre[p]=(pre[p]||0)+1; }
console.log('=== 이메일 앞부분 상위 15 ===');
for (const [k,v] of Object.entries(pre).sort((a,b)=>b[1]-a[1]).slice(0,15)) console.log('  ', k.padEnd(22), v);

// 2) 취급 브랜드 개수
const brandCount = (s) => String(s||'').split(/[,;·]/).map(x=>x.trim()).filter(x=>x.length>1).length;
const bc = {0:0,'1-2':0,'3-5':0,'6-10':0,'11+':0};
for (const l of all) { const n = brandCount(l.BrandsChannels);
  bc[n===0?0:n<=2?'1-2':n<=5?'3-5':n<=10?'6-10':'11+']++; }
console.log('\n=== 취급 브랜드 수 ===');
for (const [k,v] of Object.entries(bc)) console.log('  ', String(k).padEnd(8), v);

// 3) 한국 브랜드를 이미 파는가
const KR = /cosrx|beauty of joseon|anua|medicube|skin1004|torriden|round lab|laneige|innisfree|tirtir|numbuz|axis-y|biodance|dr\.?\s*althea|purito|isntree|tocobo|k-?beauty|korean/i;
console.log('\n한국 브랜드 언급:', all.filter(l=>KR.test(String(l.BrandsChannels||'')+String(l.Evidence||''))).length);

// 4) 분류 × 신뢰도
console.log('\n=== 분류 × 신뢰도 ===');
const grid = {};
for (const l of all) { const k = (l.Category||'?')+' / '+(l.Confidence||'?'); grid[k]=(grid[k]||0)+1; }
for (const [k,v] of Object.entries(grid).sort((a,b)=>b[1]-a[1]).slice(0,12)) console.log('  ', k.padEnd(34), v);

// 5) 연락 수단 보유
console.log('\n전화번호 있음:', all.filter(l=>String(l.Phone||'').trim()).length);
console.log('근거 200자 이상:', all.filter(l=>String(l.Evidence||'').length>=200).length);
await mongoose.disconnect();
