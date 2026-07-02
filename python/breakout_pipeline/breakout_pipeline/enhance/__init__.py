"""Post-generation enhancement modules.

  • interpolate.py — RIFE / FILM frame interpolation to bump 24 → 60 fps.
  • upscale.py     — Real-ESRGAN 4× upscaling (with auto-fallback).
  • depth.py       — Depth-Anything-V2 depth maps for parallax / DOF.
  • identity.py    — PuLID / IP-Adapter subject preservation.
"""
from .interpolate import interpolate_video
from .upscale import upscale_video
from .depth import estimate_depth
from .identity import apply_subject_identity

__all__ = ["interpolate_video", "upscale_video", "estimate_depth", "apply_subject_identity"]
