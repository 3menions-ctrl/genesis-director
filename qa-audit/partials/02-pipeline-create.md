# 02 — Production Pipeline: FRONT HALF (idea → project → script → storyboard → scene/character setup → clips begin)

READ-ONLY QA audit. Surface: the create flow up to the point clips start
generating. Evidence cited as `file:line`. Live-backend-dependent claims marked
**UNVERIFIED**.

The actual happy path is: **Studio** (`handleStartCreation`) → edge fn
**`mode-router`** → **`hollywood-pipeline`** (writes script, pauses at
`awaiting_approval`) → **Production.tsx** renders `ScriptApproval` → user approves
→ **`resume-pipeline`** → **`hollywood-pipeline`** (`resumeFrom='qualitygate'`) →
qualitygate → assets → production → **`generate-single-clip`** (clip 1 dispatch =
"clips begin generating"). `Cinema.tsx` is the marketing landing,
`PipelinePreview.tsx` is a self-driving demo, `WorkspaceEditor.tsx` just mounts
the Editor — all three are OUT of the generation pipeline.

---

## INVENTORY

| Function/Step | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Studio `handleStartCreation` | `src/pages/Studio.tsx:301` | Create-flow entry: credit pre-gate, build body, invoke router, navigate to `/production/:id` | credit check (`cinemaGuard`, `getAuthoritativeCreditState`) → `invoke('mode-router')` → reads `data.projectId` → `emergencyNavigate('/production/'+id)` | OK |
| `CreationStudio` (form) | `src/components/studio/CreationStudio.tsx` | Collects mode/prompt/clipCount/engine; calls `onStartCreation` | passes config object up to Studio | OK (not deeply audited; composition surface) |
| `mode-router` serve | `supabase/functions/mode-router/index.ts:252` | Auth (JWT, 403 on mismatch), content-safety, single-project lock, create project, credit deduction for direct modes, dispatch | OK |
| `mode-router` `handleCinematicMode` | `mode-router:1180` | text/image-to-video/b-roll → `hollywood-pipeline` | forwards `requireApproval`, `videoEngine`, `autoApprove` (seedance only) | OK |
| `mode-router` `handleAvatarDirectMode` | `mode-router:685` | avatar (non-seedance) → `generate-avatar-direct` | OK (fn exists) |
| `mode-router` `handleAvatarCinematicMode` | `mode-router:788` | avatar+seedance → `hollywood-pipeline` (`autoApprove:true`) | OK |
| `mode-router` `handleStyleTransferMode` | `mode-router:1034` | video-to-video → `stylize-video` | OK (fn exists) |
| `mode-router` `handleMotionTransferMode` | `mode-router:1107` | motion-transfer → `motion-transfer` | OK (fn exists) |
| `hollywood-pipeline` serve | `hollywood-pipeline:6738` | Orchestrator entry: auth/IDOR/engine-lock, credit HOLD (`reserve_credits`), create/update project, spawn background run | OK |
| `executePipelineInBackground` | `hollywood-pipeline:6242` | Runs stages; **fail-closed approval gate** at `:6314`; resume skip logic | OK |
| `runPreProduction` | `hollywood-pipeline:750` | script gen + (image-to-video) identity extraction | calls `smart-script-generator`, `extract-scene-identity` | OK |
| `runQualityGate` | `hollywood-pipeline:1990` | shot optimization / audit | OK |
| `runAssetCreation` | `hollywood-pipeline:2160` | scene keyframes | calls `generate-scene-images` | OK (see M3) |
| `runProduction` (clip 1 dispatch) | `hollywood-pipeline:2666`, dispatch at `:3850`–`3956` | builds clip prompts, dispatches clip 1 via `generate-single-clip` w/ `triggerNextClip:true`, sets `_exitClipLoopNow`, returns | **BOUNDARY — clips begin generating here**; `continue-production` chains clips 2+ | OK |
| Production `loadProject` | `src/pages/Production.tsx:274` | Load project (3-retry), parse `pending_video_tasks`/`generated_script`, set `scriptShots`, drive `ScriptApproval`/`PipelineCreation` overlays | OK |
| Production `handleApproveScript` | `Production.tsx:1193` | Approve → resume from qualitygate | guards empty shots, `invoke('resume-pipeline', {resumeFrom:'qualitygate', approvedShots})` | OK |
| Production `handleRegenerateScript` | `Production.tsx:1253` | "Regenerate" button | `invoke('hollywood-pipeline', {projectId, action:'regenerate_script'})` | **BROKEN (P1)** — see below |
| Production `handleResume` | `Production.tsx:1076` | Resume after failure | `invoke('resume-pipeline')` | OK |
| Production `handleCancelPipeline` | `Production.tsx:1140` | Cancel + stop background | `invoke('cancel-project')`; reads `data.summary.{predictionsCancelled,clipsDeleted}` (matches fn `:368`) | OK |
| Production `handleSimpleStitch` | `Production.tsx:1034` | Manual stitch | `invoke('seamless-stitcher')`; reads `data.ok && data.url` (matches fn) | OK (back-half) |
| Production `handleRetryClip` | `Production.tsx:1011` | Retry one clip | `invoke('retry-failed-clip')` | OK (back-half) |
| Production auto-stitch effect | `Production.tsx:949` | Auto-stitch when all clips done | `invoke('auto-stitch-trigger')` | OK (back-half) |
| `resume-pipeline` serve | `supabase/functions/resume-pipeline/index.ts:50` | Resolve resume stage, load/rebuild script, forward to `hollywood-pipeline` w/ `skipApproval`, engine lock, credit-skip detection | OK |
| `ScriptApproval` | `src/components/create/ScriptApproval.tsx:47` | Premium approve-script takeover | `onApprove`→`handleApproveScript` (OK); `onRegenerate`→`handleRegenerateScript` (**broken**) | Presentational OK; regenerate path broken |
| `PipelineCreation` | `src/components/create/PipelineCreation.tsx:130` | Premium "building" progress overlay | driven by `livePipeline` derived from real clip counts (`Production.tsx:1412`) | OK |
| `ScriptReviewPanel.toggleSmart` | `src/components/studio/ScriptReviewPanel.tsx:152` | Smart Route per-shot engine | `invoke('route-shots')`; reads `data.success/routing/allowCinema` (matches fn `:123`) | OK |
| `ScriptReviewPanel.generateStoryboard` | `ScriptReviewPanel.tsx:193` | Previz keyframes | `invoke('generate-storyboard')`; reads `data.success/frames` (matches fn `:184`) | OK (see M3) |
| `smart-script-generator` | fn dir | Main script generator | called by `hollywood-pipeline:1276,1420` | WIRED |
| `generate-scene-images` | fn dir | Scene keyframes (assets) | called by `hollywood-pipeline` | WIRED |
| `extract-scene-identity` | fn dir | Deep identity DNA (image-to-video) | called by `hollywood-pipeline` | WIRED |
| `route-shots` | fn dir | Per-shot engine router | called by `ScriptReviewPanel` | WIRED |
| `generate-storyboard` | fn dir | FLUX previz keyframes | called by `ScriptReviewPanel` | WIRED |
| `script-assistant` | fn dir | Fix-clip helper | called by `FailedClipsPanel.tsx:147` | WIRED (back-half) |
| `continue-production` | fn dir | Clip-chain continuation | called by `generate-single-clip` callback | WIRED (back-half) |
| `seedance-script-director` | fn dir | Seedance script | called only by `seedance-pipeline:622` | **WIRED ONLY to dormant pipeline** (see M4) |
| `seedance-pipeline` | fn dir | Legacy seedance orchestrator | **No UI caller**; only `api-v1/index.ts:286` | DORMANT for UI (see M4) |
| `director-chat` | fn dir | Editor co-director | `src/pages/Editor/components/DirectorChat.tsx:345` | WIRED (Editor, out of surface) |
| `generate-script` | fn dir | (older script fn) | **No `invoke`/`functions/v1` caller** (editor types + tests only) | **ORPHANED** |
| `generate-story` | fn dir | (older story fn) | **No caller** | **ORPHANED** |
| `director-card` | fn dir | — | **No reference** | **ORPHANED** |
| `scene-character-analyzer` | fn dir | — | **No reference** | **ORPHANED** |
| `generate-character-for-scene` | fn dir | — | **No reference** | **ORPHANED** |
| `composite-character` | fn dir | character compositing | only `src/lib/templates/breakthrough/*` (template engine, not UI pipeline) | Not in front-half UI path |
| `continuity-audit` | fn dir | — | **No reference** (pipeline uses `continuity-engine`/`cinematic-auditor` instead) | **ORPHANED** |
| `useActiveProjects` | `src/hooks/useActiveProjects.ts:87` | Live active-render list + realtime | OK (monitor) |
| `useProjectChannel` | `src/hooks/useProjectChannel.ts:21` | Multiplexed realtime for one project | OK (monitor) |
| `useCast` | `src/hooks/useCast.ts:23` | Client-side cast roster (localStorage) | OK |
| `usePaginatedProjects` | `src/hooks/usePaginatedProjects.ts` | Library paging | OK (Library only) |
| `usePredictivePipeline` | `src/hooks/usePredictivePipeline.ts:58` | Pre-warm + estimate while typing | **ORPHANED (used only in tests)** |
| `PipelinePreview` | `src/pages/PipelinePreview.tsx:48` | Self-driving demo of the engine UI | Not a real pipeline |
| `Cinema` | `src/pages/Cinema.tsx` | Marketing landing `/` | Out of pipeline |
| `WorkspaceEditor` | `src/pages/workspace/WorkspaceEditor.tsx` | Mounts Editor in `/workspace` | Out of pipeline |

---

## BROKEN

### Regenerate-Script button does nothing (fails 100%) — P1
- **Symptom:** On the script-approval surface, clicking **Regenerate**
  (or "Regenerate" in `ScriptReviewPanel`) shows a toast
  "Failed to regenerate script" and the script never changes. The user is
  stuck with the AI's first draft.
- **Repro:** Create a cinematic (text-to-video, non-seedance) project → wait for
  `awaiting_approval` → on `ScriptApproval` / `ScriptReviewPanel` click
  Regenerate.
- **Root cause:** `Production.tsx:1262` calls
  `supabase.functions.invoke('hollywood-pipeline', { body: { projectId, action: 'regenerate_script' } })`.
  **`hollywood-pipeline` has no `action` field and no `regenerate_script`
  handler** (no `request.action` anywhere in `hollywood-pipeline/index.ts`; the
  `PipelineRequest` interface has no `action`). With no `concept`/`manualPrompts`
  and `isResuming===false`, the entry throws
  `"Either 'concept' or 'manualPrompts' is required"`
  (`hollywood-pipeline:6876`) → returns HTTP 500 → caller's
  `if (error) throw error` → toast (`Production.tsx:1271`). No credits are charged
  (throw precedes the credit hold at `:6948`), so it's purely non-functional, not
  a money bug.
- **Fix:** Either (a) add a `regenerate_script` action handler to
  `hollywood-pipeline` that reloads `project.synopsis` as the concept, re-runs
  preproduction, and re-parks at `awaiting_approval`; or (b) change
  `handleRegenerateScript` to call `mode-router`/the correct regenerate path with
  a real `concept` (e.g. `project.synopsis`) and `requireApproval:true`. Also wire
  the same handler into `ScriptReviewPanel.onRegenerate` and
  `ScriptApproval.onRegenerate`.

---

## OTHER FINDINGS (medium / low)

### M1 — A stuck `awaiting_approval` project blocks ALL new creations
`mode-router:342-370` enforces one active project per user across
`['generating','processing','pending','awaiting_approval']` and returns **409
`active_project_exists`**. Because credits are HELD at the pause (see M2) and the
**Regenerate button is broken (P1)**, a user who dislikes the draft has only one
escape: Cancel. Until they do, every new "Create" is rejected. This compounds the
"pipeline fails" complaint: one stuck draft locks the whole studio.
**Fix:** auto-expire stale `awaiting_approval` holds/projects, and make the 409
surface a one-click "cancel & start new" path.

### M2 — Credits are HELD before script approval; abandonment leaks them
For cinematic flow, `hollywood-pipeline` reserves credits via `reserve_credits`
(`:6971-6996`) **before** running preproduction and parking at
`awaiting_approval` (`:6319`). So credits are already removed from "available"
while the user is still deciding. `ScriptApproval.tsx:140` tells the user
"Approving locks this script and starts building your film" — implying the charge
happens on approval, not before. If the user navigates away and never
approves/cancels, the hold persists (consume happens later in `final-assembly`;
release happens via `_shared/pipeline-failure.ts`). **UNVERIFIED:** whether
`cleanup-stale-drafts` / any watchdog releases holds for abandoned
`awaiting_approval` projects. **Fix:** verify a TTL/cleanup releases these holds;
otherwise hold credits only at/after approval.

### M3 — Storyboard keyframes may be overwritten on approval
`generate-storyboard` writes approved FLUX keyframes into
`movie_projects.scene_images` (`generate-storyboard:177-180`) and its header
promises "approved keyframes become the render seeds with NO pipeline change."
But on approval the pipeline resumes at `qualitygate` and then runs
`runAssetCreation` → `generate-scene-images` (`hollywood-pipeline`), which
re-generates scene images. **UNVERIFIED** whether `runAssetCreation` skips when
`scene_images` already exist; if it doesn't, the user's approved storyboard is
discarded. **Fix:** have `runAssetCreation` short-circuit when storyboard
`scene_images` are present.

### M4 — Engine-dependent approval inconsistency + dormant seedance path
- In the SAME text-to-video mode, choosing the **Seedance** engine SKIPS the
  approval gate and auto-charges: `mode-router:1246` sets
  `effectiveRequireApproval=false` and `:1299` sets `autoApprove:true`; the gate
  keys only on `autoApprove===true` (`hollywood-pipeline:6314`). Non-seedance
  pauses for approval; seedance does not. This is intentional "seedance parity"
  (git log) but is a surprising UX/billing inconsistency — same screen, different
  engine, different consent flow.
- `seedance-pipeline` (and its `seedance-script-director`) have **no UI caller**
  anymore (mode-router routes seedance through `hollywood-pipeline`), but
  `api-v1/index.ts:286` STILL invokes `seedance-pipeline`. So the public API and
  the UI run different orchestrators for seedance — a divergence/drift risk.
- Note: `requireApproval` is a documented DEAD flag (`mode-router:244-249`); the
  gate ignores it. mode-router still computes/forwards it — harmless but
  confusing; the real control is `autoApprove`.

### L1 — Dead/orphaned code in this surface
- **Edge functions with zero callers:** `generate-script`, `generate-story`,
  `director-card`, `scene-character-analyzer`, `generate-character-for-scene`,
  `continuity-audit`. (`generate-script` is referenced only by editor TS types +
  regression tests; not invoked at runtime.)
- **Hook `usePredictivePipeline`** is imported only by tests — unused in the app.
- These are not breaks but add confusion when debugging "which script function
  runs?" (Answer: `smart-script-generator`, not `generate-script`/`generate-story`.)

---

## PIPELINE-FLOW (happy path, step by step)

1. **User clicks Create** — `CreationStudio` calls `Studio.handleStartCreation`
   (`Studio.tsx:301`). Pre-flight credit gate (`cinemaGuard`,
   `getAuthoritativeCreditState`). ✅
2. **Invoke `mode-router`** (`Studio.tsx:453`) with mode/prompt/clipCount/engine
   and `requireApproval = usesScriptApproval`. ✅
3. **`mode-router`**: JWT auth (`:269`), content-safety (`:316`), **single-project
   lock** (`:342` — 409 if one already active → see M1), title gen, **insert
   `movie_projects`** (status `generating` for cinematic; `pending_payment` for
   direct modes) (`:401`). Cinematic does NOT deduct here (defers to hollywood). ✅
4. **Dispatch** → `handleCinematicMode` (`:627`) `fetch`es `hollywood-pipeline`
   with `requireApproval` and (seedance only) `autoApprove:true`. ✅
5. **`hollywood-pipeline`** entry (`:6738`): auth/IDOR/engine-lock, **HOLD credits**
   via `reserve_credits` (`:6971` → see M2), update project, then
   `executePipelineInBackground` via `waitUntil`; returns `{projectId}` immediately.
   `mode-router` returns `{projectId}`; **Studio navigates to
   `/production/:projectId`** (`Studio.tsx:478`). ✅
6. **Background: `runPreProduction`** (`:750`) → `smart-script-generator` writes
   the script; `extract-scene-identity` for image-to-video. ✅
7. **APPROVAL GATE** (`:6314`): `requireManualApproval = autoApprove !== true`. For
   normal cinematic this is true → project set to `awaiting_approval`,
   `generated_script` + `pending_video_tasks.script` persisted, **pipeline returns
   and waits** (`:6349`). (Seedance auto-runs past this — M4.) ✅
8. **`Production.tsx`** loads the project (`:274`, 3-retry), parses
   `pending_video_tasks.script`/`generated_script` into `scriptShots`, sets
   `pipelineStage='awaiting_approval'`, renders **`ScriptApproval`** takeover
   (`:1470`). Optional `ScriptReviewPanel` (`route-shots`, `generate-storyboard`)
   also available. ✅ (Regenerate here is **BROKEN — P1**.)
9. **User approves** → `handleApproveScript` (`:1193`) guards empty shots, invokes
   **`resume-pipeline`** with `resumeFrom='qualitygate'` + `approvedShots`. ✅
10. **`resume-pipeline`** (`:50`): ownership guard, load/normalize script
    (falls back to `generated_script`, then rebuild from `video_clips`),
    credit-already-charged detection (`transaction_type='usage'`), **fetch
    `hollywood-pipeline`** with `skipApproval:true`, `resumeFrom`, engine lock. ✅
11. **`hollywood-pipeline` (resume run)**: `isResuming=true` → credits skipped
    (original hold consumed later by `final-assembly`); skips preproduction +
    approval gate; runs `runQualityGate` → `runAssetCreation`
    (`generate-scene-images` → see M3) → **`runProduction`**. ✅
12. **CLIPS BEGIN GENERATING** — `runProduction` (`:2666`) dispatches **clip 1**
    via `generate-single-clip` with `triggerNextClip:true` (`:3850`–`3933`), sets
    `_exitClipLoopNow`, and returns (`:3990`). `continue-production` chains clips
    2+. **This is the end of the front-half surface.** ✅

### Where the front-half breaks
- The **happy path is structurally sound** end-to-end (no missing invoke targets,
  no response-shape mismatches in the create flow, credit hold→consume chain is
  coherent). The user-reported "pipeline fails" is **not** a single dead link in
  this front half.
- The one **hard break in this surface is the Regenerate-Script button (P1)** —
  it 500s every time because `hollywood-pipeline` never implemented the
  `regenerate_script` action.
- The most likely **experience of "it's broken"** is the **lock-up combo (M1+M2+P1)**:
  a draft the user doesn't like → Regenerate fails → they navigate away → the
  `awaiting_approval` project + its credit hold persist → every new Create is
  rejected with 409, and credits read as missing. That presents to the user as
  "the pipeline failed / ate my credits / won't let me start."
- Real generation failures beyond this point (clips, stitching) live in the
  **back half** (`generate-single-clip`, `continue-production`, stitchers) — out
  of this partial's scope.

---

## SUMMARY
- **Functions/steps enumerated:** ~45 (8 pages/components, 5 hooks, ~30 edge
  functions/handlers across the create path).
- **Broken by severity:** P0: 0 · P1: 1 (Regenerate-Script button) · Medium: 4
  (M1 active-project lock, M2 pre-approval credit hold/leak, M3 storyboard
  overwrite, M4 seedance approval/path inconsistency) · Low: 1 (dead code:
  6 orphaned edge fns + 1 unused hook).
- **Worst issue:** No true P0 in the front half. The P1 Regenerate break,
  combined with M1 (single-project 409 lock) and M2 (credit held before
  approval), produces the user-visible "production pipeline fails / credits gone /
  can't start a new one" lock-up.
- **Where it breaks:** the front-half create flow itself completes to clip 1
  dispatch; the only hard failure on this surface is `handleRegenerateScript` →
  `hollywood-pipeline` (`Production.tsx:1262`, unhandled `action`).
- **Partial path:** `qa-audit/partials/02-pipeline-create.md`
