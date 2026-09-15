/**
 * 보낸 메일 사본이 이카운트 보낸메일함에 남는지 확인한다 (실제로 테스트 메일 1통을 fe@yogico.kr 로 보낸다).
 *   ① /api/mail/test-send 로 발송 → savedToSent
 *   ② 이카운트 보낸메일함(IMAP)에서 그 제목 찾기
 *   ③ 앱의 [📤 보낸 메일함] 목록(/api/mail/sent)에 뜨는지
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
const fe = await db.collection('mailaccounts').findOne({ owner: 'admin', smtpUser: 'fe@yogico.kr' });
const tpl = await db.collection('emailtemplates').findOne({ isActive: { $ne: false } });
const jwt = await new SignJWT({ user: 'admin', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const H = { 'Content-Type': 'application/json', Cookie: `admin_session=${jwt}` };

const t = Date.now();
const r = await fetch('http://localhost:3000/api/mail/test-send', {
  method: 'POST', headers: H,
  body: JSON.stringify({ to: 'fe@yogico.kr', templateId: String(tpl._id), mailAccountId: String(fe._id) }),
}).then((x) => x.json());
console.log('  발송:', JSON.stringify({ ok: r.success, subject: r.subject, error: r.error }));
ok(r.success, `테스트 메일 발송 (${((Date.now() - t) / 1000).toFixed(1)}초)`);

// 앱이 알려주는 사본 저장 여부
const sched = await db.collection('emailschedules').findOne({}, { sort: { _id: -1 } });
void sched;
ok(r.success, '발송 자체는 성공');

// 이카운트 보낸메일함에서 직접 찾기
const client = new ImapFlow({ host: 'wmbox4.ecount.com', port: 993, secure: true, auth: { user: fe.smtpUser, pass: decryptSecret(fe.imapPassEnc || fe.smtpPassEnc) }, logger: false });
await client.connect();
const boxes = await client.list();
const sentPath = boxes.find((b) => b.specialUse === '\\Sent')?.path
  || boxes.find((b) => /^(Sent|Sent Items|Sent Messages|보낸메일함|보낸편지함)$/i.test(b.path))?.path;
console.log('  보낸메일함 폴더:', sentPath, '| 전체 폴더:', boxes.map((b) => b.path).join(', ').slice(0, 120));
let found = null;
for (let i = 0; i < 6 && !found; i++) {
  const lock = await client.getMailboxLock(sentPath);
  try {
    const st = await client.status(sentPath, { messages: true });
    for await (const m of client.fetch(`${Math.max(1, st.messages - 4)}:*`, { envelope: true, internalDate: true })) {
      if (m.envelope?.subject === r.subject) found = { at: m.internalDate, to: m.envelope.to?.[0]?.address, from: m.envelope.from?.[0]?.address };
    }
  } finally { lock.release(); }
  if (!found) await w(3000);
}
ok(!!found, `이카운트 보낸메일함(${sentPath})에 사본 있음 ${found ? `· ${new Date(found.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · ${found.from} → ${found.to}` : ''}`);
await client.logout();

// 앱의 보낸 메일함 목록
const list = await fetch(`http://localhost:3000/api/mail/sent?page=1&accountId=${fe._id}`, { headers: { Cookie: `admin_session=${jwt}` } }).then((x) => x.json());
const hit = (list.items || []).find((m) => m.subject === r.subject);
ok(list.success && !!hit, `[📤 보낸 메일함] 목록에 뜸 (전체 ${list.total}통${hit ? ` · ${String(hit.date).slice(0, 19)}` : ''}) ${list.error || ''}`);

await mongoose.disconnect();
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
