/**
 * **한 사람의 메일함을 거래처 폴더로 나눈다 — 다른 사람이 손으로 나눠 둔 폴더를 배워서** (2026-10-20, 요청).
 *
 * 전무님(hoon@) 메일이 받은편지함 한 곳에 몰려 있어, 대표님(david@)이 이카운트에서 손으로 나눠 둔 거래처 폴더를
 * 기준으로 같은 방식으로 나눈다. 순서는 받은 메일함의 [폴더 다시 나누기](api/mail/groups POST)와 같다.
 *   1) 대표님 폴더에서 "이 보낸 사람(주소·회사 도메인) → 이 거래처" 를 배워, 같은 곳에서 온 메일을 같은 폴더로
 *   2) 제목에 거래처 이름이 들어 있으면 그 폴더로
 *   3) 나머지 — 사내 / 광고·자동발송 / 5통 넘게 오간 회사는 회사 이름 폴더 / 그 밖은 '· 기타' (groups.ts autoAssignGroup)
 *
 * ⚠ 평소에는 아이디마다 자기 메일에서만 배운다(남의 폴더 이름이 내 메일함에 보이지 않게). 이 스크립트는 요청에 따라
 *   한 번, 다른 사람의 폴더 이름을 빌려 온다 — 옮겨지는 것은 폴더 이름뿐이고 그 사람의 메일은 보이지 않는다.
 * 사람이 직접 옮긴 메일(groupBy manual)과 이미 폴더가 있는 메일은 건드리지 않는다.
 * 그 사람의 메일이 모두 휴지통에 있는 폴더(예: 일부러 지운 폴더)는 배우지 않는다.
 *
 * 사용: npx tsx scripts/regroup-mailbox.mts --target=hoon --learn-from=david            (미리보기)
 *       --exclude="Yogibo Japan"   빌려 오지 않을 폴더 (쉼표로 여러 개)
 *       npx tsx scripts/regroup-mailbox.mts --target=hoon --learn-from=david --apply    (적용)
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const arg = (k: string, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const TARGET = arg('target');
const FROM = arg('learn-from');
const APPLY = process.argv.includes('--apply');
// 빌려 오지 않을 폴더 (쉼표로) — 예: 일부러 지운 폴더
const EXCLUDE = new Set(arg('exclude').split(',').map((x) => x.trim()).filter(Boolean));
if (!TARGET || !FROM) { console.error('--target=아이디 --learn-from=아이디 를 주세요'); process.exit(1); }

const { MailAccount } = await import('../src/models/MailAccount.ts');
const { InboundMail } = await import('../src/models/InboundMail.ts');
const { learnSenderGroups, suggestGroupBySender, suggestGroupByName, autoAssignGroup, getOwnDomains, GROUP_NOISE } = await import('../src/lib/mail/groups.ts');
const { AD_FOLDER } = await import('../src/lib/mail/ingest.ts');

await mongoose.connect(process.env.MONGODB_URI!);
const idsOf = async (owner: string) => (await MailAccount.find({ owner, mergedInto: { $in: [null, ''] } }, { _id: 1 }).lean())
  .map((a: any) => String(a._id));
const targetIds = await idsOf(TARGET);
const sourceIds = await idsOf(FROM);
if (!targetIds.length || !sourceIds.length) { console.error(`메일 계정이 없습니다 (${TARGET} ${targetIds.length} · ${FROM} ${sourceIds.length})`); process.exit(1); }

// 배울 폴더 — 그 사람 메일이 전부 휴지통에 있는 폴더는 뺀다 (일부러 지운 폴더를 되살리지 않게)
const srcGroups: any[] = await InboundMail.aggregate([
  { $match: { accountId: { $in: sourceIds }, group: { $nin: [null, ''] } } },
  { $group: { _id: '$group', n: { $sum: 1 }, live: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$trashedAt', null] }, null] }, 1, 0] } } } },
]);
const dropped = new Set([...srcGroups.filter((g) => g.live === 0).map((g) => g._id), ...EXCLUDE]);
const knownGroups = srcGroups.filter((g) => g.live > 0 && !EXCLUDE.has(g._id)).map((g) => g._id);
console.log(`${FROM} 거래처 폴더 ${knownGroups.length}개를 배웁니다${dropped.size ? ` (뺀 폴더: ${[...dropped].join(', ')})` : ''}`);

const learnedAll = await learnSenderGroups([...sourceIds, ...targetIds]);
// 뺀 폴더로 가는 학습은 지운다
for (const map of [learnedAll.addrMap, learnedAll.domainMap]) {
  for (const [k, v] of map) if (dropped.has(v.group)) map.delete(k);
}

// 동료(@yogico.kr)가 보낸 사내 메일은 '보낸 메일(out)' 로 저장되지만 받은 메일함에 보인다 — 같이 나눈다.
// 그 사람 **본인이 보낸** 메일만 뺀다 (받은 메일함에 안 보이는 것이라 폴더 숫자만 부풀린다).
const mine = (await MailAccount.find({ owner: TARGET }, { smtpUser: 1, fromAddress: 1 }).lean())
  .flatMap((a: any) => [a.smtpUser, a.fromAddress]).filter(Boolean).map((s: string) => s.toLowerCase());
const targets: any[] = (await InboundMail.find({
  accountId: { $in: targetIds }, group: { $in: [null, ''] }, groupBy: { $ne: 'manual' }, trashedAt: null,
}, { _id: 1, subject: 1, from: 1, classification: 1, direction: 1 }).lean())
  .filter((m: any) => !mine.includes(String(m.from?.address || '').toLowerCase()));

// 회사 폴더를 팔 만큼 오갔는지 — 대상 사람의 받은 메일 전체로 센다
const domainCounts = new Map<string, number>();
for (const r of await InboundMail.aggregate([
  { $match: { accountId: { $in: targetIds }, direction: { $ne: 'out' }, 'from.address': { $nin: [null, ''] } } },
  { $group: { _id: { $toLower: { $arrayElemAt: [{ $split: ['$from.address', '@'] }, 1] } }, n: { $sum: 1 } } },
])) if (r._id) domainCounts.set(String(r._id), r.n);
const own = await getOwnDomains();

const plan: Array<{ _id: any; group: string; by: string; subject: string; from: string }> = [];
for (const m of targets) {
  const s = suggestGroupBySender({ from: m.from }, learnedAll);
  const n = s ? null : suggestGroupByName({ subject: m.subject }, knownGroups);
  let group = '';
  let by = '';
  if (s) { group = s.group; by = `learn:${FROM}:${s.by}`; }
  else if (n) { group = n.group; by = `name:${n.matched}`; }
  else {
    const a = autoAssignGroup({ from: m.from, classification: m.classification }, own, domainCounts);
    if (!a) continue;
    // 광고 폴더는 메일 수집이 쓰는 이름(ingest.ts AD_FOLDER) 하나로 — 이름이 다른 광고 폴더가 둘 생기지 않게
    group = a.group === GROUP_NOISE ? AD_FOLDER : a.group; by = `auto:${a.by}`;
  }
  plan.push({ _id: m._id, group, by, subject: String(m.subject || ''), from: String(m.from?.address || '') });
}

const byGroup = new Map<string, { n: number; how: Set<string> }>();
for (const p of plan) {
  const g = byGroup.get(p.group) || { n: 0, how: new Set<string>() };
  g.n++; g.how.add(p.by.split(':')[0]);
  byGroup.set(p.group, g);
}
console.log(`\n${TARGET} 폴더 없는 메일 ${targets.length}통 → ${plan.length}통 배치 (남는 것 ${targets.length - plan.length}통)`);
for (const [g, v] of [...byGroup].sort((a, b) => b[1].n - a[1].n)) {
  const fromSource = knownGroups.includes(g);
  console.log(`  ${String(v.n).padStart(4)}통  ${g}${fromSource ? `  ← ${FROM} 폴더` : ''}  (${[...v.how].join('·')})`);
}

if (APPLY && plan.length) {
  const ops = plan.map((p) => ({
    updateOne: {
      filter: { _id: p._id, accountId: { $in: targetIds }, group: { $in: [null, ''] }, groupBy: { $ne: 'manual' } },
      update: { $set: { group: p.group, groupBy: p.by } },
    },
  }));
  let changed = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const r = await InboundMail.bulkWrite(ops.slice(i, i + 500) as any, { ordered: false });
    changed += r.modifiedCount || 0;
  }
  console.log(`\n✅ ${changed}통에 폴더를 붙였습니다 (되돌리려면 groupBy 가 learn:/name:/auto: 인 ${TARGET} 메일의 group 을 비우면 됩니다)`);
} else if (!APPLY) {
  console.log('\n(미리보기입니다 — 적용하려면 --apply)');
}

// ── 받은 메일함 왼쪽 폴더 목록에 보이게 — 메일 서버에 없는 폴더라 CRM 전용 목록(crmFolders)에 적는다 ──
// 폴더 목록은 메일 서버 폴더만 보여 주므로(groups.ts getFolderOrder), 이게 없으면 나눠 놓고도 화면에 안 보인다.
// 순서: 빌려 온 거래처 폴더(많은 순) → 회사 이름 폴더(많은 순) → · 사내 → · 기타. 광고 폴더는 원래 따로 보인다.
if (APPLY) {
  const counts: any[] = await InboundMail.aggregate([
    { $match: { accountId: { $in: targetIds }, group: { $nin: [null, '', AD_FOLDER] }, trashedAt: null } },
    { $group: { _id: '$group', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  const rank = (g: string) => (knownGroups.includes(g) ? 0 : g.startsWith('·') ? (g.includes('기타') ? 3 : 2) : 1);
  const folders = counts.map((c) => c._id as string).sort((a, b) => rank(a) - rank(b));
  await MailAccount.updateMany({ _id: { $in: targetIds } }, { $set: { crmFolders: folders } });
  console.log(`폴더 목록(CRM 전용) ${folders.length}개: ${folders.join(' · ')}`);
}
await mongoose.disconnect();
process.exit(0);
