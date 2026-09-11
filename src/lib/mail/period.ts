/**
 * 메일함 숫자의 기준 기간.
 *
 * 대표 메일함에는 1년 넘는 이력이 쌓여 있다. 기간을 두지 않고 세면
 * "회신 필요 143건" 같은 수가 떠서 **밀린 일이 산더미로 읽히고**,
 * 정작 매일 늘어나는 몇 건이 그 안에 묻힌다 (emailData 실측 근거).
 *
 * 그래서 화면에 보이는 모든 카운트는 이 기간을 기준으로 센다.
 * 한 곳만 다른 기준을 쓰면 사이드바 숫자와 목록 건수가 어긋나므로
 * **반드시 이 상수를 함께 쓸 것.**
 *
 * 과거 메일이 사라지는 것은 아니다 — 검색·거래처별 보기로 언제든 조회된다.
 */
export const COUNT_PERIOD_DAYS = 60;

export const COUNT_PERIOD_LABEL = '최근 2개월';

/** 기준 시각 (이 시점 이후만 센다) */
export function countSince(days = COUNT_PERIOD_DAYS): Date {
  return new Date(Date.now() - days * 86400000);
}

/** 몽고 필터 조각 — `{ ...periodFilter() }` 로 합쳐 쓴다 */
export function periodFilter(field = 'date', days = COUNT_PERIOD_DAYS) {
  return { [field]: { $gte: countSince(days) } };
}

/**
 * "오늘" 이 시작되는 시각 — 서울 기준.
 *
 * 서버는 Vercel 에서 UTC 로 돈다. 그냥 new Date().setHours(0,0,0,0) 을 쓰면
 * 서울이 9월 11일 오전인데 서버는 아직 9월 10일이라, 오전에 온 메일이
 * "오늘"에서 통째로 빠진다. 반대로 저녁 9시 이후에는 내일 것이 섞여 들어온다.
 *
 * 쓰는 사람도 받는 메일도 전부 한국 기준이므로 서울 자정을 못박는다.
 * (한국은 서머타임이 없어 UTC+9 가 연중 고정이다)
 */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function seoulDayStart(at: Date = new Date()): Date {
  const seoul = new Date(at.getTime() + KST_OFFSET_MS);      // 서울 시계로 옮겨서
  seoul.setUTCHours(0, 0, 0, 0);                              // 그 날 자정으로 자르고
  return new Date(seoul.getTime() - KST_OFFSET_MS);           // 다시 UTC 로 되돌린다
}

/** 오늘 온 메일 필터 조각 */
export function todayFilter(field = 'date') {
  return { [field]: { $gte: seoulDayStart() } };
}
