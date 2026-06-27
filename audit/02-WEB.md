# 02 — Web App: Deep Feature Trace

> Surface: public web app (`index.html` → `src/main.tsx` → `src/App.tsx`, 106 routes), Vite/React, Cloudflare Pages. Branch: `full-audit`. Backend = shared Supabase (see `00-STRUCTURE.md`, `04-CROSS.md`).
> This report combines four independent deep traces: (A) render/assembly pipeline + FFmpeg/Wan/Python lifecycle, (B) client playback + audio (crossfade/A-V sync), (C) AI generation + clip/library persistence + templates, (D) core flows (auth/session, credits/billing, projects, editor).

## Web feature-area tally (roll-up)

| Area | DONE | PARTIAL | BROKEN | MISSING |
|---|---|---|---|---|
| Render / assembly pipeline (A) | ~6 | 9 | 4 | 1 |
| Playback / audio (B) | 4 | 5 | 1 | 2 |
| AI generation / library / templates (C) | 15 | 8 | 7 | 5 |
| Core: auth / billing / projects / editor (D) | ~6 | 4 | 4 | 0 |

See each section for the evidence behind every rating.

---

# Section A — Render / Assembly Pipeline (+ FFmpeg / Wan / Python lifecycle)

# Genesis Director — VIDEO RENDER / ASSEMBLY Pipeline Audit

Scope: end-to-end trace of clip generation → stitch → final video, async job
orchestration, orphaned-process risk, the Python `breakout_pipeline`, and A/V
audio assembly. READ-ONLY. Evidence cited as `path:line`. All paths under
`/Users/briancole/Developer/genesis-full-audit`.

---

## 0. The actual end-to-end call chain (verified)

There is **no ffmpeg in Deno and no Python in the live path**. All pixel work
runs on **Replicate** (a hosted FFmpeg model + the clip-gen models). Deno edge
functions are pure orchestration.

```
CLIENT
  └─ mode-router (front door)                       mode-router/index.ts:520 switch(mode)
        ├─ effectiveEngine==='seedance' ─► seedance-pipeline        mode-router:1215-1220 fetch
        └─ else (kling/wan/veo/sora)   ─► hollywood-pipeline        mode-router:1215-1220 fetch

  hollywood-pipeline (sequential, 1 clip/invocation)  hollywood-pipeline/index.ts:6563
        └─ generate-single-clip (clip 1, triggerNextClip)  hollywood:3671-3762
              └─ [Replicate Kling V3 dispatch + upload to bucket 'video-clips'  generate-single-clip:876-905]
                    └─ on clip complete ─► continue-production         (webhook/poll/watchdog driven)

  seedance-pipeline (ALL clips in parallel)            seedance-pipeline/index.ts:331
        └─ dispatchSeedanceClip ×N (Promise.allSettled) seedance:808-888
              └─ Replicate bytedance/seedance-2.0       seedance:45-46,296
              └─ registers replicate-webhook + fires poll-replicate-prediction  seedance:289,863-883

  continue-production (clip N done → next or final)    continue-production/index.ts:101
        ├─ more clips ─► generate-single-clip (next)    continue:1053-1106
        └─ last clip  ─► final-assembly (3× backoff)    continue:141-177

  final-assembly (orchestrator, atomic stitch claim)   final-assembly/index.ts:52,144-173
        └─ seamless-stitcher (THE real stitch)          final-assembly:202 fetch

  seamless-stitcher (xfade+acrossfade+loudnorm)        seamless-stitcher/index.ts:207
        └─ runFfmpeg → Replicate FFmpeg model            seamless:103-104,1185-1212
              └─ output mp4 ─► bucket 'published-renders'  seamless:109,1293-1306 (24h signed URL)
              └─ movie_projects.video_url + stitched_at    seamless:1003-1009
```

Two **alternate / parallel** stitch entry points exist:
- `auto-stitch-trigger` → `seamless-stitcher` (clip-completion gate)  `auto-stitch-trigger/index.ts:100,229`
- `render-video` (editor edit-session export) → a **different**, naive
  hard-cut model `bfirsh/concatenate-videos`  `render-video/index.ts:24,236-248`

---

## 1. RENDER PIPELINE — stage ratings

| Function | Rating | Evidence |
|---|---|---|
| mode-router | DONE | auth/safety/lock/credit + engine routing `mode-router:267-366,520-594,1215-1220` |
| hollywood-pipeline | PARTIAL | callback-chain dispatch works `:6563-6912,3671-3785`; its **own** stitch block `:5596-5656` is dead under normal flow; carries dead `buildVeoContinuityDNA` block `:3405-3494` |
| seedance-pipeline | PARTIAL | clean parallel dispatch `:808-948`; returns `success:true` on **partial dispatch failure with no refund** for undelivered clips `:890-948`; no version pin `:45` |
| continue-production | PARTIAL | branch + 3× retry + refund `:141-218`; **no idempotency guard** on duplicate completion callbacks `:1053` |
| resume-pipeline | PARTIAL | stage detection + double-charge guard `:109-274`; **no claim/lock** — concurrent resumes race `:255-326` |
| retry-failed-clip | BROKEN | atomic lock `:117`, but **error path never releases the generation lock** `:411-428` (comment admits it) → orphans the project mutex |
| final-assembly | DONE | atomic dedup stitch claim `:144-173`, ghost-URL guard `:262-266`, error reset `:361-372`; correctly delegates stitch |
| seamless-stitcher | DONE (w/ orphan bug) | real normalize/color/audio/xfade/loudnorm + idempotency cache + mp4 magic-byte check `:1286-1291`; orphan on timeout (see §2) |
| auto-stitch-trigger | BROKEN | **both failure paths mark project `status='completed'` with NO stitched video** `:233-263` (`clips_only`), `:294-323` (`error_recovery`); hardcoded expected-clip default 6 `:176` |
| render-video | PARTIAL | works but naive hard-cut model `:24,236-248`, persists final export to a bucket literally named **`temp-frames`** `:137`, falls back to expiring Replicate URL on persist failure `:151-153`, never cancels predictions |

**Where stitching physically happens:** Replicate-hosted FFmpeg model, version
`efd0b79b...` pinned at `seamless-stitcher:103-104`, submitted at
`seamless-stitcher:1198-1212`. NOT Deno, NOT Python, NOT Shotstack.
`brand-video-download/index.ts:18` confirms "Edge Functions run on Deno Deploy
with no native ffmpeg."

**Persistence:** project state in `movie_projects` (`status`, `pipeline_stage`,
`pending_video_tasks` jsonb, `video_url`, `stitched_at`); per-clip in
`video_clips` (`status`, `replicate_prediction_id`, legacy `veo_operation_name`,
`shot_index`, `video_url`). Clips → bucket `video-clips`; final mp4 →
`published-renders` (private, signed URL); editor export → `temp-frames`
(public). Stitch failures logged to `render_failures`
(`seamless-stitcher:1090-1097`).

---

## 2. FFMPEG / PROCESS LIFECYCLE & ORPHAN RISK

**No local OS-process orphan risk** — there is **zero** `Deno.Command` /
`child_process` / `spawn` anywhere in `supabase/functions` (grep, empty). FFmpeg
runs remotely on Replicate. The orphan unit is the **remote Replicate
prediction**.

**The cancel endpoint is called in only 3 places — all user-initiated:**
```
delete-project/index.ts:90    POST /v1/predictions/{id}/cancel
cancel-project/index.ts:215   POST /v1/predictions/{id}/cancel
delete-clip/index.ts:142      POST /v1/predictions/{id}/cancel
```

**On AUTO-failure / timeout / stall there is NO cancel anywhere:**
- `seamless-stitcher` `runFfmpeg` submits a prediction `:1198` then on
  `replicate_poll_failed` `:1238`, `replicate_timeout_after_4m` `:1259`,
  `succeeded_but_no_url` `:1253` **throws without cancelling**. The prediction id
  is local-only (never persisted) → can never be reaped. Concrete cost leak on
  every stitch timeout.
- `render-video` submits `:236-257`, stores id `:266`, **never cancels**.
- `seedance-pipeline` fires N parallel predictions; on later pipeline error the
  in-flight siblings keep running and bill on completion.
- `zombie-cleanup` and `pipeline-watchdog` only GET-poll for recovery, then flip
  DB `status='failed'` (`zombie-cleanup:304,464`; `pipeline-watchdog:988-990`
  "ZOMBIE PREDICTION" marks DB failed) — **never POST /cancel**. Comment at
  `pipeline-watchdog:342` references a prior "Replicate credit-exhaustion
  incident."

**Cleanup function ratings:**
| Function | Rating | Evidence |
|---|---|---|
| cancel-project | DONE | real recursive cancel `:108-223` + storage delete `:237-252` + idempotent refund `:298-355` (only if `replicateApiKey` set `:209`; unpersisted ids not cancelled) |
| reconcile-credit-holds | DONE | RPC `reconcile_pipeline_credit_holds()` `:39`; **DB fn scheduled** every 5 min `migration 20260704001200:30-41` |
| zombie-cleanup | PARTIAL | recover/fail/refund + stale-lock release `:642-671`; never cancels Replicate; **no in-repo cron** |
| pipeline-watchdog | BROKEN | **kill-switched off by default** `:341-359` (`WATCHDOG_RESUME_ENABLED!=="true"` → returns `{disabled:true}`) AND **explicitly unscheduled** `migration 20260516045913:1-2` |
| admin-stuck-jobs-watchdog | PARTIAL | RPC `detect_stuck_pipeline_jobs()` → invokes the disabled watchdog `:30-37`; **no in-repo cron** |

**Scheduling reality (only 3 `cron.schedule` migrations exist):** scheduled =
`reconcile_pipeline_credit_holds`, `expire_credit_holds`, storage billing,
monthly refills. **NOT scheduled in-repo:** `zombie-cleanup`,
`admin-stuck-jobs-watchdog`, `pipeline-watchdog`. UNVERIFIED whether the
Supabase dashboard wires these out-of-band.

**ORPHAN RISK: MEDIUM–HIGH.** Mitigating: user cancel/delete cancels properly;
credit-hold ledger is independently reconciled on a real 5-min cron so money
self-heals. Aggravating: (a) no auto-failure path cancels Replicate → every
timeout leaves a billable prediction running; (b) the watchdog is double-dead
(kill-switch + unscheduled) so stalled renders are not auto-remediated; (c) the
row-level reapers have no verifiable schedule.

---

## 3. PYTHON breakout_pipeline — ORPHANED / DISCONNECTED (proven)

Standalone offline GPU CLI tool: CogVideoX/Hunyuan via `diffusers`
(`video_generator.py:54-104`), local ffmpeg/moviepy assembly
(`assembler.py:39-128`), VFX/audio/enhance modules. Entry points are
`cli.py:68 main()` (`python -m breakout_pipeline.cli`) and
`breakout_pipeline.py:49 render()`. It writes mp4 + thumbnail + manifest.json to
a **local dir** (`breakout_pipeline.py:193-229`).

**Proof it is NOT wired to the live app:**
- Grep `breakout_pipeline|render_from_template_dict|crossover_browse` across the
  whole repo (excluding `node_modules`, `.claude/worktrees`) returns hits **only
  inside `python/`** and migration files that define the `vfx_templates` table.
  Zero TypeScript/edge references.
- **No** `Deno.Command` / subprocess / shell-out anywhere in
  `supabase/functions` (grep empty). Nothing can invoke a Python process from
  Deno Deploy anyway.
- `seedance-pipeline` (which the README claims is the caller) dispatches to
  Replicate `bytedance/seedance-2.0` and has **no `crossover` source-mode branch**
  (the only "crossover" hit in functions is `svg-rasterize`, unrelated).
- No Dockerfile / worker / queue-consumer / systemd unit / CI workflow for the
  Python code (`find` → only `python/requirements.txt`).

**The integration is fictional.** `python/README.md:124-138` describes a
"seedance-pipeline job worker" that reads `template_slug`, "shells out to
`python -m breakout_pipeline.cli`", uploads to `final-videos/{project_id}/
breakout.mp4`, and marks the project complete. **No such worker exists in the
repo.** The Python `cli.py:43-65` can pull a `vfx_templates` row over public
REST, but nothing in the product ever launches `cli.py`. Rating: **MISSING
(disconnected offline tool); documented wiring is BROKEN/non-existent.**

---

## 4. JOB ORCHESTRATION

**Two disconnected worlds:**
- **`job-queue/index.ts` is DEAD/BROKEN.** Pure **in-memory** `Map` queue on a
  stateless serverless runtime: `:53-54` comment "In-memory job queue (in
  production, use Redis or database)", `:62` `activeJobs`, claim via
  `queue.shift()` `:187-192`. Every isolate has its own queue → jobs lost
  between invocations; rate limits per-isolate. **Zero call sites** in `src/` or
  functions (only QA-audit markdown mentions it). Not atomic, not used.
- **The real orchestration is DB + webhook + watchdog.** Atomic claim is the SQL
  RPC `atomic_claim_clip` (`pipeline-watchdog:486`; definition
  `migration 20260222011902_...:2,22-23` uses `... FOR UPDATE` on
  `movie_projects` + claim-token in `pending_video_tasks`). `final-assembly`
  also has an atomic conditional-UPDATE stitch claim `:144-156` preventing
  double-stitch.

| Function | Rating | Evidence |
|---|---|---|
| job-queue | BROKEN | in-memory `Map`/`shift()` on stateless isolates `:53-65,187-192`; zero call sites |
| mode-router | DONE | full guards + engine routing (see §1) |
| replicate-webhook | DONE | HMAC sig verify (Svix scheme) `:43-50` → `_shared/auth-guard.ts:182-226` (5-min tolerance, constant-time compare, fails closed); idempotent `:153`; handles `failed`/`canceled` for clip `:303`, avatar `:597`, stitch `:475`; media+cost logging |
| poll-replicate-prediction | PARTIAL | service-role gated, idempotent `:87`, bounded self-chain `MAX_CHAIN_DEPTH=30` `:17` → watchdog handoff `:365-374`; **fire-and-forget self-chain can silently die** `:380-395`; hardcoded cost `22.4¢` + duration `10` `:316-318`; claims "PRIMARY" `:22` contradicting webhook `:27` |
| check-video-status | PARTIAL | auth/refund solid; **`autoComplete` write path is non-atomic check-then-write** `:212-246` → can double-insert/clobber racing webhook/watchdog |

**Tracking:** webhook-primary, pollers as backup; prediction id + status in
`video_clips.replicate_prediction_id` / `veo_operation_name` and
`movie_projects.pending_video_tasks.predictions[]`. **Stuck-job reaper** is
`pipeline-watchdog` (zombie >15min `:979-990`, retries `:1691`) — but it is
kill-switched + unscheduled (see §2). `video_clips` has no generic
`attempts`/`claimed_at` columns; retry state is split across JSON blobs + the
(inert) watchdog.

**Races:** webhook/watchdog/poller can all complete the same clip — mitigated by
idempotency guards + `atomic_claim_clip`, EXCEPT `check-video-status`
`autoComplete` (non-atomic) and the webhook-before-DB-write drop
(`replicate-webhook:146-149` returns `{ignored:true}`). `resume-pipeline` and
`continue-production` hold no lock themselves; safety leans entirely on the
`generate-single-clip` generation mutex + `final-assembly`'s atomic stitch claim.

---

## 5. AUDIO IN ASSEMBLY

**Real A/V muxing happens only in `seamless-stitcher` (on Replicate FFmpeg)** —
and it IS synced muxing, not naive concat:
- per-clip audio normalize `aresample`/`aformat` `:1149-1166`, `acrossfade`
  aligned with video `xfade` (`buildSeamlessCommand`, `_shared/seamless-command.ts`),
  `loudnorm` master `:1160-1166`, sidechain `autoDuck` (music under voice)
  `:883`, keyframed volume `compileAudioKeyframeChain:620`, aux tracks aligned
  via `adelay`, final `-c:a aac -b:a 192k` `:1174-1177`.
- `final-assembly` does **no muxing itself** — it only forwards `masterLoudness`
  / `autoDuck` / `transitions` knobs to the stitcher `:208-225`.
- `render-video`'s editor path is **naive hard-cut** (`bfirsh/concatenate-videos`,
  `videos: validUrls` `:245`) — no audio sync control.

**Audio support functions (planning/utility, not muxing):**
- `sync-music-to-scenes` — produces a **plan + music prompt only** (emotional
  beats, timing markers, ducking volumes, composer mapping); returns JSON, never
  touches A/V `sync-music-to-scenes:301-341`. Rule-based emotion keywords `:74-83`
  with optional AI via `scene-music-analyzer` `:147-166` (failure swallowed `:167-169`).
- `fix-manifest-audio` — one-off utility rewriting a manifest JSON with
  `masterAudioUrl`+`muteClipAudio:true` to the **public** `temp-frames` bucket
  `:94-105`. Implies a separate manifest-based player path coexists with the
  baked-stitch path (two audio models in flight).
- `regenerate-audio` — regenerates voiceover narration for an existing project
  `regenerate-audio:9-13`; ownership-guarded `:55-60`.

A/V sync verdict: **DONE for the pipeline (stitcher) path; PARTIAL overall** —
the editor `render-video` path and the manifest path are weaker / inconsistent.

---

## FLAGGED TODO / STUB / HARDCODED / SWALLOWED (render paths)

- **Fake success (highest severity):** `auto-stitch-trigger:233-263,294-323`
  marks project `completed` with NO stitched video. `seedance-pipeline:890-948`
  returns `success:true` on partial dispatch failure, no refund.
- **Orphaned Replicate predictions:** `seamless-stitcher:1235-1259`,
  `render-video` (no cancel), seedance siblings — never cancelled on
  failure/timeout.
- **Orphaned mutex:** `retry-failed-clip:411-428` never releases generation lock
  on error.
- **Dead/inert code:** `job-queue` (in-memory, uncalled); `pipeline-watchdog`
  (kill-switch `:347` + unscheduled migration `20260516045913`);
  `hollywood-pipeline:3405-3494` dead Veo block & `:5596-5656` dead stitch;
  Python `breakout_pipeline` (disconnected); dead imports
  `check-video-status:5-6`.
- **Hardcoded values:** stitcher/concat model versions `seamless-stitcher:103`,
  `render-video:24`; expected-clip defaults 6/5/3 across `auto-stitch-trigger:176`,
  `render-video:114`, `resume-pipeline:300`, `poll-replicate-prediction:278`,
  `replicate-webhook:358`, `check-video-status:264`; Kling cost `22.4¢` +
  duration `10` `poll-replicate-prediction:316-318`; quality-credit fallback
  `seamless-stitcher:932`; intro `duration:7.5` `:1340`; notification URL
  `smallbridges.co` `auto-stitch-trigger:90`.
- **Swallowed errors (success not blocked):** `render-video:106-113,151-153`;
  `seamless-stitcher:992-994,1010-1012,1313-1342`; `final-assembly:329-331`;
  `auto-stitch-trigger:95-97`; `poll-replicate-prediction:307-309,331`;
  `replicate-webhook:255,291,419-421`; `check-video-status:297-305`;
  `sync-music-to-scenes:167-169`; `retry-failed-clip:367-370`.
- **Text-overlay fidelity stub:** `seamless-stitcher:354-358` (needs Deno-side
  SVG→PNG rasterizer; degrades gradients/glow to solid color).

---

## TALLY

| Rating | Count | Functions |
|---|---|---|
| DONE | 5 | mode-router, final-assembly, seamless-stitcher (core), replicate-webhook, cancel-project, reconcile-credit-holds → (6 incl. reconcile) |
| PARTIAL | 8 | hollywood-pipeline, seedance-pipeline, continue-production, resume-pipeline, render-video, poll-replicate-prediction, check-video-status, zombie-cleanup, admin-stuck-jobs-watchdog (9) |
| BROKEN | 4 | auto-stitch-trigger, retry-failed-clip, job-queue, pipeline-watchdog |
| MISSING | 1 | python/breakout_pipeline (disconnected; documented wiring non-existent) |
| UNVERIFIED | — | out-of-band cron scheduling of the 3 reapers (Supabase dashboard); Kling model id/version + clip upload live in generate-single-clip (not in the 5 orchestrators) |

(Counts approximate; reconcile-credit-holds tipped DONE → 6 DONE, 9 PARTIAL.)

## TOP RENDER-SUBSYSTEM RISKS

1. **Orphaned Replicate predictions on every auto-failure (cost leak).** No
   timeout/stall/error path cancels predictions; only user delete/cancel does
   (`seamless-stitcher:1235-1259`, watchdog `:988-990`). Prior
   "credit-exhaustion incident" already noted at `pipeline-watchdog:342`.
2. **Watchdog is double-dead.** Kill-switched off by default
   (`pipeline-watchdog:347`) AND unscheduled (`migration 20260516045913`). The
   primary stuck-render reaper does nothing → stalled projects linger; pollers'
   "deferred_to_watchdog" handoff lands nowhere.
3. **Ghost "completed" projects.** `auto-stitch-trigger` marks projects complete
   with no stitched video on both failure paths `:233-263,294-323` — ships empty
   renders to the user's library.
4. **A/V sync is correct only in the stitcher path.** Editor `render-video` uses
   naive hard-cut concat (no audio sync); a separate manifest+muteClipAudio model
   (`fix-manifest-audio`) coexists → two inconsistent audio assembly models.
5. **Orphaned generation mutex** on `retry-failed-clip` error `:411-428` blocks
   further generation until a stale-lock guard clears it.
6. **No durable job queue.** `job-queue` is dead in-memory scaffolding;
   orchestration leans on fire-and-forget self-chains + the inert watchdog as the
   only backstop; `check-video-status` autoComplete write is non-atomic.
</content>

---

# Section B — Playback & Audio (crossfades, A/V sync)

# Web Playback & Audio Audit — Genesis Director

Branch: `full-audit`. Scope: client-side video playback + audio (crossfades, A/V sync). READ-ONLY trace.
Deps: `hls.js@^1.6.15` (only streaming lib). No `wavesurfer`, no `Tone.js`, no `ffmpeg.wasm` on the client.

Two completely separate playback engines exist:

| Surface | Engine | File |
|---|---|---|
| Public / final-video player (landing, share, embed, production, reel) | `BrandedVideoPlayer` (hls.js) | `src/components/intro/BrandedVideoPlayer.tsx` |
| Editor program monitor (multi-clip timeline preview) | `StitchedPlayer` (dual `<video>` + canvas compositor + Web Audio) | `src/pages/Editor/components/StitchedPlayer.tsx` |
| Render-free "watch your edit" player (read-only) | `TimelinePlayer` (A/B `<video>` ping-pong) | `src/components/player/TimelinePlayer.tsx` |
| Library/grid thumbnails | `LazyVideoThumbnail` (canvas frame extract) | `src/components/ui/LazyVideoThumbnail.tsx` |
| Final bake (server) | `seamless-stitcher` FFmpeg (xfade+acrossfade+loudnorm) | `supabase/functions/seamless-stitcher/index.ts` |

This is the central finding: **the editor preview, the render-free preview, and the server bake are THREE different audio/video pipelines** that approximate each other. None of them is the "same path" as final playback.

---

## 1. PREMIUM PLAYER — `BrandedVideoPlayer` — **DONE (with caveats)**

### Call chain / wiring
- Used by: `ExamplesGallery`, `PublicShare:178`, `EmbedPlayer:85`, `Production.tsx:1849`, `ProductionFinalVideo:173`, `Reel:646`, `TrainingVideo:732`, `CreationHub:979`. This is the real "premium player."
- HLS attach: `BrandedVideoPlayer.tsx:261-338`.
  - `isHlsManifest()` (`:132`) detects `.m3u8` / `application/vnd.apple.mpegurl`.
  - Native HLS first: `canPlayHlsNatively()` (`:135` `video.canPlayType(...)`) → Safari/iOS get `video.src = url` directly. **Correct.**
  - Else `Hls.isSupported()` (`:281`) → `new Hls({maxBufferLength:30, maxMaxBufferLength:60, startLevel:-1, enableWorker:true})`, `loadSource`/`attachMedia`. **Correct.**
  - Quality picker driven by `MANIFEST_PARSED` → `hls.levels` (`:291-297`); `setQuality` writes `hls.currentLevel` (`:365-371`). **DONE.**
  - Error recovery: `Hls.Events.ERROR` (`:301`) — only acts on `fatal`. On `NETWORK_ERROR` it tries a naive `.m3u8 → .mp4` URL guess (`:305-313`), else sets error + dispatches `branded-video:error`. **PARTIAL:** does NOT call `hls.startLoad()` / `hls.recoverMediaError()` — the canonical hls.js recovery ladder for `MEDIA_ERROR` is absent; a recoverable media (buffer-append) error is treated as terminal. Network errors that aren't an `.mp4` sibling are also terminal.
  - Cleanup destroys hls + clears `src` + `load()` on unmount (`:324-337`) — good for connection/instance leak.
- Buffering UI: `waiting`/`canplay`/`playing` listeners (`:341-355`) → spinner. **DONE.**

### Where src comes from
- `resolvedSrc` (`:196-210`): if `src` prop given, use it; else fetch `movie_projects.video_url` by `projectId` via Supabase. **No signed-URL generation, no `createSignedUrl`** — it consumes whatever URL is stored (public bucket URL or a `manifest_*.json` URL). No 404/expiry handling at this layer (relies on hls.js error or VideoSourceValidator if caller used it).
- `generate-hls-playlist` edge function exists in `supabase/functions/` but **is NOT invoked anywhere in `src/`** (grep returns zero client call sites). HLS playlists are produced offline/by the pipeline and surfaced as stored URLs. In `ExamplesGallery`, the HLS URL is pulled by `parseManifestForHLS()` (`ExamplesGallery.tsx:26-40`) which `fetch()`es the `manifest_*.json` and reads `data.hlsPlaylistUrl`. If that field is absent it returns `null` and falls back to playing the raw `manifest.json` URL as a video `src` (`ExamplesGallery.tsx:285-299`) — **BROKEN fallback path: a `.json` manifest is not a playable media source**, it will simply error and `onError` auto-advances. So manifests lacking `hlsPlaylistUrl` silently skip.

### Risks
- `isManifestUrl` (`ExamplesGallery.tsx:14`) keys on `url.endsWith('.json') || url.includes('manifest_')` — brittle string sniffing.
- Admin has a SECOND independent hls.js wiring (`AdminProjectsBrowser.tsx:107-112`) — duplicate logic, divergence risk, no error handler there.

**Verdict: DONE for the happy path (adaptive HLS + native Safari + quality + buffering). PARTIAL on error recovery (no media-error recovery ladder) and on the manifest-without-hlsPlaylistUrl fallback.**

---

## 2. EDITOR / PREVIEW PLAYBACK — `StitchedPlayer` + `PlayerCanvas` — **PARTIAL**

### Call chain
`PlayerCanvas.tsx:1143` mounts `<StitchedPlayer ref={stitchedRef} clips={clips} playheadSec=...>`. Transport (play/pause/JKL/seek/PiP/snapshot/fullscreen) is routed through the imperative handle `stitchedRef` (`PlayerCanvas.tsx:629-797`). The store playhead (`setPlayhead`) is the source of truth; `StitchedPlayer` reacts to `playheadSec` and emits `onTimeUpdate`/`onClipEnded` back.

### How it previews the assembled timeline
- `StitchedPlayer` owns **two** `<video>` elements (A/B) always mounted, `opacity:0`, and paints a **canvas compositor** (`StitchedPlayer.tsx:648-771`) reading frames via `drawImage`. One slot "shows"+plays, the other preloads the next clip. Boundary = role flip (no src swap on the playing element). This is a genuine NLE-style ping-pong. **Strong implementation.**
- Boundary detection via rAF (`:332-361`) at 60Hz with an `ended` safety net (`:309-316`); store writes throttled to ~12Hz (`:331`). Good.
- PRIME (1.0s→0.32s) + ROLL (last 320ms) pre-roll the hidden buffer's decoder (`:399-499`) so the swap is seamless. Elaborate and race-guarded.

### Divergence risks (the core problem)
- **Preview ≠ render transitions.** `StitchedPlayer` performs a **fixed 320ms cross-dissolve at EVERY clip boundary** (`CROSSFADE_MS=320`, `:636`; canvas blends both buffers when `remaining < CROSSFADE_MS/1000`, `:730-751`) **regardless of whether the user authored a transition**. The server bake (`seamless-stitcher`) also "always crossfades" but at `DEFAULT_TRANSITION_DURATION` (0.4s, body-overridable, per-boundary kind/duration honored — `seamless-stitcher` `:170-180,232-233`). So preview shows a 0.32s fade on joins where render produces a 0.4s fade or a user-specified `fadeblack`/`dissolve`. **Preview crossfade duration and kind do not match the export.**
- **Dead authored-transition preview path.** `PlayerCanvas` still computes `xfadeInfo` from `project.transitions` (`:400-414`) and runs a B-buffer crossfade effect (`:587-621`) on `videoBRef` — but `videoBRef` is **never attached to any element** (StitchedPlayer owns the buffers; comment at `:313-324`). So the authored-transition visual preview through `videoBRef` is a **no-op**. Only two things survive: (a) the `fadeblack`/`fadewhite` solid-pane overlay (`PlayerCanvas:1203-1219`) and (b) the StitchedPlayer opacity prop is multiplied by `(1 - xfadeInfo.progress)` (`:1150-1154`) — which, layered on StitchedPlayer's own internal 320ms crossfade, can **double-fade** authored crossfades.
- **Legacy dead `videoRef` path.** `PlayerCanvas`'s own `videoRef` + Effect-A timeupdate/seek chain (`:440-572`) is documented dead since StitchedPlayer landed; `videoRef` is never attached. Transport correctly routes through `stitchedRef`, but ~130 lines of dead effect code remain and could mislead future edits (multiple-source-of-truth smell).
- VuMeter (`PlayerCanvas:228-301`) is explicitly **pseudo-real** (sine+random jitter, `:265-273`), not driven by an AnalyserNode. Cosmetic — labeled as such.

**Verdict: PARTIAL. The dual-buffer preview WORKS, but it is a separate engine from final render, it crossfades every boundary at a fixed 320ms unlike the bake, and the authored-transition preview wiring is largely dead/double-applied.**

### Render-free preview — `TimelinePlayer` — **PARTIAL (has a seek/advance bug)**
- Self-contained A/B player (`TimelinePlayer.tsx`), simpler than StitchedPlayer (CSS opacity swap, no canvas, no Web Audio — just `<video>.volume/.muted`).
- **Edge-case bug — seek breaks the A/B parity invariant.** `advance()` picks the "soon-to-be-active" element by index parity: `(i % 2 === 0 ? bRef : aRef)` (`:120`). This only holds because `activeKey` and `index` start aligned and advance together. But `seekToGlobal()` (`:165-182`) changes `index` to an arbitrary target **without flipping `activeKey`**. After a seek to a non-adjacent clip whose parity no longer matches `activeKey`, the next `advance()` rewinds the WRONG buffer and the swap can show a stale/incorrect clip. Real, reproducible by scrubbing across multiple clips then letting it play to a boundary.
- Zero-length clips: `starts` uses `Math.max(0.1, durationSec)` (`:77`) but `onActiveTime` only auto-advances when `clip.durationSec > 0` (`:131`); a 0-duration clip relies solely on `onEnded`. Minor.

---

## 3. AUDIO / CROSSFADES — **PARTIAL (client crossfade exists but clobbers per-clip mix)**

### Is audio mixed client-side?
Yes — a full Web Audio chain per buffer: `useAudioMixChain` (`src/hooks/editor/useAudioMixChain.ts`). Topology (`:41-201`): `source → lowShelf → midPeak → highShelf → compressor → stereoPanner → masterGain → destination`. Mirrors the FFmpeg bake (`src/lib/editor/audio-mix.ts` doc `:1-26`; server compiler `_shared/audio-mix-filters.ts`). `MediaElementAudioSourceNode` cached per-element in a `WeakMap` (`:51`) because it can only be created once — and the code is very careful about NOT re-keying the `<video>` (StitchedPlayer comment `:804-810`). Fallback passthrough on graph-build failure routes `source→gain→destination` so audio isn't silently captured-and-muted (`:186-200`). **Thoughtful.**

### Crossfade boundary logic
- Audio crossfade is driven from the **canvas rAF loop**, not a dedicated audio scheduler: during the last `CROSSFADE_MS=320ms`, `StitchedPlayer.tsx:738-751` computes equal-power `cos/sin` curves and calls `setElementGain(showingEl, cos)` + `setElementGain(hiddenEl, sin)` **every frame**. Outside the window it calls `setElementGain(showingEl, 1)` every frame (`:757`). A separate role-flip effect `rampElementGain(a/b, 1/0, 60ms)` on `isShowingA` change (`:605-619`) also writes `master.gain`.
- **BUG — per-clip volume/mute is clobbered during playback.** `applyMix()` sets `master.gain = volume × makeup` and `0` when muted (`useAudioMixChain.ts:206-237`). But the canvas loop unconditionally writes `setElementGain(showingEl, 1)` every frame while playing (`StitchedPlayer.tsx:757`) and `cos/sin` (0..1) during the fade (`:750-751`). These overwrite the per-clip `mix.volume`, `mix.muted`, and compressor makeup gain. **Net effect: a clip with reduced volume or `muted:true` in its AudioMix will play at unity gain in the editor preview** (until the next `applyMix` fires, which is only on mix-fingerprint change, not per frame). This is a real multiple-writer race over `master.gain` (three writers: `applyMix`, `rampElementGain`, `setElementGain`).
- **Element-level vs node-level gain split.** Master volume/mute from the transport (`PlayerCanvas:809-814`) goes through `handle.setVolume`/`setMuted` which write `el.volume`/`el.muted` (`StitchedPlayer.tsx:569-576`) — i.e. the **HTMLMediaElement** gain, a different control surface than the Web Audio `master.gain`. Two independent gain stages with no single source of truth.
- **First/last clip:** crossfade only triggers when a hidden buffer is loaded AND playing AND `remaining<320ms`. Last clip has no next buffer → no fade-out, hard stop (consistent with bake's tail, acceptable). First clip: prime/decode + an explicit mount-prime play→pause (`:159-197`) that mutes during prime — looks handled.
- **Autoplay-blocked degradation:** if `hidden.play()` is rejected (no gesture), both the visual blend (needs `!hidden.paused`, `:732`) and audio crossfade fail together → graceful hard cut. OK.
- **Overlapping fades:** because the fade always runs in the last 320ms and the next clip starts at currentTime 0, two clips shorter than ~0.7s could chain fades; not specifically guarded, but ROLL only fires once per `nextClipId`.

### Test coverage
`src/test/hooks/useAudioMixChain.test.tsx` has 4 tests (`:57-83`) — all jsdom null-safety/leak checks. **No test exercises actual gain output, the crossfade curves, or the clobber bug.** Audio path is effectively UNVERIFIED by tests.

**Verdict: PARTIAL. A real client-side equal-power crossfade + per-clip EQ/compressor/pan chain exists and is sophisticated, but the canvas loop overwrites per-clip volume/mute every frame, there are three competing gain writers, and there is zero behavioral test coverage.**

---

## 4. A/V SYNC — **DONE (low drift) for single-element; the crossfade is the only multi-element window**

- **No separate audio track element.** Audio always rides the SAME `<video>` element that produces the picture (audio is tapped from that element via `createMediaElementSource`). There is **no offset logic, no `currentTime` syncing across distinct audio vs video elements** — so the classic multi-element A/V drift problem essentially does not exist here. Picture and its own audio cannot drift because they're one decoder.
- The only multi-element window is the 320ms crossfade where buffer A and buffer B both play. Each carries its own in-sync audio; they're independently correct, equal-power summed. No cross-element `currentTime` alignment is attempted or needed.
- StitchedPlayer re-seeks the showing element to the playhead only on `drift > 0.5s` (`:269-279`) / `>0.25s` (`:511-520`) to avoid fighting natural playback. Reasonable.
- `masterAudioUrl` appears in the manifest type (`ExamplesGallery.tsx:23`) but is unused on the client — i.e. there is no client path that plays a separate master audio bed against video (that would be a drift risk); it's baked server-side. Good.

**Verdict: DONE. A/V drift risk is LOW because there is no independent audio element to drift. The render path bakes a single muxed stream.**

---

## 5. CLIP / LIBRARY PLAYBACK & THUMBNAILS — **DONE / PARTIAL**

- Library grid thumbnails: `LazyVideoThumbnail` (`src/components/ui/LazyVideoThumbnail.tsx`). IntersectionObserver-gated, **client-side frame extraction**: creates an offscreen `<video crossOrigin=anonymous preload=metadata>`, seeks to `seekFraction*duration` (`:173`), `drawImage`→`canvas.toDataURL('jpeg',0.72)` (`:176-189`). Concurrency-limited to 6 (`:19`), persisted to IndexedDB + in-memory cache + subscriber fan-out (`:54-126`), 6s timeout, 5-min failure cooldown. **Robust; DONE.**
  - **PARTIAL:** `crossOrigin='anonymous'` is hardcoded (`:155`); on CORS-rejecting CDNs the `onerror` path just `finish(null)` (`:190-196`) — comment admits it "won't be able to read pixels — so we skip extract and fail." So cross-origin clips that don't send CORS headers get NO extracted thumbnail (falls back to poster/placeholder). Silent.
- Server thumbnail/frame functions exist and are the authoritative source: `generate-project-thumbnail`, `extract-video-frame` (edge functions present). The client extractor is a best-effort overlay; the stored `thumbnailUrl`/poster is the poster fallback in every player. SourceMonitor (`PlayerCanvas:90-226`) is an independent isolated single-clip preview (`preload=metadata`, no Web Audio) for dual-monitor mode — separate yet again from StitchedPlayer (minor divergence, cosmetic).
- `VideoSourceValidator` (`src/lib/video/VideoSourceValidator.ts`) provides deterministic pre-mount validation (EMPTY/CORS/404/codec) but is **not** called inside BrandedVideoPlayer's `resolvedSrc` path — it's opt-in per caller, so most player mounts don't validate.

---

## TALLY

| Feature | Status |
|---|---|
| Premium player HLS (adaptive + native Safari + quality + buffering) | **DONE** |
| Premium player error recovery (media-error ladder, manifest fallback) | **PARTIAL/BROKEN** |
| `generate-hls-playlist` client wiring | **MISSING** (fn exists, no call site) |
| Editor dual-buffer preview (StitchedPlayer) | **PARTIAL** (separate engine; dead authored-transition wiring) |
| Render-free preview (TimelinePlayer) | **PARTIAL** (seek/advance parity bug) |
| Client audio mix chain (EQ/comp/pan/Web Audio) | **DONE** (build) / **PARTIAL** (clobbered at runtime) |
| Client audio crossfade at boundaries | **PARTIAL** (works, but overwrites per-clip volume/mute) |
| A/V sync | **DONE** (low risk by design) |
| Library thumbnails | **DONE** (client) + **PARTIAL** (CORS-blocked clips fail silently) |
| Audio behavioral test coverage | **MISSING** |

DONE: 4 · PARTIAL: 5 · BROKEN: 1 (manifest-without-hlsPlaylistUrl fallback) · MISSING: 2

---

## TOP PLAYBACK / AUDIO RISKS (real-vs-handled)

1. **Render ↔ playback timing divergence — REAL, NOT fully handled.** Three distinct pipelines (StitchedPlayer canvas+WebAudio, TimelinePlayer, server FFmpeg). The editor preview crossfades EVERY boundary at a fixed **320ms** (`StitchedPlayer.tsx:636,730`) while the bake uses **0.4s** defaults with per-boundary authored kind/duration (`seamless-stitcher:232-233,170-180`). Authored transitions (`project.transitions`) are previewed through a **dead `videoBRef`** (`PlayerCanvas:587-621`, ref never attached) and double-applied via the opacity prop. What the user sees is NOT what they export. Evidence-rated: **HIGH likelihood, MEDIUM severity** (cosmetic-but-promised "preview = export").

2. **Crossfade clobbers per-clip audio mix — REAL, NOT handled.** Canvas rAF writes `setElementGain(showingEl, 1)` every frame (`StitchedPlayer.tsx:757`), overwriting `mix.volume`/`mix.muted`/makeup-gain set by `applyMix` (`useAudioMixChain.ts:206-237`). Three writers contend over `master.gain` (`applyMix`, `rampElementGain`, `setElementGain`) plus a 4th element-level stage (`el.volume`/`el.muted`). A muted or attenuated clip plays at full volume in preview. **HIGH likelihood, MEDIUM-HIGH severity**, zero test coverage.

3. **A/V sync drift — REAL risk MITIGATED by design.** No independent audio element exists; audio rides the same decoder as picture, so picture/audio cannot drift. The only multi-element window is the 320ms crossfade, where each element is internally synced. **LOW likelihood, LOW severity.** This is the strongest area.

4. **Crossfade boundary edge cases — PARTIALLY handled.** First-clip mount prime, race-guarded PRIME/ROLL, and `nextClipId`-keyed firing are handled. NOT handled: TimelinePlayer's seek→advance parity bug (`TimelinePlayer.tsx:120` vs `:165-182`) shows the wrong buffer after cross-clip scrubbing; sub-0.7s clips can chain overlapping fades unguarded; autoplay-blocked degrades to a hard cut (acceptable). **MEDIUM likelihood, LOW-MEDIUM severity.**

5. **Premium player terminal-error handling — REAL.** hls.js fatal `MEDIA_ERROR` is not recovered (`recoverMediaError()` absent, `BrandedVideoPlayer.tsx:301-319`); only a naive `.m3u8→.mp4` guess for network errors. Manifests lacking `hlsPlaylistUrl` fall back to playing a `.json` URL as media (`ExamplesGallery.tsx:285-299`) → guaranteed error → silent skip. **MEDIUM likelihood, MEDIUM severity.**

### Untested / unverified paths
- All audio gain/crossfade behavior (no behavioral tests; `useAudioMixChain.test.tsx` is null-safety only).
- `generate-hls-playlist` edge fn has no client caller — playlist provenance unverified from the client side.
- CORS-blocked thumbnail extraction silently yields no frame.
- `VideoSourceValidator` exists but is bypassed by the main player mount path.

---

# Section C — AI Generation, Clip/Library Persistence, Templates

# Web Audit — AI Generation, Clip/Library Persistence, Templates/Effects, Music/Voice

Branch: `full-audit` · Scope: READ-ONLY end-to-end trace · Date: 2026-06-26

Method: UI (src/pages, src/components) → handler/hook → `supabase.functions.invoke` → edge fn (supabase/functions) → model/provider → persistence (DB table / storage bucket) → back to UI. Each feature rated DONE / PARTIAL / BROKEN / MISSING / UNVERIFIED with file:line evidence. Claims marked "verified" were re-read directly by the lead auditor.

Credit helpers referenced throughout:
- `supabase/functions/_shared/pipeline-credits.ts` — `holdCreditsForPipeline()`→RPC `reserve_credits`, `consumePipelineCredits()`→`consume_credit_hold`, `releasePipelineCredits()`→`release_credit_hold`.
- `supabase/functions/reserve-credits/index.ts` — JWT-gated reserve/consume/release/state API.
- Other gating RPCs in use: `deduct_credits`, `refund_credits`, `get_credit_state`.

---

## 1. AI SCRIPT / STORY GENERATION

| Fn | Model | UI wired | Credit-gated | Persistence | Status |
|---|---|---|---|---|---|
| generate-script | OpenAI gpt-4o-mini (`generate-script/index.ts:373`) | yes (Script.tsx:445) | **NO** (verified) | `movie_projects.generated_script` (Script.tsx:471) | PARTIAL |
| generate-story | OpenAI gpt-4o-mini (`generate-story/index.ts:475`,:528) | **NO (orphaned)** | **NO** | none | BROKEN/MISSING |
| smart-script-generator | OpenAI gpt-4o (`smart-script-generator/index.ts:956`) | internal only (hollywood-pipeline:1260,:1404) | NO at fn (gated by caller hollywood-pipeline) | none (caller persists) | DONE |
| script-assistant | OpenAI gpt-4o-mini (`script-assistant/index.ts:150`) | partial (FailedClipsPanel.tsx:147, only `rephrase_safe`) | **NO** | none (local state) | PARTIAL |
| seedance-script-director | Lovable gw `openai/gpt-5`→`google/gemini-2.5-pro` (`seedance-script-director/index.ts:242`,:289) | internal only (seedance-pipeline:605) | NO at fn (gated by seedance-pipeline:457 `holdCreditsForPipeline`) | none | DONE |
| director-chat | Lovable gw `google/gemini-3-flash-preview` (`director-chat/index.ts:69`) | yes (DirectorChat.tsx:348) | NO (cheap chat) | none (local) | DONE (swallows errors) |
| director-card | none (stats aggregation) (`director-card/index.ts:73-88`) | **NO (orphaned)** | N/A | read-only | MISSING-hookup |

Detail:
- **generate-script — PARTIAL.** UI `src/pages/Editor/views/Script.tsx:445` `regenerate()` → invoke at :453 with `{title,topic,synopsis,mood,genre,setting,clipCount}`; success writes `movie_projects.generated_script` at :471. Edge auth guard at :68-72, OpenAI gpt-4o-mini at :373. **No credit gating** (verified: grep for reserve/deduct/consume/hold in the file returns none; the "AUTH GUARD: prevent unauthorized API credit consumption" comment at :67 only blocks anonymous callers). Bug: seedance-pipeline fallback invokes it with `{concept,...}` (`seedance-pipeline/index.ts:622`) but the fn reads `synopsis||topic` (:337) — `concept` is ignored, so the fallback script disregards the user concept.
- **generate-story — BROKEN/MISSING.** Zero callers in src/ or functions/ (only config.toml:58 registration). Makes two paid gpt-4o-mini calls (:475 scene, :528 title), no persistence. Orphaned + ungated.
- **smart-script-generator — DONE.** Internal sub-step of hollywood-pipeline (gated at the pipeline boundary, creditRefs reserve/consume). Robust JSON recovery (:992) + clip padding (:1011). Ungated as a standalone fn but auth-gated and internal.
- **script-assistant — PARTIAL.** Implements 6 actions; only `rephrase_safe` has a UI caller (FailedClipsPanel.tsx:147). Other 5 branches dead from UI. Ungated.
- **seedance-script-director — DONE.** Service-role-only guard (`requireServiceRole`, :223) — hardened after a prior unauthenticated model-injection drain (comment :218). Gated by caller.
- **director-chat — DONE (with caveat).** Intentionally swallows every error into an HTTP-200 canned reply (missing key :39, non-OK :72, catch :83) → outages invisible. Model id `google/gemini-3-flash-preview` (:69) UNVERIFIED (unusual slug; silent degrade if rejected).
- **director-card — MISSING-hookup.** Not a generator (stats only). No caller. `signatureStyle` is an explicit heuristic stub (:125).

---

## 2. CLIP / VIDEO GENERATION

Architecture: real UI entry points are `mode-router` (Crossover.tsx:561, TrainingVideo.tsx:479, TemplateComposer.tsx:82) and `hollywood-pipeline` (Production.tsx:1263). Per-clip render worker = `generate-single-clip` (Replicate). Reconciliation is dual: registered `replicate-webhook` (HMAC-verified) + self-chaining `poll-replicate-prediction`, with `check-video-status` as manual recovery. Clips → `video-clips` bucket + `video_clips` table.

Provider/model map (all Replicate model-route endpoints unless noted):
- Kling V3 `kwaivgi/kling-v3-video` (default + avatar)
- Wan 2.5 `wan-ai/wan-2.5-t2v` (free tier)
- Seedance — **inconsistent**: `bytedance/seedance-2.0` (generate-single-clip:111) vs `bytedance/seedance-1-pro` (editor-generate-clip:19); one slug is wrong
- Veo `google/veo-3-fast`, Sora `openai/sora-2`, Runway `runwayml/gen4-turbo`
- stylize-video / motion-transfer — **hardcoded raw version hashes** (placeholders)
- avatar-image — Lovable gw `google/gemini-2.5-flash-image`

| Fn | Provider/Model | Reconciliation | Persistence | Credits | Status |
|---|---|---|---|---|---|
| generate-single-clip | Kling V3 / Wan / Seedance / Veo / Sora | webhook + poller | `video_clips` + `video-clips` bucket | consumes caller hold (:1145) | DONE |
| generate-video | Kling V3 (:20) | **none** | **none** | **none** | BROKEN/orphaned |
| editor-generate-clip | Seedance-1-pro / Wan / Kling | **client poll only** | `video_clips` (:574) + bucket | deduct+refund (:371) | DONE (poll-fragile) |
| free-tier-generate | Wan 2.5 (doc says LTX) | **none** | `free_tier_attempts` (marks succeeded at submit) | atomic cap RPC | BROKEN + no UI |
| motion-transfer | hardcoded hash (:67,:97) | **none** | **none** (pipeline_state.predictionId) | mode-router deducts upfront, no refund | BROKEN (credit-loss) |
| stylize-video | hardcoded hash (:50) | **none** | **none** | deducts upfront, no refund | BROKEN (credit-loss) |
| generate-avatar-image | Lovable Gemini 2.5-flash-image | sync | `avatars` bucket (pub) | none | DONE |
| generate-avatar-scene | Replicate FLUX cascade | sync 180s poll, no webhook | **ephemeral URL, not rehosted** | none | PARTIAL |
| generate-avatar-direct | Kling V3 + OpenAI | webhook + poller | `video_clips` + pending_video_tasks | none (mode-router deducts) | PARTIAL |
| replicate-webhook | — | — | persists to `video-clips` + `video_clips` + media | — | DONE |
| poll-replicate-prediction | — | — | persists `video_clips` + frame extract | — | DONE |
| check-video-status | Kling/Replicate | recovery | upserts `video_clips` | refunds editor clip on FAILED | DONE |
| replicate-catalog | Replicate proxy | — | read-only | — | PARTIAL (no UI caller) |
| retry-failed-clip | re-dispatch generate-single-clip | — | reconciles → final-assembly | — | DONE |

Severity-ordered break points:
1. **motion-transfer + stylize-video — BROKEN with credit loss (verified).** `motion-transfer/index.ts:97` posts `{version: modelVersion}` where the default is a placeholder hash (:33-67) → likely 422. Returns `{predictionId}` (:118) which mode-router parks in `movie_projects.pipeline_state.predictionId` (mode-router:1056-1064,1128-1137) — **no webhook, no poller, no recovery reads that location**, no `video_clips` row, project stuck `generating`. mode-router deducts full credits upfront (:492-499) with **no refund** → user pays, gets nothing. stylize-video identical (:50).
2. **free-tier-generate — BROKEN + orphaned.** Marks `free_tier_attempts` `'succeeded'` at prediction-creation (:199), no reconciliation, video URL never retrieved. **Zero UI callers.** Runs Wan despite doc claiming LTX-Video.
3. **generate-video — orphaned + unreconciled.** Submits + returns taskId (:1057-1074); no credits/clip-row/webhook/poller/persistence. Reachable only via a `pipelineFunction` registry string nothing dispatches (`src/lib/video/engines.ts:144` etc.).
4. **replicate-catalog — no UI hookup** (functional proxy, zero callers).
5. **generate-avatar-scene — ephemeral output** (180s sync poll, output URL never rehosted to storage; :494-523).
6. **editor-generate-clip — client-poll fragility** (no webhook; browser close mid-render orphans the clip, refund only on explicit failure not abandonment; CreatePanel.tsx:86-122).
7. **Model-id inconsistency** Seedance `2.0` vs `1-pro`; generate-single-clip never sets `video_clips.replicate_prediction_id` (relies on `veo_operation_name` fallback at replicate-webhook:85-93 — works but fragile).

Healthy core: the Kling-V3 cinematic path (mode-router/hollywood-pipeline → generate-single-clip → webhook+poller → `video_clips`+bucket → continue-production, with check-video-status/retry-failed-clip recovery and hold-based credits) is end-to-end complete and solid.

---

## 3. CLIP / LIBRARY IMPORT & PERSISTENCE — CRITICAL

### Verdict: CAN-BE-LOST (silent) on the primary editor import path.
An imported clip can end with a storage object but **no DB row, while the UI reports success.** Bytes orphan in a public bucket; the clip vanishes on reload.

Tables (three distinct surfaces, NOT one):
- `video_clips` — canonical timeline/clip table; read by editor timeline, seamless-stitcher, final-assembly. UNIQUE `(project_id, shot_index)`; RLS INSERT `auth.uid()=user_id` (`supabase/migrations/20260106121012_*.sql:2,:31`).
- `user_media_assets` — "My Library" history (`supabase/migrations/20260518164313_*.sql:5`).
- `movie_projects` — **what `/library` actually lists** (`src/pages/Library.tsx:93` via usePaginatedProjects).

Buckets:
- `video-clips` — **public=true** (`supabase/migrations/20260106114819_*.sql:3`); holds editor-imported + bulk video uploads. Note `supabase/migrations/20260626100000_storage_policy_fixes.sql:5` records this bucket had NO INSERT policy and every upload silently 403'd until patched today — live history of silent upload failure.
- `video-thumbnails` (public read), `user-uploads` (private, used only by generic `useFileUpload`).
- `generate-upload-url` edge fn (the signed-URL path) is **dead from frontend** — referenced only in tests. Real imports use the Supabase JS client `.upload()` directly.

Import call chains:
- **PATH A — editor timeline drop (THE BREAK, verified):** `src/pages/Editor/views/Timeline.tsx:2743` → `ingestUpload()` in `src/lib/editor/upload-ingest.ts:327`.
  1. `uploadValidated` uploads bytes to `video-clips`+`video-thumbnails` FIRST (:268-277).
  2. DB insert `insertWithNextShotIndex` into `video_clips` (:350) wrapped in `try/catch` that **only `console.warn`s and does not rethrow** (:362-365) → `dbClipId=null` on any failure.
  3. `movie_projects` mirror (:375-395) and store mirror (:400-418) are **gated on `if (dbClipId)`** → skipped.
  4. **ScriptDocument `addShot` ALWAYS runs (:423+)** and returns a shotId → `ingestUpload` returns success.
  5. Caller toasts "Uploaded N clips" (Timeline.tsx:2752).
  `insertWithNextShotIndex` re-throws on any non-23505 error (:719) — RLS reject (userId≠JWT), FK violation, schema drift, or 5-retry shot_index exhaustion (:662 → null) — all swallowed at :362.
- **PATH B — "My Library" rail bulk upload:** `MyLibraryPanel.tsx:88` upload → :97 `record_user_media` RPC; on RPC failure it throws and is counted failed (:108-110) **but the storage object is already written → orphan**. User IS told, so less silent.
- **PATH C — generic `useFileUpload`:** `src/hooks/useFileUpload.ts:131` uploads, returns URL, **no DB insert at all** (:170) — building block, persistence is caller's job.
- **Remote-URL imports** (`MediaLibrary.tsx:151`, `MyLibraryPanel.tsx:206`) call `insertWithNextShotIndex` and **correctly hard-fail** on null (`if(!clipId) throw`). These are safe; the bug is specific to `ingestUpload`.

Generated vs imported: both share `video_clips`, opposite discipline. Generated clips (editor-generate-clip:560-600, replicate-webhook, generate-single-clip) are written server-side/service-role authoritatively with logged errors → safe. Imported-via-editor-drop is client-side best-effort with the insert swallowed on failure → unsafe.

Precise failure window (Path A):
```
upload-ingest.ts:268  storage.upload() → public video-clips bucket   ✅ object created
upload-ingest.ts:350  insertWithNextShotIndex → video_clips          ❌ throws / null
upload-ingest.ts:362  catch { console.warn() }   ← swallowed, no rethrow, no toast
upload-ingest.ts:375  movie_projects mirror   ── SKIPPED (gated dbClipId)
upload-ingest.ts:400  store mirror            ── SKIPPED
upload-ingest.ts:423+ ScriptDocument addShot  ── RUNS → returns shotId  ← FALSE SUCCESS
Timeline.tsx:2752     toast.success("Uploaded N clips")
```
Net state: orphaned object in public `video-clips`; no `video_clips` row, no `movie_projects` mirror, no `user_media_assets` row. Visible this session only via in-memory ScriptDocument; on reload the timeline (reads `video_clips`) shows nothing and the file never appears in `/library` (reads `movie_projects`).

Minimal-fix direction (NOT applied): in `ingestUpload`, throw when `dbClipId` is null (mirror the correct pattern at MediaLibrary.tsx:159 / MyLibraryPanel.tsx:214) and/or delete the just-uploaded storage object on insert failure to avoid orphans.

---

## 4. AI IMAGE / PHOTO GENERATION

Provider map: Lovable gw Gemini (`google/gemini-2.5-flash-image`, `gemini-3-pro-image-preview`), Replicate FLUX (`flux-1.1-pro-ultra`, `flux-1.1-pro`, `flux-fill-pro`, `lucataco/remove-bg`), OpenAI `gpt-4o` (vision analysis only). No DALL-E / gpt-image anywhere.

| Fn | Provider/Model | Persists to | Gated | Status |
|---|---|---|---|---|
| studio-image | Lovable Gemini 2.5-flash-image / 3-pro (`studio-image/index.ts:79-81`) | client→`scene-images`(pub)+`user_media_assets` (ImageStudioHub.tsx:148-178) | **NO** | PARTIAL |
| edit-photo | Lovable Gemini 3-pro-image (`edit-photo/index.ts:225`) | `photo-edits`(priv)+`photo_edits`+media | YES deduct+refund+idempotency (:161-179) | DONE |
| inpaint-photo | Replicate flux-fill-pro (`inpaint-photo/index.ts:270-311`) | `photo-edits`(priv)+`photo_edits`+media | YES (:181-210) | DONE |
| generate-avatar-image | Lovable Gemini 2.5-flash-image (`:122`) | `avatars`(pub)+media | **NO** | PARTIAL |
| generate-scene-images | Replicate flux-1.1-pro-ultra→pro (`:176-217`) | `scene-images`(pub)+`movie_projects.scene_images`+media | NO at fn (pipeline hold) | DONE/PARTIAL |
| composite-character | Replicate remove-bg + flux-1.1-pro | **none** | **NO** | **BROKEN** |
| extract-scene-identity | **OpenAI gpt-4o vision** (`:372`,:523) | `movie_projects.pro_features_data.sceneIdentity` | **YES 5cr deduct+refund** (:255-298) | DONE |
| scene-character-analyzer | Lovable Gemini 2.5-flash (analysis) | none | NO | **MISSING (no caller)** |

Detail:
- **studio-image — PARTIAL.** `ImageStudioHub.tsx:233` → fn returns base64/URL only, no server persist; client uploads to public `scene-images` + inserts `user_media_assets` (best-effort, anonymous users get no save). **Ungated** (auth guard only, :53-54).
- **generate-avatar-image — PARTIAL.** `CreationStudio.tsx:504` → generates up to 3 Gemini images, public `avatars` bucket. **Ungated** (:197-201). No avatars/character DB-table row written here.
- **composite-character — BROKEN (verified).** `TrainingVideo.tsx:393` → fn posts `version:"lucataco/remove-bg"` (`composite-character/index.ts:67`) and `version:"black-forest-labs/flux-1.1-pro"` (:129) to `/v1/predictions` (:60,:122) — the predictions endpoint needs a 64-char version hash, not a model slug → 422. Silently degrades to `extraction_only` fallback (:147-194). No persistence, no gating.
- **extract-scene-identity — DONE.** Only OpenAI fn here and **properly gated** (5cr deduct + refund-on-malformed + balance pre-check, :255-298). Counter-example to the OpenAI gap. Analysis-only (no image).
- **scene-character-analyzer — MISSING.** Deployed, zero callers in src/ or functions/. Dead at runtime.
- **generate-scene-images — DONE within pipeline; PARTIAL direct-invoke** (accepts `userId` from body, auth-guard only → direct client call bypasses the parent pipeline hold = ungated).

---

## 5. TEMPLATE / BREAKTHROUGH-EFFECTS SYSTEM

Templates verdict: **DATA-DRIVEN (rich config modules), wired end-to-end. DONE** (one drift risk + one persistence caveat). "breakthrough-fx" as a standalone system: **ABSENT on this branch.** What exists is the **breakout (4th-wall)** system (wired) + an in-editor **crossover effects-registry** (PARTIAL).

Route + data:
- `src/App.tsx:156,:727` mounts `<Templates/>`; `/create` is a query-preserving redirect to `/studio` (App.tsx:647).
- `src/pages/Templates.tsx:367` → `getAllTemplateBlueprints()` → `src/lib/templates/registry.ts:744` `TEMPLATE_BLUEPRINTS` (~50 blueprints from `BREAKOUT_TEMPLATES` + ~40 built-ins, each enriched engine/aspect/clips/VFX/grade/music). Rich code module, not a static stub and not a DB query for the grid.

Selection → project chain:
1. `Templates.tsx:750` `navigate('/create?template=<id>')` + best-effort `increment_template_use_count` (UUID ids only, :752).
2. `/create` → `/studio?template=<id>`.
3. `src/hooks/useTemplateEnvironment.ts:1301` reads `?template`; `loadTemplate` resolves against `BUILT_IN_TEMPLATES` (a **second** hardcoded list, :261-1208) first, then the `project_templates` DB table (:1351, migration `20260110193526_*.sql:4`). Miss → `toast.error('Template not found')` (:1358).
4. Settings → `CreationHub.tsx:232,322-330` prefill → `creationConfig` (:601-621) → `onStartCreation(creationConfig)` (:660) into the generation pipeline (DB write downstream). Templates DO apply to a project — no break.

Risks:
- **Dual source-of-truth drift (latent):** gallery catalog (`registry.ts` TEMPLATE_BLUEPRINTS) and consumer catalog (`useTemplateEnvironment.ts` BUILT_IN_TEMPLATES) are two separate hardcoded lists. They currently overlap, so selection works; any id added to the registry but not mirrored into BUILT_IN_TEMPLATES (and `project_templates` has **no seed INSERTs** in migrations) → "Template not found".

Breakthrough/effects:
- No standalone breakthrough-fx system on full-audit. "breakthrough" appears only as prose/labels in the breakout system (effects-registry.ts:153, breakout-templates.ts:87,211, generate-widget-config:47 `"4th_wall_breakthrough"`, hollywood-pipeline:1103).
- **Breakout (4th-wall) effects — WIRED:** breakout-templates.ts → registry.ts → CreationHub.tsx:296,623-646 → seedance-pipeline/hollywood-pipeline/mode-router, guarded by `_shared/breakout-guardrails.ts`.
- **In-editor crossover effects-registry — PARTIAL:** `src/lib/editor/effects-registry.ts` declares 20 recipes; only 6 have bespoke renderers (FrameBreak, GlassShatter, LightBeam, NeonZap, ParticleBurst, SmokeBurst; `hasCustomRenderer:true`); the other 14 fall back to a generic placeholder bloom (:117-139). Consumed by EffectsPanel.tsx / EditorRightRail.tsx.

Tables: `project_templates` (`20260110193526_*.sql:4`), `crossover_templates` (`20260615000000_*.sql`). No seed INSERTs — live gallery is code-fed.

---

## 6. MUSIC / VOICE GENERATION

Gating note: **none of the 5 audio fns reserve/deduct credits** (no pipeline-credits import, no reserve in any). Two have post-hoc `log_api_cost` accounting only. All enforce `validateAuth`.

| Fn | Provider/Model | UI caller | Persisted | Status |
|---|---|---|---|---|
| generate-music | Replicate MusicGen Stereo Large (`:360`) | MusicHub.tsx:561, Timeline.tsx:535 | Editor: `voice-tracks`(priv)+`movie_projects.music_url`+A2 `video_clips` (:766,:779) | DONE (Editor) / **persistence BROKEN (MusicHub)** |
| elevenlabs-music | ElevenLabs /v1/music (`:38`) | **none** | no | **MISSING (orphaned)** |
| elevenlabs-sfx | ElevenLabs /v1/sound-generation (`:38`) | **none** | no | **MISSING (orphaned)** |
| generate-voice | Replicate MiniMax speech-2.6-turbo (`:155`) | CreationStudio.tsx:650, TrainingVideo.tsx:262,294 | media-library + provider URL | DONE |
| editor-tts | ElevenLabs eleven_turbo_v2_5 (`:44,:56`) | editor-tts.ts:34 → EditorRightRail.tsx:46 | `video-clips` bucket + A1 clip (:95-124) | DONE |

Break points:
1. **MusicHub saves expiring Replicate URLs (BROKEN persistence).** `MusicHub.tsx:561` invokes generate-music with **no `projectId`** → the `if(musicUrl && supabase && projectId)` persist block (generate-music:749) is skipped → fn returns the raw transient Replicate output URL, and MusicHub.tsx:578 saves that ephemeral URL to "My Tracks" via `record_user_media`. Replicate URLs expire → MusicHub tracks rot. The Timeline path is fully wired (`projectId: project.id` → signed URL → A2 → flush).
2. **elevenlabs-music + elevenlabs-sfx fully dead** — zero callers, no persistence. SFX generation unreachable from any UI.
3. **No real credit gating on any audio fn** — `log_api_cost` accounting only.
4. **generate-voice** returns provider-hosted URL (no re-upload to a Supabase bucket) — durability depends on the consuming pipeline ingesting it.

---

## TALLY

DONE (15): smart-script-generator, seedance-script-director, director-chat, generate-single-clip, replicate-webhook, poll-replicate-prediction, check-video-status, retry-failed-clip, generate-avatar-image (video), edit-photo, inpaint-photo, extract-scene-identity, generate-voice, editor-tts, Templates system. (generate-scene-images DONE within pipeline.)

PARTIAL (8): generate-script, script-assistant, editor-generate-clip, generate-avatar-scene, generate-avatar-direct, replicate-catalog, studio-image, generate-avatar-image (image). Crossover effects-registry PARTIAL.

BROKEN (7): generate-story, generate-video, free-tier-generate, motion-transfer, stylize-video, composite-character, generate-music (MusicHub persistence path). + the **clip-import-on-drop persistence (Path A)** is BROKEN/silent.

MISSING / orphaned (no caller) (5): director-card, scene-character-analyzer, elevenlabs-music, elevenlabs-sfx, (generate-story also orphaned, counted under BROKEN).

### Credit-gating gap — UNGATED OpenAI generation fns
Direct `api.openai.com` generation fns with NO credit reservation (auth-only):
1. `generate-script/index.ts:373` (gpt-4o-mini) — ungated, user-facing (VERIFIED)
2. `generate-story/index.ts:475` (gpt-4o-mini) — ungated + orphaned
3. `smart-script-generator/index.ts:956` (gpt-4o) — ungated at fn level (covered only because sole caller hollywood-pipeline gates)
4. `script-assistant/index.ts:150` (gpt-4o-mini) — ungated, user-facing
5. `generate-ad-studio/index.ts:234` (gpt-4o-mini) — ungated
6. `generate-ad-variants/index.ts:242` (gpt-4o-mini) — ungated
7. `regenerate-audio/index.ts:204` (gpt-4o-mini) — ungated

The project-memory "6 ungated OpenAI fns" = items 1,2,4,5,6,7 (the user-callable set), with #3 protected only at the pipeline boundary. Properly-gated counter-example: `extract-scene-identity` (OpenAI gpt-4o, 5cr deduct+refund). Note: seedance-script-director and director-chat route through the Lovable gateway, not OpenAI (seedance gated at pipeline; director-chat unmetered).

Adjacent ungated PAID (Lovable-gateway) image fns — same leak class, non-OpenAI: `studio-image` and `generate-avatar-image` (any signed-in user generates Gemini images free).

### Clip-persistence-on-import VERDICT
**CAN-BE-LOST (silent).** On the primary editor drag/drop import (`ingestUpload`, `src/lib/editor/upload-ingest.ts:327`), the storage write happens first (:268), the `video_clips` insert (:350) is wrapped in a catch that only `console.warn`s and never rethrows (:362, VERIFIED), the movie_projects/store mirrors are gated on `dbClipId` and skipped on failure, but the ScriptDocument mirror (:423+) runs unconditionally and the function returns success → the UI toasts "Uploaded N clips" (Timeline.tsx:2752). Result on any insert failure (RLS userId≠JWT, FK violation, shot_index-retry exhaustion, schema drift): an orphaned object in the public `video-clips` bucket with no DB row, gone on reload, never in `/library`. Remote-URL imports (MediaLibrary.tsx:159, MyLibraryPanel.tsx:214) correctly hard-fail and are safe; the bug is specific to file-drop `ingestUpload`.

---

# Section D — Core Flows: Auth/Session, Credits/Billing, Projects, Editor

# Genesis Director — CORE Web-App Flow Audit

Branch: `full-audit`. Stack: React + Vite, Supabase (auth + DB + edge functions). Billing provider = Polar.sh (DB columns legacy `stripe_*`-named but hold polar_ values; Stripe Connect = creator payouts only).

READ-ONLY audit. Every claim below is traced to `file:line`. `.claude/worktrees` (committed dup tree) excluded from all searches. Verdicts: DONE / PARTIAL / BROKEN / MISSING / UNVERIFIED.

> PREMISE CORRECTION (verified): the task brief and project memory state Stripe billing is disabled via a kill-switch `src/lib/stripe-lock.ts`. **That file does not exist on this branch** (`ls src/lib/stripe-lock.ts` → No such file; `grep -r stripe-lock src supabase` → 0 hits). The client default provider is **Stripe**: `src/lib/payments/index.ts:55-56` `ACTIVE = VITE_PAYMENTS_PROVIDER || "stripe"`. This materially affects the billing verdict — see §2 Cross-cutting #1.

---

## 1. AUTH / SESSION

### Call chain
`main.tsx` → `App.tsx:271` `<AuthProvider>` → `src/contexts/AuthContext.tsx` (`onAuthStateChange` listener `:316` registered before `initSession()` `:481`) → profile via SECURITY DEFINER RPC `get_my_profile()` (`AuthContext.tsx:108-112`, `.bind(supabase)`) → `reconcileProfile` anti-downgrade (`authProfile.ts:82-90`) → admin via `is_admin` RPC fail-closed (`AuthContext.tsx:199-226`). Route enforcement: `src/components/auth/ProtectedRoute.tsx` (3-phase `initializing→verifying→ready`, never redirects until `loading===false && isSessionVerified===true` `:92`, redirect to `/auth` at `:127`), composed with `RequireAccountType.tsx` for business routes (`App.tsx:600-627`). Supabase client `src/integrations/supabase/client.ts:11-16` `persistSession/autoRefreshToken/localStorage`.

### Findings
- Session init/persistence, `onAuthStateChange` (intentional-signout guard `signedOutRef:229,322`; identity-change gate `:374`; cross-user RQ cache purge `:342-347`), `security_version` re-check loop (`:485-530`), signIn/signUp/signOut, ForgotPassword/ResetPassword (4 URL shapes, enumeration-safe, token-scrubbing): **DONE**.
- `_shared/auth-guard.ts` (`validateAuth:24-63`, `resolveEffectiveUserId:85-101` privilege-escalation block), `oauth-authorize` (HMAC state, org-membership check `:93-99`), `admin-force-logout`, `auth-email-hook` (Standard-Webhooks sig verify `:164-181`): **DONE**.

### Break points
- **PARTIAL — cold-load onboarding misroute.** `authProfile.ts:55,63` fallback sets `onboarding_completed=false`/`account_type='personal'`. The anti-downgrade guard (`reconcileProfile:88`) only protects when a `prev` profile exists. On genuine first paint with no `prev` and a slow/RLS-denied `get_my_profile`, the fallback commits → `ProtectedRoute.tsx:159-165` bounces an already-onboarded user to `/onboarding`. (`AuthContext.tsx:142-152`)
- **PARTIAL — `/inbox` unguarded.** `App.tsx:455-459` renders `<AppShell><Inbox/></AppShell>` with no `ProtectedRoute`; `Inbox.tsx:197` self-handles unauth with a dead placeholder, not a login redirect. Data RLS-safe; auth-UX hole inconsistent with siblings.
- **PARTIAL (security) — `oauth-callback` stores OAuth tokens in plaintext** into columns named `access_token_encrypted`/`refresh_token_encrypted` (`oauth-callback/index.ts:195-196`; admitted `:21-24`). Misleading column name masks the gap. Also **swallows the persist failure**: a failed `workspace_integrations.upsert` still redirects `status=success` (`:189-210`). Hardcoded fallback `https://smallbridges.co` `:100-101`.
- **UNVERIFIED — `manage-sessions` list/revoke** depend on GoTrue admin endpoints `/auth/v1/admin/users/{id}/sessions` + `/auth/v1/admin/sessions/{sid}` (`manage-sessions/index.ts:60,93,105`) with leftover "not sure how to do this" dev notes `:55-59`. May silently 500 in prod (caller `src/components/security/SessionsCard.tsx`). M-11 revoke-IDOR fix is present (`:89-103`).
- **PARTIAL — `revoke-demo-sessions`**: hardcoded stale-brand email `demo@aifilmstudio.com` `:49`; 15 sequential table deletes ignore every error (`:65-79`), only final `auth.admin.deleteUser` throws → partial-delete leaves inconsistent state while reporting success.
- **MINOR — `AuthCallback.tsx`** passes raw `next` to `navigate` (`:84-93,150-158,184-194,263-265`) without the `startsWith('/')` validation `Auth.tsx:99-102` applies (bounded by react-router; not a true open redirect).

### Tally
DONE: AuthContext core, ProtectedRoute, RequireAccountType chain, supabase client, Auth/ForgotPassword/ResetPassword, auth-guard, oauth-authorize, admin-force-logout, auth-email-hook. PARTIAL: cold-load bounce, `/inbox`, oauth-callback, revoke-demo-sessions. UNVERIFIED: manage-sessions GoTrue endpoints.

---

## 2. CREDITS / BILLING  (high-risk)

### Lifecycle (how it actually works)
Ledger is source of truth: `credit_ledger_total()` sums `credit_transactions.amount` **excluding only** `('untracked_increase','audit','security_alert')` (`20260704000700_org_pool_consumption.sql:26-33`). `profiles.credits_balance` is a trigger-synced cache (`20260518175601_*:52-90`).
Reserve → consume/release → reconcile:
- `reserve_credits` (`20260705000100_org_pool_membership_authz.sql:26-106`): locks row `FOR UPDATE`, `available = balance − held`, inserts `credit_holds` row TTL `GREATEST(ttl,60)s`, idempotent on `(user_id, idempotency_key)`.
- `consume_credit_hold` (`:111-192`) / `release_credit_hold` (`20260518175601_*:383-424`) / `expire_credit_holds` (`:31-50`, called at top of every reserve/deduct/charge RPC).
- `reconcile_pipeline_credit_holds` (`20260518165621_*:14-85`): expires TTL holds, then consumes/releases holds linked via `movie_projects.credit_hold_id`.
- Pipeline glue persists `credit_hold_id` (`_shared/pipeline-credits.ts:95-104,123-145`).

### Claim (a) FROZEN-BALANCE — CONFIRMED-FIXED (minor caveat)
No permanent-freeze path: every hold has a finite TTL and `expire_credit_holds()` runs at the head of `reserve_credits`/`deduct_credits`/`charge_*` and inside reconcile (`20260518165621_*:27`). Terminal failures also release via `markProjectFailedAndRefund` step 4 (`_shared/pipeline-failure.ts:208-224`). **Caveat (PARTIAL):** the Studio-v2 `reserve-credits` edge fn reads `movie_projects` only for an authz check and **never sets `credit_hold_id`** (`supabase/functions/reserve-credits/index.ts:84-120`, verified — the `reserve` branch calls `rpc('reserve_credits')` with no project update). Reconcile JOINs on `mp.credit_hold_id` (`20260518165621_*:31-33,47-49,63-65`), so those holds are reconciler-invisible. Not a freeze (TTL self-heals) but a revenue leak: client dying post-success without `consume` → work delivered uncharged.

### Claim (b) ORG-POOL FUNDING — CONFIRMED-FIXED for the Polar path only
`polar-webhook`: `grantCredits` early-returns for any order with `metadata.org_id` (`polar-webhook/index.ts:71-74`) so the owner is never personally credited; `upsertSubscription` funds the pool via `monthly_org_credit_refill()` when `org_id && status in (active,trialing)` (`:196-204`), non-fatal. Refill credits `organizations.credits_balance` via `topup_org_credits` (`20260704001000_org_refill_funds_pool.sql:58-62`) — the exact pool `reserve_credits`/`consume_credit_hold`/`deduct_credits` debit for org projects (`20260705000100_*:53-55,163-167,233-237`), membership-gated (`:50-52,141-144,221-223`).
**Residual:** `monthly_org_credit_refill` JOINs `organizations.plan → org_plan_features` (`20260705021000_*:36-45`); neither `polar-webhook.upsertSubscription` nor `polar-checkout` sets `organizations.plan`. Unset plan / missing features row → refill JOIN empty → **paid org pool never funded**. Funding correctness depends on org provisioning elsewhere setting `plan`.

### Claim (c) ORG REFILL ON CONFLICT GUARD — CONFIRMED-FIXED
`20260705021000_org_refill_on_conflict_guard.sql:54-56` adds `ON CONFLICT (organization_id, refill_period) DO NOTHING`. Matching unique constraint exists (`20260503044426_*:196-206` `UNIQUE (organization_id, refill_period)`). Closes the cron-vs-webhook TOCTOU: prior bare INSERT (`20260704001000_*:64-65`) would raise unique-violation and abort; loser of the race now no-ops. Guard present and correct.

### Claim (d) ZOMBIE / REFUND LEDGER — STILL-BROKEN (top money bug)
`zombie-cleanup` issues each refund as BOTH an inserted `refund` ledger row AND an `increment_credits` call. Verified: `increment_credits` inserts a `system_grant` txn (`20260516222626_*:30-31`), and `credit_ledger_total` excludes only `untracked_increase/audit/security_alert` (`20260704000700_*:32`). So **both rows count → every zombie refund credits the authoritative ledger twice (2× R)**, real spendable double credits:
- Phase 0 avatar: `zombie-cleanup/index.ts:327-333` (refund) + `:335-338` (increment_credits).
- Phase 1 projects: `:494-501` + `:504-507`.
- Phase 2 clips: `:611-619` + `:622-625` — **no idempotency check at all** (`:611`), so concurrent runs each refund a clip.
Per-project idempotency checks (`:317-324`, `:483-490`) only stop re-runs of the same project, not the single-run doubling.
Additional zombie defects:
- **Not org-aware:** refunds always to `project.user_id` personal ledger with no `organization_id` (`:327-338,494-507`). Org-project spend was debited from `organizations.credits_balance` → mints personal credits, org pool never restored (contrast correct `refund_credits` `20260704001500_*:42-72`).
- **Not hold-aware:** for hold-flow projects credits were only reserved (never debited); zombie estimates a refund (`:293-298`) and mints it while reconcile/`markProjectFailedAndRefund` separately releases the hold → double credit. No `usedHoldFlow` guard (vs `pipeline-failure.ts:85-122` which guards exactly this).
By contrast `reverse_credit_purchase` (chargeback clawback, `20260704001400_*:51-53`, wired `polar-webhook:112-135`) is correct, idempotent, org-skipping.

### Cross-cutting
1. **HIGH — kill-switch absent; Stripe is the DEFAULT provider.** `src/lib/stripe-lock.ts` does not exist; 0 lock refs. `src/lib/payments/index.ts:55-56` defaults to `"stripe"`. `create-org-checkout`/`create-plan-checkout`/`create-credit-checkout` still build live Stripe checkouts with no guard. The **Stripe webhook never funds the org pool**: `handleSubscriptionUpsert` writes `organization_id` but calls no `topup_org_credits`/refill (`_shared/stripe-webhook-handler.ts:113-188`). Any org sub via the default Stripe path → unfunded pool. Claim (b) verified only for Polar.
2. Webhook sig verify OK — Polar HMAC-SHA256 over `id.timestamp.body`, 5-min replay (`_shared/polar.ts:92-128`); Stripe `verifyStripeWebhook` 401 (`stripe-webhook-handler.ts:331-345`).
3. Grant idempotency OK — `add_credits` dedupes on `stripe_payment_id` keyed `polar_<order.id>` (`20260518175601_*:450-457`, `polar-webhook:78`); money-path errors THROW→500→Polar retries (`polar-webhook:89,156-158,180-183`).
4. Latent — org `consume_credit_hold`/`deduct_credits` decrement `organizations.credits_balance` unconditionally after `ON CONFLICT DO NOTHING` (`20260705000100_*:154-167,228-237`); safe today only via single-txn + `held` status guard. Weakening the status guard → double-debit.

### Tally
DONE: reserve_credits + holds RPCs, reconcile (linked holds), monthly-credit-refill, polar-webhook, polar-checkout, reverse_credit_purchase, CreditsContext, sync-org-seats. PARTIAL: reconcile (only `credit_hold_id`-linked), reserve-credits edge (no hold link), create-*-checkout (Stripe, no guard), payments-webhook (sig OK but org subs never fund pool; `charge.refunded` only alerts). BROKEN: **zombie-cleanup** (double-refund + non-org-aware + non-hold-aware).

---

## 3. PROJECTS

Entity is **`movie_projects`** (no `projects` table). RLS enabled `20260103232411_*:85`, never disabled. Per-user policies correct: SELECT/INSERT/UPDATE/DELETE all `auth.uid() = user_id` (`20260104202048_*:8-26`). Public read limited to `is_public=true AND status='completed'` (`20260221005754_*:5-8`). Org policies additive/permissive (`20260502172041_*:333-350`).

App-layer CRUD via `src/contexts/StudioContext.tsx` (anon/user-JWT client, RLS-enforced): list `:159-164`, create `:322-332`, update `:414-417`, delete delegates to `delete-project` edge fn `:360-362`. Second create path `src/lib/editor/createDraftProject.ts:58-68`.

### Break points
- **BROKEN — CRITICAL IDOR in `continue-production`.** `supabase/functions/continue-production/index.ts` authenticates (`validateAuth:112`) and resolves `userId` (`resolveEffectiveUserId:133`) but **every `movie_projects` access is `.eq('id', projectId)` via the service-role client with NO `project.user_id === userId` ownership check** (`:146-152,184-205,290-307,336-338,468-470,537-539,822-870,1139-1195`; grep for ownership comparison → 0 matches). Invoked with a user JWT from the client (`src/hooks/useClipRecovery.ts:139`), so any authenticated user can pass an arbitrary `projectId` to drive another user's pipeline (flip status/stage, trigger `final-assembly`/next-clip render, charge credits).
- **HIGH — cross-tenant org-injection via permissive RLS (F4).** RLS policies are permissive (OR-combined); the per-user INSERT policy (`WITH CHECK auth.uid()=user_id`, `20260104202048_*:13-16`) is satisfied whenever the client sets `user_id=self`, so the org INSERT policy's `has_org_permission(...,'producer')` (`20260502172041_*:337-342`) is **never enforced** on create. `organization_id` is read from `localStorage('smallbridges.currentOrgId')` with no membership check (`StudioContext.tsx:320,329`; `createDraftProject.ts:56,65`) — a user can stamp ANY org UUID onto their own project and leak it into that org's SELECT view. In-code comment "validate the membership server-side via RLS" (`StudioContext.tsx:317-318`) is false.
- **MEDIUM — `delete-project` destructive partial-failure (F6).** Auth + ownership correct (`delete-project/index.ts:39-79`, `isServiceRole || project.user_id===userId`). But storage + Replicate predictions are deleted (`:84-159`) BEFORE the row delete (`:231`); child deletes are a hardcoded ~15-table list (`:168-228`) that can drift from the 30+ FK graph (several FKs no-cascade, e.g. `20260105020508_*:15,40`). All child deletes swallow errors (`:168-225`); storage warn-only (`:153-154`). A missing table with rows → 500 after irreversible storage loss → orphaned project.
- **MEDIUM — `cancel-project` ignores service-role + org roles.** Ownership filtered `.eq('user_id', userId)` (`cancel-project/index.ts:94,289-290`): no `isServiceRole` branch, and org producers/admins get 404 on a teammate's org project. Refund dedup-guarded (`:313-320`) but refund/storage/prediction failures swallowed non-fatal (`:229-231,249-251,356-357`).
- **LOW — `movie_projects.user_id` nullable** (`20260103232411_*:37`): null-owner legacy rows invisible to per-user RLS.

### Tally
DONE: app CRUD (RLS-backed), `movie_projects` table + RLS + per-user enforcement. PARTIAL: delete-project, cancel-project, org-INSERT RLS enforcement, app-layer org resolution. BROKEN: **continue-production (IDOR)**.

---

## 4. EDITOR

Routes: `/editor`,`/editor/:id` (`App.tsx:826-843` → `src/pages/VideoEditor.tsx:9` re-exports `@/pages/Editor`), `/business/editor/:id` (`App.tsx:591-596,624` → `src/pages/workspace/WorkspaceEditor.tsx:7,12`). All converge on `src/pages/Editor/index.tsx` → `EditorShell.tsx` (single NLE impl). Four persistence layers (`index.tsx:46-62`), each writing a different column so they don't clobber at row level: clip props → `video_clips` (`useClipPropertiesSync.ts:114-253`, 500ms), timeline → `movie_projects.editor_state` (`useEditorStateSync.ts:105-165`, 600ms), script → `movie_projects.script_document` (`document-store.ts:152-206`, 600ms), localStorage cache (`usePersistence.ts`).

### Approve & Render — BROKEN (CRITICAL, confirmed)
Two CTAs — Inspector `ShotInspectorCard.tsx:464,476` → `TakesDrawer.tsx:1419-1433` → `enqueueShot` (`orchestrator.ts:102`); Script `Script.tsx:1592` → `approveAndRenderShot:418-442` → `enqueueShot`. Chain dead-ends: `installedRunner` is `null` and **`installJobRunner()` is never called anywhere in the repo** (verified grep → only definition + reader). So `drainQueue` immediately fails every job "No render engine is connected" (`orchestrator.ts:260-264`). Both surfaces therefore gate the CTA to a disabled stub — `ShotInspectorCard.tsx:304-326` renders disabled "Rendering coming soon" (self-documenting comment `:304`: "installJobRunner is never called"); `Script.tsx:424-427` toasts "coming soon" and returns before enqueue. The headline feature is a non-functional stub. `TakesDrawer.tsx:1419` has no `isRunnerInstalled` guard — survives only because the upstream render gate disables the button; remove that gate and the inspector path silently fails every shot.
Working generation is the separate `editor-generate-clip` path (regenerate `TakesDrawer.tsx:189-235`, CreatePanel `CreatePanel.tsx:100,247`) — real, awaited, error-toasted. Final render only via `RenderQueuePanel.tsx:51-54` retry → `final-assembly`; `ExportPanel` publishes only, no render (`ExportPanel.tsx:43-65`). `render-video` edge fn is **orphaned** (0 invokers).

### Data-loss — CONFIRMED, narrow
`EditorShell.tsx:187-220` `beforeunload`/`visibilitychange` safety net flushes only `document-store.flushNow` (script) `:190` and `flushPendingClipWrites` (clip props) `:191` — it **never calls `flushEditorState`** (verified grep in EditorShell → 0 hits). So a hard tab-close/browser-kill within 600ms of a structural timeline edit (split/trim/reorder/transition/title/track) with no explicit Save **loses that edit**, while `editor_state.clips` is the declared durable source-of-truth on reload (`useEditorStateSync.ts:44-49`; `useProject.ts:327-334`). SPA route-nav (unmount `:162`) and explicit Save/Export (`SaveDialog.tsx:149-151`, `ExportPanel.tsx:52`) are safe. Secondary: `flushEditorState` does a blind `.update({editor_state})` with no `authoredAt` conflict guard (`useEditorStateSync.ts:90-103`) → concurrent-editor last-writer-wins clobber (presence active `EditorShell.tsx:136`).
Most per-clip/per-keystroke loss vectors already hardened (baseline-hash on hydrate, snapshot-without-clear flush, synthetic-clip skip). Remaining exposure is the `editor_state` column specifically.

Edge fns `editor-generate-clip`/`editor-ai-scene`/`editor-tts`/`editor-transcribe`/`final-assembly`/`approve-clip-one` all `validateAuth`-guarded, errors mapped not swallowed. `render-video` MISSING/orphaned.

### Tally
DONE: route map, editor-generate-clip/regenerate/Create, edge-fn auth. PARTIAL: save/autosave (one data-loss window + concurrency clobber), final-assembly (retry-only entry). BROKEN: Approve & Render. MISSING: render-video (orphaned).

---

## 5. ACCOUNT-TYPE MUTUAL EXCLUSIVITY — DONE (DB-backed)

Single mutually-exclusive column `profiles.account_type text NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal','business','enterprise','admin'))` (`20260503042838_*:4-11`). "Both at once" structurally impossible. Switch locked in DB two ways:
1. RPC `consume_onboarding_intent` (SECURITY DEFINER, sole write path) C1 guard: returns `account_type_locked` when `onboarding_completed AND intent.account_type DISTINCT FROM current` (`20260704002000_onboarding_account_type_hardening.sql:62-71`). Set via `BusinessStart.tsx:259,296` / `Onboarding.tsx:55,103`.
2. Two BEFORE-UPDATE triggers block direct client PATCH: `prevent_profile_privilege_escalation` raises "cannot modify account_type" (`20260518184624_*:25-27`); `fn_profiles_block_sensitive_self_update` reverts `NEW.account_type:=OLD.account_type` for non-service-role (`20260626110000_profiles_tier_escalation_guard.sql:45,52-55`).

Surface routing is an additional **client-only** UX layer (documented as such): `RequireAccountType.tsx:42-46` (personal blocked from `/business/*`, `App.tsx:600-627`), `RedirectBusinessToModule.tsx:56-64` (business→`/business/*` twins), `BusinessWorldIsolation.tsx:30-55` (business blocked from `/lobby,/me,/profile,/account,/settings,/inbox`). Credits separated by wallet not leaked (`useEffectiveCredits.ts:35-36,82-106` — org pool vs personal).

Gaps (low): (1) lock pivots on `onboarding_completed` not on account_type itself — narrow pre-onboarding window before `Onboarding.tsx:73-83` sets the flag; (2) routing is client-only — relies on org-table RLS server-side; (3) `admin` straddles both worlds by design.

Verdict: DONE — DB-backed and enforced, not client-only.

---

## OVERALL TALLY

| Flow | Verdict |
|---|---|
| Auth/session (core) | DONE (4 PARTIAL: cold-load bounce, /inbox, oauth-callback plaintext, revoke-demo; 1 UNVERIFIED: manage-sessions) |
| Credits/billing | PARTIAL overall — frozen-balance FIXED, org-pool FIXED (Polar), ON CONFLICT FIXED; **zombie double-refund BROKEN**; Stripe-default/no-kill-switch HIGH |
| Projects | PARTIAL — RLS per-user DONE; **continue-production IDOR BROKEN**; org-INSERT RLS gap HIGH |
| Editor | **Approve & Render BROKEN**; save/autosave PARTIAL (editor_state data-loss); render-video MISSING |
| Account-type exclusivity | DONE (DB-backed) |

## TOP CORRECTNESS RISKS

Money:
1. **zombie-cleanup double-refunds** every stalled project/clip — `refund` row + `increment_credits` `system_grant` row both count in `credit_ledger_total` (`zombie-cleanup/index.ts:327-338,494-507,611-625` + `20260516222626_*:30-31` + `20260704000700_*:32`). Real spendable 2× credits; Phase-2 clips also lack idempotency.
2. **Org subscriptions via the default Stripe path leave the org pool unfunded** (`stripe-webhook-handler.ts:113-188` no topup/refill; default provider `payments/index.ts:55-56`; no kill-switch present).
3. **zombie refunds org spend to personal ledger** and never restores the org pool (`zombie-cleanup/index.ts:283-338`); also mints refunds on hold-flow projects that were only reserved (double-credit on top of hold release).
4. **Org refill depends on `organizations.plan` being set** + `org_plan_features` row, which no checkout/webhook sets (`20260705021000_*:36-45`) → paid org never funded.

Editor:
5. **Approve & Render is a non-functional stub** — `installJobRunner` never called (`orchestrator.ts:285-300`); queue dead-ends, CTAs gated to disabled "coming soon".
6. **editor_state data-loss window** — `beforeunload` net omits `flushEditorState` (`EditorShell.tsx:187-220`); hard-close within 600ms of a structural timeline edit loses it; plus no concurrency conflict guard (`useEditorStateSync.ts:90-103`).

Cross-cutting security:
7. **continue-production IDOR** — no ownership check, user-JWT reachable (`continue-production/index.ts:112` auth but no `user_id` gate anywhere).
8. **Cross-tenant org-injection** via permissive RLS OR-bypass (`20260104202048_*:13-16` vs `20260502172041_*:337-342`; client stamps arbitrary org UUID).
