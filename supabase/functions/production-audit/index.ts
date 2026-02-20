/**
 * PRODUCTION AUDIT — LEAN SINGLE-VIDEO PIPELINE TRIGGER
 *
 * Creates a project directly in DB and fires generate-single-clip
 * with skipPolling=true + triggerNextClip=true.
 * Bypasses heavyweight screenplay/identity stages that cause
 * EdgeRuntime.waitUntil() wall-clock timeouts (~60s).
 *
 * The pipeline-watchdog handles:
 *   ✅ Polling Replicate for completion
 *   ✅ Frame extraction → startImageUrl for clip N+1
 *   ✅ Triggering continue-production for subsequent clips
 *   ✅ Final stitching when all clips complete
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
    prompts: [
      "A sleek futuristic product launch event inside a glowing white auditorium. Thousands of silhouetted audience members watch as a holographic AI assistant materializes on stage, radiating blue light. Cinematic wide shot, 4K quality, dramatic lens flares, aspirational brand reveal.",
      "Close-up of the audience reacting with awe, faces lit by the holographic glow. Camera pulls back to reveal the holographic AI raising its hand as the auditorium erupts in applause. Golden light washes the room. Cinematic, high-energy, triumphant climax.",
    ],
  },
  {
    title: "Limitless Hustle — Entrepreneur Story",
    prompts: [
      "Dawn breaks over a modern skyline. A driven entrepreneur stands at floor-to-ceiling windows, coffee in hand, city awakening below. Golden hour light streams in. Cinematic establishing shot with lens flare, documentary style, motivated energy.",
      "Bold montage: the entrepreneur typing on a sleek laptop, shaking hands in a boardroom, watching a climbing analytics dashboard with a confident smile. Fast cuts with smooth transitions, motivational advertising energy.",
    ],
  },
];

const I2V_CAMPAIGNS = [
  {
    title: "Luxury Unveiled — Watch Hero Shot",
    imageUrl: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=1280&q=80",
    prompts: [
      "A premium luxury watch rests on black polished marble, lit by a single dramatic spotlight. The watch face glows as camera slowly pushes in revealing micro-details of the dial, sapphire crystal refracting light. Photorealistic luxury advertising, 4K.",
      "Extreme close-up of the watch hands ticking, reflecting prismatic light. Camera slowly orbits the timepiece revealing its profile. Black background, single key light, luxury commercial cinematography.",
    ],
  },
  {
    title: "Ocean Escape — Travel Brand",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&q=80",
    prompts: [
      "Pristine turquoise ocean water laps gently against white sand. A hammock sways between two palm trees. Golden hour light bathes the scene. Camera drifts slowly from the shoreline. Cinematic travel advertising, vibrant warm colors.",
      "Camera rises above the crystal-clear water, revealing a coral reef below the surface. Sunlight dances through the waves. Aerial cinematic travel shot, warm color grading, paradise vibes.",
    ],
  },
];

const AVATAR_CAMPAIGNS = [
  {
    title: "AI Revolution — Keynote Speaker",
    prompts: [
      "A confident professional woman speaks directly to camera in a sleek modern conference room with floor-to-ceiling windows overlooking a city skyline. Warm studio lighting, professional keynote atmosphere, eye contact with camera.",
      "Same woman continues her keynote, gesturing passionately. Behind her a large screen shows futuristic AI visualizations. Camera slowly pushes in. Professional business video, warm lighting.",
    ],
  },
  {
    title: "Breakthrough Moment — Motivational Ad",
    prompts: [
      "A charismatic man in a sharp suit speaks to camera in an inspiring co-working space with exposed brick and warm Edison bulbs. Golden afternoon light streams through industrial windows. Motivational advertisement.",
      "Same man walks through the co-working space, camera tracking. He stops at a window, looks out at the city, then turns back to camera with a confident nod. Golden warm light, cinematic.",
    ],
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function callFunction(
  supabaseUrl: string,
  serviceKey: string,
  functionName: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string; data?: any }> {
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

  const mode = (body.mode as string) || "t2v";
  const campaignIndex = typeof body.campaignIndex === "number" ? body.campaignIndex : 0;
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
  } else {
    // Select campaign
    let campaign: { title: string; prompts: string[]; imageUrl?: string };
    if (mode === "i2v") {
      const c = I2V_CAMPAIGNS[campaignIndex % I2V_CAMPAIGNS.length];
      campaign = { title: c.title, prompts: c.prompts.slice(0, clipCount), imageUrl: c.imageUrl };
    } else if (mode === "avatar") {
      const c = AVATAR_CAMPAIGNS[campaignIndex % AVATAR_CAMPAIGNS.length];
      campaign = { title: c.title, prompts: c.prompts.slice(0, clipCount) };
    } else {
      const c = T2V_CAMPAIGNS[campaignIndex % T2V_CAMPAIGNS.length];
      campaign = { title: c.title, prompts: c.prompts.slice(0, clipCount) };
    }

    log.push(`\n🚀 Launching ${mode.toUpperCase()}: "${campaign.title}" (${clipCount} clips)`);

    // Step 1: Create project directly in DB
    const projectTitle = `AUDIT-${campaign.title}`;
    const { data: project, error: projectError } = await supabase
      .from("movie_projects")
      .insert({
        user_id: ADMIN_USER_ID,
        title: projectTitle,
        status: "generating",
        mode: mode === "i2v" ? "image-to-video" : mode === "avatar" ? "avatar" : "text-to-video",
        aspect_ratio: "16:9",
        quality_tier: "standard",
        generated_script: JSON.stringify({
          shots: campaign.prompts.map((p, i) => ({
            id: `clip_${String(i + 1).padStart(2, "0")}`,
            title: `Shot ${i + 1}`,
            description: p,
          })),
        }),
        pending_video_tasks: {
          stage: "production",
          progress: 50,
          startedAt: new Date().toISOString(),
          clipCount: campaign.prompts.length,
          clipDuration: 10,
        },
      })
      .select("id")
      .single();

    if (projectError || !project) {
      log.push(`  ❌ Project creation failed: ${projectError?.message}`);
      results.launch = { campaign: campaign.title, success: false, error: projectError?.message };
    } else {
      log.push(`  ✅ Project created: ${project.id}`);

      // Step 2: Fire clip 0 via generate-single-clip with skipPolling + triggerNextClip
      const clipResult = await callFunction(supabaseUrl, serviceKey, "generate-single-clip", {
        userId: ADMIN_USER_ID,
        projectId: project.id,
        videoEngine: "kling",
        clipIndex: 0,
        prompt: campaign.prompts[0],
        totalClips: campaign.prompts.length,
        startImageUrl: campaign.imageUrl || undefined,
        durationSeconds: 10,
        aspectRatio: "16:9",
        qualityTier: "standard",
        skipPolling: true,
        triggerNextClip: true,
        pipelineContext: {
          videoEngine: "kling",
          referenceImageUrl: campaign.imageUrl || undefined,
          qualityTier: "standard",
          aspectRatio: "16:9",
          clipDuration: 10,
          tierLimits: { maxRetries: 1 },
        },
      });

      results.launch = {
        campaign: campaign.title,
        projectId: project.id,
        clipResult: clipResult.success ? "Clip 0 dispatched — watchdog will poll & chain" : clipResult.error,
        success: clipResult.success,
      };
      log.push(`  ${clipResult.success ? "✅" : "❌"} ${clipResult.success ? "Clip 0 dispatched to Replicate — watchdog takes over" : clipResult.error}`);
    }
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
