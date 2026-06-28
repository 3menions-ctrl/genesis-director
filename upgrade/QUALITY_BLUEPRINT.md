# QUALITY BLUEPRINT — how to make genuinely great films from this stack

How to combine the existing products/technologies into one top-tier output across every quality axis you named — and the features (existing-but-unwired + net-new) that get us there. Grounded in the real code (see PRODUCTS.md / DIAGNOSIS.md). Each axis = **Have · Gap · How · Build**.

> The throughline: **most of "awesome" is already scaffolded and dead/partial.** The breakthrough-VFX render DAG, SFX generation, scene-aware auto-scoring, the editor's bake path, equal-power transitions — all exist in code and are unwired or stranded. Reviving them beats greenfield. The other half is making the pipeline *honest and durable* so quality is repeatable, not luck.

---

## 1. Perfectly synced audio
- **Have:** Editor has a real Web Audio graph + equal-power audio crossfade tracked to video (`useAudioMixChain.ts`, `StitchedPlayer.tsx`). Backend stitcher does `loudnorm`, EQ, **sidechain music-ducking under narration**, and `acrossfade` (`_shared/audio-mix-filters.ts`, `seamless-command.ts:423`). Veo/Sora/Kling clips carry native synced audio. Narration TTS (`generate-voice`), captions from real STT (`editor-transcribe`).
- **Gap:** Per-clip `volume`/`fadeIn`/`fadeOut` and keyframes are **stranded in dead code** (`PlayerCanvas` Effect A) → "what you set isn't what plays." **Export never bakes** the edit, so timeline sync is preview-only. JS-timer scheduling drifts on long timelines.
- **How (best practice, RESEARCH §A2):** make **audio the master clock**; schedule against `AudioContext.currentTime` with a lookahead scheduler; drive the canvas from `requestVideoFrameCallback` and resync video to audio each frame; equal-power (−3 dB) crossfades. Then **bake the editor's EDL through the existing `seamless-stitcher`** so preview == export.
- **Build:** (a) wire per-clip gain/fades/keyframes into live `StitchedPlayer`; (b) EDL→`seamless-stitcher` bake (closes the #1 editor gap); (c) **auto-sync narration to shot boundaries** (extend `sync-music-to-scenes`); (d) **lip-sync any character** (not just avatars) via a wav2lip/lip-sync model pass.

## 2. Awesome VFX & "fabulous effects"
- **Have:** Breakouts (10 fourth-wall effects, Seedance). A real-time WebGL FX playground (`BreakthroughLab` / `Breakthrough3DStage`). A **complete-but-DEAD breakthrough render DAG** (`lib/templates/breakthrough/execute.ts` → `generate-video` per layer → stitch) that only tests call. A dead Python `breakout_pipeline/vfx/` with liquid/particles/lightning/shatter/smoke/paint/color-grade. Editor crossover/VFX panel (`CrossoverComposer`).
- **Gap:** The "film-grade" version the Lab promises is never wired; the render DAG is orphaned; Crossover drops its VFX recipe before the backend (renders a plain clip); the Python VFX engine is unused.
- **How:** Two tiers — **(a) AI-native VFX** = curated prompt+model recipes (the crossover/breakout "recipes" actually reaching the backend), and **(b) compositor VFX** = revive the breakthrough DAG to layer generated elements + the WebGL/Python effects, stitched as overlays. Use the Lab as the *live preview* of what the DAG will bake.
- **Build:** (a) **revive `executeBreakthroughRender`** behind a real UI button (turn the demo into a deliverable); (b) make Crossover actually send `crossoverTemplateSlug`/VFX params to the backend; (c) a **VFX overlay layer** in the stitcher (particles/light-leaks/shatter as compositable assets); (d) **camera-move presets** (push-in, parallax, orbit) as generation params.

## 3. Great sound (SFX / mix)
- **Have:** Mix engine (loudnorm/EQ/duck) in the stitcher. `scene-music-analyzer` (Gemini) understands scene mood. **`elevenlabs-sfx` exists** (ElevenLabs sound-generation) — **but is DEAD (no caller)**, and there is **no SFX product at all** today.
- **Gap:** No foley/SFX in any output; EQ/reverb are approximations; no per-scene sound design.
- **How:** Add an **automatic sound-design pass**: analyze each scene (existing `scene-music-analyzer`) → generate matching SFX (`elevenlabs-sfx`) → place + mix under the duck graph already in the stitcher.
- **Build:** (a) **wire `elevenlabs-sfx`** into the pipeline + an editor SFX panel; (b) **auto-foley** (action/scene → SFX suggestions); (c) ambience beds per environment; (d) a real EQ/reverb stage (replace the approximations) for a polished bus.

## 4. Great music
- **Have:** `generate-music` (MusicGen Stereo Large + Melody fallback), a curated free library, **`scene-music-analyzer`** (mood/tempo per scene) and **`sync-music-to-scenes`** (both real, used only by the watchdog today). Sidechain ducking already mixes music under VO.
- **Gap:** Music is user-triggered and generic; the scene-aware auto-scoring exists but isn't part of the main create flow; no beat-synced editing.
- **How:** **Auto-score every film**: on finalize, `scene-music-analyzer` → `generate-music` per act → `sync-music-to-scenes` → duck under narration. Offer "regenerate score" + style presets.
- **Build:** (a) auto-score in the main pipeline (wire the two existing fns into create, not just the watchdog); (b) **beat-synced cuts** (cut clips on detected downbeats); (c) music style/reference conditioning; (d) stems for editor remixing.

## 5. Clear / high-quality video
- **Have:** Best-in-class engines (Veo-3, Sora-2, Kling-V3, Runway-Gen4, Wan-2.5, Seedance). **Quality-post is real:** Topaz **4K upscale** + RIFE **60fps interpolation**, charge-on-delivery (`_shared/quality-post.ts`). Frame-chaining for continuity.
- **Gap:** Default (Kling/Veo) path has **no still-storyboard** stage → continuity is prompt-text only (weaker than skeleton-first). The **24h-signed-URL bug** makes finished films 403 after a day. No HLS in practice.
- **How:** Storyboard-first (stills → motion) on all engines for sharper, consistent shots; keep Topaz/RIFE as an opt-in "Studio quality" tier; **sign-at-read** so films never rot; add HLS for smooth streaming.
- **Build:** (a) wire `generate-scene-images` into the default path; (b) fix sign-at-read (P0 from DIAGNOSIS); (c) provision HLS properly; (d) per-shot "enhance/redo" with the quality models.

## 6. Great scripting
- **Have:** `smart-script-generator` (gpt-4o) + `seedance-script-director`; `extract-scene-identity` builds an **identity bible**; in-editor `generate-script` + **Director Chat** for iterative rewrites; `script-assistant` repairs failed clips; script-approval gate.
- **Gap:** Scripting is solid but mono-pass; no multi-character dialogue modeling; breakouts/seedance **bypass approval** (less control). No standalone "write me a script" product.
- **How:** Make scripting a **collaborative loop**: draft → Director Chat refine → approve → render, with the identity bible carried into every shot prompt (already the design).
- **Build:** (a) **dialogue/character-voice scripting** (multi-speaker scenes → multi-voice TTS); (b) genre/beat-sheet templates that actually reach the backend (fix Templates dropping rich fields); (c) a standalone script tool that exports into create; (d) tone/pacing controls.

## 7. Story building
- **Have:** A **real backend continuity contract** (`_shared/continuity-contract.ts`: boundaries/score/correction-ladder) enforced by `hollywood-pipeline` + `continuity-audit`; frame-to-frame chaining (`continue-production`); identity bible; 37 structural blueprints (Templates).
- **Gap:** The user-facing "8-phase continuity engine" rail is **cosmetic** (heuristic, ~3 real states, index shows "—") even though the backend score is real — so the story intelligence is invisible/unsold. Templates' structure is dropped before render.
- **How:** **Surface the real continuity score** and per-shot boundary analysis; let users build arcs from blueprints that actually drive the backend; carry character/world locks across scenes.
- **Build:** (a) expose `continuity-audit` output in the UI (honest, not faked); (b) **persistent worlds/characters** (the custom avatar should be *saved & reusable*, not ephemeral); (c) multi-scene arc builder; (d) "series" continuity across multiple films.

## 8. Using AI (the model layer)
- **Have:** A multi-model stack already in production: GPT-4o (script/vision), Gemini (image/edit/analysis), FLUX (stills/inpaint), MusicGen (music), ElevenLabs (TTS/STT/SFX), MiniMax (voice), Topaz/RIFE (quality), six video engines — routed via mode-router + an AI gateway.
- **Gap:** Routing metadata is contradictory (test-only map vs runtime); some best models are billing-locked (Cinema/Stripe); no automatic "best engine for this shot" selection; no model fallback chain on failure.
- **How:** A **smart router**: pick the engine/model per shot by content + budget + entitlement; fallback chains (engine A fails → B) instead of stalls; one honest capability registry.
- **Build:** (a) per-shot auto-engine selection; (b) model fallback/circuit-breaker (revive the dead `pipeline-failsafes.ts`); (c) unlock the entitlement gating so premium engines are reachable; (d) cost/quality presets ("draft" vs "studio").

---

## The master recipe (one great film, end to end)
Prompt → **Story** (`smart-script-generator` + Director Chat, beat-sheet blueprint) → **Identity bible** (`extract-scene-identity`, persistent characters/world) → **Storyboard stills** (`generate-scene-images` on every engine) → **Per-shot motion** (auto-selected best engine via `generate-single-clip`, frame-chained by `continue-production` under the continuity contract) → **VFX layer** (revived breakthrough DAG + crossover/breakout recipes + overlays) → **Audio** (narration TTS, auto-scored music via `scene-music-analyzer`+`generate-music`, **auto-SFX via `elevenlabs-sfx`**) → **Mix** (audio-clock-synced, equal-power, sidechain duck) → **Quality post** (Topaz 4K / RIFE 60fps) → **Editor refine** (real per-clip automation + transitions) → **Bake** (EDL → `seamless-stitcher`, WYSIWYG) → **Deliver** (sign-at-read URL, HLS, publish → Lobby).

---

## Feature roadmap

### Tier A — revive what already exists (fastest "awesome", low risk)
1. **EDL bake** so the editor's edits actually ship (unlocks sync, transitions, VFX, mix as deliverables).
2. **Wire `elevenlabs-sfx`** → instant sound design / foley.
3. **Auto-score** via the existing `scene-music-analyzer` + `sync-music-to-scenes` in the main flow.
4. **Revive `executeBreakthroughRender`** → turn the VFX lab demo into real renders.
5. **Fix Crossover/Templates** to actually pass their VFX/structure params to the backend.
6. **Sign-at-read** + provision HLS → films stop rotting, smooth playback.
7. **Real progress narration** (use `pipeline_state.message`) + **celebrate on completion** (wire `celebrate()`/gamification) — perceived quality.

### Tier B — connect the intelligence (differentiators)
8. **Per-shot smart engine selection** + model fallback (revive `pipeline-failsafes.ts`).
9. **Persistent characters & worlds** (save the custom avatar; reuse across films/series).
10. **Surface the real continuity score** + storyboard-first on all engines.
11. **Beat-synced cuts** + auto-foley + ambience beds.
12. **Multi-character dialogue scenes** (multi-voice TTS, lip-sync to any character).

### Tier C — net-new potential
13. **Lip-sync-to-anything** (talking objects, custom characters) as a first-class effect.
14. **Style/look LoRAs or reference-locking** for a consistent house style across a creator's catalog.
15. **Live partial previews** during generation (stream keyframes as clips land).
16. **Voice cloning** (creator's own narrator) + emotion controls.
17. **"Series" mode** — continuity, characters, and score carried across episodes.
18. **One-click platform cuts** (auto 9:16/1:1/16:9 reframes + captions) feeding the (currently dormant) distribution path.

---

## Honest constraints to respect
- **Durability first:** none of this is repeatable until the pipeline is durable — fix the dark watchdog (stuck jobs never recover), hold-aware refunds, and sign-at-read. Greatness that 403s in a day or hangs for 6 hours isn't greatness.
- **Don't sell what you don't measure:** retire faked progress/continuity visuals; show the real backend signals (they exist).
- **Billing gates:** the best engines (Veo/Sora/Runway) are behind a locked Cinema entitlement — decide whether to unlock before promising "awesome VFX/clear video" to all users.
