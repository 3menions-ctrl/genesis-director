/**
 * MediaSidebar — Premium collapsible media browser
 * Apple-clean aesthetic with blue accent system
 */

import { memo, useState, useMemo } from "react";
import { Film, Loader2, Plus, Search, Layers, PanelLeftClose, PanelLeftOpen, Upload, Sparkles, Grid2x2, List as ListIcon } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const base = clips.filter(c => c.videoUrl);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(c => (
      c.projectTitle?.toLowerCase().includes(q) ||
      `shot ${c.shotIndex + 1}`.includes(q) ||
      c.prompt?.toLowerCase().includes(q)
    ));
  }, [clips, search]);

  /** Group clips by project, preserve order, sort shots ascending within. */
  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; clips: EditorClip[] }>();
    for (const c of filtered) {
      const g = map.get(c.projectId);
      if (g) g.clips.push(c);
      else map.set(c.projectId, { title: c.projectTitle, clips: [c] });
    }
    for (const g of map.values()) {
      g.clips.sort((a, b) => a.shotIndex - b.shotIndex);
    }
    return Array.from(map.entries()).map(([projectId, v]) => ({ projectId, ...v }));
  }, [filtered]);

  const totalDuration = useMemo(() =>
    clips.reduce((sum, c) => sum + (c.durationSeconds || 0), 0),
    [clips]
  );

  const clipCount = clips.filter(c => c.videoUrl).length;
  const projectCount = grouped.length;

  return (
    <div
      className="shrink-0 flex flex-col overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        width: collapsed ? 52 : 360,
        background:
          'linear-gradient(180deg, hsla(220, 14%, 5%, 0.55) 0%, hsla(220, 14%, 3%, 0.55) 100%)',
        backdropFilter: 'blur(48px) saturate(180%)',
        WebkitBackdropFilter: 'blur(48px) saturate(180%)',
        boxShadow:
          'inset -1px 0 0 hsla(0,0%,100%,0.025), 24px 0 64px -28px hsla(0,0%,0%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.04)',
      }}
    >
      {/* Collapsed state */}
      {collapsed ? (
        <div className="flex flex-col items-center py-3 gap-2 h-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[hsla(0,0%,100%,0.4)] hover:text-foreground hover:bg-[hsla(0,0%,100%,0.05)] transition-all duration-300"
              >
                <PanelLeftOpen className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px]">Expand media panel</TooltipContent>
          </Tooltip>

          <div className="w-6 h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,60%,0.18)] to-transparent" />

          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center relative"
                style={{
                  background: 'hsla(215,100%,60%,0.10)',
                  boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06), 0 0 16px -4px hsla(215,100%,55%,0.35)',
                }}
              >
                <Layers className="w-4 h-4 text-[hsla(215,100%,75%,0.85)]" strokeWidth={1.5} />
                {clipCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-light tabular-nums text-foreground px-0.5"
                    style={{
                      background: 'linear-gradient(180deg, hsl(215,100%,60%), hsl(215,100%,48%))',
                      boxShadow: '0 0 8px hsla(215,100%,55%,0.6), inset 0 1px 0 hsla(0,0%,100%,0.18)',
                    }}
                  >
                    {clipCount}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px]">{clipCount} clips available</TooltipContent>
          </Tooltip>

          {loading && <Loader2 className="w-4 h-4 animate-spin text-[hsla(215,100%,50%,0.5)] mt-1" />}
        </div>
      ) : (
        <>
          {/* Header */}
          <div
            className="shrink-0 px-5 pt-5 pb-4 relative"
            style={{
              background:
                'linear-gradient(180deg, hsla(215,100%,50%,0.045), transparent 80%)',
            }}
          >
            {/* hairline accent — luminous editorial rule */}
            <div className="hairline-luxe absolute bottom-0 inset-x-5" />
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0">
                <div className="text-eyebrow-rule mb-2">Your Archive</div>
                <h2 className="font-display text-[20px] font-semibold tracking-[-0.025em] text-foreground leading-none">
                  Every <span className="display-serif text-foreground/95">clip</span>
                </h2>
                {clipCount > 0 && (
                  <p className="mt-2 text-[10px] font-light text-muted-foreground tabular-nums tracking-[0.16em] uppercase">
                    <span className="text-metric text-[12px]">{clipCount}</span>
                    <span className="mx-1.5 text-foreground/25">·</span>
                    {projectCount} project{projectCount !== 1 ? 's' : ''}
                    <span className="mx-1.5 text-foreground/25">·</span>
                    {totalDuration.toFixed(0)}s
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[hsla(215,100%,60%,0.6)]" />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setCollapsed(true)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all duration-300"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-[10px]">Collapse panel</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Search + view toggle */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" strokeWidth={1.5} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clips, shots, prompts…"
                  className="w-full h-9 pl-9 pr-3 rounded-full text-[11.5px] font-light tracking-tight text-foreground/95 placeholder:text-foreground/30 outline-none transition-all duration-300"
                  style={{
                    background: 'hsla(0,0%,100%,0.025)',
                    backdropFilter: 'blur(24px) saturate(160%)',
                    boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.background = 'hsla(215,100%,60%,0.05)';
                    e.currentTarget.style.boxShadow = 'inset 0 1px 0 hsla(0,0%,100%,0.06), 0 0 0 1px hsla(215,100%,60%,0.30), 0 0 18px -4px hsla(215,100%,60%,0.35)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.background = 'hsla(0,0%,100%,0.025)';
                    e.currentTarget.style.boxShadow = 'inset 0 1px 0 hsla(0,0%,100%,0.04)';
                  }}
                />
              </div>
              <div
                className="flex items-center h-9 rounded-full p-0.5"
                style={{
                  background: 'hsla(0,0%,100%,0.025)',
                  boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04)',
                }}
              >
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                    viewMode === "grid"
                      ? "bg-white/[0.08] text-foreground shadow-[inset_0_1px_0_hsla(0,0%,100%,0.10)]"
                      : "text-muted-foreground hover:text-muted-foreground"
                  )}
                  aria-label="Grid view"
                >
                  <Grid2x2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                    viewMode === "list"
                      ? "bg-white/[0.08] text-foreground shadow-[inset_0_1px_0_hsla(0,0%,100%,0.10)]"
                      : "text-muted-foreground hover:text-muted-foreground"
                  )}
                  aria-label="List view"
                >
                  <ListIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

          {/* Clips gallery */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 pt-4 pb-6 space-y-7">
              {filtered.length === 0 && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-14 gap-4"
                >
                  <div className="relative">
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 15px hsla(215, 100%, 50%, 0)',
                          '0 0 30px hsla(215, 100%, 50%, 0.12)',
                          '0 0 15px hsla(215, 100%, 50%, 0)',
                        ]
                      }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="w-20 h-20 rounded-3xl flex items-center justify-center relative"
                      style={{
                        background: 'linear-gradient(135deg, hsla(215, 100%, 50%, 0.08), hsla(215, 100%, 50%, 0.02))',
                        border: '1px dashed hsla(215, 100%, 50%, 0.15)',
                      }}
                    >
                      {search ? (
                        <Search className="w-8 h-8 text-[hsla(0,0%,100%,0.2)]" />
                      ) : (
                        <motion.div
                          animate={{ y: [0, -3, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Upload className="w-8 h-8 text-[hsla(215,100%,60%,0.3)]" />
                        </motion.div>
                      )}
                    </motion.div>
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[hsla(215,100%,60%,0.35)] absolute -top-1 -right-1" />
                    </motion.div>
                  </div>
                  <div className="text-center space-y-2 px-6 max-w-[260px]">
                    <p className="font-display text-[14px] font-semibold text-muted-foreground tracking-[-0.01em]">
                      {search ? "No matching clips" : "Your archive is empty"}
                    </p>
                    <p className="text-[11px] text-foreground/30 leading-relaxed font-light">
                      {search
                        ? "Try a different search term."
                        : "Render your first project and every clip will appear here automatically."}
                    </p>
                  </div>
                </motion.div>
              )}

              {loading && filtered.length === 0 && (
                <div className="flex flex-col items-center py-14 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[hsla(215,100%,60%,0.45)]" />
                  <p className="text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground font-light">Loading archive…</p>
                </div>
              )}

              {/* Grouped per-project sections */}
              {grouped.map((group, gi) => (
                <section key={group.projectId} className="space-y-2.5">
                  {/* Section header — editorial chapter marker */}
                  <div className="flex items-baseline justify-between gap-3 px-1">
                    <div className="min-w-0 flex items-baseline gap-2">
                      <span className="font-display text-[12.5px] font-semibold text-foreground/90 tracking-[-0.01em] truncate">
                        {group.title}
                      </span>
                      <span className="text-[9px] uppercase tracking-[0.24em] text-foreground/30 font-light shrink-0">
                        {group.clips.length} {group.clips.length === 1 ? 'clip' : 'clips'}
                      </span>
                    </div>
                  </div>
                  <div className="hairline-luxe opacity-60" />

                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <AnimatePresence>
                        {group.clips.map((clip, i) => (
                          <ClipGridCard
                            key={clip.id}
                            clip={clip}
                            delay={Math.min((gi * 0.04) + (i * 0.02), 0.4)}
                            isHovered={hoveredId === clip.id}
                            onHoverStart={() => setHoveredId(clip.id)}
                            onHoverEnd={() => setHoveredId(null)}
                            onAdd={() => onAddClip(clip)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <AnimatePresence>
                        {group.clips.map((clip, i) => (
                          <ClipListRow
                            key={clip.id}
                            clip={clip}
                            delay={Math.min((gi * 0.04) + (i * 0.015), 0.3)}
                            onAdd={() => onAddClip(clip)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
});

/* ──────────────────────────────────────────────────────────
   GRID CARD — Premium 16:9 cinematic tile with hover scrub
   ────────────────────────────────────────────────────────── */
const ClipGridCard = memo(function ClipGridCard({
  clip,
  delay,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onAdd,
}: {
  clip: EditorClip;
  delay: number;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onAdd: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={onAdd}
      className={cn(
        "group relative w-full aspect-video rounded-xl overflow-hidden text-left",
        "transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        "active:scale-[0.985]",
        "bg-[hsl(220,14%,5%)]"
      )}
      style={{
        boxShadow: isHovered
          ? 'inset 0 0 0 1px hsla(215,100%,60%,0.45), 0 18px 42px -14px hsla(215,100%,55%,0.55), 0 0 0 1px hsla(0,0%,100%,0.02)'
          : 'inset 0 0 0 1px hsla(0,0%,100%,0.05), 0 6px 16px -8px hsla(0,0%,0%,0.5)',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Thumbnail or video preview */}
      {clip.thumbnailUrl ? (
        <img
          src={clip.thumbnailUrl}
          alt=""
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out",
            isHovered ? "scale-[1.08] opacity-0" : "scale-100 opacity-100"
          )}
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="w-6 h-6 text-foreground/15" strokeWidth={1.5} />
        </div>
      )}
      {isHovered && (
        <video
          src={clip.videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />
      )}

      {/* Cinematic top vignette + bottom shade */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/65 via-transparent to-white/[0.04]" />
      {/* Top platinum hairline */}
      <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* Shot index — top-left, editorial */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span
          className="px-1.5 h-[18px] inline-flex items-center rounded-full text-[9px] font-display font-semibold tabular-nums text-foreground tracking-[-0.01em]"
          style={{
            background: 'linear-gradient(180deg, hsla(0,0%,100%,0.18), hsla(0,0%,100%,0.06))',
            backdropFilter: 'blur(12px)',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.18), 0 2px 6px hsla(0,0%,0%,0.45)',
          }}
        >
          {String(clip.shotIndex + 1).padStart(2, '0')}
        </span>
      </div>

      {/* Duration badge — bottom-right */}
      {clip.durationSeconds && (
        <div
          className="absolute bottom-2 right-2 px-1.5 h-[18px] inline-flex items-center rounded-full text-[9px] font-mono font-light tabular-nums text-foreground/95"
          style={{
            background: 'hsla(0,0%,0%,0.55)',
            backdropFilter: 'blur(12px)',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.10)',
          }}
        >
          {clip.durationSeconds.toFixed(1)}s
        </div>
      )}

      {/* Add CTA — appears on hover, bottom-left */}
      <div
        className={cn(
          "absolute bottom-2 left-2 flex items-center gap-1.5 transition-all duration-500",
          isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        )}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(180deg, hsl(215,100%,62%), hsl(215,100%,45%))',
            boxShadow:
              'inset 0 1px 0 hsla(0,0%,100%,0.28), 0 6px 16px -2px hsla(215,100%,55%,0.7), 0 0 0 1px hsla(0,0%,100%,0.06)',
          }}
        >
          <Plus className="w-3.5 h-3.5 text-foreground" strokeWidth={2} />
        </div>
        <span className="text-[10px] font-display font-semibold text-foreground tracking-[-0.005em] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
          Add
        </span>
      </div>
    </motion.button>
  );
});

/* ──────────────────────────────────────────────────────────
   LIST ROW — Compact alternate view
   ────────────────────────────────────────────────────────── */
const ClipListRow = memo(function ClipListRow({
  clip,
  delay,
  onAdd,
}: {
  clip: EditorClip;
  delay: number;
  onAdd: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onAdd}
      className={cn(
        "w-full flex items-center gap-2.5 p-1.5 rounded-xl transition-all duration-300 group text-left relative",
        "hover:bg-white/[0.035] hover:shadow-[0_12px_32px_-16px_hsla(215,100%,55%,0.5),inset_0_0_0_1px_hsla(215,100%,60%,0.18)]",
        "active:scale-[0.99]"
      )}
    >
      <div
        className="w-[88px] h-[50px] rounded-lg overflow-hidden shrink-0 relative bg-[hsl(220,14%,6%)]"
        style={{ boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05), 0 4px 14px -4px hsla(0,0%,0%,0.6)' }}
      >
        {clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-4 h-4 text-foreground/20" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-white/[0.04] pointer-events-none" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-display font-semibold text-foreground/95 tracking-[-0.005em] truncate leading-tight">
          Shot {String(clip.shotIndex + 1).padStart(2, '0')}
        </p>
        <p className="text-[9.5px] font-light text-muted-foreground truncate mt-1 tabular-nums">
          {clip.durationSeconds ? `${clip.durationSeconds.toFixed(1)}s` : '—'}
        </p>
      </div>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: 'linear-gradient(180deg, hsl(215,100%,62%), hsl(215,100%,45%))',
          boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.22), 0 4px 12px -2px hsla(215,100%,55%,0.55)',
        }}
      >
        <Plus className="w-3.5 h-3.5 text-foreground" strokeWidth={2} />
      </div>
    </motion.button>
  );
});
