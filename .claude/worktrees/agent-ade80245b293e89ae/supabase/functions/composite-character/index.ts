import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * COMPOSITE-CHARACTER - Extract character from image and overlay onto background
 * 
 * Pipeline:
 * 1. Use background removal (BiRefNet) to extract the character with transparency
 * 2. Use FLUX Fill to seamlessly composite character onto the background scene
 * 
 * This creates a natural-looking scene with the character properly placed.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const { 
      characterImageUrl,
      characterBase64,
      backgroundImageUrl,
      backgroundBase64,
      placement = "center", // "center", "left", "right"
      scale = 0.7, // Character scale relative to frame height
      aspectRatio = "16:9"
    } = await req.json();

    if (!characterImageUrl && !characterBase64) {
      throw new Error("Character image is required (URL or base64)");
    }
    if (!backgroundImageUrl && !backgroundBase64) {
      throw new Error("Background image is required (URL or base64)");
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    console.log("[composite-character] Starting character extraction and compositing...");

    // Step 1: Remove background from character image using BiRefNet
    console.log("[composite-character] Step 1: Extracting character with BiRefNet...");
    
    const characterInput = characterImageUrl || `data:image/jpeg;base64,${characterBase64}`;
    
    const bgRemovalResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "lucataco/remove-bg",
        input: {
          image: characterInput,
        },
      }),
    });

    if (!bgRemovalResponse.ok) {
      const errText = await bgRemovalResponse.text();
      console.error("[composite-character] Background removal failed:", errText);
      throw new Error(`Background removal failed: ${errText}`);
    }

    const bgRemovalPrediction = await bgRemovalResponse.json();
    console.log("[composite-character] BG removal prediction created:", bgRemovalPrediction.id);

    // Poll for background removal completion
    let extractedCharacterUrl: string | null = null;
    const maxBgAttempts = 60; // 60 seconds max
    
    for (let i = 0; i < maxBgAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${bgRemovalPrediction.id}`,
        { headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` } }
      );
      
      const status = await statusResponse.json();
      
      if (status.status === "succeeded") {
        extractedCharacterUrl = typeof status.output === 'string' ? status.output : status.output?.[0];
        console.log("[composite-character] ✅ Character extracted:", extractedCharacterUrl?.substring(0, 80));
        break;
      }
      
      if (status.status === "failed") {
        console.error("[composite-character] BG removal failed:", status.error);
        throw new Error(`Background removal failed: ${status.error}`);
      }
    }

    if (!extractedCharacterUrl) {
      throw new Error("Background removal timed out");
    }

    // Step 2: Composite character onto background using FLUX Fill (inpainting)
    console.log("[composite-character] Step 2: Compositing onto background with FLUX Fill...");
    
    const backgroundInput = backgroundImageUrl || `data:image/jpeg;base64,${backgroundBase64}`;
    
    // Generate a prompt that describes placing the person naturally in the scene
    const compositingPrompt = `A professional presenter standing ${placement === "center" ? "in the center" : placement === "left" ? "on the left side" : "on the right side"} of the frame, facing the camera, ready to speak. Natural lighting matching the environment. The person is dressed professionally and has a confident, friendly expression.`;
    
    // Use FLUX Fill for natural compositing
    const compositeResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "black-forest-labs/flux-1.1-pro",
        input: {
          prompt: compositingPrompt,
          image: extractedCharacterUrl,
          image_prompt: backgroundInput,
          prompt_upsampling: true,
          safety_tolerance: 5,
          aspect_ratio: aspectRatio,
          output_format: "jpg",
          output_quality: 95,
        },
      }),
    });

    if (!compositeResponse.ok) {
      const errText = await compositeResponse.text();
      console.error("[composite-character] Compositing failed:", errText);
      
      // Fallback: Just use the extracted character directly
      console.log("[composite-character] Falling back to extracted character only");
      return new Response(
        JSON.stringify({
          success: true,
          compositedImageUrl: extractedCharacterUrl,
          method: "extraction_only",
          message: "Character extracted but compositing unavailable. Using extracted character.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const compositePrediction = await compositeResponse.json();
    console.log("[composite-character] Composite prediction created:", compositePrediction.id);

    // Poll for compositing completion
    let compositedImageUrl: string | null = null;
    const maxCompAttempts = 90; // 90 seconds max for compositing
    
    for (let i = 0; i < maxCompAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${compositePrediction.id}`,
        { headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` } }
      );
      
      const status = await statusResponse.json();
      
      if (status.status === "succeeded") {
        compositedImageUrl = typeof status.output === 'string' ? status.output : status.output?.[0];
        console.log("[composite-character] ✅ Compositing complete:", compositedImageUrl?.substring(0, 80));
        break;
      }
      
      if (status.status === "failed") {
        console.error("[composite-character] Compositing failed:", status.error);
        // Fallback to just extracted character
        return new Response(
          JSON.stringify({
            success: true,
            compositedImageUrl: extractedCharacterUrl,
            method: "extraction_only",
            message: "Compositing failed. Using extracted character.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (i % 15 === 0 && i > 0) {
        console.log(`[composite-character] Still compositing... (${i}s)`);
      }
    }

    if (!compositedImageUrl) {
      // Timeout - use extracted character as fallback
      return new Response(
        JSON.stringify({
          success: true,
          compositedImageUrl: extractedCharacterUrl,
          method: "extraction_only",
          message: "Compositing timed out. Using extracted character.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        compositedImageUrl,
        extractedCharacterUrl,
        method: "full_composite",
        message: "Character successfully composited onto background",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[composite-character] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
