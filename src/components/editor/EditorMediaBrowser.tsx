import { useState, useEffect, useMemo, useRef } from "react";
import { Film, Search, FolderOpen, Plus, Loader2, Layers, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/**
 * Extract a clean, human-readable label from the raw AI generation prompt.
 *
 * The prompt is a multi-hundred-character string full of technical injection blocks
 * like [CRITICAL: SAME EXACT PERSON...], [═══ PRIMARY SUBJECT ═══], etc.
 * We strip all bracketed blocks, then take the first meaningful sentence.
 */
function extractClipLabel(rawPrompt: string | null | undefined, shotIndex: number): string {
  if (!rawPrompt) return `Shot ${shotIndex + 1}`;

  // Remove bracketed injection blocks (single-line and multi-line markers like [═══...═══])
  let clean = rawPrompt
    .replace(/\[═+[^\]]*═+\]/g, '')          // [═══ SECTION HEADER ═══]
    .replace(/\[[^\]]{0,300}\]/g, '')          // any [block up to 300 chars]
    .replace(/cinematic lighting.*$/i, '')     // strip boilerplate suffix
    .replace(/,\s*8K resolution.*/i, '')       // strip tech suffix
    .replace(/ARRI Alexa.*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return `Shot ${shotIndex + 1}`;

  // Take first sentence or first 60 chars, whichever is shorter
  const sentence = clean.split(/[.!?]/)[0].trim();
  if (sentence.length > 2) {
    return sentence.length > 60 ? sentence.slice(0, 57) + '…' : sentence;
  }

  return clean.slice(0, 60) || `Shot ${shotIndex + 1}`;
}


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

const VideoThumbnail = ({ url }: { url: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.preload = "metadata";
    v.currentTime = 0.5;
    const onLoaded = () => setLoaded(true);
    v.addEventListener("loadeddata", onLoaded);
    return () => v.removeEventListener("loadeddata", onLoaded);
  }, [url]);

  return (
    <div className="w-16 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] shrink-0 overflow-hidden relative group/thumb">
      <video
        ref={videoRef}
        src={url}
        className={cn("w-full h-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
        muted
        playsInline
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="h-3 w-3 text-white/10" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded-xl">
        <Play className="h-3.5 w-3.5 text-white" fill="white" />
      </div>
    </div>
  );
};

export const EditorMediaBrowser = ({ onAddClip }: EditorMediaBrowserProps) => {
  const { user } = useAuth();
  const [clips, setClips] = useState<MediaClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // No .limit() here — fetch all clips. The previous 200-row cap silently dropped clips.
      // Supabase default is 1000; for very large libraries we paginate below.
      const { data, error } = await supabase
        .from("video_clips")
        .select(`id, prompt, video_url, duration_seconds, shot_index, project_id, movie_projects!inner(title)`)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setClips(data.map((c: any) => ({
          id: c.id,
          prompt: extractClipLabel(c.prompt, c.shot_index),
          video_url: c.video_url,
          duration_seconds: c.duration_seconds || 6,
          shot_index: c.shot_index,
          project_id: c.project_id,
          project_title: c.movie_projects?.title || "Untitled",
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
    <div className="h-full flex flex-col bg-[hsl(0,0%,5%)]/80 backdrop-blur-xl">
      {/* Header */}
      <div className="h-10 flex items-center px-4 border-b border-white/[0.06] shrink-0">
        <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center mr-2.5">
          <Layers className="h-3 w-3 text-primary" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">Media</span>
        <span className="ml-auto text-[9px] text-white/15 tabular-nums font-mono bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/[0.04]">{clips.length}</span>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-white/[0.04]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clips..."
            className="h-8 pl-8 text-[11px] bg-white/[0.03] border-white/[0.05] text-white/60 placeholder:text-white/15 focus-visible:ring-primary/20 focus-visible:border-primary/20 rounded-xl" />
        </div>
      </div>

      {/* Project filters */}
      <div className="px-3 py-2 border-b border-white/[0.04] flex gap-1.5 overflow-x-auto scrollbar-hide">
        <button className={cn("shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all",
          !selectedProject ? "bg-white text-black font-semibold shadow-lg shadow-white/5" : "text-white/25 hover:text-white hover:bg-white/[0.05] border border-white/[0.04]")}
          onClick={() => setSelectedProject(null)}>All</button>
        {projects.map((p) => (
          <button key={p.id} className={cn("shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all truncate max-w-[120px]",
            selectedProject === p.id ? "bg-white text-black font-semibold shadow-lg shadow-white/5" : "text-white/25 hover:text-white hover:bg-white/[0.05] border border-white/[0.04]")}
            onClick={() => setSelectedProject(p.id)}>
            {p.title} <span className="opacity-40">({p.count})</span>
          </button>
        ))}
      </div>

      {/* Clips list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
            <div className="w-14 h-14 rounded-2xl border border-white/[0.06] flex items-center justify-center bg-white/[0.02] relative">
              <FolderOpen className="h-6 w-6 text-white/10" />
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[12px] text-white/30 font-medium">
                {search ? "No clips match your search" : "No completed clips yet"}
              </p>
              <p className="text-[10px] text-white/15 mt-1">Create videos to see them here</p>
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredClips.map((clip) => (
              <div key={clip.id} className="group flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-white/[0.04] cursor-pointer transition-all duration-200 border border-transparent hover:border-white/[0.06]"
                onClick={() => onAddClip(clip)}>
                <VideoThumbnail url={clip.video_url} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/60 truncate leading-tight font-medium">{clip.prompt}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-white/20 truncate">{clip.project_title}</span>
                    <span className="text-[8px] text-white/10 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">{formatDuration(clip.duration_seconds)}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 bg-white text-black hover:bg-white/90 transition-all shrink-0 rounded-lg shadow-lg shadow-white/5 hover:scale-110">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
