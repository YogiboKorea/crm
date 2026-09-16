/**
 * **좁은 화면(휴대폰)에서 화면이 넘치는 곳을 찾는다** (2026-09-16, 대표님 요청 "반응형 점검").
 *
 * 무엇을 보나:
 *   1) 가로 스크롤이 생기는가 — 생기면 손가락으로 좌우로 밀어야 내용을 볼 수 있다는 뜻이다
 *   2) 화면 밖으로 튀어나간 요소가 무엇인가 (가장 넓은 것부터)
 *   3) 글자가 너무 작아 읽기 힘든 곳은 없는가
 *   4) 누르기 버튼이 손가락으로 누르기에 너무 작지 않은가 (한 변 32px 미만)
 *
 * 메일은 보내지 않는다 — 발송 관련 요청은 모두 가로챈다.
 *
 * 사용: node scripts/check-responsive.mjs [--w=390] [--view=tool-inbox]
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=');
const WIDTHS = (arg('w', '390,768') || '390').split(',').map(Number).filter(Boolean);
const ONLY = arg('view', '');
const B = 'http://localhost:3000';
const w = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWS = [
  ['tool-inbox', '📥 받은 메일함'],
  ['tool-inbox-needsreply', '⚠️ 회신 필요'],
  ['tool-deadlines', '⏰ 기한 관리'],
  ['pipeline-verified', '✅ AI 검증 완료'],
  ['pipeline-contacted', '📨 발송 관리'],
  ['pipeline-replied', '💬 답장 받음'],
  ['pipeline-negotiating', '🤝 대화 진행 중'],
  ['pipeline-partner', '⭐ 파트너십 확정'],
  ['tool-legacy', '📚 올린 업체 목록'],
  ['tool-mail-accounts', '📬 메일 계정 관리'],
  ['tool-b2b-email', '📝 메일 양식'],
  ['tool-crm-account', '👤 CRM 계정 관리'],
  ['tool-user-guide', '📖 사용 설명서'],
].filter(([v]) => !ONLY || v === ONLY);

const token = () => new SignJWT({ user: 'david', role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('2h').sign(new TextEncoder().encode(process.env.JWT_SECRET));

/**
 * 화면 밖으로 나가 **볼 수 없게 된** 요소를 찾는다.
 *
 * 표처럼 자기 칸 안에서 옆으로 밀어 볼 수 있는 것(overflow-x:auto 안에 든 것)은 문제로 치지 않는다 —
 * 넘치기는 해도 손가락으로 밀면 보인다. 진짜 문제는 잘린 채 **밀 수도 없는** 것이다.
 */
const SCAN = (vw) => {
  const out = [];
  const label = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 26);
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ''}`;
  };
  /** 옆으로 밀어서 볼 수 있는 칸 안에 있나 */
  const scrollableAncestor = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth + 1) return p;
    }
    return null;
  };
  const seen = new Set();
  document.querySelectorAll('.main *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const over = Math.round(r.right - vw);
    if (over <= 1) return;
    if (scrollableAncestor(el)) return;          // 밀어서 볼 수 있으면 넘어간다
    for (let p = el.parentElement; p; p = p.parentElement) if (seen.has(p)) return;
    seen.add(el);
    const cs = getComputedStyle(el);
    out.push({
      label: label(el),
      over,
      width: Math.round(r.width),
      minWidth: cs.minWidth,
      cols: cs.gridTemplateColumns && cs.gridTemplateColumns !== 'none' ? cs.gridTemplateColumns.slice(0, 60) : '',
      ws: cs.whiteSpace,
    });
  });
  return out.sort((a, b) => b.over - a.over).slice(0, 8);
};

/** 옆으로 밀어야만 다 보이는 칸 — 휴대폰에서 표를 읽는 방식이라 몇 개인지만 센다 */
const SIDESCROLL = (vw) => {
  const rows = [];
  document.querySelectorAll('.main *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') return;
    if (el.scrollWidth <= el.clientWidth + 1) return;
    rows.push(`${el.className || el.tagName.toLowerCase()} ${el.clientWidth}px 칸에 내용 ${el.scrollWidth}px`);
  });
  return rows.slice(0, 4);
};

const SMALL = () => {
  const tiny = [];
  const taps = [];
  document.querySelectorAll('.main *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    const txt = (el.textContent || '').trim();
    if (txt && el.children.length === 0 && parseFloat(cs.fontSize) < 11) {
      tiny.push(`${parseFloat(cs.fontSize)}px "${txt.slice(0, 22)}"`);
    }
    if ((el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SELECT') && (r.height < 32 || r.width < 32)) {
      taps.push(`${Math.round(r.width)}×${Math.round(r.height)} "${(el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 18)}"`);
    }
  });
  return { tiny: [...new Set(tiny)].slice(0, 6), taps: [...new Set(taps)].slice(0, 6) };
};

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
let problems = 0;
try {
  for (const vw of WIDTHS) {
    console.log(`\n${'='.repeat(58)}\n화면 너비 ${vw}px ${vw <= 430 ? '(휴대폰)' : '(태블릿)'}\n${'='.repeat(58)}`);
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    p.on('dialog', async (d) => { await d.dismiss(); });
    await p.setRequestInterception(true);
    p.on('request', (r) => (r.method() === 'POST' && /\/api\/mail\/(send|schedule|campaign|reply|test-send|backfill|ingest)/.test(r.url())) ? r.abort() : r.continue());
    await p.setViewport({ width: vw, height: 844, isMobile: vw <= 430, hasTouch: vw <= 430, deviceScaleFactor: 2 });
    await p.setCookie({ name: 'admin_session', value: await token(), domain: 'localhost', path: '/' });
    await p.goto(B, { waitUntil: 'networkidle2' });
    await w(3500);

    for (const [view, name] of VIEWS) {
      await p.evaluate((v) => document.querySelector(`.nav-item[data-view="${v}"]`)?.click(), view);
      await w(2600);
      const doc = await p.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        bodyW: document.body.scrollWidth,
      }));
      const over = await p.evaluate(SCAN, vw);
      const small = await p.evaluate(SMALL);
      const side = await p.evaluate(SIDESCROLL, vw);
      const hScroll = doc.scrollW > doc.clientW + 1;
      const bad = hScroll || over.length;
      if (bad) problems++;
      console.log(`\n${bad ? '⚠' : '  '} ${name}`);
      if (hScroll) console.log(`    가로 스크롤 생김 — 문서 폭 ${doc.scrollW}px > 화면 ${doc.clientW}px (${doc.scrollW - doc.clientW}px 넘침)`);
      over.forEach((o) => console.log(`    ${String(o.over).padStart(4)}px 넘침 · 폭 ${String(o.width).padStart(4)}px  ${o.label}`
        + (o.minWidth !== '0px' ? ` [min-width ${o.minWidth}]` : '')
        + (o.cols ? ` [열 ${o.cols}]` : '')
        + (o.ws === 'nowrap' ? ' [줄바꿈 안 함]' : '')));
      if (side.length) console.log(`    옆으로 밀어 보는 칸: ${side.join(' · ')}`);
      if (small.tiny.length) console.log(`    작은 글씨: ${small.tiny.join(' · ')}`);
      if (small.taps.length) console.log(`    작은 버튼: ${small.taps.join(' · ')}`);
    }
    if (errs.length) { problems++; console.log(`\n  자바스크립트 오류 ${errs.length}건: ${errs.slice(0, 2).join(' | ')}`); }
    await p.close();
  }
} finally {
  await b.close();
}
console.log(problems ? `\n총 ${problems}개 화면에서 손볼 곳이 있습니다.` : '\n✅ 모든 화면이 좁은 폭에 들어맞습니다.');
process.exit(0);
