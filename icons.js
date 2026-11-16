// Small line icons for the header buttons (static markup, so safe to use as innerHTML).
const HDR_ICONS = {
  "sidebar": "<svg class=\"hi\" viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><line x1=\"9\" y1=\"3\" x2=\"9\" y2=\"21\"/></svg>",
  "reorder": "<svg class=\"hi\" viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><line x1=\"12\" y1=\"6\" x2=\"12\" y2=\"18\"/><polyline points=\"7 10 12 5 17 10\"/><polyline points=\"7 14 12 19 17 14\"/></svg>",
  "check": "<svg class=\"hi\" viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><polyline points=\"20 6 9 17 4 12\"/></svg>",
  "close": "<svg class=\"hi\" viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>",
  "edit": "<svg class=\"hi\" viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z\"/></svg>"
};
// Puts an icon (and an accessible name / tooltip) on an icon-only header button.
function setHdrIcon(btn, name, title) {
  if (!btn) return;
  if (btn.dataset.icon !== name) { btn.innerHTML = HDR_ICONS[name]; btn.dataset.icon = name; }
  if (title) { btn.title = title; btn.setAttribute("aria-label", title); }
}
