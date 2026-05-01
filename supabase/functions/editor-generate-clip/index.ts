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

// ─── Continuity Chain ─────────────────────────────────────────────────────────
// We carry two things between consecutive Seedance clips:
//   1. The LAST FRAME of the previous clip (image → first frame of next clip)
//   2. A compact "identity DNA" string distilled from the previous prompt
// This eliminates character drift and stitches scenes seamlessly.

const CONTINUITY_LOCK_PREFIX =
  "CONTINUITY LOCK — exact same character, same wardrobe, same hair, same skin tone, same lighting style, same color grade, same lens, same environment as the reference frame. ";

// Replicate model that pulls a single frame from any video URL.
// Returns a PNG image URL we can hand straight back to Seedance as `image`.
const FRAME_EXTRACTOR_MODEL_URL =
  "https://api.replicate.com/v1/models/lucataco/ffmpeg-extract-frame/predictions";

/**
 * Extract the final frame of a generated clip via Replicate, then persist it
 * to our own storage so the URL is stable. Returns a public URL (or null).
 */
async function extractLastFrame(
  supabase: any,
  userId: string,
  predictionId: string,
  videoUrl: string,
  videoDurationSec: number,
  replicateToken: string,
): Promise<string | null> {
  try {
    // Sample at duration - 0.05s to land on the very last visible frame.
    const ts = Math.max(0, videoDurationSec - 0.05);
    const submitRes = await fetch(FRAME_EXTRACTOR_MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
        Prefer: "wait=30",
      },
      body: JSON.stringify({
        input: { video: videoUrl, timestamp: ts },
      }),
    });
    if (!submitRes.ok) {
      console.warn("[continuity] frame-extractor submit failed:", submitRes.status);
      return null;
    }
    let pred = await submitRes.json();

    // Poll up to ~25s if not ready.
    let attempts = 0;
    while (pred.status !== "succeeded" && pred.status !== "failed" && attempts < 8) {
      await new Promise((r) => setTimeout(r, 3000));
      const r = await fetch(`${REPLICATE_PREDICTIONS_URL}/${pred.id}`, {
        headers: { Authorization: `Bearer ${replicateToken}` },
      });
      if (!r.ok) break;
      pred = await r.json();
      attempts++;
    }

    if (pred.status !== "succeeded") {
      console.warn("[continuity] frame extractor did not succeed:", pred.status);
      return null;
    }
    const frameUrl: string | undefined = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!frameUrl) return null;

    // Persist frame to our bucket
    const imgRes = await fetch(frameUrl);
    if (!imgRes.ok) return frameUrl;
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    const path = `${userId}/editor/${predictionId}.last.png`;
    const { error: upErr } = await supabase.storage
      .from("video-clips")
      .upload(path, buf, {
        contentType: "image/png",
        upsert: true,
        cacheControl: "31536000",
      });
    if (upErr) {
      console.warn("[continuity] last-frame upload error:", upErr.message);
      return frameUrl; // still usable directly
    }
    const { data } = supabase.storage.from("video-clips").getPublicUrl(path);
    return data?.publicUrl ?? frameUrl;
  } catch (e) {
    console.warn("[continuity] extractLastFrame failed:", e);
    return null;
  }
}

/**
 * Distill a compact "identity DNA" from a prompt — the visual nouns/adjectives
 * worth carrying into the next clip so the subject stays consistent.
 * Pure regex/heuristics so we don't burn tokens on a tiny task.
 */
function distillIdentityDNA(prompt: string): string {
  if (!prompt) return "";
  // Strip the heavy quality suffix if present
  const clean = prompt.split(", shot on ARRI")[0].slice(0, 320);
  return `Subject reference: ${clean}.`;
}

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
      const {
        prompt,
        duration = 10,
        startImageUrl,
        aspectRatio = "16:9",
        // Continuity-chain inputs (optional)
        continuityFrameUrl,    // last frame of previous clip
        continuityDNA,         // distilled identity descriptor of previous clip
      } = body;

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

      // Engine-aware pricing — editor uses Seedance (1080p ~$0.45/sec real cost).
      // Charge Seedance tier (65/95cr), NOT Kling rates, otherwise we lose money.
      // Real cost: 5s≈$2.25, 10s≈$4.50.  Credits: 65 (=$6.50) or 95 (=$9.50).
      const creditsRequired = duration > 10 ? 95 : 65;
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

      // Resolve the start image with continuity priority:
      //   continuityFrameUrl  >  startImageUrl
      const resolvedStartImage = continuityFrameUrl || startImageUrl;

      // Build prompt with continuity lock when chaining from a previous clip.
      let finalPrompt = prompt;
      if (continuityFrameUrl) {
        const dna = continuityDNA ? ` ${continuityDNA}` : "";
        finalPrompt = `${CONTINUITY_LOCK_PREFIX}${dna} Next beat: ${prompt}`;
      }
      finalPrompt = finalPrompt + QUALITY_SUFFIX;

      const seedanceInput: Record<string, any> = {
        prompt: finalPrompt,
        duration: finalDuration,
        aspect_ratio: aspectRatio,
        resolution: "1080p",       // Seedance-1-Pro max native resolution
        fps: 24,                    // cinematic frame rate
        camera_fixed: false,
      };
      console.log("[editor-generate-clip] Seedance input:", JSON.stringify(seedanceInput));

      if (resolvedStartImage) {
        seedanceInput.image = resolvedStartImage;
      }

      // Submit to Replicate (Seedance-1-Pro)
      const replicateRes = await fetch(resolvedStartImage ? SEEDANCE_I2V_URL : SEEDANCE_T2V_URL, {
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
        // Refund on failure — use deduct_credits with NEGATIVE amount for proper ledger entry.
        // The legacy `increment_credits` RPC does not exist and silently failed before this fix
        // (users were not refunded). This restores the balance and creates an audit row.
        const { error: refundErr } = await supabase.rpc("deduct_credits", {
          p_user_id: auth.userId,
          p_amount: -creditsRequired,
          p_description: `Editor clip refund: Replicate error`,
        });
        if (refundErr) {
          console.error("[editor-generate-clip] Refund RPC failed:", refundErr);
          // Fallback: direct balance + ledger entry (service-role only)
          const { data: cp } = await supabase
            .from("profiles")
            .select("credits_balance")
            .eq("id", auth.userId)
            .maybeSingle();
          if (cp) {
            await supabase.from("profiles")
              .update({ credits_balance: cp.credits_balance + creditsRequired })
              .eq("id", auth.userId);
            await supabase.from("credit_transactions").insert({
              user_id: auth.userId,
              amount: creditsRequired,
              transaction_type: "refund",
              description: "Editor clip refund: Replicate error (fallback)",
            });
          }
        }
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
        // Real cost: Seedance-1-Pro 1080p ≈ $0.45/sec → 5s≈225¢, 10s≈450¢
        real_cost_cents: duration > 10 ? 540 : 450,
        duration_seconds: duration,
        status: "pending",
        metadata: { predictionId: prediction.id },
      });

      // Stash the prompt's identity DNA so /status can return it for chaining
      // without forcing the client to remember it.
      const dnaForChain = distillIdentityDNA(prompt);

      return new Response(JSON.stringify({
        success: true,
        predictionId: prediction.id,
        creditsCharged: creditsRequired,
        continuityDNA: dnaForChain,
        chainedFromImage: !!resolvedStartImage,
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
        let continuityFrameUrl: string | null = null;
        const dur = parseInt(String(clipDuration ?? 5), 10) || 5;

        try {
          const persisted = await persistVideoToStorage(supabase, auth.userId, predictionId, sourceUrl);
          if (persisted) finalUrl = persisted;

          // Best-effort continuity frame extraction (never blocks success path)
          continuityFrameUrl = await extractLastFrame(
            supabase,
            auth.userId,
            predictionId,
            finalUrl,
            dur,
            REPLICATE_API_TOKEN,
          );

          const libraryProjectId = await getOrCreateLibraryProject(supabase, auth.userId);
          if (libraryProjectId) {
            // Pick a unique shot_index (count existing clips in library project)
            const { count } = await supabase
              .from("video_clips")
              .select("id", { count: "exact", head: true })
              .eq("project_id", libraryProjectId);
            const nextIndex = (count ?? 0);

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
          continuityFrameUrl,
          continuityDNA: distillIdentityDNA(clipPrompt || ""),
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
