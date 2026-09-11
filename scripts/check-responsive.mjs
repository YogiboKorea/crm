/**
 * 폭을 줄여가며 화면이 실제로 깨지는 곳을 찾는다.
 *
 * "반응형이 안 된다" 를 눈으로 찾으면 빠뜨린다. 브라우저를 띄워
 * 폭마다 ① 가로 스크롤이 생기는가 ② 화면 밖으로 삐져나간 요소가 무엇인가
 * 를 재서 좌표까지 찍어 준다.
 *
 * 로그인은 비밀번호 대신 JWT 를 직접 만들어 쿠키로 넣는다 (login route 와 같은 서명).
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const BASE = process.env.AUDIT_BASE || 'http://localhost:3000';
const WIDTHS = (process.env.AUDIT_WIDTHS || '1440,1280,1024,900,768,620,480,390')
  .split(',').map(Number);

const VIEWS = [
  ['pipeline-verified',  'AI 검증 완료'],
  ['pipeline-contacted', '발송 관리'],
  ['tool-inbox',         '받은 메일함'],
  ['tool-legacy',        '올린 업체 목록'],
  ['tool-mail-accounts', '메일 계정 관리'],
  ['tool-b2b-email',     '메일 양식'],
  ['tool-briefing',      '오늘의 브리핑'],
  ['pipeline-partner',   '파트너십 확정'],
  ['tool-user-guide',    '사용 설명서'],
];

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: process.env.ADMIN_ID || 'yogico', role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(secret);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log(`   ⚠ JS 오류: ${String(e).slice(0, 120)}`));

await page.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });

/** 화면 밖으로 나간 요소를 찾는다 — 가로 스크롤의 범인 */
const MEASURE = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.position === 'fixed') continue;              // 모달·토스트는 별개
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const over = Math.round(r.right - vw);
    if (over <= 1) continue;
    // 스크롤 가능한 조상 안에 있으면 의도된 가로 스크롤이다 (표 등)
    let p = el.parentElement, scrollable = false;
    while (p && p !== document.body) {
      const pcs = getComputedStyle(p);
      if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll' || pcs.overflowX === 'hidden') { scrollable = true; break; }
      p = p.parentElement;
    }
    if (scrollable) continue;
    const sig = el.tagName + '.' + (el.className || '').toString().slice(0, 40);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ sig, over, w: Math.round(r.width), text: (el.textContent || '').trim().slice(0, 34) });
  }
  return {
    pageOverflow: Math.round(document.scrollingElement.scrollWidth - vw),
    vw,
    offenders: out.sort((a, b) => b.over - a.over).slice(0, 6),
  };
})()`;

const problems = [];

for (const w of WIDTHS) {
  await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
  console.log(`\n════ 폭 ${w}px ════`);
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 900));

  for (const [view, label] of VIEWS) {
    const clicked = await page.evaluate((v) => {
      const b = document.querySelector(`.nav-item[data-view="${v}"]`);
      if (!b) return false;
      b.click(); return true;
    }, view);
    if (!clicked) { console.log(`  ${label.padEnd(16)} — 메뉴 없음`); continue; }
    await new Promise((r) => setTimeout(r, 1100));

    const m = await page.evaluate(MEASURE);
    const bad = m.pageOverflow > 1 || m.offenders.length > 0;
    console.log(`  ${label.padEnd(16)} ${bad ? '✗' : '✓'} 가로넘침 ${m.pageOverflow}px`);
    if (bad) {
      problems.push({ w, label, pageOverflow: m.pageOverflow, offenders: m.offenders });
      for (const o of m.offenders) {
        console.log(`        +${String(o.over).padStart(4)}px  ${o.sig.slice(0, 52).padEnd(52)} "${o.text}"`);
      }
    }
  }
}

console.log('\n\n════════ 요약 ════════');
if (!problems.length) console.log('  깨지는 곳 없음');
else {
  const byW = new Map();
  for (const p of problems) byW.set(p.w, (byW.get(p.w) || 0) + 1);
  for (const [w, n] of [...byW].sort((a, b) => b[0] - a[0])) console.log(`  ${w}px — ${n}개 화면 깨짐`);
  const bySig = new Map();
  for (const p of problems) for (const o of p.offenders) bySig.set(o.sig, (bySig.get(o.sig) || 0) + 1);
  console.log('\n  가장 자주 삐져나오는 요소:');
  for (const [sig, n] of [...bySig].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`    ${String(n).padStart(3)}회  ${sig}`);
}
await browser.close();
