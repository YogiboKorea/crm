/**
 * 새 아이디 첫 로그인 — 2달 가져오기가 자동으로 시작되고 % 진행 표시가 뜨는지.
 *   fe  : fe@ 는 다른 아이디(관리자)가 이미 2달치를 가져온 메일함 → 바로 완료(100%)로 끝나고 다시 안 돈다
 *   admin: 관리자는 자동으로 돌지 않는다
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const B = 'http://localhost:3000';
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));

await mongoose.connect(process.env.MONGODB_URI);
const A = mongoose.connection.db.collection('mailaccounts');
const FE_OWN = new mongoose.Types.ObjectId('6aa7acbf15345798f230ed1a');
await A.updateOne({ _id: FE_OWN }, { $set: { backfilledAt: null, backfillCursor: null } });

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const errs = [];
const calls = [];
async function open(user) {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { errs.push('dialog: ' + d.message().slice(0, 60)); await d.dismiss(); });
  p.on('request', (r) => { if (/\/api\/mail\/backfill/.test(r.url())) calls.push({ user, body: r.postData() }); });
  const jwt = await new SignJWT({ user, role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
  await p.setCookie({ name: 'admin_session', value: jwt, domain: 'localhost', path: '/' });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(B + '/', { waitUntil: 'networkidle2' });
  return p;
}
try {
  console.log('── fe 첫 로그인');
  const p = await open('fe');
  let seen = false; let finalText = '';
  for (let i = 0; i < 60; i++) {
    const t = await p.evaluate(() => document.getElementById('backfillPill')?.innerText || '');
    if (t) { seen = true; finalText = t; if (/완료|멈췄/.test(t)) break; }
    await w(500);
  }
  ok(seen, '클릭 없이 오른쪽 아래에 가져오기 진행 표시가 뜸');
  ok(/100%/.test(finalText) && /완료/.test(finalText), `완료 표시 — "${finalText.replace(/\s+/g, ' ').slice(0, 80)}"`);
  const acc = await A.findOne({ _id: FE_OWN }, { projection: { backfilledAt: 1 } });
  ok(!!acc.backfilledAt, '서버에 완료로 기록됨 (다음 로그인 때 다시 안 돎)');
  await p.close();

  const before = calls.length;
  const p2 = await open('fe');
  await w(6000);
  ok(calls.length === before && !(await p2.evaluate(() => !!document.getElementById('backfillPill'))), '두 번째 로그인에는 자동으로 다시 돌지 않음');
  await p2.close();

  console.log('── admin');
  const before2 = calls.length;
  const p3 = await open('admin');
  await w(6000);
  ok(calls.length === before2, '관리자는 자동으로 돌지 않음 (필요할 때 [📥 2달 전체])');
  await p3.close();
} finally {
  ok(errs.length === 0, `JS 오류·알림창 없음 ${errs.join(' | ').slice(0, 160)}`);
  await b.close();
  await mongoose.disconnect();
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
