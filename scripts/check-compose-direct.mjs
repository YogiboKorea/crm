/**
 * [✏ 메일 쓰기] 다이렉트 메일 보내기 점검 (2026-10-20, 대표님 미팅 전).
 *
 *   API  1) 주소 자동 완성 — 주고받은 주소가 뜨는가, 남의 메일함 주소는 안 뜨는가
 *        2) 첨부 조각 올리기 — 7MB 파일이 3조각으로 올라가 크기 그대로 이어 붙는가
 *        3) 남이 올린 첨부에 끼어들 수 없는가 · 실행 파일 · 10MB 초과는 막히는가
 *        4) 받는 사람 여러 명 · 참조 · 숨은참조가 메일 원문에 맞게 실리는가 (실제 발송 없이 원문만 만들어 본다)
 *        5) 20명 넘으면 막히는가
 *   화면 6) 사이드바 [✏ 메일 쓰기] 가 받은 메일함 위에 있고, 받은 메일함 안의 예전 버튼은 없어졌는가
 *        7) 자동 완성 · 참조 펼치기 · 첨부 올리기 · 닫기 전 확인 · 미리보기의 참조/첨부 줄
 *
 * **메일을 보내지 않는다** — 화면 시험은 발송 요청을 가로챈다. 실제 발송 시험은 --send 를 줄 때만,
 * 그것도 fe@yogico.kr(우리 시험 주소)로만 한 통 보낸다.
 *
 * 사용: CRM_BASE=http://localhost:3000 node scripts/check-compose-direct.mjs [--send] [--ai]
 *   --ai   [🤖 AI 검토] 화면까지 (유료 · 한 번 십몇 원)
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = process.env.CRM_BASE || 'http://localhost:3000';
const SEND = process.argv.includes('--send');
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (user) => new SignJWT({ user, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const H = async (user, extra = {}) => ({ Cookie: `admin_session=${await token(user)}`, ...extra });
const api = async (user, path, init = {}) => {
  const r = await fetch(B + path, { ...init, headers: { ...(await H(user)), ...(init.headers || {}) } });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};
const CHUNK = 3 * 1024 * 1024;
const upload = async (user, buf, name, type = 'application/pdf', id = crypto.randomUUID()) => {
  const n = Math.ceil(buf.length / CHUNK);
  let last;
  for (let i = 0; i < n; i++) {
    const qs = new URLSearchParams({ id, i: String(i), n: String(n), size: String(buf.length), name, type });
    last = await api(user, `/api/mail/upload?${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: buf.subarray(i * CHUNK, (i + 1) * CHUNK) });
    if (!last.j.success) return { id, ...last };
  }
  return { id, ...last };
};

await mongoose.connect(process.env.MONGODB_URI);
const U = mongoose.connection.db.collection('mailuploads');

// ── 1) 주소 자동 완성 ──
console.log('── 1) 주소 자동 완성 (david)');
for (const q of ['dangaard', 'lcl@', 'hoon']) {
  const r = await api('david', `/api/mail/contacts?q=${encodeURIComponent(q)}`);
  const list = r.j.contacts || [];
  ok(r.status === 200 && list.length > 0, `"${q}" → ${list.length}건 · ${list.slice(0, 3).map((c) => `${c.address}(${c.count ? c.count + '통' : '업체'})`).join(', ')}`);
}
const meSelf = await api('david', '/api/mail/contacts?q=david@yogico');
ok(!(meSelf.j.contacts || []).some((c) => c.address === 'david@yogico.kr'), '내 주소(david@)는 자동 완성에 안 뜸');
const feSees = await api('fe', '/api/mail/contacts?q=dangaard');
ok((feSees.j.contacts || []).every((c) => c.count === 0), `fe 아이디로는 대표님이 주고받은 dangaard 주소가 메일 이력으로 안 뜸 (업체 등록분만 ${(feSees.j.contacts || []).length}건)`);
ok((await api('david', '/api/mail/contacts?q=d')).j.contacts?.length === 0, '한 글자는 찾지 않음');

// ── 2) 첨부 조각 ──
console.log('\n── 2) 첨부 조각 올리기 (7MB → 3조각)');
const big = crypto.randomBytes(7 * 1024 * 1024 + 12345);
const up = await upload('fe', big, '회사소개서 2026.pdf');
ok(up.j.success && up.j.complete && up.j.total === 3, `3조각 다 올라감 (${up.j.received}/${up.j.total})`);
const rows = await U.find({ uploadId: up.id }).sort({ chunkIndex: 1 }).toArray();
const joined = Buffer.concat(rows.map((r) => Buffer.from(r.data.buffer ? r.data.value() : r.data)));
ok(joined.length === big.length && joined.equals(big), `이어 붙이면 원본과 똑같음 (${joined.length} bytes)`);
const again = await upload('fe', big, '회사소개서 2026.pdf', 'application/pdf', up.id);
ok(again.j.success && (await U.countDocuments({ uploadId: up.id })) === 3, '같은 조각을 다시 올려도 늘어나지 않음 (덮어씀)');

// ── 3) 막아야 할 것 ──
console.log('\n── 3) 막아야 할 것');
const steal = await api('david', `/api/mail/upload?${new URLSearchParams({ id: up.id, i: '0', n: '3', size: String(big.length), name: 'x.pdf', type: 'application/pdf' })}`,
  { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: big.subarray(0, CHUNK) });
ok(steal.status === 403, `남(fe)이 올린 번호로 다른 아이디가 올리기 → ${steal.status}`);
const delOther = await api('david', `/api/mail/upload?id=${up.id}`, { method: 'DELETE' });
ok(delOther.j.deleted === 0 && (await U.countDocuments({ uploadId: up.id })) === 3, '남의 첨부는 지울 수도 없음');
const exe = await upload('fe', Buffer.from('MZ'), 'setup.exe', 'application/octet-stream');
ok(exe.status === 400 && /실행 파일/.test(exe.j.error || ''), `실행 파일 거절 — ${exe.j.error}`);
const huge = await api('fe', `/api/mail/upload?${new URLSearchParams({ id: crypto.randomUUID(), i: '0', n: '4', size: String(11 * 1024 * 1024), name: 'big.zip', type: 'application/zip' })}`,
  { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.alloc(10) });
ok(huge.status === 400 && /10MB/.test(huge.j.error || ''), `10MB 넘는 파일 거절 — ${String(huge.j.error).slice(0, 50)}`);
const wrongLen = await api('fe', `/api/mail/upload?${new URLSearchParams({ id: crypto.randomUUID(), i: '0', n: '1', size: '100', name: 'a.pdf', type: 'application/pdf' })}`,
  { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.alloc(50) });
ok(wrongLen.status === 400, '조각 크기가 안 맞으면 거절 (파일이 깨진 채 붙는 것 방지)');

// 미리보기 — 이름·크기와 참조/숨은참조 줄
const pv = await api('fe', '/api/mail/compose/preview', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: 'fe@yogico.kr, Test <fe+x@yogico.kr>', cc: 'fe@yogico.kr', bcc: 'nobody@example.com', subject: '[CRM 테스트] 미리보기', body: '테스트', attachments: [up.id] }),
});
ok(pv.j.success && /fe\+x@yogico\.kr/.test(pv.j.preview?.to || ''), `받는 사람 여러 명 ("이름 <주소>" 도 읽음) → ${pv.j.preview?.to}`);
ok(pv.j.preview?.cc?.length === 0, '받는 사람과 겹친 참조 주소는 한 번만 (같은 메일 두 통 방지)');
ok(pv.j.preview?.bcc?.[0] === 'nobody@example.com', '숨은참조 유지');
ok(pv.j.preview?.attachments?.[0]?.size === big.length && pv.j.preview.attachments[0].complete, `미리보기에 첨부 이름·크기 (${pv.j.preview?.attachments?.[0]?.filename})`);

// ── 4) 참조·숨은참조가 원문에 맞게 실리나 (보내지 않고 원문만) ──
console.log('\n── 4) 메일 원문 (실제 발송 없음)');
const opts = { from: '"T" <fe@yogico.kr>', to: ['a@x.com', 'b@y.com'], cc: ['c@z.com'], bcc: ['d@w.com'], subject: 's', text: 'b',
  attachments: [{ filename: '회사소개서.pdf', content: Buffer.from('hello'), contentType: 'application/pdf' }] };
// 실제 SMTP 발송이 만드는 원문과 같은 방식 — MailComposer 기본값 (keepBcc 없음).
// ⚠ streamTransport 로 만들면 안 된다: 그쪽은 원래 숨은참조를 머리말에 남긴다(사본용) — 처음에 그걸로 재서 틀렸다.
const { default: MailComposer } = await import('nodemailer/lib/mail-composer/index.js');
const sentRaw = (await new Promise((res, rej) => new MailComposer(opts).compile().build((e, m) => (e ? rej(e) : res(m))))).toString();
ok(/^To: a@x\.com, b@y\.com/m.test(sentRaw) && /^Cc: c@z\.com/m.test(sentRaw), '보내는 원문: 받는 사람 2명 · 참조 1명');
ok(!/^Bcc:/m.test(sentRaw), '보내는 원문: 숨은참조는 머리말에 없음 (받는 사람에게 안 보임)');
const env = (await nodemailer.createTransport({ streamTransport: true }).sendMail(opts)).envelope;
ok(env.to.includes('d@w.com'), `숨은참조도 실제 받는 사람 목록(envelope)에는 들어감 — 배달은 된다 (${env.to.join(', ')})`);
ok(/filename\*0\*=utf-8''%ED%9A%8C/i.test(sentRaw), '한글 파일 이름이 표준 방식(RFC 2231)으로 인코딩됨 — 받는 쪽에서 안 깨짐');
const copy = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
copy.use('stream', (mail, done) => { mail.message.keepBcc = true; done(); });
const copyRaw = (await copy.sendMail(opts)).message.toString();
ok(/^Bcc: d@w\.com/m.test(copyRaw), '보낸메일함 사본: 숨은참조가 남음 (sent-copy.ts 와 같은 방식)');

// ── 5) 인원 한도 ──
console.log('\n── 5) 인원 한도');
const many = Array.from({ length: 21 }, (_, i) => `t${i}@example.com`).join(', ');
const r21 = await api('fe', '/api/mail/compose/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: many, subject: 's', body: 'b' }) });
ok(r21.status === 400 && /20명/.test(r21.j.error || ''), `21명 → 거절 (${String(r21.j.error).slice(0, 40)}…)`);
const badAddr = await api('fe', '/api/mail/compose/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: 'fe@yogico.kr, 잘못된주소', subject: 's', body: 'b' }) });
ok(badAddr.status === 400 && /잘못된주소/.test(badAddr.j.error || ''), `틀린 주소를 짚어 줌 — ${badAddr.j.error}`);

// ── 실제 발송 (--send 일 때만 · fe@ 로만) ──
if (SEND) {
  console.log('\n── 실제 발송 (fe → fe@yogico.kr · 첨부 2개)');
  const small = await upload('fe', Buffer.from('%PDF-1.4\n% 요기코 CRM 첨부 시험\n'), '가격표_시험.pdf');
  const r = await api('fe', '/api/mail/compose', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: 'fe@yogico.kr', subject: `[CRM 테스트] 다이렉트 메일 첨부 ${new Date().toLocaleString('ko-KR')}`,
      body: '<p>CRM [메일 쓰기] 첨부 시험입니다. 회사소개서(7MB)와 가격표가 붙어 있어야 합니다.</p>', bodyIsHtml: true, attachments: [up.id, small.id] }),
  });
  ok(r.j.success && !r.j.dryRun, `보냄 — ${r.j.messageId || r.j.error}`);
  ok(r.j.savedToSent, '보낸메일함에 사본 남김');
  ok(r.j.attachments?.length === 2 && r.j.attachments[0].size === big.length, `첨부 2개 (${(r.j.attachments || []).map((a) => `${a.filename} ${a.size}`).join(', ')})`);
  ok((await U.countDocuments({ uploadId: { $in: [up.id, small.id] } })) === 0, '보낸 뒤 첨부 조각은 DB 에서 지워짐');
} else {
  await api('fe', `/api/mail/upload?id=${up.id}`, { method: 'DELETE' });
  ok((await U.countDocuments({ uploadId: up.id })) === 0, '시험 첨부 치움 (실제 발송은 --send 일 때만)');
}

// ── 6~7) 화면 ──
console.log('\n── 6~7) 화면 (david · 발송 요청은 가로챔)');
const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const errs = [];
const dialogs = [];
let answer = false;
try {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { dialogs.push(d.message()); answer ? await d.accept() : await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => (/\/api\/mail\/(compose$|compose\?|send|reply|schedule|campaign)/.test(r.url().split('?')[0] + '?') && r.method() === 'POST'
    && !/compose\/(preview|review)/.test(r.url())) ? r.abort() : r.continue());
  await p.setViewport({ width: 1400, height: 950 });
  await p.setCookie({ name: 'admin_session', value: await token('david'), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(2500);

  const side = await p.evaluate(() => {
    const btn = document.getElementById('navComposeBtn');
    const inbox = document.querySelector('.nav-item[data-view="tool-inbox"]');
    return {
      has: !!btn, text: btn?.innerText.trim() || '',
      above: !!btn && !!inbox && (btn.compareDocumentPosition(inbox) & Node.DOCUMENT_POSITION_FOLLOWING) > 0
        && btn.getBoundingClientRect().bottom <= inbox.getBoundingClientRect().top + 1,
      oldGone: !document.getElementById('inboxComposeBtn'),
    };
  });
  ok(side.has && /메일 쓰기/.test(side.text), `사이드바에 [${side.text}]`);
  ok(side.above, '받은 메일함 바로 위에 있음');
  ok(side.oldGone, '받은 메일함 화면 안의 예전 [새 메일 쓰기] 버튼은 없어짐 (하나로)');

  // 다른 화면에서도 열리나 — 파이프라인 화면으로 갔다가 누르기
  await p.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-replied"]')?.click());
  await w(1200);
  await p.evaluate(() => document.getElementById('navComposeBtn').click());
  ok(await p.waitForSelector('#composeMailModal', { timeout: 8000 }).then(() => true).catch(() => false), '다른 화면에서도 누르면 쓰기 창이 열림');

  // 자동 완성
  await p.type('#cmTo', 'dangaard');
  const ac = await p.waitForFunction(() => {
    const m = document.querySelector('#composeMailModal .cm-ac');
    return m && !m.hidden && m.querySelectorAll('[data-ac]').length > 0 ? m.querySelectorAll('[data-ac]').length : 0;
  }, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => 0);
  ok(ac > 0, `받는 사람에 "dangaard" → 주소 ${ac}개 뜸`);
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  const toVal = await p.$eval('#cmTo', (el) => el.value);
  ok(/@/.test(toVal) && /,\s*$/.test(toVal), `화살표·Enter 로 고름 → "${toVal}"`);
  ok(await p.evaluate(() => !!document.getElementById('composeMailModal')), 'Enter 로 골라도 창은 그대로');

  // 참조 펼치기 + 자동 완성
  await p.click('#cmCcToggle');
  ok(await p.evaluate(() => !document.getElementById('cmCcRows').hidden), '[+ 참조 · 숨은참조 추가] → 두 칸이 펼쳐짐');
  await p.type('#cmCc', 'hoon');
  await p.waitForFunction(() => [...document.querySelectorAll('#composeMailModal .cm-ac')].some((m) => !m.hidden), { timeout: 8000 }).catch(() => {});
  await p.keyboard.press('Enter');
  const ccVal = await p.$eval('#cmCc', (el) => el.value);
  ok(/hoon@yogico\.kr/.test(ccVal), `참조에 "hoon" → ${ccVal}`);

  // 첨부
  const fileInput = await p.$('#cmFileInput');
  const tmp = `${process.env.TEMP || '.'}\\crm-attach-test.pdf`;
  (await import('fs')).writeFileSync(tmp, crypto.randomBytes(400 * 1024));
  await fileInput.uploadFile(tmp);
  ok(await p.waitForFunction(() => /첨부됨/.test(document.getElementById('cmFiles')?.innerText || ''), { timeout: 20000 }).then(() => true).catch(() => false),
    '파일을 고르면 바로 올라가 [✓ 첨부됨]');
  ok(/1개 · \d+KB \/ 10MB/.test(await p.$eval('#cmFilesHint', (el) => el.innerText)), `첨부 합계 표시 — ${await p.$eval('#cmFilesHint', (el) => el.innerText)}`);

  await p.type('#cmSubject', '[CRM 테스트] 화면 점검');
  await p.evaluate(() => { document.getElementById('cmBody').innerHTML = '첨부 확인 부탁드립니다.'; });

  // 🤖 AI 검토 — 유료(한 번 십몇 원)라 --ai 일 때만
  if (process.argv.includes('--ai')) {
    await p.evaluate(() => { document.getElementById('cmBody').innerHTML = 'Please find attached the price list. Shipment leaves Busan on 10/8.'; });
    // 첨부를 빼서 "첨부 언급 + 파일 없음" 을 만든다
    await p.evaluate(() => document.querySelector('[data-unattach]')?.click());
    await w(500);
    await p.click('#cmReviewBtn');
    ok(await p.waitForFunction(() => !document.getElementById('cmReview')?.hidden, { timeout: 60000 }).then(() => true).catch(() => false), '[🤖 AI 검토] → 결과 칸이 열림');
    const rv = await p.$eval('#cmReview', (el) => el.innerText);
    ok(/고치고 보내세요|확인하고 보내세요/.test(rv), `판정 표시 — ${rv.split('\n')[0]}`);
    ok(/첨부/.test(rv) && /자동 점검/.test(rv), '자동 점검(첨부 누락)이 맨 위에');
    ok(/AI/.test(rv) && /원/.test(rv), `AI 결과와 비용 표시 — ${(rv.match(/이번 검토 약 [\d,]+원/) || ['(비용 표시 없음)'])[0]}`);
    // 첨부를 다시 붙여 둔다 (아래 미리보기 시험용)
    await (await p.$('#cmFileInput')).uploadFile(tmp);
    await p.waitForFunction(() => /첨부됨/.test(document.getElementById('cmFiles')?.innerText || ''), { timeout: 20000 }).catch(() => {});
  }

  // 미리보기에 참조·첨부 줄
  await p.click('#cmPreview');
  ok(await p.waitForSelector('#replyPreviewModal', { timeout: 8000 }).then(() => true).catch(() => false), '미리보기 창이 열림');
  const pvText = await p.$eval('#replyPreviewModal', (el) => el.innerText);
  ok(/참조/.test(pvText) && /hoon@yogico\.kr/.test(pvText), '미리보기에 참조 줄');
  ok(/첨부/.test(pvText) && /crm-attach-test\.pdf/.test(pvText), '미리보기에 첨부 줄');
  await p.evaluate(() => document.querySelector('#replyPreviewModal [data-rp-close]')?.click());
  await w(400);

  // 닫기 전 확인 — 취소하면 그대로, 확인하면 닫히고 첨부 조각도 지움
  const before = dialogs.length;
  answer = false;
  await p.keyboard.press('Escape');
  await w(500);
  ok(dialogs.length === before + 1 && /쓰던 메일을 닫을까요/.test(dialogs[dialogs.length - 1] || ''), 'Esc → "쓰던 메일을 닫을까요?" 확인');
  ok(await p.evaluate(() => !!document.getElementById('composeMailModal')), '[취소] 하면 창이 그대로 (본문·첨부 유지)');
  const myUploads = await U.countDocuments({ owner: 'david', filename: 'crm-attach-test.pdf' });
  answer = true;
  await p.mouse.click(5, 5);   // 바깥 누르기
  await w(1500);
  ok(await p.evaluate(() => !document.getElementById('composeMailModal')), '[확인] 하면 닫힘');
  ok(myUploads > 0 && (await U.countDocuments({ owner: 'david', filename: 'crm-attach-test.pdf' })) === 0, '안 보내고 닫으면 올려 둔 첨부 조각도 지움');

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
  await mongoose.disconnect();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
