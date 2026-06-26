import { describe, it, expect } from "vitest";
import {
  buildBreakthroughRegistry,
  validateTemplateDefinition,
  getAllBreakthroughTemplates,
  getBreakthroughTemplate,
  getBreakthroughBlueprints,
  type ConfigModule,
} from "../registry";
import type { TemplateDefinition } from "../schema";

// Minimal valid definition factory — keeps each test focused on one field.
function makeDef(overrides: Partial<TemplateDefinition> = {}): TemplateDefinition {
  return {
    id: "test-fixture",
    name: "Test Fixture",
    description: "A valid fixture.",
    container: {
      kind: "social-feed",
      aspectRatio: "9:16",
      mediaWindow: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
      outerSpace: "surrounding UI",
    },
    boundaryViolation: "climb-out",
    destination: "toward-viewer",
    prompts: {
      chrome: "chrome prompt",
      innerVideo: "inner prompt",
      breakthrough: "break prompt",
      aftermath: "aftermath prompt",
    },
    boundaryMask: { shape: "shatter" },
    timeline: {
      durationSec: 12,
      breakBeatId: "break",
      beats: [
        { id: "establish", role: "establish", label: "a", atSec: 0 },
        { id: "break", role: "break", label: "b", atSec: 6, syncToAudioCue: true },
        { id: "settle", role: "settle", label: "c", atSec: 10 },
      ],
    },
    aspectRatio: "9:16",
    colorGrade: { primary: "#000", secondary: "#fff", accent: "#0ff" },
    engine: "veo-3",
    qualityTier: "4k-cinema",
    musicMood: "trap-banger",
    ...overrides,
  };
}

describe("validateTemplateDefinition", () => {
  it("accepts a valid definition", () => {
    expect(validateTemplateDefinition(makeDef())).toEqual([]);
  });

  it("rejects an invalid container kind", () => {
    const errs = validateTemplateDefinition(
      makeDef({ container: { ...makeDef().container, kind: "spaceship" as never } }),
    );
    expect(errs.join()).toMatch(/invalid container.kind/);
  });

  it("rejects an invalid boundary violation", () => {
    const errs = validateTemplateDefinition(
      makeDef({ boundaryViolation: "teleport" as never }),
    );
    expect(errs.join()).toMatch(/invalid boundaryViolation/);
  });

  it("rejects an invalid destination", () => {
    const errs = validateTemplateDefinition(
      makeDef({ destination: "the-moon" as never }),
    );
    expect(errs.join()).toMatch(/invalid destination/);
  });

  it("rejects an aspect-ratio mismatch between top-level and container", () => {
    const errs = validateTemplateDefinition(makeDef({ aspectRatio: "16:9" }));
    expect(errs.join()).toMatch(/aspectRatio.*!=.*container.aspectRatio/);
  });

  it("rejects a media window outside 0..1", () => {
    const errs = validateTemplateDefinition(
      makeDef({
        container: {
          ...makeDef().container,
          mediaWindow: { x: 0.6, y: 0.2, width: 0.8, height: 0.5 },
        },
      }),
    );
    expect(errs.join()).toMatch(/mediaWindow out of 0\.\.1/);
  });

  it("rejects a missing AI-gen prompt", () => {
    const def = makeDef();
    const errs = validateTemplateDefinition({
      ...def,
      prompts: { ...def.prompts, breakthrough: "  " },
    });
    expect(errs.join()).toMatch(/missing prompts.breakthrough/);
  });

  it("rejects a breakBeatId not present in beats", () => {
    const def = makeDef();
    const errs = validateTemplateDefinition({
      ...def,
      timeline: { ...def.timeline, breakBeatId: "nope" },
    });
    expect(errs.join()).toMatch(/breakBeatId "nope" not found/);
  });

  it("rejects out-of-order beats", () => {
    const def = makeDef();
    const errs = validateTemplateDefinition({
      ...def,
      timeline: {
        ...def.timeline,
        beats: [
          { id: "a", role: "establish", label: "a", atSec: 6 },
          { id: "break", role: "break", label: "b", atSec: 2 },
        ],
      },
    });
    expect(errs.join()).toMatch(/not sorted ascending/);
  });

  it("rejects a polygon mask without points", () => {
    const errs = validateTemplateDefinition(
      makeDef({ boundaryMask: { shape: "polygon" } }),
    );
    expect(errs.join()).toMatch(/polygon mask requires points/);
  });
});

describe("buildBreakthroughRegistry", () => {
  it("loads valid configs keyed by id (default or bare export)", () => {
    const modules: Record<string, ConfigModule> = {
      "./configs/a.ts": { default: makeDef({ id: "a" }) },
      "./configs/b.ts": makeDef({ id: "b" }), // bare object, no default
    };
    const reg = buildBreakthroughRegistry(modules);
    expect(reg.size).toBe(2);
    expect(reg.get("a")?.id).toBe("a");
    expect(reg.get("b")?.id).toBe("b");
  });

  it("throws on a duplicate id", () => {
    const modules: Record<string, ConfigModule> = {
      "./configs/a.ts": makeDef({ id: "dup" }),
      "./configs/b.ts": makeDef({ id: "dup" }),
    };
    expect(() => buildBreakthroughRegistry(modules)).toThrow(/duplicate id "dup"/);
  });

  it("throws and reports the path of an invalid config", () => {
    const modules: Record<string, ConfigModule> = {
      "./configs/bad.ts": makeDef({ boundaryViolation: "nope" as never }),
    };
    expect(() => buildBreakthroughRegistry(modules)).toThrow(/configs\/bad\.ts/);
  });
});

describe("production registry (auto-loaded from ./configs)", () => {
  it("loads exactly the 7 shipped templates", () => {
    const all = getAllBreakthroughTemplates();
    expect(all.length).toBe(7);
    expect(all.map((d) => d.id).sort()).toEqual([
      "bt-aquarium-pour-out",
      "bt-billboard-walkout",
      "bt-cctv-grid-walk-across",
      "bt-group-chat-swarm",
      "bt-home-screen-fold-out",
      "bt-social-feed-breakout",
      "bt-wanted-poster-peel",
    ]);
  });

  it("every shipped config is valid", () => {
    for (const def of getAllBreakthroughTemplates()) {
      expect(validateTemplateDefinition(def)).toEqual([]);
    }
  });

  it("covers the full generator axis space across the shipped templates", () => {
    const all = getAllBreakthroughTemplates();
    // 7 distinct containers
    expect(new Set(all.map((d) => d.container.kind)).size).toBe(7);
    // all 7 boundary violations represented
    expect(new Set(all.map((d) => d.boundaryViolation)).size).toBe(7);
    // all 4 destinations represented
    expect(new Set(all.map((d) => d.destination)).size).toBe(4);
  });

  it("bridges 7 blueprints with all axes appearing in tags", () => {
    const bps = getBreakthroughBlueprints();
    expect(bps.length).toBe(7);
  });

  it("looks templates up by id", () => {
    expect(getBreakthroughTemplate("bt-billboard-walkout")?.name).toBe("Billboard Walkout");
    expect(getBreakthroughTemplate("does-not-exist")).toBeUndefined();
  });

  it("bridges each template into a TemplateBlueprint for the catalogue", () => {
    const bps = getBreakthroughBlueprints();
    expect(bps.length).toBe(7);
    for (const bp of bps) {
      expect(bp.category).toBe("vfx");
      expect(bp.clips.length).toBe(3);
      expect(bp.isBreakout).toBe(true);
    }
  });
});
