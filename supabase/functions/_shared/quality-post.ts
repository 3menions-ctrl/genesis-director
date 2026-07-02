// ============================================================================
// quality-post.ts — Real delivery for the 4K-upscale / 60fps surcharges.
//
// The engine registry advertises two paid quality cores:
//   • upscale4kCredits  — Topaz Astra style 4K upscale
//   • fps60Credits      — RIFE 60fps frame interpolation
//
// For a long time these were billed in the UI preview but never DELIVERED by
// the project-mode pipelines. This module closes that gap by running the real
// post-processing on Replicate AFTER the base render, and reports exactly which
// cores were applied so the caller can bill ONLY what was delivered
// (charge-on-delivery — we never charge for a core we failed to apply).
//
// ── Design guarantees ───────────────────────────────────────────────────────
//   1. NEVER throws. Any failure (missing key, model error, bad output) returns
//      the ORIGINAL url with the corresponding `applied` flag false. The base
//      render is never lost.
//   2. Model slugs are env-overridable so ops can swap providers / pin versions
//      WITHOUT a code deploy. Defaults point at well-known public models.
//   3. `applied` is the source of truth for billing. The caller charges the
//      surcharge for a core ONLY when applied[core] === true.
// ============================================================================

import {
  createReplicatePrediction,
  pollReplicatePrediction,
} from "./network-resilience.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface QualityPostOpts {
  /** 60fps RIFE interpolation. */
  fps60?: boolean;
  /** 4K upscale (Topaz Astra). */
  upscale4k?: boolean;
}

export interface QualityPostResult {
  /** Final video URL — upscaled / interpolated when applied, else the original. */
  url: string;
  /** Cores that were genuinely delivered — bill ONLY these. */
  applied: { fps60: boolean; upscale4k: boolean };
  /** Cores the caller requested (echo of opts) — for logging / diffing. */
  requested: { fps60: boolean; upscale4k: boolean };
}

// ── Model endpoints (env-overridable) ───────────────────────────────────────
// Replicate "run a model" endpoint shape:
//   https://api.replicate.com/v1/models/{owner}/{name}/predictions
// Override with an `owner/name` slug (the models endpoint always runs the
// model's latest version; pin a version on Replicate's side if needed).
const INTERPOLATE_MODEL =
  Deno.env.get("REPLICATE_INTERPOLATE_MODEL") || "zsxkib/rife-frame-interpolation";
const UPSCALE_MODEL =
  Deno.env.get("REPLICATE_UPSCALE_MODEL") || "topazlabs/video-upscale";

// Some models take the video under a different input key. Keep these
// overridable so a provider swap doesn't require a deploy.
const INTERPOLATE_VIDEO_KEY = Deno.env.get("REPLICATE_INTERPOLATE_VIDEO_KEY") || "video";
const UPSCALE_VIDEO_KEY = Deno.env.get("REPLICATE_UPSCALE_VIDEO_KEY") || "video";

function modelEndpoint(slug: string): string {
  return `https://api.replicate.com/v1/models/${slug}/predictions`;
}

/** Replicate output may be a string, an array of strings, or {output}. Pull the first url. */
function firstUrl(output: unknown): string | null {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output.find((o) => typeof o === "string");
    return (first as string) || null;
  }
  if (typeof output === "object" && output !== null) {
    const o = output as Record<string, unknown>;
    return firstUrl(o.output ?? o.video ?? o.url);
  }
  return null;
}

/**
 * Run one Replicate post-processing model against a video url.
 * Returns the resulting url, or null on ANY failure (never throws).
 */
async function runModel(
  slug: string,
  input: Record<string, unknown>,
  apiKey: string,
  logPrefix: string,
): Promise<string | null> {
  try {
    const submit = await createReplicatePrediction(
      modelEndpoint(slug),
      input,
      apiKey,
      { waitForResult: true, maxRetries: 2 },
    );
    if (!submit.success || !submit.data) {
      console.warn(`${logPrefix} ${slug} submit failed:`, submit.error);
      return null;
    }

    // `Prefer: wait` may already carry the output; otherwise poll to completion.
    if (submit.data.status === "succeeded" && submit.data.output) {
      return firstUrl(submit.data.output);
    }

    const predictionId = submit.data.id;
    if (!predictionId) {
      console.warn(`${logPrefix} ${slug} returned no prediction id`);
      return null;
    }

    const poll = await pollReplicatePrediction(predictionId, apiKey, {
      maxPollTimeMs: 5 * 60 * 1000,
      pollIntervalMs: 4000,
    });
    if (!poll.success || !poll.data) {
      console.warn(`${logPrefix} ${slug} poll failed:`, poll.error);
      return null;
    }
    return firstUrl(poll.data.output);
  } catch (err) {
    console.warn(`${logPrefix} ${slug} threw (swallowed):`, err);
    return null;
  }
}

/**
 * Apply the requested quality cores to a finished render.
 *
 * Order: interpolate FIRST (cheaper at base resolution), then upscale the
 * 60fps result to 4K — so a 4K+60fps request yields a single 4K/60fps file.
 *
 * Best-effort: a failed core leaves the prior url intact and its `applied`
 * flag false. The caller bills only `applied` cores.
 */
export async function applyQualityPost(
  videoUrl: string,
  opts: QualityPostOpts,
  logPrefix = "[quality-post]",
): Promise<QualityPostResult> {
  const requested = { fps60: !!opts.fps60, upscale4k: !!opts.upscale4k };
  const result: QualityPostResult = {
    url: videoUrl,
    applied: { fps60: false, upscale4k: false },
    requested,
  };

  // Nothing requested → identity (and zero Replicate spend).
  if (!requested.fps60 && !requested.upscale4k) return result;

  const apiKey = Deno.env.get("REPLICATE_API_KEY");
  if (!apiKey) {
    console.warn(`${logPrefix} REPLICATE_API_KEY missing — skipping quality post (no charge).`);
    return result;
  }
  if (!videoUrl) return result;

  // 1) 60fps interpolation.
  if (requested.fps60) {
    const out = await runModel(
      INTERPOLATE_MODEL,
      { [INTERPOLATE_VIDEO_KEY]: result.url, fps: 60, target_fps: 60 },
      apiKey,
      logPrefix,
    );
    if (out) {
      result.url = out;
      result.applied.fps60 = true;
      console.log(`${logPrefix} ✅ 60fps interpolation applied`);
    } else {
      console.warn(`${logPrefix} ⚠️ 60fps interpolation NOT applied — user will not be charged for it`);
    }
  }

  // 2) 4K upscale (runs on the interpolated url when present).
  if (requested.upscale4k) {
    const out = await runModel(
      UPSCALE_MODEL,
      { [UPSCALE_VIDEO_KEY]: result.url, scale: 4, target_resolution: "4k" },
      apiKey,
      logPrefix,
    );
    if (out) {
      result.url = out;
      result.applied.upscale4k = true;
      console.log(`${logPrefix} ✅ 4K upscale applied`);
    } else {
      console.warn(`${logPrefix} ⚠️ 4K upscale NOT applied — user will not be charged for it`);
    }
  }

  return result;
}

// ── Persistence ──────────────────────────────────────────────────────────────
// The quality intent is chosen at submit time but HONORED at finalize time
// (seamless-stitcher), which runs in a separate invocation. We stash it on
// `movie_projects.editor_state.qualityOptions` — a jsonb the stitcher already
// loads, and which the editor doesn't touch during the generate→stitch window.
// No migration, no clobbering of the heavily-mutated pending_video_tasks bag.

/** Read-merge-write the quality intent onto the project. Non-fatal on error. */
export async function persistQualityIntent(
  supabase: SupabaseClient,
  projectId: string | null | undefined,
  opts: QualityPostOpts | undefined,
  logPrefix = "[quality-post]",
): Promise<void> {
  if (!projectId) return;
  const requested = { upscale4k: !!opts?.upscale4k, fps60: !!opts?.fps60 };
  // Nothing billable requested → don't write (keeps editor_state clean).
  if (!requested.upscale4k && !requested.fps60) return;
  try {
    const { data } = await supabase
      .from("movie_projects")
      .select("editor_state")
      .eq("id", projectId)
      .maybeSingle();
    const editorState =
      data?.editor_state && typeof data.editor_state === "object"
        ? (data.editor_state as Record<string, unknown>)
        : {};
    await supabase
      .from("movie_projects")
      .update({ editor_state: { ...editorState, qualityOptions: requested } })
      .eq("id", projectId);
  } catch (e) {
    console.warn(`${logPrefix} persistQualityIntent failed (non-fatal):`, e);
  }
}

/** Extract the persisted quality intent from a project's editor_state. */
export function readQualityIntent(editorState: unknown): QualityPostOpts {
  const q = (editorState as { qualityOptions?: QualityPostOpts } | null | undefined)
    ?.qualityOptions;
  return { upscale4k: !!q?.upscale4k, fps60: !!q?.fps60 };
}

/**
 * Credits to charge for what was actually delivered. Pulls the per-core
 * surcharge from the engine spec so this stays parity-locked to pricing.
 */
export function deliveredSurchargeCredits(
  applied: { fps60: boolean; upscale4k: boolean },
  surcharge: { fps60Credits: number; upscale4kCredits: number },
  /** Final film length. Topaz bills ~$0.08 per SECOND of output video, so
   *  the surcharge scales per started 10s block — a flat fee went underwater
   *  on long films (60s 4K ≈ $4.80 COGS vs the old flat $0.78 charge). */
  totalDurationSec: number = 10,
): number {
  const blocks = Math.max(1, Math.ceil(totalDurationSec / 10));
  let credits = 0;
  if (applied.fps60) credits += blocks * (surcharge.fps60Credits || 0);
  if (applied.upscale4k) credits += blocks * (surcharge.upscale4kCredits || 0);
  return credits;
}
