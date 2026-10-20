import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { sendMail } from '@/lib/mailer';
import { getMailScope, UNAUTHORIZED } from '@/lib/mail/scope';
import { composeNewMail } from '@/lib/mail/compose-new';
import { decryptSecret } from '@/lib/crypto';
import { normalizeUploadIds, loadUploads, deleteUploads } from '@/lib/mail/uploads';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/mail/compose — [✏ 새 메일 쓰기] (2026-09-17, 대표님 요청).
 *
 * 주소를 직접 적어 **새 메일 한 통**을 보낸다. 발송 관리(양식·여러 업체)도, 답장도 아니다.
 *
 * 왜 이 앱에서 보내야 하나: 아웃룩에서 보내면 이카운트 보낸메일함에 사본이 안 남는다.
 * 여기서 보내면 lib/mail/sent-copy.ts 가 사본을 반드시 남긴다 — "보냈는데 안 보인다" 가 없어진다.
 *
 * ⚠ 자동 발송 가드(하루 한도·48시간 재발송 금지·업체당 3회)는 **적용하지 않는다**.
 *    그 규칙은 목록을 보고 한꺼번에 나가는 발송을 막기 위한 것이고, 이건 사람이 한 통씩 직접 쓰는 메일이다.
 *    대신 받는 주소가 등록된 업체면 **발송 이력에 남겨** 대화 이력과 발송 횟수에 그대로 반영한다.
 *
 * Body: { to, cc?, bcc?, subject, body, bodyIsHtml?, mailAccountId?, appendSignature?, attachments? }
 *   to · cc · bcc   "a@x.com, b@y.com" 처럼 여러 명 (합쳐 20명까지 — lib/mail/compose-new.ts)
 *   attachments     먼저 올려 둔 첨부의 번호 목록 (api/mail/upload). 하나라도 못 찾으면 보내지 않는다.
 */
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 });
  }

  try {
    await dbConnect();
    const scope = await getMailScope();
    if (!scope) return NextResponse.json(UNAUTHORIZED, { status: 401 });

    const composed = await composeNewMail(scope, body);
    if (!composed.ok) return NextResponse.json(composed.payload, { status: composed.status });
    const { account, toList, cc, bcc, subject, html, text, bodySource, from, lead, leads } = composed.mail;

    // 첨부 — 하나라도 못 붙이면 보내지 않는다 ("첨부 드립니다" 라고 쓴 메일이 빈손으로 나가면 되돌릴 수 없다)
    const uploadIds = normalizeUploadIds(body?.attachments);
    const loaded = await loadUploads(scope.user, uploadIds);
    if (!loaded.ok) return NextResponse.json({ success: false, error: loaded.error }, { status: 400 });

    let smtpPass = '';
    try {
      smtpPass = decryptSecret(account.smtpPassEnc);
    } catch {
      return NextResponse.json({ success: false, error: '메일 계정 비밀번호 복호화 실패 — 계정을 다시 저장하세요.' }, { status: 500 });
    }

    const result = await sendMail({
      to: toList,
      cc,
      bcc,
      subject,
      html,
      text,
      attachments: loaded.files.map((f) => ({ filename: f.filename, content: f.content, contentType: f.contentType })),
      smtpConfig: {
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        user: account.smtpUser,
        pass: smtpPass,
      },
      fromOverride: from,
      sentCopyAccount: account,   // 보낸메일함에 사본을 남긴다
    });

    if (!result.ok) {
      // 첨부는 지우지 않는다 — 고쳐서 다시 [보내기] 하면 그대로 쓴다 (2시간 뒤 저절로 지워진다)
      return NextResponse.json({ success: false, error: result.error || '발송 실패' }, { status: 500 });
    }

    // 보냈으니 맡겨 둔 첨부 조각은 지운다 — 사본은 이카운트 보낸메일함에 있다
    await deleteUploads(scope.user, uploadIds).catch(() => { /* 못 지워도 2시간 뒤 저절로 지워진다 */ });

    // 등록된 업체에 보냈으면 그 업체 이력에 남긴다 — [대화 보기] 에 함께 보이고, 답장이 오면 이 메일에 붙는다.
    // 받는 사람·참조에 업체가 여럿이면 각각에 남긴다 (숨은참조는 compose-new 에서 이미 뺐다)
    const now = new Date().toISOString();
    for (const l of leads) {
      await Lead.updateOne(
        { leadId: l.leadId },
        {
          $push: {
            emailHistory: {
              subject,
              body: bodySource.slice(0, 500),
              to: l.email,
              sentAt: now,
              status: 'sent',
              messageId: result.messageId || '',
            },
          },
          $set: { lastEmailSentAt: now },
        },
      );
    }

    return NextResponse.json({
      success: true,
      to: toList.join(', '),
      cc,
      bcc,
      attachments: loaded.files.map((f) => ({ filename: f.filename, size: f.size })),
      subject,
      messageId: result.messageId,
      dryRun: Boolean(result.dryRun),
      savedToSent: result.savedToSent !== false,
      lead: lead || null,
      leads,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '발송 실패' }, { status: 500 });
  }
}
