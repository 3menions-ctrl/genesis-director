/**
 * brand-video-download — prepends the Small Bridges intro to any user
 * video before download.
 *
 * Flow:
 *   1. Client POSTs `{ videoUrl, projectId, userId }`.
 *   2. We resolve `intro.mp4` from the public `brand-assets` bucket.
 *   3. Stream the intro + the source video into a fresh MP4 via
 *      ffmpeg's `concat` demuxer (no re-encoding needed when the source
 *      MP4 uses the same codec / SAR as the intro).
 *   4. Upload the branded result to the `branded-downloads` bucket.
 *   5. Return a short-lived signed URL the client uses to trigger the
 *      browser download.
 *
 * ────────────────────────────────────────────────────────────────────
 *  IMPLEMENTATION NOTE
 *
 *  Supabase Edge Functions run on Deno Deploy with no native ffmpeg, so the
 *  intro-prepend is delegated to seamless-stitcher (clips mode,
 *  includeIntro:true), which runs the real ffmpeg concat on a Replicate cog and
 *  returns a stored MP4. This function just authenticates, delegates, and
 *  returns a durable URL (falling back to the un-branded source on failure).
 *
 *  Prerequisite assets (one-time setup):
 *    • Upload `intro.mp4` (a pre-rendered ~7.5s 1080p version of the
 *      StudioIntro) to bucket `brand-assets` at path `intro/intro.mp4`.
 *      Use the companion script `scripts/record-intro-mp4.ts` or any
 *      headless-browser capture tool.
 *    • Create bucket `branded-downloads` (private, 24h signed URLs).
 *
 * ────────────────────────────────────────────────────────────────────
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  validateAuth,
  unauthorizedResponse,
  resolveEffectiveUserId,
  forbiddenResponse,
} from "../_shared/auth-guard.ts";
import { runFfmpegCog, watermarkCommand } from "../_shared/run-ffmpeg-cog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTRO_BUCKET = "brand-assets";
const INTRO_PATH = "intro/intro.mp4";
const OUTPUT_BUCKET = "branded-downloads";
const SIGNED_URL_TTL = 60 * 60 * 24; // 24 hours

interface Request {
  videoUrl: string;
  projectId?: string;
  userId?: string;
}

/**
 * SSRF guard. The source video must come from our own Supabase storage
 * or a known render-output CDN — never an arbitrary host (which the
 * service-role fetch could otherwise use to reach internal/metadata
 * endpoints). https only.
 */
function isAllowedSourceUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  let supabaseHost = "";
  try { supabaseHost = new URL(Deno.env.get("SUPABASE_URL")!).host; } catch { /* noop */ }
  const allowedHosts = new Set([supabaseHost].filter(Boolean));
  const allowedSuffixes = [".replicate.delivery", ".supabase.co", ".supabase.in"];
  if (allowedHosts.has(u.host)) return true;
  return allowedSuffixes.some((s) => u.host === s.slice(1) || u.host.endsWith(s));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    // Authenticate first — this function runs with the service role and
    // fetches a caller-supplied URL, so it must never be anonymous.
    const auth = await validateAuth(req);
    if (!auth.authenticated) return unauthorizedResponse(corsHeaders);

    const { videoUrl, projectId, userId: bodyUserId } = (await req.json()) as Request;
    if (!videoUrl || !videoUrl.startsWith("http")) {
      throw new Error("videoUrl required");
    }
    if (!isAllowedSourceUrl(videoUrl)) {
      return forbiddenResponse(corsHeaders, "videoUrl host not allowed");
    }

    // Effective user id comes from the JWT, never the body (end users
    // cannot brand a download into someone else's storage path).
    let userId: string;
    try {
      userId = resolveEffectiveUserId(auth, bodyUserId);
    } catch (e) {
      return forbiddenResponse(corsHeaders, e instanceof Error ? e.message : "Forbidden");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Apply the "Made with Small Bridges" corner watermark via a ONE-OFF ffmpeg
    // pass on the cog (runFfmpegCog) — deliberately isolated from the
    // render-critical seamless-stitcher so branding can never regress renders.
    // Fail safe to the un-branded source: a valid download beats none.
    let brandedUrl: string | null;
    try {
      brandedUrl = await runFfmpegCog({
        replicateKey: Deno.env.get("REPLICATE_API_KEY")!,
        command: watermarkCommand(),
        inputs: { file1: videoUrl },
        outputName: `branded-${projectId ?? userId}-${Date.now()}.mp4`,
      });
    } catch (e) {
      console.warn(
        "[brand-video-download] watermark failed, returning source url:",
        e instanceof Error ? e.message : String(e),
      );
      return ok({ url: videoUrl, branded: false, reason: "watermark_failed" });
    }
    if (!brandedUrl) {
      return ok({ url: videoUrl, branded: false, reason: "no_output" });
    }

    // P0-1: the stitcher returns a 24h signed URL — persist it durably.
    const { persistVideoToStorage, isTemporaryReplicateUrl } = await import(
      "../_shared/video-persistence.ts"
    );
    if (isTemporaryReplicateUrl(brandedUrl)) {
      const persisted = await persistVideoToStorage(
        supabase as unknown as Parameters<typeof persistVideoToStorage>[0],
        brandedUrl,
        projectId ?? userId,
        { prefix: "branded" },
      );
      if (persisted) brandedUrl = persisted;
    }

    return ok({ url: brandedUrl, branded: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("[brand-video-download] failed:", msg);
    return ko({ error: msg });
  }
});

function ok(body: unknown): Response {
  return new Response(JSON.stringify({ ok: true, ...(body as object) }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function ko(body: unknown): Response {
  return new Response(JSON.stringify({ ok: false, ...(body as object) }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
