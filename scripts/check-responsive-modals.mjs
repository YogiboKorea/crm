/**
 * **팝업 창이 휴대폰에서 잘리지 않는지** 본다 (2026-09-16).
 *
 * 목록 화면은 scripts/check-responsive.mjs 가 본다. 여기서는 눌러야 뜨는 것들을 본다:
 *   메일 상세 · 대화 보기 · 답장 미리보기 · 메일 계정 추가 · 발송 로직 설명
 *
 * 메일은 보내지 않는다 — 발송 요청은 모두 가로챈다.
 * 사용: node scripts/check-responsive-modals.mjs [--w=390]
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=');
const VW = Number(arg('w', '390')) || 390;
const B = 'http://localhost:3000';
const w = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;

const token = () => new SignJWT({ user: 'david', role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('2h').sign(new TextEncoder().encode(process.env.JWT_SECRET));

/** 화면 밖으로 나가 볼 수 없게 된 것만 (옆으로 밀 수 있는 칸 안은 제외) */
const SCAN = (vw) => {
  const out = [];
  const scrollable = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  const seen = new Set();
  // 닫혀 있는 사이드바 서랍은 **일부러** 화면 왼쪽 밖에 세워 둔 것이라 문제가 아니다
  const drawer = document.getElementById('appSidebar');
  document.querySelectorAll('body *').forEach((el) => {
    if (drawer && (el === drawer || drawer.contains(el))) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const over = Math.round(r.right - vw);
    const left = Math.round(r.left);
    if (over <= 1 && left >= -1) return;
    if (scrollable(el)) return;
    for (let p = el.parentElement; p; p = p.parentElement) if (seen.has(p)) return;
    seen.add(el);
    const cs = getComputedStyle(el);
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    out.push({
      label: `${el.tagName.toLowerCase()}${id}${cls} "${(el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24)}"`,
      over: over > 1 ? over : 0,
      left: left < -1 ? left : 0,
      width: Math.round(r.width),
      minWidth: cs.minWidth,
      cols: cs.gridTemplateColumns !== 'none' ? cs.gridTemplateColumns.slice(0, 50) : '',
    });
  });
  return out.sort((a, b) => (b.over + Math.abs(b.left)) - (a.over + Math.abs(a.left))).slice(0, 6);
};

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => (r.method() === 'POST' && /\/api\/mail\/(send|schedule|campaign|test-send|backfill|ingest)/.test(r.url()))
    || (r.method() === 'POST' && /\/api\/mail\/reply$/.test(r.url().split('?')[0])) ? r.abort() : r.continue());
  await p.setViewport({ width: VW, height: 844, isMobile: VW <= 430, hasTouch: VW <= 430, deviceScaleFactor: 2 });
  await p.setCookie({ name: 'admin_session', value: await token(), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(4000);
  console.log(`화면 너비 ${VW}px — 팝업 점검\n`);

  const step = async (name, open, close) => {
    const opened = await open(p);
    if (!opened) { console.log(`   ${name} — 열 수 없어 건너뜀`); return; }
    await w(2600);
    const over = await SCANrun(p);
    const bad = over.length > 0;
    if (bad) fail++;
    console.log(`${bad ? '⚠' : '  '} ${name}`);
    over.forEach((o) => console.log(`    ${o.over ? `오른쪽으로 ${o.over}px 넘침` : `왼쪽으로 ${Math.abs(o.left)}px 벗어남`}`
      + ` · 폭 ${o.width}px  ${o.label}`
      + (o.minWidth !== '0px' ? ` [min-width ${o.minWidth}]` : '')
      + (o.cols ? ` [열 ${o.cols}]` : '')));
    if (close) { await close(p); await w(1200); }
  };
  const SCANrun = (page) => page.evaluate(SCAN, VW);
  const goto = async (page, view) => {
    await page.evaluate((v) => document.querySelector(`.nav-item[data-view="${v}"]`)?.click(), view);
    await w(2600);
  };

  // ── 메일 상세 (받은 메일함에서 한 통 열기) ──
  await goto(p, 'tool-inbox');
  await step('📧 메일 상세',
    (page) => page.evaluate(() => { const r = document.querySelector('.table-wrap tbody tr'); if (r) { r.click(); return true; } return false; }),
    (page) => page.evaluate(() => document.querySelector('[data-close-mail], #mailDetailClose, .modal-close')?.click()));

  // ── 업체 상세 (검증 완료에서 한 곳 열기) ──
  // 판정 버튼 글자가 세로로 쪼개지던 자리다 — 버튼이 낱말 폭 아래로 줄어들지 않는지 함께 본다
  await goto(p, 'pipeline-verified');
  await step('🏢 업체 상세',
    (page) => page.evaluate(() => { const r = document.querySelector('.table-wrap tbody tr'); if (r) { r.click(); return true; } return false; }),
    // 닫기 전에 판정 버튼 크기를 잰다 — 닫고 나서 재면 늘 0px 이라 아무것도 못 잡는다
    async (page) => {
      const j = await page.evaluate(() => {
        const q = document.getElementById('el-toQueue');
        if (!q || !q.offsetParent) return null;
        const r = q.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), text: q.textContent.trim() };
      });
      if (j && j.w < 110) { fail++; console.log(`    ⚠ 판정 버튼이 ${j.w}px 로 찌그러졌습니다 — 글자가 세로로 쪼개집니다`); }
      else if (j) console.log(`    판정 버튼 ${j.w}×${j.h}px — "${j.text}" 한 줄로 들어감`);
      await page.evaluate(() => document.getElementById('editModalCloseBtn')?.click());
    });

  // ── 대화 보기 (답장 받음) ──
  await goto(p, 'pipeline-replied');
  await step('💬 대화 보기',
    (page) => page.evaluate(() => { const b2 = document.querySelector('button.conversation-btn'); if (b2) { b2.click(); return true; } return false; }),
    null);

  // ── 답장 미리보기 (대화 보기가 열린 상태에서) ──
  await step('👁 답장 미리보기',
    async (page) => page.evaluate(() => {
      const body = document.getElementById('convReplyBody');
      const btn = document.getElementById('convReplyPreview');
      if (!body || !btn) return false;
      body.innerHTML = 'Dear partner,<br><br>Thank you for your message. We will send the price list this week.<br><br>Best regards,';
      btn.click();
      return true;
    }),
    (page) => page.evaluate(() => document.querySelector('#replyPreviewModal [data-rp-close]')?.click()));

  // ── 메일 계정 추가 ──
  await p.keyboard.press('Escape');
  await w(800);
  await goto(p, 'tool-mail-accounts');
  await step('📬 메일 계정 추가',
    (page) => page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((x) => /\+ 계정 추가/.test(x.textContent));
      if (btn) { btn.click(); return true; }
      return false;
    }),
    (page) => page.evaluate(() => document.querySelector('#mailAccountModalRoot')?.remove()));

  // ── 발송 로직 설명 ──
  await goto(p, 'pipeline-contacted');
  await step('❓ 발송 로직 설명',
    (page) => page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((x) => /발송 로직/.test(x.textContent));
      if (btn) { btn.click(); return true; }
      return false;
    }),
    (page) => page.evaluate(() => document.getElementById('sendLogicModalRoot')?.remove()));

  if (errs.length) { fail++; console.log(`\n자바스크립트 오류 ${errs.length}건: ${errs.slice(0, 2).join(' | ')}`); }
} finally {
  await b.close();
}
console.log(fail ? `\n총 ${fail}개 팝업에서 손볼 곳이 있습니다.` : '\n✅ 팝업도 모두 좁은 폭에 들어맞습니다.');
process.exit(0);
