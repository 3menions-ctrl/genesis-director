/**
 * StitchDownloadButton — premium "Download with intro" button.
 *
 * Calls the seamless-stitcher edge function (with intro prepended) and
 * fires a browser download as soon as the signed URL is ready. Cached
 * outputs return in <1s; first-time renders take 20–90s depending on
 * source length.
 *
 * Two variants:
 *   variant="primary"   → cinematic glow pill (default)
 *   variant="ghost"     → compact icon button for dense lists
 */
import { Download, Loader2 } from "lucide-react";
import { useSeamlessStitch } from "@/hooks/useSeamlessStitch";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  title?: string;
  variant?: "primary" | "ghost";
  label?: string;
  /** When true, omit the brand intro pre-roll. */
  noIntro?: boolean;
  className?: string;
}

export function StitchDownloadButton({
  projectId,
  title,
  variant = "primary",
  label = "Download",
  noIntro = false,
  className,
}: Props) {
  const { stitchAndDownload, stitching } = useSeamlessStitch();

  const onClick = () => {
    void stitchAndDownload({
      projectId,
      title,
      includeIntro: !noIntro,
    });
  };

  if (variant === "ghost") {
    return (
      <button
        onClick={onClick}
        disabled={stitching}
        title="Download with crossfade + intro"
        className={cn(
          "inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/[0.08] hover:border-white/30 text-white/65 hover:text-white transition-colors disabled:opacity-50",
          className,
        )}
        aria-label={label}
      >
        {stitching
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Download className="w-3.5 h-3.5" />}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={stitching}
      className={cn(
        "group relative inline-flex items-center gap-2 h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-foreground transition-colors disabled:opacity-50",
        className,
      )}
      style={{
        background:
          "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
        boxShadow:
          "0 0 20px hsla(215,100%,60%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)",
      }}
    >
      {stitching ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[hsl(215,100%,75%)]" />
          Stitching…
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5 text-[hsl(215,100%,75%)] drop-shadow-[0_0_8px_hsla(215,100%,60%,0.6)]" />
          {label}
        </>
      )}
    </button>
  );
}

export default StitchDownloadButton;
