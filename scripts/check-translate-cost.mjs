/**
 * 올린 데이터 중 한글 번역이 없는 것이 얼마나 되는지, 번역에 얼마가 드는지.
 *
 * 번역 대상은 두 칸이다.
 *   Evidence → EvidenceKo   "왜 이 회사인가" (길다)
 *   Type     → TypeKo       업종 한 줄 (짧다)
 * 화면은 한국어본이 있으면 그걸 먼저 보여주므로, 없으면 영문이 그대로 뜬다.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

await mongoose.connect(process.env.MONGODB_URI);
const L = mongoose.connection.collection('leads');
const ALIVE = { deleted: { $ne: true } };
const LEGACY = { importBatch: { $not: /^ai-search-/ }, ...ALIVE };
const HAS = (f) => ({ [f]: { $nin: [null, ''] } });
const NO = (f) => ({ $or: [{ [f]: { $exists: false } }, { [f]: '' }, { [f]: null }] });

// 화면에 실제로 뜨는 범위 — 2차 검토에 올라오는 곳
const REVIEWABLE = {
  ...LEGACY,
  stage: { $in: ['imported', 'verifying', 'archived', 'ai-searched'] },
  Email: { $regex: /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/ },
  legacyHiddenAt: { $exists: false },
  'verification.aiVerdict': { $ne: 'not-buyer' },
};

const scopes = {
  '올린 데이터 전체': LEGACY,
  '2차 검토에 뜨는 곳': REVIEWABLE,
};

for (const [name, base] of Object.entries(scopes)) {
  const total = await L.countDocuments(base);
  const needEv = await L.countDocuments({ ...base, ...HAS('Evidence'), ...NO('EvidenceKo') });
  const needTy = await L.countDocuments({ ...base, ...HAS('Type'), ...NO('TypeKo') });

  // 실제 글자 수를 재야 값이 맞는다 — 평균으로 어림하면 몇 배가 어긋난다
  const rows = await L.find({ ...base, ...HAS('Evidence'), ...NO('EvidenceKo') })
    .project({ Evidence: 1, Type: 1, TypeKo: 1 }).toArray();
  let chars = 0;
  for (const r of rows) {
    chars += String(r.Evidence || '').length;
    if (!r.TypeKo) chars += String(r.Type || '').length;
  }

  // 영문 1토큰 ≈ 4자. 번역은 입력만큼 출력이 나오고, 한국어는 토큰을 더 먹는다(≈1.5배)
  const inTok = Math.ceil(chars / 4);
  const outTok = Math.ceil(inTok * 1.5);

  // claude-haiku-4-5 기준 (입력 $1 / 출력 $5 per 1M)
  const usd = (inTok / 1e6) * 1 + (outTok / 1e6) * 5;

  console.log(`\n── ${name} (${total.toLocaleString()}곳) ──`);
  console.log(`  근거(Evidence) 번역 필요 : ${needEv.toLocaleString()}곳`);
  console.log(`  업종(Type) 번역 필요     : ${needTy.toLocaleString()}곳`);
  console.log(`  번역할 글자              : ${chars.toLocaleString()}자`);
  console.log(`  토큰(추정)               : 입력 ${inTok.toLocaleString()} · 출력 ${outTok.toLocaleString()}`);
  console.log(`  API 비용 (haiku-4.5)     : 약 $${usd.toFixed(2)}  ≈ ₩${Math.round(usd * 1400).toLocaleString()}`);
}

// 이미 번역된 것은 얼마나 되나 — 비교용
const doneEv = await L.countDocuments({ ...LEGACY, ...HAS('EvidenceKo') });
const allEv = await L.countDocuments({ ...LEGACY, ...HAS('Evidence') });
console.log(`\n참고 — 올린 데이터 중 근거가 있는 곳 ${allEv.toLocaleString()} 중 ${doneEv.toLocaleString()}곳은 이미 한글본이 있습니다.`);

await mongoose.disconnect();
