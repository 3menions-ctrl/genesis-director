import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Scene Anchor Comparator
 * 
 * Compares two scene anchors to determine:
 * - Visual compatibility for direct cuts
 * - Gap severity for each component
 * - Recommended transition type
 * - Bridge clip prompts if needed
 */

interface SceneAnchorComparison {
  anchor1Id: string;
  anchor2Id: string;
  lightingMatch: number;
  colorMatch: number;
  depthMatch: number;
  objectMatch: number;
  motionMatch: number;
  overallScore: number;
  isCompatible: boolean;
  gaps: {
    component: 'lighting' | 'color' | 'depth' | 'objects' | 'motion';
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
    bridgePrompt: string;
  }[];
  recommendedTransition: 'cut' | 'dissolve' | 'fade' | 'ai-bridge';
  bridgeClipNeeded: boolean;
  bridgeClipPrompt?: string;
}

// Compare lighting fingerprints
function compareLighting(l1: any, l2: any): { score: number; gap?: any } {
  let score = 100;
  const gaps: string[] = [];
  
  // Time of day mismatch (severe)
  if (l1.timeOfDay !== l2.timeOfDay) {
    if (['night', 'golden-hour'].includes(l1.timeOfDay) && ['midday', 'overcast'].includes(l2.timeOfDay)) {
      score -= 40;
      gaps.push(`Time of day jump: ${l1.timeOfDay} → ${l2.timeOfDay}`);
    } else {
      score -= 20;
    }
  }
  
  // Key light direction mismatch
  if (l1.keyLightDirection !== l2.keyLightDirection) {
    score -= 15;
    gaps.push(`Light direction shift: ${l1.keyLightDirection} → ${l2.keyLightDirection}`);
  }
  
  // Intensity mismatch
  if (l1.keyLightIntensity !== l2.keyLightIntensity) {
    score -= 10;
  }
  
  // Shadow hardness mismatch
  if (l1.shadowHardness !== l2.shadowHardness) {
    score -= 10;
  }
  
  const gap = gaps.length > 0 ? {
    component: 'lighting' as const,
    severity: score < 60 ? 'severe' as const : score < 80 ? 'moderate' as const : 'minor' as const,
    description: gaps.join('; '),
    bridgePrompt: `Transition lighting from ${l1.promptFragment} to ${l2.promptFragment}`,
  } : undefined;
  
  return { score: Math.max(0, score), gap };
}

// Compare color palettes
function compareColor(c1: any, c2: any): { score: number; gap?: any } {
  let score = 100;
  const gaps: string[] = [];
  
  // Temperature mismatch
  if (c1.temperature !== c2.temperature) {
    score -= 25;
    gaps.push(`Temperature shift: ${c1.temperature} → ${c2.temperature}`);
  }
  
  // Saturation mismatch
  if (c1.saturation !== c2.saturation) {
    score -= 15;
    gaps.push(`Saturation shift: ${c1.saturation} → ${c2.saturation}`);
  }
  
  // Grade style mismatch
  if (c1.gradeStyle !== c2.gradeStyle) {
    score -= 20;
    gaps.push(`Color grade shift: ${c1.gradeStyle} → ${c2.gradeStyle}`);
  }
  
  // Compare dominant colors (simplified hex comparison)
  const colors1 = c1.dominant?.map((d: any) => d.hex?.toLowerCase()) || [];
  const colors2 = c2.dominant?.map((d: any) => d.hex?.toLowerCase()) || [];
  const commonColors = colors1.filter((c: string) => colors2.includes(c));
  if (commonColors.length < Math.min(colors1.length, colors2.length) / 2) {
    score -= 20;
    gaps.push('Significant palette change');
  }
  
  const gap = gaps.length > 0 ? {
    component: 'color' as const,
    severity: score < 60 ? 'severe' as const : score < 80 ? 'moderate' as const : 'minor' as const,
    description: gaps.join('; '),
    bridgePrompt: `Transition colors from ${c1.gradeStyle} to ${c2.gradeStyle}`,
  } : undefined;
  
  return { score: Math.max(0, score), gap };
}

// Compare depth cues
function compareDepth(d1: any, d2: any): { score: number; gap?: any } {
  let score = 100;
  const gaps: string[] = [];
  
  // DOF style mismatch
  if (d1.dofStyle !== d2.dofStyle) {
    score -= 20;
    gaps.push(`Depth of field shift: ${d1.dofStyle} → ${d2.dofStyle}`);
  }
  
  // Perspective type mismatch
  if (d1.perspectiveType !== d2.perspectiveType) {
    score -= 15;
    gaps.push(`Perspective shift: ${d1.perspectiveType} → ${d2.perspectiveType}`);
  }
  
  // Fog/haze mismatch
  if (d1.fogHaze !== d2.fogHaze) {
    score -= 10;
  }
  
  // Atmospheric perspective mismatch
  if (d1.atmosphericPerspective !== d2.atmosphericPerspective) {
    score -= 10;
  }
  
  const gap = gaps.length > 0 ? {
    component: 'depth' as const,
    severity: score < 60 ? 'severe' as const : score < 80 ? 'moderate' as const : 'minor' as const,
    description: gaps.join('; '),
    bridgePrompt: `Transition depth from ${d1.dofStyle} to ${d2.dofStyle}`,
  } : undefined;
  
  return { score: Math.max(0, score), gap };
}

// Compare key objects
function compareObjects(o1: any, o2: any): { score: number; gap?: any } {
  let score = 100;
  const gaps: string[] = [];
  
  // Environment type mismatch (severe)
  if (o1.environmentType !== o2.environmentType) {
    score -= 40;
    gaps.push(`Environment type change: ${o1.environmentType} → ${o2.environmentType}`);
  }
  
  // Architectural style mismatch
  if (o1.architecturalStyle !== o2.architecturalStyle) {
    score -= 20;
    gaps.push(`Style change: ${o1.architecturalStyle} → ${o2.architecturalStyle}`);
  }
  
  // Check for object continuity
  const objects1 = o1.objects?.map((o: any) => o.name.toLowerCase()) || [];
  const objects2 = o2.objects?.map((o: any) => o.name.toLowerCase()) || [];
  const heroObjects1 = o1.objects?.filter((o: any) => o.importance === 'hero') || [];
  const heroObjects2 = o2.objects?.filter((o: any) => o.importance === 'hero') || [];
  
  // Hero objects should persist
  const missingHeroes = heroObjects1.filter((h: any) => 
    !objects2.some((name: string) => name.includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(name))
  );
  if (missingHeroes.length > 0) {
    score -= 15 * missingHeroes.length;
    gaps.push(`Missing hero objects: ${missingHeroes.map((h: any) => h.name).join(', ')}`);
  }
  
  const gap = gaps.length > 0 ? {
    component: 'objects' as const,
    severity: score < 60 ? 'severe' as const : score < 80 ? 'moderate' as const : 'minor' as const,
    description: gaps.join('; '),
    bridgePrompt: `Transition environment from ${o1.settingDescription} to ${o2.settingDescription}`,
  } : undefined;
  
  return { score: Math.max(0, score), gap };
}

// Compare motion signatures
function compareMotion(m1: any, m2: any): { score: number; gap?: any } {
  let score = 100;
  const gaps: string[] = [];
  
  // Camera motion style mismatch
  if (m1.cameraMotionStyle !== m2.cameraMotionStyle) {
    const styleDiff = Math.abs(
      ['static', 'subtle', 'dynamic', 'chaotic'].indexOf(m1.cameraMotionStyle) -
      ['static', 'subtle', 'dynamic', 'chaotic'].indexOf(m2.cameraMotionStyle)
    );
    score -= styleDiff * 10;
    if (styleDiff > 1) {
      gaps.push(`Camera motion shift: ${m1.cameraMotionStyle} → ${m2.cameraMotionStyle}`);
    }
  }
  
  // Pacing tempo mismatch
  if (m1.pacingTempo !== m2.pacingTempo) {
    score -= 15;
    gaps.push(`Pacing shift: ${m1.pacingTempo} → ${m2.pacingTempo}`);
  }
  
  // Subject motion intensity mismatch
  if (m1.subjectMotionIntensity !== m2.subjectMotionIntensity) {
    score -= 10;
  }
  
  const gap = gaps.length > 0 ? {
    component: 'motion' as const,
    severity: score < 60 ? 'severe' as const : score < 80 ? 'moderate' as const : 'minor' as const,
    description: gaps.join('; '),
    bridgePrompt: `Transition motion from ${m1.promptFragment} to ${m2.promptFragment}`,
  } : undefined;
  
  return { score: Math.max(0, score), gap };
}

// Determine recommended transition
function recommendTransition(comparison: Partial<SceneAnchorComparison>): {
  transition: 'cut' | 'dissolve' | 'fade' | 'ai-bridge';
  bridgeNeeded: boolean;
  bridgePrompt?: string;
} {
  const score = comparison.overallScore || 0;
  const gaps = comparison.gaps || [];
  const severeGaps = gaps.filter(g => g.severity === 'severe');
  
  if (score >= 85) {
    return { transition: 'cut', bridgeNeeded: false };
  }
  
  if (score >= 70) {
    return { transition: 'dissolve', bridgeNeeded: false };
  }
  
  if (score >= 50) {
    return { transition: 'fade', bridgeNeeded: false };
  }
  
  // Score < 50: Need AI bridge clip
  const bridgePrompts = severeGaps.map(g => g.bridgePrompt);
  return {
    transition: 'ai-bridge',
    bridgeNeeded: true,
    bridgePrompt: `Create a 2-second transition shot that bridges: ${bridgePrompts.join('. ')}. Maintain visual continuity and gradual change.`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { anchor1, anchor2, strictness = 'normal' } = await req.json();

    if (!anchor1 || !anchor2) {
      throw new Error("Both anchor1 and anchor2 are required");
    }

    console.log(`[Scene Compare] Comparing ${anchor1.id} vs ${anchor2.id}`);

    // Apply strictness multiplier
    const strictnessMultiplier = strictness === 'strict' ? 0.8 : strictness === 'lenient' ? 1.2 : 1.0;

    // Compare each component
    const lightingResult = compareLighting(anchor1.lighting, anchor2.lighting);
    const colorResult = compareColor(anchor1.colorPalette, anchor2.colorPalette);
    const depthResult = compareDepth(anchor1.depthCues, anchor2.depthCues);
    const objectResult = compareObjects(anchor1.keyObjects, anchor2.keyObjects);
    const motionResult = compareMotion(anchor1.motionSignature, anchor2.motionSignature);

    // Collect all gaps
    const gaps = [
      lightingResult.gap,
      colorResult.gap,
      depthResult.gap,
      objectResult.gap,
      motionResult.gap,
    ].filter(Boolean) as SceneAnchorComparison['gaps'];

    // Calculate overall score (weighted average)
    const overallScore = Math.min(100, Math.round(
      (lightingResult.score * 0.25 +
       colorResult.score * 0.25 +
       depthResult.score * 0.15 +
       objectResult.score * 0.20 +
       motionResult.score * 0.15) * strictnessMultiplier
    ));

    // Determine compatibility threshold based on strictness
    const compatibilityThreshold = strictness === 'strict' ? 80 : strictness === 'lenient' ? 60 : 70;

    // Get transition recommendation
    const transitionRec = recommendTransition({ overallScore, gaps });

    const comparison: SceneAnchorComparison = {
      anchor1Id: anchor1.id,
      anchor2Id: anchor2.id,
      lightingMatch: lightingResult.score,
      colorMatch: colorResult.score,
      depthMatch: depthResult.score,
      objectMatch: objectResult.score,
      motionMatch: motionResult.score,
      overallScore,
      isCompatible: overallScore >= compatibilityThreshold,
      gaps,
      recommendedTransition: transitionRec.transition,
      bridgeClipNeeded: transitionRec.bridgeNeeded,
      bridgeClipPrompt: transitionRec.bridgePrompt,
    };

    console.log(`[Scene Compare] Result: ${overallScore}% compatible, transition: ${comparison.recommendedTransition}`);

    return new Response(
      JSON.stringify({
        success: true,
        comparison,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Scene Compare] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
