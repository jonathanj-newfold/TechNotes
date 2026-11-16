// TechNotes web: service worker. Network first (so a new version shows up straight away), cache as the fallback
// so the app still opens offline. Only this site's own files are handled; cloud sync requests go straight through.
const CACHE = "technotes-1.28.10-mwj9u8yc";
const FILES = ["./","about.js","cases.js","dns.js","history.js","icons/apple-touch-icon.png","icons/icon-maskable512.png","icons/icon128.png","icons/icon16.png","icons/icon192.png","icons/icon48.png","icons/icon512.png","icons/infohub.svg","icons/logo.svg","icons.js","imgedit.js","index.html","kb.css","kb.html","kb.js","manifest.webmanifest","popup.css","popup.js","settings.js","sync.js","theme-init.js","togglefit.js","topsplit.js","undo.js","web.css","webresize.js","webshim.js"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(r).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match("index.html")))
  );
});
