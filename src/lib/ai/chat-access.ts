/**
 * 🤖 AI 메일 비서 — 누가 쓰고, 누구 메일함을 읽는가 (2026-11-12).
 *
 * 로그인 확인(/api/auth/me)에서도 쓰므로 SDK·DB 를 끌어오지 않게 따로 둔다 (lib/ai/mail-chat.ts).
 *
 * - 읽는 메일함: 대표님(david) 메일함으로 고정 — 대표님 요청 "david@yogico.kr 에서 받는 메일 기준".
 * - 쓰는 아이디: 대표님 전용. admin 은 화면 확인용으로 함께 열어 두었다 (2026-11-12 요청).
 *   9/22 대표님 요청("admin 에서는 내 메일이 안 보이게")과 부딪히므로, 확인이 끝나면
 *   환경 변수 AI_CHAT_USERS=david 로 admin 을 뺀다.
 */
export const AI_CHAT_MAILBOX_OWNER = (process.env.AI_CHAT_MAILBOX_OWNER || 'david').trim().toLowerCase();

export function aiChatUsers(): string[] {
  return (process.env.AI_CHAT_USERS || 'david,admin').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function canUseAiChat(user?: string | null): boolean {
  return !!user && aiChatUsers().includes(String(user).trim().toLowerCase());
}
