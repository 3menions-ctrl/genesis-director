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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get ONLY ONE project that needs a thumbnail (to avoid CPU timeout)
    const { data: projects, error: fetchError } = await supabase
      .from("movie_projects")
      .select("id, title, video_clips, script_content, generated_script, setting")
      .is("thumbnail_url", null)
      .not("video_clips", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1);

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

    const project = projects[0];
    console.log(`Generating thumbnail for: ${project.title}`);

    // Build a prompt from project data
    const scriptContent = project.script_content || project.generated_script || "";
    const setting = project.setting || "";
    
    // Extract first meaningful sentence for the thumbnail
    const firstLine = scriptContent.split(/[.!?\n]/)[0]?.trim() || project.title;
    
    const thumbnailPrompt = `Create a stunning cinematic movie poster thumbnail: "${project.title}". 
Scene: ${firstLine}. ${setting ? `Setting: ${setting}.` : ""}
Style: Ultra high resolution movie poster, dramatic lighting, cinematic color grading, professional photography, 16:9 aspect ratio, film grain, shallow depth of field, IMAX quality.`;

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
      console.error(`DALL-E 3 error for ${project.id}:`, response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const imageBase64 = data.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("No image generated");
    }

    // Convert base64 to binary
    const binaryData = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

    // Upload to storage
    const fileName = `${project.id}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("thumbnails")
      .upload(fileName, binaryData, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload error: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("thumbnails")
      .getPublicUrl(fileName);

    const thumbnailUrl = publicUrlData.publicUrl;

    // Update project
    const { error: updateError } = await supabase
      .from("movie_projects")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", project.id);

    if (updateError) {
      throw new Error(`Update error: ${updateError.message}`);
    }

    console.log(`Thumbnail generated for ${project.title}: ${thumbnailUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated thumbnail for ${project.title}`,
        processed: 1,
        thumbnailUrl,
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
