/**
 * 마스터 계정이 발송 계정을 볼 수 있는지 확인한다.
 *
 * admin 이 등록한 계정 두 개가 yogico 로 로그인하면 하나도 안 보여
 * "보내는 계정" 칸이 비던 문제를 고친 뒤의 확인용이다.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const parse = (v) => String(v||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
const masters = parse(process.env.ADMIN_IDS).length
  ? parse(process.env.ADMIN_IDS)
  : [...new Set([...parse(process.env.ADMIN_ID), 'admin', 'yogico'])];
const isMaster = (u) => masters.includes(String(u||'').toLowerCase());

await mongoose.connect(process.env.MONGODB_URI);
const A = mongoose.connection.collection('mailaccounts');
const U = mongoose.connection.collection('adminusers');

console.log('마스터로 인정되는 아이디:', masters.join(', '), '\n');

const users = await U.find({}).project({ username: 1 }).toArray();
for (const u of users) {
  const filter = isMaster(u.username) ? { isActive: { $ne: false } } : { owner: u.username, isActive: { $ne: false } };
  const list = await A.find(filter).toArray();
  console.log(`${String(u.username).padEnd(10)} ${isMaster(u.username) ? '마스터' : '일반  '}  보이는 발송 계정 ${list.length}개`);
  for (const a of list) {
    console.log(`             · ${String(a.smtpUser).padEnd(22)} owner=${a.owner}${a.isDefault ? '  [기본]' : ''}`);
  }
  if (!list.length) console.log('             ⚠ 보내는 계정 칸이 비어 메일을 보낼 수 없습니다');
}

const defaults = await A.countDocuments({ isDefault: true, isActive: { $ne: false } });
console.log(`\n기본 계정 ${defaults}개 ${defaults === 1 ? '(OK)' : '(⚠ 하나여야 합니다 — 어느 주소로 나가는지 알 수 없습니다)'}`);

await mongoose.disconnect();
