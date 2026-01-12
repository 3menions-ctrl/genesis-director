import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getAccessToken } from "../_shared/gcp-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskId, provider = "vertex-ai" } = await req.json();

    if (!taskId) {
      throw new Error("Task ID is required");
    }

    console.log("Checking video status for task:", taskId, "provider:", provider);

    // Handle Vertex AI (Google Veo 3.1)
    if (provider === "vertex-ai" || taskId.includes("projects/")) {
      const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
      if (!serviceAccountJson) {
        throw new Error("GOOGLE_VERTEX_SERVICE_ACCOUNT is not configured");
      }

      const serviceAccount = JSON.parse(serviceAccountJson);
      const accessToken = await getAccessToken(serviceAccount);

      // Extract project ID, location, and model from the task ID
      // Format: projects/{project}/locations/{location}/publishers/google/models/{model}/operations/{operation_id}
      const taskMatch = taskId.match(/projects\/([^\/]+)\/locations\/([^\/]+)\/publishers\/google\/models\/([^\/]+)\/operations\/([^\/]+)/);
      if (!taskMatch) {
        throw new Error("Invalid task ID format");
      }
      
      const [, projectId, location, modelId, operationId] = taskMatch;
      
      // Use the fetchPredictOperation endpoint for Veo operations
      // This is a POST request with the operation name in the body
      const fetchOperationUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;
      
      console.log("Polling Vertex AI operation:", fetchOperationUrl);
      console.log("Operation name:", taskId);
      
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
        console.error("Vertex AI operation error:", response.status, errorText);
        throw new Error(`Vertex AI error: ${response.status}`);
      }

      const operation = await response.json();
      console.log("Vertex AI operation:", JSON.stringify(operation).substring(0, 500));

      // Check if operation is complete
      if (operation.done) {
        if (operation.error) {
          console.error("Vertex AI operation failed:", operation.error);
          return new Response(
            JSON.stringify({
              success: true,
              status: "FAILED",
              progress: 0,
              videoUrl: null,
              error: operation.error.message || "Video generation failed",
              provider: "vertex-ai",
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
              provider: "vertex-ai",
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
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const supabase = createClient(supabaseUrl, supabaseKey);
            
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
              // Return base64 as data URL fallback
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
        } else if (result?.predictions?.[0]?.bytesBase64Encoded) {
          // Alternative format - also upload to storage
          console.log("Video in predictions format as base64");
          videoUrl = "base64-encoded";
        }

        console.log("Veo 3.1 generation complete, video URL:", videoUrl);

        return new Response(
          JSON.stringify({
            success: true,
            status: "SUCCEEDED",
            progress: 100,
            videoUrl: videoUrl,
            error: null,
            provider: "vertex-ai",
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
          provider: "vertex-ai",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback to Replicate for legacy tasks
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const replicate = new Replicate({ auth: REPLICATE_API_KEY });
    const prediction = await replicate.predictions.get(taskId);

    console.log("Replicate prediction:", {
      id: prediction.id,
      status: prediction.status,
      model: prediction.model,
      version: prediction.version,
    });

    if (prediction.status === "failed" && prediction.error) {
      console.error("Replicate prediction failed with error:", prediction.error);
    }

    let status = prediction.status.toUpperCase();
    if (status === "PROCESSING") status = "RUNNING";
    if (status === "SUCCEEDED") status = "SUCCEEDED";
    if (status === "FAILED") status = "FAILED";

    let videoUrl = null;
    if (prediction.output) {
      if (typeof prediction.output === "string") {
        videoUrl = prediction.output;
      } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
        videoUrl = prediction.output[0];
      } else if (prediction.output.video) {
        videoUrl = prediction.output.video;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: status,
        progress: prediction.status === "succeeded" ? 100 : (prediction.status === "processing" ? 50 : 0),
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
