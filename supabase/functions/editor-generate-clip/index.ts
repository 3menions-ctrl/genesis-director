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

const QUALITY_SUFFIX = ", shot on ARRI Alexa 65, anamorphic lens, shallow depth of field, cinematic color grading, volumetric lighting, ultra-detailed textures, 8K master, photorealistic, film grain, HDR, masterful composition, razor-sharp focus, professional cinematography, award-winning";

const EDITOR_LIBRARY_TITLE = "Editor Library";

/**
 * Get or create the per-user "Editor Library" pseudo-project that holds all
 * standalone Seedance clips generated from the editor. This makes the clips
 * appear automatically in the existing MediaSidebar / useEditorClips flow.
 */
async function getOrCreateLibraryProject(supabase: any, userId: string): Promise<string | null> {
  // Try to find an existing library project
  const { data: existing } = await supabase
    .from("movie_projects")
    .select("id")
    .eq("user_id", userId)
    .eq("title", EDITOR_LIBRARY_TITLE)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  // Create one. Includes all NOT NULL columns with safe defaults.
  const { data: created, error } = await supabase
    .from("movie_projects")
    .insert({
      user_id: userId,
      title: EDITOR_LIBRARY_TITLE,
      genre: "library",
      story_structure: "freeform",
      target_duration_minutes: 1,
      status: "complete",
      include_narration: false,
      is_public: false,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[editor-generate-clip] Could not create library project:", error.message);
    return null;
  }
  return created?.id ?? null;
}

/**
 * Download the Replicate CDN file and re-upload to our own storage bucket so
 * the URL persists (Replicate URLs expire ~24h).
 */
async function persistVideoToStorage(
  supabase: any,
  userId: string,
  predictionId: string,
  sourceUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.error("[editor-generate-clip] Failed to fetch source video:", res.status);
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const path = `${userId}/editor/${predictionId}.mp4`;
    const { error: upErr } = await supabase.storage
      .from("video-clips")
      .upload(path, buf, {
        contentType: "video/mp4",
        upsert: true,
        cacheControl: "31536000",
      });
    if (upErr) {
      console.error("[editor-generate-clip] Upload error:", upErr.message);
      return null;
    }
    const { data } = supabase.storage.from("video-clips").getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.error("[editor-generate-clip] persistVideoToStorage failed:", e);
    return null;
  }
}

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

      // Build Seedance input — MAX QUALITY profile
      // duration MUST be integer 5 or 10 for Seedance-1-Pro
      const durNum = parseInt(String(duration), 10) || 5;
      const finalDuration: number = durNum >= 10 ? 10 : 5;
      const seedanceInput: Record<string, any> = {
        prompt: prompt + QUALITY_SUFFIX,
        duration: finalDuration,
        aspect_ratio: aspectRatio,
        resolution: "1080p",       // Seedance-1-Pro max native resolution
        fps: 24,                    // cinematic frame rate
        camera_fixed: false,
      };
      console.log("[editor-generate-clip] Seedance input:", JSON.stringify(seedanceInput));

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
      const { predictionId, prompt: clipPrompt, duration: clipDuration } = body;
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
        const sourceUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

        // Persist to our storage so URL survives + add to user's Library
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        let finalUrl: string = sourceUrl;
        let savedClipId: string | null = null;

        try {
          const persisted = await persistVideoToStorage(supabase, auth.userId, predictionId, sourceUrl);
          if (persisted) finalUrl = persisted;

          const libraryProjectId = await getOrCreateLibraryProject(supabase, auth.userId);
          if (libraryProjectId) {
            // Pick a unique shot_index (count existing clips in library project)
            const { count } = await supabase
              .from("video_clips")
              .select("id", { count: "exact", head: true })
              .eq("project_id", libraryProjectId);
            const nextIndex = (count ?? 0);

            const dur = parseInt(String(clipDuration ?? 5), 10) || 5;
            const { data: inserted, error: insErr } = await supabase
              .from("video_clips")
              .insert({
                project_id: libraryProjectId,
                user_id: auth.userId,
                shot_index: nextIndex,
                prompt: clipPrompt || `Editor clip ${predictionId.slice(0, 8)}`,
                status: "completed",
                video_url: finalUrl,
                duration_seconds: dur,
                completed_at: new Date().toISOString(),
              })
              .select("id")
              .single();
            if (insErr) {
              console.error("[editor-generate-clip] DB insert error:", insErr.message);
            } else {
              savedClipId = inserted?.id ?? null;
            }
          }
        } catch (persistErr) {
          console.error("[editor-generate-clip] Persistence error:", persistErr);
        }

        return new Response(JSON.stringify({
          status: "completed",
          videoUrl: finalUrl,
          clipId: savedClipId,
          savedToLibrary: !!savedClipId,
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
