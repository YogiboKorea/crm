/**
 * 양식 첨부(주소 방식) 확인 — 실제 발송 없음.
 * 받아오기 · 막아야 할 주소 · 만든 메일(MIME)에 파일과 그림이 들어가는지.
 * 실행: npx tsx scripts/check-template-attachments.mts
 */
import nodemailer from 'nodemailer';
import { loadTemplateAttachments, normalizeTemplateAttachments } from '../src/lib/mail/template-attachments.ts';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'X   '}${m}`); };

const PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const PNG = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';

const n1 = normalizeTemplateAttachments([{ url: PDF }, { url: PDF }, { name: '제품 소개서', url: PNG }]);
ok(n1.ok && n1.list.length === 2 && n1.list[0].name === 'dummy.pdf' && n1.list[1].name === '제품 소개서', '저장 전 정리 — 중복 제거 · 이름 없으면 주소의 파일 이름');
ok(!normalizeTemplateAttachments([{ url: 'ftp://x.com/a.pdf' }]).ok, 'ftp:// 주소는 저장 거절');
ok(!normalizeTemplateAttachments(Array.from({ length: 6 }, (_, i) => ({ url: `https://a.com/${i}.pdf` }))).ok, '6개 이상 거절');

const good = await loadTemplateAttachments([{ name: 'Yogico Catalog.pdf', url: PDF }, { name: 'logo', url: PNG }]);
ok(good.ok && good.files.length === 2, `파일 2개 받아옴 ${good.ok ? good.files.map((f) => `${f.filename} ${f.contentType} ${f.content.length}B`).join(' / ') : (good as any).error}`);
if (good.ok) ok(good.files[1].filename === 'logo.png', `확장자 없는 이름엔 주소 확장자를 붙임 → ${good.files[1].filename}`);

const html = await loadTemplateAttachments([{ name: 'page', url: 'https://www.w3.org/' }]);
ok(!html.ok && /웹페이지/.test((html as any).error), `웹페이지 주소는 거절 → ${(html as any).error}`);
const missing = await loadTemplateAttachments([{ name: 'none.pdf', url: 'https://www.w3.org/this-file-does-not-exist-0914.pdf' }]);
ok(!missing.ok && /404/.test((missing as any).error), `없는 파일은 거절 → ${(missing as any).error}`);
const internal = await loadTemplateAttachments([{ name: 'x', url: 'http://127.0.0.1:3000/api/leads' }]);
ok(!internal.ok, `내부 주소는 거절 → ${(internal as any).error}`);
const none = await loadTemplateAttachments([]);
ok(none.ok && none.files.length === 0, '첨부 없으면 그대로 통과');

// 실제 발송 대신 메일 원문만 만들어 본다 (streamTransport — 네트워크로 나가지 않음)
if (good.ok) {
  const t = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const info: any = await t.sendMail({
    from: '"Yogico" <david@yogico.kr>', to: 'fe@yogico.kr', subject: 'attachment test',
    html: `<p>Hello</p><img src="${PNG}" alt="" width="544" style="max-width:100%">`,
    text: 'Hello',
    attachments: good.files,
  });
  const raw = info.message.toString();
  ok(/Content-Type: multipart\/mixed/.test(raw), '메일이 첨부 형식(multipart/mixed)으로 만들어짐');
  ok(/filename="?Yogico Catalog\.pdf"?/.test(raw) || /Yogico_Catalog|Yogico Catalog/.test(raw), 'PDF 파일 이름이 들어감');
  ok(/Content-Type: application\/pdf/.test(raw) && /Content-Type: image\/png/.test(raw), 'PDF · PNG 파일 형식이 맞게 들어감');
  ok(raw.includes(`src=3D"${PNG.slice(0, 30)}`) || raw.includes(`src="${PNG}"`), '본문 그림은 주소(src)로 들어감');
  console.log(`      만든 메일 크기 ${(raw.length / 1024).toFixed(1)}KB`);
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
