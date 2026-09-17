/**
 * [✏ 새 메일 쓰기] 확인 (2026-09-17) — **메일은 한 통도 보내지 않는다.**
 *
 * 서버:
 *   1) 미리보기가 실제 발송과 같은 보내는 사람·제목·본문·서명을 돌려주는가
 *   2) 받는 주소가 등록된 업체면 알려주는가 (보낸 뒤 그 업체 대화에 기록되므로)
 *   3) 주소·제목·본문이 비었거나 형식이 틀리면 막는가
 *   4) 남의 계정으로는 못 보내는가
 *   5) 미리보기를 눌러도 DB 가 바뀌지 않는가
 * 화면:
 *   6) 받은 메일함 맨 위에 버튼이 있고, 창이 열리는가
 *   7) 업체 이름으로 주소를 찾아 넣을 수 있는가
 *   8) 서명 체크가 본문 아래 미리보기와 연결되는가
 *   9) [👁 미리보기] → 실제로 나갈 모습이 뜨는가
 *  10) [보내기] 는 확인 창을 거치는가 (여기서는 취소한다 — 실제 발송 금지)
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = 'http://localhost:3000';
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (u = 'david') => new SignJWT({ user: u, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('2h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const api = async (user, path, body) => {
  const res = await fetch(`${B}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `admin_session=${await token(user)}` },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 본문 없음 */ }
  return { status: res.status, json };
};
const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const waitFor = async (p, fn, ms = 15000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); }
  return false;
};

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const acct = await db.collection('mailaccounts').findOne({ smtpUser: /^david@yogico\.kr$/i }, { projection: { _id: 1, fromName: 1, senderCompany: 1 } });
const feAcct = await db.collection('mailaccounts').findOne({ owner: 'fe' }, { projection: { _id: 1, smtpUser: 1 } });
// 등록된 업체 하나 — 미리보기가 업체를 알아보는지 확인용
const lead = await db.collection('leads').findOne(
  { deleted: { $ne: true }, Email: { $regex: /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/ }, Company: { $nin: ['', null] } },
  { projection: { Company: 1, Email: 1, emailHistory: 1, leadId: 1 } },
);
const snap = async () => JSON.stringify({
  mails: await db.collection('inboundmails').countDocuments({}),
  hist: (await db.collection('leads').findOne({ leadId: lead.leadId }, { projection: { emailHistory: 1 } }))?.emailHistory?.length || 0,
});
const before = await snap();
console.log(`검사용 업체: ${lead.Company} <${lead.Email}>`);

// ── 서버 ──
console.log('\n── 서버: /api/mail/compose/preview');
const BODY = '<div>안녕하세요.</div><div>요청하신 <b>가격표</b>를 보내드립니다.</div>';
const r1 = await api('david', '/api/mail/compose/preview', { to: lead.Email, subject: '[Yogico] 가격표 전달', body: BODY, bodyIsHtml: true, appendSignature: true });
ok(r1.status === 200 && r1.json?.success, `미리보기 응답 (HTTP ${r1.status})`);
const pv = r1.json?.preview || {};
ok(pv.to === lead.Email, `받는 사람 (${pv.to})`);
ok(pv.subject === '[Yogico] 가격표 전달', `제목 그대로 (${pv.subject})`);
ok(/@/.test(pv.from?.address || ''), `보내는 사람 (${pv.from?.name} <${pv.from?.address}>)`);
ok(strip(pv.html).includes('가격표'), '본문 글자가 들어 있음');
ok(/<b>가격표<\/b>/.test(pv.html), '서식(굵게)이 살아 있음');
ok(pv.signatureAppended === true && strip(pv.html).includes(String(acct?.fromName || '').trim()), `서명이 붙음 (${acct?.fromName})`);
ok(pv.isNew === true, '새 메일로 표시됨 (답장 아님)');
ok(pv.lead?.company === lead.Company, `등록된 업체를 알아봄 (${pv.lead?.company})`);
ok(/font-family:sans-serif;font-size:14px;line-height:1\.6/.test(pv.html), '실제 발송과 같은 본문 감싸기');

const r2 = await api('david', '/api/mail/compose/preview', { to: lead.Email, subject: 'x', body: BODY, bodyIsHtml: true, appendSignature: false });
ok(r2.json?.preview?.signatureAppended === false, '서명 끄면 서명 없이 조립');

const r3 = await api('david', '/api/mail/compose/preview', { to: 'not-an-email', subject: 'x', body: 'y' });
ok(r3.status === 400 && /주소가 올바르지/.test(r3.json?.error || ''), `주소 형식이 틀리면 막음 (${r3.json?.error})`);
const r4 = await api('david', '/api/mail/compose/preview', { to: lead.Email, subject: '', body: 'y' });
ok(r4.status === 400 && /제목/.test(r4.json?.error || ''), `제목이 없으면 막음 (${r4.json?.error})`);
const r5 = await api('david', '/api/mail/compose/preview', { to: lead.Email, subject: 'x', body: '   ' });
ok(r5.status === 400 && /본문/.test(r5.json?.error || ''), `본문이 비면 막음 (${r5.json?.error})`);

if (feAcct) {
  const r6 = await api('david', '/api/mail/compose/preview', { to: lead.Email, subject: 'x', body: 'y', mailAccountId: String(feAcct._id) });
  ok(r6.status === 400, `남의 계정(${feAcct.smtpUser}, fe 소유)으로는 못 보냄 (HTTP ${r6.status})`);
}

const r7 = await api('david', '/api/mail/compose/preview', { to: 'nobody@example.invalid', subject: 'x', body: 'y' });
ok(r7.json?.preview?.lead === null, '등록 안 된 주소는 업체 없음으로 표시');

ok((await snap()) === before, '미리보기를 여러 번 해도 DB 가 그대로');

// ── 화면 ──
console.log('\n── 화면: 받은 메일함 [✏ 새 메일 쓰기]');
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const errs = [];
const sendAttempts = [];
try {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  // 확인 창은 **취소**한다 — 실제로 메일이 나가면 안 된다
  const dialogs = [];
  p.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = r.url();
    if (r.method() === 'POST' && /\/api\/mail\/compose$/.test(u.split('?')[0])) { sendAttempts.push(r.postData() || ''); return r.abort(); }
    if (r.method() === 'POST' && /\/api\/mail\/(send|schedule|campaign|reply|test-send|backfill|ingest)/.test(u)) return r.abort();
    return r.continue();
  });
  await p.setViewport({ width: 1400, height: 1000 });
  await p.setCookie({ name: 'admin_session', value: await token('david'), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(4000);

  ok(await p.evaluate(() => !!document.getElementById('inboxComposeBtn')), '받은 메일함에 [✏ 새 메일 쓰기] 버튼이 있음');
  const pos = await p.evaluate(() => {
    const btn = document.getElementById('inboxComposeBtn');
    const list = document.querySelector('.table-wrap');
    if (!btn) return null;
    return { top: Math.round(btn.getBoundingClientRect().top), aboveList: !list || btn.getBoundingClientRect().top < list.getBoundingClientRect().top };
  });
  ok(pos?.aboveList === true, '목록보다 **위쪽**에 있음');

  await p.evaluate(() => document.getElementById('inboxComposeBtn').click());
  ok(await waitFor(p, () => !!document.getElementById('composeMailModal')), '작성 창이 열림');
  await w(900);
  const box = await p.evaluate(() => ({
    account: !!document.getElementById('cmAccount'),
    accountCount: document.getElementById('cmAccount')?.options.length || 0,
    to: !!document.getElementById('cmTo'),
    subject: !!document.getElementById('cmSubject'),
    body: !!document.getElementById('cmBody'),
    sig: document.getElementById('cmSig')?.checked,
    sigText: document.getElementById('cmSigBody')?.innerText.trim().slice(0, 60) || '',
    sigBelowBody: (() => {
      const bd = document.getElementById('cmBody'); const sg = document.getElementById('cmSigPreview');
      return !!bd && !!sg && sg.getBoundingClientRect().top >= bd.getBoundingClientRect().bottom - 1;
    })(),
  }));
  ok(box.account && box.to && box.subject && box.body, '보내는 계정 · 받는 사람 · 제목 · 본문 칸이 있음');
  ok(box.accountCount >= 1, `보내는 계정을 고를 수 있음 (${box.accountCount}개)`);
  ok(box.sig === true, '서명 붙이기가 기본으로 켜져 있음');
  ok(box.sigBelowBody === true, '서명이 본문 칸 **맨 아래**에 보임');
  ok(box.sigText.includes(String(acct?.fromName || '@@').trim()), `서명 내용이 실제 계정 것 (${box.sigText.split('\n')[0]})`);

  // 업체 이름으로 주소 찾기
  const nameHint = String(lead.Company).slice(0, 4);
  await p.evaluate((q) => {
    const el = document.getElementById('cmTo');
    el.value = q;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, nameHint);
  const found = await waitFor(p, () => !!document.querySelector('#cmSuggest .cm-pick'), 12000);
  ok(found, `업체 이름("${nameHint}")으로 찾기 결과가 뜸`);
  if (found) {
    await p.evaluate(() => document.querySelector('#cmSuggest .cm-pick').click());
    await w(400);
    ok(await p.evaluate(() => /@/.test(document.getElementById('cmTo').value)), `고르면 주소가 채워짐 (${await p.evaluate(() => document.getElementById('cmTo').value)})`);
  }

  // 서명 끄기
  await p.evaluate(() => { const c = document.getElementById('cmSig'); c.checked = false; c.dispatchEvent(new Event('change')); });
  ok(await p.evaluate(() => document.getElementById('cmSigPreview').hidden), '서명을 끄면 미리보기가 사라짐');
  await p.evaluate(() => { const c = document.getElementById('cmSig'); c.checked = true; c.dispatchEvent(new Event('change')); });

  // 내용 없이 미리보기 → 안내만
  await p.evaluate(() => document.getElementById('cmPreview').click());
  await w(700);
  ok(/제목을 입력하세요|내용을 입력하세요|받는 사람/.test(await p.evaluate(() => document.getElementById('cmMsg').innerText)), '빈 칸이면 안내만 뜨고 아무것도 안 나감');

  // 채우고 미리보기
  await p.evaluate(() => {
    document.getElementById('cmSubject').value = '[Yogico] 가격표 전달';
    document.getElementById('cmBody').innerHTML = '안녕하세요.<br><br>요청하신 <b>가격표</b>를 보내드립니다.<br><br>감사합니다.';
  });
  await p.evaluate(() => document.getElementById('cmPreview').click());
  ok(await waitFor(p, () => !!document.getElementById('replyPreviewModal'), 15000), '미리보기 창이 뜸');
  await w(900);
  const shown = await p.evaluate(() => {
    const root = document.getElementById('replyPreviewModal');
    const fr = root?.querySelector('[data-rp-frame]');
    return { head: root?.innerText || '', body: fr?.contentDocument?.body?.innerText || '' };
  });
  ok(/새 메일 미리보기/.test(shown.head), '"새 메일 미리보기" 로 표시됨');
  ok(/아직 보내지 않았습니다/.test(shown.head), '"아직 보내지 않았습니다" 표시');
  ok(!/대화 연결/.test(shown.head), '답장용 [대화 연결] 줄은 안 나옴');
  ok(/업체/.test(shown.head), '업체 연결 여부를 알려 줌');
  ok(/가격표/.test(shown.body) && shown.body.includes(String(acct?.fromName || '@@').trim()), '본문 + 서명이 함께 보임');
  await p.evaluate(() => document.querySelector('#replyPreviewModal [data-rp-close]')?.click());
  await w(500);

  // 보내기 → 확인 창에서 취소
  await p.evaluate(() => document.getElementById('cmSend').click());
  await w(1200);
  ok(dialogs.some((d) => /이 주소로 지금 메일을 보냅니다/.test(d)), '보내기 전에 받는 사람을 확인하는 창이 뜸');
  ok(sendAttempts.length === 0, '확인 창에서 [취소] 하면 아무것도 나가지 않음');
  ok(await p.evaluate(() => !!document.getElementById('composeMailModal')), '취소하면 작성 창이 그대로 남음');

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
}

ok((await snap()) === before, '검사를 끝낸 뒤에도 DB 그대로 (나간 메일 없음)');
await mongoose.disconnect();
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
