import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MOTION TRANSFER - Pose Transfer Animation
 * 
 * Extracts motion from a source video and applies it to a target image/video.
 * Uses Kling AI native API for high-quality motion-guided generation.
 * 
 * NOTE: This is a placeholder implementation. Motion transfer requires
 * specialized models (like MagicAnimate, Animate Anyone, etc.) that aren't
 * currently available through our standard video generation pipeline.
 * 
 * Current behavior: Returns informative error directing users to avatar mode
 * for similar functionality.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const { sourceVideoUrl, targetImageUrl, mode = 'image' } = await req.json();

    if (!sourceVideoUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "sourceVideoUrl is required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mode === 'image' && !targetImageUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "targetImageUrl is required for image mode" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[motion-transfer] Mode: ${mode}`);
    console.log(`[motion-transfer] Source video: ${sourceVideoUrl}`);
    console.log(`[motion-transfer] Target image: ${targetImageUrl}`);

    // FIX #1: Motion transfer returns 503 but mode-router still deducts credits.
    // Return a clear 501 (Not Implemented) so mode-router can detect and skip credit deduction.
    return new Response(
      JSON.stringify({
        success: false,
        error: "Motion transfer is not yet available. Use Avatar mode instead for animated character videos.",
        suggestion: "Use Avatar mode for animated character videos. Select an avatar and it will be animated with AI-generated motion.",
        alternativeMode: "avatar",
        notImplemented: true,
      }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[motion-transfer] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
