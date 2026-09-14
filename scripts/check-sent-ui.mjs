/**
 * 📤 보낸 메일함 화면을 실제 브라우저로 확인한다 (읽기만 — 보내기 없음).
 * 열기 → 목록 → 다음 쪽 → 검색 → 메일 열기 → 첨부 내려받기(디스크 저장 확인) → 닫기 → 돌아가기
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const jwt = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'sent-dl-'));
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('dialog', async (d) => { errs.push('알림창: ' + d.message().slice(0, 100)); await d.dismiss(); });
await p.setRequestInterception(true);
p.on('request', (r) => (/\/api\/mail\/(send|schedule|campaign|reply)/.test(r.url()) && r.method() !== 'GET') ? r.abort() : r.continue());
await p.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });
(await p.createCDPSession()).send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
await p.setViewport({ width: 1440, height: 900 });

let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(300); } return false; };

await p.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
await w(1200);
await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-inbox"]').click());
await w(2500);

const hasBtn = await p.evaluate(() => !!document.querySelector('button.inbox-group[data-group="__sent__"]'));
if (!hasBtn && await p.evaluate(() => window.SHOW_SENT_MAILBOX === false)) {
  console.log('  (보낸 메일함은 지금 숨김 상태 — app.js 의 SHOW_SENT_MAILBOX 를 true 로 바꾼 뒤 다시 돌리세요)');
  await b.close(); process.exit(0);
}
ok(hasBtn, '폴더 목록에 [📤 보낸 메일함] 있음');
const order = await p.evaluate(() => [...document.querySelectorAll('button.inbox-group')].map((x) => x.dataset.group).slice(-3));
ok(order.join(',').includes('__sent__,__trash__'), `휴지통 바로 위에 있음 (${order.join(' → ')})`);

let t = Date.now();
await p.evaluate(() => document.querySelector('button.inbox-group[data-group="__sent__"]').click());
ok(await waitFor(() => document.querySelectorAll('tr.sent-row').length > 0), `목록이 뜸 (${((Date.now() - t) / 1000).toFixed(1)}초)`);
const head = await p.evaluate(() => document.body.innerText.match(/📤 보낸 메일함[\s\S]{0,120}/)?.[0].replace(/\s+/g, ' '));
console.log('     ', head);
const firstRows = await p.$$eval('tr.sent-row', (r) => r.slice(0, 3).map((x) => x.innerText.replace(/\s+/g, ' ')));
firstRows.forEach((r) => console.log('      ·', r.slice(0, 90)));
const firstUid = await p.$eval('tr.sent-row', (r) => r.dataset.uid);

// 다음 쪽
await p.evaluate(() => [...document.querySelectorAll('.sent-page')].find((x) => /다음/.test(x.textContent))?.click());
ok(await waitFor(() => /2 \/ \d+ 쪽/.test(document.body.innerText)), '다음 쪽으로 넘어감');
const p2Uid = await p.$eval('tr.sent-row', (r) => r.dataset.uid);
ok(p2Uid !== firstUid, '2쪽 목록이 1쪽과 다름');

// 검색
await p.evaluate(() => { document.getElementById('sentQ').value = 'Dangaard'; document.getElementById('sentSearch').requestSubmit(); });
t = Date.now();
ok(await waitFor(() => /"Dangaard" 검색/.test(document.body.innerText) && !document.querySelector('.inline-loader')), `검색 결과 (${((Date.now() - t) / 1000).toFixed(1)}초)`);
const searchRows = await p.$$eval('tr.sent-row', (r) => r.length);
console.log(`      검색 'Dangaard' → ${searchRows}통`);

// 첨부 있는 메일 열기 (검색을 비우고 1쪽에서)
await p.evaluate(() => { document.getElementById('sentQ').value = ''; document.getElementById('sentSearch').requestSubmit(); });
await waitFor(() => document.querySelectorAll('tr.sent-row').length > 0 && !/검색/.test(document.body.innerText.split('\n').find((l) => /전체 [\d,]+통/.test(l)) || ''));
await w(500);
const clicked = await p.evaluate(() => {
  const r = [...document.querySelectorAll('tr.sent-row')].find((x) => x.innerText.includes('📎')) || document.querySelector('tr.sent-row');
  r.click(); return r.innerText.replace(/\s+/g, ' ').slice(0, 60);
});
console.log('      연 메일:', clicked);
t = Date.now();
ok(await waitFor(() => !!document.querySelector('#sentMailRoot h3')), `메일 내용이 뜸 (${((Date.now() - t) / 1000).toFixed(1)}초)`);
const modal = await p.evaluate(() => {
  const root = document.getElementById('sentMailRoot');
  const body = root.querySelector('.sent-body-html') || root;
  return { text: body.innerText.slice(0, 200), rawTags: /<(div|p|table|span)[\s>]/i.test(body.innerText), to: /받는 사람/.test(root.innerText), chips: root.querySelectorAll('.mail-att-dl').length };
});
ok(modal.to && modal.text.length > 10 && !modal.rawTags, `받는 사람·본문 표시, 태그 글자 없음 — "${modal.text.replace(/\s+/g, ' ').slice(0, 60)}"`);

if (modal.chips) {
  const name = await p.$eval('#sentMailRoot .mail-att-dl', (x) => x.dataset.name);
  await p.evaluate(() => document.querySelector('#sentMailRoot .mail-att-dl').click());
  let saved = null;
  for (let i = 0; i < 60 && !saved; i++) { await w(500); saved = fs.readdirSync(dl).find((f) => !f.endsWith('.crdownload')); }
  ok(!!saved, `첨부 "${name}" 가 디스크에 저장됨 (${saved ? fs.statSync(path.join(dl, saved)).size + 'B' : '없음'})`);
} else console.log('      (이 메일엔 첨부 없음)');

await p.keyboard.press('Escape');
await w(400);
ok(!(await p.$('#sentMailRoot')), 'Esc 로 닫힘');

await p.evaluate(() => document.getElementById('sentBack').click());
ok(await waitFor(() => document.querySelectorAll('tr.inbox-row').length > 0), '← 받은 메일함 으로 돌아옴');

// 사이드바로 나가기
await p.evaluate(() => document.querySelector('button.inbox-group[data-group="__sent__"]').click());
await waitFor(() => document.querySelectorAll('tr.sent-row').length > 0);
await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-inbox"]').click());
ok(await waitFor(() => document.querySelectorAll('tr.inbox-row').length > 0 && !document.getElementById('sentBack')), '사이드바 [받은 메일함] 누르면 받은 메일 목록으로');

const real = errs.filter((e) => !/알림창/.test(e));
ok(real.length === 0 && errs.length === 0, `JS 오류·경고창 없음 ${errs.join(' | ').slice(0, 160)}`);
await b.close();
fs.rmSync(dl, { recursive: true, force: true });
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
