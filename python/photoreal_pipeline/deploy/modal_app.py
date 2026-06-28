"""
modal_app.py — run the photoreal shot graph on a Modal GPU worker.

    pip install modal && modal run photoreal_pipeline/deploy/modal_app.py \
        --violation climb-out --destination toward-viewer --container social-feed

Honest scope: this provisions the GPU + image and executes the orchestrator for
real. Stages whose adapter scripts are authored will run; stages still scaffolded
(sims/warp_*.py, render_usd.py) will raise until those scripts land — by design,
so a partial worker fails loudly rather than silently faking a frame.
"""
from __future__ import annotations

import modal

# Build the worker image from the open-tier Dockerfile.
image = modal.Image.from_dockerfile("photoreal_pipeline/deploy/Dockerfile.open")
app = modal.App("breakthrough-photoreal", image=image)


@app.function(gpu="A10G", timeout=60 * 60)
def render_shot(spec_dict: dict) -> dict:
    """Compile + execute a shot graph on the GPU worker."""
    from photoreal_pipeline.config import (
        EnvironmentMode, RenderProfile, RenderTier, ShotSpec, SubjectMode,
    )
    from photoreal_pipeline.shot_graph import compile_shot_graph
    from photoreal_pipeline.orchestrator import execute

    profile = RenderProfile(
        tier=RenderTier(spec_dict.get("tier", "open")),
        subject_mode=SubjectMode(spec_dict.get("subject_mode", "real_clip")),
        environment_mode=EnvironmentMode(spec_dict.get("env", "gaussian_splat")),
    )
    spec = ShotSpec(
        id=spec_dict.get("id", "shot"),
        violation=spec_dict["violation"],
        destination=spec_dict["destination"],
        container_kind=spec_dict["container"],
        subject_asset=spec_dict.get("subject"),
        container_photos=spec_dict.get("photos", []),
        container_still=spec_dict.get("still"),
        profile=profile,
    )
    graph = compile_shot_graph(spec)
    return execute(graph, out_dir=f"/tmp/{spec.id}", dry_run=False)


@app.local_entrypoint()
def main(violation: str, destination: str, container: str,
         subject: str = None, tier: str = "open"):
    spec = dict(violation=violation, destination=destination, container=container,
                subject=subject, tier=tier,
                subject_mode="generated" if not subject else "real_clip")
    print(render_shot.remote(spec))
