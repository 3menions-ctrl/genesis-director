import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Voice mapping
function getVoice(gender: string, personality: string): string {
  const isDeep = /wise|commanding|authoritative|fierce|strategic/i.test(personality);
  const isWarm = /warm|nurturing|gentle|friendly/i.test(personality);
  
  if (gender === "male") {
    if (isDeep) return "onyx";
    if (isWarm) return "fable";
    return "echo";
  }
  return isWarm ? "shimmer" : "nova";
}

async function generateImage(prompt: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMITED");
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

async function uploadToStorage(supabase: any, base64Data: string, fileName: string): Promise<string> {
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const bytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));

  const { data, error } = await supabase.storage
    .from("avatars")
    .upload(fileName, bytes, { contentType: "image/png", upsert: true });

  if (error) throw error;
  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(data.path);
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

    const { 
      name, gender, ageRange, ethnicity, style, personality, clothing, 
      avatarType, tags, era, secretKey 
    } = await req.json();

    // Simple auth
    if (secretKey !== "lovable-batch-2024") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const isAnimal = tags?.some((t: string) => ["lion", "wolf", "eagle", "panther", "tiger", "elephant", "fox", "horse", "dolphin", "bear", "owl", "leopard", "turtle", "gorilla", "falcon", "dog", "cat", "penguin", "bunny", "raccoon", "snake", "parrot", "cheetah", "moth", "tortoise", "frog", "panda", "octopus", "deer", "squirrel", "seahorse", "dragon"].includes(t));
    const isAnimated = avatarType === "animated";

    // Build prompt based on type
    let prompt: string;
    
    if (isAnimal && isAnimated) {
      prompt = `Premium 3D animated character portrait of ${name}, a ${ethnicity}. Style: High-end 3D CGI (Pixar/DreamWorks quality). ${personality}. ${clothing}. Full body visible, clean studio background, vibrant colors, expressive features, anthropomorphic with personality. Ultra high resolution 8K.`;
    } else if (isAnimal) {
      prompt = `Ultra-realistic professional wildlife photograph of ${name}, a ${ethnicity}. ${clothing}. ${personality}. National Geographic quality, natural lighting, full body visible, studio backdrop, 8K photorealistic. Ultra high resolution.`;
    } else if (isAnimated) {
      prompt = `Premium 3D animated character of ${name}, ${gender} ${ethnicity}. Style: High-end 3D CGI (Pixar/DreamWorks). ${personality}. Age: ${ageRange}. Outfit: ${clothing}. Full body head to toe, clean studio background, expressive engaging pose. Ultra high resolution.`;
    } else {
      // Realistic human
      prompt = `Ultra-realistic professional photograph of ${name}, ${gender} ${ethnicity}${era ? ` from ${era}` : ""}. Facing camera, full body from head to toe. Age: ${ageRange}. ${personality}. Outfit: ${clothing}. Professional studio lighting, Canon EOS R5, 85mm lens, 8K resolution, clean neutral gray background. Indistinguishable from real photograph. Ultra high resolution.`;
    }

    console.log(`[SingleAvatar] Generating: ${name}`);
    
    const base64 = await generateImage(prompt);
    if (!base64) {
      return new Response(JSON.stringify({ error: "Failed to generate image" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const timestamp = Date.now();
    const baseName = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const imageUrl = await uploadToStorage(supabase, base64, `batch-v2/${baseName}-${timestamp}.png`);

    const voice = getVoice(gender, personality);
    
    const characterBible = {
      front_view: `${name}, ${gender}, ${ethnicity}, ${personality}`,
      clothing_description: clothing,
      distinguishing_features: [personality, ...(tags || [])],
      negative_prompts: avatarType === "animated" ? ["photorealistic"] : ["cartoon", "anime"],
    };

    const { error: insertError } = await supabase.from("avatar_templates").upsert({
      name,
      description: `${personality}`,
      personality,
      gender,
      age_range: ageRange,
      ethnicity,
      style,
      avatar_type: avatarType,
      face_image_url: imageUrl,
      thumbnail_url: imageUrl,
      front_image_url: imageUrl,
      character_bible: characterBible,
      voice_id: voice,
      voice_provider: "openai",
      voice_name: voice.charAt(0).toUpperCase() + voice.slice(1),
      is_active: true,
      is_premium: style === "luxury" || (era ? true : false),
      tags,
    }, { onConflict: "name" });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[SingleAvatar] ✓ ${name} created`);

    return new Response(JSON.stringify({ 
      success: true, 
      name, 
      imageUrl,
      avatarType 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[SingleAvatar] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
