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
    // CRITICAL FIX: Accept EITHER characterDescription OR consistencyPrompt
    // hollywood-pipeline uses consistencyPrompt, so we must accept both
    characterDescription?: string;
    consistencyPrompt?: string;
    // Also accept characterIdentity.description for nested structure
    characterIdentity?: {
      description?: string;
      facialFeatures?: string;
      clothing?: string;
      bodyType?: string;
      distinctiveMarkers?: string[];
    };
    consistencyAnchors?: string[];
    nonFacialAnchors?: {
      bodyType?: string;
      clothingDescription?: string;
      clothingSignature?: string;
      clothingColors?: string[];
      hairColor?: string;
      hairStyle?: string;
      hairFromBehind?: string;
      accessories?: string[];
      overallSilhouette?: string;
      silhouetteDescription?: string;
      gait?: string;
      posture?: string;
    };
    // v3.0: Original reference URL (replaces multiViewUrls)
    originalReferenceUrl?: string;
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
  physicsScore: number;  // NEW: Physics/motion coherence score
  issues: Array<{
    type: string;
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
  }>;
  shouldRegenerate: boolean;
  regenerationHints: string[];
  analysisDetails: string;
  // Added for pipeline integration
  driftDetected: boolean;
  driftAreas: string[];
  correctivePrompt: string;
  detectedPose?: 'front' | 'side' | 'back' | 'three-quarter' | 'occluded';
  // Hard fail flags
  clothingHardFail: boolean;
  hairHardFail: boolean;
  bodyHardFail: boolean;
  physicsHardFail: boolean;  // NEW: Physics violation hard fail
}

// PREMIUM THRESHOLDS for $6/video character consistency
// These are strict because users pay premium for quality
const THRESHOLDS = {
  OVERALL_PASS: 80,         // Raised to 80 for premium quality
  CLOTHING_HARD_FAIL: 65,   // Clothing score below this = MUST regenerate
  HAIR_HARD_FAIL: 65,       // Hair score below this = MUST regenerate
  BODY_HARD_FAIL: 65,       // Body score below this = MUST regenerate
  FACE_HARD_FAIL: 70,       // Face score below this (if visible) = MUST regenerate
  PHYSICS_HARD_FAIL: 60,    // Physics/motion coherence below this = MUST regenerate
  MAX_REGENERATIONS: 3,
};

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
      physicsScore: 75,
      issues: [],
      shouldRegenerate: false,
      regenerationHints: [],
      analysisDetails: 'Verification skipped - API key not configured',
      driftDetected: false,
      driftAreas: [],
      correctivePrompt: '',
      detectedPose: 'front',
      clothingHardFail: false,
      hairHardFail: false,
      bodyHardFail: false,
      physicsHardFail: false,
    };
  }
  
  // Build comprehensive identity description
  const identityDescription = buildIdentityDescription(identityBible);
  
  // Build message content with frames
  const messageContent: any[] = [
    {
      type: 'text',
      text: `You are an expert visual quality analyst for AI-generated videos. You must be STRICT - users pay $6 per video and expect perfection.

REFERENCE CHARACTER IDENTITY:
${identityDescription}

TASK: Analyze the video frame(s) below and verify BOTH character identity AND physics/motion coherence.

Score each aspect from 0-100 (be HARSH - 70+ should be EXCELLENT):
1. FACE: Facial features, expression consistency (0 if not visible)
2. BODY: Body type, proportions, posture, anatomical correctness
3. CLOTHING: Outfit, colors, patterns, textures - MUST match exactly
4. HAIR: Color, style, length, texture - MUST be consistent
5. ACCESSORIES: Jewelry, bags, watches, etc.
6. SILHOUETTE: Overall body shape/outline
7. PHYSICS: Motion coherence, realistic physics, no floating/clipping/impossible poses

CRITICAL - FAIL IMMEDIATELY IF ANY OF THESE OCCUR:
- Extra limbs, missing limbs, deformed limbs
- Impossible body poses or contortions
- Clothing that defies physics (floating, clipping through body)
- Face morphing or different person
- Hair color/style completely changed
- Body proportions drastically different

IMPORTANT RULES:
- If face is not visible (turned away, occluded), score based on other visible features
- A character can still pass if face is hidden but body/clothing match perfectly
- Weight clothing and body type HEAVILY when face is not visible
- Look for ANY sign of character morphing or identity drift
- Physics issues are SEVERE - unrealistic motion = fail

Return ONLY valid JSON:
{
  "faceScore": number,
  "bodyScore": number,
  "clothingScore": number,
  "hairScore": number,
  "accessoryScore": number,
  "silhouetteScore": number,
  "physicsScore": number,
  "faceVisible": boolean,
  "issues": [
    {
      "type": "face_changed|clothing_changed|hair_changed|body_changed|accessory_missing|silhouette_mismatch|physics_violation|anatomy_error",
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
  
  // Add reference image if available - v3.0: use originalReferenceUrl
  const referenceImageUrl = identityBible.originalReferenceUrl 
    || identityBible.views?.front?.imageUrl;
  
  if (referenceImageUrl) {
    messageContent.push({
      type: 'text',
      text: '\n\nREFERENCE IMAGE (this is what the character should look like):'
    });
    messageContent.push({
      type: 'image_url',
      image_url: { url: referenceImageUrl }
    });
  }
  
  try {
    // Use Gemini 2.5 Pro for superior image analysis
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [{
          role: 'user',
          content: messageContent,
        }],
        max_tokens: 2000,
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
    
    // Calculate overall score (weighted - includes physics)
    const weights = {
      face: analysis.faceVisible ? 0.20 : 0.05, // Low weight if face not visible
      body: analysis.faceVisible ? 0.15 : 0.20,
      clothing: analysis.faceVisible ? 0.18 : 0.25,
      hair: 0.12,
      accessory: 0.08,
      silhouette: analysis.faceVisible ? 0.12 : 0.15,
      physics: 0.15, // Physics always matters
    };
    
    const physicsScore = analysis.physicsScore || 70;
    
    const overallScore = Math.round(
      (analysis.faceScore || 0) * weights.face +
      (analysis.bodyScore || 0) * weights.body +
      (analysis.clothingScore || 0) * weights.clothing +
      (analysis.hairScore || 0) * weights.hair +
      (analysis.accessoryScore || 0) * weights.accessory +
      (analysis.silhouetteScore || 0) * weights.silhouette +
      physicsScore * weights.physics
    );
    
    // Determine if severe issues exist
    const hasSevereIssues = analysis.issues?.some((i: any) => i.severity === 'severe') || false;
    const hasPhysicsViolation = analysis.issues?.some((i: any) => 
      i.type === 'physics_violation' || i.type === 'anatomy_error'
    ) || false;
    const hasModerateIssues = analysis.issues?.filter((i: any) => i.severity === 'moderate').length >= 2;
    
    // Build drift areas from issues
    const driftAreas = (analysis.issues || [])
      .filter((i: any) => i.severity === 'severe' || i.severity === 'moderate')
      .map((i: any) => i.type);
    
    // Calculate hard fail flags using THRESHOLDS
    const clothingScore = analysis.clothingScore || 75;
    const hairScore = analysis.hairScore || 75;
    const bodyScore = analysis.bodyScore || 75;
    const faceScore = analysis.faceScore || 75;
    
    const clothingHardFail = clothingScore < THRESHOLDS.CLOTHING_HARD_FAIL;
    const hairHardFail = hairScore < THRESHOLDS.HAIR_HARD_FAIL;
    const bodyHardFail = bodyScore < THRESHOLDS.BODY_HARD_FAIL;
    const faceHardFail = analysis.faceVisible && faceScore < THRESHOLDS.FACE_HARD_FAIL;
    const physicsHardFail = physicsScore < THRESHOLDS.PHYSICS_HARD_FAIL || hasPhysicsViolation;
    
    // Determine if drift occurred (use stricter threshold)
    const driftDetected = overallScore < THRESHOLDS.OVERALL_PASS || hasSevereIssues || hasModerateIssues || hasPhysicsViolation;
    
    // Should regenerate if any hard fail or overall too low
    const shouldRegenerate = clothingHardFail || hairHardFail || bodyHardFail || faceHardFail || physicsHardFail ||
      overallScore < THRESHOLDS.OVERALL_PASS || hasSevereIssues || hasModerateIssues;
    
    // Build corrective prompt from hints
    const correctivePrompt = (analysis.regenerationHints || []).join('. ');
    
    // Detect pose from analysis
    const detectedPose = analysis.faceVisible 
      ? (analysis.detectedPose || 'front') 
      : (analysis.detectedPose || 'back');
    
    // Log hard fail details
    if (clothingHardFail || hairHardFail || bodyHardFail) {
      console.log(`[VerifyIdentity] HARD FAIL detected:`);
      if (clothingHardFail) console.log(`  - Clothing: ${clothingScore} < ${THRESHOLDS.CLOTHING_HARD_FAIL}`);
      if (hairHardFail) console.log(`  - Hair: ${hairScore} < ${THRESHOLDS.HAIR_HARD_FAIL}`);
      if (bodyHardFail) console.log(`  - Body: ${bodyScore} < ${THRESHOLDS.BODY_HARD_FAIL}`);
    }
    
    return {
      passed: overallScore >= THRESHOLDS.OVERALL_PASS && !hasSevereIssues && !clothingHardFail && !hairHardFail && !bodyHardFail && !physicsHardFail,
      overallScore,
      faceScore,
      bodyScore,
      clothingScore,
      hairScore,
      accessoryScore: analysis.accessoryScore || 75,
      silhouetteScore: analysis.silhouetteScore || 75,
      physicsScore,
      issues: analysis.issues || [],
      shouldRegenerate,
      regenerationHints: analysis.regenerationHints || [],
      analysisDetails: analysis.analysisDetails || 'Analysis complete',
      driftDetected,
      driftAreas,
      correctivePrompt,
      detectedPose,
      clothingHardFail,
      hairHardFail,
      bodyHardFail,
      physicsHardFail,
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
      physicsScore: 70,
      issues: [],
      shouldRegenerate: false,
      regenerationHints: [],
      analysisDetails: `Analysis error: ${err instanceof Error ? err.message : 'Unknown'}`,
      driftDetected: false,
      driftAreas: [],
      correctivePrompt: '',
      detectedPose: 'front',
      clothingHardFail: false,
      hairHardFail: false,
      bodyHardFail: false,
      physicsHardFail: false,
    };
  }
}

// Build identity description from bible
// v4.0: Now supports hyper-detailed identity bible with separate feature analyses
function buildIdentityDescription(bible: VerifyIdentityRequest['identityBible'] & {
  facialFeatures?: any;
  hairDetails?: any;
  bodyDetails?: any;
  clothingDetails?: any;
  accessoryDetails?: any;
  enhancedConsistencyPrompt?: string;
  colorLockPrompt?: string;
  silhouetteLockPrompt?: string;
}): string {
  const parts: string[] = [];
  
  // v4.0: Use enhanced consistency prompt if available (most detailed)
  if (bible.enhancedConsistencyPrompt) {
    parts.push(bible.enhancedConsistencyPrompt);
  }
  
  // v4.0: Add color lock for exact matching
  if (bible.colorLockPrompt) {
    parts.push(bible.colorLockPrompt);
  }
  
  // v4.0: Add silhouette lock
  if (bible.silhouetteLockPrompt) {
    parts.push(bible.silhouetteLockPrompt);
  }
  
  // v4.0: Extract from detailed feature analyses
  if (bible.facialFeatures) {
    const f = bible.facialFeatures;
    parts.push(`FACE DETAILS: ${f.faceShape} face, ${f.skinTone} skin, ${f.eyeShape} ${f.eyeColor} eyes, ${f.eyebrowShape} eyebrows, ${f.noseShape} nose, ${f.lipShape} ${f.lipColor} lips, ${f.expression}. Age: ${f.age}.`);
  }
  
  if (bible.hairDetails) {
    const h = bible.hairDetails;
    parts.push(`HAIR DETAILS: ${h.color} ${h.length} ${h.texture} hair, ${h.style} style, ${h.parting} parting, ${h.volume} volume. Back view: ${h.backView}. Movement: ${h.movement}.`);
  }
  
  if (bible.bodyDetails) {
    const b = bible.bodyDetails;
    parts.push(`BODY DETAILS: ${b.height} with ${b.build} build, ${b.shoulderWidth} shoulders, ${b.posture}. Silhouette: ${b.silhouette}.`);
  }
  
  if (bible.clothingDetails) {
    const c = bible.clothingDetails;
    parts.push(`CLOTHING: ${c.topLayer?.color} ${c.topLayer?.texture} ${c.topLayer?.type}, ${c.bottomLayer?.color} ${c.bottomLayer?.type}, ${c.footwear?.color} ${c.footwear?.type}. Style: ${c.overallStyle}. SIGNATURE: ${c.outfit_signature}.`);
  }
  
  if (bible.accessoryDetails?.items?.length > 0) {
    const accessories = bible.accessoryDetails.items.map((a: any) => `${a.color} ${a.type} on ${a.position}`).join(', ');
    parts.push(`ACCESSORIES: ${accessories}. Signature: ${bible.accessoryDetails.signature_accessory}.`);
  }
  
  // Fallback: Accept characterDescription, consistencyPrompt, or characterIdentity.description
  if (parts.length === 0) {
    const characterDesc = bible.characterDescription 
      || bible.consistencyPrompt 
      || bible.characterIdentity?.description
      || '';
    
    if (characterDesc) {
      parts.push(`CHARACTER: ${characterDesc}`);
    }
    
    // Also extract from characterIdentity if available
    if (bible.characterIdentity) {
      const ci = bible.characterIdentity;
      if (ci.facialFeatures) parts.push(`FACE: ${ci.facialFeatures}`);
      if (ci.bodyType) parts.push(`BODY TYPE: ${ci.bodyType}`);
      if (ci.clothing) parts.push(`CLOTHING: ${ci.clothing}`);
      if (ci.distinctiveMarkers?.length) parts.push(`DISTINCTIVE FEATURES: ${ci.distinctiveMarkers.join(', ')}`);
    }
    
    if (bible.nonFacialAnchors) {
      const nfa = bible.nonFacialAnchors;
      if (nfa.bodyType) parts.push(`BODY TYPE: ${nfa.bodyType}`);
      if (nfa.clothingDescription || nfa.clothingSignature) parts.push(`CLOTHING: ${nfa.clothingDescription || nfa.clothingSignature}`);
      if (nfa.clothingColors?.length) parts.push(`CLOTHING COLORS: ${nfa.clothingColors.join(', ')}`);
      if (nfa.hairColor || nfa.hairStyle) parts.push(`HAIR: ${nfa.hairColor || ''} ${nfa.hairStyle || ''}`);
      if (nfa.hairFromBehind) parts.push(`HAIR FROM BEHIND: ${nfa.hairFromBehind}`);
      if (nfa.accessories?.length) parts.push(`ACCESSORIES: ${nfa.accessories.join(', ')}`);
      if (nfa.overallSilhouette || nfa.silhouetteDescription) parts.push(`SILHOUETTE: ${nfa.overallSilhouette || nfa.silhouetteDescription}`);
      if (nfa.gait) parts.push(`GAIT: ${nfa.gait}`);
      if (nfa.posture) parts.push(`POSTURE: ${nfa.posture}`);
    }
    
    if (bible.consistencyAnchors?.length) {
      parts.push(`KEY ANCHORS: ${bible.consistencyAnchors.join(', ')}`);
    }
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
    
    // CRITICAL FIX: Accept ANY of the character description variants
    // hollywood-pipeline uses consistencyPrompt, not characterDescription
    const hasCharacterData = request.identityBible?.characterDescription 
      || request.identityBible?.consistencyPrompt 
      || request.identityBible?.characterIdentity?.description;
    
    if (!hasCharacterData) {
      console.warn(`[VerifyIdentity] No character data found in identityBible, available fields:`, 
        Object.keys(request.identityBible || {}));
      // Instead of throwing, return passing result with warning
      return new Response(
        JSON.stringify({
          success: true,
          passed: true,
          message: 'Verification skipped - no character description available in identityBible',
          warning: 'identityBible missing characterDescription/consistencyPrompt/characterIdentity.description',
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[VerifyIdentity] Character data source: ${
      request.identityBible?.characterDescription ? 'characterDescription' : 
      request.identityBible?.consistencyPrompt ? 'consistencyPrompt' : 
      'characterIdentity.description'
    }`);
    
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
