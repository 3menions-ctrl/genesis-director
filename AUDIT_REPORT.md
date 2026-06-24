# Genesis Director — Pre-Production Security & Quality Audit

**Date:** 2026-06-24
**Branch audited:** `audit`, fast-forwarded to `main` (`e43c0799`) — working tree verified identical to `main` (empty `git diff main`, clean tree). This is the integrated post-merge app.
**Method:** Full file-tree enumeration → module-by-module read-only investigation (regular-user, business, admin, plus the DB layer, edge functions, payments, and cross-module integration) → independent 3× verification of every Critical/High finding against the actual source/SQL before reporting. No code was modified.
**App stack:** Vite + React + TypeScript SPA, Supabase (Postgres + ~140 Deno edge functions, ~100 migrations), Polar.sh payments (Stripe Connect secondary), Electron admin build.

---

## Build / Typecheck / Test results (run during audit)

| Check | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit -p tsconfig.json` | ✅ **PASS** (exit 0) |
| Production build | `vite build` | ✅ **PASS** (exit 0, `dist/` emitted) |
| Admin build wiring | `vite.config.ts` ADMIN_BUILD → `dist-admin` | ✅ separate output, no collision |
| Unit/integration tests | `vitest run` **with** `VITE_SUPABASE_URL` set | ✅ **PASS** — 107 files, 3547 tests pass, 61 skipped, 0 fail |
| Unit/integration tests | `vitest run` **without** env (bare local) | ⚠️ 9 files / 33 tests fail — **env artifact, not a bug** (see L-17) |

**Important:** `node_modules` was not installed in the working tree on arrival; deps were installed with `bun install` to run the toolchain. The 33 local test failures are caused solely by `src/integrations/supabase/client.ts` calling `createClient(undefined, …)` at module load when `VITE_SUPABASE_URL` is unset. CI sets `VITE_SUPABASE_URL=https://stub.supabase.co` (`.github/workflows/ci.yml:26,62`) and the suite is fully green there. This is a test-harness hermeticity gap (L-17), not a product defect.

---

## Severity summary

| Sev | Count | IDs |
|---|---|---|
| 🔴 Critical | 3 | C-1, C-2, C-3 |
| 🟠 High | 9 | H-1 … H-9 |
| 🟡 Medium | 13 | M-1 … M-13 |
| 🟢 Low | 19 | L-1 … L-19 |

The single most important finding is **C-1 (credit ledger severance)** — it breaks the core monetization invariant and was independently surfaced by two separate investigations, then verified firsthand through the migration chain.

---

# 🔴 CRITICAL

## C-1 — Credit ledger is severed: paid purchases grant no spendable credits; usage never decrements balance
**Severity:** Critical (revenue loss + data integrity)
**Locations:**
- Read path repoint: `supabase/migrations/20260620214321_repoint_credit_ledger_total.sql:4-7`
- Read path consumer: `supabase/migrations/20260518175601_3d3bd0b0…sql:92-124` (`get_credit_state`, balance from `credit_ledger_total`, line 117)
- Ledger balance source: `supabase/migrations/20260620212145_ledger_core.sql:76-79` (`ledger_user_credit_balance` = `sum(amount_credits) … WHERE account='deferred_revenue_credits'`)
- Write path (only writers): `add_credits` / `deduct_credits` in `20260518175601…sql:37,88` → **INSERT into `credit_transactions` only**
- One-time seed: `supabase/migrations/20260620212254_finance_clear_and_seed.sql:13-21`

**Evidence / chain (verified 3×):**
1. `get_credit_state(p_user_id)` (the client's authoritative balance RPC, called from `src/contexts/CreditsContext.tsx:54`) computes `balance := credit_ledger_total(p_user_id)`.
2. `credit_ledger_total` was **repointed** on 2026-06-20 from `credit_transactions` to the new double-entry ledger:
   ```sql
   CREATE OR REPLACE FUNCTION public.credit_ledger_total(p_user_id uuid) … AS $$
     SELECT public.ledger_user_credit_balance(p_user_id)::integer;  -- reads ledger_entries
   $$;
   ```
3. `ledger_entries` is **only ever written by `ledger_post`**, and `ledger_post` is called from **exactly three migrations** (`ledger_core`, `finance_clear_and_seed`, `storage_billing`) — `grep -rn "ledger_post|ledger_entries"` across `supabase/functions/` and `src/` returns **zero** runtime writers.
4. Every runtime money mutation — `add_credits` (called by `polar-webhook/index.ts:70`, `stripe-webhook-handler.ts:64,97`), `deduct_credits` (7 edge-function call sites), `consume_credit_hold`, `charge_*`, `refund_credits` — writes **only** to `credit_transactions`. None post to `ledger_entries`. There is **no trigger bridging** the two (the `trg_sync_balance_from_ledger` trigger *reads* `credit_ledger_total` to update the `profiles.credits_balance` cache; it does not write the ledger).
5. The seed (`finance_clear_and_seed.sql:13-21`) posts each user's prior `credits_balance` into `deferred_revenue_credits` **once**, then `TRUNCATE`s `credit_transactions`.

**Confirmed non-revert:** `credit_ledger_total` has no definition after `20260620214321`; `add_credits`/`deduct_credits` have no definition after `20260518175601`. The severed state survives to the final schema (checked every migration dated after the repoint).

**Impact:**
- **Purchases give nothing.** A paid Polar/Stripe credit purchase inserts a `credit_transactions` purchase row (revenue is recorded) but `ledger_entries` is untouched, so `get_credit_state` returns the **frozen 2026-06-20 snapshot** — the customer's spendable balance never increases. **Customers pay and receive no credits.**
- **Usage is free.** Generation deducts via `deduct_credits` → `credit_transactions` only, so spendable balance never drops. Users can generate unlimited content down to the frozen snapshot value with no decrement.
- This is a launch-blocker. Either finish the ledger cutover (make `add_credits`/`deduct_credits`/holds post to `ledger_entries`) **or** revert `credit_ledger_total` to read `credit_transactions`.

---

## C-2 — `send-transactional-email`: anyone with the public anon key can send brand email to arbitrary recipients
**Severity:** Critical (phishing as verified brand domain + cost abuse)
**Location:** `supabase/functions/send-transactional-email/index.ts:30-34, 129`; `supabase/config.toml:121` (`verify_jwt = true`)
**Evidence:** The function relies solely on `verify_jwt = true` and has **no in-code role check** (verified across all 410 lines — the only `service_role` mentions are the comment at line 31 and the client construction at 129). `recipientEmail` and `templateData` are taken from the request body and rendered into the email, sent from `noreply@smallbridges.co` via the service-role Resend integration.
**Why it's real:** `verify_jwt = true` only proves the caller holds *a* valid Supabase JWT — the **public anon key shipped to every browser** qualifies. Contrast `process-email-queue`, which adds an explicit `service_role` claim check. There is no such check here.
**Impact:** Spam/phishing ("password reset", "team invite") as the verified brand domain, Resend cost abuse, and domain-reputation damage. Fix: `requireServiceRole(req)` (helper already exists in `_shared/auth-guard.ts`).

---

## C-3 — `svg-rasterize`: unauthenticated service-role storage write at an attacker-chosen path
**Severity:** Critical (cross-project asset poisoning + RLS bypass)
**Location:** `supabase/functions/svg-rasterize/index.ts:60-96`
**Evidence:** No auth of any kind (full 113-line read). Uses the **service-role** client (RLS bypass) and uploads PNGs to `temp-overlays` at a key fully built from attacker input with `upsert: true`:
```ts
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const key = `${body.namespaceId}/${item.id}.png`;        // attacker-controlled path
await supabase.storage.from("temp-overlays").upload(key, pngBytes, { upsert: true });
```
**Why it's real:** `namespaceId`/`id` come straight from the body; `items[]` is unbounded; `upsert:true` allows overwriting any project's overlay PNG.
**Impact:** An unauthenticated attacker can overwrite other projects' overlay assets (poisoning the stitch/render pipeline so corrupted overlays composite into other users' videos) and flood storage/compute. Fix: `requireServiceRole(req)` or JWT + ownership check on `namespaceId`.

---

# 🟠 HIGH

## H-1 — Org admin can self-promote to **owner** (RLS UPDATE policy doesn't constrain `role`)
**Severity:** High (vertical privilege escalation within a tenant)
**Location:** policy `supabase/migrations/20260502172041_…sql:195-197`; UI `src/pages/business/BusinessTeam.tsx:284`
**Evidence:**
```sql
CREATE POLICY "Admins can update member roles"
ON public.organization_members FOR UPDATE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'admin'));   -- no WITH CHECK
```
**Why it's real:** With `WITH CHECK` omitted, Postgres reuses `USING` as the check on the new row — but that expression only verifies the caller is still an org admin; it does **not** constrain the new `role` value. So an `admin` may UPDATE any member row (including their own) and set `role = 'owner'`. The only role guard, `protect_last_owner`, blocks demoting/removing the *last* owner — it does not block *adding* owners. The UI even exposes this: the role `<Select>` iterates `Object.keys(ROLE_META)` which includes `owner`. No later migration adds a constraint (checked all migrations touching `organization_members`).
**Impact:** An admin seizes ownership, then can transfer/soft-delete the workspace (those RPCs correctly require owner, but the attacker is now an owner). Defeats the role hierarchy. Fix: add a `WITH CHECK` that forbids setting/altering `owner` unless the caller is an owner.

## H-2 — Cross-tenant read of `credits_balance` and other sensitive profile columns by any authenticated user
**Severity:** High (information disclosure)
**Location:** SELECT policy `…profile_richness.sql` `USING (true)` + grant `supabase/migrations/20260703010000_profiles_email_table_grant.sql:46-48`
**Evidence:** The latest profile grant re-grants column-level SELECT on **every column except `email`** to `authenticated` (and `anon`), while the table SELECT policy is `USING (true)`. The migration's own header states: *"credits_balance + other sensitive columns stay granted … closing cross-tenant **credits** is a separate, deferred change."*
**Why it's real:** `email` is correctly closed (routed through owner/admin-gated SECURITY DEFINER RPCs) and `anon` is additionally blocked by a restrictive deny policy, but any **authenticated** user can `select credits_balance, total_credits_purchased, total_credits_used, suspension_reason, notification_settings, preferences …` for any other user via a plain PostgREST query. Matches the known `profiles-cross-tenant-leak` item.
**Impact:** Any logged-in user enumerates other users' credit balances, purchase/usage totals, and moderation status.

## H-3 — `send-push-notification`: unauthenticated push to any user's devices
**Severity:** High (spoofed push phishing)
**Location:** `supabase/functions/send-push-notification/index.ts` (whole file — **no** `validateAuth`/`requireServiceRole`/`getUser`; not in `config.toml`, so `verify_jwt` defaults true → reachable with the public anon key)
**Evidence:** `userId`, `title`, `body`, `url` all taken from the body; a service-role client reads `push_subscriptions` for the body-supplied `userId` and pushes. Verified no auth references in the file.
**Impact:** Attacker sends brand-spoofed push notifications with an attacker deep-link `url` to any user's registered devices. Fix: `requireServiceRole(req)`.

## H-4 — Stripe Connect payout: double-payout race (no row lock, no Stripe idempotency key)
**Severity:** High (unrecoverable money loss)
**Location:** `supabase/functions/stripe-connect-payout/index.ts:50-111`; ledger `supabase/migrations/20260612020000_stripe_connect_payouts.sql`
**Evidence:** A comment claims a "SELECT FOR UPDATE-equivalent," but `supabase-js .select()` takes **no lock**. There is no transaction/`FOR UPDATE`/advisory lock, and `stripe.transfers.create({amount: amountCents, …})` is called **without an idempotency key**. `payout_id` is stamped onto the ledger rows only *after* the transfer.
**Why it's real:** Two concurrent invocations (double-click/retry/parallel tabs) both read the same `payout_id IS NULL` rows, both compute the same total, both create separate Stripe Transfers before either stamps `payout_id`; nothing uniquely constrains `creator_payouts`.
**Impact:** A creator can be paid twice (or N times) for the same pending earnings. Fix: `FOR UPDATE` lock (or advisory lock) inside a transaction + a deterministic Stripe `idempotencyKey`.

## H-5 — Monthly org credit refill is broken — passes `NULL` into a reference-required `add_credits`, raising every run
**Severity:** High (org subscribers never get their monthly credits)
**Location:** `monthly_org_credit_refill` in `supabase/migrations/20260503044426_…sql` vs current `add_credits` in `20260518175601_…sql`
**Evidence:** The refill loop calls `public.add_credits(r.owner_id, r.included_credits_monthly, format('Monthly … '), NULL)`. The current `add_credits(p_user_id, p_amount, p_description, p_stripe_payment_id)` guards: `IF p_stripe_payment_id IS NULL OR length(...) < 5 THEN RAISE EXCEPTION 'Invalid Stripe payment reference'`. The positional call was written against an **older** arg order.
**Why it's real:** The `RAISE EXCEPTION` aborts the whole `FOR…LOOP` RPC; `monthly-credit-refill/index.ts` returns 500 and no org is refilled. (Note: even if it ran, C-1 means the credits wouldn't be spendable.)
**Impact:** Paying organizations never receive their monthly included-credit allowance. Silent revenue/trust failure.

## H-6 — Org credit analytics show only the **viewing user's** transactions, presented as workspace-wide pooled spend
**Severity:** High (wrong financial data shown as authoritative)
**Location:** `src/pages/business/BusinessCredits.tsx:106-143`, `BusinessBilling.tsx:106-130`, `BusinessOverview.tsx:97-119`; RLS `supabase/migrations/20260118000219_…sql:47-50`
**Evidence:** All three pages do `from("credit_transactions").select(...).in("user_id", [all member ids])`, but `credit_transactions` RLS is strictly `USING (user_id = auth.uid())` and the table has **no `organization_id` column**. RLS silently narrows the `.in(...)` to just the viewer's rows.
**Why it's real:** Every derived metric (burn chart, runway, "Top spending productions", "Top members by credits", monthly spend, donut) is built from the viewer's own rows only. The page headers claim "REAL org-scoped … pooled credit ledger." In a single-active-user org it looks fine, masking the bug; multi-member orgs undercount and rank all-but-viewer at 0. The hero "Pool balance" (from `organizations.credits_balance`) *is* correct, making the contradiction worse.
**Impact:** Owners/admins make budget/billing decisions off materially under-reported figures shown as org-wide truth. Fix: org-scoped SECURITY DEFINER RPC, or add `organization_id` to `credit_transactions` + an org-member SELECT policy.

## H-7 — `create-org-checkout` (Stripe path): binds a paid subscription to a body-supplied org with **no membership check**, and a metadata-key mismatch breaks org linkage
**Severity:** High (org IDOR + dormant-path provisioning bug)
**Location:** `supabase/functions/create-org-checkout/index.ts:43,66,91-100`; webhook `_shared/stripe-webhook-handler.ts:154`
**Evidence:** `organizationId` is read from the body (not even UUID-validated) and used directly in checkout/subscription metadata, with **no** `fn_org_has_min_role`/`has_org_permission` check — unlike `polar-checkout` (its lines 94-99) which guards this exact path. Separately, the function writes metadata key `organizationId` but the webhook reads `organization_id`/`org_id`, so the subscription's `organization_id` is stored `null` (breaking `monthly_org_credit_refill` and `sync-org-seats`, which key off it).
**Why it's real:** Confirmed the Polar sibling has the guard and this one doesn't; confirmed the key names differ. The Stripe org path is currently dormant (Polar is the active provider, and the generic `stripeProvider` wiring is itself mismatched), so this is latent — but it's a real IDOR + provisioning break if enabled.
**Impact:** Authenticated non-member attaches billing to an arbitrary org; org subscriptions don't provision. Fix before enabling the Stripe org path.

## H-8 — Destructive seed migration wiped production financial history that admin analytics still read
**Severity:** High (data loss + deflated analytics)
**Location:** `supabase/migrations/20260620212254_finance_clear_and_seed.sql:23-26`
**Evidence:** Runs unconditionally in timestamp order: `TRUNCATE public.credit_transactions; DELETE FROM public.patron_subscriptions; UPDATE public.profiles SET total_credits_purchased = 0, total_credits_used = 0;`. Header says "DESTRUCTIVE (confirmed)." Archives to `*_archive` tables, but **no RPC/page reads the archives**.
**Why it's real:** `credit_transactions` is still written going forward, so this was a one-time wipe of all pre-2026-06-20 history. Every lifetime/long-window read now under-reports: `analytics_user_summary`, `analytics_lifecycle_funnel` "Paid" (365-day), `admin-analytics` revenue/spend series, `get_admin_profit_dashboard`, `AdminCreditsPage`. `profiles.total_credits_purchased/used` read 0 for everyone.
**Impact:** User-360, funnel, and credit-revenue dashboards show wrong historical numbers; data exists only in unreachable archive tables.

## H-9 — 100 fabricated users seeded directly into production `auth.users` / `profiles` / `user_gamification`
**Severity:** High (polluted production data + security artifact)
**Location:** `supabase/migrations/20260301000622_5957ea41…sql` (entire file)
**Evidence:** A `DO $$` loop `1..100` inserts real login-capable accounts into `auth.users` with `crypt('FakePass123!_'||i)` passwords and `@gmail.com` emails, then sets random `credits_balance`/purchase/usage and random gamification XP/levels/streaks (names like `'Marcus Chen'`, dicebear avatars).
**Why it's real:** No later migration deletes them (searched for `DELETE FROM auth.users`, `dicebear`, `FakePass`, the seeded names; the one unrelated delete removes a single different UUID). They survive to final state.
**Impact:** Phantom users inflate every signup/funnel/leaderboard/gamification metric, appear in people-search/social surfaces, carry fabricated balances, and are real accounts with a known password pattern. Remove before launch.

---

# 🟡 MEDIUM

## M-1 — Business credit packs render on the **personal** Credits surface (account-type leak)
**Location:** `src/pages/Credits.tsx:221-230` (also reached via `/account?tab=credits`); packs from `src/lib/payments/creditPackages.ts:28-30`
**Evidence:** An unconditional "For teams & business" block renders `CREDIT_PACKAGES.filter(p => p.tier === 'business')` (up to ~$2,499 packs) with a working "Buy" CTA, with no `accountType`/`is_business` guard. Account type is supposed to be mutually exclusive. **Impact:** personal users see/buy business-only commerce inside a payment flow.

## M-2 — Stripe checkout `environment` is client-controlled with a sandbox→live key fallback
**Location:** `create-plan-checkout/index.ts:54-60`, `create-cinema-checkout/index.ts:37-38`, `create-org-checkout/index.ts:45`, `_shared/stripe.ts:18-23`
**Evidence:** Three of four Stripe checkout functions read `environment` from the body with no origin/role guard (unlike `create-credit-checkout`, which only honors `sandbox` for localhost). If `STRIPE_SANDBOX_SECRET_KEY` is unset in prod, a `sandbox` request silently falls back to the **live** key, while the resulting subscription is tagged `environment: "sandbox"`. **Impact:** environment mislabeling + a real test/dev-safety gap dependent on the operator never placing a live key in `STRIPE_SECRET_KEY`. (Polar's env switch is server-controlled via `POLAR_SERVER` — safe.)

## M-3 — Polar subscription with an unmapped `priceId` silently grants 0 credits
**Location:** `polar-checkout/index.ts:108-118` (`SUB_CREDITS` 3-entry map), `polar-webhook/index.ts:64-66`
**Evidence:** `SUB_CREDITS[priceId] ?? 0` bakes `credits=0` into order metadata for any plan not in the 3-entry map; `grantCredits` then early-returns on "no creditable amount." No server assertion that a subscription plan maps to positive credits. **Impact:** a customer billed for an unmapped/new plan receives 0 credits per cycle (independent of, and in addition to, C-1).

## M-4 — `notifications` INSERT policy lets any authenticated user notify any recipient
**Location:** policy `supabase/migrations/20260116132642_…sql:39`; blocking policy dropped in `20260206225440_…sql:2`
**Evidence:** `WITH CHECK (auth.uid() IS NOT NULL)` never constrains `user_id = auth.uid()` (recipient). No later migration re-adds the constraint. **Impact:** in-app phishing/spam — forged system-looking notifications with attacker-controlled `title`/`body`/`data` to arbitrary users. Fix: `WITH CHECK (user_id = auth.uid())`.

## M-5 — Duplicated credit→USD constants; admin pricing tool uses 11.6¢ where everything else uses 10¢
**Location:** canonical `src/lib/creditSystem.ts:63` (`CENTS_PER_CREDIT: 10`); duplicates in `AdminInvoicesPage.tsx:13`, `AdminFinancialsPage.tsx:78`, `CostAnalysisDashboard.tsx`, `BusinessBilling.tsx:31`; **divergent** `AdminPricingConfigEditor.tsx:143` (`revenuePerCredit = 11.6`); SQL `get_admin_profit_dashboard` also uses `* 11.6`.
**Evidence:** Five+ hand-copied definitions; one (and the profit RPC) uses 11.6¢ — a 16% discrepancy feeding margin math. **Impact:** no single trustworthy revenue/margin number across admin finance pages (see also M-13).

## M-6 — Notification preferences fragmented across two personal UIs with incompatible storage
**Location:** `src/pages/account/SettingsDashboard.tsx:1188-1264` (writes `profiles.notification_settings` JSONB, quiet hours as `"HH:MM"`) vs `src/pages/account/NotificationSettings.tsx:151-164` (writes `notification_preferences` table, quiet hours as integer hours)
**Evidence:** Two reachable pages both titled "Notification settings," both with an "Email" switch and "Quiet hours," persisting to disjoint tables in incompatible formats that feed different server gates (`notification_settings`→email; `notification_preferences`→in-app bell + quiet hours). **Impact:** users can't reliably control notifications; quiet hours set in one never apply to the other.

## M-7 — Personal "Auto-recharge" toggle is a dead setting
**Location:** `src/pages/account/SettingsDashboard.tsx:1883-1890`
**Evidence:** Writes only the boolean `profiles.auto_recharge_enabled`; captures no threshold/amount and no worker/cron reads it (the only checkout is a one-time hosted redirect with no stored payment method; no `set_user_auto_recharge`). **Impact:** UI promises automatic top-ups ("renders never stop mid-stream") that can never fire; renders still hard-stop at zero.

## M-8 — `seedance-script-director`: unauthenticated paid-LLM with attacker-selectable model
**Location:** `supabase/functions/seedance-script-director/index.ts:212-253`; `config.toml` `verify_jwt = false`
**Evidence:** No auth; `model = body.model ?? 'openai/gpt-5'` (caller picks the priciest model), and a 5xx auto-fires a second paid Gemini call. **Impact:** uncapped spend on the shared `LOVABLE_API_KEY` / AI-feature DoS. Fix: `validateAuth` + rate limit.

## M-9 — `translate-text`: unauthenticated, uncapped paid-LLM proxy
**Location:** `supabase/functions/translate-text/index.ts:2,35,72-77`; `config.toml` `verify_jwt = false`
**Evidence:** Explicit "no auth required," `texts[]` uncapped, no `max_tokens`, no rate limit; proxies to `ai.gateway.lovable.dev` on the shared key. **Impact:** unbounded spend drain on the key powering every AI feature + a free LLM proxy. Fix: `validateAuth` + size caps + rate limit.

## M-10 — `log-widget-event`: rate limiter keyed on attacker-controlled session; advances owner credit metering
**Location:** `supabase/functions/log-widget-event/index.ts:79-80,132-143`
**Evidence:** Sole abuse control is keyed on `visitor_session || 'anon'` (rotate it to bypass); `view` events call `check_widget_view_credits`, advancing the owner's per-1K-view metering, with no ownership/origin check. **Impact:** unauthenticated corruption of any org's widget analytics + credit exhaustion of the widget owner.

## M-11 — `manage-sessions` `revoke`: missing session-ownership check (IDOR)
**Location:** `supabase/functions/manage-sessions/index.ts:85-101`
**Evidence:** `list`/`revoke_others`/`revoke_all` are JWT-scoped, but `revoke` deletes a caller-supplied `session_id` via the admin API with no check it belongs to the JWT user. **Impact:** a user with another user's session UUID can force-sign-out that device (targeted DoS; mitigated by UUID non-enumerability).

## M-12 — `newsletter-subscribe`: unauthenticated brand-email send + unbounded inserts
**Location:** `supabase/functions/newsletter-subscribe/index.ts:24-65,90-100`
**Evidence:** Public, no captcha/rate-limit; per distinct email it inserts a row and sends a "welcome" email from the brand domain. **Impact:** spam amplification to arbitrary victims as your domain (bounce/complaint damage). Fix: captcha/rate limit.

## M-13 — Two routed admin finance pages report contradictory revenue (different rate AND base)
**Location:** `get_admin_profit_dashboard` (powers `/admin/finance`, `AdminFinancialsPage.tsx:66`) vs `ledger_pnl`/`analytics_pnl`/`admin-analytics`
**Evidence:** `get_admin_profit_dashboard` = `SUM(credits_charged) * 11.6¢` (credits *used*); `admin-analytics`/`analytics_pnl`/ledger = `credits_purchased * $0.10`. Different rate (11.6 vs 10) and different base (charged vs purchased). **Impact:** `/admin/finance` and `/admin/pnl` show materially different "revenue" for the same period; no single trustworthy figure.

---

# 🟢 LOW

- **L-1** — Ledger-backed P&L (`/admin/pnl`, `AdminPnlPage.tsx` + `ledger_pnl`) reads a ledger that real revenue/COGS never reach (root cause = C-1); the page reports ~zero operating activity permanently. *(Same root as C-1; listed for the admin-reporting surface.)*
- **L-2** — `bill_storage` comment claims a production cron that does not exist in the repo (`AdminStorageBillingPage.tsx:5`); it only runs on a manual button click — so even storage is normally absent from the ledger.
- **L-3** — Orphaned admin RPC `analytics_pnl` (`20260620210955_analytics_pnl.sql`) — no callers; superseded but not removed; adds to the multiplicity of "P&L" implementations.
- **L-4** — `Credits.tsx:153,404` displays `profile.credits_balance` (cache) as the headline "Balance" instead of `useCredits().available`, so it can overstate spendable credits when holds are active or before reconcile.
- **L-5** — `useCreditBilling.ts:255-269` `canAffordShots` reads the `credits_balance` cache and ignores active holds (`available = balance − held`); the Studio "can you afford this" gate can be optimistic (server still enforces). *(Cross-module: this reader disagrees with `CreditsContext` by design.)*
- **L-6** — `CreditLowInline.tsx:67-69` "N left after this costs M" interpolates `balance` instead of `balance − required` (wrong number shown pre-spend).
- **L-7** — `ProfileDashboard.tsx:941-956,3497` achievements: 13 conditions, `slice(0,8)`, but denominator hardcoded `/12` — fraction can never be right.
- **L-8** — `SettingsDashboard.tsx:1848-1863` Billing "Export CSV" exports only the most-recent 20 transactions while copy says "transaction history" (Credits page uses 40 — the two also disagree on depth).
- **L-9** — Orphaned profile cards with hardcoded "live" data: `DailyChallengesCard.tsx:8-13` (+ `AchievementsPreviewCard`, `GamificationStatsCard`, `QuickStatsCard`) — currently unimported (dead), latent if mounted.
- **L-10** — `Credits.tsx:1-14` stale header claims "no paid checkout flow today" while the file implements full pack + subscription checkout; provider naming mixes Polar/Stripe.
- **L-11** — `AcceptInvite.tsx:66-73` "member joined" admin notification selects `profiles(email)` (revoked column, see H-2 fix) inside a try/catch → silently sends no admin emails. Other business pages use the `org_member_directory` RPC; this path wasn't migrated.
- **L-12** — `generate-ad-studio` enforces only authentication, not the Producer role the UI gates on (`BusinessAdStudio.tsx:116`); a viewer/reviewer can call it directly (no credit cost, org data stays RLS-scoped).
- **L-13** — Business "Top up" CTA (`BusinessCredits.tsx:279,414`) routes through legacy `/workspace/*` redirects to `/business/billing`, which has no top-up mechanism (dead-end; auto-recharge/alerts honestly labeled "not live").
- **L-14** — Role dropdowns offer "Editor" (`BusinessTeam.tsx:37,242,284`), not a valid `org_role` enum value (`owner|admin|producer|reviewer|viewer`) → selecting it throws a generic enum error; also a latent `ROLE_RANK[undefined]` permission-eval gap.
- **L-15** — Two admin-status sources can drift: `AuthContext.tsx:205` (`rpc('is_admin')`, used by routing gates) vs `useAdminAccess.ts:82-87` (direct `user_roles` query, used by diagnostics overlays only). No auth bypass; consolidate onto the RPC.
- **L-16** — Pervasive `as never`/`as any` RPC casts (~108 sites, e.g. `CreditsContext.tsx:54`, `AdminUsersPage.tsx:127`) mask the known ~2,800-line `types.ts` drift; verified the called RPCs exist and signatures currently match, so no live break — but compile-time safety is disabled on the most drift-prone calls.
- **L-17** — `src/test/setup.ts` does not stub `VITE_SUPABASE_URL`; 33 local tests fail at module-load (suite is green only in CI, which injects the stub). Add `vi.stubEnv('VITE_SUPABASE_URL', …)` in setup, or guard the client for empty URL.
- **L-18** — `admin_profit_dashboard` view (`20260112212511_…sql:115`) divides by `SUM(credits_charged)*11.6` but guards only on `real_cost_cents>0` → divide-by-zero on a day with cost but zero credits charged.
- **L-19** — Edge-function abuse residue: `premiere-recap` (unauth read of premiere host/tip/RSVP data by UUID), `process-ai-video-replies` (cron worker without `requireCronSecret`), `gamification-event` (XP self-award by replay; XP not convertible to credits), `landing-demo-chat` (per-instance, IP-spoofable rate limit). All bounded; tighten for defense-in-depth.

---

## Needs human judgment

1. **Was the ledger cutover intentional and unfinished, or accidental?** C-1 hinges on `20260620214321` repointing `credit_ledger_total` to a ledger nothing writes at runtime. The fix is either (a) make `add_credits`/`deduct_credits`/holds post double-entry lines to `ledger_entries`, or (b) revert `credit_ledger_total` to read `credit_transactions`. This is a product/architecture decision — **must be resolved before any paid launch.** Verify current production balances against expectation immediately.
2. **Polar renewal credits depend on Polar copying checkout metadata onto each renewal `order.paid`.** `grantCredits` reads `order.metadata.credits` (`polar-webhook/index.ts:62-66`); if Polar does not propagate subscription metadata to renewal orders, every renewal grants 0. This is an external-API behavior assumption (asserted in comments) — confirm with a real sandbox renewal. *(Independent of C-1.)*
3. **Single hardcoded admin** (`is_admin`/`has_role` pinned to UUID `45f0fc04…`, brianbcole74@gmail.com, enforced by a `user_roles` CHECK + `enforce_admin_lock` trigger). Server-side RBAC is otherwise solid; confirm whether single-admin is the intended operating model (it is a single point of failure by design).
4. **Enterprise lockout** — `enterprise` accounts are funneled into `/business/*` then bounced to `/enterprise/coming-soon` (terminating, not a loop). Confirm this "enterprise = not launched yet" behavior is intended (no enterprise user is expected to use `/business`).
5. **Should the 100 seed users (H-9) and the destructive finance seed (H-8) be reverted on production**, and the archived `credit_transactions_archive` data be restored/surfaced? Decide retention vs. wipe.

---

## Prioritized fix order

**Before any paid launch (blockers):**
1. **C-1** — restore the credit write↔read invariant (finish ledger writes or revert `credit_ledger_total`). Re-verify live balances.
2. **H-5** — fix `monthly_org_credit_refill` arg order so org renewals don't throw (and depend on C-1 being fixed to be spendable).
3. **H-4** — add locking + Stripe idempotency key to `stripe-connect-payout` (real money double-pay).
4. **C-2, C-3, H-3** — add `requireServiceRole`/auth to `send-transactional-email`, `svg-rasterize`, `send-push-notification` (brand phishing, cross-project poisoning).
5. **H-1** — add `WITH CHECK` to the org member-role UPDATE policy (block self-promotion to owner).
6. **H-2** — close cross-tenant `credits_balance`/sensitive-column reads (column-grant + RLS, or move to RPC).

**Pre-launch, high value:**
7. **H-9 / H-8** — remove the 100 fabricated users; decide on the finance wipe + archive restoration; fix the analytics that read wiped history.
8. **H-6** — make org credit analytics genuinely org-scoped (SECURITY DEFINER RPC or `organization_id` + member SELECT policy).
9. **H-7** — guard + fix metadata keys in the Stripe `create-org-checkout` path before enabling it.
10. **M-1** — gate business credit packs off the personal surface.

**Then:** the remaining Medium items (M-2…M-13 — env safety, unmapped-plan 0-credit, notification spoofing, unauthenticated paid-LLM proxies, fragmented/dead settings, contradictory finance numbers), followed by the Low cleanup batch (L-1…L-19), and the test-harness env stub (L-17).

---

## Verified-safe / strong controls confirmed (coverage note)

- **Shared auth library** (`_shared/auth-guard.ts`): `validateAuth` uses `getUser(token)`; `resolveEffectiveUserId` ignores body `userId` for end-user JWTs (anti-privilege-escalation); `requireServiceRole`/`requireCronSecret` and all webhook verifiers use **constant-time compares**; `verifyReplicateSignature`/`verifyPolarWebhook` are correct Standard-Webhooks HMACs with a 5-min replay window. ~97 of 140 functions import it.
- **Webhook security**: Polar, Stripe, and Replicate webhooks all verify signature + timestamp **before** processing and reject (401) on failure.
- **Credit-grant idempotency**: `add_credits` dedupes on `stripe_payment_id` (unique partial index) and locks `profiles … FOR UPDATE`; webhook retries are no-ops. `reserve_credits`/`consume_credit_hold` lock and support idempotency keys. *(These controls are correct — the C-1 defect is that the resulting writes land in the wrong table for the read path.)*
- **Amounts are server-authoritative**: clients send only `packageId`/`priceId`; credit counts come from server-side catalogs and server-set metadata. No client-supplied amount is trusted. Polar env switching is server-controlled (`POLAR_SERVER`).
- **Admin RBAC is server-side and layered**: every `analytics_*`/`ledger_*` RPC opens with `is_admin(auth.uid())` + `REVOKE … FROM public`; admin edge functions re-verify admin; cron/internal functions gate on `requireCronSecret`/`requireServiceRole`. Not bypassable by a non-admin direct call.
- **Polar access token**: server-only (`Deno.env('POLAR_ACCESS_TOKEN')`), never logged, never in `src/`. No `VITE_*` secret/token exposed client-side; only the publishable key ships.
- **SSRF**: functions fetching user-supplied URLs use `_shared/ssrf-guard.ts`; others fetch fixed provider endpoints.
- **No secrets in logs**: grep for `console.*` emitting service-role key / API keys / Authorization headers found none.
- **RLS coverage**: all base tables `ENABLE ROW LEVEL SECURITY`; credit-mutating RPCs revoked from `anon`/`authenticated`; `*_safe`/`*_public` views are `security_invoker`; `profiles.email` cross-tenant exposure is fully closed (the remaining gap is the credits/sensitive columns — H-2).
- **Routing/build integrity**: single Supabase client; single Sonner toast root (legacy Radix toaster is dead code); business routes generated from one source with a coming-soon fallback; main vs admin builds output to separate dirs with separate `vercel.json`/`vercel.admin.json`; provider ordering in `App.tsx` is correct (no consume-above-provider); account-type gates don't loop for personal/business accounts.
- **Analytics SQL**: divide-by-zero guarded across `analytics_*` RPCs (`greatest(...)`); `api_cost_logs` is genuinely written by 10+ generation functions, so cost dashboards read real data; no `Math.random`/mock arrays in admin pages.

---

*Report generated from a read-only audit; no source files were modified. Findings with `file:line` references were each confirmed against the cited source. Critical/High items were independently re-verified (the C-1 ledger chain was traced firsthand through the migration history).*
