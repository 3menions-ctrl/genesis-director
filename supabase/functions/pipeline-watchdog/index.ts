import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Pipeline Watchdog Edge Function v2.0 - AGGRESSIVE AUTO-RECOVERY
 * 
 * Runs every minute to ensure pipelines complete even when users log out:
 * 
 * 1. PRODUCTION RECOVERY: Detects stalled 'generating' projects with incomplete clips
 * 2. STITCHING RECOVERY: Monitors stitching progress and retriggers if stuck
 * 3. COMPLETION GUARANTEE: Falls back to manifest if Cloud Run fails 3x
 * 
 * This runs as a cron job - completely independent of user sessions!
 */

interface StalledProject {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  pending_video_tasks: Record<string, unknown> | null;
  user_id: string;
  generated_script: string | null;
}

interface ClipRecord {
  id: string;
  video_url: string;
  duration_seconds: number;
  shot_index: number;
}

interface ProjectRecord {
  title: string;
  voice_audio_url: string | null;
  music_url: string | null;
}

interface WatchdogResult {
  stalledProjects: number;
  productionResumed: number;
  stitchingRetried: number;
  manifestFallbacks: number;
  projectsCompleted: number;
  projectsMarkedFailed: number;
  details: Array<{
    projectId: string;
    action: string;
    result: string;
  }>;
}

// Stale timeout: 2 minutes for any stuck state
const STALE_TIMEOUT_MS = 2 * 60 * 1000;

// Stitching timeout: 5 minutes before retrying
const STITCHING_TIMEOUT_MS = 5 * 60 * 1000;

// Max stitching attempts before manifest fallback
const MAX_STITCHING_ATTEMPTS = 3;

// Max total age before marking as failed: 60 minutes
const MAX_AGE_MS = 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const result: WatchdogResult = {
      stalledProjects: 0,
      productionResumed: 0,
      stitchingRetried: 0,
      manifestFallbacks: 0,
      projectsCompleted: 0,
      projectsMarkedFailed: 0,
      details: [],
    };

    console.log("[Watchdog] Starting aggressive pipeline recovery check...");

    const cutoffTime = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString();
    
    // Find ALL potentially stuck projects
    const { data: stalledProjects, error: stalledError } = await supabase
      .from('movie_projects')
      .select('id, title, status, updated_at, pending_video_tasks, user_id, generated_script')
      .in('status', ['generating', 'stitching', 'rendering', 'assembling', 'retry_scheduled'])
      .lt('updated_at', cutoffTime)
      .limit(30);
    
    if (stalledError) {
      console.error("[Watchdog] Error finding stalled projects:", stalledError);
      throw stalledError;
    }

    result.stalledProjects = stalledProjects?.length || 0;
    console.log(`[Watchdog] Found ${result.stalledProjects} potentially stalled projects`);

    for (const project of (stalledProjects as StalledProject[] || [])) {
      const tasks = project.pending_video_tasks || {} as Record<string, unknown>;
      const projectAge = Date.now() - new Date(project.updated_at).getTime();
      const stage = (tasks as Record<string, unknown>).stage || 'unknown';
      const stitchAttempts = ((tasks as Record<string, unknown>).stitchAttempts as number) || 0;
      
      console.log(`[Watchdog] Processing: ${project.id} (status=${project.status}, stage=${stage}, age=${Math.round(projectAge / 1000)}s, stitchAttempts=${stitchAttempts})`);

      // ==================== HANDLE STUCK STITCHING ====================
      if (project.status === 'stitching' || project.status === 'assembling') {
        const stitchingStarted = (tasks as Record<string, unknown>).stitchingStarted as string | undefined;
        const stitchingAge = stitchingStarted 
          ? Date.now() - new Date(stitchingStarted).getTime()
          : projectAge;
        
        console.log(`[Watchdog] Stitching age: ${Math.round(stitchingAge / 1000)}s, attempts: ${stitchAttempts}`);

        // If stitching has been stuck too long
        if (stitchingAge > STITCHING_TIMEOUT_MS) {
          
          // Check if we've exceeded max attempts - fallback to manifest
          if (stitchAttempts >= MAX_STITCHING_ATTEMPTS) {
            console.log(`[Watchdog] Max stitch attempts reached for ${project.id}, creating manifest fallback`);
            
            await createManifestFallback(supabaseUrl, supabaseKey, project.id);
            
            result.manifestFallbacks++;
            result.details.push({
              projectId: project.id,
              action: 'manifest_fallback',
              result: `Created manifest after ${stitchAttempts} failed stitch attempts`,
            });
            continue;
          }
          
          // Retry stitching
          console.log(`[Watchdog] Retrying stitch for ${project.id} (attempt ${stitchAttempts + 1})`);
          
          // Update attempt counter
          await supabase
            .from('movie_projects')
            .update({
              pending_video_tasks: {
                ...tasks,
                stitchAttempts: stitchAttempts + 1,
                lastRetryAt: new Date().toISOString(),
                watchdogRetry: true,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ projectId: project.id }),
            });
            
            if (response.ok) {
              result.stitchingRetried++;
              result.details.push({
                projectId: project.id,
                action: 'stitch_retried',
                result: `Retry attempt ${stitchAttempts + 1}/${MAX_STITCHING_ATTEMPTS}`,
              });
              console.log(`[Watchdog] ✓ Stitch retry triggered for ${project.id}`);
            } else {
              console.error(`[Watchdog] Stitch retry failed: ${response.status}`);
              result.details.push({
                projectId: project.id,
                action: 'stitch_retry_failed',
                result: `HTTP ${response.status}`,
              });
            }
          } catch (error) {
            console.error(`[Watchdog] Stitch retry error:`, error);
          }
          continue;
        }
      }

      // ==================== HANDLE STUCK GENERATING ====================
      if (project.status === 'generating') {
        // Parse expected clip count
        let expectedClipCount = ((tasks as Record<string, unknown>).clipCount as number) || 6;
        
        if (project.generated_script) {
          try {
            const script = JSON.parse(project.generated_script);
            if (script.shots && Array.isArray(script.shots)) {
              expectedClipCount = script.shots.length;
            }
          } catch (e) { /* ignore parse errors */ }
        }
        
        // Get clip status
        const { data: clips } = await supabase
          .from('video_clips')
          .select('id, shot_index, status, video_url')
          .eq('project_id', project.id)
          .order('shot_index');
        
        const completedClips = (clips || []).filter((c: { status: string; video_url: string }) => 
          c.status === 'completed' && c.video_url
        );
        
        console.log(`[Watchdog] Clips: ${completedClips.length}/${expectedClipCount} completed`);
        
        // All clips done but stuck in 'generating' -> trigger stitch
        if (completedClips.length >= expectedClipCount) {
          console.log(`[Watchdog] All clips ready for ${project.id}, triggering stitch`);
          
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ projectId: project.id }),
            });
            
            if (response.ok) {
              result.projectsCompleted++;
              result.details.push({
                projectId: project.id,
                action: 'stitch_triggered',
                result: `All ${completedClips.length} clips ready`,
              });
            }
          } catch (error) {
            console.error(`[Watchdog] Stitch trigger error:`, error);
          }
          continue;
        }
        
        // Incomplete clips and stalled -> resume production
        if (completedClips.length > 0 && completedClips.length < expectedClipCount) {
          console.log(`[Watchdog] Resuming production for ${project.id} from clip ${completedClips.length + 1}`);
          
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/resume-pipeline`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                projectId: project.id,
                userId: project.user_id,
                resumeFrom: 'production',
              }),
            });
            
            if (response.ok) {
              result.productionResumed++;
              result.details.push({
                projectId: project.id,
                action: 'production_resumed',
                result: `Resumed from clip ${completedClips.length + 1}/${expectedClipCount}`,
              });
              console.log(`[Watchdog] ✓ Production resumed for ${project.id}`);
            }
          } catch (error) {
            console.error(`[Watchdog] Resume error:`, error);
          }
          continue;
        }
      }

      // ==================== HANDLE VERY OLD PROJECTS ====================
      if (projectAge > MAX_AGE_MS) {
        console.log(`[Watchdog] Project ${project.id} exceeded max age (60 min)`);
        
        // Try one last stitch if clips exist
        const { data: clips } = await supabase
          .from('video_clips')
          .select('id, video_url')
          .eq('project_id', project.id)
          .eq('status', 'completed');
        
        if (clips && clips.length > 0) {
          // Create manifest as final fallback
          await createManifestFallback(supabaseUrl, supabaseKey, project.id);
          result.manifestFallbacks++;
          result.details.push({
            projectId: project.id,
            action: 'max_age_manifest',
            result: `Created manifest for ${clips.length} clips after timeout`,
          });
        } else {
          // No clips at all - mark as failed
          await supabase
            .from('movie_projects')
            .update({
              status: 'failed',
              pending_video_tasks: {
                ...tasks,
                stage: 'error',
                error: 'Pipeline exceeded maximum processing time (60 min)',
                failedAt: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          result.projectsMarkedFailed++;
          result.details.push({
            projectId: project.id,
            action: 'marked_failed',
            result: 'No clips generated within 60 minutes',
          });
        }
      }
    }

    console.log(`[Watchdog] Complete: ${result.productionResumed} resumed, ${result.stitchingRetried} stitch retries, ${result.manifestFallbacks} fallbacks`);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Watchdog] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Watchdog failed",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Create a manifest fallback when Cloud Run stitching fails
 */
async function createManifestFallback(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string
) {
  console.log(`[Watchdog] Creating manifest fallback for ${projectId}`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get project and clips
  const { data: projectData } = await supabase
    .from('movie_projects')
    .select('title, voice_audio_url, music_url')
    .eq('id', projectId)
    .single();
  
  const project = projectData as ProjectRecord | null;
  
  const { data: clipsData } = await supabase
    .from('video_clips')
    .select('id, video_url, duration_seconds, shot_index')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('shot_index');
  
  const clips = clipsData as ClipRecord[] | null;
  
  if (!clips || clips.length === 0) {
    console.error(`[Watchdog] No clips to create manifest for ${projectId}`);
    return;
  }
  
  const totalDuration = clips.reduce((sum, c) => sum + (c.duration_seconds || 6), 0);
  
  const manifest = {
    version: "1.0",
    projectId,
    mode: "client_side_concat",
    createdAt: new Date().toISOString(),
    source: "watchdog_fallback",
    clips: clips.map((clip, index) => ({
      index,
      shotId: clip.id,
      videoUrl: clip.video_url,
      duration: clip.duration_seconds || 6,
      startTime: clips.slice(0, index).reduce((sum, c) => sum + (c.duration_seconds || 6), 0),
    })),
    totalDuration,
    voiceUrl: project?.voice_audio_url || null,
    musicUrl: project?.music_url || null,
  };

  const fileName = `manifest_${projectId}_watchdog_${Date.now()}.json`;
  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBytes = new TextEncoder().encode(manifestJson);

  await supabase.storage
    .from('temp-frames')
    .upload(fileName, manifestBytes, { contentType: 'application/json', upsert: true });

  const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;

  await supabase
    .from('movie_projects')
    .update({
      status: 'completed',
      video_url: manifestUrl,
      pending_video_tasks: {
        stage: 'complete',
        progress: 100,
        mode: 'manifest_playback',
        manifestUrl,
        clipCount: clips.length,
        totalDuration,
        source: 'watchdog_fallback',
        note: 'Completed via watchdog manifest fallback',
        completedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  console.log(`[Watchdog] ✅ Manifest created: ${manifestUrl}`);
}
