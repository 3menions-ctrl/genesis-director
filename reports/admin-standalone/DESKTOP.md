# Admin Desktop App (macOS .dmg)

The standalone admin console can also ship as a **native macOS app** — a
double-clickable `.dmg`/`.app` — by wrapping the `dist-admin` web build in
Electron. Same UI, same server-enforced `is_admin()` + RLS; it just runs in a
native window instead of a browser tab.

## Build it

```bash
npm run build:desktop      # build:admin → electron-builder --mac dmg
# → dist-desktop/Small Bridges Admin-<ver>-arm64.dmg
```

`npm run desktop` runs it un-packaged for a quick local check (builds the admin
bundle, then launches Electron pointing at it).

## How it works

- `electron/main.cjs` starts a tiny in-process static server over
  `http://127.0.0.1:<random>` serving `dist-admin/` with an SPA fallback to
  `admin.html`, then loads `/admin`. This reproduces the production subdomain's
  routing exactly (BrowserRouter + `/` → `/admin` redirect both work), and the
  app's CSP (`'self'` + `*.supabase.co`) is satisfied.
- `extraResources` bundles `dist-admin/` into the packaged app; the main process
  resolves it from `process.resourcesPath` when packaged.
- electron-builder config lives in `package.json` → `"build"`.

## First launch (unsigned build)

The `.dmg` is **unsigned / not notarized** (no Apple Developer cert wired up —
`mac.identity: null`). macOS Gatekeeper will block a plain double-click:

1. Drag the app to **Applications**.
2. **Right-click the app → Open → Open** (only needed the first time), or
   **System Settings → Privacy & Security → "Open Anyway"**.

It needs an internet connection (talks to the live Supabase backend) and an
admin sign-in.

## To ship it properly (optional, later)

- **Codesign + notarize**: set an Apple Developer `identity`, add
  `notarize: true` + an `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`teamId`. Then
  the `.dmg` opens with a normal double-click and is distributable.
- **App icon**: drop an `icon.icns` (or 1024px `icon.png`) and point
  `build.mac.icon` at it (currently the default Electron icon).
- **Universal / Intel**: add `--x64` or `--universal` to the target for non-Apple-Silicon Macs (current build is `arm64`).
- **Auto-update**: electron-builder supports `electron-updater` against a
  release feed if you want in-app updates.

## Notes

- `dist-desktop/` and `dist-admin/` are gitignored — only the source/config is
  committed; rebuild the artifacts with the commands above.
- Installing the toolchain: `npm i` pulls `electron` + `electron-builder` as
  devDeps. If your npm blocks install scripts, fetch the Electron binary once
  with `node node_modules/electron/install.js`.
