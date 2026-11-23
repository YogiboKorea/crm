/**
 * 🤖 AI 메일 비서 — 메일 도구와 API 키를 **돈 안 들이고** 확인한다 (2026-11-12 · 11-23 전무님 추가).
 *
 *   1) 누가 쓰고 누구 메일함을 읽는가 — 대표님·전무님은 각자 자기 메일함, admin(시험용)은 대표님 메일함
 *   2) 메일 찾기 · 열기 · 할 일 목록이 각 메일함에서 제대로 나오는가 (DB 만 읽는다)
 *   3) 다른 메일함의 메일 id 는 열리지 않는가 — 전무님 비서로 대표님 메일, 대표님 비서로 전무님 메일
 *   4) 지시문이 메일함 주인에 맞는가 (부르는 말 · 메일이 있는 기간)
 *   5) API 키가 유효하고 채팅 모델·대체 모델을 쓸 수 있는가 — 모델 정보 조회(무료)만 한다, 질문은 보내지 않는다
 *
 * 사용: npx tsx scripts/check-ai-chat-tools.mts
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

let fail = 0;
const ok = (c: any, m: string) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };

const { runMailTool, AI_CHAT_MODEL, mailboxFreshness, systemPreview, mailboxProfile } = await import('../src/lib/ai/mail-chat.ts');
const { AI_CHAT_MAILBOX_OWNER, canUseAiChat, aiChatMailboxOwner } = await import('../src/lib/ai/chat-access.ts');
const { accountIdsForOwner } = await import('../src/lib/mail/scope.ts');
await mongoose.connect(process.env.MONGODB_URI!);
const im = mongoose.connection.db!.collection('inboundmails');

try {
  console.log(`시험용(마스터) 아이디가 읽는 메일함: ${AI_CHAT_MAILBOX_OWNER} · 모델: ${AI_CHAT_MODEL}`);
  ok(canUseAiChat('david') && canUseAiChat('hoon') && canUseAiChat('admin') && !canUseAiChat('fe') && !canUseAiChat('yogico'),
    '쓸 수 있는 아이디: david·hoon·admin (fe·yogico 는 안 됨)');
  ok(aiChatMailboxOwner('david') === 'david' && aiChatMailboxOwner('hoon') === 'hoon' && aiChatMailboxOwner('admin') === 'david' && aiChatMailboxOwner('fe') === 'fe',
    '읽는 메일함: david→대표님 · hoon→전무님 · admin→대표님(시험용) · fe→자기 것');

  for (const owner of ['david', 'hoon']) {
    console.log(`\n[${owner} 메일함]`);
    const ids = await accountIdsForOwner(owner);
    const recent: any = await runMailTool('search_mails', { limit: 5 }, owner);
    ok(recent.total > 0 && recent.mails.length === 5, `최근 메일 찾기 — 전체 ${recent.total}통 중 ${recent.mails.length}통`);
    console.log('        ' + recent.mails.map((m: any) => `${m.date} ${m.from.slice(0, 30)} | ${m.subject.slice(0, 40)}`).join('\n        '));
    // 찾은 메일이 모두 이 메일함 것인가
    const found = await im.find({ _id: { $in: recent.mails.map((m: any) => new mongoose.Types.ObjectId(m.id)) } }, { projection: { accountId: 1 } }).toArray();
    ok(found.length === recent.mails.length && found.every((m: any) => ids.includes(String(m.accountId))), `찾은 메일 ${found.length}통 모두 ${owner} 메일함 것`);

    const dg: any = await runMailTool('search_mails', { query: 'Dangaard', limit: 5, sort: 'oldest' }, owner);
    ok(dg.total > 0, `낱말 찾기 "Dangaard" — ${dg.total}통 (오래된 순 첫 메일 ${dg.mails[0]?.date || '-'})`);

    const nr: any = await runMailTool('list_open_items', { kind: 'needs_reply', limit: 5 }, owner);
    const dl: any = await runMailTool('list_open_items', { kind: 'deadlines', limit: 5 }, owner);
    ok(typeof nr.total === 'number' && typeof dl.total === 'number', `할 일 목록 — 회신 필요 ${nr.total}건(최근 ${nr.windowDays}일) · 기한 ${dl.total}건`);

    const id = recent.mails[0]?.id;
    const one: any = await runMailTool('read_mail', { id }, owner);
    ok(one && one.id === id && typeof one.body === 'string', `메일 열기 — "${String(one.subject || '').slice(0, 40)}" 본문 ${String(one.body || '').length}자 · 분석 ${one.analysis?.summary ? '있음' : '없음'}`);

    // 이 메일함 밖의 메일은 열리지 않아야 한다 — 특히 상대(대표님↔전무님) 메일함
    const otherOwner = owner === 'david' ? 'hoon' : 'david';
    const theirs = await accountIdsForOwner(otherOwner);
    const other: any = await im.findOne({ accountId: { $in: theirs, $nin: ids } }, { projection: { _id: 1 } });
    const out: any = other ? await runMailTool('read_mail', { id: String(other._id) }, owner) : { error: '(상대 메일함 메일 없음)' };
    ok(other && !!out.error, `${otherOwner} 메일함 메일은 막힘 — ${out.error}`);
    const att: any = other ? await runMailTool('read_attachment', { id: String(other._id) }, owner) : { error: '-' };
    ok(!!att.error, `${otherOwner} 메일 첨부도 막힘 — ${att.error}`);

    // 화면·지시문에 쓰는 주소 — 실제 등록된 계정 (대표님은 11/23 부터 david@ · rnd@)
    const prof = await mailboxProfile(owner, ids);
    ok(prof.address.split(', ')[0] === `${owner}@yogico.kr` && !prof.address.includes(`${otherOwner}@`), `메일함 주소 — ${prof.address}`);

    const f = await mailboxFreshness(ids);
    console.log(`        받아 온 시각 ${f.lastSyncAt?.toISOString().slice(0, 16) || '-'} · 가장 최근 메일 ${f.latestMail?.toISOString().slice(0, 16) || '-'} · 멈춤 ${f.stale ? '예' : '아니오'}`);
  }

  // 지시문 — 부르는 말 · 기간 · 받아 오기 멈춤 안내
  console.log('');
  const sd = systemPreview('david');
  const sh = systemPreview('hoon');
  const sa = systemPreview(aiChatMailboxOwner('admin'));
  ok(/대표 박대진\(David\) 님의 메일 비서다 \(메일함 david@yogico\.kr\)/.test(sd) && /2026년 1월부터/.test(sd) && /대표님이 입력창에/.test(sd) && !/전무/.test(sd), '대표님 지시문 — 대표님 · david@ · 2026년 1월부터');
  ok(/전무 Hoon Lee 님의 메일 비서다 \(메일함 hoon@yogico\.kr\)/.test(sh) && /2026년 8월 21일부터/.test(sh) && /전무님이 입력창에/.test(sh) && !/대표님|박대진|david@/.test(sh), '전무님 지시문 — 전무님 · hoon@ · 2026년 8월 21일부터 · 대표님 말 없음');
  ok(sa === sd, 'admin(시험용) 지시문은 대표님 것과 같다');
  const stale = systemPreview('hoon', { lastSyncAt: new Date('2026-11-12T22:50:00Z'), latestMail: null, stale: true });
  ok(/2026-11-13 07:50 이후로 새 메일을 받아 오지 못했다/.test(stale) && !/받아 오지 못했다/.test(sh), '받아 오기가 멈춘 메일함이면 지시문 끝에 그 시각을 알린다 (한국 시각) · 아니면 없음');

  const bad: any = await runMailTool('read_mail', { id: 123 }, 'hoon');
  ok(!!bad.error, `잘못된 입력은 막힘 — ${bad.error}`);

  // API 키 — 모델 정보 조회만 (토큰 사용 없음)
  if (!process.env.ANTHROPIC_API_KEY) {
    ok(false, 'ANTHROPIC_API_KEY 없음');
  } else {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const a = new Anthropic();
    for (const m of [AI_CHAT_MODEL, 'claude-opus-4-8']) {
      try {
        const info: any = await a.models.retrieve(m);
        ok(true, `API 키로 ${m} 사용 가능 (${info.display_name || info.id})`);
      } catch (e: any) {
        ok(false, `API 키로 ${m} 확인 실패 — ${e?.status || ''} ${e?.message || e}`);
      }
    }
  }
} catch (e: any) {
  fail++;
  console.log('  X   ' + (e?.stack || e));
} finally {
  await mongoose.disconnect();
}
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
