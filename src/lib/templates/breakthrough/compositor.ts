/**
 * Breakthrough compositor.
 *
 * Resolves a `TemplateDefinition` into render-ready structures that the
 * EXISTING pipeline already consumes — no fork:
 *
 *   • a z-ordered 4-layer stack (chrome → media-window → breakthrough →
 *     aftermath), each carrying KeyframeBlueprint[] the Stage preview and the
 *     FFmpeg `keyframe-bake` both understand;
 *   • a boundary-mask animation with absolute open/close seconds;
 *   • an absolute beat timeline whose BREAK beat can be snapped to an audio
 *     cue (the same seconds-from-start clock the audio-mix ramp + xfade use);
 *   • a `TemplateBlueprint` (via `toBlueprint`) so the catalogue, detail
 *     drawer and `/create?template=` consumer render it end-to-end through the
 *     existing clips → video-gen pipeline.
 *
 * The cross-product is meaningful here:
 *   container          → chrome geometry + media-window rect
 *   boundary_violation → the mask SHAPE that opens
 *   destination        → the breakthrough crossing MOTION (keyframes)
 */

import type {
  AnimatableProperty,
  Keyframe,
  TransitionKind,
} from "@/lib/editor/types";
import type {
  ClipBlueprint,
  KeyframeBlueprint,
  TemplateBlueprint,
} from "../blueprint";
import type {
  AudioCue,
  Beat,
  BoundaryMask,
  BoundaryViolation,
  Destination,
  LayerBlend,
  LayerDef,
  LayerKind,
  MaskShape,
  TemplateDefinition,
} from "./schema";

// ─────────────────────────────────────────────────────────────────────────────
// Canonical layer order — Layer 0 chrome … Layer 3 aftermath. The compositor
// OWNS this ordering; configs may override layer content but never the stack.
// ─────────────────────────────────────────────────────────────────────────────
export const CANONICAL_Z: Record<LayerKind, number> = {
  "chrome": 0, // static container chrome still
  "media-window": 1, // inner video, masked to the window
  "breakthrough": 2, // composited ABOVE chrome once it crosses the boundary
  "aftermath": 3, // disturbed UI / spilled liquid / falling shards
};

export const LAYER_ORDER: LayerKind[] = [
  "chrome",
  "media-window",
  "breakthrough",
  "aftermath",
];

// ─────────────────────────────────────────────────────────────────────────────
// boundary_violation → default mask shape. A config can still override
// `boundaryMask.shape`; this is the sensible default per violation.
// ─────────────────────────────────────────────────────────────────────────────
export const VIOLATION_MASK_SHAPE: Record<BoundaryViolation, MaskShape> = {
  "climb-out": "window-rect",
  "pour-liquefy": "liquid",
  "shatter-step": "shatter",
  "peel": "peel",
  "swarm": "ellipse",
  "fold-to-3d": "polygon",
  "reach-through": "ellipse",
};

// ─────────────────────────────────────────────────────────────────────────────
// destination → crossing MOTION. Returns KeyframeBlueprint[] (at ∈ 0..1,
// relative to the breakthrough layer's active window) for the breakthrough
// subject. These are the same blueprint keyframes the editor/registry use.
// ─────────────────────────────────────────────────────────────────────────────
export function destinationMotion(destination: Destination): KeyframeBlueprint[] {
  switch (destination) {
    // Surges toward camera: grows + drifts down into the viewer's space.
    case "toward-viewer":
      return [
        { property: "scale", at: 0, value: 1.0 },
        { property: "scale", at: 1, value: 1.6 },
        { property: "positionY", at: 0, value: 0 },
        { property: "positionY", at: 1, value: 0.12 },
        { property: "opacity", at: 0, value: 1 },
        { property: "opacity", at: 1, value: 1 },
      ];
    // Steps sideways into a neighbouring UI element.
    case "into-adjacent-ui":
      return [
        { property: "positionX", at: 0, value: 0 },
        { property: "positionX", at: 1, value: 0.32 },
        { property: "scale", at: 0, value: 1.0 },
        { property: "scale", at: 1, value: 1.08 },
      ];
    // Exits the frame entirely.
    case "off-screen":
      return [
        { property: "positionX", at: 0, value: 0 },
        { property: "positionX", at: 1, value: 0.85 },
        { property: "scale", at: 0, value: 1.0 },
        { property: "scale", at: 1, value: 1.05 },
        { property: "opacity", at: 0.7, value: 1 },
        { property: "opacity", at: 1, value: 0 },
      ];
    // Recedes upward, shrinking into the void.
    case "into-outer-space":
      return [
        { property: "scale", at: 0, value: 1.0 },
        { property: "scale", at: 1, value: 0.35 },
        { property: "positionY", at: 0, value: 0 },
        { property: "positionY", at: 1, value: -0.6 },
        { property: "rotation", at: 0, value: 0 },
        { property: "rotation", at: 1, value: 12 },
        { property: "opacity", at: 0.6, value: 1 },
        { property: "opacity", at: 1, value: 0.2 },
      ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default layer stack — the canonical 4 layers built from a definition. A
// config's `layers` overrides merge on top (matched by `kind`).
// ─────────────────────────────────────────────────────────────────────────────
export function buildDefaultLayers(def: TemplateDefinition): LayerDef[] {
  const breakBeat = def.timeline.breakBeatId;
  const settleBeat =
    def.timeline.beats.find((b) => b.role === "settle" || b.role === "aftermath")
      ?.id ?? breakBeat;

  // The breakthrough mask defaults its shape from the violation when the
  // config didn't pin one.
  const mask: BoundaryMask = {
    ...def.boundaryMask,
    shape: def.boundaryMask.shape ?? VIOLATION_MASK_SHAPE[def.boundaryViolation],
    region: def.boundaryMask.region ?? def.container.mediaWindow,
  };

  return [
    {
      id: `${def.id}-chrome`,
      kind: "chrome",
      z: CANONICAL_Z["chrome"],
      label: "Container chrome",
      promptRole: "chrome",
      blend: "normal",
    },
    {
      id: `${def.id}-window`,
      kind: "media-window",
      z: CANONICAL_Z["media-window"],
      label: "Inner media window",
      promptRole: "innerVideo",
      maskToWindow: true,
      blend: "normal",
    },
    {
      id: `${def.id}-breakthrough`,
      kind: "breakthrough",
      z: CANONICAL_Z["breakthrough"],
      label: "Breakthrough",
      promptRole: "breakthrough",
      boundaryMask: mask,
      activateAtBeat: breakBeat,
      blend: "normal",
      keyframes: destinationMotion(def.destination),
    },
    {
      id: `${def.id}-aftermath`,
      kind: "aftermath",
      z: CANONICAL_Z["aftermath"],
      label: "Aftermath",
      promptRole: "aftermath",
      activateAtBeat: settleBeat,
      blend: "screen",
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve the layer stack: merge config overrides, sort by canonical z,
// validate ordering. THROWS on a stack that violates canonical order.
// ─────────────────────────────────────────────────────────────────────────────
export interface ResolvedLayer extends LayerDef {
  /** Absolute second this layer activates (0 if always-on). */
  activeFromSec: number;
}

export function resolveLayerStack(def: TemplateDefinition): ResolvedLayer[] {
  const defaults = buildDefaultLayers(def);
  const overrides = def.layers ?? [];

  // Merge overrides onto defaults by kind (override wins field-by-field).
  const byKind = new Map<LayerKind, LayerDef>();
  for (const l of defaults) byKind.set(l.kind, l);
  for (const o of overrides) {
    const base = byKind.get(o.kind);
    byKind.set(o.kind, base ? { ...base, ...o } : o);
  }

  const beatAt = (id?: string): number =>
    id ? def.timeline.beats.find((b) => b.id === id)?.atSec ?? 0 : 0;

  const resolved: ResolvedLayer[] = Array.from(byKind.values())
    .map((l) => ({
      ...l,
      z: CANONICAL_Z[l.kind], // canonical z is authoritative
      activeFromSec: beatAt(l.activateAtBeat),
    }))
    .sort((a, b) => a.z - b.z);

  // Validate: z values must be strictly ascending and match canonical order.
  for (let i = 1; i < resolved.length; i++) {
    if (resolved[i].z <= resolved[i - 1].z) {
      throw new Error(
        `[breakthrough] layer stack for "${def.id}" has non-ascending z: ` +
          `${resolved[i - 1].kind}(${resolved[i - 1].z}) >= ${resolved[i].kind}(${resolved[i].z})`,
      );
    }
  }
  return resolved;
}

// ─────────────────────────────────────────────────────────────────────────────
// Beat timeline resolution, with audio-cue sync.
//
// When an AudioCue is supplied AND a beat opts in via `syncToAudioCue`, that
// beat is moved to the cue time. The BREAK beat is the one that matters: the
// whole downstream mask-open window + break crossfade re-derive from it, so
// the breakthrough lands exactly on the musical hit. Other beats keep their
// relative spacing around the shifted break beat (so establish stays before,
// aftermath stays after).
// ─────────────────────────────────────────────────────────────────────────────
export interface ResolvedTimeline {
  durationSec: number;
  beats: Beat[];
  breakBeatId: string;
  breakBeatSec: number;
  /** True when the break beat was snapped to a supplied audio cue. */
  syncedToAudio: boolean;
}

export function resolveBeatTimeline(
  def: TemplateDefinition,
  audioCue?: AudioCue,
): ResolvedTimeline {
  const original = def.timeline.beats;
  const breakBeat = original.find((b) => b.id === def.timeline.breakBeatId);
  if (!breakBeat) {
    throw new Error(
      `[breakthrough] "${def.id}" breakBeatId "${def.timeline.breakBeatId}" not in beats`,
    );
  }

  let beats = original.map((b) => ({ ...b }));
  let syncedToAudio = false;

  if (audioCue && breakBeat.syncToAudioCue) {
    const delta = audioCue.atSec - breakBeat.atSec;
    if (delta !== 0) {
      // Shift the break beat and everything at/after it by the same delta so
      // ordering + spacing are preserved. Beats before the break stay put.
      beats = beats.map((b) =>
        b.atSec >= breakBeat.atSec ? { ...b, atSec: b.atSec + delta } : b,
      );
      syncedToAudio = true;
    }
  }

  const breakBeatSec =
    beats.find((b) => b.id === def.timeline.breakBeatId)?.atSec ?? breakBeat.atSec;

  // Duration must cover the latest beat.
  const lastBeat = beats.reduce((m, b) => Math.max(m, b.atSec), 0);
  const durationSec = Math.max(def.timeline.durationSec, lastBeat);

  return {
    durationSec,
    beats,
    breakBeatId: def.timeline.breakBeatId,
    breakBeatSec,
    syncedToAudio,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Boundary-mask animation. The mask opens from `cross`-just-before the break
// beat to the next beat after it (or +breakTransitionSec). Reveal goes 0→1.
// ─────────────────────────────────────────────────────────────────────────────
export interface MaskAnimation {
  shape: MaskShape;
  region: BoundaryMask["region"];
  origin: BoundaryMask["origin"];
  featherPx: number;
  easing: NonNullable<BoundaryMask["easing"]>;
  /** Absolute second the mask STARTS opening. */
  openStartSec: number;
  /** Absolute second the mask is FULLY open. */
  openEndSec: number;
  /** Reveal keyframes (0 = closed, 1 = fully open) in absolute seconds. */
  keyframes: { atSec: number; reveal: number }[];
}

export function resolveMaskAnimation(
  def: TemplateDefinition,
  timeline: ResolvedTimeline,
): MaskAnimation {
  const breakSec = timeline.breakBeatSec;
  const transition = def.breakTransitionSec ?? 0.5;

  // Open window: starts a transition-length before the break beat (so the
  // crack is forming as the hit lands) and finishes a transition-length after.
  const openStartSec = Math.max(0, breakSec - transition);
  const openEndSec = Math.min(timeline.durationSec, breakSec + transition);

  const mask = def.boundaryMask;
  return {
    shape: mask.shape ?? VIOLATION_MASK_SHAPE[def.boundaryViolation],
    region: mask.region ?? def.container.mediaWindow,
    origin: mask.origin,
    featherPx: mask.featherPx ?? 8,
    easing: mask.easing ?? "ease-in-out",
    openStartSec,
    openEndSec,
    keyframes: [
      { atSec: openStartSec, reveal: 0 },
      { atSec: openEndSec, reveal: 1 },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KeyframeBlueprint (at ∈ 0..1) → editor Keyframe[] (absolute seconds) so the
// breakthrough layer's motion plugs straight into Stage preview + keyframe-bake.
// ─────────────────────────────────────────────────────────────────────────────
export function toEditorKeyframes(
  layerId: string,
  kfs: KeyframeBlueprint[] | undefined,
  activeFromSec: number,
  activeToSec: number,
): Keyframe[] {
  if (!kfs?.length) return [];
  const span = Math.max(0.0001, activeToSec - activeFromSec);
  return kfs.map((k, i) => ({
    id: `${layerId}-kf-${k.property as AnimatableProperty}-${i}`,
    property: k.property,
    time: activeFromSec + k.at * span,
    value: k.value,
    easing: "ease-in-out",
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge to the existing TemplateBlueprint (clips → video-gen pipeline). A
// breakthrough resolves to three clips — establish / break / aftermath — built
// from the AI-gen prompt fields, reusing engine, quality, transitions, grade
// and music so the catalogue + studio render it with zero new pipeline code.
// ─────────────────────────────────────────────────────────────────────────────
export function toBlueprint(def: TemplateDefinition): TemplateBlueprint {
  const t = resolveBeatTimeline(def);
  const breakSec = t.breakBeatSec;

  const establishSec = Math.max(1, breakSec);
  const aftermathStart =
    t.beats.find((b) => b.role === "settle")?.atSec ??
    t.beats.find((b) => b.role === "aftermath")?.atSec ??
    breakSec + 1;
  const breakLen = Math.max(1, aftermathStart - breakSec);
  const aftermathLen = Math.max(1, t.durationSec - aftermathStart);

  const breakKfs = destinationMotion(def.destination);

  const clips: ClipBlueprint[] = [
    {
      id: `${def.id}-clip-establish`,
      label: "The Container",
      prompt: def.prompts.chrome + "\n\nInner window: " + def.prompts.innerVideo,
      durationSec: round1(establishSec),
      properties: { fadeInSec: 0.4 },
      visualElements: [
        `Container: ${def.container.kind}`,
        `Outer space: ${def.container.outerSpace}`,
      ],
    },
    {
      id: `${def.id}-clip-break`,
      label: "The Breakthrough",
      prompt: def.prompts.breakthrough,
      durationSec: round1(breakLen),
      properties: { speed: 0.85 },
      keyframes: breakKfs,
      visualElements: [
        `Violation: ${def.boundaryViolation}`,
        `Destination: ${def.destination}`,
      ],
    },
    {
      id: `${def.id}-clip-aftermath`,
      label: "The Aftermath",
      prompt: def.prompts.aftermath,
      durationSec: round1(aftermathLen),
      properties: { fadeOutSec: 0.6 },
      visualElements: [def.container.outerSpace],
    },
  ];

  const breakTransition: TransitionKind = def.breakTransition ?? "dissolve";

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    thumbnailUrl: def.thumbnailUrl ?? "",
    category: "vfx",
    mood: "epic",
    genre: "ad",
    tags: [
      "breakthrough",
      "4th-wall",
      def.container.kind,
      def.boundaryViolation,
      def.destination,
      ...(def.tags ?? []),
    ],
    isFeatured: true,
    isTrending: true,
    isBreakout: true,
    isPro: true,
    useCount: def.useCount ?? 0,
    engine: def.engine,
    qualityTier: def.qualityTier,
    aspectRatio: def.aspectRatio,
    clips,
    transitions: ["fade", breakTransition],
    transitionDurationSec: def.breakTransitionSec ?? 0.5,
    colorGrade: def.colorGrade,
    pacing: "fast",
    playbackSpeed: 1.0,
    musicMood: def.musicMood,
    includeSfx: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level resolve — everything a renderer needs for one breakthrough scene.
// ─────────────────────────────────────────────────────────────────────────────
export interface CompositedScene {
  id: string;
  layers: ResolvedLayer[];
  timeline: ResolvedTimeline;
  mask: MaskAnimation;
  /** The crossfade fired AT the break beat (reuses ffmpeg xfade / framer). */
  breakTransition: { kind: TransitionKind; atSec: number; durationSec: number };
  /** The blueprint that feeds the existing clips → video-gen pipeline. */
  blueprint: TemplateBlueprint;
}

export interface ResolveOptions {
  /** Snap the (opt-in) break beat to this audio cue for beat-synced impact. */
  audioCue?: AudioCue;
}

export function resolveTemplate(
  def: TemplateDefinition,
  opts: ResolveOptions = {},
): CompositedScene {
  const timeline = resolveBeatTimeline(def, opts.audioCue);
  const layers = resolveLayerStack(def);
  const mask = resolveMaskAnimation(def, timeline);

  return {
    id: def.id,
    layers,
    timeline,
    mask,
    breakTransition: {
      kind: def.breakTransition ?? "dissolve",
      atSec: timeline.breakBeatSec,
      durationSec: def.breakTransitionSec ?? 0.5,
    },
    blueprint: toBlueprint(def),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
