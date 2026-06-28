"""
smoke.py — volumetric smoke / fog / vapor / steam overlay.

Uses a Perlin-noise-driven density field, scrolled across the frame to
simulate slow turbulent rolling. Two presets bundled:

  • 'tire'  — orange-tinged thick smoke for The Automotive Burnout
  • 'steam' — bright translucent vapor for The Chef's Feast Spill
  • 'fog'   — generic cool gray-blue
  • 'tornado' — tight rotational density column

Cheap pseudo-3D look that holds up over 1080p output.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

import cv2
import numpy as np


SmokeKind = Literal["tire", "steam", "fog", "tornado"]


@dataclass
class VolumetricSmoke:
    canvas_size: tuple[int, int]           # (h, w)
    kind: SmokeKind = "fog"
    seed: int = 42
    # Visuals tuned by kind in __post_init__
    color: tuple[int, int, int] = (210, 210, 210)
    coverage: float = 0.6                   # peak alpha
    scroll_speed: tuple[float, float] = (0.4, 0.6)  # px/frame in normalised space
    octaves: int = 3

    _noise_field: np.ndarray = field(default_factory=lambda: np.zeros((0,)), init=False)
    _offset: np.ndarray = field(default_factory=lambda: np.zeros((2,)), init=False)

    def __post_init__(self) -> None:
        if self.kind == "tire":
            self.color = (60, 80, 235)        # BGR — orange smoke
            self.coverage = 0.78
            self.scroll_speed = (0.0, -0.8)
        elif self.kind == "steam":
            self.color = (240, 240, 240)
            self.coverage = 0.55
            self.scroll_speed = (0.1, -1.0)
        elif self.kind == "tornado":
            self.color = (180, 180, 175)
            self.coverage = 0.85
            self.scroll_speed = (0.0, 0.0)    # rotational handled below
        self._build_noise()

    def _build_noise(self) -> None:
        rng = np.random.default_rng(self.seed)
        h, w = self.canvas_size
        # We multi-octave with low-res noise + bilinear upscale
        layers = []
        for o in range(self.octaves):
            scale = 8 * (2 ** o)
            low = rng.uniform(0, 1, (max(1, h // scale), max(1, w // scale))).astype(np.float32)
            full = cv2.resize(low, (w, h), interpolation=cv2.INTER_CUBIC)
            layers.append(full / (2 ** o))
        self._noise_field = sum(layers)
        self._noise_field = (self._noise_field - self._noise_field.min()) / (
            self._noise_field.ptp() + 1e-6
        )

    def step(self, frame_idx: int) -> None:
        self._offset[0] = (self._offset[0] + self.scroll_speed[0]) % self.canvas_size[1]
        self._offset[1] = (self._offset[1] + self.scroll_speed[1]) % self.canvas_size[0]

    def render(self, frame: np.ndarray, intensity: float = 1.0) -> np.ndarray:
        if intensity <= 0:
            return frame
        h, w = frame.shape[:2]
        # Scroll
        ox, oy = int(self._offset[0]), int(self._offset[1])
        scrolled = np.roll(self._noise_field, (oy, ox), axis=(0, 1))

        if self.kind == "tornado":
            scrolled = self._make_tornado_column(scrolled)

        alpha = np.clip(scrolled * self.coverage * intensity, 0, 1)[..., None]
        smoke_layer = np.zeros_like(frame)
        smoke_layer[:] = self.color
        out = frame.astype(np.float32) * (1 - alpha) + smoke_layer.astype(np.float32) * alpha
        return np.clip(out, 0, 255).astype(np.uint8)

    def _make_tornado_column(self, noise: np.ndarray) -> np.ndarray:
        h, w = noise.shape
        cx = w // 2
        # Distance from center column, normalised
        xs = np.arange(w)[None, :] - cx
        dist = np.abs(xs) / (w * 0.18)
        weight = np.clip(1.0 - dist, 0, 1) ** 2
        return noise * weight


def render_smoke_overlay(
    frames: np.ndarray,
    breakout_frame: int,
    duration_frames: int = 60,
    kind: SmokeKind = "fog",
    seed: int = 42,
) -> np.ndarray:
    h, w = frames.shape[1:3]
    sim = VolumetricSmoke(canvas_size=(h, w), kind=kind, seed=seed)
    out = frames.copy()
    for i in range(frames.shape[0]):
        rel = i - breakout_frame
        if rel < 0 or rel > duration_frames:
            continue
        intensity = math.sin(min(1.0, rel / duration_frames) * math.pi) * 1.05
        out[i] = sim.render(out[i], float(max(0, intensity)))
        sim.step(i)
    return out
