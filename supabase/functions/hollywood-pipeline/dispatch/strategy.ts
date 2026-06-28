// ═══════════════════════════════════════════════════════════════════════════
// dispatch/strategy.ts — PLUGGABLE DISPATCH STRATEGY for the unified orchestrator
//
// hollywood-pipeline's Phase A (prep: script, identity bible, scene images,
// continuity anchors, golden frame) is engine-agnostic. Phase B (how clips are
// actually dispatched to the spine `generate-single-clip`) is the ONLY thing
// that forks by engine:
//
//   • SEQUENTIAL (kling/veo/wan/runway/sora): callback-chained, one clip per
//     invocation, native audio per clip. This lives inline in index.ts and is
//     unchanged — `selectDispatchStrategy` returns 'sequential' and the existing
//     loop runs.
//   • PARALLEL (seedance): Promise.allSettled batch dispatch, last_frame_image
//     inter-scene continuity, NO native audio → voice/music generated up-front
//     and muxed POST-stitch by the watchdog + seamless-stitcher. Ported here
//     from the legacy seedance-pipeline onto the same spine.
//
// Both strategies call the SAME spine (generate-single-clip) and produce the
// SAME `pending_video_tasks` contract the watchdog/stitcher already consume.
// ═══════════════════════════════════════════════════════════════════════════

import type { BackendEngine } from "../../_shared/production-request.ts";

export type DispatchKind = "sequential" | "parallel";

export interface EngineDispatchProfile {
  engine: BackendEngine;
  kind: DispatchKind;
  // Native audio in-clip? (false → post-mux). Mirrors resolveAudioStrategy.
  nativeAudio: boolean;
  // Seedance-only: target end-frame interpolation (last_frame_image).
  endFrameInterp: boolean;
}

// Pure selector — strategy is a deterministic function of the resolved engine,
// so a RESUMED project (engine-lock recovered before this call) picks the same
// strategy every time. Regression mitigation #11.
export function selectDispatchStrategy(
  engine: BackendEngine | string | undefined,
): DispatchKind {
  return engine === "seedance" ? "parallel" : "sequential";
}

export function engineProfile(engine: BackendEngine): EngineDispatchProfile {
  const nativeAudio = engine !== "seedance"; // kling/veo/sora/runway/wan = true
  return {
    engine,
    kind: selectDispatchStrategy(engine),
    nativeAudio,
    endFrameInterp: engine === "seedance",
  };
}

// Phase-A-produced state packaged for Phase B. PURE assembly — no derivation.
export interface DispatchContext {
  clips: Array<{ index: number; prompt: string; sceneContext?: any }>;
  sceneImageLookup: Record<number, string>;
  startIndex: number;
  previousLastFrameUrl?: string;
  accumulatedAnchors: any[];
  masterSceneAnchor: any;
  styleAnchor: any;
  goldenFrameData: any;
  referenceImageUrl?: string;
  tierLimits: any;
  // Resolved engine + format
  videoEngine: BackendEngine;
  isAvatarMode: boolean;
  aspectRatio: "16:9" | "9:16" | "1:1";
  clipDuration: number;
  clipCount: number;
  cameraFixed: boolean;
  // Audio (post-mux). Seedance has NO native audio, so voice/music are muxed
  // onto the stitched video by the watchdog. These URLs are HARVESTED from
  // hollywood's engine-agnostic assets stage (state.assets) — the parallel
  // strategy does NOT regenerate audio (would double-generate + double-charge).
  includeVoice: boolean;
  includeMusic: boolean;
  voiceAudioUrl?: string | null;
  musicAudioUrl?: string | null;
  scriptShots: Array<{ dialogue?: string; voiceover?: string; narration?: string; description?: string }>;
  // Identity
  projectId: string;
  userId: string;
}

export interface DispatchDeps {
  supabase: any;
  // hollywood-pipeline's service-role edge caller (used for generate-single-clip,
  // generate-voice, generate-music).
  callEdgeFunction: (name: string, body: any, options?: any) => Promise<any>;
}

export function buildDispatchContext(
  ctx: DispatchContext,
): DispatchContext {
  // Pure pass-through assembly. Kept as a named seam so callers read clearly
  // and a future field addition has one home.
  return ctx;
}

// ─── PARALLEL strategy (seedance) ────────────────────────────────────────────
// Port of legacy seedance-pipeline:733–999 onto the spine. Mutates and returns
// `state`; the caller (runProduction) returns it and the outer early-stop guard
// (`_exitClipLoopNow`) halts this invocation so the watchdog finishes the job.
export async function dispatchParallel(
  ctx: DispatchContext,
  state: any,
  request: any,
  deps: DispatchDeps,
): Promise<any> {
  const { supabase, callEdgeFunction } = deps;
  const {
    clips, sceneImageLookup, aspectRatio, clipDuration, clipCount, cameraFixed,
    includeVoice, includeMusic, scriptShots,
    projectId, userId,
  } = ctx;

  console.log(`[Hollywood][Parallel] Seedance batch dispatch — ${clips.length} clips, cameraFixed=${cameraFixed}`);

  // ═══ AUDIO — HARVEST from hollywood's assets stage (do NOT regenerate) ═══
  // Seedance has NO native audio, so voice/music are muxed onto the stitched
  // video by the watchdog. hollywood's engine-agnostic runAssetCreation stage
  // already generated (and charged) the voice/music; we harvest those URLs and
  // hand them to the post-stitch mux contract. Regenerating here would
  // double-generate and double-charge audio.
  const voiceAudioUrl = ctx.voiceAudioUrl || null;
  const musicAudioUrl = ctx.musicAudioUrl || null;
  const audioAssets: Record<string, any> = {};
  if (voiceAudioUrl) audioAssets.voice = voiceAudioUrl;
  if (musicAudioUrl) audioAssets.music = musicAudioUrl;
  console.log(`[Hollywood][Parallel] Audio assets harvested: ${Object.keys(audioAssets).join(",") || "(none)"}`);
  // Mirror onto movie_projects columns the stitcher reads (idempotent — assets
  // stage may have already written these).
  if (voiceAudioUrl || musicAudioUrl) {
    await supabase.from("movie_projects").update({
      voice_audio_url: voiceAudioUrl,
      music_url: musicAudioUrl,
    }).eq("id", projectId);
  }

  // ═══ DISPATCH (parallel) ═══
  await supabase.from("movie_projects").update({
    pipeline_stage: "production",
    pending_video_tasks: {
      stage: "production", progress: 50, engine: "seedance",
      lastProgressAt: new Date().toISOString(),
      clipCount, clipDuration, aspectRatio, cameraFixed,
      includeVoice, includeMusic,
    },
    pipeline_state: {
      stage: "production", progress: 50,
      lastProgressAt: new Date().toISOString(), engine: "seedance",
    },
  }).eq("id", projectId);

  const dispatchResults = await Promise.allSettled(
    clips.map(async (clip, i) => {
      const imageUrl = sceneImageLookup[i] ?? sceneImageLookup[0] ?? null;
      // Seedance unique: use NEXT scene image as the end-frame target for
      // inter-scene continuity. NEVER an extracted prior frame (parallel batch
      // has none). Both null-guards: differs-from-start AND identity-lock
      // (all-same-image) suppression. Regression mitigations #3/#4.
      const nextImg = sceneImageLookup[i + 1] ?? null;
      const endImageUrl = nextImg && nextImg !== imageUrl ? nextImg : null;

      // Call the SAME engine-agnostic spine. skipPolling → spine writes the
      // video_clips row (veo_operation_name lookup col) AND fires
      // poll-replicate-prediction itself. triggerNextClip:false → no callback
      // chain (parallel batch, watchdog reconciles).
      const clipResult = await callEdgeFunction("generate-single-clip", {
        projectId,
        userId,
        shotIndex: i,
        prompt: clip.prompt,
        startImageUrl: imageUrl || undefined,
        endImageUrl: endImageUrl || undefined,
        aspectRatio,
        durationSeconds: scriptShots[i]?.["durationSeconds" as any] ?? clipDuration,
        videoEngine: "seedance",
        isAvatarMode: ctx.isAvatarMode,
        cameraFixed,
        skipPolling: true,
        triggerNextClip: false,
        totalClips: clips.length,
        sceneContext: clip.sceneContext,
        sceneImageUrl: imageUrl || undefined,
        pipelineContext: {
          videoEngine: "seedance",
          isAvatarMode: ctx.isAvatarMode,
          clipDuration: scriptShots[i]?.["durationSeconds" as any] ?? clipDuration,
          aspectRatio,
          sceneImageLookup,
        },
      });

      const predictionId = clipResult?.predictionId || clipResult?.clipResult?.predictionId;
      if (!clipResult?.success && !predictionId) {
        throw new Error(clipResult?.error || `Seedance clip ${i} dispatch failed`);
      }

      // Best-effort stamp of the engine columns the watchdog/stitcher key on.
      // (Spine writes veo_operation_name; we add video_engine/end_image for
      // parity with the legacy seedance row. Non-fatal on race.)
      try {
        await supabase.from("video_clips").update({
          video_engine: "seedance",
          engine: "seedance",
          generation_mode: "seedance",
          replicate_prediction_id: predictionId,
          start_image_url: imageUrl,
          end_image_url: endImageUrl,
        }).eq("project_id", projectId).eq("shot_index", i);
      } catch (_) { /* non-fatal */ }

      return { shotIndex: i, predictionId };
    }),
  );

  const dispatched = dispatchResults
    .filter((r): r is PromiseFulfilledResult<{ shotIndex: number; predictionId: string }> => r.status === "fulfilled")
    .map((r) => r.value);
  const failed = dispatchResults
    .map((r, i) => r.status === "rejected" ? { shotIndex: i, error: String((r as any).reason?.message ?? (r as any).reason) } : null)
    .filter(Boolean);

  console.log(`[Hollywood][Parallel] Dispatched ${dispatched.length}/${clips.length} clips. Failed: ${failed.length}`);

  // ═══ 0-CLIP HARD-FAIL (billing-aware) ═══ Regression mitigation #8.
  if (dispatched.length === 0) {
    const firstErr = (failed[0] as { error?: string } | undefined)?.error || "All clip dispatches failed";
    const billingBlocked = /\b402\b|insufficient credit|out of credit|payment required/i.test(firstErr);
    const friendly = billingBlocked
      ? "Rendering paused — the video provider account is out of credit. Add credit and retry."
      : `Generation could not start: ${firstErr}`;
    console.error(`[Hollywood][Parallel] ❌ 0/${clips.length} clips dispatched — marking failed. billingBlocked=${billingBlocked}.`);
    await supabase.from("movie_projects").update({
      status: "failed",
      last_error: friendly,
      pending_video_tasks: {
        stage: "dispatch_failed",
        error: friendly,
        billingBlocked,
        failedDispatches: failed,
        failedAt: new Date().toISOString(),
      },
    }).eq("id", projectId);
    // Stop this invocation (outer guard) — do NOT fall through to postproduction.
    state._exitClipLoopNow = true;
    state._dispatchKind = "parallel";
    state._parallelFailed = true;
    state.progress = 0;
    return state;
  }

  // ═══ PERSIST PENDING STATE FOR WATCHDOG (postProduction contract) ═══
  // Regression mitigation #7: post-stitch audio mux instructions.
  await supabase.from("movie_projects").update({
    status: "generating",
    pending_video_tasks: {
      stage: "production",
      progress: 60,
      engine: "seedance",
      lastProgressAt: new Date().toISOString(),
      clipCount, clipDuration, aspectRatio, cameraFixed,
      includeVoice, includeMusic,
      callbackChainActive: false,
      predictionIds: dispatched,
      failedDispatches: failed,
      dispatchedAt: new Date().toISOString(),
      postProduction: {
        includeVoice, includeMusic,
        stitchFunction: "seamless-stitcher",
        audioAssets,
        muxStrategy: "post-stitch",
      },
    },
    pipeline_state: {
      stage: "production",
      progress: 60,
      lastProgressAt: new Date().toISOString(),
      engine: "seedance",
      predictionIds: dispatched,
      failedDispatches: failed,
    },
    updated_at: new Date().toISOString(),
  }).eq("id", projectId);

  // Stop this invocation — watchdog handles completion, audio mux, stitching.
  state._exitClipLoopNow = true;
  state._dispatchKind = "parallel";
  state.progress = 60;
  return state;
}
