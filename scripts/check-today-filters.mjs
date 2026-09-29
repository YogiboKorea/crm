/**
 * [오늘 온 메일] 카드의 숫자를 누르면 **그 메일만** 보이는지 확인 (대표님 요청 2026-09-29).
 *
 * 무엇을 보나:
 *   1) 숫자 세 개(읽을 메일 · 회신 필요 · 광고·자동발송)가 누를 수 있는 버튼인가
 *   2) 누르면 목록 통수가 **카드의 숫자와 정확히 같은가** — 배지와 목록이 어긋나면 어느 쪽이 맞는지 알 수 없다
 *   3) 목록 위에 무엇으로 좁혔는지 적히고, [해제] 로 되돌아가는가
 *   4) 같은 숫자를 다시 누르면 풀려서 오늘 온 것 전체로 돌아가는가
 *   5) 좁힌 목록의 메일이 실제로 그 조건에 맞는가 (회신 필요 → 전부 '회신 필요' 표시)
 *
 * 읽기만 한다 — 발송·수집 요청은 가로챈다.
 * 사용: CRM_BASE=http://localhost:3100 node scripts/check-today-filters.mjs
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = process.env.CRM_BASE || 'http://localhost:3000';   // 3000 번에 다른 프로젝트가 떠 있을 수 있다
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (user) => new SignJWT({ user, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const waitFor = async (p, fn, arg, ms = 20000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await w(250); }
  return false;
};

// 기대값은 DB 에서 직접 센다 — 화면이 화면을 검사하면 둘 다 틀려도 통과한다
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const accs = await db.collection('mailaccounts')
  .find({ owner: 'david', mergedInto: { $in: [null, ''] } }, { projection: { _id: 1 } }).toArray();
const ids = accs.map((a) => String(a._id));
const NOISE = ['ad', 'system', 'newsletter'];
const start = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
start.setHours(0, 0, 0, 0);
const seoulMidnightUtc = new Date(start.getTime() - 9 * 3600000 + (start.getTimezoneOffset() * -60000));
const base = { accountId: { $in: ids }, trashedAt: null, direction: 'in', date: { $gte: seoulMidnightUtc } };
const M = db.collection('inboundmails');
const expect = {
  total: await M.countDocuments(base),
  noise: await M.countDocuments({ ...base, classification: { $in: NOISE } }),
  reply: await M.countDocuments({ ...base, classification: { $nin: NOISE }, 'analysis.needsReply': true, status: { $in: ['new', 'reviewing'] } }),
};
expect.real = expect.total - expect.noise;
await mongoose.disconnect();
console.log(`DB 기준 — 오늘 ${expect.total}통 · 읽을 메일 ${expect.real} · 회신 필요 ${expect.reply} · 광고·자동발송 ${expect.noise}`);
if (!expect.total) { console.log('오늘 온 메일이 없어 검사를 건너뜁니다'); process.exit(0); }

const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const errs = [];
const asked = [];
try {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    if (/\/api\/mail\/inbox\?/.test(r.url())) asked.push(r.url());
    if (/\/api\/mail\/(send|schedule|campaign|reply|test-send|ingest|backfill|sync-on-login|compose)/.test(r.url()) && r.method() !== 'GET') return r.abort();
    r.continue();
  });
  await p.setViewport({ width: 1500, height: 1000 });
  await p.setCookie({ name: 'admin_session', value: await token('david'), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(3500);

  ok(await waitFor(p, () => !!document.querySelector('.today-stats')), '[오늘 온 메일] 카드가 보임');
  const btns = await p.evaluate(() => [...document.querySelectorAll('.today-stat')]
    .map((el) => ({ key: el.dataset.todayFilter, text: el.innerText.replace(/\n/g, ' ').trim() })));
  console.log('   카드의 버튼:', btns.map((x) => `[${x.key || '전체'}] ${x.text}`).join(' · '));
  ok(btns.some((x) => x.key === 'real'), '읽을 메일 숫자가 버튼임');
  if (expect.reply) ok(btns.some((x) => x.key === 'reply'), '회신 필요 숫자가 버튼임');
  if (expect.noise) ok(btns.some((x) => x.key === 'noise'), '광고·자동발송 숫자가 버튼임');

  const listTotal = () => p.evaluate(() => {
    const t = document.body.innerText.match(/총\s*([\d,]+)\s*통/);
    return t ? Number(t[1].replace(/,/g, '')) : null;
  });
  // data-mail-id 는 줄·체크박스·폴더 태그에 모두 붙어 있다 — 줄만 센다
  const rowsInfo = () => p.evaluate(() => {
    const rows = [...document.querySelectorAll('tr.inbox-row')];
    return { n: rows.length, replyTags: rows.filter((r) => /회신 필요/.test(r.innerText)).length };
  });
  const click = async (key) => {
    await p.evaluate((k) => document.querySelector(`.today-stat[data-today-filter="${k}"]`)?.click(), key);
    await w(2500);
  };

  for (const [key, label] of [['real', '읽을 메일'], ['reply', '회신 필요'], ['noise', '광고·자동발송']]) {
    if (!expect[key === 'real' ? 'real' : key] && key !== 'real') continue;
    console.log(`\n── [${label}] 누르기`);
    const before = asked.length;
    await click(key);
    const url = asked.slice(before).pop() || '';
    const shown = await listTotal();
    const want = expect[key];
    ok(shown === want, `목록 통수 ${shown} = 카드 숫자 ${want}`);
    ok(/today=1/.test(url), `서버에 오늘 조건을 보냄`);
    ok(key === 'reply' ? /needsReply=1/.test(url) : /noise=(0|1)/.test(url), `서버에 ${label} 조건을 보냄 (${url.split('?')[1]?.slice(0, 90)})`);
    ok(await p.evaluate((l) => new RegExp(`${l}만`).test(document.body.innerText), label), `목록 위에 "${label}만" 이라고 적힘`);
    const info = await rowsInfo();
    if (key === 'reply' && info.n) ok(info.replyTags === info.n, `보이는 ${info.n}줄이 전부 회신 필요 표시`);
    // 한 번 더 누르면 풀린다
    await click(key);
    ok((await listTotal()) === expect.total, `같은 숫자를 다시 누르면 오늘 전체(${expect.total}통)로 돌아옴`);
  }

  console.log('\n── [해제] 링크');
  await click('real');
  ok(await p.evaluate(() => !!document.getElementById('inboxTodayFilterClear')), '[해제] 가 보임');
  await p.evaluate(() => document.getElementById('inboxTodayFilterClear')?.click());
  await w(2500);
  ok((await listTotal()) === expect.total, `[해제] 하면 오늘 전체로 돌아옴`);

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
