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
  visualStyle?: string;
  globalStyle?: string;
  globalCharacters?: string;
  globalEnvironment?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scenes, projectId, visualStyle, globalStyle, globalCharacters, globalEnvironment }: SceneImageRequest = await req.json();

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

    // Process scenes sequentially to avoid rate limiting
    for (const scene of scenes) {
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
        // Use OpenAI gpt-image-1 model - the latest and most powerful
        const response = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: imagePrompt,
            n: 1,
            size: "1536x1024", // Widescreen for cinematic look
            quality: "high",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`OpenAI error for scene ${scene.sceneNumber}:`, JSON.stringify(errorData));
          
          if (response.status === 429) {
            console.error(`Rate limit hit for scene ${scene.sceneNumber}, waiting 10s...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            continue;
          }
          if (response.status === 402 || response.status === 401) {
            throw new Error(`OpenAI API error: ${errorData?.error?.message || 'Authentication or billing issue'}`);
          }
          // Log and continue for other errors
          console.error(`Skipping scene ${scene.sceneNumber} due to error: ${errorData?.error?.message}`);
          continue;
        }

        const data = await response.json();
        console.log(`GPT-Image-1 response for scene ${scene.sceneNumber}:`, JSON.stringify(data).substring(0, 200));

        // gpt-image-1 returns base64 directly in b64_json field
        const imageBase64 = data.data?.[0]?.b64_json;

        if (imageBase64) {
          // Convert base64 to binary and upload to Supabase storage
          const binaryData = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
          
          const fileName = `${effectiveProjectId}/scene-${scene.sceneNumber}-${Date.now()}.png`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("scene-images")
            .upload(fileName, binaryData, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadError) {
            console.error(`Failed to upload image for scene ${scene.sceneNumber}:`, uploadError);
            // Return base64 as fallback
            generatedImages.push({
              sceneNumber: scene.sceneNumber,
              imageUrl: `data:image/png;base64,${imageBase64}`,
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

    return new Response(
      JSON.stringify({
        success: true,
        images: generatedImages,
        totalGenerated: generatedImages.length,
        totalRequested: scenes.length,
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
