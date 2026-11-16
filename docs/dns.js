// ── DNS records field type ──────────────────────────────────────────────
// A placeholder of type "dns" is a small table of records: type, host, value
// and TTL. Rows can be typed, or filled in by pasting a zone file, dig output
// or a table copied from a DNS panel. A placeholder of type "dnsDiff" compares
// two of those tables (Old DNS / New DNS) and writes what changed.
//
// Values are stored per template as arrays: values[tplId][name] =
//   [{ type: "A", host: "@", value: "203.0.113.10", ttl: "3600" }, ...]

const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA", "PTR", "ALIAS", "SOA", "TLSA", "DS", "HTTPS", "SVCB"];
// Everything the paste parser recognises as a record type.
const DNS_TYPE_SET = new Set([...DNS_TYPES, "ANAME", "SPF", "DNSKEY", "NAPTR", "SSHFP", "URI"]);
const DNS_VALUE_HINTS = {
  A: "IPv4 address, e.g. 203.0.113.10",
  AAAA: "IPv6 address, e.g. 2001:db8::1",
  CNAME: "Target, e.g. target.example.com",
  MX: "Priority and mail server, e.g. 10 mail.example.com",
  TXT: "Text, e.g. v=spf1 include:_spf.example.com ~all",
  NS: "Name server, e.g. ns1.example.com",
  SRV: "Priority weight port target, e.g. 10 5 5060 sip.example.com",
  CAA: "Flag tag value, e.g. 0 issue \"letsencrypt.org\"",
  PTR: "Target hostname",
  ALIAS: "Target hostname"
};
// Types whose value starts with a number (so a leading number is not a host).
const DNS_NUMERIC_FIRST = new Set(["MX", "SRV", "CAA", "URI", "NAPTR", "SVCB", "HTTPS"]);
// 3600, 1h, 5m, "1 hour", Auto ...
const DNS_TTL_RE = /^(?:\d+\s*(?:s|m|h|d|w|sec|secs|second|seconds|min|mins|minute|minutes|hr|hrs|hour|hours|day|days|week|weeks)?|auto|automatic|default)$/i;

// ── Parsing pasted text ─────────────────────────────────────────────────
// Splits one line into tokens. A line with tabs is split on the tabs (that is
// what a table copied from a web page looks like) so values with spaces stay
// whole; otherwise on whitespace, keeping "quoted strings" together.
function dnsTokens(line) {
  if (line.indexOf("\t") !== -1) {
    return line.split("\t").map((t) => t.trim()).filter((t) => t !== "").map((t) => {
      // "A Record", "MX Records" (as some panels label them) -> A, MX
      const m = t.match(/^(.+?)\s+records?$/i);
      return { t: (m && DNS_TYPE_SET.has(m[1].toUpperCase())) ? m[1] : t, q: false };
    });
  }
  const out = [];
  const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[2] !== undefined) {
      if (m[2].charAt(0) === ";") break; // zone-file comment
      out.push({ t: m[2], q: false });
    } else {
      out.push({ t: m[1].replace(/\\(.)/g, "$1"), q: true });
    }
  }
  return out;
}

const dnsIsTtl = (tok) => !tok.q && DNS_TTL_RE.test(tok.t);
const dnsIsClass = (tok) => !tok.q && /^(IN|CH|HS)$/i.test(tok.t);

function normalizeDnsTtl(t) {
  const s = String(t || "").trim();
  if (/^(auto|automatic|default)$/i.test(s)) return "Auto";
  return s;
}

// One line -> { type, host, value, ttl } or null when it isn't a record.
// Understands both orders seen in the wild:
//   zone file / dig:  [host] [ttl] [IN] TYPE value...        e.g. "www 300 IN A 1.2.3.4"
//   panel / table:    TYPE host value... [ttl]                e.g. "A  @  1.2.3.4  3600"
function parseDnsLine(line) {
  const tabbed = line.indexOf("\t") !== -1;
  const toks = dnsTokens(line);
  if (toks.length < 2) return null;

  // Which token is the record type? Prefer one written in capitals so a host
  // named "mx" or "ns" in "mx CNAME mail.example.com" isn't taken for the type.
  const cands = [];
  toks.forEach((k, i) => { if (!k.q && DNS_TYPE_SET.has(k.t.toUpperCase())) cands.push(i); });
  if (!cands.length) return null;
  const ti = cands.find((i) => toks[i].t !== toks[i].t.toLowerCase()) ?? cands[0];
  const type = toks[ti].t.toUpperCase();
  const before = toks.slice(0, ti).filter((k) => !dnsIsClass(k));
  let after = toks.slice(ti + 1);
  let host = "", ttl = "";

  if (ti === 0) {
    // TYPE host value... [ttl]
    if (after.length >= 2 && dnsIsTtl(after[after.length - 1])) ttl = after.pop().t;
    const startsWithNumber = after.length && /^\d+$/.test(after[0].t) && !after[0].q;
    const hostGiven = after.length >= 2 && (tabbed || !(DNS_NUMERIC_FIRST.has(type) && startsWithNumber));
    if (hostGiven) host = after.shift().t;
  } else {
    // [host] [ttl] [class] TYPE value...
    before.forEach((k) => {
      if (!ttl && dnsIsTtl(k)) ttl = k.t;
      else if (!host) host = k.t;
    });
    if (!ttl && after.length >= 2 && dnsIsTtl(after[after.length - 1])) ttl = after.pop().t;
  }

  if (!after.length) return null;
  const quotedTxt = (type === "TXT" || type === "SPF") && after.every((k) => k.q);
  const isTxt = type === "TXT" || type === "SPF";
  // TXT chunks are joined into one string; for other types (CAA, ...) quotes are part of the value.
  let value = after.map((k) => (k.q && !isTxt) ? `"${k.t}"` : k.t).join(quotedTxt ? "" : " ").trim();
  if ((type === "TXT" || type === "SPF") && /^".*"$/.test(value)) value = value.slice(1, -1);
  if (!value) return null;
  return { type, host: host || "@", value, ttl: normalizeDnsTtl(ttl) };
}

// Whole pasted block -> { rows, skipped }. Blank lines, comments, $TTL / $ORIGIN
// and a header row ("Type  Host  Value  TTL") are ignored quietly; any other
// line that can't be read as a record counts as skipped.
function parseDnsText(text) {
  const rows = [];
  let skipped = 0;
  String(text || "").split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line || /^[;#]/.test(line) || /^\$/.test(line)) return;
    if (/^(type|host|name|record|value|data|content)\b/i.test(line) && /\b(value|data|content|points to|ttl|priority)\b/i.test(line) && !parseDnsLine(line)) return;
    const row = parseDnsLine(raw.replace(/\s+$/, ""));
    if (row) rows.push(row); else skipped++;
  });
  return { rows, skipped };
}

// ── Rows ────────────────────────────────────────────────────────────────
function dnsRows(val) {
  return (Array.isArray(val) ? val : [])
    .filter((r) => r && typeof r === "object")
    .map((r) => ({ type: String(r.type || "A").toUpperCase(), host: String(r.host || ""), value: String(r.value || ""), ttl: String(r.ttl || "") }));
}
// Rows that have a value; half-filled rows are left out of the note.
function dnsCompleteRows(val) { return dnsRows(val).filter((r) => r.value.trim()); }

function dnsRowText(r) {
  return `${r.type} ${(r.host || "").trim() || "@"} ${r.value.trim()}` + (r.ttl.trim() ? ` (TTL ${r.ttl.trim()})` : "");
}

// The saved value of a field looked up by lowercase placeholder name.
function valueForField(tplId, keyLower) {
  const bag = (values && values[tplId]) || {};
  const k = Object.keys(bag).find((x) => x.toLowerCase() === String(keyLower || "").toLowerCase());
  return k === undefined ? undefined : bag[k];
}

// ── Comparing old and new ───────────────────────────────────────────────
function dnsNormHost(h) { return (String(h || "").trim().toLowerCase().replace(/\.$/, "")) || "@"; }
function dnsNormValue(type, v) {
  const s = String(v || "").trim();
  if (type === "TXT" || type === "SPF") return s.replace(/"\s+"/g, "").replace(/^"|"$/g, "").replace(/\s+/g, " ");
  return s.replace(/\s+/g, " ").replace(/\.$/, "").toLowerCase();
}
function dnsTtlSeconds(t) {
  const s = String(t || "").trim().toLowerCase();
  if (!s || s === "auto") return null;
  const m = s.match(/^(\d+)\s*([a-z]*)$/);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2];
  if (!u || u.startsWith("s")) return n;
  if (u.startsWith("m")) return n * 60;
  if (u.startsWith("h")) return n * 3600;
  if (u.startsWith("d")) return n * 86400;
  if (u.startsWith("w")) return n * 604800;
  return null;
}
const dnsHostLabel = (r) => (r.host || "").trim() || "@";

// Compares two lists of records. Records are matched by type + host; within
// one of those, an identical value is "unchanged" (or "TTL changed"), and
// leftovers are paired up as "changed" before being called added / removed.
// Returns the lines to show, as { kind, label, text }.
function dnsDiffLines(oldRows, newRows) {
  const key = (r) => r.type + "|" + dnsNormHost(r.host);
  const order = [];
  const groups = {};
  const put = (r, side) => {
    const k = key(r);
    if (!groups[k]) { groups[k] = { old: [], neu: [] }; order.push(k); }
    groups[k][side].push(r);
  };
  oldRows.forEach((r) => put(r, "old"));
  newRows.forEach((r) => put(r, "neu"));

  const changed = [], added = [], removed = [], ttl = [];
  let same = 0;
  order.forEach((k) => {
    const o = groups[k].old.slice();
    const n = groups[k].neu.slice();
    for (let i = 0; i < o.length; ) {
      const j = n.findIndex((x) => dnsNormValue(x.type, x.value) === dnsNormValue(o[i].type, o[i].value));
      if (j < 0) { i++; continue; }
      const a = dnsTtlSeconds(o[i].ttl), b = dnsTtlSeconds(n[j].ttl);
      if (a !== null && b !== null && a !== b) ttl.push({ from: o[i], to: n[j] }); else same++;
      o.splice(i, 1);
      n.splice(j, 1);
    }
    while (o.length && n.length) changed.push({ from: o.shift(), to: n.shift() });
    removed.push(...o);
    added.push(...n);
  });

  const out = [];
  changed.forEach(({ from, to }) => {
    const a = dnsTtlSeconds(from.ttl), b = dnsTtlSeconds(to.ttl);
    const t = (a !== null && b !== null && a !== b) ? ` (TTL ${from.ttl.trim()} -> ${to.ttl.trim()})` : "";
    out.push({ kind: "changed", label: "Changed", text: `${from.type} ${dnsHostLabel(from)} ${from.value.trim()} -> ${to.value.trim()}${t}` });
  });
  added.forEach((r) => out.push({ kind: "added", label: "Added", text: dnsRowText(r) }));
  removed.forEach((r) => out.push({ kind: "removed", label: "Removed", text: dnsRowText(r) }));
  ttl.forEach(({ from, to }) => out.push({ kind: "ttl", label: "TTL changed", text: `${from.type} ${dnsHostLabel(from)} ${from.ttl.trim()} -> ${to.ttl.trim()}` }));
  if (!out.length) {
    if (!same) return [];
    return [{ kind: "none", label: "", text: `No changes (${same} record${same === 1 ? "" : "s"})` }];
  }
  if (same) out.push({ kind: "same", label: "Unchanged", text: `${same} record${same === 1 ? "" : "s"}` });
  return out;
}

// ── What goes into the note ─────────────────────────────────────────────
// "Detailed" layout: one block per record, a blank line between blocks:
//   type A record:
//   host: order.example.com
//   value: 192.168.1.1
function dnsRowDetailed(r) {
  const lines = [`type ${r.type} record:`, `host: ${(r.host || "").trim() || "@"}`, `value: ${r.value.trim()}`];
  if (r.ttl.trim()) lines.push(`ttl: ${r.ttl.trim()}`);
  return lines.join("\n");
}
function dnsFieldOutput(tplId, name, cfg) {
  const rows = dnsCompleteRows(values[tplId] && values[tplId][name]);
  if (!rows.length) return "";
  // The trailing break leaves a blank line before whatever follows it.
  if (cfg.layout === "detailed") return "\n" + rows.map(dnsRowDetailed).join("\n\n") + "\n";
  const prefix = cfg.itemPrefix !== undefined ? cfg.itemPrefix : "- ";
  return "\n" + rows.map((r) => prefix + dnsRowText(r)).join("\n");
}
function dnsDiffFor(tplId, cfg) {
  return dnsDiffLines(dnsCompleteRows(valueForField(tplId, cfg.oldField)), dnsCompleteRows(valueForField(tplId, cfg.newField)));
}
function dnsDiffOutput(tplId, cfg) {
  const lines = dnsDiffFor(tplId, cfg);
  if (!lines.length) return "";
  const prefix = cfg.itemPrefix !== undefined ? cfg.itemPrefix : "- ";
  return "\n" + lines.map((l) => prefix + (l.label ? l.label + ": " : "") + l.text).join("\n");
}

// ── Fill-in form ────────────────────────────────────────────────────────
let dnsPasteOpenField = null; // name of the dns field whose paste box is open, if any

function dnsRowHTML(r, i) {
  const types = DNS_TYPES.includes(r.type) ? DNS_TYPES : DNS_TYPES.concat([r.type]);
  const opts = types.map((t) => `<option value="${escAttr(t)}"${t === r.type ? " selected" : ""}>${escHtml(t)}</option>`).join("");
  return `<div class="dns-row" data-dns-row="${i}">
    <select data-dns-key="type" aria-label="Record type">${opts}</select>
    <input type="text" data-dns-key="host" value="${escAttr(r.host)}" placeholder="Host (@, www)" aria-label="Host">
    <input type="text" data-dns-key="ttl" value="${escAttr(r.ttl)}" placeholder="TTL" aria-label="TTL">
    <button type="button" class="ref-remove-btn" data-dns-remove="${i}" title="Remove this record" aria-label="Remove this record">\u2715</button>
    <input type="text" class="dns-value" data-dns-key="value" value="${escAttr(r.value)}" placeholder="${escAttr(DNS_VALUE_HINTS[r.type] || "Value")}" aria-label="Value">
  </div>`;
}

function renderDnsFieldHTML(name, cfg, val) {
  const rows = dnsRows(val);
  const open = dnsPasteOpenField === name;
  const pasteHTML = open ? `<div class="dns-paste">
      <textarea class="dns-paste-text" rows="4" spellcheck="false" placeholder="Paste records here: zone-file lines, dig output, or a table copied from your DNS panel (Type, Host, Value, TTL)"></textarea>
      <div class="set-hint dns-paste-info"></div>
      <div class="dns-paste-actions">
        <button type="button" class="btn btn-primary" data-dns-paste-add>Add records</button>
        <button type="button" class="btn" data-dns-paste-replace title="Throw away the rows below and use only the pasted ones">Replace all</button>
      </div>
    </div>` : "";
  return `<div class="field dns-field" data-dns="${escAttr(name)}">
    <div class="field-label-row"><label>${escHtml(labelForField(name))}</label>
      <button type="button" class="manage-options-toggle-btn" data-dns-paste-toggle>${open ? "Done" : "Paste records"}</button></div>
    ${pasteHTML}
    <div class="dns-rows">${rows.map(dnsRowHTML).join("") || '<div class="edit-hint dns-empty">No records yet. Paste some, or add them one by one.</div>'}</div>
    <button type="button" class="btn dns-add-btn" data-dns-add>+ Add record</button>
  </div>`;
}

function dnsDiffPanelInner(cfg) {
  const lines = dnsDiffFor(activeTpl, cfg);
  if (!lines.length) return '<div class="set-hint" style="margin:0">Fill in the old and new records above to see what changed.</div>';
  return lines.map((l) => `<div class="dns-diff-line dns-diff-${l.kind}">${l.label ? `<span class="dns-diff-tag">${escHtml(l.label)}</span>` : ""}${escHtml(l.text)}</div>`).join("");
}
function renderDnsDiffHTML(name, cfg) {
  return `<div class="field dns-diff-field" data-dns-diff="${escAttr(name)}">
    <label>${escHtml(labelForField(name))} <span class="auto-badge">Auto</span></label>
    <div class="dns-diff-box">${dnsDiffPanelInner(cfg || {})}</div>
  </div>`;
}
function refreshDnsDiffPanels() {
  document.querySelectorAll("#fields [data-dns-diff]").forEach((el) => {
    const box = el.querySelector(".dns-diff-box");
    if (box) box.innerHTML = dnsDiffPanelInner(getFieldConfig(el.dataset.dnsDiff) || {});
  });
}

function dnsArrayFor(name) {
  const bag = values[activeTpl] || (values[activeTpl] = {});
  if (!Array.isArray(bag[name])) bag[name] = [];
  return bag[name];
}
// A row nobody has filled in yet (added by mistake, or left over) is not worth keeping.
const dnsRowIsBlank = (r) => !String(r.value || "").trim() && !String(r.host || "").trim() && !String(r.ttl || "").trim();

function wireDnsFields(container) {
  const changed = () => { saveValuesDebounced(); renderPreview(); refreshDnsDiffPanels(); };
  const focusIn = (name, sel) => {
    const box = [...container.querySelectorAll("[data-dns]")].find((el) => el.dataset.dns === name);
    const target = box && box.querySelector(sel);
    if (target) target.focus();
  };

  container.querySelectorAll("[data-dns]").forEach((box) => {
    const name = box.dataset.dns;

    box.querySelector("[data-dns-paste-toggle]").addEventListener("click", () => {
      dnsPasteOpenField = dnsPasteOpenField === name ? null : name;
      renderFields();
      if (dnsPasteOpenField === name) focusIn(name, ".dns-paste-text");
    });

    box.querySelector("[data-dns-add]").addEventListener("click", () => {
      dnsArrayFor(name).push({ type: "A", host: "", value: "", ttl: "" });
      saveValuesDebounced();
      renderFields();
      focusIn(name, ".dns-row:last-of-type input");
    });

    box.querySelectorAll("[data-dns-row]").forEach((rowEl) => {
      const i = Number(rowEl.dataset.dnsRow);
      rowEl.querySelectorAll("[data-dns-key]").forEach((el) => {
        const onEdit = () => {
          const arr = dnsArrayFor(name);
          if (!arr[i]) return;
          arr[i][el.dataset.dnsKey] = el.value;
          if (el.dataset.dnsKey === "type") {
            const v = rowEl.querySelector(".dns-value");
            if (v) v.placeholder = DNS_VALUE_HINTS[el.value] || "Value";
          }
          changed();
        };
        el.addEventListener("input", onEdit);
        el.addEventListener("change", onEdit);
      });
      rowEl.querySelector("[data-dns-remove]").addEventListener("click", () => {
        dnsArrayFor(name).splice(i, 1);
        changed();
        renderFields();
      });
    });

    const ta = box.querySelector(".dns-paste-text");
    if (ta) {
      const info = box.querySelector(".dns-paste-info");
      ta.addEventListener("input", () => {
        if (!ta.value.trim()) { info.textContent = ""; return; }
        const { rows, skipped } = parseDnsText(ta.value);
        info.textContent = `Found ${rows.length} record${rows.length === 1 ? "" : "s"}` + (skipped ? ` \u00B7 ${skipped} line${skipped === 1 ? "" : "s"} couldn't be read and will be skipped` : "") + ".";
      });
      const commit = (replace) => {
        const { rows } = parseDnsText(ta.value);
        if (!rows.length) { showToast("No records found in that text"); return; }
        const arr = replace ? [] : dnsArrayFor(name).filter((r) => !dnsRowIsBlank(r));
        values[activeTpl][name] = arr.concat(rows);
        dnsPasteOpenField = null;
        changed();
        renderFields();
        showToast(`${rows.length} record${rows.length === 1 ? "" : "s"} added`);
      };
      box.querySelector("[data-dns-paste-add]").addEventListener("click", () => commit(false));
      box.querySelector("[data-dns-paste-replace]").addEventListener("click", () => commit(true));
    }
  });
}
