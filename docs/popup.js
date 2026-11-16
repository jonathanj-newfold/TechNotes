// ── Default templates ───────────────────────────────────────────────────
const DEFAULT_TEMPLATES = {
  cancellation:
`Case ID: {caseId}
Customer: {customerName}
Product/Service: {product}
Reason for cancellation: {reason}
Retention offer made: {retentionOffer}
Outcome: {outcome}
Notes: {notes}`,

  generalHelp:
`Case ID: {caseId}
Customer: {customerName}
Issue: {issue}
Troubleshooting steps taken: {steps}
Resolution: {resolution}
Status: {status}`,

  changeRequest:
`Case ID: {caseId}
Customer: {customerName}
Change requested: {changeRequest}
Verification method: {verification}
Change completed: {completed}
Notes: {notes}`,

  caseNote:
`I-{caseId}
Customer ID/Domain: {customerDomain}
Name: {customerName}
Issue: {issue}
Additional details: {issueDetails}
Troubleshooting steps performed:{troubleshootingSteps}
Action/Resolution: {resolution}
Old DNS:{oldDns}
New DNS:{newDns}
DNS changes:{dnsChanges}`
};

// Earlier wordings of built-in templates. A stored copy that still matches one
// of these was never really edited (older versions saved every built-in), so
// it is dropped on load and the tab follows the current default again.
const LEGACY_DEFAULT_TEMPLATES = {
  caseNote: [
`I-{caseId}
Customer ID/Domain: {customerDomain}
Name: {customerName}
Issue: {issue}
Additional details: {issueDetails}
Troubleshooting steps performed:{troubleshootingSteps}
Action/Resolution: {resolution}
Old DNS: {oldDns}
New DNS: {newDns}`
  ]
};

const TAB_LABELS = { cancellation: "Cancellation", generalHelp: "General Help", changeRequest: "Change Request", caseNote: "Case Note" };
const DEFAULT_TAB_ORDER = ["cancellation", "generalHelp", "changeRequest", "caseNote"];

// ── Placeholder (field) configuration ───────────────────────────────────
// Every placeholder's behaviour lives in one config object now, and all of
// it is editable from the Settings screen (see settings.js). The built-ins
// below are just the starting point — user edits are stored in
// `fieldConfigs` and merged over these, per placeholder name (lowercased).
//
//   label   — what the fill-in form calls the field
//   type    — text | textarea | select | toggle | prefixToggle | auto
//   options — select: { text } | toggle: { id, label, text }
//             prefixToggle: { id, label, prefix, hint }
//   multiToggle — options: { id, label, prefix, hint }. Any number of buttons can be switched
//             on at once; each one on gets its own text box, stacked under the buttons, and
//             goes into the note as its own line: <lineStart><prefix><typed text>
//             (lineStart defaults to "- "). A button that's on but left empty adds no line.
//             Saved as values[tpl][name] = { optionId: "typed text" } (a key = button is on).
//   image   — type "image": screenshots pasted / dropped / chosen on the form. Saved in values as
//             an array of small JPEG data URLs. In the preview each shows as [Image: ...]; Copy
//             puts the text AND the pictures on the clipboard (rich text) so they paste into
//             Teams in place. A line whose only placeholder is an image is left out when empty.
//   leadIn  — text/textarea/select/prefixToggle: wording added in front of the value in the
//             note, only when the field is showing and filled (e.g. ". ABN: ")
//   inlineManage — select only: show a "Manage list" link in the fill view
//   dependsOn / rules / fallback — auto only: value computed from the
//             current choice of one or more toggle fields
//   clean   — text | prefixToggle: "domain" tidies a pasted URL/host on its
//             way into the note (drops https://, www., paths and trailing
//             slashes, lowercases). Customer IDs and other text are left alone.
//             text only: "caseId" makes a numeric case ID always come out as
//             I-<digits>, whether it was typed as digits, "I-123", "#123"...
//             text only: "email" trims, drops mailto: / <angle brackets> and
//             lowercases. An unconfigured placeholder with "email" in its name
//             gets this too.
//   dns     — type "dns": a small table of DNS records (type / host / value / TTL)
//             with paste-parse. Each record goes into the note on its own line.
//   dnsDiff — type "dnsDiff": no input; compares two dns fields (`oldField` and
//             `newField`) and writes what was added, removed or changed.
//   warn    — false turns off the soft "this looks wrong" hints shown under a
//             text field (any other value = on). The hints themselves are the
//             rules in `softWarnings` (see "Soft warnings" below).
const DEFAULT_FIELD_CONFIGS = {
  status: {
    label: "Status", type: "select",
    options: [{ text: "Resolved" }, { text: "Escalated" }, { text: "Follow-up needed" }]
  },
  outcome: {
    label: "Outcome", type: "select",
    options: [{ text: "Cancelled" }, { text: "Retained" }]
  },
  completed: {
    label: "Completed", type: "select",
    options: [{ text: "Yes" }, { text: "No" }]
  },
  department: {
    label: "Department", type: "select", inlineManage: true,
    options: [{ text: "Domains Team" }, { text: "Provisioning Team" }, { text: "Orders Team" }]
  },
  server: {
    label: "Address type", type: "prefixToggle", clean: "domain",
    options: [
      { id: "server", label: "Server name", prefix: "", hint: "cp-wc02.iad01.ds.network" },
      { id: "domain", label: "mail.domain", prefix: "mail.", hint: "customerdomain.com" }
    ]
  },
  protocol: {
    label: "Protocol", type: "toggle",
    options: [
      { id: "imap", label: "IMAP", text: "IMAP" },
      { id: "pop3", label: "POP3", text: "POP3" }
    ]
  },
  security: {
    label: "Security Type", type: "toggle",
    options: [
      { id: "ssl", label: "SSL", text: "SSL" },
      { id: "nonssl", label: "Non-SSL", text: "Non-SSL" }
    ]
  },
  incomingport: {
    label: "Incoming Port", type: "auto",
    dependsOn: ["protocol", "security"],
    rules: [
      { when: { protocol: "imap", security: "ssl" }, value: "993" },
      { when: { protocol: "imap", security: "nonssl" }, value: "143" },
      { when: { protocol: "pop3", security: "ssl" }, value: "995" },
      { when: { protocol: "pop3", security: "nonssl" }, value: "110" }
    ],
    fallback: ""
  },
  outgoingport: {
    label: "Outgoing Port", type: "auto",
    dependsOn: ["security"],
    rules: [
      { when: { security: "ssl" }, value: "465" },
      { when: { security: "nonssl" }, value: "587" }
    ],
    fallback: ""
  },
  caseid: {
    label: "Case ID", type: "text", placeholder: "26838210", clean: "caseId"
  },
  customerdomain: {
    label: "Customer ID/Domain", type: "text", clean: "domain"
  },
  // Quick-pick issue phrasing. Same field is used by General Help too, so
  // building this list out helps both templates. "Manage list" (inlineManage)
  // lets new phrasing get added straight from the fill-in form as it comes up.
  // `grouped` = pick a category first, then the specific issue within it.
  // Only the issue text goes into the note; the category is just a filter.
  issue: {
    label: "Issue", type: "select", inlineManage: true, grouped: true, manualBox: true,
    options: [
      { group: "Email issue", text: "Email not working \u2013 cannot send" },
      { group: "Email issue", text: "Email not working \u2013 cannot receive" },
      { group: "Email issue", text: "Email not working \u2013 cannot send or receive" },
      { group: "Website issue", text: "Website not working" },
      { group: "Website issue", text: "Website showing an error" },
      { group: "Domain issue", text: "DNS not resolving / propagation delay" },
      { group: "Domain issue", text: "Domain expired / not renewing" },
      { group: "Account Manager issue", text: "Cannot log in to Account Manager" },
      { group: "Account Manager issue", text: "Account Manager not showing correct information" }
    ]
  },
  // Optional: free-form specifics (exact error text, extra context) that
  // don't fit the canned {issue} phrasing. Line disappears from the note
  // when left blank instead of showing "_____".
  issuedetails: {
    label: "Additional details", type: "textarea", optional: true
  },
  // DNS records as rows of type / host / value / TTL. Paste a zone file, dig
  // output or a table copied from a DNS panel to fill them in. Optional, so the
  // lines vanish from the note on any case that isn't a DNS update.
  olddns: {
    label: "Old DNS", type: "dns", optional: true
  },
  newdns: {
    label: "New DNS", type: "dns", optional: true
  },
  // Old-vs-new summary of the two fields above (added / removed / changed).
  dnschanges: {
    label: "DNS changes", type: "dnsDiff", optional: true,
    oldField: "olddns", newField: "newdns"
  },
  // Multi-select: pre-add the steps you commonly run, then just tick off
  // the ones you actually did on this case. Optional, so it drops out of
  // the note (label line and all) when nothing's ticked.
  // `filterBy` names a grouped dropdown ({issue}); only the items whose
  // `group` matches the category picked there are shown. `group` is an array
  // of category names (so a name may contain commas), and an item with no
  // group shows for every category.
  troubleshootingsteps: {
    label: "Troubleshooting steps performed", type: "multiselect", inlineManage: true, optional: true,
    filterBy: "issue",
    options: [
      { text: "Verified DNS propagation", group: ["Domain issue", "Website issue", "Email issue"] },
      { text: "Flushed local DNS cache", group: ["Domain issue", "Website issue"] },
      { text: "Checked mail server connectivity", group: ["Email issue"] },
      { text: "Verified SPF/DKIM/DMARC records", group: ["Email issue"] },
      { text: "Restarted mail service", group: ["Email issue"] },
      { text: "Checked SSL certificate validity", group: ["Website issue"] },
      { text: "Cleared browser cache/cookies", group: ["Website issue", "Account Manager issue"] },
      { text: "Tested in incognito/private window", group: ["Website issue", "Account Manager issue"] },
      { text: "Checked hosting/server status", group: ["Website issue"] },
      { text: "Escalated to Tier 2" }
    ]
  }
};

const FIELD_TYPE_LABELS = {
  text: "Single-line text",
  textarea: "Long text box",
  select: "Dropdown",
  multiselect: "Multi-select checklist",
  toggle: "Toggle buttons",
  prefixToggle: "Toggle + text (prefix)",
  multiToggle: "Toggle + text (select multiple)",
  date: "Date picker",
  datetime: "Date and time stamp",
  number: "Number with a unit",
  yesno: "Yes / no line (tick box)",
  counter: "Counter (+ / \u2212)",
  snippet: "Canned snippet (pick a saved block of text)",
  image: "Image (paste a screenshot)",
  auto: "Auto (calculated)",
  dns: "DNS records (type / host / value / TTL)",
  dnsDiff: "DNS change summary (old vs new)"
};

// "Toggle buttons (none selected by default)" is its own entry in the Settings type picker.
// It is stored as a toggle with noDefault: true, so every toggle code path keeps working.
const TOGGLE_NONE_TYPE = "toggleNone";
const TOGGLE_NONE_LABEL = "Toggle buttons (none selected by default)";
function pickerTypeOf(cfgLike) {
  return (cfgLike && cfgLike.type === "toggle" && cfgLike.noDefault) ? TOGGLE_NONE_TYPE : (cfgLike && cfgLike.type) || "";
}

// Substrings that mark an UNCONFIGURED placeholder as "long text" ->
// textarea instead of a single-line input. A config always wins over this.
const TEXTAREA_KEYWORDS = ["notes", "reason", "summary", "steps", "issue", "resolution", "request", "verification", "description", "offer"];

function cloneCfg(cfg) { return JSON.parse(JSON.stringify(cfg)); }

// Config for a placeholder: user override first, then built-in, then null
// (null = plain text / textarea by keyword).
function getFieldConfig(name) {
  const key = String(name).toLowerCase();
  return fieldConfigs[key] || DEFAULT_FIELD_CONFIGS[key] || null;
}
function hasDefaultConfig(name) { return !!DEFAULT_FIELD_CONFIGS[String(name).toLowerCase()]; }
function saveFieldConfigs() { chrome.storage.local.set({ cnh_fieldConfigs: fieldConfigs }); }
function saveDeletedFields() { chrome.storage.local.set({ cnh_deletedFields: deletedFields }); }

// Every placeholder name that currently has a config, plus every one used
// by any template — this is what the Settings list shows. A built-in you've
// deleted stays out of the list unless a template uses it again.
function allKnownFields() {
  const out = [];
  const seen = new Set();
  const add = (n) => { const k = n.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(k); } };
  const used = new Set();
  Object.keys(templates).forEach((tplId) => getPlaceholders(templates[tplId] || "").forEach((p) => used.add(p.toLowerCase())));
  Object.keys(DEFAULT_FIELD_CONFIGS).forEach((k) => { if (!deletedFields.includes(k) || used.has(k)) add(k); });
  Object.keys(fieldConfigs).forEach(add);
  used.forEach(add);
  return out.sort();
}
function templatesUsingField(name) {
  const key = name.toLowerCase();
  return tabOrder.filter((id) =>
    tabType(id) === "template" &&
    getPlaceholders(templates[id] || "").some((p) => p.toLowerCase() === key)
  ).map(labelForTpl);
}

// Option ids are only meaningful for toggle / prefixToggle fields (they're
// what gets saved as the picked mode, and what `auto` rules match on).
function optionId(opt, i) { return opt.id || slugifyOptionId(opt.label || opt.text || `opt${i + 1}`); }
function slugifyOptionId(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "") || "opt";
}
function normalizeOptions(cfg) {
  (cfg.options || []).forEach((o, i) => { if (!o.id) o.id = optionId(o, i); });
  return cfg.options || [];
}

// Current picked option-id for every toggle-type field, e.g.
// { protocol: "imap", security: "ssl" } — what `auto` rules are matched against.
function getModeByGroup(tplId) {
  const modes = {};
  allKnownFields().forEach((key) => {
    const cfg = getFieldConfig(key);
    if (cfg && cfg.type === "toggle") {
      modes[key] = getFieldMode(tplId, key, normalizeOptions(cfg));
    }
  });
  return modes;
}

function computeAutoValue(tplId, cfg) {
  const modes = getModeByGroup(tplId);
  const hit = (cfg.rules || []).find((r) =>
    Object.keys(r.when || {}).every((f) => modes[f.toLowerCase()] === r.when[f])
  );
  return hit ? hit.value : (cfg.fallback || "");
}

// ── State ───────────────────────────────────────────────────────────────
let templates = { ...DEFAULT_TEMPLATES };
let values = {};          // { [tplId]: { [field]: string } } — raw typed value per field
let fieldModes = {};      // { [tplId]: { [field]: optionId } } — picked option for toggle/prefixToggle fields
let tabOrder = [...DEFAULT_TAB_ORDER];
let customLabels = {};    // { [tplId]: "Display Name" } for non-default tabs
let tabTypes = {};        // { [tplId]: "template" | "reference" } — absent = "template"
let referenceTables = {}; // { [tplId]: { columns: [string], rows: [[string]] } }
let deletedFields = [];  // built-in placeholder names the user deleted, so they stop being listed in Settings
let fieldConfigs = {};    // { [fieldNameLower]: config } — user overrides of DEFAULT_FIELD_CONFIGS (Settings screen)
let softWarnings = null;  // null = the built-in soft warnings; otherwise the user's own list (Settings screen)
let activeTpl = "cancellation";
let editSnapshot = "";      // what the template/table editor looked like when it opened, to spot unsaved changes
let isEditing = false;
let newTplType = "template"; // which type is selected in the add-tab row
let refEditState = null;     // working copy while editing a reference table
let manageOptionsOpenField = null; // name of the managed-select field whose "Manage list" panel is open, if any
let reorderMode = false;   // true while the tab tiles are draggable for rearranging
let draggedTabId = null;   // id of the tab currently mid-drag in reorder mode
let lastDragOverId = null; // id last swapped-into during a drag, to avoid re-triggering every pixel of movement
let tabOrderSnapshot = null; // tabOrder as it was before entering reorder mode, for Cancel

const $ = (id) => document.getElementById(id);

function isDefaultTpl(id) { return DEFAULT_TAB_ORDER.includes(id); }
function labelForTpl(id) { return customLabels[id] || (isDefaultTpl(id) ? TAB_LABELS[id] : id); }
function tabType(id) { return tabTypes[id] === "reference" ? "reference" : "template"; }

function slugify(name) {
  let base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!base) base = "template";
  let id = base;
  let n = 2;
  while (tabOrder.includes(id) || DEFAULT_TAB_ORDER.includes(id)) { id = `${base}_${n}`; n++; }
  return id;
}

function fieldType(name) {
  const cfg = getFieldConfig(name);
  if (cfg && FIELD_TYPE_LABELS[cfg.type]) return cfg.type;
  return TEXTAREA_KEYWORDS.some((kw) => name.toLowerCase().includes(kw)) ? "textarea" : "text";
}

// The fill-in form's label for a placeholder: the configured label if it
// has one, otherwise the prettified placeholder name.
function labelForField(name) {
  const cfg = getFieldConfig(name);
  return (cfg && cfg.label) ? cfg.label : labelFor(name);
}

// ── Dropdown option lists ──────────────────────────────────────────────
// Options now live in the field's config, so Settings and the inline
// "Manage list" panel are editing the same one list.
function getManagedOptions(name) {
  const cfg = getFieldConfig(name);
  if (!cfg || (cfg.type !== "select" && cfg.type !== "multiselect")) return [];
  return (cfg.options || []).map((o) => o.text);
}
// ── List order (v1.19.1) ───────────────────────────────────────────────
// A dropdown/checklist can keep its options in order by itself (cfg.listOrder):
//   "numdesc" — highest number first, so the newest item is on top (e.g. VOC-16374
//               above VOC-16326). Uses the first number in each option's text;
//               options with no number stay below, in their current order. Exact
//               duplicates (ignoring case) are dropped.
//   "newtop"  — a newly added option goes to the top instead of the bottom.
//   ""        — manual (new options go to the bottom, as before).
function optionNumber(text) {
  const m = String(text || "").match(/\d+/);
  return m ? Number(m[0]) : null;
}
function applyListOrder(cfg) {
  if (!cfg || cfg.listOrder !== "numdesc" || !Array.isArray(cfg.options)) return false;
  const before = JSON.stringify(cfg.options);
  const seen = new Set();
  const uniq = cfg.options.filter((o) => {
    const k = String(o && o.text || "").trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k); return true;
  });
  const idx = new Map(uniq.map((o, i) => [o, i]));
  uniq.sort((a, b) => {
    const na = optionNumber(a.text), nb = optionNumber(b.text);
    if (na !== null && nb !== null && na !== nb) return nb - na;
    if (na !== null && nb === null) return -1;
    if (na === null && nb !== null) return 1;
    return idx.get(a) - idx.get(b);
  });
  cfg.options = uniq;
  return JSON.stringify(cfg.options) !== before;
}
function migrateListOrder() {
  let changed = false;
  Object.keys(fieldConfigs).forEach((k) => { if (applyListOrder(fieldConfigs[k])) changed = true; });
  if (changed) saveFieldConfigs();
}

// Writes a list back, creating a user override of a built-in field the
// first time that field is edited.
// `newGroups` (optional) maps a brand-new option's text to its category, for
// grouped dropdowns. Existing options keep whatever category they had.
function setManagedOptions(name, list, newGroups) {
  const key = name.toLowerCase();
  takeSnapshot(`Before editing the {${key}} list`);
  const cfg = fieldConfigs[key] || (fieldConfigs[key] = cloneCfg(getFieldConfig(key) || { label: labelFor(key), type: "select", options: [] }));
  const oldGroups = new Map();
  (cfg.options || []).forEach((o) => { if (hasGroup(o.group)) oldGroups.set(o.text, o.group); });
  cfg.options = list.map((t) => {
    const g = oldGroups.get(t) || (newGroups && newGroups[t]);
    return hasGroup(g) ? { text: t, group: g } : { text: t };
  });
  applyListOrder(cfg);
  saveFieldConfigs();
}

// ── Grouped dropdowns (category first, then the specific option) ───────
// A select with `grouped: true` stores a `group` on each option. The form
// shows a Category dropdown that filters the second dropdown; only the
// option's own text ever lands in the note.
const DEFAULT_GROUP_NAME = "Other";
function isGroupedField(name) {
  const cfg = getFieldConfig(name);
  return !!(cfg && cfg.type === "select" && cfg.grouped);
}
// [{ group, items: [{ text, index }] }] in first-seen order; `index` is the
// option's position in the flat list (what the Manage panel deletes by).
function getOptionGroups(name) {
  const cfg = getFieldConfig(name);
  const groups = [];
  ((cfg && cfg.options) || []).forEach((o, index) => {
    const g = singleGroup(o.group) || DEFAULT_GROUP_NAME;
    let entry = groups.find((x) => x.group === g);
    if (!entry) { entry = { group: g, items: [] }; groups.push(entry); }
    entry.items.push({ text: o.text, index });
  });
  return groups;
}
function groupOfOption(name, text) {
  const g = getOptionGroups(name).find((x) => x.items.some((i) => i.text === text));
  return g ? g.group : "";
}
// Category currently showing for this template: the chosen issue's own
// category if one is picked, else whatever category was last picked.
function getSelectedCategory(tplId, name, val) {
  if (val) { const g = groupOfOption(name, val); if (g) return g; }
  const saved = values[tplId] && values[tplId][name + "__cat"];
  return (saved && getOptionGroups(name).some((x) => x.group === saved)) ? saved : "";
}

// ── Checklists that follow a category ──────────────────────────────────
// A multiselect with `filterBy: "issue"` only lists the items that belong to
// the category currently picked in {issue}. An item's `group` is one or more
// category names (comma-separated); no group = shown for every category.
// A checklist item's `group` is an array of category names, so a name may
// safely contain commas. A plain string is the old comma-separated format;
// it's converted to an array on load (see migrateStepGroups), and until then
// it's split on commas so nothing is lost.
function splitGroups(g) {
  if (Array.isArray(g)) return g.map((s) => String(s).trim()).filter(Boolean);
  return String(g || "").split(",").map((s) => s.trim()).filter(Boolean);
}
function hasGroup(g) { return splitGroups(g).length > 0; }
// A grouped dropdown's option has exactly one category, kept as a string.
function singleGroup(g) { return (Array.isArray(g) ? String(g[0] || "") : String(g || "")).trim(); }
function multiFilterKey(name) {
  const cfg = getFieldConfig(name);
  const k = cfg && cfg.type === "multiselect" && cfg.filterBy ? String(cfg.filterBy).toLowerCase() : "";
  return (k && isGroupedField(k)) ? k : "";
}
// { items, filtered, cat, srcLabel } — items are the option texts to show
// in template `tplId` right now.
function getVisibleMultiOptions(tplId, name) {
  const cfg = getFieldConfig(name);
  const all = (cfg && cfg.options) || [];
  const fkey = multiFilterKey(name);
  const src = fkey && getPlaceholders(templates[tplId] || "").find((p) => p.toLowerCase() === fkey);
  if (!src) return { items: all.map((o) => o.text), filtered: false, cat: "", srcLabel: "" };
  const cat = getSelectedCategory(tplId, src, (values[tplId] && values[tplId][src]) || "");
  const items = all
    .filter((o) => { const gs = splitGroups(o.group); return !gs.length || (cat && gs.includes(cat)); })
    .map((o) => o.text);
  return { items, filtered: true, cat, srcLabel: labelForField(src) };
}

// ── Toggle / prefix-toggle / auto fields ───────────────────────────────
function getFieldMode(tplId, name, options) {
  if (!options || !options.length) return null;
  const saved = fieldModes[tplId] && fieldModes[tplId][name];
  if (saved && options.some((o) => o.id === saved)) return saved;
  const cfg = getFieldConfig(name);
  return (cfg && cfg.type === "toggle" && cfg.noDefault) ? null : options[0].id; // "start with nothing selected"
}
function setFieldMode(tplId, name, modeId) {
  if (!fieldModes[tplId]) fieldModes[tplId] = {};
  fieldModes[tplId][name] = modeId;
  saveFieldModesDebounced();
}
function activeOption(tplId, name, cfg) {
  const opts = normalizeOptions(cfg);
  if (!opts.length) return null;
  const hit = opts.find((o) => o.id === getFieldMode(tplId, name, opts));
  if (hit) return hit;
  return (cfg && cfg.type === "toggle" && cfg.noDefault) ? null : opts[0];
}
// ── Show only when… (conditional fields) ───────────────────────────────
// A field can be set to appear only while another field (a dropdown, checklist
// or toggle) has one of the chosen values, e.g. Deleted DNS / Added DNS only
// when {issue} is "Update/modify DNS". While hidden it's left out of the form
// and the note (its whole line goes, like an optional field left blank).
function controllingValues(tplId, field) {
  const cfg = getFieldConfig(field);
  if (!cfg) return [];
  if (cfg.type === "toggle") {
    const typed = typedToggleValue(tplId, field);
    if (typed) return [typed];
    const opt = activeOption(tplId, String(field).toLowerCase(), cfg);
    return opt ? [opt.label, opt.text].filter(Boolean).map(String) : [];
  }
  if (cfg.type === "yesno") {
    const on = valueForField(tplId, field) === true;
    return [on ? (cfg.yesText || "Yes") : (cfg.noText || "No")];
  }
  if (cfg.type === "snippet") {
    const o = normalizeOptions(cfg).find((x) => x.id === valueForField(tplId, field));
    return o ? [o.label, o.text].filter(Boolean).map(String) : [];
  }
  if (NEW_TYPES.includes(cfg.type)) { const o = computeFieldOutput(tplId, field); return o ? [o] : []; }
  const v = valueForField(tplId, field);
  if (Array.isArray(v)) return v.map(String);
  return v ? [String(v)] : [];
}
// "Show this field" compares values loosely: case, surrounding spaces and a
// trailing full stop / comma are ignored, so "Activate domain" still matches a
// list item written as "Activate domain." (or one that was later edited).
function normShowVal(v) {
  return String(v == null ? "" : v).trim().toLowerCase().replace(/[\s.,;:!?]+$/, "");
}
function isFieldVisible(tplId, name) {
  const cfg = getFieldConfig(name);
  const sw = cfg && cfg.showWhen;
  if (!sw || !sw.field || !Array.isArray(sw.values) || !sw.values.length) return true;
  // "Always show on this template": the rule is skipped for the templates ticked in the field's settings.
  if (Array.isArray(cfg.alwaysOn) && cfg.alwaysOn.includes(tplId)) return true;
  // If the controlling field isn't on this template there's nothing to wait for.
  const onTpl = getPlaceholders(templates[tplId] || "").some((p) => p.toLowerCase() === String(sw.field).toLowerCase());
  if (!onTpl) return true;
  const cur = controllingValues(tplId, sw.field).map(normShowVal);
  return sw.values.some((v) => cur.includes(normShowVal(v)));
}
// Does any field on the open template wait on this one?
function hasDependents(name) {
  const n = String(name).toLowerCase();
  return getPlaceholders(templates[activeTpl] || "").some((p) => {
    const c = getFieldConfig(p);
    return c && c.showWhen && String(c.showWhen.field || "").toLowerCase() === n;
  });
}

// ── Images ──────────────────────────────────────────────────────────────
// In the rendered note an image is a placeholder token (IMG_OPEN name|index IMG_CLOSE).
// The preview box turns it into "[Image: Name 1]"; Copy turns it into a real <img>.
const IMG_OPEN = "\uE000";
const IMG_CLOSE = "\uE001";
const IMG_TOKEN_RE = /\uE000([^|\uE001]+)\|(\d+)\uE001/g;
const MAX_IMAGES_PER_FIELD = 6;
const MAX_IMAGE_SIDE = 1400;

// Any text box can also hold pictures when its "Allow pasting images" option is on (Settings).
// Those pictures live beside the text, in values[tpl][<name>__img], and go into the note right after the line.
const PASTE_IMG_SUFFIX = "__img";
const NO_PASTE_IMG_TYPES = ["image", "auto", "dns", "dnsDiff"];
// On by default for every text box (new templates included, no setup needed): click a box and press Ctrl+V.
// Settings can switch it off for everything (General), or force the picture strip to show under one box.
function fieldAllowsImages(name) {
  const cfg = getFieldConfig(name);
  if (cfg && NO_PASTE_IMG_TYPES.includes(cfg.type)) return false;
  return !!(cfg && cfg.pasteImages) || appSettings.pasteImagesAnywhere !== false;
}
function attachedImages(tplId, name) {
  const v = values[tplId] && values[tplId][name + PASTE_IMG_SUFFIX];
  return Array.isArray(v) ? v : [];
}
function isAttachKey(k) { return typeof k === "string" && k.endsWith(PASTE_IMG_SUFFIX) && k.length > PASTE_IMG_SUFFIX.length; }

function imageMarkerText(tplId, name, idx) {
  const imgs = (values[tplId] && values[tplId][name]) || [];
  const label = labelForField(isAttachKey(name) ? name.slice(0, -PASTE_IMG_SUFFIX.length) : name);
  return imgs.length > 1 ? `[Image: ${label} ${idx + 1}]` : `[Image: ${label}]`;
}
// The pictures in a rendered note, in the order their [Image: ...] markers appear (for the Cases panel).
function collectNoteImages(text, tplId) {
  const out = [];
  String(text).replace(IMG_TOKEN_RE, (m, name, i) => {
    const src = (values[tplId] && values[tplId][name] && values[tplId][name][Number(i)]) || "";
    out.push({ n: name, s: src });
    return m;
  });
  return out;
}
function noteWithImageMarkers(text, tplId) {
  return text.replace(IMG_TOKEN_RE, (_, name, i) => imageMarkerText(tplId, name, Number(i)));
}
function escHtmlText(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// The note as rich text. Every line is its own <div> and every picture sits in a <div> of its own
// (v1.28.8). Chat apps such as Teams drop a <br> in front of an <img> and style="display:block", which
// left the picture on the same line as the last text, to its right; separate blocks can't do that.
// `re` is a global regex whose matches are picture markers; `imgFor(match, index)` gives { src, alt }
// for a marker, or null to leave the marker as plain text.
function textToBlocksHtml(text, re, imgFor) {
  const blocks = [];
  let cur = "";
  const flush = () => { blocks.push(cur === "" ? "<div><br></div>" : `<div>${cur}</div>`); cur = ""; };
  const addText = (s) => { s.split("\n").forEach((p, k) => { if (k > 0) flush(); cur += escHtmlText(p); }); };
  const rx = new RegExp(re.source, "g");
  let last = 0, n = 0, m;
  while ((m = rx.exec(text))) {
    addText(text.slice(last, m.index));
    last = m.index + m[0].length;
    const im = imgFor(m, n++);
    if (im && im.src) {
      if (cur !== "") flush();
      blocks.push(`<div><img src="${im.src}" alt="${escAttr(im.alt || "")}" style="max-width:100%;height:auto"></div>`);
      if (text[last] === "\n") last++; // the picture's own block already ends the line
    } else {
      cur += escHtmlText(m[0]);
    }
  }
  addText(text.slice(last));
  if (cur !== "") flush();
  return blocks.join("");
}
function noteToHtml(text, tplId) {
  return textToBlocksHtml(text, IMG_TOKEN_RE, (m) => ({
    src: (values[tplId] && values[tplId][m[1]] && values[tplId][m[1]][Number(m[2])]) || "",
    alt: imageMarkerText(tplId, m[1], Number(m[2]))
  }));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("not an image"));
    img.src = src;
  });
}
// Shrinks a picked / pasted picture so a few of them don't fill up storage.
async function fileToSmallDataUrl(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // transparent areas would turn black in a JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
// Which field a focused box belongs to, and how to find the box again after the form redraws.
// Covers the plain text box, the dropdown's "type it yourself" box, the "Other" box of
// checklists / toggle rows, and the little per-button boxes of a toggle + text row.
function imgBoxInfo(el) {
  const d = el && el.dataset;
  if (!d) return null;
  if (d.field) return { name: d.field, sel: `[data-field="${cssEsc(d.field)}"]` };
  if (d.customField) return { name: d.customField, sel: `[data-custom-field="${cssEsc(d.customField)}"]` };
  if (d.otherName) return { name: d.otherName, sel: `[data-other-name="${cssEsc(d.otherName)}"]` };
  if (d.mtInput) return { name: d.mtInput, sel: `[data-mt-input="${cssEsc(d.mtInput)}"][data-mt-id="${cssEsc(d.mtId || "")}"]` };
  return null;
}
async function addImagesToField(name, files) {
  const tplId = activeTpl;
  const list = [...files].filter((f) => f && /^image\//.test(f.type));
  if (!list.length) { showToast("That isn't an image"); return; }
  const bag = values[tplId] || (values[tplId] = {});
  const arr = Array.isArray(bag[name]) ? bag[name] : (bag[name] = []);
  let added = 0;
  for (const f of list) {
    if (arr.length >= MAX_IMAGES_PER_FIELD) { showToast(`Up to ${MAX_IMAGES_PER_FIELD} images per field`); break; }
    try { arr.push(await fileToSmallDataUrl(f)); added++; } catch (e) { showToast("Couldn't read that image"); }
  }
  if (!added) return;
  saveValuesDebounced();
  if (activeTpl === tplId) {
    // renderFields() rebuilds the form, which drops focus. Put it back (with the caret) so the
    // next Ctrl+V lands in the same box and several screenshots can be pasted in a row.
    const baseName = isAttachKey(name) ? name.slice(0, -PASTE_IMG_SUFFIX.length) : null;
    let info = null, a = null, z = null;
    if (baseName) {
      lastImgPasteBox = baseName;
      const el = document.activeElement;
      const got = imgBoxInfo(el);
      if (got && got.name === baseName) { info = got; a = el.selectionStart; z = el.selectionEnd; }
    }
    renderFields();
    if (info) {
      const box = $("fields").querySelector(info.sel);
      if (box) {
        try { box.focus({ preventScroll: true }); if (a != null) box.setSelectionRange(a, z); } catch (e) { /* not a text box */ }
      }
    }
  }
  showToast(added === 1 ? "Image added" : `${added} images added`);
}
// The text box that last took a pasted picture: Ctrl+V keeps going there even if focus was lost.
let lastImgPasteBox = null;
async function copyImageToClipboard(dataUrl) {
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    showToast("Image copied");
  } catch (e) {
    showToast("Couldn't copy the image");
  }
}
// Copy button: plain text as before, or text + pictures as rich text when the note has images.
function copyNote() {
  const text = renderTemplateText(templates[activeTpl] || "", activeTpl);
  if (typeof logCase === "function") logCase(activeTpl, noteWithImageMarkers(text, activeTpl), collectNoteImages(text, activeTpl));
  if (!text.includes(IMG_OPEN) || typeof ClipboardItem === "undefined") {
    copyTextToClipboard(noteWithImageMarkers(text, activeTpl), "Copied!");
    return;
  }
  const html = noteToHtml(text, activeTpl);
  const plain = noteWithImageMarkers(text, activeTpl);
  navigator.clipboard.write([new ClipboardItem({
    "text/html": new Blob([html], { type: "text/html" }),
    "text/plain": new Blob([plain], { type: "text/plain" })
  })]).then(() => showToast("Copied with images!"))
    .catch(() => copyTextToClipboard(plain, "Copied (images couldn't be included)"));
}

// Toggle + text (select multiple): { optionId: "text" } — a key is present while its button is on.
function multiToggleBag(tplId, name) {
  const v = values[tplId] && values[tplId][name];
  return (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
}

function computeFieldOutput(tplId, name) {
  const key = name.toLowerCase();
  const cfg = getFieldConfig(key);
  if (!isFieldVisible(tplId, name)) return "";
  if (cfg && cfg.type === "multiselect") {
    const ticked = (values[tplId] && Array.isArray(values[tplId][name])) ? values[tplId][name] : [];
    // Ticks stay saved when their category isn't the one showing, so switching
    // category and back loses nothing; they just don't go into the note.
    const showing = getVisibleMultiOptions(tplId, name).items;
    const arr = ticked.filter((v) => showing.includes(v)).concat(otherLines(tplId, name));
    if (!arr.length) return "";
    const prefix = cfg.itemPrefix !== undefined ? cfg.itemPrefix : "- ";
    return "\n" + arr.map((v) => prefix + v).join("\n");
  }
  if (cfg && cfg.type === "image") {
    const imgs = (values[tplId] && Array.isArray(values[tplId][name])) ? values[tplId][name] : [];
    return imgs.length ? "\n" + imgs.map((_, i) => IMG_OPEN + name + "|" + i + IMG_CLOSE).join("\n") : "";
  }
  if (cfg && cfg.type === "multiToggle") {
    const bag = multiToggleBag(tplId, name);
    const start = cfg.lineStart !== undefined ? cfg.lineStart : "- ";
    // A pasted list (several lines) gives one note line per entry, each with the label.
    const lines = [];
    normalizeOptions(cfg).forEach((o) => {
      if (!Object.prototype.hasOwnProperty.call(bag, o.id)) return;
      String(bag[o.id] || "").split(/\r?\n/).map((t) => t.trim()).filter(Boolean)
        .forEach((t) => lines.push(start + (o.prefix || "") + t));
    });
    otherLines(tplId, name).forEach((t) => lines.push(start + t));
    return lines.length ? "\n" + lines.join("\n") : "";
  }
  if (cfg && cfg.type === "date") return fmtDateISO(valueForField(tplId, name), cfg.format);
  if (cfg && cfg.type === "datetime") return fmtDateTime(valueForField(tplId, name), cfg);
  if (cfg && cfg.type === "number") return numberOutput(tplId, name, cfg);
  if (cfg && cfg.type === "yesno") return valueForField(tplId, name) === true ? (cfg.yesText || "Yes") : (cfg.noText || "");
  if (cfg && cfg.type === "counter") { const c = String(valueForField(tplId, name) == null ? "" : valueForField(tplId, name)).trim(); return c; }
  if (cfg && cfg.type === "snippet") return snippetOutput(tplId, name, cfg);
  if (cfg && cfg.type === "dns") return dnsFieldOutput(tplId, name, cfg);
  if (cfg && cfg.type === "dnsDiff") return dnsDiffOutput(tplId, cfg);
  const rawVal = values[tplId] && values[tplId][name];
  const raw = (typeof rawVal === "string" ? rawVal : "").trim(); // a leftover list/object from an old field type must not crash the note
  if (!cfg) return cleanModeFor(name) === "email" ? cleanPerLine(raw, cleanEmailValue) : raw;
  if (cfg.type === "toggle") {
    const typed = typedToggleValue(tplId, key);
    if (typed) return typed;
    const opt = activeOption(tplId, key, cfg);
    return opt ? (opt.text || opt.label || "") : "";
  }
  if (cfg.type === "auto") return computeAutoValue(tplId, cfg);
  if (cfg.type === "prefixToggle") {
    if (!raw) return raw;
    const opt = activeOption(tplId, key, cfg);
    const prefix = opt ? (opt.prefix || "") : "";
    // Strip a leading prefix the value already carries — either the active
    // one (pasted "$63.47" into a "$" field) or a different option's (typed
    // while "$" was active, then switched to "€": drop the old "$" too).
    // Longest match first so e.g. "US$" isn't left half-stripped by "$".
    const allPrefixes = normalizeOptions(cfg).map((o) => o.prefix || "").filter(Boolean)
      .sort((a, b) => b.length - a.length);
    // A pasted list (several lines) is handled one entry at a time.
    return raw.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).map((entry) => {
      let val = cfg.clean === "domain" ? cleanDomainValue(entry) : entry;
      for (const p of allPrefixes) {
        if (val.startsWith(p)) { val = val.slice(p.length); break; }
      }
      return prefix + val;
    }).join("\n");
  }
  if (cfg.type === "text" && cfg.clean === "domain") return cleanPerLine(raw, cleanDomainValue);
  if (cfg.type === "text" && cfg.clean === "email") return cleanPerLine(raw, cleanEmailValue);
  if (cfg.type === "text" && cfg.clean === "url") return cleanPerLine(raw, cleanUrlValue);
  return raw;
}

// Cleaning (domain, email, case ID) works on one entry at a time, so a pasted list
// of several lines is tidied line by line.
function cleanPerLine(raw, fn) {
  return String(raw == null ? "" : raw).split(/\r?\n/).map((t) => t.trim()).filter(Boolean).map(fn).join("\n");
}

// Which clean mode applies to a placeholder: its configured one, or "email"
// for an unconfigured placeholder that has "email" in its name.
function cleanModeFor(name) {
  const cfg = getFieldConfig(name);
  if (cfg) return cfg.clean || "";
  return /e-?mail/i.test(String(name)) ? "email" : "";
}

// Tidies an email address: "Jane Doe <Jane@Example.com>", "mailto:Jane@Example.com"
// and " JANE@example.com " all become jane@example.com. Anything that doesn't
// end up shaped like an address is left as typed (trimmed).
const EMAIL_SHAPE = /^[^\s@<>()\[\],;:"]+@[^\s@<>()\[\],;:"]+\.[^\s@<>()\[\],;:"]{2,}$/;
function cleanEmailValue(raw) {
  const v = String(raw == null ? "" : raw).trim();
  if (!v) return v;
  let e = v.replace(/^mailto:\s*/i, "");
  const angle = e.match(/<([^<>]+)>\s*$/);
  if (angle) e = angle[1];
  e = e.trim().replace(/[.,;]+$/, "").toLowerCase();
  return EMAIL_SHAPE.test(e) ? e : v;
}

// ── Soft warnings ──────────────────────────────────────────────────────
// A short amber hint shown under a field whose value looks off. It only ever
// advises: nothing is blocked and the note is unaffected. The rules are a list
// managed in Settings ("Soft warnings"). `softWarnings` stays null until the
// list is first changed, which means "use the built-in ones" below.
//
//   scope   — "*" any text field | "clean:<mode>" every field cleaned that way
//             (caseId / domain / email) | "field:<name>" one placeholder
//   test    — one of WARN_TESTS
//   value   — the number / text / pattern a test needs
//   message — what the hint says
// If several rules apply to a field, the first one in the list that triggers
// is the one shown. Tests look at the value after cleaning (a case ID is
// tested as its bare digits, a URL as its bare domain, and so on).
const WARN_TESTS = {
  notNumber:   { label: "isn't a plain number", needs: "" },
  notDomain:   { label: "doesn't look like a domain", needs: "" },
  notEmail:    { label: "doesn't look like an email address", needs: "" },
  lengthNot:   { label: "isn't exactly this many characters long", needs: "number" },
  shorterThan: { label: "is shorter than this many characters", needs: "number" },
  longerThan:  { label: "is longer than this many characters", needs: "number" },
  contains:    { label: "contains this text", needs: "text" },
  notContains: { label: "doesn't contain this text", needs: "text" },
  matches:     { label: "matches this pattern (regex)", needs: "pattern" },
  notMatches:  { label: "doesn't match this pattern (regex)", needs: "pattern" }
};
const DEFAULT_SOFT_WARNINGS = [
  { id: "dw-caseid-number", scope: "clean:caseId", test: "notNumber", value: "", message: "Case IDs are usually just a number, like 26838210." },
  { id: "dw-caseid-length", scope: "clean:caseId", test: "lengthNot", value: "8", message: "Case IDs are usually 8 digits." },
  { id: "dw-domain", scope: "clean:domain", test: "notDomain", value: "", message: "This doesn't look like a domain." },
  { id: "dw-email", scope: "clean:email", test: "notEmail", value: "", message: "This doesn't look like an email address." }
];
function getSoftWarnings() { return softWarnings || DEFAULT_SOFT_WARNINGS; }
function saveSoftWarnings() {
  if (softWarnings) chrome.storage.local.set({ cnh_softWarnings: softWarnings });
  else chrome.storage.local.remove("cnh_softWarnings");
}
let warnIdCounter = 0;
function newWarnId() { return "w" + Date.now().toString(36) + (warnIdCounter++).toString(36); }
// Loaded / imported data: anything that isn't a usable rule is dropped.
// Returns null (= use the built-ins) when there's no saved list at all.
function sanitizeSoftWarnings(list) {
  if (!Array.isArray(list)) return null;
  return list
    .filter((r) => r && typeof r === "object" && WARN_TESTS[r.test])
    .map((r) => ({
      id: String(r.id || newWarnId()),
      scope: (typeof r.scope === "string" && r.scope) ? r.scope : "*",
      test: r.test,
      value: WARN_TESTS[r.test].needs && r.value != null ? String(r.value) : "",
      message: String(r.message || "").trim()
    }));
}

function isDomainLike(v) {
  return /^((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]|\d{1,3}(?:\.\d{1,3}){3})$/i.test(v);
}
// A case ID as its bare digits: "I-26838210", "#26838210" and "26838210" all give 26838210.
function caseIdDigits(v) {
  return String(v).replace(/^#\s*/, "").replace(/^I[-\u2010-\u2015\s]*(?=[#\d])/i, "").replace(/^#\s*/, "").replace(/\s+/g, "");
}
// The text a rule is tested against: the value as it will come out after the
// field's clean mode has been applied.
function warnSubject(mode, v) {
  if (mode === "caseId") return caseIdDigits(v);
  if (mode === "domain") return cleanDomainValue(v);
  if (mode === "email") return cleanEmailValue(v);
  return v;
}
// Does `rule`'s test fire for this (non-empty, trimmed) value? `mode` is the
// field's clean mode; `plainText` is true for a single-line text field, where
// a bare customer number is fine in a domain box.
function warningTriggers(rule, mode, v, plainText) {
  const s = warnSubject(mode, v);
  const n = parseInt(rule.value, 10);
  const val = String(rule.value == null ? "" : rule.value);
  switch (rule.test) {
    case "notNumber": return !/^\d+$/.test(s);
    case "notDomain": { const d = cleanDomainValue(s); return !(isDomainLike(d) || (plainText && /^\d+$/.test(d))); }
    case "notEmail": return !EMAIL_SHAPE.test(cleanEmailValue(s));
    case "lengthNot": return !isNaN(n) && s.length !== n;
    case "shorterThan": return !isNaN(n) && s.length < n;
    case "longerThan": return !isNaN(n) && s.length > n;
    case "contains": return !!val && s.toLowerCase().includes(val.toLowerCase());
    case "notContains": return !!val && !s.toLowerCase().includes(val.toLowerCase());
    case "matches":
    case "notMatches": {
      if (!val) return false;
      let re;
      try { re = new RegExp(val, "i"); } catch (e) { return false; } // a bad pattern never warns
      return rule.test === "matches" ? re.test(s) : !re.test(s);
    }
  }
  return false;
}
function warningApplies(rule, key, mode) {
  const sc = rule.scope || "*";
  if (sc === "*") return true;
  if (sc.startsWith("clean:")) return mode === sc.slice(6);
  if (sc.startsWith("field:")) return key === sc.slice(6).toLowerCase();
  return false;
}
function fieldWarning(name, rawValue) {
  const cfg = getFieldConfig(name);
  if (cfg && cfg.warn === false) return "";
  const v = String(rawValue == null ? "" : rawValue).trim();
  if (!v) return "";
  const key = String(name).toLowerCase();
  const mode = cleanModeFor(name);
  const plainText = !!(cfg && cfg.type === "text");
  // A pasted list is checked one entry at a time; the first problem found is shown.
  const lines = v.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
  for (const line of lines) {
    const hit = getSoftWarnings().find((r) => warningApplies(r, key, mode) && warningTriggers(r, mode, line, plainText));
    if (hit) return hit.message || "This doesn't look right.";
  }
  if (mode === "email") {
    for (const line of lines) { const t = emailTypoHint(cleanEmailValue(line)); if (t) return t; }
  }
  return "";
}
function warnHTML(name, value) {
  return `<div class="field-warn" data-warn-for="${escAttr(name)}" role="status">${escHtml(fieldWarning(name, value))}</div>`;
}

// Tidies a pasted URL or host: https://www.Example.com/path?x=1 becomes example.com.
// Anything that doesn't look like a URL or hostname (a customer ID, an email
// address, free text) comes back untouched, so it's safe on a field that takes
// either a domain or an ID.
function cleanDomainValue(raw) {
  const v = String(raw == null ? "" : raw).trim();
  if (!v || /\s/.test(v)) return v;
  let host;
  const withScheme = v.match(/^[a-z][a-z0-9+.\-]*:\/\/(.*)$/i);
  if (withScheme) {
    host = withScheme[1].split(/[\/?#]/)[0].replace(/^.*@/, "").replace(/:\d+$/, "");
  } else {
    const m = v.match(/^((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:[\/?#].*)?$/i);
    if (!m) return v;
    host = m[1];
  }
  host = host.toLowerCase().replace(/\.$/, "").replace(/^www\.(?=.+\..+)/, "");
  return host || v;
}

// Case IDs come out as I-<digits> however they were typed: 26838210,
// I-26838210, i-26838210, #26838210 and "I 26838210" all give I-26838210.
// `before` is the template text on the same line, up to where the value goes:
// a template that already writes "I-" itself (like Case Note's I-{caseId})
// gets the bare digits, so it never turns into I-I-26838210. A value that
// isn't a plain number (after dropping I-, # and spaces) is left as typed.
const CASE_ID_PREFIX_BEFORE = /(^|[^A-Za-z0-9])I[-\u2010-\u2015]$/;
function formatCaseId(value, before) {
  const v = String(value == null ? "" : value).trim();
  if (!v) return v;
  const digits = v.replace(/^#\s*/, "").replace(/^I[-\u2010-\u2015\s]*(?=[#\d])/i, "").replace(/^#\s*/, "").replace(/\s+/g, "");
  if (!/^\d+$/.test(digits)) return dropDoubledCasePrefix(v, before);
  return CASE_ID_PREFIX_BEFORE.test(before) ? digits : "I-" + digits;
}
// Fields without the case-ID setting: only guard against a doubled prefix.
function dropDoubledCasePrefix(value, before) {
  if (!value || !CASE_ID_PREFIX_BEFORE.test(before)) return value;
  return value.replace(/^I[-\u2010-\u2015]\s*/i, "");
}
// What actually goes into the note for one {placeholder} occurrence.
function finishValue(name, value, before) {
  const cfg = getFieldConfig(name);
  if (cfg && cfg.type === "text" && cfg.clean === "caseId") {
    const lines = String(value == null ? "" : value).split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
    if (lines.length > 1) return lines.map((l, i) => formatCaseId(l, i ? "" : before)).join("\n");
    return formatCaseId(value, before);
  }
  return dropDoubledCasePrefix(value, before);
}

function getPlaceholders(text) {
  const seen = new Set();
  const out = [];
  const re = /\{([a-zA-Z0-9_]+)\}/g;
  let m;
  while ((m = re.exec(text))) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
  }
  return out;
}

function labelFor(name) {
  // caseId -> "Case Id", customerName -> "Customer Name"
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

// ── Persistence ─────────────────────────────────────────────────────────
function loadState(cb) {
  chrome.storage.local.get(
    ["cnh_templates", "cnh_values", "cnh_tabOrder", "cnh_customLabels", "cnh_tabTypes", "cnh_referenceTables", "cnh_fieldModes", "cnh_selectOptionLists", "cnh_fieldConfigs", "cnh_deletedFields", "cnh_softWarnings", "cnh_snapshots", "cnh_appSettings", "cnh_mbFix1"],
    (res) => {
      const storedTemplates = res.cnh_templates || {};
      // A stored copy that is just an older default wording isn't an edit.
      let droppedLegacy = false;
      Object.keys(LEGACY_DEFAULT_TEMPLATES).forEach((id) => {
        if (LEGACY_DEFAULT_TEMPLATES[id].includes(storedTemplates[id])) { delete storedTemplates[id]; droppedLegacy = true; }
      });
      templates = { ...DEFAULT_TEMPLATES, ...storedTemplates };
      values = res.cnh_values || {};
      fieldModes = res.cnh_fieldModes || {};
      tabOrder = (res.cnh_tabOrder && res.cnh_tabOrder.length) ? res.cnh_tabOrder : [...DEFAULT_TAB_ORDER];
      // Defaults must always be present even if an old save predates them.
      DEFAULT_TAB_ORDER.forEach((id) => { if (!tabOrder.includes(id)) tabOrder.push(id); });
      customLabels = res.cnh_customLabels || {};
      tabTypes = res.cnh_tabTypes || {};
      referenceTables = res.cnh_referenceTables || {};
      fieldConfigs = res.cnh_fieldConfigs || {};
      deletedFields = Array.isArray(res.cnh_deletedFields) ? res.cnh_deletedFields : [];
      softWarnings = sanitizeSoftWarnings(res.cnh_softWarnings);
      snapshots = sanitizeSnapshots(res.cnh_snapshots);
      appSettings = sanitizeAppSettings(res.cnh_appSettings);
      clearHiddenIfAll();
      if (isTabHidden(activeTpl)) activeTpl = firstShownTab();
      migrateLegacyOptionLists(res.cnh_selectOptionLists);
      migrateIssueCategories();
      migrateStepCategories();
      migrateStepGroups();
      migrateCleanFlags();
      migrateManualBox();
      migrateListOrder();
      if (!res.cnh_mbFix1) { forceIssueManualBox(); chrome.storage.local.set({ cnh_mbFix1: true }); }
      migrateDuplicateOptionIds();
      migrateDnsFields();
      if (typeof undoReset === "function") undoReset();
      if (droppedLegacy) saveTemplates();
      // Older versions saved every built-in template as if it were an edit,
      // which pinned it to the wording it had at the time. A stored copy that
      // still matches today's default isn't an edit, so drop it: future
      // changes to that default will then reach this install.
      if (Object.keys(storedTemplates).some((id) => id in DEFAULT_TEMPLATES && storedTemplates[id] === DEFAULT_TEMPLATES[id])) saveTemplates();
      cb && cb();
    }
  );
}
// Older versions stored {department}-style lists separately; fold any of
// those into the field's config the first time we see them.
function migrateLegacyOptionLists(legacy) {
  if (!legacy || typeof legacy !== "object") return;
  Object.keys(legacy).forEach((key) => {
    if (fieldConfigs[key] || !Array.isArray(legacy[key])) return;
    const base = DEFAULT_FIELD_CONFIGS[key];
    fieldConfigs[key] = {
      label: (base && base.label) || labelFor(key),
      type: "select",
      inlineManage: base ? !!base.inlineManage : true,
      options: legacy[key].map((t) => ({ text: t }))
    };
  });
  if (Object.keys(legacy).length) saveFieldConfigs();
}

// An {issue} list saved before categories existed is flat. Sort each of its
// options into the matching built-in category (anything you added yourself
// goes under "Other" — rename it from Settings). Runs once: after that the
// saved config carries an explicit `grouped` flag either way.
function migrateIssueCategories() {
  const cfg = fieldConfigs.issue;
  if (!cfg || cfg.type !== "select" || cfg.grouped !== undefined) return;
  const known = new Map();
  (DEFAULT_FIELD_CONFIGS.issue.options || []).forEach((o) => known.set(o.text, o.group));
  cfg.options = (cfg.options || []).map((o) => ({ text: o.text, group: o.group || known.get(o.text) || DEFAULT_GROUP_NAME }));
  cfg.grouped = true;
  saveFieldConfigs();
}

// Same idea for a {troubleshootingSteps} list saved before it followed the
// issue category: steps that match a built-in one take its category, and
// anything you added yourself stays category-less (so it shows for every
// category and nothing you wrote disappears). Runs once.
function migrateStepCategories() {
  const cfg = fieldConfigs.troubleshootingsteps;
  if (!cfg || cfg.type !== "multiselect" || cfg.filterBy !== undefined) return;
  const known = new Map();
  (DEFAULT_FIELD_CONFIGS.troubleshootingsteps.options || []).forEach((o) => known.set(o.text, o.group || ""));
  cfg.options = (cfg.options || []).map((o) => {
    const g = o.group || known.get(o.text) || "";
    return g ? { text: o.text, group: g } : { text: o.text };
  });
  cfg.filterBy = "issue";
  saveFieldConfigs();
}

// A checklist item's categories used to be one comma-separated string, which
// can't represent a category whose own name contains a comma. Convert those to
// arrays, using the categories that actually exist in the list being followed
// to decide where one name ends and the next begins. Runs until none are left.
function migrateStepGroups() {
  let changed = false;
  Object.keys(fieldConfigs).forEach((key) => {
    const cfg = fieldConfigs[key];
    if (!cfg || cfg.type !== "multiselect" || !Array.isArray(cfg.options)) return;
    const known = cfg.filterBy ? getOptionGroups(String(cfg.filterBy).toLowerCase()).map((g) => g.group) : [];
    cfg.options.forEach((o) => {
      if (!o || typeof o.group !== "string") return;
      const list = parseLegacyGroupString(o.group, known);
      if (list.length) o.group = list; else delete o.group;
      changed = true;
    });
  });
  if (changed) saveFieldConfigs();
}
function parseLegacyGroupString(str, known) {
  const cats = [...new Set(known)].filter(Boolean).sort((a, b) => b.length - a.length); // longest first
  let rest = String(str).trim();
  const out = [];
  while (rest) {
    let take = "";
    let used = 0;
    const hit = cats.find((c) => rest.startsWith(c) && (rest.length === c.length || /^\s*,/.test(rest.slice(c.length))));
    if (hit) { take = hit; used = hit.length; }
    else { const i = rest.indexOf(","); used = i === -1 ? rest.length : i; take = rest.slice(0, used).trim(); }
    if (take) out.push(take);
    rest = rest.slice(used).replace(/^\s*,\s*/, "").trim();
  }
  return out;
}

// {customerDomain} and {server} tidy pasted URLs, and {caseId} formats as
// I-<digits>. An override of any of them saved before that existed doesn't
// carry the setting, so give it the same default as the built-in. Once saved
// from Settings it holds an explicit value ("" = off) and is left alone.
// {issue} gets the text box next to its dropdown. A saved override from before
// that existed doesn't carry the setting, so it is switched on once; after that
// Settings holds an explicit true/false and it is left alone.
// Two options of one toggle must never share an id: the id is what is saved as the picked
// button, so a duplicate makes both buttons light up and the second one can never be chosen.
// (Deleting an option and adding another used to reuse the same "optN" id.) The first keeps
// its id, so anything already saved for it still points at the right button.
function migrateDuplicateOptionIds() {
  let changed = false;
  Object.keys(fieldConfigs).forEach((k) => {
    const cfg = fieldConfigs[k];
    if (!cfg || !Array.isArray(cfg.options) || !["toggle", "prefixToggle", "multiToggle"].includes(cfg.type)) return;
    const seen = new Set();
    cfg.options.forEach((o) => { if (o && o.id) seen.add(o.id); });
    const used = new Set();
    cfg.options.forEach((o) => {
      if (!o || !o.id) return;
      if (!used.has(o.id)) { used.add(o.id); return; }
      let n = 2;
      while (seen.has(o.id + "_" + n)) n++;
      o.id = o.id + "_" + n;
      seen.add(o.id); used.add(o.id);
      changed = true;
    });
  });
  if (changed) saveFieldConfigs();
}
function migrateManualBox() {
  const cfg = fieldConfigs.issue;
  if (cfg && cfg.type === "select" && cfg.manualBox === undefined) { cfg.manualBox = true; saveFieldConfigs(); }
}

// One-time repair (v1.6.5): some saved Issue configs ended up with the text box
// switched off, so there was no way to type an issue that isn't in the list.
// Turn it back on once; after that the Settings checkbox is respected again.
function forceIssueManualBox() {
  const cfg = fieldConfigs.issue;
  if (cfg && cfg.type === "select" && cfg.manualBox !== true) { cfg.manualBox = true; saveFieldConfigs(); }
}

function migrateCleanFlags() {
  let changed = false;
  ["customerdomain", "server", "caseid"].forEach((k) => {
    const cfg = fieldConfigs[k];
    const base = DEFAULT_FIELD_CONFIGS[k];
    if (cfg && base && cfg.type === base.type && cfg.clean === undefined) { cfg.clean = base.clean; changed = true; }
  });
  if (changed) saveFieldConfigs();
}

// {oldDns} / {newDns} were plain text fields. If they were saved as such with
// nothing but a label / optional flag changed, make them DNS record fields;
// anything more customised is left for the person to switch in Settings.
function migrateDnsFields() {
  let changed = false;
  ["olddns", "newdns"].forEach((k) => {
    const cfg = fieldConfigs[k];
    if (cfg && cfg.type === "text" && Object.keys(cfg).every((p) => ["label", "type", "optional", "warn", "clean", "placeholder"].includes(p))) {
      fieldConfigs[k] = { label: cfg.label || DEFAULT_FIELD_CONFIGS[k].label, type: "dns", optional: cfg.optional !== false };
      changed = true;
    }
  });
  if (changed) saveFieldConfigs();
}

// Only templates that differ from the built-in wording are stored: custom tabs,
// and built-ins the user has actually edited. A built-in left alone stays
// out of storage, so it keeps following the code (see loadState).
function templateOverrides() {
  const out = {};
  Object.keys(templates).forEach((id) => {
    if (!(id in DEFAULT_TEMPLATES) || templates[id] !== DEFAULT_TEMPLATES[id]) out[id] = templates[id];
  });
  return out;
}
function saveTemplates() { chrome.storage.local.set({ cnh_templates: templateOverrides() }); }
function saveTabState() { chrome.storage.local.set({ cnh_tabOrder: tabOrder, cnh_customLabels: customLabels, cnh_tabTypes: tabTypes }); }
function saveReferenceTables() { chrome.storage.local.set({ cnh_referenceTables: referenceTables }); }
let saveValuesTimer = null;
function saveValuesDebounced() {
  if (typeof undoTrack === "function") undoTrack(activeTpl);
  clearTimeout(saveValuesTimer);
  saveValuesTimer = setTimeout(() => chrome.storage.local.set({ cnh_values: values }), 200);
}
let saveFieldModesTimer = null;
function saveFieldModesDebounced() {
  if (typeof undoTrack === "function") undoTrack(activeTpl);
  clearTimeout(saveFieldModesTimer);
  saveFieldModesTimer = setTimeout(() => chrome.storage.local.set({ cnh_fieldModes: fieldModes }), 200);
}

// ── Rendering ───────────────────────────────────────────────────────────
function getSearchQuery() {
  return ($("tplSearch").value || "").trim().toLowerCase();
}

function tabSearchableContent(id) {
  if (tabType(id) === "reference") {
    const t = referenceTables[id];
    if (!t || !t.columns) return "";
    return [...t.columns, ...(t.rows || []).flat()].join(" ").toLowerCase();
  }
  return (templates[id] || "").toLowerCase();
}

// Hidden tabs (Settings -> General -> Tabs on the dashboard): not deleted, just left off the tab list.
// A hidden tab you land on anyway (e.g. by opening one of its cases) stays listed until you leave it.
function isTabHidden(id) { return Array.isArray(appSettings.hiddenTabs) && appSettings.hiddenTabs.includes(id); }
function clearHiddenIfAll() { if (tabOrder.length && tabOrder.every((t) => isTabHidden(t))) { appSettings.hiddenTabs = []; saveAppSettings(); } }
function firstShownTab() { return tabOrder.find((id) => !isTabHidden(id)) || tabOrder[0] || DEFAULT_TAB_ORDER[0]; }
function setTabHidden(id, hide) {
  const set = new Set(Array.isArray(appSettings.hiddenTabs) ? appSettings.hiddenTabs : []);
  if (hide) set.add(id); else set.delete(id);
  appSettings.hiddenTabs = tabOrder.filter((t) => set.has(t)); // keeps the list tidy and in tab order
  saveAppSettings();
  if (hide && activeTpl === id) { activeTpl = firstShownTab(); }
}
function hideTabWithConfirm(id) {
  if (tabOrder.filter((t) => !isTabHidden(t)).length <= 1) { showToast("Can't hide your last tab"); return; }
  const label = labelForTpl(id);
  showConfirmDialog({
    title: `Hide \u201C${label}\u201D?`,
    text: "The tab is only hidden, not deleted. Bring it back any time in Settings \u2192 General \u2192 Tabs on the dashboard.",
    confirmLabel: "Hide",
    onConfirm: () => {
      setTabHidden(id, true);
      $("tplSearch").value = "";
      renderTabs();
      renderActiveView();
    }
  });
}

function getVisibleTabOrder() {
  const q = getSearchQuery();
  const base = tabOrder.filter((id) => !isTabHidden(id) || id === activeTpl);
  if (!q) return base;
  return base.filter((id) => {
    const label = labelForTpl(id).toLowerCase();
    return label.includes(q) || tabSearchableContent(id).includes(q);
  });
}

function setReorderChromeDisabled(disabled) {
  ["settingsBtn", "aboutBtn", "editToggleBtn"].forEach((id) => {
    $(id).disabled = disabled;
  });
}

function enterReorderMode() {
  reorderMode = true;
  tabOrderSnapshot = [...tabOrder];
  const btn = $("reorderToggleBtn");
  setHdrIcon(btn, "check", "Done: save this order");
  btn.classList.add("reorder-on");
  $("reorderCancelBtn").classList.remove("hidden");
  $("searchRow").classList.add("hidden");
  $("tplSearch").value = "";
  setReorderChromeDisabled(true);
  renderTabs();
}

function exitReorderMode() {
  reorderMode = false;
  tabOrderSnapshot = null;
  const btn = $("reorderToggleBtn");
  setHdrIcon(btn, "reorder", "Rearrange template tabs");
  btn.classList.remove("reorder-on");
  $("reorderCancelBtn").classList.add("hidden");
  $("searchRow").classList.remove("hidden");
  setReorderChromeDisabled(false);
  renderTabs();
}

function toggleReorderMode() {
  if (reorderMode) exitReorderMode();
  else enterReorderMode();
}

// Escape out of Reorder: nothing moved -> just leave; something moved -> ask.
function requestExitReorder() {
  if (!reorderMode) return;
  const moved = JSON.stringify(tabOrder) !== JSON.stringify(tabOrderSnapshot);
  if (!moved) { cancelReorder(); return; }
  showUnsavedDialog({
    text: "Keep the new tab order before going back?",
    saveLabel: "Save order",
    keepLabel: "Keep reordering",
    onSave: () => exitReorderMode(),
    onDiscard: () => cancelReorder()
  });
}

function cancelReorder() {
  if (tabOrderSnapshot) {
    tabOrder = [...tabOrderSnapshot];
    saveTabState();
  }
  exitReorderMode();
}

// FLIP-animates the tiles in `container` across whatever DOM reordering
// `mutate` performs: record each tile's position before, run `mutate`
// (which moves nodes around, not innerHTML — the dragged node must stay
// the same live DOM element or the native drag session breaks), then play
// each tile from its old spot to its new one.
function flipReorder(container, mutate) {
  const before = {};
  container.querySelectorAll(".tab-btn").forEach((el) => {
    before[el.dataset.tpl] = el.getBoundingClientRect();
  });

  mutate();

  container.querySelectorAll(".tab-btn").forEach((el) => {
    const from = before[el.dataset.tpl];
    if (!from) return;
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (!dx && !dy) return;
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = "transform 180ms ease";
      el.style.transform = "";
    });
  });
}

// Wires up native HTML5 drag-and-drop on one tab tile while in reorder
// mode: picking it up (dragstart) pauses the wiggle so it doesn't fight
// the slide animation, dragging over a neighbor moves it there right
// away — like rearranging phone home-screen icons — and dragend persists
// the final order.
function attachReorderHandlers(container, btn, id) {
  btn.draggable = true;
  btn.addEventListener("dragstart", (e) => {
    draggedTabId = id;
    lastDragOverId = null;
    btn.classList.add("is-dragging");
    container.classList.add("is-dragging-active");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  });
  btn.addEventListener("dragend", () => {
    draggedTabId = null;
    lastDragOverId = null;
    container.classList.remove("is-dragging-active");
    container.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("is-dragging"));
    saveTabState();
  });
  btn.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === id || lastDragOverId === id) return;
    lastDragOverId = id;

    const draggedEl = container.querySelector(`.tab-btn[data-tpl="${CSS.escape(draggedTabId)}"]`);
    if (!draggedEl) return;

    flipReorder(container, () => {
      const draggedRect = draggedEl.getBoundingClientRect();
      const targetRect = btn.getBoundingClientRect();
      const movingForward = draggedRect.top < targetRect.top ||
        (draggedRect.top === targetRect.top && draggedRect.left < targetRect.left);
      container.insertBefore(draggedEl, movingForward ? btn.nextSibling : btn);
      tabOrder = Array.from(container.querySelectorAll(".tab-btn"))
        .map((el) => el.dataset.tpl)
        .filter(Boolean);
    });
  });
  btn.addEventListener("drop", (e) => e.preventDefault());
}

function renderTabs() {
  const container = $("tabs");
  const q = reorderMode ? "" : getSearchQuery();
  const visible = reorderMode ? tabOrder : getVisibleTabOrder();

  $("clearSearchBtn").classList.toggle("hidden", !q);

  const tabsHTML = visible.map((id) =>
    `<button class="tab-btn${id === activeTpl ? " is-active" : ""}${isTabHidden(id) ? " is-hidden-tab" : ""}" data-tpl="${escAttr(id)}"${isTabHidden(id) ? ' title="Hidden from the dashboard (Settings \u2192 General \u2192 Tabs on the dashboard)"' : ' title="Right-click to hide this tab"'}>${escHtml(labelForTpl(id))}</button>`
  ).join("");

  const noResultsHTML = (!reorderMode && q && visible.length === 0)
    ? `<div class="no-results">No templates match "${escHtml($("tplSearch").value.trim())}"</div>`
    : "";

  const addBtnHTML = reorderMode
    ? ""
    : `<button class="tab-btn-add" id="addTplBtn" title="Add a new template or reference table">+</button>`;

  container.innerHTML = tabsHTML + noResultsHTML + addBtnHTML;
  container.classList.toggle("is-reordering", reorderMode);

  container.querySelectorAll(".tab-btn").forEach((btn) => {
    const id = btn.dataset.tpl;
    if (reorderMode) {
      attachReorderHandlers(container, btn, id);
    } else {
      btn.addEventListener("click", () => {
        activeTpl = btn.dataset.tpl;
        manageOptionsOpenField = null;
        renderTabs();
        renderActiveView();
      });
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!isTabHidden(id)) hideTabWithConfirm(id);
      });
    }
  });
  if (!reorderMode) $("addTplBtn").addEventListener("click", showAddTplRow);
  const act = container.querySelector(".tab-btn.is-active");
  if (act && !reorderMode) {
    // scroll only the tab block (not the page) so the open tab is visible inside it
    const cr = container.getBoundingClientRect(), ar = act.getBoundingClientRect();
    const top = ar.top - cr.top + container.scrollTop, bot = top + ar.height;
    if (top < container.scrollTop) container.scrollTop = top - 4;
    else if (bot > container.scrollTop + container.clientHeight) container.scrollTop = bot - container.clientHeight + 4;
  }
}

// Shows the right main view (fill-in template vs. reference table) for
// the active tab and keeps the header edit button's label in sync.
function renderActiveView() {
  if ($("pasteFromMenu")) closePasteFromMenu();
  if (typeof syncCasesLogToggle === "function") syncCasesLogToggle();
  const type = tabType(activeTpl);
  const editBtn = $("editToggleBtn");
  if (type === "reference") {
    $("fillView").classList.add("hidden");
    $("tableView").classList.remove("hidden");
    setHdrIcon(editBtn, "edit", "Edit this table's columns and rows");
    renderReferenceView();
  } else {
    $("tableView").classList.add("hidden");
    $("fillView").classList.remove("hidden");
    setHdrIcon(editBtn, "edit", "Edit this template's wording");
    renderFields();
  }
}

// ── Manual entry for dropdowns ─────────────────────────────────────────
// Every dropdown ends with a "Type manually…" choice for things that aren't in
// the list. The typed text goes into this note only (it isn't added to the
// list) unless "Add to list" is pressed. The choice is remembered per template
// as <name>__custom so the typed text isn't mistaken for a deleted option.
const CUSTOM_OPT = "__custom__";
function cssEsc(v) { return (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, "\\$&"); }
function isCustomSel(tplId, name) {
  return !!(values[tplId] && values[tplId][name + "__custom"] === true);
}
function customEntryHTML(name, label, val, cfg) {
  const addBtn = cfg && cfg.inlineManage
    ? `<button type="button" class="btn btn-ghost select-custom-add" data-custom-add="${escAttr(name)}" title="Save this to the dropdown list so it's always available">Add to list</button>`
    : "";
  return `<div class="select-custom-row">
        ${String(val || "").includes("\n")
          ? `<textarea class="select-custom-input" data-custom-field="${escAttr(name)}" rows="${Math.min(8, String(val).split("\n").length)}" placeholder="Type ${escAttr(String(label).toLowerCase())}…">${escHtml(val)}</textarea>`
          : `<input type="text" class="select-custom-input" data-custom-field="${escAttr(name)}" value="${escAttr(val)}" placeholder="Type ${escAttr(String(label).toLowerCase())}…" maxlength="200">`}
        ${addBtn}
      </div>`;
}

// -- Date / time / number / yes-no / counter / snippet helpers --
const NEW_TYPES = ["date", "datetime", "number", "yesno", "counter", "snippet"];
const DATE_FORMATS = {
  "d MMM yyyy": "19 Oct 2026",
  "dd/MM/yyyy": "19/10/2026",
  "MM/dd/yyyy": "10/19/2026",
  "yyyy-MM-dd": "2026-10-19",
  "dddd, d MMMM yyyy": "Monday, 19 October 2026"
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function pad2(n) { return String(n).padStart(2, "0"); }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function nowLocalISO() { const d = new Date(); return `${todayISO()}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function fmtDateISO(iso, fmt) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const y = +m[1], mo = +m[2], da = +m[3];
  const dow = new Date(y, mo - 1, da).getDay();
  return String(fmt || "d MMM yyyy").replace(/yyyy|MMMM|MMM|MM|dddd|dd|d/g, (t) => ({
    yyyy: String(y), MMMM: MONTHS[mo - 1], MMM: MONTHS[mo - 1].slice(0, 3), MM: pad2(mo),
    dddd: DAYS[dow], dd: pad2(da), d: String(da)
  }[t]));
}
function fmtTimeHM(h, mi, style) {
  if (style === "24h") return `${pad2(h)}:${pad2(mi)}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad2(mi)} ${h < 12 ? "AM" : "PM"}`;
}
function fmtDateTime(v, cfg) {
  const m = String(v || "").match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return "";
  const d = fmtDateISO(m[1], cfg && cfg.format);
  return m[2] === undefined ? d : `${d}, ${fmtTimeHM(+m[2], +m[3], cfg && cfg.time)}`;
}
function numberUnits(cfg) { return Array.isArray(cfg && cfg.units) ? cfg.units.filter(Boolean) : []; }
function numberUnitFor(tplId, name, cfg) {
  const units = numberUnits(cfg);
  const saved = valueForField(tplId, name + "__unit");
  return units.includes(saved) ? saved : (units[0] || "");
}
function numberOutput(tplId, name, cfg) {
  const raw = String(valueForField(tplId, name) == null ? "" : valueForField(tplId, name)).trim();
  if (!raw) return "";
  const unit = numberUnitFor(tplId, name, cfg);
  if (!unit) return raw;
  return /^[%\u00b0]/.test(unit) ? raw + unit : raw + " " + unit;
}
function snippetOptionText(name, id) {
  const o = normalizeOptions(getFieldConfig(name) || {}).find((x) => x.id === id);
  return o ? String(o.text || "") : "";
}
// A snippet may mention other placeholders on the same template, e.g. "Hi {name}, ..."; they are
// filled from those fields. A snippet naming itself (or two that name each other) is left as typed.
const SNIPPET_BUSY = new Set();
function snippetOutput(tplId, name, cfg) {
  const id = valueForField(tplId, name);
  const o = normalizeOptions(cfg).find((x) => x.id === id);
  if (!o) return "";
  let t = String(o.text || "");
  const me = String(name).toLowerCase();
  if (SNIPPET_BUSY.has(me)) return t;
  SNIPPET_BUSY.add(me);
  try {
    const onTpl = getPlaceholders(templates[tplId] || "");
    t = t.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, n) => {
      if (n.toLowerCase() === me) return m;
      const real = onTpl.find((p) => p.toLowerCase() === n.toLowerCase());
      return real ? (computeFieldOutput(tplId, real) || "_____") : m;
    });
  } finally { SNIPPET_BUSY.delete(me); }
  return t;
}

// Links: https://x.com/a?utm_source=email&id=5 -> tracking bits dropped, https:// added when missing.
const TRACKING_PARAM = /^(utm_[a-z0-9_]+|fbclid|gclid|msclkid|mc_cid|mc_eid|_hsenc|_hsmi|igshid|ref|ref_src)$/i;
function cleanUrlValue(raw) {
  const v = String(raw == null ? "" : raw).trim();
  if (!v || /\s/.test(v)) return v;
  const hasScheme = /^[a-z][a-z0-9+.\-]*:\/\//i.test(v);
  let u;
  try { u = new URL(hasScheme ? v : "https://" + v); } catch (e) { return v; }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return v;
  const drop = [...u.searchParams.keys()].filter((k) => TRACKING_PARAM.test(k));
  if (!drop.length) return hasScheme ? v.replace(/\/+$/, "") : "https://" + v.replace(/\/+$/, "");
  drop.forEach((k) => u.searchParams.delete(k));
  let s = u.toString();
  if (u.pathname === "/") s = s.replace(/^([^?#]*?)\/(?=$|[?#])/, "$1");
  return s;
}
// Likely typos in the domain of an email address.
const EMAIL_DOMAIN_FIXES = {
  "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmaill.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmail.co": "gmail.com", "gmail.con": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.con": "hotmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yhoo.com": "yahoo.com", "yahoo.con": "yahoo.com",
  "outlok.com": "outlook.com", "outloook.com": "outlook.com", "outlook.con": "outlook.com",
  "iclould.com": "icloud.com", "icloud.con": "icloud.com"
};
function emailTypoHint(e) {
  const s = String(e || "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  const fix = at > 0 ? EMAIL_DOMAIN_FIXES[s.slice(at + 1)] : "";
  return fix ? `Did you mean ${s.slice(0, at + 1)}${fix}?` : "";
}
// Recent values: what was typed in this field on your last few logged cases.
function recentValues(name) {
  const out = [];
  if (typeof cases === "undefined" || !Array.isArray(cases)) return out;
  for (let i = cases.length - 1; i >= 0 && out.length < 5; i--) {
    const v = (cases[i].vals || {})[name];
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t && !t.includes("\n") && !out.includes(t)) out.push(t);
  }
  return out;
}
function recentChipsHTML(name, cfg, current) {
  if (!(cfg && cfg.recent)) return "";
  const list = recentValues(name).filter((t) => t !== String(current || "").trim());
  if (!list.length) return "";
  return `<div class="recent-chips"><span class="recent-label">Recent</span>${list.map((t) =>
    `<button type="button" class="chip-btn" data-recent-field="${escAttr(name)}" data-recent-val="${escAttr(t)}" title="${escAttr(t)}">${escHtml(t.length > 26 ? t.slice(0, 25) + "\u2026" : t)}</button>`).join("")}</div>`;
}

// “Type it yourself” box for the other list-style fields (manualBox on):
//   toggle       -> a box beside the buttons; what's typed replaces the button's text (<name>__typed)
//   multiselect  -> a box under the checklist; each line is added as an extra item (<name>__other)
//   multiToggle  -> an “Other” row; each line is added as an extra line (<name>__other)
// Keys are lowercase so they match however the placeholder is written.
const MANUAL_TYPES = ["toggle", "multiselect", "multiToggle"];
function manualOn(name) {
  const c = getFieldConfig(name);
  return !!(c && c.manualBox && MANUAL_TYPES.includes(c.type));
}
function extraVal(tplId, name, suffix) {
  const bag = values[tplId];
  return bag ? String(bag[String(name).toLowerCase() + suffix] || "") : "";
}
function typedToggleValue(tplId, name) { return manualOn(name) ? extraVal(tplId, name, "__typed").trim() : ""; }
function otherLines(tplId, name) {
  if (!manualOn(name)) return [];
  return extraVal(tplId, name, "__other").split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
}
function setExtra(tplId, name, suffix, value) {
  if (!values[tplId]) values[tplId] = {};
  const k = String(name).toLowerCase() + suffix;
  if (value) values[tplId][k] = value; else delete values[tplId][k];
  saveValuesDebounced();
}
function isRowToggle(name) { return fieldType(name) === "toggle" && !manualOn(name); }
// Re-draw the form but keep the cursor in the box being typed in.
function rerenderKeepFocus(selector, pos) {
  renderFields();
  const again = $("fields").querySelector(selector);
  if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) {} }
}

// A dropdown with "manualBox" on shows a text box right next to it. Typing there
// replaces the dropdown choice for this note (same flag as "Type manually…");
// picking from the dropdown again clears the box.
function manualBoxHTML(name, label, val, cfg) {
  const typed = isCustomSel(activeTpl, name) ? String(val || "") : "";
  const ph = `or type ${escAttr(String(label).toLowerCase())}…`;
  const addBtn = cfg && cfg.inlineManage && typed
    ? `<button type="button" class="btn btn-ghost select-custom-add" data-custom-add="${escAttr(name)}" title="Save this to the dropdown list so it's always available">Add</button>`
    : "";
  const rows = Math.max(5, Math.min(12, typed.split("\n").length));
  const box = `<textarea class="select-custom-input select-manual-box" data-custom-field="${escAttr(name)}" data-manual-box="1" rows="${rows}" placeholder="${ph}">${escHtml(typed)}</textarea>`;
  return box + addBtn;
}

// A single-line box can't hold line breaks. When a list (several lines) is pasted
// into one, that field turns into a multi-line box for this template (until
// Clear fields) so the lines are kept; the note then shows one per line.
function isMultiText(tplId, name) {
  return !!(values[tplId] && values[tplId][name + "__multi"] === true);
}

// Renders a single field's markup (everything except toggle-only fields
// that are being grouped into a row by renderToggleRow instead).
// The small picture strip under a text box that has "Allow pasting images" on.
function renderAttachHTML(name, list) {
  const key = name + PASTE_IMG_SUFFIX;
  const imgs = Array.isArray(list) ? list : [];
  const thumbs = imgs.map((src, i) =>
    `<div class="img-thumb"><img src="${src}" alt="">
      <div class="img-thumb-actions">
        <button type="button" class="btn img-thumb-btn" data-img-copy="${escAttr(key)}" data-img-idx="${i}" title="Copy just this picture, to paste it separately">Copy image</button>
        <button type="button" class="ref-remove-btn" data-img-del="${escAttr(key)}" data-img-idx="${i}" title="Remove this image" aria-label="Remove image">\u2715</button>
      </div></div>`).join("");
  return `<div class="img-attach" data-img-attach="${escAttr(name)}">
    <div class="img-attach-bar"><span>Click the box above and press <b>Ctrl+V</b> to paste a screenshot, or</span>
      <button type="button" class="btn img-pick-btn" data-img-pick="${escAttr(key)}">Choose file</button></div>
    <input type="file" accept="image/*" multiple class="hidden" data-img-file="${escAttr(key)}">
    ${thumbs ? `<div class="img-thumbs">${thumbs}</div>` : ""}
  </div>`;
}

function renderFieldHTML(name, type, val) {
  const cfg = getFieldConfig(name);
  const label = labelForField(name);

  if (type === "dns") return renderDnsFieldHTML(name, cfg, val);
  if (type === "dnsDiff") return renderDnsDiffHTML(name, cfg);

  if (type === "prefixToggle") {
    const opts = normalizeOptions(cfg);
    const mode = getFieldMode(activeTpl, name, opts);
    const activeOpt = opts.find((o) => o.id === mode) || opts[0] || {};
    const toggleHTML = opts.map((o) =>
      `<button type="button" class="mini-toggle-btn${o.id === mode ? " is-active" : ""}" data-mode-field="${escAttr(name)}" data-mode-id="${escAttr(o.id)}">${escHtml(o.label || o.id)}</button>`
    ).join("");
    return `<div class="field">
      <label>${escHtml(label)}</label>
      <div class="mini-toggle">${toggleHTML}</div>
      ${isMultiText(activeTpl, name)
        ? `<textarea data-field="${escAttr(name)}" rows="${Math.min(8, Math.max(2, String(val || "").split("\n").length))}" placeholder="${escAttr(activeOpt.hint || "")}">${escHtml(val)}</textarea>`
        : `<input type="text" data-field="${escAttr(name)}" value="${escAttr(val)}" placeholder="${escAttr(activeOpt.hint || "")}">`}
      ${warnHTML(name, val)}
    </div>`;
  }
  if (type === "date" || type === "datetime") {
    const isDt = type === "datetime";
    return `<div class="field"><label>${escHtml(label)}</label><div class="inline-row">
      <input type="${isDt ? "datetime-local" : "date"}" data-field="${escAttr(name)}" value="${escAttr(typeof val === "string" ? val : "")}">
      <button type="button" class="btn" data-fill-now="${escAttr(name)}">${isDt ? "Now" : "Today"}</button></div></div>`;
  }
  if (type === "number") {
    const units = numberUnits(cfg);
    const cur = numberUnitFor(activeTpl, name, cfg);
    return `<div class="field"><label>${escHtml(label)}</label><div class="inline-row">
      <input type="text" inputmode="decimal" data-field="${escAttr(name)}" value="${escAttr(typeof val === "string" ? val : "")}" placeholder="0">
      ${units.length ? `<select data-unit-field="${escAttr(name)}">${units.map((u) => `<option value="${escAttr(u)}"${u === cur ? " selected" : ""}>${escHtml(u)}</option>`).join("")}</select>` : ""}</div></div>`;
  }
  if (type === "yesno") {
    return `<div class="field"><label class="yn-check"><input type="checkbox" data-yn-field="${escAttr(name)}"${val === true ? " checked" : ""}> <span>${escHtml(label)}</span></label></div>`;
  }
  if (type === "counter") {
    const start = cfg && cfg.start !== undefined && cfg.start !== "" ? cfg.start : 0;
    return `<div class="field"><label>${escHtml(label)}</label><div class="inline-row counter-row">
      <button type="button" class="btn" data-count="${escAttr(name)}" data-dir="-1" aria-label="Minus">\u2212</button>
      <input type="text" inputmode="numeric" data-field="${escAttr(name)}" value="${escAttr(typeof val === "string" || typeof val === "number" ? val : "")}" placeholder="${escAttr(start)}">
      <button type="button" class="btn" data-count="${escAttr(name)}" data-dir="1" aria-label="Plus">+</button></div></div>`;
  }
  if (type === "snippet") {
    const opts = normalizeOptions(cfg);
    const sel = typeof val === "string" ? val : "";
    return `<div class="field"><label>${escHtml(label)}</label>
      <select data-field="${escAttr(name)}"><option value="">\u2014</option>${opts.map((o) => `<option value="${escAttr(o.id)}"${o.id === sel ? " selected" : ""}>${escHtml(o.label || o.id)}</option>`).join("")}</select>
      <div class="snippet-preview">${escHtml(snippetOptionText(name, sel))}</div></div>`;
  }
  if (type === "image") {
    const imgs = Array.isArray(val) ? val : [];
    const thumbs = imgs.map((src, i) =>
      `<div class="img-thumb"><img src="${src}" alt="">
        <div class="img-thumb-actions">
          <button type="button" class="btn img-thumb-btn" data-img-copy="${escAttr(name)}" data-img-idx="${i}" title="Copy just this picture, to paste it separately">Copy image</button>
          <button type="button" class="ref-remove-btn" data-img-del="${escAttr(name)}" data-img-idx="${i}" title="Remove this image" aria-label="Remove image">\u2715</button>
        </div></div>`
    ).join("");
    return `<div class="field">
      <label>${escHtml(label)}</label>
      <div class="img-zone" tabindex="0" data-img-zone="${escAttr(name)}">
        <span>Click here and press <b>Ctrl+V</b> to paste a screenshot, drop one here, or</span>
        <button type="button" class="btn img-pick-btn" data-img-pick="${escAttr(name)}">Choose file</button>
      </div>
      <input type="file" accept="image/*" multiple class="hidden" data-img-file="${escAttr(name)}">
      ${thumbs ? `<div class="img-thumbs">${thumbs}</div>` : ""}
    </div>`;
  }
  if (type === "multiToggle") {
    const opts = normalizeOptions(cfg);
    const bag = (val && typeof val === "object" && !Array.isArray(val)) ? val : {};
    const on = (o) => Object.prototype.hasOwnProperty.call(bag, o.id);
    const toggleHTML = opts.map((o) =>
      `<button type="button" class="mini-toggle-btn${on(o) ? " is-active" : ""}" aria-pressed="${on(o)}" data-mt-field="${escAttr(name)}" data-mt-id="${escAttr(o.id)}">${escHtml(o.label || o.id)}</button>`
    ).join("");
    const inputsHTML = opts.filter(on).map((o) => {
      const v = String(bag[o.id] || "");
      const box = v.includes("\n")
        ? `<textarea data-mt-input="${escAttr(name)}" data-mt-id="${escAttr(o.id)}" rows="${Math.min(8, v.split("\n").length)}" placeholder="${escAttr(o.hint || "")}">${escHtml(v)}</textarea>`
        : `<input type="text" data-mt-input="${escAttr(name)}" data-mt-id="${escAttr(o.id)}" value="${escAttr(v)}" placeholder="${escAttr(o.hint || "")}">`;
      return `<div class="mt-row"><span class="mt-label">${escHtml(o.label || o.id)}</span>${box}</div>`;
    }).join("");
    const otherTyped = manualOn(name) ? extraVal(activeTpl, name, "__other") : "";
    const otherRow = manualOn(name)
      ? `<div class="mt-row"><span class="mt-label">Other</span><textarea data-other-field="${escAttr(name.toLowerCase())}" data-other-name="${escAttr(name)}" rows="${Math.max(1, Math.min(6, otherTyped.split("\n").length))}" placeholder="or type another line\u2026">${escHtml(otherTyped)}</textarea></div>`
      : "";
    return `<div class="field">
      <label>${escHtml(label)}</label>
      <div class="mini-toggle mini-toggle-multi">${toggleHTML}</div>
      ${(inputsHTML || otherRow) ? `<div class="mt-rows">${inputsHTML}${otherRow}</div>` : ""}
    </div>`;
  }
  if (type === "toggle") {
    const key = name.toLowerCase();
    const opts = normalizeOptions(cfg);
    const mode = getFieldMode(activeTpl, key, opts);
    const typed = manualOn(name) ? extraVal(activeTpl, name, "__typed") : "";
    const picked = typed.trim() ? null : mode; // typing something un-highlights the buttons
    const toggleHTML = opts.map((o) =>
      `<button type="button" class="mini-toggle-btn${o.id === picked ? " is-active" : ""}" data-mode-field="${escAttr(key)}" data-mode-id="${escAttr(o.id)}">${escHtml(o.label || o.text || o.id)}</button>`
    ).join("");
    if (manualOn(name)) {
      return `<div class="field">
      <label>${escHtml(label)}</label>
      <div class="toggle-manual-row">
        <div class="mini-toggle">${toggleHTML}</div>
        <textarea class="toggle-typed-box" data-typed-field="${escAttr(key)}" rows="${Math.max(1, Math.min(6, typed.split("\n").length))}" placeholder="or type ${escAttr(String(label).toLowerCase())}\u2026">${escHtml(typed)}</textarea>
      </div>
    </div>`;
    }
    return `<div class="field">
      <label>${escHtml(label)}</label>
      <div class="mini-toggle">${toggleHTML}</div>
    </div>`;
  }
  if (type === "auto") {
    const computed = computeFieldOutput(activeTpl, name);
    return `<div class="field">
      <label>${escHtml(label)} <span class="auto-badge">Auto</span></label>
      <input type="text" value="${escAttr(computed)}" disabled>
    </div>`;
  }
  if (type === "select" && isGroupedField(name)) {
    const groups = getOptionGroups(name);
    const cat = getSelectedCategory(activeTpl, name, val);
    const active = groups.find((g) => g.group === cat);
    const catHTML = ['<option value="">Category…</option>']
      .concat(groups.map((g) => `<option value="${escAttr(g.group)}"${g.group === cat ? " selected" : ""}>${escHtml(g.group)}</option>`))
      .join("");
    const boxMode = !!(cfg && cfg.manualBox);
    const custom = boxMode ? isCustomSel(activeTpl, name) : (!!active && isCustomSel(activeTpl, name));
    const issueHTML = [`<option value="">${active ? "Select an option…" : "Pick a category first"}</option>`]
      .concat(active ? active.items.map((i) => `<option value="${escAttr(i.text)}"${(!custom && i.text === val) ? " selected" : ""}>${escHtml(i.text)}</option>`) : [])
      .concat((active && !boxMode) ? [`<option value="${CUSTOM_OPT}"${custom ? " selected" : ""}>\u270E Type manually\u2026</option>`] : [])
      .join("");
    const isOpen = manageOptionsOpenField === name;
    const manageHTML = cfg && cfg.inlineManage
      ? `<button type="button" class="manage-options-toggle-btn" data-toggle-manage="${escAttr(name)}">${isOpen ? "Done" : "Manage list"}</button>`
      : "";
    return `<div class="field">
      <div class="field-label-row"><label>${escHtml(label)}</label>${manageHTML}</div>
      <select class="cat-select" data-cat-field="${escAttr(name)}">${catHTML}</select>
      ${boxMode
        ? `<div class="select-manual-row"><select data-field="${escAttr(name)}"${active ? "" : " disabled"}>${issueHTML}</select>${manualBoxHTML(name, label, val, cfg)}</div>`
        : `<select data-field="${escAttr(name)}"${active ? "" : " disabled"}>${issueHTML}</select>
      ${custom ? customEntryHTML(name, label, val, cfg) : ""}`}
      ${(isOpen && manageHTML) ? renderManageOptionsPanel(name, label) : ""}
    </div>`;
  }
  if (type === "select") {
    const opts = getManagedOptions(name);
    const custom = isCustomSel(activeTpl, name);
    const optionsHTML = ['<option value="">—</option>']
      .concat(opts.map((o) => `<option value="${escAttr(o)}"${(!custom && o === val) ? " selected" : ""}>${escHtml(o)}</option>`))
      .concat((cfg && cfg.manualBox) ? [] : [`<option value="${CUSTOM_OPT}"${custom ? " selected" : ""}>\u270E Type manually\u2026</option>`])
      .join("");
    const isOpen = manageOptionsOpenField === name;
    const manageHTML = cfg && cfg.inlineManage
      ? `<button type="button" class="manage-options-toggle-btn" data-toggle-manage="${escAttr(name)}">${isOpen ? "Done" : "Manage list"}</button>`
      : "";
    return `<div class="field">
      <div class="field-label-row"><label>${escHtml(label)}</label>${manageHTML}</div>
      ${(cfg && cfg.manualBox)
        ? `<div class="select-manual-row"><select data-field="${escAttr(name)}">${optionsHTML}</select>${manualBoxHTML(name, label, val, cfg)}</div>`
        : `<select data-field="${escAttr(name)}">${optionsHTML}</select>
      ${custom ? customEntryHTML(name, label, val, cfg) : ""}`}
      ${(isOpen && manageHTML) ? renderManageOptionsPanel(name, label) : ""}
    </div>`;
  }
  if (type === "multiselect") {
    const vis = getVisibleMultiOptions(activeTpl, name);
    const opts = vis.items;
    const selected = Array.isArray(val) ? val : [];
    let itemsHTML = opts.map((o) =>
      `<label class="multi-check-row"><input type="checkbox" data-multi-field="${escAttr(name)}" data-multi-value="${escAttr(o)}"${selected.includes(o) ? " checked" : ""}> ${escHtml(o)}</label>`
    ).join("");
    if (vis.filtered && !vis.cat) {
      itemsHTML += `<div class="edit-hint">Pick a category under \u201c${escHtml(vis.srcLabel)}\u201d to see its steps.</div>`;
    } else if (!opts.length) {
      itemsHTML = `<div class="edit-hint">${vis.filtered ? "Nothing for this category yet \u2014 add some with Manage list." : "No options yet \u2014 add some below."}</div>`;
    }
    const isOpen = manageOptionsOpenField === name;
    const manageHTML = cfg && cfg.inlineManage
      ? `<button type="button" class="manage-options-toggle-btn" data-toggle-manage="${escAttr(name)}">${isOpen ? "Done" : "Manage list"}</button>`
      : "";
    let otherHTML = "";
    if (manualOn(name)) {
      const typed = extraVal(activeTpl, name, "__other");
      const addBtn = (cfg && cfg.inlineManage && typed.trim())
        ? `<button type="button" class="btn btn-ghost select-custom-add" data-other-add="${escAttr(name.toLowerCase())}" title="Save these to the checklist so they're always available">Add to list</button>`
        : "";
      otherHTML = `<div class="multi-other-row">
        <textarea class="select-custom-input multi-other-box" data-other-field="${escAttr(name.toLowerCase())}" data-other-name="${escAttr(name)}" rows="${Math.max(2, Math.min(8, typed.split("\n").length))}" placeholder="or type another ${escAttr(String(label).toLowerCase())} (one per line)\u2026">${escHtml(typed)}</textarea>${addBtn}
      </div>`;
    }
    return `<div class="field">
      <div class="field-label-row"><label>${escHtml(label)}</label>${manageHTML}</div>
      <div class="multi-check-list">${itemsHTML}</div>
      ${otherHTML}
      ${(isOpen && manageHTML) ? renderManageOptionsPanel(name, label) : ""}
    </div>`;
  }
  if (type === "textarea" || (type === "text" && isMultiText(activeTpl, name))) {
    return `<div class="field"><label>${escHtml(label)}</label><textarea data-field="${escAttr(name)}" rows="${Math.min(8, Math.max(2, String(val || "").split("\n").length))}" placeholder="${escAttr((cfg && cfg.placeholder) || "")}">${escHtml(val)}</textarea>${warnHTML(name, val)}${recentChipsHTML(name, cfg, val)}</div>`;
  }
  return `<div class="field"><label>${escHtml(label)}</label><input type="text" data-field="${escAttr(name)}" value="${escAttr(val)}" placeholder="${escAttr((cfg && cfg.placeholder) || "")}">${warnHTML(name, val)}${recentChipsHTML(name, cfg, val)}</div>`;
}

// Groups 2+ toggle-only fields (e.g. Protocol + Security Type) into one
// side-by-side row instead of stacking them as full-width fields.
function renderToggleRow(names) {
  const itemsHTML = names.map((name) => {
    const key = name.toLowerCase();
    const cfg = getFieldConfig(key);
    const opts = normalizeOptions(cfg);
    const mode = getFieldMode(activeTpl, key, opts);
    const toggleHTML = opts.map((o) =>
      `<button type="button" class="mini-toggle-btn${o.id === mode ? " is-active" : ""}" data-mode-field="${escAttr(key)}" data-mode-id="${escAttr(o.id)}">${escHtml(o.label || o.text || o.id)}</button>`
    ).join("");
    return `<div class="field field-row-item">
      <label>${escHtml(labelForField(key))}</label>
      <div class="mini-toggle">${toggleHTML}</div>
    </div>`;
  }).join("");
  return `<div class="field-row">${itemsHTML}</div>`;
}

function renderFields() {
  const container = $("fields");
  const text = templates[activeTpl] || "";
  const fields = getPlaceholders(text).filter((n) => isFieldVisible(activeTpl, n));
  const tplValues = values[activeTpl] || (values[activeTpl] = {});

  // Toggle-only fields (protocol, security, ...) get shown together as one
  // row instead of each taking a full-width line, so e.g. Protocol and
  // Security Type sit side by side no matter where {security} falls in
  // the template text.
  const groupToggles = appSettings.groupToggles === true; // off by default: every field stays in template order
  const toggleNames = fields.filter((name) => isRowToggle(name));
  const firstToggleIndex = fields.findIndex((name) => isRowToggle(name));

  const htmlParts = [];
  fields.forEach((name, i) => {
    const type = fieldType(name);
    // If a dropdown option was renamed or deleted in Settings, drop the
    // now-dangling saved value instead of leaving it stuck in the note.
    if (type === "select" && tplValues[name] && !tplValues[name + "__custom"] && !getManagedOptions(name).includes(tplValues[name])) {
      tplValues[name] = "";
      saveValuesDebounced();
    }
    // {oldDns} / {newDns} used to be plain text. Whatever was typed there is
    // turned into rows if it can be read as records; anything else is dropped.
    if (type === "dns" && !Array.isArray(tplValues[name]) && tplValues[name] !== undefined) {
      tplValues[name] = (typeof tplValues[name] === "string" && tplValues[name].trim()) ? parseDnsText(tplValues[name]).rows : [];
      saveValuesDebounced();
    }
    if (type === "image" && tplValues[name] !== undefined && !Array.isArray(tplValues[name])) tplValues[name] = [];
    if (type === "multiToggle" && tplValues[name] && typeof tplValues[name] === "object" && !Array.isArray(tplValues[name])) {
      // Forget buttons that were deleted in Settings.
      const ids = normalizeOptions(getFieldConfig(name)).map((o) => o.id);
      Object.keys(tplValues[name]).forEach((k) => { if (!ids.includes(k)) delete tplValues[name][k]; });
      const off = tplValues[name + "__off"];
      if (off && typeof off === "object") {
        Object.keys(off).forEach((k) => { if (!ids.includes(k)) delete off[k]; });
        if (!Object.keys(off).length) delete tplValues[name + "__off"];
      }
    }
    if (type === "multiselect" && Array.isArray(tplValues[name])) {
      // Drop ticks for items that were deleted. Items merely hidden because
      // another category is showing keep their tick (computeFieldOutput leaves
      // them out of the note while they're hidden).
      const managed = getManagedOptions(name);
      const kept = tplValues[name].filter((v) => managed.includes(v));
      if (kept.length !== tplValues[name].length) {
        tplValues[name] = kept;
        saveValuesDebounced();
      }
    }
    if (groupToggles && isRowToggle(name) && toggleNames.length >= 2) {
      if (i !== firstToggleIndex) return; // already rendered as part of the row below
      htmlParts.push(renderToggleRow(toggleNames));
      return;
    }
    htmlParts.push(renderFieldHTML(name, type, tplValues[name] || "") + (fieldAllowsImages(name) && ((getFieldConfig(name) || {}).pasteImages || attachedImages(activeTpl, name).length) ? renderAttachHTML(name, tplValues[name + PASTE_IMG_SUFFIX]) : ""));
  });

  container.innerHTML = htmlParts.join("") || `<div class="edit-hint">This template has no {placeholders} yet. Use "Edit template" to add some.</div>`;

  container.querySelectorAll("[data-field]").forEach((el) => {
    el.addEventListener("input", onFieldChange);
    el.addEventListener("change", onFieldChange);
  });
  container.querySelectorAll('input[type="text"][data-field]').forEach((inp) => {
    inp.addEventListener("paste", (e) => {
      const name = inp.dataset.field;
      const ft = fieldType(name);
      if (ft !== "prefixToggle" && ft !== "text") return;
      const pasted = ((e.clipboardData && e.clipboardData.getData("text/plain")) || "").replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
      if (!pasted.includes("\n")) return; // one line: the normal paste is fine
      e.preventDefault();
      const cur = inp.value;
      const a = inp.selectionStart == null ? cur.length : inp.selectionStart;
      const z = inp.selectionEnd == null ? cur.length : inp.selectionEnd;
      const next = cur.slice(0, a) + pasted + cur.slice(z);
      const caret = a + pasted.length;
      tplValues[name] = next;
      tplValues[name + "__multi"] = true;
      saveValuesDebounced();
      renderFields();
      const box = $("fields").querySelector(`textarea[data-field="${cssEsc(name)}"]`);
      if (box) { box.focus(); try { box.setSelectionRange(caret, caret); } catch (err) {} }
    });
  });
  container.querySelectorAll('input[data-custom-field]').forEach((inp) => {
    inp.addEventListener("paste", (e) => {
      const name = inp.dataset.customField;
      const pasted = ((e.clipboardData && e.clipboardData.getData("text/plain")) || "").replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
      if (!pasted.includes("\n")) return;
      e.preventDefault();
      const cur = inp.value;
      const a = inp.selectionStart == null ? cur.length : inp.selectionStart;
      const z = inp.selectionEnd == null ? cur.length : inp.selectionEnd;
      values[activeTpl][name] = cur.slice(0, a) + pasted + cur.slice(z);
      const caret = a + pasted.length;
      saveValuesDebounced();
      renderFields();
      const box = $("fields").querySelector(`[data-custom-field="${cssEsc(name)}"]`);
      if (box) { box.focus(); try { box.setSelectionRange(caret, caret); } catch (err) {} }
    });
  });
  container.querySelectorAll("[data-custom-field]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const name = inp.dataset.customField;
      values[activeTpl][name] = inp.value;
      if (inp.dataset.manualBox) {
        // Text box beside the dropdown: typing overrides the dropdown choice.
        if (inp.value !== "") values[activeTpl][name + "__custom"] = true;
        else delete values[activeTpl][name + "__custom"];
        const sel = inp.closest(".select-manual-row") && inp.closest(".select-manual-row").querySelector("select[data-field]");
        if (sel && inp.value !== "") sel.value = "";
      }
      saveValuesDebounced();
      if (hasDependents(name)) {
        const pos = inp.selectionStart;
        renderFields();
        const again = $("fields").querySelector(`[data-custom-field="${cssEsc(name)}"]`);
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) {} }
        return;
      }
      renderPreview();
    });
  });
  container.querySelectorAll("[data-fill-now]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.fillNow;
      values[activeTpl][name] = fieldType(name) === "datetime" ? nowLocalISO() : todayISO();
      saveValuesDebounced();
      if (hasDependents(name)) { renderFields(); return; }
      const inp = container.querySelector(`[data-field="${cssEsc(name)}"]`);
      if (inp) inp.value = values[activeTpl][name];
      renderPreview();
    });
  });
  container.querySelectorAll("[data-unit-field]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const name = sel.dataset.unitField;
      values[activeTpl][name + "__unit"] = sel.value;
      saveValuesDebounced();
      if (hasDependents(name)) renderFields(); else renderPreview();
    });
  });
  container.querySelectorAll("[data-yn-field]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const name = cb.dataset.ynField;
      if (cb.checked) values[activeTpl][name] = true; else delete values[activeTpl][name];
      saveValuesDebounced();
      if (hasDependents(name)) renderFields(); else renderPreview();
    });
  });
  container.querySelectorAll("[data-count]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.count;
      const cfg = getFieldConfig(name) || {};
      const step = Number(cfg.step) || 1;
      const start = Number(cfg.start) || 0;
      let cur = parseFloat(values[activeTpl][name]);
      if (isNaN(cur)) cur = start;
      let next = cur + Number(btn.dataset.dir) * step;
      if (cfg.min !== undefined && cfg.min !== "" && next < Number(cfg.min)) next = Number(cfg.min);
      next = Math.round(next * 1e6) / 1e6;
      values[activeTpl][name] = String(next);
      saveValuesDebounced();
      if (hasDependents(name)) { renderFields(); return; }
      const inp = container.querySelector(`[data-field="${cssEsc(name)}"]`);
      if (inp) inp.value = String(next);
      renderPreview();
    });
  });
  container.querySelectorAll("[data-recent-field]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.recentField;
      values[activeTpl][name] = btn.dataset.recentVal;
      saveValuesDebounced();
      renderFields();
    });
  });
  // Box beside a toggle's buttons: typing replaces the buttons' choice for this note.
  container.querySelectorAll("[data-typed-field]").forEach((box) => {
    box.addEventListener("input", () => {
      const key = box.dataset.typedField;
      const was = !!extraVal(activeTpl, key, "__typed").trim();
      setExtra(activeTpl, key, "__typed", box.value);
      const now = !!box.value.trim();
      if (was !== now || hasDependents(key)) {
        rerenderKeepFocus(`[data-typed-field="${cssEsc(key)}"]`, box.selectionStart);
      } else renderPreview();
    });
  });
  // \u201cOther\u201d box under a checklist / multi-toggle: each line is one extra item in the note.
  container.querySelectorAll("[data-other-field]").forEach((box) => {
    box.addEventListener("input", () => {
      const key = box.dataset.otherField;
      const wasAdd = !!extraVal(activeTpl, key, "__other").trim();
      setExtra(activeTpl, key, "__other", box.value);
      const nowAdd = !!box.value.trim();
      const hasAddBtn = fieldType(key) === "multiselect";
      if (hasDependents(key) || (hasAddBtn && wasAdd !== nowAdd)) {
        rerenderKeepFocus(`[data-other-field="${cssEsc(key)}"]`, box.selectionStart);
      } else renderPreview();
    });
  });
  // \u201cAdd to list\u201d: saves the typed checklist lines permanently, ticked for this note.
  container.querySelectorAll("[data-other-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.otherAdd;
      const lines = extraVal(activeTpl, key, "__other").split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
      if (!lines.length) { showToast("Type something first"); return; }
      const opts = getManagedOptions(key);
      const cat = multiFilterKey(key) ? getVisibleMultiOptions(activeTpl, key).cat : "";
      const newGroups = {};
      const ticks = Array.isArray(values[activeTpl][key]) ? values[activeTpl][key] : (values[activeTpl][key] = []);
      let added = 0;
      lines.forEach((line) => {
        let hit = opts.find((o) => o.toLowerCase() === line.toLowerCase());
        if (!hit) { if ((getFieldConfig(key) || {}).listOrder === "newtop") opts.unshift(line); else opts.push(line); hit = line; added++; if (cat) newGroups[line] = [cat]; }
        if (!ticks.includes(hit)) ticks.push(hit);
      });
      setManagedOptions(key, opts, newGroups);
      setExtra(activeTpl, key, "__other", "");
      showToast(added ? `Added ${added} to the list` : "Already in the list");
      renderFields();
    });
  });
  container.querySelectorAll("[data-custom-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.customAdd;
      const typed = String(values[activeTpl][name] || "").trim();
      if (!typed) { showToast("Type something first"); return; }
      const existing = getManagedOptions(name).find((o) => o.toLowerCase() === typed.toLowerCase());
      delete values[activeTpl][name + "__custom"];
      if (existing) {
        values[activeTpl][name] = existing; // already listed: just select it
        saveValuesDebounced();
        showToast("Already in the list");
        renderFields();
        return;
      }
      values[activeTpl][name] = typed;
      saveValuesDebounced();
      const grouped = isGroupedField(name);
      commitNewManagedOption(name, typed, grouped ? getSelectedCategory(activeTpl, name, "") : "");
      showToast("Added to the list");
    });
  });
  container.querySelectorAll("[data-cat-field]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const name = sel.dataset.catField;
      tplValues[name + "__cat"] = sel.value;
      // Switching category drops an issue that belongs to a different one.
      if (tplValues[name] && !tplValues[name + "__custom"] && groupOfOption(name, tplValues[name]) !== sel.value) tplValues[name] = "";
      saveValuesDebounced();
      renderFields();
    });
  });
  container.querySelectorAll("[data-mode-field]").forEach((btn) => {
    btn.addEventListener("click", () => {
      // Picking a button goes back to the list: whatever was typed beside it is dropped.
      setExtra(activeTpl, btn.dataset.modeField, "__typed", "");
      const mcfg = getFieldConfig(btn.dataset.modeField);
      if (mcfg && mcfg.type === "toggle" && mcfg.noDefault && btn.classList.contains("is-active")) {
        // Clicking the lit button again turns it off: nothing is written for this field.
        if (fieldModes[activeTpl]) delete fieldModes[activeTpl][btn.dataset.modeField];
        saveFieldModesDebounced();
      } else {
        setFieldMode(activeTpl, btn.dataset.modeField, btn.dataset.modeId);
      }
      renderFields(); // re-highlight the active mode, update the placeholder, refresh preview
    });
  });
  container.querySelectorAll("[data-img-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = container.querySelector(`[data-img-file="${cssEsc(btn.dataset.imgPick)}"]`);
      if (f) f.click();
    });
  });
  container.querySelectorAll("[data-img-file]").forEach((inp) => {
    inp.addEventListener("change", () => { addImagesToField(inp.dataset.imgFile, inp.files); inp.value = ""; });
  });
  container.querySelectorAll("[data-img-zone]").forEach((zone) => {
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("is-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("is-over");
      addImagesToField(zone.dataset.imgZone, e.dataTransfer.files);
    });
  });
  container.querySelectorAll("[data-img-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const arr = tplValues[btn.dataset.imgDel];
      if (Array.isArray(arr)) arr.splice(Number(btn.dataset.imgIdx), 1);
      saveValuesDebounced();
      renderFields();
    });
  });
  container.querySelectorAll("[data-img-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const arr = tplValues[btn.dataset.imgCopy] || [];
      const src = arr[Number(btn.dataset.imgIdx)];
      if (src) copyImageToClipboard(src);
    });
  });
  container.querySelectorAll("[data-mt-field]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.mtField;
      const id = btn.dataset.mtId;
      let bag = tplValues[name];
      if (!bag || typeof bag !== "object" || Array.isArray(bag)) bag = tplValues[name] = {};
      // Switching a button off keeps what was typed in it (in <name>__off); switching it
      // back on brings that text back instead of an empty box.
      const keep = (tplValues[name + "__off"] && typeof tplValues[name + "__off"] === "object") ? tplValues[name + "__off"] : (tplValues[name + "__off"] = {});
      if (Object.prototype.hasOwnProperty.call(bag, id)) {
        if (String(bag[id] || "").trim()) keep[id] = bag[id]; else delete keep[id];
        delete bag[id];
        if (!Object.keys(keep).length) delete tplValues[name + "__off"];
      } else {
        bag[id] = Object.prototype.hasOwnProperty.call(keep, id) ? keep[id] : "";
        delete keep[id];
        if (!Object.keys(keep).length) delete tplValues[name + "__off"];
      }
      saveValuesDebounced();
      renderFields();
      if (!Object.prototype.hasOwnProperty.call(bag, id)) return;
      const box = $("fields").querySelector(`[data-mt-input="${cssEsc(name)}"][data-mt-id="${cssEsc(id)}"]`);
      if (box) box.focus(); // switched on: ready to type its value
    });
  });
  container.querySelectorAll('input[data-mt-input]').forEach((inp) => {
    inp.addEventListener("paste", (e) => {
      const name = inp.dataset.mtInput;
      const id = inp.dataset.mtId;
      const pasted = ((e.clipboardData && e.clipboardData.getData("text/plain")) || "").replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
      const bag = tplValues[name];
      if (!pasted.includes("\n") || !bag || typeof bag !== "object") return;
      e.preventDefault();
      const cur = inp.value;
      const a = inp.selectionStart == null ? cur.length : inp.selectionStart;
      const z = inp.selectionEnd == null ? cur.length : inp.selectionEnd;
      bag[id] = cur.slice(0, a) + pasted + cur.slice(z);
      const caret = a + pasted.length;
      saveValuesDebounced();
      renderFields(); // a value with line breaks is drawn as a multi-line box
      const box = $("fields").querySelector(`[data-mt-input="${cssEsc(name)}"][data-mt-id="${cssEsc(id)}"]`);
      if (box) { box.focus(); try { box.setSelectionRange(caret, caret); } catch (err) {} }
    });
  });
  container.querySelectorAll("[data-mt-input]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const name = inp.dataset.mtInput;
      const bag = tplValues[name];
      if (!bag || typeof bag !== "object") return;
      bag[inp.dataset.mtId] = inp.value;
      saveValuesDebounced();
      renderPreview();
    });
  });
  // Shift+Enter in a single-line box adds a new line: the box turns into a
  // multi-line one (same as pasting a list does) with the caret on the new line.
  container.querySelectorAll('input[type="text"][data-mt-input], input[type="text"][data-field], input[data-custom-field]').forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      const cur = inp.value;
      const a = inp.selectionStart == null ? cur.length : inp.selectionStart;
      const z = inp.selectionEnd == null ? cur.length : inp.selectionEnd;
      const next = cur.slice(0, a) + "\n" + cur.slice(z);
      const caret = a + 1;
      let sel;
      if (inp.dataset.mtInput) {
        const name = inp.dataset.mtInput;
        const bag = tplValues[name];
        if (!bag || typeof bag !== "object") return;
        e.preventDefault();
        bag[inp.dataset.mtId] = next;
        sel = `[data-mt-input="${cssEsc(name)}"][data-mt-id="${cssEsc(inp.dataset.mtId)}"]`;
      } else if (inp.dataset.customField) {
        const name = inp.dataset.customField;
        e.preventDefault();
        values[activeTpl][name] = next;
        if (inp.dataset.manualBox) values[activeTpl][name + "__custom"] = true;
        sel = `[data-custom-field="${cssEsc(name)}"]`;
      } else {
        const name = inp.dataset.field;
        const ft = fieldType(name);
        if (ft !== "prefixToggle" && ft !== "text") return;
        e.preventDefault();
        tplValues[name] = next;
        tplValues[name + "__multi"] = true;
        sel = `textarea[data-field="${cssEsc(name)}"]`;
      }
      saveValuesDebounced();
      renderFields();
      const box = $("fields").querySelector(sel);
      if (box) { box.focus(); try { box.setSelectionRange(caret, caret); } catch (err) {} }
    });
  });
  container.querySelectorAll("[data-multi-field]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const name = e.target.dataset.multiField;
      const val = e.target.dataset.multiValue;
      const arr = Array.isArray(tplValues[name]) ? tplValues[name] : (tplValues[name] = []);
      const idx = arr.indexOf(val);
      if (e.target.checked) { if (idx === -1) arr.push(val); }
      else if (idx !== -1) { arr.splice(idx, 1); }
      saveValuesDebounced();
      if (hasDependents(name)) renderFields(); else renderPreview();
    });
  });

  container.querySelectorAll("[data-toggle-manage]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.toggleManage;
      manageOptionsOpenField = (manageOptionsOpenField === name) ? null : name;
      renderFields();
    });
  });
  container.querySelectorAll("[data-remove-option]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.closest("[data-manage-panel]");
      const name = panel.dataset.managePanel;
      const opts = getManagedOptions(name);
      const idx = Number(btn.dataset.removeOption);
      const removed = opts[idx];
      opts.splice(idx, 1);
      setManagedOptions(name, opts);
      // If the option being removed is the one currently selected for this
      // template, clear the selection rather than leave a dangling value.
      if (values[activeTpl] && Array.isArray(values[activeTpl][name])) {
        const vi = values[activeTpl][name].indexOf(removed);
        if (vi !== -1) { values[activeTpl][name].splice(vi, 1); saveValuesDebounced(); }
      } else if (values[activeTpl] && values[activeTpl][name] === removed) {
        values[activeTpl][name] = "";
        saveValuesDebounced();
      }
      renderFields();
    });
  });
  // Category dropdown in the Manage panel: choosing "New category…" reveals a
  // small text box to type the name into.
  container.querySelectorAll("select[data-add-option-group]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const box = sel.parentElement.querySelector("[data-new-cat]");
      if (!box) return;
      box.classList.toggle("hidden", sel.value !== "__new__");
      if (sel.value === "__new__") box.focus();
    });
  });
  // Category the new option should go under: null = a new category was
  // requested but not named yet; "" = none (shows everywhere / "Other").
  const readAddGroup = (el) => {
    const panel = el.closest("[data-manage-panel]");
    if (!panel) return "";
    const sel = panel.querySelector("select[data-add-option-group]");
    if (sel) {
      if (sel.value !== "__new__") return sel.value;
      const typed = (panel.querySelector("[data-new-cat]").value || "").trim();
      return typed || null;
    }
    return [...panel.querySelectorAll("input[data-add-group-chip]:checked")].map((c) => c.value);
  };
  const submitAdd = (el, name, raw) => {
    const group = readAddGroup(el);
    if (group === null) { showToast("Type a name for the new category"); return; }
    commitNewManagedOption(name, raw, group);
  };
  container.querySelectorAll("[data-add-option-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("[data-add-option-field]");
      submitAdd(btn, btn.dataset.addOptionBtn, input.value);
    });
  });
  container.querySelectorAll("[data-add-option-field]").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submitAdd(input, input.dataset.addOptionField, input.value); }
    });
  });
  container.querySelectorAll("[data-close-manage]").forEach((btn) => {
    btn.addEventListener("click", () => { manageOptionsOpenField = null; renderFields(); });
  });
  wireDnsFields(container);

  renderPreview();
}

// Inline panel (shown under a managedSelect field's dropdown) for adding
// or deleting the field's own dropdown options — e.g. the list of teams
// for {department}. Re-rendered every time renderFields() runs.
function renderManageOptionsPanel(name, label) {
  const opts = getManagedOptions(name);
  const grouped = isGroupedField(name);
  const fkey = multiFilterKey(name);
  const rawOpts = (getFieldConfig(name) || {}).options || [];
  const rowHTML = (text, i) => {
    const tag = fkey ? (splitGroups((rawOpts[i] || {}).group).join(", ") || "all categories") : "";
    return `<div class="manage-options-row">
          <span class="manage-options-text">${escHtml(text)}${tag ? ` <span class="manage-opt-tag">${escHtml(tag)}</span>` : ""}</span>
          <button type="button" class="ref-remove-btn" data-remove-option="${i}" title="Remove">✕</button>
        </div>`;
  };
  let rowsHTML;
  if (!opts.length) {
    rowsHTML = `<div class="edit-hint">No options yet — add one below.</div>`;
  } else if (grouped) {
    rowsHTML = getOptionGroups(name).map((g) =>
      `<div class="manage-group-title">${escHtml(g.group)}</div>` + g.items.map((it) => rowHTML(it.text, it.index)).join("")
    ).join("");
  } else {
    rowsHTML = opts.map((o, i) => rowHTML(o, i)).join("");
  }

  // Where the new option goes. Grouped dropdown ({issue}): a real dropdown of
  // the existing categories plus "New category…". Checklist that follows a
  // category ({troubleshootingSteps}): tick-boxes, none ticked = every category.
  let groupInputHTML = "";
  if (grouped) {
    const cur = getSelectedCategory(activeTpl, name, (values[activeTpl] && values[activeTpl][name]) || "");
    const cats = getOptionGroups(name).map((g) => g.group);
    groupInputHTML = `<div class="manage-group-pick">
      <div class="manage-group-label">Category</div>
      <select class="manage-group-select" data-add-option-group="${escAttr(name)}">
        ${cats.map((c) => `<option value="${escAttr(c)}"${c === cur ? " selected" : ""}>${escHtml(c)}</option>`).join("")}
        <option value="__new__"${cats.length ? "" : " selected"}>\uFF0B New category\u2026</option>
      </select>
      <input type="text" class="manage-options-input manage-newcat-input${cats.length ? " hidden" : ""}" data-new-cat="${escAttr(name)}" placeholder="New category name" maxlength="40">
    </div>`;
  } else if (fkey) {
    const cur = getVisibleMultiOptions(activeTpl, name).cat;
    const cats = getOptionGroups(fkey).map((g) => g.group);
    groupInputHTML = `<div class="manage-group-pick">
      <div class="manage-group-label">Show for <span class="manage-group-sub">(none ticked = every category)</span></div>
      <div class="manage-chips">${cats.map((c) =>
        `<label class="chip"><input type="checkbox" data-add-group-chip value="${escAttr(c)}"${c === cur ? " checked" : ""}> ${escHtml(c)}</label>`
      ).join("")}</div>
    </div>`;
  }

  return `<div class="manage-options-panel" data-manage-panel="${escAttr(name)}">
    ${rowsHTML}
    ${groupInputHTML}
    <div class="manage-options-add-row">
      <input type="text" class="manage-options-input" data-add-option-field="${escAttr(name)}" placeholder="Add ${escAttr(String(label).toLowerCase())}..." maxlength="40">
      <button type="button" class="btn btn-primary manage-options-add-btn" data-add-option-btn="${escAttr(name)}">Add</button>
    </div>
    <button type="button" class="btn btn-ghost manage-options-done-btn" data-close-manage="${escAttr(name)}">Done</button>
  </div>`;
}

function commitNewManagedOption(name, raw, rawGroup) {
  const val = (raw || "").trim();
  if (!val) return;
  const opts = getManagedOptions(name);
  if (opts.some((o) => o.toLowerCase() === val.toLowerCase())) { showToast("Already in the list"); return; }
  const lo = (getFieldConfig(name) || {}).listOrder;
  if (lo === "newtop") opts.unshift(val); else opts.push(val);
  if (isGroupedField(name)) {
    const group = (rawGroup || "").trim() || DEFAULT_GROUP_NAME;
    setManagedOptions(name, opts, { [val]: group });
    // Jump the form to the category the new option went into, so it's right there.
    if (values[activeTpl]) { values[activeTpl][name + "__cat"] = group; saveValuesDebounced(); }
  } else if (multiFilterKey(name)) {
    const groups = splitGroups(rawGroup);
    setManagedOptions(name, opts, groups.length ? { [val]: groups } : undefined);
  } else {
    setManagedOptions(name, opts);
  }
  renderFields();
}

function onFieldChange(e) {
  const name = e.target.dataset.field;
  if (e.target.tagName === "SELECT") {
    // "Type manually…" swaps the dropdown value for a text box under it.
    if (e.target.value === CUSTOM_OPT) {
      values[activeTpl][name + "__custom"] = true;
      values[activeTpl][name] = "";
      saveValuesDebounced();
      renderFields();
      const box = $("fields").querySelector(`[data-custom-field="${cssEsc(name)}"]`);
      if (box) box.focus();
      return;
    }
    if (values[activeTpl][name + "__custom"]) {
      // Back to a listed choice: drop the manual flag and the text box with it.
      delete values[activeTpl][name + "__custom"];
      values[activeTpl][name] = e.target.value;
      saveValuesDebounced();
      renderFields();
      return;
    }
  }
  values[activeTpl][name] = e.target.value;
  saveValuesDebounced();
  if (fieldType(name) === "snippet") {
    const pv = e.target.closest(".field") && e.target.closest(".field").querySelector(".snippet-preview");
    if (pv) pv.textContent = snippetOptionText(name, e.target.value);
  }
  if (hasDependents(name)) { renderFields(); return; } // shows/hides the fields that wait on this one
  const warnEl = e.target.closest(".field") && e.target.closest(".field").querySelector(".field-warn");
  if (warnEl) warnEl.textContent = fieldWarning(name, e.target.value);
  renderPreview();
}

// A line is dropped entirely (not just shown as "_____") when every
// placeholder on it is marked `optional` in its field config AND every one
// of them is currently blank. Mixing an optional blank with a required
// blank, or with static text and no placeholders at all, always keeps the
// line — this only clears lines that would otherwise be pure clutter, like
// an unused "Old DNS: _____" on a non-DNS case.
// Turns a template's text into the note, using the saved field values of
// template `tplId`. The edit view passes its unsaved draft as `text`, so the
// preview follows what's being typed.
function renderTemplateText(text, tplId) {
  let imgTail = ""; // pictures pasted into text boxes: collected here and put at the very bottom of the note
  const lines = text.split("\n").map((line) => {
    const names = getPlaceholders(line);
    if (names.length) {
      const lineHasImages = names.some((name) => isFieldVisible(tplId, name) && fieldAllowsImages(name) && attachedImages(tplId, name).length);
      const allOptionalAndBlank = !lineHasImages && names.every((name) => {
        const cfg = getFieldConfig(name);
        return cfg && (cfg.optional || cfg.type === "image" || (cfg.type === "yesno" && !cfg.noText) || !isFieldVisible(tplId, name)) && !computeFieldOutput(tplId, name);
      });
      if (allOptionalAndBlank) return null;
    }
    // A multi-line value (DNS rows, checklists) starts with a line break so it
    // drops under its label. When the placeholder has no label in front of it
    // (alone on its line, or first on it) that break would only leave a stray blank line.
    // The same goes for a placeholder at the START of a line that has others after it ("{findings}{bizid}"):
    // nothing sits in front of it to drop under, so the break is dropped too (it used to leave a blank gap).
    const piece = (name, offset) => {
      let v = computeFieldOutput(tplId, name);
      if (line.slice(0, offset).trim() === "") v = v.replace(/^\n/, "");
      const cfg = getFieldConfig(name);
      // A field that is hidden (its "Show this field" condition isn't met) never
      // leaves a _____ behind, even when it shares a line with other fields.
      if (cfg && !isFieldVisible(tplId, name)) return "";
      if (cfg && cfg.leadIn) {
        // A field with lead-in text ("... ABN: 12345") adds that wording only
        // when it is filled: optional-and-blank leaves nothing behind.
        const out = finishValue(name, v, line.slice(0, offset));
        // "Issue: Activate domain." + ". ABN: 1" would double the full stop.
        // A leading "." in the lead-in is marked (\u0001) and settled once the whole
        // line is built, because the text before it may itself be a placeholder.
        const lead = cfg.leadIn.replace(/^\./, "\u0001");
        if (out) return lead + out;
        return (cfg.optional || (fieldAllowsImages(name) && attachedImages(tplId, name).length)) ? "" : lead + "_____";
      }
      if (cfg && (cfg.type === "image" || (cfg.type === "yesno" && !cfg.noText))) return v; // these never leave _____ behind
      const fin = finishValue(name, v, line.slice(0, offset));
      // An optional field that is left blank leaves nothing behind, even when it shares
      // a line with a filled one (e.g. "{findings}{bizid}").
      if (!fin && cfg && cfg.optional) return "";
      return fin || ((fieldAllowsImages(name) && attachedImages(tplId, name).length) ? "" : "_____");
    };
    // A multi-line value (Findings) followed straight by another placeholder ({bizid}) would run into its last line
    // ("- otherABN: 123"), so the next filled value starts on a new line instead.
    let lastEnd = -1, lastMulti = false;
    const built = line.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, name, offset) => {
      let r = piece(name, offset);
      if (r && lastMulti && !r.startsWith("\n") && line.slice(lastEnd, offset).trim() === "") r = "\n" + r;
      lastMulti = !!r && /\n/.test(computeFieldOutput(tplId, name));
      lastEnd = offset + m.length;
      return r;
    });
    // Pictures pasted into a text box all go at the bottom of the note, each on its own line.
    names.forEach((name) => {
      if (!isFieldVisible(tplId, name) || !fieldAllowsImages(name)) return;
      attachedImages(tplId, name).forEach((_, i) => { imgTail += "\n" + IMG_OPEN + name + PASTE_IMG_SUFFIX + "|" + i + IMG_CLOSE; });
    });
    return built.replace(/\.\u0001/g, ".").replace(/\u0001/g, ".");
  });
  return lines.filter((l) => l !== null).join("\n").replace(/[ \t]+$/gm, "").replace(/\n+$/, "") + imgTail;
}

function renderPreview() {
  $("preview").value = noteWithImageMarkers(renderTemplateText(templates[activeTpl] || "", activeTpl), activeTpl);
}

// Live preview inside "Edit template". Other code (field visibility, DNS
// summaries) reads templates[tplId], so the draft stands in for it while the
// preview is built, then the saved text goes straight back.
function renderEditPreview() {
  const draft = $("templateEditor").value;
  const saved = templates[activeTpl];
  templates[activeTpl] = draft;
  try {
    $("editPreview").value = noteWithImageMarkers(renderTemplateText(draft, activeTpl), activeTpl);
  } finally {
    templates[activeTpl] = saved;
  }
}

// ── Reference table: read-only view ────────────────────────────────────
function tableShowsHeader(table) { return !table || table.showHeader !== false; }

// Rows don't all have to be the same length: a row can have an extra cell
// or be missing one without touching the others. Each row is flattened from
// its own cells; a cell past the header's names just has no label.
function flattenTable(table) {
  if (!table || !table.columns || !table.columns.length) return "";
  return table.rows.map((row) => flattenRow(table, row)).join(tableShowsHeader(table) ? "\n\n" : "\n");
}

function flattenRow(table, row) {
  if (!tableShowsHeader(table)) return row.map((v) => v || "").join("\t");
  return row.map((v, i) => {
    const label = table.columns[i] || "";
    return label ? `${label}: ${v || ""}` : (v || "");
  }).join("\n");
}

// How many cell positions the table needs: the header's columns, or the
// longest row if that's wider.
function tableWidth(table) {
  return Math.max(table.columns.length, ...table.rows.map((r) => r.length));
}

function renderReferenceView() {
  const wrap = $("refTableWrap");
  const table = referenceTables[activeTpl];

  if (!table || !table.columns || !table.columns.length) {
    wrap.innerHTML = `<div class="edit-hint">This table has no rows yet. Use "Edit table" to add some.</div>`;
    return;
  }

  const width = tableWidth(table);
  const singleCol = width === 1 ? " is-single-col" : "";
  const headCols = Array.from({ length: width }, (_, i) => `<th>${escHtml(table.columns[i] || "")}</th>`).join("");
  const headHTML = tableShowsHeader(table)
    ? `<thead><tr>${headCols}<th></th></tr></thead>`
    : "";
  const bodyHTML = table.rows.map((row, r) => {
    // A row with fewer cells than the widest one stretches its last cell across the gap.
    const cellsHTML = row.map((v, c) => {
      const span = (c === row.length - 1 && width > row.length) ? ` colspan="${width - row.length + 1}"` : "";
      return `<td data-row="${r}" data-col="${c}"${span} title="Click to copy">${escHtml(v || "")}</td>`;
    }).join("") || `<td colspan="${width}"></td>`;
    return `<tr>${cellsHTML}<td class="ref-row-copy-cell"><button class="ref-row-copy-btn" data-copy-row="${r}">Copy</button></td></tr>`;
  }).join("");

  wrap.innerHTML = `<table class="ref-table${singleCol}">${headHTML}<tbody>${bodyHTML}</tbody></table>`;

  wrap.querySelectorAll("td[data-row][data-col]").forEach((td) => {
    td.addEventListener("click", () => {
      const r = Number(td.dataset.row), c = Number(td.dataset.col);
      const text = table.rows[r][c] || "";
      copyTextToClipboard(text, "Copied!");
      td.classList.add("copied");
      setTimeout(() => td.classList.remove("copied"), 500);
    });
  });
  wrap.querySelectorAll("[data-copy-row]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const r = Number(btn.dataset.copyRow);
      copyTextToClipboard(flattenRow(table, table.rows[r]), "Row copied!");
    });
  });
}

function escHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function escAttr(s) { return escHtml(s); }

// ── Add / delete tab ────────────────────────────────────────────────────
function showAddTplRow() {
  $("addTplRow").classList.remove("hidden");
  newTplType = "template";
  $("addTplType").querySelectorAll(".type-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.type === "template"));
  $("newTplName").placeholder = "Name (e.g. Refund Request)";
  $("newTplName").value = "";
  $("newTplName").focus();
}
function hideAddTplRow() {
  $("addTplRow").classList.add("hidden");
}
function confirmAddTpl() {
  const name = $("newTplName").value.trim();
  if (!name) { $("newTplName").focus(); return; }
  const id = slugify(name);
  customLabels[id] = name;
  tabOrder.push(id);

  if (newTplType === "reference") {
    tabTypes[id] = "reference";
    referenceTables[id] = { columns: ["Column 1", "Column 2"], rows: [["", ""]] };
    saveReferenceTables();
    saveTabState();
    hideAddTplRow();
    activeTpl = id;
    $("tplSearch").value = "";
    renderTabs();
    enterEditReferenceMode();
    showToast(`Added "${name}" — fill in the table`);
  } else {
    templates[id] = "";
    values[id] = {};
    saveTemplates();
    saveTabState();
    saveValuesDebounced();
    hideAddTplRow();
    activeTpl = id;
    $("tplSearch").value = "";
    renderTabs();
    enterEditMode();
    showToast(`Added "${name}" — write the template`);
  }
}
function deleteActiveTpl() {
  if (isDefaultTpl(activeTpl)) return; // built-ins aren't deletable
  const label = labelForTpl(activeTpl);
  const noun = tabType(activeTpl) === "reference" ? "table" : "template";
  if (!confirm(`Delete the "${label}" ${noun}? You can bring it back from Settings \u2192 History.`)) return;
  takeSnapshot(`Before deleting \u201C${label}\u201D`, { force: true });
  delete templates[activeTpl];
  delete customLabels[activeTpl];
  delete values[activeTpl];
  delete tabTypes[activeTpl];
  delete referenceTables[activeTpl];
  delete fieldModes[activeTpl];
  if (isTabHidden(activeTpl)) { appSettings.hiddenTabs = appSettings.hiddenTabs.filter((t) => t !== activeTpl); saveAppSettings(); }
  tabOrder = tabOrder.filter((id) => id !== activeTpl);
  saveTemplates();
  saveTabState();
  saveValuesDebounced();
  saveReferenceTables();
  saveFieldModesDebounced();
  activeTpl = firstShownTab();
  $("tplSearch").value = "";
  exitEditMode();
  renderTabs();
  renderActiveView();
}

// ── Export / Import ─────────────────────────────────────────────────────
// (v1.20.2) Backups now include the pictures too, so this is no longer used by Export.
function valuesWithoutImages() {
  const out = {};
  Object.keys(values).forEach((tplId) => {
    out[tplId] = {};
    Object.keys(values[tplId] || {}).forEach((f) => {
      if (fieldType(f) !== "image" && !isAttachKey(f)) out[tplId][f] = values[tplId][f];
    });
  });
  return out;
}
// ── Layout (window / panel sizes) in backups ────────────────────────────
// Dashboard width, top split and the "first split done" marker live in localStorage; the window size lives in
// chrome.storage.local (written by background.js). All of it goes into a backup under "layout".
function readLayoutState(res) {
  const out = {};
  try {
    const w = parseInt(localStorage.getItem("cnh_dashW2"), 10);
    if (w >= 360 && w <= 6000) out.dashW = w;
    const t = parseInt(localStorage.getItem("cnh_topH"), 10);
    if (t >= 64 && t <= 6000) out.topH = t;
    if (localStorage.getItem("cnh_defaultSplit1")) out.defaultSplit1 = true;
  } catch (e) { /* nothing to add */ }
  const ws = res && res.caseNotesWindowSize;
  if (ws && ws.width >= 400 && ws.width <= 3000 && ws.height >= 400 && ws.height <= 3000) out.windowSize = { width: Math.round(ws.width), height: Math.round(ws.height) };
  return out;
}
// Puts a backup's layout back. Applies to the open window straight away where it can; the window size is used the next time it opens.
function applyLayoutState(layout) {
  if (!layout || typeof layout !== "object") return;
  const root = document.documentElement;
  try {
    const w = Number(layout.dashW);
    if (w >= 360 && w <= 6000) { localStorage.setItem("cnh_dashW2", String(Math.round(w))); root.style.setProperty("--dash-w", Math.round(w) + "px"); }
    const t = Number(layout.topH);
    if (t >= 64 && t <= 6000) { localStorage.setItem("cnh_topH", String(Math.round(t))); root.style.setProperty("--top-h", Math.round(t) + "px"); root.classList.add("top-sized"); }
    if (layout.defaultSplit1) localStorage.setItem("cnh_defaultSplit1", "1");
  } catch (e) { /* not remembered */ }
  const ws = layout.windowSize;
  if (ws && ws.width >= 400 && ws.width <= 3000 && ws.height >= 400 && ws.height <= 3000) {
    chrome.storage.local.set({ caseNotesWindowSize: { width: Math.round(ws.width), height: Math.round(ws.height) } });
  }
}

// Builds the backup object (used by Export and by Sync). opts.pictures === false leaves the Cases panel pictures out.
function buildBackupPayload(opts, cb) {
  const withPics = !(opts && opts.pictures === false);
  // The Knowledge Base (cnh_kb) and the Cases panel (cnh_cases) are stored separately, so they are read here and added to the backup.
  // Each case's pictures sit under their own key (cnh_ci_<id>); they are read too and go in "caseImages".
  // (v1.28.10) Also read here: the remembered window size, the legacy option lists and the one-time-fix flags.
  chrome.storage.local.get(["cnh_kb", "cnh_cases", "cnh_selectOptionLists", "cnh_mbFix1", "cnh_defaultSizeApplied", "caseNotesWindowSize"], (res) => {
    const caseList = res && Array.isArray(res.cnh_cases) ? res.cnh_cases : [];
    const imgKeys = withPics ? caseList.filter((c) => c && c.id).map((c) => "cnh_ci_" + c.id) : [];
    const finish = (imgRes) => {
      const caseImages = {};
      imgKeys.forEach((k) => {
        const v = imgRes && imgRes[k];
        if (Array.isArray(v) && v.length) caseImages[k.slice("cnh_ci_".length)] = v;
      });
      cb({
        app: "case-notes-helper",
        version: 3,
        exportedAt: new Date().toISOString(),
        templates: templateOverrides(),
        values, // includes pictures pasted into text boxes and Image fields
        tabOrder,
        customLabels,
        tabTypes,
        referenceTables,
        fieldModes,
        fieldConfigs,
        deletedFields,
        softWarnings,
        appSettings,
        kb: res && res.cnh_kb ? res.cnh_kb : null,
        cases: caseList,
        caseImages,
        snapshots,
        selectOptionLists: res && res.cnh_selectOptionLists ? res.cnh_selectOptionLists : undefined,
        layout: readLayoutState(res),
        flags: { mbFix1: !!(res && res.cnh_mbFix1), defaultSizeApplied: !!(res && res.cnh_defaultSizeApplied) },
        theme: (() => { try { return localStorage.getItem("cnh_theme") === "light" ? "light" : "dark"; } catch (e) { return "dark"; } })()
      });
    };
    if (imgKeys.length) chrome.storage.local.get(imgKeys, finish); else finish({});
  });
}
function exportData() {
  buildBackupPayload({}, (payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `case-notes-helper-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(blob.size > 1048576 ? `Exported! (${(blob.size / 1048576).toFixed(1)} MB, with pictures)` : "Exported!");
  });
}

// Replaces templates, tables, tabs, placeholder settings and soft warnings with
// the ones in `data` (a backup file or a snapshot) and saves them. What is typed
// into the forms (values / fieldModes) is not touched here.
function applyConfigData(data) {
  const obj = (x) => (x && typeof x === "object" && !Array.isArray(x)) ? x : {};
  templates = { ...DEFAULT_TEMPLATES, ...obj(data.templates) };
  referenceTables = obj(data.referenceTables);
  tabTypes = obj(data.tabTypes);
  fieldConfigs = obj(data.fieldConfigs);
  deletedFields = Array.isArray(data.deletedFields) ? data.deletedFields : [];
  softWarnings = sanitizeSoftWarnings(data.softWarnings);
  migrateLegacyOptionLists(data.selectOptionLists);
  migrateIssueCategories();
  migrateStepCategories();
  migrateStepGroups();
  migrateCleanFlags();
  migrateManualBox();
  migrateListOrder();
  migrateDuplicateOptionIds();
  migrateDnsFields();
  tabOrder = (Array.isArray(data.tabOrder) && data.tabOrder.length)
    ? data.tabOrder.filter((id) => templates[id] !== undefined || referenceTables[id] !== undefined)
    : [...DEFAULT_TAB_ORDER];
  DEFAULT_TAB_ORDER.forEach((id) => { if (!tabOrder.includes(id)) tabOrder.push(id); });
  customLabels = obj(data.customLabels);
  saveTemplates();
  saveTabState();
  saveReferenceTables();
  saveFieldConfigs();
  saveDeletedFields();
  saveSoftWarnings();
}

function importDataFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      showToast("Invalid JSON file");
      return;
    }
    if (!data || typeof data !== "object" || !data.templates || typeof data.templates !== "object") {
      showToast("Doesn't look like a TechNotes backup");
      return;
    }
    showConfirmDialog({
      title: "Import backup",
      text: "This replaces your current templates, tables, settings and Cases panel with the contents of the file.",
      confirmLabel: "Import",
      onConfirm: () => applyBackupData(data)
    });
  };
  reader.readAsText(file);
}

// Replaces the current setup with a backup object (from a file or from Sync).
function applyBackupData(data) {
    // The current setup is kept as a snapshot first, so an import can be undone.
    takeSnapshot("Before importing a backup", { always: true });
    values = (data.values && typeof data.values === "object") ? data.values : {};
    fieldModes = (data.fieldModes && typeof data.fieldModes === "object") ? data.fieldModes : {};
    applyConfigData(data);
    if (data.appSettings) { appSettings = sanitizeAppSettings(data.appSettings); saveAppSettings(); }
    chrome.storage.local.set({ cnh_values: values, cnh_fieldModes: fieldModes });
    if (typeof undoReset === "function") undoReset();
    // Older backups have no Knowledge Base; only replace it when the file carries one.
    if (data.kb && typeof data.kb === "object") chrome.storage.local.set({ cnh_kb: data.kb });
    // Same for the Cases panel: older backups have none, so the current list is kept for them.
    if (Array.isArray(data.cases) && typeof importCases === "function") importCases(data.cases, data.caseImages);
    if (data.theme === "light" || data.theme === "dark") { if (typeof applyTheme === "function") applyTheme(data.theme); }
    // (v1.28.10) History snapshots are merged in (the "Before importing" one just taken stays), sizes and one-time-fix flags are restored.
    if (Array.isArray(data.snapshots)) {
      const have = new Set(snapshots.map((s) => s.id));
      snapshots = sanitizeSnapshots(snapshots.concat(sanitizeSnapshots(data.snapshots).filter((s) => !have.has(s.id))));
      pruneSnapshots();
      saveSnapshots();
    }
    if (data.selectOptionLists && typeof data.selectOptionLists === "object") chrome.storage.local.set({ cnh_selectOptionLists: data.selectOptionLists });
    applyLayoutState(data.layout);
    if (data.flags && typeof data.flags === "object") {
      const f = {};
      if (data.flags.mbFix1) f.cnh_mbFix1 = true;
      if (data.flags.defaultSizeApplied) f.cnh_defaultSizeApplied = 1;
      if (Object.keys(f).length) chrome.storage.local.set(f);
    }

    clearHiddenIfAll();
    activeTpl = firstShownTab();
    $("tplSearch").value = "";
    // Import can now be started from Settings; leave that screen first.
    if (typeof closeSettings === "function" && settingsOpen) closeSettings();
    exitEditMode();
    renderTabs();
    renderActiveView();
    showToast("Imported!");
}

// ── Toast ───────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 1400);
}

// ── Clipboard helper (shared by templates & tables) ──────────────────────
function copyTextToClipboard(text, toastMsg) {
  navigator.clipboard.writeText(text).then(() => showToast(toastMsg || "Copied!"));
}

// ── Edit mode: template ─────────────────────────────────────────────────
// While a template or table is open for editing, the other screens must not be
// reachable: Settings / About / Reorder would swap the screen out from under
// the editor (and lose what was typed). The buttons are greyed out rather than
// hidden so the header doesn't shift around — Edit template stays where it is
// too (disabled, since you're already in it).
function setEditChromeDisabled(disabled) {
  ["settingsBtn", "aboutBtn", "reorderToggleBtn", "editToggleBtn"].forEach((id) => { $(id).disabled = disabled; });
}
function editingReference() { return !$("editReferenceView").classList.contains("hidden"); }
function editSignature() {
  if (editingReference() && refEditState) {
    return JSON.stringify({ c: refEditState.columns, r: refEditState.rows, h: refEditState.showHeader, t: $("refTitleEditor").value });
  }
  return JSON.stringify({ x: $("templateEditor").value, t: $("templateTitleEditor").value });
}
// Escape / "back" out of the template or table editor: straight out if nothing
// changed, otherwise ask. Uses the editor's own Save / Cancel buttons so there
// is only one copy of that logic.
function requestExitEdit() {
  if (!isEditing) return;
  const ref = editingReference();
  const cancelBtn = $(ref ? "cancelRefEditBtn" : "cancelEditBtn");
  const saveBtn = $(ref ? "saveRefBtn" : "saveTemplateBtn");
  if (editSignature() === editSnapshot) { cancelBtn.click(); return; }
  showUnsavedDialog({
    text: `Save your changes to this ${ref ? "table" : "template"} before going back?`,
    keepLabel: "Keep editing",
    onSave: () => saveBtn.click(),
    onDiscard: () => cancelBtn.click()
  });
}

function enterEditMode() {
  isEditing = true;
  setEditChromeDisabled(true);
  $("fillView").classList.add("hidden");
  $("tabs").classList.add("hidden");
  $("addTplRow").classList.add("hidden");
  $("editView").classList.remove("hidden");
  $("templateEditor").value = templates[activeTpl] || "";
  $("templateTitleEditor").value = labelForTpl(activeTpl);
  renderEditPreview();

  const leftBtn = $("editLeftBtn");
  if (isDefaultTpl(activeTpl)) {
    leftBtn.textContent = "Restore default";
    leftBtn.onclick = () => {
      $("templateEditor").value = DEFAULT_TEMPLATES[activeTpl];
      $("templateTitleEditor").value = TAB_LABELS[activeTpl];
      renderEditPreview();
    };
  } else {
    leftBtn.textContent = "Delete template";
    leftBtn.onclick = deleteActiveTpl;
  }
  editSnapshot = editSignature();
}
function exitEditMode() {
  isEditing = false;
  setEditChromeDisabled(false);
  $("tabs").classList.remove("hidden");
  $("editView").classList.add("hidden");
  $("editReferenceView").classList.add("hidden");
  $("editToggleBtn").classList.remove("hidden");
  renderActiveView();
}

// ── Edit mode: reference table ──────────────────────────────────────────
function enterEditReferenceMode() {
  isEditing = true;
  setEditChromeDisabled(true);
  $("fillView").classList.add("hidden");
  $("tableView").classList.add("hidden");
  $("tabs").classList.add("hidden");
  $("addTplRow").classList.add("hidden");
  $("editReferenceView").classList.remove("hidden");

  const existing = referenceTables[activeTpl] || { columns: ["Column 1", "Column 2"], rows: [["", ""]] };
  refEditState = { columns: [...existing.columns], rows: existing.rows.map((r) => [...r]), showHeader: existing.showHeader !== false };
  $("refShowHeader").checked = refEditState.showHeader;
  $("refTitleEditor").value = labelForTpl(activeTpl);
  $("deleteRefBtn").onclick = deleteActiveTpl;

  renderRefEditTable();
  editSnapshot = editSignature();
}

function renderRefEditTable() {
  const wrap = $("refEditWrap");
  const cols = refEditState.columns;
  const rows = refEditState.rows;
  const width = Math.max(cols.length, ...rows.map((r) => r.length));
  const singleCol = width === 1 ? " is-single-col" : "";

  // The top row of the editor is the column header, not a data row: its ✕ removes
  // that column from every row. A table always keeps at least one column, so the
  // last ✕ is dropped — untick "Show the header row" instead to get a plain,
  // label-free list. Positions past the header's names (a row that was given an
  // extra cell) get an empty header slot.
  const headHTML = Array.from({ length: width }, (_, i) => {
    if (i >= cols.length) return `<th class="ref-col-head-bare"></th>`;
    return (refEditState.showHeader
      ? `<th><input class="ref-col-header-input" data-col="${i}" value="${escAttr(cols[i])}" placeholder="Column ${i + 1}">`
      : `<th class="ref-col-head-bare">`) +
      (cols.length > 1 ? `<button class="ref-remove-btn" data-remove-col="${i}" title="Remove this column from every row">✕</button>` : "") +
      `<div class="ref-col-tools">` +
      `<button type="button" class="ref-ins-btn" data-ins-col="${i}" data-side="left" title="Insert a column to the left (every row)">+ ←</button>` +
      `<button type="button" class="ref-ins-btn" data-ins-col="${i}" data-side="right" title="Insert a column to the right (every row)">→ +</button>` +
      `</div></th>`;
  }).join("") + `<th><button class="ref-add-col-btn" id="addRefColBtn" title="Add a column to every row">+</button></th>`;

  // Each cell has two small buttons that show on hover: + adds a blank cell
  // before it, ✕ removes it. Both only change that one row (later cells shift).
  const bodyHTML = rows.map((row, r) => {
    const cellsHTML = row.map((v, c) =>
      `<td><div class="ref-cell-wrap">${String(v || "").includes("\n") ? `<textarea class="ref-cell-input" data-row="${r}" data-col="${c}" rows="${Math.min(12, String(v).split("\n").length)}">${escHtml(String(v))}</textarea>` : `<input class="ref-cell-input" data-row="${r}" data-col="${c}" value="${escAttr(v || "")}">`}` +
      `<div class="ref-cell-tools">` +
      `<button type="button" class="ref-cell-tool" data-cell-insert data-row="${r}" data-col="${c}" title="Add a cell before this one (this row only)">+</button>` +
      (row.length > 1 ? `<button type="button" class="ref-cell-tool is-del" data-cell-remove data-row="${r}" data-col="${c}" title="Remove this cell (this row only)">✕</button>` : "") +
      `</div></div></td>`
    ).join("");
    const filler = row.length < width ? `<td colspan="${width - row.length}" class="ref-fill"></td>` : "";
    const removeRow = rows.length > 1 ? `<button class="ref-remove-btn" data-remove-row="${r}" title="Remove row">✕</button>` : "";
    return `<tr>${cellsHTML}${filler}<td class="ref-row-ctl"><button type="button" class="ref-row-add-btn" data-row-add="${r}" title="Add a cell at the end of this row">+</button>` +
      `<button type="button" class="ref-ins-btn" data-ins-row="${r}" data-side="above" title="Insert a row above">+ ↑</button>` +
      `<button type="button" class="ref-ins-btn" data-ins-row="${r}" data-side="below" title="Insert a row below">+ ↓</button>${removeRow}</td></tr>`;
  }).join("");

  wrap.innerHTML = `<table class="ref-edit-table${singleCol}"><thead><tr>${headHTML}</tr></thead><tbody>${bodyHTML}</tbody></table>`;

  const focusCell = (r, c) => {
    const el = wrap.querySelector(`.ref-cell-input[data-row="${r}"][data-col="${c}"]`);
    if (el) el.focus();
  };

  wrap.querySelectorAll(".ref-col-header-input").forEach((input) => {
    input.addEventListener("input", (e) => { refEditState.columns[Number(e.target.dataset.col)] = e.target.value; });
  });
  // Pasting text that has line breaks (a numbered list, steps, indented bullets) keeps them: the
  // cell turns into a multi-line box. A single-line box would flatten it into one line (v1.20.3).
  wrap.querySelectorAll("input.ref-cell-input").forEach((input) => {
    input.addEventListener("paste", (e) => {
      const raw = e.clipboardData && e.clipboardData.getData("text/plain");
      if (!raw || !/[\r\n]/.test(raw)) return; // one-line paste: normal behaviour
      e.preventDefault();
      const text = raw.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
      const r = Number(input.dataset.row), c = Number(input.dataset.col);
      const cur = input.value;
      const a = input.selectionStart == null ? cur.length : input.selectionStart;
      const z = input.selectionEnd == null ? cur.length : input.selectionEnd;
      refEditState.rows[r][c] = cur.slice(0, a) + text + cur.slice(z);
      renderRefEditTable();
      const nb = wrap.querySelector(`.ref-cell-input[data-row="${r}"][data-col="${c}"]`);
      if (nb) { nb.focus(); try { nb.setSelectionRange(a + text.length, a + text.length); } catch (err) {} }
    });
  });
  // Shift+Enter in a cell adds a new line (the cell becomes a multi-line box).
  wrap.querySelectorAll(".ref-cell-input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      e.preventDefault();
      const r = Number(input.dataset.row), c = Number(input.dataset.col);
      const cur = input.value;
      const a = input.selectionStart == null ? cur.length : input.selectionStart;
      const z = input.selectionEnd == null ? cur.length : input.selectionEnd;
      refEditState.rows[r][c] = cur.slice(0, a) + "\n" + cur.slice(z);
      renderRefEditTable();
      const nb = wrap.querySelector(`.ref-cell-input[data-row="${r}"][data-col="${c}"]`);
      if (nb) { nb.focus(); try { nb.setSelectionRange(a + 1, a + 1); } catch (err) {} }
    });
  });
  wrap.querySelectorAll(".ref-cell-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const r = Number(e.target.dataset.row), c = Number(e.target.dataset.col);
      refEditState.rows[r][c] = e.target.value;
    });
  });
  wrap.querySelectorAll("[data-cell-insert]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = Number(btn.dataset.row), c = Number(btn.dataset.col);
      refEditState.rows[r].splice(c, 0, "");
      renderRefEditTable();
      focusCell(r, c);
    });
  });
  wrap.querySelectorAll("[data-cell-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = Number(btn.dataset.row), c = Number(btn.dataset.col);
      if (refEditState.rows[r].length <= 1) return;
      refEditState.rows[r].splice(c, 1);
      renderRefEditTable();
    });
  });
  wrap.querySelectorAll("[data-row-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = Number(btn.dataset.rowAdd);
      refEditState.rows[r].push("");
      renderRefEditTable();
      focusCell(r, refEditState.rows[r].length - 1);
    });
  });
  // Insert a whole row above / below this one (blank cells, one per column).
  wrap.querySelectorAll("[data-ins-row]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const at = Number(btn.dataset.insRow) + (btn.dataset.side === "below" ? 1 : 0);
      refEditState.rows.splice(at, 0, refEditState.columns.map(() => ""));
      renderRefEditTable();
      focusCell(at, 0);
    });
  });
  // Insert a whole column to the left / right of this one, in every row. A row that was
  // made shorter on purpose and doesn't reach that position is left as it is.
  wrap.querySelectorAll("[data-ins-col]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const at = Number(btn.dataset.insCol) + (btn.dataset.side === "right" ? 1 : 0);
      const oldLen = refEditState.columns.length;
      refEditState.columns.splice(at, 0, "");
      refEditState.rows.forEach((row) => { if (at >= oldLen ? row.length >= oldLen : row.length > at) row.splice(at, 0, ""); });
      renderRefEditTable();
      const head = wrap.querySelector(`.ref-col-header-input[data-col="${at}"]`);
      if (head) head.focus(); else focusCell(0, at);
    });
  });
  wrap.querySelectorAll("[data-remove-col]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.removeCol);
      refEditState.columns.splice(i, 1);
      refEditState.rows.forEach((row) => { if (row.length > 1 && i < row.length) row.splice(i, 1); });
      renderRefEditTable();
    });
  });
  wrap.querySelectorAll("[data-remove-row]").forEach((btn) => {
    btn.addEventListener("click", () => {
      refEditState.rows.splice(Number(btn.dataset.removeRow), 1);
      renderRefEditTable();
    });
  });
  const addColBtn = $("addRefColBtn");
  if (addColBtn) {
    addColBtn.addEventListener("click", () => {
      // The new column goes at the end of the header. Rows that reach the end of
      // the header get a blank cell there; a row that was made shorter on
      // purpose stays as it is.
      const at = refEditState.columns.length;
      refEditState.columns.push(`Column ${at + 1}`);
      refEditState.rows.forEach((row) => { if (row.length >= at) row.splice(at, 0, ""); });
      renderRefEditTable();
    });
  }
}

// ── Paste from another template ─────────────────────────────────────────
// Copies details (Domains, Invoice, Member ID, ...) that were filled in on
// another template into the one that's open. Fields are matched by their
// {placeholder} name, so only fields that exist on both templates move over.
function isFilledValue(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.keys(v).length > 0; // toggle + text (select multiple)
  return typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null;
}

// Toggle-style fields keep their pick in fieldModes (keyed by the lowercase
// name for toggles, the name as written for toggle+text), not in values.
function modeKeys(name) { return [...new Set([name, String(name).toLowerCase()])]; }
function isToggleType(name) { const t = fieldType(name); return t === "toggle" || t === "prefixToggle"; }
function hasExplicitMode(tplId, name) {
  return !!fieldModes[tplId] && modeKeys(name).some((k) => fieldModes[tplId][k] !== undefined);
}
function effectiveMode(tplId, name) {
  const cfg = getFieldConfig(name);
  const opts = cfg ? normalizeOptions(cfg) : [];
  const key = fieldType(name) === "toggle" ? String(name).toLowerCase() : name;
  return getFieldMode(tplId, key, opts);
}

// Text typed into a field's own \u201ctype it yourself\u201d box (toggle / checklist / multi-toggle).
// Pictures pasted into a text box live beside its text in <name>__img (v1.20.1: Paste from copies them too).
function hasAttachedImgs(bag, name) {
  const v = bag && bag[name + PASTE_IMG_SUFFIX];
  return Array.isArray(v) && v.length > 0;
}
function hasExtraTyped(bag, name) {
  const k = String(name).toLowerCase();
  return isFilledValue(bag[k + "__typed"]) || isFilledValue(bag[k + "__other"]);
}

// Placeholder names are case-insensitive everywhere else (one config per lowercase name), so
// {MemberID} on one template and {memberID} on another are the same field. Matching used to
// be case-sensitive, which is why Member ID (and Case ID) sometimes didn't paste (v1.19.2).
// Each pair is { t: name as written on this template, s: name as written on the source }.
function pasteSources() {
  const targetNames = getPlaceholders(templates[activeTpl] || "");
  const out = [];
  tabOrder.forEach((id) => {
    if (id === activeTpl || tabType(id) !== "template") return;
    const srcValues = values[id] || {};
    const srcByLower = new Map();
    getPlaceholders(templates[id] || "").forEach((n) => { if (!srcByLower.has(n.toLowerCase())) srcByLower.set(n.toLowerCase(), n); });
    const seenT = new Set();
    const common = [];
    targetNames.forEach((t) => {
      const low = t.toLowerCase();
      if (seenT.has(low) || !srcByLower.has(low) || fieldType(t) === "auto" || fieldType(t) === "dnsDiff") return;
      seenT.add(low);
      common.push({ t, s: srcByLower.get(low) });
    });
    // Anything with typed/picked content, plus every toggle button (its
    // on-screen choice, default or not, is copied too).
    const shared = common.filter(({ s }) => isFilledValue(srcValues[s]) || isToggleType(s) || hasExtraTyped(srcValues, s) || hasAttachedImgs(srcValues, s));
    // Only list the template if there's something real to bring over.
    const meaningful = common.some(({ s }) => isFilledValue(srcValues[s]) || hasExtraTyped(srcValues, s) || hasAttachedImgs(srcValues, s) || (isToggleType(s) && hasExplicitMode(id, s)));
    if (meaningful) out.push({ id, shared });
  });
  return out;
}

function closePasteFromMenu() {
  $("pasteFromMenu").classList.add("hidden");
  $("pasteFromBtn").setAttribute("aria-expanded", "false");
}

function openPasteFromMenu() {
  const menu = $("pasteFromMenu");
  const sources = pasteSources();
  if (!sources.length) {
    menu.innerHTML = `<div class="paste-from-empty">No other template has matching details filled in yet.</div>`;
  } else {
    menu.innerHTML = `<div class="paste-from-head">Paste matching details from:</div>` + sources.map((s) =>
      `<button type="button" class="paste-from-item" role="menuitem" data-src="${escHtml(s.id)}">` +
      `<span>${escHtml(labelForTpl(s.id))}<span class="pf-fields">${escHtml(s.shared.map((x) => labelForField(x.t)).join(", "))}</span></span>` +
      `<span class="pf-count">${s.shared.length} field${s.shared.length === 1 ? "" : "s"}</span></button>`
    ).join("");
    menu.querySelectorAll(".paste-from-item").forEach((btn) => {
      btn.addEventListener("click", () => pasteFromTemplate(btn.dataset.src));
    });
  }
  menu.classList.remove("hidden");
  $("pasteFromBtn").setAttribute("aria-expanded", "true");
}

function pasteFromTemplate(srcId) {
  const src = pasteSources().find((s) => s.id === srcId);
  closePasteFromMenu();
  if (!src) return;
  // Start from a clean slate: anything on this template that the other one
  // doesn't have (or has left blank) ends up blank, not left over from before.
  values[activeTpl] = {};
  delete fieldModes[activeTpl];
  manageOptionsOpenField = null;
  const dest = values[activeTpl];
  const srcVals = values[srcId] || {};
  src.shared.forEach(({ t: name, s: sname }) => {
    // Typed text, dropdown choice, checklist ticks, DNS rows...
    if (isFilledValue(srcVals[sname])) dest[name] = JSON.parse(JSON.stringify(srcVals[sname]));
    if (srcVals[sname + "__cat"] !== undefined) dest[name + "__cat"] = srcVals[sname + "__cat"];
    if (srcVals[sname + "__multi"] === true && isFilledValue(srcVals[sname])) dest[name + "__multi"] = true;
    if (isFilledValue(srcVals[sname])) { if (srcVals[sname + "__custom"]) dest[name + "__custom"] = true; else delete dest[name + "__custom"]; }
    ["__typed", "__other", "__unit"].forEach((sfx) => {
      const k = String(name).toLowerCase() + sfx;
      const sk = String(sname).toLowerCase() + sfx;
      if (isFilledValue(srcVals[sk])) dest[k] = srcVals[sk];
    });
    // Pictures pasted into this field's text box (stored as <name>__img).
    if (hasAttachedImgs(srcVals, sname)) dest[name + PASTE_IMG_SUFFIX] = JSON.parse(JSON.stringify(srcVals[sname + PASTE_IMG_SUFFIX]));
    // Toggle buttons: copy whatever the source is showing right now.
    if (isToggleType(name)) {
      const mode = effectiveMode(srcId, sname);
      if (mode) {
        if (!fieldModes[activeTpl]) fieldModes[activeTpl] = {};
        const key = fieldType(name) === "toggle" ? String(name).toLowerCase() : name;
        fieldModes[activeTpl][key] = mode;
      }
    }
    // Any other saved mode choice for this field (e.g. server name / mail.domain).
    modeKeys(sname).forEach((k) => {
      if (fieldModes[srcId] && fieldModes[srcId][k] !== undefined) {
        if (!fieldModes[activeTpl]) fieldModes[activeTpl] = {};
        const dk = k === String(sname).toLowerCase() ? String(name).toLowerCase() : name;
        fieldModes[activeTpl][dk] = fieldModes[srcId][k];
      }
    });
  });
  saveValuesDebounced();
  saveFieldModesDebounced();
  renderFields();
  showToast(`Pasted ${src.shared.length} field${src.shared.length === 1 ? "" : "s"} from ${labelForTpl(srcId)}`);
}

// ── Wire up ─────────────────────────────────────────────────────────────
function init() {
  loadState(() => {
    renderTabs();
    renderActiveView();
    if (typeof initCases === "function") initCases();
  });

  // Ctrl+V with a picture on the clipboard goes into the open template's image
  // field: the one that has focus, otherwise the first one. Normal text paste is untouched.
  document.addEventListener("paste", (e) => {
    const fills = $("fillView");
    if (!fills || fills.classList.contains("hidden")) return;
    const files = [...((e.clipboardData && e.clipboardData.files) || [])].filter((f) => /^image\//.test(f.type));
    if (!files.length) return;
    // A text box that allows pictures (Settings > "Allow pasting images") gets them when it has focus.
    const ae = document.activeElement;
    const boxInfo = imgBoxInfo(ae);
    const boxName = boxInfo && boxInfo.name;
    if (boxName && fieldAllowsImages(boxName)) {
      e.preventDefault();
      addImagesToField(boxName + PASTE_IMG_SUFFIX, files);
      return;
    }
    const zones = [...$("fields").querySelectorAll("[data-img-zone]")];
    // Focus was lost (the form redraws after each picture): carry on in the last text box used.
    if (!zones.length && lastImgPasteBox && fieldAllowsImages(lastImgPasteBox) && $("fields").querySelector(`[data-img-attach="${cssEsc(lastImgPasteBox)}"]`)) {
      e.preventDefault();
      addImagesToField(lastImgPasteBox + PASTE_IMG_SUFFIX, files);
      return;
    }
    if (!zones.length) return;
    const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-img-zone]");
    e.preventDefault();
    addImagesToField((focused || zones[0]).dataset.imgZone, files);
  });

  $("clearBtn").addEventListener("click", () => {
    values[activeTpl] = {};
    manageOptionsOpenField = null;
    saveValuesDebounced();
    renderFields();
    // Jump back to the top so the first field is in view after clearing.
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });

  $("pasteFromBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!$("pasteFromMenu").classList.contains("hidden")) closePasteFromMenu();
    else openPasteFromMenu();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".fill-actions-row")) closePasteFromMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("pasteFromMenu").classList.contains("hidden")) closePasteFromMenu();
  });

  $("templateEditor").addEventListener("input", renderEditPreview);

  $("copyBtn").addEventListener("click", copyNote);

  // Clicking the title goes back to the main page (the template tabs and form) from wherever you are.
  // Unsaved edits in an editor / Settings still get the usual "save your changes?" question.
  $("homeBtn").addEventListener("click", () => {
    if (isEditing) { requestExitEdit(); return; }
    if (typeof aboutOpen !== "undefined" && aboutOpen) { closeAbout(); return; }
    if (typeof settingsOpen !== "undefined" && settingsOpen) { $("settingsBackBtn").click(); return; }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });

  // Ctrl+C (Cmd+C) in this window does what the Copy button does, as long as
  // nothing is selected (so copying a highlighted bit of text still works).
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "c") return;
    if (appSettings.ctrlCCopy === false) return;
    const fill = $("fillView");
    if (!fill || fill.classList.contains("hidden") || isEditing) return;
    const a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA") && a.selectionStart !== a.selectionEnd && a.type !== "checkbox") return;
    const sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length) return;
    e.preventDefault();
    copyNote();
  });

  $("copyTableBtn").addEventListener("click", () => copyTextToClipboard(flattenTable(referenceTables[activeTpl]), "Copied!"));

  $("editToggleBtn").addEventListener("click", () => {
    if (tabType(activeTpl) === "reference") enterEditReferenceMode();
    else enterEditMode();
  });
  $("cancelEditBtn").addEventListener("click", exitEditMode);
  $("saveTemplateBtn").addEventListener("click", () => {
    const text = $("templateEditor").value;
    takeSnapshot(`Before editing \u201C${labelForTpl(activeTpl)}\u201D`);
    templates[activeTpl] = text;

    const newTitle = $("templateTitleEditor").value.trim();
    if (newTitle) {
      if (isDefaultTpl(activeTpl) && newTitle === TAB_LABELS[activeTpl]) {
        delete customLabels[activeTpl]; // back to the built-in name, no override needed
      } else {
        customLabels[activeTpl] = newTitle;
      }
    }

    saveTemplates();
    saveTabState();
    exitEditMode();
    renderTabs();
  });

  $("refShowHeader").addEventListener("change", (e) => {
    if (!refEditState) return;
    refEditState.showHeader = e.target.checked;
    renderRefEditTable();
  });

  $("addRefRowBtn").addEventListener("click", () => {
    refEditState.rows.push(refEditState.columns.map(() => ""));
    renderRefEditTable();
  });
  $("cancelRefEditBtn").addEventListener("click", () => { refEditState = null; exitEditMode(); });
  $("saveRefBtn").addEventListener("click", () => {
    // Drop fully-empty columns/rows the user left blank, but always keep at least one of each.
    const cols = refEditState.columns.map((c, i) => c.trim() || `Column ${i + 1}`);
    takeSnapshot(`Before editing \u201C${labelForTpl(activeTpl)}\u201D`);
    referenceTables[activeTpl] = { columns: cols, rows: refEditState.rows.map((r) => [...r]), showHeader: refEditState.showHeader };

    const newTitle = $("refTitleEditor").value.trim();
    if (newTitle) customLabels[activeTpl] = newTitle;

    saveReferenceTables();
    saveTabState();
    refEditState = null;
    exitEditMode();
    renderTabs();
  });

  $("addTplType").querySelectorAll(".type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      newTplType = btn.dataset.type;
      $("addTplType").querySelectorAll(".type-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      $("newTplName").placeholder = newTplType === "reference" ? "Table name (e.g. SPF Records)" : "Name (e.g. Refund Request)";
    });
  });

  $("confirmAddTpl").addEventListener("click", confirmAddTpl);
  $("cancelAddTpl").addEventListener("click", hideAddTplRow);
  $("newTplName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmAddTpl();
    if (e.key === "Escape") hideAddTplRow();
  });

  $("tplSearch").addEventListener("input", renderTabs);
  $("reorderToggleBtn").addEventListener("click", toggleReorderMode);
  $("reorderCancelBtn").addEventListener("click", cancelReorder);
  $("tplSearch").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $("tplSearch").value = "";
      renderTabs();
      $("tplSearch").blur();
    }
  });
  $("clearSearchBtn").addEventListener("click", () => {
    $("tplSearch").value = "";
    renderTabs();
    $("tplSearch").focus();
  });

  // arrow so it resolves at click time — settings.js loads after this file
  $("settingsBtn").addEventListener("click", () => openSettings());
  $("aboutBtn").addEventListener("click", () => openAbout());
  // The Knowledge Base lives in its own window; background.js opens or focuses it.
  const openInfoHub = () => {
    chrome.windows.getCurrent((w) => {
      chrome.runtime.sendMessage({ type: "cnh-open-kb", sourceWindowId: w && w.id });
    });
  };
  $("kbBtn").addEventListener("click", openInfoHub);
  // Alt+F also works while this window is focused (Chrome's own Alt+F would otherwise open its menu).
  document.addEventListener("keydown", (ev) => {
    if (ev.altKey && !ev.ctrlKey && !ev.shiftKey && !ev.metaKey && (ev.key === "f" || ev.key === "F" || ev.code === "KeyF")) { ev.preventDefault(); openInfoHub(); }
  });

  // Import / Export buttons now live in Settings (wired in renderSettingsList);
  // the hidden file input they open stays here.
  $("importFileInput").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importDataFromFile(file);
    e.target.value = "";
  });
}

// popup.html loads dns.js, history.js and settings.js after this file, and the
// storage callback in init() can fire before they have run, so wait for the
// whole page (every script) to be parsed first.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
