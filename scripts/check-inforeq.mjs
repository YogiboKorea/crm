/**
 * 업체 정보 요청 칸이 실제로 열리고 · 저장되고 · 다시 불러와지는지 끝까지 확인한다.
 *
 * 화면에 그려지기만 하고 저장이 안 되는 일이 흔하다. 그래서 DOM 만 보지 않고
 * 실제로 글을 넣고 저장한 뒤, 새로고침해서 남아 있는지까지 본다.
 * 확인이 끝나면 넣었던 시험용 글은 지운다 (DB 에 쓰레기를 남기지 않는다).
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const MARK = '[자동확인] 담당자 이름과 직책을 알고 싶습니다';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: process.env.ADMIN_ID || 'yogico', role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(secret);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   ⚠ JS 오류:', String(e).slice(0, 140)));
await page.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });

let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.setViewport({ width: 1280, height: 900 });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
await wait(1800);

ok(await page.$('#infoReqToggle') !== null, '검증 완료 화면에 요청 칸이 있다');

// 접혀 있어야 한다 — 펼친 채로 두면 2차 검토 카드가 밀린다
ok(await page.$('#infoReqBody') === null, '처음에는 접혀 있다');

// 2차 검토 카드가 요청 칸보다 아래에 있고, 첫 화면 안에 있어야 한다
const pos = await page.evaluate(() => {
  const req = document.getElementById('infoReqToggle');
  const hero = document.querySelector('.verify-hero');
  return {
    reqTop: req ? Math.round(req.getBoundingClientRect().top) : null,
    heroTop: hero ? Math.round(hero.getBoundingClientRect().top) : null,
  };
});
ok(pos.reqTop !== null && pos.heroTop !== null && pos.reqTop < pos.heroTop,
   `요청 칸이 2차 검토 카드 위에 있다 (요청 ${pos.reqTop} < 검토 ${pos.heroTop})`);
ok(pos.heroTop < 400, `2차 검토 카드가 여전히 첫 화면 안에 있다 (top=${pos.heroTop})`);

// 펼치기
await page.click('#infoReqToggle');
await wait(900);
ok(await page.$('#infoReqBody') !== null, '누르면 펼쳐진다');
ok((await page.$$('.info-req-chip')).length > 0, '예시 칩이 보인다');

// 칩을 눌러 글이 들어가는가
await page.evaluate(() => document.querySelector('.info-req-chip').click());
await wait(300);
const chipText = await page.evaluate(() => document.getElementById('infoReqBody').value);
ok(chipText.includes('-'), `칩을 누르면 칸에 들어간다 ("${chipText.trim().slice(0, 26)}")`);

// 빈 칸 저장 막기
await page.evaluate(() => { document.getElementById('infoReqBody').value = ''; });
await page.click('#infoReqSave');
await wait(600);
ok((await page.evaluate(() => document.getElementById('infoReqMsg')?.textContent || '')).includes('적어'),
   '빈 칸이면 저장하지 않고 알려준다');

// 실제 저장
await page.evaluate((m) => { document.getElementById('infoReqBody').value = m; }, MARK);
await page.click('#infoReqSave');
await wait(1800);
ok(await page.evaluate((m) => document.body.innerText.includes(m), MARK), '저장하면 목록에 바로 뜬다');

// 새로고침해도 남아 있는가 — 진짜 저장됐는지는 이것으로만 알 수 있다
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
await wait(1800);
await page.click('#infoReqToggle');
await wait(1200);
ok(await page.evaluate((m) => document.body.innerText.includes(m), MARK), '새로고침해도 남아 있다');

// 처리함 → 되돌리기
await page.evaluate(() => document.querySelector('.info-req-done')?.click());
await wait(1500);
ok(await page.evaluate(() => (document.querySelector('.info-req-done')?.textContent || '').includes('되돌리기')),
   '[처리함] 을 누르면 상태가 바뀐다');

// 뒷정리 — 시험용으로 넣은 것을 지운다
const removed = await page.evaluate(async (m) => {
  const r = await fetch('/api/info-requests').then((x) => x.json());
  const mine = (r.items || []).filter((i) => (i.body || '').includes(m));
  for (const i of mine) await fetch('/api/info-requests?id=' + encodeURIComponent(i._id), { method: 'DELETE' });
  return mine.length;
}, MARK);
console.log(`\n  뒷정리 — 시험용 요청 ${removed}건 삭제`);

console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
await browser.close();
process.exit(fail ? 1 : 0);
