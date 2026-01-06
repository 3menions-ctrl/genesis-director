/**
 * Identity Bible Types
 * 
 * 3-point character reference system for maintaining visual consistency
 * across AI-generated video sequences.
 */

export interface IdentityBible {
  // Original reference image uploaded by user
  originalImageUrl: string;
  
  // Generated 3-point character views
  frontViewUrl: string;
  sideViewUrl: string;
  threeQuarterViewUrl: string;
  
  // AI-extracted character description for prompt injection
  characterDescription: string;
  
  // Key visual anchors for consistency
  consistencyAnchors: string[];
  
  // Generation metadata
  generatedAt: number;
  isComplete: boolean;
}

export interface IdentityBibleGenerationState {
  isGenerating: boolean;
  progress: number; // 0-100
  currentStep: 'analyzing' | 'generating-front' | 'generating-side' | 'generating-three-quarter' | 'complete';
  error?: string;
}

// Visual ingredients to inject into every video generation
export interface VisualIngredients {
  // Primary reference for image-to-video first frame
  primaryReferenceUrl: string;
  
  // All identity bible images for consistency checking
  identityBibleUrls: string[];
  
  // Text-based consistency prompt
  consistencyPrompt: string;
  
  // Negative prompts to prevent character morphing
  antiMorphingPrompts: string[];
}

/**
 * Build visual ingredients from identity bible and reference analysis
 */
export function buildVisualIngredients(
  identityBible?: IdentityBible,
  referenceAnalysis?: {
    imageUrl: string;
    consistencyPrompt: string;
    characterIdentity?: { description: string };
  }
): VisualIngredients {
  const ingredients: VisualIngredients = {
    primaryReferenceUrl: '',
    identityBibleUrls: [],
    consistencyPrompt: '',
    antiMorphingPrompts: [
      'character morphing',
      'face changing',
      'body transformation',
      'clothing change',
      'age progression',
      'identity shift',
      'different person',
      'inconsistent appearance',
    ],
  };

  // Use identity bible if available
  if (identityBible?.isComplete) {
    ingredients.primaryReferenceUrl = identityBible.frontViewUrl;
    ingredients.identityBibleUrls = [
      identityBible.frontViewUrl,
      identityBible.sideViewUrl,
      identityBible.threeQuarterViewUrl,
    ];
    ingredients.consistencyPrompt = identityBible.characterDescription;
  } 
  // Fall back to reference analysis
  else if (referenceAnalysis) {
    ingredients.primaryReferenceUrl = referenceAnalysis.imageUrl;
    ingredients.identityBibleUrls = [referenceAnalysis.imageUrl];
    ingredients.consistencyPrompt = referenceAnalysis.consistencyPrompt || 
      referenceAnalysis.characterIdentity?.description || '';
  }

  return ingredients;
}

/**
 * Build enhanced prompt with visual ingredients injection
 */
export function injectVisualIngredients(
  basePrompt: string,
  ingredients: VisualIngredients
): { enhancedPrompt: string; negativePrompt: string } {
  let enhancedPrompt = basePrompt;

  // Inject consistency prompt at the start for strong influence
  if (ingredients.consistencyPrompt) {
    enhancedPrompt = `[CHARACTER IDENTITY: ${ingredients.consistencyPrompt}] ${enhancedPrompt}`;
  }

  // Add anti-morphing negative prompt
  const negativePrompt = ingredients.antiMorphingPrompts.join(', ');

  return { enhancedPrompt, negativePrompt };
}
