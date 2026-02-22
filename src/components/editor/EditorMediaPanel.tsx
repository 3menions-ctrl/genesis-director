import { useState } from "react";
import { EditorClip } from "@/hooks/useEditorClips";
import { Film, Plus, Search, Loader2, Clock, FolderOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface EditorMediaPanelProps {
  clips: EditorClip[];
  loading: boolean;
  error: string | null;
  onAddToTimeline?: (clip: EditorClip) => void;
}

export function EditorMediaPanel({ clips, loading, error, onAddToTimeline }: EditorMediaPanelProps) {
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Group clips by project
  const projects = [...new Set(clips.map((c) => c.projectId))];
  const projectNames = Object.fromEntries(clips.map((c) => [c.projectId, c.projectTitle]));

  const filtered = clips.filter((c) => {
    const matchesSearch = !search || c.prompt.toLowerCase().includes(search.toLowerCase()) || c.projectTitle.toLowerCase().includes(search.toLowerCase());
    const matchesProject = !selectedProject || c.projectId === selectedProject;
    return matchesSearch && matchesProject;
  });

  return (
    <div className="flex flex-col h-full bg-[#0c0c14] border-r border-white/[0.06]">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-5 h-5 rounded bg-primary/15 flex items-center justify-center">
            <FolderOpen className="w-3 h-3 text-primary" />
          </div>
          <span className="text-[11px] font-semibold text-foreground/70 tracking-wider uppercase font-display">
            My Clips
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground/50 tabular-nums">
            {clips.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Search clips..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-2 text-[11px] rounded-lg bg-white/[0.04] border border-white/[0.06] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 transition-colors"
          />
        </div>

        {/* Project filter chips */}
        {projects.length > 1 && (
          <div className="flex gap-1 mt-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedProject(null)}
              className={cn(
                "shrink-0 px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                !selectedProject
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-white/[0.04] text-muted-foreground/60 border border-transparent hover:bg-white/[0.06]"
              )}
            >
              All
            </button>
            {projects.map((pid) => (
              <button
                key={pid}
                onClick={() => setSelectedProject(pid === selectedProject ? null : pid)}
                className={cn(
                  "shrink-0 px-2 py-0.5 rounded text-[10px] font-medium transition-colors truncate max-w-[100px]",
                  pid === selectedProject
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-white/[0.04] text-muted-foreground/60 border border-transparent hover:bg-white/[0.06]"
                )}
              >
                {projectNames[pid]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
            <p className="text-[10px] text-muted-foreground/40">Loading your clips...</p>
          </div>
        )}

        {error && (
          <div className="text-[10px] text-destructive/70 text-center py-6">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Film className="w-6 h-6 text-muted-foreground/20" />
            <p className="text-[10px] text-muted-foreground/40 text-center">
              {clips.length === 0 ? "No completed clips yet.\nGenerate videos to see them here." : "No clips match your search."}
            </p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {filtered.map((clip, i) => (
            <motion.div
              key={clip.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.02 }}
            >
              <ClipCard clip={clip} onAdd={onAddToTimeline} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ClipCard({ clip, onAdd }: { clip: EditorClip; onAdd?: (clip: EditorClip) => void }) {
  return (
    <div className="group relative rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.05] hover:border-primary/20 transition-all duration-200 cursor-pointer">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-black/40">
        {clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt={`Shot ${clip.shotIndex + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-5 h-5 text-muted-foreground/20" />
          </div>
        )}

        {/* Duration badge */}
        {clip.durationSeconds && (
          <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white/80 font-mono">
            <Clock className="w-2.5 h-2.5" />
            {clip.durationSeconds.toFixed(1)}s
          </div>
        )}

        {/* Add overlay */}
        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <button
            onClick={() => onAdd?.(clip)}
            className="w-8 h-8 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-[10px] font-medium text-foreground/70 truncate">
          Shot {clip.shotIndex + 1} — {clip.projectTitle}
        </p>
        <p className="text-[9px] text-muted-foreground/40 truncate mt-0.5">
          {clip.prompt}
        </p>
      </div>
    </div>
  );
}
