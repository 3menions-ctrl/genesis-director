/**
 * ANCHOR FAILSAFES - Shared utilities for bulletproof anchor extraction and validation
 * 
 * Critical safety mechanisms:
 * 1. Retry with exponential backoff
 * 2. Fallback values for every field
 * 3. Validation before use
 * 4. Caching to prevent re-extraction
 */

// =====================================================
// RETRY CONFIGURATION
// =====================================================
export const ANCHOR_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

// =====================================================
// EXPONENTIAL BACKOFF RETRY
// =====================================================
export async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  config = ANCHOR_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < config.maxRetries - 1) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelayMs
        );
        console.warn(`[${operationName}] Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`${operationName} failed after ${config.maxRetries} attempts`);
}

// =====================================================
// SAFE PROPERTY ACCESS
// =====================================================
export function safeGet<T>(obj: any, path: string, defaultValue: T): T {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[key];
  }
  
  return (current !== null && current !== undefined) ? current as T : defaultValue;
}

// =====================================================
// DEFAULT SCENE ANCHOR
// =====================================================
export interface DefaultSceneAnchor {
  id: string;
  shotId: string;
  frameUrl: string;
  extractedAt: number;
  lighting: {
    keyLightDirection: string;
    keyLightIntensity: 'soft' | 'medium' | 'harsh';
    keyLightColor: string;
    fillRatio: number;
    ambientColor: string;
    shadowHardness: 'soft' | 'medium' | 'hard';
    shadowDirection: string;
    timeOfDay: string;
    promptFragment: string;
  };
  colorPalette: {
    dominant: { hex: string; percentage: number; name: string }[];
    accents: string[];
    temperature: 'warm' | 'neutral' | 'cool';
    saturation: 'muted' | 'natural' | 'vibrant';
    gradeStyle: string;
    promptFragment: string;
  };
  depthCues: {
    dofStyle: 'deep' | 'shallow' | 'rack-focus';
    focalPlane: 'foreground' | 'midground' | 'background';
    bokehQuality: string;
    atmosphericPerspective: boolean;
    fogHaze: 'none' | 'light' | 'medium' | 'heavy';
    foregroundElements: string[];
    midgroundElements: string[];
    backgroundElements: string[];
    perspectiveType: 'one-point' | 'two-point' | 'three-point' | 'isometric';
    vanishingPointLocation: string;
    promptFragment: string;
  };
  keyObjects: {
    objects: any[];
    environmentType: 'interior' | 'exterior' | 'mixed';
    settingDescription: string;
    architecturalStyle: string;
    promptFragment: string;
  };
  motionSignature: {
    cameraMotionStyle: 'static' | 'subtle' | 'dynamic' | 'chaotic';
    preferredMovements: string[];
    subjectMotionIntensity: 'still' | 'subtle' | 'active' | 'intense';
    pacingTempo: 'slow' | 'medium' | 'fast';
    cutRhythm: string;
    promptFragment: string;
  };
  masterConsistencyPrompt: string;
}

export function getDefaultSceneAnchor(shotId: string, frameUrl: string): DefaultSceneAnchor {
  return {
    id: `anchor_fallback_${Date.now()}`,
    shotId,
    frameUrl,
    extractedAt: Date.now(),
    lighting: {
      keyLightDirection: 'natural ambient',
      keyLightIntensity: 'medium',
      keyLightColor: 'neutral daylight',
      fillRatio: 0.5,
      ambientColor: 'neutral',
      shadowHardness: 'soft',
      shadowDirection: 'natural',
      timeOfDay: 'indoor',
      promptFragment: 'natural ambient lighting with soft shadows',
    },
    colorPalette: {
      dominant: [{ hex: '#808080', percentage: 40, name: 'neutral gray' }],
      accents: [],
      temperature: 'neutral',
      saturation: 'natural',
      gradeStyle: 'natural cinematic',
      promptFragment: 'natural color grading with balanced tones',
    },
    depthCues: {
      dofStyle: 'deep',
      focalPlane: 'midground',
      bokehQuality: 'subtle',
      atmosphericPerspective: false,
      fogHaze: 'none',
      foregroundElements: [],
      midgroundElements: [],
      backgroundElements: [],
      perspectiveType: 'one-point',
      vanishingPointLocation: 'center',
      promptFragment: 'deep depth of field with clear focus',
    },
    keyObjects: {
      objects: [],
      environmentType: 'mixed',
      settingDescription: 'general scene',
      architecturalStyle: 'contemporary',
      promptFragment: 'contemporary setting',
    },
    motionSignature: {
      cameraMotionStyle: 'subtle',
      preferredMovements: ['slow pan', 'gentle drift'],
      subjectMotionIntensity: 'subtle',
      pacingTempo: 'medium',
      cutRhythm: 'measured',
      promptFragment: 'subtle camera movement with measured pacing',
    },
    masterConsistencyPrompt: 'natural ambient lighting, balanced color grading, deep focus, contemporary setting, subtle camera movement',
  };
}

// =====================================================
// DEFAULT STYLE ANCHOR
// =====================================================
export interface DefaultStyleAnchor {
  colorPalette: {
    dominant: string;
    secondary: string[];
    mood: string;
  };
  lighting: {
    type: string;
    direction: string;
    intensity: string;
    quality: string;
  };
  visualStyle: {
    aesthetic: string;
    texture: string;
    contrast: string;
    saturation: string;
  };
  environment: {
    setting: string;
    timeOfDay: string;
    weather: string;
    atmosphere: string;
  };
  consistencyPrompt: string;
  anchors: string[];
}

export function getDefaultStyleAnchor(): DefaultStyleAnchor {
  return {
    colorPalette: {
      dominant: 'natural tones',
      secondary: ['earth tones', 'sky blue'],
      mood: 'balanced natural',
    },
    lighting: {
      type: 'natural daylight',
      direction: 'ambient',
      intensity: 'medium',
      quality: 'soft diffused',
    },
    visualStyle: {
      aesthetic: 'cinematic natural',
      texture: 'clean detailed',
      contrast: 'medium',
      saturation: 'natural',
    },
    environment: {
      setting: 'contemporary',
      timeOfDay: 'day',
      weather: 'clear',
      atmosphere: 'clear',
    },
    consistencyPrompt: '[STYLE ANCHOR: cinematic natural aesthetic, natural tones, ambient lighting, clear atmosphere]',
    anchors: ['natural tones', 'ambient lighting', 'cinematic aesthetic'],
  };
}

// =====================================================
// SCENE ANCHOR VALIDATION
// =====================================================
export function validateSceneAnchor(anchor: any): { valid: boolean; errors: string[]; fixed: any } {
  const errors: string[] = [];
  
  if (!anchor) {
    return { valid: false, errors: ['anchor is null or undefined'], fixed: null };
  }
  
  const fixed = { ...anchor };
  
  // Validate and fix lighting
  if (!fixed.lighting) {
    errors.push('missing lighting');
    fixed.lighting = getDefaultSceneAnchor('', '').lighting;
  } else {
    if (!fixed.lighting.promptFragment) {
      fixed.lighting.promptFragment = `${fixed.lighting.keyLightIntensity || 'medium'} ${fixed.lighting.timeOfDay || 'natural'} lighting`;
    }
  }
  
  // Validate and fix colorPalette
  if (!fixed.colorPalette) {
    errors.push('missing colorPalette');
    fixed.colorPalette = getDefaultSceneAnchor('', '').colorPalette;
  } else {
    if (!fixed.colorPalette.promptFragment) {
      fixed.colorPalette.promptFragment = `${fixed.colorPalette.temperature || 'neutral'} color palette`;
    }
  }
  
  // Validate and fix depthCues
  if (!fixed.depthCues) {
    errors.push('missing depthCues');
    fixed.depthCues = getDefaultSceneAnchor('', '').depthCues;
  } else {
    if (!fixed.depthCues.promptFragment) {
      fixed.depthCues.promptFragment = `${fixed.depthCues.dofStyle || 'deep'} depth of field`;
    }
  }
  
  // Validate and fix keyObjects
  if (!fixed.keyObjects) {
    errors.push('missing keyObjects');
    fixed.keyObjects = getDefaultSceneAnchor('', '').keyObjects;
  } else {
    if (!fixed.keyObjects.promptFragment) {
      fixed.keyObjects.promptFragment = fixed.keyObjects.settingDescription || 'general scene';
    }
  }
  
  // Validate and fix motionSignature
  if (!fixed.motionSignature) {
    errors.push('missing motionSignature');
    fixed.motionSignature = getDefaultSceneAnchor('', '').motionSignature;
  } else {
    if (!fixed.motionSignature.promptFragment) {
      fixed.motionSignature.promptFragment = `${fixed.motionSignature.cameraMotionStyle || 'subtle'} camera motion`;
    }
  }
  
  // Validate and fix masterConsistencyPrompt
  if (!fixed.masterConsistencyPrompt) {
    const fragments = [
      fixed.lighting?.promptFragment,
      fixed.colorPalette?.promptFragment,
      fixed.depthCues?.promptFragment,
      fixed.keyObjects?.promptFragment,
      fixed.motionSignature?.promptFragment,
    ].filter(Boolean);
    fixed.masterConsistencyPrompt = fragments.join('. ');
    if (!fixed.masterConsistencyPrompt) {
      errors.push('missing masterConsistencyPrompt');
      fixed.masterConsistencyPrompt = 'maintain visual consistency';
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    fixed,
  };
}

// =====================================================
// STYLE ANCHOR VALIDATION
// =====================================================
export function validateStyleAnchor(anchor: any): { valid: boolean; errors: string[]; fixed: any } {
  const errors: string[] = [];
  
  if (!anchor) {
    return { valid: false, errors: ['anchor is null or undefined'], fixed: getDefaultStyleAnchor() };
  }
  
  const fixed = { ...anchor };
  
  // Validate colorPalette
  if (!fixed.colorPalette?.dominant) {
    errors.push('missing colorPalette.dominant');
    fixed.colorPalette = { ...getDefaultStyleAnchor().colorPalette, ...fixed.colorPalette };
  }
  
  // Validate lighting
  if (!fixed.lighting?.type) {
    errors.push('missing lighting.type');
    fixed.lighting = { ...getDefaultStyleAnchor().lighting, ...fixed.lighting };
  }
  
  // Validate visualStyle
  if (!fixed.visualStyle?.aesthetic) {
    errors.push('missing visualStyle.aesthetic');
    fixed.visualStyle = { ...getDefaultStyleAnchor().visualStyle, ...fixed.visualStyle };
  }
  
  // Validate consistencyPrompt
  if (!fixed.consistencyPrompt) {
    errors.push('missing consistencyPrompt');
    fixed.consistencyPrompt = `[STYLE ANCHOR: ${fixed.visualStyle?.aesthetic || 'cinematic'}, ${fixed.colorPalette?.dominant || 'natural'} palette, ${fixed.lighting?.type || 'natural'} lighting]`;
  }
  
  // Validate anchors array
  if (!Array.isArray(fixed.anchors) || fixed.anchors.length === 0) {
    errors.push('missing or empty anchors array');
    fixed.anchors = [
      fixed.colorPalette?.dominant,
      fixed.lighting?.type,
      fixed.visualStyle?.aesthetic,
    ].filter(Boolean);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    fixed,
  };
}

// =====================================================
// IDENTITY BIBLE VALIDATION
// =====================================================
export function validateIdentityBible(bible: any): { valid: boolean; errors: string[]; fixed: any } {
  const errors: string[] = [];
  
  if (!bible) {
    return { valid: false, errors: ['bible is null or undefined'], fixed: null };
  }
  
  const fixed = { ...bible };
  
  // v3.0: Check for originalReferenceUrl or any image source
  const hasImageSource = fixed.originalReferenceUrl || 
                         fixed.originalImageUrl;
  
  if (!hasImageSource) {
    errors.push('no original reference image URL available');
  }
  
  // Validate character description
  if (!fixed.characterDescription && !fixed.characterIdentity?.description && !fixed.consistencyPrompt) {
    errors.push('no character description available');
  }
  
  // Ensure consistencyAnchors exist
  if (!fixed.consistencyAnchors || fixed.consistencyAnchors.length === 0) {
    fixed.consistencyAnchors = [];
    
    const desc = fixed.characterDescription || fixed.characterIdentity?.description || '';
    
    // Extract key phrases
    const patterns = [
      /(?:skin tone|complexion)[^,.]*/i,
      /(?:hair|hairstyle)[^,.]*/i,
      /(?:eyes?|eye color)[^,.]*/i,
      /(?:wearing|dressed|clothing)[^,.]*/i,
      /(?:face|facial)[^,.]*/i,
    ];
    
    for (const pattern of patterns) {
      const match = desc.match(pattern);
      if (match) {
        fixed.consistencyAnchors.push(match[0].trim());
      }
    }
    
    if (fixed.consistencyAnchors.length === 0 && desc) {
      // Just use first 100 chars as anchor
      fixed.consistencyAnchors.push(desc.substring(0, 100));
    }
    
    if (fixed.consistencyAnchors.length === 0) {
      errors.push('could not extract consistency anchors');
    }
  }
  
  // Ensure antiMorphingPrompts exist
  if (!fixed.antiMorphingPrompts || fixed.antiMorphingPrompts.length === 0) {
    fixed.antiMorphingPrompts = [
      'character morphing',
      'face changing',
      'body transformation',
      'clothing change',
      'identity shift',
      'different person',
      'inconsistent appearance',
    ];
  }
  
  return {
    valid: errors.length === 0,
    errors,
    fixed,
  };
}

// =====================================================
// COMPARISON RESULT VALIDATION (for compare-scene-anchors)
// =====================================================
export function safeCompareValue(v1: any, v2: any, defaultScore: number = 80): number {
  if (v1 === undefined || v1 === null || v2 === undefined || v2 === null) {
    return defaultScore;
  }
  
  if (v1 === v2) {
    return 100;
  }
  
  return defaultScore;
}

// =====================================================
// LOG ANCHOR HEALTH
// =====================================================
export function logAnchorHealth(anchorType: string, anchor: any, validationResult: { valid: boolean; errors: string[] }) {
  if (validationResult.valid) {
    console.log(`[${anchorType}] ✓ Anchor validated successfully`);
  } else {
    console.warn(`[${anchorType}] ⚠️ Anchor validation issues (${validationResult.errors.length}): ${validationResult.errors.join(', ')}`);
  }
}
