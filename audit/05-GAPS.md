# 05 — Gap & Debt Inventory (prioritized by what blocks shipping)

> Ordered P0 (blocks ship / loses money or data) → P1 (broken feature, ship-degrading) → P2 (debt/cleanup). Each item cites the surface and the evidence file. "Confirm" items are UNVERIFIED and must be checked first.

## P0 — Ship blockers (money, data loss, or false-complete)

| # | Surface | Gap | Evidence |
|---|---|---|---|
| P0-1 | **CONFIRM FIRST** — backend | **Are the render reapers cron'd anywhere?** `pipeline-watchdog` is kill-switched off (`:347`) + unscheduled (`20260516045913`); `zombie-cleanup` + `admin-stuck-jobs-watchdog` have no in-repo cron. If not scheduled out-of-band, stuck renders never recover. | `07-RISKS R2`, `02-WEB §A` |
| P0-2 | backend / billing | **Billing provider ambiguity + unfunded org pool.** `stripe-lock.ts` does NOT exist on this branch (memory wrong); Stripe checkout fns are wired & `Pricing.tsx` routes through them; Stripe webhook is in `"sandbox"` mode and **never funds the org pool**. Confirm live provider, then either restore the lock + route all billing to Polar, or add org-pool funding to the Stripe webhook. | `04-CROSS §4.3` (verified) |
| P0-3 | web / billing | **`zombie-cleanup` double-refunds → 2× spendable credits** (inserts `refund` AND `increment_credits`/`system_grant`); non-org-aware, non-hold-aware. Fix before any reaper is scheduled (P0-1). | `02-WEB §D`, `07-RISKS R9` |
| P0-4 | web / generation | **motion-transfer & stylize-video charge credits, post to Replicate with placeholder version hashes, never poll → user pays, gets nothing, no refund.** composite-character → 422. Either fix the model wiring + webhook or hide the modes. | `02-WEB §C`, `07-RISKS R8` |
| P0-5 | backend / cost | **Orphaned Replicate predictions on every auto-failure/timeout** (cancel only on user delete). Add `/cancel` to all failure/timeout paths. Prior credit-exhaustion incident in code. | `07-RISKS R1` |
| P0-6 | web / editor | **Editor "Approve & Render" is dead.** `installJobRunner()` is never called; both CTAs gated to a disabled "Rendering coming soon" stub. The primary editor output action does nothing. | `02-WEB §D` |
| P0-7 | web / editor | **Clip silently lost on file-drop import** — `video_clips` insert failure is swallowed (`upload-ingest.ts:362`), success toast still fires, orphaned bucket object, never in `/library`. | `02-WEB §C`, `07-RISKS R7` |
| P0-8 | web / security | **`continue-production` IDOR** — authed but no ownership check, reachable with a user JWT. | `02-WEB §D` |

## P1 — Broken/degraded features (ship-degrading, not catastrophic)

| # | Surface | Gap | Evidence |
|---|---|---|---|
| P1-1 | iOS | **Push notifications non-functional end-to-end** — client writes APNs tokens to `device_push_tokens`, but that table is only *staged* in `reports/ios-pending/` (never migrated) and the only sender is Web Push/VAPID (no APNs path). | `01-IOS.md` |
| P1-2 | iOS | **Live video depends on unapplied migrations** (`live_rooms`, future-dated `20260627`) → would 400 in prod; also P2P WebRTC mesh, no SFU (won't scale); getUserMedia-in-WKWebView unverified. | `01-IOS.md` |
| P1-3 | web | **Ghost "completed" projects** — `auto-stitch-trigger` marks complete on failure paths with no video. | `07-RISKS R3` |
| P1-4 | web | **Preview ≠ export** — editor preview (320ms fixed xfade) vs server bake (0.4s authored + loudnorm) vs `render-video` naive concat. Unify on one model. | `07-RISKS R4` |
| P1-5 | web | **Two inconsistent assembly audio models** (`seamless-stitcher` proper mix vs `render-video`/`fix-manifest-audio` manifest model). | `07-RISKS R5` |
| P1-6 | web | **Crossfade clobbers per-clip volume/mute every frame** (`StitchedPlayer:757`); `TimelinePlayer` seek→advance parity bug (`:120`). | `07-RISKS R6` |
| P1-7 | web | **6 ungated user-callable OpenAI generation fns** (no credit reserve): `generate-script:373`, `generate-story:475`, `script-assistant:150`, `generate-ad-studio:234`, `generate-ad-variants:242`, `regenerate-audio:204` (+ `smart-script-generator:956` gated only by caller). Plus ungated paid image fns (`studio-image`, `generate-avatar-image`). | `02-WEB §C` |
| P1-8 | web | **`generate-story`, `generate-video`, `free-tier-generate` BROKEN** (per AI-gen trace); `director-card`, `scene-character-analyzer`, `elevenlabs-music/-sfx` orphaned. | `02-WEB §C` |
| P1-9 | web | **HLS error recovery thin; manifests without `hlsPlaylistUrl` play a `.json` as media** (`ExamplesGallery:285-299`); no client signed-URL generation. | `07-RISKS R10` |
| P1-10 | admin | **Electron admin black-screens if built without `VITE_SUPABASE_URL`** baked in (`build:admin` doesn't inject it; `supabase/client.ts:5-11` reads it at module load). | `03-ADMIN.md` |
| P1-11 | web/billing | **Studio-v2 `reserve-credits` never sets `movie_projects.credit_hold_id`** → those holds are reconciler-invisible (uncharged work). Org refill silently no-funds if `organizations.plan` unset (nothing sets it). | `02-WEB §D` |

## P2 — Debt, cleanup, untyped paths

| # | Surface | Gap | Evidence |
|---|---|---|---|
| P2-1 | shared | **`types.ts` drift** — 166 tables/10,256 lines, `notification_preferences` + `free_tier_attempts` missing, **249 `as never` casts**. Regenerate types + remove casts. | `04-CROSS §4.2` |
| P2-2 | shared | **`stripe_*` columns hold Polar values** (64+ refs) — rename or document loudly. | `04-CROSS §4.2` |
| P2-3 | backend | **Python `breakout_pipeline` is orphaned** (proven: zero refs outside `python/`, no subprocess caller, the seedance "job worker" in `python/README.md:124-138` doesn't exist). Either wire it or remove it to stop implying a capability that isn't live. | `02-WEB §A` |
| P2-4 | backend | **`job-queue` is dead in-memory scaffolding** (zero call sites); no durable job queue — orchestration is fire-and-forget self-chains. `check-video-status` autoComplete write is non-atomic. | `02-WEB §A` |
| P2-5 | tests | **15 stale regression tests fail** (file-existence/contract assertions for dead-code-removed files). `npm test` cannot go green until deleted — masks future regressions. | `06-HEALTH.md` |
| P2-6 | web | **7 raw-error-message leaks to users** (`toast.error(error.message)`). | `06-HEALTH.md`, `ERROR_MESSAGING_REPORT.md` |
| P2-7 | env | **Turnstile documented-but-never-wired** (`VITE_TURNSTILE_SITE_KEY` unused); undocumented `VITE_ADMIN`/`VITE_DISABLE_STRICT`; no `.env.example` for ~30 backend secrets (missing `CRON_SHARED_SECRET`/`OAUTH_STATE_SECRET` silently 401s crons/webhooks). `LOVABLE_API_KEY` still a live generation dependency (18 refs). | `04-CROSS`, `backend-contracts` |
| P2-8 | iOS | feed `comment_count` always 0 for real reels (column omitted from anon-safe select); editor `beforeunload` net omits `flushEditorState` (narrow data-loss window). | `01-IOS.md`, `02-WEB §D` |
| P2-9 | admin | 4 PARTIAL pages: Backups (table, no producer), CrashForensics (session-only), Roles/Team scope grants (no `admin_scopes` table — all-or-nothing, Lock UI cosmetic). | `03-ADMIN.md` |
| P2-10 | web | Dead code in players: unattached `videoBRef` authored-transition preview (`PlayerCanvas:587-621`), ~130 lines legacy `videoRef`. | `02-WEB §B` |

## Per-surface "what's left" headline
- **iOS:** functionally a consumption shell that builds in code but is **runtime-unverified** (no Xcode); push + Live are not shippable (unapplied migrations, no APNs/SFU). Spend-only payments are solid.
- **Web:** happy-path generation works; **failure paths leak money/data and the editor's main render CTA is dead.** Billing provider must be resolved. This is where the ship risk concentrates.
- **Admin:** **closest to ship** — server-enforced authz, all pages wired to real data, 0 broken. Only debt: Electron env-injection, 4 partial pages, no `admin_scopes`.
