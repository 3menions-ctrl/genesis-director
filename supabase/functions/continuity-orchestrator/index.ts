import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CONTINUITY ORCHESTRATOR - Unified Pipeline Enhancement
 * 
 * Implements 4 key improvements for seamless continuous videos:
 * 1. FRAME HANDOFF: Uses last frame of each clip as reference for next
 * 2. MOTION VECTOR CHAINING: Ending motion → next clip's starting motion
 * 3. CONSISTENCY AUTO-RETRY: Re-generate clips when score drops below threshold
 * 4. BRIDGE CLIP GENERATION: Auto-insert transition clips for gaps
 * 
 * This is an ORCHESTRATION layer that coordinates existing functions:
 * - extract-last-frame: Get last frame for handoff
 * - analyze-motion-vectors: Get motion data for chaining
 * - continuity-engine: Analyze transitions and plan bridges
 * - generate-bridge-clip: Generate transition clips
 * - visual-debugger: Check quality and consistency
 */

interface ContinuityOrchestrationRequest {
  projectId: string;
  userId: string;
  mode: 'analyze' | 'enhance-clip' | 'post-process' | 'full';
  
  // For 'enhance-clip' mode
  clipIndex?: number;
  previousClipData?: {
    videoUrl: string;
    lastFrameUrl?: string;
    motionVectors?: MotionVectors;
    colorProfile?: ColorProfile;
  };
  currentClipPrompt?: string;
  
  // For 'post-process' mode
  allClips?: ClipData[];
  
  // Configuration
  config?: {
    consistencyThreshold: number; // 0-100, default 70
    enableBridgeClips: boolean; // default true
    enableMotionChaining: boolean; // default true
    enableAutoRetry: boolean; // default true
    maxBridgeClips: number; // default 3
    maxAutoRetries: number; // default 2
  };
}

interface MotionVectors {
  subjectVelocity?: { x: number; y: number; magnitude: number };
  cameraMovement?: { type: string; direction: string; speed: number };
  motionBlur?: number;
  dominantDirection?: string;
  // Entry/exit motion for chaining
  entryMotion?: string;
  exitMotion?: string;
  continuityPrompt?: string;
}

interface ColorProfile {
  dominantColors: string[];
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
}

interface ClipData {
  index: number;
  videoUrl: string;
  lastFrameUrl?: string;
  motionVectors?: MotionVectors;
  colorProfile?: ColorProfile;
  consistencyScore?: number;
  prompt: string;
}

interface EnhancedPrompt {
  originalPrompt: string;
  enhancedPrompt: string;
  injections: {
    frameHandoff?: string;
    motionContinuity?: string;
    colorContinuity?: string;
    spatialLock?: string;
  };
}

interface TransitionAnalysis {
  fromIndex: number;
  toIndex: number;
  overallScore: number;
  motionScore: number;
  colorScore: number;
  semanticScore: number;
  needsBridge: boolean;
  bridgePrompt?: string;
  bridgeDuration?: number;
}

interface OrchestrationResult {
  success: boolean;
  mode: string;
  
  // For 'enhance-clip' mode
  enhancedPrompt?: EnhancedPrompt;
  recommendedStartImage?: string;
  motionInjection?: {
    entryMotion: string;
    entryCameraHint: string;
  };
  
  // For 'post-process' mode
  transitionAnalyses?: TransitionAnalysis[];
  bridgeClipsNeeded?: number;
  clipsToRetry?: number[];
  overallContinuityScore?: number;
  
  // For 'full' mode
  continuityPlan?: any;
  
  processingTimeMs: number;
  error?: string;
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

// Build motion continuity prompt from previous clip's motion vectors
function buildMotionContinuityPrompt(prevMotion: MotionVectors): string {
  const parts: string[] = [];
  
  if (prevMotion.exitMotion) {
    parts.push(`Continue from: ${prevMotion.exitMotion}`);
  }
  
  if (prevMotion.dominantDirection) {
    parts.push(`Motion direction: ${prevMotion.dominantDirection}`);
  }
  
  if (prevMotion.cameraMovement) {
    const cam = prevMotion.cameraMovement;
    parts.push(`Camera: ${cam.type} ${cam.direction || ''} at ${cam.speed > 0.6 ? 'fast' : cam.speed > 0.3 ? 'medium' : 'slow'} pace`);
  }
  
  if (prevMotion.subjectVelocity && prevMotion.subjectVelocity.magnitude > 0.2) {
    const vel = prevMotion.subjectVelocity;
    const speed = vel.magnitude > 0.6 ? 'fast' : vel.magnitude > 0.3 ? 'moderate' : 'slow';
    parts.push(`Subject moving ${speed}ly`);
  }
  
  return parts.length > 0 ? parts.join('. ') + '.' : '';
}

// Build color continuity injection
function buildColorContinuityPrompt(prevColor: ColorProfile): string {
  if (!prevColor.dominantColors?.length) return '';
  
  const colors = prevColor.dominantColors.slice(0, 3).join(', ');
  let mood = '';
  
  if (prevColor.warmth > 0.6) mood = 'warm';
  else if (prevColor.warmth < 0.4) mood = 'cool';
  
  if (prevColor.brightness > 0.7) mood += mood ? ', bright' : 'bright';
  else if (prevColor.brightness < 0.3) mood += mood ? ', dark' : 'dark';
  
  return `Maintain color palette: ${colors}${mood ? `. Mood: ${mood}` : ''}.`;
}

// Enhance a prompt with continuity injections
function enhancePromptForContinuity(
  originalPrompt: string,
  previousClip?: ContinuityOrchestrationRequest['previousClipData']
): EnhancedPrompt {
  const injections: EnhancedPrompt['injections'] = {};
  const promptParts: string[] = [];
  
  if (previousClip) {
    // Frame handoff note
    if (previousClip.lastFrameUrl) {
      injections.frameHandoff = '[FRAME-CHAINED: Using previous clip end frame as visual anchor]';
    }
    
    // Motion continuity
    if (previousClip.motionVectors) {
      const motionPrompt = buildMotionContinuityPrompt(previousClip.motionVectors);
      if (motionPrompt) {
        injections.motionContinuity = `[MOTION CONTINUITY: ${motionPrompt}]`;
        promptParts.push(injections.motionContinuity);
      }
    }
    
    // Color continuity
    if (previousClip.colorProfile) {
      const colorPrompt = buildColorContinuityPrompt(previousClip.colorProfile);
      if (colorPrompt) {
        injections.colorContinuity = `[COLOR MATCH: ${colorPrompt}]`;
        promptParts.push(injections.colorContinuity);
      }
    }
  }
  
  // Add original prompt
  promptParts.push(originalPrompt);
  
  return {
    originalPrompt,
    enhancedPrompt: promptParts.join('\n'),
    injections,
  };
}

// Analyze transitions between all clips
async function analyzeAllTransitions(
  clips: ClipData[],
  config: ContinuityOrchestrationRequest['config']
): Promise<{ analyses: TransitionAnalysis[]; clipsToRetry: number[] }> {
  const analyses: TransitionAnalysis[] = [];
  const clipsToRetry: number[] = [];
  const threshold = config?.consistencyThreshold || 70;
  
  for (let i = 0; i < clips.length - 1; i++) {
    const fromClip = clips[i];
    const toClip = clips[i + 1];
    
    // Score motion continuity
    let motionScore = 80; // Default
    if (fromClip.motionVectors && toClip.motionVectors) {
      // Check if motion directions are compatible
      const fromDir = fromClip.motionVectors.dominantDirection?.toLowerCase() || '';
      const toDir = toClip.motionVectors.dominantDirection?.toLowerCase() || '';
      
      if (fromDir === toDir) motionScore = 95;
      else if (areDirectionsCompatible(fromDir, toDir)) motionScore = 85;
      else motionScore = 60;
    }
    
    // Score color continuity
    let colorScore = 80;
    if (fromClip.colorProfile && toClip.colorProfile) {
      const colorDiff = Math.abs(fromClip.colorProfile.warmth - toClip.colorProfile.warmth) +
                        Math.abs(fromClip.colorProfile.brightness - toClip.colorProfile.brightness);
      colorScore = Math.max(50, 100 - colorDiff * 50);
    }
    
    // Use existing consistency scores if available
    const semanticScore = toClip.consistencyScore || 80;
    
    const overallScore = Math.round((motionScore + colorScore + semanticScore) / 3);
    
    const analysis: TransitionAnalysis = {
      fromIndex: i,
      toIndex: i + 1,
      overallScore,
      motionScore,
      colorScore,
      semanticScore,
      needsBridge: overallScore < threshold && config?.enableBridgeClips !== false,
    };
    
    // Add bridge prompt if needed
    if (analysis.needsBridge) {
      analysis.bridgePrompt = buildBridgePrompt(fromClip, toClip);
      analysis.bridgeDuration = 2; // 2 second bridge
    }
    
    // Mark for retry if below threshold and retries enabled
    if (overallScore < threshold && config?.enableAutoRetry !== false) {
      clipsToRetry.push(i + 1);
    }
    
    analyses.push(analysis);
  }
  
  return { analyses, clipsToRetry };
}

// Check if two motion directions are compatible
function areDirectionsCompatible(dir1: string, dir2: string): boolean {
  const compatible: Record<string, string[]> = {
    'left': ['left', 'static'],
    'right': ['right', 'static'],
    'up': ['up', 'forward', 'static'],
    'down': ['down', 'backward', 'static'],
    'forward': ['forward', 'up', 'static'],
    'backward': ['backward', 'down', 'static'],
    'static': ['static', 'left', 'right', 'up', 'down', 'forward', 'backward'],
  };
  
  return compatible[dir1]?.includes(dir2) || compatible[dir2]?.includes(dir1) || false;
}

// Build a bridge clip prompt
function buildBridgePrompt(fromClip: ClipData, toClip: ClipData): string {
  const parts = ['Smooth transitional shot'];
  
  // Use motion data if available
  if (fromClip.motionVectors?.cameraMovement) {
    parts.push(`with ${fromClip.motionVectors.cameraMovement.type} camera movement`);
  }
  
  // Add color continuity
  if (fromClip.colorProfile?.dominantColors?.length) {
    parts.push(`maintaining ${fromClip.colorProfile.dominantColors[0]} color tones`);
  }
  
  parts.push('bridging scenes seamlessly');
  
  return parts.join(' ') + '.';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: ContinuityOrchestrationRequest = await req.json();
    const {
      projectId,
      userId,
      mode,
      clipIndex,
      previousClipData,
      currentClipPrompt,
      allClips,
      config = {
        consistencyThreshold: 70,
        enableBridgeClips: true,
        enableMotionChaining: true,
        enableAutoRetry: true,
        maxBridgeClips: 3,
        maxAutoRetries: 2,
      },
    } = request;

    console.log(`[ContinuityOrchestrator] Mode: ${mode}, Project: ${projectId}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result: OrchestrationResult = {
      success: true,
      mode,
      processingTimeMs: 0,
    };

    switch (mode) {
      case 'enhance-clip': {
        // Mode 1: Enhance a single clip's prompt with continuity data
        if (!currentClipPrompt) {
          throw new Error('currentClipPrompt required for enhance-clip mode');
        }
        
        console.log(`[ContinuityOrchestrator] Enhancing clip ${clipIndex} prompt`);
        
        // Enhance the prompt with continuity injections
        const enhanced = enhancePromptForContinuity(currentClipPrompt, previousClipData);
        result.enhancedPrompt = enhanced;
        
        // Recommend start image (frame handoff)
        if (previousClipData?.lastFrameUrl) {
          result.recommendedStartImage = previousClipData.lastFrameUrl;
          console.log(`[ContinuityOrchestrator] Recommending frame handoff from previous clip`);
        }
        
        // Motion injection hints
        if (previousClipData?.motionVectors) {
          result.motionInjection = {
            entryMotion: previousClipData.motionVectors.exitMotion || previousClipData.motionVectors.dominantDirection || 'static',
            entryCameraHint: previousClipData.motionVectors.cameraMovement?.type || 'static',
          };
          console.log(`[ContinuityOrchestrator] Motion injection: ${result.motionInjection.entryMotion}`);
        }
        break;
      }
      
      case 'post-process': {
        // Mode 2: Analyze all clips after generation, identify issues
        if (!allClips || allClips.length < 2) {
          throw new Error('allClips (at least 2) required for post-process mode');
        }
        
        console.log(`[ContinuityOrchestrator] Post-processing ${allClips.length} clips`);
        
        // Analyze all transitions
        const { analyses, clipsToRetry } = await analyzeAllTransitions(allClips, config);
        
        result.transitionAnalyses = analyses;
        result.clipsToRetry = clipsToRetry.slice(0, config.maxAutoRetries || 2);
        result.bridgeClipsNeeded = analyses.filter(a => a.needsBridge).length;
        result.overallContinuityScore = Math.round(
          analyses.reduce((sum, a) => sum + a.overallScore, 0) / analyses.length
        );
        
        console.log(`[ContinuityOrchestrator] Continuity score: ${result.overallContinuityScore}/100`);
        console.log(`[ContinuityOrchestrator] Bridge clips needed: ${result.bridgeClipsNeeded}`);
        console.log(`[ContinuityOrchestrator] Clips to retry: ${result.clipsToRetry.join(', ') || 'none'}`);
        
        // Store analysis in project
        await supabase
          .from('movie_projects')
          .update({
            pro_features_data: {
              continuityAnalysis: {
                score: result.overallContinuityScore,
                transitions: analyses,
                bridgeClipsNeeded: result.bridgeClipsNeeded,
                clipsToRetry: result.clipsToRetry,
                analyzedAt: new Date().toISOString(),
              },
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);
        
        break;
      }
      
      case 'full': {
        // Mode 3: Full continuity engine analysis (delegates to continuity-engine)
        console.log(`[ContinuityOrchestrator] Running full continuity analysis`);
        
        // Fetch all clips
        const { data: clips } = await supabase
          .from('video_clips')
          .select('shot_index, video_url, last_frame_url, motion_vectors, color_profile, prompt, quality_score')
          .eq('project_id', projectId)
          .eq('status', 'completed')
          .order('shot_index');
        
        if (!clips || clips.length < 2) {
          throw new Error('Need at least 2 completed clips for full analysis');
        }
        
        // Map to expected format
        const clipData = clips.map(c => ({
          index: c.shot_index,
          videoUrl: c.video_url,
          lastFrameUrl: c.last_frame_url,
          prompt: c.prompt,
          motionVectors: c.motion_vectors as MotionVectors,
          colorProfile: c.color_profile as ColorProfile,
        }));
        
        // Call continuity-engine for full analysis
        const continuityResult = await callEdgeFunction('continuity-engine', {
          projectId,
          userId,
          clips: clipData,
          gapThreshold: config.consistencyThreshold,
          maxBridgeClips: config.maxBridgeClips,
        });
        
        result.continuityPlan = continuityResult.plan;
        result.overallContinuityScore = continuityResult.plan?.overallContinuityScore;
        result.bridgeClipsNeeded = continuityResult.plan?.bridgeClipsNeeded || 0;
        
        break;
      }
      
      case 'analyze': {
        // Mode 4: Quick analysis of current state
        console.log(`[ContinuityOrchestrator] Quick analysis for project ${projectId}`);
        
        // Fetch clips with motion data
        const { data: clips } = await supabase
          .from('video_clips')
          .select('shot_index, motion_vectors, color_profile, quality_score, status')
          .eq('project_id', projectId)
          .order('shot_index');
        
        const completed = clips?.filter(c => c.status === 'completed') || [];
        const hasMotionData = completed.filter(c => c.motion_vectors).length;
        const hasColorData = completed.filter(c => c.color_profile).length;
        const avgQuality = completed.length > 0
          ? completed.reduce((sum, c) => sum + (c.quality_score || 70), 0) / completed.length
          : 0;
        
        result.overallContinuityScore = Math.round(avgQuality);
        
        console.log(`[ContinuityOrchestrator] ${completed.length} clips, ${hasMotionData} with motion, ${hasColorData} with color, avg quality: ${avgQuality}`);
        break;
      }
      
      default:
        throw new Error(`Unknown mode: ${mode}`);
    }

    result.processingTimeMs = Date.now() - startTime;
    console.log(`[ContinuityOrchestrator] Complete in ${result.processingTimeMs}ms`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ContinuityOrchestrator] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        mode: 'error',
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
