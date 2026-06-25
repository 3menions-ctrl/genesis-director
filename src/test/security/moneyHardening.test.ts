/**
 * Money-system hardening unit tests.
 *
 * Covers the PURE logic introduced by the lower-severity money/DB fixes:
 *   - constant-time signature comparison (L9, supabase/functions/_shared/stripe.ts)
 *   - capped per-clip refund logic (M1, supabase/functions/delete-clip/index.ts)
 *
 * The production helpers live in Deno edge-function files (https:// imports),
 * which cannot be loaded under vitest/node. We therefore replicate the exact
 * predicates here and assert their behavior. The replicas must stay byte-for-byte
 * equivalent to the shipped helpers.
 */
import { describe, it, expect } from 'vitest';

// --- replica of timingSafeEqual() from _shared/stripe.ts ---
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --- replica of computeCappedRefund() from delete-clip/index.ts ---
function computeCappedRefund(params: {
  originalCharge: number;
  totalClips: number;
  alreadyRefunded: number;
}): number {
  const { originalCharge, totalClips, alreadyRefunded } = params;
  if (!(originalCharge > 0) || !(totalClips > 0)) return 0;
  const perClipShare = Math.round(originalCharge / totalClips);
  const remaining = Math.max(0, originalCharge - Math.max(0, alreadyRefunded));
  return Math.max(0, Math.min(perClipShare, remaining));
}

describe('timingSafeEqual (constant-time compare)', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
    expect(timingSafeEqual('', '')).toBe(true);
    const hex = 'deadbeefcafe0000ffff';
    expect(timingSafeEqual(hex, hex)).toBe(true);
  });

  it('returns false for equal-length but different strings', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
    expect(timingSafeEqual('aaaa', 'aaab')).toBe(false);
  });

  it('returns false for different-length strings (length-checked)', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('longer-string', 'short')).toBe(false);
    expect(timingSafeEqual('a', '')).toBe(false);
  });

  it('is case- and char-sensitive', () => {
    expect(timingSafeEqual('Secret', 'secret')).toBe(false);
  });
});

describe('computeCappedRefund (per-clip refund cap)', () => {
  it('refunds the per-clip share when nothing has been refunded yet', () => {
    expect(computeCappedRefund({ originalCharge: 100, totalClips: 4, alreadyRefunded: 0 })).toBe(25);
  });

  it('rounds the per-clip share', () => {
    // 100 / 3 = 33.33 -> 33
    expect(computeCappedRefund({ originalCharge: 100, totalClips: 3, alreadyRefunded: 0 })).toBe(33);
  });

  it('clamps so cumulative refunds never exceed the original charge', () => {
    // share would be 25, but only 10 remains under the cap
    expect(computeCappedRefund({ originalCharge: 100, totalClips: 4, alreadyRefunded: 90 })).toBe(10);
  });

  it('returns 0 once the original charge is fully refunded', () => {
    expect(computeCappedRefund({ originalCharge: 100, totalClips: 4, alreadyRefunded: 100 })).toBe(0);
    expect(computeCappedRefund({ originalCharge: 100, totalClips: 4, alreadyRefunded: 150 })).toBe(0);
  });

  it('never lets a sequence of per-clip refunds exceed the original charge', () => {
    const originalCharge = 100;
    // Simulate deleting clips one-by-one while the denominator shrinks (3,2,1...).
    // Even with a shrinking denominator, the cap guarantees the sum stays <= charge.
    let alreadyRefunded = 0;
    const denominators = [3, 2, 1, 1, 1];
    for (const totalClips of denominators) {
      const refund = computeCappedRefund({ originalCharge, totalClips, alreadyRefunded });
      alreadyRefunded += refund;
      expect(alreadyRefunded).toBeLessThanOrEqual(originalCharge);
    }
  });

  it('returns 0 for non-positive charge or clip count', () => {
    expect(computeCappedRefund({ originalCharge: 0, totalClips: 4, alreadyRefunded: 0 })).toBe(0);
    expect(computeCappedRefund({ originalCharge: 100, totalClips: 0, alreadyRefunded: 0 })).toBe(0);
    expect(computeCappedRefund({ originalCharge: -50, totalClips: 4, alreadyRefunded: 0 })).toBe(0);
  });
});
