import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { InboundMail } from '@/models/InboundMail';

export const runtime = 'nodejs';

/**
 * POST /api/mail/trash — 메일을 휴지통으로 보내거나 되돌린다.
 *
 * **DB 에서 지우지 않는다.** 이 앱은 광고·자동발송을 자동 분류하는데
 * 그 판정이 틀릴 수 있다. 지금은 틀려도 라벨만 바뀌지만, 영구 삭제를 붙이면
 * 오판이 곧 자료 소실이 되고 되돌릴 방법이 없다.
 *
 * Body: { mailIds: string[], restore?: boolean }
 */
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 });
  }

  const ids: string[] = Array.isArray(body?.mailIds) ? body.mailIds : [];
  if (!ids.length) {
    return NextResponse.json({ success: false, error: 'mailIds 필요' }, { status: 400 });
  }
  const restore = body?.restore === true;

  try {
    await dbConnect();
    const r = await InboundMail.updateMany(
      { _id: { $in: ids } },
      { $set: { trashedAt: restore ? null : new Date() } },
    );
    return NextResponse.json({
      success: true,
      moved: r.modifiedCount,
      action: restore ? 'restored' : 'trashed',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '처리 실패' }, { status: 500 });
  }
}

/** GET /api/mail/trash — 휴지통 통수 */
export async function GET() {
  try {
    await dbConnect();
    const count = await InboundMail.countDocuments({ trashedAt: { $ne: null } });
    return NextResponse.json({ success: true, count });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}
