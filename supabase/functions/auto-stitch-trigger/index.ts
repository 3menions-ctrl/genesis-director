import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * AUTO-STITCH TRIGGER v4 - MANIFEST-ONLY
 * 
 * STRATEGY: Always guarantee a working video for users via manifest playback
 * 1. Check if all clips are completed
 * 2. Call simple-stitch to create manifest
 * 3. Users get immediate playback via SmartStitcherPlayer
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutoStitchRequest {
  projectId: string;
  userId?: string;
  forceStitch?: boolean;
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

    const { projectId, userId, forceStitch = false } = await req.json() as AutoStitchRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[AutoStitch] Checking project: ${projectId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get project details
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('id, title, status, pending_video_tasks')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message || 'Unknown'}`);
    }

    // Skip if already completed (unless force)
    if (project.status === 'completed' && !forceStitch) {
      console.log(`[AutoStitch] Project already completed, skipping`);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Project already completed',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get expected clip count
    const tasks = project.pending_video_tasks as Record<string, unknown> | null;
    const expectedClipCount = (tasks?.clipCount as number) || 6;
    
    console.log(`[AutoStitch] Expected clip count: ${expectedClipCount}`);

    // Step 3: Count completed clips
    const { data: clips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, status')
      .eq('project_id', projectId)
      .eq('status', 'completed');

    if (clipsError) {
      throw new Error(`Failed to fetch clips: ${clipsError.message}`);
    }

    const completedCount = clips?.length || 0;
    console.log(`[AutoStitch] Completed clips: ${completedCount}/${expectedClipCount}`);

    // Step 4: Check if all clips are complete
    if (!forceStitch && completedCount < expectedClipCount) {
      console.log(`[AutoStitch] Not all clips complete yet (${completedCount}/${expectedClipCount})`);
      return new Response(
        JSON.stringify({
          success: true,
          readyToStitch: false,
          completedClips: completedCount,
          expectedClips: expectedClipCount,
          remaining: expectedClipCount - completedCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 5: All clips complete! Update status to stitching
    console.log(`[AutoStitch] ✅ All ${completedCount} clips complete - triggering simple-stitch!`);

    await supabase
      .from('movie_projects')
      .update({
        status: 'stitching',
        pending_video_tasks: {
          ...(tasks || {}),
          stage: 'stitching',
          progress: 90,
          stitchingStarted: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    // Step 6: Use simple-stitch for manifest creation
    console.log("[AutoStitch] Calling simple-stitch for manifest creation...");
    
    const { data: stitchResult, error: stitchError } = await supabase.functions.invoke('simple-stitch', {
      body: { projectId, userId },
    });
    
    if (stitchError) {
      console.error(`[AutoStitch] simple-stitch invocation error: ${stitchError.message}`);
      
      // Mark as completed anyway - clips are available individually
      await supabase
        .from('movie_projects')
        .update({
          status: 'completed',
          pending_video_tasks: {
            ...(tasks || {}),
            stage: 'complete',
            progress: 100,
            mode: 'clips_only',
            error: 'Manifest creation failed, clips available individually',
            completedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
      
      return new Response(
        JSON.stringify({
          success: true,
          readyToStitch: true,
          stitchMode: 'clips-only-fallback',
          message: 'Clips available individually - manifest creation failed',
          completedClips: completedCount,
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("[AutoStitch] simple-stitch result:", JSON.stringify(stitchResult));

    return new Response(
      JSON.stringify({
        success: true,
        readyToStitch: true,
        stitchMode: stitchResult?.mode || 'manifest_playback',
        finalVideoUrl: stitchResult?.finalVideoUrl,
        completedClips: completedCount,
        processingTimeMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Auto-stitch failed";
    console.error("[AutoStitch] Error:", errorMsg);
    
    // Recovery: mark as completed if clips exist
    try {
      const body = await req.clone().json() as AutoStitchRequest;
      if (body.projectId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { data: clips } = await supabase
          .from('video_clips')
          .select('id')
          .eq('project_id', body.projectId)
          .eq('status', 'completed');
        
        if (clips && clips.length > 0) {
          console.log(`[AutoStitch] Error recovery: ${clips.length} clips available, marking as completed`);
          await supabase
            .from('movie_projects')
            .update({
              status: 'completed',
              pending_video_tasks: {
                stage: 'complete',
                progress: 100,
                mode: 'error_recovery',
                error: errorMsg,
                clipCount: clips.length,
                completedAt: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', body.projectId);
        }
      }
    } catch (recoveryError) {
      console.error("[AutoStitch] Recovery also failed:", recoveryError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
