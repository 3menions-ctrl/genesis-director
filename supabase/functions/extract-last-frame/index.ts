import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BULLETPROOF FRAME EXTRACTION v5.0 - REPLICATE-BASED
 * 
 * Uses Replicate's video frame extraction instead of Cloud Run FFmpeg.
 * More reliable, no cold start issues, consistent performance.
 * 
 * TIER 1: Replicate frame extraction API
 * TIER 2: Existing frame URLs from database (reference images, etc.)
 * 
 * NEVER generates AI images - only extracts real frames or uses existing images.
 */

interface ExtractLastFrameRequest {
  videoUrl: string;
  projectId: string;
  shotIndex: number;
  shotPrompt?: string;
  sceneImageUrl?: string;
  referenceImageUrl?: string;
  goldenFrameUrl?: string;
  identityBibleFrontUrl?: string;
  position?: 'first' | 'last';
}

interface ExtractLastFrameResult {
  success: boolean;
  frameUrl: string | null;
  method: 'replicate-extract' | 'scene-fallback' | 'reference-fallback' | 'db-fallback' | 'failed';
  confidence: 'high' | 'medium' | 'low';
  error?: string;
  retryCount?: number;
}

// Validate that a URL is an actual image, not a video
function isValidImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Reject video files
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) return false;
  if (lower.includes('/video-clips/') && !lower.includes('frame')) return false;
  if (lower.includes('video/mp4')) return false;
  return true;
}

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    const request: ExtractLastFrameRequest = await req.json();
    const { 
      videoUrl, 
      projectId, 
      shotIndex, 
      sceneImageUrl, 
      referenceImageUrl,
      goldenFrameUrl,
      identityBibleFrontUrl,
      position = 'last' 
    } = request;

    if (!videoUrl) {
      throw new Error("videoUrl is required");
    }

    console.log(`[ExtractFrame] Shot ${shotIndex}: Starting extraction (Replicate-based)`);
    console.log(`[ExtractFrame] Video: ${videoUrl.substring(0, 80)}...`);
    console.log(`[ExtractFrame] Fallbacks: scene=${!!sceneImageUrl}, ref=${!!referenceImageUrl}, golden=${!!goldenFrameUrl}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    // ============================================================
    // CLIP 0 SPECIAL CASE: EXTRACT THE ACTUAL LAST FRAME
    // 
    // CRITICAL FIX: Clip 0's last frame should be the ACTUAL end of the generated video,
    // NOT the user's uploaded reference image. This ensures clip 1 continues from
    // where clip 0 actually ended, maintaining true visual continuity.
    //
    // The reference image is only used as a FALLBACK if extraction fails.
    // ============================================================
    if (shotIndex === 0) {
      console.log(`[ExtractFrame] CLIP 0: Will attempt to extract ACTUAL last frame (reference as fallback)`);
      // Continue to normal extraction flow - don't short-circuit with reference image
    }

    // Helper to save frame URL to database
    const saveFrameToDb = async (frameUrl: string) => {
      try {
        await supabase
          .from('video_clips')
          .update({ 
            last_frame_url: frameUrl,
            frame_extraction_status: 'completed'
          })
          .eq('project_id', projectId)
          .eq('shot_index', shotIndex);
        console.log(`[ExtractFrame] ✓ Saved to DB: ${frameUrl.substring(0, 60)}...`);
      } catch (e) {
        console.warn(`[ExtractFrame] DB save failed:`, e);
      }
    };

    // Helper to download and re-upload frame to our storage
    const downloadAndStore = async (frameUrl: string): Promise<string | null> => {
      try {
        const response = await fetch(frameUrl);
        if (!response.ok) {
          console.warn(`[ExtractFrame] Failed to download frame: ${response.status}`);
          return null;
        }
        
        const imageData = await response.arrayBuffer();
        const filename = `${projectId}/shot-${shotIndex}-${position}-${Date.now()}.jpg`;
        
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

    // ============================================================
    // TIER 1: Replicate Frame Extraction
    // Use ffmpeg via Replicate to extract frames from video
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
          
          // Use lucataco/frame-extractor - simple, reliable first/last frame extraction
          // 825K+ runs on Replicate, specifically designed for video-to-video workflows
          // Cost: ~$0.0001 per run, completes in ~1 second
          // Version: c02b3c1df64728476b1c21b0876235119e6ac08b0c9b8a99b82c5f0e0d42442d
          const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${REPLICATE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              version: "c02b3c1df64728476b1c21b0876235119e6ac08b0c9b8a99b82c5f0e0d42442d",
              input: {
                video: videoUrl,
                return_first_frame: position === 'first', // false = last frame (default)
              }
            }),
          });
          
          if (!predictionResponse.ok) {
            const errorText = await predictionResponse.text();
            console.warn(`[ExtractFrame] Replicate prediction start failed: ${predictionResponse.status} - ${errorText.substring(0, 100)}`);
            
            // If model not found, skip to fallback
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
              // lucataco/frame-extractor returns a single image URL directly
              const frameOutput = status.output;
              
              if (frameOutput && typeof frameOutput === 'string') {
                // Download and re-upload to our storage for permanence
                const storedUrl = await downloadAndStore(frameOutput);
                const finalUrl = storedUrl || frameOutput;
                
                await saveFrameToDb(finalUrl);
                console.log(`[ExtractFrame] ✅ TIER 1 SUCCESS: ${finalUrl.substring(0, 80)}...`);
                
                return new Response(
                  JSON.stringify({
                    success: true,
                    frameUrl: finalUrl,
                    method: 'replicate-extract',
                    confidence: 'high',
                    retryCount: attempt,
                  } as ExtractLastFrameResult),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              } else if (Array.isArray(frameOutput) && frameOutput.length > 0) {
                // Fallback: some models might return array - get last frame
                const lastFrameUrl = position === 'last' ? frameOutput[frameOutput.length - 1] : frameOutput[0];
                
                if (lastFrameUrl) {
                  const storedUrl = await downloadAndStore(lastFrameUrl);
                  const finalUrl = storedUrl || lastFrameUrl;
                  
                  await saveFrameToDb(finalUrl);
                  console.log(`[ExtractFrame] ✅ TIER 1 SUCCESS (array): ${finalUrl.substring(0, 80)}...`);
                  
                  return new Response(
                    JSON.stringify({
                      success: true,
                      frameUrl: finalUrl,
                      method: 'replicate-extract',
                      confidence: 'high',
                      retryCount: attempt,
                    } as ExtractLastFrameResult),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              }
              
              console.warn(`[ExtractFrame] Extraction succeeded but no valid output returned: ${JSON.stringify(frameOutput)}`);
              break;
            } else if (status.status === 'failed') {
              console.warn(`[ExtractFrame] Prediction failed: ${status.error}`);
              break;
            }
            
            // Still processing, continue polling
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
    // TIER 2: User-Uploaded Reference Image (CRITICAL FALLBACK)
    // When extraction fails, use reference image to maintain continuity
    // ============================================================
    console.log(`[ExtractFrame] TIER 2: Using reference image as fallback for continuity...`);
    
    const validFallbacks = [
      { name: 'reference', url: referenceImageUrl, confidence: 'medium' as const },
      { name: 'golden', url: goldenFrameUrl, confidence: 'medium' as const },
      { name: 'identity', url: identityBibleFrontUrl, confidence: 'low' as const },
      { name: 'scene', url: sceneImageUrl, confidence: 'low' as const },
    ].filter(s => isValidImageUrl(s.url));
    
    if (validFallbacks.length > 0) {
      const best = validFallbacks[0];
      const frameUrl = best.url!;
      
      await saveFrameToDb(frameUrl);
      console.log(`[ExtractFrame] ✅ TIER 2 SUCCESS (${best.name}): ${frameUrl.substring(0, 80)}...`);
      
      return new Response(
        JSON.stringify({
          success: true,
          frameUrl,
          method: 'reference-fallback',
          confidence: best.confidence,
        } as ExtractLastFrameResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // ============================================================
    // TIER 3: Database Recovery
    // Query project for ANY existing image
    // ============================================================
    console.log(`[ExtractFrame] TIER 3: Database recovery...`);
    
    try {
      const { data: projectData } = await supabase
        .from('movie_projects')
        .select('scene_images, pro_features_data')
        .eq('id', projectId)
        .single();
      
      // Try pro_features_data for original uploaded images
      if (projectData?.pro_features_data) {
        const proData = projectData.pro_features_data as Record<string, any>;
        const possibleUrls = [
          proData.referenceAnalysis?.imageUrl,
          proData.goldenFrameData?.goldenFrameUrl,
          proData.identityBible?.originalReferenceUrl,
          proData.masterSceneAnchor?.frameUrl,
        ].filter(url => isValidImageUrl(url));
        
        if (possibleUrls.length > 0) {
          const frameUrl = possibleUrls[0];
          await saveFrameToDb(frameUrl);
          console.log(`[ExtractFrame] ✅ TIER 3 SUCCESS (pro_features): ${frameUrl.substring(0, 60)}...`);
          
          return new Response(
            JSON.stringify({
              success: true,
              frameUrl,
              method: 'db-fallback',
              confidence: 'low',
            } as ExtractLastFrameResult),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      // Try scene images from database
      if (projectData?.scene_images && Array.isArray(projectData.scene_images)) {
        const sceneImage = projectData.scene_images.find((s: any) => s.sceneNumber === shotIndex + 1)
          || projectData.scene_images[0];
        
        if (sceneImage?.imageUrl && isValidImageUrl(sceneImage.imageUrl)) {
          await saveFrameToDb(sceneImage.imageUrl);
          console.log(`[ExtractFrame] ✅ TIER 3 SUCCESS (scene_images): ${sceneImage.imageUrl.substring(0, 60)}...`);
          
          return new Response(
            JSON.stringify({
              success: true,
              frameUrl: sceneImage.imageUrl,
              method: 'db-fallback',
              confidence: 'low',
            } as ExtractLastFrameResult),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      // Try previous clip's last frame
      if (shotIndex > 0) {
        const { data: prevClip } = await supabase
          .from('video_clips')
          .select('last_frame_url')
          .eq('project_id', projectId)
          .eq('shot_index', shotIndex - 1)
          .single();
        
        if (prevClip?.last_frame_url && isValidImageUrl(prevClip.last_frame_url)) {
          await saveFrameToDb(prevClip.last_frame_url);
          console.log(`[ExtractFrame] ✅ TIER 3 SUCCESS (prev clip): ${prevClip.last_frame_url.substring(0, 60)}...`);
          
          return new Response(
            JSON.stringify({
              success: true,
              frameUrl: prevClip.last_frame_url,
              method: 'db-fallback',
              confidence: 'low',
            } as ExtractLastFrameResult),
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
    console.error(`[ExtractFrame] ❌ ALL TIERS FAILED for shot ${shotIndex}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        frameUrl: null,
        method: 'failed',
        confidence: 'low',
        error: `Frame extraction failed. No existing images available as fallback.`,
      } as ExtractLastFrameResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ExtractFrame] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        frameUrl: null,
        method: 'failed',
        confidence: 'low',
        error: error instanceof Error ? error.message : "Unknown error",
      } as ExtractLastFrameResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
