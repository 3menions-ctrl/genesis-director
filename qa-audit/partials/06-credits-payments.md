# QA Audit — Surface 06: Credits, Billing & Payments

READ-ONLY reliability audit. Provider = **Polar** (active). **Stripe billing is
intentionally locked** via `STRIPE_BILLING_LOCKED` (`supabase/functions/_shared/stripe-lock.ts:17`
and the client mirror `src/lib/payments/index.ts:68`). Money truth = `credit_transactions`
ledger via `get_credit_state()`; `profiles.credits_balance` is a display cache only.

Legend: ✅ works (by code) · 🔒 intentionally disabled (NOT a bug) · ⚠️ gap/orphaned · 🐞 bug · ❓ needs live backend

---

## INVENTORY

| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| `buy(pkg)` | src/pages/Credits.tsx:164 | One-time credit pack purchase | → `startCreditCheckout` → provider.createCreditCheckout → `polar-checkout` (mode=credits) → redirect | ✅ |
| `subscribe(planKey)` | src/pages/Credits.tsx:176 | Monthly plan subscribe | → provider.createSubscriptionCheckout(kind=personal) → `polar-checkout` (mode=subscription) → redirect | ✅ |
| history fetch | src/pages/Credits.tsx:107 | Recent ledger rows | reads `credit_transactions` directly | ✅ |
| payment-return handler | src/pages/Credits.tsx:130 | Toast + reconcile on `?payment=success` | calls `credits.reconcile()` | ✅ |
| balance display | src/pages/Credits.tsx:160 | Show spendable balance | `credits.available` (ledger, held-aware); cache only while loading | ✅ |
| `buy(pkg)` | src/components/credits/BuyCreditsModal.tsx:44 | Modal pack purchase | → `startCreditCheckout` → Polar | ✅ |
| `startCreditCheckout` | src/lib/payments/creditPackages.ts:44 | Resolve provider + redirect | getPaymentsProvider → createCreditCheckout → `window.location.href` | ✅ |
| `getPaymentsProvider` | src/lib/payments/index.ts:81 | Active provider resolver | stripe-lock reroutes `stripe`→`polar` (index.ts:74) | ✅ 🔒 |
| `polarProvider.*` | src/lib/payments/polar.ts:29 | Credit/sub/portal wrappers | invoke `polar-checkout`/`polar-portal`; validate `{url,sessionId}` shape | ✅ |
| `stripeProvider.*` | src/lib/payments/stripe.ts:22 | Stripe wrappers | unreachable (lock reroutes to polar) | 🔒 |
| lemonsqueezy/btcpay providers | src/lib/payments/{lemonsqueezy,btcpay}.ts | Future rails | throw "not implemented"; not selected | 🔒 (stub) |
| `getAuthoritativeCreditState` | src/lib/credits/authoritativeCreditState.ts:9 | Ledger state via edge fn | invoke `reserve-credits` action=state | ✅ |
| `useEffectiveCredits` | src/hooks/useEffectiveCredits.ts:30 | Personal vs org wallet | org→`get_org_credit_state` RPC; personal→CreditsContext | ✅ ❓(RPC) |
| `useCreditBilling.canAffordShots` | src/hooks/useCreditBilling.ts:106 | Pre-flight affordability | `get_credit_state` (available, held-aware) | ✅ |
| `useCreditBilling.logApiCost` | src/hooks/useCreditBilling.ts:81 | Profit telemetry | `log_api_cost` RPC | ✅ |
| `useCinemaEntitlement`/`useCinemaGuard` | src/hooks/useCinemaEntitlement.ts:65,156 | Cinema fair-use gate | `get_cinema_entitlement` RPC; guard in Studio.tsx:220 | ⚠️ never enforces (no buy path) |
| `useTierLimits` | src/hooks/useTierLimits.ts:15 | Tier caps | `get_user_tier_limits` RPC, fail-safe to free | ✅ |
| `polar-checkout` | supabase/functions/polar-checkout/index.ts:45 | Create Polar hosted checkout | auth → product UUID env → `createPolarCheckout` → `{url,sessionId}` | ✅ ❓(env) |
| `polar-portal` | supabase/functions/polar-portal/index.ts:18 | Customer portal URL | `polarCustomerPortal(user.id)` | ✅ but ⚠️ **no UI caller** |
| `polar-webhook` | supabase/functions/polar-webhook/index.ts:235 | Fulfillment | order.paid→`add_credits`; refunded→`reverse_credit_purchase`; sub.*→upsert `subscriptions`; idempotent on `polar_<id>` | ✅ |
| `payments-webhook` | supabase/functions/payments-webhook/index.ts:14 | Stripe webhook | acks 200 + ignores while locked | 🔒 |
| `reserve-credits` | supabase/functions/reserve-credits/index.ts:42 | Hold/consume/release | JWT + ownership checks → `reserve_credits`/`consume_credit_hold`/`release_credit_hold` | ✅ ❓(RPC) |
| `reconcile-credit-holds` | supabase/functions/reconcile-credit-holds/index.ts:24 | Cron hold reconciler | service-role → `reconcile_pipeline_credit_holds` (expires TTL/stale holds) | ✅ |
| `monthly-credit-refill` | supabase/functions/monthly-credit-refill/index.ts:7 | Org pool monthly top-up | cron-secret → `monthly_org_credit_refill` (org-only; personal via order.paid) | ✅ |
| `create-credit-checkout` | supabase/functions/create-credit-checkout/index.ts:24 | Stripe credit checkout | short-circuits 503 (locked) | 🔒 |
| `create-plan-checkout` | supabase/functions/create-plan-checkout/index.ts:51 | Stripe plan checkout | 503 (locked); returns `clientSecret` shape | 🔒 |
| `create-org-checkout` | supabase/functions/create-org-checkout/index.ts:39 | Stripe org+seats checkout | 503 (locked) | 🔒 + ⚠️ orphaned |
| `create-cinema-checkout` | supabase/functions/create-cinema-checkout/index.ts:34 | Stripe Cinema sub | 503 (locked); returns `clientSecret` | 🔒 + ⚠️ orphaned |
| `verify-cinema-checkout` | supabase/functions/verify-cinema-checkout/index.ts:58 | Verify Cinema session | 503 (locked) | 🔒 + ⚠️ orphaned |
| `create-portal-session` | supabase/functions/create-portal-session/index.ts:17 | Stripe billing portal | 503 (locked) | 🔒 |
| `get-cinema-pending-change` | supabase/functions/get-cinema-pending-change/index.ts:52 | Scheduled sub change | 503 (locked) | 🔒 + ⚠️ orphaned |
| `list-cinema-invoices` | supabase/functions/list-cinema-invoices/index.ts:32 | Invoice list | 503 (locked) | 🔒 + ⚠️ orphaned |
| `sync-org-seats` | supabase/functions/sync-org-seats/index.ts:17 | Seat→Stripe sync | 503 (locked) | 🔒 + ⚠️ orphaned |
| `stripe-connect-onboard` | supabase/functions/stripe-connect-onboard/index.ts:20 | Creator payout KYC | NOT locked (payouts live); Express acct + account link | ✅ (minor 🐞 returnUrl) |
| `stripe-connect-payout` | supabase/functions/stripe-connect-payout/index.ts:21 | Creator cash-out | NOT locked; atomic claim + idempotency key + fail-closed | ✅ |
| `webhook-dispatch` | supabase/functions/webhook-dispatch/index.ts:144 | Workspace webhooks (not payments) | HMAC + SSRF guard + role gate | ✅ (out of payment scope) |
| PatronHubPage `pledge`/`cancelPledge` | src/pages/PatronHubPage.tsx:194,223 | Patron→creator **internal credit** pledge | `pledge_patron_tier`/`cancel_patron` RPC — NO external billing | ✅ (not a Polar/Stripe surface) |
| WelcomeCheckout | src/pages/WelcomeCheckout.tsx | Post-signup welcome | static page, no checkout anymore | ✅ (no-op) |
| Pricing | src/pages/Pricing.tsx:493 | Marketing | CTAs `navigate('/credits')`; never starts checkout | ✅ (see L-3) |

~38 entry points. No checkout button is a hard no-op; no balance reads the stale cache as primary.

---

## BROKEN / GAPS

### M-1 — Billing portal is not wired to any UI button (manage/cancel subscription impossible in-app) — MEDIUM
- **Symptom:** A subscriber cannot open the billing portal or cancel/manage their plan from the app. Copy promises it: Credits.tsx:256 ("manage your plan from the billing portal") and Help.tsx:113 ("Account → Billing → Manage subscription… the Stripe portal"). The Help text is also doubly wrong — it names the *Stripe* portal, which is locked.
- **Repro:** Subscribe via Credits → go to Settings/Billing → there is no "Manage subscription" / "Open portal" control. `BillingSettings.tsx` (454 lines) only has Buy-credits + Export-transactions buttons (lines 213, 380).
- **Root cause:** `polarProvider.createPortalSession` / `polar-portal` (supabase/functions/polar-portal/index.ts) have **no caller** in `src/` (grep: only the definition in `src/lib/payments/polar.ts:50`). The portal edge fn itself works.
- **Fix:** Add a "Manage subscription" button in `BillingSettings.tsx` that calls `getPaymentsProvider().createPortalSession({returnUrl})` and redirects to `data.url`. Update Help.tsx:113 to say Polar, not Stripe.

### M-2 — Cinema billing surface is fully orphaned; guard never enforces; latent Polar break — MEDIUM
- **Symptom:** There is no UI anywhere to purchase a Cinema subscription. `useCinemaGuard` is consumed only in `Studio.tsx:220`; with no purchase path no user ever holds an entitlement, so the guard always returns `allowed:true` (`useCinemaEntitlement.ts:180`) — i.e. it is dead code that never gates fair-use seconds.
- **Repro:** grep for `create-cinema-checkout`/`verify-cinema-checkout`/`list-cinema-invoices`/`get-cinema-pending-change` callers in `src/` → none. All four edge fns are also Stripe-locked (503).
- **Root cause:** Cinema checkout was built on the Stripe path (embedded `clientSecret`, create-cinema-checkout) which is now locked, and was never re-wired to Polar nor surfaced in UI. **Latent break:** if Cinema were re-enabled by calling the provider abstraction with `kind:'cinema'`, the lock reroutes to Polar → `polar-checkout` mode=subscription, whose `SUB_CREDITS` map (polar-checkout/index.ts:108) has only `sub_creator/pro/studio_monthly` → `cinema_*` priceIds hit the M-3 guard at line 118 and return **503 "no credit allowance configured"**.
- **Fix:** Either (a) remove the Cinema billing fns + guard if Cinema is shelved, or (b) when re-launching, add Cinema plans to `polar-checkout` SUB_CREDITS / product-UUID mapping AND build the buy + entitlement-refresh UI (`useRefreshCinemaEntitlement` already exists). Until then `useCinemaGuard` should be documented as inert.

### M-3 — Org (team/seat) subscription checkout is orphaned; latent Polar break — MEDIUM
- **Symptom:** No UI calls `create-org-checkout` (kind:'org') — grep finds no caller in `src/`. Business team/seat subscriptions cannot be purchased. (Business one-time *credit packs* DO work — they route through `polar-checkout` mode=credits with studio/brand/agency+ products and are gated to business accounts in Credits.tsx:234.)
- **Repro:** grep `kind: 'org'` / `create-org-checkout` / `growth_monthly` in `src/` → none.
- **Root cause:** Org subscription checkout (seat-based, Stripe two-line-item) is Stripe-locked and never re-wired to Polar. Latent: provider abstraction `kind:'org'` → Polar → `polar-checkout` has no org plan in SUB_CREDITS → 503. Org pool funding logic (`monthly_org_credit_refill`, polar-webhook upsertSubscription:196) exists and is correct, but nothing creates the org subscription in the first place via the active provider.
- **Fix:** Add org plans to `polar-checkout` (or a dedicated Polar org-checkout) and wire the business workspace billing UI to it; confirm the webhook `org_id` metadata path (polar-webhook:71,196) is exercised.

### L-1 — `stripe-connect-onboard` ignores the requested return URL — LOW
- **Symptom:** After payout onboarding the user is returned to `/workspace/credits?connect=done`, not the page they came from.
- **Root cause:** Client sends `{ return_path: "/account?tab=settings&m=creator" }` (SettingsDashboard.tsx:1648) but the fn reads `body.returnUrl` (stripe-connect-onboard/index.ts:36,40), so it always falls back. Cosmetic; onboarding still completes.
- **Fix:** Send `returnUrl` (matching the fn) or have the fn also read `return_path`.

### L-2 — `list-cinema-invoices` documented for the Credits page but never called — LOW
- **Symptom:** Invoices are unreachable in-app. The fn header says "users can view/download from Credits," but Credits.tsx never invokes it.
- **Root cause:** Orphaned (and Stripe-locked). Same root as M-2.
- **Fix:** Wire invoice list once billing portal/Cinema are on Polar, or remove.

### L-3 — Pricing page carries vestigial checkout UI — LOW (not user-facing)
- **Symptom:** `Pricing.tsx` imports/mounts `BuyCreditsModal` (line 658) and defines `planLookupKey` per plan (line 54), but `showBuyModal` is never set true and `handlePurchase` only `navigate('/credits')` (line 493). Dead code, not a broken flow.
- **Fix:** Drop the unused modal mount + `planLookupKey` field, or none (harmless).

---

## INTENTIONALLY DISABLED — NOT BUGS (stripe-lock kill-switch)

These all short-circuit with HTTP 503 `stripe_billing_disabled` and are **correct, deliberate**
behavior — billing runs through Polar. Do not "fix" by re-enabling:
`create-credit-checkout`, `create-plan-checkout`, `create-org-checkout`,
`create-cinema-checkout`, `verify-cinema-checkout`, `create-portal-session`,
`get-cinema-pending-change`, `list-cinema-invoices`, `sync-org-seats`, and
`payments-webhook` (acks 200, ignores). The client `stripeProvider` (src/lib/payments/stripe.ts)
is unreachable because `getPaymentsProvider` reroutes `stripe`→`polar` (index.ts:74).
Stripe **Connect payouts** (`stripe-connect-onboard`/`-payout`) are deliberately NOT locked.

Note: `create-plan-checkout`/`-cinema`/`-org` return a `{clientSecret}` (embedded) shape that
does NOT match the provider's expected `{url,sessionId}` — but this is moot while locked and
unreachable. Flag only if Stripe billing is ever unlocked.

---

## VERIFIED-WORKING (core money paths)

- **Credit pack purchase** (✅): Buy → `startCreditCheckout` → `polar-checkout` (mode=credits) →
  Polar hosted URL → redirect. Response shape validated (polar.ts:37). Fulfillment:
  `order.paid` → `add_credits` with ref `polar_<orderId>` (polar-webhook:78-80) → posts to the
  **ledger**, idempotent. Refund: `order.refunded` → `reverse_credit_purchase` (idempotent).
- **Subscription purchase + renewal** (✅): `polar-checkout` mode=subscription with SUB_CREDITS
  map; each renewal emits a fresh `order.paid` (unique order id) → grants again, no double-grant.
  `subscription.*` events upsert `subscriptions` and **throw→500→retry** on failure so a paid
  user is never stranded on `free` (polar-webhook:148-205).
- **Balance display** (✅): reads `get_credit_state()` (ledger-derived, `available = balance −
  holds`) via CreditsContext; `profiles.credits_balance` used only as a loading fallback
  (Credits.tsx:160) — stale-cache and the "real-0 re-shows high cache" bug are explicitly fixed.
- **Reserve→consume/release lifecycle** (✅): `reserve-credits` holds before render, consumes on
  success, releases on failure; JWT + project/hold ownership enforced. **Frozen-balance risk
  mitigated** by `reconcile-credit-holds` cron expiring TTL/stale (>1h) holds back to available.
- **Webhook integrity** (✅): Standard-Webhooks HMAC verify + 5-min replay window
  (`_shared/polar.ts:92`); org orders correctly skipped in grant/reverse (pool funded by refill,
  no double-credit); notifications deduped on order id.
- **Payout double-charge race** (✅): `stripe-connect-payout` creates the payout row, then
  atomically claims unpaid ledger rows (`UPDATE … WHERE payout_id IS NULL`), uses a deterministic
  Stripe idempotency key, and fails closed (rows stay claimed on transfer error) — no double pay.

---

## UNVERIFIED (needs live backend / secrets)

- **Polar product config:** `POLAR_PRODUCT_*` env per pack/plan. If unset, checkout returns 503
  "Polar product not configured" (polar-checkout:76,105). Verify MINI/STARTER/GROWTH/AGENCY/
  STUDIO/BRAND/AGENCYPLUS and SUB_CREATOR/PRO/STUDIO_MONTHLY are set on the function.
- **DB RPCs** assumed present + correct: `add_credits`, `reverse_credit_purchase`,
  `reserve_credits`, `consume_credit_hold`, `release_credit_hold`, `get_credit_state`,
  `get_org_credit_state`, `reconcile_pipeline_credit_holds`, `monthly_org_credit_refill`,
  `get_cinema_entitlement`, `get_user_tier_limits`, `fn_org_has_min_role`, `log_api_cost`.
- **`account_tier` propagation:** webhook upserts `subscriptions`; the tier change to the profile
  presumably relies on a DB trigger/RPC reading that table — not verified here.
- **STRIPE_BILLING_UNLOCK** is unset in prod (lock stays on) — assumed; confirm no env override.
