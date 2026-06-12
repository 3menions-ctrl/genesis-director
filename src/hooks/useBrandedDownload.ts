/**
 * useBrandedDownload — hand any "Download" button a video URL and it
 * returns a branded download URL with the Small Bridges intro prepended.
 *
 * Usage:
 *   const { downloadBranded, downloading } = useBrandedDownload();
 *   <button onClick={() => downloadBranded({ videoUrl, projectId, title })}>
 *     Download
 *   </button>
 *
 * Behaviour:
 *   • Calls the `brand-video-download` edge function (see
 *     supabase/functions/brand-video-download/index.ts).
 *   • Shows a toast progress indicator while muxing.
 *   • Gracefully degrades — if the edge function says "intro_missing"
 *     or the call fails entirely, falls back to the un-branded video.
 *   • Final step: triggers a browser download via a hidden <a> element
 *     using the resolved URL.
 */
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DownloadArgs {
  videoUrl: string;
  projectId?: string;
  /** Used as the suggested filename. Falls back to the source URL's basename. */
  title?: string;
}

interface BrandResponse {
  ok: boolean;
  url?: string;
  branded?: boolean;
  reason?: string;
  error?: string;
}

export function useBrandedDownload() {
  const [downloading, setDownloading] = useState(false);

  const downloadBranded = useCallback(
    async ({ videoUrl, projectId, title }: DownloadArgs) => {
      if (!videoUrl) {
        toast.error("Nothing to download");
        return;
      }
      setDownloading(true);
      const toastId = toast.loading("Stamping the intro on your video…");
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.functions.invoke<BrandResponse>(
          "brand-video-download",
          { body: { videoUrl, projectId, userId: user?.id } },
        );
        if (error) throw error;

        const finalUrl = data?.url ?? videoUrl;
        const filename = sanitizeFilename(title || basename(videoUrl) || "small-bridges-video.mp4");

        const a = document.createElement("a");
        a.href = finalUrl;
        a.download = filename.endsWith(".mp4") ? filename : `${filename}.mp4`;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();

        toast.success(
          data?.branded ? "Branded download ready" : "Download ready (intro not yet uploaded)",
          { id: toastId },
        );
      } catch (e) {
        // Fallback: just trigger the un-branded source so the user still
        // gets their video.
        try {
          const a = document.createElement("a");
          a.href = videoUrl;
          a.download = (title ?? "video") + ".mp4";
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch { /* ignore */ }
        toast.error(
          `Couldn't brand the download — downloading the original instead. (${
            e instanceof Error ? e.message : "unknown"
          })`,
          { id: toastId },
        );
      } finally {
        setDownloading(false);
      }
    },
    [],
  );

  return { downloadBranded, downloading };
}

function sanitizeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

function basename(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    return parts[parts.length - 1] ?? "";
  } catch { return ""; }
}
