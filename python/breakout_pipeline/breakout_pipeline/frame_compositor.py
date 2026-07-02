"""
frame_compositor.py — OpenCV pipeline for the breakout effect itself.

The diffusion model gives us a single video where the action and the
break-out are described in the prompt. This module layers the *digital
chrome* on top of the early frames (TikTok UI, YouTube player, CRT
scanlines, etc.) and animates its physical destruction across the
SHATTER window. Past the breakout frame the chrome is gone and the
character occupies the full canvas.

Two responsibilities:
  1. Per-frame composition: scale + center the AI output into the canvas,
     overlay the kind-specific chrome, animate the camera push.
  2. The shatter transition: a cracking glass mask + radial blast +
     chromatic-aberration kicker right at the moment of break-out.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from .config import (
    CFG,
    UI_FRAME_CENTER_Y_BEFORE,
    UI_FRAME_SCALE_AFTER,
    UI_FRAME_SCALE_BEFORE,
    ZOOM_PUSH,
)

logger = logging.getLogger(__name__)


# ── Constants ─────────────────────────────────────────────────────────────
GLASS_CRACK_LINES = 14            # generated radial cracks
GLASS_CRACK_BRANCHES = 4
CHROMATIC_SHIFT_PX = 4            # RGB split intensity at breakout
SHATTER_PARTICLE_COUNT = 220


# ── Per-kind chrome painters ──────────────────────────────────────────────

def _paint_tiktok(canvas: np.ndarray) -> None:
    """Right-rail icons + bottom caption."""
    h, w = canvas.shape[:2]
    # Bottom dark gradient
    gradient = np.linspace(0, 220, h // 4, dtype=np.uint8)[:, None, None]
    gradient = np.repeat(gradient, w, axis=1)
    gradient = np.repeat(gradient, 3, axis=2)
    overlay = canvas.copy()
    overlay[-len(gradient):] = cv2.addWeighted(
        overlay[-len(gradient):], 0.55, np.zeros_like(gradient), 0.45, 0
    )
    np.copyto(canvas, overlay)

    # "For You" pill on top
    cv2.putText(canvas, "For You", (w // 2 - 50, 36),
                cv2.FONT_HERSHEY_DUPLEX, 0.7, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.line(canvas, (w // 2 - 50, 44), (w // 2 + 50, 44), (255, 255, 255), 2)

    # Right rail circles
    rail_x = w - 38
    for i, label in enumerate(["♥", "💬", "🔖", "↗"]):
        y = h // 2 + i * 70
        cv2.circle(canvas, (rail_x, y), 22, (0, 0, 0), -1)
        cv2.circle(canvas, (rail_x, y), 22, (255, 255, 255), 1)
        cv2.putText(canvas, label, (rail_x - 10, y + 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 1, cv2.LINE_AA)


def _paint_youtube(canvas: np.ndarray) -> None:
    h, w = canvas.shape[:2]
    # Top dark bar
    cv2.rectangle(canvas, (0, 0), (w, 32), (10, 10, 10), -1)
    cv2.putText(canvas, "YouTube", (10, 22),
                cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 0, 0), 1, cv2.LINE_AA)
    # Progress bar near the bottom
    bar_y = h - 28
    cv2.line(canvas, (10, bar_y), (w - 10, bar_y), (40, 40, 40), 3)
    cv2.line(canvas, (10, bar_y), (10 + (w - 20) * 2 // 5, bar_y), (220, 0, 0), 3)
    cv2.putText(canvas, "2:14 / 5:30", (12, h - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (220, 220, 220), 1, cv2.LINE_AA)


def _paint_crt(canvas: np.ndarray) -> None:
    """Scanline + curved-glass vignette."""
    h, w = canvas.shape[:2]
    # Scanlines (every other row darkened)
    canvas[::2] = (canvas[::2] * 0.78).astype(np.uint8)
    # Greenish tint
    canvas[..., 1] = np.clip(canvas[..., 1].astype(np.int16) + 18, 0, 255).astype(np.uint8)
    # Vignette
    yy, xx = np.indices((h, w))
    cy, cx = h / 2, w / 2
    dist = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2) / (math.hypot(cy, cx) + 1e-6)
    vignette = np.clip(1.0 - (dist ** 2) * 1.15, 0.0, 1.0)
    canvas[:] = (canvas * vignette[..., None]).astype(np.uint8)


def _paint_oscilloscope(canvas: np.ndarray) -> None:
    h, w = canvas.shape[:2]
    canvas[:] = (canvas * 0.35).astype(np.uint8)
    # Sine wave
    xs = np.arange(w)
    ys = (h // 2 + np.sin(xs / 30) * (h // 5)).astype(np.int32)
    for x in range(w - 1):
        cv2.line(canvas, (x, ys[x]), (x + 1, ys[x + 1]), (40, 240, 60), 2)


def _paint_radar(canvas: np.ndarray) -> None:
    h, w = canvas.shape[:2]
    canvas[:] = 0
    cy, cx = h // 2, w // 2
    for r in (h // 3, h // 5, h // 8):
        cv2.circle(canvas, (cx, cy), r, (40, 200, 60), 1)
    # Sweep line at random angle for each call (will look spinning over frames)
    cv2.line(canvas, (cx, cy), (cx + h // 3, cy), (60, 240, 80), 1)


def _paint_youtube_browser(canvas: np.ndarray) -> None:
    """Wide YouTube layout — for desktop widescreen templates."""
    h, w = canvas.shape[:2]
    cv2.rectangle(canvas, (0, 0), (w, 36), (15, 15, 15), -1)
    cv2.putText(canvas, "▶ YouTube", (12, 24),
                cv2.FONT_HERSHEY_DUPLEX, 0.7, (255, 50, 50), 1, cv2.LINE_AA)


def _paint_thermal(canvas: np.ndarray) -> None:
    """False-color thermal map — uses cv2.applyColorMap."""
    gray = cv2.cvtColor(canvas, cv2.COLOR_RGB2GRAY)
    colored = cv2.applyColorMap(gray, cv2.COLORMAP_INFERNO)
    canvas[:] = cv2.cvtColor(colored, cv2.COLOR_BGR2RGB)


def _paint_xray(canvas: np.ndarray) -> None:
    canvas[:] = cv2.bitwise_not(canvas)
    # Blue tint
    canvas[..., 2] = np.clip(canvas[..., 2].astype(np.int16) + 30, 0, 255).astype(np.uint8)
    canvas[..., 0] = (canvas[..., 0] * 0.55).astype(np.uint8)


CHROME_PAINTERS = {
    "tiktok":       _paint_tiktok,
    "reels":        _paint_tiktok,
    "instagram":    _paint_tiktok,
    "youtube":      _paint_youtube_browser,
    "netflix":      _paint_youtube_browser,
    "desktop":      _paint_youtube_browser,
    "crt":          _paint_crt,
    "oscilloscope": _paint_oscilloscope,
    "radar":        _paint_radar,
    "thermal":      _paint_thermal,
    "xray":         _paint_xray,
}


# ── Glass shatter ─────────────────────────────────────────────────────────

@dataclass
class ShatterState:
    """Cached random data so the crack pattern is consistent across frames."""
    crack_endpoints: np.ndarray             # (N, 2)
    particles: np.ndarray                   # (K, 2) initial positions
    particle_vel: np.ndarray                # (K, 2)
    rng: np.random.Generator

    @classmethod
    def build(cls, canvas_shape, seed: int = 42) -> "ShatterState":
        h, w = canvas_shape[:2]
        rng = np.random.default_rng(seed)
        # Radial endpoints from center
        cy, cx = h // 2, w // 2
        angles = np.linspace(0, 2 * math.pi, GLASS_CRACK_LINES, endpoint=False)
        lengths = rng.uniform(0.45, 0.75, GLASS_CRACK_LINES) * min(h, w) // 2
        endpoints = np.column_stack([
            cx + np.cos(angles) * lengths,
            cy + np.sin(angles) * lengths,
        ]).astype(np.int32)
        # Particles flying outward from center
        particles = np.tile([cx, cy], (SHATTER_PARTICLE_COUNT, 1)).astype(np.float32)
        vel_angles = rng.uniform(0, 2 * math.pi, SHATTER_PARTICLE_COUNT)
        vel_speed = rng.uniform(8, 28, SHATTER_PARTICLE_COUNT)
        velocity = np.column_stack([
            np.cos(vel_angles) * vel_speed,
            np.sin(vel_angles) * vel_speed,
        ])
        return cls(endpoints, particles, velocity, rng)


def _draw_cracks(canvas: np.ndarray, state: ShatterState, intensity: float) -> None:
    """Draw radial cracks growing with the breakout progression."""
    if intensity <= 0:
        return
    h, w = canvas.shape[:2]
    cy, cx = h // 2, w // 2
    for end in state.crack_endpoints:
        ex = cx + int((end[0] - cx) * intensity)
        ey = cy + int((end[1] - cy) * intensity)
        cv2.line(canvas, (cx, cy), (ex, ey), (255, 255, 255), 1, cv2.LINE_AA)
        # Branches
        for _ in range(GLASS_CRACK_BRANCHES):
            mid_t = state.rng.uniform(0.3, 0.85)
            mx = int(cx + (ex - cx) * mid_t)
            my = int(cy + (ey - cy) * mid_t)
            angle = state.rng.uniform(-0.6, 0.6)
            br_len = int(state.rng.uniform(8, 28) * intensity)
            bx = int(mx + math.cos(angle) * br_len)
            by = int(my + math.sin(angle) * br_len)
            cv2.line(canvas, (mx, my), (bx, by), (220, 220, 220), 1, cv2.LINE_AA)


def _draw_particles(canvas: np.ndarray, state: ShatterState, t_within_shatter: float) -> None:
    """Tiny moving sparkles flying outward."""
    positions = state.particles + state.particle_vel * (t_within_shatter * 24)
    for x, y in positions:
        ix, iy = int(x), int(y)
        if 0 <= ix < canvas.shape[1] and 0 <= iy < canvas.shape[0]:
            canvas[iy, ix] = (255, 255, 255)


def _chromatic_aberration(canvas: np.ndarray, intensity: float) -> np.ndarray:
    """Split R/G/B channels horizontally at the breakout impulse."""
    if intensity <= 0:
        return canvas
    shift = int(CHROMATIC_SHIFT_PX * intensity)
    if shift == 0:
        return canvas
    out = canvas.copy()
    r = np.roll(canvas[..., 0], shift, axis=1)
    b = np.roll(canvas[..., 2], -shift, axis=1)
    out[..., 0] = r
    out[..., 2] = b
    return out


# ── Public API ────────────────────────────────────────────────────────────

def composite_frames(
    raw_frames: np.ndarray,
    cfg: CFG,
    chrome_kind: str,
    source_video_path: Optional[Path] = None,
) -> np.ndarray:
    """Produce the final breakout video from raw AI frames.

    Pipeline per frame:
      1. Scale the AI frame to the current UI-frame size (lerps from
         UI_FRAME_SCALE_BEFORE → UI_FRAME_SCALE_AFTER across the breakout
         window).
      2. Center it on a black canvas of the configured output dimensions.
      3. Paint the kind-specific chrome on top while the frame is < shatter.
      4. Apply the camera push (slow zoom-in just before the break-out).
      5. Overlay glass cracks + chromatic split during the SHATTER window.
      6. After the shatter window, just pass the AI frame through cleanly.

    `source_video_path` (optional) replaces the "video inside the UI"
    with a user-supplied clip — useful when the user uploads their own
    Reel as the source. We sample that video to the same frame count via
    ffmpeg externally or fall back to the AI output if reading fails.
    """
    n = raw_frames.shape[0]
    h_out, w_out = cfg.height, cfg.width

    breakout_frame = cfg.breakout_frame
    shatter_window = cfg.shatter_frames
    state = ShatterState.build((h_out, w_out))

    # Pre-roll: optionally swap in a user video for the "inside the UI"
    # portion. Decoded with cv2; resampled to the same shape as raw_frames.
    user_pre = _maybe_user_pre_video(source_video_path, n, h_out, w_out)

    painter = CHROME_PAINTERS.get(chrome_kind)
    out = np.zeros((n, h_out, w_out, 3), dtype=np.uint8)

    for i in range(n):
        progress = i / max(1, n - 1)
        canvas = np.zeros((h_out, w_out, 3), dtype=np.uint8)

        # ── Choose the source: user clip pre-shatter, AI everywhere else ──
        src = user_pre[i] if (user_pre is not None and i <= breakout_frame) else raw_frames[i]

        # ── Compute the UI-frame scale ──
        if i < breakout_frame - shatter_window // 2:
            zoom_progress = (i / max(1, breakout_frame))
            scale = UI_FRAME_SCALE_BEFORE * (1.0 + ZOOM_PUSH * zoom_progress)
        elif i >= breakout_frame + shatter_window // 2:
            scale = UI_FRAME_SCALE_AFTER
        else:
            # Interpolate across the shatter window.
            t = (i - (breakout_frame - shatter_window // 2)) / max(1, shatter_window)
            scale = UI_FRAME_SCALE_BEFORE + (UI_FRAME_SCALE_AFTER - UI_FRAME_SCALE_BEFORE) * _ease_out_cubic(t)

        # ── Scale + center src ──
        sh, sw = src.shape[:2]
        tw = int(w_out * scale)
        th = int(tw * sh / sw)
        if th > h_out * scale:
            th = int(h_out * scale)
            tw = int(th * sw / sh)
        resized = cv2.resize(src, (tw, th), interpolation=cv2.INTER_LINEAR)

        cx = w_out // 2
        cy = int(h_out * UI_FRAME_CENTER_Y_BEFORE) if i < breakout_frame else h_out // 2
        x0 = cx - tw // 2
        y0 = cy - th // 2
        x1, y1 = x0 + tw, y0 + th
        # Clip into canvas
        sx0, sy0 = max(0, -x0), max(0, -y0)
        sx1 = tw - max(0, x1 - w_out)
        sy1 = th - max(0, y1 - h_out)
        dx0, dy0 = max(0, x0), max(0, y0)
        dx1, dy1 = min(w_out, x1), min(h_out, y1)
        canvas[dy0:dy1, dx0:dx1] = resized[sy0:sy1, sx0:sx1]

        # ── Chrome layer (pre-shatter only) ──
        if painter is not None and i < breakout_frame + shatter_window // 4:
            # Fade the chrome out as we approach breakout
            if i < breakout_frame - shatter_window // 2:
                alpha = 1.0
            else:
                t = (i - (breakout_frame - shatter_window // 2)) / max(1, shatter_window)
                alpha = 1.0 - _ease_out_cubic(t)
            if alpha > 0:
                tmp = canvas.copy()
                painter(tmp)
                canvas = cv2.addWeighted(tmp, alpha, canvas, 1 - alpha, 0)

        # ── Shatter window FX ──
        if abs(i - breakout_frame) < shatter_window // 2:
            t_within = abs(i - breakout_frame) / max(1, shatter_window // 2)
            _draw_cracks(canvas, state, intensity=1.0 - t_within if i <= breakout_frame else t_within)
            _draw_particles(canvas, state, t_within_shatter=t_within)
            kicker = 1.0 - t_within if i <= breakout_frame else 0.3 * (1 - t_within)
            canvas = _chromatic_aberration(canvas, intensity=kicker)

        out[i] = canvas

    return out


def _ease_out_cubic(t: float) -> float:
    return 1 - (1 - t) ** 3


def _maybe_user_pre_video(
    path: Optional[Path], n: int, h_out: int, w_out: int
) -> Optional[np.ndarray]:
    """Decode a user-supplied clip and resample to n frames at out resolution.

    Returns None if decoding fails so the caller falls back to the AI clip.
    """
    if path is None:
        return None
    if not Path(path).is_file():
        logger.warning("user source video not found: %s", path)
        return None
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        logger.warning("failed to open user source video")
        return None
    src_n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if src_n <= 0:
        cap.release()
        return None
    indices = np.linspace(0, max(0, src_n - 1), n).astype(np.int64)
    frames = np.zeros((n, h_out, w_out, 3), dtype=np.uint8)
    j = 0
    for tgt in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(tgt))
        ok, bgr = cap.read()
        if not ok:
            continue
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        frames[j] = cv2.resize(rgb, (w_out, h_out), interpolation=cv2.INTER_AREA)
        j += 1
    cap.release()
    return frames
