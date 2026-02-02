import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  GUARD_RAIL_CONFIG,
  checkAndRecoverStaleMutex,
  detectStuckClips,
  checkPipelineHealth,
  getGuaranteedLastFrame,
  isValidImageUrl,
  recoverAllStuckClips,
  findOrphanedVideo,
  recoverStuckClip,
  releaseStaleCompletedLock,
  verifyAllStuckPredictions,
} from "../_shared/pipeline-guard-rails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Pipeline Watchdog Edge Function v4.0 - GUARD RAILS INTEGRATED
 * 
 * Now handles:
 * 1. AUTOMATIC MUTEX RECOVERY: Releases stale locks proactively
 * 2. CLIP 0 FRAME GUARANTEE: Ensures Clip 0 always has reference image as last_frame
 * 3. STUCK CLIP DETECTION: Uses guard rail detection for comprehensive recovery
 * 4. PRODUCTION RECOVERY: Stalled 'generating' projects
 * 5. STITCHING RECOVERY: Stuck 'stitching' projects
 * 6. COMPLETION GUARANTEE: Falls back to manifest after max retries
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
  generation_lock: Record<string, unknown> | null;
  pro_features_data: Record<string, unknown> | null;
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
  mutexesReleased: number;
  clip0FramesFixed: number;
  stuckClipsRecovered: number;
  details: Array<{
    projectId: string;
    action: string;
    result: string;
  }>;
}

// Timeouts - use guard rail config where applicable
const STALE_TIMEOUT_MS = GUARD_RAIL_CONFIG.CLIP_STUCK_THRESHOLD_MS; // 3 minutes
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
      mutexesReleased: 0,
      clip0FramesFixed: 0,
      stuckClipsRecovered: 0,
      details: [],
    };

    console.log("[Watchdog] Starting v4.1 pipeline recovery with guard rails...");

    // ==================== PHASE 0a: ORPHANED AVATAR COMPLETION RECOVERY ====================
    // CRITICAL FIX: Detect avatar projects where DB write failed but videos exist in storage
    // This catches the "connection closed before message completed" scenario
    const AVATAR_STUCK_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes (reduced for faster recovery)
    
    const { data: avatarStuckProjects } = await supabase
      .from('movie_projects')
      .select('id, title, status, mode, updated_at, user_id, pipeline_state, source_image_url, avatar_voice_id, synopsis')
      .eq('status', 'generating')
      .eq('mode', 'avatar')
      .lt('updated_at', new Date(Date.now() - AVATAR_STUCK_THRESHOLD_MS).toISOString())
      .limit(20);
    
    for (const project of (avatarStuckProjects || [])) {
      const projectAge = Date.now() - new Date(project.updated_at).getTime();
      const pipelineState = project.pipeline_state as Record<string, any> || {};
      
      console.log(`[Watchdog] 🎭 Avatar project ${project.id}: age=${Math.round(projectAge / 1000)}s, stage=${pipelineState.stage || 'unknown'}`);
      
      // ═══════════════════════════════════════════════════════════════════════════
      // PRIORITY 1: Check for orphan completion marker (DB write failed but generation succeeded)
      // ═══════════════════════════════════════════════════════════════════════════
      try {
        const markerPath = `avatar-videos/${project.id}/_completion_marker.json`;
        const { data: markerData } = await supabase.storage
          .from('video-clips')
          .download(markerPath);
        
        if (markerData) {
          const markerText = await markerData.text();
          const completionData = JSON.parse(markerText);
          
          console.log(`[Watchdog] 🎯 ORPHAN MARKER FOUND for ${project.id} - recovering from DB failure`);
          
          // Recover the project using the completion marker data
          const { error: recoveryError } = await supabase
            .from('movie_projects')
            .update({
              status: 'completed',
              video_url: completionData.videoUrl,
              final_video_url: completionData.videoUrl,
              voice_audio_url: completionData.audioUrl,
              video_clips: completionData.clips || [],
              pipeline_stage: 'completed',
              pipeline_state: {
                stage: 'completed',
                progress: 100,
                message: 'Recovered from orphaned completion',
                completedAt: completionData.completedAt,
                recoveredByWatchdog: true,
                recoveredAt: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          if (!recoveryError) {
            // Delete the marker after successful recovery
            await supabase.storage
              .from('video-clips')
              .remove([markerPath]);
            
            result.productionResumed++;
            result.details.push({
              projectId: project.id,
              action: 'orphan_completion_recovered',
              result: `DB failure recovered via completion marker`,
            });
            console.log(`[Watchdog] ✅ ORPHAN RECOVERY SUCCESS for ${project.id}`);
            continue; // Skip other recovery attempts
          }
        }
      } catch (markerError) {
        // No marker found, continue with normal recovery
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // PRIORITY 2: Check if video files exist in storage even without marker
      // ═══════════════════════════════════════════════════════════════════════════
      try {
        const { data: storageFiles } = await supabase.storage
          .from('video-clips')
          .list(`avatar-videos/${project.id}`, { limit: 10 });
        
        const videoFiles = (storageFiles || []).filter(f => f.name.endsWith('.mp4'));
        const audioFiles = (storageFiles || []).filter(f => f.name.includes('master_audio') || f.name.endsWith('.mp3'));
        
        if (videoFiles.length > 0) {
          console.log(`[Watchdog] 📁 Found ${videoFiles.length} video(s) in storage for ${project.id}`);
          
          // Video exists! Recover from storage
          const videoUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/avatar-videos/${project.id}/${videoFiles[0].name}`;
          const audioUrl = audioFiles.length > 0 
            ? `${supabaseUrl}/storage/v1/object/public/video-clips/avatar-videos/${project.id}/${audioFiles[0].name}`
            : null;
          
          const { error: storageRecoveryError } = await supabase
            .from('movie_projects')
            .update({
              status: 'completed',
              video_url: videoUrl,
              final_video_url: videoUrl,
              voice_audio_url: audioUrl,
              video_clips: videoFiles.map(f => `${supabaseUrl}/storage/v1/object/public/video-clips/avatar-videos/${project.id}/${f.name}`),
              pipeline_stage: 'completed',
              pipeline_state: {
                stage: 'completed',
                progress: 100,
                message: 'Recovered from storage',
                recoveredByWatchdog: true,
                recoveredAt: new Date().toISOString(),
                recoverySource: 'storage_scan',
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          if (!storageRecoveryError) {
            result.productionResumed++;
            result.details.push({
              projectId: project.id,
              action: 'storage_recovery',
              result: `Recovered ${videoFiles.length} video(s) from storage`,
            });
            console.log(`[Watchdog] ✅ STORAGE RECOVERY SUCCESS for ${project.id}`);
            continue;
          }
        }
      } catch (storageError) {
        console.warn(`[Watchdog] Storage scan failed for ${project.id}:`, storageError);
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // PRIORITY 3: Standard retry/fail logic (no videos found)
      // ═══════════════════════════════════════════════════════════════════════════
      const retryCount = pipelineState.watchdogRetryCount || 0;
      const MAX_AVATAR_RETRIES = 2;
      
      if (retryCount < MAX_AVATAR_RETRIES && project.source_image_url) {
        console.log(`[Watchdog] 🔄 Retrying avatar pipeline for ${project.id} (attempt ${retryCount + 1}/${MAX_AVATAR_RETRIES})`);
        
        try {
          await supabase
            .from('movie_projects')
            .update({
              pipeline_state: {
                ...pipelineState,
                watchdogRetryCount: retryCount + 1,
                lastRetryAt: new Date().toISOString(),
                stage: 'retrying',
                progress: 5,
                message: `Retrying generation (attempt ${retryCount + 2})...`,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          const response = await fetch(`${supabaseUrl}/functions/v1/generate-avatar-direct`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              projectId: project.id,
              userId: project.user_id,
              avatarImageUrl: project.source_image_url,
              voiceId: project.avatar_voice_id || 'bella',
              script: project.synopsis || 'Hello, I am your AI avatar.',
              clipCount: pipelineState.totalClips || 1,
            }),
          });
          
          if (response.ok) {
            result.productionResumed++;
            result.details.push({
              projectId: project.id,
              action: 'avatar_pipeline_retry',
              result: `Retry ${retryCount + 1}/${MAX_AVATAR_RETRIES}`,
            });
            console.log(`[Watchdog] ✅ Avatar pipeline retry triggered for ${project.id}`);
          } else {
            console.error(`[Watchdog] Avatar retry failed: ${response.status}`);
          }
        } catch (error) {
          console.error(`[Watchdog] Avatar retry error:`, error);
        }
      } else {
        // MAX RETRIES EXCEEDED: Mark as failed and refund credits
        console.log(`[Watchdog] ❌ Avatar project ${project.id} failed after ${retryCount} retries - marking failed`);
        
        await supabase
          .from('movie_projects')
          .update({
            status: 'failed',
            pipeline_state: {
              ...pipelineState,
              stage: 'error',
              error: 'Avatar generation failed - no video produced',
              failedAt: new Date().toISOString(),
              watchdogFailure: true,
            },
            pending_video_tasks: {
              stage: 'error',
              error: 'Avatar generation timed out',
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id);
        
        // Refund credits
        try {
          const estimatedCredits = (pipelineState.totalClips || 1) * 10;
          await supabase.rpc('increment_credits', {
            user_id_param: project.user_id,
            amount_param: estimatedCredits,
          });
          
          await supabase.from('credit_transactions').insert({
            user_id: project.user_id,
            amount: estimatedCredits,
            transaction_type: 'refund',
            description: `Auto-refund: Avatar generation failed (${project.title || project.id})`,
            project_id: project.id,
          });
          
          console.log(`[Watchdog] 💰 Refunded ${estimatedCredits} credits to user ${project.user_id}`);
        } catch (refundError) {
          console.error(`[Watchdog] Credit refund failed:`, refundError);
        }
        
        result.projectsMarkedFailed++;
        result.details.push({
          projectId: project.id,
          action: 'avatar_marked_failed',
          result: `No video after ${Math.round(projectAge / 60000)} minutes, credits refunded`,
        });
      }
    }

    // ==================== PHASE 0b: GLOBAL MUTEX SWEEP ====================
    // Find and release ALL stale mutexes across all generating projects
    const { data: lockedProjects } = await supabase
      .from('movie_projects')
      .select('id, generation_lock, pro_features_data')
      .eq('status', 'generating')
      .not('generation_lock', 'is', null)
      .limit(50);
    
    for (const project of (lockedProjects || [])) {
      // CRITICAL FIX: First check if the locked clip is already completed
      // This catches the case where clip completed but function timed out before releasing lock
      const completedLockResult = await releaseStaleCompletedLock(supabase, project.id);
      if (completedLockResult.released) {
        result.mutexesReleased++;
        result.details.push({
          projectId: project.id,
          action: 'completed_clip_lock_released',
          result: `Released lock from completed clip ${completedLockResult.completedClip}`,
        });
        console.log(`[Watchdog] 🔓 CRITICAL FIX: Released stale lock from COMPLETED clip ${completedLockResult.completedClip} for ${project.id}`);
        continue; // Skip to next project - lock is now released
      }
      
      // Standard stale lock check (for clips still generating too long)
      const mutexResult = await checkAndRecoverStaleMutex(supabase, project.id);
      if (mutexResult.wasStale) {
        result.mutexesReleased++;
        result.details.push({
          projectId: project.id,
          action: 'mutex_released',
          result: `Released stale lock from clip ${mutexResult.releasedClip}`,
        });
        console.log(`[Watchdog] 🔓 Released stale mutex for ${project.id} (clip ${mutexResult.releasedClip})`);
      }
    }

    // ==================== PHASE 0.5: CLIP 0 FRAME GUARANTEE ====================
    // Ensure all Clip 0s have last_frame_url set to reference image
    const { data: projectsWithClips } = await supabase
      .from('movie_projects')
      .select('id, pro_features_data')
      .eq('status', 'generating')
      .limit(30);
    
    for (const project of (projectsWithClips || [])) {
      const { data: clip0 } = await supabase
        .from('video_clips')
        .select('id, last_frame_url, video_url, status')
        .eq('project_id', project.id)
        .eq('shot_index', 0)
        .maybeSingle();
      
      // If Clip 0 is completed but missing last_frame_url, fix it
      if (clip0 && clip0.status === 'completed' && !clip0.last_frame_url) {
        const proFeatures = project.pro_features_data as Record<string, any> || {};
        const referenceImageUrl = proFeatures.referenceAnalysis?.imageUrl 
          || proFeatures.identityBible?.originalReferenceUrl;
        
        if (referenceImageUrl && isValidImageUrl(referenceImageUrl)) {
          await supabase
            .from('video_clips')
            .update({ 
              last_frame_url: referenceImageUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', clip0.id);
          
          result.clip0FramesFixed++;
          result.details.push({
            projectId: project.id,
            action: 'clip0_frame_fixed',
            result: `Set last_frame_url to reference image`,
          });
          console.log(`[Watchdog] ✓ Fixed Clip 0 last_frame for ${project.id}`);
        }
      }
    }

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

    // ==================== PHASE 2.5: CALLBACK STALL RECOVERY ====================
    // Detect projects where generate-single-clip failed to trigger continue-production
    // These have needsWatchdogResume=true set by the callback retry failure handler
    const { data: callbackStallProjects } = await supabase
      .from('movie_projects')
      .select('id, title, status, updated_at, pending_video_tasks, user_id, generated_script')
      .eq('status', 'generating')
      .limit(50);
    
    for (const project of (callbackStallProjects || [])) {
      const tasks = (project.pending_video_tasks || {}) as Record<string, any>;
      
      if (tasks.needsWatchdogResume) {
        const lastCompletedClip = tasks.lastCompletedClip ?? -1;
        console.log(`[Watchdog] 🔧 CALLBACK STALL detected for ${project.id} - last completed: ${lastCompletedClip + 1}`);
        
        try {
          // Clear the flag and resume
          await supabase
            .from('movie_projects')
            .update({
              pending_video_tasks: {
                ...tasks,
                needsWatchdogResume: false,
                watchdogResumedAt: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          // Trigger continue-production to resume from where it stalled
          const response = await fetch(`${supabaseUrl}/functions/v1/continue-production`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              projectId: project.id,
              userId: project.user_id,
              completedClipIndex: lastCompletedClip,
              totalClips: tasks.clipCount || 5,
            }),
          });
          
          if (response.ok) {
            result.productionResumed++;
            result.details.push({
              projectId: project.id,
              action: 'callback_stall_recovered',
              result: `Resumed from clip ${lastCompletedClip + 2}`,
            });
            console.log(`[Watchdog] ✓ Callback stall recovered for ${project.id}`);
          }
        } catch (error) {
          console.error(`[Watchdog] Callback stall recovery error:`, error);
        }
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
          .select('id, shot_index, status, video_url, veo_operation_name, updated_at')
          .eq('project_id', project.id)
          .order('shot_index');
        
        const completedClips = (clips || []).filter((c: { status: string; video_url: string }) => 
          c.status === 'completed' && c.video_url
        );
        
        // ==================== RECOVER STUCK CLIPS ====================
        // GUARD RAIL: Two-pronged recovery approach
        // 1. Check storage for orphaned videos (DB update failed after upload)
        // 2. Check Replicate predictions for clips that timed out during polling
        
        const proFeatures = project.pro_features_data as Record<string, any> || {};
        const referenceImageUrl = proFeatures.referenceAnalysis?.imageUrl 
          || proFeatures.identityBible?.originalReferenceUrl;
        
        // First: Try to recover ALL stuck clips using storage scan
        const storageRecovery = await recoverAllStuckClips(
          supabase, 
          project.id, 
          referenceImageUrl
        );
        
        if (storageRecovery.recoveredCount > 0) {
          result.stuckClipsRecovered += storageRecovery.recoveredCount;
          console.log(`[Watchdog] 🔧 Storage scan recovered ${storageRecovery.recoveredCount} clips`);
          for (const detail of storageRecovery.details) {
            result.details.push({
              projectId: project.id,
              action: 'storage_recovery',
              result: `Clip ${detail.clipIndex + 1}: ${detail.result}`,
            });
          }
        }
        
        // Second: Find remaining stuck clips with prediction IDs
        const stuckClips = (clips || []).filter((c: { status: string; veo_operation_name: string | null; updated_at: string }) => 
          (c.status === 'generating' || c.status === 'pending') && 
          c.veo_operation_name &&
          (Date.now() - new Date(c.updated_at).getTime() > 60000) // Stuck for 1+ minute
        );
        
        if (stuckClips.length > 0) {
          console.log(`[Watchdog] Found ${stuckClips.length} stuck clips with prediction IDs - attempting Replicate recovery`);
          
          for (const clip of stuckClips) {
            try {
              // First: Check if video already exists in storage (faster than Replicate API)
              const orphanedResult = await findOrphanedVideo(supabase, project.id, clip.shot_index);
              
              if (orphanedResult.found && orphanedResult.videoUrl) {
                // Recover from storage directly
                await recoverStuckClip(
                  supabase,
                  project.id,
                  clip.shot_index,
                  clip.id,
                  referenceImageUrl
                );
                
                console.log(`[Watchdog] ✓ Recovered clip ${clip.shot_index + 1} from storage`);
                result.details.push({
                  projectId: project.id,
                  action: 'clip_recovered_storage',
                  result: `Clip ${clip.shot_index + 1} recovered from orphaned storage file`,
                });
                continue;
              }
              
              console.log(`[Watchdog] Checking Replicate prediction ${clip.veo_operation_name} for clip ${clip.shot_index + 1}...`);
              
              // Call check-video-status with autoComplete=true to recover the clip
              const response = await fetch(`${supabaseUrl}/functions/v1/check-video-status`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  taskId: clip.veo_operation_name,
                  provider: 'replicate',
                  projectId: project.id,
                  userId: project.user_id,
                  shotIndex: clip.shot_index,
                  autoComplete: true, // This will store the video and update the clip record
                }),
              });
              
              if (response.ok) {
                const statusResult = await response.json();
                if (statusResult.status === 'SUCCEEDED' && statusResult.autoCompleted) {
                  console.log(`[Watchdog] ✓ Recovered clip ${clip.shot_index + 1} from Replicate`);
                  result.stuckClipsRecovered++;
                  result.details.push({
                    projectId: project.id,
                    action: 'clip_recovered_replicate',
                    result: `Clip ${clip.shot_index + 1} auto-completed from prediction ${clip.veo_operation_name}`,
                  });
                } else if (statusResult.status === 'FAILED') {
                  console.log(`[Watchdog] Clip ${clip.shot_index + 1} prediction failed: ${statusResult.error}`);
                  
                  // Mark clip as failed so it can be retried
                  await supabase
                    .from('video_clips')
                    .update({
                      status: 'failed',
                      error_message: statusResult.error || 'Replicate prediction failed',
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', clip.id);
                } else if (statusResult.status === 'RUNNING' || statusResult.status === 'STARTING') {
                  console.log(`[Watchdog] Clip ${clip.shot_index + 1} still processing`);
                }
              }
            } catch (recoverError) {
              console.error(`[Watchdog] Clip recovery error:`, recoverError);
            }
          }
        }
        
        // Re-fetch clips after recovery attempt
        const { data: updatedClips } = await supabase
          .from('video_clips')
          .select('id, shot_index, status, video_url')
          .eq('project_id', project.id)
          .order('shot_index');
        
        const newCompletedCount = (updatedClips || []).filter((c: { status: string; video_url: string }) => 
          c.status === 'completed' && c.video_url
        ).length;
        
        console.log(`[Watchdog] After recovery: ${newCompletedCount}/${expectedClipCount} clips`);
        
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
