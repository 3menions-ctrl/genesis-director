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
  // Environment DNA - for consistent visual atmosphere
  environmentPrompt?: string;
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

// Degradation tracking for user notifications
interface DegradationFlags {
  identityBibleFailed?: boolean;
  identityBibleRetries?: number;
  musicGenerationFailed?: boolean;
  sceneImagePartialFail?: number; // Number of scenes that failed
  voiceGenerationFailed?: boolean;
  auditFailed?: boolean;
  characterExtractionFailed?: boolean;
  sfxGenerationFailed?: boolean;
  reducedConsistencyMode?: boolean;
}

interface PipelineState {
  projectId: string;
  degradation?: DegradationFlags;
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
    // v3.0: Original reference URL (replaces multiViewUrls)
    originalReferenceUrl?: string;
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
// NOTE: These should match DEFAULT_TIER_LIMITS in src/types/tier-limits.ts
// Primary source of truth is the tier_limits table in DB, accessed via get_user_tier_limits RPC
// IMPORTANT: Max clips is 6 for all tiers to ensure consistency
const TIER_CLIP_LIMITS: Record<string, { maxClips: number; maxDuration: number; maxRetries: number; chunkedStitching: boolean }> = {
  'free': { maxClips: 6, maxDuration: 60, maxRetries: 1, chunkedStitching: false },
  'pro': { maxClips: 6, maxDuration: 60, maxRetries: 2, chunkedStitching: false },
  'growth': { maxClips: 6, maxDuration: 120, maxRetries: 3, chunkedStitching: true },
  'agency': { maxClips: 6, maxDuration: 120, maxRetries: 4, chunkedStitching: true },
};

const MIN_CLIPS_PER_PROJECT = 2;

// Tier-aware credit costs (MUST match frontend useCreditBilling.ts)
// Pricing: 10 credits per clip = $1 per clip
const TIER_CREDIT_COSTS = {
  standard: {
    PRE_PRODUCTION: 2,
    PRODUCTION: 6,
    QUALITY_INSURANCE: 2,
    TOTAL_PER_SHOT: 10,    // 10 credits per clip
  },
  professional: {
    PRE_PRODUCTION: 2,
    PRODUCTION: 6,
    QUALITY_INSURANCE: 2,
    TOTAL_PER_SHOT: 10,    // Same - all clips are premium quality
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
  body: any,
  options?: {
    maxRetries?: number;
    timeoutMs?: number;
    retryableErrors?: string[];
  }
): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const maxRetries = options?.maxRetries ?? 2;
  const timeoutMs = options?.timeoutMs ?? 300000; // 5 minute default
  const retryableErrors = options?.retryableErrors ?? ['rate', '429', 'timeout', 'network', '503', '502'];
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Exponential backoff on retries
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.log(`[Hollywood] Retry ${attempt}/${maxRetries} for ${functionName}, waiting ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // Check if error is retryable
        const isRetryable = retryableErrors.some(re => 
          errorText.toLowerCase().includes(re) || response.status.toString().includes(re)
        );
        
        if (isRetryable && attempt < maxRetries) {
          console.warn(`[Hollywood] ${functionName} returned ${response.status}, retrying...`);
          lastError = new Error(`${functionName} failed: ${errorText.substring(0, 200)}`);
          continue;
        }
        
        throw new Error(`${functionName} failed: ${errorText}`);
      }
      
      return response.json();
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for abort/timeout
      if (errorMsg.includes('abort') || errorMsg.includes('timeout')) {
        console.warn(`[Hollywood] ${functionName} timed out after ${timeoutMs}ms`);
        if (attempt < maxRetries) {
          lastError = error instanceof Error ? error : new Error(errorMsg);
          continue;
        }
      }
      
      // Check if retryable network error
      const isRetryable = retryableErrors.some(re => errorMsg.toLowerCase().includes(re));
      if (isRetryable && attempt < maxRetries) {
        console.warn(`[Hollywood] ${functionName} error (${errorMsg.substring(0, 50)}), retrying...`);
        lastError = error instanceof Error ? error : new Error(errorMsg);
        continue;
      }
      
      throw error;
    }
  }
  
  // All retries exhausted
  throw lastError || new Error(`${functionName} failed after ${maxRetries} retries`);
}

/**
 * AI-Enhanced Narration Generator
 * 
 * Takes raw shot descriptions/dialogue and rewrites them into a flowing,
 * coherent narration that sounds natural when spoken aloud.
 */
async function createFlowingNarration(
  shots: Array<{ shotNumber: number; dialogue: string; description: string; mood: string }>,
  overallMood: string
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    console.warn("[Hollywood] No OpenAI API key - falling back to basic concatenation");
    // Fallback: just return dialogues if they exist, otherwise descriptions
    return shots
      .map(s => s.dialogue || '')
      .filter(Boolean)
      .join(' ') || shots.map(s => s.description).join(' ');
  }
  
  // Build structured input for the AI
  const shotSummary = shots.map(s => {
    if (s.dialogue) return `Shot ${s.shotNumber}: "${s.dialogue}"`;
    return `Shot ${s.shotNumber}: [Visual: ${s.description}]`;
  }).join('\n');
  
  const systemPrompt = `You are a professional narrator creating voiceover for a ${overallMood} video.

Your task: Transform the following shot-by-shot content into ONE flowing narration script.

Rules:
1. Write in a natural, conversational tone suitable for voiceover
2. Create smooth transitions between ideas - no choppy sentences
3. Keep the emotional tone consistent with the ${overallMood} mood
4. If shots contain dialogue, weave it naturally into the narration
5. If shots only have visual descriptions, describe what's happening poetically
6. The narration should feel like ONE cohesive story, not separate scenes
7. Keep it under 500 words for pacing
8. Do NOT include any stage directions, shot numbers, or technical notes
9. Write ONLY the narration text - no quotes, no "Narrator:", just the spoken words`;

  const userPrompt = `Here are the shots to narrate:\n\n${shotSummary}\n\nWrite a flowing narration script:`;

  try {
    console.log(`[Hollywood] Creating AI-enhanced narration from ${shots.length} shots...`);
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Hollywood] Narration AI error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const narration = data.choices?.[0]?.message?.content?.trim();
    
    if (!narration) {
      throw new Error("Empty narration response");
    }
    
    console.log(`[Hollywood] AI-enhanced narration created: ${narration.length} chars`);
    return narration;
    
  } catch (err) {
    console.error("[Hollywood] AI narration failed, using fallback:", err);
    // Fallback: return dialogues or basic descriptions
    return shots
      .map(s => s.dialogue || '')
      .filter(Boolean)
      .join(' ') || shots.map(s => s.description).filter(Boolean).join('. ');
  }
}

// Update project with pipeline progress (includes degradation tracking)
async function updateProjectProgress(
  supabase: any, 
  projectId: string, 
  stage: string, 
  progress: number, 
  details?: any,
  degradation?: DegradationFlags
) {
  const pendingTasks = {
    stage,
    progress,
    updatedAt: new Date().toISOString(),
    ...details,
    // SAFEGUARD: Include degradation flags for UI notifications
    ...(degradation && Object.keys(degradation).length > 0 ? { degradation } : {}),
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
        // ENVIRONMENT DNA: Pass through for visual atmosphere consistency
        environmentPrompt: request.environmentPrompt,
        // VOICE CONTROL: Pass includeVoice to prevent dialogue generation when disabled
        includeVoice: request.includeVoice,
      });
      
      if (scriptResult.shots || scriptResult.clips) {
        const rawShots = scriptResult.shots || scriptResult.clips;
        const shots = rawShots.slice(0, state.clipCount).map((shot: any, i: number) => ({
          id: shot.id || `shot_${i + 1}`,
          title: shot.title || `Clip ${i + 1}`,
          description: shot.description || '',
          durationSeconds: shot.durationSeconds || state.clipDuration,
          mood: shot.mood || request.mood || 'cinematic',
          // VOICE CONTROL: Only include dialogue if voice is enabled
          dialogue: request.includeVoice ? (shot.dialogue || '') : '',
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
        // ENVIRONMENT DNA: Pass through for visual atmosphere consistency
        environmentPrompt: request.environmentPrompt,
        // VOICE CONTROL: Pass includeVoice to prevent dialogue generation when disabled
        includeVoice: request.includeVoice,
      });
      
      if (scriptResult.shots || scriptResult.clips) {
        const rawShots = scriptResult.shots || scriptResult.clips;
        const shots = rawShots.slice(0, state.clipCount).map((shot: any, i: number) => ({
          id: shot.id || `shot_${i + 1}`,
          title: shot.title || `Clip ${i + 1}`,
          description: shot.description || '',
          durationSeconds: shot.durationSeconds || state.clipDuration,
          mood: shot.mood || request.mood || 'cinematic',
          // VOICE CONTROL: Only include dialogue if voice is enabled
          dialogue: request.includeVoice ? (shot.dialogue || '') : '',
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
    
    // Initialize degradation tracking
    state.degradation = state.degradation || {};
    
    try {
      // SAFEGUARD: Identity Bible with retry (2 attempts)
      const MAX_IDENTITY_RETRIES = 2;
      let identityResult = null;
      let identityRetryCount = 0;
      
      const analysisResult = await callEdgeFunction('analyze-reference-image', {
        imageUrl: request.referenceImageUrl,
      });
      
      const analysis = analysisResult.analysis || analysisResult;
      state.referenceAnalysis = analysis;
      
      // Retry loop for Identity Bible
      for (let attempt = 1; attempt <= MAX_IDENTITY_RETRIES; attempt++) {
        try {
          console.log(`[Hollywood] Identity Bible generation attempt ${attempt}/${MAX_IDENTITY_RETRIES}...`);
          identityResult = await callEdgeFunction('generate-identity-bible', {
            imageUrl: request.referenceImageUrl,
            generateBackView: true,
            generateSilhouette: true,
          });
          
          if (identityResult?.success) {
            console.log(`[Hollywood] Identity Bible generated on attempt ${attempt}`);
            break;
          }
          identityRetryCount = attempt;
        } catch (err) {
          console.warn(`[Hollywood] Identity Bible attempt ${attempt} failed:`, err);
          identityRetryCount = attempt;
          if (attempt < MAX_IDENTITY_RETRIES) {
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
          }
        }
      }
      
      // Track degradation if identity bible failed after retries
      if (!identityResult?.success) {
        state.degradation.identityBibleFailed = true;
        state.degradation.identityBibleRetries = identityRetryCount;
        state.degradation.reducedConsistencyMode = true;
        console.warn(`[Hollywood] ⚠️ DEGRADATION: Identity Bible failed after ${identityRetryCount} attempts - entering reduced consistency mode`);
      }
      
      state.identityBible = {
        characterIdentity: analysis.characterIdentity,
        consistencyPrompt: analysis.consistencyPrompt,
      };
      
      if (identityResult?.success) {
        // v3.0: No multi-view generation - use original reference + detailed prompts
        state.identityBible.consistencyAnchors = identityResult.consistencyAnchors || [];
        
        // Non-facial anchors for occlusion handling
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
        
        // Occlusion negatives for anti-morphing
        if (identityResult.occlusionNegatives) {
          state.identityBible.occlusionNegatives = identityResult.occlusionNegatives;
          console.log(`[Hollywood] Occlusion negatives: ${identityResult.occlusionNegatives.length} anti-morphing prompts`);
        }
        
        if (identityResult.characterDescription || identityResult.enhancedConsistencyPrompt) {
          state.identityBible.consistencyPrompt = identityResult.enhancedConsistencyPrompt || identityResult.characterDescription;
        }
        
        // Store original reference URL for all clips to use
        state.identityBible.originalReferenceUrl = request.referenceImageUrl;
        
        console.log(`[Hollywood] Identity Bible v3.0 generated: analysis-only mode, non-facial anchors=${!!identityResult.nonFacialAnchors}`);
      }
      
      console.log(`[Hollywood] Reference analyzed: ${analysis.consistencyPrompt?.substring(0, 50)}...`);
      
      // =====================================================
      // IMMEDIATE PERSISTENCE: Save identity bible to DB RIGHT NOW
      // This ensures it's available even if pipeline crashes/restarts
      // =====================================================
      if (state.identityBible) {
        try {
          const identityToSave = {
            ...state.identityBible,
            characterDescription: state.identityBible.consistencyPrompt 
              || state.identityBible.characterIdentity?.description
              || '',
            savedAt: new Date().toISOString(),
            savedStage: 'reference_analysis',
          };
          
          const { data: currentData } = await supabase
            .from('movie_projects')
            .select('pro_features_data')
            .eq('id', state.projectId)
            .single();
          
          await supabase
            .from('movie_projects')
            .update({
              pro_features_data: {
                ...(currentData?.pro_features_data || {}),
                identityBible: identityToSave,
                referenceAnalysis: state.referenceAnalysis,
                identitySavedAt: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', state.projectId);
          
          console.log(`[Hollywood] ✓ IMMEDIATE SAVE: identityBible persisted to DB`);
          console.log(`[Hollywood]   consistencyPrompt: ${identityToSave.consistencyPrompt?.substring(0, 50) || 'NONE'}...`);
          console.log(`[Hollywood]   characterIdentity: ${identityToSave.characterIdentity ? 'YES' : 'NO'}`);
          console.log(`[Hollywood]   nonFacialAnchors: ${identityToSave.nonFacialAnchors ? 'YES' : 'NO'}`);
        } catch (saveErr) {
          console.error(`[Hollywood] ⚠️ IMMEDIATE SAVE FAILED:`, saveErr);
        }
      }
    } catch (err) {
      console.warn(`[Hollywood] Reference analysis failed:`, err);
      state.degradation = state.degradation || {};
      state.degradation.identityBibleFailed = true;
      state.degradation.reducedConsistencyMode = true;
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
  
  // =====================================================
  // CRITICAL FIX: Persist ALL identity data to DB for resume/callback support
  // Without this, character anchors are lost when pipeline restarts or callbacks happen
  // This includes: identityBible, extractedCharacters, multiCharacterBible
  // =====================================================
  try {
    const { data: currentProject } = await supabase
      .from('movie_projects')
      .select('pro_features_data')
      .eq('id', state.projectId)
      .single();
    
    // CRITICAL: Add characterDescription to identityBible for verify-character-identity compatibility
    const identityBibleWithDescription = state.identityBible ? {
      ...state.identityBible,
      // Ensure characterDescription is set for downstream functions
      characterDescription: state.identityBible.consistencyPrompt 
        || state.identityBible.characterIdentity?.description
        || (state.extractedCharacters?.[0] ? 
            `${state.extractedCharacters[0].name}: ${state.extractedCharacters[0].appearance}` : ''),
    } : null;
    
    const updatedProFeatures = {
      ...(currentProject?.pro_features_data || {}),
      // Identity Bible with characterDescription added
      identityBible: identityBibleWithDescription,
      // Extracted characters for multi-character scenes
      extractedCharacters: state.extractedCharacters || [],
      // Multi-character bible if generated
      multiCharacterBible: (state as any).multiCharacterBible || null,
      // Reference analysis for scene consistency
      referenceAnalysis: state.referenceAnalysis || null,
      // Scene consistency locks
      sceneConsistency: state.sceneConsistency || null,
      // Timestamp for debugging
      preProductionPersistedAt: new Date().toISOString(),
    };
    
    const { error: updateError } = await supabase
      .from('movie_projects')
      .update({
        pro_features_data: updatedProFeatures,
        updated_at: new Date().toISOString(),
      })
      .eq('id', state.projectId);
    
    if (updateError) {
      console.error(`[Hollywood] ⚠️ Failed to persist pre-production data:`, updateError);
    } else {
      console.log(`[Hollywood] ✓ PERSISTED ALL pre-production data to DB:`);
      console.log(`  - identityBible: ${identityBibleWithDescription ? 'YES' : 'NO'}`);
      console.log(`  - characterDescription: ${identityBibleWithDescription?.characterDescription?.substring(0, 50) || 'NONE'}...`);
      console.log(`  - extractedCharacters: ${state.extractedCharacters?.length || 0}`);
      console.log(`  - multiCharacterBible: ${(state as any).multiCharacterBible ? 'YES' : 'NO'}`);
      console.log(`  - consistencyAnchors: ${state.identityBible?.consistencyAnchors?.length || 0}`);
    }
  } catch (persistErr) {
    console.error(`[Hollywood] Failed to persist pre-production data:`, persistErr);
  }
  
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
  state.degradation = state.degradation || {};
  
  // 3a. REMOVED: Scene image generation completely removed
  // Frame extraction now relies ONLY on:
  // 1. User-uploaded reference image for clip 1
  // 2. FFmpeg-extracted frames from actual video clips for subsequent clips
  // This ensures visual consistency comes from real video frames, not AI-generated images
  
  console.log(`[Hollywood] ⚡ Scene image generation DISABLED - using FFmpeg frame extraction only`);
  console.log(`[Hollywood] Reference image available: ${!!request.referenceImageUrl}`);
  
  // Note: Reference image URL is passed directly to production stage via request.referenceImageUrl
  // No need to store in state.assets since it comes from request
  if (request.referenceImageUrl) {
    console.log(`[Hollywood] ✓ Reference image will be used as anchor for first clip`);
  } else {
    console.warn(`[Hollywood] ⚠️ No reference image provided - clip 1 will generate without visual anchor`);
  }
  
  state.progress = 55;
  await updateProjectProgress(supabase, state.projectId, 'assets', 55);
  
  // 3b. Generate voice narration with AI-enhanced flow (ONLY if explicitly enabled)
  // NOTE: Narration is OFF by default. User must explicitly set includeVoice: true to enable.
  state.degradation = state.degradation || {};
  
  if (request.includeVoice === true) {
    console.log(`[Hollywood] Generating AI-enhanced voice narration...`);
    
    try {
      // Collect raw shot content for AI rewriting
      const rawShots = state.script?.shots?.map((shot, i) => ({
        shotNumber: i + 1,
        dialogue: shot.dialogue || '',
        description: shot.description || '',
        mood: shot.mood || '',
      })) || [];
      
      if (rawShots.length > 0) {
        // Use AI to create flowing narration from shot content
        const enhancedNarration = await createFlowingNarration(rawShots, request.mood || 'cinematic');
        
        if (enhancedNarration && enhancedNarration.length > 50) {
          console.log(`[Hollywood] AI-enhanced narration created: ${enhancedNarration.length} chars`);
          
          const voiceResult = await callEdgeFunction('generate-voice', {
            text: enhancedNarration,
            voiceId: request.voiceId || 'EXAVITQu4vr4xnSDxMaL',
            projectId: state.projectId,
            voiceType: 'narrator',
          });
          
          if (voiceResult.audioUrl) {
            state.assets.voiceUrl = voiceResult.audioUrl;
            state.assets.voiceDuration = voiceResult.durationMs ? voiceResult.durationMs / 1000 : state.clipCount * state.clipDuration;
            console.log(`[Hollywood] Voice generated: ${state.assets.voiceUrl}`);
          } else {
            console.error(`[Hollywood] Voice generation returned no URL`);
            state.degradation.voiceGenerationFailed = true;
            console.warn(`[Hollywood] ⚠️ DEGRADATION: Voice generation failed - video will have no narration`);
          }
        } else {
          console.warn(`[Hollywood] AI narration enhancement returned insufficient text`);
          state.degradation.voiceGenerationFailed = true;
        }
      } else {
        console.warn(`[Hollywood] No shots available for narration`);
      }
    } catch (err) {
      console.error(`[Hollywood] Voice generation FAILED:`, err);
      state.degradation.voiceGenerationFailed = true;
      console.warn(`[Hollywood] ⚠️ DEGRADATION: Voice generation failed - video will have no narration`);
    }
  } else {
    console.log(`[Hollywood] ⚡ Voice generation SKIPPED (includeVoice=${request.includeVoice})`);
  }
  
  state.progress = 60;
  await updateProjectProgress(supabase, state.projectId, 'assets', 60, { hasVoice: !!state.assets.voiceUrl });
  
  // 3c. Generate background music with scene synchronization (ONLY if includeMusic is true)
  let musicGenerated = false;
  
  if (request.includeMusic === true) {
    console.log(`[Hollywood] Generating synchronized background music...`);
    
    try {
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
            musicGenerated = true;
            console.log(`[Hollywood] Synchronized music generated: ${state.assets.musicUrl}`);
          } else if (musicResult.hasMusic === false) {
            console.log(`[Hollywood] Music explicitly skipped: ${musicResult.message || 'no provider available'}`);
          } else {
            console.warn(`[Hollywood] Music sync returned no URL, trying fallback...`);
          }
        } else {
          console.error(`[Hollywood] Music sync failed, trying direct generation...`);
        }
        
        // SAFEGUARD: Fallback to direct music generation if sync failed
        if (!musicGenerated) {
          console.log(`[Hollywood] Attempting direct music generation fallback...`);
          const musicResult = await callEdgeFunction('generate-music', {
            mood: request.musicMood || request.mood || 'cinematic',
            genre: 'hybrid',
            duration: state.clipCount * state.clipDuration + 2,
            projectId: state.projectId,
          });
          
          if (musicResult.musicUrl) {
            state.assets.musicUrl = musicResult.musicUrl;
            state.assets.musicDuration = musicResult.durationSeconds;
            musicGenerated = true;
            console.log(`[Hollywood] Music generated (fallback): ${state.assets.musicUrl}`);
          } else if (musicResult.hasMusic === false) {
            console.log(`[Hollywood] Music skipped in fallback: ${musicResult.message || 'no provider'}`);
          }
        }
      }
    } catch (err) {
      console.error(`[Hollywood] Music generation FAILED:`, err);
    }
    
    // Track music degradation if no music was generated
    if (!musicGenerated && !state.assets.musicUrl) {
      state.degradation = state.degradation || {};
      state.degradation.musicGenerationFailed = true;
      console.warn(`[Hollywood] ⚠️ DEGRADATION: Music generation failed - video will have no background music`);
    }
  } else {
    console.log(`[Hollywood] ⚡ Music generation SKIPPED (includeMusic=${request.includeMusic})`);
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
      } else {
        state.degradation = state.degradation || {};
        state.degradation.sfxGenerationFailed = true;
        console.warn(`[Hollywood] ⚠️ DEGRADATION: SFX plan generation returned no plan`);
      }
    } catch (err) {
      console.warn(`[Hollywood] SFX generation failed:`, err);
      state.degradation = state.degradation || {};
      state.degradation.sfxGenerationFailed = true;
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
          masterColorAnchor: colorResult.masterColorAnchor, // NEW: Short anchor for every clip
          masterColorDNA: colorResult.masterColorDNA,       // NEW: Full color DNA spec
          consistencyScore: colorResult.consistencyScore,
          shotGradings: colorResult.shotGradings,
        };
        console.log(`[Hollywood] Color grading: ${colorResult.masterPreset} preset, consistency ${colorResult.consistencyScore}%`);
        console.log(`[Hollywood] Color DNA locked: saturation floor ${colorResult.masterColorDNA?.saturationFloor}%, vibrance target ${colorResult.masterColorDNA?.vibranceTarget}%`);
        
        // Apply ENHANCED color prompt with progressive boosting to optimized shots
        if (colorResult.colorPromptEnhancements && state.auditResult?.optimizedShots) {
          for (const enhancement of colorResult.colorPromptEnhancements) {
            const shotIdx = state.auditResult.optimizedShots.findIndex(s => s.shotId === enhancement.shotId);
            if (shotIdx >= 0) {
              const existingDesc = state.auditResult.optimizedShots[shotIdx].optimizedDescription;
              // Use full prompt with progressive boosting
              state.auditResult.optimizedShots[shotIdx].optimizedDescription = 
                `[COLOR DNA: ${enhancement.prompt}] ${existingDesc}`;
            }
          }
          console.log(`[Hollywood] Applied progressive color DNA to ${colorResult.colorPromptEnhancements.length} shots`);
        }
      }
    } catch (err) {
      // FALLBACK: Apply default rich color enforcement if color grading fails
      console.warn(`[Hollywood] Color grading analysis failed, applying fallback rich colors:`, err);
      (state as any).colorGrading = {
        masterPreset: 'cinematic',
        masterColorAnchor: 'Rich cinematic colors: warm amber highlights, cool teal shadows. High contrast with deep blacks. Saturation min 70%. NEVER: washed out, gray, muddy.',
        consistencyScore: 85,
      };
      
      // Apply fallback color DNA to all shots
      if (state.auditResult?.optimizedShots) {
        for (let i = 0; i < state.auditResult.optimizedShots.length; i++) {
          const existingDesc = state.auditResult.optimizedShots[i].optimizedDescription;
          state.auditResult.optimizedShots[i].optimizedDescription = 
            `[COLOR DNA: Rich cinematic grade. Saturation min 70%. Clip ${i + 1}/${state.auditResult.optimizedShots.length}. Colors must be RICHER than previous.] ${existingDesc}`;
        }
        console.log(`[Hollywood] Applied fallback color DNA to ${state.auditResult.optimizedShots.length} shots`);
      }
    }
  }
  
  state.progress = 70;
  
  // SAFEGUARD: Log degradation summary at end of asset stage
  if (state.degradation && Object.keys(state.degradation).length > 0) {
    console.log(`[Hollywood] ⚠️ ASSET STAGE DEGRADATION SUMMARY:`, JSON.stringify(state.degradation));
  }
  
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
  }, state.degradation);
  
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
  // CRITICAL FIX: Also load from DB if state.assets is empty (resume scenario)
  // =====================================================
  const sceneImageLookup: Record<number, string> = {};
  
  // First try from state
  if (state.assets?.sceneImages) {
    for (const img of state.assets.sceneImages) {
      if (img.imageUrl) {
        sceneImageLookup[img.sceneNumber - 1] = img.imageUrl;
      }
    }
    console.log(`[Hollywood] Scene image lookup built from state: ${Object.keys(sceneImageLookup).length} images`);
  }
  
  // CRITICAL FIX: If no scene images in state, load from DB (resume scenario)
  if (Object.keys(sceneImageLookup).length === 0) {
    try {
      const { data: projectData } = await supabase
        .from('movie_projects')
        .select('scene_images, pro_features_data')
        .eq('id', state.projectId)
        .single();
      
      // Load scene_images from DB
      if (projectData?.scene_images && Array.isArray(projectData.scene_images)) {
        for (const img of projectData.scene_images) {
          if (img.imageUrl) {
            sceneImageLookup[img.sceneNumber - 1] = img.imageUrl;
          }
        }
        console.log(`[Hollywood] Scene image lookup loaded from DB: ${Object.keys(sceneImageLookup).length} images`);
      }
      
      // FALLBACK: Use reference image from pro_features_data if no scene images
      if (Object.keys(sceneImageLookup).length === 0 && projectData?.pro_features_data?.goldenFrameData?.goldenFrameUrl) {
        const goldenUrl = projectData.pro_features_data.goldenFrameData.goldenFrameUrl;
        // Use golden frame as fallback for ALL clips
        for (let i = 0; i < clips.length; i++) {
          sceneImageLookup[i] = goldenUrl;
        }
        console.log(`[Hollywood] Using goldenFrameUrl as universal fallback: ${goldenUrl.substring(0, 60)}...`);
      }
    } catch (dbErr) {
      console.warn(`[Hollywood] Failed to load scene images from DB:`, dbErr);
    }
  }
  
  // =====================================================
  // BULLETPROOF REFERENCE IMAGE INITIALIZATION
  // Multi-source lookup to guarantee we have visual reference
  // =====================================================
  // CRITICAL FIX: Prioritize ORIGINAL UPLOADED reference image over generated frames
  // The user's uploaded image is the source of truth for character identity
  let referenceImageUrl = request.referenceImageAnalysis?.imageUrl  // FIRST: Original uploaded image
    || request.referenceImageUrl                                     // Second: Explicit reference URL
    || state.identityBible?.originalReferenceUrl;                    // Third: Stored original reference
  
  console.log(`[Hollywood] Reference image sources:`);
  console.log(`  - referenceImageAnalysis.imageUrl: ${request.referenceImageAnalysis?.imageUrl?.substring(0, 60) || 'NONE'}`);
  console.log(`  - request.referenceImageUrl: ${request.referenceImageUrl?.substring(0, 60) || 'NONE'}`);
  console.log(`  - identityBible.originalReferenceUrl: ${state.identityBible?.originalReferenceUrl?.substring(0, 60) || 'NONE'}`);
  console.log(`  - SELECTED: ${referenceImageUrl?.substring(0, 60) || 'NONE'}`);
  
  // CRITICAL: If no reference image, try to fetch from project record
  if (!referenceImageUrl) {
    try {
      const { data: projectRefData } = await supabase
        .from('movie_projects')
        .select('pro_features_data, scene_images')
        .eq('id', state.projectId)
        .single();
      
      // Try multiple sources in priority order - ORIGINAL UPLOADED IMAGE FIRST
      const possibleRefs = [
        projectRefData?.pro_features_data?.referenceAnalysis?.imageUrl, // FIRST: Original uploaded
        projectRefData?.pro_features_data?.goldenFrameData?.goldenFrameUrl,
        projectRefData?.pro_features_data?.identityBible?.originalReferenceUrl,
        projectRefData?.pro_features_data?.masterSceneAnchor?.frameUrl,
        projectRefData?.scene_images?.[0]?.imageUrl,
      ].filter(Boolean);
      
      if (possibleRefs.length > 0) {
        referenceImageUrl = possibleRefs[0];
        console.log(`[Hollywood] ✓ RECOVERED referenceImageUrl from project record: ${referenceImageUrl.substring(0, 60)}...`);
      }
    } catch (refErr) {
      console.warn(`[Hollywood] Failed to fetch reference image from project:`, refErr);
    }
  }
  
  // Priority: explicit reference > scene image for clip 1
  if (!referenceImageUrl && sceneImageLookup[0]) {
    referenceImageUrl = sceneImageLookup[0];
    console.log(`[Hollywood] Using scene image 1 as Clip 1 starting frame`);
  }
  
  // CRITICAL: Store referenceImageUrl in sceneImageLookup as ultimate fallback
  if (referenceImageUrl && Object.keys(sceneImageLookup).length === 0) {
    for (let i = 0; i < clips.length; i++) {
      sceneImageLookup[i] = referenceImageUrl;
    }
    console.log(`[Hollywood] Using referenceImageUrl as universal fallback for all clips`);
  }
  
  // CRITICAL: Clip 1 MUST have a starting image for visual continuity
  if (!referenceImageUrl) {
    console.error(`[Hollywood] ⚠️ CRITICAL: No starting image for Clip 1! Frame chaining will be suboptimal.`);
    console.error(`[Hollywood] Generate scene images first or provide a reference image.`);
  } else {
    console.log(`[Hollywood] ✓ Clip 1 starting frame: ${referenceImageUrl.substring(0, 60)}...`);
    // Ensure referenceImageUrl is in sceneImageLookup[0] as the ultimate fallback
    if (!sceneImageLookup[0]) {
      sceneImageLookup[0] = referenceImageUrl;
    }
  }
  
  console.log(`[Hollywood] Scene image fallbacks: ${Object.keys(sceneImageLookup).length} clips covered`);
  
  console.log(`[Hollywood] Generating ${clips.length} clips with BULLETPROOF frame chaining...`);
  
  // =====================================================
  // PREFLIGHT VALIDATION: Ensure all required resources exist
  // =====================================================
  const preflightWarnings: string[] = [];
  
  // Check scene images coverage
  const sceneImageCoverage = Object.keys(sceneImageLookup).length;
  if (sceneImageCoverage === 0) {
    preflightWarnings.push('No scene images available - frame extraction failures may break continuity');
    console.warn(`[Hollywood] ⚠️ PREFLIGHT WARNING: No scene images for fallback`);
  } else if (sceneImageCoverage < clips.length) {
    preflightWarnings.push(`Only ${sceneImageCoverage}/${clips.length} scene images - some clips lack fallback`);
    console.warn(`[Hollywood] ⚠️ PREFLIGHT WARNING: Incomplete scene image coverage (${sceneImageCoverage}/${clips.length})`);
  }
  
  // =====================================================
  // CRITICAL FIX: Recover identityBible from DB if missing from state
  // This prevents CHARACTER IDENTITY LOCK from being empty in later clips
  // =====================================================
  if (!state.identityBible?.characterIdentity && !state.identityBible?.consistencyPrompt) {
    console.warn(`[Hollywood] ⚠️ identityBible missing from state, attempting DB recovery...`);
    try {
      const { data: identityData } = await supabase
        .from('movie_projects')
        .select('pro_features_data')
        .eq('id', state.projectId)
        .single();
      
      const dbIdentityBible = identityData?.pro_features_data?.identityBible;
      const dbExtractedCharacters = identityData?.pro_features_data?.extractedCharacters;
      const dbReferenceAnalysis = identityData?.pro_features_data?.referenceAnalysis;
      
      if (dbIdentityBible?.characterIdentity || dbIdentityBible?.consistencyPrompt) {
        state.identityBible = dbIdentityBible;
        console.log(`[Hollywood] ✓ RECOVERED identityBible from DB:`);
        console.log(`  - characterIdentity: ${dbIdentityBible.characterIdentity ? 'YES' : 'NO'}`);
        console.log(`  - consistencyPrompt: ${dbIdentityBible.consistencyPrompt?.substring(0, 50) || 'NONE'}...`);
        console.log(`  - consistencyAnchors: ${dbIdentityBible.consistencyAnchors?.length || 0}`);
      }
      
      if (dbExtractedCharacters?.length && !state.extractedCharacters?.length) {
        state.extractedCharacters = dbExtractedCharacters;
        console.log(`[Hollywood] ✓ RECOVERED ${dbExtractedCharacters.length} extractedCharacters from DB`);
      }
      
      if (dbReferenceAnalysis && !state.referenceAnalysis) {
        state.referenceAnalysis = dbReferenceAnalysis;
        console.log(`[Hollywood] ✓ RECOVERED referenceAnalysis from DB`);
      }
    } catch (recoverErr) {
      console.error(`[Hollywood] Failed to recover identity data from DB:`, recoverErr);
    }
  }
  
  // Check identity bible (AFTER recovery attempt)
  if (!state.identityBible?.characterIdentity && !state.identityBible?.consistencyPrompt) {
    preflightWarnings.push('No identity bible - character may drift across clips');
    console.warn(`[Hollywood] ⚠️ PREFLIGHT WARNING: No identity bible for character consistency`);
  }
  
  // Check reference image
  if (!referenceImageUrl && sceneImageCoverage === 0) {
    preflightWarnings.push('No reference image AND no scene images - visual consistency will be very limited');
    console.error(`[Hollywood] ⚠️ PREFLIGHT CRITICAL: No visual reference available!`);
  }
  
  // Log preflight summary
  if (preflightWarnings.length > 0) {
    console.log(`[Hollywood] PREFLIGHT WARNINGS (${preflightWarnings.length}): ${preflightWarnings.join('; ')}`);
    // Store warnings in project for debugging
    await supabase
      .from('movie_projects')
      .update({ 
        pending_video_tasks: {
          ...((await supabase.from('movie_projects').select('pending_video_tasks').eq('id', state.projectId).single()).data?.pending_video_tasks || {}),
          preflightWarnings,
          preflightAt: new Date().toISOString(),
        }
      })
      .eq('id', state.projectId);
  } else {
    console.log(`[Hollywood] ✓ PREFLIGHT PASSED: All resources available`);
  }
  
  // Check for checkpoint - resume from last completed clip
  const { data: checkpoint } = await supabase
    .rpc('get_generation_checkpoint', { p_project_id: state.projectId });
  
  let startIndex = 0;
  // BULLETPROOF: Initialize previousLastFrameUrl with best available fallback
  // Priority: checkpoint frame > scene image > reference image > undefined
  let previousLastFrameUrl: string | undefined = referenceImageUrl || sceneImageLookup[0] || undefined;
  let previousMotionVectors: { 
    endVelocity?: string; 
    endDirection?: string; 
    cameraMomentum?: string;
    continuityPrompt?: string;
    actionContinuity?: string;
  } | undefined;
  
  // =====================================================
  // CIRCUIT BREAKER: Track consecutive failures to detect service degradation
  // =====================================================
  let consecutiveFailures = 0;
  let consecutiveFrameExtractionFailures = 0;
  const CIRCUIT_BREAKER_THRESHOLD = 3; // After 3 consecutive failures, halt pipeline
  const FRAME_EXTRACTION_CIRCUIT_THRESHOLD = 3; // After 3 frame failures, use fallback-only mode
  let frameExtractionCircuitOpen = false;
  let circuitBreakerOpen = false;
  
  // =====================================================
  // RETRY BUDGET: Prevent infinite retry loops
  // =====================================================
  const tierLimits = (request as any)._tierLimits || { maxRetries: 1 };
  let totalRetriesUsed = 0;
  const MAX_TOTAL_RETRIES = clips.length * (tierLimits.maxRetries + 1);
  const clipRetryCount: Map<number, number> = new Map();
  
  // =====================================================
  // DEAD LETTER QUEUE: Track failed clips for potential recovery
  // =====================================================
  const deadLetterQueue: Array<{
    clipIndex: number;
    error: string;
    errorCategory: string;
    attempts: number;
    lastAttemptAt: number;
    recoverable: boolean;
  }> = [];
  
  if (checkpoint && checkpoint.length > 0 && checkpoint[0].last_completed_index >= 0) {
    startIndex = checkpoint[0].last_completed_index + 1;
    
    // Use checkpoint's last frame, fall back to scene image if needed
    if (checkpoint[0].last_frame_url) {
      previousLastFrameUrl = checkpoint[0].last_frame_url;
      console.log(`[Hollywood] Resuming from clip ${startIndex + 1}, using REAL last frame: ${previousLastFrameUrl?.substring(0, 50)}...`);
    } else {
      // WARNING: No frame from checkpoint - try multiple fallbacks
      const fallbackSources = [
        sceneImageLookup[startIndex - 1],
        sceneImageLookup[startIndex],
        sceneImageLookup[0],
        referenceImageUrl,
      ].filter(Boolean);
      
      if (fallbackSources.length > 0) {
        previousLastFrameUrl = fallbackSources[0];
        console.warn(`[Hollywood] ⚠️ Checkpoint missing frame, using fallback: ${previousLastFrameUrl?.substring(0, 50)}...`);
      } else {
        console.error(`[Hollywood] ⚠️ CRITICAL: No frame available for resume! Will attempt text-only generation.`);
        previousLastFrameUrl = undefined;
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
      
      // BULLETPROOF: Try to get frame from last completed clip if checkpoint was empty
      if (!checkpoint[0].last_frame_url && existingClips.length > 0) {
        const lastClip = existingClips[existingClips.length - 1];
        if (lastClip.last_frame_url) {
          previousLastFrameUrl = lastClip.last_frame_url;
          console.log(`[Hollywood] ✓ Recovered frame from last completed clip: ${previousLastFrameUrl?.substring(0, 50)}...`);
        }
      }
      
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
  // CRITICAL: Restore from DB on pipeline resume for consistency
  // =====================================================
  let accumulatedAnchors: any[] = [];
  let masterSceneAnchor: any = null;
  
  // =====================================================
  // CRITICAL FIX: Rebuild accumulatedAnchors from completed clips on resume
  // Without this, clips 2+ on resume have 0 anchors
  // =====================================================
  if (startIndex > 0) {
    try {
      // Fetch pro_features_data which contains scene anchors
      const { data: projectData } = await supabase
        .from('movie_projects')
        .select('pro_features_data')
        .eq('id', state.projectId)
        .single();
      
      // Restore accumulated anchors from persisted data
      if (projectData?.pro_features_data?.accumulatedAnchors) {
        accumulatedAnchors = projectData.pro_features_data.accumulatedAnchors;
        console.log(`[Hollywood] ✓ RESTORED accumulatedAnchors from DB: ${accumulatedAnchors.length} anchors`);
      } else if (projectData?.pro_features_data?.sceneAnchors?.masterPrompt) {
        // Fallback: rebuild minimal anchor from master prompt
        accumulatedAnchors = [{
          masterConsistencyPrompt: projectData.pro_features_data.sceneAnchors.masterPrompt,
          lighting: { timeOfDay: projectData.pro_features_data.sceneAnchors.masterLighting },
          colorPalette: { temperature: projectData.pro_features_data.sceneAnchors.masterColorTemp },
        }];
        console.log(`[Hollywood] ✓ REBUILT accumulatedAnchors from sceneAnchors summary`);
      }
      
      // Also restore masterSceneAnchor if we have anchors
      if (accumulatedAnchors.length > 0 && !masterSceneAnchor) {
        masterSceneAnchor = accumulatedAnchors[0];
        console.log(`[Hollywood] ✓ Set masterSceneAnchor from first accumulated anchor`);
      }
    } catch (restoreErr) {
      console.warn(`[Hollywood] Could not restore accumulatedAnchors from DB:`, restoreErr);
    }
  }
  
  // =====================================================
  // CONTINUITY MANIFEST TRACKING: AI-extracted comprehensive continuity data
  // Tracks: spatial position, lighting, props, emotional state, action momentum
  // =====================================================
  let previousContinuityManifest: any = null;
  
  // =====================================================
  // COMPREHENSIVE GOLDEN FRAME DATA: Captured from Clip 1
  // 12-dimensional anchor matrix for maximum character consistency
  // =====================================================
  let goldenFrameData: {
    characterSnapshot?: string;
    goldenAnchors?: string[];
    goldenFrameUrl?: string;
    comprehensiveAnchors?: {
      facialGeometry?: any;
      skin?: any;
      hair?: any;
      body?: any;
      wardrobe?: any;
      accessories?: any;
      movement?: any;
      expression?: any;
      lightingResponse?: any;
      colorFingerprint?: any;
      scale?: any;
      uniqueIdentifiers?: any;
    };
  } | null = null;
  
  // RESTORE masterSceneAnchor from DB on resume (CRITICAL for consistency)
  if (state.identityBible?.masterSceneAnchor) {
    masterSceneAnchor = state.identityBible.masterSceneAnchor;
    console.log(`[Hollywood] ✓ RESTORED masterSceneAnchor from identityBible: ${masterSceneAnchor.masterConsistencyPrompt?.substring(0, 100)}...`);
  } else {
    // Try to restore from pro_features_data (DB persistence)
    try {
      const { data: projectData } = await supabase
        .from('movie_projects')
        .select('pro_features_data')
        .eq('id', state.projectId)
        .single();
      
      if (projectData?.pro_features_data?.masterSceneAnchor) {
        masterSceneAnchor = projectData.pro_features_data.masterSceneAnchor;
        // Also restore to state for downstream use
        if (!state.identityBible) state.identityBible = {};
        state.identityBible.masterSceneAnchor = masterSceneAnchor;
        console.log(`[Hollywood] ✓ RESTORED masterSceneAnchor from DB: ${masterSceneAnchor.masterConsistencyPrompt?.substring(0, 100)}...`);
      }
      
      // =====================================================
      // CRITICAL FIX: Restore goldenFrameData from DB on resume
      // Without this, 12-dimensional anchors are lost when resuming
      // =====================================================
      if (projectData?.pro_features_data?.goldenFrameData) {
        goldenFrameData = projectData.pro_features_data.goldenFrameData;
        console.log(`[Hollywood] ✓ RESTORED goldenFrameData from DB:`);
        console.log(`[Hollywood]   Character snapshot: ${goldenFrameData?.characterSnapshot?.substring(0, 100)}...`);
        console.log(`[Hollywood]   Golden anchors: ${goldenFrameData?.goldenAnchors?.length || 0}`);
        console.log(`[Hollywood]   Comprehensive anchors: ${Object.keys(goldenFrameData?.comprehensiveAnchors || {}).length} dimensions`);
        console.log(`[Hollywood]   Frame URL: ${goldenFrameData?.goldenFrameUrl?.substring(0, 50)}...`);
      }
      
      // =====================================================
      // CRITICAL FIX: Restore identityBible from DB on resume
      // Without this, character identity is lost and anchors show 0%
      // =====================================================
      if (projectData?.pro_features_data?.identityBible && !state.identityBible) {
        state.identityBible = projectData.pro_features_data.identityBible;
        console.log(`[Hollywood] ✓ RESTORED identityBible from DB:`);
        console.log(`[Hollywood]   Consistency prompt: ${state.identityBible?.consistencyPrompt?.substring(0, 100)}...`);
        console.log(`[Hollywood]   Character identity: ${state.identityBible?.characterIdentity?.description?.substring(0, 100) || 'none'}...`);
        console.log(`[Hollywood]   Distinctive markers: ${state.identityBible?.characterIdentity?.distinctiveMarkers?.length || 0}`);
      }
    } catch (restoreErr) {
      console.warn(`[Hollywood] Could not restore masterSceneAnchor/goldenFrameData/identityBible from DB:`, restoreErr);
    }
  }
  
  // =====================================================
  // CRITICAL FALLBACK: If goldenFrameData is still null on resume,
  // rebuild it from identityBible AND fetch clip 1's actual frame URL
  // This prevents 0% anchor strength for later clips on resume
  // =====================================================
  if (!goldenFrameData && startIndex > 0 && state.identityBible) {
    console.log(`[Hollywood] ⚠️ goldenFrameData missing on resume - REBUILDING with REAL frame URL...`);
    
    // CRITICAL: Fetch the actual last_frame_url from clip 1 in the database
    let clip1FrameUrl: string | undefined = undefined;
    try {
      const { data: clip1Data } = await supabase
        .from('video_clips')
        .select('last_frame_url, video_url')
        .eq('project_id', state.projectId)
        .eq('shot_index', 0)
        .eq('status', 'completed')
        .single();
      
      if (clip1Data?.last_frame_url) {
        clip1FrameUrl = clip1Data.last_frame_url;
        console.log(`[Hollywood] ✓ Found clip 1 frame URL from DB: ${clip1FrameUrl?.substring(0, 60)}...`);
      } else {
        console.warn(`[Hollywood] Clip 1 has no last_frame_url in DB`);
      }
    } catch (fetchErr) {
      console.warn(`[Hollywood] Failed to fetch clip 1 frame URL:`, fetchErr);
    }
    
    const ci = state.identityBible.characterIdentity;
    const nfa = state.identityBible.nonFacialAnchors;
    const styleA = state.identityBible.styleAnchor;
    
    // Build comprehensive anchors from identity bible data
    const comprehensiveAnchors: any = {
      facialGeometry: {},
      skin: {},
      hair: {},
      body: {},
      wardrobe: {},
      accessories: {},
      movement: {},
      expression: {},
      lightingResponse: {},
      colorFingerprint: {},
      scale: {},
      uniqueIdentifiers: {},
    };
    
    // Extract from character identity
    if (ci) {
      if (ci.facialFeatures) {
        comprehensiveAnchors.facialGeometry = { facialSymmetry: ci.facialFeatures };
      }
      if (ci.bodyType) {
        comprehensiveAnchors.body = { build: ci.bodyType, posture: 'as shown', silhouette: ci.bodyType };
      }
      if (ci.clothing) {
        comprehensiveAnchors.wardrobe = { topGarment: ci.clothing };
      }
      if (ci.distinctiveMarkers?.length) {
        comprehensiveAnchors.uniqueIdentifiers = {
          mostDistinctiveFeature: ci.distinctiveMarkers[0],
          absoluteNonNegotiables: ci.distinctiveMarkers,
          quickCheckpoints: ci.distinctiveMarkers.slice(0, 5),
          driftWarningZones: ['face', 'hair', 'clothing', 'skin tone', 'body proportions'],
        };
      }
    }
    
    // Extract from non-facial anchors
    if (nfa) {
      if (nfa.bodyType) comprehensiveAnchors.body.build = nfa.bodyType;
      if (nfa.clothingSignature) comprehensiveAnchors.wardrobe.fabricTexture = nfa.clothingSignature;
      if (nfa.hairFromBehind) comprehensiveAnchors.hair = { hairStyle: nfa.hairFromBehind };
      if (nfa.gait) comprehensiveAnchors.movement = { walkingGait: nfa.gait };
      if (nfa.posture) comprehensiveAnchors.movement = { ...comprehensiveAnchors.movement, defaultStance: nfa.posture };
    }
    
    // Build character description parts
    const characterParts: string[] = [];
    if (ci?.description) characterParts.push(ci.description);
    if (ci?.facialFeatures) characterParts.push(`Face: ${ci.facialFeatures}`);
    if (ci?.bodyType) characterParts.push(`Body: ${ci.bodyType}`);
    if (ci?.clothing) characterParts.push(`Clothing: ${ci.clothing}`);
    
    goldenFrameData = {
      characterSnapshot: characterParts.join('. ') || ci?.description || 'Character as established in clip 1',
      goldenAnchors: [
        ...(state.identityBible?.consistencyAnchors || []),
        ...(ci?.distinctiveMarkers || []),
        ...(styleA?.anchors || []),
      ].slice(0, 15),
      // CRITICAL: Use the REAL frame URL from clip 1, not just identity bible URLs
      goldenFrameUrl: clip1FrameUrl || (state.identityBible as any)?.frontViewUrl || (state.identityBible as any)?.originalImageUrl || undefined,
      comprehensiveAnchors,
    };
    
    // Count filled fields
    let filledFields = 0;
    Object.values(comprehensiveAnchors).forEach((section: any) => {
      if (typeof section === 'object' && section !== null) {
        filledFields += Object.keys(section).length;
      }
    });
    
    console.log(`[Hollywood] ✓ REBUILT goldenFrameData from identityBible + DB:`);
    console.log(`[Hollywood]   Character snapshot: ${goldenFrameData.characterSnapshot?.substring(0, 100)}...`);
    console.log(`[Hollywood]   Golden anchors: ${goldenFrameData.goldenAnchors?.length || 0}`);
    console.log(`[Hollywood]   Comprehensive anchors: ${filledFields} fields across 12 dimensions`);
    console.log(`[Hollywood]   Frame URL: ${goldenFrameData.goldenFrameUrl?.substring(0, 50) || 'none'}...`);
    console.log(`[Hollywood]   Frame source: ${clip1FrameUrl ? 'clip 1 DB record' : 'identity bible fallback'}`);
    
    // Persist the rebuilt goldenFrameData to DB for future resumes
    if (goldenFrameData.goldenFrameUrl) {
      try {
        const { data: currentProject } = await supabase
          .from('movie_projects')
          .select('pro_features_data')
          .eq('id', state.projectId)
          .single();
        
        const updatedProFeatures = {
          ...(currentProject?.pro_features_data || {}),
          goldenFrameData,
          goldenFrameRebuiltAt: new Date().toISOString(),
        };
        
        await supabase
          .from('movie_projects')
          .update({
            pro_features_data: updatedProFeatures,
            updated_at: new Date().toISOString(),
          })
          .eq('id', state.projectId);
        
        console.log(`[Hollywood] ✓ PERSISTED rebuilt goldenFrameData to DB`);
      } catch (persistErr) {
        console.warn(`[Hollywood] Failed to persist rebuilt goldenFrameData:`, persistErr);
      }
    }
  }
  
  // =====================================================
  // CALLBACK-BASED CLIP GENERATION (PREVENTS TIMEOUT)
  // Instead of looping through all clips in one function call,
  // we generate only the first pending clip and let callback chaining handle the rest.
  // This prevents edge function timeout by limiting each invocation to ~90s max.
  // =====================================================
  
  // Generate clips with callback chaining - each clip triggers the next via continue-production
  for (let i = startIndex; i < clips.length; i++) {
    const clip = clips[i];
    const progressPercent = 75 + Math.floor((i / clips.length) * 15);
    
    console.log(`[Hollywood] Generating clip ${i + 1}/${clips.length} (callback chaining enabled)...`);
    
    await updateProjectProgress(supabase, state.projectId, 'production', progressPercent, {
      clipsCompleted: i,
      clipCount: clips.length,
    });
    
    // =====================================================
    // CONTINUITY ORCHESTRATOR: Enhance prompt with previous clip data
    // This provides: frame handoff, motion chaining, color continuity
    // =====================================================
    let orchestratedEnhancements: {
      enhancedPrompt?: string;
      motionInjection?: { entryMotion: string; entryCameraHint: string };
      recommendedStartImage?: string;
    } = {};
    
    if (i > 0 && previousLastFrameUrl) {
      try {
        console.log(`[Hollywood] Calling continuity-orchestrator for clip ${i + 1}...`);
        const orchestratorResult = await callEdgeFunction('continuity-orchestrator', {
          projectId: state.projectId,
          userId: request.userId,
          mode: 'enhance-clip',
          clipIndex: i,
          currentClipPrompt: clip.prompt,
          previousClipData: {
            videoUrl: state.production?.clipResults?.[i - 1]?.videoUrl || '',
            lastFrameUrl: previousLastFrameUrl,
            motionVectors: previousMotionVectors ? {
              exitMotion: previousMotionVectors.endVelocity || previousMotionVectors.continuityPrompt,
              dominantDirection: previousMotionVectors.endDirection,
              cameraMovement: previousMotionVectors.cameraMomentum ? { type: previousMotionVectors.cameraMomentum, direction: '', speed: 0.5 } : undefined,
              continuityPrompt: previousMotionVectors.continuityPrompt,
            } : undefined,
          },
          config: {
            consistencyThreshold: 70,
            enableMotionChaining: true,
          },
        });
        
        if (orchestratorResult.success && orchestratorResult.enhancedPrompt) {
          orchestratedEnhancements = {
            enhancedPrompt: orchestratorResult.enhancedPrompt.enhancedPrompt,
            motionInjection: orchestratorResult.motionInjection,
            recommendedStartImage: orchestratorResult.recommendedStartImage,
          };
          console.log(`[Hollywood] Continuity orchestrator enhanced clip ${i + 1} prompt with ${Object.keys(orchestratorResult.enhancedPrompt.injections || {}).length} injections`);
        }
      } catch (orchErr) {
        console.warn(`[Hollywood] Continuity orchestrator failed for clip ${i + 1}, falling back to standard logic:`, orchErr);
      }
    }
    
    // =====================================================
    // SCRIPT ADAPTATION: Visual continuity takes precedence over script
    // The script guides the story, but the visual state is the source of truth
    // =====================================================
    let finalPrompt = '';
    
    // STEP 1: Use orchestrated prompt if available, else build manually
    if (orchestratedEnhancements.enhancedPrompt) {
      // Use the continuity orchestrator's enhanced prompt
      finalPrompt = orchestratedEnhancements.enhancedPrompt;
      console.log(`[Hollywood] Clip ${i + 1}: Using orchestrator-enhanced prompt`);
    } else if (i > 0) {
      // Fallback: Build visual continuity manually (original logic)
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
    
    // Inject motion hints from orchestrator if available
    if (orchestratedEnhancements.motionInjection) {
      const motion = orchestratedEnhancements.motionInjection;
      if (motion.entryMotion && !finalPrompt.includes('MOTION')) {
        finalPrompt = `[ENTRY MOTION: ${motion.entryMotion}${motion.entryCameraHint ? `, camera ${motion.entryCameraHint}` : ''}]\n${finalPrompt}`;
      }
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
          // =====================================================
          // THE LAW: CLIP 2+ MUST USE PREVIOUS CLIP'S LAST FRAME
          // NO EXCEPTIONS. NO FALLBACKS. FAILURE IS FATAL.
          // =====================================================
          if (previousLastFrameUrl && isValidImageUrl(previousLastFrameUrl)) {
            useStartImage = previousLastFrameUrl;
            console.log(`[Hollywood] Clip ${i + 1}: FRAME-CHAINED from clip ${i}'s last frame: ${previousLastFrameUrl?.substring(0, 60)}...`);
          } else {
            // FATAL ERROR: Cannot proceed without frame continuity
            const errorDetails = previousLastFrameUrl 
              ? `Invalid URL (video file or corrupted): ${previousLastFrameUrl.substring(0, 100)}`
              : 'No last frame URL extracted from previous clip';
            
            console.error(`[Hollywood] ❌ STRICT_CONTINUITY_FAILURE: Clip ${i + 1} CANNOT proceed without valid frame from clip ${i}`);
            console.error(`[Hollywood] Reason: ${errorDetails}`);
            console.error(`[Hollywood] THE LAW: Each clip MUST use previous clip's last frame. No exceptions.`);
            
            // Update project with fatal error
            await supabase.from('movie_projects').update({
              status: 'failed',
              last_error: `STRICT_CONTINUITY_FAILURE: Clip ${i + 1} requires valid last frame from clip ${i}. ${errorDetails}`,
              pipeline_stage: 'failed',
              updated_at: new Date().toISOString(),
            }).eq('id', state.projectId);
            
            throw new Error(
              `STRICT_CONTINUITY_FAILURE: The Law requires Clip ${i + 1} to use Clip ${i}'s last frame. ` +
              `Frame extraction failed or returned invalid URL. ${errorDetails}. ` +
              `Pipeline halted to preserve visual continuity.`
            );
          }
        }
        
        const clipResult = await callEdgeFunction('generate-single-clip', {
          userId: request.userId,
          projectId: state.projectId,
          clipIndex: i,
          prompt: finalPrompt,
          totalClips: clips.length,
          startImageUrl: useStartImage, // Last frame for MOTION continuity
          previousMotionVectors,
          // NEW: Pass previous shot's continuity manifest for comprehensive consistency
          previousContinuityManifest: i > 0 ? previousContinuityManifest : undefined,
          // NEW: Pass golden frame data from clip 1 to prevent character decay
          goldenFrameData: i > 0 ? goldenFrameData : undefined,
          // CRITICAL FIX: Pass identityBible with characterDescription for verify-character-identity
          identityBible: state.identityBible ? {
            ...state.identityBible,
            characterDescription: state.identityBible.consistencyPrompt 
              || state.identityBible.characterIdentity?.description
              || (state.extractedCharacters?.[0] ? 
                  `${state.extractedCharacters[0].name}: ${state.extractedCharacters[0].appearance}` : ''),
          } : undefined,
          colorGrading: request.colorGrading || 'cinematic',
          qualityTier: request.qualityTier || 'standard',
          referenceImageUrl, // Still passed for character identity reference
          // CRITICAL FIX: Pass scene image for fallback when frame extraction fails
          sceneImageUrl: sceneImageLookup[i] || sceneImageLookup[0],
          isRetry,
          retryAttempt: attempt,
          // Pass scene context for continuous action flow
          sceneContext: clip.sceneContext,
          // ENHANCED: Pass ALL accumulated anchors with master anchor first
          // This ensures Clip 1's visual DNA is used as the SOURCE OF TRUTH
          // for color/lighting, preventing gradual degradation
          accumulatedAnchors: accumulatedAnchors.length > 0 
            ? [
                // Master anchor (from Clip 1) - always include for color/lighting lock
                { 
                  ...accumulatedAnchors[0], 
                  masterConsistencyPrompt: masterSceneAnchor?.masterConsistencyPrompt 
                },
                // Recent anchors for environment evolution (last 2)
                ...accumulatedAnchors.slice(-2)
              ].filter(Boolean)
            : [],
          // =====================================================
          // CALLBACK CHAINING: Enable automatic continuation after this clip
          // This prevents edge function timeouts by generating one clip per invocation
          // =====================================================
          triggerNextClip: true,
          pipelineContext: {
            // CRITICAL FIX: Pass identityBible with characterDescription to pipeline context
            identityBible: state.identityBible ? {
              ...state.identityBible,
              // Ensure characterDescription is always present for verify-character-identity
              characterDescription: state.identityBible.consistencyPrompt 
                || state.identityBible.characterIdentity?.description
                || (state.extractedCharacters?.[0] ? 
                    `${state.extractedCharacters[0].name}: ${state.extractedCharacters[0].appearance}` : ''),
            } : undefined,
            masterSceneAnchor,
            goldenFrameData,
            accumulatedAnchors,
            referenceImageUrl,
            colorGrading: request.colorGrading || 'cinematic',
            qualityTier: request.qualityTier || 'standard',
            sceneImageLookup,
            tierLimits: (request as any)._tierLimits || { maxRetries: 1 },
            // CRITICAL FIX: Include extractedCharacters for multi-character scenes
            extractedCharacters: state.extractedCharacters || [],
          },
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
      // BULLETPROOF FRAME EXTRACTION WITH CIRCUIT BREAKER + EXPONENTIAL BACKOFF
      // =====================================================
      let frameForAnalysis = result.lastFrameUrl;
      
      // Get scene image for this clip as fallback (guaranteed to exist if assets were generated)
      const sceneImageFallback = sceneImageLookup[i] || sceneImageLookup[i - 1] || sceneImageLookup[0] || referenceImageUrl;
      
      // CIRCUIT BREAKER: Skip frame extraction if too many failures
      if (frameExtractionCircuitOpen) {
        console.warn(`[Hollywood] ⚡ Circuit breaker OPEN - using fallback directly`);
        result.lastFrameUrl = sceneImageFallback;
        frameForAnalysis = sceneImageFallback;
      } else {
        // RETRY WITH EXPONENTIAL BACKOFF for rate limits
        const MAX_FRAME_RETRIES = 3;
        let frameExtractionSuccess = false;
        
        for (let frameAttempt = 0; frameAttempt < MAX_FRAME_RETRIES && !frameExtractionSuccess; frameAttempt++) {
          try {
            // Exponential backoff: 0ms, 2s, 4s
            if (frameAttempt > 0) {
              const backoffMs = 2000 * Math.pow(2, frameAttempt - 1);
              console.log(`[Hollywood] Frame extraction retry ${frameAttempt + 1}/${MAX_FRAME_RETRIES}, waiting ${backoffMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
            
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
                throw new Error('Invalid frame URL - got video instead of image');
              } else {
                frameForAnalysis = frameUrl;
                result.lastFrameUrl = frameUrl;
                frameExtractionSuccess = true;
                consecutiveFrameExtractionFailures = 0; // Reset circuit breaker
                console.log(`[Hollywood] ✓ Frame extracted via ${frameResult.method}: ${frameForAnalysis.substring(0, 80)}...`);
              }
            } else {
              const errorMsg = frameResult.error || 'unknown error';
              console.warn(`[Hollywood] Frame extraction attempt ${frameAttempt + 1} failed: ${errorMsg}`);
              
              // Check if it's a rate limit error - worth retrying
              if (errorMsg.toLowerCase().includes('rate') || errorMsg.toLowerCase().includes('429')) {
                console.log(`[Hollywood] Rate limit detected, will retry with backoff...`);
                continue;
              }
              
              // Not a rate limit - use fallback immediately
              break;
            }
          } catch (frameErr) {
            const errorMsg = frameErr instanceof Error ? frameErr.message : 'Unknown error';
            console.warn(`[Hollywood] Frame extraction attempt ${frameAttempt + 1} error: ${errorMsg}`);
            
            // Check for rate limit errors
            if (errorMsg.toLowerCase().includes('rate') || errorMsg.toLowerCase().includes('429') || errorMsg.toLowerCase().includes('quota')) {
              console.log(`[Hollywood] Rate limit error, will retry with backoff...`);
              continue;
            }
          }
        }
        
        // If all retries failed, use fallback
        if (!frameExtractionSuccess) {
          consecutiveFrameExtractionFailures++;
          console.warn(`[Hollywood] Frame extraction failed after ${MAX_FRAME_RETRIES} attempts. Consecutive failures: ${consecutiveFrameExtractionFailures}`);
          
          // Check circuit breaker threshold
          if (consecutiveFrameExtractionFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            frameExtractionCircuitOpen = true;
            console.error(`[Hollywood] ⚡ CIRCUIT BREAKER TRIGGERED - switching to fallback-only mode for remaining clips`);
          }
          
          // Use fallback chain
          if (sceneImageFallback) {
            result.lastFrameUrl = sceneImageFallback;
            frameForAnalysis = sceneImageFallback;
            console.log(`[Hollywood] Using fallback: ${sceneImageFallback.substring(0, 60)}...`);
          } else {
            console.error(`[Hollywood] ⚠️ CRITICAL: No fallback available! Frame chain broken.`);
            result.lastFrameUrl = previousLastFrameUrl; // Use previous frame as last resort
            frameForAnalysis = previousLastFrameUrl;
          }
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
                previousContinuityManifest: i > 0 ? previousContinuityManifest : undefined,
                goldenFrameData: i > 0 ? goldenFrameData : undefined,
                identityBible: state.identityBible,
                colorGrading: request.colorGrading || 'cinematic',
                qualityTier: request.qualityTier || 'standard',
                referenceImageUrl,
                isRetry: true,
                sceneContext: clip.sceneContext,
                // CRITICAL: Include accumulated anchors for visual consistency in retries
                accumulatedAnchors: accumulatedAnchors.length > 0 
                  ? [
                      { ...accumulatedAnchors[0], masterConsistencyPrompt: masterSceneAnchor?.masterConsistencyPrompt },
                      ...accumulatedAnchors.slice(-2)
                    ].filter(Boolean)
                  : [],
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
              
              // =====================================================
              // CRITICAL FIX: Populate consistencyAnchors from scene anchor
              // Without this, Clip 2+ receives consistencyAnchorsCount: 0
              // causing character identity drift
              // =====================================================
              const sceneBasedAnchors: string[] = [];
              
              // Extract visual consistency anchors from scene DNA
              if (newAnchor.lighting?.promptFragment) {
                sceneBasedAnchors.push(`LIGHTING: ${newAnchor.lighting.promptFragment}`);
              }
              if (newAnchor.colorPalette?.promptFragment) {
                sceneBasedAnchors.push(`COLOR: ${newAnchor.colorPalette.promptFragment}`);
              }
              if (newAnchor.depthCues?.promptFragment) {
                sceneBasedAnchors.push(`DEPTH: ${newAnchor.depthCues.promptFragment}`);
              }
              if (newAnchor.keyObjects?.settingDescription) {
                sceneBasedAnchors.push(`ENVIRONMENT: ${newAnchor.keyObjects.settingDescription}`);
              }
              
              // Merge into identityBible.consistencyAnchors
              const existingAnchors = state.identityBible.consistencyAnchors || [];
              state.identityBible.consistencyAnchors = [
                ...existingAnchors,
                ...sceneBasedAnchors,
              ];
              
              console.log(`[Hollywood] ✓ CRITICAL: Populated ${sceneBasedAnchors.length} consistencyAnchors from scene DNA`);
              console.log(`[Hollywood]   Total consistencyAnchors: ${state.identityBible.consistencyAnchors.length}`);
              
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
            
            // CRITICAL: Persist masterSceneAnchor to DB for pipeline resume
            // This ensures visual consistency is maintained even if pipeline restarts
            try {
              const { data: currentProject } = await supabase
                .from('movie_projects')
                .select('pro_features_data')
                .eq('id', state.projectId)
                .single();
              
              const existingData = currentProject?.pro_features_data || {};
              
              const updatedProData = {
                ...existingData,
                // Full masterSceneAnchor for resume (CRITICAL)
                masterSceneAnchor: masterSceneAnchor,
                // CRITICAL FIX: Persist accumulatedAnchors for resume
                // Without this, clips on resume have 0 anchors
                accumulatedAnchors: accumulatedAnchors.slice(-5), // Keep last 5 for reasonable size
                // Also persist goldenFrameData if available (CRITICAL for character consistency)
                goldenFrameData: goldenFrameData || existingData.goldenFrameData,
                // And identityBible (CRITICAL for resume)
                identityBible: state.identityBible || existingData.identityBible,
                // Summary for debugging/monitoring
                sceneAnchors: {
                  count: accumulatedAnchors.length,
                  masterPrompt: masterSceneAnchor?.masterConsistencyPrompt?.substring(0, 500),
                  masterLighting: masterSceneAnchor?.lighting?.timeOfDay,
                  masterColorTemp: masterSceneAnchor?.colorPalette?.temperature,
                  lastUpdated: new Date().toISOString(),
                },
              };
              
              const { error: anchorUpdateError } = await supabase
                .from('movie_projects')
                .update({
                  pro_features_data: updatedProData,
                })
                .eq('id', state.projectId);
              
              if (anchorUpdateError) {
                console.error(`[Hollywood] ⚠️ Scene anchor persistence FAILED:`, anchorUpdateError);
              } else {
                // VERIFY the save
                const { data: verifyData } = await supabase
                  .from('movie_projects')
                  .select('pro_features_data')
                  .eq('id', state.projectId)
                  .single();
                
                const savedAnchors = verifyData?.pro_features_data?.accumulatedAnchors?.length || 0;
                const savedGolden = verifyData?.pro_features_data?.goldenFrameData ? 'YES' : 'NO';
                const savedIdentity = verifyData?.pro_features_data?.identityBible ? 'YES' : 'NO';
                
                console.log(`[Hollywood] ✓ VERIFIED persistence:`);
                console.log(`[Hollywood]   masterSceneAnchor: YES`);
                console.log(`[Hollywood]   accumulatedAnchors: ${savedAnchors}`);
                console.log(`[Hollywood]   goldenFrameData: ${savedGolden}`);
                console.log(`[Hollywood]   identityBible: ${savedIdentity}`);
              }
            } catch (updateErr) {
              console.warn(`[Hollywood] Failed to persist masterSceneAnchor:`, updateErr);
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
              
              // Premium threshold: 80 for $6/video quality
              if (verification.passed || verification.overallScore >= 80) {
                console.log(`[Hollywood] Character identity verified for clip ${i + 1} (premium threshold: 80)`);
                break;
              } else if (verification.overallScore >= 70 && verification.overallScore < 80) {
                // Borderline case - log warning but try to regenerate
                console.log(`[Hollywood] ⚠️ Borderline identity score ${verification.overallScore}/100 - attempting regeneration for premium quality`);
              }
              
              if (verification.driftDetected && verification.correctivePrompt && identityRetryCount < maxIdentityRetries - 1) {
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
                
                // v3.0: Always use original reference or previous frame - no multi-view images
                const regenerationStartImage = i === 0 ? referenceImageUrl : previousLastFrameUrl;
                console.log(`[Hollywood] Regeneration using ${i === 0 ? 'reference image' : 'previous frame'}`);
                
                const regenResult = await callEdgeFunction('generate-single-clip', {
                  userId: request.userId,
                  projectId: state.projectId,
                  clipIndex: i,
                  prompt: correctedPrompt,
                  totalClips: clips.length,
                  startImageUrl: regenerationStartImage,
                  previousMotionVectors,
                  previousContinuityManifest: i > 0 ? previousContinuityManifest : undefined,
                  goldenFrameData: i > 0 ? goldenFrameData : undefined,
                  identityBible: state.identityBible,
                  colorGrading: request.colorGrading || 'cinematic',
                  qualityTier: request.qualityTier || 'standard',
                  referenceImageUrl,
                  isRetry: true,
                  isIdentityRetry: true,
                  sceneContext: clip.sceneContext,
                  // CRITICAL: Include accumulated anchors for visual consistency in identity retries
                  accumulatedAnchors: accumulatedAnchors.length > 0 
                    ? [
                        { ...accumulatedAnchors[0], masterConsistencyPrompt: masterSceneAnchor?.masterConsistencyPrompt },
                        ...accumulatedAnchors.slice(-2)
                      ].filter(Boolean)
                    : [],
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
      } else if (referenceImageUrl) {
        // CRITICAL FIX: Use referenceImageUrl as ultimate fallback
        previousLastFrameUrl = referenceImageUrl;
        console.warn(`[Hollywood] Using referenceImageUrl as fallback for clip ${i + 2}`);
      } else if (previousLastFrameUrl) {
        // Keep previous frame as last resort
        console.error(`[Hollywood] ⚠️ Keeping stale frame for clip ${i + 2}: ${previousLastFrameUrl?.substring(0, 50)}...`);
      } else {
        console.error(`[Hollywood] ⚠️ CRITICAL: No frame or fallback for clip ${i + 2}! Frame chain broken.`);
      }
    }
    
    // =====================================================
    // BULLETPROOF FRAME PERSISTENCE WITH VERIFICATION
    // Ensures resume operations ALWAYS have frame data
    // =====================================================
    const frameToSave = result.lastFrameUrl || previousLastFrameUrl || sceneImageLookup[i] || sceneImageLookup[0] || referenceImageUrl;
    
    // =====================================================
    // CRITICAL FIX: Save BOTH video_url AND last_frame_url
    // After quality/identity retries, the result object has the FINAL video_url
    // but the DB still has the FIRST video_url - we must update it!
    // =====================================================
    const videoUrlToSave = result.videoUrl;
    
    if (videoUrlToSave) {
      try {
        // Update BOTH video_url and last_frame_url together
        const updateData: Record<string, any> = {
          video_url: videoUrlToSave,
          status: 'completed',
          updated_at: new Date().toISOString(),
        };
        
        if (frameToSave) {
          updateData.last_frame_url = frameToSave;
        }
        
        const { error: updateError } = await supabase
          .from('video_clips')
          .update(updateData)
          .eq('project_id', state.projectId)
          .eq('shot_index', i);
        
        if (updateError) {
          console.error(`[Hollywood] ⚠️ Failed to persist final clip data:`, updateError);
        } else {
          // VERIFY the save was successful
          const { data: verifyData } = await supabase
            .from('video_clips')
            .select('video_url, last_frame_url')
            .eq('project_id', state.projectId)
            .eq('shot_index', i)
            .single();
          
          const videoUrlMatch = verifyData?.video_url === videoUrlToSave;
          const frameUrlMatch = !frameToSave || verifyData?.last_frame_url === frameToSave;
          
          if (videoUrlMatch && frameUrlMatch) {
            console.log(`[Hollywood] ✓ VERIFIED final clip ${i + 1} persisted:`);
            console.log(`[Hollywood]   video_url: ${videoUrlToSave.substring(0, 60)}...`);
            if (frameToSave) {
              console.log(`[Hollywood]   last_frame_url: ${frameToSave.substring(0, 50)}...`);
            }
          } else {
            console.warn(`[Hollywood] ⚠️ Final clip save verification FAILED - retry...`);
            // Retry once
            await supabase
              .from('video_clips')
              .update(updateData)
              .eq('project_id', state.projectId)
              .eq('shot_index', i);
          }
        }
      } catch (dbErr) {
        console.error(`[Hollywood] Failed to persist final clip data:`, dbErr);
      }
    } else if (frameToSave) {
      // No video but have frame - just save frame (edge case)
      try {
        await supabase
          .from('video_clips')
          .update({ last_frame_url: frameToSave })
          .eq('project_id', state.projectId)
          .eq('shot_index', i);
        console.log(`[Hollywood] Saved last_frame_url only (no video_url available)`);
      } catch (dbErr) {
        console.error(`[Hollywood] Failed to persist last_frame_url:`, dbErr);
      }
    } else {
      console.error(`[Hollywood] ⚠️ CRITICAL: No video_url or frame to save for clip ${i + 1}!`);
    }
    
    previousMotionVectors = result.motionVectors;
    
    // Update continuity manifest for next clip (if available from generate-single-clip)
    if (result.continuityManifest) {
      previousContinuityManifest = result.continuityManifest;
      console.log(`[Hollywood] ✓ Continuity manifest updated for clip ${i + 2}: ${result.continuityManifest.criticalAnchors?.length || 0} critical anchors`);
    }
    
    // =====================================================
    // COMPREHENSIVE GOLDEN FRAME DATA CAPTURE FROM CLIP 1
    // 12-dimensional anchor matrix for maximum character consistency
    // CRITICAL FIX v2: Create goldenFrameData ALWAYS after clip 1
    // Even if frame extraction fails, use scene image as visual anchor
    // =====================================================
    if (i === 0) {
      // BULLETPROOF: Get visual reference from multiple sources (including referenceImageUrl variable)
      const goldenVisualUrl = result.lastFrameUrl 
        || sceneImageLookup[0] 
        || referenceImageUrl  // Use local variable, not state
        || (state as any).referenceImageUrl 
        || request.referenceImageUrl
        || null;
      
      console.log(`[Hollywood] 🎯 GOLDEN FRAME SOURCES:`);
      console.log(`[Hollywood]   lastFrameUrl: ${result.lastFrameUrl ? 'YES' : 'NO (frame extraction failed)'}`);
      console.log(`[Hollywood]   sceneImageLookup[0]: ${sceneImageLookup[0] ? 'YES' : 'NO'}`);
      console.log(`[Hollywood]   referenceImageUrl: ${referenceImageUrl ? 'YES' : 'NO'}`);
      console.log(`[Hollywood]   Using: ${goldenVisualUrl?.substring(0, 60) || 'TEXT-ONLY ANCHORS'}...`);
      
      // Build golden frame data from first clip - manifest is optional enhancement
      const manifest = result.continuityManifest;
      const ci = state.identityBible?.characterIdentity;
      const nfa = state.identityBible?.nonFacialAnchors;
      
      // Extract character snapshot from manifest's critical anchors and identity bible
      const characterParts: string[] = [];
      
      if (state.identityBible?.consistencyPrompt) {
        characterParts.push(state.identityBible.consistencyPrompt);
      }
      if (ci?.description) {
        characterParts.push(ci.description);
      }
      if (ci?.facialFeatures) {
        characterParts.push(`Facial features: ${ci.facialFeatures}`);
      }
      if (ci?.bodyType) {
        characterParts.push(`Body: ${ci.bodyType}`);
      }
      if (ci?.clothing) {
        characterParts.push(`Clothing: ${ci.clothing}`);
      }
      if (manifest?.criticalAnchors?.length) {
        characterParts.push(...manifest.criticalAnchors.slice(0, 5));
      }
      
      // Build comprehensive 12-dimensional anchors
      const comprehensiveAnchors: any = {
        facialGeometry: {},
        skin: {},
        hair: {},
        body: {},
        wardrobe: {},
        accessories: {},
        movement: {},
        expression: {},
        lightingResponse: {},
        colorFingerprint: {},
        scale: {},
        uniqueIdentifiers: {},
      };
      
      // Extract facial geometry from identity bible
      if (ci?.facialFeatures) {
        comprehensiveAnchors.facialGeometry = {
          facialSymmetry: ci.facialFeatures,
          facialExpression: 'as established in clip 1',
        };
      }
      
      // Extract body anchors
      if (ci?.bodyType) {
        comprehensiveAnchors.body = {
          build: ci.bodyType,
          posture: nfa?.posture || 'as established in clip 1',
          silhouette: nfa?.silhouetteDescription || ci.bodyType,
        };
      }
      
      // Extract wardrobe anchors
      if (ci?.clothing) {
        comprehensiveAnchors.wardrobe = {
          topGarment: ci.clothing,
          fabricTexture: nfa?.clothingSignature || 'as shown',
          wearCondition: 'identical to clip 1',
        };
      }
      
      // Extract hair anchors
      if (nfa?.hairFromBehind) {
        comprehensiveAnchors.hair = {
          hairStyle: nfa.hairFromBehind,
        };
      }
      
      // Extract movement anchors
      if (nfa?.gait || nfa?.posture) {
        comprehensiveAnchors.movement = {
          walkingGait: nfa?.gait,
          defaultStance: nfa?.posture,
        };
      }
      
      // Extract unique identifiers from distinctive markers
      if (ci?.distinctiveMarkers?.length) {
        comprehensiveAnchors.uniqueIdentifiers = {
          mostDistinctiveFeature: ci.distinctiveMarkers[0],
          secondMostDistinctive: ci.distinctiveMarkers[1] || null,
          thirdMostDistinctive: ci.distinctiveMarkers[2] || null,
          absoluteNonNegotiables: ci.distinctiveMarkers,
          quickCheckpoints: ci.distinctiveMarkers.slice(0, 5),
          driftWarningZones: ['face', 'hair', 'clothing', 'skin tone', 'body proportions'],
        };
      }
      
      // Extract from manifest spatial if available
      if (manifest?.spatial) {
        comprehensiveAnchors.scale = {
          environmentScale: manifest.spatial.characterPosition || 'as established',
          headToBodyRatio: 'maintain from clip 1',
        };
      }
      
      // Extract lighting response from manifest
      if (manifest?.lighting) {
        comprehensiveAnchors.lightingResponse = {
          highlightAreas: [manifest.lighting.keyLightPosition || 'as shown'],
          shadowAreas: [manifest.lighting.shadowDirection || 'as shown'],
          overallLuminance: manifest.lighting.intensity || 'as shown',
        };
      }
      
      goldenFrameData = {
        characterSnapshot: characterParts.join('. ') || 'Character as established in clip 1',
        goldenAnchors: [
          ...(state.identityBible?.consistencyAnchors || []),
          ...(manifest?.criticalAnchors || []),
          ...(ci?.distinctiveMarkers || []),
        ].slice(0, 15),
        // CRITICAL FIX v2: Use bulletproof visual URL with fallbacks
        goldenFrameUrl: goldenVisualUrl || undefined,
        comprehensiveAnchors,
      };
      
      // Store frame source info in comprehensiveAnchors
      (goldenFrameData.comprehensiveAnchors as any).frameSource = result.lastFrameUrl ? 'extracted-frame' : (sceneImageLookup[0] ? 'scene-image' : 'none');
      
      // Count filled anchor fields
      let filledFields = 0;
      Object.values(comprehensiveAnchors).forEach((section: any) => {
        if (typeof section === 'object' && section !== null) {
          filledFields += Object.keys(section).length;
        }
      });
      
      console.log(`[Hollywood] 🎯 COMPREHENSIVE GOLDEN FRAME DATA captured from Clip 1:`);
      console.log(`[Hollywood]   Character snapshot: ${goldenFrameData?.characterSnapshot?.substring(0, 150) || 'N/A'}...`);
      console.log(`[Hollywood]   Golden anchors: ${goldenFrameData?.goldenAnchors?.length || 0}`);
      console.log(`[Hollywood]   Comprehensive anchors: ${filledFields} fields across 12 dimensions`);
      console.log(`[Hollywood]   Frame URL: ${goldenFrameData?.goldenFrameUrl?.substring(0, 50) || 'NONE - text anchors only'}...`);
      console.log(`[Hollywood]   Frame Source: ${(goldenFrameData?.comprehensiveAnchors as any)?.frameSource || 'unknown'}`);
      console.log(`[Hollywood]   Unique identifiers: ${comprehensiveAnchors.uniqueIdentifiers?.absoluteNonNegotiables?.length || 0} non-negotiables`);
      console.log(`[Hollywood]   Manifest available: ${manifest ? 'YES' : 'NO (using identity bible only)'}`);
      
      // =====================================================
      // CRITICAL: Persist goldenFrameData to DB for resume support
      // Without this, 12-dimensional anchors are lost on pipeline restart
      // BULLETPROOF: Verify after save
      // =====================================================
      try {
        // Get current pro_features_data and merge
        const { data: currentProject } = await supabase
          .from('movie_projects')
          .select('pro_features_data')
          .eq('id', state.projectId)
          .single();
        
        const updatedProFeatures = {
          ...(currentProject?.pro_features_data || {}),
          goldenFrameData,
          goldenFrameCapturedAt: new Date().toISOString(),
          // CRITICAL: Also persist identityBible for resume
          identityBible: state.identityBible,
        };
        
        const { error: updateError } = await supabase
          .from('movie_projects')
          .update({
            pro_features_data: updatedProFeatures,
            updated_at: new Date().toISOString(),
          })
          .eq('id', state.projectId);
        
        if (updateError) {
          console.error(`[Hollywood] ⚠️ goldenFrameData persistence FAILED:`, updateError);
        } else {
          // VERIFICATION: Read back and confirm
          const { data: verifyData } = await supabase
            .from('movie_projects')
            .select('pro_features_data')
            .eq('id', state.projectId)
            .single();
          
          if (verifyData?.pro_features_data?.goldenFrameData?.goldenFrameUrl) {
            console.log(`[Hollywood] ✓ VERIFIED goldenFrameData persisted:`);
            console.log(`[Hollywood]   Frame URL: ${verifyData.pro_features_data.goldenFrameData.goldenFrameUrl.substring(0, 60)}...`);
            console.log(`[Hollywood]   Anchors: ${verifyData.pro_features_data.goldenFrameData.goldenAnchors?.length || 0}`);
          } else {
            console.error(`[Hollywood] ⚠️ VERIFICATION FAILED - goldenFrameData not in DB!`);
            
            // RETRY with raw update
            await supabase.rpc('upsert_project_pro_features', {
              p_project_id: state.projectId,
              p_key: 'goldenFrameData',
              p_value: JSON.stringify(goldenFrameData),
            }).catch(() => {
              // RPC may not exist, try direct
              console.log(`[Hollywood] RPC not available, using direct update...`);
            });
          }
        }
        
        console.log(`[Hollywood] ✓ PERSISTED goldenFrameData + identityBible to DB for resume support`);
      } catch (persistErr) {
        console.warn(`[Hollywood] Failed to persist goldenFrameData:`, persistErr);
      }
    }
    
    console.log(`[Hollywood] Clip ${i + 1} completed: ${result.videoUrl.substring(0, 50)}...`);
    console.log(`[Hollywood] Continuity chain: ${accumulatedAnchors.length} anchors, ${previousMotionVectors ? 'motion vectors' : 'no motion'}, ${previousContinuityManifest ? 'manifest ready' : 'no manifest'}${goldenFrameData ? ', golden frame set' : ''}`);
  }
  
  const completedClips = state.production.clipResults.filter(c => c.status === 'completed');
  const failedClips = state.production.clipResults.filter(c => c.status === 'failed');
  console.log(`[Hollywood] Production complete: ${completedClips.length}/${clips.length} clips (${failedClips.length} failed)`);
  
  // =====================================================
  // CRITICAL: Ensure ALL clips are generated before stitching
  // If any clips failed, DO NOT proceed to stitching - wait for manual retry
  // =====================================================
  if (completedClips.length < clips.length) {
    console.error(`[Hollywood] ⚠️ INCOMPLETE PRODUCTION: Only ${completedClips.length}/${clips.length} clips completed`);
    console.error(`[Hollywood] Failed clips: ${failedClips.map(c => c.index + 1).join(', ')}`);
    
    // Update project status to indicate incomplete production
    await supabase
      .from('movie_projects')
      .update({
        status: 'production_incomplete',
        pending_video_tasks: {
          stage: 'production_incomplete',
          progress: 85,
          clipsCompleted: completedClips.length,
          clipCount: clips.length,
          failedClips: failedClips.map(c => c.index),
          message: `${clips.length - completedClips.length} clips need to be regenerated before stitching`,
          canRetryFailed: true,
        },
        last_error: `Production incomplete: ${completedClips.length}/${clips.length} clips. Failed: ${failedClips.map(c => c.index + 1).join(', ')}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', state.projectId);
    
    // Return state without proceeding to stitching
    state.progress = 85;
    state.error = `Production incomplete: ${completedClips.length}/${clips.length} clips completed. Stitching requires all clips.`;
    return state;
  }
  
  console.log(`[Hollywood] ✓ All ${completedClips.length} clips completed - proceeding to stitching`);
  
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
  
  // =====================================================
  // CONTINUITY ORCHESTRATOR: Post-process analysis for transition quality
  // Stores analysis in pro_features_data for frontend display
  // =====================================================
  if (completedClipsList.length >= 2) {
    console.log(`[Hollywood] Running continuity orchestrator post-process analysis...`);
    
    try {
      // Build clip data for post-process analysis
      const clipDataForAnalysis = completedClipsList.map((c: any) => {
        const scriptShot = state.script?.shots?.[c.index];
        return {
          index: c.index,
          videoUrl: c.videoUrl,
          lastFrameUrl: c.lastFrameUrl,
          prompt: scriptShot?.description || `Clip ${c.index + 1}`,
          motionVectors: (state as any).clipMotionVectors?.[c.index],
          colorProfile: (state as any).clipColorProfiles?.[c.index],
          consistencyScore: (c as any).visualDebugResult?.score || (c as any).identityVerification?.score,
        };
      });
      
      const postProcessResult = await callEdgeFunction('continuity-orchestrator', {
        projectId: state.projectId,
        userId: request.userId,
        mode: 'post-process',
        allClips: clipDataForAnalysis,
        config: {
          consistencyThreshold: 70,
          enableBridgeClips: true,
          enableMotionChaining: true,
          enableAutoRetry: false, // Don't retry in post-process, just analyze
          maxBridgeClips: 5,
          maxAutoRetries: 0,
        },
      });
      
      if (postProcessResult.success) {
        console.log(`[Hollywood] Continuity post-process complete:`);
        console.log(`  - Overall continuity score: ${postProcessResult.overallContinuityScore}/100`);
        console.log(`  - Transitions analyzed: ${postProcessResult.transitionAnalyses?.length || 0}`);
        console.log(`  - Bridge clips recommended: ${postProcessResult.bridgeClipsNeeded || 0}`);
        console.log(`  - Clips needing retry: ${postProcessResult.clipsToRetry?.length || 0}`);
        
        // Store in state for final update
        (state as any).continuityOrchestratorResult = postProcessResult;
      }
    } catch (postProcessErr) {
      console.warn(`[Hollywood] Continuity post-process analysis failed:`, postProcessErr);
    }
  }
  
  if (!state.finalVideoUrl) {
    console.warn(`[Hollywood] No final video URL from production stage`);
  } else {
    console.log(`[Hollywood] Final video ready: ${state.finalVideoUrl}`);
  }
  
  state.progress = 100;
  
  // Build final pro features data including continuity analysis
  const continuityAnalysisData = (state as any).continuityOrchestratorResult ? {
    continuityAnalysis: {
      score: (state as any).continuityOrchestratorResult.overallContinuityScore,
      transitions: (state as any).continuityOrchestratorResult.transitionAnalyses,
      bridgeClipsNeeded: (state as any).continuityOrchestratorResult.bridgeClipsNeeded,
      clipsToRetry: (state as any).continuityOrchestratorResult.clipsToRetry,
      analyzedAt: new Date().toISOString(),
    },
  } : {};
  
  await updateProjectProgress(supabase, state.projectId, 'postproduction', 100, {
    finalVideoUrl: state.finalVideoUrl,
    clipsCompleted: completedClips,
    clipsFailed: failedClips,
    ...continuityAnalysisData,
    proFeaturesUsed: request.qualityTier === 'professional' ? {
      multiCharacterBible: !!(state as any).multiCharacterBible,
      depthConsistency: (state as any).depthConsistency?.overallScore,
      lipSync: Object.keys((state as any).lipSyncData || {}).length,
      musicSync: (state as any).musicSyncPlan?.emotionalBeats?.length || 0,
      colorGrading: (state as any).colorGrading?.masterPreset,
      sfxCues: (state as any).sfxPlan?.sfxCues?.length || 0,
      continuityScore: (state as any).continuityOrchestratorResult?.overallContinuityScore,
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
        // CRITICAL: Use script shots length as source of truth for clipCount
        // This ensures user-approved shot count is respected
        const scriptShotsCount = state.script?.shots?.length || 0;
        state.clipCount = scriptShotsCount > 0 ? scriptShotsCount : (tasks.clipCount || state.clipCount);
        state.clipDuration = tasks.clipDuration || state.clipDuration;
        console.log(`[Hollywood] Loaded existing state: ${scriptShotsCount} shots, clipCount=${state.clipCount}`);
      }
      
      // Also try to parse generated_script if script not in pending_video_tasks
      if (!state.script?.shots && project?.generated_script) {
        try {
          state.script = JSON.parse(project.generated_script);
          // CRITICAL: Also sync clipCount from generated_script
          if (state.script?.shots?.length) {
            state.clipCount = state.script.shots.length;
          }
          console.log(`[Hollywood] Loaded script from generated_script field: ${state.script?.shots?.length || 0} shots, clipCount=${state.clipCount}`);
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
    // CRITICAL FIX: Merge with existing data instead of replacing!
    // This preserves identityBible, extractedCharacters, goldenFrameData, etc.
    const { data: existingProject } = await supabase
      .from('movie_projects')
      .select('pro_features_data')
      .eq('id', projectId)
      .single();
    
    const existingProFeatures = existingProject?.pro_features_data || {};
    
    const proFeaturesUpdate = {
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
    
    // CRITICAL: Merge with existing data - preserve identityBible, goldenFrameData, etc.
    const mergedProFeatures = {
      ...existingProFeatures,  // Keep existing identity data, anchors, etc.
      ...proFeaturesUpdate,    // Add/update feature tracking flags
      // Re-inject critical identity data from state if available (in case it was lost)
      identityBible: state.identityBible || existingProFeatures.identityBible,
      extractedCharacters: state.extractedCharacters || existingProFeatures.extractedCharacters,
      referenceAnalysis: state.referenceAnalysis || existingProFeatures.referenceAnalysis,
      sceneConsistency: state.sceneConsistency || existingProFeatures.sceneConsistency,
      // Preserve golden frame and anchor data
      goldenFrameData: existingProFeatures.goldenFrameData,
      accumulatedAnchors: existingProFeatures.accumulatedAnchors,
      masterSceneAnchor: existingProFeatures.masterSceneAnchor,
      // Timestamp
      completedAt: new Date().toISOString(),
    };
    
    console.log(`[Hollywood] Merging pro_features_data - preserving identity data:`);
    console.log(`  - identityBible: ${mergedProFeatures.identityBible ? 'YES' : 'NO'}`);
    console.log(`  - goldenFrameData: ${mergedProFeatures.goldenFrameData ? 'YES' : 'NO'}`);
    console.log(`  - extractedCharacters: ${mergedProFeatures.extractedCharacters?.length || 0}`);
    
    // Update project as completed
    await supabase
      .from('movie_projects')
      .update({
        video_url: state.finalVideoUrl,
        music_url: state.assets?.musicUrl,
        quality_tier: request.qualityTier || 'standard',
        pro_features_data: mergedProFeatures,
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
          proFeaturesUsed: proFeaturesUpdate,
          creditsCharged: state.finalVideoUrl && !request.skipCreditDeduction ? state.totalCredits : 0,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
    
    console.log(`[Hollywood] Pipeline completed successfully!`);
    
  } catch (error) {
    console.error("[Hollywood] Background pipeline error:", error);
    
    // RESUMABLE FAILURE STATE: Preserve ALL pipeline state for resumption
    // This ensures users can always resume from where the pipeline failed
    const errorMessage = error instanceof Error ? error.message : 'Pipeline failed';
    const lastCompletedStage = determineLastCompletedStage(state);
    
    console.log(`[Hollywood] Saving resumable state: lastStage=${lastCompletedStage}, progress=${state.progress}%`);
    
    // Get existing pro_features_data to preserve identity data
    const { data: existingProject } = await supabase
      .from('movie_projects')
      .select('pro_features_data, scene_images')
      .eq('id', projectId)
      .single();
    
    const existingProFeatures = existingProject?.pro_features_data || {};
    
    // Merge and preserve all identity and state data
    const preservedProFeatures = {
      ...existingProFeatures,
      identityBible: state.identityBible || existingProFeatures.identityBible,
      extractedCharacters: state.extractedCharacters || existingProFeatures.extractedCharacters,
      referenceAnalysis: state.referenceAnalysis || existingProFeatures.referenceAnalysis,
      sceneConsistency: state.sceneConsistency || existingProFeatures.sceneConsistency,
      goldenFrameData: existingProFeatures.goldenFrameData,
      masterSceneAnchor: existingProFeatures.masterSceneAnchor,
      failedAt: new Date().toISOString(),
      lastError: errorMessage,
    };
    
    // Count completed clips for progress info
    const completedClipsCount = state.production?.clipResults?.filter(c => c.status === 'completed').length || 0;
    const failedClipsCount = state.production?.clipResults?.filter(c => c.status === 'failed').length || 0;
    
    // Update project with FULL resumable state
    await supabase
      .from('movie_projects')
      .update({
        status: 'failed',
        last_error: errorMessage,
        // Preserve generated script for resumption
        generated_script: state.script ? JSON.stringify(state.script) : null,
        // Preserve scene images if they exist
        scene_images: state.assets?.sceneImages || existingProject?.scene_images || null,
        // Preserve pro features data
        pro_features_data: preservedProFeatures,
        // CRITICAL: Full state preservation for resumption
        pending_video_tasks: {
          stage: 'error',
          lastCompletedStage,
          progress: state.progress,
          error: errorMessage,
          // Preserve script for resumption
          script: state.script,
          clipCount: state.clipCount,
          clipDuration: state.clipDuration,
          totalCredits: state.totalCredits,
          // Preserve identity data for resumption
          identityBible: state.identityBible,
          extractedCharacters: state.extractedCharacters,
          referenceAnalysis: state.referenceAnalysis,
          sceneConsistency: state.sceneConsistency,
          // Preserve audit results
          auditResult: state.auditResult,
          // Preserve asset URLs (if generated before failure)
          assets: state.assets,
          // Production progress info
          clipsCompleted: completedClipsCount,
          clipsFailed: failedClipsCount,
          // Config for resumption
          config: {
            includeVoice: request.includeVoice,
            includeMusic: request.includeMusic,
            genre: request.genre,
            mood: request.mood,
            colorGrading: request.colorGrading,
            qualityTier: request.qualityTier,
          },
          // Resumption metadata
          failedAt: new Date().toISOString(),
          resumable: true,
          suggestedResumeFrom: getSuggestedResumeStage(lastCompletedStage, errorMessage),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
    
    console.log(`[Hollywood] Resumable failure state saved. Resume from: ${getSuggestedResumeStage(lastCompletedStage, errorMessage)}`);
  }
}

// Helper: Determine the last successfully completed stage
function determineLastCompletedStage(state: PipelineState): string {
  if (state.finalVideoUrl) return 'postproduction';
  if (state.production?.clipResults?.some(c => c.status === 'completed')) return 'production';
  if (state.assets?.sceneImages?.length || state.assets?.voiceUrl || state.assets?.musicUrl) return 'assets';
  if (state.auditResult?.overallScore) return 'qualitygate';
  if (state.script?.shots?.length) return 'preproduction';
  return 'initializing';
}

// Helper: Suggest the best stage to resume from based on state and error
function getSuggestedResumeStage(lastCompletedStage: string, errorMessage: string): string {
  // If error is in video generation, resume from production
  if (errorMessage.toLowerCase().includes('video') || 
      errorMessage.toLowerCase().includes('clip') ||
      errorMessage.toLowerCase().includes('veo') ||
      errorMessage.toLowerCase().includes('generation')) {
    return 'production';
  }
  
  // If error is in stitching, resume from postproduction
  if (errorMessage.toLowerCase().includes('stitch') || 
      errorMessage.toLowerCase().includes('assembly')) {
    return 'postproduction';
  }
  
  // Otherwise, resume from the stage after the last completed one
  const stageOrder = ['initializing', 'preproduction', 'qualitygate', 'assets', 'production', 'postproduction'];
  const lastIndex = stageOrder.indexOf(lastCompletedStage);
  
  if (lastIndex >= 0 && lastIndex < stageOrder.length - 1) {
    return stageOrder[lastIndex + 1];
  }
  
  // Default to production as it's the most common failure point
  return 'production';
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

    // DEDUCT CREDITS UPFRONT - this ensures users are charged when pipeline starts
    console.log(`[Hollywood] Deducting ${totalCredits} credits from user ${request.userId}`);
    const { error: deductError } = await supabase.rpc('deduct_credits', {
      p_user_id: request.userId,
      p_amount: totalCredits,
      p_description: `Video generation: ${clipCount} clips × ${clipDuration}s`,
      p_project_id: null, // Will be set after project creation
      p_clip_duration: clipCount * clipDuration,
    });

    if (deductError) {
      console.error('[Hollywood] Credit deduction failed:', deductError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to deduct credits. Please try again.',
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log(`[Hollywood] Successfully deducted ${totalCredits} credits`);

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
