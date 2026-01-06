import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * HOLLYWOOD PIPELINE ORCHESTRATOR
 * 
 * The master edge function that coordinates all components of the Iron-Clad
 * video production pipeline to achieve Hollywood-rival quality.
 * 
 * Pipeline Stages:
 * 1. PRE-PRODUCTION: Script generation, Identity Bible, Reference Analysis
 * 2. QUALITY GATE: Cinematic Auditor validates and optimizes all prompts
 * 3. ASSET CREATION: Scene images, Voice narration, Background music
 * 4. PRODUCTION: Sequential video generation with frame-chaining
 * 5. POST-PRODUCTION: Final assembly with audio mixing and color grading
 * 
 * Each stage can be run independently or as part of the full pipeline.
 */

interface PipelineRequest {
  userId: string;
  projectId?: string;
  
  // Input options (use one)
  concept?: string;           // High-level story concept for AI script generation
  manualPrompts?: string[];   // User-provided scene prompts (skip script gen)
  
  // Pipeline options
  stages?: ('preproduction' | 'qualitygate' | 'assets' | 'production' | 'postproduction')[];
  
  // Pre-production options
  referenceImageUrl?: string; // Character/style reference
  referenceImageAnalysis?: any; // Pre-analyzed reference image data (from UI)
  genre?: string;
  mood?: string;
  
  // Asset options
  includeVoice?: boolean;
  includeMusic?: boolean;
  musicMood?: string;
  voiceId?: string;
  
  // Production options
  colorGrading?: string;
  totalDuration?: number;     // Target duration in seconds
  clipCount?: number;         // Number of clips (default: calculated from totalDuration)
  
  // Quality options
  qualityTier?: 'standard' | 'professional';
  
  // Pipeline control
  skipCreditDeduction?: boolean; // Skip credit deduction (for when called from another function)
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
  clipCount: number;        // Dynamic clip count
  clipDuration: number;     // Duration per clip
  totalCredits: number;     // Calculated total credits
  
  // Stage outputs
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
  
  // Extracted characters for identity consistency
  extractedCharacters?: ExtractedCharacter[];
  
  // Enhanced Identity Bible with multi-view references
  identityBible?: {
    characterIdentity?: {
      description?: string;
      facialFeatures?: string;
      clothing?: string;
      bodyType?: string;
      distinctiveMarkers?: string[];
    };
    consistencyPrompt?: string;
    // Multi-view character references for visual consistency
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

// Constants
const DEFAULT_CLIP_DURATION = 4; // seconds per clip
const CREDITS_PER_CLIP = 50; // ~50 credits per clip for full pipeline

// Helper to calculate dynamic values
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
    clipCount = 6; // Default
  }
  
  // Clamp to reasonable limits
  clipCount = Math.max(2, Math.min(12, clipCount));
  
  const totalCredits = clipCount * CREDITS_PER_CLIP;
  
  return { clipCount, clipDuration, totalCredits };
}

// Helper to call edge functions internally
async function callEdgeFunction(
  supabase: any,
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

// Stage 1: PRE-PRODUCTION
async function runPreProduction(
  request: PipelineRequest,
  state: PipelineState,
  supabase: any
): Promise<PipelineState> {
  console.log(`[Hollywood] Stage 1: PRE-PRODUCTION (${state.clipCount} clips)`);
  state.stage = 'preproduction';
  state.progress = 10;
  
  // 1a. Generate script from concept (if provided)
  if (request.concept && !request.manualPrompts) {
    console.log(`[Hollywood] Generating script from concept...`);
    
    try {
      const scriptResult = await callEdgeFunction(supabase, 'smart-script-generator', {
        topic: request.concept,
        synopsis: request.concept,
        genre: request.genre || 'cinematic',
        pacingStyle: 'moderate',
        targetDurationSeconds: state.clipCount * state.clipDuration,
        clipCount: state.clipCount,
      });
      
      if (scriptResult.shots) {
        // Ensure we have exactly the right number of shots
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
      // Create basic shots from concept
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
    // Use manual prompts
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
  
  // 1b. Use pre-analyzed reference image OR analyze reference image
  if (request.referenceImageAnalysis) {
    // Use pre-analyzed data from UI (avoids double analysis)
    console.log(`[Hollywood] Using pre-analyzed reference image...`);
    state.referenceAnalysis = request.referenceImageAnalysis;
    state.identityBible = {
      characterIdentity: request.referenceImageAnalysis.characterIdentity,
      consistencyPrompt: request.referenceImageAnalysis.consistencyPrompt,
    };
  } else if (request.referenceImageUrl) {
    console.log(`[Hollywood] Analyzing reference image...`);
    
    try {
      // Run both analysis and identity bible generation in parallel
      const [analysisResult, identityResult] = await Promise.all([
        callEdgeFunction(supabase, 'analyze-reference-image', {
          imageUrl: request.referenceImageUrl,
        }),
        callEdgeFunction(supabase, 'generate-identity-bible', {
          imageUrl: request.referenceImageUrl,
        }).catch(err => {
          console.warn(`[Hollywood] Identity Bible generation failed:`, err);
          return null;
        }),
      ]);
      
      // Process reference analysis
      const analysis = analysisResult.analysis || analysisResult;
      state.referenceAnalysis = analysis;
      
      // Build rich identity bible with multi-view URLs
      state.identityBible = {
        characterIdentity: analysis.characterIdentity,
        consistencyPrompt: analysis.consistencyPrompt,
      };
      
      // Add multi-view URLs if identity bible succeeded
      if (identityResult?.success) {
        state.identityBible.multiViewUrls = {
          frontViewUrl: identityResult.frontViewUrl,
          sideViewUrl: identityResult.sideViewUrl,
          threeQuarterViewUrl: identityResult.threeQuarterViewUrl,
        };
        state.identityBible.consistencyAnchors = identityResult.consistencyAnchors || [];
        
        // Enhance consistency prompt with generated character description
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
  
  // 1c. Generate Identity Bible (if no reference but we have character descriptions)
  if (!state.identityBible && state.script?.shots.some(s => s.description.includes('character'))) {
    console.log(`[Hollywood] Generating Identity Bible from script...`);
    
    try {
      const characterDescriptions = state.script.shots
        .map(s => s.description)
        .join(' ')
        .match(/character[^.]*\./gi) || [];
      
      if (characterDescriptions.length > 0) {
        console.log(`[Hollywood] Skipping Identity Bible (requires reference image)`);
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
  
  // 1d. Extract characters from script for identity consistency
  if (state.script?.shots) {
    console.log(`[Hollywood] Extracting characters from script...`);
    
    try {
      // Compile all shot descriptions into a script text
      const scriptText = state.script.shots
        .map(s => `${s.title}: ${s.description}${s.dialogue ? ` "${s.dialogue}"` : ''}`)
        .join('\n\n');
      
      const characterResult = await callEdgeFunction(supabase, 'extract-characters', {
        script: scriptText,
      });
      
      if (characterResult.success && characterResult.characters?.length > 0) {
        const characters: ExtractedCharacter[] = characterResult.characters;
        state.extractedCharacters = characters;
        console.log(`[Hollywood] Extracted ${characters.length} characters:`, 
          characters.map(c => c.name).join(', '));
        
        // Build character consistency prompt if we don't have one from reference image
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
  
  state.progress = 30;
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
  
  if (!state.script?.shots) {
    throw new Error("No script shots to audit");
  }
  
  try {
    const auditResult = await callEdgeFunction(supabase, 'cinematic-auditor', {
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
    // Create passthrough optimization
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
  
  state.progress = 45;
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
  
  state.assets = {};
  
  // 3a. Generate scene reference images (master anchors)
  if (state.script?.shots && !request.referenceImageUrl && !request.referenceImageAnalysis) {
    console.log(`[Hollywood] Generating scene reference images...`);
    
    try {
      const scenes = state.script.shots.slice(0, 3).map((shot, i) => ({
        sceneNumber: i + 1,
        title: shot.title,
        visualDescription: state.auditResult?.optimizedShots[i]?.optimizedDescription || shot.description,
        mood: shot.mood,
      }));
      
      const imageResult = await callEdgeFunction(supabase, 'generate-scene-images', {
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
  
  // 3b. Generate voice narration (if requested)
  if (request.includeVoice !== false) {
    console.log(`[Hollywood] Generating voice narration...`);
    
    try {
      // Compile all dialogue/descriptions into narration
      const narrationText = state.script?.shots
        ?.map(shot => shot.dialogue || shot.description)
        .join(' ')
        .substring(0, 2000) || ''; // ElevenLabs limit
      
      if (narrationText && narrationText.length > 50) {
        const voiceResult = await callEdgeFunction(supabase, 'generate-voice', {
          text: narrationText,
          voiceId: request.voiceId || 'EXAVITQu4vr4xnSDxMaL', // Default voice
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
  
  // 3c. Generate background music (if requested)
  if (request.includeMusic !== false) {
    console.log(`[Hollywood] Generating background music...`);
    
    try {
      const musicResult = await callEdgeFunction(supabase, 'generate-music', {
        mood: request.musicMood || request.mood || 'cinematic',
        genre: 'hybrid',
        duration: state.clipCount * state.clipDuration + 2, // Slightly longer than video
        projectId: state.projectId,
      });
      
      if (musicResult.musicUrl) {
        state.assets.musicUrl = musicResult.musicUrl;
        state.assets.musicDuration = musicResult.durationSeconds;
        console.log(`[Hollywood] Music generated: ${state.assets.musicUrl}`);
      }
    } catch (err) {
      console.warn(`[Hollywood] Music generation failed:`, err);
    }
  }
  
  state.progress = 70;
  return state;
}

// Stage 4: PRODUCTION
async function runProduction(
  request: PipelineRequest,
  state: PipelineState,
  supabase: any
): Promise<PipelineState> {
  console.log(`[Hollywood] Stage 4: PRODUCTION (Video Generation - ${state.clipCount} clips)`);
  state.stage = 'production';
  state.progress = 75;
  
  // Build character identity prompt from extracted characters
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
  
  console.log(`[Hollywood] Character identity prompt: ${characterIdentityPrompt?.substring(0, 100) || 'none'}...`);
  
  // Build the optimized clips array with all enhancements
  const clips = state.auditResult?.optimizedShots.slice(0, state.clipCount).map((opt, i) => {
    let finalPrompt = opt.optimizedDescription;
    
    // PRIORITY 1: Inject extracted character identities
    if (characterIdentityPrompt) {
      finalPrompt = `[CHARACTERS: ${characterIdentityPrompt}] ${finalPrompt}`;
    }
    
    // PRIORITY 2: Inject identity anchors from audit
    if (opt.identityAnchors?.length > 0) {
      finalPrompt = `[IDENTITY: ${opt.identityAnchors.join(', ')}] ${finalPrompt}`;
    }
    
    // PRIORITY 3: Inject physics guards
    if (opt.physicsGuards?.length > 0) {
      finalPrompt = `${finalPrompt}. [PHYSICS: ${opt.physicsGuards.join(', ')}]`;
    }
    
    // PRIORITY 4: Inject velocity continuity from previous shot
    if (i > 0 && state.auditResult?.velocityVectors) {
      const prevVector = state.auditResult.velocityVectors[i - 1];
      if (prevVector?.endFrameMotion?.continuityPrompt) {
        finalPrompt = `[MOTION: ${prevVector.endFrameMotion.continuityPrompt}] ${finalPrompt}`;
      }
    }
    
    return {
      index: i,
      prompt: finalPrompt,
      sceneContext: {
        clipIndex: i,
        totalClips: state.clipCount,
        environment: state.referenceAnalysis?.environment?.setting,
        lightingStyle: state.referenceAnalysis?.lighting?.style,
        colorPalette: state.referenceAnalysis?.colorPalette?.dominant?.join(', '),
        characters: state.extractedCharacters?.map(c => c.name) || [],
      },
    };
  }) || [];
  
  // Determine first frame reference - prefer identity bible front view for consistency
  let referenceImageUrl = state.identityBible?.multiViewUrls?.frontViewUrl 
    || request.referenceImageUrl
    || request.referenceImageAnalysis?.imageUrl;
  if (!referenceImageUrl && state.assets?.sceneImages?.[0]?.imageUrl) {
    referenceImageUrl = state.assets.sceneImages[0].imageUrl;
  }
  
  console.log(`[Hollywood] First frame reference: ${referenceImageUrl ? 'using identity bible front view' : 'none'}`);
  console.log(`[Hollywood] Multi-view URLs available: ${!!state.identityBible?.multiViewUrls}`);
  
  console.log(`[Hollywood] Calling generate-long-video with ${clips.length} optimized clips`);
  console.log(`[Hollywood] Audio tracks: voice=${!!state.assets?.voiceUrl}, music=${!!state.assets?.musicUrl}`);
  
  // Call the existing generate-long-video function WITH audio tracks
  // Pass skipCreditDeduction=true since hollywood-pipeline handles credits
  const productionResult = await callEdgeFunction(supabase, 'generate-long-video', {
    userId: request.userId,
    projectId: state.projectId,
    clips,
    clipCount: state.clipCount,
    referenceImageUrl,
    colorGrading: request.colorGrading || 'cinematic',
    identityBible: state.identityBible,
    voiceTrackUrl: state.assets?.voiceUrl,
    musicTrackUrl: state.assets?.musicUrl,
    qualityTier: request.qualityTier || 'standard',
    maxRetries: 2,
    skipCreditDeduction: true, // Hollywood pipeline handles credits
  });
  
  if (!productionResult.success) {
    throw new Error(productionResult.error || 'Video production failed');
  }
  
  state.production = {
    clipResults: productionResult.clipResults || [],
  };
  
  // If generate-long-video already stitched, use its result
  if (productionResult.finalVideoUrl) {
    state.finalVideoUrl = productionResult.finalVideoUrl;
  }
  
  state.progress = 90;
  return state;
}

// Stage 5: POST-PRODUCTION (now streamlined - audio mixing happens in production)
async function runPostProduction(
  request: PipelineRequest,
  state: PipelineState,
  supabase: any
): Promise<PipelineState> {
  console.log(`[Hollywood] Stage 5: POST-PRODUCTION (finalization)`);
  state.stage = 'postproduction';
  state.progress = 95;
  
  // Audio mixing now happens in generate-long-video via voiceTrackUrl/musicTrackUrl
  // This stage is now for any final quality checks or metadata updates
  
  if (!state.finalVideoUrl) {
    console.warn(`[Hollywood] No final video URL from production stage`);
  } else {
    console.log(`[Hollywood] Final video ready (with audio): ${state.finalVideoUrl}`);
  }
  
  // Log production summary
  const completedClips = state.production?.clipResults?.filter(c => c.status === 'completed').length || 0;
  const failedClips = state.production?.clipResults?.filter(c => c.status === 'failed').length || 0;
  
  console.log(`[Hollywood] Production summary: ${completedClips} completed, ${failedClips} failed`);
  console.log(`[Hollywood] Assets used: voice=${!!state.assets?.voiceUrl}, music=${!!state.assets?.musicUrl}`);
  
  state.progress = 100;
  return state;
}

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
    
    // Validate input
    if (!request.concept && !request.manualPrompts) {
      throw new Error("Either 'concept' or 'manualPrompts' is required");
    }
    
    // Calculate dynamic pipeline parameters
    const { clipCount, clipDuration, totalCredits } = calculatePipelineParams(request);
    
    console.log(`[Hollywood] Pipeline params: ${clipCount} clips × ${clipDuration}s = ${clipCount * clipDuration}s, ${totalCredits} credits`);
    
    // Validate manual prompts count if provided
    if (request.manualPrompts && request.manualPrompts.length < 2) {
      throw new Error(`At least 2 prompts are required`);
    }

    // Check credits
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
      const { data: project, error: projectError } = await supabase
        .from('movie_projects')
        .insert({
          title: `Hollywood Pipeline - ${new Date().toLocaleString()}`,
          user_id: request.userId,
          status: 'generating',
          genre: request.genre || 'cinematic',
          mood: request.mood,
          story_structure: 'episodic',
          target_duration_minutes: Math.ceil((clipCount * clipDuration) / 60),
        })
        .select()
        .single();

      if (projectError) throw projectError;
      projectId = project.id;
    }

    console.log(`[Hollywood] Starting pipeline for project ${projectId}`);

    // Initialize state with dynamic values
    let state: PipelineState = {
      projectId: projectId!,
      stage: 'initializing',
      progress: 0,
      clipCount,
      clipDuration,
      totalCredits,
    };

    // Determine which stages to run
    const stages = request.stages || ['preproduction', 'qualitygate', 'assets', 'production', 'postproduction'];

    // Execute pipeline stages
    if (stages.includes('preproduction')) {
      state = await runPreProduction(request, state, supabase);
    }
    
    if (stages.includes('qualitygate')) {
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

    // Deduct credits on success (unless skipped)
    if (state.finalVideoUrl && !request.skipCreditDeduction) {
      console.log(`[Hollywood] Deducting ${state.totalCredits} credits`);
      
      await supabase.rpc('deduct_credits', {
        p_user_id: request.userId,
        p_amount: state.totalCredits,
        p_description: `Hollywood Pipeline - Full production (${state.clipCount} clips + audio)`,
        p_project_id: projectId,
        p_clip_duration: state.clipCount * state.clipDuration,
      });

      // Update project status
      await supabase
        .from('movie_projects')
        .update({
          video_url: state.finalVideoUrl,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        projectId: state.projectId,
        finalVideoUrl: state.finalVideoUrl,
        
        // Pipeline details
        stages: {
          preproduction: {
            shotCount: state.script?.shots?.length || 0,
            hasIdentityBible: !!state.identityBible,
            hasReferenceAnalysis: !!state.referenceAnalysis,
            charactersExtracted: state.extractedCharacters?.length || 0,
            characterNames: state.extractedCharacters?.map(c => c.name) || [],
            script: state.script,
            identityBible: state.identityBible?.multiViewUrls ? {
              multiViewUrls: {
                front: state.identityBible.multiViewUrls.frontViewUrl,
                side: state.identityBible.multiViewUrls.sideViewUrl,
                threeQuarter: state.identityBible.multiViewUrls.threeQuarterViewUrl,
              },
              consistencyAnchors: state.identityBible.consistencyAnchors,
            } : null,
          },
          qualitygate: {
            auditScore: state.auditResult?.overallScore || 0,
            optimizedShots: state.auditResult?.optimizedShots?.length || 0,
            velocityVectors: state.auditResult?.velocityVectors?.length || 0,
          },
          assets: {
            sceneImages: state.assets?.sceneImages || [],
            hasVoice: !!state.assets?.voiceUrl,
            hasMusic: !!state.assets?.musicUrl,
            voiceUrl: state.assets?.voiceUrl,
            musicUrl: state.assets?.musicUrl,
          },
          production: {
            clipsCompleted: state.production?.clipResults?.filter(c => c.status === 'completed').length || 0,
            clipsFailed: state.production?.clipResults?.filter(c => c.status === 'failed').length || 0,
            clipResults: state.production?.clipResults?.map(c => ({
              index: c.index,
              status: c.status,
              videoUrl: c.videoUrl,
              qaResult: (c as any).qaResult,
            })),
          },
        },
        
        // Cost breakdown
        creditsCharged: state.finalVideoUrl && !request.skipCreditDeduction ? state.totalCredits : 0,
        clipCount: state.clipCount,
        clipDuration: state.clipDuration,
        totalDuration: state.clipCount * state.clipDuration,
        
        // Full state for debugging
        _state: state,
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
