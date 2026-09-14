/**
 * 광고 폴더가 폴더 목록에 실제로 뜨는지, 그리고 미분류 **바로 아래**인지 본다.
 *
 * 코드만 읽고 "넣었으니 뜬다" 고 하면 안 된다. 폴더 목록은 /api/mail/groups 가
 * 내려주는 것을 그리는데, 그 API 가 광고 폴더를 빼고 준다면 화면 코드가
 * 아무리 맞아도 한 줄도 안 뜬다. 대표가 "못 봤다" 고 한 것도 그 가능성이 있다.
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const AD = '광고·자동발송';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: process.env.ADMIN_ID || 'yogico', role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(secret);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   JS 오류:', String(e).slice(0, 130)));
await page.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });

let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };

await page.setViewport({ width: 1440, height: 950 });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1200));

// ① API 가 광고 폴더를 내려주는가
const api = await page.evaluate(async () => {
  const r = await fetch('/api/mail/groups').then((x) => x.json()).catch((e) => ({ err: String(e) }));
  return r;
});
const groups = (api && api.groups) || [];
ok(Array.isArray(groups) && groups.length > 0, `/api/mail/groups 가 폴더 ${groups.length}개를 내려준다`);
const adFromApi = groups.find((g) => g.group === AD);
ok(!!adFromApi, `API 응답에 광고 폴더가 있다${adFromApi ? ` (${adFromApi.total}통)` : ' — 없으면 화면에 절대 안 뜬다'}`);

// ② 받은 메일함으로 이동해서 실제로 그려지는가
await page.evaluate(() => document.querySelector('.nav-item[data-view="tool-inbox"]')?.click());
await new Promise((r) => setTimeout(r, 2200));

const panel = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button.inbox-group')];
  return btns.map((b) => ({
    group: b.getAttribute('data-group'),
    text: b.innerText.replace(/\s+/g, ' ').trim(),
    top: Math.round(b.getBoundingClientRect().top),
    visible: b.getBoundingClientRect().height > 0,
  }));
});

console.log('\n  폴더 목록 (그려진 순서):');
for (const p of panel) console.log(`     ${String(p.group || '(전체)').padEnd(22)} ${p.text}`);

const idxAd = panel.findIndex((p) => p.group === AD);
const idxNone = panel.findIndex((p) => p.group === '__none__');
const idxTrash = panel.findIndex((p) => p.group === '__trash__');

ok(idxAd >= 0, '화면 폴더 목록에 광고 폴더가 그려진다');
if (idxAd >= 0 && idxNone >= 0) {
  ok(idxAd === idxNone + 1, `광고 폴더가 미분류 바로 아래다 (미분류 ${idxNone}번째 → 광고 ${idxAd}번째)`);
}
if (idxAd >= 0 && idxTrash >= 0) {
  ok(idxAd < idxTrash, '광고 폴더가 휴지통보다 위다');
}
if (idxAd >= 0) {
  ok(panel[idxAd].text.includes('📢'), `아이콘이 📢 라 거래처 폴더(📁)와 구분된다 — "${panel[idxAd].text}"`);
}

// ③ 눌러서 실제로 그 폴더 메일이 나오는가
if (idxAd >= 0) {
  await page.evaluate((ad) => {
    [...document.querySelectorAll('button.inbox-group')].find((b) => b.getAttribute('data-group') === ad)?.click();
  }, AD);
  await new Promise((r) => setTimeout(r, 2200));
  const rows = await page.evaluate(() => document.querySelectorAll('tr.inbox-row').length);
  ok(rows > 0, `광고 폴더를 누르면 메일이 나온다 (${rows}줄)`);
}

console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
await browser.close();
process.exit(fail ? 1 : 0);
