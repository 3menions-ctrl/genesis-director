import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Sound Effects Engine using Replicate AudioLDM-2
 * 
 * Generates high-quality sound effects using AI:
 * 1. Analyzes scene descriptions for sound-worthy elements
 * 2. Detects environments for ambient beds
 * 3. Identifies actions that need foley/SFX
 * 4. Generates audio using Replicate's haoheliu/audio-ldm-2 model
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
  audioUrl?: string;
}

interface AmbientBed {
  id: string;
  type: AmbientType;
  startTime: number;
  endTime: number;
  volume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  audioUrl?: string;
}

interface SFXRequest {
  projectId: string;
  shots: {
    id: string;
    description: string;
    durationSeconds: number;
    hasDialogue: boolean;
    environment?: string;
  }[];
  totalDuration: number;
  includeAmbient: boolean;
  includeFoley: boolean;
  includeActionSFX: boolean;
  style: 'realistic' | 'stylized' | 'minimal';
  generateAudio?: boolean;
}

// Environment to ambient mapping
const ENVIRONMENT_AMBIENT_MAP: Record<string, AmbientType> = {
  city: 'city-traffic', urban: 'city-traffic', street: 'city-traffic',
  office: 'office', corporate: 'office', workspace: 'office',
  forest: 'forest', woods: 'forest', jungle: 'forest', nature: 'forest',
  beach: 'ocean-waves', ocean: 'ocean-waves', sea: 'ocean-waves',
  cafe: 'cafe', restaurant: 'cafe', bar: 'cafe',
  space: 'space-hum', spaceship: 'space-hum',
  factory: 'machinery', industrial: 'machinery',
  night: 'city-night', evening: 'city-night',
  indoor: 'silence-room-tone', room: 'silence-room-tone',
  rain: 'rain', storm: 'rain',
  windy: 'wind', wind: 'wind',
  crowd: 'crowd', stadium: 'crowd', concert: 'crowd',
};

// Ambient prompts for AudioLDM-2
const AMBIENT_PROMPTS: Record<AmbientType, string> = {
  'city-traffic': 'Urban city traffic ambience with distant car horns, engines, and street sounds, high quality recording',
  'city-night': 'Nighttime city ambience with distant traffic, occasional sirens, urban atmosphere at night',
  'forest': 'Peaceful forest ambience with birdsong, rustling leaves, gentle wind through trees, nature sounds',
  'ocean-waves': 'Ocean waves gently crashing on shore with seagulls, coastal atmosphere, beach sounds',
  'rain': 'Steady rainfall with thunder rumbles, water dripping, rain on surfaces',
  'wind': 'Strong wind howling and gusting, atmospheric wind sounds',
  'crowd': 'Busy crowd murmur with indistinct chatter and movement, people talking',
  'office': 'Office ambience with keyboard typing, phone rings, air conditioning hum, workplace',
  'cafe': 'Cozy cafe atmosphere with espresso machine, cups clinking, soft background chatter',
  'space-hum': 'Deep space station hum with electronic systems, low frequency sci-fi ambience',
  'machinery': 'Industrial machinery ambience with metallic clanks, mechanical factory sounds',
  'silence-room-tone': 'Quiet room tone with subtle air movement, minimal indoor ambience',
};

// Action SFX mappings
const ACTION_SFX_MAP: Record<string, { type: string; category: SFXCategory; prompt: string }[]> = {
  walk: [{ type: 'footsteps', category: 'foley', prompt: 'Footsteps walking on hard floor, natural pace, indoor' }],
  walking: [{ type: 'footsteps', category: 'foley', prompt: 'Person walking footsteps on hard surface' }],
  run: [{ type: 'running', category: 'foley', prompt: 'Running footsteps on concrete, fast athletic movement' }],
  enter: [{ type: 'door-open', category: 'foley', prompt: 'Door opening with handle click and wooden creak' }],
  enters: [{ type: 'door-open', category: 'foley', prompt: 'Door opening smoothly with subtle click' }],
  exit: [{ type: 'door-close', category: 'foley', prompt: 'Door closing with solid thud and latch' }],
  door: [{ type: 'door', category: 'foley', prompt: 'Door handle turning and door opening closing' }],
  type: [{ type: 'typing', category: 'foley', prompt: 'Keyboard typing on mechanical keys, computer typing' }],
  phone: [{ type: 'phone', category: 'foley', prompt: 'Phone ringing, smartphone notification sound' }],
  punch: [{ type: 'punch', category: 'impact', prompt: 'Powerful punch impact with body hit, fight sound' }],
  hit: [{ type: 'impact', category: 'impact', prompt: 'Body impact sound, physical collision hit' }],
  explosion: [{ type: 'explosion', category: 'action', prompt: 'Massive explosion with deep boom and debris, cinematic' }],
  car: [{ type: 'car', category: 'ambient', prompt: 'Car engine running, vehicle idling and revving' }],
  glass: [{ type: 'glass', category: 'impact', prompt: 'Glass shattering with sharp crystalline breaking' }],
  crash: [{ type: 'crash', category: 'impact', prompt: 'Violent crash with metal impact and debris' }],
  gun: [{ type: 'gunshot', category: 'action', prompt: 'Gunshot with realistic crack and echo, weapon fire' }],
  sword: [{ type: 'sword', category: 'action', prompt: 'Sword swinging through air, metal blade swoosh' }],
};

// Generate SFX using Replicate AudioLDM-2
async function generateSFXWithReplicate(
  prompt: string,
  duration: number,
  supabase: any,
  projectId: string,
  sfxId: string
): Promise<string | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  
  if (!REPLICATE_API_KEY) {
    console.warn("[SFX-Replicate] No API key configured");
    return null;
  }
  
  try {
    console.log(`[SFX-Replicate] Generating: "${prompt.substring(0, 50)}..." (${duration}s)`);
    
    // AudioLDM-2 model for high-quality sound effects
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "48f1f2dc844d9e1e6f7e9c5e9c3a4a9a6e1c2e3d4f5a6b7c8d9e0f1a2b3c4d5e6", // haoheliu/audio-ldm-2
        input: {
          prompt: prompt,
          duration: Math.min(10, Math.max(1, duration)), // 1-10 seconds
          num_inference_steps: 50,
          guidance_scale: 3.5,
        },
      }),
    });
    
    if (!createResponse.ok) {
      // Try alternative Tango model
      return await generateWithTango(prompt, duration, supabase, projectId, sfxId);
    }
    
    const prediction = await createResponse.json();
    console.log("[SFX-Replicate] Prediction started:", prediction.id);
    
    // Poll for completion (max 60 seconds)
    for (let i = 0; i < 12; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });
      
      const status = await statusResponse.json();
      
      if (status.status === "succeeded" && status.output) {
        // Upload to our storage
        const audioResponse = await fetch(status.output);
        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer();
          const fileName = `sfx_${projectId}_${sfxId}_${Date.now()}.wav`;
          
          const { error: uploadError } = await supabase.storage
            .from('voice-tracks')
            .upload(fileName, audioBuffer, {
              contentType: 'audio/wav',
              upsert: true,
            });
          
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('voice-tracks')
              .getPublicUrl(fileName);
            console.log("[SFX-Replicate] Generated:", publicUrl);
            return publicUrl;
          }
        }
        return status.output;
      }
      
      if (status.status === "failed" || status.status === "canceled") {
        console.error("[SFX-Replicate] Failed:", status.error);
        return await generateWithTango(prompt, duration, supabase, projectId, sfxId);
      }
    }
    
    return null;
  } catch (error) {
    console.error("[SFX-Replicate] Error:", error);
    return null;
  }
}

// Fallback: Tango model for text-to-audio
async function generateWithTango(
  prompt: string,
  duration: number,
  supabase: any,
  projectId: string,
  sfxId: string
): Promise<string | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!REPLICATE_API_KEY) return null;
  
  try {
    console.log("[SFX-Tango] Fallback generation...");
    
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "67d0c0ccc1a8b5ce0eb7d9f34f3a4c0c6f0e8b9a7d5c3e1f0a2b4d6e8c0a2b4d6", // declare-lab/tango
        input: {
          prompt: prompt,
          steps: 100,
          guidance: 3,
        },
      }),
    });
    
    if (!createResponse.ok) return null;
    
    const prediction = await createResponse.json();
    
    for (let i = 0; i < 12; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });
      
      const status = await statusResponse.json();
      
      if (status.status === "succeeded" && status.output) {
        return status.output;
      }
      
      if (status.status === "failed") return null;
    }
    
    return null;
  } catch (error) {
    console.error("[SFX-Tango] Error:", error);
    return null;
  }
}

// Detect environment from description
function detectEnvironment(description: string, environment?: string): AmbientType | null {
  const searchText = (environment || '') + ' ' + description;
  const searchLower = searchText.toLowerCase();
  
  for (const [keyword, ambientType] of Object.entries(ENVIRONMENT_AMBIENT_MAP)) {
    if (searchLower.includes(keyword)) {
      return ambientType;
    }
  }
  return null;
}

// Detect action SFX needs
function detectActions(description: string): { type: string; category: SFXCategory; prompt: string }[] {
  const detected: { type: string; category: SFXCategory; prompt: string }[] = [];
  const descLower = description.toLowerCase();
  
  for (const [keyword, sfxList] of Object.entries(ACTION_SFX_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(descLower)) {
      for (const sfx of sfxList) {
        if (!detected.some(d => d.type === sfx.type)) {
          detected.push(sfx);
        }
      }
    }
  }
  return detected;
}

// Calculate volume
function calculateVolume(hasDialogue: boolean, category: SFXCategory, style: string): number {
  let volume = 0.7;
  if (hasDialogue) volume *= 0.4;
  if (category === 'ambient') volume *= 0.5;
  if (category === 'impact' || category === 'action') volume *= 0.9;
  if (style === 'minimal') volume *= 0.6;
  return Math.min(1, Math.max(0.1, volume));
}

// Quick SFX generation for UI sounds (no project required)
async function generateQuickSFX(prompt: string, duration: number): Promise<string | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!REPLICATE_API_KEY) {
    console.warn("[SFX-Quick] No API key configured");
    return null;
  }

  try {
    console.log(`[SFX-Quick] Generating: "${prompt.substring(0, 50)}..." (${duration}s)`);
    
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "48f1f2dc844d9e1e6f7e9c5e9c3a4a9a6e1c2e3d4f5a6b7c8d9e0f1a2b3c4d5e6",
        input: {
          prompt: prompt,
          duration: Math.min(10, Math.max(0.5, duration)),
          num_inference_steps: 25,
          guidance_scale: 3.0,
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[SFX-Quick] Create error:", errorText);
      return null;
    }

    const prediction = await createResponse.json();
    console.log("[SFX-Quick] Prediction started:", prediction.id);

    // Poll for completion (max 30 seconds for quick sounds)
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });

      const status = await statusResponse.json();

      if (status.status === "succeeded" && status.output) {
        console.log("[SFX-Quick] Success:", status.output);
        return status.output;
      }

      if (status.status === "failed" || status.status === "canceled") {
        console.error("[SFX-Quick] Failed:", status.error);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error("[SFX-Quick] Error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    // Quick mode: simple prompt-based SFX generation (for UI sounds)
    if (requestBody.prompt && !requestBody.projectId) {
      const { prompt, duration = 1 } = requestBody;
      
      console.log(`[SFX Engine] Quick mode: "${prompt.substring(0, 40)}..."`);
      
      const audioUrl = await generateQuickSFX(prompt, duration);
      
      return new Response(
        JSON.stringify({
          success: !!audioUrl,
          audioUrl,
          mode: 'quick',
          prompt,
          duration,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Full mode: project-based SFX generation
    const request: SFXRequest = requestBody;
    const { 
      projectId, 
      shots, 
      totalDuration,
      includeAmbient = true,
      includeFoley = true,
      includeActionSFX = true,
      style = 'realistic',
      generateAudio = true,
    } = request;

    if (!projectId || !shots?.length) {
      throw new Error("projectId and shots are required for full mode");
    }

    console.log(`[SFX Engine] Processing ${shots.length} shots, generateAudio=${generateAudio}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sfxCues: SFXCue[] = [];
    const ambientBeds: AmbientBed[] = [];
    const shotAnalysis: any[] = [];
    
    let currentTime = 0;
    let currentAmbient: AmbientType | null = null;
    let ambientStartTime = 0;

    // Analyze shots
    for (const shot of shots) {
      const shotStart = currentTime;
      const detectedEnv = detectEnvironment(shot.description, shot.environment);
      const detectedActions = detectActions(shot.description);
      
      shotAnalysis.push({
        shotId: shot.id,
        environment: detectedEnv,
        actions: detectedActions,
        hasDialogue: shot.hasDialogue,
      });
      
      // Track ambient transitions
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
          
          sfxCues.push({
            id: `sfx_${sfxCues.length}`,
            category: action.category,
            type: action.type,
            startTime: shotStart + shot.durationSeconds * 0.3,
            duration: action.category === 'impact' ? 0.5 : 2,
            volume: calculateVolume(shot.hasDialogue, action.category, style),
            shotId: shot.id,
            description: action.prompt,
          });
        }
      }
      
      currentTime += shot.durationSeconds;
    }
    
    // Close final ambient
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

    console.log(`[SFX Engine] Found ${ambientBeds.length} ambient beds, ${sfxCues.length} SFX cues`);

    // Generate audio if enabled
    if (generateAudio) {
      // Generate unique ambient types
      const uniqueAmbients = [...new Set(ambientBeds.map(a => a.type))];
      const ambientCache: Record<string, string> = {};
      
      for (const ambientType of uniqueAmbients.slice(0, 3)) { // Limit to 3
        const prompt = AMBIENT_PROMPTS[ambientType];
        const audioUrl = await generateSFXWithReplicate(prompt, 8, supabase, projectId, `ambient_${ambientType}`);
        if (audioUrl) ambientCache[ambientType] = audioUrl;
      }
      
      for (const bed of ambientBeds) {
        bed.audioUrl = ambientCache[bed.type];
      }
      
      // Generate SFX (limit to 5)
      for (const cue of sfxCues.slice(0, 5)) {
        const audioUrl = await generateSFXWithReplicate(cue.description, cue.duration, supabase, projectId, cue.id);
        if (audioUrl) cue.audioUrl = audioUrl;
      }
    }

    // Log cost
    try {
      await supabase.rpc('log_api_cost', {
        p_project_id: projectId,
        p_shot_id: 'sfx_generation',
        p_service: 'replicate-audioldm',
        p_operation: 'generate_sfx',
        p_credits_charged: 0,
        p_real_cost_cents: generateAudio ? 10 : 0,
        p_duration_seconds: Math.round(totalDuration),
        p_status: 'completed',
        p_metadata: JSON.stringify({
          ambientCount: ambientBeds.length,
          sfxCount: sfxCues.length,
          generatedAudio: generateAudio,
        }),
      });
    } catch (e) {
      console.warn("[SFX] Cost log failed:", e);
    }

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
          mixingInstructions: {
            masterVolume: 0.8,
            ambientVolume: style === 'minimal' ? 0.3 : 0.5,
            foleyVolume: 0.7,
            actionVolume: 0.75,
            duckingForDialogue: true,
            duckingAmount: 0.6,
          },
        },
        summary: {
          ambientBedCount: ambientBeds.length,
          sfxCueCount: sfxCues.length,
          audioFilesGenerated: [...ambientBeds, ...sfxCues].filter(x => x.audioUrl).length,
          provider: 'replicate-audioldm',
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
