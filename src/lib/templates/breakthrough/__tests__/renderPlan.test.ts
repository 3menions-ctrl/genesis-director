import { describe, it, expect } from "vitest";
import { compileRenderPlan, validateRenderPlan } from "../renderPlan";
import { getAllBreakthroughTemplates, getBreakthroughTemplate } from "../registry";
import type { TemplateDefinition } from "../schema";

const def = () => getBreakthroughTemplate("bt-social-feed-breakout") as TemplateDefinition;

describe("compileRenderPlan", () => {
  it("emits a step for every layer mapped to a REAL edge function", () => {
    const plan = compileRenderPlan(def());
    const fns = new Set(plan.steps.map((s) => s.edgeFunction));
    // the actual functions discovered in supabase/functions
    expect(fns).toContain("generate-scene-images"); // FLUX chrome + start frames
    expect(fns).toContain("generate-video"); // image-to-video engines
    expect(fns).toContain("seamless-stitcher"); // FFmpeg composite
  });

  it("produces a valid dependency DAG ending in the composite", () => {
    const plan = compileRenderPlan(def());
    expect(validateRenderPlan(plan)).toEqual([]);
    expect(plan.steps.at(-1)?.op).toBe("composite");
  });

  it("composite depends on all four layer outputs", () => {
    const plan = compileRenderPlan(def());
    const composite = plan.steps.find((s) => s.op === "composite")!;
    const layerSources = (composite.input.layers as { source: string }[]).map((l) => l.source);
    expect(layerSources).toEqual(["@chrome", "@innerVideo", "@subjectAlpha", "@aftermath"]);
  });

  it("routes the breakthrough subject through a matting step", () => {
    const plan = compileRenderPlan(def());
    const matte = plan.steps.find((s) => s.op === "matte-video")!;
    expect(matte).toBeTruthy();
    expect(matte.dependsOn).toContain("bt-social-feed-breakout:subject-video");
    expect(matte.produces).toBe("@subjectAlpha");
  });

  it("generates the chroma subject on a solid key colour when matting=chromakey", () => {
    const plan = compileRenderPlan(def());
    const subjStart = plan.steps.find((s) => s.id.endsWith(":subject-start"))!;
    expect(String(subjStart.input.prompt)).toMatch(/chroma|green/i);
    expect(plan.strategy.matting).toBe("chromakey");
  });

  it("respects per-role engine overrides from the config", () => {
    const plan = compileRenderPlan(def());
    // social-feed sets subject engine to runway-gen4
    expect(plan.strategy.engines.subject).toBe("runway-gen4");
    const subjVid = plan.steps.find((s) => s.id.endsWith(":subject-video"))!;
    expect(subjVid.input.engine).toBe("runway-gen4");
  });

  it("falls back to the top-level engine when no override is given", () => {
    const fakeDef: TemplateDefinition = { ...def(), render: undefined, engine: "kling-v3" };
    const plan = compileRenderPlan(fakeDef);
    expect(plan.strategy.engines.inner).toBe("kling-v3");
    expect(plan.strategy.engines.subject).toBe("kling-v3");
  });

  it("adds an SFX step + audio cue when a break beat carries sfx", () => {
    const plan = compileRenderPlan(def());
    const sfx = plan.steps.find((s) => s.op === "gen-sfx");
    expect(sfx).toBeTruthy();
    const composite = plan.steps.find((s) => s.op === "composite")!;
    expect((composite.input.audioCues as unknown[]).length).toBe(1);
    expect(composite.dependsOn).toContain(sfx!.id);
  });

  it("aligns the composite mask + transition to the audio cue when supplied", () => {
    const plan = compileRenderPlan(def(), { audioCue: { atSec: 9 } });
    expect(plan.breakBeatSec).toBe(9);
    expect(plan.scene.breakTransition.atSec).toBe(9);
    expect(plan.scene.mask.openStartSec).toBeCloseTo(8.5);
  });

  it("is pure — same input yields an identical plan shape", () => {
    const a = compileRenderPlan(def());
    const b = compileRenderPlan(def());
    expect(a.steps.map((s) => s.id)).toEqual(b.steps.map((s) => s.id));
  });

  it("every shipped template compiles to a valid plan", () => {
    for (const t of getAllBreakthroughTemplates()) {
      const plan = compileRenderPlan(t);
      expect(validateRenderPlan(plan)).toEqual([]);
      expect(plan.steps.length).toBeGreaterThanOrEqual(7);
    }
  });
});
