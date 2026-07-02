# Cog predictor — Breakout VFX as a CPU-only Replicate model.
#
# This exposes ONLY the compositor half of the breakout pipeline: it takes an
# ALREADY-generated clip (rendered upstream by the live Replicate engine, e.g.
# Seedance/Kling) and paints the digital-UI chrome + glass-shatter VFX onto it,
# then writes a Safari-safe MP4. The heavy GPU video *generator*
# (HunyuanVideo/CogVideoX in video_generator.py) is intentionally NOT imported —
# generation already happens upstream, so this stage stays CPU-only, cheap, and
# fast (OpenCV + ffmpeg).
#
# It plugs into the creation pipeline's EFFECTS phase (post clip-generation,
# pre-stitch), driven by a Crossover template's chrome_kind + recipe_slug.
#
# Deploy:  cd python/breakout_pipeline && cog push r8.im/<your-acct>/breakout-vfx
# Then set REPLICATE_BREAKOUT_MODEL=<acct>/breakout-vfx:<version> for the
# apply-breakout-vfx edge function.

from pathlib import Path
from typing import Optional
import tempfile
import urllib.request

import numpy as np
import imageio.v3 as iio
from cog import BasePredictor, Input, Path as CogPath

# Import ONLY the CPU compositor/assembler/recipe surface — never video_generator
# (which would pull in torch/diffusers/bitsandbytes and make this a GPU model).
from breakout_pipeline.config import CFG, RenderRequest
from breakout_pipeline.frame_compositor import composite_frames
from breakout_pipeline.recipes.base import RecipeContext, apply_recipe
from breakout_pipeline.assembler import write_video, write_thumbnail

# Default particle density for the shatter recipe when the caller doesn't override.
DEFAULT_PARTICLE_DENSITY = 60


def _read_frames(path: Path) -> np.ndarray:
    """Read an MP4 into an [N, H, W, 3] uint8 RGB array (what the compositor expects)."""
    frames = iio.imread(path, plugin="pyav")  # RGB, shape (N, H, W, 3)
    arr = np.asarray(frames)
    if arr.ndim == 3:  # single frame guard
        arr = arr[None, ...]
    return arr[..., :3].astype(np.uint8)


class Predictor(BasePredictor):
    def setup(self) -> None:
        # CPU-only; nothing heavy to warm. Kept for Cog lifecycle parity.
        pass

    def predict(
        self,
        video: CogPath = Input(description="Source clip (already generated upstream) to apply the breakout VFX to."),
        chrome_kind: str = Input(
            description="Digital UI chrome to paint (tiktok, youtube, crt, oscilloscope, thermal, xray, radar, ...).",
            default="tiktok",
        ),
        recipe_slug: str = Input(
            description="VFX recipe / breakout effect slug. Empty = chrome only, no shatter recipe.",
            default="",
        ),
        template_slug: str = Input(description="Crossover template slug (provenance/manifest only).", default="the-dancers-leap"),
        aspect: str = Input(description="Output aspect.", choices=["9:16", "16:9", "1:1"], default="9:16"),
        fps: int = Input(description="Output fps.", default=24, ge=8, le=60),
        sfx_tags: str = Input(description="Comma-separated SFX cue tags for the recipe.", default=""),
        color_lut: str = Input(description="Color LUT name applied by the recipe (empty = none).", default=""),
        seed: int = Input(description="Deterministic seed for particle/shatter RNG.", default=42),
    ) -> CogPath:
        raw = _read_frames(Path(video))
        n = int(raw.shape[0])

        # Build a CFG sized to the requested aspect + the ACTUAL clip length, so
        # breakout_frame / shatter_frames land correctly for this clip.
        req = RenderRequest(
            prompt="",
            template_slug=template_slug,
            chrome_kind=chrome_kind,
            aspect=aspect,  # type: ignore[arg-type]
            num_frames=n,
        )
        cfg = CFG.from_request(req)
        cfg.fps = int(fps)

        # 1) Composite the clip inside the UI chrome (scale → canvas → chrome → push).
        composed = composite_frames(raw, cfg, chrome_kind, source_video_path=None)

        # 2) Apply the breakout recipe (shatter, particles, chromatic aberration, LUT).
        if recipe_slug:
            ctx = RecipeContext(
                breakout_frame=cfg.breakout_frame,
                shatter_window=cfg.shatter_frames,
                particle_density=DEFAULT_PARTICLE_DENSITY,
                sfx_tags=[t.strip() for t in sfx_tags.split(",") if t.strip()],
                color_lut=color_lut,
                seed=int(seed),
                fps=cfg.fps,
            )
            composed = apply_recipe(composed, recipe_slug, ctx)

        out_dir = Path(tempfile.mkdtemp())
        out_path = out_dir / "breakout.mp4"
        write_video(composed, out_path, fps=cfg.fps)
        # Thumbnail is a useful side-artifact; Cog returns the video as the result.
        try:
            write_thumbnail(composed, out_dir / "breakout.png")
        except Exception:
            pass
        return CogPath(out_path)
