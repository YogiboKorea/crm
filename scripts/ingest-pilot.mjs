#!/usr/bin/env node
/**
 * 유럽 화장품 B2B 파일럿 결과 → ai-searched stage 삽입.
 *
 * 검색 에이전트가 Country/Company/WebsiteContact 필드에 설명을 길게 넣어놔서
 * 그대로 넣으면 국가 필터·중복 체크가 깨진다. 여기서 정규화한다:
 *   Country "Germany (HQ: Luise-Rainer-Str...; VAT DE344...)"  → "Germany"
 *   Company "Douglas AG (…) — operating entity: …; banner: …"  → "Douglas AG (…)"
 *   Website "https://a/... (설명) / https://b / https://c"     → "https://a/..."
 * 잘라낸 상세는 notes 로 보존한다 (정보를 버리지 않는다).
 *
 * 사용법:
 *   node -r dotenv/config scripts/ingest-pilot.mjs dotenv_config_path=.env.local \
 *     --input=<workflow output json> [--apply]
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';

const URI = process.env.MONGODB_URI;
if (!URI) { console.error('MONGODB_URI 없음'); process.exit(1); }

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  }),
);
const INPUT = args.input;
const APPLY = args.apply === true || args.apply === 'true';
if (!INPUT || !fs.existsSync(INPUT)) {
  console.error('--input=<path> 필수');
  process.exit(1);
}

// ── 국가 정규화 ─────────────────────────────────────────────
const COUNTRIES = [
  'United Kingdom', 'Czech Republic', 'Bosnia and Herzegovina', 'North Macedonia',
  'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Portugal',
  'Ireland', 'Austria', 'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Finland',
  'Poland', 'Hungary', 'Greece', 'Romania', 'Bulgaria', 'Slovakia', 'Slovenia',
  'Croatia', 'Serbia', 'Estonia', 'Latvia', 'Lithuania', 'Iceland', 'Luxembourg',
  'Malta', 'Cyprus', 'Turkey', 'Ukraine', 'USA', 'United States', 'Canada',
  'South Korea', 'Korea', 'Japan', 'China', 'Australia',
];
// 흔한 별칭 → 표준 표기
const ALIAS = {
  'uk': 'United Kingdom', 'u.k.': 'United Kingdom', 'great britain': 'United Kingdom',
  'england': 'United Kingdom', 'scotland': 'United Kingdom', 'wales': 'United Kingdom',
  'deutschland': 'Germany', 'österreich': 'Austria', 'schweiz': 'Switzerland',
  'espana': 'Spain', 'españa': 'Spain', 'italia': 'Italy', 'nederland': 'Netherlands',
  'polska': 'Poland', 'czechia': 'Czech Republic', 'us': 'USA', 'u.s.': 'USA',
  'the netherlands': 'Netherlands',
};

function normalizeCountry(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';

  // 1) 괄호/쉼표/세미콜론/대시 앞부분만 취함
  let head = s.split(/[(,;/]|\s[—–-]\s/)[0].trim();
  const lower = head.toLowerCase();
  if (ALIAS[lower]) return ALIAS[lower];
  const exact = COUNTRIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  // 2) 전체 문자열에서 알려진 국가명을 찾음 (긴 이름 우선 — "United Kingdom" 이 "Kingdom" 보다 먼저)
  const byLength = [...COUNTRIES].sort((a, b) => b.length - a.length);
  for (const c of byLength) {
    if (new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s)) return c;
  }
  for (const [k, v] of Object.entries(ALIAS)) {
    if (new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s)) return v;
  }

  // 3) 못 찾으면 앞부분을 짧게 잘라 반환 (완전히 버리지는 않는다)
  return head.slice(0, 40);
}

// ── 회사명 정규화 ───────────────────────────────────────────
function normalizeCompany(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  // em/en dash 뒤 부연설명 제거 · 세미콜론 뒤 제거
  s = s.split(/\s[—–]\s/)[0];
  s = s.split(';')[0];
  s = s.replace(/\s+/g, ' ').trim();
  return s.slice(0, 90);
}

// ── URL 정규화 (첫 번째 http URL 만) ────────────────────────
function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/https?:\/\/[^\s()<>"',]+/i);
  if (m) return m[0].replace(/[.,;]+$/, '');
  return s.split(/[\s(]/)[0].slice(0, 200);
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return String(url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0]; }
}

// ── 카테고리 라벨 ───────────────────────────────────────────
const CAT_LABEL = {
  'A-대형유통': 'A. 대형 유통사·체인',
  'B-로컬브랜드': 'B. 로컬 브랜드·제조사',
  'C-편집숍': 'C. 뷰티 편집숍',
};

const payload = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
const inner = payload.result || payload;
const candidates = inner.candidates || [];
if (!candidates.length) { console.error('candidates 비어있음'); process.exit(1); }

console.log(`\n=== 파일럿 결과 ${candidates.length}건 (mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

await mongoose.connect(URI);
const Lead = mongoose.connection.db.collection('leads');

const existing = await Lead.find({}, { projection: { Company: 1, Country: 1, WebsiteContact: 1, leadId: 1 } }).toArray();
const byDomain = new Map();
const byCC = new Map();
for (const d of existing) {
  const dom = domainOf(d.WebsiteContact || '');
  if (dom) byDomain.set(dom, d.leadId);
  const k = `${(d.Country || '').toLowerCase().trim()}::${(d.Company || '').toLowerCase().trim()}`;
  if ((d.Company || '').trim()) byCC.set(k, d.leadId);
}
console.log(`기존 DB — 도메인 ${byDomain.size} · 회사키 ${byCC.size}`);

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
const batchId = `eu-cosmetics-${stamp}`;

const docs = [];
const skip = { 'domain-dup': 0, 'cc-dup': 0, 'no-company': 0, 'no-url': 0 };
const catCount = {};
let seq = 0;

for (const c of candidates) {
  const Company = normalizeCompany(c.Company);
  const Country = normalizeCountry(c.Country);
  const WebsiteContact = normalizeUrl(c.WebsiteContact);
  if (!Company) { skip['no-company']++; continue; }
  if (!WebsiteContact) { skip['no-url']++; continue; }

  const dom = domainOf(WebsiteContact);
  if (dom && byDomain.has(dom)) { skip['domain-dup']++; continue; }
  const ccKey = `${Country.toLowerCase()}::${Company.toLowerCase()}`;
  if (byCC.has(ccKey)) { skip['cc-dup']++; continue; }

  const cat = c._cat || '';
  const catLabel = CAT_LABEL[cat] || cat;
  catCount[cat] = (catCount[cat] || 0) + 1;

  // 잘라낸 상세 정보는 notes 로 보존 (정보를 버리지 않는다)
  const noteParts = [];
  if (c.Scale) noteParts.push(`[규모] ${c.Scale}`);
  if (c.CarriesKBeauty) noteParts.push(`[한국브랜드 취급] ${c.CarriesKBeauty}`);
  if (String(c.Country || '') !== Country) noteParts.push(`[원본 국가정보] ${c.Country}`);
  if (String(c.Company || '') !== Company) noteParts.push(`[원본 회사명] ${c.Company}`);
  if (String(c.WebsiteContact || '') !== WebsiteContact) noteParts.push(`[기타 URL] ${c.WebsiteContact}`);

  seq++;
  docs.push({
    leadId: `${batchId}-${String(seq).padStart(4, '0')}`,
    Company,
    Country,
    Type: c.Type || '',
    Evidence: String(c.Evidence || '').slice(0, 1000),
    BrandsChannels: String(c.BrandsChannels || '').slice(0, 1000),
    WebsiteContact,
    Email: String(c.Email || '').trim(),
    Phone: String(c.Phone || '').trim(),
    Address: '',
    // 카테고리를 Sources 에 넣어 클라이언트가 A/B/C 를 구분해서 볼 수 있게 한다
    Sources: `🔍 AI 서칭 — ${catLabel}`,
    // 한국 브랜드를 아직 취급하지 않는 곳 = 신규 개척 대상 → 우선순위 상향
    Confidence: c.CarriesKBeauty === 'no' ? 'High' : 'Medium',
    Priority: cat === 'B-로컬브랜드' ? 'A' : '',
    LinkedInCompany: '', BuyerContact: '', ContactLinkedIn: '', RoleMemo: '',
    Approach: '', Checked: '', Title: '', owner: '', lastContact: '', nextFollowUp: '',
    notes: noteParts.join('\n').slice(0, 2000),
    status: 'New',
    favorite: false,
    stage: 'ai-searched',
    stageChangedAt: now.toISOString(),
    importBatch: batchId,
    importedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  if (dom) byDomain.set(dom, 'pending');
  byCC.set(ccKey, 'pending');
}

console.log(`\n삽입 대상: ${docs.length}건`);
console.log('카테고리별:', catCount);
console.log('skip:', skip);
console.log(`batchId: ${batchId}`);

console.log('\n정규화 샘플 5건:');
docs.slice(0, 5).forEach((d, i) => {
  console.log(`  ${i + 1}. [${d.Country}] ${d.Company}`);
  console.log(`     ${d.WebsiteContact} | ${d.Email || 'no-email'} | ${d.Sources}`);
});

if (!APPLY) {
  console.log('\n(dry-run) --apply 로 실제 삽입\n');
  await mongoose.disconnect();
  process.exit(0);
}

const CHUNK = 500;
let done = 0;
for (let i = 0; i < docs.length; i += CHUNK) {
  const chunk = docs.slice(i, i + CHUNK);
  const res = await Lead.bulkWrite(chunk.map((d) => ({ insertOne: { document: d } })), { ordered: false });
  done += res.insertedCount || chunk.length;
  console.log(`  삽입 ${done}/${docs.length}`);
}
console.log(`\n✅ ${done}건 ai-searched 삽입 · batchId=${batchId}\n`);
await mongoose.disconnect();
