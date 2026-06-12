/**
 * Celebration moments — confetti + sound for milestones the audit
 * called out as missing:
 *   - first publish
 *   - first credit purchase
 *   - first $10 earned
 *   - 100th follower
 *
 * Each fires once per (userId, milestone) — durable via localStorage
 * so a hard refresh doesn't re-celebrate. Honors prefers-reduced-motion
 * (skip the confetti; still play sound if sound is on).
 */
import confetti from "canvas-confetti";
import { sfx } from "./sound";

export type Milestone =
  | "first-publish"
  | "first-credit-purchase"
  | "first-payout"
  | "follower-100"
  | "tip-received-first";

const KEY = (uid: string, m: Milestone) => `sb.celebrated.${m}.${uid}`;

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}

const PALETTES: Record<Milestone, string[]> = {
  "first-publish":      ["#0A84FF", "#7B61FF", "#FF61A6", "#FFCB6B"],
  "first-credit-purchase": ["#FFCB6B", "#FFB020", "#FF6A00", "#0A84FF"],
  "first-payout":       ["#0A84FF", "#10B981", "#A7F3D0", "#FFCB6B"],
  "follower-100":       ["#FF61A6", "#A78BFA", "#0A84FF", "#FFCB6B"],
  "tip-received-first": ["#FFCB6B", "#FFB020", "#0A84FF", "#FF61A6"],
};

/**
 * Fire the celebration if this user hasn't seen it before.
 * Returns true if the milestone fired now, false if already celebrated.
 */
export function celebrate(milestone: Milestone, userId: string | null | undefined): boolean {
  if (!userId) return false;
  const key = KEY(userId, milestone);
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, new Date().toISOString());
  } catch { /* localStorage may be blocked — fire anyway */ }

  const palette = PALETTES[milestone];

  if (!reducedMotion()) {
    // Two-burst cannon from each side of the screen.
    const fire = (origin: { x: number; y: number }) => {
      confetti({
        particleCount: 80,
        spread: 70,
        startVelocity: 45,
        ticks: 240,
        scalar: 1.1,
        gravity: 0.9,
        decay: 0.92,
        origin,
        colors: palette,
      });
    };
    fire({ x: 0.1, y: 0.6 });
    setTimeout(() => fire({ x: 0.9, y: 0.6 }), 120);
    setTimeout(() => fire({ x: 0.5, y: 0.7 }), 240);
  }

  sfx.play("render-done", 0.7);
  return true;
}

/** Force-replay a milestone (for debug / settings "show me again"). */
export function replayCelebration(milestone: Milestone, userId: string) {
  try { localStorage.removeItem(KEY(userId, milestone)); } catch { /* noop */ }
  celebrate(milestone, userId);
}
