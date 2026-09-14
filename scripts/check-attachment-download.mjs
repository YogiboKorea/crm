/**
 * 첨부파일 내려받기가 **올바른 파일을 온전히** 주는지 확인한다.
 *
 * 응답이 200 으로 오는 것만으로는 부족하다. 파트 번호가 어긋나면 다른 첨부가,
 * 계정을 잘못 열면 다른 메일의 첨부가 조용히 내려간다. 그래서
 *   ① 받은 바이트 수 = 수집 때 저장한 크기
 *   ② 파일 앞머리 서명이 형식과 맞는가 (PDF=%PDF, PNG=\x89PNG, ZIP/DOCX/XLSX=PK, JPEG=FFD8)
 *   ③ 한글 파일 이름이 헤더에 제대로 실리는가
 *   ④ 4.5MB 가 넘는 파일도 끝까지 오는가 (Vercel 스트리밍 경로)
 *   ⑤ 잘못된 요청은 알아들을 수 있는 오류로 오는가
 * 를 본다.
 */
import { SignJWT } from 'jose';
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const BASE = process.env.AUDIT_BASE || 'http://localhost:3000';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: process.env.ADMIN_ID || 'yogico', role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
const cookie = `admin_session=${jwt}`;

await mongoose.connect(process.env.MONGODB_URI);
const M = mongoose.connection.collection('inboundmails');

// 형식별로 하나씩 + 큰 파일 하나 고른다
const pick = async (q, sort = { date: -1 }) =>
  M.find({ trashedAt: null, attachments: { $elemMatch: q } }).sort(sort).limit(1)
    .project({ subject: 1, attachments: 1 }).toArray().then((r) => r[0]);
const cases = [];
for (const [label, q] of [
  ['PDF', { contentType: 'application/pdf', size: { $lt: 4 * 1024 * 1024 } }],
  ['PNG', { contentType: 'image/png' }],
  ['JPEG', { contentType: 'image/jpeg' }],
  ['엑셀/워드/압축', { contentType: { $regex: /spreadsheet|wordprocessing|zip|excel/ } }],
  ['4.5MB 초과', { size: { $gt: 4.6 * 1024 * 1024, $lt: 30 * 1024 * 1024 } }],
]) {
  const mail = await pick(q);
  if (!mail) { console.log(`  (${label} 첨부가 있는 메일 없음 — 건너뜀)`); continue; }
  const att = mail.attachments.find((a) => {
    if (q.contentType?.$regex) return q.contentType.$regex.test(a.contentType);
    if (q.contentType && a.contentType !== q.contentType) return false;
    if (q.size?.$gt && !(a.size > q.size.$gt)) return false;
    if (q.size?.$lt && !(a.size < q.size.$lt)) return false;
    return true;
  });
  if (att) cases.push({ label, mail, att });
}
await mongoose.disconnect();

const SIG = [
  [/pdf/, (b) => b.slice(0, 4).toString() === '%PDF', '%PDF'],
  [/png/, (b) => b[0] === 0x89 && b.slice(1, 4).toString() === 'PNG', '\\x89PNG'],
  [/jpe?g/, (b) => b[0] === 0xff && b[1] === 0xd8, 'FFD8'],
  [/zip|spreadsheet|wordprocessing|presentation/, (b) => b.slice(0, 2).toString() === 'PK', 'PK'],
];

let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`    ${c ? 'OK  ' : 'X   '}${m}`); };

for (const { label, mail, att } of cases) {
  console.log(`\n── ${label}: ${String(att.filename).slice(0, 50)} (${(att.size / 1024).toFixed(0)}KB)`);
  console.log(`   메일: ${String(mail.subject).slice(0, 50)}`);
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/mail/${mail._id}/attachment?att=${att._id}`, { headers: { Cookie: cookie } });
  const buf = Buffer.from(await r.arrayBuffer());
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  ok(r.status === 200, `응답 ${r.status} · ${secs}초`);
  if (r.status !== 200) { console.log('     ', buf.toString().slice(0, 200)); continue; }
  ok(buf.length === att.size, `받은 크기 ${buf.length} = 저장된 크기 ${att.size}`);
  const sig = SIG.find(([re]) => re.test(att.contentType));
  if (sig) ok(sig[1](buf), `파일 서명 ${sig[2]} 일치`);
  const cd = r.headers.get('content-disposition') || '';
  const star = decodeURIComponent((cd.match(/filename\*=UTF-8''([^;]+)/) || [])[1] || '');
  ok(cd.startsWith('attachment') && star === String(att.filename).replace(/[\r\n"\\]/g, '_'),
     `파일 이름 헤더: ${star.slice(0, 40)}`);
  ok(r.headers.get('x-content-type-options') === 'nosniff', 'nosniff 헤더');
}

// 바로 열기 — 이미지·PDF 만 inline, 나머지는 강제로 내려받기
const png = cases.find((c) => c.label === 'PNG');
if (png) {
  const r = await fetch(`${BASE}/api/mail/${png.mail._id}/attachment?att=${png.att._id}&inline=1`, { headers: { Cookie: cookie } });
  await r.arrayBuffer();
  ok((r.headers.get('content-disposition') || '').startsWith('inline'), '\n    PNG 는 inline=1 이면 바로 열기');
}
const other = cases.find((c) => c.label === '엑셀/워드/압축');
if (other) {
  const r = await fetch(`${BASE}/api/mail/${other.mail._id}/attachment?att=${other.att._id}&inline=1`, { headers: { Cookie: cookie } });
  await r.arrayBuffer();
  ok((r.headers.get('content-disposition') || '').startsWith('attachment'), '엑셀·압축은 inline=1 이어도 내려받기로만');
}

// 오류 경로
console.log('\n── 오류 경로');
const any = cases[0];
{
  const r = await fetch(`${BASE}/api/mail/${any.mail._id}/attachment?att=000000000000000000000000`, { headers: { Cookie: cookie } });
  const j = await r.json().catch(() => ({}));
  ok(r.status === 404 && /찾을 수 없/.test(j.error || ''), `없는 첨부 → 404 "${j.error}"`);
}
{
  const r = await fetch(`${BASE}/api/mail/000000000000000000000000/attachment?i=0`, { headers: { Cookie: cookie } });
  const j = await r.json().catch(() => ({}));
  ok(r.status === 404, `없는 메일 → 404 "${j.error}"`);
}
{
  const r = await fetch(`${BASE}/api/mail/${any.mail._id}/attachment?att=${any.att._id}`, { redirect: 'manual' });
  ok(r.status === 307 || r.status === 302, `로그인 없이 → ${r.status} (로그인 화면으로)`);
}

console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
