// Builds the web version into docs/ (served by GitHub Pages): node web/build.js
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const out = path.join(root, "docs");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const skip = new Set(["background.js", "manifest.json", "docs", "web", "releases", ".git", ".gitignore", "INSTALL.md", "README.md", "CLAUDE.md"]);
for (const f of fs.readdirSync(root)) {
  if (skip.has(f) || f.startsWith(".")) continue;
  fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });
}
const mf = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
fs.writeFileSync(path.join(out, "webshim.js"), `window.__TECHNOTES_MANIFEST=${JSON.stringify({ version: mf.version, version_name: mf.version_name + " · web" })};\n` + fs.readFileSync(path.join(__dirname, "webshim.js"), "utf8"));
// Tab icon + install (PWA) tags for the web pages; the extension's own pages don't need them.
const iconTags = (svg) => `<link rel="icon" type="image/svg+xml" href="icons/${svg}">\n<link rel="icon" type="image/png" sizes="48x48" href="icons/icon48.png">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#10141a">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="TechNotes">\n`;
for (const [src, dst] of [["popup.html", "index.html"], ["kb.html", "kb.html"]]) {
  let h = fs.readFileSync(path.join(root, src), "utf8");
  h = h.replace(/(<script src=")/, '<script src="webshim.js"></script>\n$1');
  h = h.replace(/<link rel="icon"[^>]*>\n?/g, ""); // kb.html already has one; replaced by the full set below
  h = h.replace("</title>", "</title>\n" + iconTags(dst === "kb.html" ? "infohub.svg" : "logo.svg").trimEnd());
  if (dst === "index.html") {
    h = h.replace('<script src="theme-init.js"></script>', '<script src="theme-init.js"></script>\n<script src="webresize.js"></script>'); // after theme-init so its saved widths win
    h = h.replace("</head>", '<link rel="stylesheet" href="web.css">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>');
  } else {
    h = h.replace("</head>", '<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>');
  }
  fs.writeFileSync(path.join(out, dst), h);
}
fs.rmSync(path.join(out, "popup.html"), { force: true });
fs.copyFileSync(path.join(__dirname, "web.css"), path.join(out, "web.css"));
fs.copyFileSync(path.join(__dirname, "webresize.js"), path.join(out, "webresize.js"));
fs.copyFileSync(path.join(__dirname, "manifest.webmanifest"), path.join(out, "manifest.webmanifest"));
// Service worker: version-stamped cache name + list of every file to keep for offline use.
const listFiles = (d, base = "") => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? listFiles(path.join(d, e.name), base + e.name + "/") : [base + e.name]);
const precache = ["./"].concat(listFiles(out).filter((f) => f !== "sw.js" && f !== ".nojekyll"));
fs.writeFileSync(path.join(out, "sw.js"), fs.readFileSync(path.join(__dirname, "sw.js"), "utf8")
  .replace("__VERSION__", mf.version + "-" + Date.now().toString(36)).replace("__FILES__", JSON.stringify(precache)));
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log("built docs/ for v" + mf.version);
