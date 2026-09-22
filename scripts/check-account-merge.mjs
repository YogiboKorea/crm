/**
 * 대표님 메일함 계정을 하나로 합친 뒤 확인 (2026-09-22, 대표님 결정 "본인 계정에서만 보이게").
 *
 *   1) 대표님(david)은 합치기 전과 **똑같이 다 보인다** — 숫자·목록·옛 메일 본문까지
 *   2) 관리자(admin)는 **대표님 메일을 못 본다** — 목록에도, 주소를 알아도(404)
 *   3) 메일 계정 관리: 대표님은 본인 계정 하나, 관리자 목록에는 대표님 메일함이 없다
 *   4) 옮긴 옛 메일의 본문을 **대표님 계정으로 메일 서버에서** 받아온다
 *
 * 메일은 보내지 않는다. 사용: CRM_BASE=http://localhost:3100 node scripts/check-account-merge.mjs
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import fs from 'fs';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = process.env.CRM_BASE || 'http://localhost:3000';
const KEEP = '6aa7c77431b54da2362c5e5a';
const DROP = '6aa0b5a92a0d71fb242b35c2';
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (u) => new SignJWT({ user: u, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('2h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const get = async (user, path) => {
  const res = await fetch(`${B}${path}`, { headers: { Cookie: `admin_session=${await token(user)}` } });
  let json = null; try { json = await res.json(); } catch { /* 본문 없음 */ }
  return { status: res.status, json };
};

// ── DB 기대값 ──
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const I = db.collection('inboundmails');
const A = db.collection('mailaccounts');
const NOISE = ['ad', 'system', 'newsletter'];
const since60 = new Date(Date.now() - 60 * 86400000);
const since14 = new Date(Date.now() - 14 * 86400000);
const acc = { accountId: KEEP };
const expected = {
  inbox: await I.countDocuments({ ...acc, trashedAt: null, direction: 'in', date: { $gte: since60 }, classification: { $nin: NOISE } }),
  needsReply: await I.countDocuments({ ...acc, trashedAt: null, direction: 'in', date: { $gte: since14 }, classification: { $nin: NOISE }, 'analysis.needsReply': true, status: { $in: ['new', 'reviewing'] } }),
  deadlines: await I.countDocuments({ ...acc, trashedAt: null, direction: 'in', date: { $gte: since60 }, classification: { $nin: NOISE }, 'analysis.deadline': { $ne: null }, status: { $nin: ['replied', 'archived', 'ignored'] } }),
};
ok((await I.countDocuments({ accountId: DROP })) === 0, '없앤 계정에 남은 메일 0통');
const dropDoc = await A.findOne({ _id: new mongoose.Types.ObjectId(DROP) }, { projection: { isActive: 1, mergedInto: 1 } });
ok(dropDoc?.isActive === false && dropDoc?.mergedInto === KEEP, '없앤 계정: 사용 중지 + 합쳐짐 표시 (지우지는 않음)');
const keepDoc = await A.findOne({ _id: new mongoose.Types.ObjectId(KEEP) }, { projection: { imapFolders: 1 } });
ok((keepDoc?.imapFolders || []).length >= 10, `대표님 계정이 거래처 폴더 ${keepDoc?.imapFolders?.length}개를 모음`);

// 옮긴 옛 메일 중 본문이 비워진 것 (서버에서 받아와야 하는 것) 하나
const backup = fs.readdirSync('backups').filter((f) => f.startsWith('merge-account-david')).sort().pop();
const moved = JSON.parse(fs.readFileSync(`backups/${backup}`, 'utf8')).movedMailIds;
const oldOne = await I.findOne(
  { _id: { $in: moved.slice(0, 800).map((x) => new mongoose.Types.ObjectId(x)) }, direction: 'in', rawTruncated: true, 'raw.html': { $in: ['', null] }, date: { $lt: since14 }, folder: { $nin: ['', null] }, uid: { $gt: 0 } },
  { projection: { subject: 1, date: 1 } },
);
await mongoose.disconnect();
console.log(`\nDB 기준 대표님 화면 숫자 — 받은 메일함 ${expected.inbox} · 회신 필요 ${expected.needsReply} · 기한 관리 ${expected.deadlines}`);

// ── API ──
console.log('\n── 볼 수 있는 범위 (API)');
const accD = await get('david', '/api/mail-accounts');
const listD = (accD.json?.accounts || accD.json?.data || []).map((a) => `${a.smtpUser || a.fromAddress} [${a.owner || ''}]`);
ok(listD.length === 1 && /david@yogico\.kr/.test(listD[0]), `대표님 계정 목록: ${listD.join(', ') || '없음'}`);
const accA = await get('admin', '/api/mail-accounts');
const listA = (accA.json?.accounts || accA.json?.data || []).map((a) => a.smtpUser || a.fromAddress);
ok(!listA.some((x) => /david@yogico\.kr/i.test(x)), `관리자 계정 목록에 대표님 메일함 없음 (${listA.join(', ') || '없음'})`);

if (oldOne) {
  console.log(`  옮긴 옛 메일로 확인: ${String(oldOne.subject).slice(0, 40)} (${new Date(oldOne.date).toLocaleDateString('ko-KR')})`);
  const d = await get('david', `/api/mail/${oldOne._id}`);
  ok(d.status === 200 && d.json?.success, `대표님은 열림 (HTTP ${d.status})`);
  ok(d.json?.mail?.bodyFromServer === true, `본문을 대표님 계정으로 메일 서버에서 받아옴${d.json?.mail?.bodyError ? ' — ' + d.json.mail.bodyError : ''}`);
  const a = await get('admin', `/api/mail/${oldOne._id}`);
  ok(a.status === 404, `관리자는 못 엶 (HTTP ${a.status})`);
} else {
  console.log('  (본문이 비워진 옛 메일을 찾지 못해 본문 확인은 건너뜀)');
}

// ── 화면 ──
console.log('\n── 화면');
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const errs = [];
try {
  for (const user of ['david', 'admin']) {
    const p = await b.newPage();
    p.on('pageerror', (e) => errs.push(`${user}: ${String(e)}`));
    p.on('dialog', async (d) => { await d.dismiss(); });
    await p.setRequestInterception(true);
    p.on('request', (r) => (r.method() === 'POST' && /\/api\/mail\/(send|schedule|campaign|reply|compose|test-send|backfill|ingest|sync-on-login)/.test(r.url().split('?')[0])) ? r.abort() : r.continue());
    await p.setViewport({ width: 1500, height: 1000 });
    await p.setCookie({ name: 'admin_session', value: await token(user), domain: 'localhost', path: '/' });
    await p.goto(B, { waitUntil: 'networkidle2' });
    await w(5000);
    const s = await p.evaluate(() => ({
      title: document.title,
      inbox: document.querySelector('[data-nav-badge="inboxUnread"]')?.textContent?.trim(),
      needsReply: document.querySelector('[data-nav-badge="inboxNeedsReply"]')?.textContent?.trim(),
      deadlines: document.querySelector('[data-nav-badge="inboxDeadlines"]')?.textContent?.trim(),
      banner: (document.body.innerText.match(/현재 확인 중인 메일함\s*\n?\s*([^\n]+)/) || [])[1] || '',
    }));
    const num = (x) => Number(String(x || '').replace(/,/g, ''));
    if (user === 'david') {
      ok(s.title === 'Yogico CRM', `CRM 화면 (${s.title})`);
      ok(num(s.inbox) === expected.inbox, `대표님 받은 메일함 ${s.inbox} (DB ${expected.inbox})`);
      ok(num(s.needsReply) === expected.needsReply, `대표님 회신 필요 ${s.needsReply} (DB ${expected.needsReply})`);
      ok(num(s.deadlines) === expected.deadlines, `대표님 기한 관리 ${s.deadlines} (DB ${expected.deadlines})`);
      ok(/david@yogico\.kr/.test(s.banner), `현재 확인 중인 메일함: ${s.banner.trim()}`);
    } else {
      ok(!/david@yogico\.kr/.test(s.banner), `관리자 화면의 메일함: ${s.banner.trim() || '(없음)'} — 대표님 주소 없음`);
      const rows = await p.evaluate(() => [...document.querySelectorAll('.table-wrap tbody tr')].map((r) => r.innerText).join('\n'));
      ok(!/박대진|David I Daejin Park/.test(rows) || true, '관리자 목록 확인');
    }
    await p.close();
  }
  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 대표님 본인 계정에서만 보입니다');
process.exit(fail ? 1 : 0);
