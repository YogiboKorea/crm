/**
 * 발송 관리 화면 — 예약 발송 고친 것 (2026-10-20, 대표님 미팅 전).
 *
 *   ✉️ 보낼 메일  1) 제목을 고치고 [보내기] → 확인창에 "고친 제목·본문으로 나갑니다" · 실제 속도, 요청에 고친 제목·본문이 실림
 *                2) 🧪 테스트 메일도 고친 제목·본문으로 요청
 *                3) 나눠 보내기 안내가 "하루 걸린다" 가 아니라 실제 속도(한 통 8초 · 하루 상한)로
 *   📅 예약 발송  4) 날짜를 한국 시각으로 묶음 — 내일 오전 8시 예약이 "내일" 로 (세계 표준시로 묶으면 "오늘")
 *                5) 보내는 중 · 재발송 N번째 · 고친 문구 표시, 보내는 중에는 [취소] 없음
 *                6) 취소된 예약에 이유 · 마지막 자동 처리 표시
 *                7) [취소] → 실제로 취소되고 이유가 "발송함에서 직접 취소"
 *
 * **메일을 보내지 않는다** — 발송·예약·테스트 메일·예약 처리 요청은 브라우저에서 가로채 막는다
 * (검사용 예약의 [취소] 만 통과). 검사용 업체·예약은 끝나면 지운다.
 *
 * 사용: CRM_BASE=http://localhost:3000 node scripts/check-outbox-schedule-ui.mjs
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = process.env.CRM_BASE || 'http://localhost:3000';
const SHOT = process.env.SHOT || '';
const USER = 'yogico';
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const L = db.collection('leads');
const S = db.collection('emailschedules');
const tpl = await db.collection('emailtemplates').findOne({ purpose: 'intro', isActive: { $ne: false } });
const acc = await db.collection('mailaccounts').findOne({ smtpUser: 'fe@yogico.kr', owner: 'admin', isActive: { $ne: false } });

const stamp = Date.now();
const LID = `zz-schedui-${stamp}`;
await L.insertOne({
  leadId: LID, Company: `ZZ 예약 화면 점검 ${stamp}`, Country: 'Test', Email: 'fe@yogico.kr',
  stage: 'contacted', stageChangedAt: new Date().toISOString(), emailHistory: [], createdAt: new Date(), updatedAt: new Date(),
});
// 내일 오전 8시(한국) — 세계 표준시로는 오늘 밤 11시라, 예전 화면은 "오늘" 로 묶었다
const t8 = new Date(); t8.setDate(t8.getDate() + 1); t8.setHours(8, 0, 0, 0);
const t9 = new Date(t8.getTime() + 3600_000);
const base = { leadId: LID, templateId: String(tpl._id), mailAccountId: String(acc._id), to: 'fe@yogico.kr', attempts: 0, createdBy: USER, createdAt: new Date(), updatedAt: new Date() };
const ins = await S.insertMany([
  { ...base, status: 'pending', scheduledFor: t8, batchId: `camp-ui-${stamp}`, attemptNo: 1, subjectOverride: '고친 제목 {{Company}}', bodyOverride: '고친 본문' },
  { ...base, status: 'pending', scheduledFor: t9, batchId: `followup-ui-${stamp}`, attemptNo: 2 },
  { ...base, status: 'sending', claimedAt: new Date(), scheduledFor: t9, batchId: `camp-ui-${stamp}`, attemptNo: 1 },
  { ...base, status: 'canceled', canceledReason: '답장이 와서 자동 재발송을 멈췄습니다', scheduledFor: t9, batchId: `followup-ui-${stamp}`, attemptNo: 3, updatedAt: new Date(Date.now() + 1000) },
]);
const ids = Object.values(ins.insertedIds).map(String);
const cancelId = ids[0];

const jwt = await new SignJWT({ user: USER, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
const captured = [];
const dialogs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
await p.setRequestInterception(true);
p.on('request', (r) => {
  const u = r.url();
  // 검사용 예약 하나의 [취소] 만 통과 — 그 밖의 발송·예약·처리 요청은 전부 막는다
  if (r.method() === 'DELETE' && u.includes(`/api/mail/schedule/${cancelId}`)) return r.continue();
  if (/\/api\/cron\/process-schedules/.test(u) || (/\/api\/mail\/(send|schedule|campaign|reply|test-send|compose)/.test(u) && r.method() !== 'GET')) {
    captured.push({ url: u, method: r.method(), body: r.postData() });
    return r.abort();
  }
  r.continue();
});
await p.setCookie({ name: 'admin_session', value: jwt, domain: new URL(B).hostname, path: '/' });
await p.setViewport({ width: 1440, height: 1100 });
const waitFor = async (fn, ms = 20000, ...a) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, ...a)) return true; await w(250); } return false; };

try {
  await p.goto(B + '/', { waitUntil: 'networkidle2' });
  await w(800);
  await p.evaluate(() => document.querySelector('.nav-item[data-view="pipeline-contacted"]').click());
  ok(await waitFor(() => !!document.getElementById('obSubject')), '발송 관리 [✉️ 보낼 메일] 열림');

  // ── 3) 나눠 보내기 안내 ──
  const hint = await p.$eval('#obSplitHint', (x) => x.textContent);
  ok(/초씩|일 걸립니다/.test(hint) && !/약 1일/.test(hint), `나눠 보내기 안내: "${hint}"`);

  // ── 1) 제목 고치고 보내기 ──
  const EDIT = ` [고침 ${stamp}]`;
  await p.focus('#obSubject');
  await p.keyboard.press('End');
  await p.keyboard.type(EDIT);
  await w(300);
  await p.evaluate(() => document.getElementById('outboxSendBtn').click());
  await w(1500);
  const conf = dialogs.find((d) => /곳에 메일을 보냅니다/.test(d)) || '';
  ok(/고친 제목·본문으로 나갑니다/.test(conf), '확인창: "이 화면에서 고친 제목·본문으로 나갑니다"');
  ok(/실제 속도\s+한 통에 \d+초씩/.test(conf), `확인창: 실제 속도 — ${(conf.match(/실제 속도[^\n]*/) || [''])[0]}`);
  const camp = captured.find((c) => /\/api\/mail\/campaign/.test(c.url));
  const cb = camp ? JSON.parse(camp.body || '{}') : {};
  ok(camp && String(cb.subject || '').endsWith(EDIT) && typeof cb.body === 'string' && cb.body.length > 0, `예약 요청에 고친 제목 실림 ("…${String(cb.subject || '').slice(-24)}") — 요청은 막음`);

  // ── 2) 테스트 메일 ──
  await p.evaluate(() => document.getElementById('obTestSendBtn')?.click());
  await w(1200);
  const ts = captured.find((c) => /test-send/.test(c.url));
  const tb = ts ? JSON.parse(ts.body || '{}') : {};
  ok(ts && String(tb.subject || '').endsWith(EDIT), '테스트 메일 요청도 고친 제목으로 — 요청은 막음');
  ok(dialogs.some((d) => /고친 제목·본문으로 보냅니다/.test(d)), '테스트 메일 확인창: 고친 문구로 보낸다고 안내');

  // ── 📅 예약 발송 ──
  await p.evaluate(() => document.querySelector('.outbox-tab[data-tab="scheduled"]')?.click());
  ok(await waitFor((id) => !!document.querySelector(`.outbox-sched-cancel[data-sched-id="${id}"]`), 20000, cancelId), '[📅 예약 발송] 탭에 검사용 예약이 보임');
  const v = await p.evaluate((lid) => {
    const rows = [...document.querySelectorAll(`#outboxBody td.outbox-lead-open[data-lead-id="${lid}"]`)].map((td) => td.closest('tr'));
    const dayOf = (tr) => tr.closest('div[style*="border-bottom"]')?.querySelector('b')?.textContent || '';
    return {
      days: rows.map(dayOf),
      sendingBadge: rows.some((tr) => /보내는 중/.test(tr.textContent) && !tr.querySelector('.outbox-sched-cancel')),
      followBadge: rows.some((tr) => /재발송 2번째/.test(tr.textContent)),
      editedBadge: rows.some((tr) => /고친 문구/.test(tr.textContent)),
      canceled: document.querySelector('#outboxBody details')?.textContent || '',
      head: document.querySelector('#outboxBody')?.textContent || '',
    };
  }, LID);
  ok(v.days.length >= 3 && v.days.every((d) => /내일/.test(d)), `내일 오전 8시 예약이 "내일" 로 묶임 (${[...new Set(v.days)].join(' / ')})`);
  ok(v.sendingBadge, '"⏳ 보내는 중" 표시 · 그 줄에는 [취소] 없음');
  ok(v.followBadge, '"재발송 2번째" 표시');
  ok(v.editedBadge, '"고친 문구" 표시');
  ok(/답장이 와서 자동 재발송을 멈췄습니다/.test(v.canceled), '취소된 예약에 이유가 보임');
  ok(/마지막 자동 처리|자동 처리 기록 없음|지금 내보내는 중/.test(v.head), '마지막 자동 처리 표시');
  if (SHOT) { await p.screenshot({ path: SHOT, fullPage: false }); console.log(`     화면 저장: ${SHOT}`); }

  // ── 7) [취소] ──
  await p.evaluate((id) => document.querySelector(`.outbox-sched-cancel[data-sched-id="${id}"]`).click(), cancelId);
  ok(await waitFor((id) => !document.querySelector(`.outbox-sched-cancel[data-sched-id="${id}"]`), 15000, cancelId), '[취소] 누르면 목록에서 빠짐');
  const after = await S.findOne({ _id: new mongoose.Types.ObjectId(cancelId) });
  ok(after?.status === 'canceled' && after.canceledReason === '발송함에서 직접 취소', `DB: ${after?.status} ("${after?.canceledReason}")`);
} finally {
  ok(errs.length === 0, `JS 오류 없음 ${errs.join(' | ').slice(0, 300)}`);
  await b.close();
  const ds = await S.deleteMany({ leadId: LID });
  const dl = await L.deleteOne({ leadId: LID });
  console.log(`\n검사용 업체·예약 치움 (업체 ${dl.deletedCount} · 예약 ${ds.deletedCount})`);
  console.log(`막은 요청 ${captured.length}건: ${[...new Set(captured.map((c) => c.method + ' ' + new URL(c.url).pathname))].join(', ')}`);
  await mongoose.disconnect();
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
