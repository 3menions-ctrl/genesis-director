"""
recipes.py — the breakthrough compositing template, wired from the node library,
plus a synthetic demo scene so the engine can render a real frame with no assets.

This is the "our Nuke" graph for the breakthrough shot: the matted subject is
light-wrapped against the environment, merged over the beauty, then finished with
depth-driven defocus, vector motion-blur, glow, a grade and film grain — the
exact comp that makes the composite read as one photographed image.
"""
from __future__ import annotations

from typing import List

import numpy as np

from .graph import Node
from .image import Image
from .nodes import (
    Defocus, Grade, Grain, Glow, LightWrap, Merge, MotionBlur,
)


class Source(Node):
    """Wrap a fixed Image as a graph input (readers, generators, tests)."""
    def __init__(self, img: Image, **kw):
        super().__init__(**kw); self._img = img

    def compute(self, _: List[Image]) -> Image:
        return self._img


def breakthrough_comp(
    beauty: Node,
    subject: Node,
    *,
    focus: float = 0.2,
    max_blur: float = 14.0,
    aperture: float = 1.4,
    mblur_samples: int = 9,
    shutter: float = 1.0,
    lightwrap_size: float = 16.0,
    lightwrap_intensity: float = 0.9,
    glow_threshold: float = 0.75,
    glow_size: float = 18.0,
    glow_gain: float = 0.8,
    grade_gain=(1.05, 1.0, 0.96),
    grade_gamma=0.95,
    grain: float = 0.018,
    seed: int = 7,
) -> Node:
    """beauty carries Z + motion AOVs; subject is matted RGBA. → final comp node."""
    wrapped = LightWrap(beauty, subject, size=lightwrap_size, intensity=lightwrap_intensity)
    merged = Merge(wrapped, beauty, operation="over")
    dof = Defocus(merged, depth="Z", focus=focus, max_blur=max_blur, aperture=aperture)
    mb = MotionBlur(dof, samples=mblur_samples, shutter=shutter)
    glow = Glow(mb, threshold=glow_threshold, size=glow_size, gain=glow_gain)
    graded = Grade(glow, gain=grade_gain, gamma=grade_gamma)
    return Grain(graded, intensity=grain, seed=seed)


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic demo scene — proves the comp end-to-end with zero assets.
# ─────────────────────────────────────────────────────────────────────────────
def make_demo(width: int = 640, height: int = 800) -> Node:
    h, w = height, width
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    ny, nx = ys / h, xs / w

    # beauty: a graded environment + a depth ramp (top=far) + horizontal motion
    beauty = Image.black(w, h, names=("R", "G", "B", "A", "Z", "motion.x", "motion.y"))
    beauty.channels["R"] = (0.05 + 0.25 * ny).astype(np.float32)
    beauty.channels["G"] = (0.08 + 0.18 * ny).astype(np.float32)
    beauty.channels["B"] = (0.18 + 0.30 * (1 - ny)).astype(np.float32)
    beauty.channels["A"] = np.ones((h, w), np.float32)
    beauty.channels["Z"] = ny.astype(np.float32)           # 0 near (bottom-ish) → 1 far (top)
    beauty.channels["motion.x"] = (6.0 * (1 - ny)).astype(np.float32)  # background drift
    beauty.channels["motion.y"] = np.zeros((h, w), np.float32)

    # subject: a bright disc (the emergent "character") with soft alpha, in focus
    cx, cy, r = w * 0.5, h * 0.6, h * 0.16
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    alpha = np.clip(1.0 - (d - r) / 12.0, 0, 1).astype(np.float32)
    subj = Image.black(w, h, names=("R", "G", "B", "A", "Z", "motion.x", "motion.y"))
    subj.channels["R"] = (0.9 * alpha).astype(np.float32)
    subj.channels["G"] = (0.55 * alpha).astype(np.float32)
    subj.channels["B"] = (1.0 * alpha).astype(np.float32)
    subj.channels["A"] = alpha
    subj.channels["Z"] = np.full((h, w), 0.2, np.float32)             # near focus plane
    subj.channels["motion.x"] = (22.0 * alpha).astype(np.float32)     # fast subject → smear
    subj.channels["motion.y"] = np.zeros((h, w), np.float32)

    return breakthrough_comp(Source(beauty), Source(subj), focus=0.2, max_blur=16.0)
