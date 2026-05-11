import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';

// Generate a human-readable batch ID from current time
function makeBatchId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `import-${y}${mo}${d}-${h}${mi}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { leads, duplicateAction } = body; // duplicateAction: 'skip' | 'overwrite'

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ success: false, error: 'No leads provided' }, { status: 400 });
    }

    await dbConnect();

    const batchId = makeBatchId();
    const importedAt = new Date().toISOString();

    let inserted = 0;
    let skipped = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        if (!lead.leadId) {
          lead.leadId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        }

        // Always tag with batch info
        lead.importBatch = batchId;
        lead.importedAt = importedAt;

        const existing = await Lead.findOne({
          Company: lead.Company,
          Country: lead.Country,
        });

        if (existing) {
          if (duplicateAction === 'overwrite') {
            await Lead.updateOne({ _id: existing._id }, { $set: lead });
            updated++;
          } else {
            skipped++;
          }
        } else {
          await Lead.create(lead);
          inserted++;
        }
      } catch (err: any) {
        errors.push(`${lead.Company}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      batchId,
      summary: { inserted, updated, skipped, errors: errors.length },
      errors,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
