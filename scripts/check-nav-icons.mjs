/**
 * 사이드바 아이콘 그림 확인 (2026-11-12) — 이모지를 직접 만든 아이콘 세트(public/icons/nav)로 바꾼 뒤.
 *
 *   1) 보이는 메뉴·구역 제목·메일 쓰기의 아이콘 그림이 모두 불러와졌는가 (깨진 그림 없음)
 *   2) 크기가 맞는가 — 메뉴 18px · 접은 사이드바 20px · 구역 제목 12px
 *   3) 밝은 화면 · 어두운 화면 · 접은 사이드바 모습을 찍어 둔다 (SHOT 을 주면)
 *
 * 사용: CRM_BASE=http://localhost:3000 [SHOT=경로.png] node scripts/check-nav-icons.mjs
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
await p.setRequestInterception(true);
p.on('request', (r) => {
  const u = r.url();
  if (/\/api\/cron\//.test(u) || (/\/api\/mail\/(send|schedule|campaign|reply|test-send|compose)/.test(u) && r.method() !== 'GET')) return r.abort();
  r.continue();
});
await p.setCookie({ name: 'admin_session', value: jwt, domain: new URL(B).hostname, path: '/' });
await p.setViewport({ width: 1440, height: 1100 });

try {
  await p.goto(B + '/', { waitUntil: 'networkidle2' });
  await w(1500);
  const r = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll('#appSidebar img[src^="/icons/nav/"]')]
      .filter((i) => i.offsetParent !== null);   // 보이는 것만 (대표님 전용 메뉴 포함)
    return {
      n: imgs.length,
      broken: imgs.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.getAttribute('src')),
      menu: [...new Set([...document.querySelectorAll('.nav-icon img')].filter((i) => i.offsetParent).map((i) => Math.round(i.getBoundingClientRect().width)))],
      section: [...new Set([...document.querySelectorAll('.nav-section-icon')].map((i) => Math.round(i.getBoundingClientRect().width)))],
      emoji: [...document.querySelectorAll('.nav-item .nav-icon')].filter((s) => s.offsetParent && !s.querySelector('img')).map((s) => s.textContent),
    };
  });
  ok(r.n >= 22 && !r.broken.length, `아이콘 그림 ${r.n}개 모두 불러옴${r.broken.length ? ` — 깨짐: ${r.broken.join(', ')}` : ''}`);
  ok(!r.emoji.length, `보이는 메뉴에 남은 이모지 없음${r.emoji.length ? ` — ${r.emoji.join(' ')}` : ''}`);
  ok(r.menu.length === 1 && r.menu[0] === 18 && r.section[0] === 12, `크기 — 메뉴 ${r.menu.join('/')}px · 구역 제목 ${r.section.join('/')}px`);
  const side = async (name) => {
    if (!SHOT) return;
    const el = await p.$('#appSidebar');
    await el.screenshot({ path: SHOT.replace(/\.png$/, `-${name}.png`) });
  };
  await side('light');
  await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await w(300);
  await side('dark');
  await p.evaluate(() => { document.documentElement.dataset.theme = ''; document.documentElement.dataset.sidebarCollapsed = 'true'; });
  await w(400);
  const c = await p.evaluate(() => [...new Set([...document.querySelectorAll('.nav-icon img')].filter((i) => i.offsetParent).map((i) => Math.round(i.getBoundingClientRect().width)))]);
  ok(c.length === 1 && c[0] === 20, `접은 사이드바 — 아이콘 ${c.join('/')}px`);
  await side('collapsed');
  ok(!errs.length, `화면 오류 없음${errs.length ? ` — ${errs.join(' / ')}` : ''}`);
} catch (e) {
  fail++;
  console.log('  X   ' + (e?.stack || e));
} finally {
  await p.evaluate(() => { delete document.documentElement.dataset.sidebarCollapsed; }).catch(() => {});
  await b.close();
}
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
