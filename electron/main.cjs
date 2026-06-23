/**
 * Small Bridges Admin — Electron desktop shell.
 *
 * Wraps the standalone admin web build (dist-admin/) in a native macOS window so
 * it ships as a double-clickable .app/.dmg. The UI is identical to the web
 * console; it talks to the same Supabase backend remotely and is gated by the
 * same server-enforced is_admin() + RLS.
 *
 * Why an in-process static server (not loadFile): the admin uses BrowserRouter
 * and redirects "/" → "/admin". A file:// load can't do SPA fallback, so deep
 * paths 404. We serve dist-admin over http://127.0.0.1:<random> with a fallback
 * to admin.html — exactly the behavior the production subdomain has — so routing
 * + the app's CSP ('self' + *.supabase.co) both work unchanged.
 */
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".map": "application/json",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain",
};

/** Where the built admin bundle lives — packaged (resources) vs. dev (repo). */
function distDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "dist-admin")
    : path.join(__dirname, "..", "dist-admin");
}

/** Tiny static file server with SPA fallback → admin.html. */
function startServer() {
  const root = distDir();
  const fallback = path.join(root, "admin.html");
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(fallback)) {
      reject(new Error(`admin build missing at ${root} — run \`npm run build:admin\``));
      return;
    }
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        const resolved = path.normalize(path.join(root, urlPath));
        // Block path traversal outside the build dir.
        if (!resolved.startsWith(root)) {
          res.writeHead(403); res.end("forbidden"); return;
        }
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          const ext = path.extname(resolved).toLowerCase();
          res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
          fs.createReadStream(resolved).pipe(res);
          return;
        }
        // SPA fallback — every non-file route renders the admin shell.
        res.writeHead(200, { "Content-Type": "text/html" });
        fs.createReadStream(fallback).pipe(res);
      } catch (err) {
        res.writeHead(500); res.end(String(err));
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
}

let mainWindow = null;

async function createWindow() {
  let port;
  try {
    port = await startServer();
  } catch (err) {
    const { dialog } = require("electron");
    dialog.showErrorBox("Small Bridges Admin", String(err && err.message ? err.message : err));
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#070a12",
    title: "Small Bridges Admin",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // External links open in the system browser, not inside the shell.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Crash diagnostics — fire only on real failures.
  const wc = mainWindow.webContents;
  wc.on("did-fail-load", (_e, code, desc, url) =>
    console.error(`[admin] did-fail-load ${code} ${desc} ${url}`));
  wc.on("render-process-gone", (_e, d) =>
    console.error(`[admin] render-process-gone ${JSON.stringify(d)}`));

  mainWindow.loadURL(`http://127.0.0.1:${port}/admin`);
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
