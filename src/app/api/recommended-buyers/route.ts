import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { RECOMMENDED_BUYERS } from '@/data/recommended-buyers';

export const runtime = 'nodejs';

// GET — 추천 리스트 + 어떤 게 이미 import 되었는지 표시
export async function GET() {
  try {
    await dbConnect();
    const existing = await Lead.find({
      Company: { $in: RECOMMENDED_BUYERS.map((b) => b.company) },
    })
      .select('leadId Company Country')
      .lean();

    const existingKey = new Set(
      existing.map((l: any) => `${l.Company}::${l.Country}`),
    );

    const data = RECOMMENDED_BUYERS.map((b) => ({
      ...b,
      imported: existingKey.has(`${b.company}::${b.country}`),
    }));

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'unknown' },
      { status: 500 },
    );
  }
}

// POST — 추천 리스트의 회사들을 leads 컬렉션으로 import
// Body: { companies: string[] }  — 선택된 회사명들만 추가
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 });
  }

  const selected: string[] = Array.isArray(body?.companies) ? body.companies : [];
  const toImport = selected.length
    ? RECOMMENDED_BUYERS.filter((b) => selected.includes(b.company))
    : RECOMMENDED_BUYERS;

  if (toImport.length === 0) {
    return NextResponse.json({ success: false, error: '선택된 항목이 없습니다.' }, { status: 400 });
  }

  try {
    await dbConnect();
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: `DB 연결 실패: ${e?.message || 'unknown'}` },
      { status: 500 },
    );
  }

  try {
    // 중복 체크 (Company + Country)
    const existing = await Lead.find({
      $or: toImport.map((b) => ({ Company: b.company, Country: b.country })),
    })
      .select('Company Country')
      .lean();
    const existingKey = new Set(
      existing.map((l: any) => `${l.Company}::${l.Country}`),
    );

    const importedAt = new Date().toISOString();
    const batchId = `recommended-${Date.now()}`;
    let inserted = 0;
    let skipped = 0;
    const ops: any[] = [];

    for (const b of toImport) {
      const key = `${b.company}::${b.country}`;
      if (existingKey.has(key)) {
        skipped++;
        continue;
      }
      const leadId = `lead-rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      ops.push({
        insertOne: {
          document: {
            leadId,
            Country: b.country,
            Company: b.company,
            Priority: b.priority,
            Type: b.type,
            BrandsChannels: b.brandsChannels,
            Evidence: b.evidence,
            WebsiteContact: b.website,
            LinkedInCompany: b.linkedin || '',
            Sources: b.source,
            Email: '',
            Phone: '',
            BuyerContact: '',
            ContactLinkedIn: '',
            RoleMemo: '',
            Address: '',
            Approach: '추천 리스트(자동 발굴) — 사이트 통해 컨택 폼/이메일 확인 필요',
            Checked: importedAt.slice(0, 10),
            Confidence: 'Web-curated 2026-06',
            Title: '',
            status: 'New',
            owner: '',
            lastContact: '',
            nextFollowUp: '',
            notes: `K-beauty 추천 시드 — 리젼: ${b.region}`,
            favorite: false,
            importBatch: batchId,
            importedAt,
          },
        },
      });
      inserted++;
    }

    if (ops.length > 0) {
      await Lead.bulkWrite(ops, { ordered: false });
    }

    return NextResponse.json({
      success: true,
      summary: { inserted, skipped, total: toImport.length },
      batchId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'unknown' },
      { status: 500 },
    );
  }
}
