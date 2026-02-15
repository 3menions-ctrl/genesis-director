import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, Type, Trash2, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TimelineClip, Caption } from "./types";

interface CaptionsPanelProps {
  clip: TimelineClip;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

export const CaptionsPanel = ({ clip, onUpdateClip }: CaptionsPanelProps) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const captions = clip.captions || [];

  const handleAutoCaption = async () => {
    if (!clip.sourceUrl) {
      toast.error("Clip has no audio source");
      return;
    }

    setIsTranscribing(true);
    try {
      // Fetch audio from clip URL
      const audioResp = await fetch(clip.sourceUrl);
      const audioBlob = await audioResp.blob();
      const file = new File([audioBlob], "clip-audio.mp4", { type: audioBlob.type });

      const formData = new FormData();
      formData.append("audio", file);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/editor-transcribe`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Transcription failed" }));
        throw new Error(err.error || "Transcription failed");
      }

      const data = await resp.json();
      if (data.captions?.length) {
        onUpdateClip(clip.id, { captions: data.captions });
        toast.success(`${data.captions.length} captions generated`);
      } else {
        toast.info("No speech detected in clip");
      }
    } catch (err: any) {
      toast.error("Transcription failed. Please try a different clip.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTTS = async () => {
    if (!ttsText.trim()) {
      toast.error("Enter text for speech generation");
      return;
    }

    setIsSpeaking(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/editor-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: ttsText }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "TTS failed" }));
        throw new Error(err.error || "TTS failed");
      }

      const audioBlob = await resp.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();
      toast.success("Speech generated & playing");
    } catch (err: any) {
      toast.error("Speech generation failed. Please try again.");
    } finally {
      setIsSpeaking(false);
    }
  };

  const removeCaption = (index: number) => {
    onUpdateClip(clip.id, { captions: captions.filter((_, i) => i !== index) });
  };

  const clearCaptions = () => {
    onUpdateClip(clip.id, { captions: [] });
  };

  return (
    <div className="space-y-3">
      {/* Auto-captions (STT) */}
      <div className="space-y-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">Auto-Captions</span>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2.5 h-9 text-[11px] border rounded-lg transition-all",
            isTranscribing
              ? "text-white/50 border-white/[0.06]"
              : "text-white hover:text-white hover:bg-white/[0.06] border-white/[0.06]"
          )}
          onClick={handleAutoCaption}
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Mic className="h-2.5 w-2.5 text-emerald-400" />
            </div>
          )}
          {isTranscribing ? "Transcribing..." : "Generate Captions"}
        </Button>
      </div>

      {/* Caption list */}
      {captions.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/30 font-semibold">{captions.length} captions</span>
            <Button variant="ghost" size="sm" className="h-5 text-[8px] text-red-400/50 hover:text-red-400 px-1.5" onClick={clearCaptions}>
              Clear all
            </Button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-0.5 scrollbar-hide">
            {captions.map((cap, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.03] border border-white/[0.04] group">
                <span className="text-[7px] text-white/20 font-mono shrink-0 w-12">
                  {cap.start.toFixed(1)}–{cap.end.toFixed(1)}s
                </span>
                <span className="text-[9px] text-white/50 truncate flex-1">{cap.text}</span>
                <button className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-all" onClick={() => removeCaption(i)}>
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-px bg-white/[0.04]" />

      {/* Text-to-Speech */}
      <div className="space-y-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">Text to Speech</span>
        <textarea
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          placeholder="Enter text to convert to speech..."
          className="w-full h-16 text-[10px] bg-white/[0.03] border border-white/[0.06] text-white/60 placeholder:text-white/15 rounded-md p-2 resize-none focus:outline-none focus:border-white/20"
        />
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2.5 h-9 text-[11px] border rounded-lg transition-all",
            isSpeaking
              ? "text-white/50 border-white/[0.06]"
              : "text-white hover:text-white hover:bg-white/[0.06] border-white/[0.06]"
          )}
          onClick={handleTTS}
          disabled={isSpeaking || !ttsText.trim()}
        >
          {isSpeaking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <div className="w-5 h-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Volume2 className="h-2.5 w-2.5 text-primary" />
            </div>
          )}
          {isSpeaking ? "Generating..." : "Generate Speech"}
        </Button>
      </div>
    </div>
  );
};
