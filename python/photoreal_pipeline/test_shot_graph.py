"""
Unit tests for the photoreal shot-graph compiler. Pure stdlib — runnable with:

    cd python && python3 -m unittest photoreal_pipeline.test_shot_graph -v
"""
from __future__ import annotations

import unittest

from .config import (
    EnvironmentMode, RenderProfile, RenderTier, ShotSpec, SubjectMode,
)
from .shot_graph import StageKind, compile_shot_graph


def real_clip_spec(**over) -> ShotSpec:
    prof = RenderProfile(
        tier=RenderTier.OPEN,
        subject_mode=SubjectMode.REAL_CLIP,
        environment_mode=EnvironmentMode.GAUSSIAN_SPLAT,
    )
    base = dict(
        id="shot-social", violation="climb-out", destination="toward-viewer",
        container_kind="social-feed", subject_asset="user.mp4",
        container_photos=["a.jpg", "b.jpg", "c.jpg"], profile=prof,
    )
    base.update(over)
    return ShotSpec(**base)


class TestShotGraph(unittest.TestCase):
    def test_compiles_and_validates(self):
        g = compile_shot_graph(real_clip_spec())
        self.assertEqual(g.validate(), [])

    def test_topo_order_respects_deps_and_ends_in_encode(self):
        g = compile_shot_graph(real_clip_spec())
        order = g.topo_order()
        pos = {s.id: i for i, s in enumerate(order)}
        for s in g.stages:
            for d in s.depends_on:
                self.assertLess(pos[d], pos[s.id], f"{d} must precede {s.id}")
        self.assertEqual(order[-1].kind, StageKind.ENCODE)

    def test_real_clip_has_matte_and_track(self):
        g = compile_shot_graph(real_clip_spec())
        kinds = {s.kind for s in g.stages}
        self.assertIn(StageKind.MATTE, kinds)
        self.assertIn(StageKind.TRACK, kinds)
        self.assertNotIn(StageKind.GEN_SUBJECT, kinds)

    def test_generated_subject_swaps_in_a_gen_stage_no_track(self):
        prof = RenderProfile(subject_mode=SubjectMode.GENERATED,
                             environment_mode=EnvironmentMode.GAUSSIAN_SPLAT)
        g = compile_shot_graph(real_clip_spec(subject_asset=None, profile=prof))
        kinds = {s.kind for s in g.stages}
        self.assertIn(StageKind.GEN_SUBJECT, kinds)
        self.assertNotIn(StageKind.TRACK, kinds)  # no real plate to solve

    def test_image_3d_adds_subject_mesh(self):
        prof = RenderProfile(subject_mode=SubjectMode.IMAGE_3D,
                             environment_mode=EnvironmentMode.GAUSSIAN_SPLAT)
        g = compile_shot_graph(real_clip_spec(profile=prof))
        self.assertIn(StageKind.SUBJECT_3D, {s.kind for s in g.stages})

    def test_environment_mode_selects_tool(self):
        prof = RenderProfile(subject_mode=SubjectMode.REAL_CLIP,
                             environment_mode=EnvironmentMode.DEPTH_DISPLACE)
        g = compile_shot_graph(real_clip_spec(
            container_photos=[], container_still="chrome.png", profile=prof))
        env = next(s for s in g.stages if s.kind == StageKind.ENVIRONMENT)
        self.assertEqual(env.tool, "depth-anything-v2")
        # splat env uses gsplat
        g2 = compile_shot_graph(real_clip_spec())
        env2 = next(s for s in g2.stages if s.kind == StageKind.ENVIRONMENT)
        self.assertEqual(env2.tool, "gsplat")

    def test_violation_maps_to_sim_kind(self):
        cases = {
            "shatter-step": "rigid_fracture", "pour-liquefy": "flip_fluid",
            "swarm": "particle_flock", "peel": "cloth_vellum",
        }
        for v, kind in cases.items():
            g = compile_shot_graph(real_clip_spec(violation=v))
            sim = next(s for s in g.stages if s.kind == StageKind.SIMULATE)
            self.assertEqual(sim.params["sim_kind"], kind)

    def test_tier_resolves_engines(self):
        # premium → houdini / karma / nuke
        prof = RenderProfile(tier=RenderTier.PREMIUM, subject_mode=SubjectMode.REAL_CLIP,
                             environment_mode=EnvironmentMode.GAUSSIAN_SPLAT)
        g = compile_shot_graph(real_clip_spec(profile=prof))
        tools = {s.kind: s.tool for s in g.stages}
        self.assertEqual(tools[StageKind.SIMULATE], "houdini")
        self.assertEqual(tools[StageKind.RENDER], "karma")
        self.assertEqual(tools[StageKind.COMP], "nuke")
        # open → warp / cycles / our own compositor (programmatic)
        g2 = compile_shot_graph(real_clip_spec())
        tools2 = {s.kind: s.tool for s in g2.stages}
        self.assertEqual(tools2[StageKind.SIMULATE], "warp")
        self.assertEqual(tools2[StageKind.RENDER], "cycles")
        self.assertEqual(tools2[StageKind.COMP], "programmatic")

    def test_comp_depends_on_subject_and_render(self):
        g = compile_shot_graph(real_clip_spec())
        comp = next(s for s in g.stages if s.kind == StageKind.COMP)
        dep_kinds = {g.by_id(d).kind for d in comp.depends_on}
        self.assertIn(StageKind.MATTE, dep_kinds)     # subject alpha
        self.assertIn(StageKind.RENDER, dep_kinds)    # beauty + aovs
        self.assertIn(StageKind.ENVIRONMENT, dep_kinds)

    def test_invalid_specs_raise(self):
        with self.assertRaises(ValueError):
            compile_shot_graph(real_clip_spec(violation="teleport"))
        with self.assertRaises(ValueError):
            # splat env without photos
            compile_shot_graph(real_clip_spec(container_photos=[]))

    def test_deterministic(self):
        a = compile_shot_graph(real_clip_spec()).to_dict()
        b = compile_shot_graph(real_clip_spec()).to_dict()
        self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main()
