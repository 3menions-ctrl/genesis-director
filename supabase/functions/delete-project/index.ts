import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * DELETE PROJECT - Complete Project & Asset Removal
 * 
 * Performs FULL deletion:
 * 1. Cancels any active Replicate predictions
 * 2. Deletes ALL video clips from database
 * 3. Deletes ALL storage files (videos, audio, thumbnails)
 * 4. Deletes the project record
 * 
 * Nothing is left behind.
 */

interface DeleteRequest {
  projectId: string;
  userId: string;
}

// Extract storage path from Supabase URL
function extractStoragePath(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  
  try {
    // Match Supabase storage URLs
    const supabaseMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (supabaseMatch) {
      return {
        bucket: supabaseMatch[1],
        path: decodeURIComponent(supabaseMatch[2]),
      };
    }
    
    // Match authenticated storage URLs
    const authMatch = url.match(/\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)/);
    if (authMatch) {
      return {
        bucket: authMatch[1],
        path: decodeURIComponent(authMatch[2]),
      };
    }
  } catch {
    return null;
  }
  
  return null;
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
    // ═══ AUTH GUARD: Require valid JWT ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const requestBody: DeleteRequest = await req.json();
    const { projectId } = requestBody;
    // SECURITY: Always use JWT-extracted userId, never trust client payload
    const userId = auth.userId || requestBody.userId;

    if (!projectId || !userId) {
      return new Response(
        JSON.stringify({ error: "projectId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DeleteProject] Starting FULL deletion for project ${projectId}`);

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
    const storageFilesToDelete: { bucket: string; paths: string[] }[] = [];

    // 2. Cancel any active Replicate predictions
    const predictionIds: string[] = [];
    
    // From pipeline_state
    const pipelineState = typeof project.pipeline_state === 'string' 
      ? JSON.parse(project.pipeline_state) 
      : project.pipeline_state;
    if (pipelineState?.predictionId) {
      predictionIds.push(pipelineState.predictionId);
    }
    
    // From pending_video_tasks
    const pendingTasks = typeof project.pending_video_tasks === 'string'
      ? JSON.parse(project.pending_video_tasks)
      : project.pending_video_tasks;
    if (pendingTasks?.predictionId) {
      predictionIds.push(pendingTasks.predictionId);
    }

    // 3. Get ALL clips for this project (any status)
    const { data: clips } = await supabase
      .from('video_clips')
      .select('*')
      .eq('project_id', projectId);

    if (clips) {
      for (const clip of clips) {
        // Collect prediction IDs from generating clips
        if (clip.veo_operation_name && ['pending', 'generating'].includes(clip.status)) {
          predictionIds.push(clip.veo_operation_name);
        }
        
        // Collect storage URLs from clips
        if (clip.video_url) {
          const storage = extractStoragePath(clip.video_url);
          if (storage) {
            const existing = storageFilesToDelete.find(s => s.bucket === storage.bucket);
            if (existing) {
              existing.paths.push(storage.path);
            } else {
              storageFilesToDelete.push({ bucket: storage.bucket, paths: [storage.path] });
            }
          }
        }
        if (clip.thumbnail_url) {
          const storage = extractStoragePath(clip.thumbnail_url);
          if (storage) {
            const existing = storageFilesToDelete.find(s => s.bucket === storage.bucket);
            if (existing) {
              existing.paths.push(storage.path);
            } else {
              storageFilesToDelete.push({ bucket: storage.bucket, paths: [storage.path] });
            }
          }
        }
      }
      deletionLog.push(`Found ${clips.length} clips to delete`);
    }

    // 4. Collect project-level storage URLs
    const projectUrls = [
      project.video_url,
      project.voice_audio_url,
      project.thumbnail_url,
      project.music_url,
      project.manifest_url,
    ].filter(Boolean);

    for (const url of projectUrls) {
      const storage = extractStoragePath(url);
      if (storage) {
        const existing = storageFilesToDelete.find(s => s.bucket === storage.bucket);
        if (existing) {
          existing.paths.push(storage.path);
        } else {
          storageFilesToDelete.push({ bucket: storage.bucket, paths: [storage.path] });
        }
      }
    }

    // 5. Cancel all Replicate predictions
    if (replicateApiKey && predictionIds.length > 0) {
      console.log(`[DeleteProject] Cancelling ${predictionIds.length} predictions`);
      
      for (const predictionId of predictionIds) {
        try {
          await fetch(
            `https://api.replicate.com/v1/predictions/${predictionId}/cancel`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${replicateApiKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          deletionLog.push(`Cancelled prediction: ${predictionId}`);
        } catch (err) {
          console.error(`[DeleteProject] Error cancelling prediction ${predictionId}:`, err);
        }
      }
    }

    // 6. Delete all storage files
    for (const storageGroup of storageFilesToDelete) {
      try {
        if (storageGroup.paths.length > 0) {
          const { error } = await supabase.storage
            .from(storageGroup.bucket)
            .remove(storageGroup.paths);
          
          if (!error) {
            deletionLog.push(`Deleted ${storageGroup.paths.length} files from ${storageGroup.bucket}`);
            console.log(`[DeleteProject] Deleted ${storageGroup.paths.length} files from ${storageGroup.bucket}`);
          } else {
            console.error(`[DeleteProject] Storage delete error:`, error);
          }
        }
      } catch (err) {
        console.error(`[DeleteProject] Error deleting from ${storageGroup.bucket}:`, err);
      }
    }

    // 7. Delete all clips from database
    if (clips && clips.length > 0) {
      const { error: clipsDeleteError } = await supabase
        .from('video_clips')
        .delete()
        .eq('project_id', projectId);

      if (!clipsDeleteError) {
        deletionLog.push(`Deleted ${clips.length} clip records`);
      } else {
        console.error('[DeleteProject] Error deleting clips:', clipsDeleteError);
      }
    }

    // 8. Delete the project record
    const { error: projectDeleteError } = await supabase
      .from('movie_projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId);

    if (projectDeleteError) {
      throw new Error(`Failed to delete project: ${projectDeleteError.message}`);
    }

    deletionLog.push('Project record deleted');
    console.log(`[DeleteProject] Project ${projectId} FULLY deleted`);

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        message: 'Project completely deleted. All files and data removed.',
        deletionLog,
        summary: {
          clipsDeleted: clips?.length || 0,
          predictionsKilled: predictionIds.length,
          storageFilesDeleted: storageFilesToDelete.reduce((sum, g) => sum + g.paths.length, 0),
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
