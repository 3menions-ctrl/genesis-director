/**
 * Audio mix compile — compileClipAudioFilter (FFmpeg bake), plus
 * isIdentityMix + normalizeMix + masterLoudnormFilter.
 *
 * The bake path lives in the Deno _shared module so the same compile
 * function ships to both the seamless-stitcher edge function and any
 * future preview helper that needs to emit FFmpeg fragments.
 */

import { describe, it, expect } from "vitest";
import {
  compileClipAudioFilter,
  masterLoudnormFilter,
} from "../../../supabase/functions/_shared/audio-mix-filters.ts";
import {
  DEFAULT_AUDIO_MIX,
  type AudioMix,
} from "@/lib/editor/audio-mix";
import {
  isIdentityMix,
  normalizeMix,
} from "../../../supabase/functions/_shared/audio-mix.ts";

function withMix(patch: Partial<AudioMix>): AudioMix {
  return { ...DEFAULT_AUDIO_MIX, ...patch };
}

describe("isIdentityMix", () => {
  it("treats null/undefined as identity", () => {
    expect(isIdentityMix(null)).toBe(true);
    expect(isIdentityMix(undefined)).toBe(true);
  });

  it("default mix is identity", () => {
    expect(isIdentityMix(DEFAULT_AUDIO_MIX)).toBe(true);
  });

  it("muted is NOT identity (it's a real op)", () => {
    expect(isIdentityMix(withMix({ muted: true }))).toBe(false);
  });

  it("any meaningful volume change leaves identity", () => {
    expect(isIdentityMix(withMix({ volume: 0.5 }))).toBe(false);
    // But tiny floating-point noise stays inside the deadband.
    expect(isIdentityMix(withMix({ volume: 1.001 }))).toBe(true);
  });

  it("any pan change leaves identity", () => {
    expect(isIdentityMix(withMix({ pan: 0.5 }))).toBe(false);
  });

  it("enabled compressor leaves identity", () => {
    expect(
      isIdentityMix(
        withMix({ compressor: { ...DEFAULT_AUDIO_MIX.compressor, enabled: true } }),
      ),
    ).toBe(false);
  });
});

describe("normalizeMix", () => {
  it("returns DEFAULT_AUDIO_MIX when input is null/undefined", () => {
    expect(normalizeMix(null)).toEqual(DEFAULT_AUDIO_MIX);
    expect(normalizeMix(undefined)).toEqual(DEFAULT_AUDIO_MIX);
  });

  it("fills missing fields from defaults", () => {
    const partial = { volume: 0.7 } as Partial<AudioMix>;
    const out = normalizeMix(partial);
    expect(out.volume).toBe(0.7);
    expect(out.pan).toBe(DEFAULT_AUDIO_MIX.pan);
    expect(out.eq).toEqual(DEFAULT_AUDIO_MIX.eq);
  });

  it("merges nested EQ partials with default bands", () => {
    const partial = {
      eq: { enabled: true, low: { gain: 3, freq: 100 } },
    } as Partial<AudioMix>;
    const out = normalizeMix(partial);
    expect(out.eq.enabled).toBe(true);
    expect(out.eq.low.gain).toBe(3);
    // Mid/high should fall through from defaults
    expect(out.eq.mid).toEqual(DEFAULT_AUDIO_MIX.eq.mid);
    expect(out.eq.high).toEqual(DEFAULT_AUDIO_MIX.eq.high);
  });
});

describe("compileClipAudioFilter", () => {
  it("identity mix → empty string (fast path)", () => {
    expect(compileClipAudioFilter(DEFAULT_AUDIO_MIX)).toBe("");
    expect(compileClipAudioFilter(null)).toBe("");
    expect(compileClipAudioFilter(undefined)).toBe("");
  });

  it("muted compiles to volume=0", () => {
    const out = compileClipAudioFilter(withMix({ muted: true }));
    expect(out).toBe("volume=0");
  });

  it("non-unity volume compiles to volume=N", () => {
    const out = compileClipAudioFilter(withMix({ volume: 0.5 }));
    expect(out).toMatch(/^volume=0\.500/);
  });

  it("pan compiles to a normalized stereo balance", () => {
    const out = compileClipAudioFilter(withMix({ pan: 1 })); // hard right
    expect(out).toContain("pan=stereo|c0=");
    // Hard right pans c0 (left) to 0 and c1 (right) to 1.
    expect(out).toMatch(/c0=0\.000\*c0/);
    expect(out).toMatch(/c1=1\.000\*c1/);
  });

  it("EQ low-shelf compiles to an equalizer chain at the low band", () => {
    const out = compileClipAudioFilter(
      withMix({
        eq: {
          ...DEFAULT_AUDIO_MIX.eq,
          enabled: true,
          low: { ...DEFAULT_AUDIO_MIX.eq.low, gain: 4 },
        },
      }),
    );
    expect(out).toContain("equalizer=");
    expect(out).toContain(`f=${DEFAULT_AUDIO_MIX.eq.low.freq}`);
    expect(out).toContain("g=4.00");
  });

  it("enabled compressor compiles to acompressor with linear threshold", () => {
    const out = compileClipAudioFilter(
      withMix({
        compressor: {
          ...DEFAULT_AUDIO_MIX.compressor,
          enabled: true,
          threshold: -20, // dB
        },
      }),
    );
    expect(out).toContain("acompressor=");
    // -20 dB = 10^(-20/20) = 0.1 linear
    expect(out).toMatch(/threshold=0\.1000/);
  });

  it("attack/release convert ms → seconds for the FFmpeg arg", () => {
    const out = compileClipAudioFilter(
      withMix({
        compressor: {
          ...DEFAULT_AUDIO_MIX.compressor,
          enabled: true,
          attack: 50, // ms
          release: 200,
        },
      }),
    );
    expect(out).toContain("attack=0.0500");
    expect(out).toContain("release=0.2000");
  });

  it("noise reduction enabled compiles to afftdn", () => {
    const out = compileClipAudioFilter(
      withMix({
        noiseReduction: { enabled: true, strength: 0.5 },
      }),
    );
    expect(out).toContain("afftdn=");
  });

  it("reverb enabled compiles to aecho", () => {
    const out = compileClipAudioFilter(
      withMix({
        reverb: { enabled: true, size: 0.5, mix: 0.3 },
      }),
    );
    expect(out).toContain("aecho=");
  });

  it("multiple stages join with commas (single afilter chain)", () => {
    const out = compileClipAudioFilter(withMix({ volume: 0.7, pan: 0.5 }));
    expect(out.includes(",")).toBe(true);
    expect(out.split(",").length).toBe(2);
  });
});

describe("masterLoudnormFilter", () => {
  it("returns empty string for the 'off' preset", () => {
    expect(masterLoudnormFilter("off")).toBe("");
  });

  it("returns a loudnorm chain with EBU-R128 args for active presets", () => {
    const out = masterLoudnormFilter("podcast");
    expect(out).toContain("loudnorm=");
    expect(out).toMatch(/I=-?\d+/);
    expect(out).toMatch(/TP=-?\d+/);
    expect(out).toMatch(/LRA=\d+/);
  });
});
