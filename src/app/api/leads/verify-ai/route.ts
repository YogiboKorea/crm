import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { verifyWithAI } from '@/lib/verify-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/leads/verify-ai
 * Body: { scope?: 'suspicious' | 'all-unverified' | 'leadIds', leadIds?: string[], limit?: number }
 *
 * 휴리스틱이 '의심(suspicious)'으로 분류한 케이스만 LLM 정밀 검증.
 * onlyUnverified 옵션처럼 hasMore=true 면 다음 청크 호출.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 });
  }

  const scope: 'suspicious' | 'all-unverified' | 'leadIds' = body?.scope || 'suspicious';
  const leadIds: string[] | undefined = body?.leadIds;
  const limit = Math.min(Math.max(parseInt(body?.limit, 10) || 20, 1), 50);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  try {
    await dbConnect();
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: `DB 연결 실패: ${e?.message || 'unknown'}` },
      { status: 500 },
    );
  }

  try {
    // 필터 결정
    const filter: any = {};
    if (Array.isArray(leadIds) && leadIds.length) {
      filter.leadId = { $in: leadIds };
    } else if (scope === 'suspicious') {
      // 자동 검증 끝났고(verifiedAt 있음) AI 검증 안 된(aiVerifiedAt 비어있음) 의심 케이스
      filter['verification.verifiedAt'] = { $exists: true, $ne: '' };
      filter['verification.score'] = { $gte: 3, $lte: 4 };
      filter.$or = [
        { 'verification.aiVerifiedAt': { $exists: false } },
        { 'verification.aiVerifiedAt': '' },
      ];
    } else if (scope === 'all-unverified') {
      // AI 검증 안 된 모든 항목
      filter.$or = [
        { 'verification.aiVerifiedAt': { $exists: false } },
        { 'verification.aiVerifiedAt': '' },
      ];
    }

    const totalRemaining = await Lead.countDocuments(filter);
    const targets = await Lead.find(filter)
      .select(
        'leadId Company Country Type BrandsChannels Evidence RoleMemo notes ' +
        'WebsiteContact verification.businessEvidence verification.businessKeywords',
      )
      .sort({ 'verification.aiVerifiedAt': 1 })
      .limit(limit)
      .lean();

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        remaining: 0,
        hasMore: false,
        results: [],
      });
    }

    // 동시 실행 — 청크 내 병렬 (Anthropic API 자체 throttle)
    const results = await Promise.all(
      targets.map(async (lead: any) => {
        const verdict = await verifyWithAI({
          Company: lead.Company || '',
          Country: lead.Country,
          Type: lead.Type,
          BrandsChannels: lead.BrandsChannels,
          Evidence: lead.Evidence,
          RoleMemo: lead.RoleMemo,
          notes: lead.notes,
          WebsiteContact: lead.WebsiteContact,
          siteTitle: lead.verification?.businessEvidence?.title,
          siteDescription: lead.verification?.businessEvidence?.description,
          matchedKeywords: lead.verification?.businessKeywords || [],
        });
        return { leadId: lead.leadId, company: lead.Company, verdict };
      }),
    );

    // DB 일괄 업데이트
    const now = new Date().toISOString();
    const ops = results
      .filter((r) => r.verdict)
      .map((r) => ({
        updateOne: {
          filter: { leadId: r.leadId },
          update: {
            $set: {
              'verification.aiVerdict': r.verdict!.verdict,
              'verification.aiConfidence': r.verdict!.confidence,
              'verification.aiReasoning': r.verdict!.reasoning,
              'verification.aiSignals': r.verdict!.signals,
              'verification.aiVerifiedAt': now,
            },
          },
        },
      }));

    if (ops.length > 0) {
      await Lead.bulkWrite(ops, { ordered: false });
    }

    const remaining = Math.max(totalRemaining - targets.length, 0);

    return NextResponse.json({
      success: true,
      processed: results.length,
      remaining,
      hasMore: remaining > 0,
      results: results.map((r) => ({
        leadId: r.leadId,
        company: r.company,
        verdict: r.verdict?.verdict ?? null,
        confidence: r.verdict?.confidence ?? null,
        reasoning: r.verdict?.reasoning ?? null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'unknown error' },
      { status: 500 },
    );
  }
}
