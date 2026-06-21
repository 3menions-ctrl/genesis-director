# Financial Architecture — "More than QuickBooks" (research + plan)

_Goal: an owned, accounting-grade financial system — immutable double-entry ledger, real-time P&L + projections, gates/controls, and storage-cost billing tied to credits — built to be **extremely profitable**. Research-grounded; nothing destructive runs until confirmed._

## TL;DR recommendation — build an EMBEDDED double-entry ledger, NOT a QuickBooks API integration

QuickBooks' API is now **metered and paid** (Intuit's App Partner Program: $0–$4,500/mo, CorePlus "data-out" calls metered with caps/overages) — costs that **scale inversely with your success**. The 2026 trend is migrating *off* the QB API onto an **embedded ledger you own**. ([QB API 2026 pricing](https://truto.one/blog/how-much-does-the-quickbooks-api-cost-2026-pricing-rate-limits/), [migrate-off-QB roadmap](https://www.openledger.com/openledger-hq/quickbooks-api-fees-cto-migration-roadmap-embedded-ledger-open-ledger))

So "more than QuickBooks" = **our own immutable double-entry ledger in Postgres** + real-time financial reporting, with **zero per-call fees, full control, data in our DB**, and an *optional* periodic export to QB/Xero for the accountant. This matches the "own everything" pattern we've used for analytics.

## 1. Ledger design (the core)
Best-practice double-entry on Postgres ([pgrs.net](https://www.pgrs.net/2025/06/17/double-entry-ledgers-missing-primitive-in-modern-software/), [Square "Books"](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/)):
- **Append-only & immutable** — journal entries are never edited or deleted; corrections are *reversing* entries. Full audit trail.
- **Every transaction sums to zero** across its lines (debits = credits) — enforced by a trigger.
- **Balances are DERIVED from entries, not stored** — kills the drift problem (today `profiles.credits_balance` is a denormalized stored balance that *can* drift from `credit_transactions`).

Tables:
- `ledger_accounts` — chart of accounts (assets, liabilities, equity, revenue, COGS, expense). e.g. `cash`, `stripe_clearing`, `deferred_revenue_credits` (liability), `revenue_credit_usage`, `cogs_api`, `cogs_storage`, `creator_payouts_liability`.
- `ledger_entries` — one row per posting: `txn_id`, `account`, `direction` (debit/credit), `amount_usd` (and `amount_credits` for credit-denominated lines), `occurred_at`, `ref_type`/`ref_id`, `memo`. Immutable.
- `ledger_txns` — header grouping entries (must net to zero), `kind`, `metadata`.
- A per-user **credit subledger** (credits are a unit, not USD) reconciled to `deferred_revenue_credits`.

## 2. Credits ↔ money (the accounting model)
Credits are **deferred revenue (a liability)** until consumed — standard for prepaid usage:
- **Buy credits** (Stripe): Dr `stripe_clearing` (asset) / Cr `deferred_revenue_credits` (liability). Cash in, revenue NOT yet earned.
- **Spend credits on a render**: Dr `deferred_revenue_credits` / Cr `revenue_credit_usage` (revenue recognized) — *and* Dr `cogs_api` / Cr `api_provider_payable` for the real provider cost. Gross margin = recognized revenue − COGS, per generation.
- **Storage billing** (see §4): Dr `deferred_revenue_credits` / Cr `revenue_storage`; Dr `cogs_storage` / Cr `storage_payable`.
- **Refund**: reversing entries. **Creator payout**: Dr `creator_payouts_liability` / Cr `cash`.
Balance = derived. `profiles.credits_balance` becomes a *cached projection* of the subledger (rebuildable), never the source of truth.

## 3. P&L, projections & profitability
Derived in real time from the ledger:
- **P&L**: recognized revenue (credit usage + storage + subscriptions) − COGS (API `real_cost_cents` + storage) − opex → gross & net margin. (We already have a P&L view reading `api_cost_logs`; this upgrades it to ledger-backed, GAAP-style with deferred-revenue recognition.)
- **Balance sheet**: cash, deferred-revenue liability (unspent credits), payouts liability.
- **Projections**: MRR/ARR, credit burn rate, deferred-revenue runway, cohort LTV, **contribution margin per user**, and a growth model (signups × conversion × ARPU − COGS) with scenario sliders.
- **Profitability levers (to be "extremely profitable"):** (a) credit **sell price vs blended COGS** markup (target gross margin %, e.g. 70–85%); (b) **storage pass-through** so storage never erodes margin (§4); (c) free-tier caps; (d) engine routing to cheaper models under margin pressure (gate, §5).

## 4. Storage billing tied to credits (the new revenue line)
Pattern: **meter per-user storage, charge per GB-month in credits**, with a free tier ([usage-based storage billing](https://ordwaylabs.com/resources/guides/usage-based-pricing-guide/), [consumption billing](https://www.maxio.com/blog/consumption-based-billing)).
- **Measure**: sum bytes per user across their Supabase Storage objects + DB media rows (a `storage_usage_daily` snapshot table, refreshed by a cron edge function).
- **Price**: e.g. **N free GB**, then **X credits / GB / month** (X set so it covers Supabase storage cost ~$0.021/GB-mo **plus markup** → profit, not just pass-through). Tunable in `system_config`.
- **Charge**: monthly job posts a ledger txn (storage revenue + COGS) and debits the user's credits; if balance insufficient → dunning/grace + gate (read-only or block new renders).
- **Surface**: shown on the user's profile pop-up, the P&L (storage as its own revenue + COGS line), and a "Storage" admin view.

## 5. Gates & controls (financial safety)
- **Balance gate** — no render/storage charge can drive a balance negative (atomic check in the spend RPC).
- **Margin gate** — if blended margin on an engine drops below threshold, throttle/route to a cheaper engine or block (config-driven).
- **Grant limits** — admin credit grants above a threshold require a reason + are audit-logged (already audited; add cap).
- **Refund controls** — refunds post reversing entries only; capped; audited.
- **Reconciliation** — scheduled check: ledger cash vs Stripe payouts; subledger credits vs `profiles.credits_balance`; flag drift.
- **Immutable audit** — every financial mutation is an append-only ledger row + `admin_audit_log`.

## 6. The "clear existing finances" migration (DESTRUCTIVE — needs sign-off)
Current data: `credit_transactions` (12), `profiles` balance columns, `patron_subscriptions` (1). `credit_packages` (7) = **pricing config, keep**.
Plan (reversible — snapshot first):
1. **Back up** the affected tables to `*_archive` tables (so nothing is truly lost).
2. **Truncate** `credit_transactions`; zero `profiles.credits_balance / total_credits_purchased / total_credits_used`.
3. **Seed opening balances** as proper ledger txns (e.g., re-grant welcome bonuses) so balances are reconstructed *through the new ledger*, not orphaned.
4. New writes go through the ledger posting RPC from then on.

## 7. Build phases (after sign-off)
- **P0** Ledger schema + posting RPC + balance-derivation + reconciliation. Migrate credit purchase/spend to post ledger entries.
- **P1** Storage metering (snapshot table + cron) + storage→credits billing job.
- **P2** Ledger-backed P&L + balance sheet + projections admin pages (upgrade current P&L).
- **P3** Gates (balance/margin/grant/refund) + reconciliation dashboard.
- **P4** Optional QB/Xero CSV/API export for the accountant.

_Open decisions for you are in the prompt below; nothing is cleared or built until you confirm._
