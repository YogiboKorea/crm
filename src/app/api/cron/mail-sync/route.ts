import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { runIngest } from '@/lib/mail/ingest';
import { listMailAccounts } from '@/lib/mail/accounts';
import { lastInboxSync } from '@/lib/mail/sync-status';
import { acquireRunLock, releaseRunLock, lastRunInfo } from '@/lib/run-lock';
import { MailSettings } from '@/models/MailSettings';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/mail-sync — 10분마다 모든 메일함의 새 메일만 가볍게 받아 온다 (2026-11-26).
 *
 * 왜:
 * Vercel Hobby 크론은 하루 1회(아침 07:30~07:59 사이)다. 그 밖에는 누군가 CRM 을 열어 둔 동안만
 * 메일을 받아 와서(sync-on-login), 밤사이·화면을 닫아 둔 동안 온 메일은 다음 날 아침에야 들어왔다.
 * rnd@ "최근 메일 수신이 안 된다" (11/26 대표님) — 전날 저녁~새벽 메일이 07:50 에 한꺼번에 들어왔다.
 *
 * 누가 부르나:
 *   · GitHub Actions "예약 발송 깨우기" (.github/workflows/process-schedules.yml) — 10분마다
 *   · Vercel Pro 로 옮기면 vercel.json crons 에 '*\/10 * * * *' 로 이 경로를 넣고 GitHub 쪽은 빼면 된다
 *     (Hobby 프로젝트에 넣으면 배포가 실패한다 — 하루 1회 넘는 크론은 Pro 부터)
 *
 * 가볍게:
 *   · 폴더당 최대 30통 (화면을 열 때 받아 오는 것과 같은 양) — 밀린 것은 아침 크론이 마저 받는다
 *   · 보낸메일함 대조는 최근 SENT_SCAN(50)통만 (아침 크론은 400통) — 웹메일·휴대폰에서 답한 건이 [회신 필요]에서 내려가게.
 *     이 수집이 자주 돌면 화면 쪽 수집(10분 쿨다운)이 덜 돌므로 대조를 여기서도 해야 한다
 *   · 방금(FRESH_MIN 분 안) 받아 온 계정은 건너뛴다 — CRM 을 열어 둔 사람이 이미 받았다
 *   · 이카운트가 로그인을 거절한 계정은 AUTH_HOLD 동안 쉰다 — 틀린 비밀번호로 10분마다 붙으면 계정이 잠길 수 있다
 *
 * /api/cron 은 proxy.ts 로그인 검사에서 빠져 있으므로 CRON_SECRET 으로 직접 막는다.
 */

/** 이 시간 안에 받아 온 계정은 건너뛴다 (분) */
const FRESH_MIN = 7;
/** 로그인 거절된 계정을 쉬게 하는 시간 */
const AUTH_HOLD_MS = 60 * 60_000;
/** 이 시간이 지나면 남은 계정은 다음 실행으로 넘긴다 — GitHub 쪽이 170초까지 기다린다 */
const RUN_BUDGET_MS = 150_000;
/** 폴더당 최대 통수 */
const FETCH_LIMIT = 30;
/** 보낸메일함에서 훑을 최근 통수 */
const SENT_SCAN = 50;

const authHoldKey = (id: string) => `mail-sync-auth:${id}`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (process.env.CRON_SECRET && key !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: '인증 실패' }, { status: 401 });
  }
  const source = (url.searchParams.get('source') || 'cron').slice(0, 20);

  await dbConnect();

  // 앞 실행이 아직 돌고 있으면 겹쳐 붙지 않는다 (같은 메일함에 IMAP 연결이 둘 생긴다)
  const holder = await acquireRunLock('mail-sync', 4 * 60_000, source);
  if (!holder) return NextResponse.json({ success: true, skipped: 'running' });

  const startedAt = Date.now();
  const accounts: any[] = [];
  const errors: string[] = [];
  try {
    // 크론 수집과 같은 목록 — 같은 주소를 여러 아이디가 등록했어도 메일함은 한 번만 돈다
    for (const acc of await listMailAccounts('system')) {
      const id = String(acc._id);
      const label = String(acc.smtpUser || acc.accountName || id);
      if (Date.now() - startedAt > RUN_BUDGET_MS) { accounts.push({ account: label, skipped: 'time' }); continue; }

      const hold = await lastRunInfo(authHoldKey(id));
      if (hold?.running) { accounts.push({ account: label, skipped: 'auth-hold' }); continue; }

      const last = await lastInboxSync([id]);
      if (last && Date.now() - last.getTime() < FRESH_MIN * 60_000) {
        accounts.push({ account: label, skipped: 'fresh', minutesAgo: Math.round((Date.now() - last.getTime()) / 60_000) });
        continue;
      }

      const t0 = Date.now();
      try {
        const r = await runIngest({ accountId: id, limit: FETCH_LIMIT, sentScan: SENT_SCAN });
        if (r.errors.some((e) => /로그인을 거절/.test(e))) {
          await acquireRunLock(authHoldKey(id), AUTH_HOLD_MS, 'auth-fail');
        }
        errors.push(...r.errors);
        accounts.push({
          account: label, fetched: r.fetched, inserted: r.inserted, matched: r.matched,
          movedToReplied: r.movedToReplied, ms: Date.now() - t0,
          ...(r.errors.length ? { errors: r.errors.slice(0, 3) } : {}),
        });
      } catch (e: any) {
        const msg = `[${label}] ${String(e?.message || e)}`;
        errors.push(msg);
        accounts.push({ account: label, error: msg, ms: Date.now() - t0 });
      }
    }

    // runIngest 는 계정마다 "마지막 수집" 을 덮어쓴다 — 실제로 돈 게 있으면 이번 실행 전체로 한 번 더 남긴다
    // (안 그러면 앞 계정의 로그인 거절이 뒤 계정의 성공에 가려 [수신 설정] 화면에서 사라진다)
    if (accounts.some((a) => !a.skipped)) {
      await MailSettings.updateOne(
        { _id: 'main' },
        { $set: { lastIngestAt: new Date(), lastIngestError: errors.join(' / ').slice(0, 500) } },
        { upsert: true },
      ).catch(() => {});
    }
  } finally {
    await releaseRunLock('mail-sync', holder);
  }

  const inserted = accounts.reduce((n, a) => n + (a.inserted || 0), 0);
  return NextResponse.json({ success: true, source, inserted, durationMs: Date.now() - startedAt, accounts });
}
