import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SceneImageRequest {
  scenes: {
    sceneNumber: number;
    title?: string;
    visualDescription: string;
    characters?: string[];
    mood?: string;
  }[];
  projectId?: string;
  userId?: string;
  visualStyle?: string;
  globalStyle?: string;
  globalCharacters?: string;
  globalEnvironment?: string;
  triggerNextStage?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// CINEMATOGRAPHIC PROMPT ENGINE — Director-Level Image Generation
// Transforms basic scene descriptions into rich cinematic stills
// ═══════════════════════════════════════════════════════════════════

const CAMERA_LENSES: Record<string, string> = {
  wide: "shot on 24mm wide-angle lens, deep depth of field, expansive frame",
  medium: "shot on 50mm prime lens, natural perspective, shallow bokeh background",
  closeup: "shot on 85mm f/1.4, creamy bokeh, razor-sharp subject isolation",
  epic: "shot on 14mm ultra-wide, towering verticals, dramatic perspective distortion",
  portrait: "shot on 135mm f/2, buttery smooth background separation, flattering compression",
  cinematic: "shot on anamorphic 40mm, oval bokeh highlights, horizontal lens flare",
};

const LIGHTING_MODELS: Record<string, string> = {
  golden: "warm golden hour sunlight streaming through atmosphere, long shadows, amber tones, Terrence Malick lighting",
  dramatic: "high-contrast chiaroscuro lighting, deep blacks, volumetric light shafts, Roger Deakins inspired",
  neon: "neon-soaked urban glow, cyan and magenta color bleed, rain-slicked reflections, Blade Runner 2049 aesthetic",
  natural: "soft diffused natural light, clean shadows, true-to-life color temperature, Emmanuel Lubezki style",
  moody: "low-key atmospheric lighting, motivated practical sources, film noir shadows, Bradford Young palette",
  ethereal: "diffused backlight, lens bloom, pastel color wash, dreamy atmosphere, Hoyte van Hoytema style",
  studio: "three-point studio lighting, clean key light, subtle fill, crisp rim light, professional portrait quality",
};

const COLOR_GRADES: Record<string, string> = {
  blockbuster: "rich saturated blockbuster color grade, deep teals and warm oranges, punchy contrast",
  vintage: "desaturated warm film stock, subtle grain, lifted blacks, nostalgic color science",
  vivid: "hyper-vivid Technicolor palette, deep blacks, saturated primaries, eye-catching vibrancy",
  muted: "muted earth tones, desaturated greens and blues, sophisticated understated palette",
  cold: "cool blue-steel tones, clinical precision, ice-white highlights, David Fincher palette",
  warm: "warm amber and honey tones, inviting warmth, golden skin tones, Wes Anderson inspired",
};

/**
 * Infer the best camera, lighting, and color grade from the scene description
 */
function inferCinematicSettings(description: string, mood?: string): {
  lens: string;
  lighting: string;
  colorGrade: string;
} {
  const text = `${description} ${mood || ''}`.toLowerCase();

  // Lens selection
  let lens = CAMERA_LENSES.cinematic;
  if (text.includes('landscape') || text.includes('establishing') || text.includes('city') || text.includes('panoram')) {
    lens = CAMERA_LENSES.wide;
  } else if (text.includes('face') || text.includes('emotion') || text.includes('tears') || text.includes('eyes')) {
    lens = CAMERA_LENSES.closeup;
  } else if (text.includes('epic') || text.includes('mountain') || text.includes('tower') || text.includes('vast')) {
    lens = CAMERA_LENSES.epic;
  } else if (text.includes('portrait') || text.includes('person') || text.includes('character')) {
    lens = CAMERA_LENSES.portrait;
  }

  // Lighting selection
  let lighting = LIGHTING_MODELS.natural;
  if (text.includes('sunset') || text.includes('sunrise') || text.includes('golden') || text.includes('warm')) {
    lighting = LIGHTING_MODELS.golden;
  } else if (text.includes('dark') || text.includes('shadow') || text.includes('contrast') || text.includes('tension')) {
    lighting = LIGHTING_MODELS.dramatic;
  } else if (text.includes('neon') || text.includes('city night') || text.includes('cyber') || text.includes('rain')) {
    lighting = LIGHTING_MODELS.neon;
  } else if (text.includes('dream') || text.includes('ethereal') || text.includes('soft') || text.includes('magical')) {
    lighting = LIGHTING_MODELS.ethereal;
  } else if (text.includes('moody') || text.includes('noir') || text.includes('atmospheric')) {
    lighting = LIGHTING_MODELS.moody;
  } else if (text.includes('studio') || text.includes('interview') || text.includes('professional')) {
    lighting = LIGHTING_MODELS.studio;
  }

  // Color grade selection
  let colorGrade = COLOR_GRADES.vivid;
  if (text.includes('nostalgi') || text.includes('retro') || text.includes('memory') || text.includes('past')) {
    colorGrade = COLOR_GRADES.vintage;
  } else if (text.includes('action') || text.includes('explosion') || text.includes('chase') || text.includes('battle')) {
    colorGrade = COLOR_GRADES.blockbuster;
  } else if (text.includes('cold') || text.includes('ice') || text.includes('steel') || text.includes('clinical')) {
    colorGrade = COLOR_GRADES.cold;
  } else if (text.includes('cozy') || text.includes('warm') || text.includes('home') || text.includes('comfort')) {
    colorGrade = COLOR_GRADES.warm;
  } else if (text.includes('subtle') || text.includes('understated') || text.includes('quiet')) {
    colorGrade = COLOR_GRADES.muted;
  }

  return { lens, lighting, colorGrade };
}

/**
 * Build a director-level cinematic prompt from a basic scene description
 */
function buildCinematicPrompt(
  scene: SceneImageRequest['scenes'][0],
  globalCharacters?: string,
  globalEnvironment?: string,
  visualStyle?: string,
): string {
  const { lens, lighting, colorGrade } = inferCinematicSettings(scene.visualDescription, scene.mood);

  const parts: string[] = [];

  // Core directive
  parts.push("Ultra high-resolution cinematic film still, production-grade reference frame for a feature film");

  // Visual description (the heart of the prompt)
  parts.push(scene.visualDescription);

  // Character details
  if (scene.characters && scene.characters.length > 0) {
    parts.push(`Featuring: ${scene.characters.join(", ")}`);
  }
  if (globalCharacters) {
    parts.push(`Character details: ${globalCharacters}`);
  }

  // Environment
  if (globalEnvironment) {
    parts.push(`Environment: ${globalEnvironment}`);
  }

  // Mood
  if (scene.mood) {
    parts.push(`Mood & atmosphere: ${scene.mood}`);
  }

  // Cinematographic direction
  parts.push(lens);
  parts.push(lighting);
  parts.push(colorGrade);

  // Visual style override or default
  if (visualStyle) {
    parts.push(`Style direction: ${visualStyle}`);
  }

  // Technical quality anchors
  parts.push(
    "8K resolution, photorealistic, hyper-detailed textures, " +
    "volumetric atmosphere, physically accurate materials, " +
    "professional composition with rule of thirds, " +
    "leading lines guiding the eye, foreground-midground-background depth layers, " +
    "no text, no watermarks, no artifacts, no blur, tack-sharp focus"
  );

  return parts.join(". ");
}

// ═══════════════════════════════════════════════════════════════════
// FLUX 1.1 Pro Ultra — Replicate API (highest quality image model)
// ═══════════════════════════════════════════════════════════════════
async function generateWithFluxUltra(
  prompt: string,
  aspectRatio: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro-ultra/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          output_format: "png",
          output_quality: 100,
          prompt_upsampling: true,  // FLUX refines the prompt internally for richer results
          safety_tolerance: 5,
          raw: false,              // Let FLUX beautify
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`FLUX Ultra API error: ${response.status} - ${err}`);
  }

  const prediction = await response.json();

  // If synchronous result
  if (prediction.status === "succeeded" && prediction.output) {
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  }

  // Poll for result (FLUX Ultra can take 30-90s)
  return await pollForResult(prediction.id, apiKey, 120);
}

/**
 * Fallback to standard FLUX 1.1 Pro if Ultra is unavailable
 */
async function generateWithFluxPro(
  prompt: string,
  aspectRatio: string,
  apiKey: string,
): Promise<string> {
  console.log("[SceneImages] Falling back to FLUX 1.1 Pro...");
  const response = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          output_format: "png",
          output_quality: 100,
          prompt_upsampling: true,
          safety_tolerance: 5,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`FLUX Pro API error: ${response.status} - ${err}`);
  }

  const prediction = await response.json();
  if (prediction.status === "succeeded" && prediction.output) {
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  }
  return await pollForResult(prediction.id, apiKey, 120);
}

/**
 * Poll Replicate for prediction completion
 */
async function pollForResult(predictionId: string, apiKey: string, maxWaitSeconds: number): Promise<string> {
  const pollUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 3000));

    const pollResp = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollResp.ok) continue;
    const result = await pollResp.json();

    if (result.status === "succeeded" && result.output) {
      return Array.isArray(result.output) ? result.output[0] : result.output;
    }
    if (result.status === "failed" || result.status === "canceled") {
      throw new Error(`FLUX prediction ${result.status}: ${result.error || "unknown"}`);
    }
  }
  throw new Error(`FLUX prediction timed out after ${maxWaitSeconds}s`);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const {
      scenes,
      projectId,
      userId,
      visualStyle,
      globalStyle,
      globalCharacters,
      globalEnvironment,
      triggerNextStage,
    }: SceneImageRequest = await req.json();

    if (!scenes || scenes.length === 0) {
      throw new Error("Scenes array is required");
    }

    const effectiveProjectId = projectId || `temp-${Date.now()}`;

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const styleToUse = visualStyle || globalStyle;

    console.log(`[SceneImages] ═══ FLUX 1.1 Pro Ultra + Cinematographic Prompt Engine ═══`);
    console.log(`[SceneImages] Generating ${scenes.length} scene images for project ${effectiveProjectId}`);

    const generatedImages: { sceneNumber: number; imageUrl: string; prompt: string }[] = [];
    const MAX_CONSECUTIVE_FAILURES = 5;
    let consecutiveFailures = 0;

    for (const scene of scenes) {
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`[SceneImages] Stopping after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`);
        break;
      }

      // Build director-level cinematic prompt
      const cinematicPrompt = buildCinematicPrompt(scene, globalCharacters, globalEnvironment, styleToUse);
      console.log(`[SceneImages] Scene ${scene.sceneNumber}: "${scene.title || 'untitled'}"`);
      console.log(`[SceneImages] Prompt (${cinematicPrompt.length} chars): ${cinematicPrompt.substring(0, 250)}...`);

      try {
        // Determine aspect ratio from project context
        const aspectRatio = "16:9"; // Default cinematic widescreen

        // Try FLUX Ultra first, fall back to Pro
        let imageUrl: string;
        let engine = "flux-ultra";
        try {
          imageUrl = await generateWithFluxUltra(cinematicPrompt, aspectRatio, REPLICATE_API_KEY);
          console.log(`[SceneImages] ✅ FLUX Ultra succeeded for scene ${scene.sceneNumber}`);
        } catch (ultraError) {
          console.warn(`[SceneImages] FLUX Ultra failed, trying Pro: ${ultraError}`);
          engine = "flux-pro";
          imageUrl = await generateWithFluxPro(cinematicPrompt, aspectRatio, REPLICATE_API_KEY);
          console.log(`[SceneImages] ✅ FLUX Pro fallback succeeded for scene ${scene.sceneNumber}`);
        }

        // Download and persist to Supabase storage (FLUX URLs expire)
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          console.warn(`[SceneImages] Download failed, using direct URL for scene ${scene.sceneNumber}`);
          generatedImages.push({ sceneNumber: scene.sceneNumber, imageUrl, prompt: cinematicPrompt });
          consecutiveFailures = 0;
          continue;
        }

        const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());
        const fileName = `${effectiveProjectId}/scene-${scene.sceneNumber}-${Date.now()}.png`;

        const { error: uploadError } = await supabase.storage
          .from("scene-images")
          .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });

        if (uploadError) {
          console.error(`[SceneImages] Upload failed for scene ${scene.sceneNumber}:`, uploadError);
          // Use direct URL as fallback (will expire)
          generatedImages.push({ sceneNumber: scene.sceneNumber, imageUrl, prompt: cinematicPrompt });
        } else {
          const { data: publicUrlData } = supabase.storage.from("scene-images").getPublicUrl(fileName);
          generatedImages.push({ sceneNumber: scene.sceneNumber, imageUrl: publicUrlData.publicUrl, prompt: cinematicPrompt });
        }

        consecutiveFailures = 0;
        console.log(`[SceneImages] ✓ Scene ${scene.sceneNumber} complete (${engine})`);

        // Brief delay between scenes to be kind to Replicate
        if (scenes.indexOf(scene) < scenes.length - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }

      } catch (sceneError) {
        consecutiveFailures++;
        console.error(`[SceneImages] ✗ Scene ${scene.sceneNumber} failed:`, sceneError);
      }
    }

    console.log(`[SceneImages] Generated ${generatedImages.length}/${scenes.length} scene images`);

    // Callback continuation — trigger next pipeline stage
    if (triggerNextStage && projectId && userId && generatedImages.length > 0) {
      console.log(`[SceneImages] Triggering next pipeline stage...`);
      try {
        await supabase
          .from("movie_projects")
          .update({ scene_images: generatedImages, updated_at: new Date().toISOString() })
          .eq("id", projectId);
        console.log(`[SceneImages] ✓ Scene images persisted to DB`);

        const resumeResponse = await fetch(`${SUPABASE_URL}/functions/v1/resume-pipeline`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ projectId, userId, resumeFrom: "assets" }),
        });

        if (resumeResponse.ok) {
          console.log(`[SceneImages] ✓ Pipeline continuation triggered`);
        } else {
          const errText = await resumeResponse.text();
          console.warn(`[SceneImages] Pipeline continuation failed: ${errText.substring(0, 200)}`);
        }
      } catch (callbackError) {
        console.error(`[SceneImages] Callback error:`, callbackError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        images: generatedImages,
        totalGenerated: generatedImages.length,
        totalRequested: scenes.length,
        engine: "flux-1.1-pro-ultra",
        continuationTriggered: triggerNextStage && projectId && userId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SceneImages] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
