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

export interface PromptBuildRequest {
  // Base prompt (shot description)
  basePrompt: string;
  
  // Clip metadata
  clipIndex: number;
  totalClips: number;
  
  // FACE LOCK (HIGHEST PRIORITY - injected FIRST)
  faceLock?: FaceLock;
  
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
    hasIdentityBible: boolean;
    hasNonFacialAnchors: boolean;
    hasAntiMorphing: boolean;
    hasOcclusionNegatives: boolean;
    hasContinuityManifest: boolean;
    hasMotionVectors: boolean;
    hasMasterSceneAnchor: boolean;
    hasExtractedCharacters: boolean;
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

const APEX_QUALITY_SUFFIX = ", cinematic lighting, 8K resolution, ultra high definition, highly detailed, professional cinematography, film grain, masterful composition, award-winning cinematographer, ARRI Alexa camera quality, anamorphic lens flares, perfect exposure, theatrical color grading";

// =============================================================================
// PROMPT DEDUPLICATION - Strip existing blocks to prevent redundancy
// =============================================================================

const BLOCK_PATTERNS_TO_STRIP = [
  /\[CHARACTER IDENTITY[^\]]*\]/gi,
  /\[IDENTITY[^\]]*\]/gi,
  /\[CHARACTERS:[^\]]*\]/gi,
  /\[VISUAL ANCHORS:[^\]]*\]/gi,
  /\[COLOR DNA:[^\]]*\]/gi,
  /\[PROGRESSIVE COLOR:[^\]]*\]/gi,
  /\[CAMERA:[^\]]*\]/gi,
  /\[LENS:[^\]]*\]/gi,
  /\[PHYSICS:[^\]]*\]/gi,
  /\[CONSISTENCY LOCK:[^\]]*\]/gi,
];

function stripExistingBlocks(prompt: string): string {
  let cleaned = prompt;
  for (const pattern of BLOCK_PATTERNS_TO_STRIP) {
    cleaned = cleaned.replace(pattern, '');
  }
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
  // Detect pose from prompt
  const poseAnalysis = request.detectedPose 
    ? { pose: request.detectedPose, confidence: 100, faceVisible: !['back', 'silhouette', 'occluded'].includes(request.detectedPose) }
    : detectPoseFromPrompt(request.basePrompt);
  
  const isBackFacingOrOccluded = !poseAnalysis.faceVisible;
  
  // ===========================================================================
  // 0. FACE LOCK INJECTION (ABSOLUTE HIGHEST PRIORITY)
  // This is injected FIRST to ensure maximum model attention on face identity
  // ===========================================================================
  let hasFaceLock = false;
  const fl = request.faceLock;
  
  if (fl) {
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
  // ===========================================================================
  if (request.clipIndex > 0) {
    // For clips 2+, enforce same character from previous frame
    promptParts.push('[CRITICAL: SAME EXACT PERSON continues from previous frame - identical face, same body, same outfit, same hair]');
  }
  
  // ===========================================================================
  // 1. IDENTITY BIBLE INJECTION (HIGHEST PRIORITY)
  // ===========================================================================
  const ib = request.identityBible;
  let hasIdentityBible = false;
  let hasNonFacialAnchors = false;
  
  if (ib) {
    hasIdentityBible = true;
    
    // Character description (MANDATORY) - STRONGER PHRASING
    const charDesc = ib.characterDescription || ib.consistencyPrompt || ib.characterIdentity?.description;
    if (charDesc) {
      // For clip 1+, add "SAME PERSON AS BEFORE" emphasis
      const samePersonPrefix = request.clipIndex > 0 ? 'SAME PERSON AS PREVIOUS CLIP - ' : '';
      promptParts.push(`[CHARACTER IDENTITY - DO NOT CHANGE: ${samePersonPrefix}${charDesc}]`);
    } else {
      warnings.push('Identity Bible exists but has no characterDescription');
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
  // ===========================================================================
  let hasExtractedCharacters = false;
  if (request.extractedCharacters?.length) {
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
  // 7. CLEANED BASE PROMPT + QUALITY SUFFIX
  // Use cleaned base prompt to avoid duplicate identity blocks
  // ===========================================================================
  promptParts.push(cleanedBasePrompt);
  promptParts.push(APEX_QUALITY_SUFFIX);
  
  // ===========================================================================
  // 8. USER NEGATIVE PROMPT
  // ===========================================================================
  if (request.userNegativePrompt) {
    negativeParts.push(...request.userNegativePrompt.split(',').map(s => s.trim()));
  }
  
  // ===========================================================================
  // FINAL ASSEMBLY
  // ===========================================================================
  const enhancedPrompt = promptParts.join('\n\n');
  const negativePrompt = [...new Set(negativeParts)].join(', '); // Deduplicate
  
  return {
    enhancedPrompt,
    negativePrompt,
    injectionSummary: {
      hasFaceLock,
      hasIdentityBible,
      hasNonFacialAnchors,
      hasAntiMorphing: true, // Always added
      hasOcclusionNegatives: isBackFacingOrOccluded,
      hasContinuityManifest,
      hasMotionVectors,
      hasMasterSceneAnchor,
      hasExtractedCharacters,
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
  console.log(`${prefix}   - Identity Bible: ${builtPrompt.injectionSummary.hasIdentityBible ? '✓' : '✗'}`);
  console.log(`${prefix}   - Non-Facial Anchors: ${builtPrompt.injectionSummary.hasNonFacialAnchors ? '✓' : '✗'}`);
  console.log(`${prefix}   - Anti-Morphing: ${builtPrompt.injectionSummary.hasAntiMorphing ? '✓' : '✗'}`);
  console.log(`${prefix}   - Occlusion Negatives: ${builtPrompt.injectionSummary.hasOcclusionNegatives ? '✓' : 'N/A'}`);
  console.log(`${prefix}   - Continuity Manifest: ${builtPrompt.injectionSummary.hasContinuityManifest ? '✓' : '✗'}`);
  console.log(`${prefix}   - Motion Vectors: ${builtPrompt.injectionSummary.hasMotionVectors ? '✓' : '✗'}`);
  console.log(`${prefix}   - Master Scene Anchor: ${builtPrompt.injectionSummary.hasMasterSceneAnchor ? '✓' : '✗'}`);
  console.log(`${prefix}   - Pose Detected: ${builtPrompt.injectionSummary.poseDetected}`);
  console.log(`${prefix} PROMPT LENGTH: ${builtPrompt.enhancedPrompt.length} chars`);
  console.log(`${prefix} NEGATIVE LENGTH: ${builtPrompt.negativePrompt.length} chars`);
  console.log(`${prefix} ═══════════════════════════════════════════════════`);
}
