/**
 * 🤖 AI 메일 비서 화면 확인 (2026-11-12) — **질문을 실제로 보내지 않는다** (돈 안 듦).
 *
 *   1) 사이드바 [기한 관리] 바로 아래에 [🤖 AI 메일 비서] — david·admin 에게만 보이고 hoon 에게는 안 보이는가
 *   2) 열면 예시 질문·사용량·모델이 보이는가
 *   3) 질문을 보내면(서버 답은 가짜로 바꿔 끼운다) 진행 표시 → 답 글자 → 근거 메일이 그려지고, 입력칸이 다시 풀리는가
 *   4) hoon 이 주소로 들어오면 막히는가
 *   5) 한 달 한도(10만 원) — 80% 넘으면 경고, 다 쓰면 입력칸이 잠기는가 (사용액은 가짜로 바꿔 끼운다)
 *
 * 사용: CRM_BASE=http://localhost:3000 [SHOT=경로.png] node scripts/check-ai-chat-screen.mjs
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
const jwtFor = (user) => new SignJWT({ user, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));

// 가짜 답 — 서버가 실제로 흘려 보내는 모양과 같다 (app/api/ai/chat/route.ts)
const FAKE = [
  { type: 'status', text: '🔎 메일 찾는 중 — Dangaard' },
  { type: 'status', text: '📖 메일 읽는 중' },
  { type: 'text', text: '**Dangaard** 와는 지금 이렇게 진행 중입니다.\n\n' },
  { type: 'text', text: '- 11/10 Lars 가 PDRN 제품 정보 시트를 요청\n- 아직 답장 전입니다\n\n' },
  { type: 'text', text: '추천: 이번 주 안에 시트를 보내고 일정을 확정하세요.' },
  { type: 'sources', items: [{ id: '000000000000000000000000', date: '2026-11-10', from: 'Lars <lars@dangaard.dk>', subject: 'PDRN product info sheet' }] },
  { type: 'done', conversationId: '', model: 'claude-opus-5-5', usage: { usd: 0.12, krw: 168, inputTokens: 21000, outputTokens: 900 } },
].map((e) => JSON.stringify(e)).join('\n') + '\n';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
// usedKrw 를 주면 대화 목록 응답의 이번 달 사용액만 그 값으로 바꿔 끼운다 (한도 화면 확인용)
const open = async (user, usedKrw = null) => {
  const p = await b.newPage();
  p.errs = [];
  p.posted = [];
  p.on('pageerror', (e) => p.errs.push(String(e)));
  p.on('dialog', async (d) => { await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = r.url();
    if (usedKrw !== null && /\/api\/ai\/chat$/.test(u) && r.method() === 'GET') {
      return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, user, model: 'claude-opus-5-5', mailboxOwner: 'david', canOpenMails: user === 'david', keySet: true,
        conversations: [], month: { usd: usedKrw / 1400, krw: usedKrw, questions: 300, capKrw: 100000, mine: { krw: usedKrw, questions: 300 } },
      }) });
    }
    if (/\/api\/ai\/chat/.test(u) && r.method() === 'POST') {
      p.posted.push(r.postData());
      return r.respond({ status: 200, contentType: 'application/x-ndjson; charset=utf-8', body: FAKE });
    }
    // 메일 보내기·예약 처리는 막는다
    if (/\/api\/cron\//.test(u) || (/\/api\/mail\/(send|schedule|campaign|reply|test-send|compose)/.test(u) && r.method() !== 'GET')) return r.abort();
    r.continue();
  });
  await p.setCookie({ name: 'admin_session', value: await jwtFor(user), domain: new URL(B).hostname, path: '/' });
  await p.setViewport({ width: 1440, height: 1000 });
  await p.goto(B + '/', { waitUntil: 'networkidle2' });
  await w(1200);
  return p;
};
const waitFor = async (p, fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); } return false; };
const navState = (p) => p.evaluate(() => {
  const el = document.getElementById('navAiChat');
  const items = [...document.querySelectorAll('.nav-item[data-view]')].filter((x) => getComputedStyle(x).display !== 'none').map((x) => x.dataset.view);
  return { shown: !!el && getComputedStyle(el).display !== 'none', after: items[items.indexOf('tool-ai-chat') - 1] };
});

try {
  // 1) 메뉴 — 누구에게 보이는가
  for (const [user, want] of [['david', true], ['admin', true], ['hoon', false]]) {
    const p = await open(user);
    const n = await navState(p);
    ok(n.shown === want, `${user}: 메뉴 ${n.shown ? '보임' : '안 보임'}${n.shown ? ` (바로 위: ${n.after})` : ''}`);
    if (user === 'david') ok(n.after === 'tool-deadlines', '자리 — [기한 관리] 바로 아래');
    if (user === 'hoon') {
      // 4) 주소로 바로 들어와도 막힌다
      await p.evaluate(() => { state.view = 'tool-ai-chat'; render(); });
      ok(await waitFor(p, () => /대표님 아이디에서만/.test(document.getElementById('content')?.innerText || '')), 'hoon: 화면에 들어와도 "대표님 아이디에서만" 으로 막힘');
    }
    await p.close();
  }

  // 2) 대표님 화면
  const p = await open('david');
  await p.evaluate(() => document.getElementById('navAiChat').click());
  ok(await waitFor(p, () => document.querySelectorAll('.ai-chat-ex').length >= 3), 'AI 메일 비서 화면 열림 — 예시 질문 보임');
  const foot = await p.evaluate(() => document.getElementById('content')?.innerText || '');
  ok(/Opus 5\.5/.test(foot) && /이번 달 약 ₩[\d,]+ \/ 한도 ₩100,000/.test(foot), '모델·이번 달 사용량 · 한도 ₩100,000 표시');
  if (SHOT) await p.screenshot({ path: SHOT });

  // 📘 사용 방법 — 채팅 창 위쪽 버튼 → 팝업. 화면 아래에는 펼쳐 두지 않는다. 예시는 눌러도 보내지 않고 입력칸에만
  const top = await p.evaluate(() => {
    const btn = document.getElementById('aiChatGuideBtn');
    const scroll = document.getElementById('aiChatScroll');
    return {
      btn: !!btn,
      above: !!btn && !!scroll && btn.getBoundingClientRect().top < scroll.getBoundingClientRect().top,
      inline: !!document.querySelector('#content #aiChatGuide'),
    };
  });
  ok(top.btn && top.above && !top.inline, '[📘 사용 방법] 버튼 — 채팅 창 위쪽 · 화면 아래에 펼쳐 두지 않음');
  await p.click('#aiChatGuideBtn');
  ok(await waitFor(p, () => !!document.getElementById('aiChatGuideRoot')), '누르면 팝업이 열림');
  const g = await p.evaluate(() => ({
    text: document.getElementById('aiChatGuideRoot')?.innerText || '',
    ex: document.querySelectorAll('#aiChatGuideRoot .ai-chat-guide-ex').length,
    locked: document.body.classList.contains('modal-open'),
  }));
  ok(/할 수 있는 것/.test(g.text) && /하지 않는 것/.test(g.text) && /잘 쓰는 요령/.test(g.text) && /₩100,000/.test(g.text) && g.locked,
    `팝업 — 할 수 있는 것 / 하지 않는 것 / 요령·비용 · 예시 ${g.ex}개 · 뒤 화면 스크롤 잠김`);
  if (SHOT) await p.screenshot({ path: SHOT.replace(/\.png$/, '-guide.png') });
  await p.keyboard.press('Escape');
  ok(await waitFor(p, () => !document.getElementById('aiChatGuideRoot') && !document.body.classList.contains('modal-open'), 3000), 'Esc 로 닫힘');
  await p.click('#aiChatGuideBtn');
  await waitFor(p, () => !!document.getElementById('aiChatGuideRoot'));
  const before = p.posted.length;
  await p.evaluate(() => document.querySelectorAll('#aiChatGuideRoot .ai-chat-guide-ex')[4].click());
  await w(300);
  const after = await p.evaluate(() => ({ v: document.getElementById('aiChatInput')?.value || '', open: !!document.getElementById('aiChatGuideRoot') }));
  ok(after.v.length > 5 && !after.open && p.posted.length === before, `예시를 누르면 팝업이 닫히고 입력칸에만 들어감 ("${after.v}") · 보내지 않음`);
  await p.evaluate(() => { const i = document.getElementById('aiChatInput'); i.value = ''; _aiChat.draft = ''; });

  // 3) 질문 보내기 — 서버 답은 가짜
  await p.click('#aiChatInput');
  await p.keyboard.type('Dangaard 와는 지금 어디까지 얘기됐어?');
  await p.keyboard.press('Enter');
  ok(await waitFor(p, () => /추천: 이번 주 안에/.test(document.getElementById('aiChatScroll')?.innerText || '')), '답 글자가 그려짐');
  ok(await waitFor(p, () => !!document.querySelector('.ai-chat-src') && !document.getElementById('aiChatInput')?.disabled), '근거 메일(누르면 열림) 표시 · 입력칸 다시 풀림');
  const body = JSON.parse(p.posted[0] || '{}');
  ok(body.message === 'Dangaard 와는 지금 어디까지 얘기됐어?', `보낸 질문 그대로 (${body.message})`);
  const html = await p.evaluate(() => document.getElementById('aiChatScroll')?.innerHTML || '');
  ok(/<b>Dangaard<\/b>/.test(html) && /<li/.test(html), '굵게·목록 모양으로 보임');
  ok(/이번 답 약 ₩168/.test(await p.evaluate(() => document.getElementById('aiChatScroll')?.innerText || '')), '이번 답 사용료 표시');
  if (SHOT) await p.screenshot({ path: SHOT.replace(/\.png$/, '-answer.png') });
  ok(!p.errs.length, `화면 오류 없음${p.errs.length ? ` — ${p.errs.join(' / ')}` : ''}`);
  await p.close();

  // 5) 한도 — 사용액만 가짜로
  for (const [usedKrw, want] of [[85000, 'near'], [100000, 'over']]) {
    const q = await open('david', usedKrw);
    await q.evaluate(() => { _aiChat.loaded = false; document.getElementById('navAiChat').click(); });
    await waitFor(q, () => !!document.getElementById('aiChatInput'));
    const s = await q.evaluate(() => ({
      banner: document.getElementById('aiChatCap')?.innerText || '',
      locked: !!document.getElementById('aiChatInput')?.disabled && !!document.getElementById('aiChatSend')?.disabled,
    }));
    if (want === 'near') ok(/85%/.test(s.banner) && !s.locked, `₩85,000 — 경고만 (${s.banner.trim()})`);
    else ok(/한도\(₩100,000\)를 다 썼습니다/.test(s.banner) && s.locked, `₩100,000 — 입력칸 잠김 (${s.banner.trim().slice(0, 40)}…)`);
    if (SHOT && want === 'over') await q.screenshot({ path: SHOT.replace(/\.png$/, '-cap.png') });
    await q.close();
  }
} catch (e) {
  fail++;
  console.log('  X   ' + (e?.stack || e));
} finally {
  await b.close();
}
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
