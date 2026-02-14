import { useState, useEffect, useMemo } from "react";
import { Film, Search, FolderOpen, Plus, Loader2, Layers } from "lucide-react";
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
        .select(`id, prompt, video_url, duration_seconds, shot_index, project_id, movie_projects!inner(title)`)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error && data) {
        setClips(data.map((c: any) => ({
          id: c.id, prompt: c.prompt || `Shot ${c.shot_index + 1}`, video_url: c.video_url,
          duration_seconds: c.duration_seconds || 6, shot_index: c.shot_index,
          project_id: c.project_id, project_title: c.movie_projects?.title || "Untitled",
        })));
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const projects = useMemo(() => {
    const map = new Map<string, { title: string; count: number }>();
    clips.forEach((c) => {
      const existing = map.get(c.project_id);
      if (existing) existing.count++;
      else map.set(c.project_id, { title: c.project_title, count: 1 });
    });
    return Array.from(map.entries()).map(([id, info]) => ({ id, ...info }));
  }, [clips]);

  const filteredClips = useMemo(() => {
    let result = clips;
    if (selectedProject) result = result.filter((c) => c.project_id === selectedProject);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.prompt.toLowerCase().includes(q) || c.project_title.toLowerCase().includes(q));
    }
    return result;
  }, [clips, selectedProject, search]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
  };

  return (
    <div className="h-full flex flex-col bg-[hsl(260,15%,7%)] border-r border-white/[0.06]">
      <div className="h-9 flex items-center px-3 border-b border-white/[0.06] shrink-0 bg-[hsl(260,15%,8%)] relative">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        <Layers className="h-3 w-3 text-white/40 mr-2" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Media</span>
        <span className="ml-auto text-[9px] text-white/15 tabular-nums font-mono">{clips.length}</span>
      </div>

      <div className="px-2 py-2 border-b border-white/[0.04]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clips..."
            className="h-7 pl-7 text-[10px] bg-white/[0.03] border-white/[0.04] text-white/60 placeholder:text-white/15 focus-visible:ring-white/20 focus-visible:border-white/20 rounded-md" />
        </div>
      </div>

      <div className="px-2 py-1.5 border-b border-white/[0.04] flex gap-1 overflow-x-auto scrollbar-hide">
        <button className={cn("shrink-0 px-2.5 py-1 rounded-md text-[9px] font-medium transition-all",
          !selectedProject ? "bg-white text-black font-semibold" : "text-white/25 hover:text-white hover:bg-white/[0.06]")}
          onClick={() => setSelectedProject(null)}>All</button>
        {projects.map((p) => (
          <button key={p.id} className={cn("shrink-0 px-2.5 py-1 rounded-md text-[9px] font-medium transition-all truncate max-w-[110px]",
            selectedProject === p.id ? "bg-white text-black font-semibold" : "text-white/25 hover:text-white hover:bg-white/[0.06]")}
            onClick={() => setSelectedProject(p.id)}>
            {p.title} <span className="opacity-50">({p.count})</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-4 w-4 animate-spin text-white/30" />
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <div className="w-10 h-10 rounded-lg border border-white/[0.06] flex items-center justify-center bg-white/[0.02]">
              <FolderOpen className="h-5 w-5 text-white/10" />
            </div>
            <span className="text-[11px] text-white/20 text-center leading-relaxed">
              {search ? "No clips match your search" : "No completed clips yet"}
            </span>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {filteredClips.map((clip) => (
              <div key={clip.id} className="group flex items-center gap-2 px-2 py-2 rounded-md hover:bg-white/[0.04] cursor-pointer transition-all border border-transparent hover:border-white/[0.06]"
                onClick={() => onAddClip(clip)}>
                <div className="w-14 h-8 rounded bg-black/30 border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden relative">
                  <Film className="h-3 w-3 text-white/15" />
                  <div className="absolute bottom-0 right-0 bg-black/60 text-[7px] text-white/50 px-1 py-px rounded-tl font-mono">
                    {formatDuration(clip.duration_seconds)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-white/60 truncate leading-tight font-medium">{clip.prompt}</p>
                  <span className="text-[8px] text-white/20 truncate block mt-0.5">{clip.project_title}</span>
                </div>
                <Button variant="ghost" size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 text-white hover:text-white hover:bg-white/[0.1] transition-all shrink-0 rounded">
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