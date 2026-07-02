"""
interpolate.py — frame interpolation to bump generated 24 fps content up
to 60 fps for premium playback.

Three backends, picked in order:
  1. RIFE (rife-ncnn-vulkan binary) — fastest, requires the binary on PATH.
  2. FILM (Google's Frame Interpolation for Large Motion) via tensorflow.
  3. opencv-bicubic — fallback that doesn't add real interpolated frames
     but at least re-times the video.

Real-time use: backend #1 on a 4090 runs ~120fps at 1080p.
"""
from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def interpolate_video(
    frames: np.ndarray,
    src_fps: int,
    target_fps: int,
    backend: Optional[str] = None,
) -> np.ndarray:
    """Up-sample `frames` from `src_fps` to `target_fps`.

    Returns the resulting frame array. If target ≤ src, returns input.
    """
    if target_fps <= src_fps:
        return frames

    backend = backend or _choose_backend()
    logger.info("interpolating %d→%dfps via %s", src_fps, target_fps, backend)

    if backend == "rife":
        return _rife_interpolate(frames, src_fps, target_fps)
    if backend == "film":
        try:
            return _film_interpolate(frames, src_fps, target_fps)
        except Exception as e:
            logger.warning("FILM failed (%s) — falling back to opencv blend", e)
    return _opencv_blend(frames, src_fps, target_fps)


def _choose_backend() -> str:
    if shutil.which("rife-ncnn-vulkan"):
        return "rife"
    try:
        import tensorflow                  # noqa: F401
        return "film"
    except ImportError:
        return "opencv"


# ── RIFE binary ──────────────────────────────────────────────────────────

def _rife_interpolate(frames: np.ndarray, src_fps: int, target_fps: int) -> np.ndarray:
    """Use the standalone rife-ncnn-vulkan binary via temp PNG sequence."""
    with tempfile.TemporaryDirectory() as td:
        td_p = Path(td)
        in_dir = td_p / "in"
        out_dir = td_p / "out"
        in_dir.mkdir()
        out_dir.mkdir()
        # Write inputs
        for i, f in enumerate(frames):
            cv2.imwrite(str(in_dir / f"{i:06d}.png"), cv2.cvtColor(f, cv2.COLOR_RGB2BGR))
        # rife-ncnn-vulkan flag is -f for "make N frames between each pair"
        factor = max(1, target_fps // src_fps)
        n_out = (frames.shape[0] - 1) * factor + 1
        cmd = [
            "rife-ncnn-vulkan",
            "-i", str(in_dir),
            "-o", str(out_dir),
            "-n", str(n_out),
        ]
        try:
            subprocess.check_call(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError as e:
            logger.warning("rife failed: %s — falling back to opencv blend", e)
            return _opencv_blend(frames, src_fps, target_fps)
        # Read outputs
        files = sorted(out_dir.glob("*.png"))
        out = np.stack(
            [cv2.cvtColor(cv2.imread(str(p)), cv2.COLOR_BGR2RGB) for p in files],
            axis=0,
        )
        return out


# ── FILM (tensorflow) ────────────────────────────────────────────────────

def _film_interpolate(frames: np.ndarray, src_fps: int, target_fps: int) -> np.ndarray:
    """FILM via tensorflow_hub. Heavyweight import — only used when chosen."""
    import tensorflow as tf
    import tensorflow_hub as hub

    factor = max(1, target_fps // src_fps)
    model = hub.load("https://tfhub.dev/google/film/1")

    def _interp(a, b, t):
        ta = tf.cast(a, tf.float32) / 255.0
        tb = tf.cast(b, tf.float32) / 255.0
        result = model(dict(x0=ta[None], x1=tb[None], time=tf.constant([[t]], dtype=tf.float32)))
        img = result["image"][0].numpy()
        return np.clip(img * 255, 0, 255).astype(np.uint8)

    out = [frames[0]]
    for i in range(frames.shape[0] - 1):
        a, b = frames[i], frames[i + 1]
        for k in range(1, factor):
            out.append(_interp(a, b, k / factor))
        out.append(b)
    return np.stack(out, axis=0)


# ── OpenCV blend fallback ────────────────────────────────────────────────

def _opencv_blend(frames: np.ndarray, src_fps: int, target_fps: int) -> np.ndarray:
    """Linear cross-fade between source frames. Cheap, won't reduce judder."""
    factor = max(1, target_fps // src_fps)
    if factor == 1:
        return frames
    out = []
    for i in range(frames.shape[0] - 1):
        a, b = frames[i].astype(np.float32), frames[i + 1].astype(np.float32)
        for k in range(factor):
            t = k / factor
            out.append((a * (1 - t) + b * t).astype(np.uint8))
    out.append(frames[-1])
    return np.stack(out, axis=0)
