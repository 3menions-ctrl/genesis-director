/**
 * upload-ingest — turn a user-uploaded video into a Shot.
 *
 * The flow:
 *   1. User drops a file (drag-drop / file-picker / paste).
 *   2. We extract a thumbnail (first frame) + a sane filename.
 *   3. Upload the video bytes to the video-clips bucket.
 *   4. Add a Shot to the document with generated.videoUrl pre-filled
 *      and approval.state = 'completed'. No engine call needed —
 *      the user IS the generator for uploaded clips.
 *   5. The editor shows the clip on V1 immediately.
 *
 * Validation:
 *   - Type: video/mp4, video/quicktime, video/webm
 *   - Size: 500 MB cap (the bucket policy enforces this anyway, we
 *     fail-fast for a better error message)
 *   - Duration: bounded 0.5s..120s (a sane editor frame for a single
 *     shot — multi-shot ingestion comes in a later wave)
 *
 * Naming:
 *   "wedding-aerial-2.mp4" → Shot { number, modelPrompt: "User
 *   upload: wedding aerial 2" }. The user can rename in the
 *   inspector.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  addShot,
  addScene,
} from "./document-store";
import {
  newScriptId,
} from "./script-document";
import type { ScriptDocument } from "./script-document";

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const VALID_VIDEO_MIMETYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

// Audio MIMEs we accept as standalone music / VO / SFX clips. They
// land on the A2 (music) track by default with no thumbnail and
// an inferred duration from the file. Routing to A1 (voice-over)
// is a one-click move in the inspector.
const VALID_AUDIO_MIMETYPES = new Set([
  "audio/mpeg",      // .mp3
  "audio/mp4",       // .m4a
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/x-m4a",
]);

const VALID_MIMETYPES = new Set([
  ...VALID_VIDEO_MIMETYPES,
  ...VALID_AUDIO_MIMETYPES,
]);

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

export type IngestValidationError =
  | "unsupported-format"
  | "too-large"
  | "could-not-probe"
  | "duration-out-of-range";

export type MediaKind = "video" | "audio";

export function detectMediaKind(file: File): MediaKind | null {
  if (VALID_VIDEO_MIMETYPES.has(file.type)) return "video";
  if (VALID_AUDIO_MIMETYPES.has(file.type)) return "audio";
  return null;
}

export interface ValidatedFile {
  file: File;
  durationSec: number;
  thumbnailBlob: Blob;
  inferredName: string;
}

/**
 * Validate a single file. Throws an Error whose message is one of
 * the IngestValidationError values. The caller maps these to
 * user-friendly toast copy.
 */
export async function validateUploadFile(
  file: File,
): Promise<ValidatedFile> {
  if (!VALID_MIMETYPES.has(file.type)) {
    throw new Error("unsupported-format" satisfies IngestValidationError);
  }
  if (file.size > MAX_BYTES) {
    throw new Error("too-large" satisfies IngestValidationError);
  }
  const kind = detectMediaKind(file);
  if (kind === "audio") {
    const probe = await probeAudio(file);
    if (!probe) {
      throw new Error("could-not-probe" satisfies IngestValidationError);
    }
    // Audio clips have a wider duration ceiling — music beds can be
    // 5+ minutes. We cap at 600s (10 min) to keep upload sane.
    if (probe.durationSec < 0.5 || probe.durationSec > 600) {
      throw new Error("duration-out-of-range" satisfies IngestValidationError);
    }
    return {
      file,
      durationSec: probe.durationSec,
      // Audio has no visual; we emit a tiny transparent PNG so the
      // downstream pipeline that expects a thumbnailBlob doesn't NPE.
      thumbnailBlob: new Blob([new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x62, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82,
      ])], { type: "image/png" }),
      inferredName: inferNameFromFile(file),
    };
  }
  const probe = await probeVideo(file);
  if (!probe) {
    throw new Error("could-not-probe" satisfies IngestValidationError);
  }
  if (probe.durationSec < 0.5 || probe.durationSec > 120) {
    throw new Error("duration-out-of-range" satisfies IngestValidationError);
  }
  return {
    file,
    durationSec: probe.durationSec,
    thumbnailBlob: probe.thumbnailBlob,
    inferredName: inferNameFromFile(file),
  };
}

/**
 * Probe an audio file via a hidden <audio> element to extract its
 * duration. No thumbnail — audio has nothing to render visually.
 */
async function probeAudio(file: File): Promise<{ durationSec: number } | null> {
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = url;
    return await new Promise<{ durationSec: number } | null>((resolve) => {
      const cleanup = () => {
        URL.revokeObjectURL(url);
      };
      a.onloadedmetadata = () => {
        const dur = a.duration;
        cleanup();
        if (!isFinite(dur) || dur <= 0) {
          resolve(null);
          return;
        }
        resolve({ durationSec: dur });
      };
      a.onerror = () => {
        cleanup();
        resolve(null);
      };
      // Safety timeout — some Safari builds never fire loadedmetadata
      // on malformed audio.
      window.setTimeout(() => {
        cleanup();
        resolve(null);
      }, 8000);
    });
  } catch {
    return null;
  }
}

/**
 * Run the file through a hidden <video> + <canvas> in the user's
 * browser to extract duration + first-frame thumbnail. Pure DOM —
 * no server roundtrip.
 */
async function probeVideo(
  file: File,
): Promise<{ durationSec: number; thumbnailBlob: Blob } | null> {
  try {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error("video load failed"));
      // Belt + braces — if neither fires within 8s, bail.
      window.setTimeout(() => reject(new Error("video probe timeout")), 8000);
    });

    // Seek to frame 0 for the thumbnail.
    await new Promise<void>((resolve, reject) => {
      v.onseeked = () => resolve();
      v.onerror = () => reject(new Error("video seek failed"));
      v.currentTime = 0;
    });

    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    URL.revokeObjectURL(url);
    if (!blob) return null;

    return { durationSec: v.duration, thumbnailBlob: blob };
  } catch {
    return null;
  }
}

function inferNameFromFile(file: File): string {
  return file.name
    .replace(/\.[a-zA-Z0-9]{2,5}$/, "")
    .replace(/[-_.]+/g, " ")
    .trim()
    .slice(0, 80) || "Upload";
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────

interface UploadResult {
  videoUrl: string;
  thumbnailUrl: string;
}

/**
 * Upload the validated file + thumbnail to the storage buckets and
 * return the public URLs.
 */
export async function uploadValidated(
  validated: ValidatedFile,
  userId: string,
  projectId: string,
): Promise<UploadResult> {
  const id = newScriptId("upload");
  const videoPath = `${userId}/${projectId}/${id}.${pickExtension(validated.file.type)}`;
  const thumbPath = `${userId}/${projectId}/${id}.thumb.jpg`;

  const [videoUp, thumbUp] = await Promise.all([
    supabase.storage.from("video-clips").upload(videoPath, validated.file, {
      contentType: validated.file.type,
      upsert: true,
    }),
    supabase.storage.from("video-thumbnails").upload(thumbPath, validated.thumbnailBlob, {
      contentType: "image/jpeg",
      upsert: true,
    }),
  ]);
  if (videoUp.error) throw videoUp.error;
  if (thumbUp.error) throw thumbUp.error;

  const { data: videoUrl } = supabase.storage
    .from("video-clips")
    .getPublicUrl(videoPath);
  const { data: thumbUrl } = supabase.storage
    .from("video-thumbnails")
    .getPublicUrl(thumbPath);

  return {
    videoUrl: videoUrl.publicUrl,
    thumbnailUrl: thumbUrl.publicUrl,
  };
}

function pickExtension(mime: string): string {
  switch (mime) {
    case "video/mp4": return "mp4";
    case "video/quicktime": return "mov";
    case "video/webm": return "webm";
    case "video/x-matroska": return "mkv";
    case "audio/mpeg": return "mp3";
    case "audio/mp4": return "m4a";
    case "audio/x-m4a": return "m4a";
    case "audio/wav": return "wav";
    case "audio/wave": return "wav";
    case "audio/x-wav": return "wav";
    case "audio/aac": return "aac";
    case "audio/ogg": return "ogg";
    case "audio/flac": return "flac";
    default: return "mp4";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose — single entry point the inspector / drop zone uses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full ingest flow: validate → upload → add Shot to the document.
 *
 * Picks (or creates) the destination scene. If the document already
 * has at least one scene, the upload lands in the last scene so
 * uploaded shots stay together at the tail. If the doc has zero
 * scenes, a fresh "Uploads" scene is created.
 *
 * Returns the new shot id on success.
 */
export async function ingestUpload(args: {
  file: File;
  userId: string;
  projectId: string;
  doc: ScriptDocument;
}): Promise<string> {
  const validated = await validateUploadFile(args.file);
  const mediaKind = detectMediaKind(args.file) ?? "video";
  const urls = await uploadValidated(validated, args.userId, args.projectId);

  // 1. INSERT a video_clips row so the timeline (which renders from this
  //    table at project-load) sees the uploaded clip on next read AND on
  //    next reload. Without this insert the clip ONLY exists in the
  //    ScriptDocument constitution layer — the timeline never knows.
  //
  //    shot_index is part of a (project_id, shot_index) UNIQUE index.
  //    The ScriptDocument's flat shot count is unreliable as a source
  //    because the DB may already hold clips from the original generation
  //    pipeline that aren't represented in the in-memory doc. We probe
  //    the DB for the current max and write max+1, retrying on conflict
  //    (concurrent uploads or a stale read).
  let dbClipId: string | null = null;
  try {
    dbClipId = await insertWithNextShotIndex({
      projectId: args.projectId,
      userId: args.userId,
      prompt: `User upload: ${validated.inferredName}`,
      durationSec: validated.durationSec,
      videoUrl: urls.videoUrl,
      thumbnailUrl: urls.thumbnailUrl,
      // Audio uploads land on the A2 (music) track by default so they
      // don't show up as black video clips on V1. The user can move
      // them to A1 (VO) in the inspector. Video uploads stay on V1.
      trackId: mediaKind === "audio" ? "sys:A2" : null,
    });
  } catch (e) {
    // PERSISTENCE GUARANTEE (audit fix): if the video_clips insert fails the
    // clip exists ONLY in storage + the in-memory doc — it vanishes on the next
    // reload and never appears in the Library. Previously this was swallowed and
    // the function still ran addShot + returned success, so the user got an
    // "Uploaded" toast for a clip that was silently lost. Re-throw so the caller
    // (Timeline upload handler) reports the failure instead of a false success.
    // eslint-disable-next-line no-console
    console.error("[upload] video_clips insert failed — clip not persisted:", e);
    throw new Error(
      `Upload couldn't be saved to your library (${(e as Error)?.message ?? "database error"}). Please try again.`,
    );
  }

  // 1.5 Mirror the FIRST upload's URLs onto movie_projects so the
  // Library cards (which read movie_projects.thumbnail_url) and the
  // Reel/Theater player (which read movie_projects.video_url) light
  // up immediately. Without this, projects with only uploaded clips
  // show a placeholder thumbnail forever and the player says "Still
  // rendering…" — the user reported exactly that. We only set when
  // the column is currently null so a real render (final-assembly)
  // can still overwrite later.
  if (dbClipId) {
    try {
      const mirror: Record<string, string> = { video_url: urls.videoUrl };
      if (urls.thumbnailUrl) mirror.thumbnail_url = urls.thumbnailUrl;
      await supabase
        .from("movie_projects")
        .update(mirror)
        .eq("id", args.projectId)
        .is("video_url", null);
      if (urls.thumbnailUrl) {
        await supabase
          .from("movie_projects")
          .update({ thumbnail_url: urls.thumbnailUrl })
          .eq("id", args.projectId)
          .is("thumbnail_url", null);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[upload] movie_projects mirror failed:", e);
    }
  }

  // 2. Mirror into the in-memory editor store so the clip shows on the
  //    timeline IMMEDIATELY (before next reload). Lazy-loaded so this
  //    file can stay framework-agnostic.
  if (dbClipId) {
    try {
      const storeMod = await import("./store");
      storeMod.appendPendingClip({
        id:           dbClipId,
        prompt:       `User upload: ${validated.inferredName}`,
        durationSec:  validated.durationSec,
        thumbnailUrl: urls.thumbnailUrl,
      });
      storeMod.resolvePendingClip(dbClipId, {
        videoUrl:     urls.videoUrl,
        thumbnailUrl: urls.thumbnailUrl,
        durationSec:  validated.durationSec,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[upload] store mirror failed:", e);
    }
  }

  // 3. Mirror into the ScriptDocument so doc-aware surfaces (BudgetPanel,
  //    ShotInspector, Storyboard) see it too. This is the layer that
  //    used to be the ONLY destination — kept for parity.
  let sceneId = args.doc.scenes[args.doc.scenes.length - 1]?.id;
  if (!sceneId) {
    sceneId = addScene(
      { slug: "UPLOADS", description: "User-uploaded clips.", number: 1 },
      { by: "user" },
    );
  }
  const shotId = addShot(
    sceneId,
    {
      modelPrompt: `User upload: ${validated.inferredName}`,
      cameraDirection: validated.inferredName,
      framing: "medium",
      durationSec: validated.durationSec,
      generated: {
        videoUrl: urls.videoUrl,
        thumbnailUrl: urls.thumbnailUrl,
        completedAt: new Date().toISOString(),
        takes: [],
      },
      approval: {
        state: "completed",
        changedAt: new Date().toISOString(),
        changedBy: "user",
        reason: "Uploaded by user — no generation needed",
      },
    },
    { by: "user" },
  );
  if (!shotId) throw new Error("Could not add shot to document");
  return shotId;
}

/**
 * ingestRemoteUrl — add an existing video URL (own asset OR public
 * library) as a Shot, without re-uploading the bytes. Used by the
 * Media Library panel when a user clicks a tile to add it to the
 * timeline.
 */
export function ingestRemoteUrl(args: {
  videoUrl: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  durationSec?: number;
  doc: ScriptDocument;
  /** When set, the shot is annotated with this track id so the
   *  timeline routes it off the default V1 video chain. Audio scores
   *  pass "sys:A2" here so they land on the Music track. */
  trackId?: string | null;
}): string {
  if (!args.videoUrl) throw new Error("missing-video-url");
  let sceneId = args.doc.scenes[args.doc.scenes.length - 1]?.id;
  if (!sceneId) {
    sceneId = addScene(
      { slug: "LIBRARY", description: "Clips imported from the media library.", number: 1 },
      { by: "user" },
    );
  }
  const safeTitle = (args.title ?? "Library clip").trim() || "Library clip";
  // Audio routed to a non-default track (e.g. a full music score on
  // sys:A2) lifts the 120s single-shot ceiling — a cinematic score can
  // run several minutes and we want the whole bed imported intact. The
  // wider 600s cap mirrors the audio ceiling in validateUploadFile.
  const isAudioTrack = args.trackId === "sys:A2" || args.trackId === "sys:A1";
  const dur = isAudioTrack
    ? Math.max(0.5, Math.min(600, args.durationSec ?? 30))
    : Math.max(0.5, Math.min(120, args.durationSec ?? 10));
  const shotId = addShot(
    sceneId,
    {
      modelPrompt:     `Imported: ${safeTitle}`,
      cameraDirection: safeTitle,
      framing:         "medium",
      durationSec:     dur,
      generated: {
        videoUrl:     args.videoUrl,
        thumbnailUrl: args.thumbnailUrl ?? null,
        completedAt:  new Date().toISOString(),
        takes: [],
      },
      approval: {
        state:     "completed",
        changedAt: new Date().toISOString(),
        changedBy: "user",
        reason:    "Imported from media library — no generation needed",
      },
    },
    { by: "user" },
  );
  if (!shotId) throw new Error("Could not add shot to document");
  return shotId;
}

/**
 * ingestMusicUrl — land a remote audio URL (a generated score, or a
 * legacy movie_projects.music_url) on the A2 (Music) track, fully
 * wired end to end:
 *
 *   1. INSERT a video_clips row carrying properties.trackId="sys:A2"
 *      so the score survives a reload (the loader re-reads this table).
 *   2. Mirror into the in-memory editor store AND tag the clip with
 *      properties.trackId="sys:A2" so the Timeline's musicClips filter
 *      picks it up immediately on the A2 band.
 *   3. Mirror into the ScriptDocument so doc-aware surfaces see it.
 *
 * Mirrors the structure of ingestUpload but skips the bytes upload —
 * the audio already lives at a public/signed URL. Returns the new
 * video_clips row id (or null when the DB insert ultimately fails;
 * the in-memory + doc mirrors still proceed so the user sees the
 * score on the timeline for this session).
 */
export async function ingestMusicUrl(args: {
  musicUrl: string;
  userId: string;
  projectId: string;
  doc: ScriptDocument;
  title?: string | null;
  durationSec?: number;
}): Promise<string | null> {
  if (!args.musicUrl) throw new Error("missing-video-url");
  const title = (args.title ?? "Generated score").trim() || "Generated score";
  const durationSec = Math.max(0.5, Math.min(600, args.durationSec ?? 30));
  const prompt = `Score: ${title}`;

  // 1. DB row on A2 so the score is durable across reloads.
  let dbClipId: string | null = null;
  try {
    dbClipId = await insertWithNextShotIndex({
      projectId: args.projectId,
      userId: args.userId,
      prompt,
      durationSec,
      videoUrl: args.musicUrl,
      thumbnailUrl: null,
      trackId: "sys:A2",
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[music] video_clips insert threw:", e);
  }

  // 2. In-memory store mirror so the A2 band lights up immediately.
  //    appendPendingClip lands the clip on the project's clip list;
  //    resolvePendingClip swaps in the playable URL; setClipProperty
  //    tags trackId so the Timeline routes it to the Music band.
  const clipId = dbClipId ?? newScriptId("score");
  try {
    const storeMod = await import("./store");
    storeMod.appendPendingClip({
      id: clipId,
      prompt,
      durationSec,
      thumbnailUrl: null,
    });
    storeMod.resolvePendingClip(clipId, {
      videoUrl: args.musicUrl,
      thumbnailUrl: null,
      durationSec,
    });
    storeMod.setClipProperty(clipId, { trackId: "sys:A2" });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[music] store mirror failed:", e);
  }

  // 3. ScriptDocument mirror (best-effort) so doc-aware surfaces see it.
  try {
    ingestRemoteUrl({
      videoUrl: args.musicUrl,
      thumbnailUrl: null,
      title,
      durationSec,
      doc: args.doc,
      trackId: "sys:A2",
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[music] doc mirror failed:", e);
  }

  return dbClipId;
}

// ─────────────────────────────────────────────────────────────────────────────
// User-facing error mapping — copy for toasts
// ─────────────────────────────────────────────────────────────────────────────

export function describeIngestError(
  err: unknown,
): { message: string; description?: string } {
  const code = err instanceof Error ? err.message : String(err);
  switch (code as IngestValidationError) {
    case "unsupported-format":
      return {
        message: "That file format isn't supported",
        description: "Try MP4, MOV, WebM, or MKV.",
      };
    case "too-large":
      return {
        message: "File too large",
        description: "Max 500 MB. Re-encode or compress and try again.",
      };
    case "could-not-probe":
      return {
        message: "Couldn't read that video",
        description: "Re-export from your editor and try again.",
      };
    case "duration-out-of-range":
      return {
        message: "Clip duration out of range",
        description: "Single-shot ingest accepts 0.5s — 120s. Split long clips first.",
      };
    default:
      return {
        message: "Upload failed",
        description: typeof err === "string" ? err : (err instanceof Error ? err.message : "Unknown error"),
      };
  }
}

/**
 * Insert a video_clips row at the next available shot_index for the
 * project. Probes the DB max + 1, then retries on UNIQUE-violation up
 * to a few times so two concurrent uploads don't both lose to the same
 * read. Returns the new row's id, or null when the insert ultimately
 * fails (caller logs + lets the doc-side fallback proceed).
 */
export async function insertWithNextShotIndex(args: {
  projectId: string;
  userId: string;
  prompt: string;
  durationSec: number;
  videoUrl: string;
  thumbnailUrl: string | null;
  /** When set, written into properties.trackId so the clip lands on
   *  a non-default track at render time. Used by audio uploads
   *  (defaults to sys:A2 — music) to keep them off the V1 video chain. */
  trackId?: string | null;
}): Promise<string | null> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Probe the current max shot_index for this project.
    const { data: maxRow, error: maxErr } = await supabase
      .from("video_clips")
      .select("shot_index")
      .eq("project_id", args.projectId)
      .order("shot_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) {
      // eslint-disable-next-line no-console
      console.warn("[upload] shot_index probe failed:", maxErr);
      return null;
    }
    const baseIdx =
      maxRow && typeof (maxRow as { shot_index: number | null }).shot_index === "number"
        ? ((maxRow as { shot_index: number }).shot_index + 1)
        : 0;
    // Add the attempt offset so a UNIQUE collision with a concurrent
    // upload retries at a higher slot instead of re-reading the same
    // (possibly cached) max.
    const shotIndex = baseIdx + attempt;

    const insertPayload: Record<string, unknown> = {
      project_id:       args.projectId,
      user_id:          args.userId,
      shot_index:       shotIndex,
      prompt:           args.prompt,
      // duration_seconds is INTEGER in the schema, but probed video
      // durations are floats (e.g. 10.042). Round + clamp to ≥1 so
      // Postgres doesn't reject the syntax.
      duration_seconds: Math.max(1, Math.round(args.durationSec)),
      status:           "completed",
      video_url:        args.videoUrl,
      start_image_url:  args.thumbnailUrl,
    };
    if (args.trackId) {
      insertPayload.properties = { trackId: args.trackId };
    }
    const { data: row, error } = await supabase
      .from("video_clips")
      .insert(insertPayload as never)
      .select("id")
      .single();

    if (!error && row) return (row as { id: string }).id;

    // 23505 = unique_violation. Retry; anything else, surface so the
    // caller can show the user what actually went wrong (RLS reject,
    // FK violation, schema drift) instead of a generic null.
    const code = (error as { code?: string } | null)?.code;
    if (code !== "23505") {
      const msg = (error as { message?: string } | null)?.message ?? "unknown";
      const details = (error as { details?: string } | null)?.details ?? "";
      // eslint-disable-next-line no-console
      console.warn("[upload] video_clips insert failed:", error);
      throw new Error(`video_clips insert rejected (${code ?? "?"}): ${msg}${details ? ` — ${details}` : ""}`);
    }
    // eslint-disable-next-line no-console
    console.warn(`[upload] shot_index ${shotIndex} taken — retrying`);
  }
  // eslint-disable-next-line no-console
  console.warn("[upload] gave up after retries for shot_index collision");
  return null;
}
