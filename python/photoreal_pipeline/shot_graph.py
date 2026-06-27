"""
shot_graph.py — compile a ShotSpec into a deterministic DAG of stage jobs.

This is the orchestration brain: same spec → same graph, every time. Pure
stdlib + unit-tested, so it runs anywhere even though the stages it schedules
need GPU/licensed tools to execute.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional

from .config import EnvironmentMode, ShotSpec, SubjectMode
from .tiers import resolve_profile, sim_for, solver_for


class StageKind(str, Enum):
    GEN_SUBJECT = "gen_subject"
    INGEST = "ingest"
    TRACK = "track"
    MATTE = "matte"
    SUBJECT_3D = "subject_3d"
    ENVIRONMENT = "environment"
    SIMULATE = "simulate"
    ASSEMBLE = "assemble"
    RENDER = "render"
    COMP = "comp"
    ENCODE = "encode"


@dataclass
class Artifact:
    name: str   # handle, e.g. "@subject_rgba"
    kind: str   # video | alpha | camera | splat | mesh | geo_cache | usd | exr_seq | final


@dataclass
class StageSpec:
    id: str
    kind: StageKind
    tool: str
    depends_on: List[str]
    params: Dict[str, object]
    produces: List[Artifact]


@dataclass
class ShotGraph:
    shot_id: str
    stages: List[StageSpec] = field(default_factory=list)

    def by_id(self, sid: str) -> Optional[StageSpec]:
        return next((s for s in self.stages if s.id == sid), None)

    def validate(self) -> List[str]:
        errs: List[str] = []
        ids = {s.id for s in self.stages}
        if len(ids) != len(self.stages):
            errs.append("duplicate stage ids")
        for s in self.stages:
            for d in s.depends_on:
                if d not in ids:
                    errs.append(f"stage {s.id!r} depends on missing {d!r}")
        # must end at a single encode → @final
        finals = [s for s in self.stages if s.kind == StageKind.ENCODE]
        if len(finals) != 1:
            errs.append("graph must contain exactly one encode stage")
        try:
            self.topo_order()
        except ValueError as e:
            errs.append(str(e))
        return errs

    def topo_order(self) -> List[StageSpec]:
        """Kahn topological sort; raises ValueError on a cycle."""
        # count UNIQUE predecessors (a stage may reference two artifacts from
        # the same producer, e.g. comp ← render's @beauty + @aovs)
        indeg = {s.id: len(set(s.depends_on)) for s in self.stages}
        # deterministic queue: preserve insertion order among ready stages
        ready = [s for s in self.stages if indeg[s.id] == 0]
        out: List[StageSpec] = []
        while ready:
            s = ready.pop(0)
            out.append(s)
            for t in self.stages:
                if s.id in t.depends_on:
                    indeg[t.id] -= 1
                    if indeg[t.id] == 0:
                        ready.append(t)
        if len(out) != len(self.stages):
            raise ValueError("shot graph has a cycle")
        return out

    def to_dict(self) -> Dict[str, object]:
        return {
            "shot_id": self.shot_id,
            "stages": [
                {
                    "id": s.id, "kind": s.kind.value, "tool": s.tool,
                    "depends_on": s.depends_on, "params": s.params,
                    "produces": [{"name": a.name, "kind": a.kind} for a in s.produces],
                }
                for s in self.topo_order()
            ],
        }


def compile_shot_graph(spec: ShotSpec) -> ShotGraph:
    """ShotSpec → deterministic stage DAG. Validates the spec first."""
    errs = spec.validate()
    if errs:
        raise ValueError(f"invalid ShotSpec {spec.id!r}: " + "; ".join(errs))

    p = resolve_profile(spec.profile)
    g = ShotGraph(shot_id=spec.id)
    handles: Dict[str, str] = {}  # artifact handle → producing stage id

    def add(stage: StageSpec) -> StageSpec:
        g.stages.append(stage)
        for a in stage.produces:
            handles[a.name] = stage.id
        return stage

    def dep(*names: str) -> List[str]:
        out: List[str] = []
        for n in names:
            pid = handles.get(n)
            if pid is not None and pid not in out:
                out.append(pid)  # unique producers, insertion order
        return out

    sid = lambda k: f"{spec.id}:{k}"

    # ── Subject branch ────────────────────────────────────────────────────
    has_plate = spec.profile.subject_mode == SubjectMode.REAL_CLIP
    if spec.profile.subject_mode == SubjectMode.GENERATED:
        add(StageSpec(sid("gen_subject"), StageKind.GEN_SUBJECT, "generate-video",
                      [], {"prompt": "subject performing the action on neutral bg"},
                      [Artifact("@subject_clip", "video")]))
        add(StageSpec(sid("ingest"), StageKind.INGEST, "ffmpeg",
                      dep("@subject_clip"), {"linearise": True},
                      [Artifact("@plate", "video")]))
    else:
        add(StageSpec(sid("ingest"), StageKind.INGEST, "ffmpeg",
                      [], {"source": spec.subject_asset, "linearise": True},
                      [Artifact("@plate", "video")]))

    add(StageSpec(sid("matte"), StageKind.MATTE,
                  "matanyone2" if p.tier.value == "open" else "silhouette+matanyone2",
                  dep("@plate"), {"refine_edges": True, "despill": True},
                  [Artifact("@subject_rgba", "alpha")]))

    if spec.profile.subject_mode == SubjectMode.IMAGE_3D:
        add(StageSpec(sid("subject_3d"), StageKind.SUBJECT_3D, "trellis2",
                      dep("@plate"), {"rigged": True},
                      [Artifact("@subject_mesh", "mesh")]))

    # camera solve only when there's a real plate to track
    if has_plate:
        add(StageSpec(sid("track"), StageKind.TRACK, "colmap",
                      dep("@plate"), {"refine_intrinsics": True},
                      [Artifact("@camera", "camera")]))

    # ── Environment ───────────────────────────────────────────────────────
    if p.environment_mode == EnvironmentMode.GAUSSIAN_SPLAT:
        env_tool, env_params, env_in = "gsplat", {"photos": spec.container_photos}, []
        env_art = Artifact("@env", "splat")
    elif p.environment_mode == EnvironmentMode.DEPTH_DISPLACE:
        env_tool, env_params, env_in = "depth-anything-v2", {"still": spec.container_still}, []
        env_art = Artifact("@env", "mesh")
    elif p.environment_mode == EnvironmentMode.BUILT_3D:
        env_tool, env_params, env_in = "blender-build", {"kind": spec.container_kind}, []
        env_art = Artifact("@env", "mesh")
    else:  # PLATE_2D
        env_tool, env_params, env_in = "plate", {"still": spec.container_still}, []
        env_art = Artifact("@env", "video")
    add(StageSpec(sid("environment"), StageKind.ENVIRONMENT, env_tool, env_in, env_params, [env_art]))

    # ── Simulation (the physical break) ──────────────────────────────────
    sim_kind = sim_for(spec.violation)
    add(StageSpec(sid("simulate"), StageKind.SIMULATE, p.sim_engine.value,
                  dep("@env"),
                  {"sim_kind": sim_kind, "solver": solver_for(p.sim_engine, sim_kind),
                   "violation": spec.violation, "destination": spec.destination,
                   "seed": spec.seed, "break_beat_sec": spec.break_beat_sec},
                  [Artifact("@sim_cache", "geo_cache")]))

    # ── Assemble USD scene ───────────────────────────────────────────────
    assemble_deps = dep("@env", "@sim_cache")
    if has_plate:
        assemble_deps += dep("@camera")
    if spec.profile.subject_mode == SubjectMode.IMAGE_3D:
        assemble_deps += dep("@subject_mesh")
    add(StageSpec(sid("assemble"), StageKind.ASSEMBLE, "usd",
                  assemble_deps,
                  {"hdri": spec.hdri, "synth_camera": not has_plate,
                   "destination": spec.destination, "resolution": list(p.resolution)},
                  [Artifact("@usd", "usd")]))

    # ── Render (path-traced beauty + AOVs) ───────────────────────────────
    add(StageSpec(sid("render"), StageKind.RENDER, p.render_engine.value,
                  dep("@usd"),
                  {"samples": p.samples, "fps": p.fps,
                   "aovs": ["beauty", "depth", "normal", "motion", "cryptomatte", "position"],
                   "motion_blur": p.motion_blur},
                  [Artifact("@beauty", "exr_seq"), Artifact("@aovs", "exr_seq")]))

    # ── Comp (the realism finisher) ──────────────────────────────────────
    comp_deps = dep("@beauty", "@aovs", "@subject_rgba", "@env")
    add(StageSpec(sid("comp"), StageKind.COMP, p.comp_engine.value,
                  comp_deps,
                  {"light_wrap": True, "contact_shadow": True,
                   "depth_of_field": p.depth_of_field, "motion_blur": p.motion_blur,
                   "lens_distortion": True, "film_grain": p.film_grain,
                   "grade": "match_plate"},
                  [Artifact("@comp", "exr_seq")]))

    # ── Encode + deliver ─────────────────────────────────────────────────
    add(StageSpec(sid("encode"), StageKind.ENCODE, "ffmpeg",
                  dep("@comp"),
                  {"container": "mp4", "codec": "h264", "also": ["prores", "thumbnail"]},
                  [Artifact("@final", "final")]))

    bad = g.validate()
    if bad:
        raise ValueError(f"compiled graph invalid for {spec.id!r}: " + "; ".join(bad))
    return g
