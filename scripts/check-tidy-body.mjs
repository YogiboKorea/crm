/**
 * 본문 다듬기가 표 메일은 촘촘하게, 사람이 쓴 메일은 문단 그대로 두는지 본다.
 * 실제 API(/api/mail/[id]) 응답으로 확인한다 — 로직을 복사해 시험하면 실제 코드와 어긋날 수 있다.
 */
import { SignJWT } from 'jose';
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: 'yogico', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
await mongoose.connect(process.env.MONGODB_URI);
const M = mongoose.connection.collection('inboundmails');
const pick = (q) => M.findOne({ trashedAt: null, ...q }, { projection: { subject: 1, bodyStripped: 1, 'raw.text': 1 } });
const samples = [
  ['표 메일 (피싱)', await pick({ subject: /이용약관 위반/ }), 'table'],
  ['쿠팡 광고 알림', await pick({ subject: /Coupang Ads/ }), 'any'],
  ['사람 — 영문 주문', await pick({ subject: /Quick Order Needed/ }), 'human'],
  ['사람 — 톤28 운송장', await pick({ subject: /CPNP 상품 리스트/, 'from.address': /toun28/ }), 'human'],
  ['사람 — 오스템파마', await pick({ subject: /Normal 요청 사항/ }), 'human'],
  ['사람 — 일소 미팅정리', await pick({ subject: /해외진출 사업개발 제안건/, 'from.address': /milip/ }), 'human'],
];
await mongoose.disconnect();

const paras = (t) => t.split(/\n\s*\n/).filter((p) => p.trim()).length;
let fail = 0;
for (const [label, m, kind] of samples) {
  if (!m) { console.log(`  (${label} 없음)`); continue; }
  const before = m.bodyStripped || m.raw?.text || '';
  const r = await fetch(`http://localhost:3000/api/mail/${m._id}`, { headers: { Cookie: `admin_session=${jwt}` } });
  const after = (await r.json()).mail.body;
  const bl = before.split('\n').length, al = after.split('\n').length;
  const maxBlank = Math.max(0, ...(after.match(/\n{2,}/g) || []).map((x) => x.length - 1));
  let good = maxBlank <= 1 && after.replace(/\s+/g, '') === before.replace(/\s+/g, '');
  let note = '';
  if (kind === 'human') {
    // 사람이 쓴 문단 수가 유지돼야 한다
    const pb = paras(before), pa = paras(after);
    good = good && pa === pb;
    note = ` · 문단 ${pb}→${pa}`;
  }
  if (kind === 'table') { good = good && al < bl / 3; note = ` · 줄 수 1/3 이하`; }
  if (!good) fail++;
  console.log(`${good ? 'OK ' : 'X  '} ${label.padEnd(16)} 줄 ${String(bl).padStart(3)} → ${String(al).padStart(3)} · 연속빈줄 ${maxBlank}${note} · 글자 손실 ${after.replace(/\s+/g, '') === before.replace(/\s+/g, '') ? '없음' : '있음!'}`);
  if (kind === 'table') console.log('     ' + after.slice(0, 220).replace(/\n/g, '↵'));
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
