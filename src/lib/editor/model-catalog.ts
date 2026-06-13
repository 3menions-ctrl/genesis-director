/**
 * model-catalog — every video / image generation engine the system
 * can target, with its capabilities matrix.
 *
 * Why a catalog: shots in the ScriptDocument can override the
 * default engine per-shot. The editor needs to know, for any chosen
 * engine, what duration is possible, what cost will accrue, what
 * input shape is expected, what aspect ratios are supported. This
 * file is the single source of truth for those answers.
 *
 * Costs are credits per second (matching the editor's
 * editor-generate-clip pricing): 5s ≈ 65cr, 10s ≈ 95cr for Seedance
 * Pro. Tier maps onto provider quality tiers when the provider has
 * them (Kling has Standard / Pro / Master; Veo has 2 / 3; Sora has
 * 2). Draft tier = fastest + cheapest; Studio = highest quality.
 *
 * Adding an engine = one entry in MODEL_CATALOG. No other file
 * needs to change; the editor reads the catalog at runtime.
 */

import type { AspectRatio } from "./types";
import type { ModelEngine, ModelCapabilities } from "./script-document";

// ─────────────────────────────────────────────────────────────────────────────
// Per-engine capabilities matrix
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineCapabilityRow {
  engine: ModelEngine;
  /** Human-readable name surfaced in the inspector. */
  displayName: string;
  /** Marketing label — surfaced as a hint chip ("Best for trailers"). */
  tagline: string;
  /** Provider / hosting platform. */
  provider:
    | "replicate"
    | "google"
    | "openai"
    | "kuaishou"
    | "comfyui-local"
    | "runwayml"
    | "alibaba";
  /** Smallest unit the engine accepts in seconds. */
  minDurationSec: number;
  /** Largest single-shot duration the engine can produce. */
  maxDurationSec: number;
  /** Whether the engine returns audio as part of the video output. */
  supportsAudio: boolean;
  /** True when the engine accepts a reference image alongside the
   *  text prompt (image-to-video flow). */
  supportsImageInput: boolean;
  /** True when the engine accepts the previous shot's last frame as
   *  the first frame of the new shot (continuity chain). */
  supportsContinuityChain: boolean;
  /** Aspect ratios the engine natively supports. */
  supportedAspectRatios: AspectRatio[];
  /** Available quality tiers for this engine. */
  availableTiers: Array<"draft" | "pro" | "studio">;
  /** Credits per second by tier. Used by the cost preview. */
  costPerSecondByTier: Partial<Record<"draft" | "pro" | "studio", number>>;
  /** Realistic time-to-finish for one short shot — used by the
   *  scheduler + the loading toast's "expected duration" hint. */
  typicalRenderSecondsBySec: { sec5: number; sec10: number };
  /** Engine-specific input field name + shape — hints for the
   *  generator function that wraps this engine. */
  modelInputShape:
    | "seedance-t2v"
    | "seedance-i2v"
    | "kling-t2v"
    | "kling-i2v"
    | "veo-t2v"
    | "veo-i2v"
    | "sora-t2v"
    | "wan-t2v"
    | "comfy-graph"
    | "runway-gen-t2v";
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog
// ─────────────────────────────────────────────────────────────────────────────
export const MODEL_CATALOG: Record<ModelEngine, EngineCapabilityRow> = {
  "seedance-1-pro": {
    engine: "seedance-1-pro",
    displayName: "Seedance 1 Pro",
    tagline: "ByteDance's flagship — fast, photoreal, image-to-video native",
    provider: "replicate",
    minDurationSec: 5,
    maxDurationSec: 10,
    supportsAudio: false,
    supportsImageInput: true,
    supportsContinuityChain: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1", "4:5"],
    availableTiers: ["pro"],
    costPerSecondByTier: { pro: 13 /* 65cr / 5s = 13/sec */ },
    typicalRenderSecondsBySec: { sec5: 75, sec10: 120 },
    modelInputShape: "seedance-i2v",
  },

  "kling-2-master": {
    engine: "kling-2-master",
    displayName: "Kling 2 Master",
    tagline: "Kuaishou's top tier — best motion + cinematic camera",
    provider: "kuaishou",
    minDurationSec: 5,
    maxDurationSec: 10,
    supportsAudio: false,
    supportsImageInput: true,
    supportsContinuityChain: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    availableTiers: ["studio"],
    costPerSecondByTier: { studio: 22 },
    typicalRenderSecondsBySec: { sec5: 100, sec10: 180 },
    modelInputShape: "kling-i2v",
  },

  "kling-1-6-pro": {
    engine: "kling-1-6-pro",
    displayName: "Kling 1.6 Pro",
    tagline: "Reliable workhorse — strong text-to-video without an anchor image",
    provider: "kuaishou",
    minDurationSec: 5,
    maxDurationSec: 10,
    supportsAudio: false,
    supportsImageInput: true,
    supportsContinuityChain: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    availableTiers: ["pro"],
    costPerSecondByTier: { pro: 14 },
    typicalRenderSecondsBySec: { sec5: 80, sec10: 140 },
    modelInputShape: "kling-t2v",
  },

  "veo-3-pro": {
    engine: "veo-3-pro",
    displayName: "Veo 3 Pro",
    tagline: "Google DeepMind — native audio + lip-sync, 1080p, longest takes",
    provider: "google",
    minDurationSec: 4,
    maxDurationSec: 60,
    supportsAudio: true,
    supportsImageInput: true,
    supportsContinuityChain: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1", "4:5", "21:9"],
    availableTiers: ["pro", "studio"],
    costPerSecondByTier: { pro: 30, studio: 50 },
    typicalRenderSecondsBySec: { sec5: 60, sec10: 100 },
    modelInputShape: "veo-t2v",
  },

  "veo-2": {
    engine: "veo-2",
    displayName: "Veo 2",
    tagline: "Google's previous flagship — strong physics, no audio",
    provider: "google",
    minDurationSec: 5,
    maxDurationSec: 8,
    supportsAudio: false,
    supportsImageInput: true,
    supportsContinuityChain: false,
    supportedAspectRatios: ["16:9", "9:16"],
    availableTiers: ["pro"],
    costPerSecondByTier: { pro: 20 },
    typicalRenderSecondsBySec: { sec5: 90, sec10: 160 },
    modelInputShape: "veo-i2v",
  },

  "sora-2": {
    engine: "sora-2",
    displayName: "Sora 2",
    tagline: "OpenAI — strongest narrative coherence, 1080p, audio in 2",
    provider: "openai",
    minDurationSec: 4,
    maxDurationSec: 60,
    supportsAudio: true,
    supportsImageInput: true,
    supportsContinuityChain: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    availableTiers: ["pro", "studio"],
    costPerSecondByTier: { pro: 28, studio: 48 },
    typicalRenderSecondsBySec: { sec5: 70, sec10: 110 },
    modelInputShape: "sora-t2v",
  },

  "wan-2-1": {
    engine: "wan-2-1",
    displayName: "Wan 2.1",
    tagline: "Alibaba — strong on text-rendering + non-Asian faces",
    provider: "alibaba",
    minDurationSec: 5,
    maxDurationSec: 10,
    supportsAudio: false,
    supportsImageInput: true,
    supportsContinuityChain: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    availableTiers: ["draft", "pro"],
    costPerSecondByTier: { draft: 8, pro: 16 },
    typicalRenderSecondsBySec: { sec5: 60, sec10: 120 },
    modelInputShape: "wan-t2v",
  },

  "comfy-local": {
    engine: "comfy-local",
    displayName: "ComfyUI · Local",
    tagline: "Your own workstation — zero per-frame cost, full control",
    provider: "comfyui-local",
    minDurationSec: 1,
    maxDurationSec: 30,
    supportsAudio: false,
    supportsImageInput: true,
    supportsContinuityChain: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1", "4:5", "21:9", "4:3"],
    availableTiers: ["draft", "pro", "studio"],
    costPerSecondByTier: { draft: 0, pro: 0, studio: 0 },
    typicalRenderSecondsBySec: { sec5: 120, sec10: 220 },
    modelInputShape: "comfy-graph",
  },

  "runway-gen-4": {
    engine: "runway-gen-4",
    displayName: "Runway Gen-4",
    tagline: "Runway's flagship — best ID-preserving generation",
    provider: "runwayml",
    minDurationSec: 5,
    maxDurationSec: 10,
    supportsAudio: false,
    supportsImageInput: true,
    supportsContinuityChain: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1", "4:5"],
    availableTiers: ["pro", "studio"],
    costPerSecondByTier: { pro: 24, studio: 40 },
    typicalRenderSecondsBySec: { sec5: 85, sec10: 150 },
    modelInputShape: "runway-gen-t2v",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Look up the capability row for an engine. Returns the Seedance
 *  default when the engine is unknown — avoids crashes from stale
 *  document data referencing an engine we've sunsetted. */
export function getEngine(engine: ModelEngine): EngineCapabilityRow {
  return MODEL_CATALOG[engine] ?? MODEL_CATALOG["seedance-1-pro"];
}

/** Cost of a shot in credits. Picks the engine's per-second rate
 *  at the given tier and multiplies by duration. */
export function estimateShotCredits(
  engine: ModelEngine,
  tier: ModelCapabilities["qualityTier"],
  durationSec: number,
): number {
  const row = getEngine(engine);
  const perSec =
    row.costPerSecondByTier[tier] ??
    row.costPerSecondByTier.pro ??
    row.costPerSecondByTier.draft ??
    row.costPerSecondByTier.studio ??
    0;
  return Math.ceil(perSec * Math.max(row.minDurationSec, durationSec));
}

/** All engines that can target a given aspect ratio. Used by the
 *  inspector's engine picker to filter out incompatible options. */
export function enginesForAspect(aspect: AspectRatio): EngineCapabilityRow[] {
  return Object.values(MODEL_CATALOG).filter((row) =>
    row.supportedAspectRatios.includes(aspect),
  );
}

/** Recommended engine for a template. Heuristic, not a hard rule —
 *  the editor surfaces this as the default on a new project, the
 *  user is free to override. */
export function recommendedEngineForTemplate(
  templateId:
    | "trailer"
    | "music-video"
    | "documentary"
    | "wedding-cinematic"
    | "tiktok-reel"
    | "brand-promo"
    | "festival-indie"
    | "brutalist-drop"
    | "custom",
): ModelEngine {
  switch (templateId) {
    case "trailer":
    case "music-video":
      return "kling-2-master"; // best motion + camera
    case "documentary":
    case "festival-indie":
      return "veo-3-pro"; // native audio + long takes
    case "wedding-cinematic":
      return "sora-2"; // best narrative coherence
    case "tiktok-reel":
      return "seedance-1-pro"; // fast + cheap + vertical-native
    case "brand-promo":
      return "runway-gen-4"; // ID-preserving for product shots
    case "brutalist-drop":
      return "wan-2-1"; // text-rendering for typographic intros
    case "custom":
    default:
      return "seedance-1-pro";
  }
}
