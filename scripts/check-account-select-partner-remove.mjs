/**
 * ① 보내는 계정 선택 — 기본은 대표 계정, 고른 계정이 예약에 적히고, 없는 계정이면 막힌다.
 * ② 파트너십 확정 — [대화 진행 중으로] 없음, [🗑 파트너십에서 삭제] 는 DB 에서 지우지 않는 삭제.
 * 실제 발송 없음: 발송·예약 요청은 브라우저에서 가로채고, API 로 만든 예약은 30일 뒤로 잡았다가 바로 지운다.
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const jwt = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const H = { 'Content-Type': 'application/json', Cookie: `admin_session=${jwt}` };
const B = 'http://localhost:3000';
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const A = db.collection('mailaccounts');
const S = db.collection('emailschedules');
const L = db.collection('leads');
// 관리자(마스터) 화면에는 마스터 아이디가 등록한 계정만 보인다 (lib/mail/scope.ts)
const accounts = await A.find({ isActive: { $ne: false }, owner: { $in: ['admin', 'yogico'] } }).project({ smtpUser: 1, fromAddress: 1, isDefault: 1 }).toArray();
const def = accounts.find((a) => a.isDefault);
const other = accounts.find((a) => !a.isDefault);
console.log(`  계정: ${accounts.map((a) => `${a.fromAddress || a.smtpUser}${a.isDefault ? '(대표)' : ''}`).join(', ')}`);
const tpl = await db.collection('emailtemplates').findOne({ isActive: { $ne: false }, 'attachments.0': { $exists: false } });
const leadBefore = await L.findOne({ leadId: 'test-send-0914' }, { projection: { emailHistory: 1, lastEmailSentAt: 1, stage: 1 } });

console.log('── ① API');
const far = new Date(Date.now() + 30 * 86400000).toISOString();
const mk = (acc) => fetch(`${B}/api/mail/schedule`, { method: 'POST', headers: H, body: JSON.stringify({ leadIds: ['test-send-0914'], templateId: String(tpl._id), scheduledFor: far, ...(acc !== undefined ? { mailAccountId: acc } : {}) }) }).then(async (r) => ({ status: r.status, j: await r.json() }));
const madeBatches = [];
try {
  const r1 = await mk(undefined);
  madeBatches.push(r1.j.batchId);
  const d1 = await S.findOne({ batchId: r1.j.batchId });
  ok(r1.j.success && d1?.mailAccountId === String(def._id), `계정 안 고르면 대표 계정(${def.fromAddress || def.smtpUser})이 예약에 적힘`);
  if (other) {
    const r2 = await mk(String(other._id));
    madeBatches.push(r2.j.batchId);
    const d2 = await S.findOne({ batchId: r2.j.batchId });
    ok(r2.j.success && d2?.mailAccountId === String(other._id), `다른 계정(${other.fromAddress || other.smtpUser})을 고르면 그 계정이 예약에 적힘`);
  }
  const r3 = await mk('0123456789abcdef01234567');
  ok(r3.status === 400 && /찾을 수 없거나/.test(r3.j.error || ''), `없는 계정을 고르면 예약을 만들지 않음 → ${r3.j.error}`);
} finally {
  const del = await S.deleteMany({ batchId: { $in: madeBatches.filter(Boolean) } });
  console.log(`      (확인용 예약 ${del.deletedCount}건 지움)`);
}
  const c3 = await fetch(`${B}/api/mail/campaign`, { method: 'POST', headers: H, body: JSON.stringify({ leadIds: ['test-send-0914'], templateId: String(tpl._id), startAt: far, mailAccountId: 'not-an-id' }) });
  const c3j = await c3.json();
  ok(c3.status === 400 && /찾을 수 없거나/.test(c3j.error || ''), `일괄 예약도 없는 계정이면 막힘 → ${c3j.error}`);

const leadAfter = await L.findOne({ leadId: 'test-send-0914' }, { projection: { emailHistory: 1, lastEmailSentAt: 1, stage: 1 } });
ok(JSON.stringify(leadBefore) === JSON.stringify(leadAfter), '테스트 업체 발송 기록은 그대로');

// ── 브라우저
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
const captured = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('dialog', async (d) => { console.log('      [dialog]', d.type(), d.message().replace(/\s+/g, ' ').slice(0, 90)); await d.accept(); });
p.on('response', (r) => { if (/\/remove/.test(r.url())) console.log('      [remove]', r.status()); });
await p.setRequestInterception(true);
p.on('request', (r) => {
  if (/\/api\/mail\/(send|schedule|campaign|reply)/.test(r.url()) && r.method() !== 'GET') {
    captured.push({ url: r.url(), body: r.postData() });
    return r.abort();
  }
  r.continue();
});
await p.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });
await p.setViewport({ width: 1440, height: 1000 });
const waitFor = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); } return false; };

const TEMP = 'test-partner-remove-0914';
try {
  console.log('── ① 발송관리 화면');
  await p.goto(`${B}/`, { waitUntil: 'networkidle2' });
  await w(1000);
  await p.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-contacted"]').click());
  ok(await waitFor(() => !!document.getElementById('obAcc')), '보내는 계정이 선택칸으로 바뀜');
  const opts = await p.$$eval('#obAcc option', (o) => o.map((x) => ({ v: x.value, t: x.textContent.trim(), s: x.selected })));
  ok(opts.length === accounts.length, `등록된 계정 ${accounts.length}개가 모두 보임 — ${opts.map((o) => o.t).join(' / ')}`);
  ok(opts.find((o) => o.s)?.v === String(def._id), '처음엔 대표 계정이 골라져 있음');
  if (other) {
    await p.select('#obAcc', String(other._id));
    ok(await waitFor(() => /대표 계정이 아닌 주소로 나갑니다/.test(document.querySelector('.outreach-acc-hint')?.textContent || '')), '다른 계정을 고르면 "대표 계정이 아닌 주소" 안내');
    ok(await p.$eval('#obAcc', (s) => s.value) === String(other._id), '다시 그려도 고른 계정이 유지됨');
    await p.evaluate(() => document.getElementById('outboxSendBtn')?.click());
    await waitFor(() => false, 1500);
    const camp = captured.find((c) => /campaign/.test(c.url));
    ok(camp && JSON.parse(camp.body).mailAccountId === String(other._id), `발송 요청에 고른 계정이 실림 (요청은 가로채서 막음)`);
  }

  console.log('── ② 파트너십 확정');
  const now = new Date().toISOString();
  await L.updateOne({ leadId: TEMP }, { $set: { leadId: TEMP, Company: 'ZZ Partner Remove Test', Country: 'South Korea', Email: 'fe@yogico.kr', stage: 'partner', stageChangedAt: now, deleted: false, importBatch: 'test-manual', WebsiteContact: 'https://yogico.kr' }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  await p.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-partner"]').click());
  ok(await waitFor(() => [...document.querySelectorAll('.rel-card')].some((c) => c.dataset.leadId === 'test-partner-remove-0914'), 20000), '임시 파트너가 목록에 보임');
  await p.evaluate(() => [...document.querySelectorAll('.rel-card')].find((c) => c.dataset.leadId === 'test-partner-remove-0914').click());
  ok(await waitFor(() => !!document.querySelector('.rel-remove')), '상세에 [🗑 파트너십에서 삭제] 버튼 있음');
  ok(await p.evaluate(() => ![...document.querySelectorAll('button')].some((x) => /대화 진행 중으로/.test(x.textContent))), '[🤝 대화 진행 중으로] 버튼은 없음');
  await p.evaluate(() => document.querySelector('.rel-remove').click());
  ok(await waitFor(() => !!document.querySelector('.rel-card') || /없/.test(document.body.innerText), 15000) && await waitFor(() => ![...document.querySelectorAll('.rel-card')].some((c) => c.dataset.leadId === 'test-partner-remove-0914')), '삭제하면 목록으로 돌아가고 그 업체는 안 보임');
  await waitFor(() => false, 1500);
  const gone = await L.findOne({ leadId: TEMP });
  console.log('      DB:', JSON.stringify({ deleted: gone?.deleted, deletedReason: gone?.deletedReason, deletedFromStage: gone?.deletedFromStage, stage: gone?.stage }));
  ok(gone && gone.deleted === true && gone.deletedReason === '파트너십에서 삭제' && gone.deletedFromStage === 'partner' && gone.stage === 'partner', 'DB 에는 남아 있고 deleted 표시만 됨 (되살리기 가능)');
} finally {
  const r = await L.deleteMany({ leadId: TEMP });
  console.log(`      (임시 파트너 ${r.deletedCount}건 지움)`);
  ok(errs.length === 0, `JS 오류 없음 ${errs.join(' | ').slice(0, 200)}`);
  await b.close();
  await mongoose.disconnect();
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
