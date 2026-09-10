/**
 * 올린 데이터(보관함) 중 A급을 검증 완료로 되돌린다.
 *
 * A급 기준 (src/lib/lead-tier.ts 와 같다)
 *   · 실제 이메일 주소가 있고
 *   · 홈페이지가 있고
 *   · 회사명이나 도메인에 대형 유통사·체인 이름이 들어 있는 곳
 *     (Sephora, Ulta, Watsons, Douglas, Nykaa, Olive Young …)
 *
 * 왜 되돌릴 만한가:
 * 이 업체들은 예전 정리 과정에서 보관함으로 밀려 있었지만, 대형 유통사는
 * 한 곳만 뚫려도 물량이 크다. 이메일과 사이트까지 있으니 보낼 수 있는 상태다.
 *
 * 제외하는 것
 *   · 이미 지운 건(deleted)
 *   · AI 가 무관 판정한 건(not-buyer) — 검증 실패로 분류된 것
 *   · 한국 업체 — 해외 바이어 발굴이 목적이다
 *   · 오염된 주소로 표시된 건(badEmailAt) · 중복 숨김(dupHiddenAt)
 *
 * 사용:
 *   node scripts/promote-legacy-tier-a.mjs           ← 미리보기
 *   node scripts/promote-legacy-tier-a.mjs --apply   ← 실제 이동
 */
import fs from 'fs';
import { MongoClient } from 'mongodb';

const APPLY = process.argv.includes('--apply');
const env = fs.readFileSync('.env.local', 'utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '');

// src/lib/lead-tier.ts 의 MAJOR_RETAILERS 와 같은 목록
const MAJOR_RETAILERS = [
  'sephora', 'ulta', 'walmart', 'target', 'costco', 'amazon',
  'boots', 'superdrug', 'watsons', 'as watson', 'mannings',
  'douglas', 'nocibe', 'marionnaud', 'kruidvat',
  'dm-drogerie', 'dm drogerie', 'rossmann', 'muller', 'müller',
  'etos', 'trekpleister', 'ici paris', 'iciparisxl',
  'harrods', 'selfridges', 'liberty', 'harvey nichols',
  'el corte ingles', 'el corte inglés',
  'galeries lafayette', 'printemps', 'kadewe',
  'la rinascente', 'la redoute',
  'shinsegae', 'lotte', 'olive young', 'chicor', 'aritaum',
  'hyundai department',
  'nykaa', 'purplle', 'tira', 'reliance', 'shoppers stop',
  'sociolla', 'cosrx', 'watson', 'guardian',
  'matsumotokiyoshi', 'matsukiyo', 'welcia',
  'ainz', 'tsuruha', 'sundrug', 'tokyu hands', 'loft',
  'faces', 'sephora middle east', 'gulf',
  'asos', 'cult beauty', 'lookfantastic', 'feelunique',
  'beauty bay', 'mecca', 'adore beauty',
  'yesstyle', 'stylekorean', 'jolse', 'stylevana',
  'falabella', 'liverpool', 'palacio de hierro',
  'beauty distributor', 'beauty wholesaler', 'cosmetics distributor',
];

const REAL_EMAIL = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const SITE_RE = /^https?:\/\/|^www\.|\.(com|net|org|co|io|kr|jp|de|fr|uk|es|it|ru|au|nl|pl|tr|sa|ae|hk|sg|my|vn|th|id|ph|in|br|mx|ar|ca)($|\/)/i;
const isKorean = (c) => /korea|한국|대한민국/i.test(c || '') && !/north/i.test(c || '');

const c = new MongoClient(uri);
await c.connect();
const L = c.db().collection('leads');

const LEGACY = {
  deleted: { $ne: true },
  stage: 'archived',
  'verification.aiVerdict': { $ne: 'not-buyer' },
  dupHiddenAt: { $exists: false },
  badEmailAt: { $exists: false },
  importBatch: { $not: /^ai-search-/ },
};

const docs = await L.find(LEGACY, {
  projection: { leadId: 1, Company: 1, Country: 1, Email: 1, WebsiteContact: 1, importBatch: 1 },
}).toArray();

console.log('올린 데이터(보관함) 검사 대상:', docs.length, '건');

const picked = [];
const rejected = [];
for (const d of docs) {
  const email = String(d.Email || '').trim();
  if (!REAL_EMAIL.test(email)) continue;
  const site = String(d.WebsiteContact || '').trim();
  if (!site || !SITE_RE.test(site)) continue;
  if (isKorean(d.Country)) continue;

  const hay = `${String(d.Company || '').toLowerCase()} ${site.toLowerCase()}`;
  const hit = MAJOR_RETAILERS.find((kw) => hay.includes(kw));
  if (!hit) continue;

  // 키워드만 맞으면 대형 유통사 이름을 달았을 뿐 실제로는 보낼 수 없는 곳이 섞인다.
  // 보내봐야 반송되거나 엉뚱한 부서로 가는 주소를 여기서 걸러낸다.
  const lower = email.toLowerCase();
  const domain = lower.split('@')[1] || '';
  const local = lower.split('@')[0] || '';

  //  ① 가짜·깨진 주소 — abc@xyz.com, krt@097ce.blitz 같은 것
  const FAKE_DOMAIN = /^(xyz|example|test|abc)\.|\.(blitz|invalid|local|test)$/;
  if (FAKE_DOMAIN.test(domain)) { rejected.push({ ...d, hit, why: '가짜/깨진 주소' }); continue; }

  //  ② 한국 공급사 — 우리가 찾는 건 해외 바이어다 (StyleKorean 등은 경쟁 수출사)
  if (domain.endsWith('.co.kr') || domain.endsWith('.kr') || hay.includes('stylekorean')) {
    rejected.push({ ...d, hit, why: '한국 공급사(경쟁사)' }); continue;
  }

  //  ③ 소비자 응대·법무 주소 — 바이어에게 닿지 않는다
  const CONSUMER_ROLE = /^(privacy|legal|consumerrelations|customerservice|customerservices|atencion|atencao|support|help|webmaster|noreply|no-reply|donotreply)/;
  if (CONSUMER_ROLE.test(local) || /consumerrelations|catalogmaster|reporting/.test(local)) {
    rejected.push({ ...d, hit, why: '소비자 응대/자동 발송 주소' }); continue;
  }

  //  ④ 무료 메일 — 대형 유통사가 gmail 을 쓰지는 않는다 (이름만 빌린 곳)
  if (/^(gmail|yahoo|hotmail|outlook|naver|daum)\./.test(domain)) {
    rejected.push({ ...d, hit, why: '대형사인데 무료 메일' }); continue;
  }

  picked.push({ ...d, hit });
}

console.log('A급으로 판정된 곳:', picked.length, '건\n');

const byHit = new Map();
for (const p of picked) byHit.set(p.hit, (byHit.get(p.hit) || 0) + 1);
console.log('=== 걸린 키워드 ===');
[...byHit.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) =>
  console.log(`   ${String(n).padStart(3)}건  ·  ${k}`));

console.log('\n=== 이동 대상 (상위 25) ===');
picked.slice(0, 25).forEach((p) =>
  console.log(`   ${String(p.Company || '').slice(0, 40).padEnd(42)} | ${String(p.Country || '-').padEnd(16)} | ${p.Email}`));
if (picked.length > 25) console.log(`   ... 외 ${picked.length - 25}건`);

if (!APPLY) {
  console.log('\n미리보기입니다. 실제로 옮기려면 --apply 를 붙이세요.');
  await c.close();
  process.exit(0);
}

const now = new Date().toISOString();
const ids = picked.map((p) => p._id);
let moved = 0;
for (let i = 0; i < ids.length; i += 500) {
  const r = await L.updateMany(
    { _id: { $in: ids.slice(i, i + 500) } },
    {
      $set: {
        stage: 'verified',
        stageChangedAt: now,
        // 되돌릴 수 있게 어디서 왜 왔는지 남긴다
        bulkMoveReason: '올린 데이터에서 A급(대형 유통사)으로 판정되어 검증 완료로 이동',
        bulkMovedAt: now,
      },
    },
  );
  moved += r.modifiedCount;
}
console.log('\n이동 완료 —', moved, '건을 검증 완료로 옮겼습니다.');
console.log('검증 완료 총계:', await L.countDocuments({ stage: 'verified', deleted: { $ne: true } }));
await c.close();
