# 03 — Production Pipeline: BACK HALF (clip-gen → poll/webhook → stitch → final film → playback/export → recovery)

READ-ONLY QA audit. Surface: clip generation result handling → status/polling/webhook → file retrieval → stitching → final assembly → playback → export/download → recovery. Evidence cited as `file:line`. Items needing a live backend marked **UNVERIFIED**.

Scope covered: 37 edge functions + 7 hooks + player/video/stability/production components + Reel/FilmsGallery/EmbedPlayer/watch pages.

## Prior-issue status (the two known blockers)
- **"ffmpeg cog stitch" blocker → RESOLVED in code.** Stitching no longer needs a local ffmpeg binary. `seamless-stitcher` and `production-finish` shell ffmpeg out to a **Replicate cog** (`FFMPEG_MODEL_VERSION = efd0b79b…`, `seamless-stitcher/index.ts:108-109`, run at `:1317`; `production-finish/index.ts:36-37`, run at `:127`). Output is validated (MP4 `ftyp` magic, `seamless-stitcher/index.ts:1405-1410`) and persisted. This path is plausible; whether the cog version is healthy in prod is **UNVERIFIED** (needs a live render).
- **"final-film 24h URL bug" → STILL PRESENT (P1, see BROKEN #2).** The canonical `movie_projects.video_url` is a **24h Supabase signed URL** into the **private** `published-renders` bucket. After 24h every finished film's playback/download breaks.

---

## INVENTORY

| Function/Step | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| generate-video | `generate-video/index.ts:908` | Stateless single-shot submit (multi-engine) | Async `wait=0`, **no webhook, no DB row**, returns taskId; client must poll | SUSPECT P2 (orphan-prone, no server recovery) |
| generate-single-clip | `generate-single-clip/index.ts:1071` | Project-aware clip generator (6 engines) | Async + **webhook→replicate-webhook** (`:262-266`) + optional `poll-replicate-prediction`; writes `video_clips`; pred-id in `veo_operation_name` (`:992`) | OK (P2: column-reuse; charge-before-register gap) |
| editor-generate-clip | `editor-generate-clip/index.ts:227` | Editor "Library" clips | Async, **no webhook, no server poller**; client `action:"status"` only; clip row only on success (`:583`); charges at submit (`:371`) | BROKEN P1 (charge + orphan if client stops polling) |
| free-tier-generate | `free-tier-generate/index.ts:31` | Free-tier watermarked t2v | Async, **no webhook, no consumer at all**; `free_tier_attempts.prediction_id` read by nothing | BROKEN P1 (latent — fn uncalled) |
| replicate-webhook | `replicate-webhook/index.ts:144` | Replicate completion writeback | HMAC-verified (`:43-50`); clip lookup `replicate_prediction_id`→fallback `veo_operation_name` (`:82,:89`); writes `video_clips.status/video_url`; lowercase status | SUSPECT P1 (avatar-async stale-snapshot race; 50-project lookup cap) |
| check-video-status | `check-video-status/index.ts:~` | On-demand status + autoComplete writeback | Polls Replicate; writes lowercase DB status; **returns UPPERCASE** `SUCCEEDED/FAILED` | SUSPECT P2 (dual status vocab; insert race) |
| check-specialized-status | `check-specialized-status/index.ts:~` | Avatar/multi-clip status | Fresh re-read race fix (`:228-242`); **never sets project `status='failed'` on total failure** (`:262-371`) | SUSPECT P1 (fully-failed avatar project never terminal) |
| poll-replicate-prediction | `poll-replicate-prediction/index.ts:~` | Service-role async poller | Writes clip by `(project_id, shot_index)` w/o verifying pred-id owns clip (`:261,:346`); lowercase status | OK/SUSPECT P2 |
| replicate-catalog | `replicate-catalog/index.ts:~` | Model catalog proxy | Read-only, auth-gated, allowlist | OK |
| replicate-audit | `replicate-audit/index.ts:~` | Admin recovery sweep | Reads `veo_operation_name` consistently (`:154-158`) | OK |
| approve-clip-one | `approve-clip-one/index.ts:42` | "Mandatory" clip-1 AI gate | Pure analyzer, **no DB writes, no live caller**; only `api.lovable.dev` user | SUSPECT P2 (orphaned/unenforced; stale dep) |
| retry-failed-clip | `retry-failed-clip/index.ts:57` | Manual retry of failed clip | Acquires lock (`:130`) then calls `generate-single-clip` which re-acquires same lock (`:1503`) → 409 deadlock | **BROKEN P0** |
| delete-clip | `delete-clip/index.ts:70` | Cancel + delete clip + refund | Refund OK; `clip.thumbnail_url` column doesn't exist → dead branch (`:172`) | SUSPECT P2 |
| comprehensive-clip-validator | `comprehensive-clip-validator/index.ts:133` | "Complete" clip validation | **5/6 sub-validators missing**; degrades to pass-75; fail-open 200 (`:488-499`); orphaned | SUSPECT P1 |
| comprehensive-validation-orchestrator | `comprehensive-validation-orchestrator/index.ts:94` | Validation gate (LIVE via hollywood `:4249`) | **All 6 sub-validators missing** → every branch `passed:true,score:70` → always-pass | BROKEN P1 (no-op gate) |
| validate-seam-continuity | `validate-seam-continuity/index.ts:61` | SSIM seam score (LIVE via hollywood `:4330`) | Stateless, SSRF-guarded, fail-soft `score:null` | OK |
| seamless-stitcher | `seamless-stitcher/index.ts:222` | Canonical ffmpeg stitch (Replicate cog) | project/clips mode; uploads to private `published-renders`; **24h signed URL**; writes `video_url` only when `!includeIntro` (`:1102`) | SUSPECT P1 (24h URL; project-mode default `includeIntro=true` skips video_url write — `:310`) |
| auto-stitch-trigger | `auto-stitch-trigger/index.ts:100` | Client stitch trigger | Sets `status='stitching'` (`:227`); calls stitcher w/o `includeIntro`; **never sets `status='completed'` or `video_url` on success** | **BROKEN P1** (DB stuck in stitching) |
| sync-music-to-scenes | `sync-music-to-scenes/index.ts:116` | Music-cue planner (returns JSON) | Analysis only; no clip/project writes | OK |
| final-assembly | `final-assembly/index.ts:52` | Editor render orchestrator (LIVE via RenderQueuePanel) | Atomic stitch-claim (`:179-217`); calls stitcher; sets `status='completed'`+`video_url` (`:299-331`); clips_fallback on failure | OK (inherits 24h URL) |
| production-finish | `production-finish/index.ts:224` | Finishing Studio grade/upscale pass | Owner+credit gated; Replicate cog; writes `finished_video_url`; **7-day** signed URL (`:40`) | OK |
| render-video | `render-video/index.ts:~` | (legacy render entry) | see note below | UNVERIFIED |
| generate-hls-playlist | `generate-hls-playlist/index.ts:19` | Build m3u8 from clips | Playlist via getPublicUrl; but embeds raw `clip.video_url` which may be expiring | SUSPECT P2 |
| generate-project-trailer | `generate-project-trailer/index.ts:29` | 15s trailer for share page | Stitcher ignores `clipsOverride/maxClipSeconds` → full re-render; 24h URL stored on public share | **BROKEN P1** |
| generate-project-thumbnail | `generate-project-thumbnail/index.ts:21` | 3-tier thumbnail | Replicate frame-extract; getPublicUrl (no expiry) | OK (P2: 90s inline poll) |
| brand-video-download | `brand-video-download/index.ts:86` | Prepend intro for download | **Byte-concat of two MP4s → corrupt file** (`:193-196`) | **BROKEN P1** |
| extract-video-frame | `extract-video-frame/index.ts:36` | Last-frame extract | Replicate; SSRF+IDOR guarded; getPublicUrl | OK |
| fix-manifest-audio | `fix-manifest-audio/index.ts:16` | One-off manifest audio repair | Sets `video_url` to manifest JSON in temp bucket (`:118`) | SUSPECT P2 |
| regenerate-audio | `regenerate-audio/index.ts:21` | Rebuild narration | Calls generate-voice; writes `voice_audio_url` | OK |
| pipeline-watchdog | `pipeline-watchdog/index.ts:296` | Omnibus recovery re-driver | **Disabled unless `WATCHDOG_RESUME_ENABLED='true'` (`:347-359`)**; not scheduled in repo; real re-drive when on | SUSPECT P1 (double-refund `:1434/1508/1819`; off by default) |
| admin-stuck-jobs-watchdog | `admin-stuck-jobs-watchdog/index.ts:10` | Detect+alert+kick watchdog | `detect_stuck_pipeline_jobs` (read-only) → POST watchdog | OK (P2: 30m–24h window) |
| zombie-cleanup | `zombie-cleanup/index.ts:39` | Reap >5min `generating` | Recover-first then fail+refund (idempotent `refund_credits`) | OK (P1: not scheduled in repo) |
| resume-avatar-pipeline | `resume-avatar-pipeline/index.ts:31` | Resume stalled avatar job | Only understands legacy single `pipeline_state.predictionId` | SUSPECT P1 (blind to async-predictions model) |
| job-queue | `job-queue/index.ts:330` | Priority queue façade | **In-memory Maps** — cannot survive serverless isolates; orphaned | BROKEN (unused) |
| webhook-dispatch | `webhook-dispatch/index.ts:144` | Workspace webhook delivery | SSRF-guarded, auth-gated | OK |

---

## BROKEN (by severity)

### #1 — retry-failed-clip self-deadlocks and bricks the clip — **P0**
- **Symptom:** "Retry" on a failed clip never succeeds; the clip is left stuck in `generating` forever and becomes permanently un-retryable.
- **Repro:** Let a clip fail → click Retry (Production.tsx `:1014` → `retry-failed-clip`).
- **Root cause:** `retry-failed-clip/index.ts:130` acquires the project generation lock, then `:320` calls `generate-single-clip` **without passing the lock**. `generate-single-clip/index.ts:1503-1517` unconditionally re-acquires the same non-reentrant lock (`acquire_generation_lock`, <180s) → returns 409 `GENERATION_LOCKED`. `callEdgeFunction` throws on non-2xx (`:49-52`) → jumps to the outer catch (`:424`) which **does not revert clip status nor release the lock** (clip was set `generating` at `:287-295`). Future retries fail the `status==='failed'` precondition (`:182-185`).
- **Fix:** Pass the held lock id through to `generate-single-clip` and have it skip re-acquire when the caller already holds it (add an `ownedLockId`/`isRetry` bypass — `isRetry` is sent at `:334` but never read). In the catch, revert clip→`failed` and release the lock.

### #2 — Final film video_url is a 24h signed URL into a PRIVATE bucket — **P1 (the "final-film 24h URL bug", confirmed)**
- **Symptom:** Films play right after render but every finished film 404s / fails to play and download throws ~24h later.
- **Repro:** Render a film; wait >24h; open `/r/:id` or the Library card.
- **Root cause:** `seamless-stitcher/index.ts:115` `SIGNED_URL_TTL = 60*60*24`; output bucket `published-renders` is **private** (migration `20260612010000_published_renders_bucket.sql:5` `…, false`). The stitcher returns this signed URL as `finalVideoUrl`/`url` (`:1133,:1144`) and writes it to `movie_projects.video_url` (`:1107`). hollywood-pipeline's "durable" guard `isTemporaryReplicateUrl()` only matches `replicate.delivery` (`_shared/video-persistence.ts:15`), so a Supabase signed URL is treated as already-permanent and persisted verbatim (`hollywood-pipeline/index.ts:6485-6503`). `final-assembly` does the same (`:302`).
- **Fix:** Persist the stitched master to a **public** bucket and store `getPublicUrl` (as clips/thumbnails already do), OR re-sign on read (resolve `video_url` to a fresh signed URL in the read path), OR extend TTL to a durable value. Do NOT store a 24h signed URL as the canonical durable field.

### #3 — auto-stitch-trigger never finalizes the project in the DB — **P1**
- **Symptom:** A film stitched via the Production page shows "Video ready!" once, but on refresh the project is stuck at `status='stitching'` with `video_url=null` forever (stuck spinner).
- **Repro:** Generate a project that completes its clips and triggers the Production.tsx auto-stitch effect (`src/pages/Production.tsx:989`) rather than the hollywood orchestrator.
- **Root cause:** `auto-stitch-trigger/index.ts:227-239` sets `status='stitching'` then invokes `seamless-stitcher` with `{projectId,userId}` (no `includeIntro`) (`:245`). In the stitcher, project-mode default makes `includeIntro=true` (`seamless-stitcher/index.ts:310`), so the `video_url` write is gated off (`:1102` `isProjectMode && !includeIntro` = false). And `auto-stitch-trigger`'s success branch (`:281-302`) **never writes `status='completed'` or `video_url`** — only the error/fallback branches do. Production.tsx only sets *client-local* state (`setProjectStatus('completed')`, `:1001`); the DB is never updated (RLS-correct: client can't, and the server didn't).
- **Fix:** Have `auto-stitch-trigger` (or the stitcher when called in project-mode) write `status='completed'` + the durable `video_url` on success, mirroring `final-assembly:299-331`.

### #4 — editor-generate-clip charges then orphans on client navigation — **P1**
- **Symptom:** Editor library clip: credits deducted, but if the user navigates away before the client status-poll observes completion, the Replicate result is never stored, never inserted, never refunded.
- **Root cause:** `editor-generate-clip/index.ts:371-390` charges at submit; submit registers **no webhook** (`:449-457`) and there is **no server poller / tracking row** — only `api_cost_logs.metadata.predictionId` (`:502`). Refund only fires if a later `action:"status"` poll sees `failed` (`:620-651`). Watchdog cannot see it (no `video_clips` row, no webhook).
- **Fix:** Register the `replicate-webhook` on the editor submit (or insert a `pending` `video_clips` row at submit) so a server process reconciles abandoned predictions.

### #5 — generate-project-trailer ships the wrong artifact AND it expires — **P1**
- **Symptom:** Public share "trailer" is a full-length re-render, and it breaks after 24h.
- **Root cause:** `generate-project-trailer/index.ts:108-118` passes `mode:"trailer"`, `maxClipSeconds:3`, `clipsOverride:[…]` — the stitcher recognizes none of these (mode is `projectId` vs `clips`; field must be `clips` not `clipsOverride`), so it runs full project-mode. The returned 24h signed URL is persisted to `project_shares.trailer_url` (`:149`) and rendered on the public share page → dead after 24h.
- **Fix:** Use the stitcher's real clips-mode (`clips:[{url,duration}]`) with a per-clip duration clamp; store a durable (public/long-lived) URL.

### #6 — brand-video-download produces a corrupt MP4 — **P1**
- **Symptom:** Branded download (intro prepended) is unplayable / shows only the intro.
- **Root cause:** `brand-video-download/index.ts:193-196` `runMux` does naive byte concatenation of two complete MP4 containers (duplicate `ftyp`/`moov`) → invalid file. Header comment admits it's a "placeholder until the real ffmpeg path is wired." (Common missing-`intro.mp4` case is a harmless passthrough `:121-125`; corruption only when the intro asset exists.)
- **Fix:** Route through the same Replicate cog-ffmpeg concat the stitcher uses (`includeIntro` is already implemented there), or remove the byte-concat path.

### #7 — comprehensive-validation-orchestrator is a live no-op gate — **P1**
- **Symptom:** The hollywood quality/identity validation gate (invoked at `hollywood-pipeline/index.ts:4249`) passes every clip regardless of content.
- **Root cause:** All 6 sub-validators (`validate-color-histogram`, `verify-face-embedding`, `validate-clothing-hair`, `validate-environment`, `validate-temporal-consistency`, `visual-debugger`) **do not exist** in the repo. Each missing-call handler returns `passed:true,score:70` (`comprehensive-validation-orchestrator/index.ts:170-175` etc.) → `overallPassed = avg>=70` (`:335`) always true. Also passes a video URL to image-analysis when no frame supplied (`:157`). (If these are deployed out-of-band the gate works — **UNVERIFIED**; from the repo they are absent.)
- **Fix:** Deploy/restore the sub-validators or change the missing-target handler to fail-closed (or remove the decorative gate).

### #8 — replicate-webhook avatar-async path: stale-snapshot race + 50-project cap — **P1**
- **Symptom:** Multi-clip **avatar** projects: a sibling's completed clip can be clobbered, or `allDone` never becomes true → stitch never triggers → stuck.
- **Root cause:** `replicate-webhook/index.ts:495-595` `handleAvatarAsyncPrediction` mutates and writes back a stale in-memory `tasks` snapshot (`:575-578`) and computes `allDone` from it (`:583-585`); concurrent webhooks = last-writer-wins. `check-specialized-status` got a fresh-re-read fix (`:228-242`); the webhook path did not. Separately the lookup scans only `…limit(50)` projects with pending tasks (`:99-103`) → the 51st+ unmatched/orphaned.
- **Fix:** Re-read `pending_video_tasks` inside a transaction/`upsert_video_clip`-style atomic update before computing `allDone`; key the lookup by prediction id, not a capped scan.

### #9 — check-specialized-status never marks a fully-failed avatar project terminal — **P1**
- **Symptom:** When every avatar clip fails, the response says `isFailed:true` but `movie_projects.status` is never set to `failed` — project hangs in its prior status (e.g. `processing`).
- **Root cause:** `check-specialized-status/index.ts:262-371` `handleMultiClipAvatar` only ever sets `updateData.status='completed'` (`:310,:349`); no `='failed'` branch.
- **Fix:** Add a terminal-failure branch when `allDone && failedCount===totalCount`.

### #10 — comprehensive-clip-validator: orphaned + fail-open — **P1**
- **Symptom:** N/A live (no caller), but the "MANDATORY visual debugger, never skip" guarantee is false.
- **Root cause:** `comprehensive-clip-validator/index.ts` — missing validators degrade to pass-75 (`:348-353`), top-level catch returns HTTP 200 `passed:true` (`:488-499`). Only referenced from `RESEARCH.md`.
- **Fix:** Remove or wire+fail-closed.

### Recovery infrastructure gaps (P1 cluster)
- **pipeline-watchdog disabled by default** (`:347-359`, gated on `WATCHDOG_RESUME_ENABLED`) and **not scheduled in repo** (the only cron migration `20260516045913…sql` *unschedules* it). It also still double-refunds via `increment_credits`+manual `'refund'` insert (`:1434,:1508,:1819`) — zombie-cleanup was migrated to idempotent `refund_credits`, watchdog was not. **UNVERIFIED** whether a dashboard/Mgmt-API cron runs it in prod.
- **zombie-cleanup not scheduled in repo** (`zombie-cleanup/index.ts` comment claims "every 5 minutes"; no cron). Logic is sound (recover-first + idempotent refund). **UNVERIFIED** prod schedule.
- **resume-avatar-pipeline** only understands the legacy single `pipeline_state.predictionId`; throws `Cannot resume from stage` (`:191`) for the modern `pending_video_tasks.predictions[]` async model → effectively can't recover current avatar jobs (P1).
- **job-queue** uses module-level in-memory Maps (`:54,:62,:65`) that can't persist across Deno isolates; `status` reports "Job not found", `process_batch` no-ops. Unused today.

### Playback / UI break patterns
- **TimelinePlayer has no `<video onError>` — P1.** `src/components/player/TimelinePlayer.tsx:196-211` wires onEnded/onLoadedData/onTimeUpdate but no onError; a dead/expired per-clip URL freezes the whole reel with no spinner and no skip (multi-clip `/r/:id` is the common case). Combined with BROKEN #2, expired clip URLs hang silently.
- **Reel "Still rendering…" never updates — P1.** `src/pages/Reel.tsx:646-655` shows an indefinite spinner with no realtime/poll (`useEffect` deps `[id,user?.id]` `:340`); a finished-or-dead render needs a manual refresh.
- **Recovery enum split on `processing` — P1.** `useClipRecovery.ts:53` (`.eq('status','generating')`) and `detectZombieClips` only query `generating`, missing `processing`-stuck clips; only `usePendingVideoRecovery.ts` covers both. `useClipRecovery` also omits `userId` in the `check-video-status` body so it can't flip true failures to `failed`.
- **useRenderCompleteNotifier omits `processing` — P2.** `useRenderCompleteNotifier.ts:25-30` `ACTIVE_STATUSES` lacks `processing` (a real `movie_projects` status) → completion toast skipped; also ignores the `"complete"` (singular) writer variant.
- **HLS-fallback download corruption — P2.** `Reel.tsx:284-288,:378` and `ProductionFinalVideo.tsx:19` save an `.m3u8` as `.mp4` (playlist text, not video).
- **FilmsGallery hardcoded to a foreign Supabase project — P2.** `src/pages/FilmsGallery.tsx` URLs point at `ahlikyhgcqvrdvbtkghh.supabase.co` (not prod ref `ywcwaumozoejierlfkgj`); `object/public/` so non-expiring, but blank-tiles if that bucket disappears.

### Lower severity (P2)
- generate-video: stateless, no DB row, no server recovery — orphan-prone (`generate-video/index.ts`; submit at video-engines.ts:355).
- generate-single-clip stores pred-id in `veo_operation_name` not the dedicated `replicate_prediction_id` (`:992`); survives only via webhook fallback (`replicate-webhook:89`).
- delete-clip references non-existent `video_clips.thumbnail_url` (`:172`) → dead branch; storage orphaned on remove failure.
- generate-hls-playlist embeds raw clip `video_url`s that may be expiring `replicate.delivery` links (`:128`).
- fix-manifest-audio sets `video_url` to a manifest JSON in the temp bucket (`:118`).
- check-video-status returns UPPERCASE status while writing lowercase to DB (dual vocab; fragile if a client persists the returned value).

---

## RENDER-FLOW — step-by-step trace (where it breaks)

1. **Generate clip.** Primary: `hollywood-pipeline` → `generate-single-clip` creates a Replicate prediction, registers `webhook → replicate-webhook` (`:262-266`), writes `video_clips` row `status='generating'`, stores pred-id in `veo_operation_name` (`:992`). ✅ Solid (double-fire guarded by `acquire_generation_lock` + `atomic_claim_clip`). Editor path (`editor-generate-clip`) and free-tier path register **no webhook** → ⚠️ orphan-on-abandon (BROKEN #4/#latent).
2. **Replicate finishes → writeback.** `replicate-webhook` (HMAC-verified, `verify_jwt=false`) looks up the clip by `veo_operation_name` fallback (`:89`), writes `status='completed'`, `video_url`, `last_frame_url`. ✅ for normal video. ⚠️ **avatar-async** path has a stale-snapshot race + 50-project lookup cap (BROKEN #8). Poll backups (`poll-replicate-prediction`, `check-video-status` autoComplete) also write lowercase status. Recovery hooks re-poll, but only `usePendingVideoRecovery` covers `processing` (BROKEN-cluster).
3. **All clips complete → stitch trigger.** Three entry points: `hollywood-pipeline:5808` (primary, `includeIntro:false`), `final-assembly` (editor, atomic claim), `auto-stitch-trigger` (Production page). ⚠️ **auto-stitch-trigger never finalizes the DB** (BROKEN #3).
4. **Stitch.** `seamless-stitcher` builds an ffmpeg graph (normalize→xfade→audio) and runs it via the **Replicate cog** (`:1317`), polls ≤4min, downloads + validates MP4 (`:1398-1410`), uploads to **private** `published-renders`, mints a **24h signed URL** (`:115,:1422`). ✅ ffmpeg blocker resolved. ❌ output URL is short-lived.
5. **Persist final film.** `hollywood-pipeline:6485-6503` / `final-assembly:299-331` write `movie_projects.video_url = <24h signed URL>`, `status='completed'`. The "durable" guard misses Supabase signed URLs (`isTemporaryReplicateUrl` only matches `replicate.delivery`), so the expiring URL is stored as canonical. ❌ **BREAKS HERE for longevity** (BROKEN #2 — film dead after 24h).
6. **Playback.** `/r/:id` (Reel) and `/embed/:slug` feed `video_url` into `BrandedVideoPlayer` (has error UI + retry) or `TimelinePlayer` (per-clip). ⚠️ TimelinePlayer has no onError → expired/dead clip freezes the reel (P1). ⚠️ Reel "Still rendering…" has no poll (P1).
7. **Export/download.** Reel download `fetch(video_url)`→blob: throws on an expired signed URL or an `.m3u8` saved as `.mp4`. Branded download (`brand-video-download`) produces a **corrupt MP4** (BROKEN #6). Finishing Studio (`production-finish`) is OK (7-day URL, real cog pass).
8. **Recovery.** `zombie-cleanup` (recover-first + refund) and `pipeline-watchdog` (full re-driver) are sound *in code* but **not scheduled in the repo** and the watchdog is **disabled by default**; `resume-avatar-pipeline` can't read the modern async model. `retry-failed-clip` deadlocks (BROKEN #1).

---

## Summary

- **Functions/steps audited:** ~37 edge functions + 7 hooks + player/video/stability/production components + 4 playback pages.
- **By severity:** **1 P0**, **~13 P1** (incl. UI/recovery), **~10 P2**.
- **Worst P0:** `retry-failed-clip` self-deadlocks on its own generation lock and leaves the clip permanently stuck `generating` (retry feature is unusable and bricks the clip it touches).
- **Where the back-half breaks:**
  1. **Longevity (P1, the known "24h bug"):** the canonical `video_url` is a 24h signed URL into the private `published-renders` bucket — every finished film dies after a day (BROKEN #2). The "durable URL" guard is fooled by Supabase signed URLs.
  2. **Finalization (P1):** the `auto-stitch-trigger` path never writes `status='completed'`/`video_url` to the DB → projects stuck in `stitching` (BROKEN #3). Primary `hollywood-pipeline` path does finalize.
  3. **Orphans/charges (P1):** editor + free-tier generation register no webhook/poller → charged-but-lost clips (BROKEN #4).
  4. **Validation gate is a live no-op (P1):** comprehensive-validation-orchestrator always passes because its 6 sub-validators are missing (BROKEN #7).
  5. **Avatar multi-clip (P1):** webhook stale-snapshot race + never-terminal-on-total-failure (BROKEN #8/#9).
  6. **Recovery is largely dormant:** watchdog disabled-by-default + not scheduled in repo; retry deadlocks; resume-avatar can't read the async model.
- **ffmpeg cog stitch:** resolved in code (Replicate cog); prod cog health UNVERIFIED.

Partial written to `qa-audit/partials/03-pipeline-render.md`.
