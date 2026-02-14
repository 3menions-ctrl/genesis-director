import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Extract Video Frame v6.0
 * 
 * Uses lucataco/frame-extractor on Replicate (854K+ runs, $0.0001/run).
 * Fallbacks: reference images, then database recovery.
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const REPLICATE_MODEL_VERSION = "c02b3c1df64728476b1c21b0876235119e6ac08b0c9b8a99b82c5f0e0d42442d";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, projectId, shotId, position = 'last', referenceImageUrl } = await req.json();

    if (!videoUrl) throw new Error("videoUrl is required");

    console.log(`[ExtractFrame] Extracting ${position} frame from ${videoUrl.substring(0, 60)}...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    const ok = (frameUrl: string, method: string, retryCount = 0) =>
      new Response(JSON.stringify({ success: true, frameUrl, position: String(position), method, retryCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const downloadAndStore = async (frameUrl: string): Promise<string | null> => {
      try {
        const res = await fetch(frameUrl);
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        const filename = `${projectId}/frame-${shotId}-${position}-${Date.now()}.jpg`;
        const { error } = await supabase.storage.from('temp-frames')
          .upload(filename, new Uint8Array(data), { contentType: 'image/jpeg', upsert: true });
        if (error) return null;
        return supabase.storage.from('temp-frames').getPublicUrl(filename).data.publicUrl;
      } catch { return null; }
    };

    const isValidFrameUrl = (url: string | undefined): boolean => {
      if (!url) return false;
      const lower = url.toLowerCase();
      return !(lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') ||
        (lower.includes('/video-clips/') && !lower.includes('frame')));
    };

    // ============================================================
    // TIER 1: Replicate lucataco/frame-extractor
    // ============================================================
    if (REPLICATE_API_KEY) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) await sleep(2000);
          console.log(`[ExtractFrame] TIER 1: attempt ${attempt + 1}`);

          const returnFirst = position === 'first';
          const predRes = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              version: REPLICATE_MODEL_VERSION,
              input: { video: videoUrl, return_first_frame: returnFirst }
            }),
          });

          if (!predRes.ok) {
            const errText = await predRes.text();
            console.warn(`[ExtractFrame] Replicate ${predRes.status}: ${errText.substring(0, 100)}`);
            if (predRes.status === 404 || predRes.status === 422) break;
            continue;
          }

          const prediction = await predRes.json();
          const startTime = Date.now();

          while (Date.now() - startTime < 90000) {
            await sleep(2000);
            const sRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
              headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
            });
            if (!sRes.ok) continue;
            const s = await sRes.json();

            if (s.status === 'succeeded' && s.output) {
              const frameUrl = typeof s.output === 'string' ? s.output :
                Array.isArray(s.output) ? s.output[0] : null;
              if (frameUrl) {
                const stored = await downloadAndStore(frameUrl);
                console.log(`[ExtractFrame] ✅ TIER 1 SUCCESS`);
                return ok(stored || frameUrl, 'replicate-extract', attempt);
              }
              break;
            } else if (s.status === 'failed') {
              console.warn(`[ExtractFrame] Failed: ${s.error}`);
              break;
            }
          }
        } catch (err) {
          console.warn(`[ExtractFrame] Attempt ${attempt + 1} error:`, err);
        }
      }
      console.warn(`[ExtractFrame] TIER 1 exhausted`);
    }

    // TIER 2: Reference image
    if (referenceImageUrl && isValidFrameUrl(referenceImageUrl)) {
      console.log(`[ExtractFrame] ✅ TIER 2 (reference)`);
      return ok(referenceImageUrl, 'reference-fallback');
    }

    // TIER 3: Database recovery
    console.log(`[ExtractFrame] TIER 3: DB recovery`);
    try {
      const { data: proj } = await supabase
        .from('movie_projects').select('pro_features_data, scene_images')
        .eq('id', projectId).single();

      if (proj?.pro_features_data) {
        const pd = proj.pro_features_data as Record<string, any>;
        const urls = [pd.referenceAnalysis?.imageUrl, pd.goldenFrameData?.goldenFrameUrl,
          pd.identityBible?.originalReferenceUrl].filter(isValidFrameUrl);
        if (urls.length > 0) {
          console.log(`[ExtractFrame] ✅ TIER 3 (pro_features)`);
          return ok(urls[0], 'db-fallback');
        }
      }
      if (Array.isArray(proj?.scene_images)) {
        const img = (proj.scene_images as any[])[0];
        if (img?.imageUrl && isValidFrameUrl(img.imageUrl)) {
          console.log(`[ExtractFrame] ✅ TIER 3 (scene_images)`);
          return ok(img.imageUrl, 'db-fallback');
        }
      }
    } catch (e) { console.warn(`[ExtractFrame] DB error:`, e); }

    console.error(`[ExtractFrame] ❌ ALL TIERS FAILED`);
    return new Response(
      JSON.stringify({ success: false, method: 'failed', error: 'Frame extraction failed' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ExtractFrame] Fatal:", error);
    return new Response(
      JSON.stringify({ success: false, method: 'failed', error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
