import { describe, it, expect } from 'vitest';
import {
  CREDIT_SYSTEM,
  calculateCreditsPerClip,
  calculateCreditsRequired,
  getCreditBreakdown,
  calculateAffordableClips,
  canAffordGeneration,
  creditsToDollars,
  dollarsToCredits,
  formatDuration,
  isExtendedPricing,
} from '@/lib/creditSystem';
import { creditsForScene } from '@/lib/video/engines';

describe('Credit System — Source of Truth', () => {
  describe('CREDIT_SYSTEM constants', () => {
    // The named price aliases MUST equal the engine registry — that is the
    // single source of truth. This test fails if anyone reintroduces a
    // hardcoded price that diverges from src/lib/video/engines.ts.
    it('per-clip prices are derived from the engine registry', () => {
      expect(CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP).toBe(creditsForScene('kling-v3', 10));
      expect(CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP).toBe(creditsForScene('kling-v3', 15));
      expect(CREDIT_SYSTEM.AVATAR_BASE_CREDITS_PER_CLIP).toBe(Math.round(creditsForScene('kling-v3', 10) * 1.5));
      expect(CREDIT_SYSTEM.AVATAR_EXTENDED_CREDITS_PER_CLIP).toBe(Math.round(creditsForScene('kling-v3', 15) * 1.5));
      expect(CREDIT_SYSTEM.SEEDANCE_BASE_CREDITS_PER_CLIP).toBe(creditsForScene('seedance-2', 10));
      expect(CREDIT_SYSTEM.VEO_BASE_CREDITS_PER_CLIP).toBe(creditsForScene('veo-3', 8));
      expect(CREDIT_SYSTEM.SORA_BASE_CREDITS_PER_CLIP).toBe(creditsForScene('sora-2', 8));
    });

    it('has correct Stripe conversion rate', () => {
      expect(CREDIT_SYSTEM.CENTS_PER_CREDIT).toBe(10);
    });
  });

  describe('isExtendedPricing', () => {
    it('returns false for 5s and 10s clips', () => {
      expect(isExtendedPricing(0, 5)).toBe(false);
      expect(isExtendedPricing(0, 10)).toBe(false);
    });

    it('returns true for 15s clips', () => {
      expect(isExtendedPricing(0, 15)).toBe(true);
    });

    it('ignores clip index (no count-based surcharge)', () => {
      expect(isExtendedPricing(0, 10)).toBe(false);
      expect(isExtendedPricing(99, 10)).toBe(false);
    });
  });

  describe('calculateCreditsPerClip', () => {
    // Assert against the registry (single source of truth) rather than
    // hardcoded numbers — these stay correct if prices ever change.
    it('matches the registry for Kling at every duration', () => {
      expect(calculateCreditsPerClip(5, 0, 'kling')).toBe(creditsForScene('kling-v3', 5));
      expect(calculateCreditsPerClip(10, 0, 'kling')).toBe(creditsForScene('kling-v3', 10));
      expect(calculateCreditsPerClip(15, 0, 'kling')).toBe(creditsForScene('kling-v3', 15));
    });

    it('matches the registry for cinema engines at their real durations', () => {
      expect(calculateCreditsPerClip(6, 0, 'veo')).toBe(creditsForScene('veo-3', 6));
      expect(calculateCreditsPerClip(8, 0, 'veo')).toBe(creditsForScene('veo-3', 8));
      expect(calculateCreditsPerClip(12, 0, 'sora')).toBe(creditsForScene('sora-2', 12));
    });

    it('matches the registry for Seedance', () => {
      expect(calculateCreditsPerClip(10, 0, 'seedance')).toBe(creditsForScene('seedance-2', 10));
    });
  });

  describe('calculateCreditsRequired', () => {
    it('is clipCount × per-clip for the chosen engine', () => {
      expect(calculateCreditsRequired(5, 10, 'kling')).toBe(5 * calculateCreditsPerClip(10, 0, 'kling'));
      expect(calculateCreditsRequired(3, 8, 'veo')).toBe(3 * calculateCreditsPerClip(8, 0, 'veo'));
    });

    it('returns 0 for 0 clips', () => {
      expect(calculateCreditsRequired(0, 10)).toBe(0);
    });
  });

  describe('getCreditBreakdown', () => {
    it('totalCredits equals clipCount × the per-clip rate', () => {
      const b = getCreditBreakdown(3, 10, 'kling');
      expect(b.totalCredits).toBe(3 * calculateCreditsPerClip(10, 0, 'kling'));
      expect(b.baseClipCount).toBe(3);
      expect(b.extendedClipCount).toBe(0);
      expect(b.isExtended).toBe(false);
    });

    it('flags clips as extended for >10s durations', () => {
      const b = getCreditBreakdown(3, 15, 'kling');
      expect(b.extendedClipCount).toBe(3);
      expect(b.isExtended).toBe(true);
    });

    it('isVeo flag is correct', () => {
      expect(getCreditBreakdown(1, 8, 'veo').isVeo).toBe(true);
      expect(getCreditBreakdown(1, 10, 'kling').isVeo).toBe(false);
    });
  });

  describe('calculateAffordableClips', () => {
    it('counts whole clips affordable at the default rate', () => {
      const per = calculateCreditsPerClip(10, 0); // default engine
      expect(calculateAffordableClips(per * 3, 10)).toBe(3);
      expect(calculateAffordableClips(per * 3 + (per - 1), 10)).toBe(3); // partial doesn't count
    });

    it('returns 0 when credits are below one clip', () => {
      const per = calculateCreditsPerClip(10, 0);
      expect(calculateAffordableClips(Math.max(0, per - 1), 10)).toBe(0);
    });
  });

  describe('canAffordGeneration', () => {
    it('required equals calculateCreditsRequired; shortfall is exact', () => {
      const required = calculateCreditsRequired(5, 10); // same default engine
      expect(canAffordGeneration(required, 5, 10)).toEqual({ canAfford: true, required, shortfall: 0 });
      const r = canAffordGeneration(required - 50, 5, 10);
      expect(r.canAfford).toBe(false);
      expect(r.required).toBe(required);
      expect(r.shortfall).toBe(50);
    });
  });

  describe('creditsToDollars / dollarsToCredits', () => {
    it('converts credits to dollars correctly', () => {
      expect(creditsToDollars(100)).toBe(10); // 100 * 10 cents / 100
    });

    it('converts dollars to credits correctly', () => {
      expect(dollarsToCredits(10)).toBe(100);
    });

    it('round-trips', () => {
      expect(dollarsToCredits(creditsToDollars(50))).toBe(50);
    });
  });

  describe('formatDuration', () => {
    it('formats seconds only', () => {
      expect(formatDuration(30)).toBe('30s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(90)).toBe('1m 30s');
    });

    it('formats exact minutes', () => {
      expect(formatDuration(60)).toBe('1m');
    });

    it('formats zero', () => {
      expect(formatDuration(0)).toBe('0s');
    });
  });
});
