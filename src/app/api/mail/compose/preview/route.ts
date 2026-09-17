import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getMailScope, UNAUTHORIZED } from '@/lib/mail/scope';
import { composeNewMail } from '@/lib/mail/compose-new';

export const runtime = 'nodejs';

/**
 * POST /api/mail/compose/preview — 새 메일을 **보내기 전에 받는 사람이 볼 모습 그대로** 돌려준다.
 *
 * 실제 발송(POST /api/mail/compose)과 **같은 함수**로 조립한다 (lib/mail/compose-new.ts).
 *
 * ⚠ 이 파일은 메일 발송 모듈(lib/mailer)을 **불러오지 않는다** — 여기서는 어떤 값을 넣어도 메일이 나갈 수 없다.
 *    DB 에도 쓰지 않는다.
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
    const m = composed.mail;

    return NextResponse.json({
      success: true,
      preview: {
        from: m.from,
        to: m.to,
        subject: m.subject,
        html: m.html,
        text: m.text,
        signatureAppended: m.signatureAppended,
        isNew: true,             // 답장이 아니라 새 메일 — 미리보기 창이 [대화 연결] 줄을 빼는 기준
        lead: m.lead,            // 등록된 업체면 이름을 보여준다
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '미리보기를 만들지 못했습니다' }, { status: 500 });
  }
}
