/**
 * public/app.js 건강 점검 — 브라우저를 열지 않고 돌린다.
 *
 * 왜 필요한가:
 * app.js 는 1만 줄이 넘는 한 파일이라, 큰 함수를 통째로 갈아끼울 때 그 위에
 * 있던 var 선언까지 같이 잘려나가기 쉽다. 실제로 발송 관리 화면의 전역 네 개
 * (_outboxTab · _outboxReadyIds · _outboxCompose · _outboundStatusCache)가
 * 설명서를 교체하다 함께 사라져 "_outboundStatusCache is not defined" 로 터졌다.
 *
 * node --check 는 문법만 본다. 이런 누락은 그 코드를 실제로 실행할 때야
 * ReferenceError 가 되므로, 화면을 하나하나 눌러보기 전에는 드러나지 않는다.
 * 여기서는 app.js 를 vm 으로 평가해 보고, 주요 화면 함수와 전역이 살아 있는지,
 * HTML 생성 함수가 실제로 돌아가는지까지 확인한다.
 *
 * 쓰는 법:  node scripts/check-app.mjs
 * (public/app.js 를 고친 뒤 npm run build 전에 한 번 돌리면 좋다)
 */
import fs from 'fs';
import vm from 'vm';

const src = fs.readFileSync('public/app.js', 'utf8');

// 아주 얕은 DOM 스텁 — 렌더 함수가 참조하는 최소한만 채운다
const el = () => ({
  innerHTML: '', textContent: '', value: '', dataset: {},
  style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' },
  classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
  addEventListener() {}, removeEventListener() {}, appendChild() {}, removeChild() {}, remove() {},
  querySelector: () => null, querySelectorAll: () => [], closest: () => null,
  setAttribute() {}, getAttribute: () => null, removeAttribute() {}, hasAttribute: () => false,
  insertAdjacentHTML() {}, focus() {}, scrollTo() {}, blur() {}, click() {},
  parentNode: null, disabled: false, checked: false, hidden: false,
});
const doc = {
  getElementById: () => el(), querySelector: () => null, querySelectorAll: () => [],
  createElement: () => el(), addEventListener() {}, body: el(), documentElement: el(),
  createRange: () => ({ selectNodeContents() {}, collapse() {} }),
  documentElement: el(),
  execCommand() {}, getSelection: () => ({ removeAllRanges() {}, addRange() {}, toString: () => '' }),
};
const sandbox = {
  document: doc,
  window: { addEventListener() {}, location: { href: '' }, innerWidth: 1400, matchMedia: () => ({ matches: false, addEventListener() {} }) },
  navigator: { clipboard: { writeText: async () => {} }, userAgent: 'node' },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  fetch: async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ success: true, data: [], templates: [], variables: [], accounts: [], items: [], batches: [], stages: {} }) }),
  console: { log() {}, warn() {}, error() {} },
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
  alert() {}, confirm: () => false, prompt: () => null,
  requestAnimationFrame: (f) => f(),
  URLSearchParams, URL, Map, Set, Date, Math, JSON, Intl, Promise, Error, RegExp,
};
sandbox.globalThis = sandbox;
sandbox.window.document = doc;

const ctx = vm.createContext(sandbox);
try {
  vm.runInContext(src, ctx, { filename: 'app.js' });
  console.log('✅ app.js 평가 통과 (문법·최상위 실행 오류 없음)');
} catch (e) {
  console.log('❌ app.js 평가 실패:', e.message);
  process.exit(1);
}

// 주요 렌더 함수가 정의돼 있는지 + 참조하는 전역이 살아 있는지
const FNS = [
  'renderOutboxPage', 'outboxReadyHtml', 'outboxScheduledHtml', 'outboxSentHtml',
  'outboxLeadTableHtml', 'outboxSendCountBadge', 'openSendLogicModal',
  'renderTemplateListPage', 'openTemplateEditor', 'renderB2BEmailManager',
  'renderUserGuidePage', 'renderLegacyPage', 'loadOutboundStatus', 'openOutboxPeek',
  'currentMailboxAccountId', 'moveSelectedToQueue', 'runOutboxCampaign',
];
const missing = FNS.filter((f) => typeof ctx[f] !== 'function');
if (missing.length) {
  console.log('❌ 없는 함수:', missing.join(', '));
  process.exit(1);
}
console.log('✅ 화면 함수', FNS.length, '개 모두 정의됨');

// 전역 캐시 변수들
const VARS = ['_outboxTab', '_outboxReadyIds', '_outboxCompose', '_outboundStatusCache',
  '_inboxState', '_mailAccountsCache', '_mailGroupsCache', '_mailCountsCache',
  '_stageCountsCache', '_composeState', '_legacy', '_schedStatusFilter'];
const missingVars = VARS.filter((v) => !(v in ctx));
if (missingVars.length) {
  console.log('❌ 선언 안 된 전역:', missingVars.join(', '));
  process.exit(1);
}
console.log('✅ 전역 변수', VARS.length, '개 모두 선언됨');

// 순수 HTML 생성 함수는 실제로 호출해 본다
const lock = { locked: true, testRecipients: ['fe@yogico.kr'], dailyCap: 20, intervalMs: 8000 };
const lead = { leadId: 'x', Company: 'Test Co', Country: 'UK', Email: 'a@b.com',
  WebsiteContact: 'https://b.com', TypeKo: '유통사', emailHistory: [{ status: 'sent', sentAt: new Date().toISOString() }],
  lastEmailSentAt: new Date().toISOString(), inboundCount: 0 };
const checks = [
  ['outboxLeadTableHtml', () => ctx.outboxLeadTableHtml([lead], 1, false)],
  ['outboxLeadTableHtml(sent)', () => ctx.outboxLeadTableHtml([lead], 1, true)],
  ['outboxSendCountBadge', () => ctx.outboxSendCountBadge(lead, {})],
  ['outboxSentHtml', () => ctx.outboxSentHtml([], [lead])],
  ['outboxScheduledHtml', () => ctx.outboxScheduledHtml([], [], [])],
  ['outboxLockBannerHtml', () => ctx.outboxLockBannerHtml(lock)],
];

// 팝업은 DOM 에 붙이므로 예외 없이 끝나는지만 본다
const modals = [
  ['openOutboxPeek(lead)', () => ctx.openOutboxPeek('보낼 메일', [lead], { kind: 'lead' })],
  ['openOutboxPeek(sent)', () => ctx.openOutboxPeek('발송 완료', [lead], { kind: 'lead', sent: true })],
  ['openOutboxPeek(schedule)', () => ctx.openOutboxPeek('예약 발송',
    [{ _id: 's1', leadId: 'x', to: 'a@b.com', scheduledFor: new Date().toISOString(), lead }], { kind: 'schedule' })],
  ['openSendLogicModal', () => ctx.openSendLogicModal(lock)],
];
for (const [name, fn] of modals) {
  try { fn(); } catch (e) {
    console.log(`❌ ${name} 실행 실패: ${e.message}`);
    process.exit(1);
  }
}
console.log('✅ 팝업 함수', modals.length, '개 실행 통과');
for (const [name, fn] of checks) {
  try {
    const out = fn();
    if (typeof out !== 'string' || !out.length) throw new Error('빈 결과');
  } catch (e) {
    console.log(`❌ ${name} 실행 실패: ${e.message}`);
    process.exit(1);
  }
}
console.log('✅ HTML 생성 함수', checks.length, '개 실행 통과');

// ── CSS 변수 점검 ────────────────────────────────────────────
//
// app.js 는 background:var(--surface-1) 처럼 CSS 변수로 색을 쓴다.
// 그 변수가 :root 에 없으면 값이 "없음"이 되어 배경이 투명해진다.
// 팝업 카드가 투명해져 뒤 화면과 겹쳐 보이던 문제가 이것이었다.
// 빌드는 통과하므로(app.js 는 컴파일되지 않는다) 여기서 본다.
{
  const css = fs.readFileSync('src/app/styles.css', 'utf8');

  const globalDefs = new Set();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().split('\n').pop().trim();
    if (!sel.includes(':root') && !/^(html|body)\b/.test(sel)) continue;
    for (const v of m[2].matchAll(/(--[a-z0-9-]+)\s*:/gi)) globalDefs.add(v[1]);
  }

  // var(--x, 대체값) 처럼 대체값이 있으면 비어도 괜찮다
  const missing = new Map();
  for (const m of src.matchAll(/var\((--[a-z0-9-]+)\s*(,[^)]*)?\)/gi)) {
    if (globalDefs.has(m[1]) || m[2]) continue;
    missing.set(m[1], (missing.get(m[1]) || 0) + 1);
  }

  if (missing.size) {
    console.log('❌ :root 에 없는 CSS 변수를 대체값 없이 사용 중 — 화면에서 투명/무색으로 보입니다');
    for (const [v, n] of [...missing].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${String(n).padStart(4)}곳  ${v}`);
    }
    console.log('   → src/app/styles.css 의 :root 에 추가하거나 var(--x, 대체값) 형태로 쓰세요');
    process.exit(1);
  }
  console.log('✅ CSS 변수 모두 :root 에서 해결됨');
}

// ── init() 호출 위치 점검 ────────────────────────────────────
//
// 이 파일의 최상위 var 들은 선언만 끌어올려지고 대입은 그 줄에 닿아야 실행된다.
// init() 을 파일 위쪽에서 부르면 아래에 있는 var 가 전부 undefined 인 채로
// 화면을 그리기 시작한다. 실제로 두 번 터졌다 —
//   _countryFacet.list / _popupLeadCache.find → 첫 화면이 통째로 죽음.
//
// vm 평가만으로는 안 잡힌다. 스텁 DOM 에서는 그 경로까지 안 가는 일이 많아서다.
// 그래서 위치 자체를 규칙으로 못박는다.
{
  const lines = src.split(/\r?\n/);
  const initLine = lines.findIndex((l) => /^\s*init\(\);?\s*$/.test(l));
  if (initLine < 0) {
    console.log('❌ init() 호출을 찾지 못했습니다');
    process.exit(1);
  }

  const late = [];
  lines.forEach((l, i) => {
    const m = l.match(/^var ([A-Za-z_$][\w$]*)\s*=/);
    if (m && i > initLine) late.push({ name: m[1], line: i + 1 });
  });

  if (late.length) {
    console.log(`❌ init() 이 ${initLine + 1}행에서 불리는데, 그 뒤에 대입되는 최상위 var 가 ${late.length}개 있습니다`);
    console.log('   → 그 변수들은 첫 렌더에서 undefined 입니다. init() 호출을 파일 맨 아래로 옮기세요.');
    for (const v of late.slice(0, 8)) console.log(`     ${String(v.line).padStart(6)}  ${v.name}`);
    if (late.length > 8) console.log(`     … 외 ${late.length - 8}개`);
    process.exit(1);
  }
  console.log('✅ init() 이 모든 전역 대입 뒤에서 호출됨');
}
