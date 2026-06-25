/**
 * PipelinePreview — a self-driving demo of the Continuity Engine's
 * premium pipeline visualisation. Mounted at /pipeline-preview so the
 * full experience can be reviewed without running a real generation.
 *
 * It simulates the real PipelineProgress model advancing through all 8
 * phases and a chain of shots passing the audit gate (with one shot
 * failing + entering the correction ladder) so every visual state shows.
 */
import { useEffect, useMemo, useState } from "react";
import { PipelineCreation } from "@/components/create/PipelineCreation";
import {
  PIPELINE_PHASES,
  phasesUpTo,
  continuityIndexFromClips,
  type PipelineProgress,
  type ClipProgress,
  type PhaseId,
  type BoundaryType,
} from "@/lib/video/continuity";

const SHOTS: Array<{ label: string; boundary: BoundaryType; engine: ClipProgress["engine"] }> = [
  { label: "Shot 1", boundary: "INTRO", engine: "veo-3-pro" },
  { label: "Shot 2", boundary: "CONTINUOUS", engine: "kling-2-master" },
  { label: "Shot 3", boundary: "MATCH_CUT", engine: "runway-gen-4" },
  { label: "Shot 4", boundary: "CONTINUOUS", engine: "kling-2-master" },
  { label: "Shot 5", boundary: "HARD_CUT", engine: "seedance-1-pro" },
  { label: "Shot 6", boundary: "TIME_JUMP", engine: "sora-2" },
  { label: "Shot 7", boundary: "LOCATION_CHANGE", engine: "seedance-1-pro" },
];

const PHASE_ORDER: PhaseId[] = PIPELINE_PHASES.map((p) => p.id);

// A deterministic "good" score per shot once it passes.
function passScore(i: number): ClipProgress["scores"] & { composite: number } {
  const base = 88 + ((i * 7) % 9);
  return {
    identity: Math.min(99, base + 6),
    wardrobe: Math.min(99, base + 2),
    boundary: SHOTS[i].boundary === "CONTINUOUS" ? base : base + 4,
    temporal: base + 1,
    color: base + 3,
    vlm: base,
    composite: base + 2,
  } as ClipProgress["scores"] & { composite: number };
}

export default function PipelinePreview() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 240), 130);
    return () => clearInterval(id);
  }, []);

  const pipeline = useMemo<PipelineProgress>(() => {
    // Map tick → a phase + per-clip progression. ~0..200 then holds.
    const t = tick;

    // Phase index ramps over the first ~70 ticks, then sits at motion/gate.
    const phaseId: PhaseId =
      t < 8 ? "bible"
      : t < 18 ? "storyboard"
      : t < 28 ? "skeleton-audit"
      : t < 34 ? "approval"
      : t < 170 ? "motion"
      : t < 190 ? "continuity-gate"
      : t < 205 ? "assembly"
      : "report";

    // Clip pipeline: each shot renders → audits → passes, staggered.
    const motionStart = 34;
    const perClip = 18;
    const clips: ClipProgress[] = SHOTS.map((s, i) => {
      const localStart = motionStart + i * perClip;
      const age = t - localStart;
      let status: ClipProgress["status"] = "pending";
      let attempt = 0;
      let correction: string | undefined;
      let scores: ClipProgress["scores"] | undefined;
      let composite: number | undefined;

      if (t >= 195) {
        status = "passed";
        const ps = passScore(i); composite = ps.composite;
        scores = ps;
      } else if (age < 0) {
        status = "pending";
      } else if (age < 9) {
        status = "rendering";
      } else if (age < 13) {
        status = "auditing";
        scores = passScore(i);
      } else if (i === 3 && age < 22) {
        // Shot 4 fails its seam once → correction ladder.
        status = "correcting";
        attempt = 1;
        correction = age < 17 ? "re-seed" : "anchor";
        scores = { ...passScore(i), boundary: 64 };
      } else {
        status = "passed";
        const ps = passScore(i); composite = ps.composite; scores = ps;
        if (i === 3) attempt = 1;
      }

      return {
        shotId: `shot-${i + 1}`,
        index: i,
        label: s.label,
        engine: s.engine,
        boundaryType: s.boundary,
        status,
        attempt,
        maxAttempts: 3,
        correction,
        scores,
        composite,
      };
    });

    const passed = clips.filter((c) => c.status === "passed").length;
    const overall =
      phaseId === "report" ? 100
      : Math.min(99, Math.round((PHASE_ORDER.indexOf(phaseId) / PHASE_ORDER.length) * 40 + (passed / SHOTS.length) * 58));

    const correcting = clips.find((c) => c.status === "correcting");
    const message = correcting
      ? `${correcting.label}: seam below contract — ${correcting.correction === "anchor" ? "re-pinning anchor" : "re-seeding"}`
      : undefined;

    return {
      phaseId,
      phases: phasesUpTo(phaseId, overall),
      overall,
      clips,
      continuityIndex: continuityIndexFromClips(clips),
      message,
    };
  }, [tick]);

  return (
    <PipelineCreation
      pipeline={pipeline}
      prompt="A lighthouse keeper discovers a message in a bottle that rewrites her past."
      onCancel={() => window.history.back()}
    />
  );
}
