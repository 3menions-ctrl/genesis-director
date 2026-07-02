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

import { getEngineProfile } from './engine-profiles.ts';

// ─── Engines ────────────────────────────────────────────────────────────────
// Backend engine keys — these are the ONLY values the spine (generate-single-clip)
// routes on. Mirror of generate-single-clip:1229.
export type BackendEngine = 'wan' | 'kling' | 'veo' | 'seedance' | 'runway' | 'sora';

// Request-level engine. `auto` is a legacy token still accepted at the parse
// layer for old clients, but it no longer resolves to anything — resolveEngine
// rejects it (NO DEFAULT MODEL policy).
export type RequestEngine = BackendEngine | 'auto';

// Live Replicate route labels — DERIVED from the engine-profiles registry so
// the slug is pinned in exactly ONE place (engine-profiles.ts).
export const ENGINE_ROUTE_LABEL: Record<BackendEngine, string> = {
  wan:      getEngineProfile('wan').replicateSlug,
  kling:    getEngineProfile('kling').replicateSlug,
  seedance: getEngineProfile('seedance').replicateSlug,
  veo:      getEngineProfile('veo').replicateSlug,
  runway:   getEngineProfile('runway').replicateSlug,
  sora:     getEngineProfile('sora').replicateSlug,
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

/** Thrown when a request reaches the pipeline without an explicit engine.
 *  NO DEFAULT MODEL policy: users always pick their engine; the only
 *  server-side engine assignment is a template force (breakout → seedance). */
export class EngineRequiredError extends Error {
  readonly code = 'ENGINE_REQUIRED';
  constructor() {
    super('Engine selection is required. Pick an engine — there is no default model. (Special templates force their own engine server-side.)');
    this.name = 'EngineRequiredError';
  }
}

// Resolve the backend engine actually used.
//  - Breakout forces seedance (4th-wall lock; legacy mode-router:385 force).
//  - An explicit engine wins.
//  - `auto` / missing → EngineRequiredError. There is no default model; the
//    entry gates (mode-router / hollywood-pipeline) turn this into a 400.
export function resolveEngine(pr: ProductionRequest): BackendEngine {
  if (pr.breakout?.isBreakout) return 'seedance';
  if (pr.engine && pr.engine !== 'auto') return pr.engine;
  throw new EngineRequiredError();
}

// Dispatch mode is a PROFILE FIELD (engine-profiles.ts), not an engine
// special-case: parallel = Promise.allSettled batch + keyframe-pair continuity
// + post-render audio mux (seedance today); sequential = callback-chained loop.
export function resolveDispatchStrategy(engine: BackendEngine): DispatchStrategyKind {
  return getEngineProfile(engine).dispatch;
}

// Audio strategy follows the engine profile:
//  - native: the engine renders audio inline (kling/veo/sora).
//  - post-mux: no in-clip audio → voice/music muxed post-stitch.
//  - overlay: avatar TTS overlaid on a post-mux engine (seedance avatar).
// NOTE: wan/runway are audio:'post-mux' in the profile, but the legacy
// contract treated every non-seedance engine as 'native' (their silent tracks
// flow through the same in-clip lane). Preserve that wire behavior here —
// the stitcher decides what to mux from postProduction flags, not from this.
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
