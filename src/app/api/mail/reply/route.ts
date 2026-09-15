import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { InboundMail } from '@/models/InboundMail';
import { MailAccount } from '@/models/MailAccount';
import { sendMail } from '@/lib/mailer';
import { getMailScope, canUseAccount, UNAUTHORIZED, NOT_YOURS } from '@/lib/mail/scope';
import { resolveOutreachAccount } from '@/lib/mail/accounts';
import { moveRepliedToNegotiating } from '@/lib/mail/stage-on-reply';
import { buildSignatureBlock } from '@/lib/template-vars';
import { decryptSecret } from '@/lib/crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 답장을 **어느 계정으로** 보낼지 고른다 — 보낼 때(POST)와 서명 미리보기(GET)가 반드시 같은 규칙을 써야 한다.
 * 규칙이 둘로 갈리면 "미리보기 서명과 실제로 붙어 나간 서명이 다르다" 가 된다.
 *
 * 1) 화면이 고른 계정(내 것만)  2) 이 메일을 받은 계정 — 상대 메일함에서 같은 주소로 대화가 이어진다
 * 3) 내 기본 계정.  남의 계정으로는 보내지 않는다.
 */
async function pickReplyAccount(scope: any, mail: any, mailAccountId?: string): Promise<{ account: any; error?: string }> {
  if (mailAccountId) {
    const account = (await resolveOutreachAccount(String(mailAccountId), scope.user)).account;
    return account ? { account } : { account: null, error: '고른 보내는 계정을 쓸 수 없습니다' };
  }
  let account: any = null;
  if (/^[0-9a-f]{24}$/i.test(String(mail.accountId || ''))) {
    account = await MailAccount.findOne({ _id: mail.accountId, isActive: { $ne: false } }).lean();
  }
  if (!account) account = (await resolveOutreachAccount(undefined, scope.user)).account;
  return account ? { account } : { account: null, error: '발송할 메일 계정이 없습니다. 설정에서 등록하세요.' };
}

/**
 * GET /api/mail/reply?inboundMailId=… — 이 메일에 답장하면 **끝에 붙을 서명**을 미리 돌려준다.
 *
 * 화면이 들고 있는 계정 목록으로 서명을 그리면, 목록을 아직 안 불러온 화면(답장 받음에서 바로 대화를 연 경우)
 * 에서는 서명이 비어 보였다. 보낼 때와 같은 계정 고르기를 서버에서 그대로 돌려 결과만 준다.
 * 메일을 보내지 않는다.
 */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const scope = await getMailScope();
    if (!scope) return NextResponse.json(UNAUTHORIZED, { status: 401 });

    const url = new URL(req.url);
    const inboundMailId = String(url.searchParams.get('inboundMailId') || '').trim();
    if (!/^[0-9a-f]{24}$/i.test(inboundMailId)) {
      return NextResponse.json({ success: false, error: 'inboundMailId 필요' }, { status: 400 });
    }
    const mail: any = await InboundMail.findById(inboundMailId, { accountId: 1 }).lean();
    // 남의 메일은 없는 메일과 똑같이 404 — 응답이 다르면 그런 메일이 있다는 게 드러난다
    if (!mail || !canUseAccount(scope, mail.accountId)) return NextResponse.json(NOT_YOURS, { status: 404 });

    const { account, error } = await pickReplyAccount(scope, mail, url.searchParams.get('mailAccountId') || undefined);
    if (!account) return NextResponse.json({ success: false, error }, { status: 400 });

    return NextResponse.json({
      success: true,
      from: { name: account.fromName || '', address: account.fromAddress || account.smtpUser || '' },
      signatureHtml: buildSignatureBlock(account, { html: true }),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '서명을 불러오지 못했습니다' }, { status: 500 });
  }
}

/**
 * POST /api/mail/reply — 받은 메일에 스레드로 회신.
 *
 * 새 메일 발송(/api/mail/send)과 다른 점:
 *   - In-Reply-To / References 헤더를 붙여 **상대 메일함에서 같은 대화로 묶인다**.
 *     이게 없으면 상대에게는 뜬금없는 새 메일로 보이고, 우리 쪽에서도
 *     이후 답장이 스레드로 이어지지 않는다.
 *   - 발송 가드(3회 제한)를 적용하지 않는다. 상대가 먼저 보낸 메일에 답하는 것이라
 *     스팸이 될 수 없고, 오히려 막으면 대화가 끊긴다.
 *
 * Body: {
 *   inboundMailId: string,   // 어느 메일에 답하는지 (필수)
 *   body: string,            // 본문 (필수)
 *   subject?: string,        // 생략 시 "Re: 원문제목"
 *   mailAccountId?: string,  // 생략 시 기본 계정
 *   appendSignature?: boolean, // 기본 true
 * }
 */
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 });
  }

  const inboundMailId = String(body?.inboundMailId || '').trim();
  const text = String(body?.body || '').trim();
  if (!inboundMailId) return NextResponse.json({ success: false, error: 'inboundMailId 필요' }, { status: 400 });
  if (!text) return NextResponse.json({ success: false, error: '본문이 비어 있습니다' }, { status: 400 });

  try {
    await dbConnect();
    const scope = await getMailScope();
    if (!scope) return NextResponse.json(UNAUTHORIZED, { status: 401 });

    const mail: any = await InboundMail.findById(inboundMailId).lean();
    if (!mail) return NextResponse.json({ success: false, error: '원본 메일을 찾을 수 없습니다' }, { status: 404 });
    // 내 메일함에 온 메일에만 답할 수 있다 (아이디별 메일 분리 — lib/mail/scope.ts)
    if (!canUseAccount(scope, mail.accountId)) return NextResponse.json(NOT_YOURS, { status: 404 });

    // 받은 메일에 답하면 보낸 사람에게, **우리가 보낸 메일**에서 이어서 보내면 그 메일의 받는 사람(상대)에게 간다.
    // 보낸 메일의 from 은 우리 주소라, 그대로 쓰면 우리 자신에게 답장이 간다.
    const to = mail.direction === 'out'
      ? ((mail.to || []).find((t: any) => t?.address && !/@yogico\.kr$/i.test(t.address)) || (mail.to || [])[0])?.address
      : mail.from?.address;
    if (!to) return NextResponse.json({ success: false, error: '받을 주소를 찾을 수 없습니다' }, { status: 400 });

    // ── 발송 계정 ── (서명 미리보기 GET 과 같은 규칙 — pickReplyAccount)
    const picked = await pickReplyAccount(scope, mail, body?.mailAccountId);
    const account: any = picked.account;
    if (!account) return NextResponse.json({ success: false, error: picked.error }, { status: 400 });

    let smtpPass = '';
    try {
      smtpPass = decryptSecret(account.smtpPassEnc);
    } catch {
      return NextResponse.json({ success: false, error: '메일 계정 비밀번호 복호화 실패 — 계정을 다시 저장하세요.' }, { status: 500 });
    }

    // ── 제목: 이미 Re: 가 붙어 있으면 겹쳐 붙이지 않는다 ──
    const originalSubject = String(mail.subject || '').trim();
    const subject = String(body?.subject || '').trim()
      || (/^re\s*:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`);

    // ── 서명 ──
    // 계정 문서를 그대로 넘긴다 — SenderProfile 이 MailAccount 필드명을 쓴다
    // (fromName · senderTitle · senderPhone · senderCompany · senderAddress · senderWebsite)
    const appendSignature = body?.appendSignature !== false;
    const sigHtml = appendSignature ? buildSignatureBlock(account, { html: true }) : '';
    const sigText = appendSignature ? buildSignatureBlock(account, { html: false }) : '';

    // 회신 상자가 서식 편집기(contenteditable)면 본문이 이미 HTML 이다.
    // 그때도 escapeHtml 을 태우면 상대에게 <b>…</b> 가 글자 그대로 보인다.
    // 반대로 평문을 그냥 넣으면 줄바꿈이 사라지므로 pre-wrap 으로 감싼다.
    const bodyIsHtml = body?.bodyIsHtml === true;
    const inner = bodyIsHtml
      ? text
      : `<div style="white-space:pre-wrap">${escapeHtml(text)}</div>`;
    const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${inner}</div>${sigHtml}`;
    // 평문 대체본 — HTML 을 못 읽는 클라이언트용. 태그를 걷어내고 줄바꿈만 남긴다.
    const plain = bodyIsHtml
      ? text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, '').trim()
      : text;

    // ── 스레드 헤더 ──
    // References 는 기존 체인 + 원문 Message-ID 순서. 상대 메일 클라이언트가
    // 이걸 보고 같은 대화로 묶는다.
    const originalMsgId = String(mail.messageId || '').trim();
    const refs = [...(mail.references || []), originalMsgId].filter(Boolean);
    const headers: Record<string, string> = {};
    if (originalMsgId) {
      headers['In-Reply-To'] = originalMsgId;
      headers['References'] = refs.join(' ');
    }

    const result = await sendMail({
      to,
      subject,
      html: htmlBody,
      text: sigText ? `${plain}\n\n${sigText}` : plain,
      headers,
      smtpConfig: {
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        user: account.smtpUser,
        pass: smtpPass,
      },
      fromOverride: { name: account.fromName || '', address: account.fromAddress || account.smtpUser },
      sentCopyAccount: account,   // 보낸메일함에 사본을 남긴다 (lib/mail/sent-copy.ts)
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || '발송 실패' }, { status: 500 });
    }

    const now = new Date().toISOString();

    // ── 원본 메일을 '답변완료' 로 ──
    await InboundMail.updateOne(
      { _id: mail._id },
      { $set: { status: 'replied', 'analysis.needsReply': false, repliedAt: now } },
    );

    // ── 리드에 발송 이력 기록 ──
    // 여기 남겨야 대화 타임라인에 우리 회신이 함께 보이고,
    // 다음에 상대가 답장하면 이 messageId 로 다시 매칭된다.
    if (mail.leadId) {
      await Lead.updateOne(
        { leadId: mail.leadId },
        {
          $push: {
            emailHistory: {
              subject,
              body: text.slice(0, 500),
              to,
              sentAt: now,
              status: 'sent',
              messageId: result.messageId || '',
            },
          },
          $set: {
            lastEmailSentAt: now,
            needsReply: false,
          },
        },
      );
      // 답장 받은 업체에 우리가 다시 답했으면 → [대화 진행 중] (대표님 요청 2026-09-14)
      await moveRepliedToNegotiating(mail.leadId);
    }

    return NextResponse.json({
      success: true,
      to,
      subject,
      messageId: result.messageId,
      dryRun: Boolean(result.dryRun),
      threaded: Boolean(originalMsgId),
      leadId: mail.leadId || null,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '회신 실패' }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
