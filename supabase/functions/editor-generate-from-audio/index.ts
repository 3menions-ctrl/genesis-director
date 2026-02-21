import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KLING_MODEL_URL = "https://api.replicate.com/v1/models/kwaivgi/kling-v3-video/predictions";
const REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";

// Quality suffix for cinematic output
const QUALITY_SUFFIX = ", cinematic lighting, ultra high definition, professional cinematography, masterful composition, clean sharp image";

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

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      return new Response(JSON.stringify({ error: "REPLICATE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, duration_seconds = 6 } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clampedDuration = Math.min(Math.max(duration_seconds, 3), 15);
    const enhancedPrompt = prompt + QUALITY_SUFFIX;

    console.log(`[EditorGenFromAudio] Generating ${clampedDuration}s clip: "${prompt.substring(0, 80)}..."`);

    // Create Kling V3 prediction
    const createResp = await fetch(KLING_MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: enhancedPrompt,
          negative_prompt: "blurry, low quality, distorted, watermark, text overlay",
          duration: clampedDuration,
          aspect_ratio: "16:9",
          mode: "std",
        },
      }),
    });

    if (!createResp.ok) {
      const errText = await createResp.text();
      console.error("[EditorGenFromAudio] Replicate create error:", createResp.status, errText);
      return new Response(JSON.stringify({ error: "Failed to start video generation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prediction = await createResp.json();
    const predictionId = prediction.id;
    console.log(`[EditorGenFromAudio] Prediction created: ${predictionId}`);

    // Poll for completion (max ~5 minutes)
    const maxPollTime = 300_000;
    const startTime = Date.now();
    let pollInterval = 3000;

    while (Date.now() - startTime < maxPollTime) {
      await new Promise((r) => setTimeout(r, pollInterval));
      pollInterval = Math.min(pollInterval * 1.2, 10000);

      const statusResp = await fetch(`${REPLICATE_PREDICTIONS_URL}/${predictionId}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      });

      if (!statusResp.ok) continue;

      const status = await statusResp.json();

      if (status.status === "succeeded") {
        const videoUrl = typeof status.output === "string" ? status.output : status.output?.[0];
        if (!videoUrl) {
          return new Response(JSON.stringify({ error: "No video URL in output" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[EditorGenFromAudio] ✓ Video ready: ${videoUrl.substring(0, 80)}...`);
        return new Response(JSON.stringify({ video_url: videoUrl, duration: clampedDuration }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (status.status === "failed" || status.status === "canceled") {
        console.error(`[EditorGenFromAudio] Prediction ${status.status}:`, status.error);
        return new Response(JSON.stringify({ error: status.error || "Video generation failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Generation timed out" }), {
      status: 504,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[EditorGenFromAudio] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
