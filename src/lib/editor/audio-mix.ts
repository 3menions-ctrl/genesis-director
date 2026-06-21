/**
 * Audio mixing — per-clip AudioMix + project-level master loudness.
 *
 * Two implementations share this model:
 *
 *   1. Live preview (Web Audio API) — see useAudioMixChain hook.
 *      Wires the active video element through:
 *        source → low-shelf → mid-peak → high-shelf → compressor → gain
 *      A MediaElementAudioSourceNode taps the <video> element exactly
 *      once; subsequent clip-mix changes update BiquadFilter / Compressor
 *      params in place. Bypass via "enabled" flags switches the node
 *      gains to identity so the chain stays connected.
 *
 *   2. Export bake (FFmpeg) — compiled by compileClipAudioFilter in
 *      _shared/audio-mix-filters.ts. Built as a chain of `equalizer`,
 *      `acompressor`, and `pan` filters injected into the per-input
 *      audio normalization in seamless-stitcher. Master loudness is
 *      applied AFTER the audio xfade chain via `loudnorm` (EBU R128).
 *
 * The two implementations target functional equivalence — the same
 * EQ frequencies + gains produce the same response curve in both,
 * the same compressor params produce the same envelope. Small
 * differences exist (Web Audio's compressor knee is in dB, FFmpeg's
 * knee semantics differ slightly) but they're below psychoacoustic
 * threshold for the moderate settings the editor exposes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// EQ — 3-band: low-shelf + parametric mid + high-shelf
// ─────────────────────────────────────────────────────────────────────────────
export interface EqBand {
  /** Gain in dB. ±18 dB range. 0 = no change. */
  gain: number;
  /** Center / corner frequency in Hz. */
  freq: number;
}

export interface ParametricEqBand extends EqBand {
  /** Q factor for peaking filter. Higher = narrower. 0.1..10. */
  q: number;
}

export interface ThreeBandEq {
  enabled: boolean;
  /** Low shelf — boosts/cuts everything below `freq`. Default 100Hz. */
  low: EqBand;
  /** Parametric mid — peaking filter at `freq` with width Q. Default 1kHz/Q=0.7. */
  mid: ParametricEqBand;
  /** High shelf — boosts/cuts everything above `freq`. Default 8kHz. */
  high: EqBand;
}

export const DEFAULT_EQ: ThreeBandEq = {
  enabled: false,
  low:  { gain: 0, freq: 100  },
  mid:  { gain: 0, freq: 1000, q: 0.7 },
  high: { gain: 0, freq: 8000 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Compressor — single-band dynamics
// ─────────────────────────────────────────────────────────────────────────────
export interface Compressor {
  enabled: boolean;
  /** Threshold in dB below which compression engages. -60..0. */
  threshold: number;
  /** Ratio above threshold. 1 = no compression, ∞ = limiter. 1..20. */
  ratio: number;
  /** Attack time in milliseconds. 0..200. */
  attack: number;
  /** Release time in milliseconds. 1..2000. */
  release: number;
  /** Knee width in dB. 0 = hard knee, 40 = soft. 0..40. */
  knee: number;
  /** Output makeup gain in dB. -12..+24. */
  makeupGain: number;
}

export const DEFAULT_COMPRESSOR: Compressor = {
  enabled: false,
  threshold: -24,
  ratio: 4,
  attack: 5,
  release: 100,
  knee: 6,
  makeupGain: 0,
};

/** Voice-talker preset — sensible compression for narration / interviews. */
export const COMPRESSOR_PRESETS = {
  voice:    { enabled: true, threshold: -22, ratio: 3,  attack: 5,  release: 80,  knee: 6,  makeupGain: 2 },
  music:    { enabled: true, threshold: -18, ratio: 2,  attack: 15, release: 150, knee: 10, makeupGain: 1 },
  drum:     { enabled: true, threshold: -12, ratio: 8,  attack: 1,  release: 60,  knee: 0,  makeupGain: 3 },
  broadcast:{ enabled: true, threshold: -16, ratio: 6,  attack: 2,  release: 50,  knee: 2,  makeupGain: 4 },
  limiter:  { enabled: true, threshold: -3,  ratio: 20, attack: 0.1,release: 30,  knee: 0,  makeupGain: 0 },
} satisfies Record<string, Compressor>;

// ─────────────────────────────────────────────────────────────────────────────
// Per-clip mix
// ─────────────────────────────────────────────────────────────────────────────
export interface NoiseReduction {
  enabled: boolean;
  /** Strength, 0..1 — maps to FFmpeg afftdn nr (0..96 dB). */
  strength: number;
}

export interface Reverb {
  enabled: boolean;
  /** Reverb size, 0..1 — controls delay length. Maps to aecho delays. */
  size: number;
  /** Wet/dry mix, 0..1 — 0=dry, 1=fully wet. Maps to aecho decay × in_gain. */
  mix: number;
}

export const DEFAULT_NOISE_REDUCTION: NoiseReduction = { enabled: false, strength: 0.4 };
export const DEFAULT_REVERB: Reverb = { enabled: false, size: 0.3, mix: 0.25 };

export interface AudioMix {
  /** Output gain, 0..1.5. Same range as the legacy `properties.volume`. */
  volume: number;
  /** Stereo pan, -1 (left) to +1 (right). 0 = center. */
  pan: number;
  /** Force-mute this clip (independent of volume). */
  muted: boolean;
  eq: ThreeBandEq;
  compressor: Compressor;
  /** FFT denoise (afftdn). Off by default. */
  noiseReduction?: NoiseReduction;
  /** Echo/reverb effect. Off by default. */
  reverb?: Reverb;
}

export const DEFAULT_AUDIO_MIX: AudioMix = {
  volume: 1,
  pan: 0,
  muted: false,
  eq: DEFAULT_EQ,
  compressor: DEFAULT_COMPRESSOR,
  noiseReduction: DEFAULT_NOISE_REDUCTION,
  reverb: DEFAULT_REVERB,
};

/**
 * Defensive normalize — JSONB loaded from the DB or a stale draft
 * snapshot may be missing eq/compressor sub-fields. Fill from DEFAULT
 * so the Web Audio chain, the Inspector panel, and the FFmpeg
 * compiler can all walk every property without crashing on
 * `undefined.enabled`.
 */
export function normalizeMix(mix: AudioMix | Partial<AudioMix> | null | undefined): AudioMix {
  if (!mix) return DEFAULT_AUDIO_MIX;
  const m = mix as Partial<AudioMix>;
  return {
    volume: m.volume ?? DEFAULT_AUDIO_MIX.volume,
    pan:    m.pan    ?? DEFAULT_AUDIO_MIX.pan,
    muted:  m.muted  ?? DEFAULT_AUDIO_MIX.muted,
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

// ─────────────────────────────────────────────────────────────────────────────
// Master loudness — project-level target for delivery
// ─────────────────────────────────────────────────────────────────────────────
export type MasterLoudnessPreset =
  | "off"          // no normalization — true bypass
  | "streaming"    // YouTube, Spotify, TikTok: -14 LUFS / -1 dBTP / 7 LU
  | "podcast"      // Apple Podcasts, Spotify pods: -16 LUFS / -1 dBTP / 7 LU
  | "broadcast"    // EBU R128 / ATSC A/85: -23 LUFS / -1 dBTP / 7 LU
  | "cinema";      // DCP / SMPTE: -27 LUFS / -2 dBTP / 18 LU

export interface MasterLoudnessSpec {
  preset: MasterLoudnessPreset;
  /** Integrated loudness target (LUFS). */
  I: number;
  /** True peak ceiling (dBTP). */
  TP: number;
  /** Loudness range (LU). */
  LRA: number;
}

export const MASTER_LOUDNESS_SPECS: Record<MasterLoudnessPreset, MasterLoudnessSpec> = {
  off:        { preset: "off",        I:   0,  TP:   0, LRA:  0  },
  streaming:  { preset: "streaming",  I: -14,  TP:  -1, LRA:  7  },
  podcast:    { preset: "podcast",    I: -16,  TP:  -1, LRA:  7  },
  broadcast:  { preset: "broadcast",  I: -23,  TP:  -1, LRA:  7  },
  cinema:     { preset: "cinema",     I: -27,  TP:  -2, LRA: 18  },
};

export const MASTER_LOUDNESS_LABELS: Record<MasterLoudnessPreset, string> = {
  off:        "Off · no normalization",
  streaming:  "Streaming · -14 LUFS (YouTube · Spotify · TikTok)",
  podcast:    "Podcast · -16 LUFS (Apple · Spotify pods)",
  broadcast:  "Broadcast · -23 LUFS (EBU R128 · ATSC)",
  cinema:     "Cinema · -27 LUFS (DCP · SMPTE)",
};

export interface MasterLoudnessTile {
  preset: MasterLoudnessPreset;
  title: string;
  target: string;
  platforms: string;
}

export const MASTER_LOUDNESS_TILES: MasterLoudnessTile[] = [
  { preset: "off",       title: "Off",       target: "no normalization", platforms: "raw mix as-is" },
  { preset: "streaming", title: "Streaming", target: "-14 LUFS",          platforms: "YouTube · Spotify · TikTok" },
  { preset: "podcast",   title: "Podcast",   target: "-16 LUFS",          platforms: "Apple · Spotify pods" },
  { preset: "broadcast", title: "Broadcast", target: "-23 LUFS",          platforms: "EBU R128 · ATSC A/85" },
  { preset: "cinema",    title: "Cinema",    target: "-27 LUFS",          platforms: "DCP · SMPTE theatrical" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — EQ response curve sampling for the visualizer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate the 3-band EQ magnitude response at a given frequency in
 * Hz. Returns dB gain. Used by the AudioMixPanel's EQ visualizer to
 * paint the combined response curve.
 *
 * Math:
 *   • Low shelf  — biquad lowshelf response (Pirkle / Bristow-Johnson)
 *   • Mid peak   — biquad peaking response
 *   • High shelf — biquad highshelf response
 *
 * Sum dB contributions across the three bands at each frequency.
 */
export function eqResponseAt(eq: ThreeBandEq, freqHz: number): number {
  if (!eq.enabled) return 0;
  return (
    biquadShelfGain(freqHz, eq.low.freq, eq.low.gain, "low")
  + biquadPeakGain(freqHz, eq.mid.freq, eq.mid.gain, eq.mid.q)
  + biquadShelfGain(freqHz, eq.high.freq, eq.high.gain, "high")
  );
}

/** Pirkle-style shelving filter magnitude in dB at frequency f. */
function biquadShelfGain(f: number, f0: number, gainDb: number, kind: "low" | "high"): number {
  if (Math.abs(gainDb) < 0.01) return 0;
  const A = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * f0;
  const w = 2 * Math.PI * f;
  // Shelving slope S=1 (RBJ convention)
  const alpha = Math.sin(w0) / 2 * Math.sqrt((A + 1 / A) * (1 / 1 - 1) + 2);
  // For shelving slope of 1 the standard RBJ form is messy; instead use
  // a simple approximation that's accurate near the corner frequency.
  // Sigmoid blend between A^2 (passband gain) and 1 (stopband).
  const r = f / f0;
  let blend: number;
  if (kind === "low") {
    blend = 1 / (1 + Math.pow(r * 2, 2));
  } else {
    blend = Math.pow(r * 2, 2) / (1 + Math.pow(r * 2, 2));
  }
  void alpha; void w; // RBJ refs kept for future precise impl
  // 20 log10(A^(2*blend))  =  20 * 2 * blend * log10(A)  =  40 * blend * gainDb/40
  return blend * gainDb;
}

/** Peaking EQ magnitude in dB at f. */
function biquadPeakGain(f: number, f0: number, gainDb: number, Q: number): number {
  if (Math.abs(gainDb) < 0.01) return 0;
  const A = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * f0;
  const w = 2 * Math.PI * f;
  // Approximate magnitude of a peaking biquad. For visualization only —
  // close to the actual Web Audio response in the listening range.
  const dw = (w / w0) - (w0 / w);
  const denom = 1 + (1 / (Q * Q)) * dw * dw;
  const num = 1 + (A * A / (Q * Q)) * dw * dw;
  return 10 * Math.log10(num / denom);
}

/**
 * Sample the EQ curve at N points across the 20Hz..20kHz audible range
 * on a logarithmic scale. Returns dB gains. Used for the visualizer's
 * SVG path.
 */
export function sampleEqCurve(eq: ThreeBandEq, samples = 64): Array<{ freq: number; dB: number }> {
  const out: Array<{ freq: number; dB: number }> = [];
  const minHz = 20;
  const maxHz = 20000;
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const freq = minHz * Math.pow(maxHz / minHz, t);
    out.push({ freq, dB: eqResponseAt(eq, freq) });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — compressor static curve (for the visualizer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Static IO curve of the compressor at a given input level (dB).
 * Returns output level (dB). Used by the compressor visualizer.
 */
export function compressorIo(comp: Compressor, inputDb: number): number {
  if (!comp.enabled) return inputDb;
  const T = comp.threshold;
  const K = comp.knee;
  const R = comp.ratio;
  let out: number;
  const x = inputDb;
  if (x < T - K / 2) {
    out = x;
  } else if (x > T + K / 2) {
    out = T + (x - T) / R;
  } else {
    // Soft knee — quadratic blend
    const t = (x - T + K / 2) / K;
    const gainReduction = (1 - 1 / R) * 0.5 * Math.pow(t, 2) * K;
    out = x - gainReduction;
  }
  return out + comp.makeupGain;
}
