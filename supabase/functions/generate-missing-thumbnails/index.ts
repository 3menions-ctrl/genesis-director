import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate Missing Thumbnails v2.0 - VIDEO FRAME EXTRACTION
 * 
 * Extracts actual video frames from the first clip for thumbnails.
 * No AI image generation - uses real content from videos.
 */

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body for optional single project processing
    let targetProjectId: string | null = null;
    try {
      const body = await req.json();
      targetProjectId = body.projectId || null;
    } catch {
      // No body or invalid JSON - process any missing thumbnail
    }

    // Get projects that need thumbnails
    let query = supabase
      .from("movie_projects")
      .select("id, title, is_public, source_image_url, pro_features_data, scene_images")
      .is("thumbnail_url", null)
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(targetProjectId ? 1 : 5);

    if (targetProjectId) {
      query = query.eq("id", targetProjectId);
    }

    const { data: projects, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch projects: ${fetchError.message}`);
    }

    if (!projects || projects.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No projects need thumbnails",
          processed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { id: string; title: string; thumbnailUrl: string | null; error?: string }[] = [];

    for (const project of projects) {
      console.log(`[Thumbnails] Processing: ${project.title} (${project.id})`);
      
      let thumbnailUrl: string | null = null;

      // ===== TIER 1: Get first clip's video URL and extract frame =====
      if (REPLICATE_API_KEY) {
        const { data: clips, error: clipError } = await supabase
          .from("video_clips")
          .select("video_url")
          .eq("project_id", project.id)
          .not("video_url", "is", null)
          .order("shot_index", { ascending: true })
          .limit(1);

        const firstClip = clips?.[0];
        
        if (clipError) {
          console.warn(`[Thumbnails] Clip query error for ${project.id}:`, clipError);
        }

        if (firstClip?.video_url) {
          console.log(`[Thumbnails] TIER 1: Extracting frame from clip: ${firstClip.video_url.substring(0, 60)}...`);
          
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
                  video: firstClip.video_url,
                  fps: 1,
                  format: "jpg"
                }
              }),
            });
            
            if (predictionResponse.ok) {
              const prediction = await predictionResponse.json();
              console.log(`[Thumbnails] Prediction started: ${prediction.id}`);
              
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
                    // Get a frame from the middle for a good thumbnail
                    const middleIndex = Math.floor(frames.length / 2);
                    const frameUrl = frames[Math.min(middleIndex, frames.length - 1)];
                    
                    if (frameUrl) {
                      const frameResponse = await fetch(frameUrl);
                      if (frameResponse.ok) {
                        const imageData = await frameResponse.arrayBuffer();
                        const fileName = `thumb_${project.id}.jpg`;
                        
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
                          console.log(`[Thumbnails] ✅ TIER 1 SUCCESS: ${thumbnailUrl}`);
                        }
                      }
                    }
                  }
                  break;
                } else if (status.status === 'failed') {
                  console.warn(`[Thumbnails] Prediction failed: ${status.error}`);
                  break;
                }
              }
            }
          } catch (err) {
            console.warn("[Thumbnails] TIER 1 failed:", err);
          }
        }
      }

      // ===== TIER 2: Use source_image_url (for image-to-video projects) =====
      if (!thumbnailUrl && project.source_image_url) {
        console.log("[Thumbnails] TIER 2: Using source image...");
        try {
          const sourceResponse = await fetch(project.source_image_url);
          if (sourceResponse.ok) {
            const imageData = await sourceResponse.arrayBuffer();
            const fileName = `thumb_${project.id}.jpg`;
            
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
              console.log(`[Thumbnails] ✅ TIER 2 SUCCESS: ${thumbnailUrl}`);
            }
          }
        } catch (err) {
          console.warn("[Thumbnails] TIER 2 failed:", err);
        }
      }

      // ===== TIER 3: Use reference image from pro_features_data =====
      if (!thumbnailUrl && project.pro_features_data) {
        console.log("[Thumbnails] TIER 3: Using reference image...");
        const proData = project.pro_features_data as Record<string, unknown>;
        const possibleUrls = [
          (proData.referenceAnalysis as { imageUrl?: string })?.imageUrl,
          (proData.goldenFrameData as { goldenFrameUrl?: string })?.goldenFrameUrl,
          (proData.identityBible as { originalReferenceUrl?: string })?.originalReferenceUrl,
        ].filter((url): url is string => typeof url === 'string' && url.startsWith('http'));
        
        if (possibleUrls.length > 0) {
          try {
            const refResponse = await fetch(possibleUrls[0]);
            if (refResponse.ok) {
              const imageData = await refResponse.arrayBuffer();
              const fileName = `thumb_${project.id}.jpg`;
              
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
                console.log(`[Thumbnails] ✅ TIER 3 SUCCESS: ${thumbnailUrl}`);
              }
            }
          } catch (err) {
            console.warn("[Thumbnails] TIER 3 failed:", err);
          }
        }
      }

      // ===== TIER 4: Use scene images as fallback =====
      if (!thumbnailUrl && project.scene_images && Array.isArray(project.scene_images)) {
        console.log("[Thumbnails] TIER 4: Using scene image...");
        const sceneImage = project.scene_images[0] as { imageUrl?: string } | undefined;
        if (sceneImage?.imageUrl) {
          try {
            const sceneResponse = await fetch(sceneImage.imageUrl);
            if (sceneResponse.ok) {
              const imageData = await sceneResponse.arrayBuffer();
              const fileName = `thumb_${project.id}.jpg`;
              
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
                console.log(`[Thumbnails] ✅ TIER 4 SUCCESS: ${thumbnailUrl}`);
              }
            }
          } catch (err) {
            console.warn("[Thumbnails] TIER 4 failed:", err);
          }
        }
      }

      // Update project with thumbnail
      if (thumbnailUrl) {
        const { error: updateError } = await supabase
          .from("movie_projects")
          .update({ thumbnail_url: thumbnailUrl })
          .eq("id", project.id);

        if (updateError) {
          console.error(`Failed to update project ${project.id}:`, updateError);
          results.push({ id: project.id, title: project.title, thumbnailUrl: null, error: updateError.message });
        } else {
          results.push({ id: project.id, title: project.title, thumbnailUrl });
        }
      } else {
        results.push({ id: project.id, title: project.title, thumbnailUrl: null, error: "No video frames available" });
      }
    }

    const successCount = results.filter(r => r.thumbnailUrl).length;
    console.log(`[Thumbnails] Processed ${results.length} projects, ${successCount} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${successCount} of ${results.length} thumbnails`,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-missing-thumbnails:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
