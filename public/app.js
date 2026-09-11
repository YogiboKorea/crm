const STORAGE_KEY = "kbeauty-crm-state-v1";
const DETAIL_WIDTH_KEY = "kbeauty-crm-detail-width";

const STATUSES = [
  "New",
  "Qualified",
  "Contacted",
  "Sample Sent",
  "Negotiating",
  "Won",
  "Lost"
];

const CONTINENT_ORDER = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Other"
];

const COUNTRY_CONTINENTS = {
  // Africa
  Algeria: "Africa",
  Angola: "Africa",
  Botswana: "Africa",
  "Burkina Faso": "Africa",
  Cameroon: "Africa",
  "Cote d'Ivoire": "Africa",
  Egypt: "Africa",
  Ethiopia: "Africa",
  Gambia: "Africa",
  Ghana: "Africa",
  "Ivory Coast": "Africa",
  Kenya: "Africa",
  Libya: "Africa",
  Mauritius: "Africa",
  Morocco: "Africa",
  Namibia: "Africa",
  Nigeria: "Africa",
  Rwanda: "Africa",
  Senegal: "Africa",
  "South Africa": "Africa",
  Tanzania: "Africa",
  Tunisia: "Africa",
  Uganda: "Africa",
  Zambia: "Africa",
  Zimbabwe: "Africa",

  // Asia
  Armenia: "Asia",
  Azerbaijan: "Asia",
  Bahrain: "Asia",
  Bangladesh: "Asia",
  Bhutan: "Asia",
  Brunei: "Asia",
  Cambodia: "Asia",
  China: "Asia",
  Georgia: "Asia",
  "Hong Kong": "Asia",
  India: "Asia",
  Indonesia: "Asia",
  Iran: "Asia",
  Iraq: "Asia",
  Israel: "Asia",
  Japan: "Asia",
  Jordan: "Asia",
  Kazakhstan: "Asia",
  Korea: "Asia",
  Kuwait: "Asia",
  Kyrgyzstan: "Asia",
  Laos: "Asia",
  Lebanon: "Asia",
  Malaysia: "Asia",
  Maldives: "Asia",
  Mongolia: "Asia",
  Myanmar: "Asia",
  Nepal: "Asia",
  Oman: "Asia",
  Pakistan: "Asia",
  Philippines: "Asia",
  Phillippines: "Asia", // 흔한 오타
  Qatar: "Asia",
  "Saudi Arabia": "Asia",
  Singapore: "Asia",
  "South Korea": "Asia",
  "Sri Lanka": "Asia",
  Syria: "Asia",
  Taiwan: "Asia",
  Tajikistan: "Asia",
  Thailand: "Asia",
  Turkey: "Asia",
  Turkmenistan: "Asia",
  UAE: "Asia",
  "United Arab Emirates": "Asia",
  Uzbekistan: "Asia",
  Vietnam: "Asia",
  Yemen: "Asia",

  // Europe
  Albania: "Europe",
  Austria: "Europe",
  Belarus: "Europe",
  Belgium: "Europe",
  "Bosnia and Herzegovina": "Europe",
  Bulgaria: "Europe",
  Croatia: "Europe",
  Cyprus: "Europe",
  Czech: "Europe",
  "Czech Republic": "Europe",
  Czechia: "Europe",
  Denmark: "Europe",
  Estonia: "Europe",
  Finland: "Europe",
  France: "Europe",
  Germany: "Europe",
  Greece: "Europe",
  Hungary: "Europe",
  Iceland: "Europe",
  Ireland: "Europe",
  Italy: "Europe",
  Kosovo: "Europe",
  Latvia: "Europe",
  Lithuania: "Europe",
  Luxembourg: "Europe",
  Malta: "Europe",
  Moldova: "Europe",
  Montenegro: "Europe",
  Netherlands: "Europe",
  "North Macedonia": "Europe",
  Norway: "Europe",
  Poland: "Europe",
  Portugal: "Europe",
  Romania: "Europe",
  Russia: "Europe",
  Serbia: "Europe",
  Slovakia: "Europe",
  Slovenia: "Europe",
  Spain: "Europe",
  Sweden: "Europe",
  Switzerland: "Europe",
  UK: "Europe",
  Ukraine: "Europe",
  "United Kingdom": "Europe",

  // North America
  Aruba: "North America",
  Bahamas: "North America",
  Barbados: "North America",
  Canada: "North America",
  "Costa Rica": "North America",
  Cuba: "North America",
  "Dominican Republic": "North America",
  "El Salvador": "North America",
  Guatemala: "North America",
  Haiti: "North America",
  Honduras: "North America",
  Jamaica: "North America",
  Mexico: "North America",
  Nicaragua: "North America",
  Panama: "North America",
  "Puerto Rico": "North America",
  "Trinidad and Tobago": "North America",
  USA: "North America",
  "United States": "North America",
  "United States of America": "North America",

  // South America
  Argentina: "South America",
  Bolivia: "South America",
  Brazil: "South America",
  Chile: "South America",
  Colombia: "South America",
  Ecuador: "South America",
  Guyana: "South America",
  Paraguay: "South America",
  Peru: "South America",
  Suriname: "South America",
  Uruguay: "South America",
  Venezuela: "South America",

  // Oceania
  Australia: "Oceania",
  Fiji: "Oceania",
  "French Polynesia": "Oceania",
  "New Zealand": "Oceania",
  "Papua New Guinea": "Oceania",
  Samoa: "Oceania",
};

let baseLeads = [];
let currentUser = null;
let isMaster = false;

let edits = {};
let customLeads = [];
let state = {
  view: "pipeline-import",
  query: "",
  country: "All",
  status: "All",
  priority: "All",
  verify: "All",
  selectedId: baseLeads[0]?.id || null,
  selectedLeadIds: new Set(),
  sortField: null,
  sortOrder: "asc",
  // 검증대기 페이지 하위 필터 (AI 진행 여부로 나눔)
  //   'unverified'  - AI 미검증 (아직 처리 전) — DEFAULT: "검증 전 상태" 만 보이도록
  //   'maybe'       - AI 검증됨: 모호 판정 (사람 판단 필요)
  //   'failed'      - 검증 실패 (archived stage + not-buyer 판정) — cross-stage
  //   'all'         - 전체 (verifying stage 만)
  verifyingSubFilter: 'unverified',
  // 테이블 페이지네이션 (기본 50건 · 사용자가 25/50/100 선택 가능)
  pagination: { pageSize: 50, currentPage: 1 },
  // Import 배치별 폴더 뷰 (검증대기/완료/실패 페이지 공용)
  //   null = 폴더 목록 모드 · string = 특정 배치 안의 리드 리스트
  folderView: { openBatch: null },
  // 검증완료 페이지 서브 필터 (승인 상태로 나눔)
  //   'all'        - 전체 verified
  //   'approved'   - readyForOutreach=true (검증 완료 목록)
  //   'pending'    - readyForOutreach=false (승인 대기)
  //   'no-email'   - Email 필드 비었거나 "Not found" — 승인 불가
  verifiedSubFilter: 'all',
  tierFilter: null,   // 검증완료 A/B/C 등급 필터

  // 검증완료 페이지 상단 상위 탭 (성공/실패)
  //   'success' (default) - verified stage 리드
  //   'failed'  - archived + not-buyer (구 pipeline-failed)
  verifiedResultTab: 'success',
  // B2B 메일 매니저 전용 서브 상태
  email: {
    templates: [],
    variables: [],
    variableGroups: [],
    currentTemplateId: null,
    mode: 'list',            // 'list' = 게시판 · 'edit' = 편집기
    previewAccountId: null,
    wizardStep: 1,           // 템플릿 생성 마법사 스텝 (1..4)

    editor: null,           // { name, language, subject, body, purpose, bodyIsHtml, isActive }
    previewLeadId: null,
    previewResult: null,    // { subject, body, missing }
    loading: false,
    dirty: false,
  },
};

const els = {
  get navItems() { return [...document.querySelectorAll(".nav-item")]; },
  get viewTitle() { return document.getElementById("viewTitle"); },
  get viewSubtitle() { return document.getElementById("viewSubtitle"); },
  get search() { return document.getElementById("searchInput"); },
  get country() { return document.getElementById("countryFilter"); },
  get status() { return document.getElementById("statusFilter"); },
  get priority() { return document.getElementById("priorityFilter"); },
  get verify() { return document.getElementById("verifyFilter"); },
  get stats() { return document.getElementById("statsGrid"); },
  get content() { return document.getElementById("content"); },
  get detail() { return document.getElementById("detailPanel"); },
  get detailResizer() { return document.getElementById("detailResizer"); },
  get pipeline() { return document.getElementById("pipelineList"); },
  get exportCsv() { return document.getElementById("exportCsvBtn"); },
  get addLead() { return document.getElementById("addLeadBtn"); },
  get markContacted() { return document.getElementById("markContactedBtn"); },
  get undoContacted() { return document.getElementById("undoContactedBtn"); },
  get reset() { return document.getElementById("resetBtn"); },
  get home() { return document.getElementById("homeBtn"); },
  get settingsBtn() { return document.getElementById("settingsBtn"); }
};

init();

async function init() {
  // 초기 페이지 로드에서 전체 리드(5000+) fetch 하지 않음 — render()가 필요 시 loadLeads 호출
  // 이전 코드는 여기서 무조건 전체를 받아 60초 지연 발생
  initDetailResizer();
  initAddLeadModal();
  initEditModal();
  initSettingsModal();
  initImportCsvModal();
  initImportHistoryModal();
  initThemeToggle();
  initSidebarToggle();
  initReviewBar();     // 상세 팝업의 이전/다음·판정 버튼
  // 저장된 페이지 크기 복원 (사용자가 이전에 선택한 값 유지)
  try {
    const savedSize = parseInt(localStorage.getItem('leads-page-size') || '', 10);
    if ([25, 50, 100].includes(savedSize)) state.pagination.pageSize = savedSize;
  } catch {}
  renderFilters();
  bindEvents();
  startNavBadgePolling();

  const needsBaseLeads = state.view === 'pipeline-verifying' || state.view === 'pipeline-import';
  if (needsBaseLeads) {
    await loadLeads();
    state.selectedId = baseLeads[0]?.id || null;
  }
  render();
}

// ── 사이드바 접기/펴기 ────────────────────────────────────
function initSidebarToggle() {
  const btn = document.getElementById('sidebarToggleBtn');
  const apply = (collapsed) => {
    if (collapsed) {
      document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
    } else {
      document.documentElement.removeAttribute('data-sidebar-collapsed');
    }
  };
  // 초기 상태는 layout.tsx init 스크립트가 처리 → 여기선 저장된 값만 반영 확인
  const stored = localStorage.getItem('sidebar-collapsed') === 'true';
  apply(stored);

  const toggle = () => {
    const cur = document.documentElement.getAttribute('data-sidebar-collapsed') === 'true';
    const next = !cur;
    localStorage.setItem('sidebar-collapsed', String(next));
    apply(next);
  };

  btn?.addEventListener('click', toggle);
  // Ctrl+B / Cmd+B 단축키
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !e.altKey && !e.shiftKey) {
      // input/textarea 안에서 눌린 경우는 무시 (텍스트 볼드 단축키 방해 방지)
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      toggle();
    }
  });
}

function resetAllFilters() {
  state.query = "";
  state.country = "All";
  state.status = "All";
  state.priority = "All";
  state.verify = "All";
  state.sortField = null;
  state.sortOrder = "asc";
  if (els.search) els.search.value = "";
  if (els.country) els.country.value = "All";
  if (els.status) els.status.value = "All";
  if (els.priority) els.priority.value = "All";
  if (els.verify) els.verify.value = "All";
  // 필터 초기화 시 페이지도 1페이지로
  if (state.pagination) state.pagination.currentPage = 1;
  // 뷰 이동 시 폴더 뷰도 리셋 (없으면 초기화)
  if (!state.folderView) state.folderView = { openBatch: null };
  state.folderView.openBatch = null;
}

// ── Loading helpers ──────────────────────────────────────────────
// 상단 가로 progress bar — async 작업 시작/끝에 호출
var _topBarTimer = null;
function startTopProgress() {
  const bar = document.getElementById('topProgressBar');
  if (!bar) return;
  if (_topBarTimer) { clearInterval(_topBarTimer); _topBarTimer = null; }
  bar.style.width = '0%';
  bar.classList.add('is-active');
  // 즉시 30%, 이후 슬슬 90%까지 차오르는 페이크 진행
  requestAnimationFrame(() => { bar.style.width = '30%'; });
  let pct = 30;
  _topBarTimer = setInterval(() => {
    pct = Math.min(pct + (90 - pct) * 0.15, 90);
    bar.style.width = pct.toFixed(1) + '%';
  }, 200);
}
function finishTopProgress() {
  const bar = document.getElementById('topProgressBar');
  if (!bar) return;
  if (_topBarTimer) { clearInterval(_topBarTimer); _topBarTimer = null; }
  bar.style.width = '100%';
  setTimeout(() => {
    bar.classList.remove('is-active');
    setTimeout(() => { bar.style.width = '0%'; }, 250);
  }, 200);
}

// 콘텐츠 영역 dim + 중앙 스피너 — 뷰 전환용
function setContentLoading(isLoading) {
  const content = document.getElementById('content');
  if (!content) return;
  content.classList.toggle('content-loading', !!isLoading);
}

// 전체화면 블로커 — DB 쓰기 같은 차단성 작업
function showGlobalBlocker(message) {
  const el = document.getElementById('globalBlocker');
  const txt = document.getElementById('globalBlockerText');
  if (txt) txt.textContent = message || '처리 중...';
  if (el) el.classList.add('is-active');
}
function hideGlobalBlocker() {
  const el = document.getElementById('globalBlocker');
  if (el) el.classList.remove('is-active');
}

// 클라이언트 캐시 — 매 nav 클릭마다 5000+ 리드 재fetch 방지
var _leadsLastFetch = 0;
const LEADS_CACHE_TTL_MS = 60 * 1000;   // 60초

// 안전한 JSON fetch 헬퍼 · 세션 만료 등 HTML 응답 시 자동 리다이렉트
async function safeJsonFetch(url, init) {
  const res = await fetch(url, init);
  // 세션 만료 → 로그인 페이지 리다이렉트
  if (res.status === 401 || res.redirected && /\/login/.test(res.url)) {
    if (!window.__sessionExpiredNotified) {
      window.__sessionExpiredNotified = true;
      alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
      window.location.href = '/login';
    }
    throw new Error('세션 만료');
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    // HTML 이 왔다 → 서버 오류 또는 리다이렉트
    const text = await res.text();
    console.error(`[safeJsonFetch] 비-JSON 응답: ${url}\n${text.slice(0, 200)}`);
    throw new Error(`서버 응답 오류 (${res.status})`);
  }
  return res.json();
}

async function loadLeads(opts) {
  const force = opts?.force === true;
  const now = Date.now();
  // 캐시 유효하면 스킵 (뷰 전환 시 로딩 시간 0)
  if (!force && baseLeads.length > 0 && (now - _leadsLastFetch) < LEADS_CACHE_TTL_MS) {
    return;
  }
  try {
    const res = await fetch('/api/leads');
    const result = await res.json();
    if (result.success) {
      baseLeads = result.data.map(lead => ({ ...lead, id: lead.leadId }));
      _leadsLastFetch = Date.now();
      renderFilters();
    }
  } catch(e) {
    console.error("Failed to load leads:", e);
  }
}

// ── 서버 사이드 페이지네이션 (verified/failed 전용 · 50개씩) ──
// state.serverPage 캐시: 현재 열린 stage/page/sub 조합의 데이터
var _serverPageCache = null;   // { stage, page, sub, leads, total, totalPages, ts }
const SERVER_PAGE_CACHE_TTL_MS = 30 * 1000;   // 30초

// 검증 완료 정렬 — 'reco'(추천순) 기본, 'recent'(최근 등록순)
var _leadSort = 'reco';

async function loadServerPage(stage, page, sub, force, tier) {
  // 검색어는 지금 보고 있는 단계 안에서만 좁힌다 (화면을 옮기지 않는다)
  const q = (state.query || '').trim();
  const country = state.country && state.country !== 'All' ? state.country : '';
  const cacheKey = `${stage}::${sub || ''}::${tier || ''}::${page}::${_leadSort}::${q}::${country}`;
  const now = Date.now();
  if (!force && _serverPageCache && _serverPageCache.cacheKey === cacheKey && (now - _serverPageCache.ts) < SERVER_PAGE_CACHE_TTL_MS) {
    return _serverPageCache;
  }
  const params = new URLSearchParams();
  params.set('stage', stage);
  if (sub) params.set('sub', sub);
  if (tier) params.set('tier', tier);
  params.set('page', String(page));
  params.set('limit', '50');
  if (q) params.set('q', q);
  if (country) params.set('country', country);
  if (_leadSort === 'reco' || _leadSort === 'country') params.set('sort', _leadSort);
  const res = await fetch(`/api/leads?${params.toString()}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'load page failed');
  _serverPageCache = {
    cacheKey,
    stage, page, sub, tier,
    leads: (data.data || []).map(l => ({ ...l, id: l.leadId })),
    total: data.total || 0,
    totalPages: data.totalPages || 1,
    ts: now,
  };
  return _serverPageCache;
}

// ── stage-counts 캐시 (5분 TTL · 액션 후 invalidateServerPage() 로 즉시 갱신) ──
var _stageCountsCache = null;
var _stageCountsInFlight = null;   // 동시 요청 dedup
async function loadStageCounts(force) {
  const now = Date.now();
  if (!force && _stageCountsCache && (now - _stageCountsCache.ts) < 5 * 60 * 1000) {
    return _stageCountsCache;
  }
  if (_stageCountsInFlight) return _stageCountsInFlight;  // 이미 진행 중이면 재사용
  _stageCountsInFlight = (async () => {
    try {
      const data = await safeJsonFetch('/api/leads/stage-counts');
      if (data.success) {
        _stageCountsCache = { ...data, ts: now };
        updateNavBadges(_stageCountsCache);
        return _stageCountsCache;
      }
    } catch (e) { console.error('stage-counts', e); }
    return null;
  })().finally(() => { _stageCountsInFlight = null; });
  return _stageCountsInFlight;
}

// 사이드바 nav 배지 갱신 (파이프라인 각 stage 실시간 카운트)
function updateNavBadges(counts) {
  if (!counts || !counts.stages) return;
  const s = counts.stages;
  document.querySelectorAll('[data-nav-badge]').forEach(el => {
    const key = el.dataset.navBadge;
    // 메일함 배지는 stage 가 아니라 별도 API 에서 채운다 (loadMailCounts)
    if (key === 'inboxUnread' || key === 'inboxNeedsReply' || key === 'inboxDeadlines' || key === 'inboxTrash') return;
    // 발송 관리 배지는 그 화면이 실제로 담고 있는 수 — 보낼 메일(queued) + 발송 완료(contacted).
    // contacted 만 세면 옮겨둔 곳이 있는데도 0 으로 떠서 "안 옮겨졌나" 싶어진다.
    const n = key === 'contacted' ? ((s.queued || 0) + (s.contacted || 0)) : (s[key] || 0);
    el.textContent = n.toLocaleString();
    el.dataset.count = String(n);
  });
}

// 메일함 배지 (받은 메일함 · 회신 필요) — 광고·자동발송은 빼고 센다
var _mailCountsCache = null;
async function loadMailCounts(force) {
  const now = Date.now();
  if (!force && _mailCountsCache && now - _mailCountsCache.ts < 5 * 60 * 1000) {
    applyMailCountBadges(_mailCountsCache.counts);
    return _mailCountsCache;
  }
  try {
    // 배지도 지금 보고 있는 메일함(=대표 계정) 기준으로 센다.
    // 계정 목록이 먼저 있어야 대표를 알 수 있다 — 캐시가 있으면 바로 돌아온다.
    await loadInboxAccounts();
    const acc = currentMailboxAccountId();
    const data = await safeJsonFetch(`/api/mail/counts?accountId=${encodeURIComponent(acc)}`);
    if (data && data.success) {
      _mailCountsCache = { counts: data.counts, ts: now };
      applyMailCountBadges(data.counts);
      return _mailCountsCache;
    }
  } catch (e) {
    // 메일 수신을 아직 설정하지 않았을 수 있다 — 배지가 없다고 화면이 죽으면 안 된다
    console.warn('mail-counts', e);
  }
  return null;
}

function applyMailCountBadges(c) {
  if (!c) return;
  const set = (key, n) => {
    const el = document.querySelector(`[data-nav-badge="${key}"]`);
    if (!el) return;
    el.textContent = (n || 0).toLocaleString();
    el.dataset.count = String(n || 0);
  };
  set('inboxUnread', c.inbox);
  set('inboxNeedsReply', c.needsReply);
  set('inboxDeadlines', c.deadlines);
  set('inboxTrash', c.trash);
}

// 주기 갱신 (5분마다 · 사용자 액션 후에는 invalidateServerPage 로 즉시 갱신 · 창 focus 복귀 시도 자동 갱신)
var _navBadgeTimer = null;
function startNavBadgePolling() {
  if (_navBadgeTimer) return;
  const refresh = () => { loadStageCounts(true); loadMailCounts(true); };
  refresh();
  _navBadgeTimer = setInterval(refresh, 5 * 60 * 1000);
  // 브라우저 창이 다시 포커스되면 즉시 갱신 (다른 창에서 액션 반영)
  window.addEventListener('focus', refresh);
  // 페이지가 다시 보이는 상태로 돌아오면 갱신
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

// 데이터 변경 후 캐시 무효화
function invalidateServerPage() {
  _serverPageCache = null;
  _stageCountsCache = null;
  _tierCountsCache = null;
  loadStageCounts(true);
}

// ── 다크/라이트 테마 토글 ────────────────────────────────
function initThemeToggle() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  const applyIcon = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    btn.textContent = current === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('title', current === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
  };
  applyIcon();
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
    applyIcon();
  });
}

function bindEvents() {
  // Click event delegation
  document.addEventListener("click", async (event) => {
    // 0. Stage 원클릭 이동 버튼 (가장 우선 처리 — row 클릭보다 먼저)
    const quickBtn = event.target.closest(".stage-quick-move");
    if (quickBtn) {
      event.stopPropagation();
      const leadId = quickBtn.dataset.quickLead;
      const target = quickBtn.dataset.quickTarget;
      handleStageChange(leadId, target, quickBtn);
      return;
    }

    // 0-b. 메일 대화 보기 (보낸 메일 + 받은 답장 타임라인)
    const convBtn = event.target.closest(".conversation-btn");
    if (convBtn) {
      event.stopPropagation();
      closeMailDetailModal();   // 상세에서 눌렀으면 겹치지 않게 닫는다
      openConversationModal(convBtn.dataset.convLead);
      return;
    }

    // 0-c. 받은 메일함 행 클릭 → 메일 상세
    const mailRow = event.target.closest("tr.inbox-row");
    if (mailRow && !event.target.closest("button, a, input")) {
      event.stopPropagation();
      openMailDetailModal(mailRow.dataset.mailId);
      return;
    }
    if (event.target.id === "mailDetailRoot") {
      closeMailDetailModal();
      return;
    }
    if (event.target.closest("#conversationModalClose") || event.target.id === "conversationModalRoot") {
      closeConversationModal();
      return;
    }
    const quoteToggle = event.target.closest(".conv-quote-toggle");
    if (quoteToggle) {
      event.stopPropagation();
      const box = document.getElementById(quoteToggle.dataset.quoteTarget);
      if (box) {
        const showing = box.hasAttribute('hidden');
        if (showing) box.removeAttribute('hidden'); else box.setAttribute('hidden', '');
        quoteToggle.textContent = showing ? '▲ 인용문 접기' : '▼ 인용된 이전 대화 보기';
      }
      return;
    }

    // 1. Navigation items
    const navItem = event.target.closest(".nav-item");
    if (navItem) {
      const targetView = navItem.dataset.view;
      const targetStatus = navItem.dataset.statusFilter;
      state.view = targetView;
      // 모든 뷰 진입 시 필터 초기화 — 이전 뷰에서 남은 country/status/priority 가
      // 다음 뷰의 데이터까지 좁히는 문제 방지
      resetAllFilters();
      // 메일 양식은 사이드바로 들어오면 늘 목록(게시판)부터.
      // mode 가 남아 있으면 전에 편집하던 양식이 그대로 열려서, 목록을 보러
      // 온 사람에게 남의 편집 화면처럼 보인다.
      // (편집기 안에서의 저장·이동은 renderB2BEmailManager 를 직접 부르므로
      //  여기를 거치지 않는다 — 그쪽 흐름은 그대로 유지된다.)
      if (targetView === 'tool-b2b-email') {
        state.email.mode = 'list';
        state.email.dirty = false;
      }
      if (targetStatus) {
        state.status = targetStatus;
        const statusEl = els.status;
        if (statusEl) statusEl.value = targetStatus;
      }

      // 로딩 표시 — 사용자가 클릭한 결과로 무거운 데이터 fetch 가 시작됨을 인지
      startTopProgress();
      setContentLoading(true);
      try {
        // 폴더 뷰 (verifying) 와 imported (원본 데이터 뷰) 만 baseLeads 필요
        // 나머지는 서버 페이지드 → loadLeads 스킵으로 즉시 반응
        const needsBaseLeads = targetView === 'pipeline-verifying' || targetView === 'pipeline-import';
        if (needsBaseLeads) {
          await loadLeads();
          state.selectedId = getFilteredLeads()[0]?.id || state.selectedId;
        }
        await render();
      } finally {
        setContentLoading(false);
        finishTopProgress();
      }
      return;
    }

    // 2. Home Button → 기본 랜딩 (가져오기) 로 이동. 전체 리드 fetch 안 함.
    if (event.target.closest("#homeBtn")) {
      state.view = "pipeline-import";
      resetAllFilters();
      state.selectedLeadIds = new Set();
      resetPagination();
      _serverPageCache = null;
      render();
      return;
    }

    // 3. Toolbar / Main action buttons
    if (event.target.closest("#exportCsvBtn")) {
      exportCsv();
      return;
    }
    if (event.target.closest("#importCsvBtn")) {
      openImportCsvModal();
      return;
    }
    if (event.target.closest("#verifyLeadsBtn")) {
      openVerifyModal();
      return;
    }
    if (event.target.closest("#verifyCloseBtn") || event.target.closest("#verifyCancelBtn")) {
      const modal = document.getElementById("verifyModal");
      if (modal) modal.style.display = "none"; syncBodyScrollLock();
      return;
    }
    if (event.target.closest("#verifyStartBtn")) {
      const scope = document.querySelector('input[name="verifyScope"]:checked')?.value || 'pending';
      startVerification(scope);
      return;
    }
    if (event.target.closest("#verifyAIStartBtn")) {
      startAIVerification();
      return;
    }
    if (event.target.closest("#addLeadBtn")) {
      addLead();
      return;
    }
    if (event.target.closest("#markContactedBtn")) {
      markSelectedContacted();
      return;
    }
    if (event.target.closest("#undoContactedBtn")) {
      undoSelectedContacted();
      return;
    }
    if (event.target.closest("#resetBtn")) {
      resetEdits();
      return;
    }

    // 4. Modal Close actions
    if (event.target.closest("#modalCloseBtn") || event.target.closest("#modalCancelBtn")) {
      const modal = document.getElementById("addLeadModal");
      if (modal) modal.style.display = "none"; syncBodyScrollLock();
      return;
    }
    if (event.target.closest("#editModalCloseBtn") || event.target.closest("#editModalCloseBtn2")) {
      const modal = document.getElementById("editLeadModal");
      if (modal) modal.style.display = "none"; syncBodyScrollLock();
      return;
    }
    if (event.target.closest("#importModalCloseBtn") || event.target.closest("#importCancelBtn")) {
      const modal = document.getElementById("importCsvModal");
      if (modal) modal.style.display = "none"; syncBodyScrollLock();
      resetImportModal();
      return;
    }
    if (event.target.closest("#settingsCloseBtn")) {
      const modal = document.getElementById("settingsModal");
      if (modal) modal.style.display = "none"; syncBodyScrollLock();
      return;
    }
    if (event.target.closest("#importHistoryCloseBtn") || event.target.closest("#importHistoryCloseBtn2")) {
      const modal = document.getElementById("importHistoryModal");
      if (modal) modal.style.display = "none"; syncBodyScrollLock();
      return;
    }

    // 5. Click outside modal content (backdrop clicks)
    //    리드 추가·수정, CSV 가져오기가 여기에 걸린다. 폼을 채우다 배경을
    //    스치면 그대로 날아가던 곳이라, 눌러 시작한 지점과 입력 여부를 본다.
    if (event.target.classList.contains("modal-backdrop")) {
      if (_modalPressTarget !== event.target) return;   // 안에서 끌어다 밖에서 뗌
      if (!confirmDiscardTyped(event.target)) return;   // 쓰던 내용 있음
      event.target.style.display = "none";
      delete event.target.dataset.userTyped;
      syncBodyScrollLock();
      if (event.target.id === "importCsvModal") resetImportModal();
      return;
    }

    // 6. Lead Table & Card selections
    const row = event.target.closest("tr[data-id]");
    if (row) {
      if (state.view === "emails") {
        if (event.target.closest("input,button,a")) return;
        state.selectedId = row.dataset.id;
        render();
        return;
      }
      
      // Default: click table row opens edit modal
      // 행 안의 조작 요소는 행 클릭(수정 모달)을 열지 않는다.
      // 위임 핸들러가 위쪽에서 먼저 처리하고 return 하지만, 순서가 바뀌어도
      // 오작동하지 않도록 여기서도 막아둔다.
      if (event.target.closest(
        "input[type='checkbox'], button.favorite-button, a, .conversation-btn, .stage-quick-move, .stage-select"
      )) return;
      openEditModal(row.dataset.id);
      return;
    }

    // Country card click
    const countryCard = event.target.closest("[data-country]");
    if (countryCard && state.view === "countries") {
      state.country = countryCard.dataset.country;
      state.view = "leads";
      const countryFilter = els.country;
      if (countryFilter) countryFilter.value = state.country;
      render();
      return;
    }

    // Follow up list item click
    const followupItem = event.target.closest(".followup-item");
    if (followupItem && state.view === "followups") {
      state.selectedId = followupItem.dataset.id;
      state.view = "leads";
      render();
      return;
    }

    // 7. Edit Modal buttons
    if (event.target.closest("#el-favoriteBtn")) {
      if (state.selectedId) toggleFavorite(state.selectedId);
      return;
    }
    if (event.target.closest("#el-deleteBtn")) {
      if (state.selectedId) {
        deleteLead(state.selectedId);
        const modal = document.getElementById("editLeadModal");
        if (modal) modal.style.display = "none"; syncBodyScrollLock();
      }
      return;
    }

    // 8. Settings Button Click
    if (event.target.closest("#settingsBtn")) {
      const modal = document.getElementById("settingsModal");
      if (modal) {
        modal.style.display = "flex";
        delete modal.dataset.userTyped;
        const newPasswordInput = document.getElementById("newPasswordInput");
        if (newPasswordInput) newPasswordInput.value = "";
        if (isMaster) loadSubIds();
      }
      return;
    }

    // Settings Change Password Button
    if (event.target.closest("#changePasswordBtn")) {
      const newPasswordInput = document.getElementById("newPasswordInput");
      const newPassword = newPasswordInput?.value || "";
      if (newPassword.length < 4) {
        alert("비밀번호는 최소 4자리 이상이어야 합니다.");
        return;
      }

      const btn = event.target.closest("#changePasswordBtn");
      btn.disabled = true;
      btn.textContent = "저장 중...";

      try {
        const res = await fetch("/api/users/password", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword })
        });
        const data = await res.json();
        if (data.success) {
          alert("비밀번호가 성공적으로 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해주세요.");
          if (newPasswordInput) newPasswordInput.value = "";
        } else {
          alert("오류: " + data.error);
        }
      } catch (err) {
        alert("비밀번호 변경 실패");
      }
      btn.disabled = false;
      btn.textContent = "변경하기";
      return;
    }

    // Settings Create Sub ID Button
    if (event.target.closest("#createSubIdBtn")) {
      const unInput = document.getElementById("subUsernameInput");
      const pwInput = document.getElementById("subPasswordInput");
      const username = unInput?.value.trim() || "";
      const password = pwInput?.value || "";

      if (!username || password.length < 4) {
        alert("아이디와 4자리 이상의 비밀번호를 입력해주세요.");
        return;
      }

      const btn = event.target.closest("#createSubIdBtn");
      btn.disabled = true;
      btn.textContent = "생성 중...";

      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
          if (unInput) unInput.value = "";
          if (pwInput) pwInput.value = "";
          loadSubIds();
        } else {
          alert("생성 실패: " + data.error);
        }
      } catch (err) {
        alert("생성 중 오류가 발생했습니다.");
      }
      btn.disabled = false;
      btn.textContent = "생성";
      return;
    }

    // Settings Delete Sub ID
    const deleteUserBtn = event.target.closest("[data-delete-user]");
    if (deleteUserBtn) {
      const username = deleteUserBtn.dataset.deleteUser;
      if (confirm(`정말 '${username}' 계정을 삭제하시겠습니까?`)) {
        try {
          const res = await fetch("/api/users/" + encodeURIComponent(username), { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            loadSubIds();
          } else {
            alert("삭제 실패: " + data.error);
          }
        } catch (err) {
          alert("삭제 중 오류가 발생했습니다.");
        }
      }
      return;
    }

    // 9. Import CSV Modal Buttons
    if (event.target.closest("#importDropZone")) {
      const fileInput = document.getElementById("importFileInput");
      if (fileInput) fileInput.click();
      return;
    }
    if (event.target.closest("#importSubmitBtn")) {
      if (importParsedLeads.length) {
        const duplicateAction = document.querySelector('input[name="duplicateAction"]:checked')?.value || "skip";
        const dupes = importParsedLeads.filter(l => _isDuplicate(l));
        const newOnes = importParsedLeads.length - dupes.length;
        const actionLabel = duplicateAction === 'overwrite' ? '덮어쓰기' : '건너뜀';
        const ok = confirm(
          `최종 완료 처리 하시겠습니까?\n\n` +
          `· 전체 ${importParsedLeads.length}건\n` +
          `· 신규 ${newOnes}건\n` +
          `· 중복 ${dupes.length}건 (${actionLabel})\n\n` +
          `[확인]을 누르면 서버에 반영됩니다.\n[취소]를 누르면 업로드되지 않습니다.`
        );
        if (!ok) return;
        doImport(importParsedLeads, duplicateAction);
      }
      return;
    }

    // Missing Email Save inline action
    const saveEmailBtn = event.target.closest("[data-save-email]");
    if (saveEmailBtn) {
      const id = saveEmailBtn.dataset.saveEmail;
      const input = document.querySelector(`[data-email-for="${CSS.escape(id)}"]`);
      const email = input?.value.trim();
      if (!email) return;
      updateLead(id, "Email", email);
      state.selectedId = id;
      render();
      return;
    }

    // [이 페이지 전체 선택] 은 여기서 처리하지 않는다.
    //
    // 예전에는 이 위임 핸들러가 getFilteredLeads() — 브라우저에 올라온 리드
    // 전체(수천 건) — 를 선택했다. 그런데 두 표(renderServerPagedTable ·
    // renderLeadTable)가 각자 '지금 페이지 50건'만 고르는 핸들러를 따로 걸어
    // 둬서, 한 번 누르면 둘 다 발화했다. 결과는 "이 페이지 전체 선택"을 눌렀는데
    // Delete Selected 가 3302 로 뛰는 것이었고, 그대로 누르면 전 건이 지워진다.
    // 범위를 아는 것은 표 자신뿐이므로 각 표의 핸들러에만 맡긴다.

    // Delete Selected button
    if (event.target.closest("[data-delete-selected]")) {
      deleteSelectedLeads();
      return;
    }

    // Favorite click (inline)
    const favoriteBtn = event.target.closest("[data-favorite]");
    if (favoriteBtn && !event.target.closest("#editLeadModal")) {
      toggleFavorite(favoriteBtn.dataset.favorite);
      return;
    }
  });

  // Drag & drop event delegation
  document.addEventListener("dragover", (event) => {
    const dropZone = event.target.closest("#importDropZone");
    if (dropZone) {
      event.preventDefault();
      dropZone.style.borderColor = "var(--accent)";
      dropZone.style.background = "rgba(0,180,120,.06)";
    }
  });

  document.addEventListener("dragleave", (event) => {
    const dropZone = event.target.closest("#importDropZone");
    if (dropZone) {
      dropZone.style.borderColor = "";
      dropZone.style.background = "";
    }
  });

  document.addEventListener("drop", (event) => {
    const dropZone = event.target.closest("#importDropZone");
    if (dropZone) {
      event.preventDefault();
      dropZone.style.borderColor = "";
      dropZone.style.background = "";
      const file = event.dataTransfer?.files?.[0];
      if (file) handleCsvFile(file);
    }
  });

  // Change event delegation
  document.addEventListener("change", (event) => {
    if (event.target.id === "countryFilter") {
      state.country = event.target.value;
      _serverPageCache = null;   // 국가가 캐시 키에 들어가므로 새로 받는다
      resetPagination();
      render();
    } else if (event.target.id === "statusFilter") {
      state.status = event.target.value;
      resetPagination();
      render();
    } else if (event.target.id === "priorityFilter") {
      state.priority = event.target.value;
      resetPagination();
      render();
    } else if (event.target.id === "verifyFilter") {
      state.verify = event.target.value;
      resetPagination();
      render();
    } else if (event.target.id === "importFileInput") {
      const file = event.target.files?.[0];
      if (file) handleCsvFile(file);
    }

    // Stage 드롭다운 변경 — 즉시 서버 반영
    if (event.target.classList && event.target.classList.contains("stage-select")) {
      const leadId = event.target.dataset.stageLead;
      const newStage = event.target.value;
      handleStageChange(leadId, newStage, event.target);
    }

    // 발송 승인 체크박스
    if (event.target.classList && event.target.classList.contains("outreach-approval")) {
      const leadId = event.target.dataset.approveLead;
      const on = event.target.checked;
      handleOutreachApproval(leadId, on);
    }

    // Inline checkboxes (row selection)
    if (event.target.closest(".lead-select")) {
      const checkbox = event.target;
      const leadId = checkbox.dataset.selectLead;
      if (checkbox.checked) {
        state.selectedLeadIds.add(leadId);
      } else {
        state.selectedLeadIds.delete(leadId);
      }
      render();
    }

    // Modal Edit Fields Auto-Save
    if (event.target.id && event.target.id.startsWith("el-")) {
      const field = event.target.id.slice(3);
      const fields = ["status", "owner", "lastContact", "nextFollowUp", "notes", "Company", "Country", "Priority", "Type", "BuyerContact", "Title", "Email", "Phone", "WebsiteContact", "LinkedInCompany", "BrandsChannels", "Evidence", "Approach", "Sources"];
      if (fields.includes(field) && state.selectedId) {
        updateLead(state.selectedId, field, event.target.value);
      }
    }
  });

  // Input event delegation (Search field)
  document.addEventListener("input", (event) => {
    if (event.target.id === "searchInput") {
      state.query = event.target.value.trim();
      // 단계 화면(검증 완료 등)에서 검색하면 그 화면 안에서 좁힌다.
      // 예전에는 무조건 'leads'(전체 리드)로 바꿔버려서, 검증 완료 409건을
      // 보다가 검색 한 번에 보관함까지 섞인 6,073건 화면으로 튕겼다.
      const onStagePage = typeof state.view === 'string' && state.view.startsWith('pipeline-');
      if (!onStagePage) state.view = "leads";
      _serverPageCache = null;   // 검색어가 캐시 키에 들어가므로 새로 받는다
      resetPagination();
      if (state.query && !onStagePage) {
        state.country = "All";
        state.status = "All";
        state.priority = "All";
        const countryFilter = els.country; if (countryFilter) countryFilter.value = "All";
        const statusFilter = els.status; if (statusFilter) statusFilter.value = "All";
        const priorityFilter = els.priority; if (priorityFilter) priorityFilter.value = "All";
      }
      state.selectedId = getFilteredLeads()[0]?.id || state.selectedId;
      render();
    }
  });

  // Form submit event delegation
  document.addEventListener("submit", async (event) => {
    if (event.target.id === "addLeadForm") {
      event.preventDefault();
      const btn = document.getElementById("modalSubmitBtn");
      if (btn) { btn.disabled = true; btn.textContent = "저장 중..."; }

      const id = "lead-" + Date.now();
      const getValue = (name) => (document.getElementById("ml-" + name)?.value || "").trim();
      const lead = {
        leadId: id, id: id,
        Company:       getValue("Company") || "New Company",
        Country:       getValue("Country") || "Unknown",
        Priority:      getValue("Priority"),
        Type:          getValue("Type"),
        BuyerContact:  getValue("BuyerContact"),
        Email:         getValue("Email"),
        Phone:         getValue("Phone"),
        WebsiteContact:getValue("WebsiteContact"),
        BrandsChannels:getValue("BrandsChannels"),
        notes:         getValue("notes"),
        Evidence: "", LinkedInCompany: "", Title: "", favorite: false,
        ContactLinkedIn: "", RoleMemo: "", Address: "", Approach: "",
        Sources: "Manual entry",
        Checked: new Date().toISOString().slice(0, 10),
        Confidence: "Manual entry",
        status: "New", owner: "", lastContact: "", nextFollowUp: ""
      };

      baseLeads.unshift(lead);
      state.selectedId = id;
      state.view = "leads";
      state.country = "All";
      state.status  = "All";
      state.priority = "All";
      renderFilters();
      render();
      
      const modal = document.getElementById("addLeadModal");
      if (modal) modal.style.display = "none"; syncBodyScrollLock();

      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lead)
        });
        const result = await res.json();
        if (result.success) {
          const idx = baseLeads.findIndex((l) => l.id === id);
          if (idx !== -1) baseLeads[idx]._id = result.data._id;
        }
      } catch (err) {
        console.error("Failed to save lead:", err);
      }

      if (btn) { btn.disabled = false; btn.textContent = "저장하기"; }
    }
  });
}

function initDetailResizer() {
  const savedWidth = Number(localStorage.getItem(DETAIL_WIDTH_KEY));
  if (savedWidth) setDetailWidth(savedWidth);

  document.addEventListener("pointerdown", (event) => {
    const resizer = event.target.closest("#detailResizer");
    if (!resizer) return;
    event.preventDefault();
    resizer.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing-detail");

    const onPointerMove = (moveEvent) => {
      const nextWidth = window.innerWidth - moveEvent.clientX;
      setDetailWidth(nextWidth);
    };

    const onPointerUp = () => {
      document.body.classList.remove("is-resizing-detail");
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      const width = getComputedStyle(document.documentElement).getPropertyValue("--detail-width").trim();
      localStorage.setItem(DETAIL_WIDTH_KEY, String(parseInt(width, 10) || 380));
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  });
}

function setDetailWidth(width) {
  const maxWidth = Math.min(680, Math.max(320, window.innerWidth - 640));
  const nextWidth = Math.max(260, Math.min(width, maxWidth));
  document.documentElement.style.setProperty("--detail-width", `${nextWidth}px`);
}

function renderFilters() {
  const leads = getLeads();
  const countries = unique(leads.map((lead) => lead.Country)).sort(localeSort);
  const priorities = unique(leads.map((lead) => lead.Priority)).filter(Boolean).sort(localeSort);

  // Status·Priority·검증 필터는 화면에서 숨겼다(서버 쿼리에 안 들어가 무동작이었음).
  // 숨긴 뒤에도 여기서 innerHTML 을 쓰면 null 에 쓰다가 화면 전체가 죽는다 —
  // 실제로 "Cannot set properties of null" 로 렌더가 통째로 멈췄다.
  // 숨김/표시가 바뀌어도 견디도록 전부 있는지 확인하고 쓴다.
  if (els.country) els.country.innerHTML = optionHtml(["All", ...countries], state.country);
  if (els.status) els.status.innerHTML = optionHtml(["All", ...STATUSES], state.status);
  if (els.priority) els.priority.innerHTML = optionHtml(["All", ...priorities], state.priority);
  // verify select 는 정적 옵션이 page.tsx 에 박혀있어 value 만 동기화
  if (els.verify) els.verify.value = state.verify || "All";
}

async function render() {
  try {
    return await _renderInner();
  } catch (e) {
    console.error('[render] failed:', e);
    if (els.content) {
      els.content.innerHTML = `
        <div style="padding:24px;background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;margin:16px">
          <div style="font-size:14px;font-weight:700;color:#991b1b;margin-bottom:8px">⚠️ 렌더링 오류 발생</div>
          <div style="font-size:12px;color:#7f1d1d;font-family:monospace;white-space:pre-wrap;background:white;padding:12px;border-radius:6px">${escapeHtml(String(e?.message || e))}</div>
          <div style="font-size:11px;color:#991b1b;margin-top:8px">브라우저 개발자 도구(F12) → Console 탭에서 상세 오류 확인. 강제 새로고침 (Ctrl+Shift+R) 후 재시도.</div>
        </div>
      `;
    }
  }
}

async function _renderInner() {
  const leads = getFilteredLeads();
  // 매 render 마다 stage 배너/서브필터 chip 초기화 — 각 페이지에서 필요 시 다시 그려짐
  clearStageBanner();
  clearVerifyingSubFilterChips();
  clearVerifiedResultTabs();

  // 리드 리스트 아닌 tool 페이지에서는 상단 필터 toolbar 숨김
  const tb = document.getElementById('toolbarSection');
  if (tb) {
    const isToolPage = state.view && state.view.startsWith('tool-');
    tb.style.display = isToolPage ? 'none' : '';
  }
  els.navItems.forEach((item) => {
    const itemView = item.dataset.view;
    const itemStatus = item.dataset.statusFilter;
    let isActive;
    if (itemStatus) {
      isActive = state.view === "leads" && state.status === itemStatus;
    } else if (itemView === "leads") {
      isActive = state.view === "leads" && state.status === "All";
    } else {
      isActive = state.view === itemView;
    }
    item.classList.toggle("active", isActive);
  });
  renderPipeline();
  renderStats(leads);
  updateActionButtons();

  if (state.view === "countries") {
    els.viewTitle.textContent = "Countries";
    els.viewSubtitle.textContent = "Compare market volume and jump into a country list.";
    renderCountries(leads);
    return;
  }

  if (state.view === "worked") {
    const worked = leads.filter((lead) => lead.status !== "New");
    els.viewTitle.textContent = "Worked";
    els.viewSubtitle.textContent = "Leads you've already engaged with (status moved past New).";
    renderLeadTable(worked, "No worked leads match the current filters.");
    return;
  }

  if (state.view === "favorites") {
    const favorites = leads.filter((lead) => lead.favorite);
    els.viewTitle.textContent = "Favorites";
    els.viewSubtitle.textContent = "Review starred priority buyers.";
    renderLeadTable(favorites, "No favorite buyers match the current filters.");
    return;
  }

  if (state.view === "followups") {
    els.viewTitle.textContent = "Follow-ups";
    els.viewSubtitle.textContent = "Open leads that have next actions scheduled.";
    renderFollowups(leads);
    return;
  }

  if (state.view === "emails") {
    els.viewTitle.textContent = "Missing Emails";
    els.viewSubtitle.textContent = "Open buyer sites, find a contact email, and save it directly.";
    renderMissingEmails(leads);
    return;
  }

  if (state.view === "importHistory") {
    els.viewTitle.textContent = "Import History";
    els.viewSubtitle.textContent = "CSV 가져오기 기록을 확인하고 원하는 배치를 롤백할 수 있습니다.";
    renderImportHistory();
    return;
  }

  if (state.view === "verification") {
    els.viewTitle.textContent = "🔍 검증 분류";
    els.viewSubtitle.textContent = "검증 결과별로 리드를 4그룹으로 묶어 보여줍니다. 각 그룹을 클릭하면 해당 항목만 표 형태로 봅니다.";
    renderVerificationClassification();
    return;
  }

  if (state.view === "recommended" || state.view === "tool-recommended") {
    els.viewTitle.textContent = "💎 K-beauty 추천 리스트";
    els.viewSubtitle.textContent = "글로벌 K-beauty 디스트리뷰터/도매/리테일러 시드 발굴 결과. 카드를 골라서 내 리드로 추가하세요.";
    renderRecommendedBuyers();
    return;
  }

  // ── 검증대기/검증완료 탭에서 자동 리로드 (AI 배치 진행 실시간 반영) ─
  managePipelineAutoRefresh(state.view);

  // ── 발송 관리 ─────────────────────────────────────────────
  // 리드 표가 아니라 "메일이 어디까지 갔는가"를 보는 화면이라 stageMap 을
  // 타지 않는다. 이 검사가 stageMap 뒤에 있었을 때는 stageMap 이 먼저
  // pipeline-contacted 를 잡아 일반 표를 그리고 return 해버려서, 여기까지
  // 아예 오지 못했다 (화면이 비어 보이던 원인).
  if (state.view === 'pipeline-contacted') {
    els.viewTitle.textContent = '📨 발송 관리';
    els.viewSubtitle.textContent = '보낼 메일 · 예약된 메일 · 나간 메일을 단계별로 봅니다.';
    renderOutboxPage();
    return;
  }

  // ── 새 파이프라인 뷰 (stage 기반) ─────────────────────────────
  const stageMap = {
    'pipeline-import':      { stage: 'imported',    title: '📥 가져오기 (Import)',  sub: '엑셀에서 새로 업로드된 회사들. 검증 진행 대기.' },
    'pipeline-ai-searched': { stage: 'ai-searched', title: '🤖 AI 서칭 결과',       sub: 'Claude 가 웹에서 자동 발굴한 K-뷰티 B2B 후보. 검토 후 검증대기(추가 검증) / 검증 완료(즉시 활용) / 제외로 이동.' },
    'pipeline-verifying':   { stage: 'verifying',   title: '🔍 검증 대기',          sub: '검증 진행 중이거나 필요한 회사들.' },
    'pipeline-verified':    { stage: 'verified',    title: '✅ AI 검증 완료',          sub: '검증을 통과해 메일을 보낼 수 있는 곳입니다. 아닌 곳은 빼주세요.' },
    'pipeline-failed':      { stage: '__failed',    title: '🚫 검증 실패',          sub: 'AI가 K-beauty 무관으로 판정. 잘못 판정된 것은 수동으로 검증완료로 되돌리기 가능.' },
    // pipeline-contacted 는 여기 두지 않는다 — 위에서 renderOutboxPage 로 먼저 빠진다.
    'pipeline-replied':     { stage: 'replied',     title: '💬 답장 받음',            sub: '답장이 온 곳입니다. 답장하거나, 아닌 곳은 빼주세요.' },
    'pipeline-negotiating': { stage: 'negotiating', title: '🤝 대화 진행 중',        sub: '조건/일정/가격 등 실제 협상 오가는 상태.' },
    'pipeline-partner':     { stage: 'partner',     title: '⭐ 파트너십 확정',        sub: '계약/합의 완료된 실 파트너. 자동 발송 대상에서 자동 제외.' },
    'pipeline-archived':    { stage: 'archived',    title: '📦 보관함',             sub: '수동 폐기 또는 정리한 리드. 필요 시 복구 가능.' },
  };
  if (stageMap[state.view]) {
    const s = stageMap[state.view];
    els.viewTitle.textContent = s.title;
    els.viewSubtitle.textContent = s.sub;

    // 특수 케이스: pipeline-failed 는 실제 stage 아님 → archived + not-buyer 로 대체
    let stageMatch;
    if (s.stage === '__failed') {
      stageMatch = (l) => (l.stage || 'imported') === 'archived' &&
        l?.verification?.aiVerdict === 'not-buyer';
    } else {
      stageMatch = (l) => (l.stage || 'imported') === s.stage;
    }

    // ── 서버 페이지네이션 (검증대기 제외 모든 stage) ──
    // 검증대기 는 배치별 폴더 뷰 필요 → baseLeads 사용
    // 나머지는 stage 별 50건씩 서버 슬라이스
    const useServerPage = s.stage !== 'verifying' && s.stage !== 'imported';
    if (useServerPage) {
      // 검증완료 페이지는 성공/실패 상위 탭으로 stage 동적 결정
      let serverStage = s.stage;
      let displayInfo = s;
      if (s.stage === 'verified') {
        const tab = state.verifiedResultTab || 'success';
        if (tab === 'failed') {
          serverStage = '__failed';
          displayInfo = { ...s, title: '🚫 검증 실패', sub: 'AI가 K-beauty 무관으로 판정. 수동으로 성공 탭으로 되돌리기 가능.' };
        }
      }
      const sub = serverStage === 'verified' ? (state.verifiedSubFilter || 'all') : null;
      const tier = serverStage === 'verified' ? (state.tierFilter || null) : null;
      const wantPage = state.pagination?.currentPage || 1;
      const counts = _stageCountsCache || await loadStageCounts();
      let pageData;
      try {
        pageData = await loadServerPage(serverStage, wantPage, sub === 'all' ? null : sub, false, tier);
      } catch (e) {
        els.content.innerHTML = emptyState('페이지 로드 실패: ' + (e.message || 'unknown'));
        return;
      }
      const totalForBanner = pageData.total;
      renderStageBanner(displayInfo, totalForBanner, totalForBanner);
      // 검증완료 페이지 상단에 성공/실패 탭
      if (s.stage === 'verified' && counts) {
        renderVerifiedResultTabs(counts.stages.verified, counts.stages.failed);
      } else {
        clearVerifiedResultTabs();
      }
      // 검증완료 서브필터 chip (성공 탭일 때만 · 서버 카운트 기반)
      if (s.stage === 'verified' && serverStage === 'verified' && counts) {
        renderVerifiedSubFilterChipsServer(counts.verifiedSub, counts.stages.failed);
        // A/B/C 등급 chip 은 뺐다 — 어차피 전부 확인하고 보낼 것이라
        // 등급을 나누면 "B는 봐야 하나 말아야 하나"만 늘어난다.
        // 되살리려면 아래 한 줄 주석을 풀면 된다 (renderVerifiedTierChips 는 그대로 있다).
        // renderVerifiedTierChips();
      } else {
        clearVerifiedSubFilterChips();
        clearVerifiedTierChips();
      }
      clearVerifyingSubFilterChips();
      const statsElServer = document.getElementById('statsGrid');
      if (statsElServer) statsElServer.innerHTML = '';
      renderServerPagedTable(pageData, displayInfo);
      return;
    }

    // ── Import 배치별 폴더 UI (검증대기 전용) ──
    const useFolderView = s.stage === 'verifying';
    if (useFolderView) {
      const allByStage = getLeads().filter(stageMatch);
      renderStageBanner(s, allByStage.length, allByStage.length);
      // 서브필터 chip 은 폴더 밖에서만
      if (s.stage === 'verifying') {
        renderVerifyingSubFilterChips(allByStage);
      } else {
        clearVerifyingSubFilterChips();
      }
      const statsEl = document.getElementById('statsGrid');
      if (statsEl) statsEl.innerHTML = '';

      // state.folderView 방어 (오래된 세션 등 호환)
      if (!state.folderView) state.folderView = { openBatch: null };
      if (state.folderView.openBatch == null) {
        // 폴더 목록 모드
        const cardRenderer = s.stage === 'verifying' ? batchCardVerifying
                          : s.stage === 'verified'  ? batchCardVerified
                          : batchCardFailed;
        renderBatchFolders(stageMatch, cardRenderer,
          `${s.title}에 해당하는 import 배치가 없습니다.`);
        return;
      } else {
        // 폴더 내부 모드 — 해당 배치 리드만 노출
        const batchMatch = (l) => stageMatch(l) && (l.importBatch || '(수동/미배치)') === state.folderView.openBatch;
        let batchLeads = leads.filter(batchMatch);
        // 검증대기 서브필터도 배치 내부에서 적용
        if (s.stage === 'verifying') {
          const sub = state.verifyingSubFilter || 'unverified';
          if (sub === 'unverified') batchLeads = batchLeads.filter(l => !l?.verification?.aiVerifiedAt);
          else if (sub === 'maybe') batchLeads = batchLeads.filter(l => l?.verification?.aiVerdict === 'maybe');
        }
        // breadcrumb 추가
        const bcHtml = renderFolderBreadcrumb(state.folderView.openBatch, batchLeads.length);
        renderLeadTable(batchLeads, `이 폴더에 해당하는 리드가 없습니다.`);
        // content 앞에 breadcrumb prepend
        els.content.insertAdjacentHTML('afterbegin', bcHtml);
        document.getElementById('folderBackBtn')?.addEventListener('click', () => {
          state.folderView.openBatch = null;
          resetPagination();
          render();
        });
        return;
      }
    }

    // ── 폴더 UI 안 쓰는 stage (contacted/replied/negotiating/partner/imported) ──
    // stage 필터는 텍스트 필터(getFilteredLeads) 뒤에 한번 더 적용
    const allByStage = getLeads().filter(stageMatch);
    let stageLeads = leads.filter(stageMatch);

    // 검증대기 stage 는 AI 진행 여부 하위 필터 적용
    if (s.stage === 'verifying') {
      const sub = state.verifyingSubFilter || 'unverified';
      if (sub === 'unverified') {
        // "검증 전 상태" — AI 아직 안 본 것만
        stageLeads = stageLeads.filter(l => !l?.verification?.aiVerifiedAt);
      } else if (sub === 'maybe') {
        stageLeads = stageLeads.filter(l => l?.verification?.aiVerdict === 'maybe');
      }
      // 'all' 은 stage=verifying 필터 그대로
      // 'failed' 는 사이드바 별도 페이지로 이동됨
    }
    // 검증완료 stage 하위 필터.
    // approved/pending 칩은 없앴지만(readyForOutreach 가 늘 전체와 같아 무의미)
    // 예전 세션에 그 값이 남아 있으면 목록이 통째로 비어 보인다 — all 로 되돌린다.
    if (s.stage === 'verified') {
      if (state.verifiedSubFilter === 'approved' || state.verifiedSubFilter === 'pending') {
        state.verifiedSubFilter = 'all';
      }
      const sub = state.verifiedSubFilter || 'all';
      const hasRealEmail = (l) => l.Email && l.Email.trim() && !/^Not found/i.test(l.Email);
      if (sub === 'approved') {
        stageLeads = stageLeads.filter(l => l.readyForOutreach === true);
      } else if (sub === 'pending') {
        stageLeads = stageLeads.filter(l => l.readyForOutreach !== true && hasRealEmail(l));
      } else if (sub === 'no-email') {
        stageLeads = stageLeads.filter(l => !hasRealEmail(l));
      }
    }

    renderStageBanner(s, allByStage.length, stageLeads.length);
    // 서브필터 chip 렌더 (해당 stage 에서만, 다른 stage 에서는 정리)
    if (s.stage === 'verifying') {
      renderVerifyingSubFilterChips(allByStage);
      clearVerifiedSubFilterChips();
    } else if (s.stage === 'verified') {
      renderVerifiedSubFilterChips(allByStage);
      clearVerifyingSubFilterChips();
    } else {
      clearVerifyingSubFilterChips();
      clearVerifiedSubFilterChips();
    }
    // 통계 stats-grid 는 stage 페이지에서 숨김 (이미 renderStats에서 렌더됐으므로 지움)
    const statsEl = document.getElementById('statsGrid');
    if (statsEl) statsEl.innerHTML = '';
    renderLeadTable(stageLeads, `${s.title}에 해당하는 리드가 없습니다.`);
    return;
  }

  // ── 새 부가 도구 페이지 스켈레톤 ──────────────────────────────
  if (state.view === "tool-b2b-email") {
    els.viewTitle.textContent = "📝 메일 양식";
    els.viewSubtitle.textContent = "발송에 쓸 메일 문구(제목·본문·변수) 를 저장/편집. 실제 발송은 이메일 컨택 페이지에서.";
    renderB2BEmailManager();
    return;
  }
  if (state.view === "tool-mail-accounts") {
    els.viewTitle.textContent = "📬 메일 계정 관리";
    els.viewSubtitle.textContent = "회사 SMTP 계정을 등록해서 다계정으로 발송 관리.";
    renderMailAccountsTool();
    return;
  }
  if (state.view === "tool-crawler") {
    els.viewTitle.textContent = "🕷 이메일 크롤링";
    els.viewSubtitle.textContent = "웹사이트에서 컨택 이메일 자동 수집.";
    renderCrawlerTool();
    return;
  }
  if (state.view === "tool-import-history") {
    els.viewTitle.textContent = "📋 Import History";
    els.viewSubtitle.textContent = "CSV 가져오기 기록. 배치별 롤백 가능.";
    renderImportHistory();
    return;
  }
  if (state.view === "tool-scheduled-mails") {
    els.viewTitle.textContent = "📅 예약 발송 관리";
    els.viewSubtitle.textContent = "대기 중 예약 · 발송 여부 확인 · 취소 · 즉시 발송.";
    renderScheduledMailsPage();
    return;
  }
  if (state.view === "tool-user-guide") {
    els.viewTitle.textContent = "📖 사용 설명서";
    els.viewSubtitle.textContent = "처음 쓰시는 분을 위한 단계별 가이드 · 각 화면이 어떻게 이어지는지.";
    renderUserGuidePage();
    return;
  }
  if (state.view === "tool-inbox") {
    els.viewTitle.textContent = "📥 받은 메일함";
    els.viewSubtitle.textContent = "이카운트 메일함에서 수집한 수신 메일. 대화 단위로 접어서 표시.";
    renderInboxPage({ needsReplyOnly: false });
    return;
  }
  if (state.view === "tool-inbox-needsreply") {
    els.viewTitle.textContent = "⚠️ 회신 필요";
    els.viewSubtitle.textContent = "상대가 질문·요청을 보냈고 아직 답하지 않은 메일.";
    renderInboxPage({ needsReplyOnly: true });
    return;
  }
  if (state.view === "tool-deadlines") {
    els.viewTitle.textContent = "⏰ 기한 관리";
    els.viewSubtitle.textContent = "회신 기한이 잡힌 메일 · 지난 것부터 순서대로 (최근 2개월).";
    renderDeadlinesPage();
    return;
  }
  if (state.view === "tool-briefing") {
    els.viewTitle.textContent = "📋 오늘의 브리핑";
    els.viewSubtitle.textContent = "회신 필요 · 기한 임박 · 새로 답장 온 곳을 한 장으로.";
    renderBriefingPage();
    return;
  }
  if (state.view === "tool-legacy") {
    els.viewTitle.textContent = "📚 올린 업체 목록";
    els.viewSubtitle.textContent = "엑셀로 올린 업체입니다. AI 검증과 직접 검토를 돌려 보낼 곳을 고릅니다.";
    renderLegacyPage();
    return;
  }
  // 사이드바 [⬆ 엑셀·CSV 올리기] — 별도 화면이 아니라 올리기 창을 띄우고
  // 목록 화면에 머문다. 올린 뒤 결과를 바로 그 자리에서 보게 하려는 것이다.
  if (state.view === "tool-legacy-import") {
    state.view = "tool-legacy";
    render();
    openImportCsvModal();
    return;
  }
  if (state.view === "tool-review") {
    const fromLegacy = _review.source === 'legacy';
    els.viewTitle.textContent = fromLegacy ? "🔎 직접 검토 · 올린 데이터" : "🔎 직접 검토";
    els.viewSubtitle.textContent = fromLegacy
      ? "엑셀로 올린 업체 중 아직 고르지 않은 곳을 한 회사씩 봅니다."
      : "AI 판정을 통과한 곳을 한 회사씩 봅니다. 버튼을 누르면 바로 다음 회사로 넘어갑니다.";
    renderReviewPage();
    return;
  }
  if (state.view === "tool-trash") {
    els.viewTitle.textContent = "🗑 휴지통";
    els.viewSubtitle.textContent = "치워둔 메일. DB 에서 지우지 않으므로 언제든 되돌릴 수 있습니다.";
    renderTrashPage();
    return;
  }
  if (state.view === "tool-mail-settings") {
    els.viewTitle.textContent = "🔌 메일 수신 설정";
    els.viewSubtitle.textContent = "이카운트 IMAP 연결 · 수집 폴더 · 광고 필터.";
    renderMailSettingsPage();
    return;
  }

  els.viewTitle.textContent = "Leads";
  els.viewSubtitle.textContent = "Edit, qualify, and manage buyer outreach.";
  renderLeadTable(leads);
}

function renderStats(leads) {
  // 파이프라인 페이지에서는 stage 배너로 대체하므로 stats grid 비움
  const isStagePage = state.view && state.view.startsWith('pipeline-');
  const isToolPage = state.view && state.view.startsWith('tool-');
  if (isStagePage || isToolPage) {
    if (els.stats) els.stats.innerHTML = '';
    return;
  }
  const all = getLeads();
  const countryCount = unique(all.map((lead) => lead.Country)).length;
  const contacted = all.filter((lead) => lead.status !== "New").length;
  const today = new Date().toISOString().slice(0, 10);
  const due = all.filter((lead) => lead.nextFollowUp && lead.nextFollowUp <= today && !["Won", "Lost"].includes(lead.status)).length;

  // stage 기반 통과/실패 카운트 (파이프라인과 일치) — 서버 카운트 우선, 없으면 클라이언트 계산
  const stages = (_stageCountsCache && _stageCountsCache.stages) || {};
  const passedCount   = stages.verified != null ? stages.verified   : all.filter(l => (l.stage || 'imported') === 'verified').length;
  const failedCount   = stages.failed   != null ? stages.failed     : all.filter(l => (l.stage || 'imported') === 'failed').length;
  const archivedCount = stages.archived != null ? stages.archived   : all.filter(l => (l.stage || 'imported') === 'archived').length;

  els.stats.innerHTML = [
    stat("Visible", leads.length, "leads"),
    stat("Countries", countryCount, "countries"),
    stat("Worked", contacted, "worked"),
    stat("Due", due, "followups"),
    stat("No Email", all.filter((lead) => !hasEmail(lead)).length, "emails"),
    // ── stage 기반 (사이드바와 일치) ──
    statVerify("✅ AI 1차 통과", passedCount, "passed"),
    statVerify("🚫 실패 (컨택 불가)", failedCount, "invalid"),
    statVerify("📦 보관", archivedCount, "archived"),
  ].join("");

  els.stats.querySelectorAll("[data-stat-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetView = button.dataset.statView;
      state.view = targetView;
      if (["leads", "worked", "favorites"].includes(targetView)) {
        resetAllFilters();
      }
      state.selectedId = getFilteredLeads()[0]?.id || state.selectedId;
      render();
    });
  });

  // 검증 stat 카드 클릭 → leads 뷰 + 검증 필터 적용
  els.stats.querySelectorAll("[data-verify-bucket]").forEach((button) => {
    button.addEventListener("click", () => {
      const bucket = button.dataset.verifyBucket;
      state.view = "leads";
      // 다른 필터는 초기화 (분류 뷰처럼 동작)
      resetAllFilters();
      state.verify = bucket;
      if (els.verify) els.verify.value = bucket;
      state.selectedId = getFilteredLeads()[0]?.id || state.selectedId;
      render();
    });
  });
}

function renderPipeline() {
  if (!els.pipeline) return;
  const leads = getLeads();
  const HIDDEN_PIPELINE_STATUSES = ["New", "Qualified", "Contacted", "Sample Sent", "Negotiating", "Won", "Lost"];
  els.pipeline.innerHTML = STATUSES
    .filter((status) => !HIDDEN_PIPELINE_STATUSES.includes(status))
    .map((status) => {
      const count = leads.filter((lead) => lead.status === status).length;
      const active = state.view === "leads" && state.status === status ? "active" : "";
      return `
        <button class="pipeline-pill ${active}" data-pipeline-status="${escapeAttr(status)}" type="button">
          <span>${escapeHtml(status)}</span>
          <strong>${count}</strong>
        </button>
      `;
    }).join("");

  els.pipeline.querySelectorAll("[data-pipeline-status]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = "leads";
      state.status = button.dataset.pipelineStatus;
      if (els.status) els.status.value = state.status;   // 숨겨져 있을 수 있다
      state.selectedId = getFilteredLeads()[0]?.id || state.selectedId;
      render();
    });
  });
}

// stage 배너 (파이프라인 페이지 상단에 표시)
// 검증대기/검증완료 stage 에서 실행 대상 카운트 계산
// 클라이언트 티어 판정 (server-side lead-tier.ts 와 동일 로직)
var MAJOR_RETAILERS_CLIENT = [
  'sephora','ulta','walmart','target','costco','amazon',
  'boots','superdrug','watsons','as watson','mannings',
  'douglas','nocibe','marionnaud','kruidvat',
  'dm-drogerie','dm drogerie','rossmann','muller','müller',
  'etos','trekpleister','ici paris','iciparisxl',
  'harrods','selfridges','liberty','harvey nichols',
  'el corte ingles','el corte inglés',
  'galeries lafayette','printemps','kadewe',
  'la rinascente','la redoute',
  'shinsegae','lotte','olive young','chicor','aritaum','hyundai department',
  'nykaa','purplle','tira','reliance','shoppers stop',
  'sociolla','cosrx','watson','guardian',
  'matsumotokiyoshi','matsukiyo','welcia',
  'ainz','tsuruha','sundrug','tokyu hands','loft',
  'faces','sephora middle east','gulf',
  'asos','cult beauty','lookfantastic','feelunique',
  'beauty bay','mecca','adore beauty',
  'yesstyle','stylekorean','jolse','stylevana',
  'falabella','liverpool','palacio de hierro',
  'beauty distributor','beauty wholesaler','cosmetics distributor',
];
function getClientLeadTier(lead) {
  const email = (lead.Email || '').trim();
  const hasEmail = email && !/^Not found/i.test(email) && /@/.test(email);
  if (!hasEmail) return 'C';
  const site = (lead.WebsiteContact || '').trim();
  const hasSite = site && (/^https?:\/\/|^www\.|\.(com|net|org|co|io|kr|jp|de|fr|uk|es|it|ru|au|nl|pl|tr|sa|ae|hk|sg|my|vn|th|id|ph|in|br|mx|ar|ca)($|\/)/i.test(site));
  if (!hasSite) return 'C';
  const c = (lead.Company || '').toLowerCase();
  const w = site.toLowerCase();
  const isMajor = MAJOR_RETAILERS_CLIENT.some(kw => c.includes(kw) || w.includes(kw));
  return isMajor ? 'A' : 'B';
}

function computeVerificationCounts(stage) {
  const isKorean = (c) => /korea|한국|대한민국/i.test(c || '') && !/north/i.test(c || '');
  const inStage = baseLeads.filter((l) => (l.stage || 'imported') === stage && !l.deleted && !isKorean(l.Country));
  const aiPending = inStage.filter((l) => !l.verification?.aiVerifiedAt).length;
  const noEmailWithSite = inStage.filter((l) =>
    (!l.Email || String(l.Email).trim() === '') &&
    l.WebsiteContact && String(l.WebsiteContact).trim() !== ''
  );
  const crawlPending = noEmailWithSite.filter((l) => !l.crawledAt).length;
  const crawlTriedNoResult = noEmailWithSite.filter((l) => !!l.crawledAt).length;
  return { aiPending, crawlPending, crawlTriedNoResult };
}

function renderStageBanner(stageInfo, totalCount, filteredCount) {
  const style = STAGE_STYLE[stageInfo.stage] || STAGE_STYLE.imported;
  const iconMatch = stageInfo.title.match(/^([^\s]+)/);
  const icon = iconMatch ? iconMatch[1] : '📊';
  const filterHint = totalCount !== filteredCount
    ? `<span style="color:var(--text-tertiary);font-size:12px;margin-left:8px">(전체 ${totalCount}건 중 필터 적용)</span>`
    : '';
  const container = document.getElementById('stageBannerContainer') || (() => {
    const wrap = document.createElement('div');
    wrap.id = 'stageBannerContainer';
    const content = document.getElementById('content');
    content.parentNode.insertBefore(wrap, content);
    return wrap;
  })();

  // 검증대기 / 검증완료 stage 는 히어로 CTA 카드 추가 렌더
  let heroCard = '';
  if (stageInfo.stage === 'verifying') {
    // [🧠 AI 검증 실행] 버튼은 뺐다.
    //
    // 누를 때마다 대기 건수만큼 Claude API 가 호출되어 요금이 나가는 버튼이라,
    // 수백 건이 쌓인 화면에서 무심코 누르면 비용이 한 번에 터진다.
    // 기업 분석이 필요하면 개발자 쪽에서 일괄로 돌려 결과만 DB 에 넣는다.
    //
    // 되살리려면: 아래 heroCard 를 지우고 git 이력의 카드 마크업을 복원하면 된다.
    // 핸들러(runAiVerifyOnVerifyingBtn)와 API(/api/leads/verify-ai)는 그대로 있다.
    heroCard = '';
  } else if (stageInfo.stage === '__failed') {
    // 검증 실패 페이지 — archived + not-buyer 리드
    const failedCount = baseLeads.filter(l =>
      !l.deleted &&
      (l.stage || 'imported') === 'archived' &&
      l?.verification?.aiVerdict === 'not-buyer'
    ).length;
    heroCard = `
      <div class="verify-hero" style="margin-top:12px">
        <div class="verify-hero-card" style="
          padding:20px;border-radius:16px;
          background:linear-gradient(135deg,#fef2f2 0%,#fecaca 100%);
          border:1px solid #fca5a5;display:flex;align-items:center;gap:20px;
        ">
          <div style="font-size:40px">🚫</div>
          <div style="flex:1">
            <div style="font-size:12px;color:#991b1b;font-weight:600;letter-spacing:0.5px">검증 실패</div>
            <div style="font-size:14px;color:#7f1d1d;margin-top:2px;line-height:1.65">
              <b>${failedCount.toLocaleString()}건</b> · 메일을 보낼 수 없어 걸러진 곳입니다.<br>
              <span style="font-size:12.5px">
                대부분 <b>보낼 메일 주소가 없습니다</b> — 이메일 칸에 "Contact form on site",
                "Not found publicly" 처럼 <b>연락 방법</b>이 적혀 있거나 비어 있습니다.
                일부는 AI 가 K-뷰티와 무관하다고 본 곳입니다.<br>
                주소를 찾아 넣으면 각 행의 <b>[→ ✅ 검증완료]</b> 로 되돌릴 수 있습니다.
                <b>[전부 정리]</b> 는 목록에서 감출 뿐이고 되살릴 수 있습니다.
              </span>
            </div>
          </div>
          <!-- '완전 삭제' 가 아니다. 목록에서 감출 뿐이고 되살릴 수 있다.
               AI 판정은 틀릴 수 있어서(실제로 진짜 바이어가 걸러진 적이 있다)
               한 번 지우면 되돌릴 방법이 없는 쪽으로 두면 안 된다.
               건수는 서버에서 다시 세므로 여기 숫자는 안내용이다. -->
          <button id="deleteAllFailedHeroBtn" type="button"
            title="목록에서 치웁니다 — 완전히 지우는 것이 아니라 되살릴 수 있습니다"
            style="
            font-size:13px;font-weight:700;padding:12px 20px;white-space:nowrap;
            background:#fff;color:#b91c1c;border:1px solid #fca5a5;border-radius:10px;cursor:pointer;
          ">
            🗑 전부 정리
          </button>
        </div>
      </div>
    `;
  } else if (stageInfo.stage === 'verified') {
    // 검증 완료 = "승인하면 바로 나가는" 자리. 카드 하나로 끝낸다.
    //
    // 예전에는 여기에 (1) 메일 크롤링 카드 (2) A/B 등급 원클릭 발송 카드가 같이 떴다.
    // 등급을 나눈 건 "많으니 좋은 것부터 보내자"는 뜻이었는데, 어차피 전부 눈으로
    // 확인하고 보내므로 "B등급은 봐야 하나 말아야 하나" 하는 고민만 늘었다.
    // 크롤링은 쓰지 않기로 해서 같이 뺐다.
    // (getClientLeadTier / sendAllTierABtn 핸들러는 그대로 살아 있어 되살리기 쉽다.)
    const emailOk = (l) =>
      !l.deleted && (l.stage || 'imported') === 'verified' &&
      l.Email && !/^Not found/i.test(l.Email) && /@/.test(l.Email);
    // baseLeads 에 기대면 안 된다. 사이드바에서 검증 완료로 바로 들어오면
    // 그 배열이 비어 있어서 "발송 가능 0건" 으로 뜨고 버튼까지 죽는다
    // (발송 관리 화면이 통째로 비어 보이던 것과 같은 원인).
    // 서버 집계를 우선 쓰고, 없을 때만 로컬 배열로 떨어진다.
    const localReady = baseLeads.filter(emailOk).length;
    const serverVerified = _stageCountsCache?.stages?.verified;
    const emailReadyCount = (typeof serverVerified === 'number' && serverVerified > localReady)
      ? serverVerified : localReady;
    // "승인 완료 / 검토 남음" 은 readyForOutreach 로 세던 값이라 늘 전체와 같았다.
    // 지금 의미 있는 수는 "발송 리스트로 옮긴 곳"뿐이라 그것만 쓴다.
    const queuedCount = (_stageCountsCache?.stages?.queued) || 0;

    heroCard = `
      <div class="verify-hero" style="margin-top:12px">
        <div class="verify-hero-card" style="
          padding:20px;border-radius:16px;
          background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);
          border:1px solid #93c5fd;display:flex;align-items:center;gap:20px;
        ">
          <div style="font-size:40px">📧</div>
          <div style="flex:1">
            <div style="font-size:12px;color:#1e40af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">발송 가능</div>
            <div style="font-size:24px;font-weight:800;color:#1e3a8a;line-height:1.1;margin-top:2px">
              ${emailReadyCount.toLocaleString()}<span style="font-size:14px;font-weight:600;color:#3b82f6;margin-left:4px">건</span>
            </div>
            <p style="font-size:12px;color:#1e3a8a;margin:6px 0 0;line-height:1.5">
              이 중 <b>${queuedCount.toLocaleString()}곳</b>을 발송 리스트로 옮겼습니다
            </p>
          </div>
          <!-- 예전 [⚡ 빠른 검토] 는 분류 탭(리테일 체인·유통사·브랜드…)으로 나눠
               보여주는 별도 화면이었다. 분류를 고르는 일이 하나 더 늘 뿐이고,
               대기열 기준이 readyForOutreach 라 418곳 중 9곳만 나오고 있었다.
               지금은 그 카드 화면을 그대로 쓰되 분류 탭만 뺐다 — AI 가 이미
               한 번 걸러 놓은 목록이라 사람이 할 일은 고르는 것 하나다. -->
          <button id="startReviewBtn" type="button"
            title="한 회사씩 카드로 보며 보낼 곳인지 아닌지만 고릅니다"
            style="
            font-size:14px;font-weight:700;padding:12px 18px;white-space:nowrap;
            background:#fff;color:#1d4ed8;border:1px solid #2563eb;border-radius:10px;cursor:pointer;
            ${emailReadyCount === 0 ? 'opacity:0.4;cursor:not-allowed' : ''}
          " ${emailReadyCount === 0 ? 'disabled' : ''}>
            🔎 직접 검토 시작
          </button>
          <button id="openFirstSendBtn" type="button" style="
            font-size:14px;font-weight:700;padding:12px 20px;white-space:nowrap;
            background:#2563eb;color:white;border:none;border-radius:10px;cursor:pointer;
            box-shadow:0 2px 8px rgba(37,99,235,0.3);
            ${emailReadyCount === 0 ? 'opacity:0.4;cursor:not-allowed' : ''}
          " ${emailReadyCount === 0 ? 'disabled' : ''}>
            ✉ 메일 보내기
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="stage-banner">
      <div class="stage-info">
        <div class="stage-icon" style="background:${style.bg};color:${style.fg};font-size:28px">${icon}</div>
        <div>
          <div class="stage-count">${filteredCount}<span style="font-size:14px;font-weight:500;color:var(--text-tertiary);margin-left:6px">건</span></div>
          <div class="stage-label">${stageInfo.title.replace(/^[^\s]+\s*/, '')} ${filterHint}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:16px">
        <div class="stage-hint">${stageInfo.sub}</div>
      </div>
    </div>
    ${heroCard}
  `;

  // 액션 버튼 핸들러 바인딩
  document.getElementById('runAiVerifyOnVerifyingBtn')?.addEventListener('click', () => runVerifyingStageAi());
  document.getElementById('runCrawlOnVerifyingBtn')?.addEventListener('click', () => runCrawlEmails('verifying-no-email'));
  document.getElementById('runCrawlOnVerifiedBtn')?.addEventListener('click', () => runCrawlEmails('verified-no-email'));
  document.getElementById('goApproveBtn')?.addEventListener('click', () => {
    state.verifiedSubFilter = 'pending';
    resetPagination();
    render();
  });
  // 빠른 검토 진입 — 들어갈 때마다 대기열을 새로 받는다.
  // 이전에 보던 큐가 남아 있으면 이미 판단한 회사가 다시 뜬다.
  document.getElementById('startReviewBtn')?.addEventListener('click', () => startDirectReview());
  // 검증 완료 · 첫 발송 진입점 (verified stage · 승인된 리드 or 이메일 있는 리드 대상)
  // 발송은 한 곳(발송 화면)에서만 시작한다. 여기서 모달을 바로 띄우면
  // 같은 일을 두 자리에서 하게 되고, "보낼 메일" 목록을 건너뛰게 된다.
  // 화면 이동은 사이드바 항목을 눌러서 한다 — 진입 처리가 그 핸들러에 몰려 있다.
  document.getElementById('openFirstSendBtn')?.addEventListener('click', () => {
    _outboxTab = 'ready';
    document.querySelector('.nav-item[data-view="pipeline-contacted"]')?.click();
  });
  // 원클릭 등급별 발송 (A/B) — 발송함으로 자동 이동 · 검증 완료에서 사라짐
  document.getElementById('sendAllTierABtn')?.addEventListener('click', () => openComposeModal('tier-A'));
  document.getElementById('sendAllTierBBtn')?.addEventListener('click', () => openComposeModal('tier-B'));
  document.getElementById('deleteAllFailedHeroBtn')?.addEventListener('click', () => deleteAllFailedLeads());
  document.getElementById('openBulkComposeBtn')?.addEventListener('click', () => openComposeModal('bulk-contacted'));
  document.getElementById('openBulkScheduleBtn')?.addEventListener('click', () => {
    _composeState.useSchedule = true;
    _composeState.scheduleAt = defaultScheduleTime();
    openComposeModal('bulk-contacted');
  });
  document.getElementById('openTemplateEditorBtn')?.addEventListener('click', () => {
    state.email.mode = 'list';   // 늘 목록부터 — 전에 편집하던 양식이 열리면 안 된다
    state.view = 'tool-b2b-email';
    render();
  });
}

// ── AI 1차 검증 (verifying stage 파이프라인) ─────────────────
async function runVerifyingStageAi() {
  const btn = document.getElementById('runAiVerifyOnVerifyingBtn');
  const ok = confirm(
    '🧠 검증 대기 파이프라인 AI 1차 검증\n\n' +
    '조건: stage=검증대기 + AI 미검증 + 한국 기업 제외\n' +
    '진행: 청크당 20건씩 순차 처리 (예상 대상 4,000+ 건)\n' +
    '결과: beauty-buyer → 검증완료로 자동 이동 / not-buyer → 보관함\n' +
    '비용: 약 $2 (Claude Haiku 4.5)\n\n' +
    '계속하시겠습니까?'
  );
  if (!ok) return;

  if (btn) { btn.disabled = true; btn.textContent = '🧠 AI 검증 중...'; }

  let totalProcessed = 0;
  let totalMoved = { verified: 0, archived: 0, kept: 0 };
  let iterations = 0;

  try {
    while (iterations < 250) {  // 안전장치 최대 250 chunk (=5000건)
      const res = await fetch('/api/leads/verify-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'verifying-stage',
          limit: 20,
          excludeKorea: true,
          autoMoveStage: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'AI 검증 실패');

      totalProcessed += data.processed || 0;
      if (data.stageMoves) {
        totalMoved.verified += data.stageMoves.verified || 0;
        totalMoved.archived += data.stageMoves.archived || 0;
        totalMoved.kept += data.stageMoves.kept || 0;
      }
      iterations++;

      if (btn) btn.textContent = `🧠 ${totalProcessed}건 완료 (남은: ${data.remaining || 0})`;

      if (!data.hasMore) break;
      // API 부하 완화 — 짧게 쉬기
      await new Promise(r => setTimeout(r, 300));
    }

    alert(
      `✅ AI 검증 완료\n\n` +
      `총 처리: ${totalProcessed}건\n` +
      `→ 검증완료: ${totalMoved.verified}건\n` +
      `→ 보관함: ${totalMoved.archived}건\n` +
      `→ 대기 유지 (모호): ${totalMoved.kept}건`
    );
    invalidateServerPage();
    await loadLeads({ force: true });
    render();
  } catch (e) {
    alert(`❌ AI 검증 실패: ${e.message || 'unknown'}\n\n지금까지 처리: ${totalProcessed}건`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🧠 AI 1차 검증 실행'; }
  }
}

// ── 메일 크롤링 ─────────────────────────────────────
async function runCrawlEmails(scope) {
  const label = scope === 'verified-no-email' ? '검증 완료' : '검증 대기';
  const ok = confirm(
    `🔍 ${label} 리드 메일 크롤링\n\n` +
    `조건: stage=${label} + Email 비어있음 + 사이트 있음 + 한국 제외\n` +
    `진행: 청크당 50건씩, 사이트당 홈+/contact+/about 순회\n` +
    `결과: 최우선 후보 자동으로 Email 필드에 채움\n\n` +
    `계속하시겠습니까?`
  );
  if (!ok) return;

  const btnId = scope === 'verified-no-email' ? 'runCrawlOnVerifiedBtn' : 'runCrawlOnVerifyingBtn';
  const btn = document.getElementById(btnId);
  const origText = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = '🔍 크롤링 중...'; }

  let totalProcessed = 0;
  let totalFound = 0;
  let totalPromoted = 0;
  let iterations = 0;

  try {
    while (iterations < 40) {  // 40*50 = 2000건 상한
      const res = await fetch('/api/leads/crawl-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          limit: 50,
          excludeKorea: true,
          promoteToEmail: true,
          skipAlreadyCrawled: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '크롤링 실패');

      totalProcessed += data.processed || 0;
      totalFound += data.foundCount || 0;
      totalPromoted += data.promotedCount || 0;
      iterations++;

      if (btn) btn.textContent = `🔍 ${totalProcessed}건 처리 (메일 ${totalFound}건 발견)`;

      // 처리 건수 0 이면 대상 소진
      if (!data.processed) break;
      await new Promise(r => setTimeout(r, 500));
    }

    alert(
      `✅ 메일 크롤링 완료\n\n` +
      `총 처리: ${totalProcessed}건\n` +
      `메일 발견: ${totalFound}건\n` +
      `Email 필드 자동 승격: ${totalPromoted}건`
    );
    invalidateServerPage();
    await loadLeads({ force: true });
    render();
  } catch (e) {
    alert(`❌ 크롤링 실패: ${e.message || 'unknown'}\n\n지금까지 처리: ${totalProcessed}건`);
  } finally {
    if (btn) { btn.disabled = false; if (origText) btn.textContent = origText; }
  }
}

// 파이프라인/도구 페이지에서는 stage 배너로 대체하므로 stat grid 는 숨김
function clearStageBanner() {
  const c = document.getElementById('stageBannerContainer');
  if (c) c.innerHTML = '';
}

// 검증대기 페이지 서브필터 chip (AI 진행 여부로 분류)
function renderVerifyingSubFilterChips(allInStage) {
  const containerId = 'verifyingSubFilterChips';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    // stageBannerContainer 바로 아래에 삽입
    const banner = document.getElementById('stageBannerContainer');
    if (banner && banner.parentNode) {
      banner.parentNode.insertBefore(container, banner.nextSibling);
    } else {
      const content = document.getElementById('content');
      content.parentNode.insertBefore(container, content);
    }
  }

  // 각 필터별 카운트 (검증대기 stage 내부 3 상태만)
  const cAll = allInStage.length;
  const cUnverified = allInStage.filter(l => !l?.verification?.aiVerifiedAt).length;
  const cMaybe = allInStage.filter(l => l?.verification?.aiVerdict === 'maybe').length;

  const cur = state.verifyingSubFilter || 'unverified';
  const chip = (key, label, count, color) => {
    const active = key === cur;
    const bg = active ? color : 'var(--surface-1)';
    const fg = active ? 'white' : 'var(--text-primary)';
    const bd = active ? color : 'var(--border)';
    return `<button type="button" class="sub-filter-chip" data-sub-filter="${key}"
      style="padding:6px 12px;font-size:12px;font-weight:600;
      background:${bg};color:${fg};border:1px solid ${bd};border-radius:99px;cursor:pointer;
      display:inline-flex;align-items:center;gap:6px;transition:all 0.1s">
      ${label} <span style="opacity:0.7;font-weight:500">${count.toLocaleString()}</span>
    </button>`;
  };

  container.innerHTML = `
    <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <span style="font-size:11px;color:var(--text-tertiary);margin-right:4px;font-weight:600">🔎 상태별:</span>
      ${chip('unverified', '⏳ 검증 전 (기본)', cUnverified, '#f59e0b')}
      ${chip('maybe', '🧠 모호 (사람 판단)', cMaybe, '#a855f7')}
      ${chip('all', '📦 전체 검증대기', cAll, '#334155')}
    </div>
  `;

  container.querySelectorAll('.sub-filter-chip').forEach(el => {
    el.addEventListener('click', () => {
      state.verifyingSubFilter = el.dataset.subFilter;
      resetPagination();
      render();
    });
  });
}
function clearVerifyingSubFilterChips() {
  const c = document.getElementById('verifyingSubFilterChips');
  if (c && c.parentNode) c.parentNode.removeChild(c);
}

// 검증완료 페이지 서브필터 chip + 벌크 승인 버튼
function renderVerifiedSubFilterChips(allInStage) {
  const containerId = 'verifiedSubFilterChips';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    const banner = document.getElementById('stageBannerContainer');
    if (banner && banner.parentNode) {
      banner.parentNode.insertBefore(container, banner.nextSibling);
    } else {
      const content = document.getElementById('content');
      content.parentNode.insertBefore(container, content);
    }
  }

  const isKor = (c) => /korea|한국|대한민국/i.test(c || '') && !/north/i.test(c || '');
  const hasRealEmail = (l) => l.Email && String(l.Email).trim() && !/^Not found/i.test(l.Email);

  // 한국 제외한 실질 대상 기준
  const nonKr = allInStage.filter(l => !isKor(l.Country || ''));
  const cAll = nonKr.length;
  const cApproved = nonKr.filter(l => l.readyForOutreach === true).length;
  const cPending = nonKr.filter(l => l.readyForOutreach !== true && hasRealEmail(l)).length;
  const cNoEmail = nonKr.filter(l => !hasRealEmail(l)).length;

  const cur = state.verifiedSubFilter || 'all';
  const chip = (key, label, count, color) => {
    const active = key === cur;
    const bg = active ? color : 'var(--surface-1)';
    const fg = active ? 'white' : 'var(--text-primary)';
    const bd = active ? color : 'var(--border)';
    return `<button type="button" class="v-sub-filter-chip" data-sub-filter="${key}"
      style="padding:6px 12px;font-size:12px;font-weight:600;
      background:${bg};color:${fg};border:1px solid ${bd};border-radius:99px;cursor:pointer;
      display:inline-flex;align-items:center;gap:6px;transition:all 0.1s">
      ${label} <span style="opacity:0.7;font-weight:500">${count.toLocaleString()}</span>
    </button>`;
  };

  container.innerHTML = `
    <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <!-- readyForOutreach 기준 승인 칩·버튼은 뺐다. 그 플래그는 검증 완료
             전 건에 켜져 있어 "승인됨" 이 늘 전체와 같은 수로 떴고, 실제로 보낼
             목록(발송 리스트)과는 무관했다. 승인은 이제 발송 리스트로 옮기는
             것 하나뿐이다. (bulkApproveVisible / runDryRunSimulation 은 그대로
             살아 있어 되살리기 쉽다.) -->
        ${chip('all', '아직 안 옮김', cAll, '#334155')}
        ${chip('no-email', '📭 이메일 없음', cNoEmail, '#94a3b8')}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span style="font-size:11px;color:var(--text-tertiary)">
          보낼 곳을 체크해서 <b>[발송 리스트로 옮기기]</b>
        </span>
      </div>
    </div>
  `;

  container.querySelectorAll('.v-sub-filter-chip').forEach(el => {
    el.addEventListener('click', () => {
      state.verifiedSubFilter = el.dataset.subFilter;
      resetPagination();
      render();
    });
  });
}
function clearVerifiedSubFilterChips() {
  const c = document.getElementById('verifiedSubFilterChips');
  if (c && c.parentNode) c.parentNode.removeChild(c);
}

// 검증완료 상단 성공/실패 대형 탭 (한 페이지 안에서 결과 분류)
function renderVerifiedResultTabs(successCount, failedCount) {
  const containerId = 'verifiedResultTabs';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    const banner = document.getElementById('stageBannerContainer');
    if (banner && banner.parentNode) {
      banner.parentNode.insertBefore(container, banner.nextSibling);
    } else {
      const content = document.getElementById('content');
      content.parentNode.insertBefore(container, content);
    }
  }
  const cur = state.verifiedResultTab || 'success';
  const tab = (key, label, count, activeColor, activeBg) => {
    const active = key === cur;
    return `<button type="button" class="v-result-tab" data-tab="${key}"
      style="flex:1;padding:14px 18px;font-size:14px;font-weight:${active ? '700' : '500'};
      background:${active ? activeBg : '#f1f5f9'};
      color:${active ? activeColor : '#475569'};
      border:none;border-bottom:3px solid ${active ? activeColor : 'transparent'};
      cursor:pointer;transition:all 0.15s;
      display:flex;align-items:center;justify-content:center;gap:8px">
      <span>${label}</span>
      <span style="padding:2px 8px;background:${active ? activeColor : '#e2e8f0'};color:${active ? 'white' : '#64748b'};border-radius:99px;font-size:11px;font-weight:700">${(count || 0).toLocaleString()}</span>
    </button>`;
  };
  container.innerHTML = `
    <div style="margin-top:12px;display:flex;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden">
      ${tab('success', '✅ 검증 성공', successCount, '#15803d', '#dcfce7')}
      ${tab('failed',  '🚫 검증 실패', failedCount,  '#dc2626', '#fef2f2')}
    </div>
  `;
  container.querySelectorAll('.v-result-tab').forEach(el => {
    el.addEventListener('click', () => {
      state.verifiedResultTab = el.dataset.tab;
      // 서브필터/페이지 리셋
      state.verifiedSubFilter = 'all';
      resetPagination();
      // 캐시 무효화 (다른 stage 페이지드)
      _serverPageCache = null;
      render();
    });
  });
}
function clearVerifiedResultTabs() {
  const c = document.getElementById('verifiedResultTabs');
  if (c && c.parentNode) c.parentNode.removeChild(c);
}

// ── 검증완료 A/B/C 등급 breakdown ────────────────────
var _tierCountsCache = null;
async function loadTierCounts(force) {
  const now = Date.now();
  if (!force && _tierCountsCache && (now - _tierCountsCache.ts) < 60 * 1000) {
    return _tierCountsCache;
  }
  try {
    const res = await fetch('/api/leads/tier-counts');
    const data = await res.json();
    if (data.success) {
      _tierCountsCache = { ...data, ts: now };
      return _tierCountsCache;
    }
  } catch (e) { console.error('tier-counts', e); }
  return null;
}

async function renderVerifiedTierChips() {
  // 캐시 없으면 fetch — 그동안 아무것도 렌더 안 함 (다른 탭 이동시 잔상 방지)
  const c = await loadTierCounts();
  if (!c) return;
  // 렌더 시점에도 verified 성공 탭 유지 중인지 확인 (fetch 중 사용자가 탭 변경했을 수 있음)
  if (state.view !== 'pipeline-verified' || (state.verifiedResultTab && state.verifiedResultTab !== 'success')) {
    return;
  }
  const containerId = 'verifiedTierChips';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    const subChips = document.getElementById('verifiedSubFilterChips');
    if (subChips && subChips.parentNode) {
      subChips.parentNode.insertBefore(container, subChips.nextSibling);
    } else {
      const banner = document.getElementById('stageBannerContainer');
      if (banner && banner.parentNode) banner.parentNode.insertBefore(container, banner.nextSibling);
    }
  }
  const cur = state.tierFilter || null;
  const tierCard = (key, label, count, sub, color, bg, bd) => {
    const active = cur === key;
    return `
      <div class="tier-card" data-tier="${key}"
        style="flex:1;padding:12px 14px;background:${active ? color : bg};
               border:2px solid ${active ? color : bd};border-radius:12px;
               display:flex;flex-direction:column;gap:2px;min-width:0;cursor:pointer;
               transition:all 0.15s;box-shadow:${active ? '0 4px 12px ' + color + '55' : 'none'}">
        <div style="display:flex;align-items:baseline;gap:8px">
          <span style="font-size:20px;font-weight:800;color:${active ? 'white' : color}">${count.toLocaleString()}</span>
          <span style="font-size:12px;color:${active ? 'white' : color};font-weight:700">${label}</span>
        </div>
        <div style="font-size:10px;color:${active ? 'rgba(255,255,255,0.9)' : color};opacity:${active ? 1 : 0.75};line-height:1.3">${sub}</div>
      </div>
    `;
  };
  const cCount = c.C || 0;
  container.innerHTML = `
    <div style="margin-top:10px;padding:10px;background:var(--surface-1);border:1px solid var(--border);border-radius:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:11px;color:var(--text-secondary);font-weight:700">
          📊 등급 클릭해서 필터 · 총 ${c.total.toLocaleString()}건
        </div>
        ${cur ? `<button type="button" id="clearTierBtn" style="font-size:11px;padding:3px 10px;background:var(--surface-2);color:var(--text-secondary);border:1px solid var(--border);border-radius:99px;cursor:pointer">✕ 전체 보기</button>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${tierCard('A', '🥇 A급', c.A, '이메일 + 사이트 + 대형 리테일러', '#a16207', '#fef9c3', '#fde047')}
        ${tierCard('B', '🥈 B급', c.B, '이메일 + 사이트 있음', '#1e40af', '#dbeafe', '#93c5fd')}
        ${cCount > 0 ? tierCard('C', '🥉 C급', cCount, '이메일/사이트 부족', '#57534e', '#f5f5f4', '#d6d3d1') : ''}
      </div>
    </div>
  `;
  container.querySelectorAll('.tier-card').forEach(el => {
    el.addEventListener('click', () => {
      const t = el.dataset.tier;
      state.tierFilter = (state.tierFilter === t) ? null : t;
      resetPagination();
      _serverPageCache = null;
      render();
    });
  });
  const clearBtn = document.getElementById('clearTierBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    state.tierFilter = null;
    resetPagination();
    _serverPageCache = null;
    render();
  });
}

function clearVerifiedTierChips() {
  const c = document.getElementById('verifiedTierChips');
  if (c && c.parentNode) c.parentNode.removeChild(c);
}

// 검증완료 서브필터 chip — 서버 카운트 기반 (전체 리드 fetch 없이)
function renderVerifiedSubFilterChipsServer(verifiedSub, _failedCount) {
  const containerId = 'verifiedSubFilterChips';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    const banner = document.getElementById('stageBannerContainer');
    if (banner && banner.parentNode) {
      banner.parentNode.insertBefore(container, banner.nextSibling);
    } else {
      const content = document.getElementById('content');
      content.parentNode.insertBefore(container, content);
    }
  }
  const cur = state.verifiedSubFilter || 'all';
  const chip = (key, label, count, color) => {
    const active = key === cur;
    const bg = active ? color : 'var(--surface-1)';
    const fg = active ? 'white' : 'var(--text-primary)';
    const bd = active ? color : 'var(--border)';
    return `<button type="button" class="v-sub-filter-chip" data-sub-filter="${key}"
      style="padding:6px 12px;font-size:12px;font-weight:600;
      background:${bg};color:${fg};border:1px solid ${bd};border-radius:99px;cursor:pointer;
      display:inline-flex;align-items:center;gap:6px;transition:all 0.1s">
      ${label} <span style="opacity:0.7;font-weight:500">${(count || 0).toLocaleString()}</span>
    </button>`;
  };
  // ── 승인 상태 줄 ──
  //
  // 예전에는 readyForOutreach 기준으로 "승인됨 409 · 승인 대기 0" 이 떴다.
  // 그 플래그는 검증 완료 전 건에 켜져 있어 항상 전체와 같은 수가 나왔고,
  // 정작 실제로 보낼 목록(발송 리스트, queued)과는 아무 상관이 없었다.
  // 지금 승인은 "발송 리스트로 옮겼는가" 하나뿐이라 그것만 보여준다.
  const queuedN = verifiedSub.queued || 0;
  container.innerHTML = `
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      ${chip('all', '아직 안 옮김', verifiedSub.all, '#334155')}
      ${chip('no-email', '📭 이메일 없음', verifiedSub.noEmail, '#94a3b8')}
      <button type="button" id="goSendListBtn"
        title="발송 리스트로 옮긴 곳을 봅니다 (발송 관리 → 보낼 메일)"
        style="padding:6px 12px;font-size:12px;font-weight:700;border-radius:99px;cursor:pointer;
               display:inline-flex;align-items:center;gap:6px;
               background:${queuedN ? '#e0f2fe' : 'var(--surface-1)'};
               color:${queuedN ? '#075985' : 'var(--text-tertiary)'};
               border:1px solid ${queuedN ? '#7dd3fc' : 'var(--border)'}">
        📋 발송 리스트 <span style="opacity:.75;font-weight:600">${queuedN.toLocaleString()}</span> →
      </button>
      <span style="font-size:11px;color:var(--text-tertiary)">
        보낼 곳을 체크해서 <b>[발송 리스트로 옮기기]</b> 를 누르면 발송 관리로 넘어갑니다
      </span>
    </div>
  `;
  container.querySelectorAll('.v-sub-filter-chip').forEach(el => {
    el.addEventListener('click', () => {
      state.verifiedSubFilter = el.dataset.subFilter;
      resetPagination();
      render();
    });
  });
  container.querySelector('#goSendListBtn')?.addEventListener('click', () => {
    _outboxTab = 'ready';
    document.querySelector('.nav-item[data-view="pipeline-contacted"]')?.click();
  });
}

// 서버 페이지드 테이블 렌더러 (verified/failed 전용)
function renderServerPagedTable(pageData, stageInfo) {
  const leads = pageData.leads;
  if (!leads.length) {
    els.content.innerHTML = emptyState(`${stageInfo.title}에 해당하는 리드가 없습니다.`);
    return;
  }
  const start = (pageData.page - 1) * 50 + 1;
  const end = start + leads.length - 1;
  const visibleIds = leads.map(l => l.id);
  const selectedVisibleCount = visibleIds.filter(id => state.selectedLeadIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  els.content.innerHTML = `
    <div class="bulk-actions">
      <button class="button secondary" data-select-visible type="button">${allVisibleSelected ? "이 페이지 선택 해제" : "이 페이지 전체 선택"}</button>
      <button class="button ghost danger-action" data-delete-selected type="button" ${state.selectedLeadIds.size ? "" : "disabled"}>
        Delete Selected (${state.selectedLeadIds.size})
      </button>
      <span style="margin-left:auto;font-size:12px;color:var(--text-tertiary);display:inline-flex;align-items:center;gap:10px">
        <label style="display:inline-flex;align-items:center;gap:5px">
          정렬
          <select id="leadSortSelect" style="padding:4px 8px;font-size:12px;border:1px solid var(--border-default);
                  border-radius:6px;background:var(--bg-surface);color:var(--text-primary);cursor:pointer">
            <option value="reco" ${_leadSort === 'reco' ? 'selected' : ''}>추천순</option>
            <option value="country" ${_leadSort === 'country' ? 'selected' : ''}>국가별</option>
            <option value="recent" ${_leadSort === 'recent' ? 'selected' : ''}>최근 등록순</option>
          </select>
        </label>
        <span>총 <b style="color:var(--text-primary)">${pageData.total.toLocaleString()}</b>건 중 <b style="color:var(--text-primary)">${start}~${end}</b>번 표시</span>
      </span>
    </div>
    ${_leadSort === 'country' ? `
      <div style="margin:-4px 0 10px;font-size:11.5px;color:var(--text-tertiary);line-height:1.6">
        국가별 = 같은 나라끼리 묶어서 봅니다. 한 시장을 연달아 보면 판단 기준이 덜 흔들리고,
        나라별로 메일 문구를 다르게 쓸 때도 편합니다. 같은 나라 안에서는 추천순입니다.
      </div>` : ''}
    ${_leadSort === 'reco' ? `
      <div style="margin:-4px 0 10px;font-size:11.5px;color:var(--text-tertiary);line-height:1.6">
        추천순 = <b>거래 규모</b>(유통사·체인이 위) + <b>담당자 도달</b>(b2b@·wholesale@ 이 info@ 보다 위)
        + <b>K-뷰티 실적</b>(한국 브랜드를 이미 파는 곳). 각 회사의 근거는 순위 옆에 마우스를 올리면 보입니다.
      </div>` : ''}
    ${renderPaginationBar(pageData.page, pageData.totalPages, pageData.total, { compact: true })}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:34px"><span class="sr-only">선택</span></th>
            ${_leadSort === 'reco' ? '<th style="width:52px" title="발송 우선순위 — 마우스를 올리면 근거가 보입니다">순위</th>' : ''}
            <th>회사</th>
            <th style="width:110px">국가</th>
            <th style="width:230px">이메일</th>
            <th style="width:260px">웹사이트</th>
            <th style="width:120px">전화</th>
            <th style="width:170px;white-space:nowrap" title="이 회사는 아니다 싶으면 다른 단계로 옮깁니다. 지워지지 않아 언제든 되돌릴 수 있습니다">이동</th>
          </tr>
        </thead>
        <tbody>
          ${leads.map((l, i) => rowHtml(l, _leadSort === 'reco' ? (pageData.page - 1) * 50 + i + 1 : null)).join('')}
        </tbody>
      </table>
    </div>
    ${renderPaginationBar(pageData.page, pageData.totalPages, pageData.total)}
  `;

  els.content.querySelector('#leadSortSelect')?.addEventListener('change', (e) => {
    _leadSort = e.target.value;
    state.pagination.currentPage = 1;
    invalidateServerPage();
    render();
  });
  els.content.querySelector('[data-select-visible]')?.addEventListener('click', () => {
    if (allVisibleSelected) visibleIds.forEach(id => state.selectedLeadIds.delete(id));
    else visibleIds.forEach(id => state.selectedLeadIds.add(id));
    render();
  });
  els.content.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.page, 10);
      if (isNaN(target) || target === pageData.page) return;
      state.pagination.currentPage = Math.min(Math.max(1, target), pageData.totalPages);
      render();
      els.content?.scrollTo?.({ top: 0, behavior: 'smooth' });
    });
  });
  els.content.querySelector('#pageJumpInput')?.addEventListener('change', (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 1 && v <= pageData.totalPages) {
      state.pagination.currentPage = v;
      render();
    }
  });
}

// ── 일괄 승인/취소 (현재 필터에 보이는 리드 대상) ──────────────
async function bulkApproveVisible(approve) {
  // 현재 렌더된 verified 리드들 (state.verifiedSubFilter 반영)
  const isKor = (c) => /korea|한국|대한민국/i.test(c || '') && !/north/i.test(c || '');
  const hasRealEmail = (l) => l.Email && String(l.Email).trim() && !/^Not found/i.test(l.Email);
  let candidates = baseLeads.filter(l =>
    (l.stage || 'imported') === 'verified' && !isKor(l.Country || '')
  );
  // 승인은 이메일 있는 것만
  if (approve) candidates = candidates.filter(hasRealEmail);
  // sub-filter 반영
  const sub = state.verifiedSubFilter || 'all';
  if (sub === 'approved' && approve) {
    alert('이미 승인된 리드만 표시 중입니다. 승인 대상 없음.');
    return;
  }
  if (sub === 'approved') candidates = candidates.filter(l => l.readyForOutreach === true);
  if (sub === 'pending') candidates = candidates.filter(l => l.readyForOutreach !== true);
  if (sub === 'no-email') {
    alert('이메일 없는 리드는 승인할 수 없습니다. 먼저 크롤링을 실행하세요.');
    return;
  }
  if (!candidates.length) {
    alert('처리 대상 리드가 없습니다.');
    return;
  }

  const label = approve ? '승인' : '승인 취소';
  const ok = confirm(
    `📤 ${label} 대상: ${candidates.length}건\n\n` +
    (approve ? '이 리드들에 "발송 승인" 을 부여합니다.\n실제 메일은 발송되지 않습니다 — 승인 게이트만 통과시킵니다.\n\n' : '이 리드들의 발송 승인을 취소합니다.\n\n') +
    '계속하시겠습니까?'
  );
  if (!ok) return;

  try {
    const res = await fetch('/api/leads/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'ids',
        leadIds: candidates.map(l => l.leadId),
        approve,
        excludeKorea: true,
        requireEmail: approve,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'bulk 실패');
    // 로컬 상태 동기화
    candidates.forEach(l => { l.readyForOutreach = approve; });
    alert(
      `✅ ${label} 완료\n\n` +
      `요청: ${candidates.length}건\n` +
      `실제 반영: ${data.updated}건\n` +
      (data.skipReasons ? `스킵: 이메일없음 ${data.skipReasons.noEmail}, 한국 ${data.skipReasons.korean}, stage 불일치 ${data.skipReasons.wrongStage}` : '')
    );
    invalidateServerPage();
    await loadLeads({ force: true });
    render();
  } catch (e) {
    alert(`${label} 실패: ${e.message || 'unknown'}`);
  }
}

// ── dry-run 발송 시뮬레이션 (실제 SMTP 호출 없음) ──────────────
async function runDryRunSimulation() {
  const isKor = (c) => /korea|한국|대한민국/i.test(c || '') && !/north/i.test(c || '');
  const hasRealEmail = (l) => l.Email && String(l.Email).trim() && !/^Not found/i.test(l.Email);
  const approved = baseLeads.filter(l =>
    (l.stage || 'imported') === 'verified' &&
    l.readyForOutreach === true &&
    !isKor(l.Country || '') &&
    hasRealEmail(l)
  );

  if (!approved.length) {
    alert('검증 완료 목록이 비어있습니다. 먼저 리드를 "✅ 승인" 처리하세요.');
    return;
  }

  // 국가별/도메인별 분포 요약
  const byCountry = {};
  const domainCounts = {};
  for (const l of approved) {
    byCountry[l.Country || '(미상)'] = (byCountry[l.Country || '(미상)'] || 0) + 1;
    const dom = (l.Email || '').split('@')[1]?.toLowerCase() || '';
    if (dom) domainCounts[dom] = (domainCounts[dom] || 0) + 1;
  }
  const topCountries = Object.entries(byCountry).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const topDomains = Object.entries(domainCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const sample = approved.slice(0, 5).map(l =>
    `  · ${l.Company} (${l.Country}) → ${l.Email}`
  ).join('\n');

  const msg =
    `🧪 dry-run 발송 시뮬레이션 (실제 발송 없음)\n\n` +
    `총 대기열: ${approved.length}건\n\n` +
    `📍 국가 top 8:\n${topCountries.map(([k,v])=>`  · ${k}: ${v}건`).join('\n')}\n\n` +
    `📮 도메인 top 8:\n${topDomains.map(([k,v])=>`  · ${k}: ${v}건`).join('\n')}\n\n` +
    `첫 5건 미리보기:\n${sample}\n\n` +
    `※ 실제 발송하려면 다음 세션에서 B(실제 SMTP 발송) 구현 필요.\n` +
    `※ .env.local 에 SMTP_USER / SMTP_PASS 설정 필요.`;
  alert(msg);
}

// ── 파이프라인 자동 리로드 (verifying/verified 탭에서 배치 진행 실시간 반영) ─
// var 로 선언 (function-scope 호이스팅) — render() 가 managePipelineAutoRefresh 를
// 호출할 때 (line ~1171) 이 선언 (line ~2127) 보다 먼저 접근되어 TDZ 오류 발생 방지.
var _pipelineAutoRefreshTimer = null;
var _pipelineAutoRefreshView = null;
function managePipelineAutoRefresh(currentView) {
  const wantAutoRefresh = currentView === 'pipeline-verifying' || currentView === 'pipeline-verified';
  // 다른 뷰로 이동하거나 auto-refresh 필요 없음 → 타이머 정리
  if (!wantAutoRefresh) {
    if (_pipelineAutoRefreshTimer) {
      clearInterval(_pipelineAutoRefreshTimer);
      _pipelineAutoRefreshTimer = null;
      _pipelineAutoRefreshView = null;
    }
    return;
  }
  // 같은 view 에서 이미 타이머 돌고 있으면 그대로 유지
  if (_pipelineAutoRefreshTimer && _pipelineAutoRefreshView === currentView) return;
  // 다른 pipeline view 로 전환됐으면 기존 타이머 갈아치우기
  if (_pipelineAutoRefreshTimer) clearInterval(_pipelineAutoRefreshTimer);
  _pipelineAutoRefreshView = currentView;
  _pipelineAutoRefreshTimer = setInterval(async () => {
    if (state.view !== currentView) return;  // 사용자가 이미 다른 곳으로 이동
    try {
      // 캐시 무시하고 강제 재로드 (배치 진행 반영 목적)
      invalidateServerPage();
    await loadLeads({ force: true });
      render();
    } catch (e) { /* silent */ }
  }, 5 * 60 * 1000);  // 5분마다 (기존 30초는 너무 잦음 → 매번 5MB fetch)
}

// ══════════════════════════════════════════════════════════════
// 📧 B2B 메일 컴포즈 모달 (Gmail 스타일 좌: 편집 · 우: 미리보기)
// ══════════════════════════════════════════════════════════════
var _mailerEnvCache = null;   // { dryRun: boolean, from: string } · var for hoisting
var _composeState = {
  isOpen: false,
  recipientIds: [],
  templateId: null,
  mailAccountId: null,
  subject: '',
  body: '',
  fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: 15,
  previewLeadId: null,
  sending: false,
  resultSummary: null,
  forceDryRun: false,
  useSchedule: false,   // 📅 예약 발송
  scheduleAt: '',       // datetime-local 값
  touched: false,       // 사용자가 뭔가 입력했나 (다시 그려도 유지)
};

// 예약 datetime 헬퍼
function nowLocalDatetime() {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultScheduleTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const COMPOSE_FONTS = [
  { key: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif', label: 'Pretendard (기본)' },
  { key: '"Noto Sans KR", sans-serif', label: 'Noto Sans KR' },
  { key: '"Malgun Gothic", sans-serif', label: '맑은 고딕' },
  { key: 'Arial, sans-serif', label: 'Arial' },
  { key: 'Georgia, serif', label: 'Georgia (Serif)' },
  { key: '"Times New Roman", serif', label: 'Times New Roman' },
  { key: 'Verdana, sans-serif', label: 'Verdana' },
];
const COMPOSE_SIZES = [12, 13, 14, 15, 16, 17, 18, 20];

async function openComposeModal(scope) {
  // 발송 대상 확정
  let recipients = [];
  const hasValidEmail = (l) => l && l.Email && !/^Not found/i.test(l.Email) && /@/.test(l.Email);
  if (scope === 'bulk-verified') {
    // 검증 완료 (verified) 승인된 리드 · 첫 발송 대상
    recipients = baseLeads.filter(l =>
      !l.deleted && (l.stage || 'imported') === 'verified' && l.readyForOutreach && hasValidEmail(l),
    );
    if (!recipients.length) {
      // 승인된 것 없으면 verified + email 있는 것 다 (사용자 판단 위임)
      recipients = baseLeads.filter(l => !l.deleted && (l.stage || 'imported') === 'verified' && hasValidEmail(l));
    }
  } else if (scope === 'tier-A' || scope === 'tier-B') {
    // 검증 완료 (verified) 안에서 특정 등급만 한 방에 · 원클릭 발송
    const wantTier = scope === 'tier-A' ? 'A' : 'B';
    recipients = baseLeads.filter(l =>
      !l.deleted && (l.stage || 'imported') === 'verified' && hasValidEmail(l) && getClientLeadTier(l) === wantTier,
    );
  } else if (scope === 'outbox-ready') {
    // 발송함 [보낼 메일] 이 보여준 그 목록 그대로.
    // 여기서 다시 필터를 짜면 화면 숫자와 모달 숫자가 어긋나고,
    // 이미 예약해 둔 곳에 또 예약이 걸린다.
    recipients = _outboxReadyIds
      .map((id) => baseLeads.find((l) => l.leadId === id))
      .filter(hasValidEmail);
  } else if (scope === 'bulk-contacted') {
    // 첫 발송 관리 (contacted) · 재발송 대상 (답장 안 온 애들 우선)
    recipients = baseLeads.filter(l => !l.deleted && (l.stage || 'imported') === 'contacted' && hasValidEmail(l));
  } else if (scope === 'bulk-resend-no-reply') {
    // 재발송 (답장 없는 리드만) - contacted stage + emailHistory 있음 + replied 로 안 넘어감
    recipients = baseLeads.filter(l => !l.deleted && (l.stage || 'imported') === 'contacted' && hasValidEmail(l));
  } else if (scope === 'selected') {
    recipients = [...state.selectedLeadIds]
      .map(id => baseLeads.find(l => l.id === id))
      .filter(hasValidEmail);
  } else if (typeof scope === 'string') {
    const l = baseLeads.find(x => x.id === scope || x.leadId === scope);
    if (l) recipients = [l];
  }
  if (!recipients.length) {
    alert('발송 대상이 없습니다 (유효한 이메일 있는 리드만 가능).');
    return;
  }

  // 템플릿 + 메일 계정 로드
  if (state.email.templates.length === 0) await loadEmailTemplates();
  await loadMailAccounts();

  _composeState.isOpen = true;
  _composeState.recipientIds = recipients.map(l => l.leadId);
  _composeState.previewLeadId = recipients[0].leadId;
  _composeState.resultSummary = null;

  // 최초 진입 시 기본 템플릿 자동 선택
  if (!_composeState.templateId && state.email.templates.length > 0) {
    const defaultTpl = state.email.templates.find(t => t.purpose === 'intro' && t.language === 'en')
                    || state.email.templates[0];
    _composeState.templateId = defaultTpl._id;
    _composeState.subject = defaultTpl.subject;
    _composeState.body = defaultTpl.body;
  }
  // 최초 진입 시 발송 계정 선택.
  //
  // 테스트 발송 계정(isTestSender)이 지정돼 있으면 그것을 먼저 잡는다.
  // 대량 발송을 대표 주소로 하면 실수 한 번에 진행 중인 거래 메일까지
  // 상대 스팸함으로 들어간다. 기본 계정(isDefault)은 수신함·답장용이다.
  if (!_composeState.mailAccountId && (_mailAccounts || []).length > 0) {
    const defAcc = _mailAccounts.find(a => a.isTestSender)
      || _mailAccounts.find(a => a.isDefault)
      || _mailAccounts[0];
    _composeState.mailAccountId = defAcc._id;
  }

  await refreshMailerEnv();
  renderComposeModal();
}

function closeComposeModal(skipRefresh) {
  if (_composeState.sending) {
    if (!confirm('발송 진행 중입니다. 정말 닫으시겠습니까? (진행 상황 유실)')) return;
  }
  const sentSomething = !!_composeState.resultSummary;
  _composeState.isOpen = false;
  _composeState.touched = false;   // 다음에 열 때 다시 묻지 않도록
  document.getElementById('composeModalRoot')?.remove();
  // 발송/예약을 하고 닫았으면 발송함이 옛 목록을 들고 있다.
  // 보낸 곳이 [보낼 메일]에 그대로 남아 있으면 또 보내게 된다.
  if (!skipRefresh && sentSomething && state.view === 'pipeline-contacted') {
    _composeState.resultSummary = null;
    renderOutboxPage();
  }
}

async function refreshMailerEnv() {
  if (_mailerEnvCache) return _mailerEnvCache;
  try {
    const r = await fetch('/api/mail/test');
    const d = await r.json();
    _mailerEnvCache = { dryRun: false, from: d.user || '' };
    // dry_run 여부는 별도 판단 필요 — 서버가 알려주지 않음. 일단 UI 에서 표시만.
  } catch {
    _mailerEnvCache = { dryRun: true, from: '' };
  }
  return _mailerEnvCache;
}

function renderComposeModal() {
  // 기존 모달 제거 후 재생성
  document.getElementById('composeModalRoot')?.remove();

  const recipients = _composeState.recipientIds.map(id =>
    baseLeads.find(l => l.leadId === id)
  ).filter(Boolean);
  const previewLead = recipients.find(l => l.leadId === _composeState.previewLeadId) || recipients[0];

  // 미리보기 렌더 (변수 치환)
  const example = {};
  for (const v of state.email.variables) example[v.key] = v.fromLead ? '' : v.example;
  const buildVars = (lead) => {
    const out = {};
    for (const v of state.email.variables) {
      // fromLead 시뮬레이션 (client-side)
      const val = lead[v.key] || '';
      out[v.key] = val || v.example;
    }
    out.SenderName = '요기보';
    out.SenderCompany = 'Yogico';
    out.SenderEmail = _mailerEnvCache?.from || 'partnerships@yogico.kr';
    return out;
  };
  const renderClient = (src, vars) => (src || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, k) => vars[k] != null ? String(vars[k]) : `{{${k}}}`);
  const previewVars = previewLead ? buildVars(previewLead) : example;
  const previewSubject = renderClient(_composeState.subject, previewVars);
  const previewBody = renderClient(_composeState.body, previewVars);
  const previewBodyHtml = previewBody.includes('<') ? previewBody : previewBody.replace(/\n/g, '<br>');

  const modalHtml = `
    <div id="composeModalRoot" style="
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;
    ">
      <div style="
        width:min(1200px, 95vw);height:min(800px, 92vh);
        background:#ffffff;color:#0f172a;border-radius:16px;
        display:flex;flex-direction:column;overflow:hidden;
        box-shadow:0 24px 64px rgba(0,0,0,0.5);
      ">
        <!-- 헤더 -->
        <div style="
          padding:16px 24px;border-bottom:1px solid var(--border);
          display:flex;justify-content:space-between;align-items:center;
        ">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:22px">📧</span>
            <div>
              <div style="font-size:15px;font-weight:700">B2B 메일 작성 & 발송</div>
              <div style="font-size:11px;color:var(--text-tertiary)">
                수신자 <b>${recipients.length}명</b>
                · From: <b>${_mailerEnvCache?.from || '(env 미설정)'}</b>
              </div>
            </div>
          </div>
          <button type="button" id="composeCloseBtn" style="
            background:transparent;border:none;font-size:22px;cursor:pointer;
            color:var(--text-tertiary);padding:4px 10px;
          ">×</button>
        </div>

        <!-- 결과 표시 (발송 후) -->
        ${_composeState.resultSummary ? `
          <div style="padding:12px 24px;background:${_composeState.resultSummary.failed > 0 ? '#fef3c7' : '#dcfce7'};border-bottom:1px solid var(--border);font-size:13px">
            ${_composeState.resultSummary.dryRun ? '🧪 <b>DRY_RUN</b>: 실제 발송 안 됨 (로그만). ' : '✅ '}
            요청 ${_composeState.resultSummary.requested}건 · 성공 <b style="color:#15803d">${_composeState.resultSummary.sent}</b> · 실패 <b style="color:#dc2626">${_composeState.resultSummary.failed}</b>
          </div>
        ` : ''}

        <!-- 본문 2열 (좌: 편집 · 우: 미리보기) -->
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;overflow:hidden">

          <!-- 좌: 편집 -->
          <div style="padding:16px 20px;overflow-y:auto;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:12px">

            <!-- 받는 사람 —— 여기가 이 화면에서 제일 중요한 정보다.
                 예전에는 12곳만 칩으로 보이고 나머지는 "+N명" 이었다. 409곳을 보낼 때
                 무엇이 나가는지 알 수 없어 사실상 눈 감고 누르는 셈이었다.
                 나라별로 몇 곳인지 먼저 보여주고, 전체 목록은 펼쳐서 확인하게 한다. -->
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <label style="font-size:11px;color:var(--text-secondary);font-weight:700">받는 사람</label>
                <span style="font-size:15px;font-weight:800;color:#1d4ed8">${recipients.length.toLocaleString()}곳</span>
                <button type="button" id="composeToggleList"
                  style="margin-left:auto;padding:3px 10px;font-size:11px;font-weight:700;
                         border:1px solid var(--border-default);border-radius:99px;
                         background:var(--bg-surface);color:var(--text-secondary);cursor:pointer">
                  전체 목록 보기
                </button>
              </div>

              <!-- 나라별 요약 — "어디로 나가는지"가 한눈에 들어온다 -->
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
                ${(() => {
                  const byCountry = {};
                  for (const l of recipients) {
                    const c = l.Country || '(국가 미상)';
                    byCountry[c] = (byCountry[c] || 0) + 1;
                  }
                  return Object.entries(byCountry).sort((a, b) => b[1] - a[1]).map(([c, n]) => `
                    <span style="padding:3px 9px;background:var(--bg-surface-alt);border-radius:99px;
                                 font-size:11px;color:var(--text-secondary)">
                      ${escapeHtml(c)} <b style="color:var(--text-primary)">${n}</b>
                    </span>`).join('');
                })()}
              </div>

              <div id="composeRecipientList" style="display:none;margin-top:6px;max-height:220px;overflow-y:auto;
                   padding:6px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2)">
                ${recipients.map((l, i) => `
                  <div style="display:flex;gap:8px;padding:3px 4px;font-size:11.5px;
                              border-bottom:1px solid var(--border-subtle)">
                    <span style="width:34px;flex:none;color:var(--text-quaternary)">${i + 1}</span>
                    <span style="flex:1;min-width:0;color:var(--text-primary);overflow:hidden;
                                 text-overflow:ellipsis;white-space:nowrap">${escapeHtml(l.Company || '?')}</span>
                    <span style="color:var(--text-tertiary)">${escapeHtml(l.Country || '')}</span>
                    <span style="width:200px;flex:none;color:var(--text-tertiary);overflow:hidden;
                                 text-overflow:ellipsis;white-space:nowrap">${escapeHtml(l.Email)}</span>
                  </div>`).join('')}
              </div>
            </div>

            <!-- 발송 계정 선택 —— 어느 주소로 나가는지가 목록만큼 중요하다.
                 대표 주소로 잘못 쏘면 진행 중인 거래 메일까지 평판이 같이 상한다. -->
            <div>
              ${(() => {
                // 어느 주소로 나가는지는 받는 사람 목록만큼 중요하다.
                // 다만 '테스트 계정' 같은 라벨은 붙이지 않는다 — 화면에 설명이 늘수록
                // 정작 봐야 할 주소가 묻힌다. 주소 자체만 크게 보여준다.
                const acc = (_mailAccounts || []).find(a => a._id === _composeState.mailAccountId);
                if (!acc) return '';
                return `<div style="padding:9px 12px;margin-bottom:6px;border-radius:8px;
                  background:var(--bg-surface-alt);border:1px solid var(--border-default)">
                  <div style="font-size:10.5px;font-weight:800;color:var(--text-tertiary);
                              text-transform:uppercase;letter-spacing:.4px">보내는 주소</div>
                  <div style="font-size:14px;font-weight:800;color:var(--text-primary);margin-top:2px">
                    ${escapeHtml(acc.fromAddress || acc.smtpUser)}
                  </div>
                </div>`;
              })()}
              <label style="font-size:11px;color:var(--text-secondary);font-weight:700">📮 발송 계정</label>
              <select id="composeAccountSel" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
                ${(_mailAccounts || []).length === 0 ? `
                  <option value="">— 등록된 계정 없음 (env 기본 사용) —</option>
                ` : (_mailAccounts || []).map(a => `
                  <option value="${escapeAttr(a._id)}" ${a._id === _composeState.mailAccountId ? 'selected' : ''}>
                    ${escapeHtml(a.accountName)} · ${escapeHtml(a.smtpUser)}${a.isDefault ? ' (기본)' : ''}
                  </option>
                `).join('')}
              </select>
              ${(_mailAccounts || []).length === 0 ? `
                <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">
                  💡 <b>📬 메일 계정</b> 페이지에서 계정을 등록하면 여기서 선택 가능
                </div>
              ` : ''}
            </div>

            <!-- 템플릿 선택 -->
            <div>
              <label style="font-size:11px;color:var(--text-secondary);font-weight:700">템플릿</label>
              <select id="composeTemplateSel" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
                <option value="">— 커스텀 (템플릿 없이) —</option>
                ${state.email.templates.map(t => `
                  <option value="${escapeAttr(t._id)}" ${t._id === _composeState.templateId ? 'selected' : ''}>
                    ${escapeHtml(t.name)} (${t.language === 'ko' ? '🇰🇷' : '🇺🇸'} ${t.purpose})
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- 폰트 -->
            <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">
              <div>
                <label style="font-size:11px;color:var(--text-secondary);font-weight:700">폰트</label>
                <select id="composeFontSel" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
                  ${COMPOSE_FONTS.map(f => `<option value="${escapeAttr(f.key)}" ${f.key === _composeState.fontFamily ? 'selected' : ''}>${f.label}</option>`).join('')}
                </select>
              </div>
              <div>
                <label style="font-size:11px;color:var(--text-secondary);font-weight:700">크기</label>
                <select id="composeSizeSel" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
                  ${COMPOSE_SIZES.map(s => `<option value="${s}" ${s === _composeState.fontSize ? 'selected' : ''}>${s}px</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- 제목 -->
            <div>
              <label style="font-size:11px;color:var(--text-secondary);font-weight:700">제목</label>
              <input id="composeSubjectInput" type="text" value="${escapeAttr(_composeState.subject)}"
                style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;margin-top:2px;background:#ffffff;color:#0f172a"
                placeholder="예: Partnership inquiry — {{Company}}">
            </div>

            <!-- 본문 -->
            <div style="display:flex;flex-direction:column;flex:1;min-height:200px">
              <label style="font-size:11px;color:var(--text-secondary);font-weight:700">본문 (템플릿 편집에서 저장한 변수 자동 치환됨)</label>
              <textarea id="composeBodyInput"
                style="width:100%;flex:1;padding:12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:${_composeState.fontFamily};margin-top:2px;resize:vertical;min-height:250px;line-height:1.6;background:#ffffff;color:#0f172a"
              >${escapeHtml(_composeState.body)}</textarea>
            </div>
          </div>

          <!-- 우: 미리보기 (Gmail 스타일) -->
          <div style="padding:16px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;background:var(--surface-1)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <label style="font-size:11px;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">👁 실시간 미리보기</label>
              <select id="composePreviewSel" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:11px">
                ${recipients.map(l => `
                  <option value="${escapeAttr(l.leadId)}" ${l.leadId === _composeState.previewLeadId ? 'selected' : ''}>
                    ${escapeHtml((l.Company || '?').slice(0, 30))}
                  </option>
                `).join('')}
              </select>
            </div>

            <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;flex:1;display:flex;flex-direction:column">
              <!-- 헤더 (Gmail 느낌) -->
              <div style="padding:14px 20px;border-bottom:1px solid #e5e7eb;background:#f9fafb">
                <div style="font-size:16px;font-weight:700;color:#111827;line-height:1.3">${escapeHtml(previewSubject) || '<span style="color:#9ca3af">(제목 없음)</span>'}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:6px">
                  <b>From:</b> ${escapeHtml(_mailerEnvCache?.from || '(env)')}
                  · <b>To:</b> ${previewLead ? escapeHtml(previewLead.Email) : '?'}
                </div>
              </div>
              <!-- 본문 (실제 발송되는 스타일 그대로) -->
              <div style="padding:20px;overflow-y:auto;flex:1;background:white;font-family:${_composeState.fontFamily};font-size:${_composeState.fontSize}px;line-height:1.65;color:#111827">
                ${previewBodyHtml || '<span style="color:#9ca3af">(본문 없음)</span>'}
              </div>
            </div>
            <div style="font-size:10px;color:var(--text-tertiary);text-align:center">
              📌 미리보기는 선택한 리드 (${previewLead ? escapeHtml(previewLead.Company || '?') : '?'})의 값으로 변수 치환
            </div>
          </div>
        </div>

        <!-- 하단 액션 바 -->
        <div style="
          padding:14px 24px;border-top:1px solid var(--border);
          display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
        ">
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);cursor:pointer">
              <input type="checkbox" id="composeForceDryRunChk" ${_composeState.forceDryRun ? 'checked' : ''}>
              🧪 DRY_RUN
            </label>
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);cursor:pointer">
              <input type="checkbox" id="composeUseScheduleChk" ${_composeState.useSchedule ? 'checked' : ''}>
              📅 예약 발송
            </label>
            ${_composeState.useSchedule ? `
              <input type="datetime-local" id="composeScheduleAt" value="${escapeAttr(_composeState.scheduleAt || defaultScheduleTime())}"
                min="${escapeAttr(nowLocalDatetime())}"
                style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;background:#ffffff;color:#0f172a">
            ` : ''}
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" id="composeCancelBtn" class="button ghost" style="font-size:13px;padding:9px 16px">닫기</button>
            <button type="button" id="composeSendBtn" ${_composeState.sending ? 'disabled' : ''} style="
              font-size:14px;font-weight:700;padding:9px 22px;
              background:${_composeState.useSchedule ? '#d97706' : '#2563eb'};color:white;border:none;border-radius:8px;cursor:pointer;
              box-shadow:0 2px 6px ${_composeState.useSchedule ? 'rgba(217,119,6,0.3)' : 'rgba(37,99,235,0.3)'};
              ${_composeState.sending ? 'opacity:0.5;cursor:wait' : ''}
            ">
              ${_composeState.sending
                ? '⏳ 처리 중...'
                : (_composeState.useSchedule
                    ? `📅 ${recipients.length}명 예약 발송`
                    : `✉ ${recipients.length}명 지금 발송`)}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // 이벤트 바인딩
  document.getElementById('composeCloseBtn')?.addEventListener('click', closeComposeModal);
  document.getElementById('composeCancelBtn')?.addEventListener('click', closeComposeModal);
  // 배경 클릭 → 닫기. 제목·본문을 쓰다 배경을 스쳐 날리는 일이 많던 곳이라
  // 한 글자라도 썼으면 물어보고 닫는다.
  const root = document.getElementById('composeModalRoot');
  bindBackdropDismiss(root, closeComposeModal);
  // 이 팝업은 양식을 바꿀 때마다 통째로 다시 그려진다.
  // 그때 "쓰던 내용" 표시도 같이 지워지므로 상태에서 되살린다.
  if (root && _composeState.touched) root.dataset.userTyped = '1';
  root?.addEventListener('input', () => { _composeState.touched = true; }, true);

  // Esc 키 → 닫기 (한 번만 바인딩)
  const escHandler = (e) => {
    if (e.key === 'Escape' && _composeState.isOpen) {
      if (!confirmDiscardTyped(document.getElementById('composeModalRoot'))) return;
      closeComposeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.getElementById('composeTemplateSel')?.addEventListener('change', (e) => {
    const tid = e.target.value;
    _composeState.templateId = tid || null;
    if (tid) {
      const t = state.email.templates.find(x => x._id === tid);
      if (t) {
        _composeState.subject = t.subject;
        _composeState.body = t.body;
      }
    }
    renderComposeModal();
  });
  // 받는 사람 전체 목록 펼치기/접기
  document.getElementById('composeToggleList')?.addEventListener('click', (e) => {
    const list = document.getElementById('composeRecipientList');
    if (!list) return;
    const open = list.style.display !== 'none';
    list.style.display = open ? 'none' : '';
    e.currentTarget.textContent = open ? '전체 목록 보기' : '목록 접기';
  });

  document.getElementById('composeAccountSel')?.addEventListener('change', (e) => {
    _composeState.mailAccountId = e.target.value || null;
    renderComposeModal();
  });
  document.getElementById('composeFontSel')?.addEventListener('change', (e) => {
    _composeState.fontFamily = e.target.value;
    renderComposeModal();
  });
  document.getElementById('composeSizeSel')?.addEventListener('change', (e) => {
    _composeState.fontSize = parseInt(e.target.value, 10);
    renderComposeModal();
  });
  document.getElementById('composePreviewSel')?.addEventListener('change', (e) => {
    _composeState.previewLeadId = e.target.value;
    renderComposeModal();
  });
  // 실시간 미리보기 위해 input 이벤트 hook — 하지만 매타이핑 재렌더 하면 포커스 잃음
  // → 타이핑 시엔 미리보기 우측만 부분 업데이트, 재렌더 스킵
  document.getElementById('composeSubjectInput')?.addEventListener('input', (e) => {
    _composeState.subject = e.target.value;
    // 우측 subject 만 갱신 (포커스 유지)
    const previewLead = baseLeads.find(l => l.leadId === _composeState.previewLeadId);
    const vars = {};
    for (const v of state.email.variables) vars[v.key] = (previewLead?.[v.key] || v.example || '');
    vars.SenderName = '요기보'; vars.SenderCompany = 'Yogico'; vars.SenderEmail = _mailerEnvCache?.from || '';
    const s = e.target.value.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, k) => vars[k] != null ? String(vars[k]) : `{{${k}}}`);
    const titleEl = document.querySelector('#composeModalRoot .verify-hero-card') || document.querySelector('#composeModalRoot [data-preview-subject]');
    // 간단 fallback: 재렌더
    // 성능 이슈 없으면 매번 재렌더 OK
    renderComposeModal();
    // 포커스 복구
    setTimeout(() => {
      const el = document.getElementById('composeSubjectInput');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 0);
  });
  document.getElementById('composeBodyInput')?.addEventListener('input', (e) => {
    _composeState.body = e.target.value;
    // 재렌더 + 포커스 복구
    const cursorPos = e.target.selectionStart;
    renderComposeModal();
    setTimeout(() => {
      const el = document.getElementById('composeBodyInput');
      if (el) { el.focus(); el.setSelectionRange(cursorPos, cursorPos); }
    }, 0);
  });
  document.getElementById('composeForceDryRunChk')?.addEventListener('change', (e) => {
    _composeState.forceDryRun = e.target.checked;
  });
  document.getElementById('composeUseScheduleChk')?.addEventListener('change', (e) => {
    _composeState.useSchedule = e.target.checked;
    if (e.target.checked && !_composeState.scheduleAt) {
      _composeState.scheduleAt = defaultScheduleTime();
    }
    renderComposeModal();
  });
  document.getElementById('composeScheduleAt')?.addEventListener('change', (e) => {
    _composeState.scheduleAt = e.target.value;
  });
  document.getElementById('composeSendBtn')?.addEventListener('click', () => handleComposeSend());
}

async function handleComposeSend() {
  const recipients = _composeState.recipientIds;
  if (!recipients.length) return;

  // 예약 발송 분기
  if (_composeState.useSchedule) {
    if (!_composeState.templateId) {
      alert('예약 발송은 저장된 메일 양식이 필요합니다.\n메일 양식 페이지에서 먼저 저장해주세요.');
      return;
    }
    if (!_composeState.scheduleAt) {
      alert('예약 시각을 선택해주세요.');
      return;
    }
    const scheduledFor = new Date(_composeState.scheduleAt);
    if (isNaN(scheduledFor.getTime())) { alert('예약 시각 형식이 올바르지 않습니다.'); return; }
    if (scheduledFor.getTime() < Date.now()) { alert('과거 시각으로 예약할 수 없습니다.'); return; }
    const ok = confirm(
      `📅 ${recipients.length}명 예약 발송\n\n` +
      `예약 시각: ${scheduledFor.toLocaleString('ko-KR')}\n` +
      `제목: ${_composeState.subject.slice(0, 60)}\n\n등록하시겠습니까? (Vercel Cron 이 5분마다 실행)`
    );
    if (!ok) return;
    _composeState.sending = true;
    let movedToSchedule = false;
    renderComposeModal();
    try {
      const res = await fetch('/api/mail/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: recipients,
          templateId: _composeState.templateId,
          scheduledFor: scheduledFor.toISOString(),
          mailAccountId: _composeState.mailAccountId || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '예약 실패');
      alert(
        `✅ ${data.scheduled}건 예약 완료\n\n` +
        `예약 시각: ${new Date(data.scheduledFor).toLocaleString('ko-KR')}\n\n` +
        `[발송 관리 → 📅 예약 발송] 에서 확인·취소할 수 있습니다.`,
      );
      _composeState.resultSummary = { requested: recipients.length, sent: 0, failed: 0, scheduled: data.scheduled };
      // 예약한 곳은 [보낼 메일]에서 빠지고 [예약 발송]으로 내려가야 한다.
      // finally 가 모달을 다시 그리므로 여기서 바로 닫지 않고 표시만 해 둔다.
      if (state.view === 'pipeline-contacted') movedToSchedule = true;
    } catch (e) {
      alert(`예약 실패: ${e.message || 'unknown'}`);
    } finally {
      _composeState.sending = false;
      if (movedToSchedule) {
        _outboxTab = 'scheduled';
        closeComposeModal(true);   // 아래에서 직접 그린다
        renderOutboxPage();
      } else {
        renderComposeModal();
      }
    }
    return;
  }

  const ok = confirm(
    `📧 ${recipients.length}명에게 발송\n\n` +
    (_composeState.forceDryRun ? '🧪 DRY_RUN 모드 (실제 발송 X)\n' : '') +
    `제목: ${_composeState.subject.slice(0, 60)}\n\n계속하시겠습니까?`
  );
  if (!ok) return;

  _composeState.sending = true;
  renderComposeModal();

  try {
    const res = await fetch('/api/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadIds: recipients,
        templateId: _composeState.templateId || undefined,
        subject: _composeState.subject,
        body: _composeState.body,
        bodyIsHtml: true,
        fontFamily: _composeState.fontFamily,
        fontSize: _composeState.fontSize,
        mailAccountId: _composeState.mailAccountId || undefined,
        dryRun: !!_composeState.forceDryRun,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '발송 실패');
    _composeState.resultSummary = {
      requested: data.requested,
      sent: data.sent,
      failed: data.failed,
      dryRun: data.dryRun,
    };
    // 로컬 lead emailHistory 갱신 위해 재로드
    invalidateServerPage();
    await loadLeads({ force: true });
  } catch (e) {
    alert(`발송 실패: ${e.message || 'unknown'}`);
  } finally {
    _composeState.sending = false;
    renderComposeModal();
  }
}

// ══════════════════════════════════════════════════════════════
// Import 배치별 폴더 UI (검증대기/완료/실패 페이지 공용)
// ══════════════════════════════════════════════════════════════

// stageMatch 함수 받아서 해당 stage 리드를 batch 별로 그룹핑
function groupLeadsByBatch(stageMatch) {
  const groups = new Map();  // batchId -> { batchId, dateLabel, leads: [] }
  for (const lead of getLeads()) {
    if (!stageMatch(lead)) continue;
    const b = lead.importBatch || '(수동/미배치)';
    if (!groups.has(b)) {
      // batchId 예: "import-20260813-153021" → date label 추출
      const m = String(b).match(/(\d{4})(\d{2})(\d{2})/);
      const dateLabel = m ? `${m[1]}-${m[2]}-${m[3]}` : (b === '(수동/미배치)' ? '수동 추가' : '미상');
      groups.set(b, { batchId: b, dateLabel, leads: [] });
    }
    groups.get(b).leads.push(lead);
  }
  // 최신 배치 (batchId 문자열 역순) 먼저
  return Array.from(groups.values()).sort((a, b) => b.batchId.localeCompare(a.batchId));
}

// 배치 전체 (모든 stage 포함) breakdown — 검증대기/완료/실패 카드 공용
// 한 배치의 리드가 각 stage 로 얼마나 이동했는지 카운트
function getBatchStageBreakdown(batchId) {
  const inBatch = baseLeads.filter(l =>
    !l.deleted && (l.importBatch || '(수동/미배치)') === batchId
  );
  const bd = {
    total: inBatch.length,
    verifying: 0,
    verified: 0,
    failed: 0,          // archived + not-buyer
    archivedOther: 0,   // archived + 그 외 (수동 폐기)
    contacted: 0,
    replied: 0,
    negotiating: 0,
    partner: 0,
    imported: 0,
  };
  for (const l of inBatch) {
    const s = l.stage || 'imported';
    if (s === 'archived') {
      if (l?.verification?.aiVerdict === 'not-buyer') bd.failed++;
      else bd.archivedOther++;
    } else if (bd[s] !== undefined) {
      bd[s]++;
    }
  }
  return bd;
}

// 검증대기 폴더 카드 (AI 진행 상태 + 이 배치가 어디로 얼마나 이동했는지)
function batchCardVerifying(g) {
  const bd = getBatchStageBreakdown(g.batchId);
  const total = g.leads.length;   // 검증대기 stage 잔여
  const aiChecked = g.leads.filter(l => l?.verification?.aiVerifiedAt).length;
  const pctChecked = total > 0 ? Math.round(aiChecked / total * 100) : 100;
  const allProcessed = bd.total > 0 && bd.verifying === 0;

  const statusBadge = allProcessed
    ? `<span style="padding:2px 8px;background:#dcfce7;color:#166534;border-radius:99px;font-size:11px;font-weight:700">✅ 검증 완료 (전량 이동)</span>`
    : aiChecked > 0 || (bd.verified + bd.failed) > 0
      ? `<span style="padding:2px 8px;background:#fef3c7;color:#92400e;border-radius:99px;font-size:11px;font-weight:700">🔄 검증 진행 중</span>`
      : `<span style="padding:2px 8px;background:#f1f5f9;color:#475569;border-radius:99px;font-size:11px;font-weight:700">⏳ 진행 전</span>`;

  return `
    <div class="batch-folder-card" data-batch="${escapeAttr(g.batchId)}" style="
      background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:16px 18px;
      cursor:pointer;transition:all 0.15s;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span style="font-size:22px">📁</span>
          <div style="min-width:0">
            <div style="font-weight:700;font-size:14px;color:var(--text-primary)">${g.dateLabel}</div>
            <div style="font-size:11px;color:var(--text-tertiary);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(g.batchId)}</div>
          </div>
        </div>
        ${statusBadge}
      </div>

      <!-- 이 배치 전체 흐름 요약 -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;margin-bottom:8px">
        <span style="padding:3px 8px;background:var(--surface-2);color:var(--text-secondary);border-radius:6px">
          📊 배치 총 <b style="color:var(--text-primary)">${bd.total.toLocaleString()}</b>건
        </span>
        <span style="padding:3px 8px;background:#fef3c7;color:#92400e;border-radius:6px">
          ⏳ 검증대기 <b>${bd.verifying}</b>
        </span>
        ${bd.verified > 0 ? `<span style="padding:3px 8px;background:#dcfce7;color:#166534;border-radius:6px">✅ 검증완료 <b>${bd.verified}</b></span>` : ''}
        ${bd.failed > 0 ? `<span style="padding:3px 8px;background:#fef2f2;color:#991b1b;border-radius:6px">🚫 검증실패 <b>${bd.failed}</b></span>` : ''}
        ${(bd.contacted + bd.replied + bd.negotiating) > 0 ? `<span style="padding:3px 8px;background:#dbeafe;color:#1e40af;border-radius:6px">📨 컨택+ <b>${bd.contacted + bd.replied + bd.negotiating}</b></span>` : ''}
        ${bd.partner > 0 ? `<span style="padding:3px 8px;background:#f3e8ff;color:#6b21a8;border-radius:6px">⭐ 파트너 <b>${bd.partner}</b></span>` : ''}
      </div>
      <div style="display:flex;justify-content:flex-end;font-size:12px;color:var(--brand-primary,#4338ca);font-weight:600">
        폴더 열기 (검증대기 ${total}건) →
      </div>
    </div>
  `;
}

// 검증완료 폴더 카드 (컨택 이동 준비 상태 + 배치 breakdown)
function batchCardVerified(g) {
  const bd = getBatchStageBreakdown(g.batchId);
  const total = g.leads.length;
  const hasRealEmail = (l) => l.Email && String(l.Email).trim() && !/^Not found/i.test(l.Email);
  const withEmail = g.leads.filter(hasRealEmail).length;
  const approved = g.leads.filter(l => l.readyForOutreach === true).length;
  const noEmailWithSite = g.leads.filter(l => !hasRealEmail(l) && l.WebsiteContact && String(l.WebsiteContact).trim()).length;

  return `
    <div class="batch-folder-card" data-batch="${escapeAttr(g.batchId)}" style="
      background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:16px 18px;
      cursor:pointer;transition:all 0.15s;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span style="font-size:22px">📁</span>
          <div style="min-width:0">
            <div style="font-weight:700;font-size:14px;color:var(--text-primary)">${g.dateLabel}</div>
            <div style="font-size:11px;color:var(--text-tertiary);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(g.batchId)}</div>
          </div>
        </div>
        <span style="padding:2px 8px;background:#dcfce7;color:#166534;border-radius:99px;font-size:11px;font-weight:700">✅ 검증 통과 ${total}</span>
      </div>
      <!-- 배치 전체 흐름 -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;margin-bottom:8px">
        <span style="padding:3px 8px;background:var(--surface-2);color:var(--text-secondary);border-radius:6px">
          📊 배치 총 <b style="color:var(--text-primary)">${bd.total.toLocaleString()}</b>건
        </span>
        ${bd.verifying > 0 ? `<span style="padding:3px 8px;background:#fef3c7;color:#92400e;border-radius:6px">⏳ 검증대기 <b>${bd.verifying}</b></span>` : ''}
        ${bd.failed > 0 ? `<span style="padding:3px 8px;background:#fef2f2;color:#991b1b;border-radius:6px">🚫 실패 <b>${bd.failed}</b></span>` : ''}
        <span style="padding:3px 8px;background:#dcfce7;color:#166534;border-radius:6px">✅ 통과 <b>${bd.verified}</b></span>
        ${(bd.contacted + bd.replied + bd.negotiating) > 0 ? `<span style="padding:3px 8px;background:#dbeafe;color:#1e40af;border-radius:6px">📨 컨택+ <b>${bd.contacted + bd.replied + bd.negotiating}</b></span>` : ''}
      </div>
      <!-- 검증완료 특화 지표 -->
      <div style="display:flex;gap:12px;font-size:12px;color:var(--text-secondary);flex-wrap:wrap">
        <span>📧 메일 있음 <b style="color:#15803d">${withEmail}/${total}</b></span>
        ${noEmailWithSite > 0 ? `<span>🔍 크롤 대상 <b style="color:#d97706">${noEmailWithSite}</b></span>` : ''}
        ${approved > 0 ? `<span>✔ 승인 <b style="color:#15803d">${approved}</b></span>` : ''}
        <span style="margin-left:auto;color:var(--brand-primary,#4338ca);font-weight:600">폴더 열기 →</span>
      </div>
    </div>
  `;
}

// 검증실패 폴더 카드 (배치 breakdown 포함)
function batchCardFailed(g) {
  const bd = getBatchStageBreakdown(g.batchId);
  const total = g.leads.length;
  return `
    <div class="batch-folder-card" data-batch="${escapeAttr(g.batchId)}" style="
      background:var(--surface-1);border:1px solid #fca5a540;border-radius:12px;padding:16px 18px;
      cursor:pointer;transition:all 0.15s;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span style="font-size:22px">📁</span>
          <div style="min-width:0">
            <div style="font-weight:700;font-size:14px;color:var(--text-primary)">${g.dateLabel}</div>
            <div style="font-size:11px;color:var(--text-tertiary);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(g.batchId)}</div>
          </div>
        </div>
        <span style="padding:2px 8px;background:#fef2f2;color:#991b1b;border-radius:99px;font-size:11px;font-weight:700">🚫 실패 ${total}</span>
      </div>
      <!-- 배치 전체 흐름 -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;margin-bottom:8px">
        <span style="padding:3px 8px;background:var(--surface-2);color:var(--text-secondary);border-radius:6px">
          📊 배치 총 <b style="color:var(--text-primary)">${bd.total.toLocaleString()}</b>건
        </span>
        <span style="padding:3px 8px;background:#fef2f2;color:#991b1b;border-radius:6px">🚫 실패 <b>${bd.failed}</b></span>
        ${bd.verified > 0 ? `<span style="padding:3px 8px;background:#dcfce7;color:#166534;border-radius:6px">✅ 통과 <b>${bd.verified}</b></span>` : ''}
        ${bd.verifying > 0 ? `<span style="padding:3px 8px;background:#fef3c7;color:#92400e;border-radius:6px">⏳ 대기 <b>${bd.verifying}</b></span>` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary)">
        <span style="font-size:11px;color:var(--text-tertiary)">💡 실패는 수동으로 검증완료로 되돌리기 가능</span>
        <span style="color:var(--brand-primary,#4338ca);font-weight:600">폴더 열기 →</span>
      </div>
    </div>
  `;
}

// 배치 폴더 목록 뷰 (열린 배치가 없을 때)
function renderBatchFolders(stageMatch, cardRenderer, emptyText) {
  const groups = groupLeadsByBatch(stageMatch);
  if (groups.length === 0) {
    els.content.innerHTML = emptyState(emptyText);
    return;
  }
  els.content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${groups.map(cardRenderer).join('')}
    </div>
  `;
  // 카드 클릭 → 폴더 열기
  els.content.querySelectorAll('.batch-folder-card').forEach(el => {
    el.addEventListener('click', () => {
      state.folderView.openBatch = el.dataset.batch;
      resetPagination();
      render();
    });
    el.addEventListener('mouseenter', () => {
      el.style.borderColor = 'var(--brand-primary, #4338ca)';
      el.style.transform = 'translateY(-1px)';
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
    });
    el.addEventListener('mouseleave', () => {
      el.style.borderColor = 'var(--border)';
      el.style.transform = '';
      el.style.boxShadow = '';
    });
  });
}

// 폴더 안에서 표시할 상단 breadcrumb (뒤로 가기 링크)
function renderFolderBreadcrumb(batchId, count) {
  const m = String(batchId).match(/(\d{4})(\d{2})(\d{2})/);
  const dateLabel = m ? `${m[1]}-${m[2]}-${m[3]}` : '수동';
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 14px;background:var(--surface-2);border-radius:8px;font-size:13px">
      <button id="folderBackBtn" type="button" style="background:transparent;border:none;color:var(--brand-primary,#4338ca);cursor:pointer;font-weight:600;font-size:13px;padding:0">
        ← 폴더 목록으로
      </button>
      <span style="color:var(--text-tertiary)">/</span>
      <span style="font-weight:600">📁 ${dateLabel}</span>
      <span style="color:var(--text-tertiary);font-family:monospace;font-size:11px">${escapeHtml(batchId)}</span>
      <span style="margin-left:auto;color:var(--text-tertiary)">${count.toLocaleString()}건</span>
    </div>
  `;
}

// ── 페이지네이션 바 (게시판 스타일 1 · 2 · 3 · ... · N) ────────
/**
 * 페이지 이동 바.
 *
 * 표 아래에만 두면 50줄을 스크롤해야 나와서 "다음 장으로 가는 버튼이 없다" 고 느낀다.
 * 그래서 표 위에도 같은 바를 둔다(compact: 페이지 입력칸 없이 화살표만 — id 중복 방지).
 */
function renderPaginationBar(current, totalPages, totalItems, opts) {
  if (totalPages <= 1) return '';
  const compact = opts && opts.compact === true;

  // 페이지 번호 리스트 계산 — 현재 페이지 주변 + 처음/끝 + 생략(...)
  //  예: [1, ..., 4, 5, 6, ..., 45]
  const pages = new Set([1, totalPages, current, current - 1, current + 1, current - 2, current + 2]);
  const visible = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const pageBtn = (p, label = String(p), active = false, disabled = false) => {
    const bg = active ? 'var(--brand-primary,#4338ca)' : 'var(--surface-1)';
    const fg = active ? 'white' : disabled ? 'var(--text-tertiary)' : 'var(--text-primary)';
    const bd = active ? 'var(--brand-primary,#4338ca)' : 'var(--border)';
    return `<button type="button" class="page-btn" data-page="${p}" ${disabled ? 'disabled' : ''}
      style="min-width:34px;height:34px;padding:0 10px;font-size:12px;font-weight:${active ? '700' : '500'};
      background:${bg};color:${fg};border:1px solid ${bd};border-radius:8px;cursor:${disabled ? 'not-allowed' : 'pointer'};
      display:inline-flex;align-items:center;justify-content:center;transition:all 0.1s;
      ${disabled ? 'opacity:0.4' : ''}">${label}</button>`;
  };

  let itemsHtml = '';
  let prev = 0;
  for (const p of visible) {
    if (p - prev > 1) {
      itemsHtml += `<span style="min-width:24px;text-align:center;color:var(--text-tertiary);font-size:12px">…</span>`;
    }
    itemsHtml += pageBtn(p, String(p), p === current);
    prev = p;
  }

  // 표 위에 붙는 바는 페이지 입력칸을 빼서 id 중복을 피한다
  const jumpHtml = compact
    ? `<span style="margin-left:10px;font-size:12px;color:var(--text-tertiary)">${current} / ${totalPages} 페이지</span>`
    : `<span style="margin-left:12px;display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-tertiary)">
         <span>페이지</span>
         <input id="pageJumpInput" type="number" min="1" max="${totalPages}" value="${current}"
           style="width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;
                  text-align:center;background:var(--surface-1);color:var(--text-primary)"
           title="페이지 번호 입력 후 Enter">
         <span>/ ${totalPages}</span>
       </span>`;

  return `
    <div style="${compact ? 'margin:0 0 10px' : 'margin-top:16px'};padding:${compact ? '8px' : '12px'};
                display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap">
      ${pageBtn(1, '⏮', false, current === 1)}
      ${pageBtn(current - 1, '◀', false, current === 1)}
      ${itemsHtml}
      ${pageBtn(current + 1, '▶', false, current === totalPages)}
      ${pageBtn(totalPages, '⏭', false, current === totalPages)}
      ${jumpHtml}
    </div>
  `;
}

// 필터/뷰가 바뀔 때 1페이지로 리셋 (호출 지점: 뷰 이동, 필터 변경, 서브필터 chip)
function resetPagination() {
  if (state.pagination) state.pagination.currentPage = 1;
}

function renderLeadTable(leads, emptyText = "No leads match the current filters.") {
  if (!leads.length) {
    els.content.innerHTML = emptyState(emptyText);
    return;
  }

  // ── 페이지네이션 ───────────────────────────────
  const pageSize = state.pagination?.pageSize || 100;
  const totalPages = Math.max(1, Math.ceil(leads.length / pageSize));
  // 리드 수가 줄어들어 현재 페이지가 범위 초과 시 자동 클램프
  if (state.pagination.currentPage > totalPages) state.pagination.currentPage = totalPages;
  if (state.pagination.currentPage < 1) state.pagination.currentPage = 1;
  const page = state.pagination.currentPage;
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, leads.length);
  const pageLeads = leads.slice(start, end);

  const visibleIds = pageLeads.map((lead) => lead.id);
  const selectedVisibleCount = visibleIds.filter((id) => state.selectedLeadIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  els.content.innerHTML = `
    <div class="bulk-actions">
      <button class="button secondary" data-select-visible type="button">${allVisibleSelected ? "이 페이지 선택 해제" : "이 페이지 전체 선택"}</button>
      ${state.view === 'pipeline-verified' ? `
        <button class="button primary" id="moveToQueueBtn" type="button" ${state.selectedLeadIds.size ? '' : 'disabled'}
          title="고른 곳을 [발송 관리 → 보낼 메일] 로 옮깁니다. 옮겨야 발송 대상이 됩니다."
          style="${state.selectedLeadIds.size ? '' : 'opacity:.45;cursor:default'}">
          📋 발송 리스트로 옮기기 (${state.selectedLeadIds.size})
        </button>
        <!-- 아닌 곳을 검증 실패로 다 뺀 뒤에는 남은 전체를 한 번에 옮기는 게 자연스럽다.
             418건을 페이지마다 체크하게 두면 9페이지를 넘겨야 한다. -->
        <button class="button" id="moveAllToQueueBtn" type="button"
          title="지금 검증 완료에 남아 있는 곳을 전부 발송 리스트로 옮깁니다 (검색·국가로 좁혀 놨으면 그 범위만)"
          style="border:1px solid #15803d;background:#f0fdf4;color:#15803d;font-weight:700">
          ⇢ 남은 전체 옮기기
        </button>` : ''}
      <button class="button ghost danger-action" data-delete-selected type="button" ${state.selectedLeadIds.size ? "" : "disabled"}>
        Delete Selected (${state.selectedLeadIds.size})
      </button>
      <span style="margin-left:auto;font-size:12px;color:var(--text-tertiary);display:inline-flex;align-items:center;gap:8px">
        <span>총 <b style="color:var(--text-primary)">${leads.length.toLocaleString()}</b>건 중 <b style="color:var(--text-primary)">${start + 1}~${end}</b>번 표시</span>
        <select id="pageSizeSel" title="한 페이지에 보여줄 리드 수"
          style="padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:11px;background:var(--surface-1);color:var(--text-primary);cursor:pointer">
          <option value="25" ${pageSize === 25 ? 'selected' : ''}>25/page</option>
          <option value="50" ${pageSize === 50 ? 'selected' : ''}>50/page</option>
          <option value="100" ${pageSize === 100 ? 'selected' : ''}>100/page</option>
        </select>
      </span>
    </div>
    ${renderPaginationBar(page, totalPages, leads.length, { compact: true })}
    <div class="table-wrap">
      <table>
        <!-- 이 헤더는 rowHtml 이 실제로 그리는 칸과 반드시 같아야 한다.
             예전에는 Stage·발송승인·Priority·검증 까지 10칸이 적혀 있었는데
             rowHtml 은 7칸만 그려서, 값이 한 칸씩 밀리고 끝의 세 칸이
             비어 보였다 (검색 결과 화면에서 그대로 드러났다). -->
        <thead>
          <tr>
            <th style="width:34px"><span class="sr-only">선택</span></th>
            <th>회사</th>
            <th class="sortable" data-sort="Country" style="width:110px;cursor:pointer;user-select:none" title="국가순 정렬">
              국가
              <span style="color:#999;font-size:0.8em;margin-left:4px">${state.sortField === 'Country' ? (state.sortOrder === 'asc' ? '▲' : '▼') : '⇕'}</span>
            </th>
            <th style="width:230px">이메일</th>
            <th style="width:260px">웹사이트</th>
            <th style="width:120px">전화</th>
            <th style="width:170px;white-space:nowrap" title="이 회사는 아니다 싶으면 다른 단계로 옮깁니다. 지워지지 않아 언제든 되돌릴 수 있습니다">이동</th>
          </tr>
        </thead>
        <tbody>
          ${pageLeads.map((lead) => rowHtml(lead)).join("")}
        </tbody>
      </table>
    </div>
    ${renderPaginationBar(page, totalPages, leads.length)}
  `;

  els.content.querySelector("[data-select-visible]")?.addEventListener("click", () => {
    if (allVisibleSelected) {
      visibleIds.forEach((id) => state.selectedLeadIds.delete(id));
    } else {
      visibleIds.forEach((id) => state.selectedLeadIds.add(id));
    }
    render();
  });

  // 페이지네이션 클릭
  els.content.querySelectorAll('.page-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.page, 10);
      if (isNaN(target) || target === state.pagination.currentPage) return;
      state.pagination.currentPage = Math.min(Math.max(1, target), totalPages);
      render();
      // 상단으로 스크롤
      els.content?.scrollTo?.({ top: 0, behavior: 'smooth' });
    });
  });
  els.content.querySelector('#pageJumpInput')?.addEventListener('change', (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 1 && v <= totalPages) {
      state.pagination.currentPage = v;
      render();
      els.content?.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
  });
  els.content.querySelector('#pageSizeSel')?.addEventListener('change', (e) => {
    const newSize = parseInt(e.target.value, 10);
    if ([25, 50, 100].includes(newSize)) {
      state.pagination.pageSize = newSize;
      state.pagination.currentPage = 1;   // 페이지 크기 변경 시 1페이지로
      try { localStorage.setItem('leads-page-size', String(newSize)); } catch {}
      render();
    }
  });

  els.content.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      if (state.sortField === field) {
        if (state.sortOrder === "asc") {
          state.sortOrder = "desc";
        } else {
          state.sortField = null;
          state.sortOrder = "asc";
        }
      } else {
        state.sortField = field;
        state.sortOrder = "asc";
      }
      render();
    });
  });

  els.content.querySelector("[data-delete-selected]")?.addEventListener("click", deleteSelectedLeads);
  els.content.querySelector('#moveToQueueBtn')?.addEventListener('click', moveSelectedToQueue);
  els.content.querySelector('#moveAllToQueueBtn')?.addEventListener('click', moveAllToQueue);

  els.content.querySelectorAll("[data-select-lead]").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selectedLeadIds.add(checkbox.dataset.selectLead);
      } else {
        state.selectedLeadIds.delete(checkbox.dataset.selectLead);
      }
      render();
    });
  });

  els.content.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(button.dataset.favorite);
    });
  });

  els.content.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => {
      openEditModal(row.dataset.id);
    });
  });
}

function renderMissingEmails(leads) {
  const missing = leads.filter((lead) => !hasEmail(lead));
  if (!missing.length) {
    els.content.innerHTML = emptyState("All visible leads already have an email.");
    return;
  }

  els.content.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Country</th>
            <th>Website</th>
            <th>Contact Clues</th>
            <th>Save Email</th>
          </tr>
        </thead>
        <tbody>
          ${missing.map((lead) => `
            <tr data-id="${escapeHtml(lead.id)}">
              <td><strong>${escapeHtml(lead.Company)}</strong><div class="meta-line">${escapeHtml(truncate(lead.Type, 70))}</div></td>
              <td>${escapeHtml(lead.Country)}</td>
              <td>${websiteLinkHtml(lead.WebsiteContact, { short: true })}</td>
              <td>${escapeHtml(truncate([lead.BuyerContact, lead.RoleMemo, lead.Phone].filter(Boolean).join(" · "), 110))}</td>
              <td>
                <div class="inline-save">
                  <input data-email-for="${escapeAttr(lead.id)}" placeholder="email@company.com">
                  <button class="button secondary" data-save-email="${escapeAttr(lead.id)}" type="button">Save</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  els.content.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("input,button,a")) return;
      state.selectedId = row.dataset.id;
      render();
    });
  });

  els.content.querySelectorAll("[data-save-email]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.saveEmail;
      const input = els.content.querySelector(`[data-email-for="${CSS.escape(id)}"]`);
      const email = input.value.trim();
      if (!email) return;
      updateLead(id, "Email", email);
      state.selectedId = id;
      render();
    });
  });
}

function renderCountries(leads) {
  const grouped = groupBy(leads, "Country");
  const byContinent = Object.entries(grouped)
    .sort(([countryA], [countryB]) => localeSort(countryA, countryB))
    .reduce((acc, [country, items]) => {
      const continent = continentFor(country);
      acc[continent] = acc[continent] || [];
      acc[continent].push([country, items]);
      return acc;
    }, {});

  els.content.innerHTML = CONTINENT_ORDER
    .filter((continent) => byContinent[continent]?.length)
    .map((continent) => {
      const countries = byContinent[continent];
      const leadCount = countries.reduce((sum, [, items]) => sum + items.length, 0);
      const cards = countries.map(([country, items]) => {
        const active = items.filter((lead) => !["Won", "Lost"].includes(lead.status)).length;
        return `
          <button class="country-card" data-country="${escapeHtml(country)}" type="button">
            <strong>${escapeHtml(country)}</strong>
            <span>${items.length} leads, ${active} active</span>
          </button>
        `;
      }).join("");

      return `
        <section class="continent-section">
          <div class="continent-heading">
            <h3>${escapeHtml(continent)}</h3>
            <span>${countries.length} countries, ${leadCount} leads</span>
          </div>
          <div class="country-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  els.content.querySelectorAll("[data-country]").forEach((card) => {
    card.addEventListener("click", () => {
      state.country = card.dataset.country;
      state.view = "leads";
      els.country.value = state.country;
      render();
    });
  });
}

function renderFollowups(leads) {
  const items = leads
    .filter((lead) => lead.nextFollowUp)
    .sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp));

  if (!items.length) {
    els.content.innerHTML = emptyState("No follow-ups scheduled for the current filters.");
    return;
  }

  els.content.innerHTML = `
    <div class="followup-list">
      ${items.map((lead) => `
        <button class="followup-item" data-id="${escapeHtml(lead.id)}" type="button">
          <strong>${escapeHtml(lead.nextFollowUp)} · ${escapeHtml(lead.Company)}</strong>
          <span class="muted">${escapeHtml(lead.Country)} · ${escapeHtml(lead.status)} · ${escapeHtml(lead.BuyerContact || "No contact listed")}</span>
        </button>
      `).join("")}
    </div>
  `;

  els.content.querySelectorAll("[data-id]").forEach((item) => {
    item.addEventListener("click", () => {
      state.selectedId = item.dataset.id;
      state.view = "leads";
      render();
    });
  });
}

// ── Import History View ─────────────────────────────────────────────────────

async function renderImportHistory() {
  els.content.innerHTML = `
    <div class="table-wrap">
      <p style="padding: 16px; color: var(--muted); font-size:14px;" id="importHistoryLoading">⏳ 불러오는 중...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/leads/batches');
    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    const batches = data.data;

    if (!batches.length) {
      els.content.innerHTML = emptyState('아직 CSV Import 기록이 없습니다. ⬆ Import CSV 버튼으로 데이터를 가져올 수 있습니다.');
      return;
    }

    els.content.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Batch ID</th>
              <th style="width:160px; text-align:center">가져온 날짜·시각</th>
              <th style="width:70px; text-align:center">건수</th>
              <th style="width:120px; text-align:center">롤백 (삭제)</th>
            </tr>
          </thead>
          <tbody>
            ${batches.map(b => {
              const dateStr = b.importedAt
                ? new Date(b.importedAt).toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
                : '-';
              return `
                <tr>
                  <td><code style="font-size:13px;background:#e0f2fe;color:#0c4a6e;padding:3px 8px;border-radius:6px;font-weight:600;border:1px solid #7dd3fc">${escapeHtml(b.batchId)}</code></td>
                  <td style="text-align:center;color:var(--text-secondary)">${escapeHtml(dateStr)}</td>
                  <td style="text-align:center;font-weight:700">${b.count}</td>
                  <td style="text-align:center">
                    <button class="button ghost"
                      style="color:#9f3333;border-color:#9f3333;padding:4px 10px;font-size:13px"
                      data-rollback-batch="${escapeAttr(b.batchId)}"
                      data-rollback-count="${b.count}"
                      type="button">
                      🗑 삭제
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    els.content.querySelectorAll('[data-rollback-batch]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const batchId = btn.dataset.rollbackBatch;
        const count = btn.dataset.rollbackCount;
        const ok = confirm(`"${batchId}" 배치의 리드 ${count}건을 모두 삭제하여 롤백하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);
        if (!ok) return;

        btn.disabled = true;
        btn.textContent = '삭제 중...';

        try {
          const res = await fetch(`/api/leads/batches/${encodeURIComponent(batchId)}`, { method: 'DELETE' });
          const result = await res.json();
          if (result.success) {
            // Reload baseLeads
            const leadsRes = await fetch('/api/leads');
            const leadsResult = await leadsRes.json();
            if (leadsResult.success) {
              baseLeads = leadsResult.data.map(lead => ({ ...lead, id: lead.leadId }));
              renderFilters();
            }
            // Re-render history view
            renderImportHistory();
          } else {
            alert('삭제 실패: ' + result.error);
            btn.disabled = false;
            btn.textContent = '🗑 삭제';
          }
        } catch (err) {
          alert('오류가 발생했습니다.');
          btn.disabled = false;
          btn.textContent = '🗑 삭제';
        }
      });
    });

  } catch (err) {
    els.content.innerHTML = emptyState('Import 기록을 불러오는 중 오류가 발생했습니다.');
  }
}

function initImportHistoryModal() {}



// stage 색상 매핑 (label 은 사용자 친화 문장)
const STAGE_STYLE = {
  imported:      { bg: '#f1f5f9', fg: '#475569', label: '📥 가져오기' },
  'ai-searched': { bg: '#ede9fe', fg: '#5b21b6', label: '🤖 AI 서칭' },
  verifying:     { bg: '#fef9c3', fg: '#854d0e', label: '🔍 검증 대기' },
  verified:      { bg: '#dcfce7', fg: '#166534', label: '✅ AI 검증 완료' },
  queued:        { bg: '#e0f2fe', fg: '#075985', label: '📋 발송 리스트' },
  contacted:     { bg: '#dbeafe', fg: '#1e40af', label: '📨 발송 관리' },
  replied:       { bg: '#e0e7ff', fg: '#3730a3', label: '💬 답장 받음' },
  negotiating:   { bg: '#fed7aa', fg: '#9a3412', label: '🤝 대화 진행 중' },
  partner:       { bg: '#f3e8ff', fg: '#6b21a8', label: '⭐ 파트너십 확정' },
  archived:      { bg: '#f3f4f6', fg: '#6b7280', label: '📦 보관함' },
  failed:        { bg: '#fee2e2', fg: '#991b1b', label: '🚫 검증 실패' },
};
const STAGE_ORDER = ['imported','ai-searched','verifying','verified','queued','contacted','replied','negotiating','partner','archived','failed'];

// 각 stage 에서 실무적으로 자주 이동하는 다음 단계들 (원클릭 버튼)
const STAGE_QUICK_MOVES = {
  imported:      ['verifying', 'archived'],
  'ai-searched': ['verifying', 'verified', 'archived'],  // AI 발굴 후보 → 검증대기 승격 / 즉시 검증 완료 / 제외
  verifying:     ['verified', 'archived'],
  // 검증 완료에서 클라이언트가 실제로 하는 판단은 두 가지다.
  //   "이 업체는 아닌데"  → 검증 실패 (아예 대상이 아님)
  //   "지금은 아닌데"      → 보관함  (나중에 다시 볼 수도)
  verified:      ['queued', 'failed', 'archived'],
  queued:        ['verified', 'failed', 'archived'],   // 되돌리기 = 발송 리스트에서 빼기
  contacted:     ['replied', 'archived'],
  // 답장 받음에서 실제로 하는 판단은 셋이다.
  //   "얘기가 되겠다"     → 대화 진행 중
  //   "우리랑 안 맞는다"  → 검증 실패 (아예 대상이 아니었음)
  //   "지금은 아니다"     → 보관함 (나중에 다시 볼 수도)
  replied:       ['negotiating', 'partner', 'failed', 'archived'],
  negotiating:   ['partner', 'archived'],
  partner:       ['negotiating', 'archived'],
  archived:      ['verified', 'verifying', 'imported'],
};

// 리드 발송 횟수 배지 (emailHistory 중 status='sent' 만 카운트)
// MAX_SEND_COUNT_PER_LEAD = 3 · 초과 임박 시 색상 강조
function sendCountBadgeHtml(lead) {
  const eh = Array.isArray(lead.emailHistory) ? lead.emailHistory : [];
  const sentCount = eh.filter(h => h && h.status === 'sent').length;
  if (sentCount === 0) return '';
  const MAX = 3;
  const color = sentCount >= MAX ? '#991b1b' : (sentCount >= 2 ? '#92400e' : '#166534');
  const bg    = sentCount >= MAX ? '#fee2e2' : (sentCount >= 2 ? '#fef3c7' : '#dcfce7');
  const bd    = sentCount >= MAX ? '#fca5a5' : (sentCount >= 2 ? '#fcd34d' : '#86efac');
  const lastSent = lead.lastEmailSentAt ? new Date(lead.lastEmailSentAt).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit' }) : '';
  const tip = `이 리드에 총 ${sentCount}회 발송됨\n최대 ${MAX}회 · 48h 최소 간격 · 초과 시 자동 차단${lastSent ? '\n최근 발송: ' + lastSent : ''}`;
  return `<span title="${escapeAttr(tip)}" style="display:inline-block;margin-top:3px;padding:2px 8px;background:${bg};color:${color};border:1px solid ${bd};border-radius:99px;font-size:10px;font-weight:700;line-height:1.4">✉ 메일 ${sentCount}회 발송${sentCount >= MAX ? ' (한도)' : ''}</span>`;
}

function stageCellHtml(lead) {
  const cur = lead.stage || 'imported';
  const style = STAGE_STYLE[cur] || STAGE_STYLE.imported;
  // 사이드바에서 숨긴 단계(가져오기·AI 서칭·검증 대기)는 목록에서 뺀다.
  // 옮겨놓고 나면 볼 화면이 없어서 리드가 사라진 것처럼 된다.
  // 단, 지금 그 단계에 있는 리드라면 자기 값은 보여야 하므로 예외로 남긴다.
  const HIDDEN_STAGES = new Set(['imported', 'ai-searched', 'verifying']);
  const options = STAGE_ORDER
    .filter(s => !HIDDEN_STAGES.has(s) || s === cur)
    .map(s => {
      const st = STAGE_STYLE[s];
      return `<option value="${s}" ${s === cur ? 'selected' : ''}>${st.label}</option>`;
    }).join('');

  // 원클릭 이동 버튼 (현재 stage 에서 실무적으로 자주 가는 다음 단계들)
  const quickTargets = STAGE_QUICK_MOVES[cur] || [];
  const quickBtns = quickTargets.map(target => {
    const t = STAGE_STYLE[target];
    // 같은 단계라도 어디서 옮기느냐에 따라 뜻이 다르다.
    // 답장까지 온 곳을 'failed' 로 보내는 것은 검증이 틀렸다는 뜻이 아니라
    // "얘기해 보니 우리랑 안 맞는다"는 뜻이라, 라벨을 그에 맞게 바꿔 준다.
    const CONTEXT_LABEL = {
      'replied:failed': '🚫 컨택 실패',
      'negotiating:failed': '🚫 컨택 실패',
      'queued:verified': '↩ 리스트에서 빼기',
    };
    const shortLabel = CONTEXT_LABEL[`${cur}:${target}`]
      || t.label.replace(/^([^\s]+)\s(.+)$/, '$1 $2');
    // ⚠️ 인라인 onclick 으로 stopPropagation 을 하면 안 된다.
    //    클릭 핸들러가 document 에 위임 등록돼 있어서, 여기서 전파를 끊으면
    //    핸들러가 아예 호출되지 않는다 (버튼이 먹통이 된다).
    //    행 클릭 차단은 위임 핸들러 안에서 stopPropagation 으로 처리한다.
    return `<button
      type="button"
      class="stage-quick-move"
      data-quick-lead="${escapeAttr(lead.id)}"
      data-quick-target="${target}"
      title="${shortLabel.replace(/^[^\s]+\s/, '')}(으)로 이동"
      style="padding:2px 6px;font-size:10px;border:1px solid ${t.fg}30;border-radius:99px;background:${t.bg};color:${t.fg};font-weight:600;cursor:pointer;white-space:nowrap;line-height:1.4"
    >→ ${shortLabel}</button>`;
  }).join('');

  return `
    <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">
      <select
        class="stage-select"
        data-stage-lead="${escapeAttr(lead.id)}"
        onclick="event.stopPropagation()"
        style="padding:4px 6px;font-size:11px;border:1px solid ${style.fg}40;border-radius:6px;background:${style.bg};color:${style.fg};font-weight:600;cursor:pointer;min-width:120px"
      >${options}</select>
      ${quickBtns ? `<div style="display:flex;gap:3px;flex-wrap:wrap;max-width:180px">${quickBtns}</div>` : ''}
      ${sendCountBadgeHtml(lead)}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
//  메일함 — 외부 B2B 메일 관리 도구를 대체하는 화면들
//  파이프라인이 '회사' 중심이라면 여기는 '메일' 중심이다.
//  리드에 매칭되지 않은 메일까지 전부 여기서 본다.
// ══════════════════════════════════════════════════════════════

// accountId: 어느 메일함을 볼지. 'all' 이면 등록된 계정 전부.
// 등록된 발송 계정(MailAccount)이 곧 수신 계정이다 — 이카운트는 자격증명이 같다.
var _inboxState = { page: 1, classification: '', q: '', linked: '', accountId: 'all', group: '', trashed: false, today: false };
var _mailAccountsCache = null;
var _mailGroupsCache = null;

/**
 * 지금 보고 있는 메일함의 계정 id.
 *
 * 대표 계정이 곧 메일함이다. 사용자가 메일함에서 계정 탭을 직접 누른 동안에만
 * (accountPicked) 그 선택을 따르고, 그 밖에는 늘 대표 계정을 가리킨다.
 *
 * _inboxState 는 메모리에만 있어서 새로고침하면 accountId 가 'all' 로 돌아간다.
 * 사이드바 배지(받은 메일함·회신 필요·기한 관리)는 메일함 화면보다 먼저 그려지기
 * 때문에, 이 함수를 거치지 않으면 대표를 바꿔놔도 배지만 '전체 계정' 숫자로 남는다.
 * 실제로 대표를 fe 로 바꿨는데 배지가 david 것까지 합친 100 으로 떠 있었다.
 *
 * accountId 는 MailAccount._id 문자열과 같다(lib/mail/accounts.ts summarize).
 */
function currentMailboxAccountId() {
  if (typeof _inboxState === 'undefined') return 'all';
  if (_inboxState.accountPicked) return _inboxState.accountId || 'all';
  const def = (_mailAccountsCache?.accounts || []).find((a) => a.isDefault);
  if (def?.accountId) {
    _inboxState.accountId = def.accountId;   // 화면들이 같은 값을 보게 맞춰둔다
    return def.accountId;
  }
  return _inboxState.accountId || 'all';
}

// 거래처(폴더) 목록 — 대표가 메일함에서 나눠둔 폴더가 그대로 온다
async function loadMailGroups(force) {
  if (!force && _mailGroupsCache) return _mailGroupsCache;
  try {
    const acc = currentMailboxAccountId();
    const r = await safeJsonFetch(`/api/mail/groups?accountId=${encodeURIComponent(acc)}`);
    if (r && r.success) { _mailGroupsCache = r; return r; }
  } catch (e) { console.warn('mail-groups', e); }
  return null;
}

// ⚠️ 이름을 loadMailAccounts 로 두면 안 된다.
//    아래쪽(계정 관리 화면)에 같은 이름의 함수가 또 있어서 이게 통째로 덮인다.
//    둘은 부르는 API 도(/api/mail/accounts vs /api/mail-accounts) 반환 모양도
//    (객체 {accounts,legacyCount} vs 배열) 달라서, 덮이면 메일함이 배열을 받고
//    accInfo.accounts 가 undefined 가 된다 — "등록된 계정 없음" 이 뜨던 원인.
async function loadInboxAccounts(force) {
  if (!force && _mailAccountsCache) return _mailAccountsCache;
  try {
    const r = await safeJsonFetch('/api/mail/accounts');
    if (r && r.success) {
      _mailAccountsCache = r;
      return r;
    }
  } catch (e) { console.warn('mail-accounts', e); }
  return null;
}

// 메일 분류 7가지.
//
// desc 는 배지에 마우스를 올리면 뜬다. 이름만으로는 "광고와 자동발송이 뭐가
// 다른가", "제휴는 어디까지인가"를 알 수 없어서, 판단 기준을 한 줄로 붙였다.
// (분류 규칙 자체는 src/lib/ai/analyze-mail.ts 의 SYSTEM 프롬프트에 있다)
const MAIL_CLASS = {
  b2b:        { label: '💼 B2B 거래', bg: '#dcfce7', fg: '#166534',
                desc: '실제 거래·수입·유통·대리점·OEM 관련. 이미 거래 중이거나 구체적인 거래 의사가 있는 메일.' },
  inquiry:    { label: '❓ 문의·견적', bg: '#dbeafe', fg: '#1e40af',
                desc: '제품·가격·MOQ·재고·견적·샘플 문의. 아직 거래 전이지만 회사와 담당자가 특정되는 실제 문의.' },
  partner:    { label: '🤝 제휴',     bg: '#e0e7ff', fg: '#3730a3',
                desc: '제휴·협업·입점·미디어·전시회 참가 제안 중 검토할 가치가 있는 것.' },
  newsletter: { label: '📰 뉴스레터', bg: '#fef3c7', fg: '#92400e',
                desc: '정기 소식지·업계 뉴스·구독 콘텐츠. 개별 응답이 필요 없는 것.' },
  ad:         { label: '📢 광고',     bg: '#fee2e2', fg: '#991b1b',
                desc: '사람이 보냈지만 우리에게 무언가를 팔려는 메일. 대량 발송 영업, 전시회 참가 권유, 마케팅·개발 외주 제안 등.' },
  system:     { label: '⚙ 자동발송',  bg: '#f1f5f9', fg: '#64748b',
                desc: '사람이 아니라 시스템이 자동으로 보낸 것. 인증번호, 알림, 부재중 자동응답, 읽음 확인, 발송 실패 통지, 건물 공지 등.' },
  unknown:    { label: '· 미분류',    bg: '#f8fafc', fg: '#475569',
                desc: '위 어디에도 확실히 넣기 어렵거나, 아직 AI 분석을 돌리지 않아 판단 근거가 부족한 메일.' },
};

async function renderInboxPage(opts) {
  const needsReplyOnly = opts && opts.needsReplyOnly === true;
  els.content.innerHTML = `<div class="inline-loader">메일함 불러오는 중…</div>`;

  // 계정 목록을 먼저 받아야 대표 계정을 알 수 있다. 이 줄이 params 뒤에 있던 동안에는
  // 새로고침 직후 첫 조회가 accountId='all' 로 나가서 남의 계정 메일까지 섞여 보였다.
  const accInfo = await loadInboxAccounts();

  const params = new URLSearchParams({
    page: String(_inboxState.page),
    limit: '50',
  });
  if (needsReplyOnly) params.set('needsReply', '1');
  if (_inboxState.classification) params.set('classification', _inboxState.classification);
  if (_inboxState.q) params.set('q', _inboxState.q);
  if (_inboxState.linked) params.set('linked', _inboxState.linked);
  params.set('accountId', currentMailboxAccountId());
  if (_inboxState.group) params.set('group', _inboxState.group);
  // 휴지통 보기 — 치운 메일은 기본 목록에서 빠져 있다
  if (_inboxState.trashed) { params.set('trashed', '1'); params.set('flat', '1'); }
  // 오늘 온 메일 — 대화로 접지 않고 낱개로 본다.
  // 위에 "오늘 12통" 이라고 써 놓고 목록이 8줄이면(대화로 접혀서) 숫자가 어긋난다.
  if (_inboxState.today && !_inboxState.trashed) { params.set('today', '1'); params.set('flat', '1'); }

  const groupInfo = await loadMailGroups();
  // 상단 [오늘 온 메일]의 숫자는 사이드바 배지와 같은 API 에서 온다.
  // 이 await 가 없으면 새로고침 직후 첫 화면에서만 숫자가 비어 보인다.
  await loadMailCounts();

  let data;
  try {
    data = await safeJsonFetch(`/api/mail/inbox?${params.toString()}`);
  } catch (e) {
    els.content.innerHTML = `<div class="empty-detail"><h3>불러오기 실패</h3><p>${escapeHtml(String(e.message || e))}</p></div>`;
    return;
  }
  if (!data || !data.success) {
    els.content.innerHTML = `<div class="empty-detail"><h3>조회 실패</h3><p>${escapeHtml(data?.error || '알 수 없는 오류')}</p></div>`;
    return;
  }

  const items = data.items || [];
  const total = data.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  const dt = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  // 수집이 한 번도 안 돌았으면 빈 목록 대신 다음 행동을 알려준다.
  //
  // 단, [오늘 온 메일]을 보는 중이면 이 화면으로 빠지지 않는다. 오늘 0통인 것은
  // 정상인데 "수집된 메일이 없습니다"가 뜨면 수집이 고장난 줄 알게 되고,
  // 무엇보다 오늘 보기를 끄는 버튼까지 화면에서 사라져 되돌아갈 길이 없어진다.
  if (!total && !_inboxState.q && !_inboxState.classification && !_inboxState.today) {
    els.content.innerHTML = `
      <div class="empty-detail">
        <h3>${needsReplyOnly ? '회신이 필요한 메일이 없습니다' : '수집된 메일이 없습니다'}</h3>
        <p>${needsReplyOnly
          ? '상대가 질문이나 요청을 보내면 여기에 모입니다.'
          : '이카운트 메일함에서 아직 메일을 가져오지 않았습니다.'}</p>
        ${needsReplyOnly ? '' : `
          <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
            <button class="button" id="inboxIngestBtn" type="button">📥 지금 메일 가져오기</button>
            <button class="button secondary" data-goto-view="tool-mail-settings" type="button">🔌 수신 설정</button>
          </div>`}
      </div>`;
    bindInboxActions();
    return;
  }

  const filterChip = (label, key, val) => {
    const active = _inboxState[key] === val;
    return `<button type="button" class="inbox-filter" data-filter-key="${key}" data-filter-val="${escapeAttr(val)}"
      style="padding:5px 12px;font-size:12px;border-radius:99px;cursor:pointer;font-weight:600;
             border:1px solid ${active ? 'var(--brand)' : 'var(--border-default)'};
             background:${active ? 'var(--brand-soft)' : 'var(--bg-surface)'};
             color:${active ? 'var(--brand-text)' : 'var(--text-secondary)'}">${label}</button>`;
  };

  // 제목 앞에 붙는 거래처 폴더 태그.
  //
  // [오늘 온 메일]은 폴더로 나누지 않고 온 순서대로 다 보여준다. 대신
  // 한 줄 한 줄에 "이건 사업개발 폴더로 들어갔다" 가 보여야 한다 —
  // 안 그러면 오늘 본 메일을 나중에 어디서 찾을지 알 수 없다.
  // 그래서 오늘 보기에서는 미분류까지 태그를 붙인다(평소엔 폴더가 있을 때만).
  // 태그는 버튼이다 — 눌러서 그 자리에서 폴더를 지정한다.
  //
  // 자동 분류는 확실한 것만 잡고 나머지는 미분류로 남긴다(억지로 넣으면
  // 1통짜리 폴더가 무더기로 생긴다). 그래서 미분류는 계속 쌓이는데,
  // 그걸 옮기려면 체크박스를 켜고 위쪽 선택바의 드롭다운을 찾아야 했다.
  // 보고 있는 자리에서 바로 넣을 수 있어야 실제로 정리가 된다.
  //
  // 행 클릭(메일 상세 열기)은 button 을 제외하므로 서로 부딪히지 않는다.
  const folderTag = (m) => {
    const id = escapeAttr(String(m._id));
    if (m.group) {
      return `<button type="button" class="mail-folder-tag" data-mail-id="${id}" data-cur="${escapeAttr(m.group)}"
                title="거래처 폴더 · ${escapeAttr(m.groupBy === 'manual' ? '직접 지정' : m.groupBy || '자동 분류')}&#10;눌러서 다른 폴더로 옮깁니다"
                style="background:var(--bg-surface-alt);color:var(--text-secondary);border:1px solid var(--border-subtle);
                       border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700;margin-right:5px;
                       cursor:pointer">📁 ${escapeHtml(m.group)}</button>`;
    }
    // 미분류 태그는 오늘 보기와 미분류 폴더에서만 띄운다.
    // 평소 목록에서까지 모든 줄에 뜨면 제목이 밀려 읽기 어려워진다.
    const sug = m.groupSuggest && m.groupSuggest.group;
    const showHere = _inboxState.today || _inboxState.group === '__none__';
    if (!showHere && !sug) return '';
    // 전에 같은 곳에서 온 메일을 넣어둔 폴더가 있으면 그것을 먼저 권한다
    if (sug) {
      return `<button type="button" class="mail-folder-tag" data-mail-id="${id}" data-cur=""
                data-suggest="${escapeAttr(sug)}"
                title="이 발신자의 메일을 전에 [${escapeAttr(sug)}] 폴더에 넣으셨습니다 (${m.groupSuggest.count}통).&#10;눌러서 폴더를 지정합니다."
                style="background:#fffbeb;color:#92400e;border:1px solid #fcd34d;
                       border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700;margin-right:5px;
                       cursor:pointer">📥 ${escapeHtml(sug)}?</button>`;
    }
    return `<button type="button" class="mail-folder-tag" data-mail-id="${id}" data-cur=""
              title="아직 어느 거래처 폴더에도 들어가지 않았습니다. 눌러서 지정하세요."
              style="color:var(--text-tertiary);background:var(--bg-surface);
                     border:1px dashed var(--border-strong);
                     border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700;margin-right:5px;
                     cursor:pointer">❔ 폴더 지정</button>`;
  };

  const rows = items.map((m) => {
    const cls = MAIL_CLASS[m.classification] || MAIL_CLASS.unknown;
    const from = m.from || {};
    const threadBadge = (m.threadCount || 1) > 1
      ? `<span style="background:var(--bg-surface-alt);color:var(--text-tertiary);border-radius:99px;
                     padding:1px 7px;font-size:10px;font-weight:700;margin-left:6px">${m.threadCount}통</span>`
      : '';
    const needsReply = m.analysis && m.analysis.needsReply;
    const deadline = m.threadDeadline || (m.analysis && m.analysis.deadline);
    // 리드에 연결된 메일은 그 회사의 대화로 바로 갈 수 있게 한다
    const leadLink = m.leadId
      ? `<button type="button" class="conversation-btn" data-conv-lead="${escapeAttr(m.leadId)}"
           style="padding:2px 8px;font-size:10px;border:1px solid #16a34a;border-radius:99px;
                  background:#16a34a;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap">
           💬 리드 대화</button>`
      : `<span style="font-size:10px;color:var(--text-quaternary)">리드 미연결</span>`;

    return `
      <tr class="inbox-row" data-mail-id="${escapeAttr(String(m._id))}" style="cursor:pointer">
        <td style="width:32px"><input type="checkbox" class="inbox-check" data-mail-id="${escapeAttr(String(m._id))}"
          style="width:15px;height:15px;cursor:pointer"></td>
        <td style="white-space:nowrap;color:var(--text-tertiary);font-size:12px">${dt(m.date)}</td>
        <td>
          <div style="font-weight:600;color:var(--text-primary);font-size:13px">
            ${escapeHtml(from.name || from.address || '(발신자 없음)')}
          </div>
          <div style="font-size:11px;color:var(--text-tertiary)">${escapeHtml(from.address || '')}</div>
        </td>
        <td>
          <div style="color:var(--text-primary);font-size:13px">
            ${folderTag(m)}
            ${escapeHtml(String(m.subject || '(제목 없음)').slice(0, 70))}${threadBadge}
          </div>
          ${m.analysis?.summary ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${escapeHtml(String(m.analysis.summary).slice(0, 90))}</div>` : ''}
        </td>
        <td style="white-space:nowrap">
          <span title="${escapeAttr(cls.desc || '')}" style="background:${cls.bg};color:${cls.fg};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;cursor:help">${cls.label}</span>
        </td>
        <td style="white-space:nowrap">
          ${m.status === 'replied'
            ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700"
                 title="${m.repliedOutside ? '이카운트 웹메일에서 답한 것을 보낸메일함에서 확인했습니다' : '앱에서 회신했습니다'}">
                 ✅ 회신함${m.repliedOutside ? ' (웹메일)' : ''}</span>`
            : needsReply
              ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">⚠ 회신 필요</span>`
              : '<span style="color:var(--text-quaternary);font-size:11px">—</span>'}
          ${deadline ? `<div style="font-size:10px;color:#b45309;margin-top:3px">기한 ${dt(deadline)}</div>` : ''}
        </td>
        <td style="white-space:nowrap">${leadLink}</td>
      </tr>`;
  }).join('');

  // ── 계정 선택 탭 ──
  // 등록된 계정이 하나뿐이면 굳이 보여주지 않는다 (선택지가 없는 선택기는 잡음이다)
  const accounts = accInfo?.accounts || [];

  // 어느 계정 메일함을 그릴지는 한 군데(currentMailboxAccountId)에서만 정한다.
  // 사이드바 배지도 같은 함수를 쓰기 때문에 화면끼리 숫자가 어긋나지 않는다.
  // 대표가 아직 하나도 없으면(예: 전부 해제된 상태) 첫 계정으로 떨어뜨린다.
  {
    const resolved = currentMailboxAccountId();
    if (resolved === 'all' && !_inboxState.accountPicked && accounts.length) {
      _inboxState.accountId = accounts[0].accountId;
    }
  }
  // 계정 탭은 뺐다.
  //
  // 대표 계정을 지정하면 메일함이 그 계정 것으로 바뀌는데, 위에 계정 탭이 또
  // 있으면 "지금 누구 메일함인가"가 두 군데서 정해지는 셈이라 헷갈린다.
  // 계정을 바꾸려면 [📬 메일 계정]에서 대표 계정을 바꾸면 된다.
  // (되살리려면 아래 false 를 accounts.length > 1 로 돌리면 된다.)
  const accountTabs = false ? `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--text-tertiary);font-weight:700;margin-right:2px">메일함</span>
      ${[{ accountId: 'all', label: '전체', address: '', mailCount: accounts.reduce((a, x) => a + (x.mailCount || 0), 0) }]
        .concat(accounts)
        .map((a) => {
          const active = _inboxState.accountId === a.accountId;
          return `<button type="button" class="inbox-account" data-account-id="${escapeAttr(a.accountId)}"
            title="${escapeAttr(a.address || '등록된 계정 전체')}"
            style="padding:5px 12px;font-size:12px;border-radius:8px;cursor:pointer;font-weight:600;
                   border:1px solid ${active ? 'var(--brand)' : 'var(--border-default)'};
                   background:${active ? 'var(--brand-soft)' : 'var(--bg-surface)'};
                   color:${active ? 'var(--brand-text)' : 'var(--text-secondary)'}">
            ${escapeHtml(a.label)}${a.isDefault ? ' <span title="설정 → 메일 계정에서 지정한 대표 계정입니다" style="font-size:9.5px;font-weight:800;color:#1e40af">대표</span>' : ''}
            <span style="opacity:.65;font-weight:400">${a.mailCount || 0}</span>
          </button>`;
        }).join('')}
      ${accInfo?.legacyCount
        ? `<span style="font-size:11px;color:var(--text-quaternary)"
             title="계정 구분 없이 수집된 옛 메일입니다. 다시 수집하면 계정이 붙습니다.">
             · 계정 미분류 ${accInfo.legacyCount}통</span>`
        : ''}
    </div>` : '';

  // ── 지금 어느 메일함을 보고 있는가 ──
  // 계정 탭은 등록 계정이 2개 이상일 때만 뜨기 때문에, 탭이 없으면 화면 어디에도
  // "지금 보고 있는 주소"가 적혀 있지 않았다. 남의 메일함을 자기 것으로 착각한 채
  // 회신 필요 건수를 읽는 일이 생길 수 있어, 주소를 항상 맨 위에 박아둔다.
  const curAcc = accounts.find((a) => a.accountId === _inboxState.accountId);
  const viewingLabel = curAcc
    ? (curAcc.address || curAcc.label)
    : (accounts.map((a) => a.address).filter(Boolean).join('  ·  ') || '등록된 계정 없음');
  const viewingBanner = `
    <div style="display:flex;align-items:center;gap:11px;margin-bottom:10px;padding:10px 14px;
                background:var(--brand-soft,#eef2ff);border:1px solid var(--brand,#c7d2fe);border-radius:10px">
      <span style="font-size:18px">📬</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:10.5px;font-weight:800;letter-spacing:.5px;
                    color:var(--brand-text,#4338ca);text-transform:uppercase">현재 확인 중인 메일함</div>
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);line-height:1.35;
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${escapeHtml(viewingLabel)}${curAcc ? '' : (accounts.length > 1 ? '  (전체)' : '')}
        </div>
      </div>
      ${accounts.length > 1
        ? `<span style="font-size:11px;color:var(--text-tertiary);white-space:nowrap">아래 탭에서 전환 ↓</span>`
        : ''}
    </div>`;

  // ── 오늘 온 메일 ──
  //
  // 폴더는 "어느 거래처인가"로 나눈다. 그건 나중에 찾을 때 쓰는 축이고,
  // 아침에 메일함을 열었을 때 알고 싶은 것은 "밤사이 뭐가 왔나" 하나다.
  // 폴더로만 나눠 두면 오늘 온 3통이 다섯 폴더에 흩어져 있어 다 열어봐야 한다.
  // 그래서 시간 축을 폴더 위에 따로 둔다.
  //
  // 숫자는 사이드바 배지와 같은 API(/api/mail/counts)에서 온다 — 한 화면에
  // 두 숫자가 다르게 뜨는 일이 없도록 기준을 하나로 묶어 둔다.
  // "오늘"의 경계는 서버에서 서울 자정으로 못박는다 (lib/mail/period.ts).
  const todayN = _mailCountsCache?.counts?.today ?? null;
  const todayNoise = _mailCountsCache?.counts?.todayNoise ?? 0;
  const todayReply = _mailCountsCache?.counts?.todayNeedsReply ?? 0;
  const todayOn = !!_inboxState.today && !_inboxState.trashed;
  const todayReal = todayN === null ? null : Math.max(0, todayN - todayNoise);

  // 아침에 메일함을 열고 가장 먼저 보는 것이라, 화면에서 가장 큰 덩어리로 둔다.
  // 폴더 목록과 같은 크기로 놓으면 여러 갈래 중 하나로 묻혀 눈에 안 들어온다.
  const todayLabel = new Date().toLocaleDateString('ko-KR',
    { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  const stat = (n, label, tone) => `
    <div style="min-width:76px">
      <div style="font-size:21px;font-weight:800;line-height:1.15;color:${tone}">${n.toLocaleString()}</div>
      <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);margin-top:1px">${label}</div>
    </div>`;

  const todayStrip = needsReplyOnly ? '' : `
    <section style="margin-bottom:14px;padding:20px 24px;border-radius:16px;position:relative;overflow:hidden;
                    border:1px solid ${todayOn ? '#2563eb' : 'var(--border-default)'};
                    background:${todayOn
                      ? 'linear-gradient(135deg,#eff6ff 0%,#e0ecff 100%)'
                      : 'linear-gradient(135deg,var(--bg-surface) 0%,var(--bg-surface-alt) 100%)'};
                    box-shadow:${todayOn ? '0 4px 16px rgba(37,99,235,.14)' : 'var(--shadow-sm)'}">
      <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">

        <div style="display:flex;align-items:center;gap:14px;min-width:0">
          <div style="width:52px;height:52px;flex:none;border-radius:14px;display:flex;
                      align-items:center;justify-content:center;font-size:26px;
                      background:${todayOn ? '#2563eb' : '#eff6ff'}">📨</div>
          <div style="min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <h2 style="margin:0;font-size:19px;font-weight:800;line-height:1.2;
                         color:${todayOn ? '#1d4ed8' : 'var(--text-primary)'}">오늘 온 메일</h2>
              ${todayOn ? `<span style="background:#2563eb;color:#fff;border-radius:99px;padding:2px 10px;
                             font-size:11px;font-weight:800">보는 중</span>` : ''}
            </div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">${todayLabel}</div>
          </div>
        </div>

        ${todayN === null
          ? `<div style="flex:1;font-size:13px;color:var(--text-tertiary)">숫자를 불러오는 중…</div>`
          : todayN === 0
            ? `<div style="flex:1;min-width:180px">
                 <div style="font-size:15px;font-weight:700;color:var(--text-secondary)">아직 오늘 온 메일이 없습니다</div>
                 <div style="font-size:12px;color:var(--text-quaternary);margin-top:3px">
                   새 메일은 [📥 메일 가져오기] 를 누르면 들어옵니다</div>
               </div>`
            : `<div style="flex:1;display:flex;align-items:center;gap:22px;flex-wrap:wrap;min-width:0">
                 <div style="display:flex;align-items:baseline;gap:5px">
                   <span style="font-size:40px;font-weight:800;line-height:1;
                                color:${todayOn ? '#1d4ed8' : 'var(--text-primary)'}">${todayN.toLocaleString()}</span>
                   <span style="font-size:14px;font-weight:700;color:var(--text-tertiary)">통</span>
                 </div>
                 <div style="width:1px;height:40px;background:var(--border-default)"></div>
                 ${stat(todayReal, '읽을 메일', 'var(--text-primary)')}
                 ${todayReply ? stat(todayReply, '회신 필요', '#b45309') : ''}
                 ${todayNoise ? stat(todayNoise, '광고·자동발송', 'var(--text-quaternary)') : ''}
               </div>`}

        <div style="margin-left:auto;text-align:right">
          <button type="button" id="inboxTodayBtn"
            title="${todayOn ? '전체 메일함으로 돌아갑니다' : '오늘 들어온 메일만 폴더 구분 없이 모아서 봅니다'}"
            style="padding:13px 24px;border-radius:11px;cursor:pointer;font-size:14px;font-weight:800;
                   white-space:nowrap;
                   border:${todayOn ? '1px solid #2563eb' : 'none'};
                   background:${todayOn ? '#fff' : '#2563eb'};
                   color:${todayOn ? '#1d4ed8' : '#fff'};
                   box-shadow:${todayOn ? 'none' : '0 2px 10px rgba(37,99,235,.32)'}">
            ${todayOn ? '✕ 전체 메일함으로' : '오늘 메일 열기 →'}
          </button>
          <div style="font-size:11px;color:var(--text-quaternary);margin-top:7px">
            ${todayOn ? '제목 앞 📁 가 들어간 폴더입니다' : '폴더 구분 없이 한 번에 봅니다'}
          </div>
        </div>
      </div>
    </section>`;

  // ── 거래처 폴더 목록 (좌측) ──
  // 대표가 메일함에서 나눠둔 폴더가 그대로 온다. 새 메일은 수집 시점에
  // 발신자 이력·제목으로 같은 폴더에 자동 분류된다 (AI 없이 무료).
  const groups = groupInfo?.groups || [];
  const ungrouped = groupInfo?.ungrouped || 0;
  const folderItem = (label, value, count, fresh, icon) => {
    // 오늘 보기 중에는 폴더를 하나도 고르지 않은 상태다.
    // 이 줄이 없으면 [전체]가 켜진 것처럼 보여, 오늘 보기인데 전체를 보는 줄 안다.
    const active = !todayOn && _inboxState.group === value;
    return `<button type="button" class="inbox-group" data-group="${escapeAttr(value)}"
      style="display:flex;align-items:center;gap:6px;width:100%;text-align:left;padding:7px 10px;
             font-size:12.5px;border:none;border-radius:7px;cursor:pointer;margin-bottom:2px;
             background:${active ? 'var(--brand-soft)' : 'transparent'};
             color:${active ? 'var(--brand-text)' : 'var(--text-secondary)'};
             font-weight:${active ? '700' : '500'}">
      <span style="width:16px;flex-shrink:0">${icon}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(label)}</span>
      ${fresh ? `<span style="background:#fee2e2;color:#991b1b;border-radius:99px;padding:0 6px;
                   font-size:10px;font-weight:800">${fresh}</span>` : ''}
      <span style="color:var(--text-quaternary);font-size:11px">${count}</span>
    </button>`;
  };

  const folderPanel = `
    <aside style="width:210px;flex-shrink:0;background:var(--bg-surface);border:1px solid var(--border-subtle);
                  border-radius:12px;padding:10px;align-self:flex-start;max-height:72vh;overflow:auto">
      <div style="font-size:10px;font-weight:800;color:var(--text-tertiary);padding:2px 10px 8px;
                  text-transform:uppercase;letter-spacing:.5px">거래처 폴더</div>
      ${folderItem('전체', '', total, 0, '📬')}
      ${groups.map((g) => folderItem(g.group, g.group, g.total, g.fresh, '📁')).join('')}
      ${ungrouped ? folderItem('미분류', '__none__', ungrouped, 0, '❔') : ''}
      <!-- 휴지통도 폴더의 하나로 둔다. 별도 화면으로 빼두면 "치웠는데 어디 갔지"가 되고,
           치운 메일을 되돌리려면 다른 화면으로 나가야 해서 흐름이 끊긴다.
           DB 에서 지우지 않으므로 여기서 언제든 되살릴 수 있다. -->
      <div style="border-top:1px solid var(--border-subtle);margin-top:6px;padding-top:6px">
        <button type="button" class="inbox-group" data-group="__trash__"
          style="display:flex;align-items:center;gap:6px;width:100%;text-align:left;padding:7px 10px;
                 font-size:12.5px;border:none;border-radius:7px;cursor:pointer;margin-bottom:2px;
                 background:${_inboxState.trashed ? 'var(--brand-soft)' : 'transparent'};
                 color:${_inboxState.trashed ? 'var(--brand-text)' : 'var(--text-secondary)'};
                 font-weight:${_inboxState.trashed ? '700' : '500'}">
          <span style="width:16px;flex-shrink:0">🗑</span>
          <span style="flex:1">휴지통</span>
          <span style="color:var(--text-quaternary);font-size:11px">${(_mailCountsCache?.counts?.trash ?? 0)}</span>
        </button>
      </div>
      <div style="border-top:1px solid var(--border-subtle);margin-top:8px;padding-top:8px">
        <button type="button" id="inboxRegroupBtn"
          style="width:100%;padding:6px;font-size:11px;border:1px solid var(--border-default);
                 border-radius:7px;background:var(--bg-surface);color:var(--text-secondary);cursor:pointer"
          title="이미 폴더에 넣어둔 메일을 보고 '이 주소는 이 거래처' 를 익혀서, 미분류에 남은 메일을 같은 폴더로 옮깁니다.">
          🔄 미분류 메일 정리하기
        </button>
        <div style="font-size:10px;color:var(--text-quaternary);margin-top:6px;line-height:1.5">
          새로 온 메일은 보낸 사람을 보고 자동으로 폴더에 들어갑니다.<br>
          모르는 곳에서 온 메일만 <b>미분류</b>에 남습니다.
        </div>
      </div>
    </aside>`;

  els.content.innerHTML = `
    ${viewingBanner}
    ${todayStrip}
    ${accountTabs}
    <div style="display:flex;gap:14px;align-items:flex-start">
    ${folderPanel}
    <div style="flex:1;min-width:0">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <input id="inboxSearch" type="search" placeholder="제목·발신자 검색" value="${escapeAttr(_inboxState.q)}"
        style="padding:7px 12px;font-size:13px;border:1px solid var(--border-default);border-radius:8px;
               background:var(--bg-surface);color:var(--text-primary);min-width:220px">
      ${filterChip('전체', 'classification', '')}
      ${filterChip('💼 B2B·문의', 'classification', 'b2b,inquiry,partner')}
      ${filterChip('· 미분류', 'classification', 'unknown')}
      ${filterChip('📢 광고·자동', 'classification', 'ad,system,newsletter')}
      <!-- 이름만으로는 '광고와 자동발송이 뭐가 다른가'를 알 수 없다.
           눌러서 펼치는 설명을 옆에 둔다 (평소엔 접혀 있어 화면을 어지럽히지 않는다) -->
      <button type="button" id="clsHelpBtn" title="분류 기준 보기"
        style="width:20px;height:20px;padding:0;border-radius:50%;border:1px solid var(--border-default);
               background:var(--bg-surface);color:var(--text-tertiary);font-size:11px;font-weight:800;
               cursor:pointer;line-height:1">?</button>
      <span style="width:1px;height:20px;background:var(--border-default)"></span>
      ${filterChip('리드 연결됨', 'linked', '1')}
      ${filterChip('미연결', 'linked', '0')}
      <button class="button secondary" id="inboxIngestBtn" type="button" style="margin-left:auto">📥 메일 가져오기</button>
      <!-- [🧠 AI 분석] 은 뺐다 — 한 번에 N통을 유료 분석하는 버튼이라 비용이 예측되지 않는다.
           분석 결과(한글 번역·요약·기한)를 *보는* 기능은 그대로다. 분석 자체는 개발자 쪽에서
           일괄로 돌려 DB 에 넣는다. 되살리려면 아래 주석을 풀면 된다 (핸들러는 살아 있다).
      <button class="button secondary" id="inboxAnalyzeBtn" type="button" title="한글 번역 + 요약 + 기한 추출 (유료)">🧠 AI 분석</button>
      -->
    </div>

    <div id="clsHelpPanel" style="display:none;margin-bottom:12px;padding:12px 14px;
         background:var(--bg-surface-alt);border:1px solid var(--border-default);border-radius:10px">
      <div style="font-size:11.5px;font-weight:800;color:var(--text-secondary);margin-bottom:8px">
        메일 분류 기준 — 받은 메일은 아래 7가지 중 하나로 자동 분류됩니다
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:7px">
        ${Object.values(MAIL_CLASS).map((c) => `
          <div style="display:flex;gap:8px;align-items:flex-start">
            <span style="flex:none;background:${c.bg};color:${c.fg};padding:2px 8px;border-radius:99px;
                         font-size:11px;font-weight:700;white-space:nowrap">${c.label}</span>
            <span style="font-size:11.5px;color:var(--text-secondary);line-height:1.5">${escapeHtml(c.desc)}</span>
          </div>`).join('')}
      </div>
      <div style="margin-top:9px;padding-top:8px;border-top:1px solid var(--border-default);
                  font-size:11px;color:var(--text-tertiary);line-height:1.6">
        <b>📢 광고와 ⚙ 자동발송의 차이</b> — 광고는 <b>사람</b>이 우리에게 팔려고 보낸 것,
        자동발송은 <b>기계</b>가 알리려고 보낸 것입니다. 둘 다 배지 숫자에서 빠집니다
        (인증번호까지 세면 "받은 메일 N통"이 의미를 잃기 때문입니다).
        <br>분류가 틀렸으면 메일을 열어 직접 바꿀 수 있고, 손으로 고친 분류는 재분석이 덮지 않습니다.
      </div>
    </div>

    <!-- 선택 액션 — 아무것도 안 골랐으면 숨어 있다가 체크하면 나타난다 -->
    <div id="inboxBulkBar" style="display:none;align-items:center;gap:8px;margin-bottom:10px;padding:8px 12px;
         background:var(--brand-soft);border:1px solid var(--brand);border-radius:9px">
      <span style="font-size:12.5px;font-weight:700;color:var(--brand-text)">
        <span id="inboxSelCount">0</span>통 선택됨
      </span>
      ${_inboxState.trashed
        ? `<button type="button" id="inboxRestoreBtn" class="button" style="padding:5px 14px;font-size:12px">↩ 받은함으로 되돌리기</button>`
        : `
          <!-- 폴더 이동 — 자동 분류가 애매한 것은 미분류로 남고, 여기서 사람이 옮긴다 -->
          <select id="inboxMoveGroup" style="padding:5px 10px;font-size:12px;border-radius:7px;
                  border:1px solid var(--border-default);background:var(--bg-surface);
                  color:var(--text-primary);cursor:pointer">
            <option value="">거래처 폴더로 이동…</option>
            ${(groupInfo?.groups || []).map((g) => `<option value="${escapeAttr(g.group)}">📁 ${escapeHtml(g.group)}</option>`).join('')}
            <option value="__none__">❔ 미분류로 되돌리기</option>
          </select>
          <button type="button" id="inboxTrashBtn" class="button secondary" style="padding:5px 14px;font-size:12px">🗑 휴지통으로</button>`}
      <button type="button" id="inboxSelClear" style="background:none;border:none;color:var(--text-tertiary);
              font-size:12px;cursor:pointer">선택 해제</button>
      <span style="font-size:11px;color:var(--text-tertiary);margin-left:auto">
        휴지통으로 보내도 <b>지워지지 않습니다</b> — 언제든 되돌릴 수 있습니다
      </span>
    </div>

    <div style="margin-bottom:10px;font-size:12px;color:var(--text-tertiary);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span>총 <b style="color:var(--text-primary)">${total.toLocaleString()}</b>${_inboxState.trashed ? '통 (휴지통)' : (todayOn ? '통 · 오늘 들어온 것' : '개 대화')}
      ${needsReplyOnly ? ' · 회신 필요만' : ''}
      ${todayOn
        ? ' · <span style="color:var(--text-quaternary)">제목 앞 📁 태그가 이 메일이 들어간 거래처 폴더입니다</span>'
        : (_inboxState.group ? ` · 📁 ${escapeHtml(_inboxState.group === '__none__' ? '미분류' : _inboxState.group)}` : '')}</span>
      <span id="inboxAiStatus" style="color:var(--text-quaternary)"></span>
    </div>

    ${renderPaginationBar(data.page, totalPages, total, { compact: true })}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:32px"><input type="checkbox" id="inboxCheckAll" title="이 페이지 전체 선택" style="width:15px;height:15px;cursor:pointer"></th>
            <th>받은 시각</th><th>발신자</th><th>제목</th><th>분류</th><th>상태</th><th>리드</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:var(--text-tertiary);padding:32px">조건에 맞는 메일이 없습니다.</td></tr>'}</tbody>
      </table>
    </div>
    ${renderPaginationBar(data.page, totalPages, total)}
    </div>
    </div>
  `;

  bindInboxActions();
  els.content.querySelectorAll('.page-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = parseInt(btn.dataset.page, 10);
      if (isNaN(t) || t === data.page) return;
      _inboxState.page = Math.min(Math.max(1, t), totalPages);
      render();
    });
  });
}

/**
 * 폴더 지정 메뉴 — 메일 한 통을 그 자리에서 거래처 폴더에 넣는다.
 *
 * 태그 바로 아래에 붙여 띄운다. 팝업 한가운데로 띄우면 지금 어느 메일을
 * 옮기는 중인지 눈을 뗀 사이에 놓친다.
 *
 * 넣고 나서 화면 전체를 다시 그리지는 않는다 — 오늘 온 메일을 위에서부터
 * 훑어 내려가며 정리하는 중인데 매번 맨 위로 튀면 정리를 할 수가 없다.
 * 누른 줄의 태그만 바꾸고, 폴더 숫자는 다음에 그릴 때 맞춘다.
 */
function closeFolderPicker() {
  document.getElementById('mailFolderPicker')?.remove();
}

function openFolderPicker(anchor) {
  closeFolderPicker();
  const mailId = anchor.dataset.mailId;
  const cur = anchor.dataset.cur || '';
  const groups = (_mailGroupsCache?.groups || []).map((g) => g.group).filter(Boolean);
  const suggested = anchor.dataset.suggest || '';

  const item = (label, value, style) => `
    <button type="button" class="mfp-pick" data-group="${escapeAttr(value)}"
      style="display:flex;align-items:center;gap:7px;width:100%;text-align:left;padding:7px 11px;
             font-size:12.5px;border:none;border-radius:7px;cursor:pointer;background:none;
             color:var(--text-secondary);${style || ''}">${label}</button>`;

  const r = anchor.getBoundingClientRect();
  document.body.insertAdjacentHTML('beforeend', `
    <div id="mailFolderPicker" style="position:fixed;inset:0;z-index:9997">
      <div style="position:absolute;top:${Math.min(r.bottom + 4, window.innerHeight - 340)}px;
                  left:${Math.min(r.left, window.innerWidth - 260)}px;width:248px;max-height:330px;
                  overflow:auto;background:var(--bg-surface);border:1px solid var(--border-default);
                  border-radius:11px;box-shadow:0 10px 34px rgba(0,0,0,.18);padding:7px">
        <div style="font-size:10px;font-weight:800;color:var(--text-tertiary);padding:4px 11px 6px;
                    text-transform:uppercase;letter-spacing:.5px">거래처 폴더로 넣기</div>
        ${suggested ? `
          <div style="padding:0 4px 5px;margin-bottom:4px;border-bottom:1px solid var(--border-subtle)">
            ${item(`📥 <b>${escapeHtml(suggested)}</b> <span style="font-size:10px;opacity:.7">추천</span>`,
                   suggested, 'background:#fffbeb;color:#92400e;font-weight:700')}
          </div>` : ''}
        ${groups.length
          ? groups.map((g) => item(
              `${g === cur ? '✓' : '📁'} ${escapeHtml(g)}`, g,
              g === cur ? 'font-weight:800;color:var(--brand-text)' : '')).join('')
          : `<div style="padding:10px 11px;font-size:11.5px;color:var(--text-quaternary);line-height:1.5">
               아직 만든 폴더가 없습니다.<br>아래에서 첫 폴더를 만드세요.</div>`}
        <div style="border-top:1px solid var(--border-subtle);margin-top:5px;padding-top:5px">
          ${item('➕ 새 폴더 만들어 넣기', '__new__', 'color:var(--brand-text);font-weight:700')}
          ${cur ? item('❔ 미분류로 되돌리기', '', 'color:var(--text-tertiary)') : ''}
        </div>
      </div>
    </div>`);

  const rootEl = document.getElementById('mailFolderPicker');
  rootEl.addEventListener('click', (e) => { if (e.target === rootEl) closeFolderPicker(); });

  rootEl.querySelectorAll('.mfp-pick').forEach((b) => {
    b.addEventListener('click', async () => {
      let group = b.dataset.group;
      if (group === '__new__') {
        const name = (prompt('새 거래처 폴더 이름을 적어주세요.\n\n예) 사업개발, Beauty Lyrics USA') || '').trim();
        if (!name) return;
        group = name;
      }
      if (group === cur) { closeFolderPicker(); return; }
      closeFolderPicker();
      await moveMailToFolder(mailId, group, anchor);
    });
  });
}

/** 메일 한 통을 폴더로. 화면은 그 줄만 바꾼다. */
async function moveMailToFolder(mailId, group, anchor) {
  const prevHtml = anchor.innerHTML;
  anchor.innerHTML = '⏳ 옮기는 중';
  anchor.disabled = true;
  try {
    const r = await safeJsonFetch('/api/mail/move-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailIds: [mailId], group }),
    });
    if (!r || !r.success) throw new Error(r?.error || '이동 실패');

    // 폴더 목록은 비우지 않는다 — 비워버리면 바로 다음 줄에서 메뉴를 열었을 때
    // 고를 폴더가 하나도 안 뜬다(화면을 다시 그리지 않으므로 채워질 기회가 없다).
    // 새로 만든 폴더는 즉시 끼워 넣고, 정확한 숫자는 뒤에서 다시 받아온다.
    if (group && _mailGroupsCache && Array.isArray(_mailGroupsCache.groups)
        && !_mailGroupsCache.groups.some((g) => g.group === group)) {
      _mailGroupsCache.groups.push({ group, count: 0, total: 0, fresh: 0, last: null });
    }
    loadMailGroups(true).catch(() => {});

    // 폴더별로 보고 있던 중이라면 이 메일은 더 이상 이 목록에 속하지 않는다.
    // 자리에 남겨두면 없는 것을 보고 있는 셈이라 그때만 다시 그린다.
    const viewingFolder = _inboxState.group && _inboxState.group !== '__none__';
    const leftThisFolder = viewingFolder && group !== _inboxState.group;
    const leftUngrouped = _inboxState.group === '__none__' && group;
    if (leftThisFolder || leftUngrouped) { render(); return; }

    anchor.disabled = false;
    anchor.dataset.cur = group;
    if (group) {
      anchor.innerHTML = `📁 ${escapeHtml(group)}`;
      anchor.style.cssText = `background:#ecfdf5;color:#047857;border:1px solid #6ee7b7;
        border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700;margin-right:5px;cursor:pointer`;
      anchor.title = `거래처 폴더 · 직접 지정\n눌러서 다른 폴더로 옮깁니다`;
      // 방금 넣은 것은 초록으로 잠깐 표시했다가 평소 색으로 돌아간다 —
      // 위에서부터 훑어 내려갈 때 어디까지 했는지 보인다
      setTimeout(() => {
        anchor.style.cssText = `background:var(--bg-surface-alt);color:var(--text-secondary);
          border:1px solid var(--border-subtle);border-radius:5px;padding:1px 6px;
          font-size:10px;font-weight:700;margin-right:5px;cursor:pointer`;
      }, 2200);
    } else {
      anchor.innerHTML = '❔ 폴더 지정';
      anchor.style.cssText = `color:var(--text-tertiary);background:var(--bg-surface);
        border:1px dashed var(--border-strong);border-radius:5px;padding:1px 6px;
        font-size:10px;font-weight:700;margin-right:5px;cursor:pointer`;
    }
  } catch (e) {
    anchor.disabled = false;
    anchor.innerHTML = prevHtml;
    alert(`폴더 이동 실패: ${(e && e.message) || e}`);
  }
}

function bindInboxActions() {
  // 계정 전환 — 목록·배지가 모두 그 계정 기준으로 바뀐다
  els.content.querySelectorAll('.inbox-account').forEach((btn) => {
    btn.addEventListener('click', () => {
      _inboxState.accountId = btn.dataset.accountId;
      _inboxState.accountPicked = true;   // 사용자가 직접 골랐으면 기본계정으로 되돌리지 않는다
      _inboxState.page = 1;
      _inboxState.group = '';       // 계정이 바뀌면 폴더 선택도 초기화
      _mailGroupsCache = null;      // 폴더 목록은 계정별로 다르다
      loadMailCounts(true);
      render();
    });
  });

  // 분류 기준 설명 펼치기/접기
  els.content.querySelector('#clsHelpBtn')?.addEventListener('click', () => {
    const p = els.content.querySelector('#clsHelpPanel');
    if (p) p.style.display = p.style.display === 'none' ? '' : 'none';
  });

  // ── 목록에서 여러 통 골라 휴지통으로 / 되돌리기 ──
  // 한 통씩 상세를 열어 치우면 수십 통 정리에 한참 걸린다.
  const selected = new Set();
  const bar = els.content.querySelector('#inboxBulkBar');
  const syncBar = () => {
    if (!bar) return;
    bar.style.display = selected.size ? 'flex' : 'none';
    const c = els.content.querySelector('#inboxSelCount');
    if (c) c.textContent = String(selected.size);
  };
  els.content.querySelectorAll('.inbox-check').forEach((cb) => {
    // 체크박스 클릭이 행 클릭(상세 열기)까지 번지지 않게 막는다
    cb.addEventListener('click', (ev) => ev.stopPropagation());
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(cb.dataset.mailId); else selected.delete(cb.dataset.mailId);
      syncBar();
    });
  });
  els.content.querySelector('#inboxCheckAll')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const on = ev.target.checked;
    els.content.querySelectorAll('.inbox-check').forEach((cb) => {
      cb.checked = on;
      if (on) selected.add(cb.dataset.mailId); else selected.delete(cb.dataset.mailId);
    });
    syncBar();
  });
  els.content.querySelector('#inboxSelClear')?.addEventListener('click', () => {
    selected.clear();
    els.content.querySelectorAll('.inbox-check, #inboxCheckAll').forEach((cb) => { cb.checked = false; });
    syncBar();
  });

  const bulkTrash = async (restore) => {
    const ids = [...selected];
    if (!ids.length) return;
    const btn = els.content.querySelector(restore ? '#inboxRestoreBtn' : '#inboxTrashBtn');
    if (btn) { btn.disabled = true; btn.textContent = '처리 중…'; }
    try {
      const r = await safeJsonFetch('/api/mail/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailIds: ids, restore }),
      });
      selected.clear();
      _mailGroupsCache = null;       // 폴더별 통수가 바뀐다
      await loadMailCounts(true);
      render();
      // 결과는 화면 숫자로 바로 보이므로 alert 은 되돌리기 안내만 남긴다
      if (!restore) console.log(`[inbox] ${r.moved}통 휴지통으로`);
    } catch (e) {
      alert(`처리 실패: ${e.message || e}`);
      if (btn) { btn.disabled = false; btn.textContent = restore ? '↩ 받은함으로 되돌리기' : '🗑 휴지통으로'; }
    }
  };
  // 고른 메일을 거래처 폴더로 옮긴다
  els.content.querySelector('#inboxMoveGroup')?.addEventListener('change', async (ev) => {
    const sel = ev.target;
    const val = sel.value;
    if (!val || !selected.size) { sel.selectedIndex = 0; return; }
    const group = val === '__none__' ? '' : val;
    const label = group || '미분류';
    if (!confirm(`선택한 ${selected.size}통을 [${label}] 로 옮깁니다.

직접 옮긴 분류는 자동 재분류가 덮지 않습니다.`)) {
      sel.selectedIndex = 0;
      return;
    }
    try {
      const r = await safeJsonFetch('/api/mail/move-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailIds: [...selected], group }),
      });
      selected.clear();
      _mailGroupsCache = null;      // 폴더별 통수가 바뀐다
      await loadMailCounts(true);
      render();
      console.log(`[inbox] ${r.moved}통 → ${r.group}`);
    } catch (e) {
      alert(`이동 실패: ${e.message || e}`);
      sel.selectedIndex = 0;
    }
  });

  els.content.querySelector('#inboxTrashBtn')?.addEventListener('click', () => bulkTrash(false));
  els.content.querySelector('#inboxRestoreBtn')?.addEventListener('click', () => bulkTrash(true));

  // 제목 앞 폴더 태그 → 그 자리에서 폴더 지정
  els.content.querySelectorAll('.mail-folder-tag').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();          // 행 클릭(메일 상세)까지 번지지 않게
      openFolderPicker(btn);
    });
  });

  // 오늘 온 메일 — 폴더·휴지통과 같은 자리를 두고 다투는 축이라 서로 끈다
  els.content.querySelector('#inboxTodayBtn')?.addEventListener('click', () => {
    const on = !_inboxState.today;
    _inboxState.today = on;
    if (on) { _inboxState.group = ''; _inboxState.trashed = false; }
    _inboxState.page = 1;
    render();
  });

  // 거래처 폴더 선택 (휴지통 포함)
  els.content.querySelectorAll('.inbox-group').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.group;
      _inboxState.today = false;      // 폴더를 고르면 오늘 보기는 꺼진다
      if (g === '__trash__') {
        // 휴지통은 폴더 필터가 아니라 "치운 것만" 이라는 별도 축이다
        _inboxState.trashed = true;
        _inboxState.group = '';
      } else {
        _inboxState.trashed = false;
        _inboxState.group = g;
      }
      _inboxState.page = 1;
      render();
    });
  });

  // 거래처 재분류 — 학습 기반 · AI 미사용이라 비용이 없다
  els.content.querySelector('#inboxRegroupBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '분류 중…';
    try {
      const r = await safeJsonFetch('/api/mail/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: _inboxState.accountId || 'all' }),
      });
      alert(
        `미분류 ${r.scanned}통 검사 → ${r.classified}통 분류\n\n`
        + `· 발신자 이력으로 ${r.bySender}통\n`
        + `· 제목의 거래처명으로 ${r.byName}통\n\n`
        + `학습된 발신자 ${r.learnedSenders}명 · 거래처 ${r.knownGroups}곳`,
      );
      _mailGroupsCache = null;
      render();
    } catch (err) {
      alert(`재분류 실패: ${err.message || err}`);
      btn.disabled = false;
      btn.textContent = '🔄 미분류 메일 정리하기';
    }
  });

  els.content.querySelectorAll('.inbox-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.filterKey;
      const v = btn.dataset.filterVal;
      // 같은 값을 다시 누르면 해제
      _inboxState[k] = _inboxState[k] === v ? '' : v;
      _inboxState.page = 1;
      render();
    });
  });
  const search = els.content.querySelector('#inboxSearch');
  if (search) {
    search.addEventListener('change', (e) => {
      _inboxState.q = e.target.value.trim();
      _inboxState.page = 1;
      render();
    });
  }
  els.content.querySelector('#inboxIngestBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '가져오는 중…';
    try {
      const r = await safeJsonFetch('/api/mail/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 지금 보고 있는 메일함을 수집한다 ('전체' 면 등록된 계정 모두)
        body: JSON.stringify({ accountId: _inboxState.accountId || 'all' }),
      });
      const s = r.summary || {};
      const msg = `조회 ${s.fetched || 0} · 신규 ${s.inserted || 0} · 리드 매칭 ${s.matched || 0}`
        + (s.movedToReplied ? ` · 답장옴 이동 ${s.movedToReplied}` : '');
      // 실패 건수는 반드시 노출한다 — 신규 건수만 보면 전량 실패해도 정상처럼 읽힌다
      alert(r.errors?.length ? `${msg}\n\n⚠ 오류 ${r.errors.length}건:\n${r.errors.join('\n')}` : msg);
      invalidateServerPage?.();
      _inboxState.page = 1;
      render();
    } catch (err) {
      alert(`수집 실패: ${err.message || err}`);
      btn.disabled = false;
      btn.textContent = '📥 메일 가져오기';
    }
  });
  els.content.querySelectorAll('[data-goto-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.gotoView;
      render();
    });
  });

  // ── AI 분석 대기 통수·예상 비용 표시 (조회는 과금 없음) ──
  const statusEl = els.content.querySelector('#inboxAiStatus');
  const analyzeBtn = els.content.querySelector('#inboxAnalyzeBtn');
  if (statusEl && analyzeBtn) {
    safeJsonFetch('/api/mail/analyze').then((r) => {
      if (!r || !r.success) return;
      if (!r.hasApiKey) {
        statusEl.textContent = '· AI 미설정 (ANTHROPIC_API_KEY 없음)';
        analyzeBtn.disabled = true;
        return;
      }
      if (!r.pendingTotal) {
        statusEl.textContent = '· AI 분석 대기 없음';
        analyzeBtn.disabled = true;
        return;
      }
      // 실행 전에 금액을 먼저 보여준다 — 눌러보고 나서 비용을 알게 되면 안 된다
      statusEl.textContent =
        `· AI 분석 대기 ${r.pendingTotal}통 (이번 ${r.batchSize}통 · 예상 ₩${r.estimate.krw} · ${r.estimate.modelLabel})`;
      analyzeBtn.dataset.batch = String(r.batchSize);
      analyzeBtn.dataset.krw = String(r.estimate.krw);
    }).catch(() => { /* AI 미설정이어도 메일함은 동작해야 한다 */ });

    analyzeBtn.addEventListener('click', async () => {
      const n = analyzeBtn.dataset.batch || '?';
      const won = analyzeBtn.dataset.krw || '?';
      if (!confirm(`${n}통을 AI 분석합니다.\n한글 번역 + 요약 + 기한 추출\n\n예상 비용: ₩${won}\n\n진행할까요?`)) return;
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = '분석 중…';
      try {
        const r = await safeJsonFetch('/api/mail/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const fails = (r.results || []).filter((x) => x.error);
        alert(
          `분석 ${r.analyzed}통 · 실패 ${r.failed}통 · 남은 ${r.remaining}통\n실제 비용 ₩${r.totalKrw}`
          + (fails.length ? `\n\n⚠ 실패 사유:\n${fails.slice(0, 3).map((x) => x.error).join('\n')}` : ''),
        );
        render();
      } catch (e) {
        alert(`분석 실패: ${e.message || e}`);
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '🧠 AI 분석';
      }
    });
  }
}

// ── 기한 관리 ─────────────────────────────────────────────────
// 회신 기한은 로컬 분석(무료)에서도 추출되므로 AI 크레딧 없이 동작한다.
async function renderDeadlinesPage() {
  els.content.innerHTML = `<div class="inline-loader">기한 불러오는 중…</div>`;
  let data;
  try {
    // 대표 계정 기준으로 — 사이드바 배지와 같은 계정을 봐야 숫자가 맞는다
    await loadInboxAccounts();
    data = await safeJsonFetch(
      `/api/mail/deadlines?accountId=${encodeURIComponent(currentMailboxAccountId())}`,
    );
  } catch (e) {
    els.content.innerHTML = `<div class="empty-detail"><h3>불러오기 실패</h3><p>${escapeHtml(String(e.message || e))}</p></div>`;
    return;
  }
  if (!data || !data.success) {
    els.content.innerHTML = `<div class="empty-detail"><h3>조회 실패</h3><p>${escapeHtml(data?.error || '')}</p></div>`;
    return;
  }

  const g = data.groups || {};
  const dday = (v) => {
    const d = new Date(v);
    const days = Math.ceil((d.setHours(12, 0, 0, 0) - new Date().setHours(12, 0, 0, 0)) / 86400000);
    if (days < 0) return { text: `${Math.abs(days)}일 지남`, color: '#b91c1c' };
    if (days === 0) return { text: '오늘', color: '#b91c1c' };
    if (days <= 3) return { text: `D-${days}`, color: '#c2410c' };
    return { text: `D-${days}`, color: '#475569' };
  };

  const section = (title, items, tone) => {
    if (!items.length) return '';
    return `
      <div style="margin-bottom:22px">
        <h3 style="font-size:14px;margin-bottom:8px;color:${tone}">${title} <span style="color:var(--text-tertiary);font-weight:400">${items.length}건</span></h3>
        <div class="table-wrap"><table><tbody>
          ${items.map((m) => {
            const d = dday(m.deadline);
            return `<tr>
              <td style="width:92px;white-space:nowrap;font-weight:800;color:${d.color}">${d.text}</td>
              <td style="width:110px;white-space:nowrap;color:var(--text-tertiary);font-size:12px">
                ${new Date(m.deadline).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
              </td>
              <td>
                <div style="font-size:13px;color:var(--text-primary)">${escapeHtml(String(m.subject || '').slice(0, 70))}</div>
                <div style="font-size:11px;color:var(--text-tertiary)">
                  ${escapeHtml(m.from?.address || '')}
                  ${m.deadlineText ? ` · "${escapeHtml(m.deadlineText)}"` : ''}
                </div>
              </td>
              <td style="width:150px">${m.leadId
                ? `<button type="button" class="conversation-btn" data-conv-lead="${escapeAttr(m.leadId)}"
                     style="padding:3px 9px;font-size:11px;border:1px solid #16a34a;border-radius:99px;
                            background:#16a34a;color:#fff;font-weight:700;cursor:pointer">💬 ${escapeHtml(String(m.company || '대화').slice(0, 14))}</button>`
                : '<span style="font-size:11px;color:var(--text-quaternary)">리드 미연결</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody></table></div>
      </div>`;
  };

  const totalN = (g.overdue?.length || 0) + (g.soon?.length || 0) + (g.later?.length || 0);
  els.content.innerHTML = totalN
    ? `
      <div style="margin-bottom:16px;font-size:12px;color:var(--text-tertiary)">
        회신 기한이 잡힌 메일 ${totalN}건 · 기한은 본문에서 자동 추출됩니다.
      </div>
      ${section('🔴 기한 지남', g.overdue || [], '#b91c1c')}
      ${section('🟠 7일 이내', g.soon || [], '#c2410c')}
      ${section('⚪ 이후', g.later || [], 'var(--text-secondary)')}`
    : `<div class="empty-detail"><h3>기한이 잡힌 메일이 없습니다</h3>
         <p>상대가 "by Friday", "3영업일 내" 같은 표현을 쓰면 자동으로 여기에 모입니다.</p></div>`;
}


/**
 * 예약된 발송을 발송함 화면에 펼쳐 보여준다.
 *
 * "언제 · 어디로 나가는가"가 안 보이면 예약은 그냥 블랙박스다.
 * 날짜별로 묶어서, 그 날 나갈 회사를 이름까지 늘어놓는다.
 */
// ── AI 번역 (화면 어디서나) ───────────────────────────────────
//
// 화면 곳곳에 영문이 그대로 남아 있다 — 메일 제목·본문, 리드 근거 문장 등.
// 전부 미리 번역해 두면 안 볼 것까지 돈을 내게 되므로 **누른 것만** 번역한다.
//
// 쓰는 법: 번역이 필요한 영문 옆에 translateBtnHtml(원문) 을 넣으면 끝이다.
// 클릭 처리는 아래 위임 핸들러가 맡으므로 화면마다 바인딩할 필요가 없다.

// 같은 문장을 두 번 누르면 돈이 두 번 나간다 → 세션 동안 기억해 둔다
var _trCache = new Map();
var _trSeq = 0;

/** 이 문자열이 번역할 만한 외국어인가 (한글이 이미 많으면 버튼을 띄우지 않는다) */
function needsTranslation(text) {
  const s = String(text || '').trim();
  if (s.length < 12) return false;
  const ko = (s.match(/[가-힣]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  return latin > 20 && ko / Math.max(1, ko + latin) < 0.25;
}

/**
 * 원문 옆에 붙일 [🌐 AI 번역] 버튼.
 * @param text  번역할 원문
 * @param opts  {inline:true} 면 작은 글씨 인라인 버튼
 */
function translateBtnHtml(text, opts) {
  const s = String(text || '');
  if (!needsTranslation(s)) return '';
  const id = 'tr' + (++_trSeq);
  // 원문을 DOM 에 실어두면 클릭 시 다시 찾을 필요가 없다
  window.__trText = window.__trText || {};
  window.__trText[id] = s;
  const small = opts && opts.inline;
  return `<button type="button" class="ai-translate-btn" data-tr-id="${id}"
    style="margin-left:6px;padding:${small ? '1px 7px' : '3px 9px'};font-size:${small ? '10.5' : '11'}px;
           font-weight:700;border:1px solid #c7d2fe;border-radius:99px;background:#eef2ff;
           color:#4338ca;cursor:pointer;white-space:nowrap;vertical-align:middle"
    title="이 부분만 AI 로 한국어 번역합니다 (누를 때만 비용 발생)">🌐 AI 번역</button>
  <div class="ai-translate-out" data-tr-out="${id}" style="display:none;margin-top:6px;padding:9px 11px;
       background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;font-size:12.5px;
       line-height:1.65;color:#312e81;white-space:pre-wrap"></div>`;
}

// 위임 핸들러 — 어느 화면에서 눌러도 동작한다
document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.ai-translate-btn');
  if (!btn) return;
  ev.preventDefault();
  ev.stopPropagation();          // 메일 행 클릭 등 상위 핸들러가 같이 뜨지 않게

  const id = btn.dataset.trId;
  const out = document.querySelector(`[data-tr-out="${id}"]`);
  const text = (window.__trText || {})[id] || '';
  if (!out || !text) return;

  // 이미 번역해 둔 것이면 다시 부르지 않고 보이기/숨기기만
  if (out.dataset.done === '1') {
    const showing = out.style.display !== 'none';
    out.style.display = showing ? 'none' : '';
    btn.textContent = showing ? '🌐 AI 번역' : '🇰🇷 번역 숨기기';
    return;
  }
  const cached = _trCache.get(text);
  if (cached) {
    out.textContent = cached;
    out.dataset.done = '1';
    out.style.display = '';
    btn.textContent = '🇰🇷 번역 숨기기';
    return;
  }

  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = '번역 중…';
  try {
    const r = await safeJsonFetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    _trCache.set(text, r.translated);
    out.textContent = r.translated;
    out.dataset.done = '1';
    out.style.display = '';
    btn.disabled = false;
    btn.textContent = '🇰🇷 번역 숨기기';
  } catch (e) {
    out.style.display = '';
    out.textContent = `번역 실패: ${e.message || e}`;
    out.dataset.done = '';
    btn.disabled = false;
    btn.textContent = label;
  }
});

// ── 기존 데이터 ───────────────────────────────────────────────
//
// 클라이언트가 원래 가지고 있던 CSV 업로드분(5천여 건). 대부분 중복 정리로
// 보관함에 들어가 있지만 지운 것이 아니라, "이건 살려서 보내자" 싶은 걸
// 골라 검증 완료로 되돌릴 수 있게 한다.
var _legacy = { batch: '', page: 1, q: '', country: '', sel: new Set() };

// 올린 데이터 화면 위쪽 작업 줄 — 올리기 / AI 검증 / 직접 검토.
// 숫자는 서버에서 받아 나중에 채운다(_legacyCounts). 브라우저가 들고 있는
// 목록으로 세면 화면에 뜬 한 페이지만 세어져서, 800건인데 50건이라고 적힌다.
var _legacyCounts = null;

function legacyActionBarHtml() {
  const c = _legacyCounts;
  const aiN = c ? c.target : null;
  const cost = c ? c.cost : null;

  const card = (id, icon, title, desc, accent, disabled) => `
    <button type="button" id="${id}" ${disabled ? 'disabled' : ''}
      style="flex:1;min-width:230px;display:flex;align-items:center;gap:13px;text-align:left;
             padding:15px 17px;border-radius:13px;cursor:${disabled ? 'not-allowed' : 'pointer'};
             border:1px solid ${disabled ? 'var(--border-default)' : accent};
             background:var(--bg-surface);opacity:${disabled ? '.5' : '1'};
             box-shadow:${disabled ? 'none' : 'var(--shadow-sm)'}">
      <span style="width:42px;height:42px;flex:none;border-radius:11px;display:flex;align-items:center;
                   justify-content:center;font-size:21px;background:${accent}14">${icon}</span>
      <span style="flex:1;min-width:0">
        <span style="display:block;font-size:14px;font-weight:800;color:var(--text-primary)">${title}</span>
        <span style="display:block;font-size:11.5px;color:var(--text-tertiary);margin-top:2px;line-height:1.5">${desc}</span>
      </span>
    </button>`;

  return `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      ${card('lgImportBtn', '⬆', '엑셀·CSV 올리기',
        '업체 목록 파일을 올립니다. 올린 날짜별 폴더로 들어갑니다.', '#2563eb', false)}
      ${card('lgAiVerifyBtn', '🧠', 'AI 검증 시작',
        aiN === null ? '대상을 세는 중…'
          : aiN === 0 ? '검증할 곳이 없습니다 — 모두 끝났습니다'
          : `아직 안 본 <b style="color:var(--text-primary)">${aiN.toLocaleString()}곳</b>을 한 번에 · 약 ₩${cost.krw.toLocaleString()}`,
        '#7c3aed', aiN === 0)}
      ${card('lgDirectReviewBtn', '🔎', '직접 검토 시작',
        '한 회사씩 카드로 보며 보낼 곳인지 고릅니다.', '#059669', false)}
    </div>`;
}

/**
 * 올린 데이터 AI 검증 — 20건씩 끊어 끝까지 돌린다.
 *
 * 누를 때마다 대상 건수만큼 Claude 요금이 나가는 버튼이라, 세 가지를 지킨다.
 *   1) 건수는 서버에서 센 값만 쓴다 (브라우저 목록으로 세면 틀린다)
 *   2) 시작 전에 건수와 예상 요금을 그대로 보여주고 확인을 받는다
 *   3) 도는 동안 어디까지 갔는지 보여주고, 중간에 멈출 수 있게 한다
 */
var _legacyAiStop = false;

async function runLegacyAiVerify() {
  if (!_legacyCounts) await loadLegacyCounts();
  const c = _legacyCounts;
  if (!c || !c.target) { alert('AI 검증할 곳이 없습니다.'); return; }

  const ok = confirm(
    `🧠 AI 검증을 시작합니다.\n\n` +
    `대상       ${c.target.toLocaleString()}곳 (아직 AI가 안 본 곳)\n` +
    `예상 요금  약 ₩${c.cost.krw.toLocaleString()} (${c.cost.model})\n` +
    (c.korea ? `제외       한국 기업 ${c.korea.toLocaleString()}곳\n` : '') +
    `\n판정 결과에 따라 자동으로 나뉩니다.\n` +
    `  · K-뷰티 바이어  → [AI 검증 완료] 로 이동\n` +
    `  · 무관           → [보관함] 으로 이동\n` +
    `  · 애매함         → 그대로 두고 직접 검토 대상\n\n` +
    `메일은 보내지 않습니다. 진행할까요?`,
  );
  if (!ok) return;

  _legacyAiStop = false;
  const bar = document.getElementById('lgAiVerifyBtn');
  if (bar) bar.disabled = true;

  // 진행 상황을 작업 줄 자리에 그린다
  const host = document.createElement('div');
  host.id = 'lgAiProgress';
  host.style.cssText = `margin-bottom:14px;padding:17px 20px;border-radius:13px;
    border:1px solid #7c3aed;background:#faf5ff`;
  els.content.prepend(host);

  const paint = (done, moved, note) => {
    const pct = c.target ? Math.min(100, Math.round((done / c.target) * 100)) : 0;
    host.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <span style="font-size:20px">🧠</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:800;color:#5b21b6">AI 검증 중…</div>
          <div style="font-size:11.5px;color:#7c3aed;margin-top:1px">
            ${done.toLocaleString()} / ${c.target.toLocaleString()}곳 · ${note || '진행 중'}
          </div>
        </div>
        <button type="button" id="lgAiStop"
          style="padding:7px 15px;font-size:12px;font-weight:700;border:1px solid #c4b5fd;
                 border-radius:8px;background:#fff;color:#6d28d9;cursor:pointer">■ 여기서 멈추기</button>
      </div>
      <div style="height:9px;background:#ede9fe;border-radius:99px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:#7c3aed;transition:width .3s"></div>
      </div>
      <div style="display:flex;gap:16px;margin-top:10px;font-size:12px;color:#5b21b6">
        <span>✅ 검증 완료로 <b>${moved.verified.toLocaleString()}</b></span>
        <span>📦 보관함으로 <b>${moved.archived.toLocaleString()}</b></span>
        <span>🤔 애매함 <b>${moved.kept.toLocaleString()}</b></span>
      </div>
      <div style="font-size:11px;color:#7c3aed;opacity:.8;margin-top:7px">
        멈춰도 여기까지 판정한 것은 그대로 남습니다. 나중에 이어서 돌릴 수 있습니다.
      </div>`;
    document.getElementById('lgAiStop')?.addEventListener('click', () => {
      _legacyAiStop = true;
      const b = document.getElementById('lgAiStop');
      if (b) { b.disabled = true; b.textContent = '멈추는 중…'; }
    });
  };

  let done = 0;
  const moved = { verified: 0, archived: 0, kept: 0 };
  paint(0, moved, '시작하는 중');

  try {
    // 안전장치 — 대상 수로 계산한 청크보다 넉넉히, 그래도 무한 루프는 막는다
    const maxRounds = Math.min(400, Math.ceil(c.target / 20) + 5);
    for (let i = 0; i < maxRounds; i++) {
      if (_legacyAiStop) break;
      const r = await safeJsonFetch('/api/leads/verify-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'legacy', limit: 20, excludeKorea: true, autoMoveStage: true,
        }),
      });
      if (!r || !r.success) throw new Error(r?.error || 'AI 검증 실패');

      done += r.processed || 0;
      if (r.stageMoves) {
        moved.verified += r.stageMoves.verified || 0;
        moved.archived += r.stageMoves.archived || 0;
        moved.kept += r.stageMoves.kept || 0;
      }
      paint(done, moved, `남은 ${(r.remaining || 0).toLocaleString()}곳`);

      if (!r.hasMore || !r.processed) break;
      await new Promise((res) => setTimeout(res, 300));   // API 부하 완화
    }

    alert(
      `✅ AI 검증 ${_legacyAiStop ? '중단' : '완료'}\n\n` +
      `처리한 곳          ${done.toLocaleString()}\n` +
      `→ AI 검증 완료로   ${moved.verified.toLocaleString()}\n` +
      `→ 보관함으로       ${moved.archived.toLocaleString()}\n` +
      `→ 애매해서 그대로  ${moved.kept.toLocaleString()}\n\n` +
      (moved.kept ? '애매한 곳은 [🔎 직접 검토 시작]에서 직접 보시면 됩니다.' : ''),
    );
  } catch (e) {
    alert(`❌ AI 검증 실패: ${(e && e.message) || e}\n\n여기까지 처리: ${done.toLocaleString()}곳 (그대로 남아 있습니다)`);
  } finally {
    _legacyCounts = null;              // 숫자를 다시 받는다
    _legacy.batch = '';
    invalidateServerPage();
    loadStageCounts(true);
    document.getElementById('lgAiProgress')?.remove();
    renderLegacyPage();
  }
}

/** 작업 줄 숫자 — 서버에서 받아 그 부분만 다시 그린다 */
async function loadLegacyCounts() {
  try {
    const r = await safeJsonFetch('/api/leads/verify-ai/count?scope=legacy');
    if (r && r.success) _legacyCounts = r;
  } catch (e) {
    console.warn('[legacy] AI 검증 대상 조회 실패', e);
  }
}

function bindLegacyActionBar() {
  document.getElementById('lgImportBtn')?.addEventListener('click', () => openImportCsvModal());
  document.getElementById('lgAiVerifyBtn')?.addEventListener('click', () => runLegacyAiVerify());
  document.getElementById('lgDirectReviewBtn')?.addEventListener('click', () => startDirectReview('legacy'));
}

async function renderLegacyPage() {
  els.content.innerHTML = `<div class="inline-loader">불러오는 중…</div>`;
  const p = new URLSearchParams();
  if (_legacy.batch) {
    p.set('batch', _legacy.batch);
    p.set('page', String(_legacy.page));
    p.set('limit', '50');
    if (_legacy.q) p.set('q', _legacy.q);
    if (_legacy.country) p.set('country', _legacy.country);
  }
  let d;
  try {
    d = await safeJsonFetch(`/api/leads/legacy?${p}`);
  } catch (e) {
    els.content.innerHTML = `<div class="empty-detail"><h3>불러오기 실패</h3><p>${escapeHtml(String(e.message || e))}</p></div>`;
    return;
  }

  // ── 배치 목록 ──
  if (d.mode === 'batches') {
    const dateOf = (b) => {
      const m = String(b || '').match(/(\d{4})(\d{2})(\d{2})/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : '날짜 미상';
    };
    els.content.innerHTML = `
      ${legacyActionBarHtml()}
      <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:13px;
                  padding:17px 20px;margin-bottom:15px">
        <div style="font-size:15px;font-weight:800;color:var(--text-primary);margin-bottom:5px">
          올린 파일별로 나뉘어 있습니다
        </div>
        <div style="font-size:12.5px;color:var(--text-secondary);line-height:1.75">
          엑셀로 올린 데이터는 <b>올린 날짜별 폴더</b>로 들어옵니다. 여기서 사라지지 않습니다.<br>
          보낼 만한 곳을 골라 <b>[AI 검증 완료]</b> 로 옮기면 발송 대상이 됩니다.
        </div>
        <div style="margin-top:11px;padding-top:11px;border-top:1px solid var(--border-subtle);
                    font-size:12px;color:var(--text-tertiary);line-height:1.7">
          같은 파일을 여러 번 올려 생긴 <b>완전 사본은 정리했습니다</b>
          (회사명·이메일·국가가 모두 같은 건만). 국가나 연락처가 다르면 다른 업체로 보고 남겨 뒀습니다.
        </div>
      </div>
      <div style="font-size:11px;font-weight:800;color:var(--text-quaternary);letter-spacing:.04em;
                  margin:0 2px 8px">📁 올린 파일 (${d.batches.length}개)</div>
      <div style="display:flex;flex-direction:column;gap:9px">
        ${d.batches.map((b) => `
          <div class="legacy-batch" data-batch="${escapeAttr(b._id || '')}"
               style="border:1px solid var(--border-default);border-radius:12px;padding:15px 18px;
                      background:var(--bg-surface);cursor:pointer;display:flex;align-items:center;gap:16px">
            <span style="font-size:26px">📄</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:800;color:var(--text-primary)">${escapeHtml(dateOf(b._id))} 업로드</div>
              <div style="font-size:11.5px;color:var(--text-tertiary);font-family:monospace">${escapeHtml(b._id || '(배치 없음)')}</div>
            </div>
            <div style="text-align:right;font-size:12px;color:var(--text-secondary);white-space:nowrap">
              <div>이메일 있는 곳 <b style="color:var(--text-primary)">${(b.withEmail || 0).toLocaleString()}</b></div>
              <div style="font-size:11px;color:var(--text-tertiary)">전체 ${(b.total || 0).toLocaleString()} · 보관 ${(b.archived || 0).toLocaleString()}</div>
            </div>
            <span style="color:#2563eb;font-weight:700;font-size:13px">열기 →</span>
          </div>`).join('')}
      </div>`;
    bindLegacyActionBar();
    els.content.querySelectorAll('.legacy-batch').forEach((el) => {
      el.addEventListener('click', () => {
        _legacy.batch = el.dataset.batch;
        _legacy.page = 1; _legacy.q = ''; _legacy.country = ''; _legacy.sel.clear();
        renderLegacyPage();
      });
    });
    // 숫자는 뒤늦게 와도 된다 — 화면이 먼저 뜨는 편이 낫다.
    // 받고 나면 작업 줄만 다시 그린다.
    if (!_legacyCounts) {
      loadLegacyCounts().then(() => {
        if (state.view !== 'tool-legacy' || _legacy.batch) return;
        const bar = els.content.firstElementChild;
        if (!bar) return;
        bar.outerHTML = legacyActionBarHtml();
        bindLegacyActionBar();
      });
    }
    return;
  }

  // ── 배치 안의 리드 목록 ──
  const totalPages = Math.max(1, Math.ceil(d.total / d.limit));
  const rows = d.items.map((l) => {
    const on = _legacy.sel.has(l.leadId);
    const why = l.dedupReason || l.bulkMoveReason || '';
    return `<tr class="legacy-row" data-oid="${escapeAttr(String(l._id))}" data-lead="${escapeAttr(l.leadId)}" style="cursor:pointer">
      <td style="width:34px"><input type="checkbox" class="lg-check" data-lead="${escapeAttr(l.leadId)}" ${on ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer"></td>
      <td>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${escapeHtml(l.Company || '')}</div>
        <div style="font-size:11px;color:var(--text-tertiary)">${escapeHtml(l.Email || '')}</div>
        ${why ? `<div style="font-size:10.5px;color:var(--text-quaternary)">보관 사유 · ${escapeHtml(String(why).slice(0, 70))}</div>` : ''}
      </td>
      <td style="white-space:nowrap;font-size:12px;color:var(--text-secondary)">${escapeHtml(l.Country || '')}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${escapeHtml(String(l.Type || '').slice(0, 26))}</td>
      <td>${websiteLinkHtml(l.WebsiteContact, { short: true })}</td>
      <td style="white-space:nowrap;font-size:11px;color:var(--text-tertiary)">${escapeHtml((STAGE_STYLE[l.stage] || {}).label || l.stage || '')}</td>
    </tr>`;
  }).join('');

  els.content.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      <button class="button secondary" id="lgBack" type="button">← 배치 목록</button>
      <input id="lgSearch" type="search" placeholder="회사·이메일 검색" value="${escapeAttr(_legacy.q)}"
        style="padding:7px 12px;font-size:13px;border:1px solid var(--border-default);border-radius:8px;
               background:var(--bg-surface);color:var(--text-primary);min-width:190px">
      <select id="lgCountry" style="padding:7px 10px;font-size:13px;border:1px solid var(--border-default);
              border-radius:8px;background:var(--bg-surface);color:var(--text-primary)">
        <option value="">전체 국가</option>
        ${(d.countries || []).map((c) => `<option value="${escapeAttr(c._id || '')}" ${_legacy.country === c._id ? 'selected' : ''}>${escapeHtml(c._id || '(없음)')} (${c.n})</option>`).join('')}
      </select>
      <span style="font-size:12px;color:var(--text-tertiary)">총 ${d.total.toLocaleString()}건</span>
      <button type="button" id="lgSelectAll"
        style="font-size:12px;padding:7px 13px;border:1px solid var(--border-default);border-radius:8px;
               background:var(--bg-surface);color:var(--text-secondary);cursor:pointer;white-space:nowrap">
        이 페이지 전체 선택
      </button>
      <button id="lgMove" type="button" disabled
        style="margin-left:auto;font-size:13.5px;font-weight:700;padding:10px 18px;border:none;
               border-radius:9px;white-space:nowrap;background:#94a3b8;color:#fff;cursor:default">
        선택한 <span id="lgCount">0</span>건 → ✅ 검증 완료로
      </button>
    </div>
    <div style="font-size:12px;color:var(--text-tertiary);margin:-4px 2px 10px;line-height:1.6">
      보낼 만한 곳을 체크한 뒤 오른쪽 버튼을 누르면 <b>[✅ 검증 완료]</b> 로 올라갑니다.
      거기서 다시 <b>발송 리스트</b>로 옮겨야 실제 발송 대상이 됩니다.
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>회사</th><th>국가</th><th>업종</th><th>웹사이트</th><th>상태</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div id="lgPager"></div>`;

  const syncBtn = () => {
    const n = _legacy.sel.size;
    const btn = els.content.querySelector('#lgMove');
    els.content.querySelector('#lgCount').textContent = String(n);
    btn.disabled = n === 0;
    // disabled 속성만으로는 눌러도 되는 버튼처럼 보인다 — 색으로도 알린다
    btn.style.background = n ? '#15803d' : '#94a3b8';
    btn.style.cursor = n ? 'pointer' : 'default';
    btn.style.boxShadow = n ? '0 2px 8px rgba(21,128,61,.3)' : 'none';
  };
  els.content.querySelectorAll('.lg-check').forEach((cb) => {
    cb.addEventListener('click', (ev) => ev.stopPropagation());   // 체크가 행 클릭으로 번지지 않게
    cb.addEventListener('change', () => {
      if (cb.checked) _legacy.sel.add(cb.dataset.lead); else _legacy.sel.delete(cb.dataset.lead);
      syncBtn();
    });
  });

  // 행 클릭 → 검증 완료와 같은 상세 팝업.
  // 이 리드들은 화면 목록(baseLeads)에 없어서 _id 로 직접 받아온다.
  els.content.querySelectorAll('.legacy-row').forEach((tr) => {
    tr.addEventListener('click', (ev) => {
      if (ev.target.closest('input, a, button')) return;
      openLeadPopupByObjectId(tr.dataset.oid, tr.dataset.lead);
    });
  });
  syncBtn();

  // 이 페이지에 보이는 것만 토글한다 — 전체 256건을 한 번에 잡으면
  // 확인 없이 옮기게 되고, 되돌리려면 하나씩 빼야 한다.
  els.content.querySelector('#lgSelectAll')?.addEventListener('click', (ev) => {
    const boxes = [...els.content.querySelectorAll('.lg-check')];
    const allOn = boxes.length > 0 && boxes.every((cb) => cb.checked);
    boxes.forEach((cb) => {
      cb.checked = !allOn;
      if (cb.checked) _legacy.sel.add(cb.dataset.lead);
      else _legacy.sel.delete(cb.dataset.lead);
    });
    ev.currentTarget.textContent = allOn ? '이 페이지 전체 선택' : '이 페이지 선택 해제';
    syncBtn();
  });

  els.content.querySelector('#lgBack').addEventListener('click', () => {
    _legacy.batch = ''; _legacy.sel.clear(); renderLegacyPage();
  });
  let t;
  els.content.querySelector('#lgSearch').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { _legacy.q = e.target.value; _legacy.page = 1; renderLegacyPage(); }, 400);
  });
  els.content.querySelector('#lgCountry').addEventListener('change', (e) => {
    _legacy.country = e.target.value; _legacy.page = 1; renderLegacyPage();
  });

  els.content.querySelector('#lgMove').addEventListener('click', async (e) => {
    const ids = [..._legacy.sel];
    if (!confirm(`${ids.length}건을 검증 완료로 옮깁니다.\n\n옮긴 건은 바로 발송 대상이 됩니다.\n진행할까요?`)) return;
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = '이동 중…';
    try {
      const r = await safeJsonFetch('/api/leads/legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: ids }),
      });
      alert(`${r.moved}건을 검증 완료로 옮겼습니다.${r.skipped ? `\n(이메일 없는 ${r.skipped}건은 제외)` : ''}\n\n검증 완료 총 ${r.verified}건`);
      _legacy.sel.clear();
      invalidateServerPage();
      loadStageCounts(true);
      renderLegacyPage();
    } catch (err) {
      alert(`이동 실패: ${err.message || err}`);
      renderLegacyPage();
    }
  });

  const pager = els.content.querySelector('#lgPager');
  if (pager && totalPages > 1) {
    pager.innerHTML = renderPaginationBar(d.page, totalPages, d.total, { compact: true });
    pager.querySelectorAll('[data-page]').forEach((b) => {
      b.addEventListener('click', () => {
        const t2 = parseInt(b.dataset.page);
        if (!Number.isNaN(t2)) { _legacy.page = Math.min(Math.max(1, t2), totalPages); renderLegacyPage(); }
      });
    });
  }
}

// ── 직접 검토 ─────────────────────────────────────────────────
//
// 400여 곳을 표에서 한 줄씩 열고 닫으며 판단하면 지친다.
// 한 회사를 한 화면에 크게 띄우고, 버튼 하나를 누르면 바로 다음으로 넘어간다.
// 키보드(← 검증 실패 / → 메일 보낼곳 / Enter 웹사이트)로도 되어
// 마우스를 놓지 않아도 된다.
//
// 분류 탭은 뺐다. AI 가 이미 한 번 걸러 놓은 목록이라 분류를 또 고르는 것은
// 고를 것만 하나 늘리는 일이었다. 추천 점수 높은 곳부터 내려오므로 도중에
// 그만둬도 값어치 있는 곳은 이미 판단이 끝나 있다.
//
// 판단 기준이 흔들리지 않게 점수가 같으면 국가순으로 내려준다 —
// 스웨덴 20곳을 연달아 보는 편이 매번 다른 나라로 튀는 것보다 덜 지친다.
// decided — 이번에 고른 것을 기억한다 (leadId → 'queued' | 'failed' | 'archived').
//
// [‹ 이전] 으로 돌아가는 이유는 대개 "방금 잘못 눌렀다" 이다. 그때 이 회사를
// 어디로 보냈는지 화면에 보여주지 않으면 되돌아온 의미가 없다.
// 진행 수도 이 크기로 센다 — 하나를 두 번 고쳐도 2건으로 세지 않는다.
// skip — 지금까지 건너뛴 만큼의 오프셋.
//
// 이게 없으면 [다음 ›] 으로만 30곳을 넘긴 뒤 묶음을 새로 받을 때 똑같은 30곳이
// 다시 온다. 건너뛰기는 DB 를 건드리지 않아 서버 대기열이 그대로이고 정렬도
// 고정이기 때문이다. 판정을 하나도 안 하면 같은 카드 30장을 영원히 돌게 된다.
// 판정한 건은 대기열에서 빠져 뒤가 당겨지므로, 건너뛴 수만큼만 밀어준다.
var _review = { queue: [], idx: 0, skip: 0, source: '', from: '', remaining: 0, queued: 0, failed: 0, decided: new Map(), busy: false };

// 분류 이름 — 화면은 한글, 값은 DB 그대로 (Lead.Category)
var REVIEW_CATEGORY = {
  'Distributor':        '유통사',
  'Brand/Manufacturer': '브랜드·제조사',
  'Retail Chain':       '리테일 체인',
  'Online Store':       '온라인몰',
  'Retailer':           '매장·편집숍',
  'Clinic':             '클리닉',
  'Other':              '기타',
};

/**
 * 다음 묶음(30곳)을 받아온다.
 *
 * 고른 회사는 서버 대기열에서 빠지므로, 다시 받으면 아직 안 고른 것만 온다.
 * 건너뛴 회사는 그대로 남아 있어 다시 나온다 — 건너뛰기는 "나중에" 라는 뜻이다.
 */
function reviewScopeParams() {
  // 목록에서 검색·국가로 좁혀 놓고 들어왔으면 그 범위만 본다.
  // 12곳을 보다 눌렀는데 418곳이 나오면 무엇을 보고 있는지 알 수 없다.
  //
  // source 는 어느 풀을 검토하는지 — [AI 검증 완료] 인지 [올린 데이터] 인지.
  // 올린 데이터에서 들어오면 검색·국가는 따라가지 않는다(그 화면의 조건이 아니다).
  if (_review.source === 'legacy') return { source: 'legacy' };
  return {
    q: (state.query || '').trim(),
    country: state.country && state.country !== 'All' ? state.country : '',
  };
}

async function loadReviewBatch(wrapped) {
  els.content.innerHTML = `<div class="inline-loader">불러오는 중…</div>`;
  const scope = reviewScopeParams();
  const p = new URLSearchParams({ limit: '30', skip: String(_review.skip || 0) });
  if (scope.q) p.set('q', scope.q);
  if (scope.country) p.set('country', scope.country);
  if (scope.source) p.set('source', scope.source);

  const d = await safeJsonFetch(`/api/leads/review?${p}`);
  // safeJsonFetch 는 4xx·5xx 에도 예외를 던지지 않고 본문을 그대로 준다.
  // 이 줄이 없으면 서버 오류가 "items 0건" 으로 읽혀 🎉 검토 완료 화면이 뜨고,
  // 누적 숫자까지 0 으로 덮어써진다 — 418곳이 남아 있는데 다 끝난 줄 알게 된다.
  if (!d || !d.success) throw new Error(d?.error || '검토 목록을 불러오지 못했습니다');

  // 끝까지 훑었는데 비었다면, 앞에서 건너뛴 것들이 아직 남아 있다.
  // 오프셋을 0 으로 되돌려 한 바퀴 더 돈다 (한 번만 — 진짜 0건이면 그대로 끝낸다).
  if (!(d.items || []).length && (_review.skip || 0) > 0 && !wrapped) {
    _review.skip = 0;
    return loadReviewBatch(true);
  }

  _review.queue = d.items || [];
  _review.idx = 0;
  _review.remaining = d.remaining || 0;
  _review.queued = d.queued || 0;
  _review.failed = d.failed || 0;
}

async function renderReviewPage() {
  if (!_review.queue.length || _review.idx >= _review.queue.length) {
    try {
      await loadReviewBatch();
    } catch (e) {
      if (state.view !== 'tool-review') return;
      els.content.innerHTML = `
        <div class="empty-detail" style="padding:40px 24px">
          <div style="font-size:44px;margin-bottom:8px">⚠️</div>
          <h3>목록을 불러오지 못했습니다</h3>
          <p>${escapeHtml(String(e.message || e))}</p>
          <p style="margin-top:6px;color:var(--text-tertiary);font-size:12.5px">
            아직 아무것도 사라지지 않았습니다. 잠시 뒤 다시 시도해 주세요.</p>
          <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <button type="button" id="rvRetry"
              style="padding:11px 22px;border:none;border-radius:10px;background:#2563eb;
                     color:#fff;font-size:13.5px;font-weight:800;cursor:pointer">다시 시도</button>
            <button type="button" id="rvExitErr"
              style="padding:11px 22px;border:1px solid var(--border-default);border-radius:10px;
                     background:var(--bg-surface);color:var(--text-secondary);font-size:13.5px;
                     font-weight:700;cursor:pointer">← 돌아가기</button>
          </div>
        </div>`;
      els.content.querySelector('#rvRetry')?.addEventListener('click', () => renderReviewPage());
      els.content.querySelector('#rvExitErr')?.addEventListener('click', () => exitDirectReview());
      return;
    }
    // 불러오는 사이 사이드바로 나갔을 수 있다.
    // 그대로 그리면 지금 보고 있는 화면 위에 검토 카드가 덮어 그려진다.
    if (state.view !== 'tool-review') return;
  }

  const done = _review.decided.size;
  const lead = _review.queue[_review.idx];
  if (!lead) {
    els.content.innerHTML = `
      <div class="empty-detail" style="padding:44px 24px">
        <div style="font-size:52px;margin-bottom:10px">🎉</div>
        <h3>검토할 회사가 없습니다</h3>
        <p>이번에 <b>${done.toLocaleString()}곳</b>을 판단하셨습니다.</p>
        <p style="margin-top:6px">
          메일 보낼곳으로 고른 <b>${_review.queued.toLocaleString()}곳</b>은
          [📤 발송 관리 → 보낼 메일]에서 보낼 수 있습니다.
        </p>
        <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button type="button" id="rvGoOutbox"
            style="padding:11px 22px;border:none;border-radius:10px;background:#2563eb;
                   color:#fff;font-size:13.5px;font-weight:800;cursor:pointer">📤 발송 관리로 가기</button>
          <button type="button" id="rvExitEmpty"
            style="padding:11px 22px;border:1px solid var(--border-default);border-radius:10px;
                   background:var(--bg-surface);color:var(--text-secondary);font-size:13.5px;
                   font-weight:700;cursor:pointer">←
            ${_review.source === 'legacy' ? '올린 데이터로' : 'AI 검증 완료로'}</button>
        </div>
      </div>`;
    els.content.querySelector('#rvGoOutbox')?.addEventListener('click', () =>
      document.querySelector('.nav-item[data-view="pipeline-contacted"]')?.click());
    els.content.querySelector('#rvExitEmpty')?.addEventListener('click', () => exitDirectReview());
    return;
  }

  const totalKnown = _review.remaining + done;
  const pct = totalKnown ? Math.round((done / totalKnown) * 100) : 0;
  const site = lead.WebsiteContact || '';

  // 이 회사를 이번에 이미 골랐나 — [‹ 이전] 으로 돌아온 경우
  const picked = _review.decided.get(lead.leadId) || '';
  const atFirst = _review.idx === 0;
  const row = (label, value) => value
    ? `<div style="display:flex;gap:12px;padding:7px 0;border-bottom:1px solid var(--border-default)">
         <span style="width:76px;flex:none;font-size:12px;color:var(--text-tertiary);font-weight:700">${label}</span>
         <span style="font-size:13.5px;color:var(--text-primary);word-break:break-word">${value}</span>
       </div>` : '';

  els.content.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <!-- 나가는 길. 이 화면은 목록을 덮고 뜨는데 [이전]/[다음]은 회사를
           넘기는 버튼이라, 이게 없으면 검토를 그만두고 싶어도 사이드바를
           다시 누르는 수밖에 없었다. 그것도 어디서 들어왔는지는 안 남는다. -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <button type="button" id="rvExit"
          title="검토를 멈추고 돌아갑니다 (Esc). 여기까지 고른 것은 그대로 저장돼 있습니다."
          style="display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:9px;
                 border:1px solid var(--border-default);background:var(--bg-surface);
                 color:var(--text-secondary);font-size:12.5px;font-weight:700;cursor:pointer">
          ← ${_review.source === 'legacy' ? '올린 데이터로' : 'AI 검증 완료로'}
        </button>
        <span style="font-size:11.5px;color:var(--text-quaternary)">
          여기까지 고른 것은 이미 저장돼 있습니다 · Esc 로도 나갈 수 있습니다
        </span>
      </div>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        <span style="font-size:13px;font-weight:800;color:var(--text-primary)">
          ${done.toLocaleString()} / ${totalKnown.toLocaleString()}
        </span>
        <div style="flex:1;height:7px;background:var(--bg-surface-alt);border-radius:99px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:#2563eb;transition:width .2s"></div>
        </div>
        <span style="font-size:12px;color:#2563eb;font-weight:700">보낼곳 ${_review.queued.toLocaleString()}</span>
        <span style="font-size:12px;color:var(--text-tertiary)">실패 ${_review.failed.toLocaleString()}</span>
      </div>
      <div style="font-size:11px;color:var(--text-quaternary);margin-bottom:14px">
        키보드 — ← 검증 실패 · → 메일 보낼곳 · Backspace 이전 회사 · Enter 웹사이트 열기 · Esc 나가기
        &nbsp;|&nbsp; 실패로 빼도 지워지지 않습니다. [❌ 검증 실패]에서 되돌릴 수 있습니다.
      </div>

      <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:16px;
                  padding:24px 26px;box-shadow:0 2px 10px rgba(0,0,0,0.05)">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:4px">
          <h2 style="margin:0;font-size:23px;font-weight:800;color:var(--text-primary);line-height:1.25;flex:1">
            ${escapeHtml(lead.Company || '(회사명 없음)')}
          </h2>
          <span style="flex:none;padding:4px 11px;background:var(--bg-surface-alt);border-radius:99px;
                       font-size:12px;font-weight:700;color:var(--text-secondary)">${escapeHtml(lead.Country || '—')}</span>
          ${lead.Category ? `<span style="flex:none;padding:4px 11px;background:#eef2ff;border-radius:99px;
                       font-size:12px;font-weight:700;color:#4338ca">${escapeHtml(REVIEW_CATEGORY[lead.Category] || lead.Category)}</span>` : ''}
          ${lead.recoScore ? `<span title="발송 우선순위 점수" style="flex:none;padding:4px 10px;background:#ecfdf5;
                       border-radius:99px;font-size:12px;font-weight:800;color:#047857">추천 ${lead.recoScore}</span>` : ''}
        </div>
        ${site ? `<a href="${escapeAttr(urlFor(site))}" target="_blank" rel="noreferrer"
             style="font-size:13px;color:#2563eb;text-decoration:none;word-break:break-all">${escapeHtml(site)} ↗</a>` : ''}

        <div style="margin-top:16px">
          ${row('이메일', escapeHtml(lead.Email || ''))}
          ${row('업종', escapeHtml(lead.TypeKo || lead.Type || ''))}
          ${row('전화', escapeHtml(lead.Phone || ''))}
          ${row('취급', escapeHtml(String(lead.BrandsChannels || '').slice(0, 300)))}
        </div>

        ${lead.Evidence || lead.EvidenceKo ? `
          <div style="margin-top:16px;padding:13px 15px;background:var(--bg-surface-alt);border-radius:10px">
            <div style="font-size:10.5px;font-weight:800;color:var(--text-tertiary);
                        text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">왜 이 회사인가</div>
            <!-- 한국어본이 있으면 그것을 보여준다. 쓰는 사람이 전부 한국인이라
                 영문을 매번 번역 버튼으로 여는 건 손이 많이 간다. -->
            <div style="font-size:13px;line-height:1.65;color:var(--text-secondary);white-space:pre-wrap">${escapeHtml(String(lead.EvidenceKo || lead.Evidence).slice(0, 700))}</div>
            ${lead.EvidenceKo ? '' : translateBtnHtml(String(lead.Evidence).slice(0, 700), { inline: true })}
            ${lead.Sources ? `<div style="margin-top:8px;font-size:11.5px;color:var(--text-quaternary);word-break:break-all">
              출처 · ${escapeHtml(String(lead.Sources).slice(0, 300))}</div>` : ''}
          </div>` : ''}

        ${(lead.recoReasons || []).length ? `
          <div style="margin-top:12px;display:flex;gap:5px;flex-wrap:wrap">
            ${lead.recoReasons.map((r) => `<span style="padding:3px 9px;background:var(--bg-surface-alt);
              border-radius:99px;font-size:11px;color:var(--text-secondary)">${escapeHtml(r)}</span>`).join('')}
          </div>` : ''}

        <!-- 이미 고른 회사로 되돌아온 경우 — 무엇으로 골랐는지 먼저 알려준다.
             안 그러면 되돌아와서 또 같은 고민을 하게 된다. -->
        ${picked ? `
          <div style="margin-top:18px;padding:11px 14px;border-radius:10px;display:flex;
                      align-items:center;gap:8px;font-size:12.5px;font-weight:700;
                      background:${picked === 'queued' ? '#eff6ff' : '#fef2f2'};
                      color:${picked === 'queued' ? '#1d4ed8' : '#b91c1c'};
                      border:1px solid ${picked === 'queued' ? '#bfdbfe' : '#fecaca'}">
            <span style="font-size:15px">${picked === 'queued' ? '✉' : '🚫'}</span>
            이 회사는 <b>${picked === 'queued' ? '메일 보낼곳' : '검증 실패'}</b>으로 골랐습니다.
            <span style="font-weight:500;opacity:.8">아래에서 다시 고르면 바뀝니다.</span>
          </div>` : ''}

        <!-- 버튼 글자를 결과 그대로 적는다. "승인/제외" 로는 누른 뒤 이 회사가
             어디로 가는지 알 수 없어서, 목록 이름을 그대로 쓴다. -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:${picked ? '10px' : '20px'}">
          <button type="button" id="rvReject" style="padding:14px;border-radius:11px;
            border:1px solid ${picked === 'failed' ? '#b91c1c' : '#fca5a5'};
            background:${picked === 'failed' ? '#fee2e2' : '#fef2f2'};
            box-shadow:${picked === 'failed' ? 'inset 0 0 0 1px #b91c1c' : 'none'};
            color:#b91c1c;font-size:14px;font-weight:800;cursor:pointer">🚫 검증실패 업체로 선정 <span style="opacity:.6;font-weight:500">←</span></button>
          <button type="button" id="rvApprove" style="padding:14px;border-radius:11px;border:none;
            background:${picked === 'queued' ? '#1d4ed8' : '#2563eb'};
            box-shadow:${picked === 'queued' ? 'inset 0 0 0 2px #93c5fd' : '0 2px 8px rgba(37,99,235,.3)'};
            color:#fff;font-size:14px;font-weight:800;cursor:pointer">✉ 메일 보낼곳으로 선정 <span style="opacity:.7;font-weight:500">→</span></button>
        </div>

        <!-- 앞뒤로 넘기기. 고르지 않고 넘어가는 [다음 ›] 은 예전의 "건너뛰기" 와
             같다 — DB 를 건드리지 않으므로 다시 들어오면 또 나온다.
             [‹ 이전] 은 잘못 눌렀을 때 되돌아가려고 둔다. -->
        <div style="display:flex;align-items:center;gap:10px;margin-top:14px;
                    padding-top:13px;border-top:1px solid var(--border-default)">
          <button type="button" id="rvPrev" ${atFirst ? 'disabled' : ''}
            title="${atFirst ? '첫 회사입니다' : '앞 회사로 돌아갑니다'}"
            style="padding:9px 16px;border-radius:9px;border:1px solid var(--border-default);
                   background:var(--bg-surface);color:var(--text-secondary);font-size:12.5px;
                   font-weight:700;cursor:${atFirst ? 'not-allowed' : 'pointer'};
                   opacity:${atFirst ? '.4' : '1'}">‹ 이전</button>
          <span style="flex:1;text-align:center;font-size:12px;color:var(--text-tertiary)">
            이 묶음 ${(_review.idx + 1).toLocaleString()} / ${_review.queue.length.toLocaleString()}
            ${picked ? '' : '<span style="color:var(--text-quaternary)"> · 고르지 않고 넘어가면 나중에 다시 나옵니다</span>'}
          </span>
          <button type="button" id="rvNext"
            title="고르지 않고 다음 회사로 넘어갑니다"
            style="padding:9px 16px;border-radius:9px;border:1px solid var(--border-default);
                   background:var(--bg-surface);color:var(--text-secondary);font-size:12.5px;
                   font-weight:700;cursor:pointer">다음 ›</button>
        </div>
      </div>
    </div>`;

  els.content.querySelector('#rvExit').addEventListener('click', () => exitDirectReview());
  els.content.querySelector('#rvApprove').addEventListener('click', () => reviewDecide('send'));
  els.content.querySelector('#rvReject').addEventListener('click', () => reviewDecide('reject'));
  els.content.querySelector('#rvPrev').addEventListener('click', () => reviewGo(-1));
  els.content.querySelector('#rvNext').addEventListener('click', () => reviewGo(1));
}

/**
 * 카드 앞뒤로 넘기기. 판정은 하지 않는다.
 *
 * 묶음(30곳)의 끝에서 [다음 ›] 을 누르면 다음 묶음을 받아온다.
 * 그때 이번에 고른 것들은 서버 대기열에서 이미 빠져 있어 다시 오지 않는다.
 */
function reviewGo(delta) {
  if (_review.busy) return;
  const next = _review.idx + delta;
  if (next < 0) return;                       // 첫 회사에서 더 뒤로는 없다
  if (next >= _review.queue.length) {
    // 이 묶음에서 판정하지 않고 넘긴 수만큼 오프셋을 민다.
    // 판정한 건은 서버 대기열에서 빠져 뒤가 저절로 당겨지므로 세지 않는다.
    _review.skip = (_review.skip || 0)
      + _review.queue.filter((l) => !_review.decided.has(l.leadId)).length;
    _review.queue = [];                       // 다음 묶음을 새로 받는다
    _review.idx = 0;
  } else {
    _review.idx = next;
  }
  renderReviewPage();
}

async function reviewDecide(decision, force) {
  if (_review.busy) return;               // 연타로 두 건이 한 번에 넘어가지 않게
  const lead = _review.queue[_review.idx];
  if (!lead) return;

  // 되돌아와서 같은 버튼을 또 누른 경우 — 바뀌는 게 없으니 다음으로만 넘어간다
  const wanted = decision === 'send' ? 'queued' : decision === 'reject' ? 'failed' : 'archived';
  const already = _review.decided.get(lead.leadId);
  if (already === wanted) { reviewGo(1); return; }

  _review.busy = true;
  let r;
  try {
    // safeJsonFetch 는 4xx 에도 예외를 던지지 않고 본문을 그대로 준다.
    // 그래서 성공 여부는 예외가 아니라 r.success 로 본다.
    r = await safeJsonFetch('/api/leads/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 보고 있는 범위를 같이 보낸다 — 안 보내면 응답의 remaining 이
      // 전체 수로 와서 진행바 분모가 판정 한 번에 어긋난다.
      body: JSON.stringify({ leadId: lead.leadId, decision, force: !!force, ...reviewScopeParams() }),
    });
  } catch (e) {
    _review.busy = false;
    alert(`처리 실패: ${(e && e.message) || e}`);
    return;
  }
  _review.busy = false;

  if (!r || !r.success) {
    // 예약이 걸려 있어 서버가 멈춰 세운 경우 —
    // 무엇이 함께 취소되는지 알리고 확인을 받은 뒤 다시 보낸다
    if (r && r.needsConfirm) {
      if (confirm(`${r.error}\n\n계속할까요?`)) return reviewDecide(decision, true);
      return;
    }
    alert(`처리 실패: ${(r && r.error) || '알 수 없는 오류'}`);
    return;
  }

  _review.decided.set(lead.leadId, r.stage);   // 같은 곳을 고쳐도 한 건으로 센다
  _review.remaining = r.remaining;
  _review.queued = r.queued;
  _review.failed = r.failed;
  // 로컬 캐시도 맞춰둔다 — 다른 화면으로 갔을 때 숫자가 어긋나지 않게
  const local = baseLeads.find((l) => l.leadId === lead.leadId);
  if (local) local.stage = r.stage;
  invalidateServerPage();
  loadStageCounts(true);

  if (r.canceledSchedules) {
    alert(`예약된 메일 ${r.canceledSchedules}통을 함께 취소했습니다.`);
  }

  // 서버에 다녀오는 사이 사이드바로 나갔으면 여기서 멈춘다.
  // 판정 자체는 이미 저장됐고, 화면만 덮어 그리지 않는다.
  if (state.view !== 'tool-review') return;

  reviewGo(1);                                 // 고른 회사는 지나간다
}

// 키보드 — 검토 화면에서만 듣는다
document.addEventListener('keydown', (ev) => {
  if (state.view !== 'tool-review') return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
  if (document.querySelector('.modal-backdrop[style*="flex"], #mailDetailRoot')) return;
  if (ev.key === 'ArrowRight') { ev.preventDefault(); reviewDecide('send'); }
  else if (ev.key === 'ArrowLeft') { ev.preventDefault(); reviewDecide('reject'); }
  // 앞뒤 넘기기는 ←/→ 를 판정이 쓰고 있어 다른 키에 둔다.
  // Backspace 는 "뒤로" 라는 뜻이 이미 몸에 붙어 있다.
  // (브라우저 뒤로가기로 새지 않게 preventDefault 를 반드시 부른다)
  else if (ev.key === 'Backspace') { ev.preventDefault(); reviewGo(-1); }
  // Esc — 검토를 멈추고 들어왔던 화면으로. 팝업의 Esc 와 같은 감각이다.
  else if (ev.key === 'Escape') { ev.preventDefault(); exitDirectReview(); }
  else if (ev.key === 'Enter') {
    const a = els.content.querySelector('a[target="_blank"]');
    if (a) { ev.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
  }
});

// ── 휴지통 ────────────────────────────────────────────────────
// DB 에서 지우지 않고 trashedAt 만 세팅하므로 언제든 되돌릴 수 있다.
// 광고 오분류가 자료 소실이 되면 안 되기 때문이다.
var _trashSelected = new Set();

async function renderTrashPage() {
  els.content.innerHTML = `<div class="inline-loader">휴지통 불러오는 중…</div>`;
  let data;
  try {
    data = await safeJsonFetch('/api/mail/inbox?trashed=1&flat=1&limit=100');
  } catch (e) {
    els.content.innerHTML = `<div class="empty-detail"><h3>불러오기 실패</h3><p>${escapeHtml(String(e.message || e))}</p></div>`;
    return;
  }
  if (!data?.success) {
    els.content.innerHTML = `<div class="empty-detail"><h3>조회 실패</h3><p>${escapeHtml(data?.error || '')}</p></div>`;
    return;
  }

  const items = data.items || [];
  const dt = (v) => v ? new Date(v).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '';

  if (!items.length) {
    els.content.innerHTML = `<div class="empty-detail">
      <h3>휴지통이 비어 있습니다</h3>
      <p>메일 상세에서 [🗑 휴지통] 을 누르면 여기로 옵니다. 실제로 삭제되지는 않습니다.</p></div>`;
    _trashSelected.clear();
    return;
  }

  const rows = items.map((m) => {
    const cls = MAIL_CLASS[m.classification] || MAIL_CLASS.unknown;
    const checked = _trashSelected.has(String(m._id)) ? 'checked' : '';
    // inbox-row 를 함께 붙여야 행 클릭 → 상세 모달이 열린다 (document 위임 핸들러)
    return `<tr class="trash-row inbox-row" data-mail-id="${escapeAttr(String(m._id))}" style="cursor:pointer">
      <td style="width:36px"><input type="checkbox" class="trash-check" data-mail-id="${escapeAttr(String(m._id))}" ${checked} style="width:16px;height:16px;cursor:pointer"></td>
      <td style="white-space:nowrap;color:var(--text-tertiary);font-size:12px">${dt(m.date)}</td>
      <td>
        <div style="font-size:12.5px;color:var(--text-primary)">
          ${m.group ? `<span style="background:var(--bg-surface-alt);color:var(--text-secondary);border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700;margin-right:5px">📁 ${escapeHtml(m.group)}</span>` : ''}
          ${escapeHtml(String(m.subject || '(제목 없음)').slice(0, 66))}
        </div>
        <div style="font-size:11px;color:var(--text-tertiary)">${escapeHtml(m.from?.address || '')}</div>
      </td>
      <td style="white-space:nowrap"><span title="${escapeAttr(cls.desc || '')}" style="background:${cls.bg};color:${cls.fg};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;cursor:help">${cls.label}</span></td>
      <td style="white-space:nowrap;color:var(--text-quaternary);font-size:11px">${dt(m.trashedAt)} 치움</td>
    </tr>`;
  }).join('');

  els.content.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <button class="button secondary" id="trashSelectAll" type="button">이 페이지 전체 선택</button>
      <button class="button" id="trashRestore" type="button" disabled>↩ 선택 복구 (<span id="trashCount">0</span>)</button>
      <span style="font-size:12px;color:var(--text-tertiary);margin-left:auto">
        총 ${data.total}통 · <b>DB 에서 지우지 않습니다</b> — 언제든 복구 가능
      </span>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>받은 날</th><th>제목</th><th>분류</th><th>치운 날</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

  const syncBtn = () => {
    const n = _trashSelected.size;
    els.content.querySelector('#trashCount').textContent = String(n);
    els.content.querySelector('#trashRestore').disabled = n === 0;
  };

  els.content.querySelectorAll('.trash-check').forEach((cb) => {
    cb.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = cb.dataset.mailId;
      if (cb.checked) _trashSelected.add(id); else _trashSelected.delete(id);
      syncBtn();
    });
  });

  els.content.querySelector('#trashSelectAll')?.addEventListener('click', () => {
    const all = items.every((m) => _trashSelected.has(String(m._id)));
    items.forEach((m) => { if (all) _trashSelected.delete(String(m._id)); else _trashSelected.add(String(m._id)); });
    render();
  });

  els.content.querySelector('#trashRestore')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const ids = [..._trashSelected];
    if (!ids.length) return;
    btn.disabled = true;
    btn.textContent = '복구 중…';
    try {
      const r = await safeJsonFetch('/api/mail/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailIds: ids, restore: true }),
      });
      alert(`${r.moved}통을 받은 메일함으로 되돌렸습니다.`);
      _trashSelected.clear();
      loadMailCounts(true);
      render();
    } catch (err) {
      alert(`복구 실패: ${err.message || err}`);
      btn.disabled = false;
    }
  });

  syncBtn();
}

// ── 메일 상세 모달 ────────────────────────────────────────────
function closeMailDetailModal() {
  const el = document.getElementById('mailDetailRoot');
  if (!el) return;                 // 열려 있지 않으면 잠금 카운트를 건드리지 않는다
  el.remove();
  unlockBodyScroll();
}


// ── 팝업이 실수로 닫히는 것 막기 ─────────────────────────────
//
// 배경(어두운 부분)을 누르면 팝업이 닫힌다. 편하긴 한데, 메일 제목과 본문을
// 한참 쓰다가 배경을 스치면 그대로 날아간다. 되돌릴 방법이 없다.
//
// 두 가지가 겹쳐 있었다.
//
//  1) 안에서 글을 끌어 선택하다가 손을 밖에서 떼면 닫혔다.
//     click 은 누른 곳이 아니라 뗀 곳을 기준으로 오기 때문이다.
//     → 누른 곳도 배경이어야 배경 클릭으로 본다.
//
//  2) 쓰던 내용이 있어도 아무것도 묻지 않고 닫혔다.
//     → 한 글자라도 건드렸으면 물어보고 닫는다.
//
// 안 건드린 팝업(업체 목록, 설명창 같은 읽기 전용)은 예전처럼 바로 닫힌다.
// 묻는 창이 매번 뜨면 그것대로 성가시기 때문이다.

// 마우스를 처음 누른 지점. click 만으로는 1) 을 가려낼 수 없다.
var _modalPressTarget = null;
document.addEventListener('mousedown', (e) => { _modalPressTarget = e.target; }, true);

// 팝업 안에서 무언가 입력·선택하면 그 팝업에 표시를 남긴다.
// 팝업마다 따로 달지 않고 한 번만 걸어 둔다 — 나중에 팝업이 늘어도 따라온다.
var MODAL_ROOT_SELECTOR = '.modal-backdrop, [data-modal]';
['input', 'change'].forEach((evt) =>
  document.addEventListener(evt, (e) => {
    const root = e.target && e.target.closest && e.target.closest(MODAL_ROOT_SELECTOR);
    if (root) root.dataset.userTyped = '1';
  }, true));

/** 이 팝업에서 사용자가 뭔가 입력했는가 */
function modalHasTypedInput(root) {
  return !!(root && root.dataset && root.dataset.userTyped === '1');
}

/**
 * 닫아도 되는지 확인한다. 입력한 게 없으면 묻지 않고 true.
 * 취소를 누르면 false — 부르는 쪽은 닫지 말아야 한다.
 */
function confirmDiscardTyped(root) {
  if (!modalHasTypedInput(root)) return true;
  return confirm('작성 중인 내용이 있습니다.\n\n닫으면 지금 입력한 내용은 사라집니다. 닫을까요?');
}

/**
 * 배경 클릭으로 닫기를 붙인다. 팝업마다 제각각 쓰던 것을 한 곳으로 모았다.
 *   bindBackdropDismiss(root, close)
 */
function bindBackdropDismiss(root, close) {
  if (!root) return;
  root.dataset.modal = '1';
  root.addEventListener('click', (e) => {
    if (e.target !== root) return;            // 팝업 카드 안을 누른 것
    if (_modalPressTarget !== root) return;   // 안에서 끌어다 밖에서 뗀 것
    if (!confirmDiscardTyped(root)) return;
    close();
  });
}

// ── 팝업 배경 스크롤 잠금 ─────────────────────────────────────
//
// 모달 안에서 스크롤하다 끝에 닿으면 뒤 목록이 이어서 움직인다(스크롤 체이닝).
// 닫고 나면 보던 자리가 아닌 곳에 가 있어서 "어디였지"가 된다.
//
// 열고 닫는 지점이 20군데가 넘어 카운터로 세면 한 곳만 빠져도 화면이
// 영영 잠긴다. 그래서 세지 않고 **지금 열려 있는 게 있나** 를 DOM 에서
// 직접 본다 — 몇 번을 불러도 결과가 같아 어긋날 여지가 없다.
//
// 잠글 때 스크롤바가 사라지며 화면이 옆으로 튀는 것도 같이 막는다:
// 사라지는 스크롤바 폭을 재서 padding 으로 메운다.
function syncBodyScrollLock() {
  const open = Boolean(
    document.getElementById('mailDetailRoot') ||
    document.getElementById('conversationModalRoot') ||
    document.getElementById('sendLogicModalRoot') ||
    document.getElementById('outboxPeekRoot') ||
    [...document.querySelectorAll('.modal-backdrop')].some((el) => el.style.display === 'flex'),
  );
  if (open) {
    const w = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--scrollbar-w', `${Math.max(0, w)}px`);
  } else {
    document.documentElement.style.removeProperty('--scrollbar-w');
  }
  document.body.classList.toggle('modal-open', open);
}
// 이름을 그대로 두어 기존 호출부가 계속 동작하게 한다
const lockBodyScroll = syncBodyScrollLock;
const unlockBodyScroll = syncBodyScrollLock;

async function openMailDetailModal(mailId) {
  closeMailDetailModal();
  const root = document.createElement('div');
  root.id = 'mailDetailRoot';
  root.style.cssText = `position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:24px`;
  root.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:860px;width:100%;
    max-height:88vh;padding:40px;text-align:center;color:#64748b;font-size:14px">메일 불러오는 중…</div>`;
  document.body.appendChild(root);
  lockBodyScroll();

  let data;
  try {
    data = await safeJsonFetch(`/api/mail/${encodeURIComponent(mailId)}`);
  } catch (e) {
    root.firstElementChild.innerHTML = `<div style="color:#991b1b">${escapeHtml(String(e.message || e))}</div>`;
    return;
  }
  if (!data?.success) {
    root.firstElementChild.innerHTML = `<div style="color:#991b1b">${escapeHtml(data?.error || '조회 실패')}</div>`;
    return;
  }

  const m = data.mail;
  const lead = data.lead;
  const a = m.analysis || {};
  const cls = MAIL_CLASS[m.classification] || MAIL_CLASS.unknown;
  const dt = (v) => v ? new Date(v).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  const aiBlock = a.method === 'ai' ? `
    <div style="margin:12px 0;padding:12px 14px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px">
      <div style="font-size:10px;font-weight:800;color:#4338ca;margin-bottom:6px">🧠 AI 분석</div>
      ${a.topic ? `<div style="font-size:13px;font-weight:700;color:#1e1b4b">${escapeHtml(a.topic)}</div>` : ''}
      ${a.summary ? `<div style="font-size:12.5px;color:#312e81;line-height:1.6;margin-top:4px">${escapeHtml(a.summary)}</div>` : ''}
      ${(a.keyPoints || []).length ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:12px;color:#3730a3;line-height:1.7">
        ${a.keyPoints.map((k) => `<li>${escapeHtml(k)}</li>`).join('')}</ul>` : ''}
      ${a.suggestedAction ? `<div style="margin-top:8px;padding:7px 10px;background:#fff;border-radius:6px;
        font-size:12px;color:#1e1b4b;border-left:3px solid #6366f1"><b>다음 할 일</b> · ${escapeHtml(a.suggestedAction)}</div>` : ''}
      ${a.deadlineText ? `<div style="margin-top:6px;font-size:11.5px;color:#b45309">⏰ "${escapeHtml(a.deadlineText)}"</div>` : ''}
    </div>` : `
    <div style="margin:12px 0;padding:9px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                font-size:11.5px;color:#64748b">
      아직 분석하지 않은 메일입니다.
      위의 <b>🧠 AI 분석</b> 을 누르면 <b>한글 번역까지 한 번에</b> 같이 진행됩니다
      — 번역 · 요약 · 회신 필요 여부 · 회신 기한이 함께 붙습니다.
      <br>본문만 한글로 보고 싶으면 본문 아래 <b>🌐 AI 번역</b> 을 누르세요 (더 저렴합니다).
    </div>`;

  const transBlock = m.translation?.body ? `
    <details style="margin-top:12px">
      <summary style="cursor:pointer;font-size:12px;color:#4338ca;font-weight:600">🇰🇷 한글 번역 전문</summary>
      <div style="margin-top:8px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                  font-size:12.5px;color:#334155;line-height:1.7;white-space:pre-wrap;max-height:320px;overflow:auto">${escapeHtml(m.translation.body)}</div>
    </details>` : '';

  const quoteBlock = m.hasQuoted ? `
    <details style="margin-top:10px">
      <summary style="cursor:pointer;font-size:11.5px;color:#64748b">▼ 인용된 이전 대화 보기</summary>
      <pre style="margin-top:8px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;
                  font-size:11px;color:#64748b;white-space:pre-wrap;word-break:break-word;
                  max-height:280px;overflow:auto">${escapeHtml(m.bodyFull)}</pre>
    </details>` : '';

  const replied = m.status === 'replied';

  root.innerHTML = `
    <!-- 좌우로 나누려면 폭이 있어야 한다. 1140px 에서 반으로 자르면
         답장 칸이 570px 도 안 되어 영문 한 줄이 자꾸 접힌다. -->
    <div style="background:#fff;border-radius:14px;max-width:min(1560px,96vw);width:100%;height:90vh;
                display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.3);overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:12px">
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:5px">
            <span title="${escapeAttr(cls.desc || '')}" style="background:${cls.bg};color:${cls.fg};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;cursor:help">${cls.label}</span>
            ${m.group ? `<span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">📁 ${escapeHtml(m.group)}</span>` : ''}
            ${replied
              ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">✅ 회신함${m.repliedOutside ? ' (웹메일)' : ''}</span>`
              : a.needsReply ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">⚠ 회신 필요</span>` : ''}
          </div>
          <div style="font-size:16px;font-weight:700;color:#0f172a;word-break:break-word">${escapeHtml(m.subject || '(제목 없음)')}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">
            ${escapeHtml(m.from?.name || '')} &lt;${escapeHtml(m.from?.address || '')}&gt; · ${dt(m.date)}
          </div>
          ${lead ? `<div style="font-size:11.5px;color:#166534;margin-top:4px">
            연결된 리드 · <b>${escapeHtml(lead.Company)}</b> (${escapeHtml(lead.Country || '')})
            <button type="button" class="conversation-btn" data-conv-lead="${escapeAttr(lead.leadId)}"
              style="margin-left:6px;padding:1px 8px;font-size:10px;border:1px solid #16a34a;border-radius:99px;
                     background:#16a34a;color:#fff;font-weight:700;cursor:pointer">💬 대화 전체</button>
          </div>` : ''}
        </div>
        <!-- 버튼은 한 덩어리로 묶는다.
             묶지 않으면 헤더(flex)의 자식이 되어 제목 높이만큼 세로로 늘어난다 —
             글자는 작은데 상자만 커다랗게 뜨던 원인이 이것이었다.
             align-self:flex-start 로 제목 줄 맨 위에 붙인다. -->
        <div style="display:flex;align-items:center;gap:6px;flex:none;align-self:flex-start">
          <!-- 한 통만 분석한다. 목록의 일괄 분석 버튼은 뺐지만(비용이 예측되지 않아서)
               건당 1회는 비용이 정해져 있어 남겨둔다. -->
          ${m.analysis?.method === 'ai' ? '' : `<button type="button" id="mdAnalyze"
            style="display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 12px;
                   font-size:12px;font-weight:700;border:1px solid #c7d2fe;line-height:1;
                   border-radius:8px;background:#eef2ff;color:#4338ca;cursor:pointer;white-space:nowrap"
            title="이 메일 한 통만 — 한글 번역 + 요약 + 회신 필요 여부 + 기한을 한 번에. 누를 때만 비용이 발생합니다">🧠 AI 분석</button>`}
          <button type="button" id="mdFullscreen"
            style="display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 12px;
                   font-size:12px;font-weight:700;border:1px solid var(--border-default);line-height:1;
                   border-radius:8px;background:#fff;color:#475569;cursor:pointer;white-space:nowrap"
            title="편지를 화면 전체로 보기 (Esc 로 되돌리기)">⛶ 전체 보기</button>
          <button type="button" id="mailDetailClose" title="닫기 (Esc)"
            style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;
                   background:none;border:none;border-radius:8px;font-size:20px;color:#94a3b8;
                   cursor:pointer;line-height:1;padding:0">×</button>
        </div>
      </div>

      <!-- 왼쪽 받은 편지 · 오른쪽 답장. 편지를 보면서 그대로 답을 쓴다.
           좁은 화면(1100px 미만)에서는 CSS 가 다시 위아래로 되돌린다. -->
      <div class="mail-split">
        <div class="mail-read" style="padding:16px 20px;background:#fcfcfd">
          ${aiBlock}
          <div style="font-size:13.5px;color:#1e293b;line-height:1.75;white-space:pre-wrap;word-break:break-word">${escapeHtml(m.body || '(본문 없음)')}</div>
          <!-- 이미 AI 분석으로 번역본이 있으면(transBlock) 굳이 또 부르지 않는다 -->
          ${m.translation?.body ? '' : translateBtnHtml(m.body || '')}
          ${quoteBlock}
          ${transBlock}
          ${(m.attachments || []).length ? `<div style="margin-top:12px;font-size:12px;color:#475569">
            📎 ${m.attachments.map((x) => escapeHtml(x.filename)).join(' · ')}</div>` : ''}
        </div>
        <div class="mail-reply">
          ${replyBoxHtml({ _id: m.id, subject: m.subject, from: m.from })}
        </div>
      </div>

      <div style="border-top:1px solid #e2e8f0;padding:12px 20px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${!replied ? `<button type="button" id="mdMarkReplied" data-mail-id="${escapeAttr(m.id)}"
          style="padding:7px 14px;font-size:12.5px;font-weight:700;border:none;border-radius:8px;
                 background:#16a34a;color:#fff;cursor:pointer">✅ 회신 완료로 표시</button>` : ''}
        ${lead ? `<button type="button" class="conversation-btn" data-conv-lead="${escapeAttr(lead.leadId)}"
          style="padding:7px 14px;font-size:12.5px;font-weight:700;border:1px solid #2563eb;border-radius:8px;
                 background:#eff6ff;color:#1e40af;cursor:pointer">↩ 여기서 답장</button>` : ''}
        <button type="button" id="mdTrash" data-mail-id="${escapeAttr(m.id)}"
          style="padding:7px 14px;font-size:12.5px;border:1px solid ${m.trashedAt ? '#16a34a' : '#cbd5e1'};border-radius:8px;
                 background:#fff;color:${m.trashedAt ? '#166534' : '#64748b'};cursor:pointer">${m.trashedAt ? '↩ 받은함으로 되돌리기' : '🗑 휴지통'}</button>
        <span id="mdMsg" style="font-size:12px;margin-left:auto"></span>
      </div>
    </div>`;

  root.querySelector('#mailDetailClose')?.addEventListener('click', closeMailDetailModal);

  // 전체 보기 — 긴 편지는 팝업 안에서 좁게 읽기 힘들다
  const fsBtn = root.querySelector('#mdFullscreen');
  fsBtn?.addEventListener('click', () => {
    const on = root.classList.toggle('mail-full');
    fsBtn.textContent = on ? '⤡ 창으로' : '⛶ 전체 보기';
  });
  // Esc — 전체 보기 중이면 창으로 되돌리고, 아니면 팝업을 닫는다
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (root.classList.contains('mail-full')) {
      root.classList.remove('mail-full');
      if (fsBtn) fsBtn.textContent = '⛶ 전체 보기';
    } else closeMailDetailModal();
  });
  root.tabIndex = -1;
  root.focus();

  // 이 메일 한 통만 AI 분석 (번역까지 함께)
  const anBtn = root.querySelector('#mdAnalyze');
  anBtn?.addEventListener('click', async () => {
    const msg = [
      '이 메일 한 통을 AI로 분석합니다.',
      '',
      '한글 번역 + 요약 + 회신 필요 여부 + 기한이 한 번에 붙습니다.',
      '비용은 메일 길이에 따라 대략 ₩5~20입니다.',
      '',
      '진행할까요?',
    ].join('\n');
    if (!confirm(msg)) return;
    anBtn.disabled = true;
    anBtn.textContent = '분석 중…';
    try {
      await safeJsonFetch('/api/mail/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailIds: [m.id] }),
      });
      loadMailCounts(true);
      openMailDetailModal(m.id);   // 결과를 반영해 다시 그린다
    } catch (e) {
      alert(`분석 실패: ${e.message || e}`);
      anBtn.disabled = false;
      anBtn.textContent = '🧠 AI 분석 (번역 포함)';
    }
  });
  bindBackdropDismiss(root, closeMailDetailModal);

  const patch = async (body, okMsg) => {
    const msg = root.querySelector('#mdMsg');
    try {
      await safeJsonFetch(`/api/mail/${encodeURIComponent(m.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      msg.innerHTML = `<span style="color:#166534">${okMsg}</span>`;
      loadMailCounts(true);
      setTimeout(() => { closeMailDetailModal(); render(); }, 600);
    } catch (e) {
      msg.innerHTML = `<span style="color:#b91c1c">${escapeHtml(String(e.message || e))}</span>`;
    }
  };

  root.querySelector('#mdMarkReplied')?.addEventListener('click', () =>
    patch({ status: 'replied', needsReply: false }, '✅ 회신 완료로 표시했습니다'));

  // 답장 상자는 공용 구현(replyBoxHtml/bindConversationReply)을 그대로 쓴다.
  bindConversationReply(null, 'mailDetailRoot');

  root.querySelector('#mdTrash')?.addEventListener('click', async () => {
    const msg = root.querySelector('#mdMsg');
    try {
      await safeJsonFetch('/api/mail/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailIds: [m.id], restore: Boolean(m.trashedAt) }),
      });
      msg.innerHTML = m.trashedAt
        ? '<span style="color:#166534">↩ 받은 메일함으로 되돌렸습니다</span>'
        : '<span style="color:#166534">🗑 휴지통으로 옮겼습니다 (삭제되지 않음)</span>';
      loadMailCounts(true);
      setTimeout(() => { closeMailDetailModal(); render(); }, 600);
    } catch (e) {
      msg.innerHTML = `<span style="color:#b91c1c">${escapeHtml(String(e.message || e))}</span>`;
    }
  });
}

// ── 오늘의 브리핑 ─────────────────────────────────────────────
async function renderBriefingPage() {
  els.content.innerHTML = `<div class="inline-loader">브리핑 만드는 중…</div>`;
  let data;
  try {
    data = await safeJsonFetch('/api/mail/briefing?days=1');
  } catch (e) {
    els.content.innerHTML = `<div class="empty-detail"><h3>불러오기 실패</h3><p>${escapeHtml(String(e.message || e))}</p></div>`;
    return;
  }
  if (!data || !data.success) {
    els.content.innerHTML = `<div class="empty-detail"><h3>조회 실패</h3><p>${escapeHtml(data?.error || '')}</p></div>`;
    return;
  }
  const b = data.briefing;
  const t = b.totals || {};
  const d = (v) => v ? new Date(v).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '';
  const uColor = (u) => u === 'high' ? '#b91c1c' : u === 'mid' ? '#c2410c' : '#64748b';
  const uLabel = (u) => u === 'high' ? '🔴 긴급' : u === 'mid' ? '🟠 보통' : '⚪ 낮음';

  const card = (n, label, bg, fg) => `
    <div style="flex:1;min-width:130px;background:${bg};padding:14px;border-radius:10px">
      <div style="font-size:24px;font-weight:800;color:${fg}">${n}</div>
      <div style="font-size:11px;color:${fg}">${label}</div>
    </div>`;

  const item = (m) => `
    <div style="padding:12px 0;border-bottom:1px solid var(--border-subtle)">
      <div style="font-size:11px;font-weight:700;color:${uColor(m.urgency)}">
        ${uLabel(m.urgency)}
        ${m.deadline ? ` · 기한 ${d(m.deadline)}` : ''}
        ${m.company || m.group ? ` · ${escapeHtml(m.company || m.group)}` : ''}
        ${!m.analyzedByAi ? ' · <span style="color:var(--text-quaternary)">AI 미분석</span>' : ''}
      </div>
      <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-top:3px">
        ${escapeHtml(m.topic || m.subject)}
      </div>
      ${m.summary ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.5">${escapeHtml(m.summary)}</div>` : ''}
      ${m.suggestedAction ? `<div style="font-size:12px;color:var(--brand-text);margin-top:4px">→ ${escapeHtml(m.suggestedAction)}</div>` : ''}
      <div style="font-size:11px;color:var(--text-quaternary);margin-top:3px">
        ${escapeHtml(m.fromName || m.from)}
        ${m.leadId ? ` · <button type="button" class="conversation-btn" data-conv-lead="${escapeAttr(m.leadId)}"
            style="padding:1px 7px;font-size:10px;border:1px solid #16a34a;border-radius:99px;
                   background:#16a34a;color:#fff;font-weight:700;cursor:pointer">💬 대화</button>` : ''}
      </div>
    </div>`;

  const section = (title, items) => items.length ? `
    <h3 style="font-size:14px;margin:22px 0 4px">${title}
      <span style="color:var(--text-tertiary);font-weight:400">${items.length}건</span></h3>
    ${items.map(item).join('')}` : '';

  els.content.innerHTML = `
    <div style="max-width:760px">
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">
        직전 24시간 (${d(b.since)} ~ ${d(b.until)}) · 새 메일 ${b.newMails}건
        · 합계는 <b>${escapeHtml(b.periodLabel || '최근 2개월')}</b> 기준
      </div>

      <div style="display:flex;gap:10px;margin-bottom:6px;flex-wrap:wrap">
        ${card(t.needsReply || 0, '회신 필요', '#fef3c7', '#92400e')}
        ${card(t.overdue || 0, '기한 지남', '#fee2e2', '#991b1b')}
        ${card((b.newReplies || []).length, '새 답장', '#dcfce7', '#166534')}
        ${card(t.unanalyzed || 0, 'AI 미분석', '#f1f5f9', '#475569')}
      </div>

      ${(b.newReplies || []).length ? `
        <h3 style="font-size:14px;margin:22px 0 4px">💬 새로 답장이 온 곳</h3>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${b.newReplies.map((r) => `<button type="button" class="conversation-btn" data-conv-lead="${escapeAttr(r.leadId)}"
            style="padding:5px 12px;font-size:12px;border:1px solid #16a34a;border-radius:99px;
                   background:#16a34a;color:#fff;font-weight:700;cursor:pointer">
            💬 ${escapeHtml(r.company || r.leadId)}</button>`).join('')}
        </div>` : ''}

      ${section('⚠️ 회신이 필요한 메일', b.needsReply || [])}
      ${section('⏰ 기한이 다가온 건', b.deadlinesSoon || [])}

      ${!(b.needsReply || []).length && !(b.deadlinesSoon || []).length && !(b.newReplies || []).length
        ? '<div class="empty-detail" style="margin-top:20px"><h3>오늘은 새 소식이 없습니다</h3><p>회신이 필요한 메일이나 기한 임박 건이 생기면 여기에 모입니다.</p></div>'
        : ''}

      <div style="margin-top:24px;padding-top:14px;border-top:1px solid var(--border-subtle);
                  display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="button secondary" id="briefingSendBtn" type="button">📧 이 브리핑을 메일로 받기</button>
        <span id="briefingMsg" style="font-size:12px;color:var(--text-tertiary)"></span>
      </div>
      <div style="margin-top:8px;font-size:11px;color:var(--text-quaternary);line-height:1.5">
        매일 아침 자동 발송하려면 <b>메일 수신 설정</b>에서 받을 주소를 지정하세요.
        새 소식이 없는 날은 보내지 않습니다.
      </div>
    </div>`;

  els.content.querySelector('#briefingSendBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const msg = els.content.querySelector('#briefingMsg');
    btn.disabled = true;
    btn.textContent = '보내는 중…';
    try {
      const r = await safeJsonFetch('/api/mail/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 1, force: true }),
      });
      msg.innerHTML = r.success
        ? (r.skipped
            ? `<span style="color:var(--text-tertiary)">${escapeHtml(r.reason)}</span>`
            : `<span style="color:#166534">✅ ${escapeHtml(r.to)} 로 보냈습니다</span>`)
        : `<span style="color:#b91c1c">${escapeHtml(r.error)}</span>`;
    } catch (err) {
      msg.innerHTML = `<span style="color:#b91c1c">${escapeHtml(String(err.message || err))}</span>`;
    }
    btn.disabled = false;
    btn.textContent = '📧 이 브리핑을 메일로 받기';
  });
}

// ── 메일 수신 설정 ────────────────────────────────────────────
async function renderMailSettingsPage() {
  els.content.innerHTML = `<div class="inline-loader">설정 불러오는 중…</div>`;
  let data;
  try {
    data = await safeJsonFetch('/api/mail/settings');
  } catch (e) {
    els.content.innerHTML = `<div class="empty-detail"><h3>불러오기 실패</h3><p>${escapeHtml(String(e.message || e))}</p></div>`;
    return;
  }
  const s = data.settings || {};
  const folders = s.imapFolders || [];

  els.content.innerHTML = `
    <div style="max-width:720px;display:flex;flex-direction:column;gap:16px">
      <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:12px;padding:20px">
        <h3 style="font-size:14px;margin-bottom:4px">이카운트 웹메일 연결</h3>
        <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:14px">
          이카운트 웹메일 → 개인기능설정 → 외부연동설정에서 "메일 클라이언트 사용"이 켜져 있어야 합니다.
        </p>
        <div style="display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:center;font-size:13px">
          <span style="color:var(--text-secondary)">수신 서버</span>
          <input class="form-input" id="msHost" value="${escapeAttr(s.imapHost || 'wmbox4.ecount.com')}" style="padding:7px 10px">
          <span style="color:var(--text-secondary)">계정</span>
          <input class="form-input" id="msUser" value="${escapeAttr(s.imapUser || '')}" placeholder="david@yogico.kr" style="padding:7px 10px">
          <span style="color:var(--text-secondary)">비밀번호</span>
          <input class="form-input" id="msPass" type="password" placeholder="${s.imapPassSet ? '저장됨 — 바꿀 때만 입력' : '입력하세요'}" style="padding:7px 10px">
        </div>
        <div style="margin-top:14px;display:flex;gap:8px">
          <button class="button" id="msSaveBtn" type="button">저장</button>
          <button class="button secondary" id="msTestBtn" type="button">🔌 연결 테스트</button>
        </div>
        <div id="msResult" style="margin-top:12px;font-size:12px"></div>
      </div>

      <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:12px;padding:20px">
        <h3 style="font-size:14px;margin-bottom:4px">수집 폴더</h3>
        <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">
          비워두면 INBOX 만 수집합니다. 거래처별 폴더를 나눠 두셨다면 여기에 추가하세요 —
          <b>추가하지 않으면 그 폴더로 들어온 메일을 놓칩니다.</b>
        </p>
        <div id="msFolders" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          ${folders.length
            ? folders.map((f) => `<span style="background:var(--bg-surface-alt);padding:4px 10px;border-radius:99px;font-size:12px">${escapeHtml(f)}</span>`).join('')
            : '<span style="font-size:12px;color:var(--text-quaternary)">INBOX 만 수집 중</span>'}
        </div>
        <div style="font-size:12px;color:var(--text-tertiary)">
          마지막 수집: ${s.lastIngestAt ? new Date(s.lastIngestAt).toLocaleString('ko-KR') : '없음'}
          ${s.lastIngestError ? `<div style="color:#b91c1c;margin-top:4px">⚠ ${escapeHtml(s.lastIngestError)}</div>` : ''}
        </div>
      </div>
    </div>`;

  els.content.querySelector('#msSaveBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const payload = {
      imapHost: els.content.querySelector('#msHost').value.trim(),
      imapUser: els.content.querySelector('#msUser').value.trim(),
    };
    // 빈 비밀번호는 "변경 없음" — 기존 값을 지우지 않는다
    const pass = els.content.querySelector('#msPass').value;
    if (pass) payload.imapPass = pass;
    try {
      await safeJsonFetch('/api/mail/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      els.content.querySelector('#msResult').innerHTML = '<span style="color:#166534">✅ 저장했습니다.</span>';
    } catch (err) {
      els.content.querySelector('#msResult').innerHTML = `<span style="color:#b91c1c">저장 실패: ${escapeHtml(String(err.message || err))}</span>`;
    }
    btn.disabled = false;
  });

  els.content.querySelector('#msTestBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const out = els.content.querySelector('#msResult');
    btn.disabled = true;
    out.innerHTML = '<span class="inline-loader">연결 확인 중…</span>';
    try {
      const r = await safeJsonFetch('/api/mail/test-connection', { method: 'POST' });
      if (r.success) {
        out.innerHTML = `<span style="color:#166534">✅ 연결 성공 — 폴더 ${r.folderCount}개</span>
          <div style="margin-top:6px;color:var(--text-tertiary)">${(r.folders || []).map(escapeHtml).join(' · ')}</div>
          ${r.mailbox ? `<div style="margin-top:4px;color:var(--text-tertiary)">INBOX ${r.mailbox.exists}통</div>` : ''}`;
      } else {
        out.innerHTML = `<span style="color:#b91c1c">❌ ${escapeHtml(r.error || '실패')}</span>`;
      }
    } catch (err) {
      out.innerHTML = `<span style="color:#b91c1c">❌ ${escapeHtml(String(err.message || err))}</span>`;
    }
    btn.disabled = false;
  });
}

// ── 메일 대화 모달 ────────────────────────────────────────────
// 보낸 메일(Lead.emailHistory)과 받은 답장(InboundMail)을 한 타임라인으로 보여준다.
// 답장이 오간 뒤부터는 "어느 회사냐" 보다 "무슨 얘기가 오갔냐" 가 중요하므로,
// 회사 목록이 아니라 메일 대화 형식으로 읽게 한다.
function closeConversationModal() {
  const el = document.getElementById('conversationModalRoot');
  if (!el) return;
  el.remove();
  unlockBodyScroll();
}

async function openConversationModal(leadId) {
  closeConversationModal();
  const root = document.createElement('div');
  root.id = 'conversationModalRoot';
  root.style.cssText = `
    position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:24px;
  `;
  root.innerHTML = `
    <div style="background:#ffffff;border-radius:14px;max-width:1140px;width:100%;max-height:90vh;
                display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.3);overflow:hidden">
      <div style="padding:40px;text-align:center;color:#64748b;font-size:14px">대화를 불러오는 중…</div>
    </div>`;
  document.body.appendChild(root);
  lockBodyScroll();

  let data;
  try {
    data = await safeJsonFetch(`/api/mail/thread?leadId=${encodeURIComponent(leadId)}`);
  } catch (e) {
    root.querySelector('div').innerHTML = `
      <div style="padding:32px;color:#991b1b">대화를 불러오지 못했습니다: ${escapeHtml(String(e.message || e))}</div>`;
    return;
  }
  if (!data || !data.success) {
    root.querySelector('div').innerHTML = `
      <div style="padding:32px;color:#991b1b">${escapeHtml(data?.error || '조회 실패')}</div>`;
    return;
  }

  const L = data.lead || {};
  const S = data.stats || {};
  const tl = data.timeline || [];

  const stageStyle = STAGE_STYLE[L.stage] || STAGE_STYLE.imported;
  const dt = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // 회신 대상 = 가장 최근에 받은 메일 (여기에 In-Reply-To 를 건다)
  const inbounds = tl.filter((t) => t.direction === 'in');
  const lastInbound = inbounds.length ? inbounds[inbounds.length - 1] : null;

  // 우리가 답할 차례인지 — 마지막이 상대 메일이면 대응이 필요하다
  const alertBar = S.awaitingOurReply
    ? `<div style="background:#fef3c7;border:1px solid #fcd34d;color:#92400e;padding:8px 12px;
                  border-radius:8px;font-size:12px;font-weight:600;margin-bottom:12px">
         ⚠ 상대 답장이 마지막입니다 — 우리가 회신할 차례
         ${S.nearestDeadline ? ` · 회신 기한 ${dt(S.nearestDeadline)}` : ''}
       </div>`
    : '';

  const bubbles = tl.map((t, i) => {
    const out = t.direction === 'out';
    const bg = out ? '#eff6ff' : '#f0fdf4';
    const bd = out ? '#bfdbfe' : '#bbf7d0';
    const fg = out ? '#1e40af' : '#166534';
    const who = out ? '📤 우리가 보냄' : '📥 상대 답장';
    const meta = [];
    if (!out) {
      if (t.matchedBy) meta.push(`매칭: ${t.matchedBy}`);
      if (t.lang) meta.push(`언어: ${t.lang}`);
      if (t.classification && t.classification !== 'unknown') meta.push(t.classification);
      if (t.needsReply) meta.push('답변 필요');
    } else if (t.to) {
      meta.push(`to ${t.to}`);
    }

    const quoteId = `conv-quote-${i}`;
    const quoteBlock = (!out && t.hasQuoted && t.bodyFull)
      ? `<button type="button" class="conv-quote-toggle" data-quote-target="${quoteId}"
                style="margin-top:8px;background:none;border:none;color:#64748b;font-size:11px;
                       cursor:pointer;padding:0;text-decoration:underline">▼ 인용된 이전 대화 보기</button>
         <pre id="${quoteId}" hidden style="margin:8px 0 0;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;
                    border-radius:6px;font-size:11px;color:#64748b;white-space:pre-wrap;
                    word-break:break-word;max-height:220px;overflow:auto">${escapeHtml(t.bodyFull)}</pre>`
      : '';

    // ── AI 분석 결과 (유료 분석을 돌린 메일만) ──
    // 영문 답장이면 한글 번역을 접어서 함께 둔다 — 대표가 원문/번역을 오가며 읽는다.
    const transId = `conv-trans-${i}`;
    const aiBlock = (!out && t.analyzedBy === 'ai')
      ? `<div style="margin-top:10px;padding:10px 12px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px">
           <div style="font-size:10px;font-weight:800;color:#4338ca;margin-bottom:6px">🧠 AI 분석</div>
           ${t.topic ? `<div style="font-size:12px;font-weight:700;color:#1e1b4b;margin-bottom:4px">${escapeHtml(t.topic)}</div>` : ''}
           ${t.summary ? `<div style="font-size:12px;color:#312e81;line-height:1.55">${escapeHtml(t.summary)}</div>` : ''}
           ${(t.keyPoints && t.keyPoints.length)
             ? `<ul style="margin:8px 0 0;padding-left:16px;font-size:11.5px;color:#3730a3;line-height:1.6">
                  ${t.keyPoints.map(k => `<li>${escapeHtml(k)}</li>`).join('')}
                </ul>` : ''}
           ${t.suggestedAction
             ? `<div style="margin-top:8px;padding:6px 9px;background:#ffffff;border-radius:6px;
                            font-size:11.5px;color:#1e1b4b;border-left:3px solid #6366f1">
                  <b>다음 할 일</b> · ${escapeHtml(t.suggestedAction)}
                </div>` : ''}
           ${t.deadlineText
             ? `<div style="margin-top:6px;font-size:11px;color:#b45309">⏰ 기한 표현: "${escapeHtml(t.deadlineText)}"</div>` : ''}
           ${t.translation
             ? `<button type="button" class="conv-quote-toggle" data-quote-target="${transId}"
                        style="margin-top:8px;background:none;border:none;color:#4338ca;font-size:11px;
                               cursor:pointer;padding:0;text-decoration:underline">▼ 한글 번역 전문 보기</button>
                <div id="${transId}" hidden style="margin-top:8px;padding:10px;background:#ffffff;
                            border:1px solid #c7d2fe;border-radius:6px;font-size:12px;color:#1e1b4b;
                            line-height:1.6;white-space:pre-wrap;max-height:280px;overflow:auto">${escapeHtml(t.translation)}</div>`
             : ''}
         </div>`
      : '';

    const attachBlock = (t.attachments && t.attachments.length)
      ? `<div style="margin-top:8px;font-size:11px;color:#475569">
           📎 ${t.attachments.map(a => escapeHtml(a.filename)).join(' · ')}
         </div>`
      : '';

    return `
      <div style="margin-bottom:14px;${out ? 'margin-right:40px' : 'margin-left:40px'}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:11px;font-weight:700;color:${fg}">${who}</span>
          <span style="font-size:11px;color:#94a3b8">${dt(t.at)}</span>
        </div>
        <div style="background:${bg};border:1px solid ${bd};border-radius:10px;padding:12px 14px">
          <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:6px">
            ${escapeHtml(t.subject || '(제목 없음)')}
          </div>
          <div style="font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;word-break:break-word">${escapeHtml(t.body || '(본문 없음)')}</div>
          <!-- 상대가 보낸 영문 답장에만. 우리가 보낸 것과 이미 번역이 있는 건 제외 -->
          ${!out && !t.translation ? translateBtnHtml(t.body || '', { inline: true }) : ''}
          ${attachBlock}
          ${quoteBlock}
          ${aiBlock}
          ${meta.length ? `<div style="margin-top:8px;font-size:10px;color:#94a3b8">${meta.map(escapeHtml).join(' · ')}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  root.innerHTML = `
    <div style="background:#ffffff;border-radius:14px;max-width:1140px;width:100%;max-height:90vh;
                display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.3);overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;
                  justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <strong style="font-size:16px;color:#0f172a">${escapeHtml(L.Company || '')}</strong>
            <span style="background:${stageStyle.bg};color:${stageStyle.fg};padding:2px 8px;
                         border-radius:99px;font-size:11px;font-weight:700">${stageStyle.label}</span>
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:3px">
            ${escapeHtml(L.Country || '')}
            ${L.Email ? ` · ${escapeHtml(L.Email)}` : ''}
            ${L.WebsiteContact ? ` · ${websiteLinkHtml(L.WebsiteContact, { short: true })}` : ''}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px">
            📤 보낸 ${S.sentCount || 0}통 · 📥 받은 ${S.receivedCount || 0}통
          </div>
        </div>
        <button type="button" id="conversationModalClose"
          style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;line-height:1;padding:0 4px">×</button>
      </div>
      <div style="padding:16px 20px;overflow:auto;flex:1;background:#fcfcfd">
        ${alertBar}
        ${tl.length ? bubbles : '<div style="text-align:center;color:#94a3b8;padding:40px;font-size:13px">아직 주고받은 메일이 없습니다.</div>'}
      </div>
      ${replyBoxHtml(lastInbound)}
    </div>`;

  bindConversationReply(leadId);
}

/**
 * 회신 작성 영역 — 마지막으로 받은 메일에 스레드로 답한다.
 *
 * 받은 메일이 없으면 답할 대상이 없으므로 표시하지 않는다
 * (새 메일 발송은 발송함 화면의 몫).
 */
function replyBoxHtml(lastInbound) {
  if (!lastInbound || !lastInbound._id) return '';
  const subj = String(lastInbound.subject || '');
  const replySubject = /^re\s*:/i.test(subj) ? subj : `Re: ${subj}`;
  const tb = "padding:4px 8px;background:#fff;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:11.5px;color:#0f172a";
  return `
    <div style="border-top:1px solid #e2e8f0;background:#ffffff;padding:14px 20px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:800;color:#1e40af">↩ 회신</span>
        <span style="font-size:11px;color:#64748b">
          ${escapeHtml(lastInbound.from?.address || '')} · ${escapeHtml(replySubject.slice(0, 60))}
        </span>
      </div>

      <!-- 초안 생성이 무엇인지 한 줄로. 처음 보는 사람은 이 버튼이
           '내 대신 메일을 보내버리는 것'으로 오해하기 쉬워서 명시한다. -->
      <div style="padding:8px 11px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;
                  font-size:11.5px;color:#3730a3;line-height:1.6;margin-bottom:8px">
        <b>🧠 초안 생성</b> — 아래 칸에 한국어로 요지만 적으면, AI가 <b>받은 메일 내용을 읽고</b>
        상대 언어에 맞는 답장 초안을 써 줍니다. 한글 대역본이 오른쪽에 같이 나와 내용을 확인할 수 있습니다.
        <b>자동으로 발송되지 않습니다</b> — 고친 뒤 [보내기]를 눌러야 나갑니다.
      </div>

      <div style="display:flex;gap:6px;margin-bottom:9px">
        <input type="text" id="convDraftIntent"
          placeholder="한국어로 요지만 (예: MOQ 500개 확인, FOB 단가 회신, 샘플 다음주 발송)"
          style="flex:1;padding:8px 11px;font-size:12.5px;border:1px solid #cbd5e1;border-radius:8px;
                 background:#ffffff;color:#0f172a">
        <button type="button" id="convDraftBtn" data-inbound-id="${escapeAttr(lastInbound._id)}"
          style="padding:8px 13px;font-size:12px;font-weight:700;border:1px solid #6366f1;border-radius:8px;
                 background:#eef2ff;color:#4338ca;cursor:pointer;white-space:nowrap">🧠 초안 생성</button>
      </div>

      <!-- 좌우 2단: 왼쪽에 쓰고 오른쪽에서 한글로 확인.
           위아래로 쌓으면 초안을 고칠 때마다 스크롤을 오르내려야 한다. -->
      <div class="reply-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start">
        <div>
          <div style="display:flex;gap:3px;flex-wrap:wrap;align-items:center;background:#f1f5f9;
                      border:1px solid #cbd5e1;border-bottom:none;border-radius:8px 8px 0 0;padding:5px 6px">
            <select id="convFontSize" title="글자 크기" style="${tb};padding:4px">
              <option value="">크기</option>
              <option value="12">12px</option><option value="13">13px</option>
              <option value="14">14px</option><option value="16">16px</option>
              <option value="18">18px</option><option value="20">20px</option>
            </select>
            <button type="button" data-rcmd="bold" style="${tb};font-weight:800" title="굵게"><b>B</b></button>
            <button type="button" data-rcmd="italic" style="${tb};font-style:italic" title="기울임"><i>I</i></button>
            <button type="button" data-rcmd="underline" style="${tb};text-decoration:underline" title="밑줄"><u>U</u></button>
            <label title="글자 색" style="display:inline-flex;align-items:center;gap:3px;${tb}">
              <span style="font-weight:800">A</span>
              <input type="color" id="convFontColor" value="#111827"
                     style="width:20px;height:16px;padding:0;border:none;background:none;cursor:pointer">
            </label>
            <button type="button" data-rcmd="insertUnorderedList" style="${tb}" title="글머리 목록">• 목록</button>
            <button type="button" id="convInsertLink" style="${tb};color:#1d4ed8;font-weight:700" title="링크 걸기">🔗</button>
            <button type="button" data-rcmd="removeFormat" style="${tb}" title="서식 지우기">서식해제</button>
          </div>
          <div id="convReplyBody" contenteditable="true"
            data-placeholder="답장 내용을 입력하세요. 서명은 자동으로 붙습니다."
            style="width:100%;min-height:210px;max-height:44vh;overflow-y:auto;padding:11px 13px;
                   font-size:13.5px;line-height:1.7;border:1px solid #cbd5e1;border-radius:0 0 8px 8px;
                   background:#ffffff;color:#0f172a;outline:none"></div>
        </div>

        <div id="convDraftKo" style="padding:11px 13px;background:#f8fafc;border:1px solid #e2e8f0;
             border-radius:8px;font-size:12.5px;color:#334155;line-height:1.65;min-height:236px;
             max-height:calc(44vh + 30px);overflow-y:auto">
          <div style="font-size:10.5px;font-weight:800;color:#64748b;margin-bottom:6px">
            KR 한글 대역본 <span style="font-weight:400">· 검토용 · 발송되지 않음</span>
          </div>
          <div style="color:#94a3b8">초안을 생성하면 왼쪽 영문 내용이 여기에 한국어로 표시됩니다.</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap">
        <button type="button" id="convReplySend" data-inbound-id="${escapeAttr(lastInbound._id)}"
          style="padding:9px 20px;font-size:13.5px;font-weight:800;border:none;border-radius:8px;
                 background:#2563eb;color:#fff;cursor:pointer">보내기</button>
        <label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#475569;cursor:pointer">
          <input type="checkbox" id="convReplySig" checked style="width:14px;height:14px;cursor:pointer">
          서명 붙이기
        </label>
        <!-- 체크박스 이름만 봐서는 무엇이 붙는지 알 수 없다.
             마우스를 올리면 실제로 붙는 내용을 그대로 보여준다. -->
        <span class="sig-help" style="position:relative;display:inline-flex;align-items:center;
              width:16px;height:16px;justify-content:center;border-radius:50%;background:#e2e8f0;
              color:#475569;font-size:10.5px;font-weight:800;cursor:help;margin-left:-3px">?
          <span class="sig-pop" style="position:absolute;bottom:130%;left:-8px;width:270px;padding:10px 12px;
                background:#0f172a;color:#e2e8f0;border-radius:8px;font-size:11.5px;line-height:1.6;
                font-weight:400;text-align:left;z-index:20;box-shadow:0 6px 18px rgba(0,0,0,.25)">
            <b style="color:#fff">서명 붙이기</b><br>
            켜 두면 답장 맨 아래에 <b>보내는 사람 정보</b>(이름·직함·회사·주소·연락처)가
            자동으로 붙습니다. 본문에 직접 쓸 필요가 없습니다.
            <span style="display:block;margin-top:7px;padding-top:7px;border-top:1px solid #334155;color:#94a3b8">
              내용은 <b style="color:#cbd5e1">설정 · 도구 → 📬 메일 계정</b>에서 계정별로 바꿉니다.
            </span>
          </span>
        </span>
        <span id="convReplyMsg" style="font-size:12px;margin-left:auto"></span>
      </div>
      <div style="margin-top:6px;font-size:10.5px;color:#94a3b8">
        In-Reply-To 헤더가 자동으로 붙어 상대 메일함에서 같은 대화로 묶입니다.
      </div>
    </div>`;
}

// rootId: 이 답장 상자가 들어 있는 모달의 id.
// 대화 모달과 받은메일 상세 모달 둘 다 같은 상자를 쓴다 (구현이 두 벌이면 한쪽만 고쳐진다).
function bindConversationReply(leadId, rootId) {
  const root = document.getElementById(rootId || 'conversationModalRoot');
  if (!root) return;
  const btn = root.querySelector('#convReplySend');
  if (!btn) return;

  // ── 회신 상자 서식 툴바 ──
  // styleWithCSS: <font> 태그 대신 인라인 style 로 넣는다.
  // 메일 클라이언트는 <style>/class 를 지우므로 인라인이어야 서식이 살아남는다.
  try { document.execCommand('styleWithCSS', false, true); } catch {}
  const rbody = root.querySelector('#convReplyBody');
  const keep = (el) => el?.addEventListener('mousedown', (e) => e.preventDefault());

  root.querySelectorAll('[data-rcmd]').forEach((b) => {
    keep(b);
    b.addEventListener('click', () => { document.execCommand(b.dataset.rcmd, false, null); rbody?.focus(); });
  });

  // 선택 영역을 style 로 감싼다 — fontSize 는 execCommand 가 1~7 단계만 지원해
  // px 로 지정하려면 직접 감싸야 한다.
  const wrapSel = (prop, val) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { alert('먼저 바꿀 글자를 선택하세요.'); return; }
    const range = sel.getRangeAt(0);
    if (!rbody || !rbody.contains(range.commonAncestorContainer)) { alert('답장 본문 안에서 선택해 주세요.'); return; }
    const span = document.createElement('span');
    span.style[prop] = val;
    try { span.appendChild(range.extractContents()); range.insertNode(span); } catch {}
  };

  const fs = root.querySelector('#convFontSize');
  keep(fs);
  fs?.addEventListener('change', (e) => {
    if (e.target.value) wrapSel('fontSize', e.target.value + 'px');
    e.target.selectedIndex = 0;
  });

  root.querySelector('#convFontColor')?.addEventListener('input', (e) => {
    document.execCommand('foreColor', false, e.target.value);
  });

  const lk = root.querySelector('#convInsertLink');
  keep(lk);
  lk?.addEventListener('click', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { alert('링크를 걸 글자를 먼저 선택하세요.'); return; }
    const url = prompt('연결할 주소', 'https://');
    if (!url || url === 'https://') return;
    const href = /^(https?:|mailto:)/i.test(url) ? url : 'https://' + url;
    document.execCommand('createLink', false, href);
    rbody?.querySelectorAll('a[href]').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  });

  // ── AI 초안 생성 ──
  // 한국어로 적은 의도를 상대 언어 본문으로 바꿔 회신 상자에 채운다.
  // 발송은 하지 않는다 — 사람이 읽고 고친 뒤 [보내기] 를 눌러야 나간다.
  const draftBtn = root.querySelector('#convDraftBtn');
  draftBtn?.addEventListener('click', async () => {
    const intentEl = root.querySelector('#convDraftIntent');
    const msg = root.querySelector('#convReplyMsg');
    const intent = (intentEl?.value || '').trim();
    if (!intent) {
      msg.innerHTML = '<span style="color:#b91c1c">전달할 내용을 먼저 적어주세요</span>';
      intentEl?.focus();
      return;
    }
    draftBtn.disabled = true;
    draftBtn.textContent = '생성 중…';
    msg.innerHTML = '';
    try {
      const r = await safeJsonFetch('/api/mail/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inboundMailId: draftBtn.dataset.inboundId, intent }),
      });
      if (r.success) {
        // 회신 상자가 contenteditable 이라 .value 가 아니라 .innerHTML 로 넣는다.
        // 초안은 평문이므로 줄바꿈을 <br> 로 바꿔야 문단이 유지된다.
        const ta = root.querySelector('#convReplyBody');
        if (ta) ta.innerHTML = escapeHtml(r.draft.body || '').split('\n').join('<br>');
        const koBox = root.querySelector('#convDraftKo');
        if (koBox) {
          koBox.innerHTML = `
            <div style="font-size:10.5px;font-weight:800;color:#64748b;margin-bottom:6px">KR 한글 대역본 <span style="font-weight:400">· 검토용 · 발송되지 않음</span></div>
            <div style="white-space:pre-wrap">${escapeHtml(r.draft.bodyKo || '')}</div>
            ${r.draft.notes ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;color:#b45309">
              <b>확인 필요</b> · ${escapeHtml(r.draft.notes)}</div>` : ''}`;
          koBox.removeAttribute('hidden');
        }
        msg.innerHTML = `<span style="color:#166534">✅ 초안 생성 (₩${r.krw || 0})</span>`;
      } else {
        msg.innerHTML = `<span style="color:#b91c1c">${escapeHtml(r.error || '실패')}</span>`;
      }
    } catch (e) {
      msg.innerHTML = `<span style="color:#b91c1c">${escapeHtml(String(e.message || e))}</span>`;
    }
    draftBtn.disabled = false;
    draftBtn.textContent = '🧠 초안 생성';
  });

  btn.addEventListener('click', async () => {
    const ta = root.querySelector('#convReplyBody');
    const msg = root.querySelector('#convReplyMsg');
    const text = (ta?.innerHTML || '').trim();
    // 서식 태그만 남고 글자가 없는 경우(빈 <br> 등)를 걸러낸다
    const plainLen = (ta?.innerText || '').trim().length;
    if (!plainLen) {
      msg.innerHTML = '<span style="color:#b91c1c">본문을 입력하세요</span>';
      return;
    }
    btn.disabled = true;
    btn.textContent = '보내는 중…';
    msg.innerHTML = '';
    try {
      const r = await safeJsonFetch('/api/mail/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inboundMailId: btn.dataset.inboundId,
          body: text,
          bodyIsHtml: true,   // 서식 편집기라 본문이 HTML 이다
          appendSignature: root.querySelector('#convReplySig')?.checked !== false,
        }),
      });
      if (r.success) {
        msg.innerHTML = `<span style="color:#166534">✅ ${r.dryRun ? '발송 시뮬레이션 완료' : '보냈습니다'}</span>`;
        // 타임라인을 다시 그려 방금 보낸 회신이 보이게 한다
        setTimeout(() => openConversationModal(leadId), 700);
        invalidateServerPage?.();
      } else {
        msg.innerHTML = `<span style="color:#b91c1c">${escapeHtml(r.error || '실패')}</span>`;
        btn.disabled = false;
        btn.textContent = '보내기';
      }
    } catch (e) {
      msg.innerHTML = `<span style="color:#b91c1c">${escapeHtml(String(e.message || e))}</span>`;
      btn.disabled = false;
      btn.textContent = '보내기';
    }
  });
}

/**
 * 메일 대화 보기 버튼 — 회사명 바로 아래에 둔다.
 *
 * 처음에는 Stage 칸에 넣었는데, 단계 이동 버튼들과 생김새가 같아 묻혔다.
 * 답장이 온 뒤부터는 "무슨 얘기가 오갔나" 를 보는 것이 주요 동작이므로
 * 회사명 옆에서 바로 눈에 띄어야 한다.
 */
function conversationButtonHtml(lead) {
  const stage = lead.stage || 'imported';
  if (!['contacted', 'replied', 'negotiating', 'partner'].includes(stage)) return '';

  const n = lead.inboundCount || 0;
  const hasReply = n > 0;

  // 답장이 온 건은 초록으로 채워 눈에 띄게, 아직 없는 건은 옅게
  const bg = hasReply ? '#16a34a' : '#f1f5f9';
  const fg = hasReply ? '#ffffff' : '#64748b';
  const bd = hasReply ? '#16a34a' : '#cbd5e1';
  const label = hasReply ? `답장 ${n}통 보기` : '보낸 메일 보기';
  const needsReply = lead.needsReply === true;

  return `
    <button type="button" class="conversation-btn" data-conv-lead="${escapeAttr(lead.leadId || lead.id)}"
      title="주고받은 메일 내용 보기"
      style="margin-top:5px;padding:4px 10px;font-size:11px;border:1px solid ${bd};border-radius:99px;
             background:${bg};color:${fg};font-weight:700;cursor:pointer;white-space:nowrap;
             display:inline-flex;align-items:center;gap:4px;
             ${hasReply ? 'box-shadow:0 1px 3px rgba(22,163,74,0.3)' : ''}">
      💬 ${label}${needsReply ? ' ⚠' : ''}
    </button>`;
}

function outreachApprovalCellHtml(lead) {
  // verified 단계에서만 승인 체크박스 노출
  const stage = lead.stage || 'imported';
  if (stage !== 'verified') {
    if (stage === 'contacted' || stage === 'replied' || stage === 'negotiating') {
      return `<span style="font-size:10px;color:#059669;background:#d1fae5;padding:2px 6px;border-radius:99px">✅ 발송됨</span>`;
    }
    if (stage === 'partner') {
      return `<span style="font-size:10px;color:#6b21a8;background:#f3e8ff;padding:2px 6px;border-radius:99px">⭐ 파트너</span>`;
    }
    return `<span style="font-size:10px;color:#9ca3af">—</span>`;
  }
  const on = lead.readyForOutreach === true;
  // white-space:nowrap 이 없으면 좁은 칸에서 "승/인/됨" 으로 세로로 쪼개진다
  return `
    <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;font-size:11.5px;
                  white-space:nowrap" onclick="event.stopPropagation()">
      <input type="checkbox" class="outreach-approval"
        data-approve-lead="${escapeAttr(lead.id)}"
        ${on ? 'checked' : ''}
        style="width:14px;height:14px;cursor:pointer;flex:none">
      <span style="color:${on ? '#166534' : '#6b7280'};font-weight:${on ? '700' : '400'}">
        ${on ? '승인됨' : '승인'}
      </span>
    </label>
  `;
}

// 상대 시간 포맷 ("3일 전" / "5시간 전")
function formatRelativeKo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}달 전`;
  const year = Math.floor(day / 365);
  return `${year}년 전`;
}
function formatDateKo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);  // YYYY-MM-DD
}

function updatedInfoBadgeHtml(lead) {
  // updatedInfoAt > stageChangedAt > registeredAt 우선순위로 가장 최근 활동 시각 표시
  const iso = lead.updatedInfoAt || lead.stageChangedAt || lead.registeredAt || lead.importedAt;
  if (!iso) return '';
  const rel = formatRelativeKo(iso);
  const abs = formatDateKo(iso);
  if (!rel) return '';
  // 오래된 정보 (30일 초과) 는 색상으로 강조
  const stale = (Date.now() - new Date(iso).getTime()) > 30 * 24 * 60 * 60 * 1000;
  const color = stale ? '#dc2626' : '#059669';
  const bg = stale ? '#fef2f2' : '#f0fdf4';
  return `<span class="update-badge" title="정보 업데이트: ${abs}"
    style="display:inline-block;font-size:10px;color:${color};background:${bg};border:1px solid ${color}20;padding:1px 6px;border-radius:99px;margin-top:2px;font-weight:500">
    🕒 ${rel}
  </span>`;
}

// 출처 배치 라벨 (검증완료/실패 페이지에서 각 행에 표시)
function sourceBatchBadgeHtml(lead) {
  const b = lead.importBatch;
  if (!b) return '';
  const m = String(b).match(/(\d{4})(\d{2})(\d{2})/);
  const dateLabel = m ? `${m[1].slice(2)}/${m[2]}/${m[3]}` : b;
  return `<span title="출처 배치: ${escapeAttr(b)}"
    style="display:inline-block;font-size:9px;color:#6366f1;background:#eef2ff;border:1px solid #a5b4fc40;padding:1px 6px;border-radius:99px;margin-top:2px;font-weight:500;margin-left:4px">
    📁 ${dateLabel}
  </span>`;
}

// rank: 추천순 정렬일 때만 넘어온다. null 이면 순위 칸을 그리지 않는다
// (다른 화면에서도 이 함수를 쓰므로 헤더에 순위 열이 없을 때 칸이 밀리면 안 된다)
function rowHtml(lead, rank) {
  const selected = lead.id === state.selectedId ? "selected" : "";
  const checked = state.selectedLeadIds.has(lead.id) ? "checked" : "";
  // 점수 자체보다 "왜 위인지"가 중요하다 — 근거를 툴팁으로 붙인다
  const rankCell = rank == null ? '' : `
      <td style="text-align:center;white-space:nowrap"
          title="${escapeAttr((lead.recoReasons || []).join(' · ') || '근거 없음')}">
        <div style="font-size:13px;font-weight:800;color:var(--text-primary)">${rank}</div>
        <div style="font-size:9.5px;color:var(--text-quaternary)">${lead.recoScore ?? '-'}점</div>
      </td>`;
  return `
    <tr data-id="${escapeHtml(lead.id)}" class="${selected}">
      <td>
        <input class="lead-select" data-select-lead="${escapeAttr(lead.id)}" type="checkbox" ${checked} aria-label="Select ${escapeAttr(lead.Company)}">
      </td>${rankCell}
      <td>
        <div class="company-cell">
          <strong>${escapeHtml(lead.Company)}</strong>
          <!-- 업종은 한국어본이 있으면 그걸 쓴다 (TypeKo). 없으면 원문.
               배치 날짜 배지(📁 26/09/08)는 뺐다 — 우리 쪽 관리용이라
               클라이언트가 보낼지 말지 판단하는 데는 쓰이지 않는데,
               회사명 바로 아래를 차지해 정작 업종이 안 보였다. -->
          <span class="meta-line">${escapeHtml(truncate(lead.TypeKo || lead.Type, 74))}</span>
          ${conversationButtonHtml(lead)}${updatedInfoBadgeHtml(lead)}
        </div>
      </td>
      <td style="font-size:12.5px;color:var(--text-secondary);line-height:1.35">${escapeHtml(lead.Country)}</td>
      <td class="cell-ellipsis" title="${escapeAttr(lead.Email || '')}">${emailCell(lead.Email)}</td>
      <!-- 홈페이지를 한눈에 보는 게 판단에 제일 크다 — 전화보다 앞에, 더 넓게. -->
      <td class="cell-ellipsis" title="${escapeAttr(lead.WebsiteContact || '')}">${websiteLinkHtml(lead.WebsiteContact, { short: true })}</td>
      <!-- 전화번호에 "+48 222 662 877 (B2B/wholesale) / +48 22 602 28 32 (retail…)"
           같은 긴 값이 들어와 표를 옆으로 밀어냈다. 잘라 보여주고 전체는 툴팁으로. -->
      <td class="cell-ellipsis" style="font-size:12px;color:var(--text-tertiary)"
          title="${escapeAttr(lead.Phone || '')}">${escapeHtml(lead.Phone || '—')}</td>
      <!-- 단계 이동 —— 클라이언트가 "이 업체는 아닌데" 싶을 때 여기서 넘긴다.
           Stage 열을 뺄 때 같이 사라졌던 기능이라 되살렸다. -->
      <td>${stageCellHtml(lead)}</td>
    </tr>
  `;
}

// 팝업으로 열어본 리드를 담아두는 곁방 캐시.
//
// baseLeads 는 현재 파이프라인 화면에 보이는 리드만 담는다. 여기에 보관함
// 리드를 밀어 넣으면 상단 통계·필터 숫자가 같이 틀어지므로 섞지 않는다.
// 상세 팝업만 이 캐시를 함께 뒤진다.
var _popupLeadCache = [];

function getLeads() {
  return baseLeads.filter(lead => !lead.deleted);
}

/** 상세 팝업이 찾는 범위 — 화면 목록 + 팝업으로 열어본 것 */
function findLeadForPopup(id) {
  return getLeads().find(l => l.id === id)
      || _popupLeadCache.find(l => l.id === id);
}

/**
 * leadId 든 _id 든 받아서 상세 팝업을 띄운다.
 * 화면 목록에 없는 리드(보관함·기존 데이터)도 열 수 있다.
 */
async function openLeadPopupByObjectId(oid, fallbackLeadId) {
  const cached = fallbackLeadId ? findLeadForPopup(fallbackLeadId) : null;
  if (cached) { openEditModal(cached.id); return; }
  try {
    const r = await safeJsonFetch(`/api/leads/${oid}`);
    if (!r?.lead) throw new Error('리드를 찾을 수 없습니다');
    const lead = { ...r.lead, id: r.lead.leadId };
    _popupLeadCache = _popupLeadCache.filter(l => l.id !== lead.id).concat(lead);
    openEditModal(lead.id);
  } catch (e) {
    alert(`불러오기 실패: ${e.message || e}`);
  }
}

// ── Stage 변경 핸들러 ───────────────────────────────────────
async function handleStageChange(leadId, newStage, selectEl) {
  const lead = baseLeads.find(l => l.id === leadId);
  if (!lead || !lead._id) return;

  // ── 안전 게이트: 이메일 컨택 이동 시 실제 이메일 필수 ─────────
  // 이메일 컨택 = B2B 메일 발송 준비 상태. 메일 없으면 발송 불가 → 이동 자체 차단
  if (newStage === 'contacted') {
    const email = (lead.Email || '').trim();
    const isValid = email && !/^Not found/i.test(email) && /@/.test(email);
    if (!isValid) {
      alert(
        `❌ 이메일 컨택으로 이동 불가\n\n` +
        `"${lead.Company}" 리드에 유효한 이메일이 없습니다.\n\n` +
        `해결책:\n` +
        `1) 검증완료 페이지에서 "🔍 메일 크롤링" 실행\n` +
        `2) 리드 편집으로 이메일 수동 입력\n` +
        `3) 이메일 확보 불가면 검증실패로 이동`
      );
      // 드롭다운이면 원래 값으로 복원
      if (selectEl && selectEl.tagName === 'SELECT') {
        selectEl.value = lead.stage || 'imported';
      }
      return;
    }
  }

  const oldStage = lead.stage || 'imported';
  const oldStyle = STAGE_STYLE[oldStage];
  if (selectEl) {
    selectEl.style.opacity = '0.6';
    selectEl.disabled = true;
  }
  try {
    const res = await fetch(`/api/leads/${lead._id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'stage 변경 실패');
    // 로컬 상태 동기화
    lead.stage = data.data.stage;
    lead.stageChangedAt = data.data.stageChangedAt;
    if (data.data.becamePartnerAt) lead.becamePartnerAt = data.data.becamePartnerAt;
    if (typeof data.data.readyForOutreach === 'boolean') lead.readyForOutreach = data.data.readyForOutreach;
    render();
  } catch (e) {
    alert(`stage 변경 실패: ${e.message || 'unknown'}`);
    if (selectEl) {
      selectEl.value = oldStage;
      selectEl.disabled = false;
      selectEl.style.opacity = '1';
    }
  }
}

// ── 발송 승인 토글 ─────────────────────────────────────────
async function handleOutreachApproval(leadId, on) {
  const lead = baseLeads.find(l => l.id === leadId);
  if (!lead || !lead._id) return;
  try {
    const res = await fetch(`/api/leads/${lead._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readyForOutreach: on }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'approval failed');
    lead.readyForOutreach = on;
    // 라벨 즉시 갱신 (전체 재렌더 최소화)
    render();
  } catch (e) {
    alert(`승인 상태 변경 실패: ${e.message || 'unknown'}`);
    render();
  }
}

// 검증 버킷 매칭
//   즐겨찾기                       → passed (대표 직접 검증)
//   사업관련성 ✅ + 컨택 수단 1+   → passed
//     (이메일/전화/LinkedIn 중 한 개라도 통과해야 실제 접근 가능)
//   종합 5점                       → passed
//   종합 3~4점                     → suspicious
//   종합 0~2점                     → invalid
//   미검증                         → unverified
function verifyBucketOf(lead) {
  // 즐겨찾기는 대표가 직접 확인한 리드 — 자동 검증과 무관하게 통과 처리
  if (lead?.favorite === true) return 'passed';
  const v = lead?.verification;
  if (!v || !v.verifiedAt) return 'unverified';
  // 사업관련성 ✅ 로 통과 처리하려면:
  //   (1) 실제로 사이트에 접근해서 분석한 결과여야 (websiteAlive=true)
  //   (2) 이메일/전화/LinkedIn 중 1개라도 통과 (컨택 가능)
  // 사이트 health 가 false / null 이면 분석 자체가 의심스러우므로 점수 경로로 떨어뜨림
  if (v.businessLevel === 'relevant' && v.websiteAlive === true) {
    const hasContact =
      v.emailValid === true ||
      v.phoneMatch === true ||
      v.linkedinValid === true;
    if (hasContact) return 'passed';
  }
  const s = typeof v.score === 'number' ? v.score : 0;
  if (s >= 5) return 'passed';
  if (s >= 3) return 'suspicious';
  return 'invalid';
}
function verifyBucketMatches(lead, filter) {
  if (!filter || filter === 'All') return true;
  return verifyBucketOf(lead) === filter;
}

// 실패 사유 코드 → 사용자 친화 한국어
const VERIFY_REASON_KO = {
  // email
  'syntax': '형식 오류',
  'disposable': '일회용 메일',
  'no-mx': 'MX 레코드 없음',
  'mx-timeout': 'DNS 타임아웃',
  'mx-error': '도메인 조회 실패',
  // phone
  'too-short': '번호 너무 짧음',
  'unknown-country': '국가 미매핑',
  // linkedin
  'format': 'URL 형식 오류',
  // business relevance
  'no-url': '사이트 없음',
  'fetch-failed': '사이트 접근 실패',
  'invalid-url': 'URL 형식 오류',
  'empty-content': '본문 비어있음',
  // common
  'empty': '값 없음',
};
function businessLevelLabel(level) {
  return level === 'relevant' ? '✅ 뷰티 관련' :
         level === 'unclear'  ? '⚠ 모호함' :
         level === 'unrelated'? '❌ 무관' :
         '⏳ 미확인';
}
function reasonKo(raw) {
  if (!raw) return '';
  if (VERIFY_REASON_KO[raw]) return VERIFY_REASON_KO[raw];
  // "expected +82" 같은 동적 메시지는 그대로 표시
  if (raw.startsWith('expected +')) return `예상 국가코드 ${raw.replace('expected ', '')}`;
  return raw;
}

// 리드 하나의 모든 실패 사유 — [{label, reason}] 형태로 반환
function verifyFailures(lead) {
  // 즐겨찾기 = 대표 검증 완료 — 실패 사유 노출 안 함
  if (lead?.favorite === true) return [];
  const v = lead?.verification;
  if (!v || !v.verifiedAt) return [];
  const out = [];
  if (v.emailValid === false) {
    out.push({ label: '이메일', reason: reasonKo(v.emailReason) || '실패' });
  }
  if (v.websiteAlive === false) {
    const status = v.websiteStatus ? ` (HTTP ${v.websiteStatus})` : ' (응답 없음)';
    out.push({ label: '사이트', reason: '연결 실패' + status });
  }
  if (v.phoneMatch === false) {
    out.push({ label: '전화', reason: reasonKo(v.phoneReason) || '국가코드 불일치' });
  }
  if (v.linkedinValid === false) {
    out.push({ label: 'LinkedIn', reason: reasonKo(v.linkedinReason) || '실패' });
  }
  // 사업 관련성 — 무관/모호도 실패로 분류해 사용자에게 노출
  // 단, 사이트 자체가 없는(no-url) 경우는 웹사이트 체크와 중복이므로 노출 안 함
  if (v.businessLevel === 'unrelated') {
    out.push({ label: '사업관련성', reason: '뷰티 키워드 없음' });
  } else if (v.businessLevel === 'unclear') {
    out.push({ label: '사업관련성', reason: '뷰티 신호 약함' });
  } else if (v.businessLevel === null && v.businessReason && v.businessReason !== 'no-url') {
    out.push({ label: '사업관련성', reason: reasonKo(v.businessReason) });
  }
  return out;
}

// 뱃지 HTML — 테이블 셀에서 사용. invalid/suspicious 면 짧은 사유 같이 표시
// 한국 기업 판별
function isKoreanCompany(country) {
  if (!country) return false;
  const c = String(country);
  return /korea|한국|대한민국/i.test(c) && !/north/i.test(c);
}

// AI 검증 결과 첫 문장 (요약) — 40자 내외로 자르되 단어 경계에서
function summarizeReasoning(text, max = 60) {
  if (!text) return '';
  const s = String(text).trim();
  // 첫 문장 우선
  const firstSentence = s.split(/[.!?。]/)[0].trim();
  const base = firstSentence.length > 10 ? firstSentence : s;
  if (base.length <= max) return base;
  return base.slice(0, max).replace(/\s\S*$/, '') + '…';
}

// AI 판정 배지 — verify-ai 결과 + 검증 시각 + 왜 그렇게 판정됐는지 사유 요약
function aiVerdictBadgeHtml(lead) {
  const v = lead?.verification || {};
  const verifiedAt = v.aiVerifiedAt;
  const relTime = verifiedAt ? formatRelativeKo(verifiedAt) : null;
  const absTime = verifiedAt ? formatDateKo(verifiedAt) : null;

  // ── (a) AI 미검증 리드 — 왜 검증 안됐는지 사유 표시 ────────
  if (!verifiedAt) {
    // 한국 기업이면 정책 제외
    if (isKoreanCompany(lead?.Country)) {
      return `<div style="margin-top:3px;display:flex;flex-direction:column;gap:2px;align-items:flex-start"
        title="한국 기업은 자동 검증에서 제외되어 있음">
        <span style="display:inline-block;padding:1px 6px;border-radius:99px;background:#fef2f2;color:#991b1b;font-size:10px;font-weight:700;border:1px solid #fca5a540">
          ⚠️ 불일치
        </span>
        <span style="font-size:9px;color:var(--text-tertiary);font-weight:500;line-height:1.3">
          🇰🇷 한국 기업 (정책 제외)
        </span>
      </div>`;
    }
    // 나머지 = AI 실행 안 됨 → 대기 상태
    return `<div style="margin-top:3px;display:flex;flex-direction:column;gap:2px;align-items:flex-start"
      title="AI 검증 아직 실행 안 됨. 검증 대기 페이지에서 AI 실행 필요">
      <span style="display:inline-block;padding:1px 6px;border-radius:99px;background:#f1f5f9;color:#475569;font-size:10px;font-weight:700;border:1px solid #cbd5e140">
        ⏳ AI 대기
      </span>
      <span style="font-size:9px;color:var(--text-tertiary);font-weight:500;line-height:1.3">
        검증 실행 필요
      </span>
    </div>`;
  }

  // ── (b) AI 판정 있는 리드 — 판정 + 사유 요약 ──────────────
  const verdict = v.aiVerdict;
  const conf = v.aiConfidence;
  const fullReasoning = v.aiReasoning || '';
  const briefReasoning = summarizeReasoning(fullReasoning, 60);
  const style = {
    'beauty-buyer': { bg: '#dcfce7', fg: '#166534', bd: '#22c55e', label: '🧠 진성 바이어' },
    'maybe':        { bg: '#fef3c7', fg: '#92400e', bd: '#f59e0b', label: '🧠 모호' },
    'not-buyer':    { bg: '#fee2e2', fg: '#991b1b', bd: '#ef4444', label: '🧠 무관' },
  }[verdict] || { bg: '#f1f5f9', fg: '#475569', bd: '#94a3b8', label: '🧠 AI 검증됨' };

  // '검증 완료' 는 이제 단계 이름이라 여기서 쓰면 "그 단계로 갔다"는 뜻으로 읽힌다
  const tip = `AI 판정: ${verdict || '?'} (${conf || '?'})\n검증 시각: ${absTime || '?'}\n\n${fullReasoning}`;

  return `<div style="margin-top:3px;display:flex;flex-direction:column;gap:2px;align-items:flex-start" title="${escapeAttr(tip)}">
    <span style="display:inline-block;padding:1px 6px;border-radius:99px;background:${style.bg};color:${style.fg};font-size:10px;font-weight:700;border:1px solid ${style.bd}40">${style.label}</span>
    ${briefReasoning ? `<span style="font-size:9px;color:var(--text-tertiary);font-weight:500;line-height:1.3;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeAttr(fullReasoning)}">💬 ${escapeHtml(briefReasoning)}</span>` : ''}
    ${relTime ? `<span style="font-size:9px;color:var(--text-tertiary);font-weight:500">📅 ${relTime}</span>` : ''}
  </div>`;
}

function verifyBadgeHtml(lead) {
  // 즐겨찾기는 별도 라벨 — 대표 직접 검증
  if (lead?.favorite === true) {
    return `<span title="대표가 직접 확인한 리드 (즐겨찾기 등록)" style="display:inline-block;padding:2px 8px;border-radius:99px;background:#fef9c3;color:#854d0e;font-size:11px;font-weight:700;white-space:nowrap;border:1px solid #facc15">⭐ 검증완료</span>${aiVerdictBadgeHtml(lead)}`;
  }

  const bucket = verifyBucketOf(lead);
  const styles = {
    passed:      { bg: '#dcfce7', fg: '#166534', label: '✅ 통과' },
    suspicious:  { bg: '#fef3c7', fg: '#92400e', label: '⚠ 의심' },
    invalid:     { bg: '#fee2e2', fg: '#991b1b', label: '❌ 무효' },
    unverified:  { bg: '#f1f5f9', fg: '#64748b', label: '⏳ 미검증' },
  }[bucket];

  const failures = verifyFailures(lead);
  const tooltip = failures.length
    ? `점수 ${lead?.verification?.score ?? '-'}/5\n실패: ${failures.map(f => `${f.label}(${f.reason})`).join(', ')}`
    : `검증 점수: ${lead?.verification?.score ?? '-'}/5`;

  const badge = `<span title="${escapeAttr(tooltip)}" style="display:inline-block;padding:2px 8px;border-radius:99px;background:${styles.bg};color:${styles.fg};font-size:11px;font-weight:600;white-space:nowrap">${styles.label}</span>`;

  // AI 판정 배지 (있는 경우) 를 항상 아래에 표시
  const ai = aiVerdictBadgeHtml(lead);

  // suspicious / invalid 만 짧은 사유 라벨 같이 표시 (테이블에서 한눈에)
  if (bucket === 'suspicious' || bucket === 'invalid') {
    const labels = failures.slice(0, 2).map(f => f.label).join(', ');
    const more = failures.length > 2 ? ` +${failures.length - 2}` : '';
    if (labels) {
      return `${badge}<div style="font-size:10px;color:#6b7280;margin-top:3px;line-height:1.2">${escapeHtml(labels)}${more}</div>${ai}`;
    }
  }
  return badge + ai;
}

// 검증 분류 뷰 — 4개 버킷별로 섹션 카드 + 각 섹션에 대표 리드 상위 10개
function renderVerificationClassification() {
  const all = getLeads();
  const buckets = { passed: [], suspicious: [], invalid: [], unverified: [] };
  for (const l of all) buckets[verifyBucketOf(l)].push(l);

  const sections = [
    { key: 'passed',     label: '✅ 통과 (모든 항목 정상)',   bg: '#dcfce7', fg: '#166534', accent: '#22c55e' },
    { key: 'suspicious', label: '⚠ 의심 (일부 항목 실패)',     bg: '#fef3c7', fg: '#92400e', accent: '#f59e0b' },
    { key: 'invalid',    label: '❌ 무효 (대부분 실패)',       bg: '#fee2e2', fg: '#991b1b', accent: '#ef4444' },
    { key: 'unverified', label: '⏳ 미검증 (아직 검사 안 됨)', bg: '#f1f5f9', fg: '#64748b', accent: '#94a3b8' },
  ];

  const renderPreview = (bucket, items) => {
    if (items.length === 0) {
      return `<p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;padding:16px 0">해당 항목이 없습니다</p>`;
    }
    const preview = items.slice(0, 6).map((lead) => {
      const failures = verifyFailures(lead);
      const failText = failures.length
        ? failures.slice(0, 2).map(f => `${f.label}(${f.reason})`).join(' · ')
        : '';
      return `
        <button type="button" data-verify-lead-id="${escapeAttr(lead.id)}"
          style="display:block;width:100%;text-align:left;padding:8px 10px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;margin-bottom:6px;cursor:pointer;font-size:13px">
          <strong>${escapeHtml(lead.Company || '(이름 없음)')}</strong>
          <span style="color:#9ca3af;margin-left:6px">${escapeHtml(lead.Country || '')}</span>
          ${failText ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${escapeHtml(failText)}</div>` : ''}
        </button>
      `;
    }).join('');
    const more = items.length > 6
      ? `<button type="button" data-verify-bucket-jump="${bucket}" style="width:100%;padding:6px;font-size:12px;color:#4f8cff;background:transparent;border:1px dashed #cbd5e1;border-radius:6px;cursor:pointer;margin-top:4px">+ 나머지 ${items.length - 6}건 전체 보기 →</button>`
      : `<button type="button" data-verify-bucket-jump="${bucket}" style="width:100%;padding:6px;font-size:12px;color:#4f8cff;background:transparent;border:1px dashed #cbd5e1;border-radius:6px;cursor:pointer;margin-top:4px">목록 전체 보기 →</button>`;
    return preview + more;
  };

  els.content.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
      ${sections.map(sec => `
        <section style="background:${sec.bg};border:1px solid ${sec.accent};border-radius:12px;padding:14px 16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <strong style="color:${sec.fg};font-size:14px">${sec.label}</strong>
            <span style="color:${sec.fg};font-size:18px;font-weight:800">${buckets[sec.key].length}</span>
          </div>
          ${renderPreview(sec.key, buckets[sec.key])}
        </section>
      `).join('')}
    </div>
  `;

  // 개별 리드 클릭 → edit 모달
  els.content.querySelectorAll('[data-verify-lead-id]').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.verifyLeadId));
  });

  // "전체 보기" → leads 뷰 + 해당 버킷 필터
  els.content.querySelectorAll('[data-verify-bucket-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = 'leads';
      resetAllFilters();
      state.verify = btn.dataset.verifyBucketJump;
      if (els.verify) els.verify.value = state.verify;
      state.selectedId = getFilteredLeads()[0]?.id || state.selectedId;
      render();
    });
  });
}

// K-beauty 추천 리스트 — 글로벌 발굴 시드 표시 + 선택 후 leads 로 import
var _recommendedCache = null;
// ── Phase 1 스켈레톤: B2B 메일 관리 ──────────────────────────
// ══════════════════════════════════════════════════════════════
// B2B 메일 매니저 — 템플릿 CRUD + 변수 치환 + 리드 대입 미리보기
// ══════════════════════════════════════════════════════════════

const DEFAULT_TEMPLATE_EDITOR = {
  name: '',
  language: 'en',
  subject: '',
  body: '',
  purpose: 'intro',
  bodyIsHtml: false,
  isActive: true,
  appendAccountSignature: true,   // 발송 시 계정 서명 자동 부착
};

async function loadEmailTemplates() {
  try {
    const res = await fetch('/api/email-templates');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'load failed');
    state.email.templates = data.templates || [];
    state.email.variables = data.variables || [];
    state.email.variableGroups = data.variableGroups || [
      { key: 'recipient', label: '받는 사람', icon: '👤', color: '#0ea5e9' },
      { key: 'company',   label: '상대 회사', icon: '🏢', color: '#8b5cf6' },
      { key: 'sender',    label: '발송자 정보', icon: '✉',  color: '#059669' },
    ];
  } catch (e) {
    console.error('[templates] load failed', e);
    state.email.templates = [];
    state.email.variables = [];
    state.email.variableGroups = [];
  }
}

function selectTemplate(templateId) {
  if (state.email.dirty) {
    if (!confirm('편집 중인 내용이 있습니다. 저장하지 않고 다른 템플릿으로 이동할까요?')) return;
  }
  state.email.currentTemplateId = templateId;
  state.email.dirty = false;
  state.email.previewResult = null;
  if (templateId) {
    const t = state.email.templates.find(x => x._id === templateId);
    if (t) {
      state.email.editor = {
        name: t.name || '',
        language: t.language || 'en',
        subject: t.subject || '',
        body: t.body || '',
        purpose: t.purpose || 'intro',
        bodyIsHtml: !!t.bodyIsHtml,
        isActive: t.isActive !== false,
        appendAccountSignature: t.appendAccountSignature !== false,
      };
    }
  } else {
    state.email.editor = { ...DEFAULT_TEMPLATE_EDITOR };
  }
  renderB2BEmailManager();
}

function startNewTemplate() {
  if (state.email.dirty) {
    if (!confirm('편집 중인 내용이 있습니다. 그대로 새 템플릿을 시작할까요?')) return;
  }
  state.email.currentTemplateId = null;
  state.email.editor = { ...DEFAULT_TEMPLATE_EDITOR, name: '' };
  state.email.dirty = false;
  state.email.previewResult = null;
  state.email.wizardStep = 1;
  renderB2BEmailManager();
}

async function saveTemplate() {
  const ed = state.email.editor;
  if (!ed) return;
  if (!ed.name.trim() || !ed.subject.trim() || !ed.body.trim()) {
    alert('이름, 제목, 본문은 필수입니다.');
    return;
  }
  state.email.loading = true;
  renderB2BEmailManager();
  try {
    const url = state.email.currentTemplateId
      ? `/api/email-templates/${state.email.currentTemplateId}`
      : '/api/email-templates';
    const method = state.email.currentTemplateId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ed),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'save failed');
    await loadEmailTemplates();
    state.email.currentTemplateId = data.template._id;
    state.email.dirty = false;
    // 저장하면 목록으로 — 여러 양식을 오가며 관리하는 화면이라
    // 편집기에 머무르면 "저장이 됐나" 를 목록에서 확인할 수 없다.
    state.email.mode = 'list';
  } catch (e) {
    alert('저장 실패: ' + (e.message || 'unknown'));
  } finally {
    state.email.loading = false;
    renderB2BEmailManager();
  }
}

async function deleteTemplate() {
  if (!state.email.currentTemplateId) return;
  const t = state.email.templates.find(x => x._id === state.email.currentTemplateId);
  if (!t) return;
  if (!confirm(`템플릿 "${t.name}"을(를) 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
  try {
    const res = await fetch(`/api/email-templates/${state.email.currentTemplateId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'delete failed');
    await loadEmailTemplates();
    state.email.currentTemplateId = null;
    state.email.editor = { ...DEFAULT_TEMPLATE_EDITOR };
    state.email.dirty = false;
    renderB2BEmailManager();
  } catch (e) {
    alert('삭제 실패: ' + (e.message || 'unknown'));
  }
}

async function refreshPreview() {
  if (!state.email.currentTemplateId) {
    // 저장 안 된 새 템플릿은 로컬 렌더링 (변수 예시 값으로)
    const ed = state.email.editor;
    if (!ed) return;
    const example = {};
    for (const v of state.email.variables) example[v.key] = v.example;
    const renderLocal = (s) => s.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, k) => example[k] || `{{${k}}}`);
    state.email.previewResult = {
      subject: renderLocal(ed.subject),
      body: renderLocal(ed.body),
      bodyIsHtml: ed.bodyIsHtml,
      missing: [],
      leadInfo: null,
    };
    renderB2BEmailManager();
    return;
  }
  try {
    const res = await fetch(`/api/email-templates/${state.email.currentTemplateId}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: state.email.previewLeadId, mailAccountId: state.email.previewAccountId || null }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'preview failed');
    state.email.previewResult = data;
    renderB2BEmailManager();
  } catch (e) {
    alert('미리보기 실패: ' + (e.message || 'unknown'));
  }
}

function insertVariableIntoBody(varKey) {
  const ta = document.getElementById('templateBodyInput');
  if (!ta) return;
  const insertText = `{{${varKey}}}`;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const before = ta.value.substring(0, start);
  const after = ta.value.substring(end);
  ta.value = before + insertText + after;
  state.email.editor.body = ta.value;
  state.email.dirty = true;
  const pos = start + insertText.length;
  ta.focus();
  ta.setSelectionRange(pos, pos);
}

function insertVariableIntoSubject(varKey) {
  const inp = document.getElementById('templateSubjectInput');
  if (!inp) return;
  const insertText = `{{${varKey}}}`;
  const start = inp.selectionStart || inp.value.length;
  const end = inp.selectionEnd || inp.value.length;
  const before = inp.value.substring(0, start);
  const after = inp.value.substring(end);
  inp.value = before + insertText + after;
  state.email.editor.subject = inp.value;
  state.email.dirty = true;
  const pos = start + insertText.length;
  inp.focus();
  inp.setSelectionRange(pos, pos);
}

// ── 자동완성 (typeahead) ─────────────────────────────
// 사용법: 본문에서 "{{" 를 타이핑하면 한글 라벨 드롭다운 표시
// 화살표 ↑/↓ 로 이동 · Enter 선택 · Esc 닫기 · 클릭 선택
var _varSuggest = { el: null, ta: null, items: [], active: 0, triggerPos: -1 };

function ensureSuggestBox() {
  if (_varSuggest.el && document.body.contains(_varSuggest.el)) return _varSuggest.el;
  const box = document.createElement('div');
  box.id = 'varSuggestBox';
  box.style.cssText = `
    position:fixed;z-index:9999;min-width:220px;max-width:320px;
    background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;
    box-shadow:0 6px 20px rgba(0,0,0,0.15);
    padding:6px;display:none;font-family:inherit;
  `;
  document.body.appendChild(box);
  _varSuggest.el = box;
  return box;
}

function hideSuggest() {
  if (_varSuggest.el) _varSuggest.el.style.display = 'none'; syncBodyScrollLock();
  _varSuggest.items = [];
  _varSuggest.triggerPos = -1;
}

function renderSuggest() {
  const box = ensureSuggestBox();
  const groupsMap = {};
  (state.email.variableGroups || []).forEach(g => { groupsMap[g.key] = g; });
  box.innerHTML = _varSuggest.items.map((v, i) => {
    const grp = groupsMap[v.group] || { icon: '📎', color: '#6366f1' };
    const bg = i === _varSuggest.active ? '#eef2ff' : '#ffffff';
    const bd = i === _varSuggest.active ? '#a5b4fc' : 'transparent';
    return `
      <div class="var-suggest-item" data-idx="${i}" data-key="${escapeAttr(v.key)}"
        style="padding:8px 10px;border-radius:8px;cursor:pointer;background:${bg};border:1px solid ${bd};
               display:flex;align-items:center;gap:10px;transition:all 0.05s">
        <span style="font-size:16px">${grp.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.2">${escapeHtml(v.label)}</div>
          <div style="font-size:10px;color:#64748b;font-family:'Menlo',monospace;margin-top:1px">{{${escapeHtml(v.key)}}}</div>
        </div>
      </div>
    `;
  }).join('');
  box.querySelectorAll('.var-suggest-item').forEach(el => {
    el.addEventListener('mouseenter', () => {
      _varSuggest.active = parseInt(el.dataset.idx, 10);
      renderSuggest();
    });
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      pickSuggest(parseInt(el.dataset.idx, 10));
    });
  });
}

function positionSuggestBox(ta) {
  const box = ensureSuggestBox();
  const rect = ta.getBoundingClientRect();
  box.style.display = 'block';
  const boxH = box.offsetHeight || 260;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  // 아래 공간이 부족하면 위로
  const top = (spaceBelow < boxH + 12 && spaceAbove > boxH + 12)
    ? Math.max(8, rect.top - boxH - 6)
    : rect.bottom + 4;
  box.style.left = Math.max(8, Math.min(window.innerWidth - 340, rect.left)) + 'px';
  box.style.top = top + 'px';
}

function pickSuggest(idx) {
  const ta = _varSuggest.ta;
  if (!ta || !_varSuggest.items[idx]) { hideSuggest(); return; }
  const v = _varSuggest.items[idx];
  const cursor = ta.selectionStart;
  const before = ta.value.substring(0, _varSuggest.triggerPos);
  const after = ta.value.substring(cursor);
  const insert = `{{${v.key}}}`;
  ta.value = before + insert + after;
  state.email.editor.body = ta.value;
  state.email.dirty = true;
  const pos = before.length + insert.length;
  ta.focus();
  ta.setSelectionRange(pos, pos);
  hideSuggest();
}

function updateSuggest(ta) {
  const cursor = ta.selectionStart;
  const text = ta.value.substring(0, cursor);
  // "{{" 이후 커서까지 문자열 잡기 (닫는 "}}" 없이)
  const m = text.match(/\{\{([^\{\}]*)$/);
  if (!m) { hideSuggest(); return; }
  const query = m[1].toLowerCase();
  const triggerPos = cursor - m[0].length;
  _varSuggest.triggerPos = triggerPos;
  _varSuggest.ta = ta;
  const all = state.email.variables || [];
  const items = all.filter(v => {
    if (!query) return true;
    return v.key.toLowerCase().includes(query)
      || (v.label || '').toLowerCase().includes(query)
      || (v.description || '').toLowerCase().includes(query);
  }).slice(0, 8);
  if (!items.length) { hideSuggest(); return; }
  _varSuggest.items = items;
  if (_varSuggest.active >= items.length) _varSuggest.active = 0;
  renderSuggest();
  positionSuggestBox(ta);
}

function attachVariableAutocomplete(textareaId) {
  const ta = document.getElementById(textareaId);
  if (!ta || ta.dataset.varAutocomplete === '1') return;
  ta.dataset.varAutocomplete = '1';
  ta.addEventListener('input', () => updateSuggest(ta));
  ta.addEventListener('click', () => updateSuggest(ta));
  ta.addEventListener('keyup', (e) => {
    if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) updateSuggest(ta);
  });
  ta.addEventListener('keydown', (e) => {
    if (!_varSuggest.items.length || (_varSuggest.el && _varSuggest.el.style.display === 'none')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _varSuggest.active = (_varSuggest.active + 1) % _varSuggest.items.length;
      renderSuggest();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _varSuggest.active = (_varSuggest.active - 1 + _varSuggest.items.length) % _varSuggest.items.length;
      renderSuggest();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pickSuggest(_varSuggest.active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideSuggest();
    }
  });
  ta.addEventListener('blur', () => setTimeout(hideSuggest, 150));
}


/** 양식 용도 — 목록에서 한눈에 구분되게 */
const TEMPLATE_PURPOSE_KO = {
  intro: { label: '첫 소개', bg: '#e0e7ff', fg: '#3730a3' },
  followup: { label: '팔로우업', bg: '#fef3c7', fg: '#92400e' },
  're-engage': { label: '재접촉', bg: '#ffedd5', fg: '#9a3412' },
  'partner-onboarding': { label: '파트너 온보딩', bg: '#f3e8ff', fg: '#6b21a8' },
  other: { label: '기타', bg: '#f1f5f9', fg: '#475569' },
};

/**
 * 📝 메일 양식 — 목록(게시판).
 *
 * 영업 담당자마다, 상황마다 쓰는 문구가 다르다. 하나만 편집하는 화면이면
 * 그때그때 덮어쓰는 수밖에 없어서 지난 문구가 남지 않는다. 여러 개 저장해
 * 두고 발송할 때 고르는 편이 실제 쓰임에 맞다.
 */
function renderTemplateListPage(templates) {
  const list = (templates || []).slice().sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  const fmt = (v) => v
    ? new Date(v).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
    : '—';
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  els.content.innerHTML = `
    <div style="max-width:940px;margin:0 auto;padding-bottom:32px">

      <!-- 머리말 -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;
                  flex-wrap:wrap;padding:4px 2px 16px">
        <div style="min-width:0">
          <h3 style="margin:0;font-size:19px;font-weight:800;color:var(--text-primary);
                     letter-spacing:-.01em">메일 양식</h3>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:5px;line-height:1.65">
            상황별로 양식을 만들어 두고, 메일 보낼 때 골라 씁니다.
            <code style="background:var(--brand-soft,#eef2ff);padding:2px 7px;border-radius:5px;
                         color:var(--brand-text,#4338ca);font-weight:700;font-size:12px">[회사명]</code>
            을 넣으면 각 회사 이름으로 바뀝니다.
          </div>
        </div>
        <button id="tplNewBtn" type="button"
          style="font-size:13.5px;font-weight:700;padding:11px 20px;white-space:nowrap;
                 background:var(--brand,#4f46e5);color:#fff;border:none;border-radius:10px;
                 cursor:pointer;box-shadow:0 2px 8px rgba(79,70,229,.28)">
          + 새 양식 작성
        </button>
      </div>

      ${!list.length ? `
        <div style="padding:56px 28px;text-align:center;background:var(--bg-surface);
                    border:1px dashed var(--border-default);border-radius:14px">
          <div style="font-size:38px;margin-bottom:12px;opacity:.5">📝</div>
          <div style="font-size:15px;font-weight:800;color:var(--text-primary)">저장된 양식이 없습니다</div>
          <div style="font-size:13px;margin-top:7px;line-height:1.7;color:var(--text-tertiary)">
            [+ 새 양식 작성] 을 눌러 첫 양식을 만들어 주세요.<br>
            만든 양식은 <b style="color:var(--text-secondary)">발송 관리 → 보낼 메일</b> 에서 고를 수 있습니다.
          </div>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:11px">
          ${list.map((t) => {
            const p = TEMPLATE_PURPOSE_KO[t.purpose] || TEMPLATE_PURPOSE_KO.other;
            const preview = truncate(strip(t.body), 140);
            return `
            <div class="tpl-card" data-tpl-id="${escapeAttr(t._id)}"
                 title="클릭하면 이 양식을 엽니다"
                 style="position:relative;background:var(--bg-surface);
                        border:1px solid var(--border-default);border-radius:13px;
                        padding:17px 19px 17px 23px;cursor:pointer;overflow:hidden;
                        box-shadow:0 1px 2px rgba(16,24,40,.04);
                        transition:box-shadow .14s ease, border-color .14s ease, transform .14s ease">
              <!-- 용도별 색 띠 — 목록을 훑을 때 종류가 먼저 읽히게 -->
              <span style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${p.fg};opacity:.85"></span>

              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px">
                <div style="min-width:0;flex:1">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <strong style="font-size:15px;font-weight:800;color:var(--text-primary);
                                   letter-spacing:-.01em">${escapeHtml(t.name || '(이름 없음)')}</strong>
                    <span style="padding:2px 9px;background:${p.bg};color:${p.fg};border-radius:99px;
                                 font-size:10.5px;font-weight:800;letter-spacing:.02em">${p.label}</span>
                    ${t.isActive === false
                      ? '<span style="padding:2px 9px;background:var(--bg-surface-hover);color:var(--text-tertiary);border-radius:99px;font-size:10.5px;font-weight:700">사용 안 함</span>'
                      : ''}
                  </div>

                  <div style="display:flex;align-items:baseline;gap:7px;margin-top:9px;min-width:0">
                    <span style="font-size:10.5px;font-weight:800;color:var(--text-quaternary);
                                 letter-spacing:.04em;flex-shrink:0">제목</span>
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary);
                                 overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                      ${escapeHtml(t.subject || '(제목 없음)')}
                    </span>
                  </div>

                  <div style="font-size:12px;color:var(--text-tertiary);margin-top:7px;line-height:1.65;
                              display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
                              overflow:hidden">
                    ${escapeHtml(preview) || '(본문 없음)'}
                  </div>
                </div>

                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;flex-shrink:0">
                  <span style="font-size:11px;color:var(--text-quaternary);white-space:nowrap">
                    ${fmt(t.updatedAt)} 수정
                  </span>
                  <div style="display:flex;gap:6px">
                    <button type="button" class="tpl-copy" data-tpl-id="${escapeAttr(t._id)}"
                      title="이 양식을 복사해 새로 만듭니다"
                      style="font-size:11.5px;font-weight:600;padding:6px 12px;
                             border:1px solid var(--border-default);border-radius:8px;
                             background:var(--bg-surface);color:var(--text-secondary);cursor:pointer">복사</button>
                    <button type="button" class="tpl-del" data-tpl-id="${escapeAttr(t._id)}"
                      title="이 양식을 삭제합니다"
                      style="font-size:11.5px;font-weight:600;padding:6px 12px;
                             border:1px solid var(--border-default);border-radius:8px;
                             background:var(--bg-surface);color:#dc2626;cursor:pointer">삭제</button>
                  </div>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>

        <div style="margin-top:16px;padding:13px 17px;background:var(--bg-surface-alt);
                    border:1px solid var(--border-subtle);border-radius:11px;
                    font-size:12px;color:var(--text-tertiary);line-height:1.7">
          💡 비슷한 문구가 필요하면 <b style="color:var(--text-secondary)">복사</b> 로 변형본을 만드세요.
          담당자마다, 상황마다 다른 양식을 따로 두고 발송할 때 고르면 됩니다.
        </div>
      `}
    </div>`;

  // 카드 hover — 인라인 스타일이라 CSS 선택자 대신 직접 건다
  els.content.querySelectorAll('.tpl-card').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      el.style.boxShadow = '0 4px 14px rgba(16,24,40,.09)';
      el.style.borderColor = 'var(--brand,#4f46e5)';
      el.style.transform = 'translateY(-1px)';
    });
    el.addEventListener('mouseleave', () => {
      el.style.boxShadow = '0 1px 2px rgba(16,24,40,.04)';
      el.style.borderColor = 'var(--border-default)';
      el.style.transform = 'none';
    });
  });

  document.getElementById('tplNewBtn')?.addEventListener('click', () => openTemplateEditor(null));

  els.content.querySelectorAll('.tpl-card').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.tpl-del') || e.target.closest('.tpl-copy')) return;
      openTemplateEditor(el.dataset.tplId);
    });
  });

  els.content.querySelectorAll('.tpl-copy').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = (state.email.templates || []).find((x) => x._id === b.dataset.tplId);
      if (!t) return;
      // 복사본은 저장 전 상태로 연다 — currentTemplateId 를 비워 POST 로 나가게 한다
      openTemplateEditor(null, { ...t, _id: undefined, name: `${t.name} (복사본)` });
    });
  });

  els.content.querySelectorAll('.tpl-del').forEach((b) => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const t = (state.email.templates || []).find((x) => x._id === b.dataset.tplId);
      if (!t) return;
      if (!confirm(`양식 "${t.name}" 을(를) 삭제합니다.\n되돌릴 수 없습니다. 진행할까요?`)) return;
      try {
        const r = await safeJsonFetch(`/api/email-templates/${t._id}`, { method: 'DELETE' });
        if (!r?.success) throw new Error(r?.error || '삭제 실패');
        await loadEmailTemplates();
        if (state.email.currentTemplateId === t._id) state.email.currentTemplateId = null;
        renderB2BEmailManager();
      } catch (err) {
        alert('삭제 실패: ' + (err.message || 'unknown'));
      }
    });
  });
}

/** 목록에서 하나를 열거나(id) 새로 쓴다(null). seed 는 복사본용 초기값. */
function openTemplateEditor(id, seed) {
  const t = seed || (id ? (state.email.templates || []).find((x) => x._id === id) : null);
  state.email.currentTemplateId = seed ? null : (id || null);
  state.email.editor = t ? {
    name: t.name || '',
    language: 'en',
    subject: t.subject || '',
    body: t.body || '',
    purpose: t.purpose || 'intro',
    bodyIsHtml: true,
    isActive: t.isActive !== false,
    appendAccountSignature: t.appendAccountSignature !== false,
    adPrefix: t.adPrefix === true,
  } : { ...DEFAULT_TEMPLATE_EDITOR, language: 'en', bodyIsHtml: true };
  state.email.dirty = !!seed;      // 복사본은 저장이 필요한 상태로 연다
  state.email.mode = 'edit';
  renderB2BEmailManager();
}

async function renderB2BEmailManager() {
  // 최초 진입 시 템플릿 + 메일 계정 병렬 로드
  if (state.email.templates.length === 0 && state.email.variables.length === 0) {
    els.content.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">템플릿 로드 중...</div>`;
    await Promise.all([loadEmailTemplates(), loadMailAccounts()]);
    if (!state.email.editor) {
      state.email.editor = { ...DEFAULT_TEMPLATE_EDITOR };
    }
  } else if (!_mailAccounts) {
    await loadMailAccounts();
  }

  // 미리보기용 샘플 리드 후보 (승인/컨택중 등에서 100건만)
  const previewCandidates = baseLeads.filter(l =>
    (l.stage === 'verified' && l.readyForOutreach) ||
    l.stage === 'contacted' || l.stage === 'replied' || l.stage === 'negotiating'
  ).slice(0, 100);

  // ── 목록(게시판) 모드 ───────────────────────────────────
  // 예전에는 첫 템플릿을 자동으로 열어 그 하나만 편집하게 했다. 그러면 양식을
  // 여러 개 만들어 상황에 맞게 골라 쓸 수가 없다. 기본은 목록이고, 거기서
  // 골라 들어가거나 새로 쓴다.
  const templates = state.email.templates;
  if (state.email.mode !== 'edit') {
    renderTemplateListPage(templates);
    return;
  }
  if (!state.email.editor) {
    state.email.editor = { ...DEFAULT_TEMPLATE_EDITOR, name: '메일 양식', language: 'en', bodyIsHtml: true };
  }
  // 강제 영문 + HTML
  state.email.editor.language = 'en';
  state.email.editor.bodyIsHtml = true;
  const ed = state.email.editor;

  els.content.innerHTML = `
    <!-- 단일 양식 편집 -->
    <div id="tplEditorBox" style="max-width:960px;margin:0 auto;background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;padding:22px;display:flex;flex-direction:column;gap:14px;min-height:calc(100vh - 220px);box-shadow:0 1px 3px rgba(16,24,40,.05)">

      <!-- 상단 헤더 + 저장 -->
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="min-width:0;flex:1">
          <button id="tplBackBtn" type="button"
            style="font-size:12px;padding:5px 12px;margin-bottom:8px;border-radius:8px;cursor:pointer;
                   border:1px solid var(--border-default);background:var(--bg-surface);color:var(--text-secondary)">
            ← 양식 목록으로
          </button>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            <label style="flex:1;min-width:220px">
              <span style="font-size:12px;color:var(--text-secondary);font-weight:700">양식 이름 <span style="color:#dc2626">*</span></span>
              <input id="templateNameInput" type="text" value="${escapeAttr(ed.name || '')}"
                placeholder="예: 첫 소개 — 유럽 유통사용"
                style="width:100%;padding:10px 13px;border:1px solid #cbd5e1;border-radius:8px;
                       font-size:14px;font-weight:700;margin-top:4px;background:#ffffff;color:#0f172a">
            </label>
            <label style="min-width:150px">
              <span style="font-size:12px;color:var(--text-secondary);font-weight:700">용도</span>
              <select id="templatePurposeSel"
                style="width:100%;padding:10px 11px;border:1px solid #cbd5e1;border-radius:8px;
                       font-size:13px;margin-top:4px;background:#ffffff;color:#0f172a">
                ${Object.entries(TEMPLATE_PURPOSE_KO).map(([k, v]) =>
                  `<option value="${k}" ${ (ed.purpose || 'intro') === k ? 'selected' : ''}>${v.label}</option>`).join('')}
              </select>
            </label>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:7px">
            발송할 메일을 그대로 작성하세요. 회사명 자리엔 <code style="background:#eef2ff;padding:2px 8px;border-radius:4px;color:#4338ca;font-weight:700">[회사명]</code> · 서명은 자동.
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-secondary);font-weight:600;cursor:pointer">
            <input type="checkbox" id="tplAdPrefix" ${ed.adPrefix ? 'checked' : ''}>
            <span>(광고) 접두사 자동</span>
          </label>
          <button id="saveTemplateBtn" type="button" style="font-size:13px;font-weight:700;padding:9px 22px;background:${state.email.dirty ? '#15803d' : '#94a3b8'};color:white;border:none;border-radius:8px;cursor:pointer;box-shadow:0 2px 6px rgba(21,128,61,0.25)" ${state.email.loading ? 'disabled' : ''}>
            ${state.email.loading ? '⏳ 저장 중...' : (state.email.dirty ? '💾 저장' : '✅ 저장됨')}
          </button>
        </div>
      </div>

      <!-- 제목 -->
      <div>
        <label style="font-size:12px;color:var(--text-secondary);font-weight:700">제목 <span style="color:#dc2626">*</span></label>
        <input id="templateSubjectInput" type="text" value="${escapeAttr(ed.subject)}"
          style="width:100%;padding:12px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;margin-top:4px;background:#ffffff;color:#0f172a"
          placeholder="예: K-beauty partnership inquiry — [회사명]">
        ${ed.adPrefix ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">실제 발송 제목: <code style="color:#dc2626;font-weight:600">(광고)</code> ${escapeHtml(ed.subject || '(제목 미입력)')}</div>` : ''}
      </div>

      <!-- 리치 텍스트 툴바 + 본문 -->
      <div style="display:flex;flex-direction:column;flex:1;min-height:340px">
        <label style="font-size:12px;color:var(--text-secondary);font-weight:700">본문 (서식 지원)</label>
        <div id="tplToolbar" style="display:flex;gap:2px;flex-wrap:wrap;align-items:center;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px 8px 0 0;padding:6px;margin-top:4px">
          <!-- 메일은 웹폰트를 못 쓴다. 수신자 PC 에 이미 깔려 있는 글꼴만 넣는다.
               (Pretendard 같은 걸 지정해도 상대 메일함에서는 기본 글꼴로 떨어진다) -->
          <select id="tplFontFamily" title="글꼴" style="padding:6px 6px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a">
            <option value="">글꼴</option>
            <option value="Arial, Helvetica, sans-serif">기본 (Arial)</option>
            <option value="'Malgun Gothic','맑은 고딕',sans-serif">맑은 고딕</option>
            <option value="Dotum,'돋움',sans-serif">돋움</option>
            <option value="Gulim,'굴림',sans-serif">굴림</option>
            <option value="Helvetica, Arial, sans-serif">Helvetica</option>
            <option value="Georgia,'Times New Roman',serif">Georgia</option>
            <option value="'Times New Roman', Times, serif">Times</option>
            <option value="Verdana, Geneva, sans-serif">Verdana</option>
            <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
            <option value="'Trebuchet MS', Helvetica, sans-serif">Trebuchet</option>
            <option value="'Courier New', Courier, monospace">Courier</option>
          </select>
          <select id="tplFontSize" title="글자 크기" style="padding:6px 6px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a">
            <option value="">크기</option>
            <option value="12">12px</option>
            <option value="13">13px</option>
            <option value="14">14px</option>
            <option value="15">15px</option>
            <option value="16">16px</option>
            <option value="18">18px</option>
            <option value="20">20px</option>
            <option value="24">24px</option>
          </select>
          <div style="width:1px;background:#cbd5e1;margin:0 3px"></div>
          <button type="button" data-cmd="bold" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a;font-weight:800" title="굵게 (Ctrl+B)"><b>B</b></button>
          <button type="button" data-cmd="italic" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a;font-style:italic" title="기울임 (Ctrl+I)"><i>I</i></button>
          <button type="button" data-cmd="underline" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a;text-decoration:underline" title="밑줄 (Ctrl+U)"><u>U</u></button>
          <button type="button" data-cmd="strikeThrough" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a;text-decoration:line-through" title="취소선">S</button>
          <label title="글자 색" style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a">
            <span style="font-weight:800">A</span>
            <input type="color" id="tplFontColor" value="#111827"
                   style="width:22px;height:18px;padding:0;border:none;background:none;cursor:pointer">
          </label>
          <div style="width:1px;background:#cbd5e1;margin:0 3px"></div>
          <button type="button" data-cmd="insertUnorderedList" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a" title="글머리 목록">• 목록</button>
          <button type="button" data-cmd="insertOrderedList" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a" title="번호 목록">1. 목록</button>
          <div style="width:1px;background:#cbd5e1;margin:0 3px"></div>
          <button type="button" data-cmd="justifyLeft" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a" title="왼쪽 정렬">좌</button>
          <button type="button" data-cmd="justifyCenter" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a" title="가운데 정렬">중앙</button>
          <button type="button" data-cmd="justifyRight" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a" title="오른쪽 정렬">우</button>
          <div style="width:1px;background:#cbd5e1;margin:0 3px"></div>
          <button type="button" id="tplInsertLink" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a;color:#1d4ed8;font-weight:700" title="선택한 글자에 링크 걸기">🔗 링크</button>
          <button type="button" id="tplUnlink" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a" title="링크 해제">링크해제</button>
          <div style="width:1px;background:#cbd5e1;margin:0 3px"></div>
          <button type="button" data-cmd="removeFormat" style="padding:6px 10px;background:white;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:12px;color:#0f172a" title="서식 지우기">서식해제</button>
          <div style="flex:1"></div>
          <button type="button" id="insertCompanyMarker" style="padding:6px 12px;background:#eef2ff;border:1px solid #a5b4fc;border-radius:4px;cursor:pointer;font-size:12px;color:#4338ca;font-weight:700" title="회사명 자동 대체 마커 삽입">➕ [회사명]</button>
        </div>
        <div id="templateBodyRich" contenteditable="true"
          style="width:100%;flex:1;padding:16px 20px;border:1px solid #cbd5e1;border-top:none;border-radius:0 0 8px 8px;font-size:14px;font-family:inherit;min-height:340px;line-height:1.75;background:#ffffff;color:#0f172a;outline:none;overflow-y:auto">${ed.bodyIsHtml && ed.body ? ed.body : (ed.body ? escapeHtml(ed.body).replace(/\n/g, '<br>') : '')}</div>
      </div>

        <!-- 서명 미리보기 (선택한 계정 기반) -->
        <div style="padding:12px 14px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px">
          <div style="font-size:11px;font-weight:700;color:#166534;margin-bottom:6px">✍ 발송 시 자동으로 붙는 서명</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <select id="sigAccountSelect" style="flex:1;padding:8px 10px;border:1px solid #86efac;border-radius:6px;font-size:12px;background:#ffffff;color:#0f172a">
              <option value="">— 서명에 사용할 메일 계정 선택 —</option>
              ${(_mailAccounts || []).map(a => `
                <option value="${escapeAttr(a._id)}" ${a._id === state.email.previewAccountId ? 'selected' : ''}>
                  ${escapeHtml(a.accountName)} · ${escapeHtml(a.fromAddress || a.smtpUser)}
                </option>
              `).join('')}
            </select>
          </div>
          ${(() => {
            const acc = (_mailAccounts || []).find(a => a._id === state.email.previewAccountId);
            if (!acc) return `<div style="margin-top:8px;font-size:11px;color:#166534">계정을 선택하면 실제 붙을 서명이 여기 표시됩니다.</div>`;
            const bits = [];
            if (acc.fromName) bits.push(`<b>${escapeHtml(acc.fromName)}</b>`);
            if (acc.senderTitle) bits.push(escapeHtml(acc.senderTitle));
            if (acc.fromName || acc.senderTitle) bits.push('');
            if (acc.senderCompany) bits.push(`<b>${escapeHtml(acc.senderCompany)}</b>`);
            if (acc.senderAddress) bits.push(`A: ${escapeHtml(acc.senderAddress)}`);
            if (acc.senderPhone) bits.push(`M: ${escapeHtml(acc.senderPhone)}`);
            if (acc.senderWebsite) bits.push(`&nbsp;&nbsp;&nbsp;${escapeHtml(acc.senderWebsite)}`);
            return `<div style="margin-top:10px;padding:12px 14px;background:white;border:1px solid #86efac;border-radius:6px;font-size:12px;line-height:1.7;color:#111827">${bits.map(b => b === '' ? '<br>' : `<div>${b}</div>`).join('')}</div>`;
          })()}
        </div>

        <!-- 미리보기 (실제 발송 대상 리드 기준) -->
        <div style="padding:12px 14px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px">
            <div style="font-size:11px;font-weight:700;color:#334155">👁 실제 발송 미리보기 (샘플 회사)</div>
            <select id="previewLeadSelect" style="max-width:280px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;background:#ffffff;color:#0f172a">
              <option value="">— 예시 회사 —</option>
              ${previewCandidates.slice(0, 100).map(l => `
                <option value="${escapeAttr(l.leadId)}" ${l.leadId === state.email.previewLeadId ? 'selected' : ''}>
                  ${escapeHtml(l.Company)}
                </option>
              `).join('')}
            </select>
          </div>
          ${(() => {
            const sampleCompany = (() => {
              if (state.email.previewLeadId) {
                const l = previewCandidates.find(x => x.leadId === state.email.previewLeadId);
                if (l) return l.Company || 'Acme Beauty Co.';
              }
              return previewCandidates[0]?.Company || 'Acme Beauty Co.';
            })();
            const applyMarkers = (s) => (s || '').replace(/\[회사명\]/g, sampleCompany).replace(/\{\{\s*Company\s*\}\}/g, sampleCompany);
            const subj = applyMarkers(ed.subject) || '(제목 없음)';
            const body = applyMarkers(ed.body) || '(본문 없음)';
            return `
              <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                <div style="padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:700;color:#111827">${escapeHtml(subj)}</div>
                <div style="padding:14px 16px;font-size:13px;line-height:1.65;color:#111827;white-space:pre-wrap">${escapeHtml(body)}</div>
              </div>
              <div style="margin-top:6px;font-size:10px;color:#64748b">🎯 샘플: <b>${escapeHtml(sampleCompany)}</b> · 실제 발송 시 각 리드별 회사명으로 치환</div>
            `;
          })()}
        </div>

      <!-- 숨겨진 필드 (하위 호환) -->
      <input type="hidden" id="templateNameInput" value="${escapeAttr(ed.name || '메일 양식')}">
      <input type="hidden" id="templateLangInput" value="en">
      <input type="hidden" id="templatePurposeInput" value="intro">
      <input type="hidden" id="templateHtmlInput" value="1">
      <input type="hidden" id="templateSigInput" value="1">
    </div>
  `;

  // ── 이벤트 바인딩 ─────────────────────────────────────────
  document.getElementById('saveTemplateBtn')?.addEventListener('click', saveTemplate);

  // 목록으로 — 저장 안 한 내용이 있으면 확인하고 나간다
  document.getElementById('tplBackBtn')?.addEventListener('click', () => {
    if (state.email.dirty &&
        !confirm('저장하지 않은 내용이 있습니다.\n목록으로 나가면 사라집니다. 나갈까요?')) return;
    state.email.mode = 'list';
    state.email.dirty = false;
    renderB2BEmailManager();
  });

  // 양식 이름 · 용도 — 목록에서 구분하는 값이라 편집기 맨 위에 둔다
  document.getElementById('templateNameInput')?.addEventListener('input', (e) => {
    state.email.editor.name = e.target.value;
    state.email.dirty = true;
    const btn = document.getElementById('saveTemplateBtn');
    if (btn) { btn.style.background = '#15803d'; btn.textContent = '💾 저장'; }
  });
  document.getElementById('templatePurposeSel')?.addEventListener('change', (e) => {
    state.email.editor.purpose = e.target.value;
    state.email.dirty = true;
    const btn = document.getElementById('saveTemplateBtn');
    if (btn) { btn.style.background = '#15803d'; btn.textContent = '💾 저장'; }
  });

  // 서명 계정 선택 → 미리보기 갱신
  document.getElementById('sigAccountSelect')?.addEventListener('change', (e) => {
    state.email.previewAccountId = e.target.value || null;
    renderB2BEmailManager();
  });
  // 미리보기 리드 선택
  document.getElementById('previewLeadSelect')?.addEventListener('change', (e) => {
    state.email.previewLeadId = e.target.value || null;
    renderB2BEmailManager();
  });

  // (광고) 접두사 토글
  document.getElementById('tplAdPrefix')?.addEventListener('change', (e) => {
    state.email.editor.adPrefix = e.target.checked;
    state.email.dirty = true;
    renderB2BEmailManager();
  });

  // ── 리치 에디터 툴바 ──────────────────────────────────────
  // styleWithCSS: 서식을 <font> 태그가 아니라 style="" 인라인으로 넣게 한다.
  // 메일 클라이언트는 <style> 블록이나 클래스를 대부분 지우므로,
  // 인라인 style 로 들어가야 상대 메일함에서 서식이 살아남는다.
  try { document.execCommand('styleWithCSS', false, true); } catch {}

  const syncRich = () => {
    const rich = document.getElementById('templateBodyRich');
    if (!rich) return;
    state.email.editor.body = rich.innerHTML;
    state.email.editor.bodyIsHtml = true;
    state.email.dirty = true;
    markSaveDirty();
  };
  // 툴바를 누르는 순간 본문 선택이 풀리면 서식이 엉뚱한 데 걸린다 → mousedown 차단
  const keepFocus = (el) => el?.addEventListener('mousedown', (e) => e.preventDefault());

  document.querySelectorAll('#tplToolbar button[data-cmd]').forEach(btn => {
    keepFocus(btn);
    btn.addEventListener('click', () => {
      document.execCommand(btn.dataset.cmd, false, null);
      syncRich();
    });
  });

  // 글꼴 — execCommand('fontName') 은 <font face> 를 만들어서 메일에서 잘 깨진다.
  // 선택 영역을 style="font-family:…" 로 감싸는 편이 안전하다.
  const wrapSelection = (styleProp, value) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      alert('먼저 본문에서 바꿀 글자를 선택하세요.');
      return false;
    }
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style[styleProp] = value;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
      const r2 = document.createRange();
      r2.selectNodeContents(span);
      sel.addRange(r2);
    } catch {
      return false;
    }
    return true;
  };

  const fontSel = document.getElementById('tplFontFamily');
  keepFocus(fontSel);
  fontSel?.addEventListener('change', (e) => {
    if (e.target.value && wrapSelection('fontFamily', e.target.value)) syncRich();
    e.target.selectedIndex = 0;
  });

  const sizeSel = document.getElementById('tplFontSize');
  keepFocus(sizeSel);
  sizeSel?.addEventListener('change', (e) => {
    if (e.target.value && wrapSelection('fontSize', e.target.value + 'px')) syncRich();
    e.target.selectedIndex = 0;
  });

  const colorInput = document.getElementById('tplFontColor');
  colorInput?.addEventListener('input', (e) => {
    document.execCommand('foreColor', false, e.target.value);
    syncRich();
  });

  // 링크 — createLink 로 만든 <a> 에 target/rel 을 직접 붙인다.
  // 메일에서 열리는 링크는 새 창으로 뜨는 편이 자연스럽고,
  // rel 이 없으면 일부 클라이언트가 경고를 띄운다.
  const linkBtn = document.getElementById('tplInsertLink');
  keepFocus(linkBtn);
  linkBtn?.addEventListener('click', () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      alert('링크를 걸 글자를 먼저 선택하세요.\n(예: "자세히 보기" 를 드래그한 뒤 🔗 링크)');
      return;
    }
    const url = prompt('연결할 주소를 입력하세요', 'https://');
    if (!url || url === 'https://') return;
    const href = /^(https?:|mailto:)/i.test(url) ? url : 'https://' + url;
    document.execCommand('createLink', false, href);
    const rich = document.getElementById('templateBodyRich');
    rich?.querySelectorAll(`a[href="${CSS.escape(href)}"]`).forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.style.color = '#1d4ed8';
    });
    syncRich();
  });

  const unlinkBtn = document.getElementById('tplUnlink');
  keepFocus(unlinkBtn);
  unlinkBtn?.addEventListener('click', () => { document.execCommand('unlink', false, null); syncRich(); });

  // [회사명] 마커 삽입
  document.getElementById('insertCompanyMarker')?.addEventListener('mousedown', (e) => e.preventDefault());
  document.getElementById('insertCompanyMarker')?.addEventListener('click', () => {
    document.execCommand('insertText', false, '[회사명]');
    const rich = document.getElementById('templateBodyRich');
    if (rich) {
      state.email.editor.body = rich.innerHTML;
      state.email.dirty = true;
      markSaveDirty();
    }
  });

  // 리치 본문 편집 → state 동기화
  const rich = document.getElementById('templateBodyRich');
  if (rich) {
    rich.addEventListener('input', () => {
      state.email.editor.body = rich.innerHTML;
      state.email.editor.bodyIsHtml = true;
      state.email.dirty = true;
      markSaveDirty();
    });
  }

  function markSaveDirty() {
    const saveBtn = document.getElementById('saveTemplateBtn');
    if (saveBtn && !state.email.loading) {
      saveBtn.textContent = '💾 저장';
      saveBtn.style.background = '#15803d';
    }
  }

  // 제목 입력 → state
  document.getElementById('templateSubjectInput')?.addEventListener('input', (e) => {
    state.email.editor.subject = e.target.value;
    state.email.dirty = true;
    markSaveDirty();
  });

  document.querySelectorAll('.tpl-item').forEach(el => {
    el.addEventListener('click', () => selectTemplate(el.dataset.tplId));
  });

  // 폼 입력 → editor state 반영
  const bindEditor = (id, key, prop = 'value') => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      state.email.editor[key] = prop === 'checked' ? el.checked : el.value;
      state.email.dirty = true;
      // 저장 버튼만 갱신 (재렌더 하면 포커스 잃음)
      const saveBtn = document.getElementById('saveTemplateBtn');
      if (saveBtn && !state.email.loading) saveBtn.textContent = '💾 저장*';
    });
    if (prop === 'checked') {
      el.addEventListener('change', () => {
        state.email.editor[key] = el.checked;
        state.email.dirty = true;
      });
    }
  };
  bindEditor('templateNameInput', 'name');
  bindEditor('templateLangInput', 'language');
  bindEditor('templatePurposeInput', 'purpose');
  bindEditor('templateSubjectInput', 'subject');
  bindEditor('templateBodyInput', 'body');
  bindEditor('templateHtmlInput', 'bodyIsHtml', 'checked');
  bindEditor('templateSigInput', 'appendAccountSignature', 'checked');

  // 자동완성: 본문에 {{ 타이핑하면 한글 라벨 드롭다운
  attachVariableAutocomplete('templateBodyInput');
  attachVariableAutocomplete('templateSubjectInput');

  // 미리보기 리드 선택 → 자동 렌더
  document.getElementById('previewAccountSelect')?.addEventListener('change', (e) => {
    state.email.previewAccountId = e.target.value || null;
    if (state.email.currentTemplateId) refreshPreview();
  });
  document.getElementById('previewLeadSelect')?.addEventListener('change', (e) => {
    state.email.previewLeadId = e.target.value || null;
    refreshPreview();
  });
}

// ── Phase 1 스켈레톤: 이메일 크롤링 ─────────────────────────
// ══════════════════════════════════════════════════════════════
// 🕷 이메일 크롤링 대시보드 — 대기열 · 결과 · 벌크 실행
// ══════════════════════════════════════════════════════════════
var _crawlState = {
  scopeSel: 'verified',        // 검증완료 리드만 대상 (검증대기는 크롤링 안 함)
  chunkLimit: 50,
  running: false,
  runResults: [],              // { chunk, processed, found, promoted, ts }
};

// ══════════════════════════════════════════════════════════════
// 📬 메일 계정 관리 (다계정 SMTP 등록/관리)
// ══════════════════════════════════════════════════════════════
var _mailAccounts = null;   // 캐시 (컴포즈 모달도 공유)

async function loadMailAccounts(force) {
  if (!force && _mailAccounts) return _mailAccounts;
  try {
    const res = await fetch('/api/mail-accounts');
    const data = await res.json();
    if (data.success) { _mailAccounts = data.accounts || []; return _mailAccounts; }
  } catch {}
  _mailAccounts = [];
  return _mailAccounts;
}

// ══════════════════════════════════════════════════════════════
// 📖 사용 설명서 (User Guide) 페이지
// ══════════════════════════════════════════════════════════════
/**
 * 📖 사용 설명서 — 클라이언트가 매일 하는 일을 순서대로.
 *
 * 예전 설명서는 지금 없는 화면(AI 서칭·검증 대기·크롤링·등급별 발송)을 설명하고,
 * 예약이 "5분마다" 나간다는 등 실제와 다른 내용을 담고 있었다. 화면과 설명이
 * 어긋나면 설명서를 믿지 않게 되므로, 지금 있는 화면만 순서대로 다시 적는다.
 */
function renderUserGuidePage() {
  const stepCard = (n, icon, title, lead, doList, note, tone) => `
    <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;
                padding:20px 22px;display:flex;gap:16px;align-items:flex-start;
                box-shadow:0 1px 3px rgba(16,24,40,.05)">
      <div style="min-width:40px;height:40px;background:${tone || 'linear-gradient(135deg,#4f8cff,#3b6fe0)'};
                  color:#fff;border-radius:11px;display:flex;align-items:center;justify-content:center;
                  font-size:16px;font-weight:800;flex-shrink:0">${n}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:5px;flex-wrap:wrap">
          <span style="font-size:18px">${icon}</span>
          <h3 style="margin:0;font-size:15.5px;font-weight:800;color:var(--text-primary)">${title}</h3>
        </div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.75">${lead}</div>
        ${doList ? `
          <div style="margin-top:11px;background:var(--bg-surface-alt);border:1px solid var(--border-subtle);
                      border-radius:9px;padding:11px 14px">
            <div style="font-size:10.5px;font-weight:800;color:var(--text-quaternary);
                        letter-spacing:.04em;margin-bottom:6px">여기서 하는 것</div>
            <div style="font-size:12.5px;color:var(--text-secondary);line-height:1.85">${doList}</div>
          </div>` : ''}
        ${note ? `
          <div style="margin-top:9px;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;
                      padding:10px 14px;font-size:12.5px;color:#78350f;line-height:1.7">${note}</div>` : ''}
      </div>
    </div>`;

  const navChip = (label) =>
    `<b style="background:var(--brand-soft,#eef2ff);color:var(--brand-text,#4338ca);
      padding:2px 8px;border-radius:6px;font-size:12px;white-space:nowrap">${label}</b>`;

  els.content.innerHTML = `
    <div style="max-width:900px;margin:0 auto;padding-bottom:40px">

      <!-- 한눈에 보는 흐름 -->
      <div style="background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);
                  border:1px solid #c7d2fe;border-radius:16px;padding:22px 24px;margin-bottom:18px">
        <h2 style="margin:0 0 6px;font-size:19px;font-weight:800;color:#312e81">
          업체 하나가 거쳐 가는 길
        </h2>
        <div style="font-size:13px;color:#3730a3;line-height:1.7;margin-bottom:16px">
          왼쪽 사이드바가 곧 순서입니다. 위에서 아래로 내려갑니다.
        </div>
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12.5px;font-weight:700">
          <span style="background:#fff;color:#166534;padding:7px 13px;border-radius:9px;
                       border:1px solid #86efac">✅ 검증 완료</span>
          <span style="color:#6366f1">→</span>
          <span style="background:#fff;color:#075985;padding:7px 13px;border-radius:9px;
                       border:1px solid #7dd3fc">📋 발송 리스트</span>
          <span style="color:#6366f1">→</span>
          <span style="background:#fff;color:#b45309;padding:7px 13px;border-radius:9px;
                       border:1px solid #fcd34d">📅 예약 발송</span>
          <span style="color:#6366f1">→</span>
          <span style="background:#fff;color:#1e40af;padding:7px 13px;border-radius:9px;
                       border:1px solid #93c5fd">📨 발송 완료</span>
          <span style="color:#6366f1">→</span>
          <span style="background:#fff;color:#3730a3;padding:7px 13px;border-radius:9px;
                       border:1px solid #a5b4fc">💬 답장 받음</span>
        </div>
        <div style="margin-top:14px;font-size:12.5px;color:#3730a3;line-height:1.7">
          가운데 셋(발송 리스트 · 예약 발송 · 발송 완료)은 ${navChip('📨 발송 관리')} 안의 탭입니다.
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">

        ${stepCard(1, '✅', '검증 완료 — 보낼 곳을 고릅니다',
          '검증을 통과해 <b>메일을 보낼 수 있는</b> 업체 목록입니다. 매일 여기서 시작합니다.',
          `· 회사를 클릭하면 <b>상세 정보</b>가 열립니다 — 업종·홈페이지·검증 근거를 보고 판단하세요.<br>
           · 아닌 곳은 이동 버튼으로 <b>🚫 검증 실패</b> 또는 <b>📦 보관함</b> 으로 빼세요.<br>
           · 보낼 곳은 왼쪽 체크박스를 누른 뒤 <b>[📋 발송 리스트로 옮기기]</b>.<br>
           · 위쪽 <b>정렬</b>을 <b>추천순</b>으로 두면 가능성 높은 곳부터 나옵니다.`,
          '옮기지 않은 곳에는 <b>메일이 절대 나가지 않습니다.</b> 여기서 고른 것만 발송 대상이 됩니다.')}

        ${stepCard(2, '📝', '메일 양식 — 보낼 문구를 만듭니다',
          `${navChip('⚙ 설정·도구 → 📝 메일 양식')} 에서 관리합니다. 상황별로 여러 개 만들어 두고 골라 씁니다.`,
          `· <b>[+ 새 양식 작성]</b> 으로 새 문구를 만듭니다.<br>
           · 회사명 자리에 <code style="background:#eef2ff;padding:1px 6px;border-radius:4px;color:#4338ca;font-weight:700">[회사명]</code> 을 넣으면 각 회사 이름으로 바뀝니다.<br>
           · 비슷한 문구가 필요하면 <b>복사</b> 로 변형본을 만드세요.<br>
           · 용도(첫 소개 / 팔로우업 / 재접촉)를 정해 두면 목록에서 구분됩니다.`,
          '서명은 자동으로 붙습니다. 보내는 계정에 저장된 이름·직함·연락처가 들어갑니다.')}

        ${stepCard(3, '✉️', '보낼 메일 — 문구를 확인하고 보냅니다',
          `${navChip('📨 발송 관리')} → <b>보낼 메일</b> 탭. 옮겨둔 업체가 여기 모입니다.`,
          `· 왼쪽에서 <b>양식</b>과 <b>보내는 계정</b>을 고릅니다.<br>
           · 오른쪽에 <b>실제로 나갈 모습</b>이 회사명이 바뀐 채로 보입니다. 회사를 바꿔 가며 확인하세요.<br>
           · 문구를 그 자리에서 고칠 수 있습니다 (이번 발송에만 적용).<br>
           · 아래에서 <b>나눠 보내기</b>와 <b>자동 재발송</b>을 정합니다.<br>
           · <b>[보내기]</b> 를 누르면 예약으로 깔립니다.`,
          '표에서 회사를 클릭하면 상세가 열립니다. 보내기 전에 마지막으로 걸러낼 수 있습니다.')}

        ${stepCard(4, '📅', '예약 발송 — 언제 누구에게 나갈지',
          '누른 즉시 나가지 않습니다. 날짜별로 쌓이고, 시각이 되면 자동으로 나갑니다.',
          `· 어느 회사에 며칠 나갈지 <b>날짜별로 묶여</b> 보입니다.<br>
           · 나가기 전이면 <b>[취소]</b> 로 뺄 수 있습니다.<br>
           · 나가지 못한 건은 <b>⚠️ 사유</b>와 함께 아래에 남습니다.`,
          '메일은 <b>하루 최대 20통</b>, 한 통과 다음 통 사이 <b>8초</b>를 쉬며 나갑니다. ' +
          '한꺼번에 보내면 스팸으로 걸려, 같은 주소로 나가는 실제 거래 메일까지 스팸함으로 갑니다.')}

        ${stepCard(5, '📨', '발송 완료 — 며칠에 몇 번째로 보냈나',
          '실제로 나간 곳입니다. 날짜별로 묶여 있고, 업체마다 몇 번째 메일인지 표시됩니다.',
          `· <b>메일 1회 발송 → 2회 → 3회</b> 로 색이 진해집니다 (최대 3회).<br>
           · 답이 없으면 <b>무응답 N일</b> 로 표시됩니다.<br>
           · 위쪽 요약에서 <b>2번 보냈는데 무응답</b> · <b>3번 다 씀</b> 을 한눈에 봅니다.`,
          '답장이 오면 그 업체는 <b>자동으로 [💬 답장 받음] 으로 옮겨가고 여기서 사라집니다.</b> ' +
          '더 이상 광고 메일이 나가지 않습니다.')}

        ${stepCard(6, '💬', '답장 받음 — 답하고, 아닌 곳은 뺍니다',
          '상대가 답장을 보낸 곳입니다. 여기서부터는 사람이 직접 대응합니다.',
          `· <b>[💬 답장 N통 보기]</b> 로 주고받은 내용을 열고 <b>회신</b>합니다.<br>
           · 얘기가 되겠으면 <b>🤝 대화 진행 중</b> → 계약되면 <b>⭐ 파트너십 확정</b>.<br>
           · 우리랑 안 맞으면 <b>🚫 컨택 실패</b> 로 뺍니다.<br>
           · 지금은 아니지만 나중에 볼 곳은 <b>📦 보관함</b>.`,
          null,
          'linear-gradient(135deg,#6366f1,#4f46e5)')}

        ${stepCard(7, '📬', '메일함 — 들어온 메일을 봅니다',
          `사이드바 ${navChip('📬 메일함')} 은 회사 단위가 아니라 <b>메일 단위</b>로 봅니다. 최근 2개월 기준입니다.`,
          `· <b>받은 메일함</b> — 거래처 폴더별로 나눠 봅니다. 광고·자동발송은 접힙니다.<br>
           · <b>회신 필요</b> — 상대가 물었는데 아직 답 안 한 메일.<br>
           · <b>기한 관리</b> — 본문에서 자동으로 찾아낸 회신 기한. 지난 것부터 나옵니다.`,
          `여기 숫자는 ${navChip('📬 메일 계정')} 에서 지정한 <b>대표 계정</b> 기준입니다. ` +
          '대표 계정을 바꾸면 메일함이 통째로 그 계정 것으로 바뀝니다.')}
      </div>

      <!-- 안전장치 -->
      <div style="margin-top:18px;background:var(--bg-surface);border:1px solid var(--border-default);
                  border-radius:14px;padding:20px 22px">
        <h3 style="margin:0 0 12px;font-size:15.5px;font-weight:800;color:var(--text-primary)">
          🛡 잘못 나가지 않게 막아둔 것들
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:11px">
          ${[
            ['골라야만 나갑니다', '검증 완료에서 발송 리스트로 옮긴 곳에만 메일이 갑니다.'],
            ['같은 곳에 최대 3회', '첫 메일 + 재발송 2번. 그 이상은 자동으로 막힙니다.'],
            ['48시간 간격', '마지막 발송 후 이틀이 지나지 않으면 다시 나가지 않습니다.'],
            ['답장 오면 즉시 중단', '답장이 온 업체에는 광고 메일이 더 나가지 않습니다.'],
            ['하루 20통', '한꺼번에 쏟지 않습니다. 남은 것은 다음 날로 넘어갑니다.'],
            ['메일 주소 없으면 제외', '보낼 수 없는 곳은 발송 리스트로 옮겨지지 않습니다.'],
          ].map(([t, d]) => `
            <div style="background:var(--bg-surface-alt);border:1px solid var(--border-subtle);
                        border-radius:10px;padding:12px 14px">
              <div style="font-size:12.5px;font-weight:800;color:var(--text-primary);margin-bottom:4px">${t}</div>
              <div style="font-size:12px;color:var(--text-tertiary);line-height:1.65">${d}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- 지금 테스트 중 -->
      <div id="guideLockBox" style="margin-top:14px"></div>

      <!-- 자주 묻는 것 -->
      <div style="margin-top:14px;background:var(--bg-surface);border:1px solid var(--border-default);
                  border-radius:14px;padding:20px 22px">
        <h3 style="margin:0 0 12px;font-size:15.5px;font-weight:800;color:var(--text-primary)">
          ❓ 자주 묻는 것
        </h3>
        ${[
          ['보내기를 눌렀는데 왜 바로 안 나가나요?',
           '예약으로 깔리기 때문입니다. 하루 20통씩 나눠서 나갑니다. [📅 예약 발송] 탭에서 언제 누구에게 나갈지 볼 수 있습니다.'],
          ['업체가 목록에서 사라졌어요.',
           '답장이 오면 [💬 답장 받음] 으로 자동으로 옮겨갑니다. 지워진 것이 아니라 다음 단계로 넘어간 것입니다.'],
          ['같은 곳에 또 보내고 싶은데 안 됩니다.',
           '한 곳에 최대 3번까지만 나갑니다. 마지막 발송 후 48시간도 지나야 합니다. 스팸으로 걸리지 않기 위한 제한입니다.'],
          ['메일 문구를 바꾸고 싶어요.',
           '[📝 메일 양식] 에서 고쳐 저장하면 다음 발송부터 적용됩니다. 이번 한 번만 다르게 보내려면 발송 화면에서 직접 고치면 됩니다.'],
          ['받은 메일함 숫자가 이상합니다.',
           '[📬 메일 계정] 의 대표 계정 기준으로 셉니다. 대표 계정을 바꾸면 그 계정 메일함으로 바뀝니다.'],
        ].map(([q, a]) => `
          <div style="padding:11px 0;border-top:1px solid var(--border-subtle)">
            <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px">Q. ${q}</div>
            <div style="font-size:12.5px;color:var(--text-secondary);line-height:1.75">${a}</div>
          </div>`).join('')}
      </div>
    </div>`;

  // 발송 잠금 상태는 서버에서 받아 채운다 — 설명서에 고정 문구로 박아두면
  // 잠금을 푼 뒤에도 "테스트 중" 이라고 남아 거짓말이 된다.
  loadOutboundStatus().then((lock) => {
    const box = document.getElementById('guideLockBox');
    if (!box) return;
    box.innerHTML = lock && lock.locked ? `
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:14px;padding:18px 22px">
        <div style="font-size:14.5px;font-weight:800;color:#78350f;margin-bottom:6px">
          🔒 지금은 테스트 중입니다
        </div>
        <div style="font-size:12.5px;color:#78350f;line-height:1.75">
          실제 업체로는 메일이 <b>나가지 않습니다</b>.
          ${(lock.testRecipients || []).length
            ? `테스트 주소 <b style="font-family:monospace">${(lock.testRecipients || []).map(escapeHtml).join(', ')}</b> 로만 실제 발송됩니다.`
            : ''}
          나머지는 버튼을 눌러도 "발송 잠금 중" 으로 기록만 남습니다.<br>
          화면을 미리 익혀 두셔도 <b>사고가 나지 않습니다.</b>
        </div>
      </div>` : `
      <div style="background:#dcfce7;border:1px solid #86efac;border-radius:14px;padding:18px 22px">
        <div style="font-size:14.5px;font-weight:800;color:#166534;margin-bottom:6px">
          📤 발송이 열려 있습니다
        </div>
        <div style="font-size:12.5px;color:#166534;line-height:1.75">
          예약 시각이 되면 실제 업체로 메일이 나갑니다.
          하루 최대 ${(lock && lock.dailyCap) || 20}통까지입니다.
        </div>
      </div>`;
  }).catch(() => {});
}

function outboxPreviewVars(lead) {
  const out = {};
  for (const v of (state.email.variables || [])) {
    out[v.key] = (lead && lead[v.key]) || v.example || '';
  }
  out.SenderName = '요기보';
  out.SenderCompany = 'Yogico';
  out.SenderEmail = _mailerEnvCache?.from || 'partnerships@yogico.kr';
  return out;
}
function outboxSubstitute(src, vars) {
  return (src || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g,
    (_, k) => vars[k] != null && vars[k] !== '' ? String(vars[k]) : `{{${k}}}`);
}

/* ═══════════════════════════════════════════════════════════════
   발송 관리 — 보낼 메일 → 예약 발송 → 발송 완료

   메일이 지나가는 순서대로 목록 셋으로 나눈다.
     ✉️ 보낼 메일   — 발송 리스트(queued)로 옮겨둔 곳. 여기서 묶음 발송/예약.
     📅 예약 발송   — 예약을 잡아둔 것. 시각이 되면 자동으로 아래로 내려간다.
     ✅ 발송 완료   — 실제로 나간 것. 답장이 오면 [답장 받음]으로 빠진다.
   ═══════════════════════════════════════════════════════════════ */
var _outboxTab = 'ready';             // ready / scheduled / sent
var _outboxReadyIds = [];             // [보낼 메일] 이 지금 화면에 띄운 대상 (모달과 공유)
var _outboundStatusCache = null;      // { locked, message, dailyCap, intervalMs, testRecipients }

// 보낼 메일 탭의 양식 — 화면 안에서 바로 고치고 미리 본다
var _outboxCompose = {
  templateId: null,
  mailAccountId: null,
  subject: '',
  body: '',
  previewLeadId: null,
  dirty: false,        // 사용자가 문구를 직접 고쳤으면 양식 값으로 덮지 않는다
  // ── 나눠 보내기 ──
  // 100곳을 한 번에 쏘면 수신 서버가 대량 발송으로 본다. 같은 도메인으로
  // 실거래 메일도 나가기 때문에 평판이 깎이면 그쪽까지 스팸함으로 간다.
  batchSize: 30,
  intervalMinutes: 10,
  startNow: true,
  startAt: '',         // startNow=false 일 때 쓰는 datetime-local 값
  // ── 자동 재발송 ──
  followUp: true,
  followUpDays: 7,
};

/** 아웃바운드 잠금 상태 — 버튼을 눌러보기 전에 화면에서 알 수 있어야 한다 */
async function loadOutboundStatus(force) {
  if (!force && _outboundStatusCache) return _outboundStatusCache;
  try {
    const d = await safeJsonFetch('/api/mail/outbound-status');
    if (d && d.success) { _outboundStatusCache = d; return d; }
  } catch (e) { console.warn('outbound-status', e); }
  // 못 받아왔으면 잠긴 것으로 본다 — 모르는 채로 보내는 쪽이 더 위험하다
  _outboundStatusCache = { locked: true, message: '발송 가능 여부를 확인하지 못했습니다.', dailyCap: 0, intervalMs: 0 };
  return _outboundStatusCache;
}

var _schedStatusFilter = 'pending';   // pending / sent / failed / canceled / all

async function fetchScheduledMails(status) {
  const res = await fetch(`/api/mail/schedule?status=${encodeURIComponent(status)}&limit=500`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'load failed');
  return data.items || [];
}

async function renderOutboxPage() {
  els.content.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-tertiary)">로드 중...</div>`;

  const [lock, schedData] = await Promise.all([
    loadOutboundStatus(),
    safeJsonFetch('/api/mail/schedule?status=all&limit=500').catch(() => null),
    loadStageCounts().catch(() => null),   // 발송 완료 탭의 "답장 와서 넘어간 곳"
  ]);
  if (!state.email.templates.length) await loadEmailTemplates().catch(() => {});
  if (!(_mailAccounts || []).length) await loadMailAccounts().catch(() => {});
  await refreshMailerEnv().catch(() => {});

  const all = (schedData && schedData.items) || [];
  const pending  = all.filter((i) => i.status === 'pending');
  const sentSched = all.filter((i) => i.status === 'sent');
  const failed   = all.filter((i) => i.status === 'failed');
  const canceled = all.filter((i) => i.status === 'canceled');

  // 이 화면은 baseLeads 에 기대면 안 된다.
  // 사이드바 진입 처리는 pipeline-verifying / pipeline-import 일 때만 loadLeads()
  // 를 부른다. 그래서 발송 관리로 바로 들어오면 baseLeads 가 비어 있고, 옮겨둔
  // 곳이 있는데도 화면이 통째로 비어 보였다. 필요한 단계만 직접 가져온다.
  const [queuedRes, contactedRes] = await Promise.all([
    safeJsonFetch('/api/leads?stage=queued&limit=2000').catch(() => null),
    safeJsonFetch('/api/leads?stage=contacted&limit=2000').catch(() => null),
  ]);
  const queuedLeads = ((queuedRes && queuedRes.data) || []).map((l) => ({ ...l, id: l.leadId }));
  const sentLeads = ((contactedRes && contactedRes.data) || []).map((l) => ({ ...l, id: l.leadId }));

  // 상세 팝업(openEditModal)은 baseLeads 에서 찾는다 — 여기서 가져온 것도 보이게 합친다
  const known = new Set(baseLeads.map((l) => l.id));
  const extra = [...queuedLeads, ...sentLeads].filter((l) => !known.has(l.id));
  if (extra.length) baseLeads = baseLeads.concat(extra);

  // 예약을 이미 잡아둔 곳은 '보낼 메일'에서 빼야 두 번 잡지 않는다
  const scheduledLeadIds = new Set(pending.map((i) => i.leadId));
  const hasEmail = (l) => l && l.Email && !/^Not found/i.test(l.Email) && /@/.test(l.Email);
  // 보낼 메일 = 사람이 [발송 리스트로 옮기기] 를 눌러 queued 로 올린 것만.
  // 검증만 끝난 것(verified)까지 여기 넣으면 고르는 단계가 없어진다.
  const ready = queuedLeads.filter((l) =>
    !l.deleted && hasEmail(l) && !scheduledLeadIds.has(l.leadId));

  _outboxReadyIds = ready.map((l) => l.leadId);
  outboxSyncCompose(ready);

  // 탭은 "몇 곳인지" 와 "그게 어느 업체인지" 를 같이 알려야 한다.
  // 목록이 아래에 있어도 스크롤해야 보이니, 탭에서 바로 열 수 있게 한다.
  const tab = (key, icon, label, n, tone) => {
    const on = _outboxTab === key;
    return `<div class="outbox-tab" data-tab="${key}"
      style="flex:1;min-width:172px;padding:11px 14px;border-radius:10px;cursor:pointer;
             border:1px solid ${on ? tone : 'var(--border-default)'};
             background:${on ? tone + '14' : 'var(--bg-surface)'};
             box-shadow:${on ? 'inset 0 0 0 1px ' + tone : 'none'}">
      <div style="font-size:11.5px;font-weight:700;color:${on ? tone : 'var(--text-tertiary)'}">${icon} ${label}</div>
      <div style="display:flex;align-items:baseline;gap:5px;margin-top:1px">
        <span style="font-size:20px;font-weight:800;color:var(--text-primary);line-height:1.2">${n.toLocaleString()}</span>
        <span style="font-size:12px;font-weight:700;color:var(--text-tertiary)">곳</span>
      </div>
      ${n ? `<button type="button" class="outbox-peek" data-peek="${key}"
        title="어느 업체인지 목록으로 봅니다"
        style="margin-top:6px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;
               border:1px solid ${tone}55;background:${tone}12;color:${tone};cursor:pointer">
        🔍 업체 보기
      </button>` : `<div style="margin-top:6px;font-size:11px;color:var(--text-quaternary)">해당 없음</div>`}
    </div>`;
  };

  els.content.innerHTML = `
    <div style="max-width:1180px;margin:0 auto">
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button id="outboxHowBtn" type="button"
          title="메일이 어떤 순서로 나가는지 봅니다"
          style="font-size:12px;font-weight:700;padding:6px 13px;border-radius:99px;cursor:pointer;
                 background:var(--brand-soft,#eef2ff);color:var(--brand-text,#4338ca);
                 border:1px solid var(--brand,#c7d2fe)">
          ❓ 발송 로직 — 메일이 나가는 순서
        </button>
      </div>
      ${outboxLockBannerHtml(lock)}

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
        ${tab('ready',     '✉️', '보낼 메일',  ready.length,      '#2563eb')}
        ${tab('scheduled', '📅', '예약 발송',  pending.length,    '#b45309')}
        ${tab('sent',      '✅', '발송 완료',  sentSched.length + sentLeads.length, '#166534')}
      </div>

      <div id="outboxBody"></div>
    </div>`;

  const body = document.getElementById('outboxBody');
  if (_outboxTab === 'ready')     body.innerHTML = outboxReadyHtml(ready, lock);
  if (_outboxTab === 'scheduled') body.innerHTML = outboxScheduledHtml(pending, failed, canceled);
  if (_outboxTab === 'sent')      body.innerHTML = outboxSentHtml(sentSched, sentLeads);

  document.querySelectorAll('.outbox-tab').forEach((b) =>
    b.addEventListener('click', (e) => {
      if (e.target.closest('.outbox-peek')) return;   // 목록 보기는 탭 전환이 아니다
      _outboxTab = b.dataset.tab;
      renderOutboxPage();
    }));

  document.querySelectorAll('.outbox-peek').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const k = b.dataset.peek;
      if (k === 'ready') openOutboxPeek('보낼 메일', ready, { kind: 'lead' });
      if (k === 'scheduled') openOutboxPeek('예약 발송', pending, { kind: 'schedule' });
      if (k === 'sent') openOutboxPeek('발송 완료', sentLeads, { kind: 'lead', sent: true });
    }));

  outboxBindComposeInputs(ready);
  document.getElementById('outboxGoVerified')?.addEventListener('click', () =>
    document.querySelector('.nav-item[data-view="pipeline-verified"]')?.click());

  document.getElementById('outboxSendBtn')?.addEventListener('click', () => runOutboxCampaign(ready, lock));
  document.getElementById('outboxHowBtn')?.addEventListener('click', () => openSendLogicModal(lock));
  document.getElementById('obGoTemplates')?.addEventListener('click', () => {
    state.email.mode = 'list';
    document.querySelector('.nav-item[data-view="tool-b2b-email"]')?.click();
  });

  document.querySelectorAll('.outbox-sched-cancel').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('이 예약을 취소합니다. 이 회사에는 메일이 나가지 않습니다.')) return;
      try {
        await safeJsonFetch(`/api/mail/schedule/${b.dataset.schedId}`, { method: 'DELETE' });
        renderOutboxPage();
      } catch (e) { alert(`취소 실패: ${e.message || e}`); }
    }));

  // baseLeads 는 id 를 leadId 로 맞춰 두므로 그대로 상세 팝업을 연다
  document.querySelectorAll('.outbox-lead-open').forEach((el) =>
    el.addEventListener('click', (e) => {
      if (e.target.closest('.outbox-unqueue')) return;   // 빼기는 상세 열기가 아니다
      openEditModal(el.dataset.leadId);
    }));

  // 발송 리스트에서 빼기 — 잘못 올렸거나 이미 컨택된 곳을 되돌린다.
  // 이 화면에는 단계 이동 버튼이 없어서, 한 번 올리면 뺄 방법이 없었다.
  document.querySelectorAll('.outbox-unqueue').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = b.dataset.leadId;
      const lead = ready.find((l) => l.leadId === id);
      const name = (lead && lead.Company) || id;
      if (!confirm(`"${name}" 을(를) 발송 리스트에서 뺍니다.

[✅ 검증 완료] 로 되돌아가고, 메일은 나가지 않습니다.
진행할까요?`)) return;
      b.disabled = true; b.textContent = '⏳';
      try {
        const r = await safeJsonFetch('/api/leads/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadIds: [id], undo: true }),
        });
        if (!r?.success) throw new Error(r?.error || '되돌리기 실패');
        invalidateServerPage();
        loadStageCounts(true);
        renderOutboxPage();
      } catch (err) {
        alert('되돌리기 실패: ' + (err.message || 'unknown'));
        b.disabled = false; b.textContent = '↩ 빼기';
      }
    }));
}

/** 발송 잠금 배너 — 지금 메일이 나가는 상태인지 화면 맨 위에서 못 박는다 */
function outboxLockBannerHtml(lock) {
  if (!lock || !lock.locked) {
    return `
      <div style="padding:12px 16px;background:#dcfce7;border:1px solid #86efac;border-radius:11px;
                  display:flex;align-items:center;gap:11px">
        <span style="font-size:19px">📤</span>
        <div style="flex:1;font-size:13px;color:#166534;line-height:1.55">
          <b>발송이 열려 있습니다.</b> 예약 시각이 되면 메일이 실제로 나갑니다.
          ${lock?.dailyCap ? `<span style="color:#15803d"> · 하루 최대 ${lock.dailyCap}통 · ${Math.round((lock.intervalMs || 0) / 1000)}초 간격</span>` : ''}
        </div>
      </div>`;
  }
  const tests = lock.testRecipients || [];
  return `
    <div style="padding:13px 16px;background:#fef3c7;border:1px solid #fcd34d;border-radius:11px;
                display:flex;align-items:flex-start;gap:11px">
      <span style="font-size:19px">🔒</span>
      <div style="flex:1;font-size:13px;color:#78350f;line-height:1.65">
        <b style="font-size:14px">지금은 실제 업체로 메일이 나가지 않습니다 (테스트 중)</b>
        <div style="margin-top:3px">
          ${tests.length
            ? `테스트 주소 <b style="font-family:monospace">${tests.map(escapeHtml).join(', ')}</b> 로만 실제 발송됩니다.
               나머지 업체는 눌러도 나가지 않고 "발송 잠금 중"으로 기록됩니다.`
            : '예약을 잡아두는 것까지는 됩니다. 잠금이 풀리기 전에는 예약 시각이 지나도 발송되지 않습니다.'}
        </div>
      </div>
    </div>`;
}

/**
 * 탭에서 바로 여는 업체 목록 팝업.
 *
 * 목록은 화면 아래에도 있지만, 스크롤해야 보이니 "지금 몇 곳인지"만 읽고
 * 어느 업체인지는 모르고 지나가기 쉽다. 탭 숫자 옆에서 바로 열 수 있게 한다.
 */
function openOutboxPeek(title, items, opts) {
  document.getElementById('outboxPeekRoot')?.remove();
  const kind = (opts && opts.kind) || 'lead';
  const showSent = !!(opts && opts.sent);

  const rowsHtml = items.map((it) => {
    // 예약 항목은 lead 가 안에 들어 있다
    const l = kind === 'schedule' ? (it.lead || {}) : it;
    const leadId = kind === 'schedule' ? it.leadId : it.leadId;
    const email = kind === 'schedule' ? (it.to || l.Email || '') : (l.Email || '');
    const when = kind === 'schedule'
      ? new Date(it.scheduledFor).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : (l.lastEmailSentAt ? new Date(l.lastEmailSentAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '');
    const sentN = Array.isArray(l.emailHistory)
      ? l.emailHistory.filter((h) => h && h.status === 'sent').length : 0;

    return `
      <tr class="peek-row" data-lead-id="${escapeAttr(leadId || '')}"
          style="border-top:1px solid var(--border-subtle);cursor:pointer"
          title="클릭하면 이 업체의 상세 정보가 열립니다">
        <td style="padding:9px 14px;max-width:280px">
          <div style="font-weight:700;color:var(--text-primary);overflow:hidden;
                      text-overflow:ellipsis;white-space:nowrap">${escapeHtml(l.Company || email || leadId || '(이름 없음)')}</div>
          ${(l.TypeKo || l.Type) ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;
               overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(truncate(l.TypeKo || l.Type, 54))}</div>` : ''}
        </td>
        <td style="padding:9px 10px;white-space:nowrap;color:var(--text-secondary);font-size:12px">${escapeHtml(l.Country || '—')}</td>
        <td style="padding:9px 10px;font-family:monospace;font-size:11.5px;color:var(--text-tertiary);
                   max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            title="${escapeAttr(email)}">${escapeHtml(email || '—')}</td>
        <td style="padding:9px 14px;white-space:nowrap;text-align:right;font-size:11.5px;color:var(--text-tertiary)">
          ${kind === 'schedule'
            ? `${escapeHtml(when)} 예정`
            : (showSent
                ? `${sentN ? `메일 ${sentN}회` : ''}${when ? ` · ${when}` : ''}`
                : (sentN ? `이미 ${sentN}회 보냄` : '아직 안 보냄'))}
        </td>
      </tr>`;
  }).join('');

  document.body.insertAdjacentHTML('beforeend', `
    <div id="outboxPeekRoot" style="position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,.5);
         display:flex;align-items:center;justify-content:center;padding:24px">
      <div style="background:var(--surface-1);border-radius:16px;max-width:820px;width:100%;
                  max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="padding:17px 22px;border-bottom:1px solid var(--border);display:flex;
                    align-items:center;justify-content:space-between;gap:12px">
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text-primary)">
              ${escapeHtml(title)} · ${items.length.toLocaleString()}곳
            </div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">
              ${kind === 'schedule'
                ? '예약된 순서대로 나갑니다. 회사를 누르면 상세가 열립니다.'
                : '회사를 누르면 상세 정보가 열립니다.'}
            </div>
          </div>
          <button id="outboxPeekClose" type="button"
            style="border:none;background:none;font-size:22px;line-height:1;cursor:pointer;
                   color:var(--text-tertiary);padding:2px 6px">×</button>
        </div>
        <div style="overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead>
              <tr style="background:var(--surface-2);color:var(--text-secondary);text-align:left;
                         position:sticky;top:0">
                <th style="padding:9px 14px;font-weight:700">회사 · 업종</th>
                <th style="padding:9px 10px;font-weight:700;width:110px">국가</th>
                <th style="padding:9px 10px;font-weight:700;width:220px">이메일</th>
                <th style="padding:9px 14px;font-weight:700;width:150px;text-align:right">
                  ${kind === 'schedule' ? '발송 예정' : '발송 이력'}
                </th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div style="padding:12px 22px;border-top:1px solid var(--border);display:flex;
                    justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font-size:11.5px;color:var(--text-tertiary)">
            이 목록은 아래 화면에도 그대로 있습니다.
          </span>
          <button id="outboxPeekOk" type="button" class="button primary"
            style="font-size:13px;padding:9px 20px">닫기</button>
        </div>
      </div>
    </div>`);

  const root = document.getElementById('outboxPeekRoot');
  const close = () => { root?.remove(); syncBodyScrollLock?.(); };
  document.getElementById('outboxPeekClose')?.addEventListener('click', close);
  document.getElementById('outboxPeekOk')?.addEventListener('click', close);
  bindBackdropDismiss(root, close);
  root?.querySelectorAll('.peek-row').forEach((tr) => {
    tr.addEventListener('click', () => {
      const id = tr.dataset.leadId;
      if (!id) return;
      close();
      openEditModal(id);
    });
  });
  syncBodyScrollLock?.();
}

/**
 * 발송 로직 설명 팝업 — 클라이언트에게 "메일이 어떤 순서로 나가는가"를 보여준다.
 *
 * 화면만 봐서는 눌렀을 때 무슨 일이 생기는지 알 수 없다. 특히 예약으로 깔린다는
 * 것, 답장이 오면 자동으로 빠진다는 것, 같은 곳에 3번까지만 나간다는 것은
 * 어디에도 적혀 있지 않으면 "왜 안 나가지" / "왜 또 나갔지" 로 이어진다.
 */
function openSendLogicModal(lock) {
  document.getElementById('sendLogicModalRoot')?.remove();

  const step = (n, title, body, tone) => `
    <div style="display:flex;gap:12px;padding:13px 0;border-top:1px solid var(--border-subtle)">
      <div style="flex-shrink:0;width:26px;height:26px;border-radius:50%;display:flex;
                  align-items:center;justify-content:center;font-size:12.5px;font-weight:800;
                  background:${tone || '#eef2ff'};color:${tone ? '#78350f' : '#4338ca'}">${n}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:800;color:var(--text-primary);margin-bottom:3px">${title}</div>
        <div style="font-size:12.5px;color:var(--text-secondary);line-height:1.75">${body}</div>
      </div>
    </div>`;

  const tests = (lock && lock.testRecipients) || [];

  const html = `
    <div id="sendLogicModalRoot" style="position:fixed;inset:0;z-index:9998;
         background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:24px">
      <div style="background:var(--surface-1);border-radius:16px;max-width:660px;width:100%;
                  max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;
                    align-items:center;justify-content:space-between;gap:12px">
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text-primary)">📨 메일이 나가는 순서</div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">
              버튼을 눌렀을 때 실제로 무슨 일이 일어나는지
            </div>
          </div>
          <button id="sendLogicClose" type="button"
            style="border:none;background:none;font-size:22px;line-height:1;cursor:pointer;
                   color:var(--text-tertiary);padding:2px 6px">×</button>
        </div>

        <div style="padding:6px 22px 18px;overflow-y:auto">
          ${step(1, '검증 완료에서 보낼 곳을 고릅니다',
            '체크한 뒤 <b>[📋 발송 리스트로 옮기기]</b> 를 누릅니다. ' +
            '옮기지 않은 곳에는 메일이 나가지 않습니다.')}

          ${step(2, '보낼 메일에서 문구를 정합니다',
            '양식은 하나만 씁니다. <b>회사명 같은 부분만 각 회사 것으로 바뀌어</b> 나갑니다.<br>' +
            '오른쪽에서 회사를 바꿔 가며 실제로 갈 모습을 미리 볼 수 있습니다. ' +
            '보내는 주소도 여기서 고릅니다.')}

          ${step(3, '한 번에 쏟지 않고 나눠 보냅니다',
            '<b>하루 ' + (lock?.dailyCap || 20) + '통까지</b>, 한 통과 다음 통 사이 ' +
            '<b>' + Math.round((lock?.intervalMs || 8000) / 1000) + '초</b>를 쉬면서 내보냅니다. ' +
            '남은 것은 다음 날로 넘어갑니다.<br>' +
            '<span style="color:var(--text-tertiary)">한꺼번에 수백 통을 보내면 받는 쪽 메일서버가 ' +
            '광고성 대량 발송으로 보고 스팸함으로 넘깁니다. 그러면 같은 주소로 나가는 ' +
            '실제 거래 메일까지 함께 스팸 취급을 받습니다.</span>')}

          ${step(4, '예약 발송에 쌓입니다',
            '누른 즉시 나가는 것이 아니라 <b>예약</b>으로 깔립니다. ' +
            '어느 회사에 며칠 나갈지 [📅 예약 발송] 탭에서 볼 수 있고, ' +
            '나가기 전이면 <b>취소</b>할 수 있습니다.')}

          ${step(5, '매일 정해진 시각에 나갑니다',
            '예약된 메일은 <b>매일 오전 9시</b>에 하루 치만큼 나갑니다. ' +
            '나간 것은 [✅ 발송 완료] 탭에 <b>며칠에 · 몇 번째로</b> 보냈는지 남고, ' +
            '답이 없는 곳은 <b>무응답 N일</b> 로 표시됩니다.')}

          ${step(6, '답장이 오면 자동으로 빠집니다',
            '상대가 답장을 보내면 그 회사는 <b>[💬 답장 받음]</b> 으로 자동으로 옮겨가고 ' +
            '발송 관리에서 사라집니다. <b>더 이상 광고 메일이 나가지 않습니다.</b>')}

          ${step(7, '답이 없으면 7일 뒤 한 번 더',
            '<b>같은 곳에 최대 3번까지</b>만 나갑니다 (첫 메일 + 재발송 2번).<br>' +
            '중간에 답장이 오면 그 자리에서 멈춥니다.')}

          <div style="margin-top:16px;padding:13px 15px;background:var(--bg-surface-alt);
                      border:1px solid var(--border-default);border-radius:10px">
            <div style="font-size:12.5px;font-weight:800;color:var(--text-primary);margin-bottom:6px">
              🛡 안전장치
            </div>
            <div style="font-size:12.5px;color:var(--text-secondary);line-height:1.8">
              · 같은 곳에 <b>최대 3회</b><br>
              · 마지막 발송 후 <b>48시간</b> 안에는 다시 나가지 않음<br>
              · 하루 총 <b>${(lock && lock.dailyCap) || 20}통</b>을 넘지 않음<br>
              · 메일 주소가 없는 곳은 발송 리스트로 옮겨지지 않음<br>
              · 이미 예약이 걸린 곳은 중복으로 잡히지 않음
            </div>
          </div>

          ${lock && lock.locked ? `
            <div style="margin-top:11px;padding:13px 15px;background:#fef3c7;
                        border:1px solid #fcd34d;border-radius:10px">
              <div style="font-size:12.5px;font-weight:800;color:#78350f;margin-bottom:5px">
                🔒 지금은 테스트 중입니다
              </div>
              <div style="font-size:12.5px;color:#78350f;line-height:1.8">
                실제 업체로는 메일이 <b>나가지 않습니다</b>.
                ${tests.length ? `테스트 주소 <b style="font-family:monospace">${tests.map(escapeHtml).join(', ')}</b> 로만 실제 발송됩니다.` : ''}<br>
                나머지는 눌러도 "발송 잠금 중" 으로 기록만 남습니다.
              </div>
            </div>` : ''}
        </div>

        <div style="padding:13px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end">
          <button id="sendLogicOk" type="button" class="button primary"
            style="font-size:13px;padding:9px 20px">알겠습니다</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  const root = document.getElementById('sendLogicModalRoot');
  const close = () => { root?.remove(); syncBodyScrollLock?.(); };
  document.getElementById('sendLogicClose')?.addEventListener('click', close);
  document.getElementById('sendLogicOk')?.addEventListener('click', close);
  bindBackdropDismiss(root, close);
  syncBodyScrollLock?.();
}

/**
 * 발송 실행 — 예약 큐에 깔아 두고, 크론이 시각이 된 것부터 내보낸다.
 *
 * "지금 보내기"도 즉시 루프를 돌리지 않고 지금 시각 예약으로 만든다.
 * 한 요청에서 수백 통을 연속 발송하면 서버리스 타임아웃에 걸리고, 어디까지
 * 나갔는지도 알 수 없게 된다. 예약으로 두면 한 통씩 상태가 남는다.
 */
async function runOutboxCampaign(ready, lock) {
  if (!ready.length) return;
  if (!_outboxCompose.templateId) {
    alert('메일 양식을 먼저 고르세요.\n[📝 메일 양식]에서 만들 수 있습니다.');
    return;
  }
  const n = ready.length;
  const size = _outboxCompose.batchSize || n;
  const gap = _outboxCompose.intervalMinutes || 10;
  const batches = Math.max(1, Math.ceil(n / size));
  const acc = (_mailAccounts || []).find((a) => a._id === _outboxCompose.mailAccountId);

  const startAt = _outboxCompose.startNow ? null : _outboxCompose.startAt;
  if (!_outboxCompose.startNow) {
    if (!startAt) { alert('시작 시각을 골라 주세요.'); return; }
    if (new Date(startAt).getTime() < Date.now()) { alert('지난 시각으로는 보낼 수 없습니다.'); return; }
  }

  const lines = [
    `${n.toLocaleString()}곳에 메일을 보냅니다.`,
    '',
    `보내는 주소  ${acc ? acc.smtpUser : '(기본 계정)'}`,
    `내보내기     ${_outboxCompose.startNow ? '지금부터' : new Date(startAt).toLocaleString('ko-KR')} · ${size}곳씩 ${gap}분 간격 (${batches}번)`,
    _outboxCompose.followUp
      ? `자동 재발송  답 없으면 ${_outboxCompose.followUpDays}일 뒤 다시 (최대 3회 · 답장 오면 중단)`
      : '자동 재발송  안 함',
  ];
  if (lock?.locked) {
    const t = (lock.testRecipients || []).join(', ');
    lines.push('', `🔒 지금은 발송 잠금 중입니다 — 실제로 나가는 것은 ${t || '없음'} 뿐이고`,
      '   나머지는 "발송 잠금 중"으로 기록됩니다.');
  }
  lines.push('', '진행할까요?');
  if (!confirm(lines.join('\n'))) return;

  const btn = document.getElementById('outboxSendBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 예약을 깔고 있습니다...'; }
  try {
    const r = await safeJsonFetch('/api/mail/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadIds: ready.map((l) => l.leadId),
        templateId: _outboxCompose.templateId,
        mailAccountId: _outboxCompose.mailAccountId || undefined,
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        batchSize: size,
        intervalMinutes: gap,
        followUp: _outboxCompose.followUp,
        followUpDays: _outboxCompose.followUpDays,
      }),
    });
    if (!r?.success) throw new Error(r?.error || '예약 생성 실패');

    alert(
      `✅ ${r.scheduled.toLocaleString()}곳 예약 완료\n\n` +
      `${new Date(r.startAt).toLocaleString('ko-KR')} 부터\n` +
      `${r.batchSize}곳씩 ${r.intervalMinutes}분 간격 · 총 ${r.batches}번\n` +
      `마지막 묶음 ${new Date(r.lastAt).toLocaleString('ko-KR')}\n` +
      (r.skipped?.length ? `\n제외 ${r.skipped.length}곳 (메일 없음·이미 예약·발송 한도)\n` : '') +
      `\n[📅 예약 발송] 탭에서 확인·취소할 수 있습니다.`,
    );
    _outboxTab = 'scheduled';
    invalidateServerPage();
    await loadLeads({ force: true });
    renderOutboxPage();
  } catch (e) {
    alert('발송 예약 실패: ' + (e.message || 'unknown'));
    if (btn) { btn.disabled = false; btn.textContent = `✉️ ${n.toLocaleString()}곳에 보내기`; }
  }
}

/** 양식·계정·미리보기 대상이 비어 있거나 사라졌으면 채워 넣는다 */
function outboxSyncCompose(ready) {
  const tpls = state.email.templates || [];
  const cur = tpls.find((t) => t._id === _outboxCompose.templateId);
  if (!cur && tpls.length) {
    const t = tpls.find((x) => x.purpose === 'intro' && x.language === 'en') || tpls[0];
    _outboxCompose.templateId = t._id;
    _outboxCompose.subject = t.subject || '';
    _outboxCompose.body = t.body || '';
    _outboxCompose.dirty = false;
  }
  if (!_outboxCompose.mailAccountId && (_mailAccounts || []).length) {
    // 대량 발송은 테스트 계정 우선 — 대표 주소로 쏘면 진행 중인 거래 메일까지 물린다
    const a = _mailAccounts.find((x) => x.isTestSender)
      || _mailAccounts.find((x) => x.isDefault) || _mailAccounts[0];
    _outboxCompose.mailAccountId = a._id;
  }
  if (!ready.some((l) => l.leadId === _outboxCompose.previewLeadId)) {
    _outboxCompose.previewLeadId = ready[0]?.leadId || null;
  }
}

/**
 * 입력 바인딩 — 제목·본문은 화면을 다시 그리지 않고 미리보기만 갱신한다.
 * 한 글자마다 renderOutboxPage() 를 부르면 커서가 튀어 글을 쓸 수 없다.
 */
function outboxBindComposeInputs(ready) {
  const tplSel = document.getElementById('obTpl');
  const accSel = document.getElementById('obAcc');
  const subjEl = document.getElementById('obSubject');
  const bodyEl = document.getElementById('obBody');
  const prevSel = document.getElementById('obPreviewLead');

  tplSel?.addEventListener('change', () => {
    const t = (state.email.templates || []).find((x) => x._id === tplSel.value);
    if (!t) return;
    if (_outboxCompose.dirty &&
        !confirm('고쳐 쓴 문구가 있습니다. 양식을 바꾸면 지금 문구는 사라집니다. 바꿀까요?')) {
      tplSel.value = _outboxCompose.templateId;
      return;
    }
    _outboxCompose.templateId = t._id;
    _outboxCompose.subject = t.subject || '';
    _outboxCompose.body = t.body || '';
    _outboxCompose.dirty = false;
    renderOutboxPage();
  });
  accSel?.addEventListener('change', () => { _outboxCompose.mailAccountId = accSel.value; });
  prevSel?.addEventListener('change', () => {
    _outboxCompose.previewLeadId = prevSel.value;
    outboxRefreshPreview(ready);
  });
  subjEl?.addEventListener('input', () => {
    _outboxCompose.subject = subjEl.value; _outboxCompose.dirty = true; outboxRefreshPreview(ready);
  });
  bodyEl?.addEventListener('input', () => {
    _outboxCompose.body = bodyEl.value; _outboxCompose.dirty = true; outboxRefreshPreview(ready);
  });

  // ── 내보내는 방식 ──
  const split   = document.getElementById('obSplit');
  const bSize   = document.getElementById('obBatchSize');
  const bInt    = document.getElementById('obInterval');
  const fUp     = document.getElementById('obFollowUp');
  const fDays   = document.getElementById('obFollowDays');
  const sNow    = document.getElementById('obStartNow');
  const sLater  = document.getElementById('obStartLater');
  const sAt     = document.getElementById('obStartAt');

  const syncPlan = () => {
    const n = ready.length;
    const on = split ? split.checked : true;
    const size = on ? Math.max(1, Number(bSize?.value) || 30) : n;
    const gap = Math.max(1, Number(bInt?.value) || 10);
    _outboxCompose.batchSize = size;
    _outboxCompose.intervalMinutes = gap;
    _outboxCompose.followUp = !!fUp?.checked;
    _outboxCompose.followUpDays = Math.max(1, Number(fDays?.value) || 7);
    _outboxCompose.startNow = !!sNow?.checked;
    _outboxCompose.startAt = sAt?.value || '';
    if (bSize) bSize.disabled = !on;
    if (bInt) bInt.disabled = !on;
    if (sAt) { sAt.disabled = _outboxCompose.startNow; sAt.style.opacity = _outboxCompose.startNow ? '.45' : '1'; }
    if (fDays) fDays.disabled = !_outboxCompose.followUp;

    const batches = Math.max(1, Math.ceil(n / size));
    const mins = (batches - 1) * gap;
    const hint = document.getElementById('obSplitHint');
    if (hint) {
      // 실제 발송 속도는 서버의 하루 상한이 정한다 (lib/outbound-lock.ts).
      // 여기 값은 "예약을 며칠에 걸쳐 깔지"를 정하는 것이라, 하루 상한을
      // 같이 보여주지 않으면 "10분 뒤면 다 나가겠네"로 잘못 읽힌다.
      const cap = (_outboundStatusCache && _outboundStatusCache.dailyCap) || 20;
      const days = Math.ceil(n / cap);
      hint.textContent = on
        ? `${n.toLocaleString()}곳 → ${batches}번에 나눠 예약됩니다.`
          + ` 실제 발송은 하루 ${cap}통씩이라 전부 나가는 데 약 ${days}일 걸립니다`
        : `${n.toLocaleString()}곳을 한 번에 예약합니다 — 그래도 발송은 하루 ${cap}통씩 나갑니다`;
      hint.style.color = on ? 'var(--text-tertiary)' : '#b45309';
    }
    const plan = document.getElementById('obPlanHint');
    if (plan) {
      const start = _outboxCompose.startNow ? '지금부터' : `${new Date(_outboxCompose.startAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}부터`;
      plan.textContent = `${start} ${on ? `${size}곳씩 ${gap}분 간격` : '한 번에'}`
        + (_outboxCompose.followUp ? ` · 답 없으면 ${_outboxCompose.followUpDays}일 뒤 다시 (최대 3회)` : '');
    }
  };
  [split, bSize, bInt, fUp, fDays, sNow, sLater, sAt].forEach((el) =>
    el?.addEventListener('change', syncPlan));
  [bSize, bInt, fDays].forEach((el) => el?.addEventListener('input', syncPlan));
  syncPlan();
}

/** 미리보기 세 칸만 다시 칠한다 (입력 중 포커스를 잃지 않게) */
function outboxRefreshPreview(ready) {
  const lead = ready.find((l) => l.leadId === _outboxCompose.previewLeadId) || ready[0];
  const vars = outboxPreviewVars(lead);
  const to = document.getElementById('obPvTo');
  const sj = document.getElementById('obPvSubject');
  const bd = document.getElementById('obPvBody');
  if (to) to.textContent = (lead && lead.Email) || '—';
  if (sj) sj.textContent = outboxSubstitute(_outboxCompose.subject, vars) || '(제목 없음)';
  if (bd) {
    const t = outboxSubstitute(_outboxCompose.body, vars);
    bd.innerHTML = t.includes('<') ? t : escapeHtml(t).split('\n').join('<br>');
  }
}

/**
 * ✉️ 보낼 메일 — 양식을 화면 안에 둔다.
 *
 * 예전에는 버튼을 눌러 모달을 띄워야 문구가 보였다. 그래서 "지금 무슨 내용이
 * 나가는지" 를 확인하려면 매번 모달을 열어야 했고, 회사마다 무엇이 바뀌는지도
 * 눈에 띄지 않았다. 문구와 미리보기를 목록과 같은 화면에 붙여 둔다.
 */
function outboxReadyHtml(ready, lock) {
  if (!ready.length) {
    return `
      <div style="padding:44px 28px;text-align:center;background:var(--surface-1);
                  border:1px dashed var(--border);border-radius:12px;color:var(--text-tertiary)">
        <div style="font-size:34px;margin-bottom:8px">✉️</div>
        <div style="font-size:14px;font-weight:700;color:var(--text-secondary)">보낼 메일이 없습니다</div>
        <div style="font-size:12.5px;margin-top:5px;line-height:1.6">
          [✅ 검증 완료]에서 보낼 곳을 골라 <b>[발송 리스트로 옮기기]</b> 를 누르면 여기에 모입니다.
        </div>
        <button id="outboxGoVerified" type="button" class="button primary"
          style="margin-top:13px;font-size:13px;padding:9px 16px">✅ 검증 완료에서 고르기</button>
      </div>`;
  }

  const tpls = state.email.templates || [];
  const tpl = tpls.find((t) => t._id === _outboxCompose.templateId) || tpls[0] || null;
  const preview = ready.find((l) => l.leadId === _outboxCompose.previewLeadId) || ready[0];
  const vars = outboxPreviewVars(preview);
  const subj = outboxSubstitute(_outboxCompose.subject, vars);
  const body = outboxSubstitute(_outboxCompose.body, vars);
  const acc = (_mailAccounts || []).find((a) => a._id === _outboxCompose.mailAccountId)
    || (_mailAccounts || [])[0] || null;

  // 어떤 자리가 회사마다 달라지는지 — 이게 '묶음 발송'의 핵심이라 눈에 띄어야 한다
  const usedVars = [...new Set(
    `${_outboxCompose.subject} ${_outboxCompose.body}`.match(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g) || [],
  )].map((m) => m.replace(/[{}\s]/g, ''));

  const byCountry = new Map();
  ready.forEach((l) => byCountry.set(l.Country || '-', (byCountry.get(l.Country || '-') || 0) + 1));
  const topCountries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return `
    <div style="border:1px solid #bfdbfe;border-radius:12px;overflow:hidden;margin-bottom:14px">
      <div style="padding:13px 17px;background:#eff6ff;border-bottom:1px solid #bfdbfe">
        <div style="font-size:14px;font-weight:800;color:#1e3a8a">
          📦 ${ready.length.toLocaleString()}곳에 같은 메일을 한 번에
        </div>
        <div style="font-size:12.5px;color:#1e40af;line-height:1.6;margin-top:3px">
          문구는 하나만 씁니다. <b>${usedVars.length ? usedVars.map((v) => `{{${escapeHtml(v)}}}`).join(' · ') : '{{Company}}'}</b>
          자리만 회사마다 바뀝니다.
        </div>
      </div>

      <div style="padding:14px 17px;background:var(--bg-surface);display:grid;
                  grid-template-columns:minmax(280px,1fr) minmax(280px,1fr);gap:16px">
        <!-- 왼쪽: 쓰는 곳 -->
        <div style="min-width:0">
          <div style="display:flex;gap:8px;margin-bottom:9px;flex-wrap:wrap">
            <label style="flex:1;min-width:130px">
              <span style="font-size:11px;font-weight:700;color:var(--text-tertiary)">양식</span>
              <select id="obTpl" style="width:100%;margin-top:3px;padding:7px 9px;font-size:12.5px;
                border:1px solid var(--border-default);border-radius:7px;
                background:var(--bg-surface);color:var(--text-primary)">
                ${tpls.length
                  ? tpls.map((t) => {
                      const p = (typeof TEMPLATE_PURPOSE_KO !== 'undefined' && TEMPLATE_PURPOSE_KO[t.purpose]) || null;
                      return `<option value="${escapeAttr(t._id)}" ${t._id === (tpl && tpl._id) ? 'selected' : ''}>${escapeHtml(t.name)}${p ? ` · ${p.label}` : ''}</option>`;
                    }).join('')
                  : '<option value="">(등록된 양식 없음)</option>'}
              </select>
            </label>
            <label style="flex:1;min-width:130px">
              <span style="font-size:11px;font-weight:700;color:var(--text-tertiary)">보내는 계정</span>
              <select id="obAcc" style="width:100%;margin-top:3px;padding:7px 9px;font-size:12.5px;
                border:1px solid var(--border-default);border-radius:7px;
                background:var(--bg-surface);color:var(--text-primary)">
                ${(_mailAccounts || []).map((a) => `<option value="${escapeAttr(a._id)}" ${a._id === (acc && acc._id) ? 'selected' : ''}>${escapeHtml(a.smtpUser)}${a.isTestSender ? ' (테스트)' : ''}</option>`).join('')}
              </select>
            </label>
          </div>

          <span style="font-size:11px;font-weight:700;color:var(--text-tertiary)">제목</span>
          <input id="obSubject" type="text" value="${escapeAttr(_outboxCompose.subject)}"
            style="width:100%;margin:3px 0 9px;padding:8px 10px;font-size:13px;
                   border:1px solid var(--border-default);border-radius:7px;
                   background:var(--bg-surface);color:var(--text-primary)">

          <span style="font-size:11px;font-weight:700;color:var(--text-tertiary)">본문</span>
          <textarea id="obBody" rows="11"
            style="width:100%;margin-top:3px;padding:9px 11px;font-size:12.5px;line-height:1.65;
                   border:1px solid var(--border-default);border-radius:7px;resize:vertical;
                   background:var(--bg-surface);color:var(--text-primary);font-family:inherit"
          >${escapeHtml(_outboxCompose.body)}</textarea>
          <div style="font-size:11px;color:var(--text-quaternary);margin-top:4px">
            고친 문구는 <b>이번 발송에만</b> 쓰입니다. 양식 자체를 바꾸거나 새로 만들려면
            <button type="button" id="obGoTemplates"
              style="border:none;background:none;padding:0;font-size:11px;font-weight:700;
                     color:var(--brand-text,#4338ca);cursor:pointer;text-decoration:underline">[📝 메일 양식]</button>
            에서 저장하세요.
          </div>
        </div>

        <!-- 오른쪽: 실제로 나갈 모습 -->
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:700;color:var(--text-tertiary)">이 회사에게는 이렇게 갑니다</span>
            <select id="obPreviewLead" style="flex:1;min-width:150px;padding:5px 8px;font-size:12px;
              border:1px solid var(--border-default);border-radius:7px;
              background:var(--bg-surface);color:var(--text-primary)">
              ${ready.slice(0, 300).map((l) => `<option value="${escapeAttr(l.leadId)}" ${l.leadId === (preview && preview.leadId) ? 'selected' : ''}>${escapeHtml(l.Company || l.Email || l.leadId)}</option>`).join('')}
            </select>
          </div>
          <div style="border:1px solid var(--border-default);border-radius:9px;overflow:hidden;
                      background:var(--surface-1)">
            <div style="padding:8px 12px;border-bottom:1px solid var(--border-subtle);
                        font-size:11.5px;color:var(--text-tertiary)">
              받는 사람 <b id="obPvTo" style="color:var(--text-secondary);font-family:monospace">${escapeHtml((preview && preview.Email) || '—')}</b>
            </div>
            <div id="obPvSubject" style="padding:9px 12px;border-bottom:1px solid var(--border-subtle);
                        font-size:13px;font-weight:700;color:var(--text-primary);word-break:break-word">
              ${escapeHtml(subj) || '(제목 없음)'}
            </div>
            <div id="obPvBody" style="padding:11px 13px;font-size:12.5px;line-height:1.7;color:var(--text-secondary);
                        max-height:290px;overflow:auto;word-break:break-word">
              ${body.includes('<') ? body : escapeHtml(body).split('\n').join('<br>')}
            </div>
          </div>
        </div>
      </div>

      <!-- 어떻게 내보낼지 — 한 번에 쏟지 않기 위한 설정 -->
      <div style="padding:13px 17px;border-top:1px solid var(--border-default);background:var(--bg-surface)">
        <div style="font-size:12px;font-weight:800;color:var(--text-secondary);margin-bottom:9px">
          어떻게 내보낼까요
        </div>

        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
          <label style="display:flex;gap:7px;align-items:flex-start;cursor:pointer;flex:1;min-width:260px">
            <input type="checkbox" id="obSplit" ${_outboxCompose.batchSize > 0 ? 'checked' : ''} style="margin-top:2px">
            <span style="font-size:12.5px;color:var(--text-secondary);line-height:1.6">
              <b style="color:var(--text-primary)">나눠 보내기</b>
              <input type="number" id="obBatchSize" min="1" max="200" value="${_outboxCompose.batchSize}"
                style="width:58px;margin:0 3px;padding:3px 6px;font-size:12.5px;text-align:right;
                       border:1px solid var(--border-default);border-radius:6px;
                       background:var(--bg-surface);color:var(--text-primary)">곳씩
              <input type="number" id="obInterval" min="1" max="1440" value="${_outboxCompose.intervalMinutes}"
                style="width:52px;margin:0 3px;padding:3px 6px;font-size:12.5px;text-align:right;
                       border:1px solid var(--border-default);border-radius:6px;
                       background:var(--bg-surface);color:var(--text-primary)">분 간격
              <span id="obSplitHint" style="display:block;color:var(--text-tertiary);font-size:11.5px;margin-top:3px"></span>
            </span>
          </label>

          <label style="display:flex;gap:7px;align-items:flex-start;cursor:pointer;flex:1;min-width:260px">
            <input type="checkbox" id="obFollowUp" ${_outboxCompose.followUp ? 'checked' : ''} style="margin-top:2px">
            <span style="font-size:12.5px;color:var(--text-secondary);line-height:1.6">
              <b style="color:var(--text-primary)">답장 없으면 자동으로 다시 보내기</b>
              <input type="number" id="obFollowDays" min="1" max="60" value="${_outboxCompose.followUpDays}"
                style="width:52px;margin:0 3px;padding:3px 6px;font-size:12.5px;text-align:right;
                       border:1px solid var(--border-default);border-radius:6px;
                       background:var(--bg-surface);color:var(--text-primary)">일 뒤
              <span style="display:block;color:var(--text-tertiary);font-size:11.5px;margin-top:3px">
                같은 곳에 최대 3회까지 · <b>답장이 오면 그 자리에서 멈춥니다</b>
              </span>
            </span>
          </label>
        </div>

        <div style="margin-top:11px;display:flex;gap:9px;flex-wrap:wrap;align-items:center">
          <span style="font-size:12.5px;color:var(--text-secondary)">시작</span>
          <label style="display:inline-flex;gap:5px;align-items:center;font-size:12.5px;cursor:pointer">
            <input type="radio" name="obStart" id="obStartNow" ${_outboxCompose.startNow ? 'checked' : ''}> 지금부터
          </label>
          <label style="display:inline-flex;gap:5px;align-items:center;font-size:12.5px;cursor:pointer">
            <input type="radio" name="obStart" id="obStartLater" ${_outboxCompose.startNow ? '' : 'checked'}> 시각 지정
          </label>
          <input type="datetime-local" id="obStartAt" value="${escapeAttr(_outboxCompose.startAt || defaultScheduleTime())}"
            ${_outboxCompose.startNow ? 'disabled' : ''}
            style="padding:5px 8px;font-size:12.5px;border:1px solid var(--border-default);border-radius:7px;
                   background:var(--bg-surface);color:var(--text-primary);${_outboxCompose.startNow ? 'opacity:.45' : ''}">
        </div>
      </div>

      <div style="padding:12px 17px;border-top:1px solid var(--border-default);
                  display:flex;gap:9px;flex-wrap:wrap;align-items:center;background:var(--bg-surface-alt)">
        <button id="outboxSendBtn" type="button" class="button primary"
          style="font-size:14px;font-weight:700;padding:11px 22px">
          ✉️ ${ready.length.toLocaleString()}곳에 보내기${lock?.locked ? ' 🔒' : ''}
        </button>
        <span id="obPlanHint" style="font-size:12px;color:var(--text-tertiary)"></span>
      </div>
    </div>

    <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:7px">
      받는 곳 ${ready.length.toLocaleString()}곳 · ${topCountries.map(([c, n]) => `${escapeHtml(c)} ${n}`).join(' · ')}${byCountry.size > 6 ? ` 외 ${byCountry.size - 6}개국` : ''}
    </div>
    ${outboxLeadTableHtml(ready.slice(0, 200), ready.length)}`;
}

/** 📅 예약 발송 — 언제 · 어디로. 실패한 것도 사유와 함께 여기 남긴다 */
function outboxScheduledHtml(pending, failed, canceled) {
  const byDay = new Map();
  for (const it of pending) {
    const key = new Date(it.scheduledFor).toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(it);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const today = new Date().toISOString().slice(0, 10);
  const dayLabel = (k) => {
    const d = new Date(k + 'T00:00:00');
    const diff = Math.round((d - new Date(today + 'T00:00:00')) / 86400000);
    const base = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    if (diff === 0) return `${base} · 오늘`;
    if (diff === 1) return `${base} · 내일`;
    if (diff > 1) return `${base} · ${diff}일 뒤`;
    return `${base} · ⚠️ 지난 날짜`;
  };

  const pendingBlock = !pending.length ? `
    <div style="padding:40px 28px;text-align:center;background:var(--surface-1);
                border:1px dashed var(--border);border-radius:12px;color:var(--text-tertiary)">
      <div style="font-size:34px;margin-bottom:8px">📅</div>
      <div style="font-size:14px;font-weight:700;color:var(--text-secondary)">예약된 발송이 없습니다</div>
      <div style="font-size:12.5px;margin-top:5px">[✉️ 보낼 메일]에서 <b>예약 잡기</b>를 누르면 여기로 옵니다.</div>
    </div>` : `
    <div style="border:1px solid #fcd34d;border-radius:12px;overflow:hidden">
      <div style="padding:11px 16px;background:#fffbeb;border-bottom:1px solid #fde68a;
                  font-size:12.5px;color:#78350f;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <b>대기 중 ${pending.length.toLocaleString()}건</b>
        <span>${days.length}개 날짜</span>
        <span style="margin-left:auto;font-size:11px">시각이 되면 자동으로 [발송 완료]로 넘어갑니다 · 취소는 회사 옆 ✕</span>
      </div>
      ${days.map(([key, list]) => `
        <div style="padding:11px 16px;border-bottom:1px solid var(--border-subtle)">
          <div style="display:flex;align-items:baseline;gap:9px;margin-bottom:6px">
            <b style="font-size:13px;color:var(--text-primary)">${escapeHtml(dayLabel(key))}</b>
            <span style="font-size:11.5px;color:var(--text-tertiary)">${list.length}곳</span>
            <span style="font-size:11px;color:var(--text-quaternary)">
              ${new Date(list[0].scheduledFor).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 발송
            </span>
          </div>
          <!-- 회사명만 칩으로 늘어놓으면 "이 업체 맞나"를 못 가린다.
               국가·이메일까지 같이 보여야 나가기 전에 뺄 수 있다. -->
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px">
              <tbody>
                ${list.map((it) => {
                  const L = it.lead || {};
                  return `
                  <tr style="border-top:1px solid var(--border-subtle)">
                    <td class="outbox-lead-open" data-lead-id="${escapeAttr(it.leadId)}"
                        style="padding:7px 10px;cursor:pointer;max-width:320px"
                        title="클릭하면 이 업체의 상세 정보가 열립니다">
                      <div style="font-weight:700;color:var(--text-primary);overflow:hidden;
                                  text-overflow:ellipsis;white-space:nowrap">
                        ${escapeHtml(L.Company || it.to || it.leadId)}
                      </div>
                      ${(L.TypeKo || L.Type) ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:1px;
                           overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(truncate(L.TypeKo || L.Type, 58))}</div>` : ''}
                    </td>
                    <td style="padding:7px 10px;white-space:nowrap;color:var(--text-secondary);width:110px">${escapeHtml(L.Country || '—')}</td>
                    <td style="padding:7px 10px;font-family:monospace;font-size:11.5px;color:var(--text-tertiary);
                               max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                        title="${escapeAttr(it.to || '')}">${escapeHtml(it.to || '')}</td>
                    <td style="padding:7px 10px;white-space:nowrap;width:64px;text-align:right">
                      ${it.attemptNo && it.attemptNo > 1
                        ? `<span style="padding:1px 6px;background:#fef3c7;color:#92400e;border-radius:99px;
                                        font-size:10px;font-weight:800">${it.attemptNo}번째</span>` : ''}
                    </td>
                    <td style="padding:7px 12px;white-space:nowrap;width:52px;text-align:right">
                      <button type="button" class="outbox-sched-cancel" data-sched-id="${escapeAttr(it._id)}"
                        title="이 예약을 취소합니다 — 이 회사에는 나가지 않습니다"
                        style="border:1px solid var(--border-default);background:var(--bg-surface);
                               color:var(--text-tertiary);cursor:pointer;font-size:11px;
                               line-height:1;padding:4px 8px;border-radius:7px">취소</button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`).join('')}
    </div>`;

  // 실패는 조용히 묻히면 안 된다 — "왜 안 나갔나"가 여기에만 남는다
  const failedBlock = !failed.length ? '' : `
    <div style="margin-top:14px;border:1px solid #fecaca;border-radius:12px;overflow:hidden">
      <div style="padding:11px 16px;background:#fef2f2;border-bottom:1px solid #fecaca;font-size:12.5px;color:#991b1b">
        <b>⚠️ 나가지 못한 예약 ${failed.length}건</b> — 사유를 확인하고 다시 예약해 주세요
      </div>
      ${failed.map((it) => `
        <div style="padding:10px 16px;border-bottom:1px solid var(--border-subtle);font-size:12.5px">
          <b style="color:var(--text-primary)">${escapeHtml((it.lead && it.lead.Company) || it.to || it.leadId)}</b>
          <span style="color:var(--text-tertiary);margin-left:7px">
            ${new Date(it.scheduledFor).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 예정이었음
          </span>
          <div style="margin-top:3px;color:#b91c1c">${escapeHtml(it.lastError || '사유 기록 없음')}</div>
        </div>`).join('')}
    </div>`;

  const canceledBlock = !canceled.length ? '' : `
    <div style="margin-top:12px;font-size:12px;color:var(--text-tertiary)">
      🚫 취소된 예약 ${canceled.length}건 — ${canceled.map((it) =>
        escapeHtml((it.lead && it.lead.Company) || it.to || it.leadId)).join(' · ')}
    </div>`;

  return pendingBlock + failedBlock + canceledBlock;
}

/**
 * ✅ 발송 완료 — "며칠에 나갔나" 와 "몇 번 보냈는데 답이 없나" 를 같이 본다.
 *
 * 통수만 세어 두면 팔로우업 판단을 못 한다. 광고 메일을 두 번 세 번 보내고도
 * 답이 없는 곳을 골라내야 다음에 뭘 할지 정할 수 있어서, 나간 날짜로 묶고
 * 회사마다 보낸 횟수와 답장 여부를 같은 줄에 붙여 둔다.
 */
function outboxSentHtml(sentSched, sentLeads) {
  // 회사별로 모은다 — 발송 이력이 있으면 그걸 쓰고, 없으면 마지막 발송 시각만이라도
  const rows = sentLeads.map((l) => {
    const hist = (l.emailHistory || []).filter((h) => h && h.status === 'sent');
    const sentAts = hist.map((h) => h.sentAt).filter(Boolean).sort();
    const last = sentAts[sentAts.length - 1] || l.lastEmailSentAt || '';
    return {
      leadId: l.leadId,
      company: l.Company || '(이름 없음)',
      email: l.Email || '',
      country: l.Country || '',
      count: hist.length || (l.lastEmailSentAt ? 1 : 0),
      first: sentAts[0] || l.lastEmailSentAt || '',
      last,
      replied: !!l.inboundCount,
      // 마지막으로 보낸 뒤 며칠째 답이 없는지 — 팔로우업 판단의 실제 기준
      waited: last ? Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / 86400000)) : 0,
    };
  }).filter((r) => r.last);

  if (!rows.length && !sentSched.length) {
    return `
      <div style="padding:44px 28px;text-align:center;background:var(--surface-1);
                  border:1px dashed var(--border);border-radius:12px;color:var(--text-tertiary)">
        <div style="font-size:34px;margin-bottom:8px">✅</div>
        <div style="font-size:14px;font-weight:700;color:var(--text-secondary)">아직 나간 메일이 없습니다</div>
        <div style="font-size:12.5px;margin-top:5px">예약한 메일이 나가면 여기에 쌓입니다.</div>
      </div>`;
  }

  // 마지막으로 나간 날 기준으로 묶는다 — "이날 나간 것들은 어떻게 됐나"를 본다
  const byDay = new Map();
  for (const r of rows) {
    const key = String(r.last).slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(r);
  }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));  // 최근 날짜부터
  const dayLabel = (k) => {
    const d = new Date(k + 'T00:00:00');
    if (isNaN(d.getTime())) return k;
    const diff = Math.round((new Date().setHours(0, 0, 0, 0) - d.getTime()) / 86400000);
    const base = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    if (diff === 0) return `${base} · 오늘`;
    if (diff === 1) return `${base} · 어제`;
    return `${base} · ${diff}일 전`;
  };

  const nudged = rows.filter((r) => !r.replied && r.count >= 2);
  const maxed  = rows.filter((r) => !r.replied && r.count >= 3);
  // 답장이 오면 리드가 'replied' 로 올라가 이 목록에서 빠진다(lib/mail/ingest.ts).
  // 그래서 여기 남아 있다는 것 자체가 "아직 답이 없다"는 뜻이다. 어디로 갔는지는
  // 알려줘야 사라진 것을 잃어버린 것으로 오해하지 않는다.
  // 이 화면은 contacted/queued 만 가져오므로 baseLeads 로는 셀 수 없다.
  // 단계별 합계는 사이드바 배지와 같은 API 를 쓴다.
  const sc = _stageCountsCache?.stages || {};
  const movedToReplied = (sc.replied || 0) + (sc.negotiating || 0) + (sc.partner || 0);

  const summary = `
    <div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:9px">
      ${[
        ['보내고 답 기다리는 곳', rows.length, 'var(--text-primary)', 'var(--border-default)'],
        ['2번 보냈는데 무응답', nudged.length, '#b45309', '#fcd34d'],
        ['3번 다 씀 · 무응답', maxed.length, '#b91c1c', '#fecaca'],
        ['답장 와서 넘어간 곳', movedToReplied, '#166534', '#86efac'],
      ].map(([label, n, color, border]) => `
        <div style="flex:1;min-width:132px;padding:10px 13px;border:1px solid ${border};
                    border-radius:10px;background:var(--bg-surface)">
          <div style="font-size:11px;color:var(--text-tertiary);font-weight:700">${label}</div>
          <div style="font-size:19px;font-weight:800;color:${color};line-height:1.2">${n.toLocaleString()}</div>
        </div>`).join('')}
    </div>
    <div style="font-size:11.5px;color:var(--text-tertiary);margin-bottom:13px;line-height:1.6">
      답장이 오면 그 회사는 <b>[💬 답장 받음]</b> 으로 자동으로 옮겨가고 이 목록에서 빠집니다.
      여기 남아 있는 곳은 아직 답이 없는 곳입니다.
    </div>`;

  const countBadge = (n) => {
    const tone = n >= 3 ? ['#fee2e2', '#991b1b'] : n >= 2 ? ['#fef3c7', '#92400e'] : ['#e0e7ff', '#3730a3'];
    return `<span style="padding:1px 7px;background:${tone[0]};color:${tone[1]};border-radius:99px;
                        font-size:10.5px;font-weight:800;white-space:nowrap">${n}번째</span>`;
  };
  const fmtT = (v) => v ? new Date(v).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';

  const dayBlocks = days.map(([key, list]) => {
    list.sort((a, b) => Number(a.replied) - Number(b.replied) || b.count - a.count);
    const dayNoReply = list.filter((r) => !r.replied).length;
    return `
      <div style="border:1px solid var(--border-default);border-radius:11px;overflow:hidden;margin-bottom:11px">
        <div style="padding:10px 15px;background:var(--bg-surface-alt);border-bottom:1px solid var(--border-default);
                    display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
          <b style="font-size:13px;color:var(--text-primary)">${escapeHtml(dayLabel(key))}</b>
          <span style="font-size:11.5px;color:var(--text-tertiary)">${list.length}곳 발송</span>
          ${dayNoReply ? `<span style="font-size:11.5px;color:#b45309">무응답 ${dayNoReply}곳</span>` : ''}
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <tbody>
              ${list.map((r) => `
                <tr class="outbox-lead-open" data-lead-id="${escapeAttr(r.leadId)}"
                    style="border-top:1px solid var(--border-subtle);cursor:pointer">
                  <td style="padding:8px 15px;max-width:250px;overflow:hidden;text-overflow:ellipsis;
                             white-space:nowrap" title="${escapeAttr(r.company)}">
                    ${escapeHtml(r.company)}
                  </td>
                  <td style="padding:8px 10px;white-space:nowrap;color:var(--text-tertiary)">${escapeHtml(r.country)}</td>
                  <td style="padding:8px 10px;white-space:nowrap">${countBadge(r.count)}</td>
                  <td style="padding:8px 10px;white-space:nowrap;color:var(--text-quaternary);font-size:11.5px">
                    ${r.count > 1 && r.first ? `첫 발송 ${String(r.first).slice(5, 10).replace('-', '/')} · ` : ''}${fmtT(r.last)}
                  </td>
                  <td style="padding:8px 15px;white-space:nowrap;text-align:right">
                    ${r.replied
                      ? '<span style="color:#166534;font-weight:700">✅ 답장 옴</span>'
                      : r.count >= 3
                        ? `<span style="color:#b91c1c;font-weight:700">무응답 ${r.waited}일 · 더 못 보냄</span>`
                        : `<span style="color:#b45309">무응답 ${r.waited}일</span>`}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  // 예약으로 나간 건은 위 표에 이미 회사로 잡히지만, 예약분만 따로 세어 준다
  const schedNote = !sentSched.length ? '' : `
    <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:11px">
      📅 이 중 예약으로 나간 건 ${sentSched.length}건입니다.
    </div>`;

  return summary + schedNote + dayBlocks;
}

/** 발송함에서 쓰는 가벼운 리드 표 — 클릭하면 기존 상세 팝업이 열린다 */
/** 이 업체에 지금까지 몇 번 나갔는가 — 발송함 어디서나 같은 모양으로 */
function outboxSendCountBadge(lead, opts) {
  const n = (lead && Array.isArray(lead.emailHistory))
    ? lead.emailHistory.filter((h) => h && h.status === 'sent').length : 0;
  const next = opts && opts.next;   // 다음에 몇 번째로 나갈지 (아직 안 보낸 화면용)
  if (!n && !next) {
    return `<span style="padding:1px 7px;background:var(--bg-surface-alt);color:var(--text-tertiary);
      border-radius:99px;font-size:10px;font-weight:700;white-space:nowrap">아직 안 보냄</span>`;
  }
  if (!n && next) {
    return `<span style="padding:1px 7px;background:#e0e7ff;color:#3730a3;border-radius:99px;
      font-size:10px;font-weight:800;white-space:nowrap">1회차 예정</span>`;
  }
  const tone = n >= 3 ? ['#fee2e2', '#991b1b'] : n >= 2 ? ['#fef3c7', '#92400e'] : ['#e0e7ff', '#3730a3'];
  return `<span title="같은 곳에 최대 3회까지 나갑니다"
    style="padding:1px 7px;background:${tone[0]};color:${tone[1]};border-radius:99px;
    font-size:10px;font-weight:800;white-space:nowrap">메일 ${n}회 발송</span>`;
}

/**
 * 발송함 공용 업체 표 — "누구에게 보내는가"를 실제로 읽을 수 있게.
 *
 * 회사명만 늘어놓으면 목록을 봐도 판단이 안 된다. 업종·국가·홈페이지까지 있어야
 * "이 업체 맞나" 를 그 자리에서 가릴 수 있다. 행을 누르면 상세 팝업이 열린다.
 */
function outboxLeadTableHtml(leads, total, showSent) {
  const fmtD = (v) => v ? new Date(v).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '—';
  const site = (u) => {
    const v = String(u || '').trim();
    if (!v) return '<span style="color:var(--text-quaternary)">—</span>';
    const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const short = v.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
    return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener"
      onclick="event.stopPropagation()"
      style="color:var(--brand-text,#4338ca);text-decoration:none">${escapeHtml(truncate(short, 30))} ↗</a>`;
  };
  return `
    <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead>
            <tr style="background:var(--surface-2);color:var(--text-secondary);text-align:left">
              <th style="padding:9px 14px;font-weight:700">회사 · 업종</th>
              <th style="padding:9px 12px;font-weight:700;width:110px">국가</th>
              <th style="padding:9px 12px;font-weight:700;width:210px">이메일</th>
              <th style="padding:9px 12px;font-weight:700;width:190px">홈페이지</th>
              <th style="padding:9px 12px;font-weight:700;width:104px">발송</th>
              ${showSent
                ? '<th style="padding:9px 12px;font-weight:700;width:90px">보낸 날</th><th style="padding:9px 14px;font-weight:700;width:80px">답장</th>'
                : '<th style="padding:9px 14px;font-weight:700;width:96px;text-align:right">제외</th>'}
            </tr>
          </thead>
          <tbody>
            ${leads.map((l) => `
              <tr class="outbox-lead-open" data-lead-id="${escapeAttr(l.leadId)}"
                  style="border-top:1px solid var(--border-subtle);cursor:pointer"
                  title="클릭하면 이 업체의 상세 정보가 열립니다">
                <td style="padding:8px 14px;max-width:340px">
                  <div style="font-weight:700;color:var(--text-primary);overflow:hidden;
                              text-overflow:ellipsis;white-space:nowrap">${escapeHtml(l.Company || '(이름 없음)')}</div>
                  ${(l.TypeKo || l.Type) ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;
                       overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                       title="${escapeAttr(l.TypeKo || l.Type)}">${escapeHtml(truncate(l.TypeKo || l.Type, 62))}</div>` : ''}
                </td>
                <td style="padding:8px 12px;white-space:nowrap;color:var(--text-secondary)">${escapeHtml(l.Country || '—')}</td>
                <td style="padding:8px 12px;font-family:monospace;font-size:11.5px;color:var(--text-secondary);
                           max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                    title="${escapeAttr(l.Email || '')}">${escapeHtml(l.Email || '—')}</td>
                <td style="padding:8px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px">${site(l.WebsiteContact)}</td>
                <td style="padding:8px 12px;white-space:nowrap">${outboxSendCountBadge(l, { next: !showSent })}</td>
                ${showSent ? `
                  <td style="padding:8px 12px;white-space:nowrap;color:var(--text-tertiary)">${fmtD(l.lastEmailSentAt)}</td>
                  <td style="padding:8px 14px;white-space:nowrap">${l.inboundCount
                    ? '<span style="color:#166534;font-weight:700">✅ 옴</span>'
                    : '<span style="color:var(--text-quaternary)">—</span>'}</td>`
                : `
                  <td style="padding:8px 14px;white-space:nowrap;text-align:right">
                    <button type="button" class="outbox-unqueue" data-lead-id="${escapeAttr(l.leadId)}"
                      title="발송 리스트에서 빼고 [검증 완료]로 되돌립니다. 메일은 나가지 않습니다."
                      style="font-size:11px;font-weight:600;padding:5px 10px;border-radius:7px;
                             border:1px solid var(--border-default);background:var(--bg-surface);
                             color:var(--text-secondary);cursor:pointer">↩ 빼기</button>
                  </td>`}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${total > leads.length ? `
        <div style="padding:9px 14px;font-size:11.5px;color:var(--text-tertiary);border-top:1px solid var(--border-subtle)">
          ${leads.length.toLocaleString()}곳만 표시 · 전체 ${total.toLocaleString()}곳
        </div>` : ''}
    </div>`;
}

async function renderScheduledMailsPage() {
  els.content.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-tertiary)">로드 중...</div>`;
  let items = [];
  try {
    items = await fetchScheduledMails(_schedStatusFilter);
  } catch (e) {
    els.content.innerHTML = `<div style="padding:24px;color:#dc2626">불러오기 실패: ${escapeHtml(e.message || 'unknown')}</div>`;
    return;
  }

  const statusMap = {
    pending:  { label: '⏳ 대기 중',   color: '#f59e0b', bg: '#fef3c7' },
    sent:     { label: '✅ 발송 완료', color: '#166534', bg: '#dcfce7' },
    failed:   { label: '❌ 실패',      color: '#991b1b', bg: '#fee2e2' },
    canceled: { label: '🚫 취소됨',    color: '#6b7280', bg: '#f3f4f6' },
  };

  const chip = (key, label, color) => {
    const active = _schedStatusFilter === key;
    return `<button type="button" class="sched-status-chip" data-status="${key}"
      style="padding:6px 14px;border-radius:99px;border:2px solid ${active ? color : '#cbd5e1'};
        background:${active ? color : 'transparent'};color:${active ? 'white' : 'var(--text-secondary)'};
        font-weight:700;font-size:12px;cursor:pointer;transition:all 0.15s">
      ${label}
    </button>`;
  };

  const fmtWhen = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  const fmtRelative = (iso) => {
    if (!iso) return '';
    const diff = new Date(iso).getTime() - Date.now();
    const min = Math.round(diff / 60000);
    if (Math.abs(min) < 60) return min >= 0 ? `${min}분 후` : `${-min}분 전`;
    const hr = Math.round(min / 60);
    if (Math.abs(hr) < 48) return hr >= 0 ? `${hr}시간 후` : `${-hr}시간 전`;
    const d = Math.round(hr / 24);
    return d >= 0 ? `${d}일 후` : `${-d}일 전`;
  };

  els.content.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">
      <div style="padding:16px 18px;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:1px solid #fcd34d;border-radius:12px;margin-bottom:16px;color:#78350f">
        <div style="font-size:15px;font-weight:800;margin-bottom:6px">📅 예약 발송 관리</div>
        <div style="font-size:13px;line-height:1.7">
          여기 있는 예약은 Vercel Cron 이 <b>5분마다</b> 확인해서 예약 시각 도래한 항목을 자동으로 발송합니다.
          <br>· <b>발송 여부 확인</b>: 대기 중/발송 완료/실패/취소 상태로 조회
          · <b>취소</b>: 대기 중일 때만 · <b>즉시 발송</b>: 예약 시각 전에 지금 바로 보내기
          <br>· <b>과도 발송 방지</b>: 리드당 최대 3회 · 최근 발송 후 48h 안 지났으면 자동 스킵 (실패로 기록)
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        ${chip('pending',  '⏳ 대기 중',   '#f59e0b')}
        ${chip('sent',     '✅ 발송 완료', '#166534')}
        ${chip('failed',   '❌ 실패',      '#dc2626')}
        ${chip('canceled', '🚫 취소됨',    '#6b7280')}
        ${chip('all',      '📋 전체',      '#334155')}
      </div>

      ${items.length === 0 ? `
        <div style="padding:48px;text-align:center;background:var(--surface-1);border:1px dashed var(--border);border-radius:12px;color:var(--text-tertiary);font-size:14px">
          📭 이 상태의 예약이 없습니다.<br>
          <span style="font-size:12px">"발송 관리" 페이지의 <b>📅 예약 발송</b> 카드로 등록하세요.</span>
        </div>
      ` : `
        <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:12px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--surface-2);color:var(--text-secondary);text-align:left">
                <th style="padding:10px 14px;font-weight:700">상태</th>
                <th style="padding:10px 14px;font-weight:700">회사</th>
                <th style="padding:10px 14px;font-weight:700">수신자</th>
                <th style="padding:10px 14px;font-weight:700">예약 시각</th>
                <th style="padding:10px 14px;font-weight:700;text-align:right">액션</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => {
                const s = statusMap[it.status] || statusMap.pending;
                const canAct = it.status === 'pending';
                return `
                  <tr style="border-top:1px solid var(--border)">
                    <td style="padding:12px 14px">
                      <span style="background:${s.bg};color:${s.color};padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700">${s.label}</span>
                      ${it.attempts > 0 ? `<div style="margin-top:4px;font-size:10px;color:var(--text-tertiary)">시도 ${it.attempts}회</div>` : ''}
                    </td>
                    <td style="padding:12px 14px">
                      <div style="font-weight:600;color:var(--text-primary)">${escapeHtml((it.lead && it.lead.Company) || '(삭제된 리드)')}</div>
                      ${it.lead && it.lead.Country ? `<div style="font-size:11px;color:var(--text-tertiary)">${escapeHtml(it.lead.Country)}</div>` : ''}
                    </td>
                    <td style="padding:12px 14px;color:var(--text-secondary);font-family:monospace;font-size:12px">${escapeHtml(it.to)}</td>
                    <td style="padding:12px 14px">
                      <div style="color:var(--text-primary);font-size:12px">${fmtWhen(it.scheduledFor)}</div>
                      <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">${fmtRelative(it.scheduledFor)}</div>
                      ${it.sentAt ? `<div style="font-size:10px;color:#166534;margin-top:2px">발송: ${fmtWhen(it.sentAt)}</div>` : ''}
                      ${it.lastError ? `<div style="font-size:10px;color:#dc2626;margin-top:4px;max-width:240px" title="${escapeAttr(it.lastError)}">${escapeHtml(it.lastError.slice(0,60))}</div>` : ''}
                    </td>
                    <td style="padding:12px 14px;text-align:right">
                      ${canAct ? `
                        <button type="button" class="sched-send-now" data-id="${escapeAttr(it._id)}"
                          style="padding:6px 10px;background:#2563eb;color:white;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;margin-right:4px">
                          ⚡ 즉시
                        </button>
                        <button type="button" class="sched-cancel" data-id="${escapeAttr(it._id)}"
                          style="padding:6px 10px;background:transparent;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">
                          🚫 취소
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  document.querySelectorAll('.sched-status-chip').forEach(el => {
    el.addEventListener('click', () => {
      _schedStatusFilter = el.dataset.status;
      renderScheduledMailsPage();
    });
  });
  document.querySelectorAll('.sched-cancel').forEach(el => {
    el.addEventListener('click', async () => {
      if (!confirm('이 예약을 취소하시겠습니까?')) return;
      try {
        const res = await fetch(`/api/mail/schedule/${el.dataset.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        renderScheduledMailsPage();
      } catch (e) {
        alert('취소 실패: ' + (e.message || 'unknown'));
      }
    });
  });
  document.querySelectorAll('.sched-send-now').forEach(el => {
    el.addEventListener('click', async () => {
      if (!confirm('이 예약을 지금 즉시 발송하시겠습니까?')) return;
      el.textContent = '⏳';
      el.disabled = true;
      try {
        const res = await fetch(`/api/mail/schedule/${el.dataset.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send-now' }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        if (data.result?.ok) alert('✅ 발송 완료' + (data.result.dryRun ? ' (DRY_RUN)' : ''));
        else alert('❌ 발송 실패: ' + (data.result?.error || 'unknown'));
        invalidateServerPage();
        renderScheduledMailsPage();
      } catch (e) {
        alert('즉시 발송 실패: ' + (e.message || 'unknown'));
      }
    });
  });
}

async function renderMailAccountsTool() {
  els.content.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-tertiary)">로드 중...</div>`;
  const list = await loadMailAccounts(true);

  els.content.innerHTML = `
    ${mailAccountPrimaryPanelHtml(list)}

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0;font-size:14px;font-weight:700">등록된 계정 (${list.length})</h3>
      ${list.length > 0 ? `<button id="addMailAccountBtn" class="button primary" type="button" style="font-size:13px;padding:8px 14px">+ 계정 추가</button>` : ''}
    </div>

    ${list.length === 0 ? `
      <div style="padding:56px 32px;text-align:center;background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:1px solid #93c5fd;border-radius:16px">
        <div style="font-size:56px;margin-bottom:14px">📮</div>
        <div style="font-size:20px;font-weight:800;color:#1e40af;margin-bottom:8px">
          이카운트 웹메일에 로그인하기
        </div>
        <div style="font-size:13px;color:#1e3a8a;line-height:1.7;max-width:520px;margin:0 auto 24px">
          B2B 광고 메일을 회사 이메일로 자동 발송하려면 먼저 로그인이 필요합니다.<br>
          <b>이카운트가 아닌 Gmail · Outlook · Naver</b> 도 같은 화면에서 등록 가능.
        </div>

        <!-- 이카운트 사전 세팅 안내 (emailData 참고) -->
        <div style="text-align:left;background:white;border:1px solid #cbd5e1;border-radius:10px;padding:14px 18px;max-width:520px;margin:0 auto 20px">
          <div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:8px">
            ⚡ 이카운트는 로그인 전에 웹메일 설정 2가지가 필요해요
          </div>
          <ol style="margin:0;padding-left:20px;font-size:12px;color:#0f172a;line-height:1.7">
            <li>웹메일 → <b>개인기능설정 → 외부연동설정</b></li>
            <li><b>메일 클라이언트 사용</b>: "사용" 으로 변경</li>
            <li><b>해외 로그인 차단</b>: "사용안함" 으로 변경 (Vercel 서버는 해외라서 필수)</li>
          </ol>
        </div>

        <button id="addFirstAccountBtn" type="button"
          style="font-size:16px;font-weight:700;padding:14px 32px;background:#2563eb;color:white;
          border:none;border-radius:12px;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.3)">
          📮 이카운트 웹메일 로그인
        </button>
        <div style="margin-top:14px;font-size:11px;color:#64748b">
          🔒 로그인 정보는 AES-256-GCM 로 암호화 저장. 서버에서만 복호화.
        </div>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${list.map(mailAccountCardHtml).join('')}
      </div>
    `}
  `;

  document.getElementById('addMailAccountBtn')?.addEventListener('click', () => openMailAccountModal());
  document.getElementById('addFirstAccountBtn')?.addEventListener('click', () => openMailAccountModal());
  document.querySelectorAll('.acc-verify-btn').forEach(b => b.addEventListener('click', () => verifyMailAccount(b.dataset.accId)));
  document.querySelectorAll('.acc-edit-btn').forEach(b => b.addEventListener('click', () => openMailAccountModal(b.dataset.accId)));
  document.querySelectorAll('.acc-delete-btn').forEach(b => b.addEventListener('click', () => deleteMailAccount(b.dataset.accId)));

  // ── 대표 계정 지정 ──
  // 고르기만 해서는 바뀌지 않는다. 메일함이 통째로 바뀌는 일이라 한 번 더 누르게 한다.
  const sel = document.getElementById('primaryAccSelect');
  const applyBtn = document.getElementById('primaryAccApply');
  if (sel && applyBtn) {
    const cur = list.find(a => a.isDefault)?._id || '';
    const sync = () => {
      const changed = sel.value && sel.value !== cur;
      applyBtn.disabled = !changed;
      applyBtn.style.opacity = changed ? '1' : '.45';
      applyBtn.style.cursor = changed ? 'pointer' : 'default';
      applyBtn.textContent = changed ? '이 계정으로 지정' : '지정됨';
    };
    sel.addEventListener('change', sync);
    applyBtn.addEventListener('click', () => {
      if (applyBtn.disabled) return;
      setDefaultMailAccount(sel.value);
    });
    sync();
  }
}

/**
 * 대표 계정 지정 패널 — 이 화면 맨 위.
 *
 * 예전에는 계정 카드마다 '이 계정으로 전환' 버튼이 붙어 있었다. 버튼이 목록 속에
 * 흩어져 있으니 "지금 대표가 누구인가"를 한눈에 읽기 어려웠다. 지정은 한 곳에서만
 * 하고, 카드에는 결과(대표 배지)만 남긴다.
 */
function mailAccountPrimaryPanelHtml(list) {
  if (!list.length) {
    return `
      <div style="background:var(--brand-soft,#eef2ff);border:1px solid var(--brand,#c7d2fe);
                  border-radius:12px;padding:15px 20px;margin-bottom:16px">
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.7">
          계정을 등록하면 그중 하나를 <b>대표 계정</b>으로 지정할 수 있습니다.
          대표 계정으로 지정된 주소가 곧 메일함이 됩니다.
        </div>
      </div>`;
  }

  const cur = list.find(a => a.isDefault) || null;
  const options = list.map(a => `
    <option value="${escapeAttr(a._id)}" ${a.isDefault ? 'selected' : ''} ${a.isActive === false ? 'disabled' : ''}>
      ${escapeHtml(a.accountName)} — ${escapeHtml(a.smtpUser)}${a.isActive === false ? ' (비활성)' : ''}
    </option>`).join('');

  return `
    <div style="background:var(--brand-soft,#eef2ff);border:1px solid var(--brand,#c7d2fe);
                border-radius:12px;padding:16px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:4px">
        <span style="font-size:20px">👤</span>
        <strong style="font-size:14.5px;color:var(--brand-text,#4338ca)">대표 계정 지정</strong>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;line-height:1.6">
        여기서 지정한 계정이 <b>메일함이 됩니다.</b> 지정하면 아래 화면이 모두 그 계정 것으로 바뀝니다.
      </div>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:11px">
        <select id="primaryAccSelect"
          style="flex:1;min-width:240px;padding:9px 12px;font-size:13px;font-weight:600;
                 border:1px solid var(--border-default);border-radius:9px;
                 background:var(--bg-surface);color:var(--text-primary)">
          ${options}
        </select>
        <button id="primaryAccApply" type="button" class="button primary"
          style="font-size:13px;padding:9px 18px;white-space:nowrap">이 계정으로 지정</button>
      </div>

      <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--bg-surface);
                  border:1px solid var(--border-default);border-radius:9px;margin-bottom:11px">
        <span style="font-size:10.5px;font-weight:800;letter-spacing:.4px;color:var(--text-tertiary);
                     text-transform:uppercase;white-space:nowrap">현재 대표</span>
        <span style="font-size:13.5px;font-weight:700;color:var(--text-primary);
                     overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${cur ? escapeHtml(cur.smtpUser) : '<span style="color:#b45309;font-weight:600">지정된 계정이 없습니다</span>'}
        </span>
      </div>

      <div style="font-size:12px;color:var(--text-secondary);line-height:1.8">
        <b>지정하면 이렇게 바뀝니다</b>
        <br>· <b>받은 메일함</b> — 그 계정에 온 메일만 보입니다
        <br>· <b>회신 필요 · 기한 관리</b> — 그 계정 메일만 셉니다
        <br>· <b>거래처 폴더</b> — 그 계정 메일함의 폴더로 다시 그려집니다
        <br>· <b>답장</b> — 받은 메일에 답할 때 그 주소로 나갑니다
        <br><span style="color:var(--text-tertiary)">메일이 지워지는 것은 아닙니다. 대표를 되돌리면 그대로 보입니다.</span>
      </div>

      <p style="margin:11px 0 0;padding-top:10px;border-top:1px solid var(--border-default);
                font-size:11.5px;color:var(--text-tertiary);line-height:1.6">
        비밀번호는 서버에 AES-256-GCM 으로 암호화해 저장하고 발송할 때만 복호화합니다.
        이카운트 외에 Gmail · Outlook · 네이버도 같은 화면에서 등록할 수 있습니다.
      </p>
    </div>`;
}

function mailAccountCardHtml(acc) {
  const verifiedAgo = acc.lastVerifiedAt ? formatRelativeKo(acc.lastVerifiedAt) : null;
  const hasError = !!acc.lastVerifyError;
  return `
    <div style="background:var(--surface-1);border:1px solid ${acc.isDefault ? '#3b82f6' : 'var(--border)'};border-radius:12px;padding:16px 18px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <strong style="font-size:15px">${escapeHtml(acc.accountName)}</strong>
            ${acc.isDefault ? '<span title="대표 계정입니다 — 지금 메일함이 이 계정 것입니다" style="padding:2px 8px;background:#dbeafe;color:#1e40af;border-radius:99px;font-size:10px;font-weight:700">👤 대표 계정</span>' : ''}
            ${!acc.isActive ? '<span style="padding:2px 8px;background:#f3f4f6;color:#6b7280;border-radius:99px;font-size:10px">비활성</span>' : ''}
          </div>
          <div style="font-size:13px;color:var(--text-secondary);font-family:monospace">
            ${escapeHtml(acc.smtpUser)} · ${escapeHtml(acc.smtpHost)}:${acc.smtpPort}
          </div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">
            From: ${escapeHtml(acc.fromName || '(no name)')} &lt;${escapeHtml(acc.fromAddress)}&gt;
          </div>
          ${verifiedAgo || hasError ? `
            <div style="font-size:11px;margin-top:6px;color:${hasError ? '#dc2626' : '#059669'}">
              ${hasError ? '⚠ 마지막 검증 실패: ' + escapeHtml(acc.lastVerifyError.slice(0, 100)) : '✅ 검증됨 ' + verifiedAgo}
            </div>
          ` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
          <button class="acc-verify-btn button ghost" data-acc-id="${escapeAttr(acc._id)}" type="button" style="font-size:11px;padding:5px 10px" title="지금 SMTP 연결 재검증">🔄 검증</button>
          <button class="acc-edit-btn button ghost" data-acc-id="${escapeAttr(acc._id)}" type="button" style="font-size:11px;padding:5px 10px">✏ 수정</button>
          <button class="acc-delete-btn button ghost" data-acc-id="${escapeAttr(acc._id)}" type="button" style="font-size:11px;padding:5px 10px;color:#dc2626">🗑</button>
        </div>
      </div>
    </div>
  `;
}

async function verifyMailAccount(id) {
  const btn = document.querySelector(`.acc-verify-btn[data-acc-id="${id}"]`);
  if (btn) { btn.textContent = '⏳ 검증 중'; btn.disabled = true; }
  try {
    const res = await fetch(`/api/mail-accounts/${id}/verify`, { method: 'POST' });
    const data = await res.json();
    alert(data.success ? `✅ 연결 확인 완료 (${data.verifiedAt})` : `❌ 실패: ${data.error}`);
    await loadMailAccounts(true);
    if (state.view === 'tool-mail-accounts') renderMailAccountsTool();
  } catch (e) {
    alert('검증 실패: ' + (e.message || 'unknown'));
    if (btn) { btn.textContent = '🔄 검증'; btn.disabled = false; }
  }
}

/**
 * 대표 계정을 바꾼다 — 저장만 하고 끝내면 안 된다.
 *
 * 메일함은 _inboxState.accountId 로 그려지고, 한 번이라도 탭을 눌렀으면
 * accountPicked 가 켜져서 대표 계정을 다시 따라가지 않는다. 그래서 대표를 바꿔도
 * 화면은 전에 보던 계정에 머물러 있었다. 여기서 그 고정을 풀고 새 대표로 옮긴다.
 * 폴더·페이지·휴지통도 이전 계정 기준이라 같이 초기화한다.
 *
 * accountId 는 MailAccount._id 문자열과 같은 값이다(lib/mail/accounts.ts summarize).
 */
async function setDefaultMailAccount(id) {
  const btn = document.getElementById('primaryAccApply');
  const prev = btn ? btn.textContent : null;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 지정 중'; }
  try {
    const res = await fetch(`/api/mail-accounts/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    // 메일함을 새 대표 계정으로 옮긴다
    if (typeof _inboxState !== 'undefined') {
      _inboxState.accountId = String(id);
      _inboxState.accountPicked = false;  // 대표를 다시 따라가도록 고정 해제
      _inboxState.page = 1;
      _inboxState.group = '';             // 폴더는 계정마다 다르다
      _inboxState.trashed = false;
    }
    // 계정별로 다른 값들이라 캐시를 통째로 버린다
    _mailAccountsCache = null;
    _mailGroupsCache = null;
    _mailCountsCache = null;

    await loadMailAccounts(true);
    await loadInboxAccounts(true);
    loadMailCounts(true);               // 사이드바 배지도 새 계정 기준으로

    const acc = (_mailAccounts || []).find(a => String(a._id) === String(id));
    renderMailAccountsTool();
    if (acc) alert(`✅ 대표 계정을 ${acc.smtpUser} 로 지정했습니다.\n메일함이 이 계정 것으로 바뀝니다.`);
  } catch (e) {
    alert('대표 계정 지정 실패: ' + (e.message || 'unknown'));
    if (btn) { btn.disabled = false; btn.textContent = prev || '이 계정으로 지정'; }
  }
}

async function deleteMailAccount(id) {
  const acc = (_mailAccounts || []).find(a => a._id === id);
  if (!acc) return;
  if (!confirm(`계정 "${acc.accountName}" (${acc.smtpUser}) 을 삭제하시겠습니까?`)) return;
  try {
    const res = await fetch(`/api/mail-accounts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    await loadMailAccounts(true);
    renderMailAccountsTool();
  } catch (e) { alert('삭제 실패: ' + (e.message || 'unknown')); }
}

// 계정 추가/수정 모달
function openMailAccountModal(editId) {
  const isEdit = !!editId;
  const acc = isEdit ? (_mailAccounts || []).find(a => a._id === editId) : null;

  // 흔한 SMTP 프리셋 (사용자 편의) — 이카운트 기본
  const presetOptions = [
    { key: 'ecount',  label: '📮 이카운트 (ECOUNT)', host: 'wsmtp.ecount.com', port: 465, secure: true },
    { key: 'gmail',   label: '📮 Gmail', host: 'smtp.gmail.com', port: 465, secure: true },
    { key: 'outlook', label: '📮 Outlook / Office 365', host: 'smtp.office365.com', port: 587, secure: false },
    { key: 'naver',   label: '📮 Naver', host: 'smtp.naver.com', port: 465, secure: true },
    { key: 'daum',    label: '📮 Daum/Hanmail', host: 'smtp.daum.net', port: 465, secure: true },
    { key: 'cafe24',  label: '📮 Cafe24', host: 'smtp.cafe24.com', port: 465, secure: true },
    { key: 'custom',  label: '⚙️ 직접 입력 (커스텀)', host: '', port: 465, secure: true },
  ];
  // 서비스별 사전 세팅 안내
  const providerGuides = {
    ecount: {
      title: '이카운트는 웹메일에서 2가지 설정이 켜져 있어야 합니다',
      steps: [
        '웹메일 로그인 → 개인기능설정 → 외부연동설정',
        '"메일 클라이언트 사용"을 사용으로 변경',
        '"해외 로그인 차단"을 사용안함으로 변경 (Vercel 서버는 해외 IP)',
      ],
    },
    gmail: {
      title: 'Gmail은 계정 비밀번호로 로그인되지 않습니다',
      steps: [
        'Google 계정 → 보안 → 2단계 인증 켜기',
        '같은 화면에서 앱 비밀번호 발급 (16자리)',
        '아래 비밀번호 칸에는 앱 비밀번호를 입력',
      ],
    },
    naver: {
      title: '네이버는 IMAP/SMTP 사용 활성화가 필요합니다',
      steps: [
        '네이버 메일 → 환경설정 → POP3/IMAP 설정',
        'IMAP/SMTP 사용 켜기',
        '2단계 인증 사용 시 애플리케이션 비밀번호 발급',
      ],
    },
    outlook: {
      title: 'Outlook은 앱 비밀번호 필요',
      steps: [
        'Microsoft 계정 → 보안 → 2단계 인증 활성화',
        '고급 보안 옵션 → 앱 비밀번호 만들기',
        '앱 비밀번호를 아래 칸에 입력',
      ],
    },
  };
  // 현재 선택된 프리셋 (호스트 기반 추측 · 신규는 이카운트 기본)
  const guessPresetKey = (h) => {
    if (!h) return 'ecount';
    const l = h.toLowerCase();
    if (l.includes('ecount')) return 'ecount';
    if (l.includes('gmail')) return 'gmail';
    if (l.includes('office365') || l.includes('outlook')) return 'outlook';
    if (l.includes('naver')) return 'naver';
    if (l.includes('daum')) return 'daum';
    if (l.includes('cafe24')) return 'cafe24';
    return 'custom';
  };
  const currentPresetKey = guessPresetKey(acc?.smtpHost);

  document.getElementById('mailAccountModalRoot')?.remove();
  const modalHtml = `
    <div id="mailAccountModalRoot" style="position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)">
      <div style="width:min(560px,95vw);max-height:92vh;background:#ffffff;color:#0f172a;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.4)">
        <div style="padding:20px 24px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="font-size:36px">📮</div>
            <div>
              <div style="font-size:18px;font-weight:800;color:#92400e">
                ${isEdit ? '메일 계정 수정' : '메일 계정 로그인'}
              </div>
              <div style="font-size:12px;color:#78350f;margin-top:3px;line-height:1.5">
                ${isEdit ? '이 계정 정보를 업데이트합니다.' : '회사 메일 계정으로 로그인하면 <b>그 계정으로 광고 메일이 발송</b>됩니다.'}<br>
                🔒 비밀번호는 AES-256 로 서버에서만 복호화.
              </div>
            </div>
          </div>
          <button id="macModalClose" style="background:rgba(255,255,255,0.5);border:none;font-size:22px;cursor:pointer;color:#92400e;padding:2px 12px;border-radius:6px">×</button>
        </div>

        <div style="padding:16px 24px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:12px">
          <!-- ① 서비스 선택 -->
          <div>
            <label style="font-size:12px;color:#1e40af;font-weight:800;text-transform:uppercase;letter-spacing:0.5px">① 서비스 선택</label>
            <select id="macPreset" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;margin-top:4px;font-weight:600">
              ${presetOptions.map(p => `<option value="${p.key}" ${p.key === currentPresetKey ? 'selected' : ''}>${p.label}</option>`).join('')}
            </select>
          </div>

          <!-- 서비스별 사전 세팅 안내 (프리셋에 따라 동적 표시) -->
          <div id="macGuide" style="display:none;padding:12px 14px;background:#eff6ff;border:1px solid #93c5fd;border-radius:10px">
            <div id="macGuideTitle" style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:6px"></div>
            <ol id="macGuideSteps" style="margin:0;padding-left:20px;font-size:12px;color:#0f172a;line-height:1.7"></ol>
          </div>

          <!-- ② 로그인 정보 -->
          <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
            <label style="font-size:12px;color:#1e40af;font-weight:800;text-transform:uppercase;letter-spacing:0.5px">② 로그인 정보</label>
          </div>

          <div>
            <label style="font-size:11px;color:var(--text-secondary);font-weight:700">📧 이메일 (SMTP 계정)</label>
            <input id="macUser" type="text" value="${escapeAttr(acc?.smtpUser || '')}" placeholder="me@yogico.kr"
              style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;margin-top:2px">
          </div>

          <div>
            <label style="font-size:11px;color:var(--text-secondary);font-weight:700">
              🔑 비밀번호 ${isEdit ? '<span style="color:var(--text-tertiary);font-weight:400">(변경 시에만 입력. 빈 값이면 기존 유지)</span>' : '<span style="color:#dc2626">*</span>'}
            </label>
            <input id="macPass" type="password" placeholder="${isEdit ? '(변경 안 함)' : '이카운트 웹메일 비밀번호 또는 앱 비밀번호'}"
              style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;margin-top:2px">
          </div>

          <!-- ③ 별칭 + 발신자 -->
          <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
            <label style="font-size:12px;color:#1e40af;font-weight:800;text-transform:uppercase;letter-spacing:0.5px">③ 별칭 & 발신자 표시</label>
          </div>

          <div>
            <label style="font-size:11px;color:var(--text-secondary);font-weight:700">📝 이 계정의 별칭 (내가 식별용)</label>
            <input id="macName" type="text" value="${escapeAttr(acc?.accountName || '')}" placeholder="예: PR팀 · 영업팀 · 개인 아이디"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
          </div>

          <!-- SMTP 상세 (기본 접힘 · 프리셋 선택 시 자동 채워짐) -->
          <details style="border:1px solid var(--border);border-radius:8px;padding:8px 12px;background:var(--surface-2)">
            <summary style="cursor:pointer;font-size:12px;color:var(--text-secondary);font-weight:600">⚙️ SMTP 서버 상세 (자동 채워짐 — 필요 시에만 수정)</summary>
            <div style="margin-top:12px;display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px">
              <div>
                <label style="font-size:11px;color:var(--text-secondary);font-weight:700">SMTP 호스트</label>
                <input id="macHost" type="text" value="${escapeAttr(acc?.smtpHost || '')}" placeholder="smtp.example.com"
                  style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;margin-top:2px">
              </div>
              <div>
                <label style="font-size:11px;color:var(--text-secondary);font-weight:700">포트</label>
                <input id="macPort" type="number" value="${acc?.smtpPort || 465}"
                  style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;margin-top:2px">
              </div>
              <div>
                <label style="font-size:11px;color:var(--text-secondary);font-weight:700">보안</label>
                <select id="macSecure" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;margin-top:2px">
                  <option value="true" ${acc?.smtpSecure !== false ? 'selected' : ''}>SSL (465)</option>
                  <option value="false" ${acc?.smtpSecure === false ? 'selected' : ''}>STARTTLS (587)</option>
                </select>
              </div>
            </div>
            <div style="margin-top:6px;font-size:10px;color:var(--text-tertiary)">
              이카운트 기본: <code>wsmtp.ecount.com:465</code> SSL. 프리셋 변경 시 자동 반영.
            </div>
          </details>

          <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">
            <div>
              <label style="font-size:11px;color:var(--text-secondary);font-weight:700">발신자 이름</label>
              <input id="macFromName" type="text" value="${escapeAttr(acc?.fromName || '')}" placeholder="요기보"
                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-secondary);font-weight:700">발신 주소</label>
              <input id="macFromAddress" type="text" value="${escapeAttr(acc?.fromAddress || acc?.smtpUser || '')}" placeholder="hello@company.com"
                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
            </div>
          </div>

          <!-- ④ 발송자 프로필 (템플릿 {{SenderXxx}} 변수 자동 채움) -->
          <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
            <label style="font-size:12px;color:#1e40af;font-weight:800;text-transform:uppercase;letter-spacing:0.5px">④ 발송자 프로필</label>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">메일 템플릿의 <code style="background:#eef2ff;padding:1px 5px;border-radius:4px;color:#4338ca;font-weight:600">{{SenderTitle}}</code> <code style="background:#eef2ff;padding:1px 5px;border-radius:4px;color:#4338ca;font-weight:600">{{SenderPhone}}</code> <code style="background:#eef2ff;padding:1px 5px;border-radius:4px;color:#4338ca;font-weight:600">{{SenderCompany}}</code> 변수에 자동 주입됩니다.</div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label style="font-size:11px;color:var(--text-secondary);font-weight:700">🎯 내 직함 (선택)</label>
              <input id="macSenderTitle" type="text" value="${escapeAttr(acc?.senderTitle || '')}" placeholder="예: Head of Global Partnerships"
                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-secondary);font-weight:700">📞 내 전화번호 (M:)</label>
              <input id="macSenderPhone" type="text" value="${escapeAttr(acc?.senderPhone || '')}" placeholder="예: +82 10 6747 9443"
                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
            </div>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);font-weight:700">🏢 내 회사명</label>
            <input id="macSenderCompany" type="text" value="${escapeAttr(acc?.senderCompany || '')}" placeholder="예: Yogi Corporation Inc."
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);font-weight:700">🏛 주소 (A:)</label>
            <input id="macSenderAddress" type="text" value="${escapeAttr(acc?.senderAddress || '')}" placeholder="예: 201, 125, Bongeunsa-ro, Gangnam-gu, Seoul, Korea"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);font-weight:700">🌐 웹사이트</label>
            <input id="macSenderWebsite" type="text" value="${escapeAttr(acc?.senderWebsite || '')}" placeholder="예: www.yogico.kr"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
          </div>

          <!-- 대표 지정은 계정 관리 화면 맨 위 한 곳에서만 한다.
               여기서도 바꿀 수 있게 두면 "어디서 바꿨는지" 가 흩어지고,
               이 경로로 바꿨을 때 메일함이 따라오지 않아 화면이 어긋난다.
               다만 첫 등록 때는 대표를 정해줘야 해서 신규일 때만 남긴다. -->
          ${isEdit ? `
            <div style="font-size:12px;color:var(--text-tertiary);background:var(--surface-2,#f8fafc);
                        border:1px solid var(--border-default);border-radius:8px;padding:9px 12px;line-height:1.6">
              👤 <b>대표 계정 지정</b>은 이 창이 아니라 <b>계정 목록 맨 위</b>에서 바꿉니다.
              ${acc?.isDefault ? '<br>이 계정이 현재 대표 계정입니다.' : ''}
            </div>
          ` : `
            <label style="display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer">
              <input type="checkbox" id="macIsDefault">
              <span>이 계정을 대표 계정으로 지정 (메일함이 이 계정 것이 됩니다)</span>
            </label>
          `}
        </div>

        <div style="padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
          <button id="macCancel" class="button ghost" type="button" style="font-size:13px;padding:9px 16px">닫기</button>
          <button id="macSave" class="button primary" type="button" style="font-size:14px;font-weight:700;padding:11px 24px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;box-shadow:0 2px 6px rgba(37,99,235,0.3)">
            ${isEdit ? '💾 변경사항 저장' : '🚀 내 계정 등록하기'}
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // 사용자 요청: 반드시 × 버튼 (또는 닫기 버튼) 을 눌러야만 닫히도록.
  // 백드롭 클릭·Esc 로는 닫히지 않음 (실수로 입력 다 날리는 것 방지).
  const closeModal = () => document.getElementById('mailAccountModalRoot')?.remove();
  document.getElementById('macModalClose')?.addEventListener('click', closeModal);
  document.getElementById('macCancel')?.addEventListener('click', closeModal);

  // 프리셋 선택 → 호스트/포트/보안 자동 채움 + 서비스별 가이드 표시
  const applyPreset = (key) => {
    const preset = presetOptions.find(p => p.key === key);
    if (preset && preset.host) {
      document.getElementById('macHost').value = preset.host;
      document.getElementById('macPort').value = preset.port;
      document.getElementById('macSecure').value = String(preset.secure);
    }
    // 가이드 표시/숨김
    const guide = providerGuides[key];
    const guideEl = document.getElementById('macGuide');
    const titleEl = document.getElementById('macGuideTitle');
    const stepsEl = document.getElementById('macGuideSteps');
    if (guide && guideEl) {
      titleEl.textContent = `⚡ ${guide.title}`;
      stepsEl.innerHTML = guide.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('');
      guideEl.style.display = 'block';
    } else if (guideEl) {
      guideEl.style.display = 'none'; syncBodyScrollLock();
    }
  };
  document.getElementById('macPreset')?.addEventListener('change', (e) => applyPreset(e.target.value));
  // 최초 렌더 시 현재 프리셋에 대한 가이드도 즉시 표시
  applyPreset(currentPresetKey);

  document.getElementById('macSave')?.addEventListener('click', async () => {
    const payload = {
      accountName: document.getElementById('macName').value.trim(),
      smtpHost: document.getElementById('macHost').value.trim(),
      smtpPort: parseInt(document.getElementById('macPort').value, 10),
      smtpSecure: document.getElementById('macSecure').value === 'true',
      smtpUser: document.getElementById('macUser').value.trim(),
      fromName: document.getElementById('macFromName').value.trim(),
      fromAddress: document.getElementById('macFromAddress').value.trim(),
      senderTitle: document.getElementById('macSenderTitle')?.value.trim() || '',
      senderPhone: document.getElementById('macSenderPhone')?.value.trim() || '',
      senderCompany: document.getElementById('macSenderCompany')?.value.trim() || '',
      senderAddress: document.getElementById('macSenderAddress')?.value.trim() || '',
      senderWebsite: document.getElementById('macSenderWebsite')?.value.trim() || '',
      // 수정 창에는 체크박스가 없다(대표 지정은 목록 맨 위에서만) — 없으면 건드리지 않는다
      isDefault: document.getElementById('macIsDefault')?.checked || undefined,
    };
    if (payload.isDefault === undefined) delete payload.isDefault;
    const pass = document.getElementById('macPass').value;
    if (pass) payload.smtpPass = pass;

    const btn = document.getElementById('macSave');
    btn.disabled = true; btn.textContent = '⏳ 저장 & 검증 중...';

    try {
      const url = isEdit ? `/api/mail-accounts/${editId}` : '/api/mail-accounts';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'save failed');
      closeModal();

      // 새 계정을 대표로 지정했으면 메일함도 그 계정으로 옮긴다
      const newId = data.account?._id;
      if (payload.isDefault && newId && typeof _inboxState !== 'undefined') {
        _inboxState.accountId = String(newId);
        _inboxState.accountPicked = false;
        _inboxState.page = 1;
        _inboxState.group = '';
        _inboxState.trashed = false;
        _mailAccountsCache = null;
        _mailGroupsCache = null;
        _mailCountsCache = null;
        await loadInboxAccounts(true);
        loadMailCounts(true);
      }

      await loadMailAccounts(true);
      renderMailAccountsTool();
    } catch (e) {
      alert('저장 실패: ' + (e.message || 'unknown'));
      btn.disabled = false; btn.textContent = isEdit ? '💾 수정' : '+ 저장 & 연결 테스트';
    }
  });
}

function renderCrawlerTool() {
  const isKor = (c) => /korea|한국|대한민국/i.test(c || '') && !/north/i.test(c || '');
  const hasRealEmail = (l) => l.Email && String(l.Email).trim() && !/^Not found/i.test(l.Email);

  // 검증완료(verified) 리드만 크롤링 대상
  const in_stage = baseLeads.filter(l =>
    (l.stage || 'imported') === 'verified' && !isKor(l.Country || '')
  );
  const noEmail = in_stage.filter(l => !hasRealEmail(l));
  const withSite = noEmail.filter(l => l.WebsiteContact && String(l.WebsiteContact).trim());
  const pending = withSite.filter(l => !(l.crawledAt || '').trim());
  const attempted = withSite.filter(l => (l.crawledAt || '').trim());
  const promotedInStage = in_stage.filter(l => l.crawledEmails?.length && hasRealEmail(l));
  const cVerified = { total: in_stage.length, noEmail: noEmail.length, withSite: withSite.length,
                      pending: pending.length, attempted: attempted.length, promoted: promotedInStage.length };
  const totalPending = cVerified.pending;
  const totalAttempted = cVerified.attempted;
  const totalPromoted = cVerified.promoted;

  // 실행 대상 = verified 대기 건수
  const scopeCount = cVerified.pending;

  // 최근 실행 결과 최대 20개 (역순)
  const recentResults = _crawlState.runResults.slice(-20).reverse();

  els.content.innerHTML = `
    <!-- 설명 배너 -->
    <div style="background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);border:1px solid #c7d2fe;border-radius:12px;padding:16px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-size:22px">🕷</span>
        <strong style="font-size:15px;color:#3730a3">이메일 크롤링 (무료 · 외부 API 안 씀)</strong>
      </div>
      <p style="margin:0;font-size:12px;color:#4c1d95;line-height:1.6">
        회사 홈페이지 + <code style="background:#fff;color:#4c1d95;padding:1px 5px;border-radius:4px;font-weight:600">/contact</code>
        <code style="background:#fff;color:#4c1d95;padding:1px 5px;border-radius:4px;font-weight:600">/about</code>
        <code style="background:#fff;color:#4c1d95;padding:1px 5px;border-radius:4px;font-weight:600">/about-us</code> 순회 →
        mailto: 링크 + 텍스트 이메일 추출 →
        역할별 우선순위 (partnerships > business > sales > marketing > ceo > info) →
        <b>최우선 후보 자동으로 Email 필드 승격</b>
        · 🇰🇷 한국 기업 자동 제외 · 이미 시도한 리드는 재크롤 안 함
      </p>
    </div>

    <!-- 스탯 카드 -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
      <div style="background:var(--surface-1);padding:14px;border:1px solid var(--border);border-radius:10px">
        <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;font-weight:600">🎯 크롤 대기</div>
        <div style="font-size:26px;font-weight:800;color:#f59e0b">${totalPending.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">
          검증완료 리드 중 메일 없음 + 사이트 있음
        </div>
      </div>
      <div style="background:var(--surface-1);padding:14px;border:1px solid var(--border);border-radius:10px">
        <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;font-weight:600">✅ 크롤 시도 완료</div>
        <div style="font-size:26px;font-weight:800;color:#3b82f6">${totalAttempted.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">이메일 발견/무 무관 · 재시도 안 함</div>
      </div>
      <div style="background:var(--surface-1);padding:14px;border:1px solid var(--border);border-radius:10px">
        <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;font-weight:600">📧 Email 자동 승격</div>
        <div style="font-size:26px;font-weight:800;color:#15803d">${totalPromoted.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">발견된 최우선 후보를 Email 필드에 등록</div>
      </div>
      <div style="background:var(--surface-1);padding:14px;border:1px solid var(--border);border-radius:10px">
        <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;font-weight:600">💰 예상 비용</div>
        <div style="font-size:26px;font-weight:800;color:#15803d">$0</div>
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">외부 API 안 씀 · 서버 대역폭만 사용</div>
      </div>
    </div>

    <!-- 실행 컨트롤 -->
    <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h3 style="margin:0;font-size:15px;font-weight:700">🚀 크롤 배치 실행</h3>
        <span style="font-size:11px;color:var(--text-tertiary)">
          한 번에 <b>${_crawlState.chunkLimit}건</b> 씩 순차 처리
        </span>
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:var(--text-secondary)">대상: <b>✅ 검증완료</b></label>
        <span style="font-size:11px;color:var(--text-tertiary)">(검증대기 상태는 크롤 안 함 — AI 통과 후에만)</span>
        <div style="flex:1"></div>
        <label style="font-size:12px;font-weight:600;color:var(--text-secondary)">청크당:</label>
        <select id="crawlChunkSel" style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px">
          <option value="20" ${_crawlState.chunkLimit === 20 ? 'selected' : ''}>20건 (느리게)</option>
          <option value="50" ${_crawlState.chunkLimit === 50 ? 'selected' : ''}>50건 (기본)</option>
          <option value="100" ${_crawlState.chunkLimit === 100 ? 'selected' : ''}>100건 (빠르게)</option>
        </select>
      </div>
      <button id="crawlRunBtn" class="button primary" type="button"
        ${_crawlState.running || scopeCount === 0 ? 'disabled' : ''}
        style="width:100%;padding:14px;font-size:14px;font-weight:700;background:${scopeCount === 0 ? '#9ca3af' : '#4338ca'};color:white;border:none;border-radius:10px;cursor:${scopeCount === 0 ? 'not-allowed' : 'pointer'}">
        ${_crawlState.running
          ? '⏳ 크롤 실행 중...'
          : scopeCount === 0
            ? '✅ 크롤 대기 없음 (모두 처리됨)'
            : `🕷 크롤 실행 (${scopeCount}건 · 무료)`}
      </button>
    </div>

    <!-- 최근 실행 결과 -->
    <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:20px">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700">📊 최근 실행 결과 (이번 세션)</h3>
      ${recentResults.length === 0 ? `
        <div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:12px;background:var(--surface-2);border-radius:8px">
          아직 실행한 배치가 없습니다. 위 "🕷 크롤 실행" 버튼을 눌러 시작하세요.
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:6px">
          ${recentResults.map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--surface-2);border-radius:6px;font-size:12px">
              <span style="color:var(--text-tertiary)">${r.ts} · chunk#${r.chunk}</span>
              <span>처리 <b style="color:#3b82f6">${r.processed}</b> · 발견 <b style="color:#15803d">${r.found}</b> · 승격 <b style="color:#15803d">${r.promoted}</b></span>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  // 바인딩
  document.getElementById('crawlChunkSel')?.addEventListener('change', (e) => {
    _crawlState.chunkLimit = parseInt(e.target.value, 10);
    renderCrawlerTool();
  });
  document.getElementById('crawlRunBtn')?.addEventListener('click', () => runCrawlerBatch());
}

async function runCrawlerBatch() {
  if (_crawlState.running) return;
  const scopes = ['verified-no-email'];
  _crawlState.running = true;
  renderCrawlerTool();

  let totalP = 0, totalF = 0, totalPr = 0;
  try {
    for (const scope of scopes) {
      let chunkNum = 0;
      // eslint-disable-next-line no-constant-condition
      while (chunkNum < 40) {
        const res = await fetch('/api/leads/crawl-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope,
            limit: _crawlState.chunkLimit,
            excludeKorea: true,
            promoteToEmail: true,
            skipAlreadyCrawled: true,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || '크롤 실패');
        chunkNum++;
        totalP += data.processed || 0;
        totalF += data.foundCount || 0;
        totalPr += data.promotedCount || 0;
        _crawlState.runResults.push({
          chunk: chunkNum,
          processed: data.processed || 0,
          found: data.foundCount || 0,
          promoted: data.promotedCount || 0,
          ts: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        });
        // 실시간 렌더링 (스탯 갱신)
        renderCrawlerTool();
        if ((data.processed || 0) === 0) break;
        await new Promise(r => setTimeout(r, 500));
      }
    }
    // 완료 후 leads 재로드
    invalidateServerPage();
    await loadLeads({ force: true });
    _crawlState.running = false;
    renderCrawlerTool();
    alert(
      `✅ 크롤링 배치 완료\n\n` +
      `처리: ${totalP}건\n` +
      `이메일 발견: ${totalF}건\n` +
      `Email 필드 자동 승격: ${totalPr}건\n` +
      `비용: $0 (외부 API 안 씀)`
    );
  } catch (e) {
    _crawlState.running = false;
    renderCrawlerTool();
    alert(`❌ 크롤 실패: ${e.message || 'unknown'}\n\n지금까지 처리: ${totalP}건`);
  }
}

async function renderRecommendedBuyers() {
  els.content.innerHTML = `<div style="padding:32px;text-align:center;color:#6b7280">불러오는 중...</div>`;
  if (!_recommendedCache) {
    try {
      const res = await fetch('/api/recommended-buyers');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'load failed');
      _recommendedCache = data.data;
    } catch (e) {
      els.content.innerHTML = emptyState('추천 리스트를 불러오지 못했습니다: ' + (e?.message || ''));
      return;
    }
  }

  const buyers = _recommendedCache;
  // 지역별 그룹핑
  const byRegion = {};
  for (const b of buyers) {
    byRegion[b.region] = byRegion[b.region] || [];
    byRegion[b.region].push(b);
  }
  const regionOrder = ['Global', 'Europe', 'Middle East', 'North America', 'Asia', 'Oceania', 'Africa', 'Latin America'];
  const regionLabels = {
    Global: '🌐 글로벌 플랫폼',
    Europe: '🇪🇺 유럽',
    'Middle East': '🕌 중동',
    'North America': '🇺🇸 북미',
    Asia: '🌏 아시아',
    Oceania: '🇦🇺 오세아니아',
    Africa: '🌍 아프리카',
    'Latin America': '🇧🇷 중남미',
  };

  const totalCount = buyers.length;
  const importedCount = buyers.filter(b => b.imported).length;
  const availableCount = totalCount - importedCount;

  els.content.innerHTML = `
    <div style="margin-bottom:20px;padding:16px 18px;background:linear-gradient(135deg,#fef9c3 0%,#fef3c7 100%);border:1px solid #facc15;border-radius:12px;font-size:13px;line-height:1.7;color:#854d0e">
      <div style="font-size:15px;font-weight:800;margin-bottom:8px">📋 추천 리스트가 뭔가요?</div>
      <div>
        웹 검색과 산업 매체 (knokglobal · kbeautyproduction · cosmeticindex 등) + 각 회사 공식 사이트 기반으로
        발굴한 <b>글로벌 K-beauty B2B 디스트리뷰터/도매/리테일러 시드 ${totalCount}건</b>입니다 (발굴 시점: 2026-06).
      </div>
      <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;font-size:12px">
        <span style="background:white;padding:4px 10px;border-radius:99px;font-weight:600">① 체크박스로 선택 또는 일괄 추가</span>
        <span style="background:white;padding:4px 10px;border-radius:99px;font-weight:600">② 내 리드로 들어감 → 검증 파이프라인 통과</span>
        <span style="background:white;padding:4px 10px;border-radius:99px;font-weight:600">③ 이메일 컨택 · 협상 등 이미 진행 중인 업체는 카드 우측 "이동" 버튼으로 바로 이동</span>
      </div>
    </div>

    <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
      <span style="font-size:14px"><strong>${totalCount}</strong>개 시드</span>
      <span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600">✅ 이미 등록 ${importedCount}</span>
      <span style="background:#f1f5f9;color:#475569;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600">⭕ 추가 가능 ${availableCount}</span>
      <div style="flex:1"></div>
      <button id="recImportSelected" class="button" type="button" disabled style="padding:8px 16px;font-size:13px;font-weight:700">선택 항목 추가 (0)</button>
      <button id="recImportAll" class="button secondary" type="button" style="padding:8px 16px;font-size:13px">미등록 ${availableCount}건 일괄 추가</button>
    </div>

    ${regionOrder.filter(r => byRegion[r]).map(region => `
      <section style="margin-bottom:24px">
        <h3 style="margin:0 0 12px;font-size:15px;color:var(--text-primary);font-weight:700;display:flex;align-items:center;gap:8px">
          <span>${regionLabels[region]}</span>
          <span style="background:var(--surface-2);color:var(--text-secondary);padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700">${byRegion[region].length}</span>
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
          ${byRegion[region].map(b => recommendedCardHtml(b)).join('')}
        </div>
      </section>
    `).join('')}
  `;

  // 카드 체크박스 동기화
  const updateSelectedCount = () => {
    const n = els.content.querySelectorAll('[data-rec-select]:checked').length;
    const btn = document.getElementById('recImportSelected');
    if (btn) {
      btn.textContent = `선택 항목 추가 (${n})`;
      btn.disabled = n === 0;
    }
  };
  els.content.querySelectorAll('[data-rec-select]').forEach(cb => {
    cb.addEventListener('change', updateSelectedCount);
  });

  // 선택 import
  document.getElementById('recImportSelected')?.addEventListener('click', async () => {
    const companies = [...els.content.querySelectorAll('[data-rec-select]:checked')]
      .map(cb => cb.dataset.recSelect);
    if (!companies.length) return;
    await importRecommended(companies);
  });

  // 진행 중 업체 (컨택/응답/협상/파트너) 로 이동
  els.content.querySelectorAll('.rec-jump-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.jumpView;
      const leadId = btn.dataset.jumpLead;
      if (!view) return;
      state.view = view;
      if (leadId) state.selectedId = leadId;
      resetPagination();
      _serverPageCache = null;
      render();
    });
  });

  // 미등록 카드 · stage 선택 → 즉시 리드 추가 + 그 stage 로 이동
  els.content.querySelectorAll('.rec-stage-add').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const stage = e.target.value;
      const company = e.target.dataset.company;
      if (!stage || !company) return;
      const stageLabelMap = { verifying:'검증 대기', verified:'검증 완료', queued:'발송 리스트', contacted:'발송 완료', replied:'응답 옴', negotiating:'협상 중', partner:'파트너' };
      const ok = confirm(`"${company}" 을(를) ${stageLabelMap[stage] || stage} 로 추가하시겠습니까?`);
      if (!ok) {
        e.target.value = '';
        return;
      }
      await importRecommended([company], stage);
    });
  });

  // 전체 미등록 import
  document.getElementById('recImportAll')?.addEventListener('click', async () => {
    const ok = confirm(`미등록 ${availableCount}건을 모두 내 리드로 추가하시겠습니까?`);
    if (!ok) return;
    const companies = buyers.filter(b => !b.imported).map(b => b.company);
    await importRecommended(companies);
  });
}

function recommendedCardHtml(b) {
  const prioColor = b.priority === 'A-' ? '#dc2626' : b.priority === 'B' ? '#f59e0b' : '#64748b';
  // stage 기반 배지 · 이동 페이지 결정
  const stageMap = {
    imported:      { view:'pipeline-import',       label:'📥 가져오기',       bg:'#f1f5f9', fg:'#475569' },
    'ai-searched': { view:'pipeline-ai-searched', label:'🤖 AI 서칭',        bg:'#ede9fe', fg:'#5b21b6' },
    verifying:     { view:'pipeline-verifying',   label:'🔍 검증 대기',      bg:'#fef9c3', fg:'#854d0e' },
    verified:      { view:'pipeline-verified',    label:'✅ AI 검증 완료',      bg:'#dcfce7', fg:'#166534' },
    contacted:     { view:'pipeline-contacted',   label:'📨 이메일 컨택 중', bg:'#dbeafe', fg:'#1e40af' },
    replied:       { view:'pipeline-replied',     label:'💬 응답 옴',        bg:'#e0e7ff', fg:'#3730a3' },
    negotiating:   { view:'pipeline-negotiating', label:'🤝 협상 중',        bg:'#fed7aa', fg:'#9a3412' },
    partner:       { view:'pipeline-partner',     label:'⭐ 파트너',         bg:'#f3e8ff', fg:'#6b21a8' },
    archived:      { view:'pipeline-verified',    label:'📦 보관',           bg:'#f3f4f6', fg:'#6b7280' },
    failed:        { view:'pipeline-verified',    label:'🚫 검증 실패',      bg:'#fee2e2', fg:'#991b1b' },
  };
  const s = b.imported && b.existingStage ? stageMap[b.existingStage] : null;
  const stageBadge = s
    ? `<span style="background:${s.bg};color:${s.fg};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${s.label}</span>`
    : (b.imported ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">✅ 등록완료</span>` : '');

  const jumpBtn = s && ['contacted','replied','negotiating','partner'].includes(b.existingStage)
    ? `<button type="button" class="rec-jump-btn" data-jump-view="${s.view}" data-jump-lead="${escapeAttr(b.existingLeadId || '')}"
        style="padding:6px 12px;background:#2563eb;color:white;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 1px 3px rgba(37,99,235,0.3)">
        →  ${s.label.replace(/^[^\s]+\s*/, '')} 로 이동
      </button>`
    : '';

  // 미등록 카드 · stage 선택 드롭다운 (선택 시 즉시 import + stage 설정)
  const addStageSelect = b.imported ? '' : `
    <select class="rec-stage-add" data-company="${escapeAttr(b.company)}"
      style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;font-weight:600;background:#ffffff;color:#0f172a;cursor:pointer;min-width:150px">
      <option value="">➕ 여기로 추가 ▾</option>
      <option value="verifying">🔍 검증 대기</option>
      <option value="verified">✅ 검증 완료 (승인 게이트)</option>
      <option value="contacted">📨 이메일 컨택 (발송함)</option>
      <option value="replied">💬 응답 옴</option>
      <option value="negotiating">🤝 협상 중</option>
      <option value="partner">⭐ 파트너 (완료)</option>
    </select>
  `;

  return `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;${b.imported && !s ? 'opacity:0.7' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">
            <strong style="font-size:14px;color:#0f172a">${escapeHtml(b.company)}</strong>
            <span style="background:${prioColor};color:#fff;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:700">${b.priority}</span>
            ${stageBadge}
          </div>
          <div style="font-size:12px;color:#6b7280">${escapeHtml(b.country)} · ${escapeHtml(b.type)}</div>
        </div>
      </div>
      <div style="font-size:12px;color:#374151;line-height:1.5">${escapeHtml(b.brandsChannels)}</div>
      <div style="font-size:11px;color:#6b7280;line-height:1.5;padding:6px 8px;background:#f9fafb;border-radius:6px;border-left:3px solid #4f8cff">
        <strong>왜 추천:</strong> ${escapeHtml(b.evidence)}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <div style="display:flex;gap:10px;align-items:center">
          <a href="${escapeAttr(b.website)}" target="_blank" rel="noreferrer" style="font-size:12px;color:#4f8cff">🔗 사이트 열기</a>
          <a href="${escapeAttr(b.source)}" target="_blank" rel="noreferrer" style="font-size:11px;color:#9ca3af">출처</a>
        </div>
        ${addStageSelect}
        ${jumpBtn}
      </div>
    </div>
  `;
}

async function importRecommended(companies, stage) {
  startTopProgress();
  const stageLabelMap = { verifying:'검증대기', verified:'검증완료', queued:'발송 리스트', contacted:'발송 완료', replied:'응답 옴', negotiating:'협상 중', partner:'파트너' };
  const stageLabel = stage ? ` (${stageLabelMap[stage] || stage} 로)` : '';
  showGlobalBlocker(`${companies.length}건${stageLabel} 추가 중...`);
  try {
    const res = await fetch('/api/recommended-buyers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies, stage }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'import failed');
    alert(`✅ 추가 완료\n\n신규: ${data.summary.inserted}건\n이미 존재: ${data.summary.skipped}건`);
    _recommendedCache = null;
    // baseLeads 새로고침
    try {
      const r = await fetch('/api/leads');
      const lr = await r.json();
      if (lr.success) baseLeads = lr.data.map(lead => ({ ...lead, id: lead.leadId }));
    } catch {}
    render();
  } catch (e) {
    alert('추가 실패: ' + (e?.message || e));
  } finally {
    hideGlobalBlocker();
    finishTopProgress();
  }
}

// edit 모달 등에서 사용할 상세 패널 HTML
function verifyDetailsHtml(lead) {
  // 즐겨찾기는 대표가 직접 검증한 리드 — 자동 검증 결과보다 우선 신뢰
  if (lead?.favorite === true) {
    const v = lead?.verification;
    const hasAuto = v && v.verifiedAt;
    return `
      <div style="background:#fef9c3;padding:12px 14px;border-radius:8px;border:1px solid #facc15">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:18px">⭐</span>
          <strong style="font-size:14px;color:#854d0e">직접 검증 완료</strong>
        </div>
        <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5">
          즐겨찾기에 등록된 리드입니다. 자동 검증 결과와 무관하게 신뢰 가능한 항목으로 처리됩니다.
          ${hasAuto ? `<br><span style="color:#a16207">(참고: 자동 검증 점수 ${v.score ?? 0}/5)</span>` : ''}
        </p>
      </div>
    `;
  }

  const v = lead?.verification;
  if (!v || !v.verifiedAt) {
    return `<div style="font-size:13px;color:#9ca3af">⏳ 아직 검증되지 않았습니다. 툴바의 🔍 검증 버튼으로 실행하세요.</div>`;
  }
  const bucket = verifyBucketOf(lead);
  const headerColor = bucket === 'passed' ? '#166534' : bucket === 'suspicious' ? '#92400e' : bucket === 'invalid' ? '#991b1b' : '#64748b';

  const row = (label, ok, detail) => {
    const icon = ok === true ? '✅' : ok === false ? '❌' : '⏳';
    const color = ok === true ? '#166534' : ok === false ? '#991b1b' : '#9ca3af';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px">
        <span style="width:80px;color:#6b7280">${label}</span>
        <span style="color:${color};font-weight:600">${icon}</span>
        <span style="color:#374151">${detail}</span>
      </div>
    `;
  };

  const verifiedAt = new Date(v.verifiedAt).toLocaleString('ko-KR');

  // 사업 관련성 — 통과/실패가 boolean 이 아니라 level 기반이라 별도 처리
  const bizOk = v.businessLevel === 'relevant' ? true
              : v.businessLevel === 'unrelated' || v.businessLevel === 'unclear' ? false
              : null;
  const ev = v.businessEvidence || {};
  // 사이트가 자기소개로 뭐라고 하는지 (가장 강한 증거)
  const evidenceHtml = (ev.title || ev.description || ev.h1)
    ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;padding:6px 8px;background:#f9fafb;border-radius:4px;line-height:1.4">
         ${ev.title ? `<div><strong>제목:</strong> ${escapeHtml(ev.title)}${ev.titleHit ? ` <span style="color:#16a34a">⊕${escapeHtml(ev.titleHit)}</span>` : ''}</div>` : ''}
         ${ev.description ? `<div style="margin-top:2px"><strong>소개:</strong> ${escapeHtml(ev.description.slice(0, 150))}${ev.description.length > 150 ? '…' : ''}${ev.metaHit ? ` <span style="color:#16a34a">⊕${escapeHtml(ev.metaHit)}</span>` : ''}</div>` : ''}
         ${ev.h1 && ev.h1 !== ev.title ? `<div style="margin-top:2px"><strong>대표문구:</strong> ${escapeHtml(ev.h1)}</div>` : ''}
       </div>`
    : '';
  const bizDetail = v.businessLevel
    ? `${businessLevelLabel(v.businessLevel)} (점수 ${v.businessScore ?? 0}/3)` +
      (Array.isArray(v.businessKeywords) && v.businessKeywords.length
        ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">매칭 키워드: ${escapeHtml(v.businessKeywords.slice(0, 8).join(', '))}</div>`
        : '') +
      evidenceHtml
    : (v.businessReason ? reasonKo(v.businessReason) : '미확인');

  return `
    <div style="background:#f8fafc;padding:12px 14px;border-radius:8px;border:1px solid #e5e7eb">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong style="font-size:14px;color:${headerColor}">검증 점수: ${v.score ?? 0}/5</strong>
        <span style="font-size:11px;color:#9ca3af">${verifiedAt} 검증</span>
      </div>
      ${row('이메일',   v.emailValid,    v.emailValid === false ? reasonKo(v.emailReason) : (lead.Email || '값 없음'))}
      ${row('웹사이트', v.websiteAlive,  v.websiteAlive === false ? `연결 실패 ${v.websiteStatus ? `(HTTP ${v.websiteStatus})` : '(응답 없음)'}` : (lead.WebsiteContact ? websiteLinkHtml(lead.WebsiteContact) : '값 없음'))}
      ${row('전화',     v.phoneMatch,    v.phoneMatch === false ? reasonKo(v.phoneReason) : (lead.Phone || '값 없음'))}
      ${row('LinkedIn', v.linkedinValid, v.linkedinValid === false ? reasonKo(v.linkedinReason) : (lead.LinkedInCompany || lead.ContactLinkedIn || '값 없음'))}
      ${row('사업관련성', bizOk, bizDetail)}
      ${v.aiVerifiedAt ? aiVerdictRowHtml(v) : ''}
    </div>
  `;
}

// AI 판단 결과 행 — verifyDetailsHtml 안에서 사용
function aiVerdictRowHtml(v) {
  const verdictMap = {
    'beauty-buyer': { icon: '✅', label: '진성 K-beauty 바이어', color: '#166534', bg: '#dcfce7' },
    'maybe':        { icon: '⚠',  label: '모호 / 가능성 있음',  color: '#92400e', bg: '#fef3c7' },
    'not-buyer':    { icon: '❌', label: '무관 산업',           color: '#991b1b', bg: '#fee2e2' },
  };
  const m = verdictMap[v.aiVerdict] || { icon: '⏳', label: '미확인', color: '#64748b', bg: '#f1f5f9' };
  const conf = v.aiConfidence ? `<span style="font-size:10px;color:#9ca3af;margin-left:4px">(신뢰도 ${v.aiConfidence})</span>` : '';
  const signals = Array.isArray(v.aiSignals) && v.aiSignals.length
    ? `<div style="font-size:11px;color:#6b7280;margin-top:3px">근거 키워드: ${v.aiSignals.slice(0, 6).map(escapeHtml).join(', ')}</div>`
    : '';
  return `
    <div style="padding:8px 0;border-top:1px dashed #c7d2fe;margin-top:6px">
      <div style="display:flex;align-items:center;gap:8px;font-size:12px">
        <span style="font-size:14px">🧠</span>
        <span style="background:${m.bg};color:${m.color};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${m.icon} ${m.label}</span>
        ${conf}
      </div>
      ${v.aiReasoning ? `<div style="font-size:12px;color:#1e1b4b;margin-top:6px;line-height:1.5;padding:6px 8px;background:#eef2ff;border-radius:6px;border-left:3px solid #6366f1">${escapeHtml(v.aiReasoning)}</div>` : ''}
      ${signals}
    </div>
  `;
}

function getFilteredLeads() {
  const query = state.query.toLowerCase();
  let filtered = getLeads().filter((lead) => {
    const haystack = [
      lead.Country,
      lead.Company,
      lead.Type,
      lead.Evidence,
      lead.BrandsChannels,
      lead.BuyerContact,
      lead.Title,
      lead.Email,
      lead.Phone,
      lead.WebsiteContact,
      lead.Sources,
      lead.notes
    ].join(" ").toLowerCase();

    return (!query || haystack.includes(query))
      && (state.country === "All" || lead.Country === state.country)
      && (state.status === "All" || lead.status === state.status)
      && (state.priority === "All" || lead.Priority === state.priority)
      && verifyBucketMatches(lead, state.verify);
  });
  
  if (state.sortField) {
    filtered.sort((a, b) => {
      const valA = String(a[state.sortField] || '');
      const valB = String(b[state.sortField] || '');
      const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
      return state.sortOrder === 'asc' ? cmp : -cmp;
    });
  } else {
    filtered.sort(leadSort);
  }
  
  return filtered;
}

async function updateLead(id, key, value) {
  const current = getLeads().find((item) => item.id === id);
  if (!current) return;
  const payload = { [key]: value };
  if (key === "status" && value === "Contacted" && current?.status !== "Contacted") {
    payload.previousStatus = current?.status || "New";
    payload.lastContact = new Date().toISOString().slice(0, 10);
  }
  if (key === "status" && value !== "Contacted") {
    payload.previousStatus = "";
  }
  Object.assign(current, payload);
  renderFilters();
  renderPipeline();
  renderStats(getFilteredLeads());
  updateActionButtons();
  if (key === "status") {
    render();
  } else if (["Country", "Priority"].includes(key)) {
    // Priority 필터는 화면에서 숨겼다 — 없을 수 있으니 확인하고 쓴다
    if (els.country) els.country.value = state.country;
    if (els.priority) els.priority.value = state.priority;
  }
  if(current._id) {
    await fetch('/api/leads/' + current._id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
}

async function toggleFavorite(id) {
  const lead = getLeads().find((item) => item.id === id);
  if (!lead) return;
  lead.favorite = !Boolean(lead.favorite);
  render();
  if(lead._id) {
    await fetch('/api/leads/' + lead._id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorite: lead.favorite }) });
  }
}

async function markSelectedContacted() {
  if (!state.selectedId) return;
  updateLead(state.selectedId, "status", "Contacted");
}

async function undoSelectedContacted() {
  if (!state.selectedId) return;
  const lead = getLeads().find((item) => item.id === state.selectedId);
  if (!lead || lead.status !== "Contacted") return;
  updateLead(state.selectedId, "status", lead.previousStatus || "New");
}

function updateActionButtons() {
  const lead = getLeads().find((item) => item.id === state.selectedId);
  // 방어: 버튼이 없을 수 있음 (숨김 처리된 legacy 버튼)
  if (els.markContacted) els.markContacted.disabled = !lead || lead.status === "Contacted";
  if (els.undoContacted) els.undoContacted.disabled = !lead || lead.status !== "Contacted";
}

function addLead() {
  // 모달 열기
  const modal = document.getElementById('addLeadModal');
  if (!modal) return;
  // 폼 초기화
  const form = document.getElementById('addLeadForm');
  if (form) form.reset();
  modal.style.display = 'flex';
  delete modal.dataset.userTyped;   // 새로 여는 것이니 "쓰던 내용" 표시를 지운다
  lockBodyScroll();
}

function initAddLeadModal() {}

function initEditModal() {}

// 상세 모달의 입력칸 채우기. 처음 열 때(캐시)와 상세를 받아온 뒤 두 번 불린다.
// id 가 곧 DB 필드명이라 배열만 돌면 된다 (없는 칸은 건너뛴다).
function fillEditModalFields(lead) {
  const fields = ["status", "owner", "lastContact", "nextFollowUp", "notes",
    "Company", "Country", "Priority", "Type", "BuyerContact", "Title",
    "Email", "Phone", "WebsiteContact", "LinkedInCompany", "BrandsChannels",
    "Evidence", "Approach", "Sources"];
  fields.forEach((f) => {
    const el = document.getElementById('el-' + f);
    if (!el) return;
    // 근거·업종은 한국어본이 있으면 그것을 보여준다 (원문은 DB 에 그대로 남아 있다)
    if (f === 'Evidence') el.value = lead.EvidenceKo || lead.Evidence || "";
    else if (f === 'Type') el.value = lead.TypeKo || lead.Type || "";
    else el.value = lead[f] || "";
  });
  // 헤더 요약도 같이 — 상세를 받아오면 업종이 뒤늦게 채워진다
  const meta = document.getElementById('el-meta');
  if (meta) meta.textContent = (lead.Country || "") + " · " + (lead.TypeKo || lead.Type || "Lead");

  // AI 판정 사유 — 이미 한국어로 저장돼 있다. 번역이 필요 없다.
  const box = document.getElementById('el-aiReasonBox');
  if (box) {
    const v = lead.verification || {};
    const reason = String(v.aiReasoning || '').trim();
    if (!reason) { box.style.display = 'none'; box.innerHTML = ''; }
    else {
      const VERDICT = {
        'beauty-buyer': { label: '진성 바이어', bg: '#dcfce7', fg: '#166534' },
        'maybe':        { label: '모호 — 사람 판단 필요', bg: '#fef3c7', fg: '#92400e' },
        'not-buyer':    { label: '무관', bg: '#fee2e2', fg: '#991b1b' },
      };
      const vd = VERDICT[v.aiVerdict] || { label: v.aiVerdict || '판정 없음', bg: '#f1f5f9', fg: '#475569' };
      box.style.display = '';
      box.innerHTML = `
        <div style="padding:11px 13px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:9px">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
            <span style="font-size:10.5px;font-weight:800;color:#4338ca;letter-spacing:.4px">AI 판정</span>
            <span style="padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;
                         background:${vd.bg};color:${vd.fg}">${escapeHtml(vd.label)}</span>
          </div>
          <div style="font-size:12.5px;line-height:1.65;color:#312e81;white-space:pre-wrap">${escapeHtml(reason)}</div>
        </div>`;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   상세 팝업 검토 바 — 닫지 않고 판정하고 다음 회사로.

   검증 완료 418곳을 검토하려면 지금까지는 [열기 → 보고 → 닫기 → 다음 행 클릭]
   을 418번 반복해야 했다. 그 사이 판정(발송 리스트로 / 검증 실패)은 목록으로
   돌아가서 따로 눌러야 했다. 팝업 안에서 다 끝내고 → 로 넘어가게 한다.
   ═══════════════════════════════════════════════════════════════ */

// 지금 팝업이 훑고 있는 목록 (화면에 보이는 순서 그대로)
var _reviewList = [];

/** leadId → _id (화면에 없는 업체를 서버에서 받아올 때 쓴다) */
var _reviewIdMap = new Map();
/** 이 목록이 어느 화면·조건으로 만들어졌는지 (조건이 그대로면 다시 안 받는다) */
var _reviewKey = '';

/** 팝업을 연 화면의 목록을 검토 순서로 잡아둔다 */
function setReviewList(ids) {
  _reviewList = Array.isArray(ids) ? ids.filter(Boolean) : [];
}

/** 지금 화면이 보고 있는 단계 (검토 목록을 서버에서 받을 때 쓴다) */
function reviewStageOfView() {
  return ({
    'pipeline-verified': 'verified',
    'pipeline-replied': 'replied',
    'pipeline-negotiating': 'negotiating',
    'pipeline-partner': 'partner',
    'pipeline-failed': '__failed',
    'pipeline-archived': 'archived',
  })[state.view] || null;
}

/**
 * 검토 목록을 화면 전체 기준으로 받아온다.
 *
 * 예전에는 DOM 에 그려진 행만 모아서 "3 / 50곳" 처럼 한 페이지 안에서만
 * 넘어갔다. 418곳을 훑으려고 연 팝업인데 50곳에서 막히면 결국 목록으로
 * 돌아가 다음 페이지를 눌러야 한다. 표시용 필드는 빼고 식별자만 받는다.
 */
async function loadReviewList() {
  const stage = reviewStageOfView();
  if (!stage) { setReviewList(collectVisibleLeadIds()); return; }

  const q = (state.query || '').trim();
  const country = state.country && state.country !== 'All' ? state.country : '';
  const sub = stage === 'verified' ? (state.verifiedSubFilter || 'all') : '';
  const key = [stage, q, country, sub, _leadSort].join('::');
  if (key === _reviewKey && _reviewList.length) return;   // 조건 그대로면 재사용

  try {
    const p = new URLSearchParams({ idsOnly: '1', stage });
    if (q) p.set('q', q);
    if (country) p.set('country', country);
    if (sub && sub !== 'all') p.set('sub', sub);
    if (_leadSort === 'reco' || _leadSort === 'country') p.set('sort', _leadSort);
    const r = await safeJsonFetch(`/api/leads?${p}`);
    if (!r?.success) throw new Error(r?.error || '목록 조회 실패');
    _reviewIdMap = new Map((r.ids || []).map((x) => [x.leadId, x._id]));
    setReviewList((r.ids || []).map((x) => x.leadId));
    _reviewKey = key;
  } catch (e) {
    console.warn('review-list', e);
    setReviewList(collectVisibleLeadIds());   // 실패하면 최소한 이 페이지라도
  }
}

/** 지금 화면에서 검토 대상이 되는 행들을 순서대로 (DOM 순서 = 사용자가 보는 순서) */
function collectVisibleLeadIds() {
  const sels = ['tr[data-id]', 'tr.legacy-row[data-lead]', 'tr.outbox-lead-open[data-lead-id]'];
  for (const sel of sels) {
    const rows = [...document.querySelectorAll(sel)];
    if (!rows.length) continue;
    const ids = rows
      .map((r) => r.dataset.id || r.dataset.lead || r.dataset.leadId)
      .filter(Boolean);
    if (ids.length) return ids;
  }
  return [];
}

/** 검토 바(이동·판정)를 지금 리드에 맞게 다시 그린다 */
function refreshReviewBar(lead) {
  const navBox = document.getElementById('el-navBox');
  const judgeBox = document.getElementById('el-judgeBox');
  const pos = document.getElementById('el-navPos');
  const prev = document.getElementById('el-prev');
  const next = document.getElementById('el-next');
  if (!navBox || !judgeBox) return;

  // 목록이 없으면(단건 조회 등) 이동 버튼은 숨긴다
  const idx = _reviewList.indexOf(state.selectedId);
  if (idx < 0 || _reviewList.length < 2) {
    navBox.style.display = 'none';
  } else {
    navBox.style.display = 'flex';
    pos.textContent = `${idx + 1} / ${_reviewList.length}곳`;
    prev.disabled = idx === 0;
    next.disabled = idx === _reviewList.length - 1;
  }

  // 판정 버튼은 "아직 안 보낸 단계" 에서만 의미가 있다.
  // 이미 나갔거나 답장이 온 곳을 앞단계로 돌리면 두 번 보내게 된다.
  const stage = (lead && lead.stage) || '';
  const canJudge = stage === 'verified' || stage === 'queued' || stage === 'archived';
  judgeBox.style.display = canJudge ? 'flex' : 'none';

  const toQueue = document.getElementById('el-toQueue');
  const toFailed = document.getElementById('el-toFailed');
  if (toQueue) {
    // 이미 발송 리스트에 있으면 빼는 버튼으로 바뀐다
    const inQueue = stage === 'queued';
    toQueue.textContent = inQueue ? '↩ 발송 취소' : '✉ 메일 보낼곳으로 선정';
    toQueue.className = 'el-judge ' + (inQueue ? 'el-judge-no' : 'el-judge-go');
    toQueue.title = inQueue
      ? '발송 리스트에서 빼고 검증 완료로 되돌립니다'
      : '이 업체는 메일을 보냅니다 — 발송 리스트로 옮깁니다. 지금 나가지는 않습니다';
    toQueue.disabled = false;
  }
  if (toFailed) { toFailed.disabled = false; toFailed.textContent = '🚫 검증실패 업체로 선정'; }
}

/**
 * 이전/다음 업체로 (팝업을 닫지 않는다).
 *
 * 목록이 화면 전체(418곳)라서 다음 업체가 지금 페이지에 없을 수 있다.
 * 그때는 그 업체만 서버에서 받아 캐시에 넣고 연다.
 */
async function reviewStep(delta) {
  const idx = _reviewList.indexOf(state.selectedId);
  if (idx < 0) return;
  const nextId = _reviewList[idx + delta];
  if (!nextId) return;

  if (findLeadForPopup(nextId)) { openEditModal(nextId); return; }

  // 캐시에 없다 — 이 한 건만 받아온다
  const oid = _reviewIdMap.get(nextId);
  const pos = document.getElementById('el-navPos');
  if (pos) pos.textContent = '불러오는 중';
  if (!oid) { if (pos) pos.textContent = ''; return; }
  try {
    const r = await safeJsonFetch(`/api/leads/${oid}`);
    if (!r?.lead) throw new Error('불러오기 실패');
    const lead = { ...r.lead, id: r.lead.leadId };
    _popupLeadCache = _popupLeadCache.filter((l) => l.id !== lead.id).concat(lead);
    openEditModal(lead.id);
  } catch (e) {
    alert('다음 업체를 불러오지 못했습니다: ' + (e.message || 'unknown'));
    if (pos) pos.textContent = '';
  }
}

/**
 * 판정하고 자동으로 다음 회사로.
 *
 * 판정한 회사는 이 화면 목록에서 빠지므로, 목록에서도 지우고 같은 자리에 있던
 * 다음 회사를 연다. 마지막이었으면 팝업을 닫는다.
 */
async function reviewJudge(action) {
  const id = state.selectedId;
  const lead = findLeadForPopup(id);
  if (!lead) return;

  const btns = [document.getElementById('el-toQueue'), document.getElementById('el-toFailed')];
  btns.forEach((b) => { if (b) b.disabled = true; });

  try {
    if (action === 'queue' || action === 'unqueue') {
      const r = await safeJsonFetch('/api/leads/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [lead.leadId], undo: action === 'unqueue' }),
      });
      if (!r?.success) throw new Error(r?.error || '이동 실패');
      // success 만 보면 0건 이동도 성공으로 읽힌다. 서버는 조건에 안 맞는 건
      // (메일 없음·이미 다른 단계로 넘어감)을 조용히 건너뛰므로, 실제로
      // 옮겨졌는지까지 확인해야 "눌렀는데 그대로"를 눈치챌 수 있다.
      if (r.moved === 0) {
        throw new Error(action === 'unqueue'
          ? '이미 발송 리스트에 없는 업체입니다. 화면을 새로고침해 주세요.'
          : '옮기지 못했습니다. 보낼 메일 주소가 없거나 이미 다른 단계로 넘어간 업체입니다.');
      }
      lead.stage = action === 'unqueue' ? 'verified' : 'queued';
    } else if (action === 'failed') {
      if (!lead._id) throw new Error('이 리드는 여기서 옮길 수 없습니다');
      const r = await safeJsonFetch(`/api/leads/${lead._id}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'failed' }),
      });
      if (!r?.success) throw new Error(r?.error || '이동 실패');
      lead.stage = 'failed';
    }

    invalidateServerPage();
    loadStageCounts(true);

    // 리스트에서 빼기(unqueue)는 이 화면에 그대로 남는 판정이라 넘어가지 않는다
    if (action === 'unqueue') { refreshReviewBar(lead); return; }

    // 판정한 회사는 이 목록에서 빠진다 — 같은 자리의 다음 회사로
    const idx = _reviewList.indexOf(id);
    _reviewList = _reviewList.filter((x) => x !== id);
    const nextId = _reviewList[idx] || _reviewList[idx - 1];
    if (nextId) {
      openEditModal(nextId);
    } else {
      // 마지막 회사까지 판정했다 — 닫고 목록으로
      const modal = document.getElementById('editLeadModal');
      if (modal) modal.style.display = 'none';
      syncBodyScrollLock();
      render();
    }
  } catch (e) {
    alert('처리 실패: ' + (e.message || 'unknown'));
    btns.forEach((b) => { if (b) b.disabled = false; });
  }
}

function initReviewBar() {
  document.getElementById('el-prev')?.addEventListener('click', () => reviewStep(-1));
  document.getElementById('el-next')?.addEventListener('click', () => reviewStep(1));
  document.getElementById('el-toQueue')?.addEventListener('click', () => {
    const lead = findLeadForPopup(state.selectedId);
    reviewJudge((lead && lead.stage) === 'queued' ? 'unqueue' : 'queue');
  });
  document.getElementById('el-toFailed')?.addEventListener('click', () => {
    const lead = findLeadForPopup(state.selectedId);
    if (!confirm(`"${(lead && lead.Company) || ''}" 을(를) 검증 실패로 옮깁니다.\n\n이 회사에는 메일을 보내지 않습니다. 진행할까요?`)) return;
    reviewJudge('failed');
  });

  // 화살표 키로도 넘긴다 — 마우스를 옮기지 않고 훑을 수 있게.
  // 입력칸에 있을 때는 커서 이동이 우선이라 가로채지 않는다.
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('editLeadModal');
    if (!modal || modal.style.display === 'none') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); reviewStep(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); reviewStep(1); }
  });
}

function openEditModal(id) {
  // 보관함·기존 데이터에서 연 리드는 baseLeads 에 없다 (곁방 캐시에서 찾는다)
  const lead = findLeadForPopup(id);
  if (!lead) return;
  state.selectedId = id;
  render(); // Update row selection state

  const modal = document.getElementById('editLeadModal');
  if (!modal) return;

  // 목록 API 는 5천 건을 한 번에 내리느라 프로젝션으로 칸을 줄인다.
  // 업종·근거·출처·브랜드는 거기 안 들어 있어서, 캐시만 읽으면 DB 에 값이
  // 있는데도 빈칸으로 보인다 (실제로 그렇게 보이던 버그가 있었다).
  // 모달을 띄운 뒤 이 리드만 따로 받아 빈칸을 채운다.
  if (lead._id) {
    safeJsonFetch(`/api/leads/${lead._id}`)
      .then((r) => {
        if (!r?.lead) return;
        // 열려 있는 리드가 그새 바뀌었으면 덮지 않는다
        if (state.selectedId !== id) return;
        Object.assign(lead, r.lead);       // 캐시도 채워둔다 (두 번째 열 때는 즉시 표시)
        fillEditModalFields(lead);
        refreshReviewBar(lead);            // stage 가 캐시와 다를 수 있다
      })
      .catch((e) => console.warn('lead-detail', e));
  }

  // 검토 순서는 화면 전체 기준으로 잡는다 (한 페이지 50곳이 아니라 418곳 전부).
  // 먼저 보이는 행으로 즉시 그려 두고, 전체 목록은 받아온 뒤 다시 그린다.
  if (!_reviewList.includes(id)) setReviewList(collectVisibleLeadIds());
  refreshReviewBar(lead);
  loadReviewList().then(() => {
    if (state.selectedId === id) refreshReviewBar(findLeadForPopup(id) || lead);
  });

  document.getElementById('el-title').textContent = lead.Company;
  document.getElementById('el-badge').textContent = lead.Priority || "No priority";
  document.getElementById('el-badge').className = "badge " + badgeClass(lead.Priority);
  document.getElementById('el-meta').textContent = (lead.Country || "") + " · " + (lead.Type || "Lead");
  
  fillEditModalFields(lead);

  const webBtn = document.getElementById('el-website');
  if (webBtn) {
    webBtn.style.display = lead.WebsiteContact ? 'inline-block' : 'none';
    webBtn.href = lead.WebsiteContact ? urlFor(lead.WebsiteContact) : '#';
  }
  
  const inBtn = document.getElementById('el-linkedin');
  if (inBtn) {
    inBtn.style.display = lead.LinkedInCompany ? 'inline-block' : 'none';
    inBtn.href = lead.LinkedInCompany ? urlFor(lead.LinkedInCompany) : '#';
  }
  
  const emailBtn = document.getElementById('el-email-btn');
  if (emailBtn) {
    emailBtn.style.display = lead.Email ? 'inline-block' : 'none';
    emailBtn.href = lead.Email ? 'mailto:' + lead.Email : '#';
  }

  const phoneBtn = document.getElementById('el-phone-btn');
  if (phoneBtn) {
    phoneBtn.style.display = lead.Phone ? 'inline-block' : 'none';
    phoneBtn.href = lead.Phone ? 'tel:' + lead.Phone.replace(/[^0-9+]/g, '') : '#';
  }

  // 검증 상세 패널 — 모달 안에 있으면 채워넣고, 없으면 무시
  const verifyPanel = document.getElementById('el-verification');
  if (verifyPanel) verifyPanel.innerHTML = verifyDetailsHtml(lead);

  modal.style.display = 'flex';
  delete modal.dataset.userTyped;   // 새로 여는 것이니 "쓰던 내용" 표시를 지운다
  lockBodyScroll();
}

function initSettingsModal() {
  const btn = document.getElementById('settingsBtn');
  const subIdSection = document.getElementById('subIdSection');
  if (!btn) return;

  fetch('/api/auth/me').then(res => res.json()).then(data => {
    if (data.authenticated) {
      currentUser = data.username;
      isMaster = data.isMaster;
      btn.style.display = 'inline-block'; // 로그인 성공시 버튼 노출
      
      if (isMaster && subIdSection) {
        subIdSection.style.display = 'block';
      }
    }
  }).catch(console.error);
}

async function loadSubIds() {
  const subIdTableBody = document.getElementById('subIdTableBody');
  if (!subIdTableBody) return;
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (data.success) {
      subIdTableBody.innerHTML = data.data.map(user => `
        <tr>
          <td><strong>${escapeHtml(user.username)}</strong>${user.username === currentUser ? ' <span class="badge" style="background:#dceee9;color:#0f5146">Me</span>' : ''}</td>
          <td style="text-align: center; color: var(--muted);">${new Date(user.createdAt).toISOString().slice(0, 10)}</td>
          <td style="text-align: center;">
            <button class="button ghost" data-delete-user="${escapeAttr(user.username)}" style="color: #9f3333; padding: 4px 8px; border-color: #9f3333;" ${user.username === currentUser ? 'disabled' : ''}>삭제</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.error('Failed to load sub users', e);
  }
}

async function deleteLead(id) {
  const lead = getLeads().find((item) => item.id === id);
  const ok = window.confirm("Delete " + (lead?.Company || "this lead") + " from the CRM view?");
  if (!ok) return;

  lead.deleted = true;
  state.selectedId = getLeads()[0]?.id || null;
  renderFilters();
  render();

  if(lead._id) {
    await fetch('/api/leads/' + lead._id, { method: 'DELETE' });
  }
}

// 검증 실패 (archived + not-buyer) 리드 전부 삭제
async function deleteAllFailedLeads() {
  const btn = document.getElementById('deleteAllFailedHeroBtn');
  const restore = (label) => {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  };
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 세는 중...'; }

  // 건수는 반드시 서버에서 센다.
  // 예전에는 브라우저 캐시로 세서, 화면에 안 올라온 건이 숫자에서 빠졌다.
  // "3건 삭제" 로 보고 눌렀는데 실제로는 수백 건이 지워질 수 있었다.
  let count = 0;
  try {
    const r = await safeJsonFetch('/api/leads/purge-failed');
    if (!r?.success) throw new Error(r?.error || '조회 실패');
    count = r.count || 0;
  } catch (e) {
    alert('건수 확인 실패: ' + (e.message || 'unknown'));
    restore('🗑 전부 정리');
    return;
  }

  if (!count) {
    alert('정리할 검증 실패 리드가 없습니다.');
    restore('🗑 전부 정리');
    return;
  }

  // 되돌릴 수 있게 바뀌었지만 수백 건이 한 번에 움직이므로 숫자를 직접 입력받는다.
  // 확인창 한 번은 습관적으로 눌러 넘긴다.
  const typed = prompt(
    `검증 실패 ${count.toLocaleString()}건을 목록에서 치웁니다.\n\n` +
    `· 화면 어디에도 보이지 않게 됩니다\n` +
    `· 완전히 지우는 것은 아니라 나중에 되살릴 수 있습니다\n\n` +
    `진행하려면 아래에 ${count} 를 그대로 입력하세요.`,
  );
  if (typed === null) { restore('🗑 전부 정리'); return; }
  if (String(typed).trim() !== String(count)) {
    alert('입력한 숫자가 달라 취소했습니다.');
    restore('🗑 전부 정리');
    return;
  }

  if (btn) btn.textContent = '⏳ 정리 중...';
  try {
    const r = await safeJsonFetch('/api/leads/purge-failed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmCount: count }),
    });
    if (!r?.success) throw new Error(r?.error || '정리 실패');
    alert(
      `✅ ${r.deleted.toLocaleString()}건을 정리했습니다.\n\n` +
      `완전히 지운 것은 아니라 필요하면 되살릴 수 있습니다.`,
    );
    invalidateServerPage();
    loadStageCounts(true);
    await loadLeads({ force: true });
    state.selectedLeadIds.clear();
    renderFilters();
    render();
  } catch (e) {
    alert('정리 실패: ' + (e.message || 'unknown'));
    restore('🗑 전부 정리');
  }
}

/**
 * 직접 검토 시작 — 첫 업체를 팝업으로 열고 거기서 끝까지 넘긴다.
 *
 * 예전 [빠른 검토] 는 분류 탭(리테일 체인·유통사·브랜드…)으로 나눠 보여주는
 * 별도 화면이었다. 이미 AI 가 400여 곳을 걸러낸 뒤라 분류를 또 고르는 건
 * 단계만 하나 늘리는 일이고, 대기열 기준이 readyForOutreach 여서 418곳 중
 * 9곳만 나오고 있었다. 여기서는 목록 순서 그대로 첫 곳을 열어 준다.
 */
/**
 * 직접 검토 시작 — 한 회사씩 카드로 보는 화면으로 간다.
 *
 * 처음에는 상세 팝업을 띄우고 [이전/다음]으로 넘기게 했는데,
 * 팝업은 편집용이라 입력칸이 가득해 "판단만 하는" 화면으로는 무거웠다.
 * 카드 화면은 볼 것만 크게 놓고 버튼 두 개만 둔다.
 *
 * 표에서 회사를 눌러 여는 상세 팝업의 [이전/다음]은 그대로 둔다 —
 * 한 곳만 확인하러 들어간 경우에는 그쪽이 맞다.
 */
function startDirectReview(source) {
  _review.queue = [];      // 화면의 검색·국가 조건으로 새로 받는다
  _review.idx = 0;
  _review.skip = 0;        // 처음부터 — 지난번에 건너뛴 위치를 물고 들어오지 않게
  _review.decided = new Map();
  _review.source = source || '';   // '' = AI 검증 완료 · 'legacy' = 올린 데이터
  // 어디서 들어왔는지 기억한다. [← 돌아가기] 는 시작한 그 자리로 되돌려야지,
  // 정해진 한 화면으로 보내면 "내가 보던 데가 아닌데" 가 된다.
  _review.from = state.view;
  state.view = 'tool-review';
  render();
}

/**
 * 검토를 멈추고 들어왔던 화면으로.
 *
 * 판정은 누를 때마다 이미 서버에 저장돼 있어서, 나간다고 잃는 것이 없다.
 * 그래서 확인을 묻지 않는다 — 되돌릴 수 없는 일이 아니면 묻지 않는 편이 낫다.
 */
function exitDirectReview() {
  const back = _review.from
    || (_review.source === 'legacy' ? 'tool-legacy' : 'pipeline-verified');
  _review.from = '';
  const navBtn = document.querySelector(`.nav-item[data-view="${back}"]`);
  if (navBtn) { navBtn.click(); return; }   // 사이드바 표시도 같이 맞춘다
  state.view = back;
  render();
}

/**
 * 검증 완료에 남아 있는 곳을 전부 발송 리스트로.
 *
 * 흐름상 아닌 곳은 이미 [검증 실패]로 빼놓은 뒤라, 남은 것은 다 보낼 곳이다.
 * 그래도 수백 건이 한 번에 움직이므로 정확한 수를 세어 보여주고 확인을 받는다.
 * 화면에서 검색·국가로 좁혀 놨으면 그 범위만 옮긴다 — 12건을 보면서 눌렀는데
 * 418건이 옮겨지면 무엇이 옮겨졌는지 알 수 없다.
 */
async function moveAllToQueue() {
  const btn = document.getElementById('moveAllToQueueBtn');
  const q = (state.query || '').trim();
  const country = state.country && state.country !== 'All' ? state.country : '';

  if (btn) { btn.disabled = true; btn.textContent = '⏳ 세는 중...'; }
  let info;
  try {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (country) p.set('country', country);
    info = await safeJsonFetch(`/api/leads/queue?${p}`);
    if (!info?.success) throw new Error(info?.error || '조회 실패');
  } catch (e) {
    alert('건수 확인 실패: ' + (e.message || 'unknown'));
    if (btn) { btn.disabled = false; btn.textContent = '⇢ 남은 전체 옮기기'; }
    return;
  }

  if (!info.movable) {
    alert('옮길 수 있는 곳이 없습니다.\n(메일 주소가 있는 곳만 옮겨집니다)');
    if (btn) { btn.disabled = false; btn.textContent = '⇢ 남은 전체 옮기기'; }
    return;
  }

  const scope = q || country
    ? `지금 화면 조건(${[q && `검색 "${q}"`, country && country].filter(Boolean).join(' · ')})에 맞는 `
    : '검증 완료에 남아 있는 ';
  const ok = confirm(
    `${scope}${info.movable.toLocaleString()}곳을 발송 리스트로 옮깁니다.\n\n` +
    (info.noEmail ? `메일 주소가 없는 ${info.noEmail.toLocaleString()}곳은 제외됩니다.\n` : '') +
    `\n옮긴 곳은 [발송 관리 → 보낼 메일]에서 보내거나 예약할 수 있습니다.\n` +
    `메일이 지금 나가지는 않습니다.\n\n진행할까요?`,
  );
  if (!ok) { if (btn) { btn.disabled = false; btn.textContent = '⇢ 남은 전체 옮기기'; } return; }

  if (btn) btn.textContent = '⏳ 옮기는 중...';
  try {
    const r = await safeJsonFetch('/api/leads/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, q: q || undefined, country: country || undefined }),
    });
    if (!r?.success) throw new Error(r?.error || '이동 실패');
    state.selectedLeadIds = new Set();
    invalidateServerPage();
    loadStageCounts(true);
    await loadLeads({ force: true });
    alert(
      `📋 ${r.moved.toLocaleString()}곳을 발송 리스트로 옮겼습니다.\n\n` +
      `발송 리스트 총 ${r.queuedTotal.toLocaleString()}곳\n` +
      `검증 완료에 남은 곳 ${r.verifiedTotal.toLocaleString()}곳`,
    );
    render();
  } catch (e) {
    alert('이동 실패: ' + (e.message || 'unknown'));
    if (btn) { btn.disabled = false; btn.textContent = '⇢ 남은 전체 옮기기'; }
  }
}

/**
 * 고른 곳을 발송 리스트(queued)로 옮긴다 — 검증 완료 화면의 주된 행동.
 *
 * 여기서 옮긴 것만 [발송 관리 → 보낼 메일]에 뜬다. 검증만 끝난 것을 전부
 * 발송 대상으로 잡으면 "이제 보내도 된다"고 정하는 단계가 사라진다.
 */
async function moveSelectedToQueue() {
  const ids = [...state.selectedLeadIds];
  if (!ids.length) return;

  // 메일 없는 곳은 옮겨도 못 보낸다 — 미리 알려주고 숫자에서 뺀다
  const picked = ids.map((id) => baseLeads.find((l) => l.id === id)).filter(Boolean);
  const noEmail = picked.filter((l) =>
    !l.Email || /^Not found/i.test(l.Email) || !/@/.test(l.Email)).length;
  const sendable = picked.length - noEmail;
  if (!sendable) {
    alert('고른 곳에 보낼 수 있는 메일 주소가 없습니다.');
    return;
  }
  if (!confirm(
    `${sendable}곳을 발송 리스트로 옮깁니다.\n` +
    (noEmail ? `(메일 주소가 없는 ${noEmail}곳은 제외됩니다)\n` : '') +
    `\n옮긴 곳은 [발송 관리 → 보낼 메일]에서 보내거나 예약할 수 있습니다.\n진행할까요?`,
  )) return;

  const btn = document.getElementById('moveToQueueBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 옮기는 중...'; }
  try {
    const r = await safeJsonFetch('/api/leads/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds: ids }),
    });
    if (!r?.success) throw new Error(r?.error || '이동 실패');
    state.selectedLeadIds = new Set();
    invalidateServerPage();
    await loadLeads({ force: true });
    alert(
      `📋 ${r.moved}곳을 발송 리스트로 옮겼습니다.` +
      (r.skipped ? `\n(${r.skipped}곳은 제외 — 메일 없음 또는 이미 옮겨진 곳)` : '') +
      `\n\n발송 리스트 총 ${r.queuedTotal}곳`,
    );
    render();
  } catch (e) {
    alert('이동 실패: ' + (e.message || 'unknown'));
    if (btn) { btn.disabled = false; btn.textContent = '📋 발송 리스트로 옮기기'; }
  }
}

async function deleteSelectedLeads() {
  const ids = [...state.selectedLeadIds];
  if (!ids.length) return;
  const ok = window.confirm("Delete " + ids.length + " selected leads from the CRM view?");
  if (!ok) return;

  for(const id of ids) {
    const lead = getLeads().find(l => l.id === id);
    if(lead) {
      lead.deleted = true;
      if(lead._id) fetch('/api/leads/' + lead._id, { method: 'DELETE' });
    }
  }
  state.selectedLeadIds.clear();
  state.selectedId = getLeads()[0]?.id || null;
  renderFilters();
  render();
}

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (raw.edits || raw.customLeads) return raw;
    return { edits: raw, customLeads: [] };
  } catch {
    return { edits: {}, customLeads: [] };
  }
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ edits, customLeads }));
}

function resetEdits() {
  const ok = window.confirm("All local CRM edits will be cleared. Continue?");
  if (!ok) return;
  edits = {};
  customLeads = [];
  localStorage.removeItem(STORAGE_KEY);
  renderFilters();
  render();
}

/**
 * 지금 보고 있는 화면을 그대로 엑셀로 내려받는다.
 *
 * 예전에는 getFilteredLeads() — 브라우저에 올라온 캐시 전체 — 를 내보냈다.
 * 검증 완료 418건을 보면서 눌렀는데 보관함·검증실패까지 섞인 수천 줄이
 * 나왔고, 칸도 화면과 달라 그대로 쓸 수 없었다.
 * 화면이 서버에서 단계별로 받아오므로, 내보내기도 같은 조건으로 서버에서 받는다.
 */
async function exportCsv() {
  const STAGE_OF_VIEW = {
    'pipeline-verified': 'verified',
    'pipeline-contacted': 'queued',      // 발송 관리는 보낼 메일이 기준
    'pipeline-replied': 'replied',
    'pipeline-negotiating': 'negotiating',
    'pipeline-partner': 'partner',
    'pipeline-failed': '__failed',
    'pipeline-archived': 'archived',
  };
  const stage = STAGE_OF_VIEW[state.view] || null;
  const q = (state.query || '').trim();
  const country = state.country && state.country !== 'All' ? state.country : '';

  let rows = [];
  try {
    const p = new URLSearchParams({ limit: '5000', full: '1' });
    if (stage) p.set('stage', stage);
    if (q) p.set('q', q);
    if (country) p.set('country', country);
    const r = await safeJsonFetch(`/api/leads?${p}`);
    if (!r?.success) throw new Error(r?.error || '조회 실패');
    rows = r.data || [];
  } catch (e) {
    alert('내보내기 실패: ' + (e.message || 'unknown'));
    return;
  }

  if (!rows.length) {
    alert('내보낼 것이 없습니다.');
    return;
  }

  // 화면에서 보는 순서·이름으로 칸을 고정한다.
  // 원본 필드를 통째로 쏟으면 내부용 칸(_id·__v·verification 뭉치)까지 나와
  // 엑셀에서 읽기 어렵다. 영문 헤더는 그대로 둔다 — 거래처에 그대로 보내는 파일이다.
  const COLS = [
    ['Company', (l) => l.Company],
    ['Country', (l) => l.Country],
    ['Type', (l) => l.Type],
    ['업종(한국어)', (l) => l.TypeKo],
    ['Email', (l) => l.Email],
    ['Phone', (l) => l.Phone],
    ['Website', (l) => l.WebsiteContact],
    ['Contact', (l) => l.BuyerContact],
    ['Title', (l) => l.Title],
    ['Evidence', (l) => l.Evidence],
    ['근거(한국어)', (l) => l.EvidenceKo],
    ['단계', (l) => (STAGE_STYLE[l.stage] || {}).label || l.stage || ''],
    ['발송횟수', (l) => (l.emailHistory || []).filter((h) => h && h.status === 'sent').length],
    ['마지막발송', (l) => (l.lastEmailSentAt || '').slice(0, 10)],
    ['답장수', (l) => l.inboundCount || 0],
    ['추천점수', (l) => l.recoScore ?? ''],
    ['exportedAt', () => new Date().toISOString()],
  ];

  const csv = [
    COLS.map((c) => csvCell(c[0])).join(','),
    ...rows.map((l) => COLS.map((c) => csvCell(c[1](l))).join(',')),
  ].join('\n');

  // 엑셀이 UTF-8 을 알아보게 BOM 을 붙인다. 없으면 한글이 깨져서 열린다.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const label = (STAGE_STYLE[stage] || {}).label || (stage || '전체');
  const clean = String(label).replace(/[^가-힣A-Za-z0-9]/g, '') || 'leads';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `yogico-${clean}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);

  alert(`✅ ${rows.length.toLocaleString()}건을 내려받았습니다.\n\n${label}${q ? ` · 검색 "${q}"` : ''}${country ? ` · ${country}` : ''}`);
}

// ── CSV Import Modal ────────────────────────────────────────────────────────

let importParsedLeads = [];

function openImportCsvModal() {
  const modal = document.getElementById('importCsvModal');
  if (!modal) return;
  resetImportModal();
  modal.style.display = 'flex';
  delete modal.dataset.userTyped;   // 새로 여는 것이니 "쓰던 내용" 표시를 지운다
  lockBodyScroll();
  // 예제 양식 다운로드 버튼 바인딩 (매번 재바인딩 — 안전)
  const dlBtn = document.getElementById('downloadSampleCsvBtn');
  if (dlBtn) {
    dlBtn.onclick = downloadSampleCsv;
  }
}

// ── 예제 CSV 양식 다운로드 ─────────────────────────────
// 헤더 정의 순서 = 사용자가 참고할 순서
const SAMPLE_CSV_HEADERS = [
  'Company', 'Country', 'Priority', 'Type',
  'BuyerContact', 'Title', 'Email', 'Phone',
  'WebsiteContact', 'LinkedInCompany', 'BrandsChannels', 'Notes', 'Status',
];
const SAMPLE_CSV_ROWS = [
  // 실제 K-beauty B2B 리드 예시 (실존 회사 X)
  ['Acme Beauty Distributors', 'United States', 'A-', 'Distributor',
   'John Smith', 'Head of Buying', 'partnerships@acmebeauty.com', '+1-555-0100',
   'https://acmebeauty.com', 'https://linkedin.com/company/acme-beauty',
   'Sephora, Ulta, Amazon US', '전화 응대 우수. K-beauty 카테고리 신규 진입 관심.', 'New'],
  ['Kruidvat NL', 'Netherlands', 'B', 'Retailer',
   'Anna van der Berg', 'Category Manager', 'buying@kruidvat.nl', '+31-20-5551234',
   'https://www.kruidvat.nl', '',
   'Beauty of Joseon, COSRX (기존 취급)', '유럽 진출 협의 중. 3월에 카탈로그 발송 예정.', 'Qualified'],
  ['Watsons China', 'China', 'A-', 'Retailer',
   'Benjamin Cheung', 'Senior Trading Manager', 'bd_cn@watsons.com.cn', '+86-21-5555-0100',
   'https://www.watsons.com.cn', 'https://linkedin.com/in/benjamin-cheung',
   'Multiple K-beauty brands', '중국 오프라인 3000+ 매장. 대형 리테일러.', 'Contacted'],
];

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadSampleCsv() {
  const lines = [
    SAMPLE_CSV_HEADERS.map(csvEscape).join(','),
    ...SAMPLE_CSV_ROWS.map(row => row.map(csvEscape).join(',')),
  ];
  // Excel 한글 UTF-8 인식용 BOM
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'yogico-crm-예제양식.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resetImportModal() {
  importParsedLeads = [];
  const step1 = document.getElementById('importStep1');
  const step2 = document.getElementById('importStep2');
  const progress = document.getElementById('importProgress');
  const result = document.getElementById('importResult');
  const submitBtn = document.getElementById('importSubmitBtn');
  const fileInput = document.getElementById('importFileInput');
  if (step1) step1.style.display = '';
  if (step2) step2.style.display = 'none'; syncBodyScrollLock();
  if (progress) progress.style.display = 'none'; syncBodyScrollLock();
  if (result) result.style.display = 'none'; syncBodyScrollLock();
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '가져오기'; }
  if (fileInput) fileInput.value = '';
  // Reset radio
  const radios = document.querySelectorAll('input[name="duplicateAction"]');
  radios.forEach(r => { if (r.value === 'skip') r.checked = true; });
}

function initImportCsvModal() {}

function handleCsvFile(file) {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
  const isXlsx = /\.xlsx?$/i.test(file.name);
  if (!isCsv && !isXlsx) {
    alert(
      '❌ 지원되지 않는 파일 형식\n\n' +
      '· CSV (.csv) 파일만 지원합니다.\n' +
      '· Excel (.xlsx) → "다른 이름으로 저장 → CSV UTF-8" 로 변환 후 업로드하세요.\n\n' +
      '💡 "⬇ 예제 양식 다운로드" 버튼으로 형식 확인 가능.'
    );
    return;
  }
  if (isXlsx) {
    alert(
      '❌ Excel 파일 (.xlsx) 은 직접 업로드 불가\n\n' +
      '변환 방법:\n' +
      '1. Excel 에서 파일 열기\n' +
      '2. 파일 → 다른 이름으로 저장\n' +
      '3. 파일 형식: "CSV UTF-8 (쉼표로 분리) (*.csv)" 선택\n' +
      '4. 저장 후 그 CSV 파일 업로드\n\n' +
      '💡 "⬇ 예제 양식 다운로드" 버튼으로 예시 확인 가능.'
    );
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('❌ 파일 크기가 5MB를 초과합니다.\n\n큰 파일은 나눠서 여러 번 업로드하세요.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    // 헤더 검증 먼저 — 오류 시 명확한 안내
    const validation = validateCsvHeaders(text);
    if (!validation.ok) {
      alert(validation.message);
      return;
    }
    const leads = parseCsv(text);
    if (!leads.length) {
      alert(
        '❌ 파싱된 리드가 0건\n\n' +
        '가능한 원인:\n' +
        '· 헤더만 있고 데이터 행이 없음\n' +
        '· 모든 행에서 Company 값이 비어있음\n\n' +
        '💡 "⬇ 예제 양식 다운로드" 버튼으로 올바른 형식 확인.'
      );
      return;
    }
    importParsedLeads = leads;
    showImportPreview(leads);
  };
  reader.readAsText(file, 'UTF-8');
}

// ── CSV 헤더 검증 ─────────────────────────────────
// 필수 컬럼(Company, Country) 있는지 확인 · 인식 안 된 컬럼 리스트 반환
function validateCsvHeaders(csvText) {
  const firstLine = (csvText.split(/\r?\n/)[0] || '').trim();
  if (!firstLine) {
    return {
      ok: false,
      message: '❌ 빈 파일이거나 헤더 라인이 없습니다.\n\n"⬇ 예제 양식 다운로드"로 예시 참고하세요.',
    };
  }
  const headers = splitCsvLine(firstLine).map(h => h.trim());
  if (headers.length < 2) {
    return {
      ok: false,
      message: '❌ 헤더 컬럼이 부족합니다 (' + headers.length + '개).\n\n' +
        'CSV 첫 줄은 쉼표로 구분된 컬럼명이어야 합니다. 예:\n' +
        'Company,Country,Priority,Email,Phone,...\n\n' +
        '"⬇ 예제 양식 다운로드"로 예시 참고하세요.',
    };
  }

  // 필수 컬럼 검사 (case-insensitive)
  const lowerHeaders = headers.map(h => h.toLowerCase().replace(/\s+/g, ''));
  const hasCompany = lowerHeaders.some(h => h === 'company' || h === '회사명' || h === '업체명');
  const hasCountry = lowerHeaders.some(h => h === 'country' || h === '국가');
  const missing = [];
  if (!hasCompany) missing.push('Company (회사명)');
  if (!hasCountry) missing.push('Country (국가)');

  if (missing.length > 0) {
    return {
      ok: false,
      message: '❌ 필수 컬럼 누락\n\n' +
        '없는 컬럼:\n' +
        missing.map(m => '  · ' + m).join('\n') + '\n\n' +
        '파일에 있는 컬럼:\n  ' +
        headers.slice(0, 20).join(', ') +
        (headers.length > 20 ? ` ... (${headers.length}개)` : '') + '\n\n' +
        '💡 "⬇ 예제 양식 다운로드" 버튼으로 올바른 양식 참고하세요.',
    };
  }

  // 인식 안 된 컬럼 — 경고만 (실패 X)
  const knownAliases = new Set([
    'company', 'country', 'priority', 'type',
    'buyercontact', 'buyer contact', 'buyer name', 'contact',
    'email', 'phone', 'website', 'websitecontact',
    'brandschannels', 'brands/channels', 'brands',
    'notes', 'note', 'status', 'title',
    'evidence', 'approach', 'sources',
    'linkedincompany', 'linkedin',
    'owner', 'lastcontact', 'last contact',
    'nextfollowup', 'next follow-up', 'follow-up', 'followup',
    'id', 'leadid',
  ]);
  const unknown = headers.filter(h => !knownAliases.has(h.toLowerCase().trim()));
  if (unknown.length > 0 && unknown.length <= 3) {
    console.warn('[CSV import] 인식 안 된 컬럼 (원본 이름 그대로 저장됨):', unknown);
  }

  return { ok: true };
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  const leads = [];

  const FIELD_MAP = {
    company: 'Company',
    country: 'Country',
    priority: 'Priority',
    type: 'Type',
    buyercontact: 'BuyerContact',
    'buyer contact': 'BuyerContact',
    'buyer name': 'BuyerContact',
    contact: 'BuyerContact',
    email: 'Email',
    phone: 'Phone',
    website: 'WebsiteContact',
    websitecontact: 'WebsiteContact',
    brandschannels: 'BrandsChannels',
    'brands/channels': 'BrandsChannels',
    brands: 'BrandsChannels',
    notes: 'notes',
    note: 'notes',
    status: 'status',
    title: 'Title',
    evidence: 'Evidence',
    approach: 'Approach',
    sources: 'Sources',
    linkedincompany: 'LinkedInCompany',
    linkedin: 'LinkedInCompany',
    owner: 'owner',
    lastcontact: 'lastContact',
    'last contact': 'lastContact',
    nextfollowup: 'nextFollowUp',
    'next follow-up': 'nextFollowUp',
    'follow-up': 'nextFollowUp',
    followup: 'nextFollowUp',
  };

  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    if (!values.length) continue;

    const obj = {};
    normalizedHeaders.forEach((header, idx) => {
      const field = FIELD_MAP[header] || headers[idx]; // fallback to original header name
      obj[field] = (values[idx] || '').trim();
    });

    if (!obj.Company && !obj.company) continue; // must have company

    // Defaults
    if (!obj.status) obj.status = 'New';

    // Export/Import 왕복 시 원본 leadId 보존:
    //   CSV의 'id' 컬럼 = 원본 leadId → obj.leadId 로 승격.
    //   이렇게 하면 서버가 leadId 기반으로 정확히 dedup 가능해서,
    //   같은 Company+Country 여러 담당자 케이스가 손실되지 않음.
    if (!obj.leadId && obj.id) obj.leadId = obj.id;
    // leadId 완전히 없으면 클라이언트에서 임시 생성하지 않음 — 서버가 새 lead 로 판단하고 새 leadId 부여함
    if (!obj.id && obj.leadId) obj.id = obj.leadId;

    leads.push(obj);
  }
  return leads;
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function showImportPreview(leads) {
  const step1 = document.getElementById('importStep1');
  const step2 = document.getElementById('importStep2');
  const submitBtn = document.getElementById('importSubmitBtn');

  if (step1) step1.style.display = 'none'; syncBodyScrollLock();
  if (step2) step2.style.display = '';
  if (submitBtn) submitBtn.disabled = false;

  _renderPreviewContents(leads);

  // Re-render summary instantly when radio changes
  document.querySelectorAll('input[name="duplicateAction"]').forEach(radio => {
    radio.addEventListener('change', () => _renderPreviewContents(importParsedLeads));
  });
}

function _isDuplicate(lead) {
  const co = (lead.Company || '').trim().toLowerCase();
  const ct = (lead.Country || '').trim().toLowerCase();
  return baseLeads.some(b =>
    (b.Company || '').trim().toLowerCase() === co &&
    (b.Country || '').trim().toLowerCase() === ct
  );
}

function _renderPreviewContents(leads, activeTab) {
  // ── 1. Classify ──────────────────────────────────────────────────
  const dupes = leads.filter(l => _isDuplicate(l));
  const newLeads = leads.filter(l => !_isDuplicate(l));
  const dupAction = document.querySelector('input[name="duplicateAction"]:checked')?.value || 'skip';

  // ── 2. Summary badges ─────────────────────────────────────────────
  const previewInfo = document.getElementById('importPreviewInfo');
  if (previewInfo) {
    const dupeLabel = dupAction === 'overwrite'
      ? `<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:12px;font-size:13px;font-weight:600">⚠️ 중복 ${dupes.length}건 → 덮어쓰기</span>`
      : `<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:12px;font-size:13px;font-weight:600">⚠️ 중복 ${dupes.length}건 → 건너뜀</span>`;

    previewInfo.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <span style="font-size:15px;font-weight:700">총 ${leads.length}개</span>
        <span style="background:#d4edda;color:#155724;padding:2px 8px;border-radius:12px;font-size:13px;font-weight:600">✅ 신규 ${newLeads.length}건</span>
        ${dupes.length ? dupeLabel : ''}
      </div>
      <div style="display:flex;gap:6px;margin-bottom:12px;" id="importTabBtns">
        <button class="button ${!activeTab || activeTab === 'all' ? '' : 'ghost'}" data-preview-tab="all" type="button" style="font-size:12px;padding:3px 10px">전체 ${leads.length}</button>
        <button class="button ${activeTab === 'new' ? '' : 'ghost'}" data-preview-tab="new" type="button" style="font-size:12px;padding:3px 10px">신규 ${newLeads.length}</button>
        <button class="button ${activeTab === 'dup' ? '' : 'ghost'}" data-preview-tab="dup" type="button" style="font-size:12px;padding:3px 10px;${dupes.length ? '' : 'opacity:.45;pointer-events:none'}">중복 ${dupes.length}</button>
      </div>
    `;

    document.querySelectorAll('[data-preview-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        _renderPreviewContents(leads, btn.dataset.previewTab);
      });
    });
  }

  // ── 3. Determine rows to show ──────────────────────────────────────
  const tab = activeTab || 'all';
  const displayLeads = tab === 'new' ? newLeads : tab === 'dup' ? dupes : leads;

  // ── 4. Table ───────────────────────────────────────────────────────
  const PREVIEW_COLS = ['Company', 'Country', 'Priority', 'Type', 'Email', 'Phone', 'status'];
  const previewHead = document.getElementById('importPreviewHead');
  const previewBody = document.getElementById('importPreviewBody');

  if (previewHead) {
    previewHead.innerHTML = `
      <tr>
        <th style="width:28px"></th>
        ${PREVIEW_COLS.map(c => `<th>${escapeHtml(c)}</th>`).join('')}
      </tr>`;
  }

  if (previewBody) {
    previewBody.innerHTML = displayLeads.slice(0, 15).map(lead => {
      const isDup = _isDuplicate(lead);
      const rowStyle = isDup ? 'background:#fffbeb;' : '';
      const badge = isDup
        ? `<span title="${dupAction === 'overwrite' ? '덮어쓰기' : '건너뜀'}" style="font-size:11px;background:#ffc107;color:#333;border-radius:8px;padding:1px 5px">${dupAction === 'overwrite' ? '↺' : '↷'}</span>`
        : `<span style="font-size:11px;background:#198754;color:#fff;border-radius:8px;padding:1px 5px">NEW</span>`;
      return `
        <tr style="${rowStyle}">
          <td style="text-align:center">${badge}</td>
          ${PREVIEW_COLS.map(c => `<td>${escapeHtml(lead[c] || '')}</td>`).join('')}
        </tr>`;
    }).join('');

    if (displayLeads.length > 15) {
      previewBody.innerHTML += `
        <tr>
          <td colspan="${PREVIEW_COLS.length + 1}" style="text-align:center;color:var(--muted);font-size:13px;padding:10px">
            … 외 ${displayLeads.length - 15}건 더 있음
          </td>
        </tr>`;
    }

    if (!displayLeads.length) {
      previewBody.innerHTML = `
        <tr>
          <td colspan="${PREVIEW_COLS.length + 1}" style="text-align:center;color:var(--muted);padding:20px">
            해당 항목이 없습니다.
          </td>
        </tr>`;
    }
  }
}


// ── Verification flow ─────────────────────────────────────────────
async function openVerifyModal() {
  const modal = document.getElementById('verifyModal');
  if (!modal) return;

  // 기존 진행/결과 초기화
  const progress = document.getElementById('verifyProgress');
  const result = document.getElementById('verifyResult');
  const startBtn = document.getElementById('verifyStartBtn');
  if (progress) progress.style.display = 'none'; syncBodyScrollLock();
  if (result) result.style.display = 'none'; syncBodyScrollLock();
  if (startBtn) { startBtn.disabled = false; startBtn.textContent = '검증 시작'; }

  // 카운트 표시
  const total = baseLeads.length;
  const done = baseLeads.filter(l => l.verification && l.verification.verifiedAt).length;
  const pending = total - done;
  const totalEl = document.getElementById('verifyTotalCount');
  const pendingEl = document.getElementById('verifyPendingCount');
  const doneEl = document.getElementById('verifyDoneCount');
  if (totalEl) totalEl.textContent = total + '개';
  if (pendingEl) pendingEl.textContent = pending + '개';
  if (doneEl) doneEl.textContent = done + '개';

  // AI 정밀 검증 — 의심 케이스 카운트 + 비용 예상
  const aiTarget = baseLeads.filter(l => {
    const v = l.verification;
    if (!v || !v.verifiedAt) return false;          // 룰 기반 검증 끝난 것만
    if (v.aiVerifiedAt) return false;                 // 아직 AI 검증 안 된 것만
    const s = typeof v.score === 'number' ? v.score : 0;
    return s >= 3 && s <= 4;                          // 의심 (3~4점)
  }).length;
  const aiTargetEl = document.getElementById('verifyAITargetCount');
  const aiCostEl = document.getElementById('verifyAICostEstimate');
  if (aiTargetEl) aiTargetEl.textContent = aiTarget;
  if (aiCostEl) {
    const cost = (aiTarget * 0.0005).toFixed(3);
    aiCostEl.textContent = aiTarget > 0 ? `약 $${cost}` : '0건이라 호출 안 함';
  }
  const aiStartBtn = document.getElementById('verifyAIStartBtn');
  const aiProgress = document.getElementById('verifyAIProgress');
  const aiResult = document.getElementById('verifyAIResult');
  if (aiProgress) aiProgress.style.display = 'none'; syncBodyScrollLock();
  if (aiResult) aiResult.style.display = 'none'; syncBodyScrollLock();
  if (aiStartBtn) {
    aiStartBtn.disabled = aiTarget === 0;
    aiStartBtn.textContent = aiTarget === 0
      ? '🧠 AI 검증 — 대상 없음'
      : `🧠 AI 정밀 검증 시작 (${aiTarget}건)`;
    aiStartBtn.style.opacity = aiTarget === 0 ? '0.5' : '1';
  }

  modal.style.display = 'flex';
  delete modal.dataset.userTyped;   // 새로 여는 것이니 "쓰던 내용" 표시를 지운다
  lockBodyScroll();
}

// AI 정밀 검증 — 의심 케이스만 Claude API 로 청크 호출
async function startAIVerification() {
  const startBtn = document.getElementById('verifyAIStartBtn');
  const progress = document.getElementById('verifyAIProgress');
  const progressBar = document.getElementById('verifyAIProgressBar');
  const progressText = document.getElementById('verifyAIProgressText');
  const result = document.getElementById('verifyAIResult');

  const targetCountEl = document.getElementById('verifyAITargetCount');
  const targetCount = parseInt(targetCountEl?.textContent || '0', 10);
  if (targetCount === 0) return;

  const ok = confirm(
    `🧠 AI 정밀 검증 — Claude API 호출\n\n` +
    `대상: 의심 ${targetCount}건\n` +
    `예상 비용: 약 $${(targetCount * 0.0005).toFixed(3)} (Haiku 4.5)\n` +
    `예상 시간: 약 ${Math.ceil(targetCount / 20 * 8)}초\n\n` +
    `진행하시겠습니까?`,
  );
  if (!ok) return;

  if (progress) progress.style.display = '';
  if (result) result.style.display = 'none'; syncBodyScrollLock();
  if (startBtn) { startBtn.disabled = true; startBtn.textContent = '진행 중...'; }

  const CHUNK = 20;
  let processed = 0;
  const tallies = { 'beauty-buyer': 0, maybe: 0, 'not-buyer': 0, failed: 0 };

  try {
    while (true) {
      const res = await fetch('/api/leads/verify-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'suspicious', limit: CHUNK }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'AI 검증 실패');

      processed += data.processed;
      for (const r of (data.results || [])) {
        if (r.verdict === 'beauty-buyer') tallies['beauty-buyer']++;
        else if (r.verdict === 'maybe') tallies.maybe++;
        else if (r.verdict === 'not-buyer') tallies['not-buyer']++;
        else tallies.failed++;
      }

      const pct = Math.min(100, Math.round(processed / targetCount * 100));
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressText) progressText.textContent = `${processed}/${targetCount} 처리 중... (${pct}%)`;

      if (!data.hasMore || data.processed === 0) break;
    }

    if (progressBar) progressBar.style.width = '100%';
    if (progressText) progressText.textContent = `${processed}/${processed} 완료`;
    if (result) {
      result.style.display = '';
      result.innerHTML = `
        <strong style="color:#1e1b4b">🎉 AI 정밀 검증 완료</strong><br>
        ✅ 진성 바이어 ${tallies['beauty-buyer']}건  ·
        ⚠ 모호 ${tallies.maybe}건  ·
        ❌ 무관 ${tallies['not-buyer']}건
        ${tallies.failed > 0 ? `<br><span style="color:#dc2626">⚠ API 호출 실패 ${tallies.failed}건 — 환경변수/네트워크 확인</span>` : ''}
        <br><span style="color:#64748b;font-size:11px">대략 비용: $${(processed * 0.0005).toFixed(3)}</span>
      `;
    }
    if (startBtn) { startBtn.textContent = '✓ 완료'; }

    // 리드 새로고침
    try {
      const r = await fetch('/api/leads');
      const lr = await r.json();
      if (lr.success) {
        baseLeads = lr.data.map(lead => ({ ...lead, id: lead.leadId }));
        renderFilters();
        render();
      }
    } catch {}
  } catch (e) {
    if (result) {
      result.style.display = '';
      result.style.background = '#fee2e2';
      result.style.borderColor = '#fca5a5';
      result.innerHTML = `<strong style="color:#991b1b">오류:</strong> ${e?.message || '네트워크 오류'}`;
    }
    if (startBtn) { startBtn.disabled = false; startBtn.textContent = '다시 시도'; }
  }
}

async function startVerification(scope) {
  const progress = document.getElementById('verifyProgress');
  const progressBar = document.getElementById('verifyProgressBar');
  const progressText = document.getElementById('verifyProgressText');
  const result = document.getElementById('verifyResult');
  const resultText = document.getElementById('verifyResultText');
  const startBtn = document.getElementById('verifyStartBtn');

  if (progress) progress.style.display = '';
  if (result) result.style.display = 'none'; syncBodyScrollLock();
  if (startBtn) { startBtn.disabled = true; startBtn.textContent = '검증 중...'; }

  const onlyUnverified = scope !== 'all';
  const CHUNK = 30;

  // 시작 시점 카운트 — 진행률 계산용
  let totalToProcess = 0;
  let processed = 0;
  const tallies = { ok: 0, partial: 0, fail: 0, emailBad: 0, siteBad: 0, phoneBad: 0, liBad: 0 };

  try {
    while (true) {
      const res = await fetch('/api/leads/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyUnverified, limit: CHUNK }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '검증 실패');

      // 첫 응답에서 전체 작업량 계산
      if (totalToProcess === 0) {
        totalToProcess = data.processed + data.remaining;
      }
      processed += data.processed;

      // 결과 집계
      for (const r of (data.results || [])) {
        const score = r.score ?? 0;
        if (score === 4) tallies.ok++;
        else if (score >= 2) tallies.partial++;
        else tallies.fail++;
        if (r.emailValid === false) tallies.emailBad++;
        if (r.websiteAlive === false) tallies.siteBad++;
        if (r.phoneMatch === false) tallies.phoneBad++;
        if (r.linkedinValid === false) tallies.liBad++;
      }

      const pct = totalToProcess > 0 ? Math.min(100, Math.round(processed / totalToProcess * 100)) : 0;
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressText) progressText.textContent = `${processed}/${totalToProcess} 처리 중... (${pct}%)`;

      if (!data.hasMore) break;
    }

    // 완료 표시
    if (progressBar) progressBar.style.width = '100%';
    if (progressText) progressText.textContent = `${processed}/${processed} 완료`;
    if (result) result.style.display = '';
    if (resultText) {
      resultText.innerHTML = `
        <strong style="font-size:15px;color:#1b5e20">🎉 검증 완료</strong><br>
        ✅ 모두 통과 ${tallies.ok}건  ·  ⚠ 일부 의심 ${tallies.partial}건  ·  ❌ 다수 무효 ${tallies.fail}건<br>
        <span style="color:#6b7280;font-size:12px">
          이메일 실패 ${tallies.emailBad}  ·  사이트 실패 ${tallies.siteBad}  ·  전화 불일치 ${tallies.phoneBad}  ·  LinkedIn 실패 ${tallies.liBad}
        </span>
      `;
    }
    if (startBtn) { startBtn.textContent = '검증 완료 ✓'; }

    // 리드 새로고침 (verification 결과 반영)
    try {
      const leadsRes = await fetch('/api/leads');
      const leadsResult = await leadsRes.json();
      if (leadsResult.success) {
        baseLeads = leadsResult.data.map(lead => ({ ...lead, id: lead.leadId }));
        renderFilters();
        render();
      }
    } catch {}
  } catch (err) {
    if (result) { result.style.display = ''; result.style.background = '#fff0f0'; result.style.borderColor = '#f5b8b8'; }
    if (resultText) resultText.textContent = '오류: ' + (err?.message || '네트워크 오류');
    if (startBtn) { startBtn.disabled = false; startBtn.textContent = '다시 시도'; }
  }
}

async function doImport(leads, duplicateAction) {
  const progress = document.getElementById('importProgress');
  const progressBar = document.getElementById('importProgressBar');
  const progressText = document.getElementById('importProgressText');
  const result = document.getElementById('importResult');
  const resultText = document.getElementById('importResultText');
  const submitBtn = document.getElementById('importSubmitBtn');
  const step2 = document.getElementById('importStep2');

  if (progress) progress.style.display = '';
  if (step2) step2.style.display = 'none'; syncBodyScrollLock();
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '가져오는 중...'; }

  // 전역 progress bar + 풀스크린 블로커 — 모달 안의 진행바와 별개로 화면 상단에서도 진행 중 표시
  startTopProgress();
  showGlobalBlocker(`${leads.length}건 서버에 전송 중...`);

  // Animate progress bar
  let fakeProgress = 0;
  const progressInterval = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + 5, 85);
    if (progressBar) progressBar.style.width = fakeProgress + '%';
    if (progressText) progressText.textContent = `${Math.round(fakeProgress)}% 처리 중...`;
  }, 150);

  try {
    const res = await fetch('/api/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads, duplicateAction })
    });
    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      clearInterval(progressInterval);
      if (progressBar) progressBar.style.width = '100%';
      if (result) { result.style.display = ''; result.style.background = '#fff0f0'; result.style.borderColor = '#f5b8b8'; }
      const snippet = (rawText || '').slice(0, 200);
      if (resultText) resultText.textContent = `서버 응답 오류 (HTTP ${res.status}): ${snippet || '빈 응답'}`;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '다시 시도'; }
      console.error('Import response not JSON:', rawText);
      return;
    }

    clearInterval(progressInterval);
    if (progressBar) progressBar.style.width = '100%';
    if (progressText) progressText.textContent = '완료!';

    if (data.success) {
      const s = data.summary;
      if (result) {
        result.style.display = '';
        result.style.background = '#e8f5e9';
        result.style.borderColor = '#a5d6a7';
      }
      if (resultText) {
        const parts = [];
        if (s.inserted) parts.push(`✅ ${s.inserted}개 새로 추가`);
        if (s.updated) parts.push(`🔄 ${s.updated}개 업데이트`);
        if (s.skipped) parts.push(`⏭ ${s.skipped}개 건너뜀`);
        if (s.errors) parts.push(`❌ ${s.errors}개 오류`);
        const detail = parts.length ? '  ·  ' + parts.join('  |  ') : '';
        // Skip 사유 분해 표시 — 데이터 손실 오해 방지 (Export→Import 왕복 시 원본 leadId 중복은 정상 케이스)
        let skipBreakdown = '';
        if (s.skipped && data.skipReasons) {
          const parts2 = [];
          if (data.skipReasons['leadId-duplicate']) {
            parts2.push(`동일 leadId 재업로드 ${data.skipReasons['leadId-duplicate']}건 (Export→Import 정상 케이스)`);
          }
          if (data.skipReasons['company-country-duplicate']) {
            parts2.push(`Company+Country 중복 ${data.skipReasons['company-country-duplicate']}건`);
          }
          if (parts2.length) {
            skipBreakdown = `<div style="margin-top:6px;font-size:12px;color:#555;background:#fff7e6;padding:6px 10px;border-left:3px solid #f59e0b;border-radius:4px">
              ⏭ 건너뛴 사유: ${parts2.join(' · ')}
            </div>`;
          }
        }
        resultText.innerHTML = `<strong style="font-size:15px;color:#1b5e20">🎉 적용완료</strong>${detail}${skipBreakdown}`;
      }
      if (submitBtn) { submitBtn.textContent = '\uc801\uc6a9\uc644\ub8cc \u2713'; submitBtn.disabled = true; }

      // Show quick link to Import History
      if (result) {
        // 이전 import 결과에서 남은 history 링크 제거 (중복 표시 방지)
        result.querySelectorAll('[data-import-history-link]').forEach(el => el.remove());
        const historyLink = document.createElement('div');
        historyLink.dataset.importHistoryLink = 'true';
        historyLink.style.cssText = 'margin-top:10px;';
        historyLink.innerHTML = `
          <button class="button ghost" id="goToImportHistoryBtn" type="button"
            style="font-size:13px;padding:4px 12px">
            📋 Import History에서 확인 / 롤백하기
          </button>
        `;
        result.appendChild(historyLink);
        document.getElementById('goToImportHistoryBtn')?.addEventListener('click', () => {
          // Close modal and navigate to import history view
          document.getElementById('importCsvModal').style.display = 'none'; syncBodyScrollLock();
          resetImportModal();
          state.view = 'importHistory';
          render();
        });
      }

      // Reload leads from server
      try {
        const leadsRes = await fetch('/api/leads');
        const leadsResult = await leadsRes.json();
        if (leadsResult.success) {
          baseLeads = leadsResult.data.map(lead => ({ ...lead, id: lead.leadId }));
          renderFilters();
        }
      } catch(e) { console.error(e); }


    } else {
      if (result) { result.style.display = ''; result.style.background = '#fff0f0'; result.style.borderColor = '#f5b8b8'; }
      if (resultText) resultText.textContent = '오류: ' + (data.error || '가져오기 실패');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '다시 시도'; }
    }
  } catch (err) {
    clearInterval(progressInterval);
    if (result) { result.style.display = ''; result.style.background = '#fff0f0'; result.style.borderColor = '#f5b8b8'; }
    if (resultText) resultText.textContent = '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '다시 시도'; }
  } finally {
    // 성공/실패 어느 쪽이든 전역 로딩 인디케이터 정리
    hideGlobalBlocker();
    finishTopProgress();
  }
}

function makeId(lead, index) {
  const raw = `${lead.Country || ""}-${lead.Company || ""}-${index}`;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function inferInitialStatus(lead) {
  const memo = [lead.RoleMemo, lead.Sources, lead.ContactStatus].filter(Boolean).join(" ");
  if (/contacted|daily|sent|follow|reply|460\d{2}|45\d{3}/i.test(memo)) return "Contacted";
  return "New";
}

function leadSort(a, b) {
  const favoriteDiff = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
  if (favoriteDiff) return favoriteDiff;
  const contactedDiff = Number(b.status === "Contacted") - Number(a.status === "Contacted");
  if (contactedDiff) return contactedDiff;
  const dueDiff = Boolean(b.nextFollowUp) - Boolean(a.nextFollowUp);
  if (dueDiff) return dueDiff;
  if (a.nextFollowUp && b.nextFollowUp && a.nextFollowUp !== b.nextFollowUp) {
    return a.nextFollowUp.localeCompare(b.nextFollowUp);
  }
  const scoreDiff = buyerScore(b) - buyerScore(a);
  if (scoreDiff) return scoreDiff;
  return String(a.Company).localeCompare(String(b.Company), undefined, { sensitivity: "base" });
}

function hasEmail(lead) {
  return Boolean(lead.Email && !/not found|\\[email protected\\]/i.test(lead.Email));
}

function buyerScore(lead) {
  let score = 40;
  const text = [lead.Type, lead.Evidence, lead.BrandsChannels, lead.Confidence, lead.Priority].join(" ").toLowerCase();
  if (/distributor|importer|wholesale|b2b|official|authorized/.test(text)) score += 25;
  if (/k-beauty|korean|skincare|cosmetics/.test(text)) score += 15;
  if (hasEmail(lead)) score += 10;
  if (lead.BuyerContact || lead.ContactLinkedIn) score += 10;
  return Math.min(score, 100);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "Unknown";
    acc[value] = acc[value] || [];
    acc[value].push(item);
    return acc;
  }, {});
}

function continentFor(country) {
  const normalized = String(country || "").trim();
  const matchedCountry = Object.keys(COUNTRY_CONTINENTS).find((item) => item.toLowerCase() === normalized.toLowerCase());
  return COUNTRY_CONTINENTS[matchedCountry] || "Other";
}

function optionHtml(values, selected = "All") {
  return values.map((value) => `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function stat(label, value, view = "") {
  if (view) {
    return `
      <button class="stat stat-button" data-stat-view="${escapeAttr(view)}" type="button">
        <strong>${escapeHtml(String(value))}</strong>
        <span>${escapeHtml(label)}</span>
      </button>
    `;
  }
  return `<div class="stat"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

// 검증 버킷용 stat 카드 — 색상 강조 + 클릭 시 검증 필터 적용
function statVerify(label, value, bucket) {
  const colors = ({
    passed:     { bg: '#dcfce7', fg: '#166534', accent: '#22c55e' },
    suspicious: { bg: '#fef3c7', fg: '#92400e', accent: '#f59e0b' },
    invalid:    { bg: '#fee2e2', fg: '#991b1b', accent: '#ef4444' },
    unverified: { bg: '#f1f5f9', fg: '#64748b', accent: '#94a3b8' },
    archived:   { bg: '#f3f4f6', fg: '#6b7280', accent: '#9ca3af' },
    failed:     { bg: '#fee2e2', fg: '#991b1b', accent: '#ef4444' },
  }[bucket]) || { bg: '#f1f5f9', fg: '#64748b', accent: '#94a3b8' };
  const active = state.view === 'leads' && state.verify === bucket ? `box-shadow:0 0 0 2px ${colors.accent} inset;` : '';
  return `
    <button class="stat stat-button" data-verify-bucket="${escapeAttr(bucket)}" type="button"
      style="background:${colors.bg};color:${colors.fg};border-color:${colors.accent};${active}">
      <strong style="color:${colors.fg}">${escapeHtml(String(value))}</strong>
      <span style="color:${colors.fg};opacity:0.85">${escapeHtml(label)}</span>
    </button>
  `;
}

function emptyState(text) {
  return `<div class="empty-detail"><h3>No results</h3><p>${escapeHtml(text)}</p></div>`;
}

function infoBlock(title, body) {
  return `<div class="field-block"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(body)}</p></div>`;
}

function favoriteButton(lead, compact = false) {
  const active = Boolean(lead.favorite);
  const label = active ? "Favorited" : "Favorite";
  const icon = active ? "&#9733;" : "&#9734;";
  const text = compact ? "" : `<span>${label}</span>`;
  return `
    <button
      class="favorite-button ${active ? "active" : ""} ${compact ? "compact" : ""}"
      data-favorite="${escapeAttr(lead.id)}"
      type="button"
      aria-label="${label} major buyer"
      title="${label} major buyer"
    >
      <span aria-hidden="true">${icon}</span>
      ${text}
    </button>
  `;
}

function linkButton(url, label) {
  if (!url) return "";
  return `<a href="${escapeAttr(urlFor(url))}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function emailButton(email) {
  if (!email) return "";
  const first = email.split(/[;,\s]+/).find((part) => part.includes("@"));
  return first ? `<a href="mailto:${escapeAttr(first)}">Email</a>` : "";
}

function emailCell(email) {
  if (!email) return "";
  const text = truncate(email, 78);
  const first = email.split(/[;,\s]+/).find((part) => part.includes("@"));
  if (!first) return escapeHtml(text);
  return `<a href="mailto:${escapeAttr(first)}">${escapeHtml(text)}</a>`;
}

function phoneButton(phone) {
  if (!phone) return "";
  const first = phone.split(";")[0].trim();
  return first ? `<a href="${escapeAttr(first.startsWith("http") ? first : `tel:${first.replace(/\s/g, "")}`)}">Call</a>` : "";
}

function urlFor(value) {
  const first = String(value).split(";")[0].trim();
  if (!first) return "";
  if (/^https?:\/\//i.test(first)) return first;
  if (/^www\./i.test(first)) return `https://${first}`;
  return first;
}

// 웹사이트를 클릭 가능한 링크로 (short=true 면 도메인만 표기, full URL 은 title 로)
function websiteLinkHtml(website, opts) {
  const raw = (website || '').toString().trim();
  if (!raw) return '';
  const href = urlFor(raw);
  if (!href) return '';
  const short = opts && opts.short === true;
  let label = raw;
  if (short) {
    try {
      label = new URL(/^https?:\/\//i.test(href) ? href : `https://${href}`).hostname.replace(/^www\./, '');
    } catch (_) {
      label = raw.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    }
  }
  return `<a href="${escapeAttr(href)}" target="_blank" rel="noreferrer noopener" title="${escapeAttr(raw)}" style="color:#2563eb;text-decoration:underline">${escapeHtml(label)} ↗</a>`;
}

function badgeClass(value = "") {
  const normalized = value.toLowerCase();
  if (normalized === "a" || normalized.includes("high")) return "a";
  if (normalized.includes("yogico")) return "yogico";
  if (normalized.includes("user")) return "user-added";
  return "";
}

function truncate(value = "", max = 90) {
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function csvCell(value = "") {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function localeSort(a, b) {
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}
