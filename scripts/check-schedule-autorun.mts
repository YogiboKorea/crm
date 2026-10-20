/**
 * **예약 메일이 손대지 않아도 제시각에 나가는지** 운영 서버로 끝까지 확인한다 (2026-10-20, GitHub 깨우미 설정 뒤).
 *
 *   1) fe@yogico.kr → fe@yogico.kr 예약을 몇 분 뒤로 하나 잡는다 (검사용 업체)
 *   2) 아무것도 누르지 않고 기다린다 — 운영 서버를 깨우는 것은 GitHub 깨우미(10분마다)·열려 있는 CRM 화면(5분마다)·오전 9시 크론
 *   3) 나갔으면 누가 깨워서 나갔는지(실행 기록), 예약 시각보다 몇 분 늦었는지 본다
 *   4) fe@yogico.kr 받은편지함에 실제로 도착했는지 메일 서버(IMAP)에서 찾는다
 *
 * ⚠ 실제 메일이 **한 통** 나간다 — 보내는 사람도 받는 사람도 우리 주소(fe@yogico.kr)뿐이다.
 *    다른 주소로 갈 대기 예약이 있으면 시작하지 않는다 (운영 서버가 그것까지 같이 내보낸다).
 *    끝나면 검사용 업체·예약을 지운다. 메일함에 온 테스트 메일 한 통은 남는다.
 *
 * 사용: CRM_BASE=http://localhost:3000 npx tsx scripts/check-schedule-autorun.mts [--in=2] [--wait=25]
 *   --in    몇 분 뒤로 예약할지 (기본 2)
 *   --wait  최대 몇 분 기다릴지 (기본 25 — GitHub 예약 실행은 몇 분씩 늦을 때가 있다)
 */
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k: string, d: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const IN_MIN = Math.max(1, Number(arg('in', '2')));
const WAIT_MIN = Math.max(5, Number(arg('wait', '25')));
const B = process.env.CRM_BASE || 'http://localhost:3000';
const TO = 'fe@yogico.kr';
const t = (d: Date | number) => new Date(d).toLocaleTimeString('ko-KR');
const w = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const ok = (c: any, m: string) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };

const { MailAccount } = await import('../src/models/MailAccount.ts');
const { toImapConfig } = await import('../src/lib/mail/accounts.ts');
const { withOpenAccount, fetchSinceBatch } = await import('../src/lib/mail/imap.ts');

await mongoose.connect(process.env.MONGODB_URI!);
const db = mongoose.connection.db!;
const L = db.collection('leads');
const S = db.collection('emailschedules');
const R = db.collection('runlocks');

const others = await S.countDocuments({ status: { $in: ['pending', 'sending'] }, to: { $not: /^fe@yogico\.kr$/i } });
if (others) { console.error(`다른 주소로 갈 대기 예약이 ${others}건 있어 시작하지 않습니다.`); process.exit(1); }
const account: any = await MailAccount.findOne({ smtpUser: TO, owner: 'admin', isActive: { $ne: false } }).lean();
const tpl: any = await db.collection('emailtemplates').findOne({ purpose: 'intro', isActive: { $ne: false } });
if (!account || !tpl) { console.error('fe@ 보내는 계정이나 소개 양식이 없습니다'); process.exit(1); }

const token = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET!));

const stamp = Date.now();
const LID = `zz-autorun-${stamp}`;
await L.insertOne({
  leadId: LID, Company: `ZZ 예약 자동발송 확인 ${stamp}`, Country: 'Test', Email: TO, WebsiteContact: '',
  stage: 'queued', stageChangedAt: new Date().toISOString(), readyForOutreach: true, addedManually: true,
  emailHistory: [], createdAt: new Date(), updatedAt: new Date(),
});
const due = new Date(Date.now() + IN_MIN * 60_000);
const SUBJ = `[예약 자동발송 확인 ${t(due)}] fe@ → fe@ (${stamp})`;
const BODY = `예약 메일이 손대지 않아도 제시각에 나가는지 확인하는 메일입니다.\n예약 시각: ${due.toLocaleString('ko-KR')}\n답장하지 않으셔도 됩니다.`;

try {
  console.log(`── 1) 예약 잡기: ${TO} → ${TO} · 예약 시각 ${t(due)} (${IN_MIN}분 뒤)`);
  const res = await fetch(`${B}/api/mail/campaign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `admin_session=${token}` },
    body: JSON.stringify({ leadIds: [LID], templateId: String(tpl._id), mailAccountId: String(account._id), subject: SUBJ, body: BODY, startAt: due.toISOString(), followUp: false }),
  });
  const j: any = await res.json().catch(() => ({}));
  ok(j.success && j.scheduled === 1, `예약 1건 (${j.error || 'ok'})`);
  let s: any = await S.findOne({ leadId: LID });
  if (!s) throw new Error('예약이 만들어지지 않았습니다');
  ok(s.to === TO && s.status === 'pending', `받는 주소 ${s.to} · ${s.status}`);

  console.log(`\n── 2) 기다림 — 아무것도 누르지 않습니다 (최대 ${WAIT_MIN}분)`);
  const runs: Array<{ at: number; source: string }> = [];
  let lastKey = '';
  const until = Date.now() + WAIT_MIN * 60_000;
  while (Date.now() < until) {
    const l: any = await R.findOne({ _id: 'process-schedules' });
    const key = l ? `${new Date(l.since).getTime()}|${l.source}` : '';
    if (l && key !== lastKey) {
      lastKey = key;
      runs.push({ at: new Date(l.since).getTime(), source: l.source || '' });
      console.log(`     ${t(Date.now())} 자동 처리 실행: ${t(l.since)} · ${l.source || '(없음)'}`);
    }
    s = await S.findOne({ _id: s._id });
    if (s.status !== 'pending' && s.status !== 'sending') break;
    await w(10_000);
  }

  console.log('\n── 3) 결과');
  ok(s.status === 'sent', `예약 상태: ${s.status}${s.lastError ? ` (${s.lastError})` : ''}${s.canceledReason ? ` (${s.canceledReason})` : ''}`);
  if (s.status === 'sent') {
    const late = Math.round((new Date(s.sentAt).getTime() - due.getTime()) / 60_000);
    // 보낸 시각 바로 앞에 시작한 실행이 그 메일을 보낸 실행이다
    const by = runs.filter((r) => r.at <= new Date(s.sentAt).getTime() + 1000).pop();
    const SRC: Record<string, string> = { external: 'GitHub 깨우미', browser: '열려 있는 CRM 화면', cron: '오전 9시 서버 크론', button: '[지금 내보내기] 버튼' };
    ok(true, `나간 시각 ${t(s.sentAt)} · 예약 시각보다 ${late}분 뒤 · 깨운 곳: ${by ? SRC[by.source] || by.source : '알 수 없음'}`);
    const lead: any = await L.findOne({ leadId: LID });
    const h = (lead?.emailHistory || []).find((x: any) => x.status === 'sent' || x.status === 'scheduled');
    const mid = String(h?.messageId || '');
    ok(h?.status === 'sent' && mid && !/^dryrun/.test(mid), `실제 발송 기록 (${h?.status} · ${mid || '메일번호 없음'})`);

    if (mid && !/^dryrun/.test(mid)) {
      console.log(`\n── 4) ${TO} 받은편지함에서 찾기`);
      let found = false;
      for (let round = 1; round <= 8 && !found; round++) {
        await w(round === 1 ? 3000 : 10_000);
        await withOpenAccount(toImapConfig(account, 'INBOX'), async (scoped: any) => {
          let afterUid = 0;
          for (let i = 0; i < 20 && !found; i++) {
            const b = await fetchSinceBatch(scoped, { folder: 'INBOX', since: new Date(Date.now() - 2 * 3600_000), afterUid, limit: 50 });
            if (!b.messages.length) break;
            for (const m of b.messages) {
              const src = String(m.source);
              const id = src.match(/^message-id:\s*(<[^>]+>)/im)?.[1] || '';
              if (id.trim().toLowerCase() === mid.toLowerCase() || src.includes(String(stamp))) { found = true; break; }
            }
            afterUid = b.lastUid;
            if (!b.remaining) break;
          }
        });
        if (!found) console.log(`     ${round}회차 — 아직 안 보임`);
      }
      ok(found, found ? `${TO} 받은편지함에 도착 ✉` : '받은편지함에서 찾지 못함');
    }
  }
  const ext = runs.filter((r) => r.source === 'external');
  ok(ext.length > 0, ext.length ? `GitHub 깨우미가 서버를 깨움 (${ext.map((r) => t(r.at)).join(', ')})` : `기다리는 동안 GitHub 깨우미 실행 기록 없음 (실행 기록: ${runs.map((r) => `${t(r.at)} ${r.source}`).join(', ') || '없음'})`);
} catch (e: any) {
  fail++;
  console.log(`  X   중단: ${e?.message || e}`);
} finally {
  const ds = await S.deleteMany({ leadId: LID });
  const dl = await L.deleteOne({ leadId: LID });
  console.log(`\n검사용 업체·예약 치움 (업체 ${dl.deletedCount} · 예약 ${ds.deletedCount}) — 메일함의 테스트 메일 한 통은 남습니다`);
  await mongoose.disconnect();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 예약 메일이 손대지 않아도 제시각에 나가고, 받은편지함까지 도착했습니다');
process.exit(fail ? 1 : 0);
