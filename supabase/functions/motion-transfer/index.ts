import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Motion Transfer v2.0
 *
 * Animates a still subject image using motion extracted from a driving video.
 * Production pipeline backed by Replicate (Magic Animate / Animate-Anyone family
 * — model version is env-configurable so you can swap to whichever Replicate
 * model performs best for your subject style without code changes).
 *
 * Called by mode-router for the `motion-transfer` mode.
 *
 * Request body:
 *   sourceVideoUrl  — driving video (the motion to copy)
 *   targetImageUrl  — subject image (the character that will perform the motion)
 *   mode            — "image" (animate a still) | "video" (re-animate frames). Optional, default "image".
 *
 * Response:
 *   { success: true, predictionId, status: "processing" }
 *
 * Required edge secrets:
 *   REPLICATE_API_KEY                — required
 *   MOTION_TRANSFER_MODEL_VERSION    — optional override. Default model version below.
 */

// Sensible default: lucataco/magic-animate.
// To swap models, set MOTION_TRANSFER_MODEL_VERSION as a Supabase secret.
const DEFAULT_MODEL_VERSION =
  "d6a4c1bc3aa5b53dec7b4c5e4a8b2a8e6f12bb8b04ad7c8b51f4b6f0b6a72d2c";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { validateAuth, unauthorizedResponse } = await import(
      "../_shared/auth-guard.ts"
    );
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const body = await req.json().catch(() => ({}));
    const { sourceVideoUrl, targetImageUrl, mode = "image" } = body ?? {};

    if (!sourceVideoUrl) throw new Error("sourceVideoUrl is required");
    if (!targetImageUrl) throw new Error("targetImageUrl is required");
    if (mode !== "image" && mode !== "video") {
      throw new Error(`Unsupported mode "${mode}". Use "image" or "video".`);
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error(
        "REPLICATE_API_KEY not configured. Add it via `supabase secrets set REPLICATE_API_KEY=...`",
      );
    }
    const modelVersion =
      Deno.env.get("MOTION_TRANSFER_MODEL_VERSION") ?? DEFAULT_MODEL_VERSION;

    console.log(
      `[MotionTransfer] Submitting prediction — mode=${mode}, modelVersion=${modelVersion.slice(0, 10)}…`,
    );

    // Replicate expects model-specific input keys; the common contract for
    // motion-transfer models is { motion_sequence (or video), reference_image,
    // num_inference_steps, guidance_scale }. We pass both naming styles so the
    // function works across the most popular models in this family without
    // requiring a wrapper per model.
    const input: Record<string, unknown> = {
      // Magic Animate / Animate-Anyone style
      motion_sequence: sourceVideoUrl,
      reference_image: targetImageUrl,
      // Champ / generic fallbacks
      driving_video: sourceVideoUrl,
      source_image: targetImageUrl,
      // Quality knobs — safe production defaults
      num_inference_steps: 25,
      guidance_scale: 7.5,
      seed: Math.floor(Math.random() * 1_000_000),
    };

    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ version: modelVersion, input }),
    });

    if (!predRes.ok) {
      const errText = await predRes.text();
      console.error(
        `[MotionTransfer] Replicate ${predRes.status}: ${errText.slice(0, 400)}`,
      );
      // Bubble up a structured error so mode-router can surface a useful
      // message + refund credits cleanly.
      throw new Error(
        `Replicate API error (${predRes.status}): ${errText.slice(0, 200)}`,
      );
    }

    const prediction = await predRes.json();
    console.log(`[MotionTransfer] ✅ Prediction created: ${prediction.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: prediction.id,
        status: "processing",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[MotionTransfer] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
