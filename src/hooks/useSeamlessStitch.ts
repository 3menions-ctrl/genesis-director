/**
 * useSeamlessStitch — single hook for the v2 stitcher.
 *
 *   const { stitchAndDownload, stitching } = useSeamlessStitch();
 *
 *   <button onClick={() => stitchAndDownload({ projectId, title })}>
 *     Download branded
 *   </button>
 *
 * What it does:
 *   1. Calls the `seamless-stitcher` edge function with `includeIntro: true`.
 *   2. The function chains every completed clip with a 0.4s crossfade
 *      (xfade for video, acrossfade for audio), prepends the Small
 *      Bridges intro, and persists the result to `published-renders/`.
 *   3. Hook returns the signed download URL and immediately fires a
 *      browser download to that URL.
 *
 * Cache behaviour:
 *   The stitcher computes a content hash of (intro flag, transition,
 *   input URLs). Re-downloading the same project doesn't re-encode —
 *   it returns a fresh signed URL pointing at the cached MP4.
 *
 * Failure behaviour:
 *   If the stitch fails (no completed clips, replicate down, etc.) the
 *   hook shows a clear error toast. There's no fall-through to the
 *   unbranded source — that's by design now; the seamless stitcher is
 *   the canonical download path.
 */
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Per-boundary transition descriptor — when the stitcher honors
 *  this, each transition runs at the requested kind + duration
 *  between the named clips. When it doesn't, the stitcher falls
 *  back to the global transitionType/transitionDuration. */
export interface BoundaryTransition {
  fromClipId: string;
  toClipId: string;
  kind: string;
  durationSec: number;
}

interface Args {
  projectId: string;
  /** Used as suggested filename. */
  title?: string;
  /** Override intro pre-roll (default true). */
  includeIntro?: boolean;
  /** Override crossfade duration in seconds (default 0.4). */
  transitionDuration?: number;
  /** Override xfade transition name (default "fade"). Try: "fade", "dissolve", "wipeleft", "slidedown". */
  transitionType?: string;
  /** Per-boundary transitions (preferred). When present the stitcher
   *  applies the right kind + duration at each clip junction; the
   *  global transitionType/transitionDuration are used only as a
   *  fallback for boundaries with no explicit entry. */
  transitions?: BoundaryTransition[];
  /** Force a re-stitch even if a cached output exists. */
  forceRestitch?: boolean;
}

/**
 * Editor-mode args. The editor doesn't carry a project row; it stitches
 * the user's working session list directly. The `sessionId` namespaces
 * the output key so re-renders are idempotent within an editor session.
 */
interface EditorArgs {
  sessionId: string;
  clips: { url: string; duration?: number; clipId?: string }[];
  title?: string;
  includeIntro?: boolean;
  transitionDuration?: number;
  transitionType?: string;
  transitions?: BoundaryTransition[];
  forceRestitch?: boolean;
}

interface StitchResponse {
  ok: boolean;
  url?: string;
  contentHash?: string;
  cached?: boolean;
  branded?: boolean;
  stitchedAt?: string;
  error?: string;
}

export function useSeamlessStitch() {
  const [stitching, setStitching] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const stitch = useCallback(async (args: Args): Promise<StitchResponse> => {
    const { data, error } = await supabase.functions.invoke<StitchResponse>(
      "seamless-stitcher",
      {
        body: {
          projectId: args.projectId,
          includeIntro: args.includeIntro ?? true,
          transitionDuration: args.transitionDuration,
          transitionType: args.transitionType,
          transitions: args.transitions,
          forceRestitch: args.forceRestitch,
        },
      },
    );
    if (error) throw error;
    if (!data || !data.ok || !data.url) {
      throw new Error(data?.error ?? "stitch_failed");
    }
    return data;
  }, []);

  const stitchAndDownload = useCallback(
    async (args: Args) => {
      if (!args.projectId) {
        toast.error("Nothing to stitch");
        return;
      }
      setStitching(true);
      const toastId = toast.loading(
        args.includeIntro === false ? "Stitching your video…" : "Stitching with intro…",
      );
      try {
        const res = await stitch(args);
        setLastUrl(res.url ?? null);

        // Trigger the download immediately.
        if (res.url) {
          const filename = sanitize(args.title || "small-bridges-video") + ".mp4";
          const a = document.createElement("a");
          a.href = res.url;
          a.download = filename;
          a.target = "_blank";
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }

        toast.success(
          res.cached
            ? `Ready — pulled from cache${res.branded ? " (with intro)" : ""}`
            : `Stitched${res.branded ? " with intro" : ""} and downloading`,
          { id: toastId },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        const friendly =
          msg.includes("no_completed_clips") ? "No completed clips to stitch yet"
          : msg.includes("intro_missing") ? "Intro asset hasn't been uploaded — downloading without it"
          : msg.includes("replicate_timeout") ? "Render is taking longer than usual. Try again in a minute."
          : msg.includes("project_not_found") ? "Project not found"
          : `Stitch failed: ${msg}`;
        toast.error(friendly, { id: toastId });
      } finally {
        setStitching(false);
      }
    },
    [stitch],
  );

  /**
   * Editor-mode wrapper. Stitches an explicit `clips[]` array (the
   * editor flow) and triggers a download. Same idempotency contract
   * as `stitchAndDownload`, namespaced by `sessionId`.
   */
  const stitchEditorAndDownload = useCallback(
    async (args: EditorArgs) => {
      if (!args.sessionId || args.clips.length < 1) {
        toast.error("Nothing to stitch");
        return;
      }
      setStitching(true);
      const toastId = toast.loading(`Stitching ${args.clips.length} clips…`);
      try {
        const { data, error } = await supabase.functions.invoke<StitchResponse>(
          "seamless-stitcher",
          {
            body: {
              sessionId: args.sessionId,
              clips: args.clips,
              includeIntro: args.includeIntro ?? false,
              transitionDuration: args.transitionDuration,
              transitionType: args.transitionType,
              transitions: args.transitions,
              forceRestitch: args.forceRestitch,
            },
          },
        );
        if (error) throw error;
        if (!data || !data.ok || !data.url) {
          throw new Error(data?.error ?? "stitch_failed");
        }
        setLastUrl(data.url);

        const filename = sanitize(args.title || "small-bridges-edit") + ".mp4";
        const a = document.createElement("a");
        a.href = data.url;
        a.download = filename;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();

        toast.success(
          data.cached ? "Ready — pulled from cache" : "Stitched and downloading",
          { id: toastId },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        toast.error(`Stitch failed: ${msg}`, { id: toastId });
      } finally {
        setStitching(false);
      }
    },
    [],
  );

  return { stitchAndDownload, stitchEditorAndDownload, stitch, stitching, lastUrl };
}

function sanitize(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}
