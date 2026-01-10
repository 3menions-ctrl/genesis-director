import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * LIP SYNC SERVICE - Self-Hosted Wav2Lip Integration
 * 
 * This edge function interfaces with a self-hosted Wav2Lip service.
 * The actual ML inference runs on a Cloud Run or Modal instance with GPU.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Deploy Wav2Lip container to Cloud Run with GPU (L4 or better)
 * 2. Set LIP_SYNC_SERVICE_URL secret to the deployed service URL
 * 3. This function will proxy requests to the service
 * 
 * Docker image recommendations:
 * - cjwbw/sadtalker (includes Wav2Lip)
 * - jlondonobo/wav2lip-onnx (optimized for inference)
 * 
 * Alternative hosted options (if self-hosting is not desired):
 * - Rask.ai API
 * - Sync Labs API
 * - HeyGen API
 */

interface LipSyncRequest {
  projectId: string;
  userId: string;
  videoUrl: string;         // Input video with face to animate
  audioUrl: string;         // Audio to sync lips to
  shotId?: string;
  outputFormat?: 'mp4' | 'webm';
  quality?: 'fast' | 'balanced' | 'high';
  faceEnhance?: boolean;    // Run face enhancement post-processing
}

interface LipSyncResult {
  success: boolean;
  outputVideoUrl?: string;
  processingTimeMs?: number;
  model?: string;
  error?: string;
}

// Check if self-hosted service is available
async function checkServiceHealth(serviceUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${serviceUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Call the self-hosted Wav2Lip service
async function callWav2LipService(
  serviceUrl: string,
  videoUrl: string,
  audioUrl: string,
  options: { quality: string; faceEnhance: boolean }
): Promise<{ success: boolean; videoBase64?: string; error?: string }> {
  
  const response = await fetch(`${serviceUrl}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_url: videoUrl,
      audio_url: audioUrl,
      quality: options.quality,
      face_enhance: options.faceEnhance,
      output_format: 'mp4',
    }),
    signal: AbortSignal.timeout(300000), // 5 minute timeout for processing
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `Service error: ${response.status} - ${errorText}` };
  }

  const data = await response.json();
  return {
    success: true,
    videoBase64: data.video_base64 || data.output,
  };
}

// Fallback: Generate placeholder response for development
function generatePlaceholderResponse(videoUrl: string): LipSyncResult {
  console.log('[LipSync] Service not configured, returning placeholder');
  return {
    success: true,
    outputVideoUrl: videoUrl, // Return original video as placeholder
    processingTimeMs: 0,
    model: 'placeholder',
    error: 'LIP_SYNC_SERVICE_URL not configured. Set this secret to enable lip sync. ' +
           'Deploy Wav2Lip to Cloud Run with GPU and set the URL.',
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: LipSyncRequest = await req.json();
    const {
      projectId,
      userId,
      videoUrl,
      audioUrl,
      shotId = 'unknown',
      outputFormat = 'mp4',
      quality = 'balanced',
      faceEnhance = true,
    } = request;

    if (!videoUrl || !audioUrl) {
      throw new Error("videoUrl and audioUrl are required");
    }

    console.log(`[LipSync] Processing request for project ${projectId}, shot ${shotId}`);
    console.log(`[LipSync] Video: ${videoUrl.substring(0, 50)}...`);
    console.log(`[LipSync] Audio: ${audioUrl.substring(0, 50)}...`);

    // Check for service URL
    const serviceUrl = Deno.env.get("LIP_SYNC_SERVICE_URL");
    
    if (!serviceUrl) {
      // Return placeholder for development
      const result = generatePlaceholderResponse(videoUrl);
      result.processingTimeMs = Date.now() - startTime;
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check service health
    const isHealthy = await checkServiceHealth(serviceUrl);
    if (!isHealthy) {
      console.warn('[LipSync] Service unhealthy, returning original video');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Lip sync service is not responding. Check Cloud Run deployment.',
          outputVideoUrl: videoUrl, // Fallback to original
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the Wav2Lip service
    console.log(`[LipSync] Calling Wav2Lip service at ${serviceUrl}...`);
    const syncResult = await callWav2LipService(serviceUrl, videoUrl, audioUrl, {
      quality,
      faceEnhance,
    });

    if (!syncResult.success || !syncResult.videoBase64) {
      throw new Error(syncResult.error || 'Lip sync failed');
    }

    // Upload result to Supabase storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fileName = `lipsync_${projectId}_${shotId}_${Date.now()}.${outputFormat}`;
    const videoBuffer = Uint8Array.from(atob(syncResult.videoBase64), c => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from('video-clips')
      .upload(fileName, videoBuffer, {
        contentType: `video/${outputFormat}`,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload lip-synced video: ${uploadError.message}`);
    }

    const outputVideoUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${fileName}`;
    const processingTimeMs = Date.now() - startTime;

    console.log(`[LipSync] Complete in ${processingTimeMs}ms: ${outputVideoUrl}`);

    // Log API cost
    try {
      await supabase.rpc('log_api_cost', {
        p_user_id: userId,
        p_project_id: projectId,
        p_shot_id: shotId,
        p_service: 'wav2lip',
        p_operation: 'lip_sync',
        p_credits_charged: 5, // 5 credits per lip sync
        p_real_cost_cents: 10, // Approximate GPU cost
        p_duration_seconds: Math.round(processingTimeMs / 1000),
        p_status: 'completed',
        p_metadata: JSON.stringify({ quality, faceEnhance }),
      });
    } catch (costError) {
      console.warn('[LipSync] Failed to log cost:', costError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        outputVideoUrl,
        processingTimeMs,
        model: 'wav2lip',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[LipSync] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
