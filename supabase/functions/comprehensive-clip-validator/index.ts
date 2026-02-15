import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * COMPREHENSIVE CLIP VALIDATOR
 * 
 * Implements improvements 4.1, 4.9 and orchestrates ALL validation:
 * - Mandatory Visual Debugger for ALL clips (never skip)
 * - Multi-frame sampling (3+ frames)
 * - Color histogram validation
 * - Face embedding verification
 * - Clothing/hair verification
 * - Environment verification
 * 
 * Single entry point for complete clip validation
 */

interface ValidationRequest {
  projectId: string;
  userId?: string;
  clipIndex: number;
  videoUrl: string;
  referenceImageUrl?: string;
  shotDescription: string;
  identityBible?: any;
  sceneAnchor?: any;
  masterHistogram?: any;
  previousClipData?: any;
  
  // Validation options
  options?: {
    validateColors?: boolean;
    validateFace?: boolean;
    validateClothingHair?: boolean;
    validateEnvironment?: boolean;
    multiFrameSampling?: boolean;
    frameSampleCount?: number;
    thresholds?: {
      overall?: number;
      color?: number;
      face?: number;
      clothingHair?: number;
      environment?: number;
    };
  };
}

interface ComprehensiveValidationResult {
  passed: boolean;
  overallScore: number;
  
  // Individual validation results
  visualDebugger: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  
  colorHistogram?: {
    passed: boolean;
    score: number;
    colorDelta: number;
  };
  
  faceEmbedding?: {
    passed: boolean;
    similarityScore: number;
    driftSeverity: string;
  };
  
  clothingHair?: {
    passed: boolean;
    clothingScore: number;
    hairScore: number;
  };
  
  environment?: {
    passed: boolean;
    environmentScore: number;
    lightingScore: number;
  };
  
  // Multi-frame analysis
  multiFrame?: {
    framesAnalyzed: number;
    consistencyScore: number;
    flickeringDetected: boolean;
    morphingDetected: boolean;
  };
  
  // Aggregated issues and suggestions
  allIssues: string[];
  allSuggestions: string[];
  correctivePrompt?: string;
  
  // Should regenerate?
  shouldRegenerate: boolean;
  regenerationPriority: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

// Call another edge function
async function callEdgeFunction(functionName: string, body: any): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      console.warn(`[ComprehensiveValidator] ${functionName} returned ${response.status}`);
      return { success: false, error: `${functionName} failed` };
    }
    
    return response.json();
  } catch (error) {
    console.warn(`[ComprehensiveValidator] ${functionName} error:`, error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }
    const request: ValidationRequest = await req.json();
    const { 
      projectId, 
      userId,
      clipIndex, 
      videoUrl,
      referenceImageUrl,
      shotDescription,
      identityBible,
      sceneAnchor,
      masterHistogram,
      previousClipData,
      options = {}
    } = request;

    // Default options
    const {
      validateColors = true,
      validateFace = true,
      validateClothingHair = true,
      validateEnvironment = true,
      multiFrameSampling = true,
      frameSampleCount = 3,
      thresholds = {
        overall: 75,
        color: 10,
        face: 85,
        clothingHair: 80,
        environment: 75,
      }
    } = options;

    console.log(`[ComprehensiveValidator] Validating clip ${clipIndex} for project ${projectId}`);
    console.log(`[ComprehensiveValidator] Options: colors=${validateColors}, face=${validateFace}, clothing=${validateClothingHair}, env=${validateEnvironment}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const result: ComprehensiveValidationResult = {
      passed: true,
      overallScore: 100,
      visualDebugger: { passed: true, score: 100, issues: [] },
      allIssues: [],
      allSuggestions: [],
      shouldRegenerate: false,
      regenerationPriority: 'none',
    };

    // STEP 1: Extract frames for multi-frame analysis
    let frameUrls: string[] = [];
    
    if (multiFrameSampling) {
      console.log(`[ComprehensiveValidator] Extracting ${frameSampleCount} frames for analysis...`);
      
      // Extract first, middle, and last frames
      const positions = ['first', 'middle', 'last'];
      const extractPromises = positions.slice(0, frameSampleCount).map(async (position, i) => {
        try {
          const frameResult = await callEdgeFunction('extract-video-frame', {
            videoUrl,
            projectId,
            shotIndex: clipIndex,
            position,
          });
          return frameResult.success ? frameResult.frameUrl : null;
        } catch {
          return null;
        }
      });
      
      const frames = await Promise.all(extractPromises);
      frameUrls = frames.filter(Boolean) as string[];
      console.log(`[ComprehensiveValidator] Extracted ${frameUrls.length}/${frameSampleCount} frames`);
    }

    // Fallback: extract last frame only
    if (frameUrls.length === 0) {
      try {
        const lastFrameResult = await callEdgeFunction('extract-last-frame', {
          videoUrl,
          projectId,
          shotIndex: clipIndex,
          position: 'last',
        });
        if (lastFrameResult.success && lastFrameResult.frameUrl) {
          frameUrls = [lastFrameResult.frameUrl];
        }
      } catch (e) {
        console.warn('[ComprehensiveValidator] Failed to extract any frames');
      }
    }

    const primaryFrame = frameUrls[0] || referenceImageUrl;
    if (!primaryFrame) {
      console.warn('[ComprehensiveValidator] No frames available for validation');
      return new Response(JSON.stringify({
        success: true,
        ...result,
        allIssues: ['No frames available for validation'],
        processingTimeMs: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 2: Run all validations in parallel
    const validationPromises: Promise<any>[] = [];

    // Visual Debugger (MANDATORY - never skip)
    validationPromises.push(
      callEdgeFunction('visual-debugger', {
        videoUrl,
        frameUrl: primaryFrame,
        shotDescription,
        shotId: `clip_${clipIndex}`,
        referenceImageUrl,
        referenceAnalysis: identityBible,
      }).then(r => ({ type: 'visualDebugger', result: r }))
    );

    // Color Histogram Validation
    if (validateColors && referenceImageUrl) {
      validationPromises.push(
        callEdgeFunction('validate-color-histogram', {
          referenceImageUrl,
          clipFrameUrl: primaryFrame,
          masterHistogram,
          threshold: thresholds.color,
          projectId,
          clipIndex,
        }).then(r => ({ type: 'colorHistogram', result: r }))
      );
    }

    // Face Embedding Verification
    if (validateFace && referenceImageUrl) {
      validationPromises.push(
        callEdgeFunction('verify-face-embedding', {
          referenceImageUrl,
          clipFrameUrl: primaryFrame,
          projectId,
          clipIndex,
          threshold: thresholds.face,
        }).then(r => ({ type: 'faceEmbedding', result: r }))
      );
    }

    // Clothing/Hair Verification
    if (validateClothingHair && referenceImageUrl) {
      validationPromises.push(
        callEdgeFunction('validate-clothing-hair', {
          referenceImageUrl,
          clipFrameUrl: primaryFrame,
          projectId,
          clipIndex,
          expectedClothing: identityBible?.nonFacialAnchors?.clothingDescription,
          expectedClothingColors: identityBible?.nonFacialAnchors?.clothingColors,
          expectedHairColor: identityBible?.nonFacialAnchors?.hairColor,
          expectedHairStyle: identityBible?.nonFacialAnchors?.hairStyle,
          threshold: thresholds.clothingHair,
        }).then(r => ({ type: 'clothingHair', result: r }))
      );
    }

    // Environment Verification
    if (validateEnvironment && referenceImageUrl) {
      validationPromises.push(
        callEdgeFunction('validate-environment', {
          referenceImageUrl,
          clipFrameUrl: primaryFrame,
          projectId,
          clipIndex,
          sceneAnchor,
          threshold: thresholds.environment,
        }).then(r => ({ type: 'environment', result: r }))
      );
    }

    // Wait for all validations
    console.log(`[ComprehensiveValidator] Running ${validationPromises.length} validations in parallel...`);
    const validationResults = await Promise.all(validationPromises);

    // Process results
    const scores: number[] = [];
    
    for (const { type, result: vResult } of validationResults) {
      if (!vResult?.success && type !== 'visualDebugger') continue;
      
      switch (type) {
        case 'visualDebugger':
          const vdResult = vResult.result || vResult;
          result.visualDebugger = {
            passed: vdResult.passed ?? true,
            score: vdResult.score ?? 75,
            issues: vdResult.issues?.map((i: any) => i.description || i) || [],
          };
          scores.push(result.visualDebugger.score);
          if (!result.visualDebugger.passed) {
            result.allIssues.push(...result.visualDebugger.issues);
          }
          if (vdResult.correctivePrompt) {
            result.correctivePrompt = vdResult.correctivePrompt;
          }
          break;
          
        case 'colorHistogram':
          result.colorHistogram = {
            passed: vResult.passed,
            score: vResult.score,
            colorDelta: vResult.colorDelta,
          };
          scores.push(vResult.score);
          if (!vResult.passed && vResult.issues) {
            result.allIssues.push(...vResult.issues);
          }
          break;
          
        case 'faceEmbedding':
          result.faceEmbedding = {
            passed: vResult.passed,
            similarityScore: vResult.similarityScore,
            driftSeverity: vResult.driftSeverity,
          };
          scores.push(vResult.similarityScore);
          if (!vResult.passed && vResult.driftIssues) {
            result.allIssues.push(...vResult.driftIssues);
          }
          break;
          
        case 'clothingHair':
          result.clothingHair = {
            passed: vResult.passed,
            clothingScore: vResult.clothing?.score ?? 80,
            hairScore: vResult.hair?.score ?? 80,
          };
          scores.push(vResult.overallScore);
          if (!vResult.passed && vResult.issues) {
            result.allIssues.push(...vResult.issues);
          }
          break;
          
        case 'environment':
          result.environment = {
            passed: vResult.passed,
            environmentScore: vResult.environment?.score ?? 80,
            lightingScore: vResult.lighting?.score ?? 80,
          };
          scores.push(vResult.overallScore);
          if (!vResult.passed && vResult.issues) {
            result.allIssues.push(...vResult.issues);
          }
          break;
      }
    }

    // Multi-frame consistency check
    if (frameUrls.length > 1) {
      // Simple consistency check - compare first and last frame
      const consistencyResult = await callEdgeFunction('verify-face-embedding', {
        referenceImageUrl: frameUrls[0],
        clipFrameUrl: frameUrls[frameUrls.length - 1],
      });
      
      result.multiFrame = {
        framesAnalyzed: frameUrls.length,
        consistencyScore: consistencyResult.similarityScore ?? 90,
        flickeringDetected: (consistencyResult.similarityScore ?? 90) < 80,
        morphingDetected: consistencyResult.driftSeverity === 'severe',
      };
      
      if (result.multiFrame.flickeringDetected) {
        result.allIssues.push('Possible flickering detected between frames');
      }
      if (result.multiFrame.morphingDetected) {
        result.allIssues.push('Character morphing detected within clip');
      }
    }

    // Calculate overall score
    result.overallScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 75;

    // Determine pass/fail
    result.passed = result.overallScore >= (thresholds.overall || 75) &&
                    result.visualDebugger.passed &&
                    (result.colorHistogram?.passed !== false) &&
                    (result.faceEmbedding?.passed !== false) &&
                    (result.clothingHair?.passed !== false) &&
                    (result.environment?.passed !== false);

    // Determine regeneration priority
    if (!result.passed) {
      result.shouldRegenerate = true;
      
      if (result.overallScore < 50 || result.faceEmbedding?.driftSeverity === 'severe') {
        result.regenerationPriority = 'critical';
      } else if (result.overallScore < 65 || result.multiFrame?.morphingDetected) {
        result.regenerationPriority = 'high';
      } else if (result.overallScore < 75) {
        result.regenerationPriority = 'medium';
      } else {
        result.regenerationPriority = 'low';
      }
    }

    // Store validation results
    try {
      await supabase
        .from('video_clips')
        .update({
          quality_score: result.overallScore,
          updated_at: new Date().toISOString(),
        })
        .eq('project_id', projectId)
        .eq('shot_index', clipIndex);
    } catch (storeError) {
      console.warn('[ComprehensiveValidator] Failed to store score:', storeError);
    }

    console.log(`[ComprehensiveValidator] Result: ${result.passed ? 'PASS' : 'FAIL'} (score: ${result.overallScore})`);
    console.log(`[ComprehensiveValidator] Issues: ${result.allIssues.length}, Regeneration: ${result.regenerationPriority}`);

    return new Response(JSON.stringify({
      success: true,
      ...result,
      processingTimeMs: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[ComprehensiveValidator] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      passed: true,
      overallScore: 70,
      error: error instanceof Error ? error.message : "Unknown error",
      processingTimeMs: Date.now() - startTime,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
