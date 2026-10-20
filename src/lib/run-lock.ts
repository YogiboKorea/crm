import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * 한 번에 하나만 돌아야 하는 작업의 잠금 (2026-10-20 — 예약 발송 중복 방지).
 *
 * 예약 처리(/api/cron/process-schedules)는 여러 곳에서 깨운다:
 *   · Vercel 크론 (매일 오전 9시)
 *   · 외부 깨우미 (GitHub Actions · cron-job.org — 10분마다)
 *   · CRM 화면을 열어 둔 사람의 브라우저 (5분마다)
 *   · [⏱ 지금 예약분 내보내기] 버튼
 * 둘이 겹쳐 돌면 서로 다른 예약을 동시에 보내 발송 간격(8초)이 무너진다.
 * 같은 예약을 두 번 보내는 것은 예약마다 따로 막는다 (schedule-runner.ts claim) — 이건 실행 단위 잠금이다.
 *
 * 만료 시각을 두어, 실행이 중간에 죽어도 잠금이 영원히 남지 않는다.
 * 컬렉션 runlocks 에 문서 하나(_id = 작업 이름)만 쓴다.
 */
function locks() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('DB 연결 전에 잠금을 잡을 수 없습니다');
  return db.collection<{ _id: string; until: Date; holder: string; since: Date; source?: string }>('runlocks');
}

/** 잡으면 열쇠(holder)를, 다른 실행이 잡고 있으면 null. source = 누가 깨웠는지 (화면의 "마지막 자동 처리" 표시용) */
export async function acquireRunLock(name: string, ttlMs: number, source = ''): Promise<string | null> {
  const now = new Date();
  const holder = crypto.randomUUID();
  try {
    // 비어 있거나 만료된 잠금만 가져온다. 남이 잡고 있으면 조건이 안 맞아 upsert 가 새로 넣으려다
    // 같은 _id 때문에 실패한다(E11000) — 그게 "잠겨 있음" 이다.
    await locks().updateOne(
      { _id: name, until: { $lt: now } },
      { $set: { until: new Date(now.getTime() + ttlMs), holder, since: now, source } },
      { upsert: true },
    );
    return holder;
  } catch (e: any) {
    if (e?.code === 11000) return null;
    throw e;
  }
}

/** 내가 잡은 잠금만 푼다 (만료 뒤 남이 다시 잡은 것을 풀지 않게) */
export async function releaseRunLock(name: string, holder: string | null): Promise<void> {
  if (!holder) return;
  await locks().updateOne({ _id: name, holder }, { $set: { until: new Date(0) } }).catch(() => {});
}

/** 마지막으로 잠금을 잡은(= 실제로 돈) 시각과 깨운 곳 — 없으면 null */
export async function lastRunInfo(name: string): Promise<{ at: Date; source: string; running: boolean } | null> {
  const d = await locks().findOne({ _id: name }).catch(() => null);
  if (!d?.since) return null;
  return { at: d.since, source: d.source || '', running: !!d.until && d.until.getTime() > Date.now() };
}
