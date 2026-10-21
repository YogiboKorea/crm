import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { EmailTemplate } from '@/models/EmailTemplate';
import { TEMPLATE_VARS, TEMPLATE_VAR_GROUPS } from '@/lib/template-vars';
import { ensureStepTemplates } from '@/lib/mail/template-steps';

export const runtime = 'nodejs';

/**
 * GET  /api/email-templates          → 전체 목록 + 사용 가능한 변수 정보
 * POST /api/email-templates          → 막아 둠 — 양식은 1·2·3차 세 칸으로 고정 (lib/mail/template-steps.ts)
 */
export async function GET() {
  try {
    await dbConnect();
    // 1·2·3차 칸이 비어 있으면 채운다 (쓰던 양식을 옮기거나 예시로) — 이미 있는 문구는 그대로
    await ensureStepTemplates();
    const templates = await EmailTemplate.find({}).sort({ step: 1, updatedAt: -1 }).lean();
    return NextResponse.json({
      success: true,
      templates,
      // UI 에디터가 변수 chip 렌더링에 사용
      variables: TEMPLATE_VARS.map((v) => ({
        key: v.key,
        label: v.label,
        example: v.example,
        description: v.description,
        group: v.group,
      })),
      variableGroups: TEMPLATE_VAR_GROUPS,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown' }, { status: 500 });
  }
}

export async function POST() {
  // 양식은 1차 첫 소개 · 2차 팔로우업 · 3차 마지막 팔로우업 세 개로 정해 두고 고치기만 한다 (2026-10-21 요청).
  // 새로 만들 수 있으면 같은 용도 양식이 쌓여 "답이 없을 때 어느 문구가 나가지" 를 알 수 없게 된다.
  // 빈 칸은 GET 이 채운다 (ensureStepTemplates).
  return NextResponse.json(
    { success: false, error: '메일 양식은 1차·2차·3차 세 개로 정해져 있습니다. 새로 만들지 말고 해당 차수 양식을 고쳐 주세요.' },
    { status: 400 },
  );
}
