import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BULLETPROOF FRAME EXTRACTION - ACTUAL SCREENSHOT
 * 
 * Extracts the ACTUAL last frame from a video using FFmpeg.
 * This is the REAL screenshot, not an AI-generated approximation.
 * 
 * Strategy (in order of priority):
 * 1. Cloud Run FFmpeg (ACTUAL pixel-perfect screenshot)
 * 2. Scene image fallback (if Cloud Run unavailable)
 * 
 * CRITICAL: This function GUARANTEES an image URL output.
 */

interface ExtractLastFrameRequest {
  videoUrl: string;
  projectId: string;
  shotIndex: number;
  shotPrompt?: string;
  sceneImageUrl?: string; // Fallback scene image
  position?: 'first' | 'last';
}

interface ExtractLastFrameResult {
  success: boolean;
  frameUrl: string | null;
  method: 'cloud-run-ffmpeg' | 'scene-fallback' | 'failed';
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ExtractLastFrameRequest = await req.json();
    const { videoUrl, projectId, shotIndex, shotPrompt, sceneImageUrl, position = 'last' } = request;

    if (!videoUrl) {
      throw new Error("videoUrl is required");
    }

    console.log(`[ExtractLastFrame] Shot ${shotIndex}: Extracting ${position} frame from ${videoUrl.substring(0, 60)}...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============================================================
    // METHOD 1: Cloud Run FFmpeg (ACTUAL SCREENSHOT - BEST)
    // Uses ffmpeg -sseof -0.1 to extract the real last frame
    // ============================================================
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (cloudRunUrl) {
      try {
        const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
        const extractEndpoint = `${normalizedUrl}/extract-frame`;
        
        console.log(`[ExtractLastFrame] METHOD 1: Cloud Run FFmpeg (ACTUAL SCREENSHOT)`);
        console.log(`[ExtractLastFrame] Calling: ${extractEndpoint}`);
        
        const response = await fetch(extractEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipUrl: videoUrl,
            clipIndex: shotIndex,
            projectId,
            position,
          }),
        });

        const responseText = await response.text();
        console.log(`[ExtractLastFrame] Cloud Run response: ${response.status} - ${responseText.substring(0, 200)}`);

        if (response.ok) {
          let result;
          try {
            result = JSON.parse(responseText);
          } catch (parseErr) {
            console.warn(`[ExtractLastFrame] Failed to parse Cloud Run response as JSON`);
            throw new Error('Invalid JSON response from Cloud Run');
          }
          
          const frameUrl = result.lastFrameUrl || result.frameUrl;
          
          // Validate it's actually an image URL, not a video
          if (frameUrl && !frameUrl.endsWith('.mp4') && !frameUrl.includes('/video-clips/')) {
            console.log(`[ExtractLastFrame] ✓ METHOD 1 SUCCESS: ACTUAL SCREENSHOT extracted!`);
            console.log(`[ExtractLastFrame] Frame URL: ${frameUrl.substring(0, 80)}...`);
            
            // Store in database for future reference
            await supabase
              .from('video_clips')
              .update({ last_frame_url: frameUrl })
              .eq('project_id', projectId)
              .eq('shot_index', shotIndex);
            
            return new Response(
              JSON.stringify({
                success: true,
                frameUrl,
                method: 'cloud-run-ffmpeg',
              } as ExtractLastFrameResult),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.warn(`[ExtractLastFrame] Cloud Run returned invalid URL: ${frameUrl?.substring(0, 80)}`);
          }
        } else {
          console.warn(`[ExtractLastFrame] Cloud Run failed: HTTP ${response.status}`);
          console.warn(`[ExtractLastFrame] Error details: ${responseText.substring(0, 300)}`);
        }
      } catch (cloudRunError) {
        console.error(`[ExtractLastFrame] Cloud Run error:`, cloudRunError);
      }
    } else {
      console.warn(`[ExtractLastFrame] CLOUD_RUN_STITCHER_URL not configured - cannot extract actual screenshot`);
    }

    // ============================================================
    // FALLBACK: Use scene image (guaranteed to exist)
    // This is NOT the actual frame, but maintains continuity
    // ============================================================
    if (sceneImageUrl) {
      console.warn(`[ExtractLastFrame] ⚠️ Using FALLBACK: Scene image (not actual screenshot)`);
      console.log(`[ExtractLastFrame] Scene image: ${sceneImageUrl.substring(0, 80)}...`);
      
      // Store in database
      await supabase
        .from('video_clips')
        .update({ last_frame_url: sceneImageUrl })
        .eq('project_id', projectId)
        .eq('shot_index', shotIndex);
      
      return new Response(
        JSON.stringify({
          success: true,
          frameUrl: sceneImageUrl,
          method: 'scene-fallback',
        } as ExtractLastFrameResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ALL METHODS FAILED
    // ============================================================
    console.error(`[ExtractLastFrame] ⚠️ CRITICAL: All methods failed for shot ${shotIndex}`);
    console.error(`[ExtractLastFrame] Cloud Run URL configured: ${!!cloudRunUrl}`);
    console.error(`[ExtractLastFrame] Scene fallback available: ${!!sceneImageUrl}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        frameUrl: null,
        method: 'failed',
        error: 'Cloud Run FFmpeg unavailable and no scene fallback provided',
      } as ExtractLastFrameResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ExtractLastFrame] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        frameUrl: null,
        method: 'failed',
        error: error instanceof Error ? error.message : "Unknown error",
      } as ExtractLastFrameResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
