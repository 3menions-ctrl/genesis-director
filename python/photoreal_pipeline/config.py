"""
config.py — typed spec for a photoreal breakthrough shot.

Pure stdlib (no torch/hou/bpy here) so the shot-graph compiler and its tests
run anywhere. Heavy stage adapters import their tools lazily.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple


# ── Enums ─────────────────────────────────────────────────────────────────
class RenderTier(str, Enum):
    PREMIUM = "premium"   # Houdini / Karma / Nuke
    OPEN = "open"         # Warp|Blender / Cycles / Natron


class SubjectMode(str, Enum):
    REAL_CLIP = "real_clip"     # user footage → matted (most photoreal)
    GENERATED = "generated"     # gen a subject clip → matted
    IMAGE_3D = "image_3d"       # image→3D mesh, animated


class EnvironmentMode(str, Enum):
    GAUSSIAN_SPLAT = "gaussian_splat"   # 3DGS from photos (most photoreal)
    DEPTH_DISPLACE = "depth_displace"   # Depth-Anything-V2 2.5D
    BUILT_3D = "built_3d"               # generated/asset 3D set
    PLATE_2D = "plate_2d"               # flat plate, 2D comp only


class SimEngine(str, Enum):
    HOUDINI = "houdini"
    WARP = "warp"
    BLENDER = "blender"


class RenderEngine(str, Enum):
    KARMA = "karma"
    CYCLES = "cycles"
    ARNOLD = "arnold"
    REDSHIFT = "redshift"


class CompEngine(str, Enum):
    NUKE = "nuke"
    NATRON = "natron"
    PROGRAMMATIC = "programmatic"   # OpenImageIO/numpy comp


# Boundary violations — must match the TS BoundaryViolation union.
VIOLATIONS = (
    "shatter-step", "climb-out", "pour-liquefy", "swarm",
    "peel", "fold-to-3d", "reach-through",
)
DESTINATIONS = ("toward-viewer", "into-adjacent-ui", "off-screen", "into-outer-space")


# ── Render profile ────────────────────────────────────────────────────────
@dataclass
class RenderProfile:
    tier: RenderTier = RenderTier.OPEN
    subject_mode: SubjectMode = SubjectMode.REAL_CLIP
    environment_mode: EnvironmentMode = EnvironmentMode.GAUSSIAN_SPLAT
    sim_engine: Optional[SimEngine] = None      # default resolved from tier
    render_engine: Optional[RenderEngine] = None
    comp_engine: Optional[CompEngine] = None
    samples: int = 256                          # path-trace samples
    resolution: Tuple[int, int] = (2160, 3840)  # 4K vertical default
    fps: int = 24
    motion_blur: bool = True
    depth_of_field: bool = True
    film_grain: bool = True


# ── Shot spec — the input to the graph compiler ────────────────────────────
@dataclass
class ShotSpec:
    id: str
    violation: str
    destination: str
    container_kind: str
    # assets
    subject_asset: Optional[str] = None          # user clip / image (None ⇒ generated)
    container_photos: List[str] = field(default_factory=list)  # for 3DGS
    container_still: Optional[str] = None         # for depth-displace / plate
    hdri: Optional[str] = None                    # lighting; else extracted
    # timing
    duration_sec: float = 12.0
    break_beat_sec: float = 6.0
    seed: int = 1337
    profile: RenderProfile = field(default_factory=RenderProfile)

    def validate(self) -> List[str]:
        errs: List[str] = []
        if self.violation not in VIOLATIONS:
            errs.append(f"invalid violation {self.violation!r}")
        if self.destination not in DESTINATIONS:
            errs.append(f"invalid destination {self.destination!r}")
        p = self.profile
        if p.environment_mode == EnvironmentMode.GAUSSIAN_SPLAT and not self.container_photos:
            errs.append("gaussian_splat environment needs container_photos[]")
        if p.environment_mode in (EnvironmentMode.DEPTH_DISPLACE, EnvironmentMode.PLATE_2D) and not self.container_still:
            errs.append(f"{p.environment_mode.value} environment needs a container_still")
        if self.subject_mode_needs_asset() and not self.subject_asset:
            errs.append("subject_mode real_clip/image_3d needs subject_asset")
        if not (0 < self.break_beat_sec < self.duration_sec):
            errs.append("break_beat_sec must be within (0, duration_sec)")
        return errs

    def subject_mode_needs_asset(self) -> bool:
        return self.profile.subject_mode in (SubjectMode.REAL_CLIP, SubjectMode.IMAGE_3D)
