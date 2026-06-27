"""
nodes.py — the compositor's node library (real numpy ops).

A focused, production-shaped subset of what Nuke gives you, built for the
breakthrough comp: sources, Merge (Porter-Duff + blend modes), Grade,
Premult/Unpremult, Blur, Transform, depth-driven Defocus, vector MotionBlur,
LightWrap, Glow, Grain, LensDistort, Shuffle, Clamp.

Scene-linear float32 throughout. Alpha is straight (unassociated); Merge and the
filters premultiply internally where it matters so edges stay clean.
"""
from __future__ import annotations

from typing import List, Sequence, Tuple, Union

import numpy as np

from .graph import Node
from .image import Image

Num = Union[float, Sequence[float]]
EPS = 1e-6


# ─────────────────────────────────────────────────────────────────────────────
# helpers
# ─────────────────────────────────────────────────────────────────────────────
def _gauss_kernel(sigma: float) -> np.ndarray:
    radius = max(1, int(round(sigma * 3)))
    x = np.arange(-radius, radius + 1, dtype=np.float64)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    return (k / k.sum()).astype(np.float64)


def _blur_axis(a: np.ndarray, kernel: np.ndarray, axis: int) -> np.ndarray:
    n = a.shape[axis]
    radius = len(kernel) // 2
    out = np.zeros_like(a, dtype=np.float64)
    base = np.arange(n)
    for k, w in enumerate(kernel):
        idx = np.clip(base + (k - radius), 0, n - 1)
        out += w * np.take(a, idx, axis=axis)
    return out


def gaussian_blur(a: np.ndarray, sigma: float) -> np.ndarray:
    """Separable Gaussian on (H,W) or (H,W,C). sigma<=0 → unchanged."""
    if sigma <= 0:
        return a.astype(np.float64)
    k = _gauss_kernel(sigma)
    return _blur_axis(_blur_axis(a.astype(np.float64), k, 0), k, 1)


def bilinear(a: np.ndarray, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    """Sample (H,W,C) at float coords (xs,ys) with edge clamp → (H,W,C)."""
    h, w = a.shape[:2]
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int)
    x1 = x0 + 1; y1 = y0 + 1
    fx = (xs - x0)[..., None]; fy = (ys - y0)[..., None]
    x0 = np.clip(x0, 0, w - 1); x1 = np.clip(x1, 0, w - 1)
    y0 = np.clip(y0, 0, h - 1); y1 = np.clip(y1, 0, h - 1)
    Ia = a[y0, x0]; Ib = a[y0, x1]; Ic = a[y1, x0]; Id = a[y1, x1]
    top = Ia * (1 - fx) + Ib * fx
    bot = Ic * (1 - fx) + Id * fx
    return top * (1 - fy) + bot * fy


def _as3(v: Num) -> np.ndarray:
    arr = np.array(v, dtype=np.float64)
    return np.broadcast_to(arr, (3,)).astype(np.float64) if arr.ndim == 0 else \
        np.broadcast_to(arr, (3,)).astype(np.float64)


def _premult(rgb: np.ndarray, a: np.ndarray) -> np.ndarray:
    return rgb * a[..., None]


def _unpremult(rgbp: np.ndarray, a: np.ndarray) -> np.ndarray:
    out = np.zeros_like(rgbp)
    nz = a > EPS
    out[nz] = rgbp[nz] / a[nz][..., None]
    return out


# ─────────────────────────────────────────────────────────────────────────────
# sources
# ─────────────────────────────────────────────────────────────────────────────
class Constant(Node):
    def __init__(self, width: int, height: int, color: Tuple[float, ...] = (0, 0, 0, 1), **kw):
        super().__init__(**kw); self.width, self.height, self.color = width, height, color

    def compute(self, _: List[Image]) -> Image:
        img = Image.black(self.width, self.height)
        for i, c in enumerate("RGBA"):
            img.channels[c] = np.full((self.height, self.width), self.color[i], np.float32)
        return img


class Ramp(Node):
    """Horizontal 0→1 luminance ramp (test source)."""
    def __init__(self, width: int, height: int, **kw):
        super().__init__(**kw); self.width, self.height = width, height

    def compute(self, _: List[Image]) -> Image:
        g = np.linspace(0, 1, self.width, dtype=np.float32)[None, :].repeat(self.height, 0)
        img = Image.black(self.width, self.height)
        img.channels["R"] = img.channels["G"] = img.channels["B"] = g
        img.channels["A"] = np.ones_like(g)
        return img


# ─────────────────────────────────────────────────────────────────────────────
# Merge — Porter-Duff over + blend modes (fg = input 0, bg = input 1)
# ─────────────────────────────────────────────────────────────────────────────
class Merge(Node):
    def __init__(self, fg: Node, bg: Node, operation: str = "over", **kw):
        super().__init__(fg, bg, **kw); self.op = operation

    def compute(self, ins: List[Image]) -> Image:
        fg, bg = ins
        fa, ba = fg.alpha(), bg.alpha()
        Fp, Bp = _premult(fg.rgb(), fa), _premult(bg.rgb(), ba)
        op = self.op
        if op == "over":
            outp = Fp + Bp * (1 - fa)[..., None]; oa = fa + ba * (1 - fa)
        elif op in ("add", "plus"):
            outp = Fp + Bp; oa = np.clip(fa + ba, 0, 1)
        elif op == "screen":
            outp = 1 - (1 - Fp) * (1 - Bp); oa = 1 - (1 - fa) * (1 - ba)
        elif op == "multiply":
            outp = Fp * Bp; oa = fa * ba
        elif op == "max":
            outp = np.maximum(Fp, Bp); oa = np.maximum(fa, ba)
        elif op == "min":
            outp = np.minimum(Fp, Bp); oa = np.minimum(fa, ba)
        elif op == "mask":  # bg shaped by fg alpha
            out = bg.copy(); out.channels["A"] = (ba * fa).astype(np.float32); return out
        else:
            raise ValueError(f"unknown Merge op {op!r}")
        straight = _unpremult(outp, oa)
        out = bg.copy()  # preserve bg AOVs
        return out.with_rgba(straight, oa)


# ─────────────────────────────────────────────────────────────────────────────
# Grade — Nuke-style
# ─────────────────────────────────────────────────────────────────────────────
class Grade(Node):
    def __init__(self, src: Node, blackpoint: Num = 0.0, whitepoint: Num = 1.0,
                 lift: Num = 0.0, gain: Num = 1.0, multiply: Num = 1.0,
                 offset: Num = 0.0, gamma: Num = 1.0, **kw):
        super().__init__(src, **kw)
        self.bp, self.wp, self.lift, self.gain = _as3(blackpoint), _as3(whitepoint), _as3(lift), _as3(gain)
        self.mult, self.off, self.gamma = _as3(multiply), _as3(offset), _as3(gamma)

    def compute(self, ins: List[Image]) -> Image:
        rgb = ins[0].rgb()
        denom = np.where(np.abs(self.wp - self.bp) < EPS, EPS, self.wp - self.bp)
        A = (self.gain - self.lift) / denom
        B = self.lift - A * self.bp
        out = rgb * A + B
        out = out * self.mult + self.off
        g = np.where(self.gamma < EPS, EPS, self.gamma)
        out = np.where(out > 0, np.power(np.maximum(out, 0), 1.0 / g), out)
        return ins[0].with_rgb(out.astype(np.float32))


# ─────────────────────────────────────────────────────────────────────────────
# Premult / Unpremult / Clamp / Shuffle
# ─────────────────────────────────────────────────────────────────────────────
class Premult(Node):
    def compute(self, ins): return ins[0].with_rgb(_premult(ins[0].rgb(), ins[0].alpha()))


class Unpremult(Node):
    def compute(self, ins): return ins[0].with_rgb(_unpremult(ins[0].rgb(), ins[0].alpha()))


class Clamp(Node):
    def __init__(self, src, lo=0.0, hi=1.0, **kw): super().__init__(src, **kw); self.lo, self.hi = lo, hi
    def compute(self, ins): return ins[0].with_rgb(np.clip(ins[0].rgb(), self.lo, self.hi))


class Shuffle(Node):
    """Copy one channel into RGB (AOV inspection / extraction)."""
    def __init__(self, src, channel="Z", **kw): super().__init__(src, **kw); self.channel = channel
    def compute(self, ins):
        c = ins[0].get(self.channel)
        return ins[0].with_rgb(np.stack([c, c, c], -1))


# ─────────────────────────────────────────────────────────────────────────────
# Blur (premultiplied for clean edges)
# ─────────────────────────────────────────────────────────────────────────────
class Blur(Node):
    def __init__(self, src, size=5.0, **kw): super().__init__(src, **kw); self.sigma = size / 2.0
    def compute(self, ins):
        img = ins[0]; a = img.alpha()
        rgbp = gaussian_blur(_premult(img.rgb(), a), self.sigma)
        ab = gaussian_blur(a, self.sigma)
        return img.with_rgba(_unpremult(rgbp, ab).astype(np.float32), ab.astype(np.float32))


# ─────────────────────────────────────────────────────────────────────────────
# Transform (affine, backward-mapped, bilinear)
# ─────────────────────────────────────────────────────────────────────────────
class Transform(Node):
    def __init__(self, src, translate=(0.0, 0.0), scale=(1.0, 1.0), rotate=0.0, **kw):
        super().__init__(src, **kw); self.t = translate; self.s = scale; self.r = np.deg2rad(rotate)

    def compute(self, ins):
        img = ins[0]; h, w = img.height, img.width
        cx, cy = w / 2, h / 2
        ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
        # inverse transform: undo translate, then rotate/scale about centre
        x = xs - cx - self.t[0]; y = ys - cy - self.t[1]
        cos, sin = np.cos(-self.r), np.sin(-self.r)
        xr = (x * cos - y * sin) / max(self.s[0], EPS)
        yr = (x * sin + y * cos) / max(self.s[1], EPS)
        sx = xr + cx; sy = yr + cy
        a = img.alpha()
        rgbp = bilinear(_premult(img.rgb(), a), sx, sy)
        ab = bilinear(a[..., None], sx, sy)[..., 0]
        return img.with_rgba(_unpremult(rgbp, ab).astype(np.float32), ab.astype(np.float32))


# ─────────────────────────────────────────────────────────────────────────────
# Defocus — depth-driven DOF (layered blur, lerped by circle-of-confusion)
# ─────────────────────────────────────────────────────────────────────────────
class Defocus(Node):
    def __init__(self, src, depth="Z", focus=1.0, max_blur=20.0, aperture=1.0, **kw):
        super().__init__(src, **kw)
        self.depth, self.focus, self.max_blur, self.aperture = depth, focus, max_blur, aperture

    def compute(self, ins):
        img = ins[0]
        z = img.get(self.depth, self.focus)
        coc = np.clip(np.abs(z - self.focus) * self.aperture, 0, 1)  # 0..1 normalised
        a = img.alpha()
        rgbp = _premult(img.rgb(), a)
        sigmas = [0.0, self.max_blur / 4, self.max_blur / 2, self.max_blur]
        levels = [gaussian_blur(rgbp, s) for s in (np.array(sigmas) / 2.0)]
        alevels = [gaussian_blur(a, s) for s in (np.array(sigmas) / 2.0)]
        idx = coc * (len(levels) - 1)
        lo = np.floor(idx).astype(int); hi = np.clip(lo + 1, 0, len(levels) - 1)
        f = (idx - lo)[..., None]
        out_rgbp = np.zeros_like(rgbp); out_a = np.zeros_like(a)
        for L in range(len(levels)):
            mlo = (lo == L)[..., None]; mhi = (hi == L)[..., None]
            out_rgbp += np.where(mlo, levels[L] * (1 - f), 0) + np.where(mhi, levels[L] * f, 0)
            out_a += np.where((lo == L), alevels[L] * (1 - f[..., 0]), 0) \
                + np.where((hi == L), alevels[L] * f[..., 0], 0)
        return img.with_rgba(_unpremult(out_rgbp, out_a).astype(np.float32), out_a.astype(np.float32))


# ─────────────────────────────────────────────────────────────────────────────
# MotionBlur — per-pixel backward gather along motion vectors
# ─────────────────────────────────────────────────────────────────────────────
class MotionBlur(Node):
    def __init__(self, src, mx="motion.x", my="motion.y", samples=9, shutter=1.0, **kw):
        super().__init__(src, **kw); self.mx, self.my, self.samples, self.shutter = mx, my, samples, shutter

    def compute(self, ins):
        img = ins[0]; h, w = img.height, img.width
        vx = img.get(self.mx, 0.0); vy = img.get(self.my, 0.0)
        a = img.alpha(); rgbp = _premult(img.rgb(), a)
        ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
        acc_rgb = np.zeros_like(rgbp); acc_a = np.zeros((h, w))
        ts = np.linspace(-self.shutter / 2, self.shutter / 2, self.samples)
        for t in ts:
            acc_rgb += bilinear(rgbp, xs - t * vx, ys - t * vy)
            acc_a += bilinear(a[..., None], xs - t * vx, ys - t * vy)[..., 0]
        acc_rgb /= self.samples; acc_a /= self.samples
        return img.with_rgba(_unpremult(acc_rgb, acc_a).astype(np.float32), acc_a.astype(np.float32))


# ─────────────────────────────────────────────────────────────────────────────
# LightWrap — bleed background light onto the foreground edge (bg=0, fg=1)
# ─────────────────────────────────────────────────────────────────────────────
class LightWrap(Node):
    def __init__(self, bg: Node, fg: Node, size=12.0, intensity=1.0, **kw):
        super().__init__(bg, fg, **kw); self.size = size; self.intensity = intensity

    def compute(self, ins):
        bg, fg = ins
        fa = fg.alpha()
        bg_light = gaussian_blur(bg.rgb() * (1 - fa)[..., None], self.size / 2)
        wrap = bg_light * fa[..., None] * self.intensity
        wrapped = 1 - (1 - fg.rgb()) * (1 - np.clip(wrap, 0, 1))  # screen
        return fg.with_rgb(wrapped.astype(np.float32))


# ─────────────────────────────────────────────────────────────────────────────
# Glow — threshold highlights, blur, screen back
# ─────────────────────────────────────────────────────────────────────────────
class Glow(Node):
    def __init__(self, src, threshold=0.7, size=14.0, gain=1.0, **kw):
        super().__init__(src, **kw); self.threshold, self.size, self.gain = threshold, size, gain

    def compute(self, ins):
        rgb = ins[0].rgb()
        lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
        mask = np.clip(lum - self.threshold, 0, None)[..., None]
        glow = gaussian_blur(mask * rgb * self.gain, self.size / 2)
        out = 1 - (1 - rgb) * (1 - np.clip(glow, 0, 1))
        return ins[0].with_rgb(out.astype(np.float32))


# ─────────────────────────────────────────────────────────────────────────────
# Grain — deterministic, seeded; luminance + small chroma; optional softening
# ─────────────────────────────────────────────────────────────────────────────
class Grain(Node):
    def __init__(self, src, intensity=0.02, size=0.0, seed=1, **kw):
        super().__init__(src, **kw); self.intensity, self.size, self.seed = intensity, size, seed

    def compute(self, ins):
        img = ins[0]; h, w = img.height, img.width
        rng = np.random.default_rng(self.seed)
        lum = rng.standard_normal((h, w, 1)) * self.intensity
        chroma = rng.standard_normal((h, w, 3)) * (self.intensity * 0.3)
        noise = lum + chroma
        if self.size > 0:
            noise = gaussian_blur(noise, self.size / 2)
        return img.with_rgb((img.rgb() + noise).astype(np.float32))


# ─────────────────────────────────────────────────────────────────────────────
# LensDistort — radial (barrel/pincushion)
# ─────────────────────────────────────────────────────────────────────────────
class LensDistort(Node):
    def __init__(self, src, k1=0.0, k2=0.0, **kw):
        super().__init__(src, **kw); self.k1, self.k2 = k1, k2

    def compute(self, ins):
        img = ins[0]; h, w = img.height, img.width
        cx, cy = w / 2, h / 2
        ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
        nx = (xs - cx) / cx; ny = (ys - cy) / cy
        r2 = nx * nx + ny * ny
        f = 1 + self.k1 * r2 + self.k2 * r2 * r2
        sx = nx * f * cx + cx; sy = ny * f * cy + cy
        a = img.alpha(); rgbp = bilinear(_premult(img.rgb(), a), sx, sy)
        ab = bilinear(a[..., None], sx, sy)[..., 0]
        return img.with_rgba(_unpremult(rgbp, ab).astype(np.float32), ab.astype(np.float32))
