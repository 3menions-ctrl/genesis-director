import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Sound Effects Engine
 * 
 * Automatic SFX analysis and cue generation for video productions:
 * 1. Analyzes scene descriptions for sound-worthy elements
 * 2. Detects environments for ambient beds
 * 3. Identifies actions that need foley/SFX
 * 4. Generates mixing instructions for audio track
 */

type SFXCategory = 'ambient' | 'foley' | 'action' | 'impact' | 'transition';

type AmbientType = 
  | 'city-traffic' | 'city-night' | 'forest' | 'ocean-waves'
  | 'rain' | 'wind' | 'crowd' | 'office' | 'cafe'
  | 'space-hum' | 'machinery' | 'silence-room-tone';

interface SFXCue {
  id: string;
  category: SFXCategory;
  type: string;
  startTime: number;
  duration: number;
  volume: number;
  shotId: string;
  description: string;
}

interface AmbientBed {
  id: string;
  type: AmbientType;
  startTime: number;
  endTime: number;
  volume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
}

interface SFXRequest {
  projectId: string;
  shots: {
    id: string;
    description: string;
    durationSeconds: number;
    hasDialogue: boolean;
    environment?: string;
    mood?: string;
  }[];
  totalDuration: number;
  includeAmbient: boolean;
  includeFoley: boolean;
  includeActionSFX: boolean;
  style: 'realistic' | 'stylized' | 'minimal';
}

// Environment keyword to ambient type mapping
const ENVIRONMENT_AMBIENT_MAP: Record<string, AmbientType> = {
  city: 'city-traffic',
  urban: 'city-traffic',
  street: 'city-traffic',
  downtown: 'city-traffic',
  office: 'office',
  corporate: 'office',
  workspace: 'office',
  forest: 'forest',
  woods: 'forest',
  jungle: 'forest',
  nature: 'forest',
  beach: 'ocean-waves',
  ocean: 'ocean-waves',
  sea: 'ocean-waves',
  coast: 'ocean-waves',
  cafe: 'cafe',
  restaurant: 'cafe',
  bar: 'cafe',
  diner: 'cafe',
  space: 'space-hum',
  spaceship: 'space-hum',
  station: 'space-hum',
  factory: 'machinery',
  industrial: 'machinery',
  warehouse: 'machinery',
  night: 'city-night',
  evening: 'city-night',
  indoor: 'silence-room-tone',
  room: 'silence-room-tone',
  interior: 'silence-room-tone',
  rain: 'rain',
  storm: 'rain',
  rainy: 'rain',
  windy: 'wind',
  wind: 'wind',
  crowd: 'crowd',
  stadium: 'crowd',
  concert: 'crowd',
  party: 'crowd',
};

// Action keywords to SFX types
const ACTION_SFX_MAP: Record<string, { type: string; category: SFXCategory }[]> = {
  walk: [{ type: 'footsteps', category: 'foley' }],
  walking: [{ type: 'footsteps', category: 'foley' }],
  run: [{ type: 'running-footsteps', category: 'foley' }],
  running: [{ type: 'running-footsteps', category: 'foley' }],
  enter: [{ type: 'door-open', category: 'foley' }, { type: 'footsteps', category: 'foley' }],
  enters: [{ type: 'door-open', category: 'foley' }],
  exit: [{ type: 'footsteps', category: 'foley' }, { type: 'door-close', category: 'foley' }],
  exits: [{ type: 'door-close', category: 'foley' }],
  leaves: [{ type: 'door-close', category: 'foley' }],
  door: [{ type: 'door-open', category: 'foley' }],
  opens: [{ type: 'door-open', category: 'foley' }],
  closes: [{ type: 'door-close', category: 'foley' }],
  type: [{ type: 'keyboard-typing', category: 'foley' }],
  typing: [{ type: 'keyboard-typing', category: 'foley' }],
  phone: [{ type: 'phone-ring', category: 'foley' }],
  call: [{ type: 'phone-ring', category: 'foley' }],
  punch: [{ type: 'punch-impact', category: 'impact' }],
  hit: [{ type: 'body-impact', category: 'impact' }],
  fight: [{ type: 'punch-impact', category: 'impact' }, { type: 'cloth-rustle', category: 'foley' }],
  explosion: [{ type: 'explosion', category: 'action' }],
  explode: [{ type: 'explosion', category: 'action' }],
  car: [{ type: 'car-engine', category: 'ambient' }],
  drive: [{ type: 'car-engine', category: 'ambient' }],
  driving: [{ type: 'car-engine', category: 'ambient' }],
  glass: [{ type: 'glass-shatter', category: 'impact' }],
  break: [{ type: 'glass-shatter', category: 'impact' }],
  crash: [{ type: 'crash-impact', category: 'impact' }],
  sit: [{ type: 'cloth-rustle', category: 'foley' }],
  stand: [{ type: 'cloth-rustle', category: 'foley' }],
  paper: [{ type: 'paper-rustle', category: 'foley' }],
  write: [{ type: 'pen-writing', category: 'foley' }],
  drink: [{ type: 'glass-clink', category: 'foley' }],
  eat: [{ type: 'eating', category: 'foley' }],
  gun: [{ type: 'gunshot', category: 'action' }],
  shoot: [{ type: 'gunshot', category: 'action' }],
  sword: [{ type: 'sword-swing', category: 'action' }],
};

// Analyze description for environment
function detectEnvironment(description: string, environment?: string): AmbientType | null {
  // Check explicit environment first
  if (environment) {
    const envLower = environment.toLowerCase();
    for (const [keyword, ambientType] of Object.entries(ENVIRONMENT_AMBIENT_MAP)) {
      if (envLower.includes(keyword)) {
        return ambientType;
      }
    }
  }
  
  // Check description
  const descLower = description.toLowerCase();
  for (const [keyword, ambientType] of Object.entries(ENVIRONMENT_AMBIENT_MAP)) {
    if (descLower.includes(keyword)) {
      return ambientType;
    }
  }
  
  return null;
}

// Analyze description for action SFX
function detectActions(description: string): { type: string; category: SFXCategory }[] {
  const detected: { type: string; category: SFXCategory }[] = [];
  const descLower = description.toLowerCase();
  
  for (const [keyword, sfxList] of Object.entries(ACTION_SFX_MAP)) {
    // Match whole words
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(descLower)) {
      for (const sfx of sfxList) {
        // Avoid duplicates
        if (!detected.some(d => d.type === sfx.type)) {
          detected.push(sfx);
        }
      }
    }
  }
  
  return detected;
}

// Calculate volume based on context
function calculateVolume(hasDialogue: boolean, category: SFXCategory, style: string): number {
  let baseVolume = 0.7;
  
  // Duck for dialogue
  if (hasDialogue) {
    baseVolume *= 0.4;
  }
  
  // Adjust by category
  if (category === 'ambient') {
    baseVolume *= 0.5;
  } else if (category === 'impact' || category === 'action') {
    baseVolume *= 0.9;
  }
  
  // Adjust by style
  if (style === 'minimal') {
    baseVolume *= 0.6;
  } else if (style === 'stylized') {
    baseVolume *= 1.1;
  }
  
  return Math.min(1, Math.max(0.1, baseVolume));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: SFXRequest = await req.json();
    const { 
      projectId, 
      shots, 
      totalDuration,
      includeAmbient = true,
      includeFoley = true,
      includeActionSFX = true,
      style = 'realistic'
    } = request;

    if (!projectId || !shots?.length) {
      throw new Error("projectId and shots are required");
    }

    console.log(`[SFX Engine] Processing ${shots.length} shots for project ${projectId}`);
    console.log(`[SFX Engine] Options: ambient=${includeAmbient}, foley=${includeFoley}, action=${includeActionSFX}, style=${style}`);

    const sfxCues: SFXCue[] = [];
    const ambientBeds: AmbientBed[] = [];
    const shotAnalysis: any[] = [];
    
    let currentTime = 0;
    let currentAmbient: AmbientType | null = null;
    let ambientStartTime = 0;

    for (const shot of shots) {
      const shotStart = currentTime;
      const shotEnd = currentTime + shot.durationSeconds;
      
      // Detect environment
      const detectedEnv = detectEnvironment(shot.description, shot.environment);
      
      // Detect actions
      const detectedActions = detectActions(shot.description);
      
      // Store analysis
      shotAnalysis.push({
        shotId: shot.id,
        environment: detectedEnv,
        actions: detectedActions,
        hasDialogue: shot.hasDialogue,
      });
      
      // Create ambient bed if environment changed
      if (includeAmbient && detectedEnv && detectedEnv !== currentAmbient) {
        // Close previous ambient bed
        if (currentAmbient) {
          ambientBeds.push({
            id: `ambient_${ambientBeds.length}`,
            type: currentAmbient,
            startTime: ambientStartTime,
            endTime: shotStart,
            volume: calculateVolume(false, 'ambient', style),
            fadeInDuration: 1,
            fadeOutDuration: 1.5,
          });
        }
        
        // Start new ambient bed
        currentAmbient = detectedEnv;
        ambientStartTime = shotStart;
      }
      
      // Create SFX cues for detected actions
      if ((includeFoley || includeActionSFX) && detectedActions.length > 0) {
        for (const action of detectedActions) {
          // Skip if category not enabled
          if (action.category === 'foley' && !includeFoley) continue;
          if ((action.category === 'action' || action.category === 'impact') && !includeActionSFX) continue;
          
          // Place SFX somewhere in the shot (randomized but weighted towards middle)
          const sfxOffset = shot.durationSeconds * (0.2 + Math.random() * 0.6);
          
          sfxCues.push({
            id: `sfx_${sfxCues.length}`,
            category: action.category,
            type: action.type,
            startTime: shotStart + sfxOffset,
            duration: action.category === 'impact' ? 0.5 : 2,
            volume: calculateVolume(shot.hasDialogue, action.category, style),
            shotId: shot.id,
            description: `${action.type} for "${shot.description.substring(0, 50)}..."`,
          });
        }
      }
      
      currentTime = shotEnd;
    }
    
    // Close final ambient bed
    if (includeAmbient && currentAmbient) {
      ambientBeds.push({
        id: `ambient_${ambientBeds.length}`,
        type: currentAmbient,
        startTime: ambientStartTime,
        endTime: totalDuration,
        volume: calculateVolume(false, 'ambient', style),
        fadeInDuration: 1,
        fadeOutDuration: 2,
      });
    }

    console.log(`[SFX Engine] Generated ${ambientBeds.length} ambient beds and ${sfxCues.length} SFX cues`);

    // Build mixing instructions
    const mixingInstructions = {
      masterVolume: 0.8,
      ambientVolume: style === 'minimal' ? 0.3 : 0.5,
      foleyVolume: style === 'minimal' ? 0.5 : 0.7,
      actionVolume: style === 'stylized' ? 0.9 : 0.75,
      duckingForDialogue: true,
      duckingAmount: 0.6,
    };

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        plan: {
          projectId,
          totalDuration,
          ambientBeds,
          sfxCues,
          shotAnalysis,
          mixingInstructions,
        },
        summary: {
          ambientBedCount: ambientBeds.length,
          sfxCueCount: sfxCues.length,
          environmentsDetected: [...new Set(ambientBeds.map(a => a.type))],
          actionTypesDetected: [...new Set(sfxCues.map(s => s.type))],
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SFX Engine] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "SFX generation failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});