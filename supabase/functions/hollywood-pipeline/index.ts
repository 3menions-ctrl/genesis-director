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
    };
    consistencyAnchors?: string[];
    styleAnchor?: any; // Added for auto-extracted style anchor when no reference image
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

// Extended clip limits for longer productions
const MAX_CLIPS_PER_PROJECT = 24;
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

function calculatePipelineParams(request: PipelineRequest): { clipCount: number; clipDuration: number; totalCredits: number } {
  // Avatar-quality: Configurable clip duration (4-8 seconds)
  let clipDuration = DEFAULT_CLIP_DURATION;
  if ((request as any).clipDuration) {
    clipDuration = Math.max(MIN_CLIP_DURATION, Math.min(MAX_CLIP_DURATION, (request as any).clipDuration));
  }
  
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
  
  // Extended clip limit: 2-24 clips for Avatar-quality productions
  clipCount = Math.max(MIN_CLIPS_PER_PROJECT, Math.min(MAX_CLIPS_PER_PROJECT, clipCount));
  
  // Use tier-aware credit calculation
  const tier = request.qualityTier || 'standard';
  const creditsPerClip = TIER_CREDIT_COSTS[tier].TOTAL_PER_SHOT;
  const totalCredits = clipCount * creditsPerClip;
  
  console.log(`[Hollywood] Pipeline params: ${clipCount} clips × ${clipDuration}s = ${clipCount * clipDuration}s total`);
  
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
  
  // 1a. Generate script - use approved story if available (story-first flow)
  if (request.approvedStory) {
    console.log(`[Hollywood] Breaking down approved story into shots...`);
    
    try {
      const scriptResult = await callEdgeFunction('smart-script-generator', {
        topic: request.storyTitle || 'Video',
        approvedScene: request.approvedStory, // Changed: approvedStory -> approvedScene for scene-based flow
        genre: request.genre || 'cinematic',
        pacingStyle: 'moderate',
        targetDurationSeconds: state.clipCount * state.clipDuration,
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
        state.identityBible.multiViewUrls = {
          frontViewUrl: identityResult.frontViewUrl,
          sideViewUrl: identityResult.sideViewUrl,
          threeQuarterViewUrl: identityResult.threeQuarterViewUrl,
        };
        state.identityBible.consistencyAnchors = identityResult.consistencyAnchors || [];
        
        if (identityResult.characterDescription) {
          state.identityBible.consistencyPrompt = identityResult.characterDescription;
        }
        
        console.log(`[Hollywood] Identity Bible generated with 3-point views`);
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
  
  // Determine first frame reference
  let referenceImageUrl = state.identityBible?.multiViewUrls?.frontViewUrl 
    || request.referenceImageUrl
    || request.referenceImageAnalysis?.imageUrl;
  if (!referenceImageUrl && state.assets?.sceneImages?.[0]?.imageUrl) {
    referenceImageUrl = state.assets.sceneImages[0].imageUrl;
  }
  
  console.log(`[Hollywood] First frame reference: ${referenceImageUrl ? 'available' : 'none'}`);
  console.log(`[Hollywood] Generating ${clips.length} clips sequentially...`);
  
  // Check for checkpoint - resume from last completed clip
  const { data: checkpoint } = await supabase
    .rpc('get_generation_checkpoint', { p_project_id: state.projectId });
  
  let startIndex = 0;
  let previousLastFrameUrl = referenceImageUrl;
  let previousMotionVectors: { endVelocity?: string; endDirection?: string; cameraMomentum?: string } | undefined;
  
  if (checkpoint && checkpoint.length > 0 && checkpoint[0].last_completed_index >= 0) {
    startIndex = checkpoint[0].last_completed_index + 1;
    previousLastFrameUrl = checkpoint[0].last_frame_url || referenceImageUrl;
    console.log(`[Hollywood] Resuming from clip ${startIndex + 1}, using frame: ${previousLastFrameUrl?.substring(0, 50)}...`);
    
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
  
  // Generate clips one at a time
  for (let i = startIndex; i < clips.length; i++) {
    const clip = clips[i];
    const progressPercent = 75 + Math.floor((i / clips.length) * 15);
    
    console.log(`[Hollywood] Generating clip ${i + 1}/${clips.length}...`);
    
    await updateProjectProgress(supabase, state.projectId, 'production', progressPercent, {
      clipsCompleted: i,
      clipCount: clips.length,
    });
    
    // Build prompt with style anchor injection (when available)
    let finalPrompt = clip.prompt;
    if (styleAnchor?.consistencyPrompt && !hasReferenceImage) {
      finalPrompt = `[STYLE ANCHOR: ${styleAnchor.consistencyPrompt}] ${finalPrompt}`;
      console.log(`[Hollywood] Injected style anchor into clip ${i + 1} prompt`);
    }
    
    // Auto-retry logic: try once, then retry once on failure
    let lastError: Error | null = null;
    let result: any = null;
    
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const isRetry = attempt > 0;
        if (isRetry) {
          console.log(`[Hollywood] Auto-retry attempt for clip ${i + 1}...`);
          await updateProjectProgress(supabase, state.projectId, 'production', progressPercent, {
            clipsCompleted: i,
            clipCount: clips.length,
            retryingClip: i,
          });
        }
        
        // FIX: Clip 1 should NOT use reference image as startImageUrl (causes flash)
        // Clips 2+ use previous clip's last frame for continuity
        const useStartImage = i === 0 ? undefined : previousLastFrameUrl;
        
        console.log(`[Hollywood] Clip ${i + 1}: ${i === 0 ? 'TEXT-TO-VIDEO (no start image)' : 'FRAME-CHAINED from previous clip'}`);
        
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
          referenceImageUrl, // Still passed for character description extraction
          isRetry,
          // NEW: Pass scene context for continuous flow
          sceneContext: clip.sceneContext,
        });
        
        if (!clipResult.success) {
          throw new Error(clipResult.error || 'Clip generation failed');
        }
        
        result = clipResult.clipResult;
        lastError = null;
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`[Hollywood] Clip ${i + 1} attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt === 0) {
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // If all attempts failed, mark as failed and notify
    if (lastError || !result) {
      console.error(`[Hollywood] Clip ${i + 1} failed after auto-retry:`, lastError?.message);
      
      // Mark clip as failed in DB with retry_count
      await supabase.rpc('upsert_video_clip', {
        p_project_id: state.projectId,
        p_user_id: request.userId,
        p_shot_index: i,
        p_prompt: finalPrompt,
        p_status: 'failed',
        p_error_message: `Auto-retry exhausted: ${lastError?.message || 'Unknown error'}`,
      });
      
      // Update retry count
      await supabase
        .from('video_clips')
        .update({ retry_count: 1 })
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
      });
      
      // Continue with remaining clips
      continue;
    }
    
    // Visual Debugger Loop (all tiers) - check quality and retry if needed
    if (result.videoUrl) {
      console.log(`[Hollywood] Extracting frame and running Visual Debugger on clip ${i + 1}...`);
      
      // FIXED: Extract actual frame before Visual Debugger analysis
      let frameForAnalysis = result.lastFrameUrl;
      try {
        const frameResult = await callEdgeFunction('extract-video-frame', {
          videoUrl: result.videoUrl,
          projectId: state.projectId,
          shotId: `clip_${i}`,
          position: 'last',
        });
        if (frameResult.success && frameResult.frameUrl) {
          frameForAnalysis = frameResult.frameUrl;
          console.log(`[Hollywood] Frame extracted for Visual Debugger`);
        }
      } catch (frameErr) {
        console.warn(`[Hollywood] Frame extraction failed, using fallback:`, frameErr);
      }
      
      // STYLE ANCHOR EXTRACTION: After first clip, extract visual DNA if no reference image
      if (i === 0 && !hasReferenceImage && frameForAnalysis) {
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
            console.log(`[Hollywood] Consistency prompt: ${styleAnchor.consistencyPrompt?.substring(0, 60)}...`);
            
            // Store in identity bible for persistence
            if (!state.identityBible) {
              state.identityBible = {};
            }
            state.identityBible.styleAnchor = styleAnchor;
            state.identityBible.consistencyAnchors = styleAnchor.anchors || [];
            
            // Update project with style anchor
            await updateProjectProgress(supabase, state.projectId, 'production', progressPercent, {
              clipsCompleted: 1,
              clipCount: clips.length,
              styleAnchorExtracted: true,
              styleAnchorAnchors: styleAnchor.anchors?.length || 0,
            });
          }
        } catch (styleErr) {
          console.warn(`[Hollywood] Style anchor extraction failed:`, styleErr);
        }
      }
      
      const maxRetries = 3; // Increased from 2 to 3 retries
      let retryCount = 0;
      let debugResult = null;
      
      while (retryCount < maxRetries) {
        try {
          debugResult = await callEdgeFunction('visual-debugger', {
            videoUrl: result.videoUrl,
            frameUrl: frameForAnalysis || result.videoUrl, // Use video URL if no frame (Gemini can analyze video)
            shotDescription: clip.prompt,
            shotId: `clip_${i}`,
            projectType: request.genre || 'cinematic',
            referenceImageUrl,
            referenceAnalysis: state.referenceAnalysis,
            // Pass style anchor for consistency checking
            styleAnchor: styleAnchor,
          });
          
          if (debugResult.success && debugResult.result) {
            const verdict = debugResult.result;
            console.log(`[Hollywood] Visual Debug: ${verdict.verdict} (Score: ${verdict.score})`);
            
            if (verdict.passed || verdict.score >= 70) {
              // Quality check passed
              console.log(`[Hollywood] Clip ${i + 1} passed quality check`);
              break;
            } else if (verdict.correctivePrompt && retryCount < maxRetries - 1) {
              // Quality check failed, retry with corrective prompt
              console.log(`[Hollywood] Clip ${i + 1} failed quality (${verdict.issues?.map((x: any) => x.description).join('; ')})`);
              console.log(`[Hollywood] Retrying with corrective prompt (attempt ${retryCount + 2}/${maxRetries})...`);
              
              // Add style anchor to corrective prompt if available
              let correctedPrompt = verdict.correctivePrompt;
              if (styleAnchor?.consistencyPrompt && !hasReferenceImage) {
                correctedPrompt = `[STYLE ANCHOR: ${styleAnchor.consistencyPrompt}] ${correctedPrompt}`;
              }
              
              // FIX: Same logic for retries - clip 1 never uses startImage
              const retryStartImage = i === 0 ? undefined : previousLastFrameUrl;
              
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
              });
              
              if (retryResult.success && retryResult.clipResult) {
                result = retryResult.clipResult;
                retryCount++;
                
                // Re-extract frame for new clip
                try {
                  const newFrameResult = await callEdgeFunction('extract-video-frame', {
                    videoUrl: result.videoUrl,
                    projectId: state.projectId,
                    shotId: `clip_${i}_retry_${retryCount}`,
                    position: 'last',
                  });
                  if (newFrameResult.success && newFrameResult.frameUrl) {
                    frameForAnalysis = newFrameResult.frameUrl;
                  }
                } catch (e) {
                  console.warn(`[Hollywood] Retry frame extraction failed`);
                }
                
                console.log(`[Hollywood] Retry ${retryCount} generated, re-checking quality...`);
                continue; // Re-run visual debugger on new clip
              }
            }
          }
          break; // Exit loop if no retry needed
        } catch (debugError) {
          console.warn(`[Hollywood] Visual Debugger failed:`, debugError);
          break; // Continue without visual debugging
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
          };
          console.log(`[Hollywood] Real motion vectors analyzed: ${result.motionVectors.endVelocity} ${result.motionVectors.endDirection}`);
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
    
    // Update for next clip's continuity
    previousLastFrameUrl = result.lastFrameUrl || previousLastFrameUrl;
    previousMotionVectors = result.motionVectors;
    
    console.log(`[Hollywood] Clip ${i + 1} completed: ${result.videoUrl.substring(0, 50)}...`);
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
    
    const { clipCount, clipDuration, totalCredits } = calculatePipelineParams(request);
    
    console.log(`[Hollywood] Pipeline params: ${clipCount} clips × ${clipDuration}s = ${clipCount * clipDuration}s, ${totalCredits} credits`);
    console.log(`[Hollywood] Is resuming: ${isResuming}, resumeFrom: ${request.resumeFrom}`);
    
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
