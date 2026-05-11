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
  
  status: { type: String, default: 'New' },
  owner: { type: String, default: '' },
  lastContact: { type: String, default: '' },
  nextFollowUp: { type: String, default: '' },
  notes: { type: String, default: '' },
  favorite: { type: Boolean, default: false },
  importBatch: { type: String, default: '' },
  importedAt: { type: String, default: '' },
}, { timestamps: true });

export const Lead = mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
