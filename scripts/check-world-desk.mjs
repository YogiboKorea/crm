/**
 * 🌏 시차·환율 화면 확인 (2026-11-23) — 클라이언트가 받은 World Desk 를 CRM 안으로 옮긴 뒤.
 *
 *   1) 사이드바 [시차·환율] — 대표님·전무님 아이디 모두에서 보이고 아이콘이 불러와지는가
 *   2) 시차 — 서머타임 여름/겨울 · 전환 때 없는 시간 · 두 번 오는 시간 · 45분 단위 시간대 · 도시 바꾸기
 *   3) 환율 — Coinbase 실제 조회 · 금액 검사 · 통화 바꾸기 · 조회 실패 안내 (요청을 막아서)
 *   4) 세계 시계 — 추가·빼기 · 새로고침해도 기억 · 화면을 떠나면 1초 타이머가 멈추는가
 *   5) 밝은/어두운 화면 · 휴대폰 폭에서 가로로 넘치지 않는가 (SHOT 을 주면 찍어 둔다)
 *
 * 메일은 보내지 않는다 (발송 API 는 막아 둠). 환율 조회는 Coinbase 공개 API 를 실제로 부른다.
 * 사용: CRM_BASE=http://localhost:3000 [SHOT=경로.png] node scripts/check-world-desk.mjs
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
const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const token = (user) => new SignJWT({ user, role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
let blockFx = false;

async function open(user) {
  const p = await b.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(String(e)));
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = r.url();
    if (/\/api\/cron\//.test(u) || (/\/api\/mail\/(send|schedule|campaign|reply|test-send|compose)/.test(u) && r.method() !== 'GET')) return r.abort();
    if (blockFx && u.startsWith('https://api.coinbase.com/')) return r.abort();
    // 로그인 메일 수집은 막는다 — 비밀번호가 틀린 메일함(전무님 11/13~)이면 열 때마다 메일 서버에 실패 로그인이 쌓인다
    if (/\/api\/mail\/sync-on-login/.test(u)) return r.respond({ status: 200, contentType: 'application/json', body: '{"success":true,"ran":false,"skipped":"test"}' });
    r.continue();
  });
  await p.setCookie({ name: 'admin_session', value: await token(user), domain: new URL(B).hostname, path: '/' });
  await p.setViewport({ width: 1440, height: 1100 });
  await p.goto(B + '/', { waitUntil: 'networkidle2' });
  await w(1200);
  return p;
}
const goDesk = async (p) => {
  // 마우스 좌표로 누르지 않는다 — 휴대폰 폭에서는 사이드바가 화면 밖 서랍이라 빗나간다
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-world-desk"]').click());
  await p.waitForSelector('#wdSeoulNow', { timeout: 10000 });
  await w(300);
};
// 기준 도시 · 비교 도시 · 날짜를 넣고 결과를 읽는다
const setTime = (p, from, to, local) => p.evaluate((from, to, local) => {
  const $ = (id) => document.getElementById(id);
  $('wdFromZone').value = from; $('wdFromZone').dispatchEvent(new Event('change'));
  $('wdToZone').value = to; $('wdToZone').dispatchEvent(new Event('change'));
  $('wdLocalDate').value = local; $('wdLocalDate').dispatchEvent(new Event('input'));
}, from, to, local);
const readTime = (p) => p.evaluate(() => {
  const t = (id) => document.getElementById(id).textContent.trim();
  return {
    time: t('wdResultTime'), date: t('wdResultDate'), day: t('wdDayBadge'), diff: t('wdDifference'), off: t('wdResultOffset'),
    shown: !document.getElementById('wdTimeResult').hidden,
    alert: document.getElementById('wdTimeAlert').hidden ? '' : t('wdTimeAlert'),
    fold: !document.getElementById('wdFold').hidden,
    occ: [...document.getElementById('wdOccurrence').options].map((o) => o.text),
  };
});

try {
  // ── 1) 메뉴 ──
  for (const user of ['david', 'hoon']) {
    const p = await open(user);
    const nav = await p.evaluate(() => {
      const btn = document.querySelector('.nav-item[data-view="tool-world-desk"]');
      const img = btn?.querySelector('img');
      const ai = document.getElementById('navAiChat');
      return {
        visible: !!btn && btn.offsetParent !== null,
        loaded: !!img && img.complete && img.naturalWidth > 0,
        size: img ? Math.round(img.getBoundingClientRect().width) : 0,
        afterAi: !!ai && ai.nextElementSibling === btn,
      };
    });
    ok(nav.visible && nav.loaded && nav.size === 18, `${user} — 사이드바 [시차·환율] 보임 · 아이콘 ${nav.size}px`);
    if (user === 'david') ok(nav.afterAi, 'AI 메일 비서 바로 아래 자리');
    await p.close();
  }

  const p = await open('david');
  await p.evaluate(() => { try { localStorage.removeItem('worlddesk.settings.v1'); localStorage.removeItem('worlddesk.rates.v1'); } catch {} });
  await goDesk(p);
  const title = await p.evaluate(() => document.getElementById('viewTitle')?.textContent || document.querySelector('.view-title, h1, h2')?.textContent || '');
  ok(/시차·환율/.test(title), `화면 제목 — ${title.trim()}`);
  const s1 = await p.$eval('#wdSeoulNow', (e) => e.textContent);
  await w(1300);
  const s2 = await p.$eval('#wdSeoulNow', (e) => e.textContent);
  ok(/^\d\d:\d\d:\d\d$/.test(s2) && s1 !== s2, `서울 시계가 1초마다 간다 (${s1} → ${s2})`);

  // ── 2) 시차 ──
  await setTime(p, 'Asia/Seoul', 'America/New_York', '2026-07-01T10:00');
  let r = await readTime(p);
  ok(r.time === '21:00' && r.day === '전날' && /13시간 느림/.test(r.diff) && /UTC−04:00 · 서머타임/.test(r.off),
    `여름 서울 7/1 10:00 → 뉴욕 ${r.time} (${r.date}) · ${r.day} · ${r.diff} · ${r.off}`);
  await setTime(p, 'Asia/Seoul', 'America/New_York', '2026-12-01T10:00');
  r = await readTime(p);
  ok(r.time === '20:00' && /14시간 느림/.test(r.diff) && r.off === 'UTC−05:00', `겨울 서울 12/1 10:00 → 뉴욕 ${r.time} · ${r.diff} · ${r.off}`);
  // 영국은 3/29 01:00 UTC(서울 10:00)에 서머타임 시작 — 같은 날 전환 앞뒤
  await setTime(p, 'Asia/Seoul', 'Europe/London', '2026-03-29T09:30');
  r = await readTime(p);
  ok(r.time === '00:30' && r.off === 'UTC+00:00', `영국 전환 직전 서울 3/29 09:30 → 런던 ${r.time} · ${r.off}`);
  await setTime(p, 'Asia/Seoul', 'Europe/London', '2026-03-29T11:00');
  r = await readTime(p);
  ok(r.time === '03:00' && /UTC\+01:00 · 서머타임/.test(r.off), `영국 전환 직후 서울 3/29 11:00 → 런던 ${r.time} · ${r.off}`);
  await setTime(p, 'America/New_York', 'Asia/Seoul', '2026-03-08T02:30');
  r = await readTime(p);
  ok(!r.shown && /없는 시간/.test(r.alert), `뉴욕 3/8 02:30 (서머타임 시작으로 건너뛴 시간) — "${r.alert.slice(0, 30)}…"`);
  await setTime(p, 'America/New_York', 'Asia/Seoul', '2026-11-01T01:30');
  r = await readTime(p);
  ok(r.fold && /UTC−04:00/.test(r.occ[0]) && /UTC−05:00/.test(r.occ[1]) && r.time === '14:30', `뉴욕 11/1 01:30 (두 번 오는 시간) 첫 번째 → 서울 ${r.time} · 고르기: ${r.occ.join(' / ')}`);
  await p.evaluate(() => { const s = document.getElementById('wdOccurrence'); s.value = '1'; s.dispatchEvent(new Event('change')); });
  r = await readTime(p);
  ok(r.time === '15:30', `두 번째 시간 고르면 → 서울 ${r.time}`);
  await setTime(p, 'Asia/Seoul', 'Asia/Kathmandu', '2026-07-01T10:00');
  r = await readTime(p);
  ok(r.time === '06:45' && /3시간 15분 느림/.test(r.diff) && r.off === 'UTC+05:45', `45분 단위 — 서울 10:00 → 카트만두 ${r.time} · ${r.diff}`);
  await setTime(p, 'Asia/Seoul', 'America/Los_Angeles', '2026-07-01T10:00');
  await p.click('#wdSwapZones');
  const sw = await p.evaluate(() => ({ from: document.getElementById('wdFromZone').value, local: document.getElementById('wdLocalDate').value, to: document.getElementById('wdResultTime').textContent }));
  ok(sw.from === 'America/Los_Angeles' && sw.local === '2026-06-30T18:00' && sw.to === '10:00', `도시 바꾸기 — 같은 순간 유지 (LA ${sw.local.slice(11)} → 서울 ${sw.to})`);
  const tl = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#wdTimeline > div')];
    return { rows: rows.length, cells: rows.map((r) => r.lastElementChild.childElementCount), work: document.querySelectorAll('#wdTimeline span[style*="brand-soft"]').length };
  });
  ok(tl.rows === 2 && tl.cells.every((n) => n === 24) && tl.work > 0, `하루 비교 막대 — ${tl.rows}줄 × ${tl.cells.join('/')}칸 · 업무 시간 ${tl.work}칸`);
  await p.click('#wdUseNow');
  const live = await p.$eval('#wdTimeMode', (e) => e.textContent);
  ok(/현재 시간/.test(live), `[현재 시간 사용] → ${live}`);

  // ── 3) 환율 ──
  await p.waitForFunction(() => /자동 조회 중|연결 확인/.test(document.getElementById('wdFxBadge').textContent), { timeout: 15000 });
  const fx = await p.evaluate(() => ({
    badge: document.getElementById('wdFxBadge').textContent,
    conv: document.getElementById('wdConverted').textContent,
    unit: document.getElementById('wdUnitRate').textContent,
    quick: [...document.querySelectorAll('#wdRateList > div')].map((d) => d.textContent),
    status: document.getElementById('wdFxStatus').textContent,
    saved: (() => { try { return !!JSON.parse(localStorage.getItem('worlddesk.rates.v1'))?.rates?.KRW; } catch { return false; } })(),
  }));
  const krw = Number(fx.conv.replaceAll(',', ''));
  ok(fx.badge === '자동 조회 중' && krw > 900000 && krw < 2500000, `Coinbase 조회 — 1,000 USD = ${fx.conv} KRW · ${fx.unit}`);
  ok(fx.quick.length === 3 && fx.quick.every((t) => /원$/.test(t)), `주요 통화 — ${fx.quick.join(' · ')}`);
  ok(fx.saved && /마지막 성공 조회/.test(fx.status), `조회값 저장 · ${fx.status}`);
  const amt = async (v) => p.evaluate((v) => { const a = document.getElementById('wdAmount'); a.value = v; a.dispatchEvent(new Event('input')); return { err: !document.getElementById('wdAmountError').hidden, conv: document.getElementById('wdConverted').textContent }; }, v);
  let a = await amt('12abc');
  ok(a.err && a.conv === '—', '잘못된 금액 → 안내 표시');
  a = await amt('1,234.56');
  ok(!a.err && a.conv !== '—', `1,234.56 USD → ${a.conv} KRW`);
  await p.click('#wdSwapCur');
  const sc = await p.evaluate(() => ({ code: document.getElementById('wdAmountCode').textContent, target: document.getElementById('wdTargetCode').textContent, conv: document.getElementById('wdConverted').textContent }));
  ok(sc.code === 'KRW' && sc.target === 'USD', `통화 바꾸기 — 1,234.56 KRW → ${sc.conv} USD`);

  // ── 4) 세계 시계 ──
  const clocks = () => p.$$eval('#wdClocks [data-zone]', (cs) => cs.map((c) => c.dataset.zone));
  ok((await clocks()).length === 4, `기본 세계 시계 — ${(await clocks()).join(', ')}`);
  await p.evaluate(() => { const s = document.getElementById('wdAddCity'); s.value = 'Europe/Copenhagen'; });
  await p.click('#wdAddClock');
  await p.click('#wdClocks [data-zone="Australia/Sydney"] .wd-remove');
  const after = await clocks();
  ok(after.includes('Europe/Copenhagen') && !after.includes('Australia/Sydney') && after.length === 4, `코펜하겐 추가 · 시드니 빼기 → ${after.join(', ')}`);
  const cardTime = await p.$eval('#wdClocks [data-zone="Europe/Copenhagen"] .wd-clock-time', (e) => e.textContent);
  ok(/^\d\d:\d\d:\d\d$/.test(cardTime), `코펜하겐 시계 ${cardTime}`);

  // 새로고침해도 고른 것이 남는가
  await p.reload({ waitUntil: 'networkidle2' });
  await w(1200);
  await goDesk(p);
  const kept = await p.evaluate(() => ({ clocks: [...document.querySelectorAll('#wdClocks [data-zone]')].map((c) => c.dataset.zone), from: document.getElementById('wdFromZone').value, cur: document.getElementById('wdFromCur').value }));
  ok(kept.clocks.includes('Europe/Copenhagen') && kept.from === 'America/Los_Angeles' && kept.cur === 'KRW', `새로고침 뒤에도 기억 — 기준 ${kept.from} · ${kept.cur} · 시계 ${kept.clocks.length}개`);

  await p.click('#wdSwapCur');
  await setTime(p, 'Asia/Seoul', 'America/New_York', '2026-11-24T10:00');
  if (SHOT) {
    await p.waitForFunction(() => document.getElementById('wdConverted').textContent !== '—', { timeout: 15000 }).catch(() => {});
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: SHOT.replace(/\.png$/, '-light.png'), fullPage: true });
    await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await w(300);
    await p.screenshot({ path: SHOT.replace(/\.png$/, '-dark.png'), fullPage: true });
    await p.evaluate(() => { document.documentElement.dataset.theme = ''; });
  }

  // 화면을 떠나면 1초 타이머가 멈춘다
  await p.click('.nav-item[data-view="tool-updates"]');
  await w(1500);
  const stopped = await p.evaluate(() => _wd.timer === null && !document.getElementById('wdSeoulNow'));
  ok(stopped, '다른 화면으로 가면 시계 타이머 멈춤');
  const upd = await p.evaluate(() => document.getElementById('content')?.innerText || document.body.innerText);
  ok(/시차·환율 — 해외 업체 일정·견적 계산을 CRM 안에서/.test(upd), '최근 업데이트 맨 위에 기록됨');

  // 휴대폰 폭 — 다시 들어왔을 때 직접 넣은 시간이 그대로인지도
  await p.setViewport({ width: 390, height: 844 });
  await goDesk(p);
  r = await readTime(p);
  const back = await p.$eval('#wdLocalDate', (e) => e.value);
  ok(back === '2026-11-24T10:00' && r.shown && !r.alert && r.time === '20:00', `다른 화면에 다녀와도 넣은 시간 유지 — ${back} → 뉴욕 ${r.time}`);
  const over = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, cols: getComputedStyle(document.querySelector('.wd-grid')).gridTemplateColumns.split(' ').length }));
  ok(over.cols === 1 && over.sw <= over.iw + 1, `휴대폰 폭 — 한 줄 배치 · 가로 넘침 없음 (${over.sw}/${over.iw})`);
  if (SHOT) await p.screenshot({ path: SHOT.replace(/\.png$/, '-mobile.png'), fullPage: true });
  ok(!p.errs.length, `화면 오류 없음${p.errs.length ? ` — ${p.errs.join(' / ')}` : ''}`);
  await p.close();

  // ── 조회 실패 — 저장값 없이 Coinbase 를 막으면 ──
  blockFx = true;
  const q = await open('hoon');
  await q.evaluate(() => { try { localStorage.removeItem('worlddesk.rates.v1'); } catch {} });
  await goDesk(q);
  await q.waitForFunction(() => /연결 확인/.test(document.getElementById('wdFxBadge').textContent), { timeout: 15000 });
  const f = await q.evaluate(() => ({ status: document.getElementById('wdFxStatus').textContent, conv: document.getElementById('wdConverted').textContent }));
  ok(f.conv === '—' && /불러오지 못했습니다/.test(f.status), `조회 실패 안내 — ${f.status}`);
  ok(!q.errs.length, `화면 오류 없음${q.errs.length ? ` — ${q.errs.join(' / ')}` : ''}`);
  await q.close();
} catch (e) {
  fail++;
  console.log('  X   ' + (e?.stack || e));
} finally {
  await b.close();
}
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
