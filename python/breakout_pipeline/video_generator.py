"""
video_generator.py — diffusers wrapper for HunyuanVideo / CogVideoX.

Single class with a single public method `generate(prompt, ...)` that
returns a (T, H, W, 3) uint8 numpy array. The class lazy-loads the
pipeline so we can keep the orchestrator's import time short.

Memory tricks applied at load time, controlled from config.CFG:
  • PipelineQuantizationConfig (bnb 4-bit) for the transformer backbone.
  • enable_model_cpu_offload — moves frozen sub-modules to CPU between
    submodule calls.
  • vae.enable_tiling — tiled decode so a single 720×1280 frame fits.

For very tight VRAM (sub-12 GB), set enable_sequential_cpu_offload in
config.py — about 4× slower but works on 8 GB consumer cards.
"""
from __future__ import annotations

import gc
import logging
from typing import Optional

import numpy as np
import torch

from .config import CFG

logger = logging.getLogger(__name__)


def _pick_compute_dtype() -> torch.dtype:
    """Ampere+ → bfloat16, older → float16."""
    if not torch.cuda.is_available():
        return torch.float32
    cap = torch.cuda.get_device_capability()
    if cap[0] >= 8:
        return torch.bfloat16
    return torch.float16


class VideoGenerator:
    """Lazy-loading wrapper around a diffusers video pipeline.

    The pipeline is loaded on first call to `generate()` and cached. Call
    `unload()` to free GPU memory between batches.
    """

    def __init__(self, cfg: CFG):
        self.cfg = cfg
        self._pipeline = None
        self._compute_dtype = _pick_compute_dtype()

    # ── lifecycle ────────────────────────────────────────────────────
    def _load_pipeline(self):
        from diffusers import DiffusionPipeline

        logger.info("Loading %s (%s)", self.cfg.model_key, self.cfg.model_id)

        load_kwargs: dict = {
            "torch_dtype": self._compute_dtype,
            "cache_dir": str(self.cfg.cache_dir),
        }

        # ── 4-bit quantisation (bnb) ──
        if self.cfg.quant_backend == "bitsandbytes_4bit":
            try:
                from diffusers import PipelineQuantizationConfig
                load_kwargs["quantization_config"] = PipelineQuantizationConfig(
                    quant_backend="bitsandbytes_4bit",
                    quant_kwargs={
                        "load_in_4bit": True,
                        "bnb_4bit_quant_type": "nf4",
                        "bnb_4bit_compute_dtype": (
                            torch.bfloat16 if self.cfg.quant_dtype == "bfloat16"
                            else torch.float16
                        ),
                    },
                    components_to_quantize=["transformer", "text_encoder"],
                )
                logger.info("  · bnb 4-bit quantisation enabled")
            except ImportError:
                logger.warning("  · PipelineQuantizationConfig unavailable; loading FP")

        pipe = DiffusionPipeline.from_pretrained(self.cfg.model_id, **load_kwargs)

        # ── CPU offload / VAE tiling ──
        if self.cfg.enable_cpu_offload:
            try:
                pipe.enable_model_cpu_offload()
                logger.info("  · model CPU offload enabled")
            except Exception as e:
                logger.warning("  · cpu offload failed: %s", e)
        elif torch.cuda.is_available():
            pipe = pipe.to("cuda")

        if self.cfg.enable_vae_tiling and hasattr(pipe, "vae"):
            try:
                pipe.vae.enable_tiling()
                logger.info("  · VAE tiling enabled")
            except Exception as e:
                logger.warning("  · vae tiling failed: %s", e)

        self._pipeline = pipe
        return pipe

    def unload(self):
        """Free GPU memory between batches."""
        self._pipeline = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()

    # ── inference ────────────────────────────────────────────────────
    @torch.inference_mode()
    def generate(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
    ) -> np.ndarray:
        """Run inference. Returns frames as (T, H, W, 3) uint8 RGB."""
        if self._pipeline is None:
            self._load_pipeline()
        assert self._pipeline is not None

        gen_kwargs: dict = {
            "prompt": prompt,
            "num_frames": self.cfg.num_frames,
            "height": self.cfg.height,
            "width": self.cfg.width,
            "num_inference_steps": self.cfg.inference_steps,
            "guidance_scale": self.cfg.guidance_scale,
        }
        if negative_prompt:
            gen_kwargs["negative_prompt"] = negative_prompt
        if seed is not None:
            gen_kwargs["generator"] = torch.Generator(
                device="cuda" if torch.cuda.is_available() else "cpu"
            ).manual_seed(seed)

        logger.info(
            "Generating %d frames at %dx%d (%d steps, guidance %.1f)",
            self.cfg.num_frames, self.cfg.width, self.cfg.height,
            self.cfg.inference_steps, self.cfg.guidance_scale,
        )

        result = self._pipeline(**gen_kwargs)

        # diffusers returns .frames as a List[List[PIL.Image]] or similar.
        # Normalise to a single (T, H, W, 3) uint8 numpy array.
        frames = self._frames_to_numpy(result)
        logger.info("  · generation complete (%s)", frames.shape)
        return frames

    @staticmethod
    def _frames_to_numpy(result) -> np.ndarray:
        """Robustly turn a diffusers result into uint8 RGB numpy."""
        frames = result.frames
        # Common shapes from diffusers video pipelines:
        #   • List[List[PIL.Image]]  (outer = batch, inner = time)
        #   • List[PIL.Image]
        #   • torch.Tensor [B, T, C, H, W] in [0, 1]
        if isinstance(frames, list):
            if len(frames) and isinstance(frames[0], list):
                frames = frames[0]
            arr = np.stack([np.asarray(f) for f in frames], axis=0)
        elif hasattr(frames, "cpu"):
            t = frames.detach().to(torch.float32).cpu().clamp_(0, 1)
            if t.ndim == 5:
                t = t[0]
            # CTHW → THWC
            if t.shape[1] in (1, 3):
                t = t.permute(0, 2, 3, 1)
            arr = (t.numpy() * 255.0).astype(np.uint8)
        else:
            raise RuntimeError(f"Unknown frames shape: {type(frames)}")

        if arr.dtype != np.uint8:
            arr = np.clip(arr, 0, 255).astype(np.uint8)
        return arr
