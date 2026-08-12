import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // 기본을 50,000 으로 (실질적으로 전체 반환). 필요시 ?limit=N 으로 명시적 축소 가능.
    // countDocuments 도 함께 반환해서 클라이언트가 truncation 여부 판단 가능.
    const limit = parseInt(searchParams.get('limit') || '50000');

    await dbConnect();
    const [leads, total] = await Promise.all([
      Lead.find({}).limit(limit).sort({ createdAt: -1 }),
      Lead.countDocuments({}),
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
