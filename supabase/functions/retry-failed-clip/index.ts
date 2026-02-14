import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  acquireGenerationLock,
  releaseGenerationLock,
  checkContinuityReady,
  loadPipelineContext,
} from "../_shared/generation-mutex.ts";
// Note: Prompt building now happens in generate-single-clip via prompt-builder.ts

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * RETRY FAILED CLIP
 * 
 * Allows manual retry of a failed clip from the Production page.
 * Uses the existing generate-single-clip function with the same parameters.
 * 
 * FAILSAFE: Acquires generation lock and validates continuity before retrying
 */

interface RetryRequest {
  userId: string;
  projectId: string;
  clipIndex: number;
}

async function callEdgeFunction(functionName: string, body: any): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${functionName} failed: ${error}`);
  }
  
  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const request: RetryRequest = await req.json();

    // SECURITY: Extract userId from JWT instead of trusting client payload
    const authHeader = req.headers.get("Authorization");
    let authenticatedUserId: string | null = null;
    if (authHeader?.startsWith("Bearer ") && !authHeader.includes(supabaseKey)) {
      try {
        const authClient = createClient(supabaseUrl, anonKey);
        const token = authHeader.replace("Bearer ", "");
        const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
        if (!claimsError && claimsData?.claims?.sub) {
          authenticatedUserId = claimsData.claims.sub as string;
        }
      } catch (authErr) {
        console.warn("[RetryClip] JWT validation failed:", authErr);
      }
    }
    if (authenticatedUserId) {
      request.userId = authenticatedUserId;
    }
    
    if (!request.userId || !request.projectId || request.clipIndex === undefined) {
      throw new Error("userId, projectId, and clipIndex are required");
    }
    
    console.log(`[RetryClip] Retrying clip ${request.clipIndex} for project ${request.projectId}`);
    
    // =========================================================
    // FAILSAFE: Acquire generation lock before retrying
    // =========================================================
    const lockId = crypto.randomUUID();
    const lockResult = await acquireGenerationLock(supabase, request.projectId, request.clipIndex, lockId);
    
    if (!lockResult.acquired) {
      console.warn(`[RetryClip] ⚠️ Cannot retry - clip ${lockResult.blockedByClip} is currently generating`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GENERATION_LOCKED',
          message: `Another clip (${lockResult.blockedByClip}) is currently generating. Please wait.`,
          lockAgeSeconds: lockResult.lockAgeSeconds,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[RetryClip] ✓ Generation lock acquired: ${lockId}`);
    
    // =========================================================
    // FAILSAFE: Check continuity before retrying (for clip 2+)
    // =========================================================
    if (request.clipIndex > 0) {
      const continuityCheck = await checkContinuityReady(supabase, request.projectId, request.clipIndex);
      
      if (!continuityCheck.ready) {
        // Release lock since we can't proceed
        await releaseGenerationLock(supabase, request.projectId, lockId);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'CONTINUITY_NOT_READY',
            message: `Cannot retry clip ${request.clipIndex + 1}: ${continuityCheck.reason}`,
            details: continuityCheck,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // 1. Get the failed clip details
    const { data: failedClip, error: clipError } = await supabase
      .from('video_clips')
      .select('*')
      .eq('project_id', request.projectId)
      .eq('shot_index', request.clipIndex)
      .single();
    
    if (clipError || !failedClip) {
      await releaseGenerationLock(supabase, request.projectId, lockId);
      throw new Error(`Clip not found: ${clipError?.message}`);
    }
    
    if (failedClip.status !== 'failed') {
      await releaseGenerationLock(supabase, request.projectId, lockId);
      throw new Error(`Clip is not in failed state: ${failedClip.status}`);
    }
    
    // 2. Get project details for context
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('*')
      .eq('id', request.projectId)
      .single();
    
    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }
    
    // 3. Get previous clip's last frame for continuity
    let startImageUrl: string | undefined;
    let previousMotionVectors: any;
    
    if (request.clipIndex > 0) {
      const { data: prevClip } = await supabase
        .from('video_clips')
        .select('last_frame_url, motion_vectors')
        .eq('project_id', request.projectId)
        .eq('shot_index', request.clipIndex - 1)
        .eq('status', 'completed')
        .single();
      
      if (prevClip) {
        startImageUrl = prevClip.last_frame_url || undefined;
        previousMotionVectors = prevClip.motion_vectors;
      }
    }
    
    // 4. Get total clip count
    const { count: totalClips } = await supabase
      .from('video_clips')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', request.projectId);
    
    // 5. Load pipeline context from DB (FAILSAFE: reliable context loading)
    const savedContext = await loadPipelineContext(supabase, request.projectId);
    
    let identityBible: any;
    let goldenFrameData: any;
    let accumulatedAnchors: any[] = [];
    let referenceImageUrl: string | undefined;
    
    // Use saved context if available, otherwise fall back to pro_features_data
    const pendingTasks = project.pending_video_tasks as any;
    const proFeatures = project.pro_features_data as any;
    
    // Priority: savedContext > proFeatures > pendingTasks
    identityBible = savedContext?.identityBible || proFeatures?.identityBible || pendingTasks?.identityBible;
    goldenFrameData = savedContext?.goldenFrameData || proFeatures?.goldenFrameData;
    accumulatedAnchors = savedContext?.accumulatedAnchors || proFeatures?.accumulatedAnchors || [];
    referenceImageUrl = savedContext?.referenceImageUrl || goldenFrameData?.goldenFrameUrl;
    
    console.log(`[RetryClip] Loaded context: identityBible=${identityBible ? 'YES' : 'NO'}, anchors=${accumulatedAnchors.length}, ref=${referenceImageUrl ? 'YES' : 'NO'}`);
    
    // 5b. CRITICAL FIX: Detect and recover corrupted prompts
    // If prompt contains "Generation failed" or is very short, rebuild from script
    let enhancedPrompt = failedClip.prompt;
    const isCorruptedPrompt = 
      !enhancedPrompt || 
      enhancedPrompt.toLowerCase().includes('generation failed') ||
      enhancedPrompt.length < 50;
    
    if (isCorruptedPrompt) {
      console.warn(`[RetryClip] ⚠️ Corrupted prompt detected: "${enhancedPrompt?.substring(0, 50)}..."`);
      
      // Try to recover from generated_script
      try {
        const script = typeof project.generated_script === 'string' 
          ? JSON.parse(project.generated_script) 
          : project.generated_script;
        
        const shots = script?.shots || [];
        const shot = shots[request.clipIndex];
        
        if (shot?.description || shot?.title) {
          enhancedPrompt = shot.description || shot.title || `Scene ${request.clipIndex + 1}`;
          console.log(`[RetryClip] ✓ Recovered prompt from script: "${enhancedPrompt.substring(0, 60)}..."`);
        } else {
          // Fallback to extracting from characters
          const chars = proFeatures?.extractedCharacters || [];
          const charDesc = chars.map((c: any) => `${c.name}: ${c.appearance}`).join('; ');
          enhancedPrompt = charDesc ? `[CHARACTERS: ${charDesc}] Scene ${request.clipIndex + 1}` : `Scene ${request.clipIndex + 1}`;
          console.log(`[RetryClip] ✓ Built fallback prompt from characters`);
        }
      } catch (scriptErr) {
        console.warn(`[RetryClip] Script parse failed, using fallback prompt`);
        enhancedPrompt = `Scene ${request.clipIndex + 1}`;
      }
    }
    
    // Add corrective prompts if available
    if (failedClip.corrective_prompts && failedClip.corrective_prompts.length > 0) {
      const correctivePrompts = failedClip.corrective_prompts.slice(0, 3);
      enhancedPrompt = `[CORRECTIVE FIXES: ${correctivePrompts.join('. ')}] ${enhancedPrompt}`;
      console.log(`[RetryClip] Using ${correctivePrompts.length} corrective prompts from validation`);
    }
    
    // 6. Mark clip as retrying
    await supabase
      .from('video_clips')
      .update({
        status: 'generating',
        error_message: null,
        retry_count: (failedClip.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', failedClip.id);
    
    // 7. Update project progress to show retry in progress
    const currentTasks = project.pending_video_tasks || {};
    await supabase
      .from('movie_projects')
      .update({
        pending_video_tasks: {
          ...currentTasks,
          retryingClip: request.clipIndex,
          updatedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.projectId);
    
    console.log(`[RetryClip] Calling generate-single-clip for clip ${request.clipIndex}...`);
    
    // 8. Call generate-single-clip with enhanced parameters
    const clipResult = await callEdgeFunction('generate-single-clip', {
      userId: request.userId,
      projectId: request.projectId,
      clipIndex: request.clipIndex,
      prompt: enhancedPrompt,
      totalClips: totalClips || 6,
      startImageUrl,
      previousMotionVectors,
      identityBible,
      goldenFrameData,
      accumulatedAnchors,
      referenceImageUrl,
      qualityTier: project.quality_tier || 'standard',
      aspectRatio: project.aspect_ratio || '16:9',
      isRetry: true,
    });
    
    if (!clipResult.success) {
      // Mark as failed again
      await supabase
        .from('video_clips')
        .update({
          status: 'failed',
          error_message: clipResult.error || 'Retry failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', failedClip.id);
      
      throw new Error(clipResult.error || 'Clip generation failed on retry');
    }
    
    console.log(`[RetryClip] Clip ${request.clipIndex} retry succeeded!`);
    
    // 9. Clear retry state and check if ALL clips are now complete
    // CRITICAL: This reconciliation prevents "false failure" states
    const { data: allClips } = await supabase
      .from('video_clips')
      .select('id, shot_index, status')
      .eq('project_id', request.projectId)
      .order('shot_index');
    
    const completedClips = allClips?.filter(c => c.status === 'completed').length || 0;
    const failedClips = allClips?.filter(c => c.status === 'failed').length || 0;
    const totalClipsCount = allClips?.length || 0;
    
    console.log(`[RetryClip] Status reconciliation: ${completedClips}/${totalClipsCount} completed, ${failedClips} failed`);
    
    // If ALL clips are now complete, trigger final assembly to fix any stale 'failed' status
    if (totalClipsCount > 0 && completedClips === totalClipsCount) {
      console.log(`[RetryClip] ✅ All clips complete - triggering final assembly for status reconciliation`);
      
      try {
        await callEdgeFunction('final-assembly', {
          projectId: request.projectId,
          userId: request.userId,
          forceReconcile: true, // Signal that this is a reconciliation call
        });
        console.log(`[RetryClip] ✓ Final assembly triggered successfully`);
      } catch (assemblyErr) {
        console.warn(`[RetryClip] ⚠️ Final assembly call failed, but clip retry succeeded:`, assemblyErr);
        // Don't fail the retry - the clip itself succeeded
      }
    }
    
    // Update project state
    await supabase
      .from('movie_projects')
      .update({
        pending_video_tasks: {
          ...currentTasks,
          retryingClip: null,
          lastReconciliation: new Date().toISOString(),
          clipsCompleted: completedClips,
          clipsFailed: failedClips,
          updatedAt: new Date().toISOString(),
        },
        // CRITICAL: Clear error status if no more failed clips
        ...(failedClips === 0 && project.status === 'failed' ? { status: 'generating' } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.projectId);
    
    // Note: Lock is released by generate-single-clip after completion
    
    return new Response(
      JSON.stringify({
        success: true,
        clipIndex: request.clipIndex,
        videoUrl: clipResult.clipResult?.videoUrl,
        message: `Clip ${request.clipIndex + 1} regenerated successfully`,
        reconciliation: {
          totalClips: totalClipsCount,
          completedClips,
          failedClips,
          allComplete: completedClips === totalClipsCount,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("[RetryClip] Error:", error);
    
    // Release lock on error (if we have the info)
    // Note: The actual lock release might fail if we don't have the lockId,
    // but generate-single-clip will handle releasing its own lock on error
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
