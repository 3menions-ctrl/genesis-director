# Admin App Audit — Genesis Director ("Small Bridges Admin")

Branch: `full-audit`. Read-only trace. Evidence cited as `file:line`.

The admin is a **separate standalone build**: `admin.html` → `src/admin/main-admin.tsx`
→ `src/admin/AdminStandalone.tsx` → `src/admin/AdminApp.tsx` → `src/refine/*`.
Built via `npm run build:admin` (`ADMIN_BUILD=1 VITE_ADMIN=true vite build`,
`package.json:34`) → `dist-admin/`, deployed as a noindex Vercel subdomain
(`vercel.admin.json`) and as an Electron desktop app (`electron/main.cjs`,
`package.json:36-37`).

---

## 1. ENTRY, AUTH & RBAC

### Boot / entry chain
- `admin.html:18` loads `/src/admin/main-admin.tsx`. CSP is locked
  (`admin.html:11`: `connect-src 'self' *.supabase.co`, `frame-ancestors 'none'`).
- `main-admin.tsx:20-22` mounts `<AdminStandalone/>`.
- `AdminStandalone.tsx:56-65` routes: `/auth` → `Auth`, `/admin/*` → `AdminApp`,
  everything else → `Navigate to="/auth"`. Wrapped in the **same provider nest**
  as the public app (Auth, Credits, Workspace, Studio… `:43-48`).
- `AdminApp.tsx:90-99` wraps the whole layout in
  `<ProtectedRoute><RefineAdminLayout/></ProtectedRoute>` and defines ~90 routes.

### The gate — layered, with the REAL enforcement server-side
There are **three client gates** plus **server enforcement**:

1. **`ProtectedRoute`** (`src/components/auth/ProtectedRoute.tsx`) — only checks a
   valid *session* exists (`:87-143`); it does **NOT** check admin. Its
   "admin lockdown" block (`:169-186`) only *confines* an already-admin user to
   `/admin/*` (bounce-out), it does not *grant* access. So ProtectedRoute alone
   would let any logged-in user render the shell.
2. **`RefineAdminLayout`** (`src/refine/AdminLayout.tsx:78-98`) — the actual
   client admin check: calls `supabase.rpc("is_admin", { _user_id: user.id })`
   and `Navigate to="/" replace` if `!isAdmin` (`:98`). This is what blocks a
   non-admin from seeing any admin page.
3. **`OpsAccessProvider` + `OpsRouteGuard`** (`src/refine/rbac/*`) — scope layer.
   `OpsAccessProvider.tsx:32` re-runs `is_admin`; super-admins get
   `ALL_SCOPES` (`:42`). `OpsRouteGuard.tsx:29` shows a 403 surface if the
   path's scope is missing. Per-path scope map in `scopes.ts`.

`adminEnabled.ts:17-18`: `ADMIN_ENABLED = VITE_ADMIN==='true' || DEV`. In the
public build this is statically `false`, so the lazy `import('./AdminApp')` is
tree-shaken out — admin never ships in the consumer bundle. In the standalone
build it is always `true`.

### Server-side enforcement — **NOT bypassable** (verdict)
- `is_admin(_user_id)` is `SECURITY DEFINER ... SELECT has_role(_user_id,'admin')`
  reading `public.user_roles`
  (`supabase/migrations/20260513005848_...sql:57-66`; original
  `20260112212511_...sql:34-43`). EXECUTE is **revoked from PUBLIC/anon**
  (`20260429224707_...sql:24`).
- **RLS** on sensitive tables uses `is_admin(auth.uid())` directly — e.g. ledger
  (`20260620212145_ledger_core.sql:51-53`), storage usage
  (`20260620213636_storage_billing.sql:8`), user_roles
  (`20260112212511_...sql`).
- **Admin RPCs** are `SECURITY DEFINER` with an `is_admin(auth.uid())` guard that
  `RAISE EXCEPTION 'Unauthorized'` — e.g. `admin_revoke_user_sessions`
  (`20260610094658_admin_user_powers.sql:33-34`), and the family is
  `REVOKE...FROM PUBLIC, anon` (`:57`). The ops aggregate RPCs were hardened to
  return 0 rows for non-admins (`20260704002700_ops_rpcs_admin_gate.sql`:
  `render_failures_histogram`/`render_success_snapshot` include
  `AND public.is_admin(auth.uid())`).
- **Admin edge functions** all re-verify admin on the backend:
  - `admin-analytics/index.ts:64-72` — service-role bypass, else queries
    `user_roles` for role `admin`, 403 otherwise.
  - `admin-delete-auth-user/index.ts:24-37` — same `user_roles` check, 403; logs
    to `admin_audit_log` (`:62-68`).
  - `admin-force-logout/index.ts:25-37` — same check.
  - `admin-user-action/index.ts:73-89` — re-verifies via **`is_admin` RPC on the
    caller's own JWT**, returns `not_admin` 403; self-target protection (`:91+`).
    (Header comment `:4-9` notes a prior bug where the dynamic import of the
    auth-guard was unbundled → 500s; now imported statically.)
  - `admin-stuck-jobs-watchdog/index.ts:11-16` — `requireCronSecret(req)`,
    cron/service-role only (not a public surface).
  - `admin-alert-dispatch/index.ts` — `requireServiceRole` (DB-trigger only).
- `_shared/auth-guard.ts`: `validateAuth` validates the JWT via `getUser(token)`
  and recognizes the service-role key; `requireCronSecret`/`requireServiceRole`
  use constant-time compare.

**Verdict: the admin gate IS enforced server-side and is NOT bypassable.**
A forged/non-admin JWT that reaches the admin bundle is bounced client-side by
`AdminLayout`; even if the client gate is patched out, RLS + per-RPC
`is_admin(auth.uid())` guards + edge-fn role re-checks deny all privileged reads
and writes. The single weak link is purely client-confinement: `ProtectedRoute`
does not itself check admin (`AdminLayout` does), so the admin check fires "a tick
later" — cosmetic only, no data exposure.

### Single hardcoded identity / RBAC caveats (PARTIAL)
- Only a **single super-admin** role is modeled. `OpsAccessProvider.tsx:40-42`
  comment: *"Future: merge per-scope grants from a public.admin_scopes table"* —
  no such table exists; every admin gets `ALL_SCOPES`. The per-scope Lock icons
  in the nav (`AdminLayout.tsx:152,181`) and `OpsRouteGuard` 403 are **cosmetic**
  today (all-or-nothing). `scopes.ts:3-7` confirms "only recognizes one
  super-admin".
- `admin-alert-dispatch/index.ts:18` hardcodes `ADMIN_EMAIL = 'cole@smallbridges.co'`
  (notification target, not an auth gate).

---

## 2. PAGE-BY-PAGE WIRING

**Navigation model:** `AdminLayout.tsx:36-51` renders only a **9-item rail**
(Dashboard + 5 Hubs + Audit + Config). The ~56 detail pages are surfaced as
**tabs inside the 5 Hub pages** (`src/refine/pages/hubs/*HubPage.tsx`, e.g.
`PeopleHubPage.tsx:13-22` lazy-imports Users/Orgs/Messages/Team/Roles/Sessions/
Gdpr/Abuse/Referrals) and via the **⌘K command palette** (`AdminPalette.tsx:45-58`).
Standalone `/admin/<slug>` routes (`AdminApp.tsx:117-184`) still resolve for deep
links. The `ops/_registry.ts` lists 39 ops pages with typed path/file unions;
`scopes.ts:50-52` derives scope-per-path from it. Verified: **all 39 registry
files exist** on disk and **all are routed** in `AdminApp.tsx`.

I traced data wiring per page. Tables/RPCs were confirmed present in migrations.

### Top-level pages (`src/refine/pages/*`)
| Page | Wiring | Status |
|---|---|---|
| AdminDashboardPage | `rpc admin_dashboard_pulse` (`20260610201500`) | DONE |
| AdminUsersPage | `admin_list_users`,`admin_adjust_credits`,`admin_bulk_*`,`admin_manage_role` + `invoke admin-force-logout` | DONE |
| AdminUserDetailPage | `admin_grant_credits`,`admin_suspend_account`,`admin_unsuspend_account`,`admin_revoke_user_sessions`,`admin_recent_user_actions` + `invoke admin-user-action` | DONE |
| AdminProjectsPage / AdminProjectDetailPage | `movie_projects` reads, `rpc admin_moderate_content`, `invoke retry-failed-clip` | DONE |
| AdminOrgsPage / AdminOrgDetailPage | `organizations` table reads + detail mutations | DONE |
| AdminCreditsPage | credit reads | DONE |
| AdminMessagesPage | `admin_messages`/contact reads | DONE |
| AdminFinancePage | tab wrapper → Financials/Costs/Packages | DONE (wrapper) |
| AdminFinancialsPage | `rpc get_admin_profit_dashboard` (`20260704000400`) | DONE |
| AdminCostsPage | re-export `@/components/admin/CostAnalysisDashboard` | DONE |
| AdminPackagesPage | `@/components/admin` packages/pricing/tier editors | DONE |
| AdminProductionPage | tab wrapper → Pipeline/Failed (`@/components/admin/AdminPipelineMonitor`, `AdminFailedClipsQueue`) | DONE |
| AdminModerationPage | `movie_projects` counts + `@/components/admin/AdminContentModeration` | DONE |
| AdminConfigPage | `@/components/admin/AdminSystemConfig` | DONE |
| AdminEmailsPage | `rpc admin_get_email_log` (`20260515231549`) | DONE |

### Ops pages (`src/refine/pages/ops/*`) — all routed, surfaced via hubs/palette
- **Observability:** AuditLog (`admin_get_audit_logs`), EdgeLogs (`api_cost_logs`,
  24h), Providers (`api_cost_logs`, 7d aggregate), Queue (`video_clips`
  pending/generating), Status, Observability (`render_failures_histogram` /
  `render_success_snapshot`), Backups (`db_backups_log`). → DONE except Backups
  (table exists `20260610011412_admin_console_tables.sql`, **no producer found**
  → renders empty, PARTIAL).
- **Access:** Roles, Team (`admin_scopes` future — manage UI present), Sessions
  (`admin_list_sessions`,`admin_force_logout_user/all`), Gdpr, Abuse, Referrals
  (`admin_list_referrals`). → DONE; Roles/Team scope-grant backing is PARTIAL
  (no admin_scopes table).
- **Money:** Subscriptions (`subscriptions` table), Refunds, Coupons
  (`discount_coupons` table — exists), Referrals, Invoices (`credit_transactions`
  with non-null `stripe_payment_id`), Reconcile. Also Pnl (`ledger_pnl`,
  `ledger_balance_sheet`,`ledger_reconcile`), StorageBilling (`bill_storage`,
  `compute_storage_usage`,`storage_overview`). → DONE.
- **Content:** AvatarCatalog, GalleryCuration, TemplatesAdmin, Storage
  (`admin_storage_overview`), ContentSafety. → DONE.
- **Growth:** Analytics (52KB; `analytics_*` engine), Projections, Onboarding
  (`admin_list_onboarding_intents`), Experiments, Cohorts, FeatureFlags
  (`feature_flags` table), Announcements (`announcements` table), Insights
  (`analytics_funnel`,`analytics_paths`,`analytics_lifecycle_funnel`), Events
  (`analytics_event_counts`), Traffic (`analytics_traffic`,
  `analytics_visitors_daily`,`analytics_top_pages`/`searches`,`analytics_segment`).
  → DONE.
- **Comms:** EmailTemplates (`email_templates` table), Notifications, Macros
  (`support_macros` table), Changelog (`changelog_entries` table). → DONE.
- **System:** ApiKeys, Webhooks, Secrets (`invoke check-secrets-status`),
  DbHealth, DbDiagnostics (`admin_db_diagnostics`), CrashForensics (in-memory
  `DiagnosticsLogger`/`stabilityMonitor`/`safeMode` — **client-session only**,
  not persisted). → DONE; CrashForensics is intentionally session-local (PARTIAL
  as a forensics tool — nothing survives a reload).

**"mock/placeholder" scan:** every hit was an input `placeholder=` attribute, not
mock data. **No page renders hardcoded fake data.** No page references a missing
table/RPC (the one initial `coupons` miss resolved to `discount_coupons`, which
exists).

### Sub-tab-only pages (not standalone nav, by design)
`AdminCostsPage`, `AdminFailedPage`, `AdminPipelinePage`, `AdminPackagesPage` are
thin re-exports rendered as tabs inside Finance/Production — reachable, not
orphaned.

### Detail / entity pages (deep-link only)
`AdminUserDetailPage`, `AdminProjectDetailPage`, `AdminOrgDetailPage` — routed
(`AdminApp.tsx:118,120,122`) and linked from their list pages (e.g.
`AdminOrgsPage` navigates to `/admin/orgs/:id`). The project-memory "orphaned
detail routes" note is **resolved** — `AdminApp.tsx:35` comment: "previously
built but unrouted (now wired)."

---

## 3. KEY ADMIN ACTIONS (end-to-end, persistence verified)

1. **Credit adjust (AdminUsersPage / UserDetail)** → `rpc admin_adjust_credits` /
   `admin_grant_credits`. Both `SECURITY DEFINER`, `is_admin(auth.uid())` guard,
   REVOKEd from PUBLIC; `increment_credits` caps 1–10000 and **always inserts a
   `credit_transactions` row** (`20260610094658_...`,
   `20260220002627_...sql:16-44`). **Persists + audited.** DONE.
2. **Suspend / unsuspend** → `admin_suspend_account` / `admin_unsuspend_account`
   (`20260515231549`), is_admin-gated, writes `admin_audit_log`. DONE.
3. **Force logout** → page `invoke admin-force-logout`; edge fn re-checks
   `user_roles` admin, calls `auth.admin.signOut(global)`, bumps
   `profiles.security_version`, logs audit (`admin-force-logout/index.ts:62-80`).
   DONE.
4. **Delete user** → `invoke admin-user-action` (action `delete`) — re-verifies
   via `is_admin` RPC, self-protect, service-role `deleteUser`. DONE.
5. **Stuck-jobs watchdog** → `admin-stuck-jobs-watchdog` (cron) calls
   `detect_stuck_pipeline_jobs()` then fans out to `pipeline-watchdog`. Gated by
   `requireCronSecret`. DONE (operational, not a UI action).
6. **Moderation** → `admin_moderate_content` RPC (`20260429224630`) +
   `movie_projects` updates. DONE.

All mutations hit the backend and persist; all privileged ones write
`admin_audit_log`.

---

## 4. ELECTRON DESKTOP (`electron/main.cjs`)

- Loads the **bundled `dist-admin/`** (NOT a remote URL): `distDir()` resolves
  `process.resourcesPath/dist-admin` when packaged, else `../dist-admin`
  (`:33-37`).
- Runs an **in-process http static server on `127.0.0.1:<random>`** with SPA
  fallback to `admin.html` (`:40-83`) — required because the app uses
  `BrowserRouter` and `file://` can't do SPA fallback (header comment `:9-13`).
  Loads `http://127.0.0.1:<port>/admin` (`:130`).
- Hardened window: `contextIsolation:true, nodeIntegration:false, sandbox:true`
  (`:105-109`); external links open in system browser (`:113-116`); path-traversal
  guard (`:52-55`).
- If `dist-admin` is missing it shows an error dialog and quits (`:43-46,90-96`).
- **Known black-screen issue confirmed:** `src/integrations/supabase/client.ts:5-11`
  reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` and calls
  `createClient(SUPABASE_URL, ...)` at module load. The `build:admin` script
  (`package.json:34`) does **not** inject these, so a build produced without them
  baked into the environment yields `createClient(undefined, undefined)` →
  throws on boot → blank window. Build wiring only; not built here.

---

## TALLY

- **DONE:** ~58 pages + all 6 key actions + server-authz model. Essentially the
  entire console is wired to real tables/RPCs that exist in migrations.
- **PARTIAL:** ~4 —
  - Backups (table exists, no producer → always empty)
  - CrashForensics (in-memory/session-only, nothing persisted)
  - Roles/Team scope grants (no `admin_scopes` table; scopes are all-or-nothing,
    Lock UI cosmetic)
  - RBAC scope model generally (single super-admin; per-scope grants are a
    "Future" TODO)
- **BROKEN:** 0 — no page references a missing table/RPC; all referenced DB
  objects confirmed present.
- **MISSING:** 0 truly absent pages. The only absent backend object is the
  future `admin_scopes` table (scope granularity), which the code already
  degrades gracefully around.

### REAL vs STUB vs ORPHANED
- **REAL (wired to backend):** All top-level pages and all 39 ops pages. Every
  one issues real `supabase.from`/`.rpc`/`functions.invoke` calls (or delegates
  to a `@/components/admin/*` component that does). The earlier `sb=0` readings
  were a grep artifact of multi-line `await supabase\n.from()` chains.
- **STUB:** None that fake data. The only thin files are intentional re-exports /
  tab wrappers (`AdminCostsPage`, `AdminFailedPage`, `AdminPipelinePage`,
  `AdminFinancePage`, `AdminProductionPage`).
- **ORPHANED:** None functionally. Detail routes (`users/:id`, `projects/:id`,
  `orgs/:id`) are reachable via list-page deep links; standalone `/admin/<slug>`
  ops routes are reachable via Hub tabs + ⌘K palette. The old "orphaned detail
  routes" finding is resolved.

### SERVER-SIDE AUTHZ VERDICT
**Enforced server-side and NOT bypassable.** `is_admin()` is SECURITY DEFINER over
`user_roles`, EXECUTE revoked from anon; RLS on sensitive tables gates on
`is_admin(auth.uid())`; every admin RPC self-guards with `is_admin` + RAISE; every
admin edge function re-verifies the admin role (or requires cron/service-role)
before acting. Client gates (`AdminLayout` is_admin RPC, `OpsRouteGuard`) are
defense-in-depth; the only client-only weakness is that `ProtectedRoute` itself
doesn't check admin (the check is one component deeper in `AdminLayout`), which is
cosmetic — it exposes no privileged data because the backend independently denies
non-admins.
