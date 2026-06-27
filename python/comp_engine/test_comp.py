"""
Unit tests for the compositor — real numpy ops on tiny images.

Run (needs numpy):
    cd python && .venv_comp/bin/python -m unittest comp_engine.test_comp -v
"""
from __future__ import annotations

import unittest

import numpy as np

from .graph import Node, evaluate, topo_order
from .image import Image
from .nodes import (
    Blur, Clamp, Constant, Defocus, Glow, Grade, Grain, LensDistort, LightWrap,
    Merge, MotionBlur, Premult, Ramp, Shuffle, Transform, Unpremult,
)
from .recipes import Source, make_demo


def solid(w, h, rgb, a=1.0, extra=None) -> Image:
    img = Image.black(w, h)
    img.channels["R"][:] = rgb[0]; img.channels["G"][:] = rgb[1]; img.channels["B"][:] = rgb[2]
    img.channels["A"][:] = a
    for k, v in (extra or {}).items():
        img.channels[k] = np.full((h, w), v, np.float32)
    return img


class CountSource(Node):
    def __init__(self, img): super().__init__(); self._img = img; self.calls = 0
    def compute(self, _): self.calls += 1; return self._img


class TestGraph(unittest.TestCase):
    def test_memoised_once_when_fanned_out(self):
        src = CountSource(solid(4, 4, (1, 0, 0)))
        a = Grade(src, gain=2.0); b = Grade(src, gamma=2.0)
        merged = Merge(a, b)
        evaluate(merged)
        self.assertEqual(src.calls, 1, "shared input must compute once")

    def test_cycle_detected(self):
        n = Grade(Constant(2, 2))
        n.inputs.append(n)  # force a cycle
        with self.assertRaises(ValueError):
            evaluate(n)
        with self.assertRaises(ValueError):
            topo_order(n)

    def test_topo_inputs_before_node(self):
        src = Constant(2, 2); g = Grade(src)
        order = topo_order(g)
        self.assertLess(order.index(src), order.index(g))


class TestMerge(unittest.TestCase):
    def test_over_full_alpha_is_fg(self):
        fg = Source(solid(2, 2, (1, 0, 0), 1.0)); bg = Source(solid(2, 2, (0, 0, 1), 1.0))
        out = evaluate(Merge(fg, bg, "over"))
        np.testing.assert_allclose(out.rgb()[0, 0], [1, 0, 0], atol=1e-5)

    def test_over_zero_alpha_is_bg(self):
        fg = Source(solid(2, 2, (1, 0, 0), 0.0)); bg = Source(solid(2, 2, (0, 0, 1), 1.0))
        out = evaluate(Merge(fg, bg, "over"))
        np.testing.assert_allclose(out.rgb()[0, 0], [0, 0, 1], atol=1e-5)

    def test_over_half_alpha_blend(self):
        fg = Source(solid(2, 2, (1, 0, 0), 0.5)); bg = Source(solid(2, 2, (0, 0, 1), 1.0))
        out = evaluate(Merge(fg, bg, "over"))
        np.testing.assert_allclose(out.rgb()[0, 0], [0.5, 0, 0.5], atol=1e-5)
        np.testing.assert_allclose(out.alpha()[0, 0], 1.0, atol=1e-5)

    def test_multiply(self):
        fg = Source(solid(2, 2, (0.5, 1, 1))); bg = Source(solid(2, 2, (0.4, 1, 1)))
        out = evaluate(Merge(fg, bg, "multiply"))
        self.assertAlmostEqual(float(out.rgb()[0, 0, 0]), 0.2, places=5)


class TestSourcesAndUtility(unittest.TestCase):
    def test_ramp_left_to_right(self):
        out = evaluate(Ramp(10, 4))
        self.assertAlmostEqual(float(out.rgb()[0, 0, 0]), 0.0, places=5)   # left ≈ 0
        self.assertAlmostEqual(float(out.rgb()[0, -1, 0]), 1.0, places=5)  # right ≈ 1

    def test_clamp_bounds(self):
        src = solid(4, 4, (-0.5, 0.5, 2.0))
        out = evaluate(Clamp(Source(src), lo=0.0, hi=1.0))
        np.testing.assert_allclose(out.rgb()[0, 0], [0.0, 0.5, 1.0], atol=1e-6)

    def test_shuffle_copies_channel_to_rgb(self):
        img = solid(4, 4, (0, 0, 0), extra={"Z": 0.7})
        out = evaluate(Shuffle(Source(img), channel="Z"))
        np.testing.assert_allclose(out.rgb()[0, 0], [0.7, 0.7, 0.7], atol=1e-6)


class TestColorOps(unittest.TestCase):
    def test_grade_gain_doubles(self):
        out = evaluate(Grade(Source(solid(2, 2, (0.25, 0.25, 0.25))), gain=2.0))
        np.testing.assert_allclose(out.rgb()[0, 0], [0.5, 0.5, 0.5], atol=1e-5)

    def test_grade_identity(self):
        src = solid(2, 2, (0.3, 0.6, 0.9))
        out = evaluate(Grade(Source(src)))
        np.testing.assert_allclose(out.rgb(), src.rgb(), atol=1e-5)

    def test_premult_roundtrip(self):
        src = solid(3, 3, (0.4, 0.5, 0.6), 0.5)
        out = evaluate(Unpremult(Premult(Source(src))))
        np.testing.assert_allclose(out.rgb(), src.rgb(), atol=1e-5)


class TestFilters(unittest.TestCase):
    def test_blur_constant_unchanged(self):
        out = evaluate(Blur(Source(solid(8, 8, (0.5, 0.5, 0.5))), size=4))
        np.testing.assert_allclose(out.rgb(), 0.5, atol=1e-4)

    def test_blur_spreads_a_spike(self):
        img = Image.black(9, 9); img.channels["A"][:] = 1
        img.channels["R"][4, 4] = 1.0
        out = evaluate(Blur(Source(img), size=4))
        self.assertLess(out.rgb()[4, 4, 0], 1.0)        # peak lowered
        self.assertGreater(out.rgb()[4, 5, 0], 0.0)     # spread to neighbour

    def test_transform_translate_shifts(self):
        img = Image.black(8, 8); img.channels["A"][:] = 1; img.channels["R"][4, 2] = 1.0
        out = evaluate(Transform(Source(img), translate=(2, 0)))
        self.assertGreater(out.rgb()[4, 4, 0], 0.5)     # moved +2 in x

    def test_defocus_keeps_focus_blurs_far(self):
        # checker in RGB; Z=focus on left half, far on right half
        h = w = 16
        img = Image.black(w, h, names=("R", "G", "B", "A", "Z"))
        img.channels["A"][:] = 1
        img.channels["R"][:, ::2] = 1.0  # vertical stripes (high freq)
        img.channels["Z"][:, :w // 2] = 0.2   # in focus
        img.channels["Z"][:, w // 2:] = 1.0   # far → blurred
        out = evaluate(Defocus(Source(img), depth="Z", focus=0.2, max_blur=14))
        left_var = out.rgb()[:, :w // 2, 0].var()
        right_var = out.rgb()[:, w // 2:, 0].var()
        self.assertGreater(left_var, right_var)         # focused half keeps detail

    def test_motionblur_zero_is_identity(self):
        img = solid(8, 8, (0.3, 0.3, 0.3), extra={"motion.x": 0.0, "motion.y": 0.0})
        out = evaluate(MotionBlur(Source(img)))
        np.testing.assert_allclose(out.rgb(), img.rgb(), atol=1e-4)

    def test_motionblur_smears_horizontally(self):
        h = w = 16
        img = Image.black(w, h, names=("R", "G", "B", "A", "motion.x", "motion.y"))
        img.channels["A"][:] = 1
        img.channels["R"][:, w // 2:] = 1.0     # sharp vertical edge
        img.channels["motion.x"][:] = 8.0
        out = evaluate(MotionBlur(Source(img), samples=9, shutter=1.0))
        col = out.rgb()[8, w // 2 - 1, 0]       # just left of the edge
        self.assertGreater(col, 0.05)           # smeared across the edge


class TestCompNodes(unittest.TestCase):
    def test_lightwrap_edge_gains_interior_stable(self):
        # disc radius (22) must exceed the wrap blur radius so the interior is
        # genuinely "far from the edge"; otherwise light correctly wraps inward.
        N = 64
        bg = Source(solid(N, N, (1, 1, 1)))           # bright white env
        fgimg = Image.black(N, N)
        cx = cy = 32
        ys, xs = np.mgrid[0:N, 0:N]
        disc = (np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) < 22).astype(np.float32)
        fgimg.channels["A"] = disc
        for c in "RGB": fgimg.channels[c] = disc * 0.2
        out = evaluate(LightWrap(bg, Source(fgimg), size=8, intensity=1.0))
        center = out.rgb()[32, 32, 0]                 # 22px from edge ≫ wrap radius
        edge = out.rgb()[32, 52, 0]                   # 2px inside the edge
        self.assertAlmostEqual(center, 0.2, places=2) # interior ≈ base
        self.assertGreater(edge, 0.25)                # edge picks up bg light

    def test_glow_spreads(self):
        img = Image.black(24, 24); img.channels["A"][:] = 1
        img.channels["R"][12, 12] = img.channels["G"][12, 12] = img.channels["B"][12, 12] = 2.0
        out = evaluate(Glow(Source(img), threshold=0.5, size=10, gain=1.0))
        self.assertGreater(out.rgb()[12, 16, 0], 0.0)  # glow bled outward

    def test_grain_deterministic(self):
        src = Source(solid(16, 16, (0.5, 0.5, 0.5)))
        a = evaluate(Grain(src, intensity=0.05, seed=42)).rgb()
        b = evaluate(Grain(src, intensity=0.05, seed=42)).rgb()
        c = evaluate(Grain(src, intensity=0.05, seed=43)).rgb()
        np.testing.assert_allclose(a, b)               # same seed identical
        self.assertFalse(np.allclose(a, c))            # different seed differs
        self.assertAlmostEqual(float(a.mean()), 0.5, places=2)  # mean preserved

    def test_lensdistort_center_stable(self):
        img = Image.black(32, 32); img.channels["A"][:] = 1
        img.channels["R"][16, 16] = 1.0
        out = evaluate(LensDistort(Source(img), k1=0.3))
        self.assertGreater(out.rgb()[16, 16, 0], 0.5)  # centre roughly preserved


class TestRecipe(unittest.TestCase):
    def test_demo_renders_and_is_deterministic(self):
        a = evaluate(make_demo(96, 120))
        b = evaluate(make_demo(96, 120))
        self.assertEqual(a.rgba().shape, (120, 96, 4))
        self.assertTrue(np.isfinite(a.rgba()).all())
        np.testing.assert_allclose(a.rgba(), b.rgba())  # deterministic
        self.assertGreater(a.rgb().mean(), 0.01)        # not black


if __name__ == "__main__":
    unittest.main()
