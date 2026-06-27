"""
stages.py — adapters that turn a StageSpec into a concrete tool invocation.

Each adapter emits the REAL command (or python entrypoint) for its tool and
declares what binary/module it needs. Nothing here imports torch/hou/bpy at
module load — availability is checked lazily — so the module imports anywhere
and the orchestrator can DRY-RUN the full plan (which is what runs in CI).

Executing for real needs the tools present on a GPU render worker.
"""
from __future__ import annotations

import importlib.util
import shutil
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .shot_graph import StageKind, StageSpec


def _bin(name: str) -> bool:
    return shutil.which(name) is not None


def _mod(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError):
        return False


@dataclass
class Invocation:
    """A concrete, runnable description of one stage."""
    stage_id: str
    runner: str               # "subprocess" | "python"
    command: List[str]        # argv (subprocess) or a descriptive python call
    requires: List[str]       # tool/module names that must be present
    note: str = ""
    available: Optional[bool] = field(default=None)

    def check(self) -> bool:
        self.available = all(_bin(r) or _mod(r) for r in self.requires)
        return self.available


def _h(name: str) -> str:
    """Render an artifact handle as a path token (real paths injected at run)."""
    return name.replace("@", "out/") + ".ext"


def build_invocation(stage: StageSpec, out_dir: str = "runs/shot") -> Invocation:
    """Map a stage to its real tool command. The placeholders (@handle) are
    substituted with concrete artifact paths by the orchestrator at run time."""
    k, p, tool = stage.kind, stage.params, stage.tool
    out = f"{out_dir}/{stage.id.split(':')[-1]}"

    if k == StageKind.GEN_SUBJECT:
        return Invocation(stage.id, "python",
            ["python", "-m", "breakout_pipeline.cli", "--prompt", str(p.get("prompt", "")),
             "--output-name", out],
            ["torch", "diffusers"], "generate the subject clip (diffusers)")

    if k == StageKind.INGEST:
        return Invocation(stage.id, "subprocess",
            ["ffmpeg", "-i", str(p.get("source", "@subject_clip")),
             "-vf", "colorspace=all=bt709:iall=bt709", f"{out}_plate.mov"],
            ["ffmpeg"], "linearise + normalise the plate")

    if k == StageKind.MATTE:
        # MatAnyone-2 (CVPR'26) reference matting; SAM-2 for the first mask.
        return Invocation(stage.id, "python",
            ["python", "-m", "matanyone", "--video", "@plate",
             "--out", f"{out}_rgba.mov", "--despill", "--refine"],
            ["matanyone"], "video matte → subject RGBA + alpha (no green screen)")

    if k == StageKind.SUBJECT_3D:
        return Invocation(stage.id, "python",
            ["python", "-m", "trellis", "--image", "@plate", "--rig", "--out", f"{out}.glb"],
            ["trellis"], "image → rigged 3D subject mesh (TRELLIS 2)")

    if k == StageKind.TRACK:
        return Invocation(stage.id, "subprocess",
            ["colmap", "automatic_reconstructor", "--image_path", "@plate_frames",
             "--workspace_path", out],
            ["colmap"], "solve the camera from the plate")

    if k == StageKind.ENVIRONMENT:
        if tool == "gsplat":
            return Invocation(stage.id, "subprocess",
                ["ns-train", "splatfacto", "--data", "@photos", "--output-dir", out],
                ["ns-train"], "3D Gaussian Splatting from container photos")
        if tool == "depth-anything-v2":
            return Invocation(stage.id, "python",
                ["python", "-m", "depth_anything_v2", "--img", str(p.get("still", "@still")),
                 "--displace", "--out", f"{out}_env.usd"],
                ["depth_anything_v2"], "Depth-Anything-V2 → 2.5D displaced mesh")
        if tool == "blender-build":
            return Invocation(stage.id, "subprocess",
                ["blender", "-b", "-P", "build_env.py", "--", "--kind",
                 str(p.get("kind", "")), "--out", f"{out}_env.usd"],
                ["blender"], "procedural 3D set (Geometry Nodes)")
        return Invocation(stage.id, "subprocess",
            ["ffmpeg", "-loop", "1", "-i", str(p.get("still", "@still")), f"{out}_plate.mov"],
            ["ffmpeg"], "flat plate (2D comp only)")

    if k == StageKind.SIMULATE:
        sim_kind = str(p.get("sim_kind"))
        if tool == "houdini":
            return Invocation(stage.id, "subprocess",
                ["hython", f"sims/houdini_{sim_kind}.py", "--seed", str(p.get("seed")),
                 "--env", "@env", "--break", str(p.get("break_beat_sec")),
                 "--out", f"{out}_sim.usd"],
                ["hython"], f"Houdini {p.get('solver')} → simulated geo cache (USD)")
        if tool == "warp":
            return Invocation(stage.id, "python",
                ["python", "-m", f"photoreal_pipeline.solvers.warp_{sim_kind}",
                 "--seed", str(p.get("seed")), "--env", "@env", "--out", f"{out}_sim.usd"],
                ["warp"], f"NVIDIA Warp {p.get('solver')} → geo cache (USD)")
        return Invocation(stage.id, "subprocess",
            ["blender", "-b", "-P", f"sims/blender_{sim_kind}.py", "--",
             "--seed", str(p.get("seed")), "--out", f"{out}_sim.usd"],
            ["blender"], f"Blender {p.get('solver')} → geo cache (USD)")

    if k == StageKind.ASSEMBLE:
        return Invocation(stage.id, "python",
            ["python", "-m", "photoreal_pipeline.usd_scene", "--env", "@env",
             "--sim", "@sim_cache", "--hdri", str(p.get("hdri") or "extract"),
             "--res", "x".join(map(str, p.get("resolution", []))), "--out", f"{out}_scene.usd"],
            ["pxr"], "assemble the USD scene (env + sim + camera + lights)")

    if k == StageKind.RENDER:
        aovs = ",".join(p.get("aovs", []))
        if tool == "karma":
            return Invocation(stage.id, "subprocess",
                ["husk", "--renderer", "Karma", "--samples", str(p.get("samples")),
                 "--aovs", aovs, "@usd", "-o", f"{out}_beauty.####.exr"],
                ["husk"], "Karma path-trace → beauty + AOVs")
        if tool == "cycles":
            return Invocation(stage.id, "subprocess",
                ["blender", "-b", "-P", "render_usd.py", "--", "--usd", "@usd",
                 "--samples", str(p.get("samples")), "--aovs", aovs, "--out", f"{out}_beauty"],
                ["blender"], "Cycles path-trace → beauty + AOVs")
        return Invocation(stage.id, "subprocess",
            ["kick" if tool == "arnold" else "redshiftCmdLine", "@usd", "-o", f"{out}_beauty.exr"],
            ["kick" if tool == "arnold" else "redshiftCmdLine"], f"{tool} path-trace")

    if k == StageKind.COMP:
        if tool == "nuke":
            return Invocation(stage.id, "subprocess",
                ["nuke", "-t", "comp/breakthrough_comp.py", "--", "--beauty", "@beauty",
                 "--aovs", "@aovs", "--subject", "@subject_rgba", "--out", f"{out}_comp.####.exr"],
                ["nuke"], "Nuke comp: subject + beauty + AOVs (DOF/mblur/lightwrap/grain)")
        if tool == "natron":
            return Invocation(stage.id, "subprocess",
                ["natronrenderer", "comp/breakthrough.ntp", "-w", "Write1", f"{out}_comp.####.exr"],
                ["natronrenderer"], "Natron comp (open-source)")
        return Invocation(stage.id, "python",
            ["python", "-m", "photoreal_pipeline.comp", "--beauty", "@beauty",
             "--subject", "@subject_rgba", "--out", f"{out}_comp.exr"],
            ["numpy"], "our comp_engine: light-wrap + DOF + motion-blur + glow + grade + grain")

    if k == StageKind.ENCODE:
        return Invocation(stage.id, "subprocess",
            ["ffmpeg", "-i", "@comp", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
             f"{out}_final.mp4"],
            ["ffmpeg"], "encode deliverables (mp4 + prores + thumbnail)")

    return Invocation(stage.id, "python", ["true"], [], "no-op")
