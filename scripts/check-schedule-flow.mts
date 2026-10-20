/**
 * **예약·묶음 발송 고친 것 점검** (2026-10-20, 대표님 미팅 전 — 예약 발송 1~6번).
 *
 *   1) 묶음 발송 예약에 화면에서 고친 제목·본문이 실리는가 · 받는 주소가 깨끗한가 · 같은 곳 두 번 예약 막힘
 *   2) 예약 목록 API — 몇 번째 메일 · 고친 문구 · 마지막 자동 처리
 *   3) [검증 실패]로 옮기면 예약이 취소되는가
 *   4) [↩ 발송 취소] 로 빼면 예약이 취소되는가
 *   5) 보내는 순간 확인 — 예약 뒤에 단계가 바뀌었거나 답장이 왔으면 보내지 않는가
 *   6) 동시에 두 번 눌러도 한 번만 처리되는가 (발송 가드에 걸리는 예약으로 — 메일은 안 나간다)
 *   7) 실제 발송 — 고친 제목·본문 그대로 나가는가                         ✉ fe@yogico.kr 한 통
 *   8) 자동 재발송 — '팔로우업' 양식으로, 앞 메일의 답장(Re: · In-Reply-To)으로 나가는가  ✉ fe@yogico.kr 한 통
 *   9) 답장이 오면 — 자동 재발송은 전부, 나머지는 답장 전에 잡은 것만 거두는가
 *  10) 예약 처리기 — 끊긴 'sending' 정리 · 한 번에 하나만 · 개발 PC 화면 깨우기는 무시
 *
 * ⚠ 실제 메일이 **두 통** 나간다. 받는 사람은 **우리 주소(fe@yogico.kr)** 뿐이다 — 바이어에게는 절대 가지 않는다.
 *    검사용 가짜 업체를 만들어 거기에 보내고, 끝나면 그 업체와 예약을 흔적 없이 지운다.
 *    다른 곳으로 갈 대기 예약이 하나라도 있으면 시작하지 않는다 (예약 처리기를 돌리면 그것까지 나간다).
 *
 * 사용: CRM_BASE=http://localhost:3000 npx tsx scripts/check-schedule-flow.mts
 */
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = process.env.CRM_BASE || 'http://localhost:3000';
const USER = 'yogico';
const TO = 'fe@yogico.kr';
let fail = 0;
const ok = (c: any, m: string) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { createDueFollowUps } = await import('../src/lib/mail/follow-up.ts');
const { cancelPendingSchedules } = await import('../src/lib/schedule-cancel.ts');
const { acquireRunLock, releaseRunLock } = await import('../src/lib/run-lock.ts');
const { MailAccount } = await import('../src/models/MailAccount.ts');
const { toImapConfig } = await import('../src/lib/mail/accounts.ts');
const { withOpenAccount, findSentPath, fetchSinceBatch } = await import('../src/lib/mail/imap.ts');

await mongoose.connect(process.env.MONGODB_URI!);
const db = mongoose.connection.db!;
const L = db.collection('leads');
const S = db.collection('emailschedules');
const T = db.collection('emailtemplates');

// ── 안전장치: 다른 주소로 갈 대기 예약이 있으면 멈춘다 ──
const others = await S.countDocuments({ status: { $in: ['pending', 'sending'] }, to: { $not: /^fe@yogico\.kr$/i } });
if (others) {
  console.error(`다른 주소로 갈 대기 예약이 ${others}건 있어 시작하지 않습니다 (예약 처리기를 돌리면 그것까지 나갑니다).`);
  process.exit(1);
}

const account: any = await MailAccount.findOne({ smtpUser: TO, owner: 'admin', isActive: { $ne: false } }).lean();
if (!account) { console.error(`${TO} 보내는 계정이 없습니다`); process.exit(1); }
const ACC = String(account._id);
const intro: any = await T.findOne({ purpose: 'intro', isActive: { $ne: false } });
const follow: any = await T.findOne({ purpose: 'followup', isActive: { $ne: false } });
if (!intro || !follow) { console.error('첫 소개·팔로우업 양식이 둘 다 있어야 합니다'); process.exit(1); }

const token = await new SignJWT({ user: USER, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET!));
const api = async (path: string, init: any = {}) => {
  const r = await fetch(B + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Cookie: `admin_session=${token}`, ...(init.headers || {}) },
    body: init.body && typeof init.body !== 'string' ? JSON.stringify(init.body) : init.body,
  });
  return { status: r.status, j: (await r.json().catch(() => ({}))) as any };
};

const stamp = Date.now();
const LID = `zz-sched-${stamp}`;
const COMPANY = `ZZ 예약 점검 ${stamp}`;
await L.insertOne({
  leadId: LID, Company: COMPANY, Country: 'Test',
  Email: `Sales Team <${TO}>`,     // 업체 칸에 이름과 함께 적힌 주소 — 예약에는 주소만 들어가야 한다
  WebsiteContact: '', stage: 'queued', stageChangedAt: new Date().toISOString(),
  readyForOutreach: true, addedManually: true, emailHistory: [], createdAt: new Date(), updatedAt: new Date(),
});
const leadDoc: any = await L.findOne({ leadId: LID });
const future = () => new Date(Date.now() + 86_400_000).toISOString();   // 내일 — 자동 처리가 먼저 집지 않게
const campaign = (extra: any = {}) => api('/api/mail/campaign', {
  method: 'POST',
  body: { leadIds: [LID], templateId: String(intro._id), mailAccountId: ACC, startAt: future(), followUp: false, ...extra },
});
const pendingOf = () => S.findOne({ leadId: LID, status: 'pending' });
const sendNow = (id: any) => api(`/api/mail/schedule/${id}`, { method: 'POST', body: { action: 'send-now' } });
console.log(`검사용 업체 ${LID} — 실제 메일은 ${TO} 로만 나갑니다\n`);

const SUBJ = `[예약 점검 ${stamp}] {{Company}} — 고친 제목`;
const BODY = `Hello {{Company}},\n\n예약 점검용으로 이 화면에서 고친 본문입니다 (${stamp}). 답장하지 않으셔도 됩니다.`;

try {
  // ── 1) ──
  console.log('── 1) 묶음 발송 예약 — 고친 제목·본문 · 받는 주소 · 중복 예약');
  let r = await campaign({ subject: SUBJ, body: BODY });
  ok(r.j.success && r.j.scheduled === 1, `예약 1건 (${r.j.error || 'ok'})`);
  ok(r.j.edited === true, '응답에 "고친 문구" 표시');
  let s: any = await pendingOf();
  ok(s?.to === TO, `받는 주소가 주소만 남음 ("Sales Team <${TO}>" → "${s?.to}")`);
  if (s?.to !== TO) throw new Error('받는 주소가 깨끗하지 않아 여기서 멈춥니다 (실제 발송 전)');
  ok(s.subjectOverride === SUBJ && s.bodyOverride === BODY, '고친 제목·본문이 예약에 실림');
  ok(String(s.batchId).startsWith('camp-'), `묶음 발송 표시 (${s.batchId})`);
  r = await campaign({ subject: SUBJ, body: BODY });
  ok(!r.j.success && (r.j.skipped || []).some((x: any) => /이미 예약/.test(x.reason)), '같은 곳 두 번 예약 → "이미 예약됨" 으로 막힘');
  r = await api('/api/mail/campaign', { method: 'POST', body: { leadIds: [LID], templateId: String(intro._id), subject: '   ', body: BODY } });
  ok(!r.j.success && /제목이 비어/.test(r.j.error || ''), `빈 제목 → 막힘 (${r.j.error})`);

  // ── 2) ──
  console.log('\n── 2) 예약 목록 API');
  r = await api('/api/mail/schedule?status=all&limit=50');
  const it = (r.j.items || []).find((i: any) => i._id === String(s._id));
  ok(it && it.attemptNo === 1 && it.edited === true, `몇 번째 ${it?.attemptNo} · 고친 문구 ${it?.edited}`);
  ok('lastRun' in r.j, `마지막 자동 처리 정보 (${r.j.lastRun ? new Date(r.j.lastRun.at).toLocaleString('ko-KR') + ' ' + r.j.lastRun.source : '기록 없음'})`);

  // ── 3) ──
  console.log('\n── 3) [검증 실패]로 옮기면 예약 취소');
  r = await api(`/api/leads/${leadDoc._id}/stage`, { method: 'POST', body: { stage: 'failed' } });
  ok(r.j.success && r.j.canceledSchedules === 1, `옮김 · 거둔 예약 ${r.j.canceledSchedules}건`);
  s = await S.findOne({ _id: s._id });
  ok(s.status === 'canceled' && /검증 실패/.test(s.canceledReason), `예약 → ${s.status} ("${s.canceledReason}")`);
  r = await api(`/api/leads/${leadDoc._id}/stage`, { method: 'POST', body: { stage: 'queued' } });
  ok(r.j.success && !r.j.canceledSchedules, '[보낼 메일]로 되돌림 (거둘 것 없음)');

  // ── 4) ──
  console.log('\n── 4) [↩ 발송 취소] 로 빼면 예약 취소');
  r = await campaign({ subject: intro.subject, body: intro.body });
  ok(r.j.success && r.j.edited === false, '양식 그대로면 "고친 문구" 아님');
  s = await pendingOf();
  ok(s && !s.subjectOverride && !s.bodyOverride, '예약에 고친 문구 없음 (양식 원문으로 나감)');
  r = await api('/api/leads/queue', { method: 'POST', body: { leadIds: [LID], undo: true } });
  ok(r.j.success && r.j.moved === 1 && r.j.canceledSchedules === 1, `뺌 · 거둔 예약 ${r.j.canceledSchedules}건`);
  s = await S.findOne({ _id: s._id });
  ok(s.status === 'canceled' && /발송 취소/.test(s.canceledReason), `예약 → ${s.status} ("${s.canceledReason}")`);
  r = await api('/api/leads/queue', { method: 'POST', body: { leadIds: [LID] } });
  ok(r.j.success && r.j.moved === 1, '다시 [보낼 메일]로');

  // ── 5) ──
  console.log('\n── 5) 보내는 순간 확인 (화면을 거치지 않고 바뀐 경우)');
  await campaign({});
  s = await pendingOf();
  await L.updateOne({ leadId: LID }, { $set: { stage: 'verified' } });       // 화면 밖에서 단계가 바뀜
  r = await sendNow(s._id);
  ok(r.j.result?.canceled === true && /검증 완료/.test(r.j.result?.error || ''), `안 보냄 — ${r.j.result?.error}`);
  s = await S.findOne({ _id: s._id });
  ok(s.status === 'canceled', `예약 → ${s.status}`);
  await L.updateOne({ leadId: LID }, { $set: { stage: 'queued' } });
  await campaign({});
  s = await pendingOf();
  await w(50);
  await L.updateOne({ leadId: LID }, { $set: { lastInboundAt: new Date().toISOString() } });   // 예약 뒤에 답장이 옴
  r = await sendNow(s._id);
  ok(r.j.result?.canceled === true && /답장/.test(r.j.result?.error || ''), `안 보냄 — ${r.j.result?.error}`);
  await L.updateOne({ leadId: LID }, { $set: { lastInboundAt: '' } });

  // ── 6) ──
  console.log('\n── 6) 동시에 두 번 [지금 보내기] (48시간 가드에 걸리는 예약 — 메일은 안 나간다)');
  await L.updateOne({ leadId: LID }, { $set: { lastEmailSentAt: new Date().toISOString() } });
  await campaign({});
  s = await pendingOf();
  const [a, b] = await Promise.all([sendNow(s._id), sendNow(s._id)]);
  const handled = [a, b].filter((x) => x.j.result && !x.j.result.skipped).length;
  ok(handled === 1, `처리 ${handled}번 (나머지: ${[a, b].map((x) => x.j.result?.skipped ? 'skipped' : x.j.error || x.j.result?.error).join(' / ')})`);
  s = await S.findOne({ _id: s._id });
  ok(s.status === 'failed' && s.attempts === 1 && /가드/.test(s.lastError), `예약 → ${s.status} · 시도 ${s.attempts}번 ("${s.lastError}")`);
  await L.updateOne({ leadId: LID }, { $set: { lastEmailSentAt: null } });

  // ── 7) ──
  console.log(`\n── 7) 실제 발송 — 고친 제목·본문 그대로 (✉ ${TO})`);
  r = await campaign({ subject: SUBJ, body: BODY, followUp: true, followUpDays: 1 });
  s = await pendingOf();
  r = await sendNow(s._id);
  ok(r.j.result?.ok === true, `보냄 (${r.j.result?.error || r.j.result?.messageId})`);
  let lead: any = await L.findOne({ leadId: LID });
  const h1 = (lead.emailHistory || []).filter((h: any) => h.status === 'sent').pop();
  const wantSubj = SUBJ.replace('{{Company}}', COMPANY);
  ok(h1?.subject === wantSubj, `나간 제목 = 고친 제목 ("${h1?.subject}")`);
  ok(String(h1?.body || '').includes('이 화면에서 고친 본문') && String(h1?.body || '').includes(`Hello ${COMPANY}`), '나간 본문 = 고친 본문 (회사명 채워짐)');
  ok(lead.stage === 'contacted', `업체 → [발송 완료] (${lead.stage})`);
  const firstMid = String(h1?.messageId || '');

  // ── 8) ──
  console.log(`\n── 8) 자동 재발송 — 팔로우업 양식 · 앞 메일의 답장으로 (✉ ${TO})`);
  // 기다리는 날짜·48시간을 지난 것으로 당겨 둔다 (검사용 업체만)
  const past = new Date(Date.now() - 3 * 86_400_000);
  await S.updateOne({ _id: s._id }, { $set: { sentAt: past } });
  await L.updateOne({ leadId: LID }, { $set: { lastEmailSentAt: past.toISOString(), 'emailHistory.$[].sentAt': past.toISOString() } });
  const f = await createDueFollowUps();
  const mine = await S.findOne({ leadId: LID, status: 'pending' });
  ok(f.created === 1 && mine, `재발송 예약 ${f.created}건 생성 (전체 확인 ${f.checked}곳)`);
  if (f.created !== 1) console.log('   ', JSON.stringify(f.skipped.filter((x: any) => x.leadId === LID)));
  ok(mine && String(mine.templateId) === String(follow._id), `팔로우업 양식 사용 ("${follow.name}")`);
  ok(mine && String(mine.batchId).startsWith('followup-') && mine.attemptNo === 2, `재발송 표시 (${mine?.batchId} · ${mine?.attemptNo}번째)`);
  // 미래 시각으로 — 다른 자동 처리가 먼저 집지 않게
  await S.updateOne({ _id: mine!._id }, { $set: { scheduledFor: new Date(Date.now() + 86_400_000) } });
  r = await sendNow(mine!._id);
  ok(r.j.result?.ok === true, `보냄 (${r.j.result?.error || r.j.result?.messageId})`);
  lead = await L.findOne({ leadId: LID });
  const h2 = (lead.emailHistory || []).filter((h: any) => h.status === 'sent').pop();
  ok(h2?.subject === `Re: ${wantSubj}`, `제목이 앞 메일의 답장 ("${h2?.subject}")`);
  ok(String(h2?.body || '').length > 0 && !String(h2?.body || '').includes('이 화면에서 고친 본문'), '본문은 첫 메일이 아니라 팔로우업 양식');
  const secondMid = String(h2?.messageId || '');

  if (secondMid && firstMid) {
    // 보낸메일함 사본에서 In-Reply-To 를 확인한다 (사본은 실제로 나간 원문 그대로다)
    let raw = '';
    for (let round = 1; round <= 6 && !raw; round++) {
      await w(round === 1 ? 2500 : 5000);
      await withOpenAccount(toImapConfig(account, 'INBOX'), async (scoped: any) => {
        const sentPath = await findSentPath(scoped.__client);
        if (!sentPath) return;
        let afterUid = 0;
        for (let i = 0; i < 20 && !raw; i++) {
          const bt = await fetchSinceBatch(scoped, { folder: sentPath, since: new Date(Date.now() - 2 * 3600_000), afterUid, limit: 50 });
          if (!bt.messages.length) break;
          for (const m of bt.messages) {
            const src = String(m.source);
            const mid = src.match(/^message-id:\s*(<[^>]+>)/im)?.[1] || '';
            if (mid.trim().toLowerCase() === secondMid.toLowerCase()) { raw = src; break; }
          }
          afterUid = bt.lastUid;
          if (!bt.remaining) break;
        }
      });
    }
    ok(Boolean(raw), raw ? '보낸메일함에서 재발송 사본 찾음' : '보낸메일함에서 사본을 찾지 못함');
    if (raw) {
      const irt = raw.match(/^in-reply-to:\s*(.+)$/im)?.[1]?.trim() || '';
      const refs = raw.match(/^references:\s*(.+)$/im)?.[1]?.trim() || '';
      ok(irt.toLowerCase() === firstMid.toLowerCase(), `In-Reply-To = 첫 메일 (${irt || '없음'})`);
      ok(refs.toLowerCase().includes(firstMid.toLowerCase()), 'References 에 첫 메일');
    }
  }

  // ── 9) ──
  console.log('\n── 9) 답장이 오면 — 거두는 범위 (메일 수집이 부르는 함수)');
  const base = { leadId: LID, templateId: String(intro._id), mailAccountId: ACC, to: TO, scheduledFor: new Date(Date.now() + 86_400_000), status: 'pending', attempts: 0, createdBy: USER, updatedAt: new Date() };
  await S.insertMany([
    { ...base, batchId: `followup-test`, attemptNo: 3, createdAt: new Date(Date.now() - 3600_000) },
    { ...base, batchId: `sched-test`, attemptNo: 1, createdAt: new Date() },
  ]);
  const replyAt = new Date(Date.now() - 30 * 60_000);    // 30분 전에 온 답장 (예약 둘 사이)
  const c1 = await cancelPendingSchedules(LID, '점검: 답장 → 재발송', { followupOnly: true });
  const c2 = await cancelPendingSchedules(LID, '점검: 답장 전 예약', { createdBefore: replyAt });
  const left = await S.find({ leadId: LID, status: 'pending' }).toArray();
  ok(c1 === 1, `자동 재발송은 거둠 (${c1}건)`);
  ok(c2 === 0 && left.length === 1 && left[0].batchId === 'sched-test', '답장을 본 뒤 사람이 잡은 예약은 남김');
  await cancelPendingSchedules(LID, '점검 끝');

  // ── 10) ──
  console.log('\n── 10) 예약 처리기');
  await S.insertOne({ ...base, status: 'sending', claimedAt: new Date(Date.now() - 15 * 60_000), scheduledFor: new Date(Date.now() - 20 * 60_000), batchId: 'camp-test', attemptNo: 1, createdAt: new Date() });
  r = await api('/api/cron/process-schedules?source=button');
  ok(r.j.success && r.j.source === 'button', `[지금 내보내기] 실행 (처리 ${r.j.processed ?? '-'}건 · ${r.j.skipped || 'ok'})`);
  const stuck: any = await S.findOne({ leadId: LID, batchId: 'camp-test' });
  ok(stuck?.status === 'failed' && /끊겼습니다/.test(stuck.lastError), `끊긴 'sending' → ${stuck?.status} ("${String(stuck?.lastError).slice(0, 30)}…")`);
  r = await api('/api/mail/schedule?status=all&limit=5');
  ok(r.j.lastRun && r.j.lastRun.source === 'button' && !r.j.lastRun.running, `마지막 자동 처리 = 방금 [지금 내보내기] (${r.j.lastRun?.source})`);
  const held = await acquireRunLock('process-schedules', 60_000, 'check-script');
  r = await api('/api/cron/process-schedules?source=button');
  ok(held && r.j.skipped === 'busy', `다른 실행이 돌고 있으면 겹쳐 돌지 않음 (${r.j.skipped})`);
  await releaseRunLock('process-schedules', held);
  r = await api('/api/cron/process-schedules?source=browser');
  ok(r.j.skipped === 'dev-server', `개발 PC 화면 깨우기는 무시 (${r.j.skipped})`);
} catch (e: any) {
  fail++;
  console.log(`  X   중단: ${e?.message || e}`);
} finally {
  const ds = await S.deleteMany({ leadId: LID });
  const dl = await L.deleteOne({ leadId: LID });
  console.log(`\n검사용 업체·예약 치움 (업체 ${dl.deletedCount} · 예약 ${ds.deletedCount}) · 남은 흔적 ${await L.countDocuments({ leadId: LID }) + await S.countDocuments({ leadId: LID })}건`);
  await mongoose.disconnect();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 예약·묶음 발송 1~6번 모두 확인');
process.exit(fail ? 1 : 0);
