# Migration backlog audit (read-only)

Audit of migrations present in `supabase/migrations/` but not deployed to prod
(`ywcwaumozoejierlfkgj`). Investigation only. See `FINANCE_DEPLOY_PLAN.md` for the
full finance diff + deploy plan.

## 1. Duplicate-version collision — RESOLVED (PR #64)

Three files shared version `20260703000000`:

| File | Primary object | On prod? |
|------|----------------|----------|
| `…_profiles_email_containment.sql` | `get_my_profile()`, email column REVOKE, org/admin readers | ✅ present |
| `…_share_views_and_notif_replica.sql` | `increment_share_view_count()`, notifications `REPLICA IDENTITY FULL` | ✅ present |
| `…_admin_moderate_comments.sql` | policy `"Admins can delete any comment"` on `project_comments` | ✅ present |

**All three effects are already live on prod.** (An earlier draft flagged the
admin policy as missing — that was a false alarm from probing the wrong table,
`comments` vs `project_comments`.) The collision was purely a *history-recording*
problem: the migration history holds one row per version, so two files stayed
"pending" and `db push` couldn't reconcile.

**Fix (PR #64):** renamed to `…000000` / `…000001` / `…000002`, reconciled
`schema_migrations` (all three now recorded 1:1). All idempotent → future
`db push` is a no-op. No schema/data change needed. **This unblocks `db push`.**

## 2. Un-deployed finance remediation set (`20260704000000`–`001400`)

A prior "AUDIT FIX" credit/finance remediation that never reached prod, including
a **live Critical bug**: prod's `credit_ledger_total()` still reads the 2026-06-20
double-entry ledger that runtime never writes to, so spendable balances are frozen
(8 users / 1,055 credits in the archive; backfill not done). Full per-migration
diff, current-state evidence, staging procedure, balance-verification queries,
webhook dependencies, and rollback are in **`FINANCE_DEPLOY_PLAN.md`**.

Also pending (non-finance, lower risk): `20260703010000`–`030000` (email-table
grant, profile self-definer, continuity score).

## Recommendation
1. Merge **PR #64** (collision) — done/open.
2. Dedicated finance PR per `FINANCE_DEPLOY_PLAN.md`: snapshot → apply on a clone →
   verify balances (esp. `backfill_opening_balances`) → human sign-off → promote +
   webhook wiring. Do **not** `db push` to prod until both are complete.
