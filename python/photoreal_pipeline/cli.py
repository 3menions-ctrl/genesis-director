"""
CLI for the photoreal breakthrough pipeline.

    # show the full shot plan + which tools are present (runs anywhere):
    cd python && python3 -m photoreal_pipeline.cli \
        --violation climb-out --destination toward-viewer --container social-feed \
        --subject user.mp4 --photos a.jpg b.jpg c.jpg --tier open --dry-run

    # actually render (needs the tools on a GPU worker):
    ... --tier premium                # drop --dry-run
"""
from __future__ import annotations

import argparse

from .config import (
    EnvironmentMode, RenderProfile, RenderTier, ShotSpec, SubjectMode,
)
from .orchestrator import execute, plan_json
from .shot_graph import compile_shot_graph


def main() -> None:
    ap = argparse.ArgumentParser(description="Photoreal breakthrough shot pipeline")
    ap.add_argument("--id", default="shot")
    ap.add_argument("--violation", required=True)
    ap.add_argument("--destination", required=True)
    ap.add_argument("--container", required=True)
    ap.add_argument("--subject", default=None, help="user clip/image (omit ⇒ generated)")
    ap.add_argument("--photos", nargs="*", default=[], help="container photos for 3DGS")
    ap.add_argument("--still", default=None, help="container still for depth/plate env")
    ap.add_argument("--hdri", default=None)
    ap.add_argument("--tier", choices=["open", "premium"], default="open")
    ap.add_argument("--env", choices=[m.value for m in EnvironmentMode],
                    default=EnvironmentMode.GAUSSIAN_SPLAT.value)
    ap.add_argument("--subject-mode", choices=[m.value for m in SubjectMode],
                    default=None)
    ap.add_argument("--seed", type=int, default=1337)
    ap.add_argument("--duration", type=float, default=12.0)
    ap.add_argument("--break-beat", type=float, default=6.0)
    ap.add_argument("--json", action="store_true", help="print the shot graph as JSON")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    subject_mode = (SubjectMode(a.subject_mode) if a.subject_mode
                    else (SubjectMode.REAL_CLIP if a.subject else SubjectMode.GENERATED))
    profile = RenderProfile(
        tier=RenderTier(a.tier),
        subject_mode=subject_mode,
        environment_mode=EnvironmentMode(a.env),
    )
    spec = ShotSpec(
        id=a.id, violation=a.violation, destination=a.destination,
        container_kind=a.container, subject_asset=a.subject,
        container_photos=a.photos, container_still=a.still, hdri=a.hdri,
        seed=a.seed, duration_sec=a.duration, break_beat_sec=a.break_beat,
        profile=profile,
    )
    graph = compile_shot_graph(spec)
    if a.json:
        print(plan_json(graph))
        return
    execute(graph, out_dir=f"runs/{a.id}", dry_run=a.dry_run)


if __name__ == "__main__":
    main()
