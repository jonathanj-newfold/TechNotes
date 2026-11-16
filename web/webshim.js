// Web version of TechNotes: a tiny stand-in for the Chrome extension APIs the app uses, so the same code runs
// from a normal web page (GitHub Pages). Storage is IndexedDB (kept in memory while the page is open) and is
// private to the browser it's used in. Cloud sync (Settings > General > Cloud sync) is what moves a setup between computers.
(function () {
  if (window.chrome && chrome.storage && chrome.storage.local) return; // running as the real extension
  const DB = "technotes-web", STORE = "kv";
  const cache = new Map();
  const listeners = [];
  let bc = null;
  try { bc = new BroadcastChannel("technotes-web-storage"); } catch (e) { /* single tab only */ }
  const clone = (v) => (v === undefined ? undefined : (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v))));

  let dbp = null;
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
    return dbp;
  }
  const ready = (async () => {
    try {
      const db = await openDb();
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, "readonly");
        const st = tx.objectStore(STORE);
        const keys = st.getAllKeys(), vals = st.getAll();
        tx.oncomplete = () => { keys.result.forEach((k, i) => cache.set(k, vals.result[i])); resolve(); };
        tx.onerror = tx.onabort = () => resolve();
      });
    } catch (e) { /* no IndexedDB (private mode): keep everything in memory for this visit */ }
  })();
  function persist(fn) { openDb().then((db) => { const tx = db.transaction(STORE, "readwrite"); fn(tx.objectStore(STORE)); }).catch(() => {}); }
  function fire(changes) { listeners.slice().forEach((l) => { try { l(changes, "local"); } catch (e) { console.error(e); } }); }

  const pick = (keys) => {
    const out = {};
    if (keys == null) { cache.forEach((v, k) => { out[k] = clone(v); }); return out; }
    if (typeof keys === "string") keys = [keys];
    if (Array.isArray(keys)) { keys.forEach((k) => { if (cache.has(k)) out[k] = clone(cache.get(k)); }); return out; }
    Object.keys(keys).forEach((k) => { out[k] = cache.has(k) ? clone(cache.get(k)) : keys[k]; });
    return out;
  };
  const done = (cb, val) => { if (typeof cb === "function") setTimeout(() => cb(val), 0); return Promise.resolve(val); };

  const local = {
    get(keys, cb) { if (typeof keys === "function") { cb = keys; keys = null; } return ready.then(() => done(cb, pick(keys))); },
    set(items, cb) {
      return ready.then(() => {
        const changes = {};
        Object.keys(items || {}).forEach((k) => {
          const nv = clone(items[k]);
          changes[k] = { oldValue: clone(cache.get(k)), newValue: clone(nv) };
          cache.set(k, nv);
        });
        persist((st) => Object.keys(items || {}).forEach((k) => st.put(cache.get(k), k)));
        if (bc) { try { bc.postMessage({ set: items }); } catch (e) { /* too big to broadcast: other tabs pick it up on reload */ } }
        fire(changes);
        return done(cb);
      });
    },
    remove(keys, cb) {
      return ready.then(() => {
        const list = Array.isArray(keys) ? keys : [keys];
        const changes = {};
        list.forEach((k) => { if (cache.has(k)) { changes[k] = { oldValue: clone(cache.get(k)) }; cache.delete(k); } });
        persist((st) => list.forEach((k) => st.delete(k)));
        if (bc) { try { bc.postMessage({ remove: list }); } catch (e) { /* ignore */ } }
        if (Object.keys(changes).length) fire(changes);
        return done(cb);
      });
    }
  };
  if (bc) bc.onmessage = (ev) => {
    const m = ev.data || {}, changes = {};
    if (m.set) Object.keys(m.set).forEach((k) => { changes[k] = { oldValue: clone(cache.get(k)), newValue: clone(m.set[k]) }; cache.set(k, m.set[k]); });
    if (m.remove) m.remove.forEach((k) => { if (cache.has(k)) { changes[k] = { oldValue: clone(cache.get(k)) }; cache.delete(k); } });
    if (Object.keys(changes).length) fire(changes);
  };

  const win = () => ({ id: 1, type: "normal", state: "normal", focused: true, left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });
  window.chrome = {
    storage: { local, session: local, onChanged: { addListener: (fn) => listeners.push(fn), removeListener: (fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); } } },
    runtime: {
      lastError: undefined,
      getManifest: () => window.__TECHNOTES_MANIFEST || { version: "web", version_name: "web" },
      sendMessage: (msg) => { if (msg && msg.type === "cnh-open-kb") window.open("kb.html", "technotes-infohub"); return Promise.resolve(); },
      onMessage: { addListener() {} }
    },
    // The browser tab can't be moved or resized by the page, so these just report the tab's size.
    windows: { getCurrent: (cb) => done(cb, win()), update: (id, o, cb) => done(cb, win()), getLastFocused: (cb) => done(cb, win()) },
    system: { display: { getInfo: () => Promise.resolve([{ bounds: { left: 0, top: 0, width: screen.width, height: screen.height }, workArea: { left: 0, top: 0, width: screen.width, height: screen.height } }]) } }
  };
  window.__technotesReady = ready;
})();
