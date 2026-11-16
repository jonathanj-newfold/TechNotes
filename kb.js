// infoHub window (formerly the Knowledge Base).
// A searchable, categorised library of everything you reference while helping
// customers: DNS/mail settings, links, forms, requirements, canned replies...
// It is seeded the first time it opens from the templates and reference tables
// already in TechNotes, then lives on its own in chrome.storage.local
// (key cnh_kb), so editing it never changes your note templates (and vice versa).
// "Sync from templates" pulls in anything new you add to the extension later.

(function () {
  "use strict";

  const KB_KEY = "cnh_kb";
  const $ = (id) => document.getElementById(id);

  // ── Categories ────────────────────────────────────────────────────────
  const DEFAULT_CATS = [
    { id: "email",   name: "Email & DNS Settings" },
    { id: "links",   name: "Links & Portals" },
    { id: "forms",   name: "Forms & Documents" },
    { id: "domains", name: "Domains & Registration" },
    { id: "billing", name: "Billing, Refunds & Retention" },
    { id: "teams",   name: "Teams & Escalations" },
    { id: "faq",     name: "FAQs & Customer Replies" },
    { id: "other",   name: "General" }
  ];
  const FALLBACK_CAT = "other"; // can't be deleted; deleted categories' entries move here

  // TechNotes tab ids -> KB category (your own ids, from your backup).
  const CAT_MAP = {
    titan_dns: "email", exchange_dns: "email", exchange_email_dns: "email", imap_settings: "email",
    mail_settings_2: "email", titan_mail_settings: "email", list_of_spf: "email", gws_dns: "email",
    microsoft_dns: "email", cd_default_ns: "email",
    cd_links: "links", titan_links: "links", webmail_links: "links", email_exchange: "links",
    forms: "forms", vd_forms: "forms",
    cn_domain_registration: "domains", it_domain_registration: "domains", trustee_abn: "domains", private_tech: "domains",
    cancellation_agreement: "billing", member_credits_offer: "billing", refund_request: "billing",
    retentions: "billing", accoutns: "billing", cd_bank_details: "billing", resend_invoice: "billing",
    domains_team: "teams", department_schedules: "teams", max_defer: "teams",
    qa: "faq", website_deceptive_warning: "faq", gws_transfer: "faq"
  };
  // The four built-in workflow tabs are note forms, and these are scratch/test tabs: not knowledge.
  const SKIP_IDS = ["cancellation", "generalHelp", "changeRequest", "caseNote", "notes", "test", "dns_test"];

  function humanize(id) { return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

  // For tabs added later that aren't in CAT_MAP: guess from the name.
  function guessCat(id, label) {
    const s = (id + " " + label).toLowerCase();
    if (/dns|spf|dkim|dmarc|\bmx\b|imap|smtp|pop3|mail|nameserver|\bns\b/.test(s)) return "email";
    if (/link|portal|webmail|login/.test(s)) return "links";
    if (/form|document/.test(s)) return "forms";
    if (/refund|invoice|cancel|bank|retention|credit|payment|billing|account/.test(s)) return "billing";
    if (/domain|registration|abn|acn|uen|whois|transfer|privacy/.test(s)) return "domains";
    if (/team|schedule|escalat|department/.test(s)) return "teams";
    if (/faq|q ?& ?a|warning|reply|template/.test(s)) return "faq";
    return FALLBACK_CAT;
  }

  // ── State ─────────────────────────────────────────────────────────────
  let kb = null;                 // { v, cats, entries, ignored }
  let lastSaved = "";            // JSON of what we last wrote, so our own writes don't trigger a reload
  let view = "all";              // "all" | "pinned" | category id
  let query = "";
  let tagFilter = "";            // lower-case tag being filtered on ("" = none)
  const expanded = new Set();    // open entry ids
  const fillValues = {};         // entry id -> { placeholder: typed value } (not saved)

  // ── Tiny DOM helper (builds nodes with textContent, so nothing typed is ever parsed as HTML) ──
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k === "value" || k === "checked") el[k] = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    kids.flat().forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  function uid() { return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ── Toast / clipboard ─────────────────────────────────────────────────
  let toastTimer = null;
  function toast(msg) {
    const el = $("kbToast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 1400);
  }
  function copy(text, msg) {
    navigator.clipboard.writeText(text).then(() => toast(msg || "Copied!"), () => toast("Couldn't copy"));
  }

  // ── Rich text: sanitising, plain-text conversion ──────────────────────
  // Entries with formatting keep their HTML in e.html. It is cleaned to a small
  // whitelist (basic formatting, lists, safe links) every time it is saved or loaded.
  const ALLOWED_TAGS = new Set(["A", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "DIV", "P", "BR", "UL", "OL", "LI", "H1", "H2", "H3", "BLOCKQUOTE", "SUB", "SUP", "HR", "FONT"]);
  const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE", "META", "LINK", "SVG", "MATH", "TEXTAREA", "SELECT", "BUTTON", "INPUT"]);
  const CSS_OK = ["color", "background-color", "font-size", "font-family", "font-weight", "font-style", "text-decoration", "text-decoration-line", "text-align"];
  const CSS_PASTE_OK = ["font-weight", "font-style", "text-decoration", "text-decoration-line"];
  const KEEP_CLASSES = new Set(["kb-tag", "kb-badge"]); // the Tag / Badge pills in table cells

  function safeCss(node, allowed) {
    const st = node.style;
    if (!st) return "";
    const out = [];
    allowed.forEach((p) => {
      const v = (st.getPropertyValue(p) || "").trim();
      if (v && /^[\w\s#%.,'"()\-]+$/.test(v) && !/url|expression|javascript/i.test(v)) out.push(p + ": " + v);
    });
    return out.join("; ");
  }

  function cleanInto(src, dest, allowed) {
    src.childNodes.forEach((n) => {
      if (n.nodeType === 3) { dest.append(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toUpperCase();
      if (DROP_TAGS.has(tag)) return;
      if (tag === "IMG") { // inline pictures: only embedded data: images, never anything loaded from the web
        const src = (n.getAttribute("src") || "").trim();
        if (!/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/i.test(src)) return;
        const img = document.createElement("img");
        img.setAttribute("src", src);
        img.setAttribute("alt", (n.getAttribute("alt") || "image").slice(0, 120));
        const w = parseInt(n.getAttribute("width"), 10);
        if (w >= 40 && w <= 1600) img.setAttribute("width", String(w));
        img.setAttribute("style", "max-width: 100%; height: auto");
        dest.append(img);
        return;
      }
      if (!ALLOWED_TAGS.has(tag)) { cleanInto(n, dest, allowed); return; } // unknown tag: keep its text, drop the tag
      if (tag === "A") {
        const href = (n.getAttribute("href") || "").trim();
        if (!/^(https?:|mailto:)/i.test(href)) { cleanInto(n, dest, allowed); return; }
        const a = document.createElement("a");
        a.setAttribute("href", href); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
        cleanInto(n, a, allowed); dest.append(a);
        return;
      }
      const el = document.createElement(tag === "FONT" ? "span" : tag.toLowerCase());
      let css = safeCss(n, allowed);
      if (tag === "FONT" && allowed === CSS_OK) {
        const extra = [];
        const c = n.getAttribute("color"), f = n.getAttribute("face");
        if (c && /^[#\w]+$/.test(c)) extra.push("color: " + c);
        if (f && /^[\w\s,'"-]+$/.test(f)) extra.push("font-family: " + f);
        css = [css].concat(extra).filter(Boolean).join("; ");
      }
      if (css) el.setAttribute("style", css);
      if (tag === "SPAN") {
        const cls = (n.getAttribute("class") || "").split(/\s+/).filter((c) => KEEP_CLASSES.has(c));
        if (cls.length) el.setAttribute("class", cls.join(" "));
      }
      cleanInto(n, el, allowed);
      dest.append(el);
    });
  }

  // opts.paste: stricter (drops colours, fonts and sizes from text pasted from web pages)
  function sanitizeHtml(html, opts) {
    const doc = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");
    const out = document.createElement("div");
    cleanInto(doc.body, out, opts && opts.paste ? CSS_PASTE_OK : CSS_OK);
    return out.innerHTML;
  }

  function hasInlineImg(html) { return /<img\b/i.test(html || ""); }
  // A table cell only keeps its HTML when it holds more than plain text and line breaks.
  function isRichCell(html) { return /<(?!br\b)[a-z]/i.test(html || ""); }
  function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function plainToHtml(text) { return text ? escapeHtml(text).replace(/\r?\n/g, "<br>") : ""; }

  const BLOCK_TAGS = new Set(["DIV", "P", "LI", "UL", "OL", "H1", "H2", "H3", "BLOCKQUOTE", "HR"]);
  // Plain text version of (already sanitised) HTML or a DOM node: lines, bullets and numbers kept.
  function htmlToText(input) {
    let root = input;
    if (typeof input === "string") { root = document.createElement("div"); root.innerHTML = input; }
    let out = "";
    const nl = () => { if (out && !out.endsWith("\n")) out += "\n"; };
    (function walk(node, listCtx) {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) { out += n.nodeValue; return; }
        if (n.nodeType !== 1) return;
        const tag = n.tagName;
        if (tag === "BR") { out += "\n"; return; }
        const block = BLOCK_TAGS.has(tag);
        if (block) nl();
        if (tag === "LI") {
          const ctx = listCtx || { type: "UL", i: 0 };
          ctx.i++;
          out += ctx.type === "OL" ? ctx.i + ". " : "• ";
          walk(n, listCtx);
        } else if (tag === "UL" || tag === "OL") {
          walk(n, { type: tag, i: 0 });
        } else walk(n, listCtx);
        if (block) nl();
      });
    })(root, null);
    return out.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
  }

  // ── Data: load / save / sanitise ──────────────────────────────────────
  function emptyKB() { return { v: 1, cats: DEFAULT_CATS.map((c) => ({ ...c })), entries: [], ignored: [] }; }

  function sanitize(raw) {
    const out = emptyKB();
    if (!raw || typeof raw !== "object") return out;
    const cats = Array.isArray(raw.cats) ? raw.cats.filter((c) => c && typeof c.id === "string" && typeof c.name === "string") : [];
    out.cats = cats.length ? cats.map((c) => ({ id: c.id, name: c.name })) : out.cats;
    if (!out.cats.some((c) => c.id === FALLBACK_CAT)) out.cats.push({ id: FALLBACK_CAT, name: "General" });
    out.ignored = Array.isArray(raw.ignored) ? raw.ignored.filter((s) => typeof s === "string") : [];
    const seen = new Set();
    (Array.isArray(raw.entries) ? raw.entries : []).forEach((e) => {
      if (!e || typeof e !== "object" || typeof e.title !== "string") return;
      const id = typeof e.id === "string" && !seen.has(e.id) ? e.id : uid();
      seen.add(id);
      const entry = {
        id,
        title: e.title,
        cat: out.cats.some((c) => c.id === e.cat) ? e.cat : FALLBACK_CAT,
        type: e.type === "table" ? "table" : "text",
        pinned: e.pinned === true
      };
      if (typeof e.src === "string") entry.src = e.src;
      // at-a-glance extras: a one-line summary, tags, and links to related entries (by id)
      if (typeof e.summary === "string" && e.summary.trim()) entry.summary = e.summary.trim().slice(0, 200);
      const tags = [];
      (Array.isArray(e.tags) ? e.tags : []).forEach((t) => {
        t = typeof t === "string" ? t.replace(/\s+/g, " ").trim().slice(0, 30) : "";
        if (t && tags.length < 12 && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
      });
      if (tags.length) entry.tags = tags;
      const rel = (Array.isArray(e.related) ? e.related : []).filter((r, i, a) => typeof r === "string" && r !== id && a.indexOf(r) === i).slice(0, 20);
      if (rel.length) entry.related = rel;
      entry.images = (Array.isArray(e.images) ? e.images : [])
        .filter((im) => im && typeof im.data === "string" && im.data.startsWith("data:image/"))
        .map((im) => ({ id: typeof im.id === "string" ? im.id : uid(), name: typeof im.name === "string" ? im.name : "image", data: im.data }));
      if (entry.type === "table") {
        entry.columns = Array.isArray(e.columns) ? e.columns.map(String) : [];
        entry.rows = (Array.isArray(e.rows) ? e.rows : []).map((r) => (Array.isArray(r) ? r.map((c) => String(c === null || c === undefined ? "" : c)) : []));
        entry.showHeader = e.showHeader !== false;
        const width = Math.max(entry.columns.length, ...entry.rows.map((r) => r.length), 1);
        while (entry.columns.length < width) entry.columns.push("Column " + (entry.columns.length + 1));
        entry.rows.forEach((r) => { while (r.length < width) r.push(""); });
        // Formatted cells (lists, pills, links, pictures...) keep their HTML in rowsHtml, same shape as rows.
        // rows keeps the plain text of every cell, for search and plain copy.
        if (Array.isArray(e.rowsHtml)) {
          let any = false;
          const rowsHtml = entry.rows.map((r, ri) => r.map((_, ci) => {
            const raw = Array.isArray(e.rowsHtml[ri]) ? e.rowsHtml[ri][ci] : "";
            const html = typeof raw === "string" && raw ? sanitizeHtml(raw) : "";
            if (!html) return "";
            any = true;
            entry.rows[ri][ci] = htmlToText(html);
            return html;
          }));
          if (any) entry.rowsHtml = rowsHtml;
        }
      } else {
        const html = typeof e.html === "string" ? sanitizeHtml(e.html) : "";
        if (html) { entry.html = html; entry.body = htmlToText(html); }
        else entry.body = typeof e.body === "string" ? e.body : "";
      }
      out.entries.push(entry);
    });
    return out;
  }

  function save() {
    const json = JSON.stringify(kb);
    lastSaved = json;
    chrome.storage.local.set({ [KB_KEY]: kb });
  }

  // ── Seeding from the extension's templates + reference tables ─────────
  function looksTabular(body) {
    const lines = body.split(/\r?\n/).filter((l) => l.trim());
    return lines.length >= 2 && lines.every((l) => l.includes("\t"));
  }

  function cleanTable(t) {
    let rows = (Array.isArray(t.rows) ? t.rows : []).map((r) => (Array.isArray(r) ? r.map((c) => String(c === null || c === undefined ? "" : c)) : []));
    rows = rows.filter((r) => r.some((c) => c.trim() !== ""));
    let used = 0;
    rows.forEach((r) => r.forEach((c, i) => { if (c.trim() !== "" && i + 1 > used) used = i + 1; }));
    const columns = (Array.isArray(t.columns) ? t.columns.map(String) : []).slice(0, Math.max(used, 1));
    while (columns.length < Math.max(used, 1)) columns.push("Column " + (columns.length + 1));
    rows = rows.map((r) => { const x = r.slice(0, columns.length); while (x.length < columns.length) x.push(""); return x; });
    return { columns, rows, showHeader: t.showHeader !== false };
  }

  function normText(s) { return String(s === null || s === undefined ? "" : s).replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim(); }

  // Table content with blank rows and trailing blank columns removed, so a table that only
  // differs by empty padding doesn't count as changed.
  function tableCore(t) {
    let rows = (t.rows || []).map((r) => (r || []).map(normText)).filter((r) => r.some((c) => c !== ""));
    let used = 1;
    rows.forEach((r) => r.forEach((c, i) => { if (c !== "" && i + 1 > used) used = i + 1; }));
    rows = rows.map((r) => { const x = r.slice(0, used); while (x.length < used) x.push(""); return x; });
    const header = t.showHeader === false ? [] : (t.columns || []).slice(0, used).map(normText);
    return JSON.stringify({ header, rows });
  }

  // Returns a short description of what differs between an infoHub entry and the
  // template it came from ("" when nothing does).
  function diffEntry(old, fresh) {
    const parts = [];
    if (normText(old.title) !== normText(fresh.title)) parts.push("title");
    if (old.type !== fresh.type) parts.push("layout (" + old.type + " → " + fresh.type + ")");
    else if (fresh.type === "text") { if (normText(old.body) !== normText(fresh.body)) parts.push("text"); }
    else if (tableCore(old) !== tableCore(fresh)) parts.push("table contents");
    return parts.join(", ");
  }

  function sizeLabel(e) {
    if (e.type === "table") {
      const c = JSON.parse(tableCore(e));
      return c.rows.length + " rows × " + (c.rows[0] ? c.rows[0].length : 0) + " columns";
    }
    return normText(e.body).split("\n").length + " lines";
  }

  function hasFormatting(e) {
    return !!(e.html || (e.rowsHtml && e.rowsHtml.some((r) => r.some(Boolean))));
  }

  // Overwrites an entry's content with what the template says now. Keeps its category,
  // pin, tags, summary, related links and pictures.
  function applyChange(ch) {
    const e = ch.entry, f = ch.fresh;
    ["body", "html", "columns", "rows", "rowsHtml", "showHeader"].forEach((k) => { delete e[k]; });
    e.title = f.title;
    e.type = f.type;
    e.src = f.src;
    if (f.type === "table") { e.columns = f.columns; e.rows = f.rows; e.showHeader = f.showHeader; }
    else e.body = f.body;
  }

  // Adds new entries to `target` from the extension's stored data. Skips anything
  // already imported (or deleted on purpose). Returns how many were added.
  // If `changes` (an array) is passed, entries that already exist but no longer match
  // their template / table are pushed onto it as { entry, fresh, why } instead of being skipped.
  function seedFrom(target, data, changes) {
    const tpls = data.cnh_templates || {};
    const refs = data.cnh_referenceTables || {};
    const labels = data.cnh_customLabels || {};
    const order = Array.isArray(data.cnh_tabOrder) ? data.cnh_tabOrder : [];
    const ids = Array.from(new Set([...order, ...Object.keys(tpls), ...Object.keys(refs)]));
    let added = 0;

    // Q&A entries are numbered by position, so match them by question first (a question
    // added above the others would otherwise shift every number).
    const qaTitles = new Set();
    if (refs.qa && Array.isArray(refs.qa.rows)) {
      const cells = refs.qa.rows.map((r) => String((r && r[0]) || "").trim()).filter(Boolean);
      for (let i = 0; i + 1 < cells.length; i += 2) qaTitles.add(normText(cells[i]).toLowerCase());
    }

    function findExisting(entry) {
      if (entry.src.startsWith("qa:")) {
        const t = normText(entry.title).toLowerCase();
        const byTitle = target.entries.find((e) => e.src && e.src.startsWith("qa:") && normText(e.title).toLowerCase() === t);
        if (byTitle) return byTitle;
        const bySrc = target.entries.find((e) => e.src === entry.src);
        if (bySrc && !qaTitles.has(normText(bySrc.title).toLowerCase())) return bySrc; // same slot, question reworded
        if (bySrc) entry.src += ":" + Date.now().toString(36);                         // slot taken by another question
        return null;
      }
      return target.entries.find((e) => e.src === entry.src) || null;
    }

    function add(entry) {
      if (target.ignored.includes(entry.src)) return;
      const old = findExisting(entry);
      if (old) {
        if (changes) { const why = diffEntry(old, entry); if (why) changes.push({ entry: old, fresh: entry, why }); }
        return;
      }
      target.entries.push(entry);
      added++;
    }

    ids.forEach((id) => {
      if (SKIP_IDS.includes(id)) return;
      const label = labels[id] || humanize(id);
      const cat = CAT_MAP[id] || guessCat(id, label);

      if (refs[id] && typeof refs[id] === "object") {
        const t = refs[id];
        if (id === "qa") {
          // Q&A table: one column, alternating question / answer rows -> one entry per question
          const cells = (t.rows || []).map((r) => String((r && r[0]) || "").trim()).filter(Boolean);
          for (let i = 0; i + 1 < cells.length; i += 2) {
            add({ id: uid(), src: "qa:" + id + ":" + i, title: cells[i], cat, type: "text", body: cells[i + 1], pinned: false });
          }
          return;
        }
        const clean = cleanTable(t);
        if (!clean.rows.length) return; // empty table
        add({ id: uid(), src: "r:" + id, title: label, cat, type: "table", ...clean, pinned: false });
        return;
      }

      const body = typeof tpls[id] === "string" ? tpls[id].replace(/\s+$/, "") : "";
      if (!body.trim()) return;
      if (looksTabular(body)) {
        const rows = body.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/\t+/).map((c) => c.trim()).filter((c) => c !== ""));
        const width = Math.max(...rows.map((r) => r.length), 1);
        rows.forEach((r) => { while (r.length < width) r.push(""); });
        add({ id: uid(), src: "t:" + id, title: label, cat, type: "table", columns: Array.from({ length: width }, (_, i) => "Column " + (i + 1)), rows, showHeader: false, pinned: false });
        return;
      }
      add({ id: uid(), src: "t:" + id, title: label, cat, type: "text", body, pinned: false });
    });
    return added;
  }

  function readExtensionData(cb) {
    chrome.storage.local.get(["cnh_templates", "cnh_referenceTables", "cnh_customLabels", "cnh_tabOrder"], cb);
  }

  function load() {
    chrome.storage.local.get(KB_KEY, (res) => {
      if (res && res[KB_KEY]) {
        kb = sanitize(res[KB_KEY]);
        lastSaved = JSON.stringify(kb);
        render();
        // A saved KB with nothing in it (e.g. it was opened before a backup was
        // imported) is rebuilt from the current templates and tables.
        if (!kb.entries.length && !kb.ignored.length) {
          readExtensionData((data) => {
            const n = seedFrom(kb, data);
            if (n) { save(); render(); toast("Rebuilt infoHub from " + n + " saved items"); }
          });
        }
      } else {
        kb = emptyKB();
        readExtensionData((data) => {
          const n = seedFrom(kb, data);
          // Don't store an empty KB: the extension's data may simply not be there
          // yet, and a saved empty KB would never be filled in again.
          if (n) save();
          render();
          if (n) toast("Built infoHub from " + n + " saved items");
        });
      }
    });
  }

  // Another window (e.g. Import in TechNotes) changed the KB.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[KB_KEY]) return;
    const nv = changes[KB_KEY].newValue;
    if (!nv) { kb = emptyKB(); lastSaved = JSON.stringify(kb); render(); return; }
    const next = sanitize(nv);
    if (JSON.stringify(next) === lastSaved) return;
    kb = next;
    lastSaved = JSON.stringify(kb);
    if (view !== "all" && view !== "pinned" && !kb.cats.some((c) => c.id === view)) view = "all";
    render();
  });

  // ── Searching / filtering ─────────────────────────────────────────────
  const catName = (id) => (kb.cats.find((c) => c.id === id) || { name: "General" }).name;

  function haystack(e) {
    const parts = [e.title, catName(e.cat), e.summary || "", (e.tags || []).join(" ")];
    if (e.type === "table") { parts.push(e.columns.join(" ")); e.rows.forEach((r) => parts.push(r.join(" "))); }
    else parts.push(e.body);
    (e.images || []).forEach((im) => parts.push(im.name));
    return parts.join("\n").toLowerCase();
  }
  function matchesQuery(e) {
    if (!query) return true;
    const hay = haystack(e);
    return query.split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }
  function inView(e) {
    if (tagFilter && !(e.tags || []).some((t) => t.toLowerCase() === tagFilter)) return false;
    if (view === "all") return true;
    if (view === "pinned") return e.pinned;
    return e.cat === view;
  }
  function visibleEntries() {
    const list = kb.entries.filter((e) => inView(e) && matchesQuery(e));
    const catIdx = (e) => kb.cats.findIndex((c) => c.id === e.cat);
    if (view === "all" || view === "pinned") {
      return list.map((e, i) => ({ e, i })).sort((a, b) => (catIdx(a.e) - catIdx(b.e)) || (a.i - b.i)).map((x) => x.e);
    }
    return list;
  }

  // ── Placeholders ({name}) in text entries ─────────────────────────────
  const PH_RE = /\{([A-Za-z_][\w]*)\}/g;
  function placeholdersOf(body) {
    const names = [];
    let m;
    PH_RE.lastIndex = 0;
    while ((m = PH_RE.exec(body)) !== null) if (!names.includes(m[1])) names.push(m[1]);
    return names;
  }
  function filledText(e) {
    const vals = fillValues[e.id] || {};
    return e.body.replace(PH_RE, (all, name) => (vals[name] ? vals[name] : all));
  }
  function phLabel(name) {
    return name.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  function render() {
    renderSide();
    renderList();
  }

  function sideItem(id, name, count) {
    return h("button", { type: "button", class: "kb-side-item" + (view === id ? " is-active" : ""), onclick: () => { view = id; render(); $("kbList").scrollTop = 0; } },
      h("span", { class: "kb-side-name", text: name }),
      h("span", { class: "kb-side-count", text: String(count) }));
  }

  function renderSide() {
    const side = $("kbSide");
    side.textContent = "";
    const matching = kb.entries.filter(matchesQuery);
    side.append(sideItem("all", "All entries", matching.length));
    side.append(sideItem("pinned", "★ Pinned", matching.filter((e) => e.pinned).length));
    side.append(h("div", { class: "kb-side-sep" }));
    side.append(h("div", { class: "kb-side-label", text: "Categories" }));
    kb.cats.forEach((c) => side.append(sideItem(c.id, c.name, matching.filter((e) => e.cat === c.id).length)));
  }

  function previewOf(e) {
    if (e.type === "table") return e.rows.length + (e.rows.length === 1 ? " row" : " rows") + ((e.images || []).length ? " + " + e.images.length + " image(s)" : "") + " · click to open";
    const first = (e.body || "").split(/\r?\n/).find((l) => l.trim()) || "";
    const n = (e.images || []).length + ((e.html || "").match(/<img\b/gi) || []).length;
    return first || (n ? n + (n === 1 ? " image" : " images") : "");
  }

  function isUrl(s) { return /^https?:\/\/\S+$/i.test(s.trim()); }

  const allTags = () => Array.from(new Set(kb.entries.flatMap((e) => e.tags || []).map((t) => t.toLowerCase())))
    .sort().map((low) => kb.entries.flatMap((e) => e.tags || []).find((t) => t.toLowerCase() === low));

  // Entries linked from e, plus entries that link to e (so a link works from both sides).
  function relatedOf(e) {
    const ids = new Set(e.related || []);
    kb.entries.forEach((x) => { if (x.id !== e.id && (x.related || []).includes(e.id)) ids.add(x.id); });
    return kb.entries.filter((x) => x.id !== e.id && ids.has(x.id));
  }
  function setTagFilter(t) { tagFilter = tagFilter === t.toLowerCase() ? "" : t.toLowerCase(); render(); }
  function gotoEntry(id) {
    query = ""; tagFilter = ""; view = "all";
    $("kbSearch").value = ""; $("kbSearchClear").classList.add("hidden");
    expanded.add(id);
    render();
    const card = $("kbList").querySelector('[data-id="' + id + '"]');
    if (card) { card.scrollIntoView({ block: "start" }); card.classList.add("is-flash"); setTimeout(() => card.classList.remove("is-flash"), 900); }
  }
  const tagChip = (t, cls) => h("button", { type: "button", class: "kb-tagchip" + (cls ? " " + cls : "") + (tagFilter === t.toLowerCase() ? " is-on" : ""), title: "Show every entry tagged “" + t + "”",
    onclick: (ev) => { ev.stopPropagation(); setTagFilter(t); } }, "# " + t);

  // The "at a glance" strip at the top of an opened entry: summary, tags, related entries.
  function renderGlance(e) {
    const rel = relatedOf(e);
    if (!e.summary && !(e.tags || []).length && !rel.length) return null;
    const box = h("div", { class: "kb-glance" });
    if (e.summary) box.append(h("div", { class: "kb-glance-sum", text: e.summary }));
    if ((e.tags || []).length) box.append(h("div", { class: "kb-glance-row" }, h("span", { class: "kb-glance-label", text: "Tags" }), e.tags.map((t) => tagChip(t))));
    if (rel.length) box.append(h("div", { class: "kb-glance-row" }, h("span", { class: "kb-glance-label", text: "Related" }),
      rel.map((x) => h("button", { type: "button", class: "kb-rel", title: "Open “" + x.title + "”", onclick: () => gotoEntry(x.id) }, "→ " + x.title))));
    return box;
  }

  function renderList() {
    const list = $("kbList");
    list.textContent = "";
    const entries = visibleEntries();
    const viewName = view === "all" ? "All entries" : view === "pinned" ? "Pinned" : catName(view);
    $("kbViewTitle").textContent = "";
    $("kbViewTitle").append(viewName, h("small", { text: entries.length + (entries.length === 1 ? " entry" : " entries") + (query ? " matching “" + query + "”" : "") }));
    if (tagFilter) $("kbViewTitle").append(h("button", { type: "button", class: "kb-tagchip is-on", title: "Stop filtering by this tag", onclick: () => { tagFilter = ""; render(); } }, "# " + tagFilter + "  ✕"));

    if (!entries.length) {
      list.append(h("div", { class: "kb-empty" },
        h("b", { text: query ? "Nothing matches that search" : view === "pinned" ? "Nothing pinned yet" : "No entries here yet" }),
        query ? "Try fewer or different words." : view === "pinned" ? "Click the ☆ on any entry to pin it here." : "Use “+ New entry” to add one."));
      return;
    }
    const showChip = view === "all" || view === "pinned" || !!query;
    entries.forEach((e) => list.append(renderCard(e, showChip)));
  }

  function renderCard(e, showChip) {
    const open = expanded.has(e.id);
    const card = h("div", { class: "kb-card" + (open ? " is-open" : ""), "data-id": e.id });

    const toggle = () => { if (expanded.has(e.id)) expanded.delete(e.id); else expanded.add(e.id); renderList(); };

    const copyBtn = h("button", { type: "button", class: "kb-btn kb-btn-small", title: e.type === "table" ? "Copy the whole table" : "Copy this entry",
      onclick: (ev) => { ev.stopPropagation(); copyEntry(e); } }, e.type === "table" ? "Copy all" : "Copy");
    const editBtn = h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Edit this entry", onclick: (ev) => { ev.stopPropagation(); openEditor(e); } }, "Edit");
    const star = h("button", { type: "button", class: "kb-star" + (e.pinned ? " is-on" : ""), title: e.pinned ? "Unpin" : "Pin to the top",
      onclick: (ev) => { ev.stopPropagation(); e.pinned = !e.pinned; save(); render(); } }, e.pinned ? "★" : "☆");

    card.append(h("div", { class: "kb-card-head", onclick: toggle },
      h("span", { class: "kb-chev", text: "▶" }),
      h("div", { class: "kb-card-titles" },
        h("div", { class: "kb-card-title" }, h("span", { text: e.title }), showChip ? h("span", { class: "kb-chip", text: catName(e.cat) }) : null, (e.tags || []).slice(0, 5).map((t) => tagChip(t, "is-small"))),
        h("div", { class: "kb-card-preview", text: e.summary || previewOf(e) })),
      h("div", { class: "kb-card-actions" }, star, copyBtn, editBtn)));

    if (open) {
      const body = e.type === "table" ? renderTableBody(e) : renderTextBody(e);
      const glance = renderGlance(e);
      if (glance) body.prepend(glance);
      if ((e.images || []).length) body.append(renderGallery(e));
      card.append(body);
    }
    return card;
  }

  // Writes the entry's formatted text into `container`, swapping any {blanks} you filled in.
  function paintRich(container, e) {
    container.innerHTML = e.html;
    container.querySelectorAll("img").forEach((img) => {
      img.classList.add("kb-inline-img");
      img.title = "Click to enlarge";
      img.addEventListener("click", () => openLightbox({ data: img.src, name: img.alt || "image" }));
    });
    const vals = fillValues[e.id] || {};
    if (!Object.values(vals).some(Boolean)) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((t) => { t.nodeValue = t.nodeValue.replace(PH_RE, (all, name) => (vals[name] ? vals[name] : all)); });
  }

  function renderTextBody(e) {
    const body = h("div", { class: "kb-card-body" });
    const names = placeholdersOf(e.body);
    const rich = e.html ? h("div", { class: "kb-rich" }) : null;
    const pre = rich ? null : h("pre", { class: "kb-text", text: filledText(e) });
    const paint = () => { if (rich) paintRich(rich, e); else pre.textContent = filledText(e); };
    if (rich) paintRich(rich, e);
    if (names.length) {
      const fills = h("div", { class: "kb-fills" });
      names.forEach((name) => {
        const input = h("input", { type: "text", value: (fillValues[e.id] || {})[name] || "", placeholder: "{" + name + "}", autocomplete: "off",
          oninput: () => { (fillValues[e.id] = fillValues[e.id] || {})[name] = input.value; paint(); } });
        fills.append(h("div", { class: "kb-fill" }, h("label", { text: phLabel(name) }), input));
      });
      body.append(fills, h("div", { class: "kb-hint", text: "Fill in the blanks above and Copy gives you the finished text. Blanks left empty stay as {name}." }));
    }
    if (rich) { if (e.body.trim() || hasInlineImg(e.html)) body.append(rich); }
    else if (e.body.trim()) body.append(pre);
    return body;
  }

  const cellHtmlOf = (e, ri, ci) => (e.rowsHtml && e.rowsHtml[ri] && e.rowsHtml[ri][ci]) || "";

  function renderTableBody(e) {
    const body = h("div", { class: "kb-card-body" });
    const table = h("table", { class: "kb-table" });
    if (e.showHeader && e.columns.some((c) => c.trim())) table.append(h("thead", null, h("tr", null, e.columns.map((c) => h("th", { text: c })), h("th"))));
    const tbody = h("tbody");
    e.rows.forEach((row, ri) => {
      const tr = h("tr");
      row.forEach((cell, ci) => {
        const html = cellHtmlOf(e, ri, ci);
        const has = !!cell.trim() || hasInlineImg(html);
        const td = h("td", { class: (has ? "kb-cell" : "") + (html ? " kb-rich-cell" : ""), title: has ? "Click to copy" : null });
        if (html) {
          td.innerHTML = html; // already cleaned by sanitize() when the entry was loaded
          td.querySelectorAll("img").forEach((img) => {
            img.classList.add("kb-inline-img");
            img.title = "Click to enlarge";
            img.addEventListener("click", () => openLightbox({ data: img.src, name: img.alt || "image" }));
          });
        } else td.append(cell);
        if (has) {
          td.addEventListener("click", (ev) => {
            if (ev.target.closest && ev.target.closest("a, img")) return;
            const label = "Copied: " + (cell.trim().length > 40 ? cell.trim().slice(0, 40) + "…" : cell.trim() || "picture");
            if (html) copyRich(richForCopy(html), htmlToText(html), label);
            else copy(cell.trim(), label);
            td.classList.add("is-flash");
            setTimeout(() => td.classList.remove("is-flash"), 250);
          });
          if (!html && isUrl(cell)) td.append(h("a", { class: "kb-link", href: cell.trim(), target: "_blank", rel: "noopener noreferrer", title: "Open this link in a browser tab", text: "↗" }));
        }
        tr.append(td);
      });
      tr.append(h("td", { class: "kb-rowcopy" }, h("button", { type: "button", class: "kb-btn kb-btn-small kb-rowbtn", title: "Copy this row (tab-separated)", onclick: () => copyRows(e, [ri], "Row copied!") }, "Copy row")));
      tbody.append(tr);
    });
    table.append(tbody);
    body.append(h("div", { class: "kb-table-wrap" }, table), h("div", { class: "kb-hint", text: "Click any cell to copy just that value." }));
    return body;
  }

  // ── Images ────────────────────────────────────────────────────────────
  const MAX_IMG_SIDE = 1600; // bigger pictures are scaled down so the KB stays light

  function renderGallery(e) {
    const g = h("div", { class: "kb-gallery" });
    e.images.forEach((im) => {
      g.append(h("figure", { class: "kb-fig" },
        h("img", { class: "kb-thumb", src: im.data, alt: im.name, title: "Click to enlarge", onclick: () => openLightbox(im) }),
        h("figcaption", null,
          h("span", { class: "kb-fig-name", text: im.name }),
          h("span", { class: "kb-fig-btns" },
            h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Crop, draw, blur, rotate...", onclick: () => openImageEditor(im, (data) => { im.data = data; save(); render(); }) }, "Edit"),
            h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Copy this image so you can paste it into a ticket or email", onclick: () => copyImage(im) }, "Copy image")))));
    });
    return g;
  }

  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  function copyImage(im) {
    loadImg(im.data).then((img) => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      c.toBlob((blob) => {
        if (!blob) { toast("Couldn't copy the image"); return; }
        navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(() => toast("Image copied!"), () => toast("Couldn't copy the image"));
      }, "image/png");
    }, () => toast("Couldn't copy the image"));
  }

  function openLightbox(im) {
    const overlay = h("div", { class: "kb-overlay kb-lightbox" }, h("img", { src: im.data, alt: im.name }));
    $("kbModalRoot").append(overlay);
    const close = () => { const i = modalStack.indexOf(close); if (i >= 0) modalStack.splice(i, 1); overlay.remove(); };
    modalStack.push(close);
    overlay.addEventListener("click", close);
  }

  // Opens the image editor on top of whatever is open; onSave gets the new data URL.
  function openImageEditor(im, onSave) {
    let close = () => {};
    const node = window.KBImageEditor.create(im.data, {
      onSave: (data) => { close(); onSave(data); toast("Image updated"); },
      onCancel: () => close()
    });
    close = openModal("Edit image: " + im.name, node, null, "wide");
  }

  // File -> scaled-down data URL
  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        loadImg(reader.result).then((img) => {
          let w = img.naturalWidth, hgt = img.naturalHeight;
          const scale = Math.min(1, MAX_IMG_SIDE / Math.max(w, hgt));
          if (scale === 1 && file.size < 400 * 1024) { resolve({ id: uid(), name: file.name || "image", data: reader.result }); return; }
          w = Math.round(w * scale); hgt = Math.round(hgt * scale);
          const c = document.createElement("canvas");
          c.width = w; c.height = hgt;
          c.getContext("2d").drawImage(img, 0, 0, w, hgt);
          resolve({ id: uid(), name: file.name || "image", data: c.toDataURL("image/webp", 0.9) });
        }, reject);
      };
      reader.readAsDataURL(file);
    });
  }

  // Puts both the formatted and the plain version on the clipboard, so pasting into an
  // email or ticket box keeps the formatting and pasting into a plain field gives plain text.
  function copyRich(html, plain, msg) {
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" })
      })]).then(() => toast(msg), () => copy(plain, msg));
    } else copy(plain, msg);
  }

  // Pills lose their look outside this window (the page's CSS isn't pasted), so give them inline styles.
  const PILL_STYLES = {
    "kb-tag": "display:inline-block;padding:1px 9px;border-radius:999px;border:1px solid #b9822a;background:#fdf1d8;color:#6b4a0c;font-size:12px",
    "kb-badge": "display:inline-block;padding:1px 9px;border-radius:999px;border:1px solid #16a34a;background:#dcfce7;color:#166534;font-size:12px;font-weight:600"
  };
  function inlinePills(root) {
    Object.keys(PILL_STYLES).forEach((cls) => root.querySelectorAll("." + cls).forEach((el) => { el.setAttribute("style", PILL_STYLES[cls]); el.removeAttribute("class"); }));
    root.querySelectorAll("img").forEach((img) => { img.removeAttribute("title"); img.removeAttribute("class"); });
  }
  function richForCopy(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    inlinePills(tmp);
    return tmp.innerHTML;
  }
  // Tab-separated text; a cell with several lines (a list, say) is quoted so a spreadsheet keeps it in one cell.
  const tsvCell = (t) => (/[\n\t"]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);

  // Copies the chosen rows (all of them for "Copy all"). A table with formatted cells goes out as an HTML
  // table plus plain text, so it keeps its look when pasted into an email or ticket.
  function copyRows(e, idx, msg, all) {
    const withHeader = all && e.showHeader && e.columns.some((c) => c.trim());
    if (!e.rowsHtml) {
      const lines = [];
      if (withHeader) lines.push(e.columns.join("\t"));
      idx.forEach((ri) => lines.push(e.rows[ri].join("\t")));
      copy(lines.join("\n"), msg);
      return;
    }
    const plain = [];
    const tbl = document.createElement("table");
    tbl.setAttribute("style", "border-collapse:collapse");
    const cellStyle = "border:1px solid #c9cfda;padding:6px 8px;vertical-align:top;text-align:left";
    if (withHeader) {
      plain.push(e.columns.map(tsvCell).join("\t"));
      const tr = document.createElement("tr");
      e.columns.forEach((c) => { const th = document.createElement("th"); th.setAttribute("style", cellStyle + ";background:#eef1f6"); th.textContent = c; tr.append(th); });
      tbl.append(tr);
    }
    idx.forEach((ri) => {
      plain.push(e.rows[ri].map(tsvCell).join("\t"));
      const tr = document.createElement("tr");
      e.rows[ri].forEach((c, ci) => {
        const td = document.createElement("td");
        td.setAttribute("style", cellStyle);
        const html = cellHtmlOf(e, ri, ci);
        if (html) td.innerHTML = richForCopy(html); else td.textContent = c;
        tr.append(td);
      });
      tbl.append(tr);
    });
    copyRich(tbl.outerHTML, plain.join("\n"), msg);
  }

  function copyEntry(e) {
    if (e.type === "table") {
      copyRows(e, e.rows.map((_, i) => i), "Table copied!", true);
    } else if (!e.body.trim() && !hasInlineImg(e.html)) {
      toast("Nothing to copy - use Copy image");
    } else if (e.html) {
      const tmp = document.createElement("div");
      paintRich(tmp, e);
      inlinePills(tmp);
      copyRich(tmp.innerHTML, htmlToText(tmp), "Copied!");
    } else {
      copy(filledText(e), "Copied!");
    }
  }

  // ── Modals ────────────────────────────────────────────────────────────
  // Modals stack (the image editor opens on top of the entry editor), Esc closes the top one.
  const modalStack = [];
  function openModal(title, bodyNode, footNode, opts) {
    const overlay = h("div", { class: "kb-overlay" });
    const modal = h("div", { class: "kb-modal" + (opts === "small" ? " is-small" : "") + (opts === "wide" ? " is-wide" : "") },
      h("div", { class: "kb-modal-head", text: title }),
      h("div", { class: "kb-modal-body" }, bodyNode),
      footNode ? h("div", { class: "kb-modal-foot" }, footNode) : null);
    overlay.append(modal);
    $("kbModalRoot").append(overlay);
    const close = () => { const i = modalStack.indexOf(close); if (i >= 0) modalStack.splice(i, 1); overlay.remove(); };
    modalStack.push(close);
    return close;
  }
  function closeModal() { const top = modalStack[modalStack.length - 1]; if (top) top(); }

  function confirmDialog(title, text, label, onYes) {
    const close = openModal(title, h("div", { text }), [
      h("span"),
      h("div", { class: "right" },
        h("button", { type: "button", class: "kb-btn", onclick: () => close() }, "Cancel"),
        h("button", { type: "button", class: "kb-btn kb-btn-primary", onclick: () => { close(); onYes(); } }, label))
    ], "small");
  }

  // ── Entry editor ──────────────────────────────────────────────────────
  function openEditor(existing) {
    const isNew = !existing;
    const draft = existing
      ? JSON.parse(JSON.stringify(existing))
      : { id: uid(), title: "", cat: (view !== "all" && view !== "pinned") ? view : FALLBACK_CAT, type: "text", body: "", pinned: false };
    if (!draft.body) draft.body = "";
    if (!Array.isArray(draft.images)) draft.images = [];
    draft.html = existing ? (existing.html || plainToHtml(existing.body || "")) : "";
    if (!draft.columns) { draft.columns = ["", ""]; draft.rows = [["", ""]]; draft.showHeader = true; }
    // Auto-names on a table whose header row is hidden are not real headers: show the placeholder instead.
    if (draft.showHeader === false && draft.columns.every((c) => /^Column \d+$/.test(c))) draft.columns = draft.columns.map(() => "");
    // grid = the HTML of every cell while editing (plain cells are just their text)
    draft.grid = draft.rows.map((r, ri) => r.map((c, ci) => (draft.rowsHtml && draft.rowsHtml[ri] && draft.rowsHtml[ri][ci]) || plainToHtml(c)));
    draft.tags = Array.isArray(draft.tags) ? draft.tags.slice() : [];
    draft.related = Array.isArray(draft.related) ? draft.related.slice() : [];
    draft.summary = draft.summary || "";
    let newCatName = "";
    let addingCat = false;

    const root = h("div");
    const close = openModal(isNew ? "New entry" : "Edit entry", root, null);
    const foot = h("div", { class: "kb-modal-foot" });
    root.parentElement.parentElement.append(foot);

    function syncGridFromDOM() { /* grid inputs write straight into draft on input */ }

    function draw() {
      root.textContent = "";
      foot.textContent = "";

      const titleInput = h("input", { class: "kb-input", type: "text", value: draft.title, maxlength: 120, placeholder: "e.g. Titan DNS records", oninput: () => { draft.title = titleInput.value; } });
      root.append(h("div", { class: "kb-field" }, h("label", { text: "Title" }), titleInput));

      const sel = h("select", { class: "kb-select", onchange: () => {
        if (sel.value === "__new") { addingCat = true; draw(); const i = root.querySelector("#kbNewCat"); if (i) i.focus(); }
        else draft.cat = sel.value;
      } }, kb.cats.map((c) => h("option", { value: c.id, text: c.name })), h("option", { value: "__new", text: "＋ New category…" }));
      sel.value = draft.cat;
      const catField = h("div", { class: "kb-field" }, h("label", { text: "Category" }), sel);
      if (addingCat) {
        const ni = h("input", { class: "kb-input", id: "kbNewCat", type: "text", value: newCatName, maxlength: 40, placeholder: "New category name", oninput: () => { newCatName = ni.value; } });
        catField.append(h("div", { class: "kb-row", style: "margin-top:6px" }, ni,
          h("button", { type: "button", class: "kb-btn", onclick: () => { addingCat = false; newCatName = ""; draw(); } }, "Cancel")));
      }
      root.append(catField);
      root.append(buildMetaFields());

      const seg = h("div", { class: "kb-seg" },
        h("button", { type: "button", class: draft.type === "text" ? "is-on" : "", onclick: () => switchType("text") }, "Text"),
        h("button", { type: "button", class: draft.type === "table" ? "is-on" : "", onclick: () => switchType("table") }, "Table"));
      root.append(h("div", { class: "kb-field" }, h("label", { text: "Format" }), seg));

      if (draft.type === "text") {
        root.append(buildRichEditor(),
          h("div", { class: "kb-hint", text: "Tip: wrap a word in {curly braces}, like {domain}, and the entry shows a box to fill it in before you copy." }));
      } else {
        root.append(buildGrid());
      }

      root.append(buildImagesField());

      foot.append(isNew ? h("span") : h("button", { type: "button", class: "kb-btn kb-btn-danger", onclick: () => {
        confirmDialog("Delete entry", "Delete “" + draft.title + "”? This can't be undone.", "Delete", () => {
          kb.entries = kb.entries.filter((x) => x.id !== draft.id);
          kb.entries.forEach((x) => { if (x.related) { x.related = x.related.filter((r) => r !== draft.id); if (!x.related.length) delete x.related; } });
          if (draft.src) kb.ignored.push(draft.src); // so “Sync from templates” doesn't bring it back
          save(); close(); render(); toast("Deleted");
        });
      } }, "Delete"),
      h("div", { class: "right" },
        h("button", { type: "button", class: "kb-btn", onclick: () => close() }, "Cancel"),
        h("button", { type: "button", class: "kb-btn kb-btn-primary", onclick: commit }, "Save")));
    }

    // At-a-glance extras: summary line, tags, related entries.
    function buildMetaFields() {
      const box = h("div");
      const sum = h("input", { class: "kb-input", type: "text", maxlength: 200, value: draft.summary, placeholder: "e.g. The server is reachable, but the page or file requested does not exist",
        oninput: () => { draft.summary = sum.value; } });
      box.append(h("div", { class: "kb-field" }, h("label", { text: "At a glance summary (optional)" }), sum));

      const chips = h("div", { class: "kb-edit-chips" });
      const tagInp = h("input", { class: "kb-input", type: "text", maxlength: 30, placeholder: "Add a tag, then press Enter (e.g. 404 Not Found)", list: "kbTagList", autocomplete: "off" });
      const dl = h("datalist", { id: "kbTagList" }, allTags().map((t) => h("option", { value: t })));
      function paintTags() {
        chips.textContent = "";
        draft.tags.forEach((t, i) => chips.append(h("span", { class: "kb-tagchip is-edit" }, "# " + t,
          h("button", { type: "button", title: "Remove this tag", onclick: () => { draft.tags.splice(i, 1); paintTags(); } }, "✕"))));
      }
      function addTag() {
        const t = tagInp.value.replace(/[,\s]+$/g, "").replace(/^[#\s]+/, "").replace(/\s+/g, " ").trim();
        tagInp.value = "";
        if (!t) return;
        if (draft.tags.length >= 12) { toast("Up to 12 tags per entry"); return; }
        if (!draft.tags.some((x) => x.toLowerCase() === t.toLowerCase())) draft.tags.push(t);
        paintTags();
      }
      tagInp.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === ",") { ev.preventDefault(); addTag(); } });
      tagInp.addEventListener("blur", addTag);
      paintTags();
      box.append(h("div", { class: "kb-field" }, h("label", { text: "Tags (optional)" }), tagInp, dl, chips));

      const relChips = h("div", { class: "kb-edit-chips" });
      const relSel = h("select", { class: "kb-select", onchange: () => {
        if (relSel.value && !draft.related.includes(relSel.value)) draft.related.push(relSel.value);
        paintRel();
      } });
      function paintRel() {
        relSel.textContent = "";
        relSel.append(h("option", { value: "", text: "Add a related entry…" }));
        kb.entries.filter((x) => x.id !== draft.id && !draft.related.includes(x.id))
          .forEach((x) => relSel.append(h("option", { value: x.id, text: x.title + "  (" + catName(x.cat) + ")" })));
        relSel.value = "";
        relChips.textContent = "";
        draft.related.forEach((id, i) => {
          const x = kb.entries.find((y) => y.id === id);
          if (!x) return;
          relChips.append(h("span", { class: "kb-tagchip is-edit" }, "→ " + x.title,
            h("button", { type: "button", title: "Remove this link", onclick: () => { draft.related.splice(i, 1); paintRel(); } }, "✕")));
        });
      }
      paintRel();
      box.append(h("div", { class: "kb-field" }, h("label", { text: "Related entries (optional)" }), relSel, relChips,
        h("div", { class: "kb-hint", text: "Links show on both entries, so you only need to add it on one." })));
      return box;
    }

    function switchType(t) {
      if (t === draft.type) return;
      if (t === "table") {
        // pictures typed into the text move to the Images box (use "Insert in cell" to put them back in a cell)
        const tmpDiv = document.createElement("div");
        tmpDiv.innerHTML = sanitizeHtml(draft.html || "");
        tmpDiv.querySelectorAll("img").forEach((img) => draft.images.push({ id: uid(), name: img.alt || "image", data: img.src }));
        const lines = htmlToText(sanitizeHtml(draft.html || "")).split(/\r?\n/).filter((l) => l.trim());
        if (lines.length) {
          const rows = lines.map((l) => l.split("\t"));
          const w = Math.max(...rows.map((r) => r.length), 1);
          rows.forEach((r) => { while (r.length < w) r.push(""); });
          draft.columns = Array.from({ length: w }, () => "");
          draft.grid = rows.map((r) => r.map((c) => plainToHtml(c)));
          draft.showHeader = false;
        }
        draft.type = "table";
      } else {
        const cells = draft.grid.map((r) => r.map((c) => sanitizeHtml(c)));
        cells.forEach((r) => r.forEach((c) => { const d = document.createElement("div"); d.innerHTML = c; d.querySelectorAll("img").forEach((img) => draft.images.push({ id: uid(), name: img.alt || "image", data: img.src })); }));
        const lines = cells.map((r) => r.map((c) => htmlToText(c)).join("\t"));
        if (draft.showHeader && draft.columns.some((c) => c.trim())) lines.unshift(draft.columns.join("\t"));
        draft.html = plainToHtml(lines.join("\n"));
        draft.type = "text";
      }
      draw();
    }

    // ── Rich text editor (toolbar + editable box) ──────────────────────
    const FONTS = [
      ["Segoe UI", "'Segoe UI', system-ui, sans-serif"], ["Arial", "Arial, Helvetica, sans-serif"], ["Verdana", "Verdana, Geneva, sans-serif"],
      ["Tahoma", "Tahoma, sans-serif"], ["Calibri", "Calibri, Carlito, sans-serif"], ["Georgia", "Georgia, serif"],
      ["Times New Roman", "'Times New Roman', Times, serif"], ["Courier New", "'Courier New', monospace"], ["Consolas", "Consolas, 'Courier New', monospace"]
    ];
    const SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40];

    let insertInlineImage = null; // set by the editor: (imageObj) => puts it in the text (or the active table cell) at the caret

    // One formatting toolbar that can drive one or many editable boxes: the Text format has a single
    // box, a Table has one per cell and the toolbar works on whichever cell you last clicked in.
    // opts.tags: add the Tag / Badge pill buttons. opts.imgWidth: default width (px) of pasted pictures.
    function createRichKit(opts) {
      opts = opts || {};
      const editors = new Map();   // editable element -> (html) => store it in the draft
      let ed = null;               // the box the toolbar acts on
      let savedRange = null;
      let pendingSize = null;
      let selImg = null;
      const stateBtns = {};

      function normalizeSizes() {
        if (!pendingSize || !ed) return;
        ed.querySelectorAll("font[size]").forEach((f) => {
          const s = document.createElement("span");
          s.style.fontSize = pendingSize + "px";
          while (f.firstChild) s.append(f.firstChild);
          f.replaceWith(s);
        });
        ed.querySelectorAll("span").forEach((s) => { if (s.style.fontSize === "xxx-large") s.style.fontSize = pendingSize + "px"; });
      }
      function sync() {
        if (!ed) return;
        normalizeSizes();
        if (ed.innerHTML === "<br>") ed.innerHTML = "";
        const store = editors.get(ed);
        if (store) store(ed.innerHTML);
      }
      function needBox() {
        if (ed) return true;
        toast("Click in a cell first");
        return false;
      }
      function restoreSel() {
        if (!ed) return;
        ed.focus();
        if (savedRange && ed.contains(savedRange.commonAncestorContainer)) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
      }
      function exec(cmd, val) {
        if (!needBox()) return;
        restoreSel();
        document.execCommand("styleWithCSS", false, true);
        document.execCommand(cmd, false, val === undefined ? null : val);
        sync(); updateStates();
      }
      function updateStates() {
        Object.entries(stateBtns).forEach(([cmd, b]) => {
          let on = false;
          try { on = document.queryCommandState(cmd); } catch (e) { /* ignore */ }
          b.classList.toggle("is-on", on);
        });
      }
      function editorOf(node) {
        for (let n = node; n; n = n.parentNode) if (editors.has(n)) return n;
        return null;
      }
      // Remember where the caret / selection is, since clicking a dropdown or colour box moves focus away.
      function onSelChange() {
        if (!toolbar.isConnected) { document.removeEventListener("selectionchange", onSelChange); return; }
        const s = window.getSelection();
        if (!s.rangeCount) return;
        const el = editorOf(s.anchorNode);
        if (el) { ed = el; savedRange = s.getRangeAt(0).cloneRange(); updateStates(); }
      }
      document.addEventListener("selectionchange", onSelChange);

      // ── Inline pictures ──
      const SIZE_CHOICES = [["Small", 240], ["Medium", 480], ["Large", 720], ["Original", 0]];
      const imgBar = h("div", { class: "kb-linkbar kb-imgbar hidden" });
      function selectImg(img) {
        if (selImg) selImg.classList.remove("is-sel");
        selImg = img;
        imgBar.textContent = "";
        if (!img) { imgBar.classList.add("hidden"); return; }
        img.classList.add("is-sel");
        const cur = parseInt(img.getAttribute("width"), 10) || 0;
        imgBar.append(h("span", { class: "kb-hint", style: "margin:0", text: "Picture:" }),
          ...SIZE_CHOICES.map(([n, px]) => h("button", { type: "button", class: "kb-btn kb-btn-small" + (cur === px ? " kb-btn-primary" : ""), onclick: () => {
            if (px) img.setAttribute("width", String(px)); else img.removeAttribute("width");
            sync(); selectImg(img);
          } }, n)),
          h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Crop, draw, blur, rotate...", onclick: () => {
            openImageEditor({ name: img.alt || "image", data: img.src }, (data) => { img.src = data; sync(); });
          } }, "Edit"),
          h("button", { type: "button", class: "kb-btn kb-btn-small kb-btn-danger", onclick: () => { img.remove(); selectImg(null); sync(); } }, "Remove"),
          h("button", { type: "button", class: "kb-btn kb-btn-small", onclick: () => selectImg(null) }, "Done"));
        imgBar.classList.remove("hidden");
      }
      function placeImage(im) {
        if (!needBox()) return false;
        restoreSel();
        const w = opts.imgWidth ? ' width="' + opts.imgWidth + '"' : "";
        const html = '<img src="' + im.data + '" alt="' + escapeHtml(im.name || "image") + '"' + w + ' style="max-width: 100%; height: auto">';
        document.execCommand("insertHTML", false, html);
        sync();
        return true;
      }
      function insertFiles(files) {
        const imgs = Array.from(files || []).filter((f) => f.type && f.type.startsWith("image/"));
        if (!imgs.length) return;
        const target = ed; // the box the picture was dropped / pasted into
        Promise.all(imgs.map(fileToImage)).then((list) => {
          ed = target;
          list.forEach((im) => {
            if (/^image\.\w+$/.test(im.name)) im.name = "Picture";
            placeImage(im);
          });
        }, () => toast("Couldn't read that image"));
      }
      const picker = h("input", { type: "file", accept: "image/*", multiple: true, class: "hidden", onchange: () => { if (needBox()) insertFiles(picker.files); picker.value = ""; } });

      const tbtn = (label, title, fn, cmd, extra) => {
        const b = h("button", { type: "button", class: "kb-tb" + (extra ? " " + extra : ""), title, onmousedown: (ev) => ev.preventDefault(), onclick: fn }, label);
        if (cmd) stateBtns[cmd] = b;
        return b;
      };
      const fontSel = h("select", { class: "kb-tb-select", title: "Font", onchange: () => { if (fontSel.value) exec("fontName", fontSel.value); fontSel.value = ""; } },
        h("option", { value: "", text: "Font" }), FONTS.map(([n, v]) => h("option", { value: v, text: n })));
      const sizeSel = h("select", { class: "kb-tb-select kb-tb-size", title: "Font size", onchange: () => {
        if (sizeSel.value) { pendingSize = Number(sizeSel.value); exec("fontSize", "7"); }
        sizeSel.value = "";
      } }, h("option", { value: "", text: "Size" }), SIZES.map((n) => h("option", { value: String(n), text: n + " px" })));
      const colorBox = (label, title, cmd, init, cls) => {
        const inp = h("input", { type: "color", value: init, oninput: () => exec(cmd, inp.value) });
        return h("label", { class: "kb-tb kb-tb-color " + cls, title }, h("span", { text: label }), inp);
      };

      // Link bar (shown under the toolbar)
      const urlInp = h("input", { class: "kb-input", type: "text", placeholder: "https://example.com", autocomplete: "off" });
      const linkBar = h("div", { class: "kb-linkbar hidden" }, urlInp,
        h("button", { type: "button", class: "kb-btn kb-btn-small kb-btn-primary", onclick: applyLink }, "Apply"),
        h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Open this link in a new tab", onclick: openCurrentLink }, "Open"),
        h("button", { type: "button", class: "kb-btn kb-btn-small", onclick: removeLink }, "Remove link"),
        h("button", { type: "button", class: "kb-btn kb-btn-small", onclick: closeLinkBar }, "Cancel"));
      // Keep the chosen text visibly highlighted while the link bar has focus (the browser
      // would otherwise grey the selection out as soon as you click into the URL box).
      function showLinkHl(range) {
        try { if (window.CSS && CSS.highlights && range && typeof Highlight !== "undefined") CSS.highlights.set("kb-link-sel", new Highlight(range)); } catch (e) { /* older Chrome: no highlight, link still works */ }
      }
      function clearLinkHl() { try { if (window.CSS && CSS.highlights) CSS.highlights.delete("kb-link-sel"); } catch (e) { /* ignore */ } }
      function closeLinkBar() { linkBar.classList.add("hidden"); clearLinkHl(); }
      function openCurrentLink() {
        let url = urlInp.value.trim();
        if (!url) { toast("Type or paste the link first"); return; }
        if (!/^(https?:|mailto:)/i.test(url)) url = /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(url) ? "mailto:" + url : "https://" + url;
        window.open(url, "_blank", "noopener");
      }
      function linkAtCaret() {
        const n = savedRange && savedRange.commonAncestorContainer;
        const el = n && (n.nodeType === 1 ? n : n.parentElement);
        const a = el && el.closest ? el.closest("a") : null;
        return a && ed && ed.contains(a) ? a : null;
      }
      function openLink(keepFocus) {
        if (!needBox()) return;
        const s = window.getSelection();
        if (s.rangeCount && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
        const a = linkAtCaret();
        urlInp.value = a ? a.getAttribute("href") : "";
        linkBar.classList.remove("hidden");
        // highlight what the link will be applied to: the selected text, or the whole link being edited
        if (a) { const r = document.createRange(); r.selectNodeContents(a); showLinkHl(r); }
        else if (savedRange && !savedRange.collapsed) showLinkHl(savedRange.cloneRange());
        else clearLinkHl();
        if (keepFocus === true) return;
        urlInp.focus(); urlInp.select();
      }
      function applyLink() {
        let url = urlInp.value.trim();
        if (!url) { toast("Type or paste the link first"); return; }
        if (!needBox()) return;
        if (!/^(https?:|mailto:)/i.test(url)) url = /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(url) ? "mailto:" + url : "https://" + url;
        restoreSel();
        const sel = window.getSelection();
        const existingA = linkAtCaret();
        if (existingA) { existingA.setAttribute("href", url); sync(); }
        else if (!sel.rangeCount || sel.isCollapsed) exec("insertHTML", '<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + "</a>");
        else exec("createLink", url);
        closeLinkBar();
      }
      function removeLink() {
        if (!needBox()) return;
        restoreSel();
        const a = linkAtCaret();
        if (a) { const r = document.createRange(); r.selectNodeContents(a); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); savedRange = r.cloneRange(); }
        exec("unlink");
        closeLinkBar();
      }
      urlInp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); applyLink(); } });

      // ── Tag / Badge pills (used for the chips and status labels in table cells) ──
      function unwrapEl(el) { while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el); el.remove(); }
      function pillsInSelection(cls) {
        const s = window.getSelection();
        if (!ed || !s.rangeCount) return [];
        const range = s.getRangeAt(0);
        return Array.from(ed.querySelectorAll(cls ? "." + cls : ".kb-tag, .kb-badge")).filter((n) => range.intersectsNode(n));
      }
      function togglePill(cls, label) {
        if (!needBox()) return;
        restoreSel();
        const s = window.getSelection();
        if (!s.rangeCount) return;
        const hits = pillsInSelection(cls);
        if (hits.length) { hits.forEach(unwrapEl); sync(); return; } // already one: toggle it off
        if (s.isCollapsed) { toast("Select the text first, then click " + label + " (one " + label.toLowerCase() + " per selected line)"); return; }
        const lines = s.toString().split(/\r?\n+/).map((x) => x.trim()).filter(Boolean);
        if (!lines.length) return;
        document.execCommand("insertHTML", false, lines.map((l) => '<span class="' + cls + '">' + escapeHtml(l) + "</span>").join(" ") + "&nbsp;");
        sync();
      }
      function clearFormatting() {
        if (!needBox()) return;
        restoreSel();
        if (opts.tags) pillsInSelection().forEach(unwrapEl);
        exec("removeFormat");
      }

      const toolbar = h("div", { class: "kb-toolbar-rich" },
        fontSel, sizeSel,
        tbtn("B", "Bold (Ctrl+B)", () => exec("bold"), "bold", "kb-tb-b"),
        tbtn("I", "Italic (Ctrl+I)", () => exec("italic"), "italic", "kb-tb-i"),
        tbtn("U", "Underline (Ctrl+U)", () => exec("underline"), "underline", "kb-tb-u"),
        tbtn("S", "Strikethrough", () => exec("strikeThrough"), "strikeThrough", "kb-tb-s"),
        colorBox("A", "Text colour", "foreColor", "#e8a33d", "kb-tb-fore"),
        colorBox("▇", "Highlight colour", "hiliteColor", "#fff176", "kb-tb-back"),
        h("span", { class: "kb-tb-sep" }),
        tbtn("Link", "Add or edit a link (Ctrl+K)", openLink),
        tbtn("Unlink", "Remove link", removeLink),
        tbtn("Image", "Insert a picture at the cursor (or just paste / drag a screenshot in)", () => { if (needBox()) picker.click(); }),
        h("span", { class: "kb-tb-sep" }),
        tbtn("• List", "Bulleted list", () => exec("insertUnorderedList"), "insertUnorderedList"),
        tbtn("1. List", "Numbered list", () => exec("insertOrderedList"), "insertOrderedList"),
        tbtn("⇤", "Align left", () => exec("justifyLeft")),
        tbtn("↔", "Centre", () => exec("justifyCenter")),
        tbtn("⇥", "Align right", () => exec("justifyRight")),
        opts.tags ? h("span", { class: "kb-tb-sep" }) : null,
        opts.tags ? tbtn("Tag", "Turn the selected text into a pill, like “404 Not Found”. Select several lines to make one pill per line. Click again to undo.", () => togglePill("kb-tag", "Tag"), null, "kb-tb-tag") : null,
        opts.tags ? tbtn("Badge", "Turn the selected text into a green badge, like “Frontline can resolve”. Click again to undo.", () => togglePill("kb-badge", "Badge"), null, "kb-tb-badge") : null,
        h("span", { class: "kb-tb-sep" }),
        tbtn("↶", "Undo", () => exec("undo")),
        tbtn("↷", "Redo", () => exec("redo")),
        tbtn("Clear", "Remove all formatting from the selection", clearFormatting));

      // Hooks a contenteditable box up to the toolbar. store(html) saves its content into the draft.
      function attach(el, store) {
        editors.set(el, store);
        if (!ed) ed = el;
        el.addEventListener("focus", () => { ed = el; });
        el.addEventListener("input", () => { ed = el; sync(); });
        el.addEventListener("click", (ev) => {
          ed = el;
          selectImg(ev.target && ev.target.tagName === "IMG" ? ev.target : null);
          // Clicking a link: Ctrl+click opens it straight away; a plain click shows the link bar
          // (with the link highlighted and an Open button) without stealing the cursor.
          const a = ev.target && ev.target.closest ? ev.target.closest("a") : null;
          if (!a || !el.contains(a)) return;
          if (ev.ctrlKey || ev.metaKey) { ev.preventDefault(); window.open(a.getAttribute("href"), "_blank", "noopener"); return; }
          const r = document.createRange(); r.setStart(a, 0); r.setEnd(a, a.childNodes.length);
          savedRange = r;
          openLink(true);
        });
        el.addEventListener("keydown", (ev) => {
          if (selImg && el.contains(selImg) && (ev.key === "Delete" || ev.key === "Backspace")) { ev.preventDefault(); selImg.remove(); selectImg(null); sync(); return; }
          if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); ed = el; openLink(); }
        });
        el.addEventListener("dragover", (ev) => {
          if (ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes("Files")) ev.preventDefault();
        });
        el.addEventListener("drop", (ev) => {
          const files = ev.dataTransfer && Array.from(ev.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
          if (!files || !files.length) return; // text or moving a picture inside the box: let the browser handle it
          ev.preventDefault();
          ev.stopPropagation();
          ed = el;
          let range = null;
          if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(ev.clientX, ev.clientY);
          if (range && el.contains(range.startContainer)) savedRange = range;
          insertFiles(files);
        });
        // Paste: screenshots go in at the caret; text/HTML is cleaned first.
        el.addEventListener("paste", (ev) => {
          const cd = ev.clipboardData;
          if (!cd) return;
          ed = el;
          const pics = Array.from(cd.files || []).filter((f) => f.type.startsWith("image/"));
          if (pics.length) { ev.preventDefault(); ev.stopPropagation(); insertFiles(pics); return; } // screenshot -> straight into the box
          ev.preventDefault();
          const html = cd.getData("text/html");
          if (html) {
            const clean = sanitizeHtml(html, { paste: true });
            if (htmlToText(clean).trim()) { document.execCommand("insertHTML", false, clean); sync(); return; }
          }
          const t = cd.getData("text/plain");
          if (t) { document.execCommand("insertText", false, t); sync(); }
        });
      }

      return { toolbar, linkBar, imgBar, picker, attach, placeImage };
    }

    function buildRichEditor() {
      const wrap = h("div", { class: "kb-field" }, h("label", { text: "Content" }));
      const ed = h("div", { class: "kb-richedit", contenteditable: "true", spellcheck: "true",
        "data-placeholder": "Write or paste the content here. Use {name} for a blank you fill in when copying." });
      ed.innerHTML = sanitizeHtml(draft.html || "");
      const kit = createRichKit({});
      kit.attach(ed, (html) => { draft.html = html; });
      insertInlineImage = kit.placeImage;
      wrap.append(kit.toolbar, kit.linkBar, kit.imgBar, kit.picker, ed);
      return wrap;
    }

    function addFiles(files) {
      const imgs = Array.from(files || []).filter((f) => f.type && f.type.startsWith("image/"));
      if (!imgs.length) return;
      Promise.all(imgs.map(fileToImage)).then((list) => {
        list.forEach((im) => {
          if (im.name === "image.png" || /^image\.\w+$/.test(im.name)) im.name = "Pasted image " + (draft.images.length + 1);
          draft.images.push(im);
        });
        draw();
      }, () => toast("Couldn't read that image"));
    }

    function buildImagesField() {
      const field = h("div", { class: "kb-field kb-drop" }, h("label", { text: "Images (optional)" }));
      const picker = h("input", { type: "file", accept: "image/*", multiple: true, class: "hidden", onchange: () => { addFiles(picker.files); picker.value = ""; } });
      const strip = h("div", { class: "kb-edit-gallery" });
      draft.images.forEach((im, i) => {
        const nameInp = h("input", { class: "kb-input", type: "text", value: im.name, maxlength: 80, oninput: () => { im.name = nameInp.value; } });
        strip.append(h("div", { class: "kb-edit-img" },
          h("img", { src: im.data, alt: im.name }),
          nameInp,
          h("div", { class: "kb-row", style: "gap:4px" },
            h("button", { type: "button", class: "kb-btn kb-btn-small", title: draft.type === "text" ? "Put this picture into the text at the cursor" : "Put this picture into the cell you last clicked", onclick: () => {
              if (!insertInlineImage || insertInlineImage(im) === false) return;
              draft.images.splice(i, 1);
              const keep = draft.html; draw(); draft.html = keep;
            } }, draft.type === "text" ? "Insert in text" : "Insert in cell"),
            h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Crop, draw, blur, rotate...", onclick: () => openImageEditor(im, (data) => { im.data = data; draw(); }) }, "Edit"),
            h("button", { type: "button", class: "kb-btn kb-btn-small kb-btn-danger", onclick: () => { draft.images.splice(i, 1); draw(); } }, "Remove"))));
      });
      field.append(strip,
        h("div", { class: "kb-row", style: "margin-top:8px" },
          h("button", { type: "button", class: "kb-btn", onclick: () => picker.click() }, "+ Add images"),
          h("span", { class: "kb-hint", style: "margin:0", text: draft.type === "table"
            ? "or paste a screenshot here / drag files here. To put a picture inside a table cell, click the cell and paste straight into it (or use the Image button above the table)."
            : "or paste a screenshot here / drag files here. To put a picture inside the text, use the Image button above the text box, or paste straight into the text." })),
        picker);
      field.addEventListener("dragover", (ev) => { ev.preventDefault(); field.classList.add("is-drag"); });
      field.addEventListener("dragleave", () => field.classList.remove("is-drag"));
      field.addEventListener("drop", (ev) => { ev.preventDefault(); field.classList.remove("is-drag"); addFiles(ev.dataTransfer && ev.dataTransfer.files); });
      return field;
    }

    // Ctrl+V of a screenshot anywhere in the editor adds it (plain text pastes are left alone)
    root.closest(".kb-overlay").addEventListener("paste", (ev) => {
      const files = ev.clipboardData && Array.from(ev.clipboardData.files || []).filter((f) => f.type.startsWith("image/"));
      if (files && files.length) { ev.preventDefault(); addFiles(files); }
    });

    function buildGrid() {
      const wrap = h("div", { class: "kb-field" }, h("label", { text: "Table" }));
      const kit = createRichKit({ tags: true, imgWidth: 240 });
      kit.toolbar.classList.add("is-sticky");
      insertInlineImage = kit.placeImage; // "Insert in cell" in the Images box
      const tbl = h("table", { class: "kb-grid" });
      const hr = h("tr");
      draft.columns.forEach((c, ci) => {
        const inp = h("input", { class: "is-head", type: "text", value: c, placeholder: "Add header here", oninput: () => { draft.columns[ci] = inp.value; } });
        const x = draft.columns.length > 1 ? h("button", { type: "button", class: "x", title: "Delete this column", onclick: () => { draft.columns.splice(ci, 1); draft.grid.forEach((r) => r.splice(ci, 1)); draw(); } }, "✕") : null;
        const insCol = (side) => () => {
          const at = ci + (side === "right" ? 1 : 0);
          draft.columns.splice(at, 0, "");
          draft.grid.forEach((r) => r.splice(at, 0, ""));
          draw();
          const heads = root.querySelectorAll(".kb-grid tr:first-child input.is-head");
          if (heads[at]) heads[at].focus();
        };
        const tools = h("div", { class: "kb-grid-tools" },
          h("button", { type: "button", class: "kb-ins", title: "Insert a column to the left", onclick: insCol("left") }, "+ ←"),
          h("button", { type: "button", class: "kb-ins", title: "Insert a column to the right", onclick: insCol("right") }, "→ +"));
        hr.append(h("td", null, h("div", { class: "kb-row", style: "gap:2px" }, inp, x), tools));
      });
      hr.append(h("td"));
      tbl.append(hr);
      draft.grid.forEach((row, ri) => {
        const tr = h("tr");
        row.forEach((cell, ci) => {
          const box = h("div", { class: "kb-cellrich", contenteditable: "true", spellcheck: "true", "data-placeholder": "Add text here" });
          box.innerHTML = sanitizeHtml(cell || "");
          kit.attach(box, (html) => { draft.grid[ri][ci] = html; });
          tr.append(h("td", null, box));
        });
        const insRow = (side) => () => {
          const at = ri + (side === "below" ? 1 : 0);
          draft.grid.splice(at, 0, draft.columns.map(() => ""));
          draw();
          const cells = root.querySelectorAll(".kb-grid .kb-cellrich");
          const target = cells[at * draft.columns.length];
          if (target) target.focus();
        };
        tr.append(h("td", null, h("div", { class: "kb-grid-rowtools" },
          h("button", { type: "button", class: "kb-ins", title: "Insert a row above", onclick: insRow("above") }, "+ ↑"),
          h("button", { type: "button", class: "kb-ins", title: "Insert a row below", onclick: insRow("below") }, "+ ↓"),
          h("button", { type: "button", class: "x", title: "Delete this row", onclick: () => { draft.grid.splice(ri, 1); draw(); } }, "✕"))));
        tbl.append(tr);
      });
      wrap.append(kit.toolbar, kit.linkBar, kit.imgBar, kit.picker, h("div", { class: "kb-grid-wrap" }, tbl));
      wrap.append(h("div", { class: "kb-grid-actions" },
        h("button", { type: "button", class: "kb-btn kb-btn-small", onclick: () => { draft.grid.push(draft.columns.map(() => "")); draw(); } }, "+ Row"),
        h("button", { type: "button", class: "kb-btn kb-btn-small", onclick: () => { draft.columns.push(""); draft.grid.forEach((r) => r.push("")); draw(); } }, "+ Column"),
        h("label", { class: "kb-check", style: "margin-left:auto" },
          h("input", { type: "checkbox", checked: draft.showHeader, onchange: (ev) => { draft.showHeader = ev.target.checked; } }), "Show the header row")));
      wrap.append(h("div", { class: "kb-hint", text: "Click a cell, then use the toolbar: bold, colours, bullet and numbered lists, links, Tag / Badge pills (select text first) and pictures. You can also paste a screenshot straight into a cell." }));
      return wrap;
    }

    function commit() {
      draft.title = draft.title.trim();
      if (!draft.title) { toast("Give it a title first"); return; }
      if (addingCat) {
        const name = newCatName.trim();
        if (!name) { toast("Type a name for the new category"); return; }
        const existingCat = kb.cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (existingCat) draft.cat = existingCat.id;
        else { const id = "c" + uid(); kb.cats.push({ id, name }); draft.cat = id; }
      }
      if (draft.type === "text") {
        draft.html = sanitizeHtml(draft.html || "");
        draft.body = htmlToText(draft.html);
        if (!draft.body.trim() && !draft.images.length && !hasInlineImg(draft.html)) { toast("Add some content or an image first"); return; }
        delete draft.columns; delete draft.rows; delete draft.showHeader; delete draft.rowsHtml;
      } else {
        const rows = [], rowsHtml = [];
        let anyRich = false;
        draft.grid.forEach((r) => {
          const htmls = r.map((c) => sanitizeHtml(c));
          const texts = htmls.map((c) => htmlToText(c));
          if (!htmls.some((c, i) => texts[i].trim() || hasInlineImg(c))) return; // empty row
          rows.push(texts);
          rowsHtml.push(htmls.map((c) => { if (isRichCell(c)) { anyRich = true; return c; } return ""; }));
        });
        if (!rows.length && !draft.images.length) { toast("Add at least one row or an image"); return; }
        draft.rows = rows;
        if (anyRich) draft.rowsHtml = rowsHtml; else delete draft.rowsHtml;
        draft.columns = draft.columns.map((c) => c.trim()); // blank headers stay blank
        delete draft.body; delete draft.html;
      }
      delete draft.grid;
      const clean = sanitize({ cats: kb.cats, entries: [draft] }).entries[0];
      if (!clean) return;
      const idx = kb.entries.findIndex((x) => x.id === draft.id);
      if (idx >= 0) kb.entries[idx] = clean; else kb.entries.push(clean);
      if (view !== "all" && view !== "pinned" && view !== clean.cat) view = clean.cat; // follow the entry to its category
      expanded.add(clean.id);
      save(); close(); render(); toast("Saved");
    }

    draw();
    const first = root.querySelector("input");
    if (first) first.focus();
  }

  // ── Category manager ──────────────────────────────────────────────────
  function openCategories() {
    const root = h("div");
    const close = openModal("Categories", root, h("div", { class: "right" }, h("button", { type: "button", class: "kb-btn kb-btn-primary", onclick: () => { close(); render(); } }, "Done")));
    root.parentElement.parentElement.querySelector(".kb-modal-foot").style.justifyContent = "flex-end";

    function count(id) { return kb.entries.filter((e) => e.cat === id).length; }

    function draw() {
      root.textContent = "";
      root.append(h("div", { class: "kb-hint", style: "margin:0 0 10px", text: "Rename, reorder or delete categories. Deleting one moves its entries to General." }));
      kb.cats.forEach((c, i) => {
        const inp = h("input", { class: "kb-input", type: "text", value: c.name, maxlength: 40,
          onchange: () => { const v = inp.value.trim(); if (!v) { inp.value = c.name; return; } c.name = v; save(); } });
        root.append(h("div", { class: "kb-cat-row" },
          inp,
          h("span", { class: "kb-cat-count", text: count(c.id) + (count(c.id) === 1 ? " entry" : " entries") }),
          h("button", { type: "button", class: "kb-btn kb-btn-small", disabled: i === 0, title: "Move up", onclick: () => { kb.cats.splice(i - 1, 0, kb.cats.splice(i, 1)[0]); save(); draw(); } }, "▲"),
          h("button", { type: "button", class: "kb-btn kb-btn-small", disabled: i === kb.cats.length - 1, title: "Move down", onclick: () => { kb.cats.splice(i + 1, 0, kb.cats.splice(i, 1)[0]); save(); draw(); } }, "▼"),
          h("button", { type: "button", class: "kb-btn kb-btn-small kb-btn-danger", disabled: c.id === FALLBACK_CAT, title: c.id === FALLBACK_CAT ? "General is where orphaned entries go, so it stays" : "Delete this category",
            onclick: () => {
              const doDelete = () => {
                kb.entries.forEach((e) => { if (e.cat === c.id) e.cat = FALLBACK_CAT; });
                kb.cats = kb.cats.filter((x) => x.id !== c.id);
                if (view === c.id) view = "all";
                save(); draw();
              };
              if (count(c.id)) {
                // simple inline confirm: second click within the dialog
                confirmDialog("Delete category", "“" + c.name + "” has " + count(c.id) + " entries. They will move to General.", "Delete", () => { doDelete(); openCategories(); });
              } else doDelete();
            } }, "✕")));
      });
      const ni = h("input", { class: "kb-input", type: "text", maxlength: 40, placeholder: "New category name",
        onkeydown: (ev) => { if (ev.key === "Enter") addCat(); } });
      function addCat() {
        const v = ni.value.trim();
        if (!v) return;
        if (kb.cats.some((c) => c.name.toLowerCase() === v.toLowerCase())) { toast("That category already exists"); return; }
        const general = kb.cats.findIndex((c) => c.id === FALLBACK_CAT);
        kb.cats.splice(general < 0 ? kb.cats.length : general, 0, { id: "c" + uid(), name: v });
        save(); draw();
      }
      root.append(h("div", { class: "kb-cat-row", style: "margin-top:12px" }, ni, h("button", { type: "button", class: "kb-btn kb-btn-primary", onclick: addCat }, "Add")));
    }
    draw();
  }

  // ── Sync from templates ───────────────────────────────────────────────
  function syncFromTemplates() {
    readExtensionData((data) => {
      const changes = [];
      const n = seedFrom(kb, data, changes);
      if (n) { save(); render(); }
      if (changes.length) { openSyncChanges(changes, n); return; }
      if (n) toast("Added " + n + (n === 1 ? " new entry" : " new entries"));
      else toast("Already up to date");
    });
  }

  // Lists entries whose template / table was edited in TechNotes since they were imported,
  // so you choose which ones to refresh (infoHub-only edits are never overwritten silently).
  function openSyncChanges(changes, added) {
    const picks = changes.map((ch) => !hasFormatting(ch.entry)); // formatted entries start unticked
    const root = h("div");
    root.append(h("div", { class: "kb-hint", style: "margin:0 0 10px",
      text: (added ? "Added " + added + (added === 1 ? " new entry. " : " new entries. ") : "") +
        "These entries differ from their TechNotes template or table. Tick the ones to update from TechNotes; category, pin, tags and pictures are kept." }));
    const boxes = [];
    changes.forEach((ch, i) => {
      const cb = h("input", { type: "checkbox", checked: picks[i], onchange: () => { picks[i] = cb.checked; } });
      boxes.push(cb);
      const fmt = hasFormatting(ch.entry);
      root.append(h("label", { style: "display:flex;gap:8px;align-items:flex-start;padding:6px 0;cursor:pointer" },
        cb,
        h("span", {},
          h("strong", { text: ch.entry.title }),
          h("span", { class: "kb-hint", style: "display:block;margin-top:2px",
            text: "Changed: " + ch.why + " — infoHub has " + sizeLabel(ch.entry) + ", TechNotes has " + sizeLabel(ch.fresh) +
              (fmt ? ". This entry has formatting in infoHub that updating would remove." : "") }))));
    });
    const setAll = (v) => boxes.forEach((b, i) => { b.checked = v; picks[i] = v; });
    const close = openModal("Update from TechNotes", root, [
      h("div", {}, h("button", { type: "button", class: "kb-btn kb-btn-small", onclick: () => setAll(true) }, "Select all"),
        h("button", { type: "button", class: "kb-btn kb-btn-small", onclick: () => setAll(false) }, "None")),
      h("div", { class: "right" },
        h("button", { type: "button", class: "kb-btn", onclick: () => close() }, "Skip"),
        h("button", { type: "button", class: "kb-btn kb-btn-primary", onclick: () => {
          const chosen = changes.filter((_, i) => picks[i]);
          close();
          if (!chosen.length) { if (added) toast("Added " + added + (added === 1 ? " new entry" : " new entries")); return; }
          chosen.forEach(applyChange);
          save(); render();
          toast("Updated " + chosen.length + (chosen.length === 1 ? " entry" : " entries") + (added ? ", added " + added : ""));
        } }, "Update selected"))
    ], "wide");
  }

  // ── Theme (shared with the main window through localStorage) ──────────
  function currentTheme() { return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"; }
  function paintThemeBtn() {
    const light = currentTheme() === "light";
    $("kbThemeBtn").textContent = light ? "Dark" : "Light";
    $("kbThemeBtn").title = light ? "Switch to the dark theme" : "Switch to the light theme";
  }
  function setTheme(t, persist) {
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    if (persist) { try { localStorage.setItem("cnh_theme", t); } catch (e) { /* not fatal */ } }
    paintThemeBtn();
  }
  window.addEventListener("storage", (ev) => { if (ev.key === "cnh_theme") setTheme(ev.newValue === "light" ? "light" : "dark", false); });

  // ── Wiring ────────────────────────────────────────────────────────────
  $("kbAddBtn").addEventListener("click", () => openEditor(null));
  $("kbCatsBtn").addEventListener("click", openCategories);
  $("kbSyncBtn").addEventListener("click", syncFromTemplates);
  $("kbThemeBtn").addEventListener("click", () => setTheme(currentTheme() === "light" ? "dark" : "light", true));
  $("kbExpandAll").addEventListener("click", () => { visibleEntries().forEach((e) => expanded.add(e.id)); renderList(); });
  $("kbCollapseAll").addEventListener("click", () => { expanded.clear(); renderList(); });

  const searchEl = $("kbSearch");
  searchEl.addEventListener("input", () => {
    query = searchEl.value.trim().toLowerCase();
    $("kbSearchClear").classList.toggle("hidden", !searchEl.value);
    if (query) { const hits = visibleEntries(); if (hits.length <= 6) hits.forEach((e) => expanded.add(e.id)); }
    render();
  });
  $("kbSearchClear").addEventListener("click", () => { searchEl.value = ""; query = ""; $("kbSearchClear").classList.add("hidden"); render(); searchEl.focus(); });

  // Home = the plain "All entries" page: no search, every card collapsed, scrolled to the top.
  function goHome() {
    view = "all";
    query = "";
    tagFilter = "";
    searchEl.value = "";
    $("kbSearchClear").classList.add("hidden");
    expanded.clear();
    render();
    $("kbList").scrollTop = 0;
  }
  $("kbHomeBtn").addEventListener("click", () => { while (modalStack.length) closeModal(); goHome(); });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (modalStack.length) { closeModal(); return; }       // Esc closes a dialog / picture first
      goHome();                                               // otherwise Esc takes you back home
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      return;
    }
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (ev.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(tag) && !document.activeElement.isContentEditable && !modalStack.length) { ev.preventDefault(); searchEl.focus(); searchEl.select(); }
  });

  paintThemeBtn();
  load();
})();
