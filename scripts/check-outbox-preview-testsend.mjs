/**
 * 발송관리 — ① 미리보기에 [회사명] 이 그 회사 이름으로 바뀌어 보이는지
 *           ② 🧪 테스트 메일: 기본 주소 = 보내는 계정(본인 메일), 직접 고친 주소 유지, 요청 내용
 * 브라우저에서는 발송 요청을 가로채 막는다 (실제 발송 없음).
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const jwt = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
await mongoose.connect(process.env.MONGODB_URI);
const accounts = await mongoose.connection.db.collection('mailaccounts').find({ isActive: { $ne: false } }).project({ fromAddress: 1, smtpUser: 1, isDefault: 1 }).toArray();
await mongoose.disconnect();
const def = accounts.find((a) => a.isDefault);
const other = accounts.find((a) => !a.isDefault);

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
const captured = [];
const dialogs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('dialog', async (d) => { dialogs.push(d.message().replace(/\s+/g, ' ').slice(0, 140)); await d.accept(); });
await p.setRequestInterception(true);
p.on('request', (r) => {
  if (/\/api\/mail\/(send|schedule|campaign|reply|test-send)/.test(r.url()) && r.method() !== 'GET') { captured.push({ url: r.url(), body: r.postData() }); return r.abort(); }
  r.continue();
});
await p.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });
await p.setViewport({ width: 1440, height: 1000 });
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await w(250); } return false; };

try {
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await w(1000);
  await p.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-contacted"]').click());
  ok(await waitFor(() => !!document.getElementById('obPvSubject')), '발송관리 보낼 메일 열림');
  const pv = await p.evaluate(() => ({
    to: document.getElementById('obPvTo')?.innerText,
    subj: document.getElementById('obPvSubject')?.innerText,
    body: document.getElementById('obPvBody')?.innerText.slice(0, 120),
    marks: document.querySelectorAll('#obPvSubject .ob-var, #obPvBody .ob-var').length,
    lead: document.getElementById('obPreviewLead')?.selectedOptions[0]?.textContent.trim(),
  }));
  console.log('     ', JSON.stringify(pv));
  ok(!/\[회사명\]/.test(pv.subj + pv.body) && pv.subj.includes(pv.lead) && pv.body.includes(pv.lead), `미리보기 제목·본문의 [회사명] 이 "${pv.lead}" 로 바뀜`);
  ok(pv.marks >= 2, `바뀐 자리가 노란 표시로 보임 (${pv.marks}곳)`);
  ok(pv.to.includes(pv.lead), '받는 사람 칸에 회사명도 같이 보임');

  const t0 = await p.$eval('#obTestTo', (x) => x.value);
  ok(t0 === (def.fromAddress || def.smtpUser), `테스트 메일 기본 주소 = 보내는 계정(대표) ${t0}`);
  if (other) {
    await p.select('#obAcc', String(other._id));
    await waitFor(() => false, 800);
    const t1 = await p.$eval('#obTestTo', (x) => x.value);
    ok(t1 === (other.fromAddress || other.smtpUser), `보내는 계정을 바꾸면 기본 주소도 따라감 → ${t1}`);
    await p.select('#obAcc', String(def._id));
    await waitFor(() => false, 800);
  }
  await p.$eval('#obTestTo', (x) => { x.value = ''; });
  await p.type('#obTestTo', 'someone@example.com');
  if (other) { await p.select('#obAcc', String(other._id)); await waitFor(() => false, 800); }
  const t2 = await p.$eval('#obTestTo', (x) => x.value);
  ok(t2 === 'someone@example.com', `직접 고친 주소는 계정을 바꿔도 유지 → ${t2}`);

  await p.evaluate(() => document.getElementById('obTestSendBtn').click());
  await waitFor(() => false, 1500);
  const req = captured.find((c) => /test-send/.test(c.url));
  const body = req ? JSON.parse(req.body) : {};
  ok(req && body.to === 'someone@example.com' && body.templateId && body.previewLeadId, `요청: ${JSON.stringify(body)}`);
  ok(dialogs.some((d) => /테스트 메일을 보냅니다/.test(d)), `확인창: ${dialogs.find((d) => /테스트 메일을 보냅니다/.test(d)) || '-'}`);
  ok(!captured.some((c) => /campaign|schedule|\/send$/.test(c.url)), '업체 발송(예약) 요청은 나가지 않음');
} finally {
  ok(errs.length === 0, `JS 오류 없음 ${errs.join(' | ').slice(0, 200)}`);
  await b.close();
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
