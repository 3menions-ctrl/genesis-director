"""
mix.py — combine music bed + per-tag SFX into the final video's audio
track. Uses ffmpeg's filter_complex graph for low overhead.

Public entry point: `build_audio_track`. It returns a path to a 48kHz
stereo WAV that the assembler muxes into the MP4.
"""
from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path
from typing import Optional

from .sfx import FOLEY_LIBRARY, SfxCue, synthesize_sfx_layer
from .music import synthesize_music_bed

logger = logging.getLogger(__name__)


def build_audio_track(
    sfx_tags: list[str],
    music_genre: Optional[str],
    duration_s: float,
    breakout_s: float,
    output_path: Path,
    music_level: float = 0.45,
    work_dir: Optional[Path] = None,
) -> Path:
    """Render the audio track for the final mix.

    Resolves each `sfx_tag` to its timing hint, generates / fetches the
    sample, then ffmpeg-mixes everything against the (optional) music
    bed.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    work_dir = Path(work_dir or output_path.parent / "audio_workdir")
    work_dir.mkdir(parents=True, exist_ok=True)

    # ── Resolve cues ──
    cues = []
    for tag in sfx_tags:
        meta = FOLEY_LIBRARY.get(tag)
        if not meta:
            logger.debug("no foley meta for tag '%s'", tag)
            continue
        offset = _resolve_offset(meta["offset_s"], breakout_s)
        if offset < 0 or offset > duration_s:
            continue
        cues.append(SfxCue(tag=tag, offset_s=offset, level=meta.get("level", 1.0)))

    # ── Synthesize music ──
    music_path = None
    if music_genre:
        music_path = work_dir / "music.wav"
        synthesize_music_bed(music_genre, duration_s, music_path)

    # ── Synthesize SFX ──
    sfx_paths: list[tuple[SfxCue, Path]] = []
    for cue in cues:
        p = work_dir / f"sfx_{cue.tag}.wav"
        result = synthesize_sfx_layer(cue.tag, 4.0, p)
        if result:
            sfx_paths.append((cue, result))

    if not shutil.which("ffmpeg"):
        logger.warning("ffmpeg not found — copying music as the audio track")
        if music_path and music_path.is_file():
            shutil.copy(music_path, output_path)
        return output_path

    # ── Build the ffmpeg filter graph ──
    inputs: list[str] = []
    streams: list[str] = []
    idx = 0

    if music_path and music_path.is_file():
        inputs += ["-i", str(music_path)]
        streams.append(f"[{idx}:a]volume={music_level}[m]")
        idx += 1
    if not sfx_paths and not (music_path and music_path.is_file()):
        # Silent track
        return _write_silence(duration_s, output_path)

    sfx_streams = []
    for cue, p in sfx_paths:
        inputs += ["-i", str(p)]
        delay_ms = int(cue.offset_s * 1000)
        streams.append(
            f"[{idx}:a]adelay={delay_ms}|{delay_ms},volume={cue.level}[s{idx}]"
        )
        sfx_streams.append(f"[s{idx}]")
        idx += 1

    mix_inputs = "[m]" + "".join(sfx_streams) if music_path and music_path.is_file() else "".join(sfx_streams)
    n_mix = (1 if music_path and music_path.is_file() else 0) + len(sfx_streams)
    streams.append(f"{mix_inputs}amix=inputs={n_mix}:dropout_transition=0,aresample=48000[a]")
    filter_complex = ";".join(streams)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[a]",
        "-t", str(duration_s),
        "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
        str(output_path),
    ]
    try:
        subprocess.check_call(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        logger.warning("ffmpeg audio mix failed (%s); writing silence", e)
        return _write_silence(duration_s, output_path)

    return output_path


def _resolve_offset(spec: str, breakout_s: float) -> float:
    """Parse `@breakout`, `@breakout+0.3`, `@breakout-1.0` etc."""
    s = spec.strip()
    if not s.startswith("@breakout"):
        try:
            return float(s)
        except ValueError:
            return breakout_s
    rest = s.removeprefix("@breakout").strip()
    if not rest:
        return breakout_s
    try:
        return breakout_s + float(rest)
    except ValueError:
        return breakout_s


def _write_silence(duration_s: float, path: Path) -> Path:
    import wave

    import numpy as np

    sr = 48000
    n = int(duration_s * sr)
    silence = np.zeros((n, 2), dtype=np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(silence.tobytes())
    return path
