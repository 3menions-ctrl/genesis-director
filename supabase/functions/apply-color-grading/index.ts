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

// ============================================================================
// RICH COLOR DNA SYSTEM - Guarantees consistent, vibrant colors across all clips
// Colors should IMPROVE over clip sequence, never degrade
// ============================================================================

interface ColorDNA {
  // Primary palette lock
  primaryHue: string;      // e.g., "warm golden", "cool steel blue"
  secondaryHue: string;    // e.g., "deep teal", "soft amber"
  accentColor: string;     // e.g., "vibrant orange", "electric blue"
  
  // Richness guarantees
  saturationFloor: number; // Minimum saturation (0-100), never go below
  vibranceTarget: number;  // Target vibrance level
  contrastAnchor: string;  // e.g., "high contrast with deep shadows"
  
  // Consistency anchors
  skinToneGuide: string;   // How skin tones should render
  shadowTone: string;      // Shadow color cast
  highlightTone: string;   // Highlight color cast
  
  // Anti-degradation
  forbiddenDrift: string[];  // Colors to avoid drifting toward
}

// Build COLOR DNA for each preset - these are MANDATORY color locks
const COLOR_DNA_PRESETS: Record<ColorGradingPreset, ColorDNA> = {
  cinematic: {
    primaryHue: 'warm amber-gold highlights',
    secondaryHue: 'cool teal-blue shadows',
    accentColor: 'rich skin tones preserved',
    saturationFloor: 70,
    vibranceTarget: 85,
    contrastAnchor: 'crushed blacks with creamy highlights, 1.15:1 contrast ratio',
    skinToneGuide: 'warm healthy skin tones with natural flush',
    shadowTone: 'teal-shifted cool shadows',
    highlightTone: 'golden warm highlights',
    forbiddenDrift: ['washed out', 'gray', 'muddy', 'desaturated', 'flat colors'],
  },
  blockbuster: {
    primaryHue: 'saturated orange-amber',
    secondaryHue: 'deep teal-cyan',
    accentColor: 'punchy complementary colors',
    saturationFloor: 80,
    vibranceTarget: 95,
    contrastAnchor: 'high contrast with deep blacks and bright highlights',
    skinToneGuide: 'slightly warm bronzed skin tones',
    shadowTone: 'rich teal shadows',
    highlightTone: 'orange-gold highlights',
    forbiddenDrift: ['muted', 'pastel', 'washed out', 'dull', 'gray'],
  },
  vintage: {
    primaryHue: 'sepia-warm golden',
    secondaryHue: 'faded cream-brown',
    accentColor: 'muted earth tones',
    saturationFloor: 55,
    vibranceTarget: 65,
    contrastAnchor: 'lifted blacks with soft milky highlights',
    skinToneGuide: 'warm slightly desaturated skin with nostalgic glow',
    shadowTone: 'warm brown shadows',
    highlightTone: 'creamy yellow-white highlights',
    forbiddenDrift: ['cold blue', 'harsh contrast', 'neon', 'oversaturated'],
  },
  noir: {
    primaryHue: 'rich deep black',
    secondaryHue: 'pure stark white',
    accentColor: 'dramatic contrast zones',
    saturationFloor: 5,
    vibranceTarget: 15,
    contrastAnchor: 'extreme contrast with inky blacks and blown highlights',
    skinToneGuide: 'high contrast skin with dramatic shadows',
    shadowTone: 'pure black shadows',
    highlightTone: 'pure white highlights',
    forbiddenDrift: ['colorful', 'warm tints', 'low contrast'],
  },
  'teal-orange': {
    primaryHue: 'rich orange-amber',
    secondaryHue: 'deep teal-cyan',
    accentColor: 'complementary color pop',
    saturationFloor: 75,
    vibranceTarget: 90,
    contrastAnchor: 'strong contrast with color separation',
    skinToneGuide: 'warm orange-shifted healthy skin tones',
    shadowTone: 'teal-cyan shadows',
    highlightTone: 'warm orange highlights',
    forbiddenDrift: ['gray', 'neutral', 'desaturated', 'muddy'],
  },
  warm: {
    primaryHue: 'golden amber warmth',
    secondaryHue: 'soft honey-brown',
    accentColor: 'sunset orange accents',
    saturationFloor: 70,
    vibranceTarget: 80,
    contrastAnchor: 'soft pleasing contrast with warm glow',
    skinToneGuide: 'glowing warm healthy skin tones',
    shadowTone: 'warm brown shadows',
    highlightTone: 'golden yellow highlights',
    forbiddenDrift: ['cold blue', 'gray', 'harsh', 'clinical'],
  },
  cold: {
    primaryHue: 'steel blue',
    secondaryHue: 'icy cyan',
    accentColor: 'cool white highlights',
    saturationFloor: 60,
    vibranceTarget: 75,
    contrastAnchor: 'high contrast with clinical precision',
    skinToneGuide: 'slightly cool pale skin tones',
    shadowTone: 'blue-shifted shadows',
    highlightTone: 'cool white-blue highlights',
    forbiddenDrift: ['warm', 'yellow', 'orange', 'cozy'],
  },
  desaturated: {
    primaryHue: 'muted earth tones',
    secondaryHue: 'neutral gray-green',
    accentColor: 'selective color pops',
    saturationFloor: 35,
    vibranceTarget: 50,
    contrastAnchor: 'gritty high contrast',
    skinToneGuide: 'realistic slightly desaturated skin',
    shadowTone: 'neutral gray shadows',
    highlightTone: 'creamy white highlights',
    forbiddenDrift: ['vibrant', 'saturated', 'colorful', 'candy colors'],
  },
  'high-contrast': {
    primaryHue: 'saturated punchy colors',
    secondaryHue: 'deep rich blacks',
    accentColor: 'bright vivid accents',
    saturationFloor: 80,
    vibranceTarget: 95,
    contrastAnchor: 'extreme contrast with crushed blacks and bright highlights',
    skinToneGuide: 'bold saturated skin tones',
    shadowTone: 'deep pure black shadows',
    highlightTone: 'bright vibrant highlights',
    forbiddenDrift: ['flat', 'low contrast', 'washed out', 'muddy'],
  },
  soft: {
    primaryHue: 'pastel dreamy tones',
    secondaryHue: 'creamy whites',
    accentColor: 'soft romantic colors',
    saturationFloor: 60,
    vibranceTarget: 70,
    contrastAnchor: 'low contrast with lifted shadows and soft highlights',
    skinToneGuide: 'soft glowing healthy skin',
    shadowTone: 'lifted soft shadows',
    highlightTone: 'creamy bloom highlights',
    forbiddenDrift: ['harsh', 'high contrast', 'punchy', 'gritty'],
  },
  moody: {
    primaryHue: 'deep muted blues',
    secondaryHue: 'desaturated earth tones',
    accentColor: 'selective warm accents',
    saturationFloor: 50,
    vibranceTarget: 65,
    contrastAnchor: 'atmospheric contrast with vignette',
    skinToneGuide: 'slightly cool contemplative skin tones',
    shadowTone: 'blue-tinted deep shadows',
    highlightTone: 'muted cool highlights',
    forbiddenDrift: ['bright', 'cheerful', 'vibrant', 'warm'],
  },
  vibrant: {
    primaryHue: 'rich saturated primaries',
    secondaryHue: 'bold vivid secondaries',
    accentColor: 'electric accent colors',
    saturationFloor: 90,
    vibranceTarget: 100,
    contrastAnchor: 'punchy high contrast with color pop',
    skinToneGuide: 'healthy glowing saturated skin',
    shadowTone: 'colored rich shadows',
    highlightTone: 'bright vivid highlights',
    forbiddenDrift: ['muted', 'desaturated', 'gray', 'flat', 'dull'],
  },
};

// Generate MANDATORY color grading prompt for AI video generation
// This creates an UNBREAKABLE color contract that improves clip quality
function generateColorPrompt(preset: ColorGradingPreset): string {
  const dna = COLOR_DNA_PRESETS[preset];
  
  // Build comprehensive color enforcement prompt
  const parts = [
    `[COLOR DNA LOCK: ${preset.toUpperCase()} GRADE]`,
    `Primary: ${dna.primaryHue}.`,
    `Secondary: ${dna.secondaryHue}.`,
    `Contrast: ${dna.contrastAnchor}.`,
    `Skin tones: ${dna.skinToneGuide}.`,
    `Shadows: ${dna.shadowTone}.`,
    `Highlights: ${dna.highlightTone}.`,
    `MINIMUM saturation: ${dna.saturationFloor}%.`,
    `Target vibrance: ${dna.vibranceTarget}%.`,
    `FORBIDDEN: ${dna.forbiddenDrift.join(', ')}.`,
    'Colors must be RICH and CONSISTENT throughout. NO color degradation allowed.',
  ];
  
  return parts.join(' ');
}

// Generate short color anchor for prompt prefix (used in every clip)
function generateColorAnchor(preset: ColorGradingPreset): string {
  const dna = COLOR_DNA_PRESETS[preset];
  return `Rich ${preset} color grade: ${dna.primaryHue}, ${dna.secondaryHue}. ${dna.contrastAnchor}. Saturation min ${dna.saturationFloor}%. NEVER: ${dna.forbiddenDrift.slice(0, 3).join(', ')}.`;
}

// Generate progressive color enhancement (colors get RICHER over sequence)
function generateProgressiveColorBoost(preset: ColorGradingPreset, clipIndex: number, totalClips: number): string {
  const dna = COLOR_DNA_PRESETS[preset];
  
  // Calculate progressive boost (clips get slightly richer as we go)
  const progressRatio = clipIndex / Math.max(1, totalClips - 1);
  const saturationBoost = Math.round(progressRatio * 5); // Up to +5% saturation
  const vibranceBoost = Math.round(progressRatio * 8);   // Up to +8% vibrance
  
  return `[PROGRESSIVE COLOR: Clip ${clipIndex + 1}/${totalClips}. ` +
    `Saturation: ${dna.saturationFloor + saturationBoost}% min. ` +
    `Vibrance: ${dna.vibranceTarget + vibranceBoost}% target. ` +
    `Colors should be RICHER than previous clips, never duller.]`;
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
      colorAnchor: string;
      progressiveBoost: string;
    }[] = [];

    // Determine master preset (either from request or analyze first shot)
    let masterPreset = targetPreset;
    if (!masterPreset && shots.length > 0) {
      masterPreset = analyzeShot(shots[0].description, shots[0].mood);
    }
    masterPreset = masterPreset || 'cinematic';

    console.log(`[Color Grading] Master preset: ${masterPreset}`);
    console.log(`[Color Grading] Color DNA locked:`, COLOR_DNA_PRESETS[masterPreset]);

    const totalShots = shots.length;
    
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      
      // ALWAYS use master preset for color consistency (enforceConsistency should be true for production)
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
      const colorAnchor = generateColorAnchor(preset);
      const progressiveBoost = generateProgressiveColorBoost(preset, i, totalShots);
      
      shotGradings.push({
        shotId: shot.id,
        preset,
        config,
        ffmpegFilter,
        colorPrompt,
        colorAnchor,
        progressiveBoost,
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
    console.log(`[Color Grading] Generated ${shotGradings.length} color locks with progressive boosting`);

    // Generate master color DNA for the entire project
    const masterColorDNA = COLOR_DNA_PRESETS[masterPreset];

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        masterPreset: masterPreset,
        masterFFmpegFilter: generateFFmpegFilter(COLOR_GRADING_PRESETS[masterPreset]),
        masterColorPrompt: generateColorPrompt(masterPreset),
        masterColorAnchor: generateColorAnchor(masterPreset),
        masterColorDNA: masterColorDNA,
        consistencyScore,
        shotGradings: shotGradings.map((g, idx) => ({
          shotId: g.shotId,
          preset: g.preset,
          ffmpegFilter: g.ffmpegFilter,
          colorPrompt: g.colorPrompt,
          colorAnchor: g.colorAnchor,
          progressiveBoost: g.progressiveBoost,
          clipIndex: idx,
          totalClips: totalShots,
        })),
        // ENHANCED: Full color prompt with progressive boosting
        colorPromptEnhancements: shotGradings.map((g, idx) => ({
          shotId: g.shotId,
          prompt: `${g.colorAnchor} ${g.progressiveBoost}`,
          fullPrompt: g.colorPrompt,
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