/**
 * continuity/engine-routing — pick the engine per shot by its boundary's
 * continuity demand, not by a single global default. This is invisible
 * multi-model routing used as a CONTINUITY tool: the right model for
 * the kind of cut, not just the prettiest model.
 *
 * Pure. No IO.
 */
import type { Boundary } from "./boundaries";
import type { ModelEngine } from "../../editor/script-document";
import { MODEL_CATALOG } from "../../editor/model-catalog";

export interface RoutingHints {
  /** Does this shot carry dialogue / need lip-sync? */
  hasDialogue?: boolean;
  /** Is this an action / heavy-motion beat? */
  isAction?: boolean;
  /** Is this an establishing / ambient shot driven by sound? */
  isEstablishing?: boolean;
  /** Does the shot need native audio? */
  needsAudio?: boolean;
  /** Both start AND end anchors are available (true interpolation)? */
  hasBothAnchors?: boolean;
}

export interface RoutingResult {
  engine: ModelEngine;
  reason: string;
}

/** Engines that accept a distinct end frame / keyframe pair. */
export function supportsEndFrame(engine: ModelEngine): boolean {
  return MODEL_CATALOG[engine]?.supportsEndFrame === true;
}

/**
 * Route a shot to the engine whose strength matches its boundary's
 * continuity demand. Falls back gracefully to whatever is available.
 */
export function routeEngineForBoundary(
  boundary: Boundary,
  available: ModelEngine[],
  hints: RoutingHints = {},
): RoutingResult {
  const has = (e: ModelEngine) => available.includes(e);
  const pick = (e: ModelEngine, reason: string): RoutingResult =>
    has(e) ? { engine: e, reason } : { engine: fallback(available), reason: `${reason} (fallback)` };

  // 1. Native-audio establishing / ambient beats → Veo or Sora.
  if (hints.isEstablishing || (hints.needsAudio && !hints.hasDialogue)) {
    if (has("sora-2")) return { engine: "sora-2", reason: "long coherent ambient beat" };
    if (has("veo-3-pro")) return { engine: "veo-3-pro", reason: "native-audio establishing shot" };
  }

  // 2. Dialogue / lip-sync → Kling (lip-sync) or Veo (native audio).
  if (hints.hasDialogue) {
    if (has("kling-2-master")) return { engine: "kling-2-master", reason: "dialogue · lip-sync + end-frame" };
    if (has("veo-3-pro")) return { engine: "veo-3-pro", reason: "dialogue · native audio" };
  }

  // 3. A true seam to hide (CONTINUOUS) with both anchors → Kling,
  //    which interpolates start→end.
  if (boundary.contract.carryFrame && hints.hasBothAnchors) {
    if (has("kling-2-master")) return { engine: "kling-2-master", reason: "CONTINUOUS · bounded interpolation A→B" };
    if (has("kling-1-6-pro")) return { engine: "kling-1-6-pro", reason: "CONTINUOUS · start-frame chain" };
  }

  // 4. Hard identity demand across cuts → Runway (best ID preservation).
  if (
    boundary.contract.identity === "hard" &&
    boundary.sharedCast.length > 0 &&
    !hints.isAction
  ) {
    if (has("runway-gen-4")) return { engine: "runway-gen-4", reason: "identity-critical · Runway ID lock" };
  }

  // 5. Action / heavy motion → Seedance (motion physics; reframe hides seam).
  if (hints.isAction) {
    return pick("seedance-1-pro", "action · hyperreal motion");
  }

  // 6. Default — Seedance is the reliable photoreal workhorse.
  return pick("seedance-1-pro", "default photoreal");
}

function fallback(available: ModelEngine[]): ModelEngine {
  return (
    available.find((e) => e === "seedance-1-pro") ??
    available[0] ??
    "seedance-1-pro"
  );
}
