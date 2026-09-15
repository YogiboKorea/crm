/**
 * [🤝 대화 진행 중] 삭제 확인 (2026-09-15).
 *
 * **실제 업체는 건드리지 않는다** — 검사용 가짜 업체를 만들어 그걸 지워 보고, 끝나면 흔적 없이 치운다.
 *
 * 상세 화면:
 *   1) [단계 옮기기] 와 **따로 떨어진** 삭제 칸이 있고, 버튼이 [✕ 더 이상 진행 안 함 · 삭제] 인가
 *   2) 확인 창 문구 → 삭제 → 목록·사이드바에서 빠지는가
 * 목록 카드:
 *   3) 카드마다 [✕ 삭제] 가 있고, 누르면 **상세가 열리지 않고** 바로 삭제되는가
 *   4) 확인 창에서 [취소] 하면 아무 일도 없는가
 * 공통:
 *   5) DB 에는 지우지 않고 deleted 표시 + 사유 + 원래 단계가 남는가
 *   6) 그 업체에서 새 답장이 와도 다시 매칭되지 않는가
 *   7) 파트너십 확정 화면은 [🗑 파트너십에서 삭제] 그대로이고 단계 옮기기 칸이 없는가
 *
 * 사용: npx tsx scripts/check-negotiating-delete.mts
 */
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const { matchLead } = await import('../src/lib/mail/match-lead.ts');

const B = 'http://localhost:3000';
let fail = 0;
const ok = (c: any, m: string) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms: number) => new Promise((r) => setTimeout(r, ms));
const token = () => new SignJWT({ user: 'david', role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const waitFor = async (p: any, fn: any, arg?: any, ms = 20000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await w(250); }
  return false;
};

await mongoose.connect(process.env.MONGODB_URI!);
const L = mongoose.connection.db!.collection('leads');
const stamp = Date.now();
const now = new Date().toISOString();
const makeLead = (tag: string) => ({
  leadId: `zz-check-neg-${tag}-${stamp}`,
  Company: `ZZ 검사용 대화중 ${tag} ${stamp}`,
  Country: 'Test',
  Email: `neg-${tag}-${stamp}@check-only.invalid`,
  WebsiteContact: '', stage: 'negotiating', stageChangedAt: now, addedManually: true,
  emailHistory: [], createdAt: new Date(), updatedAt: new Date(),
});
const A = makeLead('detail');   // 상세 화면에서 지울 것
const C = makeLead('card');     // 카드에서 지울 것
await L.insertMany([A, C]);
console.log(`검사용 업체 2곳을 만들었습니다`);

const negBefore = await L.countDocuments({ stage: 'negotiating', deleted: { $ne: true } });
const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const errs: string[] = [];
const dialogs: string[] = [];
let dialogAnswer = true;
try {
  const pre = await matchLead({ from: { address: A.Email } });
  ok(pre?.leadId === A.leadId, '삭제 전: 이 주소에서 온 메일은 검사용 업체로 매칭됨 (검사 조건 확인)');

  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', async (d) => { dialogs.push(d.message()); if (dialogAnswer) await d.accept(); else await d.dismiss(); });
  await p.setRequestInterception(true);
  p.on('request', (r) => (r.method() === 'POST' && /\/api\/mail\//.test(r.url())) ? r.abort() : r.continue());
  await p.setViewport({ width: 1500, height: 1000 });
  await p.setCookie({ name: 'admin_session', value: await token(), domain: 'localhost', path: '/' });
  await p.goto(B, { waitUntil: 'networkidle2' });
  await w(2500);
  const badge = () => p.evaluate(() => Number(document.querySelector('[data-nav-badge="negotiating"]')?.textContent?.trim() || 'NaN'));
  const openNegotiating = async () => {
    await p.evaluate(() => (document.querySelector('.nav-item[data-view="pipeline-negotiating"]') as any)?.click());
    return waitFor(p, () => document.querySelectorAll('.rel-card').length > 0);
  };

  // ── 상세 화면 ──
  console.log(`\n── 상세 화면 (사이드바 ${await badge()} · DB ${negBefore})`);
  ok(await openNegotiating(), '대화 진행 중 목록이 뜸');
  await p.evaluate((id: string) => (document.querySelector(`.rel-card[data-lead-id="${id}"]`) as any)?.click(), A.leadId);
  ok(await waitFor(p, () => !!document.querySelector('.rel-remove')), '상세 화면이 열림');
  const layout = await p.evaluate(() => {
    const move = document.querySelector('.rel-stage-move[data-to="partner"]') as HTMLElement | null;
    const rm = document.querySelector('.rel-remove') as HTMLElement | null;
    const moveBox = move?.parentElement;
    const rmBox = rm?.parentElement;
    return {
      move: move?.textContent?.trim() || '',
      remove: rm?.textContent?.trim() || '',
      separate: !!moveBox && !!rmBox && moveBox !== rmBox,
      moveLabel: moveBox?.textContent?.includes('단계 옮기기') || false,
      removeInMoveBox: !!moveBox?.querySelector('.rel-remove'),
      question: rmBox?.textContent?.includes('더 이상 대화를 이어가지 않나요') || false,
    };
  });
  ok(/파트너십 확정으로/.test(layout.move) && layout.moveLabel, `[단계 옮기기] 칸: ${layout.move}`);
  ok(/더 이상 진행 안 함 · 삭제/.test(layout.remove), `삭제 버튼: [${layout.remove}]`);
  ok(layout.separate && !layout.removeInMoveBox, '삭제가 [단계 옮기기] 와 **따로 떨어진 칸**에 있음');
  ok(layout.question, '"더 이상 대화를 이어가지 않나요?" 안내가 붙어 있음');

  const b0 = await badge();
  await p.evaluate(() => (document.querySelector('.rel-remove') as any)?.click());
  ok(await waitFor(p, () => !document.querySelector('.rel-remove') && document.querySelectorAll('.rel-card, .empty-detail').length > 0), '삭제 후 목록으로 돌아옴');
  ok(/대화 진행 중 목록에서 삭제/.test(dialogs[dialogs.length - 1] || ''), '확인 창: "대화 진행 중 목록에서 삭제합니다"');
  ok(await p.evaluate((id: string) => !document.querySelector(`.rel-card[data-lead-id="${id}"]`), A.leadId), '목록에서 사라짐');
  await w(1500);
  ok((await badge()) === b0 - 1, `사이드바 숫자 ${b0} → ${await badge()}`);

  // ── 목록 카드 ──
  console.log('\n── 목록 카드 [✕ 삭제]');
  ok(await p.evaluate((id: string) => !!document.querySelector(`.rel-card[data-lead-id="${id}"] .rel-card-remove`), C.leadId), '카드에 [✕ 삭제] 버튼이 있음');
  ok(await p.evaluate(() => [...document.querySelectorAll('.rel-card')].every((c) => !!c.querySelector('.rel-card-remove'))), '모든 카드에 있음');

  // 취소하면 아무 일도 없어야 한다
  dialogAnswer = false;
  const nDialogs = dialogs.length;
  await p.evaluate((id: string) => (document.querySelector(`.rel-card[data-lead-id="${id}"] .rel-card-remove`) as any)?.click(), C.leadId);
  await w(1200);
  ok(dialogs.length === nDialogs + 1, '누르면 확인 창이 뜸');
  ok(await p.evaluate(() => !document.querySelector('.rel-remove')), '카드 삭제 버튼을 눌러도 **상세 화면이 열리지 않음**');
  ok(await p.evaluate((id: string) => !!document.querySelector(`.rel-card[data-lead-id="${id}"]`), C.leadId), '[취소] 하면 그대로 남아 있음');
  ok((await L.findOne({ leadId: C.leadId }))?.deleted !== true, '[취소] 하면 DB 도 그대로');

  // 확인하면 지워진다
  dialogAnswer = true;
  const b1 = await badge();
  await p.evaluate((id: string) => (document.querySelector(`.rel-card[data-lead-id="${id}"] .rel-card-remove`) as any)?.click(), C.leadId);
  ok(await waitFor(p, (id: string) => !document.querySelector(`.rel-card[data-lead-id="${id}"]`), C.leadId), '[확인] 하면 목록에서 사라짐');
  ok(await p.evaluate(() => !document.querySelector('.rel-remove')), '상세로 넘어가지 않고 목록에 머묾');
  await w(1500);
  ok((await badge()) === b1 - 1, `사이드바 숫자 ${b1} → ${await badge()}`);

  // ── DB · 되살아나지 않는가 ──
  console.log('\n── DB');
  for (const x of [A, C]) {
    const doc: any = await L.findOne({ leadId: x.leadId });
    ok(doc?.deleted === true && doc?.deletedReason === '대화 진행 중에서 삭제' && doc?.deletedFromStage === 'negotiating',
      `${x.leadId.includes('detail') ? '상세' : '카드'}에서 지운 것: 삭제 표시 · 사유 "${doc?.deletedReason}" · 원래 단계 ${doc?.deletedFromStage}`);
    const hit = await matchLead({ from: { address: x.Email } });
    ok(!hit || hit.leadId !== x.leadId, '  같은 주소에서 답장이 와도 매칭 안 됨 (되살아나지 않음)');
  }
  ok((await L.countDocuments({ stage: 'negotiating', deleted: { $ne: true } })) === negBefore - 2, 'DB 대화 진행 중 수가 2 줄어듦');

  // ── 파트너십 쪽 ──
  console.log('\n── ⭐ 파트너십 확정 (눌러 보지 않고 확인만)');
  await p.evaluate(() => (document.querySelector('.nav-item[data-view="pipeline-partner"]') as any)?.click());
  if (await waitFor(p, () => document.querySelectorAll('.rel-card').length > 0, undefined, 15000)) {
    ok(await p.evaluate(() => [...document.querySelectorAll('.rel-card')].every((c) => !!c.querySelector('.rel-card-remove'))), '파트너 카드에도 [✕ 삭제] 있음');
    await p.evaluate(() => (document.querySelector('.rel-card') as any)?.click());
    ok(await waitFor(p, () => !!document.querySelector('.rel-remove')), '파트너 상세가 열림');
    const pb = await p.evaluate(() => ({
      remove: document.querySelector('.rel-remove')?.textContent?.trim() || '',
      moveBox: !!document.querySelector('.rel-stage-move'),
      back: !!document.querySelector('.rel-stage-move[data-to="negotiating"]'),
    }));
    ok(/파트너십에서 삭제/.test(pb.remove), `[${pb.remove}] 그대로`);
    ok(!pb.moveBox && !pb.back, '파트너 화면에는 단계 옮기기 칸이 없음 ([대화 진행 중으로] 되돌리기 없음)');
  } else {
    console.log('  (파트너가 없어 건너뜀)');
  }

  console.log(`\n자바스크립트 오류 ${errs.length}건${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  if (errs.length) fail += errs.length;
} finally {
  await b.close();
  const del = await L.deleteMany({ leadId: { $in: [A.leadId, C.leadId] } });
  console.log(`\n검사용 업체 치움 (${del.deletedCount}건) · 남은 흔적 ${await L.countDocuments({ leadId: { $in: [A.leadId, C.leadId] } })}건`);
  await mongoose.disconnect();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
