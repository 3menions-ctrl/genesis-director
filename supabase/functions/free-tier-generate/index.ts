import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * free-tier-generate — cheap text-to-video for free / unverified users.
 *
 * Routes generation to LTX-Video (configurable via `free_tier.model_version`).
 * Enforces both per-user (`free_tier.daily_per_user`) and platform-wide
 * (`free_tier.daily_platform_budget_usd`) caps via `free_tier_status` RPC.
 *
 * Output: 320×320 watermarked 5-second video. The watermark + "Made on
 * Small Bridges Free" overlay are applied by the downstream stitch pipeline.
 *
 * Request:  { prompt: string, projectId?: string }
 * Response: { ok: true, predictionId, used_today, limit, remaining }
 *           { ok: false, reason: 'rate_limit'|'platform_cap'|'content'|... }
 */

const CONTENT_BLOCKLIST = [
  "porn", "nude", "naked", "nsfw", "xxx", "sex",
  "kill", "murder", "rape", "blood", "gore",
  "child", "minor", "underage",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { validateAuth, unauthorizedResponse } = await import(
      "../_shared/auth-guard.ts"
    );
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const projectId = typeof body.projectId === "string" ? body.projectId : null;

    if (!prompt || prompt.length < 8) {
      return json({ ok: false, reason: "prompt_too_short" });
    }
    if (prompt.length > 240) {
      return json({ ok: false, reason: "prompt_too_long" });
    }
    const lower = prompt.toLowerCase();
    if (CONTENT_BLOCKLIST.some((b) => lower.includes(b))) {
      return json({
        ok: false,
        reason: "content",
        message:
          "We can't generate that prompt. Try something cinematic — a scene, a character, a moment.",
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check the user's free-tier status.
    const { data: statusData } = await supabase.rpc("free_tier_status", {
      p_user: auth.userId,
    });
    const status = statusData as {
      allowed: boolean;
      used_today: number;
      limit: number;
      reason: string | null;
      platform_spent_usd: number;
      platform_cap_usd: number;
      next_reset_at: string;
    };

    if (!status.allowed) {
      // Log the attempt for observability.
      await supabase.from("free_tier_attempts").insert({
        user_id: auth.userId,
        project_id: projectId,
        status: status.reason ?? "rate_limit",
      });
      return json({
        ok: false,
        reason: status.reason,
        used_today: status.used_today,
        limit: status.limit,
        next_reset_at: status.next_reset_at,
        message:
          status.reason === "platform_cap"
            ? "Small Bridges's free engine is fully booked for today. Upgrade for unlimited renders, or check back at UTC midnight."
            : `You've used today's ${status.limit} free renders. Upgrade for unlimited.`,
      });
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      await supabase.from("free_tier_attempts").insert({
        user_id: auth.userId,
        project_id: projectId,
        status: "failed",
      });
      return json({
        ok: false,
        reason: "config",
        message: "Free tier engine is not configured yet.",
      });
    }

    // Get the model version from system_config so we can change models
    // without redeploying the edge function.
    const { data: versionRow } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "free_tier.model_version")
      .maybeSingle();
    const modelVersion =
      (versionRow?.value as string | undefined)?.replace(/^"|"$/g, "") ??
      "by3hnxsapnzj1qzsmm4qm9d4j5p1fqq1pj6q3w89mr04kdb3dpgw"; // LTX-Video default

    // Record the attempt BEFORE firing so concurrent requests can't bypass
    // the cap (the next free_tier_status call will see this row).
    const { data: attempt } = await supabase
      .from("free_tier_attempts")
      .insert({
        user_id: auth.userId,
        project_id: projectId,
        status: "started",
        estimated_cost_usd: 0.05,
      })
      .select("id")
      .single();

    // Fire the prediction.
    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          prompt: `cinematic shot: ${prompt}, professional cinematography, sharp focus`,
          num_frames: 121,         // ~5s at 24fps
          width: 320,
          height: 320,
          guidance_scale: 3.5,
          num_inference_steps: 25,
          seed: Math.floor(Math.random() * 1_000_000),
        },
      }),
    });

    if (!predRes.ok) {
      const errText = await predRes.text();
      console.error(
        `[free-tier-generate] Replicate ${predRes.status}: ${errText.slice(0, 400)}`,
      );
      await supabase
        .from("free_tier_attempts")
        .update({ status: "failed" })
        .eq("id", attempt?.id);
      return json({
        ok: false,
        reason: "model_error",
        message: "The free engine is warming up. Try again in a moment.",
      });
    }

    const prediction = await predRes.json();
    await supabase
      .from("free_tier_attempts")
      .update({
        status: "succeeded",
        prediction_id: prediction.id ?? null,
      })
      .eq("id", attempt?.id);

    return json({
      ok: true,
      predictionId: prediction.id,
      used_today: status.used_today + 1,
      limit: status.limit,
      remaining: Math.max(0, status.limit - status.used_today - 1),
      next_reset_at: status.next_reset_at,
    });
  } catch (error) {
    console.error("[free-tier-generate] Error:", error);
    return json({
      ok: false,
      reason: "internal",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
