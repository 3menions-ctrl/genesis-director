/**
 * Pipeline unification — GOLDEN PLAN harness.
 *
 * For a fixed input per product type, we snapshot the fully-resolved execution
 * PLAN (mode, handler, engine, dispatch + audio strategy, operation, execution
 * lane, per-shot operations). This is the regression gate for the remaining
 * unification folds: as avatar-direct / stylize / motion / editor / ad are moved
 * into the unified clip-loop, the resolved plan for each product type MUST stay
 * identical (or the golden is updated deliberately in the same PR). It proves a
 * fold changes only HOW a type runs, never WHAT runs.
 *
 * NOTE: this is a DECISION-level golden (pure, no credits). Pixel/quality
 * ("best-in-class output") validation still needs a human pass on real renders.
 */

import { describe, it, expect } from "vitest";
import {
  buildProductionRequest,
  resolvePlan,
  type ProductionPlan,
} from "../../../supabase/functions/_shared/production-request";

type Fixture = { name: string; input: Parameters<typeof buildProductionRequest>[0]; golden: ProductionPlan };

const FIXTURES: Fixture[] = [
  {
    name: "film · text · kling",
    input: { mode: "text-to-video", videoEngine: "kling", isAvatarMode: false },
    golden: { mode: "text", handlerKey: "handleCinematicMode", engine: "kling", dispatchStrategy: "sequential", audioStrategy: "native", operation: "t2v", executionLane: "clip-loop", effectFn: null, scriptGenerate: true, shotOperations: ["t2v", "t2v", "t2v"] },
  },
  {
    name: "film · image · kling",
    input: { mode: "image-to-video", videoEngine: "kling", isAvatarMode: false },
    golden: { mode: "image", handlerKey: "handleCinematicMode", engine: "kling", dispatchStrategy: "sequential", audioStrategy: "native", operation: "i2v", executionLane: "clip-loop", effectFn: null, scriptGenerate: true, shotOperations: ["i2v", "t2v", "t2v"] },
  },
  {
    name: "film · b-roll · kling",
    input: { mode: "b-roll", videoEngine: "kling", isAvatarMode: false },
    golden: { mode: "broll", handlerKey: "handleCinematicMode", engine: "kling", dispatchStrategy: "sequential", audioStrategy: "native", operation: "t2v", executionLane: "clip-loop", effectFn: null, scriptGenerate: true, shotOperations: ["t2v", "t2v", "t2v"] },
  },
  {
    name: "film · text · seedance (parallel + post-mux)",
    input: { mode: "text-to-video", videoEngine: "seedance", isAvatarMode: false },
    golden: { mode: "text", handlerKey: "handleCinematicMode", engine: "seedance", dispatchStrategy: "parallel", audioStrategy: "post-mux", operation: "t2v", executionLane: "clip-loop", effectFn: null, scriptGenerate: true, shotOperations: ["t2v", "t2v", "t2v"] },
  },
  {
    name: "avatar · cinematic · seedance (overlay)",
    input: { mode: "avatar", videoEngine: "seedance", isAvatarMode: true },
    golden: { mode: "avatar", handlerKey: "handleAvatarCinematicMode", engine: "seedance", dispatchStrategy: "parallel", audioStrategy: "overlay", operation: "avatar", executionLane: "clip-loop", effectFn: null, scriptGenerate: true, shotOperations: ["avatar", "avatar", "avatar"] },
  },
  {
    name: "avatar · direct · kling",
    input: { mode: "avatar", videoEngine: "kling", isAvatarMode: true },
    golden: { mode: "avatar", handlerKey: "handleAvatarDirectMode", engine: "kling", dispatchStrategy: "sequential", audioStrategy: "native", operation: "avatar", executionLane: "single-pass-effect", effectFn: "generate-avatar-direct", scriptGenerate: false, shotOperations: ["avatar", "avatar", "avatar"] },
  },
  {
    name: "effect · stylize (video2video)",
    input: { mode: "video-to-video", isAvatarMode: false },
    golden: { mode: "video2video", handlerKey: "handleStyleTransferMode", engine: "kling", dispatchStrategy: "sequential", audioStrategy: "native", operation: "stylize", executionLane: "single-pass-effect", effectFn: "stylize-video", scriptGenerate: false, shotOperations: ["t2v", "t2v", "t2v"] },
  },
  {
    name: "effect · motion-transfer",
    input: { mode: "motion-transfer", isAvatarMode: false },
    golden: { mode: "motion-transfer", handlerKey: "handleMotionTransferMode", engine: "kling", dispatchStrategy: "sequential", audioStrategy: "native", operation: "pose-transfer", executionLane: "single-pass-effect", effectFn: "motion-transfer", scriptGenerate: false, shotOperations: ["t2v", "t2v", "t2v"] },
  },
  {
    name: "breakout · text (forces seedance parallel post-mux)",
    input: { mode: "text-to-video", isBreakout: true, isAvatarMode: false },
    golden: { mode: "text", handlerKey: "handleCinematicMode", engine: "seedance", dispatchStrategy: "parallel", audioStrategy: "post-mux", operation: "t2v", executionLane: "clip-loop", effectFn: null, scriptGenerate: true, shotOperations: ["t2v", "t2v", "t2v"] },
  },
];

describe("pipeline golden plans — one plan per product type", () => {
  for (const fx of FIXTURES) {
    it(fx.name, () => {
      const plan = resolvePlan(buildProductionRequest(fx.input));
      expect(plan).toEqual(fx.golden);
    });
  }

  it("every product type is represented (all handlers + both lanes + all engines-of-interest)", () => {
    const plans = FIXTURES.map((f) => resolvePlan(buildProductionRequest(f.input)));
    expect(new Set(plans.map((p) => p.handlerKey)).size).toBe(5);
    expect(new Set(plans.map((p) => p.executionLane))).toEqual(new Set(["clip-loop", "single-pass-effect"]));
    expect(new Set(plans.map((p) => p.dispatchStrategy))).toEqual(new Set(["sequential", "parallel"]));
    expect(new Set(plans.map((p) => p.audioStrategy))).toEqual(new Set(["native", "post-mux", "overlay"]));
  });
});
