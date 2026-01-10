import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CONTINUITY ENGINE - Scene Flow Orchestrator
 * 
 * Ensures smooth scene transitions by:
 * 1. Analyzing gaps between clips
 * 2. Auto-injecting buffer/bridge clips where needed
 * 3. Tracking motion continuity across cuts
 * 4. Locking environment settings within scenes
 * 5. Managing pacing and rhythm
 */

interface ContinuityRequest {
  projectId: string;
  userId: string;
  clips: Array<{
    index: number;
    videoUrl: string;
    lastFrameUrl?: string;
    prompt: string;
    motionVectors?: {
      endVelocity?: string;
      endDirection?: string;
      cameraMomentum?: string;
    };
    sceneId?: string;
    sceneType?: string;
  }>;
  environmentLock?: {
    lighting?: string;
    colorPalette?: string;
    timeOfDay?: string;
    weather?: string;
  };
  gapThreshold?: number; // Score below which bridge is needed (default: 70)
  maxBridgeClips?: number; // Max bridges to generate (default: 5)
  strictness?: 'lenient' | 'normal' | 'strict';
}

interface TransitionAnalysis {
  overallScore: number;
  motionScore: number;
  visualScore: number;
  semanticScore: number;
  gapType: 'none' | 'minor' | 'moderate' | 'severe' | 'incompatible';
  gapDescription: string;
  recommendedTransition: 'cut' | 'dissolve' | 'fade' | 'wipe' | 'bridge-clip';
  bridgeClipNeeded: boolean;
  bridgeClipPrompt?: string;
  bridgeClipDurationSeconds?: number;
  motionContinuity: {
    fromClipEndMotion: string;
    toClipStartMotion: string;
    isCompatible: boolean;
    mismatchDescription?: string;
  };
}

interface ContinuityPlan {
  projectId: string;
  originalClipCount: number;
  bridgeClipsNeeded: number;
  totalClipCount: number;
  overallContinuityScore: number;
  transitions: Array<{
    fromIndex: number;
    toIndex: number;
    analysis: TransitionAnalysis;
    bridgeClip?: {
      prompt: string;
      durationSeconds: number;
      insertAfterIndex: number;
    };
    motionInjection?: {
      toClipEntryMotion: string;
      entryCameraHint: string;
    };
  }>;
  environmentLock: {
    lighting: string;
    colorPalette: string;
    timeOfDay: string;
    weather: string;
  };
  sceneGroups: Array<{
    sceneId: string;
    clipIndices: number[];
    environment: any;
  }>;
}

// Call another edge function
async function callEdgeFunction(functionName: string, body: any): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${functionName} failed: ${error}`);
  }
  
  return response.json();
}

// Analyze motion continuity between clips
async function analyzeMotionContinuity(
  fromClip: { lastFrameUrl?: string; motionVectors?: any; prompt: string },
  toClip: { prompt: string }
): Promise<{ isCompatible: boolean; entryMotion: string; entryCameraHint: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return { isCompatible: true, entryMotion: '', entryCameraHint: '' };
  }
  
  const exitMotion = fromClip.motionVectors 
    ? `${fromClip.motionVectors.endVelocity || 'stationary'} ${fromClip.motionVectors.endDirection || ''} with camera ${fromClip.motionVectors.cameraMomentum || 'static'}`
    : 'unknown exit motion';
  
  const prompt = `Analyze motion continuity between two consecutive video clips.

CLIP A EXIT STATE:
- Motion: ${exitMotion}
- Description: ${fromClip.prompt.substring(0, 200)}

CLIP B ENTRY:
- Description: ${toClip.prompt.substring(0, 200)}

Determine:
1. Is the motion transition compatible? (true/false)
2. What entry motion should Clip B have to match Clip A's exit?
3. What camera hint should be added to Clip B's prompt?

Return JSON:
{
  "isCompatible": boolean,
  "entryMotion": "description of motion Clip B should start with",
  "entryCameraHint": "camera movement/position hint for smooth handoff"
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Motion analysis failed');
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('[ContinuityEngine] Motion analysis failed:', err);
  }
  
  return { isCompatible: true, entryMotion: '', entryCameraHint: '' };
}

// Extract dominant environment from prompts
async function extractEnvironment(prompts: string[]): Promise<{
  lighting: string;
  colorPalette: string;
  timeOfDay: string;
  weather: string;
}> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return { lighting: 'natural', colorPalette: 'neutral', timeOfDay: 'day', weather: 'clear' };
  }
  
  const combinedPrompts = prompts.slice(0, 5).join('\n');
  
  const prompt = `Extract the dominant environmental settings from these video scene descriptions:

${combinedPrompts}

Return JSON with the MOST COMMON or MOST PROMINENT settings:
{
  "lighting": "natural | dramatic | soft | harsh | backlit | silhouette | golden hour | blue hour | neon | candlelit",
  "colorPalette": "warm | cool | neutral | desaturated | vibrant | monochrome | sepia | teal-orange",
  "timeOfDay": "dawn | morning | noon | afternoon | golden hour | dusk | night | midnight",
  "weather": "clear | cloudy | overcast | rainy | stormy | foggy | snowy | sunny"
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.warn('[ContinuityEngine] Environment extraction failed:', err);
  }
  
  return { lighting: 'natural', colorPalette: 'neutral', timeOfDay: 'day', weather: 'clear' };
}

// Group clips into scenes based on content similarity
function groupClipsIntoScenes(clips: ContinuityRequest['clips']): Array<{
  sceneId: string;
  clipIndices: number[];
}> {
  const scenes: Array<{ sceneId: string; clipIndices: number[] }> = [];
  let currentScene: { sceneId: string; clipIndices: number[] } | null = null;
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const sceneId = clip.sceneId || `scene_${Math.floor(i / 3) + 1}`;
    
    if (!currentScene || currentScene.sceneId !== sceneId) {
      if (currentScene) {
        scenes.push(currentScene);
      }
      currentScene = { sceneId, clipIndices: [i] };
    } else {
      currentScene.clipIndices.push(i);
    }
  }
  
  if (currentScene) {
    scenes.push(currentScene);
  }
  
  return scenes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: ContinuityRequest = await req.json();
    const {
      projectId,
      userId,
      clips,
      environmentLock,
      gapThreshold = 70,
      maxBridgeClips = 5,
      strictness = 'normal',
    } = request;

    if (!clips || clips.length < 2) {
      throw new Error("At least 2 clips required for continuity analysis");
    }

    console.log(`[ContinuityEngine] Analyzing continuity for ${clips.length} clips (project: ${projectId})`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Extract or use provided environment settings
    const environment = environmentLock || await extractEnvironment(clips.map(c => c.prompt));
    console.log(`[ContinuityEngine] Environment locked: ${environment.lighting}, ${environment.timeOfDay}, ${environment.weather}`);

    // Step 2: Group clips into scenes
    const sceneGroups = groupClipsIntoScenes(clips);
    console.log(`[ContinuityEngine] Identified ${sceneGroups.length} scene groups`);

    // Step 3: Analyze transitions between all clips
    const transitions: ContinuityPlan['transitions'] = [];
    let bridgeClipsNeeded = 0;
    let totalScore = 0;

    for (let i = 0; i < clips.length - 1; i++) {
      const fromClip = clips[i];
      const toClip = clips[i + 1];
      
      console.log(`[ContinuityEngine] Analyzing transition ${i + 1} → ${i + 2}...`);

      // Analyze visual/semantic gap
      let analysis: TransitionAnalysis;
      try {
        const gapResult = await callEdgeFunction('analyze-transition-gap', {
          fromClipLastFrame: fromClip.lastFrameUrl,
          toClipFirstFrame: undefined, // Will use toClip's video for analysis
          fromClipUrl: fromClip.videoUrl,
          toClipUrl: toClip.videoUrl,
          fromClipDescription: fromClip.prompt,
          toClipDescription: toClip.prompt,
          strictness,
        });
        
        if (gapResult.success && gapResult.analysis) {
          analysis = gapResult.analysis;
        } else {
          throw new Error('No analysis returned');
        }
      } catch (err) {
        console.warn(`[ContinuityEngine] Gap analysis failed for ${i} → ${i + 1}:`, err);
        // Default to no gap detected
        analysis = {
          overallScore: 80,
          motionScore: 80,
          visualScore: 80,
          semanticScore: 80,
          gapType: 'none',
          gapDescription: 'Analysis failed, assuming compatible',
          recommendedTransition: 'cut',
          bridgeClipNeeded: false,
          motionContinuity: {
            fromClipEndMotion: 'unknown',
            toClipStartMotion: 'unknown',
            isCompatible: true,
          },
        };
      }

      totalScore += analysis.overallScore;

      // Analyze motion continuity
      const motionAnalysis = await analyzeMotionContinuity(fromClip, toClip);

      const transition: ContinuityPlan['transitions'][0] = {
        fromIndex: i,
        toIndex: i + 1,
        analysis,
      };

      // Inject motion continuity hints
      if (!motionAnalysis.isCompatible || motionAnalysis.entryMotion) {
        transition.motionInjection = {
          toClipEntryMotion: motionAnalysis.entryMotion,
          entryCameraHint: motionAnalysis.entryCameraHint,
        };
      }

      // Determine if bridge clip is needed
      if (analysis.bridgeClipNeeded && analysis.overallScore < gapThreshold && bridgeClipsNeeded < maxBridgeClips) {
        // Build environment-aware bridge prompt
        let bridgePrompt = analysis.bridgeClipPrompt || 
          `Transitional shot bridging scenes. Smooth camera movement establishing visual continuity.`;
        
        // Add environment lock to bridge prompt
        bridgePrompt += `. Lighting: ${environment.lighting}. Time of day: ${environment.timeOfDay}. Weather: ${environment.weather}. Color palette: ${environment.colorPalette}.`;
        
        transition.bridgeClip = {
          prompt: bridgePrompt,
          durationSeconds: analysis.bridgeClipDurationSeconds || 3,
          insertAfterIndex: i,
        };
        bridgeClipsNeeded++;
        console.log(`[ContinuityEngine] Bridge clip needed after clip ${i + 1}: ${bridgePrompt.substring(0, 60)}...`);
      }

      transitions.push(transition);
    }

    const overallContinuityScore = Math.round(totalScore / (clips.length - 1));
    console.log(`[ContinuityEngine] Overall continuity score: ${overallContinuityScore}/100`);
    console.log(`[ContinuityEngine] Bridge clips needed: ${bridgeClipsNeeded}`);

    // Build continuity plan
    const plan: ContinuityPlan = {
      projectId,
      originalClipCount: clips.length,
      bridgeClipsNeeded,
      totalClipCount: clips.length + bridgeClipsNeeded,
      overallContinuityScore,
      transitions,
      environmentLock: {
        lighting: environment.lighting || 'natural',
        colorPalette: environment.colorPalette || 'neutral',
        timeOfDay: environment.timeOfDay || 'day',
        weather: environment.weather || 'clear',
      },
      sceneGroups: sceneGroups.map(sg => ({
        ...sg,
        environment,
      })),
    };

    // Store continuity plan in project metadata
    await supabase
      .from('movie_projects')
      .update({
        pro_features_data: { continuityPlan: plan },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    const processingTimeMs = Date.now() - startTime;
    console.log(`[ContinuityEngine] Complete in ${processingTimeMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        plan,
        processingTimeMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ContinuityEngine] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
