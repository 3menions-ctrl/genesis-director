# Deploy — photoreal worker

How the shot graph actually executes on real infrastructure.

## What runs where (honest status)

| Stage | Tool (open tier) | Adapter script | Status |
|---|---|---|---|
| ingest | ffmpeg | built-in | ✅ runs |
| matte | MatAnyone-2 + SAM-2 | `python -m matanyone` | ⏳ needs model wrapper |
| environment | gsplat / Depth-Anything-V2 | `ns-train` / `depth_anything_v2` | ⏳ needs glue |
| simulate | NVIDIA Warp | `sims/warp_<kind>.py` | ⏳ **not authored yet** |
| assemble | USD (pxr) | `usd_scene.py` | ⏳ needs glue |
| render | Blender / Cycles | `render_usd.py` | ⏳ **not authored yet** |
| **comp** | **comp_engine (ours)** | `photoreal_pipeline.comp` | ✅ **runs (tested)** |
| encode | ffmpeg | built-in | ✅ runs |

So: the **orchestration + finishing tail (comp + encode) run for real today** (see
`comp_engine/sequence.py` → a real MP4). The **GPU stages are scaffolded with the
correct commands but their adapter scripts are not yet written** — the worker will
run them once those land. The orchestrator fails loudly on a missing tool rather
than faking output.

## Run

```bash
# build the open-tier worker (GPU host)
docker build -f photoreal_pipeline/deploy/Dockerfile.open -t bt-worker-open .

# or run on Modal (managed GPU)
pip install modal
modal run photoreal_pipeline/deploy/modal_app.py \
  --violation climb-out --destination toward-viewer --container social-feed \
  --subject user.mp4

# finishing tail locally (no GPU) — proves comp+encode end to end
cd python && .venv_comp/bin/python -m comp_engine.sequence /tmp/clip.mp4
```

## Remaining work to a full real shot
1. Author `sims/warp_<kind>.py` (fracture/fluid/cloth/particles → USD geo cache).
2. Author `render_usd.py` (Blender loads USD, Cycles renders beauty + AOVs).
3. Wrap MatAnyone-2/SAM-2 + Depth-Anything-V2/gsplat as the matte/environment adapters.
4. Then the worker renders an end-to-end photoreal shot; comp + encode already work.
