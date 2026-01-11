import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Pipeline Watchdog Edge Function
 * 
 * Detects and AUTO-RECOVERS stalled pipelines:
 * 1. Finds projects stuck in 'generating' status with incomplete clips
 * 2. Finds projects stuck in 'stitching' or 'rendering' status for too long
 * 3. Auto-resumes production when clips are missing
 * 4. Processes scheduled retries when their time is due
 * 
 * Should be called every 2 minutes via cron
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

interface WatchdogResult {
  stalledProjects: number;
  retriesProcessed: number;
  projectsRecovered: number;
  projectsMarkedFailed: number;
  productionResumed: number;
  details: Array<{
    projectId: string;
    action: string;
    result: string;
  }>;
}

// Stale timeout: 3 minutes for generating/stitching (edge functions timeout at ~60s)
const STALE_TIMEOUT_MS = 3 * 60 * 1000;

// Max age before marking as failed: 45 minutes
const MAX_AGE_MS = 45 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const result: WatchdogResult = {
      stalledProjects: 0,
      retriesProcessed: 0,
      projectsRecovered: 0,
      projectsMarkedFailed: 0,
      productionResumed: 0,
      details: [],
    };

    console.log("[Watchdog] Starting pipeline health check...");

    // ==================== STEP 1: Find stalled projects ====================
    
    const cutoffTime = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString();
    const maxAgeTime = new Date(Date.now() - MAX_AGE_MS).toISOString();
    
    // Include 'generating' status - this is the key fix!
    const { data: stalledProjects, error: stalledError } = await supabase
      .from('movie_projects')
      .select('id, title, status, updated_at, pending_video_tasks, user_id, generated_script')
      .in('status', ['generating', 'stitching', 'rendering', 'retry_scheduled', 'assembling'])
      .lt('updated_at', cutoffTime)
      .limit(20);
    
    if (stalledError) {
      console.error("[Watchdog] Error finding stalled projects:", stalledError);
      throw stalledError;
    }

    result.stalledProjects = stalledProjects?.length || 0;
    console.log(`[Watchdog] Found ${result.stalledProjects} potentially stalled projects`);

    // ==================== STEP 2: Process each stalled project ====================
    
    for (const project of (stalledProjects as StalledProject[] || [])) {
      const tasks = project.pending_video_tasks || {};
      const projectAge = Date.now() - new Date(project.updated_at).getTime();
      
      console.log(`[Watchdog] Processing project ${project.id} (status: ${project.status}, stage: ${(tasks as any).stage}, age: ${Math.round(projectAge / 1000)}s)`);

      // Check if this is a scheduled retry that's ready
      if (project.status === 'retry_scheduled' && (tasks as any).retryAfter) {
        const retryTime = new Date((tasks as any).retryAfter as string).getTime();
        
        if (Date.now() >= retryTime) {
          console.log(`[Watchdog] Retry time reached for project ${project.id}`);
          
          const retryAttempt = ((tasks as any).retryAttempt as number) || 1;
          
          if (retryAttempt <= 3) {
            try {
              const response = await fetch(`${supabaseUrl}/functions/v1/stitch-video`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  ...((tasks as any).retryRequest || {}),
                  projectId: project.id,
                  retryAttempt,
                }),
              });
              
              if (response.ok) {
                result.retriesProcessed++;
                result.details.push({
                  projectId: project.id,
                  action: 'retry_triggered',
                  result: `Retry ${retryAttempt} started`,
                });
                continue;
              }
            } catch (retryError) {
              console.error(`[Watchdog] Failed to trigger retry for ${project.id}:`, retryError);
            }
          }
        } else {
          result.details.push({
            projectId: project.id,
            action: 'retry_pending',
            result: `Retry scheduled for ${(tasks as any).retryAfter}`,
          });
          continue;
        }
      }

      // Check if project is too old and should be marked as failed
      if (projectAge > MAX_AGE_MS) {
        console.log(`[Watchdog] Project ${project.id} exceeded max age, marking as failed`);
        
        await supabase
          .from('movie_projects')
          .update({
            status: 'failed',
            pending_video_tasks: {
              ...tasks,
              stage: 'error',
              error: 'Pipeline stalled - exceeded maximum processing time (45 min)',
              watchdogRecovery: true,
              recoveredAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id);
        
        result.projectsMarkedFailed++;
        result.details.push({
          projectId: project.id,
          action: 'marked_failed',
          result: 'Exceeded max processing time (45 min)',
        });
        continue;
      }

      // ==================== NEW: Handle stalled 'generating' projects ====================
      if (project.status === 'generating') {
        console.log(`[Watchdog] Checking clip completion for stalled generating project ${project.id}`);
        
        // Parse script to get expected clip count
        let expectedClipCount = (tasks as any).clipCount || 6;
        
        if (project.generated_script) {
          try {
            const script = JSON.parse(project.generated_script);
            if (script.shots && Array.isArray(script.shots)) {
              expectedClipCount = script.shots.length;
            }
          } catch (e) {
            console.log(`[Watchdog] Could not parse script, using default clip count`);
          }
        }
        
        // Get clip status
        const { data: clips, error: clipsError } = await supabase
          .from('video_clips')
          .select('id, shot_index, status, video_url')
          .eq('project_id', project.id)
          .order('shot_index');
        
        if (clipsError) {
          console.error(`[Watchdog] Error fetching clips for ${project.id}:`, clipsError);
          continue;
        }
        
        const completedClips = clips?.filter(c => c.status === 'completed' && c.video_url) || [];
        const pendingClips = clips?.filter(c => c.status === 'pending' || c.status === 'generating') || [];
        const failedClips = clips?.filter(c => c.status === 'failed') || [];
        
        console.log(`[Watchdog] Project ${project.id}: ${completedClips.length}/${expectedClipCount} clips completed, ${pendingClips.length} pending, ${failedClips.length} failed`);
        
        // If we have incomplete clips and the pipeline stalled, resume it
        if (completedClips.length < expectedClipCount && completedClips.length > 0) {
          console.log(`[Watchdog] Auto-resuming production for project ${project.id} from clip ${completedClips.length + 1}`);
          
          try {
            const resumeResponse = await fetch(`${supabaseUrl}/functions/v1/resume-pipeline`, {
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
            
            if (resumeResponse.ok) {
              result.productionResumed++;
              result.details.push({
                projectId: project.id,
                action: 'production_resumed',
                result: `Auto-resumed from clip ${completedClips.length + 1}/${expectedClipCount}`,
              });
              console.log(`[Watchdog] ✓ Successfully resumed production for ${project.id}`);
            } else {
              const errorText = await resumeResponse.text();
              console.error(`[Watchdog] Failed to resume production for ${project.id}:`, errorText);
              result.details.push({
                projectId: project.id,
                action: 'resume_failed',
                result: `Resume failed: ${resumeResponse.status}`,
              });
            }
          } catch (resumeError) {
            console.error(`[Watchdog] Resume error for ${project.id}:`, resumeError);
            result.details.push({
              projectId: project.id,
              action: 'resume_error',
              result: resumeError instanceof Error ? resumeError.message : 'Unknown error',
            });
          }
          continue;
        }
        
        // If all clips are complete but project is still 'generating', trigger stitching
        if (completedClips.length >= expectedClipCount) {
          console.log(`[Watchdog] All ${completedClips.length} clips complete for ${project.id}, triggering stitch`);
          
          try {
            // Get project audio info
            const { data: projectData } = await supabase
              .from('movie_projects')
              .select('voice_audio_url, music_url')
              .eq('id', project.id)
              .single();
            
            const stitchResponse = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                projectId: project.id,
              }),
            });
            
            if (stitchResponse.ok) {
              result.projectsRecovered++;
              result.details.push({
                projectId: project.id,
                action: 'stitch_triggered',
                result: `All ${completedClips.length} clips ready, stitch started`,
              });
              console.log(`[Watchdog] ✓ Triggered stitch for ${project.id}`);
            } else {
              result.details.push({
                projectId: project.id,
                action: 'stitch_failed',
                result: `Stitch trigger failed: ${stitchResponse.status}`,
              });
            }
          } catch (stitchError) {
            console.error(`[Watchdog] Stitch error for ${project.id}:`, stitchError);
          }
          continue;
        }
      }

      // Handle stalled stitching
      if (project.status === 'stitching' || project.status === 'assembling') {
        console.log(`[Watchdog] Attempting to recover stalled stitching for ${project.id}`);
        
        const { data: clips } = await supabase
          .from('video_clips')
          .select('id, video_url, duration_seconds, shot_index')
          .eq('project_id', project.id)
          .eq('status', 'completed')
          .order('shot_index');
        
        if (clips && clips.length > 0) {
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                projectId: project.id,
              }),
            });
            
            if (response.ok) {
              result.projectsRecovered++;
              result.details.push({
                projectId: project.id,
                action: 'stitch_recovery_triggered',
                result: 'Stitch re-triggered',
              });
            } else {
              result.details.push({
                projectId: project.id,
                action: 'stitch_recovery_failed',
                result: `Stitch trigger failed: ${response.status}`,
              });
            }
          } catch (recoveryError) {
            console.error(`[Watchdog] Recovery failed for ${project.id}:`, recoveryError);
            result.details.push({
              projectId: project.id,
              action: 'recovery_error',
              result: recoveryError instanceof Error ? recoveryError.message : 'Unknown error',
            });
          }
        } else {
          result.details.push({
            projectId: project.id,
            action: 'no_clips',
            result: 'No completed clips found to stitch',
          });
        }
      }
    }

    console.log(`[Watchdog] Complete: ${result.productionResumed} production resumed, ${result.projectsRecovered} recovered, ${result.projectsMarkedFailed} marked failed`);

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
