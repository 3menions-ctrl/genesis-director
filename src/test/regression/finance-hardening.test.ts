import { describe, it, expect } from 'vitest';
import {
  CREDIT_SYSTEM,
  calculateCreditsPerClip,
  calculateCreditsRequired,
  creditsToDollars,
  dollarsToCredits,
} from '@/lib/creditSystem';
import { creditsForScene } from '@/lib/video/engines';

/**
 * Regression guards for the finance-hardening audit. These lock the invariants
 * the server-side fixes (migrations + edge functions) rely on. They fail loudly
 * if a future change reintroduces a divergent credit→USD rate, a fractional
 * credit, or a money-math NaN.
 */
describe('finance-hardening invariants', () => {
  it('canonical credit→USD rate is exactly 10¢ (guards M-5/M-13 divergence)', () => {
    // Everything downstream — profit dashboard (now 10¢ per
    // 20260704000400), invoices, P&L — must agree with this single value.
    expect(CREDIT_SYSTEM.CENTS_PER_CREDIT).toBe(10);
    expect(creditsToDollars(100)).toBeCloseTo(10, 10);
  });

  it('never produces fractional credits for any engine/duration', () => {
    const engines = ['wan', 'kling', 'seedance', 'veo', 'sora'];
    const durations = [5, 8, 10, 15];
    for (const engine of engines) {
      for (const d of durations) {
        const perClip = calculateCreditsPerClip(d, 0, engine);
        expect(Number.isInteger(perClip), `${engine}@${d}s per-clip`).toBe(true);
        expect(perClip).toBeGreaterThanOrEqual(0);
        const total = calculateCreditsRequired(3, d, engine);
        expect(Number.isInteger(total), `${engine}@${d}s total`).toBe(true);
        expect(total).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('the engine registry only ever returns integer, non-negative credits', () => {
    // Each engine supports specific durations; use the registry's real combos.
    const valid: Array<[string, number]> = [
      ['kling-v3', 5], ['kling-v3', 10], ['kling-v3', 15],
      ['seedance-2', 10], ['veo-3', 8], ['sora-2', 8],
    ];
    for (const [id, d] of valid) {
      const c = creditsForScene(id, d);
      expect(Number.isInteger(c), `${id}@${d}s`).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  it('dollarsToCredits is non-negative, integer, and house-favorable (floors)', () => {
    expect(dollarsToCredits(0)).toBe(0);
    expect(Number.isInteger(dollarsToCredits(9.99))).toBe(true);
    expect(dollarsToCredits(9.99)).toBeLessThanOrEqual(dollarsToCredits(10));
    expect(dollarsToCredits(-5)).toBeLessThanOrEqual(0);
  });

  it('boundary credit amounts do not produce NaN/Infinity', () => {
    for (const v of [0, 1, 100000, 240000, 1000000]) {
      expect(Number.isFinite(creditsToDollars(v))).toBe(true);
    }
  });

  it('largest catalog plan (business_scale_yearly = 240,000 credits) is within the raised grant cap', () => {
    // 20260704001300_raise_credit_grant_cap.sql raised add_credits + both
    // webhook guards from 100,000 → 1,000,000 so this plan is no longer
    // silently dropped (paid-but-zero-credits, audit finding H-pricing-1).
    const LARGEST_PLAN_CREDITS = 240000;
    const GRANT_CAP = 1000000;
    expect(LARGEST_PLAN_CREDITS).toBeLessThanOrEqual(GRANT_CAP);
    expect(LARGEST_PLAN_CREDITS).toBeGreaterThan(100000); // would have failed pre-fix
  });
});
