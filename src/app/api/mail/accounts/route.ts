import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { listMailAccounts, summarize } from '@/lib/mail/accounts';
import { InboundMail } from '@/models/InboundMail';

export const runtime = 'nodejs';

/**
 * GET /api/mail/accounts — 메일함에서 고를 수 있는 계정 목록.
 *
 * 등록된 발송 계정(MailAccount)이 곧 수신 계정이다 —
 * 이카운트는 SMTP/IMAP 자격증명이 같아서 따로 등록할 필요가 없다.
 * 각 계정에 몇 통이 수집돼 있는지도 함께 준다(화면에서 바로 보이게).
 */
export async function GET() {
  try {
    await dbConnect();
    const accounts = await listMailAccounts();

    const counts = await InboundMail.aggregate([
      { $match: { trashedAt: null, direction: 'in' } },
      { $group: { _id: '$accountId', n: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>(counts.map((c: any) => [String(c._id), c.n]));

    return NextResponse.json({
      success: true,
      accounts: accounts.map((a: any) => ({
        ...summarize(a),
        mailCount: countMap.get(String(a._id)) || 0,
      })),
      // 계정 개념이 생기기 전 'main' 으로 저장된 메일 — 화면에서 안내가 필요하다
      legacyCount: countMap.get('main') || 0,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}
