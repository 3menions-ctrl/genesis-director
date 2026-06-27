# STATUS — Genesis Director / "Small Bridges": Three-Surface Audit Rollup

> Read-only deep audit, 2026-06-26. Branch `full-audit` (== `main`) for web/admin/backend; `ios-app` for iOS. Method: **12 parallel end-to-end traces over two passes** + local build/test + an independent verification & reconciliation pass. Detail in `00`–`08`; **consolidated verified findings + fix plan in `09-CONSOLIDATED-FINDINGS.md`**; raw traces in `audit/raw/`.

> ⚠️ **Pass-2 update:** a second wave (social/monetization, distribution/public-API, business/email, full RLS sweep, verification) found serious issues pass 1 missed — **19 IDOR edge fns, tip/patron double-charge, self-serve free plan upgrades, email-never-delivers, a public-bucket media leak** — and **corrected an over-optimistic pass-1 admin verdict**. It also caught a *subagent* overstatement: the RLS agent's "CRITICAL anon-unauth `seamless-stitcher`" was **wrong on verification** (`verify_jwt=true`); it's a HIGH authenticated IDOR. Read `09` for the authoritative, verified list.

## Per-surface scorecard (updated after pass 2)

| Surface | DONE | PARTIAL | BROKEN | MISSING | Ship verdict |
|---|---:|---:|---:|---:|---|
| **iOS** (`ios-app`) | ~11 | ~4 | ~1 | — | **NOT shippable** — code-complete shell but **runtime-unverified** (no Xcode), push + Live blocked on unapplied migrations. Spend-only payments solid. |
| **Web** (consumer + business) | ~50 | ~40 | ~25 | ~10 | **NOT shippable as-is** — pass 2 found tip/patron double-charge, free plan upgrades, email-never-delivers, **19 authenticated IDOR fns**, a public-bucket media leak. Highest ship risk by far. |
| **Admin** | ~56 pp + 6 actions | 4 | **2** | 0 | **Less-clean than pass 1 said** — authz IS server-enforced & most pages real, but **Refunds returns no real money + Coupons never reach the provider** (both HIGH). |

> "DONE" = traced end-to-end and wired (for iOS, code-path only — nothing was run). Web counts now span both passes (social, distribution, business/email added). Counts are per-feature/per-page, not per-line.

## Corrections (honesty — including to a subagent's own claim)
1. **Admin "0 BROKEN" was overstated** — Refunds (no real money) + Coupons (never reach provider) are HIGH-broken.
2. **"Tip idempotency fixed" (memory) is misleading** — fixed on the *orphaned* `tip_reel`; the *wired* `tip_in_thread` is unprotected (double-charge).
3. **The RLS agent's "CRITICAL anon-unauth `seamless-stitcher`" was itself wrong** — `verify_jwt=true` (verified); it's a HIGH *authenticated* IDOR, folded into the IDOR batch. Pass-1's "no privileged-unauth fns" was NOT overturned.

## Health (this host)
Typecheck ✅ · Web build ✅ · Admin build ✅ · Tests **15 failed / 3576 passed** (all 15 are stale dead-code file-existence assertions, not product bugs) · iOS not buildable here. (`06-HEALTH.md`)

## Biggest surprises (where reality ≠ the documented/assumed state)
1. **Stripe billing is NOT locked on this branch.** `src/lib/stripe-lock.ts` doesn't exist; Stripe checkout fns are wired and the Pricing page routes through them; the Stripe webhook (`"sandbox"` mode) never funds the org credit pool. Memory's "Stripe billing locked (PR #110)" is false here. **Verified directly.** (`04-CROSS §4.3`)
2. **The render reapers are off.** The stuck-render watchdog is both kill-switched and unscheduled; zombie-cleanup + stuck-jobs watchdog have no in-repo cron. Combined with cancel-only-on-user-action, failed renders leak billable Replicate predictions indefinitely. (Confirm out-of-band cron — top open question.)
3. **The Python `breakout_pipeline` is orphaned** — it implies a VFX/assembly capability that isn't wired to anything live (proven, not guessed). All real pixel work is Replicate-hosted FFmpeg.
4. **The editor's primary output button does nothing** — "Approve & Render" dead-ends because `installJobRunner()` is never called; CTAs are gated to a "coming soon" stub.
5. **Admin is the healthiest surface by a wide margin** — the opposite of the usual "admin is a pile of stubs"; authz is genuinely server-enforced and every page hits real data.

## Top 10 things left, ranked (the ship list — re-ranked after pass 2)

1. **🟠 Close the 19 authenticated IDOR edge fns** — incl. `seamless-stitcher` (spends project-owner credits + overwrites their video) and `continue-production`. Apply the in-repo `generate-music:727` ownership pattern uniformly. *(09 P0-A/B/F)*
2. **🔴 Stop tip/patron double-charge** *(moved up — money)* — `tip_in_thread` + `pledge_patron` have no idempotency/row-lock; repoint to hardened `tip_reel` or add lock+idempotency key. *(09 P0-D)*
3. **🔴 Fix `zombie-cleanup` double-refund** (2× credits) — remove the duplicate grant, make org-aware + idempotent (blocks safely scheduling the reaper). *(09 P0-E)*
4. **🟠 Lock down money-writable RLS** — `organizations.plan` client-writable (free plan upgrades) + `patron_subscriptions` self-insert (free perks) + `notifications` forge. *(09 P0-H)*
5. **🟠 Privatize gated buckets** (`videos`/`final-videos`/`video-clips`/`scene-images` are `public=true`) + fix `log-widget-event` credit-drain DoS. *(09 P0-C/G)*
6. **Restore Stripe kill-switch + route checkout to Polar** (your call: Polar live). *(09 P0-I)*
7. **Reliability crons** — email queue never drains + render reapers off (both un-committed). Commit schedules, but only AFTER #3 + #4 so latent money bugs don't activate. *(09 P1)*
8. **Web feature breakage** — editor Approve&Render dead, clip-lost-on-import, ungated OpenAI fns, motion-transfer/stylize no-refund, creator-withdraw missing. *(09 P1)*
9. **iOS push + Live** — unapplied migrations + no APNs/SFU; gate off or finish backend. Plus debt: types.ts regen / 249 `as never`. *(09 P1/P2)*

> The two non-code confirmations from pass 1 still stand: **which billing provider is live** (answered: Polar) and **what crons actually run in the Supabase dashboard** (render reapers + email queue + patron renewals).

## One-paragraph bottom line
Genesis Director is a large, genuinely-built product whose **admin surface is near-ship**, whose **web surface works on the happy path but is dangerous on failure paths** (money leaks, silent data loss, a dead render button, and an unresolved/contradictory billing setup), and whose **iOS surface is a code-complete but entirely runtime-unverified consumption shell** gated behind unapplied backend migrations. Nothing here is fake-but-pretty in the admin; the web video subsystem is the opposite — impressive happy-path engineering undermined by missing failure-path handling. The single most urgent action is non-code: **confirm whether the render reapers and the live billing provider are what you think they are**, because two of the highest-severity findings (cost leak, unfunded org pool) hinge on production wiring that this branch's source contradicts.
