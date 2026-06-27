# Photoreal Breakthrough Pipeline — architecture

A guided, human-in-the-loop pipeline that produces **photoreal** "subject breaks
out of a container" shots — the realistic ceiling for this effect. This is a
real VFX pipeline (the way studios actually do it), not a one-model push-button
toy, and it is deliberately *not* fully automated: realism comes from real
footage + real capture + real simulation + real compositing, orchestrated
deterministically from a `TemplateDefinition`.

## Honesty up front
- The orchestration core (`shot_graph.py`) is pure-Python and **tested + runnable**.
- The heavy stages (matting models, Gaussian-splat training, Houdini sim,
  path-traced render, Nuke comp) require **GPU + licensed/large binaries** and
  run on a render worker — they are scaffolded here with the *actual* tool
  invocations behind lazy availability checks, not executed in CI.
- Nothing here "guarantees" a result. It maximises the realistic ceiling and
  keeps a human in the loop at the comp stage, where Hollywood shots are won.

## The shot graph (how studios actually build this shot)

```
ingest ─┬─► track (camera solve) ─────────────┐
        └─► matte (subject RGBA + alpha) ──┐    │
                                           │    │
container photos ─► environment (3DGS / depth-displace) ─► assemble (USD) ─► render (path-trace +AOVs)
                                                  ▲           │                     │
                              violation+seed ─► simulate ─────┘                     │
                                                                                    ▼
                                                              comp (subject + beauty + AOVs + sim) ─► encode ─► deliver
```

| Stage | What it does | Premium tool | Open tool |
|---|---|---|---|
| **ingest** | shot/fps/colour, linearise | ffmpeg/OCIO | ffmpeg |
| **track** | solve the camera (if there's a plate) | PFTrack / SynthEyes | COLMAP |
| **matte** | extract the real subject to RGBA+alpha | (artist roto in Silhouette) | **MatAnyone-2 / SAM-2** |
| **environment** | photoreal world to break into | photogrammetry / set scan | **3D Gaussian Splatting** (gsplat) or Depth-Anything-V2 displacement |
| **simulate** | the physical break (fracture/fluid/cloth) | **Houdini** (RBD/FLIP/Vellum) | **NVIDIA Warp/Newton** or Blender Mantaflow |
| **assemble** | compose the scene + camera + lights | **USD** (Solaris) | **USD** (pxr) |
| **render** | path-traced beauty + AOVs | **Karma / Arnold / Redshift** | **Cycles** |
| **comp** | the realism finisher | **Nuke** | **Natron** / programmatic (OpenImageIO) |
| **encode** | deliver | ffmpeg | ffmpeg |

## Why these choices (the "best", honestly)
- **USD is the backbone.** It's the actual interchange standard the film
  industry standardised on; every stage reads/writes USD layers so the pipeline
  composes instead of bespoke glue. Non-negotiable for a serious pipeline.
- **3D Gaussian Splatting for the environment** — the single biggest realism
  lever. The world is photoreal because it *is* a captured photo field; the
  camera can truly fly into it. Depth-displacement is the cheap fallback.
- **Real subject matting (MatAnyone-2/SAM-2)** — a real person matted from real
  footage is instantly more photoreal than anything generated. This is the
  realism the engine can't fake.
- **Houdini for the sim** — there is no honest argument that anything beats
  Houdini for destruction/fluids; Warp/Blender are the open tier for cost.
- **AOV-driven comp** — render position/normal/motion/cryptomatte/depth passes so
  the comp can do real DOF, motion blur, light-wrap, contact shadows, grain and
  lens-match. **This stage, with a human, is where photoreal is actually made.**
- **Deterministic orchestration** — params + seeds in `ShotSpec` → identical shot
  graph out, so reruns and variations are reproducible (modulo renderer noise).

## Infra
- GPU render workers (Modal / RunPod / on-prem farm). Houdini Engine + Nuke
  need licences (Indie tiers exist); the open tier (Blender + Warp + Natron) has
  zero licence cost and runs the same graph.
- Stages are containerised per-tool; the orchestrator schedules them by the DAG.
- Artifacts (USD layers, EXR sequences, splats, alpha) live in object storage,
  referenced by handle between stages — same pattern as the web render plan.

## How it ties to the rest of the system
- The web `TemplateDefinition` (container × violation × destination) +
  user-supplied subject clip + container photos → a `ShotSpec` →
  `compile_shot_graph()` → the DAG above. One data model, two fidelities: the
  browser engine previews instantly; this renders the photoreal hero.
- Mirrors `src/lib/templates/breakthrough/renderPlan.ts` — same idea, photoreal target.
