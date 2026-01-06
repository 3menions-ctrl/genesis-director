/**
 * Cinematic Prompt Engine
 * 
 * This module handles intelligent prompt rewriting for video generation:
 * - Strips literal camera references and rewrites to perspective-based language
 * - Injects negative prompts to prevent cameraman/equipment appearances
 * - Manages consistent seeding across scene clips
 * - Provides frame-chaining context for visual continuity
 */

// Camera reference patterns to detect and rewrite
const CAMERA_REFERENCE_PATTERNS = [
  // Direct camera mentions
  { pattern: /\bcamera\s+(points?|aims?|focuses?|zooms?|pans?|tilts?|tracks?|dollies?)\s+(at|to|on|toward|towards)\s+(the\s+)?/gi, type: 'action' },
  { pattern: /\b(the\s+)?camera\s+(is\s+)?(on|at|focused\s+on)\s+/gi, type: 'position' },
  { pattern: /\b(film|shoot|capture)\s+(this\s+)?with\s+(a\s+)?camera/gi, type: 'equipment' },
  { pattern: /\bcamera(man|person|operator)?\b/gi, type: 'person' },
  { pattern: /\b(film\s+)?crew\b/gi, type: 'person' },
  { pattern: /\b(tripod|dolly|crane|steadicam|gimbal)\s+(shot)?\b/gi, type: 'equipment' },
  { pattern: /\b(lens|viewfinder|aperture)\b/gi, type: 'equipment' },
  { pattern: /\bphotographer\b/gi, type: 'person' },
  
  // Camera movement phrases
  { pattern: /\bcamera\s+(moves?|glides?|sweeps?|rises?|descends?|follows?)\b/gi, type: 'movement' },
  { pattern: /\b(we\s+)?see\s+through\s+(the\s+)?camera\b/gi, type: 'pov' },
  { pattern: /\bfrom\s+(the\s+)?camera['']?s?\s+(perspective|view|angle)\b/gi, type: 'pov' },
];

// Perspective-based language mappings
const PERSPECTIVE_REWRITES: Record<string, string[]> = {
  // Body part focus rewrites
  'legs': ['low-angle ground-level perspective focusing on the subjects\' lower body', 'floor-level view emphasizing leg movement and stance'],
  'feet': ['extreme low-angle perspective at foot level', 'ground-hugging viewpoint capturing footwear and steps'],
  'hands': ['intimate close perspective on hands and gestures', 'detail-focused view emphasizing manual dexterity'],
  'face': ['intimate portrait-level perspective', 'close personal viewpoint capturing facial expressions'],
  'eyes': ['extreme close intimate perspective on the eyes', 'tight focus revealing the windows to the soul'],
  'body': ['full-figure perspective capturing the complete form', 'comprehensive viewpoint showing the entire physique'],
  
  // Movement rewrites
  'zoom in': ['perspective gradually draws closer', 'viewpoint intimately approaches'],
  'zoom out': ['perspective gradually widens', 'viewpoint expansively retreats'],
  'pan left': ['perspective smoothly sweeps leftward', 'viewpoint glides left revealing more scene'],
  'pan right': ['perspective smoothly sweeps rightward', 'viewpoint glides right revealing more scene'],
  'tilt up': ['perspective rises upward', 'ascending viewpoint reveals height'],
  'tilt down': ['perspective descends', 'downward-moving viewpoint reveals depth'],
  'track': ['perspective smoothly follows the action', 'fluid viewpoint accompanies movement'],
  'dolly': ['perspective glides forward through space', 'smooth forward-moving viewpoint'],
  
  // Angle rewrites
  'high angle': ['elevated perspective looking down', 'bird\'s-eye viewpoint'],
  'low angle': ['ground-level perspective looking up', 'worm\'s-eye viewpoint'],
  'dutch angle': ['tilted dynamic perspective', 'canted diagonal viewpoint'],
  'overhead': ['directly-above perspective', 'top-down viewpoint'],
  'eye level': ['natural standing-height perspective', 'conversational-level viewpoint'],
};

// Mandatory negative prompt elements
const NEGATIVE_PROMPT_ELEMENTS = [
  'cameraman',
  'camera operator',
  'photographer',
  'tripod',
  'camera equipment',
  'lens',
  'film crew',
  'boom mic',
  'lighting rig',
  'reflector',
  'behind the scenes',
  'on set',
  'visible equipment',
  'fourth wall break',
  'camera visible',
  'filming equipment',
];

/**
 * Generates a deterministic seed for a scene based on project/scene identifiers
 * This ensures consistent visual generation across all clips in a scene
 */
export function generateSceneSeed(projectId: string, sceneIndex: number = 0): number {
  // Create a hash from project ID and scene index
  let hash = 0;
  const str = `${projectId}-scene-${sceneIndex}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Return positive seed in valid range (0 to 2^31 - 1)
  return Math.abs(hash) % 2147483647;
}

/**
 * Detects body part references in a prompt
 */
function detectBodyPartFocus(prompt: string): string | null {
  const bodyParts = ['legs', 'feet', 'hands', 'face', 'eyes', 'body', 'head', 'arms', 'torso'];
  const lower = prompt.toLowerCase();
  
  for (const part of bodyParts) {
    // Check for camera pointing at body part patterns
    const patterns = [
      new RegExp(`camera\\s+(points?|aims?|focuses?|on)\\s+(at\\s+)?(the\\s+)?${part}`, 'i'),
      new RegExp(`focus(ing)?\\s+on\\s+(the\\s+)?${part}`, 'i'),
      new RegExp(`shot\\s+of\\s+(the\\s+)?${part}`, 'i'),
      new RegExp(`close\\s*up\\s+(of\\s+)?(the\\s+)?${part}`, 'i'),
    ];
    
    if (patterns.some(p => p.test(lower))) {
      return part;
    }
  }
  
  return null;
}

/**
 * Rewrites camera references to perspective-based language
 */
function rewriteCameraReferences(prompt: string): string {
  let rewritten = prompt;
  
  // First, detect if there's a body part focus
  const bodyPartFocus = detectBodyPartFocus(prompt);
  
  // Remove camera reference patterns
  for (const { pattern, type } of CAMERA_REFERENCE_PATTERNS) {
    if (type === 'action' || type === 'position') {
      // Replace with perspective language
      rewritten = rewritten.replace(pattern, '');
    } else if (type === 'person' || type === 'equipment') {
      // Simply remove equipment/person references
      rewritten = rewritten.replace(pattern, '');
    } else if (type === 'movement') {
      // Replace camera movements with perspective equivalents
      rewritten = rewritten.replace(/camera\s+moves?\s*(forward|backward|left|right)?/gi, (match, direction) => {
        if (direction) {
          return `perspective shifts ${direction}`;
        }
        return 'perspective flows smoothly';
      });
    } else if (type === 'pov') {
      rewritten = rewritten.replace(pattern, 'from this perspective, ');
    }
  }
  
  // Add perspective-based language for body part focus
  if (bodyPartFocus && PERSPECTIVE_REWRITES[bodyPartFocus]) {
    const perspectives = PERSPECTIVE_REWRITES[bodyPartFocus];
    const perspectiveText = perspectives[0]; // Use first option
    
    // Clean up any remaining fragmented references
    rewritten = rewritten.replace(/\bthe\s+legs?\b/gi, 'the subject\'s legs');
    rewritten = rewritten.replace(/\bthe\s+feet\b/gi, 'the subject\'s feet');
    rewritten = rewritten.replace(/\bthe\s+hands?\b/gi, 'the subject\'s hands');
    
    // Prepend perspective description
    rewritten = `${perspectiveText}. ${rewritten}`;
  }
  
  // Rewrite common camera movement phrases
  const movementRewrites: [RegExp, string][] = [
    [/zoom(s|ing)?\s+in(\s+on)?/gi, 'perspective draws intimately closer to'],
    [/zoom(s|ing)?\s+out/gi, 'perspective expansively widens revealing'],
    [/pan(s|ning)?\s+(to\s+the\s+)?left/gi, 'perspective sweeps leftward'],
    [/pan(s|ning)?\s+(to\s+the\s+)?right/gi, 'perspective sweeps rightward'],
    [/tilt(s|ing)?\s+up/gi, 'perspective rises revealing'],
    [/tilt(s|ing)?\s+down/gi, 'perspective descends toward'],
    [/track(s|ing)?\s+(shot)?/gi, 'smooth following perspective'],
    [/dolly(s|ing)?\s+(shot)?/gi, 'gliding perspective'],
    [/push\s+in/gi, 'perspective gently approaches'],
    [/pull\s+(back|out)/gi, 'perspective gradually retreats'],
    [/crane\s+(shot|up|down)/gi, 'elevated sweeping perspective'],
    [/steadicam\s+(shot)?/gi, 'fluid floating perspective'],
    [/handheld\s+(shot)?/gi, 'organic naturalistic perspective'],
  ];
  
  for (const [pattern, replacement] of movementRewrites) {
    rewritten = rewritten.replace(pattern, replacement);
  }
  
  // Clean up double spaces and trim
  rewritten = rewritten.replace(/\s{2,}/g, ' ').trim();
  
  return rewritten;
}

/**
 * Builds the negative prompt string
 */
export function buildNegativePrompt(additionalNegatives: string[] = []): string {
  const allNegatives = [...NEGATIVE_PROMPT_ELEMENTS, ...additionalNegatives];
  return allNegatives.join(', ');
}

/**
 * Main prompt rewriting function
 * Takes a raw user/AI prompt and transforms it for optimal video generation
 */
export function rewritePromptForCinematic(
  rawPrompt: string,
  options: {
    includeNegativePrompt?: boolean;
    additionalNegatives?: string[];
    perspectiveHint?: string;
  } = {}
): { prompt: string; negativePrompt: string } {
  const { includeNegativePrompt = true, additionalNegatives = [], perspectiveHint } = options;
  
  // Step 1: Rewrite camera references to perspective language
  let processedPrompt = rewriteCameraReferences(rawPrompt);
  
  // Step 2: Add perspective hint if provided
  if (perspectiveHint) {
    processedPrompt = `${perspectiveHint}. ${processedPrompt}`;
  }
  
  // Step 3: Add cinematic quality markers if not present
  const qualityMarkers = [
    'cinematic',
    'film quality',
    'movie',
    'professional',
    'high production value',
  ];
  
  const hasQualityMarker = qualityMarkers.some(marker => 
    processedPrompt.toLowerCase().includes(marker)
  );
  
  if (!hasQualityMarker) {
    processedPrompt = `Cinematic quality, ${processedPrompt}`;
  }
  
  // Step 4: Build negative prompt
  const negativePrompt = includeNegativePrompt 
    ? buildNegativePrompt(additionalNegatives)
    : '';
  
  return {
    prompt: processedPrompt.trim(),
    negativePrompt,
  };
}

/**
 * Camera angle and scale mappings for smart perspective injection
 */
const CAMERA_SCALE_PERSPECTIVES: Record<string, string> = {
  'extreme-wide': 'vast panoramic perspective capturing the entire environment',
  'wide': 'expansive wide perspective showing full scene context',
  'medium': 'balanced mid-range perspective at conversational distance',
  'close-up': 'intimate close perspective capturing facial details and emotions',
  'extreme-close-up': 'extreme intimate perspective revealing subtle micro-details',
};

const CAMERA_ANGLE_PERSPECTIVES: Record<string, string> = {
  'eye-level': 'natural eye-level viewpoint at human standing height',
  'low-angle': 'powerful low-angle perspective looking upward, adding authority and drama',
  'high-angle': 'commanding high-angle perspective looking down, creating vulnerability or overview',
  'dutch-angle': 'dynamic tilted perspective creating tension and unease',
  'overhead': 'bird\'s-eye overhead perspective directly from above',
  'pov': 'immersive first-person point-of-view perspective',
};

const MOVEMENT_TYPE_PERSPECTIVES: Record<string, string> = {
  'static': 'steady locked-off perspective with no movement',
  'pan': 'smooth horizontal sweeping perspective',
  'tilt': 'vertical sweeping perspective rising or descending',
  'dolly': 'smooth gliding perspective moving through space',
  'tracking': 'fluid following perspective moving alongside the action',
  'crane': 'elevated sweeping perspective with vertical and horizontal movement',
  'handheld': 'organic naturalistic perspective with subtle motion',
};

/**
 * Smart angle transition logic - determines complementary angles for smooth cuts
 */
const ANGLE_TRANSITION_MAP: Record<string, string[]> = {
  'eye-level': ['low-angle', 'high-angle', 'eye-level'], // Standard to dynamic
  'low-angle': ['eye-level', 'overhead', 'dutch-angle'], // Upward to varied
  'high-angle': ['eye-level', 'low-angle', 'pov'], // Down to up or immersive
  'dutch-angle': ['eye-level', 'high-angle'], // Tension release
  'overhead': ['eye-level', 'low-angle', 'pov'], // Top to ground-level
  'pov': ['eye-level', 'over-shoulder', 'wide'], // Subjective to objective
};

const SCALE_TRANSITION_MAP: Record<string, string[]> = {
  'extreme-wide': ['wide', 'medium'], // Draw viewer in
  'wide': ['medium', 'close-up', 'extreme-wide'], // Varied progression
  'medium': ['close-up', 'wide', 'extreme-close-up'], // Push/pull options
  'close-up': ['extreme-close-up', 'medium', 'wide'], // Intensity or release
  'extreme-close-up': ['close-up', 'medium', 'wide'], // Pull back options
};

/**
 * Builds smart camera perspective text from shot properties
 */
export function buildCameraPerspective(
  cameraScale?: string,
  cameraAngle?: string,
  movementType?: string,
  transitionOut?: string,
  shotIndex?: number,
  previousShot?: { cameraScale?: string; cameraAngle?: string }
): string {
  const parts: string[] = [];
  
  // Add scale perspective
  if (cameraScale && CAMERA_SCALE_PERSPECTIVES[cameraScale]) {
    parts.push(CAMERA_SCALE_PERSPECTIVES[cameraScale]);
  }
  
  // Add angle perspective with smart transition awareness
  if (cameraAngle && CAMERA_ANGLE_PERSPECTIVES[cameraAngle]) {
    // If this is a transition from previous shot, add continuity hint
    if (previousShot?.cameraAngle && previousShot.cameraAngle !== cameraAngle) {
      parts.push(`transitioning from ${previousShot.cameraAngle} to ${CAMERA_ANGLE_PERSPECTIVES[cameraAngle]}`);
    } else {
      parts.push(CAMERA_ANGLE_PERSPECTIVES[cameraAngle]);
    }
  }
  
  // Add movement perspective
  if (movementType && MOVEMENT_TYPE_PERSPECTIVES[movementType]) {
    parts.push(MOVEMENT_TYPE_PERSPECTIVES[movementType]);
  }
  
  // Add transition-specific ending hints for seamless cuts
  if (transitionOut) {
    switch (transitionOut) {
      case 'angle-change':
        parts.push('ending with subject centered for angle transition');
        break;
      case 'motion-carry':
        parts.push('ending with forward momentum for motion continuity');
        break;
      case 'match-cut':
        parts.push('ending with distinctive visual shape for match cut');
        break;
      case 'whip-pan':
        parts.push('ending with fast horizontal sweep blur');
        break;
      case 'reveal':
        parts.push('ending with camera moving toward obstruction');
        break;
      case 'follow-through':
        parts.push('subject moving toward frame edge');
        break;
    }
  }
  
  return parts.length > 0 ? `[CAMERA: ${parts.join(', ')}]` : '';
}

/**
 * Gets recommended next camera setup for smooth transitions
 */
export function getSmartNextCamera(
  currentScale: string,
  currentAngle: string,
  transitionType: string
): { suggestedScale: string; suggestedAngle: string } {
  // For angle-change transitions, definitely change the angle
  if (transitionType === 'angle-change') {
    const angleOptions = ANGLE_TRANSITION_MAP[currentAngle] || ['eye-level'];
    const scaleOptions = SCALE_TRANSITION_MAP[currentScale] || ['medium'];
    return {
      suggestedScale: currentScale, // Keep same scale for angle-change
      suggestedAngle: angleOptions[0], // First recommended angle
    };
  }
  
  // For scene-jump, reset to establishing shot
  if (transitionType === 'scene-jump') {
    return {
      suggestedScale: 'wide',
      suggestedAngle: 'eye-level',
    };
  }
  
  // For other transitions, follow natural progression
  const scaleOptions = SCALE_TRANSITION_MAP[currentScale] || ['medium'];
  const angleOptions = ANGLE_TRANSITION_MAP[currentAngle] || ['eye-level'];
  
  return {
    suggestedScale: scaleOptions[0],
    suggestedAngle: angleOptions[Math.floor(Math.random() * angleOptions.length)],
  };
}

/**
 * Frame chaining context for seamless transitions
 */
export interface FrameChainContext {
  isFirstClip: boolean;
  previousFrameUrl?: string; // URL or base64 of the last frame from previous clip
  masterImageUrl?: string; // The anchor/reference image for the scene
  sceneSeed: number;
  clipIndex: number;
  totalClips: number;
  previousCamera?: { cameraScale?: string; cameraAngle?: string; movementType?: string };
}

/**
 * Builds a prompt enhanced with frame-chaining context
 */
export function buildChainedPrompt(
  basePrompt: string,
  chainContext: FrameChainContext
): string {
  const parts: string[] = [];
  
  // Add continuity instructions
  if (!chainContext.isFirstClip && chainContext.previousFrameUrl) {
    parts.push('[SEAMLESS CONTINUATION: Match exact visual style, lighting, and color from previous frame]');
  }
  
  // Add position context
  if (chainContext.clipIndex === 0) {
    parts.push('[ESTABLISHING SHOT: Set the visual tone and atmosphere]');
  } else if (chainContext.clipIndex === chainContext.totalClips - 1) {
    parts.push('[FINAL SHOT: Conclusive framing with sense of resolution]');
  } else {
    parts.push(`[SCENE ${chainContext.clipIndex + 1}/${chainContext.totalClips}: Maintain visual continuity]`);
  }
  
  // Add the rewritten base prompt
  const { prompt: rewrittenPrompt } = rewritePromptForCinematic(basePrompt);
  parts.push(rewrittenPrompt);
  
  // Add consistency reminders
  parts.push('[CRITICAL: Identical character appearances, consistent lighting direction, matching color temperature]');
  
  return parts.join(' ');
}

/**
 * Extracts the last frame from a video for chaining
 * This is called client-side using a canvas element
 */
export async function extractLastFrame(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    
    video.onloadedmetadata = () => {
      // Seek to slightly before the end to ensure we get the last frame
      video.currentTime = Math.max(0, video.duration - 0.1);
    };
    
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(video, 0, 0);
        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        
        // Cleanup
        video.pause();
        video.src = '';
        video.load();
        
        resolve(frameDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    video.onerror = () => {
      reject(new Error('Failed to load video for frame extraction'));
    };
    
    video.src = videoUrl;
    video.load();
  });
}

/**
 * Validates and sanitizes a seed value
 */
export function validateSeed(seed: number | undefined): number {
  if (seed === undefined || isNaN(seed)) {
    // Generate a random seed if none provided
    return Math.floor(Math.random() * 2147483647);
  }
  // Ensure seed is in valid range
  return Math.abs(Math.floor(seed)) % 2147483647;
}
