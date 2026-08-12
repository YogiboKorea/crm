import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { verifyWithAI } from '@/lib/verify-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/leads/verify-ai
 * Body: {
 *   scope?: 'suspicious' | 'all-unverified' | 'verifying-stage' | 'leadIds',
 *   leadIds?: string[],
 *   limit?: number,
 *   excludeKorea?: boolean,     // default true (한국 기업 제외)
 *   autoMoveStage?: boolean,    // default true — AI 결과에 따라 stage 자동 이동
 * }
 *
 * scope='verifying-stage' → stage='verifying' 이고 AI 미검증인 리드 대상 (검증 대기 파이프라인)
 * autoMoveStage=true 면:
 *   beauty-buyer → stage='verified'
 *   not-buyer    → stage='archived'
 *   maybe        → stage='verifying' 유지 (사람이 판단)
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 });
  }

  const scope: 'suspicious' | 'all-unverified' | 'verifying-stage' | 'leadIds' = body?.scope || 'suspicious';
  const leadIds: string[] | undefined = body?.leadIds;
  const limit = Math.min(Math.max(parseInt(body?.limit, 10) || 20, 1), 50);
  const excludeKorea: boolean = body?.excludeKorea !== false;
  const autoMoveStage: boolean = body?.autoMoveStage !== false;

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
    } else if (scope === 'verifying-stage') {
      // stage='verifying' 이고 AI 미검증 — 새 파이프라인의 1차 검증 대기 풀
      filter.stage = 'verifying';
      filter.$or = [
        { 'verification.aiVerifiedAt': { $exists: false } },
        { 'verification.aiVerifiedAt': '' },
      ];
    } else if (scope === 'maybe-recheck') {
      // stage='verifying' + AI verdict='maybe' 재검증 (모호 판정 재분류)
      filter.stage = 'verifying';
      filter['verification.aiVerdict'] = 'maybe';
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

    // 한국 기업 제외 (사용자 요청)
    if (excludeKorea) {
      filter.Country = { $not: /korea|^kr$|대한민국|한국/i };
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

    // DB 일괄 업데이트 — AI 결과 저장 + stage 자동 이동
    const now = new Date().toISOString();
    const stageMoves = { verified: 0, archived: 0, kept: 0 };
    const ops = results
      .filter((r) => r.verdict)
      .map((r) => {
        const set: any = {
          'verification.aiVerdict': r.verdict!.verdict,
          'verification.aiConfidence': r.verdict!.confidence,
          'verification.aiReasoning': r.verdict!.reasoning,
          'verification.aiSignals': r.verdict!.signals,
          'verification.aiVerifiedAt': now,
          updatedInfoAt: now,
        };
        // AI 판정에 따라 stage 자동 이동 (요청: 검증대기 → AI 통과 → 검증완료)
        if (autoMoveStage) {
          if (r.verdict!.verdict === 'beauty-buyer') {
            set.stage = 'verified';
            set.stageChangedAt = now;
            stageMoves.verified++;
          } else if (r.verdict!.verdict === 'not-buyer') {
            set.stage = 'archived';
            set.stageChangedAt = now;
            set.readyForOutreach = false;
            stageMoves.archived++;
          } else {
            // maybe → 검증대기 유지
            stageMoves.kept++;
          }
        }
        return {
          updateOne: {
            filter: { leadId: r.leadId },
            update: { $set: set },
          },
        };
      });

    if (ops.length > 0) {
      await Lead.bulkWrite(ops, { ordered: false });
    }

    const remaining = Math.max(totalRemaining - targets.length, 0);

    return NextResponse.json({
      success: true,
      processed: results.length,
      remaining,
      hasMore: remaining > 0,
      autoMoveStage,
      stageMoves: autoMoveStage ? stageMoves : undefined,
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
