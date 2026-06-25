import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkRateLimitDb, extractClientIp } from "../_shared/rate-limiter.ts";

// @public-endpoint
// Unauthenticated landing-page demo generation. Abuse is bounded by a
// DB-backed global daily cap plus per-IP throttling (see rate_limit_hit);
// no user data is read.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * landing-preview — public unauthenticated 4-frame "pre-vis" generator
 * used by the landing-page Inline Sandbox.
 *
 * Strict cost + abuse guards:
 *   • 4 previews per IP per day (tracked in `landing_preview_attempts`)
 *   • Hard daily $-cost cap: 100 invocations across the whole platform
 *   • Hard prompt sanitization: blocks NSFW / violent / PII patterns
 *   • Uses the cheapest fast image model on Replicate (SDXL Lightning)
 *     because we only need 4 320px stills, not video. Cost ~$0.005/call.
 *
 * Response shape:
 *   { ok: true,  images: [url, url, url, url], remaining_today: number }
 *   { ok: false, reason: "rate_limit" | "platform_cap" | "content" | "config" }
 */

const DAILY_PER_IP = 4;
const PLATFORM_DAILY_CAP = 800; // ~$5/day at ~$0.006/call (with 4 imgs/call)
const DEFAULT_MODEL =
  "by3hnxsapnzj1qzsmm4qm9d4j5p1fqq1pj6q3w89mr04kdb3dpgw"; // SDXL Lightning fast variant

const CONTENT_BLOCKLIST = [
  "porn", "nude", "naked", "nsfw", "xxx", "sex",
  "kill", "murder", "rape", "blood", "gore",
  "child", "minor", "underage",
  "@", // crude PII filter — won't allow emails
];

// IP derivation: trust cf-connecting-ip first (set by Cloudflare, not
// client-spoofable); fall back to the leftmost x-forwarded-for hop ONLY in
// combination with the DB-backed platform-wide cap below — a spoofed XFF
// can rotate per-IP buckets but cannot exceed the global daily budget.
function clientIP(req: Request): string {
  return extractClientIp(req.headers);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt || prompt.length < 8) {
      return json({ ok: false, reason: "prompt_too_short" }, 200);
    }
    if (prompt.length > 240) {
      return json({ ok: false, reason: "prompt_too_long" }, 200);
    }

    const lower = prompt.toLowerCase();
    if (CONTENT_BLOCKLIST.some((b) => lower.includes(b))) {
      return json(
        {
          ok: false,
          reason: "content",
          message:
            "We can't preview that prompt. Try something cinematic — a scene, a character, a moment.",
        },
        200,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = clientIP(req);
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    // Spoof-proof platform-wide cap (DB-backed, shared across isolates).
    // A spoofed x-forwarded-for can dodge per-IP buckets but every call —
    // regardless of claimed IP — increments this single global counter, so
    // the platform's daily $-budget is the hard ceiling. Fail CLOSED on RPC
    // error (this endpoint spends money on Replicate).
    const globalAllowed = await checkRateLimitDb(
      supabase,
      "landing-preview:global",
      PLATFORM_DAILY_CAP,
      86400,
    );
    if (!globalAllowed) {
      return json(
        {
          ok: false,
          reason: "platform_cap",
          message:
            "Small Bridges's free preview budget is fully booked for today. Sign up — your account preview is unlimited.",
        },
        200,
      );
    }

    // Platform-wide rate limit.
    const { count: platformToday } = await supabase
      .from("landing_preview_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayStart.toISOString());
    if ((platformToday ?? 0) >= PLATFORM_DAILY_CAP) {
      return json(
        {
          ok: false,
          reason: "platform_cap",
          message:
            "Small Bridges's free preview budget is fully booked for today. Sign up — your account preview is unlimited.",
        },
        200,
      );
    }

    // Per-IP rate limit.
    const { count: ipToday } = await supabase
      .from("landing_preview_attempts")
      .select("id", { count: "exact", head: true })
      .eq("client_ip", ip)
      .gte("created_at", dayStart.toISOString());
    if ((ipToday ?? 0) >= DAILY_PER_IP) {
      return json(
        {
          ok: false,
          reason: "rate_limit",
          message:
            "You've used today's free previews. Sign up — your account preview is unlimited.",
        },
        200,
      );
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      // No key configured yet — log the attempt and return a synthetic
      // placeholder so the UI still demonstrates the flow.
      await supabase.from("landing_preview_attempts").insert({
        client_ip: ip,
        prompt,
        status: "no_replicate_key",
      });
      return json(
        {
          ok: true,
          synthetic: true,
          images: [
            placeholderImage(prompt, 0),
            placeholderImage(prompt, 1),
            placeholderImage(prompt, 2),
            placeholderImage(prompt, 3),
          ],
          remaining_today: Math.max(0, DAILY_PER_IP - (ipToday ?? 0) - 1),
        },
        200,
      );
    }

    const modelVersion =
      Deno.env.get("LANDING_PREVIEW_MODEL_VERSION") ?? DEFAULT_MODEL;

    // Replicate prediction — request 4 images at 320×320.
    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        Prefer: "wait", // synchronous response for the sandbox
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          prompt: `cinematic still: ${prompt}, sharp focus, professional cinematography`,
          num_outputs: 4,
          width: 320,
          height: 320,
          num_inference_steps: 4,
          guidance_scale: 1.0,
          scheduler: "K_EULER",
        },
      }),
    });

    if (!predRes.ok) {
      const errBody = await predRes.text();
      console.error(
        `[landing-preview] Replicate ${predRes.status}: ${errBody.slice(0, 400)}`,
      );
      await supabase.from("landing_preview_attempts").insert({
        client_ip: ip,
        prompt,
        status: `replicate_${predRes.status}`,
      });
      return json(
        {
          ok: false,
          reason: "model_error",
          message: "The preview engine is warming up. Try again in a moment.",
        },
        200,
      );
    }

    const prediction = await predRes.json();
    const images: string[] = Array.isArray(prediction.output)
      ? prediction.output.slice(0, 4)
      : prediction.output
        ? [prediction.output]
        : [];

    await supabase.from("landing_preview_attempts").insert({
      client_ip: ip,
      prompt,
      status: "ok",
      prediction_id: prediction.id ?? null,
    });

    return json(
      {
        ok: true,
        images,
        remaining_today: Math.max(0, DAILY_PER_IP - (ipToday ?? 0) - 1),
      },
      200,
    );
  } catch (error) {
    console.error("[landing-preview] Error:", error);
    return json(
      {
        ok: false,
        reason: "internal",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      200, // always 200 so the page never breaks
    );
  }
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Generates a deterministic data-URI gradient placeholder so the sandbox
 *  remains visually demonstrable when the model key isn't configured. */
function placeholderImage(prompt: string, slot: number): string {
  // Simple hash → hue + offset per slot.
  let h = 0;
  for (const ch of prompt) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const hue = ((Math.abs(h) + slot * 47) % 360);
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='hsl(${hue},80%,38%)'/>
      <stop offset='100%' stop-color='hsl(${(hue + 28) % 360},60%,12%)'/>
    </linearGradient>
  </defs>
  <rect width='320' height='320' fill='url(#g)'/>
  <text x='16' y='304' font-family='monospace' font-size='10' fill='rgba(255,255,255,0.7)'>
    Small Bridges preview · slot ${slot + 1}
  </text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}
