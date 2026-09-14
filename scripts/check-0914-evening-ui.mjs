/**
 * 2026-09-14 저녁 반영분 화면 확인 (실제 발송 없음 — 발송·예약·가져오기 요청은 가로챈다).
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
const outMail = await mongoose.connection.db.collection('inboundmails').findOne({ direction: 'out', accountId: '6aa0b5a92a0d71fb242b35c2', 'raw.html': { $exists: true, $ne: '' } }, { projection: { _id: 1, subject: 1 } });
await mongoose.disconnect();

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const errs = [];
const dialogs = [];
async function page() {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { dialogs.push(d.message().slice(0, 80)); await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => (/\/api\/mail\/(send|schedule|campaign|reply|test-send|backfill|ingest)/.test(r.url()) && r.method() !== 'GET') ? r.abort() : r.continue());
  await p.setViewport({ width: 1440, height: 1000 });
  return p;
}
const waitFor = async (p, fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); } return false; };

try {
  // ── david 로 실제 로그인 화면에서 로그인
  console.log('── david 로그인');
  const p = await page();
  await p.goto(`${B}/login`, { waitUntil: 'networkidle2' });
  const inputs = await p.$$('input');
  await inputs[0].type('david');
  await p.type('input[type="password"]', 'yogibo');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null), p.keyboard.press('Enter')]);
  ok(!p.url().includes('/login'), `david / yogibo 로 로그인됨 (${p.url()})`);
  await w(1500);
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-crm-account"]')?.click());
  ok(await waitFor(p, () => /지금 로그인한 아이디/.test(document.body.innerText) && /david/.test(document.getElementById('content')?.innerText || '')), '👤 CRM 계정 관리 — 로그인한 아이디 david 표시');
  ok(await p.evaluate(() => !!document.getElementById('crmPwForm') && !!document.getElementById('crmIdForm')), '비밀번호 변경 · 아이디 변경 칸 있음');
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-mail-accounts"]')?.click());
  await w(2500);
  ok(await p.evaluate(() => !/대표님/.test(document.getElementById('content')?.innerText || '')), 'david 의 메일 계정 관리에는 관리자 계정(대표님 david@)이 안 보임');
  await p.close();

  // ── 관리자 화면
  console.log('── admin');
  const q = await page();
  const jwt = await new SignJWT({ user: 'admin', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
  await q.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });
  await q.goto(`${B}/`, { waitUntil: 'networkidle2' });
  await w(2500);
  const badge = await q.evaluate(() => document.querySelector('[data-nav-badge="verified"]')?.textContent);
  await q.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-verified"]')?.click());
  await waitFor(q, () => !!document.querySelector('.verify-hero'), 20000);
  const hero = await q.evaluate(() => document.querySelector('.verify-hero')?.innerText.replace(/\s+/g, ' ').slice(0, 200));
  const heroNum = (hero || '').match(/([\d,]+)\s*2차 검토 필요/)?.[1];
  ok(badge && heroNum && badge.replace(/,/g, '') === heroNum.replace(/,/g, ''), `사이드바 배지(${badge}) = 2차 검토 카드 숫자(${heroNum})`);
  // 빨리 다른 화면으로 옮겨도 앞 화면 조각이 남지 않음
  await q.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-verified"]')?.click());
  await q.evaluate(() => document.querySelector('.nav-item[data-view="tool-b2b-email"]')?.click());
  await w(4000);
  ok(await q.evaluate(() => !document.querySelector('.verify-hero') && !/2차 검토 시작/.test(document.body.innerText)), '검증 완료 → 메일 양식 빠르게 이동해도 검토 카드가 안 겹침');

  // 발송관리 — 목록 위 · 10곳씩 · 테스트 메일 맨 아래
  await q.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-contacted"]')?.click());
  ok(await waitFor(q, () => !!document.getElementById('obTestBox')), '발송관리 열림');
  const layout = await q.evaluate(() => {
    const table = document.querySelector('.outbox-lead-open')?.closest('table');
    const compose = document.getElementById('obPvSubject');
    const test = document.getElementById('obTestBox');
    const send = document.getElementById('outboxSendBtn');
    const y = (el) => el ? el.getBoundingClientRect().top + window.scrollY : -1;
    return { rows: document.querySelectorAll('tr.outbox-lead-open').length, tableY: y(table), composeY: y(compose), testY: y(test), sendY: y(send), text: test?.innerText.replace(/\s+/g, ' ').slice(0, 90) };
  });
  ok(layout.tableY >= 0 && layout.tableY < layout.composeY, `업체 목록이 양식보다 위 (${layout.tableY} < ${layout.composeY}) · ${layout.rows}곳`);
  ok(layout.testY > layout.sendY, `테스트 메일은 [보내기] 버튼보다 아래 — "${layout.text}"`);
  ok(layout.rows <= 10, `한 쪽에 10곳 이하 (${layout.rows})`);

  // 보낸 메일 상세 — 보낸 원문 + 이어서 보내기
  if (outMail) {
    await q.evaluate((id) => openMailDetailModal(id), String(outMail._id));
    ok(await waitFor(q, () => /보낸 원문 그대로 보기/.test(document.body.innerText)), `보낸 메일 상세에 "보낸 원문 그대로 보기" (${outMail.subject.slice(0, 30)})`);
    ok(await q.evaluate(() => /이어서 보내기/.test(document.body.innerText) && !/보낸메일함에서 함께 가져온 기록이라 여기서 답장을 쓰지 않습니다/.test(document.body.innerText)), '안내문 대신 받는 사람에게 이어서 보내기 칸');
    await q.keyboard.press('Escape');
    await w(500);
  }

  // 받은 메일함 — 보낸 메일함 · 2달 가져오기 버튼
  await q.evaluate(() => document.querySelector('.nav-item[data-view="tool-inbox"]')?.click());
  ok(await waitFor(q, () => !!document.getElementById('inboxBackfillBtn'), 20000), '받은 메일함에 [📥 2달 전체] 버튼');
  ok(await q.evaluate(() => !!document.querySelector('[data-group="__sent__"]')), '📤 보낸 메일함 다시 보임');

  // 메일 계정 — 2달 가져오기 버튼 · 서명 미리보기
  await q.evaluate(() => document.querySelector('.nav-item[data-view="tool-mail-accounts"]')?.click());
  ok(await waitFor(q, () => document.querySelectorAll('.acc-backfill-btn').length > 0), '메일 계정 카드에 [📥 2달 가져오기]');
  await q.evaluate(() => document.querySelector('.acc-edit-btn')?.click());
  ok(await waitFor(q, () => !!document.getElementById('macSigPreview')), '계정 수정 창에 서명 미리보기');
  await q.$eval('#macFromName', (x) => { x.value = ''; });
  await q.type('#macFromName', 'David I Daejin Park');
  await q.$eval('#macSenderTitle', (x) => { x.value = ''; });
  await q.type('#macSenderTitle', 'CEO');
  const sig = await q.$eval('#macSigPreview', (x) => x.innerText);
  console.log('      서명:', JSON.stringify(sig));
  ok(/^David I Daejin Park, CEO/.test(sig.trim()), '서명 첫 줄 "이름, 직함"');
  await q.close();
} finally {
  ok(errs.length === 0, `JS 오류 없음 ${errs.join(' | ').slice(0, 200)}`);
  await b.close();
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
