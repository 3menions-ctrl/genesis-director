/**
 * FFmpeg audio-mix compiler — turns AudioMix into a per-clip filter
 * chain, and turns a MasterLoudnessPreset into a master loudness
 * normalization filter applied after the audio xfade chain.
 *
 * Mapping:
 *   AudioMix.volume         → volume=NdB         (linear → dB)
 *   AudioMix.pan            → pan=stereo|c0=...|c1=...
 *   AudioMix.muted          → volume=0 (full attenuation)
 *   AudioMix.eq.low         → equalizer=f=F:width_type=q:width=0.7:g=G  (low-shelf)
 *   AudioMix.eq.mid         → equalizer=f=F:width_type=q:width=Q:g=G    (peaking)
 *   AudioMix.eq.high        → equalizer=f=F:width_type=q:width=0.7:g=G  (high-shelf)
 *   AudioMix.compressor     → acompressor=threshold=T:ratio=R:attack=A:release=Rel:knee=K:makeup=M
 *   MasterLoudnessPreset    → loudnorm=I=-14:TP=-1:LRA=7  (etc.)
 *
 * Note: FFmpeg's `equalizer` filter is a peaking biquad. For our
 * "shelf" bands we use the same filter with `width_type=q:width=0.7`
 * (Q ≈ 0.7), which gives a shelf-like response near the corner. A
 * more faithful shelf would be `lowshelf`/`highshelf` via afftfilt or
 * the LADSPA plugin set — defer until a real divergence shows up.
 */
import type { AudioMix, MasterLoudnessPreset } from "./audio-mix.ts";
import { MASTER_LOUDNESS_SPECS, isIdentityMix, normalizeMix } from "./audio-mix.ts";

/**
 * Compile a clip's AudioMix into a comma-joined FFmpeg afilter chain.
 * Returns "" when the mix is identity (no work).
 */
export function compileClipAudioFilter(mix: AudioMix | null | undefined): string {
  if (isIdentityMix(mix)) return "";
  const m = normalizeMix(mix);
  const parts: string[] = [];

  // Volume / mute. `volume` is linear gain; FFmpeg accepts linear OR dB.
  if (m.muted) {
    parts.push("volume=0");
  } else if (Math.abs(m.volume - 1) > 0.005) {
    parts.push(`volume=${m.volume.toFixed(3)}`);
  }

  // Pan. Map -1..+1 to L/R balance. Use `pan=stereo|c0=...|c1=...`
  // because the `pan` filter is precise; `apad` would be approximate.
  if (Math.abs(m.pan) > 0.005) {
    const L = Math.max(0, 1 - m.pan);
    const R = Math.max(0, 1 + m.pan);
    // Normalize so center pan is unity
    const scale = 1 / Math.max(L, R, 1);
    const Ln = (L * scale).toFixed(3);
    const Rn = (R * scale).toFixed(3);
    parts.push(`pan=stereo|c0=${Ln}*c0|c1=${Rn}*c1`);
  }

  // 3-band EQ
  if (m.eq.enabled) {
    if (Math.abs(m.eq.low.gain) > 0.05) {
      parts.push(
        `equalizer=f=${m.eq.low.freq}:width_type=q:width=0.7:g=${m.eq.low.gain.toFixed(2)}`,
      );
    }
    if (Math.abs(m.eq.mid.gain) > 0.05) {
      parts.push(
        `equalizer=f=${m.eq.mid.freq}:width_type=q:width=${m.eq.mid.q.toFixed(2)}:g=${m.eq.mid.gain.toFixed(2)}`,
      );
    }
    if (Math.abs(m.eq.high.gain) > 0.05) {
      parts.push(
        `equalizer=f=${m.eq.high.freq}:width_type=q:width=0.7:g=${m.eq.high.gain.toFixed(2)}`,
      );
    }
  }

  // Compressor
  if (m.compressor.enabled) {
    const c = m.compressor;
    // FFmpeg expects thresholds in linear gain (not dB) — convert.
    const thresholdLin = Math.pow(10, c.threshold / 20).toFixed(4);
    // attack/release in seconds; ours are in ms
    const attackSec = (c.attack / 1000).toFixed(4);
    const releaseSec = (c.release / 1000).toFixed(4);
    // knee — FFmpeg expects in dB
    const kneeDb = c.knee.toFixed(2);
    parts.push(
      `acompressor=threshold=${thresholdLin}:ratio=${c.ratio.toFixed(2)}:` +
      `attack=${attackSec}:release=${releaseSec}:knee=${kneeDb}:` +
      `makeup=${(Math.pow(10, c.makeupGain / 20)).toFixed(4)}`,
    );
  }

  // Noise reduction — FFmpeg afftdn (FFT denoiser). nr is in dB,
  // 0..96. Strength 0..1 maps to a comfortable 6..30 dB range.
  if (m.noiseReduction?.enabled) {
    const nrDb = Math.round(6 + (m.noiseReduction.strength ?? 0.4) * 24);
    parts.push(`afftdn=nr=${nrDb}:nf=-25`);
  }

  // Reverb — FFmpeg aecho approximates a basic echo/reverb tail.
  // For a true convolution reverb we'd need afir + impulse response
  // files. This produces a plausible chamber echo for VO + music.
  if (m.reverb?.enabled) {
    const size = m.reverb.size ?? 0.3;
    const mixAmount = m.reverb.mix ?? 0.25;
    const inGain = (1 - mixAmount * 0.3).toFixed(3);
    const outGain = "0.9";
    // Two-tap echo with delays scaled by size.
    const d1 = Math.round(40 + size * 200);
    const d2 = Math.round(80 + size * 400);
    const decay1 = (mixAmount * 0.5).toFixed(3);
    const decay2 = (mixAmount * 0.3).toFixed(3);
    parts.push(
      `aecho=in_gain=${inGain}:out_gain=${outGain}:delays=${d1}|${d2}:decays=${decay1}|${decay2}`,
    );
  }

  return parts.join(",");
}

/**
 * Master loudness normalization filter for the final audio stream.
 * Uses FFmpeg `loudnorm` (EBU R128 implementation). Two-pass would be
 * more accurate but adds ~1× the render time; single-pass is
 * adequate for the editor's purposes.
 *
 * Returns "" for the "off" preset.
 */
export function masterLoudnormFilter(preset: MasterLoudnessPreset): string {
  if (preset === "off") return "";
  const spec = MASTER_LOUDNESS_SPECS[preset];
  return `loudnorm=I=${spec.I}:TP=${spec.TP}:LRA=${spec.LRA}`;
}
