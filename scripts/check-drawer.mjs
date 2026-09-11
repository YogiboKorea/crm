/** 좁은 화면 서랍이 실제로 열리고 닫히는지, 본문이 첫 화면에 있는지 확인 */
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const jwt = await new SignJWT({ user: process.env.ADMIN_ID || 'yogico', role: 'admin' })
  .setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('24h').sign(secret);
const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox'] });
const page = await browser.newPage();
await page.setCookie({ name:'admin_session', value:jwt, domain:'localhost', path:'/' });

let fail = 0;
const ok = (c, m) => { if(!c) fail++; console.log(`  ${c?'OK  ':'X   '}${m}`); };

for (const w of [390, 620, 900, 1024]) {
  console.log(`\n──── ${w}px ────`);
  await page.setViewport({ width:w, height:844 });
  await page.goto('http://localhost:3000/', { waitUntil:'networkidle2' });
  await new Promise(r=>setTimeout(r,1400));

  const narrow = w <= 900;
  const st = await page.evaluate(() => {
    const sb = document.getElementById('appSidebar');
    const btn = document.getElementById('navDrawerBtn');
    const title = document.getElementById('viewTitle');
    return {
      btnVisible: btn ? getComputedStyle(btn).display !== 'none' : null,
      sbLeft: sb ? Math.round(sb.getBoundingClientRect().left) : null,
      sbW: sb ? Math.round(sb.getBoundingClientRect().width) : null,
      titleTop: title ? Math.round(title.getBoundingClientRect().top) : null,
      pageH: document.scrollingElement.scrollHeight,
    };
  });
  ok(st.btnVisible === narrow, `☰ 버튼 ${narrow?'보임':'숨김'} (실제 ${st.btnVisible?'보임':'숨김'})`);
  ok(st.titleTop >= 0 && st.titleTop < 200, `본문 제목이 첫 화면에 있다 (top=${st.titleTop}px)`);
  if (narrow) ok(st.sbLeft <= -200, `서랍이 화면 밖에 있다 (left=${st.sbLeft}px)`);
  else ok(st.sbLeft === 0, `넓은 화면에선 사이드바 고정 (left=${st.sbLeft}px)`);

  if (narrow) {
    await page.click('#navDrawerBtn');
    await new Promise(r=>setTimeout(r,400));
    const open = await page.evaluate(() => ({
      left: Math.round(document.getElementById('appSidebar').getBoundingClientRect().left),
      flag: document.body.getAttribute('data-nav-open'),
      backdrop: getComputedStyle(document.getElementById('navBackdrop')).opacity,
      labelShown: getComputedStyle(document.querySelector('.nav-label')).display !== 'none',
    }));
    ok(open.left === 0 && open.flag === 'true', `☰ 누르면 열린다 (left=${open.left})`);
    ok(Number(open.backdrop) > 0.3, `뒷막이 덮인다 (opacity=${open.backdrop})`);
    ok(open.labelShown, '서랍에서 메뉴 글자가 보인다');

    // 메뉴를 고르면 닫히는가
    await page.evaluate(()=>document.querySelector('.nav-item[data-view="tool-inbox"]').click());
    await new Promise(r=>setTimeout(r,500));
    const after = await page.evaluate(()=>document.body.getAttribute('data-nav-open'));
    ok(after !== 'true', '메뉴를 고르면 저절로 닫힌다');

    // Esc 로 닫히는가
    await page.click('#navDrawerBtn');
    await new Promise(r=>setTimeout(r,350));
    await page.keyboard.press('Escape');
    await new Promise(r=>setTimeout(r,350));
    ok(await page.evaluate(()=>document.body.getAttribute('data-nav-open')) !== 'true', 'Esc 로 닫힌다');

    // 뒷막 눌러 닫히는가
    await page.click('#navDrawerBtn');
    await new Promise(r=>setTimeout(r,350));
    await page.evaluate(()=>document.getElementById('navBackdrop').click());
    await new Promise(r=>setTimeout(r,350));
    ok(await page.evaluate(()=>document.body.getAttribute('data-nav-open')) !== 'true', '뒷막을 눌러 닫힌다');
  }
}
console.log(fail ? `\n✗ ${fail}개 실패` : '\n✅ 전부 통과');
await browser.close();
process.exit(fail?1:0);
