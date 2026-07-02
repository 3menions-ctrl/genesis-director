"""
particles.py — debris and sparkle particles flying outward from the
breakout impact. Pure numpy + cv2 — no physics engine needed for the
volumes we're shipping (≤ 1500 particles per frame).

Three particle types, each with its own appearance + lifecycle:
  • 'spark'   : single bright pixels with motion-blur tails
  • 'shard'   : tiny triangles that tumble and shrink
  • 'dust'    : low-alpha blurred circles drifting with mild drag

Useful for: glass breaks, sneaker landings, anything explosive.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

import cv2
import numpy as np


ParticleKind = Literal["spark", "shard", "dust"]


@dataclass
class _Particle:
    pos: np.ndarray         # (2,) x, y
    vel: np.ndarray         # (2,)
    color: tuple[int, int, int]
    size: float
    lifespan: float         # in frames
    age: float = 0.0
    angle: float = 0.0
    angular_vel: float = 0.0
    kind: ParticleKind = "spark"


@dataclass
class ParticleField:
    canvas_size: tuple[int, int]
    origin: tuple[int, int]              # (cy, cx)
    n_particles: int = 280
    seed: int = 42
    spread_angle_deg: float = 360.0
    cone_center_deg: float = 0.0
    speed_range: tuple[float, float] = (6.0, 22.0)
    lifespan_range: tuple[int, int] = (12, 36)
    color_palette: tuple[tuple[int, int, int], ...] = (
        (255, 255, 255), (240, 240, 255), (200, 200, 220),
    )
    gravity: float = 0.6                  # px/frame²
    drag: float = 0.98                    # multiplicative per frame
    mix: tuple[float, float, float] = (0.55, 0.30, 0.15)  # spark / shard / dust ratio

    particles: list[_Particle] = field(default_factory=list, init=False)

    def __post_init__(self) -> None:
        self._spawn()

    def _spawn(self) -> None:
        rng = np.random.default_rng(self.seed)
        cy, cx = self.origin
        center_rad = math.radians(self.cone_center_deg)
        spread = math.radians(self.spread_angle_deg) / 2

        for i in range(self.n_particles):
            angle = rng.uniform(center_rad - spread, center_rad + spread)
            speed = rng.uniform(*self.speed_range)
            vx, vy = math.cos(angle) * speed, math.sin(angle) * speed
            kind_roll = rng.uniform()
            if kind_roll < self.mix[0]:
                kind, size = "spark", float(rng.uniform(0.8, 1.6))
            elif kind_roll < self.mix[0] + self.mix[1]:
                kind, size = "shard", float(rng.uniform(2.0, 4.5))
            else:
                kind, size = "dust", float(rng.uniform(3.0, 8.0))
            color = self.color_palette[int(rng.integers(0, len(self.color_palette)))]
            self.particles.append(_Particle(
                pos=np.array([cx, cy], dtype=np.float32),
                vel=np.array([vx, vy], dtype=np.float32),
                color=color,
                size=size,
                lifespan=float(rng.integers(*self.lifespan_range)),
                angle=float(rng.uniform(0, 2 * math.pi)),
                angular_vel=float(rng.normal(0, 0.18)),
                kind=kind,
            ))

    def step(self) -> None:
        gv = np.array([0.0, self.gravity], dtype=np.float32)
        for p in self.particles:
            if p.age >= p.lifespan:
                continue
            p.vel = p.vel * self.drag + gv
            p.pos = p.pos + p.vel
            p.angle += p.angular_vel
            p.age += 1.0

    def render(self, frame: np.ndarray) -> np.ndarray:
        out = frame.copy()
        h, w = out.shape[:2]
        for p in self.particles:
            if p.age >= p.lifespan:
                continue
            life_t = p.age / p.lifespan
            alpha = 1.0 - life_t
            x, y = int(p.pos[0]), int(p.pos[1])
            if x < -16 or x >= w + 16 or y < -16 or y >= h + 16:
                continue
            faded = self._fade(p.color, alpha)
            if p.kind == "spark":
                # Motion blur tail
                tail_len = int(np.linalg.norm(p.vel) * 0.55)
                if tail_len > 0:
                    end = (x, y)
                    start = (
                        int(x - p.vel[0] * 0.55),
                        int(y - p.vel[1] * 0.55),
                    )
                    cv2.line(out, start, end, faded, 1, cv2.LINE_AA)
                cv2.circle(out, (x, y), max(1, int(p.size)), faded, -1, cv2.LINE_AA)
            elif p.kind == "shard":
                pts = self._triangle(p)
                cv2.fillPoly(out, [pts], faded)
            else:  # dust
                cv2.circle(out, (x, y), max(2, int(p.size)), faded, -1, cv2.LINE_AA)
        return out

    @staticmethod
    def _fade(color: tuple[int, int, int], a: float) -> tuple[int, int, int]:
        return tuple(int(c * a) for c in color)  # type: ignore

    @staticmethod
    def _triangle(p: _Particle) -> np.ndarray:
        s = p.size
        ca, sa = math.cos(p.angle), math.sin(p.angle)
        base = np.array([[-s, -s * 0.6], [s, -s * 0.6], [0, s]], dtype=np.float32)
        rot = np.array([[ca, -sa], [sa, ca]], dtype=np.float32)
        pts = (base @ rot.T) + p.pos
        return pts.astype(np.int32)


def render_particle_field(
    frames: np.ndarray,
    breakout_frame: int,
    duration_frames: int = 40,
    n_particles: int = 320,
    palette: tuple[tuple[int, int, int], ...] = ((255, 255, 255), (220, 220, 240)),
    seed: int = 42,
) -> np.ndarray:
    """Spawn a particle field at the breakout frame and let it die out.

    Returns the frames with particles composited over the originals.
    """
    h, w = frames.shape[1:3]
    field_ = ParticleField(
        canvas_size=(h, w),
        origin=(h // 2, w // 2),
        n_particles=n_particles,
        color_palette=palette,
        seed=seed,
    )
    out = frames.copy()
    for i in range(frames.shape[0]):
        rel = i - breakout_frame
        if rel < 0 or rel > duration_frames:
            continue
        out[i] = field_.render(out[i])
        field_.step()
    return out
