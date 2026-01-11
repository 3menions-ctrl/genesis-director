/**
 * Enhanced Identity Bible Types
 * 
 * 5-View character reference system with non-facial anchors
 * for maintaining visual consistency even during face occlusion.
 */

// Non-facial anchors that persist even when face is hidden
export interface NonFacialAnchors {
  // Body characteristics
  bodyType: string; // "athletic build", "slim", "stocky"
  bodyProportions: string; // "tall with broad shoulders", "petite frame"
  posture: string; // "confident upright stance", "slight forward lean"
  gait: string; // "purposeful stride", "relaxed walk"
  height: string; // "approximately 6 feet", "average height"
  
  // Clothing (CRITICAL for occlusion scenarios)
  clothingDescription: string; // Full outfit description
  clothingColors: string[]; // Primary colors for quick matching
  clothingPatterns: string[]; // "plaid", "solid", "striped"
  clothingTextures: string[]; // "leather", "denim", "cotton"
  clothingDistinctive: string; // Most unique clothing element
  
  // Hair from all angles
  hairColor: string;
  hairLength: string;
  hairStyle: string;
  hairFromBehind: string; // Specific description of hair from back view
  hairSilhouette: string; // Hair outline/shape
  
  // Accessories (visible from any angle)
  accessories: string[];
  accessoryPositions: string; // "watch on left wrist, ring on right hand"
  
  // Distinctive markers visible from behind
  backViewMarkers: string; // "tattoo on back of neck", "distinctive shoulder bag"
  
  // Silhouette description
  overallSilhouette: string; // "Tall figure with defined shoulders, hair reaching mid-back"
}

// Extended view types for 5-view system
export type CharacterViewType = 'front' | 'side' | 'three-quarter' | 'back' | 'silhouette';

export interface CharacterViewExtended {
  viewType: CharacterViewType;
  imageUrl: string;
  generatedAt: number;
  // Specific prompt used to generate this view
  generationPrompt?: string;
  // Confidence score for this view's consistency
  consistencyScore?: number;
}

// Enhanced Identity Bible with 5-view system
export interface EnhancedIdentityBible {
  // Original reference
  originalImageUrl: string;
  
  // 5-View Reference System
  views: {
    front?: CharacterViewExtended;
    side?: CharacterViewExtended;
    threeQuarter?: CharacterViewExtended;
    back?: CharacterViewExtended;
    silhouette?: CharacterViewExtended;
  };
  viewsComplete: boolean;
  viewCount: number;
  
  // Character description (for prompt injection)
  characterDescription: string;
  
  // Non-facial anchors (CRITICAL for occlusion handling)
  nonFacialAnchors: NonFacialAnchors;
  
  // Original consistency anchors (backward compatible)
  consistencyAnchors: string[];
  
  // Enhanced consistency prompt with all anchors
  enhancedConsistencyPrompt: string;
  
  // Anti-morphing prompts (expanded)
  antiMorphingPrompts: string[];
  
  // Occlusion-specific negative prompts
  occlusionNegatives: string[];
  
  // Generation metadata
  generatedAt: number;
  isComplete: boolean;
  version: '2.0'; // Mark as enhanced version
}

// Pose detection for reference selection
export type DetectedPose = 
  | 'facing_camera' 
  | 'three_quarter_left'
  | 'three_quarter_right'
  | 'profile_left'
  | 'profile_right'
  | 'facing_away'
  | 'back_turned'
  | 'silhouette'
  | 'face_occluded'
  | 'unknown';

export interface PoseAnalysis {
  detectedPose: DetectedPose;
  confidence: number;
  faceVisible: boolean;
  bodyVisible: boolean;
  recommendedReferenceView: CharacterViewType;
  occlusionType?: 'hand_covering' | 'object_blocking' | 'turned_away' | 'shadow' | 'none';
}

// Reference selection result
export interface PoseAwareReference {
  selectedView: CharacterViewType;
  referenceImageUrl: string;
  injectionPrompt: string;
  negativePrompt: string;
  // Whether to prioritize non-facial anchors
  useNonFacialAnchors: boolean;
  // Specific anchors to emphasize
  emphasisAnchors: string[];
}

// Identity verification result
export interface IdentityVerificationResult {
  passed: boolean;
  overallScore: number; // 0-100
  
  // Individual scores
  faceScore: number;
  bodyScore: number;
  clothingScore: number;
  hairScore: number;
  accessoryScore: number;
  silhouetteScore: number;
  
  // Issues detected
  issues: {
    type: 'face_changed' | 'clothing_changed' | 'hair_changed' | 'body_changed' | 'accessory_missing' | 'silhouette_mismatch';
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
  }[];
  
  // Recommendation
  shouldRegenerate: boolean;
  regenerationHints: string[];
  
  // Frames analyzed
  framesAnalyzed: number;
  analysisTimestamp: number;
}

// Request for identity verification
export interface VerifyIdentityRequest {
  projectId: string;
  clipIndex: number;
  videoUrl: string;
  identityBible: EnhancedIdentityBible;
  // Threshold for passing (default 70)
  passThreshold?: number;
  // Number of frames to sample
  framesToAnalyze?: number;
  // Whether to auto-regenerate on failure
  autoRegenerate?: boolean;
}

// Helper functions

/**
 * Select the best reference view based on detected pose
 */
export function selectReferenceForPose(
  pose: DetectedPose,
  bible: EnhancedIdentityBible
): CharacterViewType {
  const poseToViewMap: Record<DetectedPose, CharacterViewType[]> = {
    'facing_camera': ['front', 'three-quarter'],
    'three_quarter_left': ['three-quarter', 'front'],
    'three_quarter_right': ['three-quarter', 'front'],
    'profile_left': ['side', 'three-quarter'],
    'profile_right': ['side', 'three-quarter'],
    'facing_away': ['back', 'silhouette'],
    'back_turned': ['back', 'silhouette'],
    'silhouette': ['silhouette', 'back'],
    'face_occluded': ['silhouette', 'back', 'side'], // Prioritize non-face views
    'unknown': ['front', 'three-quarter'],
  };
  
  const preferences = poseToViewMap[pose] || ['front'];
  
  // Find first available view
  for (const pref of preferences) {
    const normalizedPref = pref === 'three-quarter' ? 'threeQuarter' : pref;
    if (bible.views[normalizedPref as keyof typeof bible.views]?.imageUrl) {
      return pref as CharacterViewType;
    }
  }
  
  // Fallback to any available view
  if (bible.views.front?.imageUrl) return 'front';
  if (bible.views.threeQuarter?.imageUrl) return 'three-quarter';
  if (bible.views.side?.imageUrl) return 'side';
  if (bible.views.back?.imageUrl) return 'back';
  if (bible.views.silhouette?.imageUrl) return 'silhouette';
  
  return 'front';
}

/**
 * Build injection prompt based on pose and occlusion state
 */
export function buildPoseAwarePrompt(
  bible: EnhancedIdentityBible,
  pose: DetectedPose,
  isOccluded: boolean
): { injectionPrompt: string; negativePrompt: string } {
  const parts: string[] = [];
  const negatives: string[] = [...bible.antiMorphingPrompts];
  
  // Always include non-facial anchors when face might not be visible
  if (isOccluded || pose === 'facing_away' || pose === 'back_turned' || pose === 'silhouette') {
    const nfa = bible.nonFacialAnchors;
    
    parts.push(`[IDENTITY LOCK - NON-FACIAL ANCHORS]`);
    parts.push(`BODY: ${nfa.bodyType}, ${nfa.bodyProportions}, ${nfa.posture}`);
    parts.push(`CLOTHING: ${nfa.clothingDescription}`);
    parts.push(`CLOTHING COLORS: ${nfa.clothingColors.join(', ')}`);
    if (nfa.clothingDistinctive) {
      parts.push(`DISTINCTIVE: ${nfa.clothingDistinctive}`);
    }
    parts.push(`HAIR: ${nfa.hairColor} ${nfa.hairLength} ${nfa.hairStyle}`);
    if (pose === 'facing_away' || pose === 'back_turned') {
      parts.push(`HAIR FROM BEHIND: ${nfa.hairFromBehind}`);
      if (nfa.backViewMarkers) {
        parts.push(`BACK MARKERS: ${nfa.backViewMarkers}`);
      }
    }
    if (nfa.accessories.length > 0) {
      parts.push(`ACCESSORIES: ${nfa.accessories.join(', ')}`);
    }
    parts.push(`SILHOUETTE: ${nfa.overallSilhouette}`);
    parts.push(`[END IDENTITY LOCK]`);
    
    // Add occlusion-specific negatives
    negatives.push(...bible.occlusionNegatives);
  } else {
    // Standard character description for front-facing shots
    parts.push(`[CHARACTER IDENTITY: ${bible.characterDescription}]`);
    parts.push(`[ANCHORS: ${bible.consistencyAnchors.join(', ')}]`);
  }
  
  return {
    injectionPrompt: parts.join('\n'),
    negativePrompt: [...new Set(negatives)].join(', '),
  };
}

/**
 * Get default occlusion negative prompts
 */
export function getDefaultOcclusionNegatives(): string[] {
  return [
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
}

/**
 * Get default anti-morphing prompts (expanded)
 */
export function getDefaultAntiMorphingPrompts(): string[] {
  return [
    'character morphing',
    'face changing',
    'body transformation',
    'clothing change',
    'age progression',
    'identity shift',
    'different person',
    'inconsistent appearance',
    'wardrobe malfunction',
    'character replacement',
    'shapeshifting',
    'appearance mutation',
    'face swap',
    'body swap',
    'outfit change',
    'hair transformation',
  ];
}
