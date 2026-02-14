import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SceneImageRequest {
  scenes: {
    sceneNumber: number;
    title?: string;
    visualDescription: string;
    characters?: string[];
    mood?: string;
  }[];
  projectId?: string;  // Optional - generated ID if not provided
  userId?: string;     // For callback continuation
  visualStyle?: string;
  globalStyle?: string;
  globalCharacters?: string;
  globalEnvironment?: string;
  // Callback continuation - triggers next stage when complete
  triggerNextStage?: boolean;
}

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

    const { scenes, projectId, userId, visualStyle, globalStyle, globalCharacters, globalEnvironment, triggerNextStage }: SceneImageRequest = await req.json();

    if (!scenes || scenes.length === 0) {
      throw new Error("Scenes array is required");
    }

    // Generate a temporary ID if projectId not provided (for master anchor generation)
    const effectiveProjectId = projectId || `temp-${Date.now()}`;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Generating ${scenes.length} scene reference images for project ${effectiveProjectId} using OpenAI DALL-E 3`);

    const generatedImages: { sceneNumber: number; imageUrl: string; prompt: string }[] = [];
    const MAX_RETRIES_PER_SCENE = 3; // SAFEGUARD: Limit retries per scene
    const MAX_CONSECUTIVE_FAILURES = 5; // SAFEGUARD: Stop if too many consecutive failures
    let consecutiveFailures = 0;

    // Process scenes sequentially to avoid rate limiting
    for (const scene of scenes) {
      // SAFEGUARD: Stop if too many consecutive failures
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`[SceneImages] Stopping after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`);
        break;
      }
      // Build a comprehensive image generation prompt
      const imagePromptParts = [
        "Create a cinematic film still for a video scene.",
      ];

      if (scene.title) {
        imagePromptParts.push(`Scene Title: ${scene.title}`);
      }
      
      imagePromptParts.push(`Visual Description: ${scene.visualDescription}`);

      if (scene.mood) {
        imagePromptParts.push(`Mood/Atmosphere: ${scene.mood}`);
      }

      if (scene.characters && scene.characters.length > 0) {
        imagePromptParts.push(`Characters: ${scene.characters.join(", ")}`);
      }

      if (globalCharacters) {
        imagePromptParts.push(`Character Details: ${globalCharacters}`);
      }

      if (globalEnvironment) {
        imagePromptParts.push(`Environment: ${globalEnvironment}`);
      }

      // Support both visualStyle and globalStyle
      const styleToUse = visualStyle || globalStyle;
      if (styleToUse) {
        imagePromptParts.push(`Visual Style: ${styleToUse}`);
      }

      imagePromptParts.push(
        "Style: Cinematic composition, professional color grading, high detail, photorealistic, 16:9 widescreen aspect ratio"
      );

      const imagePrompt = imagePromptParts.join(". ");
      console.log(`Generating image for scene ${scene.sceneNumber}: ${scene.title}`);
      console.log(`Prompt: ${imagePrompt.substring(0, 200)}...`);

      try {
        // Use OpenAI DALL-E 3 model for image generation
        const response = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: imagePrompt,
            n: 1,
            size: "1792x1024",
            quality: "hd",
            style: "vivid",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`OpenAI error for scene ${scene.sceneNumber}:`, JSON.stringify(errorData));
          
          // SAFEGUARD: Retry with backoff for rate limits (max 3 attempts)
          if (response.status === 429) {
            consecutiveFailures++;
            const retryAttempt = (scene as any)._retryCount || 0;
            if (retryAttempt < MAX_RETRIES_PER_SCENE) {
              const waitTime = Math.min(10000 * Math.pow(2, retryAttempt), 60000); // 10s, 20s, 40s max 60s
              console.error(`Rate limit hit for scene ${scene.sceneNumber}, attempt ${retryAttempt + 1}/${MAX_RETRIES_PER_SCENE}, waiting ${waitTime/1000}s...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              (scene as any)._retryCount = retryAttempt + 1;
              // Re-add to processing by continuing (will be picked up next iteration if we restructure)
              // For now, just continue to next scene after max retries
              if (retryAttempt + 1 >= MAX_RETRIES_PER_SCENE) {
                console.error(`Max retries reached for scene ${scene.sceneNumber}, skipping`);
              }
              continue;
            }
            console.error(`Max retries exceeded for scene ${scene.sceneNumber}, skipping`);
            continue;
          }
          if (response.status === 402 || response.status === 401) {
            throw new Error(`OpenAI API error: ${errorData?.error?.message || 'Authentication or billing issue'}`);
          }
          // Log and continue for other errors
          consecutiveFailures++;
          console.error(`Skipping scene ${scene.sceneNumber} due to error: ${errorData?.error?.message}`);
          continue;
        }
        
        // Reset consecutive failures on success
        consecutiveFailures = 0;

        const data = await response.json();
        console.log(`DALL-E 3 response for scene ${scene.sceneNumber}:`, JSON.stringify(data).substring(0, 200));

        // DALL-E 3 returns URLs by default
        const imageUrl = data.data?.[0]?.url;
        const revisedPrompt = data.data?.[0]?.revised_prompt;
        
        if (revisedPrompt) {
          console.log(`DALL-E 3 revised prompt for scene ${scene.sceneNumber}: ${revisedPrompt.substring(0, 100)}...`);
        }

        if (imageUrl) {
          // Fetch image from OpenAI URL and upload to Supabase storage
          console.log(`Downloading image for scene ${scene.sceneNumber} from OpenAI...`);
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            console.error(`Failed to download image for scene ${scene.sceneNumber}`);
            // Fall back to using OpenAI URL directly (expires in 60 min)
            generatedImages.push({
              sceneNumber: scene.sceneNumber,
              imageUrl: imageUrl,
              prompt: imagePrompt,
            });
            continue;
          }
          const arrayBuffer = await imageResponse.arrayBuffer();
          const imageBuffer = new Uint8Array(arrayBuffer);
          
          const fileName = `${effectiveProjectId}/scene-${scene.sceneNumber}-${Date.now()}.png`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("scene-images")
            .upload(fileName, imageBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadError) {
            console.error(`Failed to upload image for scene ${scene.sceneNumber}:`, uploadError);
            // If we have URL, use it directly as fallback
            generatedImages.push({
              sceneNumber: scene.sceneNumber,
              imageUrl: imageUrl,
              prompt: imagePrompt,
            });
          } else {
            // Get public URL
            const { data: publicUrlData } = supabase.storage
              .from("scene-images")
              .getPublicUrl(fileName);

            generatedImages.push({
              sceneNumber: scene.sceneNumber,
              imageUrl: publicUrlData.publicUrl,
              prompt: imagePrompt,
            });
          }

          console.log(`Successfully generated image for scene ${scene.sceneNumber}`);
        } else {
          console.error(`No image data in response for scene ${scene.sceneNumber}`);
        }

        // Delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (sceneError) {
        console.error(`Error generating image for scene ${scene.sceneNumber}:`, sceneError);
        // Continue with other scenes
      }
    }

    console.log(`Generated ${generatedImages.length}/${scenes.length} scene images using OpenAI`);

    // CALLBACK CONTINUATION: Trigger next pipeline stage if requested
    // This prevents stalls when hollywood-pipeline gets early_drop shutdown
    if (triggerNextStage && projectId && userId && generatedImages.length > 0) {
      console.log(`[SceneImages] Triggering next pipeline stage for project ${projectId}...`);
      
      try {
        // First, persist scene images to DB
        await supabase
          .from('movie_projects')
          .update({ 
            scene_images: generatedImages,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);
        console.log(`[SceneImages] ✓ Scene images persisted to DB`);
        
        // Call resume-pipeline to continue from assets stage
        const resumeResponse = await fetch(`${SUPABASE_URL}/functions/v1/resume-pipeline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            projectId,
            userId,
            resumeFrom: 'assets', // Continue from asset stage (voice/music generation)
          }),
        });
        
        if (resumeResponse.ok) {
          console.log(`[SceneImages] ✓ Pipeline continuation triggered successfully`);
        } else {
          const errorText = await resumeResponse.text();
          console.warn(`[SceneImages] Pipeline continuation failed: ${errorText.substring(0, 200)}`);
        }
      } catch (callbackError) {
        console.error(`[SceneImages] Callback error:`, callbackError);
        // Don't fail the response - images were generated successfully
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        images: generatedImages,
        totalGenerated: generatedImages.length,
        totalRequested: scenes.length,
        continuationTriggered: triggerNextStage && projectId && userId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-scene-images function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
