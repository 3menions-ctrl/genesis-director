import { describe, it, expect } from "vitest";
import {
  makeRng,
  sampleTrack,
  clamp01,
  smoothstep,
  BreakthroughEngine,
  simKindFor,
} from "..";
import { getBreakthroughTemplate } from "@/lib/templates/breakthrough";
import type { TemplateDefinition } from "@/lib/templates/breakthrough";
import type { KeyframeBlueprint } from "@/lib/templates/blueprint";

const social = () => getBreakthroughTemplate("bt-social-feed-breakout") as TemplateDefinition;

/** A recording 2D-context mock — jsdom has no canvas. Records every method
 *  call name so two deterministic renders can be compared op-for-op. */
function mockCtx() {
  const ops: string[] = [];
  const grad = { addColorStop: () => {} };
  return new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (prop === "createRadialGradient" || prop === "createLinearGradient") return () => grad;
      if (prop === "__ops") return ops;
      return (...args: unknown[]) => {
        // record numeric arg values so divergent geometry is observable
        ops.push(`${prop}:${args.map((a) => (typeof a === "number" ? a.toFixed(3) : typeof a)).join(",")}`);
      };
    },
    set() { return true; },
  }) as unknown as CanvasRenderingContext2D & { __ops: string[] };
}

describe("makeRng (deterministic PRNG)", () => {
  it("is reproducible for a seed", () => {
    const a = makeRng(42), b = makeRng(42);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it("differs across seeds", () => {
    expect(makeRng(1).next()).not.toEqual(makeRng(2).next());
  });
  it("range stays within bounds", () => {
    const r = makeRng(7);
    for (let i = 0; i < 50; i++) { const v = r.range(-3, 9); expect(v).toBeGreaterThanOrEqual(-3); expect(v).toBeLessThanOrEqual(9); }
  });
});

describe("sampleTrack", () => {
  const track: KeyframeBlueprint[] = [
    { property: "scale", at: 0, value: 1 },
    { property: "scale", at: 1, value: 2 },
  ];
  it("clamps before/after the ends", () => {
    expect(sampleTrack(track, "scale", -1, 0)).toBe(1);
    expect(sampleTrack(track, "scale", 5, 0)).toBe(2);
  });
  it("interpolates within", () => {
    expect(sampleTrack(track, "scale", 0.5, 0)).toBeCloseTo(1.5);
  });
  it("returns fallback when the property is absent", () => {
    expect(sampleTrack(track, "rotation", 0.5, 99)).toBe(99);
  });
});

describe("math helpers", () => {
  it("clamp01 + smoothstep", () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
  });
});

describe("simKindFor (violation → simulator)", () => {
  it("maps every violation", () => {
    expect(simKindFor("shatter-step")).toBe("shatter");
    expect(simKindFor("climb-out")).toBe("shatter");
    expect(simKindFor("pour-liquefy")).toBe("pour");
    expect(simKindFor("swarm")).toBe("swarm");
    expect(simKindFor("peel")).toBe("peel");
    expect(simKindFor("fold-to-3d")).toBe("burst");
    expect(simKindFor("reach-through")).toBe("burst");
  });
});

describe("BreakthroughEngine", () => {
  it("exposes duration + break beat from the resolved scene", () => {
    const e = new BreakthroughEngine(social());
    expect(e.durationSec).toBe(12);
    expect(e.breakBeatSec).toBe(6);
  });

  it("frameCtx phases progress correctly", () => {
    const e = new BreakthroughEngine(social());
    expect(e.frameCtx(0).breakProgress).toBe(0);
    expect(e.frameCtx(0).maskReveal).toBe(0);
    expect(e.frameCtx(12).breakProgress).toBeCloseTo(1);
    expect(e.frameCtx(6).maskReveal).toBeCloseTo(0.5); // mask opens 5.5–6.5
    expect(e.frameCtx(6.5).maskReveal).toBe(1);
  });

  it("samples destination motion (toward-viewer scales up)", () => {
    const e = new BreakthroughEngine(social());
    const early = e.frameCtx(6).motion.scale;
    const late = e.frameCtx(12).motion.scale;
    expect(late).toBeGreaterThan(early);
  });

  it("setIntensity clamps to [0.3, 2]", () => {
    const e = new BreakthroughEngine(social());
    e.setIntensity(99); expect(e.frameCtx(6).intensity).toBe(2);
    e.setIntensity(0); expect(e.frameCtx(6).intensity).toBe(0.3);
  });

  it("setBreakBeat re-syncs the break beat (audio-cue demo)", () => {
    const e = new BreakthroughEngine(social());
    e.setBreakBeat(9);
    expect(e.breakBeatSec).toBe(9);
    expect(e.frameCtx(9).maskReveal).toBeCloseTo(0.5);
  });

  it("renders the full pipeline without a real canvas", () => {
    const e = new BreakthroughEngine(social());
    e.advanceTo(8);
    const ctx = mockCtx();
    expect(() => e.render(ctx, 1080, 1920, 8)).not.toThrow();
    expect((ctx as unknown as { __ops: string[] }).__ops.length).toBeGreaterThan(10);
  });

  it("is DETERMINISTIC — same seed + time → identical draw ops", () => {
    const e1 = new BreakthroughEngine(social(), { seed: 99 });
    const e2 = new BreakthroughEngine(social(), { seed: 99 });
    e1.advanceTo(8); e2.advanceTo(8);
    const c1 = mockCtx(), c2 = mockCtx();
    e1.render(c1, 800, 1422, 8);
    e2.render(c2, 800, 1422, 8);
    expect((c1 as unknown as { __ops: string[] }).__ops)
      .toEqual((c2 as unknown as { __ops: string[] }).__ops);
  });

  it("different seeds diverge", () => {
    const e1 = new BreakthroughEngine(social(), { seed: 1 });
    const e2 = new BreakthroughEngine(social(), { seed: 2 });
    e1.advanceTo(8); e2.advanceTo(8);
    const c1 = mockCtx(), c2 = mockCtx();
    e1.render(c1, 800, 1422, 8);
    e2.render(c2, 800, 1422, 8);
    // op COUNT may match but the shard transforms differ → ops arrays differ
    expect((c1 as unknown as { __ops: string[] }).__ops)
      .not.toEqual((c2 as unknown as { __ops: string[] }).__ops);
  });

  it("every shipped template builds + advances + renders", () => {
    for (const id of [
      "bt-social-feed-breakout", "bt-billboard-walkout", "bt-aquarium-pour-out",
      "bt-cctv-grid-walk-across", "bt-group-chat-swarm", "bt-wanted-poster-peel",
      "bt-home-screen-fold-out",
    ]) {
      const def = getBreakthroughTemplate(id) as TemplateDefinition;
      const e = new BreakthroughEngine(def);
      e.advanceTo(e.durationSec);
      expect(() => e.render(mockCtx(), 720, 1280, e.durationSec)).not.toThrow();
    }
  });
});
