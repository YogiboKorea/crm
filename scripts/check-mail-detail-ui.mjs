/**
 * 메일 상세 화면을 실제 브라우저로 열어 세 가지를 확인한다.
 *   ① 첨부 단추를 누르면 파일이 **실제로 디스크에 저장**되고 크기가 맞는가
 *   ② 표로 짠 HTML 메일(이용약관 위반 안내)의 빈 줄이 정리됐는가
 *   ③ AI 분석이 끝난 메일은 [✅ AI 분석 완료], 안 된 메일은 [🧠 AI 분석] 버튼인가
 * 대화 보기(리드 대화)의 첨부 단추도 함께 본다.
 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const BASE = 'http://localhost:3000';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: process.env.ADMIN_ID || 'yogico', role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);

await mongoose.connect(process.env.MONGODB_URI);
const M = mongoose.connection.collection('inboundmails');
const pdfMail = await M.findOne({ trashedAt: null, 'analysis.method': 'ai', 'attachments.contentType': 'application/pdf', 'attachments.size': { $lt: 3e6 } }, { projection: { subject: 1, attachments: 1, leadId: 1 } });
const tosMail = await M.findOne({ subject: /이용약관 위반/ }, { projection: { subject: 1, analysis: 1 } });
const notAnalyzed = await M.findOne({ trashedAt: null, 'analysis.method': { $ne: 'ai' }, direction: 'in' }, { projection: { subject: 1 } });
const leadWithAtt = await M.findOne({ trashedAt: null, leadId: { $nin: [null, ''] }, 'attachments.0': { $exists: true }, direction: 'in' }, { projection: { leadId: 1, subject: 1, attachments: 1 } });
await mongoose.disconnect();

const dlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-dl-'));
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', async (d) => { errors.push('알림창: ' + d.message().slice(0, 160)); await d.dismiss(); });
await page.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dlDir, eventsEnabled: true });

let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.setViewport({ width: 1440, height: 950 });
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await wait(1500);

// ── ① 첨부 내려받기 ──
console.log(`\n① 첨부 내려받기 — "${pdfMail.subject.slice(0, 40)}"`);
await page.evaluate((id) => openMailDetailModal(id), String(pdfMail._id));
await page.waitForSelector('.mail-att-dl', { timeout: 15000 }).catch(() => {});
const chips = await page.$$eval('.mail-att-dl', (els) => els.map((e) => e.dataset.name));
ok(chips.length === pdfMail.attachments.filter((a) => !a.inline).length, `첨부 단추 ${chips.length}개 (저장된 첨부 ${pdfMail.attachments.length}개)`);

const target = pdfMail.attachments.find((a) => a.contentType === 'application/pdf');
await page.evaluate((name) => [...document.querySelectorAll('.mail-att-dl')].find((b) => b.dataset.name === name).click(), target.filename);
let saved = null;
for (let t = 0; t < 60 && !saved; t++) {
  await wait(500);
  const f = fs.readdirSync(dlDir).find((n) => !n.endsWith('.crdownload'));
  if (f) saved = path.join(dlDir, f);
}
ok(!!saved, `파일이 디스크에 저장됨: ${saved ? path.basename(saved) : '(없음)'}`);
if (saved) {
  const buf = fs.readFileSync(saved);
  ok(buf.length === target.size, `저장된 크기 ${buf.length} = 원본 ${target.size}`);
  ok(buf.slice(0, 4).toString() === '%PDF', 'PDF 서명 %PDF');
  ok(path.basename(saved) === target.filename, `한글 파일 이름 그대로: ${path.basename(saved)}`);
}
const stateAfter = await page.$eval('.mail-att-dl .mail-att-state', (e) => e.textContent).catch(() => '');
ok(['✓', '⬇'].includes(stateAfter), `단추 상태 표시 "${stateAfter}"`);

// ── ③-a 분석 완료 표시 ──
console.log('\n③ AI 분석 완료 표시');
ok(await page.$('#mdAnalyzed') !== null, '분석된 메일 헤더에 [✅ AI 분석 완료]');
ok(await page.$('#mdAnalyze') === null && await page.$('#mdAnalyzeInline') === null, '분석된 메일에는 [AI 분석하기] 버튼이 없음');
ok(await page.evaluate(() => document.body.innerText.includes('✅ AI 분석 완료')), '분석 상자 제목도 "AI 분석 완료"');
await page.evaluate(() => closeMailDetailModal());
await wait(400);

await page.evaluate((id) => openMailDetailModal(id), String(notAnalyzed._id));
await wait(2000);
ok(await page.$('#mdAnalyze') !== null && await page.$('#mdAnalyzed') === null, `분석 안 된 메일은 [🧠 AI 분석] 버튼 그대로 — "${notAnalyzed.subject.slice(0, 30)}"`);
await page.evaluate(() => closeMailDetailModal());
await wait(400);

// ── ② 빈 줄 정리 ──
console.log('\n② 빈 줄 정리 — 이용약관 위반 안내');
await page.evaluate((id) => openMailDetailModal(id), String(tosMail._id));
await wait(2000);
const bodyInfo = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.mail-read div')].find((d) => /이용약관 위반 안내/.test(d.textContent) && getComputedStyle(d).whiteSpace === 'pre-wrap');
  if (!el) return null;
  const t = el.textContent;
  return { maxBlank: Math.max(0, ...(t.match(/\n\s*\n(\s*\n)*/g) || []).map((x) => (x.match(/\n/g) || []).length - 1)), head: t.slice(0, 60), h: Math.round(el.getBoundingClientRect().height) };
});
ok(!!bodyInfo, '본문 영역 찾음');
if (bodyInfo) {
  ok(bodyInfo.maxBlank <= 1, `연속 빈 줄 최대 ${bodyInfo.maxBlank}개 (정리 전 20개 이상)`);
  ok(bodyInfo.head.replace(/\s+/g, ' ').startsWith('이용약관 위반 안내 안녕하세요') || !/^\s*이용약관 위반 안내\s*\n\s*\n\s*\n/.test(bodyInfo.head), `시작 부분: "${bodyInfo.head.replace(/\n/g, '↵').slice(0, 40)}"`);
  console.log(`     본문 높이 ${bodyInfo.h}px`);
}
await page.screenshot({ path: path.join(os.tmpdir(), 'tos-mail.png') });
await page.evaluate(() => closeMailDetailModal());

// ── 대화 보기 첨부 ──
if (leadWithAtt) {
  console.log(`\n대화 보기 첨부 — 리드 ${leadWithAtt.leadId}`);
  const hasConv = await page.evaluate(() => typeof openConversationModal === 'function');
  if (hasConv) {
    await page.evaluate((lid) => openConversationModal(lid), leadWithAtt.leadId);
    await wait(3000);
    const n = await page.$$eval('.mail-att-dl', (els) => els.length).catch(() => 0);
    ok(n > 0, `대화 보기에도 첨부 단추 ${n}개`);
  } else {
    console.log('  (대화 보기 함수 이름이 달라 건너뜀)');
  }
}

ok(errors.filter((e) => !/알림창/.test(e)).length === 0, `JS 오류 없음${errors.length ? ' — ' + errors.join(' | ').slice(0, 200) : ''}`);
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
console.log('스크린샷:', path.join(os.tmpdir(), 'tos-mail.png'));
await browser.close();
fs.rmSync(dlDir, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
