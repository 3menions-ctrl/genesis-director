/**
 * FRAME BLENDING SYSTEM
 * 
 * Provides smooth transitions between clips by analyzing and blending
 * the last frame of clip N with the first frame of clip N+1.
 * 
 * Techniques:
 * 1. Color temperature matching
 * 2. Lighting direction consistency
 * 3. Motion vector continuation
 * 4. Depth-of-field matching
 */

export interface FrameAnalysis {
  colorTemperature: 'warm' | 'neutral' | 'cool';
  dominantColors: string[];
  lightingDirection: 'left' | 'right' | 'front' | 'back' | 'overhead' | 'ambient';
  shadowIntensity: 'strong' | 'medium' | 'soft' | 'none';
  motionVector: { direction: string; intensity: 'high' | 'medium' | 'low' | 'static' };
  depthOfField: 'shallow' | 'medium' | 'deep';
  exposureLevel: 'bright' | 'normal' | 'dark';
}

export interface BlendingResult {
  compatible: boolean;
  score: number;
  corrections: BlendingCorrection[];
  transitionPrompt: string;
  negativePrompts: string[];
}

export interface BlendingCorrection {
  type: 'color' | 'lighting' | 'motion' | 'depth' | 'exposure';
  description: string;
  promptAddition: string;
}

/**
 * Analyze frame characteristics from scene anchor data
 */
export function analyzeFrameFromAnchor(sceneAnchor: any): FrameAnalysis {
  const defaultAnalysis: FrameAnalysis = {
    colorTemperature: 'neutral',
    dominantColors: [],
    lightingDirection: 'front',
    shadowIntensity: 'medium',
    motionVector: { direction: 'forward', intensity: 'low' },
    depthOfField: 'medium',
    exposureLevel: 'normal',
  };
  
  if (!sceneAnchor) return defaultAnalysis;
  
  // Extract color temperature
  if (sceneAnchor.colorPalette?.temperature) {
    const temp = sceneAnchor.colorPalette.temperature.toLowerCase();
    if (temp.includes('warm')) defaultAnalysis.colorTemperature = 'warm';
    else if (temp.includes('cool')) defaultAnalysis.colorTemperature = 'cool';
  }
  
  // Extract dominant colors
  if (sceneAnchor.colorPalette?.dominant) {
    defaultAnalysis.dominantColors = sceneAnchor.colorPalette.dominant
      .slice(0, 3)
      .map((d: any) => d.name || d.hex || 'unknown');
  }
  
  // Extract lighting direction
  if (sceneAnchor.lighting?.keyLightDirection) {
    const dir = sceneAnchor.lighting.keyLightDirection.toLowerCase();
    if (dir.includes('left')) defaultAnalysis.lightingDirection = 'left';
    else if (dir.includes('right')) defaultAnalysis.lightingDirection = 'right';
    else if (dir.includes('back')) defaultAnalysis.lightingDirection = 'back';
    else if (dir.includes('above') || dir.includes('top')) defaultAnalysis.lightingDirection = 'overhead';
  }
  
  // Extract shadow intensity
  if (sceneAnchor.lighting?.shadowDirection) {
    const shadow = sceneAnchor.lighting.shadowIntensity?.toLowerCase() || '';
    if (shadow.includes('strong') || shadow.includes('harsh')) {
      defaultAnalysis.shadowIntensity = 'strong';
    } else if (shadow.includes('soft')) {
      defaultAnalysis.shadowIntensity = 'soft';
    }
  }
  
  // Extract motion
  if (sceneAnchor.motionSignature) {
    const motion = sceneAnchor.motionSignature;
    defaultAnalysis.motionVector = {
      direction: motion.cameraMotionStyle || 'static',
      intensity: motion.pacingTempo === 'fast' ? 'high' : 
                 motion.pacingTempo === 'slow' ? 'low' : 'medium',
    };
  }
  
  // Extract DOF
  if (sceneAnchor.depthCues?.dofStyle) {
    const dof = sceneAnchor.depthCues.dofStyle.toLowerCase();
    if (dof.includes('shallow') || dof.includes('bokeh')) {
      defaultAnalysis.depthOfField = 'shallow';
    } else if (dof.includes('deep')) {
      defaultAnalysis.depthOfField = 'deep';
    }
  }
  
  return defaultAnalysis;
}

/**
 * Calculate blending compatibility between two frames
 */
export function calculateBlendingCompatibility(
  previousFrame: FrameAnalysis,
  nextFrameTarget: FrameAnalysis
): BlendingResult {
  const corrections: BlendingCorrection[] = [];
  let score = 100;
  
  // Check color temperature
  if (previousFrame.colorTemperature !== nextFrameTarget.colorTemperature) {
    score -= 15;
    corrections.push({
      type: 'color',
      description: `Color temperature mismatch: ${previousFrame.colorTemperature} → ${nextFrameTarget.colorTemperature}`,
      promptAddition: `Maintain ${previousFrame.colorTemperature} color temperature from previous shot`,
    });
  }
  
  // Check lighting direction
  if (previousFrame.lightingDirection !== nextFrameTarget.lightingDirection) {
    score -= 20;
    corrections.push({
      type: 'lighting',
      description: `Lighting direction change: ${previousFrame.lightingDirection} → ${nextFrameTarget.lightingDirection}`,
      promptAddition: `Continue ${previousFrame.lightingDirection} lighting direction, shadows ${previousFrame.shadowIntensity}`,
    });
  }
  
  // Check motion continuity
  if (previousFrame.motionVector.intensity !== 'static' && 
      previousFrame.motionVector.direction !== nextFrameTarget.motionVector.direction) {
    score -= 10;
    corrections.push({
      type: 'motion',
      description: `Motion direction change: ${previousFrame.motionVector.direction}`,
      promptAddition: `Continue motion ${previousFrame.motionVector.direction} with ${previousFrame.motionVector.intensity} intensity`,
    });
  }
  
  // Check DOF
  if (previousFrame.depthOfField !== nextFrameTarget.depthOfField) {
    score -= 5;
    corrections.push({
      type: 'depth',
      description: `DOF change: ${previousFrame.depthOfField} → ${nextFrameTarget.depthOfField}`,
      promptAddition: `Maintain ${previousFrame.depthOfField} depth of field`,
    });
  }
  
  // Check exposure
  if (previousFrame.exposureLevel !== nextFrameTarget.exposureLevel) {
    score -= 10;
    corrections.push({
      type: 'exposure',
      description: `Exposure change: ${previousFrame.exposureLevel} → ${nextFrameTarget.exposureLevel}`,
      promptAddition: `Match ${previousFrame.exposureLevel} exposure level`,
    });
  }
  
  // Build transition prompt
  const transitionPrompt = buildTransitionPrompt(previousFrame, corrections);
  
  // Build negative prompts
  const negativePrompts = buildTransitionNegatives(previousFrame, nextFrameTarget);
  
  return {
    compatible: score >= 70,
    score: Math.max(0, score),
    corrections,
    transitionPrompt,
    negativePrompts,
  };
}

/**
 * Build transition prompt for seamless blending
 */
function buildTransitionPrompt(
  previousFrame: FrameAnalysis,
  corrections: BlendingCorrection[]
): string {
  const parts: string[] = [
    '[TRANSITION CONTINUITY]',
    `Previous frame: ${previousFrame.colorTemperature} temperature, ${previousFrame.lightingDirection} lighting`,
  ];
  
  if (previousFrame.dominantColors.length > 0) {
    parts.push(`Dominant colors: ${previousFrame.dominantColors.join(', ')}`);
  }
  
  if (corrections.length > 0) {
    parts.push('');
    parts.push('CORRECTIONS REQUIRED:');
    corrections.forEach(c => parts.push(`- ${c.promptAddition}`));
  }
  
  parts.push('[END TRANSITION]');
  
  return parts.join('\n');
}

/**
 * Build negative prompts to prevent transition issues
 */
function buildTransitionNegatives(
  previousFrame: FrameAnalysis,
  _nextFrame: FrameAnalysis
): string[] {
  const negatives: string[] = [];
  
  // Prevent wrong color temperature
  const wrongTemps = ['warm', 'neutral', 'cool'].filter(t => t !== previousFrame.colorTemperature);
  negatives.push(...wrongTemps.map(t => `${t} color temperature`));
  
  // Prevent wrong lighting direction
  const wrongLighting = ['left', 'right', 'front', 'back', 'overhead']
    .filter(d => d !== previousFrame.lightingDirection);
  negatives.push(...wrongLighting.slice(0, 2).map(d => `${d} lighting`));
  
  // Generic transition negatives
  negatives.push(
    'sudden lighting change',
    'color shift',
    'jarring transition',
    'discontinuous motion',
    'exposure jump',
    'white balance shift'
  );
  
  return negatives;
}

/**
 * Generate bridge frame prompt for problematic transitions
 */
export function generateBridgeFramePrompt(
  previousFrame: FrameAnalysis,
  nextFrame: FrameAnalysis
): string {
  const avgTemp = previousFrame.colorTemperature === nextFrame.colorTemperature 
    ? previousFrame.colorTemperature 
    : 'neutral';
  
  return `
[BRIDGE FRAME - SMOOTH TRANSITION]
This frame bridges two shots with different visual characteristics.

START STATE (Previous Shot):
- Color: ${previousFrame.colorTemperature}
- Lighting: ${previousFrame.lightingDirection}
- Motion: ${previousFrame.motionVector.direction}

END STATE (Next Shot Target):
- Color: ${nextFrame.colorTemperature}
- Lighting: ${nextFrame.lightingDirection}
- Motion: ${nextFrame.motionVector.direction}

BRIDGE REQUIREMENTS:
- Use ${avgTemp} color temperature
- Transition lighting gradually
- Maintain motion continuity
- No sudden visual changes

[END BRIDGE]
`;
}

/**
 * Analyze transition quality between clips
 */
export function analyzeTransitionQuality(
  clips: Array<{ sceneAnchor?: any; transitionScore?: number }>
): { overallScore: number; problemTransitions: number[] } {
  const problemTransitions: number[] = [];
  let totalScore = 0;
  
  for (let i = 1; i < clips.length; i++) {
    const prev = analyzeFrameFromAnchor(clips[i - 1].sceneAnchor);
    const curr = analyzeFrameFromAnchor(clips[i].sceneAnchor);
    
    const result = calculateBlendingCompatibility(prev, curr);
    totalScore += result.score;
    
    if (!result.compatible) {
      problemTransitions.push(i);
    }
  }
  
  const overallScore = clips.length > 1 
    ? Math.round(totalScore / (clips.length - 1))
    : 100;
  
  return { overallScore, problemTransitions };
}
