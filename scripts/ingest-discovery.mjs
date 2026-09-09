#!/usr/bin/env node
// 워크플로우 결과 (K-뷰티 후보 리스트 JSON) → DB 삽입
//
// 사용법:
//   node -r dotenv/config scripts/ingest-discovery.mjs dotenv_config_path=.env.local \
//       --input=path/to/candidates.json [--apply]
//
// 파일 스키마: { candidates: [{Company, Country, WebsiteContact, Email, Phone, Type, BrandsChannels, Evidence}, ...] }
//
// 로직:
//   1. 각 후보 → 기존 DB 대조 (leadId 없음, 도메인 + Company+Country 매칭)
//   2. 신규만 필터
//   3. leadId 생성 (kbeauty-eu-{stamp}-{n}), stage='verifying', importBatch='kbeauty-eu-{stamp}'
//   4. bulkWrite insertOne

import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';

const URI = process.env.MONGODB_URI;
if (!URI) { console.error('MONGODB_URI 없음'); process.exit(1); }

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true])
);
const INPUT = args.input;
const APPLY = args.apply === true || args.apply === 'true';

if (!INPUT || !fs.existsSync(INPUT)) {
  console.error('--input=<path> 필수 (workflow 결과 JSON)');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
const candidates = Array.isArray(payload) ? payload : (payload.candidates || []);
if (candidates.length === 0) { console.error('candidates 배열 비었음'); process.exit(1); }

console.log(`\n=== 후보 ${candidates.length}개 (mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return (url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0]; }
}

await mongoose.connect(URI);
const Lead = mongoose.connection.db.collection('leads');

// 기존 DB의 모든 도메인 + Company+Country 인덱스 준비
const existing = await Lead.find({}, { projection: { Company: 1, Country: 1, WebsiteContact: 1, leadId: 1 } }).toArray();
const existingByDomain = new Map();
const existingByCC = new Map();
for (const d of existing) {
  const dom = domainOf(d.WebsiteContact || '');
  if (dom) existingByDomain.set(dom, d.leadId);
  const ccKey = `${(d.Country||'').toLowerCase().trim()}::${(d.Company||'').toLowerCase().trim()}`;
  if ((d.Company||'').trim()) existingByCC.set(ccKey, d.leadId);
}
console.log(`기존 DB — 도메인 ${existingByDomain.size} · 회사키 ${existingByCC.size}`);

// timestamp
const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, '-');
const batchId = `kbeauty-eu-${stamp.slice(0, 16)}`;

const newDocs = [];
const skipReasons = { 'domain-dup': 0, 'cc-dup': 0, 'no-company': 0, 'no-url': 0 };
let seq = 0;

for (const c of candidates) {
  const Company = (c.Company || '').toString().trim();
  const Country = (c.Country || '').toString().trim();
  const WebsiteContact = (c.WebsiteContact || '').toString().trim();
  const Email = (c.Email || '').toString().trim();
  const Phone = (c.Phone || '').toString().trim();
  const Type = (c.Type || '').toString().trim();
  const BrandsChannels = (c.BrandsChannels || '').toString().trim();
  const Evidence = (c.Evidence || '').toString().trim();

  if (!Company) { skipReasons['no-company']++; continue; }
  if (!WebsiteContact) { skipReasons['no-url']++; continue; }

  const dom = domainOf(WebsiteContact);
  if (dom && existingByDomain.has(dom)) { skipReasons['domain-dup']++; continue; }

  const ccKey = `${Country.toLowerCase()}::${Company.toLowerCase()}`;
  if (existingByCC.has(ccKey)) { skipReasons['cc-dup']++; continue; }

  // 새 리드
  seq++;
  const leadId = `${batchId}-${String(seq).padStart(4, '0')}`;
  const doc = {
    leadId,
    Company,
    Country,
    Type: Type || 'Distributor',
    Evidence,
    BrandsChannels,
    WebsiteContact,
    Email,
    Phone,
    Address: '',
    Sources: 'K-뷰티 EU 발굴 워크플로우',
    Confidence: 'Medium',
    Priority: '',
    LinkedInCompany: '',
    BuyerContact: '',
    ContactLinkedIn: '',
    RoleMemo: '',
    Approach: '',
    Checked: '',
    Title: '',
    owner: '',
    lastContact: '',
    nextFollowUp: '',
    notes: '',
    status: 'New',
    favorite: false,
    stage: 'ai-searched',
    stageChangedAt: now.toISOString(),
    importBatch: batchId,
    importedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    // 신규 발굴은 웹 발견이라 crawledAt/verifiedAt 초기값 없음 — verify-ai 파이프라인이 처리
  };
  newDocs.push(doc);
  // dedup 내부 캐시에 즉시 추가 (같은 워크플로우에서 여러 결과 중복 방지)
  if (dom) existingByDomain.set(dom, leadId);
  existingByCC.set(ccKey, leadId);
}

console.log(`\n=== 삽입 대상: ${newDocs.length}건 ===`);
console.log(`skip 사유:`, skipReasons);
console.log(`batchId: ${batchId}\n`);

// 샘플 5개 출력
console.log('샘플:');
newDocs.slice(0, 5).forEach((d, i) => {
  console.log(`  ${i+1}. [${d.Country}] ${d.Company} — ${d.WebsiteContact} — ${d.Email || 'no-email'} (${d.Type})`);
});

if (!APPLY) {
  console.log('\n(dry-run) --apply 를 붙이면 실제로 DB 에 삽입됩니다.');
  await mongoose.disconnect();
  process.exit(0);
}

if (newDocs.length === 0) {
  console.log('삽입할 신규 리드 없음.');
  await mongoose.disconnect();
  process.exit(0);
}

// 500건씩 청크
const CHUNK = 500;
let done = 0;
for (let i = 0; i < newDocs.length; i += CHUNK) {
  const chunk = newDocs.slice(i, i + CHUNK);
  const ops = chunk.map(d => ({ insertOne: { document: d } }));
  const res = await Lead.bulkWrite(ops, { ordered: false });
  done += (res.insertedCount || chunk.length);
  console.log(`  삽입 진행: ${done}/${newDocs.length}`);
}
console.log(`\n✅ 완료: ${done}건 ai-searched stage 로 삽입 · batchId=${batchId}`);
console.log(`\n다음 단계: UI 사이드바 → "🤖 AI 서칭" 에서 검토 후 검증대기/발송대기로 이동`);

await mongoose.disconnect();
