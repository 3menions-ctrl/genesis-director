import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Video Stitcher Edge Function
 * 
 * Merges multiple video clips into a single seamless production with synchronized audio.
 * Uses cloud-based video processing via external service (Creatomate or similar).
 * 
 * For MVP: Uses client-side concatenation hints and returns a merged video URL
 * For Production: Would integrate with Creatomate, Shotstack, or similar API
 */

interface ShotClip {
  shotId: string;
  videoUrl: string;
  audioUrl?: string;
  durationSeconds: number;
  transitionOut?: string;
}

interface StitchRequest {
  projectId: string;
  projectTitle: string;
  clips: ShotClip[];
  audioMixMode: 'full' | 'dialogue-only' | 'music-only' | 'mute';
  backgroundMusicUrl?: string;
  outputFormat?: 'mp4' | 'webm';
}

interface StitchResult {
  success: boolean;
  finalVideoUrl?: string;
  durationSeconds?: number;
  processingTimeMs?: number;
  error?: string;
}

// For MVP: Create a simple concatenation manifest
// In production, this would call Creatomate/Shotstack API
async function createVideoManifest(
  clips: ShotClip[],
  projectId: string,
  supabase: any
): Promise<string> {
  const manifest = {
    version: "1.0",
    projectId,
    createdAt: new Date().toISOString(),
    clips: clips.map((clip, index) => ({
      index,
      shotId: clip.shotId,
      videoUrl: clip.videoUrl,
      audioUrl: clip.audioUrl,
      duration: clip.durationSeconds,
      transitionOut: clip.transitionOut || 'cut',
      startTime: clips.slice(0, index).reduce((sum, c) => sum + c.durationSeconds, 0),
    })),
    totalDuration: clips.reduce((sum, c) => sum + c.durationSeconds, 0),
  };

  // Save manifest to storage for future processing
  const fileName = `manifest_${projectId}_${Date.now()}.json`;
  const manifestJson = JSON.stringify(manifest, null, 2);
  const bytes = new TextEncoder().encode(manifestJson);

  const { error } = await supabase.storage
    .from('temp-frames')
    .upload(fileName, bytes, {
      contentType: 'application/json',
      upsert: true
    });

  if (error) {
    console.error('[Stitch] Manifest upload error:', error);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;
}

// MVP: Use MediaSource API hints for client-side stitching
// Production: Would use Creatomate or similar cloud video API
async function processStitching(
  request: StitchRequest,
  supabase: any
): Promise<StitchResult> {
  const startTime = Date.now();
  
  try {
    // Validate all clips have valid URLs
    const validClips = request.clips.filter(c => c.videoUrl && c.videoUrl.startsWith('http'));
    
    if (validClips.length === 0) {
      throw new Error("No valid video clips to stitch");
    }

    console.log(`[Stitch] Processing ${validClips.length} clips for project ${request.projectId}`);

    // Calculate total duration
    const totalDuration = validClips.reduce((sum, c) => sum + c.durationSeconds, 0);

    // Create manifest for client-side or future server-side processing
    const manifestUrl = await createVideoManifest(validClips, request.projectId, supabase);

    // For MVP: Return the first clip as the "stitched" video with manifest
    // Client will handle actual playback sequencing using the manifest
    // In production, this would call an external video processing API

    // Check if we should use Creatomate (if API key is set)
    const creatomateKey = Deno.env.get("CREATOMATE_API_KEY");
    
    if (creatomateKey) {
      // Production path: Use Creatomate for real video stitching
      console.log("[Stitch] Using Creatomate for video processing...");
      
      const creatomateResult = await callCreatomate(creatomateKey, validClips, request);
      
      return {
        success: true,
        finalVideoUrl: creatomateResult.url,
        durationSeconds: totalDuration,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // MVP path: Return manifest-based solution for client-side sequential playback
    console.log("[Stitch] Using manifest-based client-side stitching (MVP mode)");

    return {
      success: true,
      finalVideoUrl: manifestUrl, // Client will parse and play sequentially
      durationSeconds: totalDuration,
      processingTimeMs: Date.now() - startTime,
    };

  } catch (error) {
    console.error("[Stitch] Processing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Stitching failed",
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// Creatomate API integration (production)
async function callCreatomate(
  apiKey: string,
  clips: ShotClip[],
  request: StitchRequest
): Promise<{ url: string }> {
  // Build Creatomate render request
  const elements = clips.map((clip, index) => ({
    type: "video",
    source: clip.videoUrl,
    duration: clip.durationSeconds,
    ...(clip.audioUrl && request.audioMixMode !== 'mute' ? {
      audio_source: clip.audioUrl,
    } : {}),
  }));

  const renderRequest = {
    output_format: request.outputFormat || "mp4",
    width: 1920,
    height: 1080,
    frame_rate: 30,
    elements: [{
      type: "composition",
      elements: elements,
    }],
  };

  const response = await fetch("https://api.creatomate.com/v1/renders", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(renderRequest),
  });

  if (!response.ok) {
    throw new Error(`Creatomate API error: ${response.status}`);
  }

  const result = await response.json();
  
  // Poll for completion (simplified - in production would use webhooks)
  let renderUrl = result[0]?.url;
  let status = result[0]?.status;
  const renderId = result[0]?.id;
  
  while (status === "planned" || status === "rendering") {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    
    const statusData = await statusResponse.json();
    status = statusData.status;
    renderUrl = statusData.url;
    
    console.log(`[Stitch] Creatomate render status: ${status}`);
  }

  if (status !== "succeeded") {
    throw new Error(`Creatomate render failed with status: ${status}`);
  }

  return { url: renderUrl };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: StitchRequest = await req.json();

    if (!request.clips || request.clips.length === 0) {
      throw new Error("No clips provided for stitching");
    }

    if (!request.projectId) {
      throw new Error("Project ID is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[Stitch] Starting video stitching for project: ${request.projectId}`);
    console.log(`[Stitch] Clips to process: ${request.clips.length}`);
    console.log(`[Stitch] Audio mix mode: ${request.audioMixMode}`);

    const result = await processStitching(request, supabase);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Stitch] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
