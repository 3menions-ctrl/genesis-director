/**
 * MediaSidebar — Premium CapCut-style media browser
 * Glassmorphic panels, refined thumbnails, search filter, smooth hover states
 */

import { memo, useState, useMemo } from "react";
import { Film, Loader2, Plus, Search, Clock, Layers } from "lucide-react";
import { EditorClip } from "@/hooks/useEditorClips";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return clips.filter(c => c.videoUrl);
    const q = search.toLowerCase();
    return clips.filter(c => c.videoUrl && (
      c.projectTitle?.toLowerCase().includes(q) ||
      `shot ${c.shotIndex + 1}`.includes(q)
    ));
  }, [clips, search]);

  const totalDuration = useMemo(() =>
    clips.reduce((sum, c) => sum + (c.durationSeconds || 0), 0),
    [clips]
  );

  return (
    <div
      className="w-56 shrink-0 flex flex-col border-r overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, hsl(240 20% 7%) 0%, hsl(240 25% 5%) 100%)',
        borderColor: 'hsla(263, 70%, 58%, 0.06)',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 px-3 py-3 border-b"
        style={{ borderColor: 'hsla(263, 70%, 58%, 0.06)' }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'hsla(263, 70%, 58%, 0.12)' }}>
              <Layers className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[11px] font-bold text-foreground/90 tracking-wide uppercase">Media</span>
          </div>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/50" />}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clips…"
            className="w-full h-7 pl-7 pr-2 rounded-lg text-[11px] bg-white/[0.03] border border-white/[0.06] text-foreground/80 placeholder:text-muted-foreground/25 outline-none focus:border-primary/30 focus:bg-white/[0.05] transition-all"
          />
        </div>

        {/* Stats bar */}
        {clips.length > 0 && (
          <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground/35">
            <span className="flex items-center gap-1">
              <Film className="w-2.5 h-2.5" />
              {clips.filter(c => c.videoUrl).length} clips
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {totalDuration.toFixed(0)}s total
            </span>
          </div>
        )}
      </div>

      {/* Clips list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {filtered.length === 0 && !loading && (
            <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground/20">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'hsla(263, 70%, 58%, 0.06)' }}>
                <Film className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground/30">No clips found</p>
                <p className="text-[10px] text-muted-foreground/20">
                  {search ? "Try a different search" : "Import projects to load clips"}
                </p>
              </div>
            </div>
          )}

          {filtered.map((clip) => (
            <button
              key={clip.id}
              onClick={() => onAddClip(clip)}
              className={cn(
                "w-full flex items-start gap-2.5 p-2 rounded-xl transition-all duration-200 group text-left",
                "border border-transparent",
                "hover:bg-white/[0.04] hover:border-primary/15",
                "active:scale-[0.98]"
              )}
            >
              {/* Thumbnail */}
              <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 relative" style={{ background: 'hsl(240 25% 8%)' }}>
                {clip.thumbnailUrl ? (
                  <img
                    src={clip.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-4 h-4 text-muted-foreground/20" />
                  </div>
                )}
                {/* Duration badge */}
                {clip.durationSeconds && (
                  <div className="absolute bottom-0.5 right-0.5 px-1 py-px rounded text-[7px] font-mono font-bold bg-black/70 text-white/80 backdrop-blur-sm">
                    {clip.durationSeconds.toFixed(1)}s
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-primary/10 backdrop-blur-[1px]">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 py-0.5">
                <p className="text-[11px] font-semibold text-foreground/75 truncate leading-tight group-hover:text-foreground/90 transition-colors">
                  Shot {clip.shotIndex + 1}
                </p>
                <p className="text-[9px] text-muted-foreground/35 truncate mt-0.5">
                  {clip.projectTitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});
