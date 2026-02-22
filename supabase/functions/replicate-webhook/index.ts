import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { persistVideoToStorage } from "../_shared/video-persistence.ts";
import {
  isValidImageUrl,
  GUARD_RAIL_CONFIG,
} from "../_shared/pipeline-guard-rails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * REPLICATE WEBHOOK — World-Class Real-Time Completion Handler
 * 
 * Replicate POSTs the full prediction object here the INSTANT a prediction
 * completes (succeeded/failed/canceled). This eliminates ALL polling gaps.
 * 
 * Flow:
 * 1. Replicate calls this webhook when prediction finishes
 * 2. We look up which clip this prediction belongs to (via veo_operation_name)
 * 3. If succeeded: store video → update clip → chain continue-production
 * 4. If failed: mark clip failed
 * 
 * This replaces polling as the PRIMARY completion mechanism.
 * The watchdog becomes a safety net only.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const prediction = await req.json();
    
    const predictionId = prediction.id;
    const status = prediction.status; // succeeded, failed, canceled
    const output = prediction.output;
    
    console.log(`[ReplicateWebhook] 📡 Received callback: prediction=${predictionId}, status=${status}`);
    
    if (!predictionId) {
      return new Response(JSON.stringify({ error: "No prediction ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Find the clip this prediction belongs to
    // We store predictionId in veo_operation_name column
    // ═══════════════════════════════════════════════════════════════
    const { data: clip, error: clipError } = await supabase
      .from('video_clips')
      .select('id, project_id, user_id, shot_index, status, duration_seconds')
      .eq('veo_operation_name', predictionId)
      .maybeSingle();
    
    if (clipError || !clip) {
      // Also check pending_video_tasks for avatar-async predictions
      console.warn(`[ReplicateWebhook] No clip found for prediction ${predictionId} in video_clips — checking pending_video_tasks`);
      
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, user_id, pending_video_tasks')
        .filter('pending_video_tasks', 'not.is', null)
        .limit(50);
      
      let matchedProject: any = null;
      let matchedPredIndex = -1;
      
      for (const proj of (projects || [])) {
        const tasks = proj.pending_video_tasks as any;
        if (tasks?.predictions && Array.isArray(tasks.predictions)) {
          const idx = tasks.predictions.findIndex((p: any) => p.predictionId === predictionId);
          if (idx >= 0) {
            matchedProject = proj;
            matchedPredIndex = idx;
            break;
          }
        }
      }
      
      if (matchedProject && matchedPredIndex >= 0) {
        console.log(`[ReplicateWebhook] Found prediction in pending_video_tasks of project ${matchedProject.id}, clip index ${matchedPredIndex}`);
        
        // Handle avatar-async prediction via pending_video_tasks
        await handleAvatarAsyncPrediction(
          supabase, supabaseUrl, supabaseKey,
          matchedProject, matchedPredIndex, prediction
        );
        
        return new Response(JSON.stringify({ success: true, type: 'avatar_async' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.warn(`[ReplicateWebhook] ⚠️ Prediction ${predictionId} not found in any tracking system — ignoring`);
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if clip is already completed (idempotency)
    if (clip.status === 'completed') {
      console.log(`[ReplicateWebhook] Clip ${clip.shot_index + 1} already completed — ignoring duplicate webhook`);
      return new Response(JSON.stringify({ success: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Handle prediction result
    // ═══════════════════════════════════════════════════════════════
    if (status === 'succeeded') {
      // Extract video URL
      let rawVideoUrl: string | null = null;
      if (typeof output === "string") {
        rawVideoUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        rawVideoUrl = output[0];
      }
      
      if (!rawVideoUrl) {
        console.error(`[ReplicateWebhook] Prediction ${predictionId} succeeded but no video URL in output`);
        await supabase.from('video_clips').update({
          status: 'failed',
          error_message: 'Prediction succeeded but no video URL returned',
          updated_at: new Date().toISOString(),
        }).eq('id', clip.id);
        return new Response(JSON.stringify({ success: false, error: 'No video URL' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log(`[ReplicateWebhook] ✅ Prediction ${predictionId} SUCCEEDED — storing video for clip ${clip.shot_index + 1}`);
      
      // Store video in permanent storage
      const storedVideoUrl = await persistVideoToStorage(
        supabase, rawVideoUrl, clip.project_id,
        { prefix: `clip${clip.shot_index}`, clipIndex: clip.shot_index }
      );
      
      if (!storedVideoUrl) {
        console.error(`[ReplicateWebhook] Failed to persist video for prediction ${predictionId}`);
        await supabase.from('video_clips').update({
          status: 'failed',
          error_message: 'Video storage failed (CDN URL may have expired)',
          updated_at: new Date().toISOString(),
        }).eq('id', clip.id);
        return new Response(JSON.stringify({ success: false, error: 'Storage failed' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // GUARD RAIL: For Clip 0, use reference image as last_frame_url
      let lastFrameUrl: string | null = null;
      if (clip.shot_index === 0) {
        const { data: projectData } = await supabase
          .from('movie_projects')
          .select('pro_features_data')
          .eq('id', clip.project_id)
          .maybeSingle();
        
        const proFeatures = projectData?.pro_features_data as Record<string, any> || {};
        const referenceImageUrl = proFeatures.referenceAnalysis?.imageUrl 
          || proFeatures.identityBible?.originalReferenceUrl;
        
        if (referenceImageUrl && isValidImageUrl(referenceImageUrl)) {
          lastFrameUrl = referenceImageUrl;
          console.log(`[ReplicateWebhook] ✓ Clip 0: Using reference image as last_frame`);
        }
      }
      
      // Update clip record
      const clipUpdate: Record<string, any> = {
        status: 'completed',
        video_url: storedVideoUrl,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      };
      if (lastFrameUrl) {
        clipUpdate.last_frame_url = lastFrameUrl;
      }
      
      await supabase.from('video_clips').update(clipUpdate).eq('id', clip.id);
      console.log(`[ReplicateWebhook] ✅ Clip ${clip.shot_index + 1} marked completed with stored URL`);
      
      // ═══════════════════════════════════════════════════════════════
      // STEP 3: Chain to continue-production for next clip
      // ═══════════════════════════════════════════════════════════════
      await chainContinueProduction(
        supabaseUrl, supabaseKey, supabase,
        clip.project_id, clip.user_id, clip.shot_index,
        storedVideoUrl, lastFrameUrl
      );
      
      // Log cost
      try {
        await supabase.rpc('log_api_cost', {
          p_service: 'replicate-kling',
          p_operation: 'webhook-completion',
          p_real_cost_cents: 0,
          p_credits_charged: 0,
          p_status: 'completed',
          p_project_id: clip.project_id,
          p_shot_id: predictionId,
          p_user_id: clip.user_id,
          p_metadata: { webhookReceived: true, shotIndex: clip.shot_index },
        });
      } catch (_) { /* non-fatal */ }
      
      return new Response(JSON.stringify({ 
        success: true, 
        clipId: clip.id,
        shotIndex: clip.shot_index,
        videoUrl: storedVideoUrl,
        chained: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      
    } else if (status === 'failed' || status === 'canceled') {
      const errorMsg = prediction.error || `Prediction ${status}`;
      console.log(`[ReplicateWebhook] ❌ Prediction ${predictionId} ${status}: ${errorMsg}`);
      
      await supabase.from('video_clips').update({
        status: 'failed',
        error_message: errorMsg.substring(0, 500),
        updated_at: new Date().toISOString(),
      }).eq('id', clip.id);
      
      return new Response(JSON.stringify({ success: true, status: 'failed' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Other statuses (starting, processing) — shouldn't normally arrive via webhook
    console.log(`[ReplicateWebhook] Ignoring non-terminal status: ${status}`);
    return new Response(JSON.stringify({ success: true, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[ReplicateWebhook] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Chain to continue-production to trigger next clip or stitching
 */
async function chainContinueProduction(
  supabaseUrl: string,
  supabaseKey: string,
  supabase: any,
  projectId: string,
  userId: string,
  completedShotIndex: number,
  videoUrl: string,
  lastFrameUrl: string | null,
) {
  try {
    // Get total clip count
    const { data: projMeta } = await supabase
      .from('movie_projects')
      .select('pending_video_tasks, generated_script')
      .eq('id', projectId)
      .maybeSingle();
    
    const tasks = (projMeta?.pending_video_tasks || {}) as Record<string, any>;
    let totalClips = tasks.clipCount || 3;
    
    // Also check generated_script for shot count
    if (projMeta?.generated_script) {
      try {
        const script = JSON.parse(projMeta.generated_script);
        if (script.shots?.length) totalClips = script.shots.length;
      } catch { /* ignore */ }
    }
    
    console.log(`[ReplicateWebhook] 🔗 Chaining continue-production: clip ${completedShotIndex + 1}/${totalClips}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/continue-production`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        projectId,
        userId,
        completedClipIndex: completedShotIndex,
        completedClipResult: {
          videoUrl,
          lastFrameUrl: lastFrameUrl || null,
        },
        totalClips,
      }),
    });
    
    if (response.ok) {
      console.log(`[ReplicateWebhook] ✅ continue-production triggered successfully`);
    } else {
      const errText = await response.text();
      console.warn(`[ReplicateWebhook] continue-production returned ${response.status}: ${errText.substring(0, 200)}`);
    }
  } catch (err) {
    console.error(`[ReplicateWebhook] Failed to chain continue-production:`, err);
  }
}

/**
 * Handle avatar-async predictions tracked in pending_video_tasks
 */
async function handleAvatarAsyncPrediction(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  project: any,
  predIndex: number,
  prediction: any,
) {
  const tasks = project.pending_video_tasks as any;
  const pred = tasks.predictions[predIndex];
  const status = prediction.status;
  
  if (status === 'succeeded') {
    const output = prediction.output;
    let rawVideoUrl: string | null = null;
    if (typeof output === "string") rawVideoUrl = output;
    else if (Array.isArray(output) && output.length > 0) rawVideoUrl = output[0];
    
    if (rawVideoUrl) {
      const storedUrl = await persistVideoToStorage(
        supabase, rawVideoUrl, project.id,
        { prefix: `avatar_clip${predIndex}`, clipIndex: predIndex }
      );
      
      if (storedUrl) {
        // Update prediction in pending_video_tasks
        tasks.predictions[predIndex] = {
          ...pred,
          videoUrl: storedUrl,
          status: 'completed',
          completedAt: new Date().toISOString(),
          webhookCompleted: true,
        };
        
        // Also upsert into video_clips
        await supabase.rpc('upsert_video_clip', {
          p_project_id: project.id,
          p_user_id: project.user_id,
          p_shot_index: predIndex,
          p_prompt: pred.segmentText || `Avatar clip ${predIndex + 1}`,
          p_status: 'completed',
          p_video_url: storedUrl,
          p_duration_seconds: tasks.clipDuration || 10,
        });
        
        // Save updated tasks
        await supabase.from('movie_projects').update({
          pending_video_tasks: { ...tasks, lastProgressAt: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }).eq('id', project.id);
        
        console.log(`[ReplicateWebhook] ✅ Avatar clip ${predIndex + 1} completed via webhook`);
        
        // Check if all clips are done
        const allDone = tasks.predictions.every((p: any, i: number) => 
          i === predIndex ? true : (p.videoUrl && p.status === 'completed')
        );
        
        if (allDone) {
          console.log(`[ReplicateWebhook] 🎬 All avatar clips done — triggering stitch`);
          await chainContinueProduction(
            supabaseUrl, supabaseKey, supabase,
            project.id, project.user_id, predIndex,
            storedUrl, null
          );
        }
      }
    }
  } else if (status === 'failed' || status === 'canceled') {
    tasks.predictions[predIndex] = {
      ...pred,
      status: 'failed',
      error: prediction.error || `Prediction ${status}`,
    };
    await supabase.from('movie_projects').update({
      pending_video_tasks: tasks,
      updated_at: new Date().toISOString(),
    }).eq('id', project.id);
    
    console.log(`[ReplicateWebhook] ❌ Avatar clip ${predIndex + 1} failed: ${prediction.error}`);
  }
}

