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
for (const [src, dst] of [["popup.html", "index.html"], ["kb.html", "kb.html"]]) {
  let h = fs.readFileSync(path.join(root, src), "utf8");
  h = h.replace(/(<script src=")/, '<script src="webshim.js"></script>\n$1');
  if (dst === "index.html") h = h.replace("</head>", '<link rel="stylesheet" href="web.css">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>');
  fs.writeFileSync(path.join(out, dst), h);
}
fs.rmSync(path.join(out, "popup.html"), { force: true });
fs.copyFileSync(path.join(__dirname, "web.css"), path.join(out, "web.css"));
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log("built docs/ for v" + mf.version);
