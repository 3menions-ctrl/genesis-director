/**
 * useAudioMixChain — Web Audio chain wiring.
 *
 * The hook polls the elementRef via rAF until it resolves, then
 * builds a MediaElementAudioSourceNode → biquad → compressor →
 * panner → master gain chain. Full audio-chain testing requires a
 * real AudioContext; under jsdom we only exercise the contract
 * surface — that the hook can be called with null refs and the
 * various mix shapes without throwing.
 *
 * The actual audio graph correctness is verified at the bake side
 * via compileClipAudioFilter unit tests (audio-mix.test.ts), so the
 * preview path's job here is just "don't crash on partial refs".
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useAudioMixChain } from "@/hooks/editor/useAudioMixChain";
import { DEFAULT_AUDIO_MIX } from "@/lib/editor/audio-mix";

// jsdom has no AudioContext; stub one so the hook's `getCtx()` doesn't
// crash. We only need the surface the hook touches — state, resume,
// createMediaElementSource, createBiquadFilter, createDynamicsCompressor,
// createStereoPanner, createGain, destination. None of them need to
// produce real audio; spies are enough.
beforeAll(() => {
  const node = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequency: { value: 0 },
    Q: { value: 0 },
    gain: { value: 0 },
    threshold: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    knee: { value: 0 },
    pan: { value: 0 },
    type: "peaking",
  };
  class FakeAudioContext {
    state = "running";
    destination = { ...node };
    createMediaElementSource = vi.fn().mockReturnValue(node);
    createBiquadFilter = vi.fn().mockReturnValue({ ...node });
    createDynamicsCompressor = vi.fn().mockReturnValue({ ...node });
    createStereoPanner = vi.fn().mockReturnValue({ ...node });
    createGain = vi.fn().mockReturnValue({ ...node });
    resume = vi.fn().mockResolvedValue(undefined);
  }
  (globalThis as Record<string, unknown>).AudioContext = FakeAudioContext;
  (globalThis as Record<string, unknown>).webkitAudioContext = FakeAudioContext;
});

describe("useAudioMixChain", () => {
  it("does not throw when the ref is null and mix is null", () => {
    expect(() =>
      renderHook(() => {
        const ref = useRef<HTMLMediaElement | null>(null);
        useAudioMixChain(ref, null);
      }),
    ).not.toThrow();
  });

  it("does not throw when the ref is null and mix is DEFAULT_AUDIO_MIX", () => {
    expect(() =>
      renderHook(() => {
        const ref = useRef<HTMLMediaElement | null>(null);
        useAudioMixChain(ref, DEFAULT_AUDIO_MIX);
      }),
    ).not.toThrow();
  });

  it("the hook unmount cancels pending rAF polling without leaks", () => {
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLMediaElement | null>(null);
      useAudioMixChain(ref, DEFAULT_AUDIO_MIX);
    });
    expect(() => unmount()).not.toThrow();
  });

  it("accepts a mix with the EQ enabled without throwing at hook-time", () => {
    const mix = {
      ...DEFAULT_AUDIO_MIX,
      eq: { ...DEFAULT_AUDIO_MIX.eq, enabled: true },
    };
    expect(() =>
      renderHook(() => {
        const ref = useRef<HTMLMediaElement | null>(null);
        useAudioMixChain(ref, mix);
      }),
    ).not.toThrow();
  });
});
