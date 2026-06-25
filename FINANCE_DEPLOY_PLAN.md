# Finance migration set — diff & deploy plan (`20260704000000`–`001400`)

Read-only analysis. **Nothing here has been applied to prod**, no live data touched,
no Polar/Stripe calls made. Prerequisite: the `20260703000000` collision fix
(PR #64) must merge first so `db push` is unblocked.

---

## 0. Current prod state (verified, read-only)

- **Prod credit balances are BROKEN right now.** Deployed `credit_ledger_total()` =
  `SELECT ledger_user_credit_balance(...)` (the 2026-06-20 repoint). Runtime money
  mutations (`add_credits`/`deduct_credits`/`consume_credit_hold`/`refund_credits`)
  write to `credit_transactions`, which the balance function no longer reads — so
  `get_credit_state()` returns the frozen seed snapshot: purchases grant nothing
  spendable, usage doesn't decrement.
- **Blast radius is small:** `profiles_credit_archive` has **8 users with positive
  balances totalling 1,055 credits**; `credit_transactions` holds only 6 rows;
  `opening_balance` backfill not yet done (0 rows). This looks like an early-stage
  prod — low risk, but it IS a live correctness bug.

## 1. Root cause (the C-1 chain)

1. `20260620212254_finance_clear_and_seed` **TRUNCATEd** `credit_transactions` and
   seeded opening balances **only** into `ledger_entries` (double-entry ledger).
2. `20260620214321_repoint_credit_ledger_total` pointed `credit_ledger_total()` at
   `ledger_user_credit_balance()` (the double-entry ledger).
3. Nothing at runtime posts to `ledger_entries` → balances froze. **(both #1 and #2
   are LIVE on prod.)**

The fix is `20260704000000` (revert the function to read `credit_transactions`) +
`20260704000900` (re-insert opening balances into `credit_transactions`).

---

## 2. Per-migration diff (apply IN ORDER)

| # | Migration | What changes | Data mutation | Risk |
|---|-----------|--------------|---------------|------|
| 1 | `000000_revert_credit_ledger_repoint` | `credit_ledger_total()` → reads `credit_transactions` again (verbatim pre-repoint body) | No (DDL) | **Critical fix**, money read path |
| 2 | `000100_fix_monthly_org_credit_refill_ref` | `monthly_org_credit_refill()` passes a valid `stripe_payment_id` ref instead of NULL | Yes (INSERT `org_credit_refills`, `add_credits`) — only when run | Money; superseded by #11 |
| 3 | `000200_org_member_role_update_guard` | RLS policy on `organization_members` UPDATE gains USING+WITH CHECK (no self-escalation to owner) | No | Authz (H-1) |
| 4 | `000300_payout_id_nullable_for_claim` | `creator_payouts.stripe_payout_id` DROP NOT NULL (atomic claim) | No (schema) | Payout pipeline |
| 5 | `000400_profit_dashboard_rate_and_divzero` | `get_admin_profit_dashboard()` rate 11.6¢→10¢, div-by-zero guard | No (read fn) | Admin KPI only |
| 6 | `000500_fix_admin_bulk_suspend_column` | `admin_bulk_suspend/restore` column `suspended_reason`→`suspension_reason` | Yes (UPDATEs `profiles` only when called) | Admin action; was broken |
| 7 | `000600_org_scoped_credit_transactions` | ADD `credit_transactions.organization_id` + index + BEFORE-INSERT trigger `set_credit_tx_org` + **backfill UPDATE** + `org_credit_transactions()` RPC | **Yes — backfills `organization_id` on existing rows** | Prereq for org pool |
| 8 | `000700_org_pool_consumption` | Rewrites `credit_ledger_total` (excl. org rows), `active_credit_holds_total`, `reserve_credits`, `consume_credit_hold`, `deduct_credits` with org/personal dual paths | Yes (org debits) when called | **Critical money-flow change**; needs #6 |
| 9 | `000800_get_org_credit_state` | New `get_org_credit_state()` RPC (membership-gated). NOTE: gatekeeper PR #63 already ships a service-role-capable version of this — **reconcile/skip to avoid clobber** | No (read fn) | Low; coordinate w/ PR #63 |
| 10 | `000900_backfill_opening_balances` | Re-inserts each archived opening balance as one `opening_balance` `credit_transactions` row; resyncs `profiles.credits_balance` cache | **YES — MUTATES LIVE BALANCES** | **Highest-risk step** |
| 11 | `001000_org_refill_funds_pool` | `monthly_org_credit_refill()` funds the ORG pool via `topup_org_credits()` (fixes regression from #8) | Yes when run | Critical; supersedes #2 |
| 12 | `001100_finance_authz_hardening` | BEFORE-UPDATE trigger blocks client edits to `organizations.credits_balance/total_*`; REVOKE `ledger_user_credit_balance` from authenticated; ownership check on `creator_pending_payout_cents()` | No | **Critical authz** |
| 13 | `001200_schedule_credit_hold_reconcile` | pg_cron: `reconcile-credit-holds` + `expire-credit-holds` every 5 min | Indirect (cron mutates holds) | Heals stuck holds |
| 14 | `001300_raise_credit_grant_cap` | `add_credits()` single-grant cap 100k→1M (large plans no longer silently dropped) | Yes when called | Money cap |
| 15 | `001400_refund_reversal_rpc` | New service-role `reverse_credit_purchase()` (negative `refund_reversal` txn, idempotent on provider ref) | Yes when called | Refund/chargeback path |

**Final-state note:** `credit_ledger_total` is redefined twice (#1 then #8). The #8
version (reads `credit_transactions`, excludes org-tagged rows) is the intended
final definition; #1 is needed first so intermediate steps are consistent. The
`opening_balance` rows from #10 carry no `organization_id`, so #8's exclusion still
counts them.

**Data-mutating migrations to watch:** #6 (backfill org_id), #10 (backfill balances).
Everything else is DDL or only mutates when its function is later called.

All 15 are idempotent (CREATE OR REPLACE / IF NOT EXISTS / ON CONFLICT / NOT EXISTS
guards), so re-runs are safe.

---

## 3. Code/webhook dependencies (must ship alongside, NOT in this DB set)

- **`001000`** needs subscription purchase webhooks to call `topup_org_credits()` on
  initial org provisioning (else new orgs start at 0). Wire in `polar-webhook`.
- **`001400`** needs `polar-webhook` `order.refunded` → `reverse_credit_purchase()`
  (Stripe path flagged as follow-up). Without wiring, the RPC exists but never fires.
- **`000900`** is annotated "Do not auto-apply — human must reconcile balances."

---

## 4. Staging verification procedure (do NOT run on prod)

1. **Snapshot prod** (point-in-time): export `credit_transactions`, `credit_holds`,
   `profiles(id,credits_balance)`, `organizations(id,credits_balance,total_*)`,
   `profiles_credit_archive`, `ledger_entries`, `org_credit_refills`. Use
   `pg_dump`/Supabase backup or a PITR restore into a **branch/clone project** — not
   the live DB.
2. **Capture pre-state** on the clone:
   ```sql
   -- authoritative balances BEFORE (currently the broken ledger path)
   create table _pre_bal as
     select id, public.get_credit_state(id)->>'balance' as bal_before from public.profiles;
   ```
3. **Apply `20260704000000`–`001400` in order** on the clone (`supabase db push`
   after PR #64 + this set merge, or run files sequentially).
4. **Balance verification (focus on #10 backfill):**
   ```sql
   -- a) every archived positive user got exactly one opening_balance row = archived amount
   select a.id, a.credits_balance as archived,
          (select t.amount from public.credit_transactions t
            where t.user_id=a.id and t.transaction_type='opening_balance') as opening_row
   from public.profiles_credit_archive a
   where coalesce(a.credits_balance,0) > 0;       -- expect opening_row = archived for all 8

   -- b) new authoritative balance = opening + post-seed activity, and no surprise negatives
   select p.id, _pre_bal.bal_before,
          public.credit_ledger_total(p.id) as bal_after
   from public.profiles p join _pre_bal using (id)
   where public.credit_ledger_total(p.id) < 0;     -- expect 0 rows (except known refund-after-spend)

   -- c) ledger total reconciles to archive sum + tracked deltas
   select coalesce(sum(amount),0) as ledger_sum,
          (select coalesce(sum(credits_balance),0) from public.profiles_credit_archive) as archive_sum
   from public.credit_transactions
   where transaction_type not in ('untracked_increase','audit','security_alert');
   ```
5. **Re-run idempotency check:** apply the set a 2nd time on the clone → #6 backfill
   and #10 insert 0 new rows; balances unchanged.
6. **Functional smoke (clone):** simulate a purchase (`add_credits`), a generate
   (`reserve_credits`→`consume_credit_hold`) for both a personal and an org project,
   a failure (`release_credit_hold`), and a `reverse_credit_purchase` — confirm the
   org path debits `organizations.credits_balance` and personal debits the personal
   ledger. **Stub/avoid real Polar/Stripe calls.**

## 5. Promotion to prod

- Only after staging passes 4–6 and a human signs off on the balance reconciliation.
- Take a fresh prod snapshot immediately before (rollback point).
- Apply in order; re-run §4(a–c) against prod; confirm the 8 archived users show
  correct spendable balances in-app.
- Deploy the webhook code (§3) in the same window.

## 6. Rollback

- DDL/functions: re-apply the prior definitions from git (all `CREATE OR REPLACE`).
- Balance data: the only inserted rows are keyed `stripe_payment_id =
  'opening_balance:<uid>'` and `transaction_type='opening_balance'` →
  reversible by deleting exactly those rows and re-syncing the `profiles` cache.
  Keep the pre-apply snapshot as the source of truth.

---

## 7. Recommended sequencing

1. Merge **PR #64** (collision) — unblocks `db push`.
2. Open a **dedicated finance PR** carrying `20260704000000`–`001400` + the
   `polar-webhook` wiring, and reconcile `000800` against gatekeeper **PR #63**'s
   `get_org_credit_state` (keep the service-role-capable version).
3. Run §4–6 on a clone, human-verify balances, then promote.
4. Do **not** `db push` to prod until both the collision fix and staging verification
   are done.
