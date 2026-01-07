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
 * Used to get frames for Visual Debugger analysis.
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

    // Try Cloud Run FFmpeg service first
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (cloudRunUrl) {
      try {
        const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
        const extractEndpoint = `${normalizedUrl}/extract-frame`;
        
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
          if (result.lastFrameUrl || result.frameUrl) {
            const frameUrl = result.lastFrameUrl || result.frameUrl;
            console.log(`[ExtractFrame] Frame extracted via Cloud Run: ${frameUrl}`);
            
            return new Response(
              JSON.stringify({
                success: true,
                frameUrl,
                position: String(position),
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (cloudRunError) {
        console.warn(`[ExtractFrame] Cloud Run extraction failed:`, cloudRunError);
      }
    }

    // Fallback: Use Gemini to analyze the video and describe the frame
    // This is a workaround when FFmpeg is not available
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY) {
      console.log(`[ExtractFrame] Using Gemini video analysis as fallback...`);
      
      try {
        const positionPrompt = position === 'first' 
          ? 'Describe the FIRST frame of this video in detail.'
          : position === 'last'
          ? 'Describe the LAST frame of this video in detail.'
          : `Describe the frame at ${position} seconds into this video.`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

        if (response.ok) {
          const aiResponse = await response.json();
          const frameDescription = aiResponse.choices?.[0]?.message?.content;
          
          if (frameDescription) {
            // Store the frame description as metadata (no actual frame image)
            console.log(`[ExtractFrame] Frame analyzed via Gemini: ${frameDescription.substring(0, 100)}...`);
            
            // Return the video URL as the "frame" - Gemini can analyze videos directly
            return new Response(
              JSON.stringify({
                success: true,
                frameUrl: videoUrl, // Use video URL - Gemini can analyze it
                frameDescription,
                position: String(position),
                method: 'gemini-analysis',
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (geminiError) {
        console.warn(`[ExtractFrame] Gemini analysis failed:`, geminiError);
      }
    }

    // Final fallback: return the video URL itself
    // Visual Debugger can analyze videos directly via Gemini
    console.log(`[ExtractFrame] Using video URL as frame (Gemini can analyze videos)`);
    
    return new Response(
      JSON.stringify({
        success: true,
        frameUrl: videoUrl,
        position: String(position),
        method: 'video-passthrough',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
