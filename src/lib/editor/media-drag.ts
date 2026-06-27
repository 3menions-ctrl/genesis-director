/**
 * media-drag — drag a library asset (a remote video URL, not file
 * bytes) from a panel onto the timeline.
 *
 * The drag source (MyLibraryPanel rows, MediaLibrary tiles) stamps a
 * MediaDragPayload onto the dataTransfer under MEDIA_DRAG_MIME. The
 * timeline's dropzone (useTimelineDropzone) reads it back and routes
 * to addRemoteClipToTimeline — the SAME persistence path the click-to-
 * add buttons already use (DB row → in-memory store → doc mirror), so
 * drag-drop and click stay in lockstep.
 *
 * A custom MIME (not "text/plain") means OS-file drags and library
 * drags never collide: the dropzone checks `types.includes()` to tell
 * them apart, and a stray text drag from elsewhere won't masquerade as
 * a clip.
 */
import { appendPendingClip, resolvePendingClip } from "./store";
import { ingestRemoteUrl, insertWithNextShotIndex } from "./upload-ingest";
import { getDocumentState, flushNow } from "./document-store";

/** dataTransfer key for a library-asset drag. */
export const MEDIA_DRAG_MIME = "application/x-sb-media";

/** What the drag source serialises onto the dataTransfer. */
export interface MediaDragPayload {
  /** Public URL of the already-stored video. */
  assetUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  /** Source's known duration; the helper clamps + falls back to 10s. */
  durationSec: number | null;
}

/**
 * Persist a remote-URL asset as a new clip on the current project and
 * mirror it into the in-memory editor store + ScriptDocument so the
 * timeline shows it instantly without a reload.
 *
 * This is the canonical "library asset → timeline" path, shared by the
 * click-to-add buttons and the drag-drop dropzone. Returns the new
 * clip id; throws if the DB insert fails.
 */
export async function addRemoteClipToTimeline(opts: {
  projectId: string;
  userId: string;
  assetUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  durationSec: number | null;
}): Promise<string> {
  const durationSec = Math.max(0.5, Math.min(600, opts.durationSec ?? 10));
  const title = opts.title ?? "Library clip";
  const prompt = `Imported: ${title}`;

  // 1. Persist into video_clips FIRST — the seamless-stitcher reads
  //    from this table, not the ScriptDocument. Skipping it leaves the
  //    clip visible on the timeline but invisible to the renderer.
  const clipId = await insertWithNextShotIndex({
    projectId:    opts.projectId,
    userId:       opts.userId,
    prompt,
    durationSec,
    videoUrl:     opts.assetUrl,
    thumbnailUrl: opts.thumbnailUrl,
  });
  if (!clipId) throw new Error("Couldn't persist clip to project");

  // 2. Mirror into the in-memory store so the timeline updates instantly.
  appendPendingClip({ id: clipId, prompt, durationSec, thumbnailUrl: opts.thumbnailUrl });
  resolvePendingClip(clipId, {
    videoUrl:     opts.assetUrl,
    thumbnailUrl: opts.thumbnailUrl,
    durationSec,
  });

  // 3. Mirror into the ScriptDocument so doc-aware surfaces (Storyboard,
  //    BudgetPanel) see the new shot too. Best-effort.
  try {
    const doc = getDocumentState().doc;
    if (doc) {
      ingestRemoteUrl({
        videoUrl:     opts.assetUrl,
        thumbnailUrl: opts.thumbnailUrl,
        title,
        durationSec,
        doc,
      });
      await flushNow();
    }
  } catch { /* doc mirror is best-effort */ }

  return clipId;
}
