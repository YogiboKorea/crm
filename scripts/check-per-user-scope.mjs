/**
 * 아이디별 메일 분리 확인 (읽기 위주 · 실제 발송 없음).
 *   fe(일반, fe@ 등록) · david(일반, 아직 등록 없음) · admin(마스터)
 * 남의 메일·계정에 닿는 길이 막혔는지, 계정 등록 안전장치가 동작하는지 본다.
 */
import mongoose from 'mongoose';
import crypto from 'crypto';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = 'http://localhost:3000';
const tok = (user) => new SignJWT({ user, role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const H = async (user) => ({ 'Content-Type': 'application/json', Cookie: `admin_session=${await tok(user)}` });
const get = async (user, path) => { const r = await fetch(B + path, { headers: await H(user) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const send = async (user, path, method, body) => { const r = await fetch(B + path, { method, headers: await H(user), body: JSON.stringify(body) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const A = db.collection('mailaccounts');
const M = db.collection('inboundmails');
const accs = await A.find().project({ owner: 1, smtpUser: 1 }).toArray();
const davidAcc = accs.find((a) => a.owner === 'admin' && a.smtpUser === 'david@yogico.kr');
const feOwn = accs.find((a) => a.owner === 'fe');
const adminFe = accs.find((a) => a.owner === 'admin' && /fe@yogico/i.test(a.smtpUser));
const davidMail = await M.findOne({ accountId: String(davidAcc._id), direction: 'in' }, { projection: { _id: 1, leadId: 1 } });
const davidLeadMail = await M.findOne({ accountId: String(davidAcc._id), leadId: { $nin: ['', null] } }, { projection: { leadId: 1 } });
const feMail = await M.findOne({ accountId: String(adminFe._id) }, { projection: { _id: 1 } });

console.log('── fe (일반 아이디 · fe@ 등록)');
let r = await get('fe', '/api/mail-accounts');
ok(r.j.accounts?.length === 1 && r.j.accounts[0].smtpUser === 'fe@yogico.kr', `메일 계정 관리: 자기 계정 1개만 (${(r.j.accounts || []).map((a) => `${a.accountName}/${a.smtpUser}`).join(', ')})`);
r = await get('fe', '/api/mail/inbox?accountId=all&flat=1&limit=200');
const feIds = new Set((r.j.items || []).map((m) => m.accountId).filter(Boolean));
ok(r.status === 200 && (r.j.items || []).length > 0 && ![...feIds].includes(String(davidAcc._id)), `받은 메일함: fe@ 메일만 (${(r.j.items || []).length}통, 계정 ${[...feIds].length}개 · david@ 메일 없음)`);
r = await get('fe', `/api/mail/${davidMail._id}`);
ok(r.status === 404, `대표 메일함 메일 직접 열기 → ${r.status}`);
r = await get('fe', `/api/mail/${feMail._id}`);
ok(r.status === 200, `같은 fe@ 메일함(다른 아이디가 먼저 모은) 메일은 열림 → ${r.status}`);
r = await get('fe', `/api/mail/inbox?accountId=${davidAcc._id}`);
ok(r.status === 403 || (r.j.items || []).length === 0, `대표 계정 id 로 메일함 요청 → ${r.status} / ${(r.j.items || []).length}통`);
r = await get('fe', `/api/mail/counts?accountId=all`);
ok(r.status === 200, `배지 숫자 조회 가능 (${JSON.stringify(r.j.counts || {}).slice(0, 80)})`);
if (davidLeadMail) {
  r = await get('fe', `/api/mail/thread?leadId=${encodeURIComponent(davidLeadMail.leadId)}`);
  const leak = JSON.stringify(r.j).includes(String(davidAcc._id));
  ok(!leak, `업체 대화(${davidLeadMail.leadId})에 대표 메일함 메일이 섞이지 않음 (status ${r.status})`);
}
r = await send('fe', '/api/mail/test-send', 'POST', { to: 'fe@yogico.kr', templateId: '6aa25f5d04f523e9ea57b0c6', mailAccountId: String(davidAcc._id) });
ok(r.status === 400 && !r.j.success, `대표 계정으로 테스트 메일 보내기 → 막힘 (${r.status} ${r.j.error})`);
r = await send('fe', `/api/mail-accounts/${feOwn._id}`, 'PUT', { smtpUser: 'david@yogico.kr', fromAddress: 'david@yogico.kr' });
const feAfter = await A.findOne({ _id: feOwn._id }, { projection: { smtpUser: 1 } });
ok(r.status === 400 && feAfter.smtpUser === 'fe@yogico.kr', `비밀번호 없이 주소만 david@ 로 바꾸기 → 막힘 (${r.status} ${String(r.j.error).slice(0, 60)})`);
r = await send('fe', '/api/mail-accounts', 'POST', { accountName: 'x', smtpHost: 'smtp.evil.example', smtpPort: 465, smtpSecure: true, smtpUser: 'david@yogico.kr', smtpPass: 'x', fromAddress: 'david@yogico.kr' });
ok(r.status === 400 && /이카운트/.test(r.j.error || ''), `가짜 서버로 대표 주소 등록 → 막힘 (${r.j.error})`);
r = await send('fe', '/api/mail/test', 'POST', { to: 'fe@yogico.kr' });
ok(r.status === 403, `회사 기본 SMTP 테스트 발송(/api/mail/test) → 일반 아이디 막힘 (${r.status})`);

console.log('── david (일반 아이디)');
r = await get('david', '/api/mail-accounts');
const davidAccounts = r.j.accounts || [];
const davidHasDavidBox = davidAccounts.some((a) => /^david@/i.test(a.smtpUser || ''));
ok(davidAccounts.every((a) => a.owner === undefined || a.owner === 'david'), `메일 계정 관리: 자기가 등록한 것만 (${davidAccounts.map((a) => a.smtpUser).join(', ') || '없음'})`);
r = await get('david', '/api/mail/inbox?accountId=all&flat=1&limit=200');
const davidIds = new Set((r.j.items || []).map((m) => m.accountId).filter(Boolean));
if (davidHasDavidBox) {
  // david@ 를 직접 등록했으므로 그 메일함은 보이고, fe@ 메일함은 보이면 안 된다
  ok(r.status === 200 && (r.j.items || []).length > 0, `받은 메일함: 자기 메일함(david@) 메일 보임 (${(r.j.items || []).length}통)`);
  ok(!davidIds.has(String(adminFe._id)) && !davidIds.has(String(feOwn._id)), 'fe@ 메일함 메일은 섞이지 않음');
  r = await get('david', `/api/mail/${feMail._id}`);
  ok(r.status === 404, `fe@ 메일함 메일 직접 열기 → ${r.status}`);
} else {
  ok(r.status === 200 && (r.j.items || []).length === 0, '받은 메일함: 0통 (등록하면 보임)');
  r = await get('david', `/api/mail/${davidMail._id}`);
  ok(r.status === 404, `대표 메일함 메일 직접 열기 → ${r.status} (주소 등록 전이라 못 봄)`);
}

console.log('── admin (마스터)');
r = await get('admin', '/api/mail-accounts');
const adminList = (r.j.accounts || []).map((a) => a.owner || '?');
const masterOwned = accs.filter((a) => ['admin', 'yogico'].includes(a.owner)).length;
ok((r.j.accounts || []).length === masterOwned && !(r.j.accounts || []).some((a) => String(a._id) === String(feOwn._id)), `메일 계정 관리: 마스터가 등록한 ${masterOwned}개만 (다른 아이디 계정은 안 보임)`);
r = await get('admin', `/api/mail/${davidMail._id}`);
ok(r.status === 200, `대표 메일함 메일 열림 → ${r.status}`);
r = await get('admin', '/api/mail/inbox?accountId=all&flat=1&limit=20');
ok(r.status === 200 && (r.j.items || []).length > 0, `받은 메일함 ${r.j.total ?? (r.j.items || []).length}통`);

console.log('── 로그인 안 함');
const nr = await fetch(B + '/api/mail/inbox', { redirect: 'manual' });
ok([302, 307, 401].includes(nr.status), `메일함 → ${nr.status}`);

console.log('── 아이디·비밀번호 변경 (hoon 으로 시험 후 원래대로)');
const U = db.collection('adminusers');
const hash = (p) => crypto.createHash('sha256').update(p).digest('hex');
r = await send('hoon', '/api/users/me', 'PUT', { currentPassword: 'wrong', newPassword: 'abcdef' });
ok(r.status === 400, `틀린 현재 비밀번호 → 거절 (${r.j.error})`);
r = await send('hoon', '/api/users/me', 'PUT', { currentPassword: 'yogibo', newUsername: 'hoon-test' });
ok(r.j.success && await U.findOne({ username: 'hoon-test' }), `아이디 hoon → hoon-test 변경 (${r.j.error || 'ok'})`);
r = await send('hoon-test', '/api/users/me', 'PUT', { currentPassword: 'yogibo', newUsername: 'hoon' });
ok(r.j.success && await U.findOne({ username: 'hoon' }) && !(await U.findOne({ username: 'hoon-test' })), `다시 hoon 으로 되돌림`);
r = await send('admin', '/api/users/me', 'PUT', { currentPassword: 'x', newUsername: 'admin2' });
ok(r.status === 400, `관리자 아이디 변경 → 거절 (${r.j.error})`);
r = await send('hoon', '/api/users/me', 'PUT', { currentPassword: 'yogibo', newUsername: 'david' });
ok(r.status === 409 || r.status === 400, `이미 있는 아이디로 변경 → 거절 (${r.j.error})`);
ok((await U.findOne({ username: 'hoon' })).passwordHash === hash('yogibo'), 'hoon 비밀번호는 그대로 yogibo');

await mongoose.disconnect();
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
