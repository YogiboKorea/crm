/**
 * **웹메일·아웃룩·휴대폰에서 보낸 답장의 본문을 업체 대화에 붙인다 — 처음 한 번 몰아서** (2026-10-20, 대표님 요청).
 *
 * 평소에는 메일을 가져올 때마다 보낸메일함과 대조하면서 25통씩 붙는다 (lib/mail/reconcile.ts).
 * 이건 그걸 기다리지 않고 지금 채운다. 끝나면 한 업체를 골라 대화 화면(api/mail/thread)에 실제로 보이는지 확인한다.
 *
 * 메일 서버는 **읽기만** 한다. DB 에는 받은 메일에 outsideReplies 를 붙이고, 평소 수집과 똑같이 '답함' 표시를 맞춘다.
 *
 * 사용: CRM_BASE=http://localhost:3000 npx tsx scripts/backfill-outside-replies.mts [--owner=david] [--limit=150]
 */
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k: string, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const OWNER = arg('owner', '');
const LIMIT = Math.max(1, Number(arg('limit', '150')));
const B = process.env.CRM_BASE || 'http://localhost:3000';

const { MailAccount } = await import('../src/models/MailAccount.ts');
const { toImapConfig } = await import('../src/lib/mail/accounts.ts');
const { withOpenAccount } = await import('../src/lib/mail/imap.ts');
const { syncSentReplies } = await import('../src/lib/mail/reconcile.ts');

await mongoose.connect(process.env.MONGODB_URI!);
const I = mongoose.connection.db!.collection('inboundmails');

const accounts: any[] = await MailAccount.find({
  isActive: { $ne: false }, mergedInto: { $in: [null, ''] }, ...(OWNER ? { owner: OWNER } : {}),
}).lean();
console.log(`계정 ${accounts.length}개 — 보낸메일함 최근 400통에서 업체 메일에 대한 답장을 찾아 본문을 붙입니다 (계정마다 최대 ${LIMIT}통)\n`);

for (const a of accounts) {
  const id = String(a._id);
  const before = await I.countDocuments({ accountId: id, 'outsideReplies.0': { $exists: true } });
  const t0 = Date.now();
  try {
    const r = await withOpenAccount(toImapConfig(a, 'INBOX'), (scoped: any) => syncSentReplies(scoped, { accountId: id, attachLimit: LIMIT }));
    const after = await I.countDocuments({ accountId: id, 'outsideReplies.0': { $exists: true } });
    console.log(`  ${String(a.smtpUser).padEnd(20)} (${a.owner}) 보낸메일 ${r.scanned}통 · 답장으로 맞춤 ${r.matched} · 본문 붙임 ${r.attached} · 답장 붙은 메일 ${before}→${after} · ${Math.round((Date.now() - t0) / 1000)}초`);
  } catch (e: any) {
    console.log(`  ${String(a.smtpUser).padEnd(20)} (${a.owner}) 실패: ${e?.message || e}`);
  }
}

// ── 대화 화면에 실제로 보이는지 — 답장이 붙은 업체 하나를 그 메일함 주인 아이디로 열어 본다 ──
const sample: any = await I.findOne(
  { leadId: { $nin: [null, ''] }, 'outsideReplies.0': { $exists: true } },
  { leadId: 1, accountId: 1, subject: 1 },
);
if (sample) {
  const acc: any = accounts.find((x) => String(x._id) === String(sample.accountId))
    || await MailAccount.findById(sample.accountId).lean();
  const owner = acc?.owner === 'admin' ? 'yogico' : acc?.owner || 'yogico';
  const token = await new SignJWT({ user: owner, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(process.env.JWT_SECRET!));
  const res = await fetch(`${B}/api/mail/thread?leadId=${encodeURIComponent(sample.leadId)}`, { headers: { Cookie: `admin_session=${token}` } });
  const j: any = await res.json().catch(() => ({}));
  const outside = (j.timeline || []).filter((x: any) => x.outside);
  console.log(`\n대화 화면 확인 — ${j.lead?.Company || sample.leadId} (${owner} 아이디)`);
  console.log(`  타임라인 ${j.timeline?.length ?? 0}통 중 웹메일·아웃룩에서 보낸 답장 ${outside.length}통 · 보냄 ${j.stats?.sentCount} (그중 밖에서 ${j.stats?.outsideCount})`);
  for (const o of outside.slice(-2)) {
    console.log(`  · ${new Date(o.at).toLocaleString('ko-KR')} "${String(o.subject).slice(0, 50)}" → ${String(o.to).slice(0, 40)}`);
    console.log(`    ${String(o.body).replace(/\s+/g, ' ').slice(0, 120)}…`);
  }
} else {
  console.log('\n답장이 붙은 업체 메일이 아직 없습니다');
}
const total = await I.countDocuments({ 'outsideReplies.0': { $exists: true } });
console.log(`\n전체: 답장 본문이 붙은 받은 메일 ${total}통`);
await mongoose.disconnect();
process.exit(0);
