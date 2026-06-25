# Gatekeeper hardening — fixes

Branch `fix/gatekeeper-hardening` off `main`. Closes the gaps from the gatekeeper
audit. Each item was verified in source before changing. Client typecheck passes
(`tsc --noEmit`, 0 errors). **Migrations are NOT yet applied** — apply the new
`supabase/migrations/2026070400{20,21,22,23,24}*` in order.

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

## Deferred (needs its own careful PR — do NOT hotfix)

- **M1 (async refund):** confirmed real — when an editor clip prediction fails
  *asynchronously*, `check-video-status` marks the clip failed but does **not**
  refund the upfront `deduct_credits` (the synchronous start-failure path does
  refund). A naive refund in the shared status poller risks **double-crediting**
  the hold-based pipelines that flow through the same code. Correct fix: migrate
  `editor-generate-clip` to the reserve→consume **hold pattern** (like
  hollywood/seedance) so failures auto-release via the existing reconcile cron.
- **H2 (server-side account-type on every business endpoint):** largely mitigated
  by C1 (escalation closed) + existing org-membership RLS (`fn_org_has_min_role`)
  on org operations. Remaining: business *route* gating is still client-side.
  Per-endpoint `has_account_type()` checks are a follow-up.

## Decision to confirm

H3 uses the canonical `has_active_subscription`, which grants `past_due` /
`canceled` users a grace window **until `current_period_end`** rather than an
immediate cutoff. If you want a hard cutoff the moment status flips, tighten that
helper (it's shared, so it affects every consumer).
