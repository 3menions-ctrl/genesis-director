import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * DELETE PROJECT — PERMANENT HARD DELETE
 * 
 * 1. Cancels any active Replicate/Kling predictions (stop API spend)
 * 2. Deletes ALL storage files (video clips, thumbnails, HLS playlists, frames)
 * 3. Deletes ALL related database records (clips, likes, comments, etc.)
 * 4. Deletes the project record itself
 * 
 * This is irreversible. Everything is destroyed.
 */

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

    console.log(`[DeleteProject] HARD DELETE starting for project ${projectId}`);

    // 1. Verify project ownership (or admin)
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('id, user_id, title, pending_video_tasks, pipeline_state, video_url, thumbnail_url')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Must be owner or admin
    const isAdmin = auth.isServiceRole || project.user_id === userId;
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stats = { predictionsKilled: 0, storageFilesDeleted: 0, dbRecordsDeleted: 0 };

    // ═══ STEP 1: Cancel active predictions ═══
    const predictionIds = collectPredictionIds(project);
    if (replicateApiKey && predictionIds.length > 0) {
      console.log(`[DeleteProject] Cancelling ${predictionIds.length} predictions`);
      for (const predictionId of predictionIds) {
        try {
          await fetch(
            `https://api.replicate.com/v1/predictions/${predictionId}/cancel`,
            { method: 'POST', headers: { Authorization: `Bearer ${replicateApiKey}`, "Content-Type": "application/json" } }
          );
          stats.predictionsKilled++;
        } catch (err) {
          console.warn(`[DeleteProject] Failed to cancel prediction ${predictionId}:`, err);
        }
      }
    }

    // ═══ STEP 2: Collect and delete storage files ═══
    const storageUrls = new Set<string>();

    // Collect from video_clips
    const { data: clips } = await supabase
      .from('video_clips')
      .select('video_url, last_frame_url, first_frame_url, thumbnail_url')
      .eq('project_id', projectId);

    if (clips) {
      for (const clip of clips) {
        if (clip.video_url) storageUrls.add(clip.video_url);
        if (clip.last_frame_url) storageUrls.add(clip.last_frame_url);
        if (clip.first_frame_url) storageUrls.add(clip.first_frame_url);
        if (clip.thumbnail_url) storageUrls.add(clip.thumbnail_url);
      }
    }

    // Collect from project itself
    if (project.video_url) storageUrls.add(project.video_url);
    if (project.thumbnail_url) storageUrls.add(project.thumbnail_url);

    // Collect from pending_video_tasks
    const tasks = project.pending_video_tasks as Record<string, unknown> | null;
    if (tasks) {
      if (tasks.hlsPlaylistUrl) storageUrls.add(tasks.hlsPlaylistUrl as string);
      if (Array.isArray(tasks.mseClipUrls)) {
        for (const url of tasks.mseClipUrls as string[]) storageUrls.add(url);
      }
      if (Array.isArray(tasks.predictions)) {
        for (const p of tasks.predictions as Array<{ videoUrl?: string }>) {
          if (p.videoUrl) storageUrls.add(p.videoUrl);
        }
      }
    }

    // Delete from storage buckets
    const bucketFiles = new Map<string, string[]>();
    for (const url of storageUrls) {
      const parsed = parseStorageUrl(url, supabaseUrl);
      if (parsed) {
        if (!bucketFiles.has(parsed.bucket)) bucketFiles.set(parsed.bucket, []);
        bucketFiles.get(parsed.bucket)!.push(parsed.path);
      }
    }

    for (const [bucket, paths] of bucketFiles) {
      // Storage API supports batch delete of up to 100 files
      const batches = chunkArray(paths, 100);
      for (const batch of batches) {
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove(batch);
        if (storageError) {
          console.warn(`[DeleteProject] Storage delete error in ${bucket}:`, storageError.message);
        } else {
          stats.storageFilesDeleted += batch.length;
        }
      }
    }

    console.log(`[DeleteProject] Deleted ${stats.storageFilesDeleted} storage files`);

    // ═══ STEP 3: Delete all related database records ═══
    // Order matters: delete children first, then project

    // Delete video likes
    await supabase.from('video_likes').delete().eq('project_id', projectId);

    // Delete project comments (and their likes/reactions)
    const { data: comments } = await supabase
      .from('project_comments')
      .select('id')
      .eq('project_id', projectId);
    if (comments && comments.length > 0) {
      const commentIds = comments.map(c => c.id);
      await supabase.from('comment_likes').delete().in('comment_id', commentIds);
      await supabase.from('comment_reactions').delete().in('comment_id', commentIds);
      await supabase.from('project_comments').delete().eq('project_id', projectId);
    }

    // Delete video clips
    const { count: clipCount } = await supabase
      .from('video_clips')
      .delete({ count: 'exact' })
      .eq('project_id', projectId);
    stats.dbRecordsDeleted += clipCount || 0;

    // Delete edit sessions
    await supabase.from('edit_sessions').delete().eq('project_id', projectId);

    // Delete credit transactions referencing this project
    await supabase.from('credit_transactions').delete().eq('project_id', projectId);

    // Delete api cost logs
    await supabase.from('api_cost_logs').delete().eq('project_id', projectId);

    // Delete character voice assignments
    await supabase.from('character_voice_assignments').delete().eq('project_id', projectId);

    // Delete production credit phases
    await supabase.from('production_credit_phases').delete().eq('project_id', projectId);

    // Delete character loans
    await supabase.from('character_loans').delete().eq('project_id', projectId);

    // ═══ STEP 4: Delete the project itself ═══
    const { error: deleteError } = await supabase
      .from('movie_projects')
      .delete()
      .eq('id', projectId);

    if (deleteError) {
      throw new Error(`Failed to delete project: ${deleteError.message}`);
    }

    stats.dbRecordsDeleted++;

    console.log(`[DeleteProject] ✅ HARD DELETE complete for ${projectId}. Files: ${stats.storageFilesDeleted}, Records: ${stats.dbRecordsDeleted}, Predictions: ${stats.predictionsKilled}`);

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        message: 'Project permanently deleted',
        stats,
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

/** Extract all prediction IDs from project state fields for cancellation */
function collectPredictionIds(project: Record<string, unknown>): string[] {
  const ids: string[] = [];

  const parseJson = (val: unknown) => {
    if (!val) return null;
    return typeof val === 'string' ? JSON.parse(val) : val;
  };

  try {
    const pipelineState = parseJson(project.pipeline_state);
    if (pipelineState?.predictionId) ids.push(pipelineState.predictionId);
    if (Array.isArray(pipelineState?.predictions)) {
      for (const p of pipelineState.predictions) {
        if (p?.predictionId) ids.push(p.predictionId);
      }
    }
  } catch { /* ignore */ }

  try {
    const pendingTasks = parseJson(project.pending_video_tasks);
    if (pendingTasks?.predictionId) ids.push(pendingTasks.predictionId);
    if (Array.isArray(pendingTasks?.predictions)) {
      for (const p of pendingTasks.predictions) {
        if (p?.predictionId) ids.push(p.predictionId);
        if (p?.prediction_id) ids.push(p.prediction_id);
      }
    }
  } catch { /* ignore */ }

  return [...new Set(ids)]; // deduplicate
}

/** Parse a Supabase storage URL into bucket + path */
function parseStorageUrl(url: string, supabaseUrl: string): { bucket: string; path: string } | null {
  if (!url || !url.includes(supabaseUrl)) return null;

  // Pattern: /storage/v1/object/public/{bucket}/{path}
  const publicMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (publicMatch) {
    return { bucket: publicMatch[1], path: decodeURIComponent(publicMatch[2]) };
  }

  // Pattern: /storage/v1/object/sign/{bucket}/{path}
  const signedMatch = url.match(/\/storage\/v1\/object\/sign\/([^/]+)\/([^?]+)/);
  if (signedMatch) {
    return { bucket: signedMatch[1], path: decodeURIComponent(signedMatch[2]) };
  }

  return null;
}

/** Split array into chunks */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
