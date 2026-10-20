/**
 * 세션 분석 결과(result-NN.json)를 넣기 전에 검사한다 (2026-10-20 · 언어 규칙 변경 재분석).
 *
 *   · 묶음(batch-NN.json)과 개수·id 순서가 같은가
 *   · 분류·급함·기한 형식이 정해진 값인가
 *   · **언어 규칙** — 한국어 메일의 요약은 한국어, 그 밖의 메일 요약은 영어인가
 *   · 한국어가 아닌 메일에 한글 번역이 붙었는가
 *
 * 통과한 것만 result-all.json 으로 모은다 → node scripts/import-mail-analysis.mjs <폴더>/result-all.json --apply
 *
 * 사용: node scripts/check-analysis-results.mjs scripts/mail-analysis/re1020-david
 */
import fs from 'fs';
import path from 'path';

const dir = process.argv[2];
if (!dir) { console.error('폴더를 주세요'); process.exit(1); }
const VALID_CLASS = ['b2b', 'inquiry', 'partner', 'newsletter', 'ad', 'system', 'unknown'];
const VALID_URGENCY = ['high', 'mid', 'low'];
const VALID_DTYPE = ['', 'reply_by', 'quote_due', 'meeting', 'payment', 'contract', 'event', 'other'];
const hangul = (s) => (String(s || '').match(/[가-힣]/g) || []).length;
const latin = (s) => (String(s || '').match(/[A-Za-z]/g) || []).length;

const batches = fs.readdirSync(dir).filter((f) => /^batch-\d+\.json$/.test(f)).sort();
const all = [];
let missing = 0, bad = 0, langWarn = 0;
for (const b of batches) {
  const n = b.match(/\d+/)[0];
  const rf = path.join(dir, `result-${n}.json`);
  if (!fs.existsSync(rf)) { missing++; continue; }
  const input = JSON.parse(fs.readFileSync(path.join(dir, b), 'utf8'));
  let out;
  try { out = JSON.parse(fs.readFileSync(rf, 'utf8')); } catch (e) { console.log(`  X result-${n}: JSON 오류 ${e.message}`); bad++; continue; }
  const probs = [];
  if (!Array.isArray(out) || out.length !== input.length) probs.push(`개수 ${out?.length} ≠ ${input.length}`);
  else {
    input.forEach((m, i) => { if (out[i].id !== m.id) probs.push(`${i}번 id 다름`); });
    for (const r of out) {
      if (!VALID_CLASS.includes(r.classification)) probs.push(`${r.id} 분류 ${r.classification}`);
      if (!VALID_URGENCY.includes(r.urgency)) probs.push(`${r.id} 급함 ${r.urgency}`);
      if (!VALID_DTYPE.includes(r.deadlineType || '')) probs.push(`${r.id} 기한종류 ${r.deadlineType}`);
      if (r.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(r.deadline)) probs.push(`${r.id} 기한 ${r.deadline}`);
      // 언어 규칙: 요약 글자 대부분이 메일 언어와 맞는가
      const ko = r.lang === 'ko';
      const h = hangul(r.summary), l = latin(r.summary);
      if (ko ? h < l : h > l * 0.2) { langWarn++; if (langWarn <= 8) console.log(`  ! result-${n} ${r.id} (${r.lang}) 요약 언어가 규칙과 다름: ${String(r.summary).slice(0, 60)}`); }
      if (!ko && !String(r.translationBody || '').trim()) { langWarn++; if (langWarn <= 8) console.log(`  ! result-${n} ${r.id} (${r.lang}) 한글 번역 없음`); }
    }
  }
  if (probs.length) { bad++; console.log(`  X result-${n}: ${probs.slice(0, 4).join(' · ')}`); continue; }
  all.push(...out);
}
fs.writeFileSync(path.join(dir, 'result-all.json'), JSON.stringify(all, null, 1), 'utf8');
const byLang = all.reduce((a, r) => ((a[r.lang === 'ko' ? '한국어 메일' : '그 밖'] = (a[r.lang === 'ko' ? '한국어 메일' : '그 밖'] || 0) + 1), a), {});
console.log(`${dir}: 묶음 ${batches.length} · 통과 ${batches.length - missing - bad} · 아직 없음 ${missing} · 문제 ${bad} · 언어 경고 ${langWarn}`);
console.log(`result-all.json ${all.length}통 · ${JSON.stringify(byLang)} · 회신 필요 ${all.filter((r) => r.needsReply).length}`);
