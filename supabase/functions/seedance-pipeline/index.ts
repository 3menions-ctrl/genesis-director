/**
 * SEEDANCE PIPELINE — DEDICATED, SEEDANCE-ONLY ORCHESTRATOR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Mirror of hollywood-pipeline, but tuned end-to-end for Seedance 2.0:
 *   • Hard guard: rejects any non-seedance engine (HTTP 400)
 *   • DB engine lock: persisted movie_projects.video_engine overrides body
 *   • Seedance-native dispatch:
 *       - `image` (single reference, not Kling's start_image)
 *       - `last_frame_image` (Seedance's unique end-frame interpolation)
 *       - up to 12s/clip (Kling caps at 10–15s; Seedance is 2–12)
 *       - 1080p native, 24fps, configurable camera_fixed
 *   • No native audio: voice/music/SFX are generated separately and
 *     muxed in the stitch stage. (Kling has native lip-sync; Seedance
 *     does not — this is a fundamental capability difference.)
 *   • Reuses shared sub-functions: generate-script, generate-scene-images,
 *     generate-voice, generate-music, simple-stitch.
 *   • Async by design: dispatches all clips, returns predictionIds,
 *     watchdog completes the run (avoids 60s edge timeout).
 *
 * THE SEEDANCE CONTRACT (locked in memory):
 *   Whenever a user picks Seedance 2.0 anywhere in the app, the request
 *   routes HERE. No fallback to generate-video / generate-single-clip.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateAuth, unauthorizedResponse } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Seedance 2.0 (Replicate) ──────────────────────────────────────────────
const SEEDANCE_MODEL_URL =
  "https://api.replicate.com/v1/models/bytedance/seedance-2.0/predictions";

// Seedance 2.0 pricing — must mirror src/lib/video/engines.ts baseCreditsFor:
//   tableCost({ 5: 35, 10: 65, 12: 95 }, d)
const SEEDANCE_CREDIT_TABLE: Record<number, number> = { 5: 35, 10: 65, 12: 95 };
function seedanceCreditsForClip(durationSeconds: number): number {
  const exact = SEEDANCE_CREDIT_TABLE[durationSeconds];
  if (exact) return exact;
  // Linear interp fallback (clamped 2–12)
  const d = Math.max(2, Math.min(12, durationSeconds));
  return Math.round(35 + ((d - 5) * (95 - 35)) / (12 - 5));
}

interface SeedancePipelineRequest {
  userId?: string;
  projectId?: string;
  concept?: string;
  manualPrompts?: string[];
  approvedScript?: { shots: Array<Record<string, any>> };
  videoEngine?: string; // must be 'seedance' or absent
  clipCount?: number;
  clipDuration?: number; // 2–12s
  aspectRatio?: '16:9' | '9:16' | '1:1';
  includeVoice?: boolean;
  includeMusic?: boolean;
  cameraFixed?: boolean; // Seedance native param
  genre?: string;
  mood?: string;
  skipApproval?: boolean;
  skipCreditDeduction?: boolean;
  resumeFrom?: string;
  isAvatarMode?: boolean;
}

interface SeedanceClipInput {
  prompt: string;
  imageUrl?: string | null;
  lastFrameImageUrl?: string | null;
  durationSeconds: number;
  aspectRatio: '16:9' | '9:16' | '1:1';
  cameraFixed: boolean;
}

/**
 * Seedance-tuned prompt rewriter. Seedance 2.0 responds best to:
 *   • Concrete subject + action verbs (no abstract emotion words)
 *   • Explicit camera motion ("slow dolly in", "static lock-off") since
 *     camera_fixed param only forces stillness, it doesn't choreograph moves
 *   • Motion descriptors at the END of the prompt
 *   • No audio/dialogue cues (Seedance has no native audio — those are muxed)
 * Strips dialogue lines and lip-sync hints, appends motion intent.
 */
function seedanceTunePrompt(raw: string, cameraFixed: boolean): string {
  let p = (raw ?? "").toString();
  // Strip dialogue lines (Seedance has no native audio)
  p = p.replace(/"[^"]{0,200}"/g, "").replace(/'[^']{0,200}'/g, "");
  // Strip lip-sync / audio cues
  p = p.replace(/\b(lip[- ]?sync|voiceover|narration|says?|speaks?|whispers?|shouts?)\b[^.,;]*/gi, "");
  // Collapse whitespace
  p = p.replace(/\s+/g, " ").trim();
  // Append motion intent
  const motionTag = cameraFixed
    ? "static camera lock-off, subject motion only"
    : "smooth cinematic camera motion, natural parallax";
  return `${p}. ${motionTag}, 24fps, photoreal, sharp focus`.slice(0, 2400);
}

/**
 * Dispatch a single Seedance prediction. Returns the prediction ID immediately.
 * Polling is delegated to poll-replicate-prediction / watchdog.
 */
async function dispatchSeedanceClip(
  input: SeedanceClipInput,
): Promise<{ predictionId: string }> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY is not configured");

  const duration = Math.max(2, Math.min(12, input.durationSeconds));
  const body: Record<string, any> = {
    prompt: seedanceTunePrompt(input.prompt, input.cameraFixed),
    duration,
    resolution: "1080p",
    aspect_ratio: input.aspectRatio,
    fps: 24,
    camera_fixed: input.cameraFixed,
    seed: Math.floor(Math.random() * 2147483647),
  };

  if (input.imageUrl && input.imageUrl.startsWith("http")) {
    body.image = input.imageUrl;
    // Seedance 2.0 unique: end-frame interpolation (only when start image is present)
    if (
      input.lastFrameImageUrl &&
      input.lastFrameImageUrl.startsWith("http") &&
      input.lastFrameImageUrl !== input.imageUrl
    ) {
      body.last_frame_image = input.lastFrameImageUrl;
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const webhookUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/replicate-webhook` : null;
  const requestBody: Record<string, any> = { input: body };
  if (webhookUrl) {
    requestBody.webhook = webhookUrl;
    requestBody.webhook_events_filter = ["completed"];
  }

  const res = await fetch(SEEDANCE_MODEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REPLICATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Seedance 2.0 dispatch failed (${res.status}): ${errorText}`);
  }

  const prediction = await res.json();
  if (!prediction?.id) throw new Error("Seedance 2.0 returned no prediction id");
  return { predictionId: prediction.id };
}

/**
 * Call a sibling edge function via service-role auth.
 */
async function callEdgeFunction(name: string, payload: Record<string, any>): Promise<any> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name} failed (${res.status}): ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ═══ AUTH ═══
  const auth = await validateAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let request: SeedancePipelineRequest;
  try { request = await req.json(); } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (auth.userId) request.userId = auth.userId;
  if (!request.userId) {
    return new Response(JSON.stringify({ success: false, error: "userId required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ═══ DB ENGINE LOCK (mirror of Hollywood) ═══
  if (request.projectId) {
    try {
      const { data: row } = await supabase
        .from("movie_projects")
        .select("video_engine")
        .eq("id", request.projectId)
        .maybeSingle();
      const persisted = row?.video_engine as string | null;
      if (persisted) {
        if (request.videoEngine && request.videoEngine !== persisted) {
          console.warn(
            `[Seedance] 🛡️ ENGINE LOCK: body="${request.videoEngine}" overridden by persisted="${persisted}"`,
          );
        }
        request.videoEngine = persisted;
      }
    } catch (e) {
      console.warn("[Seedance] Engine lookup failed:", e);
    }
  }

  // ═══ SEEDANCE-ONLY HARD GUARD ═══
  const incomingEngine = request.videoEngine ?? "seedance";
  if (incomingEngine !== "seedance") {
    console.error(`[Seedance] ❌ ENGINE REJECTED: got "${incomingEngine}", expected "seedance"`);
    return new Response(
      JSON.stringify({
        success: false,
        error: "ENGINE_NOT_SUPPORTED",
        message:
          `seedance-pipeline only supports Seedance 2.0. Received "${incomingEngine}". ` +
          `Use hollywood-pipeline for Kling, generate-video for other engines.`,
        engine: incomingEngine,
        supportedEngines: ["seedance"],
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  request.videoEngine = "seedance";

  try {
    // ═══ PARAMS ═══
    const clipCount = Math.max(1, Math.min(12, request.clipCount ?? 6));
    const clipDuration = Math.max(2, Math.min(12, request.clipDuration ?? 10));
    const aspectRatio = (request.aspectRatio ?? "16:9") as '16:9' | '9:16' | '1:1';
    const cameraFixed = request.cameraFixed ?? false;
    const includeVoice = request.includeVoice ?? false;
    const includeMusic = request.includeMusic ?? true;
    const isResuming = !!request.resumeFrom;

    if (!isResuming && !request.concept && !request.manualPrompts && !request.approvedScript) {
      return new Response(
        JSON.stringify({ success: false, error: "concept, manualPrompts, or approvedScript required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const totalCredits = clipCount * seedanceCreditsForClip(clipDuration);
    console.log(`[Seedance] params: ${clipCount} clips × ${clipDuration}s, AR=${aspectRatio}, credits=${totalCredits}`);

    // ═══ CREDIT CHECK + DEDUCT ═══
    if (!request.skipCreditDeduction && !isResuming) {
      const { data: balanceRow } = await supabase
        .from("user_credits")
        .select("credits_balance")
        .eq("user_id", request.userId)
        .maybeSingle();
      const balance = balanceRow?.credits_balance ?? 0;
      if (balance < totalCredits) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "INSUFFICIENT_CREDITS",
            required: totalCredits, available: balance,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: deductOk, error: deductErr } = await supabase.rpc("deduct_credits", {
        p_user_id: request.userId,
        p_amount: totalCredits,
        p_description: `Seedance 2.0 generation: ${clipCount} clips × ${clipDuration}s`,
        p_project_id: request.projectId ?? null,
        p_clip_duration: clipCount * clipDuration,
        p_idempotency_key: request.projectId ? `seedance:${request.projectId}` : null,
      });
      if (deductErr || deductOk !== true) {
        return new Response(
          JSON.stringify({ success: false, error: "Credit deduction failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.log(`[Seedance] ✓ Deducted ${totalCredits} credits`);
    }

    // ═══ PROJECT CREATE / UPDATE ═══
    let projectId = request.projectId;
    if (!projectId) {
      const { data: proj, error: projErr } = await supabase
        .from("movie_projects")
        .insert({
          user_id: request.userId,
          title: (request.concept ?? "Seedance Project").slice(0, 80),
          synopsis: request.concept ?? "",
          genre: request.genre ?? "cinematic",
          mood: request.mood ?? "epic",
          status: "generating",
          video_engine: "seedance",
          quality_tier: "standard",
          pipeline_stage: "script",
          pending_video_tasks: {
            stage: "script",
            progress: 5,
            engine: "seedance",
            clipCount, clipDuration, aspectRatio, cameraFixed,
            includeVoice, includeMusic,
            startedAt: new Date().toISOString(),
          },
        })
        .select("id")
        .single();
      if (projErr || !proj) throw new Error(`Failed to create project: ${projErr?.message}`);
      projectId = proj.id;
      console.log(`[Seedance] ✓ Created project ${projectId}`);
    } else {
      await supabase
        .from("movie_projects")
        .update({
          status: "generating",
          video_engine: "seedance",
          last_error: null,
          pipeline_stage: "script",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
    }

    // ═══ SCRIPT ═══
    let shots: Array<Record<string, any>>;
    if (request.approvedScript?.shots?.length) {
      shots = request.approvedScript.shots;
      console.log(`[Seedance] Using approved script: ${shots.length} shots`);
    } else if (request.manualPrompts?.length) {
      shots = request.manualPrompts.map((p, i) => ({
        id: `shot_${i + 1}`,
        title: `Shot ${i + 1}`,
        description: p,
        durationSeconds: clipDuration,
      }));
    } else {
      console.log(`[Seedance] Generating script via generate-script`);
      const scriptRes = await callEdgeFunction("generate-script", {
        concept: request.concept,
        clipCount,
        clipDuration,
        genre: request.genre ?? "cinematic",
        mood: request.mood ?? "epic",
        engine: "seedance",
      }).catch((e) => {
        console.warn(`[Seedance] generate-script failed, falling back to concept split:`, e?.message);
        return null;
      });
      if (scriptRes?.shots?.length) {
        shots = scriptRes.shots.slice(0, clipCount);
      } else {
        // Fallback: single-prompt per clip
        shots = Array.from({ length: clipCount }, (_, i) => ({
          id: `shot_${i + 1}`,
          title: `Shot ${i + 1}`,
          description: request.concept ?? `Scene ${i + 1}`,
          durationSeconds: clipDuration,
        }));
      }
    }

    await supabase
      .from("movie_projects")
      .update({
        generated_script: { shots },
        pipeline_stage: "assets",
        pending_video_tasks: {
          stage: "assets", progress: 25, engine: "seedance",
          clipCount, clipDuration, aspectRatio, cameraFixed,
          includeVoice, includeMusic,
          script: { shots },
        },
      })
      .eq("id", projectId);

    // ═══ SCENE IMAGES (FLUX) ═══
    let sceneImages: string[] = [];
    try {
      console.log(`[Seedance] Generating ${shots.length} scene images via generate-scene-images`);
      const imgRes = await callEdgeFunction("generate-scene-images", {
        projectId,
        userId: request.userId,
        shots: shots.map((s) => ({
          id: s.id, description: s.description, mood: s.mood ?? request.mood,
        })),
        aspectRatio,
        engine: "seedance",
      });
      sceneImages = imgRes?.imageUrls ?? imgRes?.images ?? [];
      console.log(`[Seedance] ✓ Got ${sceneImages.length} scene images`);
    } catch (e: any) {
      console.warn(`[Seedance] Scene-image generation failed (continuing T2V):`, e?.message);
    }

    // ═══ AUDIO DISPATCH (parallel with video clips) ═══
    // Seedance has NO native audio, so we generate voice/music NOW and the
    // watchdog will mux them onto the stitched video. Fire-and-forget pattern:
    // we kick off requests and persist whatever resolves; watchdog handles
    // anything still pending.
    const totalSeconds = shots.reduce(
      (acc, s) => acc + (s.durationSeconds ?? clipDuration), 0,
    );
    const audioPromises: Record<string, Promise<any>> = {};

    if (includeVoice) {
      const voiceLines = shots
        .map((s, i) => s.dialogue ?? s.voiceover ?? s.narration ?? null)
        .filter((l): l is string => !!l && l.trim().length > 0);
      if (voiceLines.length > 0) {
        console.log(`[Seedance] Dispatching voice for ${voiceLines.length} lines`);
        audioPromises.voice = callEdgeFunction("generate-voice", {
          projectId,
          userId: request.userId,
          lines: voiceLines,
          engine: "seedance",
        }).catch((e) => {
          console.warn(`[Seedance] generate-voice failed:`, e?.message);
          return null;
        });
      }
    }

    if (includeMusic) {
      console.log(`[Seedance] Dispatching music (${totalSeconds}s)`);
      audioPromises.music = callEdgeFunction("generate-music", {
        projectId,
        userId: request.userId,
        duration: totalSeconds,
        mood: request.mood ?? "epic",
        genre: request.genre ?? "cinematic",
        engine: "seedance",
      }).catch((e) => {
        console.warn(`[Seedance] generate-music failed:`, e?.message);
        return null;
      });
    }

    // Don't block clip dispatch on audio — settle in parallel, harvest after
    const audioSettled = await Promise.allSettled(
      Object.entries(audioPromises).map(async ([k, p]) => [k, await p] as const),
    );
    const audioAssets: Record<string, any> = {};
    for (const r of audioSettled) {
      if (r.status === "fulfilled" && r.value) {
        const [k, v] = r.value;
        if (v) audioAssets[k] = v?.url ?? v?.audioUrl ?? v;
      }
    }
    console.log(`[Seedance] Audio assets ready: ${Object.keys(audioAssets).join(",") || "(none)"}`);

    // ═══ DISPATCH SEEDANCE CLIPS (parallel) ═══
    await supabase
      .from("movie_projects")
      .update({
        pipeline_stage: "production",
        pending_video_tasks: {
          stage: "production", progress: 50, engine: "seedance",
          clipCount, clipDuration, aspectRatio, cameraFixed,
          includeVoice, includeMusic,
          script: { shots },
          sceneImages,
        },
      })
      .eq("id", projectId);

    const dispatchResults = await Promise.allSettled(
      shots.map(async (shot, i) => {
        const imageUrl = sceneImages[i] ?? null;
        // Seedance unique: use NEXT scene image as last_frame_image for inter-scene continuity
        const lastFrameImageUrl = sceneImages[i + 1] ?? null;

        const { predictionId } = await dispatchSeedanceClip({
          prompt: shot.description ?? shot.title ?? `Scene ${i + 1}`,
          imageUrl,
          lastFrameImageUrl,
          durationSeconds: shot.durationSeconds ?? clipDuration,
          aspectRatio,
          cameraFixed,
        });

        // Persist video_clip row for watchdog/poller
        await supabase.from("video_clips").insert({
          project_id: projectId,
          user_id: request.userId,
          shot_index: i,
          prompt: shot.description ?? "",
          duration_seconds: shot.durationSeconds ?? clipDuration,
          status: "processing",
          replicate_prediction_id: predictionId,
          video_engine: "seedance",
          start_image_url: imageUrl,
          end_image_url: lastFrameImageUrl,
        });

        return { shotIndex: i, predictionId };
      }),
    );

    const dispatched = dispatchResults
      .filter((r): r is PromiseFulfilledResult<{ shotIndex: number; predictionId: string }> => r.status === "fulfilled")
      .map((r) => r.value);
    const failed = dispatchResults
      .map((r, i) => r.status === "rejected" ? { shotIndex: i, error: String((r as any).reason?.message ?? r.reason) } : null)
      .filter(Boolean);

    console.log(`[Seedance] Dispatched ${dispatched.length}/${shots.length} clips. Failed: ${failed.length}`);

    // ═══ PERSIST PENDING STATE FOR WATCHDOG ═══
    await supabase
      .from("movie_projects")
      .update({
        pending_video_tasks: {
          stage: "production",
          progress: 60,
          engine: "seedance",
          clipCount, clipDuration, aspectRatio, cameraFixed,
          includeVoice, includeMusic,
          script: { shots },
          sceneImages,
          predictionIds: dispatched,
          failedDispatches: failed,
          dispatchedAt: new Date().toISOString(),
          // Watchdog instructions: after all clips succeed, run audio + stitch
          postProduction: {
            includeVoice, includeMusic,
            stitchFunction: "simple-stitch",
          },
        },
      })
      .eq("id", projectId);

    return new Response(
      JSON.stringify({
        success: true,
        pipeline: "seedance-pipeline",
        engine: "seedance",
        projectId,
        dispatched,
        failed,
        totalCredits,
        message:
          `Seedance pipeline started: ${dispatched.length}/${shots.length} clips dispatched. ` +
          `Watchdog will complete production, audio, and stitching.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[Seedance] Pipeline error:", err);
    if (request.projectId) {
      await supabase
        .from("movie_projects")
        .update({
          status: "failed",
          last_error: err?.message?.slice(0, 500) ?? "Unknown error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.projectId);
    }
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});