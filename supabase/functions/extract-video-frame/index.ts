import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Extract Video Frame
 * 
 * Extracts a specific frame from a video using Cloud Run FFmpeg service.
 * Used to get frames for frame-chaining in video generation.
 * 
 * CRITICAL: This must return an ACTUAL IMAGE URL, not a video URL!
 * Veo's image-to-video requires a real image with proper dimensions.
 * 
 * Supports: first frame, last frame, or frame at specific timestamp
 */

interface ExtractFrameRequest {
  videoUrl: string;
  projectId: string;
  shotId: string;
  position: 'first' | 'last' | 'middle' | number; // number = timestamp in seconds
}

interface ExtractFrameResult {
  success: boolean;
  frameUrl?: string;
  position?: string;
  error?: string;
  method?: string;
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // METHOD 1: Try Cloud Run FFmpeg service first (BEST - returns actual image)
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (cloudRunUrl) {
      try {
        const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
        const extractEndpoint = `${normalizedUrl}/extract-frame`;
        
        console.log(`[ExtractFrame] Trying Cloud Run: ${extractEndpoint}`);
        
        const response = await fetch(extractEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipUrl: videoUrl,
            clipIndex: shotId,
            projectId,
            position,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const frameUrl = result.lastFrameUrl || result.frameUrl;
          
          if (frameUrl && !frameUrl.endsWith('.mp4') && !frameUrl.includes('video/')) {
            console.log(`[ExtractFrame] ✓ Frame extracted via Cloud Run: ${frameUrl.substring(0, 80)}...`);
            
            return new Response(
              JSON.stringify({
                success: true,
                frameUrl,
                position: String(position),
                method: 'cloud-run-ffmpeg',
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.warn(`[ExtractFrame] Cloud Run returned invalid frame (video URL or missing)`);
          }
        } else {
          const errorText = await response.text();
          console.warn(`[ExtractFrame] Cloud Run error: ${response.status} - ${errorText.substring(0, 100)}`);
        }
      } catch (cloudRunError) {
        console.warn(`[ExtractFrame] Cloud Run extraction failed:`, cloudRunError);
      }
    } else {
      console.log(`[ExtractFrame] Cloud Run not configured (CLOUD_RUN_STITCHER_URL missing)`);
    }

    // METHOD 2: Use Gemini to generate an image that matches the video's last frame
    // This creates an actual image that Veo can use for frame-chaining
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY) {
      console.log(`[ExtractFrame] Trying Gemini image generation from video analysis...`);
      
      try {
        // Step 1: Analyze the video to get a detailed description of the target frame
        const positionPrompt = position === 'first' 
          ? 'Describe the FIRST frame of this video in extreme detail for image recreation. Include: exact character positions, poses, expressions, clothing, lighting direction, shadows, background elements, colors, textures, and composition.'
          : position === 'last'
          ? 'Describe the LAST/FINAL frame of this video in extreme detail for image recreation. Include: exact character positions, poses, expressions, clothing, lighting direction, shadows, background elements, colors, textures, and composition.'
          : `Describe the frame at ${position} seconds in extreme detail for image recreation.`;

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
                  { type: 'text', text: positionPrompt },
                  { type: 'image_url', image_url: { url: videoUrl } }
                ]
              }
            ],
          }),
        });

        if (analysisResponse.ok) {
          const aiResponse = await analysisResponse.json();
          const frameDescription = aiResponse.choices?.[0]?.message?.content;
          
          if (frameDescription) {
            console.log(`[ExtractFrame] Frame analyzed: ${frameDescription.substring(0, 150)}...`);
            
            // Step 2: Generate an actual image based on the description
            console.log(`[ExtractFrame] Generating image from description...`);
            
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
                    content: `Generate a high-quality, photorealistic still image that EXACTLY matches this description. This will be used as a video frame, so it must be realistic and match the described scene precisely:\n\n${frameDescription}\n\nIMPORTANT: Match the exact composition, lighting, colors, and character positions. This is for video continuity.`
                  }
                ],
                modalities: ['image', 'text'],
              }),
            });

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              const generatedImage = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
              
              if (generatedImage) {
                console.log(`[ExtractFrame] ✓ Generated frame image via Gemini (${generatedImage.substring(0, 50)}...)`);
                
                // Upload the base64 image to Supabase storage for persistence
                try {
                  const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, '');
                  const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                  
                  const fileName = `frame_${projectId}_${shotId}_${position}_${Date.now()}.png`;
                  const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('video-clips')
                    .upload(fileName, imageBuffer, {
                      contentType: 'image/png',
                      upsert: true,
                    });

                  if (!uploadError && uploadData) {
                    const { data: urlData } = supabase.storage
                      .from('video-clips')
                      .getPublicUrl(fileName);
                    
                    const persistedUrl = urlData.publicUrl;
                    console.log(`[ExtractFrame] ✓ Frame uploaded to storage: ${persistedUrl.substring(0, 80)}...`);
                    
                    return new Response(
                      JSON.stringify({
                        success: true,
                        frameUrl: persistedUrl,
                        frameDescription,
                        position: String(position),
                        method: 'gemini-generated',
                      }),
                      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                  } else {
                    console.warn(`[ExtractFrame] Storage upload failed:`, uploadError);
                    // Return the base64 URL directly as fallback
                    return new Response(
                      JSON.stringify({
                        success: true,
                        frameUrl: generatedImage,
                        frameDescription,
                        position: String(position),
                        method: 'gemini-generated-base64',
                      }),
                      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                  }
                } catch (uploadErr) {
                  console.warn(`[ExtractFrame] Upload error, using base64:`, uploadErr);
                  return new Response(
                    JSON.stringify({
                      success: true,
                      frameUrl: generatedImage,
                      frameDescription,
                      position: String(position),
                      method: 'gemini-generated-base64',
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              }
            } else {
              console.warn(`[ExtractFrame] Image generation failed: ${imageResponse.status}`);
            }
          }
        } else {
          console.warn(`[ExtractFrame] Video analysis failed: ${analysisResponse.status}`);
        }
      } catch (geminiError) {
        console.warn(`[ExtractFrame] Gemini pipeline failed:`, geminiError);
      }
    }

    // CRITICAL: Do NOT return video URL as frame - it will break Veo!
    // If we get here, we have no valid frame extraction method
    console.error(`[ExtractFrame] ⚠️ CRITICAL: All frame extraction methods failed!`);
    console.error(`[ExtractFrame] Cannot return video URL as frame - Veo requires actual images.`);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Frame extraction failed - no valid image could be extracted from video. Cloud Run FFmpeg not available and Gemini fallback failed.",
        videoUrl: videoUrl, // Include for debugging only
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ExtractFrame] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
