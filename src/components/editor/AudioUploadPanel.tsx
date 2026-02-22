import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Mic, Wand2, Play, Pause, Pencil, Video, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { TimelineClip, Caption } from "./types";

interface AudioUploadPanelProps {
  /** Callback to add audio clip to the timeline */
  onAudioUploaded: (audioUrl: string, duration: number, captions: Caption[]) => void;
  /** Callback to generate video from a set of prompts with timestamps */
  onGenerateVideos: (segments: { start: number; end: number; prompt: string }[]) => void;
  isGenerating?: boolean;
}

type WorkflowStep = "upload" | "transcribing" | "editing" | "generating";

export const AudioUploadPanel = ({ onAudioUploaded, onGenerateVideos, isGenerating = false }: AudioUploadPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [step, setStep] = useState<WorkflowStep>("upload");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Editable prompt segments derived from captions
  const [segments, setSegments] = useState<{ start: number; end: number; prompt: string; originalText: string }[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedView, setExpandedView] = useState(true);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate audio file
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      toast.error("Please upload an audio or video file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large (max 50MB)");
      return;
    }

    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    // Get duration
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", () => {
      setAudioDuration(audio.duration);
    });

    // Now transcribe
    setStep("transcribing");
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/editor-transcribe`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
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
        const segs = data.captions.map((cap: Caption) => ({
          start: cap.start,
          end: cap.end,
          prompt: cap.text,
          originalText: cap.text,
        }));
        setSegments(segs);
        setStep("editing");

        // Also add the audio to the timeline
        onAudioUploaded(url, audio.duration || audioDuration, data.captions);
        toast.success(`${segs.length} segments extracted. Edit prompts below.`);
      } else {
        toast.info("No speech detected. Try a different audio file.");
        setStep("upload");
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      toast.error(err.message || "Transcription failed");
      setStep("upload");
    } finally {
      setIsTranscribing(false);
    }
  }, [audioDuration, onAudioUploaded]);

  const handlePlayPreview = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handlePromptChange = useCallback((index: number, newPrompt: string) => {
    setSegments(prev => prev.map((seg, i) => i === index ? { ...seg, prompt: newPrompt } : seg));
  }, []);

  const handleResetPrompt = useCallback((index: number) => {
    setSegments(prev => prev.map((seg, i) => i === index ? { ...seg, prompt: seg.originalText } : seg));
  }, []);

  const handleGenerateAll = useCallback(() => {
    const validSegments = segments.filter(s => s.prompt.trim());
    if (validSegments.length === 0) {
      toast.error("No prompts to generate");
      return;
    }
    setStep("generating");
    onGenerateVideos(validSegments.map(s => ({ start: s.start, end: s.end, prompt: s.prompt })));
  }, [segments, onGenerateVideos]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {/* Hidden audio element for preview */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {(["upload", "transcribing", "editing", "generating"] as WorkflowStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border transition-all",
              step === s ? "bg-primary text-primary-foreground border-primary" :
              (["upload", "transcribing", "editing", "generating"].indexOf(step) > i)
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-secondary text-muted-foreground border-border"
            )}>
              {i + 1}
            </div>
            {i < 3 && <div className={cn("w-4 h-px", step === s || ["upload", "transcribing", "editing", "generating"].indexOf(step) > i ? "bg-primary/40" : "bg-border")} />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Upload Audio</span>
          <Button
            variant="ghost"
            className="w-full justify-center gap-2.5 h-20 text-[11px] border-2 border-dashed border-border hover:border-primary/30 rounded-xl transition-all text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium">Drop audio file or click</p>
                <p className="text-[9px] text-muted-foreground/50 mt-0.5">MP3, WAV, M4A, or video file (max 50MB)</p>
              </div>
            </div>
          </Button>
        </div>
      )}

      {/* Step 2: Transcribing */}
      {step === "transcribing" && (
        <div className="space-y-3">
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Transcribing Audio</span>
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-[11px] text-muted-foreground">Extracting speech & timestamps...</p>
            <p className="text-[9px] text-muted-foreground/50">This may take a moment for longer files</p>
          </div>
        </div>
      )}

      {/* Step 3: Edit Prompts */}
      {(step === "editing" || step === "generating") && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {segments.length} Video Prompts
            </span>
            <div className="flex items-center gap-1">
              {audioUrl && (
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground" onClick={handlePlayPreview}>
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground" onClick={() => setExpandedView(!expandedView)}>
                {expandedView ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {expandedView && (
            <div className="max-h-64 overflow-y-auto space-y-1.5 scrollbar-hide">
              {segments.map((seg, i) => (
                <div key={i} className="rounded-lg bg-secondary/50 border border-border p-2 space-y-1.5 group">
                  {/* Timestamp header */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] text-muted-foreground font-mono shrink-0 bg-muted rounded px-1 py-0.5">
                      {formatTime(seg.start)} – {formatTime(seg.end)}
                    </span>
                    <span className="text-[7px] text-muted-foreground/40 font-mono">
                      {(seg.end - seg.start).toFixed(1)}s
                    </span>
                    <div className="flex-1" />
                    <button
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-foreground transition-all"
                      onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                      title="Edit prompt"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    {seg.prompt !== seg.originalText && (
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-foreground transition-all"
                        onClick={() => handleResetPrompt(i)}
                        title="Reset to original"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>

                  {/* Original speech (small) */}
                  {seg.prompt !== seg.originalText && (
                    <p className="text-[8px] text-muted-foreground/30 italic line-through truncate">
                      {seg.originalText}
                    </p>
                  )}

                  {/* Editable prompt */}
                  {editingIndex === i ? (
                    <div className="space-y-1">
                      <textarea
                        value={seg.prompt}
                        onChange={(e) => handlePromptChange(i, e.target.value)}
                        className="w-full text-[10px] bg-background border border-border text-foreground/80 rounded-md p-1.5 resize-none focus:outline-none focus:border-primary/30 min-h-[48px]"
                        rows={3}
                        placeholder="Describe the visual scene..."
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[8px] text-primary/60 hover:text-primary px-1.5"
                        onClick={() => setEditingIndex(null)}
                      >
                        <Check className="h-2.5 w-2.5 mr-1" /> Done
                      </Button>
                    </div>
                  ) : (
                    <p
                      className="text-[9px] text-foreground/60 leading-relaxed cursor-pointer hover:text-foreground/80 transition-colors"
                      onClick={() => setEditingIndex(i)}
                    >
                      {seg.prompt}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="h-px bg-border/50" />

          {/* Generate button */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-center gap-2.5 h-10 text-[11px] border rounded-lg transition-all font-medium",
              isGenerating || step === "generating"
                ? "text-muted-foreground border-border"
                : "text-foreground hover:text-foreground hover:bg-primary/10 border-primary/30 bg-primary/5"
            )}
            onClick={handleGenerateAll}
            disabled={isGenerating || step === "generating"}
          >
            {isGenerating || step === "generating" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating {segments.length} clips...
              </>
            ) : (
              <>
                <div className="w-5 h-5 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Video className="h-2.5 w-2.5 text-primary" />
                </div>
                Generate {segments.length} Video Clips
              </>
            )}
          </Button>

          {/* Re-upload option */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-6 text-[9px] text-muted-foreground/40 hover:text-muted-foreground"
            onClick={() => {
              setStep("upload");
              setSegments([]);
              setAudioUrl(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            Upload different audio
          </Button>
        </div>
      )}
    </div>
  );
};
