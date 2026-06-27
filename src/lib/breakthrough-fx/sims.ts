/**
 * Breakthrough FX — per-violation simulators.
 *
 * Each sim owns the "breakthrough + aftermath" visual (layers 2-3): it spawns
 * and steps real particles/shards/agents when the break beat fires, and draws
 * them above the chrome. All geometry is normalised (0..1); the engine scales.
 *
 * Deterministic: spawn + step use the engine's seeded RNG, so identical
 * (seed, time) → identical frame.
 */

import {
  clamp01,
  easeOutCubic,
  lerp,
  rgba,
  smoothstep,
  type FrameCtx,
  type Rng,
} from "./core";
import type { BoundaryViolation } from "@/lib/templates/breakthrough";

export interface Sim {
  /** Step physics forward by dt seconds at the given frame context. */
  step(dt: number, fc: FrameCtx): void;
  /** Draw current state. */
  draw(g: CanvasRenderingContext2D, w: number, h: number, fc: FrameCtx): void;
  /** Whether this sim renders its own emergent "subject" (vs medium-as-subject). */
  readonly hasFigure: boolean;
}

// violation → sim kind
export type SimKind = "shatter" | "pour" | "swarm" | "peel" | "burst";

export function simKindFor(v: BoundaryViolation): SimKind {
  switch (v) {
    case "shatter-step":
    case "climb-out":
      return "shatter";
    case "pour-liquefy":
      return "pour";
    case "swarm":
      return "swarm";
    case "peel":
      return "peel";
    case "fold-to-3d":
    case "reach-through":
    default:
      return "burst";
  }
}

export function makeSim(kind: SimKind, rng: Rng): Sim {
  switch (kind) {
    case "shatter": return new ShatterSim(rng);
    case "pour":    return new PourSim(rng);
    case "swarm":   return new SwarmSim(rng);
    case "peel":    return new PeelSim(rng);
    case "burst":   return new BurstSim(rng);
  }
}

// Centre of the media window (spawn origin).
function windowCenter(fc: FrameCtx) {
  const m = fc.mediaWindow;
  return { cx: m.x + m.width / 2, cy: m.y + m.height / 2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shatter — Voronoi-ish shards exploding from the media window + spark sparks.
// ─────────────────────────────────────────────────────────────────────────────
interface Shard {
  x: number; y: number; vx: number; vy: number;
  rot: number; vrot: number; size: number; spawned: boolean; spawnAt: number;
}
interface Spark { x: number; y: number; vx: number; vy: number; life: number; }

class ShatterSim implements Sim {
  readonly hasFigure = true;
  private shards: Shard[] = [];
  private sparks: Spark[] = [];
  private built = false;

  constructor(private rng: Rng) {}

  private build(fc: FrameCtx) {
    const m = fc.mediaWindow;
    const cols = 7, rows = 9;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = m.x + (c + 0.5) / cols * m.width;
        const y = m.y + (r + 0.5) / rows * m.height;
        const { cx, cy } = windowCenter(fc);
        const dx = x - cx, dy = y - cy;
        const d = Math.hypot(dx, dy) + 1e-4;
        this.shards.push({
          x, y,
          vx: (dx / d) * this.rng.range(0.05, 0.22),
          vy: (dy / d) * this.rng.range(0.05, 0.22) - 0.04,
          rot: this.rng.range(0, Math.PI * 2),
          vrot: this.rng.range(-4, 4),
          size: this.rng.range(0.018, 0.05),
          spawned: false,
          spawnAt: this.rng.range(0, 0.12),
        });
      }
    }
    this.built = true;
  }

  step(dt: number, fc: FrameCtx) {
    if (!this.built) this.build(fc);
    if (fc.breakProgress <= 0) return;
    const g = 0.55; // gravity (normalised/s^2)
    const toward = fc.motion.y; // destination pull
    for (const s of this.shards) {
      if (!s.spawned && fc.breakProgress >= s.spawnAt) s.spawned = true;
      if (!s.spawned) continue;
      s.vy += g * dt;
      s.x += s.vx * dt * 6 * fc.intensity;
      s.y += (s.vy + toward * 0.3) * dt * 6 * fc.intensity;
      s.rot += s.vrot * dt;
    }
    // sparks
    if (fc.breakProgress < 0.5 && this.sparks.length < 240 * fc.intensity) {
      const { cx, cy } = windowCenter(fc);
      for (let i = 0; i < 6; i++) {
        const a = this.rng.range(0, Math.PI * 2);
        const sp = this.rng.range(0.1, 0.6);
        this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
      }
    }
    for (const p of this.sparks) {
      p.vy += g * 0.4 * dt;
      p.x += p.vx * dt * 4;
      p.y += p.vy * dt * 4;
      p.life -= dt * 1.6;
    }
    this.sparks = this.sparks.filter((p) => p.life > 0);
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number, fc: FrameCtx) {
    if (fc.breakProgress <= 0) return;
    // shards
    for (const s of this.shards) {
      if (!s.spawned) continue;
      g.save();
      g.translate(s.x * w, s.y * h);
      g.rotate(s.rot);
      const sz = s.size * w;
      g.beginPath();
      g.moveTo(-sz, -sz * 0.7);
      g.lineTo(sz * 0.9, -sz * 0.3);
      g.lineTo(sz * 0.3, sz);
      g.closePath();
      g.fillStyle = rgba(fc.palette.secondary, 0.9);
      g.fill();
      g.strokeStyle = rgba(fc.palette.accent, 0.9);
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
    // sparks (additive)
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const p of this.sparks) {
      g.fillStyle = rgba(fc.palette.accent, clamp01(p.life));
      g.beginPath();
      g.arc(p.x * w, p.y * h, 2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pour — particle fluid spilling out of the window toward the viewer.
// ─────────────────────────────────────────────────────────────────────────────
interface Drop { x: number; y: number; vx: number; vy: number; r: number; }
class PourSim implements Sim {
  readonly hasFigure = false;
  private drops: Drop[] = [];
  constructor(private rng: Rng) {}

  step(dt: number, fc: FrameCtx) {
    if (fc.breakProgress <= 0) return;
    const m = fc.mediaWindow;
    const rate = Math.floor(14 * fc.intensity * (1 - fc.breakProgress * 0.3));
    for (let i = 0; i < rate && this.drops.length < 520; i++) {
      const x = m.x + this.rng.range(0.1, 0.9) * m.width;
      this.drops.push({
        x,
        y: m.y + m.height * this.rng.range(0.7, 1),
        vx: this.rng.range(-0.05, 0.05),
        vy: this.rng.range(0.05, 0.2),
        r: this.rng.range(0.006, 0.016),
      });
    }
    for (const d of this.drops) {
      d.vy += 0.9 * dt;
      d.x += d.vx * dt * 3;
      d.y += d.vy * dt * 3;
    }
    this.drops = this.drops.filter((d) => d.y < 1.15);
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number, fc: FrameCtx) {
    if (fc.breakProgress <= 0) return;
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const d of this.drops) {
      const grad = g.createRadialGradient(d.x * w, d.y * h, 0, d.x * w, d.y * h, d.r * w * 2.2);
      grad.addColorStop(0, rgba(fc.palette.secondary, 0.85));
      grad.addColorStop(1, rgba(fc.palette.primary, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(d.x * w, d.y * h, d.r * w * 2.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Swarm — boids flocking out of the container toward the destination.
// ─────────────────────────────────────────────────────────────────────────────
interface Boid { x: number; y: number; vx: number; vy: number; }
class SwarmSim implements Sim {
  readonly hasFigure = false;
  private boids: Boid[] = [];
  private built = false;
  constructor(private rng: Rng) {}

  private build(fc: FrameCtx) {
    const m = fc.mediaWindow;
    const n = Math.floor(70 * fc.intensity);
    for (let i = 0; i < n; i++) {
      this.boids.push({
        x: m.x + this.rng.next() * m.width,
        y: m.y + this.rng.next() * m.height,
        vx: this.rng.range(-0.02, 0.02),
        vy: this.rng.range(-0.02, 0.02),
      });
    }
    this.built = true;
  }

  step(dt: number, fc: FrameCtx) {
    if (!this.built) this.build(fc);
    if (fc.breakProgress <= 0) return;
    const tx = 0.5 + fc.motion.x;
    const ty = 0.5 + fc.motion.y;
    for (const b of this.boids) {
      // migrate toward target + mild cohesion to centroid
      b.vx += (tx - b.x) * 0.6 * dt;
      b.vy += (ty - b.y) * 0.6 * dt;
      // jitter (flocking shimmer)
      b.vx += this.rng.range(-0.04, 0.04) * dt;
      b.vy += this.rng.range(-0.04, 0.04) * dt;
      const sp = Math.hypot(b.vx, b.vy);
      const max = 0.5;
      if (sp > max) { b.vx = (b.vx / sp) * max; b.vy = (b.vy / sp) * max; }
      b.x += b.vx * dt * 2.4 * fc.intensity;
      b.y += b.vy * dt * 2.4 * fc.intensity;
    }
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number, fc: FrameCtx) {
    if (fc.breakProgress <= 0) return;
    for (const b of this.boids) {
      g.save();
      g.translate(b.x * w, b.y * h);
      g.rotate(Math.atan2(b.vy, b.vx));
      g.fillStyle = rgba(fc.palette.secondary, 0.92);
      roundRect(g, -7, -5, 16, 10, 5);
      g.fill();
      g.restore();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Peel — the window content lifts and curls off from a corner.
// ─────────────────────────────────────────────────────────────────────────────
class PeelSim implements Sim {
  readonly hasFigure = true;
  private flecks: Spark[] = [];
  constructor(private rng: Rng) {}

  step(dt: number, fc: FrameCtx) {
    if (fc.breakProgress <= 0) return;
    if (this.flecks.length < 80 * fc.intensity && fc.breakProgress < 0.6) {
      const m = fc.mediaWindow;
      for (let i = 0; i < 3; i++) {
        this.flecks.push({
          x: m.x + this.rng.next() * m.width,
          y: m.y + this.rng.range(0, 0.3) * m.height,
          vx: this.rng.range(-0.05, 0.05),
          vy: this.rng.range(0.02, 0.12),
          life: 1,
        });
      }
    }
    for (const f of this.flecks) {
      f.vy += 0.5 * dt;
      f.x += f.vx * dt * 3;
      f.y += f.vy * dt * 3;
      f.life -= dt * 0.7;
    }
    this.flecks = this.flecks.filter((f) => f.life > 0);
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number, fc: FrameCtx) {
    if (fc.breakProgress <= 0) return;
    const m = fc.mediaWindow;
    const peel = easeOutCubic(fc.breakProgress);
    // the curling strip: top-left corner lifts toward bottom-right
    g.save();
    g.globalAlpha = 0.92;
    g.translate(m.x * w, m.y * h);
    const pw = m.width * w, ph = m.height * h;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(pw * peel, ph * peel * 0.2);
    g.quadraticCurveTo(pw * peel * 0.6, ph * peel, pw * peel * 0.2, ph * peel);
    g.lineTo(0, 0);
    g.closePath();
    const grad = g.createLinearGradient(0, 0, pw * peel, ph * peel);
    grad.addColorStop(0, rgba(fc.palette.secondary, 0.95));
    grad.addColorStop(1, rgba(fc.palette.primary, 0.7));
    g.fillStyle = grad;
    g.fill();
    g.restore();
    // flecks
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const f of this.flecks) {
      g.fillStyle = rgba(fc.palette.accent, clamp01(f.life));
      g.beginPath();
      g.arc(f.x * w, f.y * h, 2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Burst — generic radial fracture + expanding ring (fold-to-3d / reach-through).
// ─────────────────────────────────────────────────────────────────────────────
class BurstSim implements Sim {
  readonly hasFigure = true;
  private bits: Shard[] = [];
  private built = false;
  constructor(private rng: Rng) {}

  private build(fc: FrameCtx) {
    const { cx, cy } = windowCenter(fc);
    const n = Math.floor(90 * fc.intensity);
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(0.1, 0.5);
      this.bits.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: this.rng.range(0, Math.PI * 2), vrot: this.rng.range(-5, 5),
        size: this.rng.range(0.01, 0.03), spawned: true, spawnAt: 0,
      });
    }
    this.built = true;
  }

  step(dt: number, fc: FrameCtx) {
    if (!this.built) this.build(fc);
    if (fc.breakProgress <= 0) return;
    for (const b of this.bits) {
      b.x += b.vx * dt * 3 * fc.intensity;
      b.y += b.vy * dt * 3 * fc.intensity;
      b.rot += b.vrot * dt;
    }
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number, fc: FrameCtx) {
    if (fc.breakProgress <= 0) return;
    const { cx, cy } = windowCenter(fc);
    // expanding ring
    const ring = easeOutCubic(fc.breakProgress);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = rgba(fc.palette.accent, (1 - ring) * 0.8);
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx * w, cy * h, ring * 0.6 * w, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    for (const b of this.bits) {
      g.save();
      g.translate(b.x * w, b.y * h);
      g.rotate(b.rot);
      g.fillStyle = rgba(fc.palette.secondary, 0.9);
      const sz = b.size * w;
      g.fillRect(-sz / 2, -sz / 2, sz, sz);
      g.restore();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// shared helpers
// ─────────────────────────────────────────────────────────────────────────────
export function roundRect(
  g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** A stylised emergent figure (head + tapered body) for character violations. */
export function drawFigure(
  g: CanvasRenderingContext2D, w: number, h: number, fc: FrameCtx,
) {
  const reveal = smoothstep((fc.breakProgress - 0.05) / 0.5);
  if (reveal <= 0) return;
  const { cx, cy } = windowCenter(fc);
  const x = (cx + fc.motion.x) * w;
  const y = (cy + fc.motion.y) * h;
  const s = fc.motion.scale * Math.min(w, h) * 0.16;
  g.save();
  g.globalAlpha = reveal * fc.motion.opacity;
  g.translate(x, y);
  g.rotate((fc.motion.rotationDeg * Math.PI) / 180);
  // glow
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, s * 2.4);
  glow.addColorStop(0, rgba(fc.palette.accent, 0.55 * reveal));
  glow.addColorStop(1, rgba(fc.palette.accent, 0));
  g.fillStyle = glow;
  g.fillRect(-s * 2.4, -s * 2.4, s * 4.8, s * 4.8);
  // body
  g.fillStyle = rgba(fc.palette.accent, 0.96);
  g.beginPath();
  g.moveTo(0, -s * 1.1);
  g.quadraticCurveTo(s * 0.7, -s * 0.2, s * 0.5, s * 1.4);
  g.lineTo(-s * 0.5, s * 1.4);
  g.quadraticCurveTo(-s * 0.7, -s * 0.2, 0, -s * 1.1);
  g.closePath();
  g.fill();
  // head
  g.beginPath();
  g.arc(0, -s * 1.35, s * 0.42, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
