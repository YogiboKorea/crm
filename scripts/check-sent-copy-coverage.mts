/**
 * **이 앱에서 보낸 메일이 이카운트 보낸메일함에 실제로 남는지** 대조한다 (2026-09-17, 대표님 확인 요청).
 *
 * 말로 "코드에 있습니다" 가 아니라, 실제로 나간 메일의 Message-ID 를 메일 서버 보낸메일함에서 찾아 확인한다.
 * **메일을 보내지 않는다** — 이미 나간 기록만 본다.
 *
 * 보는 길:
 *   발송 관리(즉시)      api/mail/send
 *   발송 관리(예약)      lib/schedule-runner
 *   답장                 api/mail/reply
 *   새 메일 쓰기         api/mail/compose
 *   테스트 메일          api/mail/test-send
 *
 * 사용: npx tsx scripts/check-sent-copy-coverage.mts [--days=14]
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k: string, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const DAYS = Number(arg('days', '14')) || 14;

const { MailAccount } = await import('../src/models/MailAccount.ts');
const { toImapConfig } = await import('../src/lib/mail/accounts.ts');
const { withOpenAccount, findSentPath, fetchSinceBatch } = await import('../src/lib/mail/imap.ts');

let fail = 0;
const ok = (c: any, m: string) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };

await mongoose.connect(process.env.MONGODB_URI!);
const db = mongoose.connection.db!;
const since = new Date(Date.now() - DAYS * 86400000);
const norm = (v: any) => String(v || '').trim().toLowerCase();

// ── 1) 코드: 메일을 보내는 길마다 보낸메일함 사본을 넘기는가 ──
console.log('── 메일이 나가는 길과 보낸메일함 사본 설정');
const fs = await import('fs');
const paths: Array<[string, string, boolean]> = [
  ['발송 관리 (즉시)', 'src/app/api/mail/send/route.ts', true],
  ['발송 관리 (예약)', 'src/lib/schedule-runner.ts', true],
  ['답장', 'src/app/api/mail/reply/route.ts', true],
  ['새 메일 쓰기', 'src/app/api/mail/compose/route.ts', true],
  ['테스트 메일', 'src/app/api/mail/test-send/route.ts', true],
  ['브리핑 (나에게 보내는 요약)', 'src/app/api/mail/briefing/route.ts', false],
  ['계정 연결 테스트', 'src/app/api/mail/test/route.ts', false],
];
for (const [label, file, want] of paths) {
  const src = fs.readFileSync(file, 'utf8');
  const has = /sentCopyAccount\s*:/.test(src);
  if (want) ok(has, `${label} — 보낸메일함에 남김`);
  else console.log(`  —   ${label} — 일부러 안 남김 (나에게 보내는 메일이라 보낸메일함이 지저분해진다)${has ? ' ⚠ 설정이 들어가 있음' : ''}`);
}

// ── 2) 실제: 나간 메일이 메일 서버 보낸메일함에 있는가 ──
console.log(`\n── 실제 대조 (최근 ${DAYS}일 · 메일은 보내지 않는다)`);
const leads: any[] = await db.collection('leads').find(
  { 'emailHistory.sentAt': { $gte: since.toISOString() } },
  { projection: { Company: 1, emailHistory: 1 } },
).toArray();

type Sent = { company: string; subject: string; to: string; at: string; mid: string };
const sent: Sent[] = [];
for (const l of leads) {
  for (const h of (l.emailHistory || [])) {
    if (!h?.sentAt || h.sentAt < since.toISOString()) continue;
    if (h.status !== 'sent') continue;
    sent.push({ company: l.Company || '', subject: h.subject || '', to: h.to || '', at: h.sentAt, mid: norm(h.messageId) });
  }
}
sent.sort((a, b) => a.at.localeCompare(b.at));
console.log(`  이 앱에서 업체로 나간 메일 ${sent.length}통 (발송 관리·답장·새 메일 모두 여기에 기록된다)`);
if (!sent.length) {
  console.log('  최근에 나간 메일이 없어 대조할 것이 없습니다. --days 를 늘려 보세요.');
  await mongoose.disconnect();
  process.exit(0);
}
const noMid = sent.filter((s) => !s.mid).length;
if (noMid) console.log(`  그중 ${noMid}통은 메일 번호(Message-ID)가 기록돼 있지 않아 대조에서 제외합니다 (옛 발송분)`);

// 보낸메일함에 들어 있는 Message-ID 를 모은다
const accounts: any[] = await MailAccount.find({ isActive: { $ne: false } }).lean();
const have = new Set<string>();
for (const account of accounts) {
  let settings;
  try { settings = toImapConfig(account, 'INBOX'); } catch { continue; }
  try {
    await withOpenAccount(settings, async (scoped: any) => {
      const sentPath = await findSentPath(scoped.__client);
      if (!sentPath) { console.log(`  ⚠ ${account.smtpUser} — 보낸메일함 폴더를 찾지 못했습니다`); return; }
      let afterUid = 0; let n = 0;
      for (let i = 0; i < 40; i++) {
        const b = await fetchSinceBatch(scoped, { folder: sentPath, since, afterUid, limit: 100 });
        if (!b.messages.length) break;
        for (const m of b.messages) {
          const mid = String(m.source).match(/^message-id:\s*(<[^>]+>)/im)?.[1];
          if (mid) have.add(norm(mid));
        }
        n += b.messages.length;
        afterUid = b.lastUid;
        if (!b.remaining) break;
      }
      console.log(`  ${account.smtpUser} 보낸메일함(${sentPath}) — 최근 ${DAYS}일 ${n}통`);
    });
  } catch (e: any) {
    console.log(`  ⚠ ${account.smtpUser} — 보낸메일함을 읽지 못했습니다: ${String(e?.message || e).slice(0, 60)}`);
  }
}

const checkable = sent.filter((s) => s.mid);
const missing = checkable.filter((s) => !have.has(s.mid));
console.log('');
ok(checkable.length > 0, `대조할 수 있는 메일 ${checkable.length}통`);
ok(missing.length === 0, `그중 보낸메일함에 있는 것 ${checkable.length - missing.length}통 · 없는 것 ${missing.length}통`);
const fmt = (d: string) => new Date(d).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
if (missing.length) {
  console.log('\n  보낸메일함에서 못 찾은 것:');
  missing.slice(0, 10).forEach((s) => console.log(`    ${fmt(s.at)} · ${s.company.slice(0, 22)} → ${s.to} · ${s.subject.slice(0, 40)}`));
} else {
  console.log('\n  최근 확인된 것 (보낸메일함에 있음):');
  checkable.slice(-4).forEach((s) => console.log(`    ${fmt(s.at)} · ${s.company.slice(0, 22)} → ${s.to} · ${s.subject.slice(0, 40)}`));
}

await mongoose.disconnect();
console.log(fail ? `\n❌ 확인 필요 ${fail}건` : '\n✅ 이 앱에서 보낸 메일은 보낸메일함에 남습니다');
process.exit(fail ? 1 : 0);
