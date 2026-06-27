/**
 * Breakthrough registry — loads templates from CONFIG FILES.
 *
 * Adding a new effect = dropping a `*.ts` file in `./configs/` that
 * `export default`s a `TemplateDefinition`. No registration code, no schema
 * edits, no compositor changes. `import.meta.glob` picks it up at build time.
 *
 * `buildBreakthroughRegistry` is a PURE function over a module record so it is
 * unit-testable without the bundler; the production registry just feeds it the
 * glob result.
 */

import type { TemplateBlueprint } from "../blueprint";
import { toBlueprint } from "./compositor";
import type { TemplateDefinition } from "./schema";
import {
  CONTAINER_KINDS,
  BOUNDARY_VIOLATIONS,
  DESTINATIONS,
} from "./schema";

// A config module: `export default <TemplateDefinition>` (or, defensively, the
// bare object if a file forgot the default).
export type ConfigModule = { default?: TemplateDefinition } | TemplateDefinition;

function unwrap(mod: ConfigModule): TemplateDefinition {
  return (mod as { default?: TemplateDefinition }).default ?? (mod as TemplateDefinition);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation — returns a list of human-readable errors (empty = valid).
// ─────────────────────────────────────────────────────────────────────────────
export function validateTemplateDefinition(def: TemplateDefinition): string[] {
  const errs: string[] = [];
  const where = def?.id ? `"${def.id}"` : "<missing id>";

  if (!def?.id) errs.push("missing id");
  if (!def?.name) errs.push(`${where}: missing name`);

  // Cross-product axes must be valid members.
  if (!CONTAINER_KINDS.includes(def?.container?.kind)) {
    errs.push(`${where}: invalid container.kind "${def?.container?.kind}"`);
  }
  if (!BOUNDARY_VIOLATIONS.includes(def?.boundaryViolation)) {
    errs.push(`${where}: invalid boundaryViolation "${def?.boundaryViolation}"`);
  }
  if (!DESTINATIONS.includes(def?.destination)) {
    errs.push(`${where}: invalid destination "${def?.destination}"`);
  }

  // Aspect ratio must agree between top-level and container.
  if (def?.aspectRatio && def?.container?.aspectRatio &&
      def.aspectRatio !== def.container.aspectRatio) {
    errs.push(
      `${where}: aspectRatio "${def.aspectRatio}" != container.aspectRatio "${def.container.aspectRatio}"`,
    );
  }

  // Media window must be inside the frame.
  const mw = def?.container?.mediaWindow;
  if (mw) {
    const inside =
      mw.x >= 0 && mw.y >= 0 &&
      mw.x + mw.width <= 1.0001 && mw.y + mw.height <= 1.0001 &&
      mw.width > 0 && mw.height > 0;
    if (!inside) errs.push(`${where}: mediaWindow out of 0..1 bounds`);
  } else {
    errs.push(`${where}: missing container.mediaWindow`);
  }

  // Prompts — all four AI-gen fields required (tunable, but must exist).
  for (const role of ["chrome", "innerVideo", "breakthrough", "aftermath"] as const) {
    if (!def?.prompts?.[role]?.trim()) {
      errs.push(`${where}: missing prompts.${role}`);
    }
  }

  // Timeline integrity.
  const tl = def?.timeline;
  if (!tl?.beats?.length) {
    errs.push(`${where}: timeline has no beats`);
  } else {
    if (!tl.beats.some((b) => b.id === tl.breakBeatId)) {
      errs.push(`${where}: breakBeatId "${tl.breakBeatId}" not found in beats`);
    }
    // Beats must be sorted ascending and within duration.
    for (let i = 0; i < tl.beats.length; i++) {
      const b = tl.beats[i];
      if (b.atSec < 0 || b.atSec > tl.durationSec + 0.0001) {
        errs.push(`${where}: beat "${b.id}" atSec ${b.atSec} outside 0..${tl.durationSec}`);
      }
      if (i > 0 && b.atSec < tl.beats[i - 1].atSec) {
        errs.push(`${where}: beats not sorted ascending at "${b.id}"`);
      }
    }
  }

  if (!def?.boundaryMask?.shape) {
    errs.push(`${where}: missing boundaryMask.shape`);
  }
  if (def?.boundaryMask?.shape === "polygon" && !def?.boundaryMask?.points?.length) {
    errs.push(`${where}: polygon mask requires points`);
  }

  return errs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure registry builder — validates + dedupes by id. THROWS on invalid config
// or duplicate id (fail fast at boot, not silently in production).
// ─────────────────────────────────────────────────────────────────────────────
export function buildBreakthroughRegistry(
  modules: Record<string, ConfigModule>,
): Map<string, TemplateDefinition> {
  const registry = new Map<string, TemplateDefinition>();
  const allErrors: string[] = [];

  for (const [path, mod] of Object.entries(modules)) {
    const def = unwrap(mod);
    const errs = validateTemplateDefinition(def);
    if (errs.length) {
      allErrors.push(`  (${path})\n    - ${errs.join("\n    - ")}`);
      continue;
    }
    if (registry.has(def.id)) {
      allErrors.push(`  (${path})\n    - duplicate id "${def.id}"`);
      continue;
    }
    registry.set(def.id, def);
  }

  if (allErrors.length) {
    throw new Error(
      `[breakthrough] ${allErrors.length} config error(s):\n${allErrors.join("\n")}`,
    );
  }
  return registry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Production registry — auto-discovers every config file. Adding a file here
// is the ONLY step to ship a new effect.
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG_MODULES = import.meta.glob<ConfigModule>("./configs/*.ts", {
  eager: true,
});

export const BREAKTHROUGH_REGISTRY: Map<string, TemplateDefinition> =
  buildBreakthroughRegistry(CONFIG_MODULES);

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export function getBreakthroughTemplate(id: string): TemplateDefinition | undefined {
  return BREAKTHROUGH_REGISTRY.get(id);
}

export function getAllBreakthroughTemplates(): TemplateDefinition[] {
  return Array.from(BREAKTHROUGH_REGISTRY.values());
}

/** Bridge: breakthrough defs as TemplateBlueprints for the unified catalogue. */
export function getBreakthroughBlueprints(): TemplateBlueprint[] {
  return getAllBreakthroughTemplates().map(toBlueprint);
}
