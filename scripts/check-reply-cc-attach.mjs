/**
 * 답장 창 — 참조 · 숨은참조 · 전체 답장 · 첨부, 그리고 받은/보낸 메일함 분리 점검 (2026-10-20, 대표님 요청).
 *
 *   API  1) [답장] / [전체 답장] 받는 사람 후보 — 아웃룩 규칙, 내 주소(david@)는 빠지는가
 *        2) 답장 미리보기에 참조·숨은참조·첨부가 실리는가 · 틀린 주소·20명 초과는 막히는가
 *        3) 받은 메일함 목록에 **내가 보낸 메일은 없고**, 동료(@yogico.kr)가 보낸 메일은 남는가
 *   화면 4) 답장 창: [↩ 답장] 기본 → [↩↩ 전체 답장 (N명)] → 다시 [↩ 답장]
 *        5) 참조 자동 완성 · 첨부 올리기 · **10MB 넘는 파일은 경고창** · 미리보기의 참조/첨부 줄
 *        6) 보내기 → 여러 명이면 확인창 → 서버로 참조·첨부 번호가 실려 가는가 (발송은 가로챔)
 *        7) 사이드바 [📤 보낸 메일함] — 받은 메일함 바로 아래, 누르면 이카운트 보낸메일함, 폴더 목록 안의 예전 항목은 없음
 *
 * **메일을 보내지 않는다** (답장 발송 요청은 가로채 성공으로 답한다).
 * --send 를 주면 fe 아이디로 fe@yogico.kr 메일에 첨부를 붙여 **실제로 한 통** 답장한다 (받는 사람도 fe@ 만).
 *
 * 사용: CRM_BASE=http://localhost:3000 node scripts/check-reply-cc-attach.mjs [--send]
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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
const api = async (user, p, init = {}) => {
  const r = await fetch(B + p, { ...init, headers: { Cookie: `admin_session=${await token(user)}`, ...(init.headers || {}) } });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};
const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const upload = async (user, buf, name) => {
  const id = crypto.randomUUID();
  const n = Math.ceil(buf.length / (3 * 1024 * 1024));
  let last;
  for (let i = 0; i < n; i++) {
    const qs = new URLSearchParams({ id, i: String(i), n: String(n), size: String(buf.length), name, type: 'application/pdf' });
    last = await api(user, `/api/mail/upload?${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: buf.subarray(i * 3145728, (i + 1) * 3145728) });
  }
  return { id, ...last };
};

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const M = db.collection('inboundmails');
const davidAccs = (await db.collection('mailaccounts').find({ owner: 'david', mergedInto: { $in: [null, ''] } }).toArray()).map((a) => String(a._id));
// 참조가 붙고 받는 사람도 여럿인 거래처 메일 — 전체 답장을 시험하기 좋은 것
const ccMail = (await M.find({ accountId: { $in: davidAccs }, direction: 'in', trashedAt: null, 'cc.0': { $exists: true }, 'to.1': { $exists: true },
  'from.address': { $not: /yogico\.kr$/i } }).sort({ date: -1 }).limit(1).toArray())[0];
const ID = String(ccMail._id);
console.log(`시험 메일: ${ccMail.subject.slice(0, 50)} · 보낸 사람 ${ccMail.from.address} · 받는 사람 ${ccMail.to.length} · 참조 ${ccMail.cc.length}`);

// ── 1) 후보 ──
console.log('\n── 1) [답장] / [전체 답장] 후보 (david)');
const g = await api('david', `/api/mail/reply?inboundMailId=${ID}`);
const rc = g.j.recipients || {};
ok(rc.reply?.to?.length === 1 && rc.reply.to[0] === ccMail.from.address, `답장 → 보낸 사람만 (${rc.reply?.to})`);
const allAddrs = [...(rc.replyAll?.to || []), ...(rc.replyAll?.cc || [])].map((a) => a.toLowerCase());
ok(rc.replyAll?.to?.[0] === ccMail.from.address && rc.replyAll.to.length === 1 + ccMail.to.filter((t) => !/^david@/i.test(t.address)).length,
  `전체 답장 받는 사람 = 보낸 사람 + 원래 받는 사람 (${rc.replyAll?.to?.length}명)`);
ok(!allAddrs.includes('david@yogico.kr'), '전체 답장에 내 주소(david@)는 없음');
ok(rc.replyAll?.cc?.length === ccMail.cc.filter((c) => !/^david@/i.test(c.address)).length, `전체 답장 참조 = 원래 참조 − 나 (${rc.replyAll?.cc?.length}명: ${(rc.replyAll?.cc || []).slice(0, 3).join(', ')}…)`);
ok(new Set(allAddrs).size === allAddrs.length, '받는 사람·참조에 같은 주소가 두 번 없음');
const other = await api('fe', `/api/mail/reply?inboundMailId=${ID}`);
ok(other.status === 404, `남(fe)이 대표님 메일의 후보를 물으면 → ${other.status}`);

// ── 2) 미리보기 ──
console.log('\n── 2) 답장 미리보기 (보내지 않음)');
const up = await upload('david', crypto.randomBytes(200 * 1024), '견적서_시험.pdf');
const pv = await api('david', '/api/mail/reply/preview', json({
  inboundMailId: ID, body: '<p>Test</p>', bodyIsHtml: true,
  to: rc.replyAll.to.join(', '), cc: rc.replyAll.cc.join(', '), bcc: 'fe@yogico.kr', attachments: [up.id],
}));
ok(pv.j.success && pv.j.preview.to.split(', ').length === rc.replyAll.to.length, `받는 사람 ${pv.j.preview?.to?.split(', ').length}명`);
ok(pv.j.preview?.cc?.length === rc.replyAll.cc.length && pv.j.preview?.bcc?.[0] === 'fe@yogico.kr', `참조 ${pv.j.preview?.cc?.length}명 · 숨은참조 fe@`);
ok(pv.j.preview?.attachments?.[0]?.filename === '견적서_시험.pdf' && pv.j.preview.attachments[0].complete, '첨부 이름·크기');
ok(pv.j.preview?.threaded === true, '여전히 원래 메일과 같은 대화로 묶임 (In-Reply-To)');
const bad = await api('david', '/api/mail/reply/preview', json({ inboundMailId: ID, body: 'x', to: 'amd@dangaard.com, 엉터리' }));
ok(bad.status === 400 && /엉터리/.test(bad.j.error || ''), `틀린 주소 짚어 줌 — ${bad.j.error}`);
const many = await api('david', '/api/mail/reply/preview', json({ inboundMailId: ID, body: 'x', to: Array.from({ length: 21 }, (_, i) => `t${i}@example.com`).join(',') }));
ok(many.status === 400 && /20명/.test(many.j.error || ''), '21명 → 거절');
const legacy = await api('david', '/api/mail/reply/preview', json({ inboundMailId: ID, body: 'x' }));
ok(legacy.j.preview?.to === ccMail.from.address, `받는 사람을 안 보내면 예전처럼 보낸 사람에게 (${legacy.j.preview?.to})`);
await api('david', `/api/mail/upload?id=${up.id}`, { method: 'DELETE' });

// ── 3) 받은 메일함에서 내 메일 빼기 ──
console.log('\n── 3) 받은 메일함 = 받은 메일만');
const inbox = await api('david', '/api/mail/inbox?accountId=all&flat=1&limit=200');
const froms = (inbox.j.items || []).map((m) => String(m.from?.address || '').toLowerCase());
ok(froms.length > 0 && !froms.includes('david@yogico.kr'), `받은 메일함 ${froms.length}통 중 내가 보낸 메일 0통`);
ok(froms.some((f) => /@yogico\.kr$/.test(f) && f !== 'david@yogico.kr'), `동료가 보낸 메일은 남음 (${froms.filter((f) => /@yogico\.kr$/.test(f)).length}통 · ${[...new Set(froms.filter((f) => /@yogico\.kr$/.test(f)))].slice(0, 3).join(', ')})`);
const mineInDb = await M.countDocuments({ accountId: { $in: davidAccs }, trashedAt: null, 'from.address': /^david@yogico\.kr$/i });
ok(mineInDb > 0, `DB 에는 그대로 있음 (지운 게 아니라 목록에서만 뺌 — ${mineInDb}통)`);

// ── 4~6) 화면 ──
console.log('\n── 4~6) 답장 창 (david · 발송은 가로챔)');
const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const errs = []; const dialogs = []; let answer = true; let sentBody = null;
const tmpDir = process.env.TEMP || '.';
const smallFile = path.join(tmpDir, 'crm-reply-attach.pdf');
const bigFile = path.join(tmpDir, 'crm-too-big.zip');
fs.writeFileSync(smallFile, crypto.randomBytes(150 * 1024));
fs.writeFileSync(bigFile, Buffer.alloc(10 * 1024 * 1024 + 4096));
try {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { dialogs.push(d.message()); answer ? await d.accept() : await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    if (/\/api\/mail\/reply$/.test(r.url().split('?')[0]) && r.method() === 'POST') {
      sentBody = JSON.parse(r.postData() || '{}');
      return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, dryRun: true }) });
    }
    if (/\/api\/mail\/(send|compose$|schedule|campaign)/.test(r.url().split('?')[0]) && r.method() === 'POST') return r.abort();
    r.continue();
  });
  await p.setViewport({ width: 1500, height: 1000 });
  await p.setCookie({ name: 'admin_session', value: await token('david'), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(2500);

  await p.evaluate((id) => openMailDetailModal(id), ID);
  ok(await p.waitForSelector('#mailDetailRoot #convTo', { timeout: 15000 }).then(() => true).catch(() => false), '메일 상세에 답장 창 · 받는 사람 칸');
  ok(await p.waitForFunction(() => !document.querySelector('[data-reply-mode="all"]')?.disabled, { timeout: 15000 }).then(() => true).catch(() => false),
    '[↩↩ 전체 답장] 이 켜짐 (원래 메일에 참조가 있으니)');
  const st0 = await p.evaluate(() => ({
    to: document.getElementById('convTo').value,
    oneOn: document.querySelector('[data-reply-mode="one"]').getAttribute('aria-pressed'),
    allLabel: document.querySelector('[data-reply-mode="all"]').innerText,
    ccHidden: document.getElementById('convCcRows').hidden,
  }));
  ok(st0.oneOn === 'true' && st0.to === rc.reply.to[0], `처음엔 [↩ 답장] — 받는 사람 ${st0.to}`);
  ok(/전체 답장 \(\d+명\)/.test(st0.allLabel), `버튼에 인원 표시 — "${st0.allLabel}"`);
  ok(st0.ccHidden, '참조 칸은 접혀 있음');

  await p.click('[data-reply-mode="all"]');
  const st1 = await p.evaluate(() => ({
    to: document.getElementById('convTo').value, cc: document.getElementById('convCc').value,
    ccHidden: document.getElementById('convCcRows').hidden, note: document.getElementById('convModeNote').innerText,
  }));
  ok(st1.to.split(', ').length === rc.replyAll.to.length && st1.cc.split(', ').length === rc.replyAll.cc.length,
    `[↩↩ 전체 답장] → 받는 사람 ${st1.to.split(', ').length}명 · 참조 ${st1.cc.split(', ').length}명`);
  ok(!st1.ccHidden && /모두에게/.test(st1.note), `참조 칸이 펼쳐지고 안내 — "${st1.note}"`);
  ok(!/david@yogico\.kr/i.test(st1.to + st1.cc), '전체 답장에 내 주소 없음');
  await p.click('[data-reply-mode="one"]');
  const st2 = await p.evaluate(() => ({ to: document.getElementById('convTo').value, cc: document.getElementById('convCc').value }));
  ok(st2.to === rc.reply.to[0] && st2.cc === '', '[↩ 답장] 으로 되돌리면 보낸 사람만 · 참조 비움');

  // 전체 답장 + 숨은참조 자동 완성
  await p.click('[data-reply-mode="all"]');
  await p.type('#convBcc', 'hoon');
  await p.waitForFunction(() => [...document.querySelectorAll('#mailDetailRoot .cm-ac')].some((m) => !m.hidden), { timeout: 8000 }).catch(() => {});
  await p.keyboard.press('Enter');
  ok(/hoon@yogico\.kr/.test(await p.$eval('#convBcc', (el) => el.value)), `숨은참조 자동 완성 → ${await p.$eval('#convBcc', (el) => el.value)}`);
  // hoon@ 은 이 메일의 참조에 이미 있어 서버가 숨은참조에서 뺀다(같은 사람에게 두 통 안 가게) — 겹치지 않는 주소로 바꿔 시험한다
  await p.evaluate(() => { document.getElementById('convBcc').value = 'fe@yogico.kr'; });

  // 첨부 — 작은 것 하나, 10MB 넘는 것 하나
  await (await p.$('#convFileInput')).uploadFile(smallFile);
  ok(await p.waitForFunction(() => /첨부됨/.test(document.getElementById('convFiles')?.innerText || ''), { timeout: 20000 }).then(() => true).catch(() => false), '답장에 파일 첨부 → ✓ 첨부됨');
  const nDlg = dialogs.length;
  await (await p.$('#convFileInput')).uploadFile(bigFile);
  await w(800);
  const bigAlert = dialogs.slice(nDlg).find((m) => /10MB 이상은 올릴 수 없습니다/.test(m)) || '';
  ok(Boolean(bigAlert), '10MB 넘는 파일 → 경고창 "10MB 이상은 올릴 수 없습니다"');
  ok(/드롭박스·구글드라이브/.test(bigAlert) && /crm-too-big\.zip/.test(bigAlert), '경고창에 파일 이름과 드롭박스·구글드라이브 안내');
  const warn = await p.evaluate(() => { const e = document.getElementById('convFilesWarn'); return e && !e.hidden ? e.innerText : ''; });
  ok(/10MB 이상은 올릴 수 없습니다/.test(warn), '경고창을 닫은 뒤에도 첨부 칸에 빨간 안내가 남음');
  ok(!/crm-too-big/.test(await p.$eval('#convFiles', (el) => el.innerText)), '큰 파일은 첨부 목록에 안 들어감');

  // 미리보기
  await p.evaluate(() => { document.getElementById('convReplyBody').innerHTML = 'Please see the attached quote.'; });
  await p.click('#convReplyPreview');
  ok(await p.waitForSelector('#replyPreviewModal', { timeout: 10000 }).then(() => true).catch(() => false), '미리보기 창');
  const pvt = await p.$eval('#replyPreviewModal', (el) => el.innerText);
  ok(/참조/.test(pvt) && /숨은참조/.test(pvt) && /crm-reply-attach\.pdf/.test(pvt), '미리보기에 참조·숨은참조·첨부 줄');
  await p.evaluate(() => document.querySelector('#replyPreviewModal [data-rp-close]')?.click());
  await w(300);

  // 보내기 — 여러 명이니 확인창, 서버로 참조·첨부가 실려 감
  const nDlg2 = dialogs.length;
  answer = true;
  await p.click('#convReplySend');
  await w(1500);
  ok(dialogs.slice(nDlg2).some((m) => /이대로 답장을 보낼까요/.test(m) && /참조:/.test(m) && /첨부:/.test(m)), '여러 명·첨부 → 보내기 전 확인창 (받는 사람·참조·첨부 목록)');
  ok(sentBody && sentBody.to.split(', ').length === rc.replyAll.to.length && sentBody.cc && /fe@yogico\.kr/.test(sentBody.bcc)
    && sentBody.attachments?.length === 1, `서버로 전체 답장 받는 사람·참조·숨은참조·첨부 번호가 실려 감 (첨부 ${sentBody?.attachments?.length}개)`);

  // ── 7) 보낸 메일함 분리 ──
  console.log('\n── 7) 사이드바 [📤 보낸 메일함]');
  await p.evaluate(() => closeMailDetailModal());
  const nav = await p.evaluate(() => {
    const items = [...document.querySelectorAll('.nav-item')].map((x) => x.dataset.view);
    const i = items.indexOf('tool-inbox');
    return { next: items[i + 1], has: items.includes('tool-sent') };
  });
  ok(nav.has && nav.next === 'tool-sent', '받은 메일함 바로 아래에 [📤 보낸 메일함]');
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-sent"]').click());
  ok(await p.waitForFunction(() => /보낸 메일함/.test(document.getElementById('viewTitle')?.innerText || '')
    && /이카운트 보낸메일함을 그대로/.test(document.getElementById('content')?.innerText || document.body.innerText), { timeout: 20000 }).then(() => true).catch(() => false),
    '누르면 이카운트 보낸메일함 목록');
  ok(await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-sent"]').classList.contains('active')), '사이드바에 [보낸 메일함] 이 켜져 보임');
  // 보낸 메일함도 받은 메일함과 같은 틀 — 왼쪽 거래처 폴더 목록이 그대로 있고 [📤 보낸 메일함] 이 켜져 있다
  const sentPanel = await p.evaluate(() => {
    const sent = document.querySelector('.inbox-folders .inbox-group[data-group="__sent__"]');
    return { panel: !!document.querySelector('.inbox-folders'), sentActive: sent ? getComputedStyle(sent).fontWeight >= 700 : false,
      folders: document.querySelectorAll('.inbox-folders .inbox-group').length };
  });
  ok(sentPanel.panel && sentPanel.folders > 3, `보낸 메일함 화면에도 왼쪽 거래처 폴더 목록이 그대로 (${sentPanel.folders}칸)`);
  ok(sentPanel.sentActive, '폴더 목록의 [📤 보낸 메일함] 이 켜져 있음');
  // 거기서 거래처 폴더를 누르면 받은 메일함의 그 폴더로
  const folderName = await p.evaluate(() => {
    const f = [...document.querySelectorAll('.inbox-folders .inbox-group')].find((b) => !['', '__none__', '__sent__', '__trash__'].includes(b.dataset.group) && !/광고/.test(b.dataset.group));
    f?.click();
    return f?.dataset.group || '';
  });
  ok(await p.waitForFunction((g) => /받은 메일함/.test(document.getElementById('viewTitle')?.innerText || '')
    && document.querySelector('.nav-item[data-view="tool-inbox"]').classList.contains('active')
    && document.body.innerText.includes(`📁 ${g}`), { timeout: 20000 }, folderName).then(() => true).catch(() => false),
    `보낸 메일함에서 거래처 폴더(${folderName})를 누르면 받은 메일함의 그 폴더가 열림`);

  // 받은 메일함 폴더 목록 맨 아래(휴지통 위)에도 [📤 보낸 메일함] — 다른 폴더와 같은 모양 (대표님 요청)
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-inbox"]').click());
  ok(await p.waitForFunction(() => /받은 메일함/.test(document.getElementById('viewTitle')?.innerText || '') && !!document.querySelector('tr.inbox-row'), { timeout: 20000 }).then(() => true).catch(() => false),
    '[받은 메일함] 을 누르면 받은 메일 목록으로 돌아옴 (보낸 메일함이 남아 있지 않음)');
  const inFolders = await p.evaluate(() => {
    const items = [...document.querySelectorAll('.inbox-folders .inbox-group')];
    const i = items.findIndex((b) => b.dataset.group === '__sent__');
    return { has: i >= 0, nextIsTrash: items[i + 1]?.dataset.group === '__trash__', sameClass: items[i]?.className === items[0]?.className,
      height: items[i] ? Math.round(items[i].getBoundingClientRect().height) : 0, refHeight: items[0] ? Math.round(items[0].getBoundingClientRect().height) : 0 };
  });
  ok(inFolders.has && inFolders.nextIsTrash, '폴더 목록 맨 아래 휴지통 바로 위에 [📤 보낸 메일함]');
  ok(inFolders.sameClass && inFolders.height === inFolders.refHeight, `다른 폴더와 같은 모양 (높이 ${inFolders.height}px = ${inFolders.refHeight}px)`);
  await p.evaluate(() => document.querySelector('.inbox-folders .inbox-group[data-group="__sent__"]').click());
  ok(await p.waitForFunction(() => /보낸 메일함/.test(document.getElementById('viewTitle')?.innerText || '')
    && document.querySelector('.nav-item[data-view="tool-sent"]').classList.contains('active'), { timeout: 20000 }).then(() => true).catch(() => false),
    '폴더 목록의 [보낸 메일함] 을 눌러도 사이드바 [보낸 메일함] 과 같은 화면 (사이드바도 켜짐)');

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
  for (const f of [smallFile, bigFile]) try { fs.unlinkSync(f); } catch {}
}

// ── 실제 발송 (--send) — fe 아이디, fe@ 메일에 fe@ 로만 ──
if (SEND) {
  console.log('\n── 실제 답장 (fe → fe@yogico.kr · 첨부 1개)');
  const feAccs = (await db.collection('mailaccounts').find({ smtpUser: /^fe@yogico\.kr$/i, mergedInto: { $in: [null, ''] } }).toArray()).map((a) => String(a._id));
  const target = (await M.find({ accountId: { $in: feAccs }, subject: /\[CRM 테스트\]/ }).sort({ date: -1 }).limit(1).toArray())[0];
  const file = await upload('fe', crypto.randomBytes(300 * 1024), '답장첨부_시험.pdf');
  const r = await api('fe', '/api/mail/reply', json({ inboundMailId: String(target._id), body: '<p>CRM 답장 첨부 시험입니다.</p>', bodyIsHtml: true, to: 'fe@yogico.kr', attachments: [file.id] }));
  ok(r.j.success && !r.j.dryRun, `답장 보냄 — ${r.j.messageId || r.j.error}`);
  ok(r.j.attachments?.[0]?.filename === '답장첨부_시험.pdf', '첨부 1개 붙어 나감');
  ok(r.j.savedToSent, '보낸메일함 사본');
  ok((await db.collection('mailuploads').countDocuments({ uploadId: file.id })) === 0, '첨부 조각은 보낸 뒤 지워짐');
}

await mongoose.disconnect();
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
