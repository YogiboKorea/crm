import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { InboundMail } from '@/models/InboundMail';
import { Lead } from '@/models/Lead';
import { getMailSettings } from '@/lib/mail-settings';
import { analyzeMail } from '@/lib/ai/analyze-mail';
import { estimateMailCost, estimateBatchCost, actualCost } from '@/lib/ai/estimate';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/mail/analyze — 수신 메일 AI 분석 (번역 + 요약 + 기한).
 *
 * **유료 경로.** 메일 1통 = Claude 1회 호출.
 * 비용이 튀지 않도록 세 겹으로 막는다:
 *   1) 광고·자동발송·자사발신은 애초에 대상에서 제외
 *   2) 이미 AI 분석된 메일은 다시 하지 않음
 *   3) 한 번에 처리할 통수를 설정의 dailyAnalyzeLimit 로 제한
 *
 * Body: {
 *   mailIds?: string[],   // 지정 시 그 메일만 (화면에서 개별 실행)
 *   limit?: number,       // 미지정 시 설정의 dailyAnalyzeLimit
 *   estimateOnly?: boolean, // true 면 API 호출 없이 예상 비용만 (과금 0)
 * }
 */
export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* 본문 없이도 동작 */ }

  try {
    await dbConnect();
    const settings = await getMailSettings();
    const model = settings.claudeModel || 'claude-haiku-4-5';
    const limit = Math.min(
      Math.max(1, Number(body?.limit) || Number(settings.dailyAnalyzeLimit) || 20),
      100,
    );

    // ── 대상 선정 ──
    let targets: any[];
    if (Array.isArray(body?.mailIds) && body.mailIds.length) {
      targets = await InboundMail.find({ _id: { $in: body.mailIds } }).lean();
    } else {
      targets = await InboundMail.find({
        // 광고·자동발송은 사람이 읽을 것이 아니므로 번역할 이유가 없다
        classification: { $nin: ['ad', 'system'] },
        // 우리가 보낸 메일은 '할 일'이 아니라 기록이다
        direction: { $ne: 'out' },
        trashedAt: null,
        // 이미 AI 로 분석한 것은 건너뛴다 (로컬 분석만 된 것이 대상)
        'analysis.method': { $ne: 'ai' },
      })
        // 최신부터. 오래된 것부터 하면 밀린 물량을 다 씹을 때까지
        // 오늘 온 메일이 요약되지 않는다.
        .sort({ date: -1 })
        .limit(limit)
        .lean();
    }

    if (!targets.length) {
      return NextResponse.json({ success: true, analyzed: 0, remaining: 0, message: '분석할 메일이 없습니다.' });
    }

    // ── 예상 비용만 (과금 없음) ──
    if (body?.estimateOnly) {
      const est = estimateBatchCost(targets, model);
      return NextResponse.json({
        success: true,
        estimateOnly: true,
        count: targets.length,
        estimate: est,
        perMail: targets.slice(0, 5).map((m: any) => ({
          id: String(m._id),
          subject: m.subject,
          ...estimateMailCost(m, model, true),
        })),
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'ANTHROPIC_API_KEY 미설정 — .env.local 에 넣어야 AI 기능이 동작합니다.' },
        { status: 400 },
      );
    }

    // ── 리드 회사명 붙이기 (프롬프트 맥락) ──
    const leadIds = [...new Set(targets.map((m: any) => m.leadId).filter(Boolean))];
    const leadMap = new Map<string, string>();
    if (leadIds.length) {
      const leads = await Lead.find({ leadId: { $in: leadIds } }, { leadId: 1, Company: 1 }).lean();
      leads.forEach((l: any) => leadMap.set(l.leadId, l.Company));
    }

    const results: any[] = [];
    let analyzed = 0;
    let failed = 0;
    let totalKrw = 0;

    // 순차 처리 — 동시에 던지면 rate limit 에 걸리고, 실패 시 어디까지 됐는지도 흐려진다
    for (const mail of targets) {
      try {
        const enriched = { ...mail, leadCompany: leadMap.get(mail.leadId) || '' };
        const r = await analyzeMail(enriched, settings);

        const set: any = {
          lang: r.lang,
          translation: r.translation,
          analysis: r.analysis,
        };
        // 사람이 수동으로 분류한 것은 AI 가 덮지 않는다
        if (mail.classifiedBy !== 'manual') {
          set.classification = r.classification;
          set.classifiedBy = 'ai';
        }
        await InboundMail.updateOne({ _id: mail._id }, { $set: set });

        // 리드의 회신 필요 지표도 AI 판정으로 갱신
        if (mail.leadId) {
          const leadSet: any = { needsReply: Boolean(r.analysis.needsReply) };
          if (r.analysis.deadline) leadSet.replyDeadline = new Date(r.analysis.deadline).toISOString();
          await Lead.updateOne({ leadId: mail.leadId }, { $set: leadSet });
        }

        const cost = actualCost(r.analysis.usage, r.analysis.model);
        totalKrw += cost?.krw || 0;
        analyzed++;
        results.push({
          id: String(mail._id),
          subject: mail.subject,
          classification: r.classification,
          topic: r.analysis.topic,
          needsReply: r.analysis.needsReply,
          urgency: r.analysis.urgency,
          krw: cost?.krw || 0,
        });
      } catch (e: any) {
        failed++;
        results.push({ id: String(mail._id), subject: mail.subject, error: String(e?.message || e) });
      }
    }

    const remaining = await InboundMail.countDocuments({
      classification: { $nin: ['ad', 'system'] },
      direction: { $ne: 'out' },
      trashedAt: null,
      'analysis.method': { $ne: 'ai' },
    });

    return NextResponse.json({
      success: failed === 0,
      analyzed,
      failed,
      remaining,
      model,
      totalKrw,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '분석 실패' }, { status: 500 });
  }
}

/** GET /api/mail/analyze — 분석 대기 통수와 예상 비용 (API 호출 없음 · 과금 0) */
export async function GET() {
  try {
    await dbConnect();
    const settings = await getMailSettings();
    const model = settings.claudeModel || 'claude-haiku-4-5';

    const pending = await InboundMail.find({
      classification: { $nin: ['ad', 'system'] },
      direction: { $ne: 'out' },
      trashedAt: null,
      'analysis.method': { $ne: 'ai' },
    })
      .sort({ date: -1 })
      .limit(Number(settings.dailyAnalyzeLimit) || 20)
      .lean();

    const total = await InboundMail.countDocuments({
      classification: { $nin: ['ad', 'system'] },
      direction: { $ne: 'out' },
      trashedAt: null,
      'analysis.method': { $ne: 'ai' },
    });

    return NextResponse.json({
      success: true,
      pendingTotal: total,
      batchSize: pending.length,
      dailyLimit: Number(settings.dailyAnalyzeLimit) || 20,
      hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
      estimate: estimateBatchCost(pending, model),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}
