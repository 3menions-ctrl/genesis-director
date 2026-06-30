import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  acquireGenerationLock,
  releaseGenerationLock,
  checkContinuityReady,
  loadPipelineContext,
} from "../_shared/generation-mutex.ts";
import {
  validateAuth,
  unauthorizedResponse,
  resolveEffectiveUserId,
  forbiddenResponse,
} from "../_shared/auth-guard.ts";

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

  // ═══ AUTH GUARD: Use shared auth-guard instead of inline JWT parsing ═══
  const auth = await validateAuth(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Cleanup state, hoisted so catch/finally can always release the lock and
  // revert the clip. Previously the lock was acquired inside the try and the
  // catch could not see it, so a failed retry left the project lock held and the
  // clip stuck in 'generating' forever — permanently un-retryable (P0-2). We own
  // this lock for the WHOLE retry and hand it to generate-single-clip via
  // ownedLockId so it reuses (not re-acquires → 409) the same lock.
  let lockId: string | null = null;
  let lockHeld = false;
  let clipDbId: string | null = null;
  let cleanupProjectId: string | null = null;

  try {
    const request: RetryRequest = await req.json();
    cleanupProjectId = request.projectId ?? null;

    // ADMIN ON-BEHALF: an admin may retry a failed clip for any project from the
    // admin console. The retry then runs as the project OWNER — generation lock,
    // continuity checks, and credit spend in generate-single-clip all bind to the
    // owner, exactly as if they had clicked retry themselves. Without this branch
    // an admin JWT either 403s (USER_ID_MISMATCH) or, worse, charges the admin.
    let resolvedAsAdmin = false;
    if (!auth.isServiceRole && auth.userId) {
      const { data: adminFlag } = await supabase.rpc("is_admin", { _user_id: auth.userId });
      if (adminFlag === true) {
        if (!request.projectId) throw new Error("projectId is required");
        const { data: ownerRow, error: ownerErr } = await supabase
          .from("movie_projects").select("user_id").eq("id", request.projectId).maybeSingle();
        if (ownerErr || !ownerRow?.user_id) {
          return forbiddenResponse(corsHeaders, "Project not found for admin retry");
        }
        request.userId = ownerRow.user_id as string;
        resolvedAsAdmin = true;
        console.log(`[RetryClip] Admin ${auth.userId} retrying on behalf of owner ${request.userId}`);
      }
    }

    // SECURITY: end-user JWT → JWT id wins (mismatch = 403). Service-role → body.userId.
    if (!resolvedAsAdmin) {
      try {
        request.userId = resolveEffectiveUserId(auth, request.userId ?? null);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === 'USER_ID_MISMATCH') return forbiddenResponse(corsHeaders);
        return unauthorizedResponse(corsHeaders, msg);
      }
    }
    
    if (!request.userId || !request.projectId || request.clipIndex === undefined) {
      throw new Error("userId, projectId, and clipIndex are required");
    }

    // IDOR GUARD (audit): a non-admin end-user may only retry clips on a project
    // they own. The admin branch above already resolved + verified ownership and
    // service-role bypasses; this closes the remaining non-admin path, where
    // resolveEffectiveUserId pins userId to the JWT but does not stop passing a
    // victim's projectId.
    if (!auth.isServiceRole && !resolvedAsAdmin) {
      const { data: ownerRow } = await supabase
        .from("movie_projects").select("user_id").eq("id", request.projectId).maybeSingle();
      if (!ownerRow || ownerRow.user_id !== auth.userId) {
        return forbiddenResponse(corsHeaders, "Forbidden: you do not own this project");
      }
    }

    console.log(`[RetryClip] Retrying clip ${request.clipIndex} for project ${request.projectId}`);
    
    // =========================================================
    // FAILSAFE: Acquire generation lock before retrying
    // =========================================================
    lockId = crypto.randomUUID();
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
    
    lockHeld = true;
    console.log(`[RetryClip] ✓ Generation lock acquired: ${lockId}`);
    
    // =========================================================
    // FAILSAFE: Check continuity before retrying (for clip 2+)
    // =========================================================
    if (request.clipIndex > 0) {
      const continuityCheck = await checkContinuityReady(supabase, request.projectId, request.clipIndex);
      
      if (!continuityCheck.ready) {
        // Lock is released by the finally block below.
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
      .maybeSingle();
    
    if (clipError || !failedClip) {
      throw new Error(`Clip not found: ${clipError?.message}`);
    }
    
    if (failedClip.status !== 'failed') {
      throw new Error(`Clip is not in failed state: ${failedClip.status}`);
    }
    // Remember which clip we are about to flip to 'generating' so the catch can
    // revert it to 'failed' if anything downstream throws (keeps it re-retryable).
    clipDbId = failedClip.id;
    
    // 2. Get project details for context
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('*')
      .eq('id', request.projectId)
      .maybeSingle();
    
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
        .maybeSingle();
      
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
    
    // 🎬 ENGINE PRESERVATION: load persisted engine so retries don't downgrade
    // Seedance → Kling. project.video_engine was set by mode-router at creation.
    const persistedEngine = (project as any).video_engine || 'kling';
    const isAvatarMode = project.mode === 'avatar';
    console.log(`[RetryClip] 🎬 Engine for retry: ${persistedEngine} (mode=${project.mode}, avatarMode=${isAvatarMode})`);
    
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
      // Hand our already-held lock to generate-single-clip so it REUSES it
      // instead of re-acquiring (which 409s against this same lock → deadlock).
      ownedLockId: lockId,
      videoEngine: persistedEngine,
      isAvatarMode,
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
    
    // Lock is released by the finally block below (we own it for the whole
    // retry; generate-single-clip reused it via ownedLockId and did NOT release).

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

    // CRITICAL (P0-2): revert the clip we flipped to 'generating' back to
    // 'failed' so it stays re-retryable. Without this the clip is stranded in
    // 'generating' forever and every future retry trips the
    // `status === 'failed'` precondition above.
    if (clipDbId) {
      try {
        await supabase
          .from('video_clips')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Retry failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', clipDbId)
          .eq('status', 'generating');
      } catch (revertErr) {
        console.warn("[RetryClip] Failed to revert clip to 'failed':", revertErr);
      }
    }

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
  } finally {
    // We own the project generation lock for the entire retry (generate-single-clip
    // reused it and did not release). Always release it here — on success, on
    // early 409/continuity returns, and on error — so a failed retry can never
    // leave the project permanently locked (P0-2).
    if (lockHeld && lockId && cleanupProjectId) {
      try {
        await releaseGenerationLock(supabase, cleanupProjectId, lockId);
      } catch (releaseErr) {
        console.warn("[RetryClip] Failed to release generation lock:", releaseErr);
      }
    }
  }
});
