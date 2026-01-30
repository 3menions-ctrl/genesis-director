import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Diverse avatar presets for a balanced library
const AVATAR_PRESETS = [
  // Professional Males
  { name: "Marcus Chen", gender: "male", ageRange: "young-adult", ethnicity: "East Asian", style: "corporate", personality: "confident and articulate", clothing: "Navy blue tailored suit with a crisp white shirt" },
  { name: "James Mitchell", gender: "male", ageRange: "middle-aged", ethnicity: "Caucasian", style: "corporate", personality: "authoritative yet approachable", clothing: "Charcoal grey three-piece suit" },
  { name: "David Okonkwo", gender: "male", ageRange: "young-adult", ethnicity: "African", style: "creative", personality: "charismatic and energetic", clothing: "Burgundy blazer over black turtleneck" },
  { name: "Raj Patel", gender: "male", ageRange: "middle-aged", ethnicity: "South Asian", style: "corporate", personality: "warm and knowledgeable", clothing: "Light grey suit with subtle pattern" },
  { name: "Carlos Rivera", gender: "male", ageRange: "young-adult", ethnicity: "Hispanic", style: "casual", personality: "friendly and relatable", clothing: "Smart casual olive blazer with white shirt" },
  { name: "Alex Thompson", gender: "male", ageRange: "mature", ethnicity: "Caucasian", style: "educational", personality: "wise and trustworthy", clothing: "Brown tweed jacket with elbow patches" },
  { name: "Kenji Yamamoto", gender: "male", ageRange: "young-adult", ethnicity: "Japanese", style: "influencer", personality: "trendy and engaging", clothing: "Modern streetwear with designer jacket" },
  { name: "Omar Hassan", gender: "male", ageRange: "middle-aged", ethnicity: "Middle Eastern", style: "luxury", personality: "sophisticated and refined", clothing: "Bespoke black suit with gold accents" },
  { name: "Michael Brooks", gender: "male", ageRange: "young-adult", ethnicity: "African American", style: "corporate", personality: "dynamic and professional", clothing: "Classic navy pinstripe suit" },
  { name: "Lucas Kim", gender: "male", ageRange: "young-adult", ethnicity: "Korean", style: "creative", personality: "innovative and cool", clothing: "Minimalist black jacket, modern cut" },

  // Professional Females
  { name: "Sarah Chen", gender: "female", ageRange: "young-adult", ethnicity: "East Asian", style: "corporate", personality: "poised and intelligent", clothing: "Elegant white blouse with tailored black blazer" },
  { name: "Emily Williams", gender: "female", ageRange: "middle-aged", ethnicity: "Caucasian", style: "corporate", personality: "confident and inspiring", clothing: "Power red blazer with black dress" },
  { name: "Amara Johnson", gender: "female", ageRange: "young-adult", ethnicity: "African American", style: "creative", personality: "vibrant and authentic", clothing: "Earth-toned wrap dress with gold jewelry" },
  { name: "Priya Sharma", gender: "female", ageRange: "young-adult", ethnicity: "South Asian", style: "corporate", personality: "graceful and articulate", clothing: "Deep purple silk blouse with fitted blazer" },
  { name: "Sofia Garcia", gender: "female", ageRange: "middle-aged", ethnicity: "Hispanic", style: "educational", personality: "nurturing and knowledgeable", clothing: "Soft teal cardigan over cream blouse" },
  { name: "Emma Laurent", gender: "female", ageRange: "young-adult", ethnicity: "French Caucasian", style: "luxury", personality: "chic and sophisticated", clothing: "Classic Parisian black dress with pearl accents" },
  { name: "Yuki Tanaka", gender: "female", ageRange: "young-adult", ethnicity: "Japanese", style: "influencer", personality: "fresh and relatable", clothing: "Trendy pastel blazer, minimalist style" },
  { name: "Fatima Al-Rashid", gender: "female", ageRange: "middle-aged", ethnicity: "Middle Eastern", style: "corporate", personality: "elegant and commanding", clothing: "Structured emerald blazer with gold details" },
  { name: "Jessica Park", gender: "female", ageRange: "young-adult", ethnicity: "Korean", style: "casual", personality: "approachable and friendly", clothing: "Soft pink blouse with modern grey cardigan" },
  { name: "Victoria Sterling", gender: "female", ageRange: "mature", ethnicity: "Caucasian", style: "luxury", personality: "distinguished and authoritative", clothing: "Ivory power suit with statement jewelry" },
];

// Build prompt for AI-rendered avatar
function buildAvatarPrompt(
  config: typeof AVATAR_PRESETS[0],
  view: "front" | "side" | "back"
): string {
  const viewInstructions = {
    front: "facing directly toward the camera, centered composition, neutral confident expression, looking at viewer",
    side: "profile view facing left, showing side of face and body clearly, same character",
    back: "back view facing away from camera, showing hair and back of outfit, same character",
  };

  const ageDescriptor = config.ageRange === "young-adult" 
    ? "in their mid-20s" 
    : config.ageRange === "middle-aged" 
    ? "in their early 40s" 
    : config.ageRange === "mature"
    ? "in their late 50s"
    : "in their 30s";

  return `High-quality AI-generated 3D rendered character portrait. Digital art style avatar of a ${config.gender} person named ${config.name}, ${ageDescriptor}, ${config.ethnicity} ethnicity. ${viewInstructions[view]}.

RENDER STYLE:
- Stylized 3D CGI character render, similar to modern AI video generation
- Slightly stylized but believable human features
- Smooth, clean skin with subtle subsurface scattering
- Soft cinematic lighting with rim lighting accents
- Clean, polished digital art aesthetic

CHARACTER DESIGN:
- ${config.gender === "male" ? "Strong jaw, clean features" : "Refined features, elegant proportions"}
- Expressive, friendly eyes with catch lights
- ${config.personality} demeanor
- Full body shot from head to mid-thigh
- Standing in a natural, confident pose

OUTFIT & STYLING:
- ${config.clothing}
- Modern, stylish appearance
- Well-designed hair with realistic strands and volume

TECHNICAL:
- Clean gradient background (dark studio with subtle color)
- Hyper-detailed 8K render quality
- Unreal Engine 5 or Octane render style
- Volumetric lighting

CRITICAL: This is a CGI avatar for AI-generated video content. The character should look like a high-quality 3D render. NOT a photograph. Stylized digital human, polished and cinematic.`;
}

// Generate image using Lovable AI Gateway (fast model for batch generation)
async function generateImage(prompt: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image", // Fast model for quick generation
        messages: [{ role: "user", content: prompt }],
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
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

// Upload base64 image to Supabase storage
async function uploadToStorage(
  supabase: any,
  base64Data: string,
  fileName: string
): Promise<string> {
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const bytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));

  const { data, error } = await supabase.storage
    .from("avatars")
    .upload(fileName, bytes, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) throw error;

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

    const { startIndex = 0, count = 1 } = await req.json();
    const endIndex = Math.min(startIndex + count, AVATAR_PRESETS.length);
    const results: any[] = [];

    for (let i = startIndex; i < endIndex; i++) {
      const preset = AVATAR_PRESETS[i];
      console.log(`[Batch] Generating ${i + 1}/${AVATAR_PRESETS.length}: ${preset.name}`);

      try {
        // Generate front view only (fast batch mode)
        const frontPrompt = buildAvatarPrompt(preset, "front");
        const frontBase64 = await generateImage(frontPrompt);
        if (!frontBase64) throw new Error("Failed to generate front view");

        const timestamp = Date.now();
        const frontFileName = `${preset.name.toLowerCase().replace(/\s+/g, "-")}-front-${timestamp}.png`;
        const frontImageUrl = await uploadToStorage(supabase, frontBase64, frontFileName);

        // Skip side/back views for speed - can be added later
        const sideImageUrl: string | undefined = undefined;
        const backImageUrl: string | undefined = undefined;

        // Build character bible
        const characterBible = {
          front_view: `${preset.name}, ${preset.gender}, ${preset.ageRange}, ${preset.ethnicity}, facing camera directly`,
          side_view: `${preset.name}, profile view, same person as front view, identical outfit`,
          back_view: `${preset.name}, back view, same outfit and hairstyle`,
          hair_description: `Professional hairstyle for ${preset.gender} ${preset.ageRange}`,
          clothing_description: preset.clothing,
          body_type: "Average professional build",
          distinguishing_features: [`${preset.ethnicity} features`, `${preset.personality} demeanor`],
          negative_prompts: ["different person", "face morphing", "inconsistent features", "photograph", "real photo"],
        };

        // Insert into avatar_templates
        const { error: insertError } = await supabase
          .from("avatar_templates")
          .upsert({
            name: preset.name,
            description: `${preset.personality} ${preset.style} presenter`,
            personality: preset.personality,
            gender: preset.gender,
            age_range: preset.ageRange,
            ethnicity: preset.ethnicity,
            style: preset.style,
            face_image_url: frontImageUrl,
            thumbnail_url: frontImageUrl,
            front_image_url: frontImageUrl,
            side_image_url: sideImageUrl,
            back_image_url: backImageUrl,
            character_bible: characterBible,
            voice_id: preset.gender === "male" ? "echo" : "nova",
            voice_provider: "openai",
            voice_name: preset.gender === "male" ? "Echo" : "Nova",
            is_active: true,
            is_premium: preset.style === "luxury",
            tags: [preset.style, preset.ageRange, preset.ethnicity.toLowerCase()],
            sort_order: i,
          }, { onConflict: "name" });

        if (insertError) {
          results.push({ name: preset.name, success: false, error: insertError.message });
        } else {
          console.log(`[Batch] Successfully generated: ${preset.name}`);
          results.push({ name: preset.name, success: true, imageUrl: frontImageUrl });
        }
      } catch (err) {
        console.error(`[Batch] Error for ${preset.name}:`, err);
        results.push({ name: preset.name, success: false, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({
        completed: results.length,
        total: AVATAR_PRESETS.length,
        nextIndex: endIndex < AVATAR_PRESETS.length ? endIndex : null,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Batch] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});