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

// =====================================================
// SAFE COMPARISON UTILITIES
// Prevents crashes on null/undefined properties
// =====================================================
function safeGet(obj: any, path: string, defaultValue: any = undefined): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[key];
  }
  
  return (current !== null && current !== undefined) ? current : defaultValue;
}

function safeCompare(v1: any, v2: any): boolean {
  if (v1 === undefined || v1 === null || v2 === undefined || v2 === null) {
    return true; // Treat missing values as "compatible"
  }
  return v1 === v2;
}

// Compare lighting fingerprints with null safety
function compareLighting(l1: any, l2: any): { score: number; gap?: any } {
  // SAFETY: Handle null/undefined inputs
  if (!l1 && !l2) return { score: 100 };
  if (!l1 || !l2) return { score: 70, gap: { component: 'lighting' as const, severity: 'minor' as const, description: 'Missing lighting data', bridgePrompt: 'maintain current lighting' } };
  
  let score = 100;
  const gaps: string[] = [];
  
  const timeOfDay1 = safeGet(l1, 'timeOfDay', 'unknown');
  const timeOfDay2 = safeGet(l2, 'timeOfDay', 'unknown');
  
  // Time of day mismatch (severe)
  if (timeOfDay1 !== 'unknown' && timeOfDay2 !== 'unknown' && timeOfDay1 !== timeOfDay2) {
    if (['night', 'golden-hour'].includes(timeOfDay1) && ['midday', 'overcast'].includes(timeOfDay2)) {
      score -= 40;
      gaps.push(`Time of day jump: ${timeOfDay1} → ${timeOfDay2}`);
    } else {
      score -= 20;
    }
  }
  
  // Key light direction mismatch
  const dir1 = safeGet(l1, 'keyLightDirection', '');
  const dir2 = safeGet(l2, 'keyLightDirection', '');
  if (dir1 && dir2 && dir1 !== dir2) {
    score -= 15;
    gaps.push(`Light direction shift: ${dir1} → ${dir2}`);
  }
  
  // Intensity mismatch
  if (!safeCompare(safeGet(l1, 'keyLightIntensity'), safeGet(l2, 'keyLightIntensity'))) {
    score -= 10;
  }
  
  // Shadow hardness mismatch
  if (!safeCompare(safeGet(l1, 'shadowHardness'), safeGet(l2, 'shadowHardness'))) {
    score -= 10;
  }
  
  const prompt1 = safeGet(l1, 'promptFragment', 'current lighting');
  const prompt2 = safeGet(l2, 'promptFragment', 'target lighting');
  
  const gap = gaps.length > 0 ? {
    component: 'lighting' as const,
    severity: score < 60 ? 'severe' as const : score < 80 ? 'moderate' as const : 'minor' as const,
    description: gaps.join('; '),
    bridgePrompt: `Transition lighting from ${prompt1} to ${prompt2}`,
  } : undefined;
  
  return { score: Math.max(0, score), gap };
}

// Compare color palettes with null safety
function compareColor(c1: any, c2: any): { score: number; gap?: any } {
  // SAFETY: Handle null/undefined inputs
  if (!c1 && !c2) return { score: 100 };
  if (!c1 || !c2) return { score: 70, gap: { component: 'color' as const, severity: 'minor' as const, description: 'Missing color data', bridgePrompt: 'maintain current colors' } };
  
  let score = 100;
  const gaps: string[] = [];
  
  const temp1 = safeGet(c1, 'temperature', 'neutral');
  const temp2 = safeGet(c2, 'temperature', 'neutral');
  
  // Temperature mismatch
  if (temp1 !== temp2) {
    score -= 25;
    gaps.push(`Temperature shift: ${temp1} → ${temp2}`);
  }
  
  const sat1 = safeGet(c1, 'saturation', 'natural');
  const sat2 = safeGet(c2, 'saturation', 'natural');
  
  // Saturation mismatch
  if (sat1 !== sat2) {
    score -= 15;
    gaps.push(`Saturation shift: ${sat1} → ${sat2}`);
  }
  
  const grade1 = safeGet(c1, 'gradeStyle', 'natural');
  const grade2 = safeGet(c2, 'gradeStyle', 'natural');
  
  // Grade style mismatch
  if (grade1 !== grade2) {
    score -= 20;
    gaps.push(`Color grade shift: ${grade1} → ${grade2}`);
  }
  
  // Compare dominant colors (simplified hex comparison) with null safety
  const dominant1 = safeGet(c1, 'dominant', []);
  const dominant2 = safeGet(c2, 'dominant', []);
  const colors1 = Array.isArray(dominant1) ? dominant1.map((d: any) => d?.hex?.toLowerCase()).filter(Boolean) : [];
  const colors2 = Array.isArray(dominant2) ? dominant2.map((d: any) => d?.hex?.toLowerCase()).filter(Boolean) : [];
  
  if (colors1.length > 0 && colors2.length > 0) {
    const commonColors = colors1.filter((c: string) => colors2.includes(c));
    if (commonColors.length < Math.min(colors1.length, colors2.length) / 2) {
      score -= 20;
      gaps.push('Significant palette change');
    }
  }
  
  const gap = gaps.length > 0 ? {
    component: 'color' as const,
    severity: score < 60 ? 'severe' as const : score < 80 ? 'moderate' as const : 'minor' as const,
    description: gaps.join('; '),
    bridgePrompt: `Transition colors from ${grade1} to ${grade2}`,
  } : undefined;
  
  return { score: Math.max(0, score), gap };
}

// Compare depth cues with null safety
function compareDepth(d1: any, d2: any): { score: number; gap?: any } {
  // SAFETY: Handle null/undefined inputs
  if (!d1 && !d2) return { score: 100 };
  if (!d1 || !d2) return { score: 70, gap: { component: 'depth' as const, severity: 'minor' as const, description: 'Missing depth data', bridgePrompt: 'maintain current depth' } };
  
  let score = 100;
  const gaps: string[] = [];
  
  const dof1 = safeGet(d1, 'dofStyle', 'deep');
  const dof2 = safeGet(d2, 'dofStyle', 'deep');
  
  // DOF style mismatch
  if (dof1 !== dof2) {
    score -= 20;
    gaps.push(`Depth of field shift: ${dof1} → ${dof2}`);
  }
  
  const persp1 = safeGet(d1, 'perspectiveType', 'one-point');
  const persp2 = safeGet(d2, 'perspectiveType', 'one-point');
  
  // Perspective type mismatch
  if (persp1 !== persp2) {
    score -= 15;
    gaps.push(`Perspective shift: ${persp1} → ${persp2}`);
  }
  
  // Fog/haze mismatch
  if (!safeCompare(safeGet(d1, 'fogHaze'), safeGet(d2, 'fogHaze'))) {
    score -= 10;
  }
  
  // Atmospheric perspective mismatch
  if (safeGet(d1, 'atmosphericPerspective', false) !== safeGet(d2, 'atmosphericPerspective', false)) {
    score -= 10;
  }
  
  const gap = gaps.length > 0 ? {
    component: 'depth' as const,
    severity: score < 60 ? 'severe' as const : score < 80 ? 'moderate' as const : 'minor' as const,
    description: gaps.join('; '),
    bridgePrompt: `Transition depth from ${dof1} to ${dof2}`,
  } : undefined;
  
  return { score: Math.max(0, score), gap };
}

// Compare key objects with null safety
function compareObjects(o1: any, o2: any): { score: number; gap?: any } {
  // SAFETY: Handle null/undefined inputs
  if (!o1 && !o2) return { score: 100 };
  if (!o1 || !o2) return { score: 70, gap: { component: 'objects' as const, severity: 'minor' as const, description: 'Missing objects data', bridgePrompt: 'maintain current environment' } };
  
  let score = 100;
  const gaps: string[] = [];
  
  const env1 = safeGet(o1, 'environmentType', 'mixed');
  const env2 = safeGet(o2, 'environmentType', 'mixed');
  
  // Environment type mismatch (severe)
  if (env1 !== env2) {
    score -= 40;
    gaps.push(`Environment type change: ${env1} → ${env2}`);
  }
  
  const arch1 = safeGet(o1, 'architecturalStyle', 'contemporary');
  const arch2 = safeGet(o2, 'architecturalStyle', 'contemporary');
  
  // Architectural style mismatch
  if (arch1 !== arch2) {
    score -= 20;
    gaps.push(`Style change: ${arch1} → ${arch2}`);
  }
  
  // Check for object continuity with null safety
  const objects1List = safeGet(o1, 'objects', []);
  const objects2List = safeGet(o2, 'objects', []);
  const objects1 = Array.isArray(objects1List) ? objects1List.map((o: any) => o?.name?.toLowerCase()).filter(Boolean) : [];
  const objects2 = Array.isArray(objects2List) ? objects2List.map((o: any) => o?.name?.toLowerCase()).filter(Boolean) : [];
  const heroObjects1 = Array.isArray(objects1List) ? objects1List.filter((o: any) => o?.importance === 'hero') : [];
  
  // Hero objects should persist
  if (heroObjects1.length > 0 && objects2.length > 0) {
    const missingHeroes = heroObjects1.filter((h: any) => 
      h?.name && !objects2.some((name: string) => name.includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(name))
    );
    if (missingHeroes.length > 0) {
      score -= 15 * missingHeroes.length;
      gaps.push(`Missing hero objects: ${missingHeroes.map((h: any) => h?.name || 'unknown').join(', ')}`);
    }
  }
  
  const setting1 = safeGet(o1, 'settingDescription', 'current setting');
  const setting2 = safeGet(o2, 'settingDescription', 'next setting');
  
  const gap = gaps.length > 0 ? {
    component: 'objects' as const,
    severity: score < 60 ? 'severe' as const : score < 80 ? 'moderate' as const : 'minor' as const,
    description: gaps.join('; '),
    bridgePrompt: `Transition environment from ${setting1} to ${setting2}`,
  } : undefined;
  
  return { score: Math.max(0, score), gap };
}

// Compare motion signatures with null safety
function compareMotion(m1: any, m2: any): { score: number; gap?: any } {
  // SAFETY: Handle null/undefined inputs
  if (!m1 && !m2) return { score: 100 };
  if (!m1 || !m2) return { score: 70, gap: { component: 'motion' as const, severity: 'minor' as const, description: 'Missing motion data', bridgePrompt: 'maintain current motion' } };
  
  let score = 100;
  const gaps: string[] = [];
  
  const cam1 = safeGet(m1, 'cameraMotionStyle', 'subtle');
  const cam2 = safeGet(m2, 'cameraMotionStyle', 'subtle');
  
  // Camera motion style mismatch
  if (cam1 !== cam2) {
    const motionStyles = ['static', 'subtle', 'dynamic', 'chaotic'];
    const styleDiff = Math.abs(
      motionStyles.indexOf(cam1) -
      motionStyles.indexOf(cam2)
    );
    score -= styleDiff * 10;
    if (styleDiff > 1) {
      gaps.push(`Camera motion shift: ${cam1} → ${cam2}`);
    }
  }
  
  const pace1 = safeGet(m1, 'pacingTempo', 'medium');
  const pace2 = safeGet(m2, 'pacingTempo', 'medium');
  
  // Pacing tempo mismatch
  if (pace1 !== pace2) {
    score -= 15;
    gaps.push(`Pacing shift: ${pace1} → ${pace2}`);
  }
  
  // Subject motion intensity mismatch
  if (!safeCompare(safeGet(m1, 'subjectMotionIntensity'), safeGet(m2, 'subjectMotionIntensity'))) {
    score -= 10;
  }
  
  const prompt1 = safeGet(m1, 'promptFragment', 'current motion');
  const prompt2 = safeGet(m2, 'promptFragment', 'target motion');
  
  const gap = gaps.length > 0 ? {
    component: 'motion' as const,
    severity: score < 60 ? 'severe' as const : score < 80 ? 'moderate' as const : 'minor' as const,
    description: gaps.join('; '),
    bridgePrompt: `Transition motion from ${prompt1} to ${prompt2}`,
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
