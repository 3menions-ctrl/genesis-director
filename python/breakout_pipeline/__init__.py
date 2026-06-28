"""Breakout pipeline — public exports."""
from .config import CFG, RenderRequest, MODEL_REGISTRY
from .breakout_pipeline import render, render_from_template_dict
from .video_generator import VideoGenerator
from .frame_compositor import composite_frames
from .assembler import write_video, write_thumbnail, has_ffmpeg
from .vfx import apply_lut
from .recipes import apply_recipe, RecipeContext

__all__ = [
    "CFG",
    "RenderRequest",
    "MODEL_REGISTRY",
    "render",
    "render_from_template_dict",
    "VideoGenerator",
    "composite_frames",
    "write_video",
    "write_thumbnail",
    "has_ffmpeg",
    "apply_lut",
    "apply_recipe",
    "RecipeContext",
]
