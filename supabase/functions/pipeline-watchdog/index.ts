import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Pipeline Watchdog Edge Function v3.0 - COMPLETE RECOVERY SYSTEM
 * 
 * Now handles:
 * 1. PRODUCTION RECOVERY: Stalled 'generating' projects
 * 2. STITCHING RECOVERY: Stuck 'stitching' projects
 * 3. RETRY_SCHEDULED RECOVERY: Projects waiting for retry (NEW!)
 * 4. STITCH_JOBS RECOVERY: Tracks and resumes failed stitch jobs (NEW!)
 * 5. COMPLETION GUARANTEE: Falls back to manifest after max retries
 */

interface StalledProject {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  pending_video_tasks: Record<string, unknown> | null;
  user_id: string;
  generated_script: string | null;
  stitch_attempts: number | null;
}

interface StitchJob {
  id: string;
  project_id: string;
  user_id: string;
  status: string;
  retry_after: string | null;
  attempt_number: number;
  max_attempts: number;
  last_error: string | null;
}

interface WatchdogResult {
  stalledProjects: number;
  productionResumed: number;
  stitchingRetried: number;
  retryScheduledProcessed: number;
  manifestFallbacks: number;
  projectsCompleted: number;
  projectsMarkedFailed: number;
  details: Array<{
    projectId: string;
    action: string;
    result: string;
  }>;
}

// Timeouts
const STALE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const STITCHING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_STITCHING_ATTEMPTS = 3;
const MAX_AGE_MS = 60 * 60 * 1000; // 60 minutes

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
      retryScheduledProcessed: 0,
      manifestFallbacks: 0,
      projectsCompleted: 0,
      projectsMarkedFailed: 0,
      details: [],
    };

    console.log("[Watchdog] Starting aggressive pipeline recovery check...");

    // ==================== PHASE 1: RETRY_SCHEDULED PROJECTS ====================
    // These are projects that have scheduled retries - process them first
    const now = new Date().toISOString();
    
    const { data: retryProjects } = await supabase
      .from('movie_projects')
      .select('id, title, status, updated_at, pending_video_tasks, user_id, stitch_attempts')
      .eq('status', 'retry_scheduled')
      .limit(20);
    
    for (const project of (retryProjects as StalledProject[] || [])) {
      const tasks = project.pending_video_tasks || {};
      const retryAfter = (tasks as Record<string, unknown>).retryAfter as string | undefined;
      
      // Check if retry time has passed
      if (retryAfter && new Date(retryAfter) <= new Date(now)) {
        console.log(`[Watchdog] Processing scheduled retry for ${project.id}`);
        
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
            result.retryScheduledProcessed++;
            result.details.push({
              projectId: project.id,
              action: 'retry_triggered',
              result: `Scheduled retry executed`,
            });
            console.log(`[Watchdog] ✓ Retry triggered for ${project.id}`);
          } else {
            console.error(`[Watchdog] Retry trigger failed: ${response.status}`);
          }
        } catch (error) {
          console.error(`[Watchdog] Retry trigger error:`, error);
        }
      }
    }

    // ==================== PHASE 2: STITCH_JOBS TABLE ====================
    // Check for stitch jobs that are ready for retry
    const { data: pendingJobs } = await supabase
      .from('stitch_jobs')
      .select('id, project_id, user_id, status, retry_after, attempt_number, max_attempts, last_error')
      .eq('status', 'retry_scheduled')
      .lte('retry_after', now)
      .limit(20);
    
    for (const job of (pendingJobs as StitchJob[] || [])) {
      console.log(`[Watchdog] Processing stitch job retry: ${job.id}`);
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ projectId: job.project_id, jobId: job.id }),
        });
        
        if (response.ok) {
          result.stitchingRetried++;
          result.details.push({
            projectId: job.project_id,
            action: 'stitch_job_retry',
            result: `Job ${job.id} retry ${job.attempt_number}/${job.max_attempts}`,
          });
        }
      } catch (error) {
        console.error(`[Watchdog] Stitch job retry error:`, error);
      }
    }

    // ==================== PHASE 3: STALLED PROJECTS ====================
    const cutoffTime = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString();
    
    const { data: stalledProjects, error: stalledError } = await supabase
      .from('movie_projects')
      .select('id, title, status, updated_at, pending_video_tasks, user_id, generated_script, stitch_attempts')
      .in('status', ['generating', 'stitching', 'rendering', 'assembling'])
      .lt('updated_at', cutoffTime)
      .limit(30);
    
    if (stalledError) {
      console.error("[Watchdog] Error finding stalled projects:", stalledError);
      throw stalledError;
    }

    result.stalledProjects = stalledProjects?.length || 0;
    console.log(`[Watchdog] Found ${result.stalledProjects} potentially stalled projects`);

    for (const project of (stalledProjects as StalledProject[] || [])) {
      const tasks = project.pending_video_tasks || {};
      const projectAge = Date.now() - new Date(project.updated_at).getTime();
      const stage = (tasks as Record<string, unknown>).stage || 'unknown';
      const stitchAttempts = project.stitch_attempts || 0;
      
      console.log(`[Watchdog] Processing: ${project.id} (status=${project.status}, stage=${stage}, age=${Math.round(projectAge / 1000)}s)`);

      // ==================== STUCK STITCHING ====================
      if (project.status === 'stitching' || project.status === 'assembling') {
        const stitchingStarted = (tasks as Record<string, unknown>).stitchingStarted as string | undefined;
        const stitchingAge = stitchingStarted 
          ? Date.now() - new Date(stitchingStarted).getTime()
          : projectAge;

        if (stitchingAge > STITCHING_TIMEOUT_MS) {
          if (stitchAttempts >= MAX_STITCHING_ATTEMPTS) {
            console.log(`[Watchdog] Max stitch attempts for ${project.id}, creating manifest`);
            await createManifestFallback(supabaseUrl, supabaseKey, project.id);
            result.manifestFallbacks++;
            result.details.push({
              projectId: project.id,
              action: 'manifest_fallback',
              result: `Created manifest after ${stitchAttempts} attempts`,
            });
          } else {
            console.log(`[Watchdog] Retrying stitch for ${project.id}`);
            
            await supabase
              .from('movie_projects')
              .update({
                stitch_attempts: stitchAttempts + 1,
                pending_video_tasks: {
                  ...tasks,
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
                  result: `Attempt ${stitchAttempts + 1}/${MAX_STITCHING_ATTEMPTS}`,
                });
              }
            } catch (error) {
              console.error(`[Watchdog] Stitch retry error:`, error);
            }
          }
          continue;
        }
      }

      // ==================== STUCK AT ASSETS STAGE ====================
      // This catches the case where generate-scene-images completed but hollywood-pipeline got early_drop
      if (project.status === 'generating' && stage === 'assets') {
        // Check if scene images exist in DB
        const { data: projectData } = await supabase
          .from('movie_projects')
          .select('scene_images')
          .eq('id', project.id)
          .single();
        
        const sceneImages = projectData?.scene_images;
        const hasSceneImages = sceneImages && Array.isArray(sceneImages) && sceneImages.length > 0;
        
        if (hasSceneImages) {
          console.log(`[Watchdog] Assets stage stall detected for ${project.id} - scene images exist, resuming to production`);
          
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
                resumeFrom: 'production', // Skip to production since images are done
              }),
            });
            
            if (response.ok) {
              result.productionResumed++;
              result.details.push({
                projectId: project.id,
                action: 'assets_stall_recovered',
                result: `Scene images exist, resuming to production`,
              });
              console.log(`[Watchdog] ✓ Assets stall recovered for ${project.id}`);
            }
          } catch (error) {
            console.error(`[Watchdog] Assets stall recovery error:`, error);
          }
          continue;
        } else if (projectAge > 3 * 60 * 1000) {
          // If stuck at assets for 3+ minutes with no images, retry from assets
          console.log(`[Watchdog] Assets stage stall for ${project.id} - no images, restarting assets stage`);
          
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
                resumeFrom: 'assets',
              }),
            });
            
            if (response.ok) {
              result.productionResumed++;
              result.details.push({
                projectId: project.id,
                action: 'assets_stall_restart',
                result: `No scene images after 3min, restarting assets`,
              });
            }
          } catch (error) {
            console.error(`[Watchdog] Assets restart error:`, error);
          }
          continue;
        }
      }

      // ==================== STUCK GENERATING ====================
      if (project.status === 'generating') {
        let expectedClipCount = ((tasks as Record<string, unknown>).clipCount as number) || 6;
        
        if (project.generated_script) {
          try {
            const script = JSON.parse(project.generated_script);
            if (script.shots && Array.isArray(script.shots)) {
              expectedClipCount = script.shots.length;
            }
          } catch { /* ignore */ }
        }
        
        const { data: clips } = await supabase
          .from('video_clips')
          .select('id, shot_index, status, video_url')
          .eq('project_id', project.id)
          .order('shot_index');
        
        const completedClips = (clips || []).filter((c: { status: string; video_url: string }) => 
          c.status === 'completed' && c.video_url
        );
        
        console.log(`[Watchdog] Clips: ${completedClips.length}/${expectedClipCount}`);
        
        // All done -> trigger stitch
        if (completedClips.length >= expectedClipCount) {
          console.log(`[Watchdog] All clips ready, triggering stitch`);
          
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
        
        // Incomplete -> resume production
        if (completedClips.length > 0 && completedClips.length < expectedClipCount) {
          console.log(`[Watchdog] Resuming production from clip ${completedClips.length + 1}`);
          
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
                result: `From clip ${completedClips.length + 1}/${expectedClipCount}`,
              });
            }
          } catch (error) {
            console.error(`[Watchdog] Resume error:`, error);
          }
          continue;
        }
      }

      // ==================== MAX AGE EXCEEDED ====================
      if (projectAge > MAX_AGE_MS) {
        console.log(`[Watchdog] Project ${project.id} exceeded max age`);
        
        const { data: clips } = await supabase
          .from('video_clips')
          .select('id, video_url')
          .eq('project_id', project.id)
          .eq('status', 'completed');
        
        if (clips && clips.length > 0) {
          await createManifestFallback(supabaseUrl, supabaseKey, project.id);
          result.manifestFallbacks++;
          result.details.push({
            projectId: project.id,
            action: 'max_age_manifest',
            result: `Manifest for ${clips.length} clips`,
          });
        } else {
          await supabase
            .from('movie_projects')
            .update({
              status: 'failed',
              pending_video_tasks: {
                ...tasks,
                stage: 'error',
                error: 'Pipeline exceeded maximum processing time',
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

    console.log(`[Watchdog] Complete: ${result.productionResumed} resumed, ${result.stitchingRetried} stitch retries, ${result.retryScheduledProcessed} scheduled retries, ${result.manifestFallbacks} fallbacks`);

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
 * Create manifest fallback when stitching fails
 */
async function createManifestFallback(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string
) {
  console.log(`[Watchdog] Creating manifest for ${projectId}`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: project } = await supabase
    .from('movie_projects')
    .select('title, voice_audio_url, music_url')
    .eq('id', projectId)
    .single();
  
  const { data: clips } = await supabase
    .from('video_clips')
    .select('id, video_url, duration_seconds, shot_index')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('shot_index');
  
  if (!clips || clips.length === 0) {
    console.error(`[Watchdog] No clips for manifest: ${projectId}`);
    return;
  }
  
  const totalDuration = clips.reduce((sum: number, c: { duration_seconds: number }) => sum + (c.duration_seconds || 6), 0);
  
  const manifest = {
    version: "1.0",
    projectId,
    mode: "client_side_concat",
    createdAt: new Date().toISOString(),
    source: "watchdog_fallback",
    clips: clips.map((clip: { id: string; video_url: string; duration_seconds: number }, index: number) => ({
      index,
      shotId: clip.id,
      videoUrl: clip.video_url,
      duration: clip.duration_seconds || 6,
      startTime: clips.slice(0, index).reduce((sum: number, c: { duration_seconds: number }) => sum + (c.duration_seconds || 6), 0),
    })),
    totalDuration,
    voiceUrl: (project as { voice_audio_url: string | null } | null)?.voice_audio_url || null,
    musicUrl: (project as { music_url: string | null } | null)?.music_url || null,
  };

  const fileName = `manifest_${projectId}_watchdog_${Date.now()}.json`;
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

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
        completedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  console.log(`[Watchdog] ✅ Manifest: ${manifestUrl}`);
}
