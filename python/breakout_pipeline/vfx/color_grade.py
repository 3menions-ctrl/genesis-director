"""
color_grade.py — OCIO-style LUT application + a few procedural grades.

LUTs are stored as .cube files in `assets/luts/` and looked up by slug
(matches the `color_lut` column in vfx_templates). When a .cube file
isn't found we fall back to a procedural grade defined in this file —
those procedurals are intentionally close to industry-standard looks so
the pipeline never produces an ungraded render.

OCIO would be the right call for a full ACES workflow but adds a heavy
config tree. The procedural fallbacks here cover the seeded templates
without needing OCIO installed.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


# Map each LUT slug → procedural-grade parameters (used when no .cube is
# present in `assets/luts/<slug>.cube`).
LUT_REGISTRY: dict[str, dict] = {
    "aces-default":          dict(temp=0,   tint=0,   contrast=1.05, sat=1.0,  shadows=0,    highlights=0),
    "urban_concrete":        dict(temp=-8,  tint=2,   contrast=1.15, sat=0.9,  shadows=-12,  highlights=8),
    "sodium_alley":          dict(temp=20,  tint=-6,  contrast=1.10, sat=1.05, shadows=-10,  highlights=10),
    "warm_kitchen":          dict(temp=14,  tint=4,   contrast=1.05, sat=1.10, shadows=0,    highlights=4),
    "candle_noir":           dict(temp=24,  tint=-4,  contrast=1.30, sat=0.85, shadows=-20,  highlights=-4),
    "editorial_high_fashion":dict(temp=-2,  tint=2,   contrast=1.12, sat=1.05, shadows=-4,   highlights=12),
    "neon_cyber":            dict(temp=-12, tint=8,   contrast=1.15, sat=1.20, shadows=-8,   highlights=8),
    "tokyo_neon_rain":       dict(temp=-18, tint=12,  contrast=1.18, sat=1.25, shadows=-8,   highlights=4),
    "forest_morning":        dict(temp=-4,  tint=-4,  contrast=1.05, sat=1.10, shadows=4,    highlights=14),
    "blue_hour_street":      dict(temp=-22, tint=2,   contrast=1.10, sat=0.95, shadows=-10,  highlights=6),
    "sports_hdr":            dict(temp=2,   tint=0,   contrast=1.18, sat=1.10, shadows=-4,   highlights=18),
    "rgb_setup_gaming":      dict(temp=-10, tint=10,  contrast=1.20, sat=1.15, shadows=-12,  highlights=2),
    "broadcast_to_warm":     dict(temp=10,  tint=2,   contrast=1.08, sat=1.05, shadows=-2,   highlights=8),
    "warm_macro":            dict(temp=12,  tint=4,   contrast=1.06, sat=1.10, shadows=0,    highlights=10),
    "imax_deepspace":        dict(temp=-20, tint=4,   contrast=1.15, sat=0.95, shadows=-14,  highlights=12),
    "tropical_hdr":          dict(temp=4,   tint=-2,  contrast=1.15, sat=1.20, shadows=-2,   highlights=20),
    "concert_neon":          dict(temp=-8,  tint=14,  contrast=1.18, sat=1.30, shadows=-10,  highlights=8),
    "natural_documentary":   dict(temp=0,   tint=0,   contrast=1.08, sat=1.05, shadows=-2,   highlights=4),
    "underwater_to_warm":    dict(temp=8,   tint=-2,  contrast=1.10, sat=1.05, shadows=-4,   highlights=10),
    "matrix_green":          dict(temp=-2,  tint=-22, contrast=1.25, sat=0.85, shadows=-18,  highlights=-6),
    "orange_smoke":          dict(temp=22,  tint=4,   contrast=1.10, sat=1.15, shadows=-6,   highlights=12),
    "pixar_to_real":         dict(temp=0,   tint=0,   contrast=1.05, sat=1.00, shadows=0,    highlights=4),
    "golden_hour_garden":    dict(temp=18,  tint=4,   contrast=1.08, sat=1.10, shadows=-2,   highlights=16),
    "warm_living_room":      dict(temp=14,  tint=2,   contrast=1.04, sat=1.05, shadows=0,    highlights=6),
    "food_warm_appetite":    dict(temp=12,  tint=4,   contrast=1.10, sat=1.20, shadows=-2,   highlights=8),
    "oil_paint_to_real":     dict(temp=4,   tint=2,   contrast=1.08, sat=1.10, shadows=-2,   highlights=4),
    "penthouse_sunset":      dict(temp=22,  tint=2,   contrast=1.10, sat=1.10, shadows=-4,   highlights=14),
    "festival_purple_haze":  dict(temp=-10, tint=18,  contrast=1.18, sat=1.20, shadows=-10,  highlights=4),
    "corporate_clean":       dict(temp=-2,  tint=0,   contrast=1.05, sat=1.00, shadows=0,    highlights=6),
    "golden_hour_sport":     dict(temp=20,  tint=2,   contrast=1.12, sat=1.10, shadows=-2,   highlights=14),
    "product_clean_white":   dict(temp=0,   tint=0,   contrast=1.03, sat=1.00, shadows=0,    highlights=10),
    "crt_retro_warm":        dict(temp=18,  tint=-6,  contrast=1.20, sat=0.88, shadows=-14,  highlights=-2),
    "sci_fi_blue_steel":     dict(temp=-22, tint=2,   contrast=1.18, sat=0.95, shadows=-12,  highlights=8),
    "arcade_neon":           dict(temp=-8,  tint=22,  contrast=1.22, sat=1.30, shadows=-8,   highlights=6),
    "surveillance_green":    dict(temp=-2,  tint=-14, contrast=1.18, sat=0.85, shadows=-16,  highlights=-4),
    "tactical_dim":          dict(temp=-12, tint=-2,  contrast=1.20, sat=0.90, shadows=-16,  highlights=2),
    "oscilloscope_green":    dict(temp=-4,  tint=-24, contrast=1.30, sat=0.80, shadows=-22,  highlights=-8),
    "jet_cockpit_blue":      dict(temp=-18, tint=0,   contrast=1.15, sat=1.00, shadows=-8,   highlights=8),
    "matrix_servers":        dict(temp=-4,  tint=-18, contrast=1.20, sat=0.88, shadows=-18,  highlights=-4),
    "radar_mercury_green":   dict(temp=-2,  tint=-20, contrast=1.25, sat=0.85, shadows=-22,  highlights=-6),
    "xray_to_warm_tungsten": dict(temp=8,   tint=2,   contrast=1.12, sat=1.05, shadows=-4,   highlights=6),
    "comic_to_real":         dict(temp=0,   tint=0,   contrast=1.05, sat=1.00, shadows=0,    highlights=4),
    "oil_paint_natural":     dict(temp=2,   tint=0,   contrast=1.08, sat=1.10, shadows=-2,   highlights=4),
    "theatrical_stage":      dict(temp=18,  tint=2,   contrast=1.18, sat=1.05, shadows=-12,  highlights=8),
    "window_warm_natural":   dict(temp=10,  tint=0,   contrast=1.05, sat=1.05, shadows=0,    highlights=8),
    "gold_warm_luxe":        dict(temp=22,  tint=4,   contrast=1.10, sat=1.15, shadows=-2,   highlights=14),
    "storm_gray_yellow":     dict(temp=4,   tint=-2,  contrast=1.15, sat=0.95, shadows=-10,  highlights=6),
    "plasma_purple":         dict(temp=-12, tint=22,  contrast=1.20, sat=1.20, shadows=-8,   highlights=8),
    "ink_macro_dark":        dict(temp=-4,  tint=-2,  contrast=1.25, sat=0.90, shadows=-18,  highlights=-6),
    "bathroom_clinical":     dict(temp=-2,  tint=0,   contrast=1.05, sat=0.95, shadows=-2,   highlights=8),
    "sepia_to_full_color":   dict(temp=10,  tint=2,   contrast=1.05, sat=1.10, shadows=-2,   highlights=4),
}

# ── External LUTs ────────────────────────────────────────────────────────

_LUT_DIR_FALLBACKS = ["assets/luts"]


def get_lut_path(slug: str) -> Optional[Path]:
    """Find a .cube LUT for the given slug, or None."""
    for base in _LUT_DIR_FALLBACKS:
        p = Path(base) / f"{slug}.cube"
        if p.is_file():
            return p
    return None


def _load_cube_lut(path: Path) -> Optional[np.ndarray]:
    """Parse an Iridas .cube 3D LUT into a (N, N, N, 3) float32 array."""
    try:
        size: Optional[int] = None
        rgbs: list[list[float]] = []
        with open(path, "r") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                if line.upper().startswith("LUT_3D_SIZE"):
                    size = int(line.split()[-1])
                    continue
                if line.upper().startswith(("TITLE", "DOMAIN_MIN", "DOMAIN_MAX")):
                    continue
                parts = line.split()
                if len(parts) == 3:
                    rgbs.append([float(parts[0]), float(parts[1]), float(parts[2])])
        if size is None or len(rgbs) != size ** 3:
            return None
        arr = np.array(rgbs, dtype=np.float32).reshape(size, size, size, 3)
        return arr
    except Exception as e:  # pragma: no cover
        logger.warning("LUT parse failed for %s: %s", path, e)
        return None


def _apply_3d_lut(frame_bgr: np.ndarray, lut: np.ndarray) -> np.ndarray:
    """Trilinear-sample a (N,N,N,3) LUT against an HxWx3 BGR uint8 frame."""
    size = lut.shape[0]
    f = (frame_bgr.astype(np.float32) / 255.0) * (size - 1)
    i = np.clip(np.floor(f).astype(np.int32), 0, size - 1)
    out = lut[i[..., 2], i[..., 1], i[..., 0]]  # B,G,R indexed cube; .cube is RGB
    return np.clip(out * 255.0, 0, 255).astype(np.uint8)


# ── Procedural grades ────────────────────────────────────────────────────

def _procedural_grade(frame_bgr: np.ndarray, params: dict) -> np.ndarray:
    """Apply temp / tint / contrast / sat / shadow / highlight tweaks."""
    f = frame_bgr.astype(np.float32) / 255.0

    # Temp + tint via R/B and G modulation (close to a 2-D white balance grid).
    temp = params.get("temp", 0) / 100.0
    tint = params.get("tint", 0) / 100.0
    f[..., 2] = np.clip(f[..., 2] + temp * 0.5, 0, 1)   # R
    f[..., 0] = np.clip(f[..., 0] - temp * 0.5, 0, 1)   # B
    f[..., 1] = np.clip(f[..., 1] + tint * 0.5, 0, 1)   # G

    # Contrast
    contrast = params.get("contrast", 1.0)
    f = np.clip((f - 0.5) * contrast + 0.5, 0, 1)

    # Saturation via HSV
    sat = params.get("sat", 1.0)
    hsv = cv2.cvtColor((f * 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    f = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32) / 255.0

    # Shadows / highlights (simple two-zone lift)
    shadows = params.get("shadows", 0) / 100.0
    highlights = params.get("highlights", 0) / 100.0
    luma = 0.299 * f[..., 2] + 0.587 * f[..., 1] + 0.114 * f[..., 0]
    shadow_mask = (1.0 - luma) ** 2
    highlight_mask = luma ** 2
    f += shadows * shadow_mask[..., None] * 0.5
    f += highlights * highlight_mask[..., None] * 0.5

    return np.clip(f * 255.0, 0, 255).astype(np.uint8)


def apply_lut(frame_rgb: np.ndarray, slug: str) -> np.ndarray:
    """Apply the named grade to an RGB frame. Returns a new uint8 RGB array."""
    bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)

    cube_path = get_lut_path(slug)
    if cube_path is not None:
        lut = _load_cube_lut(cube_path)
        if lut is not None:
            graded_bgr = _apply_3d_lut(bgr, lut)
            return cv2.cvtColor(graded_bgr, cv2.COLOR_BGR2RGB)

    params = LUT_REGISTRY.get(slug) or LUT_REGISTRY["aces-default"]
    graded_bgr = _procedural_grade(bgr, params)
    return cv2.cvtColor(graded_bgr, cv2.COLOR_BGR2RGB)
