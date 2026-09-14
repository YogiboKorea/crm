/**
 * 등록된 발송 계정(MailAccount)을 그대로 **수신 계정**으로도 쓴다.
 *
 * 이카운트 웹메일은 SMTP 와 IMAP 이 같은 자격증명을 쓴다(fe@yogico.kr 로 실측 확인).
 * 그래서 계정을 새로 등록하거나 비밀번호를 다시 받을 필요 없이,
 * 이미 등록·검증된 계정의 메일함을 바로 읽을 수 있다.
 *
 * 이렇게 묶어두면 "기본 계정을 바꾸면 메일함도 그 계정 것으로 바뀐다" 가 자연스럽게 성립한다.
 */
import { MailAccount } from '@/models/MailAccount';
import { decryptSecret } from '@/lib/crypto';
import { ECOUNT_IMAP_HOST, ECOUNT_IMAP_PORT } from '@/models/MailSettings';
import type { ImapConfig } from './imap';

export interface MailAccountSummary {
  accountId: string;      // MailAccount._id 문자열 — InboundMail.accountId 로 쓴다
  label: string;          // 화면 표시용 (accountName)
  address: string;        // smtpUser (= 메일 주소)
  isDefault: boolean;
  isActive: boolean;
}

/** SMTP 호스트로 IMAP 호스트를 추정 — 이카운트만 확인됨 */
function imapHostFor(smtpHost: string): string {
  if (/ecount/i.test(smtpHost || '')) return ECOUNT_IMAP_HOST;
  // 이카운트 외 계정은 아직 검증되지 않았다. 기본값을 주되,
  // 연결 테스트에서 실패하면 사용자가 알 수 있다.
  return ECOUNT_IMAP_HOST;
}

/** MailAccount 문서 → IMAP 접속 설정 */
export function toImapConfig(account: any, folder = 'INBOX'): ImapConfig {
  let pass = '';
  try {
    pass = decryptSecret(account.smtpPassEnc);
  } catch {
    throw new Error(`계정 "${account.accountName}" 의 비밀번호를 복호화하지 못했습니다. 계정을 다시 저장하세요.`);
  }
  return {
    imapHost: imapHostFor(account.smtpHost),
    imapPort: ECOUNT_IMAP_PORT,
    imapSecure: true,
    imapUser: account.smtpUser,
    imapPass: pass,
    imapFolder: folder,
  };
}

/** 수집 대상 계정 목록 — 활성 계정만, 기본 계정이 앞에 온다 */
export async function listMailAccounts(): Promise<any[]> {
  return MailAccount.find({ isActive: { $ne: false } })
    .sort({ isDefault: -1, createdAt: 1 })
    .lean();
}

/** 화면용 요약 (비밀번호 제외) */
export function summarize(account: any): MailAccountSummary {
  return {
    accountId: String(account._id),
    label: account.accountName || account.smtpUser,
    address: account.smtpUser,
    isDefault: Boolean(account.isDefault),
    isActive: account.isActive !== false,
  };
}

/**
 * accountId 로 계정 하나를 찾는다.
 * 'default' 를 넘기면 기본 계정, 없으면 첫 활성 계정.
 */
export async function resolveAccount(accountId?: string): Promise<any | null> {
  if (accountId && accountId !== 'default' && accountId !== 'all') {
    const found = await MailAccount.findById(accountId).lean();
    if (found) return found;
  }
  return (
    await MailAccount.findOne({ isDefault: true, isActive: { $ne: false } }).lean()
    || await MailAccount.findOne({ isActive: { $ne: false } }).lean()
  );
}

/**
 * 영업 메일(첫 소개·재발송·예약·발송 관리 일괄)을 보내는 계정.
 *
 * 기본은 **대표 계정**이고, 화면에서 등록된 다른 계정을 고르면 **그 계정**으로 나간다
 * (대표님 요청 2026-09-14: "고정하지 말고 계정이 등록돼 있으면 바꿀 수 있게").
 *
 * - accountId 없음 → 대표 계정
 * - accountId 있음 → 그 계정. 지워졌거나 사용 중지면 **보내지 않는다.**
 *   고른 주소 대신 다른 주소로 조용히 나가면, 받는 쪽에는 엉뚱한 발신자로 보이고
 *   답장도 고른 메일함으로 돌아오지 않는다.
 *
 * 받은 메일에 답장하는 경로(/api/mail/reply)는 해당하지 않는다 — 답장은 그 메일을 받은
 * 계정으로 나가야 상대 메일함에서 같은 대화로 이어진다.
 */
export async function resolveOutreachAccount(accountId?: string | null): Promise<{ account: any | null; error?: string }> {
  const id = String(accountId || '').trim();
  if (id && id !== 'default') {
    if (!/^[0-9a-f]{24}$/i.test(id)) return { account: null, error: CHOSEN_ACCOUNT_GONE };
    const acc = await MailAccount.findOne({ _id: id, isActive: { $ne: false } }).lean();
    return acc ? { account: acc } : { account: null, error: CHOSEN_ACCOUNT_GONE };
  }
  const def = await MailAccount.findOne({ isDefault: true, isActive: { $ne: false } }).lean();
  return def ? { account: def } : { account: null, error: NO_OUTREACH_ACCOUNT };
}

export const NO_OUTREACH_ACCOUNT =
  '대표 계정이 없습니다. [메일 계정 관리]에서 보낼 계정을 대표 계정으로 지정하거나, 보내는 계정을 직접 고르세요.';

export const CHOSEN_ACCOUNT_GONE =
  '고른 보내는 계정을 찾을 수 없거나 사용 중지되었습니다. [메일 계정 관리]를 확인하고 보내는 계정을 다시 고르세요.';
