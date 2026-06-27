# Genesis Director — Backend Contract Map

Branch: `full-audit`. READ-ONLY audit. Backend = single Supabase project shared by all
three surfaces (iOS / web / admin).

- Edge functions: **142** non-shared dirs under `supabase/functions/` (the brief's "146"
  counts `_shared` + helper dirs).
- SQL migrations: **387** in `supabase/migrations/`.
- Config: `supabase/config.toml` (160 lines) — only ~60 functions get an explicit
  `[functions.*] verify_jwt` entry; the rest **default to `verify_jwt = true`** (Supabase
  gateway default).
- Frontend bridge: `src/integrations/supabase/client.ts` (one project, anon/publishable key,
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`).
- Generated types: `src/integrations/supabase/types.ts` — 10,256 lines, **166 tables** in the
  `Tables:` block (lines 16–8655), plus Views (8656), Functions (8995), Enums (10007/10195).

---

## 1. EDGE FUNCTION INVENTORY (by domain)

### Auth model (the key finding for this section)
The gateway `verify_jwt` flag is **mostly irrelevant** here: ~60 functions explicitly set
`verify_jwt = false` in `config.toml`, but they **self-authenticate in-code** via shared
helpers in `supabase/functions/_shared/auth-guard.ts`:

- `validateAuth(req)` — used by **89** functions. Accepts a user JWT (validates via
  `getUser(token)` against the anon client) **or** the service-role key for internal
  function-to-function calls (`auth-guard.ts:24-61`). Returns `{authenticated, userId,
  isServiceRole}`.
- `requireServiceRole(req)` — constant-time bearer compare vs `SUPABASE_SERVICE_ROLE_KEY`
  (`auth-guard.ts:161-169`). Internal-only trust boundary.
- `requireCronSecret(req)` — `x-cron-secret` == `CRON_SHARED_SECRET` OR service-role bearer
  (`auth-guard.ts:140-153`).
- `verifyReplicateSignature` / `verifyPolarWebhook` — HMAC signature verification for webhooks.
- `_shared/abuse-guard.ts` (`checkAbuse`) and `_shared/rate-limiter.ts` (`checkRateLimitDb`,
  `extractClientIp`) — for deliberately public endpoints.
- **14** functions are explicitly annotated `// @public-endpoint` (intentionally unauth,
  scope-restricted + rate-limited).

Privilege tally: **108 / 142** functions read `SUPABASE_SERVICE_ROLE_KEY` (they run with full
RLS bypass). **18** call `getUser` directly; **89** call `validateAuth`.

| Domain | Functions (representative) | JWT posture | Privilege |
|---|---|---|---|
| **Generation / AI** | generate-video, generate-single-clip, generate-script, generate-story, generate-scene-images, generate-music, generate-voice, generate-avatar-*, hollywood-pipeline, seedance-pipeline, mode-router, director-chat, script-assistant, smart-script-generator, studio-image, edit-photo, inpaint-photo, motion-transfer, stylize-video, translate-text, hoppy-chat | `verify_jwt=false` + `validateAuth` (user-or-service). `translate-text`/`landing-*` = public + rate-limited | service-role |
| **Render / pipeline** | render-video, final-assembly, seamless-stitcher, auto-stitch-trigger, continue-production, resume-pipeline, resume-avatar-pipeline, poll-replicate-prediction, job-queue, pipeline-watchdog, retry-failed-clip, regenerate-audio, fix-manifest-audio, svg-rasterize, generate-hls-playlist, sync-music-to-scenes, zombie-cleanup, reconcile-credit-holds | mix of `validateAuth` (user-triggered) and `requireServiceRole`/`requireCronSecret` (internal pollers/watchdogs). `seamless-stitcher`+`send-transactional-email`+`process-email-queue` are `verify_jwt=true` | service-role |
| **Billing / credits** | reserve-credits, monthly-credit-refill, reconcile-credit-holds, free-tier-generate, polar-checkout, polar-portal, polar-webhook, payments-webhook, create-{credit,plan,org,cinema}-checkout, create-portal-session, verify-cinema-checkout, list-cinema-invoices, get-cinema-pending-change, sync-org-seats | checkout/portal = `getUser`; refill = `requireCronSecret`; reconcile = `requireServiceRole`; webhooks = signature; free-tier = `checkAbuse` | service-role |
| **Auth / OAuth** | oauth-authorize, oauth-callback, auth-email-hook, manage-sessions, revoke-demo-sessions, update-user-email, delete-user-account, export-user-data, verify-org-domain | authorize=`validateAuth`; callback=state secret (`OAUTH_STATE_SECRET`); email-hook=`SEND_EMAIL_HOOK_SECRET` | service-role |
| **Admin** | admin-analytics, admin-user-action, admin-delete-auth-user, admin-force-logout, admin-stuck-jobs-watchdog, admin-alert-dispatch, production-audit, replicate-audit, cleanup-analytics, seed-avatar-* | `validateAuth` + in-code admin check, OR `requireServiceRole` (alert-dispatch, watchdog, production-audit) | service-role |
| **Email / lifecycle** | send-transactional-email (`verify_jwt=true`), preview-transactional-email, process-email-queue (`verify_jwt=true`), handle-email-unsubscribe (token), handle-email-suppression (Resend webhook), newsletter-subscribe (public), track-signup | service-role + RESEND_API_KEY | service-role |
| **Distribution / social** | distribution-manage, distribution-oauth-callback, mint-project-share, premiere-recap (`@public`), process-ai-video-replies (cron), gamification-event, notify-org-event, send-push-notification | manage=`validateAuth`; recap=public read-only; replies/push=`requireCronSecret`/`requireServiceRole` | service-role |
| **Media** | generate-upload-url, extract-video-frame, extract-scene-identity, brand-video-download, export-workspace-report, composite-character, generate-project-thumbnail/trailer | `validateAuth` | service-role |
| **Public API** | api-v1 (`x-api-key` → sha256 → `api_keys`), api-keys-manage (user JWT) | api-key / JWT, NOT Supabase-JWT gateway | service-role |
| **Widget (embeddable)** | get-widget-config, log-widget-event, generate-widget-config | `@public-endpoint` + IP/session rate-limit | service-role |
| **Landing / demo** | landing-demo-chat, landing-preview, landing-stats, check-secrets-status, health | public + rate-limited | mixed |
| **Payouts (Stripe Connect)** | stripe-connect-onboard, stripe-connect-payout | `validateAuth` | service-role |

### Privileged-but-unauthenticated check
I cross-referenced the 108 service-role functions against the 107 that self-auth
(`validateAuth` ∪ `getUser`), then manually verified the 31-function delta. **Every one has an
alternate gate** — no genuinely unguarded privileged function was found in sampling:

- Webhooks (signature): `polar-webhook:213-217`, `replicate-webhook:44-47`, `payments-webhook`,
  `handle-email-suppression`, `auth-email-hook` (`SEND_EMAIL_HOOK_SECRET`).
- Service-role/cron internal: `monthly-credit-refill:8` (`requireCronSecret`),
  `reconcile-credit-holds:27` (`requireServiceRole`), `poll-replicate-prediction:41`,
  `production-audit:124`, `admin-alert-dispatch:91`, `process-ai-video-replies:227`,
  `send-push-notification:37` (`requireServiceRole`), `svg-rasterize`, `seamless-stitcher`.
- API-key: `api-v1` (`x-api-key` sha256), `api-keys-manage` (user JWT, `:34-47`).
- OAuth state: `oauth-callback`, `distribution-oauth-callback`.
- Deliberately public (`@public-endpoint`) + rate-limited: `landing-*`, `get-widget-config`,
  `log-widget-event`, `newsletter-subscribe`, `translate-text`, `premiere-recap`.

**Notable historical fix:** `send-push-notification:32-42` carries an "AUDIT FIX H-3 (High)"
comment — it formerly used service-role + trusted a body `userId` with no auth, allowing
brand-spoofed push to any user. Now gated by `requireServiceRole`. This shows the privileged-
unauth class was a *known, remediated* risk pattern on earlier branches.

---

## 2. DATABASE / SCHEMA

### Core tables the surfaces depend on (from `types.ts` + migrations)
- **Identity/org:** `profiles`, `organizations`, `organization_members`, `organization_invites`,
  `org_seats`, `org_domains`, `org_api_keys`, `org_credit_refills`, `org_spend_events`,
  `org_notification_prefs`, `org_plan_features`.
- **Projects/media:** `movie_projects` (primary project table), `genesis_*` family
  (`genesis_scenes`, `genesis_scene_clips`, `genesis_videos`, `genesis_final_assembly`,
  `genesis_screenplay`, `genesis_characters`/castings/appearances, `genesis_continuity_anchors`),
  `characters`, `project_characters`, `project_shares`, `project_comments`, `published_reels`,
  `reel_branches`.
- **Credits/billing:** `credit_transactions`, `credit_holds`, `credit_packages`,
  `production_credit_phases`, `cinema_usage_ledger`, `pricing_config`, `discount_coupons`,
  `patron_subscriptions`, `reconcile_jobs`.
- **Social/notify:** `follows`, `notifications`, `push_subscriptions`, `direct_messages`,
  `conversations`, `chat_messages`.
- **API/keys:** `api_keys`, `api_usage_logs`, `api_cost_logs`.
- **Admin:** `admin_audit_log`, `admin_impersonation_sessions`, `banned_accounts`,
  `feature_flags`, `announcements`.

### Legacy `stripe_*` columns holding Polar values
Confirmed (memory: payments provider = Polar; columns legacy-named). In migrations the
`stripe_`-named columns are: `stripe_payment_id` (×64 refs), `stripe_price_id` (×6),
`stripe_subscription_id`, `stripe_customer_id`, `stripe_id`, `stripe_payout_id`,
`stripe_refund_id`, `stripe_coupon_id`, `stripe_account_id`, `stripe_event`. All also present
in `types.ts`. **Contract trap:** any surface reading `stripe_subscription_id` /
`stripe_customer_id` is actually reading a Polar id (`polar_…`) — the column name lies. Only
`stripe_connect_*` (payouts) is genuinely Stripe.

### types.ts DRIFT (quantified)
- `types.ts` Tables block = **166 tables**.
- **`notification_preferences`**: exists in migrations (1 file) but **absent from `types.ts`**
  (`grep notification_preferences: types.ts` = 0). Frontend works around it with
  `as never` casts: `src/hooks/useNotifications.ts:140` (`.from('notification_preferences' as
  never)`) and `src/pages/account/NotificationSettings.tsx:111,156`. This is the documented
  untyped table.
- **`free_tier_attempts`**: written by `free-tier-generate` (`free_tier_attempts` insert) and
  defined in a migration, but **absent from `types.ts`** (edge-only, so lower impact).
- Spot-checks that ARE present: `org_credit_refills`, `cinema_usage_ledger`, `reconcile_jobs`,
  `push_subscriptions` all = 1 in types.ts.
- Whole-codebase `as never` casts: **249** occurrences in `src/` — a strong signal of ongoing
  generated-types drift (each cast is a place where the type contract is bypassed). Matches the
  project-memory "~2,800-line types.ts drift / notification_preferences untyped" note.

**Drift verdict:** real but localized — at least 2 migration tables are missing from the
generated types, and 249 `as never` escape hatches paper over the gap. The single user-facing
broken-typing surface is `notification_preferences`.

---

## 3. RLS / AUTH MODEL

### profiles cross-tenant leak — VERDICT: FIXED on this branch
Project memory flagged `profiles.email`/`credits` readable cross-org. On `full-audit` this is
closed by a sequence of migrations:

- `20260704002600_profiles_cross_user_leak_fix.sql` — **drops** the permissive
  `"Public profile read" USING (true)` policy; replaces with own-row (`id = auth.uid()`),
  admin, and **org-co-member** (`shares_org_with(id)`, SECURITY DEFINER) SELECT policies; moves
  public display to a SECURITY-DEFINER `profiles_public` view.
- `20260705000200_profiles_sensitive_column_lockdown.sql` — **REVOKEs** `SELECT` on
  `credits_balance, total_credits_purchased, total_credits_used, role, suspended_at,
  suspension_reason, deactivated_at, deactivation_reason` from `anon` AND `authenticated`
  (the earlier email grant had "deferred" these). Owner reads via `get_my_profile()` /
  `profile_self` SECURITY DEFINER; admin via `admin_get_user_detail` / `admin_profiles_by_ids`.
  Includes a **regression guard** that fails the migration if any sensitive column is re-granted.
- Supporting: `20260703000000_profiles_email_containment.sql`,
  `20260703010000_profiles_email_table_grant.sql`, `20260703020000_profile_self_definer.sql`,
  `20260620010000_search_no_email_richer_people.sql`.

So as of this branch: email and financial/moderation columns are **no longer cross-tenant
readable**; remaining cross-user reads are scoped to org co-members (intentional team UI) and
admin RPCs. `security_version` is intentionally left granted (force-logout support).

### Auth model consistency
**Single Supabase project for all three surfaces** — `client.ts` uses one
`VITE_SUPABASE_URL`/publishable key; admin (`src/refine`, `/admin/*`) and iOS (Capacitor) hit
the same project + same edge functions. There is no second project. RLS bypass is concentrated
in the 108 service-role edge functions, which are the de-facto authorization layer (RLS on
base tables is locked down; reads/writes route through SECURITY DEFINER RPCs and self-authing
functions).

---

## 4. ENV / CONFIG CONTRACT

`.env.example` documents only the **frontend (VITE_)** shape. Backend secrets are set via
`supabase secrets set` and are intentionally NOT in `.env.example`.

### Frontend VITE vars
**Documented in `.env.example`:** `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PAYMENTS_PROVIDER`, `VITE_PAYMENTS_CLIENT_TOKEN`,
`VITE_LANDING_ASSET_BASE`, `VITE_DIAGNOSTICS_MODE`, `VITE_GLITCHTIP_DSN`, `VITE_POSTHOG_KEY`,
`VITE_POSTHOG_HOST`, `VITE_TURNSTILE_SITE_KEY`.

**Referenced in `src/` (actual usage):** `VITE_SUPABASE_PROJECT_ID`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_PAYMENTS_PROVIDER`,
`VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_POSTHOG_REPLAY`, `VITE_GLITCHTIP_DSN`,
`VITE_ADMIN`, `VITE_DISABLE_STRICT`, plus `import.meta.env.DEV/PROD`.

- **Referenced-but-UNDOCUMENTED:** `VITE_ADMIN`, `VITE_DISABLE_STRICT`, `VITE_POSTHOG_REPLAY`
  (none in `.env.example`). `VITE_ADMIN` is contract-relevant — it likely toggles the admin
  surface build and is undocumented.
- **Documented-but-UNUSED** (0 refs in `src/`): `VITE_PAYMENTS_CLIENT_TOKEN`,
  `VITE_LANDING_ASSET_BASE`, `VITE_DIAGNOSTICS_MODE`, `VITE_TURNSTILE_SITE_KEY`. (Turnstile is
  documented for bot-protection but not wired in the client — a gap if launch assumes captcha.)

### Backend (`Deno.env.get`) — most-referenced
`SUPABASE_URL` (160), `SUPABASE_SERVICE_ROLE_KEY` (135), `REPLICATE_API_KEY` (43),
`SUPABASE_ANON_KEY` (26), `LOVABLE_API_KEY` (18 — legacy AI proxy still referenced),
`PUBLIC_SITE_URL` (14), `OPENAI_API_KEY` (12), `ELEVENLABS_API_KEY` (4), `RESEND_API_KEY` (2),
`POLAR_SERVER` (2), `OAUTH_STATE_SECRET` (2). Singletons: `POLAR_ACCESS_TOKEN`,
`POLAR_WEBHOOK_SECRET`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `PAYMENTS_LIVE_WEBHOOK_SECRET`,
`REPLICATE_WEBHOOK_SECRET`, `STRIPE_SANDBOX_SECRET_KEY`, `SEND_EMAIL_HOOK_SECRET`,
`CRON_SHARED_SECRET`, `SEED_BYPASS_TOKEN`, `VAPID_PUBLIC_KEY`/`PRIVATE_KEY`/`SUBJECT`,
`OLLAMA_URL`/`MODEL`, `ADMIN_SLACK_WEBHOOK_URL`, `ADMIN_DISCORD_WEBHOOK_URL`.

### Required external services
Replicate (video/image gen + webhooks), ElevenLabs (music/SFX/voice), OpenAI (script/chat),
**Lovable AI proxy** (`LOVABLE_API_KEY`, 18 refs — still a live dependency despite the
email-Resend migration), Polar (billing/checkout/portal/webhook), Stripe (Connect payouts
only + a sandbox key), Resend (transactional email), GlitchTip/Sentry (observability),
PostHog (analytics), VAPID/web-push (notifications), optional Ollama (local model proxy).

**Env-contract gap:** there is **no `.env.example` for backend secrets** — the full set of
~30 `Deno.env.get` keys is undocumented except as a prose comment in `.env.example` for Polar.
A missing `CRON_SHARED_SECRET`, `OAUTH_STATE_SECRET`, or a webhook secret would silently 401
crons/webhooks with no schema to validate against.

---

## 5. CROSS-SURFACE EVENT / CONTRACT FORMATS

- **Push notifications** (`send-push-notification`): internal dispatch worker, `requireServiceRole`,
  payload `{userId, title, body, url}`, web-push/VAPID. Subscriptions stored in
  `push_subscriptions`. No version field.
- **Polar webhook** (`polar-webhook:213`): HMAC via `verifyPolarWebhook` (`POLAR_WEBHOOK_SECRET`),
  401 on bad sig. `verify_jwt=false` (correct — external caller). Funds org pool / profile credits
  (recent commits e9062618/75c11936 fixed org-pool funding + concurrent-refill TOCTOU).
- **Replicate webhook** (`replicate-webhook:44`): standard-webhooks HMAC-SHA256 over
  `${id}.${timestamp}.${body}`, 5-min tolerance (`auth-guard.ts` verifyReplicateSignature).
- **payments-webhook**: legacy/dual path (`PAYMENTS_{SANDBOX,LIVE}_WEBHOOK_SECRET`); note
  Stripe billing is killed via reversible switch (memory) — Polar is the live path.
- **webhook-dispatch**: outbound webhook delivery worker (service-role).
- **Public API** (`api-v1`): auth via `x-api-key: apx_live_…` (or `Authorization: Bearer
  apx_live_…`), sha256-hashed lookup in `api_keys`; Supabase-JWT explicitly disabled
  (`api-v1/index.ts:5-11`). Scoped via `hasScope`/`requiredScopeForRequest` + DB rate-limit
  (`rate-limiter.ts`). **This is the only versioned surface** — path-prefixed `v1`. Keys managed
  by `api-keys-manage` (user-JWT scoped). No `v2`; versioning is name-only, not header-negotiated.

---

## CONTRACT MAP — riskiest boundaries (rated, with evidence)

| # | Boundary | Risk | Evidence | Rating |
|---|---|---|---|---|
| 1 | **`notification_preferences` untyped** — table in DB, missing from `types.ts`; all 3 surfaces must cast `as never` to read/write notification settings. A schema change won't be caught at compile time. | Silent breakage of notification settings across web/iOS | `types.ts` grep = 0; `useNotifications.ts:140`, `NotificationSettings.tsx:111,156`; migrations=1 | **HIGH** |
| 2 | **Legacy `stripe_*` columns hold Polar ids** — `stripe_customer_id`/`stripe_subscription_id`/`stripe_payment_id` actually carry `polar_…` values. Any surface or future dev treating them as Stripe ids will mis-integrate. | Billing data misread; wrong-provider API calls | 64+ `stripe_payment_id` refs in migrations; columns in types.ts; memory `payments-provider-polar` | **HIGH** |
| 3 | **types.ts drift / 249 `as never` casts** — broad generated-types staleness; ≥2 migration tables (`notification_preferences`, `free_tier_attempts`) absent. Each cast bypasses the contract. | Type-safety erosion; runtime errors not caught in CI | 249 `as never` in `src/`; missing-table grep | **HIGH** |
| 4 | **Undocumented backend env contract** — ~30 `Deno.env.get` secrets with no `.env.example`/schema; `CRON_SHARED_SECRET`/`OAUTH_STATE_SECRET`/webhook secrets silently 401 if unset. Plus undocumented frontend `VITE_ADMIN`/`VITE_DISABLE_STRICT`. | Deploy-time misconfig → crons/webhooks silently dead | `.env.example` (frontend only); env grep | **MEDIUM-HIGH** |
| 5 | **Privileged-unauth class (mitigated)** — 108 service-role functions; gateway `verify_jwt=false` on ~60. Security rests entirely on in-code `validateAuth`/`requireServiceRole`/`requireCronSecret`/signature/abuse-guard. One missing guard = full RLS bypass. The `send-push-notification` H-3 fix shows this class has bitten before. | Any un-guarded privileged fn = IDOR / RLS bypass / spoofing | `auth-guard.ts`; `send-push-notification:32-42` (AUDIT FIX H-3) | **MEDIUM** (well-defended on this branch, but fragile-by-convention) |
| 6 | **profiles cross-tenant leak** | **CLOSED on `full-audit`** — policy drop + sensitive-column REVOKE + regression guard | `20260704002600_*`, `20260705000200_*` | **LOW (resolved)** |
| 7 | **Turnstile documented, not wired** — `VITE_TURNSTILE_SITE_KEY` in `.env.example`, 0 client refs; public endpoints rely on DB rate-limit/abuse-guard only. | No captcha on public/abuse surfaces despite config implying one | grep 0 files; `.env.example` | **MEDIUM** |
| 8 | **Lovable AI proxy still a live dependency** — `LOVABLE_API_KEY` 18 refs in functions despite "moved off Lovable proxy" (email only). Generation paths still route through it. | Third-party single point of failure for generation | env grep | **MEDIUM** |

### Summary verdict
The backend is a **single Supabase project** acting as the shared contract for all three
surfaces, with a **mature, layered, convention-based auth model** (gateway JWT mostly off,
enforced in-code). The headline risks are **data-contract drift** (untyped
`notification_preferences`, 249 `as never` casts, misleading `stripe_*` column names) and
**undocumented env**, not active RLS holes — the previously-flagged profiles leak is fixed on
this branch with a regression guard. The privileged-unauth surface is large but defended; its
risk is fragility (one forgotten `requireServiceRole` = full bypass), evidenced by the prior
H-3 push-spoof fix.
