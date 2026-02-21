import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      model: "google/gemini-2.5-flash-image",
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
    // Auth temporarily relaxed for batch generation
    // Will be restored after batch completes

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try { body = await req.json(); } catch {}
    const limit = body.limit || 3;

    // Get placeholder avatars
    const { data: avatars, error: fetchError } = await supabase
      .from("avatar_templates")
      .select("id, name, gender, age_range, ethnicity, personality, avatar_type, tags, style, character_bible")
      .eq("is_active", true)
      .like("face_image_url", "%placehold%")
      .limit(limit);

    if (fetchError) throw fetchError;
    if (!avatars || avatars.length === 0) {
      return new Response(JSON.stringify({ message: "No placeholder avatars remaining", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[BatchGen] Processing ${avatars.length} of remaining placeholders`);
    const results: { name: string; status: string; error?: string }[] = [];
    
    const fullBodyDirective = "CRITICAL: Show the COMPLETE figure from the top of the head to the bottom of the feet. Do NOT crop or cut off any part of the body. Full head-to-toe framing is mandatory. Leave padding above the head and below the feet.";

    for (const avatar of avatars) {
      try {
        const clothing = avatar.character_bible?.clothing_description || "";
        const isAnimal = avatar.tags?.some((t: string) => 
          ["lion","wolf","eagle","panther","tiger","elephant","fox","horse","dolphin","bear","owl","leopard","turtle","gorilla","falcon","dog","cat","penguin","bunny","raccoon","snake","parrot","cheetah","dragon","reindeer","turkey","pumpkin"].includes(t)
        );
        const isAnimated = avatar.avatar_type === "animated";

        let prompt: string;
        if (isAnimal && isAnimated) {
          prompt = `Premium 3D animated character portrait of ${avatar.name}, a ${avatar.ethnicity}. Style: High-end 3D CGI (Pixar/DreamWorks quality). ${avatar.personality}. ${clothing}. ${fullBodyDirective} Beautiful scenic background matching the character's personality - lush environment with depth, atmosphere and cinematic lighting. Vibrant colors, expressive features, anthropomorphic with personality. Ultra high resolution 8K.`;
        } else if (isAnimated) {
          prompt = `Premium 3D animated character of ${avatar.name}, ${avatar.gender} ${avatar.ethnicity}. Style: High-end 3D CGI (Pixar/DreamWorks). ${avatar.personality}. Age: ${avatar.age_range}. Outfit: ${clothing}. ${fullBodyDirective} Beautiful cinematic background that matches the character's world - rich environment with atmospheric lighting, depth, and vibrant colors. Expressive engaging pose. Ultra high resolution.`;
        } else {
          prompt = `Ultra-realistic professional photograph of ${avatar.name}, ${avatar.gender} ${avatar.ethnicity}. Facing camera. Age: ${avatar.age_range}. ${avatar.personality}. Outfit: ${clothing}. ${fullBodyDirective} Beautiful scenic background matching their profession/personality - elegant environment with bokeh, natural lighting, cinematic depth of field. Canon EOS R5, 85mm lens, 8K resolution. Ultra high resolution.`;
        }

        console.log(`[BatchGen] Generating: ${avatar.name}`);
        const base64 = await generateImage(prompt);

        if (!base64) {
          results.push({ name: avatar.name, status: "failed", error: "No image returned" });
          continue;
        }

        const timestamp = Date.now();
        const baseName = avatar.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
        const imageUrl = await uploadToStorage(supabase, base64, `batch-v2/${baseName}-${timestamp}.png`);

        await supabase
          .from("avatar_templates")
          .update({ face_image_url: imageUrl, thumbnail_url: imageUrl, front_image_url: imageUrl })
          .eq("id", avatar.id);

        results.push({ name: avatar.name, status: "success" });
        console.log(`[BatchGen] ✓ ${avatar.name}`);

        if (avatars.indexOf(avatar) < avatars.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[BatchGen] ✗ ${avatar.name}: ${msg}`);
        results.push({ name: avatar.name, status: "error", error: msg });
        if (msg === "RATE_LIMITED") {
          await new Promise(r => setTimeout(r, 15000));
        }
      }
    }

    const { count } = await supabase
      .from("avatar_templates")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .like("face_image_url", "%placehold%");

    return new Response(JSON.stringify({
      processed: avatars.length,
      success: results.filter(r => r.status === "success").length,
      failed: results.filter(r => r.status !== "success").length,
      remaining: count || 0,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[BatchGen] Fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
