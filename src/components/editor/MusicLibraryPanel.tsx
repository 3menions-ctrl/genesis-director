import { useState, useMemo } from "react";
import { Music, Play, Pause, Clock, Search, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MUSIC_LIBRARY, type MusicTrack } from "./types";

interface MusicLibraryPanelProps {
  onAddMusic: (track: MusicTrack) => void;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "cinematic", label: "Cinematic" },
  { id: "orchestral", label: "Orchestral" },
  { id: "electronic", label: "Electronic" },
  { id: "ambient", label: "Ambient" },
  { id: "hip-hop", label: "Hip-Hop" },
  { id: "pop", label: "Pop" },
  { id: "lo-fi", label: "Lo-Fi" },
  { id: "rock", label: "Rock" },
];

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const categoryColors: Record<string, string> = {
  cinematic: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  orchestral: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  electronic: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  ambient: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "hip-hop": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  pop: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  "lo-fi": "text-violet-400 bg-violet-500/10 border-violet-500/20",
  rock: "text-red-400 bg-red-500/10 border-red-500/20",
};

export const MusicLibraryPanel = ({ onAddMusic }: MusicLibraryPanelProps) => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let tracks = MUSIC_LIBRARY;
    if (category !== "all") tracks = tracks.filter((t) => t.category === category);
    if (search) {
      const q = search.toLowerCase();
      tracks = tracks.filter((t) =>
        t.title.toLowerCase().includes(q) || t.mood.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      );
    }
    return tracks;
  }, [search, category]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Music className="h-3 w-3 text-emerald-400" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Music Library</span>
        <span className="ml-auto text-[8px] text-white/15 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]">
          {MUSIC_LIBRARY.length} tracks
        </span>
      </div>

      <p className="text-[10px] text-white/25 leading-relaxed">
        Royalty-free music tracks. Click to add to your audio track.
      </p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, mood..."
          className="h-7 pl-7 text-[10px] bg-white/[0.03] border-white/[0.05] text-white/60 placeholder:text-white/15 focus-visible:ring-primary/20 rounded-lg"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={cn(
              "px-2 py-1 rounded-md text-[8px] font-medium transition-all",
              category === c.id
                ? "bg-white text-black font-semibold"
                : "text-white/25 hover:text-white hover:bg-white/[0.05] border border-white/[0.04]"
            )}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Tracks */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-hide">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <Music className="h-6 w-6 text-white/10 mx-auto mb-2" />
            <p className="text-[10px] text-white/20">No tracks match your search</p>
          </div>
        ) : (
          filtered.map((track) => (
            <button
              key={track.id}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left group border border-transparent hover:border-white/[0.06]"
              onClick={() => onAddMusic(track)}
            >
              {/* Play icon */}
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-all",
                categoryColors[track.category] || "text-white/30 bg-white/[0.04] border-white/[0.06]"
              )}>
                <Play className="h-3 w-3 ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white/70 font-medium truncate">{track.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] text-white/25 truncate">{track.mood}</span>
                  <span className="text-[7px] text-white/15 font-mono">{track.bpm} BPM</span>
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Clock className="h-2.5 w-2.5 text-white/15" />
                <span className="text-[8px] text-white/20 font-mono">{formatDuration(track.duration)}</span>
              </div>

              {/* Favorite */}
              <button
                className={cn(
                  "p-1 rounded-md transition-all",
                  favorites.has(track.id) ? "text-red-400" : "text-white/10 hover:text-white/30"
                )}
                onClick={(e) => { e.stopPropagation(); toggleFavorite(track.id); }}
              >
                <Heart className="h-3 w-3" fill={favorites.has(track.id) ? "currentColor" : "none"} />
              </button>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
