import nodemailer from 'nodemailer';
import { toImapConfig } from './accounts';
import { appendMessage, findSentPath, withOpenAccount } from './imap';

/**
 * 보낸 메일 **사본을 이카운트 보낸메일함에 남긴다** (2026-09-15).
 *
 * 왜 필요한가:
 * 이 앱은 SMTP 로 보내기만 했다. SMTP 는 보내는 통로일 뿐 보낸메일함에 넣어주지 않는다.
 * 그래서 [📤 보낸 메일함](이카운트 보낸메일함을 그대로 읽는 화면)에도, 대표님이 쓰는 웹메일·아웃룩의
 * 보낸메일함에도 우리가 보낸 메일이 없었다 — "보냈는지 알 수가 없다".
 *
 * 보낸 뒤에만, 실패해도 발송 자체는 성공으로 둔다 (사본이 없다고 메일을 다시 보낼 수는 없다).
 */
export async function saveToSentFolder(account: any, mailOptions: Record<string, any>): Promise<{ ok: boolean; folder?: string; error?: string }> {
  try {
    if (!account) return { ok: false, error: '계정 없음' };

    // 방금 보낸 것과 같은 내용으로 원문(MIME)을 만든다 — 네트워크로 나가지 않는 transport
    const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
    const built: any = await composer.sendMail(mailOptions);
    const raw: Buffer = built.message;
    if (!raw?.length) return { ok: false, error: '원문을 만들지 못했습니다' };

    const settings = toImapConfig(account, 'INBOX');
    return await withOpenAccount(settings, async (scoped) => {
      const folder = await findSentPath((scoped as any).__client);
      if (!folder) return { ok: false, error: '보낸메일함 폴더를 찾지 못했습니다' };
      await appendMessage(scoped, folder, raw, ['\\Seen'], new Date());
      return { ok: true, folder };
    });
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
