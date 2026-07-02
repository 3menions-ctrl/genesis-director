# DIAGNOSIS — Current-state assessment (Phase A2)

Evidence-based, read-only. Branch `upgrade`. Status vocabulary: **DONE** (works) · **PARTIAL** (works with gaps) · **BROKEN** (real defect, cited) · **STUB** (placeholder/no-op) · **MISSING** · **UNVERIFIED** (not traced this pass). Every claim cites `file:function`/line.

> **Interpretation note on "communication surfaces":** I read this as *every place the app talks to the user* — loading/progress, toasts/notifications, error states, empty states, onboarding, tooltips, and especially the multi-minute generation/render wait. If you meant something narrower (e.g. only in-app messaging/Inbox), say so before approving and I'll re-scope Area 3.

> **Memo/prior-report verification:** The earlier `EDITOR_REPORT.md` (branch `editor-work`) and `ERROR_MESSAGING_REPORT.md` (branch `error-messaging`) were written on separate branches. I verified against this branch's actual source: **the editor's 10 prior bug-fixes ARE present here**, and **the error-sanitizer infra DID land here** (`src/lib/safeErrorMessage.ts` imported in ~35 files; `_shared/error-response.ts` exists). The memo claim "Python engine is dead" = **TRUE**; "final-film 24h URL bug" = **CONFIRMED**; "Editor render is dead" = **CONFIRMED**; "ProjectType is dead" = **UNVERIFIED**.

---

## AREA 1 — PIPELINES (creation / render)

**Real entry path** (verified): `src/pages/Studio.tsx:453` → edge fn **`mode-router`** (NOT the `src/lib/video/engines.ts` `pipelineFunction` map, which is test-only metadata). `mode-router` creates the `movie_projects` row and routes by engine:
- Kling/Veo/Sora/Wan → **`hollywood-pipeline`** (default cinematic path)
- Seedance + all "breakout" templates → **`seedance-pipeline`**
- avatar / video-to-video / motion-transfer → direct single-pass fns (`generate-avatar-direct`, `stylize-video`, `motion-transfer`)

Backend-driven happy path (no client needed to finish):
`mode-router` → `hollywood-pipeline` (pre-prod + dispatch clip 0) → `generate-single-clip` → Replicate → `replicate-webhook`/`poll-replicate-prediction` → `continue-production` (chains clip N+1) → … → last clip → `final-assembly` → `seamless-stitcher` (Replicate ffmpeg cog) → `movie_projects.video_url`.

### Per-stage status

| Stage | Files : functions | Status | Evidence |
|---|---|---|---|
| Dispatch / project create / credit gate | `mode-router/index.ts:248-655`, `handleCinematicMode:1170` | **DONE** | Routes engines (`:1229-1232`), deducts credits (`:506`), one-active-project guard (`:351`) |
| Scripting | `smart-script-generator/index.ts:976` (default, gpt-4o); `seedance-script-director/index.ts:21,242` (Seedance) | **DONE** | Called `hollywood-pipeline:1260,1404` & `seedance-pipeline:622`. `generate-story` is **DEAD (0 callers)** |
| Identity / "bible" | `extract-scene-identity/index.ts:389,540` (gpt-4o vision) | **DONE** | Called `hollywood-pipeline:783`, consumed `smart-script-generator:96-109`. Multi-char casting fns (`scene-character-analyzer`, `generate-character-for-scene`) are **DEAD** |
| Storyboard / scene stills | `generate-scene-images/index.ts:183,230` (FLUX) | **PARTIAL** | Real, but wired **only** into Seedance (`seedance-pipeline:713`). Default Kling/Veo path has **no still storyboard** — continuity is prompt-text only |
| Script-approval gate | `ScriptApproval.tsx` + `hollywood-pipeline:6139-6150` (pause) + `resume-pipeline` | **DONE** | Real blocking gate; `Production.tsx:1108` resumes. Seedance/breakouts bypass it (`Studio.tsx:405-409`) |
| Per-clip motion gen | `generate-single-clip/index.ts` (default); `generate-video` (Seedance's clip gen) | **DONE** | Submits Replicate predictions w/ webhook; dispatches clip 0 then returns `generating` (`hollywood-pipeline:3671-3780`) |
| Clip chaining / continuity | `continue-production/index.ts:238-888` | **DONE** | Webhook-driven, serial via mutex, accumulates anchors (`:452,721`) |
| Filing / storage of clips | `_shared/video-persistence.ts`, `replicate-webhook/index.ts:255` | **DONE** | Output copied to durable bucket before temp URL expires |
| Stitch trigger | `continue-production:157-234` → `final-assembly` (3× retry) | **DONE** | Backend-driven; falls back to manifest if assembly fails (`:195-222`) |
| Stitching / assembly | `seamless-stitcher/index.ts:1286` (`runFfmpeg` → Replicate cog `magpai-app/cog-ffmpeg`); `_shared/seamless-command.ts:180` | **DONE** | Real `filter_complex`: per-input normalize, `xfade`/`acrossfade`, `drawtext`, music ducking via `sidechaincompress` |
| Audio mix (narration/music) | `_shared/audio-mix-filters.ts:29,125`; `seamless-command.ts:423-481` | **DONE** | Real afilters (loudnorm, EQ, sidechain duck); EQ/reverb intentionally approximate |
| Quality post (4K Topaz / 60fps RIFE) | `_shared/quality-post.ts:137`; `seamless-stitcher:1025-1096` | **DONE** | Real Replicate models, charge-on-delivery w/ idempotency |
| **Final URL persistence** | `seamless-stitcher:115` (`SIGNED_URL_TTL=86400`), `:1420-1425`, `:1102-1110`; `final-assembly:302` | **🔴 BROKEN** | Writes a **24h signed URL** into `movie_projects.video_url`; bucket private; never re-signed → link 403s after a day (bytes persist). See defect P0-1 |
| Studio/playback | `src/pages/Production.tsx` (realtime), `Studio.tsx` | DONE (inherits the URL bug) | — |

### Failure handling — reality
**Robust:** signature-verified `replicate-webhook` (idempotent) + self-chaining `poll-replicate-prediction` (`MAX_CHAIN_DEPTH=30`) gap-filler; `_shared/replicate-recovery.ts:36` rescues output even after give-up; `_shared/network-resilience.ts` `resilientFetch` (4 retries, backoff+jitter, `Retry-After`); `_shared/pipeline-failure.ts` `markProjectFailedAndRefund` is hold-aware + idempotent; the **credit-hold reconciler** (`reconcile_pipeline_credit_holds()`/`expire_credit_holds()`) runs every 5 min (the one **verified-live** cron).

**Fragile / broken:**
- **🔴 Watchdogs are dark.** `pipeline-watchdog`, `zombie-cleanup`, `admin-stuck-jobs-watchdog` are **not scheduled** in repo — migration `20260516045913_*.sql` `cron.unschedule`s the watchdog jobs and nothing re-schedules them; `pipeline-watchdog/index.ts:347-359` is *additionally* gated behind `WATCHDOG_RESUME_ENABLED==="true"`. So stuck-clip recovery + orphan-prediction rescue only run if hand-wired via the Supabase dashboard (unverifiable from repo). A dropped terminal webhook hangs a run indefinitely. **(P0-2)**
- **🟠 `zombie-cleanup` is NOT hold-aware** (`zombie-cleanup/index.ts:293-298,330,524,642`) — issues `refund_credits` for hold-flow projects while the reconciler also releases the hold → **double-credit / over-credit**. **(P1-3)**
- **🟡 Dead failsafe spine.** `_shared/pipeline-failsafes.ts` (circuit breaker, retry budget, dead-letter queue, preflight) has **0 importers** — the documented resilience guarantees don't run. **(P2)**
- **🟡 `job-queue/index.ts`** — in-memory `Map` queue (`:53-54`), lost on cold start; effectively a stub.
- **🟡 `retry-failed-clip`** — tracks `retry_count` (`:292`) but **never enforces a max** → unbounded retries. **(P2)**

### Dead / duplicate / competing paths
- **DEAD:** `render-video` (0 callers), `generate-story`, `scene-character-analyzer`, `generate-character-for-scene` (0 callers); the entire **Python engine** (`python/photoreal_pipeline`, `comp_engine`, `breakout_pipeline` — 0 callers; `python/README.md` claim that `seedance-pipeline` shells out to `python -m breakout_pipeline.cli` is **FALSE**, no `Deno.Command` exists); `_shared/pipeline-failsafes.ts`.
- **Misleading metadata:** `src/lib/video/engines.ts` `pipelineFunction` map (wan/veo/sora→`generate-video`, kling→`hollywood-pipeline`) is referenced **only in tests** and **contradicts** runtime routing in `mode-router` (wan/veo/sora→`hollywood-pipeline`).
- **🟠 Runway Gen-4 has no live route.** `engines.ts:273` advertises `runway-gen4` as a full cinema engine, but `mode-router`'s `videoEngine` union (`mode-router/index.ts:236`) lacks it → selecting Runway silently falls back to Kling. **(P1)**
- **Frontend 8-phase "Continuity Engine" rail** (`src/lib/video/continuity/phases.ts`, `PipelineCreation.tsx`) is a **cosmetic remap** of a coarser backend vocabulary; but `_shared/continuity-contract.ts` is a **real backend twin** enforced server-side by `hollywood-pipeline` + `continuity-audit` (the *contract* is real; the *progress labels* are presentation).

### Progress/status data already available (feeds Area 3)
- `movie_projects`: `status`, `pipeline_stage` enum, `pipeline_state` JSON `{stage, progress 0-100, message, predictionId, startedAt}`, `last_error`, `pending_video_tasks` JSON, `video_url`.
- `video_clips`: per-clip `status`, `error_message`, `retry_count`, `replicate_prediction_id`, `video_url`, `last_frame_url`.
- Realtime: `Production.tsx:669,839` subscribes `postgres_changes` on both tables + a `setInterval` polling fallback (`:242`). **This is the authoritative progress surface** — it already carries real per-clip status and a backend `pipeline_state.message` the UI currently ignores.

---

## AREA 2 — EDITOR (studio / editing experience)

**Architecture:** two `useSyncExternalStore` stores — `src/lib/editor/store.ts` (2202 lines; editor-time state, functional clip mutations, ripple `recompute()`, 50-deep undo) and `src/lib/editor/document-store.ts` (470 lines; durable `ScriptDocument`, debounced 600ms flush to `movie_projects.script_document`). Mount: `src/pages/Editor/index.tsx` → `EditorShell.tsx` (owns global keymap + modals). Playback core = **`StitchedPlayer.tsx`** (843 lines): a real A/B ping-pong dual-`<video>` engine + canvas compositor at 60Hz; audio via **`useAudioMixChain.ts`** (real Web Audio graph per element). `PlayerCanvas.tsx` is the host chrome around it.

### Capability status

| Capability | Files:functions | Status | Evidence |
|---|---|---|---|
| Playback | `StitchedPlayer` tick/role-flip (248-373); `PlayerCanvas` onTimeUpdate (1163-1180) | **DONE (real)** | True A/B dual-buffer, rAF boundary detect ≤16ms (349), canvas drawCover compositing (678-771), auto-advance |
| Scrubbing / seek | `Timeline.onRulerDown` (1173); `PlayerCanvas` scrub `role=slider` (1377-1398); `store.setPlayhead` (511); `StitchedPlayer` seek effect (505-521) | **DONE** | Drift-guarded seeks (>0.25s), pointer-drag ruler, frame-step, JKL, goto-timecode |
| Crossfade / transitions | `StitchedPlayer` canvas blend `CROSSFADE_MS=320` (636,728-758); `PlayerCanvas` xfade overlay (400-414,1203-1219); `store.addTransition` (1558) | **🟠 PARTIAL / semi-faked** | Real equal-power blend exists but fires **unconditionally in the last 320ms of every clip**; user-set `durationSec`/`kind` only drive a separate opacity-dim overlay, **not** the actual inter-clip blend. The B-buffer effect meant to honor user transitions (`PlayerCanvas:587-621`) reads `videoBRef`, **never attached to a DOM element** (dead) |
| Audio sync | `useAudioMixChain` (whole file); `StitchedPlayer` `rampElementGain` role-flip (598-619,750-751) | **PARTIAL** | Mix graph + equal-power audio crossfade are real & click-free. But per-clip `volume`/`fadeInSec`/`fadeOutSec` and opacity/scale **keyframes** are only applied in `PlayerCanvas` Effect A (444-488), which is **dead** (reads unattached `videoRef`) → they have no effect during real playback |
| Clip add/move/trim/delete | `store.moveClip`(553),`trimClip`(837),`deleteClip`(2180),`splitAtPlayhead`(1278),`slip/slide/roll`(598-684),`replaceClip`(690) | **DONE** | Full functional ripple model, lock-track checks, burst-coalesced trim history |
| Multi-select | `store.extendClipSelection`(177),`toggleClipSelection`(192),`selectAllClips`(347),`deleteSelected`(327) | **DONE** | Shift/Cmd-click in `ClipBlock` (1331-1339) |
| Undo / redo | `store.undo`(219),`redo`(243) | **DONE** | Both prune dangling selection (prior fix present at 258-261); 50-deep |
| **Render / export** | `ExportPanel.tsx`; `RenderQueuePanel.retry`(51-88); `renderQueue.ts:58` (`addRenderJob`) | **🔴 STUB / effectively MISSING** | Export header literally says "The editor never renders." Export only flushes DB + `publish_reel` + `is_public`. `final-assembly` is reachable only via `retry`, sending `{projectId, aspectRatio, reframe}` — **none** of the editor's trims/transitions/grades/mixes. `addRenderJob` has **zero callers** → queue can never populate. **Net: every edit is preview-only; the downloadable/shareable file is the un-edited source.** |

### Playback / crossfade / audio-sync reality check
- **Playback is real and well-built** (legitimate pro-NLE dual-buffer pattern — the strongest part of the editor).
- **Crossfades:** real frame-blending but **uncontrollable** — you cannot get a hard cut (every boundary gets a ~320ms dissolve), and user transition duration/kind don't change the real blend.
- **Audio:** real mix + crossfade, but per-clip automation (volume/fades/keyframes) is stranded in dead code → "what you set is not what plays."
- **Export:** confirmed stub — no bake. This makes the entire editing surface **cosmetic relative to the deliverable**.

### Dead code
- `PlayerCanvas.tsx:440-621` — Effect A (440-547), Effect B (552-572), B-buffer crossfade (587-621) all early-return (`videoRef`/`videoBRef` never attached). ~180 lines of dead playback logic.
- `renderQueue.ts:58` `addRenderJob` — exported, **no callers**; `RenderQueuePanel` (Q key) can only ever show an empty list.
- `src/pages/Editor/index.tsx:79-150` `useAutoPickProjectId` — defined, never called.
- (`views/Stage.tsx` does not exist on this branch — prior report's "dead Stage.tsx" claim is moot; the Stage view is `PlayerCanvas`.)

### Top editor defects (ranked)
1. **🔴 No render/bake of edits** — export publishes but the downloadable file is the un-edited source. `ExportPanel.tsx:1-9`, `RenderQueuePanel.tsx:51-59`, `renderQueue.ts:58`.
2. **🟠 No hard cuts; user transition duration/kind ignored** — fixed 320ms auto-dissolve. `StitchedPlayer.tsx:636,405-406,728-758`.
3. **🟠 Per-clip volume / fades / keyframes don't affect playback** (stranded in dead Effect A). `PlayerCanvas.tsx:444-488` vs static `965-966`.
4. **🟡 ~180 lines dead null-ref playback effects** create a confusing "two playback drivers" situation. `PlayerCanvas.tsx:440-621`.
5. **🟡 Keyboard-listener churn** — `PlayerCanvas` rebinds global `keydown` every render (self-noted TODO 940-947); overlapping listeners in EditorShell/Timeline/PlayerCanvas/modals. `PlayerCanvas.tsx:843-960`.
6. **🟡 12Hz store-driven playhead re-renders whole tree** + Timeline smooth-`scrollTo` every tick → stutter during playback. `StitchedPlayer.tsx:330-331`, `Timeline.tsx:432-442`.

> **Verdict:** the editing model (store/ripple/undo/multi-select/trim/split/slip) and the dual-buffer playback + Web Audio mix are genuinely good and **not** faked. The two structural gaps are (1) **no export that bakes the edit** and (2) **transitions + per-clip A/V automation are decorative**.

---

## AREA 3 — COMMUNICATION SURFACES

### Inventory by category

| Surface | Key files | Rating | Notes |
|---|---|---|---|
| Toast / notifications | `src/components/ui/sonner.tsx` (mounted once, `App.tsx:256`) | **DELIGHTFUL** | One canonical branded system: framer-motion spring icons, glass shell, per-severity glow. 160 importers |
| Toast (duplicate/dead) | `src/hooks/use-toast.ts`, `ui/toaster.tsx`, `ui/toast.tsx` (Radix) | **STATIC/dead** | Only 2 importers, **not mounted**. Competing legacy system |
| Page loading | `src/components/ui/CinemaLoader.tsx`, `src/hooks/useGatekeeperLoading.ts` | **DELIGHTFUL** | "Render Core" reactor + rotating boot phrases; unified auth/data/image phases |
| Skeletons / fallbacks | `ui/loading-skeletons.tsx`, `page-skeleton.tsx`, `UnifiedLoadingPage.tsx`, `Spinner.tsx`, `GlobalLoadingOverlay.tsx` | **STATIC** | Functional but **4+ overlapping primitives**; in-section Production fallbacks are bare spinners (`SectionLoader` 60-65) |
| **Long-render progress** | `Production.tsx`, `components/create/PipelineCreation.tsx`, `components/production/CinematicPipelineProgress.tsx`, `lib/video/continuity/phases.ts` | **DELIGHTFUL visually / 🟠 CONFUSING semantically** | Gorgeous but **two visualizers stack** and the headline % is **simulated** — see deep-dive |
| Error banners | `components/production/PipelineErrorBanner.tsx`; suppression in `Production.tsx:1591-1684` | **DELIGHTFUL** | Suppresses transient/auto-recovering errors; real 180s stall hint ("…we'll refund every credit", 1622-1638) |
| Error boundaries | `stability/GlobalStabilityBoundary.tsx`, `StabilityBoundary.tsx`, `ui/error-boundary.tsx` | **STATIC** | Three implementations; sanitized ("Something went wrong"); not playful |
| 404 | `src/pages/NotFound.tsx` | **DELIGHTFUL** | "Scene Not Found — didn't make the final cut", animated, clear CTAs |
| Empty states | Inbox `EmptyState` (`Inbox.tsx:1574`), Library `EmptyLibrary`/`CategoryEmpty` (`Library.tsx:1021,1056`), ~30 pages roll their own | **MIXED** | Best are DELIGHTFUL; **no shared `EmptyState` component** (`find -iname "*empty*"` = none); many business pages likely STATIC/dead-end |
| Onboarding | `src/pages/Onboarding.tsx` (125 lines, pure redirect), `components/welcome/WelcomeOfferModal.tsx` | **🔴 SILENT/missing** | No tour, no coachmarks, no walkthrough. First-run guidance was supposed to come from a smart-messages hook that **doesn't exist** |
| Tooltips | `ui/tooltip.tsx` + ~20 consumers | **STATIC** | Low density for a feature-dense app — discoverability gap |
| In-app Inbox | `src/pages/Inbox.tsx` (2448 lines) | **DELIGHTFUL** | Rich, animated, summary tiles, cinematic empty states |
| Push notifications | `send-push-notification` edge fn, `social/NotificationBell.tsx` | UNVERIFIED (exists) | Available to wire to render completion |
| Gamification | `src/hooks/useGamification.ts` (XP/levels/streaks/achievements), `gamification-event` edge fn | **🔴 SILENT (unwired)** | Full engine, consumed in **one** component (`social/UserStatsBar.tsx`); `addXp`/`updateStreak` **never called from creation/render flow** |
| Celebration / confetti | `src/lib/celebrate.ts` (confetti + sound, milestone-gated, reduced-motion aware) | **🔴 SILENT at the key moment** | Excellent infra, fired in only 3 places (`useReelPublisher`, `Auth`, admin `LiveBuyAlert`) — **not on render completion** |

### Long-render experience deep-dive (the multi-minute wait)
When a standard render runs, `Production.tsx` mounts **TWO progress visualizers at once**: `PipelineCreation` (full-screen "small bridge" takeover, `showBridge` 1452/1483) **over** `CinematicPipelineProgress` (inline card, 1748) — redundant, two sources for the same numbers.

**Real vs fake:**
- **Real & used:** completed/generating clip counts from `video_clips` via Realtime (`Production.tsx:838-866`); per-clip "Clip 3 done/generating/failed" log lines.
- **🟠 Headline % is simulated.** `realTimeProgress` (1325-1374) **deliberately ignores** backend `pending_video_tasks.progress` ("can be stale") and instead adds a **fabricated within-clip ramp** from a 3s `progressTick` timer (1317-1323); stitching is hardcoded "85 + tick" (1367).
- **🟠 Continuity chain is decorative.** `derivePipelineFromCounts` (`phases.ts:144`) leaves `composite` undefined (renders "—"); boundary types are heuristic-inferred from `sceneType` changes (`Production.tsx:1432-1442`); the "8 phases" collapse to ~3 states via a 3-way `if`.
- **Waveform** in `CinematicPipelineProgress` (61-173) is pure `Math.sin` — no connection to real audio.
- **🟠 The reassuring channel is wired-but-empty:** the model supports `pipeline.message` ("Re-seeding shot 4…", `PipelineCreation.tsx:403`) but `livePipeline` never sets it and the page ignores backend `pipeline_state.message`.

**Net:** *looks* alive and premium and does reflect real clip completion, but the %/continuity/boundaries/waveform are cosmetic and the one channel that could narrate true backend status is unused. Genuinely real: the per-clip log/grid and the 180s stall hint.

### Consistency / duplication problems
1. Two toast systems (branded sonner mounted; Radix `use-toast` dead).
2. Two pipeline visualizers render simultaneously during a render.
3. 4+ loading primitives (CinemaLoader / UnifiedLoadingPage / loading-skeletons / Spinner / GlobalLoadingOverlay + ad-hoc `animate-spin`).
4. No shared `EmptyState` — ~30 pages hand-roll.
5. Three error-boundary implementations.
6. Two messaging frameworks: `smartMessages.ts` (1 importer, documented hook `useSmartMessages.ts` **MISSING**) vs direct `sonner` everywhere (`docs/SMART_MESSAGES_SYSTEM.md` oversells reach).

### Biggest silent / lifeless gaps (ranked)
1. **🔴 No celebration on render completion** — after a multi-minute wait, success is just `toast.success('Video ready!')` (`Production.tsx:1001`, 1560). `celebrate()` exists and is **never called here**. #1 "make it fun" win, infra already built.
2. **🔴 Gamification fully built but unwired to creation** — making/finishing a video grants no XP/streak/achievement. Zero reward loop.
3. **🟠 `pipeline_state.message` ambient narration unused** for standard renders — users get a creeping % + fake waveform instead of real status text the backend already emits.
4. **🟠 No onboarding/first-run guidance** — `Onboarding.tsx` is a redirect; documented smart-message tips depend on a missing hook.
5. **🟠 Premium continuity visualization implies measurement it doesn't have** (index "—", heuristic boundaries, 3-state "8-phase") — borderline misleading.
6. **🟡 Sparse tooltips** (20 files) — discoverability gap.

### Existing reusable delight infra (reuse, don't rebuild)
- `framer-motion` (124 files) — strong animation foundation.
- `canvas-confetti` via `src/lib/celebrate.ts` — milestone-gated, reduced-motion-aware, per-event palette + sound. Just needs a render-complete trigger.
- `src/lib/sound.ts` (`sfx.play('render-done')`) — audio feedback layer exists.
- `CinemaLoader` — single beautiful loading source of truth.
- Branded `sonner` toaster — supports `epic`/celebratory tiers.
- `PipelineCreation` + `CinematicPipelineProgress` — top-tier visual shells; they need **real data feeds, not more chrome**.
- `useGamification` — complete XP/streak/achievement engine ready to wire.
- Inbox `EmptyState` / Library `EmptyLibrary` — promote one to a shared component.
- `lottie-react` — installed, barely used.
- **Dead weight:** `gsap` in `package.json`, **zero usage in `src/`** — remove or use.

> **Verdict:** the app already owns a premium, consistent *visual* vocabulary; the highest-impact emotional moments (render done, earning XP/streaks, real "what's happening now" narration, first-run guidance) are silent or faked. Fastest wins: wire `celebrate()` + `useGamification` + real `pipeline_state.message` into Production, and collapse the duplicate toast/loading/pipeline systems.
