/**
 * MediaSidebar — Premium collapsible media browser
 * Rich empty state, drag target hint, glassmorphic panels
 */

import { memo, useState, useMemo } from "react";
import { Film, Loader2, Plus, Search, Clock, Layers, PanelLeftClose, PanelLeftOpen, Upload, Sparkles } from "lucide-react";
import { EditorClip } from "@/hooks/useEditorClips";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [collapsed, setCollapsed] = useState(false);

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

  const clipCount = clips.filter(c => c.videoUrl).length;

  return (
    <div
      className="shrink-0 flex flex-col overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        width: collapsed ? 48 : 240,
        background: 'linear-gradient(180deg, hsl(240 18% 7%) 0%, hsl(240 22% 5%) 100%)',
        borderRight: '1px solid hsla(263, 70%, 58%, 0.06)',
      }}
    >
      {/* Collapsed state */}
      {collapsed ? (
        <div className="flex flex-col items-center py-3 gap-2 h-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-all"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px]">Expand media panel</TooltipContent>
          </Tooltip>

          <div className="w-7 h-px" style={{ background: 'hsla(263, 70%, 58%, 0.08)' }} />

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center relative" style={{ background: 'hsla(263, 70%, 58%, 0.1)' }}>
                <Layers className="w-4 h-4 text-primary/60" />
                {clipCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold bg-primary text-white px-0.5">
                    {clipCount}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px]">{clipCount} clips available</TooltipContent>
          </Tooltip>

          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary/40 mt-1" />}
        </div>
      ) : (
        <>
          {/* Header */}
          <div
            className="shrink-0 px-3 py-3"
            style={{ borderBottom: '1px solid hsla(263, 70%, 58%, 0.06)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, hsla(263, 70%, 58%, 0.15), hsla(263, 70%, 58%, 0.05))' }}
                >
                  <Layers className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <span className="text-[12px] font-bold text-foreground/90 tracking-wide block leading-none">Media</span>
                  {clips.length > 0 && (
                    <span className="text-[9px] text-muted-foreground/35 mt-0.5 block">
                      {clipCount} clips · {totalDuration.toFixed(0)}s
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/50" />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setCollapsed(true)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-foreground hover:bg-white/[0.06] transition-all"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-[10px]">Collapse panel</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clips…"
                className="w-full h-8 pl-8 pr-3 rounded-lg text-[11px] bg-white/[0.04] border border-white/[0.06] text-foreground/80 placeholder:text-muted-foreground/25 outline-none focus:border-primary/30 focus:bg-white/[0.06] transition-all"
              />
            </div>
          </div>

          {/* Clips list */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-1">
              {filtered.length === 0 && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-10 gap-4 text-muted-foreground/20"
                >
                  {/* Animated empty state */}
                  <div className="relative">
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 15px hsla(263, 70%, 58%, 0)',
                          '0 0 30px hsla(263, 70%, 58%, 0.12)',
                          '0 0 15px hsla(263, 70%, 58%, 0)',
                        ]
                      }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
                      style={{
                        background: 'linear-gradient(135deg, hsla(263, 70%, 58%, 0.08), hsla(263, 70%, 58%, 0.02))',
                        border: '1px dashed hsla(263, 70%, 58%, 0.15)',
                      }}
                    >
                      {search ? (
                        <Search className="w-7 h-7 text-muted-foreground/20" />
                      ) : (
                        <motion.div
                          animate={{ y: [0, -3, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Upload className="w-7 h-7 text-primary/25" />
                        </motion.div>
                      )}
                    </motion.div>
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Sparkles className="w-3 h-3 text-primary/30 absolute -top-1 -right-1" />
                    </motion.div>
                  </div>
                  <div className="text-center space-y-1.5 px-4">
                    <p className="text-[12px] font-semibold text-muted-foreground/40">
                      {search ? "No matching clips" : "No clips yet"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/25 leading-relaxed">
                      {search
                        ? "Try a different search term"
                        : "Import projects from the toolbar to load your video clips here"
                      }
                    </p>
                  </div>
                </motion.div>
              )}

              {loading && filtered.length === 0 && (
                <div className="flex flex-col items-center py-10 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-primary/30" />
                  <p className="text-[11px] text-muted-foreground/30">Loading clips…</p>
                </div>
              )}

              <AnimatePresence>
                {filtered.map((clip, i) => (
                  <motion.button
                    key={clip.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    onClick={() => onAddClip(clip)}
                    className={cn(
                      "w-full flex items-start gap-2.5 p-2 rounded-xl transition-all duration-200 group text-left",
                      "border border-transparent",
                      "hover:bg-white/[0.05] hover:border-primary/15",
                      "active:scale-[0.98]"
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="w-[72px] h-[44px] rounded-lg overflow-hidden shrink-0 relative" style={{ background: 'hsl(240 25% 8%)' }}>
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
                        <div className="absolute bottom-0.5 right-0.5 px-1 py-px rounded text-[8px] font-mono font-bold bg-black/75 text-white/80 backdrop-blur-sm">
                          {clip.durationSeconds.toFixed(1)}s
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-primary/15 backdrop-blur-[2px]">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-primary/80 shadow-lg">
                          <Plus className="w-3.5 h-3.5 text-white" />
                        </div>
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
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
});
