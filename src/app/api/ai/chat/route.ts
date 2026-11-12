import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { getSessionUser, UNAUTHORIZED } from '@/lib/mail/scope';
import { AiChat, type IAiChat } from '@/models/AiChat';
import { AiChatUsage } from '@/models/AiChatUsage';
import { canUseAiChat, AI_CHAT_MAILBOX_OWNER } from '@/lib/ai/chat-access';
import { runMailChat, pickModel, AI_CHAT_MODEL, AI_CHAT_MODELS, AI_CHAT_MONTHLY_KRW, MAX_CONTEXT_TOKENS, krwOf } from '@/lib/ai/mail-chat';
import { KST_OFFSET_MS } from '@/lib/mail/period';
import { InboundMail } from '@/models/InboundMail';
import { accountIdsForOwner } from '@/lib/mail/scope';
import { loadMailBody } from '@/lib/mail/body';

export const runtime = 'nodejs';
// 메일을 여러 통 찾아 읽으면 한 번 답하는 데 수십 초가 걸린다
export const maxDuration = 300;

/**
 * 🤖 AI 메일 비서 (lib/ai/mail-chat.ts) — 대표님 전용 (lib/ai/chat-access.ts).
 *
 * GET    /api/ai/chat           → 내 대화 목록 · 이번 달 사용량 · 고를 수 있는 모델
 * GET    /api/ai/chat?id=…      → 대화 하나 (화면에 보일 질문·답·근거 메일)
 * GET    /api/ai/chat?mail=…    → 근거 메일 한 통 (팝업용, 읽기만) — 읽는 메일함 안의 것만
 * POST   /api/ai/chat           → { conversationId?, message } — 답을 한 줄씩(JSON) 흘려 보낸다
 *                                  status(찾는 중) · text(답 글자) · sources(근거 메일) · done · error
 * DELETE /api/ai/chat?id=…      → 대화 지우기 (내 것만)
 */
const FORBIDDEN = { success: false, error: 'AI 메일 비서는 대표님 아이디에서만 쓸 수 있습니다.' };

async function who(): Promise<{ user: string | null; res?: NextResponse }> {
  const user = await getSessionUser();
  if (!user) return { user: null, res: NextResponse.json(UNAUTHORIZED, { status: 401 }) };
  if (!canUseAiChat(user)) return { user: null, res: NextResponse.json(FORBIDDEN, { status: 403 }) };
  return { user };
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
  const { user, res } = await who();
  if (!user) return res!;
  await dbConnect();
  const id = new URL(req.url).searchParams.get('id');
  const mailId = new URL(req.url).searchParams.get('mail');

  // 근거 메일 팝업 — AI 가 읽는 메일함(대표님) 안의 메일만. 메일함 주인이 아닌 아이디(시험용 admin)도
  // 답에 나온 메일을 열어 볼 수 있게 하는 읽기 전용 창이다 (메일 화면 API 는 자기 메일함만 연다).
  if (mailId) {
    if (!mongoose.isValidObjectId(mailId)) return NextResponse.json({ success: false, error: '메일을 찾을 수 없습니다' }, { status: 404 });
    const ids = await accountIdsForOwner(AI_CHAT_MAILBOX_OWNER);
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

  const [list, spend] = await Promise.all([
    AiChat.find({ user }, { title: 1, updatedAt: 1, 'turns.usd': 1 }).sort({ updatedAt: -1 }).limit(40).lean(),
    monthSpend(),
  ]);
  // 청구는 아이디와 상관없이 한 키로 나간다 — 전체와 내 것을 같이 보여준다
  const { all } = spend;
  const mine = spend.rows.find((m: any) => m._id === user) || { usd: 0, questions: 0 };
  return NextResponse.json({
    success: true,
    user,
    model: AI_CHAT_MODEL,
    defaultModel: AI_CHAT_MODEL,
    models: AI_CHAT_MODELS,
    mailboxOwner: AI_CHAT_MAILBOX_OWNER,
    canOpenMails: user === AI_CHAT_MAILBOX_OWNER,   // 근거 메일 열기는 메일함 주인만 (다른 아이디는 메일 화면 범위 밖)
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
  const { user, res } = await who();
  if (!user) return res!;

  let body: any = {};
  try { body = await req.json(); } catch {}
  const question = String(body.message || '').trim();
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
      try {
        const r = await runMailChat({ history: conv?.messages || [], question, model: body.model, emit: send, signal: req.signal });
        const now = new Date();
        const turn = { at: now, model: r.model, ...r.usage };
        const shown: IAiChat['display'] = [
          { role: 'user', text: question, at: now },
          { role: 'assistant', text: r.answer, sources: r.sources, steps: r.steps, model: r.model, at: now },
        ];
        let id = conv ? String(conv._id) : '';
        if (conv) {
          // 대화 원본은 뒤에 붙인 것으로 통째로 바꾼다 — 앞부분은 손대지 않았다 (mail-chat.ts)
          await AiChat.updateOne({ _id: conv._id, user }, { $set: { messages: r.messages }, $push: { display: { $each: shown }, turns: turn } });
        } else {
          const doc = await AiChat.create({
            user, mailbox: AI_CHAT_MAILBOX_OWNER,
            title: question.replace(/\s+/g, ' ').slice(0, 40),
            messages: r.messages, display: shown, turns: [turn],
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
  const r = await AiChat.deleteOne({ _id: id, user });
  return NextResponse.json({ success: r.deletedCount === 1 });
}
