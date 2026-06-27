/**
 * Breakthrough Effects — public surface.
 *
 * A data-driven catalogue generalising the original one-off "social post
 * breakthrough" into the cross-product of:
 *
 *     container × boundary_violation × destination
 *
 * • schema.ts     — the typed `TemplateDefinition`
 * • compositor.ts — resolves a definition into the existing render structures
 * • registry.ts   — loads templates from `./configs/*.ts` (new effect = new file)
 */

export * from "./schema";
export * from "./compositor";
export * from "./renderPlan";
export * from "./execute";
export {
  BREAKTHROUGH_REGISTRY,
  buildBreakthroughRegistry,
  validateTemplateDefinition,
  getBreakthroughTemplate,
  getAllBreakthroughTemplates,
  getBreakthroughBlueprints,
  type ConfigModule,
} from "./registry";
