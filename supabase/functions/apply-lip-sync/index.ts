import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * APPLY-LIP-SYNC Edge Function
 * 
 * Post-processes avatar videos with Kling Lip-Sync to achieve 100% audio-visual sync.
 * Takes a video URL and audio URL, returns a lip-synced video.
 * 
 * Uses: kwaivgi/kling-lip-sync on Replicate
 * - Accepts video (2-10s, 720p-1080p) + audio (mp3/wav, <5MB)
 * - Returns lip-synced video with matched mouth movements
 */

interface LipSyncRequest {
  videoUrl: string;       // Source video URL (from Kling generation)
  audioUrl: string;       // Audio to sync lips to (from TTS)
  projectId?: string;     // For logging/tracking
  clipIndex?: number;     // Which clip in multi-clip project
}

interface LipSyncResponse {
  success: boolean;
  syncedVideoUrl?: string;
  predictionId?: string;
  error?: string;
  processingTime?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

  if (!REPLICATE_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "REPLICATE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const request: LipSyncRequest = await req.json();
    const { videoUrl, audioUrl, projectId, clipIndex = 0 } = request;

    if (!videoUrl || !audioUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Both videoUrl and audioUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[LipSync] ═══════════════════════════════════════════════════════════`);
    console.log(`[LipSync] Starting lip-sync for ${projectId || 'unknown'} clip ${clipIndex + 1}`);
    console.log(`[LipSync] Video: ${videoUrl.substring(0, 80)}...`);
    console.log(`[LipSync] Audio: ${audioUrl.substring(0, 80)}...`);

    // Start Kling Lip-Sync prediction
    const lipSyncResponse = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-lip-sync/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          video_url: videoUrl,
          audio_file: audioUrl,
        },
      }),
    });

    if (!lipSyncResponse.ok) {
      const errorText = await lipSyncResponse.text();
      console.error(`[LipSync] ❌ Replicate API error: ${lipSyncResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Lip-sync API error: ${lipSyncResponse.status}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prediction = await lipSyncResponse.json();
    console.log(`[LipSync] Prediction started: ${prediction.id}`);

    // Poll for completion (lip-sync is typically faster than generation)
    const maxWaitMs = 120000; // 2 minutes max wait
    const pollIntervalMs = 3000;
    let elapsed = 0;
    let finalOutput: string | null = null;

    while (elapsed < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      elapsed += pollIntervalMs;

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });

      if (!statusResponse.ok) {
        console.error(`[LipSync] Status check failed: ${statusResponse.status}`);
        continue;
      }

      const status = await statusResponse.json();

      if (status.status === "succeeded") {
        // Output can be a string URL or an object with url() method
        finalOutput = typeof status.output === 'string' 
          ? status.output 
          : status.output?.url || status.output;
        console.log(`[LipSync] ✅ Lip-sync complete: ${finalOutput?.substring(0, 80)}...`);
        break;
      } else if (status.status === "failed" || status.status === "canceled") {
        console.error(`[LipSync] ❌ Prediction failed: ${status.error || 'Unknown error'}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Lip-sync failed: ${status.error || 'Processing error'}`,
            predictionId: prediction.id,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[LipSync] ⏳ Status: ${status.status}, elapsed: ${elapsed / 1000}s`);
    }

    if (!finalOutput) {
      console.error(`[LipSync] ❌ Timed out after ${maxWaitMs / 1000}s`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Lip-sync timed out",
          predictionId: prediction.id,
        }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processingTime = Date.now() - startTime;
    console.log(`[LipSync] ✅ Complete in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        syncedVideoUrl: finalOutput,
        predictionId: prediction.id,
        processingTime,
      } as LipSyncResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[LipSync] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
