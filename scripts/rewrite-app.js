const fs = require('fs');

let content = fs.readFileSync('public/app.js', 'utf8');

// 1. Remove initial baseLeads definition
content = content.replace(/const baseLeads = \(window\.CRM_LEADS \|\| \[\]\).*?\}\)\);/s, 'let baseLeads = [];');

// 2. Remove loadStore and assign empty
content = content.replace(/let crmStore = loadStore\(\);\s*let edits = crmStore\.edits \|\| \{\};\s*let customLeads = crmStore\.customLeads \|\| \[\];/s, 'let edits = {};\nlet customLeads = [];');

// 3. Rewrite init to be async
content = content.replace(/function init\(\) \{/s, `async function init() {
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
`);

// 4. Update getLeads
content = content.replace(/function getLeads\(\) \{\s*return \[\.\.\.baseLeads, \.\.\.customLeads\][\s\S]*?\}\)/s, `function getLeads() {
  return baseLeads.filter(lead => !lead.deleted);`);

// 5. Update updateLead
content = content.replace(/function updateLead\(id, key, value\) \{[\s\S]*?els\.priority\.value = state\.priority;\s*\}\s*\}/s, `async function updateLead(id, key, value) {
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
}`);

// 6. Update toggleFavorite
content = content.replace(/function toggleFavorite\(id\) \{[\s\S]*?render\(\);\s*\}/s, `async function toggleFavorite(id) {
  const lead = getLeads().find((item) => item.id === id);
  if (!lead) return;
  lead.favorite = !Boolean(lead.favorite);
  render();
  if(lead._id) {
    await fetch('/api/leads/' + lead._id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorite: lead.favorite }) });
  }
}`);

// 7. Update addLead
content = content.replace(/function addLead\(\) \{[\s\S]*?render\(\);\s*\}/s, `async function addLead() {
  const id = "lead-" + Date.now();
  const lead = {
    leadId: id, id: id,
    Country: "New Country", Company: "New Company", Priority: "New", Type: "Buyer lead",
    Evidence: "", BrandsChannels: "", LinkedInCompany: "", BuyerContact: "", Title: "",
    favorite: false, ContactLinkedIn: "", RoleMemo: "", WebsiteContact: "", Email: "", Phone: "",
    Address: "", Approach: "", Sources: "Manual entry", Checked: new Date().toISOString().slice(0, 10),
    Confidence: "Manual entry", status: "New", owner: "", lastContact: "", nextFollowUp: "", notes: ""
  };
  baseLeads.unshift(lead);
  state.selectedId = id;
  state.view = "leads";
  state.country = "All";
  state.status = "All";
  state.priority = "All";
  renderFilters();
  render();
  
  const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
  const result = await res.json();
  if(result.success) {
    const idx = baseLeads.findIndex(l => l.id === id);
    if(idx !== -1) baseLeads[idx]._id = result.data._id;
  }
}`);

// 8. Update deleteLead
content = content.replace(/function deleteLead\(id\) \{[\s\S]*?render\(\);\s*\}/s, `async function deleteLead(id) {
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
}`);

// 9. Update markSelectedContacted and undoSelectedContacted and deleteSelectedLeads
content = content.replace(/function markSelectedContacted\(\) \{[\s\S]*?render\(\);\s*\}/s, `async function markSelectedContacted() {
  if (!state.selectedId) return;
  updateLead(state.selectedId, "status", "Contacted");
}`);

content = content.replace(/function undoSelectedContacted\(\) \{[\s\S]*?render\(\);\s*\}/s, `async function undoSelectedContacted() {
  if (!state.selectedId) return;
  const lead = getLeads().find((item) => item.id === state.selectedId);
  if (!lead || lead.status !== "Contacted") return;
  updateLead(state.selectedId, "status", lead.previousStatus || "New");
}`);

content = content.replace(/function deleteSelectedLeads\(\) \{[\s\S]*?render\(\);\s*\}/s, `async function deleteSelectedLeads() {
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
}`);

fs.writeFileSync('public/app.js', content, 'utf8');
console.log('Successfully patched app.js to use MongoDB API');
