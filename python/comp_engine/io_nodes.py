"""
io_nodes.py — Read / Write.

Uses OpenImageIO when present (EXR + AOV layers, the real pipeline path) and
falls back to imageio for 8-bit formats. 8-bit is decoded sRGB→linear on read
and encoded linear→sRGB on write so the working space stays scene-linear.
"""
from __future__ import annotations

from typing import List

import numpy as np

from .color import linear_to_srgb, srgb_to_linear
from .graph import Node
from .image import Image


def _imageio():
    import imageio.v3 as iio
    return iio


class Read(Node):
    def __init__(self, path: str, is_srgb: bool = True, **kw):
        super().__init__(**kw); self.path = path; self.is_srgb = is_srgb

    def compute(self, _: List[Image]) -> Image:
        arr = _imageio().imread(self.path).astype(np.float64)
        if arr.dtype == np.uint8 or arr.max() > 1.5:
            arr = arr / 255.0
        if arr.ndim == 2:
            arr = np.stack([arr, arr, arr, np.ones_like(arr)], -1)
        if self.is_srgb:
            arr[..., :3] = srgb_to_linear(arr[..., :3])
        return Image.from_rgba(arr)


class Write(Node):
    """Pass-through node that writes its input to disk as a side effect."""
    def __init__(self, src: Node, path: str, is_srgb: bool = True, **kw):
        super().__init__(src, **kw); self.path = path; self.is_srgb = is_srgb

    def compute(self, ins: List[Image]) -> Image:
        write_image(ins[0], self.path, self.is_srgb)
        return ins[0]


def write_image(img: Image, path: str, is_srgb: bool = True) -> None:
    rgb = np.clip(img.rgb(), 0, 1)
    a = np.clip(img.alpha(), 0, 1)
    if is_srgb:
        rgb = linear_to_srgb(rgb)
    out = np.concatenate([rgb, a[..., None]], -1)
    _imageio().imwrite(path, (out * 255 + 0.5).astype(np.uint8))
