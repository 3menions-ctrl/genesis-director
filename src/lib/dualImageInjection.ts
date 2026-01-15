/**
 * DUAL IMAGE INJECTION SYSTEM
 * 
 * Implements dual reference image strategy:
 * 1. CLIP 1: Uses only reference image (establishes visual DNA)
 * 2. CLIP 2+: Uses BOTH last frame + reference image for maximum consistency
 * 
 * This ensures character identity is maintained even when scenes change.
 */

export interface DualImageConfig {
  clipIndex: number;
  referenceImageUrl: string | null;
  lastFrameUrl: string | null;
  clip1FirstFrameUrl: string | null;
  identityBibleViews: string[];
}

export interface DualImageResult {
  primaryImage: string | null;
  secondaryImages: string[];
  strategy: 'reference_only' | 'last_frame_only' | 'dual_injection' | 'fallback';
  injectionPrompt: string;
  warnings: string[];
}

/**
 * Determine dual image injection strategy
 */
export function getDualImageStrategy(config: DualImageConfig): DualImageResult {
  const {
    clipIndex,
    referenceImageUrl,
    lastFrameUrl,
    clip1FirstFrameUrl,
    identityBibleViews,
  } = config;
  
  const warnings: string[] = [];
  const secondaryImages: string[] = [];
  
  // Clip 1: Reference image only
  if (clipIndex === 0) {
    if (referenceImageUrl) {
      // Add identity bible views as secondary references
      secondaryImages.push(...identityBibleViews.filter(v => v !== referenceImageUrl));
      
      return {
        primaryImage: referenceImageUrl,
        secondaryImages,
        strategy: 'reference_only',
        injectionPrompt: buildClip1InjectionPrompt(referenceImageUrl),
        warnings,
      };
    }
    
    // No reference - use identity bible front view
    if (identityBibleViews.length > 0) {
      return {
        primaryImage: identityBibleViews[0],
        secondaryImages: identityBibleViews.slice(1),
        strategy: 'reference_only',
        injectionPrompt: buildClip1InjectionPrompt(identityBibleViews[0]),
        warnings: ['Using identity bible as reference (no explicit reference provided)'],
      };
    }
    
    warnings.push('CRITICAL: No reference image for Clip 1 - visual DNA not established');
    return {
      primaryImage: null,
      secondaryImages: [],
      strategy: 'fallback',
      injectionPrompt: '',
      warnings,
    };
  }
  
  // Clip 2+: Dual injection preferred
  if (lastFrameUrl && (referenceImageUrl || clip1FirstFrameUrl)) {
    const refImage = referenceImageUrl || clip1FirstFrameUrl;
    
    // Add identity views and reference as secondary
    if (refImage) secondaryImages.push(refImage);
    secondaryImages.push(...identityBibleViews.filter(v => v !== refImage && v !== lastFrameUrl));
    
    return {
      primaryImage: lastFrameUrl,
      secondaryImages: secondaryImages.slice(0, 3), // Limit to 3 secondary
      strategy: 'dual_injection',
      injectionPrompt: buildDualInjectionPrompt(lastFrameUrl, refImage),
      warnings,
    };
  }
  
  // Fallback: Last frame only
  if (lastFrameUrl) {
    warnings.push('No reference image - using last frame only (identity may drift)');
    return {
      primaryImage: lastFrameUrl,
      secondaryImages: identityBibleViews.slice(0, 2),
      strategy: 'last_frame_only',
      injectionPrompt: buildLastFrameOnlyPrompt(lastFrameUrl),
      warnings,
    };
  }
  
  // Emergency fallback: Reference/identity only
  const fallbackImage = referenceImageUrl || clip1FirstFrameUrl || identityBibleViews[0];
  if (fallbackImage) {
    warnings.push('CRITICAL: No last frame - using reference only (continuity broken)');
    return {
      primaryImage: fallbackImage,
      secondaryImages: identityBibleViews.filter(v => v !== fallbackImage).slice(0, 2),
      strategy: 'fallback',
      injectionPrompt: buildFallbackPrompt(fallbackImage),
      warnings,
    };
  }
  
  warnings.push('CRITICAL: No images available - visual consistency will fail');
  return {
    primaryImage: null,
    secondaryImages: [],
    strategy: 'fallback',
    injectionPrompt: '',
    warnings,
  };
}

/**
 * Build injection prompt for Clip 1 (reference only)
 */
function buildClip1InjectionPrompt(referenceUrl: string): string {
  return `
╔══════════════════════════════════════════════════════════════╗
║  🎬 CLIP 1 - MASTER VISUAL DNA ESTABLISHMENT                  ║
╚══════════════════════════════════════════════════════════════╝

[REFERENCE IMAGE LOCK]
Primary reference: ${referenceUrl.substring(0, 60)}...
This clip ESTABLISHES the visual DNA for ALL subsequent clips.

CRITICAL REQUIREMENTS:
- Match character appearance EXACTLY from reference
- Lock lighting, color palette, and environment
- This frame becomes the MASTER reference for continuity

[END REFERENCE LOCK]
`;
}

/**
 * Build injection prompt for Clip 2+ (dual injection)
 */
function buildDualInjectionPrompt(lastFrameUrl: string, referenceUrl: string | null): string {
  return `
╔══════════════════════════════════════════════════════════════╗
║  🔗 DUAL IMAGE INJECTION - MAXIMUM CONSISTENCY MODE           ║
╚══════════════════════════════════════════════════════════════╝

[FRAME CHAIN - PRIMARY]
Previous frame: ${lastFrameUrl.substring(0, 60)}...
MANDATORY: Continue EXACTLY from this frame's:
- Character position and pose
- Lighting direction and intensity
- Color temperature and palette
- Background elements

${referenceUrl ? `[IDENTITY ANCHOR - SECONDARY]
Master reference: ${referenceUrl.substring(0, 60)}...
CROSS-CHECK character identity against master reference.
Any deviation from master = REJECT.` : ''}

[END DUAL INJECTION]
`;
}

/**
 * Build injection prompt for last frame only
 */
function buildLastFrameOnlyPrompt(lastFrameUrl: string): string {
  return `
[FRAME CHAIN ONLY]
Continue from: ${lastFrameUrl.substring(0, 60)}...
⚠️ WARNING: No identity reference - maintain current appearance from last frame.
[END FRAME CHAIN]
`;
}

/**
 * Build injection prompt for fallback mode
 */
function buildFallbackPrompt(imageUrl: string): string {
  return `
[EMERGENCY FALLBACK]
Reference: ${imageUrl.substring(0, 60)}...
⚠️ CRITICAL: Frame chain broken - using reference as sole anchor.
Match character appearance from reference image.
[END FALLBACK]
`;
}

/**
 * Calculate confidence score for dual image injection
 */
export function calculateInjectionConfidence(result: DualImageResult): number {
  const baseScores: Record<typeof result.strategy, number> = {
    'dual_injection': 95,
    'reference_only': 90,
    'last_frame_only': 70,
    'fallback': 50,
  };
  
  let score = baseScores[result.strategy];
  
  // Bonus for secondary images
  score += Math.min(result.secondaryImages.length * 2, 5);
  
  // Penalty for warnings
  score -= result.warnings.length * 5;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Validate dual image chain integrity
 */
export function validateImageChain(
  clips: Array<{ index: number; lastFrameUrl?: string; startImageUrl?: string }>
): { valid: boolean; brokenAt?: number; gaps: number[] } {
  const gaps: number[] = [];
  let brokenAt: number | undefined;
  
  for (let i = 1; i < clips.length; i++) {
    const current = clips[i];
    const previous = clips[i - 1];
    
    // Check if current clip's start image matches previous clip's last frame
    if (!current.startImageUrl && !previous.lastFrameUrl) {
      if (brokenAt === undefined) brokenAt = i;
      gaps.push(i);
    }
  }
  
  return {
    valid: gaps.length === 0,
    brokenAt,
    gaps,
  };
}
