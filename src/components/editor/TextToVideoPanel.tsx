import { useState, useCallback } from "react";
import { Wand2, Clock, Sparkles, Loader2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TextToVideoPanelProps {
  currentTime: number;
  onGenerate: (prompt: string, durationSeconds: number, insertAt: number) => void;
  isGenerating?: boolean;
}

const DURATION_OPTIONS = [
  { value: 5, label: "5s", description: "Quick clip" },
  { value: 10, label: "10s", description: "Standard" },
  { value: 15, label: "15s", description: "Extended" },
] as const;

const PROMPT_SUGGESTIONS = [
  "A golden sunset over calm ocean waves, cinematic drone shot",
  "A futuristic city skyline at night with neon lights",
  "An eagle soaring through misty mountain peaks",
  "A close-up of raindrops on a leaf, macro photography",
  "A dancer performing in slow motion with dramatic lighting",
  "An astronaut floating in deep space with Earth behind",
];

export const TextToVideoPanel = ({
  currentTime,
  onGenerate,
  isGenerating = false,
}: TextToVideoPanelProps) => {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [insertMode, setInsertMode] = useState<"playhead" | "end">("playhead");

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    const insertAt = insertMode === "playhead" ? currentTime : -1; // -1 signals append to end
    onGenerate(prompt.trim(), duration, insertAt);
  }, [prompt, duration, insertMode, currentTime, onGenerate]);

  const handleSuggestion = useCallback((suggestion: string) => {
    setPrompt(suggestion);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Wand2 className="h-3 w-3 text-violet-400" />
        </div>
        <div>
          <h3 className="text-[11px] font-semibold text-foreground">Text to Video</h3>
          <p className="text-[8px] text-muted-foreground/60">Generate AI clips from prompts</p>
        </div>
      </div>

      {/* Prompt input */}
      <div className="space-y-1.5">
        <Label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">
          Describe your scene
        </Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A cinematic shot of..."
          rows={3}
          className="text-xs bg-secondary/50 border-border text-foreground/80 resize-none placeholder:text-muted-foreground/30 focus-visible:ring-violet-500/20 focus-visible:border-violet-500/30 rounded-lg"
          disabled={isGenerating}
        />
        <span className="text-[8px] text-muted-foreground/40 tabular-nums font-mono">
          {prompt.length}/500
        </span>
      </div>

      {/* Suggestions */}
      <div className="space-y-1.5">
        <Label className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.15em] font-semibold">
          Quick prompts
        </Label>
        <div className="flex flex-wrap gap-1">
          {PROMPT_SUGGESTIONS.slice(0, 4).map((suggestion, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(suggestion)}
              disabled={isGenerating}
              className="text-[8px] px-2 py-1 rounded-md bg-secondary/50 border border-border text-muted-foreground/70 hover:text-foreground hover:bg-secondary transition-all truncate max-w-[140px]"
              title={suggestion}
            >
              {suggestion.substring(0, 30)}…
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border/50" />

      {/* Duration selector */}
      <div className="space-y-2">
        <Label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold flex items-center gap-1.5">
          <Clock className="h-2.5 w-2.5" /> Clip Duration
        </Label>
        <div className="grid grid-cols-3 gap-1.5">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDuration(opt.value)}
              disabled={isGenerating}
              className={cn(
                "flex flex-col items-center py-2 px-1 rounded-lg border transition-all",
                duration === opt.value
                  ? "bg-violet-500/10 border-violet-500/30 text-violet-300"
                  : "bg-secondary/30 border-border text-muted-foreground/60 hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <span className="text-sm font-bold tabular-nums">{opt.label}</span>
              <span className="text-[7px] opacity-60">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Insert position */}
      <div className="space-y-2">
        <Label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold flex items-center gap-1.5">
          <Film className="h-2.5 w-2.5" /> Insert Position
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setInsertMode("playhead")}
            disabled={isGenerating}
            className={cn(
              "text-[9px] py-1.5 px-2 rounded-lg border transition-all",
              insertMode === "playhead"
                ? "bg-violet-500/10 border-violet-500/30 text-violet-300"
                : "bg-secondary/30 border-border text-muted-foreground/60 hover:bg-secondary/60"
            )}
          >
            At Playhead ({currentTime.toFixed(1)}s)
          </button>
          <button
            onClick={() => setInsertMode("end")}
            disabled={isGenerating}
            className={cn(
              "text-[9px] py-1.5 px-2 rounded-lg border transition-all",
              insertMode === "end"
                ? "bg-violet-500/10 border-violet-500/30 text-violet-300"
                : "bg-secondary/30 border-border text-muted-foreground/60 hover:bg-secondary/60"
            )}
          >
            Append to End
          </button>
        </div>
      </div>

      <div className="h-px bg-border/50" />

      {/* Credit cost info */}
      <div className="bg-secondary/30 rounded-lg border border-border p-2.5 space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-muted-foreground/60">Estimated cost</span>
          <span className="text-[10px] font-bold text-amber-400 tabular-nums">
            {duration <= 10 ? "18" : "22"} credits
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-muted-foreground/60">Est. time</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {duration <= 5 ? "30s–2m" : duration <= 10 ? "1–3m" : "2–5m"}
          </span>
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        className={cn(
          "w-full h-10 text-xs font-semibold rounded-lg transition-all gap-2",
          "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500",
          "text-white shadow-lg shadow-violet-500/20",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Generate {duration}s Clip
          </>
        )}
      </Button>

      {isGenerating && (
        <div className="space-y-1.5">
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
          <p className="text-[8px] text-muted-foreground/50 text-center">
            AI is generating your clip. This may take a few minutes…
          </p>
        </div>
      )}
    </div>
  );
};
