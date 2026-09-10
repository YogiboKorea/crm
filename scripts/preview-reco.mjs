import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
// reco-score.ts 와 같은 규칙 (TS 를 그대로 못 불러서 이식 — 배점이 바뀌면 여기도 같이 고칠 것)
const CATEGORY_SCORE = {'Distributor':[30,'유통사 — 한 곳 뚫리면 여러 채널로 퍼짐'],'Retail Chain':[25,'리테일 체인 — 매장 수만큼 물량'],'Brand/Manufacturer':[20,'브랜드·제조사 — 역방향 제안도 가능'],'Retailer':[15,'매장·편집숍'],'Online Store':[12,'온라인몰'],'Clinic':[8,'클리닉 — 물량은 작음']};
const PREFIX_SCORE = [[/^(b2b|wholesale|purchas|buying|buyer|procure|vendor|supplier|partner|bd|business)/i,25,'B2B·구매 담당 주소'],[/^(sales|commercial|export|import|trade|marketing)/i,18,'영업·수출입 담당'],[/^(office|kontakt|contact|hello|hola|bonjour|ciao|mail|inquiry|enquir)/i,10,'대표 문의 주소'],[/^(info|admin)/i,8,'일반 대표 주소'],[/^(support|help|customer|service|care|shop|eshop|order|webshop)/i,3,'고객지원 주소 — 묻히기 쉬움']];
const KR_BRAND=/cosrx|beauty of joseon|anua|medicube|skin1004|torriden|round lab|laneige|innisfree|tirtir|numbuz|axis-?y|biodance|dr\.?\s*althea|purito|isntree|tocobo|mixsoon|k-?beauty|korean/i;
const bcnt=s=>String(s||'').split(/[,;·]/).map(x=>x.trim()).filter(x=>x.length>1).length;
function reco(l){const R=[];let s=0;
  const [cp,cw]=CATEGORY_SCORE[l.Category]||[10,'']; s+=cp; if(cw)R.push(cw);
  const p=String(l.Email||'').split('@')[0]||'';
  for(const [rx,pt,w] of PREFIX_SCORE){if(rx.test(p)){s+=pt;R.push(w);break;}}
  const hay=`${l.BrandsChannels||''} ${l.Evidence||''}`;
  if(KR_BRAND.test(hay)){s+=15;R.push('한국 브랜드 이미 취급');}else{R.push('신규 개척 대상');}
  const b=bcnt(l.BrandsChannels);
  if(b>=11){s+=10;R.push(`취급 브랜드 ${b}개`);}else if(b>=6){s+=7;R.push(`취급 브랜드 ${b}개`);}else if(b>=3){s+=4;R.push(`취급 브랜드 ${b}개`);}
  const e=String(l.Evidence||'').length;
  if(e>=200)s+=8;else if(e>=100)s+=4;else if(e<40)R.push('근거 얇음');
  if(String(l.Phone||'').trim())s+=4;
  return {score:Math.min(100,Math.round(s/92*100)),reasons:R};
}
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const all = (await L.find({stage:'verified'}).toArray()).map(l=>({...l,...reco(l)}))
  .sort((a,b)=>b.score-a.score);
console.log('=== 점수 분포 ===');
const d={'80+':0,'60-79':0,'40-59':0,'40미만':0};
for(const l of all) d[l.score>=80?'80+':l.score>=60?'60-79':l.score>=40?'40-59':'40미만']++;
for(const [k,v] of Object.entries(d)) console.log('  ',k.padEnd(8),v);
console.log('\n=== 상위 10 ===');
for(const l of all.slice(0,10))
  console.log(`  ${String(l.score).padStart(3)} ${String(l.Country).slice(0,12).padEnd(13)} ${String(l.Company).slice(0,36).padEnd(38)} ${l.Email}`);
console.log('\n=== 하위 5 ===');
for(const l of all.slice(-5))
  console.log(`  ${String(l.score).padStart(3)} ${String(l.Country).slice(0,12).padEnd(13)} ${String(l.Company).slice(0,36).padEnd(38)} ${l.Email}`);
console.log('\n=== 1위 근거 ===');
console.log('  ', all[0].Company);
for(const r of all[0].reasons) console.log('    ·', r);
await mongoose.disconnect();
