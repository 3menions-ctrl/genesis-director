# TASKLIST — Prioritized, approvable (Phase A3)

The thing you sign off on. Each task: **area · what's wrong / what we're building · proposed solution (grounded in RESEARCH.md) · files · effort (S/M/L) · priority**. Grouped by area; within each, **FIX (broken)** before **UPGRADE (build best)**, ordered by impact. Dependencies flagged. Check boxes get ticked in Phase B.

**Priority key:** P0 = blocks shipping · P1 = high user-facing impact · P2 = important polish/robustness · P3 = nice-to-have.
**Effort key:** S ≈ <½ day · M ≈ 1–2 days · L ≈ 3+ days.

> Phase B note: I'm on `dev/staging` only — safe to run creations/pipeline, will NOT point at prod. I'll checkpoint-commit before each large change and keep the build green.

---

## AREA 1 — PIPELINES

### Fix what's broken
- [ ] **P1-A1.1 — Final film URL rots after 24h** · `BROKEN`
  - *Wrong:* `seamless-stitcher` writes a 24h signed URL into `movie_projects.video_url` (`:115,1102-1110,1420-1425`); bucket is private; nothing re-signs → link 403s after a day (bytes survive). `final-assembly:302` same.
  - *Solution (RESEARCH A1 §8–9 "sign-at-read"):* store the durable **storage path** in the DB; sign on demand at playback (a small helper/edge fn or `createSignedUrl` at read time in `Production.tsx`/player/share). Backfill existing rows' paths.
  - *Files:* `supabase/functions/seamless-stitcher/index.ts`, `final-assembly/index.ts`, `src/pages/Production.tsx`, share/embed players (`PublicShare.tsx`, `EmbedPlayer.tsx`), + a sign-at-read helper. Migration for any column rename/backfill.
  - *Effort:* M · **Priority: P1** (data is safe; playback breaks day-2 — treat as launch-critical for anyone returning to an old film).

- [ ] **P1-A1.2 — Auto-recovery tier is dark (stuck/orphaned jobs never heal)** · `BROKEN`
  - *Wrong:* `pipeline-watchdog`, `zombie-cleanup`, `admin-stuck-jobs-watchdog` are unscheduled (migration `20260516045913_*.sql` unschedules them); `pipeline-watchdog:347-359` is also behind `WATCHDOG_RESUME_ENABLED`. A dropped terminal webhook hangs a run forever, holding the user's credits.
  - *Solution (RESEARCH A1 §5 watchdog/reconciler):* re-schedule the watchdog + zombie crons via `pg_cron` (mirror the working credit-hold reconciler), set the resume flag, and confirm `_shared/replicate-recovery.ts` is in the path. **Do A1.3 first** so re-enabling the zombie sweep doesn't over-credit.
  - *Files:* new migration (`cron.schedule(...)`), `supabase/functions/pipeline-watchdog/index.ts` (flag/config), deploy zombie/watchdog fns.
  - *Effort:* M · **Priority: P0** (without this, infra hiccups silently strand paid renders). · **Depends on A1.3.**

- [ ] **P1-A1.3 — `zombie-cleanup` over-credits hold-flow projects** · `BROKEN`
  - *Wrong:* `zombie-cleanup/index.ts:293-298,330,524,642` calls `refund_credits` without checking `credit_hold_id`, while the reconciler also releases the hold → double credit. This is exactly the class `_shared/pipeline-failure.ts` guards against.
  - *Solution (RESEARCH A1 §6 compensations):* make zombie refunds hold-aware — reuse `markProjectFailedAndRefund` / the hold-release path instead of unconditional `refund_credits`; idempotent key per `(projectId, stage)`.
  - *Files:* `supabase/functions/zombie-cleanup/index.ts`, `_shared/pipeline-failure.ts` (reuse).
  - *Effort:* S–M · **Priority: P0** (financial correctness; **blocker for A1.2**).

- [ ] **P2-A1.4 — Runway Gen-4 advertised but unroutable** · `BROKEN`
  - *Wrong:* `engines.ts:273` lists `runway-gen4` as a cinema engine but `mode-router`'s `videoEngine` union (`:236`) omits it → silent fallback to Kling.
  - *Solution:* either (a) wire Runway into `mode-router` routing, or (b) hide/disable it in `engines.ts` until supported. Recommend (b) now, (a) as a follow-up. **Decision needed from you: enable or hide Runway?**
  - *Files:* `src/lib/video/engines.ts`, `supabase/functions/mode-router/index.ts`.
  - *Effort:* S (hide) / M (wire) · **Priority: P2.**

- [ ] **P2-A1.5 — `retry-failed-clip` has no max-retry cap** · `PARTIAL`
  - *Wrong:* tracks `retry_count` (`:292`) but never enforces a ceiling → unbounded retries / runaway spend.
  - *Solution (RESEARCH A1 §5 DLQ):* cap retries (e.g. 3), then mark failed + refund via the hold-aware path; surface a clear terminal error.
  - *Files:* `supabase/functions/retry-failed-clip/index.ts`, `_shared/pipeline-failure.ts`.
  - *Effort:* S · **Priority: P2.**

### Upgrade / build best
- [ ] **P2-A1.6 — Surface real per-stage progress + `message` (backend half)** · `UPGRADE`
  - *Building:* have the pipeline write granular `pipeline_state.{stage,progress,message}` at each real transition (script→storyboard→clip N/total→stitch→post) so the client renders **true** state. Pairs with A3.3 (frontend half).
  - *Solution (RESEARCH A1 §9 + A3 §1 operational transparency):* emit honest stage + human message strings at each step in `hollywood-pipeline`/`continue-production`/`seamless-stitcher`.
  - *Files:* `hollywood-pipeline/index.ts`, `continue-production/index.ts`, `seamless-stitcher/index.ts`, `_shared/*` progress helper.
  - *Effort:* M · **Priority: P2** · **Pairs with A3.3.**

- [ ] **P2-A1.7 — Wire the dead failsafe spine (DLQ / retry budget / circuit breaker)** · `UPGRADE`
  - *Building:* activate `_shared/pipeline-failsafes.ts` (0 importers today) for the outbound Replicate path so poison jobs land in a dead-letter table for replay instead of hanging.
  - *Solution (RESEARCH A1 §4–5):* import + apply circuit breaker/retry budget around `resilientFetch` call sites; add a DLQ table + admin replay. (Or formally retire the module if we standardize on pgmq — **decision needed: wire failsafes.ts vs adopt Supabase Queues/pgmq**. Recommend wiring the existing module now; pgmq as a larger future refactor.)
  - *Files:* `_shared/pipeline-failsafes.ts`, `_shared/network-resilience.ts`, pipeline fns, migration (DLQ table).
  - *Effort:* L · **Priority: P2.**

- [ ] **P3-A1.8 — Remove dead pipeline code & misleading metadata** · `UPGRADE`
  - *Building:* delete/retire `render-video`, `generate-story`, `scene-character-analyzer`, `generate-character-for-scene` (0 callers), the `python/` engine tree (or clearly mark archival), and fix/remove the test-only `engines.ts` `pipelineFunction` map that contradicts `mode-router`.
  - *Files:* listed edge fns, `python/**`, `src/lib/video/engines.ts`, related tests.
  - *Effort:* M · **Priority: P3** (hygiene; reduces future confusion). · Verify zero-callers again before deleting.

- [ ] **P3-A1.9 — Add still-storyboard to the default (Kling/Veo) path** · `PARTIAL→UPGRADE`
  - *Wrong/Building:* `generate-scene-images` is wired only into Seedance; the default path relies on prompt-text continuity. Optionally route the default path through a still-first storyboard for stronger continuity.
  - *Files:* `hollywood-pipeline/index.ts`, `generate-scene-images/index.ts`.
  - *Effort:* M · **Priority: P3** (quality upgrade, not a defect). · **Decision needed: is prompt-only continuity acceptable for default, or invest here?**

---

## AREA 2 — EDITOR

### Fix what's broken
- [ ] **P1-A2.1 — Editor exports never bake the edit (WYSIWYG is broken)** · `STUB`
  - *Wrong:* `ExportPanel` only flushes DB + `publish_reel`; the downloadable/shared file is the **un-edited source**. `final-assembly` (via `RenderQueuePanel.retry`) gets `{projectId, aspectRatio, reframe}` only; `addRenderJob` (`renderQueue.ts:58`) has zero callers. Trims/transitions/grades/mixes/titles never reach any bake.
  - *Solution (RESEARCH A2 "server-side bake / shared render graph"):* build an **edit decision list (EDL)** from the editor store (clip in/out, transitions w/ duration+kind, per-clip volume/fades, color grade, titles, master mix) and send it to the existing `seamless-stitcher`/`final-assembly` backend, which already builds the matching ffmpeg filter graph (`_shared/seamless-command.ts`). Populate the render queue (`addRenderJob`) from Export; show progress; replace `video_url`/publish artifact with the baked output. (WebCodecs client export = later enhancement.)
  - *Files:* `src/lib/editor/renderQueue.ts`, `src/pages/Editor/components/ExportPanel.tsx`, `RenderQueuePanel.tsx`, `src/lib/editor/store.ts` (EDL serializer), `supabase/functions/seamless-stitcher/index.ts` + `_shared/seamless-command.ts` (accept EDL params), `final-assembly/index.ts`.
  - *Effort:* L · **Priority: P1** (the editor is cosmetic relative to the deliverable until this exists). · **Depends conceptually on A1.1** (so the baked output URL doesn't rot).

- [ ] **P1-A2.2 — Transitions are uncontrollable; user duration/kind ignored; no hard cuts** · `PARTIAL`
  - *Wrong:* `StitchedPlayer` auto-dissolves the last 320ms of **every** clip (`:636,728-758`); `project.transitions[]` duration/kind only drive a decorative overlay; the B-buffer effect meant to honor them (`PlayerCanvas:587-621`) reads an unattached ref (dead).
  - *Solution (RESEARCH A2 "equal-power, user-controlled"):* drive the real canvas blend from `project.transitions[]` (kind + `durationSec`), default to a **hard cut** when no transition is set, keep the equal-power curve. Honor in preview AND in the A2.1 bake (single source of truth).
  - *Files:* `src/components/editor/StitchedPlayer.tsx`, `PlayerCanvas.tsx`, `src/lib/editor/store.ts` (transition model).
  - *Effort:* M · **Priority: P1** · **Pairs with A2.1** (same EDL).

- [ ] **P2-A2.3 — Per-clip volume / fade-in-out / opacity-scale keyframes don't affect playback** · `BROKEN`
  - *Wrong:* applied only in dead `PlayerCanvas` Effect A (`:444-488`, unattached `videoRef`); live `StitchedPlayer` ignores them; wrapper uses static `getClipProperty` not `getClipPropertyAt` (`PlayerCanvas:965-966`).
  - *Solution (RESEARCH A2 audio scheduling + resync):* apply per-clip gain/fades in the live `StitchedPlayer` audio path (`rampElementGain`), and animate opacity/scale via `getClipPropertyAt(playhead)`. Honor in the A2.1 bake too.
  - *Files:* `src/components/editor/StitchedPlayer.tsx`, `PlayerCanvas.tsx`, `src/hooks/editor/useAudioMixChain.ts`, `src/lib/editor/store.ts`.
  - *Effort:* M · **Priority: P2** · **Pairs with A2.1/A2.2.**

- [ ] **P3-A2.4 — Remove ~180 lines of dead null-ref playback effects** · `UPGRADE`
  - *Wrong:* `PlayerCanvas.tsx:440-621` (Effect A/B + B-buffer crossfade) all early-return; plus `renderQueue.addRenderJob` dead path and `index.tsx:79-150 useAutoPickProjectId`.
  - *Solution:* delete after A2.2/A2.3 reclaim any still-wanted logic; collapse to the single `StitchedPlayer` driver.
  - *Files:* `src/components/editor/PlayerCanvas.tsx`, `src/lib/editor/renderQueue.ts`, `src/pages/Editor/index.tsx`.
  - *Effort:* S · **Priority: P3** · **Do AFTER A2.2/A2.3.**

### Upgrade / build best
- [ ] **P2-A2.5 — Switch the compositor to `requestVideoFrameCallback` + drift resync** · `UPGRADE`
  - *Building:* drive `StitchedPlayer`'s canvas paint from `video.requestVideoFrameCallback` (true frame rate, `mediaTime`), gate cuts on a decoded B-buffer frame, resync video to the audio clock each tick.
  - *Solution (RESEARCH A2 playback/scrubbing principles).*
  - *Files:* `src/components/editor/StitchedPlayer.tsx`.
  - *Effort:* M · **Priority: P2.**

- [ ] **P3-A2.6 — Timeline filmstrip thumbnails + scrub-seek coalescing + perf** · `UPGRADE`
  - *Building:* two-tier sprite-sheet filmstrips on the timeline, coalesce >3 pending scrub seeks, throttle the 12Hz whole-tree playhead re-render, drop smooth-`scrollTo` during playback.
  - *Solution (RESEARCH A2 "proxies + sprite sheets", scrub coalescing).*
  - *Files:* `src/components/editor/Timeline.tsx`, `StitchedPlayer.tsx`, a thumbnail generator (reuse `extract-video-frame` edge fn).
  - *Effort:* L · **Priority: P3.**

---

## AREA 3 — COMMUNICATION SURFACES

### Fix what's broken / silent
- [ ] **P1-A3.1 — Celebrate render completion (the silent payoff)** · `SILENT`
  - *Wrong:* after a multi-minute wait, success is a bare `toast.success('Video ready!')` (`Production.tsx:1001,1560`); `celebrate()` (confetti+sound, reduced-motion-aware) is never fired here.
  - *Solution (RESEARCH A3 §10 tasteful FEAT celebration):* fire `celebrate('first-video' / per-render)` + `sfx.play('render-done')` on completion, with a richer success card (preview thumb, share/download/edit CTAs) instead of a fading toast.
  - *Files:* `src/pages/Production.tsx`, `src/lib/celebrate.ts` (add event), success card component.
  - *Effort:* S · **Priority: P1** (highest "make it fun" ROI; infra already built).

- [ ] **P1-A3.2 — Wire gamification into the creation/render flow** · `SILENT`
  - *Wrong:* `useGamification` (XP/streak/achievement/level) is consumed in one component; `addXp`/`updateStreak` never called when a user creates/finishes a video.
  - *Solution (RESEARCH A3 §10 reward moments):* on render completion (and first project, milestones) grant XP / bump streak / unlock achievements via `gamification-event`, surface a tasteful toast/level-up moment. Avoid spam (one per genuine feat).
  - *Files:* `src/pages/Production.tsx`, `src/hooks/useGamification.ts`, `supabase/functions/gamification-event`.
  - *Effort:* M · **Priority: P1** · **Pairs with A3.1.**

- [ ] **P1-A3.3 — Replace simulated progress with real stage + live narration** · `CONFUSING/faked`
  - *Wrong:* headline % is a fabricated ramp (`Production.tsx:1325-1374`, 3s `progressTick`); stitching hardcoded "85+tick"; backend `pipeline_state.message` ignored; waveform is `Math.sin`.
  - *Solution (RESEARCH A3 §1/§6 operational transparency + honesty over false precision):* render the **real** stage + `pipeline_state.message` (rotating honest copy), show a true determinate bar where counts exist (clips done/total) and honest indeterminate elsewhere, surface per-clip thumbnails as they land (A3 §3 partial previews). Drop or relabel the `Math.sin` waveform. **Pairs with A1.6 (backend emits the data).**
  - *Files:* `src/pages/Production.tsx`, `src/components/create/PipelineCreation.tsx`, `src/components/production/CinematicPipelineProgress.tsx`, `src/lib/video/continuity/phases.ts`.
  - *Effort:* M · **Priority: P1** · **Depends on / pairs with A1.6.**

- [ ] **P2-A3.4 — Collapse the two stacked pipeline visualizers** · `CONFUSING`
  - *Wrong:* `PipelineCreation` (full-screen) renders over `CinematicPipelineProgress` (inline) during a render — duplicate %/clips/cancel.
  - *Solution:* pick one canonical long-render UI (keep the best shell), feed it the real data from A3.3; remove the duplicate mount.
  - *Files:* `src/pages/Production.tsx`, the two progress components.
  - *Effort:* S–M · **Priority: P2** · **Do with A3.3.**

- [ ] **P2-A3.5 — Stop implying continuity measurement that doesn't exist** · `CONFUSING`
  - *Wrong:* continuity index "—", heuristic boundary types, "8-phase" rail that's really ~3 states (`phases.ts:144`, `Production.tsx:1432-1442`).
  - *Solution (RESEARCH A3 "honesty"):* either surface the **real** `continuity-audit` score (it exists server-side via `_shared/continuity-contract.ts`) or relabel the rail to the honest stage set; remove fabricated boundary inference.
  - *Files:* `src/lib/video/continuity/phases.ts`, `Production.tsx`, optionally read `continuity-audit` output.
  - *Effort:* M · **Priority: P2** · **Decision needed: surface real continuity score vs simplify the rail.**

### Upgrade / build best
- [ ] **P2-A3.6 — "Continue in background" + notify-when-done for long renders** · `MISSING`
  - *Building:* let users leave the render running and get notified (Inbox + `send-push-notification` + completion toast/banner) when done — escalate the offer at ~15s/~60s.
  - *Solution (RESEARCH A3 §5 give control at 10s+).*
  - *Files:* `src/pages/Production.tsx`, `supabase/functions/send-push-notification`, Inbox/notification wiring.
  - *Effort:* M · **Priority: P2.**

- [ ] **P2-A3.7 — Shared `EmptyState` + consolidate loading/toast/error systems** · `STATIC/duplication`
  - *Building:* one reusable guiding `EmptyState` (promote Inbox/Library's) applied across ~30 pages; retire the dead Radix toaster (keep branded `sonner`); standardize on `CinemaLoader`+skeletons (retire redundant loaders); consolidate the 3 error boundaries.
  - *Solution (RESEARCH A3 §4/§8/§9 + consistency).*
  - *Files:* new `src/components/ui/empty-state.tsx`, callers; remove `hooks/use-toast.ts`/`ui/toaster.tsx`/`ui/toast.tsx`; loader/boundary consolidation; remove unused `gsap`.
  - *Effort:* L · **Priority: P2** (broad but mechanical).

- [ ] **P3-A3.8 — First-run onboarding + coachmarks + tooltip density** · `MISSING/STATIC`
  - *Building:* a real first-project walkthrough / coachmarks (esp. the Generate button + duration expectation), and broaden tooltip coverage. Implement the missing `useSmartMessages` hook (or formally drop `smartMessages.ts` + its doc).
  - *Solution (RESEARCH A3 §11 JIT onboarding).*
  - *Files:* `src/pages/Onboarding.tsx`, new coachmark component, `src/lib/smartMessages.ts` / new `useSmartMessages.ts`, tooltip additions, `docs/SMART_MESSAGES_SYSTEM.md`.
  - *Effort:* L · **Priority: P3** · **Decision needed: build smart-messages hook vs retire it.**

---

## Cross-area dependency map
- **A1.3 → A1.2** — fix zombie over-credit *before* re-enabling watchdog/zombie crons.
- **A1.1 → A2.1** — sign-at-read must exist so the editor's baked output URL doesn't rot.
- **A1.6 ↔ A3.3** — backend emits real stage/message; frontend renders it. Do together.
- **A2.1 ↔ A2.2 ↔ A2.3** — one EDL drives bake + transitions + per-clip automation; build the EDL once, honor it in preview and bake.
- **A2.2/A2.3 → A2.4** — reclaim wanted logic before deleting dead playback effects.
- **A3.3 → A3.4** — collapse the duplicate visualizer as part of the real-progress rework.

## Suggested execution order (impact-first)
1. **P0 financial/robustness:** A1.3 → A1.2.
2. **P1 launch-critical UX:** A1.1, then A2.1 (+A2.2), A3.1, A3.2, A1.6+A3.3.
3. **P2 polish/robustness:** A2.3, A2.5, A3.4, A3.5, A3.6, A3.7, A1.4, A1.5, A1.7.
4. **P3 hygiene/upgrades:** A1.8, A1.9, A2.4, A2.6, A3.8.

## Open decisions for you (so Phase B doesn't guess)
1. **Runway (A1.4):** wire it into `mode-router`, or hide it until later? *(recommend hide now)*
2. **Failsafe approach (A1.7):** wire the existing `pipeline-failsafes.ts`, or adopt Supabase Queues/pgmq as a larger refactor? *(recommend wire now)*
3. **Default-path storyboard (A1.9):** invest in still-first continuity for Kling/Veo, or accept prompt-only? 
4. **Continuity rail (A3.5):** surface the real `continuity-audit` score, or simplify the rail to honest stages? 
5. **Smart-messages (A3.8):** build the missing `useSmartMessages` hook, or retire `smartMessages.ts` + its doc? 
6. **Export strategy (A2.1):** confirm server-side bake (reuse `seamless-stitcher`) as the v1 path, with WebCodecs client export deferred. *(recommend yes)*
