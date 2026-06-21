/**
 * Engine registry parity — frontend `src/lib/video/engines.ts` MUST
 * stay in sync with the backend `supabase/functions/_shared/engines.ts`.
 *
 * Drift here is a billing-correctness bug: the frontend quotes the
 * user one price, the backend charges another. The Wan-25 engine had
 * exactly this — UI advertised "free", backend deducted 10–20 credits
 * per render. Test pins the contract so the next drift fails CI.
 *
 * What's checked across both files:
 *   1. Same set of EngineIds.
 *   2. Per engine: tier, provider, durations, maxDuration, capability
 *      flags, surcharge values, entitlement gating.
 *   3. baseCreditsFor agrees at every documented duration (cross-multiply
 *      both sides — different table data is the bug we just fixed).
 *
 * The frontend has additional pipeline metadata (pipelineId,
 * pipelineFunction, qualityProfiles, ...) that the backend doesn't
 * carry. Those fields are skipped — drift in pipeline routing is
 * caught by the orphan detection test, not this one.
 */

import { describe, it, expect } from "vitest";
import { ENGINES as FE, type EngineSpec } from "@/lib/video/engines";
import {
  ENGINES as BE,
  type EngineSpec as BackendEngineSpec,
} from "../../../supabase/functions/_shared/engines.ts";

describe("FE/BE engine registry parity", () => {
  it("both registries declare the same set of engine ids", () => {
    expect(Object.keys(FE).sort()).toEqual(Object.keys(BE).sort());
  });

  for (const id of Object.keys(FE)) {
    const fe = FE[id as keyof typeof FE] as EngineSpec;
    const be = BE[id as keyof typeof BE] as BackendEngineSpec;

    describe(`${id}`, () => {
      it("provider matches", () => {
        expect(be.provider).toBe(fe.provider);
      });
      it("tier matches", () => {
        expect(be.tier).toBe(fe.tier);
      });
      it("durations table matches", () => {
        expect([...be.durations].sort((a, b) => a - b)).toEqual(
          [...fe.durations].sort((a, b) => a - b),
        );
      });
      it("maxDuration matches", () => {
        expect(be.maxDuration).toBe(fe.maxDuration);
      });
      it("capability flags match (image input / audio / avatar)", () => {
        expect(be.supportsImageInput).toBe(fe.supportsImageInput);
        expect(be.supportsAudio).toBe(fe.supportsAudio);
        expect(be.supportsAvatar).toBe(fe.supportsAvatar);
      });
      it("surcharge values match (upscale4k + fps60)", () => {
        expect(be.upscale4kCredits).toBe(fe.upscale4kCredits);
        expect(be.fps60Credits).toBe(fe.fps60Credits);
      });
      it("entitlement gating matches", () => {
        expect(be.requiresEntitlement).toBe(fe.requiresEntitlement);
      });
      it("baseCreditsFor agrees at every documented duration", () => {
        for (const d of fe.durations) {
          const feCost = fe.baseCreditsFor(d);
          const beCost = be.baseCreditsFor(d);
          expect(
            beCost,
            `${id}@${d}s: FE quotes ${feCost} credits but BE charges ${beCost}`,
          ).toBe(feCost);
        }
      });
    });
  }
});
