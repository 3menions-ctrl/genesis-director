import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * HYBRID ARCHITECTURE - FRAME EXTRACTION
 * 
 * Uses TWO Supabase projects:
 * - Lovable Cloud (ahlikyhgcqvrdvbtkghh): Main app, auth, video_clips table
 * - External Supabase (bayqvrqkfmfnugksydrw): Video/frame storage, Cloud Run integration
 * 
 * Strategy:
 * 1. Cloud Run FFmpeg extracts actual frame, returns base64
 * 2. This edge function uploads to EXTERNAL Supabase storage
 * 3. Updates video_clips table in LOVABLE Cloud
 * 4. Fallback: Use scene image if Cloud Run fails
 */

interface ExtractLastFrameRequest {
  videoUrl: string;
  projectId: string;
  shotIndex: number;
  shotPrompt?: string;
  sceneImageUrl?: string;
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

    console.log(`[ExtractLastFrame] Shot ${shotIndex}: Extracting ${position} frame`);
    console.log(`[ExtractLastFrame] Video URL: ${videoUrl.substring(0, 80)}...`);

    // ============================================================
    // HYBRID ARCHITECTURE: Initialize BOTH Supabase clients
    // ============================================================
    
    // Lovable Cloud - for updating video_clips table
    const lovableSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // External Supabase - for video/frame storage (used by Cloud Run)
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
    
    const externalSupabase = externalUrl && externalKey 
      ? createClient(externalUrl, externalKey)
      : null;

    console.log(`[ExtractLastFrame] Lovable Cloud: ${Deno.env.get("SUPABASE_URL")?.substring(0, 40)}...`);
    console.log(`[ExtractLastFrame] External Supabase: ${externalUrl ? externalUrl.substring(0, 40) + '...' : 'NOT CONFIGURED'}`);

    // ============================================================
    // METHOD 1: Cloud Run FFmpeg with base64 return
    // ============================================================
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (cloudRunUrl) {
      try {
        const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
        const extractEndpoint = `${normalizedUrl}/extract-frame`;
        
        console.log(`[ExtractLastFrame] METHOD 1: Cloud Run FFmpeg`);
        console.log(`[ExtractLastFrame] Calling: ${extractEndpoint}`);
        
        const response = await fetch(extractEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipUrl: videoUrl,
            clipIndex: shotIndex,
            projectId,
            position,
            returnBase64: true, // Request base64 instead of direct upload
          }),
        });

        const responseText = await response.text();
        console.log(`[ExtractLastFrame] Cloud Run response: ${response.status}`);

        if (response.ok) {
          let result;
          try {
            result = JSON.parse(responseText);
          } catch (parseErr) {
            console.warn(`[ExtractLastFrame] Failed to parse Cloud Run response`);
            throw new Error('Invalid JSON response from Cloud Run');
          }
          
          // Check if Cloud Run returned base64 data
          if (result.frameBase64) {
            console.log(`[ExtractLastFrame] Got base64 frame from Cloud Run, uploading to storage...`);
            
            // Decode base64 and upload to appropriate storage
            const base64Data = result.frameBase64.replace(/^data:image\/\w+;base64,/, '');
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const filename = `${projectId}/shot-${shotIndex}-lastframe-${Date.now()}.jpg`;
            
            // Try external storage first, fall back to Lovable Cloud storage
            const storageClient = externalSupabase || lovableSupabase;
            const storageBucket = 'temp-frames';
            
            console.log(`[ExtractLastFrame] Uploading to ${externalSupabase ? 'EXTERNAL' : 'LOVABLE'} storage...`);
            
            const { error: uploadError } = await storageClient.storage
              .from(storageBucket)
              .upload(filename, binaryData, {
                contentType: 'image/jpeg',
                upsert: true
              });

            if (!uploadError) {
              const { data: urlData } = storageClient.storage
                .from(storageBucket)
                .getPublicUrl(filename);
              
              const frameUrl = urlData.publicUrl;
              console.log(`[ExtractLastFrame] ✓ Frame uploaded: ${frameUrl.substring(0, 80)}...`);
              
              // Update video_clips in Lovable Cloud
              await lovableSupabase
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
              console.error(`[ExtractLastFrame] Storage upload failed:`, uploadError);
            }
          }
          
          // Legacy: Cloud Run uploaded directly and returned URL
          const frameUrl = result.lastFrameUrl || result.frameUrl;
          if (frameUrl && !frameUrl.endsWith('.mp4') && !frameUrl.includes('/video-clips/')) {
            console.log(`[ExtractLastFrame] ✓ Cloud Run uploaded directly: ${frameUrl.substring(0, 80)}...`);
            
            await lovableSupabase
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
          }
        } else {
          console.warn(`[ExtractLastFrame] Cloud Run failed: HTTP ${response.status}`);
          console.warn(`[ExtractLastFrame] Error: ${responseText.substring(0, 200)}`);
        }
      } catch (cloudRunError) {
        console.error(`[ExtractLastFrame] Cloud Run error:`, cloudRunError);
      }
    } else {
      console.warn(`[ExtractLastFrame] CLOUD_RUN_STITCHER_URL not configured`);
    }

    // ============================================================
    // FALLBACK: Use scene image
    // ============================================================
    if (sceneImageUrl) {
      console.warn(`[ExtractLastFrame] ⚠️ FALLBACK: Using scene image`);
      console.log(`[ExtractLastFrame] Scene image: ${sceneImageUrl.substring(0, 80)}...`);
      
      await lovableSupabase
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
    console.error(`[ExtractLastFrame] ❌ All methods failed for shot ${shotIndex}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        frameUrl: null,
        method: 'failed',
        error: 'Cloud Run FFmpeg failed and no scene fallback provided',
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
