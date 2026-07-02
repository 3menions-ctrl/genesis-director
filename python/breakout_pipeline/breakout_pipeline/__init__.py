"""Breakout pipeline — public exports."""
from .config import CFG, RenderRequest, MODEL_REGISTRY
# GPU generator + orchestrator intentionally NOT imported in the cog build —
# this package ships only the CPU compositor surface (see cog.yaml).
from .frame_compositor import composite_frames
from .assembler import write_video, write_thumbnail, has_ffmpeg
from .vfx import apply_lut
from .recipes import apply_recipe, RecipeContext

__all__ = [
    "CFG",
    "RenderRequest",
    "MODEL_REGISTRY",
    "composite_frames",
    "write_video",
    "write_thumbnail",
    "has_ffmpeg",
    "apply_lut",
    "apply_recipe",
    "RecipeContext",
]
