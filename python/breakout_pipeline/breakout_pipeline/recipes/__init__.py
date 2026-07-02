"""Per-template VFX recipes — pick the right effect chain by `recipe_slug`.

Each recipe is a function that takes the AI-generated frames + a recipe
context and applies the appropriate post-processing stack:

  • glass_shatter   — Voronoi shatter + spark particles
  • water_breach    — liquid burst + wave particles
  • paint_pour      — viscous paint + drip particles
  • smoke_billow    — volumetric smoke (orange/white/gray/tornado)
  • neon_zap        — lightning bolt + chromatic split
  • rip_tear        — ripping crack + claw debris
  • frame_dissolve  — soft alpha fade + light bloom
  • leap_landing    — impact dust + ground particles
"""
from .base import RecipeContext, apply_recipe

__all__ = ["RecipeContext", "apply_recipe"]
