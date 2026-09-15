/**
 * 화면에 뜨는 메일 숫자가 **실제 DB 와 맞는지** 하나하나 대조한다 (2026-09-15, "841개가 맞는거니").
 *
 * api/mail/counts 와 **같은 조건**으로 세어, 어긋나면 어디서 어긋나는지 보이게 한다.
 * 계정을 고르면 같은 주소로 등록된 다른 계정 것도 함께 센다 (scope.ts mailboxIds 와 같은 규칙).
 *
 * 사용: node scripts/check-mail-counts.mjs [--mailbox=david@yogico.kr]
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=');
const MAILBOX = arg('mailbox', '');

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const I = db.collection('inboundmails');
const A = db.collection('mailaccounts');

const NOISE = ['ad', 'system', 'newsletter'];
const COUNT_DAYS = 60;
const REPLY_DAYS = 14;
const since = new Date(Date.now() - COUNT_DAYS * 86400000);
const replySince = new Date(Date.now() - REPLY_DAYS * 86400000);

const accounts = await A.find({}, { projection: { smtpUser: 1, owner: 1, accountName: 1 } }).toArray();
const groups = new Map();                                  // 주소 → 계정 id 목록 (같은 메일함)
for (const a of accounts) {
  const k = String(a.smtpUser).toLowerCase();
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(String(a._id));
}

const counts = async (acc) => {
  const base = { ...acc, trashedAt: null, direction: 'in' };
  const [inbox, needsReply, deadlines, total, trash, noise, older] = await Promise.all([
    I.countDocuments({ ...base, date: { $gte: since }, classification: { $nin: NOISE } }),
    I.countDocuments({ ...base, date: { $gte: replySince }, classification: { $nin: NOISE }, 'analysis.needsReply': true, status: { $in: ['new', 'reviewing'] } }),
    I.countDocuments({ ...base, date: { $gte: since }, classification: { $nin: NOISE }, 'analysis.deadline': { $ne: null }, status: { $nin: ['replied', 'archived', 'ignored'] } }),
    I.countDocuments({ ...acc }),
    I.countDocuments({ ...acc, trashedAt: { $ne: null } }),
    I.countDocuments({ ...base, date: { $gte: since }, classification: { $in: NOISE } }),
    I.countDocuments({ ...base, date: { $lt: since } }),
  ]);
  return { inbox, needsReply, deadlines, total, trash, noise, older };
};

const show = async (label, acc) => {
  const c = await counts(acc);
  console.log(`\n【${label}】`);
  console.log(`  받은 메일함 (최근 2개월·광고 제외) : ${c.inbox}`);
  console.log(`  회신 필요   (최근 2주)            : ${c.needsReply}`);
  console.log(`  기한 관리                         : ${c.deadlines}`);
  console.log(`  ─ 참고 ─`);
  console.log(`  이 계정에 담긴 메일 전부          : ${c.total}`);
  console.log(`  최근 2개월 광고·자동발송          : ${c.noise}  (받은 메일함 숫자에서 빠진 것)`);
  console.log(`  2개월보다 오래된 수신 메일        : ${c.older}  (기간 밖이라 안 셈)`);
  console.log(`  휴지통                            : ${c.trash}`);
  return c;
};

if (MAILBOX) {
  const ids = groups.get(MAILBOX.toLowerCase()) || [];
  if (!ids.length) { console.error(`${MAILBOX} 로 등록된 계정이 없습니다`); process.exit(1); }
  console.log(`메일함 ${MAILBOX} · 등록 ${ids.length}개를 하나로 봅니다 (화면도 같은 규칙)`);
  await show(MAILBOX, { accountId: { $in: ids } });
} else {
  for (const [addr, ids] of groups) await show(`${addr} (계정 ${ids.length}개)`, { accountId: { $in: ids } });
  await show('전체 (모든 계정)', {});
}

// ── 거래처 폴더(그룹) 숫자 ──
console.log('\n【거래처 폴더 — 화면 오른쪽 목록】');
console.log('  ※ 이 숫자는 메일 서버의 폴더가 아니라 **업체별로 묶은 값**이라 기간·계정 조건이 다릅니다.');
const accFilter = MAILBOX ? { accountId: { $in: groups.get(MAILBOX.toLowerCase()) || [] } } : {};
const byGroup = await I.aggregate([
  { $match: { ...accFilter, trashedAt: null } },
  { $group: { _id: { $ifNull: ['$group', ''] }, n: { $sum: 1 }, recent: { $sum: { $cond: [{ $gte: ['$date', since] }, 1, 0] } } } },
  { $sort: { n: -1 } }, { $limit: 18 },
]).toArray();
let sum = 0;
for (const g of byGroup) {
  sum += g.n;
  console.log(`  ${String(g._id || '(그룹 없음)').slice(0, 26).padEnd(28)} 전체 ${String(g.n).padStart(4)} · 최근 2개월 ${String(g.recent).padStart(4)}`);
}
console.log(`  (위 ${byGroup.length}개 합 ${sum})`);
await mongoose.disconnect();
