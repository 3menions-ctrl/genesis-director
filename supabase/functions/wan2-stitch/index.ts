import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Wan 2.1 Stitch Pipeline
 * 
 * Uses Alibaba's Wan 2.1 model to generate AI-powered transitions between clips.
 * Flow:
 * 1. Analyze transitions between consecutive clips
 * 2. Generate Wan 2.1 bridge clips for problematic transitions
 * 3. Build final sequence with bridge clips inserted
 * 4. Send to Cloud Run FFmpeg for final assembly
 * 
 * This provides smoother, more cinematic transitions than simple dissolves.
 */

interface Wan2StitchRequest {
  projectId: string;
  userId?: string;
  // Transition generation options
  maxBridgeClips?: number;         // Max number of AI bridge clips to generate (default: 3)
  transitionThreshold?: number;    // Score below which to generate bridge (0-100, default: 70)
  bridgeDurationSeconds?: number;  // Duration of each bridge clip (default: 3)
  resolution?: "480p" | "720p";    // Wan 2.1 resolution
  // Audio options
  includeNarration?: boolean;
  // Skip transition analysis (generate bridges for all)
  forceAllBridges?: boolean;
}

interface ClipData {
  shotId: string;
  videoUrl: string;
  lastFrameUrl?: string;
  firstFrameUrl?: string;
  durationSeconds: number;
  shotIndex: number;
}

interface TransitionAnalysis {
  fromIndex: number;
  toIndex: number;
  score: number;
  needsBridge: boolean;
  bridgePrompt?: string;
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

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: Wan2StitchRequest = await req.json();
    const {
      projectId,
      userId,
      maxBridgeClips = 3,
      transitionThreshold = 70,
      bridgeDurationSeconds = 4,
      resolution = "480p",
      includeNarration = false,
      forceAllBridges = false,
    } = request;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[Wan2Stitch] Starting Wan 2.1 stitch for project: ${projectId}`);
    console.log(`[Wan2Stitch] Config: maxBridges=${maxBridgeClips}, threshold=${transitionThreshold}, duration=${bridgeDurationSeconds}s`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =====================================================
    // Step 1: Load best clips for each shot
    // =====================================================
    console.log("[Wan2Stitch] Step 1: Loading clips...");

    const { data: allClips, error: clipsError } = await supabase
      .from("video_clips")
      .select("id, shot_index, video_url, last_frame_url, duration_seconds, quality_score, motion_vectors")
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("shot_index")
      .order("quality_score", { ascending: false, nullsFirst: false });

    if (clipsError || !allClips || allClips.length === 0) {
      throw new Error("No completed clips found");
    }

    // Select best clip per shot
    const bestClipsMap = new Map<number, typeof allClips[0]>();
    for (const clip of allClips) {
      const existing = bestClipsMap.get(clip.shot_index);
      if (!existing || (clip.quality_score || 0) > (existing.quality_score || 0)) {
        bestClipsMap.set(clip.shot_index, clip);
      }
    }

    const clips: ClipData[] = Array.from(bestClipsMap.values())
      .sort((a, b) => a.shot_index - b.shot_index)
      .map(c => ({
        shotId: c.id,
        videoUrl: c.video_url,
        lastFrameUrl: c.last_frame_url,
        firstFrameUrl: (c.motion_vectors as any)?.firstFrameUrl,
        durationSeconds: c.duration_seconds || 6,
        shotIndex: c.shot_index,
      }));

    console.log(`[Wan2Stitch] Loaded ${clips.length} clips`);

    // Get project details
    const { data: project } = await supabase
      .from("movie_projects")
      .select("title, voice_audio_url, music_url, user_id")
      .eq("id", projectId)
      .single();

    // Update project status
    await supabase
      .from("movie_projects")
      .update({
        status: "stitching",
        pending_video_tasks: {
          stage: "wan2_stitch",
          progress: 10,
          mode: "wan2_ai_transitions",
          clipCount: clips.length,
          maxBridges: maxBridgeClips,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    // Return immediately - process in background
    const responsePayload = {
      success: true,
      message: "Wan 2.1 stitching started in background",
      projectId,
      clipCount: clips.length,
      maxBridgeClips,
      mode: "wan2_ai_transitions",
    };

    // Background processing
    const backgroundProcess = async () => {
      const bgSupabase = createClient(supabaseUrl, supabaseKey);

      const updateProgress = async (progress: number, step: string, extra?: Record<string, unknown>) => {
        await bgSupabase
          .from("movie_projects")
          .update({
            pending_video_tasks: {
              stage: "wan2_stitch",
              progress,
              currentStep: step,
              mode: "wan2_ai_transitions",
              clipCount: clips.length,
              ...extra,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", projectId);
      };

      try {
        // =====================================================
        // Step 2: Analyze transitions between clips
        // =====================================================
        console.log("[Wan2Stitch] Step 2: Analyzing transitions...");
        await updateProgress(15, "Analyzing transitions");

        const transitions: TransitionAnalysis[] = [];

        for (let i = 0; i < clips.length - 1; i++) {
          const fromClip = clips[i];
          const toClip = clips[i + 1];

          if (forceAllBridges) {
            // Force bridge for all transitions
            transitions.push({
              fromIndex: i,
              toIndex: i + 1,
              score: 0,
              needsBridge: true,
              bridgePrompt: `Smooth cinematic transition from scene ${i + 1} to scene ${i + 2}, maintaining visual continuity`,
            });
          } else {
            // Analyze transition using vision AI
            try {
              const analysis = await callEdgeFunction("analyze-transition-gap", {
                fromClipUrl: fromClip.videoUrl,
                toClipUrl: toClip.videoUrl,
                fromClipLastFrame: fromClip.lastFrameUrl,
                toClipFirstFrame: toClip.firstFrameUrl,
                strictness: "normal",
              });

              if (analysis.success && analysis.analysis) {
                const needsBridge = analysis.analysis.overallScore < transitionThreshold;
                transitions.push({
                  fromIndex: i,
                  toIndex: i + 1,
                  score: analysis.analysis.overallScore,
                  needsBridge,
                  bridgePrompt: analysis.analysis.bridgeClipPrompt,
                });

                console.log(`[Wan2Stitch] Transition ${i}→${i + 1}: score=${analysis.analysis.overallScore}, needsBridge=${needsBridge}`);
              } else {
                // Fallback: assume needs bridge
                transitions.push({
                  fromIndex: i,
                  toIndex: i + 1,
                  score: 50,
                  needsBridge: true,
                  bridgePrompt: `Smooth transition from shot ${i + 1} to shot ${i + 2}`,
                });
              }
            } catch (analysisError) {
              console.warn(`[Wan2Stitch] Transition analysis failed for ${i}→${i + 1}:`, analysisError);
              // Use dissolve fallback
              transitions.push({
                fromIndex: i,
                toIndex: i + 1,
                score: 75,
                needsBridge: false,
              });
            }
          }

          await updateProgress(15 + Math.floor((i / (clips.length - 1)) * 15), `Analyzing transition ${i + 1}/${clips.length - 1}`);
        }

        const bridgesNeeded = transitions.filter(t => t.needsBridge).slice(0, maxBridgeClips);
        console.log(`[Wan2Stitch] Need ${bridgesNeeded.length} bridge clips (capped at ${maxBridgeClips})`);

        // =====================================================
        // Step 3: Generate Wan 2.1 bridge clips
        // =====================================================
        console.log("[Wan2Stitch] Step 3: Generating Wan 2.1 bridge clips...");
        await updateProgress(35, `Generating ${bridgesNeeded.length} AI bridge clips`);

        const bridgeClips: Map<number, string> = new Map();

        for (let i = 0; i < bridgesNeeded.length; i++) {
          const transition = bridgesNeeded[i];
          const fromClip = clips[transition.fromIndex];
          const toClip = clips[transition.toIndex];

          console.log(`[Wan2Stitch] Generating bridge ${i + 1}/${bridgesNeeded.length} for transition ${transition.fromIndex}→${transition.toIndex}`);
          await updateProgress(35 + Math.floor((i / bridgesNeeded.length) * 40), `Generating bridge ${i + 1}/${bridgesNeeded.length}`);

          try {
            const bridgeResult = await callEdgeFunction("wan2-bridge-clip", {
              projectId,
              userId,
              fromClipLastFrame: fromClip.lastFrameUrl || fromClip.videoUrl,
              toClipFirstFrame: toClip.firstFrameUrl,
              bridgePrompt: transition.bridgePrompt || "Smooth cinematic transition",
              durationSeconds: bridgeDurationSeconds,
              resolution,
            });

            if (bridgeResult.success && bridgeResult.videoUrl) {
              bridgeClips.set(transition.fromIndex, bridgeResult.videoUrl);
              console.log(`[Wan2Stitch] ✓ Bridge ${i + 1} generated: ${bridgeResult.videoUrl}`);

              // Mark transition as having a bridge
              transition.needsBridge = false; // Bridge generated successfully
            } else {
              console.warn(`[Wan2Stitch] Bridge ${i + 1} generation failed:`, bridgeResult.error);
            }
          } catch (bridgeError) {
            console.error(`[Wan2Stitch] Bridge ${i + 1} error:`, bridgeError);
            // Continue with other bridges
          }
        }

        console.log(`[Wan2Stitch] Generated ${bridgeClips.size}/${bridgesNeeded.length} bridge clips`);

        // =====================================================
        // Step 4: Build final sequence with bridges
        // =====================================================
        console.log("[Wan2Stitch] Step 4: Building final sequence...");
        await updateProgress(80, "Building final sequence");

        interface SequenceClip {
          shotId: string;
          videoUrl: string;
          durationSeconds: number;
          transitionOut?: string;
          isBridge?: boolean;
        }

        const finalSequence: SequenceClip[] = [];

        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];

          // Add the main clip
          finalSequence.push({
            shotId: clip.shotId,
            videoUrl: clip.videoUrl,
            durationSeconds: clip.durationSeconds,
            transitionOut: bridgeClips.has(i) ? "cut" : "dissolve",
          });

          // Insert bridge clip if generated
          if (bridgeClips.has(i)) {
            const bridgeUrl = bridgeClips.get(i)!;
            finalSequence.push({
              shotId: `bridge_${i}_${i + 1}`,
              videoUrl: bridgeUrl,
              durationSeconds: bridgeDurationSeconds,
              transitionOut: "cut",
              isBridge: true,
            });
          }
        }

        console.log(`[Wan2Stitch] Final sequence: ${finalSequence.length} items (${clips.length} clips + ${bridgeClips.size} bridges)`);

        // =====================================================
        // Step 5: Send to Cloud Run for final assembly
        // =====================================================
        console.log("[Wan2Stitch] Step 5: Sending to Cloud Run for assembly...");
        await updateProgress(85, "Assembling final video");

        const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
        if (!cloudRunUrl) {
          throw new Error("CLOUD_RUN_STITCHER_URL not configured");
        }

        const hasVoice = includeNarration && !!project?.voice_audio_url;
        const hasMusic = !!project?.music_url;

        const stitchRequest = {
          projectId,
          projectTitle: project?.title || "Video",
          clips: finalSequence.map(c => ({
            shotId: c.shotId,
            videoUrl: c.videoUrl,
            durationSeconds: c.durationSeconds,
            transitionOut: c.transitionOut || "dissolve",
          })),
          audioMixMode: hasVoice ? "voice_over" : hasMusic ? "background_music" : "mute",
          voiceTrackUrl: hasVoice ? project?.voice_audio_url : null,
          backgroundMusicUrl: project?.music_url || null,
          voiceVolume: 1.0,
          musicVolume: hasVoice ? 0.3 : 0.8,
          transitionType: "dissolve",
          transitionDuration: 0.15, // Short dissolves between non-bridge clips
          colorGrading: "cinematic",
          callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
          callbackServiceKey: supabaseKey,
          supabaseUrl: Deno.env.get("EXTERNAL_SUPABASE_URL") || supabaseUrl,
          supabaseServiceKey: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || supabaseKey,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout

        try {
          const response = await fetch(`${cloudRunUrl}/stitch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stitchRequest),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const result = await response.json();

            if (result.success && result.videoUrl) {
              // Immediate completion
              await bgSupabase
                .from("movie_projects")
                .update({
                  status: "completed",
                  video_url: result.videoUrl,
                  pending_video_tasks: {
                    stage: "completed",
                    progress: 100,
                    mode: "wan2_ai_transitions",
                    bridgesGenerated: bridgeClips.size,
                    finalVideoUrl: result.videoUrl,
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq("id", projectId);

              console.log(`[Wan2Stitch] ✅ COMPLETE: ${result.videoUrl}`);
            } else if (result.async || result.processing) {
              // Async processing - finalize-stitch will handle completion
              await updateProgress(90, "Processing on Cloud Run");
              console.log("[Wan2Stitch] Cloud Run processing async - will complete via callback");
            } else {
              throw new Error("Cloud Run returned unexpected response");
            }
          } else {
            const errorText = await response.text();
            throw new Error(`Cloud Run error: ${response.status} - ${errorText.substring(0, 200)}`);
          }
        } catch (cloudRunError) {
          clearTimeout(timeoutId);
          throw cloudRunError;
        }
      } catch (error) {
        console.error("[Wan2Stitch] Background error:", error);

        await bgSupabase
          .from("movie_projects")
          .update({
            status: "stitching_failed",
            last_error: error instanceof Error ? error.message : "Unknown error",
            pending_video_tasks: {
              stage: "failed",
              progress: 0,
              error: error instanceof Error ? error.message : "Unknown error",
              mode: "wan2_ai_transitions",
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", projectId);
      }
    };

    // Execute in background
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(backgroundProcess());
    } else {
      backgroundProcess();
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Wan2Stitch] Error:", error);

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
