"""Audio module — music bed + SFX synthesis for the final mix.

  • music.py  — MusicGen-style background score generation.
  • sfx.py    — AudioLDM SFX synthesis + a foley library fallback.
  • mix.py    — ffmpeg-based audio bed + SFX mux into the final MP4.
"""
from .music import synthesize_music_bed
from .sfx import synthesize_sfx_layer, FOLEY_LIBRARY
from .mix import build_audio_track

__all__ = [
    "synthesize_music_bed",
    "synthesize_sfx_layer",
    "build_audio_track",
    "FOLEY_LIBRARY",
]
