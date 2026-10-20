/**
 * 강제 로그아웃 확인 (2026-10-20) — **임시 아이디로만** 시험한다. 실제 아이디(yogico·admin·david·hoon·fe)는 건드리지 않는다.
 *
 *   1) 로그인 출입증으로 화면이 열린다
 *   2) 내보내면(revokeSessions) 그 출입증으로는 로그인 화면으로 튕기고 쿠키가 지워진다
 *   3) 비밀번호를 바꾸면 예전 출입증은 끊기고, 바꾼 본인은 새 출입증으로 계속 쓴다
 *
 * 사용: CRM_BASE=http://localhost:3000 npx tsx scripts/check-revoke-sessions.mts
 */
import mongoose from 'mongoose';
import crypto from 'crypto';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const B = process.env.CRM_BASE || 'http://localhost:3000';
let fail = 0;
const ok = (c: any, m: string) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const w = (ms: number) => new Promise((r) => setTimeout(r, ms));
const { revokeSessions } = await import('../src/lib/session-revoke.ts');

await mongoose.connect(process.env.MONGODB_URI!);
const U = mongoose.connection.db!.collection('adminusers');
const USER = `zz-revoke-${Date.now()}`;
await U.insertOne({ username: USER, passwordHash: crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex'), createdAt: new Date(), sessionsValidAfter: null });
const sign = () => new SignJWT({ user: USER, role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET!));
const page = async (tok: string) => {
  const r = await fetch(`${B}/`, { headers: { Cookie: `admin_session=${tok}` }, redirect: 'manual' });
  return { status: r.status, to: r.headers.get('location') || '', cleared: /admin_session=;|admin_session=(?:\s*;)?[^;]*;\s*(?:Path=\/;\s*)?(?:Expires|Max-Age=0)/i.test(r.headers.get('set-cookie') || '') };
};

try {
  console.log(`임시 아이디 ${USER}`);
  const t1 = await sign();
  let r = await page(t1);
  ok(r.status === 200, `1) 로그인 상태로 화면 열림 (HTTP ${r.status})`);

  await w(1100);
  await revokeSessions([USER]);
  console.log('     내보냄 — 서버가 기억한 값(30초)이 지나기를 기다립니다');
  await w(31_000);
  r = await page(t1);
  ok((r.status === 307 || r.status === 302 || r.status === 308) && /\/login/.test(r.to), `2) 내보낸 뒤 그 출입증 → 로그인 화면으로 (HTTP ${r.status} → ${r.to.replace(B, '')})`);
  ok(r.cleared, '   쿠키도 지움');

  await w(1100);
  const t2 = await sign();               // 내보낸 뒤에 새로 로그인한 출입증
  r = await page(t2);
  ok(r.status === 200, `   내보낸 뒤 새로 로그인하면 들어옴 (HTTP ${r.status})`);

  // 3) 비밀번호 변경 — 화면의 [비밀번호 변경] 과 같은 요청
  await w(1100);
  const res = await fetch(`${B}/api/users/password`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `admin_session=${t2}` },
    body: JSON.stringify({ newPassword: crypto.randomUUID() }),
  });
  const j: any = await res.json().catch(() => ({}));
  const fresh = (res.headers.get('set-cookie') || '').match(/admin_session=([^;]+)/)?.[1] || '';
  ok(j.success && fresh, `3) 비밀번호 변경 성공 · 새 출입증 받음`);
  await w(31_000);
  r = await page(t2);
  ok(r.status !== 200 && /\/login/.test(r.to), `   예전 출입증(바꾸기 전 로그인) → 로그인 화면으로 (HTTP ${r.status})`);
  r = await page(fresh);
  ok(r.status === 200, `   바꾼 본인의 새 출입증은 그대로 (HTTP ${r.status})`);
} catch (e: any) {
  fail++;
  console.log(`  X   중단: ${e?.message || e}`);
} finally {
  const d = await U.deleteOne({ username: USER });
  console.log(`\n임시 아이디 치움 (${d.deletedCount})`);
  await mongoose.disconnect();
}
console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 강제 로그아웃 · 비밀번호 변경 시 다른 로그인 끊기 확인');
process.exit(fail ? 1 : 0);
