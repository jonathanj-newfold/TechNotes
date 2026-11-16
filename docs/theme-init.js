// Applies the saved colour theme before the page is painted, so a light-theme
// user doesn't see a dark flash on open. Kept as its own file because
// extension pages can't run inline scripts. The choice itself is made in
// Settings (see applyTheme in settings.js) and saved in localStorage.
(function () {
  try {
    if (localStorage.getItem("cnh_theme") === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (e) { /* storage unavailable: stay on the default dark theme */ }
})();

// The dashboard's width is measured once (cases.js) and kept here, so it is the same on the very first
// paint of every open - the page never starts out stretched across a wider window and then snaps back.
(function () {
  try {
    var w = parseInt(localStorage.getItem("cnh_dashW2"), 10);
    if (w >= 360 && w <= 6000) document.documentElement.style.setProperty("--dash-w", w + "px");
  } catch (e) { /* storage unavailable: the CSS default width is used */ }
})();
