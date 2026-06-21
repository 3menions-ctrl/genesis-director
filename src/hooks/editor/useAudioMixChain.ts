/**
 * useAudioMixChain — wires an HTMLMediaElement (the player's <video>)
 * through a Web Audio API processing chain that mirrors the FFmpeg
 * bake.
 *
 * Chain topology:
 *   source → lowShelf → midPeak → highShelf → compressor → pannerGain → masterGain → destination
 *
 *   • The three biquad filters always exist; "eq.enabled = false"
 *     zeros their gains so they're identity (cheaper than reconnecting).
 *   • The compressor exists; "compressor.enabled = false" sets
 *     threshold high enough that nothing engages, then knee=0.
 *   • Pan is via a stereo gain pair (Web Audio's StereoPannerNode if
 *     available; otherwise a ChannelSplitter+gain trick).
 *
 * Lifecycle:
 *   - First call on a media element creates the source node (cached
 *     by element ref in a WeakMap because MediaElementAudioSourceNode
 *     can only be created ONCE per element).
 *   - Subsequent calls update filter params in place — no
 *     reconnections, no clicks.
 *   - On unmount, the chain stays connected; nodes are GC'd with the
 *     element.
 */
import { useEffect, useRef } from "react";
import { type AudioMix, DEFAULT_AUDIO_MIX, normalizeMix } from "@/lib/editor/audio-mix";

// ─────────────────────────────────────────────────────────────────────────────
// Shared AudioContext + per-element node cache
// ─────────────────────────────────────────────────────────────────────────────
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (_ctx) return _ctx;
  // Lazily create on first user gesture (audio policy requires it).
  const Ctor: typeof AudioContext = (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  _ctx = new Ctor();
  return _ctx;
}

interface ChainNodes {
  source: MediaElementAudioSourceNode;
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  comp: DynamicsCompressorNode;
  panner: StereoPannerNode | null;
  master: GainNode;
}

const _chainsByElement = new WeakMap<HTMLMediaElement, ChainNodes>();

/**
 * Resume the shared AudioContext if it's suspended. Browsers
 * auto-suspend the context until a user gesture fires; the hook's
 * useEffect runs OUTSIDE a gesture so its ctx.resume() is ignored.
 * Call this from any user-gesture handler (the transport play button,
 * the keyboard shortcut handler, etc.) BEFORE invoking
 * MediaElement.play() so the chain produces audible output on the very
 * first playback attempt.
 */
export function resumeAudioCtx(): void {
  try {
    const ctx = _ctx;
    if (ctx && ctx.state === "suspended") void ctx.resume();
  } catch { /* ignored */ }
}

/**
 * Ramp the master gain of an element's chain to `target` over `ms`.
 * Used by StitchedPlayer to crossfade audio at clip boundaries — far
 * smoother than the prior `muted={!isShowingA}` attribute swap, which
 * produced a hard zero crossing the human ear hears as a click.
 *
 * No-op (returns false) if the chain hasn't been built for this
 * element yet — the caller will have to retry once the chain exists.
 */
export function rampElementGain(
  el: HTMLMediaElement | null,
  target: number,
  ms = 60,
): boolean {
  if (!el) return false;
  const nodes = _chainsByElement.get(el);
  if (!nodes) return false;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const param = nodes.master.gain;
    // Ceiling raised 1.5 → 16 so compressor makeup gain (10^(24/20)
    // ≈ 15.8) doesn't get nuked when a crossfade-time write clamps
    // back to 1.5. Without this, any clip swap silently dropped a
    // user-tuned makeup by ~20 dB on every boundary.
    const clamped = Math.max(0, Math.min(16, target));
    param.cancelScheduledValues(now);
    // Start from current value (cancelScheduledValues alone doesn't
    // anchor); setValueAtTime anchors so the linearRamp endpoint
    // overrides nothing else.
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(clamped, now + Math.max(0.001, ms / 1000));
    return true;
  } catch {
    return false;
  }
}

/**
 * Hard-set the master gain immediately (no ramp). Used by the
 * StitchedPlayer canvas rAF loop to track the visual crossfade
 * sample-by-sample (60Hz) — the per-frame writes ARE the crossfade,
 * so we don't want each write to schedule its own 60ms ramp on top
 * of the previous one. Returns false if the chain isn't built yet.
 */
export function setElementGain(
  el: HTMLMediaElement | null,
  value: number,
): boolean {
  if (!el) return false;
  const nodes = _chainsByElement.get(el);
  if (!nodes) return false;
  try {
    const ctx = getCtx();
    const param = nodes.master.gain;
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(16, value));
    // Direct .value writes on Chrome can lose to a pending automation
    // event even after cancelScheduledValues. setValueAtTime anchors
    // the new value at the current time so the write actually lands.
    param.cancelScheduledValues(now);
    param.setValueAtTime(clamped, now);
    return true;
  } catch {
    return false;
  }
}

function buildChain(el: HTMLMediaElement): ChainNodes {
  const cached = _chainsByElement.get(el);
  if (cached) return cached;
  const ctx = getCtx();
  const source = ctx.createMediaElementSource(el);
  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 100;
  low.gain.value = 0;
  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1000;
  mid.Q.value = 0.7;
  mid.gain.value = 0;
  const high = ctx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 8000;
  high.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -100; // effectively off until enabled
  comp.knee.value = 0;
  comp.ratio.value = 1;
  comp.attack.value = 0.005;
  comp.release.value = 0.1;
  const panner = typeof StereoPannerNode !== "undefined" ? ctx.createStereoPanner() : null;
  const master = ctx.createGain();
  master.gain.value = 1;

  // Connect
  source.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(comp);
  if (panner) {
    comp.connect(panner);
    panner.connect(master);
  } else {
    comp.connect(master);
  }
  master.connect(ctx.destination);

  const nodes: ChainNodes = { source, low, mid, high, comp, panner, master };
  _chainsByElement.set(el, nodes);
  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply a mix snapshot to the chain — no reconnections, just .value writes
// ─────────────────────────────────────────────────────────────────────────────
function applyMix(nodes: ChainNodes, mix: AudioMix) {
  // Volume + mute
  const linear = mix.muted ? 0 : Math.max(0, Math.min(1.5, mix.volume));
  nodes.master.gain.value = linear;

  // EQ
  if (mix.eq.enabled) {
    nodes.low.frequency.value  = mix.eq.low.freq;
    nodes.low.gain.value       = mix.eq.low.gain;
    nodes.mid.frequency.value  = mix.eq.mid.freq;
    nodes.mid.Q.value          = Math.max(0.1, Math.min(10, mix.eq.mid.q));
    nodes.mid.gain.value       = mix.eq.mid.gain;
    nodes.high.frequency.value = mix.eq.high.freq;
    nodes.high.gain.value      = mix.eq.high.gain;
  } else {
    nodes.low.gain.value  = 0;
    nodes.mid.gain.value  = 0;
    nodes.high.gain.value = 0;
  }

  // Compressor
  if (mix.compressor.enabled) {
    const c = mix.compressor;
    nodes.comp.threshold.value = Math.max(-100, Math.min(0,  c.threshold));
    nodes.comp.knee.value      = Math.max(0,    Math.min(40, c.knee));
    nodes.comp.ratio.value     = Math.max(1,    Math.min(20, c.ratio));
    nodes.comp.attack.value    = Math.max(0,    Math.min(1,  c.attack / 1000));
    nodes.comp.release.value   = Math.max(0,    Math.min(1,  c.release / 1000));
    // Web Audio's compressor doesn't have makeupGain — apply to master gain instead.
    // Keep the master gain combining: volume × makeupGain_linear
    const makeup = Math.pow(10, c.makeupGain / 20);
    nodes.master.gain.value = linear * makeup;
  } else {
    nodes.comp.threshold.value = -100;
    nodes.comp.ratio.value     = 1;
  }

  // Pan
  if (nodes.panner) {
    nodes.panner.pan.value = Math.max(-1, Math.min(1, mix.pan));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — call from a component that owns a media element ref
// ─────────────────────────────────────────────────────────────────────────────
export function useAudioMixChain(
  elementRef: React.RefObject<HTMLMediaElement | null>,
  mix: AudioMix | null | undefined,
) {
  // Compute the fingerprint OUTSIDE the effect and depend on the
  // string. Previously the effect re-ran on every `mix` reference
  // change (which is every render that constructs a fresh object,
  // e.g. `aClip?.properties?.audioMix` reading from JSONB). Now we
  // bail at the React level, not just inside the body — the effect
  // doesn't even run on reference-only changes.
  const fingerprint = mixFingerprint(normalizeMix(mix ?? DEFAULT_AUDIO_MIX));
  const lastAppliedFingerprint = useRef<string | null>(null);
  useEffect(() => {
    // The ref can be null on the first mount because the parent
    // hands the ref to the <video> on a later render (StitchedPlayer
    // resolves the active element only after metadata). Poll via rAF
    // until the element shows up — silenced clips in the past were a
    // direct consequence of bailing on the null ref and never re-running.
    let cancelled = false;
    let rafId = 0;
    let attempts = 0;
    const targetMix = normalizeMix(mix ?? DEFAULT_AUDIO_MIX);
    const tryInit = () => {
      if (cancelled) return;
      const el = elementRef.current;
      if (!el) {
        if (++attempts > 240) return; // ~4s at 60fps; give up quietly
        rafId = requestAnimationFrame(tryInit);
        return;
      }
      try {
        const nodes = buildChain(el);
        applyMix(nodes, targetMix);
        lastAppliedFingerprint.current = fingerprint;
        const ctx = getCtx();
        if (ctx.state === "suspended") void ctx.resume();
      } catch (e) {
        console.warn("[useAudioMixChain] chain init failed:", e);
      }
    };
    rafId = requestAnimationFrame(tryInit);
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementRef, fingerprint]);
}

function mixFingerprint(m: AudioMix): string {
  return [
    m.volume, m.pan, m.muted ? 1 : 0,
    m.eq.enabled ? 1 : 0,
    m.eq.low.gain, m.eq.low.freq,
    m.eq.mid.gain, m.eq.mid.freq, m.eq.mid.q,
    m.eq.high.gain, m.eq.high.freq,
    m.compressor.enabled ? 1 : 0,
    m.compressor.threshold, m.compressor.ratio, m.compressor.attack,
    m.compressor.release, m.compressor.knee, m.compressor.makeupGain,
    m.noiseReduction?.enabled ? 1 : 0, m.noiseReduction?.strength ?? 0,
    m.reverb?.enabled ? 1 : 0, m.reverb?.size ?? 0, m.reverb?.mix ?? 0,
  ].join("|");
}
