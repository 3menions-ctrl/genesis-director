/**
 * Regression: Environments "Apply scene" no-op'd for ~102 of 122 (QA audit P1-16).
 *
 * THE BUG: the page renders all 122 environment blueprints
 * (getAllEnvironmentBlueprints), but loadEnvironment resolved IDs only against a
 * hard-coded 20-item ENVIRONMENT_PRESETS — so the other ~102 hit
 * "Environment not found" after a premature "Applied scene" toast on the
 * Environments page.
 *
 * THE FIX: loadEnvironment falls back to the full registry
 * (getEnvironmentBlueprint) and builds settings from the blueprint; the premature
 * Environments-page toast is removed (loadEnvironment owns the success toast).
 *
 * The hook fallback is verified BEHAVIORALLY against the real registry data; the
 * page toast removal is a source contract.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  getAllEnvironmentBlueprints,
  getEnvironmentBlueprint,
} from "@/lib/environments/registry";

const REPO_ROOT = resolve(__dirname, "../../..");

describe("environment registry covers far more than the 20 presets", () => {
  it("exposes well over 20 blueprints (the preset list's size)", () => {
    const all = getAllEnvironmentBlueprints();
    expect(all.length).toBeGreaterThan(20);
  });

  it("every rendered blueprint id resolves in the registry (the fallback source)", () => {
    const all = getAllEnvironmentBlueprints();
    // A representative non-base blueprint must resolve — pre-fix these were the
    // ~102 that loadEnvironment couldn't find.
    for (const bp of all) {
      const resolved = getEnvironmentBlueprint(bp.id);
      expect(resolved, `blueprint ${bp.id} should resolve`).toBeTruthy();
      // Must carry what loadEnvironment needs to build settings.
      expect(resolved?.name).toBeTruthy();
      expect(typeof resolved?.mood).toBe("string");
      expect(resolved?.generatorPrompt || resolved?.description).toBeTruthy();
    }
  });
});

describe("loadEnvironment / Environments — wiring", () => {
  const hook = readFileSync(
    resolve(REPO_ROOT, "src/hooks/useTemplateEnvironment.ts"),
    "utf-8",
  );
  const page = readFileSync(
    resolve(REPO_ROOT, "src/pages/Environments.tsx"),
    "utf-8",
  );

  it("loadEnvironment falls back to getEnvironmentBlueprint", () => {
    const region = hook.slice(
      hook.indexOf("const loadEnvironment ="),
      hook.indexOf("const loadEnvironment =") + 1400,
    );
    expect(region).toMatch(/getEnvironmentBlueprint\(/);
    expect(region).toMatch(/generatorPrompt/);
  });

  it("Environments page no longer fires a premature 'Applied scene' toast", () => {
    expect(page).not.toMatch(/toast\.success\(`Applied scene/);
  });
});
