"""
lightning.py — procedural branching lightning bolts.

Random-midpoint displacement algorithm: start with a straight line from
A → B, subdivide repeatedly and randomly displace each midpoint
perpendicular to the segment. Recurse until each segment is short.
Branches spawn off main segments with probability `branch_prob`.

Rendered with a wide cyan/purple glow under a bright white core for the
"plasma arc" templates (lightning arc, oscilloscope wave).
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np


@dataclass
class _Segment:
    p0: tuple[float, float]
    p1: tuple[float, float]
    width: float
    age: int = 0


@dataclass
class LightningBolt:
    start: tuple[int, int]
    end: tuple[int, int]
    canvas_size: tuple[int, int]
    seed: int = 42
    detail: int = 6                     # subdivision depth
    displacement_decay: float = 0.55
    branch_prob: float = 0.18
    glow_color: tuple[int, int, int] = (255, 180, 200)   # BGR
    core_color: tuple[int, int, int] = (255, 255, 255)
    main_width: float = 2.5
    lifespan: int = 6

    segments: list[_Segment] = field(default_factory=list, init=False)

    def __post_init__(self) -> None:
        rng = random.Random(self.seed)
        self._build([self.start[0], self.start[1]], [self.end[0], self.end[1]], rng,
                    displacement=max(self.canvas_size) * 0.12,
                    depth=self.detail, width=self.main_width)

    def _build(self, p0, p1, rng: random.Random, displacement: float, depth: int, width: float):
        if depth == 0 or displacement < 1:
            self.segments.append(_Segment(tuple(p0), tuple(p1), width))
            return
        mx = (p0[0] + p1[0]) / 2
        my = (p0[1] + p1[1]) / 2
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        length = math.hypot(dx, dy)
        if length < 1:
            self.segments.append(_Segment(tuple(p0), tuple(p1), width))
            return
        # Perpendicular displacement
        nx, ny = -dy / length, dx / length
        offset = (rng.random() - 0.5) * displacement
        mid = [mx + nx * offset, my + ny * offset]
        # Recurse on both halves
        self._build(p0, mid, rng, displacement * self.displacement_decay, depth - 1, width)
        self._build(mid, p1, rng, displacement * self.displacement_decay, depth - 1, width)
        # Optional branch from midpoint
        if rng.random() < self.branch_prob and depth > 1:
            angle = math.atan2(p1[1] - p0[1], p1[0] - p0[0]) + (rng.random() - 0.5) * 1.4
            branch_len = length * 0.45 * rng.uniform(0.4, 1.0)
            bx = mid[0] + math.cos(angle) * branch_len
            by = mid[1] + math.sin(angle) * branch_len
            self._build(mid, [bx, by], rng,
                        displacement * self.displacement_decay,
                        depth - 1, width * 0.65)

    def render(self, frame: np.ndarray, intensity: float) -> np.ndarray:
        if intensity <= 0:
            return frame
        h, w = frame.shape[:2]
        glow = np.zeros_like(frame)
        core = np.zeros_like(frame)
        for seg in self.segments:
            p0 = (int(seg.p0[0]), int(seg.p0[1]))
            p1 = (int(seg.p1[0]), int(seg.p1[1]))
            cv2.line(glow, p0, p1, self.glow_color, int(seg.width * 4) + 4, cv2.LINE_AA)
            cv2.line(core, p0, p1, self.core_color, int(seg.width) + 1, cv2.LINE_AA)
        glow = cv2.GaussianBlur(glow, (0, 0), 6 * intensity)
        out = cv2.addWeighted(frame, 1.0, glow, 0.75 * intensity, 0)
        out = cv2.addWeighted(out, 1.0, core, 0.95 * intensity, 0)
        return out


def render_lightning_overlay(
    frames: np.ndarray,
    breakout_frame: int,
    duration_frames: int = 6,
    start_frac: tuple[float, float] = (0.5, 0.5),
    end_frac: tuple[float, float] = (0.95, 0.85),
    glow_color: tuple[int, int, int] = (255, 180, 200),
    seed: int = 42,
) -> np.ndarray:
    h, w = frames.shape[1:3]
    start = (int(w * start_frac[0]), int(h * start_frac[1]))
    end = (int(w * end_frac[0]), int(h * end_frac[1]))
    out = frames.copy()
    bolt: Optional[LightningBolt] = None
    for i in range(frames.shape[0]):
        rel = i - breakout_frame
        if rel < 0 or rel > duration_frames:
            continue
        # Re-roll the bolt each frame so it flickers (lightning is staccato).
        bolt = LightningBolt(start=start, end=end, canvas_size=(h, w),
                             seed=seed + i, glow_color=glow_color)
        intensity = math.exp(-rel / 4.0)
        out[i] = bolt.render(out[i], float(intensity))
    return out
