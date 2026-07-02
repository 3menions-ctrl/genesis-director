"""
sfx.py — SFX layer synthesis.

Two paths:
  1. AudioLDM2 — text-to-audio model. Used when the template's sfx_tag
     names a sound we can describe in a prompt.
  2. Foley library — pre-recorded short WAVs in `assets/foley/<tag>.wav`.
     Always tried first because pre-recorded SFX are sharper than 4s AI
     audio.

Each tag has a timing hint (offset_s from the breakout moment + level).
The mixer in mix.py combines them into a single SFX bed.
"""
from __future__ import annotations

import logging
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class SfxCue:
    """One sound effect cued at a specific moment in the final video."""
    tag: str
    offset_s: float       # seconds from t=0 of the final video
    level: float = 1.0    # 0..1 gain


# Per-tag default timings. Keyed by sfx_tag from vfx_templates.
FOLEY_LIBRARY: dict[str, dict] = {
    # Glass shatter
    "glass_break_thick":     {"offset_s": "@breakout",      "level": 1.0},
    "glass_thin_break":      {"offset_s": "@breakout",      "level": 0.85},
    "glass_thick_break":     {"offset_s": "@breakout",      "level": 1.0},
    "glass_punch":           {"offset_s": "@breakout",      "level": 1.0},
    "glass_thick_smash":     {"offset_s": "@breakout",      "level": 1.0},
    "glass_radial_crack":    {"offset_s": "@breakout-0.15", "level": 0.85},
    "glass_grow":            {"offset_s": "@breakout-0.5",  "level": 0.4},
    "glass_creak":           {"offset_s": "@breakout-1.0",  "level": 0.4},
    "glass_shatter":         {"offset_s": "@breakout",      "level": 1.0},
    "glass_shatter_panel":   {"offset_s": "@breakout",      "level": 1.0},
    "glass_shatter_thin":    {"offset_s": "@breakout",      "level": 0.85},
    # Liquid
    "liquid_wave_crash":     {"offset_s": "@breakout",      "level": 0.95},
    "ocean_wave_crash":      {"offset_s": "@breakout",      "level": 0.95},
    "floor_splash":          {"offset_s": "@breakout+0.3",  "level": 0.7},
    "sauce_splash":          {"offset_s": "@breakout",      "level": 0.9},
    "underwater_bubbles":    {"offset_s": "@breakout-0.5",  "level": 0.6},
    "carpet_squish":         {"offset_s": "@breakout+0.3",  "level": 0.5},
    "regulator_breath":      {"offset_s": "@breakout-1.0",  "level": 0.4},
    "liquid_drip_thick":     {"offset_s": "@breakout+0.4",  "level": 0.6},
    "viscous_drip":          {"offset_s": "@breakout+0.4",  "level": 0.6},
    # Smoke / impact
    "tire_screech":          {"offset_s": "@breakout-0.4",  "level": 0.95},
    "engine_roar":           {"offset_s": "@breakout-0.8",  "level": 0.85},
    "smoke_woosh":           {"offset_s": "@breakout",      "level": 0.7},
    "supersonic_boom":       {"offset_s": "@breakout",      "level": 1.0},
    "wind_howl":             {"offset_s": "@breakout+0.2",  "level": 0.6},
    "wind_howl_high":        {"offset_s": "@breakout+0.2",  "level": 0.6},
    "tornado_roar":          {"offset_s": "@breakout",      "level": 0.85},
    "papers_flutter":        {"offset_s": "@breakout+0.2",  "level": 0.4},
    "paper_rustle":          {"offset_s": "@breakout+0.2",  "level": 0.3},
    # Lightning / electrical
    "thunder_crack":         {"offset_s": "@breakout",      "level": 1.0},
    "electric_arc":          {"offset_s": "@breakout",      "level": 0.85},
    "lamp_buzz":             {"offset_s": "@breakout+0.3",  "level": 0.4},
    "neon_zap":              {"offset_s": "@breakout",      "level": 0.85},
    "neon_buzz":             {"offset_s": "@breakout+0.1",  "level": 0.4},
    "neon_hum_bright":       {"offset_s": "@breakout+0.1",  "level": 0.4},
    "laser_hum":             {"offset_s": "@breakout",      "level": 0.5},
    "oscilloscope_buzz":     {"offset_s": "@breakout-0.4",  "level": 0.4},
    "metal_resonance":       {"offset_s": "@breakout+0.2",  "level": 0.5},
    "electric_hum":          {"offset_s": "@breakout-0.4",  "level": 0.3},
    # Tearing / rip
    "claw_rip_screen":       {"offset_s": "@breakout",      "level": 0.95},
    "fabric_tear_silk":      {"offset_s": "@breakout",      "level": 0.85},
    "fabric_tear_loud":      {"offset_s": "@breakout",      "level": 0.95},
    "paper_tear_wet":        {"offset_s": "@breakout",      "level": 0.85},
    "katana_unsheathe":      {"offset_s": "@breakout-0.5",  "level": 0.7},
    "card_shuffle_throw":    {"offset_s": "@breakout-0.4",  "level": 0.7},
    "monitor_crack":         {"offset_s": "@breakout",      "level": 0.95},
    "monitor_break":         {"offset_s": "@breakout",      "level": 0.95},
    # Footsteps / landings
    "sneaker_landing":       {"offset_s": "@breakout+0.5",  "level": 0.7},
    "boot_concrete":         {"offset_s": "@breakout+0.5",  "level": 0.75},
    "footsteps_hardwood":    {"offset_s": "@breakout+0.5",  "level": 0.6},
    "footsteps_table":       {"offset_s": "@breakout+0.5",  "level": 0.5},
    "footsteps_modern_floor":{"offset_s": "@breakout+0.5",  "level": 0.6},
    "footsteps_cobble":      {"offset_s": "@breakout+0.5",  "level": 0.6},
    "footsteps_wood":        {"offset_s": "@breakout+0.5",  "level": 0.55},
    "footstep_polished_concrete": {"offset_s": "@breakout+0.5", "level": 0.6},
    "footstep_concrete":     {"offset_s": "@breakout+0.5",  "level": 0.6},
    "heel_concrete":         {"offset_s": "@breakout+0.5",  "level": 0.55},
    "heel_marble_step":      {"offset_s": "@breakout+0.5",  "level": 0.55},
    "wood_floor_slam":       {"offset_s": "@breakout+0.2",  "level": 0.75},
    "wood_floor_settle":     {"offset_s": "@breakout+0.5",  "level": 0.4},
    "wood_slide":            {"offset_s": "@breakout+0.3",  "level": 0.55},
    "sneaker_step_wet":      {"offset_s": "@breakout+0.5",  "level": 0.55},
    "sneaker_drop":          {"offset_s": "@breakout",      "level": 0.7},
    "sneaker_scuff":         {"offset_s": "@breakout+0.5",  "level": 0.5},
    "paws_thud":             {"offset_s": "@breakout+0.5",  "level": 0.5},
    "paw_landing_heavy":     {"offset_s": "@breakout+0.4",  "level": 0.85},
    "rug_squish":            {"offset_s": "@breakout+0.5",  "level": 0.45},
    "step_water":            {"offset_s": "@breakout+0.5",  "level": 0.5},
    # Animal / human / atmospheric
    "tiger_roar_deep":       {"offset_s": "@breakout-0.3",  "level": 1.0},
    "puppy_yip":             {"offset_s": "@breakout-0.1",  "level": 0.8},
    "happy_panting":         {"offset_s": "@breakout+0.5",  "level": 0.4},
    "rage_breath":           {"offset_s": "@breakout-0.5",  "level": 0.7},
    "breath_running":        {"offset_s": "@breakout+0.2",  "level": 0.5},
    "breath_close_asmr":     {"offset_s": "@breakout-1.0",  "level": 0.3},
    "breath_cold":           {"offset_s": "@breakout+0.5",  "level": 0.3},
    "breath_low":            {"offset_s": "@breakout+0.3",  "level": 0.3},
    "character_grunt":       {"offset_s": "@breakout",      "level": 0.55},
    "crowd_roar_close":      {"offset_s": "@breakout-0.5",  "level": 0.85},
    "crowd_roar":            {"offset_s": "@breakout-0.5",  "level": 0.85},
    "stadium_crowd":         {"offset_s": "@breakout+0.5",  "level": 0.5},
    "warehouse_reverb":      {"offset_s": "@breakout+0.5",  "level": 0.5},
    # Ambient
    "street_ambient":        {"offset_s": "@breakout+0.6",  "level": 0.4},
    "kitchen_ambient":       {"offset_s": "@breakout+0.5",  "level": 0.3},
    "forest_ambient":        {"offset_s": "@breakout+0.5",  "level": 0.5},
    "office_ambient":        {"offset_s": "@breakout+0.5",  "level": 0.3},
    "office_fan_subtle":     {"offset_s": "@breakout+0.5",  "level": 0.25},
    "office_ambient_low":    {"offset_s": "@breakout+0.5",  "level": 0.25},
    "lab_electronic":        {"offset_s": "@breakout+0.5",  "level": 0.3},
    "server_hum":            {"offset_s": "@breakout-0.5",  "level": 0.3},
    "sink_drip":             {"offset_s": "@breakout+1.0",  "level": 0.25},
    "tile_step":             {"offset_s": "@breakout+0.6",  "level": 0.5},
    "fluorescent_flicker":   {"offset_s": "@breakout+0.3",  "level": 0.35},
    "candle_flicker":        {"offset_s": "@breakout-0.5",  "level": 0.3},
    "lamp_hum":              {"offset_s": "@breakout+0.3",  "level": 0.3},
    "distant_celebration":   {"offset_s": "@breakout+0.6",  "level": 0.3},
    "distant_gallery_chatter": {"offset_s": "@breakout+0.6", "level": 0.3},
    "distant_drop":          {"offset_s": "@breakout-1.0",  "level": 0.5},
    "city_distant_ambient":  {"offset_s": "@breakout+0.5",  "level": 0.3},
    "table_lamp_hum":        {"offset_s": "@breakout+0.5",  "level": 0.2},
    "stage_creak":           {"offset_s": "@breakout+0.1",  "level": 0.4},
    "table_creak":           {"offset_s": "@breakout+0.5",  "level": 0.3},
    "table_clatter":         {"offset_s": "@breakout+0.5",  "level": 0.5},
    "marble_clatter":        {"offset_s": "@breakout+0.3",  "level": 0.5},
    "seashell_clack":        {"offset_s": "@breakout+0.5",  "level": 0.4},
    "seagull_distant":       {"offset_s": "@breakout+0.8",  "level": 0.3},
    "tv_news_jingle_chop":   {"offset_s": "@breakout",      "level": 0.6},
    # Misc effects
    "filter_whoosh":         {"offset_s": "@breakout-0.2",  "level": 0.6},
    "hand_reach_whoosh":     {"offset_s": "@breakout-0.4",  "level": 0.55},
    "mic_handling":          {"offset_s": "@breakout+0.5",  "level": 0.35},
    "mic_feedback":          {"offset_s": "@breakout+0.5",  "level": 0.4},
    "rubber_bounce":         {"offset_s": "@breakout+0.3",  "level": 0.55},
    "rubber_band_snap":      {"offset_s": "@breakout-0.2",  "level": 0.85},
    "synth_zap":             {"offset_s": "@breakout",      "level": 0.6},
    "glitch_static":         {"offset_s": "@breakout-0.5",  "level": 0.55},
    "matrix_code_whisper":   {"offset_s": "@breakout-1.0",  "level": 0.35},
    "matrix_whispers":       {"offset_s": "@breakout-1.0",  "level": 0.35},
    "code_glyph":            {"offset_s": "@breakout-0.5",  "level": 0.25},
    "rain_ambient":          {"offset_s": "@breakout+0.5",  "level": 0.4},
    "wind_subtle":           {"offset_s": "@breakout+0.5",  "level": 0.3},
    "wind_whisper":          {"offset_s": "@breakout+0.5",  "level": 0.3},
    "wind_high_floor":       {"offset_s": "@breakout+0.5",  "level": 0.3},
    "wind_evening":          {"offset_s": "@breakout+0.5",  "level": 0.3},
    "breeze_evening":        {"offset_s": "@breakout+0.5",  "level": 0.3},
    "wind_subtle":           {"offset_s": "@breakout+0.5",  "level": 0.25},
    "leaves_rustle":         {"offset_s": "@breakout",      "level": 0.5},
    "bamboo_creak":          {"offset_s": "@breakout+0.3",  "level": 0.45},
    "grass_step_soft":       {"offset_s": "@breakout+0.5",  "level": 0.4},
    "cloth_swish":           {"offset_s": "@breakout",      "level": 0.4},
    "cloth_swoosh":          {"offset_s": "@breakout",      "level": 0.4},
    "coat_swoosh":           {"offset_s": "@breakout",      "level": 0.45},
    "cape_flutter":          {"offset_s": "@breakout+0.2",  "level": 0.4},
    "can_pop_loud":          {"offset_s": "@breakout-0.4",  "level": 0.85},
    "andrid_servo_whir":     {"offset_s": "@breakout+0.3",  "level": 0.45},
    "android_servo_whir":    {"offset_s": "@breakout+0.3",  "level": 0.45},
    "metal_floor_step":      {"offset_s": "@breakout+0.4",  "level": 0.55},
    "metal_creak":           {"offset_s": "@breakout+0.3",  "level": 0.4},
    "low_growl_subwoofer":   {"offset_s": "@breakout-1.0",  "level": 0.7},
    "low_growl_low":         {"offset_s": "@breakout-1.0",  "level": 0.6},
    "low_growl":             {"offset_s": "@breakout-1.0",  "level": 0.6},
    "heartbeat":             {"offset_s": "@breakout-1.5",  "level": 0.5},
    "heartbeat_high":        {"offset_s": "@breakout-0.5",  "level": 0.5},
    "heartbeat_low":         {"offset_s": "@breakout-1.5",  "level": 0.4},
    "ink_to_real":           {"offset_s": "@breakout-0.4",  "level": 0.4},
    "comic_page_rustle":     {"offset_s": "@breakout-0.5",  "level": 0.4},
    "old_photograph_creak":  {"offset_s": "@breakout-0.5",  "level": 0.35},
    "canvas_creak":          {"offset_s": "@breakout-0.5",  "level": 0.4},
    "clock_ticking":         {"offset_s": "@breakout-1.0",  "level": 0.3},
    "arcade_special_move":   {"offset_s": "@breakout-0.3",  "level": 0.7},
    "arcade_ambient":        {"offset_s": "@breakout-1.0",  "level": 0.3},
    "gi_swoosh":             {"offset_s": "@breakout+0.1",  "level": 0.45},
    "gear_jingle":           {"offset_s": "@breakout+0.4",  "level": 0.45},
    "radio_chatter":         {"offset_s": "@breakout-1.0",  "level": 0.3},
    "sonar_ping":            {"offset_s": "@breakout-0.5",  "level": 0.5},
    "crystal_set":           {"offset_s": "@breakout+0.5",  "level": 0.55},
    "luxury_chime":          {"offset_s": "@breakout+1.0",  "level": 0.4},
    "soft_drip":             {"offset_s": "@breakout+0.5",  "level": 0.4},
    "cheese_stretch":        {"offset_s": "@breakout+0.2",  "level": 0.55},
    "desk_creak":            {"offset_s": "@breakout+0.5",  "level": 0.3},
    "wood_subtle_squeak":    {"offset_s": "@breakout+0.5",  "level": 0.25},
    "tropical_breeze":       {"offset_s": "@breakout+0.5",  "level": 0.35},
    "sniffer_pop":           {"offset_s": "@breakout",      "level": 0.4},
    "paper_flap":            {"offset_s": "@breakout+0.4",  "level": 0.4},
    "ecg_beep":              {"offset_s": "@breakout-1.0",  "level": 0.3},
    "scifi_atmosphere":      {"offset_s": "@breakout-1.0",  "level": 0.3},
    "underwater_atmosphere": {"offset_s": "@breakout-1.0",  "level": 0.3},
    "rain_subtle":           {"offset_s": "@breakout+0.5",  "level": 0.3},
    "neon_zap_pop":          {"offset_s": "@breakout",      "level": 0.55},
    "flesh_grow_squelch":    {"offset_s": "@breakout+0.5",  "level": 0.5},
    "medical_ambient":       {"offset_s": "@breakout+1.0",  "level": 0.3},
    "xray_film_tear":        {"offset_s": "@breakout",      "level": 0.55},
    "spacesuit_radio_static":{"offset_s": "@breakout-1.0",  "level": 0.35},
    "projector_hum":         {"offset_s": "@breakout-1.0",  "level": 0.3},
    "suit_thrusters_subtle": {"offset_s": "@breakout",      "level": 0.4},
    "sodium_hum":            {"offset_s": "@breakout+0.5",  "level": 0.3},
    "pixel_glitch":          {"offset_s": "@breakout",      "level": 0.55},
    "monitor_crack":         {"offset_s": "@breakout",      "level": 0.95},
}


def synthesize_sfx_layer(
    tag: str,
    duration_s: float,
    output_path: Path,
) -> Optional[Path]:
    """Resolve one tag to a WAV file. Library lookup first, AudioLDM2 second.

    Returns None if neither source produced audio.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Library first
    lib_path = _foley_lookup(tag)
    if lib_path is not None:
        import shutil
        shutil.copy(lib_path, output_path)
        return output_path

    # AudioLDM2 fallback
    try:
        return _generate_with_audioldm2(tag, duration_s, output_path)
    except Exception as e:
        logger.warning("AudioLDM2 failed for %s: %s", tag, e)
        # Synthesize a soft click as a placeholder so timing still works
        _write_click(output_path)
        return output_path


def _foley_lookup(tag: str) -> Optional[Path]:
    for base in ("assets/foley", "../assets/foley"):
        p = Path(base) / f"{tag}.wav"
        if p.is_file():
            return p
    return None


def _generate_with_audioldm2(tag: str, duration_s: float, output_path: Path) -> Path:
    from diffusers import AudioLDM2Pipeline
    import torch
    import scipy.io.wavfile as wavfile

    prompt = tag.replace("_", " ")
    pipe = AudioLDM2Pipeline.from_pretrained(
        "cvssp/audioldm2",
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    )
    if torch.cuda.is_available():
        pipe = pipe.to("cuda")
    result = pipe(
        prompt=prompt,
        num_inference_steps=30,
        audio_length_in_s=min(8, duration_s),
    )
    audio = result.audios[0]
    wavfile.write(str(output_path), 16000, (audio * 32767).astype(np.int16))
    return output_path


def _write_click(path: Path) -> None:
    """1-frame click placeholder so the mix has something to align."""
    import wave

    sr = 48000
    samples = np.zeros(sr // 10, dtype=np.int16)
    samples[:50] = 4000
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(samples.tobytes())
