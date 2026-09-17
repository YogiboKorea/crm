/**
 * **[발송 관리]로 보낸 메일이 이카운트 보낸메일함에 실제로 남는지** 끝까지 확인한다 (2026-09-17, 대표님 확인 요청).
 *
 * 코드만 읽고 "남습니다" 라고 할 수 없어서, 실제 발송 경로(api/mail/send)를 그대로 태워 본다.
 *
 * ⚠ 실제 메일이 **한 통** 나간다. 받는 사람은 **우리 주소(fe@yogico.kr)** 뿐이다 — 바이어에게는 절대 가지 않는다.
 *    검사용 가짜 업체를 만들어 거기에 보내고, 끝나면 그 업체를 흔적 없이 지운다.
 *
 * 사용: npx tsx scripts/check-outbox-sent-copy.mts
 *   --to=<주소>   기본 fe@yogico.kr (우리 주소만 허용)
 */
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k: string, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const TO = arg('to', 'fe@yogico.kr');
if (!/@yogico\.kr$/i.test(TO)) {
  console.error(`받는 사람은 우리 주소(@yogico.kr)만 됩니다: ${TO}`);
  process.exit(1);
}
const B = 'http://localhost:3000';
let fail = 0;
const ok = (c: any, m: string) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { MailAccount } = await import('../src/models/MailAccount.ts');
const { toImapConfig } = await import('../src/lib/mail/accounts.ts');
const { withOpenAccount, findSentPath, fetchSinceBatch } = await import('../src/lib/mail/imap.ts');

await mongoose.connect(process.env.MONGODB_URI!);
const L = mongoose.connection.db!.collection('leads');

// 보내는 계정 — 대표님 계정 중 david 아이디가 가진 것
const account: any = await MailAccount.findOne({ owner: 'david', isActive: { $ne: false } }).lean();
if (!account) { console.error('david 아이디로 등록된 메일 계정이 없습니다'); process.exit(1); }

const stamp = Date.now();
const TEST_ID = `zz-sentcopy-${stamp}`;
const now = new Date().toISOString();
await L.insertOne({
  leadId: TEST_ID,
  Company: `ZZ 보낸메일함 확인용 ${stamp}`,
  Country: 'Test', Email: TO, WebsiteContact: '',
  stage: 'queued', stageChangedAt: now, readyForOutreach: true, addedManually: true,
  emailHistory: [], createdAt: new Date(), updatedAt: new Date(),
});
console.log(`검사용 업체를 만들었습니다 → ${TO} 로 한 통 보냅니다 (보내는 계정 ${account.smtpUser})`);

const token = await new SignJWT({ user: 'david', role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET!));

const SUBJECT = `[확인용] 발송관리 보낸메일함 사본 ${stamp}`;
let messageId = '';
try {
  console.log('\n── 발송 관리 경로로 보내기 (api/mail/send)');
  const res = await fetch(`${B}/api/mail/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `admin_session=${token}` },
    body: JSON.stringify({
      leadIds: [TEST_ID],
      subject: SUBJECT,
      body: '<div>보낸메일함에 사본이 남는지 확인하는 메일입니다. 답장하지 않으셔도 됩니다.</div>',
      bodyIsHtml: true,
      mailAccountId: String(account._id),
    }),
  });
  const json: any = await res.json().catch(() => null);
  ok(res.status === 200 && json?.success, `발송 응답 (HTTP ${res.status})`);
  const r0 = (json?.results || [])[0];
  ok(r0?.ok === true, `보냄 — ${r0?.error || r0?.messageId || ''}`);
  ok(json?.sent === 1, `보낸 통수 ${json?.sent} (실패 ${json?.failed})`);

  // 발송 이력에 기록된 Message-ID
  const lead: any = await L.findOne({ leadId: TEST_ID }, { projection: { emailHistory: 1, stage: 1 } });
  const h = (lead?.emailHistory || [])[0];
  messageId = String(h?.messageId || '').trim();
  ok(Boolean(messageId), `발송 이력에 메일 번호가 남음 (${messageId || '없음'})`);
  ok(lead?.stage === 'contacted', `업체 단계가 [발송 완료]로 넘어감 (${lead?.stage})`);

  if (messageId) {
    console.log('\n── 이카운트 보낸메일함에서 찾기');
    // 사본은 발송 직후 IMAP APPEND 로 들어간다 — 서버에 반영될 시간을 조금 준다
    let found = false;
    for (let round = 1; round <= 6 && !found; round++) {
      await w(round === 1 ? 2500 : 5000);
      const settings = toImapConfig(account, 'INBOX');
      await withOpenAccount(settings, async (scoped: any) => {
        const sentPath = await findSentPath(scoped.__client);
        if (!sentPath) { console.log('  보낸메일함 폴더를 찾지 못했습니다'); return; }
        const since = new Date(Date.now() - 2 * 3600_000);
        let afterUid = 0;
        for (let i = 0; i < 20 && !found; i++) {
          const b = await fetchSinceBatch(scoped, { folder: sentPath, since, afterUid, limit: 50 });
          if (!b.messages.length) break;
          for (const m of b.messages) {
            const src = String(m.source);
            const mid = src.match(/^message-id:\s*(<[^>]+>)/im)?.[1] || '';
            if (mid.trim().toLowerCase() === messageId.toLowerCase() || src.includes(String(stamp))) { found = true; break; }
          }
          afterUid = b.lastUid;
          if (!b.remaining) break;
        }
        if (!found) console.log(`  ${round}회차 — 아직 안 보임 (${sentPath})`);
      });
    }
    ok(found, found ? '보낸메일함에 사본이 있습니다 ✉' : '보낸메일함에서 찾지 못했습니다');
  }
} finally {
  const del = await L.deleteOne({ leadId: TEST_ID });
  console.log(`\n검사용 업체 치움 (${del.deletedCount}건) · 남은 흔적 ${await L.countDocuments({ leadId: TEST_ID })}건`);
  console.log(`보낸메일함에는 "[확인용] …" 제목으로 한 통 남습니다 — 확인용이라 지우셔도 됩니다.`);
  await mongoose.disconnect();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 발송 관리로 보낸 메일은 보낸메일함에 남습니다');
process.exit(fail ? 1 : 0);
