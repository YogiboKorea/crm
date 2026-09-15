/**
 * 2026-09-15 반영분 확인 — 실제 발송은 하지 않는다 (발송 요청은 가로챈다).
 *
 * 1) 발송관리 미리보기에 **서명까지** 보이는가 (실제로 나가는 모습 그대로)
 * 2) 답장 화면에서 [서명 붙이기] 가 **본문 위**에 있고, 켜면 서명이 아래에 보이는가
 * 3) 사이드바 [발송 관리] 배지가 **보낼 메일만** 세는가 (발송 완료는 안 더한다)
 * 4) 화면 서명이 서버가 붙이는 서명(lib/template-vars.ts)과 같은 모양인가
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

// 로그인 화면으로 들어가지 않고 세션을 직접 심는다 — 대표님·전무님이 각자 비밀번호를 바꾸셨으므로
// 확인용 스크립트가 비밀번호를 알고 있을 이유가 없다 (알아서도 안 된다).
const sessionToken = (user) => new SignJWT({ user, role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const B = 'http://localhost:3000';
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (p, fn, ms = 15000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); }
  return false;
};

// ── DB 에서 기대값을 먼저 뽑는다 ──
await mongoose.connect(process.env.MONGODB_URI);
const L = mongoose.connection.db.collection('leads');
const queued = await L.countDocuments({ stage: 'queued', deleted: { $ne: true } });
const contacted = await L.countDocuments({ stage: 'contacted', deleted: { $ne: true } });
const acct = await mongoose.connection.db.collection('mailaccounts')
  .findOne({ smtpUser: /^david@yogico\.kr$/i }, { projection: { fromName: 1, senderTitle: 1, senderCompany: 1, senderAddress: 1, senderPhone: 1, senderWebsite: 1 } });
await mongoose.disconnect();
console.log(`기대값 — 보낼 메일 ${queued}곳 · 발송 완료 ${contacted}곳`);

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const errs = [];
try {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => (/\/api\/mail\/(send|schedule|campaign|reply|test-send|backfill|ingest)/.test(r.url()) && r.method() !== 'GET')
    ? r.abort() : r.continue());
  await p.setViewport({ width: 1500, height: 1000 });

  console.log('\n── 세션 심기 (david)');
  await p.setCookie({ name: 'admin_session', value: await sessionToken('david'), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  ok(!p.url().includes('/login'), `화면 열림 (${p.url()})`);
  await w(3000);

  // ── 3) 사이드바 배지 ──
  console.log('\n── 사이드바 [발송 관리] 배지');
  const badge = await p.evaluate(() => {
    const el = document.querySelector('[data-nav-badge="contacted"]');
    return el ? el.textContent.trim() : null;
  });
  ok(badge !== null, `배지를 찾음 (${badge})`);
  ok(String(badge) === String(queued), `보낼 메일만 셈 — 화면 ${badge} · DB queued ${queued} (발송 완료 ${contacted}곳은 안 더함)`);

  // ── 1) 발송관리 미리보기에 서명 ──
  console.log('\n── 📨 발송 관리 미리보기');
  await p.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-contacted"]')?.click());
  ok(await waitFor(p, () => /발송 관리/.test(document.getElementById('viewTitle')?.textContent || '')), '발송 관리 화면 열림');
  await w(2000);
  const pv = await p.evaluate(() => {
    const from = document.getElementById('obPvFrom');
    const body = document.getElementById('obPvBody');
    return {
      hasFrom: !!from,
      fromText: from ? from.textContent.trim() : '',
      hasBody: !!body,
      bodyText: body ? body.innerText.trim() : '',
      bodyHtml: body ? body.innerHTML : '',
    };
  });
  ok(pv.hasFrom, `[보내는 사람] 줄이 있음 — ${pv.fromText}`);
  ok(pv.hasBody, '본문 미리보기 있음');
  const sigName = String(acct?.fromName || '').trim();
  const sigCompany = String(acct?.senderCompany || '').trim();
  if (sigName || sigCompany) {
    ok(sigName ? pv.bodyText.includes(sigName) : true, `미리보기 안에 서명 이름이 보임 (${sigName})`);
    ok(sigCompany ? pv.bodyText.includes(sigCompany) : true, `미리보기 안에 서명 회사가 보임 (${sigCompany})`);
  } else {
    ok(/서명이 비어 있어/.test(pv.bodyText), '서명 정보가 없으면 그 사실을 알려 줌');
  }
  ok(/여기 보이는 그대로 나갑니다/.test(await p.evaluate(() => document.body.innerText)), '"여기 보이는 그대로 나갑니다" 안내 있음');

  // ── 4) 서버 서명과 같은 모양인가 ──
  console.log('\n── 서명 모양이 서버와 같은가');
  const shape = await p.evaluate(() => {
    const acc = { fromName: 'A B', senderTitle: 'CEO', senderCompany: 'C Inc.', senderAddress: 'Addr', senderPhone: '+82 10', senderWebsite: 'www.x.kr' };
    return typeof accountSignatureHtml === 'function' ? accountSignatureHtml(acc) : '';
  });
  ok(/margin-top:24px/.test(shape), '서명 블록 위 여백 24px (서버와 동일)');
  ok(/font-size:13px/.test(shape), '서명 글자 크기 13px (서버와 동일)');
  ok((shape.match(/margin:0 0 12px/g) || []).length >= 5, '줄마다 12px 간격 (서버와 동일)');
  ok(/A B, CEO/.test(shape) && /A: Addr/.test(shape) && /M: \+82 10/.test(shape), '이름·직함 / A: / M: 형식');
  ok(/href="http:\/\/www\.x\.kr"/.test(shape), '웹사이트가 링크로 들어감');
  const empty = await p.evaluate(() => accountSignatureHtml({}));
  ok(empty === '', '서명 정보가 하나도 없으면 아무것도 붙이지 않음 (서버와 동일)');

  // ── 2) 답장 화면 서명 체크 ──
  // **새 창에서 다른 화면을 거치지 않고** 바로 대화를 연다.
  // 발송관리를 먼저 열면 계정 목록이 미리 불러와져, 목록이 없을 때 서명이 비는 문제를 못 잡는다(실제로 놓쳤다).
  console.log('\n── ↩ 답장 화면 [서명 붙이기] — 새 창에서 바로 열기');
  const p2 = await b.newPage();
  p2.on('pageerror', (e) => errs.push(String(e)));
  p2.on('dialog', async (d) => { await d.dismiss(); });
  await p2.setRequestInterception(true);
  p2.on('request', (r) => (/\/api\/mail\/(send|schedule|campaign|test-send|backfill|ingest)/.test(r.url()) && r.method() !== 'GET')
    || (/\/api\/mail\/reply/.test(r.url()) && r.method() === 'POST')
    ? r.abort() : r.continue());
  await p2.setViewport({ width: 1500, height: 1000 });
  await p2.setCookie({ name: 'admin_session', value: await sessionToken('david'), domain: 'localhost', path: '/' });
  await p2.goto(B, { waitUntil: 'networkidle2' });
  await w(2500);
  const accountsPreloaded = await p2.evaluate(() => Array.isArray(window._mailAccounts) && window._mailAccounts.length > 0);
  console.log(`      (계정 목록 미리 불러와짐: ${accountsPreloaded} — false 여야 이번 문제를 재현하는 조건)`);
  await p2.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-replied"]')?.click());
  await w(2500);
  const opened = await p2.evaluate(() => {
    const btn = document.querySelector('button.conversation-btn');
    if (btn) { btn.click(); return true; }
    return false;
  });
  ok(opened, '대화 보기 버튼을 누름');
  if (opened) {
    ok(await waitFor(p2, () => !!document.getElementById('convReplySig'), 20000), '[서명 붙이기] 체크가 있음');
    // 서버에서 서명을 받아올 때까지 기다린다
    const loaded = await waitFor(p2, () => {
      const lbl = document.getElementById('convSigLabel');
      return lbl && !/불러오는 중/.test(lbl.textContent);
    }, 20000);
    ok(loaded, '서명을 서버에서 받아옴');
    const layout = await p2.evaluate(() => {
      const chk = document.getElementById('convReplySig');
      const body = document.getElementById('convReplyBody');
      const frame = document.getElementById('convReplyFrame');
      const sig = document.getElementById('convSigPreview');
      if (!chk || !body) return null;
      return {
        checked: chk.checked,
        above: chk.getBoundingClientRect().top < body.getBoundingClientRect().top,
        sigVisible: !!sig && !sig.hidden,
        insideFrame: !!frame && !!sig && frame.contains(sig) && frame.contains(body),
        sigBelow: !!sig && sig.getBoundingClientRect().top >= body.getBoundingClientRect().bottom - 1,
        notEditable: !!sig && !body.contains(sig),
        label: document.getElementById('convSigLabel')?.textContent.trim() || '',
        sigText: document.getElementById('convSigBody')?.innerText.trim() || '',
        explain: /맨 아래에 보내는 사람 정보/.test(document.body.innerText),
      };
    });
    ok(layout?.checked === true, '기본으로 켜져 있음');
    ok(layout?.above === true, '체크가 본문 **위**에 있음');
    ok(layout?.explain === true, '무엇이 붙는지 설명이 함께 있음');
    ok(layout?.sigVisible === true, '켜져 있으면 서명이 보임');
    ok(layout?.insideFrame === true, '서명이 **본문 칸과 같은 테두리 안**에 있음');
    ok(layout?.sigBelow === true, '서명이 본문 칸 **맨 아래**에 있음');
    ok(layout?.notEditable === true, '서명은 입력 칸 밖이라 실수로 지워지지 않음 (서명이 두 번 붙지 않음)');
    ok(/@/.test(layout?.label || ''), `보내는 계정 주소가 표시됨 — "${layout?.label}"`);
    ok(sigName ? String(layout?.sigText || '').includes(sigName) : String(layout?.sigText || '').length > 0,
      `서명 내용이 실제로 채워짐 — ${String(layout?.sigText || '').split('\n').filter(Boolean).slice(0, 3).join(' / ')}`);

    // 끄면 사라지는가
    const off = await p2.evaluate(() => {
      const chk = document.getElementById('convReplySig');
      chk.checked = false;
      chk.dispatchEvent(new Event('change'));
      const sig = document.getElementById('convSigPreview');
      return { hidden: !!sig && sig.hidden, note: document.getElementById('convReplySigNote')?.innerText.trim() || '' };
    });
    ok(off.hidden === true, '끄면 서명이 사라짐');
    ok(/서명 없이 나갑니다/.test(off.note), '끄면 "서명 없이 나갑니다" 로 바뀜');
  }
  await p2.close();

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
