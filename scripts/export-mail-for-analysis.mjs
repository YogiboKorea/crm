/**
 * AI 분석이 안 된 메일을 JSON 으로 뽑는다.
 * Anthropic API 를 부르지 않고 Claude Code 세션에서 직접 분석하기 위한 입력.
 */
import mongoose from 'mongoose';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '');
await mongoose.connect(uri);
const db = mongoose.connection.db;

// 어제까지 받은 것만. 오늘 것은 아직 들어오는 중이라 다음 회차에 돌린다.
const until = new Date(); until.setHours(0, 0, 0, 0);
const mails = await db.collection('inboundmails').find({
  classification: { $nin: ['ad', 'system'] },
  direction: { $ne: 'out' },
  trashedAt: null,
  'analysis.method': { $ne: 'ai' },
  date: { $lt: until },
}).sort({ date: -1 }).toArray();
console.log('기준: ' + until.toISOString().slice(0, 10) + ' 이전 수신분');

// 리드 회사명을 붙여준다 — 우리가 먼저 콜드메일을 보낸 곳인지가 판단에 크게 작용한다
const leadIds = [...new Set(mails.map((m) => m.leadId).filter(Boolean))];
const leads = await db.collection('leads').find({ leadId: { $in: leadIds } }, { projection: { leadId: 1, Company: 1, Country: 1 } }).toArray();
const leadMap = new Map(leads.map((l) => [l.leadId, l]));

const out = mails.map((m) => {
  const body = (m.bodyStripped || m.raw?.text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const lead = m.leadId ? leadMap.get(m.leadId) : null;
  return {
    id: String(m._id),
    subject: m.subject || '',
    from: `${m.from?.name || ''} <${m.from?.address || ''}>`.trim(),
    to: (m.to || []).map((t) => t.address).join(', '),
    date: m.date ? new Date(m.date).toISOString().slice(0, 10) : '',
    folder: m.folder || '',
    group: m.group || '',
    hasAttach: (m.attachments || []).length,
    ruleClass: m.classification,
    lead: lead ? `${lead.Company} (${lead.Country})` : '',
    body: body.slice(0, 2400),
    truncated: body.length > 2400,
  };
});

fs.mkdirSync('scripts/mail-analysis', { recursive: true });
const CHUNK = 25;
let files = 0;
for (let i = 0; i < out.length; i += CHUNK) {
  const p = `scripts/mail-analysis/batch-${String(files + 1).padStart(2, '0')}.json`;
  fs.writeFileSync(p, JSON.stringify(out.slice(i, i + CHUNK), null, 1), 'utf8');
  files++;
}
console.log(`총 ${out.length}통 → ${files}개 파일 (batch-01 ~ batch-${String(files).padStart(2,'0')})`);
console.log(`본문 잘린 것: ${out.filter((o) => o.truncated).length}통`);
console.log('\n오늘 날짜 기준(기한 계산용):', new Date().toISOString().slice(0, 10));
await mongoose.disconnect();
