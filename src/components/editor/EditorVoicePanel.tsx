/**
 * EditorVoicePanel — Generate voiceover / TTS for clips using ElevenLabs
 * Uses existing editor-tts edge function
 */

import { memo, useState, useCallback, useRef } from "react";
import { Mic, Loader2, Play, Pause, Plus, Volume2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCustomTimeline, generateClipId, generateTrackId } from "@/hooks/useCustomTimeline";

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

export const EditorVoicePanel = memo(function EditorVoicePanel() {
  const { state, dispatch } = useCustomTimeline();
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) {
      toast.error("Enter text for voiceover");
      return;
    }

    setIsGenerating(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/editor-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoice.id,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `TTS failed (${response.status})`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setPreviewUrl(audioUrl);

      // Estimate duration from audio
      const audio = new Audio(audioUrl);
      audio.addEventListener("loadedmetadata", () => {
        const duration = audio.duration || 5;
        
        // Add to audio track
        let audioTrack = state.tracks.find(t => t.type === "audio");
        const trackId = audioTrack?.id || generateTrackId();
        
        if (!audioTrack) {
          dispatch({
            type: "ADD_TRACK",
            track: { id: trackId, type: "audio", label: "Audio VO", clips: [], muted: false, locked: false },
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
            name: `VO: ${selectedVoice.name} — ${text.slice(0, 20)}…`,
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

        toast.success(`Voiceover added to audio track (${Math.round(duration)}s)`);
      });

    } catch (err: any) {
      console.error("TTS error:", err);
      toast.error(err.message || "Voice generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [text, selectedVoice, state.tracks, dispatch]);

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

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsla(30, 80%, 55%, 0.15)" }}>
              <Mic className="w-3.5 h-3.5 text-[hsl(30,80%,65%)]" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[hsl(0,0%,85%)] block leading-none">Voice Generator</span>
              <span className="text-[9px] text-[hsl(0,0%,45%)]">ElevenLabs TTS</span>
            </div>
          </div>

          {/* Voice selector */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Voice</span>
            <div className="grid grid-cols-2 gap-1">
              {VOICES.map((voice) => (
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

          {/* Text input */}
          <div className="space-y-2">
            <span className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Script</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isGenerating}
              placeholder="Enter the voiceover text…"
              className="w-full h-24 text-[10px] bg-[hsla(0,0%,100%,0.04)] border border-[hsla(0,0%,100%,0.08)] rounded-xl px-3 py-2.5 resize-none text-[hsl(0,0%,85%)] placeholder:text-[hsl(0,0%,35%)] outline-none focus:border-[hsla(30,80%,55%,0.4)] disabled:opacity-40"
            />
            <div className="flex items-center gap-1 text-[8px] text-[hsl(0,0%,40%)]">
              <Volume2 className="w-3 h-3" />
              {text.length} characters · ~{Math.max(1, Math.round(text.split(/\s+/).length / 2.5))}s
            </div>
          </div>

          {/* Actions */}
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
                  ? "bg-[hsl(30,80%,55%)] text-white hover:bg-[hsl(30,80%,60%)]"
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
