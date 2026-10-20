import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { InboundMail } from '@/models/InboundMail';
import { getMailScope, mailFilter, UNAUTHORIZED } from '@/lib/mail/scope';
import { composeNewMail } from '@/lib/mail/compose-new';
import { describeUploads, normalizeUploadIds } from '@/lib/mail/uploads';
import { checkDraft } from '@/lib/mail/draft-checks';
import { reviewDraft } from '@/lib/ai/review-draft';
import { actualCost } from '@/lib/ai/estimate';
import { getMailSettings } from '@/lib/mail-settings';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/mail/compose/review — [🤖 AI 검토] 보내기 전 점검 (2026-10-20, 대표님 요청).
 *
 * 두 단계:
 *   1) 규칙 점검 (무료 · 항상) — lib/mail/draft-checks.ts
 *   2) AI 검토 (유료 · AI 키가 있을 때) — lib/ai/review-draft.ts
 *      받는 사람들과 **최근 주고받은 메일**을 DB 에서 꺼내 같이 넘겨, 숫자·날짜·조건이 어긋나는지 본다.
 *
 * 보내지 않는다 (메일 발송 모듈을 불러오지 않는다). DB 에도 쓰지 않는다.
 * Body: [보내기] 와 같은 값 { to, cc, bcc, subject, body, bodyIsHtml, mailAccountId, attachments }
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

    // [보내기] 와 같은 함수로 조립·검사한다 — 주소가 틀렸으면 검토 전에 그것부터 알려 준다
    const composed = await composeNewMail(scope, body);
    if (!composed.ok) return NextResponse.json(composed.payload, { status: composed.status });
    const m = composed.mail;

    const files = await describeUploads(scope.user, normalizeUploadIds(body?.attachments));
    const attachmentNames = files.filter((f) => f.filename).map((f) => f.filename);
    const bodyText = htmlToText(String(body?.body || ''), body?.bodyIsHtml === true);

    const ruleIssues = checkDraft({
      from: m.from.address, to: m.toList, cc: m.cc, bcc: m.bcc,
      subject: m.subject, bodyText, attachmentNames,
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ success: true, checks: ruleIssues, ai: null, aiNote: 'AI 키가 설정되지 않아 규칙 점검만 했습니다.' });
    }

    // 이 상대들과 최근 주고받은 메일 — 내 메일함 안에서만 (lib/mail/scope.ts)
    // 바깥 업체 주소를 우선한다: 참조에 우리 직원(hoon@ 등)이 있으면 그 사람과의 사내 메일이 6통을 다 채워
    // 정작 대조해야 할 거래처 메일이 빠졌다 (2026-10-20 시험에서 확인). 사내끼리 보내는 메일이면 전부 쓴다.
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const myDomain = String(m.from.address.split('@')[1] || '').toLowerCase();
    const everyone = [...m.toList, ...m.cc];
    const outside = everyone.filter((a) => String(a.split('@')[1] || '').toLowerCase() !== myDomain);
    const addrRx = (outside.length ? outside : everyone).map((a) => new RegExp(`^${esc(a)}$`, 'i'));
    const recentDocs: any[] = await InboundMail.find(
      {
        ...mailFilter(scope),
        trashedAt: null,
        $or: [{ 'from.address': { $in: addrRx } }, { 'to.address': { $in: addrRx } }, { 'cc.address': { $in: addrRx } }],
      },
      { subject: 1, date: 1, direction: 1, from: 1, bodyStripped: 1, 'raw.text': 1, 'analysis.summary': 1, 'analysis.keyPoints': 1 },
    ).sort({ date: -1 }).limit(6).lean();

    const recent = recentDocs.map((d) => ({
      date: d.date ? new Date(d.date).toISOString().slice(0, 10) : '',
      direction: (d.direction === 'out' ? 'out' : 'in') as 'in' | 'out',
      from: d.from?.address || '',
      subject: d.subject || '',
      summary: [d.analysis?.summary, ...(d.analysis?.keyPoints || [])].filter(Boolean).join(' / ').slice(0, 900),
      body: String(d.bodyStripped || d.raw?.text || '').replace(/\s+\n/g, '\n').slice(0, 1500),
    }));

    let ai: any = null;
    let aiError = '';
    try {
      const settings = await getMailSettings();
      const r = await reviewDraft({
        from: m.from.address, to: m.toList, cc: m.cc, bcc: m.bcc,
        subject: m.subject, bodyText, attachmentNames,
        companies: m.leads.map((l) => l.company).filter(Boolean),
        recent,
      }, settings);
      ai = {
        verdict: r.verdict,
        summaryKo: r.summaryKo,
        issues: r.issues,
        revisedBody: r.revisedBody,
        contextMails: recent.length,
        model: r.model,
        krw: actualCost(r.usage, r.model)?.krw || 0,
      };
    } catch (e: any) {
      // AI 가 실패해도 규칙 점검 결과는 보여준다
      aiError = e?.message || 'AI 검토 실패';
    }

    return NextResponse.json({ success: true, checks: ruleIssues, ai, aiError });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '검토 실패' }, { status: 500 });
  }
}

/** 서식 편집기의 HTML 을 사람이 읽는 글로 — 줄바꿈은 살린다 */
function htmlToText(source: string, isHtml: boolean): string {
  if (!isHtml) return source.trim();
  return source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
