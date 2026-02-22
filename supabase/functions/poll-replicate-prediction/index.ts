import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { persistVideoToStorage } from "../_shared/video-persistence.ts";
import {
  isValidImageUrl,
} from "../_shared/pipeline-guard-rails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";
const POLL_INTERVAL_MS = 5000; // 5 seconds between polls
const MAX_POLL_DURATION_MS = 50000; // 50 seconds max per invocation (leaves 10s buffer for 60s timeout)
const MAX_CHAIN_DEPTH = 30; // Max self-chains (30 × 50s = 25 min max total)

/**
 * POLL-REPLICATE-PREDICTION: Dedicated, aggressive Replicate poller
 * 
 * This is the PRIMARY mechanism for detecting when Replicate finishes.
 * It polls every 5 seconds, and if the prediction isn't done within 50s,
 * it calls ITSELF again (self-chaining) to continue polling — zero gaps.
 * 
 * Flow:
 * 1. generate-single-clip creates prediction → fires this function
 * 2. This function polls Replicate every 5s for up to 50s
 * 3. If succeeded → persist video → update clip → chain continue-production
 * 4. If failed → mark clip failed
 * 5. If still running → call ITSELF again to keep polling (self-chain)
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const {
      predictionId,
      projectId,
      userId,
      shotIndex,
      totalClips,
      chainDepth = 0,
      pipelineContext,
    } = await req.json();

    if (!predictionId || !projectId || shotIndex === undefined) {
      return new Response(JSON.stringify({ error: "Missing required params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!REPLICATE_API_KEY) {
      return new Response(JSON.stringify({ error: "REPLICATE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[PollReplicate] 🔄 Polling prediction ${predictionId} for clip ${shotIndex + 1}/${totalClips} (chain depth: ${chainDepth})`);

    // Guard: check if clip is already completed (idempotency)
    const { data: existingClip } = await supabase
      .from('video_clips')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('shot_index', shotIndex)
      .maybeSingle();

    if (existingClip?.status === 'completed') {
      console.log(`[PollReplicate] Clip ${shotIndex + 1} already completed — skipping`);
      return new Response(JSON.stringify({ success: true, alreadyCompleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Poll loop: check Replicate every POLL_INTERVAL_MS for up to MAX_POLL_DURATION_MS
    const startTime = Date.now();
    let finalStatus = "processing";
    let videoUrl: string | null = null;
    let errorMsg: string | null = null;

    while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
      try {
        const response = await fetch(`${REPLICATE_PREDICTIONS_URL}/${predictionId}`, {
          headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
        });

        if (!response.ok) {
          console.warn(`[PollReplicate] API returned ${response.status} — retrying`);
          await sleep(POLL_INTERVAL_MS);
          continue;
        }

        const prediction = await response.json();
        finalStatus = prediction.status;

        if (prediction.status === "succeeded") {
          // Extract video URL
          const output = prediction.output;
          if (typeof output === "string") videoUrl = output;
          else if (Array.isArray(output) && output.length > 0) videoUrl = output[0];

          // Capture Replicate metrics for cost tracking
          const predictTime = prediction.metrics?.predict_time;
          const totalTime = prediction.metrics?.total_time;
          console.log(`[PollReplicate] ✅ Prediction ${predictionId} SUCCEEDED after ${Math.round((Date.now() - startTime) / 1000)}s (predict_time: ${predictTime || 'N/A'}s)`);
          break;
        }

        if (prediction.status === "failed" || prediction.status === "canceled") {
          errorMsg = prediction.error || `Prediction ${prediction.status}`;
          console.log(`[PollReplicate] ❌ Prediction ${predictionId} ${prediction.status}: ${errorMsg}`);
          break;
        }

        // Still processing — wait and poll again
        console.log(`[PollReplicate] ⏳ Prediction ${predictionId} status: ${prediction.status} (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
      } catch (pollErr) {
        console.warn(`[PollReplicate] Poll error (will retry):`, pollErr);
      }

      await sleep(POLL_INTERVAL_MS);
    }

    // ═══════════════════════════════════════════════════════════════
    // HANDLE RESULT
    // ═══════════════════════════════════════════════════════════════

    if (finalStatus === "succeeded" && videoUrl) {
      // Persist video to permanent storage
      const storedVideoUrl = await persistVideoToStorage(
        supabase, videoUrl, projectId,
        { prefix: `clip${shotIndex}`, clipIndex: shotIndex }
      );

      if (!storedVideoUrl) {
        console.error(`[PollReplicate] Failed to persist video — marking clip failed`);
        await supabase.from('video_clips').update({
          status: 'failed',
          error_message: 'Video storage failed (CDN URL may have expired)',
          updated_at: new Date().toISOString(),
        }).eq('project_id', projectId).eq('shot_index', shotIndex);

        return new Response(JSON.stringify({ success: false, error: "Storage failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For Clip 0, use reference image as last_frame_url
      let lastFrameUrl: string | null = null;
      if (shotIndex === 0) {
        const { data: projectData } = await supabase
          .from('movie_projects')
          .select('pro_features_data')
          .eq('id', projectId)
          .maybeSingle();

        const proFeatures = projectData?.pro_features_data as Record<string, any> || {};
        const referenceImageUrl = proFeatures.referenceAnalysis?.imageUrl
          || proFeatures.identityBible?.originalReferenceUrl;

        if (referenceImageUrl && isValidImageUrl(referenceImageUrl)) {
          lastFrameUrl = referenceImageUrl;
          console.log(`[PollReplicate] ✓ Clip 0: Using reference image as last_frame`);
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

      await supabase.from('video_clips').update(clipUpdate)
        .eq('project_id', projectId)
        .eq('shot_index', shotIndex);

      console.log(`[PollReplicate] ✅ Clip ${shotIndex + 1} stored and marked completed`);

      // Chain to continue-production for next clip
      try {
        const continueResponse = await fetch(`${supabaseUrl}/functions/v1/continue-production`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            projectId,
            userId,
            completedClipIndex: shotIndex,
            completedClipResult: {
              videoUrl: storedVideoUrl,
              lastFrameUrl: lastFrameUrl || null,
            },
            totalClips: totalClips || 3,
            pipelineContext,
          }),
        });

        if (continueResponse.ok) {
          console.log(`[PollReplicate] ✅ continue-production chained successfully`);
        } else {
          console.warn(`[PollReplicate] continue-production returned ${continueResponse.status}`);
        }
      } catch (chainErr) {
        console.error(`[PollReplicate] Failed to chain continue-production:`, chainErr);
      }

      // Log cost — use per-output-second pricing for Kling v3
      // Kling v3 official model: ~$0.28/sec of output video
      try {
        // Kling v3 ACTUAL Replicate pricing: Pro no-audio=$0.224/sec, Pro+audio=$0.336/sec
        const clipDuration = 10; // default clip duration in seconds (Kling v3 default)
        const KLING_V3_COST_PER_SEC_CENTS = 22.4; // $0.224/sec (pro, no audio — most clips)
        const realCostCents = Math.round(clipDuration * KLING_V3_COST_PER_SEC_CENTS);
        
        await supabase.rpc('log_api_cost', {
          p_service: 'replicate-kling',
          p_operation: 'poll-completion',
          p_real_cost_cents: realCostCents,
          p_credits_charged: 0, // credits already charged at generation start
          p_status: 'completed',
          p_project_id: projectId,
          p_shot_id: predictionId,
          p_user_id: userId,
          p_metadata: { pollDurationMs: Date.now() - startTime, chainDepth, shotIndex, cost_method: 'per_output_second', cost_rate: KLING_V3_COST_PER_SEC_CENTS },
        });
      } catch (_) { /* non-fatal */ }

      return new Response(JSON.stringify({
        success: true,
        status: 'completed',
        videoUrl: storedVideoUrl,
        shotIndex,
        chainDepth,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (finalStatus === "failed" || finalStatus === "canceled") {
      // Mark clip as failed
      await supabase.from('video_clips').update({
        status: 'failed',
        error_message: (errorMsg || `Prediction ${finalStatus}`).substring(0, 500),
        updated_at: new Date().toISOString(),
      }).eq('project_id', projectId).eq('shot_index', shotIndex);

      return new Response(JSON.stringify({
        success: false,
        status: 'failed',
        error: errorMsg,
        shotIndex,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STILL RUNNING: Self-chain to continue polling
    // ═══════════════════════════════════════════════════════════════
    if (chainDepth >= MAX_CHAIN_DEPTH) {
      console.warn(`[PollReplicate] ⚠️ Max chain depth (${MAX_CHAIN_DEPTH}) reached for prediction ${predictionId} — deferring to watchdog`);
      return new Response(JSON.stringify({
        success: true,
        status: 'deferred_to_watchdog',
        chainDepth,
        message: `Prediction still processing after ${MAX_CHAIN_DEPTH} polling cycles`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[PollReplicate] 🔄 Prediction still ${finalStatus} — self-chaining (depth ${chainDepth + 1})`);

    // Fire-and-forget self-chain — don't await to avoid timeout
    fetch(`${supabaseUrl}/functions/v1/poll-replicate-prediction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        predictionId,
        projectId,
        userId,
        shotIndex,
        totalClips,
        chainDepth: chainDepth + 1,
        pipelineContext,
      }),
    }).catch(err => console.warn(`[PollReplicate] Self-chain fire failed:`, err));

    return new Response(JSON.stringify({
      success: true,
      status: 'polling_continued',
      chainDepth: chainDepth + 1,
      predictionId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[PollReplicate] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
