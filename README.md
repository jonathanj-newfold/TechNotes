# TechNotes

Hotkey-triggered case note templates for four workflows: Cancellation,
General Help, Change Request, and Case Note (the `I-` format).

## Use

1. Press **Alt+C** anywhere (or click the toolbar icon) to open the popup.
2. Pick a tab for the workflow type.
3. Fill in the fields — the preview at the bottom updates live.
4. **Copy** puts the finished note on your clipboard.

Any required field you leave blank shows as `_____` in the preview/output
so it's obvious what still needs filling in before you paste it somewhere
final. A field marked **Optional** in Settings does the opposite — its
whole line just disappears from the note when left blank, instead of
showing `_____` (this is how `{oldDns}` / `{newDns}` and `{issueDetails}`
behave on the Case Note tab).

## infoHub (formerly the Knowledge Base)

The **infoHub** button (first in the header, or **Alt+F**) opens a separate window
with a searchable, categorised library of your reference material: DNS and mail
settings, links, forms, domain requirements, billing wording, team info and FAQs.

- First open builds it from the templates and reference tables you already have
  (the four note workflows and scratch tabs are left out), sorted into
  categories. Later, **Sync from templates** adds anything new; entries you
  deleted stay deleted.
- It is its own store, so editing the KB never changes your note templates.
- **Entries** are Text or Table. Click a title to open it; Copy copies it,
  and in a table, clicking a cell copies just that value (links get a ↗).
  Wrap a word in `{curly braces}` in a text entry and it shows a box to fill in
  before you copy.
- **Pictures inside the text:** in a text entry, click **Image** in the formatting bar, or just paste
  a screenshot / drag an image file into the text box, and it lands at the cursor. Click a picture in
  the box to make it Small / Medium / Large / Original, **Edit** it (crop, blur...), or **Remove** it.
  Drag a picture to move it. Copy keeps the pictures in place when pasted into an email.
  Pictures already in an entry's Images box can be moved into the text with **Insert in text**.
- **Images box:** in the entry editor, **+ Add images**, or paste a screenshot (Ctrl+V) anywhere outside the text box, or drag files in.
  Those pictures show under the entry; click one to enlarge, **Copy image** to paste it into a ticket.
  Large images are scaled down (max 1600px) to keep the KB light.
- **Text formatting:** text entries have a formatting bar: font, size, **bold**, *italic*,
  underline, strikethrough, text and highlight colour, links (Ctrl+K; the text stays highlighted while you type the address; click a link in the box for an Open button, or Ctrl+click to open it at once; in an opened entry a link opens with one click), bullet and numbered lists,
  alignment, undo/redo and Clear. Copy puts both the formatted and the plain version on the
  clipboard, so it keeps its look when pasted into an email and stays plain in plain boxes.
  Text pasted from web pages is cleaned (no stray colours or fonts). Tables stay plain.
- **Image editing:** **Edit** on any image (in the entry editor or under an opened entry) opens
  an editor: crop, rotate, flip, resize, pen, arrow, box, highlight, text, and Blur / Cover to hide
  customer details. Undo and Reset are there if you slip.
- **★** pins an entry to the Pinned list. Search covers titles and content
  (press `/` to jump to it, Esc to clear).
- **Categories** lets you add, rename, reorder and delete categories
  (deleted ones move their entries to General).
- The KB is included in Export / Import backups and shares the Light/Dark theme.

## More input types

Pick these under **Settings**, open a placeholder, **Input type**:

- **Date picker** - choose a date (or press **Today**); written in the format you pick (19 Oct 2026, 19/10/2026, 10/19/2026, 2026-10-19, Monday, 19 October 2026).
- **Date and time stamp** - date + time with a **Now** button; 12-hour or 24-hour.
- **Number with a unit** - a number plus a unit dropdown you define (seconds, minutes, %, ...).
- **Yes / no line (tick box)** - writes your "ticked" text; leave the "not ticked" text empty and the whole line drops out of the note.
- **Counter (+ / -)** - plus and minus buttons with a step and a lowest value; typing a number works too.
- **Canned snippet** - pick a named block of text; it can mention other placeholders from the same template (e.g. `Hi {customer}, ...`) and they are filled in.

Extra options on a **Single-line text** field:

- **Clean: Link** - adds https:// and drops tracking bits (utm_*, fbclid, gclid, ...).
- **Clean: Email** now also hints at typos in the domain (gmial.com -> gmail.com).
- **Recent chips** - quick-fill buttons with what you typed in that field on your last logged cases.

## Typing something that isn't in the list

In **Settings**, open a placeholder and tick the \"text box\" option to let you type your own value
instead of picking from its list. It works on every list-style field:

- **Dropdown** - a text box next to the dropdown (typing replaces the dropdown choice).
- **Toggle buttons** - a box beside the buttons. Typing replaces the button choice (the buttons un-highlight);
  clicking a button clears the box again. A typed value also counts for "Show this field" rules.
- **Checklist (select multiple)** - a box under the checklist. One item per line; each goes into the note
  as its own line after the ticked items. With "Manage list" on, **Add to list** saves them permanently.
- **Toggle + text (select multiple)** - an extra **Other** row. One line per entry, written with the same line start.

Text/paragraph fields are already free typing, and Toggle + text (prefix) already has its own box, so they
don't need the option.

## Renaming a template

Open **Edit template** — there's a "Template title" box above the template
text now. Change it and hit Save to rename the tab. This works for the
built-in workflows too; typing the name back to its original ("Cancellation",
"General Help", "Change Request", "Case Note") drops the override so it
just goes back to normal.

## Adding your own templates

Click the **+** at the end of the tabs row, type a name, and it's added as a
new tab with a starter template (`Case ID` / `Customer` / `Notes`) ready to
customize. Custom templates work exactly like the built-in four — fill,
preview, copy, and edit the wording the same way.

While editing a custom template, the "Restore default" button becomes
**Delete template** instead, since there's no built-in version to fall back
to. The four built-in workflows (Cancellation, General Help, Change
Request, Case Note) can't be deleted, only edited.

## The Case Note tab

Matches the `I-<case id>` note format: Customer ID/Domain, Name, Issue,
Action/Resolution.

- **Issue** is a two-step pick: choose a **category** first (Email issue,
  Website issue, Domain issue, Account Manager issue), then the specific issue
  within it. Only the issue wording goes into the note — the category just
  narrows the list. Click **Manage list** right on the fill-in form to add new
  phrasing as you run into it; the category dropdown there starts on the
  one you're on, and "New category…" creates a new one. It's saved for
  next time. The same list is shared with General Help's `{issue}` field.
- **Additional details** sits right under Issue for anything the canned
  phrasing doesn't cover (exact error text, etc.) — it's optional, so it
  only shows up in the note when you actually type something.
- **Troubleshooting steps performed** is a checklist that follows the Issue
  category: pick Email issue and you only see the email steps, Website issue
  and you only see the website steps, and so on. Steps with no category (like
  "Escalated to Tier 2") show up for every category. Pre-add the steps you
  commonly run (Settings → `{troubleshootingSteps}` → Manage list, or right on
  the fill-in form — there you tick which categories the step shows for, with
  the one you're on already ticked; tick none for a step that applies
  everywhere) and just tick off whichever ones you
  actually did on this case. Ticked items get written in as their own lines; nothing
  ticked means the whole line disappears from the note. Switching the Issue
  category only hides steps that belong to another category — your ticks stay
  saved and come back if you switch back, and hidden ones aren't written
  into the note. Category names can contain commas.
- **Case ID** always comes out as `I-` plus the number, in every template:
  type `26838210`, `I-26838210`, `i-26838210` or `#26838210` and the note
  says `I-26838210`. (Case Note's own `I-{caseId}` line still prints a single
  `I-`.) Anything that isn't a plain number is left as typed. Change or turn
  this off per field under Settings → Clean what's typed or pasted.
- **Customer ID/Domain** and the **Address type** field tidy pasted URLs:
  `https://www.Example.com/` goes into the note as `example.com`. A customer ID
  or anything else that isn't a web address is left exactly as typed.
- **Old DNS** / **New DNS** sit under Action/Resolution for DNS-change
  cases — also optional, so they stay out of the note entirely on any case
  that isn't a DNS update. They are DNS record tables (see **DNS records**
  below), and **DNS changes** underneath summarises what differs.

## DNS records (Old DNS / New DNS)

`{oldDns}` and `{newDns}` are a **DNS records** field: a small table with one
row per record — **type**, **host**, **value** and **TTL**.

- **Type them in** with **+ Add record** (type dropdown, host, TTL, and the
  value underneath; the value box hints at the format for the chosen type,
  e.g. `10 mail.example.com` for MX). ✕ removes a row.
- **Paste them in** with **Paste records**. Paste a zone file, `dig` output or
  a table copied from a DNS panel and click **Add records** (adds to the rows
  you have) or **Replace all**. It reads both orders you're likely to meet:
  `www 300 IN CNAME example.com.` (zone file / dig) and
  `A  @  1.2.3.4  3600` or `Type / Host / Value / TTL` columns (panel tables,
  tab-separated or spaced). Quoted TXT values, split TXT chunks, MX/SRV/CAA
  values, `Automatic` TTLs, `A Record` labels, comments and header rows are all
  handled. The box tells you how many records it found and how many lines it
  had to skip.
- **In the note** each record is its own line, like
  `A @ 203.0.113.10 (TTL 3600)`. Rows with no value are left out, and the
  whole `Old DNS:` line disappears when the field is empty (it's optional).

**DNS changes** (`{dnsChanges}`) is an automatic summary comparing Old DNS with
New DNS. It updates live under the two tables and goes into the note as:

    DNS changes:
    - Changed: A @ 1.2.3.4 -> 5.6.7.8
    - Added: NS @ ns1.new.com
    - Removed: TXT @ v=spf1 old ~all
    - TTL changed: CNAME www 300 -> 3600
    - Unchanged: 1 record

Records are matched by type and host. Same type and host with a different
value counts as *Changed*; a record only in New is *Added*, only in Old is
*Removed*; the same record with a different TTL is *TTL changed*. Case,
trailing dots and TXT quoting are ignored when comparing, and `1h` equals
`3600`. With nothing entered the line stays out of the note.

In **Settings → Placeholders** the input types **DNS records** and **DNS change
summary (old vs new)** are available for any placeholder, so you can make your
own (for example `{mxRecords}`), or point a summary at a different pair of DNS
fields.

*Upgrading:* if you never edited the Case Note template, it picks up the new
`{dnsChanges}` line by itself. If you customised it, nothing is rewritten:
add `DNS changes:{dnsChanges}` (and change `Old DNS: {oldDns}` to
`Old DNS:{oldDns}`) wherever you want them. Text you had already typed into
Old / New DNS is turned into rows where it can be read as records.

## Editing the templates

Click **Edit template** to change the wording of the current tab's template.
Templates use `{placeholder}` syntax — add, rename, or remove placeholders
and the fill-in form on the previous screen rebuilds itself to match.

Placeholder behaviour is no longer hard-coded — open **Settings** (top
right) to manage it. See below.

## Settings

**Settings** (top right) is split into four categories, along the top:

- **General** — the Dark / Light theme, **Backup** (Export / Import) and a link
  to About.
- **Placeholders** — every `{placeholder}` you use; see below.
- **Soft warnings** — the amber hints under fields that look off; see below.
- **History** — snapshots of your setup you can go back to; see below.

Opening a placeholder or a warning to edit it takes over the screen; **Back**
returns to the category you came from.

### Placeholders

The **Placeholders** category lists every placeholder you use, what kind of
input it shows, and which templates use it. Click one to edit:

- **Placeholder name** — renaming it rewrites `{oldName}` to `{newName}` in
  every template automatically, carries over anything you'd typed, and
  updates the settings that point at it (a checklist that follows it, an
  auto field that depends on it, its saved category pick).
- **Label shown in the form** — e.g. `{department}` can be labelled "Team".
- **Optional** — tick this and the whole line that placeholder sits on
  disappears from the note when it's left blank, instead of showing
  `_____`. For fields that only apply sometimes (like `{oldDns}` /
  `{newDns}` on Case Note), this keeps the copied note clean without
  making you delete unused lines by hand.
- **Placeholder hint** — for text and long-text fields, greyed-out example
  text shown in the empty input (e.g. `{caseId}` hints `26838210`).
- **Clean what's typed or pasted** — for single-line text (and, for URLs,
  toggle + text) fields. *URL → domain* drops `https://`, `www.`, any path and
  trailing slash, and lowercases the domain; it's on for `{customerDomain}` and
  `{server}`. *Case ID → I-number* is on for `{caseId}`. *Email* trims, drops
  `mailto:` and `<angle brackets>` and lowercases, so `Jane Doe <Jane@Example.com>`
  becomes `jane@example.com`; a placeholder with "email" in its name (like
  `{customerEmail}`) gets it automatically. Leading and trailing spaces are
  trimmed on every field. Anything that doesn't look like what the option
  expects is left exactly as typed.
- **Soft warnings** — a small amber hint under a text field when the value
  looks off ("Case IDs are usually 8 digits.", "This doesn't look like a
  domain.", "This doesn't look like an email address."). They only advise:
  nothing is blocked and the note is unchanged. Untick "Show soft warnings"
  in a field's Settings to silence them for just that field. The warnings
  themselves are managed from **Settings → Soft warnings** (see below).
- **Delete placeholder** — the ✕ on each row of the Placeholders list (also at the bottom of each placeholder's page).
  It takes `{name}` out of every template that uses it (a line that only
  held that placeholder is deleted along with its label; a line with other
  placeholders just loses the tag), and clears its settings and any saved
  entries. Built-in placeholders you delete stay off the list until a
  template uses them again. Not to be confused with **Reset to default** /
  **Clear settings**, which only change how the placeholder behaves and
  leave it in your templates.
- **Input type**:
  - *Single-line text* / *Long text box* — plain input, typed text goes in as-is.
  - *Dropdown* — you manage the option list; each option is both what you
    pick and what lands in the note. Tick "Show a Manage list link" to also
    get the quick add/delete panel on the fill-in form (this is what
    `{department}` does). Tick "Group into categories" to give every option a
    category: the form then shows a Category dropdown that filters the second
    dropdown (this is what `{issue}` does).
  - *Multi-select checklist* — same managed option list as Dropdown, but
    shown as checkboxes and any number can be ticked. Each ticked item
    becomes its own line in the note (this is what
    `{troubleshootingSteps}` does).
  - *Toggle buttons* — no typing. Each option has a button label and the
    text it writes into the note, so a button reading "SSL" can output
    "SSL/TLS" if you prefer.
  - *Toggle + text (prefix)* — pick a mode, type a value, and the mode's
    prefix is stuck on the front (e.g. `mail.` + `customerdomain.com`).
  - *DNS records* — a table of records (type / host / value / TTL) with
    paste-parse; see **DNS records** above.
  - *DNS change summary (old vs new)* — no input; compares two DNS records
    fields and lists what was added, removed or changed. Pick which two fields
    it compares.
  - *Auto (calculated)* — no input at all; the value is looked up from the
    toggles it depends on. Rules are rows you edit yourself: pick an option
    for each toggle it depends on, type the value that should come out, and
    the first matching rule wins (with a fallback if none match).

## Reference tables: editing single rows

In **Edit table**, the header's **✕** removes a column from every row and the
header's **+** adds one to every row. To change just one row, hover a cell:
**+** adds a blank cell before it and **✕** removes it, and the cells after it
shift over. No other row is touched, so rows can end up with different numbers
of cells. The **+** at the end of a row adds a cell to the end of that row. In
the normal view a shorter row stretches its last cell across the gap, and
copying a row copies just the cells it has.

### Soft warnings (Settings → Soft warnings)

The four built-in warnings (case ID not a number, case ID not 8 digits, not
a domain, not an email) are just rows in this list, so you can change or
remove them like any other.

- **Edit** — click a row. Pick what it **applies to** (any text field, every
  Case ID / Domain / Email field, or one specific placeholder), **when to
  warn** (isn't a number, isn't a domain or email, is / isn't a certain
  length, contains or doesn't contain some text, matches or doesn't match a
  regex), and the **warning text**. The **Try it** box shows live whether a
  sample value would trigger it.
- **Add** — **+ Add soft warning**.
- **Remove** — the ✕ on a row (or inside its editor).
- **Reset to built-in** puts the original four back and drops your own.
- If several warnings apply to one field, the first one in the list that
  triggers is shown. Tests run on the value after cleaning, so a case ID is
  checked as its bare digits and a pasted URL as its bare domain.
- Warnings that point at one placeholder follow it when it's renamed and go
  with it when it's deleted. They're included in Export / Import.

Use **+ Add** at the bottom of the list to define a brand-new placeholder,
then drop `{yourName}` into any template.

The built-in ones (`{status}`, `{outcome}`, `{completed}`, `{department}`,
`{server}`, `{protocol}`, `{security}`, `{incomingPort}`, `{outgoingPort}`)
all start with sensible defaults and are fully editable — **Reset to
default** puts any of them back. For example, `{incomingPort}` ships with
four rules (993 / 143 / 995 / 110 depending on `{protocol}` and
`{security}`) and `{outgoingPort}` with two (465 / 587), and you can change
those port numbers, add a rule, or point them at different toggles.

Anything with `notes`, `reason`, `summary`, `steps`, `issue`, `resolution`,
`request`, `verification`, `description`, or `offer` in the name still gets
a bigger box by default without any setup; everything else defaults to a
plain single-line field.

**Restore default** reverts the editor box back to the built-in wording
(you still need to hit Save to actually apply it). Only templates you've
actually changed are stored, so a built-in you haven't touched keeps
following the extension's own wording when it's updated. Your custom wording and
whatever you've typed into the fields are both saved automatically, per
workflow tab, so closing the popup mid-note doesn't lose your work.

## History / snapshots (Settings → History)

A **snapshot** is a copy of your setup: templates you've edited or added,
reference tables, tab names and order, placeholder settings and soft warnings.
It does **not** include what you're typing into the forms, so restoring one
never wipes the case you're working on.

- **Automatic snapshots** are saved just *before* something changes: saving or
  deleting a template, table, placeholder or soft warning, editing a dropdown
  list from the form, resetting settings, importing a backup, or restoring
  another snapshot. Edits made within about five minutes of each other share
  one snapshot, and a snapshot identical to the latest one isn't saved again.
  Import and Restore always save one first, even if you turn the switch off.
- **Save a snapshot now** (with an optional name) makes one yourself. Ones you
  save, or mark **Keep**, are never removed automatically; the automatic ones
  are trimmed to the newest 5, 10, 20 (default) or 50.
- **See changes** on a snapshot lists what restoring it would do (bring back a
  template, change a placeholder's settings, and so on) so you can pick the
  right one. **Restore** replaces your current setup after asking; the current
  setup is snapshotted first, so a restore can itself be undone.
- **Rename**, **Keep** and **Delete** manage individual snapshots; **Delete all
  snapshots** clears the list.

Snapshots live in this browser only and are not part of Export / Import.

## Backing up / transferring your data

Both buttons are in **Settings → General**, under Backup.

**Export** downloads everything — templates you've edited or added, your
placeholder settings from the Settings screen, your saved field values,
the Knowledge Base and the Cases panel — as a single JSON
file. **Import** loads one of those files back in; it asks for
confirmation first since it replaces whatever's currently saved. A snapshot of
your current setup is saved before an import replaces it. Handy for moving
your setup to a new machine, or just keeping a backup somewhere safe since
none of this syncs anywhere on its own.

## Permissions

- `storage` — saves your template wording and in-progress field values.

## Dark / light theme

The button next to **About** in the header (and **Settings → General**) switches between the dark and light
theme (it's labelled with the theme a click switches to). The choice is
remembered on this browser and isn't part of Export/Import.

## About

The **About** button (top right, next to Settings) explains what the extension
does, lists a few tips, and has a pun generator for slow moments. Version
number is shown there too.

## Resizing the top section

A thin divider with a small grip sits just above **Clear fields** / **Paste from**. Drag it up to
shrink the pinned top section (title, buttons, search, tabs); it scrolls inside itself, and the
fields and Preview below take the freed space. Drag it down to give the tabs more room (the form below shrinks to fit).
Double-click it (or press End while it is focused) to go back to automatic height. Up/Down arrows
nudge it. The height is remembered, and it always leaves room below for the fields and the button bar.

## Paste from another template

Next to **Clear fields** there's a **Paste from** button. Pick another template and
any details already filled in there (Domains, Invoice, Member ID, ...) are copied into
the open template. Fields are matched by their {placeholder} name, so only fields that
exist on both templates are pasted. That covers typed text, dropdown choices, checklists, DNS rows and toggle buttons (brand, verified, protocol, currency, ...). The list only shows templates that have matching
details filled in.

## DNS changes summary

`{dnsChanges}` is independent of `{oldDns}` and `{newDns}`. Each placeholder prints its own
labelled lines, so `Old DNS:` and `New DNS:` appear in the note (with their records) whether or
not the template also has `{dnsChanges}`. Leave `{dnsChanges}` out if you only want the full
records, or leave out `{oldDns}` / `{newDns}` if you only want the Added / Removed summary.

## Show a field only for certain choices

In Settings → placeholder editor, **Show this field → Only when {field} is…** hides a
field until a dropdown, checklist or toggle has one of the values you tick. Hidden fields
are left out of the form and the note. Example: Deleted DNS and Added DNS appear only when
{issue} is "Update/modify DNS".

DNS record fields also have a **Detailed** layout (type, host and value on separate lines,
blank line between records). Add as many records as you need with **+ Add record**.

## Cases panel and the fixed dashboard

The dashboard (everything except the Cases panel) has one fixed width and is pinned to the
window's right edge. Showing or hiding the Cases panel only grows or shrinks the window to
the left; the dashboard never stretches, shrinks or moves. Its width is measured once, the
first time the window opens, and kept (it is applied before the first paint on every open).

If the window is ever wider than it needs to be, the Cases panel soaks up the spare width, and with the panel hidden the window pulls itself in to fit the dashboard (right edge fixed). No blank gap.

Resizing: drag the window edge to make the dashboard wider or narrower; it keeps that width (remembered). Showing/hiding the Cases panel never changes it.

**Resizing the Cases panel:** drag the thin divider on the panel's right edge. The window keeps its size; the panel gets
the width you give it and the dashboard adjusts (never narrower than 400px; the panel never narrower than 200px).
Double-click the divider to go back to the default split. The split is remembered: showing the panel again grows the
window by that panel width, with the dashboard's right edge staying put.

**Remembers its size:** the window opens at the width and height it had when you last used it (including the Cases
panel if it was open). The dashboard fills the window when the panel is hidden, or keeps the remembered split when
the panel is showing. Position is still centred over the Chrome window you opened it from.

## Cases panel: pictures

Screenshots attached to a note (pasted into a text box, or an Image field) now stay with the case. In the Cases list each
`[Image: ...]` line is shown as the picture itself; click a picture to see it full size (click or Esc to close).
**Copy**, **Copy day** and **Copy all** put the text and the pictures on the clipboard together (plain text still works
everywhere else), and **Edit** puts the pictures back into the form. Each case's pictures are stored under their own key
(`cnh_ci_<case id>`) and are removed when the case is deleted or cleared. Since v1.20.2 they are included in Export / Import backups. Cases logged before v1.20.0 have no pictures saved, so they keep showing the
`[Image: ...]` text.

## Cases panel: date selector

Under the Cases search box, **All dates** opens a small calendar. Pick a day to
show only that day's cases (Copy all / Copy day then work on what is shown).
Days that have cases carry a dot; use « ‹ › » to change year / month, **Today**
for today, and **All dates** (or the ✕ beside the box) to go back to everything.
It works together with the search box and arrow keys / Escape work inside the
calendar.

## v1.20.1

- **Paste from** now brings over pictures attached to a text box (Ctrl+V screenshots), not just the typed text.
  A field that only has pictures (no text) is included too. Matching is by placeholder name, case-insensitive.

## v1.20.2

- **Export / Import now include pictures**: screenshots pasted into text boxes, Image fields, and the pictures saved
  with each case in the Cases panel (backup format v3, new `caseImages` entry). Older backups (no pictures) still
  import fine, and cases with the same id keep their pictures. Backups with many screenshots can be large; the
  "Exported!" message shows the file size when it is over 1 MB.

## v1.20.3

- **Reference tables keep line breaks when you paste.** Pasting a numbered list, steps or indented bullets into a table
  cell (Edit table) used to squash it into one line; the cell now becomes a multi-line box with the text exactly as
  copied. The table view also shows line breaks and indentation, and clicking the cell copies it the same way.
  Same paste fix for the "written into the note" boxes in Settings (option text, prefix, rule values).

## v1.20.4

- **Copy puts each picture on its own line.** In the rich-text copy (Copy button, and Copy / Copy day / Copy all in the
  Cases panel) a picture used to sit inline, so Slack and similar apps showed it beside or over the text. Now there is a
  line break before and after every picture, and it is a block element, so the text after it continues below.
  Plain text copy is unchanged.

## v1.22.0

- The Knowledge Base is now **infoHub**: the header button, the window title (just "infoHub"), the search box and the Alt+K command all use the new name.
- New infoHub logo (a hub with four linked nodes and an "i") in the infoHub header, the window's tab/taskbar icon (icons/infohub.svg).
- **Esc** in infoHub takes you back to the home page: closes any open dialog or picture first, otherwise clears the search, collapses every entry, goes to "All entries" and scrolls to the top.
- Clicking **infoHub** in its header does the same (closing any open dialog too).

## v1.22.1

- The TechNotes window now opens at a default size of 1150 × 990 (outer size), whether or not the Cases panel is showing. Chrome trims it to fit smaller screens. Dragging the window to a new size is remembered as before; updating to this version clears the old remembered size once so the new default applies.

## v1.22.2

- The Cases panel is now **open by default**: the window opens at 1150 × 990 with the panel already showing (dashboard on the right, Cases on the left). The first time after updating it opens like this once; if you hide the panel (header Cases button or Settings > General) that choice is remembered as before.

## v1.22.3

- **Alt+F** now opens infoHub (it was Alt+K). It works from any Chrome window, and inside the Case Notes window too. If Chrome keeps the old Alt+K from before the update, set it yourself at `chrome://extensions/shortcuts` (TechNotes > "Open infoHub").

## v1.23.0

- **Table cells in infoHub are now rich text.** In a Table entry, click any cell and use the formatting bar above the table (font, size, bold / italic / underline / strike, colours, links, bullet and numbered lists, alignment, undo / redo, Clear). It works on whichever cell you last clicked, and stays pinned while you scroll a big table.
- **Tag and Badge pills.** Select text in a cell and click **Tag** for a pill like "404 Not Found" (select several lines to get one pill per line) or **Badge** for a green label like "Frontline can resolve". Click again to turn it back into plain text. That, with lists and links, lets you build entries like the "At a glance" layout: symptoms as pills, numbered resolution steps, a badge with bullet points, and a list of related-article links.
- **Paste pictures into cells.** Click a cell and press Ctrl+V with a screenshot (or drag an image in, or use the Image button). Click the picture to make it Small / Medium / Large / Original, Edit or Remove it. Pictures already in the Images box can be moved into a cell with **Insert in cell**.
- **Copy keeps the look.** Cell click, Copy row and Copy all put an HTML version on the clipboard (lists, pills, links, pictures) next to the plain tab-separated one, so a table pastes nicely into an email or ticket and stays plain in plain boxes. Multi-line cells are quoted so a spreadsheet keeps them in one cell. Tables with no formatting copy exactly as before.
- **No more "Column 1 / Column 2" typed into new tables.** New tables start with empty headers showing the placeholder "Add header here", and empty cells show "Add text here". Blank headers stay blank (the header row is simply hidden if every header is blank). Old tables whose hidden header row held auto names like "Column 1" now show the placeholder when you edit them.
- Older entries and backups load unchanged; the formatted cells are stored alongside the plain text, so search still finds words inside them.

## v1.24.0

- **At a glance for every infoHub entry.** In the entry editor you can now add a one-line **summary**, **tags** and **related entries**. An opened entry shows them in a strip at the top: the summary, clickable `# tag` chips, and `→ related entry` links that jump straight to that entry.
- **Tags** also show next to the title on the collapsed card. Click any tag to see every entry with that tag (click the tag in the header, or Esc, to clear). The editor suggests tags you've already used, and search finds entries by tag and summary.
- **Related links work both ways**: link A to B once and B shows A too. Deleting an entry removes it from other entries' related lists. The summary replaces the grey preview line on the collapsed card.

## v1.25.0

- The header buttons **infoHub, Settings, About and Light/Dark** are now icons: the infoHub logo, a gear, an "i" in a circle, and a sun (click to go light) or moon (click to go dark). Hover any of them for its name; the shortcut (Alt+F for infoHub) still shows in its tooltip.

## v1.26.0

- **Renamed from Case Notes Helper to TechNotes** everywhere you see it: the window title, the header, About, Settings, the Chrome extensions page and the shortcut list. Your saved templates, cases, infoHub entries and settings are untouched (the name change does not affect stored data).
- **New logo to match:** the note page with a terminal prompt (`>_`) on it, in the same amber and dark colours. Updated in the header and in the 16 / 48 / 128 px toolbar and extensions-page icons.

## v1.27.0

- The second row of header buttons are icons now too: **Cases** (a side-panel icon, highlighted while the panel is open, with a small badge showing how many cases are logged while it is closed), **Reorder** (up/down arrows; a tick while you're rearranging, with an ✕ to cancel) and **Edit** (a pencil, for both templates and tables). Hover any of them for its name.

## v1.28.0

- **Insert a row or column anywhere in a table.** Both table editors (TechNotes **Edit table** and an infoHub **Table** entry) used to add rows and columns only at the end. Now every column header has **+ ←** and **→ +** (insert a column to the left / right, in every row) and every row has **+ ↑** and **+ ↓** (insert a blank row above / below). The new row or column gets the cursor straight away. The existing **+ Row**, **+ Column** and per-cell **+** / **✕** still work as before.

## v1.28.1

- **infoHub "Sync from templates" now picks up edits.** It used to add only templates and tables that were missing from infoHub and skip everything already there, so changing a template or table in TechNotes (e.g. **List of NS**) never reached infoHub. Sync now also compares each synced entry with its template/table and, if they differ, opens an **Update from TechNotes** list showing what changed (title / text / table contents, with row and column counts before and after). Tick the entries to refresh and press **Update selected**. Category, pin, tags, summary, related links and pictures are kept. Entries you formatted inside infoHub start unticked, because updating replaces them with the plain template content. Q&A entries are matched by question, so adding a question in the middle no longer shifts the others.

## v1.28.2

- **Fixed: infoHub "Sync from templates" did nothing in v1.28.1.** The new *Update from TechNotes* list hit a script error and never opened. It opens now. The same error was also behind the **Cancel** button of infoHub's confirmation dialogs (e.g. deleting a category that has entries), which is fixed too.

## v1.28.3

- **Toggle fields now follow the template order.** Y/N and other toggle-button fields (Verified, Brand, Website is hosted with us...) used to be pulled together into one row at the position of the first one. Each now sits where its placeholder is in the template. If you liked the old layout, tick **Group toggle buttons into one row** in Settings to bring it back.

## v1.28.4

- **Fixed: "Uncaught TypeError: ... .trim is not a function" and Copy not working.** A leftover saved value of the wrong kind (a list or object from a field whose type was changed) could break the whole note. Such values are now ignored.

## v1.28.5

- **New field type: Toggle buttons (none selected by default).** Pick it in Settings → Placeholders → Type. No button is lit by default; click one to turn it on, click it again to turn it off. While none is on, nothing is written for the field (tick **Optional** to drop its line from the note as well). Plain *Toggle buttons* work as before.

## v1.28.6

- **Fixed: the case count in the Cases panel was cut off at the corner.** The number beside the "Cases" title was picking up the style meant for the small badge on the toolbar button, so it jumped to the panel's top-right corner and got clipped. It now sits next to the title again (e.g. **Cases 124**). The toolbar badge is unchanged.

## v1.28.7

- **New: hide a template or table from the dashboard without deleting it.** Settings → General → **Tabs on the dashboard** lists every tab with a tick box; untick one to hide it, tick it again to bring it back (**Show all tabs** resets). You can also right-click a tab on the dashboard and choose Hide. A hidden tab keeps its wording, saved values and cases, is left out of the tab search, and still shows (dimmed, dashed) while you reorder tabs. If you open a case that belongs to a hidden template, that tab appears until you leave it. The last visible tab can't be hidden. The hidden list is part of Export / Import.

## v1.28.8

- **Fixed: a pasted picture landed beside the last line of text instead of under it.** Teams (and similar chat apps) ignore the line break in front of a picture, so it sat to the right of "Other relevant information:". Copy now sends every line and every picture as its own block, so a picture always starts a new line. The same applies to **Copy** / **Copy all** in the Cases panel.

## v1.28.9

- **Hidden tabs: two edge cases.** Restoring a History snapshot now lands on a visible tab, and a backup or saved list that would hide every tab no longer leaves the tab bar empty (the hidden list is cleared instead).

## v1.28.10

- **Export / Import now include everything.** A backup also carries your History snapshots, the window size, dashboard width and top-split height, and the internal one-time-fix flags (so a fresh install doesn't re-run those fixes over an imported setup). Importing adds the backup's snapshots to your History; the "Before importing a backup" snapshot is kept. Backups can be larger now because of the snapshots.
- **Cloud sync (Settings → General).** Sign in with your own account (Supabase) and keep a private online copy of your whole setup. **Upload** saves it, **Download** brings it to another computer (a snapshot is taken first). Each person only ever sees their own copy. Nothing syncs automatically. The sign-in is kept only in this browser and is never part of Export.
