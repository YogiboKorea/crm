/**
 * 올린 업체 화면 — 한 줄에서 바로 옮기기 · 묶음 이동 단계 고르기 확인.
 * 옮긴 업체는 확인이 끝나면 원래 단계로 되돌린다.
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const B = 'http://localhost:3000';
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));

await mongoose.connect(process.env.MONGODB_URI);
const L = mongoose.connection.db.collection('leads');
const jwt = await new SignJWT({ user: 'admin', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('dialog', async (d) => { await d.accept(); });
await p.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });
await p.setViewport({ width: 1500, height: 1000 });
const waitFor = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); } return false; };
let moved = null;

try {
  await p.goto(B + '/', { waitUntil: 'networkidle2' });
  await w(1200);
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-legacy"]')?.click());
  ok(await waitFor(() => document.querySelectorAll('.legacy-batch').length > 0, 20000), '올린 파일 목록 열림');
  await p.evaluate(() => document.querySelectorAll('.legacy-batch')[0].click());
  ok(await waitFor(() => document.querySelectorAll('tr.legacy-row').length > 0, 20000), '파일 안 업체 목록 열림');

  const targets = await p.$$eval('#lgMoveTarget option', (o) => o.map((x) => x.textContent.trim()));
  ok(targets.length >= 6 && targets.some((t) => /발송 관리/.test(t)) && targets.some((t) => /대화 진행 중/.test(t)), `묶음 이동 단계 고르기 (${targets.join(' / ')})`);
  const rowOpts = await p.$$eval('tr.legacy-row .lg-row-move option', (o) => o.map((x) => x.textContent.trim()));
  ok(rowOpts.length > 6, `줄마다 [→ 옮기기…] 있음 (${rowOpts.slice(0, 4).join(' / ')} …)`);

  // 한 곳을 대화 진행 중으로 옮겨 본다
  // 이미 대화 진행 중인 업체를 고르면 바뀐 게 없어 확인이 안 된다 — 다른 단계인 줄을 고른다
  const leads = await p.$$eval('tr.legacy-row .lg-row-move', (xs) => xs.map((x) => x.dataset.lead));
  const rows = await L.find({ leadId: { $in: leads }, stage: { $ne: 'negotiating' } }, { projection: { leadId: 1 } }).limit(1).toArray();
  const lead = rows[0]?.leadId || leads[0];
  const before = await L.findOne({ leadId: lead }, { projection: { stage: 1, Company: 1, readyForOutreach: 1 } });
  moved = { lead, stage: before.stage, ready: before.readyForOutreach };
  await p.evaluate((id) => {
    const sel = document.querySelector(`.lg-row-move[data-lead="${id}"]`);
    sel.value = 'negotiating';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, lead);
  await w(2500);
  let after = await L.findOne({ leadId: lead }, { projection: { stage: 1, stageChangedAt: 1, restoredFrom: 1 } });
  for (let i = 0; i < 10 && after.stage !== 'negotiating'; i++) { await w(700); after = await L.findOne({ leadId: lead }, { projection: { stage: 1, stageChangedAt: 1, restoredFrom: 1 } }); }
  console.log('      DB:', JSON.stringify({ lead, before: before.stage, after: after.stage, restoredFrom: after.restoredFrom }));
  ok(after.stage === 'negotiating' && after.restoredFrom === before.stage, `"${String(before.Company).slice(0, 24)}" → 대화 진행 중 (되돌리기용 이전 단계 ${after.restoredFrom} 기록)`);
  ok(await waitFor(() => document.querySelectorAll('tr.legacy-row').length > 0, 10000), '이동 뒤 목록이 다시 그려짐');
} finally {
  if (moved) {
    await L.updateOne({ leadId: moved.lead }, { $set: { stage: moved.stage, readyForOutreach: moved.ready ?? false }, $unset: { restoredFrom: '', restoredAt: '' } });
    console.log(`      (확인용으로 옮긴 업체를 ${moved.stage} 로 되돌림)`);
  }
  ok(errs.length === 0, `JS 오류 없음 ${errs.join(' | ').slice(0, 160)}`);
  await b.close();
  await mongoose.disconnect();
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
