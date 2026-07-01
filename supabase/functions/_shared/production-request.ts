// ═══════════════════════════════════════════════════════════════════════════
// production-request.ts — THE CONTRACT
//
// One canonical request that every creation surface (Studio / Training /
// Crossover / Editor / Ad Studio) normalizes into, and the single shape the
// unified orchestrator (hollywood-pipeline) consumes. This module is PURE:
// no Supabase, no fetch, no Deno I/O. It is importable by `mode-router`
// (normalizer), `hollywood-pipeline` (orchestrator) and unit tests alike.
//
// Design of record: docs/PIPELINE.md §5 ("one pipeline, everything is data").
// Every behavior fork in the legacy 5 mode-handlers + 2 pipeline variants is
// expressed here as DATA (engine → dispatchStrategy → audioStrategy), not as a
// code branch.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Engines ────────────────────────────────────────────────────────────────
// Backend engine keys — these are the ONLY values the spine (generate-single-clip)
// routes on. Mirror of generate-single-clip:1229.
export type BackendEngine = 'wan' | 'kling' | 'veo' | 'seedance' | 'runway' | 'sora';

// Request-level engine — UI may also send `auto` (→ per-shot router → kling base).
export type RequestEngine = BackendEngine | 'auto';

// Live Replicate route labels. Mirror of generate-single-clip:1275 — DO NOT
// change these slugs; they are audited-live (docs/PIPELINE.md §1).
export const ENGINE_ROUTE_LABEL: Record<BackendEngine, string> = {
  wan:      'wan-video/wan-2.5-t2v',
  kling:    'kwaivgi/kling-v3-video',
  seedance: 'bytedance/seedance-2.0',
  veo:      'google/veo-3-fast',
  runway:   'runwayml/gen4-turbo',
  sora:     'openai/sora-2',
};

// ─── Modes ──────────────────────────────────────────────────────────────────
// Canonical production modes (server-side vocabulary).
export type ProductionMode =
  | 'text'            // text-to-video (multi-shot script)
  | 'image'           // image-to-video (multi-shot script, image_ref seed)
  | 'broll'           // b-roll (multi-shot script)
  | 'avatar'          // avatar (direct verbatim-TTS OR cinematic concept)
  | 'video2video'     // stylize (scriptless single-pass effect)
  | 'motion-transfer'; // pose-transfer (scriptless single-pass effect)

// UI mode strings → canonical ProductionMode. The UI sends a grab-bag of
// historical names; collapse them here so the rest of the pipeline speaks ONE
// vocabulary. (Mirrors src/types/video-modes.ts + the legacy mode-router switch.)
export const UI_MODE_TO_PRODUCTION: Record<string, ProductionMode> = {
  'text-to-video':   'text',
  'text':            'text',
  't2v':             'text',
  'image-to-video':  'image',
  'image':           'image',
  'i2v':             'image',
  'b-roll':          'broll',
  'broll':           'broll',
  'avatar':          'avatar',
  'avatar-direct':   'avatar',
  'avatar-cinematic':'avatar',
  'video-to-video':  'video2video',
  'video2video':     'video2video',
  'stylize':         'video2video',
  'motion-transfer': 'motion-transfer',
  'pose-transfer':   'motion-transfer',
};

export function normalizeMode(uiMode: string | null | undefined): ProductionMode {
  if (!uiMode) return 'text';
  return UI_MODE_TO_PRODUCTION[uiMode] ?? (uiMode as ProductionMode);
}

// ─── Per-shot operation ─────────────────────────────────────────────────────
// The only thing that varies per shot. docs/PIPELINE.md §5 ("one per-shot op").
export type ShotOperation = 't2v' | 'i2v' | 'avatar' | 'stylize' | 'pose-transfer';

// Execution lane — narrative/avatar shots fan through the clip loop; the two
// scriptless effects are single-pass leaves dispatched to dedicated functions.
export type ExecutionLane = 'clip-loop' | 'single-pass-effect';

export type DispatchStrategyKind = 'sequential' | 'parallel';
export type AudioStrategy = 'native' | 'post-mux' | 'overlay';

// ─── Sub-interfaces ─────────────────────────────────────────────────────────
export interface ProductionInputs {
  prompt?: string | null;
  imageRef?: string | null;      // image-to-video seed / avatar reference image
  sourceVideo?: string | null;   // video2video / motion-transfer source
  targetImage?: string | null;   // motion-transfer target image
  avatarRef?: string | null;     // avatar reference image
}

export interface ProductionScript {
  generate: boolean;             // false → scriptless (avatar-direct, effects)
  shots?: unknown[];             // pre-supplied shots (template / resume)
  preserveUserContent?: boolean; // verbatim TTS guard (avatar-direct)
}

export interface ProductionContinuity {
  contract?: 'continuous' | 'match' | 'location-change' | 'intro';
  carryFrame?: boolean;
  endAnchor?: string | null;
  poseChain?: unknown | null;
  identityLock?: 'strict' | 'loose' | 'off';
  // Reference-image identity-lock (Seedance "same image filled across clips").
  identityLockedReferenceImage?: string | null;
}

export interface ProductionFormat {
  aspect?: string;               // '16:9' | '9:16' | '1:1' | ...
  clips?: number;                // 1..20
  duration?: number;             // seconds per clip
  quality?: { upscale4k?: boolean; fps60?: boolean };
}

export interface ProductionAudio {
  narration?: boolean;
  music?: boolean;
  voiceId?: string | null;
  userNarration?: string | null; // verbatim TTS speech (avatar) — NEVER rewritten
}

export interface ProductionBreakout {
  isBreakout: boolean;
  platform?: string | null;
}

export interface ProductionGate {
  requireApproval: boolean;      // FAIL-CLOSED default
  autoApprove?: boolean;         // trusted-caller opt-out only
}

// ─── The canonical request ──────────────────────────────────────────────────
export interface ProductionRequest {
  mode: ProductionMode;
  engine: RequestEngine;
  inputs: ProductionInputs;
  script: ProductionScript;
  continuity: ProductionContinuity;
  format: ProductionFormat;
  audio: ProductionAudio;
  breakout: ProductionBreakout;
  gate: ProductionGate;

  // Identity / character data carried verbatim from the normalizer (built from
  // the legacy handleAvatarCinematicMode Identity-Bible construction).
  isAvatarMode?: boolean;
  avatarType?: string | null;
  cinematicMode?: boolean;
  enableDualAvatar?: boolean;
  avatarTemplateId?: string | null;
  avatarName?: string | null;
  identityBible?: unknown;
  cast?: unknown[];
  characterDescription?: string | null;
  environmentLock?: string | null;
  hasReferenceImage?: boolean;
  cameraFixed?: boolean;

  // Pass-through plumbing (carried through DispatchContext + the spine payload).
  projectId?: string;
  userId?: string;
  concept?: string | null;       // scene summary (NOT verbatim speech)
  templateSlug?: string | null;
  // Credit reservation: when the router already deducted (avatar / effects),
  // the orchestrator MUST NOT reserve again. Regression mitigation #1.
  creditsAlreadyDeducted?: boolean;
}

// ─── Resolvers (pure) ───────────────────────────────────────────────────────

// Resolve the backend engine actually used.
//  - Breakout forces seedance (4th-wall lock; legacy mode-router:385 force).
//  - An explicit engine wins.
//  - `auto` falls back to kling (the per-shot router refines per shot inside
//    the spine; kling is the safe base for the request-level lock).
export function resolveEngine(pr: ProductionRequest): BackendEngine {
  if (pr.breakout?.isBreakout) return 'seedance';
  if (pr.engine && pr.engine !== 'auto') return pr.engine;
  return 'kling';
}

// Seedance dispatches its clips as a PARALLEL batch (Promise.allSettled +
// last_frame_image continuity + post-render audio mux). Every other engine
// uses the SEQUENTIAL callback-chained loop (native audio per clip).
export function resolveDispatchStrategy(engine: BackendEngine): DispatchStrategyKind {
  return engine === 'seedance' ? 'parallel' : 'sequential';
}

// Audio strategy follows the engine's capability:
//  - native: kling/veo/sora/runway/wan render audio inline.
//  - post-mux: seedance has no audio → voice/music muxed post-stitch.
//  - overlay: avatar TTS overlaid on a no-native-audio engine (seedance avatar).
export function resolveAudioStrategy(pr: ProductionRequest): AudioStrategy {
  const engine = resolveEngine(pr);
  if (engine === 'seedance') {
    return pr.isAvatarMode ? 'overlay' : 'post-mux';
  }
  return 'native';
}

// Resolve the request-level operation + execution lane.
export function resolveOperation(pr: ProductionRequest): {
  operation: ShotOperation;
  executionLane: ExecutionLane;
  effectFn?: 'stylize-video' | 'motion-transfer' | 'generate-avatar-direct';
} {
  switch (pr.mode) {
    case 'video2video':
      return { operation: 'stylize', executionLane: 'single-pass-effect', effectFn: 'stylize-video' };
    case 'motion-transfer':
      return { operation: 'pose-transfer', executionLane: 'single-pass-effect', effectFn: 'motion-transfer' };
    case 'avatar':
      // Scriptless avatar (verbatim TTS) → generate-avatar-direct leaf (v1
      // keeps it a single-pass leaf; folding into the clip-loop is a later PR).
      if (!pr.script.generate) {
        return { operation: 'avatar', executionLane: 'single-pass-effect', effectFn: 'generate-avatar-direct' };
      }
      return { operation: 'avatar', executionLane: 'clip-loop' };
    case 'image':
      return { operation: 'i2v', executionLane: 'clip-loop' };
    case 'text':
    case 'broll':
    default:
      return { operation: 't2v', executionLane: 'clip-loop' };
  }
}

// Per-shot operation resolver — used inside the clip loop. Image seed only
// matters for shot 0 (subsequent shots chain from the previous last_frame).
export function resolveShotOperation(
  pr: ProductionRequest,
  shotIndex: number,
  hasStartImage: boolean,
): ShotOperation {
  if (pr.isAvatarMode) return 'avatar';
  if (pr.mode === 'image' && shotIndex === 0) return 'i2v';
  if (hasStartImage) return 'i2v';
  return 't2v';
}

// ─── HANDLER_COLLAPSE assertion table ───────────────────────────────────────
// Compile-time documentation: which legacy handler each (mode, engine) tuple
// collapses into, and the resolved data fields. Used by the unit test to
// assert the normalizer reproduces the legacy routing. (docs/PIPELINE.md §5
// "Handler-collapse map".)
export interface HandlerCollapseRow {
  legacyHandler: string;
  scriptGenerate: boolean;
  operation: ShotOperation;
  executionLane: ExecutionLane;
  audio: AudioStrategy;
}

export const HANDLER_COLLAPSE: Record<string, HandlerCollapseRow> = {
  'handleCinematicMode': {
    legacyHandler: 'handleCinematicMode',
    scriptGenerate: true, operation: 't2v', executionLane: 'clip-loop', audio: 'native',
  },
  'handleAvatarCinematicMode': {
    legacyHandler: 'handleAvatarCinematicMode',
    scriptGenerate: true, operation: 'avatar', executionLane: 'clip-loop', audio: 'overlay',
  },
  'handleAvatarDirectMode': {
    legacyHandler: 'handleAvatarDirectMode',
    scriptGenerate: false, operation: 'avatar', executionLane: 'single-pass-effect', audio: 'native',
  },
  'handleStyleTransferMode': {
    legacyHandler: 'handleStyleTransferMode',
    scriptGenerate: false, operation: 'stylize', executionLane: 'single-pass-effect', audio: 'native',
  },
  'handleMotionTransferMode': {
    legacyHandler: 'handleMotionTransferMode',
    scriptGenerate: false, operation: 'pose-transfer', executionLane: 'single-pass-effect', audio: 'native',
  },
};

export type HandlerKey = keyof typeof HANDLER_COLLAPSE;

// ─── Builder + dispatch resolver (the keystone that ACTIVATES the normalizer) ──
// mode-router builds a canonical ProductionRequest from its raw entry fields,
// then resolveHandlerKey() decides which handler runs. This replaces the raw
// `switch (mode)` selection with a single normalizer-owned decision (docs/PIPELINE.md).
// Kept minimal for the handler-selection cutover; later phases fold each mode's
// execution into the unified clip-loop and populate the full stage fields.

export function buildProductionRequest(raw: {
  mode?: string | null;
  videoEngine?: string | null;
  isBreakout?: boolean;
  isAvatarMode?: boolean;
  /** Whether the flow generates a script (cinematic) vs runs verbatim/effect. */
  hasScript?: boolean;
}): ProductionRequest {
  const mode = normalizeMode(raw.mode);
  const engine: RequestEngine = (raw.videoEngine as RequestEngine) || 'auto';
  const isAvatar = raw.isAvatarMode ?? (mode === 'avatar');
  // Avatar CINEMATIC (script-driven, hollywood clip-loop) vs DIRECT (verbatim
  // single-pass) is keyed on the seedance engine in the legacy router.
  const scriptGenerate = raw.hasScript ??
    (mode === 'avatar' ? (raw.isBreakout || engine === 'seedance') : (mode !== 'video2video' && mode !== 'motion-transfer'));
  return {
    mode,
    engine,
    inputs: {} as ProductionInputs,
    script: { generate: scriptGenerate } as ProductionScript,
    continuity: {} as ProductionContinuity,
    format: {} as ProductionFormat,
    audio: {} as ProductionAudio,
    breakout: { isBreakout: !!raw.isBreakout } as ProductionBreakout,
    gate: {} as ProductionGate,
    isAvatarMode: isAvatar,
  };
}

// Single source of truth for which legacy handler runs. EXACTLY reproduces the
// mode-router switch: avatar cinematic-vs-direct keys on the (breakout-forced)
// seedance engine; effects map by mode; everything else is cinematic.
export function resolveHandlerKey(pr: ProductionRequest): HandlerKey {
  switch (pr.mode) {
    case 'video2video':
      return 'handleStyleTransferMode';
    case 'motion-transfer':
      return 'handleMotionTransferMode';
    case 'avatar':
      // Keyed on the RAW requested engine (matches the legacy switch's
      // `videoEngine === 'seedance'`), NOT the breakout-forced engine.
      return pr.engine === 'seedance' ? 'handleAvatarCinematicMode' : 'handleAvatarDirectMode';
    case 'text':
    case 'image':
    case 'broll':
    default:
      return 'handleCinematicMode';
  }
}

// ─── Canonical resolved plan (the golden-harness + unified-executor contract) ──
// The single, fully-resolved description of HOW a request executes. As each mode
// is folded into the unified clip-loop, the executor follows THIS plan; the
// golden-render harness snapshots it per product type so a fold can't silently
// change what runs.
export interface ProductionPlan {
  mode: ProductionMode;
  handlerKey: HandlerKey;
  engine: BackendEngine;
  dispatchStrategy: DispatchStrategyKind;
  audioStrategy: AudioStrategy;
  operation: ShotOperation;
  executionLane: ExecutionLane;
  effectFn: 'stylize-video' | 'motion-transfer' | 'generate-avatar-direct' | null;
  scriptGenerate: boolean;
  /** Per-shot operation for the first 3 shots (no carried start image). */
  shotOperations: ShotOperation[];
}

export function resolvePlan(pr: ProductionRequest): ProductionPlan {
  const engine = resolveEngine(pr);
  const op = resolveOperation(pr);
  return {
    mode: pr.mode,
    handlerKey: resolveHandlerKey(pr),
    engine,
    dispatchStrategy: resolveDispatchStrategy(engine),
    audioStrategy: resolveAudioStrategy(pr),
    operation: op.operation,
    executionLane: op.executionLane,
    effectFn: op.effectFn ?? null,
    scriptGenerate: pr.script.generate,
    shotOperations: [0, 1, 2].map((i) => resolveShotOperation(pr, i, false)),
  };
}
