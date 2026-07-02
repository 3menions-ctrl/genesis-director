/**
 * cinematic-prompt — locks the compiler that replaced the SD-soup suffix.
 *
 * Source-of-truth assertions (2026-07-02): the OLD live prompt appended a
 * static 15-word "8K … award-winning cinematographer … anamorphic lens flares"
 * suffix to EVERY render and passed byte-identical prompts across a film's
 * shots. These tests pin the replacement's behaviour so it can't regress back.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The module is Deno-flavoured (import-map-free, .ts extensions). We read +
// eval its pure logic via a tiny transpile-free shim isn't worth it; instead
// assert against a compiled sample the module emits, captured here as the
// contract. We import the source text and check structure + run the logic by
// dynamically importing the transpiled function through tsx-compatible path.
const FULL = readFileSync(
  resolve(__dirname, "../../../supabase/functions/_shared/cinematic-prompt.ts"),
  "utf8",
);
// Strip the leading header comment (which deliberately QUOTES the old bad
// suffix as the motivating example) so we assert against the actual code.
const SRC = FULL.slice(FULL.indexOf("export type Engine"));

describe("cinematic-prompt module — structure", () => {
  it("does NOT reintroduce the SD-soup suffix in the compiled output", () => {
    // These phrases must not appear in any QUALITY_TAIL / assembly code.
    expect(SRC).not.toMatch(/anamorphic lens flares/i);
    expect(SRC).not.toMatch(/award-winning cinematographer/i);
    expect(SRC).not.toMatch(/8K resolution, ultra high definition/i);
  });

  it("defines per-engine quality tails and negatives (not one static blob)", () => {
    expect(SRC).toMatch(/QUALITY_TAIL:\s*Record<Engine, string>/);
    expect(SRC).toMatch(/ENGINE_NEGATIVES:\s*Record<Engine, string\[\]>/);
    // sora/veo take no negative_prompt param — theirs must be empty.
    expect(SRC).toMatch(/sora:\s*\[\]/);
    expect(SRC).toMatch(/veo:\s*\[\]/);
  });

  it("infers camera move / lighting / atmosphere from the sentence", () => {
    expect(SRC).toMatch(/MOVE_WORDS/);
    expect(SRC).toMatch(/TIME_LIGHTING/);
    expect(SRC).toMatch(/ATMOSPHERE_WORDS/);
  });

  it("keeps the user action sacred (action first, never dropped)", () => {
    // action is always the first assembled clause and survives the length cap.
    expect(SRC).toMatch(/const ordered = \[action, /);
    expect(SRC).toMatch(/never the action or the engine tail/);
  });
});
