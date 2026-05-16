---
name: Kling → Hollywood Pipeline Lock
description: Hard contract — selecting Kling V3 anywhere in the app always routes to hollywood-pipeline with full feature set (script, FLUX scene images, continuity, identity bible, dialogue chaining, native audio, stitching). No alternate paths.
type: constraint
---

# Kling V3 → hollywood-pipeline (LOCKED)

**Rule:** Whenever a user selects Kling V3 — anywhere in the app — the request MUST be dispatched to `supabase/functions/hollywood-pipeline/index.ts`. Kling never routes through `generate-video`, `generate-single-clip`, or any other dispatcher.

## What Kling users get (the full Hollywood package)
1. LLM script generation (`generate-script` / `smart-script-generator`)
2. Scene image generation via FLUX 1.1 Pro Ultra
3. Multi-scene continuity engine (continuityManifest, motion vectors)
4. Identity bible + face lock (character drift prevention)
5. Dialogue chaining across clips (end-to-end preservation)
6. Native audio: voice (XTTS-v2), music (MusicGen), SFX (AudioLDM-2)
7. Auto-stitching (`simple-stitch` / `auto-stitch-trigger`)
8. 7-tier fallback for continuity failures
9. Watchdog recovery (`pipeline-watchdog` + `resume-pipeline`)

## Enforcement points
- **Frontend:** `src/lib/video/engines.ts` — `kling-v3.pipelineFunction = 'hollywood-pipeline'`
- **Backend hard guard:** `hollywood-pipeline/index.ts` rejects any non-`kling` engine with `ENGINE_NOT_SUPPORTED` (HTTP 400) BEFORE credit hold or Replicate call.
- **Engine lock:** DB `movie_projects.video_engine` is source of truth; body overrides are ignored on existing projects to prevent decay.

## Forbidden
- Routing Kling through `generate-video` or `generate-single-clip` (strips continuity/audio/stitching).
- Adding non-Kling engines to `hollywood-pipeline` (the Kling-only guard must stay).
- Silently downgrading Kling features (e.g. skipping FLUX images, skipping audio) — if a feature is unavailable, surface the error, don't proceed.

## Why
hollywood-pipeline is hard-wired around Kling's `start_image`/`end_image` API + native audio. Every continuity, identity, and audio feature depends on Kling-specific request/response shapes. Any deviation = silent capability loss + wasted credits.
