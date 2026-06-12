# INCOMPLETE FEATURES / BROKEN PROMISES AUDIT

**Last refresh**: 2026-06-10
**Mode**: Apex Studio is currently in **beta — free**. There is no paid checkout flow and no OAuth providers. Both decisions are explicit (cost, scope) — when funds and integrations land, the relevant surfaces flip back on.

This document is the snapshot of what is shipped, what is intentionally turned off, and what is still incomplete. The previous version of this file (dated 2026-02-22) was retained in version control.

---

## Architectural changes since last revision

| Area | Before | Now |
|---|---|---|
| Auth providers | Email + password, Google OAuth, Apple OAuth (via `@lovable.dev/cloud-auth-js`) | **Email-only** — Supabase native. Google/Apple/lovable removed entirely. Magic-link sign-in available as a backup. |
| Payments | Stripe embedded checkout + customer portal, Cinema seconds tiers | **Removed.** Beta-free model: all new users get 100 starter credits via DB trigger. Credit ledger preserved internally. "Request more credits" form writes to `support_messages`. |
| Onboarding | `/start` mandated paid plan selection; `/onboarding` looped back to `/start` if no intent token | `/start` shows "Beta · Free" plan card and auto-selects. `/onboarding` marks complete and routes to welcome → projects. Loop closed. |
| Returning-user landing | `/create` | `/projects` (brand-new users still see `/welcome/checkout` celebration card once). |
| `WelcomeBackDialog` | Fired on every login | Only fires when `total_credits_used > 0`. New accounts skip it. |
| `WelcomeVideoModal` | Test-artifact video URL that didn't autoplay | Replaced with three sample prompts the user can copy. Skippable. |
| Empty states | Five hand-rolled variants across pages | One shared `<EmptyState />` primitive in `src/components/ui/empty-state.tsx`. Projects empty state uses it; sample prompts inline. |
| ErrorBoundary | "Something went wrong" with no escalation path | "Report this issue" button writes the stack to `support_messages`. Contact link kept. |
| `AppHeader` shim | Imported by 8 pages | Removed from Projects, Settings, Templates, Creators, Notifications, Avatars, Create, Profile, UserProfile. |
| Stale doc refs | `HelpCenter.tsx:175` referenced `/clips` and `/discover` | Replaced with `Gallery` and `Templates`. |
| Sitemap | 14-route hardcoded allowlist | Curated SEO config + auto-discovery from `App.tsx` (skips admin, dynamic, redirects, protected). 16 entries today. |
| Motion Transfer | Returned 501 hard-stub | Real Replicate-backed pipeline. Mode visible in UI. Credit deduction wired. |
| Webhooks (workspace) | "Coming soon" pill | Full CRUD + HMAC-signed `webhook-dispatch` edge function + delivery log. UI in `/workspace/api`. |
| Brand uploader | URL-only | Drag/drop + URL fallback. New `workspace-brand` storage bucket. New `workspace_brand_assets` table. |
| Drive / Notion integrations | "Coming soon" pill | OAuth architecture (`oauth-authorize` + `oauth-callback` edge functions). Secrets-pending; documented in `/docs/INTEGRATIONS_SETUP.md`. |
| Admin scaffold pages | 22 used the `AdminConsoleScaffold` placeholder | All 22 wired to real Supabase queries via the new `AdminConsoleV2` primitive. New migration adds backing tables (feature_flags, announcements, email_templates, gdpr_requests, support_macros, changelog_entries, experiments, refund_requests, webhook_endpoints, abuse_rules, db_backups_log, discount_coupons, avatar_catalog_entries, content_safety_rules, reconcile_jobs, custom_roles, workspace_integrations, workspace_brand_assets). |
| Lifecycle emails | Only admin notifications fired | `user_welcome` (after OTP verify), `render_complete` (after auto-stitch), `low_credits` (DB trigger crossing threshold) all wired. New `user-welcome` template. |
| Routes | Duplicate `/studio`, `/admin/audit`, `/admin/gallery` declarations | Deduped. Orphan pages `Gallery.tsx`, `UserProfile.tsx` restored to live routes (`/gallery`, `/user/:userId`, `/u/:userId`). |
| Open-redirect | `Auth.tsx` honored any `next` param | Same-origin allowlist (`/`-prefixed, no `//`). |
| Password reset | Forced re-login to `/auth` | Auto-routes to `/projects` with the already-established session. |
| `signOut` | Cleared two specific keys | Clears every `apex.*` key from both localStorage and sessionStorage. |

---

## What is still incomplete

These are explicitly off because of cost, scope, or a deliberate beta decision. Everything below is the next round of work.

### Pending (cost-gated)

1. **OAuth providers (Google / Apple)** — code path removed because (a) Apple Developer requires a $99/yr account and (b) Google's verified-app review is non-trivial. When the developer accounts exist, re-introducing email-as-default with optional OAuth buttons is straightforward — `signInWithMagicLink` already shows the pattern.
2. **Paid plans (Stripe)** — removed for the beta. When ready: restore `src/lib/stripe.ts` from git history, restore the original `Credits.tsx`, `BuyCreditsModal.tsx`, `WelcomeCheckout.tsx`, `WorkspaceBilling.tsx`, `PersonalSubscriptionCard.tsx`. The ledger plumbing in `credit_transactions` and the `discount_coupons` table both stayed intact.
3. **Enterprise tier (SSO/SAML, custom RBAC, audit export, dedicated support)** — scaffolded in the migration (`custom_roles`, `gdpr_requests`, etc.) but no edge function or UI yet. Originally Tier-4 work; deferred.

### Pending (scope)

4. **Agent persistent memory** — `agent_preferences.learned_context` column exists, no writer wired. Listed in tasks (T10).
5. **Some lifecycle emails** — `payment_failed`, `org_member_joined`, `org_role_changed`, `org_credits_low` templates exist in the registry; only the user-facing trio (`user_welcome`, `render_complete`, `low_credits`) is wired in this push.
6. **Help Center support inbox** — `Contact.tsx:67` tells users "Track replies in your Profile › Help & Support" but no such page exists; replies go to admin only.
7. **Workspace entitlement check** — `/workspace/*` is currently visible to any business-tier account regardless of paid status (moot during beta, but a hole when plans land).
8. **Mobile policy** — no gate, no warning, dense touch UX on `/create`.
9. **Test suite** — `src/test/signup-to-payment/*` and several other tests still reference Stripe / OAuth flows that no longer exist. They will fail until updated.

### Known low-impact gaps

10. **Sample prompts on empty `/projects`** — three prompts wired in `EmptyState.examples`. Could grow with telemetry on which prompt converts.
11. **`WelcomeBackDialog` Hoppy mascot** — kept (per user request "do not delete ideas"). Only shows for returning users now.
12. **`MockupPreview` at `/mockup`** — design-only viewer still bundled in initial chunk. Lazy-load opportunity.

---

## Stripe / OAuth removal — full file inventory

For when paid plans / OAuth come back, the files that need to be restored from version control or re-wired:

| File | Note |
|---|---|
| `src/lib/stripe.ts` | Deleted. |
| `src/integrations/lovable/` | Deleted. |
| `src/pages/Credits.tsx` | Rewritten — preserve current beta-free version under a feature flag, or restore from git. |
| `src/pages/WelcomeCheckout.tsx` | Rewritten. |
| `src/pages/workspace/WorkspaceBilling.tsx` | Rewritten. |
| `src/components/credits/BuyCreditsModal.tsx` | Rewritten (props preserved). |
| `src/components/settings/PersonalSubscriptionCard.tsx` | Rewritten. |
| `package.json` | Dropped `@stripe/react-stripe-js`, `@stripe/stripe-js`, `@lovable.dev/cloud-auth-js`. |
| `src/contexts/AuthContext.tsx` | `signInWithGoogle` / `signInWithApple` removed; `signInWithMagicLink` added. |
| `src/pages/Auth.tsx` + `StartOnboarding.tsx` | OAuth buttons removed; magic-link can be wired into either. |

---

## Migrations added in this push

| Migration | Purpose |
|---|---|
| `20260610011412_admin_console_tables.sql` | All new backing tables for the 22 admin-scaffold rewrites. |
| `20260610021553_beta_starter_credits.sql` | 100-credit grant trigger on profile creation + backfill. |
| `20260610023718_low_credits_notification.sql` | `low_credits` enum value + balance-watch trigger that emits one-shot notification + email. |

---

## What "make it make sense from the first click" looks like today

1. User clicks **Sign up** on `/auth`.
2. Email + password → 6-digit OTP code emailed.
3. Verifies OTP → `user_welcome` email fires → routed to `/onboarding` which auto-marks complete and lands them on `/welcome/checkout`.
4. `/welcome/checkout` shows the BETA · FREE celebration card with their starter balance, auto-routes to `/create?welcome=1` in 5 seconds (or click "Open the studio").
5. `/create` is the canvas. Three sample prompts on the empty state — pick one or write your own.
6. After generation: in-app notification + email via `render_complete` + the production page surfaces the final video.
7. Balance dips below 25 → automated `low_credits` notification + email with "Request more" link to `/credits`.
8. `/credits` shows balance + activity ledger + "Request more credits" form (writes to `support_messages` for manual top-up).

No card. No surprise charges. No dead "Coming soon" pills.
