import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * RENDER-VIDEO Edge Function
 * 
 * Proxies video editing render jobs to an external MoviePy server.
 * 
 * Actions:
 * - submit: Send a new render job
 * - status: Check job status
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RenderRequest {
  action?: "submit" | "status";
  sessionId?: string;
  jobId?: string;
  timeline?: {
    tracks: unknown[];
    duration: number;
  };
  settings?: {
    resolution: string;
    fps: number;
    format: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    const body = await req.json() as RenderRequest;
    const action = body.action || "submit";

    if (action === "status") {
      // Check render job status
      const renderServerUrl = Deno.env.get("RENDER_SERVER_URL");
      
      if (!renderServerUrl) {
        // No render server configured — return mock pending status
        return new Response(
          JSON.stringify({
            status: "pending",
            message: "Render server not configured. Set RENDER_SERVER_URL secret to enable external rendering.",
            progress: 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const statusRes = await fetch(`${renderServerUrl}/status/${body.jobId}`, {
        headers: { "Content-Type": "application/json" },
      });

      const statusData = await statusRes.json();
      return new Response(
        JSON.stringify(statusData),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Submit render job
    if (!body.timeline || !body.sessionId) {
      return new Response(
        JSON.stringify({ error: "timeline and sessionId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const renderServerUrl = Deno.env.get("RENDER_SERVER_URL");

    if (!renderServerUrl) {
      // No render server — save timeline and return instructions
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      await adminClient
        .from("edit_sessions")
        .update({
          status: "draft",
          timeline_data: body.timeline,
          render_settings: body.settings,
        })
        .eq("id", body.sessionId);

      return new Response(
        JSON.stringify({
          success: true,
          jobId: body.sessionId,
          message: "Timeline saved. To enable server rendering, configure RENDER_SERVER_URL. For now, use browser-based export with FFmpeg.wasm.",
          fallback: "ffmpeg_wasm",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Forward to MoviePy render server
    console.log(`[RenderVideo] Submitting render job to ${renderServerUrl}`);

    const renderRes = await fetch(`${renderServerUrl}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: body.sessionId,
        userId,
        timeline: body.timeline,
        settings: body.settings,
        callbackUrl: `${supabaseUrl}/functions/v1/render-video`,
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      throw new Error(`Render server error: ${renderRes.status} ${errText}`);
    }

    const renderData = await renderRes.json();

    // Update session status
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    await adminClient
      .from("edit_sessions")
      .update({
        status: "rendering",
        render_progress: 0,
      })
      .eq("id", body.sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        jobId: renderData.jobId || body.sessionId,
        estimatedTime: renderData.estimatedTime || "2-5 minutes",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[RenderVideo] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
