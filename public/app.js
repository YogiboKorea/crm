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
  view: "leads",
  query: "",
  country: "All",
  status: "All",
  priority: "All",
  verify: "All",
  selectedId: baseLeads[0]?.id || null,
  selectedLeadIds: new Set(),
  sortField: null,
  sortOrder: "asc"
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

function bindEvents() {
  // Click event delegation
  document.addEventListener("click", async (event) => {
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

  els.viewTitle.textContent = "Leads";
  els.viewSubtitle.textContent = "Edit, qualify, and manage buyer outreach.";
  renderLeadTable(leads);
}

function renderStats(leads) {
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
            <th></th>
            <th>Company</th>
            <th class="sortable" data-sort="Country" style="cursor: pointer; user-select: none;" title="Sort by Country">
              Country
              <span style="color: #999; font-size: 0.8em; margin-left: 4px;">${state.sortField === 'Country' ? (state.sortOrder === 'asc' ? '▲' : '▼') : '⇕'}</span>
            </th>
            <th>Status</th>
            <th>Priority</th>
            <th>검증</th>
            <th>Contact</th>
            <th>Title</th>
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



function rowHtml(lead) {
  const selected = lead.id === state.selectedId ? "selected" : "";
  const checked = state.selectedLeadIds.has(lead.id) ? "checked" : "";
  return `
    <tr data-id="${escapeHtml(lead.id)}" class="${selected}">
      <td>
        <input class="lead-select" data-select-lead="${escapeAttr(lead.id)}" type="checkbox" ${checked} aria-label="Select ${escapeAttr(lead.Company)}">
      </td>
      <td>${favoriteButton(lead, true)}</td>
      <td>
        <div class="company-cell">
          <strong>${escapeHtml(lead.Company)}</strong>
          <span class="meta-line">${escapeHtml(truncate(lead.Type, 74))}</span>
        </div>
      </td>
      <td>${escapeHtml(lead.Country)}</td>
      <td><span class="badge">${escapeHtml(lead.status)}</span></td>
      <td><span class="badge ${badgeClass(lead.Priority)}">${escapeHtml(lead.Priority || "-")}</span></td>
      <td>${verifyBadgeHtml(lead)}</td>
      <td>${escapeHtml(truncate(lead.BuyerContact || lead.Phone || "No public contact", 70))}</td>
      <td>${escapeHtml(truncate(lead.Title || lead.RoleMemo || "", 70))}</td>
      <td>${emailCell(lead.Email)}</td>
      <td>${lead.WebsiteContact ? `<a href="${escapeAttr(urlFor(lead.WebsiteContact))}" target="_blank" rel="noreferrer">Open</a>` : ""}</td>
    </tr>
  `;
}

function getLeads() {
  return baseLeads.filter(lead => !lead.deleted);
}

// 검증 버킷 매칭: 종합 score 0~5 기준
//   즐겨찾기 → 대표가 직접 검증한 것으로 간주, 항상 passed
//   5점     → passed (모든 정합성 + 뷰티 관련성 통과)
//   3~4점   → suspicious
//   0~2점   → invalid
//   미검증  → unverified
function verifyBucketOf(lead) {
  // 즐겨찾기는 대표가 직접 확인한 리드 — 자동 검증과 무관하게 통과 처리
  if (lead?.favorite === true) return 'passed';
  const v = lead?.verification;
  if (!v || !v.verifiedAt) return 'unverified';
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
function verifyBadgeHtml(lead) {
  // 즐겨찾기는 별도 라벨 — 대표 직접 검증
  if (lead?.favorite === true) {
    return `<span title="대표가 직접 확인한 리드 (즐겨찾기 등록)" style="display:inline-block;padding:2px 8px;border-radius:99px;background:#fef9c3;color:#854d0e;font-size:11px;font-weight:700;white-space:nowrap;border:1px solid #facc15">⭐ 검증완료</span>`;
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

  // suspicious / invalid 만 짧은 사유 라벨 같이 표시 (테이블에서 한눈에)
  if (bucket === 'suspicious' || bucket === 'invalid') {
    const labels = failures.slice(0, 2).map(f => f.label).join(', ');
    const more = failures.length > 2 ? ` +${failures.length - 2}` : '';
    if (labels) {
      return `${badge}<div style="font-size:10px;color:#6b7280;margin-top:3px;line-height:1.2">${escapeHtml(labels)}${more}</div>`;
    }
  }
  return badge;
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
          <strong style="font-size:14px;color:#854d0e">대표 직접 검증 완료</strong>
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
    if (!obj.leadId) obj.leadId = `lead-${Date.now()}-${i}-${Math.random().toString(36).slice(2,7)}`;
    if (!obj.id) obj.id = obj.leadId;

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

  modal.style.display = 'flex';
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
        resultText.innerHTML = `<strong style="font-size:15px;color:#1b5e20">🎉 적용완료</strong>${detail}`;
      }
      if (submitBtn) { submitBtn.textContent = '\uc801\uc6a9\uc644\ub8cc \u2713'; submitBtn.disabled = true; }

      // Show quick link to Import History
      if (result) {
        const batchId = data.batchId || '';
        const historyLink = document.createElement('div');
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
