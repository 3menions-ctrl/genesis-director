/**
 * EditorVoicePanel — Unified Sound Lab with 3 modes:
 * 1. Voiceover (TTS via ElevenLabs)
 * 2. Sound Effects (SFX via ElevenLabs)
 * 3. Music Generation (via ElevenLabs)
 * All outputs auto-add to timeline audio tracks.
 */

import { memo, useState, useCallback, useRef } from "react";
import { Mic, Loader2, Play, Pause, Plus, Volume2, Music, Zap, AudioLines } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCustomTimeline, generateClipId, generateTrackId, TimelineClip } from "@/hooks/useCustomTimeline";

type SoundMode = "voiceover" | "sfx" | "music";

// Available voices (ElevenLabs)
const VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "Male", style: "Warm narrator" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "Female", style: "Conversational" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", gender: "Male", style: "Authoritative" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "Female", style: "Expressive" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "Male", style: "Deep & cinematic" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "Female", style: "Soft & gentle" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "Male", style: "Youthful" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", gender: "Female", style: "Clear & articulate" },
];

const SFX_PRESETS = [
  { label: "Explosion", prompt: "Large cinematic explosion with debris", duration: 3 },
  { label: "Gunshot", prompt: "Single gunshot with echo in urban environment", duration: 2 },
  { label: "Thunder", prompt: "Deep rolling thunder with rain", duration: 5 },
  { label: "Footsteps", prompt: "Footsteps on wet pavement at night", duration: 4 },
  { label: "Door Creak", prompt: "Old wooden door creaking open slowly", duration: 3 },
  { label: "Car Engine", prompt: "Sports car engine revving and accelerating", duration: 5 },
  { label: "Wind", prompt: "Strong wind howling through canyon", duration: 8 },
  { label: "Crowd", prompt: "Crowd murmur in large indoor venue", duration: 6 },
];

const MUSIC_PRESETS = [
  { label: "Epic Orchestral", prompt: "Epic orchestral cinematic score, Hans Zimmer style, building tension with brass and strings", duration: 30 },
  { label: "Dark Ambient", prompt: "Dark atmospheric ambient music, suspenseful, minimal, horror film underscore", duration: 30 },
  { label: "Upbeat Pop", prompt: "Upbeat pop background music, positive energy, modern production, catchy melody", duration: 30 },
  { label: "Jazz Lounge", prompt: "Smooth jazz lounge music, saxophone, piano, soft drums, evening atmosphere", duration: 30 },
  { label: "Sci-Fi Synth", prompt: "Futuristic sci-fi synthesizer music, cyberpunk, Blade Runner inspired, atmospheric", duration: 30 },
  { label: "Action Drums", prompt: "Intense action movie drum sequence, fast-paced, tribal percussion, building energy", duration: 15 },
];

function addAudioClipToTimeline(
  state: ReturnType<typeof useCustomTimeline>["state"],
  dispatch: ReturnType<typeof useCustomTimeline>["dispatch"],
  audioUrl: string,
  name: string,
  duration: number,
  trackLabel: string,
) {
  let audioTrack = state.tracks.find(t => t.type === "audio" && t.label === trackLabel);
  if (!audioTrack) audioTrack = state.tracks.find(t => t.type === "audio");
  const trackId = audioTrack?.id || generateTrackId();

  if (!audioTrack) {
    dispatch({
      type: "ADD_TRACK",
      track: { id: trackId, type: "audio", label: trackLabel, clips: [], muted: false, locked: false },
    });
  }

  const lastEnd = audioTrack?.clips.length
    ? Math.max(...audioTrack.clips.map(c => c.end))
    : 0;

  dispatch({
    type: "ADD_CLIP",
    trackId: audioTrack?.id || trackId,
    clip: {
      id: generateClipId(),
      type: "audio",
      name,
      start: lastEnd,
      end: lastEnd + duration,
      trimStart: 0,
      trimEnd: duration,
      src: audioUrl,
      volume: 1,
      speed: 1,
      opacity: 1,
    },
  });
}

export const EditorVoicePanel = memo(function EditorVoicePanel() {
  const { state, dispatch } = useCustomTimeline();
  const [mode, setMode] = useState<SoundMode>("voiceover");
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sfxDuration, setSfxDuration] = useState(5);
  const [musicDuration, setMusicDuration] = useState(30);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const fetchAudio = useCallback(async (endpoint: string, body: Record<string, any>): Promise<Blob> => {
    const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed (${response.status})`);
    }

    return await response.blob();
  }, [supabaseUrl, supabaseKey]);

  // ─── Voiceover (TTS) ───
  const handleGenerateTTS = useCallback(async () => {
    if (!text.trim()) { toast.error("Enter text for voiceover"); return; }
    setIsGenerating(true);
    try {
      const audioBlob = await fetchAudio("editor-tts", { text: text.trim(), voiceId: selectedVoice.id });
      const audioUrl = URL.createObjectURL(audioBlob);
      setPreviewUrl(audioUrl);

      const audio = new Audio(audioUrl);
      audio.addEventListener("loadedmetadata", () => {
        const dur = audio.duration || 5;
        addAudioClipToTimeline(state, dispatch, audioUrl, `VO: ${selectedVoice.name} — ${text.slice(0, 20)}…`, dur, "Audio VO");
        toast.success(`Voiceover added (${Math.round(dur)}s)`);
      });
    } catch (err: any) {
      toast.error(err.message || "Voice generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [text, selectedVoice, state, dispatch, fetchAudio]);

  // ─── SFX ───
  const handleGenerateSFX = useCallback(async (customPrompt?: string) => {
    const finalPrompt = customPrompt || text;
    if (!finalPrompt.trim()) { toast.error("Enter a sound description"); return; }
    setIsGenerating(true);
    try {
      const audioBlob = await fetchAudio("elevenlabs-sfx", { prompt: finalPrompt.trim(), duration: sfxDuration });
      const audioUrl = URL.createObjectURL(audioBlob);
      setPreviewUrl(audioUrl);
      addAudioClipToTimeline(state, dispatch, audioUrl, `SFX: ${finalPrompt.slice(0, 25)}…`, sfxDuration, "Audio SFX");
      toast.success(`Sound effect added (${sfxDuration}s)`);
    } catch (err: any) {
      toast.error(err.message || "SFX generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [text, sfxDuration, state, dispatch, fetchAudio]);

  // ─── Music ───
  const handleGenerateMusic = useCallback(async (customPrompt?: string) => {
    const finalPrompt = customPrompt || text;
    if (!finalPrompt.trim()) { toast.error("Enter a music description"); return; }
    setIsGenerating(true);
    try {
      const audioBlob = await fetchAudio("elevenlabs-music", { prompt: finalPrompt.trim(), duration: musicDuration });
      const audioUrl = URL.createObjectURL(audioBlob);
      setPreviewUrl(audioUrl);
      addAudioClipToTimeline(state, dispatch, audioUrl, `♫ ${finalPrompt.slice(0, 25)}…`, musicDuration, "Music");
      toast.success(`Music track added (${musicDuration}s)`);
    } catch (err: any) {
      toast.error(err.message || "Music generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [text, musicDuration, state, dispatch, fetchAudio]);

  const togglePreview = useCallback(() => {
    if (!previewUrl) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => setIsPlaying(false);
      setIsPlaying(true);
    }
  }, [previewUrl, isPlaying]);

  const handleGenerate = mode === "voiceover" ? handleGenerateTTS : mode === "sfx" ? () => handleGenerateSFX() : () => handleGenerateMusic();

  const modes: { id: SoundMode; label: string; icon: React.ReactNode }[] = [
    { id: "voiceover", label: "Voice", icon: <Mic className="w-3 h-3" /> },
    { id: "sfx", label: "SFX", icon: <Zap className="w-3 h-3" /> },
    { id: "music", label: "Music", icon: <Music className="w-3 h-3" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsla(30, 80%, 55%, 0.15)" }}>
              <AudioLines className="w-3.5 h-3.5 text-[hsl(30,80%,65%)]" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[hsl(0,0%,85%)] block leading-none">Sound Lab</span>
              <span className="text-[9px] text-[hsl(0,0%,45%)]">Voice · SFX · Music</span>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "hsla(0,0%,100%,0.03)" }}>
            {modes.map(m => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setText(""); setPreviewUrl(null); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[9px] font-bold transition-all",
                  mode === m.id
                    ? "bg-[hsla(30,80%,55%,0.15)] text-[hsl(30,80%,65%)] border border-[hsla(30,80%,55%,0.3)]"
                    : "text-[hsla(0,0%,100%,0.4)] hover:text-[hsla(0,0%,100%,0.7)] border border-transparent"
                )}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* ── VOICEOVER MODE ── */}
          {mode === "voiceover" && (
            <>
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Voice</span>
                <div className="grid grid-cols-2 gap-1">
                  {VOICES.map(voice => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice)}
                      className={cn(
                        "text-left p-2 rounded-lg border transition-all",
                        selectedVoice.id === voice.id
                          ? "border-[hsla(30,80%,55%,0.4)] bg-[hsla(30,80%,55%,0.08)]"
                          : "border-[hsla(0,0%,100%,0.05)] hover:border-[hsla(30,80%,55%,0.2)]"
                      )}
                    >
                      <span className="text-[9px] font-bold text-[hsl(0,0%,80%)] block">{voice.name}</span>
                      <span className="text-[7px] text-[hsl(0,0%,45%)]">{voice.style}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Script</span>
                <textarea
                  value={text} onChange={e => setText(e.target.value)} disabled={isGenerating}
                  placeholder="Enter the voiceover text…"
                  className="w-full h-24 text-[10px] bg-[hsla(0,0%,100%,0.04)] border border-[hsla(0,0%,100%,0.08)] rounded-xl px-3 py-2.5 resize-none text-[hsl(0,0%,85%)] placeholder:text-[hsl(0,0%,35%)] outline-none focus:border-[hsla(30,80%,55%,0.4)] disabled:opacity-40"
                />
                <div className="flex items-center gap-1 text-[8px] text-[hsl(0,0%,40%)]">
                  <Volume2 className="w-3 h-3" />
                  {text.length} chars · ~{Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 2.5))}s
                </div>
              </div>
            </>
          )}

          {/* ── SFX MODE ── */}
          {mode === "sfx" && (
            <>
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Quick Presets</span>
                <div className="grid grid-cols-2 gap-1">
                  {SFX_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => { setSfxDuration(preset.duration); handleGenerateSFX(preset.prompt); }}
                      disabled={isGenerating}
                      className="text-left p-2 rounded-lg border border-[hsla(0,0%,100%,0.05)] hover:border-[hsla(45,90%,55%,0.3)] hover:bg-[hsla(45,90%,55%,0.05)] transition-all disabled:opacity-30"
                    >
                      <span className="text-[9px] font-bold text-[hsl(0,0%,80%)] block">{preset.label}</span>
                      <span className="text-[7px] text-[hsl(0,0%,45%)]">{preset.duration}s</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Custom SFX</span>
                <textarea
                  value={text} onChange={e => setText(e.target.value)} disabled={isGenerating}
                  placeholder="Describe the sound effect…"
                  className="w-full h-16 text-[10px] bg-[hsla(0,0%,100%,0.04)] border border-[hsla(0,0%,100%,0.08)] rounded-xl px-3 py-2.5 resize-none text-[hsl(0,0%,85%)] placeholder:text-[hsl(0,0%,35%)] outline-none focus:border-[hsla(45,90%,55%,0.4)] disabled:opacity-40"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[hsl(0,0%,50%)]">Duration</span>
                  <div className="flex gap-1 flex-1">
                    {[2, 5, 10, 15, 22].map(d => (
                      <button
                        key={d} onClick={() => setSfxDuration(d)}
                        className={cn("flex-1 h-6 rounded-md text-[9px] font-bold transition-all",
                          sfxDuration === d ? "bg-[hsl(45,90%,50%)] text-black" : "bg-[hsla(0,0%,100%,0.04)] text-[hsl(0,0%,50%)]")}
                      >{d}s</button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── MUSIC MODE ── */}
          {mode === "music" && (
            <>
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Music Presets</span>
                <div className="grid grid-cols-2 gap-1">
                  {MUSIC_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => { setMusicDuration(preset.duration); handleGenerateMusic(preset.prompt); }}
                      disabled={isGenerating}
                      className="text-left p-2 rounded-lg border border-[hsla(0,0%,100%,0.05)] hover:border-[hsla(280,70%,55%,0.3)] hover:bg-[hsla(280,70%,55%,0.05)] transition-all disabled:opacity-30"
                    >
                      <span className="text-[9px] font-bold text-[hsl(0,0%,80%)] block">{preset.label}</span>
                      <span className="text-[7px] text-[hsl(0,0%,45%)]">{preset.duration}s</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Custom Music</span>
                <textarea
                  value={text} onChange={e => setText(e.target.value)} disabled={isGenerating}
                  placeholder="Describe the music style, mood, instruments…"
                  className="w-full h-16 text-[10px] bg-[hsla(0,0%,100%,0.04)] border border-[hsla(0,0%,100%,0.08)] rounded-xl px-3 py-2.5 resize-none text-[hsl(0,0%,85%)] placeholder:text-[hsl(0,0%,35%)] outline-none focus:border-[hsla(280,70%,55%,0.4)] disabled:opacity-40"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[hsl(0,0%,50%)]">Duration</span>
                  <div className="flex gap-1 flex-1">
                    {[15, 30, 60].map(d => (
                      <button
                        key={d} onClick={() => setMusicDuration(d)}
                        className={cn("flex-1 h-6 rounded-md text-[9px] font-bold transition-all",
                          musicDuration === d ? "bg-[hsl(280,70%,55%)] text-white" : "bg-[hsla(0,0%,100%,0.04)] text-[hsl(0,0%,50%)]")}
                      >{d}s</button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Universal Actions */}
          <div className="flex gap-1.5">
            {previewUrl && (
              <button
                onClick={togglePreview}
                className="h-8 w-8 rounded-lg flex items-center justify-center bg-[hsla(0,0%,100%,0.06)] text-[hsl(0,0%,60%)] hover:text-[hsl(0,0%,85%)] transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className={cn(
                "flex-1 h-8 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all",
                isGenerating
                  ? "bg-[hsla(30,80%,55%,0.15)] text-[hsl(30,80%,65%)] cursor-wait"
                  : text.trim()
                  ? mode === "voiceover"
                    ? "bg-[hsl(30,80%,55%)] text-white hover:bg-[hsl(30,80%,60%)]"
                    : mode === "sfx"
                    ? "bg-[hsl(45,90%,50%)] text-black hover:bg-[hsl(45,90%,55%)]"
                    : "bg-[hsl(280,70%,55%)] text-white hover:bg-[hsl(280,70%,60%)]"
                  : "bg-[hsla(0,0%,100%,0.06)] text-[hsl(0,0%,40%)] cursor-not-allowed"
              )}
            >
              {isGenerating ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
              ) : (
                <><Plus className="w-3 h-3" /> Generate & Add to Timeline</>
              )}
            </button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});
