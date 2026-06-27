# Procedural VFX — state-of-the-art alternative to generation engines

Research roadmap for building **deterministic, art-directable, physically-based
VFX in Python** for the Breakthrough Effects system — as an alternative (and
complement) to prompt-based image/video generation.

## The reframe

| | Generation engines (today) | Procedural / simulation (proposed) |
|---|---|---|
| How a shatter is made | describe it in a prompt, hope the model renders it | run a **Voronoi rigid-body fracture sim** — real shards, real physics |
| Determinism | non-deterministic; reseed = different result | **seed-stable**; same params → same frames every time |
| Art direction | reroll the prompt | tweak parameters (shard count, viscosity, spawn point) |
| Resolution | capped by the model | **infinite** — render at any res, re-render cheaply |
| Style | "AI look", baked in | **explicit shader stacks** you control |
| Identity | drifts across clips | locked — the subject is one asset reused |
| Cost | $/second per gen, every variation | sim once, render variations near-free |

**What you already have:** `python/breakout_pipeline/frame_compositor.py` is a
*primitive* version of this — `cv2` chrome painters + a hand-rolled glass
shatter (radial crack lines, single-pixel particles, `np.roll` chromatic
aberration). It proves the instinct is right; it's just 2D doodling bolted onto
a diffusion clip. The roadmap below is the SOTA version of that instinct.

**The key idea:** the schema's three axes already partition the work. Make
`boundary_violation` select a **simulation module**, `container` a **scene**,
`destination` a **camera move**. Generation is then used *surgically* — only for
the genuinely-perceptual bits (subject identity, depth, matte) — not the whole
frame.

## boundary_violation → SOTA simulation technique

| Violation | Physical phenomenon | SOTA Python technique |
|---|---|---|
| `shatter-step` | rigid-body fracture | Voronoi fracture + RBD — **NVIDIA Warp/Newton** or **Blender Cell-Fracture + RBD** (PhysX **Blast** for destruction) |
| `pour-liquefy` | free-surface fluid | **FLIP / MPM** — **Taichi** (billion-particle MPM on one GPU), Blender **Mantaflow**, or Warp SPH |
| `swarm` | flocking | **boids** in numpy/Taichi, or Warp particle system |
| `peel` | cloth / membrane | **PBD/XPBD cloth** — Blender cloth, Warp/Newton, Taichi PBD |
| `fold-to-3d` | rigid origami | procedural mesh fold via Blender **Geometry Nodes** / trimesh |
| `climb-out` | articulated body exit | image→3D subject mesh, rigged + animated (see "subject") |
| `reach-through` | depth pop-out | **2.5D depth parallax** (Depth Anything V2) or 3DGS scene |

This mirrors the existing `VIOLATION_MASK_SHAPE` map in `compositor.ts` — same
dispatch shape, but each entry now points at a simulator instead of a mask glyph.

## The three hard sub-problems (where neural models earn their place)

1. **Flat → dimensional** (a breakout literally crosses from 2D into 3D):
   - **2.5D parallax (cheap, fast):** Depth Anything V2 → depth map → displace +
     dolly the camera. The flat chrome gains real parallax as the camera pushes
     in. Runs on the existing GPU worker, ~10× faster than diffusion-depth.
   - **True 3D (premium):** **single-image 3D Gaussian Splatting** — Flash3D,
     Wonderland, ExScene, "Complete Gaussian Splats from a Single Image" — turn
     one chrome still into a navigable radiance field you fly a camera through.
2. **Subject as geometry** (for `climb-out`, true 3D breakouts):
   - **Image→3D mesh:** **TRELLIS 2** (Dec 2025, production PBR), **Hunyuan3D
     3.0**, **Stable Fast 3D** (<0.5s, UV-unwrapped + de-lit), **TripoSR** (MIT,
     <1s). Generate the subject once, rig it, animate it stepping out.
3. **Subject as alpha** (compositing above the chrome without green screen):
   - **MatAnyone 2** (CVPR 2026) — reference-based video matting, rotoscope
     quality from ordinary footage. **SAM 2** for interactive video masks.
   - This replaces the `chromakey` stage in the current render path with real
     matting (no need to shoot the subject on green).

## The render/engine layer (a *tool*, not a model)

- **Blender 5.x headless (`bpy`)** — highest leverage. A parametric `.blend`
  per effect family, driven by `TemplateDefinition` params; Geometry Nodes do
  procedural geometry, sims bake to cache, **Cycles** (path-traced) or **EEVEE
  Next** renders headless on a GPU worker. One tool for sim + render + composite,
  fully Python-scriptable. (Note: Cycles is the reliable headless engine.)
- **NVIDIA Warp / Newton** (Mar 2025, open-source, built on Warp) — GPU sims in
  *pure Python*, no DCC dependency, **differentiable** (art-direct a sim by
  optimizing toward a target). Best fit for a lightweight Python microservice.
- **Taichi Lang** — pure-Python GPU kernels; the fluid/MPM/particle workhorse
  when you don't want Blender in the loop.
- **Houdini (`hou`)** — film gold standard for destruction/fluids, HDA +
  Python-scriptable. Premium tier; licensing cost.

## Styles as shader stacks (NPR), not prompts

Replace "style via prompt" with deterministic, parameterized post-processing:
- **moderngl + GLSL** — GPU shader stack: halftone, Kuwahara (oil-paint),
  cross-hatch, dithering, CRT, bloom, toon/edge-detect, chromatic aberration.
  Consistent, instant, tunable. (Your `cv2` CRT + channel-roll CA is the toy
  version of exactly this.)
- **OpenCV / scikit-image NPR** — `stylization`, pencil-sketch, edge-preserving
  filters as a no-GPU fallback.
- **diffvg / nvdiffrast** — differentiable vector/raster rendering for
  optimizing a style toward a reference (advanced).

## How it slots into the system already built

- Add a `procedural?: { violationSim, styleStack, engine }` block to
  `RenderStrategy` in `schema.ts`.
- Write `compileProceduralPlan(def)` beside `compileRenderPlan` — same DAG idea,
  but steps are `gen-subject-3d` / `depth` / `simulate` / `render-blender` /
  `style-shader` instead of `gen-video`.
- The Python service is the existing worker model: `seedance-pipeline` already
  shells out to `breakout_pipeline.cli`; add `procedural_pipeline` modules
  (`sim/`, `render/`, `style/`) next to `frame_compositor.py`.

## Recommended phasing (cheapest win first)

- **Phase 0 — shader styles + 2.5D depth** (days; existing GPU worker, no DCC):
  a `moderngl` style-stack + Depth Anything V2 parallax. Instantly deterministic
  styles and real depth on flat chrome. Biggest quality-per-effort.
- **Phase 1 — Warp/Taichi sim modules** (weeks; pure Python GPU): `shatter`
  (fracture), `swarm` (particles), `pour` (MPM) producing alpha layers composited
  over the chrome via the overlay you already have.
- **Phase 2 — Blender 5 headless** (production): parametric `.blend` per family +
  Geometry Nodes; TRELLIS-2 subject mesh for true `climb-out`.
- **Phase 3 — 3DGS chrome + Houdini tier**: camera truly flies into the
  container; film-grade destruction/fluids.

## Infra note

Sims/renders need **persistent GPU** (CUDA): Warp, Taichi, Blender-Cycles all
require it. You already have the worker concept (`breakout_pipeline` on RTX
cards). Options: extend that worker, or host Blender/Warp containers on
Replicate / Modal / RunPod GPU. The serverless Replicate-FFmpeg path stays for
the final encode + the lightweight composites.

## Sources
- NVIDIA Warp — https://github.com/NVIDIA/warp · https://developer.nvidia.com/warp-python · Newton engine: https://www.edstem.com/blog/a-deep-dive-into-nvidia-newton
- PhysX / Blast destruction — https://developer.nvidia.com/physx-sdk
- Taichi Lang (billion-particle MPM, autodiff) — https://www.taichi-lang.org/ · https://github.com/taichi-dev/awesome-taichi
- PhiFlow (differentiable fluids) — https://tum-pbs.github.io/PhiFlow/Fluids_Tutorial.html
- Single-image 3DGS — https://arxiv.org/abs/2508.21542 · ExScene https://arxiv.org/abs/2503.23881 · survey https://arxiv.org/pdf/2508.09977
- Image→3D mesh — TRELLIS 2 / Hunyuan3D / SF3D / TripoSR comparison: https://trellis2.app/blog/best-image-to-3d-models-huggingface · https://www.triposrai.com/ · InstantMesh https://arxiv.org/html/2404.07191v1
- Video matting / segmentation — MatAnyone 2 (CVPR 2026) https://studio.aifilms.ai/blog/matanyone-2-video-matting · SAM 2 https://docs.ultralytics.com/models/sam-2
- Depth Anything V2 — https://depth-anything-v2.github.io/ · https://arxiv.org/html/2406.09414v2
- Blender headless / Geometry Nodes / 5.0 — https://www.cgchannel.com/2025/11/blender-5-0-is-out-check-out-its-5-key-features/ · https://docs.blender.org/api/current/
