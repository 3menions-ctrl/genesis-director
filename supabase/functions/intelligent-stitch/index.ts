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
  targetFormat: '1080p' | '4k';
  qualityTier: 'standard' | 'professional';
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

// Extract frame from video URL (uses last frame from video_clips table or generates one)
async function getClipFrames(clip: any, supabase: any): Promise<{ first: string; last: string }> {
  // If frames provided, use them
  if (clip.firstFrameUrl && clip.lastFrameUrl) {
    return { first: clip.firstFrameUrl, last: clip.lastFrameUrl };
  }
  
  // Try to get from video_clips table
  const { data: clipData } = await supabase
    .from('video_clips')
    .select('last_frame_url')
    .eq('id', clip.shotId)
    .single();
  
  if (clipData?.last_frame_url) {
    // For now, use last frame for both (first frame extraction would need FFmpeg)
    return { first: clipData.last_frame_url, last: clipData.last_frame_url };
  }
  
  // Fallback: use video URL as frame (Gemini can analyze video)
  return { first: clip.videoUrl, last: clip.videoUrl };
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
      autoGenerateBridges = true,
      strictnessLevel = 'normal',
      maxBridgeClips = 3,
      targetFormat = '1080p',
      qualityTier = 'standard',
      musicSyncPlan,
      colorGradingFilter,
      sfxPlan
    } = request;

    if (!projectId || !clips || clips.length === 0) {
      throw new Error("projectId and clips are required");
    }

    console.log(`[Intelligent Stitch] Starting for project ${projectId} with ${clips.length} clips`);

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
    // STEP 2: Compare Consecutive Clips
    // ========================================
    console.log("[Intelligent Stitch] Step 2: Analyzing transitions...");
    steps.push({ step: 'analyze_transitions', status: 'running' });
    
    const transitions: TransitionAnalysis[] = [];
    const compareStartTime = Date.now();
    
    for (let i = 0; i < clips.length - 1; i++) {
      const anchor1 = anchors[i];
      const anchor2 = anchors[i + 1];
      
      // Skip if either anchor failed
      if (anchor1.error || anchor2.error) {
        transitions.push({
          fromIndex: i,
          toIndex: i + 1,
          comparison: null,
          recommendedTransition: 'cut', // Default to cut if analysis failed
          bridgeClipNeeded: false,
        });
        continue;
      }
      
      try {
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
        } else {
          transitions.push({
            fromIndex: i,
            toIndex: i + 1,
            comparison: null,
            recommendedTransition: 'dissolve',
            bridgeClipNeeded: false,
          });
        }
      } catch (error) {
        console.error(`[Intelligent Stitch] Compare error for transition ${i}→${i+1}:`, error);
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
    
    if (autoGenerateBridges && bridgesNeeded > 0) { // FIXED: Removed professional-only gate
      console.log("[Intelligent Stitch] Step 3: Generating bridge clips...");
      steps.push({ step: 'generate_bridges', status: 'running' });
      
      const bridgeStartTime = Date.now();
      const bridgesToGenerate = transitions
        .filter(t => t.bridgeClipNeeded)
        .slice(0, maxBridgeClips);
      
      for (const transition of bridgesToGenerate) {
        if (!transition.bridgeClipPrompt) continue;
        
        const fromAnchor = anchors[transition.fromIndex];
        const toAnchor = anchors[transition.toIndex];
        
        // Build bridge prompt with scene context
        const bridgePrompt = `${transition.bridgeClipPrompt}. 
          Maintain visual elements: ${fromAnchor.masterConsistencyPrompt || ''}
          Transition towards: ${toAnchor.masterConsistencyPrompt || ''}`;
        
        try {
          console.log(`[Intelligent Stitch] Generating bridge for transition ${transition.fromIndex}→${transition.toIndex}`);
          
          const generateResult = await callEdgeFunction('generate-video', {
            prompt: bridgePrompt,
            startFrameUrl: fromAnchor.lastFrameUrl,
            duration: 2, // 2-second bridge clips
            aspectRatio: '16:9',
            negativePrompt: 'jarring transition, sudden change, inconsistent lighting',
          });
          
          if (generateResult.success && generateResult.videoUrl) {
            transition.bridgeClipUrl = generateResult.videoUrl;
            transition.recommendedTransition = 'cut'; // Now we can cut to the bridge
            bridgeClipsGenerated++;
            console.log(`[Intelligent Stitch] Bridge clip generated: ${generateResult.videoUrl}`);
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
    // STEP 5: Call FFmpeg Stitcher
    // ========================================
    console.log("[Intelligent Stitch] Step 5: Calling FFmpeg stitcher...");
    steps.push({ step: 'ffmpeg_stitch', status: 'running' });
    
    const stitchStartTime = Date.now();
    
    const stitchPayload = {
      projectId,
      projectTitle: `Video - ${projectId}`,
      clips: finalSequence.map((item, index) => ({
        shotId: `clip_${index}`,
        videoUrl: item.url,
        durationSeconds: 4,
        transitionOut: item.transition && item.transition !== 'cut' 
          ? item.transition === 'ai-bridge' ? 'dissolve' : item.transition 
          : 'continuous',
      })),
      voiceTrackUrl: voiceAudioUrl,
      backgroundMusicUrl: musicAudioUrl,
      audioMixMode: (voiceAudioUrl || musicAudioUrl) ? 'full' : 'mute',
      // Pass pro features through to stitch-video
      musicSyncPlan: musicSyncPlan,
      colorGradingFilter: colorGradingFilter,
      output: {
        format: 'mp4',
        resolution: targetFormat === '4k' ? '3840x2160' : '1920x1080',
        fps: 24,
      },
    };
    
    console.log(`[Intelligent Stitch] Pro features: musicSync=${!!musicSyncPlan}, colorGrading=${!!colorGradingFilter}, sfx=${!!sfxPlan}`);
    
    let finalVideoUrl: string | undefined;
    
    try {
      const stitchResult = await callEdgeFunction('stitch-video', stitchPayload);
      
      if (stitchResult.success || stitchResult.videoUrl) {
        finalVideoUrl = stitchResult.videoUrl;
        steps[steps.length - 1].status = 'complete';
        steps[steps.length - 1].durationMs = Date.now() - stitchStartTime;
      } else {
        throw new Error(stitchResult.error || 'Stitch failed');
      }
    } catch (error) {
      console.error("[Intelligent Stitch] FFmpeg stitch error:", error);
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

    // Log API cost for stitching (after overallConsistency is calculated)
    try {
      const creditsCharged = 5; // Stitching cost
      const realCostCents = 2; // Minimal compute cost
      
      await supabase.rpc('log_api_cost', {
        p_user_id: request.userId || null, // FIXED: Pass userId from request
        p_project_id: projectId,
        p_shot_id: 'final_stitch',
        p_service: 'cloud_run_stitcher',
        p_operation: 'intelligent_stitch',
        p_credits_charged: creditsCharged,
        p_real_cost_cents: realCostCents,
        p_duration_seconds: clips.length * 4,
        p_status: finalVideoUrl ? 'completed' : 'failed',
        p_metadata: JSON.stringify({
          clipCount: clips.length,
          bridgeClipsGenerated,
          overallConsistency,
          hasMusicSync: !!musicSyncPlan,
          hasColorGrading: !!colorGradingFilter,
          hasSfx: !!sfxPlan,
          totalProcessingTimeMs,
        }),
      });
      console.log(`[Intelligent Stitch] API cost logged: ${creditsCharged} credits`);
    } catch (costError) {
      console.warn("[Intelligent Stitch] Failed to log API cost:", costError);
    }

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
