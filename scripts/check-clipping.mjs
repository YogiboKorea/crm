/**
 * 잘려서 안 보이는 내용을 찾는다.
 *
 * check-responsive.mjs 는 "가로 스크롤이 생기는가" 를 본다. 그런데 이 앱은
 * .main 에 overflow-x:hidden 이 걸려 있어서, 폭이 모자라면 스크롤이 생기는 대신
 * **그냥 잘린다**. 스크롤바가 없으니 사용자는 잘린 줄도 모르고, 거기 있던
 * 버튼은 영영 못 누른다 — "반응형이 안 된다" 의 실체가 이쪽이다.
 *
 * 그래서 여기서는 다른 것을 잰다:
 *   ① overflow-x:hidden 인데 내용이 넘치는 칸  → 내용이 잘려 못 본다
 *   ② 그 안에서 실제로 화면 밖에 있는 "누를 수 있는 것" → 못 누르는 버튼
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const BASE = process.env.AUDIT_BASE || 'http://localhost:3000';
const WIDTHS = (process.env.AUDIT_WIDTHS || '1440,1280,1100,1024,900,768,620,480,390')
  .split(',').map(Number);

const VIEWS = [
  ['pipeline-verified',  'AI 검증 완료'],
  ['pipeline-contacted', '발송 관리'],
  ['tool-inbox',         '받은 메일함'],
  ['tool-inbox-needsreply', '회신 필요'],
  ['tool-legacy',        '올린 업체 목록'],
  ['tool-mail-accounts', '메일 계정 관리'],
  ['tool-b2b-email',     '메일 양식'],
  ['tool-scheduled-mails','예약 발송 관리'],
  ['pipeline-partner',   '파트너십 확정'],
  ['tool-user-guide',    '사용 설명서'],
];

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: process.env.ADMIN_ID || 'yogico', role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(secret);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });

const MEASURE = `(() => {
  const clipped = [], unreachable = [];
  const name = (el) => el.tagName.toLowerCase() +
    (el.id ? '#' + el.id : '') +
    (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : '');

  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const over = el.scrollWidth - el.clientWidth;
    if (over > 1 && cs.overflowX === 'hidden' && el.clientWidth > 0) {
      clipped.push({ el: name(el), over, w: el.clientWidth, text: (el.textContent||'').trim().slice(0,40) });
    }
  }

  // 못 누르는 것 — 버튼/링크/입력칸이 화면 밖에 있는가
  const vw = document.documentElement.clientWidth;
  for (const el of document.querySelectorAll('button, a, input, select, textarea, [role=button]')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.left >= vw - 2 || r.right <= 2) {
      unreachable.push({ el: name(el), left: Math.round(r.left), text: (el.textContent||el.placeholder||'').trim().slice(0,30) });
    }
  }
  return {
    clipped: clipped.sort((a,b)=>b.over-a.over).slice(0,5),
    unreachable: unreachable.slice(0,8),
    unreachableTotal: unreachable.length,
  };
})()`;

const hits = [];
for (const w of WIDTHS) {
  await page.setViewport({ width: w, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 900));
  console.log(`\n════ ${w}px ════`);
  for (const [view, label] of VIEWS) {
    const ok = await page.evaluate(v => { const b=document.querySelector(`.nav-item[data-view="${v}"]`); if(!b) return false; b.click(); return true; }, view);
    if (!ok) { console.log(`  ${label.padEnd(15)} — 메뉴 없음`); continue; }
    await new Promise(r => setTimeout(r, 1100));
    const m = await page.evaluate(MEASURE);
    const bad = m.clipped.length || m.unreachableTotal;
    console.log(`  ${label.padEnd(15)} ${bad ? '✗' : '✓'}  잘림 ${m.clipped.length} · 못누름 ${m.unreachableTotal}`);
    if (bad) {
      hits.push({ w, label, ...m });
      for (const c of m.clipped) console.log(`      잘림  -${String(c.over).padStart(4)}px  ${c.el.slice(0,46).padEnd(46)} "${c.text}"`);
      for (const u of m.unreachable.slice(0,4)) console.log(`      못누름 x=${String(u.left).padStart(5)}  ${u.el.slice(0,40).padEnd(40)} "${u.text}"`);
    }
  }
}

console.log('\n\n════════ 요약 ════════');
const byW = new Map();
for (const h of hits) byW.set(h.w, (byW.get(h.w)||0)+1);
for (const [w,n] of [...byW].sort((a,b)=>b[0]-a[0])) console.log(`  ${w}px — ${n}개 화면 문제`);
const sig = new Map();
for (const h of hits) for (const c of h.clipped) sig.set(c.el, (sig.get(c.el)||0)+1);
console.log('\n  가장 자주 잘리는 칸:');
for (const [s,n] of [...sig].sort((a,b)=>b[1]-a[1]).slice(0,14)) console.log(`    ${String(n).padStart(3)}회  ${s}`);
await browser.close();
