import nodemailer from 'nodemailer';
import { ECOUNT_IMAP_HINT } from '@/models/MailSettings';

/**
 * 메일 계정 등록·수정의 안전장치 (아이디별 메일 분리와 한 묶음 — lib/mail/scope.ts).
 *
 * 같은 주소를 등록한 사람은 그 메일함의 메일을 함께 본다. 그래서 "그 주소의 주인" 이라는 증명이
 * 느슨하면 남의 메일함이 열린다. 점검에서 실제로 뚫린 두 길을 막는다:
 *   1) 수정(PUT)에서 비밀번호 없이 주소(smtpUser)만 david@ 로 바꾸기
 *   2) 등록(POST)에서 서버 주소(smtpHost)를 아무 로그인이나 받아주는 가짜 서버로 넣고 남의 주소 등록하기
 */

/** 등록을 허용하는 발송 서버 — 수신(IMAP)이 이카운트로 고정이라 발송도 이카운트만 받는다 */
export function isAllowedMailHost(host?: string | null): boolean {
  const h = String(host || '').trim().toLowerCase();
  if (!h) return false;
  const extra = String(process.env.MAIL_ALLOWED_HOSTS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return h === 'ecount.com' || h.endsWith('.ecount.com') || extra.includes(h);
}

export const HOST_NOT_ALLOWED = '이카운트 메일 서버(…ecount.com)만 등록할 수 있습니다.';
export const FROM_MUST_MATCH = '발신 주소는 로그인 이메일(SMTP 계정)과 같아야 합니다.';

/** 같은 메일함인가 — 주소와 서버가 둘 다 같아야 한다 */
export function mailboxKey(a: { smtpUser?: string; smtpHost?: string }): string {
  return `${String(a.smtpUser || '').trim().toLowerCase()}|${String(a.smtpHost || '').trim().toLowerCase()}`;
}

/** 실제로 로그인이 되는지 — 서버가 AUTH 를 광고하지 않아도 로그인을 시도한다(forceAuth) */
export async function verifySmtpLogin(o: { host: string; port: number; secure: boolean; user: string; pass: string }) {
  const t = nodemailer.createTransport({
    host: o.host,
    port: o.port,
    secure: o.secure,
    auth: { user: o.user, pass: o.pass },
    forceAuth: true,
  } as any);
  try {
    await t.verify();
  } catch (e: any) {
    // 이카운트는 비밀번호가 틀릴 때뿐 아니라 [메일 클라이언트 사용 안 함]·[해외 로그인 차단] 상태에서도 535 로 막는다.
    // 계정 추가·수정 창에 무엇을 확인할지 바로 적어 준다 (11/23 rnd@ — 메일 클라이언트 사용을 켜자 바로 통과했다)
    const text = `${e?.code || ''} ${e?.responseCode || ''} ${e?.message || ''}`;
    if (/535|EAUTH|invalid login|authentication failed/i.test(text)) {
      const err: any = new Error(`${e?.message || '로그인 거절'} — ${ECOUNT_IMAP_HINT}`);
      err.code = e?.code;
      err.responseCode = e?.responseCode;
      throw err;
    }
    throw e;
  }
}
