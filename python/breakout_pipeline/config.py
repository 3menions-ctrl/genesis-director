"""
config.py — global pipeline configuration for the Digital Frame Breakout
effect.

Everything that you might tweak between runs lives here. The pipeline
modules read from this module via `from breakout_pipeline.config import CFG`
so there's a single source of truth.

Notes on hardware assumptions:
  • CUDA-capable GPU. The pipeline auto-detects bf16 vs fp16 from the
    GPU compute capability — Ampere+ uses bf16, older cards fp16.
  • Minimum effective VRAM is ~14 GB with the 4-bit bnb config below.
    On a 24 GB card you can disable quantisation by setting QUANT_BACKEND
    = None.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Optional


# ── Filesystem ────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RUN_ID = os.environ.get("BREAKOUT_RUN_ID", "")  # set per-render externally
OUTPUT_DIR = PROJECT_ROOT / "runs" / (RUN_ID or "scratch")
CACHE_DIR  = PROJECT_ROOT / ".model_cache"
ASSETS_DIR = PROJECT_ROOT / "assets"

for _d in (OUTPUT_DIR, CACHE_DIR, ASSETS_DIR):
    _d.mkdir(parents=True, exist_ok=True)


# ── Model selection ──────────────────────────────────────────────────────
# Pick one. Both are fully open-source. HunyuanVideo is higher quality,
# CogVideoX-5b is faster + works on smaller cards.
ModelKey = Literal["hunyuan", "cogvideox-5b"]

MODEL_REGISTRY: dict[str, dict] = {
    "hunyuan": {
        "model_id": "hunyuanvideo-community/HunyuanVideo",
        "pipeline_class": "HunyuanVideoPipeline",
        "default_frames": 65,        # multiples of 4 + 1
        "default_height": 720,
        "default_width": 1280,
        "default_steps": 40,
        "default_guidance": 6.0,
        "min_vram_gb": 18,
    },
    "cogvideox-5b": {
        "model_id": "THUDM/CogVideoX-5b",
        "pipeline_class": "CogVideoXPipeline",
        "default_frames": 49,
        "default_height": 480,
        "default_width": 720,
        "default_steps": 50,
        "default_guidance": 6.0,
        "min_vram_gb": 12,
    },
}


# ── Quantisation / memory ────────────────────────────────────────────────
QUANT_BACKEND: Optional[str] = "bitsandbytes_4bit"   # set to None on 24 GB+
QUANT_DTYPE = "bfloat16"                              # bnb compute dtype
ENABLE_MODEL_CPU_OFFLOAD = True
ENABLE_VAE_TILING = True
ENABLE_SEQUENTIAL_CPU_OFFLOAD = False                  # last resort, very slow


# ── Output framing — vertical (TikTok / Reels) ───────────────────────────
# Switched to horizontal automatically when ASPECT == "16:9". See main().
OUTPUT_FPS = 24
OUTPUT_HEIGHT_VERTICAL = 1280
OUTPUT_WIDTH_VERTICAL  = 720
OUTPUT_HEIGHT_HORIZONTAL = 720
OUTPUT_WIDTH_HORIZONTAL  = 1280


# ── Breakout timing ──────────────────────────────────────────────────────
# Total clip duration in seconds. The "step out" moment lands at
# BREAKOUT_RATIO of the total duration — earlier means the audience spends
# more time in the real world, later means more screen-bound build-up.
TOTAL_DURATION_SECONDS = 5.0
BREAKOUT_RATIO = 0.45                  # 0.0 → instant; 1.0 → never
SHATTER_DURATION_SECONDS = 0.55        # length of the glass-break overlay
ZOOM_PUSH = 0.18                       # how much the camera "leans in" before the break

# Composition: the UI chrome occupies a portion of the frame inside the
# bigger output canvas. The character video plays inside the chrome and
# expands to fill the frame at breakout.
UI_FRAME_SCALE_BEFORE = 0.62           # 62% of the canvas before breakout
UI_FRAME_SCALE_AFTER  = 1.00           # full frame after
UI_FRAME_CENTER_Y_BEFORE = 0.52        # vertically biased slightly low for shot composition


@dataclass
class RenderRequest:
    """One render = one Crossover template invocation."""
    prompt: str
    template_slug: str = "the-dancers-leap"
    chrome_kind: str = "tiktok"
    aspect: Literal["9:16", "16:9", "1:1"] = "9:16"
    model: ModelKey = "cogvideox-5b"
    seed: Optional[int] = None
    # If a subject portrait is provided, we'll use it for prompt enrichment
    # and (optionally) IP-Adapter style conditioning in a future revision.
    subject_image_path: Optional[Path] = None
    # If a source video is provided, the chrome's "screen content" is taken
    # from this clip instead of the AI generation. Useful for UGC.
    source_video_path: Optional[Path] = None
    # Overrides — leave None to use model defaults.
    inference_steps: Optional[int] = None
    guidance_scale: Optional[float] = None
    num_frames: Optional[int] = None


@dataclass
class CFG:
    """Read-only runtime config snapshot. Build with CFG.from_request()."""
    model_key: ModelKey
    model_id: str
    pipeline_class: str
    height: int
    width: int
    num_frames: int
    inference_steps: int
    guidance_scale: float
    fps: int = OUTPUT_FPS
    quant_backend: Optional[str] = QUANT_BACKEND
    quant_dtype: str = QUANT_DTYPE
    enable_cpu_offload: bool = ENABLE_MODEL_CPU_OFFLOAD
    enable_vae_tiling: bool = ENABLE_VAE_TILING
    output_dir: Path = OUTPUT_DIR
    cache_dir: Path = CACHE_DIR

    @classmethod
    def from_request(cls, req: RenderRequest) -> "CFG":
        entry = MODEL_REGISTRY[req.model]

        # Match output dims to requested aspect.
        if req.aspect == "9:16":
            h, w = OUTPUT_HEIGHT_VERTICAL, OUTPUT_WIDTH_VERTICAL
        elif req.aspect == "16:9":
            h, w = OUTPUT_HEIGHT_HORIZONTAL, OUTPUT_WIDTH_HORIZONTAL
        else:  # 1:1
            side = min(OUTPUT_HEIGHT_VERTICAL, OUTPUT_WIDTH_VERTICAL)
            h, w = side, side

        # Models have constraints on frame counts (CogVideoX wants 49, etc).
        # We honor those defaults but let the user override.
        return cls(
            model_key=req.model,
            model_id=entry["model_id"],
            pipeline_class=entry["pipeline_class"],
            height=h,
            width=w,
            num_frames=req.num_frames or entry["default_frames"],
            inference_steps=req.inference_steps or entry["default_steps"],
            guidance_scale=req.guidance_scale or entry["default_guidance"],
        )

    @property
    def breakout_frame(self) -> int:
        """The frame index at which the breakout moment lands."""
        return int(round(self.num_frames * BREAKOUT_RATIO))

    @property
    def shatter_frames(self) -> int:
        return max(1, int(round(self.fps * SHATTER_DURATION_SECONDS)))
