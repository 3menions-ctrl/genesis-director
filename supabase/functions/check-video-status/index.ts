import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getAccessToken } from "../_shared/gcp-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Log GCP API calls for accurate cost tracking
async function logGcpApiCall(
  supabase: any,
  operation: string,
  service: string,
  status: string,
  projectId?: string,
  shotId?: string,
  userId?: string
) {
  try {
    // Status polls cost ~$0.0001 each (minimal but adds up)
    const POLL_COST_CENTS = 0.01; // $0.0001 per poll
    
    await supabase.rpc('log_api_cost', {
      p_service: service,
      p_operation: operation,
      p_real_cost_cents: Math.round(POLL_COST_CENTS * 100) / 100,
      p_credits_charged: 0, // Polls don't charge user credits
      p_status: status,
      p_project_id: projectId || null,
      p_shot_id: shotId || 'status-poll',
      p_user_id: userId || null,
      p_metadata: { timestamp: new Date().toISOString() }
    });
  } catch (err) {
    // Don't fail the request if logging fails
    console.warn('[Cost Log] Failed to log API call:', err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client for logging
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { taskId, provider = "kling", projectId: reqProjectId, userId } = await req.json();

    if (!taskId) {
      throw new Error("Task ID is required");
    }

    console.log("Checking video status for task:", taskId, "provider:", provider);

    // Handle Kling (Replicate) - PRIMARY PROVIDER
    if (provider === "kling" || provider === "replicate") {
      const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
      if (!REPLICATE_API_KEY) {
        throw new Error("REPLICATE_API_KEY is not configured");
      }

      const replicate = new Replicate({ auth: REPLICATE_API_KEY });
      const prediction = await replicate.predictions.get(taskId);

      console.log("Kling/Replicate prediction:", {
        id: prediction.id,
        status: prediction.status,
        model: prediction.model,
      });

      if (prediction.status === "failed" && prediction.error) {
        console.error("Kling prediction failed with error:", prediction.error);
        return new Response(
          JSON.stringify({
            success: true,
            status: "FAILED",
            progress: 0,
            videoUrl: null,
            error: prediction.error,
            provider: "kling",
            model: "kling-v2.0-master",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let status = prediction.status.toUpperCase();
      if (status === "PROCESSING" || status === "STARTING") status = "RUNNING";
      if (status === "SUCCEEDED") status = "SUCCEEDED";
      if (status === "FAILED" || status === "CANCELED") status = "FAILED";

      let videoUrl = null;
      if (prediction.output) {
        if (typeof prediction.output === "string") {
          videoUrl = prediction.output;
        } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
          videoUrl = prediction.output[0];
        } else if (typeof prediction.output === "object" && prediction.output.video) {
          videoUrl = prediction.output.video;
        }
      }

      // Calculate progress based on status
      let progress = 0;
      if (status === "SUCCEEDED") progress = 100;
      else if (status === "RUNNING") progress = prediction.logs ? 50 : 25;
      else if (status === "STARTING") progress = 10;

      return new Response(
        JSON.stringify({
          success: true,
          status: status,
          progress: progress,
          videoUrl: videoUrl,
          error: prediction.error || null,
          provider: "kling",
          model: "kling-v2.0-master",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle Vertex AI (Google Veo 3.1) - FALLBACK PROVIDER
    if (provider === "vertex-ai" || provider === "veo3" || taskId.includes("projects/")) {
      const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
      if (!serviceAccountJson) {
        throw new Error("GOOGLE_VERTEX_SERVICE_ACCOUNT is not configured");
      }

      const serviceAccount = JSON.parse(serviceAccountJson);
      const accessToken = await getAccessToken(serviceAccount);

      // Extract project ID, location, and model from the task ID
      const taskMatch = taskId.match(/projects\/([^\/]+)\/locations\/([^\/]+)\/publishers\/google\/models\/([^\/]+)\/operations\/([^\/]+)/);
      if (!taskMatch) {
        throw new Error("Invalid Veo3 task ID format");
      }
      
      const [, gcpProjectId, location, modelId, operationId] = taskMatch;
      
      const fetchOperationUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;
      
      console.log("Polling Veo3 operation:", fetchOperationUrl);
      
      // Log the GCP API poll call
      await logGcpApiCall(
        supabase,
        'status_poll',
        'google_veo_poll',
        'pending',
        reqProjectId,
        operationId,
        userId
      );
      
      const response = await fetch(fetchOperationUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationName: taskId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Veo3 operation error:", response.status, errorText);
        throw new Error(`Veo3 error: ${response.status}`);
      }

      const operation = await response.json();
      console.log("Veo3 operation:", JSON.stringify(operation).substring(0, 500));

      // Check if operation is complete
      if (operation.done) {
        if (operation.error) {
          console.error("Veo3 operation failed:", operation.error);
          return new Response(
            JSON.stringify({
              success: true,
              status: "FAILED",
              progress: 0,
              videoUrl: null,
              error: operation.error.message || "Video generation failed",
              provider: "veo3",
              model: "veo-3.1-generate-001",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Extract video URL from response
        const result = operation.response;
        
        // Check for content filter (RAI) blocking
        if (result?.raiMediaFilteredCount > 0) {
          const filterReasons = result.raiMediaFilteredReasons || [];
          console.warn("Video blocked by content filter:", filterReasons);
          
          return new Response(
            JSON.stringify({
              success: true,
              status: "CONTENT_FILTERED",
              progress: 100,
              videoUrl: null,
              error: "Content filter blocked generation. Prompt needs rephrasing.",
              contentFilterReason: filterReasons[0] || "Content policy violation",
              provider: "veo3",
              model: "veo-3.1-generate-001",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        let videoUrl = null;

        if (result?.generatedSamples?.[0]?.video?.uri) {
          videoUrl = result.generatedSamples[0].video.uri;
        } else if (result?.videos?.[0]?.gcsUri) {
          videoUrl = result.videos[0].gcsUri;
        } else if (result?.videos?.[0]?.uri) {
          videoUrl = result.videos[0].uri;
        } else if (result?.videos?.[0]?.bytesBase64Encoded) {
          // Video returned as base64 - upload to Supabase storage
          console.log("Video returned as base64, uploading to storage...");
          
          try {
            const base64Data = result.videos[0].bytesBase64Encoded;
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            const fileName = `veo-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`;
            const filePath = `generated-videos/${fileName}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("video-clips")
              .upload(filePath, binaryData, {
                contentType: "video/mp4",
                upsert: true,
              });
            
            if (uploadError) {
              console.error("Failed to upload video to storage:", uploadError);
              videoUrl = `data:video/mp4;base64,${base64Data.substring(0, 100)}...`;
            } else {
              const { data: publicUrl } = supabase.storage
                .from("video-clips")
                .getPublicUrl(filePath);
              
              videoUrl = publicUrl.publicUrl;
              console.log("Video uploaded to storage:", videoUrl);
            }
          } catch (uploadErr) {
            console.error("Error uploading video:", uploadErr);
            videoUrl = "upload-failed";
          }
        }

        console.log("Veo3 generation complete, video URL:", videoUrl);

        return new Response(
          JSON.stringify({
            success: true,
            status: "SUCCEEDED",
            progress: 100,
            videoUrl: videoUrl,
            error: null,
            provider: "veo3",
            model: "veo-3.1-generate-001",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Still processing
      const metadata = operation.metadata || {};
      const progress = metadata.progressPercent || 50;

      return new Response(
        JSON.stringify({
          success: true,
          status: "RUNNING",
          progress: progress,
          videoUrl: null,
          error: null,
          provider: "veo3",
          model: "veo-3.1-generate-001",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown provider - try Replicate as fallback for legacy tasks
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const replicate = new Replicate({ auth: REPLICATE_API_KEY });
    const prediction = await replicate.predictions.get(taskId);

    console.log("Legacy Replicate prediction:", {
      id: prediction.id,
      status: prediction.status,
    });

    let status = prediction.status.toUpperCase();
    if (status === "PROCESSING") status = "RUNNING";

    let videoUrl = null;
    if (prediction.output) {
      if (typeof prediction.output === "string") {
        videoUrl = prediction.output;
      } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
        videoUrl = prediction.output[0];
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: status,
        progress: prediction.status === "succeeded" ? 100 : 50,
        videoUrl: videoUrl,
        error: prediction.error || null,
        provider: "replicate",
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
