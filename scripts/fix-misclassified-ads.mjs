/**
 * 실제 거래처와 주고받은 메일이 '광고'로 잘못 찍힌 것을 찾아 되돌린다.
 *
 * 왜 지금 하나:
 * 수집 규칙을 바꿔서, 프로그램이 추측한 폴더에 있는 광고는 광고 폴더로 옮긴다.
 * 그러면 **잘못 광고로 찍힌 실제 상담 메일**도 같이 빨려 들어간다.
 * 규칙을 켜기 전에 오분류를 먼저 걷어내야 한다.
 *
 * 무엇을 오분류로 보나:
 * 같은 발신자에게서 **광고가 아닌 메일도 온 적이 있다면**, 그 사람은 광고
 * 발송자가 아니라 거래 상대다. 그런 사람이 보낸 메일이 광고로 찍혔으면
 * 규칙/AI 가 틀린 쪽일 가능성이 높다.
 * (읽음확인·부재중 같은 system 은 제외한다 — 그건 실제로 자동발송이 맞다)
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path:'.env.local', quiet:true });
const APPLY = process.argv.includes('--apply');
await mongoose.connect(process.env.MONGODB_URI);
const M = mongoose.connection.collection('inboundmails');

const SUSPECT = ['ad','newsletter'];   // system(읽음확인·부재중)은 건드리지 않는다
const cand = await M.find({ trashedAt:null, direction:'in', classification:{ $in:SUSPECT } })
  .project({subject:1,from:1,group:1,groupBy:1,classification:1,classifiedBy:1}).toArray();

const hits = [];
for (const r of cand) {
  const addr = r.from?.address;
  if (!addr) continue;
  // 같은 사람에게서 온 '광고가 아닌' 메일이 있는가
  const real = await M.countDocuments({
    trashedAt:null, direction:'in', 'from.address': addr,
    classification: { $nin: ['ad','newsletter','system'] },
  });
  if (real > 0) hits.push({ ...r, realFromSameSender: real });
}

console.log(`광고/뉴스레터로 찍힌 메일 ${cand.length}통 중, 같은 사람과 실제 대화도 있는 것: ${hits.length}통\n`);
for (const h of hits) {
  console.log(`  [${h.classification}/${h.classifiedBy||'-'}] ${String(h.from.address).padEnd(32)} 실제대화 ${h.realFromSameSender}통`);
  console.log(`      폴더: ${h.group||'미분류'} (${h.groupBy||'-'})`);
  console.log(`      제목: ${String(h.subject||'').slice(0,66)}\n`);
}

if (!hits.length) { console.log('되돌릴 것 없음'); await mongoose.disconnect(); process.exit(0); }
if (!APPLY) { console.log('(미리보기입니다. 되돌리려면 --apply)'); await mongoose.disconnect(); process.exit(0); }

const r = await M.updateMany(
  { _id: { $in: hits.map(h=>h._id) } },
  { $set: { classification: 'other', classifiedBy: 'fix-misclassified' } },
);
console.log(`\n되돌림 ${r.modifiedCount}통 → classification: 'other' (광고 폴더로 쓸려가지 않는다)`);
await mongoose.disconnect();
