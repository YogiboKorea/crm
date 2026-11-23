import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { getSessionUser, UNAUTHORIZED } from '@/lib/mail/scope';
import { AiChat, type IAiChat } from '@/models/AiChat';
import { AiChatUsage } from '@/models/AiChatUsage';
import { canUseAiChat, aiChatMailboxOwner, aiChatMailbox } from '@/lib/ai/chat-access';
import { runMailChat, mailboxFreshness, pickModel, AI_CHAT_MODEL, AI_CHAT_MODELS, AI_CHAT_MONTHLY_KRW, MAX_CONTEXT_TOKENS, krwOf } from '@/lib/ai/mail-chat';
import { KST_OFFSET_MS } from '@/lib/mail/period';
import { InboundMail } from '@/models/InboundMail';
import { accountIdsForOwner } from '@/lib/mail/scope';
import { loadMailBody } from '@/lib/mail/body';
import { loadUploads, deleteUploads, normalizeUploadIds } from '@/lib/mail/uploads';
import { prepareFile, deleteFiles, type PreparedFile } from '@/lib/ai/attachments';

export const runtime = 'nodejs';
// 메일을 여러 통 찾아 읽으면 한 번 답하는 데 수십 초가 걸린다
export const maxDuration = 300;

/**
 * 🤖 AI 메일 비서 (lib/ai/mail-chat.ts) — 대표님·전무님, 각자 자기 메일함 (lib/ai/chat-access.ts).
 *
 * GET    /api/ai/chat           → 내 대화 목록 · 이번 달 사용량 · 고를 수 있는 모델 · 읽는 메일함(언제까지 받아 왔나)
 * GET    /api/ai/chat?id=…      → 대화 하나 (화면에 보일 질문·답·근거 메일)
 * GET    /api/ai/chat?mail=…    → 근거 메일 한 통 (팝업용, 읽기만) — 내 비서가 읽는 메일함 안의 것만
 * POST   /api/ai/chat           → { conversationId?, message, model?, uploads? } — 답을 한 줄씩(JSON) 흘려 보낸다
 *                                  uploads = 입력창 📎 로 올린 파일 번호 (메일 쓰기 첨부와 같은 조각 올리기 /api/mail/upload)
 *                                  status(찾는 중) · text(답 글자) · sources(근거 메일) · done · error
 * DELETE /api/ai/chat?id=…      → 대화 지우기 (내 것만)
 */
const FORBIDDEN = { success: false, error: '이 아이디에서는 AI 메일 비서를 쓸 수 없습니다. 대표님·전무님 아이디에서 쓸 수 있습니다.' };

/** 로그인한 아이디와, 그 아이디의 비서가 읽는 메일함 주인 (자기 메일함 — 시험용 admin 만 대표님 메일함) */
async function who(): Promise<{ user: string | null; owner: string; res?: NextResponse }> {
  const user = await getSessionUser();
  if (!user) return { user: null, owner: '', res: NextResponse.json(UNAUTHORIZED, { status: 401 }) };
  if (!canUseAiChat(user)) return { user: null, owner: '', res: NextResponse.json(FORBIDDEN, { status: 403 }) };
  return { user, owner: aiChatMailboxOwner(user) };
}

/** 이번 달 1일 0시 (한국 시각) */
function monthStart(): Date {
  const k = new Date(Date.now() + KST_OFFSET_MS);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - KST_OFFSET_MS);
}

/**
 * 이번 달 사용액 — 청구는 아이디와 상관없이 한 키로 나가므로 한도는 전체 합으로 본다.
 * 사용 기록(AiChatUsage)으로 센다 — 대화를 지워도 이미 나간 돈은 빠지지 않게.
 */
async function monthSpend() {
  const rows: any[] = await AiChatUsage.aggregate([
    { $match: { at: { $gte: monthStart() } } },
    { $group: { _id: '$user', usd: { $sum: '$usd' }, questions: { $sum: 1 } } },
  ]);
  const all = rows.reduce((a, m) => ({ usd: a.usd + m.usd, questions: a.questions + m.questions }), { usd: 0, questions: 0 });
  return { all, rows };
}

const OVER_LIMIT = () =>
  `이번 달 AI 메일 비서 한도(₩${AI_CHAT_MONTHLY_KRW.toLocaleString()})를 다 썼습니다. 다음 달 1일에 다시 열립니다. 한도를 올리려면 관리자에게 말씀해 주세요.`;

export async function GET(req: Request) {
  const { user, owner, res } = await who();
  if (!user) return res!;
  await dbConnect();
  const id = new URL(req.url).searchParams.get('id');
  const mailId = new URL(req.url).searchParams.get('mail');

  // 근거 메일 팝업 — 내 비서가 읽는 메일함 안의 메일만 (전무님은 전무님 메일함, 대표님은 대표님 메일함).
  // 메일함 주인이 아닌 아이디(시험용 admin)도 답에 나온 메일을 열어 볼 수 있게 하는 읽기 전용 창이다
  // (메일 화면 API 는 자기 메일함만 연다).
  if (mailId) {
    if (!mongoose.isValidObjectId(mailId)) return NextResponse.json({ success: false, error: '메일을 찾을 수 없습니다' }, { status: 404 });
    const ids = await accountIdsForOwner(owner);
    const m: any = await InboundMail.findOne({ _id: mailId, accountId: { $in: ids } }).lean();
    if (!m) return NextResponse.json({ success: false, error: '메일을 찾을 수 없습니다' }, { status: 404 });
    const body = await loadMailBody(m);   // 앞부분만 저장된 메일은 메일 서버에서 원문을 받아 온다
    const addr = (a: any) => (a ? (a.name ? `${a.name} <${a.address}>` : String(a.address || '')) : '');
    const text = body.text || String(body.html || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n');
    return NextResponse.json({
      success: true,
      mail: {
        id: String(m._id), subject: m.subject || '', date: m.date, direction: m.direction,
        from: addr(m.from), to: (m.to || []).map(addr), cc: (m.cc || []).map(addr),
        group: m.group || '', attachments: (m.attachments || []).map((a: any) => a.filename).filter(Boolean),
        text: text.slice(0, 40000), cut: !body.fromServer && (m.rawTruncated || text.length >= 4000),
        bodyError: body.error || '',
        translation: m.translation?.body || '', summary: m.analysis?.summary || '',
      },
    });
  }

  if (id) {
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: '대화를 찾을 수 없습니다' }, { status: 404 });
    const c: any = await AiChat.findOne({ _id: id, user }, { title: 1, display: 1, updatedAt: 1 }).lean();
    if (!c) return NextResponse.json({ success: false, error: '대화를 찾을 수 없습니다' }, { status: 404 });
    return NextResponse.json({ success: true, conversation: { id: String(c._id), title: c.title, display: c.display || [], updatedAt: c.updatedAt } });
  }

  const [list, spend, fresh] = await Promise.all([
    AiChat.find({ user }, { title: 1, updatedAt: 1, 'turns.usd': 1 }).sort({ updatedAt: -1 }).limit(40).lean(),
    monthSpend(),
    accountIdsForOwner(owner).then(mailboxFreshness).catch(() => null),
  ]);
  // 청구는 아이디와 상관없이 한 키로 나간다 — 전체와 내 것을 같이 보여준다
  const { all } = spend;
  const mine = spend.rows.find((m: any) => m._id === user) || { usd: 0, questions: 0 };
  const box = aiChatMailbox(owner);
  return NextResponse.json({
    success: true,
    user,
    model: AI_CHAT_MODEL,
    defaultModel: AI_CHAT_MODEL,
    models: AI_CHAT_MODELS,
    mailboxOwner: owner,
    // 화면 문구 — 누구 메일함인지 · 언제부터 있는지 · 그 메일함에 맞는 질문 예시 · 언제까지 받아 왔는지
    mailbox: {
      owner, title: box.title, address: box.address, since: box.since, sinceNote: box.sinceNote,
      lastSyncAt: fresh?.lastSyncAt || null, latestMail: fresh?.latestMail || null, stale: !!fresh?.stale,
    },
    examples: box.examples,
    guideExamples: box.guideExamples,
    canOpenMails: user === owner,   // 근거 메일을 받은 메일함 창으로 여는 건 메일함 주인만 (시험용 admin 은 읽기 전용 창)
    keySet: !!process.env.ANTHROPIC_API_KEY,
    conversations: list.map((c: any) => ({
      id: String(c._id), title: c.title, updatedAt: c.updatedAt,
      questions: (c.turns || []).length,
    })),
    month: {
      usd: all.usd, krw: krwOf(all.usd), questions: all.questions,
      capKrw: AI_CHAT_MONTHLY_KRW,
      mine: { usd: mine.usd, krw: krwOf(mine.usd), questions: mine.questions },
    },
  });
}

/** 사람이 읽을 오류 — SDK 오류 종류로 가른다 (글자 비교 아님) */
function errorText(e: any): string {
  if (e instanceof Anthropic.AuthenticationError) return 'API 키가 맞지 않습니다. 서버의 ANTHROPIC_API_KEY 를 확인해 주세요.';
  if (e instanceof Anthropic.PermissionDeniedError) return '이 API 키로는 이 모델을 쓸 수 없습니다. Anthropic 콘솔에서 키 권한·결제를 확인해 주세요.';
  if (e instanceof Anthropic.NotFoundError) return `모델(${AI_CHAT_MODEL})을 찾지 못했습니다. AI_CHAT_MODEL 설정을 확인해 주세요.`;
  if (e instanceof Anthropic.RateLimitError) return '잠깐 사이에 요청이 많았습니다. 1분쯤 뒤에 다시 물어봐 주세요.';
  if (e instanceof Anthropic.BadRequestError) return `요청이 거절되었습니다: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return 'AI 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
  if (e instanceof Anthropic.APIError) return `AI 서버 오류 (${e.status ?? '?'}) — 잠시 뒤 다시 시도해 주세요.`;
  return String(e?.message || e || '알 수 없는 오류');
}

export async function POST(req: Request) {
  const { user, owner, res } = await who();
  if (!user) return res!;

  let body: any = {};
  try { body = await req.json(); } catch {}
  // 입력창 📎 로 올린 파일 — 메일 쓰기 첨부와 같은 조각 올리기로 받아 둔 번호 (5개까지)
  const uploadIds = normalizeUploadIds(body.uploads).slice(0, 5);
  // 파일만 올리고 질문을 비우면 — 정리해 달라는 뜻으로 받는다
  const question = String(body.message || '').trim() || (uploadIds.length ? '올린 파일을 확인하고 핵심을 정리해 주세요.' : '');
  if (!question) return NextResponse.json({ success: false, error: '질문을 입력해 주세요' }, { status: 400 });
  if (question.length > 4000) return NextResponse.json({ success: false, error: '질문이 너무 깁니다 (4,000자까지)' }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ success: false, error: '서버에 ANTHROPIC_API_KEY 가 설정되어 있지 않습니다.' }, { status: 503 });
  }

  await dbConnect();
  // 한 달 한도 — 질문하기 전에 본다
  const { all } = await monthSpend();
  if (krwOf(all.usd) >= AI_CHAT_MONTHLY_KRW) {
    return NextResponse.json({ success: false, error: OVER_LIMIT() }, { status: 429 });
  }
  let conv: any = null;
  if (body.conversationId) {
    if (!mongoose.isValidObjectId(body.conversationId)) return NextResponse.json({ success: false, error: '대화를 찾을 수 없습니다' }, { status: 404 });
    conv = await AiChat.findOne({ _id: body.conversationId, user }).lean();
    if (!conv) return NextResponse.json({ success: false, error: '대화를 찾을 수 없습니다' }, { status: 404 });
    // 다른 메일함을 읽던 대화(설정이 바뀐 경우)는 이어 가지 않는다 — 앞 대화에 남의 메일 내용이 들어 있다
    if (conv.mailbox && conv.mailbox !== owner) {
      return NextResponse.json({ success: false, error: '다른 메일함을 읽던 대화입니다. [+ 새 대화]로 시작해 주세요.' }, { status: 400 });
    }
    // 질문마다 앞 대화 전체를 다시 보낸다 — 너무 길어지면 느리고 비싸다
    const last = (conv.turns || [])[conv.turns.length - 1];
    if (last && last.lastInputTokens > MAX_CONTEXT_TOKENS) {
      return NextResponse.json({ success: false, error: '이 대화가 너무 길어졌습니다. [+ 새 대화]로 시작해 주세요.' }, { status: 400 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); } catch { /* 화면이 닫혔다 */ }
      };
      let files: PreparedFile[] = [];
      try {
        // 올린 파일 — 조각을 이어 붙여 Claude 가 읽을 수 있게 올리고(lib/ai/attachments.ts), 조각은 지운다
        if (uploadIds.length) {
          send({ type: 'status', text: '올린 파일 읽는 중' });
          const loaded = await loadUploads(user, uploadIds);
          if (!loaded.ok) { send({ type: 'error', message: loaded.error }); return; }
          files = await Promise.all(loaded.files.map((f) => prepareFile(f.content, f.filename, f.contentType)));
          await deleteUploads(user, uploadIds).catch(() => undefined);
          for (const f of files) send({ type: 'step', kind: 'file', text: `${f.name}${f.note ? ` — ${f.note}` : ''}` });
        }
        const r = await runMailChat({ owner, history: conv?.messages || [], question, model: body.model, files, emit: send, signal: req.signal });
        const now = new Date();
        const turn = { at: now, model: r.model, ...r.usage };
        const fileIds = [...files.map((f) => f.fileId || ''), ...r.fileIds].filter(Boolean);
        const shown: IAiChat['display'] = [
          { role: 'user', text: question, files: files.map((f) => ({ name: f.name, kind: f.kind, note: f.note || '' })), at: now },
          {
            role: 'assistant', text: r.answer, sources: r.sources, model: r.model, at: now,
            steps: [...files.map((f) => ({ kind: 'file', text: `${f.name}${f.note ? ` — ${f.note}` : ''}` })), ...r.steps],
          },
        ];
        let id = conv ? String(conv._id) : '';
        if (conv) {
          // 대화 원본은 뒤에 붙인 것으로 통째로 바꾼다 — 앞부분은 손대지 않았다 (mail-chat.ts)
          await AiChat.updateOne({ _id: conv._id, user }, {
            $set: { messages: r.messages },
            $push: { display: { $each: shown }, turns: turn, fileIds: { $each: fileIds } },
          });
        } else {
          const doc = await AiChat.create({
            user, mailbox: owner,
            title: question.replace(/\s+/g, ' ').slice(0, 40),
            messages: r.messages, display: shown, turns: [turn], fileIds,
          });
          id = String(doc._id);
        }
        await AiChatUsage.create({ user, at: now, model: r.model, conversationId: id, ...r.usage });
        send({ type: 'sources', items: r.sources });
        send({
          type: 'done', conversationId: id, model: r.model,
          usage: { usd: r.usage.usd, krw: krwOf(r.usage.usd), inputTokens: r.usage.inputTokens + r.usage.cacheRead + r.usage.cacheWrite, outputTokens: r.usage.outputTokens },
        });
      } catch (e: any) {
        // 답을 다 받기 전에 끊겨도(창을 닫았거나 오류) 그때까지 쓴 돈은 기록한다
        if (e?.usage?.usd > 0) {
          await AiChatUsage.create({ user, at: new Date(), model: pickModel(body.model), conversationId: conv ? String(conv._id) : '', ...e.usage, failed: true })
            .catch((err: any) => console.error('[ai-chat] usage log', err?.message || err));
        }
        // 기록에 남지 않는 질문이니 이번에 올린 파일도 지운다 (안 지우면 Anthropic 저장소에 주인 없이 남는다)
        deleteFiles([...files.map((f) => f.fileId || ''), ...(e?.fileIds || [])]).catch(() => undefined);
        if (!(e instanceof Anthropic.APIUserAbortError)) {
          console.error('[ai-chat]', e?.status || '', e?.message || e);
          send({ type: 'error', message: errorText(e) });
        }
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function DELETE(req: Request) {
  const { user, res } = await who();
  if (!user) return res!;
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: '대화를 찾을 수 없습니다' }, { status: 404 });
  await dbConnect();
  // 이 대화에서 Anthropic 에 올린 파일(첨부 읽기·올린 파일)도 함께 지운다
  const c: any = await AiChat.findOne({ _id: id, user }, { fileIds: 1 }).lean();
  if (c?.fileIds?.length) await deleteFiles(c.fileIds).catch(() => undefined);
  const r = await AiChat.deleteOne({ _id: id, user });
  return NextResponse.json({ success: r.deletedCount === 1 });
}
