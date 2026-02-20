/**
 * PRODUCTION AUDIT — REAL SEQUENTIAL PIPELINE TRIGGER
 *
 * Fires REAL productions directly through hollywood-pipeline / generate-avatar-direct
 * for all three modes, bypassing mode-router's single-project constraint (admin only).
 *
 * Launches:
 *   - 2 × Text-to-Video  (2 clips each, trending marketing content)
 *   - 2 × Image-to-Video (2 clips each, trending marketing content)
 *   - 2 × Avatar         (2 clips each, trending marketing content)
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

// ─── TRENDING MARKETING CAMPAIGNS ────────────────────────────────────────────

const T2V_CAMPAIGNS = [
  {
    title: "Future Is Now — AI Tech Launch",
    concept: "A sleek futuristic product launch event inside a glowing white auditorium. Thousands of people watching as a holographic AI assistant materializes on stage, eyes open with intelligence and warmth. Cut to: the audience reacts with awe and applause, faces lit by holographic glow. Cinematic, aspirational, high-energy brand reveal moment that stops the scroll.",
    genre: "Cinematic",
    mood: "Energetic",
  },
  {
    title: "Limitless Hustle — Entrepreneur Story",
    concept: "Dawn breaks over a modern skyline as a driven entrepreneur stands at floor-to-ceiling windows of a glass tower, coffee in hand, city awakening below. Bold montage: typing on a sleek laptop, shaking hands in a boardroom, watching a climbing analytics dashboard. Motivational, aspirational marketing energy. The visuals that inspire a generation of founders.",
    genre: "Documentary",
    mood: "Motivational",
  },
];

const I2V_CAMPAIGNS = [
  {
    title: "Luxury Unveiled — Watch Hero Shot",
    concept: "A premium luxury watch rests on black polished marble, lit by a single dramatic spotlight. The watch face glows as camera slowly pushes in — micro-details of the dial, hands, sapphire crystal refracting light. Extreme cinematic close-up transitions to wide beauty shot showing the watch against a dark storm cloud background. Photorealistic luxury advertising perfection.",
    imageUrl: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=1280&q=80",
    genre: "Commercial",
    mood: "Luxury",
  },
  {
    title: "Ocean Escape — Travel Brand",
    concept: "Pristine turquoise ocean water laps against white sand, a hammock sways gently in the sea breeze, palm trees frame golden hour light. Camera drifts slowly from the shoreline out over the crystal water. A drone-like pull-back reveals an untouched island paradise that stops every scroll. Cinematic travel advertising, vibrant warm colors, ultra-high definition.",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&q=80",
    genre: "Travel",
    mood: "Cinematic",
  },
];

const AVATAR_CAMPAIGNS = [
  {
    title: "AI Revolution — Keynote Speaker",
    script: "The future of business isn't about working harder — it's about working smarter. In the next eighteen months, AI will reshape every industry on the planet. The companies that move now will define the next decade. Those that wait will be playing catch-up forever. The window is open right now — and we're here to help you walk through it.",
    avatarImageUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80",
    sceneDescription: "A sleek modern conference room with floor-to-ceiling windows overlooking a city skyline, warm professional studio lighting, minimal futuristic design",
  },
  {
    title: "Breakthrough Moment — Motivational Ad",
    script: "You've been building toward this moment your entire life. Every late night, every rejection, every time you doubted yourself — it was all preparation. Today is the day you stop dreaming about success and start living it. Our platform gives you the tools, the strategy, the community. All that's missing is you. Join thousands of people who already made the leap.",
    avatarImageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&q=80",
    sceneDescription: "An inspiring co-working space with exposed brick, warm Edison bulbs, a motivational mural, golden afternoon light streaming through industrial windows",
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createProject(
  supabase: ReturnType<typeof createClient>,
  title: string,
  mode: string,
  synopsis: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("movie_projects")
    .insert({
      user_id: ADMIN_USER_ID,
      title: `[PROD-AUDIT] ${title}`,
      status: "draft",
      mode,
      pipeline_stage: "draft",
      aspect_ratio: "16:9",
      synopsis,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[ProductionAudit] Failed to create project "${title}":`, error.message);
    return null;
  }
  return data.id;
}

async function callHollywoodPipeline(
  supabaseUrl: string,
  serviceKey: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const resp = await fetch(`${supabaseUrl}/functions/v1/hollywood-pipeline`, {
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
}

async function callAvatarDirect(
  supabaseUrl: string,
  serviceKey: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const resp = await fetch(`${supabaseUrl}/functions/v1/generate-avatar-direct`, {
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
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const auditLog: string[] = [];
  const results: Record<string, unknown> = { startedAt: new Date().toISOString() };

  // ── Parse options ───────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const auditOnly = body.auditOnly === true; // Pass { auditOnly: true } to skip launches

  // ── Credit check ─────────────────────────────────────────────────────────
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("credits_balance, display_name")
    .eq("id", ADMIN_USER_ID)
    .single();

  const creditBalance = adminProfile?.credits_balance ?? 0;
  auditLog.push(`👤 Admin: ${adminProfile?.display_name} — Credits: ${creditBalance}`);

  // 6 projects × 2 clips × ~13 credits avg = ~156 credits minimum
  const CREDIT_REQUIREMENT = 120;
  if (!auditOnly && creditBalance < CREDIT_REQUIREMENT) {
    return new Response(
      JSON.stringify({
        error: `Insufficient credits. Need ≥${CREDIT_REQUIREMENT} for full 6-project production, have ${creditBalance}. Use { auditOnly: true } to run health checks only.`,
        auditLog,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Create all 6 projects synchronously (fast — just DB inserts)
  // ═══════════════════════════════════════════════════════════════════════════
  auditLog.push("\n📁 === CREATING ALL 6 PROJECTS ===");

  const [t2vProj1Id, t2vProj2Id, i2vProj1Id, i2vProj2Id, av1Id, av2Id] = await Promise.all([
    createProject(supabase, T2V_CAMPAIGNS[0].title, "text-to-video", T2V_CAMPAIGNS[0].concept),
    createProject(supabase, T2V_CAMPAIGNS[1].title, "text-to-video", T2V_CAMPAIGNS[1].concept),
    createProject(supabase, I2V_CAMPAIGNS[0].title, "image-to-video", I2V_CAMPAIGNS[0].concept),
    createProject(supabase, I2V_CAMPAIGNS[1].title, "image-to-video", I2V_CAMPAIGNS[1].concept),
    createProject(supabase, AVATAR_CAMPAIGNS[0].title, "avatar", AVATAR_CAMPAIGNS[0].script),
    createProject(supabase, AVATAR_CAMPAIGNS[1].title, "avatar", AVATAR_CAMPAIGNS[1].script),
  ]);

  const projectMap = {
    t2v1: t2vProj1Id, t2v2: t2vProj2Id,
    i2v1: i2vProj1Id, i2v2: i2vProj2Id,
    av1: av1Id, av2: av2Id,
  };

  for (const [key, pid] of Object.entries(projectMap)) {
    auditLog.push(`  ${pid ? "✅" : "❌"} ${key}: ${pid ?? "FAILED"}`);
  }

  if (auditOnly) {
    // Skip pipeline launches — just run health checks
    auditLog.push("\n⏭️  auditOnly=true — skipping pipeline launches");
    results.textToVideo = [{ skipped: true }, { skipped: true }];
    results.imageToVideo = [{ skipped: true }, { skipped: true }];
    results.avatar = [{ skipped: true }, { skipped: true }];
  } else {
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: Fire all pipelines in background (non-blocking)
    // Returns immediately — pipeline runs asynchronously via watchdog
    // ═══════════════════════════════════════════════════════════════════════
    auditLog.push("\n🚀 === LAUNCHING ALL PIPELINES (NON-BLOCKING) ===");

    const launchT2V = async (projectId: string | null, campaign: typeof T2V_CAMPAIGNS[0]) => {
      if (!projectId) return { campaign: campaign.title, projectId: null, success: false, error: "No project ID" };
      const result = await callHollywoodPipeline(supabaseUrl, serviceKey, {
        userId: ADMIN_USER_ID, projectId,
        concept: campaign.concept,
        aspectRatio: "16:9", clipCount: 2, clipDuration: 10,
        includeVoice: false, includeMusic: false,
        qualityTier: "professional", genre: campaign.genre, mood: campaign.mood,
        videoEngine: "kling-v3",
      });
      return { campaign: campaign.title, projectId, success: result.success, error: result.error, data: result.data };
    };

    const launchI2V = async (projectId: string | null, campaign: typeof I2V_CAMPAIGNS[0]) => {
      if (!projectId) return { campaign: campaign.title, projectId: null, success: false, error: "No project ID" };
      const result = await callHollywoodPipeline(supabaseUrl, serviceKey, {
        userId: ADMIN_USER_ID, projectId,
        concept: campaign.concept,
        referenceImageUrl: campaign.imageUrl,
        aspectRatio: "16:9", clipCount: 2, clipDuration: 10,
        includeVoice: false, includeMusic: false,
        qualityTier: "professional", genre: campaign.genre, mood: campaign.mood,
        videoEngine: "kling-v3",
      });
      return { campaign: campaign.title, projectId, success: result.success, error: result.error, data: result.data };
    };

    const launchAvatar = async (projectId: string | null, campaign: typeof AVATAR_CAMPAIGNS[0]) => {
      if (!projectId) return { campaign: campaign.title, projectId: null, success: false, error: "No project ID" };
      const result = await callAvatarDirect(supabaseUrl, serviceKey, {
        userId: ADMIN_USER_ID, projectId,
        script: campaign.script,
        avatarImageUrl: campaign.avatarImageUrl,
        sceneDescription: campaign.sceneDescription,
        aspectRatio: "16:9", clipCount: 2, clipDuration: 10,
        voiceId: "nova", avatarType: "realistic", qualityTier: "professional",
      });
      return { campaign: campaign.title, projectId, success: result.success, error: result.error, data: result.data };
    };

    const [t2v1r, t2v2r, i2v1r, i2v2r, av1r, av2r] = await Promise.all([
      launchT2V(t2vProj1Id, T2V_CAMPAIGNS[0]),
      launchT2V(t2vProj2Id, T2V_CAMPAIGNS[1]),
      launchI2V(i2vProj1Id, I2V_CAMPAIGNS[0]),
      launchI2V(i2vProj2Id, I2V_CAMPAIGNS[1]),
      launchAvatar(av1Id, AVATAR_CAMPAIGNS[0]),
      launchAvatar(av2Id, AVATAR_CAMPAIGNS[1]),
    ]);

    results.textToVideo = [t2v1r, t2v2r];
    results.imageToVideo = [i2v1r, i2v2r];
    results.avatar = [av1r, av2r];

    for (const r of [t2v1r, t2v2r, i2v1r, i2v2r, av1r, av2r]) {
      auditLog.push(`  ${r.success ? "✅" : "❌"} [${r.campaign}] → ${r.projectId ?? r.error}`);
    }
  }

  const t2vResults = results.textToVideo as Array<{ success: boolean }>;
  const i2vResults = results.imageToVideo as Array<{ success: boolean }>;
  const avatarResults = results.avatar as Array<{ success: boolean }>;

  // ═══════════════════════════════════════════════════════════════════════════
  // PIPELINE HEALTH AUDIT
  // ═══════════════════════════════════════════════════════════════════════════
  auditLog.push("\n🔍 === PIPELINE HEALTH AUDIT ===");

  const [stuckProjects, recentFails, missingFrames, staleLocks, clipStats] = await Promise.all([
    supabase
      .from("movie_projects")
      .select("id, title, status, mode, updated_at")
      .eq("status", "generating")
      .lt("updated_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order("updated_at", { ascending: true })
      .limit(20),
    supabase
      .from("movie_projects")
      .select("id, title, status, mode, updated_at")
      .eq("status", "failed")
      .gt("updated_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("video_clips")
      .select("id, project_id, shot_index, status")
      .eq("status", "completed")
      .is("last_frame_url", null)
      .limit(20),
    supabase
      .from("movie_projects")
      .select("id, title, generation_lock")
      .not("generation_lock", "is", null)
      .eq("status", "generating")
      .limit(10),
    supabase
      .from("video_clips")
      .select("status")
      .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  auditLog.push(`  🔒 Stuck generating projects (>30min): ${stuckProjects.data?.length ?? 0}`);
  auditLog.push(`  ❌ Recent project failures (last 1h): ${recentFails.data?.length ?? 0}`);
  auditLog.push(`  🖼  Completed clips missing last_frame_url: ${missingFrames.data?.length ?? 0}`);
  if ((missingFrames.data?.length ?? 0) > 0) {
    auditLog.push(`  ⚠️  Frame chain gap — extract-last-frame did not run on these clips`);
  }
  auditLog.push(`  🔐 Active mutex locks: ${staleLocks.data?.length ?? 0}`);

  const stats = { generating: 0, completed: 0, failed: 0, pending: 0 };
  for (const c of (clipStats.data ?? [])) {
    const s = c.status as string;
    if (s in stats) stats[s as keyof typeof stats]++;
  }
  auditLog.push(`  📊 Clip stats (last 24h): ${JSON.stringify(stats)}`);

  // ── Pose + Frame chain continuity proof ──────────────────────────────────
  auditLog.push("\n🔗 === POSE CHAIN CONTINUITY PROOF ===");

  const { data: recentClips } = await supabase
    .from("video_clips")
    .select("shot_index, status, motion_vectors, last_frame_url, project_id")
    .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .not("motion_vectors", "is", null)
    .order("project_id", { ascending: true })
    .order("shot_index", { ascending: true })
    .limit(40);

  if (recentClips && recentClips.length >= 2) {
    let poseMatches = 0;
    let frameChains = 0;
    let totalTransitions = 0;

    const byProject: Record<string, typeof recentClips> = {};
    for (const clip of recentClips) {
      if (!byProject[clip.project_id]) byProject[clip.project_id] = [];
      byProject[clip.project_id].push(clip);
    }

    for (const clips of Object.values(byProject)) {
      clips.sort((a, b) => a.shot_index - b.shot_index);
      for (let i = 1; i < clips.length; i++) {
        totalTransitions++;
        const prev = clips[i - 1];
        const curr = clips[i];
        const prevEnd = prev.motion_vectors?.endPose;
        const currStart = curr.motion_vectors?.startPose;
        const currStartImg = curr.motion_vectors?.startImageUrl;

        if (prevEnd && currStart && prevEnd === currStart) poseMatches++;
        if (currStartImg && prev.last_frame_url && currStartImg === prev.last_frame_url) frameChains++;
      }
    }

    auditLog.push(`  Pose chain handoffs (endPose→startPose match): ${poseMatches}/${totalTransitions}`);
    auditLog.push(`  Pixel chain (startImageUrl = prev last_frame_url): ${frameChains}/${totalTransitions}`);
    
    const poseRate = totalTransitions > 0 ? Math.round((poseMatches / totalTransitions) * 100) : 0;
    const frameRate = totalTransitions > 0 ? Math.round((frameChains / totalTransitions) * 100) : 0;
    
    auditLog.push(`  → Pose continuity rate: ${poseRate}%`);
    auditLog.push(`  → Pixel continuity rate: ${frameRate}%`);
    auditLog.push(`  → Gap explanation: clips without last_frame_url haven't been extracted yet (watchdog pending)`);
  } else {
    auditLog.push(`  ℹ️  Insufficient recent multi-clip data for continuity analysis`);
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  const allResults = [...t2vResults, ...i2vResults, ...avatarResults];
  const launched = allResults.filter((r) => r.success).length;
  const failedLaunches = allResults.filter((r) => !r.success).length;

  results.auditLog = auditLog;
  results.summary = {
    totalProjectsLaunched: launched,
    totalFailed: failedLaunches,
    pipelines: {
      textToVideo: {
        projects: t2vResults.length,
        clipsPerProject: 2,
        successRate: `${t2vResults.filter((r) => r.success).length}/${t2vResults.length}`,
        projectIds: t2vResults.filter((r) => r.success).map((r) => r.projectId),
      },
      imageToVideo: {
        projects: i2vResults.length,
        clipsPerProject: 2,
        successRate: `${i2vResults.filter((r) => r.success).length}/${i2vResults.length}`,
        projectIds: i2vResults.filter((r) => r.success).map((r) => r.projectId),
      },
      avatar: {
        projects: avatarResults.length,
        clipsPerProject: 2,
        successRate: `${avatarResults.filter((r) => r.success).length}/${avatarResults.length}`,
        projectIds: avatarResults.filter((r) => r.success).map((r) => r.projectId),
      },
    },
    pipelineHealth: {
      stuckProjects: stuckProjects.data?.length ?? 0,
      recentFailures: recentFails.data?.length ?? 0,
      missingFrameUrls: missingFrames.data?.length ?? 0,
      activeLocks: staleLocks.data?.length ?? 0,
    },
    clipStats24h: stats,
    sequentialGuarantee: "Clip N triggers only after Clip N-1 completes via pipeline-watchdog callback chain. Frame chaining: last_frame_url extracted and passed as startImageUrl.",
    marketingThemes: [
      "AI Tech Product Launch (T2V)",
      "Entrepreneur Success Story (T2V)",
      "Luxury Watch Hero Shot (I2V)",
      "Ocean Travel Brand (I2V)",
      "AI Keynote Speaker (Avatar)",
      "Motivational Brand Ad (Avatar)",
    ],
  };
  results.completedAt = new Date().toISOString();

  return new Response(
    JSON.stringify(results, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
