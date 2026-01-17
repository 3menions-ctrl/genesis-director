import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Final Assembly - Professional Video Stitching Pipeline
 * 
 * Produces a complete, downloadable MP4 with:
 * 1. Intelligent transition analysis (motion, visual, semantic)
 * 2. AI bridge clip generation for gaps
 * 3. Audio continuity (voice + music sync + SFX)
 * 4. Color grading consistency
 * 5. FFmpeg rendering via Cloud Run
 * 
 * This is the "Veed-level" stitching orchestrator.
 */

interface AssemblyRequest {
  projectId: string;
  userId?: string;
  forceReassemble?: boolean;
  strictness?: 'lenient' | 'normal' | 'strict';
  maxBridgeClips?: number;
  outputQuality?: '720p' | '1080p' | '4k';
  bridgeThreshold?: number; // Force bridges for transitions scoring below this
}

interface ClipData {
  id: string;
  shotIndex: number;
  videoUrl: string;
  lastFrameUrl?: string;
  durationSeconds: number;
  prompt: string;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: AssemblyRequest = await req.json();
    const { 
      projectId, 
      userId,
      forceReassemble = false,
      strictness = 'strict', // CHANGED: Default to strict for guaranteed results
      maxBridgeClips = 10,   // INCREASED: Allow more bridge clips for better continuity
      outputQuality = '1080p',
      // NEW: Force bridge generation for all transitions below this score
      bridgeThreshold = 75   // Any transition scoring below 75% gets a bridge clip
    } = request;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[FinalAssembly] Starting assembly for project ${projectId}`);
    console.log(`[FinalAssembly] Settings: strictness=${strictness}, maxBridges=${maxBridgeClips}, quality=${outputQuality}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update project status
    await supabase
      .from('movie_projects')
      .update({ status: 'assembling' })
      .eq('id', projectId);

    // =====================================================
    // IRON-CLAD BEST CLIP SELECTION
    // Step 1: Load ALL completed clips with quality_score
    // Then select the BEST clip per shot_index (highest quality_score)
    // =====================================================
    console.log("[FinalAssembly] Step 1: Loading clips with quality scores...");
    
    const { data: allClips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, video_url, last_frame_url, duration_seconds, prompt, status, quality_score, created_at')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('shot_index')
      .order('quality_score', { ascending: false, nullsFirst: false });

    if (clipsError || !allClips || allClips.length === 0) {
      throw new Error(`No completed clips found for project ${projectId}`);
    }

    console.log(`[FinalAssembly] Found ${allClips.length} total completed clip versions`);
    
    // Select BEST clip per shot_index
    const bestClipsMap = new Map<number, typeof allClips[0]>();
    
    for (const clip of allClips) {
      const existing = bestClipsMap.get(clip.shot_index);
      
      if (!existing) {
        bestClipsMap.set(clip.shot_index, clip);
      } else {
        const existingScore = existing.quality_score ?? -1;
        const newScore = clip.quality_score ?? -1;
        
        if (newScore > existingScore) {
          bestClipsMap.set(clip.shot_index, clip);
          console.log(`[FinalAssembly] Shot ${clip.shot_index}: Upgraded to clip ${clip.id.substring(0, 8)} (score: ${newScore} > ${existingScore})`);
        } else if (newScore === existingScore && clip.created_at > existing.created_at) {
          bestClipsMap.set(clip.shot_index, clip);
        }
      }
    }
    
    const clips = Array.from(bestClipsMap.values()).sort((a, b) => a.shot_index - b.shot_index);
    
    // IRON-CLAD QUALITY GATE: Warn about low-quality clips
    const MINIMUM_QUALITY_THRESHOLD = 65;
    const lowQualityClips = clips.filter(c => c.quality_score !== null && c.quality_score < MINIMUM_QUALITY_THRESHOLD);
    const noScoreClips = clips.filter(c => c.quality_score === null);
    
    console.log(`[FinalAssembly] Selected ${clips.length} BEST clips from ${allClips.length} total versions:`);
    for (const clip of clips) {
      const qualityLabel = clip.quality_score === null ? 'N/A' : 
        clip.quality_score < MINIMUM_QUALITY_THRESHOLD ? `⚠️ ${clip.quality_score}` : `✓ ${clip.quality_score}`;
      console.log(`  Shot ${clip.shot_index}: ${clip.id.substring(0, 8)} (quality: ${qualityLabel})`);
    }
    
    if (lowQualityClips.length > 0) {
      console.warn(`[FinalAssembly] ⚠️ WARNING: ${lowQualityClips.length} clip(s) below quality threshold:`);
      lowQualityClips.forEach(c => console.warn(`  - Shot ${c.shot_index}: score ${c.quality_score}`));
    }
    
    if (noScoreClips.length > 0) {
      console.warn(`[FinalAssembly] ⚠️ ${noScoreClips.length} clip(s) have no quality score`);
    }

    // Step 2: Load project audio tracks including narration preference
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('voice_audio_url, music_url, pro_features_data, title, include_narration')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.warn(`[FinalAssembly] Could not load project:`, projectError);
    }

    // RESPECT include_narration flag - only include voice if EXPLICITLY enabled
    const includeNarration = project?.include_narration === true; // Default to FALSE - no narration unless requested
    const voiceAudioUrl = includeNarration ? project?.voice_audio_url : null;
    const musicUrl = project?.music_url;
    const proFeatures = project?.pro_features_data as any;

    console.log(`[FinalAssembly] Audio: include_narration=${includeNarration}, voice=${!!voiceAudioUrl}, music=${!!musicUrl}`);

    // Step 3: Analyze transitions using vision AI
    console.log("[FinalAssembly] Step 2: Analyzing transitions...");
    
    const transitions: Array<{
      fromIndex: number;
      toIndex: number;
      score: number;
      gapType: string;
      recommendedTransition: string;
      bridgeClipNeeded: boolean;
      bridgeClipPrompt?: string;
      bridgeClipUrl?: string;
    }> = [];

    for (let i = 0; i < clips.length - 1; i++) {
      const clip1 = clips[i];
      const clip2 = clips[i + 1];

      try {
        // Use vision AI to analyze the transition
        const gapResult = await callEdgeFunction('analyze-transition-gap', {
          fromClipUrl: clip1.video_url,
          toClipUrl: clip2.video_url,
          fromClipLastFrame: clip1.last_frame_url,
          toClipFirstFrame: null, // Will use video URL
          fromClipDescription: clip1.prompt,
          toClipDescription: clip2.prompt,
          strictness,
        });

        if (gapResult.success && gapResult.analysis) {
          const analysis = gapResult.analysis;
          transitions.push({
            fromIndex: i,
            toIndex: i + 1,
            score: analysis.overallScore,
            gapType: analysis.gapType,
            recommendedTransition: analysis.recommendedTransition === 'bridge-clip' ? 'ai-bridge' : analysis.recommendedTransition,
            bridgeClipNeeded: analysis.bridgeClipNeeded,
            bridgeClipPrompt: analysis.bridgeClipPrompt,
          });
          
          console.log(`[FinalAssembly] Transition ${i}→${i+1}: Score ${analysis.overallScore}, ${analysis.gapType}`);
        } else {
          // Default to dissolve if analysis fails
          transitions.push({
            fromIndex: i,
            toIndex: i + 1,
            score: 70,
            gapType: 'unknown',
            recommendedTransition: 'dissolve',
            bridgeClipNeeded: false,
          });
        }
      } catch (analysisError) {
        console.warn(`[FinalAssembly] Transition ${i}→${i+1} analysis failed:`, analysisError);
        transitions.push({
          fromIndex: i,
          toIndex: i + 1,
          score: 60,
          gapType: 'analysis_failed',
          recommendedTransition: 'dissolve',
          bridgeClipNeeded: false,
        });
      }
    }

    // =====================================================
    // MANDATORY BRIDGE CLIP GENERATION
    // Force bridges for ALL transitions below threshold score
    // This guarantees smooth visual continuity
    // =====================================================
    
    // Step 4a: Force bridge clips for low-score transitions
    const threshold = bridgeThreshold ?? 75;
    for (const transition of transitions) {
      if (transition.score < threshold) {
        transition.bridgeClipNeeded = true;
        if (!transition.bridgeClipPrompt) {
          const fromClip = clips[transition.fromIndex];
          const toClip = clips[transition.toIndex];
          transition.bridgeClipPrompt = `Smooth cinematic transition from ${fromClip.prompt?.substring(0, 50)} to ${toClip.prompt?.substring(0, 50)}. Maintain visual continuity.`;
        }
        console.log(`[FinalAssembly] Transition ${transition.fromIndex}→${transition.toIndex} score ${transition.score} < ${threshold} - FORCING bridge clip`);
      }
    }
    
    const bridgesNeeded = transitions.filter(t => t.bridgeClipNeeded);
    let bridgeClipsGenerated = 0;

    console.log(`[FinalAssembly] Step 3: Generating ${bridgesNeeded.length} bridge clips (mandatory for scores < threshold)...`);

    if (bridgesNeeded.length > 0) {
      const bridgesToGenerate = bridgesNeeded.slice(0, maxBridgeClips);
      
      for (const transition of bridgesToGenerate) {
        if (!transition.bridgeClipPrompt) continue;
        
        const fromClip = clips[transition.fromIndex];
        
        try {
          console.log(`[FinalAssembly] Generating MANDATORY bridge for transition ${transition.fromIndex}→${transition.toIndex} (score: ${transition.score})`);
          
          const bridgeResult = await callEdgeFunction('generate-bridge-clip', {
            projectId,
            userId,
            fromClipLastFrame: fromClip.last_frame_url || fromClip.video_url,
            bridgePrompt: transition.bridgeClipPrompt,
            durationSeconds: 3,
            sceneContext: {
              environment: fromClip.prompt?.substring(0, 100),
            },
          });
          
          if (bridgeResult.success && bridgeResult.videoUrl) {
            transition.bridgeClipUrl = bridgeResult.videoUrl;
            transition.recommendedTransition = 'cut';
            bridgeClipsGenerated++;
            console.log(`[FinalAssembly] ✓ Bridge generated: ${bridgeResult.videoUrl}`);
          } else {
            console.warn(`[FinalAssembly] ⚠️ Bridge generation returned no video, using dissolve fallback`);
            transition.recommendedTransition = 'dissolve';
            transition.bridgeClipNeeded = false;
          }
        } catch (bridgeError) {
          console.error(`[FinalAssembly] Bridge generation failed:`, bridgeError);
          transition.recommendedTransition = 'dissolve';
          transition.bridgeClipNeeded = false;
        }
      }
      
      console.log(`[FinalAssembly] Generated ${bridgeClipsGenerated}/${bridgesNeeded.length} bridge clips`);
    }

    // Step 5: Build final clip sequence with bridge clips
    console.log("[FinalAssembly] Step 4: Building final sequence...");
    
    const finalSequence: Array<{
      shotId: string;
      videoUrl: string;
      durationSeconds: number;
      transitionOut: string;
    }> = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const transition = transitions.find(t => t.fromIndex === i);
      
      // Add the clip
      finalSequence.push({
        shotId: clip.id,
        videoUrl: clip.video_url,
        durationSeconds: clip.duration_seconds || 6,
        transitionOut: transition?.recommendedTransition === 'ai-bridge' 
          ? 'cut' 
          : (transition?.recommendedTransition || 'cut'),
      });
      
      // Add bridge clip if generated
      if (transition?.bridgeClipUrl) {
        finalSequence.push({
          shotId: `bridge_${i}_${i+1}`,
          videoUrl: transition.bridgeClipUrl,
          durationSeconds: 3,
          transitionOut: 'cut',
        });
      }
    }

    console.log(`[FinalAssembly] Final sequence: ${finalSequence.length} clips (${clips.length} original + ${bridgeClipsGenerated} bridges)`);

    // Step 6: Call Cloud Run FFmpeg for final assembly
    console.log("[FinalAssembly] Step 5: Calling Cloud Run FFmpeg...");
    
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (!cloudRunUrl) {
      throw new Error("CLOUD_RUN_STITCHER_URL is not configured - cannot produce final MP4");
    }

    const resolution = outputQuality === '4k' ? '3840x2160' : outputQuality === '720p' ? '1280x720' : '1920x1080';

    const stitchPayload = {
      projectId,
      projectTitle: project?.title || `Video ${projectId}`,
      clips: finalSequence,
      voiceTrackUrl: voiceAudioUrl,
      backgroundMusicUrl: musicUrl,
      audioMixMode: (voiceAudioUrl || musicUrl) ? 'full' : 'mute',
      // Mute native video audio (Kling 2.6 generates audio with clips) - keep only background music
      muteNativeAudio: !includeNarration,
      outputFormat: 'mp4',
      colorGrading: 'cinematic',
      transitionType: 'dissolve',
      transitionDuration: 0.05,
      // Pass any music sync data
      musicSyncPlan: proFeatures?.musicSyncPlan,
      sfxPlan: proFeatures?.sfxPlan,
    };

    console.log(`[FinalAssembly] Sending ${finalSequence.length} clips to Cloud Run...`);

    const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
    const stitchResponse = await fetch(`${normalizedUrl}/stitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stitchPayload),
    });

    if (!stitchResponse.ok) {
      const errorText = await stitchResponse.text();
      console.error(`[FinalAssembly] Cloud Run error: ${errorText}`);
      throw new Error(`Cloud Run stitching failed: ${stitchResponse.status}`);
    }

    const stitchResult = await stitchResponse.json();

    if (!stitchResult.success || !stitchResult.finalVideoUrl) {
      throw new Error(stitchResult.error || 'Cloud Run returned no video URL');
    }

    console.log(`[FinalAssembly] Final video URL: ${stitchResult.finalVideoUrl}`);

    // Step 7: Update project with final video
    const { error: updateError } = await supabase
      .from('movie_projects')
      .update({
        video_url: stitchResult.finalVideoUrl,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) {
      console.warn(`[FinalAssembly] Failed to update project:`, updateError);
    }

    const totalProcessingTime = Date.now() - startTime;
    console.log(`[FinalAssembly] Complete in ${(totalProcessingTime / 1000).toFixed(1)}s`);

    // Log API cost
    if (userId) {
      try {
        await supabase.rpc('log_api_cost', {
          p_project_id: projectId,
          p_shot_id: 'final_assembly',
          p_service: 'cloud_run_stitcher',
          p_operation: 'final_assembly',
          p_credits_charged: 5 + (bridgeClipsGenerated * 10), // 5 base + 10 per bridge
          p_real_cost_cents: 10 + (bridgeClipsGenerated * 50),
          p_duration_seconds: Math.round(stitchResult.durationSeconds || 0),
          p_status: 'completed',
          p_metadata: JSON.stringify({
            clipsCount: clips.length,
            bridgeClipsGenerated,
            transitionsAnalyzed: transitions.length,
            processingTimeMs: totalProcessingTime,
          }),
        });
      } catch (costError) {
        console.warn('[FinalAssembly] Failed to log cost:', costError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        finalVideoUrl: stitchResult.finalVideoUrl,
        durationSeconds: stitchResult.durationSeconds,
        clipsProcessed: clips.length,
        bridgeClipsGenerated,
        transitionsAnalyzed: transitions.length,
        processingTimeMs: totalProcessingTime,
        downloadable: true,
        format: 'mp4',
        resolution,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[FinalAssembly] Error:", error);
    
    // Update project status to failed
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase
        .from('movie_projects')
        .update({ status: 'assembly_failed' })
        .eq('id', (await req.json()).projectId);
    } catch {}

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
