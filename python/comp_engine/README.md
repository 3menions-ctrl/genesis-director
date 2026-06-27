# comp_engine — "our Nuke"

A headless, node-based, AOV-driven compositor. Scene-linear float32, pure-numpy
ops, deterministic pull-based DAG. Built for the breakthrough comp; general
enough to be a real compositor.

## Run
```bash
cd python
python3 -m venv .venv_comp && .venv_comp/bin/pip install numpy imageio
.venv_comp/bin/python -m unittest comp_engine.test_comp -v      # 21 tests
.venv_comp/bin/python -m comp_engine.cli --demo --out demo.png  # render a frame
```

## Architecture
- `image.py` — `Image`: named float channel planes (RGBA + arbitrary AOVs: Z,
  N.*, motion.*, P.*, cryptomatte) — Nuke-style channels.
- `graph.py` — `Node` + pull-based, memoised `evaluate()` with cycle detection.
- `nodes.py` — the op library: `Constant`, `Ramp`, `Merge` (Porter-Duff over +
  add/screen/multiply/min/max/mask), `Grade`, `Premult`/`Unpremult`, `Clamp`,
  `Shuffle`, `Blur`, `Transform`, `Defocus` (depth DOF), `MotionBlur` (vector),
  `LightWrap`, `Glow`, `Grain`, `LensDistort`.
- `color.py` — sRGB ⇄ linear; optional OCIO.
- `io_nodes.py` — `Read`/`Write` (imageio now; OpenImageIO/EXR+AOVs on a worker).
- `recipes.py` — `breakthrough_comp()` (the standard graph) + `make_demo()`.

## Pipeline correctness
- Scene-linear throughout; alpha is straight; filters premultiply internally so
  edges don't fringe.
- `breakthrough_comp`: light-wrap subject → merge over beauty → depth defocus →
  vector motion-blur → glow → grade → grain. AOVs (Z, motion) flow through Merge.

## Status & limits (see GRADING.md)
Real and tested. CPU numpy (fine for stills/short shots; GPU/tiled for long 4K).
EXR/AOV IO + OCIO need OpenImageIO/PyOpenColorIO on the worker (lazy).
