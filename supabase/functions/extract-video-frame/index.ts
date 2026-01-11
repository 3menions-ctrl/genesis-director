import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Extract Video Frame
 * 
 * Extracts a specific frame from a video for frame-chaining.
 * CRITICAL: Must return an ACTUAL IMAGE URL, never a video URL!
 * 
 * Priority:
 * 1. Cloud Run FFmpeg (pixel-perfect extraction)
 * 2. OpenAI gpt-image-1 (generates matching image from video description)
 * 3. Gemini image generation (backup)
 */

interface ExtractFrameRequest {
  videoUrl: string;
  projectId: string;
  shotId: string;
  position: 'first' | 'last' | 'middle' | number;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Helper to upload image and get URL
    const uploadFrame = async (imageData: string, method: string): Promise<string | null> => {
      try {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        const fileName = `frame_${projectId}_${shotId}_${position}_${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('temp-frames')
          .upload(fileName, imageBuffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) {
          console.warn(`[ExtractFrame] Upload failed (${method}):`, uploadError.message);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('temp-frames')
          .getPublicUrl(fileName);
        
        console.log(`[ExtractFrame] ✓ Frame uploaded via ${method}: ${urlData.publicUrl.substring(0, 80)}...`);
        return urlData.publicUrl;
      } catch (err) {
        console.warn(`[ExtractFrame] Upload error (${method}):`, err);
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
        
        console.log(`[ExtractFrame] METHOD 1: Trying Cloud Run FFmpeg...`);
        
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
          
          // Validate it's actually an image URL
          if (frameUrl && !frameUrl.endsWith('.mp4') && !frameUrl.includes('video/')) {
            console.log(`[ExtractFrame] ✓ METHOD 1 SUCCESS (Cloud Run): ${frameUrl.substring(0, 80)}...`);
            
            return new Response(
              JSON.stringify({
                success: true,
                frameUrl,
                position: String(position),
                method: 'cloud-run-ffmpeg',
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          const errorText = await response.text();
          console.warn(`[ExtractFrame] METHOD 1 FAILED: ${response.status} - ${errorText.substring(0, 150)}`);
        }
      } catch (cloudRunError) {
        console.warn(`[ExtractFrame] METHOD 1 ERROR:`, cloudRunError);
      }
    }

    // ============================================================
    // METHOD 2: OpenAI gpt-image-1 (generates from video description)
    // ============================================================
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (OPENAI_API_KEY) {
      console.log(`[ExtractFrame] METHOD 2: Trying OpenAI gpt-image-1...`);
      
      try {
        // First, describe the video frame using GPT-4 vision
        const positionText = position === 'first' ? 'first' : position === 'last' ? 'last/final' : `${position} second`;
        
        const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { 
                    type: 'text', 
                    text: `Describe the ${positionText} frame of this video in precise detail for image recreation. Include: character appearance (face, body, clothing, pose), exact positions in frame, lighting (direction, color, intensity), background elements, color palette, camera angle. Be specific and visual.`
                  },
                  { type: 'image_url', image_url: { url: videoUrl } }
                ]
              }
            ],
            max_tokens: 500,
          }),
        });

        if (visionResponse.ok) {
          const visionData = await visionResponse.json();
          const frameDescription = visionData.choices?.[0]?.message?.content;
          
          if (frameDescription) {
            console.log(`[ExtractFrame] Frame described: ${frameDescription.substring(0, 100)}...`);
            
            // Generate image using gpt-image-1
            const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-image-1',
                prompt: `Photorealistic video frame recreation: ${frameDescription}. Match exact composition and lighting. No text, no watermarks.`,
                n: 1,
                size: '1024x1024',
                quality: 'high',
              }),
            });

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              const base64Image = imageData.data?.[0]?.b64_json;
              
              if (base64Image) {
                const frameUrl = await uploadFrame(`data:image/png;base64,${base64Image}`, 'openai-gpt-image');
                
                if (frameUrl) {
                  return new Response(
                    JSON.stringify({
                      success: true,
                      frameUrl,
                      frameDescription,
                      position: String(position),
                      method: 'openai-gpt-image',
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              }
            } else {
              console.warn(`[ExtractFrame] METHOD 2 image generation failed: ${imageResponse.status}`);
            }
          }
        } else {
          console.warn(`[ExtractFrame] METHOD 2 vision failed: ${visionResponse.status}`);
        }
      } catch (openaiError) {
        console.warn(`[ExtractFrame] METHOD 2 ERROR:`, openaiError);
      }
    }

    // ============================================================
    // METHOD 3: Gemini image generation (backup)
    // ============================================================
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY) {
      console.log(`[ExtractFrame] METHOD 3: Trying Gemini...`);
      
      try {
        const positionPrompt = position === 'first' 
          ? 'Describe the FIRST frame of this video in extreme detail.'
          : position === 'last'
          ? 'Describe the LAST/FINAL frame of this video in extreme detail.'
          : `Describe the frame at ${position} seconds.`;

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
            console.log(`[ExtractFrame] Frame analyzed: ${frameDescription.substring(0, 100)}...`);
            
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
                    content: `Generate a photorealistic still image matching: ${frameDescription}. This is for video continuity.`
                  }
                ],
                modalities: ['image', 'text'],
              }),
            });

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              const generatedImage = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
              
              if (generatedImage) {
                const frameUrl = await uploadFrame(generatedImage, 'gemini-image');
                
                if (frameUrl) {
                  return new Response(
                    JSON.stringify({
                      success: true,
                      frameUrl,
                      frameDescription,
                      position: String(position),
                      method: 'gemini-generated',
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              }
            } else {
              console.warn(`[ExtractFrame] METHOD 3 image generation failed: ${imageResponse.status}`);
            }
          }
        } else {
          console.warn(`[ExtractFrame] METHOD 3 analysis failed: ${analysisResponse.status}`);
        }
      } catch (geminiError) {
        console.warn(`[ExtractFrame] METHOD 3 ERROR:`, geminiError);
      }
    }

    // ============================================================
    // ALL METHODS FAILED
    // ============================================================
    console.error(`[ExtractFrame] ⚠️ CRITICAL: ALL ${cloudRunUrl ? '3' : '2'} methods failed!`);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Frame extraction failed - all methods exhausted (Cloud Run FFmpeg, OpenAI, Gemini)",
        videoUrl,
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
