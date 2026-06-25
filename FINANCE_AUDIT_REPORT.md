# Finance System Audit & Hardening Report

**Branch:** `finance-hardening`
**Date:** 2026-06-24
**Scope:** End-to-end money system — credit ledger, holds lifecycle, org vs personal
pools, pricing/subscriptions, Polar/Stripe integration, money math, financial
authorization/RLS, and the 9 remediation migrations (`20260704000000`–`000800`).

**Constraints honored:** no live Polar/Stripe calls (review only), no migrations
applied to any live DB, no production data mutated. Every item that requires a
live deploy or data correction is listed in the final section, not performed.

---

## 0. Method

This is a hardening pass on top of a prior read-only audit (`AUDIT_REPORT.md`)
and its remediation (`FIX_REPORT.md`, migrations `20260704000000`–`000800`). I
(a) re-verified the prior fixes against current source, (b) traced every money
path firsthand, (c) fan-out-audited the independent paths (holds, webhooks,
pricing, org pools, RLS) with file:line evidence, and (d) applied fixes for what
I found, re-verifying each critical fix 3× against the actual function bodies.

**Result of the build/test gate (after all fixes):**

| Gate | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | ✅ exit 0 |
| `npm run build` (vite) | ✅ exit 0 |
| `vitest run` (full suite) | ✅ **3778 passed**, 61 skipped, 0 failed (116 files) |
| New money-path tests | ✅ `src/test/regression/finance-hardening.test.ts` (6 tests) |

> Edge functions are Deno and migrations are SQL — neither is covered by the
> vitest/tsc project. They were verified by line-by-line reading; the new tests
> lock the importable money-math invariants (rate, integer credits, boundaries,
> grant cap).

---

## 1. Verification of the prior 9 remediation migrations (`20260704000000`–`000800`)

| Mig | Intent (prior finding) | Verdict |
|---|---|---|
| `000000` revert credit ledger repoint | C-1: read path back to `credit_transactions` | ✅ Mechanism correct — **but data incomplete** (see C-NEW-1) |
| `000100` fix monthly org refill ref | H-5: `add_credits(NULL)` crash | ✅ Crash fixed — **but funds the wrong pool** (see C-NEW-2) |
| `000200` org member role update guard | H-1: admin self-promote to owner | ✅ Correct (`USING`+`WITH CHECK`, owner-only owner changes) |
| `000300` payout_id nullable for claim | H-4: payout double-pay race | ✅ Correct — atomic claim before transfer + Stripe `idempotencyKey` |
| `000400` profit dashboard rate + divzero | M-5/M-13: 11.6¢ vs 10¢, ÷0 | ✅ Correct — 10¢ + `CASE … >0` guard; supersedes all 11.6¢ defs |
| `000500` fix admin bulk suspend column | (non-money) | ✅ N/A to finance |
| `000600` org-scoped credit_transactions | H-6: per-viewer vs pooled analytics | ✅ Correct — `organization_id` + trigger + membership-gated RPC; all 3 business pages rewired |
| `000700` org pool consumption | (feature) org spend debits org pool | ⚠️ Coherent debit logic — **but exposes 2 critical gaps** (C-NEW-2, C-NEW-3) |
| `000800` get_org_credit_state | (feature) org balance RPC | ✅ Correct — membership-gated, no cross-org leak |

**Ordering & reversibility:** all 9 are timestamp-ordered and apply on a clean
chain. Each is `CREATE OR REPLACE` / additive (no destructive `DROP`/`TRUNCATE`),
so re-applying is safe and a prior definition can be restored by re-running the
superseded migration. The new migrations in this branch (`000900`–`001400`)
continue the sequence and build only on objects defined earlier in the chain.

---

## 2. New findings (severity-ranked) — fixed in this branch

### 🔴 C-NEW-1 — C-1 revert is incomplete: opening balances stranded → existing users read ~0
**Severity:** Critical (every pre-2026-06-20 balance reads as zero)
**Evidence:** `20260620212254_finance_clear_and_seed.sql:13-27` seeds each user's
opening balance **only into `ledger_entries`** and then `TRUNCATE public.credit_transactions`.
The C-1 revert (`20260704000000:24-35`) repoints `credit_ledger_total` back to
`credit_transactions` — a table that no longer holds those balances. So the
revert restored the *mechanism* but not the *data*: `get_credit_state`
(`20260518175601_…df2.sql:117`) sums an empty table → ~0 for every existing user.
**Fix:** `supabase/migrations/20260704000900_backfill_opening_balances.sql` —
re-inserts each archived balance from `profiles_credit_archive` as one
`opening_balance` `credit_transactions` row. Idempotent (`stripe_payment_id =
'opening_balance:<uid>'` + partial-unique index + `NOT EXISTS` guard), guarded to
no-op on a fresh DB, and re-syncs the `profiles` cache.
**Verified 3×:** `opening_balance` is **not** in `credit_ledger_total`'s excluded
set → counted toward the balance; `organization_id` defaults NULL → counts as
personal (correct after `000700`); the `NOT EXISTS` guard + partial unique make
re-runs no-ops. **⚠️ Mutates live balances — see §4.**

### 🔴 C-NEW-2 — Org credit pool is drained but never funded (regression introduced by `000700`)
**Severity:** Critical (all business generation blocked once `000700` deploys)
**Evidence:** `000700` makes org-project generations debit
`organizations.credits_balance` (`20260704000700:79,164,180-184,238,246-250`).
But the monthly refill credits the **owner's personal wallet** via `add_credits`
(`20260704000100:49-54` → `add_credits` only writes a personal `credit_transactions`
row), and the only function that increments `organizations.credits_balance`,
`topup_org_credits` (`20260503051653:61-88`), has **zero callers** anywhere in
`src/` or `supabase/functions/`. `organizations.credits_balance` defaults to 0.
Net: org pool sits at 0 forever, every org generation hits `insufficient_credits`,
while the owner silently accrues unusable personal credits.
**Fix:** `20260704001000_org_refill_funds_pool.sql` — redefines
`monthly_org_credit_refill` to fund the **org pool** via `topup_org_credits`
instead of the owner's profile. Idempotency preserved by the existing
`org_credit_refills` `NOT EXISTS` guard + `UNIQUE(organization_id, refill_period)`.
**Verified 3×:** `topup_org_credits` 3-arg signature matches; both functions are
`SECURITY DEFINER`; the refill row's audit record is unchanged. *(Initial
provisioning at purchase still needs a top-up — flagged §3/§4.)*

### 🔴 C-NEW-3 — Org credit pool is directly self-grantable (free unlimited credits)
**Severity:** Critical (payment bypass)
**Evidence:** the `organizations` UPDATE policy
(`20260502172041_…d.sql:178-180`) has **no `WITH CHECK` and no column restriction**,
and the only `BEFORE UPDATE` trigger on the table is `update_updated_at_column`
(`…:130-132`). Any user auto-gets a personal org (`trg_create_personal_org`) or
can `INSERT` one as `created_by=self` (`…:174-176`), then — because `000700` now
spends from `organizations.credits_balance` — run
`UPDATE public.organizations SET credits_balance = 1000000 WHERE id = <theirs>`
via PostgREST and generate for free.
**Fix:** `20260704001100_finance_authz_hardening.sql` — adds
`fn_organizations_block_sensitive_self_update` `BEFORE UPDATE` trigger that
reverts `credits_balance`/`total_credits_used`/`total_credits_purchased` on any
non-service-role update (mirrors the proven `fn_profiles_block_sensitive_self_update`).
The org-pool RPCs and webhooks run as service role and are exempt.
**Verified 3×:** the consume/deduct RPCs (`000700`) and `topup_org_credits` are
`SECURITY DEFINER` (run as table owner → service-role-equivalent) so the guard
does not block legitimate debits/credits; only client PostgREST PATCHes are reverted.

### 🔴 C-NEW-4 — Pipeline failure double-credits the user (refund + hold release)
**Severity:** Critical (money leak on every hold-based failure)
**Evidence:** `_shared/pipeline-failure.ts` issued `refund_credits` (step 3,
a **positive** ledger row) **and** released the credit hold (step 4) on every
terminal failure. In the hold flow the credits were only *reserved*, never
debited (consume runs only on success), so releasing the hold already returns
them — the `refund_credits` row then **gifts** the user phantom credits.
Confirmed at the seedance call site: hold succeeds → `chargedCredits=true`
(`seedance-pipeline/index.ts:475`) → failure passes `totalCredits=plannedCredits,
skipRefund=false` (`…:953-961`) → both fire.
**Fix:** `_shared/pipeline-failure.ts` now reads `movie_projects.credit_hold_id`
first; if a hold is attached (`usedHoldFlow`), it **releases only and skips
`refund_credits`**. The proportional refund path remains for the legacy
upfront-deduct flow (no hold).
**Verified 3×:** hold present → refundAmount stays 0, release still runs (credits
returned once); no hold → refund proceeds unchanged (backward compatible);
`skipRefund` resume paths unaffected.

### 🟠 H-NEW-1 — Orphan hold when `projectId` is null at reserve time (never charged / phantom refund / org bypass)
**Severity:** High (revenue leak + compounds C-NEW-4)
**Evidence:** both pipelines reserve credits **before** the project exists:
`seedance-pipeline/index.ts:456-463` and `hollywood-pipeline/index.ts:6787-6794`
pass `projectId: request.projectId ?? null`. For a new generation that is `null`,
so `holdCreditsForPipeline` (`_shared/pipeline-credits.ts:62,95`) sets **no
idempotency key** and never persists `credit_hold_id`. Then `consumePipelineCredits`/
`releasePipelineCredits` look the hold up via `movie_projects.credit_hold_id`
(`…:123-135,168-177`), find null, and **no-op** — so on success the user is never
charged, and on failure the hold orphans (until TTL) while `refund_credits` still
fires (the phantom-refund half of C-NEW-4). It also bypasses org-pool routing,
which derives the org from the hold's project.
**Fix:** new `linkPipelineHold()` in `_shared/pipeline-credits.ts` sets
`movie_projects.credit_hold_id` **and** backfills `credit_holds.project_id` after
the project is created; called in seedance (`index.ts` after project insert) and
hollywood (`index.ts` after project insert) with the captured `holdId`.
**Verified 3×:** consume now finds the hold (charge happens once); release now
frees it on failure; consume re-derives the org from the linked `project_id` so
org spend debits the org pool. *(Reserve-time still checks the personal pool for
a brand-new org generation until the project exists — minor gate inaccuracy on
the un-deployed org path; proper long-term fix = project-before-reserve, flagged §3.)*

### 🟠 H-NEW-2 — Credit-hold reconciler & expiry were never scheduled
**Severity:** High (stuck/orphaned holds never healed)
**Evidence:** `reconcile_pipeline_credit_holds()` (`20260518165621`) and the
`reconcile-credit-holds` edge function exist, but no `cron.schedule` references
them anywhere; `expire_credit_holds()` runs only lazily inside
`reserve_credits`/`deduct_credits`. So the safety net for H-NEW-1 and any missed
consume/release never runs automatically.
**Fix:** `20260704001200_schedule_credit_hold_reconcile.sql` schedules both via
pg_cron every 5 min (DB-only — both are SQL functions). Idempotent (unschedules
prior jobs first) and guarded to no-op where pg_cron is absent (local/CI).

### 🟠 H-NEW-3 — Refunds/chargebacks never reversed purchased credits
**Severity:** High (buy → spend → refund → keep the value)
**Evidence:** `polar-webhook/index.ts` handled only `order.paid` + subscription
events — **no refund case**. The Stripe handler routed `charge.refunded` only to
`fireAdminAlert` (`_shared/stripe-webhook-handler.ts:276-292`) with no ledger
effect. `refund_credits` exists but is called only by pipeline-failure paths.
**Fix:** `20260704001400_refund_reversal_rpc.sql` adds the service-role-only,
idempotent `reverse_credit_purchase` (inserts a negative `refund_reversal` row;
balance may go negative if already spent — correct accounting). Wired into
`polar-webhook` via a new `order.refunded` case + `reverseCredits()`.
**Verified 3×:** idempotent on `refund_reversal:<ref>`; `refund_reversal` counted
by `credit_ledger_total`; revoked from anon/authenticated, granted service_role.
*(Stripe `charge.refunded` clawback flagged §3 — that event lacks the original
credit/user metadata and needs a payment→grant lookup; Stripe is not the active
provider.)*

### 🟠 H-NEW-4 — 100,000-credit grant cap silently drops the largest paid plans
**Severity:** High (paid, zero credits)
**Evidence:** `add_credits` rejects `p_amount > 100000`
(`20260518175601_…df2.sql:437`) and both webhooks skip a grant > 100000
(`polar-webhook:66`, `_shared/stripe-webhook-handler.ts:85`). But
`create-plan-checkout/index.ts` sells `business_growth_yearly` (60,000) and
`business_scale_yearly` (**240,000**) credits. A `business_scale_yearly` buyer is
charged and granted **0** — the exact "paid, no credits" failure mode at the cap
boundary.
**Fix:** `20260704001300_raise_credit_grant_cap.sql` raises the `add_credits` cap
to 1,000,000 (verbatim body otherwise); both webhook guards raised to match.
`detect_credit_anomaly` still flags unusually large grants.
**Verified 3×:** 240,000 < 1,000,000; body identical except the cap; new test
asserts the invariant.

### 🟠 H-NEW-5 — Cross-tenant read of any user's credit balance / pending payout
**Severity:** High (information disclosure)
**Evidence:** `ledger_user_credit_balance(uuid)` (`20260620212145:76-80`) and
`creator_pending_payout_cents(uuid)` (`20260612020000:98-109`) are
`SECURITY DEFINER`, granted to `authenticated`, with **no ownership check** — any
user passes another's uid and reads their balance/pending payout.
**Fix:** `20260704001100_finance_authz_hardening.sql` revokes
`ledger_user_credit_balance` from authenticated (it has zero runtime callers
after the C-1 revert) and rewrites `creator_pending_payout_cents` as plpgsql with
an `auth.uid()`/`is_admin`/service-role guard (the client calls it arg-less, so
that path still works).
**Verified 3×:** no `src`/function caller of `ledger_user_credit_balance`;
`CreatorEarnings.tsx:33` calls `creator_pending_payout_cents` with no args
(defaults to `auth.uid()` → passes the guard).

### 🟡 M-NEW-1 — Polar grant failures were swallowed and never retried
**Severity:** Medium (paid, no credits, no retry — opposite of Stripe)
**Evidence:** `polar-webhook` `grantCredits` returned on `add_credits` error and
the handler returned **200** for all errors (`index.ts:76,161-163`), which Polar
reads as success → no retry. The Stripe handler `throw`s → 500 → retry.
**Fix:** `grantCredits`/`reverseCredits` now `throw` on RPC error and the handler
returns **500** so Polar retries on its finite backoff schedule (persistently
failing events surface in the dashboard rather than retrying forever).

---

## 3. Findings flagged (not auto-fixed) — with exact remediation steps

| ID | Finding | Why deferred | Exact fix |
|---|---|---|---|
| **F-1** | `profiles.credits_balance`/`total_credits_*` readable by **anon + authenticated** (prior H-2; `20260703010000_profiles_email_table_grant.sql:46-48`, SELECT policy `USING(true)`) | Large blast radius: many UIs read `profiles.credits_balance` directly. The migration itself calls closing this a "separate, deferred change." | Revoke column SELECT on the 3 credit columns from `anon, authenticated`; migrate own-balance reads to `get_credit_state` (already owner/admin-gated, used by `CreditsContext`); audit each `select('credits_balance')` in `src/` and route cross-user reads through an admin/org RPC. |
| **F-2** | `patron_subscriptions` is client-writable `FOR ALL` (`20260610230000:266-267`); patron can self-subscribe with no charge, set `monthly_credits=1`, push `renewal_due_at`, or delete before billing | Patron billing is deferred to a not-yet-live cron; tightening would break the current client-insert flow (`Market.tsx:538`). | Move subscribe to a service-role RPC that validates plan + records an unalterable price; restrict the table policy to `SELECT` for the patron, writes service-role-only. |
| **F-3** | `editor-generate-clip` pre-flight reads **personal** `profiles.credits_balance` even for org projects (`index.ts:295-314`) → org member with funded pool wrongly blocked / wrong `available` reported | Behind the un-deployed org-pool feature (`000700`). | For projects with an `organization_id`, gate on `get_org_credit_state(org)` instead of the personal balance before `deduct_credits`. |
| **F-4** | Stripe `charge.refunded` still only alerts (no clawback) | Stripe is not the active provider; the charge event lacks the original credits/user metadata. | Persist a `payment_intent → {user_id, credits}` map at grant time; in `handleChargeRefunded` look it up and call `reverse_credit_purchase`. |
| **F-5** | New **org** generation reserves against the **personal** pool until the project exists (org not known at reserve time) | Un-deployed org path; consume still debits the org pool correctly via the linked hold. | Create the project (with `organization_id`) **before** `reserve_credits` so the org pool is checked and held from the start. |
| **F-6** | Initial org pool funding at **purchase** time is missing (only the monthly cron funds the pool after C-NEW-2) | Org checkout path (`create-org-checkout`) is dormant and has the prior H-7 metadata-key bug. | On org subscription activation in the webhook, call `topup_org_credits(org, included_credits_monthly, 'initial')` once; fix the `organizationId`↔`organization_id` metadata key (prior H-7). |
| **F-7** | Pre-existing data-integrity items from `AUDIT_REPORT.md` still open: **H-8** (destructive seed wiped history that lifetime analytics read) and **H-9** (100 fabricated `auth.users` seeded) | Production-data cleanup, not code. | See §4. |
| **F-8** | Prior **M-2** (Stripe checkout `environment` client-controlled with sandbox→live fallback), **M-7** (dead personal auto-recharge toggle) | Lower severity / dormant Stripe path. | Server-control the env (mirror `POLAR_SERVER`); remove or implement the auto-recharge toggle. |

---

## 4. Requires live deploy / data correction — HUMAN ACTION (not performed)

These were **not** executed (no live DB / provider calls per the hard constraints).
Each needs a human with DB/provider access.

1. **Apply the opening-balance backfill (`20260704000900`) — MUTATES BALANCES.**
   It restores stranded pre-2026-06-20 balances from `profiles_credit_archive`
   into `credit_transactions`. **Before applying:** confirm `profiles_credit_archive`
   holds the correct pre-truncate snapshot, dry-run the `SELECT` to preview the
   per-user rows, and reconcile the resulting `get_credit_state` totals against
   expectation. It is idempotent, but verify once applied.

2. **Stage the full `20260704000900`–`001400` set, then validate, then promote.**
   In staging confirm: (a) a personal purchase grants spendable credits and a
   generation decrements them; (b) an org generation debits
   `organizations.credits_balance` and the monthly refill funds that pool
   (C-NEW-2); (c) the org self-grant PATCH is now reverted (C-NEW-3); (d) a
   hold-based failure returns credits exactly once (C-NEW-4/H-NEW-1); (e) the
   pg_cron jobs `reconcile-credit-holds`/`expire-credit-holds` exist and run
   (H-NEW-2). Only then apply to production.

3. **Sandbox-verify Polar renewal metadata.** `grantCredits` reads
   `order.metadata.credits` on every `order.paid` including renewals
   (`polar-webhook`). Confirm Polar propagates checkout metadata onto
   auto-generated renewal orders; if not, renewals grant 0 (pre-existing risk).

4. **Sandbox-verify the new refund clawback.** Trigger a Polar `order.refunded`
   in sandbox and confirm `reverse_credit_purchase` fires once and the balance
   drops by the refunded credits (H-NEW-3).

5. **Add initial org-pool funding on purchase** (F-6) before selling org plans —
   otherwise the first month's pool is empty until the monthly cron runs.

6. **Pre-existing production cleanup** (from `AUDIT_REPORT.md`): remove the 100
   fabricated seeded `auth.users` (**H-9**, `20260301000622_…`) and decide on
   restoring/relabeling the wiped financial history (**H-8**,
   `20260620212254_finance_clear_and_seed.sql`) that lifetime analytics read from
   now-unreferenced `*_archive` tables.

---

## 5. Files changed in this branch

**New migrations (review for staged deploy):**
- `20260704000900_backfill_opening_balances.sql` — C-NEW-1 (⚠️ mutates balances)
- `20260704001000_org_refill_funds_pool.sql` — C-NEW-2
- `20260704001100_finance_authz_hardening.sql` — C-NEW-3 + H-NEW-5
- `20260704001200_schedule_credit_hold_reconcile.sql` — H-NEW-2
- `20260704001300_raise_credit_grant_cap.sql` — H-NEW-4
- `20260704001400_refund_reversal_rpc.sql` — H-NEW-3

**Edge functions / shared:**
- `_shared/pipeline-failure.ts` — C-NEW-4 (skip refund when hold used)
- `_shared/pipeline-credits.ts` — H-NEW-1 (`linkPipelineHold`)
- `seedance-pipeline/index.ts`, `hollywood-pipeline/index.ts` — H-NEW-1 wiring
- `polar-webhook/index.ts` — H-NEW-3 (refund) + H-NEW-4 (cap) + M-NEW-1 (retry semantics)
- `_shared/stripe-webhook-handler.ts` — H-NEW-4 (cap)

**Tests:**
- `src/test/regression/finance-hardening.test.ts` — 6 new money-path invariants.

---

## 6. What is verified correct (no change needed)

- **Credit read/write are on the same table** after C-1 revert: every runtime
  mutation (`add_credits`/`deduct_credits`/`consume_credit_hold`/`refund_credits`)
  writes `credit_transactions`, and `credit_ledger_total`/`get_credit_state` read
  it. No severed path remains (once the §4.1 backfill restores the data).
- **Payout double-pay race (H-4)** — atomic claim + Stripe idempotency key.
- **Webhook signatures** — Polar (Standard Webhooks HMAC, ±300s, constant-time),
  Stripe, and Replicate all verify before trusting the payload; all fail-closed
  on missing secret.
- **Credit-grant idempotency** — `add_credits` dedupes on `stripe_payment_id`
  (partial unique index) under a `FOR UPDATE` lock; holds dedupe on
  `(user_id, idempotency_key)`.
- **Money math** — all ledger RPCs type amounts as `integer`; no fractional/NaN
  credit can be persisted; rounding is house-neutral or customer-favorable; the
  profit dashboard rate is now a single 10¢ (M-5/M-13 fixed).
- **Org analytics (H-6)** and **org balance (get_org_credit_state)** —
  membership-gated `SECURITY DEFINER`; no cross-org leakage.
- **Financial-table writes** — `credit_transactions`, `credit_holds`,
  `ledger_entries`, payout tables have RLS enabled with no client write policy
  (default-deny); money-mutating RPCs are service-role-only or admin-gated.
