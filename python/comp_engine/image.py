"""
image.py — the compositor's image model.

A multi-channel, scene-linear, float32 image: named channel planes so arbitrary
render AOVs (Z, N.x, motion.x, P.x, cryptomatte…) are first-class alongside
RGBA — exactly how Nuke models channels/layers. Everything downstream operates
on `Image`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Tuple

import numpy as np

RGBA = ("R", "G", "B", "A")


@dataclass
class Image:
    width: int
    height: int
    channels: Dict[str, np.ndarray] = field(default_factory=dict)

    # ── construction ──────────────────────────────────────────────────────
    @classmethod
    def black(cls, width: int, height: int, names: Iterable[str] = RGBA) -> "Image":
        ch = {n: np.zeros((height, width), np.float32) for n in names}
        return cls(width, height, ch)

    @classmethod
    def from_rgba(cls, arr: np.ndarray) -> "Image":
        """arr: (H,W,4) or (H,W,3) float."""
        h, w = arr.shape[:2]
        img = cls.black(w, h)
        img.channels["R"] = arr[..., 0].astype(np.float32)
        img.channels["G"] = arr[..., 1].astype(np.float32)
        img.channels["B"] = arr[..., 2].astype(np.float32)
        img.channels["A"] = (arr[..., 3] if arr.shape[2] > 3
                             else np.ones((h, w))).astype(np.float32)
        return img

    # ── access ────────────────────────────────────────────────────────────
    def has(self, name: str) -> bool:
        return name in self.channels

    def get(self, name: str, default: float = 0.0) -> np.ndarray:
        if name in self.channels:
            return self.channels[name]
        return np.full((self.height, self.width), default, np.float32)

    def set(self, name: str, arr: np.ndarray) -> None:
        self.channels[name] = arr.astype(np.float32)

    def rgb(self) -> np.ndarray:
        return np.stack([self.get("R"), self.get("G"), self.get("B")], axis=-1)

    def alpha(self) -> np.ndarray:
        return self.get("A", 1.0)

    def rgba(self) -> np.ndarray:
        return np.concatenate([self.rgb(), self.alpha()[..., None]], axis=-1)

    # ── functional helpers (never mutate inputs in nodes) ─────────────────
    def copy(self) -> "Image":
        return Image(self.width, self.height, {k: v.copy() for k, v in self.channels.items()})

    def with_rgb(self, rgb: np.ndarray) -> "Image":
        out = self.copy()
        out.channels["R"] = rgb[..., 0].astype(np.float32)
        out.channels["G"] = rgb[..., 1].astype(np.float32)
        out.channels["B"] = rgb[..., 2].astype(np.float32)
        return out

    def with_rgba(self, rgb: np.ndarray, a: np.ndarray) -> "Image":
        out = self.with_rgb(rgb)
        out.channels["A"] = a.astype(np.float32)
        return out

    def aov_names(self) -> List[str]:
        return [k for k in self.channels if k not in RGBA]
