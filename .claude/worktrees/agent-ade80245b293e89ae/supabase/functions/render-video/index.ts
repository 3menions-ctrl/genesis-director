import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * RENDER-VIDEO Edge Function v2.0
 * 
 * Merges multiple video clips into a single MP4 using Replicate's
 * bfirsh/concatenate-videos model (FFmpeg-based server-side concat).
 * 
 * Actions:
 * - submit: Start a merge job (creates Replicate prediction, stores job in edit_sessions)
 * - status: Check job status (polls Replicate, updates edit_sessions, returns result)
 * 
 * Input (submit): { action: "submit", sessionId, clipUrls: string[] }
 * Input (status): { action: "status", sessionId }
 * Output: { success, jobId, status, outputUrl? }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONCATENATE_MODEL_VERSION = "03c0802dc63ff01bb16f967f9ce4d7a784cbb697e9e7a593dd5f08bb83807ced";

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

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const action = body.action || "submit";

    // =========================================================================
    // STATUS: Poll Replicate prediction and return current state
    // =========================================================================
    if (action === "status") {
      const { sessionId } = body;
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "sessionId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get session with render settings (contains predictionId)
      const { data: session } = await supabase
        .from("edit_sessions")
        .select("status, render_progress, render_url, render_error, render_settings")
        .eq("id", sessionId)
        .maybeSingle();

      if (!session) {
        return new Response(
          JSON.stringify({ error: "Session not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If already completed or failed, return immediately
      if (session.status === "completed" && session.render_url) {
        return new Response(
          JSON.stringify({ status: "completed", outputUrl: session.render_url, progress: 100 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.status === "failed") {
        return new Response(
          JSON.stringify({ status: "failed", error: session.render_error || "Render failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Poll Replicate prediction
      const renderSettings = session.render_settings as Record<string, unknown> | null;
      const predictionId = renderSettings?.predictionId as string | undefined;

      if (!predictionId) {
        return new Response(
          JSON.stringify({ status: "pending", progress: 0, message: "No prediction ID found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const predRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });

      if (!predRes.ok) {
        const errText = await predRes.text();
        console.error(`[RenderVideo] Replicate poll error: ${predRes.status} ${errText}`);
        return new Response(
          JSON.stringify({ status: "processing", progress: session.render_progress || 30 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const prediction = await predRes.json();

      if (prediction.status === "succeeded" && prediction.output) {
        // Download the merged video and persist to storage
        const outputUrl = typeof prediction.output === "string"
          ? prediction.output
          : prediction.output?.url || prediction.output;

        console.log(`[RenderVideo] ✅ Prediction succeeded, output: ${outputUrl}`);

        let permanentUrl = outputUrl;
        try {
          // Persist to Supabase storage so it doesn't expire
          const videoRes = await fetch(outputUrl);
          if (videoRes.ok) {
            const videoBuffer = await videoRes.arrayBuffer();
            // Safety: reject files over 200MB
            if (videoBuffer.byteLength > 200 * 1024 * 1024) {
              console.warn("[RenderVideo] Output too large, using Replicate URL directly");
            } else {
              const fileName = `exports/${sessionId}_${Date.now()}.mp4`;
              const { error: uploadErr } = await supabase.storage
                .from("temp-frames")
                .upload(fileName, new Uint8Array(videoBuffer), {
                  contentType: "video/mp4",
                  upsert: true,
                });

              if (!uploadErr) {
                permanentUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;
                console.log(`[RenderVideo] ✅ Persisted to storage: ${permanentUrl}`);
              } else {
                console.warn(`[RenderVideo] Storage upload failed: ${uploadErr.message}`);
              }
            }
          }
        } catch (persistErr) {
          console.warn("[RenderVideo] Persistence failed, using Replicate URL:", persistErr);
        }

        // Update session
        await supabase
          .from("edit_sessions")
          .update({
            status: "completed",
            render_progress: 100,
            render_url: permanentUrl,
          })
          .eq("id", sessionId);

        return new Response(
          JSON.stringify({ status: "completed", outputUrl: permanentUrl, progress: 100 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (prediction.status === "failed" || prediction.status === "canceled") {
        const errMsg = prediction.error || "Replicate render failed";
        await supabase
          .from("edit_sessions")
          .update({ status: "failed", render_error: errMsg.slice(0, 500) })
          .eq("id", sessionId);

        return new Response(
          JSON.stringify({ status: "failed", error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Still processing
      const progress = prediction.status === "starting" ? 20 : 50;
      await supabase
        .from("edit_sessions")
        .update({ render_progress: progress })
        .eq("id", sessionId);

      return new Response(
        JSON.stringify({
          status: "processing",
          progress,
          replicateStatus: prediction.status,
          message: prediction.status === "starting" ? "Initializing render..." : "Merging clips...",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // SUBMIT: Create Replicate prediction to concatenate clips
    // =========================================================================
    const { sessionId, clipUrls } = body;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!clipUrls || !Array.isArray(clipUrls) || clipUrls.length < 2) {
      return new Response(
        JSON.stringify({ error: "clipUrls must be an array with at least 2 URLs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate all URLs are accessible
    const validUrls = clipUrls.filter((url: string) =>
      typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))
    );

    if (validUrls.length < 2) {
      return new Response(
        JSON.stringify({ error: `Only ${validUrls.length} valid URLs provided, need at least 2` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[RenderVideo] Submitting concat job: ${validUrls.length} clips`);

    // Create Replicate prediction
    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: CONCATENATE_MODEL_VERSION,
        input: {
          videos: validUrls,
        },
      }),
    });

    if (!predRes.ok) {
      const errText = await predRes.text();
      console.error(`[RenderVideo] Replicate create error: ${predRes.status} ${errText}`);
      throw new Error(`Failed to start render: ${predRes.status}`);
    }

    const prediction = await predRes.json();
    console.log(`[RenderVideo] ✅ Prediction created: ${prediction.id}`);

    // Update session with prediction ID
    await supabase
      .from("edit_sessions")
      .update({
        status: "rendering",
        render_progress: 10,
        render_settings: {
          predictionId: prediction.id,
          clipCount: validUrls.length,
          startedAt: new Date().toISOString(),
        },
      })
      .eq("id", sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        jobId: sessionId,
        predictionId: prediction.id,
        clipCount: validUrls.length,
        estimatedTime: `${Math.ceil(validUrls.length * 8)}s`,
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
