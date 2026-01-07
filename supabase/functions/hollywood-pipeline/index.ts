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
    }>;
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

const DEFAULT_CLIP_DURATION = 4;
const CREDITS_PER_CLIP = 50;

function calculatePipelineParams(request: PipelineRequest): { clipCount: number; clipDuration: number; totalCredits: number } {
  const clipDuration = DEFAULT_CLIP_DURATION;
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
  
  clipCount = Math.max(2, Math.min(12, clipCount));
  const totalCredits = clipCount * CREDITS_PER_CLIP;
  
  return { clipCount, clipDuration, totalCredits };
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
  
  // 1a. Generate script from concept
  if (request.concept && !request.manualPrompts) {
    console.log(`[Hollywood] Generating script from concept...`);
    
    try {
      const scriptResult = await callEdgeFunction('smart-script-generator', {
        topic: request.concept,
        synopsis: request.concept,
        genre: request.genre || 'cinematic',
        pacingStyle: 'moderate',
        targetDurationSeconds: state.clipCount * state.clipDuration,
        clipCount: state.clipCount,
      });
      
      if (scriptResult.shots) {
        const shots = scriptResult.shots.slice(0, state.clipCount);
        while (shots.length < state.clipCount) {
          shots.push({
            id: `shot_${shots.length + 1}`,
            title: `Scene ${shots.length + 1}`,
            description: `${request.concept}. Scene ${shots.length + 1} of ${state.clipCount}.`,
            durationSeconds: state.clipDuration,
            mood: request.mood || 'cinematic',
          });
        }
        state.script = { shots };
        console.log(`[Hollywood] Script generated: ${state.script.shots.length} shots`);
      }
    } catch (err) {
      console.warn(`[Hollywood] Script generation failed, using fallback:`, err);
      state.script = {
        shots: Array.from({ length: state.clipCount }, (_, i) => ({
          id: `shot_${i + 1}`,
          title: `Scene ${i + 1}`,
          description: `${request.concept}. Scene ${i + 1} of ${state.clipCount}.`,
          durationSeconds: state.clipDuration,
          mood: request.mood || 'cinematic',
        })),
      };
    }
  } else if (request.manualPrompts) {
    state.script = {
      shots: request.manualPrompts.slice(0, state.clipCount).map((prompt, i) => ({
        id: `shot_${i + 1}`,
        title: `Scene ${i + 1}`,
        description: prompt,
        durationSeconds: state.clipDuration,
        mood: request.mood,
      })),
    };
  }
  
  state.progress = 20;
  await updateProjectProgress(supabase, state.projectId, 'preproduction', 20, { scriptGenerated: true });
  
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
  
  // 1e. Generate Multi-Character Identity Bible for professional tier (2+ characters)
  if (request.qualityTier === 'professional' && (state.extractedCharacters?.length || 0) >= 2) {
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
        
        // Merge character consistency prompts
        const multiCharPrompts = multiCharResult.bible.characters
          ?.map((c: any) => c.consistencyPrompt)
          .filter(Boolean)
          .join('. ');
        
        if (multiCharPrompts && state.identityBible) {
          state.identityBible.consistencyPrompt = `${state.identityBible.consistencyPrompt || ''}. CHARACTERS: ${multiCharPrompts}`;
        }
      }
    } catch (err) {
      console.warn(`[Hollywood] Multi-Character Bible generation failed:`, err);
    }
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
  
  // 2b. Run Depth Consistency Analysis for professional tier
  if (request.qualityTier === 'professional' && state.auditResult?.optimizedShots) {
    console.log(`[Hollywood] Running Depth Consistency Analysis...`);
    
    try {
      // Use scene images or reference image for depth analysis
      const shotsForAnalysis = state.auditResult.optimizedShots.slice(0, 6).map((shot, i) => ({
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
  
  // 2c. Run Lip Sync Analysis for professional tier with dialogue
  if (request.qualityTier === 'professional' && state.auditResult?.optimizedShots) {
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
  
  // 3a. Generate scene reference images
  if (state.script?.shots && !request.referenceImageUrl && !request.referenceImageAnalysis) {
    console.log(`[Hollywood] Generating scene reference images...`);
    
    try {
      const scenes = state.script.shots.slice(0, 3).map((shot, i) => ({
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
        console.log(`[Hollywood] Generated ${imageResult.images.length} scene images`);
      }
    } catch (err) {
      console.warn(`[Hollywood] Scene image generation failed:`, err);
    }
  }
  
  state.progress = 55;
  await updateProjectProgress(supabase, state.projectId, 'assets', 55);
  
  // 3b. Generate voice narration (if requested)
  if (request.includeVoice !== false) {
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
        }
      }
    } catch (err) {
      console.warn(`[Hollywood] Voice generation failed:`, err);
    }
  }
  
  state.progress = 60;
  await updateProjectProgress(supabase, state.projectId, 'assets', 60, { hasVoice: !!state.assets.voiceUrl });
  
  // 3c. Generate background music with scene synchronization (if requested)
  if (request.includeMusic !== false) {
    console.log(`[Hollywood] Generating synchronized background music...`);
    
    try {
      // For professional tier, use music sync engine
      if (request.qualityTier === 'professional' && state.script?.shots) {
        console.log(`[Hollywood] Using Music Sync Engine for professional tier...`);
        
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
          // Store the music sync plan for post-production
          (state as any).musicSyncPlan = syncResult.plan;
          console.log(`[Hollywood] Music sync plan created with ${syncResult.plan.musicCues?.length || 0} cues`);
          console.log(`[Hollywood] Detected ${syncResult.plan.emotionalBeats?.length || 0} emotional beats`);
          console.log(`[Hollywood] Created ${syncResult.plan.timingMarkers?.length || 0} timing markers`);
          
          // Use the optimized music prompt from sync engine
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
          }
        }
      } else {
        // Standard tier: basic music generation
        const musicResult = await callEdgeFunction('generate-music', {
          mood: request.musicMood || request.mood || 'cinematic',
          genre: 'hybrid',
          duration: state.clipCount * state.clipDuration + 2,
          projectId: state.projectId,
        });
        
        if (musicResult.musicUrl) {
          state.assets.musicUrl = musicResult.musicUrl;
          state.assets.musicDuration = musicResult.durationSeconds;
          console.log(`[Hollywood] Music generated: ${state.assets.musicUrl}`);
        }
      }
    } catch (err) {
      console.warn(`[Hollywood] Music generation failed:`, err);
    }
  }
  
  state.progress = 70;
  await updateProjectProgress(supabase, state.projectId, 'assets', 70, {
    hasVoice: !!state.assets.voiceUrl,
    hasMusic: !!state.assets.musicUrl,
    hasMusicSyncPlan: !!(state as any).musicSyncPlan,
    musicCues: (state as any).musicSyncPlan?.musicCues?.length || 0,
    emotionalBeats: (state as any).musicSyncPlan?.emotionalBeats?.length || 0,
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
  
  // Build clip prompts from optimized shots
  const clips = state.auditResult?.optimizedShots.slice(0, state.clipCount).map((opt, i) => {
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
    
    return {
      index: i,
      prompt: finalPrompt,
    };
  }) || [];
  
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
  
  // Generate clips one at a time
  for (let i = startIndex; i < clips.length; i++) {
    const clip = clips[i];
    const progressPercent = 75 + Math.floor((i / clips.length) * 15);
    
    console.log(`[Hollywood] Generating clip ${i + 1}/${clips.length}...`);
    
    await updateProjectProgress(supabase, state.projectId, 'production', progressPercent, {
      clipsCompleted: i,
      clipCount: clips.length,
    });
    
    try {
      const clipResult = await callEdgeFunction('generate-single-clip', {
        userId: request.userId,
        projectId: state.projectId,
        clipIndex: i,
        prompt: clip.prompt,
        totalClips: clips.length,
        startImageUrl: previousLastFrameUrl,
        previousMotionVectors,
        identityBible: state.identityBible,
        colorGrading: request.colorGrading || 'cinematic',
        qualityTier: request.qualityTier || 'standard',
        referenceImageUrl,
      });
      
      if (!clipResult.success) {
        throw new Error(clipResult.error || 'Clip generation failed');
      }
      
      const result = clipResult.clipResult;
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
      
    } catch (error) {
      console.error(`[Hollywood] Clip ${i + 1} failed:`, error);
      
      // Mark clip as failed in DB
      await supabase.rpc('upsert_video_clip', {
        p_project_id: state.projectId,
        p_user_id: request.userId,
        p_shot_index: i,
        p_prompt: clip.prompt,
        p_status: 'failed',
        p_error_message: error instanceof Error ? error.message : 'Unknown error',
      });
      
      state.production.clipResults.push({
        index: i,
        videoUrl: '',
        status: 'failed',
      });
      
      // Continue with remaining clips
    }
  }
  
  const completedClips = state.production.clipResults.filter(c => c.status === 'completed');
  console.log(`[Hollywood] Production complete: ${completedClips.length}/${clips.length} clips`);
  
  // Request final assembly from intelligent stitcher (uses scene anchors + gap detection)
  if (completedClips.length > 0) {
    console.log(`[Hollywood] Requesting intelligent stitching with scene anchor analysis...`);
    
    try {
      const hasAudioTracks = state.assets?.voiceUrl || state.assets?.musicUrl;
      const isProfessional = request.qualityTier === 'professional';
      
      // Use intelligent-stitch for professional tier, fallback to direct stitch for standard
      if (isProfessional) {
        const intelligentStitchResult = await callEdgeFunction('intelligent-stitch', {
          projectId: state.projectId,
          clips: completedClips.map((c, idx) => ({
            shotId: `clip_${c.index}`,
            videoUrl: c.videoUrl,
            firstFrameUrl: idx === 0 ? request.referenceImageUrl : undefined,
            lastFrameUrl: c.lastFrameUrl,
          })),
          voiceAudioUrl: state.assets?.voiceUrl,
          musicAudioUrl: state.assets?.musicUrl,
          autoGenerateBridges: true,
          strictnessLevel: 'normal',
          maxBridgeClips: 3,
          targetFormat: '1080p',
          qualityTier: 'professional',
        });
        
        if (intelligentStitchResult.success && intelligentStitchResult.finalVideoUrl) {
          state.finalVideoUrl = intelligentStitchResult.finalVideoUrl;
          console.log(`[Hollywood] Intelligent stitch complete: ${state.finalVideoUrl}`);
          console.log(`[Hollywood] Scene consistency: ${intelligentStitchResult.plan?.overallConsistency || 'N/A'}%`);
          console.log(`[Hollywood] Bridge clips generated: ${intelligentStitchResult.bridgeClipsGenerated || 0}`);
        } else {
          console.warn(`[Hollywood] Intelligent stitch returned no video, falling back to direct stitch`);
          // Fall through to direct stitch
        }
      }
      
      // Standard tier OR fallback: Direct Cloud Run stitch
      if (!state.finalVideoUrl) {
        const stitcherUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
        if (stitcherUrl) {
          const response = await fetch(`${stitcherUrl}/stitch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: state.projectId,
              projectTitle: `Video - ${state.projectId}`,
              clips: completedClips.map(c => ({
                shotId: `clip_${c.index}`,
                videoUrl: c.videoUrl,
                durationSeconds: DEFAULT_CLIP_DURATION,
                transitionOut: 'continuous',
              })),
              audioMixMode: hasAudioTracks ? 'full' : 'mute',
              outputFormat: 'mp4',
              colorGrading: request.colorGrading || 'cinematic',
              isFinalAssembly: true,
              voiceTrackUrl: state.assets?.voiceUrl,
              backgroundMusicUrl: state.assets?.musicUrl,
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
  state.progress = 95;
  await updateProjectProgress(supabase, state.projectId, 'postproduction', 95);
  
  if (!state.finalVideoUrl) {
    console.warn(`[Hollywood] No final video URL from production stage`);
  } else {
    console.log(`[Hollywood] Final video ready (with audio): ${state.finalVideoUrl}`);
  }
  
  const completedClips = state.production?.clipResults?.filter(c => c.status === 'completed').length || 0;
  const failedClips = state.production?.clipResults?.filter(c => c.status === 'failed').length || 0;
  
  console.log(`[Hollywood] Production summary: ${completedClips} completed, ${failedClips} failed`);
  console.log(`[Hollywood] Assets used: voice=${!!state.assets?.voiceUrl}, music=${!!state.assets?.musicUrl}`);
  
  state.progress = 100;
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
    
    if (resumeFrom === 'qualitygate' && approvedScript) {
      // Resuming after script approval - use the approved script
      console.log(`[Hollywood] Resuming from ${resumeFrom} with approved script`);
      state.script = approvedScript;
      state.extractedCharacters = (request as any).extractedCharacters;
      state.identityBible = (request as any).identityBible;
      state.referenceAnalysis = (request as any).referenceImageAnalysis;
      state.progress = 30;
    } else if (stages.includes('preproduction')) {
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
    
    if (stages.includes('qualitygate') && (!resumeFrom || resumeFrom === 'qualitygate')) {
      state = await runQualityGate(request, state, supabase);
    }
    
    if (stages.includes('assets')) {
      state = await runAssetCreation(request, state, supabase);
    }
    
    if (stages.includes('production')) {
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
    
    // Update project as completed
    await supabase
      .from('movie_projects')
      .update({
        video_url: state.finalVideoUrl,
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
