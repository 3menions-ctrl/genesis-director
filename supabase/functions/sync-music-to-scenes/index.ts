import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Music Synchronization Engine
 * 
 * Analyzes scenes for emotional beats and generates synchronized music cues.
 * Creates a unified music prompt and mixing instructions for the final video.
 */

type MusicMood = 'epic' | 'tension' | 'emotional' | 'action' | 'mysterious' | 
  'uplifting' | 'dark' | 'romantic' | 'adventure' | 'scifi' | 'peaceful' | 'dramatic';

type BeatType = 'downbeat' | 'upbeat' | 'transition' | 'climax' | 'resolution' | 'build' | 'drop';

interface Shot {
  id: string;
  description: string;
  dialogue?: string;
  durationSeconds: number;
  mood?: string;
}

interface MusicSyncRequest {
  projectId: string;
  shots: Shot[];
  totalDuration: number;
  overallMood?: MusicMood;
  genre?: string;
  tempoPreference?: 'slow' | 'moderate' | 'fast' | 'dynamic';
  includeDialogueDucking?: boolean;
}

interface EmotionalBeat {
  timestamp: number;
  type: BeatType;
  intensity: number;
  mood: MusicMood;
  description: string;
}

interface MusicCue {
  id: string;
  startTime: number;
  endTime: number;
  mood: MusicMood;
  intensity: number;
  tempo: 'slow' | 'moderate' | 'fast';
  instrumentation: string[];
  dynamicMarking: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
  transitionIn: 'fade' | 'cut' | 'swell';
  transitionOut: 'fade' | 'cut' | 'diminuendo';
}

// Mood detection keywords
const MOOD_KEYWORDS: Record<MusicMood, string[]> = {
  epic: ['battle', 'war', 'hero', 'victory', 'triumph', 'glory', 'conquest', 'power'],
  tension: ['suspense', 'danger', 'threat', 'chase', 'escape', 'fear', 'anxiety', 'stalking'],
  emotional: ['love', 'loss', 'grief', 'reunion', 'farewell', 'memory', 'tears', 'heart'],
  action: ['fight', 'run', 'explode', 'crash', 'attack', 'speed', 'chase', 'combat'],
  mysterious: ['mystery', 'secret', 'hidden', 'shadow', 'unknown', 'discover', 'clue'],
  uplifting: ['hope', 'joy', 'success', 'achieve', 'inspire', 'dream', 'bright', 'happy'],
  dark: ['death', 'evil', 'horror', 'nightmare', 'demon', 'dark', 'sinister', 'ominous'],
  romantic: ['love', 'kiss', 'embrace', 'together', 'passion', 'intimate', 'tender'],
  adventure: ['journey', 'explore', 'discover', 'quest', 'travel', 'adventure', 'expedition'],
  scifi: ['space', 'future', 'technology', 'alien', 'robot', 'digital', 'cyber', 'quantum'],
  peaceful: ['calm', 'serene', 'nature', 'quiet', 'rest', 'peaceful', 'gentle', 'still'],
  dramatic: ['reveal', 'confront', 'climax', 'intense', 'dramatic', 'showdown', 'turning point'],
};

// Music templates by mood
const MOOD_TEMPLATES: Record<MusicMood, string> = {
  epic: 'Epic orchestral score with powerful brass, soaring strings, thundering percussion. Hans Zimmer style cinematic.',
  tension: 'Suspenseful underscore with low pulsing synths, staccato strings, building anxiety. Thriller soundtrack.',
  emotional: 'Heartfelt piano melody with gentle strings, soft dynamics. Oscar-worthy emotional drama score.',
  action: 'High-octane action score with driving percussion, aggressive brass, relentless energy.',
  mysterious: 'Ethereal pads, subtle textures, enigmatic motifs. Mystery and intrigue soundtrack.',
  uplifting: 'Inspirational orchestral crescendo with hopeful piano and triumphant brass.',
  dark: 'Ominous low drones, dissonant harmonies, foreboding atmosphere. Dark cinematic.',
  romantic: 'Lush romantic strings, tender piano phrases, sweeping melodic lines.',
  adventure: 'Bold adventure theme with heroic brass, energetic strings, exciting rhythms.',
  scifi: 'Futuristic electronic soundscape with synthesizers, digital textures, otherworldly tones.',
  peaceful: 'Serene ambient score with gentle piano, soft pads, tranquil atmosphere.',
  dramatic: 'Intense dramatic score with dynamic contrasts, powerful crescendos, emotional depth.',
};

// Instrumentation by mood
const MOOD_INSTRUMENTS: Record<MusicMood, string[]> = {
  epic: ['orchestra', 'brass', 'timpani', 'choir', 'strings'],
  tension: ['strings', 'synth', 'percussion', 'piano'],
  emotional: ['piano', 'strings', 'cello', 'violin'],
  action: ['orchestra', 'percussion', 'brass', 'synth'],
  mysterious: ['pads', 'harp', 'woodwinds', 'celesta'],
  uplifting: ['orchestra', 'piano', 'brass', 'percussion'],
  dark: ['low strings', 'bass', 'synth drones', 'percussion'],
  romantic: ['strings', 'piano', 'harp', 'flute'],
  adventure: ['orchestra', 'brass', 'percussion', 'strings'],
  scifi: ['synthesizer', 'electronic', 'pads', 'bass'],
  peaceful: ['piano', 'ambient pads', 'guitar', 'flute'],
  dramatic: ['orchestra', 'piano', 'strings', 'brass'],
};

// Detect mood from text description
function detectMood(text: string): MusicMood {
  const lowerText = text.toLowerCase();
  let maxScore = 0;
  let detectedMood: MusicMood = 'dramatic';
  
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      detectedMood = mood as MusicMood;
    }
  }
  
  return detectedMood;
}

// Calculate action intensity from description
function calculateIntensity(description: string): number {
  const intensityWords = {
    high: ['explosion', 'crash', 'fight', 'chase', 'attack', 'scream', 'run', 'battle'],
    medium: ['walk', 'talk', 'look', 'move', 'reveal', 'discover', 'confront'],
    low: ['sit', 'stand', 'wait', 'calm', 'quiet', 'still', 'rest', 'sleep'],
  };
  
  const lower = description.toLowerCase();
  
  for (const word of intensityWords.high) {
    if (lower.includes(word)) return 0.9;
  }
  for (const word of intensityWords.medium) {
    if (lower.includes(word)) return 0.5;
  }
  for (const word of intensityWords.low) {
    if (lower.includes(word)) return 0.2;
  }
  
  return 0.5;
}

// Detect beat type based on scene position and content
function detectBeatType(
  shotIndex: number, 
  totalShots: number, 
  intensity: number, 
  previousIntensity: number
): BeatType {
  const position = shotIndex / totalShots;
  
  // Opening
  if (shotIndex === 0) return 'downbeat';
  
  // Climax (around 75-85% of the way through)
  if (position >= 0.75 && position <= 0.85 && intensity > 0.7) return 'climax';
  
  // Resolution (final shot)
  if (shotIndex === totalShots - 1) return 'resolution';
  
  // Build (intensity increasing)
  if (intensity > previousIntensity + 0.2) return 'build';
  
  // Drop (intensity decreasing significantly)
  if (intensity < previousIntensity - 0.3) return 'drop';
  
  // Transition (significant mood change)
  if (Math.abs(intensity - previousIntensity) > 0.1) return 'transition';
  
  return 'upbeat';
}

// Determine tempo from scene dynamics
function determineTempo(intensity: number, mood: MusicMood): 'slow' | 'moderate' | 'fast' {
  if (['action', 'tension', 'epic'].includes(mood) && intensity > 0.6) return 'fast';
  if (['peaceful', 'emotional', 'romantic'].includes(mood)) return 'slow';
  if (intensity > 0.7) return 'fast';
  if (intensity < 0.3) return 'slow';
  return 'moderate';
}

// Determine dynamic marking
function determineDynamics(intensity: number): 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' {
  if (intensity >= 0.9) return 'ff';
  if (intensity >= 0.75) return 'f';
  if (intensity >= 0.55) return 'mf';
  if (intensity >= 0.35) return 'mp';
  if (intensity >= 0.15) return 'p';
  return 'pp';
}

// Analyze scenes and create sync plan
function analyzeScenesForMusic(request: MusicSyncRequest): any {
  const { shots, totalDuration, overallMood, tempoPreference, includeDialogueDucking } = request;
  
  // Analyze each scene
  const sceneAnalysis = [];
  let currentTime = 0;
  let previousIntensity = 0.5;
  
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const mood = (shot.mood as MusicMood) || detectMood(shot.description);
    const intensity = calculateIntensity(shot.description);
    const hasDialogue = !!(shot.dialogue && shot.dialogue.trim().length > 0);
    
    sceneAnalysis.push({
      shotId: shot.id,
      startTime: currentTime,
      endTime: currentTime + shot.durationSeconds,
      mood,
      dialoguePresent: hasDialogue,
      actionIntensity: intensity,
    });
    
    currentTime += shot.durationSeconds;
    previousIntensity = intensity;
  }
  
  // Detect emotional beats
  const emotionalBeats: EmotionalBeat[] = [];
  currentTime = 0;
  previousIntensity = 0.5;
  
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const scene = sceneAnalysis[i];
    const intensity = scene.actionIntensity;
    const beatType = detectBeatType(i, shots.length, intensity, previousIntensity);
    
    emotionalBeats.push({
      timestamp: currentTime,
      type: beatType,
      intensity,
      mood: scene.mood,
      description: `${beatType} at scene ${i + 1}: ${shot.description.substring(0, 50)}...`,
    });
    
    currentTime += shot.durationSeconds;
    previousIntensity = intensity;
  }
  
  // Detect scene transitions
  const transitions = [];
  for (let i = 0; i < sceneAnalysis.length - 1; i++) {
    const fromScene = sceneAnalysis[i];
    const toScene = sceneAnalysis[i + 1];
    
    transitions.push({
      fromShotId: fromScene.shotId,
      toShotId: toScene.shotId,
      transitionTime: fromScene.endTime,
      transitionType: 'cut',
      emotionalShift: {
        fromMood: fromScene.mood,
        toMood: toScene.mood,
        intensity: Math.abs(fromScene.actionIntensity - toScene.actionIntensity),
      },
    });
  }
  
  // Create music cues
  const musicCues: MusicCue[] = [];
  let cueId = 0;
  
  // Group consecutive scenes with similar moods
  let cueStart = 0;
  let currentMood = sceneAnalysis[0]?.mood || 'dramatic';
  let cueIntensity = 0;
  let cueCount = 0;
  
  for (let i = 0; i <= sceneAnalysis.length; i++) {
    const scene = sceneAnalysis[i];
    const isLast = i === sceneAnalysis.length;
    const moodChanged = isLast || (scene && scene.mood !== currentMood);
    
    if (moodChanged && cueCount > 0) {
      const avgIntensity = cueIntensity / cueCount;
      const cueEnd = isLast ? totalDuration : scene.startTime;
      const tempo = tempoPreference === 'dynamic' 
        ? determineTempo(avgIntensity, currentMood)
        : (tempoPreference || 'moderate');
      
      musicCues.push({
        id: `cue_${++cueId}`,
        startTime: cueStart,
        endTime: cueEnd,
        mood: currentMood,
        intensity: avgIntensity,
        tempo,
        instrumentation: MOOD_INSTRUMENTS[currentMood] || ['orchestra'],
        dynamicMarking: determineDynamics(avgIntensity),
        transitionIn: cueStart === 0 ? 'fade' : 'swell',
        transitionOut: isLast ? 'fade' : 'cut',
      });
      
      if (!isLast) {
        cueStart = scene.startTime;
        currentMood = scene.mood;
        cueIntensity = scene.actionIntensity;
        cueCount = 1;
      }
    } else if (scene) {
      cueIntensity += scene.actionIntensity;
      cueCount++;
    }
  }
  
  // Build unified music prompt
  const dominantMoods = [...new Set(sceneAnalysis.map(s => s.mood))];
  const avgIntensity = sceneAnalysis.reduce((sum, s) => sum + s.actionIntensity, 0) / sceneAnalysis.length;
  const primaryMood = overallMood || dominantMoods[0] || 'dramatic';
  
  const hasClimax = emotionalBeats.some(b => b.type === 'climax');
  const hasBuild = emotionalBeats.some(b => b.type === 'build');
  
  let unifiedPrompt = MOOD_TEMPLATES[primaryMood];
  
  // Add duration context
  unifiedPrompt += ` Duration: ${Math.round(totalDuration)} seconds.`;
  
  // Add structural hints
  if (hasClimax) {
    const climaxBeat = emotionalBeats.find(b => b.type === 'climax');
    unifiedPrompt += ` Build to powerful climax around ${Math.round(climaxBeat?.timestamp || totalDuration * 0.75)} seconds.`;
  }
  
  if (hasBuild) {
    unifiedPrompt += ' Include gradual intensity build-up.';
  }
  
  // Add mood transitions
  if (dominantMoods.length > 1) {
    unifiedPrompt += ` Incorporate mood shifts between ${dominantMoods.slice(0, 3).join(', ')}.`;
  }
  
  // Add tempo guidance
  if (tempoPreference && tempoPreference !== 'dynamic') {
    unifiedPrompt += ` Maintain ${tempoPreference} tempo throughout.`;
  }
  
  // Create timing markers for dialogue ducking
  const timingMarkers = [];
  
  for (const scene of sceneAnalysis) {
    if (scene.dialoguePresent && includeDialogueDucking !== false) {
      timingMarkers.push({
        timestamp: scene.startTime,
        type: 'duck',
        duration: scene.endTime - scene.startTime,
        intensity: 0.4, // Duck to 40% during dialogue
      });
    }
    
    // Add accent markers at transitions with high emotional shift
    const transition = transitions.find(t => t.fromShotId === scene.shotId);
    if (transition && transition.emotionalShift.intensity > 0.3) {
      timingMarkers.push({
        timestamp: transition.transitionTime,
        type: 'accent',
        duration: 0.5,
        intensity: transition.emotionalShift.intensity,
      });
    }
  }
  
  // Add swell at climax
  const climaxBeat = emotionalBeats.find(b => b.type === 'climax');
  if (climaxBeat) {
    timingMarkers.push({
      timestamp: climaxBeat.timestamp - 2,
      type: 'swell',
      duration: 4,
      intensity: 1.0,
    });
  }
  
  // Mixing instructions
  const mixingInstructions = {
    baseVolume: avgIntensity > 0.7 ? 0.4 : 0.5, // Lower base if high intensity visuals
    duckingForDialogue: includeDialogueDucking !== false && sceneAnalysis.some(s => s.dialoguePresent),
    duckingAmount: 0.6, // Reduce to 40% of base during dialogue
    fadeInDuration: 1.5,
    fadeOutDuration: 2.0,
  };
  
  return {
    projectId: request.projectId,
    totalDuration,
    scenes: sceneAnalysis,
    emotionalBeats,
    transitions,
    musicCues,
    unifiedMusicPrompt: unifiedPrompt,
    timingMarkers,
    mixingInstructions,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: MusicSyncRequest = await req.json();

    console.log(`[sync-music] Analyzing ${request.shots?.length || 0} shots for music sync`);

    if (!request.shots || request.shots.length === 0) {
      throw new Error("No shots provided for music synchronization");
    }

    // Calculate total duration if not provided
    const totalDuration = request.totalDuration || 
      request.shots.reduce((sum, s) => sum + (s.durationSeconds || 6), 0);

    const syncPlan = analyzeScenesForMusic({
      ...request,
      totalDuration,
    });

    console.log(`[sync-music] Generated ${syncPlan.musicCues.length} music cues`);
    console.log(`[sync-music] Detected ${syncPlan.emotionalBeats.length} emotional beats`);
    console.log(`[sync-music] Created ${syncPlan.timingMarkers.length} timing markers`);
    console.log(`[sync-music] Music prompt: ${syncPlan.unifiedMusicPrompt.substring(0, 100)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        plan: syncPlan,
        musicPrompt: syncPlan.unifiedMusicPrompt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[sync-music] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Music sync analysis failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
