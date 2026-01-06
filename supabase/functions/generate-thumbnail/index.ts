import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, projectId, projectName } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("Generating thumbnail for project:", projectId);
    console.log("Thumbnail prompt:", prompt.slice(0, 200));

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Create a cinematic thumbnail prompt
    const thumbnailPrompt = `Create a stunning cinematic movie poster thumbnail image: ${prompt}. 
Style: Ultra high resolution movie poster, dramatic lighting, cinematic color grading, professional photography, 16:9 aspect ratio, film grain, shallow depth of field, IMAX quality.`;

    console.log("Calling OpenAI DALL-E for image generation...");

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: thumbnailPrompt,
        n: 1,
        size: "1792x1024",
        quality: "standard",
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI DALL-E error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid OpenAI API key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`OpenAI DALL-E error: ${response.status}`);
    }

    const data = await response.json();
    console.log("DALL-E response received");

    // Extract the base64 image from the DALL-E response
    const imageBase64 = data.data?.[0]?.b64_json;
    
    if (!imageBase64) {
      console.error("No image in response:", JSON.stringify(data, null, 2));
      throw new Error("No image generated");
    }

    const imageData = `data:image/png;base64,${imageBase64}`;

    // If we have a projectId, upload to storage
    if (projectId) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        // Convert base64 to binary
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        // Generate filename
        const fileName = `${projectId}-${Date.now()}.png`;
        
        console.log("Uploading thumbnail to storage:", fileName);
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("thumbnails")
          .upload(fileName, binaryData, {
            contentType: "image/png",
            upsert: true,
          });
        
        if (uploadError) {
          console.error("Upload error:", uploadError);
          // Return base64 as fallback
          return new Response(
            JSON.stringify({ 
              success: true,
              thumbnailUrl: imageData,
              stored: false,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("thumbnails")
          .getPublicUrl(fileName);
        
        const thumbnailUrl = publicUrlData.publicUrl;
        console.log("Thumbnail uploaded:", thumbnailUrl);
        
        // Update the project with the thumbnail URL
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
      }
    }

    // Return base64 image if no storage available
    return new Response(
      JSON.stringify({ 
        success: true,
        thumbnailUrl: imageData,
        stored: false,
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
