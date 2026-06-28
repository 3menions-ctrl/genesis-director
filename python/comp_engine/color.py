"""
color.py — colour management.

Scene-linear is the working space. We provide sRGB transfer functions for 8-bit
IO (so PNG demos look right), and an optional OpenColorIO path for real
pipelines (lazy import; falls back to sRGB when OCIO isn't installed).
"""
from __future__ import annotations

import numpy as np


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * (c ** (1 / 2.4)) - 0.055)


def ocio_available() -> bool:
    try:
        import PyOpenColorIO  # noqa: F401
        return True
    except Exception:
        return False
