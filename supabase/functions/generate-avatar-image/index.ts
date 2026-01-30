import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AvatarGenerationRequest {
  name: string;
  gender: "male" | "female";
  ageRange: string;
  ethnicity: string;
  style?: string;
  personality?: string;
  clothing?: string;
  generateAllViews?: boolean;
}

interface GeneratedAvatar {
  name: string;
  frontImageUrl: string;
  sideImageUrl?: string;
  backImageUrl?: string;
  characterBible: {
    front_view: string;
    side_view: string;
    back_view: string;
    hair_description: string;
    clothing_description: string;
    body_type: string;
    distinguishing_features: string[];
    negative_prompts: string[];
  };
}

// Build detailed prompt for photorealistic avatar generation
// Creates ultra-realistic human portraits indistinguishable from real photographs
function buildAvatarPrompt(
  config: AvatarGenerationRequest,
  view: "front" | "side" | "back"
): string {
  const viewInstructions = {
    front:
      "facing directly toward the camera, centered composition, natural confident expression, looking at viewer",
    side: "profile view facing left, showing side of face and body clearly, same person with identical features",
    back: "back view facing away from camera, showing hair and back of outfit, same person",
  };

  const ageDescriptor = config.ageRange === "young-adult" 
    ? "in their mid-20s" 
    : config.ageRange === "middle-aged" 
    ? "in their early 40s" 
    : config.ageRange === "mature"
    ? "in their late 50s"
    : "in their 30s";

  const clothing = config.clothing || "modern professional attire, tailored blazer, quality dress shoes";
  
  return `Ultra-realistic professional photograph of a ${config.gender} person named ${config.name}, ${ageDescriptor}, ${config.ethnicity} ethnicity. ${viewInstructions[view]}.

CRITICAL - PHOTOREALISM REQUIREMENTS:
- This MUST look like an actual photograph taken by a professional photographer
- Real human skin with natural pores, subtle imperfections, and realistic texture
- Natural skin tones with realistic subsurface scattering
- Authentic human eyes with natural catchlights and slight moisture
- Real hair with individual strands visible, natural shine and movement
- Genuine facial expressions with micro-expressions
- NO CGI, NO 3D render, NO digital art style - purely photographic

CRITICAL - FULL BODY COMPOSITION:
- FULL BODY shot from head to feet - entire person must be visible
- Standing in a natural, relaxed confident pose
- Full figure including legs and shoes clearly visible
- Professional studio photography framing with person centered

LIGHTING & PHOTOGRAPHY:
- Professional studio lighting (three-point setup)
- Soft key light creating natural shadows
- Shot on high-end camera (Canon EOS R5 quality)
- 85mm portrait lens, shallow depth of field on background
- 8K resolution, extremely sharp focus

CHARACTER DESIGN:
- ${config.gender === "male" ? "Strong natural jaw, authentic masculine features" : "Elegant natural features, authentic feminine beauty"}
- ${config.personality || "Confident and approachable"} demeanor
- Warm, genuine expression

OUTFIT & STYLING:
- ${clothing}
- Well-designed natural hair with realistic texture
- Visible from head to toe including footwear

BACKGROUND: Clean neutral gray seamless studio backdrop with subtle gradient.

ABSOLUTE REQUIREMENTS:
- Indistinguishable from a real photograph of a real person
- Full body visible from head to toe
- Professional photography quality
- Must look like a genuine human being`;
}

// Generate image using Lovable AI Gateway
async function generateImage(prompt: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  console.log("[Avatar Gen] Generating image with prompt:", prompt.substring(0, 200) + "...");

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Avatar Gen] API error:", errorText);
    throw new Error(`Image generation failed: ${response.status}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!imageUrl) {
    console.error("[Avatar Gen] No image in response:", JSON.stringify(data));
    throw new Error("No image returned from API");
  }

  return imageUrl;
}

// Upload base64 image to Supabase storage
async function uploadToStorage(
  supabase: any,
  base64Data: string,
  fileName: string
): Promise<string> {
  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const bytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));

  const { data, error } = await supabase.storage
    .from("avatars")
    .upload(fileName, bytes, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.error("[Avatar Gen] Storage upload error:", error);
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const config: AvatarGenerationRequest = await req.json();
    console.log("[Avatar Gen] Generating avatar for:", config.name);

    // Generate front view (required)
    const frontPrompt = buildAvatarPrompt(config, "front");
    const frontBase64 = await generateImage(frontPrompt);
    if (!frontBase64) {
      throw new Error("Failed to generate front view");
    }

    // Upload front image
    const timestamp = Date.now();
    const frontFileName = `${config.name.toLowerCase().replace(/\s+/g, "-")}-front-${timestamp}.png`;
    const frontImageUrl = await uploadToStorage(supabase, frontBase64, frontFileName);
    console.log("[Avatar Gen] Front view uploaded:", frontFileName);

    let sideImageUrl: string | undefined;
    let backImageUrl: string | undefined;

    // Generate side and back views if requested
    if (config.generateAllViews) {
      // Side view
      const sidePrompt = buildAvatarPrompt(config, "side");
      const sideBase64 = await generateImage(sidePrompt);
      if (sideBase64) {
        const sideFileName = `${config.name.toLowerCase().replace(/\s+/g, "-")}-side-${timestamp}.png`;
        sideImageUrl = await uploadToStorage(supabase, sideBase64, sideFileName);
        console.log("[Avatar Gen] Side view uploaded:", sideFileName);
      }

      // Back view
      const backPrompt = buildAvatarPrompt(config, "back");
      const backBase64 = await generateImage(backPrompt);
      if (backBase64) {
        const backFileName = `${config.name.toLowerCase().replace(/\s+/g, "-")}-back-${timestamp}.png`;
        backImageUrl = await uploadToStorage(supabase, backBase64, backFileName);
        console.log("[Avatar Gen] Back view uploaded:", backFileName);
      }
    }

    // Build character bible for production consistency
    const characterBible = {
      front_view: `${config.name}, ${config.gender}, ${config.ageRange}, ${config.ethnicity}, facing camera directly, professional attire`,
      side_view: `${config.name}, profile view, same person as front view, identical outfit and hair`,
      back_view: `${config.name}, back view, same outfit and hairstyle, facing away`,
      hair_description: `Professional hairstyle appropriate for ${config.gender} ${config.ageRange} individual`,
      clothing_description: config.clothing || "Professional business attire, well-fitted suit or blazer",
      body_type: "Average professional build, well-proportioned",
      distinguishing_features: [
        `${config.ethnicity} features`,
        config.personality ? `${config.personality} demeanor` : "Confident demeanor",
      ],
      negative_prompts: [
        "different person",
        "face morphing",
        "inconsistent features",
        "cartoon",
        "anime",
        "CGI",
        "artificial",
      ],
    };

    const result: GeneratedAvatar = {
      name: config.name,
      frontImageUrl,
      sideImageUrl,
      backImageUrl,
      characterBible,
    };

    console.log("[Avatar Gen] Successfully generated avatar:", config.name);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Avatar Gen] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
