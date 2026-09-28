/**
 * 받은 메일함에서 **바로 답장**할 때 "리드를 찾을 수 없음" 이 뜨지 않는지 확인 (2026-09-28 대표님 신고).
 *
 * 무슨 일이었나: 메일함에서 연 메일에는 엮인 업체가 없다(leadId 없음). 그런데 보내기 성공 뒤
 * 업체 대화창을 여는 코드가 그대로 돌아 `?leadId=null` 로 조회했고, 메일은 이미 나갔는데
 * 화면에는 붉은 글씨 "리드를 찾을 수 없음" 만 남았다. 보낸 사람은 실패로 읽는다.
 *
 * 확인하는 것:
 *   1) 보내기 성공 뒤 leadId 없이 대화를 조회하지 않는다
 *   2) "리드를 찾을 수 없음" 같은 오류 문구가 뜨지 않는다
 *   3) 보냈다는 표시가 뜨고, 메일 창이 닫힌다
 *
 * **실제 발송은 하지 않는다** — /api/mail/reply POST 를 가로채 성공으로 답한다.
 * 사용: CRM_BASE=http://localhost:3100 node scripts/check-inbox-reply.mjs
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = process.env.CRM_BASE || 'http://localhost:3000';   // 3000 번에 다른 프로젝트가 떠 있을 수 있다
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (user) => new SignJWT({ user, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const waitFor = async (p, fn, arg, ms = 20000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await w(250); }
  return false;
};

// 업체와 엮이지 않은 받은 메일 하나를 고른다 — 신고된 상황 그대로
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const acc = await db.collection('mailaccounts').findOne({ owner: 'david', smtpUser: /^david@yogico\.kr$/i, mergedInto: { $in: [null, ''] } });
const mail = await db.collection('inboundmails').findOne(
  { accountId: String(acc._id), direction: 'in', leadId: { $in: ['', null] }, trashedAt: null },
  { projection: { subject: 1, 'from.address': 1 }, sort: { date: -1 } },
);
await mongoose.disconnect();
console.log(`검사에 쓸 메일: ${String(mail.subject).slice(0, 45)} (${mail.from?.address}) · 엮인 업체 없음`);

const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const errs = [];
const threadCalls = [];
try {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    if (/\/api\/mail\/thread/.test(r.url())) threadCalls.push(r.url());
    // 진짜로 메일을 보내지 않는다 — 보내진 것처럼 답한다
    if (/\/api\/mail\/reply$/.test(r.url().split('?')[0]) && r.method() === 'POST') {
      return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, dryRun: true }) });
    }
    if (/\/api\/mail\/(send|schedule|campaign|test-send|compose)/.test(r.url()) && r.method() !== 'GET') return r.abort();
    r.continue();
  });
  await p.setViewport({ width: 1500, height: 1000 });
  await p.setCookie({ name: 'admin_session', value: await token('david'), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(3000);

  // 받은 메일함에서 그 메일을 연다
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-inbox"]')?.click());
  ok(await waitFor(p, () => document.querySelectorAll('[data-mail-id]').length > 0), '받은 메일함 목록이 뜸');
  const opened = await p.evaluate((subj) => {
    const row = [...document.querySelectorAll('[data-mail-id]')]
      .find((el) => el.textContent.includes(subj.slice(0, 20)));
    (row || document.querySelector('[data-mail-id]'))?.click();
    return true;
  }, String(mail.subject || ''));
  ok(opened && await waitFor(p, () => !!document.getElementById('mailDetailRoot')), '메일 상세 창이 열림');
  ok(await waitFor(p, () => !!document.getElementById('convReplyBody')), '답장 상자가 있음');

  // 답장을 쓰고 보낸다
  const n0 = threadCalls.length;
  await p.evaluate(() => {
    const body = document.getElementById('convReplyBody');
    body.innerHTML = '검사용 답장입니다 (실제로 나가지 않습니다)';
    body.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('convReplySend').click();
  });
  // 보냈다는 표시는 창이 닫히기 전에 잠깐 뜬다 — 뜨는 순간을 잡아 둔다
  await waitFor(p, () => {
    const el = document.getElementById('convReplyMsg');
    if (el && /보냈습니다|시뮬레이션/.test(el.innerText)) { window.__sentMsg = el.innerText.trim(); return true; }
    return false;
  }, undefined, 5000);
  const sentMsg = await p.evaluate(() => window.__sentMsg || '');
  await w(2000);
  const after = await p.evaluate(() => ({ bodyText: document.body.innerText }));
  ok(/보냈습니다|시뮬레이션/.test(sentMsg), `보냈다는 표시가 뜸 — "${sentMsg}"`);
  const bad = threadCalls.slice(n0).filter((u) => /leadId=(null|undefined|)$/.test(u));
  ok(bad.length === 0, `leadId 없이 대화를 조회하지 않음 (조회 ${threadCalls.length - n0}건${bad.length ? ': ' + bad.join(', ') : ''})`);
  ok(!/리드를 찾을 수 없/.test(after.bodyText), '"리드를 찾을 수 없음" 이 뜨지 않음');

  // 창이 닫히고 목록으로 돌아온다
  ok(await waitFor(p, () => !document.getElementById('mailDetailRoot'), undefined, 6000), '보낸 뒤 메일 창이 닫힘');
  ok(await waitFor(p, () => document.querySelectorAll('[data-mail-id]').length > 0), '목록이 다시 보임');

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
