import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

/**
 * SYNC MUSIC TO SCENES - World-Class Audio-Visual Synchronization
 * 
 * Analyzes scene content and creates a professional music scoring plan
 * with emotional beats, timing markers, and cue points for Hans Zimmer-level
 * synchronization between visuals and music.
 * 
 * NOW INTEGRATES with scene-music-analyzer for AI-powered scene understanding.
 */

interface ShotInfo {
  id: string;
  description?: string;
  dialogue?: string;
  durationSeconds?: number;
  mood?: string;
}

interface MusicSyncRequest {
  projectId: string;
  shots: ShotInfo[];
  totalDuration: number;
  overallMood?: string;
  tempoPreference?: 'slow' | 'moderate' | 'fast' | 'dynamic';
  includeDialogueDucking?: boolean;
  useAIAnalysis?: boolean; // NEW: Enable AI-powered scene analysis
}

interface EmotionalBeat {
  timestamp: number;
  emotion: string;
  intensity: number; // 0-1
  description: string;
}

interface MusicCue {
  timestamp: number;
  type: 'swell' | 'drop' | 'transition' | 'accent' | 'silence';
  description: string;
  targetMood?: string;
}

interface TimingMarker {
  timestamp: number;
  shotId: string;
  hasDialogue: boolean;
  recommendedVolume: number; // 0-1
}

interface MusicSyncPlan {
  emotionalBeats: EmotionalBeat[];
  musicCues: MusicCue[];
  timingMarkers: TimingMarker[];
  overallArc: string;
  recommendedTempo: string;
  recommendedKey: string;
  peakMoment: number; // timestamp of climax
  referenceComposer: string;
  sceneType: string;
  intensity: 'subtle' | 'moderate' | 'intense' | 'explosive';
}

// Emotion detection keywords
const EMOTION_KEYWORDS: Record<string, string[]> = {
  joy: ['happy', 'laugh', 'smile', 'celebrate', 'victory', 'triumph', 'joy', 'excited'],
  sadness: ['cry', 'tear', 'sad', 'loss', 'funeral', 'death', 'goodbye', 'alone', 'grief'],
  tension: ['danger', 'threat', 'chase', 'escape', 'fear', 'nervous', 'suspense', 'dark'],
  anger: ['fight', 'battle', 'rage', 'fury', 'conflict', 'war', 'attack', 'confront'],
  love: ['romance', 'kiss', 'love', 'embrace', 'together', 'heart', 'passion', 'tender'],
  wonder: ['discover', 'reveal', 'magic', 'beautiful', 'amazing', 'awe', 'mystery', 'secret'],
  peace: ['calm', 'quiet', 'rest', 'nature', 'serene', 'gentle', 'peaceful', 'still'],
  power: ['hero', 'strong', 'rise', 'epic', 'mighty', 'grand', 'majestic', 'powerful'],
};

// Mood to scene type mapping
const MOOD_TO_SCENE_TYPE: Record<string, string> = {
  epic: 'epic-battle',
  action: 'action-chase',
  tension: 'tension-suspense',
  emotional: 'emotional-revelation',
  romantic: 'romantic-love',
  mysterious: 'mystery-intrigue',
  uplifting: 'triumph-victory',
  dark: 'horror-dread',
  scifi: 'sci-fi-wonder',
  comedy: 'comedy-playful',
  cinematic: 'adventure-journey',
};

// Mood to composer mapping  
const MOOD_TO_COMPOSER: Record<string, string> = {
  epic: 'hans-zimmer',
  action: 'hans-zimmer',
  tension: 'hans-zimmer',
  emotional: 'thomas-newman',
  romantic: 'john-williams',
  mysterious: 'hans-zimmer',
  uplifting: 'john-williams',
  dark: 'howard-shore',
  scifi: 'hans-zimmer',
  comedy: 'alexandre-desplat',
  cinematic: 'hans-zimmer',
  adventure: 'john-williams',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD: Prevent unauthorized API credit consumption ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const request: MusicSyncRequest = await req.json();
    const { shots, totalDuration, overallMood, tempoPreference, includeDialogueDucking, useAIAnalysis } = request;

    console.log(`[MusicSync] Analyzing ${shots.length} shots for music synchronization`);
    console.log(`[MusicSync] Total duration: ${totalDuration}s, Mood: ${overallMood || 'cinematic'}`);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // NEW: Use AI-powered scene-music-analyzer for more accurate recommendations
    // ═══════════════════════════════════════════════════════════════════════════
    let aiRecommendation: any = null;
    if (useAIAnalysis !== false && shots.length > 0) {
      try {
        console.log(`[MusicSync] 🤖 Calling scene-music-analyzer for AI analysis...`);
        
        // Build combined scene description for AI analysis
        const combinedDescription = shots.map(s => s.description || '').join('. ');
        const combinedDialogue = shots.map(s => s.dialogue || '').filter(Boolean).join(' ');
        
        const analyzerResponse = await fetch(`${supabaseUrl}/functions/v1/scene-music-analyzer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            sceneDescription: combinedDescription.substring(0, 2000),
            dialogueContent: combinedDialogue.substring(0, 1000),
            projectGenre: overallMood,
          }),
        });
        
        if (analyzerResponse.ok) {
          const analyzerResult = await analyzerResponse.json();
          if (analyzerResult.success && analyzerResult.recommendation) {
            aiRecommendation = analyzerResult.recommendation;
            console.log(`[MusicSync] 🎵 AI recommends: ${aiRecommendation.sceneType}, ${aiRecommendation.referenceComposer}, ${aiRecommendation.intensity}`);
          }
        }
      } catch (aiError) {
        console.warn(`[MusicSync] AI analysis skipped:`, aiError);
      }
    }

    // Analyze each shot for emotional content
    const emotionalBeats: EmotionalBeat[] = [];
    const musicCues: MusicCue[] = [];
    const timingMarkers: TimingMarker[] = [];
    
    let currentTimestamp = 0;
    let peakIntensity = 0;
    let peakMoment = 0;
    
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const duration = shot.durationSeconds || 6;
      const content = `${shot.description || ''} ${shot.dialogue || ''} ${shot.mood || ''}`.toLowerCase();
      
      // Detect emotions in this shot
      let dominantEmotion = 'neutral';
      let intensity = 0.5;
      
      for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
        const matchCount = keywords.filter(kw => content.includes(kw)).length;
        if (matchCount > 0) {
          intensity = Math.min(1, 0.4 + matchCount * 0.2);
          dominantEmotion = emotion;
          break;
        }
      }
      
      // Track peak moment for climax
      if (intensity > peakIntensity) {
        peakIntensity = intensity;
        peakMoment = currentTimestamp + duration / 2;
      }
      
      // Add emotional beat
      emotionalBeats.push({
        timestamp: currentTimestamp,
        emotion: dominantEmotion,
        intensity,
        description: `Shot ${i + 1}: ${dominantEmotion} (${Math.round(intensity * 100)}% intensity)`,
      });
      
      // Add timing marker
      const hasDialogue = !!(shot.dialogue && shot.dialogue.trim().length > 0);
      timingMarkers.push({
        timestamp: currentTimestamp,
        shotId: shot.id,
        hasDialogue,
        recommendedVolume: hasDialogue && includeDialogueDucking ? 0.3 : 0.7,
      });
      
      // Add music cues at key moments
      if (i === 0) {
        musicCues.push({
          timestamp: 0,
          type: 'swell',
          description: 'Opening: Establish mood',
          targetMood: overallMood,
        });
      }
      
      // Transition cues between shots with different emotions
      if (i > 0) {
        const prevEmotion = emotionalBeats[i - 1]?.emotion;
        if (prevEmotion !== dominantEmotion) {
          musicCues.push({
            timestamp: currentTimestamp,
            type: 'transition',
            description: `Transition: ${prevEmotion} → ${dominantEmotion}`,
            targetMood: dominantEmotion,
          });
        }
      }
      
      // Peak moment accent
      if (intensity > 0.8) {
        musicCues.push({
          timestamp: currentTimestamp + duration * 0.6,
          type: 'accent',
          description: `High intensity moment: ${dominantEmotion}`,
        });
      }
      
      currentTimestamp += duration;
    }
    
    // Add final swell/resolution
    musicCues.push({
      timestamp: Math.max(0, totalDuration - 3),
      type: 'swell',
      description: 'Finale: Build to resolution',
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // DETERMINE SCENE TYPE AND COMPOSER (AI-enhanced when available)
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Prefer AI recommendations if available, fallback to rule-based
    const sceneType = aiRecommendation?.sceneType 
      || MOOD_TO_SCENE_TYPE[overallMood || 'cinematic'] 
      || 'adventure-journey';
    const referenceComposer = aiRecommendation?.referenceComposer 
      || MOOD_TO_COMPOSER[overallMood || 'cinematic'] 
      || 'hans-zimmer';
    
    // Determine overall intensity (use AI if available)
    const avgIntensity = emotionalBeats.reduce((sum, b) => sum + b.intensity, 0) / emotionalBeats.length;
    let intensity: 'subtle' | 'moderate' | 'intense' | 'explosive' = aiRecommendation?.intensity || 'moderate';
    if (!aiRecommendation) {
      if (avgIntensity < 0.3) intensity = 'subtle';
      else if (avgIntensity < 0.6) intensity = 'moderate';
      else if (avgIntensity < 0.85) intensity = 'intense';
      else intensity = 'explosive';
    }

    // Determine tempo (use AI if available)
    let recommendedTempo = '90-110 BPM';
    if (aiRecommendation?.tempo === 'slow') recommendedTempo = '60-80 BPM';
    else if (aiRecommendation?.tempo === 'fast') recommendedTempo = '130-160 BPM';
    else if (aiRecommendation?.tempo === 'variable') recommendedTempo = 'Variable 70-140 BPM';
    else if (tempoPreference === 'slow') recommendedTempo = '60-80 BPM';
    else if (tempoPreference === 'fast') recommendedTempo = '130-160 BPM';
    else if (tempoPreference === 'dynamic') recommendedTempo = 'Variable 70-140 BPM';
    else if (overallMood === 'action' || overallMood === 'epic') recommendedTempo = '120-150 BPM';
    else if (overallMood === 'emotional' || overallMood === 'romantic') recommendedTempo = '65-85 BPM';
    
    // Get emotional arc from AI or build from beats
    const emotionalArc = aiRecommendation?.emotionalArc 
      || `${emotionalBeats[0]?.emotion || 'neutral'} → ${emotionalBeats[Math.floor(emotionalBeats.length / 2)]?.emotion || 'building'} → ${emotionalBeats[emotionalBeats.length - 1]?.emotion || 'resolution'}`;

    // Build the sync plan
    const plan: MusicSyncPlan = {
      emotionalBeats,
      musicCues,
      timingMarkers,
      overallArc: emotionalArc,
      recommendedTempo,
      recommendedKey: intensity === 'explosive' ? 'D minor (power)' : intensity === 'subtle' ? 'C major (warmth)' : 'A minor (emotion)',
      peakMoment,
      referenceComposer,
      sceneType,
      intensity,
    };
    
    // Add AI-enhanced prompt if available
    const aiPromptEnhancement = aiRecommendation?.customPromptEnhancement || '';

    // Build optimized music prompt for generate-music (with AI enhancement)
    const musicPrompt = buildMusicPrompt(plan, overallMood || 'cinematic', totalDuration, aiPromptEnhancement);

    console.log(`[MusicSync] ✅ Plan created: ${emotionalBeats.length} beats, ${musicCues.length} cues`);
    console.log(`[MusicSync] Scene type: ${sceneType}, Composer: ${referenceComposer}, Intensity: ${intensity}`);
    if (aiRecommendation) {
      console.log(`[MusicSync] 🤖 AI-enhanced with: ${aiRecommendation.mood} mood, confidence: ${aiRecommendation.confidence}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan,
        musicPrompt,
        summary: {
          emotionalBeatCount: emotionalBeats.length,
          musicCueCount: musicCues.length,
          peakMoment,
          overallIntensity: intensity,
          recommendedComposer: referenceComposer,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[MusicSync] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildMusicPrompt(plan: MusicSyncPlan, mood: string, duration: number, aiEnhancement?: string): string {
  const parts: string[] = [];
  
  // Composer reference
  parts.push(`${plan.referenceComposer.toUpperCase()} STYLE cinematic score`);
  
  // Scene type specifics
  parts.push(`for ${plan.sceneType.replace(/-/g, ' ')} scene`);
  
  // Tempo and key
  parts.push(`${plan.recommendedTempo}, ${plan.recommendedKey}`);
  
  // Emotional arc
  parts.push(`emotional arc: ${plan.overallArc}`);
  
  // Intensity
  if (plan.intensity === 'explosive') {
    parts.push('massive orchestral crescendo, thundering percussion, full fff fortissimo climax');
  } else if (plan.intensity === 'intense') {
    parts.push('powerful dynamics, dramatic swells, building tension');
  } else if (plan.intensity === 'subtle') {
    parts.push('delicate underscoring, gentle dynamics, intimate atmosphere');
  } else {
    parts.push('balanced dynamics, clear emotional presence');
  }
  
  // Peak moment guidance
  parts.push(`peak climax at ${Math.round(plan.peakMoment)}s mark`);
  
  // AI-enhanced prompt addition (if available)
  if (aiEnhancement && aiEnhancement.trim().length > 0) {
    parts.push(aiEnhancement);
  }
  
  // Production quality
  parts.push('professional Hollywood film score production, studio recorded quality');
  
  return parts.join(', ');
}
