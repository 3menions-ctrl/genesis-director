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
