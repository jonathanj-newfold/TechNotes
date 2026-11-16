// ── Settings: manage placeholders ───────────────────────────────────────
// One screen for everything about a {placeholder}: what it's called in the
// fill-in form, what kind of input it shows, and — for dropdowns/toggles —
// exactly which options exist and what text each one puts in the note.
// Everything here writes to `fieldConfigs` (popup.js), which is merged over
// DEFAULT_FIELD_CONFIGS, so built-ins can be edited and reset.

let settingsOpen = false;
let settingsEditKey = null;  // placeholder being edited, or null = list view
let settingsDraft = null;    // { name, ...config } working copy
let settingsListScroll = 0;  // where the placeholder list was scrolled to when you opened an editor
let settingsInList = false;  // true while the list (not an editor) is what's on screen
let settingsDraftSnapshot = ""; // what the draft looked like when the editor opened, to spot unsaved changes
let warnDraft = null;       // working copy of the soft warning being edited (null = not editing one)
let warnIsNew = false;      // true while that draft hasn't been saved into the list yet
let warnSnapshot = "";      // what it looked like when the editor opened
let settingsTab = "general"; // which category of the Settings screen is showing: general | placeholders | warnings | history

const pageScrollY = () => window.scrollY || (document.scrollingElement || document.documentElement).scrollTop || document.body.scrollTop || 0;

// ── Colour theme (dark is the default; the choice is remembered) ────────
function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
function applyTheme(theme) {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  try { localStorage.setItem("cnh_theme", theme); } catch (e) { /* not fatal: just won't persist */ }
  updateThemeBtn();
}
// The header button shows the theme a click switches TO
// (dark now -> sun, light now -> moon).
const THEME_ICON_SUN = '<svg class="hi" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const THEME_ICON_MOON = '<svg class="hi" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
function updateThemeBtn() {
  const btn = $("themeBtn");
  if (!btn) return;
  const isLight = currentTheme() === "light";
  btn.innerHTML = isLight ? THEME_ICON_MOON : THEME_ICON_SUN; // static markup; shows the theme a click switches TO
  btn.title = isLight ? "Switch to the dark theme" : "Switch to the light theme";
  btn.setAttribute("aria-label", btn.title);
}
$("themeBtn").addEventListener("click", () => applyTheme(currentTheme() === "light" ? "dark" : "light"));
updateThemeBtn();
// The Knowledge Base window can switch the theme too; follow it.
window.addEventListener("storage", (ev) => {
  if (ev.key !== "cnh_theme") return;
  if (ev.newValue === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  updateThemeBtn();
});

function openSettings() {
  if (typeof leaveAboutQuietly === "function") leaveAboutQuietly(); // About and Settings share the screen
  $("reorderToggleBtn").classList.add("hidden"); // rearranging tabs makes no sense from here
  settingsOpen = true;
  settingsEditKey = null;
  settingsDraft = null;
  warnDraft = null;
  settingsInList = false;
  settingsListScroll = 0;
  ["fillView", "tableView", "editView", "editReferenceView", "tabs", "addTplRow"].forEach((id) => $(id).classList.add("hidden"));
  $("searchRow").classList.add("hidden");
  $("editToggleBtn").classList.add("hidden");
  $("settingsView").classList.remove("hidden");
  $("settingsBtn").classList.add("is-active");
  renderSettings();
}

// Hide the Settings screen without re-rendering the main views (used when
// jumping straight to About, which takes over the screen itself).
function leaveSettingsQuietly() {
  settingsInList = false;
  settingsListScroll = 0;
  settingsOpen = false;
  settingsEditKey = null;
  settingsDraft = null;
  warnDraft = null;
  $("settingsView").classList.add("hidden");
  $("settingsBtn").classList.remove("is-active");
}

function closeSettings() {
  closeUnsavedDialog();
  $("reorderToggleBtn").classList.remove("hidden");
  settingsInList = false;
  settingsListScroll = 0;
  settingsOpen = false;
  settingsEditKey = null;
  settingsDraft = null;
  warnDraft = null;
  $("settingsView").classList.add("hidden");
  $("searchRow").classList.remove("hidden");
  $("tabs").classList.remove("hidden");
  $("editToggleBtn").classList.remove("hidden");
  $("settingsBtn").classList.remove("is-active");
  renderTabs();
  renderActiveView();
}

function renderSettings() {
  if (settingsEditKey === null && !warnDraft) {
    // Re-drawing the list (e.g. after deleting a row) keeps you where you are;
    // coming back from an editor (Cancel / Save / Back) returns to where you
    // were before you opened it, instead of jumping to the top.
    const y = settingsInList ? pageScrollY() : settingsListScroll;
    renderSettingsList();
    settingsInList = true;
    window.scrollTo(0, y);
  } else {
    const opening = settingsInList;
    if (opening) settingsListScroll = pageScrollY();
    settingsInList = false;
    if (warnDraft) renderWarningEditor(); else renderSettingsEditor();
    if (opening) window.scrollTo(0, 0); // an editor starts at its top
  }
}

// ── The Settings screen, by category ───────────────────────────────────
// General (theme, backup), Placeholders (the list), Soft warnings, History
// (snapshots). Editors for one placeholder / warning replace the whole screen
// and come back to the category they were opened from.
const SETTINGS_TABS = [
  { id: "general", label: "General", title: "Appearance, backup and about" },
  { id: "placeholders", label: "Placeholders", title: "Every {placeholder}: its input type, label and options" },
  { id: "warnings", label: "Soft warnings", title: "The amber hints shown under fields that look off" },
  { id: "history", label: "History", title: "Snapshots you can go back to" }
];

function switchSettingsTab(id) {
  if (!SETTINGS_TABS.some((t) => t.id === id) || id === settingsTab) return;
  settingsTab = id;
  historyRenameId = null;
  renderSettingsList();
  window.scrollTo(0, 0);
}

function settingsTabsHTML() {
  return `<div class="set-tabs" role="tablist">${SETTINGS_TABS.map((t) =>
    `<button type="button" role="tab" aria-selected="${t.id === settingsTab}" class="tab-btn${t.id === settingsTab ? " is-active" : ""}" data-settings-tab="${t.id}" title="${escAttr(t.title)}">${escHtml(t.label)}</button>`
  ).join("")}</div>`;
}

function generalTabHTML() {
  const light = currentTheme() === "light";
  return `
    <div class="edit-hint">Settings for the extension as a whole. Placeholders, soft warnings and history each have their own tab above.</div>
    <div class="set-block">
      <div class="set-block-title">Appearance</div>
      <div class="mini-toggle" style="margin-bottom:0">
        <button type="button" class="mini-toggle-btn${light ? "" : " is-active"}" data-theme-pick="dark">Dark</button>
        <button type="button" class="mini-toggle-btn${light ? " is-active" : ""}" data-theme-pick="light">Light</button>
      </div>
      <div class="set-hint" style="margin:6px 0 0">Remembered on this browser and included in Export / Import.</div>
    </div>
    <div class="set-block">
      <div class="set-block-title">Tabs on the dashboard <span class="set-hint" style="display:inline;margin-left:6px">(${(appSettings.hiddenTabs || []).filter((t) => tabOrder.includes(t)).length} hidden)</span></div>
      <div class="set-hint" style="margin:0 0 6px">Untick a template or table to hide its tab. Nothing is deleted: its wording, saved values and cases stay, and you can tick it again any time. Hidden tabs are also left out of the tab search. Tip: right-click a tab on the dashboard to hide it.</div>
      <div class="set-case-tpls">${tabOrder.map((id) => `<label class="set-check" style="margin:0"><input type="checkbox" data-tab-show="${escAttr(id)}"${isTabHidden(id) ? "" : " checked"}> ${escHtml(labelForTpl(id))}${tabType(id) === "reference" ? ' <span class="set-hint" style="display:inline">(table)</span>' : ""}</label>`).join("")}</div>
      <div class="set-btn-row"><button type="button" class="btn" id="setShowAllTabs">Show all tabs</button></div>
    </div>
    <div class="set-block">
      <div class="set-block-title">Cases panel <span class="set-hint" style="display:inline;margin-left:6px">(${casesPanelOpen() ? "showing" : "hidden"})</span></div>
      <label class="set-check" style="margin-top:0"><input type="checkbox" id="setCasesLog"${appSettings.logCases !== false ? " checked" : ""}> Add notes to the Cases panel when I press Copy</label>
      <div class="set-hint" style="margin:6px 0 2px">Only for the templates ticked here (also ticked with "Log to Cases" next to Copy). Copying a note with the same case ID again updates that case. Cases are included in Export / Import.</div>
      <div class="set-case-tpls">${tabOrder.filter((id) => templates[id] !== undefined && tabType(id) === "template").map((id) => `<label class="set-check" style="margin:0"><input type="checkbox" data-case-tpl="${escAttr(id)}"${(appSettings.caseTpls || []).includes(id) ? " checked" : ""}> ${escHtml(labelForTpl(id))}</label>`).join("")}</div>
      <label class="set-check" style="margin:0 0 8px"><input type="checkbox" id="setPasteAny"${appSettings.pasteImagesAnywhere !== false ? " checked" : ""}> Paste screenshots into any text box (click the box, press Ctrl+V)</label>
      <label class="set-check" style="margin:0 0 8px"><input type="checkbox" id="setCtrlC"${appSettings.ctrlCCopy !== false ? " checked" : ""}> Ctrl+C copies the whole note when nothing is selected</label>
      <label class="set-check" style="margin:0 0 8px"><input type="checkbox" id="setGroupToggles"${appSettings.groupToggles === true ? " checked" : ""}> Group toggle buttons (Y/N, brand…) into one row instead of following the template order</label>
      <label class="set-check" style="margin:0 0 2px"><input type="checkbox" id="setCasesWide"${appSettings.casesWide === true ? " checked" : ""}> Keep the window wide so it never resizes</label>
      <div class="set-hint" style="margin:0 0 8px">Off: the window grows to the left when the Cases panel opens and shrinks back when it closes (the dashboard stays put). On: the window always has room for the panel, so nothing resizes; the room shows empty while the panel is closed.</div>
      <div class="set-btn-row">
        <button type="button" class="btn" id="setCasesShow">${casesPanelOpen() ? "Hide Cases panel" : "Show Cases panel"}</button>
        <button type="button" class="btn" id="setCasesClear">Clear all cases\u2026</button>
      </div>
    </div>
    <div class="set-block">
      <div class="set-block-title">Backup</div>
      <div class="set-hint">Export saves everything to a file: templates, tables, placeholder settings, what's in the forms, infoHub, the Cases panel (with pictures), History snapshots, theme and window / panel sizes. Import replaces your setup with the contents of a backup file (a snapshot of your current setup is saved first) and adds the backup's snapshots to your History.</div>
      <div class="set-btn-row">
        <button type="button" class="btn" id="setImportBtn" title="Import templates/data from a JSON file">Import</button>
        <button type="button" class="btn" id="setExportBtn" title="Export all templates and data to a JSON file">Export</button>
      </div>
    </div>
    ${typeof syncBlockHTML === "function" ? syncBlockHTML() : ""}
    <div class="set-block">
      <div class="set-block-title">About</div>
      <div class="set-hint">TechNotes ${escHtml(typeof appVersionFull === "function" ? appVersionFull() : "")}</div>
      <button type="button" class="btn" id="setAboutBtn">Open About</button>
    </div>`;
}

function placeholdersTabHTML() {
  const rowsHTML = allKnownFields().map((key) => {
    const cfg = getFieldConfig(key);
    const type = fieldType(key);
    const used = templatesUsingField(key);
    const custom = !!fieldConfigs[key];
    const meta = [(cfg && pickerTypeOf(cfg) === TOGGLE_NONE_TYPE) ? TOGGLE_NONE_LABEL : (FIELD_TYPE_LABELS[type] || "Single-line text")];
    if (cfg && (cfg.type === "select" || cfg.type === "multiselect" || cfg.type === "toggle" || cfg.type === "prefixToggle" || cfg.type === "multiToggle")) {
      meta.push(`${(cfg.options || []).length} option${(cfg.options || []).length === 1 ? "" : "s"}`);
    }
    if (cfg && cfg.type === "multiselect" && multiFilterKey(key)) meta.push(`follows {${multiFilterKey(key)}}`);
    if (cfg && cfg.showWhen && cfg.showWhen.field) meta.push(`shows when {${cfg.showWhen.field}} matches` + (Array.isArray(cfg.alwaysOn) && cfg.alwaysOn.length ? ` (always on ${cfg.alwaysOn.length} template${cfg.alwaysOn.length === 1 ? "" : "s"})` : ""));
    if (cfg && cfg.type === "dnsDiff") meta.push(`compares {${cfg.oldField || "?"}} \u2192 {${cfg.newField || "?"}}`);
    if (cfg && cfg.type === "select" && cfg.grouped) {
      const n = new Set((cfg.options || []).map((o) => singleGroup(o.group) || DEFAULT_GROUP_NAME)).size;
      meta.push(`${n} categor${n === 1 ? "y" : "ies"}`);
    }
    if (cfg && cfg.optional) meta.push("optional");
    if (cfg && cfg.pasteImages) meta.push("accepts images");
    if (cfg && cfg.leadIn) meta.push("lead-in");
    return `<div class="set-row-wrap">
      <button type="button" class="set-row" data-edit-field="${escAttr(key)}">
        <div class="set-row-main">
          <code class="set-row-name">{${escHtml(key)}}</code>
          ${custom ? '<span class="set-badge">edited</span>' : ""}
        </div>
        <div class="set-row-meta">${escHtml(meta.join(" \u00B7 "))}</div>
        <div class="set-row-meta">${used.length ? escHtml("Used in: " + used.join(", ")) : "Not used in any template"}</div>
      </button>
      <button type="button" class="ref-remove-btn set-row-del" data-del-field="${escAttr(key)}" title="Delete {${escAttr(key)}}" aria-label="Delete {${escAttr(key)}}">\u2715</button>
    </div>`;
  }).join("");
  return `
    <div class="edit-hint">Pick a placeholder to change its label, what kind of input it shows, and the exact text each option puts into the note. Placeholders not listed here just get a plain text box. Use the \u2715 on a row to delete a placeholder.</div>
    <div class="set-list">${rowsHTML}</div>
    <div class="set-add-row">
      <input type="text" id="newFieldName" placeholder="New placeholder name (e.g. refundType)" maxlength="30">
      <button class="btn btn-primary" id="addFieldBtn">Add</button>
    </div>`;
}

function renderSettingsList() {
  const wrap = $("settingsBody");
  const body = settingsTab === "placeholders" ? placeholdersTabHTML()
    : settingsTab === "warnings" ? softWarningsSectionHTML()
    : settingsTab === "history" ? historyTabHTML()
    : generalTabHTML();
  wrap.innerHTML = settingsTabsHTML() + body;

  wrap.querySelectorAll("[data-settings-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchSettingsTab(btn.dataset.settingsTab));
  });
  const click = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };

  if (settingsTab === "general") {
    click("setExportBtn", exportData);
    if (typeof wireSync === "function") wireSync();
    click("setImportBtn", () => $("importFileInput").click());
    click("setAboutBtn", () => { if (typeof openAbout === "function") openAbout(); });
    const logChk = $("setCasesLog");
    if (logChk) logChk.addEventListener("change", () => { appSettings.logCases = logChk.checked; saveAppSettings(); });
    document.querySelectorAll("[data-case-tpl]").forEach((cb) => cb.addEventListener("change", () => setCasesLogFor(cb.dataset.caseTpl, cb.checked)));
    document.querySelectorAll("[data-tab-show]").forEach((cb) => cb.addEventListener("change", () => {
      const id = cb.dataset.tabShow;
      if (!cb.checked && tabOrder.filter((t) => !isTabHidden(t) && t !== id).length === 0) { cb.checked = true; showToast("Keep at least one tab showing"); return; }
      setTabHidden(id, !cb.checked);
      renderTabs();
      renderSettings();
    }));
    const showAllTabs = $("setShowAllTabs");
    if (showAllTabs) showAllTabs.addEventListener("click", () => { appSettings.hiddenTabs = []; saveAppSettings(); renderTabs(); renderSettings(); });
    const pasteAny = $("setPasteAny");
    if (pasteAny) pasteAny.addEventListener("change", () => { appSettings.pasteImagesAnywhere = pasteAny.checked; saveAppSettings(); if (typeof renderFields === "function") renderFields(); if (typeof renderPreview === "function") renderPreview(); });
    const grpTog = $("setGroupToggles");
    if (grpTog) grpTog.addEventListener("change", () => { appSettings.groupToggles = grpTog.checked; saveAppSettings(); if (typeof renderFields === "function") renderFields(); });
    const ctrlc = $("setCtrlC");
    if (ctrlc) ctrlc.addEventListener("change", () => { appSettings.ctrlCCopy = ctrlc.checked; saveAppSettings(); });
    const wideChk = $("setCasesWide");
    if (wideChk) wideChk.addEventListener("change", () => setCasesWide(wideChk.checked));
    click("setCasesShow", () => { setCasesPanel(!casesPanelOpen()); renderSettingsList(); });
    click("setCasesClear", () => clearAllCases());
    wrap.querySelectorAll("[data-theme-pick]").forEach((btn) => {
      btn.addEventListener("click", () => { applyTheme(btn.dataset.themePick); renderSettingsList(); });
    });
  } else if (settingsTab === "placeholders") {
    wrap.querySelectorAll("[data-edit-field]").forEach((btn) => {
      btn.addEventListener("click", () => startEditField(btn.dataset.editField));
    });
    wrap.querySelectorAll("[data-del-field]").forEach((btn) => {
      btn.addEventListener("click", () => deleteFieldPlaceholder(btn.dataset.delField));
    });
    click("addFieldBtn", addFieldFromInput);
    $("newFieldName").addEventListener("keydown", (e) => { if (e.key === "Enter") addFieldFromInput(); });
  } else if (settingsTab === "warnings") {
    wrap.querySelectorAll("[data-edit-warn]").forEach((btn) => {
      btn.addEventListener("click", () => startEditWarning(btn.dataset.editWarn));
    });
    wrap.querySelectorAll("[data-del-warn]").forEach((btn) => {
      btn.addEventListener("click", () => deleteWarning(btn.dataset.delWarn));
    });
    click("addWarnBtn", startNewWarning);
    click("resetWarnBtn", resetWarnings);
  } else if (settingsTab === "history") {
    wireHistoryTab(wrap);
  }

  $("settingsTitle").textContent = "Settings";
  $("settingsBackBtn").textContent = "Done";
}

function addFieldFromInput() {
  const raw = ($("newFieldName").value || "").trim().replace(/[{}]/g, "");
  if (!raw) return;
  const key = raw.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!key) { showToast("Letters and numbers only"); return; }
  if (deletedFields.includes(key)) { deletedFields = deletedFields.filter((k) => k !== key); saveDeletedFields(); }
  if (!fieldConfigs[key] && !DEFAULT_FIELD_CONFIGS[key]) {
    fieldConfigs[key] = { label: labelFor(key), type: "select", inlineManage: true, options: [{ text: "Option 1" }] };
    saveFieldConfigs();
  }
  startEditField(key);
}

// ── Editing one placeholder ────────────────────────────────────────────
function startEditField(key) {
  settingsTab = "placeholders";
  settingsEditKey = key;
  const cfg = getFieldConfig(key) || { label: labelFor(key), type: fieldType(key), options: [], clean: cleanModeFor(key) };
  settingsDraft = cloneCfg(cfg);
  settingsDraft.name = key;
  // orig / origLabel remember what each row said when the editor opened, so a
  // renamed item can be followed by the "Show this field" lists that use it.
  settingsDraft.options = (settingsDraft.options || []).map((o, i) => ({ ...o, id: optionId(o, i), orig: o.text, origLabel: o.label }));
  settingsDraftSnapshot = draftSignature(settingsDraft);
  renderSettings();
}

// When a dropdown item (or toggle button) is renamed, every "Show this field"
// condition that listed the old wording, and any saved choice of it, is updated
// to the new wording, so editing the list never silently breaks them.
function applyOptionRenames(oldKey, newKey, renames) {
  if (!renames.length) return;
  const keys = [oldKey, newKey].map((k) => String(k).toLowerCase());
  const mapVal = (v) => { const r = renames.find((x) => normShowVal(x.from) === normShowVal(v)); return r ? r.to : v; };
  Object.keys(fieldConfigs).forEach((k) => {
    const sw = fieldConfigs[k] && fieldConfigs[k].showWhen;
    if (sw && sw.field && keys.includes(String(sw.field).toLowerCase()) && Array.isArray(sw.values)) sw.values = sw.values.map(mapVal);
  });
  Object.keys(values).forEach((tplId) => {
    const bag = values[tplId] || {};
    Object.keys(bag).forEach((f) => {
      if (!keys.includes(f.toLowerCase())) return;
      if (typeof bag[f] === "string") bag[f] = mapVal(bag[f]);
      else if (Array.isArray(bag[f])) bag[f] = bag[f].map((x) => (typeof x === "string" ? mapVal(x) : x));
    });
  });
  saveValuesDebounced();
}

// A comparable summary of everything editable in the draft (ignores ids and
// empty-vs-missing differences, so opening and closing an editor is never
// "a change").
function draftSignature(d) {
  return JSON.stringify({
    alwaysOn: (d.alwaysOn || []).slice().sort(),
    pasteImages: !!d.pasteImages,
    name: d.name || "",
    label: d.label || "",
    type: d.type || "",
    optional: !!d.optional,
    leadIn: d.leadIn || "",
    placeholder: d.placeholder || "",
    grouped: !!d.grouped,
    filterBy: d.filterBy || "",
    inlineManage: !!d.inlineManage,
    manualBox: !!d.manualBox,
    noDefault: !!d.noDefault,
    listOrder: d.listOrder || "",
    clean: d.clean || "",
    warn: d.warn !== false,
    options: (d.options || []).map((o) => ({ text: o.text || "", group: o.group || "", label: o.label || "", prefix: o.prefix || "", hint: o.hint || "" })),
    dependsOn: d.dependsOn || [],
    rules: d.rules || [],
    fallback: d.fallback || "",
    oldField: d.oldField || "",
    newField: d.newField || "",
    layout: d.layout || "",
    lineStart: d.lineStart === undefined ? "- " : d.lineStart,
    format: d.format || "", time: d.time || "", units: d.units || [], yesText: d.yesText === undefined ? "" : d.yesText, noText: d.noText || "",
    start: d.start === undefined ? "" : d.start, step: d.step === undefined ? "" : d.step, min: d.min === undefined ? "" : d.min,
    recent: !!d.recent,
    showWhen: d.showWhen || null,
    pasteImages: !!d.pasteImages,
    alwaysOn: Array.isArray(d.alwaysOn) ? d.alwaysOn.slice() : []
  });
}
function settingsEditorDirty() {
  return settingsEditKey !== null && !!settingsDraft && draftSignature(settingsDraft) !== settingsDraftSnapshot;
}

// ── Leaving an editor (Back button / Escape) ────────────────────────────
// Nothing changed: just go back. Something changed: ask first.
function requestLeaveEditor() {
  if (warnDraft) { requestLeaveWarnEditor(); return; }
  if (settingsEditKey === null) return;
  if (!settingsEditorDirty()) { settingsEditKey = null; settingsDraft = null; renderSettings(); return; }
  const name = settingsDraft && settingsDraft.name ? `{${settingsDraft.name}}` : "this placeholder";
  showUnsavedDialog({
    text: `Save your changes to ${name} before going back?`,
    keepLabel: "Keep editing",
    onSave: () => saveFieldDraft(), // if it can't be saved (e.g. no name) it stays open and says why
    onDiscard: () => { settingsEditKey = null; settingsDraft = null; renderSettings(); }
  });
}

let unsavedDialogEl = null;
function closeUnsavedDialog() {
  if (unsavedDialogEl) { unsavedDialogEl.remove(); unsavedDialogEl = null; }
}
// opts: { text, onSave, onDiscard, saveLabel?, discardLabel?, keepLabel? }.
// Shared by the placeholder editor, the template / table editor and Reorder.
function showUnsavedDialog(opts) {
  closeUnsavedDialog();
  const { text, onSave, onDiscard, saveLabel = "Save", discardLabel = "Discard", keepLabel = "Keep editing" } = opts;
  const el = document.createElement("div");
  el.className = "cnh-modal-backdrop";
  el.innerHTML = `<div class="cnh-modal" role="alertdialog" aria-modal="true" aria-labelledby="cnhModalTitle">
    <div class="cnh-modal-title" id="cnhModalTitle">Unsaved changes</div>
    <div class="cnh-modal-text">${escHtml(text)}</div>
    <div class="cnh-modal-actions">
      <button type="button" class="btn btn-ghost" data-modal="discard">${escHtml(discardLabel)}</button>
      <div class="footer-actions-right">
        <button type="button" class="btn" data-modal="keep">${escHtml(keepLabel)}</button>
        <button type="button" class="btn btn-primary" data-modal="save">${escHtml(saveLabel)}</button>
      </div>
    </div>
  </div>`;
  el.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-modal]");
    if (!btn) { if (e.target === el) closeUnsavedDialog(); return; } // click outside = keep editing
    closeUnsavedDialog();
    if (btn.dataset.modal === "save") onSave();
    else if (btn.dataset.modal === "discard") onDiscard();
  });
  document.body.appendChild(el);
  unsavedDialogEl = el;
  el.querySelector('[data-modal="save"]').focus();
}

// A plain two-button confirmation in the same style as the unsaved-changes
// prompt: title, one line of text, Cancel and a confirm button on the right.
// opts: { title, text, confirmLabel?, cancelLabel?, onConfirm }.
function showConfirmDialog(opts) {
  closeUnsavedDialog();
  const { title, text, confirmLabel = "OK", cancelLabel = "Cancel", onConfirm } = opts;
  const el = document.createElement("div");
  el.className = "cnh-modal-backdrop";
  el.innerHTML = `<div class="cnh-modal" role="alertdialog" aria-modal="true" aria-labelledby="cnhModalTitle">
    <div class="cnh-modal-title" id="cnhModalTitle">${escHtml(title)}</div>
    <div class="cnh-modal-text">${escHtml(text)}</div>
    <div class="cnh-modal-actions is-end">
      <button type="button" class="btn" data-modal="cancel">${escHtml(cancelLabel)}</button>
      <button type="button" class="btn btn-primary" data-modal="confirm">${escHtml(confirmLabel)}</button>
    </div>
  </div>`;
  el.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-modal]");
    if (!btn) { if (e.target === el) closeUnsavedDialog(); return; } // click outside = cancel
    closeUnsavedDialog();
    if (btn.dataset.modal === "confirm" && onConfirm) onConfirm();
  });
  document.body.appendChild(el);
  unsavedDialogEl = el;
  el.querySelector('[data-modal="confirm"]').focus();
}

// ── Escape = back ───────────────────────────────────────────────────────
// About → main screen. Settings list → main screen. Placeholder editor →
// the list. Template / table editor and Reorder → back to the normal view.
// Anything with unsaved changes asks first. With the prompt open, Escape
// means "keep editing".
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
  if (unsavedDialogEl) { e.preventDefault(); closeUnsavedDialog(); return; }
  if (typeof aboutOpen !== "undefined" && aboutOpen) { e.preventDefault(); closeAbout(); return; }
  if (settingsOpen) {
    e.preventDefault();
    if (settingsEditKey !== null || warnDraft) requestLeaveEditor();
    else closeSettings();
    return;
  }
  if (reorderMode) { e.preventDefault(); requestExitReorder(); return; }
  if (isEditing) { e.preventDefault(); requestExitEdit(); }
});

function toggleFieldKeys() {
  return allKnownFields().filter((k) => {
    const c = getFieldConfig(k);
    return c && c.type === "toggle";
  });
}

// ── "Show only when…" ───────────────────────────────────────────────────
function showWhenCandidates(d) {
  return allKnownFields().filter((k) => k !== (d.name || "").toLowerCase() && ["select", "multiselect", "toggle", "yesno", "snippet"].includes(fieldType(k)));
}
function showWhenValues(key) {
  const cfg = getFieldConfig(key);
  if (!cfg) return [];
  const list = cfg.type === "yesno" ? [cfg.yesText || "Yes", cfg.noText || "No"]
    : (cfg.type === "toggle" || cfg.type === "snippet") ? (cfg.options || []).map((o) => o.label) : (cfg.options || []).map((o) => o.text);
  return [...new Set(list.map((t) => String(t || "").trim()).filter(Boolean))];
}
function renderShowWhenHTML(d) {
  const sw = d.showWhen || null;
  const cands = showWhenCandidates(d);
  const keys = sw && sw.field && !cands.includes(sw.field) ? cands.concat([sw.field]) : cands;
  const fieldOpts = [`<option value="">Always show</option>`].concat(keys.map((k) =>
    `<option value="${escAttr(k)}"${sw && sw.field === k ? " selected" : ""}>Only when {${escHtml(k)}} is\u2026</option>`)).join("");
  let valuesHTML = "";
  if (sw && sw.field) {
    const vals = showWhenValues(sw.field);
    const picked = new Set((sw.values || []).map(normShowVal));
    // Keep a chosen value visible even if it has since been removed from the list.
    (sw.values || []).forEach((v) => { if (!vals.some((x) => normShowVal(x) === normShowVal(v))) vals.push(v); });
    valuesHTML = `<div class="set-hint" style="margin:6px 0 4px">Tick the value(s) that should show this field:</div>
      <div class="multi-check-list">${vals.map((v) => `<label class="multi-check-row"><input type="checkbox" data-showval="${escAttr(v)}"${picked.has(normShowVal(v)) ? " checked" : ""}> ${escHtml(v)}</label>`).join("") || '<div class="set-hint">That field has no options yet.</div>'}</div>`;
  }
  let alwaysHTML = "";
  if (sw && sw.field) {
    const tpls = tabOrder.filter((id) => tabType(id) === "template" && getPlaceholders(templates[id] || "").some((p) => p.toLowerCase() === String(d.name || "").toLowerCase()));
    const on = new Set(d.alwaysOn || []);
    alwaysHTML = tpls.length ? `<div class="set-hint" style="margin:10px 0 4px">Always show this field on these templates (the rule above is skipped there):</div>
      <div class="multi-check-list">${tpls.map((id) => `<label class="multi-check-row"><input type="checkbox" data-alwayson="${escAttr(id)}"${on.has(id) ? " checked" : ""}> ${escHtml(labelForTpl(id))}</label>`).join("")}</div>` : "";
  }
  return `<div class="set-block">
    <div class="set-block-title">Show this field</div>
    <div class="field" style="margin-bottom:0"><select id="setShowField">${fieldOpts}</select></div>
    ${valuesHTML}
    <div class="set-hint" style="margin-top:6px">While hidden, the field is left out of the form and its whole line is left out of the note.</div>
    ${alwaysHTML}
  </div>`;
}
function wireShowWhen() {
  const d = settingsDraft;
  const wrap = $("setShowWhen");
  const sel = $("setShowField");
  if (!d || !wrap || !sel) return;
  sel.addEventListener("change", () => {
    d.showWhen = sel.value ? { field: sel.value, values: [] } : undefined;
    if (!sel.value) d.alwaysOn = [];
    wrap.innerHTML = renderShowWhenHTML(d);
    wireShowWhen();
  });
  wrap.querySelectorAll("[data-showval]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (!d.showWhen) return;
      d.showWhen.values = Array.from(wrap.querySelectorAll("[data-showval]:checked")).map((x) => x.dataset.showval);
    });
  });
  wrap.querySelectorAll("[data-alwayson]").forEach((cb) => {
    cb.addEventListener("change", () => {
      d.alwaysOn = Array.from(wrap.querySelectorAll("[data-alwayson]:checked")).map((x) => x.dataset.alwayson);
    });
  });
}

function renderSettingsEditor() {
  const d = settingsDraft;
  const wrap = $("settingsBody");
  const pickerOpts = [];
  Object.keys(FIELD_TYPE_LABELS).forEach((t) => {
    pickerOpts.push([t, FIELD_TYPE_LABELS[t]]);
    if (t === "toggle") pickerOpts.push([TOGGLE_NONE_TYPE, TOGGLE_NONE_LABEL]);
  });
  const typeOptions = pickerOpts.map(([t, lbl]) =>
    `<option value="${t}"${t === pickerTypeOf(d) ? " selected" : ""}>${escHtml(lbl)}</option>`
  ).join("");

  const used = templatesUsingField(d.name);
  const isBuiltIn = hasDefaultConfig(d.name);

  wrap.innerHTML = `
    <div class="field">
      <label>Placeholder name</label>
      <input type="text" id="setName" value="${escAttr(d.name)}" maxlength="30">
      <div class="set-hint">Write it as <code>{${escHtml(d.name)}}</code> in a template. Renaming updates ${used.length ? escHtml(used.join(", ")) : "every template that uses it"} automatically.</div>
    </div>
    <div class="field">
      <label>Label shown in the form</label>
      <input type="text" id="setLabel" value="${escAttr(d.label || "")}" maxlength="40">
    </div>
    <div class="field">
      <label>Input type</label>
      <select id="setType">${typeOptions}</select>
    </div>
    <label class="set-check"><input type="checkbox" id="setOptional"${d.optional ? " checked" : ""}> Optional \u2014 hide this whole line from the note when left blank, instead of showing _____</label>
    <label class="set-check" id="setPasteImgWrap"${["image", "auto", "dns", "dnsDiff"].includes(d.type) ? ' style="display:none"' : ""}><input type="checkbox" id="setPasteImg"${d.pasteImages ? " checked" : ""}> Always show the picture strip under this box (screenshots can be pasted into any text box; they go at the bottom of the note)</label>
    <div class="field" id="setLeadInWrap"${["text", "textarea", "select", "prefixToggle"].includes(d.type) ? "" : ' style="display:none"'}>
      <label>Lead-in text <span class="set-hint" style="display:inline">(optional)</span></label>
      <input type="text" id="setLeadIn" value="${escAttr(d.leadIn || "")}" maxlength="40" placeholder="e.g.  . ABN: ">
      <div class="set-hint">Wording added right before this field's value in the note, only when the field is showing and filled. Put the placeholder straight after another one on the same line, e.g. <code>Issue: {issue}{${escHtml(d.name || "abn")}}</code>. Spaces at either end are kept.</div>
    </div>
    <div id="setShowWhen">${renderShowWhenHTML(d)}</div>
    <div class="set-block set-preview-block">
      <div class="set-block-title">Preview</div>
      <div class="set-preview" id="setPreview">${renderTypePreview(d)}</div>
    </div>
    <div id="setTypeExtras">${renderTypeExtras(d)}</div>
    <div class="set-block set-danger-zone">
      <div class="set-block-title">Delete placeholder</div>
      <div class="set-hint">Removes {${escHtml(d.name)}} from every template that uses it, and clears its settings and saved entries. Reset / Clear settings above only changes how it behaves and leaves it in your templates.</div>
      <button type="button" class="btn btn-ghost set-delete-btn" id="setDeleteBtn">Delete {${escHtml(d.name)}}\u2026</button>
    </div>
    <div class="footer-actions">
      <button class="btn btn-ghost" id="setResetBtn">${isBuiltIn ? "Reset to default" : "Clear settings"}</button>
      <div class="footer-actions-right">
        <button class="btn" id="setCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="setSaveBtn">Save</button>
      </div>
    </div>`;

  $("settingsTitle").textContent = `Editing {${d.name}}`;
  $("settingsBackBtn").textContent = "Back";

  $("setName").addEventListener("input", (e) => { d.name = e.target.value.trim().replace(/[{}\s]/g, "").toLowerCase(); });
  $("setLabel").addEventListener("input", (e) => { d.label = e.target.value; updatePreview(); });
  $("setType").addEventListener("change", (e) => {
    if (e.target.value === TOGGLE_NONE_TYPE) { d.type = "toggle"; d.noDefault = true; }
    else { d.type = e.target.value; d.noDefault = false; }
    const leadWrap = $("setLeadInWrap");
    const pasteWrap = $("setPasteImgWrap");
    if (pasteWrap) pasteWrap.style.display = ["image", "auto", "dns", "dnsDiff"].includes(d.type) ? "none" : "";
    if (leadWrap) leadWrap.style.display = ["text", "textarea", "select", "prefixToggle"].includes(d.type) ? "" : "none";
    seedOptionsForType(d);
    $("setTypeExtras").innerHTML = renderTypeExtras(d);
    wireTypeExtras();
    updatePreview();
  });
  $("setOptional").addEventListener("change", (e) => { d.optional = e.target.checked; });
  if ($("setPasteImg")) $("setPasteImg").addEventListener("change", (e) => { d.pasteImages = e.target.checked; });
  if ($("setLeadIn")) $("setLeadIn").addEventListener("input", (e) => { d.leadIn = e.target.value; });
  wireShowWhen();
  $("setCancelBtn").addEventListener("click", () => { settingsEditKey = null; settingsDraft = null; renderSettings(); });
  $("setSaveBtn").addEventListener("click", saveFieldDraft);
  $("setResetBtn").addEventListener("click", resetFieldDraft);
  $("setDeleteBtn").addEventListener("click", () => deleteFieldPlaceholder(settingsEditKey));
  // Delegated listener: catches every option/checkbox/rule edit inside
  // setTypeExtras (this div itself survives wireTypeExtras' internal
  // re-renders, so it only needs wiring once per editor screen) and keeps
  // the preview above in sync as the person types or toggles things.
  $("setTypeExtras").addEventListener("input", updatePreview);
  $("setTypeExtras").addEventListener("change", updatePreview);
  wireTypeExtras();
  updatePreview();
}

// Redraws the "Preview" box to match the current draft — same markup
// popup.js would render on the real fill-in form, just inert (disabled
// controls, first option pre-selected) so it can't be mistaken for a
// working field.
function updatePreview() {
  const el = $("setPreview");
  if (el) el.innerHTML = renderTypePreview(settingsDraft);
}

function renderTypePreview(d) {
  const label = escHtml(d.label || labelFor(d.name || "") || "Field");

  if (d.type === "toggle") {
    const opts = (d.options || []).length ? d.options : [{ label: "Option A" }, { label: "Option B" }];
    const toggleHTML = opts.map((o, i) =>
      `<button type="button" class="mini-toggle-btn${(i === 0 && !d.noDefault) ? " is-active" : ""}" disabled>${escHtml(o.label || o.text || `Option ${i + 1}`)}</button>`
    ).join("");
    if (d.manualBox) return `<div class="field"><label>${label}</label><div class="toggle-manual-row"><div class="mini-toggle">${toggleHTML}</div><textarea class="toggle-typed-box" rows="1" disabled placeholder="or type ${escAttr(String(d.label || "").toLowerCase())}\u2026"></textarea></div></div>`;
    return `<div class="field"><label>${label}</label><div class="mini-toggle">${toggleHTML}</div></div>`;
  }
  if (d.type === "prefixToggle") {
    const opts = (d.options || []).length ? d.options : [{ label: "Plain" }, { label: "Prefixed" }];
    const toggleHTML = opts.map((o, i) =>
      `<button type="button" class="mini-toggle-btn${i === 0 ? " is-active" : ""}" disabled>${escHtml(o.label || `Option ${i + 1}`)}</button>`
    ).join("");
    const hint = (opts[0] && opts[0].hint) || "example.com";
    return `<div class="field"><label>${label}</label><div class="mini-toggle">${toggleHTML}</div><input type="text" disabled placeholder="${escAttr(hint)}"></div>`;
  }
  if (d.type === "multiToggle") {
    const opts = (d.options || []).length ? d.options : [{ label: "Option A" }, { label: "Option B" }];
    const toggleHTML = opts.map((o, i) =>
      `<button type="button" class="mini-toggle-btn${i < 2 ? " is-active" : ""}" disabled>${escHtml(o.label || `Option ${i + 1}`)}</button>`
    ).join("");
    const rowsHTML = opts.slice(0, 2).map((o, i) =>
      `<div class="mt-row"><span class="mt-label">${escHtml(o.label || `Option ${i + 1}`)}</span><input type="text" disabled placeholder="${escAttr(o.hint || "")}"></div>`
    ).join("");
    const otherRow = d.manualBox ? `<div class="mt-row"><span class="mt-label">Other</span><textarea disabled rows="1" placeholder="or type another line\u2026"></textarea></div>` : "";
    return `<div class="field"><label>${label}</label><div class="mini-toggle mini-toggle-multi">${toggleHTML}</div><div class="mt-rows">${rowsHTML}${otherRow}</div></div>`;
  }
  if (d.type === "date" || d.type === "datetime") {
    return `<div class="field"><label>${label}</label><div class="inline-row"><input type="${d.type === "datetime" ? "datetime-local" : "date"}" disabled><button type="button" class="btn" disabled>${d.type === "datetime" ? "Now" : "Today"}</button></div></div>`;
  }
  if (d.type === "number") {
    const units = (d.units || []).filter(Boolean);
    return `<div class="field"><label>${label}</label><div class="inline-row"><input type="text" disabled placeholder="0">${units.length ? `<select disabled>${units.map((u) => `<option>${escHtml(u)}</option>`).join("")}</select>` : ""}</div></div>`;
  }
  if (d.type === "yesno") {
    return `<div class="field"><label class="yn-check"><input type="checkbox" disabled> <span>${label}</span></label></div>`;
  }
  if (d.type === "counter") {
    return `<div class="field"><label>${label}</label><div class="inline-row counter-row"><button type="button" class="btn" disabled>\u2212</button><input type="text" disabled placeholder="${escAttr(d.start === undefined || d.start === "" ? 0 : d.start)}"><button type="button" class="btn" disabled>+</button></div></div>`;
  }
  if (d.type === "snippet") {
    const opts = d.options || [];
    return `<div class="field"><label>${label}</label><select disabled><option>${escHtml((opts[0] && opts[0].label) || "Pick a snippet")}</option></select><div class="snippet-preview">${escHtml((opts[0] && opts[0].text) || "")}</div></div>`;
  }
  if (d.type === "image") {
    return `<div class="field"><label>${label}</label><div class="img-zone"><span>Click here and press <b>Ctrl+V</b> to paste a screenshot, drop one here, or</span><button type="button" class="btn img-pick-btn" disabled>Choose file</button></div></div>`;
  }
  if (d.type === "select" && d.grouped) {
    const cats = [...new Set((d.options || []).filter((o) => (o.text || "").trim()).map((o) => singleGroup(o.group) || DEFAULT_GROUP_NAME))];
    const catHTML = ["<option>Category…</option>"].concat((cats.length ? cats : ["Category 1"]).map((c) => `<option>${escHtml(c)}</option>`)).join("");
    const manageHTML = d.inlineManage ? `<button type="button" class="manage-options-toggle-btn" disabled>Manage list</button>` : "";
    return `<div class="field"><div class="field-label-row"><label>${label}</label>${manageHTML}</div><select class="cat-select" disabled>${catHTML}</select>${d.manualBox ? `<div class="select-manual-row"><select disabled><option>Pick a category first</option></select><input type="text" class="select-manual-box" disabled placeholder="or type ${escAttr(String(d.label || "").toLowerCase())}…"></div>` : `<select disabled><option>Pick a category first</option></select>`}</div>`;
  }
  if (d.type === "select") {
    const texts = (d.options || []).map((o) => (o.text || "").trim()).filter(Boolean);
    const shown = texts.length ? texts : ["Option 1", "Option 2"];
    const optionsHTML = ["<option>—</option>"].concat(shown.map((t) => `<option>${escHtml(t)}</option>`)).join("");
    const manageHTML = d.inlineManage ? `<button type="button" class="manage-options-toggle-btn" disabled>Manage list</button>` : "";
    return `<div class="field"><div class="field-label-row"><label>${label}</label>${manageHTML}</div>${d.manualBox ? `<div class="select-manual-row"><select disabled>${optionsHTML}</select><input type="text" class="select-manual-box" disabled placeholder="or type ${escAttr(String(d.label || "").toLowerCase())}…"></div>` : `<select disabled>${optionsHTML}</select>`}</div>`;
  }
  if (d.type === "multiselect") {
    const texts = (d.options || []).map((o) => (o.text || "").trim()).filter(Boolean);
    const shown = texts.length ? texts : ["Option 1", "Option 2"];
    const itemsHTML = shown.map((t) => `<label class="multi-check-row"><input type="checkbox" disabled> ${escHtml(t)}</label>`).join("");
    const manageHTML = d.inlineManage ? `<button type="button" class="manage-options-toggle-btn" disabled>Manage list</button>` : "";
    const otherBox = d.manualBox ? `<div class="multi-other-row"><textarea class="select-custom-input multi-other-box" rows="2" disabled placeholder="or type another ${escAttr(String(d.label || "").toLowerCase())} (one per line)\u2026"></textarea></div>` : "";
    return `<div class="field"><div class="field-label-row"><label>${label}</label>${manageHTML}</div><div class="multi-check-list">${itemsHTML}</div>${otherBox}</div>`;
  }
  if (d.type === "auto") {
    return `<div class="field"><label>${label} <span class="auto-badge">Auto</span></label><input type="text" value="(calculated automatically)" disabled></div>`;
  }
  if (d.type === "dns") {
    return `<div class="field dns-field"><div class="field-label-row"><label>${label}</label><button type="button" class="manage-options-toggle-btn" disabled>Paste records</button></div>
      <div class="dns-rows"><div class="dns-row">
        <select disabled><option>A</option></select><input type="text" disabled placeholder="Host (@, www)"><input type="text" disabled placeholder="TTL"><span></span>
        <input type="text" class="dns-value" disabled placeholder="${escAttr(DNS_VALUE_HINTS.A)}">
      </div></div><button type="button" class="btn dns-add-btn" disabled>+ Add record</button></div>`;
  }
  if (d.type === "dnsDiff") {
    return `<div class="field"><label>${label} <span class="auto-badge">Auto</span></label><div class="dns-diff-box">
      <div class="dns-diff-line dns-diff-changed"><span class="dns-diff-tag">Changed</span>A @ 203.0.113.10 -> 198.51.100.7</div>
      <div class="dns-diff-line dns-diff-added"><span class="dns-diff-tag">Added</span>TXT @ v=spf1 ... ~all</div>
      <div class="dns-diff-line dns-diff-removed"><span class="dns-diff-tag">Removed</span>CNAME www old.example.com</div></div></div>`;
  }
  if (d.type === "textarea") {
    return `<div class="field"><label>${label}</label><textarea disabled rows="2" placeholder="${escAttr(d.placeholder || "Typed text goes here")}"></textarea></div>`;
  }
  return `<div class="field"><label>${label}</label><input type="text" disabled placeholder="${escAttr(d.placeholder || "Typed text goes here")}"></div>`;
}

// Gives a newly-switched type something sensible to start from instead of
// an empty options list.
function seedOptionsForType(d) {
  if ((d.type === "select" || d.type === "multiselect") && !(d.options || []).length) d.options = [{ text: "Option 1" }];
  if ((d.type === "toggle" || d.type === "prefixToggle") && (d.options || []).length < 2) {
    d.options = d.type === "toggle"
      ? [{ id: "a", label: "Option A", text: "Option A" }, { id: "b", label: "Option B", text: "Option B" }]
      : [{ id: "plain", label: "Plain", prefix: "", hint: "" }, { id: "prefixed", label: "Prefixed", prefix: "mail.", hint: "" }];
  }
  if ((d.type === "date" || d.type === "datetime") && !d.format) d.format = "d MMM yyyy";
  if (d.type === "datetime" && !d.time) d.time = "12h";
  if (d.type === "number" && !Array.isArray(d.units)) d.units = [];
  if (d.type === "yesno" && d.yesText === undefined) d.yesText = "Yes";
  if (d.type === "counter") { if (d.start === undefined) d.start = 0; if (d.step === undefined) d.step = 1; if (d.min === undefined) d.min = 0; }
  if (d.type === "snippet" && (d.options || []).length < 1) {
    d.options = [{ id: "a", label: "Snippet A", text: "First canned reply." }, { id: "b", label: "Snippet B", text: "Second canned reply." }];
  }
  if (d.type === "multiToggle" && (d.options || []).length < 1) {
    d.options = [{ id: "a", label: "Option A", prefix: "option a: ", hint: "" }, { id: "b", label: "Option B", prefix: "option b: ", hint: "" }];
  }
  if (d.type === "auto") {
    if (!Array.isArray(d.dependsOn)) d.dependsOn = [];
    if (!Array.isArray(d.rules)) d.rules = [];
  }
  if (d.type === "dnsDiff") {
    const dnsKeys = allKnownFields().filter((k) => k !== d.name && fieldType(k) === "dns");
    if (!d.oldField) d.oldField = dnsKeys.includes("olddns") ? "olddns" : (dnsKeys[0] || "");
    if (!d.newField) d.newField = dnsKeys.includes("newdns") ? "newdns" : (dnsKeys[1] || dnsKeys[0] || "");
  }
}

function renderTypeExtras(d) {
  if (d.type === "select" || d.type === "multiselect") return renderSelectOptions(d);
  if (d.type === "toggle") return renderToggleOptions(d);
  if (d.type === "snippet") return renderSnippetOptions(d);
  if (d.type === "date" || d.type === "datetime") return renderDateOptions(d);
  if (d.type === "number") return renderNumberOptions(d);
  if (d.type === "yesno") return renderYesNoOptions(d);
  if (d.type === "counter") return renderCounterOptions(d);
  if (d.type === "prefixToggle") return renderPrefixOptions(d);
  if (d.type === "multiToggle") return renderMultiToggleOptions(d);
  if (d.type === "image") {
    return `<div class="set-block"><div class="set-hint">Put <code>{${escHtml(d.name || "screenshot")}}</code> where the picture should go, e.g. <code>Findings: {findings}</code> then <code>{${escHtml(d.name || "screenshot")}}</code> on the next line. Paste (Ctrl+V), drop or choose up to 6 pictures on the form. In the preview each one shows as <code>[Image: ${escHtml(d.label || labelFor(d.name || "image"))}]</code>; <b>Copy</b> then puts the text <i>and</i> the pictures on the clipboard so they paste into Teams in place. If nothing is added, the line is simply left out of the note.</div></div>`;
  }
  if (d.type === "auto") return renderAutoRules(d);
  if (d.type === "dns") {
    return `<div class="set-block">
      <div class="set-hint">Shows a small table of DNS records: type, host, value and TTL for each. <b>Paste records</b> on the form fills it in from a zone file, dig output or a table copied from a DNS panel. Each record goes into the note on its own line, like <code>A @ 203.0.113.10 (TTL 3600)</code>. Rows with no value are left out.</div>
      <div class="field"><label style="text-transform:none">How records are written in the note</label>
        <select id="setDnsLayout">
          <option value="list"${d.layout === "detailed" ? "" : " selected"}>List \u2014 one line per record</option>
          <option value="detailed"${d.layout === "detailed" ? " selected" : ""}>Detailed \u2014 type, host and value on separate lines</option>
        </select>
        <div class="set-hint" style="margin-top:4px">Detailed looks like <code>type A record:</code> / <code>host: order.example.com</code> / <code>value: 192.168.1.1</code>, with a blank line between records. Add as many records as you need with <b>+ Add record</b>.</div>
      </div>
      <div class="set-hint" style="margin:0">To compare two of these fields, add a <b>DNS change summary</b> placeholder and point it at them.</div>
    </div>`;
  }
  if (d.type === "dnsDiff") {
    const dnsKeys = allKnownFields().filter((k) => k !== d.name && fieldType(k) === "dns");
    const pick = (id, current) => {
      const keys = current && !dnsKeys.includes(current) ? dnsKeys.concat([current]) : dnsKeys;
      return `<select id="${id}">${keys.map((k) => `<option value="${escAttr(k)}"${k === current ? " selected" : ""}>{${escHtml(k)}}</option>`).join("") || '<option value="">No DNS record fields yet</option>'}</select>`;
    };
    return `<div class="set-block">
      <div class="set-hint">No input. It compares two DNS record fields and lists what was <b>added</b>, <b>removed</b> or <b>changed</b> (plus TTL changes and how many records stayed the same). With nothing entered in either field, the line stays out of the note.</div>
      <div class="field"><label>Old records</label>${pick("setDnsOld", d.oldField)}</div>
      <div class="field" style="margin-bottom:0"><label>New records</label>${pick("setDnsNew", d.newField)}</div>
    </div>`;
  }
  if (d.type === "textarea") {
    return `<div class="set-block">
      <div class="set-hint">Shows a multi-line box. Whatever is typed goes into the note as-is.</div>
      <div class="field"><label>Placeholder hint (shown greyed-out when empty)</label><input type="text" id="setPlaceholder" value="${escAttr(d.placeholder || "")}" placeholder="e.g. example text"></div>
      ${warnCheckHTML(d)}
    </div>`;
  }
  return `<div class="set-block">
    <div class="set-hint">Shows a single-line box. Whatever is typed goes into the note as-is${d.clean === "domain" ? ", except that a pasted URL is tidied" : d.clean === "caseId" ? ", except that a case number is written as I-<digits>" : ""}.</div>
    <div class="field"><label>Placeholder hint (shown greyed-out when empty)</label><input type="text" id="setPlaceholder" value="${escAttr(d.placeholder || "")}" placeholder="e.g. example text"></div>
    ${cleanCheckHTML(d)}
  </div>`;
}

function warnCheckHTML(d) {
  return `<label class="set-check"><input type="checkbox" id="setWarn"${d.warn !== false ? " checked" : ""}> Show soft warnings under this field when the value looks wrong (never blocks copying). Edit the warnings themselves under Settings \u2192 Soft warnings.</label>`;
}

// Shared by the single-line and toggle+text editors. The case-ID format needs
// a plain text field, so a toggle+text field only offers the URL tidy.
function cleanCheckHTML(d) {
  const opt = (v, label) => `<option value="${v}"${(d.clean || "") === v ? " selected" : ""}>${label}</option>`;
  return `<div class="field" style="margin-top:8px"><label style="text-transform:none">Clean what's typed or pasted</label>
    <select id="setClean">
      ${opt("", "Leave as typed")}
      ${opt("domain", "URL \u2192 domain (drops https://, www., path and trailing slash; lowercases)")}
      ${d.type === "text" ? opt("caseId", "Case ID \u2192 I-number (26838210, I-26838210 and #26838210 all give I-26838210)") : ""}
      ${d.type === "text" ? opt("email", "Email (trims, drops mailto: and <brackets>, lowercases; hints at typos like gmial.com)") : ""}
      ${d.type === "text" ? opt("url", "Link (adds https://, drops tracking bits like utm_source and fbclid)") : ""}
    </select>
    <div class="set-hint" style="margin-top:4px">Leading and trailing spaces are always trimmed. Anything that doesn't look like what the option expects is left exactly as typed.</div>
    ${warnCheckHTML(d)}
    ${d.type === "text" ? `<label class="set-check"><input type="checkbox" id="setRecent"${d.recent ? " checked" : ""}> Show quick-fill chips under the box with what you typed here on your recent logged cases (needs the template ticked under Log to Cases)</label>` : ""}</div>`;
}

// A value box that is a one-line input until the value has a line break, then a
// multi-line box (Shift+Enter adds the break; see wireTypeExtras).
function mlBox(attrs, value, placeholder) {
  const v = String(value || "");
  const ph = escAttr(placeholder || "");
  return v.includes("\n")
    ? `<textarea ${attrs} rows="${Math.min(6, v.split("\n").length)}" placeholder="${ph}">${escHtml(v)}</textarea>`
    : `<input type="text" ${attrs} value="${escAttr(v)}" placeholder="${ph}">`;
}

function optRow(i, inner, canRemove) {
  return `<div class="set-opt-row">${inner}${canRemove ? `<button type="button" class="ref-remove-btn" data-opt-remove="${i}" title="Remove">✕</button>` : ""}</div>`;
}

function renderSelectOptions(d) {
  const isMulti = d.type === "multiselect";
  const grouped = !isMulti && !!d.grouped;
  const followsKey = isMulti && d.filterBy && isGroupedField(d.filterBy) ? d.filterBy : "";
  const showGroup = grouped || !!followsKey;
  const cats = followsKey
    ? getOptionGroups(followsKey).map((g) => g.group)
    : [...new Set((d.options || []).map((o) => singleGroup(o.group)).filter(Boolean))];
  const rows = (d.options || []).map((o, i) => {
    const textInput = mlBox(`data-opt="${i}" data-opt-key="text"`, o.text, "Option text");
    if (followsKey) {
      // Checklist item that follows a category: tick the categories it shows for.
      const ticked = splitGroups(o.group);
      const names = cats.concat(ticked.filter((t) => !cats.includes(t))); // keep unknown names visible so they can be untick-fixed
      const chips = names.map((c) =>
        `<label class="chip${cats.includes(c) ? "" : " chip-unknown"}" title="${cats.includes(c) ? "" : "This category no longer exists in the list it follows"}"><input type="checkbox" data-opt-chip="${i}" value="${escAttr(c)}"${ticked.includes(c) ? " checked" : ""}> ${escHtml(c)}</label>`
      ).join("");
      return `<div class="set-opt-block">${optRow(i, textInput, true)}<div class="set-chips"><span class="set-chips-label">Show for</span>${chips || '<span class="set-hint">No categories yet</span>'}</div></div>`;
    }
    if (grouped) {
      const catSel = `<select class="set-opt-group" data-opt-cat="${i}">
        <option value="">Category\u2026</option>
        ${cats.map((c) => `<option value="${escAttr(c)}"${c === singleGroup(o.group) ? " selected" : ""}>${escHtml(c)}</option>`).join("")}
        <option value="__new__">\uFF0B New category\u2026</option>
      </select>`;
      return optRow(i, catSel + textInput, true);
    }
    return optRow(i, textInput, true);
  }).join("");
  const filterKeys = isMulti ? allKnownFields().filter((k) => k !== d.name && isGroupedField(k)) : [];
  const groupToggle = isMulti
    ? (filterKeys.length
        ? `<div class="field" style="margin-top:8px"><label style="text-transform:none">Only show items for the category picked in</label>
      <select id="setFilterBy"><option value="">(show every item, always)</option>${filterKeys.map((k) => `<option value="${escAttr(k)}"${k === (d.filterBy || "").toLowerCase() ? " selected" : ""}>{${escHtml(k)}}</option>`).join("")}</select>
      <div class="set-hint" style="margin-top:4px">Then tick the categories each item shows for. An item with none ticked shows for every category. Categories come from {${escHtml(filterKeys[0])}}, so if you rename one there, re-tick it here (a category that no longer exists shows in red).</div></div>`
        : "")
    : `<label class="set-check"><input type="checkbox" id="setGrouped"${d.grouped ? " checked" : ""}> Group into categories \u2014 pick a category first, then the specific option</label>`;
  return `<div class="set-block">
    <div class="set-block-title">${isMulti ? "Checklist items" : "Dropdown options"}</div>
    <div class="set-hint">${isMulti ? "Each item is a checkbox on the fill-in form; every one ticked gets written into the note as its own line." : "Each option is both what you pick and what lands in the note." + (grouped ? " The category is only used to narrow down the list — it never goes into the note." : "")}</div>
    ${rows || '<div class="set-hint">No options yet.</div>'}
    <button type="button" class="btn btn-ghost set-add-opt" id="addOptBtn">+ Option</button>
    ${groupToggle}
    <div class="field" style="margin-top:8px"><label style="text-transform:none">List order</label>
      <select id="setListOrder">
        <option value=""${!d.listOrder ? " selected" : ""}>Manual (new items go at the bottom)</option>
        <option value="numdesc"${d.listOrder === "numdesc" ? " selected" : ""}>Newest first \u2014 highest number on top (e.g. VOC-16374 above VOC-16326)</option>
        <option value="newtop"${d.listOrder === "newtop" ? " selected" : ""}>New items go at the top</option>
      </select></div>
    <label class="set-check"><input type="checkbox" id="setInlineManage"${d.inlineManage ? " checked" : ""}> Show a "Manage list" link on the fill-in form too</label>
    <label class="set-check"><input type="checkbox" id="setManualBox"${d.manualBox ? " checked" : ""}> ${d.type === "select" ? "Show a text box next to the dropdown for typing an option that isn't in the list" : "Show a text box under the checklist for typing an item that isn't in the list (one per line, each goes into the note as its own line)"}</label>
  </div>`;
}

function renderToggleOptions(d) {
  const rows = (d.options || []).map((o, i) =>
    optRow(i, `<input type="text" data-opt="${i}" data-opt-key="label" value="${escAttr(o.label || "")}" placeholder="Button">
      ${mlBox(`data-opt="${i}" data-opt-key="text"`, o.text, "Text in note")}`, (d.options || []).length > 1)
  ).join("");
  return `<div class="set-block">
    <div class="set-block-title">Toggle options</div>
    <div class="set-hint">Left box is the button label, right box is what gets written into the note.</div>
    ${rows}
    <button type="button" class="btn btn-ghost set-add-opt" id="addOptBtn">+ Option</button>
    ${d.noDefault ? `<div class="set-hint">No button is lit by default. Click one to turn it on, click it again to turn it off. Nothing is written while none is on (tick Optional above to drop the whole line).</div>` : ""}
    <label class="set-check"><input type="checkbox" id="setManualBox"${d.manualBox ? " checked" : ""}> Show a text box next to the buttons for typing a value that isn't one of them (typing replaces the button choice; clicking a button clears it)</label>
  </div>`;
}

function renderPrefixOptions(d) {
  const rows = (d.options || []).map((o, i) =>
    optRow(i, `<input type="text" data-opt="${i}" data-opt-key="label" value="${escAttr(o.label || "")}" placeholder="Button">
      ${mlBox(`data-opt="${i}" data-opt-key="prefix"`, o.prefix, "Prefix")}
      <input type="text" data-opt="${i}" data-opt-key="hint" value="${escAttr(o.hint || "")}" placeholder="Example">`, (d.options || []).length > 1)
  ).join("");
  return `<div class="set-block">
    <div class="set-block-title">Toggle + text options</div>
    <div class="set-hint">You type a value, and the picked option's prefix is stuck on the front of it.</div>
    ${rows}
    <button type="button" class="btn btn-ghost set-add-opt" id="addOptBtn">+ Option</button>
    ${cleanCheckHTML(d)}
  </div>`;
}

// Toggle + text (select multiple): every button can be on at once; each one
// that's on gets its own text box and its own line in the note.
function renderSnippetOptions(d) {
  const rows = (d.options || []).map((o, i) =>
    optRow(i, `<input type="text" data-opt="${i}" data-opt-key="label" value="${escAttr(o.label || "")}" placeholder="Snippet name">
      ${mlBox(`data-opt="${i}" data-opt-key="text"`, o.text, "Text that goes into the note")}`, (d.options || []).length > 1)
  ).join("");
  return `<div class="set-block">
    <div class="set-block-title">Snippets</div>
    <div class="set-hint">Left box is the name shown in the dropdown, right box is the block of text written into the note (Shift+Enter adds a new line). A snippet can mention other placeholders from the same template, e.g. <code>Hi {name}, ...</code>, and they are filled in from that form.</div>
    ${rows}
    <button type="button" class="btn btn-ghost set-add-opt" id="addOptBtn">+ Snippet</button>
  </div>`;
}
function renderDateOptions(d) {
  const fmts = Object.keys(DATE_FORMATS).map((k) => `<option value="${escAttr(k)}"${(d.format || "d MMM yyyy") === k ? " selected" : ""}>${escHtml(DATE_FORMATS[k])}</option>`).join("");
  return `<div class="set-block">
    <div class="set-block-title">${d.type === "datetime" ? "Date and time" : "Date"} format</div>
    <div class="set-hint">Pick the date on the form (the ${d.type === "datetime" ? "Now" : "Today"} button fills the current ${d.type === "datetime" ? "date and time" : "date"}). It is written into the note in this format; 19 Oct 2026 is the example.</div>
    <div class="field"><label style="text-transform:none">Date format</label><select id="setDateFormat">${fmts}</select></div>
    ${d.type === "datetime" ? `<div class="field"><label style="text-transform:none">Time format</label><select id="setTimeFormat"><option value="12h"${d.time !== "24h" ? " selected" : ""}>12-hour (3:45 PM)</option><option value="24h"${d.time === "24h" ? " selected" : ""}>24-hour (15:45)</option></select></div>` : ""}
  </div>`;
}
function renderNumberOptions(d) {
  return `<div class="set-block">
    <div class="set-block-title">Units</div>
    <div class="set-hint">Optional. Separate with commas, e.g. <code>seconds, minutes, hours, days</code>. The first one is the default. Leave empty for a plain number. A unit starting with % or \u00b0 is written right after the number; others get a space.</div>
    <input type="text" id="setUnits" value="${escAttr((d.units || []).join(", "))}" placeholder="seconds, minutes, hours">
  </div>`;
}
function renderYesNoOptions(d) {
  return `<div class="set-block">
    <div class="set-block-title">Tick box text</div>
    <div class="set-hint">What the placeholder writes when the box is ticked, and when it isn't. Leave the unticked text empty and the whole line disappears from the note, like an optional field (e.g. <code>Customer verified: {verified}</code>).</div>
    <div class="field"><label style="text-transform:none">When ticked</label><input type="text" id="setYesText" value="${escAttr(d.yesText === undefined ? "Yes" : d.yesText)}" placeholder="Yes"></div>
    <div class="field"><label style="text-transform:none">When not ticked</label><input type="text" id="setNoText" value="${escAttr(d.noText || "")}" placeholder="(leave the line out)"></div>
  </div>`;
}
function renderCounterOptions(d) {
  const v = (x) => escAttr(x === undefined ? "" : x);
  return `<div class="set-block">
    <div class="set-block-title">Counter</div>
    <div class="set-hint">The + and \u2212 buttons change the number by the step. You can also type a number. Until you press a button or type, the line shows _____ (or is left out if the field is Optional).</div>
    <div class="field"><label style="text-transform:none">First press starts from</label><input type="text" id="setCountStart" value="${v(d.start)}" placeholder="0"></div>
    <div class="field"><label style="text-transform:none">Step</label><input type="text" id="setCountStep" value="${v(d.step)}" placeholder="1"></div>
    <div class="field"><label style="text-transform:none">Lowest allowed (blank = no limit)</label><input type="text" id="setCountMin" value="${v(d.min)}" placeholder="0"></div>
  </div>`;
}

function renderMultiToggleOptions(d) {
  const rows = (d.options || []).map((o, i) =>
    optRow(i, `<input type="text" data-opt="${i}" data-opt-key="label" value="${escAttr(o.label || "")}" placeholder="Button">
      ${mlBox(`data-opt="${i}" data-opt-key="prefix"`, o.prefix, "Written as (e.g. server: )")}
      <input type="text" data-opt="${i}" data-opt-key="hint" value="${escAttr(o.hint || "")}" placeholder="Example">`, (d.options || []).length > 1)
  ).join("");
  const start = d.lineStart === undefined ? "- " : d.lineStart;
  return `<div class="set-block">
    <div class="set-block-title">Toggle + text (select multiple) options</div>
    <div class="set-hint">Any number of buttons can be switched on. Each one that's on gets its own text box, stacked under the buttons, and goes into the note on its own line as <b>line start + "Written as" + what you typed</b>, e.g. <code>- server: 123456asdf-asf</code>. A button left empty adds no line. Include the colon and space in "Written as".</div>
    ${rows}
    <button type="button" class="btn btn-ghost set-add-opt" id="addOptBtn">+ Option</button>
    <div class="field" style="margin-top:8px"><label style="text-transform:none">Start of every line</label>
      <input type="text" id="setLineStart" value="${escAttr(start)}" maxlength="10" placeholder="(nothing)">
      <div class="set-hint" style="margin-top:4px">Default is a dash and a space (<code>- </code>). Spaces are kept; clear the box for no marker.</div>
    </div>
    <label class="set-check"><input type="checkbox" id="setManualBox"${d.manualBox ? " checked" : ""}> Show an extra \u201cOther\u201d box for typing a line that isn't one of the buttons (one per line, written with the line start)</label>
  </div>`;
}

// Auto fields: value is looked up from the current choice of one or more
// toggle fields (this is how incomingPort/outgoingPort work).
function renderAutoRules(d) {
  const toggles = toggleFieldKeys();
  if (!toggles.length) {
    return `<div class="set-block"><div class="set-hint">Auto fields calculate their value from toggle fields, but there aren't any toggle placeholders yet. Make one first (e.g. set <code>{security}</code> to "Toggle buttons").</div></div>`;
  }
  const depsHTML = toggles.map((t) =>
    `<label class="set-check"><input type="checkbox" data-dep="${escAttr(t)}"${(d.dependsOn || []).includes(t) ? " checked" : ""}> {${escHtml(t)}}</label>`
  ).join("");

  const deps = (d.dependsOn || []).filter((t) => toggles.includes(t));
  const rulesHTML = (d.rules || []).map((r, i) => {
    const pickers = deps.map((dep) => {
      const opts = normalizeOptions(getFieldConfig(dep) || { options: [] });
      const chosen = (r.when || {})[dep];
      return `<select data-rule="${i}" data-rule-dep="${escAttr(dep)}">` +
        opts.map((o) => `<option value="${escAttr(o.id)}"${o.id === chosen ? " selected" : ""}>${escHtml(o.label || o.text || o.id)}</option>`).join("") +
        `</select>`;
    }).join("");
    return `<div class="set-opt-row">${pickers}
      ${mlBox(`data-rule="${i}" data-rule-value="1"`, r.value, "Value")}
      <button type="button" class="ref-remove-btn" data-rule-remove="${i}" title="Remove">✕</button>
    </div>`;
  }).join("");

  return `<div class="set-block">
    <div class="set-block-title">Depends on</div>
    <div class="set-checks">${depsHTML}</div>
    <div class="set-block-title">Rules</div>
    <div class="set-hint">First matching rule wins. The last box is what gets written into the note.</div>
    ${deps.length ? (rulesHTML || '<div class="set-hint">No rules yet.</div>') : '<div class="set-hint">Tick at least one field above.</div>'}
    ${deps.length ? '<button type="button" class="btn btn-ghost set-add-opt" id="addRuleBtn">+ Rule</button>' : ""}
    <div class="field" style="margin-top:8px"><label>If nothing matches</label><input type="text" id="setFallback" value="${escAttr(d.fallback || "")}" placeholder="(blank)"></div>
  </div>`;
}

function wireTypeExtras() {
  const d = settingsDraft;
  const wrap = $("setTypeExtras");
  const layoutSel = wrap.querySelector("#setDnsLayout");
  if (layoutSel) layoutSel.addEventListener("change", (e) => { d.layout = e.target.value; });
  const rerender = () => { wrap.innerHTML = renderTypeExtras(d); wireTypeExtras(); updatePreview(); };

  wrap.querySelectorAll("[data-opt]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const i = Number(e.target.dataset.opt);
      d.options[i][e.target.dataset.optKey] = e.target.value;
      if (e.target.dataset.optKey === "label" && !hasDefaultConfig(d.name)) d.options[i].id = optionId(d.options[i], i);
    });
  });
  // Shift+Enter in a "what gets written into the note" box adds a new line: the
  // box becomes a multi-line one with the caret on the new line.
  const mlSelector = '[data-opt][data-opt-key="text"], [data-opt][data-opt-key="prefix"], [data-rule-value]';
  wrap.querySelectorAll(mlSelector).forEach((box) => {
    // Pasting text with line breaks keeps them (a single-line box would flatten it) - v1.20.3.
    if (box.tagName === "INPUT") box.addEventListener("paste", (e) => {
      const raw = e.clipboardData && e.clipboardData.getData("text/plain");
      if (!raw || !/[\r\n]/.test(raw)) return;
      e.preventDefault();
      const text = raw.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
      const cur = box.value;
      const a = box.selectionStart == null ? cur.length : box.selectionStart;
      const z = box.selectionEnd == null ? cur.length : box.selectionEnd;
      const next = cur.slice(0, a) + text + cur.slice(z);
      let sel;
      if (box.dataset.rule !== undefined && box.dataset.ruleValue) {
        d.rules[Number(box.dataset.rule)].value = next;
        sel = `[data-rule="${box.dataset.rule}"][data-rule-value]`;
      } else {
        d.options[Number(box.dataset.opt)][box.dataset.optKey] = next;
        sel = `[data-opt="${box.dataset.opt}"][data-opt-key="${box.dataset.optKey}"]`;
      }
      rerender();
      const nb = wrap.querySelector(sel);
      if (nb) { nb.focus(); try { nb.setSelectionRange(a + text.length, a + text.length); } catch (err) {} }
    });
    box.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      e.preventDefault();
      const cur = box.value;
      const a = box.selectionStart == null ? cur.length : box.selectionStart;
      const z = box.selectionEnd == null ? cur.length : box.selectionEnd;
      const next = cur.slice(0, a) + "\n" + cur.slice(z);
      let sel;
      if (box.dataset.rule !== undefined && box.dataset.ruleValue) {
        d.rules[Number(box.dataset.rule)].value = next;
        sel = `[data-rule="${box.dataset.rule}"][data-rule-value]`;
      } else {
        d.options[Number(box.dataset.opt)][box.dataset.optKey] = next;
        sel = `[data-opt="${box.dataset.opt}"][data-opt-key="${box.dataset.optKey}"]`;
      }
      rerender();
      const nb = wrap.querySelector(sel);
      if (nb) { nb.focus(); try { nb.setSelectionRange(a + 1, a + 1); } catch (err) {} }
    });
  });
  wrap.querySelectorAll("[data-opt-remove]").forEach((btn) => {
    btn.addEventListener("click", () => { d.options.splice(Number(btn.dataset.optRemove), 1); rerender(); });
  });
  const addOpt = $("addOptBtn");
  if (addOpt) addOpt.addEventListener("click", () => {
    const n = d.options.length + 1;
    if (d.type === "select") {
      // In a grouped list a new row starts in the same category as the row above it.
      const prev = d.options[d.options.length - 1];
      d.options.push(d.grouped ? { text: `Option ${n}`, group: singleGroup(prev && prev.group) } : { text: `Option ${n}` });
    }
    else if (d.type === "multiselect") {
      const prev = d.options[d.options.length - 1];
      d.options.push(d.filterBy ? { text: `Option ${n}`, group: splitGroups(prev && prev.group) } : { text: `Option ${n}` });
    }
    else {
      // a fresh id that no other option on this field already has
      const taken = new Set(d.options.map((o) => o.id));
      let k = n;
      while (taken.has(`opt${k}`)) k++;
      if (d.type === "toggle") d.options.push({ id: `opt${k}`, label: `Option ${n}`, text: `Option ${n}` });
      else if (d.type === "snippet") d.options.push({ id: `opt${k}`, label: `Snippet ${n}`, text: "" });
      else d.options.push({ id: `opt${k}`, label: `Option ${n}`, prefix: "", hint: "" });
    }
    rerender();
  });
  // Category dropdown on a row (grouped dropdowns). "New category…" swaps the
  // dropdown for a text box; the new name is then offered on every other row.
  wrap.querySelectorAll("select[data-opt-cat]").forEach((sel) => {
    const i = Number(sel.dataset.optCat);
    sel.addEventListener("change", () => {
      if (sel.value !== "__new__") { d.options[i].group = sel.value; return; }
      const box = document.createElement("input");
      box.type = "text";
      box.className = "set-opt-group";
      box.placeholder = "New category name";
      box.maxLength = 40;
      box.addEventListener("input", () => { d.options[i].group = box.value; });
      box.addEventListener("change", () => {
        const name = box.value.trim();
        if (!name) return;
        wrap.querySelectorAll("select[data-opt-cat]").forEach((s) => {
          if (![...s.options].some((o) => o.value === name)) {
            const opt = document.createElement("option");
            opt.value = opt.textContent = name;
            s.insertBefore(opt, s.querySelector('option[value="__new__"]'));
          }
        });
      });
      sel.replaceWith(box);
      d.options[i].group = "";
      box.focus();
    });
  });
  wrap.querySelectorAll("input[data-opt-chip]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const i = Number(cb.dataset.optChip);
      const all = [...wrap.querySelectorAll(`input[data-opt-chip="${i}"]`)];
      d.options[i].group = all.filter((x) => x.checked).map((x) => x.value);
    });
  });
  const flt = $("setFilterBy");
  if (flt) flt.addEventListener("change", (e) => { d.filterBy = e.target.value; rerender(); });
  const grp = $("setGrouped");
  if (grp) grp.addEventListener("change", (e) => { d.grouped = e.target.checked; rerender(); });
  const lord = $("setListOrder");
  if (lord) lord.addEventListener("change", (e) => { d.listOrder = e.target.value; });
  const inline = $("setInlineManage");
  if (inline) inline.addEventListener("change", (e) => { d.inlineManage = e.target.checked; });
  const mbox = $("setManualBox");
  if (mbox) mbox.addEventListener("change", (e) => { d.manualBox = e.target.checked; rerender(); });
  const bindVal = (id, fn) => { const el = $(id); if (el) { const h = (e) => fn(e.target.value); el.addEventListener("input", h); el.addEventListener("change", h); } };
  bindVal("setDateFormat", (v) => { d.format = v; });
  bindVal("setTimeFormat", (v) => { d.time = v; });
  bindVal("setUnits", (v) => { d.units = v.split(",").map((t) => t.trim()).filter(Boolean); });
  bindVal("setYesText", (v) => { d.yesText = v; });
  bindVal("setNoText", (v) => { d.noText = v; });
  bindVal("setCountStart", (v) => { d.start = v.trim(); });
  bindVal("setCountStep", (v) => { d.step = v.trim(); });
  bindVal("setCountMin", (v) => { d.min = v.trim(); });
  const rec = $("setRecent");
  if (rec) rec.addEventListener("change", (e) => { d.recent = e.target.checked; });
  const ph = $("setPlaceholder");
  if (ph) ph.addEventListener("input", (e) => { d.placeholder = e.target.value; });
  const clean = $("setClean");
  if (clean) clean.addEventListener("change", (e) => { d.clean = e.target.value; });
  const warn = $("setWarn");
  if (warn) warn.addEventListener("change", (e) => { d.warn = e.target.checked; });

  wrap.querySelectorAll("[data-dep]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const dep = e.target.dataset.dep;
      d.dependsOn = d.dependsOn || [];
      if (e.target.checked) { if (!d.dependsOn.includes(dep)) d.dependsOn.push(dep); }
      else d.dependsOn = d.dependsOn.filter((x) => x !== dep);
      rerender();
    });
  });
  wrap.querySelectorAll("[data-rule-dep]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const i = Number(e.target.dataset.rule);
      d.rules[i].when = d.rules[i].when || {};
      d.rules[i].when[e.target.dataset.ruleDep] = e.target.value;
    });
  });
  wrap.querySelectorAll("[data-rule-value]").forEach((input) => {
    input.addEventListener("input", (e) => { d.rules[Number(e.target.dataset.rule)].value = e.target.value; });
  });
  wrap.querySelectorAll("[data-rule-remove]").forEach((btn) => {
    btn.addEventListener("click", () => { d.rules.splice(Number(btn.dataset.ruleRemove), 1); rerender(); });
  });
  const addRule = $("addRuleBtn");
  if (addRule) addRule.addEventListener("click", () => {
    const when = {};
    (d.dependsOn || []).forEach((dep) => {
      const opts = normalizeOptions(getFieldConfig(dep) || { options: [] });
      if (opts.length) when[dep] = opts[0].id;
    });
    d.rules = d.rules || [];
    d.rules.push({ when, value: "" });
    rerender();
  });
  const fb = $("setFallback");
  if (fb) fb.addEventListener("input", (e) => { d.fallback = e.target.value; });
  const ls = $("setLineStart");
  if (ls) ls.addEventListener("input", (e) => { d.lineStart = e.target.value; });
  const dOld = $("setDnsOld");
  if (dOld) dOld.addEventListener("change", (e) => { d.oldField = e.target.value; });
  const dNew = $("setDnsNew");
  if (dNew) dNew.addEventListener("change", (e) => { d.newField = e.target.value; });
}

// ── Saving ─────────────────────────────────────────────────────────────
function saveFieldDraft() {
  const d = settingsDraft;
  const oldKey = settingsEditKey;
  const newKey = (d.name || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!newKey) { showToast("Placeholder needs a name"); return; }
  // A built-in name that was deleted, or renamed away from, is free to use again.
  if (newKey !== oldKey && (fieldConfigs[newKey] || (DEFAULT_FIELD_CONFIGS[newKey] && !deletedFields.includes(newKey)))) {
    showToast(`{${newKey}} already exists`);
    return;
  }

  const cfg = { label: (d.label || "").trim() || labelFor(newKey), type: d.type };
  if (d.optional) cfg.optional = true;
  if (d.pasteImages && !["image", "auto", "dns", "dnsDiff"].includes(d.type)) cfg.pasteImages = true;
  if (["text", "textarea", "select", "prefixToggle"].includes(d.type) && (d.leadIn || "").length) cfg.leadIn = d.leadIn;
  if ((d.type === "text" || d.type === "textarea") && (d.placeholder || "").trim()) cfg.placeholder = d.placeholder.trim();
  if ((d.type === "text" || d.type === "textarea" || d.type === "prefixToggle") && d.warn === false) cfg.warn = false;
  if (d.type === "text" || d.type === "prefixToggle") cfg.clean = (d.clean === "domain" || (["caseId", "email", "url"].includes(d.clean) && d.type === "text")) ? d.clean : ""; // explicit "" = off, so the load-time default doesn't turn it back on
  if (d.type === "select" || d.type === "multiselect") {
    const grouped = d.type === "select" && !!d.grouped;
    const follows = d.type === "multiselect" && !!d.filterBy;
    cfg.options = (d.options || [])
      .map((o) => {
        const text = (o.text || "").trim();
        if (grouped) return { text, group: singleGroup(o.group) || DEFAULT_GROUP_NAME };
        const gs = splitGroups(o.group);
        if (follows && gs.length) return { text, group: gs };
        return { text };
      })
      .filter((o) => o.text);
    cfg.inlineManage = !!d.inlineManage;
    cfg.listOrder = d.listOrder || "";
    applyListOrder(cfg);
    if (d.type === "select") cfg.manualBox = !!d.manualBox; // explicit false = off, so the Issue migration won't re-enable it
    if (d.type === "select") cfg.grouped = grouped;
    if (d.type === "multiselect") cfg.filterBy = d.filterBy || ""; // explicit "" = turned off, so migration won't re-enable it
  } else if (d.type === "toggle" || d.type === "snippet") {
    cfg.options = (d.options || [])
      .map((o, i) => ({ id: o.id || optionId(o, i), label: (o.label || "").trim() || `Option ${i + 1}`, text: (o.text || "").trim() }))
      .filter((o) => o.label);
    if (cfg.options.length < 1) { showToast("Add at least one option"); return; }
  } else if (d.type === "date" || d.type === "datetime") {
    cfg.format = DATE_FORMATS[d.format] ? d.format : "d MMM yyyy";
    if (d.type === "datetime") cfg.time = d.time === "24h" ? "24h" : "12h";
  } else if (d.type === "number") {
    cfg.units = (d.units || []).map((u) => String(u).trim()).filter(Boolean);
  } else if (d.type === "yesno") {
    cfg.yesText = d.yesText === undefined || d.yesText === "" ? "Yes" : d.yesText;
    cfg.noText = d.noText || "";
  } else if (d.type === "counter") {
    const num = (x, dflt) => (x === undefined || x === "" || isNaN(Number(x))) ? dflt : Number(x);
    cfg.start = num(d.start, 0);
    cfg.step = num(d.step, 1) || 1;
    if (!(d.min === undefined || d.min === "" || isNaN(Number(d.min)))) cfg.min = Number(d.min);
  } else if (d.type === "prefixToggle") {
    cfg.options = (d.options || [])
      .map((o, i) => ({ id: o.id || optionId(o, i), label: (o.label || "").trim() || `Option ${i + 1}`, prefix: o.prefix || "", hint: o.hint || "" }));
    if (cfg.options.length < 1) { showToast("Add at least one option"); return; }
  } else if (d.type === "multiToggle") {
    cfg.options = (d.options || [])
      .map((o, i) => ({ id: o.id || optionId(o, i), label: (o.label || "").trim() || `Option ${i + 1}`, prefix: o.prefix || "", hint: o.hint || "" }));
    if (cfg.options.length < 1) { showToast("Add at least one option"); return; }
    cfg.lineStart = d.lineStart === undefined ? "- " : d.lineStart;
  } else if (d.type === "auto") {
    cfg.dependsOn = d.dependsOn || [];
    cfg.rules = (d.rules || []).filter((r) => r.when && Object.keys(r.when).length);
    cfg.fallback = d.fallback || "";
  } else if (d.type === "dnsDiff") {
    cfg.oldField = d.oldField || "";
    cfg.newField = d.newField || "";
  } else if (d.type === "dns" && d.layout === "detailed") {
    cfg.layout = "detailed";
  }
  if (["toggle", "multiselect", "multiToggle"].includes(d.type) && d.manualBox) cfg.manualBox = true;
  if (d.type === "toggle" && d.noDefault) cfg.noDefault = true;
  if (d.type === "text" && d.recent) cfg.recent = true;
  if (d.showWhen && d.showWhen.field && (d.showWhen.values || []).length) {
    cfg.showWhen = { field: d.showWhen.field, values: d.showWhen.values.slice() };
    const always = (d.alwaysOn || []).filter((id) => tabOrder.includes(id));
    if (always.length) cfg.alwaysOn = always;
  }

  takeSnapshot(`Before saving {${newKey}}`);
  const renames = [];
  (d.options || []).forEach((o) => {
    if (d.type === "toggle") {
      const to = (o.label || "").trim();
      if (o.origLabel && to && String(o.origLabel).trim() !== to) renames.push({ from: o.origLabel, to });
    } else if (d.type === "select" || d.type === "multiselect") {
      const to = (o.text || "").trim();
      if (o.orig && to && String(o.orig).trim() !== to) renames.push({ from: o.orig, to });
    }
  });
  applyOptionRenames(oldKey, newKey, renames);
  if (newKey !== oldKey) {
    renamePlaceholder(oldKey, newKey);
    delete fieldConfigs[oldKey];
    // A built-in's default settings can't be deleted from the code, so hide the
    // old name from the Settings list the same way Delete does.
    if (hasDefaultConfig(oldKey) && !deletedFields.includes(oldKey)) deletedFields.push(oldKey);
    deletedFields = deletedFields.filter((k) => k !== newKey);
    saveDeletedFields();
  }
  fieldConfigs[newKey] = cfg;
  saveFieldConfigs();

  settingsEditKey = null;
  settingsDraft = null;
  renderSettings();
  showToast("Saved");
}

// Rewrites {oldName} -> {newName} everywhere, and carries saved values and
// toggle choices across so nothing typed gets orphaned. "Everywhere" includes
// the other placeholders' settings that point at this one: a checklist's
// filterBy, an auto field's dependsOn and rules, and the saved category pick
// (<name>__cat) that goes with a grouped dropdown.
function renamePlaceholder(oldKey, newKey) {
  retargetWarningScopes(oldKey, newKey);
  const re = new RegExp("\\{" + oldKey + "\\}", "gi");
  Object.keys(templates).forEach((tplId) => {
    if (typeof templates[tplId] === "string") templates[tplId] = templates[tplId].replace(re, `{${newKey}}`);
  });
  const renameKey = (bag, f) => {
    const l = f.toLowerCase();
    if (l === oldKey) { bag[newKey] = bag[f]; delete bag[f]; }
    else if (l === oldKey + "__cat") { bag[newKey + "__cat"] = bag[f]; delete bag[f]; }
    else if (l === oldKey + "__custom") { bag[newKey + "__custom"] = bag[f]; delete bag[f]; }
    else if (l === oldKey + "__unit") { bag[newKey + "__unit"] = bag[f]; delete bag[f]; }
    else if (l === oldKey + "__typed") { bag[newKey + "__typed"] = bag[f]; delete bag[f]; }
    else if (l === oldKey + "__other") { bag[newKey + "__other"] = bag[f]; delete bag[f]; }
    else if (l === oldKey + "__off") { bag[newKey + "__off"] = bag[f]; delete bag[f]; }
  };
  Object.keys(values).forEach((tplId) => Object.keys(values[tplId] || {}).forEach((f) => renameKey(values[tplId], f)));
  Object.keys(fieldModes).forEach((tplId) => Object.keys(fieldModes[tplId] || {}).forEach((f) => renameKey(fieldModes[tplId], f)));
  retargetFieldReferences(oldKey, newKey);
  saveTemplates();
  saveValuesDebounced();
  saveFieldModesDebounced();
}

// Points every placeholder setting that names {oldKey} at {newKey} instead.
// Built-ins whose settings live only in the code (e.g. {troubleshootingSteps}
// following {issue}) get a saved override made for the purpose.
function retargetFieldReferences(oldKey, newKey) {
  const names = new Set([...Object.keys(DEFAULT_FIELD_CONFIGS), ...Object.keys(fieldConfigs)]);
  names.delete(oldKey);
  const is = (x) => String(x).toLowerCase() === oldKey;
  names.forEach((k) => {
    const cfg = getFieldConfig(k);
    if (!cfg) return;
    const refFilter = !!cfg.filterBy && is(cfg.filterBy);
    const refDeps = Array.isArray(cfg.dependsOn) && cfg.dependsOn.some(is);
    const refRules = Array.isArray(cfg.rules) && cfg.rules.some((r) => r && r.when && Object.keys(r.when).some(is));
    const refDns = ["oldField", "newField"].filter((p) => cfg[p] && is(cfg[p]));
    const refShow = !!(cfg.showWhen && cfg.showWhen.field && is(cfg.showWhen.field));
    if (!refFilter && !refDeps && !refRules && !refDns.length && !refShow) return;
    const target = fieldConfigs[k] || (fieldConfigs[k] = cloneCfg(cfg));
    refDns.forEach((p) => { target[p] = newKey; });
    if (refShow) target.showWhen.field = newKey;
    if (refFilter) target.filterBy = newKey;
    if (refDeps) target.dependsOn = target.dependsOn.map((x) => (is(x) ? newKey : x));
    if (refRules) {
      target.rules.forEach((r) => {
        if (!r || !r.when) return;
        Object.keys(r.when).forEach((w) => { if (is(w)) { r.when[newKey] = r.when[w]; delete r.when[w]; } });
      });
    }
  });
  saveFieldConfigs();
}

// Take {key} out of a template's text. A line whose only placeholder was {key}
// goes away entirely (label and all); a line with other placeholders just
// loses the {key} tag.
function stripPlaceholderFromText(text, key) {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const has = new RegExp("\\{" + esc + "\\}", "i");
  const strip = new RegExp("\\{" + esc + "\\}", "gi");
  const anyPlaceholder = /\{[a-zA-Z0-9_]+\}/;
  return String(text).split("\n").map((line) => {
    if (!has.test(line)) return line;
    const rest = line.replace(strip, "");
    return anyPlaceholder.test(rest) ? rest.replace(/[ \t]+$/, "") : null;
  }).filter((l) => l !== null).join("\n");
}

function deleteFieldPlaceholder(key) {
  if (!key) return;
  const usedIn = tabOrder.filter((id) =>
    tabType(id) === "template" &&
    getPlaceholders(templates[id] || "").some((p) => p.toLowerCase() === key)
  );
  const where = usedIn.length
    ? `It will be removed from: ${usedIn.map(labelForTpl).join(", ")}.\nA line that only holds {${key}} is deleted; a line with other placeholders just loses the tag.`
    : `It isn't used in any template.`;
  if (!confirm(`Delete {${key}}?\n\n${where}\nIts settings and saved entries are cleared too.${undoHint()}`)) return;
  takeSnapshot(`Before deleting {${key}}`, { force: true });

  usedIn.forEach((id) => { templates[id] = stripPlaceholderFromText(templates[id], key); });
  if (usedIn.length) saveTemplates();

  delete fieldConfigs[key];
  saveFieldConfigs();
  dropWarningsForField(key);

  const isKey = (f) => { const l = f.toLowerCase(); return l === key || l === key + "__cat" || l === key + "__custom" || l === key + "__typed" || l === key + "__other" || l === key + "__unit" || l === key + "__off"; };
  Object.keys(values).forEach((tplId) => Object.keys(values[tplId] || {}).forEach((f) => { if (isKey(f)) delete values[tplId][f]; }));
  Object.keys(fieldModes).forEach((tplId) => Object.keys(fieldModes[tplId] || {}).forEach((f) => { if (isKey(f)) delete fieldModes[tplId][f]; }));
  saveValuesDebounced();
  saveFieldModesDebounced();

  if (hasDefaultConfig(key) && !deletedFields.includes(key)) {
    deletedFields.push(key);
    saveDeletedFields();
  }

  showToast(`{${key}} deleted`);
  settingsEditKey = null;
  settingsDraft = null;
  renderSettings();
}

function resetFieldDraft() {
  const key = settingsEditKey;
  if (hasDefaultConfig(key)) {
    if (!confirm(`Reset {${key}} back to its built-in behaviour?`)) return;
    takeSnapshot(`Before resetting {${key}}`, { force: true });
    delete fieldConfigs[key];
    saveFieldConfigs();
    showToast("Reset to default");
  } else {
    if (!confirm(`Clear the settings for {${key}}? It goes back to being a plain text field (it stays in any template that uses it).`)) return;
    takeSnapshot(`Before clearing the settings for {${key}}`, { force: true });
    delete fieldConfigs[key];
    saveFieldConfigs();
    showToast("Settings removed");
  }
  settingsEditKey = null;
  settingsDraft = null;
  renderSettings();
}

$("settingsBackBtn").addEventListener("click", () => {
  if (settingsEditKey !== null || warnDraft) requestLeaveEditor();
  else closeSettings();
});


// ── Soft warnings: list, editor, save ───────────────────────────────────
// The amber hints under a field (see "Soft warnings" in popup.js). Everything
// here edits `softWarnings`; while it is null the built-ins are in force, and
// the first change copies them into a list the person then owns.
const WARN_CLEAN_LABELS = { caseId: "Case ID fields", domain: "Domain fields", email: "Email fields" };

function warnScopeLabel(scope) {
  if (!scope || scope === "*") return "Any text field";
  if (scope.startsWith("clean:")) return WARN_CLEAN_LABELS[scope.slice(6)] || scope.slice(6);
  if (scope.startsWith("field:")) return "{" + scope.slice(6) + "}";
  return scope;
}
function warnConditionText(r) {
  const v = r.value;
  switch (r.test) {
    case "notNumber": return "isn't a plain number";
    case "notDomain": return "doesn't look like a domain";
    case "notEmail": return "doesn't look like an email address";
    case "lengthNot": return `isn't exactly ${v} characters long`;
    case "shorterThan": return `is shorter than ${v} characters`;
    case "longerThan": return `is longer than ${v} characters`;
    case "contains": return `contains "${v}"`;
    case "notContains": return `doesn't contain "${v}"`;
    case "matches": return `matches /${v}/`;
    case "notMatches": return `doesn't match /${v}/`;
  }
  return "";
}

function softWarningsSectionHTML() {
  const list = getSoftWarnings();
  const rows = list.map((r) => `<div class="set-row-wrap">
      <button type="button" class="set-row" data-edit-warn="${escAttr(r.id)}">
        <div class="set-row-main"><code class="set-row-name">${escHtml(warnScopeLabel(r.scope))}</code></div>
        <div class="set-row-meta">${escHtml("Warns when the value " + warnConditionText(r))}</div>
        <div class="set-row-meta">${escHtml("\u201C" + (r.message || "") + "\u201D")}</div>
      </button>
      <button type="button" class="ref-remove-btn set-row-del" data-del-warn="${escAttr(r.id)}" title="Remove this warning" aria-label="Remove this warning">\u2715</button>
    </div>`).join("");
  return `
    <div class="edit-hint">The small amber hints under a field when what you typed looks off. They only advise \u2014 nothing is blocked and the note is unchanged. If more than one applies to a field, the first one in this list is shown. Turn them off for one field in that placeholder's settings. The built-in four cover Case IDs, domains and emails.</div>
    <div class="set-list">${rows || '<div class="set-hint">No soft warnings. Add one below.</div>'}</div>
    <div class="set-btn-row">
      <button type="button" class="btn btn-primary" id="addWarnBtn">+ Add soft warning</button>
      ${softWarnings ? '<button type="button" class="btn" id="resetWarnBtn" title="Put the built-in warnings back and drop your own">Reset to built-in</button>' : ""}
    </div>`;
}

function warnDraftSignature(d) {
  return JSON.stringify({ scope: d.scope || "*", test: d.test || "", value: d.value || "", message: d.message || "" });
}
function startNewWarning() {
  settingsTab = "warnings";
  warnDraft = { id: newWarnId(), scope: "*", test: "contains", value: "", message: "" };
  warnIsNew = true;
  warnSnapshot = warnDraftSignature(warnDraft);
  renderSettings();
}
function startEditWarning(id) {
  settingsTab = "warnings";
  const r = getSoftWarnings().find((x) => x.id === id);
  if (!r) return;
  warnDraft = cloneCfg(r);
  warnIsNew = false;
  warnSnapshot = warnDraftSignature(warnDraft);
  renderSettings();
}
function closeWarnEditor() { warnDraft = null; warnIsNew = false; renderSettings(); }

function requestLeaveWarnEditor() {
  if (!warnDraft) return;
  if (warnDraftSignature(warnDraft) === warnSnapshot) { closeWarnEditor(); return; }
  showUnsavedDialog({
    text: "Save your changes to this soft warning before going back?",
    keepLabel: "Keep editing",
    onSave: () => saveWarnDraft(),
    onDiscard: closeWarnEditor
  });
}

function warnScopeOptionsHTML(current) {
  const opt = (v, label) => `<option value="${escAttr(v)}"${v === current ? " selected" : ""}>${escHtml(label)}</option>`;
  const fields = allKnownFields().filter((k) => ["text", "textarea", "prefixToggle"].includes(fieldType(k)));
  if (current.startsWith("field:") && !fields.includes(current.slice(6))) fields.push(current.slice(6));
  return opt("*", "Any text field")
    + `<optgroup label="Fields cleaned a certain way">`
    + opt("clean:caseId", "Case ID fields (cleaned as Case ID \u2192 I-number)")
    + opt("clean:domain", "Domain fields (cleaned as URL \u2192 domain)")
    + opt("clean:email", "Email fields")
    + `</optgroup><optgroup label="One placeholder">`
    + fields.sort().map((k) => opt("field:" + k, "{" + k + "}")).join("")
    + `</optgroup>`;
}
function warnValueRowHTML(d) {
  const needs = (WARN_TESTS[d.test] || {}).needs;
  if (!needs) return "";
  const label = needs === "number" ? "How many characters" : needs === "pattern" ? "Pattern" : "Text";
  const attrs = needs === "number" ? 'type="number" min="0" step="1"' : 'type="text"';
  const ph = needs === "pattern" ? "e.g. ^I-\\d{8}$" : needs === "number" ? "e.g. 8" : "e.g. gmail";
  const hint = needs === "pattern" ? '<div class="set-hint">A regular expression, ignoring upper/lower case. If the pattern isn\'t valid it never warns.</div>'
    : needs === "text" ? '<div class="set-hint">Ignores upper/lower case.</div>' : "";
  return `<div class="field"><label>${label}</label><input ${attrs} id="warnValue" value="${escAttr(d.value || "")}" placeholder="${escAttr(ph)}">${hint}</div>`;
}

function renderWarningEditor() {
  const d = warnDraft;
  const wrap = $("settingsBody");
  const testOptions = Object.keys(WARN_TESTS).map((t) =>
    `<option value="${t}"${t === d.test ? " selected" : ""}>${escHtml(WARN_TESTS[t].label)}</option>`).join("");
  wrap.innerHTML = `
    <div class="field">
      <label>Applies to</label>
      <select id="warnScope">${warnScopeOptionsHTML(d.scope || "*")}</select>
    </div>
    <div class="field">
      <label>Warn when the value</label>
      <select id="warnTest">${testOptions}</select>
      <div class="set-hint">Checked after the field's cleaning, so a case ID is tested as its bare digits and a pasted URL as its bare domain.</div>
    </div>
    <div id="warnValueRow">${warnValueRowHTML(d)}</div>
    <div class="field">
      <label>Warning text</label>
      <input type="text" id="warnMsg" maxlength="100" value="${escAttr(d.message || "")}" placeholder="e.g. Case IDs are usually 8 digits.">
    </div>
    <div class="set-block">
      <div class="set-block-title">Try it</div>
      <div class="field" style="margin-bottom:0"><input type="text" id="warnTry" placeholder="Type a sample value to test this warning"></div>
      <div class="set-hint" id="warnTryOut" style="margin-top:6px"></div>
    </div>
    ${warnIsNew ? "" : `<div class="set-block set-danger-zone">
      <div class="set-block-title">Remove soft warning</div>
      <button type="button" class="btn btn-ghost set-delete-btn" id="warnDeleteBtn">Remove this warning\u2026</button>
    </div>`}
    <div class="footer-actions">
      <span></span>
      <div class="footer-actions-right">
        <button class="btn" id="warnCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="warnSaveBtn">Save</button>
      </div>
    </div>`;
  $("settingsTitle").textContent = warnIsNew ? "New soft warning" : "Editing soft warning";
  $("settingsBackBtn").textContent = "Back";

  const updateTry = () => {
    const out = $("warnTryOut");
    const sample = String($("warnTry").value || "").trim();
    if (!sample) { out.className = "set-hint"; out.textContent = ""; return; }
    const sc = d.scope || "*";
    let mode = "", plain = true;
    if (sc.startsWith("clean:")) mode = sc.slice(6);
    else if (sc.startsWith("field:")) { const k = sc.slice(6); mode = cleanModeFor(k); plain = fieldType(k) === "text"; }
    const hit = warningTriggers(d, mode, sample, plain);
    out.className = hit ? "field-warn" : "set-hint";
    out.textContent = hit ? (d.message || "This doesn't look right.") : "No warning for this value.";
  };
  const wireValue = () => {
    const v = $("warnValue");
    if (v) v.addEventListener("input", (e) => { d.value = e.target.value; updateTry(); });
  };
  $("warnScope").addEventListener("change", (e) => { d.scope = e.target.value; updateTry(); });
  $("warnTest").addEventListener("change", (e) => {
    d.test = e.target.value;
    $("warnValueRow").innerHTML = warnValueRowHTML(d);
    wireValue();
    updateTry();
  });
  $("warnMsg").addEventListener("input", (e) => { d.message = e.target.value; updateTry(); });
  $("warnTry").addEventListener("input", updateTry);
  wireValue();
  $("warnCancelBtn").addEventListener("click", closeWarnEditor);
  $("warnSaveBtn").addEventListener("click", saveWarnDraft);
  const del = $("warnDeleteBtn");
  if (del) del.addEventListener("click", () => deleteWarning(d.id));
}

function saveWarnDraft() {
  const d = warnDraft;
  if (!d) return;
  const message = (d.message || "").trim();
  if (!message) { showToast("Write what the warning should say"); return; }
  const needs = (WARN_TESTS[d.test] || {}).needs;
  let value = "";
  if (needs === "number") {
    value = String(d.value || "").trim();
    if (!/^\d+$/.test(value)) { showToast("Enter a whole number"); return; }
  } else if (needs === "text") {
    value = String(d.value || "");
    if (!value) { showToast("Enter the text to look for"); return; }
  } else if (needs === "pattern") {
    value = String(d.value || "");
    if (!value) { showToast("Enter a pattern"); return; }
    try { new RegExp(value, "i"); } catch (e) { showToast("That pattern isn't valid"); return; }
  }
  const rule = { id: d.id, scope: d.scope || "*", test: d.test, value, message };
  takeSnapshot("Before changing soft warnings");
  const list = cloneCfg(getSoftWarnings());
  const i = list.findIndex((x) => x.id === rule.id);
  if (i >= 0) list[i] = rule; else list.push(rule);
  softWarnings = list;
  saveSoftWarnings();
  warnDraft = null;
  warnIsNew = false;
  renderSettings();
  showToast("Saved");
}

function deleteWarning(id) {
  if (!confirm("Remove this soft warning?\n\nYou can put the built-in ones back with \u201CReset to built-in\u201D.")) return;
  takeSnapshot("Before removing a soft warning", { force: true });
  softWarnings = cloneCfg(getSoftWarnings()).filter((x) => x.id !== id);
  saveSoftWarnings();
  warnDraft = null;
  warnIsNew = false;
  renderSettings();
  showToast("Warning removed");
}

function resetWarnings() {
  if (!confirm("Put the built-in soft warnings back?\n\nThis drops any you added or changed.")) return;
  takeSnapshot("Before resetting soft warnings", { force: true });
  softWarnings = null;
  saveSoftWarnings();
  renderSettings();
  showToast("Reset to built-in");
}

// A placeholder that's renamed or deleted takes its own warnings with it.
function retargetWarningScopes(oldKey, newKey) {
  if (!softWarnings) return;
  let changed = false;
  softWarnings.forEach((r) => {
    if ((r.scope || "").toLowerCase() === "field:" + oldKey) { r.scope = "field:" + newKey; changed = true; }
  });
  if (changed) saveSoftWarnings();
}
function dropWarningsForField(key) {
  if (!softWarnings) return;
  const before = softWarnings.length;
  softWarnings = softWarnings.filter((r) => (r.scope || "").toLowerCase() !== "field:" + key);
  if (softWarnings.length !== before) saveSoftWarnings();
}
