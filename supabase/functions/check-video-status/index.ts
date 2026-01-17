import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Kling API configuration - Kling 2.6 ONLY
const KLING_API_BASE = "https://api.klingai.com/v1";
const KLING_MODEL = "kling-v2-6-master";

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
            audioIncluded: true, // Kling 2.6 includes native audio
            error: error,
            provider: "kling",
            model: KLING_MODEL,
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
            model: KLING_MODEL,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Kling is the only provider - return error for unknown
    console.log("Unknown task format:", taskId, provider);
    return new Response(
      JSON.stringify({
        success: false,
        status: "FAILED",
        progress: 0,
        videoUrl: null,
        error: `Unsupported task. This system uses Kling 2.6 only.`,
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
