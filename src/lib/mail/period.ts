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
