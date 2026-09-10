/**
 * 기존 데이터(발송 가능 2,563건)의 중복 점검.
 * 같은 곳에 두 번 보내면 스팸으로 신고당하므로, 옮기기 전에 축별로 본다.
 */
import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');

const RX = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const legacy = (await L.find({ importBatch:{$not:/^ai-search-/} })
  .project({leadId:1,Company:1,Country:1,Email:1,WebsiteContact:1,stage:1,Category:1}).toArray())
  .filter(l => RX.test(String(l.Email||'').trim()));
const live = await L.find({ stage:'verified' })
  .project({leadId:1,Company:1,Email:1,WebsiteContact:1}).toArray();

console.log(`기존 데이터(발송 가능) ${legacy.length}건 · 현재 발송대기 ${live.length}건\n`);

const norm = e => String(e||'').trim().toLowerCase();
// 회사명 정규화 — 법인격·기호를 걷어내고 비교한다 (Rossmann 이 두 표기로 들어온 사례)
const nc = s => String(s||'').toLowerCase()
  .replace(/[—–-].*$/,'')                      // 설명 꼬리 제거
  .replace(/\b(gmbh|ltd|limited|inc|llc|s\.?r\.?o\.?|s\.?l\.?|b\.?v\.?|a\/s|ab|as|oy|sas|sarl|spa|srl|co|corp|company|group|kft|sp\.? z ?o\.?o\.?)\b/g,'')
  .replace(/[^a-z0-9가-힣]/g,'')
  .trim();
// 도메인 — 플랫폼 주소는 회사 구분이 안 되므로 제외
const PLATFORM = /^(facebook|instagram|linkedin|twitter|x|youtube|tiktok|google|shopify|wix|wordpress|amazon|etsy|ebay|gmail|yahoo|hotmail|outlook|naver|daum)\./;
const dom = u => {
  const m = String(u||'').match(/^https?:\/\/(?:www\.)?([^\/\s?#]+)/i);
  if (!m) return '';
  const d = m[1].toLowerCase();
  return PLATFORM.test(d) ? '' : d;
};
const emailDom = e => norm(e).split('@')[1] || '';

const group = (arr, keyFn) => {
  const m = new Map();
  for (const x of arr) { const k = keyFn(x); if (!k) continue; (m.get(k) || m.set(k,[]).get(k)).push(x); }
  return [...m.entries()].filter(([,v]) => v.length > 1).sort((a,b)=>b[1].length-a[1].length);
};

const show = (title, groups, note) => {
  const extra = groups.reduce((a,[,v]) => a + v.length - 1, 0);
  console.log(`=== ${title} ===`);
  console.log(`  중복 묶음 ${groups.length}개 · 한 곳당 1건만 남기면 ${extra}건이 줄어듭니다`);
  if (note) console.log(`  ${note}`);
  for (const [k,v] of groups.slice(0,6)) {
    console.log(`   ${String(k).slice(0,42).padEnd(44)} ${v.length}건`);
    for (const x of v.slice(0,3)) console.log(`      · ${String(x.Company||'').slice(0,52)}  [${x.stage}]`);
  }
  console.log();
  return extra;
};

const a = show('① 완전히 같은 이메일 주소', group(legacy, x => norm(x.Email)));
const b = show('② 같은 웹사이트 도메인', group(legacy, x => dom(x.WebsiteContact)), '(facebook 등 플랫폼 주소는 제외)');
const c = show('③ 같은 이메일 도메인 (한 회사의 여러 담당자)', group(legacy, x => emailDom(x.Email)));
const d = show('④ 회사명이 사실상 같음 (법인격·기호 무시)', group(legacy, x => nc(x.Company)));

// 현재 발송대기와 겹치는가 — 이게 제일 위험하다
const liveEmails = new Set(live.map(x => norm(x.Email)));
const liveDoms   = new Set(live.map(x => dom(x.WebsiteContact)).filter(Boolean));
const liveNames  = new Set(live.map(x => nc(x.Company)).filter(Boolean));
const clashE = legacy.filter(x => liveEmails.has(norm(x.Email)));
const clashD = legacy.filter(x => !liveEmails.has(norm(x.Email)) && liveDoms.has(dom(x.WebsiteContact)));
const clashN = legacy.filter(x => !liveEmails.has(norm(x.Email)) && !liveDoms.has(dom(x.WebsiteContact)) && liveNames.has(nc(x.Company)));
console.log('=== ⑤ 이미 발송대기(409건)에 있는 곳과 겹침 ===');
console.log('  같은 이메일    :', clashE.length);
console.log('  같은 웹도메인  :', clashD.length);
console.log('  같은 회사명    :', clashN.length);
for (const x of [...clashE, ...clashD, ...clashN].slice(0,6))
  console.log('     ·', String(x.Company||'').slice(0,50), '|', x.Email);

const uniqueKeys = new Set(legacy.map(x => norm(x.Email)));
console.log('\n=== 정리하면 ===');
console.log('  기존 데이터 발송 가능 :', legacy.length);
console.log('  이메일 기준 고유      :', uniqueKeys.size);
console.log('  발송대기와 겹치는 건  :', clashE.length + clashD.length + clashN.length);
console.log('  → 실제로 새로 보낼 수 있는 곳 대략:',
  uniqueKeys.size - (clashE.length + clashD.length + clashN.length));
await mongoose.disconnect();
