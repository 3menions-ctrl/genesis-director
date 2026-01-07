// Color Grading System Types
// Professional color correction and grading for video post-production

export type ColorGradingPreset = 
  | 'cinematic' | 'blockbuster' | 'vintage' | 'noir' 
  | 'teal-orange' | 'warm' | 'cold' | 'desaturated'
  | 'high-contrast' | 'soft' | 'moody' | 'vibrant';

export type LUTCategory = 
  | 'film-emulation' | 'color-correction' | 'creative' | 'stylized';

export interface ColorGradingConfig {
  preset: ColorGradingPreset;
  
  // Exposure adjustments
  exposure: number; // -2 to +2
  contrast: number; // 0 to 2
  highlights: number; // -100 to +100
  shadows: number; // -100 to +100
  
  // Color adjustments
  saturation: number; // 0 to 2
  vibrance: number; // 0 to 2
  temperature: number; // -100 (cold) to +100 (warm)
  tint: number; // -100 (green) to +100 (magenta)
  
  // Tone curve points (shadows, midtones, highlights)
  toneCurve?: {
    shadows: { r: number; g: number; b: number };
    midtones: { r: number; g: number; b: number };
    highlights: { r: number; g: number; b: number };
  };
  
  // Split toning
  splitToning?: {
    highlightHue: number; // 0-360
    highlightSaturation: number; // 0-100
    shadowHue: number; // 0-360
    shadowSaturation: number; // 0-100
    balance: number; // -100 to +100
  };
  
  // Film grain simulation
  grain?: {
    enabled: boolean;
    amount: number; // 0-100
    size: number; // 0.5-3
    roughness: number; // 0-100
  };
  
  // Vignette
  vignette?: {
    enabled: boolean;
    amount: number; // 0-100
    roundness: number; // 0-100
    feather: number; // 0-100
  };
}

export interface SceneColorProfile {
  shotId: string;
  dominantColors: string[]; // hex colors
  averageLuminance: number; // 0-255
  colorTemperature: number; // Kelvin
  contrastRatio: number;
  saturationLevel: number; // 0-1
}

export interface ColorContinuityAnalysis {
  projectId: string;
  scenes: SceneColorProfile[];
  overallConsistency: number; // 0-100
  inconsistencies: {
    shotId: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    suggestedFix: string;
  }[];
  masterPalette: string[]; // Unified color palette for the project
  lutRecommendation: ColorGradingPreset;
}

export interface ColorGradingRequest {
  projectId: string;
  shots: {
    id: string;
    videoUrl: string;
    thumbnailUrl?: string;
    currentGrading?: Partial<ColorGradingConfig>;
  }[];
  targetPreset?: ColorGradingPreset;
  matchToReference?: string; // Reference image URL for color matching
  enforceConsistency: boolean;
}

export interface ColorGradingResult {
  success: boolean;
  projectId: string;
  
  // Analysis results
  sceneProfiles?: SceneColorProfile[];
  continuityAnalysis?: ColorContinuityAnalysis;
  
  // Generated grading configurations per shot
  shotGradings?: {
    shotId: string;
    config: ColorGradingConfig;
    ffmpegFilter: string; // Ready-to-use FFmpeg filter string
  }[];
  
  // Master LUT for consistency
  masterLUT?: string; // LUT file content or URL
  
  // Prompt enhancements for video generation
  colorPromptEnhancements?: {
    shotId: string;
    prompt: string;
  }[];
  
  error?: string;
}

// Preset configurations
export const COLOR_GRADING_PRESETS: Record<ColorGradingPreset, Partial<ColorGradingConfig>> = {
  cinematic: {
    contrast: 1.15,
    saturation: 0.9,
    temperature: 5,
    shadows: -10,
    highlights: -15,
    splitToning: {
      highlightHue: 45,
      highlightSaturation: 15,
      shadowHue: 220,
      shadowSaturation: 20,
      balance: -10,
    },
  },
  blockbuster: {
    contrast: 1.25,
    saturation: 1.1,
    temperature: -5,
    vibrance: 1.15,
    splitToning: {
      highlightHue: 40,
      highlightSaturation: 25,
      shadowHue: 200,
      shadowSaturation: 35,
      balance: 0,
    },
  },
  vintage: {
    contrast: 0.9,
    saturation: 0.75,
    temperature: 20,
    highlights: 10,
    grain: { enabled: true, amount: 30, size: 1.5, roughness: 50 },
  },
  noir: {
    saturation: 0.1,
    contrast: 1.4,
    shadows: -20,
    highlights: 15,
    vignette: { enabled: true, amount: 40, roundness: 50, feather: 60 },
  },
  'teal-orange': {
    splitToning: {
      highlightHue: 30,
      highlightSaturation: 40,
      shadowHue: 190,
      shadowSaturation: 35,
      balance: -15,
    },
    saturation: 1.05,
    contrast: 1.1,
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
    vignette: { enabled: true, amount: 25, roundness: 60, feather: 70 },
  },
  vibrant: {
    saturation: 1.35,
    vibrance: 1.4,
    contrast: 1.1,
    temperature: 5,
  },
};

// FFmpeg filter generators
export function generateFFmpegColorFilter(config: ColorGradingConfig): string {
  const filters: string[] = [];
  
  // Exposure
  if (config.exposure !== 0) {
    filters.push(`exposure=${config.exposure}`);
  }
  
  // Contrast and saturation via eq filter
  filters.push(`eq=contrast=${config.contrast}:saturation=${config.saturation}`);
  
  // Color balance via colorbalance
  if (config.temperature !== 0 || config.tint !== 0) {
    const warmth = config.temperature / 100;
    const tintVal = config.tint / 100;
    filters.push(`colorbalance=rs=${warmth}:gs=${-warmth * 0.5}:bs=${-warmth}:rm=${tintVal}:gm=${-tintVal}:bm=${tintVal}`);
  }
  
  // Curves for shadows/highlights
  if (config.shadows !== 0 || config.highlights !== 0) {
    const shadowLift = 0.1 + (config.shadows / 1000);
    const highlightCompress = 0.9 - (config.highlights / 1000);
    filters.push(`curves=m='0/0 0.25/${shadowLift} 0.75/${highlightCompress} 1/1'`);
  }
  
  // Vignette
  if (config.vignette?.enabled) {
    const amount = config.vignette.amount / 100;
    filters.push(`vignette=PI*${amount}:mode=backward`);
  }
  
  // Film grain (noise)
  if (config.grain?.enabled) {
    filters.push(`noise=alls=${config.grain.amount}:allf=t+u`);
  }
  
  return filters.join(',');
}

// Build color grading prompt for AI video generation
export function buildColorGradingPrompt(preset: ColorGradingPreset): string {
  const descriptions: Record<ColorGradingPreset, string> = {
    cinematic: 'Cinematic color grading with lifted blacks, compressed highlights, subtle teal shadows and warm highlights. Professional film look.',
    blockbuster: 'Blockbuster movie color grading with high contrast, saturated colors, orange and teal color scheme.',
    vintage: 'Vintage film look with faded colors, warm tones, lifted blacks, and subtle film grain.',
    noir: 'Film noir style with high contrast black and white, deep shadows, bright highlights.',
    'teal-orange': 'Teal and orange color grading popular in Hollywood films. Cool shadows, warm skin tones.',
    warm: 'Warm color palette with golden tones, soft contrast, inviting atmosphere.',
    cold: 'Cool color palette with blue tones, high contrast, clinical or mysterious atmosphere.',
    desaturated: 'Desaturated muted colors with high contrast. Gritty, realistic feel.',
    'high-contrast': 'High contrast with deep blacks and bright whites. Punchy, dramatic look.',
    soft: 'Soft dreamy look with low contrast, lifted shadows, ethereal atmosphere.',
    moody: 'Moody atmospheric grading with muted colors, blue shadows, subtle vignette.',
    vibrant: 'Vibrant saturated colors with high contrast. Energetic, lively feel.',
  };
  
  return descriptions[preset] || 'Professional cinematic color grading';
}
