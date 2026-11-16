// ── Undo / redo ─────────────────────────────────────────────────────────
// Ctrl+Z (undo) and Ctrl+Y or Ctrl+Shift+Z (redo) for the fill-in form, plus
// matching ↶ ↷ buttons. Every template keeps its own history, so switching
// tabs never mixes them up. What is remembered: everything typed, picked,
// ticked or switched on the form, plus Clear fields and "Edit" on a case.
//
// How it works: popup.js calls undoTrack() whenever the form's values change.
// We compare the form to how it looked last time; if it differs, the old look
// goes on the undo stack. Typing in one box is merged into one step (a burst
// of keystrokes = one Ctrl+Z), anything else is a step of its own.

const UNDO_LIMIT = 100;
const UNDO_BURST_MS = 900;
const undoStacks = {};   // { [tplId]: { undo: [json], redo: [json], last: json, at: ms, target: el } }
let undoApplying = false;

function undoFormState(tplId) {
  return JSON.stringify({ v: (values && values[tplId]) || {}, m: (typeof fieldModes === "object" && fieldModes && fieldModes[tplId]) || {} });
}
const UNDO_EMPTY = JSON.stringify({ v: {}, m: {} });
function undoStack(tplId) {
  // A template nobody has typed in yet starts from an empty form; ones with saved content are set up in undoReset().
  if (!undoStacks[tplId]) undoStacks[tplId] = { undo: [], redo: [], last: UNDO_EMPTY, at: 0, target: null };
  return undoStacks[tplId];
}
// Forget every history and start again from what the forms look like now.
function undoReset() {
  Object.keys(undoStacks).forEach((k) => delete undoStacks[k]);
  const ids = new Set([].concat(Object.keys(values || {}), Object.keys((typeof fieldModes === "object" && fieldModes) || {})));
  ids.forEach((id) => { undoStacks[id] = { undo: [], redo: [], last: undoFormState(id), at: 0, target: null }; });
  if (typeof updateUndoButtons === "function") updateUndoButtons();
}

function undoTrack(tplId) {
  if (undoApplying || !tplId) return;
  // Wait until the code that changed the values has finished, so the comparison sees the final result.
  const target = document.activeElement;
  setTimeout(() => {
    if (undoApplying) return;
    const s = undoStack(tplId);
    const now = undoFormState(tplId);
    if (now === s.last) return;
    const t = Date.now();
    const typing = target && (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && /^(text|search|email|url|tel|number)?$/i.test(target.type || "")));
    const sameBurst = typing && s.target === target && (t - s.at) < UNDO_BURST_MS && s.undo.length;
    if (!sameBurst) {
      s.undo.push(s.last);
      if (s.undo.length > UNDO_LIMIT) s.undo.shift();
    }
    s.redo = [];
    s.last = now;
    s.at = t;
    s.target = typing ? target : null;
    updateUndoButtons();
  }, 0);
}

// Remember which box has the cursor (by its data-* attributes) so it can be found again after the form redraws.
function undoFocusInfo() {
  const el = document.activeElement;
  if (!el || !el.closest || !el.closest("#fields") || !el.dataset) return null;
  const parts = Object.keys(el.dataset).map((k) => `[data-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}="${String(el.dataset[k]).replace(/"/g, '\\"')}"]`);
  if (!parts.length) return null;
  return { sel: el.tagName.toLowerCase() + parts.join(""), caret: el.selectionStart };
}

function undoApply(tplId, json) {
  const o = JSON.parse(json);
  const focus = undoFocusInfo();
  // Leave the box first: its blur/change handlers write the typed text back, and that must happen
  // BEFORE the old values go in, not when the redraw removes the box.
  const act = document.activeElement;
  if (act && act.closest && act.closest("#fields") && act.blur) act.blur();
  undoApplying = true;
  try {
    values[tplId] = o.v || {};
    if (!fieldModes) fieldModes = {};
    fieldModes[tplId] = o.m || {};
    if (typeof saveValuesDebounced === "function") saveValuesDebounced();
    if (typeof saveFieldModesDebounced === "function") saveFieldModesDebounced();
    if (tplId === activeTpl) renderFields();
  } finally {
    // saveValuesDebounced() schedules its own (ignored) tracking; release the lock afterwards.
    setTimeout(() => { undoApplying = false; }, 0);
  }
  if (focus && tplId === activeTpl) {
    const el = document.querySelector("#fields " + focus.sel);
    if (el) { el.focus(); try { const n = el.value.length; const c = Math.min(focus.caret == null ? n : focus.caret, n); el.setSelectionRange(c, c); } catch (e) {} }
  }
}

function undoStep(dir) {
  const tplId = activeTpl;
  if (!tplId || !$("fillView") || $("fillView").classList.contains("hidden")) return false;
  const s = undoStack(tplId);
  const from = dir < 0 ? s.undo : s.redo;
  if (!from.length) { showToast(dir < 0 ? "Nothing to undo" : "Nothing to redo"); return true; }
  const to = dir < 0 ? s.redo : s.undo;
  to.push(s.last);
  s.last = from.pop();
  s.at = 0; s.target = null;
  undoApply(tplId, s.last);
  updateUndoButtons();
  showToast(dir < 0 ? "Undone" : "Redone");
  return true;
}

function updateUndoButtons() {
  const u = $("undoBtn"), r = $("redoBtn");
  if (!u || !r) return;
  const s = undoStacks[activeTpl];
  u.disabled = !(s && s.undo.length);
  r.disabled = !(s && s.redo.length);
}

(function wireUndo() {
  const u = $("undoBtn"), r = $("redoBtn");
  if (u) u.addEventListener("click", () => undoStep(-1));
  if (r) r.addEventListener("click", () => undoStep(1));
  // Capture phase: runs before the browser's own per-box undo, which only knows the box you are in
  // and loses its history whenever the form redraws.
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const isUndo = k === "z" && !e.shiftKey;
    const isRedo = k === "y" || (k === "z" && e.shiftKey);
    if (!isUndo && !isRedo) return;
    const fill = $("fillView");
    if (!fill || fill.classList.contains("hidden") || (typeof isEditing !== "undefined" && isEditing)) return;
    if (typeof settingsOpen !== "undefined" && settingsOpen) return;
    const a = document.activeElement;
    // Boxes outside the form (search, Cases panel, dialogs) keep the browser's normal undo.
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable) && !a.closest("#fields")) return;
    e.preventDefault();
    undoStep(isUndo ? -1 : 1);
  }, true);
  // Switching templates changes which history the buttons show.
  document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("#tabs")) setTimeout(updateUndoButtons, 0); });
  updateUndoButtons();
})();

// ── Undo / redo inside Settings (placeholder editor and warning editor) ──
// The editors work on a draft that only becomes real on Save, so this history lives
// for as long as one editor is open and starts fresh each time one opens.
const settingsUndo = { ref: null, undo: [], redo: [], at: 0, target: null };

function settingsCurrentDraft() {
  if (typeof settingsOpen === "undefined" || !settingsOpen) return null;
  if (typeof settingsDraft !== "undefined" && settingsDraft) return settingsDraft;
  if (typeof warnDraft !== "undefined" && warnDraft) return warnDraft;
  return null;
}
function settingsUndoSync() {
  const d = settingsCurrentDraft();
  if (d !== settingsUndo.ref) { settingsUndo.ref = d; settingsUndo.undo = []; settingsUndo.redo = []; settingsUndo.at = 0; settingsUndo.target = null; }
  return d;
}
function settingsFocusInfo() {
  const el = document.activeElement;
  if (!el || !el.closest || !el.closest("#settingsBody")) return null;
  let sel = el.tagName.toLowerCase();
  if (el.id) sel += "#" + el.id;
  else Object.keys(el.dataset || {}).forEach((k) => { sel += `[data-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}="${String(el.dataset[k]).replace(/"/g, '\\"')}"]`; });
  return { sel, caret: el.selectionStart };
}
function settingsUndoStep(dir) {
  const d = settingsUndoSync();
  if (!d) return false;
  const from = dir < 0 ? settingsUndo.undo : settingsUndo.redo;
  if (!from.length) { showToast(dir < 0 ? "Nothing to undo" : "Nothing to redo"); return true; }
  (dir < 0 ? settingsUndo.redo : settingsUndo.undo).push(JSON.stringify(d));
  const o = JSON.parse(from.pop());
  const body = $("settingsBody");
  const scroll = body ? (document.scrollingElement || document.documentElement).scrollTop : 0;
  const focus = settingsFocusInfo();
  const act = document.activeElement;
  if (act && act.closest && act.closest("#settingsBody") && act.blur) act.blur();
  // Put the old values back into the SAME draft object, so everything holding it stays valid.
  Object.keys(d).forEach((k) => { delete d[k]; });
  Object.assign(d, o);
  settingsUndo.at = 0; settingsUndo.target = null;
  if (typeof settingsDraft !== "undefined" && settingsDraft === d) renderSettingsEditor(); else renderWarningEditor();
  (document.scrollingElement || document.documentElement).scrollTop = scroll;
  if (focus) {
    const el = document.querySelector("#settingsBody " + focus.sel);
    if (el && el.focus) { el.focus(); try { const n = el.value.length; const c = Math.min(focus.caret == null ? n : focus.caret, n); el.setSelectionRange(c, c); } catch (e) {} }
  }
  showToast(dir < 0 ? "Undone" : "Redone");
  return true;
}

(function wireSettingsUndo() {
  const body = $("settingsBody");
  if (!body) return;
  // Capture phase = before the editor's own handler changes the draft, so we see how it looked before.
  const before = (e) => {
    const d = settingsUndoSync();
    if (!d) return;
    const snap = JSON.stringify(d);
    const target = e.target;
    setTimeout(() => {
      if (settingsCurrentDraft() !== d) return;
      if (JSON.stringify(d) === snap) return; // nothing changed (Save, Cancel, a click on empty space...)
      const t = Date.now();
      const typing = e.type === "input" && (target.tagName === "TEXTAREA" || target.tagName === "INPUT");
      const burst = typing && settingsUndo.target === target && (t - settingsUndo.at) < UNDO_BURST_MS && settingsUndo.undo.length;
      // A checkbox fires both click and change for one edit: the second finds the same "before" already on top.
      if (!burst && settingsUndo.undo[settingsUndo.undo.length - 1] !== snap) { settingsUndo.undo.push(snap); if (settingsUndo.undo.length > UNDO_LIMIT) settingsUndo.undo.shift(); }
      settingsUndo.redo = [];
      settingsUndo.at = t; settingsUndo.target = typing ? target : null;
    }, 0);
  };
  ["input", "change", "click"].forEach((t) => body.addEventListener(t, before, true));
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const isUndo = k === "z" && !e.shiftKey;
    const isRedo = k === "y" || (k === "z" && e.shiftKey);
    if (!isUndo && !isRedo) return;
    if (!settingsCurrentDraft()) return;
    const a = document.activeElement;
    if (a && a.closest && !a.closest("#settingsBody") && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
    if (document.querySelector(".modal:not(.hidden), .dialog:not(.hidden)")) { /* dialogs keep normal behaviour */ }
    e.preventDefault();
    settingsUndoStep(isUndo ? -1 : 1);
  }, true);
})();
