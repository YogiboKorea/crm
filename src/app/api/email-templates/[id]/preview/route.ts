import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { EmailTemplate } from '@/models/EmailTemplate';
import { Lead } from '@/models/Lead';
import { renderTemplate } from '@/lib/mailer';
import { buildVarsFromLead, buildExampleVars } from '@/lib/template-vars';

export const runtime = 'nodejs';

/**
 * POST /api/email-templates/:id/preview
 * Body: { leadId?: string }
 *   leadId 있으면 → 해당 리드 값으로 치환
 *   leadId 없으면 → 예시 값으로 치환 (에디터 미리보기용)
 * 반환: { subject, body, bodyIsHtml, missing: string[] (치환 안 된 변수) }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await dbConnect();
    const t: any = await EmailTemplate.findById(id).lean();
    if (!t) return NextResponse.json({ success: false, error: 'template not found' }, { status: 404 });

    let vars: Record<string, string>;
    let leadInfo: any = null;
    const body = await req.json().catch(() => ({}));
    const leadId = body?.leadId as string | undefined;

    if (leadId) {
      const lead = await Lead.findOne({ leadId }).lean() as any;
      if (!lead) return NextResponse.json({ success: false, error: 'lead not found' }, { status: 404 });
      vars = buildVarsFromLead(lead);
      leadInfo = { leadId: lead.leadId, company: lead.Company, country: lead.Country, email: lead.Email };
    } else {
      vars = buildExampleVars();
    }

    const subject = renderTemplate(t.subject, vars);
    const bodyRendered = renderTemplate(t.body, vars);

    // 치환되지 않은 변수 감지 (미리보기 후에도 {{X}} 남아있으면 리스트)
    const missing: string[] = [];
    const re = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
    let m;
    while ((m = re.exec(subject + '\n' + bodyRendered)) !== null) {
      if (!missing.includes(m[1])) missing.push(m[1]);
    }

    return NextResponse.json({
      success: true,
      subject,
      body: bodyRendered,
      bodyIsHtml: !!t.bodyIsHtml,
      missing,
      leadInfo,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown' }, { status: 500 });
  }
}
