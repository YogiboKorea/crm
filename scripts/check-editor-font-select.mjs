/**
 * 답장·메일 양식 편집기의 글꼴·크기 선택칸이 제대로 동작하는지 확인한다.
 *
 *   ① 선택칸을 눌렀을 때 mousedown 기본 동작이 막히지 않는가
 *      (막히면 브라우저가 목록을 펼치지 못한다 — 실제 증상 "안 내려와")
 *   ② 글자를 고른 뒤 크기·글꼴을 바꾸면 **그 글자에만** 걸리는가
 *   ③ 글자를 고르지 않고 글꼴을 바꾸면 본문 전체에 걸리고,
 *      [보내기] 할 때 그 글꼴이 **메일 본문에 실리는가**
 *
 * ⚠️ ③ 은 실제로 [보내기] 를 누른다. 발송이 켜져 있으므로 브라우저 안에서
 *    /api/mail/reply 요청을 **서버로 나가기 전에 가로채 중단(abort)** 하고
 *    담긴 본문만 읽는다. 가로채기가 걸리지 않으면 보내기를 누르지 않는다.
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
await mongoose.connect(process.env.MONGODB_URI);
const mail = await mongoose.connection.collection('inboundmails').findOne(
  { trashedAt: null, direction: 'in', classification: 'b2b' }, { sort: { date: -1 }, projection: { subject: 1 } });
await mongoose.disconnect();

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', async (d) => { errors.push('알림창: ' + d.message()); await d.dismiss(); });
await page.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });

// ── 발송 요청 차단 (③ 전용) ──
let captured = null;
let leaked = false;
await page.setRequestInterception(true);
page.on('request', (req) => {
  const u = req.url();
  if (/\/api\/mail\/(reply|send|schedule|campaign)/.test(u) && req.method() !== 'GET') {
    captured = { url: u, body: req.postData() };
    req.abort('blockedbyclient');   // 서버로 나가지 않는다
    return;
  }
  req.continue();
});
page.on('requestfinished', (req) => {
  if (/\/api\/mail\/(reply|send|schedule|campaign)/.test(req.url()) && req.method() !== 'GET') leaked = true;
});

let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.setViewport({ width: 1440, height: 950 });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
await wait(1200);

// mousedown 이 막혔는지 기록 — 문서 버블 단계는 요소 자신의 리스너보다 뒤에 돈다
await page.evaluate(() => {
  window.__mdPrevented = {};
  document.addEventListener('mousedown', (e) => {
    if (e.target && e.target.id) window.__mdPrevented[e.target.id] = e.defaultPrevented;
  });
});

console.log(`\n── 답장 편집기 — "${mail.subject.slice(0, 40)}"`);
await page.evaluate((id) => openMailDetailModal(id), String(mail._id));
await page.waitForSelector('#convReplyBody', { timeout: 15000 });
await wait(600);

// ① 선택칸 클릭 시 기본 동작
for (const id of ['convFontFamily', 'convFontSize']) {
  await page.click('#' + id);
  await wait(150);
  await page.keyboard.press('Escape').catch(() => {});
  const prevented = await page.evaluate((i) => window.__mdPrevented[i], id);
  ok(prevented === false, `#${id} 를 눌렀을 때 기본 동작이 막히지 않음 (목록이 펼쳐질 수 있음) — defaultPrevented=${prevented}`);
}
// 모달이 Esc 로 닫혔을 수 있으니 다시 연다
if (!(await page.$('#convReplyBody'))) {
  await page.evaluate((id) => openMailDetailModal(id), String(mail._id));
  await page.waitForSelector('#convReplyBody');
  await wait(500);
}

// ② 글자 고르고 크기 바꾸기 — 사람이 하는 순서대로: 입력 → 드래그 선택 → 선택칸 누르기 → 값 고르기
await page.click('#convReplyBody');
await page.keyboard.type('Hello partner world');
await page.evaluate(() => {
  const el = document.getElementById('convReplyBody');
  const t = el.firstChild;              // 텍스트 노드
  const r = document.createRange();
  r.setStart(t, 6); r.setEnd(t, 13);    // "partner"
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
await page.click('#convFontSize');        // 여기서 포커스가 선택칸으로 옮겨 가 본문 선택이 풀린다
await page.select('#convFontSize', '20');
await wait(200);
const html2 = await page.$eval('#convReplyBody', (e) => e.innerHTML);
ok(/<span[^>]*font-size:\s*20px[^>]*>partner<\/span>/.test(html2), `고른 글자에만 20px 적용: ${html2.slice(0, 120)}`);
ok(!errors.some((e) => /먼저/.test(e)), '"먼저 글자를 선택하세요" 경고가 뜨지 않음');

// 글꼴도 같은 방식
await page.evaluate(() => {
  const el = document.getElementById('convReplyBody');
  const span = el.querySelector('span');
  const r = document.createRange(); r.selectNodeContents(span);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
const fontValue = await page.$eval('#convFontFamily', (sel) => sel.options[1].value);
await page.click('#convFontFamily');
await page.select('#convFontFamily', fontValue);
await wait(200);
const html3 = await page.$eval('#convReplyBody', (e) => e.innerHTML);
ok(/font-family/.test(html3), `고른 글자에 글꼴 적용: ${html3.slice(0, 140)}`);

// ③ 아무것도 안 고르고 글꼴 → 본문 전체, 그리고 보내기 본문에 실리는가
await page.evaluate(() => {
  const el = document.getElementById('convReplyBody');
  el.innerHTML = '전체 글꼴 시험';
  const s = window.getSelection(); s.removeAllRanges();
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); s.addRange(r);
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
const font2 = await page.$eval('#convFontFamily', (sel) => sel.options[2].value);
await page.click('#convFontFamily');
await page.select('#convFontFamily', font2);
await page.click('#convFontSize');
await page.select('#convFontSize', '16');
await wait(200);
const bodyStyle = await page.$eval('#convReplyBody', (e) => ({ ff: e.style.fontFamily, fs: e.style.fontSize }));
ok(!!bodyStyle.ff && bodyStyle.fs === '16px', `선택 없이 고르면 본문 전체에 적용: ${bodyStyle.ff.slice(0, 40)} / ${bodyStyle.fs}`);

// 가로채기가 확실히 걸려 있는지 먼저 확인한 뒤에만 보내기를 누른다
const interceptOn = await page.evaluate(async () => {
  try { await fetch('/api/mail/reply', { method: 'POST', body: '{"probe":true}' }); return false; } catch { return true; }
});
ok(interceptOn && captured && JSON.parse(captured.body).probe === true, '발송 요청 가로채기 동작 확인 (서버로 안 나감)');
captured = null;

if (interceptOn) {
  await page.click('#convReplySend');
  await wait(1500);
  ok(!!captured, '보내기 요청을 서버 도착 전에 차단함');
  if (captured) {
    const sent = JSON.parse(captured.body).body || '';
    ok(/^<div style="[^"]*font-family:[^"]*font-size:\s*16px/.test(sent), `보내는 본문에 글꼴·크기가 실림: ${sent.slice(0, 150)}`);
  }
} else {
  console.log('  (가로채기가 확인되지 않아 보내기를 누르지 않음)');
}
ok(!leaked, '발송 요청이 서버에 도달하지 않음');

await page.evaluate(() => closeMailDetailModal());
await wait(300);

// ── 메일 양식 편집기 ──
console.log('\n── 메일 양식 편집기');
await page.evaluate(() => document.querySelector('.nav-item[data-view="tool-b2b-email"]').click());
await wait(2000);
// 편집기가 목록 뒤에 있으면 첫 양식을 연다
if (!(await page.$('#tplFontSize'))) {
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button,[data-template-id],.template-item')].find((x) => /수정|편집/.test(x.textContent || ''));
    if (b) { b.click(); return true; } return false;
  });
  await wait(1500);
  if (!opened) console.log('  (양식 편집 단추를 못 찾음)');
}
if (await page.$('#tplFontSize')) {
  for (const id of ['tplFontFamily', 'tplFontSize']) {
    await page.click('#' + id);
    await wait(150);
    const prevented = await page.evaluate((i) => window.__mdPrevented[i], id);
    ok(prevented === false, `#${id} 기본 동작이 막히지 않음 — defaultPrevented=${prevented}`);
  }
  const hasRich = await page.$('#templateBodyRich');
  if (hasRich) {
    const before = await page.$eval('#templateBodyRich', (e) => e.innerHTML);
    await page.evaluate(() => {
      const el = document.getElementById('templateBodyRich');
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let t; while ((t = walker.nextNode()) && t.textContent.trim().length < 4);
      if (!t) return;
      const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, Math.min(4, t.textContent.length));
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await page.click('#tplFontSize');
    await page.select('#tplFontSize', '18');
    await wait(200);
    const after = await page.$eval('#templateBodyRich', (e) => e.innerHTML);
    ok(after !== before && /font-size:\s*18px/.test(after), '양식 본문에서 고른 글자에 18px 적용 (저장은 누르지 않음)');
  }
} else {
  console.log('  (양식 편집기 선택칸이 화면에 없어 건너뜀)');
}

const realErrors = errors.filter((e) => !/알림창/.test(e));
ok(realErrors.length === 0, `JS 오류 없음${realErrors.length ? ' — ' + realErrors.join(' | ').slice(0, 200) : ''}`);
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
await browser.close();
process.exit(fail ? 1 : 0);
