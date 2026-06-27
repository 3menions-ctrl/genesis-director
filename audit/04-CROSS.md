# 04 — Cross-Surface Consistency

> How the three surfaces (iOS / web / admin) agree — or silently disagree — where they consume the same Supabase schema, edge-fn contracts, and auth model. Evidence cited from the per-surface traces and direct verification.

## 4.1 Auth / permission model — CONSISTENT

- **One Supabase GoTrue instance** serves all three surfaces (`src/integrations/supabase/client.ts`, same `VITE_SUPABASE_URL` baked into web, admin, and the iOS web bundle). iOS additionally persists the session in the **Keychain** (`01-IOS.md`); web/admin use `localStorage`.
- **Admin elevation is server-enforced and not bypassable.** `is_admin()` is `SECURITY DEFINER` over `user_roles`, EXECUTE revoked from anon; RLS on sensitive tables gates on `is_admin(auth.uid())`; every admin RPC self-guards and is REVOKEd from PUBLIC; all 6 admin edge fns re-verify admin server-side (`03-ADMIN.md`). The client `ProtectedRoute` only checks *session* (not admin) — but the real gate is one layer deeper and, crucially, the backend independently denies non-admins, so the cosmetic client gap leaks no data.
- **Edge-fn auth is convention-based but currently consistent.** 108/142 fns use the service-role key; ~89 self-authenticate via `_shared/auth-guard.ts` (`validateAuth`/`requireServiceRole`/`requireCronSecret`); the 14 `@public-endpoint` fns are rate-limited/abuse-guarded (`04`/`backend-contracts`). No genuinely privileged-unauth fn was found — but the defense is a convention each author must remember (the `send-push-notification` "AUDIT FIX H-3" comment shows the class has bitten before). **This is the most fragile shared contract.**

## 4.2 Schema / type contract — DRIFTED (silent-break risk)

- **`types.ts` is the shared client type contract** for web + admin + iOS, generated from the DB. It is **10,256 lines / 166 tables** but **drifts from the 387 migrations**:
  - `notification_preferences` exists in migrations but is **absent from `types.ts`** → forced `as never` casts (`useNotifications.ts:140`, `NotificationSettings.tsx:111,156`). `free_tier_attempts` also missing.
  - **249 `as never` casts across `src/`** — each is a place the compiler has been told to stop checking the schema contract. Every one is a latent runtime break if the column shape differs from the cast assumption. This affects all three surfaces equally (shared file).
- **Naming trap: `stripe_*` columns hold Polar values.** 64+ refs to `stripe_payment_id` etc. The column name lies about the provider. Any engineer (or surface) reading the schema cold will misattribute data. Pure documentation/contract debt, but high-confusion.

## 4.3 Billing contract — INCONSISTENT & CONTRADICTS INTENDED STATE (verified)

This is the most important cross-surface finding and it was **verified directly**, not taken from memory:

- **The "Stripe billing locked" kill-switch is NOT on this branch.** `src/lib/stripe-lock.ts` **does not exist** on `full-audit`/`main` (verified: `ls` → no such file; zero `stripe-lock`/`STRIPE_BILLING_LOCKED` references anywhere in `src/` or `supabase/`). Project memory's claim that Stripe billing is disabled via a reversible kill-switch (PR #110) is **false for this branch** — that PR is not merged here.
- **Two live billing paths coexist with different org-pool behavior:**
  - **Stripe path** — `create-plan-checkout`, `create-org-checkout`, `create-credit-checkout` all instantiate `createStripeClient` (`_shared/stripe.ts`) and create Stripe checkout sessions. `Pricing.tsx:50` routes plan CTAs through `create-plan-checkout`. The webhook `payments-webhook` → `_shared/stripe-webhook-handler.ts` runs in **`"sandbox"`** mode and **never funds the org credit pool** (`stripe-webhook-handler.ts:113-188`). → **Org subscriptions purchased via the Stripe path land unfunded.**
  - **Polar path** — `polar-checkout` / `polar-webhook` correctly early-returns org orders and funds the pool via `monthly_org_credit_refill` → `topup_org_credits` (`02-WEB §D`).
- **Net contract risk:** the iOS, web, and admin surfaces all *read* org credit balance from the same pool, but **whether that pool gets funded depends on which checkout path the buyer was routed through** — and the front end has wrappers for both (`src/lib/payments/stripe.ts` and `src/lib/payments/polar.ts`). The org-refill also silently no-funds if `organizations.plan` is unset and nothing in code sets it (`02-WEB §D`).
- **ACTION (must confirm before ship):** determine which provider is actually live in the production env, and either (a) restore the Stripe kill-switch and route all billing through Polar, or (b) add org-pool funding to the Stripe webhook. **Do not assume Stripe is locked — on this branch it is not.**

## 4.4 Feature parity across surfaces

| Capability | Web | Admin | iOS | Intentional? |
|---|---|---|---|---|
| Full editor / render trigger | yes (but Approve&Render BROKEN, `02-WEB §D`) | n/a | **no** — iOS is feed/discover/create-lite/spend-only | Yes — iOS is deliberately consumption + spend-only |
| Purchase credits / subscribe | yes (Stripe+Polar) | n/a | **no — hard-blocked** (`PURCHASING_ENABLED=false`, `startCreditCheckout()` throws, `01-IOS.md`) | Yes — App Store policy (spend-only) |
| `/feed` vertical video screen | route exists in App.tsx route list, but the native feed UX is the iOS build's headline | n/a | **yes (headline feature)** | iOS-first; web has the route |
| Live (P2P WebRTC) | route `/live` | n/a | yes, but **`live_rooms` migration unapplied + P2P-mesh-no-SFU** (`01-IOS.md`) | Gap, not intentional |
| Push notifications | Web Push/VAPID only | n/a | **client writes APNs tokens but no APNs sender + `device_push_tokens` table never migrated** (`01-IOS.md`) | **Gap — broken end-to-end on iOS** |
| Admin console | n/a | yes (full) | n/a | Yes |

**Gaps that are NOT intentional:** iOS push (no APNs path, unmigrated table), iOS Live (unapplied migration, no SFU), and the `comment_count`-always-0 select bug on iOS feed.

## 4.5 Playback contract divergence (within web, but a cross-*engine* break)

Not a surface-to-surface issue but a contract divergence worth flagging here because it affects what every surface *shows* vs what the server *bakes*: the app runs **three client playback engines + one server bake that are not the same path** (`02-WEB §B`): `BrandedVideoPlayer` (hls.js, final), `StitchedPlayer` (editor preview, 320ms fixed crossfade), `TimelinePlayer` (render-free preview), and `seamless-stitcher` (Replicate FFmpeg, 0.4s authored crossfade + loudnorm). **Preview ≠ export** is a real, high-likelihood divergence. iOS feed playback adds a *fourth* consumption path (native HLS + hls.js fallback). Any future "what you see is what you render" guarantee is currently false.

## 4.6 Summary of riskiest cross-surface boundaries

1. **Billing provider ambiguity / unfunded org pool via Stripe** (§4.3) — verified, high severity, money-correctness.
2. **`types.ts` drift + 249 `as never` casts** (§4.2) — shared by all surfaces; silent runtime breaks.
3. **Convention-based edge-fn auth** (§4.1) — one forgotten guard = privileged-unauth regression (has happened).
4. **iOS push/Live depend on unapplied migrations** (§4.4) — surface ships, backend isn't there → 400s.
5. **Preview vs export playback divergence** (§4.5) — four media paths, no single source of truth.
