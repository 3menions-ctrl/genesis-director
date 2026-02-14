import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generate Thumbnail v6.0 - VIDEO FRAME EXTRACTION ONLY
 * 
 * Extracts actual video frames for thumbnails - NO AI image generation.
 * Uses Replicate frame extraction or reference images as fallback.
 */

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD: Prevent unauthorized API credit consumption ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const { projectId, videoUrl } = await req.json();

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log("[GenerateThumbnail] Starting for project:", projectId);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get project data
    const { data: project } = await supabase
      .from('movie_projects')
      .select('video_url, thumbnail_url, pro_features_data, scene_images')
      .eq('id', projectId)
      .single();

    // Skip if already has thumbnail
    if (project?.thumbnail_url) {
      console.log("[GenerateThumbnail] Already has thumbnail, skipping");
      return new Response(
        JSON.stringify({ 
          success: true,
          thumbnailUrl: project.thumbnail_url,
          skipped: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetVideoUrl = videoUrl || project?.video_url;
    let thumbnailUrl: string | null = null;

    // ============================================================
    // TIER 1: Extract frame from actual video using Replicate
    // ============================================================
    if (targetVideoUrl && REPLICATE_API_KEY) {
      console.log("[GenerateThumbnail] TIER 1: Extracting frame from video...");
      
      try {
        const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: "a97a0a2e37ef87f7175ad88ba6ac019e51e6c3fc447c72a47c6a0d364a34d6b0",
            input: {
              video: targetVideoUrl,
              fps: 1,
              format: "jpg"
            }
          }),
        });
        
        if (predictionResponse.ok) {
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
            
            if (!statusResponse.ok) continue;
            
            const status = await statusResponse.json();
            
            if (status.status === 'succeeded') {
              const frames = status.output;
              
              if (Array.isArray(frames) && frames.length > 0) {
                // Get a frame from the middle of the video for a good thumbnail
                const middleIndex = Math.floor(frames.length / 2);
                const frameUrl = frames[Math.min(middleIndex, frames.length - 1)];
                
                if (frameUrl) {
                  // Download and re-upload to thumbnails bucket
                  const frameResponse = await fetch(frameUrl);
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
                    }
                  }
                }
              }
              break;
            } else if (status.status === 'failed') {
              console.warn(`[GenerateThumbnail] Prediction failed: ${status.error}`);
              break;
            }
          }
        }
      } catch (err) {
        console.warn("[GenerateThumbnail] TIER 1 failed:", err);
      }
    }

    // ============================================================
    // TIER 2: Use reference image from project data
    // ============================================================
    if (!thumbnailUrl && project?.pro_features_data) {
      console.log("[GenerateThumbnail] TIER 2: Using reference image...");
      
      const proData = project.pro_features_data as Record<string, any>;
      const possibleUrls = [
        proData.referenceAnalysis?.imageUrl,
        proData.goldenFrameData?.goldenFrameUrl,
        proData.identityBible?.originalReferenceUrl,
      ].filter(url => url && typeof url === 'string' && url.startsWith('http'));
      
      if (possibleUrls.length > 0) {
        try {
          const refUrl = possibleUrls[0];
          const refResponse = await fetch(refUrl);
          
          if (refResponse.ok) {
            const imageData = await refResponse.arrayBuffer();
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
        } catch (err) {
          console.warn("[GenerateThumbnail] TIER 2 failed:", err);
        }
      }
    }

    // ============================================================
    // TIER 3: Use scene images as fallback
    // ============================================================
    if (!thumbnailUrl && project?.scene_images && Array.isArray(project.scene_images)) {
      console.log("[GenerateThumbnail] TIER 3: Using scene image...");
      
      const sceneImage = project.scene_images[0];
      if (sceneImage?.imageUrl && typeof sceneImage.imageUrl === 'string') {
        try {
          const sceneResponse = await fetch(sceneImage.imageUrl);
          
          if (sceneResponse.ok) {
            const imageData = await sceneResponse.arrayBuffer();
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
              console.log(`[GenerateThumbnail] ✅ TIER 3 SUCCESS: ${thumbnailUrl}`);
            }
          }
        } catch (err) {
          console.warn("[GenerateThumbnail] TIER 3 failed:", err);
        }
      }
    }

    if (!thumbnailUrl) {
      console.error("[GenerateThumbnail] All tiers failed - no thumbnail generated");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "No video frames or reference images available for thumbnail",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update project with thumbnail URL
    const { error: updateError } = await supabase
      .from("movie_projects")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", projectId);
    
    if (updateError) {
      console.error("Failed to update project:", updateError);
    } else {
      console.log("Project updated with thumbnail");
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        thumbnailUrl,
        stored: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-thumbnail function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
