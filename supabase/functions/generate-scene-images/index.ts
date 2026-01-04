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
  globalStyle?: string; // Visual style preset
  globalCharacters?: string; // Character descriptions for consistency
  globalEnvironment?: string; // Environment description for consistency
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Generating ${scenes.length} scene reference images for project ${projectId}`);

    const generatedImages: { sceneNumber: number; imageUrl: string; prompt: string }[] = [];

    // Process scenes sequentially to avoid rate limiting
    for (const scene of scenes) {
      // Build a comprehensive image generation prompt
      const imagePromptParts = [
        "Generate a high-quality cinematic still image for a video scene.",
        `Scene: ${scene.title}`,
        `Visual Description: ${scene.visualDescription}`,
      ];

      if (scene.mood) {
        imagePromptParts.push(`Mood/Atmosphere: ${scene.mood}`);
      }

      if (scene.characters && scene.characters.length > 0) {
        imagePromptParts.push(`Characters in scene: ${scene.characters.join(", ")}`);
      }

      if (globalCharacters) {
        imagePromptParts.push(`Character consistency reference: ${globalCharacters}`);
      }

      if (globalEnvironment) {
        imagePromptParts.push(`Environment: ${globalEnvironment}`);
      }

      if (globalStyle) {
        imagePromptParts.push(`Visual Style: ${globalStyle}`);
      }

      imagePromptParts.push(
        "Requirements:",
        "- Cinematic composition with proper framing",
        "- High detail and photorealistic quality",
        "- Consistent lighting throughout",
        "- 16:9 aspect ratio suitable for video",
        "- Professional color grading",
        "- Characters should be clearly visible if present"
      );

      const imagePrompt = imagePromptParts.join("\n");
      console.log(`Generating image for scene ${scene.sceneNumber}: ${scene.title}`);

      try {
        // Use Lovable AI Gemini image model
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: imagePrompt,
              },
            ],
            modalities: ["image", "text"],
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.error(`Rate limit hit for scene ${scene.sceneNumber}`);
            // Wait and retry once
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          if (response.status === 402) {
            throw new Error("API credits exhausted. Please add funds.");
          }
          const errorText = await response.text();
          console.error(`Image generation failed for scene ${scene.sceneNumber}:`, errorText);
          continue;
        }

        const data = await response.json();
        const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (imageData) {
          // Upload base64 image to Supabase Storage
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
          const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          const fileName = `${projectId}/scene-${scene.sceneNumber}-${Date.now()}.png`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("scene-images")
            .upload(fileName, imageBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadError) {
            console.error(`Failed to upload image for scene ${scene.sceneNumber}:`, uploadError);
            // Still include the base64 data as fallback
            generatedImages.push({
              sceneNumber: scene.sceneNumber,
              imageUrl: imageData,
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

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (sceneError) {
        console.error(`Error generating image for scene ${scene.sceneNumber}:`, sceneError);
        // Continue with other scenes
      }
    }

    console.log(`Generated ${generatedImages.length}/${scenes.length} scene images`);

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