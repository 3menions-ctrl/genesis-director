# photoreal_pipeline

Guided, human-in-the-loop VFX pipeline that renders **photoreal** breakthrough
shots — the realistic ceiling for "subject breaks out of a container." Full
design in [ARCHITECTURE.md](./ARCHITECTURE.md).

## What's in here

| File | Status | Notes |
|---|---|---|
| `config.py` | ✅ pure stdlib | `ShotSpec`, `RenderProfile`, enums, validation |
| `tiers.py` | ✅ pure stdlib | tier→tool resolution, violation→sim mapping |
| `shot_graph.py` | ✅ pure stdlib, **tested** | compiles a `ShotSpec` → deterministic stage DAG |
| `stages.py` | ✅ imports anywhere | each stage → its **real** tool command (lazy availability) |
| `orchestrator.py` | ✅ dry-run runnable | runs the DAG in dep order; `dry_run` prints the plan |
| `cli.py` | ✅ runnable | build a shot, `--dry-run` or `--json` |
| `test_shot_graph.py` | ✅ 11 tests pass | `python3 -m unittest photoreal_pipeline.test_shot_graph` |

The orchestration is **real and verified**. The *stages* (matte, splat, sim,
render, comp) need GPU + licensed/large binaries and run on a render worker —
they're scaffolded with the actual invocations, not executed in CI.

## Run

```bash
cd python

# tests (anywhere)
python3 -m unittest photoreal_pipeline.test_shot_graph -v

# see the full plan + which tools are present (anywhere)
python3 -m photoreal_pipeline.cli \
  --violation climb-out --destination toward-viewer --container social-feed \
  --subject user.mp4 --photos a.jpg b.jpg c.jpg --tier open --dry-run

# the shot graph as JSON (feed a scheduler)
python3 -m photoreal_pipeline.cli ... --json

# real render (on a worker with the tools; --tier premium = Houdini/Karma/Nuke)
python3 -m photoreal_pipeline.cli ... --tier open   # drop --dry-run
```

## To actually render, a worker needs (open tier, zero licence cost)
- `ffmpeg`, `colmap`, `ns-train` (nerfstudio/gsplat), `matanyone` (+ SAM-2),
  `warp` (NVIDIA Warp) or `blender`, `pxr` (USD), `natronrenderer` or OpenImageIO.
- Premium tier swaps in Houdini (`hython`/`husk`) + Nuke + Arnold/Redshift
  (licensed). Same graph, better destruction/fluids/comp.

## Ties to the web app
`TemplateDefinition` (container × violation × destination) + user clip +
container photos → a `ShotSpec` → `compile_shot_graph()`. Same data model the
browser engine previews; this renders the photoreal hero. Mirrors
`src/lib/templates/breakthrough/renderPlan.ts`.

## Honest scope
This maximises realism; it does **not** guarantee a result. The comp stage is
deliberately human-in-the-loop — that's where photoreal is actually finished.
