import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SceneImageRequest {
  scenes: {
    sceneNumber: number;
    title: string;
    visualDescription: string;
    characters?: string[];
    mood?: string;
  }[];
  projectId: string;
  globalStyle?: string;
  globalCharacters?: string;
  globalEnvironment?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scenes, projectId, globalStyle, globalCharacters, globalEnvironment }: SceneImageRequest = await req.json();

    if (!scenes || scenes.length === 0) {
      throw new Error("Scenes array is required");
    }

    if (!projectId) {
      throw new Error("Project ID is required");
    }

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

    console.log(`Generating ${scenes.length} scene reference images for project ${projectId} using OpenAI gpt-image-1`);

    const generatedImages: { sceneNumber: number; imageUrl: string; prompt: string }[] = [];

    // Process scenes sequentially to avoid rate limiting
    for (const scene of scenes) {
      // Build a comprehensive image generation prompt
      const imagePromptParts = [
        "Create a cinematic film still for a video scene.",
        `Scene Title: ${scene.title}`,
        `Visual Description: ${scene.visualDescription}`,
      ];

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

      if (globalStyle) {
        imagePromptParts.push(`Visual Style: ${globalStyle}`);
      }

      imagePromptParts.push(
        "Style: Cinematic composition, professional color grading, high detail, photorealistic, 16:9 widescreen aspect ratio"
      );

      const imagePrompt = imagePromptParts.join(". ");
      console.log(`Generating image for scene ${scene.sceneNumber}: ${scene.title}`);

      try {
        // Use OpenAI gpt-image-1 model
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
            size: "1536x1024", // Closest to 16:9 for cinematic look
            quality: "high",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`OpenAI error for scene ${scene.sceneNumber}:`, errorData);
          
          if (response.status === 429) {
            console.error(`Rate limit hit for scene ${scene.sceneNumber}, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            continue;
          }
          if (response.status === 402 || response.status === 401) {
            throw new Error("OpenAI API authentication or billing issue");
          }
          continue;
        }

        const data = await response.json();
        const imageData = data.data?.[0]?.b64_json || data.data?.[0]?.url;

        if (imageData) {
          let imageBuffer: Uint8Array;
          let imageUrl: string;

          // Check if it's base64 or URL
          if (data.data?.[0]?.b64_json) {
            // Base64 encoded image
            const base64Data = data.data[0].b64_json;
            imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          } else if (data.data?.[0]?.url) {
            // URL - fetch and convert
            console.log(`Fetching image from URL for scene ${scene.sceneNumber}`);
            const imageResponse = await fetch(data.data[0].url);
            const arrayBuffer = await imageResponse.arrayBuffer();
            imageBuffer = new Uint8Array(arrayBuffer);
          } else {
            console.error(`No image data for scene ${scene.sceneNumber}`);
            continue;
          }
          
          const fileName = `${projectId}/scene-${scene.sceneNumber}-${Date.now()}.png`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("scene-images")
            .upload(fileName, imageBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadError) {
            console.error(`Failed to upload image for scene ${scene.sceneNumber}:`, uploadError);
            // If we have URL, use it directly as fallback
            if (data.data?.[0]?.url) {
              generatedImages.push({
                sceneNumber: scene.sceneNumber,
                imageUrl: data.data[0].url,
                prompt: imagePrompt,
              });
            }
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
