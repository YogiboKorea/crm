/**
 * 🤖 AI 메일 비서 화면 확인 (2026-11-12) — **질문을 실제로 보내지 않는다** (돈 안 듦, 서버 답은 가짜로 바꿔 끼운다).
 *
 *   1) 사이드바 [기한 관리] 바로 아래에 [🤖 AI 메일 비서] — david·admin 에게만 보이고 hoon 에게는 안 보이는가
 *   2) Claude 채팅 모양 — 입력창 안 모델 고르기(기본 Opus 5.5) · ↑ 보내기, 입력칸 아래 안내 줄은 없다
 *   3) [📘 사용 방법] 팝업 — 할 수 있는 것 / 하지 않는 것 / 요령·비용 · 이번 달 사용액 · 예시는 입력칸에만
 *   4) 질문을 보내면 — 찾고 읽은 단계가 답 위에 보이고 끝나면 한 줄로 접힘 · 답 글자 · 근거 메일 · 📋 복사 · 사용료
 *   5) 고른 모델이 서버로 가는가 (Sonnet 으로 바꾸면 다음 질문은 Sonnet)
 *   6) 근거 메일을 누르면 팝업 — 대표님은 받은 메일함의 메일 창, admin 은 읽기 전용 창(원문/번역)
 *   7) hoon 이 주소로 들어오면 막히는가 · 한 달 한도(10만 원) 80% 경고 · 100% 잠김
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

// 가짜 답 — 서버가 실제로 흘려 보내는 모양과 같다 (app/api/ai/chat/route.ts · lib/ai/mail-chat.ts)
const fake = (model) => [
  { type: 'status', text: '메일 찾는 중 — Dangaard' },
  { type: 'step', kind: 'search', text: '"Dangaard" — 12통' },
  { type: 'status', text: '메일 읽는 중' },
  { type: 'step', kind: 'read', text: '11/10 Lars — PDRN product info sheet' },
  { type: 'status', text: '생각하는 중' },
  { type: 'text', text: '**Dangaard** 와는 지금 이렇게 진행 중입니다.\n\n' },
  { type: 'text', text: '- 11/10 Lars 가 PDRN 제품 정보 시트를 요청\n- 아직 답장 전입니다\n\n' },
  { type: 'text', text: '추천: 이번 주 안에 시트를 보내고 일정을 확정하세요.' },
  { type: 'sources', items: [{ id: '000000000000000000000000', date: '2026-11-10', from: 'Lars <lars@dangaard.dk>', subject: 'PDRN product info sheet' }] },
  { type: 'done', conversationId: '', model, usage: { usd: 0.12, krw: 168, inputTokens: 21000, outputTokens: 900 } },
].map((e) => JSON.stringify(e)).join('\n') + '\n';
const FAKE_MAIL = { success: true, mail: { id: '000000000000000000000000', subject: 'PDRN product info sheet', date: '2026-11-10T05:00:00Z', from: 'Lars <lars@dangaard.dk>', to: ['david@yogico.kr'], cc: [], group: 'Dangaard Beauty', attachments: ['PDRN_sheet.pdf'], text: 'Hi David, please send the PDRN info sheet.', translation: '데이비드님, PDRN 정보 시트를 보내 주세요.', cut: false, bodyError: '' } };

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
        success: true, user, model: 'claude-opus-5-5', defaultModel: 'claude-opus-5-5',
        models: [{ id: 'claude-opus-5-5', label: 'Opus 5.5' }, { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' }, { id: 'claude-haiku-5-5', label: 'Haiku 5.5' }],
        mailboxOwner: 'david', canOpenMails: user === 'david', keySet: true,
        conversations: [], month: { usd: usedKrw / 1400, krw: usedKrw, questions: 300, capKrw: 100000, mine: { krw: usedKrw, questions: 300 } },
      }) });
    }
    if (/\/api\/ai\/chat\?mail=/.test(u)) return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_MAIL) });
    if (/\/api\/ai\/chat/.test(u) && r.method() === 'POST') {
      const body = JSON.parse(r.postData() || '{}');
      p.posted.push(body);
      return r.respond({ status: 200, contentType: 'application/x-ndjson; charset=utf-8', body: fake(body.model) });
    }
    // 메일 보내기·예약 처리는 막는다
    if (/\/api\/cron\//.test(u) || (/\/api\/mail\/(send|schedule|campaign|reply|test-send|compose)/.test(u) && r.method() !== 'GET')) return r.abort();
    r.continue();
  });
  await p.setCookie({ name: 'admin_session', value: await jwtFor(user), domain: new URL(B).hostname, path: '/' });
  await p.setViewport({ width: 1440, height: 1000 });
  await p.goto(B + '/', { waitUntil: 'networkidle2' });
  await p.evaluate(() => { try { localStorage.removeItem('aiChatModel'); } catch {} });
  await w(1200);
  return p;
};
const waitFor = async (p, fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); } return false; };
const navState = (p) => p.evaluate(() => {
  const el = document.getElementById('navAiChat');
  const items = [...document.querySelectorAll('.nav-item[data-view]')].filter((x) => getComputedStyle(x).display !== 'none').map((x) => x.dataset.view);
  return { shown: !!el && getComputedStyle(el).display !== 'none', after: items[items.indexOf('tool-ai-chat') - 1] };
});
const ask = async (p, q) => {
  await p.click('#aiChatInput');
  await p.keyboard.type(q);
  await p.keyboard.press('Enter');
  return waitFor(p, () => /추천: 이번 주 안에/.test(document.getElementById('aiChatScroll')?.innerText || '') && !!document.querySelector('.ai-chat-copy'));
};

try {
  // 1) 메뉴 — 누구에게 보이는가
  for (const [user, want] of [['david', true], ['admin', true], ['hoon', false]]) {
    const p = await open(user);
    const n = await navState(p);
    ok(n.shown === want, `${user}: 메뉴 ${n.shown ? '보임' : '안 보임'}${n.shown ? ` (바로 위: ${n.after})` : ''}`);
    if (user === 'david') ok(n.after === 'tool-deadlines', '자리 — [기한 관리] 바로 아래');
    if (user === 'hoon') {
      await p.evaluate(() => { state.view = 'tool-ai-chat'; render(); });
      ok(await waitFor(p, () => /대표님 아이디에서만/.test(document.getElementById('content')?.innerText || '')), 'hoon: 화면에 들어와도 "대표님 아이디에서만" 으로 막힘');
    }
    await p.close();
  }

  // 2) 대표님 화면 — Claude 채팅 모양
  const p = await open('david');
  await p.evaluate(() => document.getElementById('navAiChat').click());
  ok(await waitFor(p, () => document.querySelectorAll('.ai-chat-ex').length >= 3), 'AI 메일 비서 화면 열림 — 예시 질문 보임');
  const look = await p.evaluate(() => ({
    sel: document.getElementById('aiChatModelSel')?.selectedOptions?.[0]?.textContent || '',
    opts: [...(document.getElementById('aiChatModelSel')?.options || [])].map((o) => o.textContent),
    send: document.getElementById('aiChatSend')?.textContent,
    footer: /메일 내용이 Claude API 로 전달되어/.test(document.getElementById('content')?.innerText || ''),
  }));
  ok(/Opus 5\.5 \(기본\)/.test(look.sel) && look.opts.length === 3 && look.send === '↑', `입력창 — 모델 ${look.opts.join(' / ')} · 기본 ${look.sel} · 보내기 ↑`);
  ok(!look.footer, '입력칸 아래 안내 줄 없음');
  if (SHOT) await p.screenshot({ path: SHOT });

  // 3) 사용 방법 팝업 — 이번 달 사용액은 여기서
  await p.click('#aiChatGuideBtn');
  ok(await waitFor(p, () => !!document.getElementById('aiChatGuideRoot')), '[📘 사용 방법] 누르면 팝업');
  const g = await p.evaluate(() => document.getElementById('aiChatGuideRoot')?.innerText || '');
  ok(/할 수 있는 것/.test(g) && /하지 않는 것/.test(g) && /모델 고르기/.test(g) && /이번 달 사용 약 ₩[\d,]+ \(질문 \d+번\) \/ 한도 ₩100,000/.test(g), '팝업 — 할 수 있는 것 · 하지 않는 것 · 모델 고르기 · 이번 달 사용액 / 한도');
  await p.keyboard.press('Escape');
  ok(await waitFor(p, () => !document.getElementById('aiChatGuideRoot'), 3000), 'Esc 로 닫힘');
  await p.click('#aiChatGuideBtn');
  await waitFor(p, () => !!document.getElementById('aiChatGuideRoot'));
  const before = p.posted.length;
  await p.evaluate(() => document.querySelectorAll('#aiChatGuideRoot .ai-chat-guide-ex')[4].click());
  await w(300);
  const ex = await p.evaluate(() => ({ v: document.getElementById('aiChatInput')?.value || '', open: !!document.getElementById('aiChatGuideRoot') }));
  ok(ex.v.length > 5 && !ex.open && p.posted.length === before, `예시를 누르면 팝업이 닫히고 입력칸에만 들어감 ("${ex.v}") · 보내지 않음`);
  await p.evaluate(() => { const i = document.getElementById('aiChatInput'); i.value = ''; _aiChat.draft = ''; });

  // 4) 질문 보내기 — 단계 · 답 · 근거 메일 · 복사
  ok(await ask(p, 'Dangaard 와는 지금 어디까지 얘기됐어?'), '답 글자가 그려지고 📋 복사 버튼이 생김');
  const a = await p.evaluate(() => {
    const sc = document.getElementById('aiChatScroll');
    const d = sc.querySelector('details.ai-steps');
    return {
      steps: d ? d.querySelector('summary').innerText : '',
      folded: d ? !d.open : false,
      html: sc.innerHTML,
      text: sc.innerText,
      src: !!sc.querySelector('.ai-chat-src'),
      inputOn: !document.getElementById('aiChatInput')?.disabled,
      send: document.getElementById('aiChatSend')?.textContent,
    };
  });
  ok(/메일 1번 찾음 · 1통 읽음/.test(a.steps) && a.folded, `찾고 읽은 단계 — 끝나면 한 줄로 접힘 ("${a.steps.trim()}")`);
  ok(/<b>Dangaard<\/b>/.test(a.html) && /<li/.test(a.html), '굵게·목록 모양으로 보임');
  ok(a.src && /근거 메일 1통/.test(a.text) && /Opus 5\.5/.test(a.text) && /약 ₩168/.test(a.text), '근거 메일 · 답한 모델 · 사용료 표시');
  ok(a.inputOn && a.send === '↑', '입력칸 다시 풀리고 버튼은 ↑ 로 돌아옴');
  ok(p.posted[0]?.message === 'Dangaard 와는 지금 어디까지 얘기됐어?' && p.posted[0]?.model === 'claude-opus-5-5', `보낸 질문 그대로 · 모델 ${p.posted[0]?.model}`);
  if (SHOT) await p.screenshot({ path: SHOT.replace(/\.png$/, '-answer.png') });

  // 5) 모델 바꾸기 — 다음 질문은 Sonnet, 이 브라우저에 기억
  await p.select('#aiChatModelSel', 'claude-sonnet-5-5');
  ok(await ask(p, '그럼 답장 방향은?'), '두 번째 질문 답 받음');
  const saved = await p.evaluate(() => { try { return localStorage.getItem('aiChatModel'); } catch { return ''; } });
  ok(p.posted[1]?.model === 'claude-sonnet-5-5' && saved === 'claude-sonnet-5-5', `모델 바꾸면 다음 질문은 ${p.posted[1]?.model} · 기억 ${saved}`);

  // 6) 근거 메일 → 대표님은 받은 메일함의 메일 창
  await p.evaluate(() => document.querySelector('.ai-chat-src').click());
  ok(await waitFor(p, () => !!document.getElementById('mailDetailRoot')), '대표님: 근거 메일 누르면 메일 창(받은 메일함 것)이 뜸');
  ok(!p.errs.length, `화면 오류 없음${p.errs.length ? ` — ${p.errs.join(' / ')}` : ''}`);
  await p.close();

  // 6') admin 은 읽기 전용 창 — 원문 / 한국어 번역
  const q = await open('admin');
  await q.evaluate(() => document.getElementById('navAiChat').click());
  await waitFor(q, () => !!document.getElementById('aiChatInput'));
  await ask(q, '테스트');
  await q.evaluate(() => document.querySelector('.ai-chat-src').click());
  ok(await waitFor(q, () => /PDRN product info sheet/.test(document.getElementById('aiChatMailRoot')?.innerText || '')), 'admin: 근거 메일 누르면 읽기 전용 메일 창');
  await q.evaluate(() => document.querySelector('#aiChatMailRoot .ai-mail-tab[data-tab="ko"]').click());
  ok(/PDRN 정보 시트를 보내 주세요/.test(await q.evaluate(() => document.getElementById('aiChatMailBody')?.innerText || '')), '한국어 번역 탭');
  if (SHOT) await q.screenshot({ path: SHOT.replace(/\.png$/, '-mail.png') });
  await q.keyboard.press('Escape');
  ok(await waitFor(q, () => !document.getElementById('aiChatMailRoot'), 3000), 'Esc 로 닫힘');
  ok(!q.errs.length, `화면 오류 없음${q.errs.length ? ` — ${q.errs.join(' / ')}` : ''}`);
  await q.close();

  // 7) 한도 — 사용액만 가짜로
  for (const [usedKrw, want] of [[85000, 'near'], [100000, 'over']]) {
    const r = await open('david', usedKrw);
    await r.evaluate(() => { _aiChat.loaded = false; document.getElementById('navAiChat').click(); });
    await waitFor(r, () => !!document.getElementById('aiChatInput'));
    const s = await r.evaluate(() => ({
      banner: document.getElementById('aiChatCap')?.innerText || '',
      locked: !!document.getElementById('aiChatInput')?.disabled && !!document.getElementById('aiChatSend')?.disabled,
    }));
    if (want === 'near') ok(/85%/.test(s.banner) && !s.locked, `₩85,000 — 경고만 (${s.banner.trim()})`);
    else ok(/한도\(₩100,000\)를 다 썼습니다/.test(s.banner) && s.locked, `₩100,000 — 입력칸 잠김 (${s.banner.trim().slice(0, 40)}…)`);
    await r.close();
  }
} catch (e) {
  fail++;
  console.log('  X   ' + (e?.stack || e));
} finally {
  await b.close();
}
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
