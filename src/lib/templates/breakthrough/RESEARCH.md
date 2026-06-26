# Making Breakthrough Effects real — pipeline research

How a `TemplateDefinition` becomes an actual rendered video, grounded in the
code that already runs in this repo. Verified against `supabase/functions/*`
on the `breakthrough-fx` branch.

## Headline constraint
**There is no local/edge/wasm FFmpeg.** Every render is a Replicate prediction:
`seamless-stitcher/index.ts` (`runFfmpeg`, ~L1185) POSTs a full
`-filter_complex` string + named inputs to Replicate's FFmpeg model and polls.
So all compositing power is bounded by **one FFmpeg filter graph** — which is
plenty for a 4-layer masked breakthrough, but rules out arbitrary per-frame code.

## The 4 layers → real generation steps
`renderPlan.compileRenderPlan()` emits exactly these, each naming the real fn:

| Layer | Step | Edge function | Model / tech | Status |
|------|------|---------------|--------------|--------|
| 0 chrome still | `gen-image` | `generate-scene-images` | FLUX 1.1 Pro Ultra (txt2img) | ✅ exists |
| (chrome opening) | `inpaint-image` | `inpaint-photo` | FLUX Fill Pro (masked) | ✅ exists |
| 1 inner video | `gen-video` | `generate-video` | any engine, image-to-video from FLUX start frame | ✅ exists |
| 2 subject video | `gen-video` | `generate-video` | image-to-video; identity via IdentityBible | ✅ exists |
| 2 subject matte | `matte-video` | `composite-character` / ffmpeg | BiRefNet (still) / chromakey / video-matte | ⚠️ partial |
| 3 aftermath | `gen-video` | `generate-video` | image-to-video | ✅ exists |
| composite | `composite` | `seamless-stitcher` | Replicate FFmpeg `filter_complex` | ✅ exists (gap below) |

### What already exists (reuse, don't rebuild)
- **Stills**: FLUX 1.1 Pro Ultra (`generate-scene-images`) + FLUX Fill Pro
  masked inpaint (`inpaint-photo`). Chrome generation is fully solved, including
  punching a hole/opening into the chrome via the Fill mask.
- **Video**: `_shared/video-engines.ts` — every engine (`wan-25`, `kling-v3`,
  `seedance-2`, `veo-3`, `runway-gen4`, `sora-2`) sets `supportsImageToVideo`.
  `CanonicalVideoRequest` carries `startImageUrl`, `referenceImages`,
  `enableAudio`. So inner / subject / aftermath clips all generate from a FLUX
  start frame. `runway-gen4` = best character continuity → default for the
  moving subject.
- **Identity**: `IdentityBible` (characterDescription + nonFacialAnchors) from
  `extract-scene-identity` / `analyze-reference-image`, validated by
  `approve-clip-one` + `comprehensive-clip-validator`. The schema's
  `identity` block maps straight onto this.
- **Compositor primitives**: `overlay` with alpha (`yuva420p`), `colorchannelmixer`
  opacity keyframing, `geq` alpha shaping, `blend` modes, animated
  `scale/crop/rotate` driven by clip-local `t` (`keyframe-bake.ts` —
  `buildKeyframeExpression`), `xfade` region-opens, full audio sync
  (`acrossfade`, `sidechaincompress` ducking, `loudnorm`).
- **Still cutout**: `composite-character` calls Replicate `lucataco/remove-bg`
  (BiRefNet) → transparent PNG.

### What was MISSING — and what this change adds
1. **Positioned + masked overlay (the core gap).** The stock overlay in
   `seamless-command.ts` is full-frame + time-gated only (no `x:y`, no mask).
   A breakthrough needs the subject composited above the chrome through an
   animating boundary that opens at the break beat.
   → **Added**: `supabase/functions/_shared/breakthrough-overlay.ts`
   (`buildBreakthroughOverlay`) emits `overlay=x:y` driven by the destination
   motion keyframes + a `geq` alpha gate `alpha*shapeTest*revealRamp*gte(t,break)`
   so the window opens across `[openStart, openEnd]`. Pure + unit-tested
   (`src/test/render/breakthrough-overlay.test.ts`). Reuses `keyframe-bake`.
   **Remaining wiring**: `seamless-stitcher` must accept the `composite` step's
   `layers`/`mask` payload and call this emitter (one additive branch in
   `buildSeamlessCommand`).
2. **Moving-subject matting (alpha video).** No video matting exists today
   (BiRefNet is still-only; no chroma-key stage). Chosen path, in priority:
   - **chromakey** (default, zero new infra): generate the subject on a solid
     `#00B140` background (the `render.chromaColor` field already instructs the
     prompt), then add an FFmpeg `chromakey`+despill stage before overlay.
   - **video-matte**: a dedicated Replicate RVM-class model (new `video-matte`
     fn) for subjects that can't be shot on green (water, swarms, fold-outs —
     those configs set `matting: "video-matte"`).
   - **birefnet-frames**: per-frame BiRefNet via `composite-character` for short
     clips where quality matters most (cctv config uses this).
3. **Tier-2 headless-Chromium effects renderer** referenced in `effects-bake.ts`
   is **vaporware** (comment-only TODO). We deliberately stay in-FFmpeg via the
   overlay emitter rather than build that worker — the whole render already
   lives on Replicate FFmpeg.

## Beat-sync & audio
The `composite` step receives `breakTransition.atSec` (snapped to the audio cue
by `resolveBeatTimeline`) and per-beat `sfx` cues. The stitcher already supports
`xfade` at an offset + `adelay`/`acrossfade` aux audio — so the break crossfade
and the break-beat SFX land on the musical hit with existing primitives.

## Net assessment — NOW COMPLETE end-to-end
Stills, clips, identity, still-cutout, and the FFmpeg toolkit were already in
place. The remaining build items are now done in this branch:

1. ✅ **Positioned + masked overlay** — `_shared/breakthrough-overlay.ts`
   (emit) + `_shared/breakthrough-command.ts` (full command: input wiring,
   chromakey matting, audio mux, encode). Tested.
2. ✅ **Stitcher wiring** — `seamless-stitcher` now accepts a `breakthrough`
   payload and renders it via the existing `runFfmpeg` + `persistOutput` (same
   Replicate FFmpeg path + storage as every other render).
3. ✅ **Chromakey matting** — generated subject on `chromaColor` green →
   `chromakey`+`despill` in the final command. `video-matte` / `birefnet-frames`
   strategies route to their own steps for subjects that can't be shot on green.
4. ✅ **Orchestrator** — `execute.ts` `executeBreakthroughRender(def)` walks the
   render-plan DAG, invoking `generate-scene-images` → `generate-video` →
   (matte) → `seamless-stitcher` and returns the final `video_url`. Tested with
   a mocked `invoke`.

### What it takes to RUN (not buildable in this repo checkout)
Execution needs a deployed Supabase project with the edge-function secret
`REPLICATE_API_KEY` set (FFmpeg + FLUX + video engines all run as Replicate
predictions). There is no `.env.local`/key in this checkout, so the path is
wired + unit-tested but not executed here. Async video generation may also need
the existing status-table/polling pattern (`pending_video_tasks` + watchdog) if
an engine returns a job id rather than a finished URL — `executeBreakthroughRender`
reads a URL field from each response and is the single place to add polling.

### Cover images
`scripts/gen-breakthrough-covers.mjs` emits bespoke, color-matched SVG covers
(one per template, depicting its container + breakthrough motif) →
`src/assets/templates/breakthrough/*.svg`, wired as each config's
`thumbnailUrl`. In production these can be swapped for the FLUX-generated chrome
still (the render-plan's `gen-image` step already produces exactly that frame).
