import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
 */

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
    identityBible?: any;
    masterSceneAnchor?: any;
    goldenFrameData?: any;
    accumulatedAnchors?: any[];
    referenceImageUrl?: string;
    colorGrading?: string;
    qualityTier?: string;
    sceneImageLookup?: Record<number, string>;
    tierLimits?: any;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const request: ContinueProductionRequest = await req.json();
    const { projectId, userId, completedClipIndex, completedClipResult, totalClips, pipelineContext } = request;

    console.log(`[ContinueProduction] Clip ${completedClipIndex + 1}/${totalClips} completed for project ${projectId}`);

    // Check if all clips are done
    if (completedClipIndex + 1 >= totalClips) {
      console.log(`[ContinueProduction] All ${totalClips} clips completed! Triggering post-production...`);
      
      // Update project status
      await supabase
        .from('movie_projects')
        .update({
          pipeline_stage: 'postproduction',
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

    // Load project data for context if not provided
    let context = pipelineContext;
    if (!context) {
      console.log(`[ContinueProduction] Loading pipeline context from DB...`);
      const { data: projectData } = await supabase
        .from('movie_projects')
        .select('pro_features_data, generated_script, scene_images')
        .eq('id', projectId)
        .single();

      if (projectData) {
        context = {
          identityBible: projectData.pro_features_data?.identityBible,
          masterSceneAnchor: projectData.pro_features_data?.masterSceneAnchor,
          goldenFrameData: projectData.pro_features_data?.goldenFrameData,
          accumulatedAnchors: projectData.pro_features_data?.accumulatedAnchors || [],
          referenceImageUrl: projectData.pro_features_data?.goldenFrameData?.goldenFrameUrl,
          colorGrading: 'cinematic',
          qualityTier: 'standard',
          sceneImageLookup: {},
          tierLimits: { maxRetries: 1 },
        };

        // Build scene image lookup
        if (projectData.scene_images && Array.isArray(projectData.scene_images)) {
          for (const img of projectData.scene_images) {
            if (img.imageUrl && img.sceneNumber) {
              context.sceneImageLookup![img.sceneNumber - 1] = img.imageUrl;
            }
          }
        }

        console.log(`[ContinueProduction] Context loaded: ${context.accumulatedAnchors?.length || 0} anchors, ${Object.keys(context.sceneImageLookup || {}).length} scene images`);
      }
    }

    // Get the prompt for the next clip
    const { data: scriptData } = await supabase
      .from('movie_projects')
      .select('generated_script, pro_features_data')
      .eq('id', projectId)
      .single();

    let nextClipPrompt = 'Continue the scene';
    let shots: any[] = [];
    
    if (scriptData?.generated_script) {
      try {
        const script = typeof scriptData.generated_script === 'string' 
          ? JSON.parse(scriptData.generated_script) 
          : scriptData.generated_script;
        shots = script.shots || [];
        
        if (shots[nextClipIndex]) {
          const shot = shots[nextClipIndex];
          nextClipPrompt = shot.description || shot.title || 'Continue the scene';
          
          // Add character identity if available
          const characters = scriptData.pro_features_data?.extractedCharacters || [];
          const characterPrompt = characters
            .map((c: any) => `${c.name}: ${c.appearance}`)
            .join('; ');
          
          if (characterPrompt) {
            nextClipPrompt = `[CHARACTERS: ${characterPrompt}] ${nextClipPrompt}`;
          }
        }
      } catch (e) {
        console.warn(`[ContinueProduction] Failed to parse script:`, e);
      }
    }

    // Build visual continuity from previous clip
    const previousLastFrameUrl = completedClipResult?.lastFrameUrl;
    const previousMotionVectors = completedClipResult?.motionVectors;
    const previousContinuityManifest = completedClipResult?.continuityManifest;

    // Add visual continuity to prompt
    if (previousMotionVectors?.continuityPrompt) {
      nextClipPrompt = `[MANDATORY CONTINUATION: ${previousMotionVectors.continuityPrompt}]\n${nextClipPrompt}`;
    }
    if (context?.masterSceneAnchor?.masterConsistencyPrompt) {
      nextClipPrompt = `[SCENE DNA: ${context.masterSceneAnchor.masterConsistencyPrompt}]\n${nextClipPrompt}`;
    }

    // Validate we have a valid start image
    if (!previousLastFrameUrl) {
      console.error(`[ContinueProduction] ⚠️ No last frame from clip ${completedClipIndex + 1}!`);
      
      // Try to get from DB
      const { data: prevClip } = await supabase
        .from('video_clips')
        .select('last_frame_url')
        .eq('project_id', projectId)
        .eq('shot_index', completedClipIndex)
        .single();

      if (!prevClip?.last_frame_url) {
        // Use scene image as fallback
        const fallbackImage = context?.sceneImageLookup?.[nextClipIndex] || context?.sceneImageLookup?.[0];
        if (!fallbackImage) {
          throw new Error(`STRICT_CONTINUITY_FAILURE: No frame available for clip ${nextClipIndex + 1}`);
        }
        console.log(`[ContinueProduction] Using scene image fallback: ${fallbackImage.substring(0, 60)}...`);
      }
    }

    // Update progress
    const progressPercent = 75 + Math.floor((nextClipIndex / totalClips) * 15);
    await supabase
      .from('movie_projects')
      .update({
        pipeline_stage: 'production',
        status: 'generating',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    // Get start image for next clip
    let startImageUrl = previousLastFrameUrl;
    if (!startImageUrl) {
      const { data: prevClip } = await supabase
        .from('video_clips')
        .select('last_frame_url')
        .eq('project_id', projectId)
        .eq('shot_index', completedClipIndex)
        .single();
      
      startImageUrl = prevClip?.last_frame_url || context?.sceneImageLookup?.[nextClipIndex];
    }

    console.log(`[ContinueProduction] Calling generate-single-clip for clip ${nextClipIndex + 1}...`);
    console.log(`[ContinueProduction] Start image: ${startImageUrl?.substring(0, 60) || 'none'}...`);

    // Call generate-single-clip with callback enabled
    const clipResult = await callEdgeFunction('generate-single-clip', {
      userId,
      projectId,
      clipIndex: nextClipIndex,
      prompt: nextClipPrompt,
      totalClips,
      startImageUrl,
      previousMotionVectors,
      previousContinuityManifest,
      goldenFrameData: context?.goldenFrameData,
      identityBible: context?.identityBible,
      colorGrading: context?.colorGrading || 'cinematic',
      qualityTier: context?.qualityTier || 'standard',
      referenceImageUrl: context?.referenceImageUrl,
      sceneImageUrl: context?.sceneImageLookup?.[nextClipIndex] || context?.sceneImageLookup?.[0],
      accumulatedAnchors: context?.accumulatedAnchors || [],
      // CRITICAL: Enable callback continuation
      triggerNextClip: true,
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
    
    // Try to update project with error
    try {
      const request = await req.clone().json();
      await supabase
        .from('movie_projects')
        .update({
          status: 'failed',
          last_error: error instanceof Error ? error.message : 'Unknown error in continue-production',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.projectId);
    } catch (e) {
      console.error('[ContinueProduction] Failed to update project status:', e);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper to call edge functions
async function callEdgeFunction(name: string, body: any, retries = 2): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  let lastError: Error | null = null;
  
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) {
        console.log(`[ContinueProduction] Retry ${i}/${retries} for ${name}, waiting ${1000 * i}ms...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * i));
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
        throw new Error(`${name} failed: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
      console.warn(`[ContinueProduction] ${name} error (attempt ${i + 1}):`, lastError.message);
    }
  }
  
  throw lastError || new Error(`${name} failed after ${retries} retries`);
}
