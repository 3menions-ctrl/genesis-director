import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * editor-generate-clip — Lightweight video generation for the editor (Seedance)
 * 
 * Actions:
 *   "submit"  → Kick off a Seedance-1-Pro prediction, returns predictionId
 *   "status"  → Poll prediction status, returns videoUrl when done
 */

const SEEDANCE_T2V_URL = "https://api.replicate.com/v1/models/bytedance/seedance-1-pro/predictions";
const SEEDANCE_I2V_URL = "https://api.replicate.com/v1/models/bytedance/seedance-1-pro/predictions";
const REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";

const QUALITY_SUFFIX = ", cinematic lighting, ultra high definition, highly detailed, professional cinematography, masterful composition, clean sharp image";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_KEY") || Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      console.error("[editor-generate-clip] REPLICATE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "REPLICATE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ─── SUBMIT ───
    if (action === "submit") {
      const { prompt, duration = 10, startImageUrl, aspectRatio = "16:9" } = body;

      if (!prompt) {
        return new Response(JSON.stringify({ error: "prompt is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check credits
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: profile } = await supabase
        .from("profiles")
        .select("credits_balance")
        .eq("id", auth.userId)
        .single();

      const creditsRequired = duration > 10 ? 75 : 50;
      if (!profile || profile.credits_balance < creditsRequired) {
        return new Response(JSON.stringify({ 
          error: "Insufficient credits", 
          required: creditsRequired, 
          available: profile?.credits_balance || 0 
        }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduct credits
      await supabase.rpc("deduct_credits", {
        p_user_id: auth.userId,
        p_amount: creditsRequired,
        p_description: `Editor clip generation (${duration}s)`,
      });

      // Build Seedance input
      const seedanceInput: Record<string, any> = {
        prompt: prompt + QUALITY_SUFFIX,
        duration: Number(duration) === 10 ? 10 : 5,
        aspect_ratio: aspectRatio,
        resolution: "1080p",
        fps: 24,
        camera_fixed: false,
      };

      if (startImageUrl) {
        seedanceInput.image = startImageUrl;
      }

      // Submit to Replicate (Seedance-1-Pro)
      const replicateRes = await fetch(startImageUrl ? SEEDANCE_I2V_URL : SEEDANCE_T2V_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait=5",
        },
        body: JSON.stringify({ input: seedanceInput }),
      });

      if (!replicateRes.ok) {
        const errText = await replicateRes.text();
        console.error("[editor-generate-clip] Replicate error:", errText);
        // Refund on failure
        await supabase.rpc("increment_credits", {
          user_id_param: auth.userId,
          amount_param: creditsRequired,
        });
        return new Response(JSON.stringify({ error: "Failed to start generation" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prediction = await replicateRes.json();

      // Log cost
      await supabase.from("api_cost_logs").insert({
        user_id: auth.userId,
        service: "seedance-1-pro",
        operation: "editor-generate-clip",
        credits_charged: creditsRequired,
        real_cost_cents: duration > 10 ? 15 : 10,
        duration_seconds: duration,
        status: "pending",
        metadata: { predictionId: prediction.id },
      });

      return new Response(JSON.stringify({
        success: true,
        predictionId: prediction.id,
        creditsCharged: creditsRequired,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── STATUS ───
    if (action === "status") {
      const { predictionId } = body;
      if (!predictionId) {
        return new Response(JSON.stringify({ error: "predictionId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pollRes = await fetch(`${REPLICATE_PREDICTIONS_URL}/${predictionId}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });

      if (!pollRes.ok) {
        return new Response(JSON.stringify({ status: "error", error: "Failed to poll" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prediction = await pollRes.json();

      if (prediction.status === "succeeded") {
        const videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        return new Response(JSON.stringify({
          status: "completed",
          videoUrl,
          metrics: prediction.metrics,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (prediction.status === "failed" || prediction.status === "canceled") {
        return new Response(JSON.stringify({
          status: "failed",
          error: prediction.error || "Generation failed",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Still processing
      return new Response(JSON.stringify({
        status: "processing",
        progress: prediction.status === "processing" ? 50 : 10,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[editor-generate-clip] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
