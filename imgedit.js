// Image editor used by the Knowledge Base: crop, rotate, flip, resize, draw,
// arrows, boxes, highlight, text, and blur / cover (handy for hiding customer
// details in a screenshot). Everything happens on a canvas in the browser.
//
//   KBImageEditor.create(dataUrl, { onSave(dataUrl), onCancel() }) -> HTMLElement
//
// kb.js puts the returned element inside a modal.

(function () {
  "use strict";

  const MAX_SIDE = 1600;

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

  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  const TOOLS = [
    { id: "pen",       label: "Pen",       hint: "Draw freehand" },
    { id: "arrow",     label: "Arrow",     hint: "Drag from the tail to the point" },
    { id: "rect",      label: "Box",       hint: "Draw an outlined box" },
    { id: "highlight", label: "Highlight", hint: "Drag over something to highlight it" },
    { id: "text",      label: "Text",      hint: "Type the text in the box, then click where it goes" },
    { id: "blur",      label: "Blur",      hint: "Drag over private details to pixelate them" },
    { id: "cover",     label: "Cover",     hint: "Drag to cover something with a solid box" },
    { id: "crop",      label: "Crop",      hint: "Drag the area to keep, then press Apply crop" }
  ];

  function create(src, cb) {
    cb = cb || {};
    const canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");
    const overlay = document.createElement("canvas");
    let octx = overlay.getContext("2d");

    let tool = "pen";
    let color = "#e8646b";
    let sizeIdx = 1;
    const SIZES = [{ n: "Thin", v: 2 }, { n: "Medium", v: 4 }, { n: "Thick", v: 8 }, { n: "XL", v: 14 }];
    let history = [];
    let original = null;
    let drag = null;      // { x0, y0, x1, y1 } in image pixels while the pointer is down
    let cropRect = null;  // pending crop
    let ready = false;

    // ── Helpers ─────────────────────────────────────────────────────────
    const k = () => Math.max(1, canvas.width / 800); // keeps strokes/text readable on big images
    const lw = () => SIZES[sizeIdx].v * k();

    function cloneCanvas(c) {
      const n = document.createElement("canvas");
      n.width = c.width; n.height = c.height;
      n.getContext("2d").drawImage(c, 0, 0);
      return n;
    }
    function pushHistory() {
      history.push(cloneCanvas(canvas));
      if (history.length > 25) history.shift();
      refreshButtons();
    }
    function replaceWith(c) {
      canvas.width = c.width; canvas.height = c.height;
      ctx = canvas.getContext("2d");
      ctx.drawImage(c, 0, 0);
      cropRect = null;
      fit();
      refreshButtons();
    }

    function fit() {
      const availW = Math.max(200, (stage.clientWidth || 800) - 24);
      const availH = Math.max(160, Math.round(window.innerHeight * 0.52));
      const s = Math.min(1, availW / canvas.width, availH / canvas.height);
      const w = Math.max(1, Math.round(canvas.width * s));
      const hh = Math.max(1, Math.round(canvas.height * s));
      [canvas, overlay].forEach((c) => { c.style.width = w + "px"; c.style.height = hh + "px"; });
      overlay.width = canvas.width; overlay.height = canvas.height;
      octx = overlay.getContext("2d");
      drawOverlay();
      if (sizeInfo) sizeInfo.textContent = canvas.width + " × " + canvas.height + " px";
      if (widthInput) widthInput.value = canvas.width;
    }

    function pos(ev) {
      const r = overlay.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(canvas.width, (ev.clientX - r.left) * canvas.width / r.width)),
        y: Math.max(0, Math.min(canvas.height, (ev.clientY - r.top) * canvas.height / r.height))
      };
    }
    const norm = (d) => ({ x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) });

    // ── Drawing primitives (used for preview on the overlay and the real thing on the canvas) ──
    function drawArrow(c, x0, y0, x1, y1) {
      const head = Math.max(12 * k(), lw() * 4);
      const ang = Math.atan2(y1 - y0, x1 - x0);
      c.save();
      c.strokeStyle = color; c.fillStyle = color; c.lineWidth = lw(); c.lineCap = "round";
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1 - Math.cos(ang) * head * 0.6, y1 - Math.sin(ang) * head * 0.6); c.stroke();
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x1 - head * Math.cos(ang - Math.PI / 7), y1 - head * Math.sin(ang - Math.PI / 7));
      c.lineTo(x1 - head * Math.cos(ang + Math.PI / 7), y1 - head * Math.sin(ang + Math.PI / 7));
      c.closePath(); c.fill();
      c.restore();
    }
    function drawShape(c, t, d, preview) {
      const r = norm(d);
      c.save();
      if (t === "rect") { c.strokeStyle = color; c.lineWidth = lw(); c.lineJoin = "round"; c.strokeRect(r.x, r.y, r.w, r.h); }
      else if (t === "highlight") { c.globalAlpha = 0.4; c.fillStyle = color; c.fillRect(r.x, r.y, r.w, r.h); }
      else if (t === "cover") { c.fillStyle = color; c.fillRect(r.x, r.y, r.w, r.h); }
      else if (t === "arrow") { drawArrow(c, d.x0, d.y0, d.x1, d.y1); }
      else if (t === "blur" && preview) {
        c.fillStyle = "rgba(120,120,120,0.35)"; c.fillRect(r.x, r.y, r.w, r.h);
        c.setLineDash([6 * k(), 4 * k()]); c.strokeStyle = "#fff"; c.lineWidth = 1.5 * k(); c.strokeRect(r.x, r.y, r.w, r.h);
      }
      c.restore();
    }
    function pixelate(x, y, w, hh) {
      x = Math.round(x); y = Math.round(y); w = Math.round(w); hh = Math.round(hh);
      if (w < 2 || hh < 2) return;
      const block = Math.max(8, Math.round(10 * k()));
      const t = document.createElement("canvas");
      t.width = Math.max(1, Math.ceil(w / block)); t.height = Math.max(1, Math.ceil(hh / block));
      t.getContext("2d").drawImage(canvas, x, y, w, hh, 0, 0, t.width, t.height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(t, 0, 0, t.width, t.height, x, y, w, hh);
      ctx.restore();
    }

    function drawOverlay() {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      if (tool === "crop") {
        const r = drag ? norm(drag) : cropRect;
        if (r && r.w > 1 && r.h > 1) {
          octx.save();
          octx.fillStyle = "rgba(0,0,0,0.5)";
          octx.fillRect(0, 0, overlay.width, r.y);
          octx.fillRect(0, r.y + r.h, overlay.width, overlay.height - r.y - r.h);
          octx.fillRect(0, r.y, r.x, r.h);
          octx.fillRect(r.x + r.w, r.y, overlay.width - r.x - r.w, r.h);
          octx.setLineDash([8 * k(), 5 * k()]); octx.strokeStyle = "#fff"; octx.lineWidth = 2 * k();
          octx.strokeRect(r.x, r.y, r.w, r.h);
          octx.restore();
        }
      } else if (drag && ["rect", "highlight", "cover", "arrow", "blur"].includes(tool)) {
        drawShape(octx, tool, drag, true);
      }
    }

    // ── Pointer handling ────────────────────────────────────────────────
    overlay.addEventListener("pointerdown", (ev) => {
      if (!ready) return;
      ev.preventDefault();
      const p = pos(ev);
      if (tool === "text") {
        const txt = textInput.value;
        if (!txt.trim()) { textInput.focus(); setHint("Type the text in the box first, then click on the image."); return; }
        pushHistory();
        const px = Math.round(SIZES[sizeIdx].v * 5 * k());
        ctx.save();
        ctx.font = "bold " + px + "px -apple-system, 'Segoe UI', Arial, sans-serif";
        ctx.textBaseline = "top"; ctx.fillStyle = color;
        ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = px * 0.12;
        ctx.fillText(txt, p.x, p.y);
        ctx.restore();
        return;
      }
      overlay.setPointerCapture(ev.pointerId);
      drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      if (tool === "pen") {
        pushHistory();
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw(); ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.01, p.y + 0.01); ctx.stroke(); ctx.restore();
        drag.last = p;
      }
      drawOverlay();
    });
    overlay.addEventListener("pointermove", (ev) => {
      if (!drag) return;
      const p = pos(ev);
      drag.x1 = p.x; drag.y1 = p.y;
      if (tool === "pen") {
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw(); ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(drag.last.x, drag.last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.restore();
        drag.last = p;
      } else drawOverlay();
    });
    function endDrag(ev) {
      if (!drag) return;
      const d = drag; drag = null;
      if (tool === "pen") { drawOverlay(); return; }
      const r = norm(d);
      if (tool === "crop") {
        cropRect = r.w > 4 && r.h > 4 ? r : null;
        drawOverlay(); refreshButtons();
        return;
      }
      const tiny = tool === "arrow" ? (Math.abs(d.x1 - d.x0) + Math.abs(d.y1 - d.y0) < 6) : (r.w < 4 || r.h < 4);
      if (tiny) { drawOverlay(); return; }
      pushHistory();
      if (tool === "blur") pixelate(r.x, r.y, r.w, r.h);
      else drawShape(ctx, tool, d, false);
      drawOverlay();
    }
    overlay.addEventListener("pointerup", endDrag);
    overlay.addEventListener("pointercancel", endDrag);

    // ── Actions ─────────────────────────────────────────────────────────
    function rotate(dir) {
      pushHistory();
      const n = document.createElement("canvas");
      n.width = canvas.height; n.height = canvas.width;
      const c = n.getContext("2d");
      c.translate(n.width / 2, n.height / 2);
      c.rotate(dir * Math.PI / 2);
      c.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      replaceWith(n);
    }
    function flip(horizontal) {
      pushHistory();
      const n = document.createElement("canvas");
      n.width = canvas.width; n.height = canvas.height;
      const c = n.getContext("2d");
      if (horizontal) { c.translate(n.width, 0); c.scale(-1, 1); } else { c.translate(0, n.height); c.scale(1, -1); }
      c.drawImage(canvas, 0, 0);
      replaceWith(n);
    }
    function applyCrop() {
      if (!cropRect) return;
      const r = { x: Math.round(cropRect.x), y: Math.round(cropRect.y), w: Math.round(cropRect.w), h: Math.round(cropRect.h) };
      pushHistory();
      const n = document.createElement("canvas");
      n.width = Math.max(1, r.w); n.height = Math.max(1, r.h);
      n.getContext("2d").drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      replaceWith(n);
    }
    function applyResize() {
      const w = Math.round(Number(widthInput.value));
      if (!w || w < 20 || w > 4000) { setHint("Width must be between 20 and 4000 px."); return; }
      if (w === canvas.width) return;
      pushHistory();
      const hh = Math.max(1, Math.round(canvas.height * w / canvas.width));
      const n = document.createElement("canvas");
      n.width = w; n.height = hh;
      const c = n.getContext("2d");
      c.imageSmoothingQuality = "high";
      c.drawImage(canvas, 0, 0, w, hh);
      replaceWith(n);
    }
    function undo() { const prev = history.pop(); if (prev) replaceWith(prev); }
    function reset() { if (!original) return; pushHistory(); replaceWith(original); }

    function output() {
      let url = canvas.toDataURL("image/png");
      if (url.length > 1500000) url = canvas.toDataURL("image/webp", 0.92); // big photos: smaller file
      return url;
    }

    // ── UI ──────────────────────────────────────────────────────────────
    let sizeInfo = null, widthInput = null, textInput = null, hintEl = null, cropBtn = null, undoBtn = null;
    const toolBtns = {};

    function setHint(t) { if (hintEl) hintEl.textContent = t; }
    function refreshButtons() {
      if (undoBtn) undoBtn.disabled = history.length === 0;
      if (cropBtn) cropBtn.classList.toggle("hidden", !(tool === "crop" && cropRect));
    }
    function selectTool(id) {
      tool = id; drag = null;
      if (id !== "crop") cropRect = null;
      Object.entries(toolBtns).forEach(([t, b]) => b.classList.toggle("is-on", t === id));
      textInput.classList.toggle("hidden", id !== "text");
      overlay.style.cursor = id === "text" ? "text" : "crosshair";
      setHint((TOOLS.find((t) => t.id === id) || {}).hint || "");
      drawOverlay(); refreshButtons();
      if (id === "text") textInput.focus();
    }

    const stage = h("div", { class: "kb-ie-stage" });
    const wrap = h("div", { class: "kb-ie-canvaswrap" }, canvas, overlay);
    stage.append(wrap);

    TOOLS.forEach((t) => { toolBtns[t.id] = h("button", { type: "button", class: "kb-btn kb-btn-small", title: t.hint, onclick: () => selectTool(t.id) }, t.label); });
    const colorInput = h("input", { type: "color", class: "kb-ie-color", value: color, title: "Colour", oninput: () => { color = colorInput.value; drawOverlay(); } });
    const sizeSel = h("select", { class: "kb-select kb-ie-size", title: "Line / text size", onchange: () => { sizeIdx = Number(sizeSel.value); } },
      SIZES.map((s, i) => h("option", { value: String(i), text: s.n })));
    sizeSel.value = String(sizeIdx);
    textInput = h("input", { type: "text", class: "kb-input kb-ie-text hidden", placeholder: "Text to place...", maxlength: 120 });
    cropBtn = h("button", { type: "button", class: "kb-btn kb-btn-small kb-btn-primary hidden", onclick: applyCrop }, "Apply crop");

    const row1 = h("div", { class: "kb-ie-row" },
      h("div", { class: "kb-ie-group" }, ...TOOLS.map((t) => toolBtns[t.id])),
      h("div", { class: "kb-ie-group" }, colorInput, sizeSel, textInput, cropBtn));

    undoBtn = h("button", { type: "button", class: "kb-btn kb-btn-small", onclick: undo, disabled: true }, "Undo");
    widthInput = h("input", { type: "number", class: "kb-input kb-ie-width", min: 20, max: 4000, title: "New width in pixels (height follows)" });
    sizeInfo = h("span", { class: "kb-hint", style: "margin:0" });
    const row2 = h("div", { class: "kb-ie-row" },
      h("div", { class: "kb-ie-group" },
        h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Rotate left", onclick: () => rotate(-1) }, "⟲ Rotate"),
        h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Rotate right", onclick: () => rotate(1) }, "Rotate ⟳"),
        h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Flip left-right", onclick: () => flip(true) }, "Flip ↔"),
        h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Flip top-bottom", onclick: () => flip(false) }, "Flip ↕")),
      h("div", { class: "kb-ie-group" },
        h("span", { class: "kb-hint", style: "margin:0", text: "Width" }), widthInput,
        h("button", { type: "button", class: "kb-btn kb-btn-small", onclick: applyResize }, "Resize"),
        sizeInfo),
      h("div", { class: "kb-ie-group" }, undoBtn,
        h("button", { type: "button", class: "kb-btn kb-btn-small", title: "Back to the original image", onclick: reset }, "Reset")));
    widthInput.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); applyResize(); } });

    hintEl = h("div", { class: "kb-hint", style: "margin:8px 0 0" });
    const foot = h("div", { class: "kb-ie-foot" },
      h("button", { type: "button", class: "kb-btn", onclick: () => cb.onCancel && cb.onCancel() }, "Cancel"),
      h("button", { type: "button", class: "kb-btn kb-btn-primary", onclick: () => { if (ready && cb.onSave) cb.onSave(output()); } }, "Save image"));

    const root = h("div", { class: "kb-ie" }, row1, row2, stage, hintEl, foot);

    // Load the picture (scaled down if huge), then fit it to the window.
    loadImg(src).then((img) => {
      const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * s));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * s));
      ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      original = cloneCanvas(canvas);
      ready = true;
      selectTool("pen");
      requestAnimationFrame(fit);
    }, () => setHint("Couldn't open this image."));

    window.addEventListener("resize", () => { if (root.isConnected) fit(); });
    return root;
  }

  window.KBImageEditor = { create };
})();
