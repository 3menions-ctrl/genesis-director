import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";
import { seamScore, rgbaToGray } from "../_shared/seam-ssim.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * VALIDATE SEAM CONTINUITY — the true seam metric.
 *
 * Given two frame URLs (clip N's LAST frame and clip N+1's FIRST
 * frame), measure how well the cut matches: downscale both to a small
 * grayscale, compute global SSIM + an exposure-shift penalty, return a
 * 0..100 score. This is the `boundary` dimension the continuity gate
 * needs for CONTINUOUS cuts — a signal the rest of the validation stack
 * never measured. No model; cheap and deterministic.
 */

const SIZE = 48; // downscale target — enough structure, fast

interface SeamRequest {
  frameAUrl: string; // previous clip's last frame
  frameBUrl: string; // this clip's first frame
  projectId?: string;
  clipIndex?: number;
}

async function loadGray(url: string): Promise<Float64Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const img = await Image.decode(buf);
    img.resize(SIZE, SIZE);
    // ImageScript bitmap is RGBA bytes.
    return rgbaToGray(img.bitmap);
  } catch (_e) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as SeamRequest;
    if (!body?.frameAUrl || !body?.frameBUrl) {
      return json({ success: false, error: "frameAUrl and frameBUrl are required" }, 400);
    }

    const [a, b] = await Promise.all([loadGray(body.frameAUrl), loadGray(body.frameBUrl)]);
    if (!a || !b) {
      // Couldn't measure — return null so the gate treats `boundary` as
      // unmeasured rather than a false zero.
      return json({ success: false, score: null, error: "frame decode failed" });
    }

    const score = seamScore(a, b);
    return json({ success: true, score, projectId: body.projectId, clipIndex: body.clipIndex });
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "seam validation failed" }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
