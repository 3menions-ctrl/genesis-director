import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Extract Video Frame v4.0 - NO AI GENERATION
 * 
 * Extracts a specific frame from a video using Cloud Run FFmpeg.
 * AGGRESSIVE RETRY - will retry up to 10 times before failing.
 * 
 * NO AI IMAGE GENERATION - only real frame extraction.
 * If extraction fails, caller must handle retry at pipeline level.
 */

interface ExtractFrameRequest {
  videoUrl: string;
  projectId: string;
  shotId: string;
  position: 'first' | 'last' | 'middle' | number;
}

// Exponential backoff with jitter
function calculateBackoff(attempt: number, baseMs = 2000, maxMs = 30000): number {
  const exponentialDelay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = exponentialDelay * (0.1 + Math.random() * 0.2);
  return Math.floor(exponentialDelay + jitter);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ExtractFrameRequest = await req.json();
    const { videoUrl, projectId, shotId, position = 'last' } = request;

    if (!videoUrl) {
      throw new Error("videoUrl is required");
    }

    console.log(`[ExtractFrame] Extracting ${position} frame from ${videoUrl.substring(0, 60)}...`);
    console.log(`[ExtractFrame] NO AI GENERATION - Cloud Run FFmpeg only`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Helper to upload base64 frame to storage
    const uploadFrame = async (base64Data: string): Promise<string | null> => {
      try {
        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
        
        const fileName = `frame_${projectId}_${shotId}_${position}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('temp-frames')
          .upload(fileName, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.warn(`[ExtractFrame] Upload failed:`, uploadError.message);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('temp-frames')
          .getPublicUrl(fileName);
        
        console.log(`[ExtractFrame] ✓ Frame uploaded: ${urlData.publicUrl.substring(0, 80)}...`);
        return urlData.publicUrl;
      } catch (err) {
        console.warn(`[ExtractFrame] Upload error:`, err);
        return null;
      }
    };

    // Validate frame URL
    const isValidFrameUrl = (url: string | undefined): boolean => {
      if (!url) return false;
      const lower = url.toLowerCase();
      if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) return false;
      if (lower.includes('/video-clips/') || lower.includes('video/mp4')) return false;
      return true;
    };

    // ============================================================
    // CLOUD RUN FFMPEG - AGGRESSIVE RETRY (10 attempts)
    // This is the ONLY method. No AI generation fallback.
    // ============================================================
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    const MAX_RETRIES = 10;
    
    if (!cloudRunUrl) {
      console.error(`[ExtractFrame] ❌ CRITICAL: CLOUD_RUN_STITCHER_URL not configured!`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "CLOUD_RUN_STITCHER_URL not configured. Cannot extract frames.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Exponential backoff with jitter on retries
        if (attempt > 0) {
          const backoffMs = calculateBackoff(attempt - 1);
          console.log(`[ExtractFrame] 🔄 Retry ${attempt + 1}/${MAX_RETRIES}, waiting ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
        
        const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
        const extractEndpoint = `${normalizedUrl}/extract-frame`;
        
        console.log(`[ExtractFrame] Cloud Run FFmpeg attempt ${attempt + 1}/${MAX_RETRIES}`);
        
        const controller = new AbortController();
        // Increase timeout on later attempts
        const timeoutMs = 30000 + (attempt * 5000);
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(extractEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipUrl: videoUrl,
            clipIndex: shotId,
            projectId,
            position,
            returnBase64: true,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          
          // Handle base64 response (preferred - hybrid architecture)
          if (result.frameBase64) {
            console.log(`[ExtractFrame] Got base64 from Cloud Run, uploading to storage...`);
            const frameUrl = await uploadFrame(result.frameBase64);
            
            if (frameUrl && isValidFrameUrl(frameUrl)) {
              console.log(`[ExtractFrame] ✅ SUCCESS on attempt ${attempt + 1}: ${frameUrl.substring(0, 80)}...`);
              
              return new Response(
                JSON.stringify({
                  success: true,
                  frameUrl,
                  position: String(position),
                  method: 'cloud-run-ffmpeg',
                  retryCount: attempt,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
          
          // Handle direct URL response (legacy)
          const frameUrl = result.lastFrameUrl || result.frameUrl;
          if (frameUrl && isValidFrameUrl(frameUrl)) {
            console.log(`[ExtractFrame] ✅ SUCCESS (direct URL) on attempt ${attempt + 1}: ${frameUrl.substring(0, 80)}...`);
            
            return new Response(
              JSON.stringify({
                success: true,
                frameUrl,
                position: String(position),
                method: 'cloud-run-ffmpeg',
                retryCount: attempt,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Response OK but no valid frame - retry
          console.warn(`[ExtractFrame] Attempt ${attempt + 1}: OK response but no valid frame, retrying...`);
          continue;
        } else {
          const errorText = await response.text();
          console.warn(`[ExtractFrame] Attempt ${attempt + 1}: HTTP ${response.status} - ${errorText.substring(0, 150)}`);
          continue;
        }
      } catch (cloudRunError) {
        const errorMsg = cloudRunError instanceof Error ? cloudRunError.message : 'Unknown error';
        console.warn(`[ExtractFrame] Attempt ${attempt + 1} error: ${errorMsg}`);
        continue;
      }
    }

    // ============================================================
    // ALL ATTEMPTS FAILED
    // Return error - caller must handle retry at pipeline level
    // ============================================================
    console.error(`[ExtractFrame] ❌ FAILED after ${MAX_RETRIES} attempts`);
    console.error(`[ExtractFrame] Video: ${videoUrl}`);
    console.error(`[ExtractFrame] Caller should retry entire clip or use reference image as anchor`);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Frame extraction failed after ${MAX_RETRIES} Cloud Run attempts. Retry clip generation or ensure reference images are available.`,
        videoUrl,
        retryCount: MAX_RETRIES,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ExtractFrame] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
