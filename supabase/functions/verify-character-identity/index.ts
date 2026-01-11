import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * VERIFY CHARACTER IDENTITY
 * 
 * Post-generation identity verification system.
 * Analyzes generated video frames against the identity bible
 * to detect character drift and auto-regenerate if needed.
 * 
 * Layer 4 of the 5-Layer Character Consistency System
 */

interface VerifyIdentityRequest {
  projectId: string;
  userId: string;
  clipIndex: number;
  videoUrl: string;
  identityBible: {
    characterDescription: string;
    consistencyAnchors?: string[];
    nonFacialAnchors?: {
      bodyType?: string;
      clothingDescription?: string;
      clothingColors?: string[];
      hairColor?: string;
      hairStyle?: string;
      accessories?: string[];
      overallSilhouette?: string;
    };
    views?: {
      front?: { imageUrl: string };
      side?: { imageUrl: string };
      back?: { imageUrl: string };
    };
  };
  passThreshold?: number;
  framesToAnalyze?: number;
  autoRegenerate?: boolean;
  regenerationAttempt?: number;
  maxRegenerations?: number;
  originalPrompt?: string;
}

interface VerificationResult {
  passed: boolean;
  overallScore: number;
  faceScore: number;
  bodyScore: number;
  clothingScore: number;
  hairScore: number;
  accessoryScore: number;
  silhouetteScore: number;
  issues: Array<{
    type: string;
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
  }>;
  shouldRegenerate: boolean;
  regenerationHints: string[];
  analysisDetails: string;
}

// Extract frames from video URL (using Cloud Run service or fallback)
async function extractFramesFromVideo(
  videoUrl: string,
  frameCount: number = 3
): Promise<string[]> {
  const CLOUD_RUN_URL = Deno.env.get('CLOUD_RUN_STITCHER_URL');
  
  // Try Cloud Run frame extraction
  if (CLOUD_RUN_URL) {
    try {
      const response = await fetch(`${CLOUD_RUN_URL}/extract-frames`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          frameCount,
          positions: ['start', 'middle', 'end'],
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.frames && data.frames.length > 0) {
          console.log(`[VerifyIdentity] Extracted ${data.frames.length} frames via Cloud Run`);
          return data.frames;
        }
      }
    } catch (err) {
      console.warn('[VerifyIdentity] Cloud Run frame extraction failed:', err);
    }
  }
  
  // Fallback: use edge function for last frame only
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/extract-last-frame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ videoUrl }),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.frameUrl) {
        console.log('[VerifyIdentity] Extracted 1 frame via edge function fallback');
        return [data.frameUrl];
      }
    }
  } catch (err) {
    console.warn('[VerifyIdentity] Edge function frame extraction failed:', err);
  }
  
  return [];
}

// Analyze frames against identity bible using Gemini
async function analyzeIdentityConsistency(
  frameUrls: string[],
  identityBible: VerifyIdentityRequest['identityBible']
): Promise<VerificationResult> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.error('[VerifyIdentity] LOVABLE_API_KEY not configured');
    // Return passing result if we can't verify
    return {
      passed: true,
      overallScore: 75,
      faceScore: 75,
      bodyScore: 75,
      clothingScore: 75,
      hairScore: 75,
      accessoryScore: 75,
      silhouetteScore: 75,
      issues: [],
      shouldRegenerate: false,
      regenerationHints: [],
      analysisDetails: 'Verification skipped - API key not configured',
    };
  }
  
  // Build comprehensive identity description
  const identityDescription = buildIdentityDescription(identityBible);
  
  // Build message content with frames
  const messageContent: any[] = [
    {
      type: 'text',
      text: `You are an expert character consistency analyst for AI-generated videos.

REFERENCE CHARACTER IDENTITY:
${identityDescription}

TASK: Analyze the video frame(s) below and verify if the character matches the reference identity.

Score each aspect from 0-100:
1. FACE: Facial features, expression consistency
2. BODY: Body type, proportions, posture
3. CLOTHING: Outfit, colors, patterns, textures
4. HAIR: Color, style, length, texture
5. ACCESSORIES: Jewelry, bags, watches, etc.
6. SILHOUETTE: Overall body shape/outline

IMPORTANT RULES:
- If face is not visible (turned away, occluded), score based on other visible features
- A character can still pass if face is hidden but body/clothing match perfectly
- Weight clothing and body type HEAVILY when face is not visible
- Look for ANY sign of character morphing or identity drift

Return ONLY valid JSON:
{
  "faceScore": number,
  "bodyScore": number,
  "clothingScore": number,
  "hairScore": number,
  "accessoryScore": number,
  "silhouetteScore": number,
  "faceVisible": boolean,
  "issues": [
    {
      "type": "face_changed|clothing_changed|hair_changed|body_changed|accessory_missing|silhouette_mismatch",
      "severity": "minor|moderate|severe",
      "description": "specific description of the issue"
    }
  ],
  "regenerationHints": ["specific prompt additions to fix issues"],
  "analysisDetails": "brief explanation of what was observed"
}`
    }
  ];
  
  // Add frame images
  for (const frameUrl of frameUrls.slice(0, 3)) { // Max 3 frames
    messageContent.push({
      type: 'image_url',
      image_url: { url: frameUrl }
    });
  }
  
  // Add reference image if available
  if (identityBible.views?.front?.imageUrl) {
    messageContent.push({
      type: 'text',
      text: '\n\nREFERENCE IMAGE (this is what the character should look like):'
    });
    messageContent.push({
      type: 'image_url',
      image_url: { url: identityBible.views.front.imageUrl }
    });
  }
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: messageContent,
        }],
        max_tokens: 1500,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[VerifyIdentity] Gemini API error:', errorText);
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    // Calculate overall score (weighted)
    const weights = {
      face: analysis.faceVisible ? 0.25 : 0.05, // Low weight if face not visible
      body: analysis.faceVisible ? 0.15 : 0.25,
      clothing: analysis.faceVisible ? 0.20 : 0.30,
      hair: 0.15,
      accessory: 0.10,
      silhouette: analysis.faceVisible ? 0.15 : 0.20,
    };
    
    const overallScore = Math.round(
      analysis.faceScore * weights.face +
      analysis.bodyScore * weights.body +
      analysis.clothingScore * weights.clothing +
      analysis.hairScore * weights.hair +
      analysis.accessoryScore * weights.accessory +
      analysis.silhouetteScore * weights.silhouette
    );
    
    // Determine if severe issues exist
    const hasSevereIssues = analysis.issues?.some((i: any) => i.severity === 'severe') || false;
    const hasModerateIssues = analysis.issues?.filter((i: any) => i.severity === 'moderate').length >= 2;
    
    return {
      passed: overallScore >= 70 && !hasSevereIssues,
      overallScore,
      faceScore: analysis.faceScore || 75,
      bodyScore: analysis.bodyScore || 75,
      clothingScore: analysis.clothingScore || 75,
      hairScore: analysis.hairScore || 75,
      accessoryScore: analysis.accessoryScore || 75,
      silhouetteScore: analysis.silhouetteScore || 75,
      issues: analysis.issues || [],
      shouldRegenerate: overallScore < 65 || hasSevereIssues || hasModerateIssues,
      regenerationHints: analysis.regenerationHints || [],
      analysisDetails: analysis.analysisDetails || 'Analysis complete',
    };
    
  } catch (err) {
    console.error('[VerifyIdentity] Analysis error:', err);
    // Return neutral result on error
    return {
      passed: true,
      overallScore: 70,
      faceScore: 70,
      bodyScore: 70,
      clothingScore: 70,
      hairScore: 70,
      accessoryScore: 70,
      silhouetteScore: 70,
      issues: [],
      shouldRegenerate: false,
      regenerationHints: [],
      analysisDetails: `Analysis error: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}

// Build identity description from bible
function buildIdentityDescription(bible: VerifyIdentityRequest['identityBible']): string {
  const parts: string[] = [];
  
  if (bible.characterDescription) {
    parts.push(`CHARACTER: ${bible.characterDescription}`);
  }
  
  if (bible.nonFacialAnchors) {
    const nfa = bible.nonFacialAnchors;
    if (nfa.bodyType) parts.push(`BODY TYPE: ${nfa.bodyType}`);
    if (nfa.clothingDescription) parts.push(`CLOTHING: ${nfa.clothingDescription}`);
    if (nfa.clothingColors?.length) parts.push(`CLOTHING COLORS: ${nfa.clothingColors.join(', ')}`);
    if (nfa.hairColor || nfa.hairStyle) parts.push(`HAIR: ${nfa.hairColor || ''} ${nfa.hairStyle || ''}`);
    if (nfa.accessories?.length) parts.push(`ACCESSORIES: ${nfa.accessories.join(', ')}`);
    if (nfa.overallSilhouette) parts.push(`SILHOUETTE: ${nfa.overallSilhouette}`);
  }
  
  if (bible.consistencyAnchors?.length) {
    parts.push(`KEY ANCHORS: ${bible.consistencyAnchors.join(', ')}`);
  }
  
  return parts.join('\n');
}

// Trigger clip regeneration with enhanced prompts
async function triggerRegeneration(
  request: VerifyIdentityRequest,
  verificationResult: VerificationResult
): Promise<{ success: boolean; message: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const attempt = (request.regenerationAttempt || 0) + 1;
  const maxAttempts = request.maxRegenerations || 2;
  
  if (attempt > maxAttempts) {
    console.log(`[VerifyIdentity] Max regeneration attempts (${maxAttempts}) reached for clip ${request.clipIndex}`);
    return { success: false, message: `Max regeneration attempts reached` };
  }
  
  console.log(`[VerifyIdentity] Triggering regeneration attempt ${attempt}/${maxAttempts} for clip ${request.clipIndex}`);
  
  // Build enhanced prompt with hints
  let enhancedPrompt = request.originalPrompt || '';
  
  // Add identity reinforcement based on issues
  const reinforcements: string[] = [];
  
  for (const issue of verificationResult.issues) {
    switch (issue.type) {
      case 'clothing_changed':
        if (request.identityBible.nonFacialAnchors?.clothingDescription) {
          reinforcements.push(`MUST MAINTAIN EXACT CLOTHING: ${request.identityBible.nonFacialAnchors.clothingDescription}`);
        }
        break;
      case 'hair_changed':
        if (request.identityBible.nonFacialAnchors?.hairColor) {
          reinforcements.push(`MUST MAINTAIN EXACT HAIR: ${request.identityBible.nonFacialAnchors.hairColor} ${request.identityBible.nonFacialAnchors.hairStyle || ''}`);
        }
        break;
      case 'body_changed':
        if (request.identityBible.nonFacialAnchors?.bodyType) {
          reinforcements.push(`MUST MAINTAIN EXACT BODY TYPE: ${request.identityBible.nonFacialAnchors.bodyType}`);
        }
        break;
      case 'face_changed':
        reinforcements.push(`CRITICAL: Maintain EXACT same facial features as previous clips`);
        break;
    }
  }
  
  // Add regeneration hints from analysis
  if (verificationResult.regenerationHints.length > 0) {
    reinforcements.push(`CONSISTENCY FIXES: ${verificationResult.regenerationHints.join('. ')}`);
  }
  
  // Store regeneration info
  await supabase
    .from('video_clips')
    .update({
      status: 'pending',
      error_message: null,
      corrective_prompts: reinforcements,
      debug_attempts: attempt,
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', request.projectId)
    .eq('shot_index', request.clipIndex);
  
  // Call generate-single-clip with enhanced context
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-single-clip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        projectId: request.projectId,
        userId: request.userId,
        clipIndex: request.clipIndex,
        prompt: enhancedPrompt,
        totalClips: 1,
        identityBible: {
          ...request.identityBible,
          // Add corrective prompts
          correctivePrompts: reinforcements,
        },
        isRetry: true,
        // Pass verification context for better generation
        verificationContext: {
          previousScore: verificationResult.overallScore,
          issues: verificationResult.issues.map(i => i.type),
          attempt,
        },
      }),
    });
    
    if (response.ok) {
      console.log(`[VerifyIdentity] Regeneration triggered successfully for clip ${request.clipIndex}`);
      return { success: true, message: `Regeneration attempt ${attempt} started` };
    } else {
      const errorText = await response.text();
      console.error(`[VerifyIdentity] Regeneration failed:`, errorText);
      return { success: false, message: `Regeneration failed: ${errorText}` };
    }
  } catch (err) {
    console.error('[VerifyIdentity] Regeneration error:', err);
    return { success: false, message: `Regeneration error: ${err instanceof Error ? err.message : 'Unknown'}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: VerifyIdentityRequest = await req.json();
    
    console.log(`[VerifyIdentity] Verifying clip ${request.clipIndex} for project ${request.projectId}`);
    
    if (!request.videoUrl) {
      throw new Error("videoUrl is required");
    }
    
    if (!request.identityBible?.characterDescription) {
      throw new Error("identityBible with characterDescription is required");
    }
    
    const passThreshold = request.passThreshold || 70;
    const framesToAnalyze = request.framesToAnalyze || 3;
    const autoRegenerate = request.autoRegenerate !== false; // Default true
    
    // Step 1: Extract frames from video
    console.log(`[VerifyIdentity] Extracting ${framesToAnalyze} frames from video...`);
    const frameUrls = await extractFramesFromVideo(request.videoUrl, framesToAnalyze);
    
    if (frameUrls.length === 0) {
      console.warn('[VerifyIdentity] No frames extracted, skipping verification');
      return new Response(
        JSON.stringify({
          success: true,
          passed: true,
          message: 'Verification skipped - no frames extracted',
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[VerifyIdentity] Analyzing ${frameUrls.length} frames...`);
    
    // Step 2: Analyze identity consistency
    const verificationResult = await analyzeIdentityConsistency(frameUrls, request.identityBible);
    
    console.log(`[VerifyIdentity] Verification result: Score ${verificationResult.overallScore}/100, Passed: ${verificationResult.passed}`);
    
    if (verificationResult.issues.length > 0) {
      console.log(`[VerifyIdentity] Issues detected:`, verificationResult.issues.map(i => `${i.type}(${i.severity})`).join(', '));
    }
    
    // Step 3: Auto-regenerate if needed
    let regenerationResult = null;
    if (!verificationResult.passed && verificationResult.shouldRegenerate && autoRegenerate) {
      console.log(`[VerifyIdentity] Triggering auto-regeneration...`);
      regenerationResult = await triggerRegeneration(request, verificationResult);
    }
    
    const processingTimeMs = Date.now() - startTime;
    console.log(`[VerifyIdentity] Complete in ${processingTimeMs}ms`);
    
    return new Response(
      JSON.stringify({
        success: true,
        passed: verificationResult.passed,
        verification: verificationResult,
        regeneration: regenerationResult,
        framesAnalyzed: frameUrls.length,
        processingTimeMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[VerifyIdentity] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        passed: true, // Default to passing on error to not block pipeline
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
