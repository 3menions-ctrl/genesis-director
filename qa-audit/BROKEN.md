# Genesis Director — BROKEN.md (master bug list)

Every broken user-facing function, sorted by severity. Each entry: **symptom** (what the user sees) · **repro** · **root cause** (file:function:line) · **fix**. Severity is weighted by how central the function is to normal use. Code-contract certain unless marked **UNVERIFIED** (final proof needs a live backend / prod DB / provider secrets).

Surface tags: `[pipeline]` `[editor]` `[social]` `[settings]` `[library]` `[credits]` `[business]` `[admin]` `[auth]`. Full per-surface detail in `qa-audit/partials/`.

---

## P0 — core flow broken

### P0-1 · `[pipeline]` Every finished film stops playing/downloading ~24h after render
- **Symptom:** A film plays fine right after rendering, then ~24h later `/r/:id`, the Library card, embeds, and downloads all 404 / fail.
- **Repro:** Render a film → wait >24h → open it.
- **Root cause:** `seamless-stitcher/index.ts:115` `SIGNED_URL_TTL = 60*60*24`; output bucket `published-renders` is **private** (`migrations/20260612010000_published_renders_bucket.sql:5` = `false`). The stitcher returns this 24h signed URL and it is written to `movie_projects.video_url` (`seamless-stitcher:1107`). The "durable URL" guard `isTemporaryReplicateUrl()` only matches `replicate.delivery` (`_shared/video-persistence.ts:15`), so a Supabase signed URL is mistaken for permanent and persisted verbatim by both `hollywood-pipeline/index.ts:6485-6503` and `final-assembly/index.ts:302`.
- **Fix:** Persist the stitched master to a **public** bucket and store `getPublicUrl` (clips/thumbnails already do this), OR resolve `video_url`→a fresh signed URL on read, OR set a durable TTL. Never store a 24h signed URL as the canonical field.

### P0-2 · `[pipeline]` "Retry failed clip" deadlocks and permanently bricks the clip
- **Symptom:** Clicking Retry on a failed clip never succeeds; the clip is left stuck in `generating` forever and can never be retried again.
- **Repro:** Let a clip fail → Production page → Retry (`Production.tsx:1011`).
- **Root cause:** `retry-failed-clip/index.ts:130` acquires the project generation lock, then `:320` calls `generate-single-clip` **without passing the lock**. `generate-single-clip/index.ts:1503` unconditionally re-acquires the same non-reentrant `acquire_generation_lock` → 409 `GENERATION_LOCKED`. `callEdgeFunction` throws on non-2xx → outer catch (`:424`) **does not revert clip status nor release the lock** (clip was set `generating` at `:287`). Future retries fail the `status==='failed'` precondition (`:182`). `isRetry` is sent (`:334`) but never read.
- **Fix:** Pass the held lock id to `generate-single-clip` and skip re-acquire when caller holds it; in the catch, revert clip→`failed` and release the lock.

---

## P1 — major

### P1-1 · `[pipeline]` Stitched film never finalizes in DB (Production-page auto-stitch path)
- **Symptom:** A film stitched from the Production page flashes "Video ready!" once, then on refresh is stuck `status='stitching'`, `video_url=null` forever (eternal spinner).
- **Root cause:** `auto-stitch-trigger/index.ts:227` sets `status='stitching'`, invokes the stitcher with no `includeIntro` → project-mode default `includeIntro=true` (`seamless-stitcher:310`) gates the stitcher's `video_url` write off (`:1102`). And `auto-stitch-trigger`'s **success** branch (`:281`) never writes `completed`/`video_url` — only the error branch does. Production.tsx only sets client-local state (`:1001`). DB never updated.
- **Fix:** Have `auto-stitch-trigger` (or the stitcher in project-mode) write `status='completed'` + durable `video_url` on success, mirroring `final-assembly:299-331`.

### P1-2 · `[pipeline]` "Regenerate script" button fails 100% of the time
- **Symptom:** On the script-approval screen, Regenerate shows "Failed to regenerate script" and the script never changes.
- **Root cause:** `Production.tsx:1262` invokes `hollywood-pipeline` with `{action:'regenerate_script'}`, but `hollywood-pipeline` has **no `action` handling**; with no `concept`/`manualPrompts` it throws `"Either 'concept' or 'manualPrompts' is required"` (`:6876`) → 500 → toast. (No credits charged — throw precedes the hold.) Affects both `ScriptApproval` and `ScriptReviewPanel`.
- **Fix:** Add a `regenerate_script` handler (reload `project.synopsis` as concept, re-run preproduction, re-park at `awaiting_approval`), or route `handleRegenerateScript` through the correct path with a real concept.

### P1-3 · `[pipeline]` A stuck `awaiting_approval` draft blocks ALL new creations
- **Symptom:** After abandoning a draft (esp. because Regenerate is broken, P1-2), every new "Create" is rejected and credits read as missing.
- **Root cause:** `mode-router:342` enforces one active project across `['generating','processing','pending','awaiting_approval']` → 409 `active_project_exists`. Credits are HELD at the pause (`hollywood-pipeline:6971`, gate `:6314`) before approval, contradicting the ScriptApproval copy that implies charge-on-approval. Only escape is Cancel. **UNVERIFIED:** whether any cleanup releases the hold for abandoned `awaiting_approval` projects.
- **Fix:** Auto-expire stale `awaiting_approval` projects + release their holds; make the 409 surface a one-click "cancel & start new"; hold credits at/after approval (or guarantee TTL release).

### P1-4 · `[pipeline]` Editor & free-tier clip generation charges, then orphans on navigation
- **Symptom:** Editor "Library" clip (and free-tier t2v): credits deducted, but if the user leaves before the client poll sees completion, the result is never stored, inserted, or refunded.
- **Root cause:** `editor-generate-clip/index.ts:371` charges at submit; submit registers **no webhook** (`:449`) and there is **no server poller / tracking row** (only `api_cost_logs.metadata.predictionId`). Refund only if a later `action:"status"` poll sees `failed`. Watchdog can't see it. `free-tier-generate` has no consumer at all.
- **Fix:** Register `replicate-webhook` on submit (or insert a `pending` `video_clips` row) so a server process reconciles abandoned predictions.

### P1-5 · `[pipeline]` Avatar multi-clip: webhook stale-snapshot race; stitch may never trigger
- **Symptom:** Multi-clip avatar projects: a sibling's completed clip gets clobbered, or `allDone` never becomes true → stitch never fires → stuck.
- **Root cause:** `replicate-webhook/index.ts:495-595` mutates and writes back a **stale in-memory `tasks` snapshot** (`:575`) and computes `allDone` from it (`:583`); concurrent webhooks = last-writer-wins. The fresh-re-read fix applied to `check-specialized-status:228` was never applied here. Lookup also scans only `…limit(50)` projects (`:99`) → 51st+ unmatched.
- **Fix:** Re-read `pending_video_tasks` atomically before computing `allDone`; key the lookup by prediction id, not a capped scan.

### P1-6 · `[pipeline]` Fully-failed avatar project never marked terminal
- **Symptom:** When every avatar clip fails, the response says `isFailed:true` but `movie_projects.status` stays in its prior state (e.g. `processing`) — hangs.
- **Root cause:** `check-specialized-status/index.ts:262-371` only ever sets `status='completed'` (`:310,:349`); no `='failed'` branch.
- **Fix:** Add a terminal-failure branch when `allDone && failedCount===totalCount`.

### P1-7 · `[pipeline]` Hollywood quality/identity gate passes every clip (live no-op)
- **Symptom:** The validation gate invoked at `hollywood-pipeline/index.ts:4249` approves every clip regardless of content.
- **Root cause:** All 6 sub-validators (`validate-color-histogram`, `verify-face-embedding`, `validate-clothing-hair`, `validate-environment`, `validate-temporal-consistency`, `visual-debugger`) **do not exist in the repo**. Each missing-call handler returns `passed:true,score:70` (`comprehensive-validation-orchestrator:170+`) → `overallPassed` always true (`:335`). **UNVERIFIED** if deployed out-of-band.
- **Fix:** Deploy/restore the sub-validators, or make the missing-target handler fail-closed, or remove the decorative gate.

### P1-8 · `[pipeline]` Recovery infrastructure is largely dormant
- **Symptom:** Stuck/zombie renders are not auto-recovered.
- **Root cause:** `pipeline-watchdog` is **disabled unless `WATCHDOG_RESUME_ENABLED='true'`** (`:347`) and **not scheduled in the repo** (the only cron migration *unschedules* it); it also double-refunds via `increment_credits`+manual insert (`:1434,:1508,:1819`). `zombie-cleanup` is sound but **not scheduled in repo**. `resume-avatar-pipeline` only understands the legacy single `pipeline_state.predictionId` and throws for the modern `pending_video_tasks.predictions[]` model (`:191`). **UNVERIFIED:** whether a dashboard/Mgmt-API cron runs these in prod.
- **Fix:** Schedule zombie-cleanup + watchdog; enable + de-double-refund the watchdog; teach resume-avatar the async model.

### P1-9 · `[pipeline]` Reel playback freezes on an expired/dead clip
- **Symptom:** A multi-clip reel hangs with no spinner and no skip when one clip URL is dead/expired (common after P0-1).
- **Root cause:** `TimelinePlayer.tsx:196-211` wires onEnded/onLoadedData/onTimeUpdate but **no `onError`** on the `<video>`.
- **Fix:** Add `onError` → skip to next clip / show retry.

### P1-10 · `[pipeline]` Reel "Still rendering…" never updates
- **Symptom:** A reel that finishes (or dies) shows an indefinite "Still rendering…" spinner until manual refresh.
- **Root cause:** `Reel.tsx:646-655` has no realtime/poll; effect deps `[id,user?.id]` (`:340`) never re-fire on status change.
- **Fix:** Subscribe to the project channel or poll status.

### P1-11 · `[pipeline]` Clip-recovery hook misses `processing`-stuck clips
- **Symptom:** Some genuinely-stuck clips are never recovered or marked failed.
- **Root cause:** `useClipRecovery.ts:53` queries only `status='generating'` (and `detectZombieClips` likewise); `processing` is a real status only `usePendingVideoRecovery` covers. `useClipRecovery` also omits `userId` in the `check-video-status` body so it can't flip true failures to `failed`.
- **Fix:** Include `processing` and pass `userId`.

### P1-12 · `[pipeline]` Public-share "trailer" is a full re-render and expires
- **Symptom:** The share-page "trailer" is the full-length film and breaks after 24h.
- **Root cause:** `generate-project-trailer/index.ts:108` passes `mode:"trailer"`, `maxClipSeconds:3`, `clipsOverride:[…]` — the stitcher recognizes none (needs `clips:[…]`), so it runs full project-mode; the 24h signed URL is stored on `project_shares.trailer_url` (`:149`).
- **Fix:** Use the stitcher's real clips-mode with a per-clip clamp; store a durable URL.

### P1-13 · `[pipeline]` Branded download produces a corrupt MP4
- **Symptom:** "Download with intro" yields an unplayable file (when an intro asset exists).
- **Root cause:** `brand-video-download/index.ts:193` byte-concatenates two complete MP4 containers (duplicate `ftyp`/`moov`) → invalid file (header comment admits it's a placeholder).
- **Fix:** Route through the same Replicate cog-ffmpeg concat the stitcher uses, or remove the path.

### P1-14 · `[editor]` Editor MP4 render is dead (Approve & Render / Render Queue)
- **Symptom:** No working way to render a finished MP4 from the editor; "Approve & Render" is disabled/"coming soon" and the Render Queue is always empty.
- **Root cause:** `installJobRunner` (`orchestrator.ts:298`) is **never called**, so `isRunnerInstalled()` is permanently false and all three enqueue CTAs (`Script.tsx:418`, `ShotInspectorCard.tsx:309`, `TakesDrawer.tsx:1426`) short-circuit. The real MP4 path `final-assembly` is reachable only via `RenderQueuePanel.tsx:54` retry, but `addRenderJob` has zero callers. (Gracefully gated — not a silent no-op; intended export is ExportPanel "Save & publish", which works.)
- **Fix:** Wire `installJobRunner` + `addRenderJob` on approve, or relabel the editor publish-only and remove the dead render UI.

### P1-15 · `[editor]` Photo edit charges but never refunds on failure
- **Symptom:** When the AI gateway errors/returns no image, the user keeps the deducted credits.
- **Root cause:** `const idemKey` is declared inside the `if (creditsCost>0)` deduct block (`edit-photo/index.ts:173`); the two refund sites reference it out of scope (`:277,:306`) → `ReferenceError` before `refund_credits` runs; the `photo_edits` row is already `failed` so nothing recovers it. (`inpaint-photo` hoists correctly at `:193`.)
- **Fix:** Hoist `const idemKey` to function/try scope.

### P1-16 · `[editor]` Environments "Apply scene" no-ops for ~102 of 122
- **Symptom:** Apply flashes `Applied scene "X"` then lands on `/create` showing "Environment not found"; only the 20 base presets work.
- **Root cause:** Page renders `getAllEnvironmentBlueprints()` (122) but `useTemplateEnvironment.loadEnvironment` (`:1456`) resolves IDs only against a hard-coded 20-item `ENVIRONMENT_PRESETS` (`:61`) with no registry fallback (unlike `loadTemplate`). Premature `toast.success` (`Environments.tsx:532`) masks it.
- **Fix:** Resolve via `getEnvironmentBlueprint(id)` registry fallback; drop the premature toast.

### P1-17 · `[editor]` `stylize-video` & `motion-transfer` ship placeholder model versions
- **Symptom:** Video-to-video and motion-transfer likely 422 at submit; the project stalls (no over-charge — charged only after successful submit).
- **Root cause:** `stylize-video/index.ts:69` hardcodes a fabricated-looking `version`; `motion-transfer/index.ts:36` uses a guessed `DEFAULT_MODEL_VERSION` + shotgun input mixing two schemas. **UNVERIFIED live.**
- **Fix:** Pin verified, currently-published Replicate versions + exact input schema; test live before launch.

### P1-18 · `[settings]` Delete account fails for everyone
- **Symptom:** Account deletion fails on both settings surfaces.
- **Root cause:** `SecuritySettings.tsx:138` and `SettingsDashboard.tsx:2508` invoke `delete-user-account` with **no body**, but `delete-user-account/index.ts:62` requires `password` (password accounts) or `confirm==='DELETE MY ACCOUNT'` (passwordless) → 400. The typed "DELETE" never leaves the client and wouldn't match the required phrase anyway.
- **Fix:** Send `{password}` or `{confirm:'DELETE MY ACCOUNT'}` in the invoke body; align the UI confirm phrase.

### P1-19 · `[library]` Library delete orphans storage, keeps billing, and FK-fails for genesis films
- **Symptom:** Deleting a film from `/library` leaves all storage (final video, clips, thumbnails, frames, HLS), never cancels in-flight Replicate predictions (ongoing spend), and **outright fails** for projects with `genesis_scene_clips`. The confirm dialog falsely claims renders are gone.
- **Root cause:** `Library.tsx:223` runs a raw `supabase.from("movie_projects").delete()` instead of `functions.invoke('delete-project')` (which `StudioContext.tsx:360` uses correctly). `genesis_scene_clips.project_id` FK is RESTRICT (no `ON DELETE`), so the raw delete throws and rolls back.
- **Fix:** Route through `delete-project` (keep optimistic UI + rollback).

### P1-20 · `[business]` Business onboarding is fully blocked (RLS references a non-existent column)
- **Symptom:** "Create workspace" → "Could not save your details" every time; no org is ever provisioned and `account_type` never becomes business.
- **Root cause:** `BusinessStart.tsx:279` inserts into `onboarding_intents`; the INSERT policy (`migrations/20260515231445_…sql:31`) `WITH CHECK` reads `... ->> 'email'` but the table has only `contact_email`/`billing_email` → NULL → `0 BETWEEN 5 AND 320` is false → every insert rejected. Error swallowed into a generic toast. **UNVERIFIED:** confirm the live policy matches the repo (prod drift).
- **Fix:** Change the policy to reference `contact_email` (the column the client writes), or add an `email` column.

---

## P2 — moderate

### P2-1 · `[social]` Comment like/react + reply/edit/delete are hover-only (invisible on touch) — *this is the reported "liking comments fails"*
- **Symptom:** On mobile/iOS the emoji-react buttons and the reply/edit/delete row never appear, so liking/replying to a comment does nothing.
- **Root cause:** `VideoCommentsSection.tsx:64` (reaction add row) and `:185` (action row) are `opacity-0 group-hover:opacity-100`; the parent `group` (`:124`) only reveals them on hover, which touch devices don't have. A fresh comment with no existing reactions shows *only* the hidden row.
- **Fix:** Show the action/react row by default (or on tap/focus) on touch viewports; don't gate primary actions behind hover.

### P2-2 · `[social]` Lobby feed emoji reactions duplicate infinitely (no toggle, no UNIQUE)
- **Symptom:** In the immersive feed, each emoji tap inserts a new `reel_reactions` row; counts can be inflated arbitrarily and a reaction can never be removed.
- **Root cause:** `ImmersiveFeed.tsx:158` `react()` is insert-only with the error swallowed; `reel_reactions` has no unique constraint (`migrations/20260610230000_entertainment_hub.sql:141`). The sibling `ImmersiveTheater.react()` toggles correctly — the two surfaces are inconsistent.
- **Fix:** Mirror the Theater toggle; add `UNIQUE(reel_id, reactor_id, reaction_url)`.

### P2-3 · `[settings]` Change-email on `/settings` always fails
- **Symptom:** Email change fails on `/settings` (works on `/account?tab=settings`).
- **Root cause:** `AccountSettings.tsx:217` invokes `update-user-email` with `{newEmail}` only and the dialog has no password field; the fn requires `password` → 400.
- **Fix:** Add a password field; send `{newEmail,password}` (mirror SettingsDashboard).

### P2-4 · `[settings]` "Opt out of activity tracking" on `/settings` is a no-op (privacy/compliance)
- **Symptom:** Toggling opt-out reports success but analytics keep recording.
- **Root cause:** `AccountSettings.tsx:95` writes `tracking_opted_out` to **`user_gamification`**, but `track_event` reads `profiles.tracking_opted_out` (`migrations/20260613230000_settings_consumers.sql:317`); no sync trigger. The `/account` surface writes the correct column.
- **Fix:** Point read/write at `profiles.tracking_opted_out` (or add a sync trigger).

### P2-5 · `[settings]` "Deactivate Account" on `/settings` is a dead-end
- **Symptom:** Clicking Deactivate navigates away; nothing happens.
- **Root cause:** `AccountSettings.tsx:559` navigates to `/settings/deactivate`, which `App.tsx:543` redirects to `/account?tab=settings`. Real deactivation only exists in `SettingsDashboard:2418`.
- **Fix:** Implement inline or deep-link to the working card.

### P2-6 · `[settings]` `/settings` "Active Sessions" is fake
- **Symptom:** Always shows a single hardcoded "Current Device"; no real devices, no per-session revoke.
- **Root cause:** `SecuritySettings.tsx:300-314` is static markup; never calls `manage-sessions`. The real `SessionsCard` is only mounted in `Profile.tsx:984`.
- **Fix:** Render `SessionsCard` in the settings security section.

### P2-7 · `[credits]` No in-app way to cancel/manage a subscription
- **Symptom:** A subscriber cannot open the billing portal or cancel/manage their plan; copy promises it (Credits.tsx:256, Help.tsx:113 — Help even names the locked *Stripe* portal).
- **Root cause:** `polarProvider.createPortalSession`/`polar-portal` work but have **no caller** in `src/`. `BillingSettings.tsx` only has Buy-credits + Export.
- **Fix:** Add a "Manage subscription" button calling `getPaymentsProvider().createPortalSession`; fix Help copy (Polar, not Stripe).

### P2-8 · `[credits]` Cinema billing orphaned; fair-use guard never enforces
- **Symptom:** No UI to buy a Cinema subscription; `useCinemaGuard` (`Studio.tsx:220`) therefore always returns `allowed:true` — dead gate.
- **Root cause:** Cinema checkout was Stripe-only (now locked), never re-wired to Polar nor surfaced. Latent: re-enabling routes to Polar `SUB_CREDITS` which lacks `cinema_*` plans → 503.
- **Fix:** Remove if shelved, or add Cinema plans to `polar-checkout` + build the buy/entitlement UI. Until then document the guard as inert.

### P2-9 · `[credits]` Org/team subscription checkout is orphaned
- **Symptom:** Team/seat subscriptions can't be purchased (one-time business credit *packs* do work).
- **Root cause:** `create-org-checkout` (kind:'org') has no caller and isn't on Polar; latent 503.
- **Fix:** Add org plans to Polar + wire the business billing UI.

### P2-10 · `[business]` Reports spend/burn/usage exports return empty
- **Symptom:** "Spend ledger" / "Per-member burn" download header-only CSVs; "Monthly usage" shows 0 — with a green "exported" toast.
- **Root cause:** All three read `org_spend_events` (`export-workspace-report/index.ts:34-83`), whose only writer inserts a disjoint column set on low-credit notices only (`migrations/20260610030217_…sql:63`). Real spend is in `credit_transactions`.
- **Fix:** Repoint the queries at `credit_transactions` (filter org + negative amount), like the audit page.

### P2-11 · `[business]` API keys may 401 or silently get full scope in prod (UNVERIFIED)
- **Symptom:** A key from `/business/api` could 401 on every call, or silently get full `read+generate` scope.
- **Root cause:** UI writes `org_api_keys` but `api-v1:83` resolves via `find_api_key_owner`; the org-UNION + `scopes` fixes live only in late migrations (`20260705010300`, `20260706000100`). If unapplied in prod (documented drift): lookup misses (401) or scope falls back to full (`api-v1:95-103`).
- **Fix:** Verify the live RPC returns 3 cols + UNIONs `org_api_keys`; regenerate types.

### P2-12 · `[business]` Team invite sends no email/notification
- **Symptom:** "Dispatch invite" only inserts a row + copies a link to the admin's clipboard; invitee is never emailed.
- **Root cause:** `BusinessTeam.tsx:132-146` — insert + clipboard only; no invite-email template wired.
- **Fix:** Server-side enqueue on `organization_invites` insert (trigger/SECURITY DEFINER), or rename the label.

### P2-13 · `[business]` Scheduled distributions are never posted
- **Symptom:** "Schedule" creates a `distribution_jobs` row `status='scheduled'` and toasts success, but the post never goes live.
- **Root cause:** `distribution-manage/index.ts:223` inserts and `continue`s; no worker/cron reads `distribution_jobs WHERE status='scheduled'`.
- **Fix:** Add a scheduled function that posts due jobs (mirror the immediate block).

### P2-14 · `[business]` Meta publish marks "posted" after only creating a container (UNVERIFIED)
- **Symptom:** Job marked `posted` with an id, but nothing is on IG/FB.
- **Root cause:** `_shared/distribution-providers.ts:86` POSTs to `me/media` (container only); the second step `{ig-user-id}/media_publish` is never called.
- **Fix:** Implement the 2-step IG flow; only then mark `posted`.

### P2-15 · `[business]` "Keys inherit the org credit pool" is false
- **Symptom:** UI says org keys bill the org pool; spend is billed to the key creator's personal wallet.
- **Root cause:** `find_api_key_owner` returns `created_by` as `owner_user_id`; api-v1 deducts against that user (`:90,247`). Org-pool routing tracked as "M8", not shipped.
- **Fix:** Route org-key spend to the org pool, or correct the copy.

### P2-16 · `[library]` Public-share feature is orphaned (no creation path)
- **Symptom:** The "public, no-login page for my film" (`/p/:slug`) can't be produced by any user.
- **Root cause:** `mint-project-share` fn + `mint_project_share_slug` RPC + `PublicShare`/`EmbedPlayer` pages exist, but nothing in the UI mints a slug or inserts `project_shares` (0 callers). Share buttons copy `/r/{id}` instead.
- **Fix:** Wire a "Create public link" action, or delete the dead fn/routes.

### P2-17 · `[library]` Share links point to a login-gated route
- **Symptom:** "Share" copies `/r/{id}` and toasts "Link copied", but `/r`, `/p`, `/embed` aren't in the public allowlist → logged-out recipients bounce to `/auth`.
- **Root cause:** Intentional "gate by default" (`publicRoutes.ts`) collides with a share UX that implies public links.
- **Fix:** Product decision — add public read paths for shares, or change the copy.

### P2-18 · `[admin]` Stuck-jobs watchdog may be rejected at the gateway (UNVERIFIED)
- **Symptom:** Stuck render jobs (>30 min) may never be detected/recovered.
- **Root cause:** `config.toml` has no `[functions.admin-stuck-jobs-watchdog]` block → `verify_jwt` defaults true, but the header comment assumes false; a pg_cron call with only `x-cron-secret` (no valid JWT) gets 401 before the handler runs.
- **Fix:** Add `verify_jwt = false` (or confirm cron passes a service-role Bearer).

### P2-19 · `[admin]` Credit-grant via `window.prompt` can be a silent no-op
- **Symptom:** On in-app/embedded webviews where native `prompt` is suppressed, "Grant credits" on the user detail page silently does nothing; standard violation throughout admin.
- **Root cause:** `AdminUserDetailPage.tsx:243-247` gathers amount/reason via `window.prompt`; 13 `window.confirm`/`prompt` occurrences across admin pages.
- **Fix:** Route through `confirmAsync` + the existing credit dialog (`AdminUsersPage.tsx:405`).

### P2-20 · `[editor]` Timeline structural edits are dropped from a real MP4 render
- **Symptom:** Trim/reorder/split/delete/title look right in the editor and survive reload, but are absent from the `final-assembly` MP4.
- **Root cause:** Edits persist to `editor_state.clips` (flat array, `useEditorStateSync.collect():66`), but the stitcher reads `editorState.scenes[].clips[]` (`seamless-stitcher:437,584`) — a key `collect()` never writes; and `final-assembly` selects `video_clips` which never receive trim/order/delete. (Grade/mix/overlays DO round-trip.) Currently masked because the render path itself is unreachable (P1-14).
- **Fix:** Reconstruct V1 from `editor_state.clips`, or persist trims/order/deletes to `video_clips`.

### P2-21 · `[editor]` Music score recorded twice
- **Symptom:** Each "Generate score" creates two identical My Tracks rows.
- **Root cause:** Double write — `generate-music/index.ts:816` records, AND `MusicHub.tsx:698` re-records via `record_user_media`.
- **Fix:** Drop the client record block.

### P2-22 · `[editor]` Music duration selector lies for 60s/90s
- **Symptom:** 60/90s yields ~30s but is stored as 60/90s.
- **Root cause:** UI offers `[15,30,60,90]` (`MusicHub.tsx:671`) and records the selected value, but `generate-music:364` hard-clamps to 30s.
- **Fix:** Limit UI to `[15,30]` (or implement chunking) and record the actual returned duration.

### P2-23 · `[editor]` "Replace music" leaves the old track → double audio on render
- **Root cause:** `onReplaceMusic` (`Timeline.tsx:587`) calls store-only `deleteClip`; the old A2 `video_clips` row is never deleted; the stitcher includes all `sys:A*` rows.
- **Fix:** Delete the old A2 row on replace.

### P2-24 · `[editor]` Crossover template slug silently dropped
- **Symptom:** Crossover renders run as generic t2v; template never linked (no useCount/analytics).
- **Root cause:** `mode-router:284` omits `crossoverTemplateSlug` from the destructure; sent from `Crossover.tsx:567`.
- **Fix:** Consume the slug (persist + bump useCount), or drop the param.

### P2-25 · `[editor]` Avatar voice preview is non-functional vault-wide
- **Symptom:** "Audition the voice" play button never appears / is permanently disabled.
- **Root cause:** `avatar_templates.sample_audio_url` is never populated by any seeder; the page reads it directly with no fallback. `useAvatarVoices` (the fix) is dead code and, as-is, sends the anon key → 401.
- **Fix:** Backfill `sample_audio_url` on seed, or wire `useAvatarVoices` with the user session token.

### P2-26 · `[editor]` Photo-edit idempotency dead → double-charge on retry
- **Root cause:** `deduct_credits` only honors idempotency when both `p_idempotency_key` AND `p_project_id` are set (`migrations/20260705000100:209`); both photo fns omit `p_project_id` (`edit-photo:176`, `inpaint-photo:196`); the only unique index is partial `WHERE LIKE 'tip:%'`.
- **Fix:** Add a partial unique index for `edit-photo:%`/`inpaint-photo:%`, or honor the key independent of project_id.

### P2-27 · `[editor]` Reference-image aspect-expand is a silent no-op
- **Root cause:** `analyze-reference-image/index.ts:239` fetches `/functions/v1/expand-image-aspect-ratio`, which **doesn't exist**; the 404 is swallowed.
- **Fix:** Implement the function or remove the call + UI claim.

### P2 (pipeline tail, condensed — see `partials/03-pipeline-render.md`)
- **P2-28 `[pipeline]` Credits held before script approval may leak on abandonment** (UNVERIFIED cleanup) — `hollywood-pipeline:6971`.
- **P2-29 `[pipeline]` Approved storyboard keyframes may be overwritten** by `runAssetCreation`→`generate-scene-images` on resume (UNVERIFIED) — `hollywood-pipeline` runAssetCreation.
- **P2-30 `[pipeline]` `useRenderCompleteNotifier` omits `processing`** → completion toast skipped (`:25`).
- **P2-31 `[pipeline]` HLS fallback download saves `.m3u8` as `.mp4`** (playlist text, not video) — `Reel.tsx:284`, `ProductionFinalVideo.tsx:19`.
- **P2-32 `[pipeline]` FilmsGallery hardcoded to a foreign Supabase project** (`ahlikyhgcqvrdvbtkghh…`) — `FilmsGallery.tsx`. (Static marketing data; blanks if bucket gone.)
- **P2-33 `[pipeline]` `comprehensive-clip-validator` orphaned + fail-open** (HTTP 200 `passed:true`) — `:488`.
- **P2-34 `[pipeline]` `generate-video` stateless, no DB row / no recovery** — orphan-prone.
- **P2-35 `[pipeline]` `delete-clip` references non-existent `video_clips.thumbnail_url`** → dead branch, storage orphan on remove failure (`:172`).
- **P2-36 `[pipeline]` `generate-hls-playlist` embeds expiring `replicate.delivery` URLs** (`:128`).
- **P2-37 `[pipeline]` `check-video-status` returns UPPERCASE status while writing lowercase** (dual vocab; fragile if a client persists the returned value).

---

## P3 — minor / trivial / dead-code-with-misleading-surface

### Social
- **`useSocial.likeComment` is broken but dead** — insert-only into `comment_likes` (no toggle → 2nd click hits `UNIQUE(comment_id,user_id)`), and `project_comments.likes_count` has no trigger. Not wired to any UI; the live comment-like uses `comment_reactions`. (`useSocial.ts:389`) → delete or rewrite as a toggle.
- **Live reel comments render as "Anonymous"** until reload — realtime row pushed without the author join (`ImmersiveTheater.tsx:284`).
- **Reaction double-click race** can show a spurious "Failed to react" (decides insert/delete from a stale cache) — `useVideoReactions.ts:58,130`.

### Auth (all LOW — see `partials/04-auth.md`)
- OAuth advertised in Auth.tsx header copy but not implemented (email/OTP only).
- `signInWithMagicLink` dead code + orphaned magiclink callback branch (`AuthContext.tsx:718`).
- AuthCallback bounces a just-confirmed (already-authenticated) signup user to `/auth` "please sign in" (self-heals) (`AuthCallback.tsx:160`).
- First-load profile-fetch timeout mis-routes an existing user as brand-new to `/studio?welcome=1` (`authProfile.ts:55`).
- ResetPassword success copy contradicts behavior (says "redirecting to sign in" while sending to `/projects`) — trivial.

### Settings
- Browser-push toggles swallow errors / no toast → revert on reload (`SettingsDashboard.tsx:~1213`).
- Patron-tier inline edits swallow errors / no toast (`SettingsDashboard.tsx:~1521`).
- `SessionsCard` rendered without required `glassCard` prop → loses styling (`Profile.tsx:984`).

### Credits
- `stripe-connect-onboard` ignores the requested return URL (`return_path` vs `returnUrl`) — cosmetic (`:36`).
- `list-cinema-invoices` documented for Credits page but never called.
- Pricing page carries vestigial `BuyCreditsModal`/`planLookupKey` dead code.

### Business
- `last_used_at` never updates for org keys (updates `api_keys` by an id that belongs to `org_api_keys`) — `api-v1:125`.
- Logo upload doesn't apply to `organizations.logo_url` until "Commit kit"; "Remove logo" never deletes storage — `BusinessBrand.tsx:340`.
- Approvals audit events show a blank actor (`actor_name` not passed) — `BusinessApprovals.tsx:110`.
- Distribution OAuth callback redirect depends on a possibly-unset app-URL env (`distribution-oauth-callback:30`) — UNVERIFIED.
- Widget analytics counters are write-only (no reader UI).
- Send-to-Create silently discards `enableMusic` (`CreationHub.tsx:369` hardcodes false).
- Projects owner-name read bypasses the hardened `org_member_directory` RPC → may show "Member" — `BusinessProjects.tsx:111`.

### Admin
- `admin-delete-auth-user` orphaned/redundant (no caller; skips the pre-delete cascade).
- `revoke-demo-sessions` orphaned + brittle hand-rolled 14-table cascade.
- `check-secrets-status` / `revoke-demo-sessions` use a dynamic `await import` of auth-guard — the exact pattern documented as a past deploy-break (likely fine now; inconsistent).

### Studio / Editor
- Cast member delete has no confirmation (not even `confirmAsync`) — `Cast.tsx:123`.
- Avatar preview audio keeps playing after unmount/close — `Avatars.tsx:775,1065`.
- `editor-transcribe` / `editor-tts` are not credit-gated (paid provider calls, no metering).
- `elevenlabs-music` uncredited (if ever wired); both EL music/sfx orphaned.
- Stale localStorage `clipOrder`/`clipDurations` can shadow newer DB edits same-device (`usePersistence.ts:84`).

### Pipeline
- Seedance engine skips the approval gate / auto-charges in the same text-to-video mode (intentional "parity" but inconsistent consent) — `mode-router:1246,1299`.
- `job-queue` uses module-level in-memory Maps that can't survive serverless isolates (unused).

---

## Dead / orphaned edge functions (built, zero callers — cleanup, not user-facing bugs)
`generate-script`, `generate-story`, `director-card`, `scene-character-analyzer`, `generate-character-for-scene`, `continuity-audit`, `generate-avatar-batch` (directory absent), `editor-ai-scene`, `elevenlabs-music`, `elevenlabs-sfx`, `approve-clip-one`, `mint-project-share` (orphaned at UI), plus dead hooks `usePredictivePipeline`, `useAvatarVoices`, `useChunkedAvatars`, `useAutoPickProjectId`, and the dead legacy DM stack (`MessagesInbox`, `DirectMessagePanel`, `useConversations`). The live script generator is **`smart-script-generator`**, not `generate-script`/`generate-story`.

## Intentional stubs / NOT bugs
All Stripe billing fns (`create-*-checkout`, `create-portal-session`, `payments-webhook`, cinema/org/seat/invoice) short-circuit 503 via `STRIPE_BILLING_LOCKED` — **deliberate** (provider is Polar); Stripe Connect payouts are intentionally live. Business "coming soon" tiles (Permissions matrix, auto-recharge automation, spend-alert delivery, plan/credit purchase UI, YouTube/LinkedIn adapters, api-v1 `/avatars` 501, SSO mailto) are honestly disclosed.
</content>
