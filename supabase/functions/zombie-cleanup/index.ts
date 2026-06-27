import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireCronSecret } from "../_shared/auth-guard.ts";

/**
 * Zombie Process Cleanup v1.0
 * 
 * Watcher utility that identifies tasks stuck in 'Processing' state
 * for more than 5 minutes, automatically transitions them to 'Failed',
 * and triggers Credit Refund logic.
 * 
 * Run on a schedule (e.g., every 5 minutes via cron or external trigger)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Timeouts
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const MAX_AGE_FOR_REFUND_MS = 2 * 60 * 60 * 1000; // 2 hours (no refund for very old projects)

interface ZombieReport {
  zombiesFound: number;
  projectsFailed: number;
  clipsFailed: number;
  creditsRefunded: number;
  details: Array<{
    entityType: 'project' | 'clip';
    entityId: string;
    userId: string;
    stuckDuration: number;
    action: string;
    refundAmount: number;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (!requireCronSecret(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const report: ZombieReport = {
      zombiesFound: 0,
      projectsFailed: 0,
      clipsFailed: 0,
      creditsRefunded: 0,
      details: [],
    };

    console.log("[ZombieCleanup] Starting zombie process scan...");
    const cutoffTime = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();
    const refundCutoff = new Date(Date.now() - MAX_AGE_FOR_REFUND_MS).toISOString();

    // ==================== PHASE 0: STALLED AVATAR PIPELINES ====================
    // Avatar projects stuck at any pipeline stage (audio_merge, video_rendering, etc.)
    const { data: stalledAvatarProjects, error: avatarError } = await supabase
      .from('movie_projects')
      .select('id, user_id, title, status, updated_at, pipeline_state, mode, created_at, pending_video_tasks')
      .eq('status', 'generating')
      .eq('mode', 'avatar')
      .lt('updated_at', cutoffTime)
      .order('updated_at', { ascending: true })
      .limit(30);

    if (avatarError) {
      console.error("[ZombieCleanup] Error fetching stalled avatar projects:", avatarError);
    }

    for (const project of (stalledAvatarProjects || [])) {
      const stuckDuration = Date.now() - new Date(project.updated_at).getTime();
      const pipelineState = (project.pipeline_state || {}) as Record<string, unknown>;
      const stage = pipelineState.stage as string;
      
      console.log(`[ZombieCleanup] Found stalled avatar project: ${project.id} at stage '${stage}' (stuck ${Math.round(stuckDuration / 1000)}s)`);
      report.zombiesFound++;
      
      // Check if we have assets to recover (audio_merge stage has both video and audio)
      const hasVideoUrl = !!pipelineState.videoUrl;
      const hasAudioUrl = !!pipelineState.audioUrl;
      
      if ((stage === 'audio_merge') && hasVideoUrl) {
        // RECOVERY PATH: Kling V3 native audio — video already has audio baked in
        // No separate audio merge needed. Use video as-is.
        console.log(`[ZombieCleanup] Kling V3 recovery for ${project.id} (stage: ${stage})`);
        
        try {
          const videoUrl = pipelineState.videoUrl as string;
          const audioUrl = pipelineState.audioUrl as string | undefined;
          const finalVideoUrl = videoUrl;
              
          // Mark project as completed with the video
          await supabase.from('movie_projects').update({
            status: 'completed',
            video_url: finalVideoUrl,
            voice_audio_url: audioUrl || null,
            pipeline_state: {
              ...pipelineState,
              stage: 'completed',
              progress: 100,
              message: 'Video recovered by zombie cleanup (Kling V3 native audio)',
              completedAt: new Date().toISOString(),
              recoveredBy: 'zombie-cleanup',
              engine: 'kwaivgi/kling-v3-video',
            },
            updated_at: new Date().toISOString(),
          }).eq('id', project.id);
              
          report.projectsFailed++;
          report.details.push({
            entityType: 'project',
            entityId: project.id,
            userId: project.user_id,
            stuckDuration: Math.round(stuckDuration / 1000),
            action: 'recovered_kling_v3_native',
            refundAmount: 0,
          });
          continue;
        } catch (recoveryError) {
          console.warn(`[ZombieCleanup] Recovery failed for ${project.id}:`, recoveryError);
        }
        
        // Recovery failed - complete with video-only
        const videoUrl = pipelineState.videoUrl as string;
        await supabase.from('movie_projects').update({
          status: 'completed',
          video_url: videoUrl,
          voice_audio_url: pipelineState.audioUrl as string,
          pipeline_state: {
            ...pipelineState,
            stage: 'completed',
            progress: 100,
            message: 'Video completed (audio sync skipped)',
            completedAt: new Date().toISOString(),
            recoveredBy: 'zombie-cleanup-fallback',
          },
          updated_at: new Date().toISOString(),
        }).eq('id', project.id);
        
        report.projectsFailed++;
        report.details.push({
          entityType: 'project',
          entityId: project.id,
          userId: project.user_id,
          stuckDuration: Math.round(stuckDuration / 1000),
          action: 'completed_video_only',
          refundAmount: 0,
        });
        continue;
      }
      
      if (stage === 'video_rendering' && hasAudioUrl) {
        // Video rendering stalled - check if Replicate prediction is still running
        const predictionId = pipelineState.predictionId as string;
        if (predictionId) {
          const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
          if (REPLICATE_API_KEY) {
            try {
              const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
                headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
              });
              const prediction = await statusRes.json();
              
              if (prediction.status === "succeeded" && prediction.output) {
                // Video is ready! Complete the project
                const videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
                console.log(`[ZombieCleanup] ✅ Found completed prediction for ${project.id}`);
                
                await supabase.from('movie_projects').update({
                  status: 'completed',
                  video_url: videoUrl,
                  voice_audio_url: pipelineState.audioUrl as string,
                  pipeline_state: {
                    ...pipelineState,
                    stage: 'completed',
                    progress: 100,
                    videoUrl,
                    message: 'Video recovered from completed prediction',
                    completedAt: new Date().toISOString(),
                    recoveredBy: 'zombie-cleanup-prediction',
                  },
                  updated_at: new Date().toISOString(),
                }).eq('id', project.id);
                
                report.projectsFailed++;
                report.details.push({
                  entityType: 'project',
                  entityId: project.id,
                  userId: project.user_id,
                  stuckDuration: Math.round(stuckDuration / 1000),
                  action: 'recovered_from_prediction',
                  refundAmount: 0,
                });
                continue;
              }
            } catch (predError) {
              console.warn(`[ZombieCleanup] Prediction check failed for ${project.id}:`, predError);
            }
          }
        }
      }
      
      // ══════════════════════════════════════════════════════════════════════════
      // CRITICAL: Check multi-clip async predictions before giving up
      // ══════════════════════════════════════════════════════════════════════════
      // deno-lint-ignore no-explicit-any
      const avatarTasks = (project as any).pending_video_tasks as Record<string, any> | null;
      if (avatarTasks?.type === 'avatar_async' && Array.isArray(avatarTasks.predictions)) {
        const { recoverMultiClipPredictions } = await import("../_shared/replicate-recovery.ts");
        const recovery = await recoverMultiClipPredictions(supabase, project.id, avatarTasks.predictions, {
          logPrefix: '[ZombieCleanup-Avatar]',
          saveToStorage: true,
        });
        
        if (recovery.totalWithVideo > 0) {
          const clipsWithVideo = avatarTasks.predictions
            .filter((p: { videoUrl?: string }) => p.videoUrl && p.videoUrl.length > 0)
            .sort((a: { clipIndex: number }, b: { clipIndex: number }) => a.clipIndex - b.clipIndex);
          const videoClipsArray = clipsWithVideo.map((p: { videoUrl: string }) => p.videoUrl);
          
          await supabase.from('movie_projects').update({
            status: 'completed',
            video_url: videoClipsArray[0],
            video_clips: videoClipsArray,
            pipeline_state: {
              ...pipelineState,
              stage: 'completed',
              progress: 100,
              message: `Recovered ${recovery.totalWithVideo} clips from stalled avatar`,
              completedAt: new Date().toISOString(),
              partial: recovery.totalWithVideo < avatarTasks.predictions.length,
              recoveredBy: 'zombie-cleanup-avatar-async',
            },
            pending_video_tasks: { ...avatarTasks, stage: 'complete' },
            updated_at: new Date().toISOString(),
          }).eq('id', project.id);
          
          for (const clip of clipsWithVideo) {
            await supabase.from('video_clips').upsert({
              project_id: project.id,
              shot_index: clip.clipIndex,
              status: 'completed',
              video_url: clip.videoUrl,
              duration_seconds: avatarTasks.clipDuration || 10,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'project_id,shot_index', ignoreDuplicates: false });
          }
          
          report.projectsFailed++;
          report.details.push({
            entityType: 'project',
            entityId: project.id,
            userId: project.user_id,
            stuckDuration: Math.round(stuckDuration / 1000),
            action: `avatar_async_recovered_${recovery.totalWithVideo}_clips`,
            refundAmount: 0,
          });
          console.log(`[ZombieCleanup] ✅ RECOVERED stalled avatar ${project.id} with ${recovery.totalWithVideo} clips`);
          continue;
        }
      }
      
      // No recovery possible - mark as failed with refund
      const projectAge = Date.now() - new Date(project.created_at).getTime();
      const eligibleForRefund = projectAge < MAX_AGE_FOR_REFUND_MS;
      
      // Calculate actual credits spent on this project from credit_transactions
      let refundAmount = 0;
      if (eligibleForRefund) {
        const { data: projectCharges } = await supabase
          .from('credit_transactions')
          .select('amount')
          .eq('project_id', project.id)
          .eq('transaction_type', 'usage');
        
        // Sum the absolute value of all usage charges (they're stored as negative)
        refundAmount = (projectCharges || []).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        // If no transaction records found, estimate from pipeline state
        if (refundAmount === 0) {
          const clipCount = (avatarTasks?.predictions as unknown[])?.length || 1;
          const clipDuration = (avatarTasks?.clipDuration as number) || 10;
          const creditsPerClip = clipDuration > 10 ? 90 : 60; // Avatar rates
          refundAmount = clipCount * creditsPerClip;
        }
        
        console.log(`[ZombieCleanup] Calculated refund for ${project.id}: ${refundAmount} credits`);
      }
      
      await supabase.from('movie_projects').update({
        status: 'failed',
        pipeline_state: {
          ...pipelineState,
          stage: 'failed',
          error: `Avatar pipeline stalled at ${stage} stage`,
          zombieCleanupAt: new Date().toISOString(),
          stuckDuration: Math.round(stuckDuration / 1000),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', project.id);
      
      if (refundAmount > 0) {
        // IDEMPOTENCY CHECK: Don't issue duplicate refunds for the same project
        const { data: existingRefund } = await supabase
          .from('credit_transactions')
          .select('id')
          .eq('project_id', project.id)
          .eq('transaction_type', 'refund')
          .limit(1);
        
        if (existingRefund && existingRefund.length > 0) {
          console.log(`[ZombieCleanup] Skipping duplicate refund for project ${project.id}`);
        } else {
          // AUDIT FIX (zombie double-refund): see note at the project-refund site
          // below. Single canonical, org-aware, idempotent refund instead of the
          // 'refund' insert + increment_credits double-credit.
          const { data: refunded, error: refundError } = await supabase.rpc('refund_credits', {
            p_user_id: project.user_id,
            p_amount: refundAmount,
            p_description: `Refund for stalled avatar: ${project.title || project.id}`,
            p_project_id: project.id,
            p_idempotency_key: `zombie-refund:${project.id}`,
          });

          if (refundError) {
            console.error(`[ZombieCleanup] refund_credits failed for project ${project.id}:`, refundError.message);
          } else if (refunded) {
            report.creditsRefunded += refundAmount;
          }
        }
      }
      
      report.projectsFailed++;
      report.details.push({
        entityType: 'project',
        entityId: project.id,
        userId: project.user_id,
        stuckDuration: Math.round(stuckDuration / 1000),
        action: 'marked_failed',
        refundAmount,
      });
    }

    // ==================== PHASE 1: STUCK PROJECTS (STANDARD PIPELINE) ====================
    // Find projects stuck in generating/processing states
    const { data: stuckProjects, error: projectsError } = await supabase
      .from('movie_projects')
      .select('id, user_id, title, status, updated_at, pending_video_tasks, created_at, pipeline_stage')
      .in('status', ['generating', 'rendering', 'assembling', 'stitching'])
      .neq('mode', 'avatar') // Skip avatar projects (handled in Phase 0)
      .lt('updated_at', cutoffTime)
      .order('updated_at', { ascending: true })
      .limit(50);

    if (projectsError) {
      console.error("[ZombieCleanup] Error fetching stuck projects:", projectsError);
    }

    for (const project of (stuckProjects || [])) {
      const stuckDuration = Date.now() - new Date(project.updated_at).getTime();
      // deno-lint-ignore no-explicit-any
      const tasks = (project.pending_video_tasks || {}) as Record<string, any>;
      
      // Skip if already being handled by watchdog
      if (tasks.watchdogHandling) continue;
      
      console.log(`[ZombieCleanup] Found zombie project: ${project.id} (stuck ${Math.round(stuckDuration / 1000)}s)`);
      report.zombiesFound++;
      
      // ══════════════════════════════════════════════════════════════════════════
      // CRITICAL: Before marking failed, check Replicate for completed predictions
      // ══════════════════════════════════════════════════════════════════════════
      if (tasks.type === 'avatar_async' && Array.isArray(tasks.predictions)) {
        const { recoverMultiClipPredictions } = await import("../_shared/replicate-recovery.ts");
        const recovery = await recoverMultiClipPredictions(supabase, project.id, tasks.predictions, {
          logPrefix: '[ZombieCleanup]',
          saveToStorage: true,
        });
        
        if (recovery.totalWithVideo > 0) {
          // Recovered clips! Mark as completed instead of failed
          const clipsWithVideo = tasks.predictions
            .filter((p: { videoUrl?: string }) => p.videoUrl && p.videoUrl.length > 0)
            .sort((a: { clipIndex: number }, b: { clipIndex: number }) => a.clipIndex - b.clipIndex);
          
          const videoClipsArray = clipsWithVideo.map((p: { videoUrl: string }) => p.videoUrl);
          
          await supabase.from('movie_projects').update({
            status: 'completed',
            video_url: videoClipsArray[0],
            video_clips: videoClipsArray,
            pipeline_state: {
              stage: 'completed',
              progress: 100,
              message: `Recovered ${recovery.totalWithVideo}/${tasks.predictions.length} clips`,
              completedAt: new Date().toISOString(),
              partial: recovery.totalWithVideo < tasks.predictions.length,
              recoveredBy: 'zombie-cleanup',
            },
            pending_video_tasks: { ...tasks, stage: 'complete' },
            updated_at: new Date().toISOString(),
          }).eq('id', project.id);
          
          // Upsert video_clips rows
          for (const clip of clipsWithVideo) {
            await supabase.from('video_clips').upsert({
              project_id: project.id,
              shot_index: clip.clipIndex,
              status: 'completed',
              video_url: clip.videoUrl,
              duration_seconds: tasks.clipDuration || 10,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'project_id,shot_index', ignoreDuplicates: false });
          }
          
          report.projectsFailed++;
          report.details.push({
            entityType: 'project',
            entityId: project.id,
            userId: project.user_id,
            stuckDuration: Math.round(stuckDuration / 1000),
            action: `recovered_${recovery.totalWithVideo}_clips`,
            refundAmount: 0,
          });
          console.log(`[ZombieCleanup] ✅ RECOVERED project ${project.id} with ${recovery.totalWithVideo} clips`);
          continue;
        }
      }
      
      // Check if eligible for refund (not too old)
      const projectAge = Date.now() - new Date(project.created_at).getTime();
      const eligibleForRefund = projectAge < MAX_AGE_FOR_REFUND_MS;
      
      // Calculate refund amount based on incomplete clips
      let refundAmount = 0;
      if (eligibleForRefund) {
        // Get clips that were charged but not completed
        const { data: incompleteClips } = await supabase
          .from('video_clips')
          .select('id, shot_index')
          .eq('project_id', project.id)
          .in('status', ['generating', 'pending', 'failed'])
          .limit(100);
        
        // Each incomplete clip = 10 credits (or 15 for extended)
        const incompleteCount = incompleteClips?.length || 0;
        refundAmount = incompleteCount * 10; // Base rate
      }
      
      // Mark project as failed
      const { error: updateError } = await supabase
        .from('movie_projects')
        .update({
          status: 'failed',
          pending_video_tasks: {
            ...tasks,
            stage: 'failed',
            error: 'Project timed out after extended inactivity',
            zombieCleanupAt: new Date().toISOString(),
            stuckDuration: Math.round(stuckDuration / 1000),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);
      
      if (!updateError) {
        report.projectsFailed++;

        // AUDIT FIX (zombie double-refund): Phase 1 refunds this project's
        // incomplete clips in aggregate (key zombie-refund:<projectId>). If we
        // leave those clip rows in 'generating', PHASE 2 below picks them up and
        // refunds each AGAIN (key zombie-clip-refund:<clipId>) — disjoint keys,
        // so refund_credits idempotency can't dedupe. Mark them failed here so
        // Phase 2 (which only selects status='generating') cannot touch them.
        await supabase
          .from('video_clips')
          .update({
            status: 'failed',
            error_message: 'Project timed out after extended inactivity (zombie cleanup)',
            updated_at: new Date().toISOString(),
          })
          .eq('project_id', project.id)
          .in('status', ['generating', 'pending']);

        // Issue refund if applicable
        if (refundAmount > 0) {
          // IDEMPOTENCY CHECK: Don't issue duplicate refunds
          const { data: existingRefund } = await supabase
            .from('credit_transactions')
            .select('id')
            .eq('project_id', project.id)
            .eq('transaction_type', 'refund')
            .limit(1);
          
          if (existingRefund && existingRefund.length > 0) {
            console.log(`[ZombieCleanup] Skipping duplicate refund for project ${project.id}`);
          } else {
            // AUDIT FIX (zombie double-refund): the prior code inserted a 'refund'
            // credit_transactions row AND called increment_credits (which inserts a
            // second 'system_grant' row). Both count in credit_ledger_total — the
            // spendable balance — so every cleanup refunded 2× the amount. It was
            // also non-org-aware (refunded org spend onto the personal ledger).
            // refund_credits is the canonical RPC: it routes org vs personal from
            // the project, locks the balance, writes a single 'refund' row, and is
            // idempotent on (project_id, idempotency_key) so re-runs are safe.
            const { data: refunded, error: refundError } = await supabase.rpc('refund_credits', {
              p_user_id: project.user_id,
              p_amount: refundAmount,
              p_description: `Refund for failed project: ${project.title || project.id}`,
              p_project_id: project.id,
              p_idempotency_key: `zombie-refund:${project.id}`,
            });

            if (refundError) {
              console.error(`[ZombieCleanup] refund_credits failed for project ${project.id}:`, refundError.message);
            } else if (refunded) {
              report.creditsRefunded += refundAmount;
              console.log(`[ZombieCleanup] Refunded ${refundAmount} credits for project ${project.id}`);
            }
          }
        }
        
        report.details.push({
          entityType: 'project',
          entityId: project.id,
          userId: project.user_id,
          stuckDuration: Math.round(stuckDuration / 1000),
          action: 'marked_failed',
          refundAmount,
        });
      }
    }

    // ==================== PHASE 2: STUCK CLIPS ====================
    // Find individual clips stuck in generating state
    const { data: stuckClips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, project_id, shot_index, status, updated_at, created_at')
      .eq('status', 'generating')
      .lt('updated_at', cutoffTime)
      .order('updated_at', { ascending: true })
      .limit(100);

    if (clipsError) {
      console.error("[ZombieCleanup] Error fetching stuck clips:", clipsError);
    }

    for (const clip of (stuckClips || [])) {
      const stuckDuration = Date.now() - new Date(clip.updated_at).getTime();
      
      console.log(`[ZombieCleanup] Found zombie clip: ${clip.id} (shot ${clip.shot_index}, stuck ${Math.round(stuckDuration / 1000)}s)`);
      report.zombiesFound++;
      
      // ══════════════════════════════════════════════════════════════════════════
      // CRITICAL: Check Replicate before marking clip as failed
      // ══════════════════════════════════════════════════════════════════════════
      // Fetch clip with veo_operation_name (stores predictionId)
      const { data: fullClip } = await supabase
        .from('video_clips')
        .select('id, project_id, shot_index, veo_operation_name')
        .eq('id', clip.id)
        .maybeSingle();
      
      if (fullClip?.veo_operation_name) {
        const { recoverReplicatePrediction } = await import("../_shared/replicate-recovery.ts");
        const result = await recoverReplicatePrediction(
          supabase,
          fullClip.veo_operation_name,
          clip.project_id,
          { clipIndex: clip.shot_index, logPrefix: '[ZombieCleanup]', saveToStorage: true }
        );
        
        if (result.recovered && result.videoUrl) {
          await supabase.from('video_clips').update({
            status: 'completed',
            video_url: result.videoUrl,
            error_message: null,
            updated_at: new Date().toISOString(),
          }).eq('id', clip.id);
          
          report.clipsFailed++;
          report.details.push({
            entityType: 'clip',
            entityId: clip.id,
            userId: '',
            stuckDuration: Math.round(stuckDuration / 1000),
            action: 'recovered_from_replicate',
            refundAmount: 0,
          });
          console.log(`[ZombieCleanup] ✅ RECOVERED clip ${clip.id} from Replicate`);
          continue;
        }
      }
      
      // No recovery possible — mark as failed
      const { error: updateError } = await supabase
        .from('video_clips')
        .update({
          status: 'failed',
          error_message: 'Clip generation timed out after extended inactivity',
          updated_at: new Date().toISOString(),
        })
        .eq('id', clip.id);
      
      if (!updateError) {
        report.clipsFailed++;
        
        // Get project's user_id for potential refund
        const { data: project } = await supabase
          .from('movie_projects')
          .select('user_id')
          .eq('id', clip.project_id)
          .maybeSingle();
        
        if (project) {
          // Refund 10 credits for the failed clip.
          const refundAmount = 10;

          // AUDIT FIX (zombie double-refund + missing idempotency): this clip path
          // previously inserted a 'refund' row AND called increment_credits (2×
          // credit) AND had NO idempotency guard, so a re-run refunded the same
          // clip again. refund_credits is org-aware and idempotent; keying on the
          // clip id (clips share a project_id) gives per-clip idempotency.
          const { data: refunded, error: refundError } = await supabase.rpc('refund_credits', {
            p_user_id: project.user_id,
            p_amount: refundAmount,
            p_description: `Refund for failed clip: Shot ${clip.shot_index + 1}`,
            p_project_id: clip.project_id,
            p_idempotency_key: `zombie-clip-refund:${clip.id}`,
          });

          if (refundError) {
            console.error(`[ZombieCleanup] refund_credits failed for clip ${clip.id}:`, refundError.message);
          } else if (refunded) {
            report.creditsRefunded += refundAmount;
          }
          
          report.details.push({
            entityType: 'clip',
            entityId: clip.id,
            userId: project.user_id,
            stuckDuration: Math.round(stuckDuration / 1000),
            action: 'marked_failed',
            refundAmount,
          });
        }
      }
    }

    // ==================== PHASE 3: RELEASE STALE MUTEX LOCKS ====================
    // Find projects with stale generation locks (shouldn't happen but safety net)
    const { data: lockedProjects } = await supabase
      .from('movie_projects')
      .select('id, user_id, generation_lock')
      .eq('status', 'generating')
      .not('generation_lock', 'is', null)
      .limit(30);

    let locksReleased = 0;
    for (const project of (lockedProjects || [])) {
      const lock = project.generation_lock as Record<string, unknown> | null;
      if (!lock?.lockedAt) continue;
      
      const lockAge = Date.now() - new Date(lock.lockedAt as string).getTime();
      
      // Release locks older than 5 minutes
      if (lockAge > STUCK_THRESHOLD_MS) {
        await supabase
          .from('movie_projects')
          .update({
            generation_lock: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id);
        
        locksReleased++;
        console.log(`[ZombieCleanup] Released stale lock for project ${project.id} (age: ${Math.round(lockAge / 1000)}s)`);
      }
    }

    const processingTime = Date.now() - startTime;
    
    console.log(`[ZombieCleanup] Complete: ${report.projectsFailed} projects failed, ${report.clipsFailed} clips failed, ${report.creditsRefunded} credits refunded, ${locksReleased} locks released (${processingTime}ms)`);

    return new Response(
      JSON.stringify({
        success: true,
        ...report,
        locksReleased,
        processingTimeMs: processingTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[ZombieCleanup] Error:", errorMsg);
    
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
