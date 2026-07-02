"""
paint.py — viscous paint / cheese / gold / ink pour overlay.

Algorithm:
  • Maintain a 2D density field.
  • At the breakout frame, deposit a high-density blob at the source
    point (centered near the chrome edge).
  • Each frame: apply a velocity field biased downward + slight outward,
    then advect the density.
  • Render the density as colored translucent paint with a darker rim.

Cheap, robust, looks correct for viscous flows up to 60 fps.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import cv2
import numpy as np


@dataclass
class PaintPour:
    canvas_size: tuple[int, int]            # (h, w)
    grid_resolution: int = 96               # cols (rows computed from aspect)
    color: tuple[int, int, int] = (60, 60, 60)  # BGR — black ink default
    rim_color: tuple[int, int, int] = (20, 20, 20)
    viscosity: float = 0.92                  # higher = thicker
    gravity_px_per_step: float = 0.6
    spread: float = 0.04
    deposit_strength: float = 5.0

    _density: np.ndarray = field(default_factory=lambda: np.zeros((0,)), init=False)

    def __post_init__(self) -> None:
        h, w = self.canvas_size
        cols = self.grid_resolution
        rows = int(round(cols * h / w))
        self._density = np.zeros((rows, cols), dtype=np.float32)

    def deposit(self, x_frac: float = 0.5, y_frac: float = 0.35, radius_frac: float = 0.06) -> None:
        rows, cols = self._density.shape
        cx, cy = int(cols * x_frac), int(rows * y_frac)
        r = max(2, int(cols * radius_frac))
        yy, xx = np.indices(self._density.shape)
        mask = (xx - cx) ** 2 + (yy - cy) ** 2 <= r ** 2
        self._density[mask] += self.deposit_strength

    def step(self) -> None:
        # Soft-blur (advect-diffuse approximation)
        blurred = cv2.GaussianBlur(self._density, (5, 5), 1.0)
        # Gravity: shift down by 1 row sometimes
        shifted = np.zeros_like(blurred)
        shifted[1:] = blurred[:-1]
        # Mix: keep most weight in place (viscosity), some flows down
        self._density = (
            blurred * self.viscosity +
            shifted * (1.0 - self.viscosity)
        )
        # Outward bleed
        self._density = cv2.GaussianBlur(self._density, (3, 3), self.spread)

    def render(self, frame: np.ndarray, intensity: float = 1.0) -> np.ndarray:
        if intensity <= 0:
            return frame
        h, w = frame.shape[:2]
        d = cv2.resize(self._density, (w, h), interpolation=cv2.INTER_LINEAR)
        d_norm = np.clip(d * 0.18, 0, 1)
        # Rim (where the density has a hard edge)
        edge = cv2.Sobel(d_norm.astype(np.float32), cv2.CV_32F, 1, 1, ksize=3)
        edge = np.clip(np.abs(edge) * 2.0, 0, 1)

        body_layer = np.zeros_like(frame)
        body_layer[:] = self.color
        rim_layer = np.zeros_like(frame)
        rim_layer[:] = self.rim_color

        # Blend: body where density is high, rim along edges
        body_alpha = (d_norm * intensity)[..., None]
        rim_alpha = (edge * 0.6 * intensity)[..., None]
        out = frame.astype(np.float32) * (1 - body_alpha) + body_layer.astype(np.float32) * body_alpha
        out = out * (1 - rim_alpha) + rim_layer.astype(np.float32) * rim_alpha
        return np.clip(out, 0, 255).astype(np.uint8)


def render_paint_overlay(
    frames: np.ndarray,
    breakout_frame: int,
    duration_frames: int = 50,
    color: tuple[int, int, int] = (60, 60, 60),
    rim_color: tuple[int, int, int] = (20, 20, 20),
    viscosity: float = 0.92,
) -> np.ndarray:
    """Add a viscous-paint pour effect starting at the breakout frame."""
    h, w = frames.shape[1:3]
    pour = PaintPour(
        canvas_size=(h, w),
        color=color,
        rim_color=rim_color,
        viscosity=viscosity,
    )
    out = frames.copy()
    for i in range(frames.shape[0]):
        rel = i - breakout_frame
        if rel < 0 or rel > duration_frames:
            continue
        if rel == 0 or rel == 5:
            pour.deposit()
        pour.step()
        intensity = math.tanh(rel / 8) * 1.2
        out[i] = pour.render(out[i], float(min(1.0, intensity)))
    return out
