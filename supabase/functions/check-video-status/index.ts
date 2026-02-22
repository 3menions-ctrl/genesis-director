import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  isValidImageUrl,
  getGuaranteedLastFrame,
  GUARD_RAIL_CONFIG,
} from "../_shared/pipeline-guard-rails.ts";
import { persistVideoToStorage } from "../_shared/video-persistence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ✅ Kling V3 via Replicate — unified engine for ALL modes
const REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";
const KLING_MODEL = "kwaivgi/kling-v3-video";

// Log API calls for cost tracking
async function logApiCall(
  supabase: any,
  operation: string,
  service: string,
  status: string,
  projectId?: string,
  taskId?: string,
  userId?: string
) {
  try {
    // Cost is sub-cent per poll; round to nearest integer (0) since column is integer
    const POLL_COST_CENTS = 0;
    
    await supabase.rpc('log_api_cost', {
      p_service: service,
      p_operation: operation,
      p_real_cost_cents: POLL_COST_CENTS,
      p_credits_charged: 0,
      p_status: status,
      p_project_id: projectId || null,
      p_shot_id: taskId || 'status-poll',
      p_user_id: userId || null,
      p_metadata: { timestamp: new Date().toISOString() }
    });
  } catch (err) {
    console.warn('[Cost Log] Failed to log API call:', err);
  }
}

// Removed local storeVideoFromUrl in favor of shared persistVideoToStorage
// This ensures consistent behavior and error handling across the platform

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client for logging
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ═══ AUTH GUARD: Prevent unauthorized API access ═══
  const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
  const auth = await validateAuth(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  try {
    const { 
      taskId, 
      provider = "replicate", 
      projectId: reqProjectId, 
      userId,
      // NEW: Optional clip recovery parameters
      clipId,
      shotIndex,
      autoComplete = false, // If true, automatically store and update clip on success
    } = await req.json();

    if (!taskId) {
      throw new Error("Task ID (prediction ID) is required");
    }

    console.log("Checking video status for prediction:", taskId, "provider:", provider);

    // Handle Replicate API (Kling via Replicate)
    if (provider === "replicate" || provider === "kling") {
      try {
        const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
        if (!REPLICATE_API_KEY) {
          throw new Error("REPLICATE_API_KEY is not configured");
        }

        const statusUrl = `${REPLICATE_PREDICTIONS_URL}/${taskId}`;
        
        console.log("Polling Replicate prediction:", statusUrl);
        
        const response = await fetch(statusUrl, {
          headers: {
            "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Replicate API error:", response.status, errorText);
          throw new Error(`Replicate API error: ${response.status}`);
        }

        const prediction = await response.json();
        
        console.log("Replicate prediction status:", {
          id: prediction.id,
          status: prediction.status,
        });

        // Map Replicate status to our standard status
        // Replicate statuses: starting, processing, succeeded, failed, canceled
        let status = "RUNNING";
        let progress = 0;
        let videoUrl = null;
        let storedVideoUrl = null;
        let error = null;

        switch (prediction.status) {
          case "starting":
            status = "STARTING";
            progress = 10;
            break;
          case "processing":
            status = "RUNNING";
            progress = 50;
            break;
          case "succeeded":
            status = "SUCCEEDED";
            progress = 100;
            // Extract video URL from output
            const output = prediction.output;
            if (typeof output === "string") {
              videoUrl = output;
            } else if (Array.isArray(output) && output.length > 0) {
              videoUrl = output[0];
            }
            
            // =========================================================
            // AUTO-COMPLETE: Store video and update clip record
            // This recovers clips where generate-single-clip timed out
            // GUARD RAIL: Also ensures Clip 0 has reference image as last_frame
            // =========================================================
            if (autoComplete && videoUrl && reqProjectId && shotIndex !== undefined) {
              try {
                console.log(`[CheckStatus] Auto-completing clip ${shotIndex + 1}...`);
                
                // Store video in Supabase storage
                storedVideoUrl = await persistVideoToStorage(supabase, videoUrl, reqProjectId, { prefix: `auto_clip${shotIndex}`, clipIndex: shotIndex });
                
                // GUARD RAIL: For Clip 0, ALWAYS use reference image as last_frame_url
                let lastFrameUrl: string | null = null;
                if (shotIndex === 0) {
                  // Fetch reference image from project
                  const { data: projectData } = await supabase
                    .from('movie_projects')
                    .select('pro_features_data')
                    .eq('id', reqProjectId)
                    .maybeSingle();
                  
                  const proFeatures = projectData?.pro_features_data as Record<string, any> || {};
                  const referenceImageUrl = proFeatures.referenceAnalysis?.imageUrl 
                    || proFeatures.identityBible?.originalReferenceUrl;
                  
                  if (referenceImageUrl && isValidImageUrl(referenceImageUrl)) {
                    lastFrameUrl = referenceImageUrl;
                    console.log(`[CheckStatus] ✓ Clip 0: Using reference image as last_frame (GUARANTEED)`);
                  }
                }
                
                // Update clip record
                if (userId) {
                  const clipData: Record<string, any> = {
                    project_id: reqProjectId,
                    user_id: userId,
                    shot_index: shotIndex,
                    status: 'completed',
                    video_url: storedVideoUrl,
                    veo_operation_name: taskId,
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  
                  // Add last_frame_url if we have one (Clip 0 reference image)
                  if (lastFrameUrl) {
                    clipData.last_frame_url = lastFrameUrl;
                  }
                  
                  // Check if clip exists
                  const { data: existingClip } = await supabase
                    .from('video_clips')
                    .select('id')
                    .eq('project_id', reqProjectId)
                    .eq('shot_index', shotIndex)
                    .maybeSingle();
                  
                  if (existingClip?.id) {
                    await supabase
                      .from('video_clips')
                      .update(clipData)
                      .eq('id', existingClip.id);
                    console.log(`[CheckStatus] ✓ Updated clip ${existingClip.id} to completed`);
                  } else {
                    // Insert new clip record
                    // FIX #4: Use actual clip duration from project metadata, not hardcoded 5
                    const { data: projectMeta } = await supabase
                      .from('movie_projects')
                      .select('pending_video_tasks')
                      .eq('id', reqProjectId)
                      .maybeSingle();
                    const pendingTasks = (projectMeta?.pending_video_tasks || {}) as Record<string, any>;
                    const actualDuration = pendingTasks.clipDuration || 10;
                    
                    const { data: newClip } = await supabase
                      .from('video_clips')
                      .insert({
                        ...clipData,
                        prompt: `Recovered clip ${shotIndex + 1}`,
                        duration_seconds: actualDuration,
                      })
                      .select('id')
                      .maybeSingle();
                    console.log(`[CheckStatus] ✓ Created clip record ${newClip?.id}`);
                  }
                }
                
                console.log(`[CheckStatus] ✓ Clip ${shotIndex + 1} auto-completed`);
                
                // ═══════════════════════════════════════════════════════
                // CRITICAL FIX: Trigger continue-production to chain next clip
                // Without this, the pipeline stops dead after recovering a clip.
                // ═══════════════════════════════════════════════════════
                if (storedVideoUrl) {
                  try {
                    // Get totalClips from pending_video_tasks
                    const { data: projMeta } = await supabase
                      .from('movie_projects')
                      .select('pending_video_tasks')
                      .eq('id', reqProjectId)
                      .maybeSingle();
                    const pendingMeta = (projMeta?.pending_video_tasks || {}) as Record<string, any>;
                    const totalClips = pendingMeta.clipCount || 3;
                    
                    console.log(`[CheckStatus] 🔗 Triggering continue-production: clip ${shotIndex + 1}/${totalClips}`);
                    
                    const continueResponse = await fetch(`${supabaseUrl}/functions/v1/continue-production`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseKey}`,
                      },
                      body: JSON.stringify({
                        projectId: reqProjectId,
                        userId,
                        completedClipIndex: shotIndex,
                        completedClipResult: {
                          videoUrl: storedVideoUrl,
                          lastFrameUrl: lastFrameUrl || null,
                        },
                        totalClips,
                      }),
                    });
                    
                    if (continueResponse.ok) {
                      console.log(`[CheckStatus] ✅ continue-production triggered successfully`);
                    } else {
                      const errText = await continueResponse.text();
                      console.warn(`[CheckStatus] continue-production returned ${continueResponse.status}: ${errText}`);
                    }
                  } catch (chainErr) {
                    console.error(`[CheckStatus] Failed to chain continue-production:`, chainErr);
                    // Non-fatal: watchdog will eventually pick this up
                  }
                }
              } catch (storeError) {
                console.error(`[CheckStatus] Auto-complete failed:`, storeError);
                // Don't fail the whole request, just report the error
              }
            }
            break;
          case "failed":
            status = "FAILED";
            progress = 0;
            error = prediction.error || "Replicate generation failed";
            
            // Update clip record to failed if autoComplete
            if (autoComplete && reqProjectId && shotIndex !== undefined && userId) {
              try {
                await supabase
                  .from('video_clips')
                  .update({
                    status: 'failed',
                    error_message: error,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('project_id', reqProjectId)
                  .eq('shot_index', shotIndex);
                console.log(`[CheckStatus] Updated clip ${shotIndex + 1} to failed`);
              } catch (updateError) {
                console.warn(`[CheckStatus] Failed to update clip status:`, updateError);
              }
            }
            break;
          case "canceled":
            status = "FAILED";
            progress = 0;
            error = "Generation was canceled";
            break;
          default:
            status = "RUNNING";
            progress = 25;
        }

        await logApiCall(supabase, "status-poll", "replicate-kling", status, reqProjectId, taskId, userId);

        return new Response(
          JSON.stringify({
            success: true,
            status: status,
            progress: progress,
            videoUrl: storedVideoUrl || videoUrl, // Return stored URL if available
            rawVideoUrl: videoUrl,
            audioIncluded: true, // Kling V3 includes native audio
            error: error,
            provider: "replicate",
            model: KLING_MODEL,
            autoCompleted: !!storedVideoUrl,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (replicateError) {
        console.error("Replicate status check error:", replicateError);
        return new Response(
          JSON.stringify({
            success: false,
            status: "FAILED",
            progress: 0,
            videoUrl: null,
            error: replicateError instanceof Error ? replicateError.message : "Replicate status check failed",
            provider: "replicate",
            model: KLING_MODEL,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Unknown provider - return error
    console.log("Unknown provider:", provider);
    return new Response(
      JSON.stringify({
        success: false,
        status: "FAILED",
        progress: 0,
        videoUrl: null,
        error: `Unsupported provider. This system uses Kling V3 via Replicate.`,
        provider: provider,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in check-video-status function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
