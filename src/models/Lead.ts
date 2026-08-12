import mongoose, { Schema, Document } from 'mongoose';

export interface ILead extends Document {
  leadId: string;
  Country: string;
  Company: string;
  Priority: string;
  Type: string;
  Evidence: string;
  BrandsChannels: string;
  LinkedInCompany: string;
  BuyerContact: string;
  ContactLinkedIn: string;
  RoleMemo: string;
  WebsiteContact: string;
  Email: string;
  Phone: string;
  Address: string;
  Approach: string;
  Sources: string;
  Checked: string;
  Confidence: string;
  Title: string;
  
  // Custom CRM fields
  status: string;
  owner?: string;
  lastContact?: string;
  nextFollowUp?: string;
  notes?: string;
  favorite?: boolean;

  // Import tracking
  importBatch?: string;   // e.g. "import-20260511-092006"
  importedAt?: string;    // ISO date string
  registeredAt?: string;  // 신규 등록 timestamp (중복 아닌 진짜 신규만)
  updatedInfoAt?: string; // 회사 정보 마지막 업데이트 시각

  // 워크플로 stage — 파이프라인 핵심 상태 (좌 → 우 순서로 진행)
  //   imported    : 엑셀 업로드만 됨 (검증 안 함)
  //   verifying   : 검증 진행 중
  //   verified    : 검증 통과 = 컨택 대상 대기열
  //   contacted   : 첫 B2B 메일 발송 완료 (응답 대기)
  //   replied     : 상대방 답장 옴 (팔로우업 필요)
  //   negotiating : 미팅/샘플/조건 협상 중
  //   partner     : 계약 성사 = 최종 완료 (자동 메일 발송 대상에서 자동 제외)
  //   archived    : 무효/폐기
  stage?: 'imported' | 'verifying' | 'verified' | 'contacted' | 'replied' | 'negotiating' | 'partner' | 'archived';
  stageChangedAt?: string;
  becamePartnerAt?: string;    // 파트너 성사 시각 (최종 완료 timestamp)
  readyForOutreach?: boolean;  // 발송 승인 게이트 — verified 후 대표가 승인해야 자동 발송 대상

  // 웹사이트에서 크롤링한 이메일 (원본 Email 필드와 별개)
  crawledEmails?: string[];
  crawledAt?: string;

  // B2B 메일 발송 이력
  emailHistory?: Array<{
    subject: string;
    body?: string;        // 본문 요약 (전체는 EmailTemplate 참조)
    templateId?: string;  // 사용된 템플릿 ID
    to: string;           // 수신 이메일
    sentAt: string;       // 실제 발송 시각
    scheduledFor?: string;// 예약된 시각
    status: 'sent' | 'scheduled' | 'failed' | 'canceled';
    error?: string;
  }>;
  lastEmailSentAt?: string;  // 마지막 발송 시각 (파트너로 이동 시 자동 필드)

  // Verification (자동 정합성 검증 결과)
  verification?: {
    emailValid?: boolean | null;     // null = 미검사
    emailReason?: string;            // 실패 사유 (syntax/no-mx/disposable)
    websiteAlive?: boolean | null;
    websiteStatus?: number;          // HTTP status 또는 0(unreachable)
    phoneMatch?: boolean | null;     // 국가코드 매칭
    phoneReason?: string;            // unknown-country/too-short/expected +N
    linkedinValid?: boolean | null;
    linkedinReason?: string;         // format
    // 사업 관련성 (K-beauty)
    businessLevel?: 'relevant' | 'unclear' | 'unrelated' | null;
    businessScore?: number;          // 0~3
    businessKeywords?: string[];     // 매칭된 키워드 샘플
    businessReason?: string;         // no-url / fetch-failed / invalid-url
    businessEvidence?: {
      title?: string;                // <title> 추출
      description?: string;          // <meta description> 추출
      h1?: string;                   // 첫 <h1> 추출
      titleHit?: string;             // 타이틀 매칭 키워드
      metaHit?: string;              // 메타 매칭 키워드
    };
    score?: number;                  // 종합 0~5 (4 정합성 + 1 관련성)
    verifiedAt?: string;             // ISO
    // AI 정밀 검증 (Claude API)
    aiVerdict?: 'beauty-buyer' | 'maybe' | 'not-buyer' | null;
    aiConfidence?: 'high' | 'medium' | 'low' | null;
    aiReasoning?: string;            // 한국어 1~2문장
    aiSignals?: string[];            // 판단 근거
    aiVerifiedAt?: string;           // ISO
  };
}

const LeadSchema: Schema = new Schema({
  leadId: { type: String, required: true, unique: true },
  Country: { type: String, default: '' },
  Company: { type: String, default: '' },
  Priority: { type: String, default: '' },
  Type: { type: String, default: '' },
  Evidence: { type: String, default: '' },
  BrandsChannels: { type: String, default: '' },
  LinkedInCompany: { type: String, default: '' },
  BuyerContact: { type: String, default: '' },
  ContactLinkedIn: { type: String, default: '' },
  RoleMemo: { type: String, default: '' },
  WebsiteContact: { type: String, default: '' },
  Email: { type: String, default: '' },
  Phone: { type: String, default: '' },
  Address: { type: String, default: '' },
  Approach: { type: String, default: '' },
  Sources: { type: String, default: '' },
  Checked: { type: String, default: '' },
  Confidence: { type: String, default: '' },
  Title: { type: String, default: '' },
  
  status: { type: String, default: 'New' },
  owner: { type: String, default: '' },
  lastContact: { type: String, default: '' },
  nextFollowUp: { type: String, default: '' },
  notes: { type: String, default: '' },
  favorite: { type: Boolean, default: false },
  importBatch: { type: String, default: '' },
  importedAt: { type: String, default: '' },
  registeredAt: { type: String, default: '' },
  updatedInfoAt: { type: String, default: '' },

  // 새 파이프라인 stage
  stage: {
    type: String,
    enum: ['imported', 'verifying', 'verified', 'contacted', 'replied', 'negotiating', 'partner', 'archived'],
    default: 'imported',
  },
  stageChangedAt: { type: String, default: '' },
  becamePartnerAt: { type: String, default: '' },
  readyForOutreach: { type: Boolean, default: false },

  // 크롤링한 이메일
  crawledEmails: { type: [String], default: [] },
  crawledAt: { type: String, default: '' },

  // B2B 메일 발송 이력
  emailHistory: {
    type: [{
      subject: String,
      body: String,
      templateId: String,
      to: String,
      sentAt: String,
      scheduledFor: String,
      status: { type: String, enum: ['sent', 'scheduled', 'failed', 'canceled'] },
      error: String,
    }],
    default: [],
  },
  lastEmailSentAt: { type: String, default: '' },

  verification: {
    emailValid: { type: Schema.Types.Mixed, default: null },
    emailReason: { type: String, default: '' },
    websiteAlive: { type: Schema.Types.Mixed, default: null },
    websiteStatus: { type: Number, default: 0 },
    phoneMatch: { type: Schema.Types.Mixed, default: null },
    phoneReason: { type: String, default: '' },
    linkedinValid: { type: Schema.Types.Mixed, default: null },
    linkedinReason: { type: String, default: '' },
    businessLevel: { type: Schema.Types.Mixed, default: null },
    businessScore: { type: Number, default: 0 },
    businessKeywords: { type: [String], default: [] },
    businessReason: { type: String, default: '' },
    businessEvidence: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      h1: { type: String, default: '' },
      titleHit: { type: String, default: '' },
      metaHit: { type: String, default: '' },
    },
    score: { type: Number, default: 0 },
    verifiedAt: { type: String, default: '' },
    aiVerdict: { type: Schema.Types.Mixed, default: null },
    aiConfidence: { type: Schema.Types.Mixed, default: null },
    aiReasoning: { type: String, default: '' },
    aiSignals: { type: [String], default: [] },
    aiVerifiedAt: { type: String, default: '' },
  },
}, { timestamps: true });

export const Lead = mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
