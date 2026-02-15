import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VIDEOS = [
  { id: 'a1b6f181-26fa-4306-a663-d5892977b3fc', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_a1b6f181-26fa-4306-a663-d5892977b3fc_1768451441287.mp4' },
  { id: 'a0016bb1-34ea-45e3-a173-da9441a84bda', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_a0016bb1-34ea-45e3-a173-da9441a84bda_1768449857055.mp4' },
  { id: '71e83837-9ae4-4e79-a4f2-599163741b03', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4' },
  { id: 'c09f52b7-442c-41cd-be94-2895e78bd0ba', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_c09f52b7-442c-41cd-be94-2895e78bd0ba_1768330950513.mp4' },
  { id: '72e42238-ddfc-4ce1-8bae-dce8d8fc6bba', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_72e42238-ddfc-4ce1-8bae-dce8d8fc6bba_1768263824409.mp4' },
  { id: 'f6b90eb8-fc54-4a82-b8db-7592a601a0f6', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_f6b90eb8-fc54-4a82-b8db-7592a601a0f6_1768205766918.mp4' },
  { id: '099597a1-0cbf-4d71-b000-7d140ab896d1', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171807679.mp4' },
  { id: '1b0ac63f-643a-4d43-b8ed-44b8083257ed', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4' },
  { id: 'dc255261-7bc3-465f-a9ec-ef2acd47b4fb', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4' },
  { id: '7434c756-78d3-4f68-8107-b205930027c4', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4' },
  { id: '5bd6da17-734b-452b-b8b0-3381e7c710e3', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_5bd6da17-734b-452b-b8b0-3381e7c710e3_1768069835550.mp4' },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD: Service-role only ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.isServiceRole) {
      return unauthorizedResponse(corsHeaders, 'Service-role access required');
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: { id: string; thumbnailUrl: string | null; error?: string }[] = [];

    for (const video of VIDEOS) {
      try {
        // Use external thumbnail extraction service
        // mux.com provides thumbnail extraction, but we'll use a simple approach
        // Extract frame using ffmpeg via external API or generate from video metadata
        
        // For now, let's use the video URL directly with a thumbnail service
        // We'll use a service that can extract frames from videos
        const thumbnailApiUrl = `https://image.thum.io/get/video/${encodeURIComponent(video.url)}`;
        
        // Fetch the thumbnail
        const thumbResponse = await fetch(thumbnailApiUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (!thumbResponse.ok) {
          throw new Error(`Failed to fetch thumbnail: ${thumbResponse.status}`);
        }

        const imageBlob = await thumbResponse.blob();
        const imageBuffer = await imageBlob.arrayBuffer();

        // Upload to storage
        const fileName = `${video.id}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('video-thumbnails')
          .upload(fileName, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('video-thumbnails')
          .getPublicUrl(fileName);

        results.push({ id: video.id, thumbnailUrl: publicUrl });
        
      } catch (error) {
        console.error(`Error processing video ${video.id}:`, error);
        results.push({ id: video.id, thumbnailUrl: null, error: String(error) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
