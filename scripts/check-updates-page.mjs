/**
 * 사이드바 [🆕 최근 업데이트] 화면 확인 (2026-10-20, 미팅 전 요청 "사용 설명서 아래에 최근 업데이트 · 날짜 작성").
 *
 *   1) 사이드바에서 [📖 사용 설명서] 바로 아래에 있고, 처음 보는 브라우저에는 NEW 가 붙는가
 *   2) 열면 날짜별 묶음 · 항목 · 진행 중/확인 필요가 보이고, NEW 가 사라지는가
 *   3) [예약 발송 →] 은 발송 관리의 [📅 예약 발송] 탭으로, [메일 쓰기 열기 →] 는 쓰기 창으로 가는가
 *
 * 메일을 보내지 않는다 — 발송·예약 처리 요청은 가로채 막는다.
 * 사용: CRM_BASE=http://localhost:3000 [SHOT=경로.png] node scripts/check-updates-page.mjs
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = process.env.CRM_BASE || 'http://localhost:3000';
const SHOT = process.env.SHOT || '';
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));

const jwt = await new SignJWT({ user: 'david', role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('dialog', async (d) => { await d.dismiss(); });
await p.setRequestInterception(true);
p.on('request', (r) => {
  const u = r.url();
  if (/\/api\/cron\//.test(u) || (/\/api\/mail\/(send|schedule|campaign|reply|test-send|compose)/.test(u) && r.method() !== 'GET')) return r.abort();
  r.continue();
});
await p.setCookie({ name: 'admin_session', value: jwt, domain: new URL(B).hostname, path: '/' });
await p.setViewport({ width: 1440, height: 1000 });
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); } return false; };

try {
  await p.goto(B + '/', { waitUntil: 'networkidle2' });
  await w(2500);   // 사이드바 숫자가 다 채워진 뒤에도 NEW 가 남아 있어야 한다
  const nav = await p.evaluate(() => {
    const items = [...document.querySelectorAll('.nav-item[data-view]')].map((x) => x.dataset.view);
    const i = items.indexOf('tool-updates');
    const badge = document.querySelector('[data-nav-badge="updatesNew"]');
    return { after: items[i - 1], label: document.querySelector('.nav-item[data-view="tool-updates"]')?.innerText.replace(/\s+/g, ' ').trim(), badge: badge?.textContent, shown: badge ? getComputedStyle(badge).display !== 'none' : false };
  });
  ok(nav.after === 'tool-user-guide', `[📖 사용 설명서] 바로 아래 (${nav.label})`);
  ok(nav.badge === 'NEW' && nav.shown, `처음 보는 브라우저에는 NEW 표시 (${nav.badge || '없음'})`);

  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-updates"]').click());
  ok(await waitFor(() => document.querySelectorAll('.upd-go').length > 0), '최근 업데이트 화면 열림');
  const v = await p.evaluate(() => ({
    title: document.getElementById('viewTitle')?.innerText || document.querySelector('h1')?.innerText,
    days: [...document.querySelectorAll('#content section h3, main section h3')].map((h) => h.innerText),
    cards: document.querySelectorAll('section > div[style*="border-left:4px"]').length,
    next: document.body.innerText.includes('진행 중 · 확인 필요'),
    badge: document.querySelector('[data-nav-badge="updatesNew"]')?.textContent,
  }));
  ok(v.days.length >= 7, `날짜 묶음 ${v.days.length}개 — ${v.days.join(' / ')}`);
  ok(v.cards >= 13, `항목 ${v.cards}건`);
  ok(v.next, '진행 중 · 확인 필요 칸');
  ok(!v.badge, '열고 나면 NEW 가 사라짐');
  if (SHOT) {
    await p.screenshot({ path: SHOT, fullPage: true });
    console.log(`     화면 저장: ${SHOT}`);
  }

  await p.evaluate(() => document.querySelector('.upd-go[data-go="pipeline-contacted"]').click());
  ok(await waitFor(() => document.querySelector('.outbox-tab[data-tab="scheduled"]')?.style.boxShadow.includes('inset')), '[예약 발송 →] → 발송 관리 [📅 예약 발송] 탭');
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-updates"]').click());
  await waitFor(() => document.querySelectorAll('.upd-go').length > 0);
  await p.evaluate(() => document.querySelector('.upd-go[data-go="compose"]').click());
  ok(await waitFor(() => !!document.getElementById('composeMailModal')), '[메일 쓰기 열기 →] → 쓰기 창');
  await p.evaluate(() => document.getElementById('composeMailModal')?.remove());
  await p.reload({ waitUntil: 'networkidle2' });
  await w(500);
  ok(!(await p.evaluate(() => document.querySelector('[data-nav-badge="updatesNew"]')?.textContent)), '다시 열어도 NEW 없음 (본 것으로 기억)');
} finally {
  ok(errs.length === 0, `JS 오류 없음 ${errs.join(' | ').slice(0, 300)}`);
  await b.close();
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
