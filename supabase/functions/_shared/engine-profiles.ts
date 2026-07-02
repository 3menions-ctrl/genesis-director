// ═══════════════════════════════════════════════════════════════════════════
// engine-profiles.ts — ONE capability profile per engine, driving behavior.
//
// This module is PURE DATA (no fetch, no Deno I/O) — importable by
// production-request (pure resolvers), hollywood-pipeline dispatch strategy,
// generate-single-clip (spine), generate-video, and unit tests alike.
//
// Design rule (docs/PIPELINE.md §5 "everything is data"): a behavior fork per
// engine is a FIELD here, not an `if (engine === 'seedance')` branch in an
// orchestrator. Adding engine #7 must be a new entry in this table plus an
// input-builder — zero new branches.
//
// NO DEFAULT MODEL: there is intentionally no default entry and no fallback
// lookup — getEngineProfile throws on unknown/missing keys.
// ═══════════════════════════════════════════════════════════════════════════

export type EngineKey = 'wan' | 'kling' | 'seedance' | 'veo' | 'sora' | 'runway';

export type DispatchMode = 'sequential' | 'parallel';
export type AudioMode = 'native' | 'post-mux';
export type ContinuityStrategy =
  // First+last keyframe pair per clip (start `image` + `last_frame_image`).
  | 'keyframe-pair'
  // Previous clip's extracted last frame → next clip's start_image.
  | 'lastframe-carry'
  // Reference-image / prompt-side identity lock only (no frame conditioning
  // beyond the start image).
  | 'prompt-anchor';

export type PromptGrammar =
  // [CAMERA]/[LIGHT]/[LIP-SYNC] block grammar (Kling).
  | 'camera-blocks'
  // Motion/physics-forward, no lens jargon, vendor formula ordering
  // subject+action+scene+lighting+camera-movement+style+quality+constraints
  // (Seedance — see BytePlus ModelArk prompt guide, 2026-06).
  | 'motion-first'
  // Narrative scaffolding: subject → action → camera → light → style (Sora).
  | 'narrative'
  // Inline audio cues materially help (Veo — native A/V generation).
  | 'audio-inline'
  // Short, action-forward subject/verb/setting; long prompts hurt (Wan).
  | 'compact-action'
  // Terse, keyframe/reference-driven (Runway).
  | 'reference-terse';

export interface EngineProfile {
  key: EngineKey;
  /** Replicate model slug (owner/name). Pin "latest" HERE — nowhere else. */
  replicateSlug: string;
  /** Legal per-clip durations (seconds); requests snap to nearest. */
  durations: number[];
  defaultDuration: number;
  fps: number;
  aspectRatios: string[];

  // ── Conditioning capabilities ────────────────────────────────────────────
  conditioning: {
    startImage: boolean;
    /** End-frame interpolation target (`last_frame_image`). Seedance only. */
    endImage: boolean;
    /** Max identity reference images the endpoint accepts (0 = unsupported).
     *  Seedance 2.0's endpoint documents up to 9 reference images — exposed
     *  here but gated by SEEDANCE_REFERENCE_CONDITIONING until verified live
     *  against the Replicate packaging (research open question). */
    referenceImages: number;
    /** Camera lock flag (`camera_fixed`). Seedance only. */
    cameraFixed: boolean;
  };

  // ── Prompt dialect ───────────────────────────────────────────────────────
  promptDialect: {
    grammar: PromptGrammar;
    maxChars: number;
    negativePrompt: boolean;
    /** Whether spoken dialogue belongs in the prompt (native audio engines). */
    dialogueInPrompt: boolean;
    /** Vendor flags explicit per-segment second-marks ("0-3 seconds") as
     *  unstable → tuner strips them. Verified for Seedance (BytePlus docs). */
    stripSecondMarks: boolean;
  };

  // ── Orchestration strategy (was: engine === 'seedance' special cases) ────
  /** Clip dispatch: sequential callback-chain vs parallel batch. */
  dispatch: DispatchMode;
  /** native = audio generated in-clip; post-mux = TTS/music muxed post-stitch. */
  audio: AudioMode;
  supportsLipSync: boolean;
  continuity: ContinuityStrategy;
}

export const ENGINE_PROFILES: Record<EngineKey, EngineProfile> = {
  wan: {
    key: 'wan',
    // t2v slug; chained clips route to wan-video/wan-2.7-i2v (image input).
    replicateSlug: 'wan-video/wan-2.7-t2v',
    durations: [5, 10, 15],
    defaultDuration: 5,
    fps: 24,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    conditioning: { startImage: true, endImage: false, referenceImages: 0, cameraFixed: false },
    promptDialect: { grammar: 'compact-action', maxChars: 900, negativePrompt: true, dialogueInPrompt: true, stripSecondMarks: false },
    dispatch: 'sequential',
    audio: 'native', // Wan 2.7 generates synchronized audio natively
    supportsLipSync: false,
    continuity: 'lastframe-carry',
  },
  kling: {
    key: 'kling',
    replicateSlug: 'kwaivgi/kling-v3-video',
    durations: [5, 10, 15],
    defaultDuration: 10,
    fps: 30,
    aspectRatios: ['16:9', '9:16', '1:1'],
    conditioning: { startImage: true, endImage: false, referenceImages: 4, cameraFixed: false },
    promptDialect: { grammar: 'camera-blocks', maxChars: 1900, negativePrompt: true, dialogueInPrompt: true, stripSecondMarks: false },
    dispatch: 'sequential',
    audio: 'native',
    supportsLipSync: true,
    continuity: 'lastframe-carry',
  },
  seedance: {
    key: 'seedance',
    replicateSlug: 'bytedance/seedance-2.0',
    durations: [3, 5, 10, 12],
    defaultDuration: 10,
    fps: 24,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
    conditioning: { startImage: true, endImage: true, referenceImages: 9, cameraFixed: true },
    // Native audio is ON (endpoint schema verified live 2026-07-02):
    // dialogue in double quotes drives generated speech per vendor docs.
    promptDialect: { grammar: 'motion-first', maxChars: 2400, negativePrompt: false, dialogueInPrompt: true, stripSecondMarks: true },
    dispatch: 'parallel',
    audio: 'post-mux',
    supportsLipSync: false,
    continuity: 'keyframe-pair',
  },
  veo: {
    key: 'veo',
    replicateSlug: 'google/veo-3.1-fast',
    durations: [4, 6, 8],
    defaultDuration: 8,
    fps: 30,
    aspectRatios: ['16:9', '9:16'],
    // Veo 3.1 adds last_frame — keyframe-pair interpolation like Seedance.
    conditioning: { startImage: true, endImage: true, referenceImages: 0, cameraFixed: false },
    promptDialect: { grammar: 'audio-inline', maxChars: 1900, negativePrompt: true, dialogueInPrompt: true, stripSecondMarks: false },
    dispatch: 'sequential',
    audio: 'native',
    supportsLipSync: false,
    continuity: 'keyframe-pair',
  },
  sora: {
    key: 'sora',
    replicateSlug: 'openai/sora-2',
    durations: [4, 8, 12],
    defaultDuration: 8,
    fps: 30,
    aspectRatios: ['16:9', '9:16', '1:1'],
    conditioning: { startImage: true, endImage: false, referenceImages: 0, cameraFixed: false },
    promptDialect: { grammar: 'narrative', maxChars: 1900, negativePrompt: false, dialogueInPrompt: true, stripSecondMarks: false },
    dispatch: 'sequential',
    audio: 'native',
    supportsLipSync: false,
    continuity: 'prompt-anchor',
  },
  runway: {
    key: 'runway',
    replicateSlug: 'runwayml/gen-4.5',
    durations: [5, 10],
    defaultDuration: 5,
    fps: 30,
    aspectRatios: ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'],
    conditioning: { startImage: true, endImage: false, referenceImages: 0, cameraFixed: false },
    promptDialect: { grammar: 'reference-terse', maxChars: 1900, negativePrompt: false, dialogueInPrompt: false, stripSecondMarks: false },
    dispatch: 'sequential',
    audio: 'post-mux',
    supportsLipSync: false,
    continuity: 'lastframe-carry',
  },
};

/** Profile lookup. Throws on unknown/missing — NO DEFAULT MODEL. */
export function getEngineProfile(key: string | undefined | null): EngineProfile {
  const p = key ? ENGINE_PROFILES[key as EngineKey] : undefined;
  if (!p) {
    throw new Error(`Unknown or missing engine "${key}" — engine must be explicit (no default model).`);
  }
  return p;
}

// ── Feature flags for research-verified capabilities ────────────────────────
// VALIDATED 2026-07-02 against the live Replicate bytedance/seedance-2.0
// schema (version a6dcbae88b15): the endpoint exposes `reference_images`
// (up to 9, character consistency), `generate_audio` (joint A/V incl.
// dialogue), `reference_audios`, `reference_videos`, `last_frame_image`.
export const SEEDANCE_NATIVE_AUDIO = true;           // joint A/V generation — ON.
// The TTS combined-voice step is skipped for seedance when this is on (the
// model voices the dialogue itself); music stays post-mux per user toggle.
export const SEEDANCE_REFERENCE_CONDITIONING = true; // 9-image identity refs — LIVE
