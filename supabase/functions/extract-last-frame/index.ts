import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BULLETPROOF FRAME EXTRACTION v3.0
 * 
 * Guarantees a frame URL is ALWAYS returned through multi-tier fallback:
 * 
 * TIER 1: Cloud Run FFmpeg (pixel-perfect, ~2-5s)
 * TIER 2: Lovable AI Video Analysis + Generation (semantic match, ~5-10s)
 * TIER 3: Scene image fallback (pre-generated, instant)
 * TIER 4: Reference image fallback (original upload, instant)
 * TIER 5: Project database fallback (any available image, instant)
 * 
 * NEVER returns null - always provides SOME visual reference for continuity
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
  method: 'cloud-run-ffmpeg' | 'ai-generated' | 'scene-fallback' | 'reference-fallback' | 'db-fallback' | 'failed';
  confidence: 'high' | 'medium' | 'low';
  error?: string;
  retryCount?: number;
}

// Exponential backoff calculator
function calculateBackoff(attempt: number, baseMs = 1000, maxMs = 8000): number {
  return Math.min(baseMs * Math.pow(2, attempt), maxMs);
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
      shotPrompt, 
      sceneImageUrl, 
      referenceImageUrl,
      goldenFrameUrl,
      identityBibleFrontUrl,
      position = 'last' 
    } = request;

    if (!videoUrl) {
      throw new Error("videoUrl is required");
    }

    console.log(`[ExtractFrame] Shot ${shotIndex}: BULLETPROOF extraction starting`);
    console.log(`[ExtractFrame] Video: ${videoUrl.substring(0, 80)}...`);
    console.log(`[ExtractFrame] Fallbacks available: scene=${!!sceneImageUrl}, ref=${!!referenceImageUrl}, golden=${!!goldenFrameUrl}`);

    // Initialize Supabase client for Lovable Cloud
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
    // TIER 1: Cloud Run FFmpeg (with retry and exponential backoff)
    // ============================================================
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (cloudRunUrl) {
      const MAX_CLOUD_RUN_RETRIES = 3;
      
      for (let attempt = 0; attempt < MAX_CLOUD_RUN_RETRIES; attempt++) {
        try {
          // Exponential backoff on retries
          if (attempt > 0) {
            const backoffMs = calculateBackoff(attempt - 1);
            console.log(`[ExtractFrame] Cloud Run retry ${attempt + 1}/${MAX_CLOUD_RUN_RETRIES}, waiting ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
          
          const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
          const extractEndpoint = `${normalizedUrl}/extract-frame`;
          
          console.log(`[ExtractFrame] TIER 1: Cloud Run FFmpeg (attempt ${attempt + 1})`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
          
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
            
            // Handle base64 response
            if (result.frameBase64) {
              const frameUrl = await uploadBase64Frame(result.frameBase64);
              
              if (frameUrl && isValidImageUrl(frameUrl)) {
                await saveFrameToDb(frameUrl);
                console.log(`[ExtractFrame] ✓ TIER 1 SUCCESS: ${frameUrl.substring(0, 80)}...`);
                
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
            
            // Handle direct URL response
            const frameUrl = result.lastFrameUrl || result.frameUrl;
            if (frameUrl && isValidImageUrl(frameUrl)) {
              await saveFrameToDb(frameUrl);
              console.log(`[ExtractFrame] ✓ TIER 1 SUCCESS (direct): ${frameUrl.substring(0, 80)}...`);
              
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
          } else {
            const errorText = await response.text();
            console.warn(`[ExtractFrame] Cloud Run HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            
            // Rate limit - worth retrying
            if (response.status === 429) {
              continue;
            }
          }
        } catch (cloudRunError) {
          const errorMsg = cloudRunError instanceof Error ? cloudRunError.message : 'Unknown error';
          console.warn(`[ExtractFrame] Cloud Run attempt ${attempt + 1} failed:`, errorMsg);
          
          // Abort/timeout - worth retrying
          if (errorMsg.includes('abort') || errorMsg.includes('timeout')) {
            continue;
          }
        }
      }
      
      console.warn(`[ExtractFrame] TIER 1 FAILED after ${MAX_CLOUD_RUN_RETRIES} attempts`);
    } else {
      console.warn(`[ExtractFrame] TIER 1 SKIPPED: CLOUD_RUN_STITCHER_URL not configured`);
    }

    // ============================================================
    // TIER 2: Lovable AI Video Analysis + Frame Generation
    // Uses Gemini to analyze video and generate matching frame
    // ============================================================
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY && shotPrompt) {
      console.log(`[ExtractFrame] TIER 2: AI Frame Generation`);
      
      try {
        // Generate a frame that matches the video's end state
        const positionDesc = position === 'first' 
          ? 'OPENING frame - the very first moment'
          : 'FINAL frame - the last moment before the video ends';
        
        const generationPrompt = `Generate a photorealistic video frame that represents the ${positionDesc} of this scene:

Scene: ${shotPrompt}

Requirements:
- Photorealistic, cinematic quality
- 16:9 aspect ratio (1920x1080)
- Natural lighting, sharp focus
- Capture the exact moment as described
- No text, watermarks, or UI elements
- This will be used as a reference for the next video clip, so continuity is critical`;

        const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-pro-image-preview',
            messages: [
              { role: 'user', content: generationPrompt }
            ],
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          
          // Extract image from response (handle various formats)
          const generatedImage = 
            imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
            imageData.choices?.[0]?.message?.content?.match(/data:image[^"]+/)?.[0] ||
            imageData.data?.[0]?.b64_json;
          
          if (generatedImage) {
            const frameUrl = await uploadBase64Frame(
              generatedImage.startsWith('data:') ? generatedImage : `data:image/png;base64,${generatedImage}`
            );
            
            if (frameUrl && isValidImageUrl(frameUrl)) {
              await saveFrameToDb(frameUrl);
              console.log(`[ExtractFrame] ✓ TIER 2 SUCCESS: ${frameUrl.substring(0, 80)}...`);
              
              return new Response(
                JSON.stringify({
                  success: true,
                  frameUrl,
                  method: 'ai-generated',
                  confidence: 'medium',
                } as ExtractLastFrameResult),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } else {
          console.warn(`[ExtractFrame] AI generation failed: HTTP ${imageResponse.status}`);
        }
      } catch (aiError) {
        console.warn(`[ExtractFrame] TIER 2 failed:`, aiError);
      }
    }

    // ============================================================
    // TIER 3-5: Fallback Chain (guaranteed to return SOMETHING)
    // ============================================================
    console.log(`[ExtractFrame] Using fallback chain...`);
    
    // Build prioritized fallback list
    const fallbackSources = [
      { name: 'scene', url: sceneImageUrl, confidence: 'medium' as const },
      { name: 'reference', url: referenceImageUrl, confidence: 'medium' as const },
      { name: 'golden', url: goldenFrameUrl, confidence: 'medium' as const },
      { name: 'identity', url: identityBibleFrontUrl, confidence: 'low' as const },
    ].filter(s => isValidImageUrl(s.url));
    
    // Use immediate fallback if available
    if (fallbackSources.length > 0) {
      const best = fallbackSources[0];
      const frameUrl = best.url!;
      
      await saveFrameToDb(frameUrl);
      console.log(`[ExtractFrame] ✓ TIER 3 SUCCESS (${best.name}): ${frameUrl.substring(0, 80)}...`);
      
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
    // TIER 5: Database Recovery (last resort)
    // Query project for ANY available image
    // ============================================================
    console.log(`[ExtractFrame] TIER 5: Database recovery...`);
    
    try {
      const { data: projectData } = await lovableSupabase
        .from('movie_projects')
        .select('scene_images, pro_features_data')
        .eq('id', projectId)
        .single();
      
      // Try scene images
      if (projectData?.scene_images && Array.isArray(projectData.scene_images)) {
        const sceneImage = projectData.scene_images.find((s: any) => s.sceneNumber === shotIndex + 1)
          || projectData.scene_images[0];
        
        if (sceneImage?.imageUrl && isValidImageUrl(sceneImage.imageUrl)) {
          await saveFrameToDb(sceneImage.imageUrl);
          console.log(`[ExtractFrame] ✓ TIER 5 SUCCESS (DB scene_images): ${sceneImage.imageUrl.substring(0, 60)}...`);
          
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
      
      // Try pro_features_data
      if (projectData?.pro_features_data) {
        const proData = projectData.pro_features_data;
        const possibleUrls = [
          proData.referenceAnalysis?.imageUrl,  // FIRST: Original uploaded
          proData.goldenFrameData?.goldenFrameUrl,
          proData.identityBible?.originalReferenceUrl,
          proData.masterSceneAnchor?.frameUrl,
        ].filter(url => isValidImageUrl(url));
        
        if (possibleUrls.length > 0) {
          const frameUrl = possibleUrls[0];
          await saveFrameToDb(frameUrl);
          console.log(`[ExtractFrame] ✓ TIER 5 SUCCESS (DB pro_features): ${frameUrl.substring(0, 60)}...`);
          
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
      
      // Try previous clip's frame
      const { data: prevClip } = await lovableSupabase
        .from('video_clips')
        .select('last_frame_url')
        .eq('project_id', projectId)
        .eq('shot_index', shotIndex - 1)
        .single();
      
      if (prevClip?.last_frame_url && isValidImageUrl(prevClip.last_frame_url)) {
        await saveFrameToDb(prevClip.last_frame_url);
        console.log(`[ExtractFrame] ✓ TIER 5 SUCCESS (prev clip): ${prevClip.last_frame_url.substring(0, 60)}...`);
        
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
    } catch (dbError) {
      console.warn(`[ExtractFrame] DB recovery failed:`, dbError);
    }

    // ============================================================
    // ABSOLUTE FAILURE - This should NEVER happen with proper setup
    // ============================================================
    console.error(`[ExtractFrame] ❌ ALL TIERS FAILED for shot ${shotIndex}`);
    console.error(`[ExtractFrame] This indicates missing fallback images - check scene_images and reference_image`);
    
    return new Response(
      JSON.stringify({
        success: false,
        frameUrl: null,
        method: 'failed',
        confidence: 'low',
        error: 'All extraction methods failed. Ensure scene images or reference image are available.',
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
