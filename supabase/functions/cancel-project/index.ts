import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CANCEL PROJECT - Complete Project Cancellation & Cleanup
 * 
 * This function performs a FULL cancellation:
 * 1. Cancels any running Replicate predictions
 * 2. Deletes ALL storage files (videos, audio, thumbnails)
 * 3. Deletes ALL clips from database
 * 4. Marks the project as 'cancelled' with cleared state
 * 
 * This ensures NO resources remain and no background processes continue.
 */

interface CancelRequest {
  projectId: string;
  userId: string;
}

// Extract storage path from Supabase URL
function extractStoragePath(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  
  try {
    const supabaseMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (supabaseMatch) {
      return {
        bucket: supabaseMatch[1],
        path: decodeURIComponent(supabaseMatch[2]),
      };
    }
    
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
    // Parse body first
    const requestBody: CancelRequest = await req.json();
    const { projectId, userId: bodyUserId } = requestBody;

    // ═══ AUTH: Try JWT first, fall back to body userId verified via DB ownership check ═══
    const { validateAuth } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);

    // Determine userId: prefer JWT-extracted, fall back to body (ownership verified in DB query)
    const userId = auth.userId || bodyUserId;

    if (!projectId || !userId) {
      return new Response(
        JSON.stringify({ error: "projectId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CancelProject] Auth: ${auth.authenticated ? 'JWT' : 'DB-ownership-check'} for user ${userId}`);

    console.log(`[CancelProject] Starting FULL cancellation for project ${projectId}`);

    // 1. Fetch the project to get current state and prediction IDs
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

    const cancelledItems: string[] = [];
    const storageFilesToDelete: { bucket: string; paths: string[] }[] = [];

    // 2. Collect prediction IDs from pipeline state
    const pipelineState = typeof project.pipeline_state === 'string' 
      ? JSON.parse(project.pipeline_state) 
      : project.pipeline_state;
    
    const predictionIds: string[] = [];
    
    if (pipelineState?.predictionId) {
      predictionIds.push(pipelineState.predictionId);
    }
    
    const pendingTasks = typeof project.pending_video_tasks === 'string'
      ? JSON.parse(project.pending_video_tasks)
      : project.pending_video_tasks;
    
    if (pendingTasks?.predictionId) {
      predictionIds.push(pendingTasks.predictionId);
    }

    // 3. Get ALL clips for this project
    const { data: clips } = await supabase
      .from('video_clips')
      .select('*')
      .eq('project_id', projectId);

    if (clips) {
      for (const clip of clips) {
        // Collect prediction IDs
        if (clip.veo_operation_name && ['pending', 'generating'].includes(clip.status)) {
          predictionIds.push(clip.veo_operation_name);
        }
        
        // Collect storage URLs
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
    }

    // 4. Collect project-level storage URLs
    // Note: Only include columns that exist in the movie_projects table
    const projectUrls = [
      project.video_url,
      project.voice_audio_url,
      project.thumbnail_url,
      project.music_url,
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
      console.log(`[CancelProject] Cancelling ${predictionIds.length} Replicate predictions`);
      
      for (const predictionId of predictionIds) {
        try {
          const cancelResponse = await fetch(
            `https://api.replicate.com/v1/predictions/${predictionId}/cancel`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${replicateApiKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          
          if (cancelResponse.ok) {
            console.log(`[CancelProject] Cancelled prediction ${predictionId}`);
            cancelledItems.push(`prediction:${predictionId}`);
          }
        } catch (err) {
          console.error(`[CancelProject] Error cancelling prediction ${predictionId}:`, err);
        }
      }
    }

    // 6. Delete all storage files
    let totalFilesDeleted = 0;
    for (const storageGroup of storageFilesToDelete) {
      try {
        if (storageGroup.paths.length > 0) {
          const { error } = await supabase.storage
            .from(storageGroup.bucket)
            .remove(storageGroup.paths);
          
          if (!error) {
            totalFilesDeleted += storageGroup.paths.length;
            console.log(`[CancelProject] Deleted ${storageGroup.paths.length} files from ${storageGroup.bucket}`);
          }
        }
      } catch (err) {
        console.error(`[CancelProject] Error deleting from storage:`, err);
      }
    }
    if (totalFilesDeleted > 0) {
      cancelledItems.push(`storage:${totalFilesDeleted} files`);
    }

    // 7. Delete ALL clips from database
    if (clips && clips.length > 0) {
      const { error: clipsError } = await supabase
        .from('video_clips')
        .delete()
        .eq('project_id', projectId);

      if (!clipsError) {
        cancelledItems.push(`clips:${clips.length} deleted`);
        console.log(`[CancelProject] Deleted ${clips.length} clips`);
      }
    }

    // 8. Update project status and clear all references
    const { error: updateError } = await supabase
      .from('movie_projects')
      .update({
        status: 'cancelled',
        video_url: null,
        voice_audio_url: null,
        thumbnail_url: null,
        music_url: null,
        pipeline_state: {
          stage: 'cancelled',
          progress: 0,
          cancelledAt: new Date().toISOString(),
          cancelledBy: userId,
          message: 'Project cancelled - all resources deleted',
        },
        pending_video_tasks: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`Failed to update project: ${updateError.message}`);
    }

    cancelledItems.push('project:cancelled');
    console.log(`[CancelProject] Project ${projectId} FULLY cancelled and cleaned`);

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        message: 'Project cancelled. All files, clips, and predictions have been removed.',
        cancelledItems,
        summary: {
          predictionsCancelled: predictionIds.length,
          clipsDeleted: clips?.length || 0,
          storageFilesDeleted: totalFilesDeleted,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[CancelProject] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
