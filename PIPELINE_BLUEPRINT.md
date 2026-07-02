# Genesis Unified Pipeline — Build Blueprint

**Date:** 2026-07-01 · **Branch context:** `feat/creative-vfx-gen`
**Goal:** One pipeline, per-engine optimization branches, no default model, continuity chain scripting, and a best-in-class creative/VFX layer (AI video + nano-banana images + LLM scripting + Python effects + editor).

---

## 0. Where we actually are (verified in code)

| Piece | Status | Where |
|---|---|---|
| Unified orchestrator | ✅ DONE — all 6 engines route through `hollywood-pipeline`; `seedance-pipeline` is dormant legacy | `supabase/functions/hollywood-pipeline/`, `dispatch/strategy.ts` |
| Engine capability registry | ✅ exists (durations, audio, lip-sync, buildInput per engine) | `supabase/functions/_shared/video-engines.ts` |
| Continuity system | ✅ exists — identity bible (face lock, multi-view, non-facial anchors), continuity contract (CONTINUOUS/MATCH_CUT/HARD_CUT…), Seedance first+last-frame chaining | `_shared/prompt-builder.ts`, `_shared/continuity-contract.ts` |
| Python VFX | 🟡 built, NOT wired — `apply-breakout-vfx` edge fn + CPU Replicate cog (`predict.py`), fail-open | commit `1405856c` backup |
| Nano-banana | 🟡 used for images only (ImageStudioHub, character gen) — not in the video pipeline | `generate-character-for-scene`, `edit-photo` |
| Editor effects | ✅ 20 crossover recipes → ffmpeg filter chains via seamless-stitcher | `src/lib/editor/effects-registry.ts`, `_shared/seamless-command.ts` |
| Default model | 🔴 to remove — `kling-v3` hardcoded frontend + backend fallback | `src/lib/video/engines.ts:234`, `_shared/engines.ts:278` |
| Template engine forcing | ✅ pattern exists — breakout forces seedance | `dispatch/strategy.ts` (regression #11) + unit test |

Pre-existing blockers that gate testing any of this: Replicate account credit depleted (blocks ALL renders), C-1 credit-ledger severance, ffmpeg-cog stitch reliability.

---

## 1. Engine selection policy — NO default model

**Contract change: `engine` becomes a required field.**

- **Backend:** `hollywood-pipeline` rejects requests without an explicit engine → `400 ENGINE_REQUIRED`. Delete the `default: return 'kling-v3'` fallback in `_shared/engines.ts:278` (`backendToEngineId`) and the `seedance-1-pro` fallback in `model-catalog.ts:271`. The ONLY path that sets an engine server-side is the template-override registry (below).
- **Frontend:** `DEFAULT_ENGINE_ID` removed; `CreationStudio` engine state starts `null`; the render CTA stays disabled until the user picks. Model picker becomes a first-class step: capability cards per engine (cost/clip, max duration, native audio, lip-sync, aspect ratios, "best for" tags) generated from the shared registry — never hand-maintained copy.
- **Template overrides:** a small declarative registry `TEMPLATE_ENGINE_OVERRIDES: { [templateId]: EngineKey }` — crossover/breakout → `seedance` (2.0). Server-side enforcement (as today) so clients can't bypass. `recommendedEngineForTemplate()` becomes a *suggestion badge* in the picker, never an auto-selection.
- Keep/extend the existing unit test "breakout forces seedance regardless of requested engine"; add "missing engine → 400".

## 2. One capability-driven registry (single source of truth)

Extend `EngineDefinition` into a full **EngineProfile** that DRIVES behavior instead of describing it:

```ts
interface EngineProfile {
  key: 'veo' | 'seedance' | 'kling' | 'sora' | 'wan' | 'runway';
  replicateSlug: string;               // pinned "latest" version per engine
  durations: number[]; fps: number; resolutions: string[];
  nativeAudio: boolean; lipSync: boolean;
  conditioning: { startImage: boolean; endImage: boolean; referenceImages: number };
  promptDialect: { maxChars: number; grammar: 'camera-blocks'|'motion-first'|'narrative'|'storyboard';
                   negativePrompt: boolean; dialogueInPrompt: boolean };
  continuityStrategy: 'keyframe-pair' | 'lastframe-carry' | 'reference-lock' | 'prompt-only';
  audioStrategy: 'native' | 'post-mux';
  dispatch: 'sequential' | 'parallel';
  cost: Record<number, number>;
}
```

- Dispatch mode, audio muxing, continuity treatment, and prompt compilation all read from the profile — kills special-casing like `engine === "seedance" ? "parallel" : "sequential"`.
- Frontend catalog (`model-catalog.ts`) is generated/derived from this, not duplicated.
- "Latest model" policy: pin slugs in ONE place; upgrading Kling/Sora/Wan/Runway to their newest versions is a profile edit + eval run, not a code change. (The deep-research report will name the exact latest versions worth pinning.)

## 3. Director layer — engine-agnostic script, engine-specific compilation

Two-stage prompt architecture:

**Stage 1 — Screenplay (engine-agnostic).** Gemini director (existing `seedance-script-director`, renamed `script-director`, **with auth fixed — M-8**) emits the shot graph: per-shot cinematography JSON + **boundary types** between shots (CONTINUOUS / MATCH_CUT / HARD_CUT / TIME_JUMP…) + identity bible + palette + physics notes. This already ~exists; formalize boundary emission.

**Stage 2 — Per-engine prompt compilers.** One compiler per engine, driven by `promptDialect`:
- **Kling:** `[CAMERA]`/`[LIP-SYNC]` blocks, dialogue inline, negative prompt (≤1500 chars) targeting drift/morphing.
- **Seedance:** strip dialogue, motion-first grammar, camera_fixed handling, ≤2400 chars.
- **Veo:** audio/SFX cues inline (native audio), physics-forward descriptions.
- **Sora:** narrative/storyboard style, longer scene descriptions.
- **Runway:** keyframe-driven, terse motion instructions.
- **Wan:** short, simple, single-action prompts (small model, long prompts hurt).

## 4. Continuity chain — per-engine, with handoff hygiene

The continuity contract picks the mechanism per engine from `continuityStrategy`:

| Engine | Mechanism |
|---|---|
| Seedance 2.0 | **keyframe-pair**: start `image` = shot keyframe *i*, `last_frame_image` = keyframe *i+1* (today's behavior, kept) |
| Kling / Runway | **lastframe-carry**: extract previous clip's final frame (existing `lucataco/ffmpeg-extract-frame`), run **handoff hygiene**, feed as `start_image` |
| Veo / Sora | **reference-lock / prompt-only**: reference images where the API supports them + hard identity-bible prompt injection |

**Handoff hygiene (new, fixes the boundary-discontinuity failure mode):** every frame that crosses a clip boundary gets (a) color-matched to the project palette/first clip (histogram/LUT match — `comp_engine/color.py` already has the primitives), and (b) optionally restored/upscaled before reuse, so compression + drift don't compound clip-over-clip. This is the standard mitigation for error accumulation in last-frame chaining.

**Per-clip QC gate (new):** after each clip, a cheap VLM check (Gemini Flash) scores identity match vs the character sheet + artifact presence; fail → auto-retry once with new seed before continuing the chain. Sequential dispatch makes this natural; for Seedance parallel, QC runs post-hoc and flags clips for one-click regen.

## 5. Pre-production visual bible — nano-banana enters the video pipeline

Biggest continuity lever available. For every project (any engine):

1. **Character sheet:** nano-banana / gemini-3-pro-image generates a multi-view identity set (front/side/¾/back) from the user's reference or concept — persisted per project.
2. **Per-shot keyframes:** nano-banana *editing* (or Flux Kontext) places the SAME character sheet into each shot's environment/lighting per the director's JSON → one consistent keyframe per shot.
3. Keyframes drive i2v for **all** engines (today only breakout/Seedance really leans on this), and keyframe *pairs* drive Seedance.
4. Editor exposure: user can view/edit/regenerate any keyframe (nano-banana inpaint) BEFORE spending video credits — cheap iteration ($0.02–0.04/image) instead of $2–7/clip.

## 6. VFX & creative layer

Effect stack per clip, in pipeline order:

1. **AI generation** (engine branch) →
2. **Python VFX stage (wire the existing cog):** commit + deploy `apply-breakout-vfx` (CPU cog, fail-open). Generalize into `apply-vfx`: chrome overlays (tiktok/crt/thermal/xray…), glass-shatter/particles (`vfx/liquid.py`), LUT/color recipes (`comp_engine`). Runs per-clip, pre-stitch. →
3. **FFmpeg effects (existing 20 crossover recipes)** + per-boundary transitions in seamless-stitcher →
4. **Post-cores:** handoff color-match pre-stitch; Topaz 4K + RIFE 60fps post-stitch (unchanged).

Editor UX: a visible **layer stack per clip** — base clip / python VFX / ffmpeg effect / transition in+out — plus keyframe editing (nano-banana), per-clip regen with same seed/keyframe, and the template gallery. Templates move from hardcoded TS objects toward a data-driven registry (DB or JSON) so new crossover templates don't require deploys.

## 7. Build phases

| Phase | Scope | Effort | Risk |
|---|---|---|---|
| **1. Engine-required contract** | Remove all defaults (FE+BE), 400 ENGINE_REQUIRED, template-override registry, model-picker step w/ capability cards | ~2 days | Low — but it's a breaking API change; grep all `hollywood-pipeline` callers (studio, ad-studio, avatar, iOS branch) |
| **2. EngineProfile consolidation + compilers** | Profile-driven dispatch/audio/continuity; 6 prompt compilers; delete dormant `seedance-pipeline` after porting its tuners/templates | ~1 week | Med — regression-test each engine (the 5 seedance parity regressions are the cautionary tale) |
| **3. Continuity v2** | Handoff hygiene (extract→color-match→carry), lastframe-carry for Kling/Runway, per-clip VLM QC gate + auto-retry | ~1 week | Med — adds latency + small COGS per clip |
| **4. Visual bible** | Character sheet + per-shot nano-banana keyframes for ALL engines; editor keyframe review/edit | 1–2 weeks | Med — image costs are trivial; consistency win is large |
| **5. Python VFX wiring** | Commit backed-up edge fn + predictor, deploy cog, insert per-clip pre-stitch stage, editor layer-stack UI | 1–2 weeks | Med — cog cold starts; fail-open design already mitigates |
| **6. Model refresh** | Pin latest Kling/Sora/Wan/Runway/Veo versions per deep-research findings; update pricing matrix + entitlements | ~3 days | Low — profile edits + eval renders |

**Ordering rationale:** Phase 1 is user-visible policy and unblocks nothing else — ship first. Phases 2–3 are the quality/duration core. Phase 4 is the single biggest consistency lever. Phase 5 is the differentiation play. Phase 6 lands whenever the research report confirms targets.

**Prerequisites before ANY render testing:** top up Replicate credit; fix `script-director` auth (M-8); C-1 ledger fix before this touches real customers.
