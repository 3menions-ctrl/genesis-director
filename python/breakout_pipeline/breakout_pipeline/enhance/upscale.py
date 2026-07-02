"""
upscale.py — Real-ESRGAN 4× upscaling for the final pass.

Two backends in order:
  1. realesrgan_ncnn_vulkan binary (Tencent) — by far the fastest.
  2. PyTorch RealESRGAN via the realesrgan package.

Falls back to bicubic if neither available.
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


def upscale_video(
    frames: np.ndarray,
    factor: int = 2,
    model: str = "realesrgan-x4plus",
    backend: Optional[str] = None,
) -> np.ndarray:
    if factor <= 1:
        return frames
    backend = backend or _choose_backend()
    logger.info("upscaling %dx via %s (target %dx)", factor, backend, factor)

    if backend == "ncnn":
        return _ncnn_upscale(frames, factor, model)
    if backend == "torch":
        try:
            return _torch_upscale(frames, factor, model)
        except Exception as e:
            logger.warning("RealESRGAN torch failed (%s) — bicubic fallback", e)
    return _bicubic(frames, factor)


def _choose_backend() -> str:
    if shutil.which("realesrgan-ncnn-vulkan"):
        return "ncnn"
    try:
        import realesrgan                       # noqa: F401
        return "torch"
    except ImportError:
        return "bicubic"


def _ncnn_upscale(frames: np.ndarray, factor: int, model: str) -> np.ndarray:
    with tempfile.TemporaryDirectory() as td:
        td_p = Path(td)
        in_dir = td_p / "in"
        out_dir = td_p / "out"
        in_dir.mkdir()
        out_dir.mkdir()
        for i, f in enumerate(frames):
            cv2.imwrite(str(in_dir / f"{i:06d}.png"), cv2.cvtColor(f, cv2.COLOR_RGB2BGR))
        # ncnn binary supports -s 2/3/4 and -n <model>
        scale = min(4, factor)
        cmd = [
            "realesrgan-ncnn-vulkan",
            "-i", str(in_dir),
            "-o", str(out_dir),
            "-s", str(scale),
            "-n", model,
        ]
        try:
            subprocess.check_call(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError as e:
            logger.warning("ncnn upscale failed: %s — bicubic fallback", e)
            return _bicubic(frames, factor)
        files = sorted(out_dir.glob("*.png"))
        return np.stack(
            [cv2.cvtColor(cv2.imread(str(p)), cv2.COLOR_BGR2RGB) for p in files],
            axis=0,
        )


def _torch_upscale(frames: np.ndarray, factor: int, model: str) -> np.ndarray:
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet
    import torch

    scale = min(4, factor)
    net = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=scale)
    upsampler = RealESRGANer(
        scale=scale,
        model_path=f"weights/{model}.pth",
        model=net,
        tile=512, tile_pad=32, pre_pad=0,
        half=torch.cuda.is_available(),
        device="cuda" if torch.cuda.is_available() else "cpu",
    )
    out = []
    for f in frames:
        bgr = cv2.cvtColor(f, cv2.COLOR_RGB2BGR)
        sr, _ = upsampler.enhance(bgr, outscale=scale)
        out.append(cv2.cvtColor(sr, cv2.COLOR_BGR2RGB))
    return np.stack(out, axis=0)


def _bicubic(frames: np.ndarray, factor: int) -> np.ndarray:
    h, w = frames.shape[1:3]
    new_h, new_w = h * factor, w * factor
    return np.stack(
        [cv2.resize(f, (new_w, new_h), interpolation=cv2.INTER_CUBIC) for f in frames],
        axis=0,
    )
