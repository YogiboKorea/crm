import { EmailTemplate } from '@/models/EmailTemplate';

/**
 * 메일 양식 1차·2차·3차 (2026-10-21 요청).
 *
 * 양식은 이 세 칸으로 **고정**한다. 화면에서는 새로 만들거나 지우지 않고 고치기만 한다 —
 * 양식이 여러 개 쌓이면 "답이 없을 때 어느 문구가 나가지" 를 아무도 모르게 된다.
 *
 *   1차 첫 소개          — [발송 관리] 에서 처음 보낼 때
 *   2차 팔로우업          — 1차 뒤 정한 날만큼 답이 없으면 자동으로 (1차 메일의 답장으로)
 *   3차 마지막 팔로우업    — 2차 뒤 또 답이 없으면 자동으로. 같은 곳에 보내는 마지막 메일이다
 *
 * 몇 번째 메일인지는 업체에 실제로 나간 횟수로 정한다 (lib/mail/follow-up.ts).
 * 답장이 오면 그 자리에서 멈춘다.
 */
export const TEMPLATE_STEPS = [
  {
    step: 1 as const,
    label: '1차 첫 소개',
    purpose: 'intro' as const,
    // 이미 고쳐 쓰던 양식이 있으면 그 문구를 그대로 이 칸으로 옮긴다 — 예시로 덮어쓰지 않는다
    adopt: (t: any) => t.purpose === 'intro',
    name: '1차 첫 소개 — 해외 유통사용',
    subject: 'Direct K-beauty sourcing for [회사명]',
    body: [
      '<p>Dear [회사명] Team,</p>',
      '<p>I am reaching out from Yogi Corporation in Seoul. We help overseas distributors source K-beauty <strong>directly from Korean brand owners</strong>, instead of through trade vendors.</p>',
      '<p>Working with us, you get:</p>',
      '<ul><li>Direct brand access, with earlier access to new launches, samples and FOC</li>',
      '<li>One local partner for sourcing, negotiation, compliance documents (CPNP / FDA) and consolidated shipping</li>',
      '<li>Small first orders. No full-container volume is required</li></ul>',
      '<p>If this is relevant to [회사명], I would be happy to send our brand portfolio and price list.</p>',
      '<p>Thank you for your time.</p>',
    ].join('\n'),
  },
  {
    step: 2 as const,
    label: '2차 팔로우업',
    purpose: 'followup' as const,
    adopt: (t: any) => t.purpose === 'followup' && !/3\s*차/.test(String(t.name || '')),
    name: '2차 팔로우업 — 답장 없을 때',
    subject: 'Following up — K-beauty supply for [회사명]',
    body: [
      '<p>Dear [회사명] team,</p>',
      '<p>I wrote to you recently about K-beauty supply from Korea and wanted to follow up briefly, in case my earlier note got buried.</p>',
      '<p>To make it easier, here is the short version:</p>',
      '<ul><li>We ship directly from Korean manufacturers to your warehouse</li>',
      '<li>Documentation (CPNP / FDA) is handled on our side</li>',
      "<li>First orders can start small — we don't require full-container volume</li></ul>",
      "<p>If the timing isn't right, just let me know. If it is, I'm happy to send the catalogue and pricing straight away.</p>",
      '<p>Thank you for your time.</p>',
    ].join('\n'),
  },
  {
    step: 3 as const,
    label: '3차 마지막 팔로우업',
    purpose: 'followup' as const,
    adopt: (t: any) => t.purpose === 'followup' && /3\s*차/.test(String(t.name || '')),
    name: '3차 마지막 팔로우업 — 끝인사',
    subject: 'Closing the loop — [회사명]',
    body: [
      '<p>Dear [회사명] team,</p>',
      "<p>I have reached out a couple of times about sourcing K-beauty directly from Korean brand owners, and I don't want to fill your inbox.</p>",
      '<p>This will be my last note for now. If direct sourcing from Korea becomes relevant later, simply reply to this email and I will send:</p>',
      '<ul><li>Our current brand portfolio and price list</li>',
      '<li>Sample and MOQ conditions for a first trial order</li>',
      '<li>How we handle documentation (CPNP / FDA) and consolidated shipping</li></ul>',
      '<p>If someone else on your team handles sourcing, I would be grateful if you could point me to them.</p>',
      '<p>Thank you, and I wish you a successful season.</p>',
    ].join('\n'),
  },
];

export type TemplateStep = 1 | 2 | 3;

export const STEP_LABEL: Record<TemplateStep, string> = { 1: '1차 첫 소개', 2: '2차 팔로우업', 3: '3차 마지막 팔로우업' };

/**
 * 1·2·3차 칸이 모두 있게 한다. 비어 있는 칸은
 *   ① 이미 쓰던 양식 중 맞는 것(용도·이름)을 그 칸으로 옮기고 — 문구는 건드리지 않는다
 *   ② 없으면 위 예시로 새로 만든다.
 * 이미 칸이 정해진 양식은 아무것도 바꾸지 않는다 (사람이 고친 문구를 그대로 둔다).
 */
export async function ensureStepTemplates(): Promise<{ adopted: number; created: number }> {
  let adopted = 0;
  let created = 0;
  const all: any[] = await EmailTemplate.find({}, { step: 1, purpose: 1, name: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 }).lean();
  for (const def of TEMPLATE_STEPS) {
    if (all.some((t) => t.step === def.step)) continue;
    const pick = all.find((t) => !t.step && def.adopt(t));
    if (pick) {
      // 칸만 정하는 것이라 '수정한 날' 은 그대로 둔다 — 목록의 수정일이 사람이 고친 날로 남게
      const r = await EmailTemplate.updateOne(
        { _id: pick._id, step: null }, { $set: { step: def.step } }, { timestamps: false },
      );
      if (r.modifiedCount) { pick.step = def.step; adopted++; continue; }
    }
    // 화면 두 개가 동시에 열려도 같은 칸이 두 번 생기지 않게 — 그 칸이 없을 때만 넣는다
    const r = await EmailTemplate.updateOne(
      { step: def.step },
      {
        $setOnInsert: {
          name: def.name, language: 'en', subject: def.subject, body: def.body, bodyIsHtml: true,
          // step 은 위 조건에서 그대로 들어간다 (여기 또 적으면 같은 칸을 두 번 쓰는 것이 된다)
          purpose: def.purpose, isActive: true, appendAccountSignature: true,
          attachments: [], createdBy: 'system',
        },
      },
      { upsert: true },
    );
    if (r.upsertedCount) created++;
    all.push({ step: def.step });
  }
  return { adopted, created };
}
