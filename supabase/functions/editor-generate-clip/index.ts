import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { priceClipCredits } from "../_shared/engines.ts";

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
const WAN_MODEL_URL = "https://api.replicate.com/v1/models/wan-video/wan-2.5-t2v/predictions";
const KLING_MODEL_URL = "https://api.replicate.com/v1/models/kwaivgi/kling-v3-video/predictions";
const REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";

type EditorEngine = 'wan' | 'kling' | 'seedance';

interface QualityOptions {
  /** 60fps RIFE interpolation surcharge. */
  fps60?: boolean;
  /** 4K upscale surcharge. */
  upscale4k?: boolean;
}

// Editor clip pricing is SINGLE-SOURCED from ../_shared/engines.ts
// (priceClipCredits → registry, parity-locked to the frontend). The helper
// snaps duration to the engine's real set and adds the 4K/60fps surcharges.
function creditsForEditorClip(
  engine: EditorEngine,
  duration: number,
  opts: QualityOptions = {},
): number {
  return priceClipCredits(engine, duration, opts);
}

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
        // Idempotency + scope. Client should pass a stable key (e.g. uuid)
        // per logical submission; a retry of the same submission reuses the
        // existing prediction without a second credit charge.
        idempotencyKey,
        projectId,
        // Engine selection — defaults to seedance for back-compat with the
        // existing editor flow. 'wan' = free tier, 'kling' = standard, etc.
        videoEngine = "seedance",
        // Quality surcharges — fps60 (RIFE 60fps interpolation) and
        // upscale4k. Bills an extra 5 credits each when set. UI sends
        // these via the qualityOptions field when the user picks a
        // 60fps or 4K quality profile.
        qualityOptions = {},
      } = body;
      const engine: EditorEngine = (['wan', 'kling', 'seedance'].includes(videoEngine)
        ? videoEngine
        : 'seedance') as EditorEngine;
      const qOpts: QualityOptions = {
        fps60: !!qualityOptions?.fps60,
        upscale4k: !!qualityOptions?.upscale4k,
      };

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

      // Org-aware affordability pre-check. deduct_credits (below) routes org
      // projects to the ORG pool and personal projects to the member's personal
      // balance — so this gate must consult the SAME pool, or an org member with
      // a funded pool but no personal credits would be wrongly blocked here (and
      // vice-versa). Read the AUTHORITATIVE ledger state (balance − active holds)
      // via the credit-state RPCs rather than the profiles/organizations
      // display-cache columns, which can drift from the ledger. Both RPCs accept
      // service-role callers (auth.uid() is null here). The final authority is
      // still deduct_credits; this is the UX-facing 402 gate.
      let orgId: string | null = null;
      if (projectId) {
        const { data: proj } = await supabase
          .from("movie_projects")
          .select("user_id, organization_id")
          .eq("id", projectId)
          .maybeSingle();
        const projRow = proj as { user_id?: string; organization_id?: string | null } | null;
        orgId = projRow?.organization_id ?? null;
        // C1 defense-in-depth: reject generation billed to a project the caller
        // neither owns nor (for org projects) is a member of. deduct_credits now
        // also enforces org membership in-RPC, but fail fast with a clear 403.
        if (projRow) {
          const ownsProject = projRow.user_id === auth.userId;
          let isOrgMember = false;
          if (!ownsProject && orgId) {
            const { data: member } = await supabase
              .from("organization_members")
              .select("user_id")
              .eq("organization_id", orgId)
              .eq("user_id", auth.userId)
              .maybeSingle();
            isOrgMember = !!member;
          }
          if (!ownsProject && !isOrgMember) {
            return new Response(
              JSON.stringify({ error: "Forbidden: you do not have access to this project" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      }

      let availableCredits = 0;
      if (orgId) {
        const { data: state } = await supabase.rpc("get_org_credit_state", { p_org_id: orgId });
        availableCredits = Number((state as { available?: number } | null)?.available ?? 0);
      } else {
        const { data: state } = await supabase.rpc("get_credit_state", { p_user_id: auth.userId });
        availableCredits = Number((state as { available?: number } | null)?.available ?? 0);
      }

      // Engine-aware pricing.
      //   wan      → 0 credits (free tier)
      //   kling    → 50/75 (Kling V3 standard)
      //   seedance → 65/95 (default, Seedance 1 Pro real cost ~$0.45/sec)
      const creditsRequired = creditsForEditorClip(engine, duration, qOpts);
      if (creditsRequired > 0 && availableCredits < creditsRequired) {
        return new Response(JSON.stringify({
          error: "Insufficient credits",
          required: creditsRequired,
          available: availableCredits,
        }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduct credits — STRICTLY assert success before proceeding.
      // Pass an idempotency key + project scope so a client retry
      // (re-submit on transient network error) does NOT double-charge.
      // The RPC short-circuits when an identical (project_id, idempotency_key)
      // row exists and returns TRUE without inserting a second ledger row.
      // Wan (free tier) skips deduction entirely.
      const idemKey = idempotencyKey
        ? `editor-clip:${String(idempotencyKey)}`
        : `editor-clip:auto:${auth.userId}:${duration}:${Date.now() >> 16}`;
      if (creditsRequired > 0) {
        const { data: deductOk, error: deductErr } = await supabase.rpc("deduct_credits", {
          p_user_id: auth.userId,
          p_amount: creditsRequired,
          p_description: `Editor clip generation (${engine}, ${duration}s)`,
          p_project_id: projectId || null,
          p_clip_duration: duration > 10 ? 10 : 5,
          p_idempotency_key: idemKey,
        });
        if (deductErr || deductOk !== true) {
          console.error("[editor-generate-clip] Credit deduction failed:", deductErr, "ok=", deductOk);
          return new Response(JSON.stringify({
            error: deductErr ? "Failed to deduct credits" : "Insufficient credits",
            required: creditsRequired,
            available: availableCredits,
          }), {
            status: deductErr ? 500 : 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

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

      // Build engine-specific input payload + pick the model endpoint.
      let modelUrl: string;
      let modelInput: Record<string, any>;
      let serviceLabel: string;
      if (engine === 'wan') {
        modelUrl = WAN_MODEL_URL;
        // Wan 2.5 only supports 5s / 10s
        modelInput = {
          prompt: finalPrompt,
          duration: finalDuration,
          aspect_ratio: aspectRatio,
          resolution: "1080p",
        };
        if (resolvedStartImage) modelInput.image = resolvedStartImage;
        serviceLabel = "wan-2.5-t2v";
      } else if (engine === 'kling') {
        modelUrl = KLING_MODEL_URL;
        modelInput = {
          prompt: finalPrompt,
          duration: finalDuration,
          aspect_ratio: aspectRatio,
        };
        if (resolvedStartImage) modelInput.start_image = resolvedStartImage;
        serviceLabel = "kling-v3-video";
      } else {
        // seedance default
        modelUrl = resolvedStartImage ? SEEDANCE_I2V_URL : SEEDANCE_T2V_URL;
        modelInput = {
          prompt: finalPrompt,
          duration: finalDuration,
          aspect_ratio: aspectRatio,
          resolution: "1080p",
          fps: 24,
          camera_fixed: false,
        };
        if (resolvedStartImage) modelInput.image = resolvedStartImage;
        serviceLabel = "seedance-1-pro";
      }
      console.log(`[editor-generate-clip] ${serviceLabel} input:`, JSON.stringify(modelInput));

      const replicateRes = await fetch(modelUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait=5",
        },
        body: JSON.stringify({ input: modelInput }),
      });

      if (!replicateRes.ok) {
        const errText = await replicateRes.text();
        console.error("[editor-generate-clip] Replicate error:", errText);
        // Refund on failure. Reuse the same idempotency key so this refund
        // pairs 1:1 with the deduct above — replays are no-ops. Skip the
        // refund entirely for the free Wan tier (nothing was deducted).
        if (creditsRequired > 0) {
          const { error: refundErr } = await supabase.rpc("refund_credits", {
            p_user_id: auth.userId,
            p_amount: creditsRequired,
            p_description: `Editor clip refund: Replicate error`,
            p_project_id: projectId || null,
            p_idempotency_key: idemKey,
          });
          if (refundErr) {
            console.error("[editor-generate-clip] Refund RPC failed:", refundErr);
          }
        }
        return new Response(JSON.stringify({ error: "Failed to start generation" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prediction = await replicateRes.json();

      // Log cost. Real-cost estimate varies by engine (only Seedance is fully
      // calibrated; Wan/Kling are approximated and refined post-mortem).
      const realCostCents =
        engine === 'wan'      ? (duration > 10 ? 60  : 30)   // Wan ≈ $0.03/sec
        : engine === 'kling'  ? (duration > 10 ? 300 : 150)  // Kling ≈ $0.15/sec
        :                       (duration > 10 ? 540 : 450); // Seedance baseline
      await supabase.from("api_cost_logs").insert({
        user_id: auth.userId,
        service: serviceLabel,
        operation: "editor-generate-clip",
        credits_charged: creditsRequired,
        real_cost_cents: realCostCents,
        duration_seconds: duration,
        status: "pending",
        // Stash the credit deduct's idempotency key + project so check-video-status
        // can refund 1:1 if this prediction fails asynchronously (M1). Only editor
        // clips write this row, so the async-refund path can't touch hold-based
        // pipelines.
        metadata: {
          predictionId: prediction.id,
          engine,
          creditIdemKey: creditsRequired > 0 ? idemKey : null,
          creditProjectId: projectId || null,
        },
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
        // AUDIT FIX (charge-without-refund): credits were deducted at submit.
        // When the prediction fails/cancels asynchronously, refund them 1:1.
        // The submit path stashed the charge in api_cost_logs keyed by
        // predictionId; refund off that and flip the row to 'refunded' so
        // repeated status polls cannot multi-refund. (Editor clips don't reach
        // the hold-based M1 refund path, so this is the only refund site.)
        try {
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          );
          const { data: costLog } = await supabase
            .from("api_cost_logs")
            .select("id, credits_charged, status, metadata")
            .eq("user_id", auth.userId)
            .eq("metadata->>predictionId", predictionId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const charged = Number(costLog?.credits_charged || 0);
          if (costLog && charged > 0 && costLog.status !== "refunded") {
            const meta = (costLog.metadata || {}) as Record<string, unknown>;
            await supabase.rpc("refund_credits", {
              p_user_id: auth.userId,
              p_amount: charged,
              p_description: "Editor clip generation failed",
              p_project_id: (meta.creditProjectId as string) ?? null,
              p_idempotency_key: `editor-refund:${predictionId}`,
            });
            await supabase.from("api_cost_logs").update({ status: "refunded" }).eq("id", costLog.id);
          }
        } catch (refundErr) {
          console.error("[editor-generate-clip] async refund failed:", refundErr);
        }

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
