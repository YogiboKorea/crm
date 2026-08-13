import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';

// 리스트 뷰에서 필요한 필드만 프로젝션 — 5MB+ 감소, 3~5x 응답 속도 개선
// 상세 뷰는 개별 조회 (모달) 시 전체 필드 반환.
const LIST_PROJECTION = {
  // 기본 리드 정보
  leadId: 1, Company: 1, Country: 1, Priority: 1, Type: 1,
  BuyerContact: 1, Title: 1, Email: 1, Phone: 1,
  WebsiteContact: 1, LinkedInCompany: 1,
  // CRM 상태
  status: 1, owner: 1, lastContact: 1, nextFollowUp: 1,
  favorite: 1, importBatch: 1, importedAt: 1,
  registeredAt: 1, updatedInfoAt: 1,
  // 파이프라인 stage
  stage: 1, stageChangedAt: 1, becamePartnerAt: 1, readyForOutreach: 1,
  // 크롤링 정보 (배지 표시용)
  crawledEmails: 1, crawledAt: 1,
  // 발송 이력은 요약만 (길이) — 상세는 상세뷰
  lastEmailSentAt: 1,
  // 검증 정보 (배지/툴팁 표시용)
  'verification.emailValid': 1, 'verification.websiteAlive': 1,
  'verification.phoneMatch': 1, 'verification.linkedinValid': 1,
  'verification.businessLevel': 1, 'verification.score': 1,
  'verification.verifiedAt': 1,
  'verification.aiVerdict': 1, 'verification.aiConfidence': 1,
  'verification.aiReasoning': 1, 'verification.aiVerifiedAt': 1,
  // 텍스트 큰 필드 (Evidence, Approach, Sources, BrandsChannels 등)는 리스트에서 안 씀 → 제외
  createdAt: 1, updatedAt: 1, deleted: 1,
} as const;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // 기본을 50,000 으로 (실질적으로 전체 반환). 필요시 ?limit=N 으로 명시적 축소 가능.
    const limit = parseInt(searchParams.get('limit') || '50000');
    // full=1 이면 모든 필드 반환 (Export 등에서 사용)
    const full = searchParams.get('full') === '1';

    await dbConnect();
    const query = Lead.find({})
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();  // ← mongoose hydration 스킵 → 5x 빠름
    if (!full) query.select(LIST_PROJECTION);

    const [leads, total] = await Promise.all([
      query.exec(),
      Lead.estimatedDocumentCount(),  // countDocuments 대비 훨씬 빠름
    ]);

    return NextResponse.json({ success: true, data: leads, total });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await dbConnect();
    
    // Auto-generate leadId if not provided
    if (!body.leadId) {
      body.leadId = `lead-${Date.now()}`;
    }
    
    const lead = await Lead.create(body);
    return NextResponse.json({ success: true, data: lead });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
