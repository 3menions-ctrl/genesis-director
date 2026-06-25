/**
 * process-ai-video-replies — worker that picks AI-reply jobs off the queue,
 * generates a stylized short video via the Studio engine, then delivers
 * the result as a direct message from the sender to the recipient.
 *
 * Designed to run on a cron (every minute) OR be invoked on-demand
 * (e.g. immediately after a job is enqueued, for low latency).
 *
 * Algorithm — two phases per invocation:
 *
 *   PHASE A. Pick up `queued` jobs (limit 5)
 *     - Create a single-clip movie_project on the sender's account
 *     - Submit it to mode-router with the user's default engine
 *     - Mark the job `generating` and stamp the project_id into job.error
 *       (we reuse the column as a generic "external_ref" until the result
 *       arrives — keeps the schema small)
 *
 *   PHASE B. Pick up `generating` jobs whose underlying project is done
 *     - Find the final video URL from final_videos
 *     - Send a direct_message with ai_video_url = that URL
 *     - Mark job `ready`, stamp message_id
 *
 * Failure modes are handled idempotently — if the worker dies between
 * phases the next invocation simply picks up where it left off.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCronSecret } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Job {
  id: string;
  sender_id: string;
  recipient_id: string;
  prompt: string;
  tone: string;
  status: "queued" | "generating" | "ready" | "failed" | "cancelled";
  engine: string;
  video_url: string | null;
  error: string | null;
  message_id: string | null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function toneSuffix(tone: string): string {
  switch (tone) {
    case "playful":   return "Playful, warm tone. Sun-flare lens. Confetti drift.";
    case "cinematic": return "Slow cinematic dolly. Anamorphic flare. Moody golden-hour lighting.";
    case "brief":     return "Simple medium shot. Soft natural light. Single subject.";
    case "warm":
    default:          return "Warm, intimate close-up. Soft window light. Single subject.";
  }
}

async function pickUpQueued(supabase: any): Promise<number> {
  const { data: jobs } = await supabase
    .from("ai_video_reply_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(5);

  if (!jobs || jobs.length === 0) return 0;

  let started = 0;
  for (const job of jobs as Job[]) {
    try {
      // 1. Create a movie_project on the SENDER's account.
      const tonePrompt = `${job.prompt}\n\n${toneSuffix(job.tone)}`;
      const { data: project, error: projectErr } = await supabase
        .from("movie_projects")
        .insert({
          user_id:           job.sender_id,
          title:             `AI reply · ${new Date().toISOString().slice(0, 10)}`,
          prompt:            tonePrompt,
          genre:             "personal",
          mood:              job.tone,
          video_engine:      job.engine,
          clip_count:        1,
          clip_duration:     5,
          status:            "queued",
          is_ai_reply:       true,
          ai_reply_job_id:   job.id,
        })
        .select("id")
        .single();

      if (projectErr || !project) {
        console.error("[ai-reply] project insert failed", { jobId: job.id, error: projectErr });
        await supabase.from("ai_video_reply_jobs")
          .update({ status: "failed", error: projectErr?.message ?? "project_insert_failed", updated_at: new Date().toISOString() })
          .eq("id", job.id);
        continue;
      }

      // 2. Submit to mode-router so the user's existing pipeline handles it.
      const routerRes = await fetch(`${SUPABASE_URL}/functions/v1/mode-router`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          projectId:   project.id,
          mode:        "text-to-video",
          videoEngine: job.engine,
          prompt:      tonePrompt,
          clipCount:   1,
          clipDuration: 5,
          aspectRatio: "9:16",
          enableNarration: false,
          enableMusic: false,
          // Mark the request so downstream handlers know this is an AI reply.
          aiReplyJobId: job.id,
        }),
      });

      if (!routerRes.ok) {
        const body = await routerRes.text();
        console.error("[ai-reply] mode-router failed", { jobId: job.id, status: routerRes.status, body });
        await supabase.from("ai_video_reply_jobs")
          .update({ status: "failed", error: `mode_router_${routerRes.status}`, updated_at: new Date().toISOString() })
          .eq("id", job.id);
        continue;
      }

      // 3. Mark generating + stash the project_id in the error field
      //    (until the migration adds a project_id column proper).
      await supabase.from("ai_video_reply_jobs")
        .update({ status: "generating", error: `project:${project.id}`, updated_at: new Date().toISOString() })
        .eq("id", job.id);
      started++;
    } catch (e) {
      console.error("[ai-reply] phase A unexpected error", { jobId: job.id, error: String(e) });
      await supabase.from("ai_video_reply_jobs")
        .update({ status: "failed", error: String(e), updated_at: new Date().toISOString() })
        .eq("id", job.id);
    }
  }
  return started;
}

async function deliverReady(supabase: any): Promise<number> {
  const { data: jobs } = await supabase
    .from("ai_video_reply_jobs")
    .select("*")
    .eq("status", "generating")
    .limit(10);
  if (!jobs || jobs.length === 0) return 0;

  let delivered = 0;
  for (const job of jobs as Job[]) {
    const projectId = (job.error ?? "").startsWith("project:") ? job.error!.slice("project:".length) : null;
    if (!projectId) continue;

    // Look up the project's status + final video URL.
    const { data: project } = await supabase
      .from("movie_projects")
      .select("id, status, final_video_url")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) continue;

    if (project.status === "failed" || project.status === "cancelled") {
      await supabase.from("ai_video_reply_jobs")
        .update({ status: "failed", error: `project_${project.status}`, updated_at: new Date().toISOString() })
        .eq("id", job.id);
      continue;
    }
    if (project.status !== "completed" || !project.final_video_url) continue;

    // 1. Send a DM via the existing RPC — but as the SENDER. Use service
    //    role to bypass auth.uid() and insert directly with the AI video.
    const { data: msg, error: msgErr } = await supabase
      .from("direct_messages")
      .insert({
        sender_id:    job.sender_id,
        recipient_id: job.recipient_id,
        content:      `🎬 AI reply (${job.tone})`,
        ai_video_url: project.final_video_url,
      })
      .select("id")
      .single();
    if (msgErr || !msg) {
      console.error("[ai-reply] DM insert failed", { jobId: job.id, error: msgErr });
      continue;
    }

    // 2. Notify the recipient.
    await supabase.from("notifications").insert({
      user_id: job.recipient_id,
      type:    "message",
      title:   "New AI video reply",
      body:    `From ${job.sender_id.slice(0, 8)} · ${job.tone}`,
      data:    { sender_id: job.sender_id, message_id: msg.id, ai_reply: true },
    });

    // 3. Mark the job ready.
    await supabase.from("ai_video_reply_jobs")
      .update({
        status: "ready",
        video_url: project.final_video_url,
        message_id: msg.id,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    delivered++;
  }
  return delivered;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // AUDIT FIX L-19: this internal cron worker (service-role queue processing)
  // had no trust boundary, so it could be invocation-flooded. Require the cron
  // secret or a service-role bearer (cron jobs set x-cron-secret; on-demand
  // server triggers use the service-role key).
  if (!requireCronSecret(req)) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const started   = await pickUpQueued(supabase);
    const delivered = await deliverReady(supabase);
    return new Response(JSON.stringify({ ok: true, started, delivered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ai-reply] fatal", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
