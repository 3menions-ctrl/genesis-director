/**
 * seamless-stitcher — the next-generation stitcher.
 *
 * Goals (v2 over the legacy simple-stitch + editor-stitch):
 *   1. **Always crossfade.** Hard cuts are gone. Even two-clip projects
 *      get a xfade + acrossfade. No silent downgrade past 4 clips.
 *   2. **Pre-flight normalization.** Every input clip is forced into a
 *      canonical pipeline (1920×1080, 30fps, yuv420p, BT.709, 48kHz AAC
 *      stereo) inside the same filter graph BEFORE the join. This is
 *      the single biggest seam killer — mismatched fps / sar / colorspace
 *      / sample-rate were the source of every visible seam in v1.
 *   3. **Intro pre-roll.** If the caller asks for the Small Bridges
 *      intro, we prepend it as input 0 and crossfade it into the user
 *      content. One mux pass, branded download in a single hop.
 *   4. **Idempotent.** Output filenames are `{projectId}/{contentHash}.mp4`
 *      where `contentHash` is a stable SHA of (intro flag, transition
 *      duration, clip URL list). Re-requesting the same set returns
 *      the existing file — no orphans.
 *   5. **Robust failure paths.** Auth re-validation, Replicate retry,
 *      persistence guarantee, signed-URL return. No "stitching" status
 *      stranded forever.
 *
 *
 * Request (project mode — pipeline / download flow):
 *   POST /functions/v1/seamless-stitcher
 *   {
 *     projectId: string,
 *     includeIntro?: boolean,        // default true
 *     transitionDuration?: number,   // seconds, default 0.4
 *     transitionType?: string,       // xfade transition name, default "fade"
 *     forceRestitch?: boolean,       // bypass the idempotency cache
 *   }
 *
 * Request (clips mode — editor flow):
 *   POST /functions/v1/seamless-stitcher
 *   {
 *     sessionId: string,             // namespaces the output key
 *     clips: { url: string; duration?: number }[],
 *     includeIntro?: boolean,        // default false in this mode
 *     transitionDuration?: number,   // default 0.4
 *     transitionType?: string,       // default "fade"
 *     forceRestitch?: boolean,
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     url: "<signed download URL>",
 *     contentHash: "...",
 *     cached: boolean,
 *     branded: boolean,
 *     stitchedAt: ISO-8601 string
 *   }
 *
 *
 * Required environment:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - REPLICATE_API_KEY
 *
 * Storage buckets used:
 *   - brand-assets        (public)   intro source       → intro/intro.mp4
 *   - published-renders   (private)  stitched outputs   → {projectId}/{hash}.mp4
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { ColorGrade } from "../_shared/color-grade.ts";
import { compileClipColorFilter } from "../_shared/color-grade-filters.ts";
import type { EffectInstance } from "../_shared/effects.ts";
import { bakeClipEffects, type BakedClipEffects } from "../_shared/effects-bake.ts";
import type { AudioMix, MasterLoudnessPreset } from "../_shared/audio-mix.ts";
import { compileClipAudioFilter, masterLoudnormFilter } from "../_shared/audio-mix-filters.ts";
import {
  compileVideoKeyframeChain,
  compileAudioKeyframeChain,
  type BakeKeyframe,
} from "../_shared/keyframe-bake.ts";
import {
  buildSeamlessCommand,
  dimensionsForAspect,
  encodeProfileFor,
  xfadeKindFor,
  round,
  TARGET_SAMPLE_RATE,
  TARGET_SAR,
  TARGET_FPS,
  TARGET_COLORSPACE,
  DEFAULT_TRANSITION_DURATION,
  DEFAULT_TRANSITION_TYPE,
  type StitchInput,
} from "../_shared/seamless-command.ts";
import { classifyFailure } from "../_shared/failure-classify.ts";
import {
  applyQualityPost,
  readQualityIntent,
  deliveredSurchargeCredits,
  type QualityPostOpts,
} from "../_shared/quality-post.ts";
import { getEngine, backendToEngineId } from "../_shared/engines.ts";
import {
  buildBreakthroughCommand,
  type BreakthroughCommandOpts,
} from "../_shared/breakthrough-command.ts";

// ── Constants ──────────────────────────────────────────────────────────
const FFMPEG_MODEL_VERSION =
  "efd0b79b577bcd58ae7d035bce9de5c4659a59e09faafac4d426d61c04249251";

const INTRO_BUCKET = "brand-assets";
const INTRO_PATH = "intro/intro.mp4";

const OUTPUT_BUCKET = "published-renders";
const SIGNED_URL_TTL = 60 * 60 * 24; // 24 hours

// Canonical pipeline constants, the aspect/format helpers, and the
// command builder live in `../_shared/seamless-command.ts` so the
// render-test harness can import them without spinning up Deno.
// See the import block above.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Types ──────────────────────────────────────────────────────────────
interface StitchRequest {
  /** Breakthrough-mode: layered 4-plane composite (chrome / inner / subject /
   *  aftermath) with an animating boundary mask. Bypasses the clip-xfade path
   *  entirely — the caller supplies already-generated layer URLs (see the
   *  client orchestrator `executeBreakthroughRender`). */
  breakthrough?: BreakthroughCommandOpts & {
    namespaceId?: string;
    templateId?: string;
  };
  /** Project-mode: loads clips from `video_clips` and updates `movie_projects.video_url`. */
  projectId?: string;
  /** Clips-mode: explicit list, bypasses DB lookup. Required when projectId is absent.
   *  Each clip can carry its own ColorGrade + effects + audio mix — all
   *  compiled into per-clip FFmpeg filter chains and injected during
   *  normalization. */
  clips?: {
    url: string;
    duration?: number;
    clipId?: string;
    colorGrade?: ColorGrade | null;
    effects?: EffectInstance[];
    audioMix?: AudioMix | null;
  }[];
  /** Clips-mode namespace for the output key. Required when clips is provided. */
  sessionId?: string;
  /** Project-level master loudness — applied after the audio xfade
   *  chain. Defaults to "off" (no normalization). */
  masterLoudness?: MasterLoudnessPreset;
  includeIntro?: boolean;
  transitionDuration?: number;
  transitionType?: string;
  forceRestitch?: boolean;
  /** Target aspect ratio for the final container ("16:9", "9:16",
   *  "1:1", "4:5", "4:3", "21:9"). Drives both the output dimensions
   *  AND the content hash. Unknown values fall back to 16:9.
   *  Previously this was hash-only — every export at a non-16:9
   *  aspect actually shipped 1920×1080 letterboxed bytes. */
  aspectRatio?: string;
  /** Resolution preset: "720p", "1080p" (default), "1440p", "4k", "8k". */
  resolution?: string;
  /** Output container format: "mp4" (default), "mov", "webm", "gif".
   *  GIF strips audio. MOV uses ProRes. WebM uses VP9+Opus. */
  format?: string;
  /** CRF override (libx264 / libvpx). Lower = higher quality. Defaults
   *  to the profile-specific value (18 for x264, 32 for VP9). Clamped
   *  to a safe range to prevent enormous outputs. */
  crf?: number;
  /** Auto-ducking — when enabled and aux audio tracks exist, the
   *  music tracks (sys:A2+) duck under the master voice track via
   *  sidechaincompress. Standard 4:1 ratio, 20ms attack, 300ms release. */
  autoDuck?: boolean;
  /** If true, the host pipeline plans to reframe the source via crop
   *  rather than letterbox. Different output bytes → different hash. */
  reframe?: boolean;
  /** Per-boundary transitions authored by the user on the timeline.
   *  When present, the per-boundary kind+durationSec override the
   *  global transitionType/transitionDuration for that specific join.
   *  Without this, every join used the same default — mixed
   *  transitions ("fade between A→B, dissolve between B→C") collapsed
   *  to one kind everywhere. */
  transitions?: Array<{
    fromClipId: string;
    toClipId: string;
    kind: string;
    durationSec: number;
  }>;
}

interface ClipRow {
  shot_index: number;
  video_url: string;
  duration_seconds: number | null;
  /** Per-clip properties JSONB. May include `colorGrade` and `audioMix`
   *  written by the editor. */
  properties?: {
    colorGrade?: ColorGrade | null;
    audioMix?: AudioMix | null;
    /** Phase B clip routing — when present, the clip lives on this
     *  track id instead of the default V1 / A1. The bake groups by
     *  track to stack video overlays + amix multi-audio. */
    trackId?: string | null;
  } | null;
  /** Stored as a sibling field of properties (not nested) when the
   *  editor persists; some flows put effects under properties. We
   *  check both spots and merge. */
  effects?: EffectInstance[] | null;
}

// StitchInput moved to ../_shared/seamless-command.ts and re-imported.

// ── Main handler ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // Request-scoped snapshot — captured progressively so the catch
  // block has access to whatever shape we know at the time of failure.
  // Module-scoped state would race across concurrent requests.
  let bodySnapshot: Partial<StitchRequest> | null = null;
  try {
    const body = (await req.json()) as StitchRequest;
    bodySnapshot = body;

    // AUTH (audit fix): seamless-stitcher previously had NO in-code auth and
    // relied solely on the gateway verify_jwt=true. That blocks anonymous calls
    // but still lets ANY authenticated user pass an arbitrary projectId. We
    // validate here so the caller identity is available for the project
    // ownership check below. Service-role (internal pipeline) passes and is
    // exempted from the ownership check. Placed before the breakthrough branch
    // so that mode is authenticated too.
    const { validateAuth, unauthorizedResponse, forbiddenResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    // ── Breakthrough composite mode ──────────────────────────────────
    // A layered 4-plane render (chrome still + masked inner video +
    // chroma-keyed subject + aftermath), NOT a clip xfade. Reuses the same
    // Replicate FFmpeg path (runFfmpeg) + storage (persistOutput) as every
    // other render — only the command graph differs.
    if (body.breakthrough) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const bt = body.breakthrough;
      const { command, inputs, outputName } = buildBreakthroughCommand({
        ...bt,
        aspectRatio: bt.aspectRatio ?? body.aspectRatio,
        resolution: bt.resolution ?? body.resolution,
        format: bt.format ?? body.format,
        crf: bt.crf ?? body.crf,
      });
      const outputUrl = await runFfmpeg({
        replicateKey: Deno.env.get("REPLICATE_API_KEY")!,
        command,
        inputs,
        outputName,
      });
      const ext = outputName.split(".").pop() ?? "mp4";
      const hash = (await sha256Hex(command)).slice(0, 16);
      const outputKey =
        `${bt.namespaceId ?? "breakthrough"}/${bt.templateId ?? "render"}_${hash}.${ext}`;
      const signed = await persistOutput(supabase, outputUrl, outputKey);
      return new Response(JSON.stringify({ video_url: signed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject ambiguous calls early.
    const isProjectMode = !!body.projectId;
    const isClipsMode = Array.isArray(body.clips) && body.clips.length > 0;
    if (!isProjectMode && !isClipsMode) {
      throw new Error("either projectId or clips[] is required");
    }
    if (isClipsMode && !body.sessionId) {
      throw new Error("sessionId is required in clips mode");
    }

    // In clips-mode the intro defaults OFF (editor flow lays out its own
    // pre-roll). In project-mode it defaults ON (download flow brands).
    const includeIntro = body.includeIntro ?? (isProjectMode ? true : false);
    const transitionDuration = body.transitionDuration ?? DEFAULT_TRANSITION_DURATION;
    const transitionType = body.transitionType ?? DEFAULT_TRANSITION_TYPE;
    const forceRestitch = body.forceRestitch ?? false;

    if (transitionDuration <= 0 || transitionDuration > 2) {
      throw new Error("transitionDuration must be in (0, 2]");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Resolve clip list ─────────────────────────────────────────
    // In project mode we hit the DB. In clips mode we trust the caller.
    let clips: ClipRow[];
    type OverlayDesc = { row: ClipRow; timelineStartSec: number; durationSec: number };
    let overlayDescs: OverlayDesc[] = [];
    let auxAudioDescs: OverlayDesc[] = [];
    const namespaceId: string = body.projectId ?? body.sessionId!;
    // Per-boundary transitions authored in the editor live on
    // movie_projects.editor_state.transitions. We hoist them to the
    // outer scope here so the multi-clip stitch path (which runs in
    // BOTH project-mode and clips-mode) can read them. Populated inside
    // the project-mode branch below; stays empty in clips-mode (where
    // body.transitions is the source instead).
    let projectEditorTransitions: Array<{
      fromClipId: string;
      toClipId: string;
      kind: string;
      durationSec: number;
    }> = [];
    // Hoisted for the final-film quality pass (4K / 60fps honoring +
    // charge-on-delivery) which runs after the stitch below.
    let projectUserId: string | null = null;
    let projectVideoEngine: string | null = null;
    let projectQualityOptions: QualityPostOpts = { upscale4k: false, fps60: false };

    if (isProjectMode) {
      const { data: project, error: projectErr } = await supabase
        .from("movie_projects")
        .select("id, user_id, title, video_url, editor_state, video_engine")
        .eq("id", body.projectId)
        .maybeSingle();
      if (projectErr || !project) {
        throw new Error(`project_not_found: ${projectErr?.message ?? body.projectId}`);
      }
      // Pull the tracks array from editor_state. The track mute/lock/solo
      // toggles in the TrackHeader UI write here via setTrackProps; we
      // use it to filter clips at render time. Without this, the UI
      // flags were cosmetic — clips on muted tracks still rendered,
      // solo had no effect on the bake.
      const editorState = (project as { editor_state?: {
        tracks?: unknown;
        scenes?: Array<{ clips?: Array<{
          kind?: string;
          titleText?: string;
          titleColor?: string;
          timelineStartSec?: number;
          durationSec?: number;
        }> }>;
        textOverlays?: unknown[];
        /** Per-boundary transitions authored on the timeline. Previously
         *  not extracted — every project-mode render used the global
         *  transitionType for every boundary even when the editor had
         *  authored a mix. */
        transitions?: Array<{
          fromClipId: string;
          toClipId: string;
          kind: string;
          durationSec: number;
        }>;
      } }).editor_state ?? {};
      // Surface the editor's authored transitions to the outer scope so
      // the multi-clip stitch path can map them per boundary.
      projectEditorTransitions = Array.isArray(editorState.transitions)
        ? editorState.transitions
        : [];
      // Capture identity + quality intent for the post-stitch quality pass.
      projectUserId = (project as { user_id?: string }).user_id ?? null;
      projectVideoEngine = (project as { video_engine?: string }).video_engine ?? null;
      projectQualityOptions = readQualityIntent(editorState);

      // IDOR GUARD (audit fix): a non-service-role caller may only stitch a
      // project they own. Without this, any authenticated user could pass a
      // victim's projectId and overwrite their final movie_projects.video_url
      // AND spend the owner's credits (deduct_credits runs against
      // projectUserId in the post-stitch quality pass below).
      if (!auth.isServiceRole && projectUserId && projectUserId !== auth.userId) {
        return forbiddenResponse(corsHeaders, "Forbidden: you do not own this project");
      }
      const projectTracks: Array<{
        id: string;
        kind: "video" | "audio";
        muted?: boolean;
        soloed?: boolean;
      }> = Array.isArray(editorState.tracks)
        ? (editorState.tracks as Array<{
            id: string;
            kind: "video" | "audio";
            muted?: boolean;
            soloed?: boolean;
          }>)
        : [];
      // Title clips — kind:"title" with titleText. They live in the
      // editor_state, NOT video_clips (no video_url). Collect them
      // with their absolute time windows so we can emit drawtext
      // overlays in the final video chain.
      const titleClips: Array<{
        text: string;
        color: string;
        startSec: number;
        durationSec: number;
        x?: number;
        y?: number;
        sizePct?: number;
        fontFamily?: string;
        bold?: boolean;
      }> =
        (editorState.scenes ?? [])
          .flatMap((s) => s.clips ?? [])
          .filter((c) => c.kind === "title" && typeof c.titleText === "string" && c.titleText.trim() !== "")
          .map((c) => ({
            text: (c.titleText as string).trim(),
            color: (c.titleColor as string) ?? "#ffffff",
            startSec: Math.max(0, c.timelineStartSec ?? 0),
            durationSec: Math.max(0.1, c.durationSec ?? 3),
          }));
      // Project-level text overlays. Each is a richer text card with
      // explicit position/font/size. We bake them via drawtext just
      // like title clips — gradients / glow / kinetic-typography
      // degrade gracefully to a solid color + simple drop shadow.
      // Full fidelity requires SVG→PNG rasterization (text-overlay-bake.ts
      // overlayToSvg is wired but needs a Deno-side rasterizer or
      // librsvg-enabled FFmpeg). This drawtext path covers 80% of
      // real-world cards (title, subtitle, lower-third text).
      const projectTextOverlays = Array.isArray(editorState.textOverlays)
        ? (editorState.textOverlays as Array<{
            text?: string;
            startSec?: number;
            durationSec?: number;
            x?: number;
            y?: number;
            sizePct?: number;
            font?: string;
            weight?: number;
            uppercase?: boolean;
            fill?: { color?: string };
          }>)
        : [];
      for (const ov of projectTextOverlays) {
        if (!ov.text || typeof ov.text !== "string") continue;
        if ((ov.text as string).trim() === "") continue;
        const rendered = ov.uppercase ? (ov.text as string).toUpperCase() : (ov.text as string);
        titleClips.push({
          text: rendered.trim(),
          color: ov.fill?.color ?? "#ffffff",
          startSec: Math.max(0, ov.startSec ?? 0),
          durationSec: Math.max(0.1, ov.durationSec ?? 3),
          x: typeof ov.x === "number" ? ov.x : undefined,
          y: typeof ov.y === "number" ? ov.y : undefined,
          sizePct: typeof ov.sizePct === "number" ? ov.sizePct : undefined,
          bold: (ov.weight ?? 400) >= 600,
        });
      }
      console.log(
        `[seamless-stitcher] text overlays: titles=${titleClips.length - projectTextOverlays.length}, project=${projectTextOverlays.length}`,
      );
      // Derive "any audio soloed → others mute" rule: if at least one
      // audio track is soloed, every non-soloed audio track joins
      // the muted set.
      const anyAudioSoloed = projectTracks.some((t) => t.kind === "audio" && t.soloed);
      const mutedTrackIds = new Set(
        projectTracks
          .filter(
            (t) =>
              t.muted ||
              (anyAudioSoloed && t.kind === "audio" && !t.soloed),
          )
          .map((t) => t.id),
      );
      const isTrackMuted = (trackId: string | null | undefined): boolean => {
        const id = trackId ?? "sys:V1";
        return mutedTrackIds.has(id);
      };

      // Load EVERY clip on the project that has a usable video_url —
      // not just those flagged status='completed'. The editor itself
      // surfaces clips by video_url (see useProject), so a clip the
      // user can SEE on the timeline MUST be renderable; otherwise
      // the export silently drops it and the user gets a render that
      // contains only the original status='completed' subset. This
      // is the root cause of the "only clip 1 renders" report.
      //
      // We sort by created_at to match the editor's own ordering
      // (useProject sorts the same way) so the rendered sequence is
      // exactly what the user composed. shot_index is no longer a
      // reliable ordering key — it isn't updated when the user
      // reorders the timeline.
      const { data: clipRows, error: clipErr } = await supabase
        .from("video_clips")
        // `id` was missing previously — without it we couldn't map
        // body.transitions[fromClipId/toClipId] to actual clips, so
        // every per-boundary transition silently fell back to the
        // global type.
        .select("id, shot_index, video_url, duration_seconds, properties, effects, created_at, status")
        .eq("project_id", body.projectId)
        .not("video_url", "is", null)
        // Tiebreak on id when created_at collides (bulk inserts share
        // the same timestamp at ms precision).
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (clipErr) throw new Error(`clip_lookup_failed: ${clipErr.message}`);
      if (!clipRows || clipRows.length === 0) {
        throw new Error("no_clips_with_video_url_for_project");
      }
      console.log(
        `[seamless-stitcher] loaded ${clipRows.length} clips for project ${body.projectId} ` +
          `(statuses: ${[...new Set((clipRows as { status?: string | null }[]).map((r) => r.status ?? "null"))].join(", ")})`,
      );
      // Phase B clip routing — only clips assigned to the main V1
      // sequence flow through the xfade chain. Clips assigned to V2+
      // composite as time-windowed overlays in step 6 below; clips
      // assigned to A2+ amix into the master audio output. Clips with
      // no trackId default to V1 (backwards-compatible).
      const allRows = clipRows as ClipRow[];
      // Filter out clips on muted VIDEO tracks BEFORE routing — they
      // shouldn't appear anywhere in the render. For audio mute, we
      // keep the clip on V1 but null its audio chain later.
      const visibleRows = allRows.filter((c) => {
        const trackId = (c.properties?.trackId as string | null | undefined) ?? "sys:V1";
        const isVideoTrack = trackId.startsWith("sys:V");
        return !(isVideoTrack && mutedTrackIds.has(trackId));
      });
      const isV1 = (c: ClipRow) => {
        const t = c.properties?.trackId ?? null;
        return t === null || t === "sys:V1";
      };
      const v1Clips = visibleRows.filter(isV1);
      const overlayClips = visibleRows.filter((c) => {
        const t = c.properties?.trackId;
        return typeof t === "string" && t.startsWith("sys:V") && t !== "sys:V1";
      });
      const auxAudioClips = visibleRows.filter((c) => {
        const t = c.properties?.trackId;
        // A1 voiceover + A2+ music. A1 audio-only clips were previously DROPPED
        // (they match no routing bucket — not V1, not a V2 overlay, and were
        // excluded here), silently losing separately-added narration from the
        // final render. Now included and tagged as "voice" below.
        return typeof t === "string" && t.startsWith("sys:A");
      });
      // Log routing for observability — small projects will see a
      // one-line summary in the function logs after each invocation.
      console.log(
        `[seamless-stitcher] routing: V1=${v1Clips.length}, overlay=${overlayClips.length}, aux-audio=${auxAudioClips.length}`,
      );
      // Build the overlay + aux audio descriptors. Each carries its
      // timelineStartSec so we can emit a time-windowed overlay
      // filter (`enable='between(t,start,end)'`) and an `adelay` to
      // align the aux audio with its position on the timeline.
      //
      // The position is sourced from editor_state.scenes[].clips[]
      // because the V2/V3 routing UI persists the time there. For
      // backward compat, falls back to created_at order's natural
      // position (which is just clip's index in the loaded list).
      const editorClipByVideoUrl = new Map<string, { timelineStartSec?: number; durationSec?: number }>();
      for (const s of editorState.scenes ?? []) {
        for (const c of s.clips ?? []) {
          if ((c as unknown as { videoUrl?: string }).videoUrl) {
            editorClipByVideoUrl.set(
              (c as unknown as { videoUrl: string }).videoUrl,
              {
                timelineStartSec: (c as { timelineStartSec?: number }).timelineStartSec,
                durationSec: (c as { durationSec?: number }).durationSec,
              },
            );
          }
        }
      }
      overlayDescs = overlayClips.map((c, i) => {
        const ed = editorClipByVideoUrl.get(c.video_url ?? "");
        return {
          row: c,
          timelineStartSec: ed?.timelineStartSec ?? i * (c.duration_seconds ?? 5),
          durationSec: ed?.durationSec ?? (c.duration_seconds ?? 5),
        };
      });
      auxAudioDescs = auxAudioClips.map((c, i) => {
        const ed = editorClipByVideoUrl.get(c.video_url ?? "");
        return {
          row: c,
          timelineStartSec: ed?.timelineStartSec ?? i * (c.duration_seconds ?? 5),
          durationSec: ed?.durationSec ?? (c.duration_seconds ?? 5),
        };
      });
      clips = v1Clips;
    } else {
      // Clips mode — caller provided an explicit ordered list.
      // Carry the optional colorGrade through `properties` and the
      // effects array as a sibling field. The StitchInput-building
      // path reads both uniformly with the project-mode flow.
      clips = body.clips!.map((c, i) => ({
        shot_index: i,
        video_url: c.url,
        duration_seconds: typeof c.duration === "number" && c.duration > 0 ? c.duration : null,
        properties: (c.colorGrade || c.audioMix)
          ? { colorGrade: c.colorGrade ?? null, audioMix: c.audioMix ?? null }
          : null,
        effects: c.effects ?? null,
      }));
    }

    // ── 2. Resolve intro (optional) ──────────────────────────────────
    let introUrl: string | null = null;
    let introDuration = 0;
    if (includeIntro) {
      const introMeta = await getIntroMeta(supabase);
      if (introMeta) {
        introUrl = introMeta.url;
        introDuration = introMeta.duration;
      } else {
        console.warn("[seamless-stitcher] intro.mp4 missing — continuing without brand pre-roll");
      }
    }

    // ── 3. Build the stitch input list ───────────────────────────────
    //
    // For each clip we compile TWO independent FFmpeg filter chains:
    //
    //   1. colorFilter — comes first in the per-input normalization
    //      pass so curves/colorbalance operate in the higher-precision
    //      colour space before any compositing happens.
    //
    //   2. effectChain — Crossover-recipe bakes (LightBeam, NeonZap,
    //      etc.). May require extra `-f lavfi -i` inputs which are
    //      collected here and passed to buildSeamlessCommand so they
    //      can be appended to the ffmpeg command line and have their
    //      `{ix:N}` placeholders resolved to real input indices.
    //
    // Index math for the bake compiler:
    //   - The intro consumes input index 0 when present.
    //   - Each video clip consumes one input index.
    //   - Effect lavfi inputs are appended after ALL clip+intro inputs.
    //
    // We walk the clips once, collect everything, then resolve the
    // effect-input start index in a second pass.
    const inputs: StitchInput[] = [];
    if (introUrl) {
      inputs.push({ url: introUrl, duration: introDuration, isIntro: true });
    }

    type PendingEffect = { effects: EffectInstance[]; duration: number };
    const pendingEffects: Array<PendingEffect | null> = [];

    for (const c of clips) {
      if (!c.video_url) continue;
      // Color grade chain
      const grade = c.properties?.colorGrade ?? null;
      const colorFilter = compileClipColorFilter(grade);

      // Audio mix chain. If the clip's audio track (A1 by default)
      // is muted at the track level, force volume=0 so the audio
      // exists in the chain (xfade math depends on the stream being
      // there) but emits silence. Same when solo is on and this
      // track is not soloed.
      const mix = c.properties?.audioMix ?? null;
      const clipTrackId = (c.properties?.trackId as string | null | undefined) ?? "sys:V1";
      // V1 clips' default audio lands on A1 unless explicitly routed.
      const audioTrackId = clipTrackId.startsWith("sys:V") ? "sys:A1" : clipTrackId;
      const audioMutedByTrack = isTrackMuted(audioTrackId);
      const audioFilter = audioMutedByTrack ? "volume=0" : compileClipAudioFilter(mix);

      // Effects — collected; baked in the second pass once we know
      // the running input index.
      const dur = typeof c.duration_seconds === "number" && c.duration_seconds > 0
        ? c.duration_seconds
        : 8;
      const effects = c.effects ?? null;

      // Pull artistic fade-in / fade-out + per-clip playback speed
      // from properties (written by the editor inspector and
      // applyProjectTemplate). These were preview-only — never
      // reached the bake. Speed adjusts the effective duration the
      // clip contributes to the timeline so the xfade offset math
      // upstream stays correct.
      const props = (c.properties as unknown as {
        fadeInSec?: number;
        fadeOutSec?: number;
        speed?: number;
        keyframes?: BakeKeyframe[];
      }) ?? {};

      // Keyframes — compile time expressions so scale/opacity rides
      // and volume rides actually animate at render time. Previously
      // every keyframe was preview-only; the render emitted the
      // static `properties.scale` / `properties.opacity` / `properties.volume`
      // and silently discarded the keyframe list. Now scale and
      // opacity bake into the video chain via per-frame expressions
      // and volume bakes into the audio chain.
      const kfs: BakeKeyframe[] = Array.isArray(props.keyframes) ? props.keyframes : [];
      const videoKfChain = compileVideoKeyframeChain(kfs);
      const audioKfChain = compileAudioKeyframeChain(kfs);
      const fadeInSec = Math.max(0, Math.min(dur, props.fadeInSec ?? 0));
      const fadeOutSec = Math.max(0, Math.min(dur, props.fadeOutSec ?? 0));
      const speed = Math.max(0.25, Math.min(4, props.speed ?? 1));
      const effDur = dur / speed;

      inputs.push({
        url: c.video_url,
        duration: effDur,
        isIntro: false,
        colorFilter: colorFilter || undefined,
        audioFilter: audioFilter || undefined,
        videoKfChain: videoKfChain || undefined,
        audioKfChain: audioKfChain || undefined,
        fadeInSec,
        fadeOutSec,
        speed,
        // effectChain + extraInputs are filled in pass 2
      });
      // Defensive type guard: `effects` should be an array per the
       // schema, but a stale row with effects=string|number|object
       // would crash `.length`. Only treat genuine arrays as effects.
      pendingEffects.push(
        Array.isArray(effects) && effects.length > 0
          ? { effects, duration: effDur }
          : null,
      );
    }

    if (inputs.length < 1) {
      throw new Error("no_stitchable_inputs");
    }

    // ── 3b. Bake effects for each clip ───────────────────────────────
    // Running tally: input indices start at 0 for the first `-i`. The
    // intro (when present) is index 0; clip inputs follow. After all
    // clip inputs, effect lavfi inputs are appended in dispatch order.
    let runningExtraInputBase = inputs.length; // first free input slot
    const clipBaseIdx = introUrl ? 1 : 0;
    for (let k = 0; k < pendingEffects.length; k++) {
      const pe = pendingEffects[k];
      if (!pe) continue;
      const ix = clipBaseIdx + k;
      // Wrap the bake — a malformed effect recipe (bad enable window,
      // unknown filter) would otherwise throw and kill the ENTIRE
      // render. Skip just the offending clip's effects and log; the
      // rest of the timeline still renders.
      let baked: BakedClipEffects | null = null;
      try {
        baked = bakeClipEffects(
          pe.effects,
          pe.duration,
          runningExtraInputBase,
          ix, // per-clip label namespace so two clips with the same
              // recipe don't collide on filter pad names
        );
      } catch (bakeErr) {
        console.error(
          `[seamless-stitcher] effect bake failed for clip ${k} — rendering it without effects:`,
          bakeErr instanceof Error ? bakeErr.message : bakeErr,
        );
        baked = null;
      }
      if (!baked) continue;
      inputs[ix].effectChain = baked.filterChain;
      inputs[ix].extraInputs = baked.extraInputs;
      runningExtraInputBase += baked.extraInputs.length;
      if (baked.fidelities.length) {
        console.log(
          `[seamless-stitcher] clip ${k} baked ${baked.fidelities.length} fx:`,
          baked.fidelities.map((f) => `${f.recipe}(${f.fidelity})`).join(", "),
        );
      }
    }

    // ── 4. Compute content hash for idempotency ──────────────────────
    // The hash MUST include every input that affects the output bytes:
    // urls, transition kind/duration, per-clip color filters, AND
    // per-clip effect chains (+ extra lavfi inputs). If a grade OR an
    // effect is changed the hash changes and we re-render instead of
    // returning a stale cache hit.
    // Aspect ratio + reframe MUST participate in the hash even
    // when this function doesn't bake them itself — a downstream
    // re-encode at 9:16 vs 16:9 produces different output bytes, and
    // if both renders land under the same cache key the user gets the
    // wrong aspect from cache. Same goes for reframe: a crop-fill
    // render is byte-different from a letterbox render. Without these
    // in the hash, users saw their second render finish "in seconds"
    // because we served the prior bytes — exactly the user-reported
    // symptom around effects not applying.
    // Per-boundary transitions participate in the hash so a user who
    // changes a single transition (fade → dissolve) doesn't get the
    // prior render's bytes from cache.
    const perBoundaryHashStr = (body.transitions ?? [])
      .map((t) => `${t.fromClipId}>${t.toClipId}:${t.kind}@${t.durationSec}`)
      .join(";");
    const titleHashStr = titleClips
      .map((t) => `${t.text}|${t.color}|${t.startSec.toFixed(3)}|${t.durationSec.toFixed(3)}`)
      .join(";");
    const trackHashStr = projectTracks
      .map((t) => `${t.id}:${t.muted ? "m" : ""}${t.soloed ? "s" : ""}`)
      .filter((s) => s.includes(":") && s.split(":")[1])
      .join(";");
    const overlayHashStr = overlayDescs
      .map((d) => `${d.row.video_url}|${d.timelineStartSec.toFixed(3)}|${d.durationSec.toFixed(3)}`)
      .join(";");
    const auxHashStr = auxAudioDescs
      .map((d) => `${d.row.video_url}|${d.timelineStartSec.toFixed(3)}|${d.durationSec.toFixed(3)}`)
      .join(";");
    const contentHash = await sha256Hex([
      namespaceId,
      includeIntro ? "intro1" : "intro0",
      `xfade:${transitionType}:${transitionDuration}`,
      `loud:${body.masterLoudness ?? "off"}`,
      `aspect:${body.aspectRatio ?? "16:9"}`,
      `resolution:${body.resolution ?? "1080p"}`,
      `format:${body.format ?? "mp4"}`,
      `crf:${body.crf ?? ""}`,
      `reframe:${body.reframe ? 1 : 0}`,
      `pb:${perBoundaryHashStr}`,
      `titles:${titleHashStr}`,
      `tracks:${trackHashStr}`,
      `overlays:${overlayHashStr}`,
      `aux:${auxHashStr}`,
      ...inputs.map((i) =>
        // Keyframes, fades, and speed all change the bytes the bake
        // produces. Without them in the hash, a render that adds (or
        // removes) a keyframe would return the previous cache entry
        // unchanged. Same for fade-in/out and per-clip speed changes.
        `${i.url}|${i.colorFilter ?? ""}|${i.effectChain ?? ""}|${(i.extraInputs ?? []).join(";")}|${i.audioFilter ?? ""}|kv:${i.videoKfChain ?? ""}|ka:${i.audioKfChain ?? ""}|fin:${i.fadeInSec ?? 0}|fout:${i.fadeOutSec ?? 0}|sp:${i.speed ?? 1}`
      ),
    ].join("|"));
    const outputKey = `${namespaceId}/${contentHash}.mp4`;

    // ── 5. Cache hit? ────────────────────────────────────────────────
    if (!forceRestitch) {
      const cached = await maybeCachedSignedUrl(supabase, outputKey);
      if (cached) {
        console.log(`[seamless-stitcher] cache hit ${outputKey}`);
        // Compute totalDuration on cache hits too so the host doesn't
        // persist 0s on a re-served render. clips[] is loaded; even
        // though we never built `inputs` (early return before step 3),
        // the duration estimate from clips matches what was hashed.
        const cacheSumDur = clips.reduce(
          (acc, c) => acc + (c.duration_seconds ?? 0),
          0,
        );
        return ok({
          url: cached,
          contentHash,
          cached: true,
          branded: !!introUrl,
          stitchedAt: new Date().toISOString(),
          totalDuration: cacheSumDur,
          clipsProcessed: clips.length,
          clipUrls: clips.map((c) => c.video_url),
          finalVideoUrl: cached,
          hlsPlaylistUrl: null,
        });
      }
    }

    // ── 6. Single-input fast path ────────────────────────────────────
    // One input still gets normalized (codec-aligned to the canonical
    // pipeline) but skips xfade (needs 2 inputs). CRITICAL: must
    // include colorFilter + effectChain + audioFilter + extraInputs
    // exactly like the multi-input path — otherwise users with a
    // single-clip project lose every grade/effect they applied. The
    // command builder below mirrors buildSeamlessCommand's per-clip
    // normalization stage.
    if (inputs.length === 1) {
      const single = inputs[0];
      const extras = single.extraInputs ?? [];
      const ffmpegInputs: Record<string, string> = { file1: single.url };
      // Extra lavfi/file inputs the effect bake declared. Replicate's
      // ffmpeg runner takes a flat key→url map, so we expose each as
      // file2, file3, ... and the command references them by index.
      const extraArgs: string[] = [];
      extras.forEach((ex, i) => {
        // Pure lavfi descriptors (no http URL) are passed inline as
        // `-f lavfi -i "color=..."`. URL inputs go through the file map.
        if (ex.startsWith("-f ") || ex.startsWith("-loop ")) {
          extraArgs.push(ex);
        } else {
          const key = `file${i + 2}`;
          ffmpegInputs[key] = ex;
          extraArgs.push(`-i ${key}`);
        }
      });
      const url = await runFfmpeg({
        replicateKey: Deno.env.get("REPLICATE_API_KEY")!,
        command: singleInputNormalizeCommand({
          colorFilter:  single.colorFilter,
          effectChain:  single.effectChain,
          audioFilter:  single.audioFilter,
          extraArgs,
          extraInputCount: extras.length,
          masterLoudness: body.masterLoudness,
          aspectRatio:    body.aspectRatio,
          resolution:     body.resolution,
        }),
        inputs: ffmpegInputs,
        outputName: `stitch_${namespaceId}.${encodeProfileFor(body.format).ext}`,
      });
      const signed = await persistOutput(supabase, url, outputKey);
      return ok({
        url: signed,
        contentHash,
        cached: false,
        branded: !!introUrl,
        stitchedAt: new Date().toISOString(),
      });
    }

    // ── 7. Multi-input stitch with chained xfade ─────────────────────
    // Build a per-boundary transition list aligned with the V1 chain.
    //
    // Source of truth: the caller's body.transitions (clips-mode) OR
    // the project's editor_state.transitions (project-mode). Previously
    // project-mode silently fell back to global transitionType for
    // every boundary because the editor_state lookup was never done.
    //
    // We align by V1 clip order: the i-th boundary's transition is
    // whichever editor_state transition has fromClipId === v1Clips[i].id.
    // If a boundary has no matching transition entry, it uses the
    // global default.
    const v1ClipIds = clips
      .filter((row) => (row.properties?.trackId ?? "sys:V1") === "sys:V1")
      .map((row, idx) => ({ idx, id: (row as { id?: string }).id ?? "" }));
    const bodyTransitions = body.transitions ?? [];
    const allTransitions = bodyTransitions.length > 0 ? bodyTransitions : projectEditorTransitions;
    const perBoundary: Array<{ kind: string; durationSec: number }> = [];
    for (let i = 0; i < Math.max(0, v1ClipIds.length - 1); i++) {
      const fromId = v1ClipIds[i].id;
      const match = fromId ? allTransitions.find((t) => t.fromClipId === fromId) : undefined;
      if (match) {
        perBoundary.push({
          kind: xfadeKindFor(match.kind, transitionType),
          durationSec: Math.max(0.05, Math.min(2, match.durationSec)),
        });
      } else {
        perBoundary.push({
          kind: transitionType,
          durationSec: Math.max(0.05, Math.min(2, transitionDuration)),
        });
      }
    }
    // Overlay clips and aux audio extend the input slot count. We
    // tack their URLs onto the inputArgs map so the FFmpeg command
    // can reference them as `-i fileK` for the appropriate K. The
    // command builder needs to know where the V1 clips end and the
    // overlays begin.
    const overlayUrls = overlayDescs.map((d) => d.row.video_url ?? "").filter(Boolean);
    const auxAudioUrls = auxAudioDescs.map((d) => d.row.video_url ?? "").filter(Boolean);
    const { command } = buildSeamlessCommand({
      inputs,
      transitionDuration,
      transitionType,
      masterLoudness: body.masterLoudness,
      aspectRatio: body.aspectRatio,
      resolution: body.resolution,
      format: body.format,
      crf: body.crf,
      autoDuck: body.autoDuck,
      perBoundaryTransitions: perBoundary,
      titleClips,
      overlays: overlayDescs
        .filter((d) => d.row.video_url)
        .map((d) => ({
          timelineStartSec: d.timelineStartSec,
          durationSec: d.durationSec,
        })),
      auxAudio: auxAudioDescs
        .filter((d) => d.row.video_url)
        .map((d) => ({
          timelineStartSec: d.timelineStartSec,
          durationSec: d.durationSec,
          // A1 = narration (full level); A2+ = music (ducked under voice).
          kind: (d.row.properties?.trackId === "sys:A1" ? "voice" : "music") as "voice" | "music",
        })),
    });
    const inputArgs: Record<string, string> = {};
    inputs.forEach((inp, i) => { inputArgs[`file${i + 1}`] = inp.url; });
    // Overlay videos as file{N}.. then aux audio after that. The
    // command builder uses the same indexing.
    overlayUrls.forEach((url, i) => {
      inputArgs[`file${inputs.length + i + 1}`] = url;
    });
    auxAudioUrls.forEach((url, i) => {
      inputArgs[`file${inputs.length + overlayUrls.length + i + 1}`] = url;
    });

    const outputUrl = await runFfmpeg({
      replicateKey: Deno.env.get("REPLICATE_API_KEY")!,
      command,
      inputs: inputArgs,
      outputName: `stitch_${namespaceId}.mp4`,
    });

    let signed = await persistOutput(supabase, outputUrl, outputKey);

    // ── 7b. Quality cores (4K upscale / 60fps interpolation) ─────────
    // Honor the persisted quality intent on the FINAL stitched film, then
    // charge ONLY for the cores actually delivered (charge-on-delivery).
    // Best-effort: a provider failure leaves the base render intact and
    // bills nothing extra — we never charge for a core we didn't deliver.
    if (isProjectMode && (projectQualityOptions.upscale4k || projectQualityOptions.fps60)) {
      try {
        const surcharge = (() => {
          try {
            const spec = getEngine(backendToEngineId(projectVideoEngine ?? "kling"));
            return { upscale4kCredits: spec.upscale4kCredits, fps60Credits: spec.fps60Credits };
          } catch {
            return { upscale4kCredits: 10, fps60Credits: 5 }; // canonical fallback
          }
        })();
        // Max the user could owe if BOTH requested cores land. Pre-check the
        // balance so we never spend Replicate compute on a core we can't bill.
        const maxCharge = deliveredSurchargeCredits(
          { upscale4k: !!projectQualityOptions.upscale4k, fps60: !!projectQualityOptions.fps60 },
          surcharge,
        );
        let canAfford = true;
        if (maxCharge > 0 && projectUserId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("credits_balance")
            .eq("id", projectUserId)
            .maybeSingle();
          canAfford = (prof?.credits_balance ?? 0) >= maxCharge;
          if (!canAfford) {
            console.warn(
              `[seamless-stitcher] skipping quality pass — balance ${prof?.credits_balance ?? 0} < ${maxCharge}cr (base render delivered)`,
            );
          }
        }
        if (!canAfford) throw new Error("insufficient_balance_for_quality");

        const post = await applyQualityPost(
          signed,
          projectQualityOptions,
          `[seamless-stitcher:quality:${body.projectId}]`,
        );
        // applyQualityPost returns an EXPIRING Replicate URL — download it to
        // durable storage (distinct key) before it becomes the canonical url.
        if (post.url !== signed && (post.applied.upscale4k || post.applied.fps60)) {
          const suffix = [post.applied.upscale4k && "4k", post.applied.fps60 && "60fps"]
            .filter(Boolean).join("-");
          signed = await persistOutput(supabase, post.url, `${namespaceId}/${contentHash}_${suffix}.mp4`);
        }

        const charge = deliveredSurchargeCredits(post.applied, surcharge);

        if (charge > 0 && projectUserId) {
          const { data: deductOk, error: deductErr } = await supabase.rpc("deduct_credits", {
            p_user_id: projectUserId,
            p_amount: charge,
            p_description:
              `Quality cores: ${[post.applied.upscale4k && "4K", post.applied.fps60 && "60fps"]
                .filter(Boolean).join(" + ")}`,
            p_project_id: body.projectId,
            p_clip_duration: null,
            // Idempotent per project: a re-stitch never double-charges.
            p_idempotency_key: `quality:${body.projectId}`,
          });
          if (deductErr || deductOk !== true) {
            console.warn(
              `[seamless-stitcher] quality charge of ${charge}cr did not apply (ok=${deductOk})`,
              deductErr,
            );
          } else {
            console.log(`[seamless-stitcher] ✅ charged ${charge}cr for delivered quality cores`);
          }
        }
      } catch (e) {
        console.warn("[seamless-stitcher] quality pass failed (non-fatal, base render kept):", e);
      }
    }

    // ── 8. Update the project's canonical video_url ──────────────────
    // Only do this in project-mode when no intro was burned in — that
    // gives us a stable canonical render to attach to the project row.
    // Editor (clips-mode) calls never mutate movie_projects.
    if (isProjectMode && !includeIntro) {
      try {
        await supabase
          .from("movie_projects")
          .update({
            video_url: signed,
            stitched_at: new Date().toISOString(),
          })
          .eq("id", body.projectId);
      } catch (e) {
        console.warn("[seamless-stitcher] project update failed (non-fatal)", e);
      }
    }

    // Compute final timeline duration after the xfade overlaps.
    // Formula: sum(clip.durations) - sum(per-boundary X) — mirrors
    // buildSeamlessCommand's cumulative-offset math.
    const sumClipDur = inputs.reduce((acc, inp) => acc + inp.duration, 0);
    const sumXfade = (() => {
      let s = 0;
      for (let k = 0; k < Math.max(0, inputs.length - 1); k++) {
        const boundary = (body.transitions ?? [])[k];
        const Xreq = boundary?.durationSec ?? transitionDuration;
        const minAdj = Math.min(inputs[k].duration, inputs[k + 1].duration);
        s += Math.max(0.05, Math.min(Xreq, minAdj - 0.05));
      }
      return s;
    })();
    const totalDuration = Math.max(0, sumClipDur - sumXfade);

    return ok({
      url: signed,
      contentHash,
      cached: false,
      branded: !!introUrl,
      stitchedAt: new Date().toISOString(),
      // Render metadata the host expects. Previously omitted so
      // final-assembly persisted totalDuration:0 and library cards
      // showed "0s" runtime for every render.
      totalDuration,
      clipsProcessed: inputs.length,
      clipUrls: inputs.map((i) => i.url),
      finalVideoUrl: signed,
      hlsPlaylistUrl: null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[seamless-stitcher] failed:", msg);
    // Persist the failure to render_failures so the admin observability
    // dashboard can surface it. Best-effort — a logging failure can't
    // mask the original error.
    await persistRenderFailure(e, bodySnapshot).catch((logErr) => {
      console.warn("[seamless-stitcher] failure-log write itself failed:", logErr);
    });
    return ko({ error: msg });
  }
});

// ── Failure persistence ──────────────────────────────────────────────────

const STITCHER_VERSION = "seamless-v2";

// `classifyFailure` lives in ../_shared/failure-classify.ts so the
// test harness can exercise the mapping without booting the edge
// function. The histogram on /admin/observability buckets failures by
// the values returned here.

async function persistRenderFailure(
  e: unknown,
  body: Partial<StitchRequest> | null,
): Promise<void> {
  const message = e instanceof Error ? e.message : String(e);
  const inputShape: Record<string, unknown> = {
    isProjectMode: !!body?.projectId,
    isClipsMode: Array.isArray(body?.clips) && (body?.clips?.length ?? 0) > 0,
    clipCount: Array.isArray(body?.clips) ? body!.clips!.length : null,
    aspectRatio: body?.aspectRatio ?? null,
    resolution: body?.resolution ?? null,
    format: body?.format ?? null,
    transitionDuration: body?.transitionDuration ?? null,
    transitionType: body?.transitionType ?? null,
    autoDuck: body?.autoDuck ?? null,
    forceRestitch: body?.forceRestitch ?? false,
    hasMasterLoudness: body?.masterLoudness && body.masterLoudness !== "off",
  };
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  await supabase.from("render_failures").insert({
    project_id: body?.projectId ?? null,
    classification: classifyFailure(message),
    message: message.slice(0, 2000),
    stitcher_version: STITCHER_VERSION,
    input_shape: inputShape,
    is_retry: body?.forceRestitch ?? false,
  });
}


/**
 * Single-input normalize: same canonical pipeline as the multi-clip
 * `buildSeamlessCommand`'s per-input normalization stage, but with no
 * xfade (would need 2 inputs). CRITICAL: includes colorFilter +
 * effectChain + audioFilter + extraInputs — anything that goes into
 * the multi-input filter graph also has to land here, otherwise users
 * with single-clip projects lose every grade / VFX / mix they applied.
 *
 * The output is always Safari-safe yuv420p H.264 / AAC.
 */
function singleInputNormalizeCommand(args: {
  colorFilter?: string;
  effectChain?: string;
  audioFilter?: string;
  extraArgs: string[];        // pre-built `-i fileN` or `-f lavfi -i ...` strings
  extraInputCount: number;    // for label offset awareness (unused for now)
  masterLoudness?: MasterLoudnessPreset;
  aspectRatio?: string;
  resolution?: string;
}): string {
  const cf  = (args.colorFilter ?? "").trim();
  const efx = (args.effectChain ?? "").trim();
  const af  = (args.audioFilter ?? "").trim();
  const { w: outW, h: outH } = dimensionsForAspect(args.aspectRatio, args.resolution);

  // Build the per-clip video chain. Mirror buildSeamlessCommand's
  // graph order: scale → pad → setsar → fps → grade → effects → format.
  let videoChain: string;
  if (efx) {
    // With an effect bake, route through an intermediate [vG0] label so
    // the spliced effect chain can read it as {vIn}/{vOut}.
    const gradeStage = cf ? `${cf},` : "";
    const splicedEfx = efx.replace(/\{vIn\}/g, "vG0").replace(/\{vOut\}/g, "vE0");
    videoChain =
      `[0:v]scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
      `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:` +
      `setsar=${TARGET_SAR},fps=${TARGET_FPS},${gradeStage}format=rgba[vG0];` +
      `${splicedEfx};` +
      `[vE0]format=yuv420p,colorspace=all=${TARGET_COLORSPACE}:iall=${TARGET_COLORSPACE}:fast=1[vout]`;
  } else {
    const gradeStage = cf ? `${cf},` : "";
    videoChain =
      `[0:v]scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
      `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:color=black,` +
      `setsar=${TARGET_SAR},fps=${TARGET_FPS},${gradeStage}format=yuv420p,` +
      `colorspace=all=${TARGET_COLORSPACE}:iall=${TARGET_COLORSPACE}:fast=1[vout]`;
  }

  // Audio chain — per-clip mix filter, then optional master loudnorm.
  const audioStages: string[] = [];
  const baseAudio = `[0:a]aresample=${TARGET_SAMPLE_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo`;
  // Empty string is truthy in JS but invalid here — emits a trailing
  // comma that breaks the FFmpeg parser. Trim and check length.
  if (af && af.trim().length > 0) {
    audioStages.push(`${baseAudio},${af}[aMixed]`);
  } else {
    audioStages.push(`${baseAudio}[aMixed]`);
  }
  let lastAudio = "aMixed";
  if (args.masterLoudness && args.masterLoudness !== "off") {
    const ln = masterLoudnormFilter(args.masterLoudness);
    if (ln) {
      audioStages.push(`[${lastAudio}]${ln}[aMaster]`);
      lastAudio = "aMaster";
    }
  }

  const filter_complex = [videoChain, ...audioStages].join(";");
  const extraInputs = args.extraArgs.length > 0 ? ` ${args.extraArgs.join(" ")}` : "";

  return (
    `ffmpeg -i file1${extraInputs} ` +
    `-filter_complex "${filter_complex}" ` +
    `-map "[vout]" -map "[${lastAudio}]" ` +
    `-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p ` +
    `-profile:v high -level:v 4.1 ` +
    `-c:a aac -b:a 192k -ar ${TARGET_SAMPLE_RATE} -ac 2 ` +
    `-movflags +faststart ` +
    `output1`
  );
}

// ── Replicate runner ──────────────────────────────────────────────────

async function runFfmpeg(args: {
  replicateKey: string;
  command: string;
  inputs: Record<string, string>;
  outputName: string;
}): Promise<string> {
  // Every render runs FFmpeg on Replicate, so the key is mandatory.
  // Fail loudly with an actionable message instead of a cryptic 401.
  if (!args.replicateKey) {
    throw new Error(
      "REPLICATE_API_KEY not configured — set it in Supabase → Edge Functions → Secrets so renders can run.",
    );
  }
  const submit = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.replicateKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: FFMPEG_MODEL_VERSION,
      input: {
        command: args.command,
        output1: args.outputName,
        ...args.inputs,
      },
    }),
  });
  if (!submit.ok) {
    const text = await submit.text();
    throw new Error(`replicate_submit_${submit.status}: ${text.slice(0, 200)}`);
  }
  const submitJson = await submit.json();
  const predictionId = submitJson.id as string;
  if (!predictionId) throw new Error("no_prediction_id");

  // Poll. Long renders can take a couple of minutes; allow 4 minutes total.
  const deadline = Date.now() + 240_000;
  let lastStatus = "";
  // Bail after 3 consecutive non-OK poll responses. Previously a hard
  // `continue` swallowed every transient failure for the full 4
  // minutes — auth revocation, rate limits, and Replicate outages
  // were all indistinguishable from "still working."
  let consecutiveFailures = 0;
  while (Date.now() < deadline) {
    await sleep(3000);
    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { Authorization: `Bearer ${args.replicateKey}` } },
    );
    if (!pollRes.ok) {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        throw new Error(
          `replicate_poll_failed_${pollRes.status}: 3 consecutive non-OK responses`,
        );
      }
      continue;
    }
    consecutiveFailures = 0;
    const pred = await pollRes.json();
    lastStatus = pred.status;
    if (pred.status === "succeeded") {
      const out = pred.output?.files ?? pred.output;
      const url = Array.isArray(out) ? out[0] : out;
      if (typeof url === "string" && url.startsWith("http")) {
        return url;
      }
      throw new Error("succeeded_but_no_url");
    }
    if (pred.status === "failed" || pred.status === "canceled") {
      throw new Error(`replicate_${pred.status}: ${pred.error ?? "no detail"}`);
    }
  }
  throw new Error(`replicate_timeout_after_4m (last=${lastStatus})`);
}

// ── Persistence + helpers ─────────────────────────────────────────────

async function persistOutput(
  supabase: ReturnType<typeof createClient>,
  replicateUrl: string,
  outputKey: string,
): Promise<string> {
  // Download from Replicate (their URLs expire within ~1 hour).
  const res = await fetch(replicateUrl);
  if (!res.ok) throw new Error(`replicate_download_${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  // Sanity-check the bytes before persisting. Replicate has historically
  // returned zero-byte or HTML-error-page payloads for jobs that
  // technically "succeeded" — uploading those silently produces an
  // unplayable URL that the user discovers later as "my render is
  // broken." Reject obviously-wrong payloads with a clear error.
  if (bytes.length < 1024) {
    throw new Error(`replicate_output_too_small: ${bytes.length} bytes — render produced no usable output`);
  }
  // MP4 magic: bytes 4..8 should spell "ftyp". This is the lightest
  // possible MP4 validation; a malformed file with a valid ftyp can
  // still slip through but a Replicate HTML error page or empty body
  // will be caught here.
  const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (ftyp !== "ftyp") {
    throw new Error(
      `replicate_output_not_mp4: header reads "${ftyp}" — Replicate returned non-MP4 bytes (likely an error page)`,
    );
  }

  const { error: upErr } = await supabase.storage
    .from(OUTPUT_BUCKET)
    .upload(outputKey, bytes, {
      contentType: "video/mp4",
      upsert: true,
    });
  if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

  const { data: signed, error: signErr } = await supabase.storage
    .from(OUTPUT_BUCKET)
    .createSignedUrl(outputKey, SIGNED_URL_TTL);
  if (signErr) throw new Error(`sign_failed: ${signErr.message}`);

  return signed.signedUrl;
}

async function maybeCachedSignedUrl(
  supabase: ReturnType<typeof createClient>,
  outputKey: string,
): Promise<string | null> {
  try {
    const { data } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .createSignedUrl(outputKey, SIGNED_URL_TTL);
    if (data?.signedUrl) {
      // The signed-url API succeeds even if the file is missing; do a HEAD
      // through the signed URL to verify the byte content actually exists.
      const probe = await fetch(data.signedUrl, { method: "HEAD" });
      if (probe.ok) return data.signedUrl;
    }
  } catch { /* ignore */ }
  return null;
}

async function getIntroMeta(
  supabase: ReturnType<typeof createClient>,
): Promise<{ url: string; duration: number } | null> {
  try {
    const { data } = await supabase.storage.from(INTRO_BUCKET).list("intro", { limit: 25 });
    const found = data?.find((f) => f.name === "intro.mp4");
    if (!found) return null;
    const { data: pub } = supabase.storage.from(INTRO_BUCKET).getPublicUrl(INTRO_PATH);
    return {
      url: pub.publicUrl,
      // intro.mp4 ships from the StudioIntro animation: ~7.5s real time
      // including the iris-out hand-off frame.
      duration: 7.5,
    };
  } catch { return null; }
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

// `round` is imported from ../_shared/seamless-command.ts.

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ok(body: Record<string, unknown>): Response {
  // We expose multiple aliases for `url` so the various legacy callers
  // (auto-stitch-trigger, pipeline-watchdog, final-assembly, hollywood-pipeline,
  // seedance-pipeline, generate-project-trailer, useRetryStitch on the
  // client side before its removal) keep working without per-caller patches.
  const url = body.url as string | undefined;
  return new Response(
    JSON.stringify({
      ok: true,
      success: true,
      mode: "seamless",
      videoUrl: url,
      finalVideoUrl: url,
      manifestUrl: url,
      ...body,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
function ko(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: false, ...body }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
