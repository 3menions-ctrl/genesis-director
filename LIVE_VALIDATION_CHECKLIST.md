# Live-Validation Checklist — run when Replicate credits land

Everything below is built and committed on `feat/creative-vfx-gen` but needs a
live account (or an owner decision) to activate/verify. Ordered by value.

## 0. Prerequisites
- [ ] Top up Replicate credit (blocks ALL renders product-wide).
- [ ] Deploy edge fns touched on this branch (`supabase functions deploy <fn> --use-api`):
      mode-router, hollywood-pipeline, generate-single-clip, generate-video,
      generate-scene-images, seamless-stitcher, auto-stitch-trigger,
      final-assembly, continue-production, replicate-webhook,
      check-video-status, resume-pipeline, retry-failed-clip,
      smart-script-generator, continuity-audit.
- [ ] **Undeploy the retired `seedance-pipeline`** (deleted from repo; still live in prod).
- [ ] Fix `seedance-script-director` auth (M-8) before it gets more traffic.

## 1. Engine-required contract smoke test
- [ ] POST mode-router without `videoEngine` → expect 400 `ENGINE_REQUIRED`.
- [ ] Breakout template without engine → runs on seedance (forced), no 400.
- [ ] Studio UI: no engine pre-selected; Generate disabled until pick.
- [ ] One render per engine (wan/kling/seedance/veo/runway/sora) — confirm each
      routes to its slug (check `[SingleClip] ENGINE FINAL` logs).

## 2. Continuity v2 verification
- [ ] Pipeline render (3+ clips) → stitched output should HARD CUT at chained
      boundaries (no 0.4s fade blur), with the vendor 6-frame/1-frame join trim.
      Compare a before/after pair on the same seed if possible.
- [ ] Editor re-export unchanged (no joinTrim; authored transitions honored).
- [ ] Reference-locked seedance project: per-shot keyframes now generate via
      Flux Kontext (identity-locked) — verify the same face across keyframes in
      `scene-images` bucket and that `last_frame_image` chaining activates.

## 3. Seedance capability probes (research-verified, flag-gated)
- [ ] Probe the Replicate `bytedance/seedance-2.0` schema: does it accept
      `reference_images` (up to 9) and audio generation toggles?
      (`curl -s https://api.replicate.com/v1/models/bytedance/seedance-2.0 -H "Authorization: Bearer $REPLICATE_API_KEY" | jq '.latest_version.openapi_schema.components.schemas.Input'`)
- [ ] If reference conditioning exists → flip `SEEDANCE_REFERENCE_CONDITIONING`
      in `_shared/engine-profiles.ts`, render a 6-clip identity test, compare drift.
- [ ] If native audio exists → plan the `SEEDANCE_NATIVE_AUDIO` flip (needs the
      post-mux path to skip TTS mux when native audio is on — small follow-up).
- [ ] Probe for a video-extension operation (vendor docs it; Replicate packaging
      may not expose it). If present: single-scene long takes via extension.

## 4. Breakout VFX cog
- [ ] Deploy the CPU cog: `cd python/breakout_pipeline && cog push r8.im/<owner>/breakout-vfx`
- [ ] Set `REPLICATE_BREAKOUT_MODEL=owner/name:version` + `BREAKOUT_VFX_ENABLED=true`
      on the edge runtime.
- [ ] Run a breakout template end-to-end → chrome + shatter composited pre-stitch.
      (Fail-open at every layer: worst case = uncomposited clip.)

## 5. Model refresh (owner decisions + live checks)
- [ ] Wan 2.7: check Replicate availability (research priced it on fal.ai
      ~$0.10/s, i2v Elo 1,092 — ABOVE Kling 3.0 Pro at ⅓ cost, first+last-frame
      control). If Replicate-hosted → update `engine-profiles.ts` slug + Wan
      durations + `CLIP_COST_USD`. If fal-only → decide whether to add a fal
      dispatch path.
- [ ] HappyHorse-1.1 pilot (arena #2, $9.90/min, native audio + lip-sync,
      cheaper than Kling): check licensing/rate limits, availability outside
      fal. If piloting: add as engine #7 — with engine-profiles, that's a
      registry row + input builder, no new branches.
- [ ] OWNER DECISION: Sora 2 is the most expensive engine ($7.23/12s) with zero
      arena evidence. Hide behind entitlement, keep, or drop?
- [ ] Re-check artificialanalysis.ai for Seedance 2.5 (native 30s) — would
      obsolete much of clip-chaining for sub-30s scenes.

## 6. Regression watch
- [ ] The 5 historical seedance-parity regressions (breakout engine force,
      credits double-reserve, approval gate bypass, camera_fixed, post-mux).
- [ ] Idempotency: same project re-export → cache hit; joinTrim render and
      editor re-export must produce DIFFERENT hashes.
- [ ] C-1 credit-ledger severance is still the launch blocker for charging
      real users — none of the above fixes it.
