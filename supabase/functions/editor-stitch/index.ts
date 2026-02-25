import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * EDITOR-STITCH Edge Function v1.0
 * 
 * Server-side video stitching with crossfade transitions for Apex Studio.
 * Uses Replicate's FFmpeg model to merge clips with xfade/acrossfade filters.
 * 
 * Actions:
 * - submit: Start a crossfade stitch job
 * - status: Poll job status
 * 
 * Input (submit): { action: "submit", sessionId, clips: [{ url, duration }], crossfadeDuration?: number }
 * Input (status): { action: "status", sessionId }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Replicate FFmpeg model that accepts custom commands
const FFMPEG_MODEL_VERSION = "efd0b79b577bcd58ae7d035bce9de5c4659a59e09faafac4d426d61c04249251";

interface ClipInput {
  url: string;
  duration: number; // seconds
}

interface StitchRequest {
  action: "submit" | "status";
  sessionId: string;
  clips?: ClipInput[];
  crossfadeDuration?: number; // seconds, default 0.5
  transition?: string; // xfade transition type, default "fade"
}

/**
 * Build FFmpeg xfade + acrossfade filter graph for N clips.
 * 
 * For N clips with crossfade duration D:
 * - Video: chain xfade filters with calculated offsets
 * - Audio: chain acrossfade filters in parallel
 * 
 * Offsets: offset_i = sum(durations[0..i]) - (i * D)
 */
function buildXfadeFilterGraph(
  clips: ClipInput[],
  crossfadeDuration: number,
  transition: string
): { filterComplex: string; mapArgs: string[] } {
  if (clips.length === 1) {
    return { filterComplex: "", mapArgs: ["-map", "0:v", "-map", "0:a"] };
  }

  const n = clips.length;
  let videoFilters = "";
  let audioFilters = "";
  let lastVideoLabel = "0:v";
  let lastAudioLabel = "0:a";

  // Calculate cumulative start times accounting for overlaps
  let cumulativeTime = 0;

  for (let i = 1; i < n; i++) {
    const offset = cumulativeTime + clips[i - 1].duration - crossfadeDuration;
    const videoOutLabel = i < n - 1 ? `[v${i}]` : "[vout]";
    const audioOutLabel = i < n - 1 ? `[a${i}]` : "[aout]";

    // Video xfade
    videoFilters += `${lastVideoLabel}[${i}:v]xfade=transition=${transition}:duration=${crossfadeDuration}:offset=${offset.toFixed(3)}${videoOutLabel}`;
    if (i < n - 1) videoFilters += "; ";

    // Audio acrossfade
    audioFilters += `${lastAudioLabel}[${i}:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri${audioOutLabel}`;
    if (i < n - 1) audioFilters += "; ";

    lastVideoLabel = videoOutLabel;
    lastAudioLabel = audioOutLabel;
    cumulativeTime = offset;
  }

  const filterComplex = `${videoFilters}; ${audioFilters}`;
  return {
    filterComplex,
    mapArgs: ["-map", "[vout]", "-map", "[aout]"],
  };
}

/**
 * Build the full FFmpeg command string for the Replicate model.
 * The model accepts: file1..file4 as inputs, command as the ffmpeg command.
 */
function buildFfmpegCommand(
  clips: ClipInput[],
  crossfadeDuration: number,
  transition: string
): string {
  // Build input args
  const inputArgs = clips.map((_, i) => `-i file${i + 1}`).join(" ");

  if (clips.length === 1) {
    // Single clip — just copy
    return `ffmpeg ${inputArgs} -c copy output1`;
  }

  // Zero crossfade = seamless concat (no xfade filter needed, use concat filter)
  if (crossfadeDuration <= 0) {
    const n = clips.length;
    const concatInputs = clips.map((_, i) => `[${i}:v][${i}:a]`).join("");
    const concatFilter = `${concatInputs}concat=n=${n}:v=1:a=1[vout][aout]`;
    return `ffmpeg ${inputArgs} -filter_complex "${concatFilter}" -map "[vout]" -map "[aout]" -c:v libx264 -preset fast -crf 20 -c:a aac -b:a 192k -movflags +faststart output1`;
  }

  // Crossfade > 0: use xfade filters
  const { filterComplex, mapArgs } = buildXfadeFilterGraph(clips, crossfadeDuration, transition);

  if (!filterComplex) {
    return `ffmpeg ${inputArgs} -c copy output1`;
  }

  // Full command with filter_complex
  return `ffmpeg ${inputArgs} -filter_complex "${filterComplex}" ${mapArgs.join(" ")} -c:v libx264 -preset fast -crf 20 -c:a aac -b:a 192k -movflags +faststart output1`;
}

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

    const body = await req.json() as StitchRequest;
    const { action = "submit", sessionId } = body;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // STATUS: Poll Replicate prediction
    // =========================================================================
    if (action === "status") {
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

      if (session.status === "completed" && session.render_url) {
        return new Response(
          JSON.stringify({ status: "completed", outputUrl: session.render_url, progress: 100 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.status === "failed") {
        return new Response(
          JSON.stringify({ status: "failed", error: session.render_error || "Stitch failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Poll Replicate
      const renderSettings = session.render_settings as Record<string, unknown> | null;
      const predictionId = renderSettings?.predictionId as string | undefined;

      if (!predictionId) {
        return new Response(
          JSON.stringify({ status: "pending", progress: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const predRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      });

      if (!predRes.ok) {
        return new Response(
          JSON.stringify({ status: "processing", progress: session.render_progress || 30 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const prediction = await predRes.json();

      if (prediction.status === "succeeded") {
        // Output is an array of file URLs
        const outputFiles = prediction.output?.files || prediction.output;
        const outputUrl = Array.isArray(outputFiles) ? outputFiles[0] : outputFiles;

        if (!outputUrl) {
          await supabase.from("edit_sessions").update({
            status: "failed",
            render_error: "No output file from FFmpeg",
          }).eq("id", sessionId);

          return new Response(
            JSON.stringify({ status: "failed", error: "No output file" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Persist to storage
        let permanentUrl = outputUrl;
        try {
          const videoRes = await fetch(outputUrl);
          if (videoRes.ok) {
            const buffer = await videoRes.arrayBuffer();
            if (buffer.byteLength < 200 * 1024 * 1024) {
              const fileName = `exports/stitch_${sessionId}_${Date.now()}.mp4`;
              const { error: uploadErr } = await supabase.storage
                .from("temp-frames")
                .upload(fileName, new Uint8Array(buffer), {
                  contentType: "video/mp4",
                  upsert: true,
                });
              if (!uploadErr) {
                permanentUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;
                console.log(`[EditorStitch] ✅ Persisted: ${permanentUrl}`);
              }
            }
          }
        } catch (e) {
          console.warn("[EditorStitch] Persistence failed:", e);
        }

        await supabase.from("edit_sessions").update({
          status: "completed",
          render_progress: 100,
          render_url: permanentUrl,
        }).eq("id", sessionId);

        return new Response(
          JSON.stringify({ status: "completed", outputUrl: permanentUrl, progress: 100 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (prediction.status === "failed" || prediction.status === "canceled") {
        const errMsg = (prediction.error || "FFmpeg stitch failed").slice(0, 500);
        await supabase.from("edit_sessions").update({
          status: "failed",
          render_error: errMsg,
        }).eq("id", sessionId);

        return new Response(
          JSON.stringify({ status: "failed", error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Still processing
      const progress = prediction.status === "starting" ? 15 : 50;
      return new Response(
        JSON.stringify({ status: "processing", progress, replicateStatus: prediction.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // SUBMIT: Create crossfade stitch job
    // =========================================================================
    const { clips, crossfadeDuration = 0.5, transition = "fade" } = body;

    if (!clips || !Array.isArray(clips) || clips.length < 2) {
      return new Response(
        JSON.stringify({ error: "At least 2 clips required for stitching" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate clips
    const validClips = clips.filter(c => c.url && c.duration > 0);
    if (validClips.length < 2) {
      return new Response(
        JSON.stringify({ error: "At least 2 valid clips with duration required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // cog-ffmpeg supports max 4 files — for larger sets, we chain in batches
    // For v1, limit to 4 clips (most editor exports are 3-6 clips)
    if (validClips.length > 4) {
      // Fallback: use simple concatenation for >4 clips
      console.log(`[EditorStitch] ${validClips.length} clips exceeds xfade limit (4), falling back to concat`);
      
      // Use bfirsh/concatenate-videos for simple concat
      const predRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "03c0802dc63ff01bb16f967f9ce4d7a784cbb697e9e7a593dd5f08bb83807ced",
          input: { videos: validClips.map(c => c.url) },
        }),
      });

      if (!predRes.ok) {
        throw new Error(`Replicate concat failed: ${predRes.status}`);
      }

      const prediction = await predRes.json();

      await supabase.from("edit_sessions").update({
        status: "rendering",
        render_progress: 10,
        render_settings: {
          predictionId: prediction.id,
          mode: "concat_fallback",
          clipCount: validClips.length,
          startedAt: new Date().toISOString(),
        },
      }).eq("id", sessionId);

      return new Response(
        JSON.stringify({
          success: true,
          jobId: sessionId,
          predictionId: prediction.id,
          mode: "concat_fallback",
          clipCount: validClips.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build FFmpeg command with xfade
    const command = buildFfmpegCommand(validClips, crossfadeDuration, transition);
    console.log(`[EditorStitch] FFmpeg command: ${command}`);

    // Prepare input for cog-ffmpeg model
    const replicateInput: Record<string, string> = {
      command,
      output1: `stitch_${sessionId}.mp4`,
    };

    // Map clip URLs to file1..file4
    validClips.forEach((clip, i) => {
      replicateInput[`file${i + 1}`] = clip.url;
    });

    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: FFMPEG_MODEL_VERSION,
        input: replicateInput,
      }),
    });

    if (!predRes.ok) {
      const errText = await predRes.text();
      console.error(`[EditorStitch] Replicate error: ${predRes.status} ${errText}`);
      throw new Error(`Failed to start stitch: ${predRes.status}`);
    }

    const prediction = await predRes.json();
    console.log(`[EditorStitch] ✅ Prediction created: ${prediction.id}`);

    await supabase.from("edit_sessions").update({
      status: "rendering",
      render_progress: 10,
      render_settings: {
        predictionId: prediction.id,
        mode: "xfade_stitch",
        clipCount: validClips.length,
        crossfadeDuration,
        transition,
        startedAt: new Date().toISOString(),
      },
    }).eq("id", sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        jobId: sessionId,
        predictionId: prediction.id,
        mode: "xfade_stitch",
        clipCount: validClips.length,
        crossfadeDuration,
        transition,
        estimatedTime: `${Math.ceil(validClips.length * 12)}s`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[EditorStitch] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
