---
name: Seedance → seedance-pipeline Lock
description: Hard contract — selecting Seedance 2.0 anywhere in the app always routes to seedance-pipeline (dedicated orchestrator). Seedance-native dispatch (image + last_frame_image, 12s max, no native audio so post-mux), full feature stack. Never generate-video / generate-single-clip / hollywood-pipeline.
type: constraint
---

# Seedance 2.0 → seedance-pipeline (LOCKED)

**Rule:** Whenever a user selects Seedance 2.0 — anywhere in the app — the request MUST be dispatched to `supabase/functions/seedance-pipeline/index.ts`. Seedance never routes through `hollywood-pipeline` (Kling-only) or `generate-video` / `generate-single-clip` (thin shims).

## What Seedance users get
1. LLM script generation (`generate-script`, engine-tagged "seedance")
2. FLUX 1.1 Pro Ultra scene images (`generate-scene-images`)
3. **Seedance-native dispatch:**
   - `image` (single reference, NOT Kling's `start_image`/`end_image` pair)
   - `last_frame_image` (Seedance's unique inter-scene continuity via end-frame interpolation — uses NEXT scene image as next clip's start anchor)
   - Up to **12s/clip** (vs Kling's 10s default, 15s max)
   - 1080p native, 24fps, configurable `camera_fixed`
4. **Post-hoc audio mux** (Seedance has NO native audio — fundamental capability gap vs Kling):
   - Voice: XTTS-v2 via `generate-voice`
   - Music: MusicGen via `generate-music`
   - SFX: AudioLDM-2
   - Muxed onto silent Seedance output in the stitch stage
5. Auto-stitching (`simple-stitch`)
6. Async dispatch — returns predictionIds immediately, watchdog completes production/audio/stitch (avoids 60s edge timeout)
7. Credit deduction via `deduct_credits` RPC with `seedance:{projectId}` idempotency key
8. DB engine lock (`movie_projects.video_engine = 'seedance'` is source of truth)

## Enforcement points
- **Frontend:** `src/lib/video/engines.ts` — `seedance-2.pipelineFunction = 'seedance-pipeline'`
- **Backend hard guard:** `seedance-pipeline/index.ts` rejects any non-`seedance` engine with `ENGINE_NOT_SUPPORTED` (HTTP 400) BEFORE credit hold or Replicate call.
- **DB engine lock:** persisted `movie_projects.video_engine` overrides body — prevents decay on resume/watchdog re-entry.
- **Pricing parity:** `seedanceCreditsForClip()` mirrors `src/lib/video/engines.ts` `baseCreditsFor` (5:35, 10:65, 12:95).

## Forbidden
- Routing Seedance through `hollywood-pipeline` (Kling-only API shape — would reject).
- Routing Seedance through `generate-video` / `generate-single-clip` (strips continuity, audio, stitching).
- Adding non-Seedance engines to `seedance-pipeline` (the guard must stay).
- Using Kling's `start_image`/`end_image` schema for Seedance dispatch — Seedance uses `image` + `last_frame_image`.
- Skipping post-hoc audio mux silently — if voice/music gen fails, surface the error.

## Why dedicated, not shared
Seedance's API differs fundamentally from Kling: single image input, end-frame interpolation parameter, no native audio, 12s max. A shared orchestrator forces lowest-common-denominator features. Dedicated pipeline = Seedance's full strengths exposed.
