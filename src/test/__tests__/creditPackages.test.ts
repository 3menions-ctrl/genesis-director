import { describe, it, expect } from "vitest";
import { CREDIT_PACKAGES, approxClips } from "@/lib/payments/creditPackages";

/**
 * Guards the front-end credit packages against accidental drift. The
 * `id` and `credits` here MUST stay in lock-step with the server map in
 * supabase/functions/create-credit-checkout/index.ts (CREDIT_PACKAGES),
 * because the webhook grants `metadata.credits` based on the package the
 * server resolved. If you change a pack here, change it there too.
 */
const EXPECTED = {
  // personal-tier packs
  mini: 90,
  starter: 370,
  growth: 1000,
  agency: 2500,
  // business-tier packs
  studio: 5500,
  brand: 12000,
  "agency+": 32000,
} as const;

describe("credit packages", () => {
  it("exposes exactly the server-backed packs with matching credits", () => {
    const byId = Object.fromEntries(CREDIT_PACKAGES.map((p) => [p.id, p.credits]));
    expect(byId).toEqual(EXPECTED);
  });

  it("has positive USD prices for every pack", () => {
    for (const p of CREDIT_PACKAGES) {
      expect(p.price).toBeGreaterThan(0);
    }
  });

  it("marks exactly one pack as popular", () => {
    expect(CREDIT_PACKAGES.filter((p) => p.popular)).toHaveLength(1);
  });

  it("approxClips is ~1 clip per 10 credits", () => {
    expect(approxClips(1000)).toBe(100);
    expect(approxClips(90)).toBe(9);
  });
});
