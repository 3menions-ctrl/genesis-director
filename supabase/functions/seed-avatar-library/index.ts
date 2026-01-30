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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, startIndex = 0, count = 1 } = body;

    if (action === "list-presets") {
      return new Response(JSON.stringify({ presets: AVATAR_PRESETS }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate") {
      const results: any[] = [];
      const endIndex = Math.min(startIndex + count, AVATAR_PRESETS.length);

      for (let i = startIndex; i < endIndex; i++) {
        const preset = AVATAR_PRESETS[i];
        console.log(`[Seed] Generating avatar ${i + 1}/${AVATAR_PRESETS.length}: ${preset.name}`);

        try {
          // Call generate-avatar-image function
          const genResponse = await fetch(
            `${supabaseUrl}/functions/v1/generate-avatar-image`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: preset.name,
                gender: preset.gender,
                ageRange: preset.ageRange,
                ethnicity: preset.ethnicity,
                style: preset.style,
                personality: preset.personality,
                clothing: preset.clothing,
                generateAllViews: true,
              }),
            }
          );

          if (!genResponse.ok) {
            const errorText = await genResponse.text();
            console.error(`[Seed] Failed to generate ${preset.name}:`, errorText);
            results.push({ name: preset.name, success: false, error: errorText });
            continue;
          }

          const generated = await genResponse.json();

          // Insert into avatar_templates table
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
              face_image_url: generated.frontImageUrl,
              thumbnail_url: generated.frontImageUrl,
              front_image_url: generated.frontImageUrl,
              side_image_url: generated.sideImageUrl,
              back_image_url: generated.backImageUrl,
              character_bible: generated.characterBible,
              voice_id: "alloy", // Default OpenAI voice
              voice_provider: "openai",
              voice_name: preset.gender === "male" ? "Echo" : "Nova",
              is_active: true,
              is_premium: preset.style === "luxury",
              tags: [preset.style, preset.ageRange, preset.ethnicity.toLowerCase()],
              sort_order: i,
            }, { onConflict: "name" });

          if (insertError) {
            console.error(`[Seed] Failed to insert ${preset.name}:`, insertError);
            results.push({ name: preset.name, success: false, error: insertError.message });
          } else {
            console.log(`[Seed] Successfully created avatar: ${preset.name}`);
            results.push({ name: preset.name, success: true, imageUrl: generated.frontImageUrl });
          }
        } catch (err) {
          console.error(`[Seed] Error generating ${preset.name}:`, err);
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
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Seed Avatars] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Seeding failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
