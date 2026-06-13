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

const VALID_MIMETYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

export type IngestValidationError =
  | "unsupported-format"
  | "too-large"
  | "could-not-probe"
  | "duration-out-of-range";

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
    supabase.storage.from("editor-images").upload(thumbPath, validated.thumbnailBlob, {
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
    .from("editor-images")
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
  const urls = await uploadValidated(validated, args.userId, args.projectId);

  // Pick or create the destination scene.
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
        completedAt: new Date(0).toISOString(),
        takes: [],
      },
      approval: {
        state: "completed",
        changedAt: new Date(0).toISOString(),
        changedBy: "user",
        reason: "Uploaded by user — no generation needed",
      },
    },
    { by: "user" },
  );
  if (!shotId) throw new Error("Could not add shot to document");
  return shotId;
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
