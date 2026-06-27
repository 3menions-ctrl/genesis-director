/**
 * Breakthrough Effects — TemplateDefinition schema.
 *
 * The original "social post breakthrough" was one hardcoded effect: a single
 * chrome image, a single `BREAKOUT_AT = 5` constant in ImmersiveBreakout.tsx,
 * and an implicit mask. This schema GENERALISES that one-off into a
 * data-driven catalogue.
 *
 * Every effect is the cross-product of three generator axes:
 *
 *    container          × boundary_violation × destination
 *    (where it lives)     (how it escapes)     (where it goes)
 *
 * A template is a CONFIG OBJECT selecting one of each plus styling and the
 * AI-gen prompts — never bespoke code. Adding a new effect = dropping a new
 * file in `./configs/` (auto-loaded by the registry via import.meta.glob).
 *
 * The compositor (`./compositor.ts`) resolves a TemplateDefinition into the
 * EXISTING render structures — `KeyframeBlueprint[]`, `TransitionKind`,
 * `TemplateBlueprint` clips, normalized masks + absolute beat times — so the
 * existing playback / crossfade / keyframe-bake / audio-mix subsystems render
 * it without forking.
 */

import type { AspectRatio, KeyframeEasing } from "@/lib/editor/types";
import type { EngineId } from "@/lib/video/engines";
import type {
  KeyframeBlueprint,
  MusicMood,
  QualityTier,
  TemplateColorGrade,
} from "../blueprint";

// ─────────────────────────────────────────────────────────────────────────────
// Generator axis 1 — CONTAINER (where the content lives)
// ─────────────────────────────────────────────────────────────────────────────
export type ContainerKind =
  | "social-feed"
  | "billboard"
  | "group-chat"
  | "vending-machine"
  | "aquarium"
  | "desktop"
  | "cctv-grid"
  | "app-icon-home"
  | "wanted-poster";

export const CONTAINER_KINDS: ContainerKind[] = [
  "social-feed",
  "billboard",
  "group-chat",
  "vending-machine",
  "aquarium",
  "desktop",
  "cctv-grid",
  "app-icon-home",
  "wanted-poster",
];

export const CONTAINER_LABELS: Record<ContainerKind, string> = {
  "social-feed":     "Social feed",
  "billboard":       "Billboard",
  "group-chat":      "Group chat",
  "vending-machine": "Vending machine",
  "aquarium":        "Aquarium",
  "desktop":         "Desktop",
  "cctv-grid":       "CCTV grid",
  "app-icon-home":   "App-icon home screen",
  "wanted-poster":   "Wanted poster",
};

// ─────────────────────────────────────────────────────────────────────────────
// Generator axis 2 — BOUNDARY VIOLATION (how the content escapes the window)
// ─────────────────────────────────────────────────────────────────────────────
export type BoundaryViolation =
  | "climb-out"
  | "pour-liquefy"
  | "shatter-step"
  | "peel"
  | "swarm"
  | "fold-to-3d"
  | "reach-through";

export const BOUNDARY_VIOLATIONS: BoundaryViolation[] = [
  "climb-out",
  "pour-liquefy",
  "shatter-step",
  "peel",
  "swarm",
  "fold-to-3d",
  "reach-through",
];

export const BOUNDARY_VIOLATION_LABELS: Record<BoundaryViolation, string> = {
  "climb-out":     "Climb out",
  "pour-liquefy":  "Pour / liquefy",
  "shatter-step":  "Shatter-step",
  "peel":          "Peel",
  "swarm":         "Swarm",
  "fold-to-3d":    "Fold to 3D",
  "reach-through": "Reach through",
};

// ─────────────────────────────────────────────────────────────────────────────
// Generator axis 3 — DESTINATION (where the breakthrough content ends up)
// ─────────────────────────────────────────────────────────────────────────────
export type Destination =
  | "toward-viewer"
  | "into-adjacent-ui"
  | "off-screen"
  | "into-outer-space";

export const DESTINATIONS: Destination[] = [
  "toward-viewer",
  "into-adjacent-ui",
  "off-screen",
  "into-outer-space",
];

export const DESTINATION_LABELS: Record<Destination, string> = {
  "toward-viewer":    "Toward viewer",
  "into-adjacent-ui": "Into adjacent UI element",
  "off-screen":       "Off-screen",
  "into-outer-space": "Into outer space",
};

// ─────────────────────────────────────────────────────────────────────────────
// Geometry helpers — everything normalized 0..1 so it is resolution-agnostic
// and maps cleanly to both CSS (preview) and FFmpeg crop/overlay (export).
// ─────────────────────────────────────────────────────────────────────────────
/** A rectangle in normalized frame space. (0,0) = top-left, (1,1) = bottom-right. */
export interface NormRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A point in normalized frame space. */
export interface NormPoint {
  x: number;
  y: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Boundary mask — the shape that animates OPEN at the break beat to let the
// breakthrough content cross out of the window. Parameterizable per template.
// ─────────────────────────────────────────────────────────────────────────────
export type MaskShape =
  | "window-rect" // the media-window rectangle simply clears
  | "ellipse" // a soft hole opens
  | "shatter" // glass cracks radiate then clear
  | "liquid" // a meniscus/spill front advances
  | "torn" // a ragged paper/canvas tear
  | "peel" // a corner lifts and peels back
  | "polygon"; // arbitrary normalized polygon (points)

export interface BoundaryMask {
  shape: MaskShape;
  /** Region the mask covers. Defaults to the container's media window. */
  region?: NormRect;
  /** Where the opening originates (e.g. the corner a peel lifts from). */
  origin?: NormPoint;
  /** Edge feather in pixels at output resolution. Default 8. */
  featherPx?: number;
  /** Easing for the open animation. Default "ease-in-out". */
  easing?: KeyframeEasing;
  /** Polygon points (normalized) — required when shape === "polygon". */
  points?: NormPoint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Container spec — the "set": chrome geometry + the inner media window.
// ─────────────────────────────────────────────────────────────────────────────
export interface ContainerSpec {
  kind: ContainerKind;
  aspectRatio: AspectRatio;
  /** Where the inner media window sits within the chrome (normalized 0..1). */
  mediaWindow: NormRect;
  /** Editorial description of the "outer space" beyond the window — the world
   *  the breakthrough content spills into. Used to author the aftermath. */
  outerSpace: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI-gen prompt fields. These are TEMPLATE DATA so they can be tuned without
// touching code (one of the build constraints). The compositor wires each
// prompt to its layer.
// ─────────────────────────────────────────────────────────────────────────────
export interface TemplatePrompts {
  /** Layer 0 — the static container chrome still. */
  chrome: string;
  /** Layer 1 — the inner media-window video. */
  innerVideo: string;
  /** Layer 2 — the breakthrough subject as it crosses the boundary. */
  breakthrough: string;
  /** Layer 3 — aftermath in the outer space (spilled liquid, falling shards…). */
  aftermath: string;
  /** Optional shared negative prompt for every gen call. */
  negative?: string;
}

export type PromptRole = keyof Omit<TemplatePrompts, "negative">;

// ─────────────────────────────────────────────────────────────────────────────
// Beat timeline — named beats with ABSOLUTE seconds. The break beat is the
// moment the mask opens and the breakthrough crosses; it can be snapped to an
// audio cue (`syncToAudioCue`) by the compositor.
// ─────────────────────────────────────────────────────────────────────────────
export type BeatRole =
  | "establish"
  | "tension"
  | "break"
  | "cross"
  | "aftermath"
  | "settle";

export interface Beat {
  id: string;
  role: BeatRole;
  label: string;
  /** Absolute time in seconds from scene start. */
  atSec: number;
  /** If true, the compositor snaps this beat to a supplied audio cue. */
  syncToAudioCue?: boolean;
  /** Optional SFX cue fired at this beat (description fed to the SFX/foley gen). */
  sfx?: string;
}

export interface BeatTimeline {
  /** Total scene duration in seconds. */
  durationSec: number;
  beats: Beat[];
  /** Id of THE break beat — when the mask opens / breakthrough crosses. */
  breakBeatId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer stack. Canonical order is fixed by `kind` (chrome 0 → aftermath 3);
// the compositor enforces it. A config only needs to OVERRIDE a layer (blend,
// mask, keyframes, activation beat); omitted layers get sensible defaults.
// ─────────────────────────────────────────────────────────────────────────────
export type LayerKind = "chrome" | "media-window" | "breakthrough" | "aftermath";

export type LayerBlend =
  | "normal"
  | "screen"
  | "soft-light"
  | "multiply"
  | "overlay"
  | "lighten";

export interface LayerDef {
  id: string;
  kind: LayerKind;
  /** Explicit stacking order. Compositor validates against canonical order. */
  z: number;
  label: string;
  /** Which prompt feeds this layer's AI generation. */
  promptRole: PromptRole;
  /** media-window only: clip is masked to the container's media window. */
  maskToWindow?: boolean;
  /** breakthrough only: the boundary mask that animates open. */
  boundaryMask?: BoundaryMask;
  /** Beat id at which this layer becomes active (visible / starts animating). */
  activateAtBeat?: string;
  blend?: LayerBlend;
  /** Time-varying keyframes (position/opacity/scale/rotation) driving motion. */
  keyframes?: KeyframeBlueprint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity / cross-clip consistency. Maps to the existing IdentityBible +
// reference-image analysis so the subject in the inner clip, the breakthrough
// clip and the aftermath is recognisably the same character.
// ─────────────────────────────────────────────────────────────────────────────
export interface IdentitySpec {
  /** Short description of the breakthrough subject for the IdentityBible. */
  subject: string;
  /** Non-facial anchors (clothing, hair, props) that must stay constant. */
  anchors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Render strategy — how this template maps onto the REAL generation pipeline
// (FLUX text-to-image / Fill for stills, image-to-video engines for clips,
// matting for the moving subject, the FFmpeg compositor for the final mix).
// All optional; `renderPlan.ts` supplies grounded defaults.
// ─────────────────────────────────────────────────────────────────────────────
export type StartFrameStrategy =
  | "flux-text" // FLUX 1.1 Pro Ultra text-to-image (generate-scene-images)
  | "flux-inpaint" // FLUX Fill Pro masked inpaint (inpaint-photo)
  | "none";

export type MattingStrategy =
  | "chromakey" // generate subject on a solid key colour, ffmpeg chromakey+despill
  | "birefnet-frames" // per-frame BiRefNet cutout (composite-character/remove-bg)
  | "video-matte" // a dedicated Replicate video-matting model (RVM-class)
  | "none"; // subject clip already has alpha

export type RenderRole = "inner" | "subject" | "aftermath";

export interface RenderStrategy {
  /** How the inner-video + subject start frames are produced. */
  startFrame: StartFrameStrategy;
  /** Background-removal approach for the moving breakthrough subject. */
  matting: MattingStrategy;
  /** Solid key colour the subject is generated against (for chromakey). */
  chromaColor?: string;
  /** Per-role engine overrides; defaults to the template's top-level engine. */
  engines?: Partial<Record<RenderRole, EngineId>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────
export interface TemplateDefinition {
  // ── Identity ─────────────────────────────────────────────
  id: string;
  name: string;
  description: string;
  thumbnailUrl?: string;

  // ── The generator cross-product ──────────────────────────
  container: ContainerSpec;
  boundaryViolation: BoundaryViolation;
  destination: Destination;

  // ── AI-gen prompts (tunable without code) ────────────────
  prompts: TemplatePrompts;

  // ── Boundary mask + beat timeline (parameterizable) ──────
  /** Default boundary mask for the breakthrough layer. */
  boundaryMask: BoundaryMask;
  timeline: BeatTimeline;

  // ── Optional explicit layer overrides ────────────────────
  /** Omit to get the canonical 4-layer stack; supply to override layers. */
  layers?: LayerDef[];

  // ── Styling ──────────────────────────────────────────────
  aspectRatio: AspectRatio;
  colorGrade: TemplateColorGrade;
  engine: EngineId;
  qualityTier: QualityTier;
  musicMood: MusicMood;

  // ── Break crossfade (reuses existing TransitionKind/xfade) ─
  breakTransition?: import("@/lib/editor/types").TransitionKind;
  breakTransitionSec?: number;

  // ── Make-it-real authoring ───────────────────────────────
  /** Cross-clip subject consistency (IdentityBible). */
  identity?: IdentitySpec;
  /** How the template is actually generated + composited. */
  render?: RenderStrategy;

  // ── Discovery ────────────────────────────────────────────
  tags?: string[];
  useCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio cue — a marker the break beat can be timed to (a downbeat, a drop…).
// Reuses the same seconds-from-start clock the audio-mix ramp + xfade use.
// ─────────────────────────────────────────────────────────────────────────────
export interface AudioCue {
  /** Absolute time in seconds from scene start. */
  atSec: number;
  label?: string;
}
