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
    // METHOD 1: Cloud Run FFmpeg with HYBRID BASE64 ARCHITECTURE
    // Cloud Run returns base64, we upload to Lovable Cloud storage
    // ============================================================
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (cloudRunUrl) {
      try {
        const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
        const extractEndpoint = `${normalizedUrl}/extract-frame`;
        
        console.log(`[ExtractFrame] METHOD 1: Trying Cloud Run FFmpeg (hybrid base64)...`);
        
        const response = await fetch(extractEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipUrl: videoUrl,
            clipIndex: shotId,
            projectId,
            position,
            returnBase64: true, // HYBRID: Request base64 instead of direct upload
          }),
        });

        if (response.ok) {
          const result = await response.json();
          
          // HYBRID ARCHITECTURE: Cloud Run returns base64, we upload to Lovable storage
          if (result.frameBase64) {
            console.log(`[ExtractFrame] Got base64 from Cloud Run, uploading to Lovable storage...`);
            
            const base64Data = result.frameBase64.replace(/^data:image\/\w+;base64,/, '');
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const filename = `${projectId}/frame-${shotId}-${position}-${Date.now()}.jpg`;
            
            const { error: uploadError } = await supabase.storage
              .from('temp-frames')
              .upload(filename, binaryData, {
                contentType: 'image/jpeg',
                upsert: true
              });

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('temp-frames')
                .getPublicUrl(filename);
              
              const frameUrl = urlData.publicUrl;
              console.log(`[ExtractFrame] ✓ METHOD 1 SUCCESS (Cloud Run hybrid): ${frameUrl.substring(0, 80)}...`);
              
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
              console.warn(`[ExtractFrame] Storage upload failed:`, uploadError.message);
            }
          }
          
          // LEGACY: Cloud Run uploaded directly and returned URL
          const frameUrl = result.lastFrameUrl || result.frameUrl;
          if (frameUrl && !frameUrl.endsWith('.mp4') && !frameUrl.includes('video/')) {
            console.log(`[ExtractFrame] ✓ METHOD 1 SUCCESS (Cloud Run direct): ${frameUrl.substring(0, 80)}...`);
            
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
    // METHOD 2: OpenAI gpt-image-1 + DALL-E 3 (generates from video thumbnail)
    // NOTE: GPT-4o vision cannot process video URLs directly (400 error)
    // Strategy: Generate a matching continuation image from prompt context
    // ============================================================
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (OPENAI_API_KEY) {
      console.log(`[ExtractFrame] METHOD 2: Trying OpenAI image generation...`);
      
      try {
        // Since we can't analyze the video directly, we'll use the video URL patterns
        // to understand what kind of frame we need and generate it
        // The video URL often contains project/clip info we can use
        
        // Extract any context from the URL
        const urlParts = videoUrl.split('/');
        const clipFileName = urlParts[urlParts.length - 1] || 'clip';
        
        // Use Lovable AI (Gemini) for video analysis since it supports video
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        let frameDescription = '';
        
        if (LOVABLE_API_KEY) {
          try {
            const positionPrompt = position === 'first' 
              ? 'Describe the FIRST frame of this video'
              : position === 'last'
              ? 'Describe the LAST/FINAL frame of this video as it ends'
              : `Describe the frame at ${position} seconds`;

            const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'openai/gpt-5.2',
                messages: [
                  {
                    role: 'user',
                    content: [
                      { type: 'text', text: `${positionPrompt} in precise detail for image recreation. Focus on: characters (appearance, pose, position), environment, lighting, camera angle. Be specific and visual.` },
                      { type: 'image_url', image_url: { url: videoUrl } }
                    ]
                  }
                ],
                max_tokens: 500,
              }),
            });

            if (analysisResponse.ok) {
              const aiResponse = await analysisResponse.json();
              frameDescription = aiResponse.choices?.[0]?.message?.content || '';
              console.log(`[ExtractFrame] Video analyzed: ${frameDescription.substring(0, 100)}...`);
            } else {
              console.warn(`[ExtractFrame] Video analysis failed: ${analysisResponse.status}`);
            }
          } catch (analysisErr) {
            console.warn(`[ExtractFrame] Video analysis error:`, analysisErr);
          }
        }
        
        // If we got a description, generate matching image with OpenAI
        if (frameDescription) {
          const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-image-1',
              prompt: `Photorealistic video frame: ${frameDescription}. 
                       Cinematic quality, natural lighting, sharp focus.
                       This is a still from a high-budget film.
                       No text, no watermarks, no UI elements.`,
              n: 1,
              size: '1536x1024', // 16:9 aspect for video frames
              quality: 'high',
            }),
          });

          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            const base64Image = imageData.data?.[0]?.b64_json;
            
            if (base64Image) {
              const frameUrl = await uploadFrame(`data:image/png;base64,${base64Image}`, 'openai-gpt-image');
              
              if (frameUrl) {
                console.log(`[ExtractFrame] ✓ METHOD 2 SUCCESS (OpenAI): ${frameUrl.substring(0, 80)}...`);
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
            const errText = await imageResponse.text();
            console.warn(`[ExtractFrame] METHOD 2 image generation failed: ${imageResponse.status} - ${errText.substring(0, 100)}`);
          }
        } else {
          console.warn(`[ExtractFrame] METHOD 2 skipped: no frame description available`);
        }
      } catch (openaiError) {
        console.warn(`[ExtractFrame] METHOD 2 ERROR:`, openaiError);
      }
    }

    // ============================================================
    // METHOD 3: Gemini Pro Image Generation (backup)
    // Uses google/gemini-3-pro-image-preview for best quality
    // ============================================================
    const LOVABLE_API_KEY_M3 = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY_M3) {
      console.log(`[ExtractFrame] METHOD 3: Trying Gemini Pro Image...`);
      
      try {
        // First analyze the video to get a description
        const positionPrompt = position === 'first' 
          ? 'Describe the FIRST frame of this video in extreme detail for image recreation.'
          : position === 'last'
          ? 'Describe the LAST/FINAL frame of this video in extreme detail for image recreation.'
          : `Describe the frame at ${position} seconds in extreme detail.`;

        const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY_M3}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-5.2',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: `${positionPrompt} Include: subject appearance, pose, position in frame, environment, lighting, color palette.` },
                  { type: 'image_url', image_url: { url: videoUrl } }
                ]
              }
            ],
            max_tokens: 400,
          }),
        });

        if (analysisResponse.ok) {
          const aiResponse = await analysisResponse.json();
          const frameDescription = aiResponse.choices?.[0]?.message?.content;
          
          if (frameDescription) {
            console.log(`[ExtractFrame] Frame analyzed: ${frameDescription.substring(0, 100)}...`);
            
            // Use the Gemini 3 Pro Image model for best generation
            const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY_M3}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-3-pro-image-preview',
                messages: [
                  {
                    role: 'user',
                    content: `Generate a photorealistic video frame matching this description exactly: ${frameDescription}. 
                              Cinematic quality, 16:9 aspect ratio, movie-quality lighting. 
                              No text overlays, no watermarks.`
                  }
                ],
              }),
            });

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              
              // Handle different response formats
              const generatedImage = 
                imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
                imageData.choices?.[0]?.message?.content?.match(/data:image[^"]+/)?.[0] ||
                imageData.data?.[0]?.b64_json;
              
              if (generatedImage) {
                const frameUrl = await uploadFrame(
                  generatedImage.startsWith('data:') ? generatedImage : `data:image/png;base64,${generatedImage}`, 
                  'gemini-pro-image'
                );
                
                if (frameUrl) {
                  console.log(`[ExtractFrame] ✓ METHOD 3 SUCCESS (Gemini Pro Image): ${frameUrl.substring(0, 80)}...`);
                  return new Response(
                    JSON.stringify({
                      success: true,
                      frameUrl,
                      frameDescription,
                      position: String(position),
                      method: 'gemini-pro-image',
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              } else {
                console.warn(`[ExtractFrame] METHOD 3: No image in response`);
              }
            } else {
              const errStatus = imageResponse.status;
              console.warn(`[ExtractFrame] METHOD 3 image generation failed: ${errStatus}`);
            }
          }
        } else {
          const errStatus = analysisResponse.status;
          console.warn(`[ExtractFrame] METHOD 3 analysis failed: ${errStatus}`);
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
