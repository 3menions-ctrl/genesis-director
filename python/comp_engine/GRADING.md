# Self-grade — comp_engine ("our Nuke"), before integration

Honest assessment, graded against "a real headless compositor for the
breakthrough shot," not against Nuke-the-product.

## Overall: **B+ / A− for a v1 core.** Real, correct, tested, well-architected — and deliberately narrow.

| Dimension | Grade | Notes |
|---|---|---|
| **Architecture** | A | Clean separation (image / graph / ops / io / color / recipes). Pull-based memoised DAG with cycle detection — the right model, matches Nuke's evaluation semantics. AOVs are first-class. Nodes are pure → deterministic + testable. |
| **Correctness** | A− | Porter-Duff over verified against hand math; premult/unpremult roundtrips; grade/blur/transform/defocus/motionblur/lightwrap/glow/grain/lensdistort each have a real numeric test (21 passing). Scene-linear, straight-alpha, premult-in-filters — all correct conventions. |
| **Completeness** | B | Covers the breakthrough comp end-to-end. Missing nodes a full comp wants: deep compositing, cryptomatte ID extraction, proper keyer, edge-extend/erode-dilate, true scatter-based bokeh, OFX host, ROI/bbox optimisation, tiling. |
| **Performance** | B− | Pure CPU numpy. Fine for stills + short shots at ≤1080. A 4K×300-frame shot needs GPU (CuPy/Warp) or tiled streaming + bbox/ROI culling. Defocus/motionblur are O(levels)/O(samples) gathers — acceptable, not optimal. |
| **Fidelity of the hard ops** | B | Defocus is layered-blur (not true scatter bokeh / no bokeh shape). MotionBlur is backward-gather (good, but single-vector per pixel, no segmented blur). LightWrap/Glow are the standard recipes (correct, not physically exhaustive). Grade is full Nuke-style. |
| **IO / colour** | B | imageio 8-bit + sRGB now; EXR multi-channel AOV IO + OCIO are wired but need OpenImageIO/PyOpenColorIO on the worker (not in this sandbox). |
| **Testing** | A− | 21 numeric unit tests, each asserting real behaviour (not smoke). Determinism + memoisation + cycle detection covered. No golden-image regression yet. |
| **Verifiability** | A | Renders an actual multi-AOV comped frame (`make_demo`) with no assets — light-wrap, DOF, motion-blur, glow, grade, grain all visibly applied. |

## What it genuinely is
A correct, deterministic, headless AOV compositor that runs the breakthrough
comp and is general enough to grow. It owns the node set we need, no licence.

## What it is NOT (yet) — the honest gaps to close before "best in class"
1. **GPU + tiling** — port the hot ops (blur/defocus/motionblur/merge) to CuPy or
   Warp; add ROI/bbox so we don't process empty regions. (biggest lever)
2. **True bokeh defocus** — scatter with a bokeh kernel + per-pixel CoC, not
   layered gaussian.
3. **Cryptomatte + deep** — ID-matte extraction and deep merge for clean holdouts.
4. **EXR/AOV IO via OpenImageIO + OCIO** — real multi-layer reads and managed colour.
5. **Golden-image regression tests** — lock visual output, not just numeric props.
6. **OFX host (optional)** — run existing OFX plugins.

## Recommendation
**Ship as the v1 comp core; do NOT call it Nuke-equivalent.** It is the right
foundation and is integration-ready behind the photoreal pipeline's `comp` stage
(replacing the Natron/programmatic placeholder). Prioritise GPU+tiling and true
bokeh next. Hold integration until you've run your own test — as agreed.
