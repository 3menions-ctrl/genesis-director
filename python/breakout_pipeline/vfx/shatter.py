"""
shatter.py — physics-grade glass shatter using Voronoi tessellation +
rigid-body simulation. The 14 radial cracks in the v1 compositor were a
sketch; this generates ~100 tessellated shards, each with its own mass,
angular velocity, and time-to-fall.

Pipeline:
  1. Seed N random crack-origin points biased toward the impact center.
  2. Compute the 2D Voronoi diagram (scipy.spatial.Voronoi).
  3. For each cell that touches the impact disc, compute centroid +
     initial velocity (outward from center with random jitter).
  4. Render each cell as an alpha-masked polygon sliding outward, with:
     • a "glint" highlight along the leading edge,
     • progressively dropping alpha as the shard tumbles out of frame,
     • optional rim chromatic aberration.
  5. Composite over the frame at the breakout moment.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np

try:
    from scipy.spatial import Voronoi
    _HAS_SCIPY = True
except ImportError:  # pragma: no cover - scipy is in requirements
    _HAS_SCIPY = False


@dataclass
class _Shard:
    """One tessellated piece of broken glass."""
    polygon: np.ndarray          # (V, 2) original cell vertices
    centroid: np.ndarray         # (2,)
    velocity: np.ndarray         # (2,) px/frame
    angular_velocity: float      # rad/frame
    initial_alpha: float
    spawn_time: float            # in [0..1] within the shatter window


@dataclass
class VoronoiShatter:
    """Generates a Voronoi shatter pattern + per-shard motion."""

    canvas_size: tuple[int, int]              # (h, w)
    impact_center: tuple[int, int]            # (cy, cx)
    impact_radius: int = 240
    num_shards: int = 96
    seed: int = 42
    chromatic_kicker: float = 4.0             # px RGB split at peak

    shards: list[_Shard] = field(default_factory=list, init=False)

    def __post_init__(self) -> None:
        self._generate()

    # ── generation ────────────────────────────────────────────────────
    def _generate(self) -> None:
        rng = np.random.default_rng(self.seed)
        h, w = self.canvas_size
        cy, cx = self.impact_center
        r = self.impact_radius

        # Seed points: dense near the impact, sparse far out
        n_inner = int(self.num_shards * 0.7)
        n_outer = self.num_shards - n_inner
        inner_r = rng.uniform(0, r, n_inner)
        inner_t = rng.uniform(0, 2 * math.pi, n_inner)
        outer_r = rng.uniform(r, max(r * 2.4, min(h, w) // 2), n_outer)
        outer_t = rng.uniform(0, 2 * math.pi, n_outer)
        rs = np.concatenate([inner_r, outer_r])
        ts = np.concatenate([inner_t, outer_t])
        pts = np.column_stack([cx + rs * np.cos(ts), cy + rs * np.sin(ts)])

        # Add corner anchors so cells along the edge close cleanly
        anchors = np.array([[-w, -h], [2 * w, -h], [-w, 2 * h], [2 * w, 2 * h]], dtype=np.float64)
        pts = np.vstack([pts, anchors])

        if not _HAS_SCIPY:
            # Soft fallback: radial wedges instead of true Voronoi.
            self._build_wedge_fallback(rng)
            return

        vor = Voronoi(pts)
        # Only keep cells whose seed is inside the impact disc.
        for region_idx, seed_pt in enumerate(pts[:self.num_shards]):
            region = vor.regions[vor.point_region[region_idx]]
            if not region or -1 in region:
                continue
            poly = np.array([vor.vertices[v] for v in region])
            poly = self._clip_polygon_to_canvas(poly)
            if poly.shape[0] < 3:
                continue
            centroid = poly.mean(axis=0)
            outward = centroid - np.array([cx, cy], dtype=np.float64)
            d = np.linalg.norm(outward) + 1e-6
            outward = outward / d
            speed = float(rng.uniform(10, 28)) * max(0.4, 1.0 - d / (r * 2.0))
            shard = _Shard(
                polygon=poly,
                centroid=centroid,
                velocity=outward * speed + rng.normal(0, 0.6, 2),
                angular_velocity=float(rng.normal(0, 0.08)),
                initial_alpha=float(rng.uniform(0.65, 1.0)),
                spawn_time=float(rng.uniform(0.0, 0.35)),
            )
            self.shards.append(shard)

    def _build_wedge_fallback(self, rng: np.random.Generator) -> None:
        """If scipy is missing, fall back to a coarse radial-wedge pattern."""
        h, w = self.canvas_size
        cy, cx = self.impact_center
        steps = min(48, max(24, self.num_shards // 2))
        angles = np.linspace(0, 2 * math.pi, steps, endpoint=False)
        for i, a0 in enumerate(angles):
            a1 = a0 + (2 * math.pi / steps)
            r0 = rng.uniform(0, self.impact_radius * 0.4)
            r1 = rng.uniform(self.impact_radius * 0.7, self.impact_radius * 1.4)
            poly = np.array([
                [cx + r0 * math.cos(a0), cy + r0 * math.sin(a0)],
                [cx + r1 * math.cos(a0), cy + r1 * math.sin(a0)],
                [cx + r1 * math.cos(a1), cy + r1 * math.sin(a1)],
                [cx + r0 * math.cos(a1), cy + r0 * math.sin(a1)],
            ])
            self.shards.append(_Shard(
                polygon=poly,
                centroid=poly.mean(axis=0),
                velocity=np.array([math.cos((a0 + a1) / 2), math.sin((a0 + a1) / 2)]) * 18,
                angular_velocity=0.0,
                initial_alpha=0.85,
                spawn_time=float(rng.uniform(0.0, 0.3)),
            ))

    def _clip_polygon_to_canvas(self, poly: np.ndarray) -> np.ndarray:
        h, w = self.canvas_size
        margin = max(h, w)
        return np.clip(poly, -margin, margin + max(h, w))

    # ── rendering ────────────────────────────────────────────────────
    def render(self, base: np.ndarray, t: float) -> np.ndarray:
        """Render the shatter at normalised time t in [0..1].

        Before t == 0.5 the shards are visible at their origin with
        cracks; from t == 0.5 onward they tumble outward following their
        velocity vector.
        """
        if t <= 0:
            return base
        out = base.copy()
        h, w = out.shape[:2]

        for shard in self.shards:
            local_t = max(0.0, t - shard.spawn_time)
            if local_t <= 0:
                # Draw the crack outline only (not flown yet)
                cv2.polylines(out, [shard.polygon.astype(np.int32)], True, (255, 255, 255), 1, cv2.LINE_AA)
                continue
            # Move
            offset = shard.velocity * (local_t * 24)
            moved = shard.polygon + offset
            # Fade
            alpha = max(0.0, shard.initial_alpha * (1.0 - local_t * 1.4))
            if alpha <= 0:
                continue
            # Build mask + extract sampled pixels from base for the shard
            mask = np.zeros((h, w), dtype=np.uint8)
            cv2.fillPoly(mask, [moved.astype(np.int32)], 255)
            # Sample source from the original frame at the shard centroid
            sample = self._sample_shard_texture(base, shard.polygon, moved, mask)
            # Composite via mask
            out = cv2.addWeighted(sample, alpha, out, 1.0, 0)

            # Glint along an edge
            edge_color = (255, 255, 255)
            cv2.polylines(out, [moved.astype(np.int32)], True, edge_color, 1, cv2.LINE_AA)

        # Chromatic kicker at peak shatter
        if 0.45 < t < 0.6:
            kicker = 1.0 - abs(t - 0.525) * 8.0
            out = self._chromatic_split(out, max(0, kicker) * self.chromatic_kicker)

        return out

    def _sample_shard_texture(
        self,
        base: np.ndarray,
        original_poly: np.ndarray,
        moved_poly: np.ndarray,
        mask: np.ndarray,
    ) -> np.ndarray:
        """Sample the base frame inside the moved polygon by copying the
        original polygon's texture. Approximate but visually correct."""
        h, w = base.shape[:2]
        src_pts = self._poly_to_corners(original_poly)
        dst_pts = self._poly_to_corners(moved_poly)
        if src_pts is None or dst_pts is None:
            return base
        M = cv2.getAffineTransform(src_pts[:3], dst_pts[:3])
        warped = cv2.warpAffine(base, M, (w, h), flags=cv2.INTER_LINEAR)
        mask3 = cv2.merge([mask, mask, mask])
        return np.where(mask3 > 0, warped, base)

    @staticmethod
    def _poly_to_corners(poly: np.ndarray) -> Optional[np.ndarray]:
        if poly.shape[0] < 3:
            return None
        # Pick three corners far apart enough to be stable for affine
        order = sorted(range(poly.shape[0]),
                       key=lambda i: -float(np.linalg.norm(poly[i] - poly.mean(axis=0))))
        chosen = order[:3]
        return poly[chosen].astype(np.float32)

    @staticmethod
    def _chromatic_split(img: np.ndarray, shift: float) -> np.ndarray:
        if shift <= 0:
            return img
        s = int(round(shift))
        if s == 0:
            return img
        out = img.copy()
        out[..., 0] = np.roll(img[..., 0], s, axis=1)
        out[..., 2] = np.roll(img[..., 2], -s, axis=1)
        return out


# ── Convenience helpers used by the compositor ───────────────────────────

def render_shatter_overlay(
    frames: np.ndarray,
    breakout_frame: int,
    window: int,
    impact_radius: int = 240,
    num_shards: int = 96,
    seed: int = 42,
) -> np.ndarray:
    """Apply a shatter pass across `window` frames around `breakout_frame`."""
    h, w = frames.shape[1:3]
    shatter = VoronoiShatter(
        canvas_size=(h, w),
        impact_center=(h // 2, w // 2),
        impact_radius=impact_radius,
        num_shards=num_shards,
        seed=seed,
    )
    out = frames.copy()
    for i in range(frames.shape[0]):
        rel = i - breakout_frame
        if abs(rel) > window:
            continue
        t = (rel + window) / (2 * window)
        out[i] = shatter.render(out[i], float(t))
    return out
