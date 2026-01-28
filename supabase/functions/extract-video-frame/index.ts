import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Extract Video Frame v5.0 - REPLICATE-BASED
 * 
 * Extracts a specific frame from a video using Replicate's frame extraction.
 * NO CLOUD RUN DEPENDENCY - Uses Replicate API for reliable frame extraction.
 * 
 * TIER 1: Replicate frame extraction
 * TIER 2: Fallback to reference images from database
 */

interface ExtractFrameRequest {
  videoUrl: string;
  projectId: string;
  shotId: string;
  position: 'first' | 'last' | 'middle' | number;
  referenceImageUrl?: string;
}

interface ExtractFrameResult {
  success: boolean;
  frameUrl?: string;
  position?: string;
  method: 'replicate-extract' | 'reference-fallback' | 'db-fallback' | 'failed';
  retryCount?: number;
  error?: string;
}

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ExtractFrameRequest = await req.json();
    const { videoUrl, projectId, shotId, position = 'last', referenceImageUrl } = request;

    if (!videoUrl) {
      throw new Error("videoUrl is required");
    }

    console.log(`[ExtractFrame] Extracting ${position} frame from ${videoUrl.substring(0, 60)}...`);
    console.log(`[ExtractFrame] Using Replicate-based extraction (no Cloud Run)`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    // Helper to upload frame to storage
    const downloadAndStore = async (frameUrl: string): Promise<string | null> => {
      try {
        const response = await fetch(frameUrl);
        if (!response.ok) {
          console.warn(`[ExtractFrame] Failed to download frame: ${response.status}`);
          return null;
        }
        
        const imageData = await response.arrayBuffer();
        const filename = `${projectId}/frame-${shotId}-${position}-${Date.now()}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('temp-frames')
          .upload(filename, new Uint8Array(imageData), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.warn(`[ExtractFrame] Storage upload failed:`, uploadError);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('temp-frames')
          .getPublicUrl(filename);
        
        return urlData.publicUrl;
      } catch (err) {
        console.warn(`[ExtractFrame] Download/upload error:`, err);
        return null;
      }
    };

    // Validate frame URL
    const isValidFrameUrl = (url: string | undefined): boolean => {
      if (!url) return false;
      const lower = url.toLowerCase();
      if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) return false;
      if (lower.includes('/video-clips/') && !lower.includes('frame')) return false;
      if (lower.includes('video/mp4')) return false;
      return true;
    };

    // ============================================================
    // TIER 1: Replicate Frame Extraction
    // ============================================================
    if (REPLICATE_API_KEY) {
      const MAX_RETRIES = 3;
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const backoffMs = 2000 * attempt;
            console.log(`[ExtractFrame] 🔄 Retry ${attempt + 1}/${MAX_RETRIES}, waiting ${backoffMs}ms...`);
            await sleep(backoffMs);
          }
          
          console.log(`[ExtractFrame] TIER 1: Replicate extraction attempt ${attempt + 1}/${MAX_RETRIES}`);
          
          // Start a prediction to extract frames
          const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${REPLICATE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              version: "a97a0a2e37ef87f7175ad88ba6ac019e51e6c3fc447c72a47c6a0d364a34d6b0",
              input: {
                video: videoUrl,
                fps: 1,
                format: "jpg"
              }
            }),
          });
          
          if (!predictionResponse.ok) {
            const errorText = await predictionResponse.text();
            console.warn(`[ExtractFrame] Replicate prediction start failed: ${predictionResponse.status} - ${errorText.substring(0, 100)}`);
            
            if (predictionResponse.status === 404 || predictionResponse.status === 422) {
              console.log(`[ExtractFrame] Frame extraction model unavailable, using fallback...`);
              break;
            }
            continue;
          }
          
          const prediction = await predictionResponse.json();
          console.log(`[ExtractFrame] Prediction started: ${prediction.id}`);
          
          // Poll for completion (max 60 seconds)
          const maxPollTime = 60000;
          const pollInterval = 2000;
          const startTime = Date.now();
          
          while (Date.now() - startTime < maxPollTime) {
            await sleep(pollInterval);
            
            const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
              headers: {
                'Authorization': `Bearer ${REPLICATE_API_KEY}`,
              },
            });
            
            if (!statusResponse.ok) {
              console.warn(`[ExtractFrame] Status check failed: ${statusResponse.status}`);
              continue;
            }
            
            const status = await statusResponse.json();
            
            if (status.status === 'succeeded') {
              const frames = status.output;
              
              if (Array.isArray(frames) && frames.length > 0) {
                // Get frame based on position
                let targetFrameUrl: string;
                if (position === 'first') {
                  targetFrameUrl = frames[0];
                } else if (position === 'last') {
                  targetFrameUrl = frames[frames.length - 1];
                } else if (position === 'middle') {
                  targetFrameUrl = frames[Math.floor(frames.length / 2)];
                } else if (typeof position === 'number') {
                  const idx = Math.min(position, frames.length - 1);
                  targetFrameUrl = frames[idx];
                } else {
                  targetFrameUrl = frames[frames.length - 1];
                }
                
                if (targetFrameUrl) {
                  const storedUrl = await downloadAndStore(targetFrameUrl);
                  const finalUrl = storedUrl || targetFrameUrl;
                  
                  console.log(`[ExtractFrame] ✅ TIER 1 SUCCESS: ${finalUrl.substring(0, 80)}...`);
                  
                  return new Response(
                    JSON.stringify({
                      success: true,
                      frameUrl: finalUrl,
                      position: String(position),
                      method: 'replicate-extract',
                      retryCount: attempt,
                    } as ExtractFrameResult),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              } else if (typeof frames === 'string' && frames) {
                const storedUrl = await downloadAndStore(frames);
                const finalUrl = storedUrl || frames;
                
                console.log(`[ExtractFrame] ✅ TIER 1 SUCCESS (single): ${finalUrl.substring(0, 80)}...`);
                
                return new Response(
                  JSON.stringify({
                    success: true,
                    frameUrl: finalUrl,
                    position: String(position),
                    method: 'replicate-extract',
                    retryCount: attempt,
                  } as ExtractFrameResult),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
              
              console.warn(`[ExtractFrame] Extraction succeeded but no frames returned`);
              break;
            } else if (status.status === 'failed') {
              console.warn(`[ExtractFrame] Prediction failed: ${status.error}`);
              break;
            }
            
            console.log(`[ExtractFrame] Polling... status: ${status.status}`);
          }
        } catch (replicateError) {
          const errorMsg = replicateError instanceof Error ? replicateError.message : 'Unknown error';
          console.warn(`[ExtractFrame] Attempt ${attempt + 1} error: ${errorMsg}`);
          continue;
        }
      }
      
      console.warn(`[ExtractFrame] ⚠️ TIER 1 exhausted - moving to fallbacks`);
    } else {
      console.warn(`[ExtractFrame] ⚠️ REPLICATE_API_KEY not configured - using fallbacks`);
    }

    // ============================================================
    // TIER 2: Reference Image Fallback
    // ============================================================
    if (referenceImageUrl && isValidFrameUrl(referenceImageUrl)) {
      console.log(`[ExtractFrame] ✅ TIER 2 SUCCESS (reference): ${referenceImageUrl.substring(0, 80)}...`);
      
      return new Response(
        JSON.stringify({
          success: true,
          frameUrl: referenceImageUrl,
          position: String(position),
          method: 'reference-fallback',
        } as ExtractFrameResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // TIER 3: Database Recovery
    // ============================================================
    console.log(`[ExtractFrame] TIER 3: Database recovery...`);
    
    try {
      // Try to get reference image from project
      const { data: projectData } = await supabase
        .from('movie_projects')
        .select('pro_features_data, scene_images')
        .eq('id', projectId)
        .single();
      
      if (projectData?.pro_features_data) {
        const proData = projectData.pro_features_data as Record<string, any>;
        const possibleUrls = [
          proData.referenceAnalysis?.imageUrl,
          proData.goldenFrameData?.goldenFrameUrl,
          proData.identityBible?.originalReferenceUrl,
        ].filter(url => isValidFrameUrl(url));
        
        if (possibleUrls.length > 0) {
          const frameUrl = possibleUrls[0];
          console.log(`[ExtractFrame] ✅ TIER 3 SUCCESS (pro_features): ${frameUrl.substring(0, 60)}...`);
          
          return new Response(
            JSON.stringify({
              success: true,
              frameUrl,
              position: String(position),
              method: 'db-fallback',
            } as ExtractFrameResult),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      // Try scene images
      if (projectData?.scene_images && Array.isArray(projectData.scene_images)) {
        const sceneImage = projectData.scene_images[0];
        if (sceneImage?.imageUrl && isValidFrameUrl(sceneImage.imageUrl)) {
          console.log(`[ExtractFrame] ✅ TIER 3 SUCCESS (scene_images): ${sceneImage.imageUrl.substring(0, 60)}...`);
          
          return new Response(
            JSON.stringify({
              success: true,
              frameUrl: sceneImage.imageUrl,
              position: String(position),
              method: 'db-fallback',
            } as ExtractFrameResult),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (dbError) {
      console.warn(`[ExtractFrame] Database recovery failed:`, dbError);
    }

    // ============================================================
    // ALL TIERS FAILED
    // ============================================================
    console.error(`[ExtractFrame] ❌ ALL TIERS FAILED for ${shotId}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        frameUrl: undefined,
        method: 'failed',
        error: `Frame extraction failed. No fallback images available.`,
      } as ExtractFrameResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ExtractFrame] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        method: 'failed',
        error: error instanceof Error ? error.message : "Unknown error",
      } as ExtractFrameResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
