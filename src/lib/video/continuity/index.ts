/**
 * continuity — the Continuity Engine brain.
 *
 * Pure, engine-blind logic for seamless multi-clip generation:
 *   • boundaries       — the per-boundary continuity contract
 *   • identity-bible   — the cross-film consistency spine
 *   • continuity-score — the contract-relative blocking audit
 *   • correction-ladder— deterministic, cost-ordered recovery
 *   • engine-routing   — pick the engine by continuity demand
 *   • phases           — the shared pipeline progress model (UI ↔ engine)
 *
 * See reports/continuity-engine/architecture.md for the full spec.
 */
export * from "./boundaries";
export * from "./identity-bible";
export * from "./continuity-score";
export * from "./correction-ladder";
export * from "./engine-routing";
export * from "./phases";
