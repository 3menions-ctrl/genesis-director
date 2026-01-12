import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * HOLLYWOOD PIPELINE ORCHESTRATOR (Async Background Processing)
 * 
 * Uses EdgeRuntime.waitUntil() to avoid timeout issues.
 * Returns immediately with project ID, runs pipeline in background.
 * Updates database with progress - frontend uses realtime to track.
 */

interface PipelineRequest {
  userId: string;
  projectId?: string;
  projectName?: string;
  concept?: string;
  manualPrompts?: string[];
  stages?: ('preproduction' | 'qualitygate' | 'assets' | 'production' | 'postproduction')[];
  referenceImageUrl?: string;
  referenceImageAnalysis?: any;
  genre?: string;
  mood?: string;
  includeVoice?: boolean;
  includeMusic?: boolean;
  musicMood?: string;
  voiceId?: string;
  colorGrading?: string;
  totalDuration?: number;
  clipCount?: number;
  qualityTier?: 'standard' | 'professional';
  skipCreditDeduction?: boolean;
  // Resume support
  resumeFrom?: 'qualitygate' | 'assets' | 'production' | 'postproduction';
  approvedScript?: { shots: any[] };
  identityBible?: any;
  extractedCharacters?: any[];
  // Story-first flow
  approvedStory?: string;
  storyTitle?: string;
}

interface ExtractedCharacter {
  id: string;
  name: string;
  age?: string;
  gender?: string;
  appearance: string;
  clothing?: string;
  distinguishingFeatures?: string;
}

interface SceneContext {
  actionPhase: 'establish' | 'initiate' | 'develop' | 'escalate' | 'peak' | 'settle';
  previousAction: string;
  currentAction: string;
  nextAction: string;
  characterDescription: string;
  locationDescription: string;
  lightingDescription: string;
}

interface PipelineState {
  projectId: string;
  stage: string;
  progress: number;
  clipCount: number;
  clipDuration: number;
  totalCredits: number;
  script?: {
    shots: Array<{
      id: string;
      title: string;
      description: string;
      dialogue?: string;
      durationSeconds: number;
      mood?: string;
      cameraMovement?: string;
      // NEW: Scene context for continuous flow
      sceneContext?: SceneContext;
    }>;
  };
  // NEW: Scene-level consistency locks
  sceneConsistency?: {
    character: string;
    location: string;
    lighting: string;
  };
  extractedCharacters?: ExtractedCharacter[];
  identityBible?: {
    characterIdentity?: {
      description?: string;
      facialFeatures?: string;
      clothing?: string;
      bodyType?: string;
      distinctiveMarkers?: string[];
    };
    consistencyPrompt?: string;
    multiViewUrls?: {
      frontViewUrl: string;
      sideViewUrl: string;
      threeQuarterViewUrl: string;
      backViewUrl?: string;
      silhouetteUrl?: string;
    };
    consistencyAnchors?: string[];
    styleAnchor?: any;
    // Enhanced identity bible fields (5-layer system)
    nonFacialAnchors?: {
      bodyType?: string;
      clothingSignature?: string;
      hairFromBehind?: string;
      silhouetteDescription?: string;
      gait?: string;
      posture?: string;
    };
    occlusionNegatives?: string[];
    // Scene DNA for visual consistency propagation
    masterSceneAnchor?: any;
  };
  referenceAnalysis?: {
    environment?: any;
    lighting?: any;
    colorPalette?: any;
    consistencyPrompt?: string;
  };
  auditResult?: {
    overallScore: number;
    optimizedShots: Array<{
      shotId: string;
      originalDescription: string;
      optimizedDescription: string;
      identityAnchors: string[];
      physicsGuards: string[];
      velocityContinuity?: string;
    }>;
    velocityVectors?: Array<{
      shotId: string;
      endFrameMotion: {
        subjectVelocity: string;
        subjectDirection: string;
        cameraMotion: string;
        continuityPrompt: string;
      };
    }>;
  };
  assets?: {
    sceneImages?: Array<{ sceneNumber: number; imageUrl: string }>;
    voiceUrl?: string;
    voiceDuration?: number;
    musicUrl?: string;
    musicDuration?: number;
  };
  production?: {
    clipResults: Array<{
      index: number;
      videoUrl: string;
      status: string;
      lastFrameUrl?: string;
    }>;
  };
  finalVideoUrl?: string;
  error?: string;
}

// Avatar-quality: Configurable clip duration (4-8 seconds for Veo 3.1)
const DEFAULT_CLIP_DURATION = 6; // 6 seconds for cinematic quality
const MIN_CLIP_DURATION = 4;
const MAX_CLIP_DURATION = 8;

// Tier-based clip limits (fail-safe defaults if DB unavailable)
const TIER_CLIP_LIMITS: Record<string, { maxClips: number; maxDuration: number; maxRetries: number; chunkedStitching: boolean }> = {
  'free': { maxClips: 10, maxDuration: 60, maxRetries: 1, chunkedStitching: false },
  'pro': { maxClips: 15, maxDuration: 60, maxRetries: 2, chunkedStitching: false },
  'growth': { maxClips: 30, maxDuration: 120, maxRetries: 3, chunkedStitching: true },
  'agency': { maxClips: 30, maxDuration: 120, maxRetries: 4, chunkedStitching: true },
};

const MIN_CLIPS_PER_PROJECT = 2;

// Tier-aware credit costs (matches frontend useCreditBilling.ts)
const TIER_CREDIT_COSTS = {
  standard: {
    PRE_PRODUCTION: 5,
    PRODUCTION: 20,
    QUALITY_INSURANCE: 0,
    TOTAL_PER_SHOT: 25,
  },
  professional: {
    PRE_PRODUCTION: 5,
    PRODUCTION: 20,
    QUALITY_INSURANCE: 25, // Audit + Visual Debugger + 4 retry buffer
    TOTAL_PER_SHOT: 50,
  },
} as const;

// Fetch user tier limits from database
async function getUserTierLimits(supabase: any, userId: string): Promise<{
  tier: string;
  maxClips: number;
  maxDuration: number;
  maxRetries: number;
  chunkedStitching: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc('get_user_tier_limits', { p_user_id: userId });
    
    if (error || !data) {
      console.warn(`[Hollywood] Failed to fetch tier limits, using free tier defaults:`, error);
      return { tier: 'free', ...TIER_CLIP_LIMITS['free'] };
    }
    
    return {
      tier: data.tier || 'free',
      maxClips: data.max_clips_per_video || TIER_CLIP_LIMITS['free'].maxClips,
      maxDuration: (data.max_duration_minutes || 1) * 60,
      maxRetries: data.max_retries_per_clip || TIER_CLIP_LIMITS['free'].maxRetries,
      chunkedStitching: data.chunked_stitching || false,
    };
  } catch (err) {
    console.error(`[Hollywood] Error fetching tier limits:`, err);
    return { tier: 'free', ...TIER_CLIP_LIMITS['free'] };
  }
}

function calculatePipelineParams(
  request: PipelineRequest, 
  tierLimits?: { maxClips: number; maxDuration: number }
): { clipCount: number; clipDuration: number; totalCredits: number } {
  // Avatar-quality: Configurable clip duration (4-8 seconds)
  let clipDuration = DEFAULT_CLIP_DURATION;
  if ((request as any).clipDuration) {
    clipDuration = Math.max(MIN_CLIP_DURATION, Math.min(MAX_CLIP_DURATION, (request as any).clipDuration));
  }
  
  // Use tier limits if provided
  const maxClips = tierLimits?.maxClips || TIER_CLIP_LIMITS['free'].maxClips;
  const maxDuration = tierLimits?.maxDuration || TIER_CLIP_LIMITS['free'].maxDuration;
  
  let clipCount: number;
  
  if (request.clipCount) {
    clipCount = request.clipCount;
  } else if (request.manualPrompts) {
    clipCount = request.manualPrompts.length;
  } else if (request.totalDuration) {
    clipCount = Math.ceil(request.totalDuration / clipDuration);
  } else {
    clipCount = 6;
  }
  
  // Apply tier limits
  clipCount = Math.max(MIN_CLIPS_PER_PROJECT, Math.min(maxClips, clipCount));
  
  // Also enforce duration limit
  const totalDuration = clipCount * clipDuration;
  if (totalDuration > maxDuration) {
    clipCount = Math.floor(maxDuration / clipDuration);
    console.log(`[Hollywood] Reduced clip count to ${clipCount} due to ${maxDuration}s duration limit`);
  }
  
  // Use tier-aware credit calculation
  const tier = request.qualityTier || 'standard';
  const creditsPerClip = TIER_CREDIT_COSTS[tier].TOTAL_PER_SHOT;
  const totalCredits = clipCount * creditsPerClip;
  
  console.log(`[Hollywood] Pipeline params: ${clipCount} clips × ${clipDuration}s = ${clipCount * clipDuration}s total (max: ${maxDuration}s, tier limit: ${maxClips} clips)`);
  
  return { clipCount, clipDuration, totalCredits };
}

// Build default scene context when not available from script
function buildDefaultSceneContext(clipIndex: number, state: PipelineState): SceneContext {
  const actionPhases = ['establish', 'initiate', 'develop', 'escalate', 'peak', 'settle'] as const;
  const phase = actionPhases[clipIndex % actionPhases.length];
  
  // Get descriptions from scene consistency if available
  const character = state.sceneConsistency?.character || state.identityBible?.consistencyPrompt || '';
  const location = state.sceneConsistency?.location || '';
  const lighting = state.sceneConsistency?.lighting || '';
  
  // Get action from script shots if available
  const shots = state.script?.shots || [];
  const currentShot = shots[clipIndex];
  const prevShot = clipIndex > 0 ? shots[clipIndex - 1] : null;
  const nextShot = clipIndex < shots.length - 1 ? shots[clipIndex + 1] : null;
  
  return {
    actionPhase: phase,
    previousAction: prevShot?.description?.substring(0, 50) || '',
    currentAction: currentShot?.description?.substring(0, 100) || `Clip ${clipIndex + 1} action`,
    nextAction: nextShot?.description?.substring(0, 50) || '',
    characterDescription: character,
    locationDescription: location,
    lightingDescription: lighting,
  };
}

async function callEdgeFunction(
  functionName: string,
  body: any
): Promise<any> {
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

// Update project with pipeline progress
async function updateProjectProgress(supabase: any, projectId: string, stage: string, progress: number, details?: any) {
  const pendingTasks = {
    stage,
    progress,
    updatedAt: new Date().toISOString(),
    ...details,
  };
  
  await supabase
    .from('movie_projects')
    .update({
      pending_video_tasks: pendingTasks,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);
}

// Stage 1: PRE-PRODUCTION
async function runPreProduction(
  request: PipelineRequest,
  state: PipelineState,
  supabase: any
): Promise<PipelineState> {
  console.log(`[Hollywood] Stage 1: PRE-PRODUCTION (${state.clipCount} clips)`);
  state.stage = 'preproduction';
  state.progress = 10;
  await updateProjectProgress(supabase, state.projectId, 'preproduction', 10);
  
  // Build characterLock from extractedCharacters or referenceImageAnalysis if available
  const buildCharacterLock = () => {
    // Priority 1: Extracted characters from resume flow
    if (request.extractedCharacters && request.extractedCharacters.length > 0) {
      const mainChar = request.extractedCharacters[0];
      console.log(`[Hollywood] Using extracted character for script generation: ${mainChar.name}`);
      return {
        description: mainChar.appearance || mainChar.name,
        clothing: mainChar.clothing || '',
        distinctiveFeatures: [
          mainChar.distinguishingFeatures,
          mainChar.age ? `${mainChar.age}` : '',
          mainChar.gender || '',
        ].filter(Boolean),
      };
    }
    
    // Priority 2: Pre-analyzed reference image
    if (request.referenceImageAnalysis?.characterIdentity) {
      const charId = request.referenceImageAnalysis.characterIdentity;
      console.log(`[Hollywood] Using reference image character for script generation`);
      return {
        description: charId.description || request.referenceImageAnalysis.consistencyPrompt || '',
        clothing: charId.clothing || '',
        distinctiveFeatures: charId.distinctiveMarkers || [],
      };
    }
    
    return undefined;
  };
  
  const characterLock = buildCharacterLock();
  
  // 1a. Generate script - use approved story if available (story-first flow)
  if (request.approvedStory) {
    console.log(`[Hollywood] Breaking down approved story into shots...`);
    
    try {
      const scriptResult = await callEdgeFunction('smart-script-generator', {
        topic: request.storyTitle || 'Video',
        approvedScene: request.approvedStory,
        genre: request.genre || 'cinematic',
        pacingStyle: 'moderate',
        targetDurationSeconds: state.clipCount * state.clipDuration,
        characterLock, // Pass character lock for consistency
      });
      
      if (scriptResult.shots || scriptResult.clips) {
        const rawShots = scriptResult.shots || scriptResult.clips;
        const shots = rawShots.slice(0, state.clipCount).map((shot: any, i: number) => ({
          id: shot.id || `shot_${i + 1}`,
          title: shot.title || `Clip ${i + 1}`,
          description: shot.description || '',
          durationSeconds: shot.durationSeconds || state.clipDuration,
          mood: shot.mood || request.mood || 'cinematic',
          dialogue: shot.dialogue || '',
          // NEW: Capture scene context for continuous flow
          sceneContext: shot.actionPhase ? {
            actionPhase: shot.actionPhase,
            previousAction: shot.previousAction || '',
            currentAction: shot.currentAction || shot.description?.substring(0, 100) || '',
            nextAction: shot.nextAction || '',
            characterDescription: shot.characterDescription || scriptResult.consistency?.character || '',
            locationDescription: shot.locationDescription || scriptResult.consistency?.location || '',
            lightingDescription: shot.lightingDescription || scriptResult.consistency?.lighting || '',
          } : undefined,
        }));
        
        // Pad if needed
        while (shots.length < state.clipCount) {
          const prevShot = shots[shots.length - 1];
          shots.push({
            id: `shot_${shots.length + 1}`,
            title: `Clip ${shots.length + 1}`,
            description: `Continuation of the scene. Clip ${shots.length + 1}.`,
            durationSeconds: state.clipDuration,
            mood: request.mood || 'cinematic',
            sceneContext: prevShot?.sceneContext ? {
              ...prevShot.sceneContext,
              actionPhase: 'settle' as const,
              previousAction: prevShot.sceneContext.currentAction,
              currentAction: 'Scene continues',
              nextAction: '',
            } : undefined,
          });
        }
        
        state.script = { shots };
        
        // Store scene-level consistency locks
        if (scriptResult.consistency) {
          state.sceneConsistency = {
            character: scriptResult.consistency.character || '',
            location: scriptResult.consistency.location || '',
            lighting: scriptResult.consistency.lighting || '',
          };
          console.log(`[Hollywood] Scene consistency locks captured`);
        }
        
        console.log(`[Hollywood] Story broken down into ${state.script.shots.length} shots with scene context`);
      }
    } catch (err) {
      console.warn(`[Hollywood] Story breakdown failed, using fallback:`, err);
      // Fallback: Split story into roughly equal parts with action phases
      const storyParts = request.approvedStory.split('\n\n').filter((p: string) => p.trim());
      const actionPhases = ['establish', 'initiate', 'develop', 'escalate', 'peak', 'settle'] as const;
      state.script = {
        shots: Array.from({ length: state.clipCount }, (_, i) => ({
          id: `shot_${i + 1}`,
          title: `Clip ${i + 1}`,
          description: storyParts[i % storyParts.length] || `Scene ${i + 1} of the story.`,
          durationSeconds: state.clipDuration,
          mood: request.mood || 'cinematic',
          sceneContext: {
            actionPhase: actionPhases[i % actionPhases.length],
            previousAction: i > 0 ? (storyParts[(i - 1) % storyParts.length]?.substring(0, 50) || '') : '',
            currentAction: storyParts[i % storyParts.length]?.substring(0, 50) || '',
            nextAction: i < state.clipCount - 1 ? (storyParts[(i + 1) % storyParts.length]?.substring(0, 50) || '') : '',
            characterDescription: '',
            locationDescription: '',
            lightingDescription: '',
          },
        })),
      };
    }
  } else if (request.concept && !request.manualPrompts) {
    console.log(`[Hollywood] Generating script from concept (scene-based)...`);
    
    try {
      const scriptResult = await callEdgeFunction('smart-script-generator', {
        topic: request.concept,
        synopsis: request.concept,
        genre: request.genre || 'cinematic',
        pacingStyle: 'moderate',
        targetDurationSeconds: state.clipCount * state.clipDuration,
        characterLock, // Pass character lock for consistency
      });
      
      if (scriptResult.shots || scriptResult.clips) {
        const rawShots = scriptResult.shots || scriptResult.clips;
        const shots = rawShots.slice(0, state.clipCount).map((shot: any, i: number) => ({
          id: shot.id || `shot_${i + 1}`,
          title: shot.title || `Clip ${i + 1}`,
          description: shot.description || '',
          durationSeconds: shot.durationSeconds || state.clipDuration,
          mood: shot.mood || request.mood || 'cinematic',
          dialogue: shot.dialogue || '',
          // Capture scene context
          sceneContext: shot.actionPhase ? {
            actionPhase: shot.actionPhase,
            previousAction: shot.previousAction || '',
            currentAction: shot.currentAction || shot.description?.substring(0, 100) || '',
            nextAction: shot.nextAction || '',
            characterDescription: shot.characterDescription || scriptResult.consistency?.character || '',
            locationDescription: shot.locationDescription || scriptResult.consistency?.location || '',
            lightingDescription: shot.lightingDescription || scriptResult.consistency?.lighting || '',
          } : undefined,
        }));
        
        while (shots.length < state.clipCount) {
          const actionPhases = ['establish', 'initiate', 'develop', 'escalate', 'peak', 'settle'] as const;
          shots.push({
            id: `shot_${shots.length + 1}`,
            title: `Clip ${shots.length + 1}`,
            description: `${request.concept}. Clip ${shots.length + 1} of ${state.clipCount}.`,
            durationSeconds: state.clipDuration,
            mood: request.mood || 'cinematic',
            sceneContext: {
              actionPhase: actionPhases[shots.length % actionPhases.length],
              previousAction: '',
              currentAction: '',
              nextAction: '',
              characterDescription: scriptResult.consistency?.character || '',
              locationDescription: scriptResult.consistency?.location || '',
              lightingDescription: scriptResult.consistency?.lighting || '',
            },
          });
        }
        
        state.script = { shots };
        
        // Store scene-level consistency locks
        if (scriptResult.consistency) {
          state.sceneConsistency = {
            character: scriptResult.consistency.character || '',
            location: scriptResult.consistency.location || '',
            lighting: scriptResult.consistency.lighting || '',
          };
        }
        
        console.log(`[Hollywood] Script generated: ${state.script.shots.length} shots with scene context`);
      }
    } catch (err) {
      console.warn(`[Hollywood] Script generation failed, using fallback:`, err);
      const actionPhases = ['establish', 'initiate', 'develop', 'escalate', 'peak', 'settle'] as const;
      state.script = {
        shots: Array.from({ length: state.clipCount }, (_, i) => ({
          id: `shot_${i + 1}`,
          title: `Clip ${i + 1}`,
          description: `${request.concept}. Clip ${i + 1} of ${state.clipCount}.`,
          durationSeconds: state.clipDuration,
          mood: request.mood || 'cinematic',
          sceneContext: {
            actionPhase: actionPhases[i % actionPhases.length],
            previousAction: '',
            currentAction: `${request.concept} - moment ${i + 1}`,
            nextAction: '',
            characterDescription: '',
            locationDescription: '',
            lightingDescription: '',
          },
        })),
      };
    }
  } else if (request.manualPrompts) {
    const actionPhases = ['establish', 'initiate', 'develop', 'escalate', 'peak', 'settle'] as const;
    const prompts = request.manualPrompts;
    state.script = {
      shots: prompts.slice(0, state.clipCount).map((prompt, i) => ({
        id: `shot_${i + 1}`,
        title: `Clip ${i + 1}`,
        description: prompt,
        durationSeconds: state.clipDuration,
        mood: request.mood,
        sceneContext: {
          actionPhase: actionPhases[i % actionPhases.length],
          previousAction: i > 0 ? (prompts[i - 1]?.substring(0, 50) || '') : '',
          currentAction: prompt.substring(0, 100),
          nextAction: i < prompts.length - 1 ? (prompts[i + 1]?.substring(0, 50) || '') : '',
          characterDescription: '',
          locationDescription: '',
          lightingDescription: '',
        },
      })),
    };
  }
  
  // =====================================================
  // MULTI-CAMERA ORCHESTRATOR: Add professional coverage
  // =====================================================
  if (state.script?.shots && state.script.shots.length > 0) {
    console.log(`[Hollywood] Running Multi-Camera Orchestrator for ${state.script.shots.length} shots...`);
    
    try {
      // Determine style based on genre
      const styleMap: Record<string, string> = {
        'cinematic': 'cinematic',
        'documentary': 'documentary',
        'ad': 'action',
        'educational': 'dialogue-heavy',
        'funny': 'action',
        'motivational': 'contemplative',
        'storytelling': 'cinematic',
        'explainer': 'dialogue-heavy',
        'vlog': 'documentary',
      };
      
      const cameraStyle = styleMap[request.genre || 'cinematic'] || 'cinematic';
      
      const orchestrationResult = await callEdgeFunction('multi-camera-orchestrator', {
        shots: state.script.shots.map(shot => ({
          id: shot.id,
          description: shot.description,
          sceneType: (shot as any).sceneType || 'action',
          dialogue: shot.dialogue,
          durationSeconds: shot.durationSeconds,
          mood: shot.mood,
          characters: state.extractedCharacters?.map(c => c.name) || [],
        })),
        style: cameraStyle,
        pacingPreference: 'moderate',
        aspectRatio: '16:9',
        enforceCoverage: true,
      });
      
      if (orchestrationResult.success && orchestrationResult.orchestratedShots) {
        // Update shots with camera-enhanced prompts
        const enhancedShots = orchestrationResult.orchestratedShots;
        
        state.script.shots = state.script.shots.map((shot, idx) => {
          const enhanced = enhancedShots[idx];
          if (enhanced) {
            return {
              ...shot,
              description: enhanced.enhancedPrompt,
              cameraScale: enhanced.cameraSetup?.scale,
              cameraAngle: enhanced.cameraSetup?.angle,
              cameraMovement: enhanced.cameraSetup?.movement,
              coverageType: enhanced.coverageType,
            };
          }
          return shot;
        });
        
        console.log(`[Hollywood] Multi-Camera Orchestration complete:`);
        console.log(`  - Camera variety score: ${orchestrationResult.coverageSummary?.varietyScore || 0}%`);
        console.log(`  - Scale distribution: ${JSON.stringify(orchestrationResult.coverageSummary?.scaleDistribution || {})}`);
        console.log(`  - Coverage types: ${JSON.stringify(orchestrationResult.coverageSummary?.coverageTypes || {})}`);
        
        // Store orchestration data for later reference
        (state as any).cameraOrchestration = {
          style: cameraStyle,
          varietyScore: orchestrationResult.coverageSummary?.varietyScore,
          scaleDistribution: orchestrationResult.coverageSummary?.scaleDistribution,
          coverageTypes: orchestrationResult.coverageSummary?.coverageTypes,
        };
      }
    } catch (err) {
      console.warn(`[Hollywood] Multi-Camera Orchestration failed, using original prompts:`, err);
    }
  }
  
  state.progress = 20;
  await updateProjectProgress(supabase, state.projectId, 'preproduction', 20, { 
    scriptGenerated: true,
    cameraOrchestration: !!(state as any).cameraOrchestration,
  });
  
  // 1b. Use pre-analyzed reference image OR analyze reference image
  if (request.referenceImageAnalysis) {
    console.log(`[Hollywood] Using pre-analyzed reference image...`);
    state.referenceAnalysis = request.referenceImageAnalysis;
    state.identityBible = {
      characterIdentity: request.referenceImageAnalysis.characterIdentity,
      consistencyPrompt: request.referenceImageAnalysis.consistencyPrompt,
    };
  } else if (request.referenceImageUrl) {
    console.log(`[Hollywood] Analyzing reference image...`);
    
    try {
      const [analysisResult, identityResult] = await Promise.all([
        callEdgeFunction('analyze-reference-image', {
          imageUrl: request.referenceImageUrl,
        }),
        callEdgeFunction('generate-identity-bible', {
          imageUrl: request.referenceImageUrl,
          // Enable 5-view system with back view and silhouette
          generateBackView: true,
          generateSilhouette: true,
        }).catch(err => {
          console.warn(`[Hollywood] Identity Bible generation failed:`, err);
          return null;
        }),
      ]);
      
      const analysis = analysisResult.analysis || analysisResult;
      state.referenceAnalysis = analysis;
      
      state.identityBible = {
        characterIdentity: analysis.characterIdentity,
        consistencyPrompt: analysis.consistencyPrompt,
      };
      
      if (identityResult?.success) {
        // Enhanced 5-view system (v2.0)
        state.identityBible.multiViewUrls = {
          frontViewUrl: identityResult.views?.front?.imageUrl || identityResult.frontViewUrl,
          sideViewUrl: identityResult.views?.side?.imageUrl || identityResult.sideViewUrl,
          threeQuarterViewUrl: identityResult.views?.threeQuarter?.imageUrl || identityResult.threeQuarterViewUrl,
          backViewUrl: identityResult.views?.back?.imageUrl,
          silhouetteUrl: identityResult.views?.silhouette?.imageUrl,
        };
        state.identityBible.consistencyAnchors = identityResult.consistencyAnchors || [];
        
        // NEW: Non-facial anchors for occlusion handling
        if (identityResult.nonFacialAnchors) {
          state.identityBible.nonFacialAnchors = {
            bodyType: identityResult.nonFacialAnchors.bodyType,
            clothingSignature: identityResult.nonFacialAnchors.clothingDescription || identityResult.nonFacialAnchors.clothingDistinctive,
            hairFromBehind: identityResult.nonFacialAnchors.hairFromBehind,
            silhouetteDescription: identityResult.nonFacialAnchors.overallSilhouette,
            gait: identityResult.nonFacialAnchors.gait,
            posture: identityResult.nonFacialAnchors.posture,
          };
          console.log(`[Hollywood] Non-facial anchors extracted: bodyType=${identityResult.nonFacialAnchors.bodyType}`);
        }
        
        // NEW: Occlusion negatives for anti-morphing
        if (identityResult.occlusionNegatives) {
          state.identityBible.occlusionNegatives = identityResult.occlusionNegatives;
          console.log(`[Hollywood] Occlusion negatives: ${identityResult.occlusionNegatives.length} anti-morphing prompts`);
        }
        
        if (identityResult.characterDescription || identityResult.enhancedConsistencyPrompt) {
          state.identityBible.consistencyPrompt = identityResult.enhancedConsistencyPrompt || identityResult.characterDescription;
        }
        
        console.log(`[Hollywood] Identity Bible v2.0 generated: ${identityResult.viewCount || 3} views, non-facial anchors=${!!identityResult.nonFacialAnchors}`);
      }
      
      console.log(`[Hollywood] Reference analyzed: ${analysis.consistencyPrompt?.substring(0, 50)}...`);
    } catch (err) {
      console.warn(`[Hollywood] Reference analysis failed:`, err);
    }
  }
  
  // 1c. Generate Identity Bible from script if no reference
  if (!state.identityBible && state.script?.shots.some(s => s.description.includes('character'))) {
    console.log(`[Hollywood] Generating Identity Bible from script...`);
    
    try {
      const characterDescriptions = state.script.shots
        .map(s => s.description)
        .join(' ')
        .match(/character[^.]*\./gi) || [];
      
      if (characterDescriptions.length > 0) {
        state.identityBible = {
          characterIdentity: {
            description: characterDescriptions.join(' '),
          },
          consistencyPrompt: characterDescriptions.join(' '),
        };
      }
    } catch (err) {
      console.warn(`[Hollywood] Identity Bible generation failed:`, err);
    }
  }
  
  state.progress = 25;
  
  // 1d. Extract characters from script
  if (state.script?.shots) {
    console.log(`[Hollywood] Extracting characters from script...`);
    
    try {
      const scriptText = state.script.shots
        .map(s => `${s.title}: ${s.description}${s.dialogue ? ` "${s.dialogue}"` : ''}`)
        .join('\n\n');
      
      const characterResult = await callEdgeFunction('extract-characters', {
        script: scriptText,
      });
      
      if (characterResult.success && characterResult.characters?.length > 0) {
        const characters: ExtractedCharacter[] = characterResult.characters;
        state.extractedCharacters = characters;
        console.log(`[Hollywood] Extracted ${characters.length} characters:`, 
          characters.map(c => c.name).join(', '));
        
        if (!state.identityBible?.consistencyPrompt && characters.length > 0) {
          const characterDescriptions = characters.map(c => {
            const parts = [c.name];
            if (c.appearance) parts.push(c.appearance);
            if (c.clothing) parts.push(`wearing ${c.clothing}`);
            if (c.distinguishingFeatures) parts.push(c.distinguishingFeatures);
            return parts.join(': ');
          }).join('. ');
          
          state.identityBible = {
            ...state.identityBible,
            consistencyPrompt: characterDescriptions,
          };
          console.log(`[Hollywood] Built character consistency prompt from extracted characters`);
        }
      }
    } catch (err) {
      console.warn(`[Hollywood] Character extraction failed:`, err);
    }
  }
  
  // 1e. Generate Multi-Character Identity Bible (ALWAYS for 2+ characters, all tiers)
  if ((state.extractedCharacters?.length || 0) >= 2) {
    console.log(`[Hollywood] Generating Multi-Character Identity Bible for ${state.extractedCharacters?.length} characters...`);
    
    try {
      const scriptText = state.script?.shots
        .map(s => `${s.title}: ${s.description}${s.dialogue ? ` "${s.dialogue}"` : ''}`)
        .join('\n\n') || '';
      
      const multiCharResult = await callEdgeFunction('generate-multi-character-bible', {
        projectId: state.projectId,
        script: scriptText,
        characterDescriptions: state.extractedCharacters?.map(c => ({
          name: c.name,
          role: 'supporting' as const,
          description: `${c.appearance || ''} ${c.clothing || ''} ${c.distinguishingFeatures || ''}`.trim(),
        })),
        generate3PointViews: true,
      });
      
      if (multiCharResult.success && multiCharResult.bible) {
        (state as any).multiCharacterBible = multiCharResult.bible;
        console.log(`[Hollywood] Multi-Character Bible complete: ${multiCharResult.bible.characters?.length || 0} characters with ${multiCharResult.bible.shotPresence?.length || 0} shot mappings`);
        
        const multiCharPrompts = multiCharResult.bible.characters
          ?.map((c: any) => c.consistencyPrompt)
          .filter(Boolean)
          .join('. ');
        
        if (multiCharPrompts && state.identityBible) {
          state.identityBible.consistencyPrompt = `${state.identityBible.consistencyPrompt || ''}. CHARACTERS: ${multiCharPrompts}`;
        }
      } else {
        console.error(`[Hollywood] Multi-Character Bible returned no bible`);
      }
    } catch (err) {
      console.error(`[Hollywood] Multi-Character Bible generation FAILED:`, err);
    }
  } else {
    console.log(`[Hollywood] Skipping Multi-Character Bible (only ${state.extractedCharacters?.length || 0} characters)`);
  }
  
  state.progress = 30;
  await updateProjectProgress(supabase, state.projectId, 'preproduction', 30, { 
    scriptGenerated: true,
    charactersExtracted: state.extractedCharacters?.length || 0,
    multiCharacterBible: !!(state as any).multiCharacterBible,
  });
  
  return state;
}

// Stage 2: QUALITY GATE
async function runQualityGate(
  request: PipelineRequest,
  state: PipelineState,
  supabase: any
): Promise<PipelineState> {
  console.log(`[Hollywood] Stage 2: QUALITY GATE (Cinematic Auditor)`);
  state.stage = 'qualitygate';
  state.progress = 35;
  await updateProjectProgress(supabase, state.projectId, 'qualitygate', 35);
  
  if (!state.script?.shots) {
    throw new Error("No script shots to audit");
  }
  
  try {
    const auditResult = await callEdgeFunction('cinematic-auditor', {
      shots: state.script.shots,
      referenceAnalysis: state.referenceAnalysis,
      projectType: request.genre || 'cinematic',
      title: `Project ${state.projectId}`,
    });
    
    if (auditResult.audit) {
      state.auditResult = {
        overallScore: auditResult.audit.overallScore,
        optimizedShots: auditResult.audit.optimizedShots || [],
        velocityVectors: auditResult.audit.velocityVectors || [],
      };
      
      console.log(`[Hollywood] Audit complete: Score ${state.auditResult.overallScore}/100`);
      console.log(`[Hollywood] Optimized ${state.auditResult.optimizedShots.length} shots`);
      console.log(`[Hollywood] Generated ${state.auditResult.velocityVectors?.length || 0} velocity vectors`);
    }
  } catch (err) {
    console.warn(`[Hollywood] Cinematic audit failed, using original prompts:`, err);
    state.auditResult = {
      overallScore: 70,
      optimizedShots: state.script.shots.map(shot => ({
        shotId: shot.id,
        originalDescription: shot.description,
        optimizedDescription: `${shot.description}. Cinematic quality, realistic physics, natural motion.`,
        identityAnchors: state.identityBible?.consistencyPrompt 
          ? [state.identityBible.consistencyPrompt] 
          : [],
        physicsGuards: ['natural movement', 'consistent lighting'],
      })),
    };
  }
  
  // 2b. Run Depth Consistency Analysis for ALL shots (removed slice limit)
  if (state.auditResult?.optimizedShots) {
    console.log(`[Hollywood] Running Depth Consistency Analysis for ALL ${state.auditResult.optimizedShots.length} shots...`);
    
    try {
      // Use scene images or reference image for depth analysis - NO LIMIT
      const shotsForAnalysis = state.auditResult.optimizedShots.map((shot, i) => ({
        id: shot.shotId,
        frameUrl: state.assets?.sceneImages?.[i]?.imageUrl || request.referenceImageUrl || '',
        description: shot.optimizedDescription,
        previousShotId: i > 0 ? state.auditResult!.optimizedShots[i - 1].shotId : undefined,
      })).filter(s => s.frameUrl);
      
      if (shotsForAnalysis.length > 0) {
        const depthResult = await callEdgeFunction('analyze-depth-consistency', {
          projectId: state.projectId,
          shots: shotsForAnalysis,
          knownObjects: state.extractedCharacters?.map(c => ({
            name: c.name,
            type: 'character',
            isPersistent: true,
          })) || [],
          strictness: 'normal',
        });
        
        if (depthResult.success) {
          (state as any).depthConsistency = {
            overallScore: depthResult.state?.overallScore || 0,
            violations: depthResult.violations || [],
            correctivePrompts: depthResult.correctivePrompts || [],
          };
          
          console.log(`[Hollywood] Depth Consistency Score: ${depthResult.state?.overallScore || 0}/100`);
          console.log(`[Hollywood] Found ${depthResult.violations?.length || 0} spatial violations`);
          
          // Apply corrective prompts to optimized shots
          if (depthResult.correctivePrompts?.length > 0) {
            for (const correction of depthResult.correctivePrompts) {
              const shotIdx = state.auditResult!.optimizedShots.findIndex(s => s.shotId === correction.shotId);
              if (shotIdx >= 0) {
                state.auditResult!.optimizedShots[shotIdx].optimizedDescription = correction.correctedPrompt;
                console.log(`[Hollywood] Applied depth corrections to ${correction.shotId}`);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[Hollywood] Depth Consistency Analysis failed:`, err);
    }
  }
  
  // 2c. Run Lip Sync Analysis for shots with dialogue (all tiers)
  if (state.auditResult?.optimizedShots) {
    const shotsWithDialogue = state.script?.shots?.filter(s => s.dialogue && s.dialogue.trim().length > 0) || [];
    
    if (shotsWithDialogue.length > 0) {
      console.log(`[Hollywood] Running Lip Sync Analysis for ${shotsWithDialogue.length} dialogue shots...`);
      
      try {
        const lipSyncPromises = shotsWithDialogue.map(async (shot) => {
          // Find character speaking in this shot
          const speakingCharacter = state.extractedCharacters?.find(c => 
            shot.dialogue?.toLowerCase().includes(c.name.toLowerCase()) ||
            shot.description?.toLowerCase().includes(c.name.toLowerCase())
          );
          
          const result = await callEdgeFunction('analyze-lip-sync', {
            shotId: shot.id,
            dialogue: shot.dialogue,
            characterId: speakingCharacter?.id || 'unknown',
            characterName: speakingCharacter?.name || 'Character',
            shotDuration: shot.durationSeconds || 5,
            context: shot.description,
          });
          
          return { shotId: shot.id, result };
        });
        
        const lipSyncResults = await Promise.all(lipSyncPromises);
        
        // Store lip sync data and apply prompt enhancements
        const lipSyncMap: Record<string, any> = {};
        
        for (const { shotId, result } of lipSyncResults) {
          if (result.success && result.data) {
            lipSyncMap[shotId] = result.data;
            
            // Apply lip sync prompt enhancement to optimized shot
            if (result.data.lipSyncPromptEnhancement) {
              const shotIdx = state.auditResult!.optimizedShots.findIndex(s => s.shotId === shotId);
              if (shotIdx >= 0) {
                const existingDesc = state.auditResult!.optimizedShots[shotIdx].optimizedDescription;
                state.auditResult!.optimizedShots[shotIdx].optimizedDescription = 
                  `${existingDesc}. [LIP SYNC: ${result.data.lipSyncPromptEnhancement}]`;
                console.log(`[Hollywood] Applied lip sync enhancement to ${shotId}`);
              }
            }
          }
        }
        
        (state as any).lipSyncData = lipSyncMap;
        console.log(`[Hollywood] Lip Sync Analysis complete for ${Object.keys(lipSyncMap).length} shots`);
        
      } catch (err) {
        console.warn(`[Hollywood] Lip Sync Analysis failed:`, err);
      }
    }
  }
  
  state.progress = 45;
  await updateProjectProgress(supabase, state.projectId, 'qualitygate', 45, {
    auditScore: state.auditResult?.overallScore || 0,
    depthScore: (state as any).depthConsistency?.overallScore,
    lipSyncEnabled: !!(state as any).lipSyncData,
  });
  
  return state;
}

// Stage 3: ASSET CREATION
async function runAssetCreation(
  request: PipelineRequest,
  state: PipelineState,
  supabase: any
): Promise<PipelineState> {
  console.log(`[Hollywood] Stage 3: ASSET CREATION`);
  state.stage = 'assets';
  state.progress = 50;
  await updateProjectProgress(supabase, state.projectId, 'assets', 50);
  
  state.assets = {};
  
  // 3a. Generate scene reference images for ALL shots (removed slice limit)
  console.log(`[Hollywood] Generating scene reference images for ALL shots...`);
  
  if (state.script?.shots) {
    try {
      // Generate images for ALL shots, not just first 3
      const scenes = state.script.shots.map((shot, i) => ({
        sceneNumber: i + 1,
        title: shot.title,
        visualDescription: state.auditResult?.optimizedShots[i]?.optimizedDescription || shot.description,
        mood: shot.mood,
      }));
      
      const imageResult = await callEdgeFunction('generate-scene-images', {
        scenes,
        projectId: state.projectId,
        globalStyle: 'Cinematic film still, professional color grading, high detail',
      });
      
      if (imageResult.images) {
        state.assets.sceneImages = imageResult.images;
        console.log(`[Hollywood] Generated ${imageResult.images.length} scene images for ALL shots`);
      } else {
        console.error(`[Hollywood] Scene image generation returned no images`);
      }
    } catch (err) {
      console.error(`[Hollywood] Scene image generation FAILED:`, err);
    }
  } else {
    console.error(`[Hollywood] No script shots available for scene images`);
  }
  
  state.progress = 55;
  await updateProjectProgress(supabase, state.projectId, 'assets', 55);
  
  // 3b. Generate voice narration (ALWAYS - no optional flag)
  console.log(`[Hollywood] Generating voice narration...`);
  
  try {
    const narrationText = state.script?.shots
      ?.map(shot => shot.dialogue || shot.description)
      .join(' ')
      .substring(0, 2000) || '';
    
    if (narrationText && narrationText.length > 50) {
      const voiceResult = await callEdgeFunction('generate-voice', {
        text: narrationText,
        voiceId: request.voiceId || 'EXAVITQu4vr4xnSDxMaL',
        projectId: state.projectId,
      });
      
      if (voiceResult.audioUrl) {
        state.assets.voiceUrl = voiceResult.audioUrl;
        state.assets.voiceDuration = voiceResult.durationMs ? voiceResult.durationMs / 1000 : state.clipCount * state.clipDuration;
        console.log(`[Hollywood] Voice generated: ${state.assets.voiceUrl}`);
      } else {
        console.error(`[Hollywood] Voice generation returned no URL`);
      }
    } else {
      console.warn(`[Hollywood] No narration text available (${narrationText?.length || 0} chars)`);
    }
  } catch (err) {
    console.error(`[Hollywood] Voice generation FAILED:`, err);
  }
  
  state.progress = 60;
  await updateProjectProgress(supabase, state.projectId, 'assets', 60, { hasVoice: !!state.assets.voiceUrl });
  
  // 3c. Generate background music with scene synchronization (ALWAYS - no optional flag)
  console.log(`[Hollywood] Generating synchronized background music...`);
  
  try {
    // ALWAYS use music sync engine for all tiers
    console.log(`[Hollywood] Using Music Sync Engine...`);
    
    if (state.script?.shots) {
      const syncResult = await callEdgeFunction('sync-music-to-scenes', {
        projectId: state.projectId,
        shots: state.script.shots.map(s => ({
          id: s.id,
          description: s.description,
          dialogue: s.dialogue,
          durationSeconds: s.durationSeconds,
          mood: s.mood,
        })),
        totalDuration: state.clipCount * state.clipDuration,
        overallMood: request.musicMood || request.mood || 'dramatic',
        tempoPreference: 'dynamic',
        includeDialogueDucking: true,
      });
      
      if (syncResult.success && syncResult.plan) {
        (state as any).musicSyncPlan = syncResult.plan;
        console.log(`[Hollywood] Music sync plan created with ${syncResult.plan.musicCues?.length || 0} cues`);
        console.log(`[Hollywood] Detected ${syncResult.plan.emotionalBeats?.length || 0} emotional beats`);
        console.log(`[Hollywood] Created ${syncResult.plan.timingMarkers?.length || 0} timing markers`);
        
        const musicResult = await callEdgeFunction('generate-music', {
          prompt: syncResult.musicPrompt,
          mood: request.musicMood || request.mood || 'cinematic',
          genre: 'hybrid',
          duration: state.clipCount * state.clipDuration + 2,
          projectId: state.projectId,
        });
        
        if (musicResult.musicUrl) {
          state.assets.musicUrl = musicResult.musicUrl;
          state.assets.musicDuration = musicResult.durationSeconds;
          console.log(`[Hollywood] Synchronized music generated: ${state.assets.musicUrl}`);
        } else {
          console.error(`[Hollywood] Music generation returned no URL`);
        }
      } else {
        console.error(`[Hollywood] Music sync failed, trying direct generation...`);
        // Fallback to direct music generation
        const musicResult = await callEdgeFunction('generate-music', {
          mood: request.musicMood || request.mood || 'cinematic',
          genre: 'hybrid',
          duration: state.clipCount * state.clipDuration + 2,
          projectId: state.projectId,
        });
        
        if (musicResult.musicUrl) {
          state.assets.musicUrl = musicResult.musicUrl;
          state.assets.musicDuration = musicResult.durationSeconds;
          console.log(`[Hollywood] Music generated (fallback): ${state.assets.musicUrl}`);
        }
      }
    }
  } catch (err) {
    console.error(`[Hollywood] Music generation FAILED:`, err);
  }
  
  state.progress = 65;
  
  // 3d. Generate Sound Effects (all tiers now)
  if (state.script?.shots) {
    console.log(`[Hollywood] Generating SFX analysis...`);
    
    try {
      const sfxResult = await callEdgeFunction('generate-sfx', {
        projectId: state.projectId,
        shots: state.script.shots.map(s => ({
          id: s.id,
          description: s.description,
          durationSeconds: s.durationSeconds,
          hasDialogue: !!(s.dialogue && s.dialogue.trim().length > 0),
          environment: s.mood,
        })),
        totalDuration: state.clipCount * state.clipDuration,
        includeAmbient: true,
        includeFoley: true,
        includeActionSFX: true,
        style: 'realistic',
      });
      
      if (sfxResult.success && sfxResult.plan) {
        (state as any).sfxPlan = sfxResult.plan;
        console.log(`[Hollywood] SFX plan created: ${sfxResult.summary?.ambientBedCount || 0} ambient beds, ${sfxResult.summary?.sfxCueCount || 0} SFX cues`);
      }
    } catch (err) {
      console.warn(`[Hollywood] SFX generation failed:`, err);
    }
  }
  
  // 3e. Run Color Grading Analysis (all tiers now)
  if (state.script?.shots) {
    console.log(`[Hollywood] Running color grading analysis...`);
    
    try {
      const colorResult = await callEdgeFunction('apply-color-grading', {
        projectId: state.projectId,
        shots: state.script.shots.map(s => ({
          id: s.id,
          description: state.auditResult?.optimizedShots?.find(o => o.shotId === s.id)?.optimizedDescription || s.description,
          mood: s.mood,
        })),
        targetPreset: request.colorGrading as any || 'cinematic',
        enforceConsistency: true,
      });
      
      if (colorResult.success) {
        (state as any).colorGrading = {
          masterPreset: colorResult.masterPreset,
          masterFilter: colorResult.masterFFmpegFilter,
          masterPrompt: colorResult.masterColorPrompt,
          consistencyScore: colorResult.consistencyScore,
          shotGradings: colorResult.shotGradings,
        };
        console.log(`[Hollywood] Color grading: ${colorResult.masterPreset} preset, consistency ${colorResult.consistencyScore}%`);
        
        // Apply color prompt enhancements to optimized shots
        if (colorResult.colorPromptEnhancements && state.auditResult?.optimizedShots) {
          for (const enhancement of colorResult.colorPromptEnhancements) {
            const shotIdx = state.auditResult.optimizedShots.findIndex(s => s.shotId === enhancement.shotId);
            if (shotIdx >= 0) {
              const existingDesc = state.auditResult.optimizedShots[shotIdx].optimizedDescription;
              state.auditResult.optimizedShots[shotIdx].optimizedDescription = 
                `${existingDesc}. [COLOR: ${enhancement.prompt}]`;
            }
          }
          console.log(`[Hollywood] Applied color grading prompts to ${colorResult.colorPromptEnhancements.length} shots`);
        }
      }
    } catch (err) {
      console.warn(`[Hollywood] Color grading analysis failed:`, err);
    }
  }
  
  state.progress = 70;
  await updateProjectProgress(supabase, state.projectId, 'assets', 70, {
    hasVoice: !!state.assets.voiceUrl,
    hasMusic: !!state.assets.musicUrl,
    hasMusicSyncPlan: !!(state as any).musicSyncPlan,
    musicCues: (state as any).musicSyncPlan?.musicCues?.length || 0,
    emotionalBeats: (state as any).musicSyncPlan?.emotionalBeats?.length || 0,
    hasSfxPlan: !!(state as any).sfxPlan,
    sfxCues: (state as any).sfxPlan?.sfxCues?.length || 0,
    hasColorGrading: !!(state as any).colorGrading,
    colorPreset: (state as any).colorGrading?.masterPreset,
  });
  
  return state;
}

// Stage 4: PRODUCTION (Sequential Single-Clip Generation)
async function runProduction(
  request: PipelineRequest,
  state: PipelineState,
  supabase: any
): Promise<PipelineState> {
  console.log(`[Hollywood] Stage 4: PRODUCTION (Video Generation - ${state.clipCount} clips, one at a time)`);
  state.stage = 'production';
  state.progress = 75;
  await updateProjectProgress(supabase, state.projectId, 'production', 75);
  
  // Build character identity prompt
  const characterIdentityPrompt = state.extractedCharacters?.length 
    ? state.extractedCharacters.map(c => {
        const parts = [`${c.name}`];
        if (c.appearance) parts.push(c.appearance);
        if (c.clothing) parts.push(`wearing ${c.clothing}`);
        if (c.age) parts.push(`${c.age}`);
        if (c.distinguishingFeatures) parts.push(c.distinguishingFeatures);
        return parts.join(', ');
      }).join('; ')
    : null;
  
  console.log(`[Hollywood] Character identity: ${characterIdentityPrompt?.substring(0, 100) || 'none'}...`);
  
  // Build clip prompts from optimized shots OR script (for resume)
  // NEW: Include sceneContext for continuous flow
  let clips: Array<{ index: number; prompt: string; sceneContext?: SceneContext }> = [];
  
  if (state.auditResult && state.auditResult.optimizedShots && state.auditResult.optimizedShots.length > 0) {
    // Use optimized shots from audit - merge with script's sceneContext
    clips = state.auditResult.optimizedShots.slice(0, state.clipCount).map((opt, i) => {
      let finalPrompt = opt.optimizedDescription;
      
      if (characterIdentityPrompt) {
        finalPrompt = `[CHARACTERS: ${characterIdentityPrompt}] ${finalPrompt}`;
      }
      
      if (opt.identityAnchors?.length > 0) {
        finalPrompt = `[IDENTITY: ${opt.identityAnchors.join(', ')}] ${finalPrompt}`;
      }
      
      if (opt.physicsGuards?.length > 0) {
        finalPrompt = `${finalPrompt}. [PHYSICS: ${opt.physicsGuards.join(', ')}]`;
      }
      
      // Get sceneContext from original script shot
      const scriptShot = state.script?.shots?.[i];
      const sceneContext = scriptShot?.sceneContext || buildDefaultSceneContext(i, state);
      
      return {
        index: i,
        prompt: finalPrompt,
        sceneContext,
      };
    });
  } else if (state.script && state.script.shots && state.script.shots.length > 0) {
    // Use script shots directly (for resume scenarios)
    console.log(`[Hollywood] Building clips from script (${state.script.shots.length} shots) with scene context`);
    clips = state.script.shots.slice(0, state.clipCount).map((shot: any, i: number) => {
      let finalPrompt = shot.description || shot.title || 'Continue scene';
      
      if (characterIdentityPrompt) {
        finalPrompt = `[CHARACTERS: ${characterIdentityPrompt}] ${finalPrompt}`;
      }
      
      return {
        index: i,
        prompt: finalPrompt,
        sceneContext: shot.sceneContext || buildDefaultSceneContext(i, state),
      };
    });
  } else {
    // Try to load from existing video_clips table
    console.log(`[Hollywood] No shots available, loading prompts from existing clips`);
    const { data: existingClipPrompts } = await supabase
      .from('video_clips')
      .select('shot_index, prompt')
      .eq('project_id', state.projectId)
      .order('shot_index');
    
    if (existingClipPrompts && existingClipPrompts.length > 0) {
      clips = existingClipPrompts.map((c: any, i: number) => ({
        index: c.shot_index,
        prompt: c.prompt,
        sceneContext: buildDefaultSceneContext(i, state),
      }));
    }
  }
  
  console.log(`[Hollywood] Built ${clips.length} clip prompts with scene context`);
  
  // =====================================================
  // BULLETPROOF FRAME CHAINING: Build scene image lookup for guaranteed fallback
  // =====================================================
  const sceneImageLookup: Record<number, string> = {};
  if (state.assets?.sceneImages) {
    for (const img of state.assets.sceneImages) {
      if (img.imageUrl) {
        // sceneNumber is 1-indexed, shotIndex is 0-indexed
        sceneImageLookup[img.sceneNumber - 1] = img.imageUrl;
      }
    }
    console.log(`[Hollywood] Scene image lookup built: ${Object.keys(sceneImageLookup).length} images available`);
  }
  
  // Determine first frame reference (REQUIRED for Clip 1)
  let referenceImageUrl = state.identityBible?.multiViewUrls?.frontViewUrl 
    || request.referenceImageUrl
    || request.referenceImageAnalysis?.imageUrl;
  
  // Priority: explicit reference > scene image for clip 1
  if (!referenceImageUrl && sceneImageLookup[0]) {
    referenceImageUrl = sceneImageLookup[0];
    console.log(`[Hollywood] Using scene image 1 as Clip 1 starting frame`);
  }
  
  // CRITICAL: Clip 1 MUST have a starting image for visual continuity
  if (!referenceImageUrl) {
    console.error(`[Hollywood] ⚠️ CRITICAL: No starting image for Clip 1! Frame chaining will be suboptimal.`);
    console.error(`[Hollywood] Generate scene images first or provide a reference image.`);
    // Don't halt - proceed with text-to-video for clip 1, but log prominently
  } else {
    console.log(`[Hollywood] ✓ Clip 1 starting frame: ${referenceImageUrl.substring(0, 60)}...`);
  }
  
  console.log(`[Hollywood] Generating ${clips.length} clips with BULLETPROOF frame chaining...`);
  
  // Check for checkpoint - resume from last completed clip
  const { data: checkpoint } = await supabase
    .rpc('get_generation_checkpoint', { p_project_id: state.projectId });
  
  let startIndex = 0;
  // CRITICAL: Initialize to undefined, NOT referenceImageUrl
  // This ensures we detect broken frame chains on resume
  let previousLastFrameUrl: string | undefined = undefined;
  let previousMotionVectors: { 
    endVelocity?: string; 
    endDirection?: string; 
    cameraMomentum?: string;
    continuityPrompt?: string;
    actionContinuity?: string;
  } | undefined;
  
  if (checkpoint && checkpoint.length > 0 && checkpoint[0].last_completed_index >= 0) {
    startIndex = checkpoint[0].last_completed_index + 1;
    
    // Use checkpoint's last frame, fall back to scene image if needed
    if (checkpoint[0].last_frame_url) {
      previousLastFrameUrl = checkpoint[0].last_frame_url;
      console.log(`[Hollywood] Resuming from clip ${startIndex + 1}, using REAL last frame: ${previousLastFrameUrl?.substring(0, 50)}...`);
    } else {
      // WARNING: No frame from checkpoint - use scene image as fallback
      const sceneImageFallback = sceneImageLookup[startIndex - 1] || sceneImageLookup[startIndex] || referenceImageUrl;
      if (sceneImageFallback) {
        previousLastFrameUrl = sceneImageFallback;
        console.warn(`[Hollywood] ⚠️ Checkpoint missing frame, using scene image fallback: ${previousLastFrameUrl?.substring(0, 50)}...`);
      } else {
        console.error(`[Hollywood] ⚠️ CRITICAL: No frame available for resume! Frame chain broken.`);
      }
    }
    
    // Load existing completed clips
    const { data: existingClips } = await supabase
      .from('video_clips')
      .select('*')
      .eq('project_id', state.projectId)
      .eq('status', 'completed')
      .order('shot_index', { ascending: true });
    
    if (existingClips && existingClips.length > 0) {
      state.production = {
        clipResults: existingClips.map((clip: any) => ({
          index: clip.shot_index,
          videoUrl: clip.video_url,
          status: 'completed',
          lastFrameUrl: clip.last_frame_url,
        })),
      };
      
      // Get motion vectors from last completed clip
      const lastClip = existingClips[existingClips.length - 1];
      if (lastClip.motion_vectors) {
        try {
          previousMotionVectors = typeof lastClip.motion_vectors === 'string' 
            ? JSON.parse(lastClip.motion_vectors) 
            : lastClip.motion_vectors;
        } catch (e) {
          console.warn(`[Hollywood] Failed to parse motion vectors`);
        }
      }
    }
  }
  
  if (!state.production) {
    state.production = { clipResults: [] };
  }
  
  // Style anchor for consistency when no reference image
  let styleAnchor: any = null;
  const hasReferenceImage = !!referenceImageUrl || !!request.referenceImageUrl || !!state.identityBible?.consistencyPrompt;
  
  // =====================================================
  // SCENE ANCHOR ACCUMULATOR: Track visual DNA across clips for maximum consistency
  // =====================================================
  let accumulatedAnchors: any[] = [];
  let masterSceneAnchor: any = null;
  
  // Generate clips one at a time with proper frame chaining
  for (let i = startIndex; i < clips.length; i++) {
    const clip = clips[i];
    const progressPercent = 75 + Math.floor((i / clips.length) * 15);
    
    console.log(`[Hollywood] Generating clip ${i + 1}/${clips.length}...`);
    
    await updateProjectProgress(supabase, state.projectId, 'production', progressPercent, {
      clipsCompleted: i,
      clipCount: clips.length,
    });
    
    // =====================================================
    // SCRIPT ADAPTATION: Visual continuity takes precedence over script
    // The script guides the story, but the visual state is the source of truth
    // =====================================================
    let finalPrompt = '';
    
    // STEP 1: For clips 2+, START with visual continuity (source of truth)
    if (i > 0) {
      const visualContinuityParts: string[] = [];
      
      // Motion continuity from previous clip (most critical for seamless transitions)
      if (previousMotionVectors?.continuityPrompt) {
        visualContinuityParts.push(`[MANDATORY CONTINUATION: ${previousMotionVectors.continuityPrompt}]`);
      }
      if (previousMotionVectors?.actionContinuity) {
        visualContinuityParts.push(`[CURRENT ACTION: ${previousMotionVectors.actionContinuity}]`);
      }
      
      // Scene DNA from accumulated anchors (environment, lighting, colors)
      if (masterSceneAnchor?.masterConsistencyPrompt) {
        visualContinuityParts.push(`[SCENE DNA: ${masterSceneAnchor.masterConsistencyPrompt}]`);
      }
      
      // Add the visual continuity FIRST (it takes precedence)
      if (visualContinuityParts.length > 0) {
        finalPrompt = visualContinuityParts.join('\n') + '\n\n';
        console.log(`[Hollywood] Clip ${i + 1}: Visual continuity takes precedence (${visualContinuityParts.length} elements)`);
      }
      
      // STEP 2: Adapt script to visual state
      // The script is now a GOAL, not a mandate. Blend it with visual reality.
      const scriptGoal = clip.prompt;
      finalPrompt += `[STORY GOAL - adapt to maintain continuity: ${scriptGoal}]`;
      
    } else {
      // Clip 1: Use script directly (no previous clip to continue from)
      finalPrompt = clip.prompt;
    }
    
    // Style anchor injection (for when no reference image was provided)
    if (styleAnchor?.consistencyPrompt && !hasReferenceImage) {
      finalPrompt = `[STYLE ANCHOR: ${styleAnchor.consistencyPrompt}]\n${finalPrompt}`;
      console.log(`[Hollywood] Injected style anchor into clip ${i + 1}`);
    }
    
    // =====================================================
    // TIER-AWARE AUTO-RETRY: Use tier maxRetries setting
    // =====================================================
    const tierLimits = (request as any)._tierLimits || { maxRetries: 1 };
    const maxAttempts = Math.max(1, tierLimits.maxRetries + 1); // +1 for initial attempt
    
    let lastError: Error | null = null;
    let result: any = null;
    let lastErrorCategory: string = 'unknown';
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const isRetry = attempt > 0;
        if (isRetry) {
          console.log(`[Hollywood] Auto-retry attempt ${attempt + 1}/${maxAttempts} for clip ${i + 1} (tier: ${tierLimits.tier})...`);
          await updateProjectProgress(supabase, state.projectId, 'production', progressPercent, {
            clipsCompleted: i,
            clipCount: clips.length,
            retryingClip: i,
            retryAttempt: attempt + 1,
            maxRetries: maxAttempts,
          });
          
          // Exponential backoff: 2s, 4s, 8s, etc.
          const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
          console.log(`[Hollywood] Waiting ${backoffMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
        
        // =====================================================
        // CORRECT FRAME CHAINING LOGIC:
        // - Clip 1: Uses REFERENCE IMAGE as startImageUrl (establishes visual world)
        // - Clip 2+: Uses LAST FRAME from previous clip (maintains continuity)
        // CRITICAL: Never pass video URLs - only valid image URLs!
        // =====================================================
        let useStartImage: string | undefined;
        
        // Helper to validate URL is an image, not a video
        const isValidImageUrl = (url: string | undefined): boolean => {
          if (!url) return false;
          const lowerUrl = url.toLowerCase();
          // Reject video files
          if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm') || lowerUrl.endsWith('.mov')) {
            return false;
          }
          // Accept common image formats and base64 images
          if (lowerUrl.endsWith('.png') || lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || 
              lowerUrl.endsWith('.webp') || lowerUrl.startsWith('data:image/')) {
            return true;
          }
          // For URLs without extensions, check content-type hints in URL
          if (lowerUrl.includes('video/') || lowerUrl.includes('.mp4')) {
            return false;
          }
          // Assume valid if no video indicators
          return true;
        };
        
        if (i === 0) {
          // CLIP 1: Use reference image to establish the visual world
          if (referenceImageUrl && isValidImageUrl(referenceImageUrl)) {
            useStartImage = referenceImageUrl;
            console.log(`[Hollywood] Clip 1: IMAGE-TO-VIDEO using reference image: ${referenceImageUrl?.substring(0, 60)}...`);
          } else {
            console.log(`[Hollywood] Clip 1: TEXT-TO-VIDEO (no valid reference image)`);
          }
        } else {
          // CLIP 2+: Use previous clip's extracted last frame for continuity
          if (previousLastFrameUrl && isValidImageUrl(previousLastFrameUrl)) {
            useStartImage = previousLastFrameUrl;
            console.log(`[Hollywood] Clip ${i + 1}: FRAME-CHAINED from clip ${i}'s last frame: ${previousLastFrameUrl?.substring(0, 60)}...`);
          } else {
            // CRITICAL: No valid frame - proceed without frame chaining
            console.error(`[Hollywood] ⚠️ CRITICAL: No valid image frame for clip ${i + 1}! Proceeding WITHOUT frame-chaining.`);
            if (previousLastFrameUrl) {
              console.error(`[Hollywood] Invalid URL (likely video): ${previousLastFrameUrl.substring(0, 80)}...`);
            }
            // Do NOT use video URL - better to skip frame-chaining than crash Veo
            useStartImage = undefined;
          }
        }
        
        const clipResult = await callEdgeFunction('generate-single-clip', {
          userId: request.userId,
          projectId: state.projectId,
          clipIndex: i,
          prompt: finalPrompt,
          totalClips: clips.length,
          startImageUrl: useStartImage,
          previousMotionVectors,
          identityBible: state.identityBible,
          colorGrading: request.colorGrading || 'cinematic',
          qualityTier: request.qualityTier || 'standard',
          referenceImageUrl, // Still passed for character identity reference
          isRetry,
          retryAttempt: attempt,
          // Pass scene context for continuous action flow
          sceneContext: clip.sceneContext,
          // NEW: Pass accumulated anchors for visual consistency
          accumulatedAnchors: accumulatedAnchors.slice(-3), // Last 3 anchors
        });
        
        if (!clipResult.success) {
          throw new Error(clipResult.error || 'Clip generation failed');
        }
        
        result = clipResult.clipResult;
        lastError = null;
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        const errorMsg = lastError.message.toLowerCase();
        
        // Categorize error for smarter retries
        if (errorMsg.includes('timeout') || errorMsg.includes('deadline')) {
          lastErrorCategory = 'timeout';
        } else if (errorMsg.includes('quota') || errorMsg.includes('rate limit') || errorMsg.includes('429')) {
          lastErrorCategory = 'quota';
        } else if (errorMsg.includes('invalid') || errorMsg.includes('validation')) {
          lastErrorCategory = 'validation';
        } else if (errorMsg.includes('api') || errorMsg.includes('500') || errorMsg.includes('503')) {
          lastErrorCategory = 'api_error';
        } else {
          lastErrorCategory = 'unknown';
        }
        
        console.warn(`[Hollywood] Clip ${i + 1} attempt ${attempt + 1}/${maxAttempts} failed (${lastErrorCategory}):`, lastError.message);
        
        // Don't retry on validation errors - they won't fix themselves
        if (lastErrorCategory === 'validation') {
          console.log(`[Hollywood] Validation error - skipping remaining retries`);
          break;
        }
      }
    }
    
    // =====================================================
    // FAIL-SAFE CHECKPOINT: Save progress after each clip attempt
    // =====================================================
    const completedCount = state.production.clipResults.filter(c => c.status === 'completed').length;
    const failedShotIds = state.production.clipResults
      .filter(c => c.status === 'failed')
      .map(c => `shot_${c.index + 1}`);
    
    await supabase.rpc('update_generation_checkpoint', {
      p_project_id: state.projectId,
      p_last_completed_shot: completedCount > 0 ? Math.max(...state.production.clipResults.filter(c => c.status === 'completed').map(c => c.index)) : -1,
      p_total_shots: clips.length,
      p_failed_shots: JSON.stringify(failedShotIds),
    });
    
    // If all attempts failed, mark as failed and notify
    if (lastError || !result) {
      console.error(`[Hollywood] Clip ${i + 1} failed after ${maxAttempts} attempts (tier: ${tierLimits.tier}):`, lastError?.message);
      
      // Mark clip as failed in DB with retry_count and error category
      await supabase.rpc('upsert_video_clip', {
        p_project_id: state.projectId,
        p_user_id: request.userId,
        p_shot_index: i,
        p_prompt: finalPrompt,
        p_status: 'failed',
        p_error_message: `Exhausted ${maxAttempts} attempts (tier: ${tierLimits.tier}): ${lastError?.message || 'Unknown error'}`,
      });
      
      // Update retry count and error category
      await supabase
        .from('video_clips')
        .update({ 
          retry_count: maxAttempts - 1,
          max_retries: tierLimits.maxRetries,
          last_error_category: lastErrorCategory,
        })
        .eq('project_id', state.projectId)
        .eq('shot_index', i);
      
      state.production.clipResults.push({
        index: i,
        videoUrl: '',
        status: 'failed',
      });
      
      // Update progress to show failure (for UI notification)
      await updateProjectProgress(supabase, state.projectId, 'production', progressPercent, {
        clipsCompleted: state.production.clipResults.filter(c => c.status === 'completed').length,
        clipCount: clips.length,
        failedClips: state.production.clipResults.filter(c => c.status === 'failed').map(c => c.index),
        lastFailedClip: i,
        lastFailedError: lastError?.message,
        lastErrorCategory,
        retriesUsed: maxAttempts - 1,
        tierMaxRetries: tierLimits.maxRetries,
      });
      
      // Continue with remaining clips
      continue;
    }
    
    // Visual Debugger Loop (all tiers) - check quality and retry if needed
    if (result.videoUrl) {
      console.log(`[Hollywood] Extracting frame and running Visual Debugger on clip ${i + 1}...`);
      
      // =====================================================
      // BULLETPROOF FRAME EXTRACTION: Use new extract-last-frame with scene fallback
      // =====================================================
      let frameForAnalysis = result.lastFrameUrl;
      
      // Get scene image for this clip as fallback (guaranteed to exist if assets were generated)
      const sceneImageFallback = sceneImageLookup[i] || sceneImageLookup[i - 1] || sceneImageLookup[0];
      
      try {
        const frameResult = await callEdgeFunction('extract-last-frame', {
          videoUrl: result.videoUrl,
          projectId: state.projectId,
          shotIndex: i,
          shotPrompt: clip.prompt,
          sceneImageUrl: sceneImageFallback, // Guaranteed fallback
          position: 'last',
        });
        
        if (frameResult.success && frameResult.frameUrl) {
          // CRITICAL: Validate that we got an actual IMAGE, not the video URL back
          const frameUrl = frameResult.frameUrl;
          const isVideoUrl = frameUrl.endsWith('.mp4') || frameUrl.includes('video/mp4') || frameUrl.includes('/video-clips/');
          
          if (isVideoUrl) {
            console.error(`[Hollywood] ⚠️ Frame extraction returned VIDEO URL instead of image!`);
            console.error(`[Hollywood] Invalid frame URL: ${frameUrl.substring(0, 80)}...`);
            // Use scene image fallback
            if (sceneImageFallback) {
              result.lastFrameUrl = sceneImageFallback;
              frameForAnalysis = sceneImageFallback;
              console.log(`[Hollywood] Using scene image fallback: ${sceneImageFallback.substring(0, 60)}...`);
            }
          } else {
            frameForAnalysis = frameUrl;
            result.lastFrameUrl = frameUrl;
            console.log(`[Hollywood] ✓ Frame extracted via ${frameResult.method}: ${frameForAnalysis.substring(0, 80)}...`);
          }
        } else {
          console.warn(`[Hollywood] Frame extraction failed: ${frameResult.error || 'unknown error'}`);
          // Use scene image fallback
          if (sceneImageFallback) {
            result.lastFrameUrl = sceneImageFallback;
            frameForAnalysis = sceneImageFallback;
            console.log(`[Hollywood] Using scene image fallback: ${sceneImageFallback.substring(0, 60)}...`);
          } else {
            console.error(`[Hollywood] ⚠️ CRITICAL: No fallback available! Frame chain broken.`);
            result.lastFrameUrl = undefined;
          }
        }
      } catch (frameErr) {
        console.error(`[Hollywood] Frame extraction error:`, frameErr);
        // Use scene image fallback
        if (sceneImageFallback) {
          result.lastFrameUrl = sceneImageFallback;
          frameForAnalysis = sceneImageFallback;
          console.log(`[Hollywood] Using scene image fallback after error: ${sceneImageFallback.substring(0, 60)}...`);
        } else {
          result.lastFrameUrl = undefined;
        }
      }
      
      // STYLE ANCHOR EXTRACTION: After first clip (fallback for when no reference image)
      if (i === 0 && !hasReferenceImage && frameForAnalysis && !styleAnchor) {
        console.log(`[Hollywood] Extracting style anchor from first clip (no reference image provided)...`);
        try {
          const styleAnchorResult = await callEdgeFunction('extract-style-anchor', {
            frameUrl: frameForAnalysis,
            shotDescription: clip.prompt,
            projectId: state.projectId,
          });
          
          if (styleAnchorResult.success && styleAnchorResult.styleAnchor) {
            styleAnchor = styleAnchorResult.styleAnchor;
            console.log(`[Hollywood] Style anchor extracted: ${styleAnchor.anchors?.length || 0} visual anchors`);
            
            // Store in identity bible for persistence
            if (!state.identityBible) {
              state.identityBible = {};
            }
            state.identityBible.styleAnchor = styleAnchor;
            state.identityBible.consistencyAnchors = styleAnchor.anchors || [];
          }
        } catch (styleErr) {
          console.warn(`[Hollywood] Style anchor extraction failed:`, styleErr);
        }
      }
      
      const maxRetries = 3;
      let retryCount = 0;
      let debugResult = null;
      
      while (retryCount < maxRetries) {
        try {
          debugResult = await callEdgeFunction('visual-debugger', {
            videoUrl: result.videoUrl,
            frameUrl: frameForAnalysis || result.videoUrl,
            shotDescription: clip.prompt,
            shotId: `clip_${i}`,
            projectType: request.genre || 'cinematic',
            referenceImageUrl,
            referenceAnalysis: state.referenceAnalysis,
            styleAnchor: styleAnchor,
            // Pass accumulated anchors for consistency checking
            accumulatedAnchors: accumulatedAnchors.slice(-3),
          });
          
          if (debugResult.success && debugResult.result) {
            const verdict = debugResult.result;
            console.log(`[Hollywood] Visual Debug: ${verdict.verdict} (Score: ${verdict.score})`);
            
            if (verdict.passed || verdict.score >= 70) {
              console.log(`[Hollywood] Clip ${i + 1} passed quality check`);
              break;
            } else if (verdict.correctivePrompt && retryCount < maxRetries - 1) {
              console.log(`[Hollywood] Clip ${i + 1} failed quality (${verdict.issues?.map((x: any) => x.description).join('; ')})`);
              console.log(`[Hollywood] Retrying with corrective prompt (attempt ${retryCount + 2}/${maxRetries})...`);
              
              let correctedPrompt = verdict.correctivePrompt;
              if (styleAnchor?.consistencyPrompt && !hasReferenceImage) {
                correctedPrompt = `[STYLE ANCHOR: ${styleAnchor.consistencyPrompt}] ${correctedPrompt}`;
              }
              if (masterSceneAnchor?.masterConsistencyPrompt) {
                correctedPrompt = `[SCENE DNA: ${masterSceneAnchor.masterConsistencyPrompt}] ${correctedPrompt}`;
              }
              
              // FIXED: Clip 1 uses reference image, Clip 2+ uses previous frame
              const retryStartImage = i === 0 ? referenceImageUrl : previousLastFrameUrl;
              console.log(`[Hollywood] Retry using ${i === 0 ? 'reference image' : 'previous frame'}: ${retryStartImage?.substring(0, 50)}...`);
              
              const retryResult = await callEdgeFunction('generate-single-clip', {
                userId: request.userId,
                projectId: state.projectId,
                clipIndex: i,
                prompt: correctedPrompt,
                totalClips: clips.length,
                startImageUrl: retryStartImage,
                previousMotionVectors,
                identityBible: state.identityBible,
                colorGrading: request.colorGrading || 'cinematic',
                qualityTier: request.qualityTier || 'standard',
                referenceImageUrl,
                isRetry: true,
                sceneContext: clip.sceneContext,
              });
              
              if (retryResult.success && retryResult.clipResult) {
                result = retryResult.clipResult;
                retryCount++;
                
                // Re-extract frame for new clip using bulletproof function
                try {
                  const newFrameResult = await callEdgeFunction('extract-last-frame', {
                    videoUrl: result.videoUrl,
                    projectId: state.projectId,
                    shotIndex: i,
                    shotPrompt: correctedPrompt,
                    sceneImageUrl: sceneImageLookup[i] || sceneImageLookup[0],
                    position: 'last',
                  });
                  if (newFrameResult.success && newFrameResult.frameUrl) {
                    const isVideoUrl = newFrameResult.frameUrl.endsWith('.mp4') || newFrameResult.frameUrl.includes('/video-clips/');
                    if (!isVideoUrl) {
                      frameForAnalysis = newFrameResult.frameUrl;
                      result.lastFrameUrl = newFrameResult.frameUrl;
                      console.log(`[Hollywood] Retry frame extracted via ${newFrameResult.method}: ${frameForAnalysis.substring(0, 60)}...`);
                    }
                  }
                } catch (e) {
                  console.warn(`[Hollywood] Retry frame extraction failed, using scene fallback`);
                  if (sceneImageLookup[i]) {
                    result.lastFrameUrl = sceneImageLookup[i];
                    frameForAnalysis = sceneImageLookup[i];
                  }
                }
                
                console.log(`[Hollywood] Retry ${retryCount} generated, re-checking quality...`);
                continue;
              }
            }
          }
          break;
        } catch (debugError) {
          console.warn(`[Hollywood] Visual Debugger failed:`, debugError);
          break;
        }
      }
      
      // Store debug results
      if (debugResult?.result) {
        (result as any).visualDebugResult = {
          score: debugResult.result.score,
          passed: debugResult.result.passed,
          retriesUsed: retryCount,
        };
      }
      
      // =====================================================
      // SCENE ANCHOR EXTRACTION: Extract from FINAL clip (after any retries)
      // CRITICAL: For Clip 1, this establishes the MASTER SCENE DNA
      // that propagates lighting/color/environment to ALL subsequent clips
      // =====================================================
      const finalFrameUrl = result.lastFrameUrl || frameForAnalysis;
      if (finalFrameUrl) {
        // Clip 1: MANDATORY extraction - this sets the visual DNA for the entire project
        const isClipOne = i === 0;
        console.log(`[Hollywood] ${isClipOne ? '🎬 MASTER' : ''} Scene anchor extraction for clip ${i + 1}...`);
        
        try {
          const sceneAnchorResult = await callEdgeFunction('extract-scene-anchor', {
            frameUrl: finalFrameUrl,
            shotId: `clip_${i}_final`,
            projectId: state.projectId,
          });
          
          if (sceneAnchorResult.success && sceneAnchorResult.anchor) {
            const newAnchor = sceneAnchorResult.anchor;
            accumulatedAnchors.push(newAnchor);
            
            console.log(`[Hollywood] Scene anchor extracted for clip ${i + 1}:`);
            console.log(`  - Lighting: ${newAnchor.lighting?.timeOfDay || 'unknown'}, ${newAnchor.lighting?.keyLightIntensity || 'unknown'} ${newAnchor.lighting?.keyLightDirection || ''}`);
            console.log(`  - Color: ${newAnchor.colorPalette?.temperature || 'unknown'}, ${newAnchor.colorPalette?.saturation || ''}, ${newAnchor.colorPalette?.gradeStyle || 'unknown'}`);
            console.log(`  - Depth: ${newAnchor.depthCues?.dofStyle || 'unknown'} DOF, ${newAnchor.depthCues?.fogHaze || 'none'} haze`);
            console.log(`  - Environment: ${newAnchor.keyObjects?.environmentType || 'unknown'} - ${newAnchor.keyObjects?.settingDescription?.substring(0, 50) || ''}`);
            
            // Build/update master scene anchor
            if (isClipOne) {
              // CLIP 1: Establish the MASTER scene anchor - this is the source of truth
              masterSceneAnchor = {
                ...newAnchor,
                ismaster: true,
                establishedAt: Date.now(),
              };
              
              // Build comprehensive master consistency prompt for clip 2+
              const masterPromptParts = [
                '[SCENE DNA - MANDATORY VISUAL CONSISTENCY]',
                newAnchor.lighting?.promptFragment ? `Lighting: ${newAnchor.lighting.promptFragment}` : '',
                newAnchor.colorPalette?.promptFragment ? `Colors: ${newAnchor.colorPalette.promptFragment}` : '',
                newAnchor.depthCues?.promptFragment ? `Depth: ${newAnchor.depthCues.promptFragment}` : '',
                newAnchor.keyObjects?.promptFragment ? `Environment: ${newAnchor.keyObjects.promptFragment}` : '',
              ].filter(Boolean);
              
              masterSceneAnchor.masterConsistencyPrompt = masterPromptParts.join('. ');
              
              console.log(`[Hollywood] 🎬 MASTER SCENE DNA ESTABLISHED from Clip 1:`);
              console.log(`[Hollywood]   Master prompt: ${masterSceneAnchor.masterConsistencyPrompt.substring(0, 200)}...`);
              
              // Store in project state for persistence
              if (!state.identityBible) {
                state.identityBible = {};
              }
              state.identityBible.masterSceneAnchor = masterSceneAnchor;
              
            } else {
              // CLIP 2+: Merge new anchor data but preserve master DNA
              // Only update if significant drift detected (allows natural scene evolution)
              const mergedPrompt = [
                masterSceneAnchor?.lighting?.promptFragment || newAnchor.lighting?.promptFragment,
                masterSceneAnchor?.colorPalette?.promptFragment || newAnchor.colorPalette?.promptFragment,
                newAnchor.keyObjects?.promptFragment, // Allow environment to evolve
              ].filter(Boolean).join('. ');
              
              masterSceneAnchor = {
                ...masterSceneAnchor,
                masterConsistencyPrompt: mergedPrompt.substring(0, 600),
                // Update motion signature (can change between clips)
                motionSignature: newAnchor.motionSignature,
                // Keep original lighting/color from Clip 1 for consistency
              };
            }
            
            console.log(`[Hollywood] Scene anchors accumulated: ${accumulatedAnchors.length} total`);
            
            // Update project with scene anchor data (for debugging/monitoring)
            try {
              await supabase
                .from('movie_projects')
                .update({
                  pro_features_data: {
                    ...(state as any).proFeaturesData,
                    sceneAnchors: {
                      count: accumulatedAnchors.length,
                      masterPrompt: masterSceneAnchor?.masterConsistencyPrompt?.substring(0, 300),
                      lastUpdated: new Date().toISOString(),
                    },
                  },
                })
                .eq('id', state.projectId);
            } catch (updateErr) {
              console.warn(`[Hollywood] Failed to persist scene anchor data:`, updateErr);
            }
          }
        } catch (anchorErr) {
          console.warn(`[Hollywood] Scene anchor extraction failed for clip ${i + 1}:`, anchorErr);
          // For Clip 1, this is more critical - log prominently
          if (isClipOne) {
            console.error(`[Hollywood] ⚠️ CRITICAL: Master scene anchor extraction failed! Visual consistency may be degraded.`);
          }
        }
      }
    } // Close if (result.videoUrl) block
    
      // =====================================================
      // CHARACTER IDENTITY VERIFICATION: Detect and fix identity drift
      // =====================================================
      if (result.videoUrl && state.identityBible && result.lastFrameUrl) {
        console.log(`[Hollywood] Running Character Identity Verification on clip ${i + 1}...`);
        
        const maxIdentityRetries = 2;
        let identityRetryCount = 0;
        
        while (identityRetryCount < maxIdentityRetries) {
          try {
            const verifyResult = await callEdgeFunction('verify-character-identity', {
              projectId: state.projectId,
              clipIndex: i,
              videoUrl: result.videoUrl,
              frameUrl: result.lastFrameUrl,
              identityBible: state.identityBible,
              shotPrompt: clip.prompt,
              previousClipFrameUrl: i > 0 ? previousLastFrameUrl : undefined,
              strictness: request.qualityTier === 'professional' ? 'strict' : 'moderate',
            });
            
            if (verifyResult.success && verifyResult.verification) {
              const verification = verifyResult.verification;
              console.log(`[Hollywood] Identity Verification: ${verification.passed ? 'PASSED' : 'FAILED'} (score: ${verification.overallScore}/100)`);
              
              // Store verification result
              (result as any).identityVerification = {
                passed: verification.passed,
                score: verification.overallScore,
                driftDetected: verification.driftDetected,
                retriesUsed: identityRetryCount,
              };
              
              if (verification.passed || verification.overallScore >= 75) {
                console.log(`[Hollywood] Character identity verified for clip ${i + 1}`);
                break;
              } else if (verification.driftDetected && verification.correctivePrompt && identityRetryCount < maxIdentityRetries - 1) {
                console.log(`[Hollywood] Identity drift detected in clip ${i + 1}:`);
                console.log(`  - Drift areas: ${verification.driftAreas?.join(', ') || 'unknown'}`);
                console.log(`  - Regenerating with corrective prompt...`);
                
                // Build enhanced corrective prompt with identity anchors
                let correctedPrompt = verification.correctivePrompt;
                
                // Inject non-facial anchors for robustness
                if (state.identityBible?.nonFacialAnchors) {
                  const anchors = state.identityBible.nonFacialAnchors;
                  const anchorPrompt = [
                    anchors.bodyType,
                    anchors.clothingSignature,
                    anchors.hairFromBehind,
                    anchors.silhouetteDescription,
                  ].filter(Boolean).join('. ');
                  correctedPrompt = `[IDENTITY LOCK - Non-facial anchors: ${anchorPrompt}] ${correctedPrompt}`;
                }
                
                // Add occlusion-specific negative prompts
                const occlusionNegatives = [
                  'different person',
                  'changed appearance',
                  'morphing',
                  'identity shift',
                  'altered features',
                ].join(', ');
                correctedPrompt = `${correctedPrompt}. [AVOID: ${occlusionNegatives}]`;
                
                // Determine which reference to use based on pose
                let regenerationStartImage = i === 0 ? referenceImageUrl : previousLastFrameUrl;
                
                // If back-facing detected, use back-view reference if available
                if (verification.detectedPose === 'back' && state.identityBible?.multiViewUrls?.backViewUrl) {
                  regenerationStartImage = state.identityBible.multiViewUrls.backViewUrl;
                  console.log(`[Hollywood] Using back-view reference for regeneration`);
                } else if (verification.detectedPose === 'side' && state.identityBible?.multiViewUrls?.sideViewUrl) {
                  regenerationStartImage = state.identityBible.multiViewUrls.sideViewUrl;
                  console.log(`[Hollywood] Using side-view reference for regeneration`);
                }
                
                // Regenerate clip
                const regenResult = await callEdgeFunction('generate-single-clip', {
                  userId: request.userId,
                  projectId: state.projectId,
                  clipIndex: i,
                  prompt: correctedPrompt,
                  totalClips: clips.length,
                  startImageUrl: regenerationStartImage,
                  previousMotionVectors,
                  identityBible: state.identityBible,
                  colorGrading: request.colorGrading || 'cinematic',
                  qualityTier: request.qualityTier || 'standard',
                  referenceImageUrl,
                  isRetry: true,
                  isIdentityRetry: true,
                  sceneContext: clip.sceneContext,
                });
                
                if (regenResult.success && regenResult.clipResult) {
                  result = regenResult.clipResult;
                  identityRetryCount++;
                  
                  // Re-extract frame for new clip
                  try {
                    const newFrameResult = await callEdgeFunction('extract-last-frame', {
                      videoUrl: result.videoUrl,
                      projectId: state.projectId,
                      shotIndex: i,
                      shotPrompt: correctedPrompt,
                      sceneImageUrl: sceneImageLookup[i] || sceneImageLookup[0],
                      position: 'last',
                    });
                    if (newFrameResult.success && newFrameResult.frameUrl) {
                      const isVideoUrl = newFrameResult.frameUrl.endsWith('.mp4') || newFrameResult.frameUrl.includes('/video-clips/');
                      if (!isVideoUrl) {
                        result.lastFrameUrl = newFrameResult.frameUrl;
                        console.log(`[Hollywood] Identity retry frame extracted: ${result.lastFrameUrl.substring(0, 60)}...`);
                      }
                    }
                  } catch (e) {
                    console.warn(`[Hollywood] Identity retry frame extraction failed`);
                    if (sceneImageLookup[i]) {
                      result.lastFrameUrl = sceneImageLookup[i];
                    }
                  }
                  
                  console.log(`[Hollywood] Identity retry ${identityRetryCount} generated, re-verifying...`);
                  continue;
                } else {
                  console.warn(`[Hollywood] Identity retry regeneration failed`);
                  break;
                }
              } else {
                // Score too low but no corrective prompt or max retries reached
                console.warn(`[Hollywood] Identity verification failed for clip ${i + 1}, but continuing (score: ${verification.overallScore})`);
                break;
              }
            } else {
              console.warn(`[Hollywood] Identity verification returned no result for clip ${i + 1}`);
              break;
            }
          } catch (verifyErr) {
            console.warn(`[Hollywood] Identity verification failed for clip ${i + 1}:`, verifyErr);
            break;
          }
        }
        
        // Log final identity verification status
        if ((result as any).identityVerification) {
          const iv = (result as any).identityVerification;
          console.log(`[Hollywood] Final identity status for clip ${i + 1}: passed=${iv.passed}, score=${iv.score}, retries=${iv.retriesUsed}`);
        }
      }
      
      // FIXED: Analyze real motion vectors from the generated video
      if (result.videoUrl) {
      try {
        const motionResult = await callEdgeFunction('analyze-motion-vectors', {
          videoUrl: result.videoUrl,
          frameUrl: result.lastFrameUrl,
          shotId: `clip_${i}`,
          promptDescription: clip.prompt,
        });
        
        if (motionResult.success && motionResult.motionVectors) {
          // Override text-based motion vectors with vision-analyzed ones
          result.motionVectors = {
            endVelocity: motionResult.motionVectors.subjectVelocity,
            endDirection: motionResult.motionVectors.subjectDirection,
            cameraMomentum: motionResult.motionVectors.cameraMomentum,
            continuityPrompt: motionResult.motionVectors.continuityPrompt,
            actionContinuity: motionResult.motionVectors.actionContinuity, // FIX: Was missing!
          };
          console.log(`[Hollywood] Real motion vectors analyzed: velocity=${result.motionVectors.endVelocity}, direction=${result.motionVectors.endDirection}`);
          console.log(`[Hollywood] Continuity prompt: ${result.motionVectors.continuityPrompt?.substring(0, 80)}...`);
        }
      } catch (motionErr) {
        console.warn(`[Hollywood] Motion vector analysis failed, using text-based fallback:`, motionErr);
      }
    }
    
    state.production.clipResults.push({
      index: result.index,
      videoUrl: result.videoUrl,
      status: 'completed',
      lastFrameUrl: result.lastFrameUrl,
    });
    
    // =====================================================
    // BULLETPROOF FRAME CHAIN: Update frame for next clip's continuity
    // =====================================================
    if (result.lastFrameUrl) {
      previousLastFrameUrl = result.lastFrameUrl;
      console.log(`[Hollywood] ✓ Frame chain updated: Clip ${i + 2} will use clip ${i + 1}'s last frame`);
    } else {
      // FALLBACK: Use next clip's scene image to maintain continuity
      const nextSceneImage = sceneImageLookup[i + 1] || sceneImageLookup[i] || sceneImageLookup[0];
      if (nextSceneImage) {
        previousLastFrameUrl = nextSceneImage;
        console.warn(`[Hollywood] ⚠️ Frame extraction failed - using scene image ${i + 2} as fallback for continuity`);
      } else {
        console.error(`[Hollywood] ⚠️ CRITICAL: No frame or fallback for clip ${i + 2}! Frame chain broken.`);
        // Keep previous frame as last resort
        console.error(`[Hollywood] Keeping stale frame: ${previousLastFrameUrl?.substring(0, 50)}...`);
      }
    }
    
    previousMotionVectors = result.motionVectors;
    
    console.log(`[Hollywood] Clip ${i + 1} completed: ${result.videoUrl.substring(0, 50)}...`);
    console.log(`[Hollywood] Continuity chain: ${accumulatedAnchors.length} anchors, ${previousMotionVectors ? 'motion vectors ready' : 'no motion vectors'}`);
  }
  
  const completedClips = state.production.clipResults.filter(c => c.status === 'completed');
  console.log(`[Hollywood] Production complete: ${completedClips.length}/${clips.length} clips`);
  
  // =====================================================
  // CONTINUITY ENGINE: Analyze gaps and generate bridges
  // =====================================================
  let continuityPlan: any = null;
  let bridgeClipUrls: string[] = [];
  
  if (completedClips.length >= 2) {
    console.log(`[Hollywood] Running Continuity Engine for ${completedClips.length} clips...`);
    
    try {
      // Step 1: Analyze all transitions and build continuity plan
      const continuityResult = await callEdgeFunction('continuity-engine', {
        projectId: state.projectId,
        userId: request.userId,
        clips: completedClips.map((c, idx) => ({
          index: c.index,
          videoUrl: c.videoUrl,
          lastFrameUrl: c.lastFrameUrl,
          prompt: clips[c.index]?.prompt || '',
          motionVectors: undefined, // Will be retrieved from DB if needed
          sceneType: (state.script?.shots?.[c.index] as any)?.sceneType || 'action',
        })),
        environmentLock: {
          lighting: (state as any).colorGrading?.masterPrompt?.match(/lighting[^,]*/i)?.[0] || 'natural',
          colorPalette: (state as any).colorGrading?.masterPreset || 'cinematic',
          timeOfDay: 'day',
          weather: 'clear',
        },
        gapThreshold: 70,
        maxBridgeClips: 5,
        strictness: 'normal',
      });
      
      if (continuityResult.success && continuityResult.plan) {
        continuityPlan = continuityResult.plan;
        console.log(`[Hollywood] Continuity analysis complete:`);
        console.log(`  - Overall score: ${continuityPlan.overallContinuityScore}/100`);
        console.log(`  - Bridge clips needed: ${continuityPlan.bridgeClipsNeeded}`);
        console.log(`  - Scene groups: ${continuityPlan.sceneGroups?.length || 0}`);
        
        // Store continuity plan in state for post-production reporting
        (state as any).continuityPlan = continuityPlan;
        
        // Step 2: Generate bridge clips where needed
        if (continuityPlan.bridgeClipsNeeded > 0) {
          console.log(`[Hollywood] Generating ${continuityPlan.bridgeClipsNeeded} bridge clips...`);
          
          const bridgePromises = continuityPlan.transitions
            .filter((t: any) => t.bridgeClip)
            .slice(0, 5) // Max 5 bridges
            .map(async (transition: any) => {
              const fromClip = completedClips.find(c => c.index === transition.fromIndex);
              if (!fromClip?.lastFrameUrl) {
                console.warn(`[Hollywood] No last frame for bridge after clip ${transition.fromIndex}`);
                return null;
              }
              
              try {
                const bridgeResult = await callEdgeFunction('generate-bridge-clip', {
                  projectId: state.projectId,
                  userId: request.userId,
                  fromClipLastFrame: fromClip.lastFrameUrl,
                  bridgePrompt: transition.bridgeClip.prompt,
                  durationSeconds: transition.bridgeClip.durationSeconds || 3,
                  sceneContext: {
                    lighting: continuityPlan.environmentLock?.lighting,
                    colorPalette: continuityPlan.environmentLock?.colorPalette,
                    environment: state.script?.shots?.[transition.fromIndex]?.description?.substring(0, 100),
                    mood: state.script?.shots?.[transition.fromIndex]?.mood,
                  },
                });
                
                if (bridgeResult.success && bridgeResult.videoUrl) {
                  console.log(`[Hollywood] Bridge clip generated for ${transition.fromIndex} → ${transition.toIndex}`);
                  return {
                    insertAfterIndex: transition.bridgeClip.insertAfterIndex,
                    videoUrl: bridgeResult.videoUrl,
                  };
                }
              } catch (bridgeErr) {
                console.warn(`[Hollywood] Bridge clip generation failed:`, bridgeErr);
              }
              return null;
            });
          
          const bridgeResults = await Promise.all(bridgePromises);
          bridgeClipUrls = bridgeResults.filter(Boolean) as any[];
          console.log(`[Hollywood] Generated ${bridgeClipUrls.length} bridge clips successfully`);
        }
      }
    } catch (continuityErr) {
      console.warn(`[Hollywood] Continuity Engine failed, proceeding without bridges:`, continuityErr);
    }
  }
  
  // =====================================================
  // FINAL ASSEMBLY: Stitch with bridge clips integrated
  // =====================================================
  if (completedClips.length > 0) {
    console.log(`[Hollywood] Requesting intelligent stitching with scene anchor analysis...`);
    
    try {
      const hasAudioTracks = state.assets?.voiceUrl || state.assets?.musicUrl;
      
      // Build clip sequence with bridge clips inserted
      let clipSequence = completedClips.map((c, idx) => ({
        shotId: `clip_${c.index}`,
        videoUrl: c.videoUrl,
        firstFrameUrl: idx === 0 ? request.referenceImageUrl : undefined,
        lastFrameUrl: c.lastFrameUrl,
        isBridge: false,
      }));
      
      // Insert bridge clips at correct positions
      if (bridgeClipUrls.length > 0) {
        // Sort by insertAfterIndex descending to insert from end (avoid index shifting)
        const sortedBridges = [...bridgeClipUrls].sort((a: any, b: any) => b.insertAfterIndex - a.insertAfterIndex);
        
        for (const bridge of sortedBridges as any[]) {
          const insertIdx = clipSequence.findIndex(c => c.shotId === `clip_${bridge.insertAfterIndex}`);
          if (insertIdx >= 0) {
            clipSequence.splice(insertIdx + 1, 0, {
              shotId: `bridge_after_${bridge.insertAfterIndex}`,
              videoUrl: bridge.videoUrl,
              firstFrameUrl: undefined,
              lastFrameUrl: undefined,
              isBridge: true,
            });
          }
        }
        console.log(`[Hollywood] Clip sequence now has ${clipSequence.length} items (${bridgeClipUrls.length} bridges)`);
      }
      
      // Use intelligent-stitch for ALL tiers with bridge clips enabled for all
      console.log(`[Hollywood] Using Intelligent Stitcher for ${request.qualityTier || 'standard'} tier (bridge clips enabled for all)`);
      const intelligentStitchResult = await callEdgeFunction('intelligent-stitch', {
        projectId: state.projectId,
        userId: request.userId,
        clips: clipSequence,
        voiceAudioUrl: state.assets?.voiceUrl,
        musicAudioUrl: state.assets?.musicUrl,
        autoGenerateBridges: bridgeClipUrls.length === 0, // Only auto-generate if we didn't already
        strictnessLevel: 'normal',
        maxBridgeClips: Math.max(0, 5 - bridgeClipUrls.length), // Subtract already generated
        targetFormat: '1080p',
        qualityTier: request.qualityTier || 'standard',
        // Pass pro features for intelligent audio-visual sync
        musicSyncPlan: (state as any).musicSyncPlan,
        colorGradingFilter: (state as any).colorGrading?.masterFilter,
        sfxPlan: (state as any).sfxPlan,
        // Pass continuity plan for transition timing
        continuityPlan: continuityPlan,
      });
      
      if (intelligentStitchResult.success && intelligentStitchResult.finalVideoUrl) {
        state.finalVideoUrl = intelligentStitchResult.finalVideoUrl;
        console.log(`[Hollywood] Intelligent stitch complete: ${state.finalVideoUrl}`);
        console.log(`[Hollywood] Scene consistency: ${intelligentStitchResult.plan?.overallConsistency || 'N/A'}%`);
        console.log(`[Hollywood] Total bridge clips: ${bridgeClipUrls.length + (intelligentStitchResult.bridgeClipsGenerated || 0)}`);
      } else {
        console.warn(`[Hollywood] Intelligent stitch returned no video, falling back to direct stitch`);
      }
      
      // Fallback: Direct Cloud Run stitch if intelligent stitch failed
      if (!state.finalVideoUrl) {
        const stitcherUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
        if (stitcherUrl) {
          const response = await fetch(`${stitcherUrl}/stitch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: state.projectId,
              projectTitle: `Video - ${state.projectId}`,
              clips: clipSequence.map(c => ({
                shotId: c.shotId,
                videoUrl: c.videoUrl,
                durationSeconds: c.isBridge ? 3 : DEFAULT_CLIP_DURATION,
                transitionOut: 'continuous',
              })),
              audioMixMode: hasAudioTracks ? 'full' : 'mute',
              outputFormat: 'mp4',
              colorGrading: request.colorGrading || 'cinematic',
              isFinalAssembly: true,
              voiceTrackUrl: state.assets?.voiceUrl,
              backgroundMusicUrl: state.assets?.musicUrl,
              // Pass music sync plan for intelligent audio mixing
              musicSyncPlan: (state as any).musicSyncPlan,
              // Pass color grading filter for FFmpeg processing
              colorGradingFilter: (state as any).colorGrading?.masterFilter,
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.finalVideoUrl) {
              state.finalVideoUrl = result.finalVideoUrl;
              console.log(`[Hollywood] Final video assembled: ${state.finalVideoUrl}`);
            }
          }
        }
      }
    } catch (stitchError) {
      console.error(`[Hollywood] Stitching failed:`, stitchError);
    }
  }
  
  state.progress = 90;
  await updateProjectProgress(supabase, state.projectId, 'production', 90, {
    clipsCompleted: completedClips.length,
    clipCount: clips.length,
  });
  
  return state;
}

// Stage 5: POST-PRODUCTION
async function runPostProduction(
  request: PipelineRequest,
  state: PipelineState,
  supabase: any
): Promise<PipelineState> {
  console.log(`[Hollywood] Stage 5: POST-PRODUCTION (finalization)`);
  state.stage = 'postproduction';
  state.progress = 92;
  await updateProjectProgress(supabase, state.projectId, 'postproduction', 92);
  
  const completedClipsList = state.production?.clipResults?.filter(c => c.status === 'completed') || [];
  const completedClips = completedClipsList.length;
  const failedClips = state.production?.clipResults?.filter(c => c.status === 'failed').length || 0;
  
  // Post-production summary logging
  console.log(`[Hollywood] Production summary: ${completedClips} completed, ${failedClips} failed`);
  console.log(`[Hollywood] Assets: voice=${!!state.assets?.voiceUrl}, music=${!!state.assets?.musicUrl}`);
  
  // =====================================================
  // LIP SYNC SERVICE: Apply lip sync to dialogue clips
  // =====================================================
  if (state.assets?.voiceUrl && completedClipsList.length > 0) {
    console.log(`[Hollywood] Running Lip Sync Service for dialogue clips...`);
    
    // Initialize lip sync data storage
    if (!(state as any).lipSyncData) {
      (state as any).lipSyncData = {};
    }
    
    // Identify clips with dialogue that could benefit from lip sync
    const dialogueClips = state.script?.shots
      ?.map((shot, idx) => ({
        index: idx,
        shotId: shot.id,
        dialogue: shot.dialogue,
        hasDialogue: !!(shot.dialogue && shot.dialogue.trim().length > 20),
        clip: completedClipsList.find(c => c.index === idx),
      }))
      .filter(item => item.hasDialogue && item.clip?.videoUrl) || [];
    
    if (dialogueClips.length > 0) {
      console.log(`[Hollywood] Found ${dialogueClips.length} dialogue clips for lip sync processing`);
      
      // Process lip sync for each dialogue clip (in parallel with limit)
      const lipSyncPromises = dialogueClips.slice(0, 6).map(async (item) => {
        try {
          console.log(`[Hollywood] Processing lip sync for clip ${item.index + 1} (${item.dialogue?.substring(0, 30)}...)`);
          
          const lipSyncResult = await callEdgeFunction('lip-sync-service', {
            projectId: state.projectId,
            userId: request.userId,
            videoUrl: item.clip!.videoUrl,
            audioUrl: state.assets!.voiceUrl,
            shotId: item.shotId,
            quality: request.qualityTier === 'professional' ? 'high' : 'balanced',
            faceEnhance: request.qualityTier === 'professional',
          });
          
          if (lipSyncResult.success && lipSyncResult.outputVideoUrl) {
            console.log(`[Hollywood] Lip sync applied to clip ${item.index + 1} in ${lipSyncResult.processingTimeMs}ms`);
            
            // Store lip sync result
            (state as any).lipSyncData[item.shotId] = {
              originalUrl: item.clip!.videoUrl,
              lipSyncedUrl: lipSyncResult.outputVideoUrl,
              processingTimeMs: lipSyncResult.processingTimeMs,
              model: lipSyncResult.model,
            };
            
            // Update the clip result with lip-synced video
            const clipResult = state.production?.clipResults?.find(c => c.index === item.index);
            if (clipResult) {
              (clipResult as any).originalVideoUrl = clipResult.videoUrl;
              clipResult.videoUrl = lipSyncResult.outputVideoUrl;
              (clipResult as any).lipSynced = true;
            }
            
            return {
              index: item.index,
              success: true,
              outputUrl: lipSyncResult.outputVideoUrl,
            };
          } else if (lipSyncResult.error) {
            console.warn(`[Hollywood] Lip sync for clip ${item.index + 1} returned with note: ${lipSyncResult.error}`);
            return { index: item.index, success: false, error: lipSyncResult.error };
          }
        } catch (lipSyncErr) {
          console.warn(`[Hollywood] Lip sync failed for clip ${item.index + 1}:`, lipSyncErr);
          return { index: item.index, success: false, error: String(lipSyncErr) };
        }
        return { index: item.index, success: false };
      });
      
      const lipSyncResults = await Promise.all(lipSyncPromises);
      const successfulLipSyncs = lipSyncResults.filter(r => r.success).length;
      
      console.log(`[Hollywood] Lip sync complete: ${successfulLipSyncs}/${dialogueClips.length} clips processed`);
      
      // Update progress with lip sync status
      await updateProjectProgress(supabase, state.projectId, 'postproduction', 94, {
        lipSyncProcessed: successfulLipSyncs,
        lipSyncTotal: dialogueClips.length,
      });
    } else {
      console.log(`[Hollywood] No dialogue clips found for lip sync processing`);
    }
  } else {
    console.log(`[Hollywood] Skipping lip sync: voice=${!!state.assets?.voiceUrl}, clips=${completedClipsList.length}`);
  }
  
  state.progress = 95;
  
  // Professional tier: Log enhanced features used
  if (request.qualityTier === 'professional') {
    const proFeatures = {
      multiCharacterBible: !!(state as any).multiCharacterBible,
      depthConsistency: !!(state as any).depthConsistency,
      lipSync: !!(state as any).lipSyncData,
      musicSync: !!(state as any).musicSyncPlan,
      colorGrading: !!(state as any).colorGrading,
      sfx: !!(state as any).sfxPlan,
      visualDebugger: state.production?.clipResults?.some((c: any) => c.visualDebugResult),
    };
    
    const enabledFeatures = Object.entries(proFeatures)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);
    
    console.log(`[Hollywood] Pro features used: ${enabledFeatures.join(', ') || 'none'}`);
    
    // Log quality metrics
    if ((state as any).depthConsistency?.overallScore) {
      console.log(`[Hollywood] Depth consistency score: ${(state as any).depthConsistency.overallScore}/100`);
    }
    if ((state as any).colorGrading?.consistencyScore) {
      console.log(`[Hollywood] Color consistency score: ${(state as any).colorGrading.consistencyScore}%`);
    }
    if ((state as any).musicSyncPlan?.emotionalBeats?.length) {
      console.log(`[Hollywood] Music sync: ${(state as any).musicSyncPlan.emotionalBeats.length} emotional beats detected`);
    }
    
    // Calculate visual debugger stats
    const debuggedClips = state.production?.clipResults?.filter((c: any) => c.visualDebugResult) || [];
    const retriesUsed = debuggedClips.reduce((sum: number, c: any) => sum + (c.visualDebugResult?.retriesUsed || 0), 0);
    if (debuggedClips.length > 0) {
      const avgScore = debuggedClips.reduce((sum: number, c: any) => sum + (c.visualDebugResult?.score || 0), 0) / debuggedClips.length;
      console.log(`[Hollywood] Visual Debugger: ${debuggedClips.length} clips checked, avg score ${Math.round(avgScore)}, ${retriesUsed} retries used`);
    }
    
    // Calculate identity verification stats
    const identityVerifiedClips = state.production?.clipResults?.filter((c: any) => c.identityVerification) || [];
    const identityRetries = identityVerifiedClips.reduce((sum: number, c: any) => sum + (c.identityVerification?.retriesUsed || 0), 0);
    if (identityVerifiedClips.length > 0) {
      const avgIdentityScore = identityVerifiedClips.reduce((sum: number, c: any) => sum + (c.identityVerification?.score || 0), 0) / identityVerifiedClips.length;
      const passedCount = identityVerifiedClips.filter((c: any) => c.identityVerification?.passed).length;
      const driftDetectedCount = identityVerifiedClips.filter((c: any) => c.identityVerification?.driftDetected).length;
      console.log(`[Hollywood] Identity Verification: ${passedCount}/${identityVerifiedClips.length} passed, avg score ${Math.round(avgIdentityScore)}, ${driftDetectedCount} drift detections, ${identityRetries} retries used`);
    }
  }
  
  if (!state.finalVideoUrl) {
    console.warn(`[Hollywood] No final video URL from production stage`);
  } else {
    console.log(`[Hollywood] Final video ready: ${state.finalVideoUrl}`);
  }
  
  state.progress = 100;
  await updateProjectProgress(supabase, state.projectId, 'postproduction', 100, {
    finalVideoUrl: state.finalVideoUrl,
    clipsCompleted: completedClips,
    clipsFailed: failedClips,
    proFeaturesUsed: request.qualityTier === 'professional' ? {
      multiCharacterBible: !!(state as any).multiCharacterBible,
      depthConsistency: (state as any).depthConsistency?.overallScore,
      lipSync: Object.keys((state as any).lipSyncData || {}).length,
      musicSync: (state as any).musicSyncPlan?.emotionalBeats?.length || 0,
      colorGrading: (state as any).colorGrading?.masterPreset,
      sfxCues: (state as any).sfxPlan?.sfxCues?.length || 0,
      identityVerification: {
        clipsVerified: state.production?.clipResults?.filter((c: any) => c.identityVerification).length || 0,
        avgScore: Math.round(
          (state.production?.clipResults?.filter((c: any) => c.identityVerification) || [])
            .reduce((sum: number, c: any, _, arr) => sum + (c.identityVerification?.score || 0) / (arr.length || 1), 0)
        ),
        driftDetections: state.production?.clipResults?.filter((c: any) => c.identityVerification?.driftDetected).length || 0,
        retriesUsed: state.production?.clipResults?.reduce((sum: number, c: any) => sum + (c.identityVerification?.retriesUsed || 0), 0) || 0,
      },
    } : undefined,
  });
  
  return state;
}

// Background pipeline execution
async function executePipelineInBackground(
  request: PipelineRequest,
  projectId: string,
  state: PipelineState,
  supabase: any
) {
  try {
    const stages = request.stages || ['preproduction', 'qualitygate', 'assets', 'production', 'postproduction'];
    
    // Check if we're resuming from a specific stage
    const resumeFrom = (request as any).resumeFrom;
    const approvedScript = (request as any).approvedScript;
    const resumeFromClipIndex = (request as any).resumeFromClipIndex || 0;
    
    // Determine which stages to skip based on resumeFrom
    const stageOrder = ['preproduction', 'qualitygate', 'assets', 'production', 'postproduction'];
    const resumeStageIndex = resumeFrom ? stageOrder.indexOf(resumeFrom) : -1;
    
    console.log(`[Hollywood] Resume config: resumeFrom=${resumeFrom}, resumeStageIndex=${resumeStageIndex}, resumeFromClipIndex=${resumeFromClipIndex}`);
    
    // Load existing state from project if resuming
    if (resumeFrom) {
      const { data: project } = await supabase
        .from('movie_projects')
        .select('pending_video_tasks, generated_script')
        .eq('id', projectId)
        .single();
      
      if (project?.pending_video_tasks) {
        const tasks = project.pending_video_tasks;
        state.script = approvedScript || tasks.script;
        state.extractedCharacters = (request as any).extractedCharacters || tasks.extractedCharacters;
        state.identityBible = (request as any).identityBible || tasks.identityBible;
        state.referenceAnalysis = (request as any).referenceImageAnalysis || tasks.referenceAnalysis;
        state.clipCount = tasks.clipCount || state.clipCount;
        state.clipDuration = tasks.clipDuration || state.clipDuration;
        console.log(`[Hollywood] Loaded existing state: ${state.script?.shots?.length || 0} shots, clipCount=${state.clipCount}`);
      }
      
      // Also try to parse generated_script if script not in pending_video_tasks
      if (!state.script?.shots && project?.generated_script) {
        try {
          state.script = JSON.parse(project.generated_script);
          console.log(`[Hollywood] Loaded script from generated_script field: ${state.script?.shots?.length || 0} shots`);
        } catch (e) {
          console.warn(`[Hollywood] Failed to parse generated_script`);
        }
      }
      
      state.progress = resumeStageIndex >= 3 ? 75 : 30; // Start at 75% if resuming production
    }
    
    // Only run preproduction if not resuming past it
    if (stages.includes('preproduction') && resumeStageIndex < 0) {
      state = await runPreProduction(request, state, supabase);
      
      // PAUSE FOR SCRIPT APPROVAL (unless resuming or skipApproval flag is set)
      if (!(request as any).skipApproval && !resumeFrom) {
        console.log(`[Hollywood] Pausing for script approval...`);
        
        await supabase
          .from('movie_projects')
          .update({
            status: 'awaiting_approval',
            generated_script: state.script ? JSON.stringify(state.script) : null,
            pending_video_tasks: {
              stage: 'awaiting_approval',
              progress: 30,
              script: state.script,
              extractedCharacters: state.extractedCharacters,
              identityBible: state.identityBible,
              referenceAnalysis: state.referenceAnalysis,
              clipCount: state.clipCount,
              clipDuration: state.clipDuration,
              totalCredits: state.totalCredits,
              config: {
                includeVoice: request.includeVoice,
                includeMusic: request.includeMusic,
                genre: request.genre,
                mood: request.mood,
                colorGrading: request.colorGrading,
              },
              awaitingApprovalAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);
        
        console.log(`[Hollywood] Script ready for review. Awaiting user approval.`);
        return; // Stop here and wait for user to approve via resume-pipeline
      }
    }
    
    // Run qualitygate if not resuming past it
    if (stages.includes('qualitygate') && resumeStageIndex < 1) {
      state = await runQualityGate(request, state, supabase);
    }
    
    // Run assets if not resuming past it
    if (stages.includes('assets') && resumeStageIndex < 2) {
      state = await runAssetCreation(request, state, supabase);
    }
    
    // Run production (always if in stages, but pass resumeFromClipIndex to skip completed clips)
    if (stages.includes('production')) {
      // Pass the resume clip index to production
      (request as any)._resumeFromClipIndex = resumeFromClipIndex;
      state = await runProduction(request, state, supabase);
    }
    
    if (stages.includes('postproduction')) {
      state = await runPostProduction(request, state, supabase);
    }
    
    // Deduct credits on success
    if (state.finalVideoUrl && !request.skipCreditDeduction) {
      console.log(`[Hollywood] Deducting ${state.totalCredits} credits`);
      
      await supabase.rpc('deduct_credits', {
        p_user_id: request.userId,
        p_amount: state.totalCredits,
        p_description: `Hollywood Pipeline - Full production (${state.clipCount} clips + audio)`,
        p_project_id: projectId,
        p_clip_duration: state.clipCount * state.clipDuration,
      });
    }
    
    // Build pro_features_data for database storage (now tracks all tiers)
    const proFeaturesData = {
      tier: request.qualityTier || 'standard',
      musicSync: { 
        enabled: !!(state as any).musicSyncPlan, 
        count: (state as any).musicSyncPlan?.emotionalBeats?.length || 0 
      },
      colorGrading: { 
        enabled: !!(state as any).colorGrading, 
        details: (state as any).colorGrading?.masterPreset,
        score: (state as any).colorGrading?.consistencyScore 
      },
      sfx: { 
        enabled: !!(state as any).sfxPlan, 
        count: (state as any).sfxPlan?.sfxCues?.length || 0 
      },
      visualDebugger: { 
        enabled: state.production?.clipResults?.some((c: any) => c.visualDebugResult),
        retriesUsed: state.production?.clipResults?.reduce((sum: number, c: any) => sum + (c.visualDebugResult?.retriesUsed || 0), 0) || 0,
        avgScore: state.production?.clipResults?.filter((c: any) => c.visualDebugResult)
          .reduce((sum: number, c: any, _, arr) => sum + (c.visualDebugResult?.score || 0) / arr.length, 0) || 0
      },
      multiCharacterBible: { 
        enabled: !!(state as any).multiCharacterBible,
        count: (state as any).multiCharacterBible?.characters?.length || 0
      },
      depthConsistency: { 
        enabled: !!(state as any).depthConsistency, 
        score: (state as any).depthConsistency?.overallScore 
      },
      lipSync: {
        enabled: !!(state as any).lipSyncData,
        count: Object.keys((state as any).lipSyncData || {}).length
      },
      voice: {
        enabled: !!state.assets?.voiceUrl,
        url: state.assets?.voiceUrl
      },
      music: {
        enabled: !!state.assets?.musicUrl,
        url: state.assets?.musicUrl
      },
      intelligentStitch: {
        enabled: !!state.finalVideoUrl,
        url: state.finalVideoUrl
      },
      identityVerification: {
        enabled: state.production?.clipResults?.some((c: any) => c.identityVerification),
        clipsVerified: state.production?.clipResults?.filter((c: any) => c.identityVerification).length || 0,
        passed: state.production?.clipResults?.filter((c: any) => c.identityVerification?.passed).length || 0,
        avgScore: Math.round(
          (state.production?.clipResults?.filter((c: any) => c.identityVerification) || [])
            .reduce((sum: number, c: any, _, arr) => sum + (c.identityVerification?.score || 0) / (arr.length || 1), 0)
        ),
        driftDetections: state.production?.clipResults?.filter((c: any) => c.identityVerification?.driftDetected).length || 0,
        retriesUsed: state.production?.clipResults?.reduce((sum: number, c: any) => sum + (c.identityVerification?.retriesUsed || 0), 0) || 0,
      },
    };
    
    // Update project as completed
    await supabase
      .from('movie_projects')
      .update({
        video_url: state.finalVideoUrl,
        music_url: state.assets?.musicUrl,
        quality_tier: request.qualityTier || 'standard',
        pro_features_data: proFeaturesData,
        status: state.finalVideoUrl ? 'completed' : 'failed',
        generated_script: state.script ? JSON.stringify(state.script) : null,
        scene_images: state.assets?.sceneImages || null,
        pending_video_tasks: {
          stage: 'complete',
          progress: 100,
          finalVideoUrl: state.finalVideoUrl,
          stages: {
            preproduction: {
              shotCount: state.script?.shots?.length || 0,
              charactersExtracted: state.extractedCharacters?.length || 0,
            },
            qualitygate: {
              auditScore: state.auditResult?.overallScore || 0,
            },
            assets: {
              hasVoice: !!state.assets?.voiceUrl,
              hasMusic: !!state.assets?.musicUrl,
              voiceUrl: state.assets?.voiceUrl,
              musicUrl: state.assets?.musicUrl,
            },
            production: {
              clipsCompleted: state.production?.clipResults?.filter(c => c.status === 'completed').length || 0,
              clipsFailed: state.production?.clipResults?.filter(c => c.status === 'failed').length || 0,
            },
          },
          proFeaturesUsed: proFeaturesData,
          creditsCharged: state.finalVideoUrl && !request.skipCreditDeduction ? state.totalCredits : 0,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
    
    console.log(`[Hollywood] Pipeline completed successfully!`);
    
  } catch (error) {
    console.error("[Hollywood] Background pipeline error:", error);
    
    // Update project as failed
    await supabase
      .from('movie_projects')
      .update({
        status: 'failed',
        pending_video_tasks: {
          stage: 'error',
          progress: state.progress,
          error: error instanceof Error ? error.message : 'Pipeline failed',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
  }
}

// Handle shutdown gracefully
addEventListener('beforeunload', (ev: any) => {
  console.log('[Hollywood] Function shutdown:', ev.detail?.reason || 'unknown');
});

// Main handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const request: PipelineRequest = await req.json();
    
    if (!request.userId) {
      throw new Error("userId is required");
    }
    
    // For resume requests, we need approvedScript instead of concept/manualPrompts
    const isResuming = !!request.resumeFrom && !!request.approvedScript;
    
    if (!isResuming && !request.concept && !request.manualPrompts) {
      throw new Error("Either 'concept' or 'manualPrompts' is required");
    }
    
    // FAIL-SAFE #1: Fetch user tier limits from database
    console.log(`[Hollywood] Fetching tier limits for user ${request.userId}...`);
    const tierLimits = await getUserTierLimits(supabase, request.userId);
    console.log(`[Hollywood] User tier: ${tierLimits.tier}, maxClips: ${tierLimits.maxClips}, maxDuration: ${tierLimits.maxDuration}s, maxRetries: ${tierLimits.maxRetries}, chunkedStitching: ${tierLimits.chunkedStitching}`);
    
    // Store tier info in request for downstream stages
    (request as any)._tierLimits = tierLimits;
    
    const { clipCount, clipDuration, totalCredits } = calculatePipelineParams(request, {
      maxClips: tierLimits.maxClips,
      maxDuration: tierLimits.maxDuration,
    });
    
    console.log(`[Hollywood] Pipeline params: ${clipCount} clips × ${clipDuration}s = ${clipCount * clipDuration}s, ${totalCredits} credits`);
    console.log(`[Hollywood] Is resuming: ${isResuming}, resumeFrom: ${request.resumeFrom}`);
    
    // FAIL-SAFE #2: Validate request against tier limits
    const requestedDuration = clipCount * clipDuration;
    if (requestedDuration > tierLimits.maxDuration) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Requested duration (${requestedDuration}s) exceeds your tier limit (${tierLimits.maxDuration}s). Upgrade to Growth or Agency tier for 2-minute videos.`,
          tierLimit: tierLimits.tier,
          maxDuration: tierLimits.maxDuration,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!isResuming && request.manualPrompts && request.manualPrompts.length < 2) {
      throw new Error(`At least 2 prompts are required`);
    }

    // Check credits upfront
    console.log(`[Hollywood] Checking credits for user ${request.userId}`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_balance')
      .eq('id', request.userId)
      .single();

    if (profileError || !profile) {
      throw new Error("Failed to fetch user profile");
    }

    if (profile.credits_balance < totalCredits) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Insufficient credits. Required: ${totalCredits}, Available: ${profile.credits_balance}`,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or use project
    let projectId = request.projectId;
    
    if (!projectId) {
      const projectTitle = request.projectName?.trim() || `Project ${new Date().toLocaleString()}`;
      const { data: project, error: projectError } = await supabase
        .from('movie_projects')
        .insert({
          title: projectTitle,
          user_id: request.userId,
          status: 'generating',
          genre: request.genre || 'cinematic',
          mood: request.mood,
          story_structure: 'episodic',
          target_duration_minutes: Math.ceil((clipCount * clipDuration) / 60),
          pending_video_tasks: {
            stage: 'initializing',
            progress: 0,
            startedAt: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (projectError) throw projectError;
      projectId = project.id;
    } else {
      // Update existing project status
      await supabase
        .from('movie_projects')
        .update({
          status: 'generating',
          pending_video_tasks: {
            stage: 'initializing',
            progress: 0,
            startedAt: new Date().toISOString(),
          },
        })
        .eq('id', projectId);
    }

    console.log(`[Hollywood] Starting background pipeline for project ${projectId}`);

    // Initialize state
    const state: PipelineState = {
      projectId: projectId!,
      stage: 'initializing',
      progress: 0,
      clipCount,
      clipDuration,
      totalCredits,
    };

    // Start pipeline in background using waitUntil
    // @ts-ignore - EdgeRuntime is available in Deno edge functions
    EdgeRuntime.waitUntil(executePipelineInBackground(request, projectId!, state, supabase));

    // Return immediately with project ID
    return new Response(
      JSON.stringify({
        success: true,
        projectId: projectId,
        status: 'processing',
        message: 'Pipeline started in background. Use realtime subscription to track progress.',
        estimatedCredits: totalCredits,
        clipCount,
        clipDuration,
        totalDuration: clipCount * clipDuration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Hollywood] Pipeline error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Pipeline failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
