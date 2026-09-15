/**
 * 답장 [👁 미리보기] 확인 (2026-09-15) — **메일은 한 통도 보내지 않는다.**
 *
 * 서버:
 *   1) 미리보기가 실제 발송과 같은 받는 사람·제목·서명·본문을 돌려주는가
 *   2) 서명 끄기·평문 본문도 발송 규칙대로 조립되는가
 *   3) 미리보기를 눌러도 DB 가 바뀌지 않는가 ([답변 완료]·발송 이력·단계가 그대로)
 *   4) 남의 메일은 미리보기도 막히는가 (404)
 *   5) 조립을 함수로 옮긴 뒤에도 실제 답장 경로의 입력 검사가 그대로인가
 * 화면:
 *   6) [👁 미리보기] 버튼 → 창에 보내는 사람·받는 사람·제목·본문·서명이 보이는가
 *   7) [고치러 돌아가기] 로 닫히고, [이대로 보내기] 는 **미리보기와 같은 내용**으로 보내기를 부르는가
 *      (보내기 요청은 가로채서 막는다)
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
const token = (user) => new SignJWT({ user, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
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
const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const davidIds = (await db.collection('mailaccounts').find({ smtpUser: /^david@yogico\.kr$/i }, { projection: { _id: 1 } }).toArray()).map((a) => String(a._id));
const acct = await db.collection('mailaccounts').findOne({ _id: new mongoose.Types.ObjectId(davidIds[0]) }, { projection: { fromName: 1, senderCompany: 1 } });
const mail = await db.collection('inboundmails').findOne(
  { accountId: { $in: davidIds }, direction: 'in', messageId: { $nin: ['', null] }, 'from.address': { $nin: ['', null] } },
  { sort: { date: -1 }, projection: { _id: 1, subject: 1, from: 1, status: 1, repliedAt: 1, leadId: 1, analysis: 1 } },
);
const snap = async () => {
  const m = await db.collection('inboundmails').findOne({ _id: mail._id }, { projection: { status: 1, repliedAt: 1, 'analysis.needsReply': 1 } });
  const l = mail.leadId ? await db.collection('leads').findOne({ leadId: mail.leadId }, { projection: { stage: 1, emailHistory: 1, lastEmailSentAt: 1 } }) : null;
  return JSON.stringify({ s: m?.status, r: m?.repliedAt || null, n: m?.analysis?.needsReply ?? null, st: l?.stage || null, h: (l?.emailHistory || []).length, last: l?.lastEmailSentAt || null });
};
const before = await snap();
const mid = String(mail._id);
const origSubject = String(mail.subject || '').trim();
const expectSubject = /^re\s*:/i.test(origSubject) ? origSubject : `Re: ${origSubject}`;
console.log(`대상 메일: ${origSubject.slice(0, 50)} · 보낸 사람 ${mail.from.address}`);

// ── 서버 ──
console.log('\n── 서버: /api/mail/reply/preview');
const BODY = '<div>Dear partner,</div><div>Thank you — we will send the <b>price list</b> this week.</div>';
const r1 = await api('david', '/api/mail/reply/preview', { inboundMailId: mid, body: BODY, bodyIsHtml: true, appendSignature: true });
ok(r1.status === 200 && r1.json?.success, `미리보기 응답 (HTTP ${r1.status})`);
const pv = r1.json?.preview || {};
ok(pv.to === mail.from.address, `받는 사람 = 원래 보낸 사람 (${pv.to})`);
ok(pv.subject === expectSubject, `제목 Re: 규칙 (${pv.subject})`);
ok(/@/.test(pv.from?.address || ''), `보내는 사람 (${pv.from?.name} <${pv.from?.address}>)`);
ok(strip(pv.html).includes('price list'), '본문 글자가 들어 있음');
ok(/<b>price list<\/b>/.test(pv.html), '서식(굵게)이 그대로 살아 있음');
ok(pv.signatureAppended === true && strip(pv.html).includes(String(acct?.fromName || '').trim()), `서명이 본문 뒤에 붙음 (${acct?.fromName})`);
ok(pv.threaded === true, '원래 메일과 같은 대화로 묶임');
ok(/font-family:sans-serif;font-size:14px;line-height:1\.6/.test(pv.html), '실제 발송과 같은 본문 감싸기');

const r2 = await api('david', '/api/mail/reply/preview', { inboundMailId: mid, body: BODY, bodyIsHtml: true, appendSignature: false });
ok(r2.json?.preview?.signatureAppended === false && !strip(r2.json?.preview?.html).includes(String(acct?.fromName || '').trim()), '서명 끄면 서명 없이 조립');

const r3 = await api('david', '/api/mail/reply/preview', { inboundMailId: mid, body: 'a <b>x</b>\nline2', bodyIsHtml: false });
ok(/&lt;b&gt;x&lt;\/b&gt;/.test(r3.json?.preview?.html || '') && /white-space:pre-wrap/.test(r3.json?.preview?.html || ''), '평문 본문은 태그를 글자로 · 줄바꿈 유지');

const r4 = await api('fe', '/api/mail/reply/preview', { inboundMailId: mid, body: BODY, bodyIsHtml: true });
ok(r4.status === 404, `다른 아이디(fe)는 대표님 메일 미리보기 불가 (HTTP ${r4.status})`);

const r5 = await api('david', '/api/mail/reply/preview', { inboundMailId: mid, body: '   ' });
ok(r5.status === 400 && /본문이 비어/.test(r5.json?.error || ''), `빈 본문은 400 (${r5.json?.error})`);

// 실제 답장 경로 — 입력 검사만 확인한다(빈 본문이라 조립 단계에서 멈춘다. 메일이 나갈 수 없다)
const r6 = await api('david', '/api/mail/reply', { inboundMailId: mid, body: '' });
ok(r6.status === 400 && /본문이 비어/.test(r6.json?.error || ''), `실제 답장 경로도 같은 검사 (HTTP ${r6.status} · ${r6.json?.error})`);

ok((await snap()) === before, '미리보기를 여러 번 눌러도 DB 가 그대로 ([답변 완료]·이력·단계 변화 없음)');

// ── 화면 ──
console.log('\n── 화면: [👁 미리보기]');
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const errs = [];
const sendAttempts = [];
const previewBodies = [];
try {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = r.url();
    if (r.method() === 'POST' && /\/api\/mail\/reply\/preview/.test(u)) { previewBodies.push(r.postData() || ''); return r.continue(); }
    // 실제 보내기는 전부 막는다
    if (r.method() === 'POST' && /\/api\/mail\/(reply|send|schedule|campaign|test-send|backfill|ingest)/.test(u)) {
      if (/\/api\/mail\/reply$/.test(u.split('?')[0])) sendAttempts.push(r.postData() || '');
      return r.abort();
    }
    return r.continue();
  });
  await p.setViewport({ width: 1500, height: 1000 });
  await p.setCookie({ name: 'admin_session', value: await token('david'), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(2500);
  await p.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-replied"]')?.click());
  await w(2500);
  ok(await p.evaluate(() => { const x = document.querySelector('button.conversation-btn'); if (x) x.click(); return !!x; }), '대화 열기');
  const t0 = Date.now();
  while (Date.now() - t0 < 20000 && !(await p.evaluate(() => !!document.getElementById('convReplyPreview')))) await w(250);
  ok(await p.evaluate(() => !!document.getElementById('convReplyPreview')), '[👁 미리보기] 버튼이 있음');
  ok(await p.evaluate(() => {
    const pv = document.getElementById('convReplyPreview'); const sd = document.getElementById('convReplySend');
    return !!pv && !!sd && pv.getBoundingClientRect().left < sd.getBoundingClientRect().left;
  }), '[보내기] 바로 앞에 있음');

  // 빈 본문으로 누르면 안내만
  await p.evaluate(() => document.getElementById('convReplyPreview').click());
  await w(600);
  ok(/본문을 입력하면 미리 볼 수 있습니다/.test(await p.evaluate(() => document.getElementById('convReplyMsg')?.innerText || '')), '본문이 비었으면 안내만 뜸');

  await p.evaluate(() => { document.getElementById('convReplyBody').innerHTML = 'Dear Arielle,<br><br>We will send the <b>price list</b> this week.<br><br>Best regards,'; });
  await p.evaluate(() => document.getElementById('convReplyPreview').click());
  const t1 = Date.now();
  while (Date.now() - t1 < 15000 && !(await p.evaluate(() => !!document.getElementById('replyPreviewModal')))) await w(250);
  ok(await p.evaluate(() => !!document.getElementById('replyPreviewModal')), '미리보기 창이 뜸');
  await w(800);
  const m = await p.evaluate(() => {
    const root = document.getElementById('replyPreviewModal');
    const fr = root?.querySelector('[data-rp-frame]');
    const inner = fr?.contentDocument?.body;
    return {
      head: root?.innerText || '',
      body: inner ? inner.innerText : '',
      bodyHtml: inner ? inner.innerHTML : '',
      scriptsAllowed: fr ? /allow-scripts/.test(fr.getAttribute('sandbox') || '') : true,
      frameH: fr ? fr.getBoundingClientRect().height : 0,
    };
  });
  ok(/보내는 사람/.test(m.head) && /david@yogico\.kr/.test(m.head), '보내는 사람 표시');
  ok(/받는 사람/.test(m.head) && /@/.test(m.head), '받는 사람 표시');
  ok(/제목/.test(m.head) && /Re:/i.test(m.head), '제목(Re:) 표시');
  ok(/아직 보내지 않았습니다/.test(m.head), '"아직 보내지 않았습니다" 표시');
  ok(/price list/.test(m.body) && /Best regards/.test(m.body), '본문 전체가 보임');
  ok(/<b>price list<\/b>/.test(m.bodyHtml), '굵게 서식이 그대로 보임');
  ok(String(acct?.fromName || '') && m.body.includes(String(acct.fromName).trim()), `본문 아래 서명이 보임 (${acct?.fromName})`);
  ok(m.scriptsAllowed === false, '본문 칸은 스크립트가 실행되지 않음 (sandbox)');
  ok(m.frameH >= 160, `본문 칸 높이가 내용에 맞게 잡힘 (${Math.round(m.frameH)}px)`);

  // 고치러 돌아가기
  await p.evaluate(() => document.querySelector('#replyPreviewModal [data-rp-close]')?.click());
  await w(400);
  ok(await p.evaluate(() => !document.getElementById('replyPreviewModal')), '[고치러 돌아가기] 로 닫힘 — 보내지 않음');
  ok(sendAttempts.length === 0, '닫았을 때 보내기 요청 없음');

  // 서명 끄고 미리보기 → 서명 없음
  await p.evaluate(() => { const c = document.getElementById('convReplySig'); c.checked = false; c.dispatchEvent(new Event('change')); });
  await p.evaluate(() => document.getElementById('convReplyPreview').click());
  const t2 = Date.now();
  while (Date.now() - t2 < 15000 && !(await p.evaluate(() => !!document.getElementById('replyPreviewModal')))) await w(250);
  await w(800);
  const off = await p.evaluate(() => {
    const root = document.getElementById('replyPreviewModal');
    return { head: root?.innerText || '', body: root?.querySelector('[data-rp-frame]')?.contentDocument?.body?.innerText || '' };
  });
  ok(/붙지 않습니다/.test(off.head) && !off.body.includes(String(acct?.fromName || '@@').trim()), '서명을 끄면 미리보기에도 서명 없음');

  // Esc 로 닫기
  await p.keyboard.press('Escape');
  await w(300);
  ok(await p.evaluate(() => !document.getElementById('replyPreviewModal')), 'Esc 로 닫힘');

  // 다시 켜고 → 이대로 보내기 (요청은 막힌다)
  await p.evaluate(() => { const c = document.getElementById('convReplySig'); c.checked = true; c.dispatchEvent(new Event('change')); });
  await p.evaluate(() => document.getElementById('convReplyPreview').click());
  const t3 = Date.now();
  while (Date.now() - t3 < 15000 && !(await p.evaluate(() => !!document.getElementById('replyPreviewModal')))) await w(250);
  await w(500);
  const lastPreview = previewBodies[previewBodies.length - 1];
  await p.evaluate(() => document.querySelector('#replyPreviewModal [data-rp-send]')?.click());
  await w(1500);
  ok(await p.evaluate(() => !document.getElementById('replyPreviewModal')), '[이대로 보내기] 누르면 창이 닫힘');
  ok(sendAttempts.length === 1, `보내기가 한 번 불림 (${sendAttempts.length}회 · 검사에서는 막음)`);
  ok(sendAttempts[0] === lastPreview, '보내는 내용이 **방금 미리 본 내용과 글자 하나까지 같음**');

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
}

ok((await snap()) === before, '검사를 끝낸 뒤에도 DB 그대로 (실제로 나간 메일 없음)');
await mongoose.disconnect();
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
