"""VFX module — physics-grade overlays for the breakout moment.

Each effect is a callable that receives a frame array slice + a context
dict and returns the modified array. The orchestrator picks the right
effect set from the template's `recipe_slug`.
"""
from .shatter import VoronoiShatter, render_shatter_overlay
from .particles import ParticleField, render_particle_field
from .liquid import LiquidBurst, render_liquid_overlay
from .paint import PaintPour, render_paint_overlay
from .smoke import VolumetricSmoke, render_smoke_overlay
from .lightning import LightningBolt, render_lightning_overlay
from .color_grade import apply_lut, get_lut_path, LUT_REGISTRY

__all__ = [
    "VoronoiShatter", "render_shatter_overlay",
    "ParticleField", "render_particle_field",
    "LiquidBurst", "render_liquid_overlay",
    "PaintPour", "render_paint_overlay",
    "VolumetricSmoke", "render_smoke_overlay",
    "LightningBolt", "render_lightning_overlay",
    "apply_lut", "get_lut_path", "LUT_REGISTRY",
]
