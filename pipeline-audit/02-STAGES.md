# 02 — Stage-by-Stage Verification

Each stage gets a verdict — **WIRED** / **PARTIAL** / **BROKEN** / **DEAD** — with
`file:function:line` evidence. "WIRED" means traced end-to-end: produced → persisted
→ read back downstream/in UI.

| Stage | Verdict | One-line |
|-------|---------|----------|
| 1. Scripting | ✅ WIRED (live) | generated, persisted, rendered in Production UI |
| 1b. Script format consistency | ⚠️ PARTIAL | `generated_script` holds JSON (live) vs raw text (editor) — cross-surface conflict |
| 2. Storyboard display | ✅ WIRED | reads real shots/clips |
| 2b. Continuity (frame chain) | ⚠️ PARTIAL | live `last_frame_url` chain works; continuity-*scoring* engine unwired |
| 3. File generation / filing | ✅ WIRED | clips downloaded from Replicate → public `video-clips` bucket |
| 4. Retrieval (clips) | ✅ WIRED | public bucket + open SELECT RLS |
| 4b. Retrieval (final film) | ⚠️ PARTIAL | private bucket, **24h signed URL not re-signed on reopen** |
| 5. Updates / edit propagation | 🔴 BROKEN | edits don't invalidate downstream render state |
| 6. Stitching | ✅ WIRED | real server FFmpeg (Replicate cog), xfade + acrossfade; builder unit-verified |
| 7. Python engine | 🔴 DEAD | unwired; can't even `import numpy` here |
| 8. UI surfaces | ✅ WIRED (Production) / 🔴 DEAD (Editor) | Production renders real data; Editor render path inert |

---

## 1. Scripting — ✅ WIRED (live path)

**Generation.** The live generator is **`smart-script-generator`**, not the
`generate-script` fn the brief names. It emits strict JSON shots
(`description`, `durationSeconds`, `cameraScale`, `transitionOut`, `endFrameLock`)
— `smart-script-generator/index.ts:596-616`. Invoked by the orchestrator at
`hollywood-pipeline/index.ts:1260,1404`.
(`generate-script` exists and returns a **raw markdown string only** — used by
`seedance-pipeline` and the Editor; `generate-story` is **orphaned**, zero callers.)

**Persist.** `hollywood-pipeline/index.ts:1535-1553` writes both
`movie_projects.generated_script = JSON.stringify(state.script)` and
`pending_video_tasks.script = state.script`.

**Read + render in "script page" UI.** `Production.tsx` reads it back —
`pending_video_tasks.script.shots → setScriptShots` (`Production.tsx:553-576`) with a
`JSON.parse(generated_script).shots` fallback (`:592-635`) — and binds into the
real `<ScriptApproval scenes=…>` (`:1471-1482`) and `<ScriptReviewPanel shots=…>`
(`:1531-1539`). **Real DB data, not mock.**

## 1b. Script format consistency — ⚠️ PARTIAL (latent bug)

`generated_script` is written as **JSON** by `hollywood-pipeline:1541` but as **raw
text** by the Editor (`Editor/views/Script.tsx:469-472`). `Production.tsx:594` does
`JSON.parse(generated_script)`. A project touched in the Editor and reopened in
Production hits the `catch` at `:632` → silent "no shots." Cross-surface landmine.

## 2. Storyboard display — ✅ WIRED

The storyboard view is `Editor/views/Storyboard.tsx` — reads real scene/shot data
from `project.scenes` (`:56`), hydrated from DB by `lib/editor/hydrate-document.ts`
`buildShots` (`:416-492`), carrying `video_url`, `last_frame_url`, `start_image_url`.
Cards show thumbnails/mood/clip-count; drag-reorder calls `moveScene` (`:64-72`).
On the live side, the storyboard equivalent is the shot list in `Production.tsx`
(ordered `.order('shot_index')`, `:175`). Both bind real data.

## 2b. Storyboard continuity — ⚠️ PARTIAL

**Continuous in the live pipeline** via the end→start frame handoff:
- `poll-replicate-prediction/index.ts:171-258` extracts each clip's last frame
  (`extract-video-frame`) and persists `video_clips.last_frame_url` (with a
  reference-image fallback for clip 0).
- `continue-production/index.ts:725-790` consumes it as the next clip's start image
  with a **3-tier lookup** (in-memory → DB `last_frame_url` → emergency extraction →
  backward scan). This is the real shot-N-end → shot-N+1-start link.
- Ordering by `shot_index` is coherent (`continue-production` walks indices;
  `Production.tsx:175`).

**Gaps:**
- **Continuity *scoring*/audit engine is not load-bearing.** `continuity-audit` fn
  has **zero callers**; `src/lib/video/continuity/*` is a tested "brain" that only
  drives progress visualization (`Production.tsx:1422` `derivePipelineFromCounts`),
  not generation. The authors' own `reports/continuity-engine/review.md §3` flags
  this as P0: "no true seam metric (SSIM/pHash)," gate "isn't called." The live
  retry loop gates on a flat `score >= 75` ignoring boundary type.
- **Hydration ordering risk:** `hydrate-document.ts:222-227` orders clips by
  `created_at`, not `shot_index` — out-of-order completion can mis-sequence the
  Editor storyboard and chain the wrong neighbor (`chains.ts:58-75`).

## 3. File generation / filing — ✅ WIRED

Replicate output is an **expiring `replicate.delivery` URL**
(`generate-single-clip:778-801`), but it is **downloaded and re-uploaded** to
Supabase storage in **every** completion path:
- `_shared/video-persistence.ts:persistVideoToStorage:22-90` (live async paths;
  `isTemporaryReplicateUrl:13`) → uploads to public `video-clips`, returns
  `getPublicUrl`. Used by `poll-replicate-prediction:149` + `replicate-webhook:187`.
- `generate-single-clip:storeVideoFromUrl:829-910` (sync path) → same bucket,
  path `${projectId}/clip_${projectId}_${clipIndex}_${Date.now()}.mp4`.

So **clip URLs are durable**, not ephemeral. Schema: `video_clips` tracks
`shot_index`, `video_url`, `last_frame_url`, `thumbnail_url`, `status`,
`duration_seconds` (`20260106121012…sql`, `20260111223612…sql`). Note there is **no
`storage_path` column** — the path is reconstructed from the URL (e.g. by
`delete-clip`). Final film tracked on `movie_projects.video_url` + `stitched_at`.

## 4. Retrieval — ✅ WIRED (clips) / ⚠️ PARTIAL (final film)

**Clips:** live in the **public** `video-clips` bucket; stored `video_url` is a
`getPublicUrl` that plays with no signing. SELECT RLS is open
(`20260107120003…sql:171`). Hydration selects `video_url, last_frame_url,
thumbnail_url` and filters to playable rows (`useProject.ts:145-230`). The stitcher
re-loads clips by non-null `video_url` ordered by `created_at`
(`final-assembly:122-126`; `seamless-stitcher:423-434`) and `fetch`es each (public →
succeeds).

**Final film:** stored in the **private** `published-renders` bucket behind a
`createSignedUrl(key, 60*60*24)` = **24h** (`seamless-stitcher:110,1294-1305`) and
written verbatim to `movie_projects.video_url` (`:1006`). `Production.tsx:455-458`
plays it **directly** on reopen; the auto-stitch re-sign effect only fires while a
project is *not yet* completed. **→ A completed project reopened >24h later loads an
expired URL and the final film 404s.** No on-view re-sign. (Clips are unaffected.)

## 5. Updates / edit propagation — 🔴 BROKEN

- Editor block edit `commitBlockEdit → updateBeat` patches text only
  (`Script.tsx:405-415`); does **not** mark shots `needs-regen`, re-render, or
  re-extract frames. Whole-script `saveWholeScript`/`approveDraft`
  (`Script.tsx:387-391,494-500`) write `script_content`/clear `generated_script`
  but never touch `video_clips` or `last_frame_url` → existing clips/frames go stale.
- Re-render is impossible anyway (dead runner, §8).
- Storyboard `moveScene` reorders but does **not** re-chain `last_frame_url`
  handoffs → persisted chain still reflects old order.
- Live side is coarse only: `handleRegenerateScript` regenerates the **entire**
  script (`Production.tsx:1254-1277`); approval is whole-script
  (`Production.tsx:1211-1232`). **No "edit shot N → re-render only N → re-extract →
  re-chain N+1" path anywhere.**

## 6. Stitching — ✅ WIRED (server FFmpeg via Replicate)

- Concatenation is a single FFmpeg `filter_complex` compiled by
  `_shared/seamless-command.ts:buildSeamlessCommand:180-523`, dispatched to a
  **Replicate-hosted ffmpeg "cog"** (`seamless-stitcher/index.ts:1185-1260`,
  `FFMPEG_MODEL_VERSION = efd0b79b…`). Not Deno-subprocess, not browser merge, not a
  JSON manifest.
- **Crossfades:** real `xfade` per boundary, never hard cuts
  (`seamless-command.ts:321-342`); ~30 kinds whitelisted; default `fade`/0.4s.
- **Audio sync:** per-clip audio preserved + `acrossfade=d=…:c1=tri:c2=tri` matched
  to each video boundary (`:337-339`); aux/music tracks `adelay`+`amix` with optional
  `sidechaincompress` ducking (`:420-468`); master `loudnorm` last (`:470-479`).
- **Output validated** as real MP4 (`ftyp` magic + min size) then uploaded
  (`persistOutput:1264-1307`).
- **Trigger fires live:** `continue-production:141-177` calls `final-assembly` on the
  last clip; `final-assembly:159-237` atomically claims (TOCTOU guard) then invokes
  `seamless-stitcher`. Plus sync path `hollywood-pipeline:5636-5652`, `pipeline-
  watchdog`, and `auto-stitch-trigger` (cron/recovery).
- **ffmpeg blocker status:** Supabase-hosted Deno genuinely can't spawn ffmpeg; the
  code sidesteps it by running ffmpeg **as a Replicate model**. With
  `REPLICATE_API_KEY` + a valid model version, stitching produces a valid MP4 today.
  Residual risk: the external model version `efd0b79b…` can't be proven valid
  statically (only by invoking it).

**Execution evidence:** `buildSeamlessCommand` is exercised by 113 deterministic
render tests (F01–F12 + integrity/helpers) that I ran — **383 tests pass** — asserting
correct `xfade=transition=…:duration=…:offset=…` and matching `acrossfade=d=…`
(e.g. `src/test/render/F01.test.ts`, `F02-F06.test.ts`). The graph builder is correct;
only the external render service is unverifiable offline.

## 7. Python engine — 🔴 DEAD / unwired

- **Zero invocations** anywhere: grep for `breakout_pipeline | python -m |
  child_process | spawn( | Deno.Command | execFile` across `src/` + `supabase/` → no
  hits. Its output target is a **local folder** (`config.py:27` `runs/<RUN_ID>/`),
  not app storage; nothing ingests its `manifest.json`.
- The app even maps the engine's model names **away** to cloud engines
  (`registry.ts:92-93`: `hunyuan-video→seedance-2`, `cogvideox-5b→kling-v3`).
- Its core `generate()` call is **not** wrapped in try/except
  (`breakout_pipeline.py:104-108`) — a missing model kills the whole run.
- **Execution proof:** `python3 -m breakout_pipeline.cli --prompt … --model
  cogvideox-5b` (run from `python/`) fails immediately with
  `ModuleNotFoundError: No module named 'numpy'` — the heavyweight stack
  (`torch>=2.2`, `diffusers>=0.32`, requires ~14 GB VRAM CUDA per `config.py:9-13`)
  isn't present and isn't installable into the runtime path. It cannot produce any
  output here.
- **Reconciliation:** the "Python engine" the brief centers on is **not part of the
  live pipeline**. Its role in production is played entirely by the cloud chain
  `mode-router → hollywood-pipeline → generate-single-clip (Replicate) →
  seamless-stitcher (Replicate ffmpeg)`. The `recipe_slug`/`preferred_model` DB
  columns (`20260616000000…sql`) were provisioned for it but only ever consumed by
  the cloud blueprint mapper.

## 8. UI surfaces — ✅ Production / 🔴 Editor

- **Script page (live):** `<ScriptApproval>` / `<ScriptReviewPanel>` bound to real
  `scriptShots` — `Production.tsx:1471-1539`. ✅
- **Final video (live):** `isComplete = status==='completed' && finalVideoUrl`
  (`Production.tsx:1281`) → `<ProductionFinalVideo videoUrl=…>` (`:1687-1690`) →
  `BrandedVideoPlayer` plays real MP4 or HLS (`BrandedVideoPlayer.tsx:263-322`).
  `StudioContext.tsx:192-208` binds `dbProject.video_url` + per-clip urls. ✅
- **Library fallback:** `StitchedVideo` (`Library.tsx:353-419`) is a client-side
  per-clip sequential player (ordered by `shot_index`, advances on `onEnded`) — the
  user still perceives a continuous video even if the server stitch is missing
  (hard cuts, no crossfade). ✅
- **Editor surfaces:** script page + storyboard render real data, but every render
  CTA is inert because `installJobRunner` has **zero call sites** —
  `approveAndRenderShot` shows "Rendering from the editor is coming soon"
  (`Script.tsx:423-427`); `drainQueue` fails with "No render engine is connected"
  (`orchestrator.ts:260-264`). 🔴
- **Stale misnomer:** `auto-stitch-trigger:4-11` still advertises "MANIFEST-ONLY …
  SmartStitcherPlayer," but it invokes `seamless-stitcher` (real MP4) and
  `SmartStitcherPlayer` doesn't exist in `src/`. The `.json` manifest branches in
  `Production.tsx:452` / `ProductionFinalVideo.tsx:17-59` are legacy/dead.
