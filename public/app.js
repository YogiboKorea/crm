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
  Algeria: "Africa",
  Egypt: "Africa",
  Libya: "Africa",
  "South Africa": "Africa",
  Armenia: "Asia",
  China: "Asia",
  "Hong Kong": "Asia",
  India: "Asia",
  Indonesia: "Asia",
  Israel: "Asia",
  Japan: "Asia",
  Jordan: "Asia",
  Kazakhstan: "Asia",
  Kuwait: "Asia",
  Malaysia: "Asia",
  Phillippines: "Asia",
  Qatar: "Asia",
  Russia: "Europe",
  "Saudi Arabia": "Asia",
  Singapore: "Asia",
  Taiwan: "Asia",
  Thailand: "Asia",
  Turkey: "Asia",
  UAE: "Asia",
  Uzbekistan: "Asia",
  Vietnam: "Asia",
  Belgium: "Europe",
  Czech: "Europe",
  Denmark: "Europe",
  Estonia: "Europe",
  France: "Europe",
  Germany: "Europe",
  Greece: "Europe",
  Italy: "Europe",
  Netherlands: "Europe",
  Poland: "Europe",
  Portugal: "Europe",
  Romania: "Europe",
  Slovenia: "Europe",
  Spain: "Europe",
  UK: "Europe",
  Ukraine: "Europe",
  "United Kingdom": "Europe",
  Canada: "North America",
  Mexico: "North America",
  USA: "North America",
  Brazil: "South America",
  Chile: "South America",
  Ecuador: "South America",
  Peru: "South America",
  Australia: "Oceania"
};

let baseLeads = [];

let edits = {};
let customLeads = [];
let state = {
  view: "leads",
  query: "",
  country: "All",
  status: "All",
  priority: "All",
  selectedId: baseLeads[0]?.id || null,
  selectedLeadIds: new Set()
};

const els = {
  navItems: [...document.querySelectorAll(".nav-item")],
  viewTitle: document.getElementById("viewTitle"),
  viewSubtitle: document.getElementById("viewSubtitle"),
  search: document.getElementById("searchInput"),
  country: document.getElementById("countryFilter"),
  status: document.getElementById("statusFilter"),
  priority: document.getElementById("priorityFilter"),
  stats: document.getElementById("statsGrid"),
  content: document.getElementById("content"),
  detail: document.getElementById("detailPanel"),
  detailResizer: document.getElementById("detailResizer"),
  pipeline: document.getElementById("pipelineList"),
  exportCsv: document.getElementById("exportCsvBtn"),
  addLead: document.getElementById("addLeadBtn"),
  markContacted: document.getElementById("markContactedBtn"),
  undoContacted: document.getElementById("undoContactedBtn"),
  reset: document.getElementById("resetBtn"),
  home: document.getElementById("homeBtn")
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
  renderFilters();
  bindEvents();
  render();
}

function resetAllFilters() {
  state.query = "";
  state.country = "All";
  state.status = "All";
  state.priority = "All";
  if (els.search) els.search.value = "";
  if (els.country) els.country.value = "All";
  if (els.status) els.status.value = "All";
  if (els.priority) els.priority.value = "All";
}

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => {
      const targetView = button.dataset.view;
      const targetStatus = button.dataset.statusFilter;
      state.view = targetView;
      if (["leads", "favorites"].includes(state.view)) {
        resetAllFilters();
        if (targetStatus) {
          state.status = targetStatus;
          if (els.status) els.status.value = targetStatus;
        }
      }
      state.selectedId = getFilteredLeads()[0]?.id || state.selectedId;
      render();
    });
  });

  els.home?.addEventListener("click", () => {
    state.view = "leads";
    resetAllFilters();
    state.selectedLeadIds = new Set();
    state.selectedId = getFilteredLeads()[0]?.id || null;
    render();
  });

  els.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    state.view = "leads";
    if (state.query) {
      state.country = "All";
      state.status = "All";
      state.priority = "All";
      els.country.value = state.country;
      els.status.value = state.status;
      els.priority.value = state.priority;
    }
    state.selectedId = getFilteredLeads()[0]?.id || state.selectedId;
    render();
  });

  els.country.addEventListener("change", (event) => {
    state.country = event.target.value;
    render();
  });

  els.status.addEventListener("change", (event) => {
    state.status = event.target.value;
    render();
  });

  els.priority.addEventListener("change", (event) => {
    state.priority = event.target.value;
    render();
  });

  els.exportCsv?.addEventListener("click", exportCsv);
  els.addLead?.addEventListener("click", addLead);
  els.markContacted?.addEventListener("click", markSelectedContacted);
  els.undoContacted?.addEventListener("click", undoSelectedContacted);
  els.reset?.addEventListener("click", resetEdits);
}

function initDetailResizer() {
  const savedWidth = Number(localStorage.getItem(DETAIL_WIDTH_KEY));
  if (savedWidth) setDetailWidth(savedWidth);

  els.detailResizer?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    els.detailResizer.setPointerCapture(event.pointerId);
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

  els.stats.innerHTML = [
    stat("Visible", leads.length, "leads"),
    stat("Countries", countryCount, "countries"),
    stat("Worked", contacted, "worked"),
    stat("Due", due, "followups"),
    stat("No Email", all.filter((lead) => !hasEmail(lead)).length, "emails")
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
            <th>Country</th>
            <th>Status</th>
            <th>Priority</th>
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

function getFilteredLeads() {
  const query = state.query.toLowerCase();
  return getLeads().filter((lead) => {
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
      && (state.priority === "All" || lead.Priority === state.priority);
  }).sort(leadSort);
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

function initAddLeadModal() {
  const modal = document.getElementById('addLeadModal');
  const form  = document.getElementById('addLeadForm');
  const closeBtn  = document.getElementById('modalCloseBtn');
  const cancelBtn = document.getElementById('modalCancelBtn');
  if (!modal || !form) return;

  const closeModal = () => { modal.style.display = 'none'; };
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('modalSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }

    const id = 'lead-' + Date.now();
    const getValue = (name) => (document.getElementById('ml-' + name)?.value || '').trim();
    const lead = {
      leadId: id, id: id,
      Company:       getValue('Company') || 'New Company',
      Country:       getValue('Country') || 'Unknown',
      Priority:      getValue('Priority'),
      Type:          getValue('Type'),
      BuyerContact:  getValue('BuyerContact'),
      Email:         getValue('Email'),
      Phone:         getValue('Phone'),
      WebsiteContact:getValue('WebsiteContact'),
      BrandsChannels:getValue('BrandsChannels'),
      notes:         getValue('notes'),
      Evidence: '', LinkedInCompany: '', Title: '', favorite: false,
      ContactLinkedIn: '', RoleMemo: '', Address: '', Approach: '',
      Sources: 'Manual entry',
      Checked: new Date().toISOString().slice(0, 10),
      Confidence: 'Manual entry',
      status: 'New', owner: '', lastContact: '', nextFollowUp: ''
    };

    baseLeads.unshift(lead);
    state.selectedId = id;
    state.view = 'leads';
    state.country = 'All';
    state.status  = 'All';
    state.priority = 'All';
    renderFilters();
    render();
    closeModal();

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      });
      const result = await res.json();
      if (result.success) {
        const idx = baseLeads.findIndex(l => l.id === id);
        if (idx !== -1) baseLeads[idx]._id = result.data._id;
      }
    } catch (err) {
      console.error('Failed to save lead:', err);
    }

    if (btn) { btn.disabled = false; btn.textContent = '저장하기'; }
  });
}

function initEditModal() {
  const modal = document.getElementById('editLeadModal');
  const closeBtn = document.getElementById('editModalCloseBtn');
  const closeBtn2 = document.getElementById('editModalCloseBtn2');
  if (!modal) return;

  const closeModal = () => { modal.style.display = 'none'; };
  closeBtn?.addEventListener('click', closeModal);
  closeBtn2?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  const fields = ["status", "owner", "lastContact", "nextFollowUp", "notes", "Company", "Country", "Priority", "Type", "BuyerContact", "Title", "Email", "Phone", "WebsiteContact", "LinkedInCompany", "BrandsChannels", "Evidence", "Approach", "Sources"];
  
  fields.forEach(f => {
    const el = document.getElementById('el-' + f);
    if (el) {
      el.addEventListener('change', () => {
        if (state.selectedId) updateLead(state.selectedId, f, el.value);
      });
    }
  });

  document.getElementById('el-favoriteBtn')?.addEventListener('click', () => {
    if (state.selectedId) toggleFavorite(state.selectedId);
  });
  
  document.getElementById('el-deleteBtn')?.addEventListener('click', () => {
    if (state.selectedId) {
      deleteLead(state.selectedId);
      closeModal();
    }
  });
}

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

  modal.style.display = 'flex';
}

function initSettingsModal() {
  const btn = document.getElementById('settingsBtn');
  const modal = document.getElementById('settingsModal');
  const closeBtn = document.getElementById('settingsCloseBtn');
  const subIdSection = document.getElementById('subIdSection');
  const subIdTableBody = document.getElementById('subIdTableBody');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const newPasswordInput = document.getElementById('newPasswordInput');
  const createSubIdBtn = document.getElementById('createSubIdBtn');
  
  if (!modal || !btn) return;

  const closeModal = () => { modal.style.display = 'none'; };
  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  let currentUser = null;
  let isMaster = false;

  // 1) 권한 확인 (마스터인지 서브계정인지)
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

  // 2) 설정 버튼 클릭
  btn.addEventListener('click', () => {
    modal.style.display = 'flex';
    newPasswordInput.value = '';
    if (isMaster) {
      loadSubIds();
    }
  });

  // 3) 비밀번호 변경
  changePasswordBtn?.addEventListener('click', async () => {
    const newPassword = newPasswordInput.value;
    if (newPassword.length < 4) {
      alert('비밀번호는 최소 4자리 이상이어야 합니다.');
      return;
    }
    
    changePasswordBtn.disabled = true;
    changePasswordBtn.textContent = '저장 중...';

    try {
      const res = await fetch('/api/users/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (data.success) {
        alert('비밀번호가 성공적으로 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해주세요.');
        newPasswordInput.value = '';
      } else {
        alert('오류: ' + data.error);
      }
    } catch (e) {
      alert('비밀번호 변경 실패');
    }
    
    changePasswordBtn.disabled = false;
    changePasswordBtn.textContent = '변경하기';
  });

  // 4) 서브 계정 목록 로드
  async function loadSubIds() {
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

        subIdTableBody.querySelectorAll('[data-delete-user]').forEach(delBtn => {
          delBtn.addEventListener('click', async () => {
            const username = delBtn.dataset.deleteUser;
            if (confirm(`정말 '${username}' 계정을 삭제하시겠습니까?`)) {
              await deleteSubId(username);
            }
          });
        });
      }
    } catch (e) {
      console.error('Failed to load sub users', e);
    }
  }

  // 5) 서브 계정 생성
  createSubIdBtn?.addEventListener('click', async () => {
    const unInput = document.getElementById('subUsernameInput');
    const pwInput = document.getElementById('subPasswordInput');
    const username = unInput.value.trim();
    const password = pwInput.value;

    if (!username || password.length < 4) {
      alert('아이디와 4자리 이상의 비밀번호를 입력해주세요.');
      return;
    }

    createSubIdBtn.disabled = true;
    createSubIdBtn.textContent = '생성 중...';

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        unInput.value = '';
        pwInput.value = '';
        loadSubIds(); // 목록 갱신
      } else {
        alert('생성 실패: ' + data.error);
      }
    } catch (e) {
      alert('생성 중 오류가 발생했습니다.');
    }

    createSubIdBtn.disabled = false;
    createSubIdBtn.textContent = '생성';
  });

  // 6) 서브 계정 삭제
  async function deleteSubId(username) {
    try {
      const res = await fetch('/api/users/' + encodeURIComponent(username), { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadSubIds();
      } else {
        alert('삭제 실패: ' + data.error);
      }
    } catch (e) {
      alert('삭제 중 오류가 발생했습니다.');
    }
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
