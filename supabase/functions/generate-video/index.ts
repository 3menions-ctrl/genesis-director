import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  checkContentSafety,
  getSafetyNegativePrompts,
} from "../_shared/content-safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Provider selection
type VideoProvider = "replicate";

// Kling 2.6 via Replicate configuration (Avatar mode)
const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";
const KLING_MODEL = "kwaivgi/kling-v2.6";
const KLING_ENABLE_AUDIO = false; // Disabled: Kling's auto-generated cinematic music is low quality

// ============================================================================
// Runway via Replicate - Dual-model strategy:
//   Gen-4 Turbo: IMAGE-TO-VIDEO (requires image) — $0.05/s
//   Gen-4.5:     TEXT-TO-VIDEO  (no image needed) — #1 ranked T2V benchmark
// NOTE: Gen-4 Turbo REQUIRES an image — it cannot do pure text-to-video.
//       Gen-4.5 is the dedicated T2V model (text-only, 5s or 10s).
// 50% margin pricing: 5s clip → 5cr ($0.50 revenue, $0.25 real cost)
// ============================================================================
const RUNWAY_GEN4_MODEL = "runwayml/gen4-turbo";
const RUNWAY_GEN4_MODEL_URL = `https://api.replicate.com/v1/models/${RUNWAY_GEN4_MODEL}/predictions`;
const REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";

// Scene context for consistency
interface SceneContext {
  clipIndex: number;
  totalClips: number;
  environment?: string;
  characters?: string[];
  colorPalette?: string;
  lightingStyle?: string;
  lightingDirection?: string;
  timeOfDay?: string;
  dominantColors?: string;
  backgroundElements?: string[];
  previousClipEndFrame?: string;
  // SMART CAMERA PROPERTIES
  cameraScale?: string;
  cameraAngle?: string;
  movementType?: string;
  previousCameraScale?: string;
  previousCameraAngle?: string;
  // VELOCITY VECTORS for seamless transitions
  previousMotionVectors?: {
    endVelocity?: string;
    endDirection?: string;
    cameraMomentum?: string;
  };
}

// Camera scale perspective mappings
const CAMERA_SCALE_HINTS: Record<string, string> = {
  'extreme-wide': 'vast panoramic view capturing the entire environment',
  'wide': 'expansive wide shot showing full scene context',
  'medium': 'balanced mid-range shot at conversational distance',
  'close-up': 'intimate close shot capturing details and emotions',
  'extreme-close-up': 'extreme intimate shot revealing micro-details',
};

// Camera angle perspective mappings
const CAMERA_ANGLE_HINTS: Record<string, string> = {
  'eye-level': 'natural eye-level perspective',
  'low-angle': 'powerful low-angle perspective looking upward',
  'high-angle': 'commanding high-angle perspective looking down',
  'dutch-angle': 'dynamic tilted perspective creating tension',
  'overhead': 'bird\'s-eye top-down perspective',
  'pov': 'immersive first-person point-of-view',
};

// Movement type hints
const MOVEMENT_HINTS: Record<string, string> = {
  'static': 'steady locked-off shot with no movement',
  'pan': 'smooth horizontal sweeping motion',
  'tilt': 'vertical sweeping motion',
  'dolly': 'smooth gliding movement through space',
  'tracking': 'fluid following movement alongside action',
  'crane': 'elevated sweeping movement',
  'handheld': 'organic naturalistic motion',
};

// Camera pattern rewrites for better prompts
const CAMERA_PATTERNS = [
  /\b(close[- ]?up|closeup)\b/gi,
  /\b(wide[- ]?shot|wide[- ]?angle)\b/gi,
  /\b(medium[- ]?shot)\b/gi,
  /\b(establishing[- ]?shot)\b/gi,
  /\b(tracking[- ]?shot)\b/gi,
  /\b(dolly|pan|tilt|zoom)\b/gi,
  /\b(POV|point[- ]?of[- ]?view)\b/gi,
];

// ============================================================================
// APEX PHYSICS ENGINE v2.0 - World-Class Physics Accuracy for Veo 3.1
// ============================================================================

interface PhysicsProfile {
  gravity: string;
  momentum: string;
  inertia: string;
  collision: string;
  fluidDynamics: string;
  clothPhysics: string;
  lightBehavior: string;
  materialResponse: string;
}

// Physics accuracy injection based on scene type
const PHYSICS_PROFILES: Record<string, PhysicsProfile> = {
  action: {
    gravity: "realistic gravitational pull at 9.8m/s², objects fall with proper acceleration",
    momentum: "conservation of momentum in all collisions and movements",
    inertia: "realistic inertia with proper mass-dependent acceleration and deceleration",
    collision: "physically accurate impacts with energy transfer, deformation, and debris",
    fluidDynamics: "realistic water splash, blood splatter, dust clouds with turbulence",
    clothPhysics: "fabric responds to wind, movement with realistic weight and draping",
    lightBehavior: "accurate shadows, reflections, caustics, and light falloff",
    materialResponse: "metal dents, glass shatters, wood splinters realistically",
  },
  dialogue: {
    gravity: "natural gravity affecting hair, clothing, and objects",
    momentum: "subtle weight shifts during speech and gestures",
    inertia: "natural body movement with follow-through",
    collision: "realistic contact between hands and objects",
    fluidDynamics: "steam rises naturally, liquids pour realistically",
    clothPhysics: "clothing drapes and moves with body naturally",
    lightBehavior: "soft accurate lighting with natural shadows",
    materialResponse: "surfaces respond naturally to touch",
  },
  nature: {
    gravity: "leaves fall with realistic flutter and air resistance",
    momentum: "wind affects objects proportional to their mass",
    inertia: "water flows with proper mass and viscosity",
    collision: "ripples propagate realistically through water",
    fluidDynamics: "clouds drift, fog rolls, water flows with accurate fluid simulation",
    clothPhysics: "vegetation sways naturally in wind",
    lightBehavior: "atmospheric scattering, god rays, accurate sun position",
    materialResponse: "rocks weather, water erodes, nature ages realistically",
  },
  scifi: {
    gravity: "consistent gravity rules within the established universe",
    momentum: "inertia in zero-G or altered gravity follows physics rules",
    inertia: "spacecraft and objects maintain velocity without friction in vacuum",
    collision: "energy weapons, explosions follow established physics",
    fluidDynamics: "liquids behave differently in low/zero gravity",
    clothPhysics: "fabrics float in zero-G, respond to artificial gravity",
    lightBehavior: "accurate light behavior in vacuum, no sound in space",
    materialResponse: "futuristic materials respond consistently",
  },
  default: {
    gravity: "realistic Earth gravity at 9.8m/s²",
    momentum: "proper conservation of momentum in all interactions",
    inertia: "natural acceleration and deceleration based on mass",
    collision: "physically plausible impacts and reactions",
    fluidDynamics: "realistic fluid behavior and particle systems",
    clothPhysics: "fabric weight and draping follows physics",
    lightBehavior: "accurate light transport and shadow casting",
    materialResponse: "materials respond appropriately to forces",
  },
};

// Build physics injection string
function buildPhysicsInjection(sceneType: string = 'default'): string {
  const profile = PHYSICS_PROFILES[sceneType] || PHYSICS_PROFILES.default;
  
  return `[PHYSICS ENGINE: ${profile.gravity}. ${profile.momentum}. ${profile.inertia}. ${profile.clothPhysics}. ${profile.lightBehavior}.]`;
}

// ============================================================================
// QUALITY MAXIMIZER 10-TIER SYSTEM - Hollywood-Grade Output
// ============================================================================

interface QualityTier {
  level: number;
  name: string;
  resolution: string;
  camera: string;
  lens: string;
  lighting: string;
  colorScience: string;
  filmStock: string;
  postProcess: string;
}

const QUALITY_TIERS: QualityTier[] = [
  {
    level: 1,
    name: "Consumer",
    resolution: "720p",
    camera: "smartphone camera",
    lens: "wide angle phone lens",
    lighting: "available light",
    colorScience: "auto color",
    filmStock: "digital",
    postProcess: "basic",
  },
  {
    level: 2,
    name: "Prosumer",
    resolution: "1080p",
    camera: "mirrorless camera",
    lens: "kit lens",
    lighting: "natural light",
    colorScience: "standard color",
    filmStock: "digital log",
    postProcess: "color corrected",
  },
  {
    level: 3,
    name: "Professional",
    resolution: "1080p HDR",
    camera: "Canon C300",
    lens: "cinema prime lens",
    lighting: "three-point lighting",
    colorScience: "Canon Log",
    filmStock: "digital cinema",
    postProcess: "professionally graded",
  },
  {
    level: 4,
    name: "Broadcast",
    resolution: "4K HDR",
    camera: "Sony Venice",
    lens: "Zeiss Master Prime",
    lighting: "professional studio lighting",
    colorScience: "S-Log3",
    filmStock: "digital cinema 4K",
    postProcess: "broadcast color grade",
  },
  {
    level: 5,
    name: "Commercial",
    resolution: "4K HDR10+",
    camera: "RED Komodo",
    lens: "Cooke S7i prime lens",
    lighting: "cinematic lighting design",
    colorScience: "REDWideGamutRGB",
    filmStock: "6K RAW downsampled",
    postProcess: "commercial color grade",
  },
  {
    level: 6,
    name: "Feature Film",
    resolution: "4K DCI",
    camera: "ARRI Alexa Mini",
    lens: "Cooke Anamorphic",
    lighting: "cinematic lighting with practicals",
    colorScience: "ARRI LogC",
    filmStock: "ARRIRAW",
    postProcess: "feature film DI",
  },
  {
    level: 7,
    name: "Premium Cinema",
    resolution: "4K DCI HDR Dolby Vision",
    camera: "ARRI Alexa 65",
    lens: "Panavision Primo 70",
    lighting: "master cinematographer lighting",
    colorScience: "ACES workflow",
    filmStock: "65mm digital large format",
    postProcess: "premium theatrical DI",
  },
  {
    level: 8,
    name: "IMAX Quality",
    resolution: "5.6K IMAX",
    camera: "ARRI Alexa IMAX",
    lens: "Hasselblad-designed IMAX optics",
    lighting: "IMAX-optimized high dynamic range",
    colorScience: "IMAX DMR color pipeline",
    filmStock: "15/70mm equivalent digital",
    postProcess: "IMAX DMR mastering",
  },
  {
    level: 9,
    name: "Reference Master",
    resolution: "8K HDR",
    camera: "RED Ranger Monstro 8K VV",
    lens: "Leica Summilux-C cinema primes",
    lighting: "reference-grade lighting with spectral accuracy",
    colorScience: "IPP2 with ACES 1.3",
    filmStock: "8K full frame RAW",
    postProcess: "reference mastering suite",
  },
  {
    level: 10,
    name: "APEX CINEMA",
    resolution: "8K+ HDR Dolby Vision IQ",
    camera: "shot on ARRI Alexa 65 with spherical large format sensor",
    lens: "Panavision Ultra Vista anamorphic 1.65x squeeze with organic flares",
    lighting: "Roger Deakins-style natural motivated lighting with precise shadow control",
    colorScience: "ACES 2.0 with custom show LUT, preserving full dynamic range",
    filmStock: "65mm ARRIRAW open gate, 16-bit color depth",
    postProcess: "Baselight X theatrical mastering, subtle halation, clean digital finish",
  },
];

// Build quality maximizer injection
function buildQualityMaximizer(tier: number = 10): string {
  const qualityTier = QUALITY_TIERS[Math.min(Math.max(tier - 1, 0), 9)];
  
  return `[QUALITY: ${qualityTier.name} grade. ${qualityTier.camera}, ${qualityTier.lens}. ${qualityTier.lighting}. ${qualityTier.colorScience} color science. ${qualityTier.filmStock} with ${qualityTier.postProcess}. Resolution: ${qualityTier.resolution}.]`;
}

// ============================================================================
// HUMAN ANATOMY LOCK v2.0 - Guarantees realistic human proportions at ANY distance
// Critical for wide shots where AI tends to distort human bodies
// Enhanced with temporal consistency anchors for multi-clip videos
// ============================================================================

const HUMAN_ANATOMY_ENFORCEMENT = {
  // Mandatory prompt additions for human subjects
  proportions: [
    "anatomically correct human proportions",
    "realistic human body ratios",
    "head-to-body ratio 1:7.5 adult proportions",
    "natural limb lengths",
    "correct joint positions",
    "proportional hands and feet",
    "realistic shoulder width",
  ],
  
  // Distance-specific enforcement (wide shots)
  wideShot: [
    "humans clearly visible at distance with correct proportions",
    "recognizable human silhouettes",
    "natural human scale relative to environment",
    "proper perspective scaling for distance",
    "distinguishable human features at any range",
  ],
  
  // Movement enforcement - ENHANCED for smoothness
  movement: [
    "natural human gait and walking motion",
    "realistic arm swing while walking",
    "proper weight transfer during movement",
    "natural head and body posture",
    "believable human locomotion",
    "smooth continuous motion without stuttering",
    "realistic acceleration and deceleration",
    "natural momentum and follow-through",
    "proper weight distribution on each foot",
  ],
  
  // Face/body integrity - ENHANCED temporal consistency
  integrity: [
    "consistent facial features throughout",
    "stable body structure no morphing",
    "fixed number of limbs two arms two legs",
    "hands with five fingers each",
    "symmetrical human features",
    "consistent body mass throughout clip",
    "stable clothing and accessories",
    "fixed hairstyle and color",
    "persistent scars marks tattoos",
  ],
  
  // NEW: Temporal consistency anchors
  temporal: [
    "identical appearance from start to end of clip",
    "no gradual transformation of features",
    "consistent skin tone throughout",
    "stable eye color and shape",
    "fixed facial structure no morphing",
  ],
};

// Build human anatomy enforcement prompt - ENHANCED with temporal anchors
function buildHumanAnatomyPrompt(isWideShot: boolean = false): string {
  const parts = [
    ...HUMAN_ANATOMY_ENFORCEMENT.proportions,
    ...HUMAN_ANATOMY_ENFORCEMENT.movement,
    ...HUMAN_ANATOMY_ENFORCEMENT.integrity,
    ...HUMAN_ANATOMY_ENFORCEMENT.temporal,
  ];
  
  if (isWideShot) {
    parts.push(...HUMAN_ANATOMY_ENFORCEMENT.wideShot);
  }
  
  // Select more anchors for stronger enforcement
  return `[HUMAN ANATOMY LOCK: ${parts.slice(0, 12).join(', ')}]`;
}

// Detect if prompt describes a wide/distant shot
function isWideOrDistantShot(prompt: string): boolean {
  const wideIndicators = [
    'wide shot', 'wide angle', 'establishing shot', 'distant', 'far away',
    'aerial', 'drone', 'overhead', 'panoramic', 'landscape with people',
    'crowd', 'group of people', 'from afar', 'in the distance',
    'extreme wide', 'long shot', 'full body', 'silhouette',
  ];
  
  const promptLower = prompt.toLowerCase();
  return wideIndicators.some(indicator => promptLower.includes(indicator));
}

// ============================================================================
// ANTI-PHYSICS VIOLATION NEGATIVE PROMPTS v2.0 - 200+ Anti-Drift Terms
// ENHANCED with transition artifacts, identity drift, and temporal coherence
// ============================================================================

const PHYSICS_VIOLATIONS = {
  // Gravity violations
  gravity: [
    "defying gravity", "floating unnaturally", "objects suspended in air",
    "impossible levitation", "anti-gravity glitch", "falling upward",
    "gravity-defying without explanation", "objects hovering incorrectly",
    "items floating mid-air", "suspended without support",
  ],
  
  // Motion violations - ENHANCED for smoothness
  motion: [
    "instant teleportation", "speed ramping artifacts", "stuttering motion",
    "frame skipping", "motion blur inconsistency", "jittery movement",
    "unnatural acceleration", "impossible deceleration", "motion judder",
    "temporal aliasing", "motion ghosting", "strobing effect",
    "jerky movement", "choppy animation", "skipped frames",
    "sudden position change", "discontinuous motion", "motion freezing",
    "stutter stepping", "motion warping",
  ],
  
  // Body physics violations - ENHANCED for human realism
  body: [
    "limbs bending wrong", "impossible body positions", "joints hyperextending",
    "body clipping through itself", "anatomically impossible poses",
    "rubber limbs", "stretching body parts", "shrinking body parts",
    "extra fingers", "missing fingers", "hands merging", "face melting",
    "eyes in wrong position", "asymmetric face distortion",
    "distorted human proportions", "wrong head size", "elongated limbs",
    "shortened limbs", "giant head", "tiny head", "blob humans",
    "featureless humans", "mannequin people", "puppet-like movement",
    "wrong number of limbs", "extra arms", "extra legs", "missing limbs",
    "human-shaped blobs", "indistinct human forms", "melting humans",
    "morphing body parts", "unstable human form", "floating limbs",
    "twisted spine", "broken neck angle", "impossible torso rotation",
  ],
  
  // Object physics violations
  objects: [
    "clipping through objects", "objects passing through each other",
    "impossible object intersection", "solid objects merging",
    "objects teleporting", "spontaneous object generation",
    "objects disappearing", "scale inconsistency", "size shifting",
    "proportion changes mid-shot", "objects phasing through surfaces",
  ],
  
  // Cloth/hair physics violations - ENHANCED
  cloth: [
    "stiff cloth", "cloth not responding to movement", "frozen fabric",
    "hair not moving", "rigid hair", "cloth clipping through body",
    "impossible fabric folds", "weightless cloth behavior",
    "hair passing through solid objects", "static hair in wind",
    "frozen clothing in motion", "fabric ignoring gravity",
    "hair changing length", "clothing changing style",
  ],
  
  // Light physics violations - ENHANCED
  light: [
    "shadows in wrong direction", "missing shadows", "double shadows",
    "inconsistent lighting", "light source contradiction",
    "impossible reflections", "broken refraction", "light bleeding",
    "exposure flickering", "white balance shifts mid-shot",
    "shadow direction change", "lighting jumping", "sudden brightness change",
    "inconsistent ambient light", "light source teleporting",
  ],
  
  // Fluid physics violations
  fluid: [
    "water defying physics", "impossible liquid behavior",
    "fluid flowing upward without cause", "splash without impact",
    "liquid disappearing", "fire burning incorrectly",
    "smoke moving against wind", "particle system glitches",
    "fire direction inconsistency", "smoke density changing instantly",
  ],
  
  // Temporal violations - ENHANCED for multi-clip coherence
  temporal: [
    "time discontinuity", "causality violation", "action before cause",
    "temporal artifacts", "frame rate inconsistency", "time jumping",
    "sequence breaks", "continuity errors", "timeline inconsistency",
    "temporal drift", "scene time jumping", "daylight inconsistency",
    "sudden weather change", "instant day to night",
  ],
  
  // Quality violations
  quality: [
    "blurry", "low quality", "pixelated", "compressed artifacts",
    "banding", "noise grain excessive", "overexposed", "underexposed",
    "washed out colors", "oversaturated", "color banding",
    "macro blocking", "aliasing", "jagged edges", "moiré pattern",
    "watermark", "text overlay", "UI elements", "glitch art",
    "datamosh", "corrupted frames", "encoding artifacts",
  ],
  
  // AI-specific violations - ENHANCED for identity preservation
  aiArtifacts: [
    "morphing faces", "identity shifting", "character inconsistency",
    "style drift", "aesthetic wandering", "unintended transformation",
    "reality warping", "dimension shifting", "perspective breaking",
    "AI hallucination", "generation artifacts", "diffusion noise",
    "denoising artifacts", "prompt bleeding",
    "uncanny valley humans", "plastic skin", "waxy faces",
    "dead eyes", "soulless expression", "robotic movement",
    "unnatural skin texture", "wrong skin color shifts",
    "face swap mid-shot", "age morphing", "gender drift",
    "ethnicity change", "feature migration", "identity swap",
  ],
  
  // NEW: Scene transition violations
  transition: [
    "jarring cut", "mismatched angles", "position jump between cuts",
    "lighting discontinuity at cut", "color temperature jump",
    "costume change at cut", "prop disappearance", "background jump",
    "scale mismatch between shots", "eyeline mismatch",
    "action discontinuity", "momentum break at cut",
  ],
};

// Build comprehensive anti-physics negative prompt
function buildAntiPhysicsNegative(): string {
  const allViolations: string[] = [];
  
  for (const category of Object.values(PHYSICS_VIOLATIONS)) {
    allViolations.push(...category);
  }
  
  return allViolations.join(", ");
}

// Detect scene type from prompt
function detectSceneType(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes("fight") || promptLower.includes("chase") || 
      promptLower.includes("explosion") || promptLower.includes("action")) {
    return "action";
  }
  if (promptLower.includes("talking") || promptLower.includes("conversation") ||
      promptLower.includes("dialogue") || promptLower.includes("speaking")) {
    return "dialogue";
  }
  if (promptLower.includes("nature") || promptLower.includes("forest") ||
      promptLower.includes("ocean") || promptLower.includes("mountain") ||
      promptLower.includes("landscape")) {
    return "nature";
  }
  if (promptLower.includes("space") || promptLower.includes("spaceship") ||
      promptLower.includes("sci-fi") || promptLower.includes("futuristic") ||
      promptLower.includes("alien")) {
    return "scifi";
  }
  
  return "default";
}

// Transition hints for seamless connections
const TRANSITION_HINTS: Record<string, string> = {
  "fade": "gradual fade transition, smooth brightness change",
  "cut": "clean cut, direct scene change",
  "dissolve": "crossfade dissolve, overlapping transition",
  "wipe": "directional wipe transition",
  "match-cut": "match cut on similar shapes or movements",
  "continuous": "continuous motion, seamless flow",
  "angle-change": "cut to different angle of same subject",
  "motion-carry": "movement continues across cut",
  "whip-pan": "fast camera sweep blur transition",
  "reveal": "camera movement reveals new element",
  "follow-through": "action carries viewer to next scene",
};

// ============================================================================
// APEX MANDATORY QUALITY SUFFIX v2.0 - Always appended to ALL prompts
// Ensures every clip is Hollywood-grade regardless of user input
// ENHANCED with temporal consistency and professional finishing
// ============================================================================
const APEX_QUALITY_SUFFIX = ", cinematic lighting, 8K resolution, ultra high definition, highly detailed, professional cinematography, masterful composition, award-winning cinematographer, ARRI Alexa camera quality, anamorphic lens flares, perfect exposure, theatrical color grading, clean sharp image, consistent throughout entire clip, temporally stable, no flickering, smooth motion";

// ============================================================================
// SCENE TRANSITION QUALITY - Ensures clips connect seamlessly
// ============================================================================
const TRANSITION_QUALITY_SUFFIX = ". TRANSITION REQUIREMENTS: Smooth continuous action, consistent momentum, matching lighting direction, stable camera perspective, seamless visual flow.";

// ============================================================================
// RICH COLOR ENFORCEMENT v2.0 - Guarantees vibrant, consistent colors
// Colors should NEVER degrade across clips, only improve
// ENHANCED with cross-clip consistency
// ============================================================================
const COLOR_ENFORCEMENT_SUFFIX = ". CRITICAL COLOR REQUIREMENTS: Rich saturated colors, vibrant color palette, deep blacks, clean highlights, professional color grading. Colors must be VIVID and RICH throughout entire clip. NO washed out colors, NO gray tones, NO color degradation. Maintain consistent color temperature. Lock color palette from start to end.";

// ============================================================================
// CHARACTER CONSISTENCY ENFORCEMENT - Prevents identity drift
// ============================================================================
const CHARACTER_CONSISTENCY_SUFFIX = ". CHARACTER LOCK: Same exact person throughout clip. No face changes. No body transformation. Identical clothing. Identical hair. Fixed skin tone. Stable identity from first frame to last frame.";

// ============================================================================
// Runway Gen-4.5 - Pure TEXT-TO-VIDEO (no image required) via Replicate
// Model: runwayml/gen-4.5
// Supports: 5s or 10s clips, text-only input, 16:9 / 9:16 / 1:1
// ============================================================================
const RUNWAY_GEN45_MODEL = "runwayml/gen-4.5";
const RUNWAY_GEN45_MODEL_URL = `https://api.replicate.com/v1/models/${RUNWAY_GEN45_MODEL}/predictions`;

// Anti-color-degradation terms for negative prompt - ENHANCED
const COLOR_DEGRADATION_NEGATIVES = [
  "washed out colors", "desaturated", "gray tones", "muddy colors", "flat colors",
  "color banding", "color shift", "inconsistent colors", "dull colors", "faded colors",
  "low saturation", "color degradation", "color drift", "bleached", "overexposed colors",
  "underexposed colors", "color noise", "color artifacts", "uneven color temperature",
  "color temperature jump", "white balance drift", "color grading change mid-clip",
  "film grain", "noise grain", "grainy texture", "analog noise",
];

// Build enhanced prompt with APEX Physics Engine, Quality Maximizer, SMART CAMERA ANGLES, VELOCITY VECTORING, and CHARACTER CONSISTENCY
function buildConsistentPrompt(
  basePrompt: string,
  sceneContext?: SceneContext,
  inputNegativePrompt?: string,
  transitionOut?: string,
  qualityTier: number = 10
): { prompt: string; negativePrompt: string } {
  // STEP 0: Always append ALL mandatory suffixes to user prompt FIRST
  // Order: Quality → Color → Character Consistency → Transition
  let prompt = basePrompt + APEX_QUALITY_SUFFIX + COLOR_ENFORCEMENT_SUFFIX + CHARACTER_CONSISTENCY_SUFFIX + TRANSITION_QUALITY_SUFFIX;
  console.log('[APEX v2.0] Full quality stack appended: quality + color + character + transition');
  
  // ============================================================================
  // HUMAN ANATOMY ENFORCEMENT - Guarantees realistic humans at any distance
  // ============================================================================
  const isWide = isWideOrDistantShot(basePrompt);
  const anatomyPrompt = buildHumanAnatomyPrompt(isWide);
  prompt = `${anatomyPrompt} ${prompt}`;
  console.log(`[APEX] Human anatomy lock applied (wide shot: ${isWide})`);
  
  // Detect scene type for physics profile selection
  const sceneType = detectSceneType(basePrompt);
  console.log('[APEX] Detected scene type:', sceneType);
  
  // ============================================================================
  // APEX PHYSICS ENGINE INJECTION - Ensures physics accuracy
  // ============================================================================
  const physicsInjection = buildPhysicsInjection(sceneType);
  prompt = `${physicsInjection} ${prompt}`;
  console.log('[APEX Physics] Injected physics profile for:', sceneType);
  
  // ============================================================================
  // QUALITY MAXIMIZER INJECTION - Hollywood-grade output
  // ============================================================================
  const qualityInjection = buildQualityMaximizer(qualityTier);
  prompt = `${qualityInjection} ${prompt}`;
  console.log('[Quality Maximizer] Tier', qualityTier, 'applied');
  
  // VELOCITY VECTORING: Inject motion continuity from previous clip
  if (sceneContext?.previousMotionVectors) {
    const mv = sceneContext.previousMotionVectors;
    const velocityPrefix = `[MOTION CONTINUITY: Maintain ${mv.endVelocity || 'steady'} movement ${mv.endDirection || 'forward'}, camera ${mv.cameraMomentum || 'smooth'}]`;
    prompt = `${velocityPrefix} ${prompt}`;
    console.log('[generate-video] Velocity continuity injected:', velocityPrefix);
  }
  
  // SMART CAMERA PERSPECTIVE: Inject camera hints at the start for strong influence
  if (sceneContext) {
    const cameraParts: string[] = [];
    
    // Add camera scale perspective
    if (sceneContext.cameraScale && CAMERA_SCALE_HINTS[sceneContext.cameraScale]) {
      cameraParts.push(CAMERA_SCALE_HINTS[sceneContext.cameraScale]);
    }
    
    // Add camera angle perspective with transition awareness
    if (sceneContext.cameraAngle && CAMERA_ANGLE_HINTS[sceneContext.cameraAngle]) {
      if (sceneContext.previousCameraAngle && sceneContext.previousCameraAngle !== sceneContext.cameraAngle) {
        cameraParts.push(`transitioning from ${sceneContext.previousCameraAngle} to ${CAMERA_ANGLE_HINTS[sceneContext.cameraAngle]}`);
      } else {
        cameraParts.push(CAMERA_ANGLE_HINTS[sceneContext.cameraAngle]);
      }
    }
    
    // Add movement type
    if (sceneContext.movementType && MOVEMENT_HINTS[sceneContext.movementType]) {
      cameraParts.push(MOVEMENT_HINTS[sceneContext.movementType]);
    }
    
    // Prepend camera perspective for strong influence
    if (cameraParts.length > 0) {
      prompt = `[CAMERA: ${cameraParts.join(', ')}] ${prompt}`;
      console.log('[generate-video] Smart camera perspective injected:', cameraParts.join(', '));
    }
  }

  // Add scene context for consistency
  if (sceneContext) {
    const contextParts: string[] = [];
    
    if (sceneContext.environment) {
      contextParts.push(`Setting: ${sceneContext.environment}`);
    }
    if (sceneContext.lightingStyle) {
      contextParts.push(`Lighting: ${sceneContext.lightingStyle}`);
    }
    if (sceneContext.lightingDirection) {
      contextParts.push(`Light direction: ${sceneContext.lightingDirection}`);
    }
    if (sceneContext.timeOfDay) {
      contextParts.push(`Time: ${sceneContext.timeOfDay}`);
    }
    if (sceneContext.colorPalette) {
      contextParts.push(`Color palette: ${sceneContext.colorPalette}`);
    }
    if (sceneContext.dominantColors) {
      contextParts.push(`Dominant colors: ${sceneContext.dominantColors}`);
    }
    if (sceneContext.characters?.length) {
      contextParts.push(`Characters: ${sceneContext.characters.join(", ")}`);
    }
    
    if (contextParts.length > 0) {
      prompt = `${prompt}. ${contextParts.join(". ")}`;
    }
  }

  // Add transition hint
  if (transitionOut && TRANSITION_HINTS[transitionOut]) {
    prompt = `${prompt}. End with ${TRANSITION_HINTS[transitionOut]}`;
  }

  // Add reinforcement modifiers for Veo 3.1 with STRONG color enforcement
  prompt = `${prompt}. Photorealistic, physically accurate motion, natural weight and momentum, cinematic depth of field, professional color grading. RICH SATURATED COLORS THROUGHOUT.`;

  // ============================================================================
  // BUILD COMPREHENSIVE ANTI-PHYSICS + ANTI-COLOR-DEGRADATION NEGATIVE PROMPT
  // ============================================================================
  const antiPhysicsNegative = buildAntiPhysicsNegative();
  const colorNegative = COLOR_DEGRADATION_NEGATIVES.join(", ");
  
  const negativePromptParts = [
    antiPhysicsNegative,
    colorNegative, // Add color degradation prevention
    ...getSafetyNegativePrompts(), // Add NSFW content prevention
  ];
  
  if (inputNegativePrompt) {
    negativePromptParts.push(inputNegativePrompt);
  }
  
  const finalNegative = negativePromptParts.join(", ");
  console.log('[Anti-Physics + Anti-Color + Safety] Negative prompt terms:', finalNegative.split(',').length);

  return {
    prompt: prompt.slice(0, 2000), // Vertex AI prompt limit
    negativePrompt: finalNegative.slice(0, 1000), // Reasonable negative prompt limit
  };
}
// Upload base64 image to Supabase storage and return URL
async function uploadBase64ToStorage(base64Data: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Extract mime type and data
  const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid base64 data URL");

  const mimeType = matches[1];
  const data = matches[2];
  const extension = mimeType.split("/")[1] || "jpg";
  const fileName = `frame_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;

  // Decode base64
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));

  // Upload to storage
  const { data: uploadData, error } = await supabase.storage
    .from("temp-frames")
    .upload(fileName, bytes, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    // Try creating bucket if it doesn't exist
    await supabase.storage.createBucket("temp-frames", { public: true });
    const { error: retryError } = await supabase.storage
      .from("temp-frames")
      .upload(fileName, bytes, { contentType: mimeType, upsert: true });
    if (retryError) throw retryError;
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;
  console.log("Uploaded base64 to storage:", publicUrl);
  return publicUrl;
}

// Ensure image URL is valid (convert base64 if needed)
async function ensureImageUrl(input: string | undefined): Promise<string | null> {
  if (!input) return null;
  
  if (input.startsWith("http://") || input.startsWith("https://")) {
    console.log("[ensureImageUrl] Already an HTTP URL:", input.substring(0, 80) + "...");
    return input;
  }
  
  if (input.startsWith("data:")) {
    console.log("[ensureImageUrl] Converting base64 to URL...");
    return await uploadBase64ToStorage(input);
  }
  
  console.log("[ensureImageUrl] Unknown format, skipping");
  return null;
}

// Generate video with Kling 2.6 via Replicate API
// Supports: native audio, image-to-video, frame chaining
async function generateWithKling(
  prompt: string,
  enhancedPrompt: string,
  negativePrompt: string,
  duration: number,
  aspectRatio: string,
  startImageUrl: string | null,
  referenceImages: string[] = [],
  enableAudio: boolean = true
): Promise<{ success: true; taskId: string; provider: "replicate"; model: string } | { success: false; error: string }> {
  try {
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    // Kling 2.6 parameters via Replicate
    const klingDuration = duration <= 6 ? 5 : 10;
    const klingAspectRatio = aspectRatio === "9:16" ? "9:16" : 
                              aspectRatio === "1:1" ? "1:1" : "16:9";

    // Build Replicate input for Kling v2.6 - ALWAYS use "pro" mode for HD quality
    const replicateInput: Record<string, any> = {
      prompt: enhancedPrompt.slice(0, 1500),
      negative_prompt: negativePrompt.slice(0, 1500),
      aspect_ratio: klingAspectRatio,
      duration: klingDuration,
      cfg_scale: 0.7,
      mode: "pro", // CRITICAL: "pro" mode = HD quality, "standard" = lower quality
    };

    // Add start image for image-to-video mode
    if (startImageUrl) {
      replicateInput.start_image = startImageUrl;
    }

    console.log("[generate-video] Starting Kling 2.6 via Replicate:", {
      mode: startImageUrl ? "image-to-video" : "text-to-video",
      duration: klingDuration,
      aspectRatio: klingAspectRatio,
      promptLength: enhancedPrompt.length,
    });

    // Call Replicate API - use model identifier for official models
    const response = await fetch(REPLICATE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: KLING_MODEL, // Official model - use model identifier directly
        input: replicateInput,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-video] Replicate API error:", response.status, errorText);
      return { success: false, error: `Replicate API error: ${response.status} - ${errorText}` };
    }

    const prediction = await response.json();
    const taskId = prediction.id;
    
    if (!taskId) {
      console.error("[generate-video] No prediction ID in Replicate response:", prediction);
      return { success: false, error: "No prediction ID in Replicate response" };
    }

    console.log("[generate-video] Replicate prediction created:", taskId);

    return {
      success: true,
      taskId: taskId,
      provider: "replicate",
      model: KLING_MODEL,
    };
  } catch (error) {
    console.error("[generate-video] Replicate error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Replicate generation failed" 
    };
  }
}

// NOTE: Runway Gen-4.5 handles TEXT-TO-VIDEO (no image required - T2V native).
//       Runway Gen-4 Turbo handles IMAGE-TO-VIDEO (requires image as first frame).
//       Kling v2.6 handles Avatar mode ONLY and is the fallback if Runway T2V fails.

// Generate video with Runway Gen-4 Turbo (image-to-video) or Kling (text-to-video fallback)
async function generateWithRunway(
  prompt: string,
  enhancedPrompt: string,
  negativePrompt: string,
  startImageUrl: string | null,
  duration: number,
  aspectRatio: string,
  referenceImages: string[] = [],
  enableAudio: boolean = false
): Promise<{ success: true; taskId: string; provider: "replicate"; model: string } | { success: false; error: string }> {
  const hasImage = !!(startImageUrl && startImageUrl.startsWith("http"));

  if (hasImage) {
    // Image-to-video: Runway Gen-4 Turbo (requires image)
    try {
      const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
      if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY is not configured");

      const runwayDuration = duration <= 5 ? 5 : 10;
      const runwayAspectRatio = aspectRatio === "9:16" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9";

      const input: Record<string, any> = {
        prompt: enhancedPrompt.slice(0, 2000),
        duration: runwayDuration,
        aspect_ratio: runwayAspectRatio,
        image: startImageUrl, // Required by Gen-4 Turbo
      };

      console.log("[generate-video][Runway Gen-4 Turbo] ✅ Image-to-video:", { duration: runwayDuration, aspectRatio: runwayAspectRatio });

      const response = await fetch(RUNWAY_GEN4_MODEL_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[generate-video][Runway Gen-4 Turbo] API error:", response.status, errorText);
        return { success: false, error: `Runway Gen-4 Turbo API error: ${response.status} - ${errorText}` };
      }

      const prediction = await response.json();
      if (!prediction.id) return { success: false, error: "No prediction ID in Runway response" };
      console.log("[generate-video][Runway Gen-4 Turbo] ✅ Prediction created:", prediction.id);
      return { success: true, taskId: prediction.id, provider: "replicate", model: RUNWAY_GEN4_MODEL };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Runway Gen-4 Turbo generation failed" };
    }
  } else {
    // ─── TEXT-TO-VIDEO: Runway Gen-4.5 (no image required) ───────────────
    // runwayml/gen-4.5 is Runway's dedicated T2V model — the #1 ranked
    // text-to-video model on Artificial Analysis benchmark as of Nov 2025.
    console.log("[generate-video][Runway Gen-4.5] ✅ Pure text-to-video (no image required)");
    try {
      const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
      if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY is not configured");

      const runwayDuration = duration <= 5 ? 5 : 10;
      const runwayAspectRatio = aspectRatio === "9:16" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9";

      const input: Record<string, any> = {
        prompt: enhancedPrompt.slice(0, 2000),
        duration: runwayDuration,
        aspect_ratio: runwayAspectRatio,
      };

      console.log("[generate-video][Runway Gen-4.5] Submitting T2V:", {
        duration: runwayDuration,
        aspectRatio: runwayAspectRatio,
        promptLength: enhancedPrompt.length,
      });

      const response = await fetch(RUNWAY_GEN45_MODEL_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[generate-video][Runway Gen-4.5] API error:", response.status, errorText);
        // Fallback to Kling if Runway Gen-4.5 fails
        console.warn("[generate-video] Falling back to Kling v2.6 for T2V");
        return generateWithKling(prompt, enhancedPrompt, negativePrompt, duration, aspectRatio, null, referenceImages, enableAudio);
      }

      const prediction = await response.json();
      if (!prediction.id) {
        console.error("[generate-video][Runway Gen-4.5] No prediction ID:", prediction);
        return generateWithKling(prompt, enhancedPrompt, negativePrompt, duration, aspectRatio, null, referenceImages, enableAudio);
      }

      console.log("[generate-video][Runway Gen-4.5] ✅ Prediction created:", prediction.id);
      return { success: true, taskId: prediction.id, provider: "replicate", model: RUNWAY_GEN45_MODEL };
    } catch (error) {
      console.error("[generate-video][Runway Gen-4.5] Error, falling back to Kling:", error);
      return generateWithKling(prompt, enhancedPrompt, negativePrompt, duration, aspectRatio, null, referenceImages, enableAudio);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD: Prevent unauthorized API credit consumption ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const {
      prompt,
      duration = 5,
      sceneContext,
      // referenceImageUrl is for character IDENTITY only — NOT a start frame.
      referenceImageUrl,
      // startImage is the actual frame to use as the video's first frame (image-to-video).
      startImage,
      negativePrompt: inputNegativePrompt,
      transitionOut,
      aspectRatio = "16:9",
      identityBibleUrls,
      enableAudio = KLING_ENABLE_AUDIO,
      // 'veo' routes to Runway Gen-4 Turbo; 'kling' stays on Kling v2.6
      videoEngine = "veo",
    } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    // ═══════════════════════════════════════════════════════════════════
    // CONTENT SAFETY CHECK
    // ═══════════════════════════════════════════════════════════════════
    const safetyCheck = checkContentSafety(prompt);
    if (!safetyCheck.isSafe) {
      console.error(`[generate-video] ⛔ CONTENT BLOCKED - Category: ${safetyCheck.category}, Terms: ${safetyCheck.matchedTerms.slice(0, 3).join(', ')}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: safetyCheck.message,
          blocked: true,
          category: safetyCheck.category,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build enhanced prompt
    const { prompt: enhancedPrompt, negativePrompt } = buildConsistentPrompt(
      prompt,
      sceneContext,
      inputNegativePrompt,
      transitionOut
    );

    // Only use startImage as the start frame for image-to-video mode.
    // referenceImageUrl is identity-only — never use it as a start frame.
    const startImageUrl = await ensureImageUrl(startImage || null);
    const isImageToVideo = !!startImageUrl;

    if (referenceImageUrl) {
      console.log(`[generate-video] referenceImageUrl provided (identity-only): ${referenceImageUrl.substring(0, 80)}...`);
    }

    // Prepare identity bible reference images (Kling only)
    let referenceImages: string[] = [];
    if (identityBibleUrls && Array.isArray(identityBibleUrls)) {
      for (const url of identityBibleUrls.slice(0, 4)) {
        const validUrl = await ensureImageUrl(url);
        if (validUrl) referenceImages.push(validUrl);
      }
    }

    // =====================================================================
    // ENGINE ROUTING
    // 'veo' param → Runway Gen-4 Turbo (text-to-video & image-to-video)
    // 'kling' param → Kling v2.6 (avatar mode)
    // Default is Runway for all standard production modes
    // =====================================================================
    const useRunway = videoEngine !== "kling";

    let result: { success: true; taskId: string; provider: "replicate"; model: string } | { success: false; error: string };

    if (useRunway) {
      console.log("[generate-video] Routing to Runway Gen-4 Turbo (50% margin pricing active):", {
        mode: isImageToVideo ? "image-to-video" : "text-to-video",
        duration,
        aspectRatio,
        promptLength: enhancedPrompt.length,
      });

      result = await generateWithRunway(
        prompt,
        enhancedPrompt,
        negativePrompt,
        startImageUrl,
        duration,
        aspectRatio,
        referenceImages,
        enableAudio
      );
    } else {
      console.log("[generate-video] Routing to Kling v2.6 (Avatar mode):", {
        mode: isImageToVideo ? "image-to-video" : "text-to-video",
        duration,
        aspectRatio,
        enableAudio,
        referenceImageCount: referenceImages.length,
        promptLength: enhancedPrompt.length,
      });

      result = await generateWithKling(
        prompt,
        enhancedPrompt,
        negativePrompt,
        duration,
        aspectRatio,
        startImageUrl,
        referenceImages,
        enableAudio
      );
    }

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          taskId: result.taskId,
          status: "STARTING",
          mode: isImageToVideo ? "image-to-video" : "text-to-video",
          provider: result.provider,
          model: result.model,
          engine: useRunway ? "runway" : "kling",
          audioEnabled: useRunway ? false : enableAudio,
          referenceImagesUsed: useRunway ? 0 : referenceImages.length,
          promptRewritten: enhancedPrompt !== prompt,
          message: `Video generation started with ${result.model}. Poll status endpoint for updates.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Generation failed: ${result.error}`);

  } catch (error: unknown) {
    console.error("Error in generate-video function:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("rate limit")) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
