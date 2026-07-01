# Prod reconciliation (gated batch) — 2026-07-01

Read-only reconciliation of the DEFERRED "gated / schema" items against the LIVE
prod DB (`ywcwaumozoejierlfkgj`) via the Supabase Management API, after sign-off.
Purpose: fix only what's actually broken in prod (repo assumptions ≠ prod, which
is migrations-behind with out-of-band state).

## Findings & actions

| Item | Prod state (verified) | Action |
|---|---|---|
| **P1-20 Business onboarding RLS** | **BROKEN** — `onboarding_intents` INSERT policy `WITH CHECK` reads a non-existent `email` column → every insert rejected → business signup fully blocked | **FIXED in prod** (ALTER POLICY → `contact_email`), verified by read-back; repo migration `20260706010000` added |
| **P2-11 Business API-key auth** | **OK** — `find_api_key_owner` returns 3 cols `(api_key_id, owner_user_id, scopes)` AND UNIONs `org_api_keys` (late migrations applied out-of-band) | none — blind-fixing would've regressed |
| **P2-18 Admin RPCs** | **OK** — all checked admin RPCs present (`admin_bulk_*`, `admin_get_user_detail`, `admin_grant_credits`, …) | none (RPC-lag was not real in prod) |
| **P2-26 Photo idempotency** | **CONFIRMED** — indexes cover `(user_id, project_id, key)` and `tip:%`/`hold:%` only; nothing covers photo keys (project_id null) | **Still deferred** — a clean fix needs a change to the core `deduct_credits` RPC (must dedupe without project_id, returning the prior result, not erroring). High blast radius; not worth risking the money RPC for a P2 rapid-double-click. Refund path already fixed (P1-15). |
| **Free-tier (P1-4)** | `free_tier_attempts` table **does not exist in prod** | Still deferred — needs the table + result-delivery build, not just a column |
| **P1-8 Recovery cron** | **CONFIRMED** — prod cron has `reconcile-credit-holds` + `expire-credit-holds` (active), but NO `zombie-cleanup` / `pipeline-watchdog` / `admin-stuck-jobs-watchdog` | Deferred pending edge-fn deploy (watchdog double-refund fix must ship first) + a scheduling decision |
| **Crossover (P2-24)** | only `crossover_browse` exists (no use-count RPC/column) | Still deferred — needs schema |

## Net
- **1 real prod bug fixed** (P1-20 — unblocks all business signups).
- **2 "deferred" items were already correct in prod** (P2-11, P2-18) — reconciliation prevented two wrong "fixes."
- The rest remain correctly deferred (need bigger schema builds or a risky core-RPC change), now with **verified prod facts** rather than repo guesses.

## Still pending for a fully "functional" prod: EDGE-FUNCTION DEPLOYMENT
The Batch 1–5 pipeline fixes live in the repo but are **not deployed** to prod's
edge functions. That deployment is the main remaining lever — see the deployment
plan / risk notes in the session summary. Core-pipeline functions
(generate-single-clip, hollywood-pipeline, mode-router, final-assembly,
auto-stitch-trigger, check-specialized-status, retry-failed-clip, edit-photo)
must be deployed carefully (no staging exists; repo-vs-deployed parity unverified;
a bug breaks live rendering), ideally incrementally with monitoring.
