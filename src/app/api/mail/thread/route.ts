import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { InboundMail } from '@/models/InboundMail';

export const runtime = 'nodejs';

/**
 * GET /api/mail/thread?leadId=xxx — 한 리드의 메일 대화 타임라인
 *
 * **이 앱을 합친 이유가 되는 화면.**
 *   - 보낸 메일은 Lead.emailHistory 에 있고 (아웃바운드 CRM)
 *   - 받은 메일은 InboundMail 에 있다 (인바운드 메일함)
 * 둘을 시간순으로 엮어 "무슨 얘기가 오갔나"를 한 줄기로 보여준다.
 * 어느 한쪽 앱만으로는 만들 수 없는 화면이다.
 *
 * 응답: { lead, timeline: [{direction:'out'|'in', ...}], stats }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId 필요' }, { status: 400 });
    }

    await dbConnect();

    const lead: any = await Lead.findOne({ leadId }).lean();
    if (!lead) {
      return NextResponse.json({ success: false, error: '리드를 찾을 수 없음' }, { status: 404 });
    }

    // ── 받은 메일 (본문 포함 — 대화를 읽어야 하므로) ──
    const inbound: any[] = await InboundMail.find(
      { leadId },
      { 'raw.html': 0 },   // HTML 원문은 무거워서 제외 (상세 조회에서 별도)
    ).sort({ date: 1 }).lean();

    // ── 보낸 메일 (emailHistory) ──
    const sent = (lead.emailHistory || [])
      .filter((h: any) => h && h.status === 'sent')
      .map((h: any) => ({
        direction: 'out' as const,
        at: h.sentAt,
        subject: h.subject || '',
        body: h.body || '',
        to: h.to || '',
        messageId: h.messageId || '',
        templateId: h.templateId || '',
        scheduledFor: h.scheduledFor || '',
      }));

    // ── 받은 메일 → 타임라인 항목 ──
    const received = inbound.map((m: any) => ({
      direction: 'in' as const,
      at: m.date ? new Date(m.date).toISOString() : m.receivedAt,
      _id: String(m._id),
      subject: m.subject || '',
      // 인용부를 걷어낸 본문을 우선 보여준다 — 이전 대화가 통째로 딸려오면 읽을 수가 없다
      body: m.bodyStripped || m.raw?.text || '',
      bodyFull: m.raw?.text || '',
      hasQuoted: Boolean(m.bodyStripped && m.raw?.text && m.bodyStripped.length < m.raw.text.length),
      from: m.from || {},
      lang: m.lang || '',
      classification: m.classification || 'unknown',
      matchedBy: m.leadMatchedBy || null,
      status: m.status || 'new',
      needsReply: m.analysis?.needsReply ?? null,
      deadline: m.analysis?.deadline || null,
      deadlineText: m.analysis?.deadlineText || '',
      urgency: m.analysis?.urgency || null,
      // AI 분석 결과 (유료 경로를 돌린 메일만 채워진다)
      analyzedBy: m.analysis?.method || null,
      topic: m.analysis?.topic || '',
      summary: m.analysis?.summary || '',
      keyPoints: m.analysis?.keyPoints || [],
      intent: m.analysis?.intent || '',
      suggestedAction: m.analysis?.suggestedAction || '',
      translation: m.translation?.body || '',
      translationSubject: m.translation?.subject || '',
      attachments: (m.attachments || []).filter((a: any) => !a.inline),
      folder: m.folder,
      uid: m.uid,
    }));

    // 시간순 정렬 (오래된 것 → 최신, 대화 흐름대로)
    const timeline = [...sent, ...received].sort(
      (a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime(),
    );

    // 아직 안 지난 기한 중 가장 이른 것
    const now = Date.now();
    const futureDeadlines = received
      .map((r) => r.deadline)
      .filter(Boolean)
      .map((d: any) => new Date(d))
      .filter((d: Date) => d.getTime() >= now)
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());

    const lastIn = received.length ? received[received.length - 1] : null;

    return NextResponse.json({
      success: true,
      lead: {
        leadId: lead.leadId,
        Company: lead.Company,
        Country: lead.Country,
        Email: lead.Email,
        BuyerContact: lead.BuyerContact,
        WebsiteContact: lead.WebsiteContact,
        stage: lead.stage,
        stageChangedAt: lead.stageChangedAt,
        inboundCount: lead.inboundCount || 0,
        lastInboundAt: lead.lastInboundAt || '',
        needsReply: lead.needsReply || false,
      },
      timeline,
      stats: {
        sentCount: sent.length,
        receivedCount: received.length,
        // 마지막이 상대 메일이면 우리가 답할 차례다
        awaitingOurReply: Boolean(lastIn && timeline[timeline.length - 1]?.direction === 'in'),
        needsReply: Boolean(lastIn?.needsReply),
        nearestDeadline: futureDeadlines[0]?.toISOString() || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}
