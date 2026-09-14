/**
 * 메일 양식 편집기의 [🖼 이미지] · [📎 첨부파일] 을 실제 브라우저로 확인한다 (발송 없음).
 * 새 양식 → 본문 → 이미지 주소 넣기 → 첨부 추가/빼기 → 저장 → 목록 배지 → 발송관리 안내 → 양식 지우기
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const NAME = '[자동확인] 이미지·첨부 UI — 지워짐';
const PNG = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
const PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const jwt = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
await mongoose.connect(process.env.MONGODB_URI);
const T = mongoose.connection.collection('emailtemplates');
const L = mongoose.connection.collection('leads');
const before = await L.findOne({ leadId: 'test-send-0914' }, { projection: { emailHistory: 1, lastEmailSentAt: 1, stage: 1 } });

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
const dialogs = [];
let promptAnswer = '';
p.on('pageerror', (e) => errs.push(String(e)));
p.on('dialog', async (d) => {
  dialogs.push(d.message().slice(0, 60));
  if (d.type() === 'prompt') await d.accept(promptAnswer);
  else await d.accept();
});
await p.setRequestInterception(true);
p.on('request', (r) => (/\/api\/mail\/(send|schedule|campaign|reply)/.test(r.url()) && r.method() !== 'GET') ? r.abort() : r.continue());
await p.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });
await p.setViewport({ width: 1440, height: 1000 });
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); } return false; };

try {
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await w(1000);
  await p.evaluate(() => document.querySelector('.nav-item[data-view="tool-b2b-email"]').click());
  ok(await waitFor(() => !!document.getElementById('tplNewBtn')), '메일 양식 목록 열림');
  await p.evaluate(() => document.getElementById('tplNewBtn').click());
  ok(await waitFor(() => !!document.getElementById('tplInsertImage') && !!document.getElementById('tplAttachBox')), '편집기에 [🖼 이미지] 버튼과 📎 첨부파일 칸이 있음');

  await p.evaluate((name) => {
    const n = document.getElementById('templateNameInput'); n.value = name; n.dispatchEvent(new Event('input', { bubbles: true }));
    const s = document.getElementById('templateSubjectInput'); s.value = 'Image attachment test'; s.dispatchEvent(new Event('input', { bubbles: true }));
  }, NAME);
  await p.click('#templateBodyRich');
  await p.keyboard.type('Hello [회사명], please see our products.');

  // 이미지 넣기 — prompt 에 주소를 답한다
  promptAnswer = PNG;
  await p.evaluate(() => document.getElementById('tplInsertImage').click());
  ok(await waitFor(() => !!document.querySelector('#templateBodyRich img')), '이미지 주소를 넣으면 본문에 그림이 들어감');
  const img = await p.evaluate(() => { const i = document.querySelector('#templateBodyRich img'); return i ? { src: i.getAttribute('src'), width: i.getAttribute('width'), style: i.getAttribute('style') } : {}; });
  ok(String(img.src || '').startsWith('https://www.google.com/') && Number(img.width) <= 600 && /max-width:\s*100%/.test(img.style || ''), `그림은 주소·폭(${img.width})·max-width 로 들어감`);

  // 안 열리는 이미지 주소
  promptAnswer = 'https://www.w3.org/nope-0914.png';
  const nDialogs = dialogs.length;
  await p.evaluate(() => document.getElementById('tplInsertImage').click());
  await w(3000);
  ok(dialogs.slice(nDialogs).some((m) => /불러오지 못했습니다/.test(m)) && (await p.$$('#templateBodyRich img')).length === 1, '안 열리는 이미지 주소는 넣지 않고 알려줌');

  // 첨부 추가 2개 → 하나 빼기
  await p.type('#tplAttUrl', PDF);
  await p.type('#tplAttName', 'Yogico Catalog.pdf');
  await p.evaluate(() => document.getElementById('tplAttAdd').click());
  ok(await waitFor(() => document.querySelectorAll('.tpl-att-row').length === 1), '첨부 1개 추가됨');
  ok(await p.evaluate(() => !!document.querySelector('#templateBodyRich img')), '첨부 추가 뒤에도 본문 그림이 그대로 있음');
  await p.type('#tplAttUrl', PNG);
  await p.keyboard.press('Enter');
  ok(await waitFor(() => document.querySelectorAll('.tpl-att-row').length === 2), 'Enter 로도 추가 (2개)');
  const names = await p.$$eval('.tpl-att-row b', (x) => x.map((e) => e.textContent));
  ok(names[1] === 'googlelogo_color_272x92dp.png', `이름 비우면 주소의 파일 이름 → ${names[1]}`);
  ok(await p.evaluate(() => /함께 붙는 파일/.test(document.querySelector('.tpl-preview-atts')?.textContent || '')), '미리보기에 "함께 붙는 파일" 표시');
  await p.evaluate(() => document.querySelectorAll('.tpl-att-del')[1].click());
  ok(await waitFor(() => document.querySelectorAll('.tpl-att-row').length === 1), '[빼기] 로 하나 뺌');

  await p.evaluate(() => document.getElementById('saveTemplateBtn').click());
  ok(await waitFor(() => !!document.getElementById('tplNewBtn')), '저장하면 목록으로 돌아감');
  const saved = await T.findOne({ name: NAME });
  ok(saved && saved.attachments?.length === 1 && saved.attachments[0].name === 'Yogico Catalog.pdf' && saved.attachments[0].url === PDF, `DB 에 첨부 저장됨 ${JSON.stringify(saved?.attachments)}`);
  ok(saved && /<img[^>]+src="https:\/\/www\.google\.com\//.test(saved.body), 'DB 본문에 그림 주소가 저장됨');
  ok(await p.evaluate((name) => [...document.querySelectorAll('.tpl-card')].some((c) => c.textContent.includes(name) && /📎 첨부 1/.test(c.textContent)), NAME), '목록 카드에 📎 첨부 1 배지');

  if (saved) {
    await p.evaluate((id) => document.querySelector(`.tpl-card[data-tpl-id="${id}"]`).click(), String(saved._id));
    ok(await waitFor(() => document.querySelectorAll('.tpl-att-row').length === 1), '다시 열어도 첨부 목록이 보임');
    await p.evaluate(() => document.getElementById('tplBackBtn').click());
    await w(800);

    // 발송관리 — 이 양식을 고르면 첨부 안내가 뜬다
    await p.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-contacted"]').click());
    const hasSel = await waitFor(() => !!document.getElementById('obTpl'), 15000);
    ok(hasSel, '발송관리 보낼 메일 화면 열림 (테스트 업체 1곳)');
    if (hasSel) {
      await p.select('#obTpl', String(saved._id));
      ok(await waitFor(() => /파일 1개가 함께 붙어 나갑니다/.test(document.getElementById('obAttachNote')?.textContent || '')), '발송관리에서 이 양식을 고르면 "파일 1개가 함께 붙어 나갑니다" 표시');
    }
  }
} finally {
  const r = await T.deleteMany({ name: NAME });
  console.log(`      (테스트 양식 ${r.deletedCount}개 지움)`);
  const after = await L.findOne({ leadId: 'test-send-0914' }, { projection: { emailHistory: 1, lastEmailSentAt: 1, stage: 1 } });
  ok(JSON.stringify(before) === JSON.stringify(after), `테스트 업체 발송 기록은 그대로 (stage ${after?.stage} · 기록 ${(after?.emailHistory || []).length}건)`);
  ok(errs.length === 0, `JS 오류 없음 ${errs.join(' | ').slice(0, 200)}`);
  await b.close();
  await mongoose.disconnect();
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
