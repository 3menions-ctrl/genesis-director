# Genesis Director — Product Map
**As of 2026-07-02.** The single orientation doc: what this app generates, how, and what everything costs. Companions: `PIPELINE_BLUEPRINT.md` (architecture), `video-quality-research.md` (model research), `LIVE_VALIDATION_CHECKLIST.md` (ops runbook).

## Product types (what users can make)
| Type | Mode | Path | Notes |
|---|---|---|---|
| Cinematic film (text) | `text-to-video` | mode-router → hollywood → clip-loop → stitch | Multi-clip, scripted, approval-gated |
| Cinematic film (image) | `image-to-video` | same, reference-anchored | Identity-locked keyframes via Flux Kontext |
| B-roll | `b-roll` | same | Scripted, no dialogue emphasis |
| Avatar (cinematic) | `avatar` + seedance | hollywood parallel | Identity bible, native Seedance audio |
| Avatar (direct/verbatim) | `avatar` (non-seedance) | generate-avatar-direct leaf | User's exact TTS words, Kling lip-sync |
| Stylize | `video-to-video` | stylize-video leaf | Single-pass effect, no engine pick needed |
| Motion transfer | `motion-transfer` | motion-transfer leaf | Pose → target image |
| Breakout/Crossover | template-forced | seedance parallel + VFX cog | 10 hardcoded 3-clip narratives; chrome+shatter effects phase |
| Editor compositions | editor → seamless-stitcher | Timeline re-exports | 20 ffmpeg effect recipes, transitions, TTS, music, SFX |
| Ad Studio | business surface | reuses pipeline | /business/ad-studio |

## Engines (latest-only, pinned in `_shared/engine-profiles.ts`)
Wan 2.7 (t2v+i2v, 2-15s, native audio, budget) · Kling V3 (lip-sync avatars) · Seedance 2.0 (#1 arena, native A/V, 9-ref identity, keyframe-pair) · Veo 3.1 Fast (context audio + last_frame pairs) · Runway Gen-4.5 · Sora 2. **No default model** — explicit pick or template force. First 5s Wan render free (once, server-enforced); everything else paid.

## The pipeline (per cinematic render)
1. **Script** — GPT-5 (Replicate-hosted, GPT-4o fallback) writes shots with continuity anchors + Tone DNA (comedy gets comedy). 2. **Identity** — reference analysis (vision LLM) or synthesized character sheet; identity bible + face lock. 3. **Keyframes** — Flux Kontext places the SAME character per shot. 4. **Approval gate** (fail-closed; UI polls). 5. **Clips** — engine-dialect prompts (`tuneForEngine`), keyframe-pair or lastframe-carry chaining, DB engine-lock, heuristic QC validators + retry ladder. 6. **Effects phase** — breakout VFX cog (chrome+shatter, fail-open). 7. **Stitch** — join-trim hard cuts on chained boundaries, xfade for authored transitions, voice/music mux, loudnorm. 8. **Quality cores** — Topaz 4K / RIFE 60fps, charge-on-delivery, per-10s pricing.

## Audio layers (all Replicate-native or provider-chained)
Voice: minimax speech-2.6-turbo (pipeline + editor TTS) · Music: **Google Lyria 2** (MusicGen fallback) · SFX: Stable Audio Open · Seedance/Wan/Kling/Veo/Sora: native in-clip audio.

## Effects & templates
20 Crossover ffmpeg recipes (light/particle/pigment/geometric/optical) baked at stitch · breakout VFX cog (`3menions-ctrl/breakout-vfx`, CPU, ≤12s clips) · 10 breakout narratives + 50 timeline templates (hardcoded TS — data-driven registry is future work).

## Pricing (cost-based, CI-enforced ≥30% margin — `pricing-cost-based-30pct` memory)
`credits = ceil((COGS + $0.205 addon) / ($0.078 × 0.70))`. Per-clip: Wan 15/26/37 · Kling 35/66/97 · Seedance 32/59/70 · Veo 17/24/31 · Runway 41/78 · Sora 26/48/70. Surcharges per started 10s of film: 4K=15cr, 60fps=2cr. Repricing = edit `CLIP_COST_USD` only; the margin test guards the rest. Verify vs first Replicate invoice.

## Flags & staged boundary-breakers
`SEEDANCE_NATIVE_AUDIO=true` · `SEEDANCE_REFERENCE_CONDITIONING=true` · `BREAKOUT_VFX_ENABLED=true` (edge secret) · `WAN_CLIP_CONTINUATION=false` — Wan 2.7 `first_clip` NATIVE video continuation (continue the motion, not the still); needs one paired test render to enable · Veo extend + Seedance extension = future long-take levers.

## Known sharp edges
Community Replicate models cold-boot (first SFX call may 504 — retry) · VFX cog impractical >~12s clips (fail-open passthrough) · editor layer-stack + keyframe-review UIs not built · C-1 credit ledger + migration drift remain the launch blockers (outside pipeline scope).
