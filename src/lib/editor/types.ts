/**
 * Editor types — the canonical data model for the rebuilt v1 editor.
 *
 * Aligned with the supabase tables that already exist on the schema:
 *   - movie_projects        — Project root (title, aspect, status, …)
 *   - genesis_scenes        — Scene hierarchy
 *   - video_clips           — Clip atoms (url, duration, prompt, …)
 *   - shot_takes            — Versions per shot (take_number, …)
 *   - project_characters    — Cast in this project
 *
 * The model is hierarchical: Project → Scene → Clip → Take.
 * Timeline view derives from this hierarchy by ordering Scenes by
 * scene_number, then Clips within each Scene by index. Script and
 * Storyboard views are projections over the same data.
 *
 * Editor-time state (view, playhead, selection) lives in the store
 * and never round-trips to supabase. Persisted edits go into
 * movie_projects.pipeline_state (a JSONB column already there) or
 * mutate the scene/clip tables directly.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Views
// ─────────────────────────────────────────────────────────────────────────────
export type EditorView = "stage" | "timeline" | "script" | "storyboard";

export const EDITOR_VIEWS: EditorView[] = [
  "stage",
  "timeline",
  "script",
  "storyboard",
];

// ─────────────────────────────────────────────────────────────────────────────
// Aspect ratios
// ─────────────────────────────────────────────────────────────────────────────
export type AspectRatio = "16:9" | "9:16" | "1:1" | "21:9" | "4:5" | "4:3";

export const ASPECT_RATIOS: Record<AspectRatio, { w: number; h: number; label: string }> = {
  "16:9": { w: 16, h: 9, label: "Wide" },
  "9:16": { w: 9, h: 16, label: "Vertical" },
  "1:1": { w: 1, h: 1, label: "Square" },
  "21:9": { w: 21, h: 9, label: "Cinematic" },
  "4:5": { w: 4, h: 5, label: "Portrait" },
  "4:3": { w: 4, h: 3, label: "Classic" },
};

/**
 * Coerce the freeform aspect_ratio string from movie_projects into a
 * canonical AspectRatio. Defaults to 16:9 when unrecognized.
 */
export function parseAspectRatio(raw: string | null | undefined): AspectRatio {
  if (!raw) return "16:9";
  const r = raw.replace(/\s+/g, "").toLowerCase();
  if (r === "16:9" || r === "16/9" || r === "wide") return "16:9";
  if (r === "9:16" || r === "9/16" || r === "vertical" || r === "portrait") return "9:16";
  if (r === "1:1" || r === "1/1" || r === "square") return "1:1";
  if (r === "21:9" || r === "21/9" || r === "cinema" || r === "anamorphic" || r === "cinematic") return "21:9";
  if (r === "4:5" || r === "4/5") return "4:5";
  if (r === "4:3" || r === "4/3") return "4:3";
  return "16:9";
}

// ─────────────────────────────────────────────────────────────────────────────
// Data model
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorProject {
  id: string;
  title: string;
  aspectRatio: AspectRatio;
  status: string;
  thumbnailUrl: string | null;
  /** Sum of all clip durations across all scenes. */
  durationSec: number;
  /** Latest generated script if any (full screenplay text). */
  scriptContent: string | null;
  /** Project mood / genre / setting — used as hue inputs for the
   *  ProjectBackdrop and as cinematic copy in the chrome. */
  mood: string | null;
  genre: string | null;
  setting: string | null;
  scenes: EditorScene[];
  /** Between-clip transitions on V1. Keyed by (fromClipId, toClipId)
   *  — at most one transition per boundary. Empty array = hard cuts. */
  transitions: ClipTransition[];
  /** Project-level master loudness target. Applied as a `loudnorm`
   *  filter after the audio xfade chain so the whole edit ships at
   *  the right LUFS for the delivery platform. */
  masterLoudness?: import("./audio-mix").MasterLoudnessPreset;
  /** Broadcast-grade text overlays — chyrons, lower-thirds, quotes,
   *  stat cards, terminal text. Rendered live as an SVG layer over
   *  the StitchedPlayer; baked at export via Resvg→PNG→FFmpeg overlay
   *  (phase 2). Authored from the TextStudio panel on the right rail. */
  textOverlays?: import("./text-overlays").TextOverlay[];
  /** Dynamic timeline tracks. When absent or empty, the editor builds
   *  the 5 system defaults (V3 Text, V2 Overlay, V1 Video, A1 Audio,
   *  A2 Music) — backwards compatible with projects that predate this
   *  field. Users add/remove/rename/reorder via the timeline rail. */
  tracks?: EditorTrack[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracks — dynamic timeline rows
// ─────────────────────────────────────────────────────────────────────────────

/** A single timeline row. Video tracks stack top-down (higher z above
 *  lower z); audio tracks sum with optional per-track gain. */
export interface EditorTrack {
  /** Stable id — `sys:V1` for system tracks, `usr:<random>` for user-added. */
  id: string;
  kind: "video" | "audio";
  /** Short label rendered in the rail. */
  label: string;
  /** Row height in px on the timeline. */
  height: number;
  /** Display order from top. Lower index = closer to the top of the
   *  rail (and higher in the video stacking order). */
  position: number;
  /** Per-track mute (audio tracks) or hide (video tracks). */
  muted?: boolean;
  /** When any A-track is soloed, every non-soloed A-track plays muted. */
  soloed?: boolean;
  /** Locked — clips on this track can't be moved, trimmed, or deleted. */
  locked?: boolean;
  /** System tracks can be renamed but not deleted — the export pipeline
   *  has hardcoded references to V1/V2/V3/A1/A2. */
  isSystem?: boolean;
}

/** Build the 5 default tracks every project starts with. Position 0 = top. */
export function buildDefaultTracks(): EditorTrack[] {
  return [
    { id: "sys:V3", kind: "video", label: "V3 · Text",    height: 32, position: 0, isSystem: true },
    { id: "sys:V2", kind: "video", label: "V2 · Overlay", height: 38, position: 1, isSystem: true },
    { id: "sys:V1", kind: "video", label: "V1 · Video",   height: 72, position: 2, isSystem: true },
    { id: "sys:A1", kind: "audio", label: "A1 · Audio",   height: 44, position: 3, isSystem: true },
    { id: "sys:A2", kind: "audio", label: "A2 · Music",   height: 38, position: 4, isSystem: true },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Transitions — what happens at a V1 boundary
// ─────────────────────────────────────────────────────────────────────────────

/** Names match the ffmpeg xfade filter so the seamless-stitcher
 *  can apply the same transition on export without translation. */
export type TransitionKind =
  | "fade"
  | "dissolve"
  | "wipeleft"
  | "wiperight"
  | "wipeup"
  | "wipedown"
  | "slideleft"
  | "slideright"
  | "slideup"
  | "slidedown"
  | "circleopen"
  | "circleclose"
  | "radial"
  | "smoothleft"
  | "smoothright"
  | "fadeblack"
  | "fadewhite";

export const TRANSITION_KINDS: TransitionKind[] = [
  "fade",
  "dissolve",
  "wipeleft",
  "wiperight",
  "wipeup",
  "wipedown",
  "slideleft",
  "slideright",
  "slideup",
  "slidedown",
  "circleopen",
  "circleclose",
  "radial",
  "smoothleft",
  "smoothright",
  "fadeblack",
  "fadewhite",
];

export const TRANSITION_LABELS: Record<TransitionKind, string> = {
  fade: "Fade",
  dissolve: "Dissolve",
  wipeleft: "Wipe ←",
  wiperight: "Wipe →",
  wipeup: "Wipe ↑",
  wipedown: "Wipe ↓",
  slideleft: "Slide ←",
  slideright: "Slide →",
  slideup: "Slide ↑",
  slidedown: "Slide ↓",
  circleopen: "Circle open",
  circleclose: "Circle close",
  radial: "Radial",
  smoothleft: "Smooth ←",
  smoothright: "Smooth →",
  fadeblack: "Fade to black",
  fadewhite: "Fade to white",
};

export interface ClipTransition {
  id: string;
  /** Outgoing clip id. */
  fromClipId: string;
  /** Incoming clip id. */
  toClipId: string;
  /** Duration of the crossfade in seconds. Clamped at runtime to
   *  min(fromClipDuration, toClipDuration) / 2. */
  durationSec: number;
  kind: TransitionKind;
}

export const TRANSITION_DEFAULT_SEC = 0.4;

export interface EditorScene {
  id: string;
  /** scene_number from genesis_scenes — used to order the timeline. */
  number: number;
  title: string;
  description: string | null;
  durationSec: number;
  mood: string | null;
  timeOfDay: string | null;
  actNumber: number | null;
  isKeyScene: boolean;
  visualPrompt: string | null;
  cameraDirections: string | null;
  clips: EditorClip[];
}

/** Forward type ref so types.ts doesn't import the heavy color-grade module
 *  directly (keeps the editor types lean). Consumers import ColorGrade from
 *  '@/lib/editor/color-grade' when they need the full type. */
export type ColorGradeRef = import("./color-grade").ColorGrade;

export interface ClipProperties {
  /** 0.0 – 1.5 — gain applied to the <video>.volume on Stage */
  volume: number;
  /** 0.0 – 1.0 — opacity applied as CSS opacity on Stage */
  opacity: number;
  /** 0.5 – 2.0 — CSS scale transform on Stage */
  scale: number;
  /** Horizontal offset in pixels (or % of canvas width when in keyframe
   *  expressions). Default 0 = centered. */
  positionX: number;
  /** Vertical offset. Default 0 = centered. */
  positionY: number;
  /** Degrees of rotation. Default 0. */
  rotation: number;
  /** Optional crossfade-in seconds */
  fadeInSec: number;
  /** Optional crossfade-out seconds */
  fadeOutSec: number;
  /** 0.25 – 4.0 — applied as HTMLVideoElement.playbackRate */
  speed: number;
  /** Force-mute this clip even when volume > 0 */
  muted: boolean;
  /** When any clip is soloed, every non-soloed clip plays muted. */
  soloed: boolean;
  /** CSS filter string applied to the video — empty = none. Legacy: still
   *  used by the 8 quick-look presets in EffectsPalette. The richer
   *  colorGrade below supersedes it for new work. */
  filter: string;
  /** Horizontal flip — transform: scaleX(-1) */
  mirror: boolean;
  /** Full color grade — LUT + wheels + curves + global modifiers.
   *  Null when no grade has been set; the editor falls back to the
   *  legacy `filter` string in that case. */
  colorGrade?: ColorGradeRef | null;
  /** Per-clip audio mix — volume, pan, 3-band EQ, compressor.
   *  Null/undefined falls back to the legacy `volume`/`muted` fields. */
  audioMix?: import("./audio-mix").AudioMix | null;
  /** Character (from ScriptDocument.cast[]) anchoring this clip. The
   *  Regenerate composer prepends this character's identityDNA to the
   *  prompt so face/voice continuity carries across regenerations. */
  characterId?: string | null;
  /** Voice profile (from ScriptDocument.voices[]) anchoring this clip
   *  for dialogue / VO generation. */
  voiceProfileId?: string | null;
  /** Track this clip lives on. When absent, defaults to `sys:V1`
   *  (or `sys:A1` for audio-only). Phase B clip routing assigns
   *  uploaded / generated clips to non-system tracks so the bake
   *  can stack overlays + amix audio across rows. */
  trackId?: string | null;
}

export const CLIP_PROPERTY_DEFAULTS: ClipProperties = {
  volume: 1.0,
  opacity: 1.0,
  scale: 1.0,
  positionX: 0,
  positionY: 0,
  rotation: 0,
  fadeInSec: 0,
  fadeOutSec: 0,
  speed: 1.0,
  muted: false,
  soloed: false,
  filter: "",
  mirror: false,
  colorGrade: null,
};

/** Read a property with fall-through to the default. */
export function getClipProperty<K extends keyof ClipProperties>(
  clip: EditorClip,
  key: K,
): ClipProperties[K] {
  return clip.properties?.[key] ?? CLIP_PROPERTY_DEFAULTS[key];
}

export type ClipKind = "video" | "title";

/** Properties that can carry keyframes (numeric, time-varying). */
export type AnimatableProperty =
  | "opacity"
  | "scale"
  | "volume"
  | "positionX"
  | "positionY"
  | "rotation";

/** Easing curve applied to the segment BEFORE this keyframe. The
 *  curve shapes the interpolation from the previous kf's value to
 *  this kf's value. Linear is the default — matches preview behavior
 *  for keyframes authored before easing was introduced.
 *
 *  Standard cubic-bezier handles, named for the most common curves
 *  professional NLEs expose.
 */
export type KeyframeEasing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "step"; // hold previous value until this kf fires

export interface Keyframe {
  id: string;
  property: AnimatableProperty;
  /** Seconds relative to the clip's start (not timeline-absolute). */
  time: number;
  value: number;
  /** Easing for the segment leading INTO this kf. Optional; defaults
   *  to "linear" for backward compatibility with existing data. */
  easing?: KeyframeEasing;
}

export interface EditorClip {
  id: string;
  /** "video" by default — title clips live on V2 and render as a
   *  text overlay during their active range. */
  kind?: ClipKind;
  /** Position within the scene (0-indexed). */
  index: number;
  /** Absolute timeline start in seconds — cached on load for fast scrub. */
  timelineStartSec: number;
  durationSec: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  prompt: string;
  /** For kind === "title" — the rendered text and optional colour. */
  titleText?: string;
  titleColor?: string;
  /** Per-clip overrides — sparse; missing keys fall back to defaults. */
  properties?: Partial<ClipProperties>;
  /** Keyframes that animate properties over the clip's local time. */
  keyframes?: Keyframe[];
  /** Available takes — first is the active canonical take. */
  takes: EditorTake[];
  /** Crossover-recipe-driven in-editor effects placed on this clip
   *  (stingers, sustained overlays). Transitions are stored on the
   *  project's `transitions` array, not here. */
  effects?: import("./effects").EffectInstance[];
}

/** Apply an easing curve to a normalized t in [0, 1]. Pure functions
 *  matched to the FFmpeg expressions used in keyframe-bake.ts so
 *  preview and bake produce identical values at the same t. */
export function applyEasing(t: number, easing: KeyframeEasing): number {
  const x = Math.max(0, Math.min(1, t));
  switch (easing) {
    case "ease-in":     return x * x;                          // quadratic accel
    case "ease-out":    return 1 - (1 - x) * (1 - x);          // quadratic decel
    case "ease-in-out": return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case "step":        return 0;                              // hold previous value
    case "linear":
    default:            return x;
  }
}

/**
 * Compute the effective value of an animatable property at a given
 * RELATIVE time within the clip (0 .. clip.durationSec). Interpolates
 * between the surrounding keyframes honoring each keyframe's easing
 * curve; falls back to the static clip property when no keyframes
 * exist or the time is outside the keyframe range and only one side
 * exists.
 */
export function getClipPropertyAt(
  clip: EditorClip,
  prop: AnimatableProperty,
  relativeTime: number,
): number {
  const kfs = (clip.keyframes ?? [])
    .filter((k) => k.property === prop)
    .sort((a, b) => a.time - b.time);
  if (kfs.length === 0) return getClipProperty(clip, prop);
  let before: Keyframe | null = null;
  let after: Keyframe | null = null;
  for (const k of kfs) {
    if (k.time <= relativeTime) before = k;
    else if (after === null) {
      after = k;
      break;
    }
  }
  if (before && after) {
    if (after.time === before.time) return before.value;
    const tLin = (relativeTime - before.time) / (after.time - before.time);
    // The easing on `after` describes the curve INTO the after kf —
    // i.e. how we interpolate from before → after. linear keeps the
    // raw ratio; the ease curves reshape it.
    const tEased = applyEasing(tLin, after.easing ?? "linear");
    return before.value + (after.value - before.value) * tEased;
  }
  if (before) return before.value;
  if (after) return after.value;
  return getClipProperty(clip, prop);
}

export interface EditorTake {
  id: string;
  takeNumber: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  promptUsed: string | null;
  status: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor-time state
// ─────────────────────────────────────────────────────────────────────────────
export type TimelineTool = "select" | "blade" | "hand";

export type RenderJobStatus = "queued" | "rendering" | "done" | "error";

export interface RenderJob {
  id: string;
  projectId: string;
  projectTitle: string;
  aspect: AspectRatio;
  status: RenderJobStatus;
  createdAt: string;
  completedAt?: string;
  outputUrl?: string;
  error?: string;
  reframe: boolean;
}

export interface EditorMarker {
  id: string;
  /** Timeline-absolute position in seconds */
  timelineSec: number;
  label: string;
  /** CSS colour, e.g. "hsl(45 95% 60%)" or "#ff8" */
  color: string;
}

/** Internal clipboard for copy/paste — never persisted to disk. */
export interface ClipboardData {
  clips: EditorClip[];
  copiedAt: number;
}

/** History entry — a project snapshot that undo restores. */
export interface HistoryEntry {
  project: EditorProject;
  label?: string;
}

export interface EditorState {
  view: EditorView;
  project: EditorProject | null;
  loading: boolean;
  error: string | null;
  /** Selection — which scene/clip the user is focused on. */
  selectedSceneId: string | null;
  /** Primary selected clip (the one the Inspector focuses on). */
  selectedClipId: string | null;
  /** All selected clips — always includes selectedClipId when non-null. */
  selectedClipIds: string[];
  /** Internal copy/paste buffer. */
  clipboard: ClipboardData | null;
  /** Undo / redo history. */
  history: { past: HistoryEntry[]; future: HistoryEntry[] };
  /**
   * Timeline-absolute playhead, in seconds. Updated at the browser's
   * native `timeupdate` rate (~4–5 Hz) — fine for visual playhead
   * tracking without thrashing the React tree. The Stage's own
   * frame-rate scrub UI reads directly from the <video> ref instead.
   */
  playheadSec: number;
  /** Timeline horizontal zoom in pixels per second. */
  pxPerSec: number;
  /** Currently-active timeline tool (selection / razor blade / hand pan). */
  tool: TimelineTool;
  /** Whether new edits snap to clip boundaries + markers. */
  snapEnabled: boolean;
  /** Range markers — chapters / annotations on the ruler. */
  markers: EditorMarker[];
  /** In-point for ranged playback / export. null = use 0. */
  inSec: number | null;
  /** Out-point for ranged playback / export. null = use durationSec. */
  outSec: number | null;
  /** Render is in progress (background job). */
  isRendering: boolean;
  /** Master output volume — multiplies every clip's volume. */
  masterVolume: number;
  /** Master mute — overrides every clip's volume. */
  masterMuted: boolean;
  /** Per-track volume (V1=clip video audio, A1/A2 scaffolding). */
  trackVolumes: { V1: number; A1: number; A2: number };
  /** Per-track mute. */
  trackMuted: { V1: boolean; A1: boolean; A2: boolean };
  /** True while the program player is playing back. Lifted here so
   *  every panel (audio mixer, status bar, etc) can react in lockstep. */
  isPlaying: boolean;
  /** Playback speed multiplier for the program monitor.
   *  Discrete values: 0.25 / 0.5 / 0.75 / 1 / 1.25 / 1.5 / 2 / 4. */
  playbackSpeed: number;
  /** Loop between inSec and outSec when both are set. */
  loopRegion: boolean;
  /** Theater mode hides left/right panes and the inspector to give
   *  the player the entire viewport. */
  theaterMode: boolean;
  /** True while the browser is in fullscreen for the program monitor. */
  isFullscreen: boolean;
  /** Currently-selected transition (for the inspector). Mutually
   *  exclusive with selectedClipId — selecting one clears the other. */
  selectedTransitionId: string | null;
}

export const INITIAL_EDITOR_STATE: EditorState = {
  view: "stage",
  project: null,
  loading: false,
  error: null,
  selectedSceneId: null,
  selectedClipId: null,
  selectedClipIds: [],
  clipboard: null,
  history: { past: [], future: [] },
  playheadSec: 0,
  pxPerSec: 60,
  tool: "select",
  snapEnabled: true,
  markers: [],
  inSec: null,
  outSec: null,
  isRendering: false,
  masterVolume: 1.0,
  masterMuted: false,
  trackVolumes: { V1: 1.0, A1: 1.0, A2: 1.0 },
  trackMuted: { V1: false, A1: false, A2: false },
  isPlaying: false,
  playbackSpeed: 1,
  loopRegion: false,
  theaterMode: false,
  isFullscreen: false,
  selectedTransitionId: null,
};

export const PLAYBACK_SPEEDS: number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];
