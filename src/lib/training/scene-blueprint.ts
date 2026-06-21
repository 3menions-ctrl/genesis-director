/**
 * TrainingSceneBlueprint — the unified rich scene schema for /training-video.
 *
 * Distinct from EnvironmentBlueprint (which serves /environments). Training
 * scenes are curated for talking-head video — every scene declares its
 * mood, lighting, color palette, recommended voice persona group, suggested
 * use cases, and a long prompt that describes the scene with the SUBJECT
 * present in it.
 *
 * Categorized into 6 training-focused "worlds":
 *   - Studio       (cycloramas, podcast booths, professional sets)
 *   - Corporate    (boardrooms, offices, executive spaces)
 *   - Education    (lecture halls, classrooms, labs, training facilities)
 *   - Lifestyle    (coffee shops, cabins, urban + travel locations)
 *   - Nature       (mountains, beaches, forests, wilderness)
 *   - Sci-fi       (space stations, futuristic, fantasy, historical)
 */
import type { VoicePersonaGroup } from "@/lib/voices/blueprint";
import type { VoiceUseCase } from "@/lib/voices/blueprint";

// ─────────────────────────────────────────────────────────────────────────────
// World taxonomy
// ─────────────────────────────────────────────────────────────────────────────
export type SceneWorld =
  | "studio" | "corporate" | "education" | "lifestyle" | "nature" | "scifi";

export const SCENE_WORLD_LABELS: Record<SceneWorld, string> = {
  studio:    "Studios & Sets",
  corporate: "Corporate & Office",
  education: "Education & Training",
  lifestyle: "Lifestyle & Urban",
  nature:    "Nature & Outdoor",
  scifi:     "Sci-fi & Fantasy",
};

export const SCENE_WORLD_SHORT: Record<SceneWorld, string> = {
  studio:    "Studio",
  corporate: "Corporate",
  education: "Education",
  lifestyle: "Lifestyle",
  nature:    "Nature",
  scifi:     "Sci-fi",
};

// ─────────────────────────────────────────────────────────────────────────────
// Lighting hint (light version of EnvironmentBlueprint's profile — training
// only needs a four-axis read for the drawer UI)
// ─────────────────────────────────────────────────────────────────────────────
export type SceneLightingMood = "soft" | "cinematic" | "high-key" | "moody" | "neon";
export type SceneTimeOfDay = "controlled" | "morning" | "midday" | "golden-hour" | "evening" | "night";
export type SceneTemperature = "warm" | "neutral" | "cool" | "cold";

export const SCENE_LIGHTING_LABELS: Record<SceneLightingMood, string> = {
  soft:        "Soft · diffused",
  cinematic:   "Cinematic · sculpted",
  "high-key":  "High-key · bright",
  moody:       "Moody · low-key",
  neon:        "Neon · multi-color",
};
export const SCENE_TOD_LABELS: Record<SceneTimeOfDay, string> = {
  controlled: "Controlled",
  morning:    "Morning",
  midday:     "Midday",
  "golden-hour": "Golden hour",
  evening:    "Evening",
  night:      "Night",
};
export const SCENE_TEMP_LABELS: Record<SceneTemperature, string> = {
  warm: "Warm", neutral: "Neutral", cool: "Cool", cold: "Cold",
};

// ─────────────────────────────────────────────────────────────────────────────
// Production tier — a quick read of how "premium" the scene looks
// ─────────────────────────────────────────────────────────────────────────────
export type ProductionTier = "casual" | "professional" | "premium" | "cinematic";

export const PRODUCTION_TIER_LABELS: Record<ProductionTier, string> = {
  casual:        "Casual · vlog",
  professional:  "Professional",
  premium:       "Premium",
  cinematic:     "Cinematic · prestige",
};

// ─────────────────────────────────────────────────────────────────────────────
// THE BLUEPRINT
// ─────────────────────────────────────────────────────────────────────────────
export interface TrainingSceneBlueprint {
  // ── Identity ───────────────────────────────────────────────
  id: string;
  name: string;
  /** One-line description shown on cards. */
  description: string;
  /** Long prompt that places the subject inside the scene (sent to
   *  hollywood-pipeline). Mirrors EnvironmentBlueprint.generatorPrompt. */
  generatorPrompt: string;
  image: string;

  // ── Categorization ─────────────────────────────────────────
  world: SceneWorld;
  mood: string;
  tags?: string[];

  // ── Discovery ──────────────────────────────────────────────
  isFeatured?: boolean;
  isPopular?: boolean;
  isNew?: boolean;

  // ── Lighting + style ───────────────────────────────────────
  lighting: SceneLightingMood;
  timeOfDay: SceneTimeOfDay;
  temperature: SceneTemperature;
  productionTier: ProductionTier;

  // ── Color palette (3 hex values shown on the card hover) ──
  colorPalette: { primary: string; secondary: string; accent: string };

  // ── Pairing hints ─────────────────────────────────────────
  /** Voice persona groups that pair beautifully with this scene. */
  voicePairings: VoicePersonaGroup[];
  /** Use cases this scene is great for. */
  useCases: VoiceUseCase[];
}
