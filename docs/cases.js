// ── Cases panel (left side) ─────────────────────────────────────────────
// A running log of the notes you copy. Every time you press Copy on a template
// the finished note is added here, so the day's cases sit next to the form and
// can be copied again, copied all at once, or loaded back into the form.
//
// Copying a note with the same case ID (I-12345678) again updates that case
// instead of adding a duplicate, so fixing a note and re-copying is safe. A note with no case ID that is
// re-copied the same day with only small edits (>= 75% of lines unchanged) also updates its case.
// Stored in chrome.storage.local as cnh_cases (oldest first). It is included in
// Export / Import backups (not in snapshots).
//
// Pictures (screenshots attached to the note) are kept with the case too (v1.20.0): in the list they show
// in place of the "[Image: Findings 1]" markers (click one to enlarge), Copy / Copy day / Copy all put the
// text AND the pictures on the clipboard, and Edit puts them back in the form. Each case's pictures are
// stored under their own key (cnh_ci_<case id>) so saving the list stays small. Since v1.20.2 they ARE part of
// Export / Import backups (as "caseImages"), along with the pictures on the forms.

const MAX_CASES = 500;             // oldest are dropped beyond this
const CASE_ID_RE = /\bI-\s*([A-Za-z0-9]{3,})\b/i;

// The key that says "this is the same case": the I-number in the note, or else the {caseId} field's value.
function caseKeyFor(tplId, text, vals) {
  const m = String(text || "").match(CASE_ID_RE);
  if (m) return "I-" + m[1].toUpperCase();
  const v = vals && typeof vals.caseId === "string" ? vals.caseId.trim() : "";
  const id = v.replace(/^I-\s*/i, "").trim();
  return id ? "I-" + id.toUpperCase() : "";
}

let cases = [];                    // [{ id, at, upd, tpl, tplName, key, text, vals, modes, imgs: [{ n, s }] }]  (imgs live under cnh_ci_<id>)
const CASE_IMG_PREFIX = "cnh_ci_";
let casesSearch = "";
let casesDate = "";                // "YYYY-MM-DD" when the date selector is set, "" = all dates (not remembered between sessions)

function saveCases() {
  // the pictures are stored separately (see saveCaseImages), so the list itself stays small
  const slim = cases.map((c) => { const { imgs, ...rest } = c; return rest; });
  chrome.storage.local.set({ cnh_cases: slim }, () => {
    if (chrome.runtime.lastError) showToast("Couldn't save the case (storage full?)");
  });
}
function saveCaseImages(c) {
  const key = CASE_IMG_PREFIX + c.id;
  const has = Array.isArray(c.imgs) && c.imgs.some((x) => x && x.s);
  if (has) {
    chrome.storage.local.set({ [key]: c.imgs }, () => {
      if (chrome.runtime.lastError) showToast("Couldn't save the case pictures (storage full?)");
    });
  } else {
    chrome.storage.local.remove(key);
  }
}
function dropCaseImages(ids) {
  const keys = (ids || []).map((id) => CASE_IMG_PREFIX + id);
  if (keys.length) chrome.storage.local.remove(keys);
}
function loadCaseImages(done) {
  const keys = cases.map((c) => CASE_IMG_PREFIX + c.id);
  if (!keys.length) { done(); return; }
  chrome.storage.local.get(keys, (res) => {
    cases.forEach((c) => {
      const v = res && res[CASE_IMG_PREFIX + c.id];
      if (Array.isArray(v)) c.imgs = v.filter((x) => x && typeof x.n === "string" && typeof x.s === "string");
    });
    done();
  });
}

// Showing by default (the window opens at its full size with the panel open); hide/show it with the header "Cases" button or Settings > General.
function casesPanelOpen() { return appSettings.casesPanelShown === true; }
function casesLogOn() { return appSettings.logCases !== false; }
// Only the templates ticked for the Cases panel are logged (Question-and-answer
// style templates stay out of it). Ticked per template: the "Log to Cases" box
// next to Copy, or Settings > General > Cases panel.
function casesLogFor(tplId) { return casesLogOn() && (appSettings.caseTpls || []).includes(tplId); }
function setCasesLogFor(tplId, on) {
  const set = new Set(appSettings.caseTpls || []);
  if (on) set.add(tplId); else set.delete(tplId);
  appSettings.caseTpls = [...set];
  saveAppSettings();
  syncCasesLogToggle();
}
function syncCasesLogToggle() {
  const box = $("casesLogChk");
  if (box) box.checked = casesLogFor(activeTpl);
  const wrap = $("casesLogWrap");
  if (wrap) wrap.classList.toggle("is-off", !casesLogOn());
}

// The window keeps its RIGHT edge where it is; the dashboard is pinned to that edge with a fixed
// width (see .shell in popup.css). Showing the panel grows the window to the LEFT by the panel's
// width and hides nothing of the dashboard; hiding it shrinks the window back from the left.
//
// Windows briefly shows the OLD picture while a window is being resized, which is what looks like
// the dashboard jumping. So while the window is being resized the page is blanked (same background
// colour, content hidden), the window is resized, the dashboard's position on screen is checked,
// and only then is everything shown again. Alternatively, Settings > General > Cases panel has
// "Keep the window wide": the extra width is kept all the time, so the window NEVER resizes.
const CASES_PANEL_WIDTH = 330; // default; the real width is whatever you dragged the divider to (appSettings.casesPanelW)
function casesPanelW() { const v = Number(appSettings.casesPanelW); return v >= 200 && v <= 700 ? Math.round(v) : CASES_PANEL_WIDTH; }
let winHasExtra = false; // does the window currently include the room for the panel?
function casesWideOn() { return appSettings.casesWide === true; }

// Sets the window's left edge and width so that its RIGHT edge stays exactly where it was (the dashboard is
// pinned to that edge, so this is what keeps the dashboard still). The result is read back from Chrome and
// repaired if the system applied it differently (only the width, only the position, a few pixels off, ...).
async function setBoundsKeepRight(id, left, right) {
  const want = { left, width: right - left };
  const ok = (w) => w && Math.abs(w.left - want.left) <= 2 && Math.abs(w.left + w.width - right) <= 2;
  try { await chrome.windows.update(id, want); } catch (e) { /* checked below */ }
  await sleep(40);
  let now = await chrome.windows.getCurrent();
  if (ok(now)) return;
  // piece by piece: move first, then change the width
  try { await chrome.windows.update(id, { left: want.left }); } catch (e) { /* checked below */ }
  try { await chrome.windows.update(id, { width: want.width }); } catch (e) { /* checked below */ }
  await sleep(40);
  now = await chrome.windows.getCurrent();
  if (ok(now)) return;
  // last resort: put the right edge back where it was
  const diff = Math.round(now.left + now.width - right);
  if (diff) { try { await chrome.windows.update(id, { left: now.left - diff }); } catch (e) { /* cosmetic */ } }
}

async function resizeForPanel(open, panelW) {
  try {
    if (!chrome.windows || !chrome.windows.getCurrent) return;
    const win = await chrome.windows.getCurrent();
    if (!win || win.type !== "popup" || win.state === "maximized" || win.state === "fullscreen") return;
    const right = win.left + win.width;
    let newLeft;
    if (open) {
      newLeft = win.left - casesPanelW();
      try {
        const displays = chrome.system && chrome.system.display ? await chrome.system.display.getInfo() : [];
        const cx = win.left + win.width / 2;
        const cy = win.top + win.height / 2;
        const d = displays.find((x) => cx >= x.bounds.left && cx < x.bounds.left + x.bounds.width && cy >= x.bounds.top && cy < x.bounds.top + x.bounds.height);
        const area = d && (d.workArea || d.bounds);
        if (area && newLeft < area.left) newLeft = area.left;
      } catch (e) { /* no display info: use the plain numbers */ }
    } else {
      // give back exactly the room that is there beyond the dashboard (not an assumed 330, which differs when the window was held back at a screen edge)
      const extra = Math.round(document.documentElement.clientWidth - dashWidth());
      newLeft = win.left + (extra > 0 ? extra : (panelW || casesPanelW()));
    }
    await setBoundsKeepRight(win.id, Math.round(newLeft), right);
  } catch (e) { /* resizing is a nicety; showing/hiding the panel still works */ }
}

let panelBusy = false; // true while the window is being resized for the panel
let panelBusyTimer;
let casesQueue = Promise.resolve(); // one window change at a time

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Waits until the window's layout width has really changed (the OS resize has landed), up to ~700ms.
async function waitForLayoutChange(fromWidth) {
  for (let i = 0; i < 44; i++) {
    if (Math.abs(window.innerWidth - fromWidth) >= 50) { await sleep(40); return true; }
    await sleep(16);
  }
  return false;
}
// Grows (true) or shrinks (false) the window by the panel's width with the page blanked meanwhile.
// "reveal" runs while the page is still blank, after the resize has landed.
async function changeWindowRoom(grow, panelW, reveal) {
  if (window.__TECHNOTES_WEB) { winHasExtra = grow; if (reveal) reveal(); applyCasesPanelState(); return; } // web: no window to resize, so no blanking either
  if (grow === winHasExtra) { if (reveal) reveal(); return; }
  const root = document.documentElement;
  const beforeW = window.innerWidth;
  root.classList.add("is-resizing");
  await sleep(70); // let the blank frame reach the screen before the window changes size
  await resizeForPanel(grow, panelW);
  if (await waitForLayoutChange(beforeW)) winHasExtra = grow;
  else if (!(window.innerWidth === beforeW)) winHasExtra = grow;
  if (reveal) reveal();
  applyCasesPanelState(); // arrow tab goes to its new spot while the page is still blank
  await sleep(50);
  root.classList.remove("is-resizing");
}

function setCasesPanel(open) {
  if (open === casesPanelOpen()) return;
  const panel = $("casesPanel");
  const panelW = panel && !panel.classList.contains("hidden") ? panel.offsetWidth : casesPanelW();
  appSettings.casesPanelShown = open;
  saveAppSettings();
  runCasesWindowChange(async () => {
    if (open) {
      // grow the window (if it has no room yet), then reveal the panel in the space that opened up
      await changeWindowRoom(true, panelW, () => applyCasesPanelState());
    } else {
      applyCasesPanelState(); // hide the panel first ...
      // ... then shrink the window, unless the window is kept wide
      if (!casesWideOn()) await changeWindowRoom(false, panelW);
    }
  });
}

// "Keep the window wide" switch in Settings: the window then always has room for the panel.
function setCasesWide(on) {
  appSettings.casesWide = on;
  saveAppSettings();
  runCasesWindowChange(async () => {
    if (on) await changeWindowRoom(true, casesPanelW(), () => applyCasesPanelState());
    else if (!casesPanelOpen()) { applyCasesPanelState(); await changeWindowRoom(false, casesPanelW()); }
    else applyCasesPanelState();
  });
}

function runCasesWindowChange(fn) {
  panelBusy = true;
  clearTimeout(panelBusyTimer);
  casesQueue = casesQueue.then(fn).catch(() => {}).then(() => {
    lastPanelChange = Date.now();
    panelBusyTimer = setTimeout(() => { panelBusy = false; }, 600); // the dashboard keeps the width it had; it is only re-measured when you resize the window yourself
  });
}

function applyCasesPanelState() {
  const open = casesPanelOpen();
  const panel = $("casesPanel");
  if (panel) panel.classList.toggle("hidden", !open);
  const edge = $("casesEdge");
  if (edge) {
    edge.classList.toggle("is-open", open);
    edge.innerHTML = open ? "&#9666;" : "&#9656;";
    const t = open ? "Hide cases" : "Show cases";
    edge.title = t; edge.setAttribute("aria-label", t);
    const room = open && panel && panel.offsetWidth ? panel.offsetWidth : (winHasExtra ? casesPanelW() : 0);
    edge.style.left = room ? Math.max(0, room - 14) + "px" : "";
  }
  const btn = $("casesToggleBtn");
  if (btn) {
    btn.classList.toggle("is-on", open);
    setHdrIcon(btn, "sidebar");
    const t = open ? "Hide cases" : `Show cases (${cases.length})`;
    btn.title = t; btn.setAttribute("aria-label", t);
    let badge = btn.querySelector(".cases-count");
    if (!badge) { badge = document.createElement("span"); badge.className = "cases-count"; btn.append(badge); }
    badge.textContent = cases.length > 99 ? "99+" : String(cases.length);
    badge.classList.toggle("hidden", open || !cases.length); // the count only shows while the panel is closed
  }
}

// ── Logging ─────────────────────────────────────────────────────────────
function cloneFieldState(tplId) {
  const vals = {};
  const src = values[tplId] || {};
  Object.keys(src).forEach((k) => {
    if (fieldType(k) === "image" || isAttachKey(k)) return; // screenshots are too big to keep per case
    vals[k] = JSON.parse(JSON.stringify(src[k]));
  });
  return { vals, modes: JSON.parse(JSON.stringify((fieldModes && fieldModes[tplId]) || {})) };
}

// Share of the old note's non-empty lines that are still, word for word, in the new note (0 to 1).
function noteSimilarity(oldText, newText) {
  const norm = (t) => String(t || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const a = norm(oldText), b = new Set(norm(newText));
  if (!a.length) return 0;
  return a.filter((l) => b.has(l)).length / a.length;
}

function logCase(tplId, noteText, noteImgs) {
  if (!casesLogFor(tplId)) return;
  const text = String(noteText || "").replace(/\s+$/g, "");
  if (!text.trim()) return;
  const state = cloneFieldState(tplId);
  const imgs = Array.isArray(noteImgs) ? noteImgs.filter((x) => x && typeof x.n === "string") : [];
  const key = caseKeyFor(tplId, text, state.vals);
  const now = Date.now();
  // Same template + same case ID = same case: overwrite it instead of adding another one.
  // (No case ID at all: a note with exactly the same text on the same template counts as the same case.)
  let existing = null;
  if (key) existing = cases.find((c) => c.tpl === tplId && (c.key ? String(c.key).toUpperCase() === key : caseKeyFor(c.tpl, c.text, c.vals) === key));
  else existing = cases.find((c) => c.tpl === tplId && c.text === text);
  // Editing a note and copying it again (e.g. filling in a blank case ID after the first copy) is still the
  // same case: if no case matched by ID, reuse a same-template, same-day case that had no case ID and whose
  // text is almost identical to this note (v1.19.2).
  if (!existing) {
    const today = dayKey(now);
    for (let i = cases.length - 1; i >= 0; i--) {
      const c = cases[i];
      if (c.tpl !== tplId || dayKey(c.at) !== today) continue;
      if (c.key || caseKeyFor(c.tpl, c.text, c.vals)) continue;
      if (noteSimilarity(c.text, text) >= 0.75) { existing = c; break; }
    }
  }
  if (existing) {
    Object.assign(existing, { upd: now, tpl: tplId, tplName: labelForTpl(tplId), key, text, vals: state.vals, modes: state.modes, imgs });
  } else {
    cases.push({ id: "c" + now.toString(36) + Math.random().toString(36).slice(2, 6), at: now, upd: now, tpl: tplId, tplName: labelForTpl(tplId), key, text, vals: state.vals, modes: state.modes, imgs });
    if (cases.length > MAX_CASES) {
      dropCaseImages(cases.slice(0, cases.length - MAX_CASES).map((x) => x.id));
      cases = cases.slice(cases.length - MAX_CASES);
    }
  }
  saveCases();
  const logged = existing || cases[cases.length - 1];
  saveCaseImages(logged);
  if (casesDate && dayKey(logged.at) !== casesDate) setCasesDate(""); // don't let the date filter hide the case that was just logged
  renderCasesPanel(logged.id);
}

// ── Rendering ───────────────────────────────────────────────────────────
function dayKey(t) { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
// Always the real date, MM/DD/YYYY (e.g. 10/26/2026) - no "Today" / "Yesterday".
function dayLabel(t) {
  const d = new Date(t);
  return String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0") + "/" + d.getFullYear();
}
function timeLabel(t) { return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }

function visibleCases() {
  const q = casesSearch.trim().toLowerCase();
  let list = cases;
  if (casesDate) list = list.filter((c) => dayKey(c.at) === casesDate);
  return q ? list.filter((c) => c.text.toLowerCase().includes(q) || (c.tplName || "").toLowerCase().includes(q)) : list;
}

// The case's note as HTML for the list: each "[Image: ...]" marker becomes the picture it stands for
// (the n-th marker is the n-th picture). Markers without a picture (older cases) stay as text.
const CASE_MARKER_RE = /\[Image: [^\]\n]*\]/g;
const CASE_MARKER_NL_RE = /\[Image: [^\]\n]*\]\n?/g; // list view: the picture is a block, so the line break after it is dropped
function caseTextHtml(c) {
  const imgs = Array.isArray(c.imgs) ? c.imgs : [];
  let i = 0;
  return escHtml(c.text).replace(CASE_MARKER_NL_RE, (m) => {
    const im = imgs[i++];
    if (!im || !im.s) return m;
    m = m.replace(/\n$/, "");
    return `</span><img class="case-img" src="${im.s}" alt="${escAttr(m)}" title="${escAttr(m)} (click to enlarge)" data-case-img="1"><span>`;
  });
}
// The case as rich text for the clipboard. Each picture sits on its own line (line break before and after), never beside the text (v1.20.4).
function caseToHtml(c) {
  const imgs = Array.isArray(c.imgs) ? c.imgs : [];
  return textToBlocksHtml(String(c.text || ""), CASE_MARKER_RE, (m, i) => {
    const im = imgs[i];
    return im && im.s ? { src: im.s, alt: m[0] } : null;
  });
}
function caseHasImages(c) { return Array.isArray(c.imgs) && c.imgs.some((x) => x && x.s); }
// Copies one or more cases: text + pictures when any case has pictures, plain text otherwise.
function copyCasesRich(list, doneMsg) {
  const plain = joinCases(list);
  if (!list.some(caseHasImages) || typeof ClipboardItem === "undefined") { copyTextToClipboard(plain, doneMsg); return; }
  const html = list.map(caseToHtml).join("<div><br></div><div><br></div>");
  navigator.clipboard.write([new ClipboardItem({
    "text/html": new Blob([html], { type: "text/html" }),
    "text/plain": new Blob([plain], { type: "text/plain" })
  })]).then(() => showToast(doneMsg.replace(/ copied$/, " copied with images").replace(/^Copied!?$/, "Copied with images")))
    .catch(() => copyTextToClipboard(plain, doneMsg + " (images couldn't be included)"));
}
// Click a picture in the list to see it full size (click or Esc to close).
function showCaseImage(src) {
  const old = document.getElementById("caseImgOverlay");
  if (old) old.remove();
  const ov = document.createElement("div");
  ov.id = "caseImgOverlay";
  ov.className = "case-img-overlay";
  ov.innerHTML = `<img src="${src}" alt="">`;
  const close = () => { ov.remove(); document.removeEventListener("keydown", onKey, true); };
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  ov.addEventListener("click", close);
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(ov);
}

function renderCasesPanel(flashId) {
  const list = $("casesList");
  if (!list) return;
  const shown = visibleCases();
  $("casesCount").textContent = cases.length ? `${shown.length === cases.length ? cases.length : shown.length + " of " + cases.length}` : "0";
  applyCasesPanelState();
  syncCasesDateUi();
  if (!cases.length) {
    list.innerHTML = `<div class="cases-empty">No cases yet.<br>Press <b>Copy</b> on a template and the note shows up here.</div>`;
    return;
  }
  if (!shown.length) {
    const what = casesDate && casesSearch.trim() ? `No cases on ${escHtml(dateKeyLabel(casesDate))} match “${escHtml(casesSearch)}”.`
      : casesDate ? `No cases on ${escHtml(dateKeyLabel(casesDate))}.`
      : `No cases match “${escHtml(casesSearch)}”.`;
    list.innerHTML = `<div class="cases-empty">${what}</div>`;
    return;
  }
  let html = "", lastDay = "";
  shown.forEach((c) => {
    const dk = dayKey(c.at);
    if (dk !== lastDay) {
      lastDay = dk;
      const n = shown.filter((x) => dayKey(x.at) === dk).length;
      html += `<div class="cases-day"><span>${escHtml(dayLabel(c.at))} · ${n}</span><button type="button" class="cases-link" data-day-copy="${dk}" title="Copy every case from this day">Copy day</button></div>`;
    }
    html += `<div class="case-card" data-case="${c.id}">
      <pre class="case-text"><span>${caseTextHtml(c)}</span></pre>
      <div class="case-meta">
        <span class="case-time">${escHtml(timeLabel(c.at))} · ${escHtml(c.tplName || "")}</span>
        <span class="case-actions">
          <button type="button" class="cases-link" data-case-copy="${c.id}">Copy</button>
          <button type="button" class="cases-link" data-case-load="${c.id}" title="Load this case back into the form to edit it">Edit</button>
          <button type="button" class="cases-link cases-del" data-case-del="${c.id}" title="Remove this case from the list">✕</button>
        </span>
      </div>
    </div>`;
  });
  list.innerHTML = html;
  if (flashId) {
    const el = list.querySelector(`[data-case="${flashId}"]`);
    if (el) { el.classList.add("is-new"); el.scrollIntoView({ block: "nearest" }); }
  } else {
    list.scrollTop = list.scrollHeight;
  }
}

// ── Date selector + mini calendar ────────────────────────────────────────
// The "All dates" box under the search opens a small calendar. Pick a day and the list shows only that day's
// cases (Copy all / Copy day then work on what is shown). Days that have cases carry a dot. "All dates" or the ✕
// next to the box goes back to everything. The filter works together with the search box.
const CAL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CAL_DOWS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
let calView = null;      // { y, m } month being shown in the calendar
let calOpen = false;

function keyOf(y, m, d) { return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
function dateKeyLabel(k) { // "2026-10-26" -> "10/26/2026"
  const p = String(k).split("-");
  return p.length === 3 ? p[1] + "/" + p[2] + "/" + p[0] : String(k);
}

function syncCasesDateUi() {
  const btn = $("casesDateBtn");
  if (!btn) return;
  $("casesDateLabel").textContent = casesDate ? dateKeyLabel(casesDate) : "All dates";
  btn.classList.toggle("is-set", !!casesDate);
  $("casesDateClear").classList.toggle("hidden", !casesDate);
}

function setCasesDate(key) {
  casesDate = key || "";
  syncCasesDateUi();
  renderCasesPanel();
}

function daysWithCases() {
  const set = new Set();
  cases.forEach((c) => set.add(dayKey(c.at)));
  return set;
}

function renderCasesCalendar() {
  const cal = $("casesCal");
  if (!cal) return;
  if (!calView) {
    const base = casesDate ? new Date(casesDate + "T00:00:00") : new Date();
    calView = { y: base.getFullYear(), m: base.getMonth() };
  }
  const { y, m } = calView;
  const has = daysWithCases();
  const todayKey = dayKey(Date.now());
  const first = new Date(y, m, 1).getDay();           // weekday of the 1st (0 = Sunday)
  const dim = new Date(y, m + 1, 0).getDate();       // days in this month
  const prevDim = new Date(y, m, 0).getDate();       // days in the month before
  let cells = "";
  for (let i = 0; i < 42; i++) {                      // always 6 rows so the calendar never changes height
    let cy = y, cm = m, cd = i - first + 1, out = false;
    if (cd < 1) { cm = m - 1; cd = prevDim + cd; out = true; }
    else if (cd > dim) { cm = m + 1; cd = cd - dim; out = true; }
    if (cm < 0) { cm = 11; cy = y - 1; } else if (cm > 11) { cm = 0; cy = y + 1; }
    const k = keyOf(cy, cm, cd);
    const cls = ["cal-day", out ? "is-out" : "", k === todayKey ? "is-today" : "", k === casesDate ? "is-selected" : "", has.has(k) ? "has-cases" : ""].filter(Boolean).join(" ");
    cells += `<button type="button" class="${cls}" data-cal-day="${k}" aria-label="${escHtml(dateKeyLabel(k))}${has.has(k) ? ", has cases" : ""}"${k === casesDate ? ' aria-pressed="true"' : ""}>${cd}</button>`;
  }
  cal.innerHTML = `
    <div class="cal-head">
      <button type="button" class="cal-nav" data-cal-nav="-12" title="Previous year" aria-label="Previous year">«</button>
      <button type="button" class="cal-nav" data-cal-nav="-1" title="Previous month" aria-label="Previous month">‹</button>
      <div class="cal-title">${CAL_MONTHS[m]} ${y}</div>
      <button type="button" class="cal-nav" data-cal-nav="1" title="Next month" aria-label="Next month">›</button>
      <button type="button" class="cal-nav" data-cal-nav="12" title="Next year" aria-label="Next year">»</button>
    </div>
    <div class="cal-grid">${CAL_DOWS.map((d) => `<div class="cal-dow">${d}</div>`).join("")}${cells}</div>
    <div class="cal-foot">
      <button type="button" class="cases-link" data-cal-today>Today</button>
      <button type="button" class="cases-link" data-cal-all>All dates</button>
    </div>`;
}

function setCalendarOpen(open) {
  const cal = $("casesCal"), btn = $("casesDateBtn");
  if (!cal || !btn) return;
  calOpen = open;
  if (open) { calView = null; renderCasesCalendar(); }
  cal.classList.toggle("hidden", !open);
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    const sel = cal.querySelector(".is-selected") || cal.querySelector(".is-today") || cal.querySelector(".cal-day:not(.is-out)");
    if (sel) sel.focus({ preventScroll: true });
  }
}

function moveCalendarMonth(delta) {
  if (!calView) return;
  const d = new Date(calView.y, calView.m + delta, 1);
  calView = { y: d.getFullYear(), m: d.getMonth() };
  renderCasesCalendar();
}

function wireCasesDate() {
  const btn = $("casesDateBtn"), cal = $("casesCal"), row = $("casesDateRow");
  if (!btn || !cal) return;
  btn.addEventListener("click", () => setCalendarOpen(!calOpen));
  $("casesDateClear").addEventListener("click", () => { setCasesDate(""); setCalendarOpen(false); });
  cal.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.calDay) { setCasesDate(t.dataset.calDay); setCalendarOpen(false); btn.focus(); }
    else if (t.dataset.calNav) {
      moveCalendarMonth(parseInt(t.dataset.calNav, 10));
      const again = cal.querySelector(`[data-cal-nav="${t.dataset.calNav}"]`); if (again) again.focus();
    }
    else if (t.hasAttribute("data-cal-today")) { setCasesDate(dayKey(Date.now())); setCalendarOpen(false); btn.focus(); }
    else if (t.hasAttribute("data-cal-all")) { setCasesDate(""); setCalendarOpen(false); btn.focus(); }
  });
  // Arrow keys move between days; Escape closes the calendar.
  cal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); setCalendarOpen(false); btn.focus(); return; }
    const t = e.target.closest(".cal-day");
    if (!t) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const d = new Date(t.dataset.calDay + "T00:00:00");
    d.setDate(d.getDate() + step);
    if (d.getFullYear() !== calView.y || d.getMonth() !== calView.m) { calView = { y: d.getFullYear(), m: d.getMonth() }; renderCasesCalendar(); }
    const next = cal.querySelector(`[data-cal-day="${keyOf(d.getFullYear(), d.getMonth(), d.getDate())}"]`);
    if (next) next.focus();
  });
  // Click anywhere else (or press Escape on the box) and the calendar closes.
  document.addEventListener("mousedown", (e) => { if (calOpen && !row.contains(e.target)) setCalendarOpen(false); });
  btn.addEventListener("keydown", (e) => { if (e.key === "Escape" && calOpen) { e.stopPropagation(); setCalendarOpen(false); } });
}

// ── Actions ─────────────────────────────────────────────────────────────
function joinCases(list) { return list.map((c) => c.text).join("\n\n\n"); }

function formHasContent(tplId) {
  return Object.values(values[tplId] || {}).some((v) => v && (typeof v !== "object" || Object.keys(v).length));
}

function loadCaseIntoForm(c) {
  if (!templates[c.tpl] || tabType(c.tpl) !== "template") { showToast("That template no longer exists"); return; }
  if ($("fillView").classList.contains("hidden")) { showToast("Close Settings / the editor first, then load the case"); return; }
  if (formHasContent(c.tpl) && !confirm("Replace what's in the form with this case?")) return;
  values[c.tpl] = JSON.parse(JSON.stringify(c.vals || {}));
  // put the case's pictures back into their boxes (same order as in the note)
  (Array.isArray(c.imgs) ? c.imgs : []).forEach((im) => {
    if (!im || !im.s || !im.n) return;
    if (!Array.isArray(values[c.tpl][im.n])) values[c.tpl][im.n] = [];
    values[c.tpl][im.n].push(im.s);
  });
  if (!fieldModes) fieldModes = {};
  fieldModes[c.tpl] = JSON.parse(JSON.stringify(c.modes || {}));
  saveValuesDebounced();
  if (typeof saveFieldModesDebounced === "function") saveFieldModesDebounced();
  else chrome.storage.local.set({ cnh_fieldModes: fieldModes });
  activeTpl = c.tpl;
  renderTabs();
  renderActiveView();
  window.scrollTo(0, 0);
  showToast("Loaded — copy again to update this case");
}

function wireCasesPanel() {
  const list = $("casesList");
  list.addEventListener("click", (e) => {
    if (e.target && e.target.dataset && e.target.dataset.caseImg) { showCaseImage(e.target.src); return; }
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.caseCopy) {
      const c = cases.find((x) => x.id === t.dataset.caseCopy);
      if (c) copyCasesRich([c], "Case copied");
    } else if (t.dataset.caseLoad) {
      const c = cases.find((x) => x.id === t.dataset.caseLoad);
      if (c) loadCaseIntoForm(c);
    } else if (t.dataset.caseDel) {
      dropCaseImages([t.dataset.caseDel]);
      cases = cases.filter((x) => x.id !== t.dataset.caseDel);
      saveCases(); renderCasesPanel(); showToast("Case removed");
    } else if (t.dataset.dayCopy) {
      const day = visibleCases().filter((x) => dayKey(x.at) === t.dataset.dayCopy);
      copyCasesRich(day, `${day.length} case${day.length === 1 ? "" : "s"} copied`);
    }
  });
  $("casesCopyAll").addEventListener("click", () => {
    const v = visibleCases();
    if (!v.length) { showToast("Nothing to copy"); return; }
    copyCasesRich(v, `${v.length} case${v.length === 1 ? "" : "s"} copied`);
  });
  $("casesClear").addEventListener("click", () => clearAllCases());
  $("casesHide").addEventListener("click", () => { setCalendarOpen(false); setCasesPanel(false); });
  wireCasesDate();
  $("casesToggleBtn").addEventListener("click", () => setCasesPanel(!casesPanelOpen()));
  $("casesEdge").addEventListener("click", () => setCasesPanel(!casesPanelOpen()));
  $("casesLogChk").addEventListener("change", (e) => setCasesLogFor(activeTpl, e.target.checked));
  const s = $("casesSearch");
  s.addEventListener("input", () => { casesSearch = s.value; renderCasesPanel(); });
  s.addEventListener("keydown", (e) => { if (e.key === "Escape") { s.value = ""; casesSearch = ""; renderCasesPanel(); } });
}

// Used by Import: replaces the list with the one from the backup file. `imgMap` ({ caseId: [{ n, s }] }) carries
// the pictures when the backup has them (v1.20.2+); older backups have none, and cases with the same id keep theirs.
function importCases(list, imgMap) {
  const oldIds = cases.map((c) => c.id);
  cases = (Array.isArray(list) ? list : []).filter((c) => c && c.id && typeof c.text === "string" && typeof c.at === "number");
  if (cases.length > MAX_CASES) cases = cases.slice(cases.length - MAX_CASES);
  const keep = new Set(cases.map((c) => c.id));
  dropCaseImages(oldIds.filter((id) => !keep.has(id))); // pictures of cases that are no longer in the list
  saveCases();
  const toStore = {};
  if (imgMap && typeof imgMap === "object") {
    cases.forEach((c) => {
      const v = imgMap[c.id];
      if (Array.isArray(v)) {
        const ok = v.filter((x) => x && typeof x.n === "string" && typeof x.s === "string");
        if (ok.length) toStore[CASE_IMG_PREFIX + c.id] = ok;
      }
    });
  }
  const done = () => loadCaseImages(() => renderCasesPanel());
  if (Object.keys(toStore).length) {
    chrome.storage.local.set(toStore, () => {
      if (chrome.runtime.lastError) showToast("Couldn't restore the case pictures (storage full?)");
      done();
    });
  } else done();
}

function clearAllCases() {
  if (!cases.length) { showToast("No cases to clear"); return; }
  if (!confirm(`Remove all ${cases.length} case${cases.length === 1 ? "" : "s"} from the Cases panel? This can't be undone.`)) return;
  dropCaseImages(cases.map((c) => c.id));
  cases = [];
  casesDate = "";
  saveCases(); renderCasesPanel(); showToast("Cases cleared");
}

// The dashboard's fixed width. It is measured ONCE (the first time the window opens in a known state) and
// stored; theme-init.js applies it before the first paint on every later open. It is never re-measured when
// the panel opens/closes or the window is resized, so it cannot drift, stretch or shrink.
function dashWidth() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dash-w"));
  return v > 0 ? v : 534;
}
async function measureDashboardWidthOnce() {
  if (window.__TECHNOTES_WEB) return;
  try { if (parseInt(localStorage.getItem("cnh_dashW2"), 10) >= 480) return; } catch (e) { return; }
  try {
    // only trust the measurement when the window still has the size background.js gave it
    const win = await chrome.windows.getCurrent();
    const room = winHasExtra ? casesPanelW() : 0;
    if (!win || Math.abs(win.width - (550 + room)) > 2) return;
    const w = Math.round(document.documentElement.clientWidth - room);
    if (!(w >= 480 && w <= 560)) return;
    localStorage.setItem("cnh_dashW2", String(w));
    document.documentElement.style.setProperty("--dash-w", w + "px");
  } catch (e) { /* keep the default width */ }
}
// Only the arrow tab follows the window (it sits on the panel's edge); the dashboard itself never moves.
function placeCasesEdge() {
  const panel = $("casesPanel");
  const shown = panel && !panel.classList.contains("hidden");
  const edge = $("casesEdge");
  if (!edge) return;
  const room = shown && panel.offsetWidth ? panel.offsetWidth : (winHasExtra ? casesPanelW() : 0);
  edge.style.left = room ? Math.max(0, room - 14) + "px" : "";
}

// Resizing the window by hand sets the dashboard's width (and it is remembered). Resizes caused by showing/hiding
// the Cases panel are ignored, as is anything while the panel is open, so toggling never changes the width.
let followTimer;
let lastPanelChange = 0;
let prevCw = 0;
const MAX_DASH_W = 6000; // no practical limit: a wide / maximized window is filled edge to edge
// Runs on EVERY resize event (no debounce), so the dashboard follows the edge you are dragging - left or right -
// and no blank strip ever shows while you drag.
//  - Panel open: the panel itself soaks up the extra width (it is flexible), nothing to do here.
//  - Panel hidden: the dashboard is exactly as wide as the window.
//  - "Keep the window wide" with the panel hidden: the reserved panel room stays, the dashboard gets the extra.
function followManualResize() {
  if (window.__TECHNOTES_WEB) return; // web: widths are set by dragging the grips (web/webresize.js), not by the browser window
  clearTimeout(followTimer);
  const cw = Math.round(document.documentElement.clientWidth);
  const delta = prevCw ? cw - prevCw : 0;
  prevCw = cw;
  if (casesPanelOpen()) return;
  // The window is being resized for the panel right now: look again once that is over, instead of giving up.
  const wait = 1500 - (Date.now() - lastPanelChange);
  if (panelBusy || wait > 0) {
    followTimer = setTimeout(() => { prevCw = 0; followManualResize(); }, Math.max(120, wait));
    return;
  }
  let w = cw;
  if (casesWideOn()) w = Math.round(dashWidth()) + delta; // keep the reserved room, give the extra to the dashboard
  if (!(w >= 360 && w <= MAX_DASH_W) || Math.abs(w - dashWidth()) < 1) return;
  document.documentElement.style.setProperty("--dash-w", w + "px");
  clearTimeout(saveDashTimer);
  saveDashTimer = setTimeout(() => { try { localStorage.setItem("cnh_dashW2", String(Math.round(dashWidth()))); } catch (e) { /* not remembered */ } }, 300);
}
let saveDashTimer;

// When the window opens (it comes back at the size it had last time), the dashboard takes its width from it:
// panel hidden -> the whole window; panel showing -> the remembered split (never leaving the panel under 200px).
// The window itself is never resized here.
function settleDashboardOnOpen() {
  if (window.__TECHNOTES_WEB) return;
  try {
    const cw = Math.round(document.documentElement.clientWidth);
    let w;
    if (casesPanelOpen() || casesWideOn()) {
      w = Math.round(dashWidth());
      // First open with the panel showing by default: dashboard + panel share the window (panel gets its normal width).
      let firstSplit = false;
      try { firstSplit = !localStorage.getItem("cnh_defaultSplit1"); } catch (e) { /* fine */ }
      if (firstSplit && casesPanelOpen()) {
        w = Math.max(400, cw - casesPanelW());
        try { localStorage.setItem("cnh_defaultSplit1", "1"); } catch (e) { /* fine */ }
      }
      if (w > cw - 200) w = Math.max(400, cw - 200);
    } else {
      w = cw;
    }
    if (!(w >= 360 && w <= MAX_DASH_W) || Math.abs(w - dashWidth()) <= 1) return;
    document.documentElement.style.setProperty("--dash-w", w + "px");
    localStorage.setItem("cnh_dashW2", String(w));
  } catch (e) { /* keep what is there */ }
}

// ── Divider between the Cases panel and the dashboard ─────────────────────
// Drag it left/right: the window keeps its size, the panel takes what you give it and the dashboard adjusts
// (never below 400px). The split is remembered: the window opens/grows by that panel width next time.
const MIN_DASH = 400, MIN_PANEL = 200;
function wireCasesSplitter() {
  if (window.__TECHNOTES_WEB) return; // web: webresize.js wires this divider (it resizes the panel itself)
  const bar = $("casesSplitter");
  if (!bar) return;
  let dragging = false;
  bar.addEventListener("pointerdown", (e) => {
    if (!casesPanelOpen()) return;
    dragging = true;
    try { bar.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    document.documentElement.classList.add("is-splitting");
    e.preventDefault();
  });
  bar.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const total = document.documentElement.clientWidth;
    let dash = Math.round(total - e.clientX); // the divider sits where the panel ends
    dash = Math.max(MIN_DASH, Math.min(total - MIN_PANEL, dash));
    document.documentElement.style.setProperty("--dash-w", dash + "px");
    placeCasesEdge();
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try { bar.releasePointerCapture(e.pointerId); } catch (err) { /* fine */ }
    document.documentElement.classList.remove("is-splitting");
    const total = document.documentElement.clientWidth;
    const dash = Math.round(dashWidth());
    try { localStorage.setItem("cnh_dashW2", String(dash)); } catch (err) { /* not remembered */ }
    appSettings.casesPanelW = Math.max(MIN_PANEL, Math.min(700, total - dash));
    saveAppSettings();
    placeCasesEdge();
  };
  bar.addEventListener("pointerup", end);
  bar.addEventListener("pointercancel", end);
  bar.addEventListener("dblclick", () => { // double-click: back to the default split
    if (!casesPanelOpen()) return;
    const total = document.documentElement.clientWidth;
    const dash = Math.max(MIN_DASH, total - CASES_PANEL_WIDTH);
    document.documentElement.style.setProperty("--dash-w", dash + "px");
    try { localStorage.setItem("cnh_dashW2", String(dash)); } catch (err) { /* not remembered */ }
    appSettings.casesPanelW = total - dash; saveAppSettings(); placeCasesEdge();
  });
}

function initCases() {
  chrome.storage.local.get("cnh_cases", (res) => {
    cases = Array.isArray(res.cnh_cases) ? res.cnh_cases.filter((c) => c && c.id && typeof c.text === "string") : [];
    loadCaseImages(() => startCasesPanel());
  });
}
function startCasesPanel() {
  {
    winHasExtra = casesPanelOpen() || casesWideOn(); // background.js opens the window wide in these cases
    wireCasesPanel();
    wireCasesSplitter();
    renderCasesPanel();
    syncCasesLogToggle();
    measureDashboardWidthOnce();
    prevCw = Math.round(document.documentElement.clientWidth);
    window.addEventListener("resize", () => { placeCasesEdge(); followManualResize(); });
    settleDashboardOnOpen(); // the dashboard keeps its width; only the arrow tab is re-placed
  }
}
