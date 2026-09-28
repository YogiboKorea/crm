/**
 * 화면을 띄워 둔 동안에도 새 메일을 가져오는지 확인 (2026-09-22 "업데이트가 안 된다").
 *
 *   1) 화면을 열면 /api/mail/sync-on-login 을 한 번 부른다 (예전부터)
 *   2) 다른 탭에 갔다가 돌아오면 다시 부른다 (새로 추가)
 *   3) 5분 주기 타이머에서도 부른다 — 기다리지 않고 타이머를 앞당겨 확인
 *   4) 앞의 수집이 아직 도는 중이면 겹쳐 부르지 않는다
 *
 * 실제 수집은 서버 쿨다운(10분) 때문에 대부분 건너뛴다 — 메일 서버에 부담을 주지 않는다.
 * 사용: CRM_BASE=http://localhost:3100 node scripts/check-mail-autosync.mjs
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = process.env.CRM_BASE || 'http://localhost:3000';   // 3000 번에 다른 프로젝트가 떠 있을 수 있다
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const token = () => new SignJWT({ user: 'david', role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));

const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const errs = [];
try {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  // 5분 타이머를 기다릴 수 없으니, 5분짜리 setInterval 을 잡아 두었다가 직접 불러 본다
  await p.evaluateOnNewDocument(() => {
    const orig = window.setInterval;
    window.__intervals = [];
    window.setInterval = (fn, ms, ...a) => { const id = orig(fn, ms, ...a); window.__intervals.push({ fn, ms }); return id; };
  });
  const calls = [];
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    if (/\/api\/mail\/sync-on-login/.test(r.url())) {
      calls.push(Date.now());
      // 실제 IMAP 에 붙지 않게, 오래 걸리는 수집처럼 잠깐 붙잡았다가 "쿨다운" 으로 답한다
      setTimeout(() => r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, ran: false, skipped: 'cooldown' }) }), 1500);
      return;
    }
    r.continue();
  });
  await p.setViewport({ width: 1400, height: 900 });
  await p.setCookie({ name: 'admin_session', value: await token(), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(2500);
  ok(calls.length === 1, `화면을 열 때 새 메일 가져오기 1번 (${calls.length}번)`);

  // 다른 탭에 갔다가 돌아옴
  const n0 = calls.length;
  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await w(2500);
  ok(calls.length === n0 + 1, `창이 다시 보이면 새 메일 가져오기 (${calls.length - n0}번)`);

  // 5분 타이머
  const n1 = calls.length;
  const hasTimer = await p.evaluate(() => {
    const t = window.__intervals.find((x) => x.ms === 5 * 60 * 1000 && /syncMailOnLogin/.test(String(x.fn)));
    if (!t) return false;
    t.fn();
    return true;
  });
  ok(hasTimer, '5분 주기 타이머에 새 메일 가져오기가 들어 있음');
  await w(2500);
  ok(calls.length === n1 + 1, `5분 타이머가 돌면 새 메일 가져오기 (${calls.length - n1}번)`);

  // 앞의 것이 도는 중이면 겹치지 않는다
  const n2 = calls.length;
  await p.evaluate(() => { syncMailOnLogin(); syncMailOnLogin(); syncMailOnLogin(); });
  await w(2500);
  ok(calls.length === n2 + 1, `연달아 불러도 도는 중에는 겹쳐 붙지 않음 (3번 불러 ${calls.length - n2}번 나감)`);

  // 창이 가려져 있을 때 타이머는 수집하지 않는다
  const n3 = calls.length;
  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.__intervals.find((x) => x.ms === 5 * 60 * 1000 && /syncMailOnLogin/.test(String(x.fn))).fn();
  });
  await w(2500);
  ok(calls.length === n3, `창이 가려져 있으면 타이머는 가져오지 않음 (${calls.length - n3}번)`);

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
