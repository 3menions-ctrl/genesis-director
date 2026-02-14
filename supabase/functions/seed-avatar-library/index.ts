import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Diverse avatar presets - from corporate to casual, artists to athletes
const AVATAR_PRESETS = [
  // === CREATIVE & ARTISTIC ===
  { name: "Luna Ramirez", gender: "female", ageRange: "young-adult", ethnicity: "Hispanic", style: "creative", personality: "dreamy and artistic", clothing: "Paint-splattered denim overalls over a vintage band tee" },
  { name: "Jasper Stone", gender: "male", ageRange: "young-adult", ethnicity: "Caucasian", style: "creative", personality: "brooding and introspective", clothing: "Black leather jacket, silver rings, messy hair" },
  { name: "Zara Obi", gender: "female", ageRange: "young-adult", ethnicity: "Nigerian", style: "creative", personality: "bold and expressive", clothing: "Colorful African print wrap dress with bold earrings" },
  
  // === CASUAL & EVERYDAY ===
  { name: "Tyler Brooks", gender: "male", ageRange: "young-adult", ethnicity: "African American", style: "casual", personality: "chill and laid-back", clothing: "Oversized hoodie and baseball cap worn backwards" },
  { name: "Mei Lin", gender: "female", ageRange: "young-adult", ethnicity: "Chinese", style: "casual", personality: "cheerful and bubbly", clothing: "Cozy oversized sweater with cute pins and patches" },
  { name: "Jake Morrison", gender: "male", ageRange: "young-adult", ethnicity: "Caucasian", style: "casual", personality: "goofy and relatable", clothing: "Flannel shirt, jeans, well-worn sneakers" },
  { name: "Aisha Patel", gender: "female", ageRange: "young-adult", ethnicity: "South Asian", style: "casual", personality: "warm and down-to-earth", clothing: "Simple kurta top with modern jeans" },
  
  // === GAMERS & TECH ===
  { name: "Kai Nakamura", gender: "male", ageRange: "young-adult", ethnicity: "Japanese", style: "influencer", personality: "energetic and competitive", clothing: "Gaming headset around neck, esports team jersey" },
  { name: "Nova Chen", gender: "female", ageRange: "young-adult", ethnicity: "Taiwanese", style: "influencer", personality: "witty and quick", clothing: "Neon-accented cyberpunk jacket, RGB lighting vibes" },
  { name: "Marcus 'Glitch' Webb", gender: "male", ageRange: "young-adult", ethnicity: "Mixed", style: "creative", personality: "nerdy and enthusiastic", clothing: "Retro gaming t-shirt, glasses, colorful LED accessories" },
  
  // === ATHLETES & FITNESS ===
  { name: "Destiny Williams", gender: "female", ageRange: "young-adult", ethnicity: "African American", style: "casual", personality: "fierce and motivating", clothing: "Sleek athletic wear, high ponytail, confident stance" },
  { name: "Mateo Santos", gender: "male", ageRange: "young-adult", ethnicity: "Brazilian", style: "casual", personality: "passionate and energetic", clothing: "Soccer jersey, athletic build, warm smile" },
  { name: "Sven Eriksson", gender: "male", ageRange: "middle-aged", ethnicity: "Scandinavian", style: "casual", personality: "calm and disciplined", clothing: "Simple athletic wear, rugged outdoor look" },
  
  // === STUDENTS & YOUNG PEOPLE ===
  { name: "Chloe Park", gender: "female", ageRange: "young-adult", ethnicity: "Korean American", style: "casual", personality: "studious but fun", clothing: "Cute cardigan, round glasses, messenger bag" },
  { name: "Darius Jackson", gender: "male", ageRange: "young-adult", ethnicity: "African American", style: "casual", personality: "ambitious and thoughtful", clothing: "College hoodie, backpack, casual confidence" },
  { name: "Freya Andersen", gender: "female", ageRange: "young-adult", ethnicity: "Danish", style: "casual", personality: "curious and adventurous", clothing: "Vintage thrift store finds, eclectic style" },
  
  // === MUSICIANS & PERFORMERS ===
  { name: "River Hayes", gender: "male", ageRange: "young-adult", ethnicity: "Mixed Indigenous", style: "creative", personality: "soulful and poetic", clothing: "Worn acoustic guitar strap visible, bohemian layers" },
  { name: "Jade Phoenix", gender: "female", ageRange: "young-adult", ethnicity: "Vietnamese American", style: "influencer", personality: "fierce and glamorous", clothing: "Glittery stage-ready outfit, bold makeup" },
  { name: "Marcus Cole", gender: "male", ageRange: "young-adult", ethnicity: "Caribbean", style: "creative", personality: "smooth and charismatic", clothing: "Stylish hat, gold chain, relaxed island vibes" },
  
  // === UNCONVENTIONAL & UNIQUE ===
  { name: "Sage Moonwhisper", gender: "female", ageRange: "young-adult", ethnicity: "Caucasian", style: "creative", personality: "mystical and serene", clothing: "Flowing bohemian dress, crystals and natural jewelry" },
  { name: "Axel Storm", gender: "male", ageRange: "young-adult", ethnicity: "German", style: "creative", personality: "intense and rebellious", clothing: "Punk rock aesthetic, mohawk, tattoo visible on neck" },
  { name: "Zen Master Kim", gender: "male", ageRange: "mature", ethnicity: "Korean", style: "educational", personality: "wise and peaceful", clothing: "Simple traditional hanbok-inspired modern wear" },
  
  // === PROFESSIONALS (DIVERSE FIELDS) ===
  { name: "Dr. Amelia Foster", gender: "female", ageRange: "middle-aged", ethnicity: "Caucasian", style: "educational", personality: "brilliant and warm", clothing: "Lab coat over casual clothes, glasses on head" },
  { name: "Chef Antoine Dubois", gender: "male", ageRange: "middle-aged", ethnicity: "French African", style: "creative", personality: "passionate and perfectionist", clothing: "Chef whites with a hint of flour, warm smile" },
  { name: "Officer Maya Rodriguez", gender: "female", ageRange: "young-adult", ethnicity: "Latina", style: "corporate", personality: "brave and compassionate", clothing: "Off-duty casual but still commanding presence" },
  
  // === SENIORS & WISDOM ===
  { name: "Grandpa Joe", gender: "male", ageRange: "mature", ethnicity: "African American", style: "casual", personality: "storytelling and warm", clothing: "Comfortable cardigan, reading glasses, gentle smile" },
  { name: "Nana Beatrice", gender: "female", ageRange: "mature", ethnicity: "Caribbean", style: "casual", personality: "nurturing and funny", clothing: "Colorful headwrap, warm maternal presence" },
  
  // === CORPORATE (JUST A FEW) ===
  { name: "Victoria Chen", gender: "female", ageRange: "middle-aged", ethnicity: "Chinese American", style: "corporate", personality: "sharp and inspiring", clothing: "Power suit, minimal jewelry, commanding presence" },
  { name: "James Wright", gender: "male", ageRange: "middle-aged", ethnicity: "Caucasian", style: "corporate", personality: "trustworthy and steady", clothing: "Classic navy suit, silver watch" },
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: claimsData.claims.sub };

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
