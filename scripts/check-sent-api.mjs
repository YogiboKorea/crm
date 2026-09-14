/**
 * 보낸 메일함 API 확인 — 목록 · 한 통 내용 · 첨부 내려받기 (모두 읽기만).
 * 받은 크기 = 파싱 때 알려준 크기인지까지 본다.
 */
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const jwt = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const H = { headers: { Cookie: `admin_session=${jwt}` } };
const B = 'http://localhost:3000';
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const secs = (t) => ((Date.now() - t) / 1000).toFixed(1) + '초';

let t = Date.now();
const list = await fetch(`${B}/api/mail/sent?page=1`, H).then((r) => r.json());
ok(list.success, `목록 ${secs(t)} · 계정 ${list.account?.address} · 폴더 "${list.folder}" · 전체 ${list.total}통 · ${list.totalPages}쪽 ${list.error || ''}`);
for (const m of (list.items || []).slice(0, 5)) {
  console.log(`     ${String(m.date).slice(0, 10)} → ${(m.to[0] || {}).address || '-'} ${m.hasAttachment ? '📎' : '  '} ${m.subject.slice(0, 44)}`);
}
if (list.items?.length > 1) ok(new Date(list.items[0].date) >= new Date(list.items[list.items.length - 1].date), '최신순 정렬');

if (list.totalPages > 1) {
  t = Date.now();
  const p2 = await fetch(`${B}/api/mail/sent?page=2`, H).then((r) => r.json());
  const overlap = (p2.items || []).some((x) => list.items.some((y) => y.uid === x.uid));
  ok(p2.success && p2.items.length && !overlap, `2쪽 ${secs(t)} · ${p2.items?.length}통 · 1쪽과 겹침 없음`);
}

const target = (list.items || []).find((m) => m.hasAttachment) || (list.items || [])[0];
if (target) {
  t = Date.now();
  const d = await fetch(`${B}/api/mail/sent/${target.uid}`, H).then((r) => r.json());
  ok(d.success && d.mail.subject === target.subject, `내용 ${secs(t)} · "${d.mail?.subject?.slice(0, 40)}" · 본문 text ${d.mail?.text?.length} / html ${d.mail?.html?.length} ${d.error || ''}`);
  ok((d.mail?.text?.length || 0) + (d.mail?.html?.length || 0) > 0, '본문이 비어 있지 않음');
  const a = d.mail?.attachments?.[0];
  if (a) {
    t = Date.now();
    const r = await fetch(`${B}/api/mail/sent/${target.uid}/attachment?part=${a.partId}&name=${encodeURIComponent(a.filename)}&type=${encodeURIComponent(a.contentType)}`, H);
    const buf = Buffer.from(await r.arrayBuffer());
    ok(r.status === 200 && buf.length === a.size, `첨부 ${secs(t)} · ${a.filename} · 받은 ${buf.length} = ${a.size}`);
  } else console.log('  (첫 쪽에 첨부 있는 메일 없음)');
}

const bad = await fetch(`${B}/api/mail/sent/999999999`, H).then((r) => r.json());
ok(!bad.success && /찾지 못/.test(bad.error || ''), `없는 메일 → "${bad.error}"`);
const noLogin = await fetch(`${B}/api/mail/sent`, { redirect: 'manual' });
ok([302, 307].includes(noLogin.status), `로그인 없이 → ${noLogin.status}`);

console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
