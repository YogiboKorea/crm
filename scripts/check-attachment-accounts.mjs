/**
 * 계정 모양별로 첨부 내려받기가 **올바른 메일함**을 여는지 확인한다.
 *   · 대표님 계정(_id) · 개발 계정(_id) · 옛 수신 설정('main')
 * 다른 메일함을 열면 같은 UID 의 다른 메일이 나오므로, 받은 크기가 저장된 크기와
 * 정확히 같으면 맞는 메일함을 연 것이다.
 */
import { SignJWT } from 'jose';
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
await mongoose.connect(process.env.MONGODB_URI);
const M = mongoose.connection.collection('inboundmails');
const ids = await M.distinct('accountId', { trashedAt: null, 'attachments.0': { $exists: true } });
let fail = 0;
for (const acc of ids) {
  const mails = await M.find({ trashedAt: null, accountId: acc, 'attachments.0': { $exists: true } })
    .sort({ date: -1 }).limit(3).project({ subject: 1, attachments: 1 }).toArray();
  console.log(`\n── 계정 ${acc} (첨부 메일 ${mails.length}통 시험)`);
  for (const m of mails) {
    const a = m.attachments.filter((x) => !x.inline).sort((x, y) => x.size - y.size)[0];
    if (!a) continue;
    const r = await fetch(`http://localhost:3000/api/mail/${m._id}/attachment?att=${a._id}`, { headers: { Cookie: `admin_session=${jwt}` } });
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('json')) {
      const j = await r.json();
      const gone = r.status === 410;
      if (!gone) fail++;
      console.log(`  ${gone ? '—   ' : 'X   '}${r.status} ${j.error}  | ${m.subject.slice(0, 36)}`);
      continue;
    }
    const b = Buffer.from(await r.arrayBuffer());
    const good = r.status === 200 && b.length === a.size;
    if (!good) fail++;
    console.log(`  ${good ? 'OK  ' : 'X   '}${b.length}/${a.size}B  ${a.filename.slice(0, 30)}  | ${m.subject.slice(0, 36)}`);
  }
}
await mongoose.disconnect();
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 모든 계정에서 정확한 파일');
process.exit(fail ? 1 : 0);
