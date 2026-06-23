# Standalone Admin Console — Deploy Runbook

The admin console can now ship as its **own app** on its **own subdomain**
(e.g. `admin.smallbridges.co`), fully separate from the public site. This is
pure packaging — **zero changes** to any admin page or its routing.

## What was built

| Piece | Purpose |
|---|---|
| `admin.html` | Standalone entry HTML (noindex). Loads `src/admin/main-admin.tsx`. |
| `src/admin/main-admin.tsx` | Lean boot (theme + observability, no PWA/consumer prefetch). |
| `src/admin/AdminStandalone.tsx` | Root component: App.tsx's provider nest + Router, mounts `AdminApp` at `/admin/*`, redirects `/` → `/admin`. |
| `vite.config.ts` (`ADMIN_BUILD=1`) | Switches the entry to `admin.html` and the output to `dist-admin/`. |
| `npm run build:admin` | `ADMIN_BUILD=1 VITE_ADMIN=true vite build` → emits `dist-admin/`. |
| `vercel.admin.json` | Sample config for the separate Vercel project. |

The public build is **unaffected** — admin stays tree-shaken out of it
(`adminEnabled.ts`). Verified: `npm run build:admin` emits `dist-admin/admin.html`
+ chunks in ~10s.

## Why `/admin/*` is kept on the subdomain

Every internal admin link (sidebar `NAV`, the ⌘K command palette, `OPS_PAGES`)
uses absolute `/admin/...` paths. Keeping that base on the subdomain means **none
of them change** — the subdomain root simply redirects to `/admin`. So
`admin.smallbridges.co/` → `admin.smallbridges.co/admin`.

## Deploy (Vercel — separate project)

1. **New Vercel project** from the same repo (don't reuse the public project).
2. Settings:
   - **Build command:** `npm run build:admin`
   - **Output directory:** `dist-admin`
   - **Framework preset:** Other / None
   - (or just commit `vercel.admin.json` as that project's `vercel.json`)
3. **Env vars** (same Supabase project as public):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `VITE_ADMIN=true` (build script already sets it, but set it in the project too)
   - any `VITE_SENTRY_*` / `VITE_POSTHOG_*` you want admin telemetry on
   - **Do NOT** put `SUPABASE_SERVICE_ROLE_KEY` here — the admin is a browser app
     and authorizes via the user's JWT + the server-enforced `is_admin()` RPCs.
4. **Domain:** add `admin.smallbridges.co` to this project; point the DNS CNAME
   at Vercel.
5. **SPA fallback:** handled by the `rewrites` in `vercel.admin.json`
   (`/(.*) → /admin.html`).

## Security posture (unchanged + reinforced)

- **Authz is server-enforced.** Access is gated by `is_admin(auth.uid())` inside
  41 `SECURITY DEFINER` RPCs + RLS — putting the UI on a subdomain changes
  packaging, not trust. A non-admin who loads the subdomain still can't read or
  write anything.
- `admin.html` is `noindex, nofollow`; `vercel.admin.json` adds `X-Robots-Tag`
  + `X-Frame-Options: DENY`.
- **Recommended:** put the subdomain behind Vercel Access (SSO) or an IP allow-list
  / VPN for defense-in-depth, so the console isn't even reachable publicly.
- The public production build continues to exclude `/admin` entirely.

## Local preview

```bash
npm run build:admin
npm run preview:admin   # serves dist-admin/ — open the printed URL, it redirects to /admin
```

## Still optional / future

- A dedicated Supabase **redirect URL** entry for the admin subdomain (auth
  callback) if you use OAuth sign-in on the console.
- Splitting the admin into its own Vercel **team/project** with stricter member
  access.
