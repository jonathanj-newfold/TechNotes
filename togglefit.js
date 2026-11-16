// Auto-fits the labels of the toggle buttons (Brand, Verified, Ordered from...). All buttons in a group are the
// same size (CSS); here each group's font size is lowered, never below 8px, until its longest label fits on one
// line, so a long label like "Member Area" no longer wraps or makes its button bigger than the others.
(function () {
  const MAX = 11, MIN = 8;
  function fitGroup(g) {
    const btns = Array.from(g.querySelectorAll(".mini-toggle-btn"));
    if (!btns.length || !btns[0].clientWidth) return; // hidden right now: fitted when it is shown
    btns.forEach((b) => { b.style.fontSize = ""; });
    let fs = MAX;
    const over = () => btns.some((b) => b.scrollWidth > b.clientWidth);
    while (over() && fs > MIN) { fs -= 0.5; btns.forEach((b) => { b.style.fontSize = fs + "px"; }); }
  }
  function fitAll() {
    document.querySelectorAll(".mini-toggle:not(.mini-toggle-multi)").forEach(fitGroup);
  }
  let raf = 0;
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fitAll); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.querySelector(".app") || document.body);
  schedule();
})();
