import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * AUTO-STITCH TRIGGER v4 - MANIFEST-ONLY
 * 
 * STRATEGY: Always guarantee a working video for users via manifest playback
 * 1. Check if all clips are completed
 * 2. Call seamless-stitcher to create manifest
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

/**
 * Fire "render complete" — email + in-app notification — when a project
 * transitions to a usable final state. Idempotent via the `notifications`
 * row: if a render_complete row already exists for this project, the email
 * is skipped so cron retries don't double-send.
 */
async function notifyRenderComplete(params: {
  supabase: ReturnType<typeof createClient>;
  projectId: string;
  userId?: string;
  projectTitle?: string;
}): Promise<void> {
  const { supabase, projectId, userId, projectTitle } = params;
  try {
    if (!userId) {
      // Try to look up owner if caller didn't pass it.
      const { data: proj } = await supabase
        .from('movie_projects')
        .select('user_id, title')
        .eq('id', projectId)
        .maybeSingle<{ user_id: string; title: string | null }>();
      if (!proj) return;
      userId = proj.user_id;
      params.projectTitle = params.projectTitle ?? proj.title ?? undefined;
    }

    // Idempotency: don't notify twice for the same project. The notification
    // row stores the projectId in `data.project_id` so we can look it up.
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'video_complete')
      .contains('data', { project_id: projectId })
      .limit(1)
      .maybeSingle();
    if (existing) return;

    const title = projectTitle ?? params.projectTitle ?? 'Your project';

    // 1. In-app notification row (type uses the existing notification_type
    // enum value 'video_complete'; data carries project + deep-link).
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'video_complete',
      title: `${title} is ready`,
      body: 'Open it in your library to watch, edit, or share.',
      data: {
        project_id: projectId,
        action_url: `/production/${projectId}`,
      },
    });

    // 2. Email (best-effort — recipient lookup happens inside send-transactional-email)
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle<{ email: string | null }>();
    if (profile?.email) {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          template: 'render_complete',
          recipientEmail: profile.email,
          templateData: {
            projectTitle: title,
            projectUrl: `https://smallbridges.co/production/${projectId}`,
          },
        },
      });
    }
  } catch (e) {
    console.warn('[AutoStitch] notifyRenderComplete failed:', e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse, resolveEffectiveUserId, forbiddenResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    // Parse body ONCE — use closure for error recovery below
    let projectId: string | undefined;
    let userId: string | undefined;
    let forceStitch = false;
    
    const body = await req.json() as AutoStitchRequest;
    projectId = body.projectId;
    // SECURITY: trust JWT, never the body, for end-user calls
    try {
      userId = resolveEffectiveUserId(auth, body.userId);
    } catch (e) {
      return forbiddenResponse(corsHeaders, (e as Error).message);
    }
    forceStitch = body.forceStitch ?? false;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[AutoStitch] Checking project: ${projectId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get project details (include pipeline_state for avatar totalClips)
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('id, title, status, pending_video_tasks, pipeline_state, mode')
      .eq('id', projectId)
      .maybeSingle();

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

    // Step 2: Get expected clip count — check MULTIPLE sources for accuracy
    const tasks = project.pending_video_tasks as Record<string, unknown> | null;
    const pipelineState = project.pipeline_state as Record<string, unknown> | null;
    const asyncJobData = pipelineState?.asyncJobData as Record<string, unknown> | null;
    const predictions = asyncJobData?.predictions as Array<unknown> | undefined;
    
    // Priority: pipeline_state.asyncJobData.totalClips > predictions.length > tasks.clipCount > tasks.shotCount > 6
    const expectedClipCount = 
      (asyncJobData?.totalClips as number) ||
      (predictions?.length) ||
      (tasks?.clipCount as number) || 
      (tasks?.shotCount as number) || 
      6;
    
    console.log(`[AutoStitch] Expected clip count: ${expectedClipCount} (mode: ${project.mode}, source: ${asyncJobData?.totalClips ? 'pipeline_state' : predictions?.length ? 'predictions' : tasks?.clipCount ? 'tasks.clipCount' : 'default'})`);

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
    console.log(`[AutoStitch] ✅ All ${completedCount} clips complete - triggering seamless-stitcher!`);

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

    // Step 6: Use seamless-stitcher for manifest creation
    console.log("[AutoStitch] Calling seamless-stitcher for manifest creation...");
    
    const { data: stitchResult, error: stitchError } = await supabase.functions.invoke('seamless-stitcher', {
      body: { projectId, userId },
    });
    
    if (stitchError) {
      console.error(`[AutoStitch] seamless-stitcher invocation error: ${stitchError.message}`);
      
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
    
    console.log("[AutoStitch] seamless-stitcher result:", JSON.stringify(stitchResult));

    // Fire the "render complete" email + insert an in-app notification. Both
    // are best-effort — the success response is independent of either.
    void notifyRenderComplete({
      supabase,
      projectId,
      userId,
      projectTitle: (project as { title?: string } | null)?.title,
    });

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
      if (projectId) {
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
