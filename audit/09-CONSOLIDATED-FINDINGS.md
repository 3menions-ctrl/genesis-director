# 09 — Consolidated, Verified Findings & Fix Plan

> Supersedes the scattered raw reports for ACTION purposes. Merges pass 1 (00–07) + pass 2 (social, distribution, business/email, RLS sweep) + the independent verification & reconciliation pass. This is the definitive fix list.

## A. Verification verdicts on the original 8 fix-targets
(Independent re-read of the actual code. 7 CONFIRMED, 1 NEEDS-NUANCE, 0 false-positives.)

| # | Finding | Verdict | Decisive evidence |
|---|---|---|---|
| 1 | zombie-cleanup double-refund (2× credits) | ✅ CONFIRMED | `zombie-cleanup:493-501` explicit `'refund'` row + `'system_grant'` row inside `increment_credits`; both summed in `credit_ledger_total` |
| 2 | Clip lost on import (silent) | ✅ CONFIRMED | `upload-ingest.ts:362-365` swallow, still `addShot` + success toast at `:453` |
| 3 | continue-production IDOR | ✅ CONFIRMED | auth at `:113/133` but every query `.eq('id',projectId)` with no owner check |
| 4 | motion-transfer/stylize charge-but-nothing | ⚠️ NEEDS-NUANCE | credits deducted in **mode-router:379/492** (not the fns); poller `check-specialized-status` DOES read predictionId but **no webhook registered + failed branch `:461-473` issues NO refund**; version hashes suspicious-unverifiable |
| 5 | Orphaned Replicate predictions | ✅ CONFIRMED | `/cancel` only in delete-project:90, cancel-project:215, delete-clip:142 (all user-initiated); none on auto-failure |
| 6 | Watchdog double-disabled | ✅ CONFIRMED | kill-switch `:347` + migration `20260516045913` unschedules; no `cron.schedule` for any of the 3 watchdogs |
| 7 | Editor Approve&Render dead | ✅ CONFIRMED | `installJobRunner` defined `orchestrator:298`, **zero call sites** |
| 8 | 6 ungated OpenAI fns | ✅ CONFIRMED (all 6) | each calls gpt-4o-mini with auth-only, no reserve |

## B. NET-NEW findings pass 1 missed (this is why pass 2 mattered)

### Security (the risk lives in edge fns + storage, not the table layer)
- **🟠 HIGH — `seamless-stitcher` authenticated IDOR.** ⚠️ **CORRECTED:** the RLS-sweep agent called this a CRITICAL anon-unauth bug, but **direct verification shows `verify_jwt = true`** (config.toml:96-97) — anon is blocked at the gateway. The *real* bug is no **ownership** check: it reads `projectUserId` from the project (`:311`) and deducts *that owner's* credits via `deduct_credits(p_user_id: projectUserId)` (`:973`) + overwrites their `video_url`. So any **authenticated** user with someone else's `projectId` can spend the victim's credits and clobber their movie. HIGH IDOR, folds into the batch below — NOT a separate CRITICAL. (The pass-1 "no privileged-unauth fns" claim was *not* overturned by this item.)
- **🟠 HIGH — 19 service-role IDOR edge fns** (continue-production + seamless-stitcher, retry-failed-clip, final-assembly, render-video, generate-single-clip, generate-avatar-direct, generate-scene-images, hollywood-pipeline, seedance-pipeline, check-specialized-status, mode-router, auto-stitch-trigger, fix-manifest-audio, extract-scene-identity, comprehensive-clip-validator, check-video-status, extract-video-frame, generate-hls-playlist, generate-voice). Fix pattern exists in-repo: `generate-music:727` (`select user_id`, reject mismatch, skip if `auth.isServiceRole`).
- **🟠 HIGH — public-bucket gated-media leak.** `videos`, `final-videos`, `video-clips`, `scene-images` are `public=true`, so their owner-scoped SELECT policies are dead — content is enumerable.
- **🟠 HIGH — `log-widget-event` cost-amplification/DoS.** Public POST, throttle keyed on attacker-controlled `visitor_session`; drains widget owner credits (5/1000 views) + force-pauses competitor widgets. `widget_id` leaked by `get-widget-config`.
- **🟡 MEDIUM — OAuth tokens stored plaintext** in `*_encrypted`-named columns (oauth-callback, distribution-oauth-callback); `newsletter-subscribe` email-bombing (public, no captcha); api-v1 per-key **scopes unenforceable** (conflicting migrations dropped `scopes` column → org keys default full access).

### Money (creator monetization — untraced in pass 1)
- **🔴 tip double-charge / overdraft.** The **wired** path `tip_in_thread` (`Inbox.tsx:812`) has **no idempotency + no row lock** → double-click = double charge; concurrent = overdraft. The hardened idempotent `tip_reel` exists but is **orphaned** (safety built on the wrong RPC).
- **🔴 `pledge_patron` identical flaw** (PatronHubPage:200, ProfileDashboard:4351), now cron-magnified by recurring billing.
- **🟠 `patron_subscriptions FOR ALL` self-managed RLS** → a user can self-insert a sub row **without paying** = free patron perks.
- **🟠 `organizations.plan` is client-writable** (`BusinessStart.tsx:330`) → self-serve free plan upgrades. Org **seats unenforced** (`assign_org_seat`/`sync-org-seats` dead; invite path skips seat check).
- **🟠 Creators cannot withdraw** — earnings accrue, `stripe-connect-payout` exists, but no UI invokes it (90/10 payout promise undeliverable).
- **🟠 Admin Refunds page returns no real money; Coupons never reach the provider** (from prior-doc reconciliation — both HIGH; **corrects the pass-1 admin "0 BROKEN" claim**).

### Reliability / correctness
- **🔴 Email never delivers on a clean deploy** — durable queue (pgmq+DLQ) but **no committed `cron.schedule` drains `process-email-queue`**. Same root cause as the render reapers: **crons live out-of-repo in an un-committed `setup_*` tool.** Bounce-suppression also broken (`handle-email-suppression` still Lovable/Mailgun; `auth-email-hook` bypasses suppression).
- **🟠 RLS write-forgery:** `notifications` INSERT `WITH CHECK (true)` → forge notifications to anyone (phishing); `follows`/`direct_messages` direct-insert bypass gated RPCs (defeats blocklist); Lobby feed (`Lobby.tsx:127-131`) bypasses block enforcement.
- Prior-doc misses also flagged: AUDIT **H-8/H-9** (a destructive finance seed wiped prod history; 100 fabricated login-capable prod users), SECURITY **M2** SSRF DNS-rebinding, **S341** notification-settings column delivery never reads, BACKLOG **#22/#23** moderation black hole.

## C. Corrections to pass 1 (intellectual honesty)
1. **backend-contracts "no privileged-unauth fns" was WRONG** — `seamless-stitcher` is exactly that (CRITICAL).
2. **admin "0 BROKEN / all pages real" was OVERSTATED** — Refunds (no real money) + Coupons (never reach provider) are HIGH-broken.
3. **"tip idempotency fixed" (project memory) is misleading** — fixed on the *orphaned* `tip_reel`; the *wired* `tip_in_thread` is unprotected.

## D. Already-fixed-on-this-branch (don't re-fix; ~15 verified)
Profiles cross-tenant leak; org-pool Polar funding; org-refill ON CONFLICT guard; editor-role authz (m12); admin→owner self-escalation (H-1); push-spoofing (H-3); delete-clip over-refund; double-stitch race; frozen-ledger; movie_projects/universes/crew RLS lockdowns; account-type exclusivity; cross-org isolation. (`raw/verification.md`, `raw/rls-security.md`.)

## E. Definitive prioritized fix plan

### P0 — security & money, verified, mostly self-contained
- **P0-A** `seamless-stitcher` auth — add `validateAuth` + ownership/service-role guard (CRITICAL).
- **P0-B** The 19 IDOR fns — apply the `generate-music:727` ownership-check pattern (batch).
- **P0-C** Move gated buckets (`videos`/`final-videos`/`video-clips`/`scene-images`) to private + signed URLs (or enforce RLS) — **needs care, touches playback**; stage behind verification.
- **P0-D** `tip_in_thread` + `pledge_patron` — add idempotency key + `FOR UPDATE` row lock (or repoint UI to `tip_reel`).
- **P0-E** zombie-cleanup double-refund — remove the duplicate credit grant; make org-aware + idempotent (also blocks safely scheduling the reaper).
- **P0-F** `continue-production` IDOR (subset of P0-B but call out).
- **P0-G** `log-widget-event` — server-side rate-limit not keyed on client data + auth the widget_id.
- **P0-H** `organizations.plan` client-writable + `patron_subscriptions` self-insert — tighten RLS/triggers.
- **P0-I** Restore **Stripe billing kill-switch + route checkout to Polar** (your decision: Polar live).

### P1 — broken features / reliability
- Editor Approve&Render wiring (or honest gating); clip-lost-on-import rethrow; motion-transfer/stylize refund-on-fail + webhook (or hide modes); ungated OpenAI fns → add reserve; **commit the missing crons** (email queue + render reapers) — but only AFTER P0-E so the reaper doesn't double-refund; notifications forge / direct-insert RLS; bounce-suppression → Resend; creator withdraw UI; ghost-complete projects; preview≠export unify.

### P2 — debt
types.ts regen / 249 `as never`; `stripe_*`→Polar rename/doc; orphaned `breakout_pipeline` + `job-queue`; stale tests; error-message leaks; Turnstile/env; OAuth token encryption; admin Refunds/Coupons real wiring.

> **Cron caveat (systemic):** at least 3 critical cron-driven systems (render watchdogs, email queue, possibly org refill/patron renewals) have **no committed schedule** — they rely on an out-of-repo `setup_*` tool. Confirm in the Supabase dashboard what is actually scheduled; committing schedules without first fixing P0-E (double-refund) and the seat/plan holes would activate latent money bugs.
