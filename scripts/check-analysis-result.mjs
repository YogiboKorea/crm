/**
 * 세션에서 만든 분석 결과를 넣기 전에 확인한다.
 *   ① 묶음(batch)과 결과(result)의 id 가 빠짐·중복 없이 같은가
 *   ② 사람이 손으로 분류한 메일(classifiedBy: manual)을 덮지 않는가
 *      — import 스크립트는 분류를 무조건 덮어쓴다. analyze 라우트는 manual 을 지키므로
 *        같은 규칙을 여기서 맞춘다.
 *   ③ 외국어 메일인데 번역이 빠진 것은 없는가 (빠지면 화면에 유료 [AI 번역] 버튼이 뜬다)
 * 사용: node scripts/check-analysis-result.mjs <batch.json> <result.json>
 */
import fs from 'fs';
import mongoose from 'mongoose';
const [batchPath, resultPath] = process.argv.slice(2);
const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
let bad = 0;
const b = new Set(batch.map((x) => x.id)), r = result.map((x) => x.id);
const missing = [...b].filter((id) => !r.includes(id));
const extra = r.filter((id) => !b.has(id));
const dup = r.filter((id, i) => r.indexOf(id) !== i);
if (missing.length) { bad++; console.log('빠진 id', missing); }
if (extra.length) { bad++; console.log('묶음에 없는 id', extra); }
if (dup.length) { bad++; console.log('중복 id', dup); }
const noTr = result.filter((x) => x.lang && x.lang !== 'ko' && !String(x.translationBody || '').trim());
if (noTr.length) { bad++; console.log('외국어인데 번역 없음', noTr.map((x) => x.id)); }

const env = fs.readFileSync('.env.local', 'utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '');
await mongoose.connect(uri);
const manual = await mongoose.connection.db.collection('inboundmails')
  .find({ _id: { $in: r.map((id) => new mongoose.Types.ObjectId(id)) }, classifiedBy: 'manual' })
  .project({ subject: 1, classification: 1 }).toArray();
await mongoose.disconnect();
if (manual.length) {
  bad++;
  console.log('사람이 직접 분류한 메일 — 분류를 빼고 넣어야 함:');
  for (const m of manual) console.log(`  ${m._id} [${m.classification}] ${String(m.subject).slice(0, 50)}`);
}
console.log(`묶음 ${b.size} · 결과 ${r.length} · ${bad ? '✗ 문제 있음' : '✅ 이상 없음'}`);
process.exit(bad ? 1 : 0);
