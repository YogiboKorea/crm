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
  view: "pipeline-verified",
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
  //   'all'         - 전체
  //   'unverified'  - AI 미검증 (아직 처리 전)
  //   'maybe'       - AI 검증됨: 모호 판정 (사람 판단 필요)
  //   'ai-checked'  - AI 검증 완료된 모든 것 (maybe + 이번 stage 에 남은 것)
  verifyingSubFilter: 'all',
  // 검증완료 페이지 서브 필터 (승인 상태로 나눔)
  //   'all'        - 전체 verified
  //   'approved'   - readyForOutreach=true (발송 대기열)
  //   'pending'    - readyForOutreach=false (승인 대기)
  //   'no-email'   - Email 필드 비었거나 "Not found" — 승인 불가
  verifiedSubFilter: 'all',
  // B2B 메일 매니저 전용 서브 상태
  email: {
    templates: [],
    variables: [],
    currentTemplateId: null,
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
  try {
    const res = await fetch('/api/leads');
    const result = await res.json();
    if (result.success) {
      baseLeads = result.data.map(lead => ({ ...lead, id: lead.leadId }));
    }
  } catch(e) {
    console.error(e);
  }
  state.selectedId = baseLeads[0]?.id || null;

  initDetailResizer();
  initAddLeadModal();
  initEditModal();
  initSettingsModal();
  initImportCsvModal();
  initImportHistoryModal();
  initThemeToggle();
  renderFilters();
  bindEvents();
  render();
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
}

// ── Loading helpers ──────────────────────────────────────────────
// 상단 가로 progress bar — async 작업 시작/끝에 호출
let _topBarTimer = null;
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

async function loadLeads() {
  try {
    const res = await fetch('/api/leads');
    const result = await res.json();
    if (result.success) {
      baseLeads = result.data.map(lead => ({ ...lead, id: lead.leadId }));
      renderFilters();
    }
  } catch(e) {
    console.error("Failed to load leads:", e);
  }
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

    // 1. Navigation items
    const navItem = event.target.closest(".nav-item");
    if (navItem) {
      const targetView = navItem.dataset.view;
      const targetStatus = navItem.dataset.statusFilter;
      state.view = targetView;
      // 모든 뷰 진입 시 필터 초기화 — 이전 뷰에서 남은 country/status/priority 가
      // 다음 뷰의 데이터까지 좁히는 문제 방지
      resetAllFilters();
      if (targetStatus) {
        state.status = targetStatus;
        const statusEl = els.status;
        if (statusEl) statusEl.value = targetStatus;
      }

      // 로딩 표시 — 사용자가 클릭한 결과로 무거운 데이터 fetch 가 시작됨을 인지
      startTopProgress();
      setContentLoading(true);
      try {
        await loadLeads();
        state.selectedId = getFilteredLeads()[0]?.id || state.selectedId;
        render();
      } finally {
        setContentLoading(false);
        finishTopProgress();
      }
      return;
    }

    // 2. Home Button
    if (event.target.closest("#homeBtn")) {
      state.view = "leads";
      resetAllFilters();
      state.selectedLeadIds = new Set();
      startTopProgress();
      setContentLoading(true);
      try {
        await loadLeads();
        state.selectedId = getFilteredLeads()[0]?.id || null;
        render();
      } finally {
        setContentLoading(false);
        finishTopProgress();
      }
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
      if (modal) modal.style.display = "none";
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
      if (modal) modal.style.display = "none";
      return;
    }
    if (event.target.closest("#editModalCloseBtn") || event.target.closest("#editModalCloseBtn2")) {
      const modal = document.getElementById("editLeadModal");
      if (modal) modal.style.display = "none";
      return;
    }
    if (event.target.closest("#importModalCloseBtn") || event.target.closest("#importCancelBtn")) {
      const modal = document.getElementById("importCsvModal");
      if (modal) modal.style.display = "none";
      resetImportModal();
      return;
    }
    if (event.target.closest("#settingsCloseBtn")) {
      const modal = document.getElementById("settingsModal");
      if (modal) modal.style.display = "none";
      return;
    }
    if (event.target.closest("#importHistoryCloseBtn") || event.target.closest("#importHistoryCloseBtn2")) {
      const modal = document.getElementById("importHistoryModal");
      if (modal) modal.style.display = "none";
      return;
    }

    // 5. Click outside modal content (backdrop clicks)
    if (event.target.classList.contains("modal-backdrop")) {
      event.target.style.display = "none";
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
      if (event.target.closest("input[type='checkbox'], button.favorite-button, a")) return;
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
        if (modal) modal.style.display = "none";
      }
      return;
    }

    // 8. Settings Button Click
    if (event.target.closest("#settingsBtn")) {
      const modal = document.getElementById("settingsModal");
      if (modal) {
        modal.style.display = "flex";
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

    // Select Visible toggle
    if (event.target.closest("[data-select-visible]")) {
      const visibleIds = getFilteredLeads().map((lead) => lead.id);
      const selectedVisibleCount = visibleIds.filter((id) => state.selectedLeadIds.has(id)).length;
      const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

      if (allVisibleSelected) {
        visibleIds.forEach((id) => state.selectedLeadIds.delete(id));
      } else {
        visibleIds.forEach((id) => state.selectedLeadIds.add(id));
      }
      render();
      return;
    }

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
      render();
    } else if (event.target.id === "statusFilter") {
      state.status = event.target.value;
      render();
    } else if (event.target.id === "priorityFilter") {
      state.priority = event.target.value;
      render();
    } else if (event.target.id === "verifyFilter") {
      state.verify = event.target.value;
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
      state.view = "leads";
      if (state.query) {
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
      if (modal) modal.style.display = "none";

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

  els.country.innerHTML = optionHtml(["All", ...countries], state.country);
  els.status.innerHTML = optionHtml(["All", ...STATUSES], state.status);
  els.priority.innerHTML = optionHtml(["All", ...priorities], state.priority);
  // verify select 는 정적 옵션이 page.tsx 에 박혀있어 value 만 동기화
  if (els.verify) els.verify.value = state.verify || "All";
}

function render() {
  const leads = getFilteredLeads();
  // 매 render 마다 stage 배너/서브필터 chip 초기화 — 각 페이지에서 필요 시 다시 그려짐
  clearStageBanner();
  clearVerifyingSubFilterChips();
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

  // ── 새 파이프라인 뷰 (stage 기반) ─────────────────────────────
  const stageMap = {
    'pipeline-import':      { stage: 'imported',    title: '📥 가져오기 (Import)',  sub: '엑셀에서 새로 업로드된 회사들. 검증 진행 대기.' },
    'pipeline-verifying':   { stage: 'verifying',   title: '🔍 검증 대기',          sub: '검증 진행 중이거나 필요한 회사들.' },
    'pipeline-verified':    { stage: 'verified',    title: '✅ 검증 완료',          sub: '검증 통과 = B2B 메일 컨택 대상. 발송 승인 후 자동 발송.' },
    'pipeline-contacted':   { stage: 'contacted',   title: '📨 컨택 중',            sub: '첫 메일 발송 완료. 응답 대기 중.' },
    'pipeline-replied':     { stage: 'replied',     title: '💬 응답 옴',            sub: '상대방 답장 옴. 팔로우업 필요.' },
    'pipeline-negotiating': { stage: 'negotiating', title: '🤝 협상 중',            sub: '미팅/샘플/조건 협상 단계.' },
    'pipeline-partner':     { stage: 'partner',     title: '⭐ 파트너 (최종 완료)', sub: '계약 성사된 파트너. 자동 메일 발송 대상에서 자동 제외됨.' },
    'pipeline-archived':    { stage: 'archived',    title: '📦 보관함',             sub: '검증 무효 또는 폐기된 리드. 필요 시 복구 가능.' },
  };
  if (stageMap[state.view]) {
    const s = stageMap[state.view];
    els.viewTitle.textContent = s.title;
    els.viewSubtitle.textContent = s.sub;
    // stage 필터는 텍스트 필터(getFilteredLeads) 뒤에 한번 더 적용
    const allByStage = getLeads().filter(l => (l.stage || 'imported') === s.stage);
    let stageLeads = leads.filter(l => (l.stage || 'imported') === s.stage);

    // 검증대기 stage 는 AI 진행 여부 하위 필터 적용
    if (s.stage === 'verifying') {
      const sub = state.verifyingSubFilter || 'all';
      if (sub === 'unverified') {
        stageLeads = stageLeads.filter(l => !l?.verification?.aiVerifiedAt);
      } else if (sub === 'maybe') {
        stageLeads = stageLeads.filter(l => l?.verification?.aiVerdict === 'maybe');
      } else if (sub === 'ai-checked') {
        stageLeads = stageLeads.filter(l => !!l?.verification?.aiVerifiedAt);
      }
    }
    // 검증완료 stage 는 발송 승인 상태 하위 필터 적용
    if (s.stage === 'verified') {
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
    els.viewTitle.textContent = "📤 B2B 메일 관리";
    els.viewSubtitle.textContent = "템플릿 편집 · 예약 발송 · 발송 이력. 파트너는 자동 제외.";
    renderB2BEmailManager();
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

  // 검증 버킷별 카운트 — 전체 리드 기준
  const verifyCounts = { passed: 0, suspicious: 0, invalid: 0, unverified: 0 };
  for (const l of all) verifyCounts[verifyBucketOf(l)]++;

  els.stats.innerHTML = [
    stat("Visible", leads.length, "leads"),
    stat("Countries", countryCount, "countries"),
    stat("Worked", contacted, "worked"),
    stat("Due", due, "followups"),
    stat("No Email", all.filter((lead) => !hasEmail(lead)).length, "emails"),
    // ── 검증 분류 (클릭으로 필터링) ──
    statVerify("✅ 통과", verifyCounts.passed, "passed"),
    statVerify("⚠ 의심", verifyCounts.suspicious, "suspicious"),
    statVerify("❌ 무효", verifyCounts.invalid, "invalid"),
    statVerify("⏳ 미검증", verifyCounts.unverified, "unverified"),
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
      els.status.value = state.status;
      state.selectedId = getFilteredLeads()[0]?.id || state.selectedId;
      render();
    });
  });
}

// stage 배너 (파이프라인 페이지 상단에 표시)
// 검증대기/검증완료 stage 에서 실행 대상 카운트 계산
function computeVerificationCounts(stage) {
  const isKorean = (c) => /korea|한국|대한민국/i.test(c || '') && !/north/i.test(c || '');
  const inStage = baseLeads.filter((l) => (l.stage || 'imported') === stage && !l.deleted && !isKorean(l.Country));
  const aiPending = inStage.filter((l) => !l.verification?.aiVerifiedAt).length;
  const crawlPending = inStage.filter((l) =>
    (!l.Email || String(l.Email).trim() === '') &&
    l.WebsiteContact && String(l.WebsiteContact).trim() !== '' &&
    (!Array.isArray(l.crawledEmails) || l.crawledEmails.length === 0)
  ).length;
  return { aiPending, crawlPending };
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
    const { aiPending, crawlPending } = computeVerificationCounts('verifying');
    heroCard = `
      <div class="verify-hero" style="
        margin-top:12px;
        display:grid;grid-template-columns:1fr 1fr;gap:12px;
      ">
        <div class="verify-hero-card" style="
          padding:20px;border-radius:16px;
          background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);
          border:1px solid #c7d2fe;position:relative;overflow:hidden;
        ">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <div style="font-size:32px" class="pulse-icon">🧠</div>
            <div>
              <div style="font-size:12px;color:#4338ca;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">AI 1차 검증</div>
              <div style="font-size:24px;font-weight:800;color:#1e1b4b;line-height:1.1">
                ${aiPending.toLocaleString()}<span style="font-size:14px;font-weight:600;color:#6366f1;margin-left:4px">건 대기</span>
              </div>
            </div>
          </div>
          <p style="font-size:12px;color:#4c1d95;margin:0 0 12px;line-height:1.5">
            Claude Haiku 4.5 로 K-beauty 진성 바이어 판정.<br>
            <b>beauty-buyer → 검증완료 자동 이동 · not-buyer → 보관함</b>
          </p>
          <button id="runAiVerifyOnVerifyingBtn" class="button primary" type="button" style="
            width:100%;font-size:14px;font-weight:700;padding:12px;
            background:#4338ca;color:white;border:none;border-radius:10px;cursor:pointer;
            box-shadow:0 2px 8px rgba(67,56,202,0.3);
          ">
            🧠 AI 검증 실행 (예상 ${(aiPending / 20 * 4).toFixed(0)}분, 비용 ~$${(aiPending * 0.0005).toFixed(2)})
          </button>
        </div>
        <div class="verify-hero-card" style="
          padding:20px;border-radius:16px;
          background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);
          border:1px solid #fcd34d;position:relative;overflow:hidden;
        ">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <div style="font-size:32px">🔍</div>
            <div>
              <div style="font-size:12px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">메일 크롤링</div>
              <div style="font-size:24px;font-weight:800;color:#78350f;line-height:1.1">
                ${crawlPending.toLocaleString()}<span style="font-size:14px;font-weight:600;color:#b45309;margin-left:4px">건 대기</span>
              </div>
            </div>
          </div>
          <p style="font-size:12px;color:#78350f;margin:0 0 12px;line-height:1.5">
            메일 없음 + 사이트 있음 → 홈/contact/about 자동 크롤.<br>
            <b>최우선 후보 (partnerships/business/sales) 자동 Email 승격</b>
          </p>
          <button id="runCrawlOnVerifyingBtn" class="button secondary" type="button" style="
            width:100%;font-size:14px;font-weight:700;padding:12px;
            background:#d97706;color:white;border:none;border-radius:10px;cursor:pointer;
            box-shadow:0 2px 8px rgba(217,119,6,0.3);
          ">
            🔍 크롤링 실행 (${crawlPending}건)
          </button>
        </div>
      </div>
      <div style="margin-top:8px;font-size:11px;color:var(--text-tertiary);text-align:center">
        🇰🇷 한국 기업 자동 제외 · AI 실행 후 자동으로 검증완료/보관함으로 이동
      </div>
    `;
  } else if (stageInfo.stage === 'verified') {
    const { crawlPending } = computeVerificationCounts('verified');
    heroCard = `
      <div class="verify-hero" style="margin-top:12px">
        <div class="verify-hero-card" style="
          padding:20px;border-radius:16px;
          background:linear-gradient(135deg,#dcfce7 0%,#bbf7d0 100%);
          border:1px solid #86efac;display:flex;align-items:center;gap:20px;
        ">
          <div style="font-size:40px" class="pulse-icon">✅</div>
          <div style="flex:1">
            <div style="font-size:12px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">AI 검증 통과 리드</div>
            <div style="font-size:14px;color:#14532d;margin-top:2px">
              메일 없는 <b>${crawlPending.toLocaleString()}건</b> 크롤링 대기 · 크롤 후 발송 승인 → 컨택 시작
            </div>
          </div>
          <button id="runCrawlOnVerifiedBtn" class="button primary" type="button" style="
            font-size:14px;font-weight:700;padding:12px 20px;
            background:#15803d;color:white;border:none;border-radius:10px;cursor:pointer;
            box-shadow:0 2px 8px rgba(21,128,61,0.3);
            ${crawlPending === 0 ? 'opacity:0.4;cursor:not-allowed' : ''}
          " ${crawlPending === 0 ? 'disabled' : ''}>
            🔍 메일 크롤링 실행 (${crawlPending}건)
          </button>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-tertiary);text-align:center">
          🇰🇷 한국 기업 자동 제외 · 발견된 메일은 최우선 후보(partnerships/business) 자동 Email 승격
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
    await loadLeads();
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
    await loadLeads();
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

  // 각 필터별 카운트
  const cAll = allInStage.length;
  const cUnverified = allInStage.filter(l => !l?.verification?.aiVerifiedAt).length;
  const cMaybe = allInStage.filter(l => l?.verification?.aiVerdict === 'maybe').length;
  const cAiChecked = allInStage.filter(l => !!l?.verification?.aiVerifiedAt).length;

  const cur = state.verifyingSubFilter || 'all';
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
      <span style="font-size:11px;color:var(--text-tertiary);margin-right:4px;font-weight:600">🔎 AI 진행 여부:</span>
      ${chip('all', '전체', cAll, '#334155')}
      ${chip('unverified', '⏳ AI 미검증 (대기)', cUnverified, '#f59e0b')}
      ${chip('ai-checked', '✅ AI 검증됨', cAiChecked, '#3b82f6')}
      ${chip('maybe', '🧠 모호 (사람 판단)', cMaybe, '#a855f7')}
    </div>
  `;

  container.querySelectorAll('.sub-filter-chip').forEach(el => {
    el.addEventListener('click', () => {
      state.verifyingSubFilter = el.dataset.subFilter;
      render();
    });
  });
}
function clearVerifyingSubFilterChips() {
  const c = document.getElementById('verifyingSubFilterChips');
  if (c) c.innerHTML = '';
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
        <span style="font-size:11px;color:var(--text-tertiary);margin-right:4px;font-weight:600">📤 발송 승인:</span>
        ${chip('all', '전체', cAll, '#334155')}
        ${chip('approved', '✅ 승인됨 (대기열)', cApproved, '#15803d')}
        ${chip('pending', '⏳ 승인 대기', cPending, '#f59e0b')}
        ${chip('no-email', '📭 이메일 없음', cNoEmail, '#94a3b8')}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button id="bulkApproveAllBtn" class="button primary" type="button" style="font-size:12px;padding:6px 12px" title="필터에 노출된 리드 전부를 승인 처리">
          ✅ 화면 전체 승인 (${cur === 'pending' ? cPending : (cur === 'approved' ? cApproved : cAll)})
        </button>
        <button id="bulkUnapproveAllBtn" class="button ghost" type="button" style="font-size:12px;padding:6px 12px" title="필터에 노출된 리드 전부의 승인 취소">
          ⏸ 전체 승인 취소
        </button>
        <button id="dryrunSendBtn" class="button secondary" type="button" style="font-size:12px;padding:6px 12px" title="실제 발송 없이 승인된 리드 대상 발송 시뮬레이션">
          🧪 dry-run 시뮬레이션
        </button>
      </div>
    </div>
  `;

  container.querySelectorAll('.v-sub-filter-chip').forEach(el => {
    el.addEventListener('click', () => {
      state.verifiedSubFilter = el.dataset.subFilter;
      render();
    });
  });
  document.getElementById('bulkApproveAllBtn')?.addEventListener('click', () => bulkApproveVisible(true));
  document.getElementById('bulkUnapproveAllBtn')?.addEventListener('click', () => bulkApproveVisible(false));
  document.getElementById('dryrunSendBtn')?.addEventListener('click', () => runDryRunSimulation());
}
function clearVerifiedSubFilterChips() {
  const c = document.getElementById('verifiedSubFilterChips');
  if (c) c.innerHTML = '';
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
    await loadLeads();
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
    alert('발송 대기열이 비어있습니다. 먼저 리드를 "✅ 승인" 처리하세요.');
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
let _pipelineAutoRefreshTimer = null;
let _pipelineAutoRefreshView = null;
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
      await loadLeads({ silent: true });
      render();
    } catch (e) { /* silent */ }
  }, 30000);  // 30 초마다
}

function renderLeadTable(leads, emptyText = "No leads match the current filters.") {
  if (!leads.length) {
    els.content.innerHTML = emptyState(emptyText);
    return;
  }

  const visibleIds = leads.map((lead) => lead.id);
  const selectedVisibleCount = visibleIds.filter((id) => state.selectedLeadIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  els.content.innerHTML = `
    <div class="bulk-actions">
      <button class="button secondary" data-select-visible type="button">${allVisibleSelected ? "Clear Selection" : "Select All"}</button>
      <button class="button ghost danger-action" data-delete-selected type="button" ${state.selectedLeadIds.size ? "" : "disabled"}>
        Delete Selected (${state.selectedLeadIds.size})
      </button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th><span class="sr-only">Select</span></th>
            <th>Company</th>
            <th class="sortable" data-sort="Country" style="cursor: pointer; user-select: none;" title="Sort by Country">
              Country
              <span style="color: #999; font-size: 0.8em; margin-left: 4px;">${state.sortField === 'Country' ? (state.sortOrder === 'asc' ? '▲' : '▼') : '⇕'}</span>
            </th>
            <th>Stage</th>
            <th>발송승인</th>
            <th>Priority</th>
            <th>검증</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Website</th>
          </tr>
        </thead>
        <tbody>
          ${leads.map((lead) => rowHtml(lead)).join("")}
        </tbody>
      </table>
    </div>
  `;

  els.content.querySelector("[data-select-visible]")?.addEventListener("click", () => {
    if (allVisibleSelected) {
      visibleIds.forEach((id) => state.selectedLeadIds.delete(id));
    } else {
      visibleIds.forEach((id) => state.selectedLeadIds.add(id));
    }
    render();
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
              <td>${lead.WebsiteContact ? `<a href="${escapeAttr(urlFor(lead.WebsiteContact))}" target="_blank" rel="noreferrer">Open Site</a>` : ""}</td>
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
                  <td><code style="font-size:13px;background:var(--surface2,#f2f5f3);padding:2px 6px;border-radius:4px">${escapeHtml(b.batchId)}</code></td>
                  <td style="text-align:center;color:var(--muted)">${escapeHtml(dateStr)}</td>
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



// stage 색상 매핑
const STAGE_STYLE = {
  imported:    { bg: '#f1f5f9', fg: '#475569', label: '📥 가져오기' },
  verifying:   { bg: '#fef9c3', fg: '#854d0e', label: '🔍 검증 대기' },
  verified:    { bg: '#dcfce7', fg: '#166534', label: '✅ 검증 완료' },
  contacted:   { bg: '#dbeafe', fg: '#1e40af', label: '📨 컨택 중' },
  replied:     { bg: '#e0e7ff', fg: '#3730a3', label: '💬 응답 옴' },
  negotiating: { bg: '#fed7aa', fg: '#9a3412', label: '🤝 협상 중' },
  partner:     { bg: '#f3e8ff', fg: '#6b21a8', label: '⭐ 파트너' },
  archived:    { bg: '#f3f4f6', fg: '#6b7280', label: '📦 보관함' },
};
const STAGE_ORDER = ['imported','verifying','verified','contacted','replied','negotiating','partner','archived'];

// 각 stage 에서 실무적으로 자주 이동하는 다음 단계들 (원클릭 버튼)
const STAGE_QUICK_MOVES = {
  imported:    ['verifying', 'archived'],
  verifying:   ['verified', 'archived'],
  verified:    ['contacted', 'partner', 'archived'],
  contacted:   ['replied', 'archived'],
  replied:     ['negotiating', 'partner', 'archived'],
  negotiating: ['partner', 'archived'],
  partner:     ['negotiating', 'archived'],
  archived:    ['imported', 'verifying'],
};

function stageCellHtml(lead) {
  const cur = lead.stage || 'imported';
  const style = STAGE_STYLE[cur] || STAGE_STYLE.imported;
  const options = STAGE_ORDER.map(s => {
    const st = STAGE_STYLE[s];
    return `<option value="${s}" ${s === cur ? 'selected' : ''}>${st.label}</option>`;
  }).join('');

  // 원클릭 이동 버튼 (현재 stage 에서 실무적으로 자주 가는 다음 단계들)
  const quickTargets = STAGE_QUICK_MOVES[cur] || [];
  const quickBtns = quickTargets.map(target => {
    const t = STAGE_STYLE[target];
    // 짧은 라벨 (이모지 + 첫 단어)
    const shortLabel = t.label.replace(/^([^\s]+)\s(.+)$/, '$1 $2');
    return `<button
      type="button"
      class="stage-quick-move"
      data-quick-lead="${escapeAttr(lead.id)}"
      data-quick-target="${target}"
      onclick="event.stopPropagation()"
      title="${t.label}로 이동"
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
    </div>
  `;
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
  return `
    <label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:11px" onclick="event.stopPropagation()">
      <input type="checkbox" class="outreach-approval"
        data-approve-lead="${escapeAttr(lead.id)}"
        ${on ? 'checked' : ''}
        style="width:14px;height:14px;cursor:pointer">
      <span style="color:${on ? '#166534' : '#6b7280'};font-weight:${on ? '700' : '400'}">
        ${on ? '✓ 승인됨' : '승인'}
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

function rowHtml(lead) {
  const selected = lead.id === state.selectedId ? "selected" : "";
  const checked = state.selectedLeadIds.has(lead.id) ? "checked" : "";
  return `
    <tr data-id="${escapeHtml(lead.id)}" class="${selected}">
      <td>
        <input class="lead-select" data-select-lead="${escapeAttr(lead.id)}" type="checkbox" ${checked} aria-label="Select ${escapeAttr(lead.Company)}">
      </td>
      <td>
        <div class="company-cell">
          <strong>${escapeHtml(lead.Company)}</strong>
          <span class="meta-line">${escapeHtml(truncate(lead.Type, 74))}</span>
          ${updatedInfoBadgeHtml(lead)}
        </div>
      </td>
      <td>${escapeHtml(lead.Country)}</td>
      <td>${stageCellHtml(lead)}</td>
      <td>${outreachApprovalCellHtml(lead)}</td>
      <td><span class="badge ${badgeClass(lead.Priority)}">${escapeHtml(lead.Priority || "-")}</span></td>
      <td>${verifyBadgeHtml(lead)}</td>
      <td>${escapeHtml(truncate(lead.BuyerContact || lead.Phone || "No public contact", 70))}</td>
      <td>${emailCell(lead.Email)}</td>
      <td>${lead.WebsiteContact ? `<a href="${escapeAttr(urlFor(lead.WebsiteContact))}" target="_blank" rel="noreferrer">Open</a>` : ""}</td>
    </tr>
  `;
}

function getLeads() {
  return baseLeads.filter(lead => !lead.deleted);
}

// ── Stage 변경 핸들러 ───────────────────────────────────────
async function handleStageChange(leadId, newStage, selectEl) {
  const lead = baseLeads.find(l => l.id === leadId);
  if (!lead || !lead._id) return;

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
// AI 판정 배지 — verify-ai 실행 여부와 결과 + 검증 시각을 한눈에 표시
function aiVerdictBadgeHtml(lead) {
  const v = lead?.verification;
  if (!v?.aiVerifiedAt) return '';   // AI 미검증 → 배지 없음
  const verdict = v.aiVerdict;
  const conf = v.aiConfidence;
  const reasoning = v.aiReasoning ? v.aiReasoning.slice(0, 200) : '';
  const style = {
    'beauty-buyer': { bg: '#dcfce7', fg: '#166534', bd: '#22c55e', label: '🧠 진성 바이어' },
    'maybe':        { bg: '#fef3c7', fg: '#92400e', bd: '#f59e0b', label: '🧠 모호' },
    'not-buyer':    { bg: '#fee2e2', fg: '#991b1b', bd: '#ef4444', label: '🧠 무관' },
  }[verdict] || { bg: '#f1f5f9', fg: '#475569', bd: '#94a3b8', label: '🧠 AI 검증됨' };

  const verifiedAt = v.aiVerifiedAt;
  const relTime = formatRelativeKo(verifiedAt);
  const absTime = formatDateKo(verifiedAt);
  const tip = `AI 판정: ${verdict || '?'} (${conf || '?'})\n검증 완료: ${absTime || '?'}\n\n${reasoning}`;

  return `<div style="margin-top:3px;display:flex;flex-direction:column;gap:2px;align-items:flex-start" title="${escapeAttr(tip)}">
    <span style="display:inline-block;padding:1px 6px;border-radius:99px;background:${style.bg};color:${style.fg};font-size:10px;font-weight:700;border:1px solid ${style.bd}40">${style.label}</span>
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
let _recommendedCache = null;
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
};

async function loadEmailTemplates() {
  try {
    const res = await fetch('/api/email-templates');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'load failed');
    state.email.templates = data.templates || [];
    state.email.variables = data.variables || [];
  } catch (e) {
    console.error('[templates] load failed', e);
    state.email.templates = [];
    state.email.variables = [];
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
  state.email.editor = { ...DEFAULT_TEMPLATE_EDITOR, name: '새 템플릿' };
  state.email.dirty = true;
  state.email.previewResult = null;
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
      body: JSON.stringify({ leadId: state.email.previewLeadId }),
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
  // 커서를 삽입 뒤로
  const pos = start + insertText.length;
  ta.focus();
  ta.setSelectionRange(pos, pos);
}

async function renderB2BEmailManager() {
  // 최초 진입 시 템플릿 목록 로드
  if (state.email.templates.length === 0 && state.email.variables.length === 0) {
    els.content.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">템플릿 로드 중...</div>`;
    await loadEmailTemplates();
    if (!state.email.editor) {
      state.email.editor = { ...DEFAULT_TEMPLATE_EDITOR };
    }
  }

  // 상단 파이프라인 통계
  const verifiedCount = baseLeads.filter(l => l.stage === 'verified' && l.readyForOutreach).length;
  const pendingApproval = baseLeads.filter(l => l.stage === 'verified' && !l.readyForOutreach).length;
  const contactedCount = baseLeads.filter(l => l.stage === 'contacted').length;
  const partnerCount = baseLeads.filter(l => l.stage === 'partner').length;

  // 발송 대상 리드 (승인 완료 = readyForOutreach, 컨택 중 = 이미 발송된 이력) — 미리보기 대상 후보
  const previewCandidates = baseLeads.filter(l =>
    (l.stage === 'verified' && l.readyForOutreach) ||
    l.stage === 'contacted' || l.stage === 'replied' || l.stage === 'negotiating'
  ).slice(0, 500);

  const templates = state.email.templates;
  const currentId = state.email.currentTemplateId;
  const ed = state.email.editor || { ...DEFAULT_TEMPLATE_EDITOR };
  const preview = state.email.previewResult;

  els.content.innerHTML = `
    <!-- 파이프라인 스탯 -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
      <div style="background:#dcfce7;padding:12px;border-radius:8px;border:1px solid #86efac">
        <div style="font-size:11px;color:#166534;margin-bottom:2px">발송 승인 완료</div>
        <div style="font-size:20px;font-weight:800;color:#166534">${verifiedCount}</div>
      </div>
      <div style="background:#fef3c7;padding:12px;border-radius:8px;border:1px solid #fcd34d">
        <div style="font-size:11px;color:#92400e;margin-bottom:2px">승인 대기</div>
        <div style="font-size:20px;font-weight:800;color:#92400e">${pendingApproval}</div>
      </div>
      <div style="background:#dbeafe;padding:12px;border-radius:8px;border:1px solid #93c5fd">
        <div style="font-size:11px;color:#1e40af;margin-bottom:2px">이미 컨택 중</div>
        <div style="font-size:20px;font-weight:800;color:#1e40af">${contactedCount}</div>
      </div>
      <div style="background:#f3e8ff;padding:12px;border-radius:8px;border:1px solid #c4b5fd">
        <div style="font-size:11px;color:#6b21a8;margin-bottom:2px">파트너 (자동 제외)</div>
        <div style="font-size:20px;font-weight:800;color:#6b21a8">${partnerCount}</div>
      </div>
    </div>

    <!-- 3열 레이아웃: 템플릿 목록 · 편집기 · 미리보기 -->
    <div style="display:grid;grid-template-columns:240px 1fr 1fr;gap:12px;height:calc(100vh - 340px);min-height:520px">

      <!-- 템플릿 목록 -->
      <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:12px;overflow:hidden;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h4 style="margin:0;font-size:13px;font-weight:700">📝 템플릿 (${templates.length})</h4>
          <button id="newTemplateBtn" class="button primary" type="button" style="font-size:11px;padding:4px 8px">+ 새로</button>
        </div>
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
          ${templates.length === 0 ? `
            <div style="padding:16px;text-align:center;color:var(--text-tertiary);font-size:12px">
              템플릿이 없습니다.<br>"+ 새로"를 눌러 시작하세요.
            </div>
          ` : templates.map(t => {
            const active = t._id === currentId;
            const bg = active ? 'var(--brand-primary)' : 'transparent';
            const fg = active ? 'white' : 'var(--text-primary)';
            const sub = active ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)';
            return `
              <div class="tpl-item" data-tpl-id="${escapeAttr(t._id)}"
                style="padding:8px 10px;border-radius:8px;cursor:pointer;background:${bg};color:${fg};border:1px solid ${active ? 'transparent' : 'var(--border)'};transition:all 0.1s">
                <div style="font-size:12px;font-weight:600;line-height:1.3;margin-bottom:2px">
                  ${escapeHtml(t.name)} ${t.isActive === false ? '<span style="opacity:0.5;font-weight:400">(비활성)</span>' : ''}
                </div>
                <div style="font-size:10px;color:${sub}">${t.language === 'ko' ? '🇰🇷 KO' : '🇺🇸 EN'} · ${escapeHtml(t.purpose || 'intro')}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 편집기 -->
      <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h4 style="margin:0;font-size:13px;font-weight:700">✏️ 편집</h4>
          <div style="display:flex;gap:6px">
            ${state.email.currentTemplateId ? `
              <button id="deleteTemplateBtn" class="button ghost" type="button" style="font-size:11px;padding:4px 8px;color:#dc2626">🗑 삭제</button>
            ` : ''}
            <button id="saveTemplateBtn" class="button primary" type="button" style="font-size:11px;padding:4px 10px" ${state.email.loading ? 'disabled' : ''}>
              ${state.email.loading ? '저장 중...' : (state.email.dirty ? '💾 저장*' : '💾 저장')}
            </button>
          </div>
        </div>

        <div>
          <label style="font-size:11px;color:var(--text-tertiary);font-weight:600">템플릿 이름</label>
          <input id="templateNameInput" type="text" value="${escapeAttr(ed.name)}"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px"
            placeholder="예: 1차 소개 (영문)">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label style="font-size:11px;color:var(--text-tertiary);font-weight:600">언어</label>
            <select id="templateLangInput" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
              <option value="en" ${ed.language === 'en' ? 'selected' : ''}>🇺🇸 English</option>
              <option value="ko" ${ed.language === 'ko' ? 'selected' : ''}>🇰🇷 한국어</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-tertiary);font-weight:600">용도</label>
            <select id="templatePurposeInput" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px">
              <option value="intro" ${ed.purpose === 'intro' ? 'selected' : ''}>1차 소개</option>
              <option value="followup" ${ed.purpose === 'followup' ? 'selected' : ''}>팔로우업</option>
              <option value="re-engage" ${ed.purpose === 're-engage' ? 'selected' : ''}>재컨택</option>
              <option value="partner-onboarding" ${ed.purpose === 'partner-onboarding' ? 'selected' : ''}>파트너 온보딩</option>
              <option value="other" ${ed.purpose === 'other' ? 'selected' : ''}>기타</option>
            </select>
          </div>
        </div>

        <div>
          <label style="font-size:11px;color:var(--text-tertiary);font-weight:600">제목 (변수 사용 가능)</label>
          <input id="templateSubjectInput" type="text" value="${escapeAttr(ed.subject)}"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-top:2px"
            placeholder="예: Partnership inquiry — {{Company}}">
        </div>

        <!-- 변수 chip 팔레트 -->
        <div>
          <label style="font-size:11px;color:var(--text-tertiary);font-weight:600">📎 삽입할 변수 (클릭하면 본문 커서 위치에 삽입)</label>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${state.email.variables.map(v => `
              <button type="button" class="var-chip" data-var-key="${escapeAttr(v.key)}"
                title="${escapeAttr(v.label)} — 예: ${escapeAttr(v.example)}"
                style="padding:3px 8px;font-size:11px;font-family:monospace;
                  border:1px solid #a5b4fc;background:#eef2ff;color:#4338ca;
                  border-radius:99px;cursor:pointer;font-weight:600">
                {{${escapeHtml(v.key)}}}
              </button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;flex:1;min-height:200px">
          <label style="font-size:11px;color:var(--text-tertiary);font-weight:600;display:flex;justify-content:space-between;align-items:center">
            <span>본문 (변수 사용 가능)</span>
            <label style="font-weight:400;font-size:11px;display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="checkbox" id="templateHtmlInput" ${ed.bodyIsHtml ? 'checked' : ''}>
              HTML 본문
            </label>
          </label>
          <textarea id="templateBodyInput"
            style="width:100%;flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:'Menlo','Consolas',monospace;margin-top:2px;resize:vertical;min-height:200px;line-height:1.5">${escapeHtml(ed.body)}</textarea>
        </div>
      </div>

      <!-- 미리보기 -->
      <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h4 style="margin:0;font-size:13px;font-weight:700">👁 미리보기</h4>
          <button id="refreshPreviewBtn" class="button secondary" type="button" style="font-size:11px;padding:4px 10px">🔄 새로고침</button>
        </div>

        <div>
          <label style="font-size:11px;color:var(--text-tertiary);font-weight:600">리드 선택 (변수가 실제 값으로 치환됨)</label>
          <select id="previewLeadSelect" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;margin-top:2px">
            <option value="">— 예시 값 (리드 미지정) —</option>
            ${previewCandidates.map(l => `
              <option value="${escapeAttr(l.leadId)}" ${l.leadId === state.email.previewLeadId ? 'selected' : ''}>
                ${escapeHtml(l.Company)} · ${escapeHtml(l.Country || '')} ${l.Email ? '· 📧' : ''}
              </option>
            `).join('')}
          </select>
        </div>

        ${preview ? `
          ${preview.missing && preview.missing.length ? `
            <div style="padding:8px 10px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;font-size:12px;color:#991b1b">
              ⚠️ 치환되지 않은 변수: ${preview.missing.map(v => `<code>{{${escapeHtml(v)}}}</code>`).join(', ')}
              <br><span style="font-size:11px">해당 리드에 값이 없거나, 변수 스펠링이 잘못됨</span>
            </div>
          ` : ''}

          <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <div style="background:var(--surface-2);padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-tertiary)">
              <div style="font-weight:600;color:var(--text-secondary)">제목</div>
              <div style="margin-top:2px;color:var(--text-primary);font-size:14px;font-weight:600">${escapeHtml(preview.subject)}</div>
            </div>
            <div style="padding:16px;background:var(--surface-0);max-height:500px;overflow-y:auto">
              ${preview.bodyIsHtml
                ? `<div style="font-size:14px;line-height:1.6">${preview.body}</div>`
                : `<pre style="margin:0;font-family:inherit;font-size:14px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word">${escapeHtml(preview.body)}</pre>`
              }
            </div>
            ${preview.leadInfo ? `
              <div style="background:var(--surface-2);padding:8px 14px;border-top:1px solid var(--border);font-size:11px;color:var(--text-tertiary)">
                🎯 대상: <b>${escapeHtml(preview.leadInfo.company)}</b> (${escapeHtml(preview.leadInfo.country || '')})
                ${preview.leadInfo.email ? ` · 발송지 <b>${escapeHtml(preview.leadInfo.email)}</b>` : ' · 📭 Email 없음'}
              </div>
            ` : `
              <div style="background:var(--surface-2);padding:8px 14px;border-top:1px solid var(--border);font-size:11px;color:var(--text-tertiary)">
                📝 예시 값으로 렌더링 (리드 선택 시 실제 값으로 치환)
              </div>
            `}
          </div>
        ` : `
          <div style="padding:32px;text-align:center;color:var(--text-tertiary);font-size:13px;background:var(--surface-2);border-radius:8px">
            🔄 새로고침 버튼을 눌러 미리보기 생성
          </div>
        `}
      </div>
    </div>
  `;

  // ── 이벤트 바인딩 ─────────────────────────────────────────
  document.getElementById('newTemplateBtn')?.addEventListener('click', startNewTemplate);
  document.getElementById('saveTemplateBtn')?.addEventListener('click', saveTemplate);
  document.getElementById('deleteTemplateBtn')?.addEventListener('click', deleteTemplate);
  document.getElementById('refreshPreviewBtn')?.addEventListener('click', refreshPreview);

  document.querySelectorAll('.tpl-item').forEach(el => {
    el.addEventListener('click', () => selectTemplate(el.dataset.tplId));
  });

  document.querySelectorAll('.var-chip').forEach(el => {
    el.addEventListener('click', () => insertVariableIntoBody(el.dataset.varKey));
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

  // 미리보기 리드 선택 → 자동 렌더
  document.getElementById('previewLeadSelect')?.addEventListener('change', (e) => {
    state.email.previewLeadId = e.target.value || null;
    refreshPreview();
  });
}

// ── Phase 1 스켈레톤: 이메일 크롤링 ─────────────────────────
function renderCrawlerTool() {
  const noEmailCount = baseLeads.filter(l => !hasEmail(l) && l.WebsiteContact).length;
  const withUrlNoEmail = baseLeads.filter(l =>
    !hasEmail(l) &&
    (!Array.isArray(l.crawledEmails) || l.crawledEmails.length === 0) &&
    l.WebsiteContact
  ).length;

  els.content.innerHTML = `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:20px">🕷</span>
        <strong style="font-size:15px;color:#1e40af">이메일 크롤링이란</strong>
      </div>
      <p style="margin:0;font-size:13px;color:#1e3a8a;line-height:1.6">
        회사 홈페이지 → <code>/contact</code>, <code>/about</code>, <code>/team</code> 등 하위 페이지 접근 →
        <code>mailto:</code> 링크 + 텍스트에서 이메일 추출 → <code>info@</code>, <code>ceo@</code> 등 신뢰도 스코어링.
      </p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:20px">
      <div style="background:#fff;padding:16px;border:1px solid #e5e7eb;border-radius:8px">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px">이메일 없는 리드</div>
        <div style="font-size:22px;font-weight:800;color:#111">${noEmailCount}</div>
      </div>
      <div style="background:#fef3c7;padding:16px;border:1px solid #fcd34d;border-radius:8px">
        <div style="font-size:11px;color:#92400e;margin-bottom:4px">크롤링 대상 (URL 있음, 미크롤링)</div>
        <div style="font-size:22px;font-weight:800;color:#92400e">${withUrlNoEmail}</div>
      </div>
    </div>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;text-align:center">
      <div style="padding:32px;background:#f9fafb;border:2px dashed #d1d5db;border-radius:8px;color:#6b7280;font-size:14px">
        🚧 Phase 2 에서 구현 예정<br>
        <span style="font-size:12px;margin-top:8px;display:block">
          • 사이트 다중 페이지 크롤링 (contact/about/team/impressum)<br>
          • 다국어 서브패스 지원 (/en, /ko, /de)<br>
          • 신뢰도 스코어링 (실무 담당자 우선)<br>
          • 청크 처리 + 진행률 표시
        </span>
      </div>
    </div>
  `;
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
    <div style="margin-bottom:20px;padding:14px 16px;background:#fef9c3;border:1px solid #facc15;border-radius:10px;font-size:13px;line-height:1.6;color:#854d0e">
      <strong>📋 추천 리스트 안내</strong><br>
      웹 검색으로 발굴한 글로벌 K-beauty B2B 디스트리뷰터/도매/리테일러 ${totalCount}건 (발굴 시점: 2026-06).
      산업 매체(knokglobal, kbeautyproduction, cosmeticindex 등) + 각 회사 공식 사이트 기반.
      "내 리드로 추가" 시 기존 검증 파이프라인을 그대로 통과시킬 수 있습니다.
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
        <h3 style="margin:0 0 12px;font-size:15px;color:#0f172a">${regionLabels[region]}  <span style="color:#9ca3af;font-weight:400">${byRegion[region].length}</span></h3>
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
  const importedBadge = b.imported
    ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">✅ 등록완료</span>`
    : '';
  return `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;${b.imported ? 'opacity:0.7' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">
            <strong style="font-size:14px;color:#0f172a">${escapeHtml(b.company)}</strong>
            <span style="background:${prioColor};color:#fff;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:700">${b.priority}</span>
            ${importedBadge}
          </div>
          <div style="font-size:12px;color:#6b7280">${escapeHtml(b.country)} · ${escapeHtml(b.type)}</div>
        </div>
        ${b.imported ? '' : `<label style="display:flex;align-items:center;cursor:pointer"><input type="checkbox" data-rec-select="${escapeAttr(b.company)}" style="width:18px;height:18px;cursor:pointer"></label>`}
      </div>
      <div style="font-size:12px;color:#374151;line-height:1.5">${escapeHtml(b.brandsChannels)}</div>
      <div style="font-size:11px;color:#6b7280;line-height:1.5;padding:6px 8px;background:#f9fafb;border-radius:6px;border-left:3px solid #4f8cff">
        <strong>왜 추천:</strong> ${escapeHtml(b.evidence)}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <a href="${escapeAttr(b.website)}" target="_blank" rel="noreferrer" style="font-size:12px;color:#4f8cff">🔗 사이트 열기</a>
        <a href="${escapeAttr(b.source)}" target="_blank" rel="noreferrer" style="font-size:11px;color:#9ca3af">출처</a>
      </div>
    </div>
  `;
}

async function importRecommended(companies) {
  startTopProgress();
  showGlobalBlocker(`${companies.length}건 내 리드로 추가 중...`);
  try {
    const res = await fetch('/api/recommended-buyers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies }),
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
      ${row('웹사이트', v.websiteAlive,  v.websiteAlive === false ? `연결 실패 ${v.websiteStatus ? `(HTTP ${v.websiteStatus})` : '(응답 없음)'}` : (lead.WebsiteContact || '값 없음'))}
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
    els.country.value = state.country;
    els.priority.value = state.priority;
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
  els.markContacted.disabled = !lead || lead.status === "Contacted";
  els.undoContacted.disabled = !lead || lead.status !== "Contacted";
}

function addLead() {
  // 모달 열기
  const modal = document.getElementById('addLeadModal');
  if (!modal) return;
  // 폼 초기화
  const form = document.getElementById('addLeadForm');
  if (form) form.reset();
  modal.style.display = 'flex';
}

function initAddLeadModal() {}

function initEditModal() {}

function openEditModal(id) {
  const lead = getLeads().find(l => l.id === id);
  if (!lead) return;
  state.selectedId = id;
  render(); // Update row selection state
  
  const modal = document.getElementById('editLeadModal');
  if (!modal) return;

  document.getElementById('el-title').textContent = lead.Company;
  document.getElementById('el-badge').textContent = lead.Priority || "No priority";
  document.getElementById('el-badge').className = "badge " + badgeClass(lead.Priority);
  document.getElementById('el-meta').textContent = (lead.Country || "") + " · " + (lead.Type || "Lead");
  
  const fields = ["status", "owner", "lastContact", "nextFollowUp", "notes", "Company", "Country", "Priority", "Type", "BuyerContact", "Title", "Email", "Phone", "WebsiteContact", "LinkedInCompany", "BrandsChannels", "Evidence", "Approach", "Sources"];
  fields.forEach(f => {
    const el = document.getElementById('el-' + f);
    if (el) el.value = lead[f] || "";
  });

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

function exportCsv() {
  const rows = getFilteredLeads();
  const exportHeaders = [...Object.keys(rows[0] || {}), "exportedAt"];
  const exportedAt = new Date().toISOString();
  const csv = [
    exportHeaders.join(","),
    ...rows.map((row) => exportHeaders.map((key) => csvCell(key === "exportedAt" ? exportedAt : row[key])).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `kbeauty-crm-export-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ── CSV Import Modal ────────────────────────────────────────────────────────

let importParsedLeads = [];

function openImportCsvModal() {
  const modal = document.getElementById('importCsvModal');
  if (!modal) return;
  resetImportModal();
  modal.style.display = 'flex';
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
  if (step2) step2.style.display = 'none';
  if (progress) progress.style.display = 'none';
  if (result) result.style.display = 'none';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '가져오기'; }
  if (fileInput) fileInput.value = '';
  // Reset radio
  const radios = document.querySelectorAll('input[name="duplicateAction"]');
  radios.forEach(r => { if (r.value === 'skip') r.checked = true; });
}

function initImportCsvModal() {}

function handleCsvFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
    alert('CSV 파일만 가져올 수 있습니다.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('파일 크기가 5MB를 초과합니다.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const leads = parseCsv(text);
    if (!leads.length) {
      alert('CSV 파일에서 데이터를 찾을 수 없습니다. Company와 Country 컬럼이 있는지 확인해주세요.');
      return;
    }
    importParsedLeads = leads;
    showImportPreview(leads);
  };
  reader.readAsText(file, 'UTF-8');
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

  if (step1) step1.style.display = 'none';
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
  if (progress) progress.style.display = 'none';
  if (result) result.style.display = 'none';
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
  if (aiProgress) aiProgress.style.display = 'none';
  if (aiResult) aiResult.style.display = 'none';
  if (aiStartBtn) {
    aiStartBtn.disabled = aiTarget === 0;
    aiStartBtn.textContent = aiTarget === 0
      ? '🧠 AI 검증 — 대상 없음'
      : `🧠 AI 정밀 검증 시작 (${aiTarget}건)`;
    aiStartBtn.style.opacity = aiTarget === 0 ? '0.5' : '1';
  }

  modal.style.display = 'flex';
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
  if (result) result.style.display = 'none';
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
  if (result) result.style.display = 'none';
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
  if (step2) step2.style.display = 'none';
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
          document.getElementById('importCsvModal').style.display = 'none';
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
  const colors = {
    passed:     { bg: '#dcfce7', fg: '#166534', accent: '#22c55e' },
    suspicious: { bg: '#fef3c7', fg: '#92400e', accent: '#f59e0b' },
    invalid:    { bg: '#fee2e2', fg: '#991b1b', accent: '#ef4444' },
    unverified: { bg: '#f1f5f9', fg: '#64748b', accent: '#94a3b8' },
  }[bucket];
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
