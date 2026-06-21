/**
 * Audio mixing — Deno mirror of src/lib/editor/audio-mix.ts.
 *
 * Only the types + master loudness specs are mirrored here; the
 * compiler (`compileClipAudioFilter`, `masterLoudnormFilter`) lives in
 * ./audio-mix-filters.ts.
 *
 * IMPORTANT: must stay in sync with the frontend copy. Any change to
 * the AudioMix shape, default values, or master loudness specs lands
 * on both sides in the same commit.
 */

export interface EqBand {
  gain: number;  // dB
  freq: number;  // Hz
}

export interface ParametricEqBand extends EqBand {
  q: number;
}

export interface ThreeBandEq {
  enabled: boolean;
  low: EqBand;
  mid: ParametricEqBand;
  high: EqBand;
}

export interface Compressor {
  enabled: boolean;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  knee: number;
  makeupGain: number;
}

export interface NoiseReduction {
  enabled: boolean;
  /** 0..1 — maps to FFmpeg afftdn nr in dB. */
  strength: number;
}

export interface Reverb {
  enabled: boolean;
  /** Reverb size 0..1 — controls echo delays. */
  size: number;
  /** Wet/dry mix 0..1. */
  mix: number;
}

export interface AudioMix {
  volume: number;
  pan: number;
  muted: boolean;
  eq: ThreeBandEq;
  compressor: Compressor;
  noiseReduction?: NoiseReduction;
  reverb?: Reverb;
}

export type MasterLoudnessPreset =
  | "off" | "streaming" | "podcast" | "broadcast" | "cinema";

export interface MasterLoudnessSpec {
  preset: MasterLoudnessPreset;
  I: number;
  TP: number;
  LRA: number;
}

export const MASTER_LOUDNESS_SPECS: Record<MasterLoudnessPreset, MasterLoudnessSpec> = {
  off:        { preset: "off",        I:   0, TP:   0, LRA:  0 },
  streaming:  { preset: "streaming",  I: -14, TP:  -1, LRA:  7 },
  podcast:    { preset: "podcast",    I: -16, TP:  -1, LRA:  7 },
  broadcast:  { preset: "broadcast",  I: -23, TP:  -1, LRA:  7 },
  cinema:     { preset: "cinema",     I: -27, TP:  -2, LRA: 18 },
};

export const DEFAULT_EQ: ThreeBandEq = {
  enabled: false,
  low:  { gain: 0, freq: 100  },
  mid:  { gain: 0, freq: 1000, q: 0.7 },
  high: { gain: 0, freq: 8000 },
};

// Must mirror src/lib/editor/audio-mix.ts — the editor preview uses
// these values to drive the Web Audio compressor; the bake reads them
// to emit the FFmpeg `acompressor` filter. Drift between the two
// caused inaudible-in-preview, dramatic-on-export compression bugs.
export const DEFAULT_COMPRESSOR: Compressor = {
  enabled: false, threshold: -24, ratio: 4, attack: 5, release: 100, knee: 6, makeupGain: 0,
};

export const DEFAULT_NOISE_REDUCTION: NoiseReduction = { enabled: false, strength: 0.4 };
export const DEFAULT_REVERB: Reverb = { enabled: false, size: 0.3, mix: 0.25 };

export const DEFAULT_AUDIO_MIX: AudioMix = {
  volume: 1, pan: 0, muted: false, eq: DEFAULT_EQ, compressor: DEFAULT_COMPRESSOR,
  noiseReduction: DEFAULT_NOISE_REDUCTION,
  reverb: DEFAULT_REVERB,
};

/** Defensive normalize — JSONB from the DB may be missing fields if
 *  written by an older editor. Fill from DEFAULT so the compiler can
 *  walk every property without crashing. */
export function normalizeMix(mix: AudioMix | Partial<AudioMix> | null | undefined): AudioMix {
  if (!mix) return DEFAULT_AUDIO_MIX;
  const m = mix as Partial<AudioMix>;
  return {
    volume:  m.volume  ?? DEFAULT_AUDIO_MIX.volume,
    pan:     m.pan     ?? DEFAULT_AUDIO_MIX.pan,
    muted:   m.muted   ?? DEFAULT_AUDIO_MIX.muted,
    eq: {
      enabled: m.eq?.enabled ?? DEFAULT_EQ.enabled,
      low:  { ...DEFAULT_EQ.low,  ...(m.eq?.low  ?? {}) },
      mid:  { ...DEFAULT_EQ.mid,  ...(m.eq?.mid  ?? {}) },
      high: { ...DEFAULT_EQ.high, ...(m.eq?.high ?? {}) },
    },
    compressor: { ...DEFAULT_COMPRESSOR, ...(m.compressor ?? {}) },
    noiseReduction: { ...DEFAULT_NOISE_REDUCTION, ...(m.noiseReduction ?? {}) },
    reverb: { ...DEFAULT_REVERB, ...(m.reverb ?? {}) },
  };
}

/** True when the mix is a no-op — used to skip compiler work.
 *  Every enabled processor must be checked; missing one here means
 *  `compileClipAudioFilter` short-circuits to "" and the bake silently
 *  drops that processor on export. */
export function isIdentityMix(mix: AudioMix | null | undefined): boolean {
  if (!mix) return true;
  const m = normalizeMix(mix);
  if (m.muted) return false; // muted is a meaningful op
  if (Math.abs(m.volume - 1) > 0.005) return false;
  if (Math.abs(m.pan) > 0.005) return false;
  if (m.eq.enabled && (m.eq.low.gain || m.eq.mid.gain || m.eq.high.gain)) return false;
  if (m.compressor.enabled) return false;
  if (m.noiseReduction?.enabled) return false;
  if (m.reverb?.enabled) return false;
  return true;
}
