import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Pipeline Watchdog Edge Function
 * 
 * Detects and recovers stalled pipelines:
 * 1. Finds projects stuck in 'stitching' or 'rendering' status for too long
 * 2. Processes scheduled retries when their time is due
 * 3. Optionally notifies users of failed projects
 * 
 * Should be called periodically (e.g., every 5 minutes via cron)
 */

interface StalledProject {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  pending_video_tasks: Record<string, unknown> | null;
  user_id: string;
}

interface WatchdogResult {
  stalledProjects: number;
  retriesProcessed: number;
  projectsRecovered: number;
  projectsMarkedFailed: number;
  details: Array<{
    projectId: string;
    action: string;
    result: string;
  }>;
}

// Stale timeout: 10 minutes for stitching
const STALE_TIMEOUT_MS = 10 * 60 * 1000;

// Max age before marking as failed: 30 minutes
const MAX_AGE_MS = 30 * 60 * 1000;

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
      details: [],
    };

    console.log("[Watchdog] Starting pipeline health check...");

    // ==================== STEP 1: Find stalled projects ====================
    
    const cutoffTime = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString();
    const maxAgeTime = new Date(Date.now() - MAX_AGE_MS).toISOString();
    
    const { data: stalledProjects, error: stalledError } = await supabase
      .from('movie_projects')
      .select('id, title, status, updated_at, pending_video_tasks, user_id')
      .in('status', ['stitching', 'rendering', 'retry_scheduled'])
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
      
      console.log(`[Watchdog] Processing project ${project.id} (status: ${project.status}, age: ${Math.round(projectAge / 1000)}s)`);

      // Check if this is a scheduled retry that's ready
      if (project.status === 'retry_scheduled' && tasks.retryAfter) {
        const retryTime = new Date(tasks.retryAfter as string).getTime();
        
        if (Date.now() >= retryTime) {
          console.log(`[Watchdog] Retry time reached for project ${project.id}`);
          
          // Trigger the retry by calling stitch-video again
          const retryAttempt = (tasks.retryAttempt as number) || 1;
          
          if (retryAttempt <= 3) {
            try {
              const response = await fetch(`${supabaseUrl}/functions/v1/stitch-video`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  ...(tasks.retryRequest || {}),
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
          // Retry not yet due, skip
          result.details.push({
            projectId: project.id,
            action: 'retry_pending',
            result: `Retry scheduled for ${tasks.retryAfter}`,
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
              error: 'Pipeline stalled - exceeded maximum processing time',
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
          result: 'Exceeded max processing time (30 min)',
        });
        continue;
      }

      // Try to recover by re-triggering stitching
      if (project.status === 'stitching') {
        console.log(`[Watchdog] Attempting to recover stalled stitching for ${project.id}`);
        
        // Get clips from video_clips table
        const { data: clips } = await supabase
          .from('video_clips')
          .select('id, video_url, duration_seconds, shot_index')
          .eq('project_id', project.id)
          .eq('status', 'completed')
          .order('shot_index');
        
        if (clips && clips.length > 0) {
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/stitch-video`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                projectId: project.id,
                projectTitle: project.title,
                clips: clips.map(c => ({
                  shotId: c.id,
                  videoUrl: c.video_url,
                  durationSeconds: c.duration_seconds || 4,
                })),
                audioMixMode: 'full',
                retryAttempt: ((tasks.retryAttempt as number) || 0) + 1,
              }),
            });
            
            if (response.ok) {
              result.projectsRecovered++;
              result.details.push({
                projectId: project.id,
                action: 'recovery_triggered',
                result: 'Stitch re-triggered',
              });
            } else {
              result.details.push({
                projectId: project.id,
                action: 'recovery_failed',
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
          // No clips to stitch
          result.details.push({
            projectId: project.id,
            action: 'no_clips',
            result: 'No completed clips found to stitch',
          });
        }
      }
    }

    console.log(`[Watchdog] Complete: ${result.projectsRecovered} recovered, ${result.projectsMarkedFailed} marked failed`);

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
