/**
 * Breakthrough FX — the engine.
 *
 * Takes a `TemplateDefinition`, resolves it through the existing compositor
 * (layers + mask + beats + destination motion), and plays the 4-layer
 * breakthrough deterministically on a 2D canvas:
 *
 *   bg → chrome + inner media → boundary sim (debris) → emergent subject → style
 *
 * Forward playback steps the sim incrementally; scrubbing backward re-simulates
 * from t=0 (seed-stable, so the result is identical). No backend, no GPU server.
 */

import {
  resolveTemplate,
  type AudioCue,
  type CompositedScene,
  type TemplateDefinition,
} from "@/lib/templates/breakthrough";
import {
  clamp01,
  makeRng,
  rgba,
  sampleTrack,
  smoothstep,
  type FrameCtx,
} from "./core";
import { drawContainer } from "./chrome";
import { drawFigure, makeSim, simKindFor, type Sim } from "./sims";

export interface EngineOptions {
  seed?: number;
  intensity?: number;
  audioCue?: AudioCue;
}

const STEP = 1 / 60;
const MAX_STEPS = 2000;

export class BreakthroughEngine {
  private scene: CompositedScene;
  private sim: Sim;
  private simTime = 0;
  private intensity: number;
  private seed: number;

  constructor(private def: TemplateDefinition, opts: EngineOptions = {}) {
    this.seed = opts.seed ?? 1337;
    this.intensity = opts.intensity ?? 1;
    this.scene = resolveTemplate(def, { audioCue: opts.audioCue });
    this.sim = makeSim(simKindFor(def.boundaryViolation), this.makeRng());
  }

  get durationSec(): number {
    return this.scene.timeline.durationSec;
  }
  get breakBeatSec(): number {
    return this.scene.timeline.breakBeatSec;
  }
  get simKind() {
    return simKindFor(this.def.boundaryViolation);
  }

  private makeRng() {
    // fresh deterministic stream per (re)build
    return makeRng(this.seed);
  }

  setIntensity(x: number) {
    this.intensity = Math.max(0.3, Math.min(2, x));
  }

  /** Move the break beat (demos audio-cue sync). Re-resolves + resets. */
  setBreakBeat(sec: number) {
    this.scene = resolveTemplate(this.def, { audioCue: { atSec: sec } });
    this.reset();
  }

  reset() {
    this.sim = makeSim(simKindFor(this.def.boundaryViolation), this.makeRng());
    this.simTime = 0;
  }

  /** Compute the per-frame context (phases, mask, destination motion). */
  frameCtx(timeSec: number): FrameCtx {
    const t = this.scene.timeline;
    const breakSec = t.breakBeatSec;
    const duration = t.durationSec;
    const tensionBeat = t.beats.find((b) => b.role === "tension")?.atSec ?? Math.max(0, breakSec - 3);

    const breakProgress = clamp01((timeSec - breakSec) / Math.max(0.001, duration - breakSec));
    const tension = clamp01((timeSec - tensionBeat) / Math.max(0.001, breakSec - tensionBeat));
    const maskReveal = clamp01(
      (timeSec - this.scene.mask.openStartSec) /
        Math.max(0.001, this.scene.mask.openEndSec - this.scene.mask.openStartSec),
    );

    const bt = this.scene.layers.find((l) => l.kind === "breakthrough");
    const kfs = bt?.keyframes;
    const motion = {
      x: sampleTrack(kfs, "positionX", breakProgress, 0),
      y: sampleTrack(kfs, "positionY", breakProgress, 0),
      scale: sampleTrack(kfs, "scale", breakProgress, 1),
      rotationDeg: sampleTrack(kfs, "rotation", breakProgress, 0),
      opacity: sampleTrack(kfs, "opacity", breakProgress, 1),
    };

    return {
      timeSec,
      durationSec: duration,
      breakSec,
      breakProgress,
      tension,
      maskReveal,
      motion,
      palette: this.def.colorGrade,
      mediaWindow: this.def.container.mediaWindow,
      intensity: this.intensity,
    };
  }

  /** Advance the sim deterministically to `timeSec`. */
  advanceTo(timeSec: number) {
    if (timeSec < this.simTime - 1e-6) this.reset();
    let steps = 0;
    while (this.simTime < timeSec - 1e-9 && steps < MAX_STEPS) {
      const dt = Math.min(STEP, timeSec - this.simTime);
      this.simTime += dt;
      this.sim.step(dt, this.frameCtx(this.simTime));
      steps++;
    }
  }

  /** Draw the frame at `timeSec` into the 2D context. */
  render(g: CanvasRenderingContext2D, w: number, h: number, timeSec: number) {
    const fc = this.frameCtx(timeSec);
    const P = fc.palette;

    // ── bg (the "outer space" the subject lands in) ──
    const bg = g.createRadialGradient(w * 0.5, h * 0.38, 0, w * 0.5, h * 0.5, Math.hypot(w, h) * 0.6);
    bg.addColorStop(0, rgba(P.primary, 1));
    bg.addColorStop(1, "#04050a");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // pre-break "tension" pulse around the window
    if (fc.breakProgress <= 0 && fc.tension > 0) {
      const m = fc.mediaWindow;
      g.save();
      g.globalAlpha = fc.tension * 0.5 * (0.5 + 0.5 * Math.sin(timeSec * 10));
      g.strokeStyle = rgba(P.accent, 1);
      g.lineWidth = 3;
      g.strokeRect(m.x * w, m.y * h, m.width * w, m.height * h);
      g.restore();
    }

    // ── chrome + inner media (layers 0-1) ──
    drawContainer(g, w, h, { kind: this.def.container.kind, fc, reveal: fc.maskReveal });

    // ── boundary sim (layer 2-3 debris) ──
    this.sim.draw(g, w, h, fc);

    // ── emergent subject (character violations) ──
    if (this.sim.hasFigure) drawFigure(g, w, h, fc);

    // ── style pass ──
    this.applyStyle(g, w, h, fc);
  }

  private applyStyle(g: CanvasRenderingContext2D, w: number, h: number, fc: FrameCtx) {
    const kind = this.def.container.kind;

    // break flash — a quick bloom right on the beat
    const flash = smoothstep(1 - Math.abs(fc.timeSec - fc.breakSec) / 0.45);
    if (flash > 0) {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.fillStyle = rgba(fc.palette.accent, flash * 0.35);
      g.fillRect(0, 0, w, h);
      g.restore();
    }

    // scanlines for surveillance/screen containers
    if (kind === "cctv-grid" || kind === "billboard") {
      g.save();
      g.globalAlpha = 0.12;
      g.fillStyle = "#000";
      for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
      g.restore();
    }

    // chromatic fringe near the break (cheap edge-offset glow)
    if (fc.breakProgress > 0 && fc.breakProgress < 0.4) {
      const s = (1 - fc.breakProgress / 0.4) * 6;
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.25;
      g.fillStyle = rgba(fc.palette.secondary, 1);
      g.fillRect(-s, 0, w, h);
      g.fillStyle = rgba(fc.palette.accent, 1);
      g.fillRect(s, 0, w, h);
      g.restore();
    }

    // vignette
    const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
  }
}
