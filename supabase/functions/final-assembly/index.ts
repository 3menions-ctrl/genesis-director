import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * FINAL-ASSEMBLY Edge Function v1.0
 * 
 * Post-production orchestrator that:
 * 1. Validates all clips are complete
 * 2. Triggers seamless-stitcher for manifest creation
 * 3. Updates project status to completed
 * 
 * CHECKPOINTS:
 * - CHECKPOINT D: Stitching started
 * - CHECKPOINT E: Final video produced
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FinalAssemblyRequest {
  projectId: string;
  userId?: string;
  forceReconcile?: boolean; // When true, clear any previous error state
  /** Project-level master loudness preset — forwarded as-is to
   *  seamless-stitcher, which applies a `loudnorm` filter after the
   *  audio xfade chain so the export ships at the right LUFS for the
   *  delivery platform. Omitted / "off" → no normalization. */
  masterLoudness?: "off" | "streaming" | "podcast" | "broadcast" | "cinema";
  /** Auto-duck music under voice — forwarded to seamless-stitcher
   *  which sidechains each aux audio track off A1 so the music dips
   *  whenever dialogue is present. */
  autoDuck?: boolean;
  /** Per-boundary transition data — forwarded to seamless-stitcher so
   *  the FFmpeg xfade filter uses the exact kind/duration the user
   *  authored on the timeline. */
  transitions?: Array<{ fromClipId: string; toClipId: string; kind: string; durationSec: number }>;
  transitionDuration?: number;
  transitionType?: string;
  /** Aspect ratio override for this render. */
  aspectRatio?: string;
  reframe?: boolean;
  /** Resolution preset for this render — "720p", "1080p", "1440p", "4k", "8k". */
  resolution?: string;
  /** Output container — "mp4" (default), "mov", "webm", "gif". */
  format?: string;
  /** CRF quality override (libx264 / libvpx). */
  crf?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  // Hoisted above the try so the catch can write the project's error state.
  // PREVIOUSLY the catch did `await req.clone().json()`, but the body was
  // already consumed by the `await req.json()` below, so clone() threw
  // TypeError and the project was NEVER marked 'error' — it stayed stuck in
  // 'stitching' relying entirely on the watchdog.
  let projectId: string | undefined;

  try {
    const { validateAuth, unauthorizedResponse, resolveEffectiveUserId, forbiddenResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const {
      projectId: bodyProjectId,
      userId: bodyUserId,
      forceReconcile,
      masterLoudness,
      autoDuck,
      transitions,
      transitionDuration,
      transitionType,
      aspectRatio,
      reframe,
      resolution,
      format,
      crf,
    } = await req.json() as FinalAssemblyRequest;
    projectId = bodyProjectId;
    // SECURITY: trust JWT, never the body, for end-user calls
    let userId: string | undefined;
    try {
      userId = bodyUserId !== undefined || !auth.isServiceRole
        ? resolveEffectiveUserId(auth, bodyUserId)
        : undefined;
    } catch (e) {
      return forbiddenResponse(corsHeaders, (e as Error).message);
    }

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[FinalAssembly] CHECKPOINT D: Stitching started for project: ${projectId}${forceReconcile ? ' (RECONCILIATION MODE)' : ''}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Validate all clips are complete
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('id, title, status, pending_video_tasks, mode')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message || 'Unknown'}`);
    }

    // Get expected clip count
    const tasks = project.pending_video_tasks as Record<string, unknown> | null;
    const expectedClipCount = (tasks?.clipCount as number) || 5;

    // Count clips with a playable video_url. We no longer require
    // status='completed' — the editor surfaces any clip with a
    // video_url, and the render must include everything the user can
    // see on the timeline. The old filter dropped library-imported
    // and user-uploaded clips that weren't flagged 'completed' yet.
    const { data: clips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, video_url, duration_seconds, status, created_at')
      .eq('project_id', projectId)
      .not('video_url', 'is', null)
      .order('created_at', { ascending: true });

    if (clipsError) {
      throw new Error(`Failed to fetch clips: ${clipsError.message}`);
    }

    const completedCount = clips?.length || 0;
    console.log(`[FinalAssembly] Validated: ${completedCount}/${expectedClipCount} clips with video_url`);

    if (completedCount === 0) {
      throw new Error('No clips with a video_url found - the timeline has nothing to render');
    }

    // Log clip details for debugging
    clips?.forEach((clip, i) => {
      console.log(`[FinalAssembly] Clip ${i + 1}: ${clip.video_url?.substring(0, 60)}... (${clip.duration_seconds}s)`);
    });

    // Step 1.5: Dedup guard. If another final-assembly call already
    // stamped pipeline_stage='stitching' in the last ~2 minutes, treat
    // this as a duplicate (rapid double-click, double-tab, retry) and
    // return 409. Without this, two parallel calls each invoke
    // seamless-stitcher and Replicate bills the project twice for
    // the same hash.
    //
    // forceReconcile bypasses this guard — the reconciliation flow
    // explicitly wants to re-run on a stuck-in-stitching project.
    if (!forceReconcile) {
      const tasksObj = tasks ?? {};
      const startedAtIso = (tasksObj as { assemblyStartedAt?: string }).assemblyStartedAt;
      const inFlight =
        project.status === "stitching" &&
        startedAtIso &&
        Date.now() - Date.parse(startedAtIso) < 2 * 60 * 1000;
      if (inFlight) {
        console.warn(`[FinalAssembly] dedup: stitching already in flight (started ${startedAtIso})`);
        return new Response(
          JSON.stringify({
            success: true,
            mode: "deduped",
            note: "stitching already in flight for this project; ignoring duplicate request",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Step 2: Update status to stitching
    await supabase
      .from('movie_projects')
      .update({
        pipeline_stage: 'stitching',
        status: 'stitching',
        pending_video_tasks: {
          ...(tasks || {}),
          stage: 'stitching',
          progress: 92,
          assemblyStartedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    // Step 3: Call seamless-stitcher for manifest creation
    console.log(`[FinalAssembly] Invoking seamless-stitcher for manifest creation...`);
    
    const stitchResponse = await fetch(`${supabaseUrl}/functions/v1/seamless-stitcher`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        projectId,
        userId,
        masterLoudness,
        autoDuck,
        // Forward transition + aspect data so seamless-stitcher
        // renders the boundaries the user authored, at the right
        // aspect. Was silently lost before — every export came out
        // as hard cuts at 16:9 regardless of timeline state.
        transitions,
        transitionDuration,
        transitionType,
        aspectRatio,
        reframe,
        resolution,
        format,
        crf,
      }),
    });

    if (!stitchResponse.ok) {
      const errorText = await stitchResponse.text();
      throw new Error(`seamless-stitcher failed: ${stitchResponse.status} ${errorText}`);
    }

    const stitchResult = await stitchResponse.json();
    
    if (!stitchResult.success) {
      throw new Error(`seamless-stitcher returned error: ${stitchResult.error}`);
    }

    if (stitchResult.mode === 'server_stitching' && !stitchResult.finalVideoUrl) {
      console.log(`[FinalAssembly] Server MP4 stitch still processing; leaving project in stitching until webhook finalizes`);
      return new Response(
        JSON.stringify({
          success: true,
          checkpoints: { D: 'stitching_started' },
          mode: 'server_stitching',
          stitchPredictionId: stitchResult.stitchPredictionId,
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const manifestUrl = stitchResult.manifestUrl || stitchResult.finalVideoUrl;
    const finalVideoUrl = stitchResult.finalVideoUrl || manifestUrl;
    const hlsPlaylistUrl = stitchResult.hlsPlaylistUrl || null;

    // Guard: a synchronous stitch that reports success MUST carry a
    // usable video URL. Previously a `{ success: true, finalVideoUrl:
    // undefined }` response sailed through and the Library card
    // rendered a blank, unplayable entry. Treat a missing URL as a
    // failure so the caller surfaces it instead of shipping a ghost.
    if (!finalVideoUrl || typeof finalVideoUrl !== "string" || !finalVideoUrl.startsWith("http")) {
      throw new Error(
        "seamless-stitcher reported success but returned no usable finalVideoUrl",
      );
    }
    const stitchedClipUrls = Array.isArray(stitchResult.clipUrls) ? stitchResult.clipUrls : clips?.map((clip) => clip.video_url).filter(Boolean) || [];
    const totalDuration = stitchResult.totalDuration || 0;
    const clipsProcessed = stitchResult.clipsProcessed || completedCount;

    console.log(`[FinalAssembly] CHECKPOINT E: Final video produced`);
    console.log(`[FinalAssembly] - Path: ${manifestUrl}`);
    console.log(`[FinalAssembly] - Clips: ${clipsProcessed}`);
    console.log(`[FinalAssembly] - Duration: ${totalDuration}s`);

    // Step 4: Final status update with FORCED RECONCILIATION
    // CRITICAL: This update MUST clear any previous 'failed' or 'error' status
    // when all clips have successfully completed. This is the final authority.
    const finalUpdate = {
      status: 'completed',
      pipeline_stage: 'completed', // Use 'completed' not 'complete' to match DB constraint
      video_url: finalVideoUrl,
      pending_video_tasks: {
        stage: 'complete',
        progress: 100,
        mode: stitchResult.stitchedVideoUrl ? 'server_stitched_mp4' : 'single_clip',
        stitchedVideoUrl: stitchResult.stitchedVideoUrl || null,
        stitchPredictionId: stitchResult.stitchPredictionId || null,
        manifestUrl,
        finalVideoUrl,
        hlsPlaylistUrl,
        mseClipUrls: stitchedClipUrls,
        clipCount: clipsProcessed,
        totalDuration,
        completedAt: new Date().toISOString(),
        assemblyTimeMs: Date.now() - startTime,
        reconciled: forceReconcile || false,
        previousStatus: project.status, // Track what we're overwriting
      },
      updated_at: new Date().toISOString(),
    };
    
    // Log if we're overwriting a failed/error status
    if (project.status === 'failed' || project.status === 'error') {
      console.log(`[FinalAssembly] ⚠️ RECONCILIATION: Overwriting '${project.status}' → 'completed' (${clipsProcessed} clips verified)`);
    }
    
    await supabase
      .from('movie_projects')
      .update(finalUpdate)
      .eq('id', projectId);

    console.log(`[FinalAssembly] ✅ Assembly complete in ${Date.now() - startTime}ms`);

    // CREDIT RECONCILIATION: project succeeded — consume the hold (idempotent).
    try {
      const { consumePipelineCredits } = await import('../_shared/pipeline-credits.ts');
      const consumed = await consumePipelineCredits({
        supabase,
        projectId,
        description: 'Project completed (final-assembly)',
        clipDuration: Math.round(totalDuration || 0) || null,
      });
      if (consumed.success) {
        console.log(`[FinalAssembly] ✓ Credit hold consumed (reused=${consumed.reused})`);
      } else {
        console.warn(`[FinalAssembly] Credit hold consume non-fatal failure:`, consumed.error);
      }
    } catch (creditErr) {
      console.warn('[FinalAssembly] consume credit hold threw (non-fatal):', creditErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkpoints: {
          D: 'stitching_started',
          E: 'final_video_produced',
        },
        manifestUrl,
        finalVideoUrl,
        clipsProcessed,
        totalDuration,
        processingTimeMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[FinalAssembly] Error:", errorMsg);
    
    // Try to update project with error state. Use the hoisted `projectId`
    // (parsed once above) — re-cloning the already-consumed request body here
    // throws and silently skipped this write.
    try {
      if (projectId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from('movie_projects')
          .update({
            status: 'error',
            pending_video_tasks: {
              stage: 'assembly_error',
              error: errorMsg,
              errorAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);
      }
    } catch (updateErr) {
      console.error("[FinalAssembly] Failed to update error state:", updateErr);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
