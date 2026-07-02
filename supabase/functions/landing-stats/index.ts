import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { publicErrorMessage } from "../_shared/safe-error.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// @public-endpoint
// Public, cache-friendly aggregate stats for the landing "live ribbon".
// Returns only counts and a sanitized/blocklisted prompt snippet; no
// per-user data. JWT off so logged-out visitors can load it.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * landing-stats — public, unauthenticated, cache-friendly stats for the
 * landing-page "live ribbon".
 *
 * Returns:
 *   {
 *     rendered_today:    number   — completed movie_projects in last 24h
 *     queue_depth:       number   — current generating/stitching projects
 *     last_prompt:       string   — sanitized prompt of the most recently
 *                                   completed project (max 120 chars,
 *                                   passes content-safety filter)
 *     last_completed_ms: number   — ms since the last completion
 *     render_median_sec: number   — rough median render time
 *   }
 *
 * Cached for 5 seconds via response header. Honors a 5-req/sec/IP cap by
 * leaning on Supabase's PostgREST rate limiter — we don't enforce here.
 */

const PROMPT_BLOCKLIST = [
  // hard content-safety: never echo these substrings on a public surface
  "porn", "nude", "naked", "nsfw", "xxx", "sex",
  "kill", "murder", "rape", "assault",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [renderedRes, queueRes, lastRes] = await Promise.all([
      supabase
        .from("movie_projects")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("updated_at", since24h),
      supabase
        .from("movie_projects")
        .select("id", { count: "exact", head: true })
        .in("status", ["generating", "stitching", "rendering"]),
      supabase
        // PRIVACY: only surface prompts/titles from projects the owner has
        // explicitly made public. Previously this broadcast ANY user's raw
        // last_user_prompt/title on the public homepage (PII leak) guarded by
        // only a tiny profanity blocklist.
        .from("movie_projects")
        .select("title, last_user_prompt, prompt, updated_at, created_at")
        .eq("status", "completed")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(8),
    ]);

    let lastPrompt: string | null = null;
    let lastCompletedMs: number | null = null;
    for (const row of (lastRes.data ?? []) as Array<{
      title?: string | null;
      last_user_prompt?: string | null;
      prompt?: string | null;
      updated_at: string;
    }>) {
      const candidate =
        row.last_user_prompt?.trim() ||
        row.prompt?.trim() ||
        row.title?.trim() ||
        null;
      if (!candidate) continue;
      const lower = candidate.toLowerCase();
      if (PROMPT_BLOCKLIST.some((b) => lower.includes(b))) continue;
      lastPrompt = candidate.slice(0, 120);
      lastCompletedMs = Date.now() - new Date(row.updated_at).getTime();
      break;
    }

    // Rough median render time — sampled over the most recent 200 completions.
    let renderMedian: number | null = null;
    try {
      const { data: sample } = await supabase
        .from("movie_projects")
        .select("created_at, updated_at")
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(200);
      const durations = (sample ?? [])
        .map((p: { created_at: string; updated_at: string }) =>
          (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) /
          1000,
        )
        .filter((s: number) => s > 5 && s < 600)
        .sort((a: number, b: number) => a - b);
      if (durations.length > 0) {
        renderMedian = Math.round(durations[Math.floor(durations.length / 2)]);
      }
    } catch {
      // sampling is best-effort
    }

    const payload = {
      rendered_today: renderedRes.count ?? 0,
      queue_depth: queueRes.count ?? 0,
      last_prompt: lastPrompt,
      last_completed_ms: lastCompletedMs,
      render_median_sec: renderMedian,
      generated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=5, s-maxage=5",
      },
    });
  } catch (error) {
    console.error("[landing-stats] Error:", error);
    return new Response(
      JSON.stringify({
        rendered_today: 0,
        queue_depth: 0,
        last_prompt: null,
        error: publicErrorMessage(error),
      }),
      {
        status: 200, // never fail the ribbon — degrade gracefully
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
