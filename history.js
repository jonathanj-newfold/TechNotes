// ── History / snapshots ─────────────────────────────────────────────────
// A snapshot is a copy of the setup: templates you edited or added, reference
// tables, tabs (order, names, types), placeholder settings and soft warnings.
// It does NOT include what's typed into the forms, so restoring one never
// wipes the case you're in the middle of.
//
// Snapshots are taken (1) by hand, and (2) automatically just BEFORE something
// changes — saving or deleting a template, placeholder or warning, importing a
// backup, restoring another snapshot — so the previous state is always there
// to go back to. Snapshots saved by hand (or "kept") are never removed
// automatically; the automatic ones are trimmed to the newest N.

const SNAPSHOT_THROTTLE_MS = 5 * 60 * 1000; // ordinary edits within 5 minutes share one snapshot
const MAX_AUTO_CHOICES = [5, 10, 20, 50];

let snapshots = [];   // newest first: { id, at, label, kind: "auto" | "manual", data }
let appSettings = { autoSnapshots: true, maxAutoSnapshots: 20, logCases: true, casesPanelShown: true, casesOpenDefault: true, casesWide: false, casesPanelW: 330, caseTpls: ["caseNote"], ctrlCCopy: true, groupToggles: false, hiddenTabs: [] };
let historyCompareId = null; // snapshot whose "what would change" list is open
let historyRenameId = null;  // snapshot being renamed

// ── Storage ─────────────────────────────────────────────────────────────
function sanitizeAppSettings(o) {
  const src = (o && typeof o === "object") ? o : {};
  const max = Number(src.maxAutoSnapshots);
  return { autoSnapshots: src.autoSnapshots !== false, maxAutoSnapshots: MAX_AUTO_CHOICES.includes(max) ? max : 20, logCases: src.logCases !== false, casesOpenDefault: true, casesPanelShown: src.casesOpenDefault === true ? src.casesPanelShown === true : true, casesWide: src.casesWide === true, casesPanelW: (Number(src.casesPanelW) >= 200 && Number(src.casesPanelW) <= 700) ? Math.round(Number(src.casesPanelW)) : 330, caseTpls: Array.isArray(src.caseTpls) ? src.caseTpls.filter((t) => typeof t === "string") : ["caseNote"], ctrlCCopy: src.ctrlCCopy !== false, groupToggles: src.groupToggles === true, hiddenTabs: Array.isArray(src.hiddenTabs) ? src.hiddenTabs.filter((t) => typeof t === "string") : [] };
}
function sanitizeSnapshots(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && typeof s === "object" && s.id && typeof s.at === "number" && s.data && typeof s.data === "object")
    .map((s) => ({ id: String(s.id), at: s.at, label: String(s.label || "Snapshot"), kind: s.kind === "manual" ? "manual" : "auto", data: s.data }))
    .sort((a, b) => b.at - a.at);
}
function saveSnapshots() {
  chrome.storage.local.set({ cnh_snapshots: snapshots }, () => {
    if (chrome.runtime.lastError) showToast("Couldn't save the snapshot (storage full?)");
  });
}
function saveAppSettings() { chrome.storage.local.set({ cnh_appSettings: appSettings }); }

// ── Taking snapshots ────────────────────────────────────────────────────
function stableStr(v) {
  if (v === undefined) return "null";
  if (Array.isArray(v)) return "[" + v.map(stableStr).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableStr(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

// The setup as it is right now, deep-copied.
function captureConfig() {
  return JSON.parse(JSON.stringify({
    templates: templateOverrides(),
    tabOrder, customLabels, tabTypes, referenceTables,
    fieldConfigs, deletedFields,
    softWarnings: softWarnings || null
  }));
}

// opts: { manual }  saved by the person: always made, never trimmed
//       { always }  ignore the "automatic snapshots" switch (import / restore)
//       { force }   skip the 5-minute sharing (deletes and resets)
// An automatic snapshot identical to the newest one is skipped.
function takeSnapshot(label, opts = {}) {
  try {
    if (!opts.manual && !opts.always && !appSettings.autoSnapshots) return null;
    const data = captureConfig();
    const newest = snapshots[0];
    if (!opts.manual && newest && stableStr(newest.data) === stableStr(data)) return null;
    if (!opts.manual && !opts.force && !opts.always && newest && newest.kind === "auto" && Date.now() - newest.at < SNAPSHOT_THROTTLE_MS) return null;
    const snap = {
      id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: Date.now(),
      label: String(label || "Snapshot").slice(0, 80),
      kind: opts.manual ? "manual" : "auto",
      data
    };
    snapshots.unshift(snap);
    pruneSnapshots();
    saveSnapshots();
    return snap;
  } catch (e) {
    console.warn("Snapshot failed", e);
    return null;
  }
}
function pruneSnapshots() {
  let autos = 0;
  snapshots = snapshots.filter((s) => s.kind === "manual" || ++autos <= appSettings.maxAutoSnapshots);
}

// Appended to delete confirmations.
function undoHint() {
  return appSettings.autoSnapshots ? " You can bring it back from Settings \u2192 History." : " This can't be undone.";
}

// ── Restoring / editing snapshots ───────────────────────────────────────
function restoreSnapshot(id) {
  const snap = snapshots.find((s) => s.id === id);
  if (!snap) return;
  showConfirmDialog({
    title: "Restore snapshot",
    text: `Go back to \u201C${snap.label}\u201D (${formatSnapshotTime(snap.at)})? Your current templates, tables and settings are replaced. What you're typing into forms stays. The current setup is saved as a snapshot first, so you can undo this.`,
    confirmLabel: "Restore",
    onConfirm: () => {
      takeSnapshot(`Before restoring \u201C${snap.label}\u201D`, { always: true });
      applyConfigData(JSON.parse(JSON.stringify(snap.data)));
      if (!tabOrder.includes(activeTpl) || isTabHidden(activeTpl)) activeTpl = firstShownTab();
      historyCompareId = null;
      renderSettings();
      showToast("Restored");
    }
  });
}
function deleteSnapshot(id) {
  const snap = snapshots.find((s) => s.id === id);
  if (!snap) return;
  showConfirmDialog({
    title: "Delete snapshot",
    text: `Delete \u201C${snap.label}\u201D (${formatSnapshotTime(snap.at)})? This can't be undone.`,
    confirmLabel: "Delete",
    onConfirm: () => {
      snapshots = snapshots.filter((s) => s.id !== id);
      if (historyCompareId === id) historyCompareId = null;
      saveSnapshots();
      renderSettings();
    }
  });
}
function clearSnapshots() {
  showConfirmDialog({
    title: "Delete all snapshots",
    text: `Delete all ${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"}, including the ones you saved yourself? Your current setup isn't touched. This can't be undone.`,
    confirmLabel: "Delete all",
    onConfirm: () => { snapshots = []; historyCompareId = null; historyRenameId = null; saveSnapshots(); renderSettings(); }
  });
}

// ── Describing a snapshot ───────────────────────────────────────────────
function formatSnapshotTime(at) {
  return new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function timeAgo(at) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
function snapshotSummary(d) {
  const ids = Array.isArray(d.tabOrder) && d.tabOrder.length ? d.tabOrder : DEFAULT_TAB_ORDER;
  const tables = ids.filter((id) => d.tabTypes && d.tabTypes[id] === "reference").length;
  const tpls = ids.length - tables;
  const edited = Object.keys(d.fieldConfigs || {}).length;
  const parts = [`${tpls} template${tpls === 1 ? "" : "s"}`];
  if (tables) parts.push(`${tables} table${tables === 1 ? "" : "s"}`);
  parts.push(`${edited} edited placeholder${edited === 1 ? "" : "s"}`);
  parts.push(Array.isArray(d.softWarnings) ? `${d.softWarnings.length} soft warning${d.softWarnings.length === 1 ? "" : "s"}` : "built-in warnings");
  return parts.join(" \u00B7 ");
}

// What restoring `snap` would change, written from the point of view of "now".
function diffConfigs(snap, cur) {
  const q = (t) => `\u201C${t}\u201D`;
  const lines = [];
  const tplMap = (d) => ({ ...DEFAULT_TEMPLATES, ...(d.templates || {}) });
  const tabLabel = (d, id) => (d.customLabels && d.customLabels[id]) || TAB_LABELS[id] || id;

  const st = tplMap(snap), ct = tplMap(cur);
  new Set([...Object.keys(st), ...Object.keys(ct)]).forEach((id) => {
    if (!(id in ct)) lines.push(`Bring back the template ${q(tabLabel(snap, id))}`);
    else if (!(id in st)) lines.push(`Remove the template ${q(tabLabel(cur, id))}`);
    else if (st[id] !== ct[id]) lines.push(`Change the wording of ${q(tabLabel(cur, id))}`);
    else if (tabLabel(snap, id) !== tabLabel(cur, id)) lines.push(`Rename ${q(tabLabel(cur, id))} back to ${q(tabLabel(snap, id))}`);
  });

  const sr = snap.referenceTables || {}, cr = cur.referenceTables || {};
  new Set([...Object.keys(sr), ...Object.keys(cr)]).forEach((id) => {
    if (!(id in cr)) lines.push(`Bring back the table ${q(tabLabel(snap, id))}`);
    else if (!(id in sr)) lines.push(`Remove the table ${q(tabLabel(cur, id))}`);
    else if (stableStr(sr[id]) !== stableStr(cr[id])) lines.push(`Change the table ${q(tabLabel(cur, id))}`);
  });

  const sf = snap.fieldConfigs || {}, cf = cur.fieldConfigs || {};
  [...new Set([...Object.keys(sf), ...Object.keys(cf)])].sort().forEach((k) => {
    if (!(k in cf)) lines.push(`Bring back the settings for {${k}}`);
    else if (!(k in sf)) lines.push(`Drop the custom settings for {${k}}`);
    else if (stableStr(sf[k]) !== stableStr(cf[k])) lines.push(`Change the settings for {${k}}`);
  });
  const sd = snap.deletedFields || [], cd = cur.deletedFields || [];
  sd.filter((k) => !cd.includes(k)).forEach((k) => lines.push(`Hide the built-in {${k}}`));
  cd.filter((k) => !sd.includes(k)).forEach((k) => lines.push(`Show the built-in {${k}} again`));

  if (stableStr(snap.softWarnings || null) !== stableStr(cur.softWarnings || null)) lines.push("Change the soft warnings");

  const common = (snap.tabOrder || []).filter((id) => (cur.tabOrder || []).includes(id));
  if (stableStr(common) !== stableStr((cur.tabOrder || []).filter((id) => common.includes(id)))) lines.push("Change the order of the tabs");
  return lines;
}

// ── The History tab ─────────────────────────────────────────────────────
function snapshotRowHTML(s, cur) {
  const renaming = historyRenameId === s.id;
  const comparing = historyCompareId === s.id;
  const labelHTML = renaming
    ? `<input type="text" class="snap-rename-input" data-snap-rename-input="${escAttr(s.id)}" value="${escAttr(s.label)}" maxlength="80">`
    : `<span class="snap-label">${escHtml(s.label)}</span>`;
  let compareHTML = "";
  if (comparing) {
    const lines = diffConfigs(s.data, cur);
    const shown = lines.slice(0, 14).map((l) => `<li>${escHtml(l)}</li>`).join("");
    compareHTML = `<div class="snap-compare">
      <div class="set-block-title" style="margin-bottom:4px">Restoring this would</div>
      ${lines.length ? `<ul>${shown}</ul>${lines.length > 14 ? `<div class="set-hint">\u2026and ${lines.length - 14} more.</div>` : ""}` : '<div class="set-hint" style="margin:0">Change nothing: it matches your setup right now.</div>'}
    </div>`;
  }
  return `<div class="snap-row">
    <div class="set-row-main">${labelHTML}<span class="set-badge">${s.kind === "manual" ? "saved" : "auto"}</span></div>
    <div class="set-row-meta">${escHtml(formatSnapshotTime(s.at))} \u00B7 ${escHtml(timeAgo(s.at))}</div>
    <div class="set-row-meta">${escHtml(snapshotSummary(s.data))}</div>
    <div class="snap-actions">
      <button type="button" class="snap-link snap-primary" data-snap-restore="${escAttr(s.id)}">Restore</button>
      <button type="button" class="snap-link" data-snap-compare="${escAttr(s.id)}">${comparing ? "Hide changes" : "See changes"}</button>
      <button type="button" class="snap-link" data-snap-rename="${escAttr(s.id)}">${renaming ? "Save name" : "Rename"}</button>
      ${s.kind === "auto" ? `<button type="button" class="snap-link" data-snap-keep="${escAttr(s.id)}" title="Automatic snapshots are trimmed over time; a kept one never is">Keep</button>` : ""}
      <button type="button" class="snap-link snap-danger" data-snap-delete="${escAttr(s.id)}">Delete</button>
    </div>
    ${compareHTML}
  </div>`;
}

function historyTabHTML() {
  const cur = captureConfig();
  const maxOpts = MAX_AUTO_CHOICES.map((n) => `<option value="${n}"${n === appSettings.maxAutoSnapshots ? " selected" : ""}>${n}</option>`).join("");
  return `
    <div class="edit-hint">A snapshot is a copy of your templates, reference tables, placeholder settings and soft warnings, so you can go back to how things were. What you're typing into a form isn't part of it.</div>
    <div class="set-block">
      <div class="set-block-title">Save a snapshot now</div>
      <div class="set-add-row" style="margin-top:0">
        <input type="text" id="snapName" placeholder="Name (optional), e.g. Before renaming fields" maxlength="80">
        <button type="button" class="btn btn-primary" id="snapSaveBtn">Save</button>
      </div>
    </div>
    <div class="set-section-title">Snapshots (${snapshots.length})</div>
    <div class="set-list">${snapshots.map((s) => snapshotRowHTML(s, cur)).join("") || '<div class="set-hint">No snapshots yet. One is saved automatically before you change or delete something, and you can save your own above.</div>'}</div>
    ${snapshots.length ? '<button type="button" class="btn btn-ghost set-delete-btn" id="snapClearBtn">Delete all snapshots\u2026</button>' : ""}
    <div class="set-block" style="margin-top:12px">
      <div class="set-block-title">Automatic snapshots</div>
      <label class="set-check" style="margin-top:0"><input type="checkbox" id="snapAuto"${appSettings.autoSnapshots ? " checked" : ""}> Save a snapshot automatically before changes</label>
      <div class="set-hint" style="margin-top:6px">Taken just before you save or delete a template, table, placeholder or soft warning. Edits made within a few minutes of each other share one snapshot. Importing a backup or restoring a snapshot always saves one first.</div>
      <div class="field" style="margin-bottom:0"><label style="text-transform:none">Keep the newest automatic snapshots</label>
        <select id="snapMax">${maxOpts}</select>
        <div class="set-hint" style="margin-top:4px">Snapshots you save yourself, or mark <b>Keep</b>, are never removed automatically.</div>
      </div>
    </div>`;
}

function wireHistoryTab(root) {
  const on = (sel, evt, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener(evt, () => fn(el)));

  const save = $("snapSaveBtn");
  if (save) {
    const doSave = () => {
      const name = ($("snapName").value || "").trim();
      takeSnapshot(name || `Saved ${formatSnapshotTime(Date.now())}`, { manual: true });
      renderSettings();
      showToast("Snapshot saved");
    };
    save.addEventListener("click", doSave);
    $("snapName").addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });
  }
  on("[data-snap-restore]", "click", (el) => restoreSnapshot(el.dataset.snapRestore));
  on("[data-snap-delete]", "click", (el) => deleteSnapshot(el.dataset.snapDelete));
  on("[data-snap-compare]", "click", (el) => {
    historyCompareId = historyCompareId === el.dataset.snapCompare ? null : el.dataset.snapCompare;
    renderSettings();
  });
  on("[data-snap-keep]", "click", (el) => {
    const s = snapshots.find((x) => x.id === el.dataset.snapKeep);
    if (s) { s.kind = "manual"; saveSnapshots(); renderSettings(); showToast("Kept"); }
  });
  const commitRename = (id) => {
    const input = root.querySelector(`[data-snap-rename-input="${id}"]`);
    const s = snapshots.find((x) => x.id === id);
    if (input && s && input.value.trim()) { s.label = input.value.trim(); saveSnapshots(); }
    historyRenameId = null;
    renderSettings();
  };
  on("[data-snap-rename]", "click", (el) => {
    const id = el.dataset.snapRename;
    if (historyRenameId === id) { commitRename(id); return; }
    historyRenameId = id;
    renderSettings();
    const input = root.querySelector(`[data-snap-rename-input="${id}"]`);
    if (input) { input.focus(); input.select(); }
  });
  root.querySelectorAll("[data-snap-rename-input]").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitRename(input.dataset.snapRenameInput); }
      else if (e.key === "Escape") { e.preventDefault(); historyRenameId = null; renderSettings(); }
    });
  });
  const clear = $("snapClearBtn");
  if (clear) clear.addEventListener("click", clearSnapshots);

  $("snapAuto").addEventListener("change", (e) => { appSettings.autoSnapshots = e.target.checked; saveAppSettings(); });
  $("snapMax").addEventListener("change", (e) => {
    appSettings.maxAutoSnapshots = Number(e.target.value);
    saveAppSettings();
    const before = snapshots.length;
    pruneSnapshots();
    if (snapshots.length !== before) { saveSnapshots(); renderSettings(); }
  });
}
