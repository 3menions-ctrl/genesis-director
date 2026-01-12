/**
 * Consistency Engine
 * 
 * Centralized utilities for character and scene consistency in video generation.
 * Includes pose detection, view selection, and scene DNA management.
 */

// =====================================================
// POSE DETECTION - Analyze prompts to determine character orientation
// =====================================================

export type DetectedPose = 
  | 'front' 
  | 'side' 
  | 'back' 
  | 'three-quarter' 
  | 'silhouette' 
  | 'occluded'
  | 'unknown';

export interface PoseAnalysis {
  detectedPose: DetectedPose;
  confidence: number; // 0-100
  faceVisible: boolean;
  bodyVisible: boolean;
  recommendedView: 'front' | 'side' | 'back' | 'three-quarter' | 'silhouette';
  promptIndicators: string[];
}

// Patterns that indicate character orientation
const POSE_PATTERNS: { pattern: RegExp; pose: DetectedPose; confidence: number }[] = [
  // Back-facing patterns (HIGH priority)
  { pattern: /\b(from\s+behind|from\s+the\s+back|rear\s+view|back\s+to\s+(camera|us|viewer))\b/i, pose: 'back', confidence: 95 },
  { pattern: /\b(walking\s+away|running\s+away|retreating|departing|leaving)\b/i, pose: 'back', confidence: 85 },
  { pattern: /\b(facing\s+away|turned\s+away|back\s+turned)\b/i, pose: 'back', confidence: 90 },
  { pattern: /\b(looking\s+into\s+(the\s+)?distance|gazing\s+at\s+the\s+horizon)\b/i, pose: 'back', confidence: 75 },
  { pattern: /\b(over\s+the\s+shoulder)\b/i, pose: 'back', confidence: 80 },
  
  // Side-facing patterns
  { pattern: /\b(profile\s+(view|shot)|side\s+(view|profile|angle))\b/i, pose: 'side', confidence: 95 },
  { pattern: /\b(from\s+the\s+side|lateral\s+view)\b/i, pose: 'side', confidence: 90 },
  { pattern: /\b(walking\s+(past|by)|moving\s+across)\b/i, pose: 'side', confidence: 70 },
  
  // Three-quarter patterns
  { pattern: /\b(three[-\s]quarter|3\/4\s+view|angled\s+view)\b/i, pose: 'three-quarter', confidence: 95 },
  { pattern: /\b(slightly\s+turned|partially\s+facing)\b/i, pose: 'three-quarter', confidence: 75 },
  
  // Silhouette patterns
  { pattern: /\b(silhouette|backlit|shadow\s+figure|dark\s+outline)\b/i, pose: 'silhouette', confidence: 95 },
  { pattern: /\b(against\s+the\s+(light|sun|sky)|in\s+shadow)\b/i, pose: 'silhouette', confidence: 80 },
  
  // Occluded patterns (face not visible but not necessarily back-facing)
  { pattern: /\b(face\s+(hidden|obscured|covered)|wearing\s+(mask|helmet|hood))\b/i, pose: 'occluded', confidence: 90 },
  { pattern: /\b(looking\s+down|head\s+bowed|face\s+turned)\b/i, pose: 'occluded', confidence: 70 },
  
  // Front-facing patterns
  { pattern: /\b(facing\s+(camera|us|forward|viewer)|front\s+view|head-on)\b/i, pose: 'front', confidence: 95 },
  { pattern: /\b(looking\s+at\s+(camera|us|viewer)|eye\s+contact)\b/i, pose: 'front', confidence: 90 },
  { pattern: /\b(portrait|close[-\s]?up\s+of\s+face)\b/i, pose: 'front', confidence: 85 },
  { pattern: /\b(talking\s+to\s+(camera|us)|speaking\s+directly)\b/i, pose: 'front', confidence: 90 },
];

/**
 * Detect the likely character pose/orientation from a prompt
 */
export function detectPoseFromPrompt(prompt: string): PoseAnalysis {
  const indicators: string[] = [];
  let bestPose: DetectedPose = 'front'; // Default to front
  let bestConfidence = 0;
  let foundMatch = false;
  
  for (const { pattern, pose, confidence } of POSE_PATTERNS) {
    const match = prompt.match(pattern);
    if (match) {
      indicators.push(match[0]);
      foundMatch = true;
      if (confidence > bestConfidence) {
        bestPose = pose;
        bestConfidence = confidence;
      }
    }
  }
  
  // Default confidence if no pattern matched
  if (!foundMatch) {
    bestConfidence = 50;
  }
  
  // Determine face visibility based on pose
  const nonFacialPoses: DetectedPose[] = ['back', 'silhouette', 'occluded'];
  const faceVisible = !nonFacialPoses.includes(bestPose);
  const bodyVisible = true; // Body is always visible in video
  
  // Map pose to recommended identity bible view
  const viewMap: Record<DetectedPose, 'front' | 'side' | 'back' | 'three-quarter' | 'silhouette'> = {
    'front': 'front',
    'side': 'side',
    'back': 'back',
    'three-quarter': 'three-quarter',
    'silhouette': 'silhouette',
    'occluded': 'front', // Use front but rely on non-facial anchors
    'unknown': 'front',
  };
  
  return {
    detectedPose: bestPose,
    confidence: bestConfidence,
    faceVisible,
    bodyVisible,
    recommendedView: viewMap[bestPose],
    promptIndicators: indicators,
  };
}

// =====================================================
// VIEW SELECTION - Choose appropriate identity bible view based on pose
// =====================================================

export interface MultiViewUrls {
  frontViewUrl?: string;
  sideViewUrl?: string;
  threeQuarterViewUrl?: string;
  backViewUrl?: string;
  silhouetteUrl?: string;
}

export interface ViewSelectionResult {
  selectedViewUrl: string | null;
  selectedViewType: 'front' | 'side' | 'back' | 'three-quarter' | 'silhouette';
  fallbackUsed: boolean;
  reason: string;
}

/**
 * Select the best identity bible view based on detected pose
 */
export function selectViewForPose(
  poseAnalysis: PoseAnalysis,
  multiViewUrls: MultiViewUrls
): ViewSelectionResult {
  const { recommendedView } = poseAnalysis;
  
  // Direct mapping
  const viewUrlMap: Record<string, string | undefined> = {
    'front': multiViewUrls.frontViewUrl,
    'side': multiViewUrls.sideViewUrl,
    'back': multiViewUrls.backViewUrl,
    'three-quarter': multiViewUrls.threeQuarterViewUrl,
    'silhouette': multiViewUrls.silhouetteUrl,
  };
  
  // Try recommended view first
  if (viewUrlMap[recommendedView]) {
    return {
      selectedViewUrl: viewUrlMap[recommendedView]!,
      selectedViewType: recommendedView,
      fallbackUsed: false,
      reason: `Using ${recommendedView} view (best match for detected pose)`,
    };
  }
  
  // Fallback priority based on pose
  const fallbackPriority: Record<string, string[]> = {
    'front': ['three-quarter', 'side', 'silhouette', 'back'],
    'side': ['three-quarter', 'front', 'silhouette', 'back'],
    'back': ['silhouette', 'three-quarter', 'side', 'front'],
    'three-quarter': ['front', 'side', 'silhouette', 'back'],
    'silhouette': ['back', 'three-quarter', 'side', 'front'],
  };
  
  const fallbacks = fallbackPriority[recommendedView] || ['front', 'side', 'three-quarter'];
  
  for (const fallbackView of fallbacks) {
    if (viewUrlMap[fallbackView]) {
      return {
        selectedViewUrl: viewUrlMap[fallbackView]!,
        selectedViewType: fallbackView as any,
        fallbackUsed: true,
        reason: `Fallback to ${fallbackView} view (${recommendedView} not available)`,
      };
    }
  }
  
  // No view available
  return {
    selectedViewUrl: null,
    selectedViewType: 'front',
    fallbackUsed: true,
    reason: 'No identity bible views available',
  };
}

// =====================================================
// SCENE DNA - Environmental consistency anchors
// =====================================================

export interface SceneDNA {
  lighting: {
    direction: string;
    quality: string;
    color: string;
    timeOfDay: string;
    promptFragment: string;
  };
  colorPalette: {
    dominant: string[];
    temperature: 'warm' | 'neutral' | 'cool';
    saturation: string;
    promptFragment: string;
  };
  environment: {
    type: string;
    elements: string[];
    atmosphere: string;
    promptFragment: string;
  };
  masterPrompt: string;
}

/**
 * Build a scene DNA injection prompt from extracted anchor
 */
export function buildSceneDNAPrompt(sceneDNA: SceneDNA): string {
  const parts: string[] = [
    '[SCENE DNA - MAINTAIN THESE VISUAL ELEMENTS]',
  ];
  
  if (sceneDNA.lighting.promptFragment) {
    parts.push(`LIGHTING: ${sceneDNA.lighting.promptFragment}`);
  }
  
  if (sceneDNA.colorPalette.promptFragment) {
    parts.push(`COLORS: ${sceneDNA.colorPalette.promptFragment}`);
  }
  
  if (sceneDNA.environment.promptFragment) {
    parts.push(`ENVIRONMENT: ${sceneDNA.environment.promptFragment}`);
  }
  
  if (sceneDNA.masterPrompt) {
    parts.push(`CONSISTENCY: ${sceneDNA.masterPrompt}`);
  }
  
  parts.push('[END SCENE DNA]');
  
  return parts.join('\n');
}

// =====================================================
// CHARACTER-SPECIFIC NEGATIVE PROMPTS
// =====================================================

export interface CharacterNegatives {
  clothing: string[];
  hair: string[];
  body: string[];
  accessories: string[];
  general: string[];
}

/**
 * Build character-specific negative prompts to prevent drift
 */
export function buildCharacterNegatives(
  characterDescription?: string,
  nonFacialAnchors?: {
    clothingDescription?: string;
    clothingColors?: string[];
    hairColor?: string;
    hairStyle?: string;
    bodyType?: string;
    accessories?: string[];
  }
): CharacterNegatives {
  const negatives: CharacterNegatives = {
    clothing: [],
    hair: [],
    body: [],
    accessories: [],
    general: [
      'character morphing',
      'identity shift',
      'face changing mid-shot',
      'inconsistent appearance',
      'different person',
      'age progression',
      'gender swap',
    ],
  };
  
  // Build specific negatives based on what the character SHOULD have
  if (nonFacialAnchors?.clothingColors?.length) {
    const colors = nonFacialAnchors.clothingColors;
    const wrongColors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'purple', 'orange', 'pink']
      .filter(c => !colors.some(cc => cc.toLowerCase().includes(c)));
    negatives.clothing.push(...wrongColors.map(c => `${c} clothing`));
    negatives.clothing.push('different outfit', 'wrong clothes', 'clothing change');
  }
  
  if (nonFacialAnchors?.hairColor) {
    const currentColor = nonFacialAnchors.hairColor.toLowerCase();
    const wrongHairColors = ['blonde', 'brunette', 'black', 'red', 'gray', 'white', 'auburn']
      .filter(c => !currentColor.includes(c));
    negatives.hair.push(...wrongHairColors.map(c => `${c} hair`));
    negatives.hair.push('different hairstyle', 'hair color change', 'wig');
  }
  
  if (nonFacialAnchors?.bodyType) {
    const currentBody = nonFacialAnchors.bodyType.toLowerCase();
    if (currentBody.includes('slim') || currentBody.includes('thin')) {
      negatives.body.push('overweight', 'muscular', 'stocky');
    } else if (currentBody.includes('muscular') || currentBody.includes('athletic')) {
      negatives.body.push('thin', 'overweight', 'frail');
    }
  }
  
  return negatives;
}

/**
 * Convert CharacterNegatives to a single negative prompt string
 */
export function flattenNegatives(negatives: CharacterNegatives): string {
  return [
    ...negatives.general,
    ...negatives.clothing.slice(0, 5),
    ...negatives.hair.slice(0, 3),
    ...negatives.body.slice(0, 3),
    ...negatives.accessories.slice(0, 3),
  ].join(', ');
}

// =====================================================
// DUAL INJECTION - Combine identity + scene for generation
// =====================================================

export interface DualInjectionResult {
  enhancedPrompt: string;
  negativePrompt: string;
  startImageUrl: string | null;
  identityReferenceUrl: string | null;
  injectionSummary: string[];
}

/**
 * Build the complete dual injection for a clip generation
 */
export function buildDualInjection(
  basePrompt: string,
  options: {
    identityBible?: {
      characterDescription?: string;
      consistencyPrompt?: string;
      consistencyAnchors?: string[];
      multiViewUrls?: MultiViewUrls;
      nonFacialAnchors?: any;
      occlusionNegatives?: string[];
    };
    sceneDNA?: SceneDNA;
    lastFrameUrl?: string;
    clipIndex: number;
    totalClips: number;
  }
): DualInjectionResult {
  const { identityBible, sceneDNA, lastFrameUrl, clipIndex, totalClips } = options;
  const summary: string[] = [];
  const promptParts: string[] = [];
  
  // 1. Detect pose from prompt
  const poseAnalysis = detectPoseFromPrompt(basePrompt);
  summary.push(`Detected pose: ${poseAnalysis.detectedPose} (${poseAnalysis.confidence}% confidence)`);
  
  // 2. Select appropriate identity view
  let identityReferenceUrl: string | null = null;
  if (identityBible?.multiViewUrls) {
    const viewSelection = selectViewForPose(poseAnalysis, identityBible.multiViewUrls);
    identityReferenceUrl = viewSelection.selectedViewUrl;
    summary.push(viewSelection.reason);
  }
  
  // 3. Build character identity injection
  if (identityBible) {
    promptParts.push('[CHARACTER IDENTITY - MUST MAINTAIN]');
    
    if (identityBible.characterDescription) {
      promptParts.push(`CHARACTER: ${identityBible.characterDescription}`);
    }
    
    // Use non-facial anchors when face not visible
    if (!poseAnalysis.faceVisible && identityBible.nonFacialAnchors) {
      const nfa = identityBible.nonFacialAnchors;
      promptParts.push('[FACE NOT VISIBLE - USE THESE ANCHORS]');
      if (nfa.bodyType) promptParts.push(`BODY: ${nfa.bodyType}`);
      if (nfa.clothingSignature || nfa.clothingDescription) {
        promptParts.push(`CLOTHING: ${nfa.clothingSignature || nfa.clothingDescription}`);
      }
      if (nfa.hairFromBehind || nfa.hairStyle) {
        promptParts.push(`HAIR: ${nfa.hairFromBehind || nfa.hairStyle}`);
      }
      if (nfa.silhouetteDescription) {
        promptParts.push(`SILHOUETTE: ${nfa.silhouetteDescription}`);
      }
      promptParts.push('[END NON-FACIAL ANCHORS]');
      summary.push('Injected non-facial anchors (face not visible)');
    }
    
    if (identityBible.consistencyAnchors?.length) {
      promptParts.push(`KEY DETAILS: ${identityBible.consistencyAnchors.join(', ')}`);
    }
    
    promptParts.push('[END CHARACTER IDENTITY]');
  }
  
  // 4. Inject scene DNA
  if (sceneDNA) {
    promptParts.push(buildSceneDNAPrompt(sceneDNA));
    summary.push('Injected scene DNA (lighting, color, environment)');
  }
  
  // 5. Add clip position context
  if (clipIndex === 0) {
    promptParts.push('[FIRST CLIP - Establish visual tone]');
  } else if (clipIndex === totalClips - 1) {
    promptParts.push('[FINAL CLIP - Conclusive framing]');
  } else {
    promptParts.push(`[CLIP ${clipIndex + 1}/${totalClips} - Maintain continuity]`);
  }
  
  // 6. Add base prompt
  promptParts.push(basePrompt);
  
  // 7. Build negative prompt
  const characterNegatives = buildCharacterNegatives(
    identityBible?.characterDescription,
    identityBible?.nonFacialAnchors
  );
  const occlusionNegatives = identityBible?.occlusionNegatives || [];
  
  const negativePrompt = [
    flattenNegatives(characterNegatives),
    ...occlusionNegatives.slice(0, 10),
    'blurry', 'low quality', 'distorted', 'watermark',
  ].join(', ');
  
  summary.push(`Built negative prompt with ${characterNegatives.general.length + occlusionNegatives.length} terms`);
  
  // 8. Determine start image (last frame for motion, NOT identity reference)
  // Identity reference is passed separately for dual injection
  const startImageUrl = clipIndex > 0 ? lastFrameUrl : null;
  
  return {
    enhancedPrompt: promptParts.join('\n'),
    negativePrompt,
    startImageUrl: startImageUrl || null,
    identityReferenceUrl,
    injectionSummary: summary,
  };
}

// =====================================================
// VERIFICATION THRESHOLDS
// =====================================================

export interface VerificationThresholds {
  overallPass: number;
  clothingHardFail: number;
  hairHardFail: number;
  bodyHardFail: number;
  faceHardFail: number;
  maxRegenerations: number;
}

export const STRICT_THRESHOLDS: VerificationThresholds = {
  overallPass: 65, // Lowered from 70
  clothingHardFail: 50, // Clothing score below this = auto-regen
  hairHardFail: 50,
  bodyHardFail: 55,
  faceHardFail: 60,
  maxRegenerations: 3,
};

/**
 * Determine if a clip should be regenerated based on verification scores
 */
export function shouldRegenerate(
  scores: {
    overallScore: number;
    clothingScore: number;
    hairScore: number;
    bodyScore: number;
    faceScore: number;
    faceVisible: boolean;
  },
  thresholds: VerificationThresholds = STRICT_THRESHOLDS
): { shouldRegen: boolean; reason: string } {
  // Overall score check
  if (scores.overallScore < thresholds.overallPass) {
    return { shouldRegen: true, reason: `Overall score ${scores.overallScore} < ${thresholds.overallPass}` };
  }
  
  // Hard fail checks for specific attributes
  if (scores.clothingScore < thresholds.clothingHardFail) {
    return { shouldRegen: true, reason: `Clothing score ${scores.clothingScore} < ${thresholds.clothingHardFail} (HARD FAIL)` };
  }
  
  if (scores.hairScore < thresholds.hairHardFail) {
    return { shouldRegen: true, reason: `Hair score ${scores.hairScore} < ${thresholds.hairHardFail} (HARD FAIL)` };
  }
  
  if (scores.bodyScore < thresholds.bodyHardFail) {
    return { shouldRegen: true, reason: `Body score ${scores.bodyScore} < ${thresholds.bodyHardFail} (HARD FAIL)` };
  }
  
  // Face check only if visible
  if (scores.faceVisible && scores.faceScore < thresholds.faceHardFail) {
    return { shouldRegen: true, reason: `Face score ${scores.faceScore} < ${thresholds.faceHardFail} (HARD FAIL)` };
  }
  
  return { shouldRegen: false, reason: 'All checks passed' };
}

// =====================================================
// RE-EXPORT TOTAL ANCHOR INJECTION SYSTEM
// =====================================================

export { 
  buildTotalAnchorInjection, 
  validateTheLaw,
  type TotalAnchorInjection,
  type TheLawValidation 
} from './totalAnchorInjection';
