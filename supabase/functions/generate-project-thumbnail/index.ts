import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generate Project Thumbnail v6.0
 * 
 * Extracts a frame from a project's video and saves it as the project's thumbnail.
 * Uses lucataco/frame-extractor on Replicate (854K+ runs, $0.0001/run).
 * Falls back to video_clips.last_frame_url from DB.
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const REPLICATE_MODEL_VERSION = "c02b3c1df64728476b1c21b0876235119e6ac08b0c9b8a99b82c5f0e0d42442d";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const { projectId, videoUrl } = await req.json();

    if (!projectId || !videoUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "projectId and videoUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GenerateThumbnail] Starting for project ${projectId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    // Check if project already has a thumbnail
    const { data: project } = await supabase
      .from('movie_projects')
      .select('thumbnail_url')
      .eq('id', projectId)
      .single();

    if (project?.thumbnail_url) {
      return new Response(
        JSON.stringify({ success: true, thumbnailUrl: project.thumbnail_url, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let thumbnailUrl: string | null = null;

    // Helper: download image and upload to thumbnails bucket
    const uploadToStorage = async (sourceUrl: string): Promise<string | null> => {
      try {
        const res = await fetch(sourceUrl);
        if (!res.ok) return null;
        const imageData = await res.arrayBuffer();
        const fileName = `thumb_${projectId}.jpg`;
        const { error } = await supabase.storage
          .from('thumbnails')
          .upload(fileName, new Uint8Array(imageData), { contentType: 'image/jpeg', upsert: true });
        if (error) return null;
        const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(fileName);
        return urlData.publicUrl;
      } catch { return null; }
    };

    // ============================================================
    // TIER 1: Replicate lucataco/frame-extractor
    // ============================================================
    if (REPLICATE_API_KEY) {
      try {
        console.log(`[GenerateThumbnail] TIER 1: Replicate frame-extractor`);
        
        const predictionRes = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: REPLICATE_MODEL_VERSION,
            input: { video: videoUrl, return_first_frame: true }
          }),
        });
        
        if (predictionRes.ok) {
          const prediction = await predictionRes.json();
          console.log(`[GenerateThumbnail] Prediction started: ${prediction.id}`);
          
          // Poll for completion (max 90 seconds)
          const startTime = Date.now();
          while (Date.now() - startTime < 90000) {
            await sleep(2000);
            const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
              headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
            });
            if (!statusRes.ok) continue;
            const status = await statusRes.json();
            
            if (status.status === 'succeeded' && status.output) {
              const frameUrl = typeof status.output === 'string' ? status.output : 
                Array.isArray(status.output) ? status.output[0] : null;
              if (frameUrl) {
                thumbnailUrl = await uploadToStorage(frameUrl);
                if (thumbnailUrl) console.log(`[GenerateThumbnail] ✅ TIER 1 SUCCESS`);
              }
              break;
            } else if (status.status === 'failed') {
              console.warn(`[GenerateThumbnail] Prediction failed: ${status.error}`);
              break;
            }
          }
        } else {
          const errText = await predictionRes.text();
          console.warn(`[GenerateThumbnail] Replicate error ${predictionRes.status}: ${errText.substring(0, 120)}`);
        }
      } catch (err) {
        console.warn(`[GenerateThumbnail] TIER 1 error:`, err);
      }
    }

    // ============================================================
    // TIER 2: Use last_frame_url from completed video clips
    // ============================================================
    if (!thumbnailUrl) {
      console.log(`[GenerateThumbnail] TIER 2: DB video_clips last_frame_url`);
      try {
        const { data: clips } = await supabase
          .from('video_clips')
          .select('last_frame_url')
          .eq('project_id', projectId)
          .eq('status', 'completed')
          .not('last_frame_url', 'is', null)
          .order('shot_index', { ascending: true })
          .limit(1);

        const frameUrl = clips?.[0]?.last_frame_url;
        if (frameUrl && typeof frameUrl === 'string' && frameUrl.startsWith('http')) {
          thumbnailUrl = await uploadToStorage(frameUrl);
          if (thumbnailUrl) console.log(`[GenerateThumbnail] ✅ TIER 2 SUCCESS`);
        }
      } catch (err) {
        console.warn(`[GenerateThumbnail] TIER 2 error:`, err);
      }
    }

    // ============================================================
    // TIER 3: Use scene_images or pro_features_data reference
    // ============================================================
    if (!thumbnailUrl) {
      console.log(`[GenerateThumbnail] TIER 3: Project reference images`);
      try {
        const { data: proj } = await supabase
          .from('movie_projects')
          .select('pro_features_data, scene_images')
          .eq('id', projectId)
          .single();

        const proData = proj?.pro_features_data as Record<string, any> | null;
        const candidates = [
          proData?.referenceAnalysis?.imageUrl,
          proData?.goldenFrameData?.goldenFrameUrl,
          ...(Array.isArray(proj?.scene_images) ? (proj.scene_images as any[]).map((s: any) => s?.imageUrl) : []),
        ].filter(u => u && typeof u === 'string' && u.startsWith('http'));

        for (const url of candidates) {
          thumbnailUrl = await uploadToStorage(url);
          if (thumbnailUrl) {
            console.log(`[GenerateThumbnail] ✅ TIER 3 SUCCESS`);
            break;
          }
        }
      } catch (err) {
        console.warn(`[GenerateThumbnail] TIER 3 error:`, err);
      }
    }

    if (!thumbnailUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "No thumbnail source available" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update project
    await supabase.from('movie_projects').update({ thumbnail_url: thumbnailUrl }).eq('id', projectId);
    console.log(`[GenerateThumbnail] ✅ Project ${projectId} thumbnail saved`);

    return new Response(
      JSON.stringify({ success: true, thumbnailUrl, projectId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[GenerateThumbnail] Fatal:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
