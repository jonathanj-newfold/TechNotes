// About screen: opens from the header, mirrors how Settings takes over the
// window, and serves up a random pun on request.

let aboutOpen = false;
let lastPunIndex = -1;

const ABOUT_PUNS = [
  "Why don't case notes ever get lonely? They always have follow-ups.",
  "I asked my ticket why it was so tense. It said it had too many open issues.",
  "Reset to default: the only kind of default that's good news.",
  "Why did the agent bring a ladder to work? To reach the next support tier.",
  "Our handle time is low, but our pun count is high.",
  "Dropdown menus are so easy to fall for.",
  "I'd tell you a joke about copy-paste, but you've probably heard it before.",
  "Your one-stop shop for case notes? More of a full-stop shop.",
  "Warning: excessive use may cause dangerously high customer satisfaction.",
  "This extension is 100% note-worthy."
];

function showAnotherPun() {
  let i;
  do { i = Math.floor(Math.random() * ABOUT_PUNS.length); } while (i === lastPunIndex && ABOUT_PUNS.length > 1);
  lastPunIndex = i;
  $("aboutPun").textContent = ABOUT_PUNS[i];
}

function appVersion() {
  try { return chrome.runtime.getManifest().version; } catch (e) { return ""; }
}

// Full version line, e.g. "1.2.3 (build 70, 2026-10-17)". The build number and
// date live in manifest.json's version_name.
function appVersionFull() {
  try {
    const m = chrome.runtime.getManifest();
    return m.version_name || m.version || "";
  } catch (e) { return ""; }
}

function openAbout() {
  if (typeof leaveSettingsQuietly === "function" && settingsOpen) leaveSettingsQuietly();
  $("reorderToggleBtn").classList.add("hidden"); // rearranging tabs makes no sense from here
  aboutOpen = true;
  ["fillView", "tableView", "editView", "editReferenceView", "tabs", "addTplRow"].forEach((id) => $(id).classList.add("hidden"));
  $("searchRow").classList.add("hidden");
  $("editToggleBtn").classList.add("hidden");
  $("aboutView").classList.remove("hidden");
  $("aboutBtn").classList.add("is-active");
  const v = appVersionFull();
  $("aboutVersion").textContent = v ? "Version " + v : "";
  showAnotherPun();
  window.scrollTo(0, 0);
}

// Hide About without re-rendering the main views (used when jumping to Settings).
function leaveAboutQuietly() {
  aboutOpen = false;
  $("aboutView").classList.add("hidden");
  $("aboutBtn").classList.remove("is-active");
}

function closeAbout() {
  $("reorderToggleBtn").classList.remove("hidden");
  leaveAboutQuietly();
  $("searchRow").classList.remove("hidden");
  $("tabs").classList.remove("hidden");
  $("editToggleBtn").classList.remove("hidden");
  renderTabs();
  renderActiveView();
}

$("aboutBackBtn").addEventListener("click", closeAbout);
$("aboutPunBtn").addEventListener("click", showAnotherPun);
