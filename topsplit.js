// Draggable horizontal divider between the top section (title, buttons, search, tabs) and the form below it.
// Drag up to shrink the pinned top section (it then scrolls inside itself) and give the fields and preview more
// room; drag down to give the tabs more room (the form below shrinks to fit). Double-click resets it to automatic
// (as tall as its content). The setting is remembered, and the CSS keeps it from ever crowding out the form.
(function () {
  const bar = document.getElementById("topSplitter");
  const pane = document.getElementById("topPane");
  if (!bar || !pane) return;
  const KEY = "cnh_topH";
  const MIN = 64;
  const root = document.documentElement;

  const natural = () => pane.scrollHeight;
  // lowest the divider may go: leaves ~250px under it for the fields, Preview and the button bar (matches the CSS)
  const limit = () => Math.max(MIN, window.innerHeight - 250);
  function setH(px, remember) {
    if (px == null) {
      root.style.removeProperty("--top-h");
      root.classList.remove("top-sized");
      if (remember) try { localStorage.removeItem(KEY); } catch (e) { /* not remembered */ }
      return;
    }
    const h = Math.max(MIN, Math.round(px));
    root.style.setProperty("--top-h", h + "px");
    root.classList.add("top-sized");
    if (remember) try { localStorage.setItem(KEY, String(h)); } catch (e) { /* not remembered */ }
  }

  try {
    const saved = parseInt(localStorage.getItem(KEY), 10);
    if (saved >= MIN) { root.style.setProperty("--top-h", saved + "px"); root.classList.add("top-sized"); }
  } catch (e) { /* automatic height */ }

  let dragging = false;
  bar.addEventListener("pointerdown", (e) => {
    dragging = true;
    try { bar.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    root.classList.add("is-vsplitting");
    e.preventDefault();
  });
  bar.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const top = pane.getBoundingClientRect().top;
    setH(Math.min(e.clientY - top, limit()), false);
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try { bar.releasePointerCapture(e.pointerId); } catch (err) { /* fine */ }
    root.classList.remove("is-vsplitting");
    const cur = parseInt(root.style.getPropertyValue("--top-h"), 10);
    setH(isNaN(cur) ? null : cur, true);
  };
  bar.addEventListener("pointerup", end);
  bar.addEventListener("pointercancel", end);
  bar.addEventListener("dblclick", () => setH(null, true));
  bar.addEventListener("keydown", (e) => { // keyboard: Up/Down nudge, Home = smallest, End/Esc = automatic
    const cur = pane.getBoundingClientRect().height;
    let next = null;
    if (e.key === "ArrowUp") next = cur - 24;
    else if (e.key === "ArrowDown") next = cur + 24;
    else if (e.key === "Home") next = MIN;
    else if (e.key === "End") { e.preventDefault(); setH(null, true); return; }
    else return;
    e.preventDefault();
    setH(Math.max(MIN, Math.min(next, limit())), true);
  });
})();
