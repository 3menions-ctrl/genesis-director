import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { preflightAiGate, chargeAiGate } from "../_shared/ai-credit-gate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Stylize Video v2.0
 * 
 * Applies style transfer to an existing video using Replicate.
 * Called by mode-router for video-to-video mode.
 * 
 * Input: { videoUrl, style }
 * Output: { success, predictionId }
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

    const { videoUrl, style } = await req.json();

    if (!videoUrl) throw new Error("videoUrl is required");
    if (!style) throw new Error("style is required");

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY not configured");

    // ═══ CREDIT GATE: rate-limit + balance pre-check BEFORE the paid video call ═══
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const gateCtx = {
      supabase: supabaseAdmin,
      fnName: "stylize-video",
      userId: auth.userId,
      isServiceRole: auth.isServiceRole,
      projectId: null,
      cost: 25,
      dailyCap: 30,
      corsHeaders,
    };
    const gateBlock = await preflightAiGate(gateCtx);
    if (gateBlock) return gateBlock;

    console.log(`[StylizeVideo] Applying style "${style}" to video`);

    // Use Replicate video-to-video model
    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Using a general video stylization model on Replicate
        version: "c02b3c1df64728476b1c21b0876235119e6ac08b0c9b8a99b82c5f0e0d42442d",
        input: {
          video: videoUrl,
          style_prompt: style,
        },
      }),
    });

    if (!predRes.ok) {
      const errText = await predRes.text();
      console.error(`[StylizeVideo] Replicate error ${predRes.status}: ${errText}`);
      throw new Error(`Replicate API error: ${predRes.status}`);
    }

    const prediction = await predRes.json();
    console.log(`[StylizeVideo] ✅ Prediction created: ${prediction.id}`);

    // ═══ CREDIT GATE: charge once now that the prediction was submitted ═══
    await chargeAiGate(gateCtx);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: prediction.id,
        status: "processing",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[StylizeVideo] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
