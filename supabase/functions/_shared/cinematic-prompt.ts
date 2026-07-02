// ============================================================================
// cinematic-prompt.ts — turn a shot into DIRECTION, not quality-word soup.
//
// WHY THIS EXISTS (evidence, 2026-07-02):
//   The live render prompt for every clip was:
//     "[═══ PRIMARY SUBJECT ═══] <user sentence>. Clip 1 of 2.
//      [═══ END ═══], cinematic lighting, 8K resolution, ultra high
//      definition, ... award-winning cinematographer, ARRI Alexa camera
//      quality, anamorphic lens flares, perfect exposure, ..."
//   Two failures:
//     1. The suffix is 2022-era Stable-Diffusion incantation soup. Modern
//        video models (kling v3, seedance 2.0, wan 2.5, sora 2, veo 3)
//        respond to CONCRETE cinematography — shot size, camera move, lens,
//        lighting design, palette, atmosphere — not adjective stacking.
//        "anamorphic lens flares" was requested on EVERY render.
//     2. A multi-shot "film" sent byte-identical prompts per shot (only the
//        "Clip N of M" changed) — no coverage, no arc, no camera language.
//
// This module composes a coherent cinematic description from a structured
// ShotSpec, with PER-ENGINE dialects and length caps. When the upstream
// script is a stub (single sentence, empty fields — the current reality),
// `inferShotSpec` derives sensible cinematography from the sentence itself,
// so quality improves TODAY, before the script stage is fixed.
//
// It is deliberately additive + framework-free (no imports) so it can be
// unit-tested and A/B-rendered in isolation before touching the live path.
// ============================================================================

export type Engine = "kling" | "seedance" | "wan" | "sora" | "veo" | "runway";

export type ShotSize =
  | "extreme-wide" | "wide" | "full" | "medium-wide" | "medium"
  | "medium-close" | "close" | "extreme-close" | "macro";

export type CameraMove =
  | "static" | "pan-left" | "pan-right" | "tilt-up" | "tilt-down"
  | "dolly-in" | "dolly-out" | "tracking" | "crane-up" | "crane-down"
  | "handheld" | "orbit" | "aerial" | "whip-pan" | "push-in" | "pull-out";

export type CameraAngle =
  | "eye-level" | "low-angle" | "high-angle" | "overhead" | "dutch"
  | "worms-eye" | "birds-eye" | "over-the-shoulder";

/** The structured direction a good script stage SHOULD produce per shot.
 *  Every field optional — the compiler fills gaps from inference + defaults. */
export interface ShotSpec {
  /** The literal action/subject the shot must show (the user's sentence, or
   *  a script-authored beat). This is sacred — never dropped or overwritten. */
  action: string;
  shotSize?: ShotSize;
  angle?: CameraAngle;
  move?: CameraMove;
  /** Focal-length feel: "wide" (~24mm), "normal" (~50mm), "tele" (~85mm). */
  lens?: "wide" | "normal" | "tele";
  depthOfField?: "shallow" | "deep";
  /** Lighting design, e.g. "golden-hour backlight", "hard noir key",
   *  "soft overcast", "practical neon". Free text. */
  lighting?: string;
  /** Colour palette / grade intent, e.g. "teal-and-orange", "desaturated
   *  steel", "warm amber". Free text. */
  palette?: string;
  /** Atmosphere/particles: "rain", "fog", "dust motes", "snow", "haze". */
  atmosphere?: string;
  timeOfDay?: string;
  /** One-line style anchor shared across a film so shots feel like one piece.
   *  e.g. "35mm anamorphic, filmic grain, muted naturalistic grade". */
  styleAnchor?: string;
  /** Motion pacing hint for the model: "slow", "steady", "brisk", "frenetic". */
  pacing?: string;
}

// ---------------------------------------------------------------------------
// Inference — derive cinematography from a bare sentence when the script
// stage gave us nothing structured (the current reality).
// ---------------------------------------------------------------------------

const TIME_LIGHTING: Array<[RegExp, { timeOfDay: string; lighting: string; palette: string }]> = [
  [/\b(dawn|sunrise|first light)\b/i, { timeOfDay: "dawn", lighting: "low golden sunrise backlight, long soft shadows", palette: "warm amber and cool shadow" }],
  [/\b(dusk|sunset|golden hour|magic hour)\b/i, { timeOfDay: "dusk", lighting: "golden-hour side light, warm rim on edges", palette: "amber highlights, deep blue shadow" }],
  [/\b(twilight|blue hour)\b/i, { timeOfDay: "blue hour", lighting: "soft ambient blue twilight, faint practicals", palette: "cool teal and magenta" }],
  [/\b(night|midnight|nocturnal|after dark)\b/i, { timeOfDay: "night", lighting: "low-key night lighting, pooled practical sources", palette: "deep shadow with saturated practicals" }],
  [/\b(noon|midday|bright day|daylight)\b/i, { timeOfDay: "day", lighting: "high hard daylight key, crisp shadows", palette: "clean naturalistic daylight" }],
  [/\b(overcast|cloudy|grey sky|foggy morning)\b/i, { timeOfDay: "day", lighting: "soft overcast wrap, low contrast", palette: "desaturated cool grey" }],
];

const ATMOSPHERE_WORDS: Array<[RegExp, string]> = [
  [/\brain(y|-soaked|ing|fall)?\b/i, "falling rain, wet reflective surfaces"],
  [/\b(fog|mist|misty)\b/i, "drifting fog, volumetric depth"],
  [/\bsnow(y|ing|fall)?\b/i, "falling snow, soft diffusion"],
  [/\b(dust|sand)(storm)?\b/i, "airborne dust catching light"],
  [/\b(smoke|smoky|haze|hazy)\b/i, "atmospheric haze, light shafts"],
  [/\b(neon|city lights)\b/i, "glowing neon practicals, wet reflections"],
  [/\b(underwater|ocean depths)\b/i, "caustic light rays, suspended particulate"],
];

const MOVE_WORDS: Array<[RegExp, CameraMove]> = [
  [/\btracking\b/i, "tracking"],
  [/\b(aerial|drone|bird'?s?[- ]eye|from above)\b/i, "aerial"],
  [/\b(dolly|push[- ]?in|move in|creep in)\b/i, "dolly-in"],
  [/\b(pull[- ]?out|zoom out|reveal)\b/i, "pull-out"],
  [/\b(orbit|circling|around the)\b/i, "orbit"],
  [/\b(crane|rising|ascending shot)\b/i, "crane-up"],
  [/\b(pan|sweep|sweeping)\b/i, "pan-right"],
  [/\b(tilt up|looking up)\b/i, "tilt-up"],
  [/\b(handheld|shaky|frantic)\b/i, "handheld"],
];

const SCALE_WORDS: Array<[RegExp, ShotSize]> = [
  [/\b(macro|extreme close|tiny detail)\b/i, "macro"],
  [/\b(close[- ]?up|close on|face)\b/i, "close"],
  [/\b(wide|establishing|vista|landscape|panorama)\b/i, "wide"],
  [/\b(aerial|from above|overhead)\b/i, "wide"],
  [/\b(portrait|medium shot|waist up)\b/i, "medium"],
];

/** Extract implicit cinematography from a bare sentence. Never overrides
 *  fields already present on `partial`. */
export function inferShotSpec(action: string, partial: Partial<ShotSpec> = {}): ShotSpec {
  const spec: ShotSpec = { ...partial, action: action.trim() };
  const hay = action.toLowerCase();

  if (!spec.timeOfDay || !spec.lighting) {
    for (const [re, v] of TIME_LIGHTING) {
      if (re.test(hay)) {
        spec.timeOfDay ??= v.timeOfDay;
        spec.lighting ??= v.lighting;
        spec.palette ??= v.palette;
        break;
      }
    }
  }
  if (!spec.atmosphere) {
    for (const [re, v] of ATMOSPHERE_WORDS) { if (re.test(hay)) { spec.atmosphere = v; break; } }
  }
  if (!spec.move) {
    for (const [re, v] of MOVE_WORDS) { if (re.test(hay)) { spec.move = v; break; } }
  }
  if (!spec.shotSize) {
    for (const [re, v] of SCALE_WORDS) { if (re.test(hay)) { spec.shotSize = v; break; } }
  }

  // Sensible cinematic defaults so a bare sentence still gets DIRECTION.
  spec.shotSize ??= "medium-wide";
  spec.angle ??= "eye-level";
  spec.move ??= "dolly-in"; // a gentle move beats a locked-off static frame
  spec.lens ??= "normal";
  spec.depthOfField ??= "shallow";
  spec.lighting ??= "motivated naturalistic lighting, soft key with gentle rim";
  spec.palette ??= "filmic naturalistic grade, controlled contrast";
  spec.pacing ??= "steady";
  return spec;
}

// ---------------------------------------------------------------------------
// Vocabulary — map enums to natural cinematographer language.
// ---------------------------------------------------------------------------

const SHOT_SIZE_PHRASE: Record<ShotSize, string> = {
  "extreme-wide": "extreme wide establishing shot",
  "wide": "wide shot",
  "full": "full shot",
  "medium-wide": "medium-wide shot",
  "medium": "medium shot",
  "medium-close": "medium close-up",
  "close": "close-up",
  "extreme-close": "extreme close-up",
  "macro": "macro detail shot",
};

const MOVE_PHRASE: Record<CameraMove, string> = {
  "static": "locked-off static frame",
  "pan-left": "smooth pan left",
  "pan-right": "smooth pan right",
  "tilt-up": "slow tilt up",
  "tilt-down": "slow tilt down",
  "dolly-in": "steady dolly in",
  "dolly-out": "steady dolly out",
  "tracking": "tracking shot following the subject",
  "crane-up": "rising crane move",
  "crane-down": "descending crane move",
  "handheld": "handheld with subtle organic sway",
  "orbit": "slow orbit around the subject",
  "aerial": "sweeping aerial drone move",
  "whip-pan": "fast whip pan",
  "push-in": "slow push in",
  "pull-out": "gradual pull out to reveal",
};

const ANGLE_PHRASE: Record<CameraAngle, string> = {
  "eye-level": "eye-level",
  "low-angle": "low angle looking up",
  "high-angle": "high angle looking down",
  "overhead": "top-down overhead",
  "dutch": "canted dutch angle",
  "worms-eye": "worm's-eye view",
  "birds-eye": "bird's-eye view",
  "over-the-shoulder": "over-the-shoulder",
};

const LENS_PHRASE: Record<NonNullable<ShotSpec["lens"]>, string> = {
  wide: "wide 24mm lens",
  normal: "natural 50mm lens",
  tele: "85mm telephoto compression",
};

function normalizeMove(move: string): string {
  // Inference may set a free-text move like "slow dolly-in"; keep as-is if
  // it isn't a known enum key.
  return (MOVE_PHRASE as Record<string, string>)[move] ?? move.replace(/-/g, " ");
}

// ---------------------------------------------------------------------------
// Per-engine quality tail — compact and targeted, NOT the old 15-word soup.
// Each engine gets the direction it actually rewards.
// ---------------------------------------------------------------------------

const QUALITY_TAIL: Record<Engine, string> = {
  // kling v3: rich natural-language cinematography, strong on grade + light.
  kling: "cinematic film look, natural physically-based lighting, crisp detail, stable coherent motion",
  // seedance 2.0: motion-forward; emphasise fluid realistic movement.
  seedance: "hyperreal motion, fluid natural movement, cinematic lighting, sharp detail",
  // wan 2.5: concise; realism + clean render.
  wan: "photorealistic, cinematic lighting, clean sharp render, natural motion",
  // sora 2: narrative + native audio; keep it descriptive, not technical.
  sora: "photoreal cinematic footage, natural lighting and motion",
  // veo 3: cinematic; responds to lighting + camera direction.
  veo: "cinematic footage, natural lighting, filmic depth, smooth motion",
  runway: "cinematic, natural lighting, sharp detail, smooth motion",
};

/** Per-engine soft length ceiling (chars). Beyond this, atmosphere/style
 *  clauses are trimmed before the action. */
const MAX_CHARS: Record<Engine, number> = {
  kling: 1400, seedance: 900, wan: 900, sora: 1600, veo: 1100, runway: 900,
};

// Model-appropriate negatives. Sora/veo take no negative_prompt param, so
// theirs stays empty (over-negation there hurts).
const ENGINE_NEGATIVES: Record<Engine, string[]> = {
  kling: ["warped anatomy", "flicker", "morphing", "duplicated limbs", "text artifacts", "low detail", "washed out"],
  seedance: ["stutter", "frozen frame", "morphing", "warped faces", "low detail"],
  wan: ["blurry", "warped", "flicker", "low detail", "oversaturated"],
  sora: [],
  veo: [],
  runway: ["blurry", "warped", "flicker", "low detail"],
};

// ---------------------------------------------------------------------------
// The compiler.
// ---------------------------------------------------------------------------

export interface CompiledPrompt {
  prompt: string;
  negativePrompt: string;
  /** For logging/telemetry — how the shot was described. */
  debug: { shotClause: string; lightClause: string; engineTail: string };
}

/**
 * Compose an engine-tuned cinematic prompt from a ShotSpec.
 *
 * Structure (what modern video models reward): ACTION first (sacred), then
 * one shot-composition clause, one lighting/atmosphere clause, an optional
 * shared style anchor, then a short engine-specific quality tail. Coherent
 * prose — not a comma salad.
 */
export function compileCinematicPrompt(specIn: ShotSpec, engine: Engine): CompiledPrompt {
  const spec = specIn.shotSize && specIn.lighting ? specIn : inferShotSpec(specIn.action, specIn);

  // 1. Shot-composition clause.
  const shotBits: string[] = [];
  if (spec.shotSize) shotBits.push(SHOT_SIZE_PHRASE[spec.shotSize]);
  if (spec.angle && spec.angle !== "eye-level") shotBits.push(ANGLE_PHRASE[spec.angle]);
  if (spec.move) shotBits.push(normalizeMove(spec.move));
  if (spec.lens) shotBits.push(LENS_PHRASE[spec.lens]);
  if (spec.depthOfField === "shallow") shotBits.push("shallow depth of field");
  else if (spec.depthOfField === "deep") shotBits.push("deep focus");
  const shotClause = shotBits.length ? `Shot: ${shotBits.join(", ")}.` : "";

  // 2. Light / colour / atmosphere clause.
  const lightBits: string[] = [];
  if (spec.lighting) lightBits.push(spec.lighting);
  if (spec.palette) lightBits.push(spec.palette);
  if (spec.atmosphere) lightBits.push(spec.atmosphere);
  const lightClause = lightBits.length ? `${cap(lightBits.join("; "))}.` : "";

  // 3. Motion pacing (seedance/kling especially benefit).
  const pacingClause = spec.pacing && spec.pacing !== "steady"
    ? `${cap(spec.pacing)} pacing.` : "";

  const engineTail = QUALITY_TAIL[engine];
  const styleClause = spec.styleAnchor ? `${cap(spec.styleAnchor)}.` : "";

  // Assemble, action first. Trim style/atmosphere before action if over cap.
  const action = endSentence(spec.action.replace(/\s+/g, " ").trim());
  const ordered = [action, shotClause, lightClause, pacingClause, styleClause, engineTail].filter(Boolean);

  let prompt = ordered.join(" ");
  const cap_ = MAX_CHARS[engine];
  if (prompt.length > cap_) {
    // Drop, in order, the least-critical clauses (style, pacing, atmosphere)
    // — never the action or the engine tail.
    const trimmed = [action, shotClause, lightClause, engineTail].filter(Boolean).join(" ");
    prompt = trimmed.length > cap_ ? `${action} ${engineTail}`.slice(0, cap_) : trimmed;
  }

  return {
    prompt,
    negativePrompt: ENGINE_NEGATIVES[engine].join(", "),
    debug: { shotClause, lightClause, engineTail },
  };
}

function cap(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Terminate the action with sentence punctuation so it doesn't run into the
 *  following clause ("...cinematic Shot:" → "...cinematic. Shot:"). */
function endSentence(s: string): string {
  const t = s.trim().replace(/[,;\s]+$/, "");
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

// ---------------------------------------------------------------------------
// Script bridge — map smart-script-generator's per-shot vocabulary onto a
// ShotSpec. The script (GPT-4o cinematographer) ALREADY authors cameraScale/
// cameraAngle/movementType/motionDirection/lighting per shot; hollywood-
// pipeline historically DROPPED them at the first hop, so this is the missing
// connective tissue between the script's direction and the compiler.
// ---------------------------------------------------------------------------

const SCRIPT_SCALE: Record<string, ShotSize> = {
  "extreme-wide": "extreme-wide", "wide": "wide", "medium-wide": "medium-wide",
  "medium": "medium", "medium-close": "medium-close",
  "close-up": "close", "close": "close", "extreme-close-up": "extreme-close",
  "extreme-close": "extreme-close", "macro": "macro",
};
const SCRIPT_ANGLE: Record<string, CameraAngle> = {
  "eye-level": "eye-level", "low-angle": "low-angle", "high-angle": "high-angle",
  "dutch-angle": "dutch", "dutch": "dutch", "birds-eye": "birds-eye",
  "worms-eye": "worms-eye", "overhead": "overhead", "over-the-shoulder": "over-the-shoulder",
};
const SCRIPT_MOVE: Record<string, CameraMove> = {
  "static": "static", "tracking": "tracking", "dolly-in": "dolly-in",
  "dolly-out": "dolly-out", "orbit": "orbit", "crane": "crane-up",
  "crane-up": "crane-up", "crane-down": "crane-down", "handheld": "handheld",
  "pan-left": "pan-left", "pan-right": "pan-right", "tilt-up": "tilt-up",
  "tilt-down": "tilt-down", "aerial": "aerial", "push-in": "push-in", "pull-out": "pull-out",
};

/** A shot as authored by smart-script-generator (loose — every field optional). */
export interface ScriptShotLike {
  description?: string;
  currentAction?: string;
  cameraScale?: string;
  cameraAngle?: string;
  movementType?: string;
  motionDirection?: string;
  lightingDescription?: string;
  locationDescription?: string;
  mood?: string;
}

/**
 * Build a ShotSpec from an authored script shot. Falls back to sentence
 * inference for any field the script left blank, so a partially-filled shot
 * still yields full direction. `action` prefers the explicit shot text.
 */
export function shotSpecFromScript(
  shot: ScriptShotLike,
  fallbackAction: string,
  styleAnchor?: string,
): ShotSpec {
  const action = (shot.description || shot.currentAction || fallbackAction || "").trim();
  const partial: Partial<ShotSpec> = { styleAnchor };
  if (shot.cameraScale && SCRIPT_SCALE[shot.cameraScale.toLowerCase()]) partial.shotSize = SCRIPT_SCALE[shot.cameraScale.toLowerCase()];
  if (shot.cameraAngle && SCRIPT_ANGLE[shot.cameraAngle.toLowerCase()]) partial.angle = SCRIPT_ANGLE[shot.cameraAngle.toLowerCase()];
  if (shot.movementType && SCRIPT_MOVE[shot.movementType.toLowerCase()]) partial.move = SCRIPT_MOVE[shot.movementType.toLowerCase()];
  if (shot.lightingDescription) partial.lighting = shot.lightingDescription;
  if (shot.motionDirection) partial.pacing = /fast|rapid|quick|frantic|whip/i.test(shot.motionDirection) ? "brisk"
    : /slow|gentle|gradual|creep/i.test(shot.motionDirection) ? "slow" : undefined;
  // inferShotSpec fills every remaining gap (atmosphere from the action, etc.)
  return inferShotSpec(action, partial);
}

/**
 * Convenience for the current stub-script reality: take a bare user sentence
 * + engine, infer cinematography, compile. This is the drop-in that replaces
 * the "sentence + APEX_QUALITY_SUFFIX soup" path.
 */
export function compileFromSentence(
  sentence: string,
  engine: Engine,
  styleAnchor?: string,
): CompiledPrompt {
  const spec = inferShotSpec(sentence, styleAnchor ? { styleAnchor } : {});
  return compileCinematicPrompt(spec, engine);
}
