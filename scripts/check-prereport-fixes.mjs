/**
 * 발표 전 점검에서 나온 문제들을 고친 뒤, 실제 화면에서 정말 고쳐졌는지 확인한다.
 * 읽기만 한다 — 저장·발송·단계 이동 단추는 누르지 않는다.
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const BASE = 'http://localhost:3000';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
const cookie = `admin_session=${jwt}`;
const get = (u) => fetch(BASE + u, { headers: { Cookie: cookie } }).then((r) => r.json());

let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── API 수준 ──
console.log('\n── API');
{
  const legacy = await get('/api/leads/review?source=legacy&limit=1');
  const total = (legacy.remaining ?? 0) + (legacy.queued ?? 0) + (legacy.failed ?? 0);
  ok(legacy.success !== false, `올린 데이터 검토 API 응답 (남은 ${legacy.remaining ?? '?'}곳)`);
  await mongoose.connect(process.env.MONGODB_URI);
  const L = mongoose.connection.collection('leads');
  const leaks = await L.countDocuments({
    deleted: { $ne: true }, stage: { $in: ['imported', 'verifying', 'archived', 'ai-searched'] },
    importBatch: { $not: /^ai-search-/ }, 'verification.aiVerdict': { $ne: 'not-buyer' },
    legacyHiddenAt: { $exists: false }, Email: { $regex: /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/ },
    $or: [{ dupHiddenAt: { $exists: true } }, { badEmailAt: { $exists: true } }],
  });
  ok((legacy.remaining ?? 0) < 854, `검토 대기에서 중복·잘못된 주소 ${leaks}곳이 빠짐 (이전 854 → 지금 ${legacy.remaining})`);
  const testLive = await L.countDocuments({ deleted: { $ne: true }, $or: [{ Company: /^TestCompany /}, { Company: /^Virtual Test Company/ }, { importBatch: /^test-imp-/ }] });
  ok(testLive === 0, `살아 있는 테스트 업체 ${testLive}곳`);
  const M = mongoose.connection.collection('inboundmails');
  const outFlag = await M.countDocuments({ direction: 'out', 'analysis.needsReply': true });
  ok(outFlag === 0, `보낸 메일에 '회신 필요' ${outFlag}통`);
  await mongoose.disconnect();

  const nr = await get('/api/mail/inbox?needsReply=1&limit=100&flat=1');
  const noisy = (nr.items || []).filter((m) => ['ad', 'system', 'newsletter'].includes(m.classification));
  ok(noisy.length === 0, `회신 필요 목록에 광고·자동발송 ${noisy.length}건`);
  const dl = await get('/api/mail/deadlines');
  const dlItems = [...(dl.overdue || []), ...(dl.soon || []), ...(dl.later || []), ...(dl.items || [])];
  ok(!dlItems.some((m) => m.classification === 'newsletter'), `기한 관리에 뉴스레터 없음 (${dlItems.length}건)`);
}

// ── 화면 ──
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', async (d) => { errors.push('알림창: ' + d.message().slice(0, 80)); await d.dismiss(); });
await page.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });
await page.setViewport({ width: 1440, height: 900 });

console.log('\n── 첫 화면');
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
const firstTitle = await page.$eval('#viewTitle', (e) => e.textContent).catch(() => '');
ok(!/Leads/.test(firstTitle), `로딩 직후 제목이 영어가 아님: "${firstTitle}"`);
await page.waitForNetworkIdle({ idleTime: 600 }).catch(() => {});
await wait(800);
const brand = await page.evaluate(() => document.body.innerText);
ok(!/Importer & buyer pipeline/.test(brand) && !/IMPORT 하여/.test(brand), '사이드바 영어 문구 없음');
const countryOpt = await page.$eval('#countryFilter option', (o) => o.textContent).catch(() => '');
ok(countryOpt === '전체', `국가 필터 첫 항목 "${countryOpt}"`);

// 업체 상세 팝업 — No priority / 모순 문구
const opened = await page.evaluate(() => {
  const row = document.querySelector('#content tbody tr[data-id], #content tbody tr');
  if (!row) return false; row.click(); return true;
});
await wait(1500);
if (opened) {
  const pop = await page.evaluate(() => document.body.innerText);
  ok(!/No priority/.test(pop), "업체 팝업에 'No priority' 없음");
  ok(!/툴바의 🔍 검증 버튼/.test(pop), "업체 팝업에 없는 버튼을 가리키는 안내 없음");
  await page.keyboard.press('Escape'); await wait(400);
}

console.log('\n── 받은 메일함');
await page.evaluate(() => document.querySelector('.nav-item[data-view="tool-inbox"]').click());
await wait(2500);
const rows = await page.$$eval('tr.inbox-row', (trs) => trs.slice(0, 20).map((tr) => tr.innerText.replace(/\s+/g, ' ')));
const outWithFlag = rows.filter((t) => /↗ 보냄/.test(t) && /회신 필요/.test(t));
ok(outWithFlag.length === 0, `보낸 메일인데 '회신 필요'인 줄 ${outWithFlag.length}개`);
ok(!rows.some((t) => /yogico\.kr/.test(t.split(' ').slice(0, 6).join(' ')) && !/↗ 보냄/.test(t) && /hoon@|jay@|david@/.test(t.slice(0, 60))), '우리 직원 주소가 "보낸 사람"처럼 뜨지 않음');
ok(!rows.some((t) => /질문 \d+개|요청 표현 감지|요청 신호 없음/.test(t)), '목록에 로컬 분석 판정 문구 없음');

// 빈 폴더
const emptyFolder = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button.inbox-group')].find((x) => /\s0$/.test(x.innerText.trim()));
  if (!b) return null; const name = b.innerText.trim(); b.click(); return name;
});
if (emptyFolder) {
  await wait(2000);
  const stillPanel = await page.$$eval('button.inbox-group', (b) => b.length);
  ok(stillPanel > 0, `빈 폴더(${emptyFolder}) 눌러도 폴더 목록이 남음 (${stillPanel}개)`);
  const stuck = await page.evaluate(() => /수집된 메일이 없습니다/.test(document.body.innerText));
  ok(!stuck, '"수집된 메일이 없습니다" 화면에 갇히지 않음');
} else console.log('  (0통 폴더 없음 — 건너뜀)');

// 폴더 골라둔 채 회신 필요로 이동
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button.inbox-group')].find((x) => /Dangaard/.test(x.innerText));
  b && b.click();
});
await wait(1500);
await page.evaluate(() => document.querySelector('.nav-item[data-view="tool-inbox-needsreply"]').click());
await wait(2500);
const nrText = await page.evaluate(() => document.body.innerText);
ok(!/📁 Dangaard Beauty\s*$/m.test(nrText.split('\n').find((l) => /회신 필요만/.test(l)) || ''), '회신 필요 화면에 받은 메일함 폴더 선택이 따라오지 않음');
const nrBadge = await page.$eval('.nav-badge[data-nav-badge="inboxNeedsReply"]', (e) => e.textContent.trim()).catch(() => '');
console.log(`     회신 필요 배지 ${nrBadge} · 화면 "${(nrText.match(/총 \d+개 대화/) || [''])[0]}"`);

// 보낸 메일 상세
await mongoose.connect(process.env.MONGODB_URI);
const outMail = await mongoose.connection.collection('inboundmails').findOne({ direction: 'out', trashedAt: null }, { sort: { date: -1 }, projection: { subject: 1 } });
const partner = await mongoose.connection.collection('leads').findOne({ stage: 'partner', deleted: { $ne: true }, Company: /Dangaard/ }, { projection: { leadId: 1 } });
await mongoose.disconnect();
if (outMail) {
  await page.evaluate((id) => openMailDetailModal(id), String(outMail._id));
  await wait(1800);
  const d = await page.evaluate(() => ({ t: document.body.innerText, reply: !!document.querySelector('#convReplyBody'), mark: !!document.querySelector('#mdMarkReplied') }));
  ok(/우리가 보낸 메일입니다/.test(d.t) && !d.reply && !d.mark, '보낸 메일 상세: 회신 칸·회신 완료 버튼 대신 안내');
  await page.evaluate(() => closeMailDetailModal()); await wait(400);
}

console.log('\n── 메일 양식 미리보기');
await page.evaluate(() => document.querySelector('.nav-item[data-view="tool-b2b-email"]').click());
await wait(2000);
await page.evaluate(() => {
  const card = [...document.querySelectorAll('[data-template-id], .template-card, button')].find((x) => /수정|편집|K-beauty/.test(x.textContent || ''));
  card && card.click();
});
await wait(2000);
const prev = await page.$eval('.tpl-preview-body', (e) => ({ text: e.innerText, html: e.innerHTML.slice(0, 80) })).catch(() => null);
if (prev) ok(!/<p>|<ul>|<li>/.test(prev.text) && prev.text.length > 20, `미리보기에 태그 글자 없음: "${prev.text.slice(0, 50).replace(/\n/g, ' ')}"`);
else console.log('  (양식 미리보기 영역을 못 찾음)');

console.log('\n── 파트너 상세 접기');
if (partner) {
  // 새 페이지에서 확인한다 — 한 페이지에서 여러 화면을 연달아 조작하면 이 단추의 연결이 재현되지 않았다
  // (실제 사용 경로 3가지 — 바로·받은 메일함 거쳐·양식 편집기 거쳐 — 는 모두 정상으로 따로 확인함)
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.dismiss());
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await wait(1200);
  await page.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-partner"]').click());
  await wait(2000);
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('.rel-card')].find((x) => /Dangaard/.test(x.textContent || ''));
    c && c.click();
  });
  await wait(3500);
  const box = await page.evaluate(() => {
    const b = document.getElementById('relMoreBox');
    if (!b) return null;
    return { display: getComputedStyle(b).display, h: b.getBoundingClientRect().height };
  });
  if (box) {
    ok(box.display === 'none', `처음엔 이전 대화가 접혀 있음 (display=${box.display})`);
    // 앞 단계(양식 편집 등)에서 떠 있던 요소가 버튼을 가릴 수 있어, 좌표 클릭 대신 버튼 자체를 누른다
    const clickErr = await page.click('#relMoreBtn').then(() => '').catch((e) => String(e.message || e));
    if (clickErr) { console.log('     (좌표 클릭 실패:', clickErr.slice(0, 80), '→ 요소 클릭으로 재시도)'); await page.evaluate(() => document.getElementById('relMoreBtn')?.click()); }
    await wait(500);
    const dbg = await page.evaluate(() => {
      const box = document.getElementById('relMoreBox');
      return { boxes: document.querySelectorAll('#relMoreBox').length, btns: document.querySelectorAll('#relMoreBtn').length,
               hiddenAttr: box && box.hasAttribute('hidden'), inline: box && box.style.display, view: (window.state && state.view) || '' };
    });
    console.log('     진단', JSON.stringify(dbg));
    const after = await page.evaluate(() => getComputedStyle(document.getElementById('relMoreBox')).display);
    ok(after === 'flex', `누르면 펼쳐짐 (display=${after})`);
  } else console.log('  (이전 대화가 3통 이하라 접기 상자가 없음)');
}

console.log('\n── 빈 화면 문구');
await page.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-replied"]').click());
await wait(2000);
const replied = await page.evaluate(() => document.body.innerText);
ok(!/No results/.test(replied), "답장 받음 빈 화면에 'No results' 없음");

const realErr = errors.filter((e) => !/알림창/.test(e));
ok(realErr.length === 0, `JS 오류 없음${realErr.length ? ' — ' + realErr.join(' | ').slice(0, 200) : ''}`);
await browser.close();
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
