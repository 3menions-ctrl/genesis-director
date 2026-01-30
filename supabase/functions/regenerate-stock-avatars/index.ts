import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Avatars that need regeneration (currently using stock photos)
const AVATARS_TO_REGENERATE = [
  { id: "0e6cd698-d396-4516-a551-036b3b99fb85", name: "Sarah Mitchell", gender: "female", ethnicity: "Caucasian", style: "corporate", personality: "Confident business leader" },
  { id: "119f769f-6f17-476b-86e9-0b3a80b9b2a5", name: "Elena Rodriguez", gender: "female", ethnicity: "Hispanic", style: "corporate", personality: "Warm and professional" },
  { id: "80aa6e91-570f-463f-b3dc-d9d634d57ccf", name: "Alex Turner", gender: "male", ethnicity: "Caucasian", style: "influencer", personality: "Charismatic content creator" },
  { id: "114aa466-a38b-484b-a40e-9eb92d62a15b", name: "Maya Johnson", gender: "female", ethnicity: "African-American", style: "creative", personality: "Artistic and expressive" },
  { id: "e28915d1-2680-4e7d-80c2-7add5ff272f3", name: "James Park", gender: "male", ethnicity: "Korean", style: "entertainment", personality: "Energetic entertainer" },
  { id: "de0f71de-03d2-4f82-bd40-7b8a32dd69de", name: "Sophia Williams", gender: "female", ethnicity: "Mixed", style: "wellness", personality: "Calm and nurturing" },
  { id: "6c5a5ed0-e37b-47df-92ca-661d3106c805", name: "Dr. Robert Hayes", gender: "male", ethnicity: "Caucasian", style: "educational", personality: "Authoritative expert" },
  { id: "530f05fa-d68f-4f4e-a0d1-c25c28f5ca23", name: "Michael Foster", gender: "male", ethnicity: "Caucasian", style: "corporate", personality: "Friendly executive" },
  { id: "fd279b7c-5f14-4af1-b96f-f207998e7113", name: "Dr. Aisha Mensah", gender: "female", ethnicity: "African", style: "educational", personality: "Brilliant researcher" },
  { id: "ed4748f3-8c24-4659-963e-fca0d7db295e", name: "Chris Martinez", gender: "male", ethnicity: "Hispanic", style: "casual", personality: "Approachable and fun" },
  { id: "21787b56-75f0-452a-992a-15d1b6fe18c9", name: "Emma Thompson", gender: "female", ethnicity: "British", style: "luxury", personality: "Elegant sophisticate" },
  { id: "fa831a9e-101e-4327-afba-4686855d4566", name: "Kevin Liu", gender: "male", ethnicity: "Chinese", style: "tech", personality: "Tech visionary" },
  { id: "4c288d1e-a400-48fe-85fb-819b0738749c", name: "Olivia Brown", gender: "female", ethnicity: "Caucasian", style: "lifestyle", personality: "Relatable friend" },
  { id: "4fb7291d-fa82-469c-92db-df11ff876c3e", name: "Richard Sterling", gender: "male", ethnicity: "Caucasian", style: "luxury", personality: "Distinguished gentleman" },
  { id: "9bc97466-5bc1-4c6a-a6e2-3c7d9f8d5ea0", name: "Nina Volkov", gender: "female", ethnicity: "Russian", style: "fashion", personality: "Bold trendsetter" },
  { id: "a4de9532-ced0-4aea-8e19-5232a75d138c", name: "Thomas Wright", gender: "male", ethnicity: "Caucasian", style: "sports", personality: "Athletic motivator" },
  { id: "a11ee724-d1f4-49a1-8a51-11322f278120", name: "Isabella Santos", gender: "female", ethnicity: "Brazilian", style: "entertainment", personality: "Vibrant performer" },
];

// Build CGI full-body avatar prompt
function buildFullBodyPrompt(avatar: typeof AVATARS_TO_REGENERATE[0]): string {
  const genderDesc = avatar.gender === "male" 
    ? "handsome man with strong features" 
    : "beautiful woman with refined features";
  
  return `High-quality AI-generated 3D rendered FULL BODY character portrait for video production. Digital art style avatar.

CHARACTER: ${avatar.name}, a ${genderDesc}, ${avatar.ethnicity} ethnicity.
PERSONALITY: ${avatar.personality}

CRITICAL - FULL BODY COMPOSITION:
- Show the COMPLETE body from head to feet
- Standing in a natural, confident pose with weight balanced
- Full figure visible including legs and feet
- Camera positioned to capture entire body in frame
- Character centered with some breathing room around edges

RENDER STYLE (CGI/3D - NOT PHOTOGRAPHY):
- Stylized 3D CGI character like Pixar or modern AI video generation
- Smooth, clean digital skin with subtle subsurface scattering
- Soft cinematic lighting with rim light accents
- Clean, polished Unreal Engine 5 or Octane render aesthetic
- NOT a photograph - clearly digital art style

CHARACTER DESIGN:
- ${avatar.gender === "male" ? "Strong jaw, clean-shaven or light stubble" : "Elegant features, refined proportions"}
- Expressive, friendly eyes with catch lights
- ${avatar.personality} expression and body language
- Natural standing pose, slightly angled for dynamism

OUTFIT (${avatar.style.toUpperCase()} STYLE):
- ${avatar.style === "corporate" ? "Professional blazer, dress shirt, tailored pants, dress shoes" : ""}
- ${avatar.style === "casual" ? "Stylish casual wear - fitted jeans, modern sneakers, quality t-shirt or henley" : ""}
- ${avatar.style === "luxury" ? "High-end designer outfit, elegant accessories, premium fabrics" : ""}
- ${avatar.style === "creative" ? "Artistic trendy clothing, unique accessories, creative flair" : ""}
- ${avatar.style === "wellness" ? "Comfortable athleisure, yoga-inspired outfit, natural fabrics" : ""}
- ${avatar.style === "educational" ? "Smart casual with glasses optional, approachable professor look" : ""}
- ${avatar.style === "influencer" ? "Trendy streetwear, bold colors, statement pieces" : ""}
- ${avatar.style === "tech" ? "Modern minimalist tech-inspired outfit, sleek accessories" : ""}
- ${avatar.style === "fashion" ? "High fashion editorial look, bold styling choices" : ""}
- ${avatar.style === "sports" ? "Athletic wear, sporty accessories, dynamic pose" : ""}
- ${avatar.style === "entertainment" ? "Showbiz glamour, stage-ready outfit" : ""}
- ${avatar.style === "lifestyle" ? "Approachable everyday stylish outfit" : ""}

BACKGROUND: Clean gradient studio background, dark with subtle color accent. Professional portrait setting.

TECHNICAL: Hyper-detailed 8K render, volumetric lighting, no noise or artifacts. Full body from head to toe visible.

CRITICAL: This is a CGI avatar for AI video content. Must look like high-quality 3D render (Kling, Runway, Sora style output). NOT a photograph. Stylized digital human.`;
}

async function generateImage(prompt: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  console.log("[Regen] Generating with prompt length:", prompt.length);

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
    const errorText = await response.text();
    console.error("[Regen] API error:", errorText);
    throw new Error(`Image generation failed: ${response.status}`);
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

    const body = await req.json().catch(() => ({}));
    const startIndex = body.startIndex ?? 0;
    const batchSize = body.batchSize ?? 3;

    const batch = AVATARS_TO_REGENERATE.slice(startIndex, startIndex + batchSize);
    
    if (batch.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "All avatars regenerated",
        totalProcessed: AVATARS_TO_REGENERATE.length 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[Regen] Processing batch ${startIndex}-${startIndex + batch.length - 1} of ${AVATARS_TO_REGENERATE.length}`);

    const results = [];
    
    for (const avatar of batch) {
      try {
        console.log(`[Regen] Generating: ${avatar.name}`);
        
        const prompt = buildFullBodyPrompt(avatar);
        const base64Image = await generateImage(prompt);
        
        if (!base64Image) {
          results.push({ id: avatar.id, name: avatar.name, success: false, error: "No image returned" });
          continue;
        }

        const timestamp = Date.now();
        const fileName = `${avatar.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-fullbody-${timestamp}.png`;
        const imageUrl = await uploadToStorage(supabase, base64Image, fileName);

        // Update database
        const { error: updateError } = await supabase
          .from("avatar_templates")
          .update({
            face_image_url: imageUrl,
            front_image_url: imageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", avatar.id);

        if (updateError) {
          results.push({ id: avatar.id, name: avatar.name, success: false, error: updateError.message });
        } else {
          results.push({ id: avatar.id, name: avatar.name, success: true, imageUrl });
          console.log(`[Regen] ✓ ${avatar.name} updated`);
        }
      } catch (err) {
        console.error(`[Regen] Error for ${avatar.name}:`, err);
        results.push({ id: avatar.id, name: avatar.name, success: false, error: String(err) });
      }
    }

    const nextIndex = startIndex + batchSize;
    const hasMore = nextIndex < AVATARS_TO_REGENERATE.length;

    return new Response(JSON.stringify({
      success: true,
      processed: results,
      nextIndex: hasMore ? nextIndex : null,
      hasMore,
      remaining: AVATARS_TO_REGENERATE.length - nextIndex,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[Regen] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
