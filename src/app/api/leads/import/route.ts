import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';

export const runtime = 'nodejs';
export const maxDuration = 60;

function makeBatchId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `import-${y}${mo}${d}-${h}${mi}`;
}

const TRIM_FIELDS = [
  'Country', 'Company', 'Priority', 'Type', 'Evidence', 'BrandsChannels',
  'LinkedInCompany', 'BuyerContact', 'ContactLinkedIn', 'RoleMemo',
  'WebsiteContact', 'Email', 'Phone', 'Address', 'Approach', 'Sources',
  'Checked', 'Confidence', 'Title', 'owner', 'lastContact', 'nextFollowUp',
  'notes',
] as const;

function sanitize(lead: any) {
  const out: Record<string, any> = {};
  for (const k of TRIM_FIELDS) out[k] = (lead?.[k] || '').toString().trim();
  out.status = (lead?.status || 'New').toString().trim();
  out.favorite = lead?.favorite === true || lead?.favorite === 'true';
  return out;
}

export async function POST(req: Request) {
  // Body parsing — separate try/catch so a bad payload returns JSON, not HTML
  let body: any;
  try {
    body = await req.json();
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: `요청 본문 파싱 실패: ${e?.message || 'invalid JSON'}` },
      { status: 400 },
    );
  }

  const { leads, duplicateAction } = body || {};
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ success: false, error: 'No leads provided' }, { status: 400 });
  }

  try {
    await dbConnect();
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: `DB 연결 실패: ${e?.message || 'unknown'}` },
      { status: 500 },
    );
  }

  const batchId = makeBatchId();
  const importedAt = new Date().toISOString();

  let inserted = 0;
  let skipped = 0;
  let updated = 0;
  const errors: string[] = [];

  try {
    // 1) Look up all existing leads in ONE round trip
    const lookupKeys = leads
      .map((l: any) => ({
        Company: (l?.Company || '').toString().trim(),
        Country: (l?.Country || '').toString().trim(),
      }))
      .filter((k) => k.Company);

    const existingDocs = lookupKeys.length
      ? await Lead.find({ $or: lookupKeys }).select('_id Company Country').lean()
      : [];

    const existingMap = new Map<string, any>();
    for (const doc of existingDocs as any[]) {
      const key = `${doc.Country || ''}::${doc.Company || ''}`;
      existingMap.set(key, doc);
    }

    // 2) Build bulk operations
    const ops: any[] = [];
    leads.forEach((lead: any, idx: number) => {
      try {
        const clean = sanitize(lead);
        if (!clean.Company) {
          errors.push(`row ${idx + 1}: Company 누락`);
          return;
        }

        const key = `${clean.Country}::${clean.Company}`;
        const existing = existingMap.get(key);

        if (existing) {
          if (duplicateAction === 'overwrite') {
            ops.push({
              updateOne: {
                filter: { _id: existing._id },
                update: { $set: { ...clean, importBatch: batchId, importedAt } },
              },
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          const newLeadId = `lead-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
          ops.push({
            insertOne: {
              document: { ...clean, leadId: newLeadId, importBatch: batchId, importedAt },
            },
          });
          inserted++;
        }
      } catch (e: any) {
        errors.push(`row ${idx + 1} (${lead?.Company || 'Unknown'}): ${e?.message || 'sanitize error'}`);
      }
    });

    // 3) Execute bulk write — single round trip, ordered:false continues on individual errors
    if (ops.length > 0) {
      try {
        await Lead.bulkWrite(ops, { ordered: false });
      } catch (e: any) {
        // bulkWrite with ordered:false still throws if any op fails — extract real counts
        const writeErrors = e?.writeErrors || [];
        for (const we of writeErrors) {
          errors.push(`bulk error: ${we?.errmsg || we?.message || 'unknown'}`);
        }
        // Adjust counts: subtract failed ops from inserted/updated
        const result = e?.result || e;
        const realInserted = result?.nInserted ?? result?.insertedCount;
        const realUpdated = result?.nModified ?? result?.modifiedCount;
        if (typeof realInserted === 'number') inserted = realInserted;
        if (typeof realUpdated === 'number') updated = realUpdated;
      }
    }

    return NextResponse.json({
      success: true,
      batchId,
      summary: { inserted, updated, skipped, errors: errors.length },
      errors: errors.slice(0, 50),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'unknown error' },
      { status: 500 },
    );
  }
}
