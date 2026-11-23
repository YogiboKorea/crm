/**
 * 🤖 AI 메일 비서 — 누가 쓰고, 누구 메일함을 읽는가 (2026-11-12 · 2026-11-23 전무님 추가).
 *
 * 로그인 확인(/api/auth/me)에서도 쓰므로 SDK·DB 를 끌어오지 않게 따로 둔다 (lib/ai/mail-chat.ts).
 *
 * - 쓰는 아이디: 대표님(david) · 전무님(hoon, 2026-11-23 요청). admin 은 화면 확인용 (2026-11-12 요청).
 *   9/22 대표님 요청("admin 에서는 내 메일이 안 보이게")과 부딪히므로, 확인이 끝나면
 *   환경 변수 AI_CHAT_USERS=david,hoon 으로 admin 을 뺀다.
 * - 읽는 메일함: **각자 자기 메일함**이다. 대표님 비서는 대표님 메일(david@)만, 전무님 비서는 전무님 메일(hoon@)만 읽는다
 *   — 메일 화면과 같은 규칙 (9/14·9/22 "아이디마다 자기 메일만", lib/mail/scope.ts).
 *   마스터(admin·yogico)만 예외로 AI_CHAT_MAILBOX_OWNER(대표님) 메일함을 본다 — 대표님 메일함으로 시험해 보려고 연 자리라서.
 */
import { isMasterUser } from '@/lib/masters';

/** 마스터 아이디(시험용)가 읽는 메일함 주인 */
export const AI_CHAT_MAILBOX_OWNER = (process.env.AI_CHAT_MAILBOX_OWNER || 'david').trim().toLowerCase();

export function aiChatUsers(): string[] {
  return (process.env.AI_CHAT_USERS || 'david,hoon,admin').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function canUseAiChat(user?: string | null): boolean {
  return !!user && aiChatUsers().includes(String(user).trim().toLowerCase());
}

/** 이 아이디의 비서가 읽는 메일함 주인 — 자기 메일함. 마스터(시험용)만 대표님 메일함 */
export function aiChatMailboxOwner(user: string): string {
  const u = String(user || '').trim().toLowerCase();
  return isMasterUser(u) ? AI_CHAT_MAILBOX_OWNER : u;
}

/** 메일함마다 다른 것 — 비서가 누구를 돕는지, 메일이 언제부터 있는지, 질문 예시 */
export interface AiChatMailbox {
  owner: string;
  /** 화면·답에서 부르는 말 */
  title: string;
  /** 지시문 첫 줄 — 누구의 메일 비서인가 */
  person: string;
  address: string;
  /** 메일함에 들어 있는 기간 — 지시문·사용 방법에 쓴다. 옛 메일을 더 넣으면 여기를 고친다 */
  since: string;
  sinceNote: string;
  /** 빈 화면 · 사용 방법의 질문 예시 — 그 메일함에 실제로 있는 거래처로 */
  examples: string[];
  guideExamples: string[];
}

const MAILBOXES: Record<string, Omit<AiChatMailbox, 'owner'>> = {
  david: {
    title: '대표님',
    person: '대표 박대진(David) 님',
    address: 'david@yogico.kr',
    // 2026-11-12 옛 메일 3,773통을 더 넣었다 (scripts/import-old-mail.mts)
    since: '2026년 1월',
    sinceNote: '그보다 오래된 것은 거래처 폴더에 있던 일부뿐',
    examples: [
      '이번 주에 꼭 답해야 할 메일 정리해 줘',
      '기한이 지났거나 곧 다가오는 건 뭐가 있어?',
      'Dangaard 와는 지금 어디까지 얘기됐어?',
      'Yogibo Japan 포켓몬 건 진행 상황 알려 줘',
    ],
    guideExamples: [
      'Arencia 단가 협상 지금까지 내용 정리해 줘',
      'My K Romania 에 보낼 답장 영어로 써 줘',
      '이번 달에 새로 연락 온 해외 바이어 있어?',
      'Yogibo Japan 에서 요청한 것 중 아직 안 끝난 거 뭐야?',
      '오스템파마 계약 건 쟁점이 뭐였지?',
      '피싱 같아 보이는 메일 있었어?',
    ],
  },
  hoon: {
    title: '전무님',
    person: '전무 Hoon Lee 님',
    address: 'hoon@yogico.kr',
    // 2026-10-20 메일 계정을 등록할 때 두 달 치를 가져왔다
    since: '2026년 8월 21일',
    sinceNote: 'CRM 에 메일 계정을 등록하면서 그때부터 가져온 것',
    examples: [
      '이번 주에 꼭 답해야 할 메일 정리해 줘',
      '기한이 지났거나 곧 다가오는 건 뭐가 있어?',
      'Dangaard 와는 지금 어디까지 얘기됐어?',
      'My K Romania 10월 선적 건 어떻게 됐어?',
    ],
    guideExamples: [
      'TOUN28 미팅 이후 다음 단계 정리해 줘',
      'Blue Marble Israel 에 보낼 답장 영어로 써 줘',
      '이번 달에 새로 연락 온 브랜드사 있어?',
      '잇츠한불 이스라엘 진출 건 요청 내용 알려 줘',
      '오스템파마 건 쟁점이 뭐였지?',
      '피싱 같아 보이는 메일 있었어?',
    ],
  },
};

export function aiChatMailbox(owner: string): AiChatMailbox {
  const o = String(owner || '').trim().toLowerCase();
  const p = MAILBOXES[o];
  if (p) return { owner: o, ...p };
  // 표에 없는 사람 — 이름 대신 아이디로 부르고, 기간·예시는 비워 둔다
  return { owner: o, title: `${o} 님`, person: `${o} 님`, address: '', since: '', sinceNote: '', examples: [], guideExamples: [] };
}
