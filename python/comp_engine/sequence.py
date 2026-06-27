"""
sequence.py — render an animated breakthrough comp to a real MP4.

Drives the compositor over time (subject emerging toward the viewer with a
motion-blur peak + light-wrap + rack focus), writes frames, and encodes with
ffmpeg. This is the *finishing* tail of the photoreal pipeline running for real
on the stages whose tools exist locally (comp_engine + ffmpeg).

    cd python && .venv_comp/bin/python -m comp_engine.sequence /tmp/clip.mp4
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile

import numpy as np

from .graph import Node, evaluate
from .image import Image
from .io_nodes import write_image
from .recipes import Source, breakthrough_comp


def _bell(t: float) -> float:
    return float(np.exp(-((t - 0.5) ** 2) / (2 * 0.16 ** 2)))


def scene(t: float, w: int, h: int) -> Node:
    """Build the comp graph for normalized time t∈[0,1]."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    ny = ys / h

    beauty = Image.black(w, h, names=("R", "G", "B", "A", "Z", "motion.x", "motion.y"))
    beauty.channels["R"] = (0.05 + 0.22 * ny).astype(np.float32)
    beauty.channels["G"] = (0.07 + 0.16 * ny).astype(np.float32)
    beauty.channels["B"] = (0.16 + 0.28 * (1 - ny)).astype(np.float32)
    beauty.channels["A"] = np.ones((h, w), np.float32)
    beauty.channels["Z"] = np.full((h, w), 0.85, np.float32)            # env is far → soft
    beauty.channels["motion.x"] = np.full((h, w), 3.0, np.float32)

    # subject emerges toward viewer: grows, drifts down, alpha ramps in
    appear = np.clip(t / 0.25, 0, 1)
    cx = w * 0.5
    cy = h * (0.45 + 0.18 * t)
    r = h * (0.07 + 0.16 * t)
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    alpha = (np.clip(1.0 - (d - r) / 14.0, 0, 1) * appear).astype(np.float32)

    subj = Image.black(w, h, names=("R", "G", "B", "A", "Z", "motion.x", "motion.y"))
    subj.channels["R"] = (0.95 * alpha).astype(np.float32)
    subj.channels["G"] = (0.55 * alpha).astype(np.float32)
    subj.channels["B"] = (1.0 * alpha).astype(np.float32)
    subj.channels["A"] = alpha
    subj.channels["Z"] = np.full((h, w), 0.2, np.float32)               # subject in focus
    subj.channels["motion.x"] = (40.0 * _bell(t) * alpha).astype(np.float32)  # blur peak mid

    return breakthrough_comp(
        Source(beauty), Source(subj),
        focus=0.2, max_blur=18.0, mblur_samples=11,
        glow_gain=0.6 + 0.8 * appear, grain=0.016, seed=7,
    )


def render_sequence(out_mp4: str, frames: int = 48, w: int = 480, h: int = 600, fps: int = 24) -> str:
    tmp = tempfile.mkdtemp(prefix="bt_seq_")
    for i in range(frames):
        t = i / max(1, frames - 1)
        write_image(evaluate(scene(t, w, h)), os.path.join(tmp, f"f{i:04d}.png"))
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps),
         "-i", os.path.join(tmp, "f%04d.png"),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", out_mp4],
        check=True,
    )
    return out_mp4


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/breakthrough_comp.mp4"
    print("rendered", render_sequence(out))
