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

  // AUDIT FIX (charge-without-refund / stuck 'stitching'): parse the body ONCE
  // up front. The error handler previously did `await req.clone().json()` AFTER
  // the body was already consumed below, which throws ("Body already consumed")
  // — so the project was never reset to 'error' and stuck in 'stitching',
  // blocking retries. Reuse this parsed copy in both the main flow and catch.
  let parsedBody: Partial<FinalAssemblyRequest> = {};
  try { parsedBody = await req.json() as FinalAssemblyRequest; } catch { /* invalid/empty body — validated below */ }

  try {
    const { validateAuth, unauthorizedResponse, resolveEffectiveUserId, forbiddenResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const {
      projectId,
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
    } = parsedBody;
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

    // IDOR GUARD (audit): a non-service-role caller may only assemble a project
    // they own. resolveEffectiveUserId above pins userId to the JWT but does
    // not verify project ownership — without this, any authenticated user could
    // pass a victim's projectId and drive their final assembly.
    if (!auth.isServiceRole) {
      const { data: ownerRow } = await supabase
        .from('movie_projects').select('user_id').eq('id', projectId).maybeSingle();
      if (!ownerRow || ownerRow.user_id !== auth.userId) {
        return forbiddenResponse(corsHeaders, 'Forbidden: you do not own this project');
      }
    }

    // Step 1: Validate all clips are complete
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('id, title, status, pending_video_tasks, mode, pipeline_state')
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

    // ── EFFECTS PHASE: Breakout VFX (post-generation, pre-stitch) ──────────────
    // For breakout / Crossover projects, run each generated clip through the CPU
    // compositor (apply-breakout-vfx → Breakout VFX Cog) to paint the digital-UI
    // chrome + glass-shatter before stitching. TRIPLE-SAFE so this can never break
    // a render: (1) inert unless BREAKOUT_VFX_ENABLED='true', (2) only for projects
    // whose pipeline_state carries breakout params, (3) the stage itself fail-opens
    // to the original clip, and this whole block is wrapped to never block stitch.
    try {
      const bx = (project.pipeline_state as Record<string, unknown> | null)?.breakout as
        | { isBreakout?: boolean; platform?: string | null; templateSlug?: string | null; chromeKind?: string | null; recipeSlug?: string | null }
        | undefined;
      if (Deno.env.get('BREAKOUT_VFX_ENABLED') === 'true' && bx?.isBreakout && clips?.length) {
        console.log(`[FinalAssembly] Breakout VFX enabled — compositing ${clips.length} clip(s)`);
        for (const clip of clips) {
          if (!clip.video_url) continue;
          try {
            const r = await fetch(`${supabaseUrl}/functions/v1/apply-breakout-vfx`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
              body: JSON.stringify({
                clipUrl: clip.video_url,
                chromeKind: bx.chromeKind ?? bx.platform ?? 'tiktok',
                recipeSlug: bx.recipeSlug ?? bx.templateSlug ?? '',
                templateSlug: bx.templateSlug ?? '',
                aspect: aspectRatio ?? '9:16',
                projectId,
                shotId: String(clip.shot_index ?? clip.id),
              }),
            });
            const out = r.ok ? await r.json().catch(() => null) : null;
            if (out?.applied && out.url && out.url !== clip.video_url) {
              await supabase.from('video_clips').update({ video_url: out.url }).eq('id', clip.id);
              clip.video_url = out.url; // keep the in-memory list (used downstream) in sync
              console.log(`[FinalAssembly] Breakout VFX applied to clip ${clip.shot_index ?? clip.id}`);
            }
          } catch (e) {
            console.warn(`[FinalAssembly] Breakout VFX clip ${clip.id} failed (passthrough):`, e instanceof Error ? e.message : String(e));
          }
        }
      }
    } catch (e) {
      console.warn('[FinalAssembly] Breakout VFX stage skipped (non-fatal):', e instanceof Error ? e.message : String(e));
    }

    // Step 1.5 + 2 (MERGED): ATOMIC stitch claim. A single conditional UPDATE
    // is the race guard — only ONE concurrent invocation can flip a
    // non-stitching, non-completed project to 'stitching'. Losers update zero
    // rows and bail BEFORE seamless-stitcher (a billable Replicate render)
    // runs, so a re-delivered webhook / continue-production retry / parallel
    // call can no longer bill the project twice for the same film. (The old
    // read-then-check dedup raced: continue-production stamps 'generating'
    // before calling, so concurrent calls both read a non-'stitching' status
    // and both proceeded.)
    //
    // Composes with the retry-on-failure path: a failed stitch resets status
    // to 'error' in the catch below, so a legitimate retry re-claims cleanly;
    // an already-'completed' project is never re-stitched. forceReconcile (the
    // reconciliation flow) intentionally bypasses the guard to re-run a
    // stuck-in-stitching project.
    {
      let claimQuery = supabase
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

      if (!forceReconcile) {
        claimQuery = claimQuery.neq('status', 'stitching').neq('status', 'completed');
      }

      const { data: claimed, error: claimErr } = await claimQuery.select('id');
      if (claimErr) {
        throw new Error(`stitch claim failed: ${claimErr.message}`);
      }
      if (!forceReconcile && (!claimed || claimed.length === 0)) {
        console.warn(`[FinalAssembly] dedup: stitch already claimed by a concurrent invocation for ${projectId}`);
        return new Response(
          JSON.stringify({
            success: true,
            mode: "deduped",
            note: "stitch already claimed by a concurrent invocation; ignoring duplicate request",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

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

    // ────────────────────────────────────────────────────────────────────
    // RESILIENCE INVARIANT: a failed stitch must NEVER lose or hide the
    // user's generated footage. If the clips already exist (the expensive,
    // billable work succeeded), fall back to a clip playlist so the Library
    // ALWAYS plays the footage — regardless of why the stitch failed
    // (Replicate out-of-credit / 402, rate-limit / 429, model error, crash,
    // timeout). Only mark 'error' when there is genuinely nothing to show.
    // The project stays upgradeable: pending_video_tasks.needsStitch=true lets
    // a later forceReconcile produce the real crossfaded stitch when possible.
    // ────────────────────────────────────────────────────────────────────
    let degraded = false;
    let fallbackClipCount = 0;
    try {
      const body = parsedBody;
      if (body.projectId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: fbClips } = await supabase
          .from('video_clips')
          .select('shot_index, video_url, duration_seconds, thumbnail_url, last_frame_url')
          .eq('project_id', body.projectId)
          .not('video_url', 'is', null)
          .order('shot_index', { ascending: true });
        const clipUrls = (fbClips || []).map((c) => c.video_url).filter(Boolean) as string[];

        if (clipUrls.length > 0) {
          degraded = true;
          fallbackClipCount = clipUrls.length;
          const totalDuration = (fbClips || []).reduce((a, c) => a + (c.duration_seconds || 0), 0);
          // Always carry a poster so the Library shows a paused-frame thumbnail.
          const fbThumb = (fbClips || [])
            .map((c) => c.thumbnail_url || c.last_frame_url)
            .find(Boolean) || null;
          await supabase
            .from('movie_projects')
            .update({
              // Footage IS available → show it. The Library's StitchedVideo
              // plays every clip in shot order via projectId; video_url just
              // needs to be non-null for the card to render the player.
              status: 'completed',
              pipeline_stage: 'completed',
              video_url: clipUrls[0],
              thumbnail_url: fbThumb,
              pending_video_tasks: {
                stage: 'clips_fallback',
                mode: 'clips_fallback',
                progress: 100,
                mseClipUrls: clipUrls,
                clipCount: clipUrls.length,
                totalDuration,
                needsStitch: true,          // upgradeable to a real stitch later
                stitchError: errorMsg,      // preserved for ops/telemetry
                // Flag the out-of-credit case so the UI can show a top-up
                // banner. Footage still plays (clips), but the polished stitch
                // is deferred until the provider account is funded.
                billingBlocked: /\b402\b|insufficient credit|out of credit|payment required/i.test(errorMsg),
                fallbackAt: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', body.projectId);
          console.log(`[FinalAssembly] ♻️ Stitch failed (${errorMsg}) — surfaced ${clipUrls.length} clip(s) as playable fallback so footage is never lost`);
        } else {
          // Nothing was rendered → genuine error.
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
            .eq('id', body.projectId);
        }
      }
    } catch (updateErr) {
      console.error("[FinalAssembly] Failed to update fallback/error state:", updateErr);
    }

    // When footage was surfaced, report a degraded SUCCESS so callers stop
    // retrying a stitch that can't currently run — the user already has a
    // playable result. Otherwise surface the failure.
    if (degraded) {
      return new Response(
        JSON.stringify({
          success: true,
          degraded: true,
          mode: 'clips_fallback',
          clipsProcessed: fallbackClipCount,
          stitchError: errorMsg,
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
