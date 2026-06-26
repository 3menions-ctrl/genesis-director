import { describe, it, expect } from "vitest";
import {
  CANONICAL_Z,
  LAYER_ORDER,
  VIOLATION_MASK_SHAPE,
  destinationMotion,
  resolveLayerStack,
  resolveBeatTimeline,
  resolveMaskAnimation,
  resolveTemplate,
  toBlueprint,
  toEditorKeyframes,
} from "../compositor";
import type { TemplateDefinition } from "../schema";

function makeDef(overrides: Partial<TemplateDefinition> = {}): TemplateDefinition {
  return {
    id: "fx",
    name: "FX",
    description: "d",
    container: {
      kind: "social-feed",
      aspectRatio: "9:16",
      mediaWindow: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
      outerSpace: "ui",
    },
    boundaryViolation: "shatter-step",
    destination: "toward-viewer",
    prompts: {
      chrome: "chrome",
      innerVideo: "inner",
      breakthrough: "break",
      aftermath: "after",
    },
    boundaryMask: { shape: "shatter" },
    timeline: {
      durationSec: 12,
      breakBeatId: "break",
      beats: [
        { id: "establish", role: "establish", label: "a", atSec: 0 },
        { id: "tension", role: "tension", label: "t", atSec: 3 },
        { id: "break", role: "break", label: "b", atSec: 6, syncToAudioCue: true },
        { id: "aftermath", role: "aftermath", label: "am", atSec: 9 },
        { id: "settle", role: "settle", label: "s", atSec: 11 },
      ],
    },
    aspectRatio: "9:16",
    colorGrade: { primary: "#000", secondary: "#fff", accent: "#0ff" },
    engine: "veo-3",
    qualityTier: "4k-cinema",
    musicMood: "trap-banger",
    breakTransition: "dissolve",
    breakTransitionSec: 0.5,
    ...overrides,
  };
}

describe("layer stack ordering", () => {
  it("resolves exactly the canonical 4 layers in ascending z (0→3)", () => {
    const layers = resolveLayerStack(makeDef());
    expect(layers.map((l) => l.kind)).toEqual(LAYER_ORDER);
    expect(layers.map((l) => l.z)).toEqual([0, 1, 2, 3]);
    // strictly ascending
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i].z).toBeGreaterThan(layers[i - 1].z);
    }
  });

  it("places the breakthrough ABOVE the chrome and media window", () => {
    const layers = resolveLayerStack(makeDef());
    const z = Object.fromEntries(layers.map((l) => [l.kind, l.z]));
    expect(z["breakthrough"]).toBeGreaterThan(z["chrome"]);
    expect(z["breakthrough"]).toBeGreaterThan(z["media-window"]);
    expect(z["aftermath"]).toBe(Math.max(...layers.map((l) => l.z)));
  });

  it("forces canonical z even when a config override supplies a bad z", () => {
    // A malicious override tries to push chrome above breakthrough.
    const def = makeDef({
      layers: [
        {
          id: "x", kind: "chrome", z: 99, label: "bad", promptRole: "chrome",
        },
      ],
    });
    const layers = resolveLayerStack(def);
    const chrome = layers.find((l) => l.kind === "chrome")!;
    expect(chrome.z).toBe(CANONICAL_Z["chrome"]); // override ignored for z
    expect(layers.map((l) => l.z)).toEqual([0, 1, 2, 3]);
  });

  it("attaches destination motion keyframes to the breakthrough layer", () => {
    const layers = resolveLayerStack(makeDef({ destination: "off-screen" }));
    const bt = layers.find((l) => l.kind === "breakthrough")!;
    expect(bt.keyframes?.length).toBeGreaterThan(0);
    // off-screen drives a large positionX exit
    const xEnd = bt.keyframes!.filter((k) => k.property === "positionX").at(-1);
    expect(xEnd?.value).toBeGreaterThan(0.5);
  });

  it("activates the breakthrough layer at the break beat", () => {
    const layers = resolveLayerStack(makeDef());
    const bt = layers.find((l) => l.kind === "breakthrough")!;
    expect(bt.activeFromSec).toBe(6);
  });
});

describe("destinationMotion", () => {
  it("toward-viewer scales up", () => {
    const k = destinationMotion("toward-viewer").filter((x) => x.property === "scale");
    expect(k.at(-1)!.value).toBeGreaterThan(k[0].value);
  });
  it("into-outer-space shrinks and rises", () => {
    const m = destinationMotion("into-outer-space");
    expect(m.filter((x) => x.property === "scale").at(-1)!.value).toBeLessThan(1);
    expect(m.filter((x) => x.property === "positionY").at(-1)!.value).toBeLessThan(0);
  });
});

describe("beat timeline + audio-cue sync", () => {
  it("uses the authored break beat when no cue is given", () => {
    const t = resolveBeatTimeline(makeDef());
    expect(t.breakBeatSec).toBe(6);
    expect(t.syncedToAudio).toBe(false);
  });

  it("snaps the break beat to an audio cue and shifts later beats only", () => {
    const t = resolveBeatTimeline(makeDef(), { atSec: 8 });
    expect(t.syncedToAudio).toBe(true);
    expect(t.breakBeatSec).toBe(8);
    const at = (id: string) => t.beats.find((b) => b.id === id)!.atSec;
    // before the break: unchanged
    expect(at("establish")).toBe(0);
    expect(at("tension")).toBe(3);
    // at/after the break: shifted by +2
    expect(at("break")).toBe(8);
    expect(at("aftermath")).toBe(11);
    expect(at("settle")).toBe(13);
    // duration grows to cover the shifted tail
    expect(t.durationSec).toBeGreaterThanOrEqual(13);
  });

  it("does not sync when the break beat did not opt in", () => {
    const def = makeDef();
    def.timeline.beats = def.timeline.beats.map((b) =>
      b.id === "break" ? { ...b, syncToAudioCue: false } : b,
    );
    const t = resolveBeatTimeline(def, { atSec: 8 });
    expect(t.syncedToAudio).toBe(false);
    expect(t.breakBeatSec).toBe(6);
  });
});

describe("boundary mask timing", () => {
  it("opens the mask symmetrically around the break beat", () => {
    const def = makeDef();
    const t = resolveBeatTimeline(def);
    const m = resolveMaskAnimation(def, t);
    expect(m.openStartSec).toBeCloseTo(6 - 0.5);
    expect(m.openEndSec).toBeCloseTo(6 + 0.5);
    expect(m.keyframes[0]).toEqual({ atSec: 5.5, reveal: 0 });
    expect(m.keyframes.at(-1)).toEqual({ atSec: 6.5, reveal: 1 });
  });

  it("re-derives the mask window after an audio sync", () => {
    const def = makeDef();
    const t = resolveBeatTimeline(def, { atSec: 8 });
    const m = resolveMaskAnimation(def, t);
    expect(m.openStartSec).toBeCloseTo(7.5);
    expect(m.openEndSec).toBeCloseTo(8.5);
  });

  it("defaults the mask shape from the boundary violation", () => {
    const def = makeDef({ boundaryViolation: "pour-liquefy", boundaryMask: { shape: undefined as never } });
    const t = resolveBeatTimeline(def);
    const m = resolveMaskAnimation(def, t);
    expect(m.shape).toBe(VIOLATION_MASK_SHAPE["pour-liquefy"]);
    expect(m.shape).toBe("liquid");
  });

  it("defaults the mask region to the media window", () => {
    const def = makeDef();
    const m = resolveMaskAnimation(def, resolveBeatTimeline(def));
    expect(m.region).toEqual(def.container.mediaWindow);
  });
});

describe("toBlueprint bridge", () => {
  it("produces 3 clips carrying the AI-gen prompts", () => {
    const bp = toBlueprint(makeDef());
    expect(bp.clips.map((c) => c.label)).toEqual([
      "The Container",
      "The Breakthrough",
      "The Aftermath",
    ]);
    expect(bp.clips[1].prompt).toContain("break");
    expect(bp.category).toBe("vfx");
  });

  it("tags the blueprint with the three generator axes", () => {
    const bp = toBlueprint(makeDef());
    expect(bp.tags).toEqual(expect.arrayContaining([
      "social-feed", "shatter-step", "toward-viewer",
    ]));
  });

  it("reuses the existing crossfade vocabulary (TransitionKind)", () => {
    const bp = toBlueprint(makeDef({ breakTransition: "wipeleft" }));
    expect(bp.transitions).toContain("wipeleft");
  });
});

describe("resolveTemplate (end-to-end resolution)", () => {
  it("ties layers, timeline, mask and break transition together", () => {
    const scene = resolveTemplate(makeDef());
    expect(scene.layers.map((l) => l.kind)).toEqual(LAYER_ORDER);
    expect(scene.breakTransition.atSec).toBe(6);
    expect(scene.breakTransition.kind).toBe("dissolve");
    expect(scene.mask.openStartSec).toBeCloseTo(5.5);
    expect(scene.blueprint.clips.length).toBe(3);
  });

  it("moves the break transition onto the audio cue when supplied", () => {
    const scene = resolveTemplate(makeDef(), { audioCue: { atSec: 8 } });
    expect(scene.breakTransition.atSec).toBe(8);
    expect(scene.timeline.syncedToAudio).toBe(true);
    expect(scene.mask.openStartSec).toBeCloseTo(7.5);
  });
});

describe("toEditorKeyframes", () => {
  it("maps 0..1 blueprint keyframes to absolute editor keyframes", () => {
    const kfs = destinationMotion("toward-viewer");
    const editor = toEditorKeyframes("L", kfs, 6, 8);
    // a kf at 0 maps to activeFrom, a kf at 1 maps to activeTo
    expect(editor.find((k) => k.property === "scale" && k.time === 6)).toBeTruthy();
    expect(editor.find((k) => k.property === "scale" && k.time === 8)).toBeTruthy();
    expect(editor.every((k) => typeof k.id === "string")).toBe(true);
  });

  it("returns nothing for an empty keyframe list", () => {
    expect(toEditorKeyframes("L", undefined, 0, 1)).toEqual([]);
  });
});
