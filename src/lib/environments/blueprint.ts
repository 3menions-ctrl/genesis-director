/**
 * EnvironmentBlueprint — the unified rich environment schema.
 *
 * Replaces the metadata-only preset arrays (BASE_PRESETS + EXTENDED_ENVIRONMENTS)
 * with one rich type that carries everything the Studio needs to apply an
 * environment to a project: lighting, color palette, generator prompt,
 * camera + lens hint, sound profile, weather + season + terrain tags,
 * VFX presets, world taxonomy, and companion templates.
 *
 * Consumers:
 *   - Environments page card grid + editorial rails
 *   - EnvironmentDetailDrawer
 *   - useTemplateEnvironment hook (reads the blueprint for /create?environment=)
 *   - Studio scene composer (lighting + palette + prompt tail injection)
 */

import type { LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Lighting taxonomy (re-uses the same vocab the existing presets use)
// ─────────────────────────────────────────────────────────────────────────────
export type LightingType =
  | "natural" | "artificial" | "fire" | "filtered" | "mixed";

export type LightingDirection =
  | "backlit" | "overhead" | "low_angle" | "side" | "multi"
  | "ambient" | "diffused" | "scattered" | "filtered" | "below" | "even";

export type LightingIntensity =
  | "soft" | "dappled" | "warm" | "harsh" | "vibrant"
  | "low" | "bright" | "moody" | "dramatic" | "ethereal" | "glowing" | "flat";

export type LightingTemperature =
  | "warm" | "cool" | "very_warm" | "very_cool" | "neutral"
  | "desaturated" | "mixed";

export type TimeOfDay =
  | "golden_hour" | "blue_hour" | "twilight"
  | "dawn" | "sunrise" | "morning" | "midday" | "afternoon"
  | "sunset" | "evening" | "night"
  | "overcast" | "space" | "controlled";

export interface LightingProfile {
  type: LightingType;
  direction: LightingDirection;
  intensity: LightingIntensity;
  temperature: LightingTemperature;
  timeOfDay: TimeOfDay;
}

// ─────────────────────────────────────────────────────────────────────────────
// Color palette (preserved 4-stop shape)
// ─────────────────────────────────────────────────────────────────────────────
export interface EnvColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  shadows: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// World taxonomy — replaces flat interior/exterior with 9 thematic worlds
// for the editorial rails view. Interior/exterior is still kept as a
// secondary axis for filtering.
// ─────────────────────────────────────────────────────────────────────────────
export type EnvWorld =
  | "golden-hour"        // warm magic, sunset, sunrise
  | "blue-hour"          // twilight, dawn, evening
  | "night-neon"         // night + artificial light, cyberpunk
  | "storm-weather"      // overcast, fog, rain, snow, storm
  | "wilderness"         // nature, forest, mountain, desert, jungle
  | "urban"              // cities, architecture, streets
  | "interiors"          // indoor spaces
  | "surreal"            // dreamy, ethereal, mystical, otherworldly
  | "cosmic";            // space, underwater, abstract void

export const ENV_WORLD_LABELS: Record<EnvWorld, string> = {
  "golden-hour":   "Golden Hour & Magic Light",
  "blue-hour":     "Blue Hour & Twilight",
  "night-neon":    "Night & Neon",
  "storm-weather": "Storm & Weather",
  "wilderness":    "Wilderness & Nature",
  "urban":         "Urban & Architecture",
  "interiors":     "Interiors",
  "surreal":       "Surreal & Otherworldly",
  "cosmic":        "Cosmic & Space",
};

export const ENV_WORLD_SHORT: Record<EnvWorld, string> = {
  "golden-hour":   "Golden Hour",
  "blue-hour":     "Blue Hour",
  "night-neon":    "Night & Neon",
  "storm-weather": "Storm & Weather",
  "wilderness":    "Wilderness",
  "urban":         "Urban",
  "interiors":     "Interiors",
  "surreal":       "Surreal",
  "cosmic":        "Cosmic",
};

// ─────────────────────────────────────────────────────────────────────────────
// Weather / season / terrain — atmospheric metadata for richer filtering
// ─────────────────────────────────────────────────────────────────────────────
export type Weather =
  | "clear" | "overcast" | "fog" | "rain" | "storm" | "snow"
  | "mist" | "haze" | "wind" | "still"
  | "controlled"; // for interiors / studios

export const WEATHER_LABELS: Record<Weather, string> = {
  clear: "Clear", overcast: "Overcast", fog: "Fog", rain: "Rain", storm: "Storm",
  snow: "Snow", mist: "Mist", haze: "Haze", wind: "Wind", still: "Still",
  controlled: "Controlled",
};

export type Season = "spring" | "summer" | "autumn" | "winter" | "perennial";

export const SEASON_LABELS: Record<Season, string> = {
  spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter",
  perennial: "All seasons",
};

export type Terrain =
  | "forest" | "mountain" | "desert" | "tundra" | "jungle"
  | "coast" | "ocean" | "river" | "lake" | "wetland" | "cave"
  | "city" | "rooftop" | "alley" | "interior" | "stage"
  | "field" | "garden" | "underwater" | "space" | "void";

export const TERRAIN_LABELS: Record<Terrain, string> = {
  forest: "Forest", mountain: "Mountain", desert: "Desert", tundra: "Tundra",
  jungle: "Jungle", coast: "Coast", ocean: "Ocean", river: "River", lake: "Lake",
  wetland: "Wetland", cave: "Cave", city: "City", rooftop: "Rooftop", alley: "Alley",
  interior: "Interior", stage: "Stage", field: "Field", garden: "Garden",
  underwater: "Underwater", space: "Space", void: "Void",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sound profile — ambient bed + suggested music mood
// ─────────────────────────────────────────────────────────────────────────────
export type AmbientBed =
  | "forest-birds" | "ocean-waves" | "city-traffic" | "rain-soft" | "rain-heavy"
  | "wind-howling" | "fire-crackle" | "river-flow" | "crowd-distant"
  | "neon-buzz" | "subway-rumble" | "interior-room-tone"
  | "underwater" | "space-hum" | "thunder-distant" | "snow-quiet"
  | "cafe-chatter" | "night-crickets" | "silence";

export const AMBIENT_LABELS: Record<AmbientBed, string> = {
  "forest-birds":        "Forest · birds",
  "ocean-waves":         "Ocean · waves",
  "city-traffic":        "City · traffic",
  "rain-soft":           "Rain · soft",
  "rain-heavy":          "Rain · heavy",
  "wind-howling":        "Wind · howling",
  "fire-crackle":        "Fire · crackle",
  "river-flow":          "River · flow",
  "crowd-distant":       "Crowd · distant",
  "neon-buzz":           "Neon · buzz",
  "subway-rumble":       "Subway · rumble",
  "interior-room-tone":  "Room tone",
  "underwater":          "Underwater",
  "space-hum":           "Space · hum",
  "thunder-distant":     "Thunder · distant",
  "snow-quiet":          "Snow · hush",
  "cafe-chatter":        "Cafe · chatter",
  "night-crickets":      "Night · crickets",
  "silence":             "Silence",
};

export type MusicMoodHint =
  | "cinematic-warm" | "cinematic-cold" | "synth-noir" | "ambient-pad"
  | "documentary-piano" | "trap-banger" | "lofi-chill" | "orchestral-epic"
  | "vintage-jazz" | "tribal-organic" | "indie-uplifting" | "horror-tense"
  | "none";

export const MUSIC_HINT_LABELS: Record<MusicMoodHint, string> = {
  "cinematic-warm":     "Cinematic warm",
  "cinematic-cold":     "Cinematic cold",
  "synth-noir":         "Synth noir",
  "ambient-pad":        "Ambient pad",
  "documentary-piano":  "Documentary piano",
  "trap-banger":        "Trap banger",
  "lofi-chill":         "Lo-fi chill",
  "orchestral-epic":    "Orchestral epic",
  "vintage-jazz":       "Vintage jazz",
  "tribal-organic":     "Tribal organic",
  "indie-uplifting":    "Indie uplifting",
  "horror-tense":       "Horror tense",
  "none":               "Silent",
};

export interface SoundProfile {
  ambient: AmbientBed;
  musicHint: MusicMoodHint;
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera + lens hint — what kind of cinematography this environment loves
// ─────────────────────────────────────────────────────────────────────────────
export type CameraMovement =
  | "static" | "handheld" | "dolly-push" | "dolly-back" | "tracking"
  | "crane-up" | "crane-down" | "orbit" | "whip-pan" | "drone-aerial";

export const CAMERA_MOVEMENT_LABELS: Record<CameraMovement, string> = {
  "static":         "Static",
  "handheld":       "Handheld",
  "dolly-push":     "Dolly push-in",
  "dolly-back":     "Dolly back",
  "tracking":       "Tracking",
  "crane-up":       "Crane up",
  "crane-down":     "Crane down",
  "orbit":          "Orbit",
  "whip-pan":       "Whip pan",
  "drone-aerial":   "Drone aerial",
};

export type LensHint =
  | "wide-14"      // ultra-wide / establishing
  | "wide-24"      // wide / context
  | "normal-35"    // normal / documentary
  | "normal-50"    // 50mm / natural
  | "portrait-85"  // portrait / intimate
  | "tele-135"     // telephoto / compressed
  | "macro";       // macro / detail

export const LENS_LABELS: Record<LensHint, string> = {
  "wide-14":     "14mm · ultra-wide",
  "wide-24":     "24mm · wide",
  "normal-35":   "35mm · documentary",
  "normal-50":   "50mm · natural",
  "portrait-85": "85mm · portrait",
  "tele-135":    "135mm · telephoto",
  "macro":       "Macro · detail",
};

export interface CameraHint {
  movement: CameraMovement;
  lens: LensHint;
  /** Optional note like "shoot anamorphic" or "high contrast B&W". */
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VFX hints — recommended optical / atmospheric VFX for this environment
// ─────────────────────────────────────────────────────────────────────────────
export type EnvVfxHint =
  | "lens-flare" | "god-rays" | "haze" | "depth-blur" | "bokeh"
  | "rim-light" | "neon-glow" | "scanline" | "chromatic-aberration"
  | "vintage-grain" | "anamorphic-stretch" | "smoke" | "particles"
  | "snow-flakes" | "rain-streaks" | "fog-roll" | "heat-shimmer";

export const ENV_VFX_LABELS: Record<EnvVfxHint, string> = {
  "lens-flare":         "Lens flare",
  "god-rays":           "God rays",
  "haze":               "Atmospheric haze",
  "depth-blur":         "Depth blur",
  "bokeh":              "Bokeh",
  "rim-light":          "Rim light",
  "neon-glow":          "Neon glow",
  "scanline":           "Scanline",
  "chromatic-aberration":"Chromatic aberration",
  "vintage-grain":      "Vintage grain",
  "anamorphic-stretch": "Anamorphic stretch",
  "smoke":              "Smoke",
  "particles":          "Particles",
  "snow-flakes":        "Snow",
  "rain-streaks":       "Rain streaks",
  "fog-roll":           "Fog roll",
  "heat-shimmer":       "Heat shimmer",
};

// ─────────────────────────────────────────────────────────────────────────────
// THE BLUEPRINT
// ─────────────────────────────────────────────────────────────────────────────
export interface EnvironmentBlueprint {
  // ── Identity ─────────────────────────────────────────────
  id: string;
  name: string;
  description: string;
  image: string;
  icon: LucideIcon;

  // ── Categorization ───────────────────────────────────────
  /** Primary interior/exterior axis (preserved). */
  category: "interior" | "exterior";
  /** New 9-world editorial taxonomy. */
  world: EnvWorld;
  /** Freeform mood ("dreamy", "epic", "intimate", "noir", …). */
  mood: string;
  tags?: string[];

  // ── Discovery flags ──────────────────────────────────────
  isTrending?: boolean;
  isPopular?: boolean;
  isNew?: boolean;
  useCount?: number;

  // ── Lighting + palette ───────────────────────────────────
  lighting: LightingProfile;
  colorPalette: EnvColorPalette;

  // ── Atmospheric metadata ─────────────────────────────────
  weather: Weather;
  season: Season;
  terrain: Terrain;

  // ── Generation ───────────────────────────────────────────
  /** Text appended to scene prompts when this environment is active.
   *  E.g. "warm golden-hour sun, soft backlit haze, lens flares" */
  generatorPrompt: string;
  /** Optional sample video URL (mp4/webm). When provided the drawer
   *  uses this instead of the static image for the hero. */
  sampleVideoUrl?: string;

  // ── Production hints ─────────────────────────────────────
  camera: CameraHint;
  sound: SoundProfile;
  vfxHints: EnvVfxHint[];

  // ── Chaining (forward-compat for Phase 3) ────────────────
  companionTemplates?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers
// ─────────────────────────────────────────────────────────────────────────────
export function vfxCount(bp: EnvironmentBlueprint): number {
  return bp.vfxHints.length;
}

/** Sort key: trending → popular → name. */
export function defaultEnvSort(a: EnvironmentBlueprint, b: EnvironmentBlueprint): number {
  if (a.isTrending && !b.isTrending) return -1;
  if (!a.isTrending && b.isTrending) return 1;
  if (a.isPopular && !b.isPopular) return -1;
  if (!a.isPopular && b.isPopular) return 1;
  return a.name.localeCompare(b.name);
}
