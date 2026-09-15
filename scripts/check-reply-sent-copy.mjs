/**
 * CRM 에서 [답장]을 보냈을 때 보낸메일함에 사본이 남는지 — 실제로 한 통 보낸다.
 * 받는 사람이 우리 주소(fe@yogico.kr)인 메일에만 답장해서, 바깥 업체로는 나가지 않는다.
 */
import mongoose from 'mongoose';
import { ImapFlow } from 'imapflow';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const { decryptSecret } = await import('../src/lib/crypto.ts');

let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms) => new Promise((r) => setTimeout(r, ms));

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const M = db.collection('inboundmails');
const A = db.collection('mailaccounts');
const fe = await A.findOne({ owner: 'admin', smtpUser: 'fe@yogico.kr' });

// 우리 주소끼리 주고받은 메일에만 답장한다 (바깥으로 안 나감)
const target = await M.findOne(
  { accountId: String(fe._id), 'from.address': /fe@yogico\.kr/i, trashedAt: null },
  { sort: { date: -1 }, projection: { subject: 1, from: 1, to: 1, messageId: 1 } },
);
ok(!!target, `답장할 메일: ${String(target?.subject).slice(0, 50)} (from ${target?.from?.address})`);

const jwt = await new SignJWT({ user: 'admin', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const stamp = Date.now();
const r = await fetch('http://localhost:3000/api/mail/reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: `admin_session=${jwt}` },
  body: JSON.stringify({ inboundMailId: String(target._id), body: `보낸메일함 사본 확인용 회신입니다. (${stamp})`, mailAccountId: String(fe._id) }),
}).then((x) => x.json());
console.log('  답장 응답:', JSON.stringify({ ok: r.success, to: r.to, subject: r.subject, error: r.error }));
ok(r.success, `답장 발송 (받는 사람 ${r.to})`);
ok(String(r.to || '').endsWith('@yogico.kr'), '받는 사람이 우리 주소 — 바깥으로 나가지 않음');

const client = new ImapFlow({ host: 'wmbox4.ecount.com', port: 993, secure: true, auth: { user: fe.smtpUser, pass: decryptSecret(fe.imapPassEnc || fe.smtpPassEnc) }, logger: false });
await client.connect();
let found = null;
for (let i = 0; i < 6 && !found; i++) {
  const lock = await client.getMailboxLock('Sent');
  try {
    const st = await client.status('Sent', { messages: true });
    for await (const m of client.fetch(`${Math.max(1, st.messages - 4)}:*`, { envelope: true, internalDate: true, bodyStructure: true })) {
      if (m.envelope?.subject === r.subject) found = { at: m.internalDate, to: m.envelope.to?.[0]?.address };
    }
  } finally { lock.release(); }
  if (!found) await w(3000);
}
ok(!!found, `보낸메일함에 답장 사본 있음 ${found ? `· ${new Date(found.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} → ${found.to}` : ''}`);
await client.logout();

const list = await fetch(`http://localhost:3000/api/mail/sent?page=1&accountId=${fe._id}`, { headers: { Cookie: `admin_session=${jwt}` } }).then((x) => x.json());
ok((list.items || []).some((m) => m.subject === r.subject), `[📤 보낸 메일함] 목록에도 뜸 (전체 ${list.total}통)`);

await mongoose.disconnect();
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
