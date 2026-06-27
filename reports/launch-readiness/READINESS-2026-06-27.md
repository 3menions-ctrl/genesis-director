# Small Bridges — Comprehensive Launch-Readiness Report
**Date:** 2026-06-27 · **Method:** 6 parallel evidence-backed audits (security, payments, DB/migrations, video pipeline, build/deploy, feature-completeness), each verified against source and — where possible — the live prod DB (`ywcwaumozoejierlfkgj`).

---

## Overall verdict: **READY-WITH-CAVEATS for a personal-tier soft launch — NOT READY for a clean full launch**

The core journey works (signup → onboarding → Studio → Production → real Replicate pipeline → film), the catastrophic data-rollback bugs are fixed, the security architecture is genuinely strong, and **prod schema == repo (415 migrations, 0 pending — verified live)**, so the RLS/money fixes are actually applied. What stands between you and a confident launch is a short list of **operational HIGH-risk items** and a set of **advertised-but-unbuilt features** that should be wired or hidden.

Per-dimension verdicts:

| Dimension | Verdict |
|---|---|
| Security / Auth | Ready-with-caveats |
| Payments — personal credits | Ready-with-caveats |
| Payments — business/org plans | **Not ready** (revenue path incomplete) |
| Database / migrations | Ready-with-caveats (prod==repo verified) |
| Video pipeline | Ready-with-caveats |
| Build / deploy / CI | Ready-with-caveats |
| Feature completeness / UX | Ready-with-caveats (leaning fragile) |

---

## 🔴 MUST-FIX BEFORE LAUNCH (HIGH / blocker-adjacent)

1. **Pipeline recovery cron is NOT running in prod.** Independently flagged by the pipeline AND feature audits; the feature audit verified against the live `cron.job` table — there is **no `pipeline-watchdog`, `admin-stuck-jobs-watchdog`, or `zombie-cleanup`** scheduled. A migration (`20260516045913`) unschedules them and nothing re-adds them. **Impact:** any lost Replicate webhook strands a paid project in `generating` forever with the credit hold never released. The only backstop is client-side `useClipRecovery` (needs the tab open). → Re-add a `cron.schedule` migration (or set it in the Supabase dashboard) and confirm it's live.

2. **`generate-video` is directly callable and charges zero credits.** Auth-guarded (any valid user JWT) but uncharged and unthrottled → a crafted direct call yields free, expensive Kling-V3 video. `supabase/functions/generate-video/index.ts:914`. → Gate with `ai-credit-gate`/hold or make it service-role-only.

3. **Final-film 24h signed-URL expiry (still open).** Stitched films are written as 24h signed URLs to the private `published-renders` bucket and played directly with no on-view re-sign (`seamless-stitcher` `SIGNED_URL_TTL`; `Production.tsx:455`). A successful film 404s a day later. → Re-sign on project load. (Mitigated for the common clips-fallback path, which writes durable URLs.)

4. **Four public storage buckets leak media.** `videos`, `final-videos`, `video-clips`, `scene-images` are still `public=true`; only `brand-assets` was privatized. Owner-scoped SELECT policies are therefore dead and objects are enumerable. → Privatize + serve via signed URLs. **Note the coupling:** the pipeline's clips-fallback currently *relies* on a public `video-clips` URL, so fix #3 and #4 together.

5. **Prod deploy is ungated.** Vercel's only gate is `typecheck && build` (`vercel.json:3`); it does **not** run unit tests, the `audit:edge-auth` check, or e2e. A test/edge-auth regression that still compiles ships straight to prod. CI `guard` is now actually green (the "lint reds it out" belief is stale — lint is `continue-on-error`), so it's ready to be promoted. → Make `ci.yml guard` a required status check on `main` + enable Vercel "wait for CI" (or move the checks into the Vercel build command).

---

## 🟠 DECIDE CONSCIOUSLY — revenue & promises (fix or remove copy)

6. **Business/org plans can't be bought or funded end-to-end.** `create-org-checkout` is Stripe (kill-switched); `polar-checkout` only maps personal price IDs → org plans 503; `organizations.plan` is never set on purchase; no UI triggers an org checkout. The downstream refill cron/plumbing is correct but no-ops with no funded org. **Fine only if business billing is explicitly out of launch scope** — but `BusinessStart`/`BusinessBilling` advertise paid tiers.

7. **Creator payouts: money in, never out.** `stripe-connect-payout` is complete but invoked from nowhere; UI only onboards, while Help promises "payouts land daily, $10 min." → Wire a withdraw action or remove the promise.

8. **Auto-recharge is a dead toggle.** Personal + org settings save the preference and toast "enabled," but nothing reads the threshold to charge. Balance can hit zero with it "on." → Wire or remove.

9. **OAuth copy without OAuth.** `Auth.tsx` claims "Apple/Google OAuth front and center" — there are no OAuth buttons and no `signInWithOAuth`; yet Settings renders "Link google/github/apple" buttons that error (no providers in `config.toml`). → Remove copy/affordances or enable providers.

10. **In-editor "Approve & Render" is a no-op** ("Rendering coming soon"; regenerate-take 400s). De-risked because the Editor is secondary (Studio→Production works), but it's in the nav. → Hide the editor render CTAs behind a flag.

---

## 🟡 HYGIENE / POST-LAUNCH (not blocking)

- **Repo≠prod schema drift (reverse):** `world_chat.image_url` + migration `20260706005000_world_chat_images` exist only in prod (applied via Management API). A fresh apply/staging clone won't reproduce prod. → Backfill the committed migration.
- **`types.ts` is stale** (10,256 lines; missing `world_chat`/`notification_preferences`/`creator_posts`; 269 `as never` casts). → Regenerate against prod.
- **Live pipeline runs permanently degraded:** `hollywood-pipeline` calls 19 helper edge fns that exist neither in repo nor prod (upscale, color-grade, lip-sync, continuity verify) — they fail silently. → Deploy or remove the dead calls.
- **Build hygiene:** two lockfiles (CI uses `bun.lock`, Vercel ships `npm`/`package-lock.json`) + no Node pin; loose `tsconfig` (`strictNullChecks`/`noImplicitAny` off) makes the typecheck gate shallow; eager 558 KB observability chunk on first paint; image `CacheFirst` 30-day TTL (rename-to-bust discipline).
- **Email suppression still wired to Lovable** (`handle-email-suppression` imports `@lovable.dev/webhooks-js`) — bounces/complaints never suppress. (Email *delivery* is fine: `process-email-queue` cron is live in prod.)
- **Sync AI-gate undercharge race** (charge-on-success with `project_id=null` dedupe gap) — provider-cost leak, not user-credit theft.
- **Dev-host admin auto-enable** (`ADMIN_ENABLED = … || import.meta.env.DEV`) exposes `/admin` UI on non-Vercel dev hosts (data still RLS-gated). Tighten for safety.
- Invisible backend-only scaffolding (atoms marketplace, premieres, patron-gated posts, webhook-registration UI, cinema invoice management) — safe to defer since unlinked.

---

## What's solid (so you know what NOT to worry about)
- **Auth gating** is gated-by-default (on the `feat/gate-app-by-default` branch) with no client bypass found; per-route guards retained for onboarding/admin.
- **Edge-function auth**: mature shared `auth-guard` (JWT validation, effective-user resolution, ownership checks, timing-safe service-role/cron compares) applied across the IDOR surface; webhooks (Polar, Replicate) verify signatures.
- **Credit ledger integrity**: `credit_transactions` is authoritative, `FOR UPDATE` row-locks serialize spend, idempotency keys prevent double-grants; fake-purchase trigger blocks non-Polar references.
- **Pipeline credit safety**: hold→consume→release with refund on failure; reconcile/expire crons ARE scheduled — a failed render does not permanently consume credits.
- **The three recently-broken pipeline blockers (Wan slug/input, stitcher ReferenceError, ffmpeg cog convention) are fixed in code.**
- **No secrets committed**; client uses only anon/publishable keys; admin build tree-shaken out of the public bundle.
- **PWA stale-cache problem is properly solved** (`updateViaCache:none` + periodic `reg.update()` + controlled reload).

---

## Recommended path to launch
1. Close the 5 red items (cron, generate-video gate, URL re-sign + bucket privatization, deploy gate). ~days, not weeks.
2. Decide business-billing scope; for personal launch, **remove** the payout/auto-recharge/OAuth promises rather than build them.
3. Soft-launch personal tier; treat hygiene items as fast-follows.
