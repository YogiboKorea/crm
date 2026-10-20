import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { MailUpload } from '@/models/MailUpload';
import { getMailScope, UNAUTHORIZED } from '@/lib/mail/scope';
import {
  UPLOAD_CHUNK_BYTES, MAX_COMPOSE_ATTACHMENT_BYTES, cleanFilename, blockedReason,
} from '@/lib/mail/uploads';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/mail/upload?id=&i=&n=&size=&name=&type= — [✏ 메일 쓰기] 첨부 조각 하나를 맡긴다 (2026-10-20).
 *
 * 본문은 파일 조각 그대로(application/octet-stream). base64 로 감싸지 않는다 — 1.37배로 불어나
 * Vercel 요청 한도(4.5MB)에 더 빨리 걸린다.
 *
 *   id    화면이 파일마다 만든 번호 · i 몇 번째 조각(0부터) · n 조각 수
 *   size  파일 전체 크기 · name 파일 이름 · type 파일 종류
 *
 * 같은 조각을 다시 올려도 덮어쓸 뿐이다 — 네트워크가 끊겨 다시 보내도 안전하다.
 * 맡긴 조각은 보내면 지우고, 안 보내도 2시간 뒤 지워진다 (models/MailUpload.ts).
 */
export async function POST(req: Request) {
  try {
    await dbConnect();
    const scope = await getMailScope();
    if (!scope) return NextResponse.json(UNAUTHORIZED, { status: 401 });

    const sp = new URL(req.url).searchParams;
    const uploadId = String(sp.get('id') || '');
    const i = Number(sp.get('i'));
    const n = Number(sp.get('n'));
    const size = Number(sp.get('size'));
    const filename = cleanFilename(sp.get('name') || '');
    const contentType = String(sp.get('type') || 'application/octet-stream').slice(0, 120) || 'application/octet-stream';

    if (!/^[A-Za-z0-9_-]{8,64}$/.test(uploadId)) return bad('파일 번호가 올바르지 않습니다');
    if (!Number.isInteger(size) || size <= 0) return bad('빈 파일은 붙일 수 없습니다');
    if (size > MAX_COMPOSE_ATTACHMENT_BYTES) {
      return bad(`"${filename}" 는 ${(size / 1048576).toFixed(1)}MB 라 붙일 수 없습니다. 메일 한 통에 ${MAX_COMPOSE_ATTACHMENT_BYTES / 1048576}MB 까지입니다 — 큰 파일은 드롭박스·구글드라이브 링크로 보내 주세요.`);
    }
    const expectN = Math.ceil(size / UPLOAD_CHUNK_BYTES);
    if (!Number.isInteger(n) || n !== expectN) return bad('조각 수가 파일 크기와 맞지 않습니다');
    if (!Number.isInteger(i) || i < 0 || i >= n) return bad('조각 번호가 올바르지 않습니다');
    const blocked = blockedReason(filename);
    if (blocked) return bad(blocked);

    const data = Buffer.from(await req.arrayBuffer());
    // 마지막 조각만 짧을 수 있다 — 크기가 어긋나면 이어 붙였을 때 파일이 깨진다
    const expectLen = i < n - 1 ? UPLOAD_CHUNK_BYTES : size - UPLOAD_CHUNK_BYTES * (n - 1);
    if (data.length !== expectLen) return bad(`조각 크기가 맞지 않습니다 (받은 ${data.length} / 예상 ${expectLen})`);

    // 같은 번호로 남이 올린 조각이 있으면 거절 — 번호만 알면 남의 첨부에 끼어들 수 있게 두지 않는다
    const other = await MailUpload.findOne({ uploadId, owner: { $ne: scope.user } }, { _id: 1 }).lean();
    if (other) return NextResponse.json({ success: false, error: '이 파일에 접근할 수 없습니다' }, { status: 403 });

    await MailUpload.updateOne(
      { uploadId, chunkIndex: i },
      { $set: { owner: scope.user, filename, contentType, size, chunkCount: n, data, createdAt: new Date() } },
      { upsert: true },
    );
    const received = await MailUpload.countDocuments({ uploadId, owner: scope.user });
    return NextResponse.json({ success: true, uploadId, received, total: n, complete: received === n });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '올리기 실패' }, { status: 500 });
  }
}

/** DELETE /api/mail/upload?id= — 붙였던 파일을 뺄 때. 내 것만 지운다. */
export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const scope = await getMailScope();
    if (!scope) return NextResponse.json(UNAUTHORIZED, { status: 401 });
    const uploadId = String(new URL(req.url).searchParams.get('id') || '');
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(uploadId)) return bad('파일 번호가 올바르지 않습니다');
    const r = await MailUpload.deleteMany({ uploadId, owner: scope.user });
    return NextResponse.json({ success: true, deleted: r.deletedCount });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '삭제 실패' }, { status: 500 });
  }
}

function bad(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}
