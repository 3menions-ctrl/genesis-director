/**
 * svg-rasterize — turn a list of SVG strings into PNGs and upload them
 * to the temp-overlays bucket. seamless-stitcher calls this once per
 * render to materialize text-overlay PNGs (and, in phase 3, bespoke
 * crossover-effect PNGs) that FFmpeg overlays onto the video at
 * runtime via `overlay=enable='between(t,a,b)'`.
 *
 * Why a dedicated worker:
 *   • Rasterization is heavy and orthogonal to the stitch chain
 *     assembly. Isolating it keeps the stitcher's hot path lean.
 *   • Resvg-wasm has a ~3MB initialization payload; loading it inline
 *     in the stitcher would slow every cache-hit response too. Here it
 *     loads only when there's actual rasterize work.
 *
 * Contract:
 *   POST  { items: [{ id, svg, w, h }], namespaceId }
 *   ←     { ok: true, pngs: [{ id, publicUrl }] }
 *
 * The PNGs land in the `temp-overlays` bucket keyed by
 * `${namespaceId}/${id}.png`. Caller is responsible for purging.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "temp-overlays";

interface RasterItem {
  id: string;
  svg: string;
  /** Width in pixels — the SVG viewBox must match. */
  w: number;
  h: number;
}

interface Req {
  items: RasterItem[];
  /** Output key prefix — typically the project id. */
  namespaceId: string;
}

/** Resvg-wasm only needs to init once per cold start. */
let wasmReady: Promise<void> | null = null;
async function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    // Resvg ships a .wasm asset that the runtime fetches lazily.
    // Using a CDN URL keeps the function bundle small.
    wasmReady = initWasm(
      fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm"),
    );
  }
  await wasmReady;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Req;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new Error("items[] required");
    }
    if (!body.namespaceId) throw new Error("namespaceId required");

    await ensureWasm();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const out: Array<{ id: string; publicUrl: string }> = [];

    for (const item of body.items) {
      // Rasterize SVG → PNG via Resvg
      const resvg = new Resvg(item.svg, {
        fitTo: { mode: "width", value: item.w },
        background: "rgba(0,0,0,0)",
      });
      const pngBytes = resvg.render().asPng();

      // Upload — overwrite if it already exists (cache hits handled at
      // the seamless-stitcher level by content-hashing the SVG).
      const key = `${body.namespaceId}/${item.id}.png`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(key, pngBytes, {
          contentType: "image/png",
          upsert: true,
          cacheControl: "3600",
        });
      if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
      out.push({ id: item.id, publicUrl: pub.publicUrl });
    }

    return new Response(JSON.stringify({ ok: true, pngs: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
