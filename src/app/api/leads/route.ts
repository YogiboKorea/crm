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
    const limit = parseInt(searchParams.get('limit') || '50000');
    const full = searchParams.get('full') === '1';
    const stage = searchParams.get('stage');
    const sub = searchParams.get('sub');
    const tier = searchParams.get('tier');   // 'A' | 'B' | 'C' (verified 전용)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));

    const filter: any = {};
    if (stage === '__failed') {
      filter.stage = 'archived';
      filter['verification.aiVerdict'] = 'not-buyer';
    } else if (stage) {
      filter.stage = stage;
    }
    if (stage === 'verifying') {
      if (sub === 'unverified') {
        filter.$or = [
          { 'verification.aiVerifiedAt': { $exists: false } },
          { 'verification.aiVerifiedAt': '' },
        ];
      } else if (sub === 'maybe') {
        filter['verification.aiVerdict'] = 'maybe';
      }
    } else if (stage === 'verified') {
      if (sub === 'approved') filter.readyForOutreach = true;
      else if (sub === 'pending') filter.readyForOutreach = { $ne: true };
      else if (sub === 'no-email') {
        filter.$or = [{ Email: '' }, { Email: /^Not found/i }, { Email: { $exists: false } }];
      }
    }

    await dbConnect();

    // ── tier 필터 (verified 전용, 계산 필드라 별도 처리) ──
    if (stage === 'verified' && (tier === 'A' || tier === 'B' || tier === 'C')) {
      const { getLeadTier } = await import('@/lib/lead-tier');
      const allMatching = await Lead.find(filter, { Company: 1, Email: 1, WebsiteContact: 1 }).lean();
      const matchIds = allMatching.filter((l) => getLeadTier(l as any) === tier).map((l) => l._id);
      const tierFilter = { ...filter, _id: { $in: matchIds } };
      const skip = (page - 1) * limit;
      const query = Lead.find(tierFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
      if (!full) query.select(LIST_PROJECTION);
      const leads = await query.exec();
      const total = matchIds.length;
      return NextResponse.json({
        success: true,
        data: leads,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    }

    const skip = (page - 1) * limit;
    const query = Lead.find(filter)
      .sort({ createdAt: -1 })
      .skip(stage ? skip : 0)
      .limit(limit)
      .lean();
    if (!full) query.select(LIST_PROJECTION);

    const [leads, total] = await Promise.all([
      query.exec(),
      stage ? Lead.countDocuments(filter) : Lead.estimatedDocumentCount(),
    ]);

    return NextResponse.json({
      success: true,
      data: leads,
      total,
      page: stage ? page : 1,
      limit,
      totalPages: stage ? Math.max(1, Math.ceil(total / limit)) : 1,
    });
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
