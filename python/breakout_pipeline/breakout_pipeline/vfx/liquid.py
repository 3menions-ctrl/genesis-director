"""
liquid.py — fluid breach overlay for water/wave/energy-drink templates.

A grid-based shallow-water approximation: we run a tiny 2D height map
simulation (h, u, v) over a few hundred cells, then render the height
map as a translucent layer with refraction-style displacement of the
underlying frame.

Computationally cheap (≤ 5 ms / frame at 64×96 grid). Visually convincing
for the "wave bursts out of the screen" templates because the diffusion
model produces the source water; this layer adds the displacement and
specular highlights the AI tends to miss.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import cv2
import numpy as np


@dataclass
class LiquidBurst:
    canvas_size: tuple[int, int]           # (h, w)
    grid_size: tuple[int, int] = (96, 64)  # (cols, rows)
    impulse_strength: float = 6.0
    impulse_radius_frac: float = 0.12      # fraction of grid width
    damping: float = 0.985
    propagation: float = 0.35
    refraction_strength_px: float = 18.0
    highlight_strength: float = 0.55
    tint: tuple[int, int, int] = (40, 110, 200)  # BGR for water; (200,80,240) for neon drink

    _h: np.ndarray = field(default_factory=lambda: np.zeros((0,)), init=False)
    _u: np.ndarray = field(default_factory=lambda: np.zeros((0,)), init=False)
    _v: np.ndarray = field(default_factory=lambda: np.zeros((0,)), init=False)

    def __post_init__(self) -> None:
        cols, rows = self.grid_size
        self._h = np.zeros((rows, cols), dtype=np.float32)
        self._u = np.zeros((rows, cols), dtype=np.float32)
        self._v = np.zeros((rows, cols), dtype=np.float32)

    def impulse(self, x_frac: float = 0.5, y_frac: float = 0.5) -> None:
        """Drop a circular height impulse at the given grid location."""
        cols, rows = self.grid_size
        cx = int(cols * x_frac)
        cy = int(rows * y_frac)
        r = int(max(cols, rows) * self.impulse_radius_frac)
        yy, xx = np.indices(self._h.shape)
        mask = (xx - cx) ** 2 + (yy - cy) ** 2 <= r ** 2
        self._h[mask] += self.impulse_strength

    def step(self) -> None:
        """One simulation step. Uses a 2D second-order spatial Laplacian."""
        lap = (
            np.roll(self._h, 1, axis=0) + np.roll(self._h, -1, axis=0) +
            np.roll(self._h, 1, axis=1) + np.roll(self._h, -1, axis=1)
            - 4 * self._h
        )
        self._u += lap * self.propagation
        self._u *= self.damping
        self._h += self._u

    def render(self, frame: np.ndarray, intensity: float = 1.0) -> np.ndarray:
        """Composite the simulation as a refracted+tinted overlay.

        `intensity` 0..1 scales the displacement + tint to fade the
        effect in/out at the start of the breakout window.
        """
        if intensity <= 0:
            return frame
        h, w = frame.shape[:2]
        # Resize height map to frame
        height = cv2.resize(self._h, (w, h), interpolation=cv2.INTER_LINEAR)

        # Compute gradients = refraction offsets
        gx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3) * self.refraction_strength_px * intensity
        gy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3) * self.refraction_strength_px * intensity

        # Build remap arrays
        yy, xx = np.indices((h, w), dtype=np.float32)
        map_x = (xx + gx).astype(np.float32)
        map_y = (yy + gy).astype(np.float32)
        warped = cv2.remap(frame, map_x, map_y, interpolation=cv2.INTER_LINEAR,
                           borderMode=cv2.BORDER_REPLICATE)

        # Specular highlight: where the gradient magnitude is high, brighten
        spec = np.sqrt(gx * gx + gy * gy)
        spec = cv2.normalize(spec, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        spec_alpha = (spec.astype(np.float32) / 255.0) * self.highlight_strength * intensity

        # Tint where there's any displacement
        tint_layer = np.zeros_like(frame)
        tint_layer[:] = self.tint
        tint_mask = np.clip(np.abs(height) * 0.05, 0, 1)[..., None]
        result = warped.astype(np.float32) * (1 - tint_mask * 0.45 * intensity) + \
                 tint_layer.astype(np.float32) * (tint_mask * 0.45 * intensity)
        result = result + spec_alpha[..., None] * 255.0
        return np.clip(result, 0, 255).astype(np.uint8)


def render_liquid_overlay(
    frames: np.ndarray,
    breakout_frame: int,
    duration_frames: int = 30,
    tint: tuple[int, int, int] = (40, 110, 200),
    impulse_strength: float = 6.0,
) -> np.ndarray:
    """Add a wave-breach overlay starting at the breakout frame."""
    h, w = frames.shape[1:3]
    burst = LiquidBurst(canvas_size=(h, w), tint=tint, impulse_strength=impulse_strength)
    out = frames.copy()
    for i in range(frames.shape[0]):
        rel = i - breakout_frame
        if rel < 0 or rel > duration_frames:
            continue
        if rel == 0:
            burst.impulse()
        elif rel == int(duration_frames * 0.25):
            burst.impulse(x_frac=0.3, y_frac=0.65)
        burst.step()
        intensity = math.sin(min(1.0, rel / duration_frames) * math.pi) * 1.1
        out[i] = burst.render(out[i], float(max(0, intensity)))
    return out
