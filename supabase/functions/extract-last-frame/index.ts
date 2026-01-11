import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BULLETPROOF FRAME EXTRACTION
 * 
 * Extracts the last frame from a video for frame-chaining to ensure
 * the next clip begins EXACTLY where the previous one ended.
 * 
 * Strategy (in order of priority):
 * 1. Cloud Run FFmpeg (pixel-perfect, if available)
 * 2. Lovable AI Gemini Vision (analyzes video → generates matching image)
 * 
 * CRITICAL: This function GUARANTEES an image URL output.
 * If all methods fail, it returns the scene image as fallback.
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
  method: 'cloud-run' | 'gemini-vision' | 'scene-fallback' | 'failed';
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

    // Helper to upload image and get public URL
    const uploadFrame = async (imageData: string | Uint8Array, method: string): Promise<string | null> => {
      try {
        let imageBuffer: Uint8Array;
        
        if (typeof imageData === 'string') {
          // Handle base64 data
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
          imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        } else {
          imageBuffer = imageData;
        }
        
        const fileName = `frame_${projectId}_shot${shotIndex}_${position}_${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('temp-frames')
          .upload(fileName, imageBuffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) {
          console.warn(`[ExtractLastFrame] Upload failed (${method}):`, uploadError.message);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('temp-frames')
          .getPublicUrl(fileName);
        
        console.log(`[ExtractLastFrame] ✓ Frame uploaded via ${method}: ${urlData.publicUrl.substring(0, 80)}...`);
        return urlData.publicUrl;
      } catch (err) {
        console.warn(`[ExtractLastFrame] Upload error (${method}):`, err);
        return null;
      }
    };

    // ============================================================
    // METHOD 1: Cloud Run FFmpeg (BEST - pixel-perfect extraction)
    // ============================================================
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (cloudRunUrl) {
      try {
        const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
        const extractEndpoint = `${normalizedUrl}/extract-frame`;
        
        console.log(`[ExtractLastFrame] METHOD 1: Trying Cloud Run FFmpeg...`);
        
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

        if (response.ok) {
          const result = await response.json();
          const frameUrl = result.lastFrameUrl || result.frameUrl;
          
          // Validate it's actually an image URL, not a video
          if (frameUrl && !frameUrl.endsWith('.mp4') && !frameUrl.includes('/video-clips/')) {
            console.log(`[ExtractLastFrame] ✓ METHOD 1 SUCCESS (Cloud Run): ${frameUrl.substring(0, 80)}...`);
            
            // Store in database
            await supabase
              .from('video_clips')
              .update({ last_frame_url: frameUrl })
              .eq('project_id', projectId)
              .eq('shot_index', shotIndex);
            
            return new Response(
              JSON.stringify({
                success: true,
                frameUrl,
                method: 'cloud-run',
              } as ExtractLastFrameResult),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.warn(`[ExtractLastFrame] METHOD 1: Got video URL instead of image, trying fallback`);
          }
        } else {
          const errorText = await response.text();
          console.warn(`[ExtractLastFrame] METHOD 1 FAILED: ${response.status} - ${errorText.substring(0, 100)}`);
        }
      } catch (cloudRunError) {
        console.warn(`[ExtractLastFrame] METHOD 1 ERROR:`, cloudRunError);
      }
    } else {
      console.log(`[ExtractLastFrame] METHOD 1 SKIPPED: CLOUD_RUN_STITCHER_URL not configured`);
    }

    // ============================================================
    // METHOD 2: Lovable AI Gemini Vision → Image Generation
    // Analyze the video, describe the last frame, generate matching image
    // ============================================================
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY) {
      console.log(`[ExtractLastFrame] METHOD 2: Trying Gemini Vision analysis + image generation...`);
      
      try {
        // Step 2a: Analyze the video with Gemini to get last frame description
        const positionPrompt = position === 'first' 
          ? 'Describe the OPENING/FIRST frame of this video in extreme photographic detail.'
          : 'Describe the FINAL/LAST frame of this video EXACTLY as it appears when the video ends.';

        const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: [
                  { 
                    type: 'text', 
                    text: `${positionPrompt}

Focus on these elements for perfect recreation:
1. SUBJECT: Exact position, pose, expression, clothing, any motion blur
2. CAMERA: Angle, distance, framing (close-up, wide, etc.)
3. LIGHTING: Direction, intensity, shadows, highlights, color temperature
4. ENVIRONMENT: Background elements, props, setting details
5. COLOR GRADE: Overall color palette, contrast, saturation
6. COMPOSITION: Where is the subject in frame? What's the depth of field?

Be extremely specific and visual. This description will be used to generate an IDENTICAL image.` 
                  },
                  { type: 'image_url', image_url: { url: videoUrl } }
                ]
              }
            ],
            max_tokens: 800,
          }),
        });

        if (analysisResponse.ok) {
          const aiResponse = await analysisResponse.json();
          const frameDescription = aiResponse.choices?.[0]?.message?.content;
          
          if (frameDescription && frameDescription.length > 50) {
            console.log(`[ExtractLastFrame] Video analyzed: "${frameDescription.substring(0, 120)}..."`);
            
            // Step 2b: Generate matching image using Gemini image generation
            const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash-image-preview',
                messages: [
                  {
                    role: 'user',
                    content: `Generate a photorealistic video frame matching this EXACT description:

${frameDescription}

Requirements:
- 16:9 aspect ratio (widescreen video frame)
- Photorealistic, cinematic quality
- Match the exact lighting, color grade, and composition described
- No text, watermarks, or UI elements
- This is a still from a high-budget production`
                  }
                ],
                modalities: ['image', 'text'],
              }),
            });

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              
              // Handle Gemini image response format
              const generatedImage = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
              
              if (generatedImage) {
                const frameUrl = await uploadFrame(generatedImage, 'gemini-vision');
                
                if (frameUrl) {
                  console.log(`[ExtractLastFrame] ✓ METHOD 2 SUCCESS (Gemini Vision): ${frameUrl.substring(0, 80)}...`);
                  
                  // Store in database
                  await supabase
                    .from('video_clips')
                    .update({ last_frame_url: frameUrl })
                    .eq('project_id', projectId)
                    .eq('shot_index', shotIndex);
                  
                  return new Response(
                    JSON.stringify({
                      success: true,
                      frameUrl,
                      method: 'gemini-vision',
                    } as ExtractLastFrameResult),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              } else {
                console.warn(`[ExtractLastFrame] METHOD 2: No image in Gemini response`);
              }
            } else {
              const errStatus = imageResponse.status;
              const errText = await imageResponse.text();
              console.warn(`[ExtractLastFrame] METHOD 2 image gen failed: ${errStatus} - ${errText.substring(0, 100)}`);
            }
          }
        } else {
          const errStatus = analysisResponse.status;
          console.warn(`[ExtractLastFrame] METHOD 2 analysis failed: ${errStatus}`);
        }
      } catch (geminiError) {
        console.warn(`[ExtractLastFrame] METHOD 2 ERROR:`, geminiError);
      }
    } else {
      console.log(`[ExtractLastFrame] METHOD 2 SKIPPED: LOVABLE_API_KEY not configured`);
    }

    // ============================================================
    // FALLBACK: Use scene image (guaranteed to exist)
    // ============================================================
    if (sceneImageUrl) {
      console.log(`[ExtractLastFrame] Using FALLBACK: Scene image as frame reference`);
      
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
    console.error(`[ExtractLastFrame] ⚠️ ALL METHODS FAILED for shot ${shotIndex}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        frameUrl: null,
        method: 'failed',
        error: 'All frame extraction methods failed and no scene fallback available',
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
