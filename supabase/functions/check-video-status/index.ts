import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getAccessToken } from "../_shared/gcp-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Kling API configuration
const KLING_API_BASE = "https://api.klingai.com/v1";

// Generate Kling JWT token
async function generateKlingJWT(): Promise<string> {
  const accessKey = Deno.env.get("KLING_ACCESS_KEY");
  const secretKey = Deno.env.get("KLING_SECRET_KEY");
  
  if (!accessKey || !secretKey) {
    throw new Error("KLING_ACCESS_KEY or KLING_SECRET_KEY is not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 1800, // 30 minutes
    nbf: now - 5,    // 5 seconds buffer
  };

  // Create JWT header
  const header = { alg: "HS256", typ: "JWT" };
  
  // Base64URL encode
  const base64UrlEncode = (obj: object): string => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const message = `${headerEncoded}.${payloadEncoded}`;

  // Sign with HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const signatureArray = new Uint8Array(signature);
  
  // Convert to base64url
  let binary = '';
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }
  const signatureBase64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${message}.${signatureBase64}`;
}

// Log API calls for cost tracking
async function logApiCall(
  supabase: any,
  operation: string,
  service: string,
  status: string,
  projectId?: string,
  shotId?: string,
  userId?: string
) {
  try {
    const POLL_COST_CENTS = 0.01;
    
    await supabase.rpc('log_api_cost', {
      p_service: service,
      p_operation: operation,
      p_real_cost_cents: Math.round(POLL_COST_CENTS * 100) / 100,
      p_credits_charged: 0,
      p_status: status,
      p_project_id: projectId || null,
      p_shot_id: shotId || 'status-poll',
      p_user_id: userId || null,
      p_metadata: { timestamp: new Date().toISOString() }
    });
  } catch (err) {
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

    // Handle Kling Direct API - PRIMARY PROVIDER
    if (provider === "kling") {
      try {
        const jwtToken = await generateKlingJWT();
        
        // Query Kling task status
        const statusUrl = `${KLING_API_BASE}/videos/tasks/${taskId}`;
        
        console.log("Polling Kling task:", statusUrl);
        
        const response = await fetch(statusUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${jwtToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Kling API error:", response.status, errorText);
          throw new Error(`Kling API error: ${response.status}`);
        }

        const result = await response.json();
        const taskData = result.data || result;
        
        console.log("Kling task status:", {
          task_id: taskData.task_id,
          task_status: taskData.task_status,
        });

        // Map Kling status to our standard status
        // Kling statuses: submitted, processing, succeed, failed
        let status = "RUNNING";
        let progress = 0;
        let videoUrl = null;
        let error = null;

        switch (taskData.task_status) {
          case "submitted":
            status = "STARTING";
            progress = 10;
            break;
          case "processing":
            status = "RUNNING";
            progress = 50;
            break;
          case "succeed":
            status = "SUCCEEDED";
            progress = 100;
            // Extract video URL from works array
            if (taskData.task_result?.videos && taskData.task_result.videos.length > 0) {
              videoUrl = taskData.task_result.videos[0].url;
            }
            break;
          case "failed":
            status = "FAILED";
            progress = 0;
            error = taskData.task_status_msg || "Kling generation failed";
            break;
          default:
            status = "RUNNING";
            progress = 25;
        }

        await logApiCall(supabase, "status-poll", "kling", status, reqProjectId, taskId, userId);

        return new Response(
          JSON.stringify({
            success: true,
            status: status,
            progress: progress,
            videoUrl: videoUrl,
            error: error,
            provider: "kling",
            model: "kling-v2-1-master",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (klingError) {
        console.error("Kling status check error:", klingError);
        return new Response(
          JSON.stringify({
            success: false,
            status: "FAILED",
            progress: 0,
            videoUrl: null,
            error: klingError instanceof Error ? klingError.message : "Kling status check failed",
            provider: "kling",
            model: "kling-v2-1-master",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
      await logApiCall(
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

    // Unknown provider - return error
    console.log("Unknown provider for task:", taskId, provider);
    return new Response(
      JSON.stringify({
        success: false,
        status: "FAILED",
        progress: 0,
        videoUrl: null,
        error: `Unknown provider: ${provider}. Supported providers are: kling, veo3`,
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
