import { InboundMail } from '@/models/InboundMail';

/**
 * 메일 보관 정책 — 저장 공간을 저절로 관리한다 (2026-09-15, 대표님 결정).
 *
 * 왜 필요한가:
 * 받은 메일의 **원문**을 전부 DB 에 쌓다가 512MB 를 채워 쓰기가 막혔고, 메일 발송까지 멈췄다.
 * 원문은 이카운트 메일 서버에 그대로 있으므로 DB 에 또 둘 이유가 없다.
 *
 * 규칙 (숫자는 환경변수로 조정 가능):
 *   - 최근 MAIL_KEEP_BODY_DAYS(기본 14일) : 본문을 DB 에 그대로 둔다 — 자주 열어보는 것들이라 빨라야 한다.
 *   - 그보다 오래된 메일                   : 본문을 비운다. 열면 그때 서버에서 받아 온다 (lib/mail/body.ts).
 *   - 광고·자동발송·뉴스레터               : 기간과 무관하게 본문을 비운다 (다시 읽을 일이 없다).
 *   - MAIL_KEEP_DAYS(기본 60일) 이 지난 메일: 새로 **가져오지 않는다** (수집 창이 2달) — 이미 있는 것은
 *     제목·발신자·요약·AI 분석만 남겨 둔다. 목록과 업체 대화 이력이 끊기지 않게 지우지는 않는다.
 *
 * 매일 도는 작업(api/cron/daily-mail)에서 수집이 끝난 뒤 자동으로 실행된다.
 */
export const KEEP_BODY_DAYS = Number(process.env.MAIL_KEEP_BODY_DAYS) || 14;
export const KEEP_DAYS = Number(process.env.MAIL_KEEP_DAYS) || 60;
/** 목록·검색·AI 분석에 쓰는 미리보기 길이 */
export const PREVIEW_CHARS = 4000;
const NOISE = ['ad', 'system', 'newsletter'];

export interface RetentionResult {
  keepBodyDays: number;
  cleared: number;       // 본문을 비운 메일 수
  freedBytes: number;    // 줄어든 본문 용량(대략)
  error?: string;
}

/** 오래된 메일·광고의 본문을 비운다 (메일 자체는 지우지 않는다) */
export async function applyMailRetention(opts: { keepBodyDays?: number } = {}): Promise<RetentionResult> {
  const keepBodyDays = Number(opts.keepBodyDays) || KEEP_BODY_DAYS;
  const cut = new Date(Date.now() - keepBodyDays * 86400000);
  const out: RetentionResult = { keepBodyDays, cleared: 0, freedBytes: 0 };

  const target: any = {
    $and: [
      { $or: [{ date: { $lt: cut } }, { classification: { $in: NOISE } }] },
      { $or: [{ 'raw.html': { $nin: ['', null] } }, { $expr: { $gt: [{ $strLenCP: { $ifNull: ['$raw.text', ''] } }, PREVIEW_CHARS] } }] },
    ],
  };

  try {
    const [before] = await InboundMail.aggregate([
      { $match: target },
      { $group: { _id: null, n: { $sum: 1 }, size: { $sum: { $add: [
        { $strLenBytes: { $ifNull: ['$raw.html', ''] } },
        { $strLenBytes: { $ifNull: ['$raw.text', ''] } },
      ] } } } },
    ]);
    if (!before?.n) return out;

    const r = await InboundMail.updateMany(target, [{ $set: {
      'raw.html': '',
      'raw.text': { $substrCP: [{ $ifNull: ['$raw.text', ''] }, 0, PREVIEW_CHARS] },
      bodyStripped: { $substrCP: [{ $ifNull: ['$bodyStripped', { $substrCP: [{ $ifNull: ['$raw.text', ''] }, 0, PREVIEW_CHARS] }] }, 0, PREVIEW_CHARS] },
      rawTruncated: true,
    } }]);
    out.cleared = r.modifiedCount;
    out.freedBytes = Math.max(0, (before.size || 0) - before.n * PREVIEW_CHARS);
  } catch (e: any) {
    // 용량이 꽉 차 쓰기가 막힌 상태라면 여기서 실패한다 — 수집 자체를 실패로 만들지는 않는다
    out.error = String(e?.message || e);
  }
  return out;
}
