/**
 * generation/pipeline — the engine-agnostic input builder.
 *
 * The orchestrator owns the state machine; this file owns the
 * "turn a shot + chain context into an engine-ready payload"
 * logic. Knowing which engine takes which shape lives here so the
 * orchestrator stays engine-blind.
 *
 * The four functions exposed:
 *   buildEngineInput(shot, doc, chainCtx) → EngineInput
 *     Compute the typed input the engine submitter expects. The
 *     output is engine-AGNOSTIC — the submitter for a specific
 *     engine translates it into provider-specific payloads.
 *
 *   buildPromptForEngine(input, engine) → string
 *     Produce the final string prompt for a given engine, weaving
 *     the identity chain + the pose hint + the camera direction
 *     into the modelPrompt the shot author wrote.
 *
 *   buildSubmitPayload(input, engine, tier) → unknown
 *     Final transformation to the JSON payload the supabase edge
 *     function (or direct provider API) expects.
 *
 *   selectEngineForShot(shot, doc) → ModelEngine
 *     Resolves the engine: shot override → document default.
 *
 * Pure functions. No IO. The edge function that actually submits
 * + polls is in the supabase/functions tree.
 */
import type {
  Shot,
  ScriptDocument,
  ModelEngine,
} from "../script-document";
import { findShotForBeat } from "../script-document";
import { getEngine, MODEL_CATALOG } from "../model-catalog";
import type { EngineInput, ChainContext, IdentityRef } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// CONTINUITY_LOCK — the global prefix that locks identity + look
// across an entire film. Mirrors the prefix that the existing
// editor-generate-clip edge function uses today.
// ─────────────────────────────────────────────────────────────────────────────
const CONTINUITY_LOCK_PREFIX =
  "CONTINUITY LOCK — exact same characters, same wardrobe, same hair, same skin tone, same lighting style, same color grade, same lens, same environment as the reference frames.";

// ─────────────────────────────────────────────────────────────────────────────
// selectEngineForShot
// ─────────────────────────────────────────────────────────────────────────────

export function selectEngineForShot(
  shot: Shot,
  doc: ScriptDocument,
): ModelEngine {
  return shot.engineOverride ?? doc.capabilities.defaultEngine;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildEngineInput
// ─────────────────────────────────────────────────────────────────────────────

export function buildEngineInput(
  shot: Shot,
  doc: ScriptDocument,
  chainCtx: ChainContext,
): EngineInput {
  const engine = selectEngineForShot(shot, doc);
  const row = getEngine(engine);

  // Frame-chain start image — only when the engine supports it AND
  // the previous shot has a persisted last-frame URL.
  const startImageUrl =
    row.supportsContinuityChain && chainCtx.previousShot?.lastFrameUrl
      ? chainCtx.previousShot.lastFrameUrl
      : null;

  // End-frame anchor — only when the engine can interpolate to a
  // distinct end frame (Kling / Runway). This is what turns forward
  // generation into bounded interpolation start→end.
  const endImageUrl =
    row.supportsEndFrame && chainCtx.endAnchorUrl ? chainCtx.endAnchorUrl : null;

  // VFX recipe — when the shot's modelInput already carries a
  // recipe_slug (Crossover ingestion path), pass it through verbatim
  // so the VFX edge function can route to the right Python branch.
  const vfxRecipeSlug =
    (shot.modelInput as { vfxRecipeSlug?: string } | undefined)?.vfxRecipeSlug;

  // Clamp duration to the engine's min/max.
  const durationSec = Math.max(
    row.minDurationSec,
    Math.min(row.maxDurationSec, shot.durationSec),
  );

  return {
    prompt: shot.modelPrompt,
    durationSec,
    aspectRatio: doc.meta.aspectRatio,
    startImageUrl,
    endImageUrl,
    identityRefs: chainCtx.identityRefs,
    inheritedFromShotId: chainCtx.previousShot?.shotId ?? null,
    vfxRecipeSlug,
    extras: { ...(shot.modelInput ?? {}) },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPromptForEngine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Weave the identity-chain + pose hint + lens intent into the
 * shot's raw modelPrompt to produce the FINAL string the engine
 * receives. Engine-aware: some engines want the lock prefix; some
 * (Veo, Sora) handle it implicitly via reference images and dilute
 * with the prefix.
 */
export function buildPromptForEngine(
  shot: Shot,
  doc: ScriptDocument,
  chainCtx: ChainContext,
  engine: ModelEngine,
): string {
  const row = getEngine(engine);

  const sections: string[] = [];

  // Identity lock — only when references aren't already passed as
  // images (which provide the lock more reliably).
  if (chainCtx.identityRefs.length > 0 && !shouldUseImageRefLock(row)) {
    sections.push(buildIdentityLockSection(chainCtx.identityRefs));
  }

  // Pose hint — text-only, regardless of engine.
  // (poseLockHint lives in chains.ts; we don't import it here to
  // avoid a circular module graph. The orchestrator can append it
  // separately when invoking this builder if it wants.)

  // Camera direction comes from the shot author.
  if (shot.cameraDirection) sections.push(shot.cameraDirection);

  // Lens intent.
  if (shot.lensIntent) sections.push(shot.lensIntent);

  // Core prompt — the shot author's words.
  sections.push(shot.modelPrompt);

  // Continuity lock prefix sits at the top of the prompt when
  // chained.
  const prefix =
    chainCtx.previousShot && !shouldUseImageRefLock(row)
      ? CONTINUITY_LOCK_PREFIX
      : "";

  return [prefix, ...sections].filter(Boolean).join(" ");
}

/** Engines that take strong image references handle identity lock
 *  via the reference frame itself — adding the verbal lock prefix
 *  dilutes the prompt. */
function shouldUseImageRefLock(row: { engine: ModelEngine }): boolean {
  return row.engine === "veo-3-pro" || row.engine === "sora-2" || row.engine === "runway-gen-4";
}

function buildIdentityLockSection(refs: IdentityRef[]): string {
  if (refs.length === 0) return "";
  if (refs.length === 1) {
    const r = refs[0];
    return `Featuring ${r.characterName} — ${r.identityDNA}.`;
  }
  const parts = refs.map((r) => `${r.characterName} (${r.identityDNA})`).join("; ");
  return `Featuring ${parts}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildSubmitPayload — engine-specific JSON shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translate the engine-agnostic EngineInput into the exact JSON the
 * provider's submit endpoint expects. This is where the engine
 * differences land — the rest of the pipeline is engine-blind.
 *
 * Returns `unknown` because each engine's shape is different; the
 * caller (the supabase edge function) casts it to the right type.
 */
export function buildSubmitPayload(
  input: EngineInput,
  engine: ModelEngine,
  tier: "draft" | "pro" | "studio",
  finalPrompt: string,
): unknown {
  const row = MODEL_CATALOG[engine];
  if (!row) {
    throw new Error(`Unknown engine: ${engine}`);
  }

  switch (row.modelInputShape) {
    case "seedance-i2v":
    case "seedance-t2v":
      return {
        prompt: finalPrompt,
        duration: input.durationSec,
        aspect_ratio: input.aspectRatio,
        ...(input.startImageUrl ? { image: input.startImageUrl } : {}),
      };

    case "kling-i2v":
    case "kling-t2v":
      return {
        prompt: finalPrompt,
        duration: input.durationSec,
        aspect_ratio: input.aspectRatio,
        ...(input.startImageUrl ? { start_image: input.startImageUrl } : {}),
        // Bounded interpolation: when the next anchor is locked, hand
        // Kling the END frame too so it interpolates start→end.
        ...(input.endImageUrl ? { end_image: input.endImageUrl } : {}),
        cfg_scale: 0.7,
        mode: tier === "studio" ? "master" : "pro",
      };

    case "veo-t2v":
    case "veo-i2v":
      return {
        prompt: finalPrompt,
        duration_seconds: input.durationSec,
        aspect_ratio: input.aspectRatio,
        enable_audio: row.supportsAudio,
        ...(input.startImageUrl ? { reference_image: input.startImageUrl } : {}),
      };

    case "sora-t2v":
      return {
        prompt: finalPrompt,
        seconds: input.durationSec,
        size:
          input.aspectRatio === "9:16"
            ? "720x1280"
            : input.aspectRatio === "1:1"
            ? "1024x1024"
            : "1280x720",
      };

    case "wan-t2v":
      return {
        prompt: finalPrompt,
        duration: input.durationSec,
        resolution: tier === "studio" ? "1080p" : "720p",
        ...(input.startImageUrl ? { init_image: input.startImageUrl } : {}),
      };

    case "comfy-graph":
      // The shot's modelInput is expected to carry the ComfyUI
      // workflow JSON in `extras.workflow`. The submitter routes
      // through a local-bridge edge function we don't ship in this
      // wave; the payload shape is left general.
      return {
        workflow: input.extras?.workflow,
        prompt: finalPrompt,
        duration: input.durationSec,
        startImage: input.startImageUrl,
      };

    case "runway-gen-t2v":
      return {
        textPrompt: finalPrompt,
        duration: input.durationSec,
        ratio: input.aspectRatio,
        ...(input.startImageUrl ? { promptImage: input.startImageUrl } : {}),
        // Runway keyframes: the end anchor becomes the final keyframe.
        ...(input.endImageUrl ? { lastFrameImage: input.endImageUrl } : {}),
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanity checks — what to surface in the inspector before generation
// ─────────────────────────────────────────────────────────────────────────────

export type ShotSanityIssue =
  | "no-prompt"
  | "engine-aspect-mismatch"
  | "engine-duration-too-long"
  | "engine-duration-too-short"
  | "missing-character-anchor"
  | "vfx-recipe-but-not-vfx-engine";

/**
 * Inspect a shot for problems that would cause generation to fail
 * or produce poor output. Surfaced in the inspector as warnings;
 * the user can still approve + render through them.
 */
export function shotSanity(
  shot: Shot,
  doc: ScriptDocument,
): ShotSanityIssue[] {
  const issues: ShotSanityIssue[] = [];
  const engine = selectEngineForShot(shot, doc);
  const row = getEngine(engine);

  if (!shot.modelPrompt || shot.modelPrompt.trim().length < 8) {
    issues.push("no-prompt");
  }
  if (!row.supportedAspectRatios.includes(doc.meta.aspectRatio)) {
    issues.push("engine-aspect-mismatch");
  }
  if (shot.durationSec > row.maxDurationSec) {
    issues.push("engine-duration-too-long");
  }
  if (shot.durationSec < row.minDurationSec) {
    issues.push("engine-duration-too-short");
  }

  // Characters mentioned in beats but missing from cast = lost
  // identity lock.
  const beatChars = shot.beatRefs
    .map((id) => findShotForBeat(doc, id))
    .filter(Boolean);
  if (beatChars.length > 0 && doc.cast.length === 0) {
    issues.push("missing-character-anchor");
  }

  // VFX recipe with a non-VFX engine — won't work.
  const recipeSlug = (shot.modelInput as { vfxRecipeSlug?: string })?.vfxRecipeSlug;
  if (recipeSlug && engine !== "comfy-local") {
    issues.push("vfx-recipe-but-not-vfx-engine");
  }

  return issues;
}
