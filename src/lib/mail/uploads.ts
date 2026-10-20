import { MailUpload } from '@/models/MailUpload';

/**
 * [✏ 메일 쓰기] 첨부파일 — 조각으로 올려 둔 것을 **보낼 때 이어 붙인다** (models/MailUpload.ts).
 *
 * 화면·서버가 같은 한도를 쓴다. 화면(public/app.js)의 숫자를 바꾸면 여기도 같이 바꿔야 한다.
 */

/** 조각 하나 — Vercel 요청 한도 4.5MB 보다 넉넉히 작게 */
export const UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024;
/** 메일 한 통 첨부 합계 — 양식 첨부(template-attachments.ts)와 같은 값. 받는 쪽 서버 대부분이 20~25MB 에서 거절하고, 메일에 실리면 1.37배로 불어난다 */
export const MAX_COMPOSE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_COMPOSE_ATTACHMENTS = 10;

/**
 * 받는 쪽 메일 서버가 막거나 스팸으로 보는 실행 파일 — 처음부터 못 붙이게 한다.
 * 한 번 스팸 판정을 받으면 yogico.kr 로 보내는 실거래 메일까지 상대 스팸함으로 간다.
 */
const BLOCKED_EXT = /\.(exe|bat|cmd|com|scr|msi|vbs|js|jse|wsf|ps1|jar|lnk|cpl|hta|reg|dll)$/i;

export function cleanFilename(name: string): string {
  const s = String(name || '').replace(/[\r\n\t"\\/:*?<>|]/g, '_').trim().slice(0, 150);
  return s || 'attachment';
}

export function blockedReason(filename: string): string | null {
  return BLOCKED_EXT.test(filename)
    ? `"${filename}" 는 실행 파일이라 붙일 수 없습니다. 받는 쪽 메일 서버가 막거나 스팸으로 처리합니다.`
    : null;
}

export interface UploadedFile {
  uploadId: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface LoadedUpload extends UploadedFile {
  content: Buffer;
}

/** 첨부 번호 목록을 다듬는다 — 중복·이상한 값은 버린다 */
export function normalizeUploadIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    const id = String((raw as any)?.uploadId ?? raw ?? '').trim();
    if (/^[A-Za-z0-9_-]{8,64}$/.test(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * 파일 정보만 (내용은 읽지 않는다) — 미리보기에 이름·크기를 보여줄 때.
 * 조각이 다 올라오지 않은 파일은 complete=false.
 */
export async function describeUploads(owner: string, ids: string[]): Promise<Array<UploadedFile & { complete: boolean }>> {
  if (!ids.length) return [];
  const rows: any[] = await MailUpload.find(
    { uploadId: { $in: ids }, owner },
    { uploadId: 1, filename: 1, contentType: 1, size: 1, chunkIndex: 1, chunkCount: 1 },
  ).lean();
  return ids.map((id) => {
    const parts = rows.filter((r) => r.uploadId === id);
    const first = parts[0];
    if (!first) return { uploadId: id, filename: '', contentType: '', size: 0, complete: false };
    return {
      uploadId: id,
      filename: first.filename,
      contentType: first.contentType,
      size: first.size,
      complete: parts.length === first.chunkCount,
    };
  });
}

/**
 * 조각을 이어 붙여 메일에 달 파일로 만든다.
 * **하나라도 빠지면 보내지 않는다** — "첨부 드립니다" 라고 쓴 메일이 파일 없이 나가면 되돌릴 수 없다.
 */
export async function loadUploads(owner: string, ids: string[]): Promise<{ ok: true; files: LoadedUpload[] } | { ok: false; error: string }> {
  if (!ids.length) return { ok: true, files: [] };
  if (ids.length > MAX_COMPOSE_ATTACHMENTS) return { ok: false, error: `첨부파일은 ${MAX_COMPOSE_ATTACHMENTS}개까지 붙일 수 있습니다.` };

  const rows: any[] = await MailUpload.find({ uploadId: { $in: ids }, owner }).sort({ uploadId: 1, chunkIndex: 1 }).lean();
  const files: LoadedUpload[] = [];
  let total = 0;
  for (const id of ids) {
    const parts = rows.filter((r) => r.uploadId === id).sort((a, b) => a.chunkIndex - b.chunkIndex);
    const first = parts[0];
    if (!first) {
      return { ok: false, error: '첨부파일 하나를 찾지 못해 보내지 않았습니다. 2시간이 지나 지워졌을 수 있습니다 — 파일을 다시 붙여 주세요.' };
    }
    if (parts.length !== first.chunkCount || parts.some((p, i) => p.chunkIndex !== i)) {
      return { ok: false, error: `"${first.filename}" 가 다 올라가지 않아 보내지 않았습니다. 파일을 다시 붙여 주세요.` };
    }
    const content = Buffer.concat(parts.map((p) => toBuffer(p.data)));
    if (content.length !== first.size) {
      return { ok: false, error: `"${first.filename}" 크기가 맞지 않아 보내지 않았습니다 (올린 ${content.length} / 원래 ${first.size}). 다시 붙여 주세요.` };
    }
    total += content.length;
    if (total > MAX_COMPOSE_ATTACHMENT_BYTES) {
      return { ok: false, error: `첨부파일 합계가 ${MAX_COMPOSE_ATTACHMENT_BYTES / 1024 / 1024}MB 를 넘어 보내지 않았습니다.` };
    }
    files.push({ uploadId: id, filename: first.filename, contentType: first.contentType, size: first.size, content });
  }
  return { ok: true, files };
}

/**
 * .lean() 으로 읽으면 Buffer 칸이 BSON Binary 로 온다. Binary.buffer 는 실제 길이보다 클 수 있어
 * (position 까지만 유효) value() 로 정확한 길이만 꺼낸다 — 그냥 .buffer 를 쓰면 파일 뒤에 쓰레기가 붙는다.
 */
function toBuffer(d: any): Buffer {
  if (Buffer.isBuffer(d)) return d;
  if (d && typeof d.value === 'function') return Buffer.from(d.value());
  return Buffer.from(d?.buffer ?? d);
}

/** 보낸 뒤 지운다 — 남겨 둘 이유가 없다 (사본은 이카운트 보낸메일함에 있다) */
export async function deleteUploads(owner: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await MailUpload.deleteMany({ uploadId: { $in: ids }, owner });
}
