/**
 * Environment registry — single rich source of truth for all 120 environments.
 *
 * Wraps the two legacy arrays (BASE_PRESETS + EXTENDED_ENVIRONMENTS) and
 * enriches every row with:
 *   - world (9-way thematic taxonomy)
 *   - weather, season, terrain
 *   - generatorPrompt — phrased as a SCENE the subject inhabits
 *     ("Subject standing in golden-hour light spilling across …")
 *     NOT a free-floating backdrop description.
 *   - cameraHint (movement + lens, how to shoot the subject in the scene)
 *   - soundProfile (ambient bed + suggested music mood)
 *   - vfxHints (how the environment interacts with the subject)
 *
 * The enrichment is deterministic — same input always produces the
 * same blueprint, so consumers can cache on id without invalidation.
 */

import type { LucideIcon } from "lucide-react";
import { BASE_PRESETS } from "@/data/environment-base";
import { EXTENDED_ENVIRONMENTS, type ExtendedEnvironment } from "@/data/environment-extensions";
import {
  type EnvironmentBlueprint,
  type EnvWorld,
  type Weather,
  type Season,
  type Terrain,
  type AmbientBed,
  type MusicMoodHint,
  type CameraMovement,
  type LensHint,
  type EnvVfxHint,
  type TimeOfDay,
  type LightingType,
  type LightingDirection,
  type LightingIntensity,
  type LightingTemperature,
} from "./blueprint";

// ─────────────────────────────────────────────────────────────────────────────
// World classifier — maps existing fields to the new 9-way taxonomy
// ─────────────────────────────────────────────────────────────────────────────
function classifyWorld(env: ExtendedEnvironment): EnvWorld {
  const tod = env.lighting.timeOfDay as TimeOfDay;
  const ltype = env.lighting.type as LightingType;
  const mood = env.mood.toLowerCase();
  const name = env.name.toLowerCase();
  const intensity = env.lighting.intensity as LightingIntensity;

  // Cosmic — explicit space references
  if (tod === "space" || /space|cosmic|nebula|orbital|galaxy/.test(name)) return "cosmic";

  // Cosmic adjacent — underwater dreams reads as otherworldly
  if (/underwater|abyss|deep[- ]sea|coral|reef/.test(name)) return "cosmic";

  // Storm & weather
  if (
    tod === "overcast"
    || /storm|fog|misty|monsoon|rain|snowfield|tundra|blizzard/.test(name)
    || (intensity === "moody" && (env.lighting.temperature as LightingTemperature) === "desaturated")
  ) return "storm-weather";

  // Surreal — explicit ethereal/dreamy/magical/divine moods
  if (/ethereal|dreamy|magical|mystical|surreal|divine|enchant|aurora|cloud nine|nebula/.test(mood + " " + name)) return "surreal";

  // Night-neon — night + artificial light, or explicit neon/arcade names
  if (
    (tod === "night" && (ltype === "artificial" || ltype === "mixed"))
    || /neon|cyberpunk|arcade|las vegas|tokyo|miami|nightclub/.test(name)
  ) return "night-neon";

  // Interiors — explicit interior category + controlled/even/professional lighting
  if (env.category === "interior") {
    // Some interiors are still themed worlds (cozy_cabin → cozy interior, retro_arcade → night-neon already caught)
    if (/cabin|loft|library|warehouse|hotel|gallery|kitchen|bedroom|bath|cafe|jazz|gym|theatre|barbershop|tattoo|studio|lab|stage|chamber|sanctum|shrine/.test(name)) return "interiors";
    return "interiors";
  }

  // Golden hour — explicit golden_hour, sunset, sunrise
  if (tod === "golden_hour" || tod === "sunset" || tod === "sunrise") return "golden-hour";

  // Blue hour — blue_hour, twilight, dawn, evening
  if (tod === "blue_hour" || tod === "twilight" || tod === "dawn" || tod === "evening") return "blue-hour";

  // Urban — city/street/architecture names on exteriors
  if (
    /city|urban|street|skyline|rooftop|alley|subway|highway|metro|bridge|harbor|port|industrial|brutalist|favela/.test(name)
  ) return "urban";

  // Default exterior → wilderness
  return "wilderness";
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather classifier
// ─────────────────────────────────────────────────────────────────────────────
function classifyWeather(env: ExtendedEnvironment): Weather {
  const tod = env.lighting.timeOfDay as TimeOfDay;
  const name = env.name.toLowerCase();
  const mood = env.mood.toLowerCase();
  const intensity = env.lighting.intensity as LightingIntensity;

  if (env.category === "interior" || tod === "controlled" || tod === "space") return "controlled";
  if (/storm|hurricane|monsoon/.test(name + " " + mood)) return "storm";
  if (/snow|blizzard|tundra|ice/.test(name)) return "snow";
  if (/fog|misty/.test(name + " " + mood)) return "fog";
  if (/rain/.test(name + " " + mood)) return "rain";
  if (/mist|hazy/.test(name + " " + mood)) return "mist";
  if (tod === "overcast" || intensity === "moody") return "overcast";
  if (/desert|dune|savanna|tropical|paradise/.test(name)) return "clear";
  if (/wind|gale/.test(name + " " + mood)) return "wind";
  if (env.lighting.direction === "diffused") return "haze";
  return "clear";
}

// ─────────────────────────────────────────────────────────────────────────────
// Season classifier — best guess from name + temperature
// ─────────────────────────────────────────────────────────────────────────────
function classifySeason(env: ExtendedEnvironment): Season {
  const name = env.name.toLowerCase();
  const temp = env.lighting.temperature as LightingTemperature;

  if (/cherry blossom|spring|lavender|tulip|bloom/.test(name)) return "spring";
  if (/snow|aurora|arctic|tundra|ice|winter|glacier/.test(name)) return "winter";
  if (/autumn|fall|harvest|maple|amber/.test(name)) return "autumn";
  if (/desert|tropical|paradise|summer|sahara|savanna|beach/.test(name)) return "summer";
  if (temp === "very_cool") return "winter";
  return "perennial";
}

// ─────────────────────────────────────────────────────────────────────────────
// Terrain classifier — best guess from name + category
// ─────────────────────────────────────────────────────────────────────────────
function classifyTerrain(env: ExtendedEnvironment): Terrain {
  const name = env.name.toLowerCase();
  if (env.category === "interior") {
    if (/studio|stage|theatre|theater/.test(name)) return "stage";
    return "interior";
  }
  // Exteriors
  if (/forest|woodland|pine|redwood|sequoia|jungle/.test(name)) return /jungle/.test(name) ? "jungle" : "forest";
  if (/mountain|summit|peak|alps|sierra|himalaya/.test(name)) return "mountain";
  if (/desert|dune|sahara/.test(name)) return "desert";
  if (/tundra|arctic|polar|antarc|glacier/.test(name)) return "tundra";
  if (/ocean|sea|reef|beach|shore|coast/.test(name)) return /reef|underwater/.test(name) ? "underwater" : (/beach|shore|coast/.test(name) ? "coast" : "ocean");
  if (/lake|lagoon|pond/.test(name)) return "lake";
  if (/river|stream|creek|waterfall/.test(name)) return "river";
  if (/wetland|swamp|marsh|bayou/.test(name)) return "wetland";
  if (/cave|grotto|cavern/.test(name)) return "cave";
  if (/rooftop|skyline/.test(name)) return "rooftop";
  if (/alley|street/.test(name)) return "alley";
  if (/city|urban|metro|downtown|times square/.test(name)) return "city";
  if (/field|meadow|prairie|plain|savanna/.test(name)) return "field";
  if (/garden|park/.test(name)) return "garden";
  if (/space|orbital|nebula|galaxy/.test(name)) return "space";
  if (/void|black/.test(name) && /studio|paint/.test(name)) return "void";
  return "field";
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient bed + music hint
// ─────────────────────────────────────────────────────────────────────────────
function classifyAmbient(env: ExtendedEnvironment, world: EnvWorld, terrain: Terrain): AmbientBed {
  const name = env.name.toLowerCase();
  if (terrain === "underwater") return "underwater";
  if (terrain === "space") return "space-hum";
  if (terrain === "forest" || terrain === "jungle") return "forest-birds";
  if (terrain === "ocean" || terrain === "coast") return "ocean-waves";
  if (terrain === "city" || terrain === "alley" || terrain === "rooftop") return /night/.test(name) ? "neon-buzz" : "city-traffic";
  if (terrain === "tundra" || /snow|arctic|glacier/.test(name)) return "snow-quiet";
  if (/rain/.test(name)) return "rain-soft";
  if (/storm|thunder/.test(name)) return "thunder-distant";
  if (/cabin|fire|hearth|volcanic/.test(name)) return "fire-crackle";
  if (terrain === "river" || terrain === "lake" || terrain === "wetland") return "river-flow";
  if (env.category === "interior") return /cafe|jazz|bar|lounge/.test(name) ? "cafe-chatter" : "interior-room-tone";
  if (world === "night-neon") return "neon-buzz";
  if (world === "blue-hour" || world === "golden-hour") return /field|meadow|garden|park/.test(terrain) ? "night-crickets" : "wind-howling";
  return "silence";
}

function classifyMusicHint(env: ExtendedEnvironment, world: EnvWorld): MusicMoodHint {
  const mood = env.mood.toLowerCase();
  if (world === "night-neon") return "synth-noir";
  if (world === "cosmic") return "ambient-pad";
  if (world === "surreal") return "ambient-pad";
  if (world === "storm-weather") return "horror-tense";
  if (world === "wilderness") return "tribal-organic";
  if (world === "urban") return /luxury|glam/.test(mood) ? "cinematic-warm" : "synth-noir";
  if (world === "interiors") return /jazz|cafe|bar|bedroom/.test(env.name.toLowerCase()) ? "vintage-jazz" : "documentary-piano";
  if (world === "golden-hour") return /epic|grand|majestic/.test(mood) ? "orchestral-epic" : "cinematic-warm";
  if (world === "blue-hour") return "cinematic-cold";
  return "ambient-pad";
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera movement + lens hint
// ─────────────────────────────────────────────────────────────────────────────
function classifyCamera(env: ExtendedEnvironment, world: EnvWorld, terrain: Terrain): { movement: CameraMovement; lens: LensHint } {
  // Exterior wilderness / mountain / desert → wide drone / crane up
  if (world === "wilderness" && (terrain === "mountain" || terrain === "desert" || terrain === "tundra")) {
    return { movement: "drone-aerial", lens: "wide-14" };
  }
  if (world === "wilderness") return { movement: "tracking", lens: "wide-24" };

  // Urban → tracking 35mm
  if (world === "urban") return { movement: "tracking", lens: "normal-35" };

  // Night-neon → handheld 35mm
  if (world === "night-neon") return { movement: "handheld", lens: "normal-35" };

  // Cosmic → static / dolly-back 24mm
  if (world === "cosmic") return { movement: "dolly-back", lens: "wide-24" };

  // Storm & weather → tracking / handheld 24mm
  if (world === "storm-weather") return { movement: "handheld", lens: "wide-24" };

  // Surreal → orbit / dolly-push 50mm
  if (world === "surreal") return { movement: "orbit", lens: "normal-50" };

  // Interiors → dolly-push 35mm
  if (world === "interiors") return { movement: "dolly-push", lens: "normal-35" };

  // Golden hour → dolly-back wide
  if (world === "golden-hour") return { movement: "dolly-back", lens: "wide-24" };

  // Blue hour → static crane-up
  if (world === "blue-hour") return { movement: "crane-up", lens: "normal-35" };

  return { movement: "tracking", lens: "normal-35" };
}

// ─────────────────────────────────────────────────────────────────────────────
// VFX hints — what optical / atmospheric VFX this scene naturally has
// ─────────────────────────────────────────────────────────────────────────────
function classifyVfx(env: ExtendedEnvironment, world: EnvWorld, weather: Weather): EnvVfxHint[] {
  const hints: EnvVfxHint[] = [];
  const intensity = env.lighting.intensity as LightingIntensity;
  const direction = env.lighting.direction as LightingDirection;

  if (direction === "backlit") hints.push("rim-light", "lens-flare");
  if (direction === "scattered" || direction === "filtered" || direction === "diffused") hints.push("god-rays");
  if (intensity === "ethereal" || intensity === "glowing") hints.push("god-rays", "haze");
  if (intensity === "soft" || intensity === "dappled") hints.push("depth-blur", "bokeh");
  if (world === "night-neon") hints.push("neon-glow", "chromatic-aberration");
  if (world === "cosmic") hints.push("particles", "lens-flare");
  if (world === "surreal") hints.push("haze", "bokeh");
  if (weather === "fog" || weather === "mist") hints.push("fog-roll", "haze");
  if (weather === "rain") hints.push("rain-streaks");
  if (weather === "snow") hints.push("snow-flakes", "haze");
  if (weather === "storm") hints.push("rain-streaks", "fog-roll");
  if (world === "storm-weather") hints.push("haze", "vintage-grain");
  if (intensity === "harsh") hints.push("heat-shimmer", "anamorphic-stretch");
  if (env.category === "interior" && (env.lighting.type as LightingType) === "fire") hints.push("smoke", "rim-light");
  if (world === "urban" && weather === "rain") hints.push("rain-streaks", "neon-glow");

  // De-dupe and cap at 5
  return Array.from(new Set(hints)).slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Generator prompt — phrases the env as a SCENE the subject inhabits
// ─────────────────────────────────────────────────────────────────────────────
function buildGeneratorPrompt(env: ExtendedEnvironment, world: EnvWorld, terrain: Terrain, weather: Weather): string {
  const todPhrase: Record<TimeOfDay, string> = {
    golden_hour: "warm golden-hour light spilling across the scene",
    blue_hour:   "soft blue-hour ambient light",
    twilight:    "deep twilight gradient",
    dawn:        "cool dawn light just lifting",
    sunrise:     "burning sunrise glow on the horizon",
    morning:     "fresh morning light",
    midday:      "bright midday sun",
    afternoon:   "warm afternoon light",
    sunset:      "rich sunset rim of warm color",
    evening:     "warm evening light fading",
    night:       "deep night with low-key light",
    overcast:    "flat overcast sky",
    space:       "vacuum-black void with directional starlight",
    controlled:  "carefully controlled key + fill lighting",
  };

  const dirPhrase: Record<LightingDirection, string> = {
    backlit:   "backlit silhouette",
    overhead:  "overhead key",
    low_angle: "low-angle key catching the face",
    side:      "side key sculpting the profile",
    multi:     "multi-source neon wash",
    ambient:   "ambient wrap-around fill",
    diffused:  "soft diffused light",
    scattered: "scattered shafts of light",
    filtered:  "filtered light through canopy / mesh",
    below:     "uplight from below",
    even:      "even key + fill",
  };

  const lightingType = env.lighting.type as LightingType;
  const direction = env.lighting.direction as LightingDirection;
  const tod = env.lighting.timeOfDay as TimeOfDay;

  // Subject placement varies by terrain
  const subjectPlacement: Record<Terrain, string> = {
    forest:     "Subject standing among",
    mountain:   "Subject on the ridge of",
    desert:     "Subject silhouetted against",
    tundra:     "Subject crossing",
    jungle:     "Subject deep inside",
    coast:      "Subject at the edge of",
    ocean:      "Subject on the surface above",
    river:      "Subject beside",
    lake:       "Subject reflected over",
    wetland:    "Subject wading through",
    cave:       "Subject framed inside",
    city:       "Subject on the street of",
    rooftop:    "Subject on the rooftop overlooking",
    alley:      "Subject down the alley of",
    interior:   "Subject inside",
    stage:      "Subject lit on",
    field:      "Subject standing in",
    garden:     "Subject in",
    underwater: "Subject suspended in",
    space:      "Subject floating in",
    void:       "Subject isolated in",
  };

  const placement = subjectPlacement[terrain];
  const setting = env.description.replace(/^[A-Z]/, c => c.toLowerCase()).replace(/\.$/, "");
  const lightingClause = `${todPhrase[tod]}, ${dirPhrase[direction]}`;

  const weatherClause =
    weather === "fog"   ? ", rolling fog wrapping the scene" :
    weather === "mist"  ? ", soft mist drifting across" :
    weather === "rain"  ? ", rain falling steadily" :
    weather === "snow"  ? ", snowflakes drifting through frame" :
    weather === "storm" ? ", storm clouds and rain in the distance" :
    weather === "haze"  ? ", atmospheric haze softening depth" :
    "";

  const moodClause = ` — ${env.mood} cinematic atmosphere`;

  // Final composed prompt
  return `${placement} ${setting}, ${lightingClause}${weatherClause}${moodClause}. The subject is fully present in this scene — not a backdrop, but a location they inhabit. ${lightingType === "fire" ? "Practical firelight casting flicker." : ""}`.trim().replace(/\s+/g, " ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a single blueprint from a legacy preset row
// ─────────────────────────────────────────────────────────────────────────────
function buildBlueprint(env: ExtendedEnvironment): EnvironmentBlueprint {
  const world = classifyWorld(env);
  const weather = classifyWeather(env);
  const season = classifySeason(env);
  const terrain = classifyTerrain(env);
  const camera = classifyCamera(env, world, terrain);
  const sound = {
    ambient: classifyAmbient(env, world, terrain),
    musicHint: classifyMusicHint(env, world),
  };
  const vfxHints = classifyVfx(env, world, weather);
  const generatorPrompt = buildGeneratorPrompt(env, world, terrain, weather);

  return {
    id: env.id,
    name: env.name,
    description: env.description,
    image: env.image,
    icon: env.icon as LucideIcon,
    category: env.category,
    world,
    mood: env.mood,
    isTrending: env.is_trending,
    isPopular: env.is_popular,
    useCount: 0,
    lighting: {
      type: env.lighting.type as LightingType,
      direction: env.lighting.direction as LightingDirection,
      intensity: env.lighting.intensity as LightingIntensity,
      temperature: env.lighting.temperature as LightingTemperature,
      timeOfDay: env.lighting.timeOfDay as TimeOfDay,
    },
    colorPalette: env.colorPalette,
    weather,
    season,
    terrain,
    generatorPrompt,
    camera,
    sound,
    vfxHints,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export const ENVIRONMENT_BLUEPRINTS: EnvironmentBlueprint[] = [
  ...BASE_PRESETS.map(buildBlueprint),
  ...EXTENDED_ENVIRONMENTS.map(buildBlueprint),
];

export function getAllEnvironmentBlueprints(): EnvironmentBlueprint[] {
  return ENVIRONMENT_BLUEPRINTS;
}

export function getEnvironmentBlueprint(id: string): EnvironmentBlueprint | undefined {
  return ENVIRONMENT_BLUEPRINTS.find(b => b.id === id);
}

/** Group blueprints by world for the editorial rails view. */
export function groupByWorld(blueprints: EnvironmentBlueprint[]): Record<EnvWorld, EnvironmentBlueprint[]> {
  const groups = {} as Record<EnvWorld, EnvironmentBlueprint[]>;
  for (const bp of blueprints) {
    if (!groups[bp.world]) groups[bp.world] = [];
    groups[bp.world].push(bp);
  }
  return groups;
}
