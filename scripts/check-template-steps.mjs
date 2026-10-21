/**
 * [📝 메일 양식] 1차·2차·3차 화면 확인 (2026-10-21 요청 "1차 첫 소개 · 2차 팔로우업 · 3차 — 수정만 하게").
 *
 *   1) 양식이 1차 → 2차 → 3차 순서로 세 장 보이고, 실제로 나가는 순서(1차 → 2차 → 3차) 안내가 있는가
 *   2) [+ 새 양식 작성] · [삭제] 가 없고 [✏ 수정] 만 있는가
 *   3) 3차를 열면 용도 고르기 대신 '3차 마지막 팔로우업' 이 고정으로 보이는가
 *   4) 서버도 새로 만들기·지우기를 막는가 (POST · DELETE → 400)
 *   5) 발송 화면에서 양식 이름이 차수와 함께 보이고, 처음 보낼 때 기본은 1차인가
 *
 * 메일을 보내지 않는다 — 발송·예약 요청은 가로채 막는다. 양식 문구는 바꾸지 않는다.
 * 사용: CRM_BASE=http://localhost:3000 [SHOT=경로.png] node scripts/check-template-steps.mjs
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

const jwt = await new SignJWT({ user: 'admin', role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('dialog', async (d) => { await d.dismiss(); });
await p.setRequestInterception(true);
p.on('request', (r) => {
  const u = r.url();
  if (/\/api\/cron\//.test(u) || (/\/api\/mail\/(send|schedule|campaign|reply|test-send|compose)/.test(u) && r.method() !== 'GET')) return r.abort();
  r.continue();
});
await p.setCookie({ name: 'admin_session', value: jwt, domain: new URL(B).hostname, path: '/' });
await p.setViewport({ width: 1440, height: 1000 });
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); } return false; };

try {
  await p.goto(B + '/', { waitUntil: 'networkidle2' });
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-b2b-email"]').click());
  ok(await waitFor(() => document.querySelectorAll('.tpl-card').length >= 3), '메일 양식 화면 열림');

  const list = await p.evaluate(() => ({
    cards: [...document.querySelectorAll('.tpl-card')].map((c) => c.innerText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3).join(' | ')),
    newBtn: [...document.querySelectorAll('button')].some((x) => /새 양식/.test(x.innerText)),
    del: document.querySelectorAll('.tpl-del').length,
    edit: document.querySelectorAll('.tpl-edit').length,
    flow: /1차 첫 소개[\s\S]*답 없으면[\s\S]*2차 팔로우업[\s\S]*3차 마지막 팔로우업/.test(document.getElementById('content')?.innerText || ''),
  }));
  ok(/^1차 첫 소개/.test(list.cards[0] || '') && /^2차 팔로우업/.test(list.cards[1] || '') && /^3차 마지막 팔로우업/.test(list.cards[2] || ''),
    `1차 → 2차 → 3차 순서\n        ${list.cards.join('\n        ')}`);
  ok(list.flow, '실제로 나가는 순서 안내 (1차 → 답 없으면 → 2차 → 3차)');
  ok(!list.newBtn && list.del === 0 && list.edit >= 3, `[+ 새 양식] 없음 · [삭제] ${list.del}개 · [✏ 수정] ${list.edit}개`);
  if (SHOT) await p.screenshot({ path: SHOT, fullPage: true });

  // 3차 열기 — 용도 고르기 대신 차수 고정
  await p.evaluate(() => document.querySelectorAll('.tpl-edit')[2].click());
  ok(await waitFor(() => !!document.getElementById('templateSubjectInput')), '3차 편집 화면 열림');
  const ed = await p.evaluate(() => ({
    purposeSel: !!document.getElementById('templatePurposeSel'),
    step: /차수\s*3차 마지막 팔로우업/.test(document.getElementById('tplEditorBox')?.innerText || ''),
    subject: document.getElementById('templateSubjectInput')?.value,
  }));
  ok(ed.step && !ed.purposeSel, `차수 '3차 마지막 팔로우업' 고정 · 용도 고르기 없음 (제목: ${ed.subject})`);
  if (SHOT) await p.screenshot({ path: SHOT.replace(/\.png$/, '-edit.png') });

  // 서버도 막는가 — POST 가 새 안내로 막히면(새 코드가 올라온 것) DELETE 도 확인한다
  const api = await p.evaluate(async () => {
    const post = await fetch('/api/email-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x', subject: 'x', body: 'x' }) });
    const pj = await post.json().catch(() => ({}));
    const tpls = (await (await fetch('/api/email-templates')).json()).templates || [];
    let del = null;
    if (post.status === 400 && /1차·2차·3차/.test(pj.error || '')) {
      const one = tpls.find((t) => t.step === 1);
      const r = await fetch(`/api/email-templates/${one._id}`, { method: 'DELETE' });
      del = { status: r.status, error: (await r.json().catch(() => ({}))).error };
    }
    return { post: post.status, postError: pj.error, del, steps: tpls.map((t) => t.step).join(',') };
  });
  ok(api.post === 400, `새로 만들기 막힘 (${api.post} · ${api.postError})`);
  ok(api.del && api.del.status === 400, `1차 지우기 막힘 (${api.del ? `${api.del.status} · ${api.del.error}` : '확인 못 함'})`);
  ok(api.steps === '1,2,3', `서버 양식 차수 ${api.steps}`);

  // 발송 화면에 쓰는 이름·기본값
  const pick = await p.evaluate(() => ({
    first: firstStepTemplate(state.email.templates)?.step,
    labels: state.email.templates.map((t) => templateOptionLabel(t)),
  }));
  ok(pick.first === 1, `처음 보낼 때 기본 양식 = ${pick.first}차`);
  ok(pick.labels.every((l) => /^\d차 · /.test(l) && !/^\d차 · \d차/.test(l)), `고르는 칸 이름: ${pick.labels.join(' / ')}`);

  ok(!errs.length, `화면 오류 없음${errs.length ? ` — ${errs.join(' / ')}` : ''}`);
} catch (e) {
  fail++;
  console.log('  X   ' + (e?.message || e));
} finally {
  await b.close();
}
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
