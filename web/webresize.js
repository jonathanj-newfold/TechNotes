// Web version only: drag-to-resize for the dashboard and the Cases panel, plus the "Install app" button.
// (In the extension the window itself is resized, so none of this applies there.)
//  - Drag the divider between the Cases panel and the dashboard to resize the panel.
//  - Drag the dashboard's outer edge (right edge; left edge too while the panel is hidden) to resize the dashboard.
//  - Double-click a divider/edge to reset it. Sizes are remembered in this browser.
(function () {
  if (!window.__TECHNOTES_WEB) return;
  const root = document.documentElement;
  const K_DASH = "tn_web_dashW", K_PANEL = "tn_web_panelW";
  const MIN_DASH = 420, MIN_PANEL = 220, DEF_DASH = 620, DEF_PANEL = 330;
  const load = (k, def) => { try { const v = parseInt(localStorage.getItem(k), 10); return v > 0 ? v : def; } catch (e) { return def; } };
  const save = (k, v) => { try { localStorage.setItem(k, String(Math.round(v))); } catch (e) { /* not remembered */ } };
  let dash = load(K_DASH, DEF_DASH), panel = load(K_PANEL, DEF_PANEL);

  function apply() {
    root.style.setProperty("--dash-w", Math.round(dash) + "px");
    root.style.setProperty("--panel-w", Math.round(panel) + "px");
  }
  apply(); // before the first paint (this script sits in <head>), so nothing jumps
  const vw = () => document.documentElement.clientWidth;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function persist() { save(K_DASH, dash); save(K_PANEL, panel); save("cnh_dashW2", dash); /* also what backups' "layout" carries */ }

  // ── Install button + browser install prompt ───────────────────────────
  let deferred = null;
  const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; syncInstallBtn(); });
  window.addEventListener("appinstalled", () => { deferred = null; syncInstallBtn(); });

  function syncInstallBtn() {
    const b = document.getElementById("installBtn");
    if (b) b.classList.toggle("hidden", standalone());
  }
  function helpDialog() {
    const ua = navigator.userAgent || "";
    const ios = /iPhone|iPad|iPod/.test(ua);
    const how = ios
      ? "In Safari, tap <b>Share</b> then <b>Add to Home Screen</b>."
      : /Firefox/.test(ua)
        ? "Firefox on desktop can't install web apps. Open this page in Chrome or Edge to install it."
        : "Click the <b>install icon</b> at the right end of the address bar, or open the browser menu (⋮) and choose <b>Install TechNotes</b> (Edge: <b>Apps → Install this site as an app</b>).";
    const ov = document.createElement("div");
    ov.className = "tn-install-overlay";
    ov.innerHTML = '<div class="tn-install-box" role="dialog" aria-label="Install TechNotes"><h3>Install TechNotes</h3>' +
      "<p>Run it as its own window, with its own taskbar/dock icon, no browser tabs or address bar.</p><p>" + how + "</p>" +
      '<p class="tn-install-note">Your templates and cases stay in this browser; installing doesn\'t move or reset them.</p>' +
      '<div class="tn-install-actions"><button type="button" class="icon-btn">Got it</button></div></div>';
    const close = () => ov.remove();
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.tagName === "BUTTON") close(); });
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
    document.body.append(ov);
  }
  async function onInstall() {
    if (deferred) {
      const d = deferred; deferred = null;
      try { d.prompt(); await d.userChoice; } catch (e) { /* dismissed */ }
      return;
    }
    helpDialog();
  }

  // ── Drag handles ──────────────────────────────────────────────────────
  let panelEl, appEl, gripR, gripL;
  const panelOpen = () => panelEl && !panelEl.classList.contains("hidden") && panelEl.offsetWidth > 0;
  function placeGrips() {
    if (!appEl) return;
    const r = appEl.getBoundingClientRect();
    if (gripR) gripR.style.left = Math.round(r.right - 5) + "px";
    if (gripL) { gripL.style.left = Math.round(r.left - 5) + "px"; gripL.classList.toggle("hidden", panelOpen()); } // while the panel is open, its own divider is the left edge
  }
  function drag(el, onMove, onReset, cls) {
    let on = false;
    el.addEventListener("pointerdown", (e) => {
      on = true; try { el.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      root.classList.add("is-splitting"); root.classList.add(cls || "is-splitting");
      e.preventDefault();
    });
    el.addEventListener("pointermove", (e) => { if (on) { onMove(e.clientX); apply(); placeGrips(); } });
    const end = (e) => {
      if (!on) return; on = false;
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* fine */ }
      root.classList.remove("is-splitting"); if (cls) root.classList.remove(cls);
      persist(); placeGrips();
    };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    el.addEventListener("dblclick", () => { onReset(); apply(); persist(); placeGrips(); });
  }
  function init() {
    panelEl = document.getElementById("casesPanel");
    appEl = document.querySelector(".app");
    const split = document.getElementById("casesSplitter");
    if (!appEl) return;

    // The whole group (panel + dashboard) is centred, so a divider stays under the pointer when
    // panel = 2x - viewport + dash   (divider between panel and dashboard)
    // dash  = 2x - viewport - panel  (dashboard's right edge; panel = 0 when hidden)
    // dash  = viewport - 2x          (dashboard's left edge while the panel is hidden)
    if (split) drag(split, (x) => { panel = clamp(2 * x - vw() + dash, MIN_PANEL, Math.max(MIN_PANEL, vw() - MIN_DASH)); }, () => { panel = DEF_PANEL; });
    gripR = document.createElement("div");
    gripR.className = "dash-grip"; gripR.title = "Drag to resize the dashboard (double-click to reset)"; gripR.setAttribute("role", "separator");
    gripL = gripR.cloneNode(); gripL.classList.add("dash-grip-left");
    document.body.append(gripL, gripR);
    const maxDash = () => Math.max(MIN_DASH, vw() - (panelOpen() ? Math.min(panel, MIN_PANEL) : 0));
    drag(gripR, (x) => { dash = clamp(2 * x - vw() - (panelOpen() ? panel : 0), MIN_DASH, maxDash()); }, () => { dash = DEF_DASH; });
    drag(gripL, (x) => { dash = clamp(vw() - 2 * x, MIN_DASH, maxDash()); }, () => { dash = DEF_DASH; });

    if (window.ResizeObserver) { const ro = new ResizeObserver(placeGrips); ro.observe(appEl); ro.observe(document.body); }
    window.addEventListener("resize", placeGrips);
    if (panelEl) new MutationObserver(placeGrips).observe(panelEl, { attributes: true, attributeFilter: ["class"] });
    placeGrips();

    // Install button: sits in the header's second row, hidden once the app is installed / running as an app.
    const rows = document.querySelectorAll(".header-actions-row");
    const row = rows[rows.length - 1];
    if (row && !document.getElementById("installBtn")) {
      const b = document.createElement("button");
      b.type = "button"; b.id = "installBtn"; b.className = "icon-btn icon-only";
      b.title = "Install TechNotes as an app"; b.setAttribute("aria-label", "Install app");
      b.innerHTML = '<svg class="hi" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      b.addEventListener("click", onInstall);
      row.append(b);
      syncInstallBtn();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  // ── Service worker (makes it installable and lets it open offline) ──────
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => { /* app still works without it */ }); });
  }
})();
