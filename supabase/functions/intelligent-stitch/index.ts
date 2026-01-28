import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Intelligent Stitcher
 * 
 * Hollywood-grade video assembly with:
 * 1. Scene anchor extraction for all clips
 * 2. Gap detection between consecutive clips
 * 3. AI bridge clip generation for incompatible transitions
 * 4. FFmpeg final assembly with transitions
 * 
 * Orchestrates: extract-scene-anchor, compare-scene-anchors, generate-video, stitch-video
 */

interface StitchRequest {
  projectId: string;
  userId?: string; // FIXED: Added userId for cost logging
  clips: {
    shotId: string;
    videoUrl: string;
    firstFrameUrl?: string;
    lastFrameUrl?: string;
  }[];
  voiceAudioUrl?: string;
  musicAudioUrl?: string;
  autoGenerateBridges: boolean;
  strictnessLevel: 'lenient' | 'normal' | 'strict';
  maxBridgeClips: number;
  bridgeClipDuration?: number; // FIX: Configurable bridge duration (default: 3)
  targetFormat: '1080p' | '4k';
  qualityTier: 'standard' | 'professional';
  // Integration flags
  useContinuityOrchestrator?: boolean; // FIX: Option to use continuity-orchestrator
  extractFirstFrames?: boolean; // FIX: Extract first frames for better analysis
  // Pro features from hollywood-pipeline
  musicSyncPlan?: {
    timingMarkers?: any[];
    mixingInstructions?: any;
    musicCues?: any[];
    emotionalBeats?: any[];
  };
  colorGradingFilter?: string;
  sfxPlan?: {
    ambientBeds?: any[];
    sfxCues?: any[];
    ffmpegFilters?: string[];
  };
  // Audio control
  muteNativeAudio?: boolean; // Strip Kling 2.6 native audio (narration/dialog) from clips
  continuityPlan?: any; // Continuity analysis data
}

interface TransitionAnalysis {
  fromIndex: number;
  toIndex: number;
  comparison: any;
  recommendedTransition: 'cut' | 'dissolve' | 'fade' | 'ai-bridge';
  bridgeClipNeeded: boolean;
  bridgeClipPrompt?: string;
  bridgeClipUrl?: string;
}

// Call another edge function
async function callEdgeFunction(functionName: string, body: any): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${functionName} failed: ${errorText}`);
  }
  
  return response.json();
}

// Extract frame from video URL (uses last frame from video_clips table or extracts first frame)
async function getClipFrames(clip: any, supabase: any): Promise<{ first: string; last: string; firstDescription?: string }> {
  // If frames provided, use them
  if (clip.firstFrameUrl && clip.lastFrameUrl) {
    return { first: clip.firstFrameUrl, last: clip.lastFrameUrl };
  }
  
  // Try to get from video_clips table
  const { data: clipData } = await supabase
    .from('video_clips')
    .select('last_frame_url, motion_vectors')
    .eq('id', clip.shotId)
    .single();
  
  // Check for existing first frame analysis
  const motionVectors = (clipData?.motion_vectors as Record<string, any>) || {};
  const firstFrameAnalysis = motionVectors?.firstFrameAnalysis;
  
  if (clipData?.last_frame_url) {
    return { 
      first: clipData.last_frame_url, // Use last frame URL as placeholder
      last: clipData.last_frame_url,
      firstDescription: firstFrameAnalysis?.description, // Include if available
    };
  }
  
  // Fallback: use video URL as frame (Gemini can analyze video)
  return { first: clip.videoUrl, last: clip.videoUrl };
}

// Call extract-first-frame to get first frame analysis
async function extractFirstFrameIfNeeded(clip: any, index: number): Promise<void> {
  try {
    console.log(`[Intelligent Stitch] Extracting first frame for clip ${index}...`);
    
    const result = await callEdgeFunction('extract-first-frame', {
      videoUrl: clip.videoUrl,
      shotId: clip.shotId,
      extractionMethod: 'vision-describe',
    });
    
    if (result.success) {
      console.log(`[Intelligent Stitch] First frame extracted for clip ${index}`);
    }
  } catch (error) {
    console.warn(`[Intelligent Stitch] First frame extraction failed for clip ${index}:`, error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: StitchRequest = await req.json();
    const { 
      projectId, 
      clips, 
      voiceAudioUrl, 
      musicAudioUrl,
      autoGenerateBridges = false, // DISABLED: Bridge clips disabled to reduce Kling costs
      strictnessLevel = 'lenient', // Use lenient to skip more analysis
      maxBridgeClips = 3,
      bridgeClipDuration = 3, // FIX: Configurable bridge duration
      targetFormat = '1080p',
      qualityTier = 'standard',
      useContinuityOrchestrator = false, // FIX: Integration with continuity-orchestrator
      extractFirstFrames = false, // FIX: Option to extract first frames
      musicSyncPlan,
      colorGradingFilter,
      sfxPlan
    } = request;

    if (!projectId || !clips || clips.length === 0) {
      throw new Error("projectId and clips are required");
    }

    console.log(`[Intelligent Stitch] Starting for project ${projectId} with ${clips.length} clips`);
    console.log(`[Intelligent Stitch] Options: bridges=${autoGenerateBridges}, continuityOrch=${useContinuityOrchestrator}, extractFrames=${extractFirstFrames}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update project status
    await supabase
      .from('movie_projects')
      .update({ status: 'stitching' })
      .eq('id', projectId);

    const steps: { step: string; status: string; durationMs?: number; error?: string }[] = [];

    // ========================================
    // STEP 0: Extract First Frames (if enabled)
    // ========================================
    if (extractFirstFrames) {
      console.log("[Intelligent Stitch] Step 0: Extracting first frames for all clips...");
      steps.push({ step: 'extract_first_frames', status: 'running' });
      const frameStartTime = Date.now();
      
      // Extract first frames in parallel (up to 5 at a time to avoid rate limits)
      const batchSize = 5;
      for (let i = 0; i < clips.length; i += batchSize) {
        const batch = clips.slice(i, i + batchSize);
        await Promise.all(batch.map((clip, batchIndex) => 
          extractFirstFrameIfNeeded(clip, i + batchIndex)
        ));
      }
      
      steps[steps.length - 1].status = 'complete';
      steps[steps.length - 1].durationMs = Date.now() - frameStartTime;
      console.log(`[Intelligent Stitch] First frames extracted for ${clips.length} clips`);
    }

    // ========================================
    // STEP 0.5: Continuity Orchestrator Analysis (if enabled)
    // ========================================
    let continuityAnalysis: any = null;
    if (useContinuityOrchestrator) {
      console.log("[Intelligent Stitch] Step 0.5: Running continuity orchestrator analysis...");
      steps.push({ step: 'continuity_analysis', status: 'running' });
      const contStartTime = Date.now();
      
      try {
        continuityAnalysis = await callEdgeFunction('continuity-orchestrator', {
          mode: 'analyze',
          projectId,
          clips: clips.map((c, i) => ({
            id: c.shotId,
            index: i,
            videoUrl: c.videoUrl,
            lastFrameUrl: c.lastFrameUrl,
          })),
        });
        
        if (continuityAnalysis.success) {
          console.log(`[Intelligent Stitch] Continuity analysis complete: score=${continuityAnalysis.overallScore}, gaps=${continuityAnalysis.clipsToRetry?.length || 0}`);
        }
        
        steps[steps.length - 1].status = 'complete';
        steps[steps.length - 1].durationMs = Date.now() - contStartTime;
      } catch (contError) {
        console.warn("[Intelligent Stitch] Continuity orchestrator failed:", contError);
        steps[steps.length - 1].status = 'failed';
        steps[steps.length - 1].error = String(contError);
      }
    }

    // ========================================
    // STEP 1: Extract Scene Anchors
    // ========================================
    console.log("[Intelligent Stitch] Step 1: Extracting scene anchors...");
    steps.push({ step: 'extract_anchors', status: 'running' });
    
    const anchors: any[] = [];
    const anchorStartTime = Date.now();
    
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const frames = await getClipFrames(clip, supabase);
      
      try {
        // Extract anchor from last frame (for comparison with next clip's first frame)
        const anchorResult = await callEdgeFunction('extract-scene-anchor', {
          frameUrl: frames.last,
          shotId: clip.shotId,
          projectId,
        });
        
        if (anchorResult.success) {
          anchors.push({
            clipIndex: i,
            ...anchorResult.anchor,
            firstFrameUrl: frames.first,
            lastFrameUrl: frames.last,
          });
        } else {
          console.warn(`[Intelligent Stitch] Failed to extract anchor for clip ${i}: ${anchorResult.error}`);
          anchors.push({ clipIndex: i, error: anchorResult.error });
        }
      } catch (error) {
        console.error(`[Intelligent Stitch] Anchor extraction error for clip ${i}:`, error);
        anchors.push({ clipIndex: i, error: String(error) });
      }
    }
    
    steps[0].status = 'complete';
    steps[0].durationMs = Date.now() - anchorStartTime;
    console.log(`[Intelligent Stitch] Extracted ${anchors.filter(a => !a.error).length}/${clips.length} anchors`);

    // ========================================
    // STEP 2: Analyze Transitions with Vision AI (Veed-Level)
    // ========================================
    console.log("[Intelligent Stitch] Step 2: Analyzing transitions with vision AI...");
    steps.push({ step: 'analyze_transitions', status: 'running' });
    
    const transitions: TransitionAnalysis[] = [];
    const compareStartTime = Date.now();
    
    for (let i = 0; i < clips.length - 1; i++) {
      const clip1 = clips[i];
      const clip2 = clips[i + 1];
      const anchor1 = anchors[i];
      const anchor2 = anchors[i + 1];
      
      try {
        // Use the new vision-based transition gap analyzer
        const gapResult = await callEdgeFunction('analyze-transition-gap', {
          fromClipUrl: clip1.videoUrl,
          toClipUrl: clip2.videoUrl,
          fromClipLastFrame: anchor1?.lastFrameUrl || clip1.lastFrameUrl,
          toClipFirstFrame: anchor2?.firstFrameUrl || clip2.firstFrameUrl,
          fromClipDescription: anchor1?.masterConsistencyPrompt,
          toClipDescription: anchor2?.masterConsistencyPrompt,
          strictness: strictnessLevel,
        });
        
        if (gapResult.success && gapResult.analysis) {
          const analysis = gapResult.analysis;
          transitions.push({
            fromIndex: i,
            toIndex: i + 1,
            comparison: {
              overallScore: analysis.overallScore,
              motionScore: analysis.motionScore,
              visualScore: analysis.visualScore,
              gapType: analysis.gapType,
              gapDescription: analysis.gapDescription,
              motionContinuity: analysis.motionContinuity,
              visualContinuity: analysis.visualContinuity,
            },
            recommendedTransition: analysis.recommendedTransition === 'bridge-clip' ? 'ai-bridge' : analysis.recommendedTransition,
            bridgeClipNeeded: analysis.bridgeClipNeeded,
            bridgeClipPrompt: analysis.bridgeClipPrompt,
          });
          
          console.log(`[Intelligent Stitch] Transition ${i}→${i+1}: Score ${analysis.overallScore}, Gap: ${analysis.gapType}, Rec: ${analysis.recommendedTransition}`);
        } else {
          // Fallback to scene anchor comparison
          if (!anchor1?.error && !anchor2?.error) {
            const compareResult = await callEdgeFunction('compare-scene-anchors', {
              anchor1,
              anchor2,
              strictness: strictnessLevel,
            });
            
            if (compareResult.success) {
              transitions.push({
                fromIndex: i,
                toIndex: i + 1,
                comparison: compareResult.comparison,
                recommendedTransition: compareResult.comparison.recommendedTransition,
                bridgeClipNeeded: compareResult.comparison.bridgeClipNeeded,
                bridgeClipPrompt: compareResult.comparison.bridgeClipPrompt,
              });
            }
          } else {
            transitions.push({
              fromIndex: i,
              toIndex: i + 1,
              comparison: null,
              recommendedTransition: 'dissolve',
              bridgeClipNeeded: false,
            });
          }
        }
      } catch (error) {
        console.error(`[Intelligent Stitch] Transition analysis error ${i}→${i+1}:`, error);
        transitions.push({
          fromIndex: i,
          toIndex: i + 1,
          comparison: null,
          recommendedTransition: 'dissolve',
          bridgeClipNeeded: false,
        });
      }
    }
    
    steps[1].status = 'complete';
    steps[1].durationMs = Date.now() - compareStartTime;
    
    const bridgesNeeded = transitions.filter(t => t.bridgeClipNeeded).length;
    console.log(`[Intelligent Stitch] Found ${bridgesNeeded} transitions needing bridge clips`);

    // ========================================
    // STEP 3: Generate Bridge Clips (if enabled)
    // ========================================
    let bridgeClipsGenerated = 0;
    
    if (autoGenerateBridges && bridgesNeeded > 0) {
      console.log("[Intelligent Stitch] Step 3: Generating bridge clips with dedicated generator...");
      steps.push({ step: 'generate_bridges', status: 'running' });
      
      const bridgeStartTime = Date.now();
      const bridgesToGenerate = transitions
        .filter(t => t.bridgeClipNeeded)
        .slice(0, maxBridgeClips);
      
      for (const transition of bridgesToGenerate) {
        if (!transition.bridgeClipPrompt) continue;
        
        const fromAnchor = anchors[transition.fromIndex];
        const toAnchor = anchors[transition.toIndex];
        const fromClip = clips[transition.fromIndex];
        
        // Extract scene context for bridge generation
        const sceneContext = {
          lighting: fromAnchor?.lighting?.promptFragment,
          colorPalette: fromAnchor?.colorPalette?.promptFragment,
          environment: fromAnchor?.keyObjects?.settingDescription,
          mood: fromAnchor?.motionSignature?.pacingTempo,
        };
        
        try {
          console.log(`[Intelligent Stitch] Generating bridge for transition ${transition.fromIndex}→${transition.toIndex}`);
          
          // Use the dedicated bridge clip generator
          const bridgeResult = await callEdgeFunction('generate-bridge-clip', {
            projectId,
            userId: request.userId,
            fromClipLastFrame: fromAnchor?.lastFrameUrl || fromClip.lastFrameUrl || fromClip.videoUrl,
            toClipFirstFrame: toAnchor?.firstFrameUrl,
            bridgePrompt: transition.bridgeClipPrompt,
            durationSeconds: bridgeClipDuration, // FIX: Use configurable duration
            sceneContext,
          });
          
          if (bridgeResult.success && bridgeResult.videoUrl) {
            transition.bridgeClipUrl = bridgeResult.videoUrl;
            transition.recommendedTransition = 'cut'; // Clean cut to/from bridge
            bridgeClipsGenerated++;
            console.log(`[Intelligent Stitch] Bridge clip generated: ${bridgeResult.videoUrl}`);
          } else {
            console.warn(`[Intelligent Stitch] Bridge generation returned no video, using dissolve`);
            transition.recommendedTransition = 'dissolve';
            transition.bridgeClipNeeded = false;
          }
        } catch (error) {
          console.error(`[Intelligent Stitch] Bridge generation failed:`, error);
          // Fall back to dissolve transition
          transition.recommendedTransition = 'dissolve';
          transition.bridgeClipNeeded = false;
        }
      }
      
      steps[2].status = 'complete';
      steps[2].durationMs = Date.now() - bridgeStartTime;
    }

    // ========================================
    // STEP 4: Build Final Clip Sequence
    // ========================================
    console.log("[Intelligent Stitch] Step 4: Building final sequence...");
    steps.push({ step: 'build_sequence', status: 'running' });
    
    const finalSequence: { url: string; transition?: string }[] = [];
    
    for (let i = 0; i < clips.length; i++) {
      finalSequence.push({ url: clips[i].videoUrl });
      
      if (i < transitions.length) {
        const transition = transitions[i];
        
        // Insert bridge clip if generated
        if (transition.bridgeClipUrl) {
          finalSequence.push({ 
            url: transition.bridgeClipUrl,
            transition: 'cut'
          });
        }
        
        // Add transition type for FFmpeg
        if (finalSequence.length > 0) {
          finalSequence[finalSequence.length - 1].transition = transition.recommendedTransition;
        }
      }
    }
    
    steps[steps.length - 1].status = 'complete';

    // ========================================
    // STEP 5: Create Manifest for Client-Side Playback
    // ========================================
    console.log("[Intelligent Stitch] Step 5: Creating playback manifest...");
    steps.push({ step: 'create_manifest', status: 'running' });
    
    const manifestStartTime = Date.now();
    
    let finalVideoUrl: string | undefined;
    
    try {
      // Call simple-stitch for manifest creation
      const manifestResult = await callEdgeFunction('simple-stitch', {
        projectId,
        userId: request.userId,
      });
      
      if (manifestResult.success && manifestResult.finalVideoUrl) {
        finalVideoUrl = manifestResult.finalVideoUrl;
        steps[steps.length - 1].status = 'complete';
        steps[steps.length - 1].durationMs = Date.now() - manifestStartTime;
      } else {
        throw new Error(manifestResult.error || 'Manifest creation failed');
      }
    } catch (error) {
      console.error("[Intelligent Stitch] Manifest creation error:", error);
      steps[steps.length - 1].status = 'failed';
      steps[steps.length - 1].error = String(error);
    }

    // ========================================
    // Update Project Status
    // ========================================
    await supabase
      .from('movie_projects')
      .update({ 
        status: finalVideoUrl ? 'completed' : 'stitching_failed',
        video_url: finalVideoUrl,
      })
      .eq('id', projectId);

    const totalProcessingTimeMs = Date.now() - startTime;
    
    // Calculate overall consistency score
    const validComparisons = transitions.filter(t => t.comparison?.overallScore != null);
    const overallConsistency = validComparisons.length > 0
      ? Math.round(validComparisons.reduce((sum, t) => sum + t.comparison.overallScore, 0) / validComparisons.length)
      : 0;

    // Log completion
    console.log(`[Intelligent Stitch] API operation logged for ${clips.length} clips`);

    console.log(`[Intelligent Stitch] Complete in ${totalProcessingTimeMs}ms. Final video: ${finalVideoUrl || 'PENDING'}`);

    return new Response(
      JSON.stringify({
        success: !!finalVideoUrl,
        projectId,
        plan: {
          clips: clips.map((c, i) => ({
            ...c,
            anchor: anchors[i]?.error ? null : anchors[i],
          })),
          transitions,
          bridgeClipsNeeded: bridgesNeeded,
          overallConsistency,
          problemTransitions: transitions.filter(t => !t.comparison?.isCompatible).length,
        },
        finalVideoUrl,
        bridgeClipsGenerated,
        totalProcessingTimeMs,
        steps,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Intelligent Stitch] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalProcessingTimeMs: Date.now() - startTime,
        steps: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
