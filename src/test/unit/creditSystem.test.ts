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

describe('Credit System — Source of Truth', () => {
  describe('CREDIT_SYSTEM constants', () => {
    it('has correct base pricing', () => {
      expect(CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP).toBe(50);
      expect(CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP).toBe(75);
      expect(CREDIT_SYSTEM.AVATAR_BASE_CREDITS_PER_CLIP).toBe(60);
      expect(CREDIT_SYSTEM.AVATAR_EXTENDED_CREDITS_PER_CLIP).toBe(90);
    });

    it('has correct Stripe conversion rate', () => {
      expect(CREDIT_SYSTEM.CENTS_PER_CREDIT).toBe(10);
    });

    it('cost breakdown sums correctly for standard', () => {
      const { PRE_PRODUCTION, PRODUCTION, QUALITY_ASSURANCE, TOTAL } = CREDIT_SYSTEM.COST_PER_CLIP;
      expect(PRE_PRODUCTION + PRODUCTION + QUALITY_ASSURANCE).toBe(TOTAL);
      expect(TOTAL).toBe(50);
    });

    it('cost breakdown sums correctly for extended', () => {
      const { PRE_PRODUCTION, PRODUCTION, QUALITY_ASSURANCE, TOTAL } = CREDIT_SYSTEM.COST_PER_CLIP_EXTENDED;
      expect(PRE_PRODUCTION + PRODUCTION + QUALITY_ASSURANCE).toBe(TOTAL);
      expect(TOTAL).toBe(75);
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
    it('returns 60 for 10s avatar (kling) clip', () => {
      expect(calculateCreditsPerClip(10, 0, 'kling')).toBe(60);
    });

    it('returns 90 for 15s avatar (kling) clip', () => {
      expect(calculateCreditsPerClip(15, 0, 'kling')).toBe(90);
    });

    it('returns 50 for 10s standard (veo) clip', () => {
      expect(calculateCreditsPerClip(10, 0, 'veo')).toBe(50);
    });

    it('returns 75 for 15s standard (veo) clip', () => {
      expect(calculateCreditsPerClip(15, 0, 'veo')).toBe(75);
    });

    it('returns 60 for 5s avatar clip (still base rate)', () => {
      expect(calculateCreditsPerClip(5, 0, 'kling')).toBe(60);
    });

    it('defaults to kling engine', () => {
      expect(calculateCreditsPerClip(10)).toBe(60);
    });
  });

  describe('calculateCreditsRequired', () => {
    it('calculates correctly for 5 clips at 10s (kling)', () => {
      expect(calculateCreditsRequired(5, 10, 'kling')).toBe(300);
    });

    it('calculates correctly for 5 clips at 15s (kling)', () => {
      expect(calculateCreditsRequired(5, 15, 'kling')).toBe(450);
    });

    it('calculates correctly for 3 clips at 10s (veo)', () => {
      expect(calculateCreditsRequired(3, 10, 'veo')).toBe(150);
    });

    it('returns 0 for 0 clips', () => {
      expect(calculateCreditsRequired(0, 10)).toBe(0);
    });
  });

  describe('getCreditBreakdown', () => {
    it('all clips are base for 10s duration', () => {
      const breakdown = getCreditBreakdown(3, 10, 'kling');
      expect(breakdown.baseClipCount).toBe(3);
      expect(breakdown.extendedClipCount).toBe(0);
      expect(breakdown.totalCredits).toBe(180);
      expect(breakdown.isExtended).toBe(false);
    });

    it('all clips are extended for 15s duration', () => {
      const breakdown = getCreditBreakdown(3, 15, 'veo');
      expect(breakdown.baseClipCount).toBe(0);
      expect(breakdown.extendedClipCount).toBe(3);
      expect(breakdown.totalCredits).toBe(225);
      expect(breakdown.isExtended).toBe(true);
    });

    it('isVeo flag is correct', () => {
      expect(getCreditBreakdown(1, 10, 'veo').isVeo).toBe(true);
      expect(getCreditBreakdown(1, 10, 'kling').isVeo).toBe(false);
    });
  });

  describe('calculateAffordableClips', () => {
    it('can afford exactly N clips', () => {
      // 60 credits per clip at 10s (kling default)
      expect(calculateAffordableClips(180, 10)).toBe(3);
    });

    it('returns 0 when credits insufficient for 1 clip', () => {
      expect(calculateAffordableClips(10, 10)).toBe(0);
    });

    it('partial remainder does not count', () => {
      expect(calculateAffordableClips(100, 10)).toBe(1); // 60 + 40 remaining
    });
  });

  describe('canAffordGeneration', () => {
    it('returns canAfford true when sufficient', () => {
      const result = canAffordGeneration(500, 5, 10);
      expect(result.canAfford).toBe(true);
      expect(result.shortfall).toBe(0);
    });

    it('returns canAfford false with shortfall', () => {
      const result = canAffordGeneration(100, 5, 10);
      expect(result.canAfford).toBe(false);
      expect(result.required).toBe(300);
      expect(result.shortfall).toBe(200);
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
