import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Extract First Frame v5.0 - REPLICATE-BASED
 * 
 * Extracts the first frame from a video using Replicate's frame extraction.
 * NO CLOUD RUN DEPENDENCY - Uses Replicate API for reliable frame extraction.
 * 
 * TIER 1: Replicate frame extraction
 * TIER 2: Fallback to reference images from database
 */

interface FrameExtractionRequest {
  videoUrl: string;
  shotId: string;
  projectId?: string;
  referenceImageUrl?: string;
}

interface FrameExtractionResult {
  success: boolean;
  frameUrl?: string;
  frameDescription?: string;
  extractionMethod: 'replicate-extract' | 'reference-fallback' | 'db-fallback' | 'failed';
  error?: string;
}

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Validate frame URL
function isValidFrameUrl(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) return false;
  if (lower.includes('/video-clips/') && !lower.includes('frame')) return false;
  if (lower.includes('video/mp4')) return false;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD: Prevent unauthorized API credit consumption ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }
    const request: FrameExtractionRequest = await req.json();
    const { videoUrl, shotId, projectId, referenceImageUrl } = request;

    if (!videoUrl || !shotId) {
      throw new Error("videoUrl and shotId are required");
    }

    console.log(`[ExtractFirstFrame] Processing ${shotId} with Replicate-based extraction`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    // Helper to download and store frame
    const downloadAndStore = async (frameUrl: string): Promise<string | null> => {
      try {
        const response = await fetch(frameUrl);
        if (!response.ok) {
          console.warn(`[ExtractFirstFrame] Failed to download frame: ${response.status}`);
          return null;
        }
        
        const imageData = await response.arrayBuffer();
        const filename = `${projectId || 'unknown'}/first-frame-${shotId}-${Date.now()}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('temp-frames')
          .upload(filename, new Uint8Array(imageData), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.warn(`[ExtractFirstFrame] Storage upload failed:`, uploadError);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('temp-frames')
          .getPublicUrl(filename);
        
        return urlData.publicUrl;
      } catch (err) {
        console.warn(`[ExtractFirstFrame] Download/upload error:`, err);
        return null;
      }
    };

    // Save frame analysis to database
    const saveFrameAnalysis = async (frameUrl: string) => {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shotId);
        
        if (isUuid) {
          const { data: existingClip } = await supabase
            .from('video_clips')
            .select('motion_vectors')
            .eq('id', shotId)
            .single();
          
          if (existingClip) {
            const existingVectors = (existingClip.motion_vectors as Record<string, unknown>) || {};
            
            await supabase
              .from('video_clips')
              .update({
                motion_vectors: {
                  ...existingVectors,
                  firstFrameAnalysis: {
                    frameUrl,
                    extractedAt: new Date().toISOString(),
                  },
                },
              })
              .eq('id', shotId);
          }
        }
      } catch (dbError) {
        console.warn(`[ExtractFirstFrame] Failed to store in database:`, dbError);
      }
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
            console.log(`[ExtractFirstFrame] 🔄 Retry ${attempt + 1}/${MAX_RETRIES}, waiting ${backoffMs}ms...`);
            await sleep(backoffMs);
          }
          
          console.log(`[ExtractFirstFrame] TIER 1: Replicate extraction attempt ${attempt + 1}/${MAX_RETRIES}`);
          
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
            console.warn(`[ExtractFirstFrame] Replicate prediction start failed: ${predictionResponse.status} - ${errorText.substring(0, 100)}`);
            
            if (predictionResponse.status === 404 || predictionResponse.status === 422) {
              console.log(`[ExtractFirstFrame] Frame extraction model unavailable, using fallback...`);
              break;
            }
            continue;
          }
          
          const prediction = await predictionResponse.json();
          console.log(`[ExtractFirstFrame] Prediction started: ${prediction.id}`);
          
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
              console.warn(`[ExtractFirstFrame] Status check failed: ${statusResponse.status}`);
              continue;
            }
            
            const status = await statusResponse.json();
            
            if (status.status === 'succeeded') {
              const frames = status.output;
              
              if (Array.isArray(frames) && frames.length > 0) {
                // Get the FIRST frame
                const firstFrameUrl = frames[0];
                
                if (firstFrameUrl) {
                  const storedUrl = await downloadAndStore(firstFrameUrl);
                  const finalUrl = storedUrl || firstFrameUrl;
                  
                  await saveFrameAnalysis(finalUrl);
                  
                  console.log(`[ExtractFirstFrame] ✅ TIER 1 SUCCESS: ${finalUrl.substring(0, 80)}...`);
                  
                  return new Response(
                    JSON.stringify({
                      success: true,
                      frameUrl: finalUrl,
                      extractionMethod: 'replicate-extract',
                    } as FrameExtractionResult),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              } else if (typeof frames === 'string' && frames) {
                const storedUrl = await downloadAndStore(frames);
                const finalUrl = storedUrl || frames;
                
                await saveFrameAnalysis(finalUrl);
                
                console.log(`[ExtractFirstFrame] ✅ TIER 1 SUCCESS (single): ${finalUrl.substring(0, 80)}...`);
                
                return new Response(
                  JSON.stringify({
                    success: true,
                    frameUrl: finalUrl,
                    extractionMethod: 'replicate-extract',
                  } as FrameExtractionResult),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
              
              console.warn(`[ExtractFirstFrame] Extraction succeeded but no frames returned`);
              break;
            } else if (status.status === 'failed') {
              console.warn(`[ExtractFirstFrame] Prediction failed: ${status.error}`);
              break;
            }
            
            console.log(`[ExtractFirstFrame] Polling... status: ${status.status}`);
          }
        } catch (replicateError) {
          const errorMsg = replicateError instanceof Error ? replicateError.message : 'Unknown error';
          console.warn(`[ExtractFirstFrame] Attempt ${attempt + 1} error: ${errorMsg}`);
          continue;
        }
      }
      
      console.warn(`[ExtractFirstFrame] ⚠️ TIER 1 exhausted - moving to fallbacks`);
    } else {
      console.warn(`[ExtractFirstFrame] ⚠️ REPLICATE_API_KEY not configured - using fallbacks`);
    }

    // ============================================================
    // TIER 2: Reference Image Fallback
    // ============================================================
    if (referenceImageUrl && isValidFrameUrl(referenceImageUrl)) {
      await saveFrameAnalysis(referenceImageUrl);
      
      console.log(`[ExtractFirstFrame] ✅ TIER 2 SUCCESS (reference): ${referenceImageUrl.substring(0, 80)}...`);
      
      return new Response(
        JSON.stringify({
          success: true,
          frameUrl: referenceImageUrl,
          extractionMethod: 'reference-fallback',
        } as FrameExtractionResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // TIER 3: Database Recovery
    // ============================================================
    console.log(`[ExtractFirstFrame] TIER 3: Database recovery...`);
    
    if (projectId) {
      try {
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
            await saveFrameAnalysis(frameUrl);
            
            console.log(`[ExtractFirstFrame] ✅ TIER 3 SUCCESS (pro_features): ${frameUrl.substring(0, 60)}...`);
            
            return new Response(
              JSON.stringify({
                success: true,
                frameUrl,
                extractionMethod: 'db-fallback',
              } as FrameExtractionResult),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        
        if (projectData?.scene_images && Array.isArray(projectData.scene_images)) {
          const sceneImage = projectData.scene_images[0];
          if (sceneImage?.imageUrl && isValidFrameUrl(sceneImage.imageUrl)) {
            await saveFrameAnalysis(sceneImage.imageUrl);
            
            console.log(`[ExtractFirstFrame] ✅ TIER 3 SUCCESS (scene_images): ${sceneImage.imageUrl.substring(0, 60)}...`);
            
            return new Response(
              JSON.stringify({
                success: true,
                frameUrl: sceneImage.imageUrl,
                extractionMethod: 'db-fallback',
              } as FrameExtractionResult),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (dbError) {
        console.warn(`[ExtractFirstFrame] Database recovery failed:`, dbError);
      }
    }

    // ============================================================
    // ALL TIERS FAILED
    // ============================================================
    console.error(`[ExtractFirstFrame] ❌ ALL TIERS FAILED for ${shotId}`);

    return new Response(
      JSON.stringify({
        success: false,
        extractionMethod: 'failed',
        error: 'Frame extraction failed. No fallback images available.',
      } as FrameExtractionResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ExtractFirstFrame] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Frame extraction failed",
        extractionMethod: 'failed',
      } as FrameExtractionResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
