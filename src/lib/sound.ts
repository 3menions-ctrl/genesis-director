/**
 * Sound design layer for Small Bridges.
 *
 * Tiny Web Audio API engine that synthesises 12 short SFX in code so we
 * don't ship any audio assets (every reference set we tried felt either
 * too "AAA game" or too "Slack ping"). The result is a tasteful, brand-
 * appropriate sonic skin that's:
 *
 *   - Zero bytes in the initial bundle (pure code)
 *   - Off by default; user opts in via Settings
 *   - Respects prefers-reduced-motion (sound auto-off if true)
 *   - Throttled so spam-clicks don't stack into noise
 *
 * Surface API:
 *   import { sfx } from "@/lib/sound";
 *   sfx.play("hover")       // very soft, throttled
 *   sfx.play("click")
 *   sfx.play("render-done")
 *   sfx.play("tip")
 *   sfx.setEnabled(true)
 *
 * Replace the synthesis later with hand-recorded samples by swapping
 * the `voices` map — the surface API stays the same.
 */

export type SoundCue =
  | "hover"
  | "click"
  | "press"
  | "drag"
  | "drop"
  | "open"
  | "close"
  | "success"
  | "error"
  | "tip"
  | "render-done"
  | "page-whoosh";

const STORAGE_KEY = "sb.sound.enabled";

interface Voice {
  /** Total clip duration in seconds. */
  duration: number;
  /** Render the voice into an offline buffer. */
  render(ctx: BaseAudioContext): AudioBuffer;
}

function reducedMotionPreferred(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch { return false; }
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private master: GainNode | null = null;
  private buffers = new Map<SoundCue, AudioBuffer>();
  private lastPlayedAt = new Map<SoundCue, number>();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        this.enabled = stored === "1";
      } catch { /* noop */ }
    }
  }

  setEnabled(next: boolean) {
    this.enabled = next;
    try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* noop */ }
    if (!next) this.master?.gain.setValueAtTime(0, this.ctx?.currentTime ?? 0);
    else if (this.ctx && this.master) this.master.gain.setValueAtTime(0.5, this.ctx.currentTime);
  }

  isEnabled() { return this.enabled; }

  private ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctx = (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return null;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private getBuffer(cue: SoundCue): AudioBuffer | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    const cached = this.buffers.get(cue);
    if (cached) return cached;
    const voice = voices[cue];
    const buf = voice.render(ctx);
    this.buffers.set(cue, buf);
    return buf;
  }

  play(cue: SoundCue, volume = 1) {
    if (!this.enabled) return;
    if (reducedMotionPreferred()) return;
    const now = Date.now();
    const last = this.lastPlayedAt.get(cue) ?? 0;
    // Per-cue throttle so a barrage of identical events doesn't stack.
    const minInterval = cue === "hover" ? 80 : 30;
    if (now - last < minInterval) return;
    this.lastPlayedAt.set(cue, now);

    const ctx = this.ensureContext();
    const buf = this.getBuffer(cue);
    if (!ctx || !buf || !this.master) return;
    if (ctx.state === "suspended") void ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = Math.min(Math.max(volume, 0), 1);
    src.connect(gain).connect(this.master);
    src.start();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Voice library — 12 hand-tuned synth recipes.
// All durations are short (<400ms) except render-done. All volumes are
// pre-scaled to feel "soft" by default — the engine layers a master
// gain of 0.5 on top so even the loudest cue lands gently.
// ────────────────────────────────────────────────────────────────────────

function renderTone(ctx: BaseAudioContext, opts: {
  duration: number;
  freq: number;
  freqEnd?: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  detune?: number;
}): AudioBuffer {
  const {
    duration, freq, freqEnd, type = "sine",
    gain = 0.3, attack = 0.005, release = duration - 0.005,
    detune = 0,
  } = opts;
  const sampleRate = (ctx as { sampleRate?: number }).sampleRate ?? 44100;
  const buffer = ctx.createBuffer(1, Math.floor(duration * sampleRate), sampleRate);
  const data = buffer.getChannelData(0);
  const fEnd = freqEnd ?? freq;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    // Envelope (attack + release ramp)
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t > release) env = Math.max(0, (duration - t) / (duration - release));
    // Frequency sweep
    const ratio = t / duration;
    const f = freq + (fEnd - freq) * ratio;
    const phase = 2 * Math.PI * f * t + detune;
    let s = 0;
    switch (type) {
      case "sine":     s = Math.sin(phase); break;
      case "triangle": s = 2 / Math.PI * Math.asin(Math.sin(phase)); break;
      case "square":   s = Math.sin(phase) >= 0 ? 1 : -1; break;
      case "sawtooth": s = (((f * t) % 1) * 2) - 1; break;
      default:         s = Math.sin(phase);
    }
    data[i] = s * env * gain;
  }
  return buffer;
}

const voices: Record<SoundCue, Voice> = {
  hover: { duration: 0.06, render: (ctx) => renderTone(ctx, { duration: 0.06, freq: 1200, freqEnd: 1500, gain: 0.06, type: "sine" }) },
  click: { duration: 0.08, render: (ctx) => renderTone(ctx, { duration: 0.08, freq: 1800, freqEnd: 900, gain: 0.18, type: "triangle" }) },
  press: { duration: 0.1,  render: (ctx) => renderTone(ctx, { duration: 0.1, freq: 600, freqEnd: 400, gain: 0.2, type: "sine" }) },
  drag:  { duration: 0.12, render: (ctx) => renderTone(ctx, { duration: 0.12, freq: 500, freqEnd: 700, gain: 0.12, type: "triangle" }) },
  drop:  { duration: 0.14, render: (ctx) => renderTone(ctx, { duration: 0.14, freq: 420, freqEnd: 280, gain: 0.22, type: "sine" }) },
  open:  { duration: 0.22, render: (ctx) => renderTone(ctx, { duration: 0.22, freq: 880, freqEnd: 1320, gain: 0.18, type: "sine", attack: 0.01, release: 0.12 }) },
  close: { duration: 0.2,  render: (ctx) => renderTone(ctx, { duration: 0.2,  freq: 1100, freqEnd: 660, gain: 0.16, type: "sine" }) },
  success: { duration: 0.32, render: (ctx) => renderTone(ctx, { duration: 0.32, freq: 880, freqEnd: 1760, gain: 0.22, type: "sine", attack: 0.01, release: 0.2 }) },
  error: { duration: 0.18, render: (ctx) => renderTone(ctx, { duration: 0.18, freq: 320, freqEnd: 180, gain: 0.25, type: "sawtooth" }) },
  tip:   { duration: 0.4,  render: (ctx) => renderTone(ctx, { duration: 0.4,  freq: 1320, freqEnd: 1980, gain: 0.22, type: "sine", attack: 0.005, release: 0.32 }) },
  "render-done": {
    duration: 0.7,
    render: (ctx) => {
      // Two-note ascending sting (an octave + a fifth) — synth approximation
      // of a cinematic completion chord. The samples sum and we clip-normalise.
      const sampleRate = (ctx as { sampleRate?: number }).sampleRate ?? 44100;
      const length = Math.floor(0.7 * sampleRate);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const out = buffer.getChannelData(0);
      const tone = (freq: number, start: number, dur: number, gain: number) => {
        const startSample = Math.floor(start * sampleRate);
        const endSample = Math.min(length, startSample + Math.floor(dur * sampleRate));
        for (let i = startSample; i < endSample; i++) {
          const t = (i - startSample) / sampleRate;
          const env = Math.exp(-3 * t);
          out[i] += Math.sin(2 * Math.PI * freq * t) * env * gain;
        }
      };
      tone(660, 0.0, 0.5, 0.22);   // E5
      tone(880, 0.08, 0.5, 0.22);  // A5
      tone(1320, 0.18, 0.45, 0.18); // E6
      // Subtle hi-shelf shimmer
      tone(2640, 0.18, 0.35, 0.05);
      return buffer;
    },
  },
  "page-whoosh": { duration: 0.28, render: (ctx) => renderTone(ctx, { duration: 0.28, freq: 220, freqEnd: 80, gain: 0.18, type: "triangle", attack: 0.02, release: 0.18 }) },
};

export const sfx = new SoundEngine();
