import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Animated avatars that need full-body regeneration
const ANIMATED_AVATARS = [
  { id: "6c3d1171-0e27-4eb8-850c-0a7d991c35f9", name: "Alex Thompson", gender: "male", ethnicity: "Caucasian", style: "tech", personality: "Innovative tech entrepreneur" },
  { id: "437e0a31-919c-4e2f-b37e-481b252ae3b5", name: "Amara Johnson", gender: "female", ethnicity: "African-American", style: "corporate", personality: "Confident business strategist" },
  { id: "1bb8c2ce-534b-4aed-8bf8-b9122173def3", name: "Carlos Rivera", gender: "male", ethnicity: "Hispanic", style: "casual", personality: "Friendly community builder" },
  { id: "172c51aa-08b0-418b-a317-7bd1d7fd9bde", name: "David Okonkwo", gender: "male", ethnicity: "Nigerian", style: "corporate", personality: "Distinguished executive" },
  { id: "2495446d-2706-47be-ae19-c3bf2994f948", name: "Emily Williams", gender: "female", ethnicity: "Caucasian", style: "creative", personality: "Artistic storyteller" },
  { id: "7fd69fc9-2388-4e5f-98d7-1b4df6a00279", name: "Emma Laurent", gender: "female", ethnicity: "French", style: "fashion", personality: "Sophisticated style icon" },
  { id: "51150ea3-53a6-4e48-b225-129eb6ab05ee", name: "Fatima Al-Rashid", gender: "female", ethnicity: "Middle Eastern", style: "educational", personality: "Wise knowledge curator" },
  { id: "60ef02ce-8230-4cef-92b0-86d52024e9d3", name: "James Mitchell", gender: "male", ethnicity: "Caucasian", style: "sports", personality: "Dynamic fitness coach" },
  { id: "64f159ca-62f9-4e6c-8510-455bde14872c", name: "Jessica Park", gender: "female", ethnicity: "Korean", style: "tech", personality: "Innovative developer" },
  { id: "ac6fc357-1e32-4241-9999-ff3da5c24be5", name: "Kenji Yamamoto", gender: "male", ethnicity: "Japanese", style: "creative", personality: "Visionary artist" },
  { id: "d0fda87e-9c96-49b4-afe9-c9f1f4a72dc1", name: "Marcus Chen", gender: "male", ethnicity: "Chinese", style: "entertainment", personality: "Charismatic host" },
  { id: "d4f89c76-15a2-4e8b-9123-1a2b3c4d5e6f", name: "Priya Sharma", gender: "female", ethnicity: "Indian", style: "wellness", personality: "Mindful wellness guide" },
  { id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", name: "Rachel Kim", gender: "female", ethnicity: "Korean-American", style: "influencer", personality: "Trendsetting creator" },
  { id: "b2c3d4e5-f6a7-8901-bcde-f12345678901", name: "Samuel Adeyemi", gender: "male", ethnicity: "African", style: "educational", personality: "Inspiring educator" },
  { id: "c3d4e5f6-a7b8-9012-cdef-123456789012", name: "Victoria Chen", gender: "female", ethnicity: "Chinese", style: "luxury", personality: "Refined luxury curator" },
];

// Build stylized 3D full-body avatar prompt
function buildAnimatedFullBodyPrompt(avatar: typeof ANIMATED_AVATARS[0]): string {
  const genderDesc = avatar.gender === "male" 
    ? "handsome male character with strong, appealing features" 
    : "beautiful female character with elegant, appealing features";
  
  return `High-quality stylized 3D character render of a ${genderDesc}, ${avatar.ethnicity} ethnicity, named ${avatar.name}.

CRITICAL - 3D ANIMATED STYLE:
- Premium Pixar/Disney-quality 3D character
- Stylized proportions - slightly larger eyes, refined features
- Smooth, polished skin with subtle subsurface scattering
- High-end CGI render quality (Unreal Engine 5 / Octane render quality)
- Clean, appealing character design with personality
- NOT photorealistic - clearly stylized 3D animated character

CRITICAL - FULL BODY COMPOSITION:
- FULL BODY shot from head to feet - entire character must be visible
- Standing in a confident, dynamic pose
- Full figure including legs and stylized shoes clearly visible
- Character centered in frame with proper spacing
- Leave adequate space above head and below feet
- Visible floor/ground plane for grounding

LIGHTING & RENDERING:
- Professional studio lighting with dramatic rim light
- Soft diffused key light with warm tones
- Cool fill light for contrast and depth
- Subtle ambient occlusion for depth
- High-quality ray-traced global illumination
- Clean background gradient (dark to light gray)

CHARACTER - ${avatar.name}:
- ${avatar.personality}
- Expressive, warm, approachable expression
- Confident body language with slight dynamic pose
- Apparent age: early to mid 30s
- Clear personality visible through pose and expression

OUTFIT (${avatar.style.toUpperCase()} STYLE):
${avatar.style === "corporate" ? "- Stylish modern business suit, tailored fit, polished dress shoes, professional accessories" : ""}
${avatar.style === "casual" ? "- Trendy casual wear - designer jeans, fitted top, fashionable sneakers, relaxed vibe" : ""}
${avatar.style === "luxury" ? "- High-end designer ensemble, elegant accessories, premium leather shoes" : ""}
${avatar.style === "creative" ? "- Artistic contemporary outfit, unique patterns, creative accessories, stylish boots" : ""}
${avatar.style === "wellness" ? "- Premium athleisure wear, comfortable yet stylish, quality athletic footwear" : ""}
${avatar.style === "educational" ? "- Smart professional attire, approachable styling, comfortable professional shoes" : ""}
${avatar.style === "influencer" ? "- On-trend streetwear, statement accessories, designer sneakers" : ""}
${avatar.style === "tech" ? "- Modern minimalist tech-bro aesthetic, clean lines, contemporary footwear" : ""}
${avatar.style === "fashion" ? "- High fashion editorial outfit, bold styling choices, statement shoes" : ""}
${avatar.style === "sports" ? "- Premium athletic wear, dynamic sporty look, performance sneakers" : ""}
${avatar.style === "entertainment" ? "- Showstopper outfit, glamorous details, eye-catching footwear" : ""}

BACKGROUND: Clean gradient studio backdrop, subtle vignette, professional 3D character showcase lighting.

ABSOLUTE REQUIREMENTS:
- Premium 3D animated character quality (Pixar/Disney level)
- Full body visible from head to toe including feet and shoes
- Clearly stylized (not photorealistic)
- Professional character art suitable for video presentations
- Appealing, friendly character design`;
}

async function generateImage(prompt: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  console.log("[AnimatedRegen] Generating stylized 3D avatar...");

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
    console.error("[AnimatedRegen] API error:", errorText);
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
    
    // Allow regenerating by avatar ID or by batch
    const avatarId = body.avatarId;
    const startIndex = body.startIndex ?? 0;
    const batchSize = body.batchSize ?? 1; // Default to 1 for safety

    let avatarsToProcess: typeof ANIMATED_AVATARS = [];

    if (avatarId) {
      // Find specific avatar
      const avatar = ANIMATED_AVATARS.find(a => a.id === avatarId);
      if (avatar) {
        avatarsToProcess = [avatar];
      } else {
        return new Response(JSON.stringify({ 
          error: "Avatar not found in animated list" 
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      // Batch processing
      avatarsToProcess = ANIMATED_AVATARS.slice(startIndex, startIndex + batchSize);
    }
    
    if (avatarsToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "All animated avatars regenerated",
        totalProcessed: ANIMATED_AVATARS.length 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[AnimatedRegen] Processing ${avatarsToProcess.length} avatar(s)`);

    const results = [];
    
    for (const avatar of avatarsToProcess) {
      try {
        console.log(`[AnimatedRegen] Generating: ${avatar.name}`);
        
        const prompt = buildAnimatedFullBodyPrompt(avatar);
        const base64Image = await generateImage(prompt);
        
        if (!base64Image) {
          results.push({ id: avatar.id, name: avatar.name, success: false, error: "No image returned" });
          continue;
        }

        const timestamp = Date.now();
        const fileName = `${avatar.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-animated-fullbody-${timestamp}.png`;
        const imageUrl = await uploadToStorage(supabase, base64Image, fileName);

        // Update database - ensure avatar_type is set to 'animated'
        const { error: updateError } = await supabase
          .from("avatar_templates")
          .update({
            face_image_url: imageUrl,
            front_image_url: imageUrl,
            avatar_type: "animated",
            updated_at: new Date().toISOString(),
          })
          .eq("id", avatar.id);

        if (updateError) {
          results.push({ id: avatar.id, name: avatar.name, success: false, error: updateError.message });
        } else {
          results.push({ id: avatar.id, name: avatar.name, success: true, imageUrl });
          console.log(`[AnimatedRegen] ✓ ${avatar.name} updated with full-body animated avatar`);
        }
      } catch (err) {
        console.error(`[AnimatedRegen] Error for ${avatar.name}:`, err);
        results.push({ id: avatar.id, name: avatar.name, success: false, error: String(err) });
      }
    }

    const nextIndex = startIndex + batchSize;
    const hasMore = !avatarId && nextIndex < ANIMATED_AVATARS.length;

    return new Response(JSON.stringify({
      success: true,
      processed: results,
      nextIndex: hasMore ? nextIndex : null,
      hasMore,
      remaining: hasMore ? ANIMATED_AVATARS.length - nextIndex : 0,
      totalAnimatedAvatars: ANIMATED_AVATARS.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[AnimatedRegen] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
