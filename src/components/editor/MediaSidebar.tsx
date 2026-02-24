/**
 * MediaSidebar — Lists available clips from loaded projects.
 * Users click clips to add them to the timeline.
 */

import { memo } from "react";
import { Film, Loader2, Plus } from "lucide-react";
import { EditorClip } from "@/hooks/useEditorClips";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MediaSidebarProps {
  clips: EditorClip[];
  loading: boolean;
  onAddClip: (clip: EditorClip) => void;
}

export const MediaSidebar = memo(function MediaSidebar({
  clips,
  loading,
  onAddClip,
}: MediaSidebarProps) {
  return (
    <div
      className="w-52 shrink-0 flex flex-col border-r overflow-hidden"
      style={{
        background: 'hsl(240, 25%, 5%)',
        borderColor: 'hsla(263, 84%, 58%, 0.08)',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 h-9 border-b"
        style={{ borderColor: 'hsla(263, 84%, 58%, 0.08)' }}
      >
        <Film className="w-3.5 h-3.5 text-primary/60" />
        <span className="text-xs font-semibold text-foreground/80">Media Library</span>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/40 ml-auto" />}
      </div>

      {/* Clips list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1.5">
          {clips.length === 0 && !loading && (
            <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground/30">
              <Film className="w-6 h-6" />
              <p className="text-[10px] text-center">No clips loaded yet.<br />Use Import to load projects.</p>
            </div>
          )}

          {clips.filter(c => c.videoUrl).map((clip) => (
            <button
              key={clip.id}
              onClick={() => onAddClip(clip)}
              className="w-full flex items-start gap-2 p-1.5 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all group text-left"
            >
              {/* Thumbnail */}
              <div className="w-14 h-9 rounded bg-muted/20 border border-border/10 overflow-hidden shrink-0 flex items-center justify-center">
                {clip.thumbnailUrl ? (
                  <img
                    src={clip.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Film className="w-3.5 h-3.5 text-muted-foreground/30" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 py-0.5">
                <p className="text-[10px] font-medium text-foreground/70 truncate leading-tight">
                  Shot {clip.shotIndex + 1}
                </p>
                <p className="text-[9px] text-muted-foreground/40 truncate mt-0.5">
                  {clip.durationSeconds ? `${clip.durationSeconds.toFixed(1)}s` : "–"} · {clip.projectTitle}
                </p>
              </div>

              {/* Add icon */}
              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                <Plus className="w-3 h-3 text-primary/60" />
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});
