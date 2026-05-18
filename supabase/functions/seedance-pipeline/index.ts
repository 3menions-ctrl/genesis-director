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
import {
  validateAuth,
  unauthorizedResponse,
  resolveEffectiveUserId,
  forbiddenResponse,
} from "../_shared/auth-guard.ts";
import { markProjectFailedAndRefund } from "../_shared/pipeline-failure.ts";

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
  voiceId?: string;
  cameraFixed?: boolean; // Seedance native param
  genre?: string;
  mood?: string;
  skipApproval?: boolean;
  skipCreditDeduction?: boolean;
  resumeFrom?: string;
  isAvatarMode?: boolean;

  // ─── Avatars / Mascots / Reference identity ──────────────────────────
  referenceImageUrl?: string;        // avatar/mascot/character ref
  referenceImageAnalysis?: any;      // pre-extracted identity
  identityBible?: any;               // continuity manifest from extractor
  characterLock?: any;               // character lock object

  // ─── Templates (rich template flow) ──────────────────────────────────
  useTemplateShots?: boolean;
  templateShotSequence?: any[];      // pre-defined shots
  templateName?: string;
  templateStyleAnchor?: any;
  templateCharacters?: any[];
  templateEnvironmentLock?: any;

  // ─── Fourth-wall / Breakout effects (3-clip narrative) ───────────────
  isBreakout?: boolean;
  breakoutStartImageUrl?: string;
  breakoutPlatform?:
    | 'post-escape' | 'scroll-grab' | 'freeze-walk' | 'reality-rip'
    | 'aspect-escape' | 'mirror-shatter' | 'canvas-emerge'
    | 'billboard-leap' | 'page-burst' | 'hologram-materialize';
  breakoutDialogue?: string;         // line spoken in clip 3
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
 * Inject identity/character lock anchors into a Seedance prompt.
 * Seedance doesn't have Kling-style multi-image identity lock, so we
 * front-load identity into the text prompt and rely on `image` for visual.
 */
function injectIdentity(
  base: string,
  opts: {
    identityBible?: any;
    characterLock?: any;
    referenceImageAnalysis?: any;
    templateCharacters?: any[];
  },
): string {
  const parts: string[] = [];
  const ib = opts.identityBible;
  const cl = opts.characterLock;
  const ria = opts.referenceImageAnalysis;
  const tc = opts.templateCharacters?.[0];

  const charDesc =
    cl?.description ||
    ib?.characterIdentity?.description ||
    ria?.characterIdentity?.description ||
    ria?.consistencyPrompt ||
    tc?.appearance ||
    null;
  if (charDesc) parts.push(`Character: ${String(charDesc).slice(0, 400)}`);

  const env =
    ib?.masterSceneAnchor?.environmentDNA ||
    ib?.consistencyPrompt ||
    null;
  if (env) parts.push(`Continuity: ${String(env).slice(0, 300)}`);

  parts.push("Same person across all shots — no face, body, hair, or wardrobe drift");

  return `${base} | ${parts.join(" | ")}`.slice(0, 2400);
}

// ───────────────────────────────────────────────────────────────────────
// FOURTH-WALL / BREAKOUT EFFECT CONFIGS — Seedance-tuned (no audio cues)
// 3-clip narrative: Trap → Break → Emerge (speaks user dialogue)
// ───────────────────────────────────────────────────────────────────────
interface BreakoutConfig {
  clip1: string;
  clip2: string;
  clip3: string;
}
const ID_TAG = "[Same person throughout — no face/body/clothing changes]";
const MO_TAG = "[Continuous motion: breathing, micro-expressions, fabric sway]";

function getSeedanceBreakoutConfig(platform: string): BreakoutConfig {
  const configs: Record<string, BreakoutConfig> = {
    'post-escape': {
      clip1: `${ID_TAG} Slow dolly push-in, claustrophobic. Person trapped inside social media post UI, palms pressed against glass barrier, breath fogging surface. Cyan UI glow rim light. ${MO_TAG}`,
      clip2: `${ID_TAG} Tracking with dutch angle. Character smashes through screen, glass shards exploding toward viewer, UI buttons shattering into pixel fragments, volumetric dust burst, blue-white backlight. ${MO_TAG}`,
      clip3: `${ID_TAG} Hero crane shot rising to eye level, powerful step forward, shattered UI debris settling, 45° key light, volumetric haze, confident eye contact. ${MO_TAG}`,
    },
    'scroll-grab': {
      clip1: `${ID_TAG} Push-in with handheld energy. Person inside phone screen, hand reaching out creating 3D bulge in glass, neon pink/cyan dual-tone rim glow. ${MO_TAG}`,
      clip2: `${ID_TAG} Whip pan following action. Fist smashing through glass burst, body pulling forward with parkour energy, neon fragments exploding. ${MO_TAG}`,
      clip3: `${ID_TAG} Orbit right around subject. Athletic landing with crouch, rising with confident swagger, shattered phone behind, club-style pink key + cyan fill. ${MO_TAG}`,
    },
    'freeze-walk': {
      clip1: `${ID_TAG} Slow push-in toward frozen figure. Video conference grid, one person frozen in greyscale while others move in color, body glowing at edges with white-gold light. ${MO_TAG}`,
      clip2: `${ID_TAG} Tracking shot, perspective shifting 2D to 3D. Frozen person steps forward out of video box into real 3D space, color flooding back, portal glow at boundary. ${MO_TAG}`,
      clip3: `${ID_TAG} Dolly back establishing composition. Confident stance in 3D space, video grid continuing behind, premium corporate lighting, subtle glow fading. ${MO_TAG}`,
    },
    'reality-rip': {
      clip1: `${ID_TAG} Slow crane down into void. Pure darkness with glowing tear in reality fabric, silhouette backlit through rift, hands gripping tear edges. ${MO_TAG}`,
      clip2: `${ID_TAG} Explosive push-in through chaos. Reality tears open, person surges through with godlike power, arms spreading wide, supernova light burst. ${MO_TAG}`,
      clip3: `${ID_TAG} Heroic low angle with tilt up. Powerful stance as tear seals behind, energy wisps fading, dramatic hero lighting, world-changing presence. ${MO_TAG}`,
    },
    'aspect-escape': {
      clip1: `${ID_TAG} Static then subtle push. Vertical 9:16 frame, person pushing against aspect-ratio edge, format bulging from pressure, distortion ripples. ${MO_TAG}`,
      clip2: `${ID_TAG} Dramatic whip from vertical to horizontal. Person breaks through aspect-ratio boundary, vertical frame shattering like glass, dimensional light at boundary. ${MO_TAG}`,
      clip3: `${ID_TAG} Cinematic tracking establishing widescreen composition. Arms sweeping to embrace full frame width, premium cinema lighting, liberated confidence. ${MO_TAG}`,
    },
    'mirror-shatter': {
      clip1: `${ID_TAG} Slow dolly push-in. Person trapped behind ornate gilded baroque mirror, palms pressed against silvered glass, candlelit ballroom, warm chiaroscuro. ${MO_TAG}`,
      clip2: `${ID_TAG} Cinematic tracking with dutch angle. Mirror shatters outward in halo of silvered shards and quicksilver droplets, person stepping forward through breaking plane. ${MO_TAG}`,
      clip3: `${ID_TAG} Hero crane shot at eye level. Confident step onto polished marble floor, gilded frame splintered behind, chandelier rim, regal presence. ${MO_TAG}`,
    },
    'canvas-emerge': {
      clip1: `${ID_TAG} Slow dolly push-in on enormous gilded baroque frame in white-cube gallery. Person in painterly oil-paint style stands inside canvas, brushstrokes trembling. ${MO_TAG}`,
      clip2: `${ID_TAG} Tracking shot, perspective shifting painterly to photoreal. Person pushes through canvas cracking like wet membrane, glossy oil paint stretching then tearing. ${MO_TAG}`,
      clip3: `${ID_TAG} Dolly back establishing gallery composition. Confident step onto polished concrete floor, oil paint pooling at feet, torn canvas in gilded frame behind, museum spotlights. ${MO_TAG}`,
    },
    'billboard-leap': {
      clip1: `${ID_TAG} Slow crane up toward billboard. Person inside colossal Times Square LED billboard with faint RGB scanlines, neon-soaked rainy street below, hand pressing inside screen. ${MO_TAG}`,
      clip2: `${ID_TAG} Explosive whip down with parallax. Person leaps off billboard, screen shattering into cascade of pixel sparks and LED panels, mid-air silhouette against magenta/cyan glow. ${MO_TAG}`,
      clip3: `${ID_TAG} Low-angle tracking at eye level. Athletic landing on wet asphalt, neon reflections rippling outward, taxis braking around them, volumetric haze, magenta key + cyan rim. ${MO_TAG}`,
    },
    'page-burst': {
      clip1: `${ID_TAG} Slow dolly push-in over spread of colossal open hardcover book on library lectern. Person inside page surrounded by towering walls of calligraphic typography, warm candlelight. ${MO_TAG}`,
      clip2: `${ID_TAG} Explosive tracking with whip energy. Person bursts through page in tornado of paper shreds and swirling ink ribbons, candle flames bending in shockwave. ${MO_TAG}`,
      clip3: `${ID_TAG} Dolly back establishing candlelit library. Confident step onto warm parquet floor, paper shreds settling, towering bookshelves in bokeh behind, warm hero key + moonlight fill. ${MO_TAG}`,
    },
    'hologram-materialize': {
      clip1: `${ID_TAG} Slow dolly push-in through dark sci-fi corridor. Person compressed inside glitching cyan holographic cube on obsidian plinth, scanline distortion, particles drifting upward. ${MO_TAG}`,
      clip2: `${ID_TAG} Explosive push-in through shockwave. Hologram solidifies — cube collapsing in burst of volumetric cyan light, person stepping forward as flesh stabilizes from wireframe to photoreal. ${MO_TAG}`,
      clip3: `${ID_TAG} Low-angle tracking with slow tilt up. Confident step off obsidian plinth, last data particles fading from shoulders, sleek corridor stretching behind, cyan rim + cool fill. ${MO_TAG}`,
    },
  };
  return configs[platform] ?? configs['post-escape'];
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
  let activeProjectId: string | undefined = request.projectId;
  let plannedCredits = 0;
  let plannedClipCount = Math.max(1, Math.min(12, request.clipCount ?? 6));
  let chargedCredits = false;

  // SECURITY: end-user JWT → JWT id wins (mismatch = 403). Service-role → body.userId.
  try {
    request.userId = resolveEffectiveUserId(auth, request.userId ?? null);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'USER_ID_MISMATCH') return forbiddenResponse(corsHeaders);
    if (msg === 'SERVICE_ROLE_REQUIRES_USER_ID') {
      return new Response(JSON.stringify({ success: false, error: 'userId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return unauthorizedResponse(corsHeaders, msg);
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
    plannedClipCount = clipCount;
    plannedCredits = totalCredits;
    console.log(`[Seedance] params: ${clipCount} clips × ${clipDuration}s, AR=${aspectRatio}, credits=${totalCredits}`);

    // ═══ CREDIT CHECK + DEDUCT ═══
    if (!request.skipCreditDeduction && !isResuming) {
      const { data: creditState, error: creditStateError } = await supabase.rpc("get_credit_state", { p_user_id: request.userId });
      const creditPayload = (creditState || {}) as any;
      const availableCredits = Number(creditPayload.available || 0);
      if (creditStateError || creditPayload.success !== true) {
        return new Response(
          JSON.stringify({ success: false, error: "CREDIT_STATE_FAILED" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (availableCredits < totalCredits) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "INSUFFICIENT_CREDITS",
            required: totalCredits, available: availableCredits,
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
      chargedCredits = true;
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
      activeProjectId = projectId;
      console.log(`[Seedance] ✓ Created project ${projectId}`);
    } else {
      activeProjectId = projectId;
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

    // ─── A) TEMPLATE flow — pre-defined shots used directly ──────────
    if (request.useTemplateShots && request.templateShotSequence?.length) {
      const seq = request.templateShotSequence;
      console.log(`[Seedance] Using ${seq.length} template shots from "${request.templateName || 'template'}"`);
      shots = seq.map((shot: any, i: number) => ({
        id: shot.id ?? `tpl_${i + 1}`,
        title: shot.title ?? `Shot ${i + 1}`,
        description: shot.description ?? shot.prompt ?? `Scene ${i + 1}`,
        durationSeconds: Math.min(12, shot.durationSeconds ?? clipDuration),
        dialogue: shot.dialogue,
        mood: shot.mood ?? request.mood,
      }));
      // Promote template character/env into identity for prompt injection
      if (!request.characterLock && request.templateCharacters?.[0]) {
        request.characterLock = {
          description: request.templateCharacters[0].appearance ?? "",
        };
      }
    }
    // ─── B) BREAKOUT / FOURTH-WALL flow — 3-clip narrative ──────────
    else if (request.isBreakout && request.breakoutPlatform) {
      console.log(`[Seedance] 🔥 BREAKOUT EFFECT: ${request.breakoutPlatform}`);
      const cfg = getSeedanceBreakoutConfig(request.breakoutPlatform);
      const userLine = (request.breakoutDialogue ?? request.concept ?? "").trim();
      const clip3WithLine = userLine
        ? `${cfg.clip3} Speaking the line: "${userLine.slice(0, 280)}".`
        : cfg.clip3;
      shots = [
        { id: "breakout_1", title: "The Trap",     description: cfg.clip1, durationSeconds: Math.min(12, clipDuration) },
        { id: "breakout_2", title: "The Break",    description: cfg.clip2, durationSeconds: Math.min(12, clipDuration) },
        { id: "breakout_3", title: "The Emerge",   description: clip3WithLine, durationSeconds: Math.min(12, clipDuration), dialogue: userLine || undefined },
      ];
      // Breakout start image becomes the reference for clip 1
      if (request.breakoutStartImageUrl && !request.referenceImageUrl) {
        request.referenceImageUrl = request.breakoutStartImageUrl;
      }
    }
    else if (request.approvedScript?.shots?.length) {
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
      // ABOVE-CAMERON DIRECTOR — Seedance-tuned cinematographer LLM.
      // Falls back to legacy generate-script if director is unavailable.
      console.log(`[Seedance] 🎬 Running seedance-script-director (Cameron-tier)`);
      const charDesc =
        request.characterLock?.description ||
        request.referenceImageAnalysis?.characterIdentity?.description ||
        request.templateCharacters?.[0]?.appearance ||
        undefined;
      const envLock =
        request.templateEnvironmentLock?.location ||
        request.identityBible?.masterSceneAnchor?.environmentDNA ||
        undefined;
      let scriptRes: any = await callEdgeFunction("seedance-script-director", {
        concept: request.concept,
        clipCount,
        clipDuration,
        aspectRatio,
        genre: request.genre ?? "cinematic",
        mood: request.mood ?? "epic",
        isAvatarMode: !!request.isAvatarMode,
        hasReferenceImage: !!request.referenceImageUrl,
        characterDescription: charDesc,
        environmentLock: envLock,
        cameraFixed,
      }).catch((e) => {
        console.warn(`[Seedance] director failed, falling back to generate-script:`, e?.message);
        return null;
      });
      if (!scriptRes?.shots?.length) {
        scriptRes = await callEdgeFunction("generate-script", {
          concept: request.concept,
          clipCount,
          clipDuration,
          genre: request.genre ?? "cinematic",
          mood: request.mood ?? "epic",
          engine: "seedance",
          engineHints: {
            noNativeAudio: true,
            maxClipSeconds: 12,
            motionFirst: true,
            referenceImage: !!request.referenceImageUrl,
            isAvatarMode: !!request.isAvatarMode,
          },
        }).catch((e) => {
          console.warn(`[Seedance] generate-script also failed:`, e?.message);
          return null;
        });
      }
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
            lastProgressAt: new Date().toISOString(),
          clipCount, clipDuration, aspectRatio, cameraFixed,
          includeVoice, includeMusic,
          script: { shots },
        },
          pipeline_state: {
            stage: "assets",
            progress: 25,
            lastProgressAt: new Date().toISOString(),
            engine: "seedance",
          },
      })
      .eq("id", projectId);

    // ═══ SCENE IMAGES ═══
    // Three modes:
    //   1) referenceImageUrl provided (avatar / mascot / breakout) →
    //      use the SAME reference as start image for every clip so identity
    //      stays locked. Seedance's `last_frame_image` still chains motion.
    //   2) Template flow with templateEnvironmentLock → use FLUX but seed
    //      with environment lock + character anchor.
    //   3) Pure concept → FLUX per-shot.
    let sceneImages: Array<string | null> = [];
    if (request.isBreakout && request.breakoutStartImageUrl && request.referenceImageUrl) {
      console.log(`[Seedance] 🧨 Breakout start frame + cast reference → platform first, identity locked after breach`);
      sceneImages = shots.map((_, i) => i === 0 ? request.breakoutStartImageUrl! : request.referenceImageUrl!);
    } else if (request.referenceImageUrl) {
      console.log(`[Seedance] 🎭 Reference image present → locking identity across all ${shots.length} clips`);
      sceneImages = Array.from({ length: shots.length }, () => request.referenceImageUrl!);
    } else if (request.isBreakout && request.breakoutStartImageUrl) {
      console.log(`[Seedance] 🧨 Breakout platform start image present → anchoring all clips to interface frame`);
      sceneImages = Array.from({ length: shots.length }, () => request.breakoutStartImageUrl!);
    } else {
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
          // Pass template style/env anchors so FLUX honors them
          styleAnchor: request.templateStyleAnchor,
          environmentLock: request.templateEnvironmentLock,
          characterLock: request.characterLock,
        });
        sceneImages = imgRes?.imageUrls ?? imgRes?.images ?? [];
        console.log(`[Seedance] ✓ Got ${sceneImages.length} scene images`);
      } catch (e: any) {
        console.warn(`[Seedance] Scene-image generation failed (continuing T2V):`, e?.message);
      }
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
          text: voiceLines.join("\n\n"),
          voiceId: request.voiceId,
          shotId: request.isBreakout ? "breakout_voice" : "seedance_voice",
          characterName: request.characterLock?.name,
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
        if (v) audioAssets[k] = v?.url ?? v?.audioUrl ?? v?.musicUrl ?? v;
      }
    }
    console.log(`[Seedance] Audio assets ready: ${Object.keys(audioAssets).join(",") || "(none)"}`);
    const voiceAudioUrl = audioAssets.voice || null;
    const musicAudioUrl = audioAssets.music || null;
    if (voiceAudioUrl || musicAudioUrl) {
      await supabase
        .from("movie_projects")
        .update({
          voice_audio_url: voiceAudioUrl,
          music_url: musicAudioUrl,
        })
        .eq("id", projectId);
    }

    // ═══ DISPATCH SEEDANCE CLIPS (parallel) ═══
    await supabase
      .from("movie_projects")
      .update({
        pipeline_stage: "production",
        pending_video_tasks: {
          stage: "production", progress: 50, engine: "seedance",
          lastProgressAt: new Date().toISOString(),
          clipCount, clipDuration, aspectRatio, cameraFixed,
          includeVoice, includeMusic,
          script: { shots },
          sceneImages,
        },
        pipeline_state: {
          stage: "production",
          progress: 50,
          lastProgressAt: new Date().toISOString(),
          engine: "seedance",
        },
      })
      .eq("id", projectId);

    const dispatchResults = await Promise.allSettled(
      shots.map(async (shot, i) => {
        const imageUrl = sceneImages[i] ?? null;
        // Seedance unique: use NEXT scene image as last_frame_image for inter-scene continuity.
        // When a reference image locks identity (avatar/mascot/breakout), don't set
        // last_frame_image — would collapse motion to zero (same start+end frame).
        const nextImg = sceneImages[i + 1] ?? null;
        const lastFrameImageUrl =
          nextImg && nextImg !== imageUrl ? nextImg : null;

        // Inject identity / template anchors into the prompt
        const enrichedPrompt = injectIdentity(
          shot.description ?? shot.title ?? `Scene ${i + 1}`,
          {
            identityBible: request.identityBible,
            characterLock: request.characterLock,
            referenceImageAnalysis: request.referenceImageAnalysis,
            templateCharacters: request.templateCharacters,
          },
        );

        const { predictionId } = await dispatchSeedanceClip({
          prompt: enrichedPrompt,
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
          lastProgressAt: new Date().toISOString(),
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
            audioAssets, // pre-generated voice/music URLs for muxing
            muxStrategy: "post-stitch", // Seedance: no native audio, mux after
          },
        },
        pipeline_state: {
          stage: "production",
          progress: 60,
          lastProgressAt: new Date().toISOString(),
          engine: "seedance",
          predictionIds: dispatched,
          failedDispatches: failed,
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
    if (activeProjectId) {
      try {
        let completedClipCount = 0;
        try {
          const { count } = await supabase
            .from("video_clips")
            .select("id", { count: "exact", head: true })
            .eq("project_id", activeProjectId)
            .eq("status", "completed");
          completedClipCount = count || 0;
        } catch (_) { /* non-fatal */ }
        await markProjectFailedAndRefund(supabase, {
          projectId: activeProjectId,
          userId: request.userId,
          stage: 'preproduction',
          reason: err,
          totalCredits: chargedCredits ? plannedCredits : 0,
          expectedClipCount: plannedClipCount,
          completedClipCount,
          skipRefund: !chargedCredits,
          source: 'seedance',
        });
      } catch (failHandlerErr) {
        console.error("[Seedance] failure handler error:", failHandlerErr);
        await supabase
          .from("movie_projects")
          .update({
            status: "failed",
            last_error: err?.message?.slice(0, 500) ?? "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeProjectId);
      }
    }
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});