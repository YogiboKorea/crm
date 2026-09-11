/**
 * 발송 차단이 실제로 풀렸는지, 그리고 무엇이 남아 있는지 확인한다.
 *
 * 스위치가 두 개라 하나만 풀고 풀었다고 착각하기 쉽다.
 *   1) OUTBOUND_LOCKED — 누구에게 보낼 수 있는가 (수신자 제한)
 *   2) MAIL_DRY_RUN    — SMTP 를 실제로 부르는가 (안 부르면 로그만 남는다)
 * 둘 다 열려야 진짜로 나간다. 여기서 둘을 같이 찍어 본다.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const line = (k, v, note) => console.log(`  ${k.padEnd(18)} ${String(v).padEnd(10)} ${note || ''}`);

const locked = process.env.OUTBOUND_LOCKED === '1';
const dryRun = process.env.MAIL_DRY_RUN === '1';
const cap = Number(process.env.DAILY_SEND_CAP) || 20;
const interval = Number(process.env.SEND_INTERVAL_MS) || 8000;

console.log('── 발송 스위치 ──');
line('OUTBOUND_LOCKED', locked ? '잠김' : '열림',
  locked ? '테스트 주소 외 전부 차단' : '모든 수신자에게 발송 가능');
line('MAIL_DRY_RUN', dryRun ? '켜짐' : '꺼짐',
  dryRun ? 'SMTP 안 부름 — 로그만 남고 실제로 안 나감' : 'SMTP 실제 호출 — 진짜로 나감');

const reallySends = !locked && !dryRun;
console.log(`\n  ➜ 지금 상태: ${reallySends ? '★ 실제로 메일이 나갑니다' : '아직 실제로는 나가지 않습니다'}`);
if (!reallySends) {
  if (locked) console.log('     · 환경변수 OUTBOUND_LOCKED 를 지우세요');
  if (dryRun) console.log('     · .env.local 의 MAIL_DRY_RUN 을 0 으로 하고 서버를 다시 띄우세요');
}

console.log('\n── 남아 있는 안전장치 ──');
line('하루 상한', `${cap}통`, '하루에 이보다 많이 안 나간다');
line('발송 간격', `${interval / 1000}초`, '한 통과 다음 통 사이');
line('같은 곳 최대', '3회', 'lib/send-limits.ts · 1차 + 팔로우업 2회');
line('재발송 간격', '48시간', '같은 곳에 이틀 안에 두 번 안 나간다');
line('발송 대상', 'queued 만', '사람이 [발송 리스트]로 옮긴 곳에만');

console.log('\n── 다시 잠그려면 ──');
console.log('  .env.local 에  OUTBOUND_LOCKED=1  한 줄 넣고 서버 재시작');
console.log('  (코드 수정·배포 없이 즉시 막힙니다)');

// DB 쪽 — 지금 실제로 나갈 수 있는 곳이 몇 곳인가
const mongoose = (await import('mongoose')).default;
await mongoose.connect(process.env.MONGODB_URI);
const L = mongoose.connection.collection('leads');
const S = mongoose.connection.collection('emailschedules');

const queued = await L.countDocuments({ stage: 'queued', deleted: { $ne: true } });
const verified = await L.countDocuments({ stage: 'verified', deleted: { $ne: true } });
const pending = await S.countDocuments({ status: 'pending' });

console.log('\n── 지금 나갈 수 있는 범위 ──');
line('발송 리스트', `${queued}곳`, '지금 [보낼 메일] 에 있는 곳 — 여기로만 나간다');
line('AI 검증 완료', `${verified}곳`, '아직 발송 리스트로 옮기지 않아 나가지 않는다');
line('예약 대기', `${pending}건`, '시각이 되면 나간다');

const rows = await L.find({ stage: 'queued', deleted: { $ne: true } })
  .project({ Company: 1, Email: 1 }).toArray();
console.log('\n  발송 리스트에 있는 곳:');
for (const r of rows) console.log(`    · ${String(r.Company).padEnd(26)} ${r.Email}`);

await mongoose.disconnect();
