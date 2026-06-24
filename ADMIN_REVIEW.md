# Admin Console Review — Genesis Director

_Read-only product/engineering audit of the entire admin surface. No code changed. Generated against the `admin-review` branch._

> **Payments provider correction:** This platform bills customers through **Polar.sh** (`polar-checkout`, `polar-portal`, `polar-webhook`, `_shared/polar.ts`), **not Stripe**. The admin money surface is written entirely against **Stripe naming** — the DB columns are legacy-named (`stripe_payment_id`, `stripe_subscription_id`, `stripe_coupon_id`, `stripe_refund_id`, `stripe_clearing`) and the Polar webhook reuses them (e.g. it writes `stripe_payment_id = 'polar_<orderId>'`, `stripe_subscription_id = 'polar_<subId>'`). So the money pages **do show real Polar data**, but all labels, instructions, and ID formats say "Stripe" and are wrong/misleading for operators. The `stripe-connect-onboard` / `stripe-connect-payout` edge functions are a separate, legitimate use of Stripe Connect for **creator payouts** (paying money out), distinct from Polar customer billing. Findings below are corrected accordingly.

---

## TL;DR

The admin is **large, mostly real, and server-enforced** — not a stub. It mounts at `/admin/*` from one lazy module (`src/admin/AdminApp.tsx`), is compiled out of the public production bundle (`ADMIN_ENABLED`), and runs against the same Supabase backend used by the product. The surface is **~65 pages**: 1 dashboard, 5 section hubs (+5 command-deck overviews), ~15 top-level/detail pages, and **39 registered ops pages**.

Backend is the strong half: **45 `admin_*` SECURITY DEFINER RPCs**, 6 admin edge functions, an `admin_audit_log` written inline by every mutating RPC, and a `feature_flags` + `system_config` store. DB access is genuinely server-enforced.

The weak half is **the last mile**: many pages are honest **"authoring-only" surfaces** — full CRUD whose output no runtime reads yet (experiments, feature flags, content-safety, abuse rules, changelog, email templates, announcements). Several **powerful write RPCs exist but have no UI** (impersonation token, force-tier, change-account-type, org transfer/delete, enterprise activation). And there are two **structural ceilings**: a single hardcoded admin (5 enforcement layers) and a scope system that is client-only chrome.

**Headline issues to route to the fix agent are collected in [§5](#5-broken--flagged-route-to-fix-agent).**

---

## 1. Architecture & access model

| Aspect | Status |
|---|---|
| **Mount** | `/admin/*` in `src/App.tsx`, gated by `ADMIN_ENABLED && AdminApp`; lazy `src/admin/AdminApp.tsx` holds all routes. Dead-code-eliminated from the public prod build. |
| **Layout** | `src/refine/AdminLayout.tsx` (`RefineAdminLayout`) — sidebar, command palette (⌘K via `admin_search_entities`), notification bell. |
| **Entry gate** | `AdminLayout` + `OpsAccessProvider` both call `supabase.rpc("is_admin", {_user_id})`; non-admin → redirect to `/`. **Server-enforced.** |
| **Per-RPC enforcement** | Every privileged RPC is `SECURITY DEFINER` + either an inline `is_admin(auth.uid())` guard or `REVOKE … FROM PUBLIC/anon`. **Data access is genuinely server-enforced.** |
| **Scopes** | 8 scopes in `src/refine/rbac/scopes.ts` (`core, observability, access, money, content, growth, comms, system`); `OpsRouteGuard` hides/locks routes. **Client-only** — `OpsAccessProvider` resolves `isSuperAdmin ? ALL_SCOPES : []`. No `admin_scopes` table; only one real DB privilege tier. |
| **Audit log** | `admin_audit_log` (RLS, admin-only). Written inline by each mutating RPC (no central helper). Read via `admin_get_audit_logs` / `admin_recent_user_actions`. |
| **Single-admin lock** | Admin role pinned to `brianbcole74@gmail.com` (`45f0fc04-…`, re-pointed from a legacy UUID). **5 enforcement layers**: CHECK constraint, unique partial index, `enforce_admin_lock()` trigger, hardcoded UUID in `is_admin()`/`has_role()`, and a reject in `admin_manage_role()`. `AdminRolesPage`/`AdminTeamPage` can manage mod/support roles but **cannot create a second admin**. |

---

## 2. Full page inventory

Legend — **Status**: `WIRED` (real backend + working writes) · `READ` (real data, read-only by design) · `PARTIAL` (CRUD works but output unconsumed at runtime, or degraded fallback) · `SHELL` (tab/layout container) · `CLIENT` (no DB; in-memory).

### 2.1 Core / top-level

| Page | Route | Does | Status | Notes / gaps |
|---|---|---|---|---|
| Dashboard | `/admin` | KPI tiles, 14-day signups, status donut, action queue | WIRED (read) | `admin_dashboard_pulse` w/ table-count fallback; fallback hardcodes `signups_7d=0`. |
| Users | `/admin/users` | User roster, search, per-row + bulk actions, CSV | WIRED | `admin_adjust_credits`, `admin_manage_role`, `admin_bulk_grant_credits`, `admin_bulk_suspend`, `admin_bulk_restore`, `admin-force-logout` edge fn. |
| User detail | `/admin/users/:id` | Single-user 360, action menu | WIRED (degraded fallback) | `admin_get_user_detail` + `admin_recent_user_actions`; writes: `admin_grant_credits`, `admin_suspend_account`, `admin_unsuspend_account`, `admin_revoke_user_sessions`, `admin-user-action` (delete / force-verify / pw-reset / magic-link / **impersonation link**). Fallback blanks auth meta + orgs and mis-enables "Force verify". Uses `window.prompt/confirm`. |
| Projects | `/admin/projects` | Stats + projects browser | WIRED | `admin_list_projects`, `admin_moderate_content`. KPI counts via raw `movie_projects` capped at 5000. |
| Project detail | `/admin/projects/:id` | Single-project 360, intervene | WIRED (degraded fallback) | `admin_get_project_detail`; delete via `admin_moderate_content`. **"Retry failed clips" just sets `video_clips.status='pending'` directly — no pipeline re-trigger** (success toast is optimistic). |
| Orgs | `/admin/orgs` | Org list + KPIs | READ | Direct `organizations`, limit 500, client filter. |
| Org detail | `/admin/orgs/:id` | Org 360 (members/plan/projects) | READ | **No mutation actions despite the list page advertising transfer/delete/activate-enterprise** — those RPCs exist but are unsurfaced. |
| Credits | `/admin/credits` | Credit-transaction ledger | READ | Direct `credit_transactions`, limit 200; inflow/outflow stats are window-scoped (misleading). |
| Packages | `/admin/packages` | Credit packages + pricing + tiers | WIRED | `admin_manage_credit_package` + pricing/tier editors. No page shell (inconsistent chrome). |
| Messages | `/admin/messages` | Support inbox triage | WIRED | `support_messages` + realtime; status/notes/reply/delete. **"Reply" writes `admin_reply` to the row, does not email; "Email" is a `mailto:` link.** |
| Finance | `/admin/finance` | Tab shell: Financials / Costs / Packages | SHELL | Causes nested double-tabs inside Money hub. |
| Production | `/admin/production` | Tab shell: pipeline + failed clips | SHELL | — |
| Moderation | `/admin/moderation` | Reported projects queue | WIRED | `admin_moderate_content` approve/hide/delete. Flagged KPI capped at 2000 rows via `(supabase as any)`. |
| Config | `/admin/config` | Maintenance mode, banner, flags, status | PARTIAL | Saves to `system_config`; **flags here are a hardcoded list separate from the `feature_flags` table** (two flag systems); Info-card runtime claims appear unbacked. System Status is real. |
| Emails | `/admin/emails` | Auth/transactional email log | READ | `admin_get_email_log`. Clean. |

### 2.2 Section hubs (consolidation shells + command decks)

| Hub | Route | Overview deck data | Status |
|---|---|---|---|
| People | `/admin/people` | `admin_dashboard_pulse` + org/role counts + recent users/orgs | SHELL + READ. **Overview reads `profiles.select("*")` directly (incl. email) — contradicts the column-revocation pattern; email column may be blank/error.** |
| Production | `/admin/production-hub` | render trend, recent/failed renders | SHELL + READ |
| Money | `/admin/money` | credit-flow chart, recent txns, refunds | SHELL + READ |
| Growth | `/admin/growth` | cross-domain KPI launchpad (19 pages → 5 clusters) | SHELL + READ |
| System | `/admin/system` | DB/storage/traffic KPIs, service status | SHELL + READ |

### 2.3 Ops pages (39, by section)

**Observability**

| Page | Route | Does | Status | Gaps |
|---|---|---|---|---|
| Audit | `/admin/audit` | Privileged-action trail | READ | `admin_get_audit_logs` (1000); CSV. |
| Edge logs | `/admin/edge-logs` | 24h invocations, cost, latency | READ | `api_cost_logs` capped at 1000 (no pagination). |
| Providers | `/admin/providers` | 7-day spend/reliability per provider | READ | Paginates past 1k. Clean. |
| Queue | `/admin/queue` | Pending/generating clips, stuck detector | READ | **No requeue/cancel action despite being "the queue".** |
| Status | `/admin/status` | Composite health | PARTIAL | **DB & Auth components hardcoded `operational`** (no probe). |
| Telemetry | `/admin/observability` | render_failures histogram | READ | Clean. |
| Backups | `/admin/backups` | Backup history log | READ | Empty unless a backup job writes `db_backups_log`. |

**Access**

| Page | Route | Does | Status | Gaps |
|---|---|---|---|---|
| Roles | `/admin/roles` | `user_roles` assignments + revoke | WIRED | Cannot manage admin role (locked). |
| Admin team | `/admin/team` | Promote/demote mod/support | WIRED | `admin_find_user_by_email` + insert/delete; cannot create admin. |
| Sessions | `/admin/sessions` | Recent sign-ins, force-logout | WIRED | `admin_list_sessions`, `admin_force_logout_all/_user`. Native `confirm()`. |
| GDPR | `/admin/gdpr` | Export/delete/rectify requests | WIRED | Status-only; **no automated export/erasure runs** (operator does it manually). |
| Abuse | `/admin/abuse` | IP/email blocklist, rate rules | PARTIAL | **Rules stored but nothing reads `abuse_rules` at runtime; `hits` stays 0 — and no disclaimer.** |

**Money**

| Page | Route | Does | Status | Gaps |
|---|---|---|---|---|
| Subscriptions | `/admin/subscriptions` | Subscription mirror (real provider = Polar; copy says "Stripe") | READ | Advertises dunning but **no management actions** (view-only). Subs stored in `stripe_subscription_id` = `polar_<id>`. |
| Refunds | `/admin/refunds` | Refund request queue | WIRED | Approve/Deny/Mark-processed write `refund_requests`. **Issues no real refund**, and **instructs operators to use the Stripe dashboard / enter a `re_...` Stripe ID — both wrong; billing is Polar.** |
| Coupons | `/admin/coupons` | Promo codes | WIRED | **Create only inserts a DB row; no provider sync — `stripe_coupon_id` stays null.** Copy says "mirrored to Stripe"; provider is actually Polar. |
| Referrals | `/admin/referrals` | Per-code redemption rollup | READ | `admin_list_referrals`. Clean. |
| Invoices/Tax | `/admin/invoices` | Credit-purchase ledger + CSV | READ | Real Polar data (`stripe_payment_id` holds `polar_<id>`); UI labels it "Stripe". USD hardcoded `×$0.10/credit`. |
| Reconcile | `/admin/reconcile` | Provider↔Supabase reconcile jobs | WIRED | Job types/copy say "Stripe" (`stripe_subscriptions`) but target is Polar. Insert only **queues** a job (worker unseen); list doesn't refresh after queueing. |
| P&L | `/admin/pnl` | Ledger P&L + balance sheet | READ | `ledger_pnl`/`ledger_balance_sheet`/`ledger_reconcile`. **No error handling → silent all-$0 on RPC failure.** |
| Storage billing | `/admin/storage-billing` | Per-user storage metering/billing | WIRED | `compute_storage_usage`, `bill_storage`. Solid. |

**Content**

| Page | Route | Does | Status | Gaps |
|---|---|---|---|---|
| Avatar catalog | `/admin/avatar-catalog` | Public avatar gallery curation | WIRED | `avatar_catalog_entries` full CRUD. |
| Gallery | `/admin/gallery` | Public `/gallery` curation | WIRED | **Up/Down adjusts one row's `sort_order` ±1 with no neighbor swap → collisions/unreliable order.** |
| Template library | `/admin/template-library` | Global template oversight | WIRED | Real writes but `project_templates` table is empty (no in-app flow populates it). |
| Asset/Storage | `/admin/storage` | Per-bucket object count/size | READ | Cost estimate hardcoded `$0.021/GB/mo`. |
| Content safety | `/admin/content-safety` | Block/warn pattern rules | PARTIAL | **Honestly disclaimed: stored but not enforced at runtime.** |
| Comments | `/admin/comments` | Recent comments, remove abuse | WIRED | `project_comments` delete w/ optimistic rollback; detects missing RLS. Well-built. |

**Growth**

| Page | Route | Does | Status | Gaps |
|---|---|---|---|---|
| Analytics | `/admin/analytics` | KPIs, funnel, cohorts, heatmap, drill | WIRED (read) | Entirely depends on `admin-analytics` edge fn. Most sophisticated page. |
| Insights | `/admin/insights` | Lifecycle/custom funnels, journeys | READ | Honestly limited to 3 instrumented events. |
| Traffic | `/admin/traffic` | Visitors/sessions/bounce, top pages | READ | `analytics_*` RPCs. Clean. |
| Events | `/admin/events` | Event rollups + live feed | READ | 6s auto-refresh. |
| Cohorts | `/admin/cohorts` | Signup acquisition + paid conversion | READ | `signup_analytics` + profiles. Documents a fixed schema-drift bug. |
| Onboarding | `/admin/onboarding-analytics` | Intent→plan→consumed→completed funnel | READ | `admin_list_onboarding_intents`. |
| A/B tests | `/admin/experiments` | Experiment register | PARTIAL | **CRUD works; product runtime does not read `experiments` (no allocation/gating).** |
| Feature flags | `/admin/feature-flags` | `feature_flags` CRUD | PARTIAL | **CRUD works; product does not read this table to gate behavior.** Different store than Config page. |
| Projections | `/admin/projections` | Pageview forecast (least-squares) | READ | `analytics_visitors_daily` + client projection. |

**Comms**

| Page | Route | Does | Status | Gaps |
|---|---|---|---|---|
| Email templates | `/admin/email-templates` | Transactional template drafts | PARTIAL | **Live send uses code-defined templates; edits here don't change sent mail.** |
| Notification center | `/admin/notifications-center` | Realtime admin alert HUD | WIRED | `notifications` + realtime; mark-read. |
| Macros | `/admin/macros` | Canned support responses | WIRED | `support_macros` CRUD; copy increments `use_count`. |
| Changelog | `/admin/changelog` | Release-note authoring | PARTIAL | **CRUD works; no public page consumes `changelog_entries`.** |
| Announcements | `/admin/announcements` | In-app banner CRUD | PARTIAL | **Composed banners never shown — live banner reads a different `system_config` key.** |

**System**

| Page | Route | Does | Status | Gaps |
|---|---|---|---|---|
| API keys | `/admin/api-keys` | Org API keys global view | WIRED | Revoke / delete on `org_api_keys`. |
| Webhooks | `/admin/webhooks` | Workspace webhook endpoints | WIRED | Toggle / delete on `webhook_endpoints`. |
| Secrets | `/admin/secrets` | Presence check of edge secrets | PARTIAL | Depends on `check-secrets-status` edge fn; if undeployed all show "Unknown". Spec list hardcoded. |
| Database | `/admin/db-health` | Live row counts, 10 tables | READ | Hardcoded table list. |
| Diagnostics | `/admin/db-diagnostics` | DB size/conns/queries | READ | `admin_db_diagnostics`; no refresh button (one-shot). |
| Crash | `/admin/crash-forensics` | Diagnostics tail + safe-mode | CLIENT | **In-memory only, per-admin-session — empty on every fresh load; "24h" stats meaningless.** |

### 2.4 Backend (45 RPCs / 6 edge functions / supporting components)

- **RPCs (45):** read bundles (`admin_get_user_detail`, `admin_get_project_detail`, `admin_get_org_detail`, `admin_dashboard_pulse`, `admin_db_diagnostics`, `admin_storage_overview`, list/search RPCs, `admin_get_email_log`, `admin_get_audit_logs`), credit ops, role/account ops, moderation, suspend/tier, org powers, impersonation, session revocation, alerts. All `SECURITY DEFINER`; mutating ones write `admin_audit_log`.
- **Edge functions (6):** `admin-analytics`, `admin-user-action`, `admin-delete-auth-user`, `admin-force-logout`, `admin-alert-dispatch` (DB-invoked), `admin-stuck-jobs-watchdog` (cron).
- **Components:** `AdminConsoleV2`/`AdminConsoleScaffold` (generic table pages), `AdminPageShell`, `AdminHubShell`, `ClusterTabs`, `BulkActionBar`, `InspectPanel`, `UserAnalyticsSheet`, `AdminPalette`, `AdminNotificationBell`, `AdminFormPrimitives`.

---

## 3. Wired-vs-stub summary

- **Fully wired with working writes:** Users, User detail, Projects, Packages, Messages, Moderation, Comments, Roles, Team, Sessions, GDPR, Refunds, Coupons, Reconcile, Storage billing, Avatar catalog, Gallery, Template library, Notification center, Macros, API keys, Webhooks. (~22)
- **Real data, read-only by design:** Dashboard, Orgs, Org detail, Credits, Emails, Subscriptions, Referrals, Invoices, P&L, Audit, Edge logs, Providers, Queue, Telemetry, Backups, Asset storage, Analytics, Insights, Traffic, Events, Cohorts, Onboarding, Projections, DB health, Diagnostics, + 5 hub overviews. (~30)
- **PARTIAL — authoring works but output unconsumed / degraded:** Config, Abuse, Content safety, Experiments, Feature flags, Changelog, Email templates, Announcements, Status, Secrets. (~10)
- **CLIENT-only / no persistence:** Crash forensics. (1)
- **Genuine UI stubs / "Coming soon" / dead buttons:** **none found** — every wired button hits a real RPC/table.

The real story is not "stubs" but **two layers of incompleteness**: (a) authoring surfaces with no runtime consumer, and (b) powerful backend RPCs with no UI.

---

## 4. Gap analysis vs best-in-class SaaS admin consoles

| Capability | State here | Gap |
|---|---|---|
| **User/account management** | ✅ Strong — roster, detail 360, credits, suspend, force-logout, delete, bulk | Account-type change & force-tier RPCs exist but **no UI**. |
| **RBAC & permissions** | ⚠️ One real tier | **Single hardcoded admin; scopes are client-only.** No multi-admin, no enforceable operator roles. Biggest structural gap. |
| **Audit logs** | ✅ Strong | Solid (`admin_audit_log` + viewer + CSV). Some non-RPC table writes bypass it (acceptable). |
| **Impersonation / "login as"** | ⚠️ Partial | User detail mints an impersonation link via `admin-user-action`; the richer `admin_create_impersonation_token` RPC is **unsurfaced**. No session banner / "viewing as" mode documented. |
| **Analytics & dashboards** | ✅ Strong | Analytics/Traffic/Insights/Cohorts/Projections all real. Depends on the `admin-analytics` edge fn being healthy. |
| **Billing & subscriptions** | ⚠️ Read-mostly + wrong-provider labels | Subscriptions view-only; **refunds don't hit the provider; coupons don't sync.** Entire surface labeled "Stripe" but billing is **Polar**. Revenue is `credits×$0.10` approximation, not actual cash. |
| **Refunds** | ⚠️ Bookkeeping only | Approve/process update DB but **issue no real refund**; instructions reference Stripe (wrong — provider is Polar). |
| **Content moderation** | ✅ Projects + comments | DMs not moderated; **content-safety & abuse rules authored but not enforced.** |
| **Support tooling** | ✅ Inbox + macros | Reply doesn't email; no SLA/assignment/ticket status workflow. |
| **Feature flags** | ⚠️ Two systems, neither enforced | `feature_flags` table CRUD + a **separate hardcoded list in Config**; **product reads neither.** |
| **Data export/import** | ⚠️ Export only | CSV export on several pages; GDPR export is manual; no import/bulk-edit. |
| **Search & filtering** | ✅ ⌘K + per-page | `admin_search_entities` global search; most filtering is client-side over capped fetches. |
| **Bulk actions** | ✅ Users only | Bulk credits/suspend/restore on Users; absent elsewhere (projects, orgs, refunds). |
| **Notifications/comms** | ⚠️ Partial | Realtime admin HUD real; **announcements/changelog/email-templates author into the void.** |
| **System health/status** | ⚠️ Partial | Real telemetry (providers, render failures, DB diagnostics); **Status page hardcodes DB/Auth "operational"; Secrets/Crash degrade silently.** |
| **Org/team management** | ⚠️ Read-only | Org detail is view-only; transfer/delete/activate-enterprise RPCs **unsurfaced**. |
| **Creator monetization** | ❌ Missing | `creator_earnings_ledger`, `creator_payout_accounts`, `patron_subscriptions`, tips — **no payouts/earnings admin**. |
| **Enterprise leads CRM** | ❌ Missing | `enterprise_leads` captured but no admin view. |

---

## 5. Broken / flagged (route to fix agent)

Ordered by severity. These are correctness/trust issues, not style.

> **Update — fixed in this branch:** #0 (provider relabel Stripe→Polar across the money surface, incl. the refund-ID prompt), #3 (admin clip-retry now calls the real `retry-failed-clip` edge fn via a new admin-on-behalf path, instead of a no-op status flip), #5 (P&L error state), #9 (Abuse "not enforced" disclaimer), #10 (Gallery reorder neighbour swap). Each is marked **✅ FIXED** below. The rest remain open.

0. **✅ FIXED — Whole money surface was built against the wrong provider** (`AdminRefundsPage`, `AdminCouponsPage`, `AdminSubscriptionsPage`, `AdminInvoicesPage`, `AdminReconcilePage`, `AdminFinancialsPage`, `AdminPnlPage`) — billing is **Polar**, but every label, instruction, ID placeholder, and job type says "Stripe." Data is real (Polar reuses the legacy `stripe_*` columns), but operators are told to enter `re_...` Stripe refund IDs and use the Stripe dashboard, neither of which exists. _Fix: relabel the money surface to Polar (or provider-neutral); change the refund-ID prompt/format; point operators to the Polar dashboard/API._
1. **Refunds issue no real refund** (`AdminRefundsPage`) — Approve/Mark-processed only update `refund_requests`. High risk of an operator believing money was returned. _Either wire a Polar refund call or relabel as "record-only"._
2. **Coupons never reach the payment provider** (`AdminCouponsPage`) — Create inserts a DB row; `stripe_coupon_id` stays null; no Polar discount is created. Codes likely fail at checkout.
3. **✅ FIXED — Project "Retry failed clips" bypassed the real retry path** (`AdminProjectDetailPage`, also `AdminFailedClipsQueue`) — sets `video_clips.status='pending'` directly with an optimistic success toast; no `retry_count` reset/cap. **A proper `retry-failed-clip` edge function exists and is what the user-facing `src/pages/Production.tsx` calls — the admin retry buttons should invoke it instead of flipping the status column.**
4. **Status page fakes DB/Auth health** (`AdminStatusPage`) — both hardcoded `operational`; a real outage wouldn't surface.
5. **✅ FIXED — P&L rendered silent $0 on failure** (`AdminPnlPage`) — now surfaces an error banner + dashes the KPIs instead of looking like a real zero statement.
6. **PeopleOverview reads `profiles.select("*")` incl. email directly** — contradicts the column-revocation pattern (other pages use `admin_get_profile`). May error or blank the email column; also a data-exposure smell. _Known issue: see `profiles-cross-tenant-leak` memory._
7. **Config page: two competing flag systems + misleading runtime claims** — hardcoded `DEFAULT_FEATURE_FLAGS` saved to `system_config`, disjoint from the `feature_flags` table; Info card asserts effects ("maintenance mode blocks generations") with no visible consumer.
8. **Announcements compose into the void** — live banner reads a different `system_config` key than the page writes.
9. **✅ FIXED (disclaimer) — Abuse rules not enforced and not disclaimed** — disclaimer added; runtime enforcement still TODO. `abuse_rules` CRUD with no runtime consumer; unlike Content Safety, no "not enforced" notice → operators will trust a blocklist that does nothing.
10. **✅ FIXED — Gallery reorder collided** (`AdminGalleryCurationPage`) — now swaps `sort_order` with the actual neighbour. Was: Up/Down changes one row's `sort_order` ±1 without swapping the neighbor → duplicate values, unreliable order.
11. **Degraded fallbacks render wrong UI silently** — User detail fallback blanks auth/org data and mis-enables "Force verify"; Project detail fallback zeroes the Costs tab; Dashboard fallback hardcodes `signups_7d=0`. Only correct when the corresponding RPC migration is deployed.
12. **Crash forensics is in-memory only** (`AdminCrashForensicsPage`) — empty on every fresh load; "Errors 24h" is meaningless against a 100-entry session buffer. Either persist server-side or relabel as "this session".
13. **AdminPipelineMonitor health is keyed on hardcoded provider names** — mismatch with `api_cost_logs.service` yields fake all-green; icons never match; latency always 0; active-job title/user stuck on "Loading…".
14. **Window-scoped stats presented as totals** — Credits inflow/outflow (200 rows), Projects KPIs (5000), Moderation flagged (2000), Edge logs (1000) compute over capped client fetches, not platform totals.
15. **Secrets page silently shows "Unknown"** if `check-secrets-status` edge fn isn't deployed (likely current state).

**Lower-severity / UX:** native `prompt()`/`confirm()` across User detail, Refunds, Reconcile, Sessions, GDPR, Failed clips (inconsistent with the shared `AdminDialog`); Packages lacks the standard page shell; nested double-tabs in Money→Treasury→Finance; `db-diagnostics` has no refresh; stray `console.log("Cost Analysis Debug")` and hardcoded/stale cost constants (incl. "Lovable $49" after the product migrated off Lovable) in `CostAnalysisDashboard`; pervasive `as never`/`as any` RPC casts from the known `types.ts` drift.

---

## 6. Prioritized recommendations

Ranked by impact ÷ effort. "Slot" = where it lands in the existing structure.

### Tier 1 — High impact, low effort (do first)

1. **Surface the orphaned write RPCs.** `admin_change_account_type`, `admin_force_tier`, `admin_transfer_org_owner`, `admin_delete_org`, `admin_activate_enterprise_org`, `admin_create_impersonation_token` are fully built + audited with **no UI**. Add action menus to **User detail** (account-type, force-tier, impersonation) and **Org detail** (transfer/delete/activate-enterprise). Highest value-per-hour in the whole console — backend is done.
2. **Correct the payment provider across the money surface (#0), then fix the trust-breaking flows (#1, #2).** First relabel everything Polar/provider-neutral and fix the refund-ID prompt/dashboard instructions — cheap and prevents operators following dead Stripe steps. Then either wire real Polar refund/coupon calls or relabel "record-only" and drop the "mirrored to Stripe" claims. An operator acting on a false "refunded" state is a real-money incident.
3. **Honest health & error states (#4, #5, #9, #15).** Replace hardcoded `operational` on Status with real probes (or remove the rows); add error UI to P&L; add a "not enforced" disclaimer to Abuse; surface "edge fn not deployed" on Secrets. Cheap, prevents false confidence.
4. **Verify/fix clip retry (#3).** Confirm whether `pending` clips are re-consumed; if not, call the actual re-render edge function and reset `retry_count`. If yes, document it. Currently the most likely "I clicked retry and nothing happened" complaint.
5. **Fix Gallery reorder (#10)** with a neighbor swap (or fractional ordering). One-function fix.

### Tier 2 — High impact, medium effort

6. **Multi-admin + server-side scopes.** The single-admin lock (5 layers) and client-only scopes are the top structural ceiling — required before any operator/team can use this, and before a subdomain deploy. Add an `admin_scopes` table, enforce scope in the RPCs (not just `scopes.ts`), and relax the admin lock to a managed set. Slots into existing `AdminTeamPage`/`AdminRolesPage` + `OpsAccessProvider`.
7. **Wire one flag/experiment system to runtime.** Pick the `feature_flags` table (delete the Config-page hardcoded duplicate), add a product-side read (context + hook), and gate one real feature. Turns ~3 PARTIAL pages (flags, experiments, config) into live levers and removes the "two systems" confusion.
8. **Real refunds/coupons/subscription management via Polar.** Build edge functions (alongside the existing `polar-webhook`/`polar-portal`) for refund issuance, discount/coupon sync, and subscription cancel/sync; wire into the existing Refunds/Coupons/Subscriptions pages. (Depends on #2's decision.)
9. **Creator monetization admin.** New Money-hub deck over `creator_earnings_ledger` / `creator_payout_accounts` / `patron_subscriptions` / tips — earnings review + payout approval. A `stripe-connect-payout` edge function already exists for the payout rail; the admin surface over it does not. Currently a full capability with zero oversight.

### Tier 3 — Medium impact

10. **Enterprise-leads CRM view** over `enterprise_leads` (new Growth or People deck) — captured today, invisible to admins.
11. **Server-side pagination/aggregation** for the capped pages (#14) so stats are true totals; add proper filtering RPCs.
12. **Connect the "authoring-into-the-void" surfaces** — public changelog page consuming `changelog_entries`; route announcements to the live banner key; wire `email_templates` into the send pipeline (or clearly mark all three "draft/reference only").
13. **Persist crash forensics** server-side (table written by the client error boundary) so the page reflects real incidents, not the current session.
14. **DM & broader content moderation**, support ticket workflow (assignment/SLA/status), and real email send from the support inbox.

### Tier 4 — Hygiene / consistency

15. Replace native `prompt()/confirm()` with `AdminDialog`; give Packages the standard `AdminPageShell`; flatten the Money→Treasury nested tabs; add refresh to `db-diagnostics`; remove `console.log` + stale cost constants in `CostAnalysisDashboard`; regenerate `types.ts` to kill the `as any/never` RPC casts.

### Structural / longer-term

16. **Separate admin deploy/subdomain** (`admin.<domain>`). Already a distinct in-repo module with its own layout/router/RBAC and dead-code elimination — but ships in the same SPA. Prereqs: Tier-2 #6 (multi-admin + real scopes) must land first. Then extract shared primitives, give the subdomain its own admin auth flow, and drop `/admin/*` from the main SPA.

---

_Audit only — no code was changed. Page/route/RPC references current as of the `admin-review` branch. Items in §5 are flagged for the fix agent._
