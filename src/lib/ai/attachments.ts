/**
 * 🤖 AI 메일 비서 — 파일 읽기 (2026-11-12 요청 "첨부 내용을 직접 체크해 달라고 하거나, 파일을 넣으면 분석되게").
 *
 * 두 군데서 쓴다.
 *   · 메일 첨부 — Claude 가 read_attachment 도구로 "이 메일 첨부" 를 메일 서버에서 꺼내 읽는다 (lib/ai/mail-chat.ts)
 *   · 채팅에 올린 파일 — 입력창 📎 로 올리면 질문과 함께 넘긴다 (app/api/ai/chat)
 *
 * PDF·이미지는 Claude 가 그대로 읽는다 (표·스캔한 견적서도). 엑셀·CSV·워드·텍스트는 Claude 가 바로
 * 못 읽으므로 여기서 글(표)로 바꾼다. 어느 쪽이든 **Anthropic Files API 에 한 번 올리고 file_id 로 가리킨다** —
 * 대화 기록은 질문마다 통째로 다시 보내고 DB 에도 남으므로, 파일 내용이 기록에 쌓이면 무겁고 비싸진다.
 * 올린 파일은 대화를 지울 때 함께 지운다 (deleteFiles).
 * HWP·압축파일·파워포인트 등은 못 읽는다 — 그렇다고 알린다.
 */
import { toFile } from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { client } from './client';

/** 메일 첨부를 읽는 한도 — 메일 서버에서 받아 오는 크기 (lib/mail/imap.ts fetchAttachment 는 40MB 까지) */
export const MAX_READ_BYTES = 30 * 1024 * 1024;
/** 이미지는 Claude 가 한 장에 5MB 까지 읽는다 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** 엑셀·워드에서 뽑은 글 — 이보다 길면 앞부분만 (Opus 기준 약 6만 자 ≈ 질문 한 번에 수백 원) */
const MAX_TEXT_CHARS = 60_000;

export interface PreparedFile {
  name: string;
  kind: 'pdf' | 'image' | 'text' | 'unsupported';
  fileId?: string;       // Anthropic Files API 에 올린 것
  note?: string;         // 잘렸거나 못 읽은 이유 — Claude 와 화면에 함께 알린다
}

const ext = (name: string) => (String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '');
const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

/** 파일 종류 — 이름(확장자)을 먼저 본다. 메일 첨부의 종류 표시는 틀린 경우가 많다 (octet-stream) */
export function fileKind(name: string, contentType = ''): 'pdf' | 'image' | 'sheet' | 'word' | 'text' | 'other' {
  const e = ext(name);
  const t = String(contentType || '').toLowerCase();
  if (e === 'pdf' || t === 'application/pdf') return 'pdf';
  if (IMAGE_TYPES[e] || /^image\/(png|jpe?g|gif|webp)$/.test(t)) return 'image';
  if (['xlsx', 'xlsm', 'xls', 'ods', 'csv'].includes(e) || /spreadsheet|ms-excel|text\/csv/.test(t)) return 'sheet';
  if (e === 'docx' || /wordprocessingml/.test(t)) return 'word';
  if (['txt', 'md', 'json', 'xml', 'html', 'htm', 'eml', 'log', 'tsv'].includes(e) || /^text\//.test(t)) return 'text';
  return 'other';
}

function clipText(text: string): { text: string; note?: string } {
  const t = String(text || '').replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (t.length <= MAX_TEXT_CHARS) return { text: t };
  return { text: t.slice(0, MAX_TEXT_CHARS), note: `내용이 길어 앞부분 ${MAX_TEXT_CHARS.toLocaleString()}자만 읽었습니다 (전체 ${t.length.toLocaleString()}자)` };
}

/** 엑셀 — 시트마다 표(CSV)로. 빈 줄은 뺀다 */
function sheetToText(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  return wb.SheetNames.map((n) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false });
    return `### 시트: ${n}\n${csv}`;
  }).join('\n\n');
}

async function upload(buf: Buffer, name: string, type: string): Promise<string> {
  const meta = await client().beta.files.upload({ file: await toFile(buf, name, { type }) });
  return meta.id;
}

/**
 * 파일 하나를 Claude 가 읽을 수 있게 — 올리고 file_id 를 돌려준다.
 * 실패해도 던지지 않고 unsupported + 이유로 돌려준다 (나머지 파일·질문은 그대로 진행되게).
 */
export async function prepareFile(buf: Buffer, name: string, contentType = ''): Promise<PreparedFile> {
  const kind = fileKind(name, contentType);
  try {
    if (!buf?.length) return { name, kind: 'unsupported', note: '빈 파일입니다' };
    if (kind === 'pdf') return { name, kind: 'pdf', fileId: await upload(buf, name, 'application/pdf') };
    if (kind === 'image') {
      if (buf.length > MAX_IMAGE_BYTES) return { name, kind: 'unsupported', note: `이미지가 ${(buf.length / 1048576).toFixed(1)}MB 라 너무 큽니다 (5MB 까지)` };
      return { name, kind: 'image', fileId: await upload(buf, name, IMAGE_TYPES[ext(name)] || contentType || 'image/png') };
    }
    let raw = '';
    if (kind === 'sheet') raw = ext(name) === 'csv' ? buf.toString('utf8') : sheetToText(buf);
    else if (kind === 'word') raw = (await mammoth.extractRawText({ buffer: buf })).value;
    else if (kind === 'text') {
      raw = buf.toString('utf8');
      if (/^(html?|eml)$/.test(ext(name))) raw = raw.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
    } else {
      const e = ext(name);
      return { name, kind: 'unsupported', note: e === 'hwp' || e === 'hwpx' ? '한글(HWP) 파일은 읽지 못합니다 — PDF 로 저장해서 올려 주세요' : `.${e || '?'} 파일은 읽지 못합니다 (PDF·이미지·엑셀·워드·CSV·텍스트만)` };
    }
    const { text, note } = clipText(raw);
    if (!text) return { name, kind: 'unsupported', note: '파일에서 글을 찾지 못했습니다' };
    return { name, kind: 'text', fileId: await upload(Buffer.from(text, 'utf8'), `${name}.txt`, 'text/plain'), note };
  } catch (e: any) {
    return { name, kind: 'unsupported', note: `읽지 못했습니다 — ${String(e?.message || e).slice(0, 160)}` };
  }
}

/** Claude 에 넘길 내용 블록 — PDF·글은 문서로, 이미지는 그림으로, 못 읽은 것은 이유만 */
export function blocksFor(f: PreparedFile): any[] {
  const head = { type: 'text', text: `[파일: ${f.name}${f.note ? ` — ${f.note}` : ''}]` };
  if (f.kind === 'pdf' || f.kind === 'text') return [head, { type: 'document', source: { type: 'file', file_id: f.fileId }, title: f.name }];
  if (f.kind === 'image') return [head, { type: 'image', source: { type: 'file', file_id: f.fileId } }];
  return [head];
}

/** 대화를 지울 때 그 대화에서 올린 파일도 지운다 (이미 없으면 넘어간다) */
export async function deleteFiles(ids: string[]): Promise<void> {
  const anthropic = client();
  await Promise.all([...new Set(ids)].filter(Boolean).map((id) => anthropic.beta.files.delete(id).catch(() => undefined)));
}
