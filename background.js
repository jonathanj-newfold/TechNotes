// TechNotes opens as its own small window instead of the default
// toolbar dropdown, so it doesn't vanish the moment you click outside it
// (Chrome forces that close behavior on default_popup and it can't be
// overridden — a real window is the only way around it). Both the toolbar
// click and the Alt+C shortcut ("_execute_action", with no
// default_popup set) land here as an action click.

const WINDOW_WIDTH = 1150; // default outer width of the whole window, whether or not the Cases panel is showing
const CASES_PANEL_WIDTH = 330;
const WINDOW_HEIGHT = 990; // default outer height; Chrome trims this to the screen if it is taller
const STORAGE_KEY = "caseNotesWindowId";

// A plain JS variable would get wiped every time this service worker goes
// idle and unloads (MV3 workers don't stay alive), so the window id is kept
// in chrome.storage.session instead — that survives worker restarts and
// only clears when the browser itself closes.

let opening = false; // in-memory lock is fine here: only matters within one active worker lifetime, to stop a double-fire (e.g. rapid double shortcut press) from racing

async function getStoredWindowId() {
  const data = await chrome.storage.session.get(STORAGE_KEY);
  return typeof data[STORAGE_KEY] === "number" ? data[STORAGE_KEY] : null;
}

async function setStoredWindowId(id) {
  if (id === null) {
    await chrome.storage.session.remove(STORAGE_KEY);
  } else {
    await chrome.storage.session.set({ [STORAGE_KEY]: id });
  }
}

// The default window width is the same whether or not the Cases panel is showing
// (the panel takes its share of this width; the dashboard gets the rest).
async function windowWidth() {
  return WINDOW_WIDTH;
}

// The work area (screen minus taskbar) of the monitor that holds the given window,
// found from the window's centre. Returns null if Chrome can't say, in which case
// callers just let Chrome place the window.
async function displayAreaFor(win) {
  try {
    if (!chrome.system || !chrome.system.display || !win || typeof win.left !== "number") return null;
    const displays = await chrome.system.display.getInfo();
    if (!displays || !displays.length) return null;
    const cx = win.left + (win.width || 0) / 2;
    const cy = win.top + (win.height || 0) / 2;
    const hit = displays.find((d) => cx >= d.bounds.left && cx < d.bounds.left + d.bounds.width && cy >= d.bounds.top && cy < d.bounds.top + d.bounds.height)
      || displays.find((d) => d.isPrimary) || displays[0];
    return hit.workArea || hit.bounds;
  } catch (e) {
    return null;
  }
}

// The window's size is remembered (outer width/height) so it opens the way you left it.
const SIZE_KEY = "caseNotesWindowSize";
async function getSavedSize() {
  try {
    const data = await chrome.storage.local.get(SIZE_KEY);
    const s = data[SIZE_KEY];
    if (s && s.width >= 400 && s.width <= 3000 && s.height >= 400 && s.height <= 3000) return { width: Math.round(s.width), height: Math.round(s.height) };
  } catch (e) { /* use the defaults */ }
  return null;
}
let sizeTimer;
function rememberWindowSize(windowId) {
  clearTimeout(sizeTimer);
  sizeTimer = setTimeout(async () => {
    try {
      const id = await getStoredWindowId();
      if (id === null || id !== windowId) return;
      const win = await chrome.windows.get(windowId);
      if (!win || win.state !== "normal" || !(win.width >= 400 && win.height >= 400)) return; // minimized / maximized: keep the last normal size
      await chrome.storage.local.set({ [SIZE_KEY]: { width: win.width, height: win.height } });
    } catch (e) { /* not remembered this time */ }
  }, 350);
}
chrome.windows.onBoundsChanged.addListener((win) => { if (win) rememberWindowSize(win.id); });

const clampNum = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

async function openOrFocusCaseNotesWindow(sourceWindowId) {
  if (opening) return;
  opening = true;
  try {
    let WIDTH = await windowWidth();
    let HEIGHT = WINDOW_HEIGHT;
    // Open at the size the window had when it was last used (kept up to date by onBoundsChanged below).
    const savedSize = await getSavedSize();
    if (savedSize) { WIDTH = savedSize.width; HEIGHT = savedSize.height; }
    // Figure out where the window that triggered this lives, so Case Notes
    // opens on that same monitor (centred over that window, then kept inside
    // the monitor's usable area). Without this, "focus" only reorders stacking
    // on Case Notes' own monitor — it never crosses over to whichever
    // screen (or window) you're actually working on.
    let targetLeft = null;
    let targetTop = null;
    if (typeof sourceWindowId === "number") {
      try {
        const sourceWin = await chrome.windows.get(sourceWindowId);
        if (sourceWin && typeof sourceWin.left === "number") {
          targetLeft = Math.round(sourceWin.left + (sourceWin.width - WIDTH) / 2);
          targetTop = Math.round(sourceWin.top + (sourceWin.height - HEIGHT) / 2);
          const area = await displayAreaFor(sourceWin);
          if (area) {
            WIDTH = Math.min(WIDTH, area.width);
            HEIGHT = Math.min(HEIGHT, area.height);
            targetLeft = clampNum(targetLeft, area.left, area.left + area.width - WIDTH);
            targetTop = clampNum(targetTop, area.top, area.top + area.height - HEIGHT);
          }
        }
      } catch (e) {
        // source window info unavailable — just skip repositioning
      }
    }

    const existingId = await getStoredWindowId();
    if (existingId !== null) {
      try {
        const win = await chrome.windows.get(existingId);
        if (win) {
          if (targetLeft !== null) {
            await chrome.windows.update(existingId, { left: targetLeft, top: targetTop });
          }
          // A plain { focused: true } update is often ignored by Windows'
          // focus-stealing prevention when the request comes from a
          // background script rather than a direct user click on that
          // window — the taskbar icon flashes but the window doesn't
          // actually raise above whatever's active. Minimizing then
          // immediately restoring forces the OS to actually bring it to
          // the front (it keeps the position just set above).
          await chrome.windows.update(existingId, { state: "minimized" });
          await chrome.windows.update(existingId, { state: "normal", focused: true });
          return;
        }
      } catch (e) {
        // window no longer exists — fall through and open a new one
        await setStoredWindowId(null);
      }
    }

    const created = await chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: WIDTH,
      height: HEIGHT,
      left: targetLeft !== null ? targetLeft : undefined,
      top: targetTop !== null ? targetTop : undefined,
      focused: true
    });
    await setStoredWindowId(created.id);
  } finally {
    opening = false;
  }
}

// ── infoHub (Knowledge Base) window ───────────────────────────────────────────────
// Same idea as the main window: one real popup window that is focused (not
// duplicated) if it is already open. Opens just to the right of the Case Notes
// window that asked for it, on that window's monitor (left of it, or centred, if the
// right side has no room).
const KB_WIDTH = 1000;
const KB_HEIGHT = 720;
const KB_STORAGE_KEY = "caseNotesKbWindowId";
let openingKb = false;

// Chrome refuses to create a window whose position is mostly off-screen ("Invalid value
// for bounds"), which can happen when the spot next to the Case Notes window doesn't
// exist. So: try the preferred spot, then let Chrome choose the position, then a
// smaller size, then the bare minimum.
async function createKbWindow(left, top, width, height) {
  const base = { url: chrome.runtime.getURL("kb.html"), type: "popup", width: width || KB_WIDTH, height: height || KB_HEIGHT, focused: true };
  const attempts = [];
  if (typeof left === "number" && typeof top === "number") attempts.push({ ...base, left, top });
  attempts.push(base);
  attempts.push({ ...base, width: 900, height: 640 });
  attempts.push({ url: base.url, type: "popup" });
  let lastError;
  for (const opts of attempts) {
    try { return await chrome.windows.create(opts); } catch (e) { lastError = e; }
  }
  throw lastError;
}

// Where the Knowledge Base should sit: on the monitor of the Case Notes window (the
// open one if there is one, else the window that asked), to its right if there is room,
// else to the left of it, else centred.
async function kbPlacement(sourceWindowId) {
  let src = null;
  const mainId = await getStoredWindowId();
  if (mainId !== null) { try { src = await chrome.windows.get(mainId); } catch (e) { /* closed */ } }
  if (!src && typeof sourceWindowId === "number") { try { src = await chrome.windows.get(sourceWindowId); } catch (e) { /* gone */ } }
  if (!src || typeof src.left !== "number") return null;
  const area = await displayAreaFor(src);
  if (!area) return { area: null, left: Math.round(src.left + src.width + 10), top: Math.round(src.top), width: KB_WIDTH, height: KB_HEIGHT };
  const width = Math.min(KB_WIDTH, area.width);
  const height = Math.min(KB_HEIGHT, area.height);
  const leftEdge = src.left;
  const areaRight = area.left + area.width;
  const right = src.left + src.width + 10;
  const leftSide = leftEdge - 10 - width;
  let left;
  if (right + width <= areaRight) left = right;
  else if (leftSide >= area.left) left = leftSide;
  else left = area.left + Math.round((area.width - width) / 2);
  const top = clampNum(Math.round(src.top), area.top, area.top + area.height - height);
  return { area, left, top, width, height };
}

async function openOrFocusKbWindow(sourceWindowId) {
  if (openingKb) return;
  openingKb = true;
  try {
    const place = await kbPlacement(sourceWindowId);
    const stored = await chrome.storage.session.get(KB_STORAGE_KEY);
    const existingId = typeof stored[KB_STORAGE_KEY] === "number" ? stored[KB_STORAGE_KEY] : null;
    if (existingId !== null) {
      try {
        const win = await chrome.windows.get(existingId);
        if (win) {
          // Already open: if it is on another monitor than Case Notes, bring it over.
          if (place && place.area) {
            const kbArea = await displayAreaFor(win);
            if (!kbArea || kbArea.left !== place.area.left || kbArea.top !== place.area.top) {
              await chrome.windows.update(existingId, { state: "normal", left: place.left, top: place.top, width: place.width, height: place.height });
            }
          }
          await chrome.windows.update(existingId, { state: "minimized" });
          await chrome.windows.update(existingId, { state: "normal", focused: true });
          return;
        }
      } catch (e) {
        await chrome.storage.session.remove(KB_STORAGE_KEY);
      }
    }
    const created = place
      ? await createKbWindow(place.left, place.top, place.width, place.height)
      : await createKbWindow();
    await chrome.storage.session.set({ [KB_STORAGE_KEY]: created.id });
  } finally {
    openingKb = false;
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "cnh-open-kb") {
    openOrFocusKbWindow(msg.sourceWindowId).catch((e) => console.error("infoHub window failed to open:", e));
  }
});

// Alt+F opens infoHub from anywhere (centered on nothing in particular:
// it just follows whichever Chrome window is focused).
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-kb") return;
  let sourceId;
  try { const w = await chrome.windows.getLastFocused(); sourceId = w && w.id; } catch (e) { /* fine */ }
  openOrFocusKbWindow(sourceId).catch((e) => console.error("infoHub window failed to open:", e));
});

chrome.action.onClicked.addListener((tab) => {
  openOrFocusCaseNotesWindow(tab && tab.windowId);
});

chrome.windows.onRemoved.addListener(async (closedId) => {
  const existingId = await getStoredWindowId();
  if (closedId === existingId) {
    await setStoredWindowId(null);
  }
  const kb = await chrome.storage.session.get(KB_STORAGE_KEY);
  if (closedId === kb[KB_STORAGE_KEY]) await chrome.storage.session.remove(KB_STORAGE_KEY);
});

// popup.js seeds chrome.storage.local with defaults on first open. When updating to this
// version, forget the size remembered from before, once, so the new default size applies
// (after that, resizing the window is remembered again as usual).
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details && details.reason === "update") {
      const flag = await chrome.storage.local.get("cnh_defaultSizeApplied");
      if (!flag.cnh_defaultSizeApplied) {
        await chrome.storage.local.remove(SIZE_KEY);
        await chrome.storage.local.set({ cnh_defaultSizeApplied: 1 });
      }
    }
  } catch (e) { /* keep whatever size was remembered */ }
});
