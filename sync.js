// ── Cloud sync (Supabase) ───────────────────────────────────────────────
// Each person signs in with their own account and keeps their own private copy of the backup in the
// technotes_backups table (one row per user; row-level security lets a user read and write only their own row).
// "Upload" sends what Export would write; "Download" replaces the setup here with the saved copy (a snapshot of the
// current setup is taken first, exactly like Import). Nothing syncs by itself, so nothing is overwritten by surprise.
// The key below is the project's PUBLISHABLE key: it is meant to sit in client code. The sign-in session is kept in
// chrome.storage.local (cnh_sync) and is never part of Export.
const SYNC_URL = "https://ysdrgmswytrmquxmzykj.supabase.co";
const SYNC_KEY = "sb_publishable_fVH8OmJttGaRyJXvcVSCQg_TrhhF7ME";
const SYNC_STORE = "cnh_sync";

let syncState = { session: null, email: "", lastUp: 0, lastDown: 0, pictures: true };
let syncBusy = false;
let syncMsg = "";

chrome.storage.local.get(SYNC_STORE, (res) => {
  const v = res && res[SYNC_STORE];
  if (v && typeof v === "object") syncState = { ...syncState, ...v };
});
function syncSave() { chrome.storage.local.set({ [SYNC_STORE]: syncState }); }

async function syncFetch(path, opts = {}) {
  const headers = { apikey: SYNC_KEY, "Content-Type": "application/json", ...(opts.headers || {}) };
  const r = await fetch(SYNC_URL + path, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let json = null;
  try { json = await r.json(); } catch (e) { /* empty body */ }
  return { ok: r.ok, status: r.status, json };
}
function syncErrText(r) {
  const j = r && r.json || {};
  const m = String(j.msg || j.message || j.error_description || j.error || "");
  if (/invalid login/i.test(m)) return "Wrong email or password.";
  if (/not confirmed/i.test(m)) return "Confirm your email first (check your inbox), then sign in.";
  if (/already registered|already been registered/i.test(m)) return "That email already has an account. Use Sign in.";
  if (/password/i.test(m) && /(short|least|weak|characters)/i.test(m)) return "Password is too weak (use at least 8 characters).";
  if (/rate limit/i.test(m)) return "Too many attempts. Wait a few minutes and try again.";
  if (r && r.status === 413) return "The backup is too large. Turn off “Include case pictures” and try again.";
  return m || `Something went wrong (${r ? r.status : "no connection"}).`;
}
function syncTake(j) {
  syncState.session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000, user_id: j.user && j.user.id };
  syncState.email = (j.user && j.user.email) || syncState.email;
  syncSave();
}
async function syncToken() {
  const s = syncState.session;
  if (!s) return null;
  if (s.expires_at - Date.now() > 60000) return s.access_token;
  const r = await syncFetch("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh_token } });
  if (!r.ok) { syncState.session = null; syncSave(); return null; }
  syncTake(r.json);
  return syncState.session.access_token;
}
async function syncAuth(kind, email, password) {
  const path = kind === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
  const r = await syncFetch(path, { method: "POST", body: { email, password } });
  if (!r.ok) throw new Error(syncErrText(r));
  if (r.json && r.json.access_token) { syncTake(r.json); return "in"; }
  syncState.email = email; syncSave();
  return "confirm"; // account created, email confirmation needed first
}
async function syncUpload() {
  const token = await syncToken();
  if (!token || !syncState.session.user_id) throw new Error("You're signed out. Sign in again.");
  const payload = await new Promise((res) => buildBackupPayload({ pictures: syncState.pictures !== false }, res));
  const r = await syncFetch("/rest/v1/technotes_backups?on_conflict=user_id", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: { user_id: syncState.session.user_id, data: payload, app_version: chrome.runtime.getManifest().version }
  });
  if (!r.ok) throw new Error(syncErrText(r));
  syncState.lastUp = Date.now(); syncSave();
}
async function syncFetchCloud() {
  const token = await syncToken();
  if (!token) throw new Error("You're signed out. Sign in again.");
  const r = await syncFetch("/rest/v1/technotes_backups?select=data,updated_at&user_id=eq." + encodeURIComponent(syncState.session.user_id), { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new Error(syncErrText(r));
  return Array.isArray(r.json) && r.json[0] ? r.json[0] : null;
}
function syncSignOut() {
  const token = syncState.session && syncState.session.access_token;
  if (token) syncFetch("/auth/v1/logout", { method: "POST", headers: { Authorization: "Bearer " + token } }).catch(() => {});
  syncState.session = null; syncSave();
}

function syncAgo(t) { return t ? new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never"; }

function syncBlockHTML() {
  const signedIn = !!syncState.session;
  const msg = syncMsg ? `<div class="set-hint" id="syncMsg" style="color:var(--accent-text)">${escHtml(syncMsg)}</div>` : "";
  if (!signedIn) {
    return `<div class="set-block">
      <div class="set-block-title">Cloud sync</div>
      <div class="set-hint">Sign in with your own account to keep a private copy of your setup online and bring it to another computer. Nobody else can see or change it.</div>
      <input type="email" id="syncEmail" class="search-input" style="width:100%;margin-bottom:6px" placeholder="Email" autocomplete="username" value="${escAttr(syncState.email || "")}">
      <input type="password" id="syncPass" class="search-input" style="width:100%;margin-bottom:6px" placeholder="Password" autocomplete="current-password">
      ${msg}
      <div class="set-btn-row">
        <button type="button" class="btn" id="syncSignIn">Sign in</button>
        <button type="button" class="btn" id="syncSignUp">Create account</button>
      </div>
    </div>`;
  }
  return `<div class="set-block">
      <div class="set-block-title">Cloud sync</div>
      <div class="set-hint">Signed in as <b>${escHtml(syncState.email || "")}</b>.<br>Last uploaded: ${escHtml(syncAgo(syncState.lastUp))} · Last downloaded: ${escHtml(syncAgo(syncState.lastDown))}</div>
      <label class="set-hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="syncPics"${syncState.pictures !== false ? " checked" : ""}> Include case pictures (bigger upload)</label>
      ${msg}
      <div class="set-btn-row">
        <button type="button" class="btn" id="syncUp" title="Save this setup to your online copy (replaces it)">Upload</button>
        <button type="button" class="btn" id="syncDown" title="Replace this setup with your online copy">Download</button>
        <button type="button" class="btn" id="syncOut">Sign out</button>
      </div>
    </div>`;
}

function wireSync() {
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
  const run = async (label, fn) => {
    if (syncBusy) return;
    syncBusy = true; syncMsg = label + "…"; renderSettings();
    try { syncMsg = (await fn()) || ""; } catch (e) { syncMsg = e && e.message ? e.message : "Something went wrong."; }
    syncBusy = false; renderSettings();
  };
  const creds = () => ({ email: ($("syncEmail").value || "").trim(), pass: $("syncPass").value || "" });
  on("syncSignIn", () => { const c = creds(); if (!c.email || !c.pass) { syncMsg = "Enter your email and password."; renderSettings(); return; } run("Signing in", async () => { await syncAuth("signin", c.email, c.pass); return "Signed in."; }); });
  on("syncSignUp", () => { const c = creds(); if (!c.email || c.pass.length < 8) { syncMsg = "Enter an email and a password of at least 8 characters."; renderSettings(); return; } run("Creating account", async () => (await syncAuth("signup", c.email, c.pass)) === "confirm" ? "Account created. Check your email to confirm it, then sign in." : "Account created and signed in."); });
  on("syncOut", () => { syncSignOut(); syncMsg = "Signed out."; renderSettings(); });
  const pics = $("syncPics");
  if (pics) pics.addEventListener("change", () => { syncState.pictures = pics.checked; syncSave(); });
  on("syncUp", () => run("Uploading", async () => { await syncUpload(); return "Uploaded."; }));
  on("syncDown", async () => {
    if (syncBusy) return;
    syncBusy = true; syncMsg = "Checking your online copy…"; renderSettings();
    let row = null;
    try { row = await syncFetchCloud(); syncMsg = ""; } catch (e) { syncMsg = e && e.message ? e.message : "Something went wrong."; }
    syncBusy = false;
    if (!row) { if (!syncMsg) syncMsg = "There's no online copy yet. Use Upload first."; renderSettings(); return; }
    renderSettings();
    showConfirmDialog({
      title: "Download from cloud",
      text: `Replace your templates, tables, settings and Cases panel with the online copy saved ${syncAgo(Date.parse(row.updated_at))}? A snapshot of your current setup is saved first, so you can undo this.`,
      confirmLabel: "Download",
      onConfirm: () => { applyBackupData(row.data); syncState.lastDown = Date.now(); syncSave(); }
    });
  });
}
