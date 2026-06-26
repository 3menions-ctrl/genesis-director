# Admin Analytics — Charts & Visualizations Report

_Branch: `admin-analytics`. Adds graphs, charts, and analytic tools across the admin console, wired to **real data only** — every series is derived from data the page already fetches (or an existing real RPC/table). No mock, placeholder, or hardcoded numbers were introduced._

---

## TL;DR

- **39 admin surfaces** gained visualizations; **0 fabricated metrics**.
- A single reusable, cohesive chart kit (`src/admin/ui/charts.tsx`) backs every addition, matching the existing borderless/floating "Aurora" design language (accent→cyan gradients, hairline grid, dark-glass tooltips, no card borders). Charts are built on **recharts** — the library already used by the 11 hand-charted pages — not a new dependency.
- Every chart **reuses the page's existing fetch** (derived via `useMemo`, or the new `AdminConsoleV2` `charts` render-prop). Only one page added a column to an existing query (`movie_projects.created_at`); no new network round-trips elsewhere.
- Empty / loading / error states are handled centrally by the kit (charts no-op to an inline empty state on empty arrays; chart blocks are guarded to render only after load with rows present).
- **Point-in-time snapshots are not faked into trends.** Pages whose data has no time dimension (P&L, storage billing, DB diagnostics/health, storage buckets, status) get categorical breakdowns of the *real current snapshot* plus an explicit "point-in-time" caption — flagged, not invented.

### Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` (whole project) | **0 errors** |
| `vitest run` (full suite) | **3855 passed**, 61 skipped (incl. 10 new chart-helper tests) |
| `npm run build:admin` | **exit 0** |
| ESLint (changed files) | no new errors introduced (pre-existing `as any` RPC casts unchanged) |
| Fabricated-data scan | none — every `data={…}` prop binds to a derived variable |

---

## Foundation

### `src/admin/ui/charts.tsx` (new) — the chart kit
Cohesive recharts wrappers + pure data helpers, so every surface looks identical and stays DRY:

- **`TrendArea`** — single gradient area trend (the canonical time-series).
- **`MultiTrend`** — multi-series area (overlaid or stacked), e.g. inflow vs outflow, revenue vs cost.
- **`CategoryBars`** — borderless horizontal-bar breakdown (CSS bars; crisp at any row count).
- **`Donut`** — donut + legend + centered total, for status/type distributions.
- **`MiniHistogram`** — vertical-bar histogram for discrete distributions (retry counts, rollout %).
- **`ChartState`** — shared loading/empty/error placeholder.
- **Helpers** (pure, unit-tested): `bucketByDay` (contiguous UTC daily series, count or sum), `countBy`, `sumBy`, `topN`, `pct`. Re-exports the brand palette.

### `src/refine/components/AdminConsoleV2.tsx` — `charts` render-prop
Added `charts?: (rows) => ReactNode`, rendered between the signals and the table, receiving the **already-loaded rows** (no extra query). Console-based authoring pages opt in with one prop. Renders only after data resolves with rows present.

### `src/test/admin/chartHelpers.test.ts` (new)
10 unit tests covering day-bucketing (contiguity, count vs sum, window/invalid-date exclusion), `countBy`/`sumBy` aggregation + sort, `topN` tail-folding, and `pct` divide-by-zero. All pass.

---

## Run Diagnostic — comprehensive one-click health check

A new **Run Diagnostic** tool probes the whole platform on demand and surfaces every real error in one place. Launch it from the **Run diagnostic** button on the dashboard hero, or visit `/admin/diagnostics` (Observability section) — it auto-runs on load and can be re-run any time.

**What it does:** fires a battery of **read-only** probes (head-counts, SELECTs, SECURITY-DEFINER read RPCs, a presence check of edge secrets) across four domains, with bounded concurrency, per-check timing, and crash/timeout safety. Results **stream in** as they settle and roll up to a verdict (Healthy / Degraded / Critical). Every failing or warning row expands to its **raw backend error** + a remediation hint + a deep link to the surface to fix it. Export the full report via **Copy** or **CSV**.

> Strictly read-only — **0 mutations**. A missing RPC, RLS denial, or unreachable table is reported as a genuine failure with the backend's own message (exactly the "degraded fallback" class of bug flagged in `ADMIN_REVIEW.md`). Nothing is fabricated; a probe that can't run says so.

**Coverage (≈32 checks):**
| Domain | Sample checks (real source) |
|---|---|
| **Platform & infrastructure** | DB connectivity (`profiles`), `is_admin` authorization, core RPCs (`admin_dashboard_pulse`, `admin_db_diagnostics`, `admin_storage_overview`, `admin_get_audit_logs`), edge secrets present (`check-secrets-status`) |
| **App & render pipeline** | clips table, render success 24h (`render_success_snapshot`), stuck jobs >10m (`video_clips`), failed projects, stitch jobs, provider success rate 24h (`api_cost_logs`), failure-log RPC |
| **Business accounts** | `organizations`, `organization_members`, active `subscriptions`, `org_api_keys`, failing `webhook_endpoints`, pending `refund_requests`, `ledger_pnl`, credit-balance drift (`ledger_reconcile`) |
| **Regular user accounts** | profiles + email column readability, `credit_transactions`, sessions RPC, onboarding RPC, open `support_messages`, overdue `gdpr_requests` (>30d), `signup_analytics`, `notification_preferences` |

**Engineering:** the framework (`src/admin/diagnostics/engine.ts`) is network-agnostic and unit-tested (16 tests: concurrency cap, throw→fail, timeout→fail, streaming, verdict rollup, report rendering); the probes live in `src/admin/diagnostics/checks.ts`; the UI is `src/refine/pages/ops/AdminDiagnosticsPage.tsx`. Registered in the ops registry + routed in `AdminApp.tsx` (contract tests pass).

---

## Dashboard (Mission Control) — comprehensive expansion

`/admin` was expanded from a single trend + status donut into a decision-making cockpit. Everything is real and the time window is labeled on every panel (windows are never presented as all-time totals).

**New — App Health band** (live operational signals, 24h):
| Signal | Value | Real source |
|---|---|---|
| Render success | `success_rate_pct` % + failure count, tone-colored (≥95 green / ≥80 amber / <80 rose) | RPC `render_success_snapshot(24)` — authoritative, server-side |
| Provider success | `(total − failed) / total` %, tone-colored | `api_cost_logs` exact **head-counts** (total + `status='failed'`), 24h |
| Queue active | clips pending/generating | `video_clips` head-count |
| Stuck >10m | clips with no update for 10m, rose if >0 | `video_clips` head-count (`updated_at < now-10m`) |
| API spend | `$` sum of sampled logs | `api_cost_logs.real_cost_cents` (24h) |
| API calls | exact volume | `api_cost_logs` head-count (24h) |

A rolled-up **overall status pill** (Operational / Watch / Degraded) sits in the hero and the health header, derived from those signals.

**New — Growth & revenue trends (14d):** Projects-created `TrendArea` (`movie_projects.created_at`) · Credit-flow `MultiTrend` of grants/purchases vs consumption (`credit_transactions.amount`).

**New — Cost & provider health (24h):** Spend-by-provider `CategoryBars` (`api_cost_logs.real_cost_cents` by `service`, top 7) · Call-outcomes `Donut` (completed/failed/other) · Hourly call-cadence `TrendArea`.

**New — health-driven action cards:** the attention queue now surfaces stuck render jobs, sub-80% render success, and sub-90% provider success — each deep-linking to the relevant ops page for one-click triage.

_Existing 6-orb KPI rail, 14-day signups trend, projects-by-status donut, action queue and hub nav are preserved._ All new reads run in one parallel batch alongside the existing pulse fetch.

---

## Per-surface additions (chart → real data source)

### Money

| Surface | Charts added | Real data source |
|---|---|---|
| **Credits** `/admin/credits` | Credit-flow MultiTrend (inflow vs outflow / day) · type breakdown bars | `credit_transactions` (existing 200-row fetch): `amount`, `transaction_type`, `created_at` |
| **Financials** `/admin/financials` | Revenue-vs-cost MultiTrend over `date` · cost-by-service bars | RPC `get_admin_profit_dashboard`: `date`, `service`, `estimated_revenue_cents`, `total_real_cost_cents` |
| **Costs** (CostAnalysisDashboard) | Daily API-cost TrendArea (honors date-range picker) · cost-by-service bars · clip-outcome Donut | `api_cost_logs` (`service`, `real_cost_cents`, `created_at`) + `video_clips` (`status`) — same rows the aggregates use |
| **Invoices** `/admin/invoices` | Daily purchase-volume TrendArea (30d) · type bars | `credit_transactions` where `stripe_payment_id` not null (Polar payments): `amount`, `created_at`, `transaction_type` |
| **Refunds** `/admin/refunds` | Status Donut · requests/day TrendArea (30d) | `refund_requests`: `status`, `created_at` (via console `charts` prop) |
| **Subscriptions** `/admin/subscriptions` | Status Donut · new-subs/day TrendArea (30d) | `subscriptions`: `status`, `created_at` |
| **Referrals** `/admin/referrals` | Top codes by redemptions bars · credited-vs-pending Donut | RPC `admin_list_referrals`: `code`, `total_redemptions`, `credited_redemptions`, `pending_redemptions` |
| **Coupons** `/admin/coupons` | Top coupons by `times_redeemed` bars · active-vs-inactive Donut | `discount_coupons`: `code`, `times_redeemed`, `active` (via console `charts` prop) |
| **P&L** `/admin/pnl` _(snapshot)_ | Revenue-mix bars · COGS-mix bars + point-in-time caption | RPC `ledger_pnl`: `revenue.{credit_usage,storage,subscription}`, `cogs.{api,storage}` |
| **Storage billing** `/admin/storage-billing` _(snapshot)_ | Top users by GB bars + point-in-time caption | RPC `storage_overview`: `users[].gb` |

### Observability / System

| Surface | Charts added | Real data source |
|---|---|---|
| **Edge logs** `/admin/edge-logs` | Hourly invocation TrendArea (24h) · spend-by-service bars · success-vs-failure Donut | `api_cost_logs` (24h): `created_at`, `service`, `real_cost_cents`, `status` |
| **Providers** `/admin/providers` | Cost-by-provider bars · avg-latency-by-provider bars | `api_cost_logs` (7d), reusing the page's client-side `service` grouping (`real_cost_cents`, `duration_seconds`) |
| **Queue** `/admin/queue` | Status Donut · retry-count MiniHistogram · by-engine bars | `video_clips` (pending/generating): `status`, `retry_count`, `engine` |
| **Telemetry** `/admin/observability` | Classification Donut (replaced hand-rolled bars) · hourly failure-cadence TrendArea | RPC `render_failures_histogram` (`classification`,`n`) + `render_failures.created_at` |
| **Backups** `/admin/backups` | Backup-size TrendArea (over `started_at`) · status Donut | `db_backups_log`: `started_at`, `size_bytes`, `status` (via console `charts` prop) |
| **Asset storage** `/admin/storage` _(snapshot)_ | Bytes-by-bucket Donut · object-count-by-bucket bars + caption | RPC `admin_storage_overview`: `bucket_id`, `total_bytes`, `object_count` |
| **Diagnostics** `/admin/db-diagnostics` _(snapshot)_ | Top tables by `bytes` bars · by `rows` bars + caption | RPC `admin_db_diagnostics`: `tables[].{bytes,rows}` |
| **Database** `/admin/db-health` _(snapshot)_ | Per-table row-count bars + live-not-historical caption | The page's existing live per-table count queries |
| **Status** `/admin/status` _(snapshot)_ | Component-health Donut (operational/degraded/outage) + caption | The page's existing computed `components` health (from `api_cost_logs` 15-min window + stuck-clip probe) |
| **Pipeline** (AdminPipelineMonitor) | Completed-vs-failed Donut (today) · failures-by-service bars | `api_cost_logs` today + `video_clips` — the page's computed `metrics`/`services` |
| **Failed clips** (AdminFailedClipsQueue) | Error-category bars · retry-count MiniHistogram | `video_clips` (failed): `last_error_category`, `retry_count` |

### Growth / Content

| Surface | Charts added | Real data source |
|---|---|---|
| **Onboarding** `/admin/onboarding-analytics` | Intents/day TrendArea (30d) · account-type Donut · top use-case bars | RPC `admin_list_onboarding_intents`: `created_at`, `account_type`, `primary_use_case` |
| **Moderation** `/admin/moderation` | Flagged/reported per-day TrendArea (30d) · status Donut · public-vs-private bars | `movie_projects` (`status`, `is_public`; `created_at` added to the existing select) |
| **Comments** `/admin/comments` | Comments/day TrendArea (30d) · top-commenters bars · likes MiniHistogram | `project_comments`: `created_at`, `user_id`, `likes_count` |
| **Avatar catalog** `/admin/avatar-catalog` | Category Donut · enabled/featured bars | `avatar_catalog_entries`: `category`, `enabled`, `featured` (console `charts`) |
| **Gallery** `/admin/gallery` | Category Donut · active-vs-hidden Donut | `gallery_showcase`: `category`, `is_active` (console `charts`) |
| **Template library** `/admin/template-library` | Top templates by `use_count` bars · category Donut | `project_templates`: `use_count`, `category` (console `charts`) |
| **Content safety** `/admin/content-safety` | Severity Donut · match-type bars | `content_safety_rules`: `severity`, `match_type` (console `charts`) |
| **A/B tests** `/admin/experiments` | Status Donut · launches-per-month bars | `experiments`: `status`, `started_at` (console `charts`) |
| **Feature flags** `/admin/feature-flags` | Audience Donut · enabled Donut · rollout-% MiniHistogram | `feature_flags`: `audience`, `enabled`, `rollout_percentage` (console `charts`) |
| **Insights** `/admin/insights` | Top page-transition bars (augments existing funnel) | RPC `analytics_paths`: `from_path`, `to_path`, `transitions` |

### People / Access

| Surface | Charts added | Real data source |
|---|---|---|
| **Projects** `/admin/projects` | Status Donut · projects/day TrendArea (30d) | `movie_projects` (`status`; `created_at` added to the existing select) |
| **Orgs** `/admin/orgs` | Plan Donut · orgs/day TrendArea (30d) · industry bars | `organizations`: `plan`, `created_at`, `industry` |
| **Audit** `/admin/audit` | Actions/day TrendArea (14d) · action-type bars · target-type Donut | RPC `admin_get_audit_logs`: `action`, `target_type`, `created_at` |
| **Sessions** `/admin/sessions` | Sign-ins/day TrendArea (14d) · active-vs-idle Donut · tier bars | RPC `admin_list_sessions`: `last_sign_in_at`, `is_active_24h`, `is_idle_24h`, `account_tier` |
| **Roles** `/admin/roles` | Role Donut · grants/day TrendArea (30d) | `user_roles`: `role`, `granted_at` (console `charts`) |
| **API keys** `/admin/api-keys` | Active-vs-revoked Donut · keys/day TrendArea (30d) | `org_api_keys`: `revoked_at`, `created_at` (console `charts`) |
| **Webhooks** `/admin/webhooks` | Active-vs-paused Donut · failure-count MiniHistogram | `webhook_endpoints`: `active`, `failure_count` (console `charts`) |
| **User detail** `/admin/users/:id` | Action-volume TrendArea (30d) · by-action bars | RPC `admin_recent_user_actions`: `action`, `created_at` |
| **Org detail** `/admin/orgs/:id` | Member-role Donut · project-status Donut · members-joined/day TrendArea | RPC `admin_get_org_detail`: `members[].{role,joined_at}`, `recent_projects[].status` |
| **Emails** `/admin/emails` | Status Donut · emails/day TrendArea (14d) · template bars | RPC `admin_get_email_log`: `status`, `created_at`, `template_name` |

---

## Honest gaps / things flagged rather than invented

These surfaces would benefit from **time-series trends**, but the underlying data is a **point-in-time snapshot** with no historical store. Rather than fabricate a trend (the failure mode this codebase has a history of), each shows a real categorical breakdown of the current snapshot plus a "point-in-time" caption. To unlock real trends, the platform would need scheduled snapshot logging:

- **P&L / Storage billing** — `ledger_pnl` / `storage_overview` return current positions only. A daily `ledger_pnl_history` / `storage_overview_history` table would enable margin/GB trends.
- **DB health / DB diagnostics** — live `count`/`pg_stat` reads. A `table_metrics_history` snapshot table would enable growth trends.
- **Status** — 15-minute rolling health; a `status_checks` log would enable an uptime timeline.

Authoring surfaces whose **output the product runtime does not yet consume** (Experiments, Feature flags, Content safety) received charts for *operator visibility into what's been authored* — this matches the existing "source of record / advisory" framing on those pages and is noted in code. It does not imply runtime enforcement (see `ADMIN_REVIEW.md` §5).

`AdminCrashForensicsPage` and `AdminSecretsPage` were intentionally left without charts: crash forensics is in-memory/per-session (no real persisted series), and secrets is a presence checklist, not time/quantitative data.

---

## Files changed
- New: `src/admin/ui/charts.tsx`, `src/test/admin/chartHelpers.test.ts`
- Modified: `src/refine/components/AdminConsoleV2.tsx` + 39 admin page/component surfaces (Money, Observability/System, Growth/Content, People/Access) listed above.

_No live Polar/Stripe calls were made; all reads go through the app's normal Supabase data layer. Committed to `admin-analytics`; not merged into `main`._
