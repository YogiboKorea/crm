import { NextResponse } from 'next/server';
import { sendMail, verifySmtp } from '@/lib/mailer';

export const runtime = 'nodejs';

/**
 * GET  /api/mail/test        → 연결/인증만 확인 (실제 발송 X, DRY_RUN 무시)
 * POST /api/mail/test        → 실제 테스트 발송. Body: { to, subject?, text? }
 *                              MAIL_DRY_RUN=1 이면 로그만.
 */
export async function GET() {
  const result = await verifySmtp();
  return NextResponse.json({ success: result.ok, ...result });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 });
  }

  const to = body?.to;
  if (!to || typeof to !== 'string') {
    return NextResponse.json({ success: false, error: 'to 필수' }, { status: 400 });
  }

  const result = await sendMail({
    to,
    subject: body?.subject || '[Yogico CRM] SMTP 테스트 발송',
    text: body?.text || 'This is a test email from Yogico CRM. If you received this, SMTP setup is working.',
  });

  return NextResponse.json({
    success: result.ok,
    ...result,
  });
}
