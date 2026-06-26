/**
 * Render plan — compiles a `TemplateDefinition` into a concrete, ordered DAG
 * of generation + composite steps that map onto the REAL pipeline this repo
 * already runs (every step names the actual Supabase edge function):
 *
 *   gen-image      → `generate-scene-images`  (FLUX 1.1 Pro Ultra text-to-image)
 *   inpaint-image  → `inpaint-photo`          (FLUX Fill Pro, masked opening)
 *   gen-video      → `generate-video`         (engine image-to-video, startImage)
 *   matte-video    → `composite-character`    (BiRefNet) or ffmpeg chromakey
 *   gen-sfx        → `generate-sfx`           (foley on the break beat)
 *   composite      → `seamless-stitcher`      (Replicate FFmpeg filter_complex)
 *
 * This is the bridge from "schema" to "actually renders": resolve the scene
 * (layers + mask + beats), then emit the steps each layer needs and the final
 * composite that stacks them with the animating boundary mask + audio-synced
 * break beat.
 *
 * What's REUSED vs what this assumes is built (see RESEARCH.md):
 *   • FLUX still gen, image-to-video, BiRefNet still cutout — EXIST today.
 *   • Positioned + masked overlay in the FFmpeg compositor — added in
 *     `supabase/functions/_shared/breakthrough-overlay.ts` (closes the core gap).
 *   • Moving-subject matting (chromakey/video-matte) — `matte-video` step;
 *     chromakey is expressible in the existing FFmpeg command.
 */

import type { AspectRatio } from "@/lib/editor/types";
import type { EngineId } from "@/lib/video/engines";
import {
  resolveTemplate,
  type CompositedScene,
  type ResolveOptions,
} from "./compositor";
import type {
  MattingStrategy,
  RenderStrategy,
  StartFrameStrategy,
  TemplateDefinition,
} from "./schema";

// Grounded defaults for the make-it-real strategy when a config omits one.
export const DEFAULT_RENDER_STRATEGY: Required<Omit<RenderStrategy, "engines">> = {
  startFrame: "flux-text",
  matting: "chromakey",
  chromaColor: "#00B140", // broadcast chroma green
};

export type RenderOp =
  | "gen-image"
  | "inpaint-image"
  | "gen-video"
  | "matte-video"
  | "gen-sfx"
  | "composite";

export interface RenderStep {
  /** Stable id; other steps reference this via `dependsOn`. */
  id: string;
  op: RenderOp;
  label: string;
  /** The real Supabase edge function that executes this step. */
  edgeFunction: string;
  /** Ids of steps that must complete first (DAG edges). */
  dependsOn: string[];
  /** The payload the edge function receives (handles like "@chrome" are
   *  resolved to upstream step outputs at execution time). */
  input: Record<string, unknown>;
  /** Output handle later steps reference. */
  produces: string;
}

export interface RenderPlan {
  templateId: string;
  aspectRatio: AspectRatio;
  durationSec: number;
  breakBeatSec: number;
  strategy: Required<Omit<RenderStrategy, "engines">> & {
    engines: Record<"inner" | "subject" | "aftermath", EngineId>;
  };
  steps: RenderStep[];
  /** The resolved 4-layer scene the composite step stacks. */
  scene: CompositedScene;
}

function startFrameModel(s: StartFrameStrategy): string {
  return s === "flux-inpaint" ? "flux-fill-pro" : "flux-1.1-pro-ultra";
}

function mattingEdgeFunction(m: MattingStrategy): string {
  switch (m) {
    case "birefnet-frames": return "composite-character"; // BiRefNet per-frame
    case "video-matte":     return "video-matte";         // RVM-class model
    case "chromakey":       return "seamless-stitcher";    // ffmpeg chromakey stage
    case "none":            return "seamless-stitcher";
  }
}

/**
 * Compile the executable render plan. Pure: same def + opts → same plan.
 */
export function compileRenderPlan(
  def: TemplateDefinition,
  opts: ResolveOptions = {},
): RenderPlan {
  const scene = resolveTemplate(def, opts);
  const aspect = def.aspectRatio;
  const breakSec = scene.timeline.breakBeatSec;
  const durationSec = scene.timeline.durationSec;

  const strat = { ...DEFAULT_RENDER_STRATEGY, ...def.render };
  const engines = {
    inner: def.render?.engines?.inner ?? def.engine,
    subject: def.render?.engines?.subject ?? def.engine,
    aftermath: def.render?.engines?.aftermath ?? def.engine,
  };

  const identity = def.identity
    ? { subject: def.identity.subject, anchors: def.identity.anchors }
    : undefined;

  const id = (s: string) => `${def.id}:${s}`;
  const steps: RenderStep[] = [];

  // ── Layer 0 — static container chrome still (FLUX text-to-image) ──────────
  steps.push({
    id: id("chrome"),
    op: "gen-image",
    label: "Container chrome still",
    edgeFunction: "generate-scene-images",
    dependsOn: [],
    input: {
      prompt: def.prompts.chrome,
      negativePrompt: def.prompts.negative,
      aspectRatio: aspect,
      model: "flux-1.1-pro-ultra",
      bucket: "scene-images",
    },
    produces: "@chrome",
  });

  // ── Layer 1 — inner media-window video (image-to-video, masked) ───────────
  steps.push({
    id: id("inner-start"),
    op: "gen-image",
    label: "Inner-window start frame",
    edgeFunction: "generate-scene-images",
    dependsOn: [],
    input: {
      prompt: `${def.prompts.innerVideo} — single cinematic still, first frame`,
      aspectRatio: aspect,
      model: startFrameModel(strat.startFrame),
    },
    produces: "@innerStart",
  });
  steps.push({
    id: id("inner-video"),
    op: "gen-video",
    label: "Inner-window video",
    edgeFunction: "generate-video",
    dependsOn: [id("inner-start")],
    input: {
      engine: engines.inner,
      prompt: def.prompts.innerVideo,
      startImageUrl: "@innerStart",
      aspectRatio: aspect,
      durationSec: round1(breakSec + 1),
      identity,
      // The compositor masks this to the container's media window.
      maskToWindow: def.container.mediaWindow,
    },
    produces: "@innerVideo",
  });

  // ── Layer 2 — breakthrough subject (gen on chroma → matte → alpha video) ──
  steps.push({
    id: id("subject-start"),
    op: "gen-image",
    label: "Breakthrough subject start frame",
    edgeFunction: "generate-scene-images",
    dependsOn: [],
    input: {
      prompt:
        strat.matting === "chromakey"
          ? `${def.prompts.breakthrough} — full body, isolated on a flat solid ${strat.chromaColor} chroma-key background, even lighting`
          : def.prompts.breakthrough,
      aspectRatio: aspect,
      model: startFrameModel(strat.startFrame),
    },
    produces: "@subjectStart",
  });
  steps.push({
    id: id("subject-video"),
    op: "gen-video",
    label: "Breakthrough subject video",
    edgeFunction: "generate-video",
    dependsOn: [id("subject-start")],
    input: {
      engine: engines.subject,
      prompt:
        strat.matting === "chromakey"
          ? `${def.prompts.breakthrough}. Subject performs against a clean solid ${strat.chromaColor} green screen.`
          : def.prompts.breakthrough,
      startImageUrl: "@subjectStart",
      aspectRatio: aspect,
      durationSec: round1(durationSec - breakSec + 1),
      enableAudio: false,
      identity,
    },
    produces: "@subjectRaw",
  });
  steps.push({
    id: id("subject-matte"),
    op: "matte-video",
    label: `Matte subject (${strat.matting})`,
    edgeFunction: mattingEdgeFunction(strat.matting),
    dependsOn: [id("subject-video")],
    input: {
      strategy: strat.matting,
      chromaColor: strat.chromaColor,
      source: "@subjectRaw",
    },
    produces: "@subjectAlpha",
  });

  // ── Layer 3 — aftermath in the outer space ────────────────────────────────
  steps.push({
    id: id("aftermath-video"),
    op: "gen-video",
    label: "Aftermath video",
    edgeFunction: "generate-video",
    dependsOn: [id("chrome")],
    input: {
      engine: engines.aftermath,
      prompt: def.prompts.aftermath,
      startImageUrl: "@chrome",
      aspectRatio: aspect,
      durationSec: round1(durationSec - breakSec),
      identity,
    },
    produces: "@aftermath",
  });

  // ── Optional SFX on the break beat ────────────────────────────────────────
  const breakBeat = scene.timeline.beats.find((b) => b.id === scene.timeline.breakBeatId);
  if (breakBeat?.sfx) {
    steps.push({
      id: id("sfx-break"),
      op: "gen-sfx",
      label: "Break-beat SFX",
      edgeFunction: "generate-sfx",
      dependsOn: [],
      input: { prompt: breakBeat.sfx, atSec: breakSec },
      produces: "@sfxBreak",
    });
  }

  // ── Final composite — the FFmpeg stitcher stacks the 4 layers ─────────────
  const compositeDeps = [
    id("chrome"),
    id("inner-video"),
    id("subject-matte"),
    id("aftermath-video"),
    ...(breakBeat?.sfx ? [id("sfx-break")] : []),
  ];
  steps.push({
    id: id("composite"),
    op: "composite",
    label: "Composite breakthrough",
    edgeFunction: "seamless-stitcher",
    dependsOn: compositeDeps,
    input: {
      aspectRatio: aspect,
      durationSec,
      // Ordered layers (z 0..3) the breakthrough-overlay emitter consumes.
      layers: scene.layers.map((l) => ({
        kind: l.kind,
        z: l.z,
        source:
          l.kind === "chrome" ? "@chrome" :
          l.kind === "media-window" ? "@innerVideo" :
          l.kind === "breakthrough" ? "@subjectAlpha" :
          "@aftermath",
        maskToWindow: l.maskToWindow ? def.container.mediaWindow : undefined,
        boundaryMask: l.kind === "breakthrough" ? scene.mask : undefined,
        activeFromSec: l.activeFromSec,
        keyframes: l.keyframes,
        blend: l.blend,
      })),
      mask: scene.mask,
      breakTransition: scene.breakTransition,
      colorGrade: def.colorGrade,
      musicMood: def.musicMood,
      audioCues: breakBeat?.sfx ? [{ source: "@sfxBreak", atSec: breakSec }] : [],
    },
    produces: "@final",
  });

  return {
    templateId: def.id,
    aspectRatio: aspect,
    durationSec,
    breakBeatSec: breakSec,
    strategy: { ...strat, engines },
    steps,
    scene,
  };
}

/** Validate a plan's DAG: every dependency precedes its dependent and exists. */
export function validateRenderPlan(plan: RenderPlan): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const step of plan.steps) {
    for (const dep of step.dependsOn) {
      if (!seen.has(dep)) {
        errs.push(`step "${step.id}" depends on "${dep}" which is not produced earlier`);
      }
    }
    seen.add(step.id);
  }
  if (plan.steps.at(-1)?.op !== "composite") {
    errs.push("plan must end with the composite step");
  }
  return errs;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
