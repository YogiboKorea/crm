/**
 * 직접 검토 대기열이 화면에 몇 곳으로 뜨는지 DB 에서 직접 확인한다.
 *
 * 예전 기준(readyForOutreach: {$ne:true})으로는 418곳 중 9곳만 올라왔다.
 * 버튼은 "400곳 검토"인데 눌러 보면 9곳에서 끝나던 상태였다.
 * 두 기준의 결과를 나란히 찍어 실제로 달라졌는지 눈으로 본다.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI 없음'); process.exit(1); }
await mongoose.connect(uri);
const Lead = mongoose.connection.collection('leads');

const REAL_EMAIL = { Email: { $regex: /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/ } };
const NOW = { stage: 'verified', deleted: { $ne: true }, ...REAL_EMAIL };
const OLD = { ...NOW, readyForOutreach: { $ne: true } };

const [now, old, verifiedAll, noEmail, queued, failed] = await Promise.all([
  Lead.countDocuments(NOW),
  Lead.countDocuments(OLD),
  Lead.countDocuments({ stage: 'verified', deleted: { $ne: true } }),
  Lead.countDocuments({ stage: 'verified', deleted: { $ne: true }, ...{ Email: { $not: REAL_EMAIL.Email } } }),
  Lead.countDocuments({ stage: 'queued', deleted: { $ne: true } }),
  Lead.countDocuments({ stage: 'failed', deleted: { $ne: true } }),
]);

console.log('검증 완료 전체        :', verifiedAll);
console.log('  └ 보낼 주소 없음    :', noEmail, '(검토해도 메일을 못 보내므로 뺀다)');
console.log('');
console.log('직접 검토 대기 — 지금  :', now);
console.log('직접 검토 대기 — 예전  :', old, '(readyForOutreach 기준)');
console.log('');
console.log('메일 보낼곳 (queued)   :', queued);
console.log('검증 실패   (failed)   :', failed);

// 화면 첫 장에 무엇이 뜨는지
const first = await Lead.find(NOW)
  .sort({ recoScore: -1, Country: 1, Company: 1 })
  .limit(5)
  .project({ Company: 1, Country: 1, Email: 1, recoScore: 1, Category: 1 })
  .toArray();
console.log('\n첫 화면에 뜨는 순서:');
for (const l of first) {
  console.log('  ', String(l.recoScore ?? '-').padStart(3), (l.Country || '?').padEnd(16), l.Company, '|', l.Email);
}

await mongoose.disconnect();
