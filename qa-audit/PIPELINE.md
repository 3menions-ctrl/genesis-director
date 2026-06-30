# Genesis Director — PIPELINE.md (production-pipeline deep dive)

Focused trace of the **production pipeline** — the app's core value path — from "user clicks Create" to "final film plays / exports". The pipeline is **edge functions + Replicate**, NOT the dead Python engine. The live script generator is **`smart-script-generator`** (not `generate-script`/`generate-story`, which are orphaned). Two independent prior notes corroborate the headline breaks below (dead Editor render; final-film 24h URL bug).

Full per-half detail: `partials/02-pipeline-create.md` (front half) and `partials/03-pipeline-render.md` (back half).

---

## Architecture (verified happy path)

```
Studio.handleStartCreation (Studio.tsx:301)
  → invoke mode-router (credit pre-gate, content-safety, single-project lock, create movie_projects row)
    → handleCinematicMode → fetch hollywood-pipeline
       → reserve_credits  (HOLD — before approval)              ← P1-3
       → executePipelineInBackground (waitUntil); returns {projectId}
  → navigate /production/:projectId
       runPreProduction → smart-script-generator (+ extract-scene-identity for image-to-video)
       APPROVAL GATE (requireManualApproval = autoApprove !== true)   ← seedance skips (P3)
         → status='awaiting_approval'; persist generated_script; RETURN & WAIT
  Production.tsx renders ScriptApproval
       Regenerate → hollywood-pipeline {action:'regenerate_script'}     ← P1-2 (500s; no such action)
       Approve   → resume-pipeline {resumeFrom:'qualitygate', approvedShots}
          → hollywood-pipeline (skipApproval) → runQualityGate
               → comprehensive-validation-orchestrator                 ← P1-7 (live no-op; all validators missing)
            → runAssetCreation → generate-scene-images                 ← P2-29 (may overwrite approved storyboard)
            → runProduction → dispatch clip 1 via generate-single-clip {triggerNextClip:true}
   ════════════ CLIPS BEGIN GENERATING (front/back boundary) ════════════
       continue-production chains clips 2..N
       each clip: Replicate prediction + webhook→replicate-webhook (+ optional poll)
                  pred-id stored in veo_operation_name (not replicate_prediction_id)   ← P2 (fallback-only)
       replicate-webhook writes video_clips.status/video_url           ← P1-5 (avatar-async race + 50 cap)
       all clips done → stitch:
            primary  hollywood-pipeline → seamless-stitcher (includeIntro:false) → finalizes ✅
            editor   final-assembly (atomic claim) → finalizes ✅ (but inherits 24h URL)
            Prod page auto-stitch-trigger → seamless-stitcher           ← P1-1 (never finalizes DB)
       seamless-stitcher: ffmpeg via Replicate cog → upload to PRIVATE published-renders
                          → 24h signed URL written as canonical video_url   ← P0-1
   playback /r/:id, /embed/:slug:
       BrandedVideoPlayer (has error UI) | TimelinePlayer (no onError)  ← P1-9
       "Still rendering…" has no poll                                   ← P1-10
   export/download:
       Reel download fetch(video_url)→blob  (breaks on expired URL / .m3u8-as-.mp4)  ← P2-31
       brand-video-download (intro prepend) → corrupt MP4              ← P1-13
       generate-project-trailer → full re-render + 24h URL on share    ← P1-12
       production-finish (Finishing Studio) → 7-day URL, real cog ✅
   recovery:
       zombie-cleanup (sound, NOT scheduled in repo)                   ← P1-8
       pipeline-watchdog (sound, DISABLED by default + NOT scheduled)  ← P1-8
       resume-avatar-pipeline (blind to async model)                   ← P1-8
       retry-failed-clip → DEADLOCK, bricks clip                       ← P0-2
```

---

## Verdict by stage

| Stage | Status | Notes |
|---|---|---|
| Create entry / mode-router | ✅ sound | auth, content-safety, project insert all correct |
| Single-project lock | ⚠️ | correct, but a stuck draft 409-locks all new creates (P1-3) |
| Script generation | ✅ sound | `smart-script-generator`; older `generate-script`/`generate-story` are dead |
| Credit hold | ⚠️ | held **before** approval; UI implies charge-on-approval; leak risk if abandoned (P1-3, P2-28) |
| Script approval gate | ✅ sound | fail-closed; seedance auto-runs past it (intentional, P3) |
| **Regenerate script** | ❌ **P1-2** | 500s every time — no `regenerate_script` action in hollywood-pipeline |
| Quality gate (validation) | ❌ **P1-7** | live no-op; all 6 sub-validators missing → every clip passes |
| Asset creation (keyframes) | ⚠️ P2-29 | may overwrite approved storyboard (UNVERIFIED) |
| Clip-1 dispatch / chaining | ✅ sound | double-fire guarded (`acquire_generation_lock` + `atomic_claim_clip`) |
| Clip generation (primary) | ✅ sound | webhook registered; pred-id in `veo_operation_name` (fallback-only, P2) |
| Clip generation (editor / free-tier) | ❌ **P1-4** | no webhook/poller → charge-and-orphan |
| Webhook writeback (avatar-async) | ❌ **P1-5** | stale-snapshot race + 50-project cap |
| Terminal failure (avatar) | ❌ **P1-6** | never sets project `status='failed'` |
| Stitch (ffmpeg) | ✅ resolved | Replicate cog (no local binary); prod cog health UNVERIFIED |
| **Finalize (auto-stitch path)** | ❌ **P1-1** | never writes `completed`/`video_url` → stuck "stitching" |
| **Persist final URL** | ❌ **P0-1** | 24h signed URL into private bucket stored as canonical |
| Playback | ❌ P1-9/P1-10 | no `<video onError>`; "Still rendering…" never polls |
| Export / download | ❌ P1-12/P1-13/P2-31 | trailer wrong+expiring; branded download corrupt; HLS-as-MP4 |
| **Retry** | ❌ **P0-2** | self-deadlock; bricks the clip permanently |
| Recovery (watchdog/zombie/resume) | ❌ **P1-8** | dormant: disabled/unscheduled in repo; resume blind to async model |

---

## Where the pipeline actually breaks (narrative)

1. **The front half is not the problem.** From "Create" to clip-1 dispatch, every invoke target exists, response shapes match, and the credit hold→consume chain is coherent. The single hard front-half break is **Regenerate (P1-2)**, which — combined with the **single-project 409 lock (P1-3)** and **credits held pre-approval** — produces the classic user report: *"the pipeline failed / ate my credits / won't let me start a new one."* A user who dislikes the first draft has no working escape but Cancel.

2. **The back half is where films die.** Two breaks dominate:
   - **P0-1 (24h URL):** every finished film's canonical `video_url` is a 24-hour signed URL into a *private* bucket; the "durable URL" guard only recognizes `replicate.delivery`, so the expiring URL is stored as permanent. **Every film stops playing/downloading about a day after it's made.** This single bug likely explains most "my video is broken" reports from returning users.
   - **P1-1 (no finalize):** films stitched via the Production-page auto-stitch path never get `status='completed'`/`video_url` written to the DB → stuck "stitching" forever after a fleeting client-side "ready". (The primary hollywood path and the editor `final-assembly` path *do* finalize.)

3. **When a clip fails, the system makes it worse.** **Retry (P0-2)** deadlocks on the project generation lock and leaves the clip permanently `generating` and un-retryable. And recovery that should catch this is **dormant (P1-8)** — the watchdog is disabled-by-default and not scheduled in the repo, zombie-cleanup isn't scheduled, and resume-avatar can't read the modern async model. (UNVERIFIED whether an out-of-band Mgmt-API cron runs them in prod.)

4. **Money leaks at the edges.** Editor and free-tier clips **charge then orphan** (P1-4, no webhook). Photo edits **charge but never refund** on failure (P1-15, a scope `ReferenceError`). Photo idempotency is dead so retries **double-charge** (P2-26).

5. **Quality gating is theater.** The hollywood validation gate passes 100% of clips because its 6 sub-validators don't exist in the repo (P1-7).

---

## Highest-leverage pipeline fixes (in order)

1. **P0-1** — store the stitched master in a public bucket / re-sign on read (stops every film dying after 24h).
2. **P0-2** — thread the held lock into `generate-single-clip`; revert+release on catch (Retry becomes usable, stops bricking clips).
3. **P1-1** — finalize `status='completed'`+`video_url` in the auto-stitch path.
4. **P1-2 + P1-3** — implement `regenerate_script`; auto-expire stale `awaiting_approval` drafts + one-click cancel-and-restart; release pre-approval holds on TTL.
5. **P1-4** — register the webhook (or a pending row) for editor/free-tier clips.
6. **P1-8** — schedule + enable recovery (zombie-cleanup, watchdog without double-refund) and teach resume-avatar the async model.
7. **P1-5/P1-6** — atomic re-read in the avatar webhook; add a terminal-failure branch.
8. **P1-7** — restore/deploy the validators or fail-closed.
9. **P1-9/P1-10** — add `<video onError>` skip and a status poll on the Reel page.
10. **P1-12/P1-13** — fix trailer (real clips-mode + durable URL) and branded download (cog concat).

**Prod-state checks needed (UNVERIFIED):** whether the Replicate stitch cog version is healthy; whether any Mgmt-API cron runs zombie-cleanup/watchdog; whether the credit-hold reconciler covers abandoned `awaiting_approval` drafts; whether the validation sub-validators were deployed out-of-band.
</content>
