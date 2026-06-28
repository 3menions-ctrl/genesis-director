"""
base.py — recipe dispatch table.

Each recipe slug maps to a function that mutates the frame array in
place (well, returns a new one). The orchestrator looks up the recipe
from the template, builds a RecipeContext, and calls `apply_recipe`.

Adding a new recipe = add a new entry to RECIPE_TABLE.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

from ..vfx import (
    render_shatter_overlay,
    render_particle_field,
    render_liquid_overlay,
    render_paint_overlay,
    render_smoke_overlay,
    render_lightning_overlay,
)


@dataclass
class RecipeContext:
    breakout_frame: int
    shatter_window: int
    particle_density: int
    sfx_tags: list[str]
    color_lut: str
    seed: int = 42
    fps: int = 24


# ── Recipe implementations ───────────────────────────────────────────────

def _glass_shatter(frames: np.ndarray, ctx: RecipeContext) -> np.ndarray:
    out = render_shatter_overlay(
        frames,
        breakout_frame=ctx.breakout_frame,
        window=ctx.shatter_window,
        impact_radius=int(min(frames.shape[1:3]) * 0.35),
        num_shards=min(160, max(60, ctx.particle_density // 2)),
        seed=ctx.seed,
    )
    out = render_particle_field(
        out,
        breakout_frame=ctx.breakout_frame,
        duration_frames=int(ctx.fps * 1.2),
        n_particles=ctx.particle_density,
        palette=((255, 255, 255), (230, 240, 255), (200, 220, 255)),
        seed=ctx.seed + 1,
    )
    return out


def _water_breach(frames: np.ndarray, ctx: RecipeContext) -> np.ndarray:
    out = render_liquid_overlay(
        frames,
        breakout_frame=ctx.breakout_frame,
        duration_frames=int(ctx.fps * 1.4),
        tint=(200, 130, 40),                # cool blue water in BGR
        impulse_strength=6.5,
    )
    out = render_particle_field(
        out,
        breakout_frame=ctx.breakout_frame,
        duration_frames=int(ctx.fps * 1.0),
        n_particles=ctx.particle_density,
        palette=((255, 255, 255), (200, 220, 255), (160, 200, 240)),
        seed=ctx.seed,
    )
    return out


def _paint_pour(frames: np.ndarray, ctx: RecipeContext) -> np.ndarray:
    out = render_paint_overlay(
        frames,
        breakout_frame=ctx.breakout_frame,
        duration_frames=int(ctx.fps * 2.0),
        color=(40, 40, 40),
        rim_color=(10, 10, 10),
        viscosity=0.92,
    )
    return out


def _smoke_billow(frames: np.ndarray, ctx: RecipeContext) -> np.ndarray:
    # Pick smoke kind by examining sfx tags — if 'tire_screech' is in
    # the cues, it's tire smoke; if 'tornado_roar', it's tornado; default fog.
    tags = set(ctx.sfx_tags)
    kind = (
        "tire" if "tire_screech" in tags
        else "tornado" if "tornado_roar" in tags
        else "steam" if "steam_hiss" in tags
        else "fog"
    )
    out = render_smoke_overlay(
        frames,
        breakout_frame=ctx.breakout_frame,
        duration_frames=int(ctx.fps * 1.8),
        kind=kind,
        seed=ctx.seed,
    )
    return out


def _neon_zap(frames: np.ndarray, ctx: RecipeContext) -> np.ndarray:
    out = render_lightning_overlay(
        frames,
        breakout_frame=ctx.breakout_frame,
        duration_frames=int(ctx.fps * 0.4),
        glow_color=(255, 140, 200),
        seed=ctx.seed,
    )
    out = render_particle_field(
        out,
        breakout_frame=ctx.breakout_frame,
        duration_frames=int(ctx.fps * 0.8),
        n_particles=ctx.particle_density // 2,
        palette=((255, 140, 200), (255, 200, 240), (255, 255, 255)),
        seed=ctx.seed + 1,
    )
    return out


def _rip_tear(frames: np.ndarray, ctx: RecipeContext) -> np.ndarray:
    """Diagonal rip — driven by the shatter renderer with a narrower window."""
    out = render_shatter_overlay(
        frames,
        breakout_frame=ctx.breakout_frame,
        window=max(2, ctx.shatter_window // 2),
        impact_radius=int(min(frames.shape[1:3]) * 0.25),
        num_shards=40,
        seed=ctx.seed,
    )
    out = render_particle_field(
        out,
        breakout_frame=ctx.breakout_frame,
        duration_frames=int(ctx.fps * 0.5),
        n_particles=max(60, ctx.particle_density // 4),
        palette=((220, 220, 220),),
        seed=ctx.seed + 1,
    )
    return out


def _frame_dissolve(frames: np.ndarray, ctx: RecipeContext) -> np.ndarray:
    """Soft alpha fade — light particles only, no shatter."""
    return render_particle_field(
        frames,
        breakout_frame=ctx.breakout_frame,
        duration_frames=int(ctx.fps * 0.6),
        n_particles=max(30, ctx.particle_density // 6),
        palette=((255, 255, 255), (220, 230, 240)),
        seed=ctx.seed,
    )


def _leap_landing(frames: np.ndarray, ctx: RecipeContext) -> np.ndarray:
    """Impact dust at the breakout moment — no chrome shatter."""
    out = render_particle_field(
        frames,
        breakout_frame=ctx.breakout_frame,
        duration_frames=int(ctx.fps * 1.2),
        n_particles=ctx.particle_density,
        palette=((220, 220, 220), (180, 180, 180), (200, 190, 175)),
        seed=ctx.seed,
    )
    return out


# ── Dispatch table ───────────────────────────────────────────────────────

RECIPE_TABLE: dict[str, Callable[[np.ndarray, RecipeContext], np.ndarray]] = {
    "glass_shatter":  _glass_shatter,
    "water_breach":   _water_breach,
    "paint_pour":     _paint_pour,
    "smoke_billow":   _smoke_billow,
    "neon_zap":       _neon_zap,
    "rip_tear":       _rip_tear,
    "frame_dissolve": _frame_dissolve,
    "leap_landing":   _leap_landing,
}


def apply_recipe(frames: np.ndarray, recipe_slug: str, ctx: RecipeContext) -> np.ndarray:
    """Look up + apply the recipe. Unknown slug = no-op (returns input)."""
    fn = RECIPE_TABLE.get(recipe_slug)
    if fn is None:
        return frames
    return fn(frames, ctx)
