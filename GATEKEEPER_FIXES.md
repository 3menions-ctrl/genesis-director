# Gatekeeper hardening — fixes

Branch `fix/gatekeeper-hardening` off `main`. Closes the gaps from the gatekeeper
audit. Each item verified in source before changing; client typecheck passes.

## Status
- **Migrations: APPLIED to production** (project `ywcwaumozoejierlfkgj`) via the
  Management API and recorded in `supabase_migrations.schema_migrations`. Verified
  live: C1 lock guard present, user-uploads `file_size_limit=100MB`, storage
  funcs + RESTRICTIVE `storage_quota_ceiling` policy + both cron jobs scheduled,
  `get_org_credit_state` service-role bypass, `check_abuse_block` + service_role
  grant on `has_active_subscription`. `db push` was deliberately NOT used (an
  un-deployed finance/org backlog + duplicate `20260703000000` versions would
  ride along).
- **Edge function code: committed, NOT yet deployed.** M2/H3/M3/M1 runtime
  behavior activates only after `supabase functions deploy` of editor-generate-clip,
  check-video-status, api-keys-manage, free-tier-generate (+ the shared
  abuse-guard). The C1/H4/H1 DB fixes are already live without a deploy.

## Fixed

| # | Fix | Change |
|---|-----|--------|
| **C1** | `account_type` no longer self-assignable | `consume_onboarding_intent` rejects changing account_type after onboarding (`account_type_locked`) and requires a non-free email domain to grant `business` (`business_email_required`). New `is_free_email_domain()` helper. |
| **H4** | `user-uploads` had no size cap | Bucket now `file_size_limit = 100MB` + image/video/audio mime allow-list. |
| **H1** | Storage gate was toothless | Plan-aware per-user **ceiling** enforced server-side via a RESTRICTIVE RLS gate on `storage.objects` INSERT (`storage_under_ceiling`), `storage_quota_status()` for pre-check, client pre-check in `useFileUpload`, and **pg_cron** schedules for `compute_storage_usage` (daily) + `bill_storage` (monthly). Policy = block-new / keep-data. |
| **M2** | Credit gate read a drifting cache | `editor-generate-clip` affordability gate now reads authoritative ledger state (`get_credit_state` / `get_org_credit_state`, both balance−holds) instead of `profiles`/`organizations.credits_balance`. `get_org_credit_state` gained a service-role bypass. |
| **H3** | API keys mintable without a sub | `api-keys-manage` `create` now requires `has_active_subscription` (granted to service_role). |
| **M3** | `abuse_rules` never enforced | New `check_abuse_block()` RPC + shared `abuse-guard.ts`; wired into `api-keys-manage` and `free-tier-generate`. |

## Verified — no change needed

- **M5 (org-pool atomicity):** `deduct_credits` already locks the org row
  (`SELECT … credits_balance … FOR UPDATE`) and the profile row before
  check+update — concurrent debits serialize, no negative-balance race. The
  audit's M5 was a misread.

## M1 (async refund) — IMPLEMENTED

Editor clips now refund the upfront deduct when a prediction fails/cancels
*asynchronously*. `editor-generate-clip` stashes the deduct's idempotency key +
project on its `api_cost_logs` row; `check-video-status` refunds 1:1 on FAILED.
Safe because:
- Only editor clips write that `api_cost_logs` row → hold-based pipelines
  (hollywood/seedance) can't be touched, so no double-credit.
- `refund_credits` dedups on `transaction_type='refund'` + key (no collision
  with the `'usage'` deduct), plus a `refunded` flag on the row → idempotent
  across repeated polls.
Matches the existing synchronous refund's personal-ledger semantics. (When the
org-pool backlog deploys, both sync and async refunds will need an org-aware
refund — tracked with that backlog.)

## H2 (server-side account-type) — VERIFIED ALREADY CLOSED (no code needed)

`account_type` cannot be escalated server-side:
- Direct `UPDATE profiles SET account_type` is blocked by the `profiles` UPDATE
  RLS `with_check` (`NOT (account_type IS DISTINCT FROM …)`) plus the
  `prevent_profile_privilege_escalation_trg` / `trg_profiles_block_sensitive_self_update`
  triggers.
- The onboarding-intent path is now locked by **C1**.
- Org operations are gated by membership RLS (`fn_org_has_min_role`).
So the client-side business-route gating is backed by un-escalatable data — there
is no server-side hole left. (Per-endpoint `has_account_type()` checks remain an
optional defense-in-depth follow-up.)

## Decision to confirm

H3 uses the canonical `has_active_subscription`, which grants `past_due` /
`canceled` users a grace window **until `current_period_end`** rather than an
immediate cutoff. If you want a hard cutoff the moment status flips, tighten that
helper (it's shared, so it affects every consumer).
