import { useState, useEffect, useMemo } from "react";
import { Film, Search, FolderOpen, Plus, Loader2, Clock, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface MediaClip {
  id: string;
  prompt: string;
  video_url: string;
  duration_seconds: number;
  shot_index: number;
  project_id: string;
  project_title: string;
}

interface EditorMediaBrowserProps {
  onAddClip: (clip: MediaClip) => void;
}

export const EditorMediaBrowser = ({ onAddClip }: EditorMediaBrowserProps) => {
  const { user } = useAuth();
  const [clips, setClips] = useState<MediaClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("video_clips")
        .select(`
          id, prompt, video_url, duration_seconds, shot_index, project_id,
          movie_projects!inner(title)
        `)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && data) {
        setClips(
          data.map((c: any) => ({
            id: c.id,
            prompt: c.prompt || `Shot ${c.shot_index + 1}`,
            video_url: c.video_url,
            duration_seconds: c.duration_seconds || 6,
            shot_index: c.shot_index,
            project_id: c.project_id,
            project_title: c.movie_projects?.title || "Untitled",
          }))
        );
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const projects = useMemo(() => {
    const map = new Map<string, { title: string; count: number }>();
    clips.forEach((c) => {
      const existing = map.get(c.project_id);
      if (existing) {
        existing.count++;
      } else {
        map.set(c.project_id, { title: c.project_title, count: 1 });
      }
    });
    return Array.from(map.entries()).map(([id, info]) => ({ id, ...info }));
  }, [clips]);

  const filteredClips = useMemo(() => {
    let result = clips;
    if (selectedProject) {
      result = result.filter((c) => c.project_id === selectedProject);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.prompt.toLowerCase().includes(q) ||
          c.project_title.toLowerCase().includes(q)
      );
    }
    return result;
  }, [clips, selectedProject, search]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
  };

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border">
      {/* Header */}
      <div className="h-9 flex items-center px-3 border-b border-border shrink-0 bg-surface-2">
        <Film className="h-3 w-3 text-muted-foreground/50 mr-2" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Media
        </span>
        <span className="ml-auto text-[9px] text-muted-foreground/40 tabular-nums">{clips.length} clips</span>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clips..."
            className="h-7 pl-7 text-[10px] bg-background border-border text-foreground/70 placeholder:text-muted-foreground/40 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      {/* Project filter tabs */}
      <div className="px-2 py-1.5 border-b border-border/50 flex gap-1 overflow-x-auto scrollbar-hide">
        <button
          className={cn(
            "shrink-0 px-2 py-0.5 rounded text-[9px] font-medium transition-colors",
            !selectedProject
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-surface-2"
          )}
          onClick={() => setSelectedProject(null)}
        >
          All
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            className={cn(
              "shrink-0 px-2 py-0.5 rounded text-[9px] font-medium transition-colors truncate max-w-[120px]",
              selectedProject === p.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-surface-2"
            )}
            onClick={() => setSelectedProject(p.id)}
          >
            {p.title} ({p.count})
          </button>
        ))}
      </div>

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
            <FolderOpen className="h-6 w-6 text-muted-foreground/20" />
            <span className="text-[11px] text-muted-foreground/40 text-center">
              {search ? "No clips match your search" : "No completed clips yet"}
            </span>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {filteredClips.map((clip) => (
              <div
                key={clip.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-2 cursor-pointer transition-colors"
                onClick={() => onAddClip(clip)}
              >
                {/* Thumbnail placeholder */}
                <div className="w-12 h-7 rounded bg-surface-2 border border-border flex items-center justify-center shrink-0 overflow-hidden">
                  <Film className="h-3 w-3 text-muted-foreground/30" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-foreground/70 truncate leading-tight">
                    {clip.prompt}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[8px] text-muted-foreground/50 truncate">{clip.project_title}</span>
                    <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground/40">
                      <Clock className="h-2 w-2" />
                      {formatDuration(clip.duration_seconds)}
                    </span>
                  </div>
                </div>

                {/* Add button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 text-primary hover:bg-primary/10 transition-opacity shrink-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
