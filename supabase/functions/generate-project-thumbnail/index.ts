import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generate Project Thumbnail
 * 
 * Extracts a frame from a project's video and saves it as the project's thumbnail.
 * Uses Cloud Run FFmpeg for reliable frame extraction.
 */

interface GenerateThumbnailRequest {
  projectId: string;
  videoUrl: string;
}

// Exponential backoff with jitter
function calculateBackoff(attempt: number, baseMs = 2000, maxMs = 20000): number {
  const exponentialDelay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = exponentialDelay * (0.1 + Math.random() * 0.2);
  return Math.floor(exponentialDelay + jitter);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: GenerateThumbnailRequest = await req.json();
    const { projectId, videoUrl } = request;

    if (!projectId || !videoUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "projectId and videoUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GenerateThumbnail] Starting for project ${projectId}`);
    console.log(`[GenerateThumbnail] Video URL: ${videoUrl.substring(0, 80)}...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if project already has a thumbnail
    const { data: project } = await supabase
      .from('movie_projects')
      .select('thumbnail_url')
      .eq('id', projectId)
      .single();

    if (project?.thumbnail_url) {
      console.log(`[GenerateThumbnail] Project already has thumbnail, skipping`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          thumbnailUrl: project.thumbnail_url,
          skipped: true,
          message: "Project already has thumbnail" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (!cloudRunUrl) {
      console.error(`[GenerateThumbnail] CLOUD_RUN_STITCHER_URL not configured`);
      return new Response(
        JSON.stringify({ success: false, error: "CLOUD_RUN_STITCHER_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MAX_RETRIES = 5;
    let thumbnailUrl: string | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = calculateBackoff(attempt - 1);
          console.log(`[GenerateThumbnail] Retry ${attempt + 1}/${MAX_RETRIES}, waiting ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
        const extractEndpoint = `${normalizedUrl}/extract-frame`;

        console.log(`[GenerateThumbnail] Calling Cloud Run (attempt ${attempt + 1}/${MAX_RETRIES})`);

        const controller = new AbortController();
        const timeoutMs = 30000 + (attempt * 5000);
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(extractEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipUrl: videoUrl,
            clipIndex: 'thumbnail',
            projectId,
            position: 'first', // Use first frame for thumbnail
            returnBase64: true,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();

          if (result.frameBase64) {
            console.log(`[GenerateThumbnail] Got base64 frame, uploading to storage...`);
            
            const cleanBase64 = result.frameBase64.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
            
            const fileName = `thumb_${projectId}.jpg`;
            const { error: uploadError } = await supabase.storage
              .from('thumbnails')
              .upload(fileName, imageBuffer, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (uploadError) {
              console.warn(`[GenerateThumbnail] Upload error:`, uploadError.message);
              continue;
            }

            const { data: urlData } = supabase.storage
              .from('thumbnails')
              .getPublicUrl(fileName);

            thumbnailUrl = urlData.publicUrl;
            console.log(`[GenerateThumbnail] ✓ Thumbnail uploaded: ${thumbnailUrl}`);
            break;
          }

          // Handle direct URL response
          if (result.lastFrameUrl || result.frameUrl) {
            thumbnailUrl = result.lastFrameUrl || result.frameUrl;
            console.log(`[GenerateThumbnail] Got direct URL: ${thumbnailUrl}`);
            break;
          }
        } else {
          const errorText = await response.text();
          console.warn(`[GenerateThumbnail] HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[GenerateThumbnail] Attempt ${attempt + 1} error: ${errorMsg}`);
      }
    }

    if (!thumbnailUrl) {
      console.error(`[GenerateThumbnail] Failed after ${MAX_RETRIES} attempts`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to extract thumbnail after ${MAX_RETRIES} attempts` 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update project with thumbnail URL
    const { error: updateError } = await supabase
      .from('movie_projects')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', projectId);

    if (updateError) {
      console.error(`[GenerateThumbnail] Failed to update project:`, updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to update project: ${updateError.message}`,
          thumbnailUrl 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GenerateThumbnail] ✅ Success! Project ${projectId} thumbnail updated`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnailUrl,
        projectId 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[GenerateThumbnail] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
