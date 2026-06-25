# Genesis Director — Remediation & Verification Report

**Date:** 2026-06-24
**Branch:** `remediation/audit-fixes` (off `main` @ `e43c0799`) → merged to `main`
**Source of work:** `AUDIT_REPORT.md` (3 Critical, 9 High, 13 Medium, 19 Low)
**Constraints honored:** read-only against live data; no live Polar/Stripe calls (sandbox/mocks only); production data repairs flagged, not performed; unsafe-to-auto-fix items flagged rather than forced.

---

## Verification summary (Phase 3)

| Check | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit -p tsconfig.json` | ✅ PASS (exit 0) |
| Main build | `vite build` → `dist/` | ✅ PASS (built in ~14s) |
| Admin build | `ADMIN_BUILD=1 VITE_ADMIN=true vite build` → `dist-admin/` | ✅ PASS (built in ~10s) |
| Tests | `vitest run` (no env needed now — see L-17) | ✅ PASS — **108 files, 3644 tests pass, 61 skipped, 0 fail** |
| Ports | main dev `:7777`; admin = separate `dist-admin` output + `vercel.admin.json` (noindex) | ✅ no collision |

All three modules (regular-user, business, admin) build and the full suite is green. The C-1 decision (revert the accidental June-20 ledger repoint) was applied.

---

## Phase 1 — Fixes by severity

### 🔴 Critical (3/3 fixed)

**C-1 — Credit ledger severance** → `supabase/migrations/20260704000000_revert_credit_ledger_repoint.sql`
Per the product decision (accidental cutover), reverted `credit_ledger_total()` to its pre-repoint definition (reads `credit_transactions`, the table every runtime money mutation writes to). New forward migration (later timestamp than the `20260620214321` repoint and all existing migrations), restoring the verbatim `20260518175601` body.
*Verified 3×:* (1) timestamp ordering makes it the final definition; (2) body matches the original; (3) `get_credit_state → credit_ledger_total → credit_transactions` now consistent with `add_credits`/`deduct_credits` writes, so purchases increase and usage decrements spendable balance. No code reads the ledger for spendable balance anymore. **Build/typecheck/tests green.**
⚠️ **Requires a flagged production DATA backfill — see "Not auto-fixed" #1.**

**C-2 — `send-transactional-email` open relay** → `supabase/functions/send-transactional-email/index.ts`
Added a `service_role` JWT-claim check (mirrors `process-email-queue`) before any work. `verify_jwt=true` alone is satisfied by the public anon key.
*Verified 3×:* all 3 internal callers (`admin-alert-dispatch`, `update-user-email`, `auto-stitch-trigger`) invoke with a service-role client (claim passes); external anon-key callers get 403; check sits before body parse/send.

**C-3 — `svg-rasterize` unauthenticated service-role storage write** → `supabase/functions/svg-rasterize/index.ts`
Added `requireServiceRole(req)` before any upload.
*Verified 3×:* it's an internal worker (invoked by `seamless-stitcher`); confirmed no active caller exists today (the stitcher path is wired-but-pending), so no regression; guard runs before the attacker-controlled-key upload.

### 🟠 High (5/9 fixed, 4 flagged)

**H-1 — Org admin self-promotion to owner** → `supabase/migrations/20260704000200_org_member_role_update_guard.sql`
Replaced the `USING`-only UPDATE policy with `USING` + `WITH CHECK` so ownership changes are owner-only and admins can neither create owners nor modify owner rows. Uses the hierarchical `has_org_permission`.
*Verified 3×:* confirmed the original policy had no `WITH CHECK` (line-213 check belonged to the invites policy); confirmed no later migration adds a guard; `protect_last_owner` still layers on top.

**H-3 — `send-push-notification` spoofed push** → `supabase/functions/send-push-notification/index.ts`
Added `requireServiceRole(req)`. Confirmed zero callers (dormant worker) → no regression.

**H-4 — Stripe payout double-pay race** → `supabase/functions/stripe-connect-payout/index.ts` + `supabase/migrations/20260704000300_payout_id_nullable_for_claim.sql`
Create the payout row first (made `stripe_payout_id` nullable), then **atomically claim** unpaid rows via `UPDATE … WHERE payout_id IS NULL` (only one concurrent caller wins), compute the amount from claimed rows only, add a Stripe `idempotencyKey`, and **fail closed** on transfer error (rows stay claimed to the failed payout — never auto-retried).
*Verified 3×:* concurrent caller claims 0 rows → no second transfer; below-threshold path releases the claim safely (pre-transfer); status-webhook still matches on non-null `stripe_payout_id`.

**H-5 — Monthly org refill never ran** → `supabase/migrations/20260704000100_fix_monthly_org_credit_refill_ref.sql`
Replaced the `NULL` 4th arg to `add_credits` with a stable idempotency ref `org_refill_<org>_<YYYY-MM>` (satisfies the non-null/length guard and dedupes per org per period). Body otherwise identical.
*Verified 3×:* matched the current `add_credits(uuid,int,text,text)` signature and its guard; preserved the REVOKE posture; spendability now restored by C-1.

**H-7 — Stripe `create-org-checkout` IDOR + broken org link** → `supabase/functions/create-org-checkout/index.ts`
Added an org-admin membership check (`fn_org_has_min_role(..,'admin')`, mirrors `polar-checkout`) for any supplied `organizationId`, and emit the `organization_id` (snake_case) metadata key the webhook actually reads.
*Verified 3×:* confirmed the webhook reads `organization_id`/`org_id` (not `organizationId`); confirmed the Polar sibling has the guard and this one didn't; UUID-validated.

**Flagged (not auto-fixed) — see "Not auto-fixed" section:** H-2, H-6, H-8, H-9.

### 🟡 Medium (8/13 fixed, 1 false-positive, 4 flagged)

| ID | Fix | File |
|---|---|---|
| M-1 | Gate business credit packs behind `account_type` business/enterprise on the personal `/credits` surface | `src/pages/Credits.tsx` |
| M-2 | Only localhost may request Stripe `sandbox`; hosted origins always `live` (mirrors `create-credit-checkout`) | `create-plan-checkout`, `create-cinema-checkout`, `create-org-checkout` |
| M-3 | Reject Polar subscription checkout when the plan has no positive credit mapping (503) | `polar-checkout/index.ts` |
| M-5 | Use canonical `$0.10/credit` (`CREDIT_SYSTEM.CENTS_PER_CREDIT`) instead of hardcoded 11.6¢ | `AdminPricingConfigEditor.tsx` |
| M-8 | Require service-role for `seedance-script-director` (internal; `seedance-pipeline` calls with service key) — also neutralizes the caller-chosen-model vector | `seedance-script-director/index.ts` |
| M-9 | `translate-text` is public by design (i18n); cap array length (200) + total chars (20k) to bound LOVABLE_API_KEY spend | `translate-text/index.ts` |
| M-11 | Verify session ownership before `revoke` (was an IDOR via the admin API) | `manage-sessions/index.ts` |
| M-13 | Align `get_admin_profit_dashboard` to canonical $0.10 and guard the margin divide-by-zero (also resolves **L-18**) | `supabase/migrations/20260704000400_profit_dashboard_rate_and_divzero.sql` |

**M-4 — FALSE POSITIVE (no change):** verified the permissive `notifications` INSERT policy was dropped in `20260213025841` and never replaced; authenticated users currently **cannot** insert notifications at all (only service-role/SECURITY-DEFINER paths). Adding a `user_id=auth.uid()` policy would have *loosened* security.

**Flagged:** M-6, M-7, M-10, M-12 (product/design decisions — see below).

### 🟢 Low (7/19 fixed; L-18 folded into M-13)

| ID | Fix | File |
|---|---|---|
| L-4 | Credits headline shows authoritative `available` (balance−held), not the cache | `src/pages/Credits.tsx` |
| L-6 | `CreditLowInline` shows `balance − required` ("left after"), not `balance` | `src/components/credits/CreditLowInline.tsx` |
| L-7 | Achievements fraction uses the real total (13), not hardcoded `/12`; removed the count cap | `src/pages/account/ProfileDashboard.tsx` |
| L-10 | Refreshed the stale Credits header doc that claimed no paid checkout exists | `src/pages/Credits.tsx` |
| L-17 | Stub `VITE_SUPABASE_URL` in `src/test/setup.ts` so the suite is hermetic locally (was green only in CI) | `src/test/setup.ts` |
| L-18 | Divide-by-zero guard in the profit dashboard (with M-13) | migration `…000400` |
| L-19 | Require cron secret for `process-ai-video-replies` (internal cron worker) | `process-ai-video-replies/index.ts` |

**Not done (deferred, low-risk, documented):** L-1 (admin ledger PnL page still reads the now-bypassed ledger — admin-reporting follow-up, same root as C-1), L-2 (`bill_storage` cron — ops), L-3 (orphan `analytics_pnl` RPC — harmless), L-5 (`canAffordShots` cache read — UI gate; server enforces), L-8 (CSV export 20-row cap), L-9 (orphaned/unimported profile cards — dead code), L-11 (member-joined email — resolved once H-2 lands), L-12 (`generate-ad-studio` producer role — UI-tier only), L-13 (business top-up dead-end — billing not live), L-14 (`Editor` role option not in enum), L-15 (admin-status drift — diagnostics only), L-16 (`types.ts` drift — needs type regen). The remaining L-19 endpoints (`premiere-recap`, `gamification-event`, `landing-demo-chat`) are bounded; `process-ai-video-replies` was the highest-value one.

---

## Phase 2 — Functional & routing tests

Added `src/test/integration/route-component-integrity.test.tsx` (97 assertions, all green), running headless in vitest:

1. **Every route has a working component (per-route pass/fail):** parses all **81** `lazy(() => import())` route components from `App.tsx` and dynamically imports each, asserting the expected binding (default or named) resolves to a renderable component. A broken import path or missing/renamed export fails that route's test. This exercises the real module graph for every page.
2. **Redirect integrity:** every static `<Navigate to="…">` target resolves to a defined `<Route path>` (no dead redirects).
3. **No dead interactive elements:** scans all TSX (>100 files) for `href="#"`, empty `href`, and empty `onClick={() => {}}` — asserts none.

A canvas `getContext` stub is installed **file-locally** (Lobby → `lottie-web` needs it) without affecting the suites that assert the genuine no-canvas fallback (`videoLoading`).

This complements the pre-existing `route-smoke.test.tsx` and `navigationComprehensiveAudit.test.ts`.

**Coverage honesty:** a full browser click-through E2E (Playwright driving every button against a live backend) was **not** run — the sandbox cannot reliably boot the app against real Polar/Stripe/Supabase, and the constraints forbid live calls. The static + module-load integrity approach gives deterministic per-route pass/fail for "every route renders a real component, every redirect resolves, no dead links/handlers" without flaky backend dependencies.

---

## Not auto-fixed — flagged for human action

These were deliberately **not** forced, per the constraints (production-data repair / money-path / high regression risk that can't be headlessly verified). Each has a ready remediation path.

1. **C-1 production data backfill (REQUIRED before relying on balances).** The June-20 `finance_clear_and_seed` migration `TRUNCATE`d `credit_transactions` and seeded each user's prior balance only into `ledger_entries` (and `credit_transactions_archive`). The C-1 code revert restores the *mechanism* (reads/writes both on `credit_transactions`), but pre-June-20 opening balances are now stranded. **A reviewed data migration must re-insert those opening balances into `credit_transactions` (e.g. one `opening_balance` row per user from `profiles_credit_archive`/`ledger_entries`).** This mutates live balances → must be done by a human with DB access and verification. *(Flag, not performed.)*

2. **H-2 — cross-tenant credits/sensitive-column read.** The only real fix is at the grant/RLS layer (revoke `credits_balance`, `total_credits_*`, `suspension_reason`, `notification_settings`, `preferences` from the `authenticated`/`anon` column grant), but that breaks own-reads across ~12 sites — own-reads (`useCreditBilling`, `BillingSettings`, `Onboarding`, `NotificationSettings`, `AccountSettings`, `PreferencesSettings`, `sessionPersistence`, `ProfileDashboard`, `WelcomeOfferModal`, `zombieProcessWatcher`), a **public** page (`Profile.tsx`), and an **admin** page (`PeopleOverview.tsx`). It's money-adjacent and needs full-app runtime verification. **Ready plan:** revoke the sensitive columns; migrate own-reads to `get_my_profile()`/`profile_self`; route the public page through `profiles_public` (must exclude sensitive cols); route admin reads through `admin_profiles_by_ids`. Then verify own-balance + admin render in a running app.

3. **H-6 — org credit analytics are per-viewer, shown as pooled.** Needs an org-scoped `SECURITY DEFINER` RPC (or `organization_id` on `credit_transactions` + an org-member SELECT policy) and a rewrite of the bespoke aggregation in `BusinessCredits`/`BusinessBilling`/`BusinessOverview`. Touches a money-path schema decision → not guessed.

4. **H-8 — destructive finance wipe + unreachable archives.** `credit_transactions`/`patron_subscriptions` history was truncated; analytics under-report. Restoring from `*_archive` is a production data repair (decide retention vs. restore). *(Flag.)*

5. **H-9 — 100 fabricated users in production `auth.users`.** Removing them is a production data mutation (a `DELETE` migration would run on next deploy). Decide and execute under human supervision. *(Flag.)*

6. **M-6 — fragmented notification preferences (two UIs, disjoint tables/formats).** Needs a product decision on the canonical store before consolidating.

7. **M-7 — dead personal "auto-recharge" toggle.** Either build auto-recharge (a payment-method-on-file money feature — out of scope per "don't guess on money paths") or remove/relabel the toggle (product decision).

8. **M-10 — `log-widget-event` rate-limit keyed on attacker session.** Hardening (server-derived key + origin scoping) risks breaking the embedded customer widget; needs a design pass + staging verification.

9. **M-12 — `newsletter-subscribe` unauthenticated brand email.** Proper fix needs a client captcha integration (and/or durable per-IP rate limiting); a UI/infra change beyond a safe code edit.

---

## Commits (per issue, on `remediation/audit-fixes`)

```
C-1  fix(credits): revert accidental June-20 ledger repoint
C-2  fix(security): require service-role for send-transactional-email
C-3  fix(security): require service-role for svg-rasterize
H-3  fix(security): require service-role for send-push-notification
H-5  fix(credits): monthly_org_credit_refill passed NULL payment ref
H-1  fix(security): block org admin self-promotion to owner
H-4  fix(payments): eliminate double-payout race in stripe-connect-payout
H-7  fix(payments): org membership check + metadata key in create-org-checkout
M-1  fix(credits): hide business credit packs on personal surface
M-2  fix(payments): gate client-controlled Stripe env to local origins
M-3  fix(payments): reject Polar subscription with no credit mapping
M-5  fix(admin): use canonical $0.10/credit in pricing margin tool
M-8/9 fix(security): bound paid-LLM edge functions
M-11 fix(security): verify session ownership before revoke
M-13/L-18 fix(admin): align profit dashboard to $0.10 + guard div-zero
L-4/6/7/10 fix(ui): correct credit + achievement displays
L-17 test: stub VITE_SUPABASE_URL in test setup
L-19 fix(security): require cron secret for process-ai-video-replies
Phase2 test: route & interactive-element integrity audit
docs: add AUDIT_REPORT.md
```

---

## What remains (punch list)

- **Apply the C-1 data backfill (item #1) before trusting balances in production.** Highest priority.
- Land H-2, H-6 with full-app verification; decide H-8/H-9 data actions.
- Product decisions: M-6, M-7, M-10, M-12.
- Low cleanup batch (L-1/2/3/5/8/9/11/12/13/14/15/16) as capacity allows; `types.ts` regen (L-16) would remove the `as never`/`as any` casts.
- Consider a real Playwright click-through E2E once a stub-Supabase dev environment is available, to cover button-level behavior beyond the static integrity tests.
