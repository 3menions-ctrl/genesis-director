/**
 * Preview/bake parity — static audio-mix properties (non-keyframed).
 *
 * Preview path: `applyMix(nodes, mix)` in useAudioMixChain.ts —
 *   writes mix.volume / pan / EQ / compressor onto Web Audio nodes.
 *
 * Bake path: `compileClipAudioFilter(mix)` in _shared/audio-mix-filters.ts —
 *   emits the equivalent FFmpeg afilter chain.
 *
 * Both consume the SAME AudioMix object. Parity here means:
 *   1. Both agree on what's an identity (no-op) mix.
 *   2. Both apply the same clamps to user-supplied values.
 *   3. Round-trip values from the user input to the emitted FFmpeg
 *      string match the value the preview node would receive.
 *
 * Without this contract a slider in the inspector can shift one path's
 * behavior without the other — the editor preview sounds fine, the
 * rendered MP4 sounds off, the user can't reconcile what they hear.
 */

import { describe, it, expect } from "vitest";
import { compileClipAudioFilter } from "../../../supabase/functions/_shared/audio-mix-filters.ts";
import { isIdentityMix } from "../../../supabase/functions/_shared/audio-mix.ts";
import { DEFAULT_AUDIO_MIX, type AudioMix } from "@/lib/editor/audio-mix";

function mixWith(patch: Partial<AudioMix>): AudioMix {
  return { ...DEFAULT_AUDIO_MIX, ...patch };
}

describe("identity contract — preview skip ↔ bake empty", () => {
  it("default mix → identity on both sides", () => {
    expect(isIdentityMix(DEFAULT_AUDIO_MIX)).toBe(true);
    expect(compileClipAudioFilter(DEFAULT_AUDIO_MIX)).toBe("");
  });

  it("muted is NOT identity — preview sets gain=0, bake emits volume=0", () => {
    const mix = mixWith({ muted: true });
    expect(isIdentityMix(mix)).toBe(false);
    expect(compileClipAudioFilter(mix)).toBe("volume=0");
  });

  it("compressor enabled → not identity → bake emits acompressor", () => {
    const mix = mixWith({
      compressor: { ...DEFAULT_AUDIO_MIX.compressor, enabled: true },
    });
    expect(isIdentityMix(mix)).toBe(false);
    expect(compileClipAudioFilter(mix)).toContain("acompressor=");
  });

  it("reverb enabled → not identity → bake emits aecho", () => {
    const mix = mixWith({
      reverb: { enabled: true, size: 0.4, mix: 0.3 },
    });
    expect(isIdentityMix(mix)).toBe(false);
    expect(compileClipAudioFilter(mix)).toContain("aecho=");
  });

  it("noise reduction enabled → not identity → bake emits afftdn", () => {
    const mix = mixWith({
      noiseReduction: { enabled: true, strength: 0.5 },
    });
    expect(isIdentityMix(mix)).toBe(false);
    expect(compileClipAudioFilter(mix)).toContain("afftdn=");
  });
});

describe("volume parity", () => {
  it("volume=0.5 round-trips to the bake unchanged (3-decimal precision)", () => {
    const out = compileClipAudioFilter(mixWith({ volume: 0.5 }));
    expect(out).toContain("volume=0.500");
  });

  it("volume=1.5 (max boost) round-trips", () => {
    const out = compileClipAudioFilter(mixWith({ volume: 1.5 }));
    expect(out).toContain("volume=1.500");
  });

  it("muted overrides volume — preview sets 0, bake emits volume=0", () => {
    const out = compileClipAudioFilter(mixWith({ muted: true, volume: 0.7 }));
    expect(out).toBe("volume=0");
  });
});

describe("pan parity", () => {
  it("hard right (pan=1) → c0 silent, c1 full (matches stereo panner pan=1)", () => {
    const out = compileClipAudioFilter(mixWith({ pan: 1 }));
    expect(out).toMatch(/c0=0\.000\*c0/);
    expect(out).toMatch(/c1=1\.000\*c1/);
  });

  it("hard left (pan=-1) → c0 full, c1 silent", () => {
    const out = compileClipAudioFilter(mixWith({ pan: -1 }));
    expect(out).toMatch(/c0=1\.000\*c0/);
    expect(out).toMatch(/c1=0\.000\*c1/);
  });

  it("center pan (default) → no pan filter emitted", () => {
    const out = compileClipAudioFilter(mixWith({ pan: 0 }));
    expect(out).not.toContain("pan=stereo");
  });
});

describe("EQ band parity", () => {
  it("low-band gain=4 dB at default frequency emits equalizer at the right freq", () => {
    const out = compileClipAudioFilter(
      mixWith({
        eq: {
          ...DEFAULT_AUDIO_MIX.eq,
          enabled: true,
          low: { ...DEFAULT_AUDIO_MIX.eq.low, gain: 4 },
        },
      }),
    );
    expect(out).toContain(`f=${DEFAULT_AUDIO_MIX.eq.low.freq}`);
    expect(out).toContain("g=4.00");
  });

  it("EQ disabled → no equalizer chunks even with non-zero gains", () => {
    const out = compileClipAudioFilter(
      mixWith({
        eq: {
          ...DEFAULT_AUDIO_MIX.eq,
          enabled: false,
          low: { ...DEFAULT_AUDIO_MIX.eq.low, gain: 9 },
        },
      }),
    );
    expect(out).not.toContain("equalizer=");
  });
});

describe("compressor parity — preview vs bake unit conversions", () => {
  it("threshold in dB → bake converts to linear amplitude (10^(dB/20))", () => {
    const out = compileClipAudioFilter(
      mixWith({
        compressor: {
          ...DEFAULT_AUDIO_MIX.compressor,
          enabled: true,
          threshold: -20, // dB → linear 0.1
        },
      }),
    );
    expect(out).toMatch(/threshold=0\.1000/);
  });

  it("attack 50ms → bake emits attack=0.0500 (sec)", () => {
    const out = compileClipAudioFilter(
      mixWith({
        compressor: {
          ...DEFAULT_AUDIO_MIX.compressor,
          enabled: true,
          attack: 50,
        },
      }),
    );
    expect(out).toContain("attack=0.0500");
  });

  it("makeupGain in dB → bake emits makeup as linear ratio", () => {
    const out = compileClipAudioFilter(
      mixWith({
        compressor: {
          ...DEFAULT_AUDIO_MIX.compressor,
          enabled: true,
          makeupGain: 6, // dB → linear ~2.0
        },
      }),
    );
    // 10^(6/20) ≈ 1.9953
    expect(out).toMatch(/makeup=1\.99\d+/);
  });
});

describe("DEFAULT_AUDIO_MIX is in sync across the frontend + Deno copies", () => {
  // This catches the same class of drift Week 2 found — anyone editing
  // DEFAULT_COMPRESSOR / DEFAULT_EQ / DEFAULT_AUDIO_MIX on one side and
  // forgetting the other gets a red test immediately.
  it("compressor threshold matches between preview and bake defaults", async () => {
    const denoModule = await import(
      "../../../supabase/functions/_shared/audio-mix.ts"
    );
    const denoCompressor = denoModule.DEFAULT_COMPRESSOR;
    expect(denoCompressor.threshold).toBe(
      DEFAULT_AUDIO_MIX.compressor.threshold,
    );
    expect(denoCompressor.ratio).toBe(DEFAULT_AUDIO_MIX.compressor.ratio);
    expect(denoCompressor.attack).toBe(DEFAULT_AUDIO_MIX.compressor.attack);
    expect(denoCompressor.release).toBe(DEFAULT_AUDIO_MIX.compressor.release);
    expect(denoCompressor.knee).toBe(DEFAULT_AUDIO_MIX.compressor.knee);
    expect(denoCompressor.makeupGain).toBe(
      DEFAULT_AUDIO_MIX.compressor.makeupGain,
    );
  });

  it("EQ defaults match", async () => {
    const denoModule = await import(
      "../../../supabase/functions/_shared/audio-mix.ts"
    );
    expect(denoModule.DEFAULT_EQ).toEqual(DEFAULT_AUDIO_MIX.eq);
  });
});
