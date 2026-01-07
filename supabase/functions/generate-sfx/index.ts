import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Sound Effects Engine with ElevenLabs Audio Generation
 * 
 * Avatar-quality SFX pipeline:
 * 1. Analyzes scene descriptions for sound-worthy elements
 * 2. Detects environments for ambient beds
 * 3. Identifies actions that need foley/SFX
 * 4. Generates actual audio files using ElevenLabs SFX API
 * 5. Uploads to storage and returns URLs
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
  audioUrl?: string; // Generated audio URL
}

interface AmbientBed {
  id: string;
  type: AmbientType;
  startTime: number;
  endTime: number;
  volume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  audioUrl?: string; // Generated audio URL
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
  generateAudio?: boolean; // Whether to actually generate audio files
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

// Ambient type to ElevenLabs prompt mapping
const AMBIENT_PROMPTS: Record<AmbientType, string> = {
  'city-traffic': 'Urban city traffic ambience with distant car horns, engines, and street sounds',
  'city-night': 'Nighttime city ambience with distant traffic, occasional sirens, and urban atmosphere',
  'forest': 'Peaceful forest ambience with birdsong, rustling leaves, and gentle wind through trees',
  'ocean-waves': 'Ocean waves gently crashing on shore with seagulls and coastal atmosphere',
  'rain': 'Steady rainfall with occasional thunder rumbles and water dripping',
  'wind': 'Strong wind howling and gusting with atmospheric pressure changes',
  'crowd': 'Busy crowd murmur with indistinct chatter and movement',
  'office': 'Office ambience with keyboard typing, phone rings, and air conditioning hum',
  'cafe': 'Cozy cafe atmosphere with espresso machine, cups clinking, and soft chatter',
  'space-hum': 'Deep space station hum with electronic systems and low frequency rumble',
  'machinery': 'Industrial machinery ambience with metallic clanks and mechanical rhythms',
  'silence-room-tone': 'Quiet room tone with subtle air movement and minimal background noise',
};

// Action keywords to SFX types
const ACTION_SFX_MAP: Record<string, { type: string; category: SFXCategory; prompt: string }[]> = {
  walk: [{ type: 'footsteps', category: 'foley', prompt: 'Footsteps walking on hard floor, natural pace' }],
  walking: [{ type: 'footsteps', category: 'foley', prompt: 'Footsteps walking on hard floor, natural pace' }],
  run: [{ type: 'running-footsteps', category: 'foley', prompt: 'Running footsteps on concrete, fast pace with heavy impacts' }],
  running: [{ type: 'running-footsteps', category: 'foley', prompt: 'Running footsteps, athletic and intense' }],
  enter: [{ type: 'door-open', category: 'foley', prompt: 'Door opening with handle click and wooden creak' }],
  enters: [{ type: 'door-open', category: 'foley', prompt: 'Door opening smoothly with subtle click' }],
  exit: [{ type: 'door-close', category: 'foley', prompt: 'Door closing with solid thud and latch click' }],
  exits: [{ type: 'door-close', category: 'foley', prompt: 'Door closing behind someone' }],
  leaves: [{ type: 'door-close', category: 'foley', prompt: 'Door closing gently' }],
  door: [{ type: 'door-open', category: 'foley', prompt: 'Door handle turning and door opening' }],
  opens: [{ type: 'door-open', category: 'foley', prompt: 'Something opening with mechanical sound' }],
  closes: [{ type: 'door-close', category: 'foley', prompt: 'Something closing with solid impact' }],
  type: [{ type: 'keyboard-typing', category: 'foley', prompt: 'Keyboard typing on mechanical keys, rhythmic' }],
  typing: [{ type: 'keyboard-typing', category: 'foley', prompt: 'Computer keyboard typing sounds' }],
  phone: [{ type: 'phone-ring', category: 'foley', prompt: 'Phone ringing, modern smartphone notification' }],
  call: [{ type: 'phone-ring', category: 'foley', prompt: 'Phone ringing tone' }],
  punch: [{ type: 'punch-impact', category: 'impact', prompt: 'Powerful punch impact with meaty thud' }],
  hit: [{ type: 'body-impact', category: 'impact', prompt: 'Body impact sound, physical collision' }],
  fight: [{ type: 'punch-impact', category: 'impact', prompt: 'Fight sounds with punches and body impacts' }],
  explosion: [{ type: 'explosion', category: 'action', prompt: 'Massive explosion with deep boom and debris' }],
  explode: [{ type: 'explosion', category: 'action', prompt: 'Cinematic explosion with shockwave' }],
  car: [{ type: 'car-engine', category: 'ambient', prompt: 'Car engine idling and revving' }],
  drive: [{ type: 'car-engine', category: 'ambient', prompt: 'Car driving with engine and road noise' }],
  driving: [{ type: 'car-engine', category: 'ambient', prompt: 'Vehicle driving at speed' }],
  glass: [{ type: 'glass-shatter', category: 'impact', prompt: 'Glass shattering with sharp crystalline fragments' }],
  break: [{ type: 'glass-shatter', category: 'impact', prompt: 'Something breaking with impact' }],
  crash: [{ type: 'crash-impact', category: 'impact', prompt: 'Violent crash with metal and debris' }],
  sit: [{ type: 'cloth-rustle', category: 'foley', prompt: 'Clothing rustle as someone sits down' }],
  stand: [{ type: 'cloth-rustle', category: 'foley', prompt: 'Clothing movement as someone stands' }],
  paper: [{ type: 'paper-rustle', category: 'foley', prompt: 'Paper rustling and shuffling sounds' }],
  write: [{ type: 'pen-writing', category: 'foley', prompt: 'Pen writing on paper with scratching sound' }],
  drink: [{ type: 'glass-clink', category: 'foley', prompt: 'Glass clinking and liquid pouring' }],
  eat: [{ type: 'eating', category: 'foley', prompt: 'Eating sounds with utensils on plate' }],
  gun: [{ type: 'gunshot', category: 'action', prompt: 'Gunshot with realistic crack and echo' }],
  shoot: [{ type: 'gunshot', category: 'action', prompt: 'Weapon firing with powerful report' }],
  sword: [{ type: 'sword-swing', category: 'action', prompt: 'Sword swinging through air with metal swoosh' }],
};

// Analyze description for environment
function detectEnvironment(description: string, environment?: string): AmbientType | null {
  if (environment) {
    const envLower = environment.toLowerCase();
    for (const [keyword, ambientType] of Object.entries(ENVIRONMENT_AMBIENT_MAP)) {
      if (envLower.includes(keyword)) {
        return ambientType;
      }
    }
  }
  
  const descLower = description.toLowerCase();
  for (const [keyword, ambientType] of Object.entries(ENVIRONMENT_AMBIENT_MAP)) {
    if (descLower.includes(keyword)) {
      return ambientType;
    }
  }
  
  return null;
}

// Analyze description for action SFX
function detectActions(description: string): { type: string; category: SFXCategory; prompt: string }[] {
  const detected: { type: string; category: SFXCategory; prompt: string }[] = [];
  const descLower = description.toLowerCase();
  
  for (const [keyword, sfxList] of Object.entries(ACTION_SFX_MAP)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(descLower)) {
      for (const sfx of sfxList) {
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
  
  if (hasDialogue) {
    baseVolume *= 0.4;
  }
  
  if (category === 'ambient') {
    baseVolume *= 0.5;
  } else if (category === 'impact' || category === 'action') {
    baseVolume *= 0.9;
  }
  
  if (style === 'minimal') {
    baseVolume *= 0.6;
  } else if (style === 'stylized') {
    baseVolume *= 1.1;
  }
  
  return Math.min(1, Math.max(0.1, baseVolume));
}

// Generate SFX audio using ElevenLabs API
async function generateSFXAudio(
  prompt: string,
  duration: number,
  supabase: any,
  projectId: string,
  sfxId: string
): Promise<string | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  
  if (!ELEVENLABS_API_KEY) {
    console.warn("[SFX Engine] No ElevenLabs API key - skipping audio generation");
    return null;
  }
  
  try {
    console.log(`[SFX Engine] Generating audio: "${prompt}" (${duration}s)`);
    
    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: Math.min(22, Math.max(0.5, duration)), // ElevenLabs limit: 0.5-22 seconds
        prompt_influence: 0.3,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SFX Engine] ElevenLabs error: ${response.status} - ${errorText}`);
      return null;
    }
    
    const audioBuffer = await response.arrayBuffer();
    
    // Upload to Supabase storage
    const fileName = `sfx_${projectId}_${sfxId}_${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from('voice-tracks') // Reuse voice-tracks bucket for SFX
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });
    
    if (uploadError) {
      console.error(`[SFX Engine] Upload error:`, uploadError);
      return null;
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const audioUrl = `${supabaseUrl}/storage/v1/object/public/voice-tracks/${fileName}`;
    
    console.log(`[SFX Engine] Audio generated: ${audioUrl}`);
    return audioUrl;
    
  } catch (error) {
    console.error(`[SFX Engine] Audio generation failed:`, error);
    return null;
  }
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
      style = 'realistic',
      generateAudio = true, // Default to generating actual audio
    } = request;

    if (!projectId || !shots?.length) {
      throw new Error("projectId and shots are required");
    }

    console.log(`[SFX Engine] Processing ${shots.length} shots for project ${projectId}`);
    console.log(`[SFX Engine] Options: ambient=${includeAmbient}, foley=${includeFoley}, action=${includeActionSFX}, style=${style}, generateAudio=${generateAudio}`);

    // Initialize Supabase for audio uploads
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sfxCues: SFXCue[] = [];
    const ambientBeds: AmbientBed[] = [];
    const shotAnalysis: any[] = [];
    
    let currentTime = 0;
    let currentAmbient: AmbientType | null = null;
    let ambientStartTime = 0;

    // First pass: Detect all SFX needed
    for (const shot of shots) {
      const shotStart = currentTime;
      const shotEnd = currentTime + shot.durationSeconds;
      
      const detectedEnv = detectEnvironment(shot.description, shot.environment);
      const detectedActions = detectActions(shot.description);
      
      shotAnalysis.push({
        shotId: shot.id,
        environment: detectedEnv,
        actions: detectedActions,
        hasDialogue: shot.hasDialogue,
      });
      
      // Track ambient bed changes
      if (includeAmbient && detectedEnv && detectedEnv !== currentAmbient) {
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
        currentAmbient = detectedEnv;
        ambientStartTime = shotStart;
      }
      
      // Create SFX cues
      if ((includeFoley || includeActionSFX) && detectedActions.length > 0) {
        for (const action of detectedActions) {
          if (action.category === 'foley' && !includeFoley) continue;
          if ((action.category === 'action' || action.category === 'impact') && !includeActionSFX) continue;
          
          const sfxOffset = shot.durationSeconds * (0.2 + Math.random() * 0.6);
          const sfxDuration = action.category === 'impact' ? 0.5 : 2;
          
          sfxCues.push({
            id: `sfx_${sfxCues.length}`,
            category: action.category,
            type: action.type,
            startTime: shotStart + sfxOffset,
            duration: sfxDuration,
            volume: calculateVolume(shot.hasDialogue, action.category, style),
            shotId: shot.id,
            description: action.prompt,
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

    console.log(`[SFX Engine] Detected ${ambientBeds.length} ambient beds and ${sfxCues.length} SFX cues`);

    // Second pass: Generate audio if enabled
    if (generateAudio) {
      console.log(`[SFX Engine] Generating audio files...`);
      
      // Generate ambient audio (limit to unique types to save API calls)
      const uniqueAmbientTypes = [...new Set(ambientBeds.map(a => a.type))];
      const ambientAudioCache: Record<string, string> = {};
      
      for (const ambientType of uniqueAmbientTypes) {
        const prompt = AMBIENT_PROMPTS[ambientType];
        const audioUrl = await generateSFXAudio(prompt, 10, supabase, projectId, `ambient_${ambientType}`);
        if (audioUrl) {
          ambientAudioCache[ambientType] = audioUrl;
        }
      }
      
      // Assign audio URLs to ambient beds
      for (const bed of ambientBeds) {
        bed.audioUrl = ambientAudioCache[bed.type];
      }
      
      // Generate SFX cue audio (limit to first 10 to avoid rate limits)
      const sfxToGenerate = sfxCues.slice(0, 10);
      for (const cue of sfxToGenerate) {
        const audioUrl = await generateSFXAudio(cue.description, cue.duration, supabase, projectId, cue.id);
        if (audioUrl) {
          cue.audioUrl = audioUrl;
        }
      }
      
      console.log(`[SFX Engine] Generated ${Object.keys(ambientAudioCache).length} ambient tracks and ${sfxToGenerate.filter(c => c.audioUrl).length} SFX tracks`);
    }

    // Build mixing instructions
    const mixingInstructions = {
      masterVolume: 0.8,
      ambientVolume: style === 'minimal' ? 0.3 : 0.5,
      foleyVolume: style === 'minimal' ? 0.5 : 0.7,
      actionVolume: style === 'stylized' ? 0.9 : 0.75,
      duckingForDialogue: true,
      duckingAmount: 0.6,
    };

    const generatedAudioCount = [
      ...ambientBeds.filter(a => a.audioUrl),
      ...sfxCues.filter(c => c.audioUrl),
    ].length;

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
          audioFilesGenerated: generatedAudioCount,
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