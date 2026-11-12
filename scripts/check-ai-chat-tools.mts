/**
 * 🤖 AI 메일 비서 — 메일 도구와 API 키를 **돈 안 들이고** 확인한다 (2026-11-12).
 *
 *   1) 메일 찾기 · 열기 · 할 일 목록이 대표님 메일함에서 제대로 나오는가 (DB 만 읽는다)
 *   2) 다른 메일함의 메일 id 는 열리지 않는가
 *   3) API 키가 유효하고 채팅 모델·대체 모델을 쓸 수 있는가 — 모델 정보 조회(무료)만 한다, 질문은 보내지 않는다
 *
 * 사용: npx tsx scripts/check-ai-chat-tools.mts
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

let fail = 0;
const ok = (c: any, m: string) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };

const { runMailTool, AI_CHAT_MODEL } = await import('../src/lib/ai/mail-chat.ts');
const { AI_CHAT_MAILBOX_OWNER, canUseAiChat } = await import('../src/lib/ai/chat-access.ts');
const { accountIdsForOwner } = await import('../src/lib/mail/scope.ts');
await mongoose.connect(process.env.MONGODB_URI!);
const im = mongoose.connection.db!.collection('inboundmails');

try {
  console.log(`메일함 주인: ${AI_CHAT_MAILBOX_OWNER} · 모델: ${AI_CHAT_MODEL}`);
  ok(canUseAiChat('david') && canUseAiChat('admin') && !canUseAiChat('hoon') && !canUseAiChat('fe'), '쓸 수 있는 아이디: david·admin (hoon·fe 는 안 됨)');

  const recent: any = await runMailTool('search_mails', { limit: 5 });
  ok(recent.total > 0 && recent.mails.length === 5, `최근 메일 찾기 — 전체 ${recent.total}통 중 ${recent.mails.length}통`);
  console.log('        ' + recent.mails.map((m: any) => `${m.date} ${m.from.slice(0, 30)} | ${m.subject.slice(0, 40)}`).join('\n        '));

  const dg: any = await runMailTool('search_mails', { query: 'Dangaard', limit: 5, sort: 'oldest' });
  ok(dg.total > 0, `낱말 찾기 "Dangaard" — ${dg.total}통 (오래된 순 첫 메일 ${dg.mails[0]?.date || '-'})`);

  const ko: any = await runMailTool('search_mails', { query: '견적', limit: 3 });
  ok(ko.total > 0, `한글로 찾기 "견적" — ${ko.total}통 (영어 메일은 한글 번역·요약으로 찾힘)`);

  const nr: any = await runMailTool('list_open_items', { kind: 'needs_reply', limit: 5 });
  const dl: any = await runMailTool('list_open_items', { kind: 'deadlines', limit: 5 });
  ok(typeof nr.total === 'number' && typeof dl.total === 'number', `할 일 목록 — 회신 필요 ${nr.total}건(최근 ${nr.windowDays}일) · 기한 ${dl.total}건`);

  const id = recent.mails[0]?.id;
  const one: any = await runMailTool('read_mail', { id });
  ok(one && one.id === id && typeof one.body === 'string', `메일 열기 — "${String(one.subject || '').slice(0, 40)}" 본문 ${String(one.body || '').length}자 · 분석 ${one.analysis?.summary ? '있음' : '없음'}`);

  // 대표님 메일함 밖의 메일은 열리지 않아야 한다
  const mine = await accountIdsForOwner(AI_CHAT_MAILBOX_OWNER);
  const other: any = await im.findOne({ accountId: { $nin: mine } }, { projection: { _id: 1 } });
  const out: any = other ? await runMailTool('read_mail', { id: String(other._id) }) : { error: '(다른 메일함 메일 없음)' };
  ok(!!out.error, `다른 메일함 메일은 막힘 — ${out.error}`);

  const bad: any = await runMailTool('read_mail', { id: 123 });
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
