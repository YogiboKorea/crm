/**
 * [오늘 온 메일]이 실제로 무엇을 세고 무엇을 보여주는지 DB 로 확인한다.
 *
 * 두 가지를 본다.
 *  1) 서울 자정 경계가 맞는가 — 서버는 UTC 로 돌기 때문에 그냥 자정을 자르면
 *     오전에 온 메일이 통째로 빠지거나 내일 것이 섞인다.
 *  2) 상단에 적는 숫자와 목록 줄 수가 같은가 — 전에 "검증실패 841 vs 51" 처럼
 *     배지와 목록이 어긋나던 일이 있었다. 같은 조건으로 두 번 세어 맞춰본다.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local' });

const KST = 9 * 3600000;
const seoulDayStart = (at = new Date()) => {
  const s = new Date(at.getTime() + KST);
  s.setUTCHours(0, 0, 0, 0);
  return new Date(s.getTime() - KST);
};
const seoul = (d) => new Date(new Date(d).getTime() + KST).toISOString().slice(0, 16).replace('T', ' ');

await mongoose.connect(process.env.MONGODB_URI);
const Mail = mongoose.connection.collection('inboundmails');

const NOISE = ['ad', 'system', 'newsletter'];
const start = seoulDayStart();

console.log(`지금       (서울) ${seoul(new Date())}`);
console.log(`오늘 시작  (서울) ${seoul(start)}   = UTC ${start.toISOString()}\n`);

// counts API 와 같은 조건
const base = { trashedAt: null, direction: 'in', date: { $gte: start } };
const [today, noise, needsReply] = await Promise.all([
  Mail.countDocuments(base),
  Mail.countDocuments({ ...base, classification: { $in: NOISE } }),
  Mail.countDocuments({
    ...base,
    classification: { $nin: NOISE },
    'analysis.needsReply': true,
    status: { $in: ['new', 'reviewing'] },
  }),
]);

// inbox API(today=1, flat=1) 와 같은 조건 — 목록에 실제로 뜨는 줄
const listRows = await Mail.find(base)
  .sort({ date: -1 }).limit(200)
  .project({ subject: 1, date: 1, group: 1, classification: 1, accountId: 1, 'from.address': 1 })
  .toArray();

console.log(`상단 배지  : 오늘 ${today}통  (광고·자동 ${noise} · 회신 필요 ${needsReply})`);
console.log(`목록 줄 수 : ${listRows.length}줄`);
console.log(today === listRows.length
  ? '  OK  배지와 목록이 같다\n'
  : `  X   어긋남 — 배지 ${today} vs 목록 ${listRows.length}\n`);

if (!listRows.length) {
  // 오늘 0통이면 경계가 맞는지 어제 것으로 확인한다
  const recent = await Mail.find({ trashedAt: null, direction: 'in' })
    .sort({ date: -1 }).limit(5)
    .project({ subject: 1, date: 1, group: 1 }).toArray();
  console.log('오늘 온 메일이 없습니다. 가장 최근 수신 5통:');
  for (const m of recent) {
    console.log(`   ${seoul(m.date)}  ${(m.group || '미분류').padEnd(14)} ${String(m.subject || '').slice(0, 48)}`);
  }
} else {
  console.log('오늘 목록 — 제목 앞에 붙을 폴더 태그:');
  for (const m of listRows.slice(0, 20)) {
    console.log(`   ${seoul(m.date)}  ${(m.group ? '📁 ' + m.group : '❔ 미분류').padEnd(18)} ${String(m.subject || '').slice(0, 46)}`);
  }
  const tagged = listRows.filter((m) => m.group).length;
  console.log(`\n   폴더 있음 ${tagged} · 미분류 ${listRows.length - tagged} (둘 다 태그가 붙는다)`);
}

// 경계 바로 앞뒤에 메일이 있으면 잘못 잘리지 않았는지 본다
const justBefore = await Mail.countDocuments({
  trashedAt: null, direction: 'in',
  date: { $gte: new Date(start.getTime() - 6 * 3600000), $lt: start },
});
console.log(`\n어제 저녁(서울 18시~자정) 수신 ${justBefore}통 — 이건 오늘에 포함되면 안 된다`);

await mongoose.disconnect();
