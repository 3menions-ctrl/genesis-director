import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BULLETPROOF FRAME EXTRACTION v4.0 - NO AI GENERATION
 * 
 * Frame extraction MUST succeed via Cloud Run FFmpeg.
 * Retries aggressively until success - NO fallback to AI image generation.
 * 
 * TIER 1: Cloud Run FFmpeg with AGGRESSIVE RETRY (up to 10 attempts)
 * TIER 2: Existing frame URLs from database (scene images, reference, etc.)
 * 
 * NEVER generates images - only extracts real frames or uses existing images.
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
  method: 'cloud-run-ffmpeg' | 'scene-fallback' | 'reference-fallback' | 'db-fallback' | 'failed';
  confidence: 'high' | 'medium' | 'low';
  error?: string;
  retryCount?: number;
}

// Exponential backoff calculator with jitter
function calculateBackoff(attempt: number, baseMs = 2000, maxMs = 30000): number {
  const exponentialDelay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  // Add 10-30% jitter to prevent thundering herd
  const jitter = exponentialDelay * (0.1 + Math.random() * 0.2);
  return Math.floor(exponentialDelay + jitter);
}

// Validate that a URL is an actual image, not a video
function isValidImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Reject video files
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) return false;
  if (lower.includes('/video-clips/') || lower.includes('video/mp4')) return false;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log(`[ExtractFrame] Shot ${shotIndex}: BULLETPROOF extraction starting (NO AI GENERATION)`);
    console.log(`[ExtractFrame] Video: ${videoUrl.substring(0, 80)}...`);
    console.log(`[ExtractFrame] Fallbacks: scene=${!!sceneImageUrl}, ref=${!!referenceImageUrl}, golden=${!!goldenFrameUrl}`);

    // Initialize Supabase client
    const lovableSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Helper to save frame URL to database
    const saveFrameToDb = async (frameUrl: string) => {
      try {
        await lovableSupabase
          .from('video_clips')
          .update({ last_frame_url: frameUrl })
          .eq('project_id', projectId)
          .eq('shot_index', shotIndex);
        console.log(`[ExtractFrame] ✓ Saved to DB: ${frameUrl.substring(0, 60)}...`);
      } catch (e) {
        console.warn(`[ExtractFrame] DB save failed:`, e);
      }
    };

    // Helper to upload base64 frame to storage
    const uploadBase64Frame = async (base64Data: string): Promise<string | null> => {
      try {
        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const binaryData = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
        const filename = `${projectId}/shot-${shotIndex}-${position}-${Date.now()}.jpg`;
        
        const { error: uploadError } = await lovableSupabase.storage
          .from('temp-frames')
          .upload(filename, binaryData, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.warn(`[ExtractFrame] Storage upload failed:`, uploadError);
          return null;
        }

        const { data: urlData } = lovableSupabase.storage
          .from('temp-frames')
          .getPublicUrl(filename);
        
        return urlData.publicUrl;
      } catch (err) {
        console.warn(`[ExtractFrame] Upload error:`, err);
        return null;
      }
    };

    // ============================================================
    // TIER 1: Cloud Run FFmpeg - AGGRESSIVE RETRY (10 attempts)
    // This MUST succeed. We do not fall back to AI generation.
    // ============================================================
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    const MAX_RETRIES = 10; // Aggressive retry - frame extraction is critical
    
    if (cloudRunUrl) {
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
          
          console.log(`[ExtractFrame] TIER 1: Cloud Run FFmpeg attempt ${attempt + 1}/${MAX_RETRIES}`);
          
          const controller = new AbortController();
          // Increase timeout on later attempts (30s base, up to 60s)
          const timeoutMs = 30000 + (attempt * 5000);
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          
          const response = await fetch(extractEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clipUrl: videoUrl,
              clipIndex: shotIndex,
              projectId,
              position,
              returnBase64: true,
            }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (response.ok) {
            const result = await response.json();
            
            // Handle base64 response (preferred)
            if (result.frameBase64) {
              const frameUrl = await uploadBase64Frame(result.frameBase64);
              
              if (frameUrl && isValidImageUrl(frameUrl)) {
                await saveFrameToDb(frameUrl);
                console.log(`[ExtractFrame] ✅ TIER 1 SUCCESS on attempt ${attempt + 1}: ${frameUrl.substring(0, 80)}...`);
                
                return new Response(
                  JSON.stringify({
                    success: true,
                    frameUrl,
                    method: 'cloud-run-ffmpeg',
                    confidence: 'high',
                    retryCount: attempt,
                  } as ExtractLastFrameResult),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
            
            // Handle direct URL response (legacy)
            const frameUrl = result.lastFrameUrl || result.frameUrl;
            if (frameUrl && isValidImageUrl(frameUrl)) {
              await saveFrameToDb(frameUrl);
              console.log(`[ExtractFrame] ✅ TIER 1 SUCCESS (direct URL) on attempt ${attempt + 1}: ${frameUrl.substring(0, 80)}...`);
              
              return new Response(
                JSON.stringify({
                  success: true,
                  frameUrl,
                  method: 'cloud-run-ffmpeg',
                  confidence: 'high',
                  retryCount: attempt,
                } as ExtractLastFrameResult),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            // Response OK but no valid frame - retry
            console.warn(`[ExtractFrame] Attempt ${attempt + 1}: OK response but no valid frame, retrying...`);
            continue;
          } else {
            const errorText = await response.text();
            console.warn(`[ExtractFrame] Attempt ${attempt + 1}: HTTP ${response.status} - ${errorText.substring(0, 100)}`);
            
            // 4xx errors (except 429) are client errors - may not be worth retrying
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              console.warn(`[ExtractFrame] Client error ${response.status}, but will still retry...`);
            }
            
            continue;
          }
        } catch (cloudRunError) {
          const errorMsg = cloudRunError instanceof Error ? cloudRunError.message : 'Unknown error';
          console.warn(`[ExtractFrame] Attempt ${attempt + 1} error: ${errorMsg}`);
          
          // Always retry on any error type
          continue;
        }
      }
      
      console.error(`[ExtractFrame] ❌ TIER 1 FAILED after ${MAX_RETRIES} attempts - Cloud Run extraction exhausted`);
    } else {
      console.error(`[ExtractFrame] ❌ CLOUD_RUN_STITCHER_URL not configured - cannot extract frames!`);
    }

    // ============================================================
    // TIER 2: Existing Image Fallback Chain
    // Use pre-existing images from scene generation or reference upload
    // These are REAL images, not AI-generated as fallback
    // ============================================================
    console.log(`[ExtractFrame] TIER 2: Using existing image fallbacks...`);
    
    // Build prioritized fallback list of EXISTING images only
    const fallbackSources = [
      { name: 'scene', url: sceneImageUrl, confidence: 'medium' as const },
      { name: 'reference', url: referenceImageUrl, confidence: 'medium' as const },
      { name: 'golden', url: goldenFrameUrl, confidence: 'medium' as const },
      { name: 'identity', url: identityBibleFrontUrl, confidence: 'low' as const },
    ].filter(s => isValidImageUrl(s.url));
    
    if (fallbackSources.length > 0) {
      const best = fallbackSources[0];
      const frameUrl = best.url!;
      
      await saveFrameToDb(frameUrl);
      console.log(`[ExtractFrame] ✅ TIER 2 SUCCESS (${best.name}): ${frameUrl.substring(0, 80)}...`);
      
      return new Response(
        JSON.stringify({
          success: true,
          frameUrl,
          method: best.name === 'scene' ? 'scene-fallback' : 'reference-fallback',
          confidence: best.confidence,
        } as ExtractLastFrameResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // ============================================================
    // TIER 3: Database Recovery
    // Query project for ANY existing image (no AI generation)
    // ============================================================
    console.log(`[ExtractFrame] TIER 3: Database recovery...`);
    
    try {
      const { data: projectData } = await lovableSupabase
        .from('movie_projects')
        .select('scene_images, pro_features_data')
        .eq('id', projectId)
        .single();
      
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
      
      // Try pro_features_data for original uploaded images
      if (projectData?.pro_features_data) {
        const proData = projectData.pro_features_data;
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
      
      // Try previous clip's last frame
      if (shotIndex > 0) {
        const { data: prevClip } = await lovableSupabase
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
    // ALL TIERS FAILED - Return error for retry at higher level
    // ============================================================
    console.error(`[ExtractFrame] ❌ ALL TIERS FAILED for shot ${shotIndex}`);
    console.error(`[ExtractFrame] Cloud Run: ${MAX_RETRIES} attempts exhausted`);
    console.error(`[ExtractFrame] No existing fallback images available`);
    console.error(`[ExtractFrame] Caller should retry this entire operation`);
    
    return new Response(
      JSON.stringify({
        success: false,
        frameUrl: null,
        method: 'failed',
        confidence: 'low',
        error: `Frame extraction failed after ${MAX_RETRIES} Cloud Run attempts. No existing images available as fallback. Retry the entire clip generation.`,
        retryCount: MAX_RETRIES,
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
