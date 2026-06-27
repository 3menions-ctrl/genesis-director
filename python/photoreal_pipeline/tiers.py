"""
tiers.py — resolve the concrete tool for each stage from the render tier, and
map boundary violations to the simulation they need.

PREMIUM = the honest best (Houdini / Karma / Nuke).
OPEN    = zero-licence-cost equivalents (Warp|Blender / Cycles / Natron).
"""
from __future__ import annotations

from typing import Dict

from .config import (
    CompEngine,
    RenderEngine,
    RenderProfile,
    RenderTier,
    SimEngine,
)

# Default engine per tier (used when the profile leaves one unset).
_TIER_DEFAULTS = {
    RenderTier.PREMIUM: dict(
        sim=SimEngine.HOUDINI, render=RenderEngine.KARMA, comp=CompEngine.NUKE,
    ),
    RenderTier.OPEN: dict(
        # our own headless compositor (comp_engine) is the open-tier default:
        # licence-free, deterministic, and we own the node set.
        sim=SimEngine.WARP, render=RenderEngine.CYCLES, comp=CompEngine.PROGRAMMATIC,
    ),
}

# Violation → the kind of simulation it requires (the physical phenomenon).
VIOLATION_SIM = {
    "shatter-step":  "rigid_fracture",   # Voronoi RBD
    "climb-out":     "rigid_fracture",   # glass breaks as they climb out
    "pour-liquefy":  "flip_fluid",       # FLIP/MPM liquid
    "swarm":         "particle_flock",   # POP/boids
    "peel":          "cloth_vellum",     # XPBD/Vellum cloth
    "fold-to-3d":    "rigid_fold",       # constrained rigid fold
    "reach-through": "soft_tear",        # soft-body membrane tear
}

# Which DCC node-network / solver implements each sim per engine.
SIM_SOLVER = {
    SimEngine.HOUDINI: {
        "rigid_fracture": "RBD Bullet + Voronoi Fracture",
        "flip_fluid":     "FLIP + Whitewater",
        "particle_flock": "POP + flocking DOP",
        "cloth_vellum":   "Vellum Cloth",
        "rigid_fold":     "RBD with constraints",
        "soft_tear":      "Vellum soft + tearing",
    },
    SimEngine.WARP: {
        "rigid_fracture": "warp.sim RBD + voronoi (numpy)",
        "flip_fluid":     "warp MPM",
        "particle_flock": "warp particles + boids kernel",
        "cloth_vellum":   "warp XPBD cloth",
        "rigid_fold":     "warp RBD constrained",
        "soft_tear":      "warp FEM soft + fracture",
    },
    SimEngine.BLENDER: {
        "rigid_fracture": "Cell Fracture + Rigid Body",
        "flip_fluid":     "Mantaflow liquid",
        "particle_flock": "Boids particle system",
        "cloth_vellum":   "Cloth modifier",
        "rigid_fold":     "Geometry Nodes fold",
        "soft_tear":      "Soft Body + dynamic paint",
    },
}


def resolve_profile(profile: RenderProfile) -> RenderProfile:
    """Fill any unset engine on the profile from its tier defaults."""
    d = _TIER_DEFAULTS[profile.tier]
    if profile.sim_engine is None:
        profile.sim_engine = d["sim"]
    if profile.render_engine is None:
        profile.render_engine = d["render"]
    if profile.comp_engine is None:
        profile.comp_engine = d["comp"]
    return profile


def sim_for(violation: str) -> str:
    return VIOLATION_SIM.get(violation, "rigid_fracture")


def solver_for(engine: SimEngine, sim_kind: str) -> str:
    return SIM_SOLVER.get(engine, {}).get(sim_kind, sim_kind)
