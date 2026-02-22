import { useState, useMemo, useRef, useCallback } from "react";
import { Music, Play, Pause, Clock, Search, Heart, Sparkles, Wand2, Volume2, Loader2, Square, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

const SCENE_PRESETS = [
  { id: "epic-battle", label: "⚔️ Epic Battle", prompt: "Epic cinematic battle music with thunderous drums, brass fanfares, and intense orchestral swells" },
  { id: "romantic-sunset", label: "🌅 Romantic Sunset", prompt: "Soft romantic piano melody with gentle strings and warm atmospheric pads" },
  { id: "horror-tension", label: "👻 Horror Tension", prompt: "Dark suspenseful horror music with eerie strings, dissonant chords, and creeping bass" },
  { id: "sci-fi-wonder", label: "🚀 Sci-Fi Wonder", prompt: "Ethereal sci-fi soundtrack with synthesizers, cosmic pads, and futuristic sound design" },
  { id: "comedy-fun", label: "😂 Comedy Fun", prompt: "Lighthearted comedic music with playful pizzicato, bouncy rhythms, and cheerful melodies" },
  { id: "chase-action", label: "🏃 Chase Scene", prompt: "Fast-paced action chase music with driving percussion, urgent strings, and adrenaline-pumping beats" },
  { id: "mystery-noir", label: "🔍 Mystery Noir", prompt: "Dark jazz noir music with muted trumpet, walking bass, and smoky atmosphere" },
  { id: "fantasy-magic", label: "✨ Fantasy Magic", prompt: "Enchanting fantasy music with harp, celesta, magical chimes, and sweeping strings" },
  { id: "documentary", label: "🎥 Documentary", prompt: "Thoughtful documentary underscore with gentle piano, subtle strings, and reflective mood" },
  { id: "celebration", label: "🎉 Celebration", prompt: "Triumphant celebratory music with uplifting brass, energetic percussion, and joyful melody" },
];

const SFX_PRESETS = [
  { id: "whoosh", label: "💨 Whoosh", prompt: "Fast cinematic whoosh transition sound effect" },
  { id: "explosion", label: "💥 Explosion", prompt: "Deep cinematic explosion with debris and rumble" },
  { id: "magic-spell", label: "✨ Magic Spell", prompt: "Magical spell casting sound with sparkles and shimmer" },
  { id: "door-creak", label: "🚪 Door Creak", prompt: "Creaky old wooden door opening slowly" },
  { id: "thunder", label: "⛈️ Thunder", prompt: "Deep rolling thunder with rain" },
  { id: "footsteps", label: "👣 Footsteps", prompt: "Footsteps walking on gravel path" },
  { id: "sword-clash", label: "⚔️ Sword Clash", prompt: "Metal sword clashing in combat" },
  { id: "crowd-cheer", label: "👏 Crowd Cheer", prompt: "Large crowd cheering and applauding" },
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

type TabMode = "library" | "scene-magic" | "sfx";

export const MusicLibraryPanel = ({ onAddMusic }: MusicLibraryPanelProps) => {
  const [tab, setTab] = useState<TabMode>("library");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Scene Magic state
  const [magicPrompt, setMagicPrompt] = useState("");
  const [magicDuration, setMagicDuration] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // SFX state
  const [sfxPrompt, setSfxPrompt] = useState("");
  const [sfxDuration, setSfxDuration] = useState(5);
  const [isGeneratingSfx, setIsGeneratingSfx] = useState(false);
  const [sfxPreviewAudio, setSfxPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isSfxPlaying, setIsSfxPlaying] = useState(false);
  const [generatedSfxUrl, setGeneratedSfxUrl] = useState<string | null>(null);

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

  const generateMusic = useCallback(async (prompt: string, duration: number) => {
    if (!prompt.trim()) {
      toast.error("Enter a music description");
      return;
    }
    setIsGenerating(true);
    setGeneratedUrl(null);
    if (previewAudio) { previewAudio.pause(); setPreviewAudio(null); setIsPlaying(false); }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ prompt, duration }),
        }
      );

      if (!response.ok) throw new Error(`Generation failed: ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setGeneratedUrl(url);
      toast.success("Music generated! Preview and add to timeline.");
    } catch (err) {
      console.error("[SceneMagic] Error:", err);
      toast.error("Failed to generate music. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [previewAudio]);

  const generateSfx = useCallback(async (prompt: string, duration: number) => {
    if (!prompt.trim()) {
      toast.error("Enter an SFX description");
      return;
    }
    setIsGeneratingSfx(true);
    setGeneratedSfxUrl(null);
    if (sfxPreviewAudio) { sfxPreviewAudio.pause(); setSfxPreviewAudio(null); setIsSfxPlaying(false); }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ prompt, duration }),
        }
      );

      if (!response.ok) throw new Error(`SFX generation failed: ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setGeneratedSfxUrl(url);
      toast.success("Sound effect generated!");
    } catch (err) {
      console.error("[SFX] Error:", err);
      toast.error("Failed to generate SFX. Try again.");
    } finally {
      setIsGeneratingSfx(false);
    }
  }, [sfxPreviewAudio]);

  const togglePreview = useCallback((url: string, type: "music" | "sfx") => {
    if (type === "music") {
      if (previewAudio && isPlaying) {
        previewAudio.pause();
        setIsPlaying(false);
        return;
      }
      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setPreviewAudio(audio);
      setIsPlaying(true);
    } else {
      if (sfxPreviewAudio && isSfxPlaying) {
        sfxPreviewAudio.pause();
        setIsSfxPlaying(false);
        return;
      }
      const audio = new Audio(url);
      audio.onended = () => setIsSfxPlaying(false);
      audio.play();
      setSfxPreviewAudio(audio);
      setIsSfxPlaying(true);
    }
  }, [previewAudio, isPlaying, sfxPreviewAudio, isSfxPlaying]);

  const addGeneratedToTimeline = useCallback((url: string, label: string, duration: number) => {
    onAddMusic({
      id: `ai-${Date.now()}`,
      title: label,
      artist: "AI Generated",
      duration,
      category: "cinematic",
      mood: "AI Generated",
      bpm: 120,
      previewUrl: url,
    });
    toast.success(`"${label}" added to timeline`);
  }, [onAddMusic]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Music className="h-3 w-3 text-emerald-400" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Audio Studio</span>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-0.5 bg-white/[0.03] rounded-lg border border-white/[0.05]">
        {([
          { id: "library" as TabMode, label: "Library", icon: Music },
          { id: "scene-magic" as TabMode, label: "Scene Magic", icon: Sparkles },
          { id: "sfx" as TabMode, label: "SFX", icon: Zap },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[9px] font-medium transition-all",
              tab === id
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/30 hover:text-white/50"
            )}
            onClick={() => setTab(id)}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ═══ LIBRARY TAB ═══ */}
      {tab === "library" && (
        <div className="space-y-3">
          <p className="text-[10px] text-white/25 leading-relaxed">
            Royalty-free music tracks. Click to add to your audio track.
          </p>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, mood..."
              className="h-7 pl-7 text-[10px] bg-white/[0.03] border-white/[0.05] text-white/60 placeholder:text-white/15 focus-visible:ring-primary/20 rounded-lg"
            />
          </div>

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
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-all",
                    categoryColors[track.category] || "text-white/30 bg-white/[0.04] border-white/[0.06]"
                  )}>
                    <Play className="h-3 w-3 ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white/70 font-medium truncate">{track.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] text-white/25 truncate">{track.mood}</span>
                      <span className="text-[7px] text-white/15 font-mono">{track.bpm} BPM</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Clock className="h-2.5 w-2.5 text-white/15" />
                    <span className="text-[8px] text-white/20 font-mono">{formatDuration(track.duration)}</span>
                  </div>
                  <span
                    role="button"
                    className={cn(
                      "p-1 rounded-md transition-all cursor-pointer",
                      favorites.has(track.id) ? "text-red-400" : "text-white/10 hover:text-white/30"
                    )}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(track.id); }}
                  >
                    <Heart className="h-3 w-3" fill={favorites.has(track.id) ? "currentColor" : "none"} />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══ SCENE MAGIC TAB ═══ */}
      {tab === "scene-magic" && (
        <div className="space-y-3">
          <p className="text-[10px] text-white/25 leading-relaxed">
            AI-powered music generation. Describe a scene or mood and get a custom soundtrack.
          </p>

          {/* Scene presets */}
          <div>
            <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Quick Presets</span>
            <div className="grid grid-cols-2 gap-1 mt-1.5">
              {SCENE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={cn(
                    "px-2 py-1.5 rounded-lg text-[8px] font-medium text-left transition-all border",
                    magicPrompt === preset.prompt
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "text-white/40 bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] hover:text-white/60"
                  )}
                  onClick={() => setMagicPrompt(preset.prompt)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt */}
          <div>
            <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Custom Prompt</span>
            <textarea
              value={magicPrompt}
              onChange={(e) => setMagicPrompt(e.target.value)}
              placeholder="Describe the music you want... e.g. 'Melancholic piano with light rain ambiance and soft strings'"
              className="mt-1.5 w-full h-20 px-3 py-2 text-[10px] bg-white/[0.03] border border-white/[0.05] rounded-lg text-white/60 placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none"
            />
          </div>

          {/* Duration */}
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-white/30">Duration</span>
            <div className="flex gap-1">
              {[15, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  className={cn(
                    "px-2 py-1 rounded-md text-[8px] font-mono transition-all",
                    magicDuration === d
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-white/25 bg-white/[0.03] border border-white/[0.05] hover:text-white/50"
                  )}
                  onClick={() => setMagicDuration(d)}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <Button
            className="w-full h-9 text-[10px] font-semibold gap-2"
            onClick={() => generateMusic(magicPrompt, magicDuration)}
            disabled={isGenerating || !magicPrompt.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating Music...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate Scene Music
              </>
            )}
          </Button>

          {/* Generated result */}
          {generatedUrl && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center gap-2">
                <Wand2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium text-white/70">Generated Music</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-[9px] gap-1"
                  onClick={() => togglePreview(generatedUrl, "music")}
                >
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {isPlaying ? "Pause" : "Preview"}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-7 text-[9px] gap-1"
                  onClick={() => addGeneratedToTimeline(generatedUrl, magicPrompt.substring(0, 30) + "...", magicDuration)}
                >
                  <Music className="h-3 w-3" />
                  Add to Timeline
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SFX TAB ═══ */}
      {tab === "sfx" && (
        <div className="space-y-3">
          <p className="text-[10px] text-white/25 leading-relaxed">
            AI-generated sound effects. Perfect for transitions, impacts, and atmosphere.
          </p>

          {/* SFX presets */}
          <div>
            <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Quick SFX</span>
            <div className="grid grid-cols-2 gap-1 mt-1.5">
              {SFX_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={cn(
                    "px-2 py-1.5 rounded-lg text-[8px] font-medium text-left transition-all border",
                    sfxPrompt === preset.prompt
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "text-white/40 bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] hover:text-white/60"
                  )}
                  onClick={() => setSfxPrompt(preset.prompt)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt */}
          <div>
            <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Custom SFX</span>
            <Input
              value={sfxPrompt}
              onChange={(e) => setSfxPrompt(e.target.value)}
              placeholder="Describe the sound effect..."
              className="mt-1.5 h-7 text-[10px] bg-white/[0.03] border-white/[0.05] text-white/60 placeholder:text-white/15 focus-visible:ring-primary/20 rounded-lg"
            />
          </div>

          {/* Duration */}
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-white/30">Duration</span>
            <div className="flex gap-1">
              {[2, 5, 10, 15].map((d) => (
                <button
                  key={d}
                  className={cn(
                    "px-2 py-1 rounded-md text-[8px] font-mono transition-all",
                    sfxDuration === d
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "text-white/25 bg-white/[0.03] border border-white/[0.05] hover:text-white/50"
                  )}
                  onClick={() => setSfxDuration(d)}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <Button
            className="w-full h-9 text-[10px] font-semibold gap-2 bg-amber-600 hover:bg-amber-700"
            onClick={() => generateSfx(sfxPrompt, sfxDuration)}
            disabled={isGeneratingSfx || !sfxPrompt.trim()}
          >
            {isGeneratingSfx ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating SFX...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Generate Sound Effect
              </>
            )}
          </Button>

          {/* Generated SFX result */}
          {generatedSfxUrl && (
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px] font-medium text-white/70">Generated SFX</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-[9px] gap-1"
                  onClick={() => togglePreview(generatedSfxUrl, "sfx")}
                >
                  {isSfxPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {isSfxPlaying ? "Pause" : "Preview"}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-7 text-[9px] gap-1 bg-amber-600 hover:bg-amber-700"
                  onClick={() => addGeneratedToTimeline(generatedSfxUrl, sfxPrompt.substring(0, 30) + "...", sfxDuration)}
                >
                  <Volume2 className="h-3 w-3" />
                  Add to Timeline
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
