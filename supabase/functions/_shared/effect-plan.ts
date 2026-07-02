// ═══════════════════════════════════════════════════════════════════════════
// effect-plan.ts — THE EFFECT COMPILER's scene file.
//
// Doctrine (owner-approved blueprint, 2026-07-02):
//   RIGID  — UI, text, logos, screens → compositing owns it (pixels don't lie)
//   ALIVE  — people, physics, light, debris → generation owns it
//   BRIDGE — the moment rigid becomes alive → handoff keyframes + mattes
// An effect is a DAG of stages, each assigned to the tool-class that owns its
// layer, verified by machine-checkable assertions, retried per-stage.
//
// PURE module: types + validation only. Executable by effect-executor,
// authorable by effect-compiler (GPT-5 supervisor) or by hand (golden plans).
// ═══════════════════════════════════════════════════════════════════════════

export type LayerKind = 'rigid' | 'alive' | 'bridge' | 'audio' | 'analysis';

export type ToolId =
  // Stills / keyframes
  | 'image.nano_banana'      // google/nano-banana — gen + reference-guided edit
  | 'image.flux_ultra'       // black-forest-labs/flux-1.1-pro-ultra — t2i
  | 'image.kontext'          // flux-kontext-pro — identity-preserving edit
  // Video generation (alive layers)
  | 'video.seedance'         // bytedance/seedance-2.0 — refs, keyframe pairs, audio
  | 'video.kling'            // kwaivgi/kling-v3-video
  | 'video.veo'              // google/veo-3.1-fast — keyframe pairs, audio
  | 'video.wan_i2v'          // wan-video/wan-2.7-i2v
  | 'video.motion_control'   // kwaivgi/kling-v3-motion-control — perf transfer
  // Video editing (surgical passes)
  | 'video.aleph2'           // runwayml/aleph-2 — instruction edit
  | 'video.kling_o1'         // kwaivgi/kling-o1 — instruction edit
  | 'video.wan_edit'         // wan-video/wan-2.7-videoedit
  // Analysis / mattes
  | 'matte.sam2'             // meta/sam-2 — subject mattes
  | 'depth.estimate'         // chenxwh/depth-anything-v2
  | 'frame.extract'          // extract-video-frame edge fn (first/last frame)
  // Rigid compositing (ffmpeg cog — the ONLY place pixels get pasted)
  | 'composite.overlay'      // corner-pin / overlay / lock-region composite
  // Audio spine
  | 'audio.tts'              // generate-voice (minimax)
  | 'audio.music'            // generate-music (Lyria 2)
  | 'audio.sfx'              // elevenlabs-sfx (stable-audio fallback)
  // QC
  | 'critic.vision';         // llm-complete + images — assertion checking

/** Machine-checkable QC assertion evaluated by the Critic after a stage. */
export interface Assertion {
  kind:
    | 'region_rigid'      // locked region must not move/change between frames
    | 'identity_hold'     // same person/subject as reference
    | 'physics_plausible' // effect obeys mass/gravity/light (vision judgment)
    | 'prompt_adherence'  // the stage's creative intent is visibly present
    | 'no_artifacts';     // no morphing/flicker/duplicated limbs
  /** Human-readable contract, given to the vision critic verbatim. */
  contract: string;
  /** For region_rigid: normalized [x,y,w,h] of the locked region. */
  region?: [number, number, number, number];
  /** Frames to sample for the check (seconds into the clip). */
  sampleAtSec?: number[];
  /** Reference image key (a prior stage output) for identity checks. */
  referenceKey?: string;
  /** 'blocking' failures retry the stage; 'advisory' failures only flag.
   *  DEFAULT: physics_plausible is ADVISORY on video stages (motion physics
   *  cannot be judged reliably from still frames — false failures burn
   *  expensive regenerations); everything else is blocking. */
  severity?: 'blocking' | 'advisory';
}

/** One node of the DAG. `inputs` values support {{stageId}} refs, resolved to
 *  that stage's primary output URL, and {{stageId.field}} for named fields. */
export interface EffectStage {
  id: string;
  layer: LayerKind;
  tool: ToolId;
  /** Why this stage exists — kept for the Supervisor/Critic and for humans. */
  purpose: string;
  inputs: Record<string, unknown>;
  assertions?: Assertion[];
  /** Max targeted retries when an assertion fails (seed bump / prompt nudge). */
  maxRetries?: number; // default 1
  /** Stage ids this depends on (in addition to any {{ref}} inputs). */
  after?: string[];
}

export interface EffectPlan {
  /** slug, e.g. 'feed-breakout' */
  id: string;
  name: string;
  /** The creative intent, verbatim — the Supervisor's input. */
  intent: string;
  /** Template family this plan serves (breakout, cinematic, ad, ...). */
  family: string;
  version: number;
  stages: EffectStage[];
  /** Key of the stage whose output is the final deliverable. */
  finalStage: string;
  /** Timing spec: where the impact lands, what syncs to it. */
  timing?: {
    impactStage?: string;
    impactAtSec?: number;
    sfxOnImpact?: string; // sfx prompt to land within 1 frame of impact
  };
}

const TOOL_IDS: ToolId[] = [
  'image.nano_banana','image.flux_ultra','image.kontext',
  'video.seedance','video.kling','video.veo','video.wan_i2v','video.motion_control',
  'video.aleph2','video.kling_o1','video.wan_edit',
  'matte.sam2','depth.estimate','frame.extract','composite.overlay',
  'audio.tts','audio.music','audio.sfx','critic.vision',
];

export function validateEffectPlan(plan: unknown): { ok: true; plan: EffectPlan } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const p = plan as EffectPlan;
  if (!p || typeof p !== 'object') return { ok: false, errors: ['plan is not an object'] };
  if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) errors.push('id must be a kebab slug');
  if (!Array.isArray(p.stages) || p.stages.length === 0) errors.push('stages required');
  const ids = new Set<string>();
  for (const s of p.stages ?? []) {
    if (!s.id) errors.push('stage missing id');
    if (ids.has(s.id)) errors.push(`duplicate stage id ${s.id}`);
    ids.add(s.id);
    if (!TOOL_IDS.includes(s.tool)) errors.push(`unknown tool ${s.tool} in ${s.id}`);
    // Refs must point at earlier stages (DAG, topologically ordered by array).
    const refs = JSON.stringify(s.inputs ?? {}).match(/\{\{([a-z0-9_-]+)(?:\.[a-z0-9_]+)?\}\}/gi) ?? [];
    for (const r of refs) {
      const target = r.replace(/[{}]/g, '').split('.')[0];
      if (!ids.has(target)) errors.push(`stage ${s.id} references ${target} before it is defined`);
    }
    for (const dep of s.after ?? []) {
      if (!ids.has(dep)) errors.push(`stage ${s.id} 'after' references undefined ${dep}`);
    }
  }
  if (!p.finalStage || !ids.has(p.finalStage)) errors.push('finalStage must name a defined stage');
  return errors.length ? { ok: false, errors } : { ok: true, plan: p };
}

/** Resolve {{stage}} / {{stage.field}} refs against accumulated outputs. */
export function resolveInputs(
  inputs: Record<string, unknown>,
  outputs: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const resolve = (v: unknown): unknown => {
    if (typeof v === 'string') {
      return v.replace(/\{\{([a-z0-9_-]+)(?:\.([a-z0-9_]+))?\}\}/gi, (_m, stage, field) => {
        const out = outputs[stage];
        if (!out) throw new Error(`unresolved ref: ${stage}`);
        const val = field ? out[field] : (out.url ?? out.output);
        if (val == null) throw new Error(`ref ${stage}.${field ?? 'url'} is empty`);
        return String(val);
      });
    }
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, resolve(x)]));
    }
    return v;
  };
  return resolve(inputs) as Record<string, unknown>;
}
