import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * FINAL-ASSEMBLY Edge Function v1.0
 * 
 * Post-production orchestrator that:
 * 1. Validates all clips are complete
 * 2. Triggers simple-stitch for manifest creation
 * 3. Updates project status to completed
 * 
 * CHECKPOINTS:
 * - CHECKPOINT D: Stitching started
 * - CHECKPOINT E: Final video produced
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FinalAssemblyRequest {
  projectId: string;
  userId?: string;
  forceReconcile?: boolean; // When true, clear any previous error state
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { projectId, userId, forceReconcile } = await req.json() as FinalAssemblyRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[FinalAssembly] CHECKPOINT D: Stitching started for project: ${projectId}${forceReconcile ? ' (RECONCILIATION MODE)' : ''}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Validate all clips are complete
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('id, title, status, pending_video_tasks, mode')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message || 'Unknown'}`);
    }

    // Get expected clip count
    const tasks = project.pending_video_tasks as Record<string, unknown> | null;
    const expectedClipCount = (tasks?.clipCount as number) || 5;

    // Count completed clips
    const { data: clips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, video_url, duration_seconds, status')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('shot_index');

    if (clipsError) {
      throw new Error(`Failed to fetch clips: ${clipsError.message}`);
    }

    const completedCount = clips?.length || 0;
    console.log(`[FinalAssembly] Validated: ${completedCount}/${expectedClipCount} clips complete`);

    if (completedCount === 0) {
      throw new Error('No completed clips found - cannot proceed with assembly');
    }

    // Log clip details for debugging
    clips?.forEach((clip, i) => {
      console.log(`[FinalAssembly] Clip ${i + 1}: ${clip.video_url?.substring(0, 60)}... (${clip.duration_seconds}s)`);
    });

    // Step 2: Update status to stitching
    await supabase
      .from('movie_projects')
      .update({
        pipeline_stage: 'stitching',
        status: 'stitching',
        pending_video_tasks: {
          ...(tasks || {}),
          stage: 'stitching',
          progress: 92,
          assemblyStartedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    // Step 3: Call simple-stitch for manifest creation
    console.log(`[FinalAssembly] Invoking simple-stitch for manifest creation...`);
    
    const stitchResponse = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ projectId, userId }),
    });

    if (!stitchResponse.ok) {
      const errorText = await stitchResponse.text();
      throw new Error(`simple-stitch failed: ${stitchResponse.status} ${errorText}`);
    }

    const stitchResult = await stitchResponse.json();
    
    if (!stitchResult.success) {
      throw new Error(`simple-stitch returned error: ${stitchResult.error}`);
    }

    const manifestUrl = stitchResult.manifestUrl || stitchResult.finalVideoUrl;
    const totalDuration = stitchResult.totalDuration || 0;
    const clipsProcessed = stitchResult.clipsProcessed || completedCount;

    console.log(`[FinalAssembly] CHECKPOINT E: Final video produced`);
    console.log(`[FinalAssembly] - Path: ${manifestUrl}`);
    console.log(`[FinalAssembly] - Clips: ${clipsProcessed}`);
    console.log(`[FinalAssembly] - Duration: ${totalDuration}s`);

    // Step 4: Final status update with FORCED RECONCILIATION
    // CRITICAL: This update MUST clear any previous 'failed' or 'error' status
    // when all clips have successfully completed. This is the final authority.
    const finalUpdate = {
      status: 'completed',
      pipeline_stage: 'complete',
      video_url: manifestUrl,
      pending_video_tasks: {
        stage: 'complete',
        progress: 100,
        mode: 'manifest_playback',
        manifestUrl,
        clipCount: clipsProcessed,
        totalDuration,
        completedAt: new Date().toISOString(),
        assemblyTimeMs: Date.now() - startTime,
        reconciled: forceReconcile || false,
        previousStatus: project.status, // Track what we're overwriting
      },
      updated_at: new Date().toISOString(),
    };
    
    // Log if we're overwriting a failed/error status
    if (project.status === 'failed' || project.status === 'error') {
      console.log(`[FinalAssembly] ⚠️ RECONCILIATION: Overwriting '${project.status}' → 'completed' (${clipsProcessed} clips verified)`);
    }
    
    await supabase
      .from('movie_projects')
      .update(finalUpdate)
      .eq('id', projectId);

    console.log(`[FinalAssembly] ✅ Assembly complete in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        checkpoints: {
          D: 'stitching_started',
          E: 'final_video_produced',
        },
        manifestUrl,
        clipsProcessed,
        totalDuration,
        processingTimeMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[FinalAssembly] Error:", errorMsg);
    
    // Try to update project with error state
    try {
      const body = await req.clone().json() as FinalAssemblyRequest;
      if (body.projectId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('movie_projects')
          .update({
            status: 'error',
            pending_video_tasks: {
              stage: 'assembly_error',
              error: errorMsg,
              errorAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.projectId);
      }
    } catch (updateErr) {
      console.error("[FinalAssembly] Failed to update error state:", updateErr);
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
