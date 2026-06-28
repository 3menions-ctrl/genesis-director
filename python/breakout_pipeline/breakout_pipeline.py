"""
breakout_pipeline.py — top-level orchestrator (VFX-enhanced v2).

End-to-end:

  RenderRequest
    → CFG.from_request()
    → VideoGenerator.generate(prompt + identity tokens)
    → composite_frames(raw, cfg, chrome_kind, source_video)
    → recipes.apply_recipe(frames, recipe_slug, ctx)
    → enhance.upscale_video(frames, factor)
    → enhance.interpolate_video(frames, src_fps, target_fps)
    → vfx.apply_lut(frames, color_lut)
    → audio.build_audio_track(sfx_tags, music_genre, ...)
    → assembler.write_video(frames + audio)

Each stage is wrapped in a try/except so a missing optional dependency
degrades the result rather than killing the run. The manifest records
which stages actually executed.
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Optional

import numpy as np

from .assembler import write_thumbnail, write_video, has_ffmpeg
from .audio import build_audio_track
from .config import CFG, RenderRequest
from .enhance import interpolate_video, upscale_video, apply_subject_identity
from .frame_compositor import composite_frames
from .recipes import RecipeContext, apply_recipe
from .vfx import apply_lut
from .video_generator import VideoGenerator

logger = logging.getLogger(__name__)


DEFAULT_NEGATIVE_PROMPT = (
    "low quality, blurry, distorted, watermark, text overlay, low resolution, "
    "amateur, choppy motion, deformed limbs"
)


def render(
    req: RenderRequest,
    template_meta: Optional[dict] = None,
    output_name: str = "breakout",
) -> dict:
    """Run the whole pipeline for one request.

    `template_meta` is the row from `vfx_templates` (with the v2 columns
    like recipe_slug, sfx_tags, music_genre, color_lut, target_fps,
    upscale_factor, interpolate, subject_id_method). If absent we run a
    minimal pipeline using sensible defaults.
    """
    t_start = time.time()
    cfg = CFG.from_request(req)
    meta = template_meta or {}

    # Pull the rich metadata from the template row.
    recipe_slug   = meta.get("recipe_slug")
    sfx_tags      = list(meta.get("sfx_tags") or [])
    music_genre   = meta.get("music_genre")
    color_lut     = meta.get("color_lut") or "aces-default"
    target_fps    = int(meta.get("target_fps") or cfg.fps)
    upscale_x     = int(meta.get("upscale_factor") or 1)
    interpolate   = bool(meta.get("interpolate", False))
    particle_den  = int(meta.get("particle_density") or 220)
    id_method     = meta.get("subject_id_method")
    negative_pmt  = meta.get("negative_prompt") or DEFAULT_NEGATIVE_PROMPT

    logger.info("=== Breakout pipeline (VFX-enhanced v2) ===")
    logger.info("template      : %s", req.template_slug)
    logger.info("recipe        : %s", recipe_slug)
    logger.info("color LUT     : %s", color_lut)
    logger.info("target out    : %dx%d @ %dfps", cfg.width * upscale_x, cfg.height * upscale_x, target_fps)
    logger.info("interpolate   : %s   upscale: %dx", interpolate, upscale_x)
    logger.info("sfx tags      : %s", sfx_tags)
    logger.info("music genre   : %s", music_genre)
    logger.info("ffmpeg avail  : %s", has_ffmpeg())

    stages: dict[str, str] = {}

    # ── 1. AI video generation (with optional identity) ──────────────
    gen_start = time.time()
    generator = VideoGenerator(cfg)
    identity_suffix = ""
    try:
        identity_suffix = apply_subject_identity(
            generator._pipeline if generator._pipeline else generator,
            method=id_method or "none",
            subject_image_path=req.subject_image_path,
        )
        if identity_suffix:
            stages["identity"] = id_method or "none"
    except Exception as e:
        logger.warning("identity injection failed: %s", e)

    raw = generator.generate(
        prompt=req.prompt + (identity_suffix or ""),
        negative_prompt=negative_pmt,
        seed=req.seed,
    )
    generator.unload()
    stages["generation"] = f"{cfg.model_key} {cfg.num_frames}f@{cfg.width}x{cfg.height}"
    gen_seconds = time.time() - gen_start
    logger.info("generation done in %.1fs (%s)", gen_seconds, raw.shape)

    # ── 2. Compositing (canvas + chrome + camera push + base FX) ─────
    comp_start = time.time()
    composed = composite_frames(
        raw, cfg,
        chrome_kind=req.chrome_kind,
        source_video_path=req.source_video_path,
    )
    stages["compositing"] = "canvas + chrome + camera push"
    comp_seconds = time.time() - comp_start
    logger.info("compositing done in %.1fs", comp_seconds)

    # ── 3. Recipe VFX pass (Voronoi shatter, liquid, paint, smoke, …) ─
    fx_start = time.time()
    if recipe_slug:
        try:
            ctx = RecipeContext(
                breakout_frame=cfg.breakout_frame,
                shatter_window=cfg.shatter_frames,
                particle_density=particle_den,
                sfx_tags=sfx_tags,
                color_lut=color_lut,
                seed=req.seed or 42,
                fps=cfg.fps,
            )
            composed = apply_recipe(composed, recipe_slug, ctx)
            stages["recipe_vfx"] = recipe_slug
        except Exception as e:
            logger.warning("recipe %s failed: %s", recipe_slug, e)
            stages["recipe_vfx"] = f"failed:{recipe_slug}"
    fx_seconds = time.time() - fx_start

    # ── 4. Upscale + interpolate ────────────────────────────────────
    enh_start = time.time()
    if upscale_x > 1:
        try:
            composed = upscale_video(composed, factor=upscale_x)
            stages["upscale"] = f"{upscale_x}x"
        except Exception as e:
            logger.warning("upscale failed: %s", e)
            stages["upscale"] = "skipped"
    if interpolate and target_fps > cfg.fps:
        try:
            composed = interpolate_video(composed, src_fps=cfg.fps, target_fps=target_fps)
            stages["interpolate"] = f"{cfg.fps}->{target_fps}fps"
            cfg = _bump_fps(cfg, target_fps)
        except Exception as e:
            logger.warning("interpolate failed: %s", e)
            stages["interpolate"] = "skipped"
    enh_seconds = time.time() - enh_start

    # ── 5. Color grade (LUT) ────────────────────────────────────────
    cg_start = time.time()
    try:
        composed = _apply_lut_all_frames(composed, color_lut)
        stages["color_grade"] = color_lut
    except Exception as e:
        logger.warning("color grade failed: %s", e)
    cg_seconds = time.time() - cg_start

    # ── 6. Audio (music bed + sfx mix) ──────────────────────────────
    audio_path: Optional[Path] = None
    audio_start = time.time()
    out_dir = cfg.output_dir
    if sfx_tags or music_genre:
        try:
            audio_path = build_audio_track(
                sfx_tags=sfx_tags,
                music_genre=music_genre,
                duration_s=cfg.num_frames / cfg.fps,
                breakout_s=cfg.breakout_frame / cfg.fps,
                output_path=out_dir / f"{output_name}.audio.wav",
                work_dir=out_dir / "audio_workdir",
            )
            stages["audio"] = f"{len(sfx_tags)} sfx + {music_genre or 'no music'}"
        except Exception as e:
            logger.warning("audio build failed: %s", e)
    audio_seconds = time.time() - audio_start

    # ── 7. Encode + thumbnail ───────────────────────────────────────
    video_path = out_dir / f"{output_name}.mp4"
    thumb_path = out_dir / f"{output_name}.png"
    enc_start = time.time()
    write_video(composed, video_path, fps=cfg.fps, audio_path=audio_path)
    write_thumbnail(composed, thumb_path)
    enc_seconds = time.time() - enc_start

    total = time.time() - t_start
    result = {
        "template_slug": req.template_slug,
        "chrome_kind":   req.chrome_kind,
        "aspect":        req.aspect,
        "model":         req.model,
        "recipe":        recipe_slug,
        "color_lut":     color_lut,
        "video_path":    str(video_path),
        "thumbnail_path": str(thumb_path),
        "audio_path":    str(audio_path) if audio_path else None,
        "frames":        int(composed.shape[0]),
        "fps":           int(cfg.fps),
        "width":         int(composed.shape[2]),
        "height":        int(composed.shape[1]),
        "duration_seconds": composed.shape[0] / cfg.fps,
        "stages":        stages,
        "timing": {
            "generation_s":  round(gen_seconds, 2),
            "composite_s":   round(comp_seconds, 2),
            "recipe_vfx_s":  round(fx_seconds, 2),
            "enhance_s":     round(enh_seconds, 2),
            "color_grade_s": round(cg_seconds, 2),
            "audio_s":       round(audio_seconds, 2),
            "encode_s":      round(enc_seconds, 2),
            "total_s":       round(total, 2),
        },
    }
    manifest_path = out_dir / f"{output_name}.manifest.json"
    manifest_path.write_text(json.dumps(result, indent=2))
    logger.info("=== Done in %.1fs · %s ===", total, video_path)
    return result


# ── Helpers ──────────────────────────────────────────────────────────────

def _apply_lut_all_frames(frames: np.ndarray, lut_slug: str) -> np.ndarray:
    out = np.empty_like(frames)
    for i in range(frames.shape[0]):
        out[i] = apply_lut(frames[i], lut_slug)
    return out


def _bump_fps(cfg: CFG, new_fps: int) -> CFG:
    """Return a copy of the config with the fps adjusted post-interpolation."""
    from dataclasses import replace

    return replace(cfg, fps=new_fps, num_frames=int(round(cfg.num_frames * (new_fps / cfg.fps))))


def render_from_template_dict(
    template: dict, output_name: Optional[str] = None, **overrides
) -> dict:
    """Convenience wrapper: take a row from the `vfx_templates` table
    (as returned by the Supabase `crossover_browse` RPC) and render it.
    Passes the row through to `render()` as `template_meta` so the rich
    VFX columns drive the pipeline."""
    req = RenderRequest(
        prompt=template["pure_prompt"],
        template_slug=template["slug"],
        chrome_kind=template["chrome_kind"],
        aspect=template.get("aspect_ratio", "9:16"),
        **overrides,
    )
    return render(req, template_meta=template, output_name=output_name or template["slug"])
