"""
depth.py — per-frame depth estimation via Depth-Anything-V2.

We use depth for two things in the breakout pipeline:
  • Parallax compositing — keep the breakout subject in front while the
    background blurs / pushes back.
  • Defocus DOF — gradient-based bokeh based on depth distance from a
    chosen focal plane.

Falls back to MiDaS (the previous-gen open-source depth model) if
Depth-Anything-V2 isn't available, then to a luminance-derived pseudo-
depth if no model loads.
"""
from __future__ import annotations

import logging
from typing import Literal, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

DepthBackend = Literal["depth-anything-v2", "midas", "fallback"]


def estimate_depth(
    frame: np.ndarray,
    backend: Optional[DepthBackend] = None,
    model_size: Literal["small", "base", "large"] = "small",
) -> np.ndarray:
    """Returns a (H, W) float32 depth map normalised to [0, 1]."""
    backend = backend or _choose_backend()
    if backend == "depth-anything-v2":
        try:
            return _depth_anything_v2(frame, model_size)
        except Exception as e:
            logger.warning("Depth-Anything-V2 failed (%s) — trying MiDaS", e)
    if backend in ("depth-anything-v2", "midas"):
        try:
            return _midas(frame)
        except Exception as e:
            logger.warning("MiDaS failed (%s) — using luminance pseudo-depth", e)
    return _luminance_pseudo_depth(frame)


def _choose_backend() -> DepthBackend:
    try:
        from transformers import pipeline                 # noqa: F401
        return "depth-anything-v2"
    except ImportError:
        return "fallback"


# ── Depth-Anything-V2 via transformers ───────────────────────────────────

_da_pipeline = None  # cached


def _depth_anything_v2(frame: np.ndarray, model_size: str) -> np.ndarray:
    global _da_pipeline
    if _da_pipeline is None:
        from transformers import pipeline
        repo = {
            "small": "depth-anything/Depth-Anything-V2-Small-hf",
            "base":  "depth-anything/Depth-Anything-V2-Base-hf",
            "large": "depth-anything/Depth-Anything-V2-Large-hf",
        }[model_size]
        _da_pipeline = pipeline(task="depth-estimation", model=repo)
    from PIL import Image
    pil = Image.fromarray(frame)
    result = _da_pipeline(pil)
    depth = np.array(result["depth"], dtype=np.float32)
    return _normalize(depth)


# ── MiDaS via torch hub ──────────────────────────────────────────────────

_midas_model = None
_midas_transform = None


def _midas(frame: np.ndarray) -> np.ndarray:
    global _midas_model, _midas_transform
    if _midas_model is None:
        import torch
        _midas_model = torch.hub.load("intel-isl/MiDaS", "DPT_Hybrid")
        _midas_model.eval()
        transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
        _midas_transform = transforms.dpt_transform
    import torch
    img = frame.astype(np.float32) / 255.0
    input_tensor = _midas_transform(img)
    with torch.no_grad():
        pred = _midas_model(input_tensor)
        pred = torch.nn.functional.interpolate(
            pred.unsqueeze(1), size=frame.shape[:2], mode="bicubic",
            align_corners=False,
        ).squeeze().numpy()
    return _normalize(pred)


# ── Pseudo-depth fallback ────────────────────────────────────────────────

def _luminance_pseudo_depth(frame: np.ndarray) -> np.ndarray:
    """Cheap luma-inverted depth — works as a placeholder, not accurate."""
    gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    return _normalize(1.0 - gray)


def _normalize(arr: np.ndarray) -> np.ndarray:
    a = arr.astype(np.float32)
    return (a - a.min()) / (a.ptp() + 1e-6)


# ── Depth-driven effects ─────────────────────────────────────────────────

def parallax_push(frame: np.ndarray, depth: np.ndarray, strength: float = 8.0) -> np.ndarray:
    """Shift far pixels horizontally based on depth — fake camera dolly."""
    h, w = frame.shape[:2]
    offset = (depth * strength).astype(np.float32)
    yy, xx = np.indices((h, w), dtype=np.float32)
    map_x = (xx + offset).astype(np.float32)
    map_y = yy.astype(np.float32)
    return cv2.remap(frame, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def defocus_dof(
    frame: np.ndarray,
    depth: np.ndarray,
    focal_plane: float = 0.4,
    blur_radius_px: int = 10,
) -> np.ndarray:
    """Selective blur away from the focal plane — fake bokeh."""
    blurred = cv2.GaussianBlur(frame, (blur_radius_px * 2 + 1, blur_radius_px * 2 + 1), 0)
    diff = np.abs(depth - focal_plane)
    weight = np.clip(diff * 1.6, 0, 1)[..., None]
    return (frame.astype(np.float32) * (1 - weight) + blurred.astype(np.float32) * weight).astype(np.uint8)
