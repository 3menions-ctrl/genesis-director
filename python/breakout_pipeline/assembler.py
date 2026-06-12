"""
assembler.py — write a numpy frame array to an MP4 with optional audio.

Two backends are supported:
  • moviepy (high-level, cross-platform, slower)
  • ffmpeg-python (lower-level, faster, requires ffmpeg in PATH)

We pick ffmpeg-python by default for speed; moviepy is the fallback when
ffmpeg isn't reachable. The MP4 is written H.264 high@4.1 + AAC stereo +
+faststart — Safari/iOS-safe, ready for the Hub player.
"""
from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


def write_video(
    frames: np.ndarray,
    output_path: Path,
    fps: int = 24,
    audio_path: Optional[Path] = None,
) -> Path:
    """Write `frames` to `output_path` as an H.264 MP4.

    `frames`: (T, H, W, 3) uint8 RGB.
    `audio_path`: optional WAV/MP3 to mux in (loops or truncates to clip).
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if shutil.which("ffmpeg"):
        return _write_with_ffmpeg(frames, output_path, fps, audio_path)
    return _write_with_moviepy(frames, output_path, fps, audio_path)


# ── Backend: ffmpeg-python ────────────────────────────────────────────────

def _write_with_ffmpeg(
    frames: np.ndarray,
    output_path: Path,
    fps: int,
    audio_path: Optional[Path],
) -> Path:
    import ffmpeg

    t, h, w, _ = frames.shape
    logger.info("Encoding %d frames at %dx%d via ffmpeg-python", t, w, h)

    video_input = (
        ffmpeg
        .input("pipe:", format="rawvideo", pix_fmt="rgb24", s=f"{w}x{h}", framerate=fps)
    )

    if audio_path and Path(audio_path).is_file():
        audio_input = ffmpeg.input(str(audio_path))
        out = ffmpeg.output(
            video_input.video,
            audio_input.audio,
            str(output_path),
            vcodec="libx264", preset="slow", crf=18, pix_fmt="yuv420p",
            profile="high", level="4.1", g=fps * 2,
            acodec="aac", audio_bitrate="192k", ar=48000, ac=2,
            shortest=None,                      # truncate to shorter of two
            movflags="+faststart",
        )
    else:
        out = ffmpeg.output(
            video_input,
            str(output_path),
            vcodec="libx264", preset="slow", crf=18, pix_fmt="yuv420p",
            profile="high", level="4.1", g=fps * 2,
            movflags="+faststart",
        )

    process = (
        out
        .overwrite_output()
        .run_async(pipe_stdin=True, quiet=True)
    )
    try:
        process.stdin.write(frames.tobytes())
        process.stdin.close()
        process.wait()
        if process.returncode != 0:
            raise RuntimeError(f"ffmpeg exited {process.returncode}")
    except BrokenPipeError as e:
        logger.error("ffmpeg pipe broke: %s", e)
        raise

    return output_path


# ── Backend: moviepy ──────────────────────────────────────────────────────

def _write_with_moviepy(
    frames: np.ndarray,
    output_path: Path,
    fps: int,
    audio_path: Optional[Path],
) -> Path:
    from moviepy.editor import ImageSequenceClip, AudioFileClip

    logger.info("Encoding via moviepy (no system ffmpeg detected — slower)")
    clip = ImageSequenceClip([f for f in frames], fps=fps)
    if audio_path and Path(audio_path).is_file():
        audio = AudioFileClip(str(audio_path))
        if audio.duration > clip.duration:
            audio = audio.subclip(0, clip.duration)
        clip = clip.set_audio(audio)

    clip.write_videofile(
        str(output_path),
        codec="libx264", audio_codec="aac",
        fps=fps,
        ffmpeg_params=["-pix_fmt", "yuv420p", "-profile:v", "high",
                       "-level:v", "4.1", "-movflags", "+faststart",
                       "-preset", "slow", "-crf", "18"],
        verbose=False, logger=None,
    )
    return output_path


# ── Helper: extract a single thumbnail PNG from frame 0 ──────────────────

def write_thumbnail(frames: np.ndarray, output_path: Path) -> Path:
    """Save frame 0 as a PNG for use as the project thumbnail."""
    import cv2
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bgr = cv2.cvtColor(frames[0], cv2.COLOR_RGB2BGR)
    cv2.imwrite(str(output_path), bgr)
    return output_path


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None
