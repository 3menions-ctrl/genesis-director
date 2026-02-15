/**
 * COMPREHENSIVE PROMPT BUILDER
 * 
 * Centralized system for injecting ALL identity and continuity data into clip prompts.
 * This is the SINGLE SOURCE OF TRUTH for prompt construction.
 * 
 * GUARANTEES:
 * 1. All identity bible data (character description, consistency anchors) is ALWAYS injected
 * 2. Anti-morphing and occlusion negatives are ALWAYS added to negative prompt
 * 3. Non-facial anchors are used when character faces away or is occluded
 * 4. Continuity manifest data (lighting, colors, environment) propagates between clips
 * 5. Motion vectors and action continuity are injected for smooth transitions
 * 
 * IRON-CLAD RULE: Every clip generation MUST go through this builder.
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface IdentityBible {
  characterDescription?: string;
  consistencyPrompt?: string;
  consistencyAnchors?: string[];
  originalReferenceUrl?: string;
  
  // Character identity details
  characterIdentity?: {
    description?: string;
    facialFeatures?: string;
    clothing?: string;
    bodyType?: string;
    skinTone?: string;
    hairColor?: string;
    distinctiveMarkers?: string[];
  };
  
  // Non-facial anchors (CRITICAL for back-facing/occluded shots)
  nonFacialAnchors?: {
    bodyType?: string;
    bodyProportions?: string;
    posture?: string;
    gait?: string;
    height?: string;
    clothingDescription?: string;
    clothingColors?: string[];
    clothingPatterns?: string[];
    clothingTextures?: string[];
    clothingDistinctive?: string;
    clothingSignature?: string;
    hairColor?: string;
    hairLength?: string;
    hairStyle?: string;
    hairFromBehind?: string;
    hairSilhouette?: string;
    accessories?: string[];
    accessoryPositions?: string;
    backViewMarkers?: string;
    overallSilhouette?: string;
    silhouetteDescription?: string;
  };
  
  // Anti-morphing prompts (MUST be added to negative prompt)
  antiMorphingPrompts?: string[];
  
  // Occlusion-specific negatives (MUST be added when face is hidden)
  occlusionNegatives?: string[];
  
  // Style anchor from clip 1
  styleAnchor?: any;
  masterSceneAnchor?: any;
}

export interface ContinuityManifest {
  lighting?: {
    ambientLevel?: string;
    colorTemperature?: string;
    colorTint?: string;
    keyLightDirection?: string;
    shadowIntensity?: string;
  };
  environment?: {
    setting?: string;
    keyObjects?: string[];
    backgroundElements?: string[];
  };
  action?: {
    poseAtCut?: string;
    movementDirection?: string;
    gestureInProgress?: string;
    expectedContinuation?: string;
  };
  criticalAnchors?: string[];
}

export interface MotionVectors {
  exitMotion?: string;
  dominantDirection?: string;
  continuityPrompt?: string;
  actionContinuity?: string;
  endVelocity?: string;
  endDirection?: string;
  cameraMomentum?: string;
}

export interface MasterSceneAnchor {
  masterConsistencyPrompt?: string;
  colorPalette?: string[] | string;
  lighting?: string;
  visualStyle?: string;
}

export interface ExtractedCharacter {
  name: string;
  appearance?: string;
  clothing?: string;
  distinguishingFeatures?: string;
  age?: string;
  gender?: string;
}

export interface SceneContext {
  lighting?: string;
  colorPalette?: string;
  environment?: string;
  mood?: string;
  timeOfDay?: string;
}

// =============================================================================
// FACE LOCK INTERFACE (HIGHEST PRIORITY IDENTITY SYSTEM)
// =============================================================================

export interface FaceLock {
  // Core face identity
  faceShape?: string;
  eyeDescription?: string;
  noseDescription?: string;
  mouthDescription?: string;
  skinTone?: string;
  skinTexture?: string;
  facialHair?: string;
  
  // Distinguishing features (CRITICAL for identity)
  distinguishingFeatures?: string[];
  
  // Age and expression baseline
  apparentAge?: string;
  restingExpression?: string;
  
  // Hair framing the face
  hairlineDescription?: string;
  hairColorExact?: string;
  
  // Full description for injection
  fullFaceDescription?: string;
  
  // Golden reference - single sentence identity lock
  goldenReference?: string;
  
  // Face-specific negatives
  faceNegatives?: string[];
  
  // Metadata
  lockedAt?: string;
  confidence?: number;
  sourceImageUrl?: string;
}

// =============================================================================
// MULTI-VIEW IDENTITY BIBLE (5-ANGLE CHARACTER CONSISTENCY)
// =============================================================================

export interface MultiViewViewDescription {
  viewType: 'front' | 'side' | 'three-quarter' | 'back' | 'silhouette';
  description: string;
  keyFeatures: string[];
  consistencyAnchors: string[];
  negativePrompts: string[];
}

export interface MultiViewIdentityBible {
  characterName?: string;
  
  // Core identity (from reference)
  coreIdentity?: {
    description?: string;
    facialFeatures?: string;
    bodyType?: string;
    height?: string;
    skinTone?: string;
    age?: string;
    gender?: string;
  };
  
  // 5-view descriptions
  views?: {
    front?: MultiViewViewDescription;
    side?: MultiViewViewDescription;
    threeQuarter?: MultiViewViewDescription;
    back?: MultiViewViewDescription;
    silhouette?: MultiViewViewDescription;
  };
  
  // Non-facial anchors (critical for back/occluded views)
  nonFacialAnchors?: {
    bodyType?: string;
    bodyProportions?: string;
    posture?: string;
    gait?: string;
    height?: string;
    clothingDescription?: string;
    clothingColors?: string[];
    clothingPatterns?: string[];
    clothingTextures?: string[];
    clothingDistinctive?: string;
    hairColor?: string;
    hairColorHex?: string;
    hairLength?: string;
    hairStyle?: string;
    hairFromBehind?: string;
    hairSilhouette?: string;
    accessories?: string[];
    accessoryPositions?: string;
    backViewMarkers?: string;
    overallSilhouette?: string;
  };
  
  // Comprehensive consistency prompt
  masterConsistencyPrompt?: string;
  
  // Global negatives
  occlusionNegatives?: string[];
  
  // Metadata
  extractedAt?: string;
  confidence?: number;
}

export interface PromptBuildRequest {
  // Base prompt (shot description)
  basePrompt: string;
  
  // Clip metadata
  clipIndex: number;
  totalClips: number;
  
  // FACE LOCK (HIGHEST PRIORITY - injected FIRST)
  faceLock?: FaceLock;
  
  // MULTI-VIEW IDENTITY BIBLE (5-angle character consistency)
  multiViewIdentityBible?: MultiViewIdentityBible;
  
  // Identity data
  identityBible?: IdentityBible;
  extractedCharacters?: ExtractedCharacter[];
  
  // Continuity from previous clip
  previousContinuityManifest?: ContinuityManifest;
  previousMotionVectors?: MotionVectors;
  
  // Scene DNA (master anchor from clip 1)
  masterSceneAnchor?: MasterSceneAnchor;
  
  // Current scene context
  sceneContext?: SceneContext;
  
  // User-provided negative prompt
  userNegativePrompt?: string;
  
  // Detection for pose-aware injection
  detectedPose?: 'front' | 'side' | 'back' | 'three-quarter' | 'silhouette' | 'occluded' | 'unknown';
}

export interface BuiltPrompt {
  enhancedPrompt: string;
  negativePrompt: string;
  injectionSummary: {
    hasFaceLock: boolean;
    hasMultiViewIdentity: boolean;
    hasIdentityBible: boolean;
    hasNonFacialAnchors: boolean;
    hasAntiMorphing: boolean;
    hasOcclusionNegatives: boolean;
    hasContinuityManifest: boolean;
    hasMotionVectors: boolean;
    hasMasterSceneAnchor: boolean;
    hasExtractedCharacters: boolean;
    hasMotionEnforcement: boolean;
    motionIntensity: string;
    motionType: string;
    poseDetected: string;
    warningsCount: number;
    warnings: string[];
  };
}

// =============================================================================
// POSE DETECTION
// =============================================================================

const POSE_PATTERNS: { pattern: RegExp; pose: 'back' | 'side' | 'front' | 'three-quarter' | 'silhouette' | 'occluded'; confidence: number }[] = [
  // Back-facing patterns
  { pattern: /\b(from\s+behind|from\s+the\s+back|rear\s+view|back\s+to\s+(camera|us|viewer))\b/i, pose: 'back', confidence: 95 },
  { pattern: /\b(walking\s+away|running\s+away|retreating|departing|leaving)\b/i, pose: 'back', confidence: 85 },
  { pattern: /\b(facing\s+away|turned\s+away|back\s+turned)\b/i, pose: 'back', confidence: 90 },
  { pattern: /\b(looking\s+into\s+(the\s+)?distance|gazing\s+at\s+the\s+horizon)\b/i, pose: 'back', confidence: 75 },
  { pattern: /\b(over\s+the\s+shoulder)\b/i, pose: 'back', confidence: 80 },
  
  // Side-facing patterns
  { pattern: /\b(profile\s+(view|shot)|side\s+(view|profile|angle))\b/i, pose: 'side', confidence: 95 },
  { pattern: /\b(from\s+the\s+side|lateral\s+view)\b/i, pose: 'side', confidence: 90 },
  
  // Three-quarter patterns
  { pattern: /\b(three[-\s]quarter|3\/4\s+view|angled\s+view)\b/i, pose: 'three-quarter', confidence: 95 },
  
  // Silhouette/occluded patterns
  { pattern: /\b(silhouette|backlit|shadow\s+figure)\b/i, pose: 'silhouette', confidence: 95 },
  { pattern: /\b(face\s+(hidden|obscured|covered)|wearing\s+(mask|helmet|hood))\b/i, pose: 'occluded', confidence: 90 },
  
  // Front-facing patterns
  { pattern: /\b(facing\s+(camera|us|forward|viewer)|front\s+view|head-on)\b/i, pose: 'front', confidence: 95 },
  { pattern: /\b(looking\s+at\s+(camera|us|viewer)|eye\s+contact)\b/i, pose: 'front', confidence: 90 },
];

function detectPoseFromPrompt(prompt: string): { pose: string; confidence: number; faceVisible: boolean } {
  let bestPose = 'front';
  let bestConfidence = 50;
  
  for (const { pattern, pose, confidence } of POSE_PATTERNS) {
    if (pattern.test(prompt) && confidence > bestConfidence) {
      bestPose = pose;
      bestConfidence = confidence;
    }
  }
  
  const nonFacialPoses = ['back', 'silhouette', 'occluded'];
  const faceVisible = !nonFacialPoses.includes(bestPose);
  
  return { pose: bestPose, confidence: bestConfidence, faceVisible };
}

// =============================================================================
// MOTION DETECTION PATTERNS
// =============================================================================

interface MotionAnalysis {
  hasMotion: boolean;
  motionType: 'walking' | 'running' | 'exploring' | 'moving' | 'gesturing' | 'static' | 'subtle';
  intensity: 'high' | 'medium' | 'low' | 'static';
  detectedActions: string[];
  motionEnforcementPrompt: string;
  motionNegatives: string[];
}

const MOTION_PATTERNS: { pattern: RegExp; type: MotionAnalysis['motionType']; intensity: MotionAnalysis['intensity'] }[] = [
  // High-intensity motion
  { pattern: /\b(running|sprinting|dashing|racing|chasing|fleeing|escaping)\b/i, type: 'running', intensity: 'high' },
  { pattern: /\b(jumping|leaping|diving|tumbling|rolling)\b/i, type: 'moving', intensity: 'high' },
  
  // Medium-intensity motion (walking, exploring)
  { pattern: /\b(walking|strolling|wandering|roaming|hiking|trekking)\b/i, type: 'walking', intensity: 'medium' },
  { pattern: /\b(exploring|discovering|searching|investigating|navigating)\b/i, type: 'exploring', intensity: 'medium' },
  { pattern: /\b(stepping|stepping\s+through|steps\s+through|moving\s+through)\b/i, type: 'walking', intensity: 'medium' },
  { pattern: /\b(approaching|retreating|advancing|entering|exiting)\b/i, type: 'moving', intensity: 'medium' },
  { pattern: /\b(climbing|descending|ascending)\b/i, type: 'moving', intensity: 'medium' },
  
  // Low-intensity motion (gestures, subtle)
  { pattern: /\b(gesturing|pointing|waving|reaching|touching)\b/i, type: 'gesturing', intensity: 'low' },
  { pattern: /\b(turning|rotating|spinning|pivoting|looking\s+around)\b/i, type: 'subtle', intensity: 'low' },
  { pattern: /\b(gazing|observing|watching|surveying|scanning)\b/i, type: 'subtle', intensity: 'low' },
  { pattern: /\b(breathing|swaying|shifting)\b/i, type: 'subtle', intensity: 'low' },
];

function detectMotionFromPrompt(prompt: string): MotionAnalysis {
  const detectedActions: string[] = [];
  let primaryType: MotionAnalysis['motionType'] = 'static';
  let primaryIntensity: MotionAnalysis['intensity'] = 'static';
  
  for (const { pattern, type, intensity } of MOTION_PATTERNS) {
    const match = prompt.match(pattern);
    if (match) {
      detectedActions.push(match[0]);
      // Take the highest intensity motion detected
      const intensityOrder = { high: 3, medium: 2, low: 1, static: 0 };
      if (intensityOrder[intensity] > intensityOrder[primaryIntensity]) {
        primaryType = type;
        primaryIntensity = intensity;
      }
    }
  }
  
  const hasMotion = detectedActions.length > 0;
  
  // Build motion enforcement prompt based on detected motion
  let motionEnforcementPrompt = '';
  let motionNegatives: string[] = [];
  
  if (hasMotion) {
    switch (primaryIntensity) {
      case 'high':
        motionEnforcementPrompt = `[MOTION REQUIRED - HIGH INTENSITY: Character must be actively ${primaryType} with visible body movement, leg motion, arm swing. Continuous fluid motion throughout the clip. Dynamic movement is MANDATORY.]`;
        motionNegatives = ['static pose', 'frozen', 'still', 'motionless', 'stationary', 'standing still', 'not moving', 'paused', 'stopped', 'idle'];
        break;
      case 'medium':
        motionEnforcementPrompt = `[MOTION REQUIRED - CONTINUOUS MOVEMENT: Character must be visibly ${primaryType} - legs moving, body in motion, traveling through scene. Show actual locomotion with each step visible. The character is NOT standing still.]`;
        motionNegatives = ['static', 'frozen', 'still', 'motionless', 'stationary', 'standing still', 'not moving', 'stuck in place', 'no movement', 'idle pose'];
        break;
      case 'low':
        motionEnforcementPrompt = `[SUBTLE MOTION REQUIRED: Character performs visible ${primaryType} action - body shifts, gestures are animated, natural micro-movements present throughout.]`;
        motionNegatives = ['completely frozen', 'totally still', 'no movement at all', 'statue-like'];
        break;
    }
  }
  
  return {
    hasMotion,
    motionType: primaryType,
    intensity: primaryIntensity,
    detectedActions,
    motionEnforcementPrompt,
    motionNegatives,
  };
}

// =============================================================================
// SUBJECT DETECTION - Detect if prompt is about characters, objects, or scenes
// =============================================================================

interface SubjectAnalysis {
  type: 'character' | 'object' | 'scene' | 'vehicle' | 'animal' | 'mixed';
  subject: string;
  confidence: number;
  humanCharacterDetected: boolean;
}

const OBJECT_PATTERNS: { pattern: RegExp; type: SubjectAnalysis['type']; weight: number }[] = [
  // Vehicles / Transportation (highest priority - these are NEVER people)
  { pattern: /\b(space\s*shuttle|rocket|spacecraft|spaceship|satellite|probe)\b/i, type: 'vehicle', weight: 100 },
  { pattern: /\b(airplane|aircraft|jet|helicopter|drone|plane)\b/i, type: 'vehicle', weight: 100 },
  { pattern: /\b(car|truck|bus|motorcycle|vehicle|train|ship|boat|submarine)\b/i, type: 'vehicle', weight: 95 },
  { pattern: /\b(tank|fighter\s*jet|bomber|warship|battleship)\b/i, type: 'vehicle', weight: 100 },
  
  // Natural phenomena / Events
  { pattern: /\b(asteroid|meteor|comet|meteorite)\s*(impact|crash|strike|hit|collid|fall)/i, type: 'scene', weight: 100 },
  { pattern: /\b(explosion|blast|eruption|nuclear|atomic)\b/i, type: 'scene', weight: 90 },
  { pattern: /\b(volcano|earthquake|tsunami|hurricane|tornado|storm)\b/i, type: 'scene', weight: 95 },
  { pattern: /\b(sunset|sunrise|aurora|eclipse|rainbow)\b/i, type: 'scene', weight: 85 },
  
  // Objects / Items
  { pattern: /\b(robot|mech|machine|device|gadget|weapon)\b/i, type: 'object', weight: 80 },
  { pattern: /\b(building|tower|bridge|monument|statue|structure)\b/i, type: 'object', weight: 75 },
  { pattern: /\b(food|drink|flower|plant|tree|crystal)\b/i, type: 'object', weight: 70 },
  
  // Animals
  { pattern: /\b(dog|cat|bird|horse|lion|tiger|eagle|wolf|bear|elephant|whale|dolphin)\b/i, type: 'animal', weight: 85 },
  { pattern: /\b(dinosaur|dragon|creature|monster|beast)\b/i, type: 'animal', weight: 80 },
  
  // Pure environments/scenes (no actors)
  { pattern: /\b(landscape|scenery|vista|panorama|cityscape|skyline)\b/i, type: 'scene', weight: 90 },
  { pattern: /\b(forest|ocean|mountain|desert|jungle|beach|lake|river|waterfall)\b/i, type: 'scene', weight: 70 },
];

const CHARACTER_PATTERNS: RegExp[] = [
  /\b(person|man|woman|boy|girl|child|adult|human|people|character)\b/i,
  /\b(he|she|they|him|her|his|hers|their)\b/i,
  /\b(walking|running|talking|speaking|gesturing|smiling|crying|laughing)\b/i,
  /\b(wearing|dressed|outfit|clothes|clothing)\b/i,
  /\b(face|eyes|hair|hands|body|head|arms|legs)\b/i,
  /\b(protagonist|hero|villain|character|actor)\b/i,
];

function detectPrimarySubject(prompt: string): SubjectAnalysis {
  let bestMatch: SubjectAnalysis = {
    type: 'mixed',
    subject: '',
    confidence: 0,
    humanCharacterDetected: false,
  };
  
  // Check for human/character indicators first
  const hasHumanIndicators = CHARACTER_PATTERNS.some(p => p.test(prompt));
  
  // Check for object/scene patterns
  for (const { pattern, type, weight } of OBJECT_PATTERNS) {
    const match = prompt.match(pattern);
    if (match && weight > bestMatch.confidence) {
      bestMatch = {
        type,
        subject: match[0],
        confidence: weight,
        humanCharacterDetected: hasHumanIndicators,
      };
    }
  }
  
  // If we found a high-confidence object/scene AND no human indicators, use it
  if (bestMatch.confidence >= 80 && !hasHumanIndicators) {
    return bestMatch;
  }
  
  // If we have human indicators, it's likely a character prompt
  if (hasHumanIndicators && bestMatch.confidence < 90) {
    return {
      type: 'character',
      subject: 'human character',
      confidence: 70,
      humanCharacterDetected: true,
    };
  }
  
  // Mixed content or uncertain
  return bestMatch.confidence > 0 ? bestMatch : {
    type: 'character', // Default to character for safety
    subject: 'unknown',
    confidence: 30,
    humanCharacterDetected: hasHumanIndicators,
  }
}

// =============================================================================
// DEFAULT NEGATIVES (ALWAYS INCLUDED)
// =============================================================================

const BASE_QUALITY_NEGATIVES = [
  'low quality',
  'blur',
  'blurry',
  'distortion',
  'distorted',
  'warped',
  'stretched',
  'squashed',
  'deformed',
  'mutated',
  'watermark',
  'artifact',
  'jarring transition',
  'flickering',
  'compression artifacts',
  'pixelated',
  'noisy',
  'grainy in a bad way',
  'morphing',
  'melting',
  'glitching',
  'jittery',
  'unnatural movement',
  'twisted limbs',
  'extra limbs',
  'missing limbs',
  'fused body parts',
  'disfigured',
  'bad anatomy',
  'wrong proportions',
  'unrealistic physics',
  'floating objects',
  'film grain',
  'noise grain',
  'analog noise',
  'grainy texture',
];

const DEFAULT_ANTI_MORPHING_PROMPTS = [
  // CRITICAL: New actor/character negatives (highest priority)
  'new character',
  'different actor',
  'new person',
  'different face',
  'different person',
  'actor change',
  'person swap',
  'face replacement',
  'new cast',
  // Original anti-morphing
  'character morphing',
  'face changing',
  'body transformation',
  'clothing change',
  'age progression',
  'identity shift',
  'inconsistent appearance',
  'wardrobe malfunction',
  'character replacement',
  'shapeshifting',
  'appearance mutation',
  'face swap',
  'body swap',
  'outfit change',
  'hair transformation',
  // Environment drift negatives
  'different location',
  'changed environment',
  'new setting',
  'scene change',
];

const DEFAULT_OCCLUSION_NEGATIVES = [
  'different person when turning around',
  'changed appearance after face hidden',
  'different clothes after camera angle change',
  'hair color change',
  'different body type',
  'clothing transformation',
  'identity shift',
  'character swap',
  'costume change mid-scene',
  'different hairstyle when turning back',
  'altered physique',
  'different accessories',
  'changed outfit colors',
  'body proportions changing',
  'height change',
  'different posture when revealed',
];

// =============================================================================
// APEX QUALITY SUFFIX
// =============================================================================

const APEX_QUALITY_SUFFIX = ", cinematic lighting, 8K resolution, ultra high definition, highly detailed, professional cinematography, masterful composition, award-winning cinematographer, ARRI Alexa camera quality, anamorphic lens flares, perfect exposure, theatrical color grading, clean sharp image";

// =============================================================================
// PROMPT DEDUPLICATION - Strip existing blocks to prevent redundancy
// =============================================================================

const BLOCK_PATTERNS_TO_STRIP = [
  // Multi-line identity blocks with content spanning lines
  /\[CHARACTER IDENTITY[^\]]*\][^[]*(?=\[|$)/gi,
  /\[CRITICAL: SAME EXACT PERSON[^\]]*\]/gi,
  /\[IDENTITY[^\]]*\]/gi,
  /\[FACE LOCK[^\]]*\]/gi,
  /\[EXACT FACE[^\]]*\]/gi,
  /\[LOCKED FACIAL FEATURES[^\]]*\]/gi,
  /\[MULTI-VIEW IDENTITY[^\]]*\]/gi,
  /\[CHARACTER CONSISTENCY[^\]]*\]/gi,
  /\[VIEW ANCHORS[^\]]*\]/gi,
  /\[CHARACTERS:[^\]]*\]/gi,
  /\[VISUAL ANCHORS:[^\]]*\]/gi,
  /\[CONSISTENCY LOCK:[^\]]*\]/gi,
  /\[IDENTITY LOCK[^\]]*\][\s\S]*?\[END IDENTITY LOCK\]/gi,
  /\[SCENE DNA:[^\]]*\]/gi,
  /\[MASTER LIGHTING:[^\]]*\]/gi,
  /\[COLOR PALETTE:[^\]]*\]/gi,
  /\[COLOR DNA:[^\]]*\]/gi,
  /\[PROGRESSIVE COLOR:[^\]]*\]/gi,
  /\[MATCH LIGHTING:[^\]]*\]/gi,
  /\[MATCH ENVIRONMENT:[^\]]*\]/gi,
  /\[CRITICAL ANCHORS:[^\]]*\]/gi,
  /\[CONTINUE ACTION:[^\]]*\]/gi,
  /\[MANDATORY CONTINUATION:[^\]]*\]/gi,
  /\[MATCH MOTION:[^\]]*\]/gi,
  /\[CAMERA:[^\]]*\]/gi,
  /\[LENS:[^\]]*\]/gi,
  /\[PHYSICS:[^\]]*\]/gi,
  /\[SCENE:[^\]]*\]/gi,
  // Multi-line blocks for HAIR, BODY, OUTFIT that appear on separate lines
  /\nHAIR:[^\n]*(?:\n[^\n\[]*)*?(?=\n\[|\n\n|$)/gi,
  /\nBODY:[^\n]*(?:\n[^\n\[]*)*?(?=\n\[|\n\n|$)/gi,
  /\nOUTFIT:[^\n]*(?:\n[^\n\[]*)*?(?=\n\[|\n\n|$)/gi,
  /\nFACE:[^\n]*(?:\n[^\n\[]*)*?(?=\n\[|\n\n|$)/gi,
];

function stripExistingBlocks(prompt: string): string {
  let cleaned = prompt;
  
  // Apply each pattern
  for (const pattern of BLOCK_PATTERNS_TO_STRIP) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remove orphaned bracket blocks we might have missed
  cleaned = cleaned.replace(/\[[A-Z][A-Z\s\-_:]*[^\]]*\]/gi, (match) => {
    // Keep the actual shot description (doesn't start with uppercase block patterns)
    const blockPatterns = ['CHARACTER', 'IDENTITY', 'FACE', 'SCENE', 'COLOR', 'LIGHTING', 'MATCH', 'CRITICAL', 'VISUAL', 'CONSISTENCY', 'CAMERA', 'LENS', 'PHYSICS', 'CONTINUE', 'MANDATORY', 'MULTI-VIEW', 'VIEW', 'LOCKED', 'EXACT'];
    const startsWithBlock = blockPatterns.some(p => match.toUpperCase().includes(`[${p}`));
    return startsWithBlock ? '' : match;
  });
  
  // Remove multiple newlines and extra spaces
  return cleaned.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();
}

// =============================================================================
// MAIN BUILDER FUNCTION
// =============================================================================

export function buildComprehensivePrompt(request: PromptBuildRequest): BuiltPrompt {
  const warnings: string[] = [];
  const promptParts: string[] = [];
  const negativeParts: string[] = [...BASE_QUALITY_NEGATIVES];
  
  // CRITICAL: Strip pre-existing identity blocks from base prompt to prevent duplication
  const cleanedBasePrompt = stripExistingBlocks(request.basePrompt);
  
  // ===========================================================================
  // SUBJECT DETECTION - Determine if prompt is about characters or objects/scenes
  // If the subject is NOT a human/character, we SKIP all identity injection
  // This prevents "space shuttle" prompts from generating "man in warehouse"
  // ===========================================================================
  const subjectAnalysis = detectPrimarySubject(cleanedBasePrompt);
  const skipCharacterInjection = subjectAnalysis.type === 'object' || subjectAnalysis.type === 'scene' || subjectAnalysis.type === 'vehicle';
  
  if (skipCharacterInjection) {
    console.log(`[PromptBuilder] ⚡ SUBJECT DETECTED: "${subjectAnalysis.subject}" (${subjectAnalysis.type}) - SKIPPING all character/identity injection`);
  }
  
  // Detect pose from prompt (only relevant for character prompts)
  const poseAnalysis = request.detectedPose 
    ? { pose: request.detectedPose, confidence: 100, faceVisible: !['back', 'silhouette', 'occluded'].includes(request.detectedPose) }
    : detectPoseFromPrompt(request.basePrompt);
  
  const isBackFacingOrOccluded = !poseAnalysis.faceVisible;
  
  // ===========================================================================
  // ⭐ SHOT ACTION FIRST - THE MOST CRITICAL CHANGE
  // User's requested action is ALWAYS the PRIMARY content, injected FIRST
  // This ensures the AI model prioritizes the ACTION over any identity data
  // ===========================================================================
  const dramaticActionPatterns = [
    /\b(asteroid|meteor|comet)\s*(impact|crash|strike|hit|collid)/i,
    /\b(explosion|blast|eruption|detonate)/i,
    /\b(attack|battle|fight|combat|war)/i,
    /\b(storm|hurricane|tornado|tsunami|earthquake)/i,
    /\b(transform|metamorphos|evolve)/i,
    /\b(chase|pursuit|escape|flee)/i,
    /\b(launch|takeoff|liftoff|blast[\s-]?off)/i,
    /\b(rocket|shuttle|spacecraft|spaceship)\s*(launch|takeoff|ascending)/i,
  ];
  
  const hasDramaticAction = dramaticActionPatterns.some(p => p.test(cleanedBasePrompt));
  
  // INJECT ACTION FIRST - before any identity blocks
  if (cleanedBasePrompt.length > 20) {
    if (hasDramaticAction || skipCharacterInjection) {
      // For dramatic actions OR non-character subjects: MAXIMUM priority
      promptParts.push(`[═══ PRIMARY SUBJECT - THIS IS WHAT THE VIDEO MUST SHOW ═══]`);
      promptParts.push(cleanedBasePrompt);
      promptParts.push(`[═══ END PRIMARY SUBJECT ═══]`);
      console.log(`[PromptBuilder] Clip ${request.clipIndex + 1} ACTION-FIRST: "${cleanedBasePrompt.substring(0, 80)}..."`);
    } else {
      // Standard: action first but without dramatic emphasis
      promptParts.push(`[SHOT ACTION: ${cleanedBasePrompt}]`);
    }
  }
  
  // ===========================================================================
  // MOTION DETECTION AND ENFORCEMENT
  // Detects walking, running, exploring, etc. and enforces motion in the clip
  // ===========================================================================
  const motionAnalysis = detectMotionFromPrompt(request.basePrompt);
  
  if (motionAnalysis.hasMotion) {
    promptParts.push(motionAnalysis.motionEnforcementPrompt);
    negativeParts.push(...motionAnalysis.motionNegatives);
    console.log(`[PromptBuilder] Clip ${request.clipIndex + 1} MOTION DETECTED: ${motionAnalysis.detectedActions.join(', ')} (${motionAnalysis.intensity} intensity)`);
  } else {
    warnings.push('No motion detected in prompt - character may appear static');
  }
  
  // ===========================================================================
  // 0. FACE LOCK INJECTION (ONLY FOR CHARACTER PROMPTS)
  // SKIP entirely for object/scene/vehicle prompts
  // ===========================================================================
  let hasFaceLock = false;
  const fl = request.faceLock;
  
  if (fl && !skipCharacterInjection) {
    hasFaceLock = true;
    
    // Golden reference is the single most important identity sentence
    if (fl.goldenReference) {
      promptParts.push(`[FACE LOCK - DO NOT CHANGE THIS FACE: ${fl.goldenReference}]`);
    }
    
    // Full face description
    if (fl.fullFaceDescription) {
      promptParts.push(`[EXACT FACE: ${fl.fullFaceDescription}]`);
    }
    
    // Key facial features
    const faceDetails: string[] = [];
    if (fl.eyeDescription) faceDetails.push(`EYES: ${fl.eyeDescription}`);
    if (fl.skinTone) faceDetails.push(`SKIN: ${fl.skinTone}`);
    if (fl.faceShape) faceDetails.push(`FACE SHAPE: ${fl.faceShape}`);
    if (fl.hairColorExact) faceDetails.push(`HAIR: ${fl.hairColorExact}`);
    if (fl.distinguishingFeatures?.length) {
      faceDetails.push(`DISTINCTIVE: ${fl.distinguishingFeatures.join(', ')}`);
    }
    
    if (faceDetails.length > 0) {
      promptParts.push(`[LOCKED FACIAL FEATURES: ${faceDetails.join(' | ')}]`);
    }
    
    // Face-specific negatives (CRITICAL)
    if (fl.faceNegatives?.length) {
      negativeParts.push(...fl.faceNegatives);
    } else {
      // Default face negatives
      negativeParts.push(
        'different face',
        'changed eyes',
        'different eye color',
        'different nose',
        'different lips',
        'different skin tone',
        'aged face',
        'younger face',
        'different facial structure',
        'morphed features',
        'face swap',
        'different person',
        'altered appearance',
        'changed bone structure',
        'different ethnicity'
      );
    }
  }
  
  // ===========================================================================
  // 0.5 HARD IDENTITY LOCK - Reinforce same person continuation
  // SKIP for non-character prompts
  // ===========================================================================
  if (request.clipIndex > 0 && !skipCharacterInjection) {
    // For clips 2+, enforce same character from previous frame
    promptParts.push('[CRITICAL: SAME EXACT PERSON continues from previous frame - identical face, same body, same outfit, same hair]');
  }
  
  // ===========================================================================
  // 0.75 MULTI-VIEW IDENTITY BIBLE (5-ANGLE CHARACTER CONSISTENCY)
  // Injects pose-specific identity when Multi-View Bible is available
  // SKIP for non-character prompts
  // ===========================================================================
  let hasMultiViewIdentity = false;
  const mvib = request.multiViewIdentityBible;
  
  if (mvib && !skipCharacterInjection) {
    hasMultiViewIdentity = true;
    
    // Core identity is ALWAYS injected
    if (mvib.coreIdentity?.description) {
      promptParts.push(`[MULTI-VIEW IDENTITY: ${mvib.coreIdentity.description}]`);
    }
    
    // Master consistency prompt
    if (mvib.masterConsistencyPrompt) {
      promptParts.push(`[CHARACTER CONSISTENCY: ${mvib.masterConsistencyPrompt}]`);
    }
    
    // Inject POSE-SPECIFIC view description
    const poseViewMap: Record<string, keyof NonNullable<typeof mvib.views>> = {
      'front': 'front',
      'side': 'side',
      'three-quarter': 'threeQuarter',
      'back': 'back',
      'silhouette': 'silhouette',
      'occluded': 'silhouette',
    };
    
    const viewKey = poseViewMap[poseAnalysis.pose];
    const viewData = viewKey && mvib.views?.[viewKey];
    
    if (viewData) {
      // Inject view-specific description
      if (viewData.description) {
        promptParts.push(`[${viewData.viewType?.toUpperCase() || poseAnalysis.pose.toUpperCase()} VIEW: ${viewData.description}]`);
      }
      
      // View-specific anchors
      if (viewData.consistencyAnchors?.length) {
        promptParts.push(`[VIEW ANCHORS: ${viewData.consistencyAnchors.join(', ')}]`);
      }
      
      // View-specific negatives
      if (viewData.negativePrompts?.length) {
        negativeParts.push(...viewData.negativePrompts);
      }
    }
    
    // For back/occluded poses, inject enhanced non-facial anchors from Multi-View
    if (isBackFacingOrOccluded && mvib.nonFacialAnchors) {
      const mvNfa = mvib.nonFacialAnchors;
      const mvNfaParts: string[] = [];
      
      // Hair from behind (CRITICAL for back views)
      if (mvNfa.hairFromBehind) {
        mvNfaParts.push(`HAIR BACK VIEW: ${mvNfa.hairFromBehind}`);
      }
      
      // Back view markers
      if (mvNfa.backViewMarkers) {
        mvNfaParts.push(`BACK MARKERS: ${mvNfa.backViewMarkers}`);
      }
      
      // Silhouette
      if (mvNfa.overallSilhouette) {
        mvNfaParts.push(`SILHOUETTE: ${mvNfa.overallSilhouette}`);
      }
      
      // Clothing from all angles
      if (mvNfa.clothingDescription) {
        mvNfaParts.push(`OUTFIT: ${mvNfa.clothingDescription}`);
      }
      
      if (mvNfaParts.length > 0) {
        promptParts.push(`[MULTI-VIEW NON-FACIAL: ${mvNfaParts.join(' | ')}]`);
      }
    }
    
    // Global occlusion negatives from Multi-View
    if (mvib.occlusionNegatives?.length) {
      negativeParts.push(...mvib.occlusionNegatives);
    }
  }
  
  // ===========================================================================
  // 1. IDENTITY BIBLE INJECTION
  // SKIP entirely for non-character prompts (objects, vehicles, scenes)
  // ===========================================================================
  const ib = request.identityBible;
  let hasIdentityBible = false;
  let hasNonFacialAnchors = false;
  
  if (ib && !skipCharacterInjection) {
    hasIdentityBible = true;
    
    // CHARACTER IDENTITY: Focus ONLY on the person/character - NOT the environment
    // Use characterIdentity.description if available (pure character info)
    // Fallback to characterDescription, but AVOID using consistencyPrompt directly
    // as it often contains environment info that drowns out the shot action
    const charDesc = ib.characterIdentity?.description 
      || ib.characterDescription 
      // Only use consistencyPrompt if it appears to be about a character (not just environment)
      || (ib.consistencyPrompt && ib.consistencyPrompt.toLowerCase().includes('person') 
          ? ib.consistencyPrompt.split('.').slice(0, 3).join('.') // Take first few sentences only
          : undefined);
    
    if (charDesc) {
      // For clip 1+, add "SAME PERSON AS BEFORE" emphasis
      const samePersonPrefix = request.clipIndex > 0 ? 'SAME PERSON AS PREVIOUS CLIP - ' : '';
      promptParts.push(`[CHARACTER IDENTITY - DO NOT CHANGE: ${samePersonPrefix}${charDesc}]`);
    } else {
      warnings.push('Identity Bible exists but has no characterDescription - shot action will dominate');
    }
    
    // Character identity details (clothing, features)
    if (ib.characterIdentity) {
      const ci = ib.characterIdentity;
      const details: string[] = [];
      if (ci.clothing) details.push(`Clothing: ${ci.clothing}`);
      if (ci.bodyType) details.push(`Build: ${ci.bodyType}`);
      if (ci.hairColor) details.push(`Hair: ${ci.hairColor}`);
      if (ci.distinctiveMarkers?.length) details.push(`Distinctive: ${ci.distinctiveMarkers.join(', ')}`);
      
      if (details.length > 0) {
        promptParts.push(`[VISUAL ANCHORS: ${details.join('. ')}]`);
      }
    }
    
    // Consistency anchors
    if (ib.consistencyAnchors?.length) {
      promptParts.push(`[CONSISTENCY LOCK: ${ib.consistencyAnchors.join(', ')}]`);
    }
    
    // ===========================================================================
    // NON-FACIAL ANCHORS (CRITICAL for back-facing/occluded shots)
    // ===========================================================================
    if (isBackFacingOrOccluded && ib.nonFacialAnchors) {
      hasNonFacialAnchors = true;
      const nfa = ib.nonFacialAnchors;
      
      const nfaParts: string[] = ['[IDENTITY LOCK - NON-FACIAL ANCHORS]'];
      
      // Body
      if (nfa.bodyType || nfa.bodyProportions || nfa.posture) {
        nfaParts.push(`BODY: ${[nfa.bodyType, nfa.bodyProportions, nfa.posture].filter(Boolean).join(', ')}`);
      }
      
      // Clothing (CRITICAL)
      if (nfa.clothingDescription || nfa.clothingSignature) {
        nfaParts.push(`CLOTHING: ${nfa.clothingDescription || nfa.clothingSignature}`);
      }
      if (nfa.clothingColors?.length) {
        nfaParts.push(`CLOTHING COLORS: ${nfa.clothingColors.join(', ')}`);
      }
      if (nfa.clothingDistinctive) {
        nfaParts.push(`DISTINCTIVE CLOTHING: ${nfa.clothingDistinctive}`);
      }
      
      // Hair from behind
      if (nfa.hairFromBehind) {
        nfaParts.push(`HAIR FROM BEHIND: ${nfa.hairFromBehind}`);
      } else if (nfa.hairColor && nfa.hairStyle) {
        nfaParts.push(`HAIR: ${nfa.hairColor} ${nfa.hairLength || ''} ${nfa.hairStyle}`);
      }
      
      // Back view markers
      if (nfa.backViewMarkers) {
        nfaParts.push(`BACK MARKERS: ${nfa.backViewMarkers}`);
      }
      
      // Silhouette
      if (nfa.overallSilhouette || nfa.silhouetteDescription) {
        nfaParts.push(`SILHOUETTE: ${nfa.overallSilhouette || nfa.silhouetteDescription}`);
      }
      
      // Accessories
      if (nfa.accessories?.length) {
        nfaParts.push(`ACCESSORIES: ${nfa.accessories.join(', ')}`);
      }
      
      nfaParts.push('[END IDENTITY LOCK]');
      promptParts.push(nfaParts.join('\n'));
    } else if (isBackFacingOrOccluded && !ib.nonFacialAnchors) {
      warnings.push('Back-facing/occluded shot detected but no nonFacialAnchors available');
    }
    
    // ===========================================================================
    // ANTI-MORPHING NEGATIVES (ALWAYS ADDED)
    // ===========================================================================
    const antiMorphing = ib.antiMorphingPrompts?.length 
      ? ib.antiMorphingPrompts 
      : DEFAULT_ANTI_MORPHING_PROMPTS;
    negativeParts.push(...antiMorphing);
    
    // ===========================================================================
    // OCCLUSION NEGATIVES (ADDED WHEN FACE NOT VISIBLE)
    // ===========================================================================
    if (isBackFacingOrOccluded) {
      const occlusionNegs = ib.occlusionNegatives?.length 
        ? ib.occlusionNegatives 
        : DEFAULT_OCCLUSION_NEGATIVES;
      negativeParts.push(...occlusionNegs);
    }
  } else if (request.clipIndex > 0) {
    warnings.push('CRITICAL: No Identity Bible for clip ' + (request.clipIndex + 1));
  }
  
  // ===========================================================================
  // 2. EXTRACTED CHARACTERS INJECTION
  // SKIP for non-character prompts
  // ===========================================================================
  let hasExtractedCharacters = false;
  if (request.extractedCharacters?.length && !skipCharacterInjection) {
    hasExtractedCharacters = true;
    const charDescriptions = request.extractedCharacters.map(c => {
      const parts = [c.name];
      if (c.appearance) parts.push(c.appearance);
      if (c.clothing) parts.push(`wearing ${c.clothing}`);
      if (c.distinguishingFeatures) parts.push(c.distinguishingFeatures);
      return parts.join(': ');
    });
    promptParts.push(`[CHARACTERS: ${charDescriptions.join('; ')}]`);
  }
  
  // ===========================================================================
  // 3. MASTER SCENE ANCHOR (SCENE DNA from clip 1)
  // ===========================================================================
  let hasMasterSceneAnchor = false;
  if (request.masterSceneAnchor) {
    hasMasterSceneAnchor = true;
    const msa = request.masterSceneAnchor;
    
    if (msa.masterConsistencyPrompt) {
      promptParts.push(`[SCENE DNA: ${msa.masterConsistencyPrompt}]`);
    }
    
    if (msa.lighting) {
      promptParts.push(`[MASTER LIGHTING: ${msa.lighting}]`);
    }
    
    if (msa.colorPalette) {
      const colors = Array.isArray(msa.colorPalette) ? msa.colorPalette.join(', ') : msa.colorPalette;
      promptParts.push(`[COLOR PALETTE: ${colors}]`);
    }
  }
  
  // ===========================================================================
  // 4. CONTINUITY MANIFEST FROM PREVIOUS CLIP
  // ===========================================================================
  let hasContinuityManifest = false;
  if (request.previousContinuityManifest && request.clipIndex > 0) {
    hasContinuityManifest = true;
    const cm = request.previousContinuityManifest;
    
    // Lighting continuity
    if (cm.lighting) {
      const lightingDesc = [
        cm.lighting.ambientLevel,
        cm.lighting.colorTemperature,
        cm.lighting.keyLightDirection ? `light from ${cm.lighting.keyLightDirection}` : null,
      ].filter(Boolean).join(', ');
      
      if (lightingDesc) {
        promptParts.push(`[MATCH LIGHTING: ${lightingDesc}]`);
      }
    }
    
    // Environment continuity
    if (cm.environment?.setting) {
      promptParts.push(`[MATCH ENVIRONMENT: ${cm.environment.setting}]`);
    }
    
    // Critical anchors
    if (cm.criticalAnchors?.length) {
      promptParts.push(`[CRITICAL ANCHORS: ${cm.criticalAnchors.join(', ')}]`);
    }
    
    // Action continuity
    if (cm.action?.expectedContinuation) {
      promptParts.push(`[CONTINUE ACTION: ${cm.action.expectedContinuation}]`);
    }
  }
  
  // ===========================================================================
  // 5. MOTION VECTORS FROM PREVIOUS CLIP
  // ===========================================================================
  let hasMotionVectors = false;
  if (request.previousMotionVectors && request.clipIndex > 0) {
    hasMotionVectors = true;
    const mv = request.previousMotionVectors;
    
    if (mv.continuityPrompt) {
      promptParts.push(`[MANDATORY CONTINUATION: ${mv.continuityPrompt}]`);
    } else {
      const motionParts: string[] = [];
      if (mv.exitMotion) motionParts.push(`Exit pose: ${mv.exitMotion}`);
      if (mv.dominantDirection) motionParts.push(`Direction: ${mv.dominantDirection}`);
      if (mv.cameraMomentum) motionParts.push(`Camera: ${mv.cameraMomentum}`);
      
      if (motionParts.length > 0) {
        promptParts.push(`[MATCH MOTION: ${motionParts.join(', ')}]`);
      }
    }
  }
  
  // ===========================================================================
  // 6. SCENE CONTEXT (current scene)
  // ===========================================================================
  if (request.sceneContext) {
    const sc = request.sceneContext;
    const contextParts: string[] = [];
    
    if (sc.lighting) contextParts.push(`Lighting: ${sc.lighting}`);
    if (sc.colorPalette) contextParts.push(`Colors: ${sc.colorPalette}`);
    if (sc.environment) contextParts.push(`Environment: ${sc.environment}`);
    if (sc.mood) contextParts.push(`Mood: ${sc.mood}`);
    if (sc.timeOfDay) contextParts.push(`Time: ${sc.timeOfDay}`);
    
    if (contextParts.length > 0) {
      promptParts.push(`[SCENE: ${contextParts.join('. ')}]`);
    }
  }
  
  // ===========================================================================
  // 7. QUALITY SUFFIX (Action is already injected FIRST at the top of this function)
  // ===========================================================================
  promptParts.push(APEX_QUALITY_SUFFIX);
  
  // ===========================================================================
  // 8. USER NEGATIVE PROMPT
  // ===========================================================================
  if (request.userNegativePrompt) {
    negativeParts.push(...request.userNegativePrompt.split(',').map(s => s.trim()));
  }
  
  // ===========================================================================
  // FINAL ASSEMBLY WITH LENGTH OPTIMIZATION
  // Kling models work best with prompts under 1000 chars for video generation
  // 
  // GUARDRAIL: NEVER strip dramatic action content - user's request is sacred
  // ===========================================================================
  
  // Prioritize critical identity and scene data, trim excess
  let assembledPrompt = promptParts.join('\n\n');
  
  // If prompt is too long, compress by removing verbose sections
  const MAX_PROMPT_LENGTH = 1500; // Kling's effective window is ~200 words / ~1200 chars; 1500 gives buffer
  if (assembledPrompt.length > MAX_PROMPT_LENGTH) {
    // Remove lower priority blocks first (in order of priority)
    // CRITICAL: We NEVER remove SHOT ACTION or MANDATORY ACTION blocks
    const lowPriorityPatterns = [
      /\[SCENE: [^\]]*\]/gi,           // Scene context (least critical)
      /\[MATCH MOTION: [^\]]*\]/gi,     // Motion matching
      /\[MATCH ENVIRONMENT: [^\]]*\]/gi, // Environment matching
      /\[MATCH LIGHTING: [^\]]*\]/gi,   // Lighting matching
      /\[CRITICAL ANCHORS: [^\]]*\]/gi, // Critical anchors
      /\[COLOR PALETTE: [^\]]*\]/gi,    // Color palette
      /\[SCENE DNA: [^\]]*\]/gi,        // Scene DNA
      /\[MASTER LIGHTING: [^\]]*\]/gi,  // Master lighting
      /\[CONTINUE ACTION: [^\]]*\]/gi,  // Continue action
      /\[VISUAL ANCHORS: [^\]]*\]/gi,   // Visual anchors
      /\[VIEW ANCHORS: [^\]]*\]/gi,     // View anchors
    ];
    
    for (const pattern of lowPriorityPatterns) {
      if (assembledPrompt.length <= MAX_PROMPT_LENGTH) break;
      assembledPrompt = assembledPrompt.replace(pattern, '');
    }
    
    // If still too long, try removing secondary identity blocks (keep face lock and shot action)
    if (assembledPrompt.length > MAX_PROMPT_LENGTH) {
      const secondaryIdentityPatterns = [
        /\[CONSISTENCY LOCK: [^\]]*\]/gi,
        /\[MULTI-VIEW NON-FACIAL: [^\]]*\]/gi,
        /\[CHARACTER CONSISTENCY: [^\]]*\]/gi,
      ];
      
      for (const pattern of secondaryIdentityPatterns) {
        if (assembledPrompt.length <= MAX_PROMPT_LENGTH) break;
        assembledPrompt = assembledPrompt.replace(pattern, '');
      }
    }
    
    // LAST RESORT: If STILL too long, truncate quality suffix, NEVER the action
    if (assembledPrompt.length > MAX_PROMPT_LENGTH) {
      // Check if this has a dramatic action - if so, PROTECT IT
      const hasMandatoryAction = /\[═══ MANDATORY ACTION/.test(assembledPrompt);
      
      if (hasMandatoryAction) {
        // Only strip quality suffix, keep the action intact
        const qualitySuffixStart = assembledPrompt.indexOf(', cinematic lighting');
        if (qualitySuffixStart > 0) {
          // Shorten quality suffix to just essentials
          assembledPrompt = assembledPrompt.substring(0, qualitySuffixStart) + ', cinematic 8K, detailed';
        }
        console.log(`[PromptBuilder] PROTECTED mandatory action during compression`);
      } else {
        // Standard compression for non-dramatic actions
        const qualitySuffixIndex = assembledPrompt.indexOf(', cinematic lighting');
        if (qualitySuffixIndex > 0) {
          const beforeQuality = assembledPrompt.substring(0, qualitySuffixIndex);
          const qualitySuffix = assembledPrompt.substring(qualitySuffixIndex);
          
          // Keep as much as we can fit
          const availableSpace = MAX_PROMPT_LENGTH - qualitySuffix.length - 50;
          assembledPrompt = beforeQuality.substring(0, availableSpace) + '...' + qualitySuffix;
        }
      }
    }
    
    warnings.push(`Prompt compressed from ${promptParts.join('\n\n').length} to ${assembledPrompt.length} chars`);
  }
  
  const enhancedPrompt = assembledPrompt.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();
  const negativePrompt = [...new Set(negativeParts)].join(', '); // Deduplicate
  
  return {
    enhancedPrompt,
    negativePrompt,
    injectionSummary: {
      hasFaceLock,
      hasMultiViewIdentity,
      hasIdentityBible,
      hasNonFacialAnchors,
      hasAntiMorphing: true, // Always added
      hasOcclusionNegatives: isBackFacingOrOccluded,
      hasContinuityManifest,
      hasMotionVectors,
      hasMasterSceneAnchor,
      hasExtractedCharacters,
      hasMotionEnforcement: motionAnalysis.hasMotion,
      motionIntensity: motionAnalysis.intensity,
      motionType: motionAnalysis.motionType,
      poseDetected: poseAnalysis.pose,
      warningsCount: warnings.length,
      warnings,
    },
  };
}

// =============================================================================
// VALIDATION HELPER
// =============================================================================

export interface PipelineValidation {
  isValid: boolean;
  criticalMissing: string[];
  warnings: string[];
  dataPresent: string[];
}

export function validatePipelineData(
  clipIndex: number,
  identityBible?: IdentityBible,
  previousClipData?: {
    lastFrameUrl?: string;
    motionVectors?: MotionVectors;
    continuityManifest?: ContinuityManifest;
  },
  masterSceneAnchor?: MasterSceneAnchor
): PipelineValidation {
  const criticalMissing: string[] = [];
  const warnings: string[] = [];
  const dataPresent: string[] = [];
  
  // Check identity bible
  if (!identityBible) {
    if (clipIndex > 0) {
      criticalMissing.push('identityBible');
    } else {
      warnings.push('No identityBible for clip 1 (acceptable if no reference image)');
    }
  } else {
    dataPresent.push('identityBible');
    
    if (!identityBible.characterDescription && !identityBible.consistencyPrompt) {
      warnings.push('identityBible has no characterDescription');
    }
    if (!identityBible.nonFacialAnchors) {
      warnings.push('identityBible has no nonFacialAnchors (back-facing shots may have issues)');
    }
    if (!identityBible.antiMorphingPrompts?.length) {
      warnings.push('identityBible has no antiMorphingPrompts (using defaults)');
    }
  }
  
  // Check previous clip data (for clip 2+)
  if (clipIndex > 0) {
    if (!previousClipData?.lastFrameUrl) {
      criticalMissing.push('previousClip.lastFrameUrl');
    } else {
      dataPresent.push('previousClip.lastFrameUrl');
    }
    
    if (!previousClipData?.motionVectors) {
      warnings.push('No motionVectors from previous clip');
    } else {
      dataPresent.push('previousClip.motionVectors');
    }
    
    if (!previousClipData?.continuityManifest) {
      warnings.push('No continuityManifest from previous clip');
    } else {
      dataPresent.push('previousClip.continuityManifest');
    }
  }
  
  // Check master scene anchor (for clip 2+)
  if (clipIndex > 0 && !masterSceneAnchor) {
    warnings.push('No masterSceneAnchor (scene DNA) for visual consistency');
  } else if (masterSceneAnchor) {
    dataPresent.push('masterSceneAnchor');
  }
  
  return {
    isValid: criticalMissing.length === 0,
    criticalMissing,
    warnings,
    dataPresent,
  };
}

// =============================================================================
// LOGGING HELPER
// =============================================================================

export function logPipelineState(
  clipIndex: number,
  validation: PipelineValidation,
  builtPrompt: BuiltPrompt
): void {
  const prefix = `[PromptBuilder] Clip ${clipIndex + 1}`;
  
  console.log(`${prefix} ═══════════════════════════════════════════════════`);
  console.log(`${prefix} DATA PRESENT: ${validation.dataPresent.join(', ') || 'NONE'}`);
  
  if (validation.criticalMissing.length > 0) {
    console.error(`${prefix} ❌ CRITICAL MISSING: ${validation.criticalMissing.join(', ')}`);
  }
  
  if (validation.warnings.length > 0) {
    console.warn(`${prefix} ⚠️ WARNINGS: ${validation.warnings.join('; ')}`);
  }
  
  console.log(`${prefix} INJECTION SUMMARY:`);
  console.log(`${prefix}   - Face Lock: ${builtPrompt.injectionSummary.hasFaceLock ? '✓ LOCKED' : '✗'}`);
  console.log(`${prefix}   - Multi-View Identity: ${builtPrompt.injectionSummary.hasMultiViewIdentity ? '✓ 5-VIEW' : '✗'}`);
  console.log(`${prefix}   - Identity Bible: ${builtPrompt.injectionSummary.hasIdentityBible ? '✓' : '✗'}`);
  console.log(`${prefix}   - Non-Facial Anchors: ${builtPrompt.injectionSummary.hasNonFacialAnchors ? '✓' : '✗'}`);
  console.log(`${prefix}   - Anti-Morphing: ${builtPrompt.injectionSummary.hasAntiMorphing ? '✓' : '✗'}`);
  console.log(`${prefix}   - Occlusion Negatives: ${builtPrompt.injectionSummary.hasOcclusionNegatives ? '✓' : 'N/A'}`);
  console.log(`${prefix}   - Continuity Manifest: ${builtPrompt.injectionSummary.hasContinuityManifest ? '✓' : '✗'}`);
  console.log(`${prefix}   - Motion Vectors: ${builtPrompt.injectionSummary.hasMotionVectors ? '✓' : '✗'}`);
  console.log(`${prefix}   - Master Scene Anchor: ${builtPrompt.injectionSummary.hasMasterSceneAnchor ? '✓' : '✗'}`);
  console.log(`${prefix}   - Motion Enforcement: ${builtPrompt.injectionSummary.hasMotionEnforcement ? `✓ ${builtPrompt.injectionSummary.motionType} (${builtPrompt.injectionSummary.motionIntensity})` : '✗ STATIC'}`);
  console.log(`${prefix}   - Pose Detected: ${builtPrompt.injectionSummary.poseDetected}`);
  console.log(`${prefix} PROMPT LENGTH: ${builtPrompt.enhancedPrompt.length} chars`);
  console.log(`${prefix} NEGATIVE LENGTH: ${builtPrompt.negativePrompt.length} chars`);
  console.log(`${prefix} ═══════════════════════════════════════════════════`);
}
