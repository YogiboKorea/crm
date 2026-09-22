/**
 * **AI 분석 결과가 화면에 실제로 보이는지** 확인한다 (2026-09-21, 대표님 요청 "프론트단에 보이게").
 *
 * DB 에 넣었다고 화면에 뜨는 것은 아니다 — 목록 배지·메일 상세·회신 필요·기한 관리가
 * 모두 같은 값을 읽고 있는지 눈으로 확인한다. 메일은 보내지 않는다.
 *
 * 사용: node scripts/check-analysis-visible.mjs
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

// 3000 번에는 다른 프로젝트가 떠 있을 수 있다 (실제로 '우리 가족 보이스 동화' 가 떠 있었다) — CRM_BASE 로 바꿀 수 있게
const B = process.env.CRM_BASE || 'http://localhost:3000';
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (u = 'david') => new SignJWT({ user: u, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('2h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const waitFor = async (p, fn, ms = 20000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); }
  return false;
};

// ── DB 쪽 기대값 (화면 숫자와 같은 조건으로 센다) ──
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const A = db.collection('mailaccounts');
const I = db.collection('inboundmails');
const NOISE = ['ad', 'system', 'newsletter'];
const ids = (await A.find({}, { projection: { _id: 1 } }).toArray()).map((a) => String(a._id));
const davidIds = (await A.find({ smtpUser: /^david@yogico\.kr$/i }, { projection: { _id: 1 } }).toArray()).map((a) => String(a._id));
const since60 = new Date(Date.now() - 60 * 86400000);
const since14 = new Date(Date.now() - 14 * 86400000);
const acc = { accountId: { $in: davidIds } };

const expected = {
  inbox: await I.countDocuments({ ...acc, trashedAt: null, direction: 'in', date: { $gte: since60 }, classification: { $nin: NOISE } }),
  needsReply: await I.countDocuments({ ...acc, trashedAt: null, direction: 'in', date: { $gte: since14 }, classification: { $nin: NOISE }, 'analysis.needsReply': true, status: { $in: ['new', 'reviewing'] } }),
  deadlines: await I.countDocuments({ ...acc, trashedAt: null, direction: 'in', date: { $gte: since60 }, classification: { $nin: NOISE }, 'analysis.deadline': { $ne: null }, status: { $nin: ['replied', 'archived', 'ignored'] } }),
};
// 방금 분석한 것 중 화면에서 열어볼 한 통 (AI 분석이 붙어 있고 요약이 있는 것)
const sample = await I.findOne(
  { ...acc, direction: 'in', 'analysis.method': 'ai', 'analysis.summary': { $nin: ['', null] }, trashedAt: null, date: { $gte: since14 } },
  { sort: { date: -1 }, projection: { subject: 1, 'analysis.summary': 1, 'analysis.topic': 1, 'analysis.suggestedAction': 1, date: 1 } },
);
const total = await I.countDocuments({ accountId: { $in: ids }, direction: { $ne: 'out' }, trashedAt: null, classification: { $nin: ['ad', 'system'] }, date: { $gte: new Date(Date.now() - 30 * 86400000) } });
const done = await I.countDocuments({ accountId: { $in: ids }, direction: { $ne: 'out' }, trashedAt: null, classification: { $nin: ['ad', 'system'] }, date: { $gte: new Date(Date.now() - 30 * 86400000) }, 'analysis.method': 'ai' });
await mongoose.disconnect();

console.log(`최근 30일 받은 메일 ${total}통 · AI 분석 완료 ${done}통 · 남음 ${total - done}`);
console.log(`DB 기준 화면 숫자 — 받은 메일함 ${expected.inbox} · 회신 필요 ${expected.needsReply} · 기한 관리 ${expected.deadlines}`);
console.log(`상세로 열어볼 메일: ${String(sample?.subject || '').slice(0, 44)}`);

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const errs = [];
try {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => (r.method() === 'POST' && /\/api\/mail\/(send|schedule|campaign|reply|compose|test-send|backfill|ingest)/.test(r.url().split('?')[0])) ? r.abort() : r.continue());
  await p.setViewport({ width: 1500, height: 1000 });
  await p.setCookie({ name: 'admin_session', value: await token('david'), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(4500);

  console.log('\n── 사이드바 숫자');
  const badges = await p.evaluate(() => ({
    inbox: document.querySelector('[data-nav-badge="inboxUnread"]')?.textContent?.trim(),
    needsReply: document.querySelector('[data-nav-badge="inboxNeedsReply"]')?.textContent?.trim(),
    deadlines: document.querySelector('[data-nav-badge="inboxDeadlines"]')?.textContent?.trim(),
  }));
  const num = (s) => Number(String(s || '').replace(/,/g, ''));
  ok(num(badges.inbox) === expected.inbox, `받은 메일함 ${badges.inbox} (DB ${expected.inbox})`);
  ok(num(badges.needsReply) === expected.needsReply, `회신 필요 ${badges.needsReply} (DB ${expected.needsReply})`);
  ok(num(badges.deadlines) === expected.deadlines, `기한 관리 ${badges.deadlines} (DB ${expected.deadlines})`);

  console.log('\n── 받은 메일함 목록에 분석 결과가 붙는가');
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-inbox"]')?.click());
  ok(await waitFor(p, () => document.querySelectorAll('.table-wrap tbody tr').length > 0), '목록이 뜸');
  await w(1500);

  // 분석이 붙은 메일을 제목으로 찾아 연다
  const subj = String(sample?.subject || '').slice(0, 20);
  const opened = await p.evaluate((s) => {
    const rows = [...document.querySelectorAll('.table-wrap tbody tr')];
    const hit = rows.find((r) => r.innerText.includes(s));
    if (hit) { hit.click(); return true; }
    rows[0]?.click();
    return false;
  }, subj);
  console.log(`  ${opened ? '방금 분석한 메일을 찾아 열었습니다' : '(목록 첫 줄을 열었습니다 — 제목으로 못 찾음)'}`);
  ok(await waitFor(p, () => /AI 분석 완료|아직 분석하지 않은|내가 보낸 메일/.test(document.body.innerText)), '메일 상세가 열림');
  await w(1800);

  const detail = await p.evaluate(() => {
    const t = document.body.innerText;
    return {
      hasDone: /✅ AI 분석 완료/.test(t),
      hasPending: /아직 분석하지 않은 메일입니다/.test(t),
      hasAction: /다음 할 일/.test(t),
      hasTrans: /한글 번역 전문/.test(t),
      text: t,
    };
  });
  ok(detail.hasDone, 'AI 분석 완료 표시가 보임');
  ok(!detail.hasPending, '"아직 분석하지 않은 메일입니다" 가 안 뜸');
  if (sample?.analysis?.summary) {
    const head = String(sample.analysis.summary).slice(0, 20);
    ok(detail.text.includes(head), `요약이 화면에 그대로 보임 — "${head}…"`);
  }
  if (sample?.analysis?.suggestedAction) ok(detail.hasAction, `[다음 할 일] 이 보임 — ${String(sample.analysis.suggestedAction).slice(0, 34)}`);
  ok(detail.hasTrans, '한글 번역 전문을 펼쳐 볼 수 있음');

  console.log('\n── 회신 필요 · 기한 관리 화면');
  await p.evaluate(() => document.getElementById('mailDetailClose')?.click() || document.querySelector('.modal-close')?.click());
  await w(900);
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-inbox-needsreply"]')?.click());
  await w(2600);
  const nr = await p.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  ok(nr > 0, `회신 필요 화면에 ${nr}줄`);
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-deadlines"]')?.click());
  await w(2600);
  const dl = await p.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  ok(dl > 0, `기한 관리 화면에 ${dl}줄`);

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 분석 결과가 화면에 그대로 보입니다');
process.exit(fail ? 1 : 0);
