import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  checkContinuityReady,
  loadPipelineContext,
} from "../_shared/generation-mutex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CONTINUE-PRODUCTION: Callback-based clip chaining
 * 
 * Called by generate-single-clip when a clip completes.
 * Triggers generation of the next clip, or moves to post-production if all clips are done.
 * This prevents edge function timeouts by generating one clip per function invocation.
 * 
 * FAILSAFE: Validates continuity before triggering next clip
 */

// =============================================================================
// SUBJECT DETECTION - Skip character injection for non-character prompts
// =============================================================================

const OBJECT_PATTERNS: RegExp[] = [
  // Vehicles / Transportation
  /\b(space\s*shuttle|rocket|spacecraft|spaceship|satellite|probe)\b/i,
  /\b(airplane|aircraft|jet|helicopter|drone|plane)\b/i,
  /\b(car|truck|bus|motorcycle|vehicle|train|ship|boat|submarine)\b/i,
  // Natural phenomena / Events
  /\b(asteroid|meteor|comet|meteorite)\s*(impact|crash|strike|hit|collid|fall)/i,
  /\b(explosion|blast|eruption|nuclear|atomic)\b/i,
  /\b(volcano|earthquake|tsunami|hurricane|tornado|storm)\b/i,
  // Pure environments/scenes
  /\b(landscape|scenery|vista|panorama|cityscape|skyline)\b/i,
];

const CHARACTER_PATTERNS: RegExp[] = [
  /\b(person|man|woman|boy|girl|child|adult|human|people|character)\b/i,
  /\b(he|she|they|him|her|his|hers|their)\b/i,
  /\b(walking|running|talking|speaking|gesturing|smiling|crying|laughing)\b/i,
  /\b(wearing|dressed|outfit|clothes|clothing)\b/i,
  /\b(face|eyes|hair|hands|body|head)\b/i,
  /\b(protagonist|hero|villain|character|actor)\b/i,
];

function detectCharacterPrompt(prompt: string): boolean {
  // Check if prompt has object/scene patterns (these override character patterns)
  const hasObjectPatterns = OBJECT_PATTERNS.some(p => p.test(prompt));
  
  // Check if prompt has character patterns
  const hasCharacterPatterns = CHARACTER_PATTERNS.some(p => p.test(prompt));
  
  // If object patterns are found AND no character patterns, it's NOT a character prompt
  if (hasObjectPatterns && !hasCharacterPatterns) {
    return false;
  }
  
  // If character patterns are found, it IS a character prompt
  if (hasCharacterPatterns) {
    return true;
  }
  
  // Default: assume character prompt for safety (legacy behavior)
  return true;
}

interface ContinueProductionRequest {
  projectId: string;
  userId: string;
  completedClipIndex: number;
  completedClipResult?: {
    videoUrl: string;
    lastFrameUrl?: string;
    motionVectors?: any;
    continuityManifest?: any;
  };
  totalClips: number;
  // Context passed from hollywood-pipeline
  pipelineContext?: {
    videoEngine?: 'kling' | 'veo'; // CRITICAL: must survive all callback hops
    identityBible?: any;
    masterSceneAnchor?: any;
    goldenFrameData?: any;
    accumulatedAnchors?: any[];
    referenceImageUrl?: string;
    colorGrading?: string;
    qualityTier?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    sceneImageLookup?: Record<number, string>;
    tierLimits?: any;
    extractedCharacters?: any[];
    clipDuration?: number;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ═══ AUTH GUARD ═══
  const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
  const auth = await validateAuth(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  // Parse body ONCE before try/catch to avoid "Body is unusable" error
  let request: ContinueProductionRequest;
  try {
    request = await req.json();
  } catch (parseError) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid request body' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { projectId, userId, completedClipIndex, completedClipResult, totalClips, pipelineContext } = request;

    console.log(`[ContinueProduction] Clip ${completedClipIndex + 1}/${totalClips} completed for project ${projectId}`);

    // Check if all clips are done
    if (completedClipIndex + 1 >= totalClips) {
      console.log(`[ContinueProduction] All ${totalClips} clips completed! Triggering post-production...`);
      
      // Update project status - use 'stitching' which is a valid pipeline_stage value
      await supabase
        .from('movie_projects')
        .update({
          pipeline_stage: 'stitching',
          status: 'generating',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      // Trigger final assembly
      const assemblyResult = await callEdgeFunction('final-assembly', {
        projectId,
        userId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          action: 'postproduction',
          message: 'All clips completed, triggered post-production',
          assemblyResult,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // More clips to generate - trigger next clip
    const nextClipIndex = completedClipIndex + 1;
    console.log(`[ContinueProduction] Triggering clip ${nextClipIndex + 1}/${totalClips}...`);

    // CRITICAL: Use the context passed from generate-single-clip (includes updated anchors)
    let context = pipelineContext;
    
    // Merge completed clip result into context for continuity
    if (completedClipResult) {
      context = context || {};
      
      // Add completed clip's anchor to accumulated anchors
      const newAnchor = completedClipResult.continuityManifest || {
        clipIndex: completedClipIndex,
        lastFrameUrl: completedClipResult.lastFrameUrl,
        motionVectors: completedClipResult.motionVectors,
        timestamp: Date.now(),
      };
      
      context.accumulatedAnchors = context.accumulatedAnchors || [];
      
      // Avoid duplicate anchors
      const hasAnchor = context.accumulatedAnchors.some(
        (a: any) => a.clipIndex === completedClipIndex
      );
      if (!hasAnchor) {
        context.accumulatedAnchors = [...context.accumulatedAnchors, newAnchor];
      }
      
      // If this was clip 1 (index 0), set the reference image AND extract style anchor
      if (completedClipIndex === 0 && completedClipResult.lastFrameUrl) {
        context.referenceImageUrl = context.referenceImageUrl || completedClipResult.lastFrameUrl;
        context.goldenFrameData = context.goldenFrameData || {
          goldenFrameUrl: completedClipResult.lastFrameUrl,
          extractedAt: Date.now(),
          clipIndex: 0,
        };
        
        // CRITICAL: Extract style anchor from clip 1's last frame for scene DNA
        if (!context.masterSceneAnchor) {
          console.log(`[ContinueProduction] Extracting style anchor from clip 1's last frame...`);
          try {
            const styleResponse = await fetch(`${supabaseUrl}/functions/v1/extract-style-anchor`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                frameUrl: completedClipResult.lastFrameUrl,
                projectId,
              }),
            });
            
            if (styleResponse.ok) {
              const styleResult = await styleResponse.json();
              if (styleResult.success && styleResult.styleAnchor) {
                context.masterSceneAnchor = {
                  masterConsistencyPrompt: styleResult.styleAnchor.consistencyPrompt,
                  colorPalette: styleResult.styleAnchor.colorPalette,
                  lighting: styleResult.styleAnchor.lighting,
                  visualStyle: styleResult.styleAnchor.visualStyle,
                };
                console.log(`[ContinueProduction] ✓ Style anchor extracted: ${styleResult.styleAnchor.consistencyPrompt?.substring(0, 60)}...`);
                
                // Persist to pro_features_data for future resumes
                // First fetch current data, then merge
                const { data: currentProject } = await supabase
                  .from('movie_projects')
                  .select('pro_features_data')
                  .eq('id', projectId)
                  .maybeSingle();
                
                const updatedProFeatures = {
                  ...(currentProject?.pro_features_data || {}),
                  styleAnchor: styleResult.styleAnchor,
                  masterSceneAnchor: context.masterSceneAnchor,
                };
                
                await supabase
                  .from('movie_projects')
                  .update({
                    pro_features_data: updatedProFeatures,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', projectId);
                  
                console.log(`[ContinueProduction] ✓ Style anchor persisted to pro_features_data`);
              }
            }
          } catch (styleErr) {
            console.warn(`[ContinueProduction] Style anchor extraction failed:`, styleErr);
          }
        }
      }
      
      console.log(`[ContinueProduction] Merged clip ${completedClipIndex + 1} result: ${context.accumulatedAnchors.length} anchors, ref: ${context.referenceImageUrl ? 'YES' : 'NO'}, masterAnchor: ${context.masterSceneAnchor ? 'YES' : 'NO'}`);
    }
    
    // If still no context, load from DB as fallback
    if (!context || !context.referenceImageUrl || !context.identityBible) {
      console.log(`[ContinueProduction] Loading pipeline context from DB...`);
      const { data: projectData } = await supabase
        .from('movie_projects')
        .select('pro_features_data, generated_script, scene_images, pending_video_tasks')
        .eq('id', projectId)
        .single();

      if (projectData) {
        context = context || {};
        
        // CRITICAL FIX: Load ALL identity-related data from pro_features_data
        const proFeatures = projectData.pro_features_data || {};
        
        // BUG FIX: Load clipDuration from pending_video_tasks
        const pendingTasks = projectData.pending_video_tasks || {};
        if (!context.clipDuration && pendingTasks.clipDuration) {
          context.clipDuration = pendingTasks.clipDuration;
          console.log(`[ContinueProduction] ✓ Loaded clipDuration from pending_video_tasks: ${context.clipDuration}s`);
        }
        
        // Load identity bible with all its fields
        context.identityBible = context.identityBible || proFeatures.identityBible;
        
        // CRITICAL: Log what we loaded for debugging
        if (context.identityBible) {
          console.log(`[ContinueProduction] ✓ Loaded identityBible from DB:`);
          console.log(`  - characterDescription: ${context.identityBible.characterDescription?.substring(0, 50) || 'NONE'}...`);
          console.log(`  - consistencyPrompt: ${context.identityBible.consistencyPrompt?.substring(0, 50) || 'NONE'}...`);
          console.log(`  - consistencyAnchors: ${context.identityBible.consistencyAnchors?.length || 0}`);
          console.log(`  - nonFacialAnchors: ${context.identityBible.nonFacialAnchors ? 'YES' : 'NO'}`);
          console.log(`  - originalReferenceUrl: ${context.identityBible.originalReferenceUrl ? 'YES' : 'NO'}`);
        } else {
          console.warn(`[ContinueProduction] ⚠️ No identityBible found in pro_features_data!`);
        }
        
        // Load extracted characters for prompt enhancement
        const extractedChars = proFeatures.extractedCharacters || [];
        context.extractedCharacters = extractedChars;
        if (extractedChars.length > 0) {
          console.log(`[ContinueProduction] ✓ Loaded ${extractedChars.length} extractedCharacters from DB`);
        }
        
        context.masterSceneAnchor = context.masterSceneAnchor || proFeatures.masterSceneAnchor;
        context.goldenFrameData = context.goldenFrameData || proFeatures.goldenFrameData;
        context.accumulatedAnchors = (context.accumulatedAnchors && context.accumulatedAnchors.length > 0)
          ? context.accumulatedAnchors 
          : (proFeatures.accumulatedAnchors || []);
        context.referenceImageUrl = context.referenceImageUrl 
          || proFeatures.referenceAnalysis?.imageUrl  // FIRST: Original uploaded image
          || proFeatures.goldenFrameData?.goldenFrameUrl
          || context.identityBible?.originalReferenceUrl;
        context.colorGrading = context.colorGrading || 'cinematic';
        context.qualityTier = context.qualityTier || 'standard';
        context.sceneImageLookup = context.sceneImageLookup || {};
        context.tierLimits = context.tierLimits || { maxRetries: 1 };

        // Build scene image lookup
        if (projectData.scene_images && Array.isArray(projectData.scene_images)) {
          for (const img of projectData.scene_images) {
            if (img.imageUrl && img.sceneNumber) {
              context.sceneImageLookup![img.sceneNumber - 1] = img.imageUrl;
            }
          }
        }

        console.log(`[ContinueProduction] Context loaded from DB: identityBible: ${context.identityBible ? 'YES' : 'NO'}, ${context.accumulatedAnchors?.length || 0} anchors, ${Object.keys(context.sceneImageLookup || {}).length} scene images, ref: ${context.referenceImageUrl ? 'YES' : 'NO'}, clipDuration: ${context.clipDuration || 'default'}s`);
      }
    }
    
    // CRITICAL VALIDATION: Ensure we have required data for clip 2+
    if (nextClipIndex > 0 && (!context?.referenceImageUrl || !context?.accumulatedAnchors?.length)) {
      console.error(`[ContinueProduction] ⚠️ Missing required continuity data for clip ${nextClipIndex + 1}`);
      console.error(`  referenceImageUrl: ${context?.referenceImageUrl ? 'YES' : 'MISSING'}`);
      console.error(`  accumulatedAnchors: ${context?.accumulatedAnchors?.length || 0}`);
      
      // Try to get from completed clip 1
      const { data: clip1 } = await supabase
        .from('video_clips')
        .select('last_frame_url, motion_vectors')
        .eq('project_id', projectId)
        .eq('shot_index', 0)
        .eq('status', 'completed')
        .single();
      
      if (clip1?.last_frame_url) {
        console.log(`[ContinueProduction] ✓ Recovered referenceImageUrl from clip 1 in DB`);
        context = context || {};
        context.referenceImageUrl = clip1.last_frame_url;
        context.goldenFrameData = { goldenFrameUrl: clip1.last_frame_url, clipIndex: 0 };
        context.accumulatedAnchors = context.accumulatedAnchors || [];
        if (context.accumulatedAnchors.length === 0) {
          context.accumulatedAnchors.push({
            clipIndex: 0,
            lastFrameUrl: clip1.last_frame_url,
            motionVectors: clip1.motion_vectors,
          });
        }
      }
    }

    // Get the prompt for the next clip
    const { data: scriptData } = await supabase
      .from('movie_projects')
      .select('generated_script, pro_features_data')
      .eq('id', projectId)
      .single();

    let nextClipPrompt = '';
    let shots: any[] = [];
    
    if (scriptData?.generated_script) {
      try {
        const script = typeof scriptData.generated_script === 'string' 
          ? JSON.parse(scriptData.generated_script) 
          : scriptData.generated_script;
        shots = script.shots || [];
        
        if (shots[nextClipIndex]) {
          const shot = shots[nextClipIndex];
          nextClipPrompt = shot.description || shot.title || '';
          
          // CRITICAL FIX: Only inject character data if the prompt is about characters
          // Skip character injection for objects, vehicles, scenes, etc.
          const characters = scriptData.pro_features_data?.extractedCharacters || [];
          const isCharacterPrompt = detectCharacterPrompt(nextClipPrompt);
          
          if (characters.length > 0 && isCharacterPrompt) {
            const characterPrompt = characters
              .map((c: any) => `${c.name}: ${c.appearance}`)
              .join('; ');
            
            nextClipPrompt = `[CHARACTERS: ${characterPrompt}] ${nextClipPrompt}`;
          } else if (characters.length > 0 && !isCharacterPrompt) {
            console.log(`[ContinueProduction] ⚡ Skipping character injection - prompt is about non-character subject`);
          }
        }
      } catch (e) {
        console.warn(`[ContinueProduction] Failed to parse script:`, e);
      }
    }
    
    // CRITICAL VALIDATION: Ensure prompt is valid before proceeding
    // A corrupted prompt will break the entire pipeline
    if (!nextClipPrompt || nextClipPrompt.length < 20) {
      console.warn(`[ContinueProduction] ⚠️ Prompt too short or empty, building from context...`);
      
      // Try to build from extracted characters
      const chars = scriptData?.pro_features_data?.extractedCharacters || context?.extractedCharacters || [];
      if (chars.length > 0) {
        const charDesc = chars.map((c: any) => `${c.name}: ${c.appearance}`).join('; ');
        nextClipPrompt = `[CHARACTERS: ${charDesc}] Scene ${nextClipIndex + 1} - Continue the narrative with consistent character appearance`;
      } else if (context?.identityBible?.characterDescription) {
        nextClipPrompt = `[CHARACTER: ${context.identityBible.characterDescription}] Scene ${nextClipIndex + 1} - Continue with consistent appearance`;
      } else {
        nextClipPrompt = `Scene ${nextClipIndex + 1} - Continue the narrative from the previous scene`;
      }
      console.log(`[ContinueProduction] ✓ Built fallback prompt: ${nextClipPrompt.substring(0, 60)}...`);
    }

    // Build visual continuity from previous clip
    const previousLastFrameUrl = completedClipResult?.lastFrameUrl;
    const previousMotionVectors = completedClipResult?.motionVectors;
    const previousContinuityManifest = completedClipResult?.continuityManifest;

    // CRITICAL FIX: Only inject identity bible for character-focused prompts
    // Skip for object/scene/vehicle prompts to prevent "man in warehouse" issue
    const isCharacterFocused = detectCharacterPrompt(nextClipPrompt);
    
    if ((context?.identityBible?.characterDescription || context?.identityBible?.consistencyPrompt) && isCharacterFocused) {
      const charDesc = context.identityBible.characterDescription || context.identityBible.consistencyPrompt;
      nextClipPrompt = `[CHARACTER IDENTITY - MANDATORY: ${charDesc}]\n${nextClipPrompt}`;
      console.log(`[ContinueProduction] Injected character identity into prompt`);
    } else if (context?.identityBible && !isCharacterFocused) {
      console.log(`[ContinueProduction] ⚡ Skipping identity bible injection - non-character prompt detected`);
    }

    // Add visual continuity to prompt
    if (previousMotionVectors?.continuityPrompt) {
      nextClipPrompt = `[MANDATORY CONTINUATION: ${previousMotionVectors.continuityPrompt}]\n${nextClipPrompt}`;
    }
    if (context?.masterSceneAnchor?.masterConsistencyPrompt) {
      nextClipPrompt = `[SCENE DNA: ${context.masterSceneAnchor.masterConsistencyPrompt}]\n${nextClipPrompt}`;
    }

    // =========================================================================
    // BULLETPROOF FRAME RESOLUTION - NEVER THROW STRICT_CONTINUITY_FAILURE
    // Uses exhaustive 7-tier fallback chain to guarantee a start image
    // =========================================================================
    
    let startImageUrl = previousLastFrameUrl;
    let frameSource = 'callback_result';
    
    // TIER 1: Use frame from callback result (highest priority)
    if (startImageUrl) {
      console.log(`[ContinueProduction] ✓ TIER 1: Using last frame from callback`);
    }
    
    // TIER 2: Query database for previous clip's last_frame_url
    if (!startImageUrl) {
      console.log(`[ContinueProduction] TIER 2: Querying DB for clip ${completedClipIndex} last_frame_url...`);
      const { data: prevClip } = await supabase
        .from('video_clips')
        .select('last_frame_url, video_url')
        .eq('project_id', projectId)
        .eq('shot_index', completedClipIndex)
        .eq('status', 'completed')
        .maybeSingle();
      
      if (prevClip?.last_frame_url) {
        startImageUrl = prevClip.last_frame_url;
        frameSource = 'db_last_frame';
        console.log(`[ContinueProduction] ✓ TIER 2: Found last_frame_url in DB`);
      } else if (prevClip?.video_url && !prevClip?.last_frame_url) {
        // TIER 2B: Trigger emergency frame extraction
        console.log(`[ContinueProduction] TIER 2B: Clip has video but no frame - triggering extraction...`);
        try {
          const extractResult = await callEdgeFunction('extract-last-frame', {
            projectId,
            clipIndex: completedClipIndex,
            videoUrl: prevClip.video_url,
          });
          if (extractResult?.success && extractResult?.lastFrameUrl) {
            startImageUrl = extractResult.lastFrameUrl;
            frameSource = 'emergency_extraction';
            console.log(`[ContinueProduction] ✓ TIER 2B: Emergency frame extraction succeeded`);
          }
        } catch (extractErr) {
          console.warn(`[ContinueProduction] TIER 2B extraction failed:`, extractErr);
        }
      }
    }
    
    // TIER 3: Query database for ANY completed clip's last_frame_url (scan backwards)
    if (!startImageUrl) {
      console.log(`[ContinueProduction] TIER 3: Scanning ALL completed clips for any last_frame_url...`);
      const { data: allClips } = await supabase
        .from('video_clips')
        .select('shot_index, last_frame_url')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .not('last_frame_url', 'is', null)
        .order('shot_index', { ascending: false })
        .limit(1);
      
      if (allClips?.[0]?.last_frame_url) {
        startImageUrl = allClips[0].last_frame_url;
        frameSource = `clip_${allClips[0].shot_index}_fallback`;
        console.log(`[ContinueProduction] ✓ TIER 3: Using frame from clip ${allClips[0].shot_index}`);
      }
    }
    
    // TIER 4: Use golden frame from context
    if (!startImageUrl && context?.goldenFrameData?.goldenFrameUrl) {
      startImageUrl = context.goldenFrameData.goldenFrameUrl;
      frameSource = 'golden_frame';
      console.log(`[ContinueProduction] ✓ TIER 4: Using goldenFrameData`);
    }
    
    // TIER 5: Use scene image for this or previous clip
    if (!startImageUrl) {
      const sceneImage = context?.sceneImageLookup?.[nextClipIndex] 
        || context?.sceneImageLookup?.[completedClipIndex]
        || context?.sceneImageLookup?.[0];
      if (sceneImage) {
        startImageUrl = sceneImage;
        frameSource = 'scene_image';
        console.log(`[ContinueProduction] ✓ TIER 5: Using scene image fallback`);
      }
    }
    
    // TIER 6: Use original reference image from context
    if (!startImageUrl && context?.referenceImageUrl) {
      startImageUrl = context.referenceImageUrl;
      frameSource = 'reference_image';
      console.log(`[ContinueProduction] ✓ TIER 6: Using original reference image`);
    }
    
    // TIER 7: Query pro_features_data for any stored image URL
    if (!startImageUrl) {
      console.log(`[ContinueProduction] TIER 7: Last resort - querying pro_features_data...`);
      const { data: proData } = await supabase
        .from('movie_projects')
        .select('pro_features_data, source_image_url')
        .eq('id', projectId)
        .maybeSingle();
      
      const pfd = proData?.pro_features_data || {};
      const emergencyImage = proData?.source_image_url
        || pfd.referenceAnalysis?.imageUrl
        || pfd.identityBible?.originalReferenceUrl
        || pfd.goldenFrameData?.goldenFrameUrl;
      
      if (emergencyImage) {
        startImageUrl = emergencyImage;
        frameSource = 'emergency_pro_features';
        console.log(`[ContinueProduction] ✓ TIER 7: Emergency recovery from pro_features_data`);
      }
    }
    
    // FINAL CHECK: Log comprehensive status
    if (startImageUrl) {
      console.log(`[ContinueProduction] ════════════════════════════════════════════`);
      console.log(`[ContinueProduction] ✓ FRAME RESOLVED: ${frameSource}`);
      console.log(`[ContinueProduction]   URL: ${startImageUrl.substring(0, 80)}...`);
      console.log(`[ContinueProduction] ════════════════════════════════════════════`);
    } else {
      // This should NEVER happen with 7 fallback tiers, but log extensively if it does
      console.error(`[ContinueProduction] ════════════════════════════════════════════`);
      console.error(`[ContinueProduction] ❌ CRITICAL: All 7 fallback tiers exhausted!`);
      console.error(`[ContinueProduction]   previousLastFrameUrl: ${previousLastFrameUrl ? 'YES' : 'NO'}`);
      console.error(`[ContinueProduction]   context.goldenFrameData: ${context?.goldenFrameData ? 'YES' : 'NO'}`);
      console.error(`[ContinueProduction]   context.referenceImageUrl: ${context?.referenceImageUrl ? 'YES' : 'NO'}`);
      console.error(`[ContinueProduction]   context.sceneImageLookup keys: ${Object.keys(context?.sceneImageLookup || {}).join(',')}`);
      console.error(`[ContinueProduction] ════════════════════════════════════════════`);
      
      // GRACEFUL DEGRADATION: Continue without start image (model will generate from scratch)
      // This is better than failing the entire pipeline
      console.warn(`[ContinueProduction] ⚠️ Proceeding WITHOUT start image (degraded continuity mode)`);
      frameSource = 'none_degraded';
    }

    // Update progress - use 'clips_generating' which is a valid pipeline_stage value
    await supabase
      .from('movie_projects')
      .update({
        pipeline_stage: 'clips_generating',
        status: 'generating',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(`[ContinueProduction] Calling generate-single-clip for clip ${nextClipIndex + 1}...`);
    console.log(`[ContinueProduction] ═══════════════════════════════════════════════════`);
    console.log(`[ContinueProduction] DATA HANDOFF TO CLIP ${nextClipIndex + 1}:`);
    console.log(`[ContinueProduction]   - startImageUrl: ${startImageUrl ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - clipDuration: ${context?.clipDuration || 5}s`);
    console.log(`[ContinueProduction]   - identityBible: ${context?.identityBible ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - identityBible.characterDescription: ${context?.identityBible?.characterDescription ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - identityBible.nonFacialAnchors: ${context?.identityBible?.nonFacialAnchors ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - identityBible.antiMorphingPrompts: ${context?.identityBible?.antiMorphingPrompts?.length || 0}`);
    console.log(`[ContinueProduction]   - identityBible.occlusionNegatives: ${context?.identityBible?.occlusionNegatives?.length || 0}`);
    console.log(`[ContinueProduction]   - masterSceneAnchor: ${context?.masterSceneAnchor ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - previousMotionVectors: ${previousMotionVectors ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - previousContinuityManifest: ${previousContinuityManifest ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - extractedCharacters: ${context?.extractedCharacters?.length || 0}`);
    console.log(`[ContinueProduction]   - accumulatedAnchors: ${context?.accumulatedAnchors?.length || 0}`);
    console.log(`[ContinueProduction] ═══════════════════════════════════════════════════`);

    // Call generate-single-clip with COMPLETE data handoff
    // CRITICAL: Pass ALL continuity and identity data
    // BUG FIX: Ensure durationSeconds is passed through callback chain!
    const clipDuration = context?.clipDuration || 5;
    const videoEngine = context?.videoEngine || 'veo'; // DEFAULT: Runway (veo=Runway Gen-4 Turbo/Gen-4.5)
    console.log(`[ContinueProduction] Clip ${nextClipIndex + 1} will use duration: ${clipDuration}s`);
    
    const clipResult = await callEdgeFunction('generate-single-clip', {
      userId,
      projectId,
      videoEngine, // Route to Veo 3 or Kling — persisted from original request
      clipIndex: nextClipIndex,
      prompt: nextClipPrompt,
      totalClips,
      startImageUrl,
      // BUG FIX: Pass durationSeconds - this was missing and defaulting to 5!
      durationSeconds: clipDuration,
      // CONTINUITY DATA FROM PREVIOUS CLIP
      previousMotionVectors,
      previousContinuityManifest,
      // MASTER ANCHORS
      masterSceneAnchor: context?.masterSceneAnchor,
      goldenFrameData: context?.goldenFrameData,
      // IDENTITY DATA (CRITICAL FOR CHARACTER CONSISTENCY)
      identityBible: context?.identityBible,
      extractedCharacters: context?.extractedCharacters,
      // SCENE REFERENCES
      referenceImageUrl: context?.referenceImageUrl,
      sceneImageUrl: context?.sceneImageLookup?.[nextClipIndex] || context?.sceneImageLookup?.[0],
      accumulatedAnchors: context?.accumulatedAnchors || [],
      // QUALITY SETTINGS
      colorGrading: context?.colorGrading || 'cinematic',
      qualityTier: context?.qualityTier || 'standard',
      aspectRatio: context?.aspectRatio || '16:9',
      // CALLBACK CONTINUATION
      triggerNextClip: true,
      // FULL CONTEXT FOR PERSISTENCE
      pipelineContext: context,
    });

    console.log(`[ContinueProduction] Clip ${nextClipIndex + 1} generation initiated`);

    return new Response(
      JSON.stringify({
        success: true,
        action: 'next_clip_triggered',
        nextClipIndex,
        totalClips,
        clipResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ContinueProduction] Error:", error);
    
    // Use the already-parsed request (body was consumed once before try block)
    try {
      if (request?.projectId) {
        await supabase
          .from('movie_projects')
          .update({
            status: 'failed',
            last_error: error instanceof Error ? error.message : 'Unknown error in continue-production',
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.projectId);
      }
    } catch (e) {
      console.error('[ContinueProduction] Failed to update project status:', e);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper to call edge functions with ENHANCED rate limit handling
async function callEdgeFunction(name: string, body: any, retries = 3): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  let lastError: Error | null = null;
  
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) {
        // CRITICAL FIX: Use much longer backoff for rate limit errors
        // Kling API needs 15-30+ seconds to clear parallel task queue
        const isRateLimitError = lastError?.message?.includes('429') || 
                                  lastError?.message?.includes('rate') ||
                                  lastError?.message?.includes('parallel task');
        
        // Rate limit: 15s base, exponential. Other errors: 2s base, exponential
        const baseWaitMs = isRateLimitError ? 15000 : 2000;
        const waitMs = baseWaitMs * Math.pow(1.5, i - 1) + (Math.random() * 2000); // Add jitter
        
        console.log(`[ContinueProduction] Retry ${i}/${retries} for ${name}, waiting ${Math.round(waitMs)}ms (${isRateLimitError ? 'RATE_LIMIT' : 'error'})...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // CRITICAL: Parse rate limit errors specially
        if (response.status === 429 || errorText.includes('1303') || errorText.includes('parallel task')) {
          throw new Error(`RATE_LIMITED: ${name} - ${errorText}`);
        }
        
        throw new Error(`${name} failed: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
      console.warn(`[ContinueProduction] ${name} error (attempt ${i + 1}):`, lastError.message);
      
      // If it's a rate limit error and we have retries left, continue
      const isRateLimitError = lastError.message.includes('429') || 
                                lastError.message.includes('RATE_LIMITED') ||
                                lastError.message.includes('parallel task');
      if (isRateLimitError && i < retries) {
        console.log(`[ContinueProduction] Rate limit detected - will retry with longer backoff`);
        continue;
      }
    }
  }
  
  throw lastError || new Error(`${name} failed after ${retries} retries`);
}
