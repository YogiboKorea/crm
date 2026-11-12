/**
 * 🤖 AI 메일 비서 — 파일 읽기 확인 (2026-11-12, lib/ai/attachments.ts).
 *
 *   1) 견본 PDF · 엑셀을 만들어 Claude 가 읽을 수 있게 올린다 (Anthropic Files API — 올리기는 무료)
 *   2) Haiku 5.5 에 한 번 물어 견본 안의 숫자를 맞히는지 본다 — **유일하게 돈이 드는 곳 (약 1원)**
 *   3) 대표님 메일함에서 PDF·엑셀 첨부가 있는 메일을 찾아 read_attachment 도구가 메일 서버에서 꺼내 오는지 본다 (Claude 는 부르지 않는다)
 *   4) 올린 파일은 모두 지운다
 *
 * 사용: npx tsx scripts/check-ai-chat-files.mts [--no-claude]   (--no-claude 면 2번을 건너뛴다)
 */
import mongoose from 'mongoose';
import puppeteer from 'puppeteer';
import * as XLSX from 'xlsx';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

let fail = 0;
const ok = (c: any, m: string) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };
const NO_CLAUDE = process.argv.includes('--no-claude');

const { prepareFile, blocksFor, deleteFiles } = await import('../src/lib/ai/attachments.ts');
const { runMailTool } = await import('../src/lib/ai/mail-chat.ts');
const { client } = await import('../src/lib/ai/client.ts');
const { accountIdsForOwner } = await import('../src/lib/mail/scope.ts');
const uploaded: string[] = [];

try {
  // 1) 견본 파일
  const b = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox'] });
  const pg = await b.newPage();
  await pg.setContent('<h2>PROFORMA INVOICE PI-7731</h2><table border=1><tr><th>Item</th><th>Qty</th><th>Unit USD</th></tr><tr><td>PDRN Serum 30ml</td><td>2,400</td><td>4.85</td></tr></table><p>Total: USD 11,640</p>');
  const pdf = Buffer.from(await pg.pdf({ format: 'A4' }));
  await b.close();
  const ws = XLSX.utils.aoa_to_sheet([['Item', 'Qty', 'Unit USD'], ['Arencia Booster', 1500, 5.7], ['Sungboon Editor Pack', 820, 3.2]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Order');
  const xlsx = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  const fp = await prepareFile(pdf, 'PI-7731.pdf', 'application/pdf');
  const fx = await prepareFile(xlsx, 'order.xlsx', '');
  const fh = await prepareFile(Buffer.from('x'), '계약서.hwp', '');
  for (const f of [fp, fx]) if (f.fileId) uploaded.push(f.fileId);
  ok(fp.kind === 'pdf' && !!fp.fileId, `PDF → Claude 가 그대로 읽게 올림 (${fp.fileId || fp.note})`);
  ok(fx.kind === 'text' && !!fx.fileId, `엑셀 → 표(글)로 바꿔 올림 (${fx.fileId || fx.note})`);
  ok(fh.kind === 'unsupported' && /HWP/.test(fh.note || ''), `HWP → 못 읽는다고 안내 (${fh.note})`);

  // 2) Claude 가 실제로 읽는가 — Haiku 5.5 한 번 (약 1원)
  if (!NO_CLAUDE) {
    const r: any = await client().beta.messages.create({
      model: 'claude-haiku-5-5', max_tokens: 400,
      messages: [{ role: 'user', content: [...blocksFor(fp), ...blocksFor(fx), { type: 'text', text: 'PI 번호, PDRN Serum 수량, 엑셀의 Arencia Booster 단가만 한 줄로 답해.' }] as any }],
    });
    const text = (r.content || []).filter((x: any) => x.type === 'text').map((x: any) => x.text).join(' ');
    ok(/7731/.test(text) && /2,?400/.test(text) && /5\.7/.test(text), `Claude 답: ${text.replace(/\s+/g, ' ').slice(0, 120)} (입력 ${r.usage?.input_tokens} 토큰)`);
  }

  // 3) 메일 첨부 — 메일 서버에서 꺼내 오기
  await mongoose.connect(process.env.MONGODB_URI!);
  const ids = await accountIdsForOwner('david');
  const im = mongoose.connection.db!.collection('inboundmails');
  for (const re of [/\.pdf$/i, /\.xlsx?$/i]) {
    const m: any = await im.findOne(
      { accountId: { $in: ids }, attachments: { $elemMatch: { filename: re, size: { $gt: 0, $lt: 3 * 1048576 }, partId: { $nin: [null, ''] } } } },
      { sort: { date: -1 }, projection: { subject: 1, attachments: 1 } },
    );
    if (!m) { console.log(`  -   ${re} 첨부가 있는 메일 없음`); continue; }
    const att = m.attachments.find((a: any) => re.test(a.filename) && a.size < 3 * 1048576);
    const out: any = await runMailTool('read_attachment', { id: String(m._id), file: att.filename });
    const fid = out?.__blocks?.find((x: any) => x.source?.file_id)?.source?.file_id;
    if (fid) uploaded.push(fid);
    ok(!out.error && !!fid, `메일 첨부 꺼내 읽기 — "${String(m.subject).slice(0, 40)}" · ${att.filename} → ${out.error || out.kind}`);
  }
} catch (e: any) {
  fail++;
  console.log('  X   ' + (e?.stack || e));
} finally {
  await deleteFiles(uploaded);
  console.log(`  올린 파일 ${uploaded.length}개 지움`);
  await mongoose.disconnect().catch(() => {});
}
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
