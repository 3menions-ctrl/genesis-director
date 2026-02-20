/**
 * PRODUCTION AUDIT — SEQUENTIAL SINGLE-VIDEO PIPELINE TRIGGER
 *
 * Fires ONE production at a time through hollywood-pipeline / generate-avatar-direct.
 * Launches sequentially to avoid credit race conditions and timeout issues.
 *
 * Modes supported:
 *   - Text-to-Video  (via hollywood-pipeline)
 *   - Image-to-Video (via hollywood-pipeline with referenceImageUrl)
 *   - Avatar         (via generate-avatar-direct)
 *
 * Each production uses the REAL pipeline chain:
 *   ✅ Sequential frame chaining via pipeline-watchdog
 *   ✅ Pose chain injection at prompt level
 *   ✅ Frame extraction → startImageUrl for clip N+1
 *   ✅ Proper project/clip DB registration
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_USER_ID = "d600868d-651a-46f6-a621-a727b240ac7c";

// ─── CAMPAIGNS ───────────────────────────────────────────────────────────────

const T2V_CAMPAIGNS = [
  {
    title: "Future Is Now — AI Tech Launch",
    concept: "A sleek futuristic product launch event inside a glowing white auditorium. Thousands watching as a holographic AI assistant materializes on stage. Cut to: the audience reacts with awe, faces lit by holographic glow. Cinematic, aspirational, high-energy brand reveal.",
    genre: "Cinematic",
    mood: "Energetic",
  },
  {
    title: "Limitless Hustle — Entrepreneur Story",
    concept: "Dawn breaks over a modern skyline as a driven entrepreneur stands at floor-to-ceiling windows, city awakening below. Bold montage: typing on a sleek laptop, shaking hands, watching a climbing analytics dashboard. Motivational, aspirational marketing energy.",
    genre: "Documentary",
    mood: "Motivational",
  },
];

const I2V_CAMPAIGNS = [
  {
    title: "Luxury Unveiled — Watch Hero Shot",
    concept: "A premium luxury watch rests on black polished marble, lit by a single dramatic spotlight. The watch face glows as camera slowly pushes in — micro-details of the dial, sapphire crystal refracting light. Photorealistic luxury advertising perfection.",
    imageUrl: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=1280&q=80",
    genre: "Commercial",
    mood: "Luxury",
  },
  {
    title: "Ocean Escape — Travel Brand",
    concept: "Pristine turquoise ocean water laps against white sand, a hammock sways gently, palm trees frame golden hour light. Camera drifts slowly from the shoreline out over crystal water. Cinematic travel advertising, vibrant warm colors.",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&q=80",
    genre: "Travel",
    mood: "Cinematic",
  },
];

const AVATAR_CAMPAIGNS = [
  {
    title: "AI Revolution — Keynote Speaker",
    script: "The future of business isn't about working harder — it's about working smarter. In the next eighteen months, AI will reshape every industry. The companies that move now will define the next decade.",
    avatarImageUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80",
    sceneDescription: "A sleek modern conference room with floor-to-ceiling windows overlooking a city skyline, warm professional studio lighting",
  },
  {
    title: "Breakthrough Moment — Motivational Ad",
    script: "You've been building toward this moment your entire life. Every late night, every rejection — it was all preparation. Today is the day you stop dreaming and start living it.",
    avatarImageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&q=80",
    sceneDescription: "An inspiring co-working space with exposed brick, warm Edison bulbs, golden afternoon light streaming through industrial windows",
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function callPipeline(
  supabaseUrl: string,
  serviceKey: string,
  functionName: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}: ${text.substring(0, 300)}` };
    }

    try {
      return { success: true, data: JSON.parse(text) };
    } catch {
      return { success: true, data: text };
    }
  } catch (err) {
    return { success: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const log: string[] = [];
  const results: Record<string, unknown> = { startedAt: new Date().toISOString() };

  // ── Parse options ─────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  // mode: "t2v" | "i2v" | "avatar" | "all" | "health"
  const mode = (body.mode as string) || "t2v";
  // campaignIndex: 0 or 1 (which campaign to use)
  const campaignIndex = typeof body.campaignIndex === "number" ? body.campaignIndex : 0;
  // clipCount: how many clips per video (default 2)
  const clipCount = typeof body.clipCount === "number" ? body.clipCount : 2;

  // ── Credit check ─────────────────────────────────────────────────────
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("credits_balance, display_name")
    .eq("id", ADMIN_USER_ID)
    .single();

  const creditBalance = adminProfile?.credits_balance ?? 0;
  log.push(`👤 Admin: ${adminProfile?.display_name} — Credits: ${creditBalance}`);

  // ── Launch single video based on mode ─────────────────────────────────
  if (mode === "health") {
    log.push("\n🔍 Health-only mode — skipping launches");
  } else if (mode === "t2v") {
    const campaign = T2V_CAMPAIGNS[campaignIndex % T2V_CAMPAIGNS.length];
    log.push(`\n🚀 Launching T2V: "${campaign.title}" (${clipCount} clips)`);

    const result = await callPipeline(supabaseUrl, serviceKey, "hollywood-pipeline", {
      userId: ADMIN_USER_ID,
      concept: campaign.concept,
      aspectRatio: "16:9",
      clipCount,
      clipDuration: 10,
      includeVoice: false,
      includeMusic: false,
      qualityTier: "standard",
      genre: campaign.genre,
      mood: campaign.mood,
      videoEngine: "kling-v3",
      skipCreditDeduction: true,
      // Skip heavy stages to prevent background execution timeout
      stages: ["preproduction", "production", "postproduction"],
    });

    results.launch = { campaign: campaign.title, ...result };
    log.push(`  ${result.success ? "✅" : "❌"} ${result.success ? "Pipeline accepted" : result.error}`);

  } else if (mode === "i2v") {
    const campaign = I2V_CAMPAIGNS[campaignIndex % I2V_CAMPAIGNS.length];
    log.push(`\n🚀 Launching I2V: "${campaign.title}" (${clipCount} clips)`);

    const result = await callPipeline(supabaseUrl, serviceKey, "hollywood-pipeline", {
      userId: ADMIN_USER_ID,
      concept: campaign.concept,
      referenceImageUrl: campaign.imageUrl,
      aspectRatio: "16:9",
      clipCount,
      clipDuration: 10,
      includeVoice: false,
      includeMusic: false,
      qualityTier: "standard",
      genre: campaign.genre,
      mood: campaign.mood,
      videoEngine: "kling-v3",
      skipCreditDeduction: true,
      stages: ["preproduction", "production", "postproduction"],
    });

    results.launch = { campaign: campaign.title, ...result };
    log.push(`  ${result.success ? "✅" : "❌"} ${result.success ? "Pipeline accepted" : result.error}`);

  } else if (mode === "avatar") {
    const campaign = AVATAR_CAMPAIGNS[campaignIndex % AVATAR_CAMPAIGNS.length];
    log.push(`\n🚀 Launching Avatar: "${campaign.title}" (${clipCount} clips)`);

    const result = await callPipeline(supabaseUrl, serviceKey, "generate-avatar-direct", {
      userId: ADMIN_USER_ID,
      script: campaign.script,
      avatarImageUrl: campaign.avatarImageUrl,
      sceneDescription: campaign.sceneDescription,
      aspectRatio: "16:9",
      clipCount,
      clipDuration: 10,
      voiceId: "nova",
      avatarType: "realistic",
      qualityTier: "professional",
    });

    results.launch = { campaign: campaign.title, ...result };
    log.push(`  ${result.success ? "✅" : "❌"} ${result.success ? "Pipeline accepted" : result.error}`);
  }

  // ── Pipeline health audit ─────────────────────────────────────────────
  log.push("\n🔍 === PIPELINE HEALTH AUDIT ===");

  const [stuckProjects, recentFails, missingFrames, clipStats] = await Promise.all([
    supabase
      .from("movie_projects")
      .select("id, title, status, mode, updated_at")
      .eq("status", "generating")
      .lt("updated_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(20),
    supabase
      .from("movie_projects")
      .select("id, title, status, mode, updated_at")
      .eq("status", "failed")
      .gt("updated_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(10),
    supabase
      .from("video_clips")
      .select("id, project_id, shot_index, status")
      .eq("status", "completed")
      .is("last_frame_url", null)
      .limit(20),
    supabase
      .from("video_clips")
      .select("status")
      .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  log.push(`  🔒 Stuck generating (>30min): ${stuckProjects.data?.length ?? 0}`);
  log.push(`  ❌ Recent failures (1h): ${recentFails.data?.length ?? 0}`);
  log.push(`  🖼  Completed clips missing last_frame_url: ${missingFrames.data?.length ?? 0}`);

  const stats = { generating: 0, completed: 0, failed: 0, pending: 0 };
  for (const c of (clipStats.data ?? [])) {
    const s = c.status as string;
    if (s in stats) stats[s as keyof typeof stats]++;
  }
  log.push(`  📊 Clip stats (24h): ${JSON.stringify(stats)}`);

  results.auditLog = log;
  results.health = {
    stuckProjects: stuckProjects.data?.length ?? 0,
    recentFailures: recentFails.data?.length ?? 0,
    missingFrameUrls: missingFrames.data?.length ?? 0,
    clipStats24h: stats,
  };
  results.completedAt = new Date().toISOString();

  return new Response(
    JSON.stringify(results, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
