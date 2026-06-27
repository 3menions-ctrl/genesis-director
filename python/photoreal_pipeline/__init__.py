"""
Photoreal Breakthrough Pipeline — guided, human-in-the-loop VFX pipeline that
renders photoreal "subject breaks out of a container" shots from a ShotSpec.

The orchestration core (config, tiers, shot_graph) is pure stdlib and tested.
Heavy stage adapters (matte, environment, simulate, render, comp) live under
`stages/` and import their tools (torch/hou/bpy/...) lazily.

See ARCHITECTURE.md.
"""
from .config import (  # noqa: F401
    CompEngine, EnvironmentMode, RenderEngine, RenderProfile, RenderTier,
    ShotSpec, SimEngine, SubjectMode,
)
from .shot_graph import (  # noqa: F401
    Artifact, ShotGraph, StageKind, StageSpec, compile_shot_graph,
)
from .tiers import resolve_profile, sim_for  # noqa: F401

__all__ = [
    "ShotSpec", "RenderProfile", "RenderTier", "SubjectMode", "EnvironmentMode",
    "SimEngine", "RenderEngine", "CompEngine", "compile_shot_graph", "ShotGraph",
    "StageSpec", "StageKind", "Artifact", "resolve_profile", "sim_for",
]
