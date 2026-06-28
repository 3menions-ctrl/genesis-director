"""
music.py — short music-bed synthesis via MusicGen (audiocraft).

Genres map to MusicGen prompts. We generate the full clip duration in a
single inference pass so the mix stays coherent. If audiocraft isn't
installed, we generate a silent stem so the encode still produces a
valid MP4.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


GENRE_PROMPTS: dict[str, str] = {
    "trap_breaks":              "hard hip-hop trap beat with 808 sub-bass, distorted snare, dark mood, 95 BPM",
    "lo_fi_streetwear":         "chill lo-fi hip-hop instrumental with vinyl crackle, warm bass, jazzy keys, urban vibe",
    "soft_jazz":                "soft instrumental jazz, brushed drums, warm upright bass, gentle piano",
    "horror_drone":             "dark cinematic horror drone, low rumble, dissonant strings, unsettling",
    "cinematic_string":         "cinematic orchestral strings, dramatic build, fashion runway energy",
    "edm_high_energy":          "high-energy EDM drop, big synth lead, four-on-the-floor kick, sidechained",
    "synthwave_dark":           "dark synthwave with arpeggiated bass, neon vibes, 90 BPM",
    "ambient_japanese":         "ambient Japanese koto and shakuhachi, peaceful, bamboo forest atmosphere",
    "street_magic_orchestra":   "small orchestral piece with mystery and wonder, light percussion",
    "epic_workout":             "epic workout EDM with tense build and uplifting drop, 140 BPM",
    "gamer_dubstep_drop":       "modern dubstep with aggressive wobbles and snare rolls, 140 BPM",
    "news_to_lounge":           "transition from news broadcast jingle to laid-back lounge",
    "asmr_calm":                "very calm ambient pad music, soft tones, no percussion",
    "cosmic_orchestra":         "cosmic cinematic orchestra, vast and floating, deep space mood",
    "tropical_breeze":          "upbeat tropical house with steel drums and acoustic guitar",
    "pop_anthem_chorus":        "pop rock anthem chorus, bright electric guitars, soaring vocal-like lead",
    "documentary_tension":      "documentary tension music, low strings tremolo, suspenseful",
    "oceanic_ambient":          "deep ambient music with underwater whale tones, peaceful",
    "cyber_industrial":         "industrial cyberpunk track, metallic percussion, distorted bass",
    "racing_orchestral":        "fast orchestral piece for motorsports, brass and percussion",
    "whimsical_orchestra":      "whimsical orchestra with playful pizzicato strings and woodwinds",
    "wedding_strings":          "romantic string quartet, gentle waltz tempo",
    "cute_acoustic":            "cute acoustic guitar pluck and ukulele, light percussion, happy",
    "sensual_jazz":             "smooth sensual jazz with saxophone and walking bass",
    "classical_string_quartet": "classical string quartet, refined and elegant",
    "luxury_jazz":              "luxury jazz lounge, smooth saxophone, soft piano",
    "festival_dance":           "festival dance track, big synth drop, four-on-the-floor",
    "corporate_uplifting":      "corporate uplifting music, gentle piano and strings, optimistic",
    "epic_running":             "epic instrumental for running, big drums, soaring strings",
    "hip_hop_lo_fi":            "smooth lo-fi hip-hop with jazzy chords and boom-bap drums",
    "analog_horror_synth":      "analog horror synthesizer drone, retro CRT vibe, slow pulse",
    "sci_fi_orchestral":        "sci-fi orchestral with synth pads and dramatic brass",
    "chiptune_to_orchestral":   "chiptune intro transitioning to full orchestra mid-track",
    "thriller_pulse":           "thriller pulse track, low pulsing synth, urgency",
    "tactical_thriller":        "tactical thriller score, low brass, military drums",
    "lab_electronic":           "ambient electronic lab music, glitchy textures",
    "top_gun_synth":            "80s top-gun synth music, soaring lead, anthemic",
    "cyber_minimalism":         "minimalist cyber ambient, sparse synth notes, code rain",
    "submarine_tension":        "submarine thriller score, deep sonar pings, low strings",
    "medical_unsettling":       "unsettling medical-thriller drone, ECG beep, low pulse",
    "heroic_orchestral":        "heroic orchestral fanfare with brass and percussion",
    "orchestral_stormy":        "stormy orchestral piece, dramatic timpani and strings",
    "theatrical_overture":      "theatrical overture, strings and woodwinds, dramatic",
    "whimsical_piano":          "whimsical solo piano, playful and light",
    "luxury_minimal":           "minimal luxury electronic, smooth bass, sparse notes",
    "storm_documentary":        "storm documentary music, building tension, low strings",
    "storm_synth":              "storm synth music, electric crackle, low rumble",
    "ambient_minimal_dark":     "minimal dark ambient drone with subtle texture",
    "horror_suspense_minimal":  "minimal horror suspense, soft drone, occasional sting",
    "sepia_to_modern_string":   "vintage strings transitioning to modern string ensemble",
    "festival_purple_haze":     "festival electronic with euphoric build and drop",
    "concert_neon":             "concert pop hit with neon synth and full drum kit",
}


def synthesize_music_bed(
    genre: str,
    duration_s: float,
    output_path: Path,
    seed: Optional[int] = None,
) -> Path:
    """Generate `duration_s` of music keyed by `genre`. Returns the WAV path."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    prompt = GENRE_PROMPTS.get(genre, "ambient instrumental music")
    try:
        return _generate_with_musicgen(prompt, duration_s, output_path, seed)
    except Exception as e:
        logger.warning("MusicGen failed (%s) — writing silent stem", e)
        return _write_silence(duration_s, output_path)


def _generate_with_musicgen(prompt: str, duration_s: float, output_path: Path, seed: Optional[int]) -> Path:
    """MusicGen via audiocraft. Lazy-imported to keep the import graph light."""
    from audiocraft.models import MusicGen
    from audiocraft.data.audio import audio_write

    if seed is not None:
        import torch
        torch.manual_seed(seed)

    model = MusicGen.get_pretrained("facebook/musicgen-medium")
    model.set_generation_params(duration=int(max(1, min(30, duration_s))))
    wav = model.generate([prompt])
    audio_write(str(output_path).removesuffix(".wav"), wav[0].cpu(),
                model.sample_rate, strategy="loudness")
    return output_path


def _write_silence(duration_s: float, output_path: Path) -> Path:
    """Write a silent 48kHz stereo WAV as a placeholder."""
    import wave

    sample_rate = 48000
    n_frames = int(duration_s * sample_rate)
    silence = np.zeros((n_frames, 2), dtype=np.int16)
    with wave.open(str(output_path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(silence.tobytes())
    return output_path
