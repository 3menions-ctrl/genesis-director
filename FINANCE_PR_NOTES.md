# Finance set — deploy-prep PR notes

This PR prepares the un-deployed finance remediation set (`20260704000000`–`001400`)
for a gated, staging-verified deploy. **It applies nothing to prod.** See
`FINANCE_DEPLOY_PLAN.md` for the full per-migration diff, current-state evidence,
staging procedure, balance-verification SQL, and rollback.

## What this PR changes (code only)

1. **`20260704000800_get_org_credit_state.sql` — reconciled** with the deployed
   gatekeeper fix (`20260704002300`, already live on prod). The org credit-state
   reader now allows `service_role` callers (membership-gated for end users), so a
   future `db push` of the backlog **won't clobber** the live M2 fix that
   `editor-generate-clip` depends on. Body is identical to what's deployed → no-op
   on apply.

2. **`20260704001500_refund_credits_org_aware.sql` — new.** Makes `refund_credits`
   route org-project refunds to the ORG pool (mirrors `deduct_credits`'s org path
   from `000700`). Without this, an org project's refund (incl. the editor sync +
   async failure refunds shipped in PR #63) would return credits to the personal
   ledger while the debit came from the org pool. Idempotent on
   `(project_id, idempotency_key, 'refund')`. **Money-path — verify on a clone.**

## Already in place (no change needed)

- **`order.refunded` → `reverse_credit_purchase`** webhook wiring already exists in
  `polar-webhook` (so `001400`'s RPC fires once deployed).

## Still required before/at deploy (tracked, NOT in this PR)

- **Org initial funding on purchase.** `polar-webhook`'s `grantCredits` always calls
  `add_credits` (personal wallet), even for org orders (`metadata.org_id` present).
  Org purchases should fund the org pool — but `topup_org_credits` is **not
  idempotent** (unconditional `+= amount`), so wiring it naively would double-fund
  on Polar retries. Needs an idempotent org top-up (e.g. an `add_org_credits` keyed
  on the order ref, mirroring `add_credits`) — designed + tested before deploy.
- **Staging verification + human balance sign-off** per `FINANCE_DEPLOY_PLAN.md`
  (snapshot → apply on a clone → verify balances, esp. `backfill_opening_balances`
  → promote). The repoint bug means prod balances are currently frozen — the revert
  + backfill is the fix, but `backfill_opening_balances` mutates live balances.

## Apply order note
`refund_credits` is defined personal-only earlier and org-aware here (`001500`,
after `000700`). Final state = org-aware. `get_org_credit_state` is defined in
`000800` (now service-role capable) and was already applied via `002300`; both
bodies match, so order is irrelevant.
