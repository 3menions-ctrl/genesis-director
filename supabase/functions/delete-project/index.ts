import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * DELETE PROJECT - Reassign assets to admin, then remove project
 * 
 * NEW BEHAVIOR (orphan prevention):
 * 1. Cancels any active Replicate predictions
 * 2. Reassigns ALL video clips to admin with provenance metadata
 * 3. Logs an audit trail of what was reassigned
 * 4. Deletes the project record (clips are preserved under admin)
 * 
 * Storage files are NEVER deleted - they stay linked via the reassigned clips.
 */

const ADMIN_USER_ID = "d600868d-651a-46f6-a621-a727b240ac7c";

interface DeleteRequest {
  projectId: string;
  userId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const replicateApiKey = Deno.env.get("REPLICATE_API_KEY");
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const requestBody: DeleteRequest = await req.json();
    const { projectId } = requestBody;
    const userId = auth.userId || requestBody.userId;

    if (!projectId || !userId) {
      return new Response(
        JSON.stringify({ error: "projectId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DeleteProject] Starting deletion with orphan prevention for project ${projectId}`);

    // 1. Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deletionLog: string[] = [];

    // 2. Cancel active Replicate predictions
    const predictionIds = collectPredictionIds(project);
    if (replicateApiKey && predictionIds.length > 0) {
      console.log(`[DeleteProject] Cancelling ${predictionIds.length} predictions`);
      for (const predictionId of predictionIds) {
        try {
          await fetch(
            `https://api.replicate.com/v1/predictions/${predictionId}/cancel`,
            { method: 'POST', headers: { Authorization: `Bearer ${replicateApiKey}`, "Content-Type": "application/json" } }
          );
          deletionLog.push(`Cancelled prediction: ${predictionId}`);
        } catch (err) {
          console.error(`[DeleteProject] Error cancelling prediction ${predictionId}:`, err);
        }
      }
    }

    // 3. Reassign ALL clips to admin (orphan prevention)
    const { data: clips } = await supabase
      .from('video_clips')
      .select('id, shot_index, status, video_url')
      .eq('project_id', projectId);

    let clipsReassigned = 0;
    if (clips && clips.length > 0) {
      // Update clips: reassign to admin, rename project to show provenance
      const { error: reassignError } = await supabase
        .from('video_clips')
        .update({ user_id: ADMIN_USER_ID })
        .eq('project_id', projectId);

      if (!reassignError) {
        clipsReassigned = clips.length;
        deletionLog.push(`Reassigned ${clips.length} clips to admin`);
      } else {
        console.error('[DeleteProject] Error reassigning clips:', reassignError);
        // Fallback: still proceed with deletion but log the issue
        deletionLog.push(`WARNING: Failed to reassign clips: ${reassignError.message}`);
      }
    }

    // 4. Rename the project to show it's recovered/archived, reassign to admin
    const originalTitle = project.title || 'Untitled';
    const { error: reassignProjectError } = await supabase
      .from('movie_projects')
      .update({
        user_id: ADMIN_USER_ID,
        title: `[DELETED by ${userId.substring(0, 8)}] ${originalTitle}`,
        status: 'cancelled',
        last_error: `Originally owned by user ${userId}. Deleted on ${new Date().toISOString()}. ${clipsReassigned} clips preserved.`,
      })
      .eq('id', projectId);

    if (reassignProjectError) {
      console.error('[DeleteProject] Error reassigning project to admin:', reassignProjectError);
      // If reassignment fails, fall back to actual deletion
      const { error: deleteErr } = await supabase
        .from('movie_projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId);
      if (deleteErr) throw new Error(`Failed to delete project: ${deleteErr.message}`);
      deletionLog.push('Fallback: Project record deleted (reassignment failed)');
    } else {
      deletionLog.push(`Project reassigned to admin as archived: "${originalTitle}"`);
    }

    // 5. Audit trail
    await supabase.from('admin_audit_log').insert({
      admin_id: ADMIN_USER_ID,
      action: 'project_orphan_prevention',
      target_type: 'project',
      target_id: projectId,
      details: {
        original_owner: userId,
        original_title: originalTitle,
        clips_preserved: clipsReassigned,
        predictions_cancelled: predictionIds.length,
        deletion_log: deletionLog,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[DeleteProject] Project ${projectId} archived to admin. ${clipsReassigned} clips preserved.`);

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        message: 'Project removed from your account. Assets preserved.',
        deletionLog,
        summary: {
          clipsPreserved: clipsReassigned,
          predictionsKilled: predictionIds.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DeleteProject] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Extract all prediction IDs from project state fields */
function collectPredictionIds(project: Record<string, unknown>): string[] {
  const ids: string[] = [];
  
  const parseJson = (val: unknown) => {
    if (!val) return null;
    return typeof val === 'string' ? JSON.parse(val) : val;
  };
  
  try {
    const pipelineState = parseJson(project.pipeline_state);
    if (pipelineState?.predictionId) ids.push(pipelineState.predictionId);
  } catch { /* ignore */ }
  
  try {
    const pendingTasks = parseJson(project.pending_video_tasks);
    if (pendingTasks?.predictionId) ids.push(pendingTasks.predictionId);
  } catch { /* ignore */ }
  
  return ids;
}
