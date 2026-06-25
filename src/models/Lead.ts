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
  },
}, { timestamps: true });

export const Lead = mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
