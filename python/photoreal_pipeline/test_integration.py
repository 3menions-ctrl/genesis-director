"""
Cross-package integration: the photoreal pipeline's COMP stage actually drives
our compositor (comp_engine).

Needs numpy:
    cd python && .venv_comp/bin/python -m unittest photoreal_pipeline.test_integration -v
"""
from __future__ import annotations

import unittest

import numpy as np

from comp_engine import Image
from .comp import run_comp
from .shot_graph import StageKind, compile_shot_graph
from .stages import build_invocation
from .test_shot_graph import real_clip_spec


def _beauty(w, h):
    img = Image.black(w, h, names=("R", "G", "B", "A", "Z", "motion.x", "motion.y"))
    img.channels["R"][:] = 0.2; img.channels["B"][:] = 0.3; img.channels["A"][:] = 1
    img.channels["Z"][:] = 0.8
    img.channels["motion.x"][:] = 4.0
    return img


def _subject(w, h):
    img = Image.black(w, h)
    ys, xs = np.mgrid[0:h, 0:w]
    disc = (np.sqrt((xs - w / 2) ** 2 + (ys - h / 2) ** 2) < min(w, h) * 0.3).astype(np.float32)
    img.channels["A"] = disc
    for c in "RGB":
        img.channels[c] = disc * 0.8
    return img


class TestCompIntegration(unittest.TestCase):
    def test_open_tier_comp_stage_calls_our_engine(self):
        g = compile_shot_graph(real_clip_spec())
        comp = next(s for s in g.stages if s.kind == StageKind.COMP)
        self.assertEqual(comp.tool, "programmatic")
        inv = build_invocation(comp)
        self.assertIn("photoreal_pipeline.comp", " ".join(inv.command))
        self.assertIn("numpy", inv.requires)

    def test_run_comp_produces_a_finished_frame(self):
        out = run_comp(_beauty(80, 100), _subject(80, 100))
        self.assertEqual(out.rgba().shape, (100, 80, 4))
        self.assertTrue(np.isfinite(out.rgba()).all())
        self.assertGreater(out.rgb().mean(), 0.01)   # composited something

    def test_run_comp_is_deterministic(self):
        a = run_comp(_beauty(48, 48), _subject(48, 48)).rgba()
        b = run_comp(_beauty(48, 48), _subject(48, 48)).rgba()
        np.testing.assert_allclose(a, b)


if __name__ == "__main__":
    unittest.main()
