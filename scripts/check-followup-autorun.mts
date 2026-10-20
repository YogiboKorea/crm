/**
 * **1차 메일 → (답 없음) → 2차 재발송까지 손대지 않고 나가는지** 운영 서버로 확인한다 (2026-10-20).
 *
 *   1) fe@ → fe@ 1차 예약 (재발송 켬 · 1일 뒤) — 자동 처리가 제시각에 보내는지 기다린다
 *   2) 하루가 지난 것처럼 이 검사용 업체의 발송 시각만 3일 앞으로 당긴다
 *   3) 재발송 예약 만들기 — 원래 매일 오전 7시 30분 작업(lib/mail/follow-up.ts)이 하는 일을 지금 한 번 돌린다
 *   4) 2차 재발송을 자동 처리가 보내는지 기다린다 (누르지 않는다)
 *   5) 2차가 '팔로우업' 양식으로, 1차의 답장(Re: 제목 · In-Reply-To)으로 fe@ 받은편지함에 도착했는지 메일 서버에서 본다
 *
 * ⚠ 실제 메일이 **두 통** 나간다 — 보내는 사람도 받는 사람도 fe@yogico.kr 뿐이다.
 *    다른 주소로 갈 대기 예약이 있거나, 재발송 대상이 될 다른 업체가 있으면 시작하지 않는다.
 *    끝나면 검사용 업체·예약을 지운다. 메일함의 테스트 메일 두 통은 남는다.
 *
 * 사용: CRM_BASE=http://localhost:3000 npx tsx scripts/check-followup-autorun.mts [--in=2] [--wait=25]
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
const SRC: Record<string, string> = { external: 'GitHub 깨우미', browser: '열려 있는 CRM 화면', cron: '오전 9시 서버 크론', button: '[지금 내보내기] 버튼' };

const { createDueFollowUps } = await import('../src/lib/mail/follow-up.ts');
const { MailAccount } = await import('../src/models/MailAccount.ts');
const { toImapConfig } = await import('../src/lib/mail/accounts.ts');
const { withOpenAccount, fetchSinceBatch } = await import('../src/lib/mail/imap.ts');

await mongoose.connect(process.env.MONGODB_URI!);
const db = mongoose.connection.db!;
const L = db.collection('leads');
const S = db.collection('emailschedules');
const R = db.collection('runlocks');

// ── 안전장치 ──
const others = await S.countDocuments({ status: { $in: ['pending', 'sending'] }, to: { $not: /^fe@yogico\.kr$/i } });
if (others) { console.error(`다른 주소로 갈 대기 예약이 ${others}건 있어 시작하지 않습니다.`); process.exit(1); }
// 3)에서 재발송 작업을 돌리면 조건이 맞는 다른 업체에도 재발송 예약이 생긴다 — 우리 주소가 아닌 곳이 하나라도 있으면 멈춘다
const otherFollow = await S.countDocuments({ status: 'sent', followUp: true, to: { $not: /^fe@yogico\.kr$/i } });
if (otherFollow) { console.error(`재발송 대상이 될 수 있는 다른 업체 발송 기록이 ${otherFollow}건 있어 시작하지 않습니다.`); process.exit(1); }

const account: any = await MailAccount.findOne({ smtpUser: TO, owner: 'admin', isActive: { $ne: false } }).lean();
const intro: any = await db.collection('emailtemplates').findOne({ purpose: 'intro', isActive: { $ne: false } });
const follow: any = await db.collection('emailtemplates').findOne({ purpose: 'followup', isActive: { $ne: false } });
if (!account || !intro || !follow) { console.error('fe@ 계정·소개 양식·팔로우업 양식이 다 있어야 합니다'); process.exit(1); }

const token = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET!));

/** 자동 처리 실행 기록을 따라가며 예약이 끝날 때까지 기다린다 (누르지 않는다) */
const runs: Array<{ at: number; source: string }> = [];
let lastKey = '';
async function waitDone(id: any, label: string) {
  const until = Date.now() + WAIT_MIN * 60_000;
  let s: any = null;
  while (Date.now() < until) {
    const l: any = await R.findOne({ _id: 'process-schedules' });
    const key = l ? `${new Date(l.since).getTime()}|${l.source}` : '';
    if (l && key !== lastKey) {
      lastKey = key;
      runs.push({ at: new Date(l.since).getTime(), source: l.source || '' });
      console.log(`     ${t(Date.now())} 자동 처리 실행: ${t(l.since)} · ${SRC[l.source] || l.source}`);
    }
    s = await S.findOne({ _id: id });
    if (s && s.status !== 'pending' && s.status !== 'sending') break;
    await w(10_000);
  }
  ok(s?.status === 'sent', `${label} 상태: ${s?.status}${s?.lastError ? ` (${s.lastError})` : ''}${s?.canceledReason ? ` (${s.canceledReason})` : ''}`);
  if (s?.status === 'sent') {
    const by = runs.filter((r) => r.at <= new Date(s.sentAt).getTime() + 1000).pop();
    console.log(`     나간 시각 ${t(s.sentAt)} · 예약 시각보다 ${Math.round((new Date(s.sentAt).getTime() - new Date(s.scheduledFor).getTime()) / 60_000)}분 뒤 · 깨운 곳: ${by ? SRC[by.source] || by.source : '알 수 없음'}`);
  }
  return s;
}

/** fe@ 받은편지함에서 메일번호로 찾아 원문을 돌려준다 */
async function findInbox(mid: string): Promise<string> {
  for (let round = 1; round <= 8; round++) {
    await w(round === 1 ? 3000 : 10_000);
    let raw = '';
    await withOpenAccount(toImapConfig(account, 'INBOX'), async (scoped: any) => {
      let afterUid = 0;
      for (let i = 0; i < 20 && !raw; i++) {
        const b = await fetchSinceBatch(scoped, { folder: 'INBOX', since: new Date(Date.now() - 2 * 3600_000), afterUid, limit: 50 });
        if (!b.messages.length) break;
        for (const m of b.messages) {
          const src = String(m.source);
          const id = src.match(/^message-id:\s*(<[^>]+>)/im)?.[1] || '';
          if (id.trim().toLowerCase() === mid.toLowerCase()) { raw = src; break; }
        }
        afterUid = b.lastUid;
        if (!b.remaining) break;
      }
    });
    if (raw) return raw;
    console.log(`     ${round}회차 — 아직 안 보임`);
  }
  return '';
}

const stamp = Date.now();
const LID = `zz-followup-${stamp}`;
await L.insertOne({
  leadId: LID, Company: `ZZ 2차 재발송 확인 ${stamp}`, Country: 'Test', Email: TO, WebsiteContact: '',
  stage: 'queued', stageChangedAt: new Date().toISOString(), readyForOutreach: true, addedManually: true,
  emailHistory: [], createdAt: new Date(), updatedAt: new Date(),
});
const due = new Date(Date.now() + IN_MIN * 60_000);
const SUBJ = `[2차 재발송 확인 · 1차 메일 ${t(due)}] fe@ → fe@ (${stamp})`;

try {
  console.log(`── 1) 1차 예약: ${TO} → ${TO} · ${t(due)} · 답 없으면 1일 뒤 재발송`);
  const res = await fetch(`${B}/api/mail/campaign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `admin_session=${token}` },
    body: JSON.stringify({
      leadIds: [LID], templateId: String(intro._id), mailAccountId: String(account._id),
      subject: SUBJ, body: `1차 메일입니다 (${stamp}). 이 메일에 답하지 않으면 2차 재발송이 이 메일의 답장으로 옵니다.`,
      startAt: due.toISOString(), followUp: true, followUpDays: 1,
    }),
  });
  const j: any = await res.json().catch(() => ({}));
  ok(j.success && j.scheduled === 1, `1차 예약 (${j.error || 'ok'})`);
  const s1: any = await S.findOne({ leadId: LID });
  if (!s1) throw new Error('1차 예약이 만들어지지 않았습니다');
  const d1 = await waitDone(s1._id, '1차');
  if (d1?.status !== 'sent') throw new Error('1차가 나가지 않아 2차 확인을 할 수 없습니다');
  let lead: any = await L.findOne({ leadId: LID });
  const h1 = (lead.emailHistory || []).find((h: any) => h.status === 'sent');
  const mid1 = String(h1?.messageId || '');
  ok(lead.stage === 'contacted' && mid1 && !/^dryrun/.test(mid1), `1차 실제 발송 · 업체 [발송 완료] (${mid1})`);

  console.log('\n── 2) 하루가 지난 것처럼 — 이 검사용 업체의 발송 시각만 3일 앞으로');
  const past = new Date(Date.now() - 3 * 86_400_000);
  await S.updateOne({ _id: s1._id }, { $set: { sentAt: past } });
  await L.updateOne({ leadId: LID }, { $set: { lastEmailSentAt: past.toISOString(), 'emailHistory.$[].sentAt': past.toISOString() } });

  console.log('\n── 3) 재발송 예약 만들기 (매일 오전 7시 30분 작업을 지금 한 번)');
  const f = await createDueFollowUps();
  const s2: any = await S.findOne({ leadId: LID, status: 'pending' });
  ok(f.created === 1 && s2, `재발송 예약 ${f.created}건 (확인한 곳 ${f.checked})`);
  if (!s2) throw new Error('재발송 예약이 만들어지지 않았습니다');
  ok(String(s2.templateId) === String(follow._id) && s2.attemptNo === 2 && String(s2.batchId).startsWith('followup-'),
    `'${follow.name}' 양식 · 2번째 메일 · ${s2.batchId}`);
  console.log(`     예약 시각 ${t(s2.scheduledFor)} (바로) — 이제 자동 처리를 기다립니다. 누르지 않습니다`);

  console.log('\n── 4) 2차 재발송 — 자동 처리가 보내는지');
  const d2 = await waitDone(s2._id, '2차');
  if (d2?.status !== 'sent') throw new Error('2차가 나가지 않았습니다');
  lead = await L.findOne({ leadId: LID });
  const h2 = (lead.emailHistory || []).filter((h: any) => h.status === 'sent').pop();
  const mid2 = String(h2?.messageId || '');
  ok(h2?.subject === `Re: ${SUBJ}`, `2차 제목이 1차의 답장 ("${h2?.subject}")`);
  ok(String(h2?.body || '') && !String(h2?.body || '').includes('1차 메일입니다'), '2차 본문은 팔로우업 양식');

  console.log(`\n── 5) ${TO} 받은편지함에서 1차·2차 찾기`);
  const raw1 = await findInbox(mid1);
  ok(Boolean(raw1), raw1 ? '1차 도착 ✉' : '1차를 받은편지함에서 찾지 못함');
  const raw2 = await findInbox(mid2);
  ok(Boolean(raw2), raw2 ? '2차 도착 ✉' : '2차를 받은편지함에서 찾지 못함');
  if (raw2) {
    const irt = raw2.match(/^in-reply-to:\s*(.+)$/im)?.[1]?.trim() || '';
    ok(irt.toLowerCase() === mid1.toLowerCase(), `2차의 In-Reply-To = 1차 메일 (${irt || '없음'}) — 받는 쪽에서 한 대화로 묶입니다`);
  }
  const ext = runs.filter((r) => r.source === 'external');
  console.log(`\n     기다리는 동안 자동 처리 실행: ${runs.map((r) => `${t(r.at)} ${SRC[r.source] || r.source}`).join(' · ') || '없음'}`);
  ok(ext.length > 0, ext.length ? `GitHub 깨우미 실행 확인 (${ext.length}번)` : 'GitHub 깨우미 실행 기록 없음');
} catch (e: any) {
  fail++;
  console.log(`  X   중단: ${e?.message || e}`);
} finally {
  const ds = await S.deleteMany({ leadId: LID });
  const dl = await L.deleteOne({ leadId: LID });
  console.log(`\n검사용 업체·예약 치움 (업체 ${dl.deletedCount} · 예약 ${ds.deletedCount}) — 메일함의 테스트 메일은 남습니다`);
  await mongoose.disconnect();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 1차 → 2차 재발송까지 손대지 않고 나가고, 받은편지함에서 한 대화로 묶였습니다');
process.exit(fail ? 1 : 0);
