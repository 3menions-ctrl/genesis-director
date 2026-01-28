import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generate Project Thumbnail v5.0 - REPLICATE-BASED
 * 
 * Extracts a frame from a project's video and saves it as the project's thumbnail.
 * NO CLOUD RUN DEPENDENCY - Uses Replicate API for reliable frame extraction.
 */

interface GenerateThumbnailRequest {
  projectId: string;
  videoUrl: string;
}

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

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

    let thumbnailUrl: string | null = null;

    // ============================================================
    // TIER 1: Replicate Frame Extraction
    // ============================================================
    if (REPLICATE_API_KEY) {
      const MAX_RETRIES = 3;
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const backoffMs = 2000 * attempt;
            console.log(`[GenerateThumbnail] 🔄 Retry ${attempt + 1}/${MAX_RETRIES}, waiting ${backoffMs}ms...`);
            await sleep(backoffMs);
          }
          
          console.log(`[GenerateThumbnail] TIER 1: Replicate extraction attempt ${attempt + 1}/${MAX_RETRIES}`);
          
          const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${REPLICATE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              version: "a97a0a2e37ef87f7175ad88ba6ac019e51e6c3fc447c72a47c6a0d364a34d6b0",
              input: {
                video: videoUrl,
                fps: 1,
                format: "jpg"
              }
            }),
          });
          
          if (!predictionResponse.ok) {
            const errorText = await predictionResponse.text();
            console.warn(`[GenerateThumbnail] Replicate prediction start failed: ${predictionResponse.status} - ${errorText.substring(0, 100)}`);
            
            if (predictionResponse.status === 404 || predictionResponse.status === 422) {
              console.log(`[GenerateThumbnail] Frame extraction model unavailable, using fallback...`);
              break;
            }
            continue;
          }
          
          const prediction = await predictionResponse.json();
          console.log(`[GenerateThumbnail] Prediction started: ${prediction.id}`);
          
          // Poll for completion (max 60 seconds)
          const maxPollTime = 60000;
          const pollInterval = 2000;
          const startTime = Date.now();
          
          while (Date.now() - startTime < maxPollTime) {
            await sleep(pollInterval);
            
            const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
              headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
            });
            
            if (!statusResponse.ok) {
              console.warn(`[GenerateThumbnail] Status check failed: ${statusResponse.status}`);
              continue;
            }
            
            const status = await statusResponse.json();
            
            if (status.status === 'succeeded') {
              const frames = status.output;
              
              if (Array.isArray(frames) && frames.length > 0) {
                // Get the FIRST frame for thumbnail
                const firstFrameUrl = frames[0];
                
                if (firstFrameUrl) {
                  // Download and re-upload to thumbnails bucket
                  try {
                    const frameResponse = await fetch(firstFrameUrl);
                    if (frameResponse.ok) {
                      const imageData = await frameResponse.arrayBuffer();
                      const fileName = `thumb_${projectId}.jpg`;
                      
                      const { error: uploadError } = await supabase.storage
                        .from('thumbnails')
                        .upload(fileName, new Uint8Array(imageData), {
                          contentType: 'image/jpeg',
                          upsert: true,
                        });

                      if (!uploadError) {
                        const { data: urlData } = supabase.storage
                          .from('thumbnails')
                          .getPublicUrl(fileName);
                        
                        thumbnailUrl = urlData.publicUrl;
                        console.log(`[GenerateThumbnail] ✅ TIER 1 SUCCESS: ${thumbnailUrl}`);
                        break;
                      } else {
                        console.warn(`[GenerateThumbnail] Upload failed:`, uploadError);
                      }
                    }
                  } catch (downloadErr) {
                    console.warn(`[GenerateThumbnail] Download/upload error:`, downloadErr);
                  }
                }
              }
              break;
            } else if (status.status === 'failed') {
              console.warn(`[GenerateThumbnail] Prediction failed: ${status.error}`);
              break;
            }
            
            console.log(`[GenerateThumbnail] Polling... status: ${status.status}`);
          }
          
          if (thumbnailUrl) break;
        } catch (replicateError) {
          const errorMsg = replicateError instanceof Error ? replicateError.message : 'Unknown error';
          console.warn(`[GenerateThumbnail] Attempt ${attempt + 1} error: ${errorMsg}`);
          continue;
        }
      }
    } else {
      console.warn(`[GenerateThumbnail] ⚠️ REPLICATE_API_KEY not configured`);
    }

    // ============================================================
    // TIER 2: Fallback to extract-video-frame edge function
    // ============================================================
    if (!thumbnailUrl) {
      console.log(`[GenerateThumbnail] TIER 2: Using extract-video-frame edge function...`);
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/extract-video-frame`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            videoUrl,
            projectId,
            shotId: 'thumbnail',
            position: 'first',
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.frameUrl) {
            // Download and re-upload to thumbnails bucket
            const frameResponse = await fetch(data.frameUrl);
            if (frameResponse.ok) {
              const imageData = await frameResponse.arrayBuffer();
              const fileName = `thumb_${projectId}.jpg`;
              
              const { error: uploadError } = await supabase.storage
                .from('thumbnails')
                .upload(fileName, new Uint8Array(imageData), {
                  contentType: 'image/jpeg',
                  upsert: true,
                });

              if (!uploadError) {
                const { data: urlData } = supabase.storage
                  .from('thumbnails')
                  .getPublicUrl(fileName);
                
                thumbnailUrl = urlData.publicUrl;
                console.log(`[GenerateThumbnail] ✅ TIER 2 SUCCESS: ${thumbnailUrl}`);
              }
            }
          }
        }
      } catch (edgeFnErr) {
        console.warn(`[GenerateThumbnail] Edge function fallback failed:`, edgeFnErr);
      }
    }

    if (!thumbnailUrl) {
      console.error(`[GenerateThumbnail] Failed to extract thumbnail`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to extract thumbnail - Replicate and fallbacks exhausted` 
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
