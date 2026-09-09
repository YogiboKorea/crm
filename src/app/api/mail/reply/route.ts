import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { InboundMail } from '@/models/InboundMail';
import { MailAccount } from '@/models/MailAccount';
import { sendMail } from '@/lib/mailer';
import { buildSignatureBlock } from '@/lib/template-vars';
import { decryptSecret } from '@/lib/crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    const mail: any = await InboundMail.findById(inboundMailId).lean();
    if (!mail) return NextResponse.json({ success: false, error: '원본 메일을 찾을 수 없습니다' }, { status: 404 });

    const to = mail.from?.address;
    if (!to) return NextResponse.json({ success: false, error: '원본 메일에 발신 주소가 없습니다' }, { status: 400 });

    // ── 발송 계정 ──
    const account: any = body?.mailAccountId
      ? await MailAccount.findById(body.mailAccountId).lean()
      : await MailAccount.findOne({ isDefault: true, isActive: true }).lean()
        || await MailAccount.findOne({ isActive: true }).lean();
    if (!account) {
      return NextResponse.json({ success: false, error: '발송할 메일 계정이 없습니다. 설정에서 등록하세요.' }, { status: 400 });
    }

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
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || '발송 실패' }, { status: 500 });
    }

    const now = new Date().toISOString();

    // ── 원본 메일을 '답변완료' 로 ──
    await InboundMail.updateOne(
      { _id: mail._id },
      { $set: { status: 'replied', 'analysis.needsReply': false } },
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
