/**
 * "비밀번호를 저장하시겠습니까?" 가 메일 화면에서 뜨지 않게 막았는지 확인 (2026-10-12 대표님 신고).
 *
 * 원인: 설정 창(화면에 안 보여도 늘 페이지에 들어 있다)의 비밀번호 칸 2개가 form 도 자동완성 지정도 없이
 * 놓여 있었다. Chrome 은 그 칸에 저장된 CRM 비밀번호를 채우고, 페이지 앞쪽의 메일 검색칸에 친 "airport" 를
 * 아이디로 짝지어 답장할 때 "새 비밀번호 저장" 을 띄웠다.
 *
 * Chrome 의 저장 팝업 자체는 헤드리스 브라우저에 뜨지 않으므로, **팝업이 생기는 조건**을 하나씩 확인한다.
 *   1) 페이지의 모든 비밀번호 칸이 용도(new-password / current-password)를 밝혔는가
 *   2) 로그인 화면이 아닌 곳의 비밀번호 칸은 전부 new-password 인가 (저장된 비밀번호를 채우지 않는다)
 *   3) 설정 창의 비밀번호 칸은 자기 form 안에 있는가 (메일 검색칸과 짝지어지지 않는다)
 *   4) 검색칸은 자동완성이 꺼져 있는가
 *   5) 설정 창 비밀번호 칸에서 Enter 를 쳐도 페이지가 새로고침되지 않는가 (form 으로 감싼 부작용 점검)
 *   6) 메일 계정 관리 · CRM 계정 관리 화면의 비밀번호 칸도 같은가
 *   7) 로그인 화면은 username / current-password 로 제대로 밝혔는가 (저장은 여기서만)
 *
 * 읽기만 한다 — 비밀번호를 바꾸거나 계정을 만들지 않는다.
 * 사용: CRM_BASE=http://localhost:3100 node scripts/check-password-autofill.mjs
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = process.env.CRM_BASE || 'http://localhost:3000';   // 3000 번에 다른 프로젝트가 떠 있을 수 있다
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (user) => new SignJWT({ user, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));

// 페이지의 비밀번호 칸을 전부 훑는다
const audit = (p) => p.evaluate(() => [...document.querySelectorAll('input[type="password"]')].map((el) => ({
  id: el.id || el.name || '(이름 없음)',
  ac: el.getAttribute('autocomplete') || '',
  inForm: !!el.closest('form'),
  value: el.value.length,
})));

const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const errs = [];
try {
  // ── 로그인 화면 ──
  console.log('── 로그인 화면');
  const lp = await b.newPage();
  await lp.goto(B + '/login', { waitUntil: 'networkidle2' });
  const login = await lp.evaluate(() => ({
    user: document.querySelector('input[type="text"]')?.getAttribute('autocomplete'),
    pass: document.querySelector('input[type="password"]')?.getAttribute('autocomplete'),
    inForm: !!document.querySelector('input[type="password"]')?.closest('form'),
  }));
  ok(login.user === 'username' && login.pass === 'current-password' && login.inForm,
    `아이디 username · 비밀번호 current-password · form 안 (${login.user} / ${login.pass})`);
  await lp.close();

  // ── 메일 화면 (대표님이 팝업을 본 곳) ──
  console.log('\n── 받은 메일함 (설정 창은 숨겨진 채 페이지에 있다)');
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => (/\/api\/(mail\/(send|schedule|reply|compose|ingest|backfill|sync-on-login)|users|auth\/(change|password))/.test(r.url())
    && r.method() !== 'GET') ? r.abort() : r.continue());
  await p.setViewport({ width: 1500, height: 1000 });
  await p.setCookie({ name: 'admin_session', value: await token('david'), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(3000);

  const fields = await audit(p);
  console.log('   비밀번호 칸:', fields.map((f) => `${f.id}=${f.ac || '(지정 없음)'}${f.inForm ? '·form' : ''}`).join(', '));
  ok(fields.length > 0, `숨겨진 비밀번호 칸 ${fields.length}개를 찾음 (원인이 된 칸)`);
  ok(fields.every((f) => f.ac === 'new-password'), '모두 new-password — 저장된 비밀번호를 채우지 않음');
  ok(fields.every((f) => f.inForm), '모두 자기 form 안 — 메일 검색칸과 짝지어지지 않음');
  ok(fields.every((f) => f.value === 0), '비어 있음');

  const search = await p.evaluate(() => {
    const s = document.getElementById('inboxSearch');
    return s ? { ac: s.getAttribute('autocomplete'), inSameFormAsPassword: !!s.closest('form')?.querySelector('input[type="password"]') } : null;
  });
  ok(search && search.ac === 'off', `메일 검색칸 자동완성 꺼짐 (${search?.ac})`);
  ok(search && !search.inSameFormAsPassword, '메일 검색칸은 비밀번호 칸과 같은 form 에 있지 않음');

  // Enter 를 쳐도 새로고침되지 않아야 한다 (form 으로 감싼 부작용)
  await p.evaluate(() => { window.__marker = 'still-here'; });
  await p.evaluate(() => {
    const el = document.getElementById('newPasswordInput');
    el.form?.requestSubmit ? el.form.requestSubmit() : el.form?.dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await w(1200);
  ok(await p.evaluate(() => window.__marker === 'still-here'), '설정 창 비밀번호 칸에서 Enter(제출) 해도 페이지가 새로고침되지 않음');
  ok(await p.evaluate(() => !!document.getElementById('changePasswordBtn') && !!document.getElementById('createSubIdBtn')),
    '[변경하기] · [생성] 버튼은 그대로 있음');

  // ── 메일 계정 관리 (계정 추가 창) ──
  console.log('\n── 메일 계정 관리');
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-mail-accounts"]')?.click());
  await w(2500);
  const opened = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((x) => /계정 추가|\+ 계정|새 계정/.test(x.textContent || ''));
    btn?.click();
    return !!btn;
  });
  await w(1500);
  if (opened && await p.evaluate(() => !!document.getElementById('macPass'))) {
    const mac = await p.evaluate(() => ({
      pass: document.getElementById('macPass').getAttribute('autocomplete'),
      user: document.getElementById('macUser')?.getAttribute('autocomplete'),
      value: document.getElementById('macPass').value.length,
    }));
    ok(mac.pass === 'new-password', `메일 계정 비밀번호 칸 new-password — CRM 비밀번호가 채워지지 않음 (${mac.pass})`);
    ok(mac.user === 'off', `메일 주소 칸 자동완성 꺼짐 (${mac.user})`);
  } else {
    console.log('   (계정 추가 창을 열지 못해 화면 확인은 건너뜀 — 코드는 아래에서 확인)');
  }

  // ── CRM 계정 관리 (현재·새 비밀번호) ──
  console.log('\n── 👤 CRM 계정 관리');
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-crm-account"]')?.click());
  await w(2500);
  const crm = await audit(p);
  const crmOnly = crm.filter((f) => /^crm/.test(f.id));
  if (crmOnly.length) {
    console.log('   ', crmOnly.map((f) => `${f.id}=${f.ac}`).join(', '));
    ok(crmOnly.filter((f) => /Cur/.test(f.id)).every((f) => f.ac === 'current-password'), '현재 비밀번호 칸은 current-password');
    ok(crmOnly.filter((f) => /New/.test(f.id)).every((f) => f.ac === 'new-password'), '새 비밀번호 칸은 new-password');
  } else {
    console.log('   (CRM 계정 관리 화면을 열지 못해 건너뜀)');
  }

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
