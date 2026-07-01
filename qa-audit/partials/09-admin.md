# 09 — Admin Console (/admin/*) reliability audit

Surface: Refine-based admin console. `src/admin/*`, `src/refine/*`,
`src/components/admin/*`, `useAdminAccess`, and the 11 admin-scoped edge
functions. READ-ONLY audit — no source modified.

**Headline:** Access gating is genuinely layered and solid. Every destructive
admin edge function verifies the caller's admin role server-side. All ~50 admin
RPCs the UI calls exist in repo migrations (no code-level drift). The real risks
are: (1) a cron/`verify_jwt` config mismatch that may silently stop the
stuck-jobs watchdog, (2) two orphaned edge functions, (3) wholesale
`window.confirm`/`window.prompt` usage that violates the project standard, and
(4) prod migration lag (per CLAUDE.md, prod ~32 migrations behind) meaning some
of those RPCs may not yet exist on the live DB even though they exist in repo.

---

## ACCESS GATING — verified chain (SOLID)

1. **Build-flag tree-shake** — `ADMIN_ENABLED` (`src/admin/adminEnabled.ts:17`)
   = `VITE_ADMIN==='true' || import.meta.env.DEV`. Public prod build leaves
   `VITE_ADMIN` unset → admin chunk is dead-code-eliminated. (Caveat from
   project memory: `|| DEV` flips admin ON on any dev-mode host, e.g. Lovable.)
2. **`ProtectedRoute`** (`src/components/auth/ProtectedRoute.tsx:26`) — auth-only
   (login), NOT a role gate. Also runs an "admin lockdown" effect (`:169`) that
   bounces an admin out of any non-`/admin` route back to `/admin`.
3. **`RefineAdminLayoutInner`** (`src/refine/AdminLayout.tsx:79-99`) — calls
   `is_admin` RPC; `!isAdmin` → `<Navigate to="/" replace />`. This is the real
   server-side UI gate.
4. **`OpsAccessProvider`** (`src/refine/rbac/OpsAccessProvider.tsx:32`) — also
   `is_admin` RPC; super-admin gets ALL_SCOPES, everyone else none.
5. **`OpsRouteGuard`** (`src/refine/rbac/OpsRouteGuard.tsx`) — per-page scope
   check → 403 surface. (Currently all-or-nothing since only super-admin exists.)

`is_admin(_user_id uuid)` exists in migrations (`20260513005848…`,
`20260112212511…`) and is REVOKE'd from anon/PUBLIC (`20260429224707…`). No
non-admin bypass found.

---

## INVENTORY

| Function / Action | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| useAdminAccess | src/hooks/useAdminAccess.ts:29 | client admin check | session + `user_roles` RLS query, 5-min re-verify | OK |
| AdminApp routes | src/admin/AdminApp.tsx:91 | mount ~60 admin routes | ProtectedRoute → RefineAdminLayout | OK |
| RefineAdminLayout gate | src/refine/AdminLayout.tsx:82 | UI admin gate | `is_admin` RPC → redirect / | OK |
| OpsAccessProvider | src/refine/rbac/OpsAccessProvider.tsx:32 | scope grant | `is_admin` RPC → ALL_SCOPES | OK |
| List users | AdminUsersPage.tsx:55 | roster | `admin_list_users` RPC | OK |
| Adjust credits | AdminUsersPage.tsx:73 | +/- credits | `admin_adjust_credits` RPC | OK |
| Toggle admin role | AdminUsersPage.tsx:90 | grant/revoke admin | `admin_manage_role` RPC; self-revoke blocked | OK |
| Force logout (row) | AdminUsersPage.tsx:307 | revoke sessions | invoke `admin-force-logout` {scope:user} | OK |
| Bulk grant | AdminUsersPage.tsx:127 | bulk credits | `admin_bulk_grant_credits` RPC | OK |
| Bulk suspend | AdminUsersPage.tsx:150 | bulk suspend | `admin_bulk_suspend` RPC; `window.confirm` | OK* |
| Bulk restore | AdminUsersPage.tsx:169 | bulk restore | `admin_bulk_restore` RPC | OK |
| User detail load | AdminUserDetailPage.tsx:105 | detail bundle | `admin_get_user_detail` (RPC, w/ table fallback) | OK |
| Grant credits (detail) | AdminUserDetailPage.tsx:250 | credits | `admin_grant_credits` RPC; `window.prompt` | OK* |
| Suspend / Restore | AdminUserDetailPage.tsx:270/288 | suspend lifecycle | `admin_suspend_account`/`admin_unsuspend_account` | OK |
| Revoke sessions | AdminUserDetailPage.tsx:303 | sign-out user | `admin_revoke_user_sessions` RPC | OK |
| Delete / verify / reset / magic / impersonate | AdminUserDetailPage.tsx:218 | destructive auth ops | invoke `admin-user-action` | OK |
| admin-user-action (edge) | functions/admin-user-action/index.ts:52 | service-role auth ops | validateAuth → `is_admin` RPC → self-target block → switch | OK |
| admin-delete-auth-user (edge) | functions/admin-delete-auth-user/index.ts:9 | delete auth.user | validateAuth → user_roles admin check | OK but ORPHAN |
| admin-force-logout (edge) | functions/admin-force-logout/index.ts:9 | global sign-out | admin check → signOut + security_version bump | OK |
| admin-replicate-health (edge) | functions/admin-replicate-health/index.ts:24 | replicate health | admin gate → /v1/account probe + 402 signals | OK |
| admin-stuck-jobs-watchdog (edge) | functions/admin-stuck-jobs-watchdog/index.ts:10 | cron stuck-job detect | requireCronSecret → `detect_stuck_pipeline_jobs` | ⚠ config mismatch |
| admin-analytics (edge) | functions/admin-analytics/index.ts:51 | dashboard analytics | admin gate → 17 parallel aggregations | OK |
| check-secrets-status (edge) | functions/check-secrets-status/index.ts:16 | secret presence | admin gate; **dynamic** import auth-guard | OK (fragile) |
| reconcile-credit-holds (edge) | functions/reconcile-credit-holds/index.ts:24 | credit-hold reconcile | requireServiceRole → RPC | OK |
| revoke-demo-sessions (edge) | functions/revoke-demo-sessions/index.ts:8 | wipe demo user | admin gate; **dynamic** import auth-guard | OK but ORPHAN |
| cleanup-analytics (edge) | functions/cleanup-analytics/index.ts:15 | PII cleanup cron | admin gate → `cleanup_old_signup_analytics` | OK |
| admin-alert-dispatch (edge) | functions/admin-alert-dispatch/index.ts:86 | DB-trigger fan-out | requireServiceRole → email + slack/discord | OK |
| Secrets page | AdminSecretsPage.tsx:50 | secret status UI | invoke `check-secrets-status` | OK |
| Analytics page | AdminAnalyticsPage.tsx | dashboards | invoke `admin-analytics` | OK |
| Backups page | AdminBackupsPage.tsx | backup log | AdminConsoleV2 → `db_backups_log` table | OK |
| Crash forensics | AdminCrashForensicsPage.tsx | in-memory diag tail | client `DiagnosticsLogger` | OK |
| Replicate health UI | AdminPipelineMonitor / Production | health card | invoke `admin-replicate-health` | OK |

`*` = functional but uses `window.confirm`/`window.prompt` (see BROKEN D).

**RPC verification:** All 53 RPCs referenced across the admin surface
(`admin_dashboard_pulse`, `admin_list_users`, `admin_grant_credits`,
`admin_bulk_*`, `admin_suspend_account`, `admin_manage_role`, `analytics_*`,
`ledger_*`, `admin_get_user_detail`, `admin_get_profile`, `admin_db_diagnostics`,
`render_*`, `storage_overview`, etc.) are **defined in repo migrations**. No
code-level drift. `db_backups_log` table also exists
(`20260610011412_admin_console_tables.sql`). See BROKEN G for prod-lag caveat.

---

## BROKEN

### A) admin-stuck-jobs-watchdog — `verify_jwt` config vs. comment mismatch — MEDIUM (UNVERIFIED)
- **Symptom:** The stuck-jobs watchdog cron may be rejected at the API gateway
  and never run → projects stuck >30 min in generation are never auto-detected
  or handed to `pipeline-watchdog` for recovery.
- **Repro:** Inspect `supabase/config.toml`: there is **no** `[functions.admin-stuck-jobs-watchdog]`
  entry, so it defaults to `verify_jwt = true`. The function's own header comment
  (`index.ts:5`) says *"verify_jwt = false — only invoked by pg_cron via
  service-role."* The handler authorizes via `requireCronSecret` (auth-guard.ts:171),
  which accepts EITHER an `x-cron-secret` header OR a service-role Bearer. With
  `verify_jwt=true`, the gateway validates the Bearer JWT **before** the handler
  runs: a pg_cron invocation that sends only `x-cron-secret` + anon `apikey`
  (no valid JWT) gets a 401 at the edge and the handler never executes.
- **Root cause:** config.toml omission — comment assumes `verify_jwt=false` that
  was never written into config (`supabase/config.toml`, missing function block).
- **Fix:** Add `[functions.admin-stuck-jobs-watchdog]\n  verify_jwt = false`
  (mirroring the existing `admin-alert-dispatch`/`revoke-demo-sessions` blocks),
  OR confirm the pg_cron schedule passes a service-role Bearer.
- **UNVERIFIED:** Functions deployed via `--use-api` can set `verify_jwt`
  independently of config.toml; the live setting and the exact cron invocation
  shape need a backend check. If the cron uses a service-role Bearer, this is a
  non-issue (a service-role key is a valid JWT and passes `verify_jwt=true`).
  `reconcile-credit-holds` has the same config omission but is **not** affected
  because `requireServiceRole` already mandates a service-role Bearer.

### B) admin-delete-auth-user — orphaned / redundant edge function — LOW
- **Symptom:** A fully-built, admin-gated edge function with **zero callers**.
  `grep` finds no reference in `src/` or `supabase/`.
- **Root cause:** The admin UI deletes users through `admin-user-action`
  `{action:'delete'}` (AdminUserDetailPage.tsx:218), which additionally runs
  `admin_pre_delete_user` (cascade + admin/self-delete refusal). `admin-delete-auth-user`
  is the older, thinner path left behind.
- **Fix:** Delete the function, or document it as an internal/manual tool. Not a
  security risk (it gates on admin), just dead surface and a maintenance trap
  (it does a bare `auth.admin.deleteUser` without the pre-delete cascade RPC).

### C) revoke-demo-sessions — orphaned from admin UI — LOW
- **Symptom:** No `src/` caller invokes `revoke-demo-sessions`. It is wired in
  config.toml (`verify_jwt=false`) but not exposed by any admin button.
- **Root cause:** Hardcoded to the single demo account `demo@aifilmstudio.com`
  (index.ts:49). Reachable only by manual `functions.invoke`/cron. The destructive
  `action:'delete'` path also manually deletes ~14 tables by name
  (index.ts:65-79) — a brittle hardcoded cascade that will silently drift if a
  new owned table is added (orphan rows left behind).
- **Fix:** Either surface it as an admin "reset demo" action or remove it; if
  kept, replace the hand-rolled table list with the `admin_pre_delete_user`
  cascade RPC used elsewhere.

### D) Admin pages use `window.confirm` / `window.prompt` — LOW (standard violation)
- **Symptom:** 13 occurrences of native `window.confirm`/`confirm`/`window.prompt`
  across `AdminUsersPage.tsx` (lines 147, 305) and `AdminUserDetailPage.tsx`
  (lines 215, 243, 247, 266, 285, 300, 540, …). CLAUDE.md + user memory mandate
  all confirms go through `confirmAsync` (`@/components/ui/global-confirm`) →
  premium ConfirmView; never `window.confirm`.
- **Impact:** Functional but inconsistent UX, and **fragile data entry**:
  credit-grant amount and reason are gathered via `window.prompt`
  (AdminUserDetailPage.tsx:243-247) — empty/Escape returns null and silently
  aborts, and there is no validation surface. On some embedded/in-app webviews
  native `prompt` is suppressed entirely, which would make "Grant credits" on the
  detail page a silent no-op.
- **Fix:** Route through `confirmAsync` and a proper dialog (the credit dialog
  pattern already exists in AdminUsersPage.tsx:405 — reuse it on the detail page).

### E) check-secrets-status / revoke-demo-sessions — dynamic `await import` of auth-guard — LOW / INFO (UNVERIFIED)
- **Symptom:** Both use `const { validateAuth } = await import("../_shared/auth-guard.ts")`
  (check-secrets-status:21, revoke-demo-sessions:15). `admin-user-action`'s own
  header comment (index.ts:4-9) documents this exact pattern as a past production
  break: *"the previous `await import(...)` was not bundled by the edge-function
  deployer, so the deployed function threw 'Module not found' (HTTP 500) on EVERY
  call,"* which is why it was switched to a static import.
- **Assessment:** ~65 live functions still use the dynamic pattern and the app is
  in production, so the deployer evidently bundles it now — this is most likely
  fine today. Flagged because it is the precise documented failure mode and is
  inconsistent with the "fix" applied to admin-user-action. If the Secrets page
  ever shows a blanket 500/"missing" for all keys, this is the first suspect.
- **Fix:** Convert both to static top-of-file imports to match admin-user-action.

---

## RISKS / INFO (not breaks)

### G) Prod migration lag vs. repo RPCs — UNVERIFIED, potential live breakage
All admin RPCs exist in **repo** migrations, but CLAUDE.md/user-memory state prod
is ~32 migrations behind (much admin tooling applied out-of-band via the Mgmt
API). On the live DB, newer RPCs (`admin_bulk_*`, `admin_get_user_detail`,
`analytics_*`, `ledger_*`, `admin_db_diagnostics`) may not be present →
those actions would `throw` and toast a generic failure. AdminUserDetailPage has
a graceful fallback (RPC → direct table queries, :131), but the bulk actions,
analytics dashboards, and most ops pages do **not** — they'd just error-toast.
Verify against the live DB before treating these pages as green.

### Credits shown = cache, not ledger — INFO
`admin_list_users`/detail surface `credits_balance` (the cache on `profiles`),
not the `credit_transactions` ledger that CLAUDE.md calls the source of truth.
Admin-displayed balances can lag the ledger. By design, but operators adjusting
credits off a stale number is a foot-gun.

### Self-protection & cascade hygiene — POSITIVE
- `admin-user-action` blocks self-targeting (index.ts:91) and delete runs
  `admin_pre_delete_user` (refuses admin/self delete) before `auth.admin.deleteUser`.
- `admin-force-logout` skips the caller, bumps `security_version`, and global-signs-out;
  bulk path paginates `listUsers` with an `admin_bump_security_versions_except` fallback.
- `auth-guard.ts` validates user JWTs via `getUser(token)`, treats the service-role
  key as an internal caller, and ships IDOR/ownership + constant-time secret helpers.

---

## SUMMARY

- **Functions/actions inventoried:** ~35 UI actions/pages + 11 admin edge
  functions traced end-to-end; 53 admin RPCs confirmed present in migrations.
- **Broken by severity:**
  - MEDIUM: 1 — (A) stuck-jobs watchdog `verify_jwt` config/comment mismatch (UNVERIFIED; may silently disable stuck-job auto-recovery).
  - LOW: 4 — (B) orphan `admin-delete-auth-user`, (C) orphan/brittle-cascade `revoke-demo-sessions`, (D) `window.confirm`/`window.prompt` standard violation (incl. fragile credit-grant prompt), (E) dynamic auth-guard import on 2 fns.
  - INFO/UNVERIFIED: (G) prod migration lag may 404 newer admin RPCs on the live DB; credits shown are cache not ledger.
- **Worst issue:** (A) — the stuck-jobs watchdog could be silently failing at the
  gateway, meaning stuck render jobs are never auto-detected/recovered. Needs a
  live backend check of the deployed `verify_jwt` setting and the cron invocation.
- **Security verdict:** Access gating is strong and consistent — every
  destructive admin edge function re-verifies admin role server-side; no
  non-admin bypass and no missing/nonexistent admin-fn invoke was found.

Partial written to: `qa-audit/partials/09-admin.md`
