# TechNotes on the web (no install)

Open the site link, then **Settings → General → Cloud sync** and sign in with your own account. Your setup is saved in your browser and, with **Upload / Download**, in your private online copy. The web version has no hotkeys and no separate window (use a normal tab); the Cases panel needs a wide screen.

To rebuild the site after changing the extension: `node web/build.js` (writes `docs/`, which GitHub Pages serves).

---

# Installing the Chrome extension instead

1. On GitHub click **Code → Download ZIP** and unzip it (or unzip `releases/technotes-v1_28_10.zip`).
2. Open `chrome://extensions` and switch **Developer mode** on.
3. Click **Load unpacked** and pick the unzipped folder that contains `manifest.json`.
4. Open TechNotes (Alt+C), then **Settings → General → Cloud sync** to sign in with your own account.

Each person has their own account and their own private copy of their setup. Updating: download the new ZIP, replace the folder, and click the reload icon on the extension card. Your templates stay in Chrome.
