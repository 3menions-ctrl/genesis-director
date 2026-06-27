# Breakthrough FX — road plan, market analysis, and the wedge

## The bet
Everyone else makes 4th-wall / "step-out-of-the-screen" effects by **prompting a
video model** (slow, non-deterministic, uneditable, $/sec, identity drift) or by
**hand-keying in After Effects** (hours of roto + sim + comp by a pro). We do it
as a **real-time, deterministic, parametric procedural engine** that runs *in the
browser* — instant preview, art-directable sliders, infinite resolution,
seed-stable, and the same data model drives the offline high-fidelity render.

That's the wedge: **"TikTok-effect speed with VFX-house control."**

## Market scan — who does "break out of the frame", and how

| Player | How they do it | Strength | Where it breaks down |
|---|---|---|---|
| **CapCut / TikTok effects** | preset overlays + a few AI effects ("AI 4th wall") | massive reach, 1-tap, on-device | fixed presets, no control, generic look, no real physics |
| **Runway / Pika / Kling / Sora templates** | text/image→video diffusion | "magic", photoreal-ish | non-deterministic, can't art-direct, ~$/sec, slow, identity drift, res-capped |
| **After Effects / Houdini / Nuke** | manual roto + sim + comp | total control, film quality | hours per shot, needs a VFX artist, zero self-serve |
| **Unreal / Notch (broadcast)** | real-time node graphs | live, high quality | studio tooling, steep, not a consumer web product |
| **Three.js / Shader demos** | hand-coded WebGL one-offs | real-time, free | bespoke per effect, no catalogue, no pipeline |

### What makes the successful ones succeed (the patterns to steal)
1. **Instant feedback** — CapCut/TikTok win on *zero wait*. Preview must be live.
2. **One tap to "wow"** — a strong default that looks great with no tuning.
3. **A recognizable container** — the effect lands because the viewer *knows* the
   UI it's breaking out of (a feed, a billboard, a call grid). Familiarity = share.
4. **A beat** — the break hits on the music. Sync is the difference between
   "neat" and "viral."
5. **Remixability** — the ones that spread let you drop your own face/clip in.

### Where they all leave the door open (our improvements)
- **Determinism + editability** — diffusion can't give it; we can (params, seeds).
- **Real physics** — actual fracture/fluid/flocking, not a canned overlay.
- **A *catalogue generator*** — container × violation × destination is an
  infinite, data-driven matrix, not a fixed preset list.
- **Same model, two fidelities** — the *browser* engine previews instantly; the
  *Python* engine (Warp/Blender) renders the same `TemplateDefinition` at film
  quality. One source of truth.
- **Beat-locked by construction** — the break beat is a schema field, snappable
  to an audio cue, shared by preview and render.

## The build (this PR = Phase 0, the browser engine)

A `src/lib/breakthrough-fx/` runtime that takes a `TemplateDefinition` (the data
model already shipped) → `resolveTemplate()` → and **plays the 4-layer
breakthrough live on a `<canvas>`**, deterministically:

- **Seeded PRNG** (mulberry32) — reproducible sims, seed-stable previews.
- **Per-violation simulators** — real stepping physics:
  - `shatter` — Voronoi-ish shard fracture + spark particles + chromatic kicker
  - `pour` — particle fluid (gravity + spread) spilling toward the viewer
  - `swarm` — boids flocking out of the container
  - `peel` — corner-lift membrane
  - generic `burst` fallback for fold-to-3d / climb-out / reach-through
- **Chrome painters** — procedurally-drawn container chrome for all 7 kinds
  (feed card, billboard, aquarium, CCTV grid, group chat, wanted poster, app grid).
- **Beat-driven clock** — establish → tension → **break** → cross → aftermath,
  with the break beat firing the sim and the **destination** driving the motion.
- **Post-FX style pass** — scanlines / chromatic aberration / vignette / bloom,
  tuned per container (CRT for CCTV, neon bloom for billboard).
- **Live in the UI** — a public **/breakthrough-lab** page: pick a template,
  scrub/play, drag **Intensity** and the **break beat** (watch it re-sync), read
  out the resolved beats/mask/axes. Zero backend, zero keys, instant.

## Phasing beyond this PR
- **Phase 0 (this PR)** — browser engine + live Lab. Proves the thesis, demoable now.
- **Phase 1** — WebGPU compute sims (10–100× particles) + record-to-WebM export
  client-side; the preview *becomes* a shippable render for social.
- **Phase 2** — the Python twin: the same `TemplateDefinition` drives Warp/Taichi
  sims + Blender headless for film-grade output (see `PROCEDURAL-VFX.md`).
- **Phase 3** — neural-surgical assets: MatAnyone-2 matte of the user's own clip
  + image→3D subject, dropped into the procedural scene. Remixability → virality.

## Success metric
A creator picks "Social Feed Breakout", drops their clip, drags one slider, and
has a beat-locked, share-ready breakout in **seconds** — with a look no diffusion
preset can match and a VFX artist would charge hours for.
