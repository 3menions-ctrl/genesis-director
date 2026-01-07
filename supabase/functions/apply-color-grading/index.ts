import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Color Grading Engine
 * 
 * Professional color correction and grading for video post-production:
 * 1. Analyzes scene color profiles for consistency
 * 2. Generates FFmpeg filter chains for color grading
 * 3. Creates prompt enhancements for AI video generation
 * 4. Ensures visual continuity across scenes
 */

type ColorGradingPreset = 
  | 'cinematic' | 'blockbuster' | 'vintage' | 'noir' 
  | 'teal-orange' | 'warm' | 'cold' | 'desaturated'
  | 'high-contrast' | 'soft' | 'moody' | 'vibrant';

interface ColorGradingRequest {
  projectId: string;
  shots: {
    id: string;
    description: string;
    mood?: string;
    environment?: string;
  }[];
  targetPreset?: ColorGradingPreset;
  enforceConsistency: boolean;
  referenceImageUrl?: string;
}

interface ColorGradingConfig {
  preset: ColorGradingPreset;
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  shadows: number;
  highlights: number;
  vibrance: number;
}

// Preset configurations
const COLOR_GRADING_PRESETS: Record<ColorGradingPreset, Partial<ColorGradingConfig>> = {
  cinematic: {
    contrast: 1.15,
    saturation: 0.9,
    temperature: 5,
    shadows: -10,
    highlights: -15,
  },
  blockbuster: {
    contrast: 1.25,
    saturation: 1.1,
    temperature: -5,
    vibrance: 1.15,
  },
  vintage: {
    contrast: 0.9,
    saturation: 0.75,
    temperature: 20,
    highlights: 10,
  },
  noir: {
    saturation: 0.1,
    contrast: 1.4,
    shadows: -20,
    highlights: 15,
  },
  'teal-orange': {
    saturation: 1.05,
    contrast: 1.1,
    temperature: 0,
  },
  warm: {
    temperature: 35,
    saturation: 1.05,
    shadows: 5,
    contrast: 1.05,
  },
  cold: {
    temperature: -30,
    saturation: 0.95,
    contrast: 1.1,
    highlights: -10,
  },
  desaturated: {
    saturation: 0.5,
    contrast: 1.15,
    vibrance: 0.7,
  },
  'high-contrast': {
    contrast: 1.4,
    shadows: -25,
    highlights: 20,
    saturation: 1.1,
  },
  soft: {
    contrast: 0.85,
    highlights: -20,
    shadows: 20,
    saturation: 0.95,
  },
  moody: {
    contrast: 1.2,
    saturation: 0.85,
    temperature: -15,
    shadows: -15,
  },
  vibrant: {
    saturation: 1.35,
    vibrance: 1.4,
    contrast: 1.1,
    temperature: 5,
  },
};

// Mood to preset mapping
const MOOD_PRESET_MAP: Record<string, ColorGradingPreset> = {
  epic: 'blockbuster',
  dramatic: 'cinematic',
  emotional: 'soft',
  action: 'high-contrast',
  mysterious: 'moody',
  dark: 'noir',
  romantic: 'warm',
  peaceful: 'soft',
  tension: 'desaturated',
  scifi: 'cold',
  vintage: 'vintage',
  vibrant: 'vibrant',
  uplifting: 'warm',
  horror: 'desaturated',
  adventure: 'blockbuster',
};

// Generate FFmpeg filter string
function generateFFmpegFilter(config: Partial<ColorGradingConfig>): string {
  const filters: string[] = [];
  
  // Contrast and saturation
  const contrast = config.contrast ?? 1.0;
  const saturation = config.saturation ?? 1.0;
  filters.push(`eq=contrast=${contrast}:saturation=${saturation}`);
  
  // Color temperature via colorbalance
  const temp = config.temperature ?? 0;
  if (temp !== 0) {
    const warmth = temp / 100;
    filters.push(`colorbalance=rs=${warmth * 0.3}:gs=${-warmth * 0.1}:bs=${-warmth * 0.3}:rm=${warmth * 0.2}:gm=0:bm=${-warmth * 0.2}`);
  }
  
  // Shadows and highlights via curves
  const shadows = config.shadows ?? 0;
  const highlights = config.highlights ?? 0;
  if (shadows !== 0 || highlights !== 0) {
    const shadowPoint = Math.max(0, Math.min(0.3, 0.15 + (shadows / 500)));
    const highlightPoint = Math.max(0.7, Math.min(1, 0.85 + (highlights / 500)));
    filters.push(`curves=m='0/0 0.15/${shadowPoint} 0.85/${highlightPoint} 1/1'`);
  }
  
  return filters.join(',');
}

// Generate color grading prompt for AI video generation
function generateColorPrompt(preset: ColorGradingPreset): string {
  const prompts: Record<ColorGradingPreset, string> = {
    cinematic: 'Cinematic color grading with lifted blacks, compressed highlights, subtle teal shadows and warm highlights. Professional film look.',
    blockbuster: 'Blockbuster movie color grading with high contrast, saturated colors, orange and teal color scheme. Hollywood production quality.',
    vintage: 'Vintage film look with faded colors, warm tones, lifted blacks, and subtle film grain. Nostalgic aesthetic.',
    noir: 'Film noir style with high contrast black and white tones, deep dramatic shadows, bright highlights. Classic cinema look.',
    'teal-orange': 'Teal and orange color grading popular in Hollywood films. Cool shadows, warm skin tones and highlights.',
    warm: 'Warm color palette with golden tones, soft contrast, inviting cozy atmosphere.',
    cold: 'Cool color palette with blue tones, high contrast, clinical or mysterious atmosphere.',
    desaturated: 'Desaturated muted colors with high contrast. Gritty, realistic documentary feel.',
    'high-contrast': 'High contrast with deep blacks and bright whites. Punchy, dramatic, impactful look.',
    soft: 'Soft dreamy look with low contrast, lifted shadows, ethereal romantic atmosphere.',
    moody: 'Moody atmospheric grading with muted colors, blue shadows, subtle vignette. Introspective.',
    vibrant: 'Vibrant saturated colors with high contrast. Energetic, lively, exciting feel.',
  };
  
  return prompts[preset];
}

// Analyze shot description for best preset
function analyzeShot(description: string, mood?: string): ColorGradingPreset {
  // Check mood first
  if (mood) {
    const moodLower = mood.toLowerCase();
    for (const [key, preset] of Object.entries(MOOD_PRESET_MAP)) {
      if (moodLower.includes(key)) {
        return preset;
      }
    }
  }
  
  // Analyze description keywords
  const descLower = description.toLowerCase();
  
  if (descLower.includes('night') || descLower.includes('dark') || descLower.includes('shadow')) {
    return 'moody';
  }
  if (descLower.includes('sunset') || descLower.includes('golden') || descLower.includes('warm')) {
    return 'warm';
  }
  if (descLower.includes('cold') || descLower.includes('ice') || descLower.includes('winter')) {
    return 'cold';
  }
  if (descLower.includes('vintage') || descLower.includes('retro') || descLower.includes('old')) {
    return 'vintage';
  }
  if (descLower.includes('action') || descLower.includes('fight') || descLower.includes('chase')) {
    return 'high-contrast';
  }
  if (descLower.includes('romantic') || descLower.includes('love') || descLower.includes('dream')) {
    return 'soft';
  }
  if (descLower.includes('horror') || descLower.includes('scary') || descLower.includes('creepy')) {
    return 'desaturated';
  }
  if (descLower.includes('epic') || descLower.includes('battle') || descLower.includes('hero')) {
    return 'blockbuster';
  }
  
  // Default to cinematic
  return 'cinematic';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ColorGradingRequest = await req.json();
    const { projectId, shots, targetPreset, enforceConsistency } = request;

    if (!projectId || !shots?.length) {
      throw new Error("projectId and shots are required");
    }

    console.log(`[Color Grading] Processing ${shots.length} shots for project ${projectId}`);
    console.log(`[Color Grading] Target preset: ${targetPreset || 'auto'}, enforce consistency: ${enforceConsistency}`);

    // Analyze each shot and determine grading
    const shotGradings: {
      shotId: string;
      preset: ColorGradingPreset;
      config: Partial<ColorGradingConfig>;
      ffmpegFilter: string;
      colorPrompt: string;
    }[] = [];

    // Determine master preset (either from request or analyze first shot)
    let masterPreset = targetPreset;
    if (!masterPreset && shots.length > 0) {
      masterPreset = analyzeShot(shots[0].description, shots[0].mood);
    }
    masterPreset = masterPreset || 'cinematic';

    console.log(`[Color Grading] Master preset: ${masterPreset}`);

    for (const shot of shots) {
      // Use master preset if enforcing consistency, otherwise analyze each shot
      const preset = enforceConsistency 
        ? masterPreset 
        : analyzeShot(shot.description, shot.mood);
      
      const config = {
        preset,
        exposure: 0,
        contrast: 1.0,
        saturation: 1.0,
        temperature: 0,
        tint: 0,
        shadows: 0,
        highlights: 0,
        vibrance: 1.0,
        ...COLOR_GRADING_PRESETS[preset],
      };
      
      const ffmpegFilter = generateFFmpegFilter(config);
      const colorPrompt = generateColorPrompt(preset);
      
      shotGradings.push({
        shotId: shot.id,
        preset,
        config,
        ffmpegFilter,
        colorPrompt,
      });
    }

    // Build consistency analysis
    const presetCounts: Record<string, number> = {};
    for (const grading of shotGradings) {
      presetCounts[grading.preset] = (presetCounts[grading.preset] || 0) + 1;
    }
    
    const dominantPreset = Object.entries(presetCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'cinematic';
    
    const consistencyScore = enforceConsistency 
      ? 100 
      : Math.round((presetCounts[dominantPreset] / shots.length) * 100);

    console.log(`[Color Grading] Consistency score: ${consistencyScore}%`);
    console.log(`[Color Grading] Dominant preset: ${dominantPreset}`);

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        masterPreset: masterPreset,
        masterFFmpegFilter: generateFFmpegFilter(COLOR_GRADING_PRESETS[masterPreset]),
        masterColorPrompt: generateColorPrompt(masterPreset),
        consistencyScore,
        shotGradings: shotGradings.map(g => ({
          shotId: g.shotId,
          preset: g.preset,
          ffmpegFilter: g.ffmpegFilter,
          colorPrompt: g.colorPrompt,
        })),
        colorPromptEnhancements: shotGradings.map(g => ({
          shotId: g.shotId,
          prompt: g.colorPrompt,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Color Grading] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Color grading failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});