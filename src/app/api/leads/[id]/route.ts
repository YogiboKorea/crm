import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Lead } from '@/models/Lead';

/**
 * GET /api/leads/[id] — 리드 1건 전문.
 *
 * 목록 API 는 5천 건을 한 번에 내려주느라 프로젝션으로 칸을 줄인다
 * (Evidence·Sources 는 한 건에 수백 자라 전부 실으면 응답이 수 MB 가 된다).
 * 그래서 상세 화면이 목록 캐시를 읽으면 업종·근거·출처가 빈칸으로 보였다.
 * DB 에는 값이 있는데 화면에만 없던 것이라, 상세는 여기서 따로 읽는다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await dbConnect();
    const lead = await Lead.findById(id).lean();
    if (!lead) {
      return NextResponse.json({ success: false, error: '리드를 찾을 수 없습니다' }, { status: 404 });
    }
    return NextResponse.json({ success: true, lead });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    await dbConnect();
    const lead = await Lead.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: lead });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    await dbConnect();
    const lead = await Lead.findByIdAndDelete(id);
    
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
